import { readFileSync } from 'node:fs'
import { fipeFamily } from '../../src/fipe-variants.js'

const index = JSON.parse(readFileSync(new URL('./chevrolet-manuals.json', import.meta.url), 'utf8'))
const models = new Map(Object.keys(index).map((name) => [name.toLowerCase(), name]))

function chevroletModel(name, year) {
  const description = name.trim().replace(/^(?:novo|nova|new|all new)\s+/i, '').toLowerCase()
  if (/^s-?10\s+blazer\b/.test(description)) return 'Blazer'
  // The FIPE lists both S10 generations for 2012.
  if (year === 2012 && /^s-?10\b.*\b(?:advant|colina|exec|rodeio)/.test(description)) return
  if (/^ss-?10\b/.test(description)) return 'SS10'
  if (/^silverado\s+(?:g\.|grand)\s*blazer\b/.test(description)) return 'Grand Blazer'
  if (/^corsa\s+(?:classic\b|sed(?:an)?\.?\s+clas(?:sic\b|s?\.)|sed\.?\s*wind\b.*\/classic\b|sedan\s+sup\.\/classic\b)/.test(description)) return 'Classic'
  if (year >= 2002 && /^corsa\s+(?:pick[- ]?up|furg[aã]o|wagon)\b/.test(description)) return
  if (year <= 1996 && /^corsa\s+(?:gsi|pick[- ]?up|sedan|wagon)\b/.test(description)) return
  if (year >= 1993 && year <= 1995 && /^camaro\b.*\b5\.0\b/.test(description)) return
  if (year <= 1995 && /^cavalier\b.*\b2\.0\b/.test(description)) return
  if (/^cheynne\b/.test(description)) return 'Cheyenne'
  if (/^onix\s+(?:plus\b|sedan\b|sed\.|sd\.)/.test(description)) return 'Onix Plus'
  if (/^onix\s+(?:hatch\s+)?joy\b/.test(description)) return year >= 2020 ? 'Joy' : 'Onix Joy'
  if (year >= 2017 && /^prisma\s+(?:sed\.?\s+)?joy\b/.test(description)) return 'Prisma Joy'
  if (/^joy\s+plus\b/.test(description)) return 'Joy Plus'
  if (/^cruze\s+(?:hb|hatch(?:back)?|sport6?|sport-6)\b/.test(description)) return 'Cruze Sport6'
  if (year === 2014 && /^spin\s+ls\b/.test(description)) return
  if (/^spin\s+advantage\b/.test(description) && year === 2014) return 'Spin Advantage'
  if (/^cobalt\s+advantage\b/.test(description) && year === 2014) return 'Cobalt Advantage'
  if (/^blazer\s+ev\b/.test(description)) return 'Blazer EV'
  if (/^captiva\s+ev\b/.test(description)) return 'Captiva EV'
  if (/^equinox\s+ev\b/.test(description)) return 'Equinox EV'
  if (/^bolt\s+euv\b/.test(description)) return 'Bolt EUV'
  if (/^bolt\s+ev\b/.test(description)) return 'Bolt EV'
  if (/^spark\s+euv\b/.test(description)) return 'Spark EUV'
  if (/^chevy\s+500\b/.test(description)) return 'Chevy 500'
  return models.get(fipeFamily(description).toLowerCase())
}

function entries(model, year, rows) {
  return rows.map(({ fipeVariants, ...row }) => {
    const title = row.title || `Chevrolet ${model} ${year}`
    return {
      ...row,
      title,
      edition: title,
      matchLevel: 'model-year',
      notes: row.notes || 'Confira se a edição se aplica à versão e à data de fabricação do seu veículo.',
    }
  })
}

export function chevroletOwnerManuals(requestedYear, quote, modelCode) {
  const year = Number(quote.modelYear)
  if (typeof quote.model !== 'string' || !/^(?:19|20)\d{2}$/.test(String(quote.modelYear)) ||
      requestedYear.split('-')[0] !== String(year)) return []
  const model = chevroletModel(quote.model, year)
  if (!model || (/el[eé]tric/i.test(quote.fuel || '') && !/ (?:EV|EUV)$/.test(model))) return []
  const variant = modelCode + '/' + requestedYear
  const rows = index[model]?.[year]?.filter(({ fipeVariants }) => !fipeVariants || fipeVariants.includes(variant)) || []
  return entries(model, year, rows)
}

export function listChevroletOwnerManuals() {
  return Object.entries(index).map(([model, years]) => ({
    model,
    years: Object.entries(years).reverse().map(([year, rows]) => ({ year, manuals: entries(model, year, rows) })),
  }))
}

export function findChevroletOwnerManuals(model, year, modelCode) {
  const normalized = models.get(String(model || '').trim().toLowerCase())
  const rows = index[normalized]?.[Number(year)] || []
  const variant = modelCode ? `${modelCode}/${year}-5` : null
  const matched = rows.filter(({ fipeVariants }) => !fipeVariants || !variant || fipeVariants.includes(variant))
  return entries(normalized, Number(year), matched)
}
