const cloud = require('wx-server-sdk')
const tmpl = require('./template')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function todayKey() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
}

function shiftDate(key, delta) {
  const d = new Date(`${key}T00:00:00+08:00`)
  d.setDate(d.getDate() + delta)
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
}

function nextOccurrence(dateKey, repeatYearly, fromKey) {
  if (!repeatYearly) return dateKey >= fromKey ? dateKey : null
  const mmdd = dateKey.slice(5)
  const year = Number(fromKey.slice(0, 4))
  let next = `${year}-${mmdd}`
  if (next < fromKey) next = `${year + 1}-${mmdd}`
  return next
}

function clip(text, n) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  return s.length <= n ? s : s.slice(0, n)
}

async function allDocs(collection) {
  const MAX = 100
  let skip = 0
  const out = []
  while (true) {
    const { data } = await db.collection(collection).skip(skip).limit(MAX).get()
    out.push(...data)
    if (data.length < MAX) break
    skip += MAX
    if (skip > 2000) break
  }
  return out
}

exports.main = async () => {
  if (!tmpl.templateId) {
    return { ok: false, message: '请在 template.js 填写订阅消息模板 ID' }
  }

  const today = todayKey()
  const tomorrow = shiftDate(today, 1)
  const anniversaries = await allDocs('anniversaries')
  const couples = {}
  const usersByOpenid = {}
  const sent = []

  for (const item of anniversaries) {
    const next = nextOccurrence(item.date, item.repeatYearly, today)
    if (next !== today && next !== tomorrow) continue
    const stamp = `${next}:${today}`
    if (item.lastRemindStamp === stamp) continue

    if (!couples[item.coupleId]) {
      const { data } = await db.collection('couples').doc(item.coupleId).get()
      couples[item.coupleId] = data
    }
    const couple = couples[item.coupleId]
    if (!couple) continue

    const tip = next === today ? '就是今天，记得好好过。' : '明天就是了，可以提前准备。'
    for (const openid of couple.memberOpenids) {
      if (!usersByOpenid[openid]) {
        const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
        usersByOpenid[openid] = data[0] || null
      }
      const user = usersByOpenid[openid]
      if (!user || !user.remindEnabled) continue

      try {
        await cloud.openapi.subscribeMessage.send({
          touser: openid,
          templateId: tmpl.templateId,
          page: 'pages/anniversary/index',
          data: {
            [tmpl.fieldTitle]: { value: clip(item.title, 20) || '纪念日' },
            [tmpl.fieldTime]: { value: next },
            [tmpl.fieldTip]: { value: clip(item.note || tip, 20) }
          }
        })
        sent.push({ openid, title: item.title, next })
      } catch (err) {
        console.error('send fail', openid, err)
        if (user._id && String(err.errCode) === '43101') {
          await db.collection('users').doc(user._id).update({
            data: { remindEnabled: false }
          })
          user.remindEnabled = false
        }
      }
    }

    await db.collection('anniversaries').doc(item._id).update({
      data: { lastRemindStamp: stamp }
    })
  }

  return { ok: true, today, sent: sent.length }
}
