const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

async function uniqueInviteCode() {
  for (let i = 0; i < 8; i += 1) {
    const inviteCode = randomCode()
    const r = await db.collection('couples').where({ inviteCode }).limit(1).get()
    if (!r.data || !r.data.length) return inviteCode
  }
  throw new Error('邀请码生成失败，请重试')
}

async function getUser(openid) {
  const r = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return (r.data && r.data[0]) || null
}

async function getValidCoupleId(user, OPENID) {
  if (!user.coupleId) return null
  try {
    const r = await db.collection('couples').doc(user.coupleId).get()
    const c = r.data
    if (c && c.status !== 'dissolved' && Array.isArray(c.memberOpenids) && c.memberOpenids.includes(OPENID)) {
      return c._id || user.coupleId
    }
  } catch (e) {}
  try { await db.collection('users').doc(user._id).update({ data: { coupleId: '' } }) } catch (e) {}
  user.coupleId = ''
  return null
}

exports.main = async (event) => {
  try {
    const ctx = cloud.getWXContext() || {}
    const OPENID = ctx.OPENID
    if (!OPENID) return { ok: false, message: '获取身份失败，请重试' }
    const action = event.action
    const user = await getUser(OPENID)
    if (!user) return { ok: false, message: '请先打开小程序完成登录' }

    if (action === 'create') {
      const valid = await getValidCoupleId(user, OPENID)
      if (valid) return { ok: false, message: '已经绑定过了' }
      const inviteCode = await uniqueInviteCode()
      const add = await db.collection('couples').add({
        data: {
          inviteCode,
          memberOpenids: [OPENID],
          prevMembers: [OPENID],
          everPaired: false,
          togetherSince: (event && event.togetherSince) || '',
          status: 'pending',
          createdAt: Date.now()
        }
      })
      await db.collection('users').doc(user._id).update({ data: { coupleId: add._id } })
      return { ok: true, coupleId: add._id, inviteCode }
    }

    if (action === 'join') {
      const code = String((event && event.code) || '').trim().toUpperCase()
      if (!code) return { ok: false, message: '请输入邀请码' }
      const valid = await getValidCoupleId(user, OPENID)
      if (valid) return { ok: false, message: '已经绑定过了' }
      const r = await db.collection('couples').where({ inviteCode: code }).limit(1).get()
      const couple = r.data && r.data[0]
      if (!couple) return { ok: false, message: '邀请码不存在' }
      if (couple.status === 'dissolved') {
        const prev = couple.prevMembers || []
        if (prev.indexOf(OPENID) < 0) return { ok: false, message: '该邀请码已失效，请用新码' }
        const members = couple.memberOpenids || []
        if (members.indexOf(OPENID) < 0) members.push(OPENID)
        await db.collection('couples').doc(couple._id).update({
          data: { memberOpenids: members, status: members.length >= 2 ? 'paired' : 'pending', everPaired: true, restoredAt: Date.now() }
        })
        await db.collection('users').doc(user._id).update({ data: { coupleId: couple._id } })
        return { ok: true, coupleId: couple._id, restored: true }
      }
      const members = couple.memberOpenids || []
      if (members.indexOf(OPENID) >= 0) {
        await db.collection('users').doc(user._id).update({ data: { coupleId: couple._id } })
        return { ok: true, coupleId: couple._id }
      }
      if (members.length >= 2) return { ok: false, message: '这个空间已经满员了' }
      members.push(OPENID)
      const prev = couple.prevMembers || []
      if (prev.indexOf(OPENID) < 0) prev.push(OPENID)
      await db.collection('couples').doc(couple._id).update({
        data: {
          memberOpenids: members,
          prevMembers: prev,
          everPaired: true,
          status: 'paired',
          togetherSince: couple.togetherSince || ((event && event.togetherSince) || '')
        }
      })
      await db.collection('users').doc(user._id).update({ data: { coupleId: couple._id } })
      return { ok: true, coupleId: couple._id }
    }

    if (action === 'updateTogether') {
      if (!user.coupleId) return { ok: false, message: '还没有绑定' }
      const togetherSince = String((event && event.togetherSince) || '')
      if (togetherSince && !/^\d{4}-\d{2}-\d{2}$/.test(togetherSince)) return { ok: false, message: '日期格式不对' }
      let couple = null
      try {
        const r = await db.collection('couples').doc(user.coupleId).get()
        couple = r.data
      } catch (e) { couple = null }
      if (!couple || !(couple.memberOpenids || []).includes(OPENID)) return { ok: false, message: '不在这个空间里' }
      await db.collection('couples').doc(user.coupleId).update({ data: { togetherSince } })
      return { ok: true }
    }

    return { ok: false, message: '未知操作' }
  } catch (err) {
    console.error('bindCouple error', err)
    return { ok: false, message: (err && err.message) || '失败了' }
  }
}
