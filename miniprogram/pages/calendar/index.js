const { todayKey, buildMonthCells } = require('../../utils/date')

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
    dayAnnis: []
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

  async render() {
    const { year, month } = this.data
    const cells = buildMonthCells(year, month)
    const monthLabel = `${year} 年 ${month + 1} 月`
    this.setData({ cells, monthLabel })

    const app = getApp()
    await app.whenReady()
    const couple = app.globalData.couple
    if (!couple) {
      this.setData({ checkinMap: {}, anniMap: {} })
      this.refreshDay()
      return
    }

    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
    const _ = app.db().command

    const checkins = await app.db().collection('checkins').where({
      coupleId: couple._id,
      dateKey: _.gte(start).and(_.lte(end))
    }).limit(100).get()

    const checkinMap = {}
    checkins.data.forEach((item) => {
      checkinMap[item.dateKey] = (checkinMap[item.dateKey] || 0) + 1
    })

    const annis = await app.db().collection('anniversaries').where({ coupleId: couple._id }).get()
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
    this._checkins = checkins.data
    this.setData({ checkinMap, anniMap })
    this.refreshDay()
  },

  refreshDay() {
    const key = this.data.selected
    const dayCheckins = (this._checkins || []).filter((item) => item.dateKey === key)
    const dayAnnis = (this.data.anniMap[key] || [])
    this.setData({ dayCheckins, dayAnnis })
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
  }
})
