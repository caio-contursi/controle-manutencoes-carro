import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import { fipePath, registerFipeRoute } from '../server/fipe.js'
import { ownerManuals, supportedFipeBrands, verifiedOwnerManual } from '../server/db/fipe-matches.js'

test('builds each step of a FIPE lookup', () => {
  assert.equal(fipePath({}), '/brands')
  assert.equal(fipePath({ brand: '21' }), '/brands/21/models')
  assert.equal(fipePath({ brand: '21', model: '123' }), '/brands/21/models/123/years')
  assert.equal(fipePath({ brand: '21', model: '123', year: '2015-1' }), '/brands/21/models/123/years/2015-1')
})

test('rejects malformed codes and missing parents', () => {
  for (const query of [{ brand: '../' }, { brand: ['21'] }, { model: '123' }, { brand: '21', year: '2015-1' }, { brand: '21', model: '123', year: '2015/1' }]) {
    assert.equal(fipePath(query), null)
  }
})

test('manual FIPE exige correspondência de marca, modelo, ano, combustível e código', () => {
  assert.equal(new Set(supportedFipeBrands.map(({ code }) => code)).size, 12)
  assert.equal(supportedFipeBrands.find(({ code }) => code === '23').name, 'Chevrolet')
  const selection = { brand: '21', model: '5721', year: '2016-5' }
  const quote = { codeFipe: '001372-2', modelYear: 2016 }
  const manual = verifiedOwnerManual(selection, quote)
  assert.match(manual.external_url, /handbook-2016-palio/)
  assert.equal(verifiedOwnerManual({ ...selection, model: '5293' }, { ...quote, codeFipe: '001324-2' }), manual)
  const celebration = verifiedOwnerManual({ brand: '21', model: '4825', year: '2012-5' }, { codeFipe: '001268-8', modelYear: 2012 })
  assert.match(celebration.external_url, /handbook-2012-palio-strada-siena-fire/)
  const novoPalio = verifiedOwnerManual({ brand: '21', model: '5271', year: '2012-5' }, { codeFipe: '001314-5', modelYear: 2012 })
  assert.notEqual(novoPalio, celebration)
  assert.equal(verifiedOwnerManual({ brand: '59', model: '10176', year: '2025-5' }, { codeFipe: '005540-9', modelYear: 2025 }), null)
  assert.equal(verifiedOwnerManual({ brand: '25', model: '8281', year: '2020-1' }, { codeFipe: '014099-6', modelYear: 2020 }), null)
  assert.equal(verifiedOwnerManual({ ...selection, year: '2016-1' }, quote), null)
  assert.equal(verifiedOwnerManual(selection, { ...quote, modelYear: 2015 }), null)
  assert.equal(verifiedOwnerManual(selection, { ...quote, codeFipe: '001269-6' }), null)
})

test('cada vínculo de manual tem chave única, fonte e evidência', () => {
  const knownBrands = new Set(supportedFipeBrands.map(({ code }) => code))
  const exactKeys = new Set()
  for (const manual of ownerManuals) {
    assert.match(manual.external_url, /^https:\/\/.+\.pdf$/i, manual.title)
    assert.ok(manual.evidence)
    for (const key of manual.keys) {
      assert.match(key, /^\d+\/\d+\/\d{4}-\d+\/\d{6}-\d$/)
      assert.equal(exactKeys.has(key), false, key)
      exactKeys.add(key)
      const [brand, model, year, codeFipe] = key.split('/')
      assert.ok(knownBrands.has(brand), key)
      assert.equal(verifiedOwnerManual({ brand, model, year }, { codeFipe, modelYear: Number(year.split('-')[0]) }).external_url, manual.external_url)
    }
  }
})

