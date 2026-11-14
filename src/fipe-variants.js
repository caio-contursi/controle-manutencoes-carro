const multiwordFamilies = /^(Grand (?:Siena|Vitara|Cherokee|Livina|Sc[eé]nic|Santa Fe|Carnival)|Santa Fe|Land Cruiser|Corolla Cross|Yaris Cross|Fiesta Rocam|Focus Fastback|Sandero Stepway|Aircross|C4 (?:Cactus|Lounge|Pallas|Picasso)|C3 Aircross|Space Fox|Space Cross|Eco Sport|Up!|ID\.Buzz)(?=\s|$)/i

export function fipeFamily(name) {
  const model = name.trim().replace(/^(novo|nova|new|all new)\s+/i, '')
  if (/^palio\s+week(?:end\b|\.)/i.test(model)) return 'Palio Weekend'
  const family = model.match(multiwordFamilies)?.[0] || model.split(/[\s/]+/)[0]
  return family ? family[0].toUpperCase() + family.slice(1) : name
}

export function formatFipeModel(name) {
  return name.replace(/\b([35])\s*[-–]?\s*(?:portas?|p)\b\.?/gi, '$1p')
}

export function fipeVariant(model, year) {
  const name = formatFipeModel(model.name)
  const modelYear = year.code.split('-')[0]
  return {
    modelCode: model.code,
    yearCode: year.code,
    modelYear,
    name,
    fuel: year.name.replace(/^(?:\d{4,5}|zero\s*km)\s*[-–]?\s*/i, '').trim(),
  }
}
