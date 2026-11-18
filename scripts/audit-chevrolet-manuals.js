import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const [base = 'http://127.0.0.1:5173', reportPath, previousReport] = process.argv.slice(2)
const viewMode = { name: 'inline', download: false }
const downloadMode = { name: 'attachment', download: true }

async function checkPdf(token, { name, download }) {
  const url = new URL('/api/catalog/manual-pdf', base)
  url.searchParams.set('token', token)
  if (download) url.searchParams.set('download', '1')

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(165000) })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error('HTTP ' + response.status)
      }
      const type = response.headers.get('content-type')
      const disposition = response.headers.get('content-disposition')
      const hash = createHash('sha256')
      let prefix = Buffer.alloc(0)
      let tail = Buffer.alloc(0)
      let bytes = 0
      for await (const chunk of response.body) {
        hash.update(chunk)
        bytes += chunk.length
        if (prefix.length < 5) prefix = Buffer.concat([prefix, chunk.subarray(0, 5 - prefix.length)])
        tail = Buffer.concat([tail, chunk.subarray(-4096)]).subarray(-4096)
      }
      if (type !== 'application/pdf' || !disposition?.startsWith(name + ';') ||
          prefix.toString() !== '%PDF-' || !tail.includes('%%EOF')) {
        throw new Error('Resposta inválida para ' + name)
      }
      return { bytes, sha256: hash.digest('hex') }
    } catch (error) {
      if (attempt === 1) return { error: error.message }
      await delay(1500)
    }
  }
}

const response = await fetch(new URL('/api/catalog/chevrolet-manuals', base), {
  signal: AbortSignal.timeout(10000),
})
if (!response.ok) throw new Error('Catálogo Chevrolet indisponível: HTTP ' + response.status)

const { models } = await response.json()
const catalog = models.flatMap(({ model, years }) =>
  years.flatMap(({ year, manuals }) => manuals.map((manual) => ({ model, year, ...manual }))))
if (!catalog.length) throw new Error('Catálogo Chevrolet vazio')

// Multiple model-years may intentionally share the same signed PDF.
const tokens = new Map(catalog.map(({ token, external_url }) => [external_url, token]))
const results = new Map()
if (previousReport) {
  const { entries } = JSON.parse(await readFile(previousReport, 'utf8'))
  for (const { external_url, inline, attachment, passed } of entries) {
    if (tokens.has(external_url) && passed && inline?.sha256 && inline.sha256 === attachment?.sha256) {
      results.set(external_url, { inline, attachment, passed })
    }
  }
  console.log(`${results.size} PDFs com testes aprovados no relatório anterior`)
}
const documents = [...tokens].filter(([url]) => !results.has(url))
const previousCount = results.size
let next = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < documents.length) {
    const [url, token] = documents[next++]
    const inline = await checkPdf(token, viewMode)
    const attachment = await checkPdf(token, downloadMode)
    const passed = Boolean(inline.sha256 && inline.sha256 === attachment.sha256)
    results.set(url, { inline, attachment, passed })
    const tested = results.size - previousCount
    if (tested % 25 === 0 || tested === documents.length) {
      console.log(`${tested}/${documents.length} PDFs testados nos dois modos`)
    }
  }
}))

const entries = catalog.map(({ model, year, title, external_url, source }) => ({
  model, year, title, external_url, source, ...results.get(external_url),
}))
const failed = entries.filter(({ passed }) => !passed)
if (reportPath) await writeFile(reportPath, JSON.stringify({ models: models.length, entries }, null, 2) + '\n')
for (const { title, inline, attachment } of failed) {
  console.error(title, inline.error ?? 'inline OK', attachment.error ?? 'attachment OK')
}
console.log(`${entries.length - failed.length}/${entries.length} registros em ${models.length} modelos passaram.`)
process.exitCode = failed.length ? 1 : 0
