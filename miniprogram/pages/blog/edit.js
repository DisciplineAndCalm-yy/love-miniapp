const { requireCouple, uploadImage, callApi } = require('../../utils/cloud')

Page({
  data: {
    id: '',
    title: '',
    content: '',
    photos: [],
    saving: false
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ id: query.id })
      this.loadPost(query.id)
    }
  },

  async loadPost(id) {
    const { data } = await getApp().db().collection('posts').doc(id).get()
    this.setData({
      title: data.title,
      content: data.content,
      photos: data.photos || []
    })
  },

  onTitle(e) {
    this.setData({ title: e.detail.value })
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
  },

  async addPhoto() {
    if (this.data.photos.length >= 9) return
    try {
      const fileID = await uploadImage()
      this.setData({ photos: this.data.photos.concat(fileID) })
    } catch (err) {
      if (err && err.errMsg && err.errMsg.includes('cancel')) return
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  async save() {
    if (!requireCouple()) return
    const title = this.data.title.trim()
    const content = this.data.content.trim()
    if (!title || !content) {
      wx.showToast({ title: '标题和正文都要写', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await callApi('savePost', {
        id: this.data.id,
        title,
        content,
        photos: this.data.photos
      })
      wx.navigateBack()
    } catch (err) {
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  }
})
