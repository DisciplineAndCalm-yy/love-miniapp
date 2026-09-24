function requireCouple() {
  const couple = getApp().globalData.couple
  if (!couple) {
    wx.showToast({ title: '先去绑定两个人吧', icon: 'none' })
    return null
  }
  return couple
}

async function chooseLocalImages(count = 1) {
  // chooseMedia 在部分旧基础库不存在,降级到 chooseImage
  if (wx.chooseMedia) {
    const pick = await wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed']
    })
    return (pick.tempFiles || []).slice(0, count).map((f) => f.tempFilePath).filter(Boolean)
  }
  const pick = await new Promise((resolve, reject) => {
    wx.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: resolve,
      fail: reject
    })
  })
  return (pick.tempFilePaths || []).slice(0, count)
}

function isCancel(err) {
  const msg = String((err && (err.errMsg || err.message)) || '')
  return msg.includes('cancel')
}

function isAuthDeny(err) {
  const msg = String((err && (err.errMsg || err.message)) || '')
  return msg.includes('auth deny') || msg.includes('authorize') || msg.includes('permission')
}

async function fileIDToURL(fileID) {
  if (!fileID || !fileID.startsWith('cloud://')) return fileID || ''
  try {
    const r = await wx.cloud.getTempFileURL({ fileList: [fileID] })
    const f = r && r.fileList && r.fileList[0]
    if (f && f.tempFileURL) return f.tempFileURL
  } catch (err) {
    console.warn('getTempFileURL failed', err)
  }
  return fileID
}

async function fileIDsToURLs(ids) {
  const cloudIDs = [...new Set((ids || []).filter((id) => id && id.startsWith('cloud://')))]
  const map = {}
  if (!cloudIDs.length) return map
  try {
    const r = await wx.cloud.getTempFileURL({ fileList: cloudIDs })
    ;(r.fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL })
  } catch (err) {
    console.warn('getTempFileURL failed', err)
  }
  return map
}
function askOpenSetting() {
  wx.showModal({
    title: '需要相册权限',
    content: '请在设置中打开“相册”权限，否则无法添加图片',
    confirmText: '去设置',
    success(r) {
      if (r.confirm && wx.openSetting) wx.openSetting({})
    }
  })
}

async function uploadImage(count = 1) {
  let paths = []
  try {
    paths = await chooseLocalImages(count)
  } catch (err) {
    if (isCancel(err)) throw err
    if (isAuthDeny(err)) askOpenSetting()
    throw err
  }
  if (!paths.length) throw new Error('cancel')
  const ids = []
  for (const tempFilePath of paths) {
    const ext = ((tempFilePath || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
    const cloudPath = `love/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
    try {
      const up = await wx.cloud.uploadFile({ cloudPath, filePath: tempFilePath })
      ids.push(up.fileID)
    } catch (err) {
      console.warn('uploadFile failed', err)
      throw new Error('upload:' + String((err && (err.errMsg || err.message)) || '上传失败'))
    }
  }
  return count === 1 ? ids[0] : ids
}

function shareCard(title) {
  return { title: title || '我们的二人小宇宙 ♡', path: '/pages/home/index' }
}

async function callApi(action, data = {}, opts = {}) {
  let lastErr = null
  for (let i = 0; i < 2; i += 1) {
    try {
      const res = await wx.cloud.callFunction({ name: 'api', data: { action, ...data } })
      const result = (res && res.result) || {}
      if (!result.ok) throw new Error(result.message || '请求失败')
      return result
    } catch (err) {
      lastErr = err
      if (err && err.errMsg && err.errMsg.includes('cancel')) throw err
      if (i === 0) await new Promise((r) => setTimeout(r, 400))
    }
  }
  if (!opts.silent) wx.showToast({ title: String((lastErr && (lastErr.errMsg || lastErr.message)) || '请求失败').slice(0, 28), icon: 'none' })
  throw lastErr
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
  fileIDToURL,
  fileIDsToURLs,
  shareCard,
  callApi,
  requestAnniversaryRemind
}
