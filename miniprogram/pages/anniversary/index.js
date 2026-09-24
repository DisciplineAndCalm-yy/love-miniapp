const { todayKey, daysBetween, nextOccurrence, leftText } = require('../../utils/date')

Page({
  data: {
    list: [],
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
      this.setData({ list: [], paired: false })
      return
    }
    const today = todayKey()
    const { data } = await app.db().collection('anniversaries').where({ coupleId: couple._id }).get()
    const list = data.map((item) => {
      const next = nextOccurrence(item.date, item.repeatYearly, today)
      const left = next ? daysBetween(today, next) : -daysBetween(item.date, today)
      return {
        ...item,
        next: next || item.date,
        left,
        leftLabel: leftText(left),
        past: !next
      }
    }).sort((a, b) => {
      if (a.past !== b.past) return a.past ? 1 : -1
      return a.next > b.next ? 1 : -1
    })
    this.setData({ list, paired: true })
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
