const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MOODS = ['love', 'miss', 'calm', 'busy', 'sad']

function todayKey() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
}

function shiftDate(key, delta) {
  const d = new Date(`${key}T00:00:00+08:00`)
  d.setDate(d.getDate() + delta)
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
}

function calcStreak(keys, today) {
  const set = new Set(keys)
  let cursor = today
  if (!set.has(cursor)) {
    cursor = shiftDate(today, -1)
    if (!set.has(cursor)) return 0
  }
  let n = 0
  while (set.has(cursor)) {
    n += 1
    cursor = shiftDate(cursor, -1)
  }
  return n
}

async function getUser(openid) {
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return data[0] || null
}

async function requireUser(openid) {
  const user = await getUser(openid)
  if (!user) throw new Error('请先打开小程序完成登录')
  return user
}

async function requireCouple(user) {
  if (!user.coupleId) throw new Error('先去绑定两个人吧')
  const { data } = await db.collection('couples').doc(user.coupleId).get()
  if (!data || !data.memberOpenids.includes(user._openid || '')) {
    throw new Error('不在这个空间里')
  }
  return data
}

async function dateKeys(coupleId, openid) {
  const { data } = await db.collection('checkins')
    .where({ coupleId, _openid: openid })
    .field({ dateKey: true })
    .limit(100)
    .get()
  return data.map((item) => item.dateKey)
}

async function bothDateKeys(coupleId) {
  const { data } = await db.collection('checkins')
    .where({ coupleId })
    .field({ dateKey: true, _openid: true })
    .limit(200)
    .get()
  const byDay = {}
  data.forEach((item) => {
    byDay[item.dateKey] = byDay[item.dateKey] || new Set()
    byDay[item.dateKey].add(item._openid)
  })
  return Object.keys(byDay).filter((key) => byDay[key].size >= 2)
}

async function streaksFor(user, couple) {
  const today = todayKey()
  const mineKeys = await dateKeys(couple._id, user._openid)
  const partnerId = couple.memberOpenids.find((id) => id !== user._openid)
  const partnerKeys = partnerId ? await dateKeys(couple._id, partnerId) : []
  const togetherKeys = await bothDateKeys(couple._id)
  return {
    mine: calcStreak(mineKeys, today),
    partner: calcStreak(partnerKeys, today),
    together: calcStreak(togetherKeys, today)
  }
}

function fail(message) {
  return { ok: false, message }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  try {
    const user = await requireUser(OPENID)
    user._openid = OPENID

    if (action === 'saveProfile') {
      const nickName = String(event.nickName || '').trim() || '还没起名字'
      await db.collection('users').doc(user._id).update({ data: { nickName } })
      return { ok: true, nickName }
    }

    if (action === 'enableRemind') {
      await db.collection('users').doc(user._id).update({
        data: {
          remindEnabled: !!event.enabled,
          remindUpdatedAt: Date.now()
        }
      })
      return { ok: true, remindEnabled: !!event.enabled }
    }

    if (action === 'getStreaks') {
      const couple = await requireCouple(user)
      return { ok: true, streaks: await streaksFor(user, couple) }
    }

    if (action === 'saveCheckin') {
      const couple = await requireCouple(user)
      const mood = MOODS.includes(event.mood) ? event.mood : 'love'
      const content = String(event.content || '').trim().slice(0, 120)
      const photo = String(event.photo || '')
      const dateKey = todayKey()
      const { data: exists } = await db.collection('checkins').where({
        coupleId: couple._id,
        _openid: OPENID,
        dateKey
      }).limit(1).get()

      if (exists[0]) {
        await db.collection('checkins').doc(exists[0]._id).update({
          data: { mood, content, photo, updatedAt: Date.now() }
        })
      } else {
        await db.collection('checkins').add({
          data: {
            _openid: OPENID,
            coupleId: couple._id,
            dateKey,
            mood,
            content,
            photo,
            createdAt: Date.now()
          }
        })
      }
      return { ok: true, streaks: await streaksFor(user, couple) }
    }

    if (action === 'savePost') {
      const couple = await requireCouple(user)
      const title = String(event.title || '').trim().slice(0, 40)
      const content = String(event.content || '').trim().slice(0, 5000)
      const photos = Array.isArray(event.photos) ? event.photos.slice(0, 9) : []
      if (!title || !content) return fail('标题和正文都要写')
      if (event.id) {
        const { data: post } = await db.collection('posts').doc(event.id).get()
        if (!post || post._openid !== OPENID) return fail('只能改自己的文章')
        await db.collection('posts').doc(event.id).update({
          data: { title, content, photos, updatedAt: Date.now() }
        })
        return { ok: true, id: event.id }
      }
      const add = await db.collection('posts').add({
        data: {
          _openid: OPENID,
          coupleId: couple._id,
          title,
          content,
          photos,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'removePost') {
      const { data: post } = await db.collection('posts').doc(event.id).get()
      if (!post || post._openid !== OPENID) return fail('只能删自己的文章')
      await db.collection('posts').doc(event.id).remove()
      return { ok: true }
    }

    if (action === 'saveAnniversary') {
      const couple = await requireCouple(user)
      const title = String(event.title || '').trim().slice(0, 20)
      const date = String(event.date || '')
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('标题和日期必填')
      const payload = {
        title,
        date,
        repeatYearly: !!event.repeatYearly,
        emoji: String(event.emoji || '♡').slice(0, 4),
        color: String(event.color || '#E86A7A').slice(0, 16),
        note: String(event.note || '').trim().slice(0, 200)
      }
      if (event.id) {
        const { data: doc } = await db.collection('anniversaries').doc(event.id).get()
        if (!doc || doc.coupleId !== couple._id) return fail('找不到这个纪念日')
        await db.collection('anniversaries').doc(event.id).update({ data: payload })
        return { ok: true, id: event.id }
      }
      const add = await db.collection('anniversaries').add({
        data: {
          _openid: OPENID,
          coupleId: couple._id,
          ...payload,
          createdAt: Date.now()
        }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'removeAnniversary') {
      const couple = await requireCouple(user)
      const { data: doc } = await db.collection('anniversaries').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这个纪念日')
      await db.collection('anniversaries').doc(event.id).remove()
      return { ok: true }
    }

    return fail('未知操作')
  } catch (err) {
    return fail(err.message || '失败了')
  }
}
