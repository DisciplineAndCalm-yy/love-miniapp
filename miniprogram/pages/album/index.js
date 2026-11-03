const { callApi, shareCard } = require('../../utils/cloud')

function pad(n) { return String(n).padStart(2, '0') }
function dayKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function dayLabel(ts) {
  const d = new Date(ts)
  const now = new Date()
  const base = `${d.getMonth() + 1}月${d.getDate()}日`
  if (d.toDateString() === now.toDateString()) return `今天 · ${base}`
  const y = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  if (d.toDateString() === y.toDateString()) return `去年今天 · ${base}`
  return `${d.getFullYear()}年 ${base}`
}
function fmtTime(ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

function buildGroups(list) {
  const map = {}
  const order = []
  ;(list || []).forEach((p) => {
    const k = dayKey(p.createdAt)
    if (!map[k]) { map[k] = { key: k, label: dayLabel(p.createdAt), items: [] }; order.push(k) }
    map[k].items.push({ ...p, time: fmtTime(p.createdAt) })
  })
  return order.map((k) => map[k])
}

Page({
  data: {
    groups: [],
    photos: [],
    total: 0,
    memories: [],
    loading: true,
    hasMore: true,
    nextBefore: 0,
    loadingMore: false
  },

  onShow() { this.reload() },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()) },
  onReachBottom() { this.more() },
  onShareAppMessage() { return shareCard(`我们的相册，藏满回忆 ♡`) },

  async reload() {
    this.setData({ loading: true })
    this.loadMemories()
    try {
      const res = await callApi('albumList', { limit: 60 }, { silent: true })
      const photos = res.list || []
      this.setData({
        photos,
        total: photos.length,
        hasMore: !!res.hasMore,
        nextBefore: res.nextBefore || 0,
        groups: buildGroups(photos)
      })
    } catch (e) {}
    this.setData({ loading: false })
  },

  async more() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return
    this.setData({ loadingMore: true })
    try {
      const res = await callApi('albumList', { before: this.data.nextBefore, limit: 60 }, { silent: true })
      const photos = this.data.photos.concat(res.list || [])
      this.setData({
        photos,
        total: photos.length,
        hasMore: !!res.hasMore,
        nextBefore: res.nextBefore || 0,
        groups: buildGroups(photos)
      })
    } catch (e) {} finally { this.setData({ loadingMore: false }) }
  },

  async loadMemories() {
    try {
      const res = await callApi('onThisDay', {}, { silent: true })
      this.setData({ memories: res.items || [] })
    } catch (e) { this.setData({ memories: [] }) }
  },

  preview(e) {
    const urls = this.data.photos.map((p) => p.url).filter(Boolean)
    wx.previewImage({ urls, current: e.currentTarget.dataset.url })
  },

  openMemory(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    if (item.type === 'moment' && item.id) return wx.navigateTo({ url: `/pages/moments/detail?id=${item.id}` })
    if (item.type === 'post' && item.id) return wx.navigateTo({ url: `/pages/blog/detail?id=${item.id}` })
    if (item.type === 'checkin') return wx.switchTab({ url: '/pages/checkin/index' })
  }
})
