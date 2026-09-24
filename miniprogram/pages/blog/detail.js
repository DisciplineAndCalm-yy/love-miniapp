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
    const { data } = await app.db().collection('posts').doc(this._id).get()
    this.setData({
      post: data,
      mine: data._openid === app.globalData.openid,
      authorName: app.memberName(data._openid),
      timeText: formatDateTime(data.createdAt)
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
