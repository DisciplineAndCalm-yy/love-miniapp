const { todayKey, daysBetween, nextOccurrence } = require('../../utils/date')
const { callApi } = require('../../utils/cloud')

const MOOD = {
  love: '爱你',
  miss: '想你',
  calm: '平静',
  busy: '忙碌',
  sad: '难过'
}

Page({
  data: {
    ready: false,
    paired: false,
    days: 0,
    togetherSince: '',
    myCheckin: null,
    partnerCheckin: null,
    nextDay: null,
    streaks: { mine: 0, partner: 0, together: 0 },
    moodMap: MOOD
  },

  onShow() {
    this.load()
  },

  async load() {
    const app = getApp()
    await app.whenReady()
    const couple = app.globalData.couple
    const openid = app.globalData.openid
    if (!couple) {
      this.setData({ ready: true, paired: false })
      return
    }

    const today = todayKey()
    const days = couple.togetherSince ? Math.max(1, daysBetween(couple.togetherSince, today) + 1) : 0
    const db = app.db()
    const checkinRes = await db.collection('checkins').where({
      coupleId: couple._id,
      dateKey: today
    }).get()

    const myCheckin = checkinRes.data.find((item) => item._openid === openid) || null
    const partnerCheckin = checkinRes.data.find((item) => item._openid !== openid) || null

    let streaks = { mine: 0, partner: 0, together: 0 }
    try {
      const stats = await callApi('getStreaks', {}, { silent: true })
      streaks = stats.streaks
    } catch (err) {
      console.warn(err)
    }

    const anniRes = await db.collection('anniversaries').where({ coupleId: couple._id }).get()
    const upcoming = anniRes.data
      .map((item) => {
        const next = nextOccurrence(item.date, item.repeatYearly, today)
        return next ? { ...item, next, left: daysBetween(today, next) } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.left - b.left)[0] || null

    this.setData({
      ready: true,
      paired: true,
      days,
      togetherSince: couple.togetherSince || '',
      myCheckin,
      partnerCheckin,
      nextDay: upcoming,
      streaks
    })
  },

  goCheckin() {
    wx.switchTab({ url: '/pages/checkin/index' })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  goAnniversary() {
    wx.navigateTo({ url: '/pages/anniversary/index' })
  }
})
