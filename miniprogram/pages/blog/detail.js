const { callApi } = require('../../utils/cloud')
const { formatDateTime } = require('../../utils/date')

Page({
  data: {
    post: null,
    mine: false,
    authorName: '',
    timeText: ''
  },

  onLoad(query) {
    this._id = query.id
    this.load()
  },

  async load() {
    const app = getApp()
    await app.whenReady()
    let detail = null
    try {
      const res = await callApi('getPost', { id: this._id })
      detail = res.detail
    } catch (err) {
      console.warn('getPost failed', err)
    }
    if (!detail) return
    const urls = detail.photoUrls || {}
    this.setData({
      post: { ...detail, photos: (detail.photos || []).map((p) => urls[p] || p) },
      mine: detail._openid === app.globalData.openid,
      authorName: detail.authorName || app.memberName(detail._openid),
      timeText: formatDateTime(detail.createdAt)
    })
  },

  preview(e) {
    const urls = this.data.post.photos || []
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls
    })
  },

  edit() {
    wx.navigateTo({ url: `/pages/blog/edit?id=${this._id}` })
  },

  async remove() {
    const ok = await wx.showModal({ title: '删除这篇文章？', confirmColor: '#e86a7a' })
    if (!ok.confirm) return
    try {
      await callApi('removePost', { id: this._id })
      wx.navigateBack()
    } catch (err) {
      console.error(err)
    }
  }
})
