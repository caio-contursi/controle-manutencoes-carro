import assert from 'node:assert/strict'
import test from 'node:test'
import { calendarMonth, displayDate, historyEntries, mileageFromRecord, summarizeExpenses } from '../src/records.js'

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

test('monthly totals group timestamps by their local month and keep date-only records in their stated month', () => {
  const endOfJanuary = new Date(2026, 0, 31, 23, 55)
  const startOfFebruary = new Date(2026, 1, 1, 0, 5)
  const summary = summarizeExpenses([
    { type: 'Abastecimento', amount: 25, date: endOfJanuary.toISOString() },
    { type: 'Abastecimento', amount: 5, date: '2026-01-31' },
    { type: 'Manutenção', amount: 10, date: '2026-01-01' },
    { type: 'Manutenção', amount: 80, date: startOfFebruary.toISOString() },
    { type: 'Manutenção', amount: 90, date: 'data inválida' },
  ], calendarMonth(endOfJanuary))
  assert.deepEqual(summary, { total: 40, count: 3, buckets: { Abastecimento: 30, Manutenção: 10 } })
})
