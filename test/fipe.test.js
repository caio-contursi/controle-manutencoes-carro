import assert from 'node:assert/strict'
import test from 'node:test'
import { fipePath } from '../server/fipe.js'

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
