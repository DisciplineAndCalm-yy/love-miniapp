Page({
  data: {
    posts: []
  },

  onShow() {
    this.load()
  },

  async load() {
    const app = getApp()
    await app.whenReady()
    const couple = app.globalData.couple
    if (!couple) {
      this.setData({ posts: [] })
      return
    }
    const { data } = await app.db().collection('posts')
      .where({ coupleId: couple._id })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
    this.setData({ posts: data })
  },

  write() {
    if (!getApp().globalData.couple) {
      wx.showToast({ title: '先绑定情侣空间', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/blog/edit' })
  },

  open(e) {
    wx.navigateTo({ url: `/pages/blog/detail?id=${e.currentTarget.dataset.id}` })
  }
})
