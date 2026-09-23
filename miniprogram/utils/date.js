function pad(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function todayKey() {
  return formatDate(new Date())
}

function daysBetween(fromKey, toKey) {
  const a = new Date(`${fromKey}T00:00:00`)
  const b = new Date(`${toKey}T00:00:00`)
  return Math.floor((b - a) / 86400000)
}

function buildMonthCells(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i += 1) cells.push(null)
  for (let d = 1; d <= days; d += 1) {
    cells.push({
      day: d,
      dateKey: `${year}-${pad(month + 1)}-${pad(d)}`
    })
  }
  return cells
}

function nextOccurrence(dateKey, repeatYearly, fromKey = todayKey()) {
  if (!repeatYearly) {
    return dateKey >= fromKey ? dateKey : null
  }
  const [, mm, dd] = dateKey.split('-')
  const year = Number(fromKey.slice(0, 4))
  let next = `${year}-${mm}-${dd}`
  if (next < fromKey) next = `${year + 1}-${mm}-${dd}`
  return next
}

module.exports = {
  pad,
  formatDate,
  todayKey,
  daysBetween,
  buildMonthCells,
  nextOccurrence
}
