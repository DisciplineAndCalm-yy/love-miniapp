const { requireCouple, uploadImage, callApi } = require('../../utils/cloud')

Page({
  data: {
    id: '',
    title: '',
    content: '',
    photos: [],
    place: '',
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
      photos: data.photos || [],
      place: data.place || ''
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

  choosePlace() {
    wx.chooseLocation({
      success: (res) => {
        const name = (res && (res.name || res.address)) || ''
        if (name) this.setData({ place: String(name).slice(0, 40) })
      },
      fail: (err) => {
        const msg = String((err && err.errMsg) || '')
        if (msg.includes('cancel')) return
        if (msg.includes('auth') || msg.includes('permission') || msg.includes('deny')) {
          wx.showModal({ title: '需要位置权限', content: '请在设置里允许位置权限后再选择地点', confirmText: '去设置', success: (r) => { if (r.confirm && wx.openSetting) wx.openSetting({}) } })
          return
        }
        wx.showToast({ title: '地图选点不可用', icon: 'none' })
      }
    })
  },
  clearPlace() { this.setData({ place: '' }) },

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
        photos: this.data.photos,
        place: this.data.place
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
