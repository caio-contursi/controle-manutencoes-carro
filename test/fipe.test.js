import assert from 'node:assert/strict'
import test from 'node:test'
import { fipePath } from '../server/fipe.js'
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
