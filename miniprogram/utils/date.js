function pad(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 与云函数一致，按上海时区取今天 */
function todayKey() {
  try {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
  } catch (err) {
    return formatDate(new Date())
  }
}

function daysBetween(fromKey, toKey) {
  const a = new Date(`${fromKey}T00:00:00+08:00`)
  const b = new Date(`${toKey}T00:00:00+08:00`)
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

function formatDateTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function leftText(left) {
  if (left === 0) return '就是今天'
  if (left > 0) return `还有 ${left} 天`
  return `已过去 ${-left} 天`
}

module.exports = {
  pad,
  formatDate,
  todayKey,
  daysBetween,
  buildMonthCells,
  nextOccurrence,
  formatDateTime,
  leftText
}
