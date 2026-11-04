// 轻量本地缓存：用于「先渲染缓存、后台再刷新」，让页面秒开
// 仅按固定键存，冷启动（openid/couple 尚未就绪）时也能命中
function get(name) {
  try {
    const v = wx.getStorageSync('cache_' + name)
    if (v && typeof v === 'object' && 'data' in v) return v
  } catch (e) {}
  return null
}

function set(name, data) {
  try {
    wx.setStorageSync('cache_' + name, { at: Date.now(), data })
  } catch (e) {}
}

module.exports = { get, set }
