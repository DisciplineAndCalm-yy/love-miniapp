const { todayKey, daysBetween, nextOccurrence, leftText, normDateKey } = require('../../utils/date')
const { callApi, shareCard } = require('../../utils/cloud')
const interact = require('../../utils/interact')
const { MOOD_MAP } = require('../../utils/mood')
const { dailyPraise } = require('../../utils/praise')
const { themeById, pendantById } = require('../../utils/theme')
const cache = require('../../utils/cache')

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
    this.load(true).finally(() => wx.stopPullDownRefresh())
  },

  async load(force) {
    // 短时间内重复进入(切 tab 返回)直接复用上次结果，减少云端请求
    if (!force && this._lastLoadAt && Date.now() - this._lastLoadAt < 15000) return
    // 先秒开本地缓存，再后台刷新（stale-while-revalidate）
    if (!force) {
      const c = cache.get('home')
      if (c && c.data) this.setData(Object.assign({ ready: true }, c.data))
    }
    const app = getApp()
    await app.whenReady()
    let couple = app.globalData.couple
    if (!couple && !app.globalData._coupleFetched) {
      await app.refreshCouple()
      couple = app.globalData.couple
    }
    const openid = app.globalData.openid
    const user = app.globalData.user || {}
    const partner = app.globalData.partner

    const theme = app.globalData.theme || 'sakura'
    const pendant = app.globalData.pendant || ''
    const palette = (themeById(theme) || {}).palette || {}
    this.setData({ theme, themeBg: palette.bg || '#FFF1F4', themeAccent: palette.accent || '#E14E68', pendantEmoji: pendantById(pendant).emoji })
    app.applyTheme(theme)
    this._lastLoadAt = Date.now()

    if (!couple) {
      this.setData({ ready: true, paired: false })
      return
    }

    const today = todayKey()
    const since = normDateKey(couple.togetherSince)
    const rawDays = since ? daysBetween(since, today) + 1 : 0
    const days = Number.isFinite(rawDays) ? Math.max(since ? 1 : 0, rawDays) : 0

    // 并行拉取各卡片数据，避免串行等待，显著缩短首屏时间
    const [checkinRes, streakRes, weatherRes, anniRes, interactRes, remindRes, intimacyRes] = await Promise.all([
      callApi('todayCheckins', { dateKey: today }, { silent: true }).catch(() => ({})),
      callApi('getStreaks', {}, { silent: true }).catch(() => ({})),
      callApi('getWeather', {}, { silent: true }).catch(() => ({})),
      callApi('listAnnis', {}, { silent: true }).catch(() => ({})),
      interact.summary().catch(() => ({})),
      callApi('reminderSummary', {}, { silent: true }).catch(() => ({})),
      callApi('intimacyOverview', {}, { silent: true }).catch(() => ({}))
    ])

    const checkinList = (checkinRes && checkinRes.list) || []
    const myCheckin = checkinList.find((item) => item.isMine) || null
    const partnerCheckin = checkinList.find((item) => !item.isMine) || null

    const streaks = (streakRes && streakRes.streaks) || { mine: 0, partner: 0, together: 0 }

    let weather = null
    let weatherEmoji = '🌤️'
    let praise = dailyPraise(today, 'general')
    if (weatherRes && weatherRes.weather && weatherRes.weather.now) {
      weather = weatherRes.weather
      const cond = weather.now.cond || 'general'
      weatherEmoji = COND_EMOJI[cond] || '🌤️'
      praise = dailyPraise(today, cond)
    }

    const anniList = (anniRes && anniRes.list) || []
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

    const unreadNotice = (interactRes && interactRes.total) || 0
    const reminders = {
      dueTodos: (remindRes && remindRes.dueTodos) || 0,
      capsuleReady: (remindRes && remindRes.capsuleReady) || 0
    }
    const intimacyLevel = (intimacyRes && intimacyRes.level) || this.data.intimacyLevel

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
    cache.set('home', {
      days, togetherSince: since, myCheckin, partnerCheckin,
      myName: user.nickName || '我', partnerName: (partner && partner.nickName) || 'TA',
      nextDay: upcoming, streaks, weather, weatherEmoji, praise, unreadNotice, reminders, intimacyLevel
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

  goGame24() {
    wx.navigateTo({ url: '/pkgFun/pages/game24/index' })
  },

  goFortune() {
    wx.navigateTo({ url: '/pkgFun/pages/fortune/index' })
  },

  goDrawGuess() {
    wx.navigateTo({ url: '/pkgFun/pages/drawguess/index' })
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
