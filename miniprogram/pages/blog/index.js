const { formatDateTime } = require('../../utils/date')
const { callApi } = require('../../utils/cloud')
const interact = require('../../utils/interact')

Page({
  data: {
    posts: [],
    paired: false,
    unreadTotal: 0,
    unreadName: '',
    unreadTarget: ''
  },

  onShow() {
    this.load()
    this.loadUnread()
  },

  async loadUnread() {
    try {
      const res = await interact.summary()
      const posts = (res.recent || []).filter((r) => r.targetType === 'post')
      this.setData({
        unreadTotal: (res.byType && res.byType.post) || 0,
        unreadName: posts[0] ? posts[0].byName : 'TA',
        unreadTarget: posts[0] ? posts[0].targetId : ''
      })
    } catch (e) {}
  },

  openUnread() {
    const id = this.data.unreadTarget
    if (id) wx.navigateTo({ url: `/pages/blog/detail?id=${id}` })
    else this.load()
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
    const { data } = { data: [] }
    let list = []
    try {
      const res = await callApi('listPosts', {}, { silent: true })
      list = res.list || []
    } catch (err) {
      console.warn('listPosts failed', err)
    }
const STAMPS = ['💌', '🌷', '🍓', '🌙', '☁️', '🐱']
    const posts = list.map((item, i) => {
      const photos = item.photos || []
      const urls = (item.photoUrls || {})
      return {
        ...item,
        photos,
        coverPhotos: photos.slice(0, 3).map((p) => urls[p] || p),
        authorName: item.authorName || app.memberName(item._openid),
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
