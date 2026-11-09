export function displayDate(value) {
  if (!value) return 'Data não informada'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T12:00:00' : value)
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR')
}

export function mileageFromRecord(current, recorded) {
  if (recorded == null || recorded === '' || !Number.isFinite(Number(recorded))) return current
  return Math.max(current, Number(recorded))
}

export function historyEntries(maintenance, expenses, reminders) {
  const services = maintenance.filter((item) => item.status === 'Concluída')
  const serviceIds = new Set(services.map((item) => item.id).filter(Boolean))
  const entries = [
    ...services.map((item, index) => ({ ...item, date: item.completedAt, kind: 'Serviço', key: 'service-' + index })),
    ...expenses.filter((item) => !serviceIds.has(item.maintenanceId)).map((item, index) => ({ ...item, kind: 'Gasto', key: 'expense-' + index })),
    ...reminders.map((item, index) => ({ ...item, kind: 'Lembrete', key: 'reminder-' + index })),
  ]
  return entries.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
}
