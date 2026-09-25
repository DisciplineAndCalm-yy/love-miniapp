const { todayKey, buildMonthCells } = require('../../utils/date')
const { callApi } = require('../../utils/cloud')

Page({
  data: {
    year: 0,
    month: 0,
    monthLabel: '',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    cells: [],
    selected: '',
    today: '',
    checkinMap: {},
    anniMap: {},
    dayCheckins: [],
    dayAnnis: [],
    paired: false,
    monthSummary: { mine: 0, partner: 0, together: 0 }
  },

  onShow() {
    const now = new Date()
    if (!this.data.year) {
      this.setData({
        year: now.getFullYear(),
        month: now.getMonth(),
        today: todayKey(),
        selected: todayKey()
      })
    }
    this.render()
  },

  onPullDownRefresh() {
    this.render().finally(() => wx.stopPullDownRefresh())
  },

  async render() {
    const { year, month } = this.data
    const cells = buildMonthCells(year, month)
    const monthLabel = `${year} 年 ${month + 1} 月`
    this.setData({ cells, monthLabel })

    const app = getApp()
    await app.whenReady()
    const couple = app.globalData.couple
    if (!couple) {
      this._annis = []
      this._checkins = []
      this.setData({ checkinMap: {}, anniMap: {}, paired: false })
      this.refreshDay()
      return
    }

    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

    let checkinList = []
    try {
      const res = await callApi('listMonthCheckins', { start, end }, { silent: true })
      checkinList = res.list || []
    } catch (err) {
      console.warn('listMonthCheckins failed', err)
    }

    const myOpenid = app.globalData.openid
    const checkinMap = {}
    const daySets = {}
    const monthSummary = { mine: 0, partner: 0, together: 0 }
    checkinList.forEach((item) => {
      checkinMap[item.dateKey] = (checkinMap[item.dateKey] || 0) + 1
      if (item.isMine || item._openid === myOpenid) monthSummary.mine += 1
      else monthSummary.partner += 1
      daySets[item.dateKey] = daySets[item.dateKey] || new Set()
      daySets[item.dateKey].add(item._openid)
    })
    Object.keys(daySets).forEach((k) => {
      if (daySets[k].size >= 2) monthSummary.together += 1
    })

    const annis = await (async () => {
      try {
        const res = await callApi('listAnnis', {}, { silent: true })
        return { data: res.list || [] }
      } catch (err) {
        return app.db().collection('anniversaries').where({ coupleId: couple._id }).get()
      }
    })()
    const anniMap = {}
    const mm = String(month + 1).padStart(2, '0')
    annis.data.forEach((item) => {
      const itemMmDd = item.date.slice(5)
      if (item.repeatYearly) {
        if (itemMmDd.startsWith(`${mm}-`)) {
          const key = `${year}-${itemMmDd}`
          anniMap[key] = anniMap[key] || []
          anniMap[key].push(item)
        }
      } else if (item.date >= start && item.date <= end) {
        anniMap[item.date] = anniMap[item.date] || []
        anniMap[item.date].push(item)
      }
    })

    this._annis = annis.data
    this._checkins = checkinList
    this.setData({ checkinMap, anniMap, paired: true, monthSummary })
    this.refreshDay()
  },

  refreshDay() {
    const key = this.data.selected
    const dayCheckins = (this._checkins || []).filter((item) => item.dateKey === key)
    const dayAnnis = (this.data.anniMap[key] || [])
    this.setData({ dayCheckins, dayAnnis })
  },

  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    const urls = (this.data.dayCheckins || []).map((c) => c.photoUrl || c.photo).filter(Boolean)
    wx.previewImage({ urls: urls.length ? urls : [url], current: url })
  },

  avatarError(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      dayCheckins: (this.data.dayCheckins || []).map((c) => c._id === id ? { ...c, authorAvatarUrl: '' } : c)
    })
  },

  photoError(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      dayCheckins: (this.data.dayCheckins || []).map((c) => c._id === id ? { ...c, photoUrl: '' } : c)
    })
  },

  prevMonth() {
    let { year, month } = this.data
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
    this.setData({ year, month })
    this.render()
  },

  nextMonth() {
    let { year, month } = this.data
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
    this.setData({ year, month })
    this.render()
  },

  selectDay(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ selected: key })
    this.refreshDay()
  },

  goBind() {
    wx.navigateTo({ url: '/pages/profile/index' })
  }
})
