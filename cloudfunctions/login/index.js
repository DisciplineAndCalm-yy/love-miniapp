const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID, APPID, UNIONID } = cloud.getWXContext()
  const { data } = await db.collection('users').where({ _openid: OPENID }).limit(1).get()
  let user = data[0]
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
