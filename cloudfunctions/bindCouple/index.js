const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function getUser(openid) {
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return data[0] || null
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  const user = await getUser(OPENID)
  if (!user) {
    return { ok: false, message: '请先打开小程序完成登录' }
  }

  if (action === 'create') {
    if (user.coupleId) return { ok: false, message: '已经绑定过了' }
    let inviteCode = randomCode()
    const exist = await db.collection('couples').where({ inviteCode }).count()
    if (exist.total) inviteCode = randomCode()

    const { _id } = await db.collection('couples').add({
      data: {
        inviteCode,
        memberOpenids: [OPENID],
        togetherSince: event.togetherSince || '',
        status: 'pending',
        createdAt: Date.now()
      }
    })
    await db.collection('users').doc(user._id).update({
      data: { coupleId: _id }
    })
    return { ok: true, coupleId: _id, inviteCode }
  }

  if (action === 'join') {
    const code = String(event.code || '').trim().toUpperCase()
    if (!code) return { ok: false, message: '请输入邀请码' }
    if (user.coupleId) return { ok: false, message: '已经绑定过了' }

    const { data } = await db.collection('couples').where({ inviteCode: code }).limit(1).get()
    const couple = data[0]
    if (!couple) return { ok: false, message: '邀请码不存在' }
    if (couple.memberOpenids.includes(OPENID)) {
      return { ok: true, coupleId: couple._id }
    }
    if (couple.memberOpenids.length >= 2) {
      return { ok: false, message: '这个空间已经满员了' }
    }

    await db.collection('couples').doc(couple._id).update({
      data: {
        memberOpenids: db.command.push(OPENID),
        status: 'paired',
        togetherSince: couple.togetherSince || event.togetherSince || ''
      }
    })
    await db.collection('users').doc(user._id).update({
      data: { coupleId: couple._id }
    })
    return { ok: true, coupleId: couple._id }
  }

  if (action === 'updateTogether') {
    if (!user.coupleId) return { ok: false, message: '还没有绑定' }
    await db.collection('couples').doc(user.coupleId).update({
      data: { togetherSince: event.togetherSince }
    })
    return { ok: true }
  }

  return { ok: false, message: '未知操作' }
}
