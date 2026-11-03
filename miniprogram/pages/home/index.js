const { todayKey, daysBetween, nextOccurrence, leftText, normDateKey } = require('../../utils/date')
const { callApi, shareCard } = require('../../utils/cloud')
const interact = require('../../utils/interact')
const { MOOD_MAP } = require('../../utils/mood')
const { dailyPraise } = require('../../utils/praise')

const COND_EMOJI = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', thunder: '⛈️', fog: '🌫️', general: '🌤️' }

Page({
  data: {
    ready: false,
    paired: false,
    days: 0,
    togetherSince: '',
    myCheckin: null,
    partnerCheckin: null,
    myName: '我',
    partnerName: 'TA',
    nextDay: null,
    streaks: { mine: 0, partner: 0, together: 0 },
    moodMap: MOOD_MAP,
    showDeco: true,
    showMascot: true,
    weather: null,
    weatherEmoji: '🌤️',
    praise: '',
    unreadNotice: 0,
    intimacyLevel: null,
    reminders: { dueTodos: 0, capsuleReady: 0 },
    showMore: false
  },
  hideDeco() { this.setData({ showDeco: false }) },
  hideMascot() { this.setData({ showMascot: false }) },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh())
  },

  async load() {
    const app = getApp()
    await app.whenReady()
    await app.refreshCouple()
    const couple = app.globalData.couple
    const openid = app.globalData.openid
    const user = app.globalData.user || {}
    const partner = app.globalData.partner

    if (!couple) {
      this.setData({ ready: true, paired: false })
      return
    }

    const today = todayKey()
    const since = normDateKey(couple.togetherSince)
    const rawDays = since ? daysBetween(since, today) + 1 : 0
    const days = Number.isFinite(rawDays) ? Math.max(since ? 1 : 0, rawDays) : 0
    // 签到与纪念日统一走云函数读库,不再直连数据库(部分机型直连读不到对方数据)
    let checkinList = []
    try {
      const res = await callApi('todayCheckins', { dateKey: today }, { silent: true })
      checkinList = res.list || []
    } catch (err) {
      console.warn('todayCheckins failed', err)
    }
    const myCheckin = checkinList.find((item) => item.isMine) || null
    const partnerCheckin = checkinList.find((item) => !item.isMine) || null

    let streaks = { mine: 0, partner: 0, together: 0 }
    try {
      const stats = await callApi('getStreaks', {}, { silent: true })
      streaks = stats.streaks
    } catch (err) {
      console.warn(err)
    }

    // 今日天气 + 夸夸(没设城市/取不到就静默降级,不影响首页其它内容)
    let weather = null
    let weatherEmoji = '🌤️'
    let praise = ''
    try {
      const w = await callApi('getWeather', {}, { silent: true })
      if (w && w.weather && w.weather.now) {
        weather = w.weather
        const cond = weather.now.cond || 'general'
        weatherEmoji = COND_EMOJI[cond] || '🌤️'
        praise = dailyPraise(today, cond)
      }
    } catch (err) {
      // 没有城市:仍然给一句夸夸,天气卡显示引导
      praise = dailyPraise(today, 'general')
    }

    let anniList = []
    try {
      const anniRes = await callApi('listAnnis', {}, { silent: true })
      anniList = anniRes.list || []
    } catch (err) {
      console.warn('listAnnis failed', err)
    }
    const upcoming = anniList
      .map((item) => {
        const date = normDateKey(item.date)
        if (!date) return null
        const next = nextOccurrence(date, item.repeatYearly, today)
        if (!next) return null
        const left = daysBetween(today, next)
        if (!Number.isFinite(left)) return null
        return { ...item, date, next, left, leftLabel: leftText(left) }
      })
      .filter(Boolean)
      .sort((a, b) => a.left - b.left)[0] || null

    let unreadNotice = this.data.unreadNotice || 0
    try {
      const s = await interact.summary()
      unreadNotice = s.total || 0
    } catch (err) {}

    let reminders = this.data.reminders || { dueTodos: 0, capsuleReady: 0 }
    try {
      const rm = await callApi('reminderSummary', {}, { silent: true })
      reminders = { dueTodos: rm.dueTodos || 0, capsuleReady: rm.capsuleReady || 0 }
    } catch (err) {}

    let intimacyLevel = this.data.intimacyLevel
    try {
      const iv = await callApi('intimacyOverview', {}, { silent: true })
      intimacyLevel = iv.level || null
    } catch (err) {}

    this.setData({
      ready: true,
      paired: true,
      days,
      togetherSince: since,
      myCheckin,
      partnerCheckin,
      myName: user.nickName || '我',
      partnerName: (partner && partner.nickName) || 'TA',
      nextDay: upcoming,
      streaks,
      weather,
      weatherEmoji,
      praise,
      unreadNotice,
      reminders,
      intimacyLevel
    })
  },

  goNotify() {
    wx.navigateTo({ url: '/pages/notify/index' })
  },
  goIntimacy() {
    wx.navigateTo({ url: '/pages/intimacy/index' })
  },
  goLife() {
    wx.navigateTo({ url: '/pages/life/index' })
  },
  toggleMore() {
    this.setData({ showMore: !this.data.showMore })
  },
  goReport() {
    wx.navigateTo({ url: '/pages/report/index' })
  },
  goCapsule() {
    wx.navigateTo({ url: '/pages/capsule/index' })
  },
  goMemories() {
    wx.navigateTo({ url: '/pages/memories/index' })
  },
  goMonopoly() {
    wx.navigateTo({ url: '/pkgFun/pages/monopoly/index' })
  },

  goCheckin() {
    wx.switchTab({ url: '/pages/checkin/index' })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  goAnniversary() {
    wx.navigateTo({ url: '/pages/anniversary/index' })
  },

  goQuiz() {
    wx.navigateTo({ url: '/pkgFun/pages/quiz/index' })
  },

  goBlog() {
    wx.switchTab({ url: '/pages/blog/index' })
  },

  goPet() {
    wx.navigateTo({ url: '/pages/pet/index' })
  },

  goGame() {
    wx.navigateTo({ url: '/pkgFun/pages/game/index' })
  },

  goWish() {
    wx.navigateTo({ url: '/pkgFun/pages/wish/index' })
  },

  goDice() {
    wx.navigateTo({ url: '/pkgFun/pages/dice/index' })
  },

  goCards() {
    wx.navigateTo({ url: '/pkgFun/pages/cards/index' })
  },

  goNight() {
    wx.navigateTo({ url: '/pkgFun/pages/night/index' })
  },

  goAdventure() {
    wx.navigateTo({ url: '/pkgFun/pages/adventure/index' })
  },

  goPeriod() {
    wx.navigateTo({ url: '/pages/period/index' })
  },

  goWeather() {
    wx.navigateTo({ url: '/pages/weather/index' })
  },

  goChat() {
    wx.switchTab({ url: '/pages/chat/index' })
  },

  onShareAppMessage() { return shareCard(`我们已经在一起 ${this.data.days || 0} 天啦 ♡`) },

  goMoments() {
    wx.navigateTo({ url: '/pages/moments/index' })
  },

  goAlbum() {
    wx.navigateTo({ url: '/pages/album/index' })
  }
})
