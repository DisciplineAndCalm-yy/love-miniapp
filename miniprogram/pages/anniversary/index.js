const { todayKey, daysBetween, nextOccurrence, leftText, normDateKey } = require('../../utils/date')
const { callApi } = require('../../utils/cloud')

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
    let data = []
    try {
      const res = await callApi('listAnnis', {}, { silent: true })
      data = res.list || []
    } catch (err) {
      console.warn('listAnnis failed', err)
    }
    const list = data.map((item) => {
      const date = normDateKey(item.date)
      if (!date) return null
      const next = nextOccurrence(date, item.repeatYearly, today)
      const left = next ? daysBetween(today, next) : -daysBetween(date, today)
      if (!Number.isFinite(left)) return null
      return {
        ...item,
        date,
        next: next || date,
        left,
        leftLabel: leftText(left),
        past: !next
      }
    }).filter(Boolean).sort((a, b) => {
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
