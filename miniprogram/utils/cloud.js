function requireCouple() {
  const couple = getApp().globalData.couple
  if (!couple) {
    wx.showToast({ title: '先去绑定两个人吧', icon: 'none' })
    return null
  }
  return couple
}

async function uploadImage() {
  const pick = await wx.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sizeType: ['compressed']
  })
  const file = pick.tempFiles[0]
  const ext = (file.tempFilePath.split('.').pop() || 'jpg').toLowerCase()
  const cloudPath = `love/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
  const up = await wx.cloud.uploadFile({
    cloudPath,
    filePath: file.tempFilePath
  })
  return up.fileID
}

async function callApi(action, data = {}, opts = {}) {
  const res = await wx.cloud.callFunction({
    name: 'api',
    data: { action, ...data }
  })
  const result = res.result || {}
  if (!result.ok) {
    const message = result.message || '请求失败'
    if (!opts.silent) wx.showToast({ title: message, icon: 'none' })
    throw new Error(message)
  }
  return result
}

async function requestAnniversaryRemind() {
  const { anniversaryTmplId } = require('../config')
  if (!anniversaryTmplId) {
    wx.showToast({ title: '先在 config.js 填模板 ID', icon: 'none' })
    return false
  }
  const send = await wx.requestSubscribeMessage({
    tmplIds: [anniversaryTmplId]
  })
  if (send[anniversaryTmplId] !== 'accept') {
    wx.showToast({ title: '没有打开提醒授权', icon: 'none' })
    return false
  }
  await callApi('enableRemind', { enabled: true })
  const app = getApp()
  if (app.globalData.user) app.globalData.user.remindEnabled = true
  return true
}

module.exports = {
  requireCouple,
  uploadImage,
  callApi,
  requestAnniversaryRemind
}