test('consulta FIPE encontra o manual Chevrolet pelo modelo e ano', async (t) => {
  const routes = new Map()
  registerFipeRoute({ get: (path, handler) => routes.set(path, handler) })
  const lookup = routes.get('/api/fipe/cars')
  let quote
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => quote }))

  async function consult(model, year, details = {}, modelCode = '123', fuelCode = '5') {
    quote = { model, modelYear: year, fuel: 'Flex', price: 'R$ 25.000,00', ...details }
    const response = {
      set: () => response,
      json: (data) => data,
    }
    return lookup({ query: { brand: '23', model: modelCode, year: year + '-' + fuelCode } }, response)
  }

  for (let year = 2008; year <= 2015; year++) {
    const { price, manuals } = await consult('Celta Life 1.0 MPFI 8V Flex 4p', year)
    assert.equal(price, 'R$ 25.000,00')
    assert.equal(manuals.length, 1, String(year))
    const [manual] = manuals
    assert.equal(manual.matchLevel, 'model-year')
    assert.match(manual.external_url, /chevrolet\.com\.br\/.+\/celta\//)
    assert.match(manual.external_url, new RegExp(String(year)))
    assert.ok(manual.token)
  }

  assert.deepEqual((await consult('Celta Life', 2007)).manuals, [])
  assert.deepEqual((await consult('Celta Life', 2015, { modelYear: 2014 })).manuals, [])
  assert.deepEqual((await consult('CeltaPlus', 2014)).manuals, [])
  const cases = [
    ['Astra Sedan 2.0 MPFI FlexPower', 2011, 'Astra'],
    ['Corsa Hat. Maxx 1.4 8V ECONOFLEX 5p', 2012, 'Corsa'],
    ['Corsa Sed Class.Spirit 1.0/1.0 FlexPower', 2010, 'Classic'],
    ['PRISMA Sed. Maxx/ LT 1.4 8V ECONOF. 4p', 2008, 'Prisma'],
    ['PRISMA Sed. Joy/ LS 1.0 8V FlexPower 4p', 2018, 'Prisma Joy'],
    ['ONIX HATCH Joy 1.0 8V Flex 5p Mec.', 2017, 'Onix Joy'],
    ['ONIX HATCH LT 1.0 12V Flex 5p Mec.', 2026, 'Onix'],
    ['ONIX SED. Plus PREM. 1.0 12V TB Flex Aut', 2026, 'Onix Plus'],
    ['CRUZE HB Sport LT 1.8 16V FlexP. 5p Aut', 2014, 'Cruze Sport6'],
    ['S10 Blazer Colina 2.8 TDI 4x4 Diesel', 2009, 'Blazer'],
    ['S10 LT 2.8 Diesel', 2009, 'S10'],
    ['S10 Pick-Up LT 2.8 TDI 4x2 CD Diesel', 2012, 'S10'],
    ['CAPTIVA EV Premier', 2026, 'Captiva EV'],
    ['EQUINOX EV 292cv (Elétrico)', 2024, 'Equinox EV'],
    ['EQUINOX ACTIV 1.5 Turbo 177cv Aut.', 2026, 'Equinox'],
    ['Sonic RS 1.0 12V Turbo Aut.', 2027, 'Sonic'],
  ]
  for (const [model, year, title] of cases) {
    const { manuals } = await consult(model, year)
    assert.equal(manuals[0]?.title, `Chevrolet ${title} ${year}`, model)
    assert.ok(manuals[0].token)
  }
  assert.deepEqual((await consult('EQUINOX EV', 2026, { fuel: 'Elétrico' })).manuals, [])
  assert.deepEqual((await consult('S10 P-Up Colina 2.8 TDI 4x2/4x4 CD Dies.', 2012)).manuals, [])
  const classic = await consult('Corsa Sed Classic Life 1.6 MPFI VHC 8V', 2005, { fuel: 'Gasolina' }, '1032', '1')
  assert.equal(classic.manuals[0].title, 'Chevrolet Classic 1.6 2005')
  const classicFlex = await consult('Corsa Sed Class.Life 1.0/1.0 FlexPower', 2005, { fuel: 'Gasolina' }, '1031', '1')
  assert.deepEqual(classicFlex.manuals, [])
  assert.deepEqual((await consult('Onix LT', 2014, { fuel: 'Elétrico' })).manuals, [])
  assert.deepEqual((await consult('Onix LT', 32000)).manuals, [])
})

test('consulta FIPE usa a edição Fiat que corresponde à versão e ao ano', async (t) => {
  const routes = new Map()
  registerFipeRoute({ get: (path, handler) => routes.set(path, handler) })
  let quote = { modelYear: 2014, price: 'R$ 26.000,00' }
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ ...quote }) }))
  const consult = (model, year = '2014-5') => routes.get('/api/fipe/cars')(
    { query: { brand: '21', model, year } },
    { set() { return this }, json(data) { return data } },
  )

  const fire = await consult('4825')
  const novo = await consult('5721')
  assert.equal(fire.price, 'R$ 26.000,00')
  assert.match(fire.manuals[0].external_url, /\/171\/2014\//)
  assert.match(novo.manuals[0].external_url, /\/196\/2014\//)
  assert.ok(fire.manuals[0].token)
  assert.ok(novo.manuals[0].token)
  assert.deepEqual((await consult('4825', '2014-3')).manuals, [])
  quote = { modelYear: 2013 }
  assert.deepEqual((await consult('4825')).manuals, [])
})

test('consulta FIPE apresenta as edições de fabricação e a série especial Volkswagen', async (t) => {
  const routes = new Map()
  registerFipeRoute({ get: (path, handler) => routes.set(path, handler) })
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    json: async () => ({ modelYear: Number(url.split('/').at(-1).split('-')[0]) }),
  }))
  const consult = (model, year) => routes.get('/api/fipe/cars')(
    { query: { brand: '59', model, year } },
    { set() { return this }, json(data) { return data } },
  )

  const polo = await consult('10176', '2025-5')
  assert.equal(polo.manuals.length, 2)
  assert.ok(polo.manuals.some((manual) => manual.title.includes('21/10/2024')))
  for (const manual of polo.manuals) assert.ok(manual.token)
  const gol = await consult('10166', '2023-5')
  assert.equal(gol.manuals.length, 1)
  assert.match(gol.manuals[0].external_url, /Gol_Last_Edition/i)
  assert.deepEqual((await consult('10176', '2025-3')).manuals, [])
})

test('catálogo Chevrolet fornece o PDF e a fonte sem uma consulta FIPE', async (t) => {
  const request = globalThis.fetch
  const app = express()
  registerFipeRoute(app)
  const server = app.listen(0, '127.0.0.1')
  t.after(() => server.close())
  await once(server, 'listening')
  const base = 'http://127.0.0.1:' + server.address().port
  const { models } = await (await request(base + '/api/catalog/chevrolet-manuals')).json()
  const { manuals: [manual] } = models.find(({ model }) => model === 'Prisma').years.find(({ year }) => year === '2014')
  const pdf = Buffer.from('%PDF-1.7')
  const fetchPdf = t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(pdf.subarray(0, 3))
      controller.enqueue(pdf.subarray(3))
      controller.close()
    },
  })))

  for (const download of ['', '&download=1']) {
    const response = await request(base + '/api/catalog/manual-pdf?token=' + encodeURIComponent(manual.token) + download)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/pdf')
    assert.match(response.headers.get('Content-Disposition'), download ? /^attachment;/ : /^inline;/)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf)
    assert.equal(fetchPdf.mock.calls.at(-1).arguments[0].href, manual.external_url)
  }
  assert.match(manual.source, /^https:\/\//)
})
