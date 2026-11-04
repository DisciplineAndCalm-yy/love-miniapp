const { formatDateTime } = require('../../utils/date')
const { callApi } = require('../../utils/cloud')
const interact = require('../../utils/interact')
const cache = require('../../utils/cache')

Page({
  data: {
    posts: [],
    paired: false,
    loaded: false,
    unreadTotal: 0,
    unreadName: '',
    unreadTarget: '',
    themeBg: '#FFF1F4'
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
    else this.load(true)
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh())
  },

  async load(force) {
    if (!force && this._lastLoadAt && Date.now() - this._lastLoadAt < 10000) return
    this._lastLoadAt = Date.now()
    if (!force) {
      const c = cache.get('blog')
      if (c && c.data) this.setData(Object.assign({ loaded: true }, c.data))
    }
    const app = getApp()
    await app.whenReady()
    try {
      const th = require('../../utils/theme').themeById(app.globalData.theme || 'sakura')
      this.setData({ themeBg: (th.palette && th.palette.bg) || '#FFF1F4' })
      app.applyTheme(app.globalData.theme)
    } catch (e) {}
    let couple = app.globalData.couple
    if (!couple && !app.globalData._coupleFetched) {
      await app.refreshCouple()
      couple = app.globalData.couple
    }
    if (!couple) {
      this.setData({ posts: [], paired: false, loaded: true })
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
    this.setData({ posts, paired: true, loaded: true })
    cache.set('blog', { posts, paired: true })
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
