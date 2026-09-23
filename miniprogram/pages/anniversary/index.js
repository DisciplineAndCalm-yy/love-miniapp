const { todayKey, daysBetween, nextOccurrence } = require('../../utils/date')

Page({
  data: {
    list: []
  },

  onShow() {
    this.load()
  },

  async load() {
    const app = getApp()
    await app.whenReady()
    const couple = app.globalData.couple
    if (!couple) {
      this.setData({ list: [] })
      return
    }
    const today = todayKey()
    const { data } = await app.db().collection('anniversaries').where({ coupleId: couple._id }).get()
    const list = data.map((item) => {
      const next = nextOccurrence(item.date, item.repeatYearly, today)
      return {
        ...item,
        next: next || item.date,
        left: next ? daysBetween(today, next) : daysBetween(item.date, today)
      }
    }).sort((a, b) => (a.next > b.next ? 1 : -1))
    this.setData({ list })
  },

  add() {
    if (!getApp().globalData.couple) {
      wx.showToast({ title: '先绑定情侣空间', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/anniversary/edit' })
  },

  open(e) {
    wx.navigateTo({ url: `/pages/anniversary/edit?id=${e.currentTarget.dataset.id}` })
  }
})
