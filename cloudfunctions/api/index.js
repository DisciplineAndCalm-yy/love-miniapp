const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MOODS = ['love', 'miss', 'calm', 'busy', 'sad']

const MOOD_LABELS = { love: '❤️ 甜蜜', miss: '💭 想念', calm: '🌿 平静', busy: '💼 忙碌', sad: '🌧️ 低落' }

function moodLabelOf(mood) {
  return MOOD_LABELS[mood] || '❤️ 甜蜜'
}

function todayKey() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
}

function shiftDate(key, delta) {
  const d = new Date(`${key}T00:00:00+08:00`)
  d.setDate(d.getDate() + delta)
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
}

function keyFromTs(ts) {
  const n = Number(ts)
  if (!n) return ''
  try {
    return new Date(n).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
  } catch (e) {
    return ''
  }
}

function normKey(item) {
  const k = item && item.dateKey
  if (typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k)) return k
  return keyFromTs(item && (item.createdAt || item.time || item.timestamp))
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

async function requireCouple(user, openid) {
  if (!user.coupleId) throw new Error('先去绑定两个人吧')
  const { data } = await db.collection('couples').doc(user.coupleId).get()
  if (!data || !data.memberOpenids.includes(openid)) {
    throw new Error('不在这个空间里')
  }
  if (data.status === 'dissolved') throw new Error('空间已解散，重新绑定可恢复')
  return data
}

async function fetchAllCheckins(where, fields) {
  const pageSize = 100
  let skip = 0
  const all = []
  for (let i = 0; i < 20; i += 1) {
    const query = db.collection('checkins').where(where)
    const { data } = await (fields
      ? query.field(fields).skip(skip).limit(pageSize).get()
      : query.skip(skip).limit(pageSize).get())
    all.push(...data)
    if (data.length < pageSize) break
    skip += pageSize
  }
  return all
}

async function dateKeys(coupleId, openid) {
  const data = await fetchAllCheckins(
    { coupleId, _openid: openid },
    { dateKey: true }
  )
  return data.map((item) => item.dateKey)
}

