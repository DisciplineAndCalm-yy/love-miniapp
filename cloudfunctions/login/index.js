const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID, APPID, UNIONID } = cloud.getWXContext()
  const { data } = await db.collection('users').where({ _openid: OPENID }).limit(20).get()
  let user = null
  if (data && data.length) {
    // 历史脏数据可能有多条,保留有昵称/头像的那条,其余合并清理
    user = data.find((u) => u.avatarUrl || (u.nickName && u.nickName !== '还没起名字')) || data[0]
    const keepId = user._id
    const patch = {}
    data.forEach((u) => {
      if (u._id === keepId) return
      if (!user.avatarUrl && u.avatarUrl) patch.avatarUrl = u.avatarUrl
      if ((!user.nickName || user.nickName === '还没起名字') && u.nickName && u.nickName !== '还没起名字') patch.nickName = u.nickName
      if (!user.coupleId && u.coupleId) patch.coupleId = u.coupleId
    })
    if (Object.keys(patch).length) {
      await db.collection('users').doc(keepId).update({ data: patch })
      user = { ...user, ...patch }
    }
    for (const u of data) {
      if (u._id !== keepId) {
        try { await db.collection('users').doc(u._id).remove() } catch (e) {}
      }
    }
  }
  if (!user) {
    const payload = {
      _openid: OPENID,
      nickName: '还没起名字',
      avatarUrl: '',
      coupleId: '',
      remindEnabled: false,
      createdAt: Date.now()
    }
    const add = await db.collection('users').add({ data: payload })
    user = { _id: add._id, ...payload }
  }
  return { openid: OPENID, appid: APPID, unionid: UNIONID, user }
}
