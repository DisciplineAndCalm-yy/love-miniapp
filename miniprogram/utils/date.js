function pad(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 与云函数一致，按上海时区取今天。
 * 注意:部分安卓 WebView 会忽略 toLocaleString 的 locale 参数，返回系统格式
 * (如 2026/9/25)，导致 slice 出坏日期。全程只用纯数学计算，不依赖 locale。 */
function todayKey() {
  const t = Date.now() + 8 * 3600000
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function keyFromUTCDate(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function shiftDateKey(key, delta) {
  const [y, m, day] = String(key).split('-').map(Number)
  if (!y || !m || !day) return ''
  const t = Date.UTC(y, m - 1, day) + delta * 86400000
  return keyFromUTCDate(new Date(t))
}

function daysBetween(fromKey, toKey) {
  const f = String(fromKey).split('-').map(Number)
  const t = String(toKey).split('-').map(Number)
  if (f.length < 3 || t.length < 3 || f.some(Number.isNaN) || t.some(Number.isNaN)) return NaN
  const a = Date.UTC(f[0], f[1] - 1, f[2])
  const b = Date.UTC(t[0], t[1] - 1, t[2])
  return Math.round((b - a) / 86400000)
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
  if (!Number.isFinite(left)) return '日期有点问题,点进来改一下'
  if (left === 0) return '就是今天'
  if (left > 0) return `还有 ${left} 天`
  return `已过去 ${-left} 天`
}

/** 只接受 YYYY-MM-DD 字符串,其它一律视为无效(防脏数据导致 NaN) */
function isDateKey(k) {
  return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k)
}

function normDateKey(k) {
  if (isDateKey(k)) return k
  const s = String((k && (k.dateKey || k.value)) || '').slice(0, 10)
  return isDateKey(s) ? s : ''
}

module.exports = {
  pad,
  formatDate,
  todayKey,
  daysBetween,
  buildMonthCells,
  nextOccurrence,
  formatDateTime,
  leftText,
  isDateKey,
  normDateKey,
  shiftDateKey
}