async function bothDateKeys(coupleId) {
  const data = await fetchAllCheckins(
    { coupleId },
    { dateKey: true, _openid: true }
  )
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

async function loadMembers(memberOpenids) {
  if (!memberOpenids || !memberOpenids.length) return []
  let data = []
  try {
    const r = await db.collection('users').where({
      _openid: _.in(memberOpenids)
    }).limit(20).get()
    data = r.data || []
  } catch (e) {
    console.warn('loadMembers failed', e)
    data = []
  }
  // 同一个 openid 可能有重复记录(并发登录等),合并并优先取有头像/昵称的那条
  const map = {}
  data.forEach((u) => {
    const cur = map[u._openid] || { openid: u._openid, nickName: '', avatarUrl: '', _id: '' }
    map[u._openid] = {
      openid: u._openid,
      _id: u._id || cur._id,
      nickName: (u.nickName && u.nickName !== '还没起名字' ? u.nickName : cur.nickName) || u.nickName || '还没起名字',
      avatarUrl: u.avatarUrl || cur.avatarUrl || ''
    }
  })
  const list = memberOpenids.map((id) => map[id] || {
    openid: id,
    _id: '',
    nickName: '还没起名字',
    avatarUrl: ''
  })
  // 头像是云存储 fileID 时,统一换成 https 临时链接,避免各端渲染空白
  try {
    const files = [...new Set(list.map((m) => m.avatarUrl).filter((f) => f && String(f).startsWith('cloud://')))]
    if (files.length) {
      const { fileList } = await cloud.getTempFileURL({ fileList: files })
      const urlMap = {}
      ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
      list.forEach((m) => { if (urlMap[m.avatarUrl]) m.avatarUrl = urlMap[m.avatarUrl] })
    }
  } catch (e) {
    console.warn('loadMembers getTempFileURL failed', e)
  }
  // 清掉本地临时路径(wxfile:// 等),它们换设备必然加载失败,让前端回落到首字占位
  list.forEach((m) => {
    const url = String(m.avatarUrl || '')
    if (url && !url.startsWith('http') && !url.startsWith('cloud://')) m.avatarUrl = ''
  })
  return list
}

async function removeFiles(fileList) {
  const ids = (fileList || []).filter(Boolean)
  if (!ids.length) return
  try {
    await cloud.deleteFile({ fileList: ids })
  } catch (err) {
    console.warn('deleteFile failed', err)
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
      const patch = { nickName }
      if (typeof event.avatarUrl === 'string') {
        patch.avatarUrl = event.avatarUrl.slice(0, 500)
      }
      await db.collection('users').doc(user._id).update({ data: patch })
      return { ok: true, nickName: patch.nickName, avatarUrl: patch.avatarUrl || user.avatarUrl || '' }
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

    if (action === 'getMembers') {
      const couple = await requireCouple(user, OPENID)
      const members = await loadMembers(couple.memberOpenids)
      return { ok: true, members, couple }
    }

    if (action === 'getCouple') {
      if (!user.coupleId) return { ok: true, couple: null, members: [] }
      try {
        const { data: couple } = await db.collection('couples').doc(user.coupleId).get()
        if (!couple || !couple.memberOpenids.includes(OPENID) || couple.status === 'dissolved') {
          try { await db.collection('users').doc(user._id).update({ data: { coupleId: '' } }) } catch (e) {}
          return { ok: true, couple: null, members: [], staleCleared: true }
        }
        const members = await loadMembers(couple.memberOpenids)
        return { ok: true, couple, members }
      } catch (err) {
        return { ok: true, couple: null, members: [] }
      }
    }

    if (action === 'getStreaks') {
      const couple = await requireCouple(user, OPENID)
      return { ok: true, streaks: await streaksFor(user, couple) }
    }

    if (action === 'unbind') {
      if (!user.coupleId) return fail('还没有绑定')
      const cid = user.coupleId
      let couple = null
      try { couple = (await db.collection('couples').doc(cid).get()).data } catch (e) {}
      await db.collection('users').doc(user._id).update({ data: { coupleId: '' } })
      if (!couple || !couple.memberOpenids.includes(OPENID)) return { ok: true, dissolved: true }
      const remain = couple.memberOpenids.filter((id) => id !== OPENID)
      const prevMembers = Array.from(new Set([...(couple.prevMembers || []), ...couple.memberOpenids]))
      // 只要曾经配对成功过，一方退出即整间解散，双方都回到未绑定，数据保留在原coupleId下
      if (couple.everPaired || couple.status === 'paired' || remain.length === 0) {
        await db.collection('couples').doc(couple._id).update({
          data: { memberOpenids: [], status: 'dissolved', prevMembers, dissolvedAt: Date.now() }
        })
        // 把对方也踢成未绑定，前端下次getCouple自动清
        for (const oid of remain) {
          try {
            const { data: ulist } = await db.collection('users').where({ _openid: oid }).limit(1).get()
            if (ulist[0]) await db.collection('users').doc(ulist[0]._id).update({ data: { coupleId: '' } })
          } catch (e) {}
        }
        return { ok: true, dissolved: true }
      }
      // 从未配对成功（单方等待期），对方退出=创建者自己走，保留等待位不变
      await db.collection('couples').doc(couple._id).update({
        data: { memberOpenids: remain, status: 'pending', prevMembers }
      })
      return { ok: true, dissolved: false }
    }

    if (action === 'saveCheckin') {
      const couple = await requireCouple(user, OPENID)
      const mood = MOODS.includes(event.mood) ? event.mood : 'love'
      const content = String(event.content || '').trim().slice(0, 120)
      const photo = String(event.photo || '')
      const dateKey = todayKey()
      const { data: exists } = await db.collection('checkins').where({
        coupleId: couple._id,
        _openid: OPENID,
        dateKey
      }).limit(1).get()

      // 每天只能签到一次，不支持修改
      if (exists[0]) return fail('今天已经签到啦，明天再来 ♡')

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
      return { ok: true, streaks: await streaksFor(user, couple) }
    }

    if (action === 'listMonthCheckins') {
      const couple = await requireCouple(user, OPENID)
      const start = String(event.start || '')
      const end = String(event.end || '')
      const prefix = start.slice(0, 7)
      // 只按 coupleId 拉取，月份在内存里过滤，避免组合查询漏数据
      const all = await fetchAllCheckins({ coupleId: couple._id })
      const raw = all.filter((item) => {
        const k = normKey(item)
        if (!k) return false
        if (start && end) return k >= start && k <= end
        return k.slice(0, 7) === prefix
      })
      // 同一人同一天若有多条(历史脏数据),优先保留有图/有文字的
      const byDay = {}
      raw.forEach((item) => {
        const k = normKey(item)
        const key = `${item._openid}|${k}`
        const weight = ((item.photo || item.image || item.img || item.photoFileID || (Array.isArray(item.photos) && item.photos[0])) ? 4 : 0) +
          ((item.content) ? 2 : 0) +
          (item.createdAt || 0) / 1e15
        if (!byDay[key] || byDay[key]._w < weight) byDay[key] = { ...item, _w: weight }
      })
      const data = Object.values(byDay)
      data.sort((a, b) => {
        const ka = normKey(a); const kb = normKey(b)
        return ka < kb ? 1 : ka > kb ? -1 : (b.createdAt || 0) - (a.createdAt || 0)
      })
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = data.map((item) => {
        const m = map[item._openid] || {}
        const photos = Array.isArray(item.photos) ? item.photos : []
        return {
          _id: item._id,
          _openid: item._openid,
          isMine: item._openid === OPENID,
          dateKey: normKey(item),
          mood: item.mood,
          moodLabel: moodLabelOf(item.mood),
          content: item.content || '',
          photo: item.photo || item.image || item.img || item.photoFileID || photos[0] || '',
          createdAt: item.createdAt || 0,
          authorName: m.nickName || 'TA',
          authorAvatar: m.avatarUrl || ''
        }
      })
      list.forEach((d) => { d.initial = (d.authorName || 'TA').charAt(0) || '♡' })
      // fileID 在部分机型直接渲染空白,批量换 https 临时链接下发
      try {
        const files = [...new Set(list.flatMap((d) => [d.photo, d.authorAvatar]).filter((f) => f && f.startsWith('cloud://')))]
        if (files.length) {
          const { fileList } = await cloud.getTempFileURL({ fileList: files })
          const urlMap = {}
          ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
          list.forEach((d) => {
            if (urlMap[d.photo]) d.photoUrl = urlMap[d.photo]
            if (urlMap[d.authorAvatar]) d.authorAvatarUrl = urlMap[d.authorAvatar]
          })
        }
      } catch (e) { console.warn('monthCheckins getTempFileURL failed', e) }
      return { ok: true, list, members }
    }

    if (action === 'savePost') {
      const couple = await requireCouple(user, OPENID)
      const title = String(event.title || '').trim().slice(0, 40)
      const content = String(event.content || '').trim().slice(0, 5000)
      const photos = Array.isArray(event.photos) ? event.photos.slice(0, 9) : []
      if (!title || !content) return fail('标题和正文都要写')
      if (event.id) {
        const { data: post } = await db.collection('posts').doc(event.id).get()
        if (!post || post._openid !== OPENID) return fail('只能改自己的文章')
        const removed = (post.photos || []).filter((id) => !photos.includes(id))
        await db.collection('posts').doc(event.id).update({
          data: { title, content, photos, updatedAt: Date.now() }
        })
        await removeFiles(removed)
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
      await removeFiles(post.photos || [])
      return { ok: true }
    }

    if (action === 'saveAnniversary') {
      const couple = await requireCouple(user, OPENID)
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
      const couple = await requireCouple(user, OPENID)
      const { data: doc } = await db.collection('anniversaries').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这个纪念日')
      await db.collection('anniversaries').doc(event.id).remove()
      return { ok: true }
    }

    if (action === 'listMoments') {
      const couple = await requireCouple(user, OPENID)
      const limit = Math.min(30, Math.max(5, Number(event.limit) || 20))
      const q = { coupleId: couple._id }
      if (event.before) q.createdAt = _.lt(Number(event.before))
      if (event.doing) q.doing = String(event.doing)
      const { data } = await db.collection('moments').where(q).orderBy('createdAt', 'desc').limit(limit).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      return { ok: true, list: data.map((d) => ({ ...d, author: map[d._openid] || null })), hasMore: data.length >= limit }
    }

    if (action === 'saveMoment') {
      const couple = await requireCouple(user, OPENID)
      const doing = String(event.doing || '日常').slice(0, 8)
      const content = String(event.content || '').trim().slice(0, 500)
      const photos = Array.isArray(event.photos) ? event.photos.slice(0, 6) : []
      if (!content && !photos.length) return fail('写点什么或传张图吧')
      if (event.id) {
        const { data: doc } = await db.collection('moments').doc(event.id).get()
        if (!doc || doc.coupleId !== couple._id || doc._openid !== OPENID) return fail('只能改自己的动态')
        const removed = (doc.photos || []).filter((id) => !photos.includes(id))
        await db.collection('moments').doc(event.id).update({ data: { doing, content, photos, updatedAt: Date.now() } })
        await removeFiles(removed)
        return { ok: true, id: event.id }
      }
      const add = await db.collection('moments').add({ data: { _openid: OPENID, coupleId: couple._id, doing, content, photos, createdAt: Date.now(), updatedAt: Date.now() } })
      return { ok: true, id: add._id }
    }

    if (action === 'getMoment') {
      const couple = await requireCouple(user, OPENID)
      const { data: doc } = await db.collection('moments').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这条动态')
      const members = await loadMembers([doc._openid])
      return { ok: true, detail: { ...doc, author: members[0] || null } }
    }

    if (action === 'removeMoment') {
      const { data: doc } = await db.collection('moments').doc(event.id).get()
      if (!doc || doc._openid !== OPENID) return fail('只能删自己的动态')
      await db.collection('moments').doc(event.id).remove()
      await removeFiles(doc.photos || [])
      return { ok: true }
    }

    if (action === 'getPet') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
      const pet = data[0] || null
      if (!pet) return { ok: true, pet: null }
      const hours = Math.max(0, (Date.now() - (pet.updatedAt || Date.now())) / 3600000)
      const decay = Math.min(30, Math.floor(hours * 2))
      if (decay > 0 && ((pet.hunger || 0) > 0 || (pet.mood || 0) > 0)) {
        const patch = { hunger: Math.max(0, (pet.hunger || 0) - decay), mood: Math.max(0, (pet.mood || 0) - decay), updatedAt: Date.now() }
        await db.collection('pets').doc(pet._id).update({ data: patch })
        return { ok: true, pet: { ...pet, ...patch } }
      }
      return { ok: true, pet }
    }

    if (action === 'adoptPet') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
      if (data[0]) return fail('已经领养过啦')
      const species = ['cat', 'dog', 'bunny', 'fox', 'panda'].includes(event.species) ? event.species : 'cat'
      const name = String(event.name || '').trim().slice(0, 10) || '团子'
      const add = await db.collection('pets').add({
        data: { _openid: OPENID, coupleId: couple._id, species, name, hunger: 80, mood: 80, clean: 80, energy: 80, exp: 0, level: 1, state: 'idle', updatedAt: Date.now(), createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'feedPet' || action === 'playPet' || action === 'interactPet') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
      const pet = data[0]
      if (!pet) return fail('先领养一只宠物吧')
      const kind = action === 'interactPet' ? String(event.kind || 'pat') : (action === 'feedPet' ? 'feed' : 'play')
      const patch = { hunger: pet.hunger || 0, mood: pet.mood || 0, clean: pet.clean != null ? pet.clean : 80, energy: pet.energy != null ? pet.energy : 80, exp: pet.exp || 0 }
      let state = 'happy', msg = '好开心!'
      if (kind === 'feed') { patch.hunger = Math.min(100, patch.hunger + 18); patch.mood = Math.min(100, patch.mood + 5); patch.exp += 6; state = 'eat'; msg = '吃得好饱!' }
      else if (kind === 'play') { patch.mood = Math.min(100, patch.mood + 18); patch.energy = Math.max(0, patch.energy - 8); patch.exp += 6; state = 'play'; msg = '玩得好开心!' }
      else if (kind === 'pat') { patch.mood = Math.min(100, patch.mood + 10); patch.exp += 3; state = 'love'; msg = '被摸摸了 ♡' }
      else if (kind === 'bathe') { patch.clean = 100; patch.mood = Math.min(100, patch.mood + 6); patch.exp += 4; state = 'bath'; msg = '洗香香啦!' }
      else if (kind === 'sleep') { patch.energy = 100; patch.hunger = Math.max(0, patch.hunger - 5); patch.exp += 2; state = 'sleep'; msg = '睡了个好觉 Zzz' }
      else if (kind === 'dance') { patch.mood = Math.min(100, patch.mood + 8); patch.energy = Math.max(0, patch.energy - 5); patch.exp += 4; state = 'dance'; msg = '扭起来!' }
      patch.level = Math.min(99, 1 + Math.floor(patch.exp / 100))
      patch.state = state
      patch.updatedAt = Date.now()
      await db.collection('pets').doc(pet._id).update({ data: patch })
      return { ok: true, pet: { ...pet, ...patch }, msg, state }
    }

    if (action === 'renamePet') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
      const pet = data[0]
      if (!pet) return fail('先领养一只宠物吧')
      const name = String(event.name || '').trim().slice(0, 10)
      if (!name) return fail('起个名字吧')
      await db.collection('pets').doc(pet._id).update({ data: { name, updatedAt: Date.now() } })
      return { ok: true, name }
    }

    if (action === 'sendChat') {
      const couple = await requireCouple(user, OPENID)
      const kind = event.kind === 'image' ? 'image' : 'text'
      const content = String(event.content || '').trim().slice(0, kind === 'image' ? 500 : 500)
      if (!content) return fail('说点什么吧')
      const add = await db.collection('chats').add({
        data: { _openid: OPENID, coupleId: couple._id, kind, content, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listChats') {
      const couple = await requireCouple(user, OPENID)
      const limit = Math.min(50, Math.max(10, Number(event.limit) || 30))
      const q = { coupleId: couple._id }
      if (event.before) q.createdAt = _.lt(Number(event.before))
      const { data } = await db.collection('chats').where(q).orderBy('createdAt', 'desc').limit(limit).get()
      const asc = data.reverse()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = asc.map((d) => ({ ...d, isMine: d._openid === OPENID, authorName: (map[d._openid] || {}).nickName || 'TA', authorAvatar: (map[d._openid] || {}).avatarUrl || '' }))
      // 图片消息换临时可访问链接,避免对方因存储权限看不到图
      const files = list.filter((d) => d.kind === 'image' && d.content && d.content.startsWith('cloud://')).map((d) => d.content)
      if (files.length) {
        try {
          const { fileList } = await cloud.getTempFileURL({ fileList: [...new Set(files)] })
          const urlMap = {}
          ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
          list.forEach((d) => { if (d.kind === 'image' && urlMap[d.content]) d.url = urlMap[d.content] })
        } catch (e) { console.warn('getTempFileURL failed', e) }
      }
      const reads = await db.collection('chatReads').where({ coupleId: couple._id }).get()
      let partnerReadAt = 0
      reads.data.forEach((r) => { if (r._openid !== OPENID) partnerReadAt = Math.max(partnerReadAt, r.lastReadAt || 0) })
      return { ok: true, list, partnerReadAt }
    }

    if (action === 'recallChat') {
      const { data: doc } = await db.collection('chats').doc(event.id).get()
      if (!doc || doc._openid !== OPENID) return fail('只能撤回自己的消息')
      if (Date.now() - (doc.createdAt || 0) > 2 * 60 * 1000) return fail('超过2分钟不能撤回啦')
      await db.collection('chats').doc(event.id).remove()
      if (doc.kind === 'image') await removeFiles([doc.content])
      return { ok: true }
    }

    if (action === 'todayCheckins') {
      const couple = await requireCouple(user, OPENID)
      const dateKey = String(event.dateKey || todayKey()).slice(0, 10)
      const { data } = await db.collection('checkins').where({ coupleId: couple._id, dateKey }).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = data.map((item) => {
        const m = map[item._openid] || {}
        return {
          _id: item._id,
          _openid: item._openid,
          isMine: item._openid === OPENID,
          dateKey: item.dateKey,
          mood: item.mood,
          moodLabel: moodLabelOf(item.mood),
          content: item.content || '',
          photo: item.photo || '',
          createdAt: item.createdAt || 0,
          authorName: m.nickName || 'TA',
          authorAvatar: m.avatarUrl || ''
        }
      })
      // 同日历页:fileID 批量换 https 临时链接,保证双方都能看见
      try {
        const files = [...new Set(list.flatMap((d) => [d.photo, d.authorAvatar]).filter((f) => f && String(f).startsWith('cloud://')))]
        if (files.length) {
          const { fileList } = await cloud.getTempFileURL({ fileList: files })
          const urlMap = {}
          ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
          list.forEach((d) => {
            if (urlMap[d.photo]) d.photoUrl = urlMap[d.photo]
            if (urlMap[d.authorAvatar]) d.authorAvatarUrl = urlMap[d.authorAvatar]
            d.initial = Array.from(d.authorName || 'TA')[0] || '♡'
          })
        } else {
          list.forEach((d) => { d.initial = Array.from(d.authorName || 'TA')[0] || '♡' })
        }
      } catch (e) { console.warn('todayCheckins getTempFileURL failed', e) }
      return { ok: true, list }
    }

    if (action === 'chatUnread') {
      const couple = await requireCouple(user, OPENID)
      const mine = await db.collection('chatReads').where({ coupleId: couple._id, _openid: OPENID }).get()
      const since = mine.data.length ? (mine.data[0].lastReadAt || 0) : (Number(event.since) || 0)
      const { total } = await db.collection('chats').where({
        coupleId: couple._id,
        createdAt: _.gt(since),
        _openid: _.neq(OPENID)
      }).count()
      return { ok: true, count: total || 0 }
    }

    if (action === 'markChatRead') {
      const couple = await requireCouple(user, OPENID)
      const now = Date.now()
      const found = await db.collection('chatReads').where({ coupleId: couple._id, _openid: OPENID }).get()
      if (found.data.length) {
        await db.collection('chatReads').doc(found.data[0]._id).update({ data: { lastReadAt: now } })
      } else {
        await db.collection('chatReads').add({ data: { coupleId: couple._id, _openid: OPENID, lastReadAt: now, createdAt: now } })
      }
      const partner = await db.collection('chatReads').where({ coupleId: couple._id, _openid: _.neq(OPENID) }).get()
      return { ok: true, at: now, partnerReadAt: partner.data.length ? (partner.data[0].lastReadAt || 0) : 0 }
    }

    if (action === 'addDraw') {
      const couple = await requireCouple(user, OPENID)
      const mission = String(event.mission || '').trim().slice(0, 100)
      const icon = String(event.icon || '🎁').slice(0, 8)
      if (!mission) return fail('任务是空的')
      const add = await db.collection('draws').add({
        data: { _openid: OPENID, coupleId: couple._id, mission, icon, done: false, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listDraws') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('draws').where({ coupleId: couple._id }).orderBy('createdAt', 'desc').limit(30).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const doneCount = data.filter((d) => d.done).length
      return { ok: true, list: data.map((d) => ({ ...d, isMine: d._openid === OPENID, byName: (map[d._openid] || {}).nickName || 'TA' })), doneCount, total: data.length }
    }

    if (action === 'doneDraw') {
      const couple = await requireCouple(user, OPENID)
      const { data: doc } = await db.collection('draws').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这颗扭蛋')
      await db.collection('draws').doc(event.id).update({ data: { done: true, doneAt: Date.now() } })
      return { ok: true }
    }

    if (action === 'answerQuiz') {
      const couple = await requireCouple(user, OPENID)
      const round = String(event.round || '').slice(0, 20) || 'love8'
      const qid = Number(event.qid)
      const choice = Number(event.choice)
      if (!(qid >= 0) || !(choice >= 0)) return fail('答案无效')
      const found = await db.collection('quiz').where({ coupleId: couple._id, round }).get()
      let doc = found.data[0]
      if (!doc) {
        const add = await db.collection('quiz').add({
          data: { coupleId: couple._id, round, answers: { [OPENID]: { [qid]: choice } }, createdAt: Date.now(), updatedAt: Date.now() }
        })
        doc = { _id: add._id, answers: { [OPENID]: { [qid]: choice } } }
      } else {
        const answers = doc.answers || {}
        answers[OPENID] = { ...(answers[OPENID] || {}), [qid]: choice }
        await db.collection('quiz').doc(doc._id).update({ data: { answers, updatedAt: Date.now() } })
        doc.answers = answers
      }
      return { ok: true, mine: doc.answers[OPENID] || {} }
    }

    if (action === 'quizState') {
      const couple = await requireCouple(user, OPENID)
      const round = String(event.round || '').slice(0, 20) || 'love8'
      const found = await db.collection('quiz').where({ coupleId: couple._id, round }).get()
      if (!found.data.length) return { ok: true, empty: true, mine: {}, partnerCount: 0 }
      const doc = found.data[0]
      const answers = doc.answers || {}
      const keys = Object.keys(answers)
      const partnerKey = keys.find((k) => k !== OPENID)
      return {
        ok: true,
        mine: answers[OPENID] || {},
        partnerCount: partnerKey ? Object.keys(answers[partnerKey] || {}).length : 0,
        both: keys.length >= 2 ? answers : null
      }
    }

    if (action === 'resetQuiz') {
      const couple = await requireCouple(user, OPENID)
      const round = String(event.round || '').slice(0, 20) || 'love8'
      const found = await db.collection('quiz').where({ coupleId: couple._id, round }).get()
      for (const d of found.data) await db.collection('quiz').doc(d._id).remove()
      return { ok: true }
    }

    if (action === 'rollDice') {
      const couple = await requireCouple(user, OPENID)
      const options = (Array.isArray(event.options) ? event.options : []).map((o) => String(o).trim().slice(0, 30)).filter(Boolean).slice(0, 8)
      const text = String(event.text || '').trim().slice(0, 60)
      const face = Math.min(6, Math.max(1, Number(event.face) || 1))
      const add = await db.collection('dices').add({
        data: { _openid: OPENID, coupleId: couple._id, face, text, options, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listDice') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('dices').where({ coupleId: couple._id }).orderBy('createdAt', 'desc').limit(20).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      return { ok: true, list: data.map((d) => ({ ...d, isMine: d._openid === OPENID, byName: (map[d._openid] || {}).nickName || 'TA' })) }
    }

    if (action === 'drawCard') {
      const couple = await requireCouple(user, OPENID)
      const kind = event.kind === 'dare' ? 'dare' : 'truth'
      const text = String(event.text || '').trim().slice(0, 120)
      if (!text) return fail('卡片是空的')
      const add = await db.collection('cards').add({
        data: { _openid: OPENID, coupleId: couple._id, kind, text, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listCards') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('cards').where({ coupleId: couple._id }).orderBy('createdAt', 'desc').limit(30).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      return { ok: true, list: data.map((d) => ({ ...d, isMine: d._openid === OPENID, byName: (map[d._openid] || {}).nickName || 'TA' })) }
    }

    if (action === 'sendGoodnight') {
      const couple = await requireCouple(user, OPENID)
      const today = todayKey()
      const found = await db.collection('nights').where({ coupleId: couple._id, dateKey: today }).get()
      const mine = found.data.find((d) => d._openid === OPENID)
      if (mine) return fail('今晚已经说过晚安啦')
      const word = String(event.word || '').trim().slice(0, 60)
      await db.collection('nights').add({
        data: { _openid: OPENID, coupleId: couple._id, dateKey: today, word, createdAt: Date.now() }
      })
      return { ok: true }
    }

    if (action === 'listGoodnights') {
      const couple = await requireCouple(user, OPENID)
      const today = todayKey()
      const found = await db.collection('nights').where({ coupleId: couple._id, dateKey: today }).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = found.data.map((d) => ({ ...d, isMine: d._openid === OPENID, byName: (map[d._openid] || {}).nickName || 'TA' }))
      // 连续同频晚安天数
      let streak = 0
      const all = await db.collection('nights').where({ coupleId: couple._id }).orderBy('dateKey', 'desc').limit(60).get()
      const byDay = {}
      all.data.forEach((d) => {
        byDay[d.dateKey] = byDay[d.dateKey] || new Set()
        byDay[d.dateKey].add(d._openid)
      })
      let cursor = today
      for (let i = 0; i < 60; i += 1) {
        if (byDay[cursor] && byDay[cursor].size >= 2) {
          streak += 1
          cursor = shiftDate(cursor, -1)
        } else {
          break
        }
      }
      return { ok: true, list, mineDone: list.some((d) => d.isMine), partnerDone: list.some((d) => !d.isMine), streak }
    }

    return fail('未知操作')
  } catch (err) {
    return fail(err.message || '失败了')
  }
}
