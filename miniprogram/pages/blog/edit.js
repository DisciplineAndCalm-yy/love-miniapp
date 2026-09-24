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
    const app = getApp()
    await app.whenReady()
    const { data } = await app.db().collection('posts').doc(id).get()
    if (!data || data._openid !== app.globalData.openid) {
      wx.showToast({ title: '只能编辑自己的文章', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
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

  removePhoto(e) {
    const index = e.currentTarget.dataset.index
    const photos = this.data.photos.slice()
    photos.splice(index, 1)
    this.setData({ photos })
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
      wx.showToast({ title: this.data.id ? '已更新' : '已发布' })
      setTimeout(() => wx.navigateBack(), 400)
    } catch (err) {
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  }
})
