const { callApi, requireCouple } = require('../../utils/cloud')

Page({
  data: {
    kind: 'wish',
    content: '',
    throwing: false,
    drawing: false,
    loading: true,
    list: [],
    unfinished: 0,
    showGrant: false,
    grantText: '',
    particles: []
  },

  onLoad() { this.load() },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },

  pickKind(e) {
    this.setData({ kind: e.currentTarget.dataset.k })
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
  },

  async throwBottle() {
    if (this.data.throwing) return
    if (!requireCouple()) return
    const content = (this.data.content || '').trim()
    if (!content) {
      wx.showToast({ title: '先写下心愿再丢哦', icon: 'none' })
      return
    }
    this.setData({ throwing: true, drawing: true })
    try {
      await callApi('throwBottle', { kind: this.data.kind, content })
      this.setData({ content: '' })
      wx.showToast({ title: '瓶子漂走啦 🌊' })
      await this.load()
    } catch (err) {
      console.error(err)
    } finally {
      this.setData({ throwing: false, drawing: false })
    }
  },

  async grant(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.data.list || []).find((w) => w._id === id)
    try {
      await callApi('grantWish', { id })
      this.setData({ grantText: item ? item.content : '', showGrant: true })
      this.burst()
      await this.load()
    } catch (err) {
      console.error(err)
    }
  },

  closeGrant() {
    this.setData({ showGrant: false, grantText: '', particles: [] })
  },

  burst() {
    const icons = ['🌟', '✨', '💫', '🎉', '💗', '⭐']
    this.setData({
      particles: Array.from({ length: 18 }, (_, i) => ({
        id: i,
        t: icons[i % icons.length],
        x: 5 + Math.random() * 90,
        s: 36 + Math.random() * 40,
        d: (1.2 + Math.random() * 1.2).toFixed(2),
        delay: (Math.random() * 0.6).toFixed(2)
      }))
    })
  },

  async load() {
    try {
      this.setData({ loading: true })
      const res = await callApi('listWishes', {}, { silent: true })
      const p = (n) => String(n).padStart(2, '0')
      this.setData({
        list: (res.list || []).map((d) => {
          const t = new Date(d.createdAt)
          return { ...d, time: `${t.getMonth() + 1}/${t.getDate()} ${p(t.getHours())}:${p(t.getMinutes())}` }
        }),
        unfinished: res.unfinished || 0,
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  }
})
