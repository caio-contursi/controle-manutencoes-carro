import assert from 'node:assert/strict'
import test from 'node:test'
import { fipeFamily, fipeVariant } from '../src/fipe-variants.js'
import { fipePath } from '../server/fipe.js'

test('agrupa carrocerias e acabamentos da mesma família sem descartar nomes compostos', () => {
  assert.equal(fipeFamily('Astra Sedan GLS 2.0 8V 4p'), 'Astra')
  assert.equal(fipeFamily('Corsa Hatch 1.4 4p'), 'Corsa')
  assert.equal(fipeFamily('New Fiesta Hatch 1.6 16V 5p'), 'Fiesta')
  assert.equal(fipeFamily('Corolla Cross XRE 2.0'), 'Corolla Cross')
  assert.equal(fipeFamily('Palio Weekend Adventure 1.6 8V/16V'), 'Palio Weekend')
  assert.equal(fipeFamily('Palio Week.Adv. ITAL. Dual. 1.8 Flex 16V'), 'Palio Weekend')
})

test('padroniza 3p e 5p preservando os demais detalhes da versão', () => {
  const year = { code: '2015-5', name: '2015 Flex' }
  assert.equal(fipeVariant({ code: '10', name: 'Astra Hatch 2.0 8V 3 portas' }, year).name, 'Astra Hatch 2.0 8V 3p')
  assert.equal(fipeVariant({ code: '11', name: 'Astra GLS 2.0 8V 5P' }, year).name, 'Astra GLS 2.0 8V 5p')
})

test('aceita o código FIPE de ano para veículo zero km', () => {
  assert.equal(fipePath({ brand: '21', model: '10', year: '32000-5' }), '/brands/21/models/10/years/32000-5')
})
