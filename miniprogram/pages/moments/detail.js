const { callApi } = require('../../utils/cloud')
const { doingIcon } = require('../../utils/mood')
Page({
  data: { detail: null, time: '', icon: '💌', mine: false },
  onLoad(o) { this.id = o.id; this.load() },
  async load() {
    try {
      const app = getApp()
      await app.whenReady()
      const res = await callApi('getMoment', { id: this.id })
      const d = new Date(res.detail.createdAt)
      const p = (n) => String(n).padStart(2, '0')
      this.setData({ detail: res.detail, icon: doingIcon(res.detail.doing), mine: res.detail._openid === app.globalData.openid, time: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` })
    } catch (e) { wx.showToast({ title: '加载失败', icon: 'none' }) }
  },
  preview(e) { wx.previewImage({ urls: this.data.detail.photos, current: e.currentTarget.dataset.src }) },
  async remove() {
    const ok = await wx.showModal({ title: '删除这条动态？', confirmColor: '#c94b5c' })
    if (!ok.confirm) return
    await callApi('removeMoment', { id: this.id })
    wx.showToast({ title: '已删除' })
    wx.navigateBack()
  },
})
