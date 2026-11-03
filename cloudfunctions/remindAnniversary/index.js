const cloud = require('wx-server-sdk')
const tmpl = require('./template')
const lunar = require('./lunar')

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

      const baseData = (lunarVal) => ({
        [tmpl.fieldTitle]: { value: clip(item.title, 20) || '纪念日' },
        [tmpl.fieldTime]: { value: next },
        [tmpl.fieldTip]: { value: clip(item.note || tip, 20) },
        [tmpl.fieldNear]: { value: next === today ? '就是今天' : '明天' },
        [tmpl.fieldLunar]: { value: lunarVal }
      })
      try {
        try {
          await cloud.openapi.subscribeMessage.send({ touser: openid, templateId: tmpl.templateId, page: 'pages/anniversary/index', miniprogramState: 'trial', lang: 'zh_CN', data: baseData(lunar.toLunarText(next) || next) })
        } catch (le) {
          if (String(le.errCode) === '43101') throw le
          // 农历中文可能不被 time 字段接受，回退为日期再发一次
          await cloud.openapi.subscribeMessage.send({ touser: openid, templateId: tmpl.templateId, page: 'pages/anniversary/index', miniprogramState: 'trial', lang: 'zh_CN', data: baseData(next) })
        }
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

  // ===== 到期提醒：时间胶囊可拆 + 待办到期（enableDueReminders 开启时才发）=====
  let reminderSent = 0
  if (tmpl.enableDueReminders) {
    const sendReminder = async (coupleId, payload, page) => {
      if (!(coupleId in couples)) {
        try { couples[coupleId] = (await db.collection('couples').doc(coupleId).get()).data } catch (e) { couples[coupleId] = null }
      }
      const couple = couples[coupleId]
      if (!couple || !couple.memberOpenids) return
      for (const openid of couple.memberOpenids) {
        if (!(openid in usersByOpenid)) {
          try {
            const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
            usersByOpenid[openid] = data[0] || null
          } catch (e) { usersByOpenid[openid] = null }
        }
        const user = usersByOpenid[openid]
        if (!user || !user.remindEnabled) continue
        try {
          await cloud.openapi.subscribeMessage.send({
            touser: openid,
            templateId: tmpl.templateId,
            page,
            data: {
              [tmpl.fieldTitle]: { value: clip(payload.title, 20) },
              [tmpl.fieldTime]: { value: today },
              [tmpl.fieldTip]: { value: clip(payload.tip, 20) },
              [tmpl.fieldNear]: { value: clip(payload.near || '今天', 20) },
              [tmpl.fieldLunar]: { value: today }
            }
          })
          reminderSent += 1
        } catch (err) {
          console.error('reminder send fail', openid, err)
          if (user._id && String(err.errCode) === '43101') {
            await db.collection('users').doc(user._id).update({ data: { remindEnabled: false } })
            user.remindEnabled = false
          }
        }
      }
    }

    let capsules = []
    try { capsules = await allDocs('capsules') } catch (e) { capsules = [] }
    for (const c of capsules) {
      if (!c.unlockDate || c.unlockDate > today) continue
      if (c.lastRemindStamp) continue
      await sendReminder(c.coupleId, { title: '时间胶囊可以拆啦', tip: '有一封信等你打开，快去看看吧 ♡', near: '今天可拆' }, 'pages/capsule/index')
      await db.collection('capsules').doc(c._id).update({ data: { lastRemindStamp: today } })
    }

    let todos = []
    try { todos = await allDocs('todos') } catch (e) { todos = [] }
    for (const t of todos) {
      if (t.done) continue
      if (!t.due || t.due > today) continue
      if (t.lastRemindStamp) continue
      await sendReminder(t.coupleId, { title: t.text || '待办提醒', tip: '今天到期，记得完成哦', near: '今天到期' }, 'pages/life/index')
      await db.collection('todos').doc(t._id).update({ data: { lastRemindStamp: today } })
    }
  }

  return { ok: true, today, sent: sent.length, reminderSent }
}
