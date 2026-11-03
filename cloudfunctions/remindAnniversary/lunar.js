// 公历转农历（1900-2049），返回如「农历八月十五」。
// 仅用于订阅消息「农历时间」字段展示；若微信 time 字段不接受中文，调用方会回退成日期。
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04bd7, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0 // 2040-2049
]

const MONTH_CN = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const DAY_TENS = ['初', '十', '廿', '三']
const DAY_ONES = ['日', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf }
function leapDays(y) { return leapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0 }
function monthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29 }
function yearDays(y) {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y - 1900] & i) ? 1 : 0
  return sum + leapDays(y)
}

function toChinaDay(d) {
  if (d === 10) return '初十'
  if (d === 20) return '二十'
  if (d === 30) return '三十'
  return DAY_TENS[Math.floor(d / 10)] + DAY_ONES[d % 10]
}

function solarToLunar(dateKey) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''))
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  let offset = Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(1900, 0, 31)) / 86400000)
  if (offset < 0 || y > 2049) return null
  let i; let temp = 0
  for (i = 1900; i < 2050 && offset > 0; i += 1) { temp = yearDays(i); offset -= temp }
  if (offset < 0) { offset += temp; i -= 1 }
  const ly = i
  const leap = leapMonth(i)
  let isLeap = false
  for (i = 1; i < 13 && offset > 0; i += 1) {
    if (leap > 0 && i === leap + 1 && !isLeap) { i -= 1; isLeap = true; temp = leapDays(ly) } else { temp = monthDays(ly, i) }
    if (isLeap && i === leap + 1) isLeap = false
    offset -= temp
  }
  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) { isLeap = false } else { isLeap = true; i -= 1 }
  }
  if (offset < 0) { offset += temp; i -= 1 }
  return { year: ly, month: i, day: offset + 1, isLeap }
}

function toLunarText(dateKey) {
  const r = solarToLunar(dateKey)
  if (!r) return ''
  const monthName = `${r.isLeap ? '闰' : ''}${MONTH_CN[r.month]}月`
  return `农历${monthName}${toChinaDay(r.day)}`
}

module.exports = { solarToLunar, toLunarText }
