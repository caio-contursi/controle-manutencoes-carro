import assert from 'node:assert/strict'
import test from 'node:test'
import { displayDate, historyEntries, mileageFromRecord } from '../src/records.js'

test('past expenses and services do not lower the odometer', () => {
  assert.equal(mileageFromRecord(25000, 21000), 25000)
  assert.equal(mileageFromRecord(25000, '27000'), 27000)
  assert.equal(mileageFromRecord(25000, ''), 25000)
  assert.equal(mileageFromRecord(25000, null), 25000)
})

test('history orders dates, shows reminders and hides only explicitly linked expenses', () => {
  const records = historyEntries(
    [{ id: 'a', title: 'Óleo', status: 'Concluída', completedAt: '2026-01-02' }, { status: 'Atrasada' }],
    [{ maintenanceId: 'a', date: '2026-01-02' }, { title: 'Gasto antigo', date: '2026-01-01' }],
    [{ title: 'Revisão', date: '2026-01-03' }],
  )
  assert.deepEqual(records.map(({ title }) => title), ['Revisão', 'Óleo', 'Gasto antigo'])
})

test('date-only values keep their calendar day and undated records stay undated', () => {
  assert.equal(displayDate('2026-01-01'), '01/01/2026')
  assert.equal(displayDate(undefined), 'Data não informada')
})
