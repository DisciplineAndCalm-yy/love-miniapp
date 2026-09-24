const { formatDateTime } = require('../../utils/date')

Page({
  data: {
    posts: [],
    paired: false
  },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  async load() {
    const app = getApp()
    await app.whenReady()
    const couple = app.globalData.couple
    if (!couple) {
      this.setData({ posts: [], paired: false })
      return
    }
    const { data } = await app.db().collection('posts')
      .where({ coupleId: couple._id })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
const STAMPS = ['💌', '🌷', '🍓', '🌙', '☁️', '🐱']
    const posts = data.map((item, i) => {
      const photos = item.photos || []
      return {
        ...item,
        photos,
        coverPhotos: photos.slice(0, 3),
        authorName: app.memberName(item._openid),
        timeText: formatDateTime(item.createdAt),
        excerpt: (item.content || '').slice(0, 80),
        stamp: STAMPS[i % STAMPS.length]
      }
    })
    this.setData({ posts, paired: true })
  },

  write() {
    if (!getApp().globalData.couple) {
      wx.showToast({ title: '先绑定情侣空间', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/blog/edit' })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  open(e) {
    wx.navigateTo({ url: `/pages/blog/detail?id=${e.currentTarget.dataset.id}` })
  }
})
