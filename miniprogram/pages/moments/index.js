const { callApi, shareCard } = require('../../utils/cloud')
const { doingIcon } = require('../../utils/mood')
const DOINGS = [{ id: '', label: '全部' }, { id: '吃饭', label: '🍱 吃饭' }, { id: '午睡', label: '😴 午睡' }, { id: '上厕所', label: '🚻 上厕所' }, { id: '上班', label: '💼 上班' }, { id: '通勤', label: '🚇 通勤' }, { id: '运动', label: '🏃 运动' }, { id: '追剧', label: '📺 追剧' }, { id: '出门', label: '🌳 出门' }, { id: '日常', label: '✨ 日常' }]
function fmt(ts) { const d = new Date(ts); const p = (n) => String(n).padStart(2, '0'); return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}` }
// 把服务端下发的 photoUrls(fileID->https 映射)补一个有序列表,供预览整组图用
function withList(photoUrls) {
  const m = photoUrls || {}
  const arr = Object.keys(m).filter((k) => k !== '__list').map((k) => m[k]).filter(Boolean)
  const out = {}
  Object.keys(m).forEach((k) => { out[k] = m[k] })
  if (arr.length) out.__list = arr
  return out
}
Page({
  data: { list: [], filter: '', doings: DOINGS, loading: true, moreLoading: false, hasMore: true, authorOpenid: '' },
  onShow() { this.reload() },
  onLoad() { try { this.setData({ authorOpenid: getApp().globalData.openid }) } catch (e) {} },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()) },
  onFilter(e) { this.setData({ filter: e.currentTarget.dataset.id }); this.reload() },
  async reload() {
    this.setData({ loading: true })
    try {
      const res = await callApi('listMoments', { limit: 20, doing: this.data.filter || undefined })
      this.setData({ list: (res.list || []).map((x) => ({ ...x, time: fmt(x.createdAt), icon: doingIcon(x.doing), photoUrls: withList(x.photoUrls) })), hasMore: res.hasMore })
    } catch (e) { console.warn(e) }
    this.setData({ loading: false })
  },
  async more() {
    if (!this.data.hasMore || this.data.moreLoading || !this.data.list.length) return
    this.setData({ moreLoading: true })
    try {
      const last = this.data.list[this.data.list.length - 1]
      const res = await callApi('listMoments', { limit: 20, before: last.createdAt, doing: this.data.filter || undefined })
      this.setData({ list: this.data.list.concat((res.list || []).map((x) => ({ ...x, time: fmt(x.createdAt), icon: doingIcon(x.doing), photoUrls: withList(x.photoUrls) }))), hasMore: res.hasMore })
    } finally { this.setData({ moreLoading: false }) }
  },
  goEdit() { wx.navigateTo({ url: '/pages/moments/edit' }) },
  onShareAppMessage() { return shareCard('今天的碎碎念 ♡') },
  onShareTimeline() { return { title: '今天的碎碎念 ♡' } },
  goDetail(e) { wx.navigateTo({ url: '/pages/moments/detail?id=' + e.currentTarget.dataset.id }) },
  preview(e) {
    const urls = e.currentTarget.dataset.urls || []
    wx.previewImage({ urls, current: e.currentTarget.dataset.src })
  },
})
