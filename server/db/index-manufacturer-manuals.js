import { writeFile } from 'node:fs/promises'
import { manufacturerPortals } from './manual-portals.js'

const sources = [
  [59, manufacturerPortals[59]],
  [23, 'https://www.chevrolet.com.br/servicos/manuais-veiculos/anos-anteriores'],
  [43, 'https://www.nissan.com.br/servicos/manuais/novo-versa.html'],
]
const nissanPage = await fetch(manufacturerPortals[43], { signal: AbortSignal.timeout(15000) })
if (!nissanPage.ok) throw Error('Falha ao listar os manuais Nissan')
const nissanPaths = [...new Set((await nissanPage.text()).match(/href="\/servicos\/manuais\/[a-z0-9-]+\.html"/g) || [])]
const nissanModels = {
  'frontier': 'Frontier', 'sentra': 'Sentra', 'march': 'March', 'leaf': 'Leaf',
  'kicks-play': 'Kicks Play', 'kait': 'Kait', 'v-drive': 'V-Drive',
}
for (const href of nissanPaths) {
  const path = href.slice(6, -1)
  const model = nissanModels[path.split('/').at(-1).replace('.html', '')]
  if (model) sources.push([43, new URL(path, manufacturerPortals[43]).href, model])
}
const renaultPage = await fetch(manufacturerPortals[48], { signal: AbortSignal.timeout(15000) })
if (!renaultPage.ok) throw Error('Falha ao listar os manuais Renault')
const renaultPaths = [...new Set((await renaultPage.text()).match(/href="\/manuais\/[a-z0-9-]+\.html"/g) || [])]
for (const href of renaultPaths) {
  const path = href.slice(6, -1)
  sources.push([48, new URL(path, manufacturerPortals[48]).href, path.split('/').at(-1).replace('.html', '')])
}
const index = {
  '25/civic/2020': [{
    external_url: 'https://www.honda.com.br/pos-venda/automoveis/sites/customer_service/files/2020-01/Civic%202020%20-%20Manual%20do%20propriet%C3%A1rio_20200128.pdf',
    title: 'Manual Civic 2020',
    source: manufacturerPortals[25],
  }],
}
for (const [brand, source, sourceModel = 'Versa'] of sources) {
  const response = await fetch(source, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw Error('Falha ao ler ' + source)
  for (const [, href, markup] of (await response.text()).matchAll(/<a\b[^>]*href="([^"]+\.pdf[^"]*)"[^>]*>(.*?)<\/a>/gis)) {
    const url = new URL(href.replaceAll('&amp;', '&'), source)
    if (url.origin !== new URL(source).origin && !(brand === 48 && url.origin === 'https://cdn.group.renault.com')) continue
    const title = markup.replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|#160);/g, ' ').replace(/\s+/g, ' ').trim().replace(/^Faz o download de um arquivo\s*/i, '')
    let match
    if (brand === 59) {
      if (!url.pathname.includes('/literatura-de-bordo/') || /suplemento|rádio|resgate|conectado|alinhamento/i.test(title)) continue
      match = title.match(/^Manual (?:Novo )?(.+?) (20\d{2})(?:\s*[–-]\s*V[aá]lido.*)?$/i)
        || title.match(/^(.+?) (20\d{2})\s*-\s*Manual de instruções$/i)
    } else if (brand === 23) {
      match = url.pathname.match(/\/manual-([a-z0-9-]+)-(20\d{2})\.pdf$/i)
      if (match && title !== match[2]) continue
    } else if (brand === 48) {
      const filename = decodeURIComponent(url.pathname.split('/').at(-1))
      if (!/manual.*propriet[aá]rio/i.test(filename) || /radio|multim[ií]dia|garantia/i.test(filename)) continue
      const normalized = normalizeManualModel(filename)
      if (!normalized.includes(normalizeManualModel(sourceModel))) continue
      const year = filename.match(/(?:^|[-_ ])(20\d{2})(?=[-_. ]|$)/)?.[1]
      if (year) match = [null, sourceModel, year]
    } else {
      if (!/^Manual (?:do|de) Proprietário/i.test(title)) continue
      const year = decodeURIComponent(url.pathname).match(/\/(20\d{2})\//)?.[1]
      if (year) match = [null, sourceModel, year]
    }
    if (!match) continue
    const [, model, year] = match
    const key = brand + '/' + normalizeManualModel(model) + '/' + year
    const entries = index[key] ??= []
    if (!entries.some((entry) => entry.external_url === url.href)) {
      entries.push({ external_url: url.href, title: brand === 59 ? title : 'Manual do proprietário ' + year, source })
    }
  }
}
await writeFile(new URL('./manufacturer-manuals.json', import.meta.url), JSON.stringify(index, null, 2) + '\n')
console.log(Object.keys(index).length + ' combinações de marca, modelo e ano')

function normalizeManualModel(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}
