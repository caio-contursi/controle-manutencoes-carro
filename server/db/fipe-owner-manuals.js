import { readFileSync } from 'node:fs'

const loadSeed = (slug) => JSON.parse(readFileSync(new URL(`./${slug}-manuals.json`, import.meta.url), 'utf8'))

export const fipeManualCatalogs = [
  { brand: '21', slug: 'fiat', seed: loadSeed('fiat') },
  { brand: '59', slug: 'volkswagen', seed: loadSeed('volkswagen') },
  { brand: '22', slug: 'ford', seed: loadSeed('ford') },
  { brand: '48', slug: 'renault', seed: loadSeed('renault') },
  { brand: '56', slug: 'toyota', seed: loadSeed('toyota') },
  { brand: '25', slug: 'honda', seed: loadSeed('honda') },
  { brand: '26', slug: 'hyundai', seed: loadSeed('hyundai') },
  { brand: '29', slug: 'jeep', seed: loadSeed('jeep') },
  { brand: '43', slug: 'nissan', seed: loadSeed('nissan') },
  { brand: '13', slug: 'citroen', seed: loadSeed('citroen') },
]

export function createFipeManualIndex(rows) {
  const variants = new Map()
  const models = new Map()

  for (const { model, year, fipeVariants, ...entry } of rows) {
    const manual = { ...entry, edition: entry.title, matchLevel: 'model-year' }
    if (!models.has(model)) models.set(model, new Map())
    const years = models.get(model)
    if (!years.has(year)) years.set(year, [])
    years.get(year).push(manual)
    for (const variant of fipeVariants) {
      if (!variants.has(variant)) variants.set(variant, [])
      variants.get(variant).push(manual)
    }
  }

  return {
    lookup(modelCode, yearCode, quote) {
      if (String(quote.modelYear) !== yearCode.split('-')[0]) return []
      return variants.get(`${modelCode}/${yearCode}`) || []
    },
    list() {
      return Array.from(models, ([model, years]) => ({
        model,
        years: Array.from(years, ([year, manuals]) => ({ year, manuals })).sort((a, b) => b.year - a.year),
      })).sort((a, b) => a.model.localeCompare(b.model, 'pt-BR'))
    },
  }
}
