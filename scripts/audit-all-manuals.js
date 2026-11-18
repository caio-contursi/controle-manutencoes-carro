import { writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

const [base = 'http://127.0.0.1:5173', reportPath] = process.argv.slice(2)
const catalogs = [
  'chevrolet', 'fiat', 'volkswagen', 'ford', 'renault', 'toyota', 'honda', 'hyundai', 'jeep', 'nissan', 'citroen',
]
const entries = []
for (const brand of catalogs) {
  const response = await fetch(new URL(`/api/catalog/${brand}-manuals`, base))
  if (!response.ok) throw new Error(`${brand}: HTTP ${response.status}`)
  const data = await response.json()
  for (const { model, years } of data.models || []) {
    for (const { year, manuals } of years || []) {
      for (const manual of manuals || []) entries.push({ brand, model, year, ...manual })
    }
  }
}
const unique = new Map(entries.map((entry) => [entry.external_url, entry]))
async function check(entry, download) {
  const url = new URL('/api/catalog/manual-pdf', base)
  url.searchParams.set('token', entry.token)
  if (download) url.searchParams.set('download', '1')
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180000) })
      if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`) }
      const type = response.headers.get('content-type')
      const disposition = response.headers.get('content-disposition') || ''
      const expected = download ? 'attachment;' : 'inline;'
      if (type !== 'application/pdf' || !disposition.startsWith(expected)) throw new Error('Invalid PDF headers')
      const reader = response.body.getReader()
      const { value } = await reader.read()
      await reader.cancel()
      const prefix = Buffer.from(value || []).subarray(0, 5).toString()
      if (prefix !== '%PDF-') throw new Error('Invalid PDF signature')
      return { prefix, contentLength: response.headers.get('content-length') }
    } catch (error) { if (attempt === 2) return { error: error.message }; await delay(600 * (attempt + 1)) }
  }
}
const results = new Map()
let next = 0
const documents = [...unique.values()]
await Promise.all(Array.from({ length: 32 }, async () => {
  while (next < documents.length) {
    const entry = documents[next++]
    const inline = await check(entry, false)
    const attachment = await check(entry, true)
    results.set(entry.external_url, { inline, attachment, passed: Boolean(inline.prefix && inline.prefix === attachment.prefix) })
    if (results.size % 100 === 0) console.log(`${results.size}/${documents.length} unique PDFs checked`)
  }
}))
const report = entries.map(({ token, ...entry }) => ({ ...entry, ...results.get(entry.external_url) }))
const failed = report.filter((entry) => !entry.passed)
console.log(`${report.length} entries, ${unique.size} distinct PDFs, ${report.length - failed.length}/${report.length} entries passed inline and download checks.`)
if (failed.length) console.error(failed.map(({ brand, model, year, title, inline, attachment }) => `${brand}/${model}/${year}: ${title} [${inline.error || 'inline OK'}; ${attachment.error || 'download OK'}]`).join('\n'))
if (reportPath) await writeFile(reportPath, JSON.stringify({ entries: report, uniquePdfs: unique.size, failed: failed.length }, null, 2) + '\n')
process.exitCode = failed.length ? 1 : 0
