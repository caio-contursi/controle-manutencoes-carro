import { readFileSync } from 'node:fs'

const index = JSON.parse(readFileSync(new URL('./manufacturer-manuals.json', import.meta.url), 'utf8'))
const modelKeys = new Map()
for (const key of Object.keys(index)) {
  const [brand, model] = key.split('/')
  if (!modelKeys.has(brand)) modelKeys.set(brand, new Set())
  modelKeys.get(brand).add(model)
}

export function manualsByModelYear(brand, quote) {
  if (typeof quote.model !== 'string' || !/^20\d{2}$/.test(String(quote.modelYear))) return []
  const words = quote.model.toLowerCase().replace(/^(?:novo|nova)\s+/, '').split(/\s+/)
  let model = ''
  let prefix = ''
  for (const word of words) {
    prefix += word.replace(/[^a-z0-9]/g, '')
    if (modelKeys.get(brand)?.has(prefix)) model = prefix
  }
  if (!model) return []
  const description = words.join(' ')
  if (brand === '59' && model === 'polo' && /^polo\s+sed[aã]/.test(description)) return []
  if (brand === '23' && model === 'cruze' && /^cruze\s+(?:sport|hatch)/.test(description)) return []
  if (brand === '43' && model === 'march' && /^march\s+active/.test(description)) return []
  // Avoid substituting combustion manuals for an electric model with a shared name.
  if (/el[eé]tric/i.test(quote.fuel || '') && !/ev|id[. ]|leaf|euv/i.test(model)) return []
  return (index[brand + '/' + model + '/' + quote.modelYear] || []).map((manual) => ({
    ...manual,
    edition: manual.title,
    matchLevel: 'model-year',
    notes: 'Publicado para o modelo e ano. Confira a edição aplicável à sua versão no portal da montadora.',
  }))
}
