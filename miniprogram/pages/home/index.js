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
    showMore: false,
    entryGroups: [
      {
        key: 'daily', title: '日常陪伴', emoji: '♡', tint: 'rgba(255,143,176,.16)',
        items: [
          { label: '签到', icon: '🗓️', to: 'goCheckin' },
          { label: '动态', icon: '📸', to: 'goMoments' },
          { label: '相册', icon: '🖼️', to: 'goAlbum' },
          { label: '悄悄话', icon: '💬', to: 'goChat' },
          { label: '晚安', icon: '🌙', to: 'goNight' }
        ]
      },
      {
        key: 'memory', title: '回忆珍藏', emoji: '🎀', tint: 'rgba(255,196,120,.2)',
        items: [
          { label: '纪念日', icon: '🎈', to: 'goAnniversary' },
          { label: '回忆册', icon: '📔', to: 'goMemories' },
          { label: '时间胶囊', icon: '⏳', to: 'goCapsule' },
          { label: '恋爱报告', icon: '📖', to: 'goReport' },
          { label: '亲密度', icon: '💗', to: 'goIntimacy' },
          { label: '空间', icon: '✏️', to: 'goBlog' }
        ]
      },
      {
        key: 'play', title: '一起玩', emoji: '🎮', tint: 'rgba(150,140,255,.16)',
        items: [
          { label: '扭蛋', icon: '🎰', to: 'goGame' },
          { label: '真心话', icon: '🃏', to: 'goCards' },
          { label: '你画我猜', icon: '🎨', to: 'goDrawGuess' },
          { label: '默契', icon: '💞', to: 'goQuiz' },
          { label: '大富翁', icon: '🎡', to: 'goMonopoly' },
          { label: '24点', icon: '🧮', to: 'goGame24' },
          { label: '抽签', icon: '🎋', to: 'goFortune' },
          { label: '冒险', icon: '🗺️', to: 'goAdventure' },
          { label: '宠物', icon: '🐾', to: 'goPet' },
          { label: '心愿', icon: '🍾', to: 'goWish' }
        ]
      },
      {
        key: 'tools', title: '生活小工具', emoji: '🧰', tint: 'rgba(120,200,160,.18)',
        items: [
          { label: '小事', icon: '🏡', to: 'goLife' },
          { label: '天气', icon: '🌤️', to: 'goWeather' },
          { label: '生理期', icon: '🩸', to: 'goPeriod' },
          { label: '吃点啥', icon: '🎲', to: 'goDice' },
          { label: '设置', icon: '⚙️', to: 'goBind' }
        ]
      }
    ],
    editing: false,
    hidden: {},
    collapsed: {},
    order: {},
    viewGroups: [],
    drag: { active: false }
  },
  loadEntryCfg() {
    try {
      const cfg = wx.getStorageSync('homeEntryCfg') || {}
      this.setData(
        { hidden: cfg.hidden || {}, collapsed: cfg.collapsed || {}, order: cfg.order || {} },
        () => this.rebuildEntries()
      )
    } catch (e) { this.rebuildEntries() }
  },
  saveEntryCfg() {
    try {
      wx.setStorageSync('homeEntryCfg', {
        hidden: this.data.hidden || {},
        collapsed: this.data.collapsed || {},
        order: this.data.order || {}
      })
    } catch (e) {}
  },
  rebuildEntries() {
    const order = this.data.order || {}
    const groups = (this.data.entryGroups || []).map((g) => {
      let items = g.items.slice()
      const ord = Array.isArray(order[g.key]) ? order[g.key] : []
      if (ord.length) {
        const baseIdx = {}
        g.items.forEach((it, i) => { baseIdx[it.to] = i })
        items = items.slice().sort((a, b) => {
          let ia = ord.indexOf(a.to)
          let ib = ord.indexOf(b.to)
          if (ia === -1) ia = 9999 + (baseIdx[a.to] || 0)
          if (ib === -1) ib = 9999 + (baseIdx[b.to] || 0)
          return ia - ib
        })
      }
      return { key: g.key, title: g.title, emoji: g.emoji, tint: g.tint, items }
    })
    this.setData({ viewGroups: groups })
  },
  toggleEdit() { this.setData({ editing: !this.data.editing }); this.saveEntryCfg() },
  toggleHidden(e) {
    const to = e.currentTarget.dataset.to
    if (!to) return
    const hidden = Object.assign({}, this.data.hidden)
    hidden[to] = !hidden[to]
    this.setData({ hidden })
    this.saveEntryCfg()
  },
  toggleCollapse(e) {
    if (this.data.editing) return
    const key = e.currentTarget.dataset.key
    if (!key) return
    const collapsed = Object.assign({}, this.data.collapsed)
    collapsed[key] = !collapsed[key]
    this.setData({ collapsed })
    this.saveEntryCfg()
  },
  resetEntries() {
    this.setData({ hidden: {}, collapsed: {}, order: {} }, () => this.rebuildEntries())
    this.saveEntryCfg()
    wx.showToast({ title: '已恢复默认', icon: 'none' })
  },
  onEntryTap(e) {
    if (this._justDragged) return
    if (this.data.editing) { this.toggleHidden(e); return }
    this.onEntry(e)
  },

  // ===== 编辑态长按拖动排序 =====
  onDragStart(e) {
    if (!this.data.editing) return
    const ds = e.currentTarget.dataset
    const to = ds.to
    const group = ds.group
    const g = (this.data.viewGroups || []).find((v) => v.key === group)
    if (!g) return
    const it = g.items.find((x) => x.to === to)
    if (!it) return
    const touch = (e.touches && e.touches[0]) || null
    this._justDragged = true
    this.setData({
      drag: {
        active: true, to, group,
        x: touch ? touch.clientX - 40 : 0,
        y: touch ? touch.clientY - 40 : 0,
        icon: it.icon, label: it.label, tint: g.tint
      }
    })
    wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    this.measureDrag(group)
  },
  measureDrag(group) {
    wx.createSelectorQuery()
      .select('#fg-' + group).boundingClientRect()
      .selectAll('.fgi-' + group).boundingClientRect()
      .exec((res) => {
        const grid = res && res[0]
        const rects = (res && res[1]) || []
        if (!grid || !rects.length) { this._dragGeo = null; return }
        let cellH = rects[0].height + 8
        if (rects.length > 4) cellH = rects[4].top - rects[0].top
        this._dragGeo = { left: grid.left, top: grid.top, cellW: grid.width / 4, cellH, count: rects.length }
      })
  },
  onDragMove(e) {
    const drag = this.data.drag
    if (!drag || !drag.active) return
    const touch = e.touches && e.touches[0]
    if (!touch) return
    this.setData({ 'drag.x': touch.clientX - 40, 'drag.y': touch.clientY - 40 })
    const geo = this._dragGeo
    if (!geo) return
    let col = Math.floor((touch.clientX - geo.left) / geo.cellW)
    let row = Math.floor((touch.clientY - geo.top) / geo.cellH)
    col = Math.max(0, Math.min(3, col))
    row = Math.max(0, row)
    let slot = row * 4 + col
    if (slot > geo.count - 1) slot = geo.count - 1
    if (slot < 0) slot = 0
    const dragTo = drag.to
    const g = (this.data.viewGroups || []).find((v) => v.key === drag.group)
    if (!g) return
    const arr = g.items.map((it) => it.to)
    const cur = arr.indexOf(dragTo)
    if (cur < 0 || cur === slot) return
    arr.splice(cur, 1)
    arr.splice(slot, 0, dragTo)
    const order = Object.assign({}, this.data.order)
    order[drag.group] = arr
    this.setData({ order }, () => this.rebuildEntries())
  },
  onDragEnd() {
    const drag = this.data.drag
    if (!drag || !drag.active) return
    this.setData({ drag: { active: false } })
    this._dragGeo = null
    this.saveEntryCfg()
    setTimeout(() => { this._justDragged = false }, 320)
  },
  hideDeco() { this.setData({ showDeco: false }) },
  hideMascot() { this.setData({ showMascot: false }) },
  onEntry(e) {
    const to = e.currentTarget.dataset.to
    if (to && typeof this[to] === 'function') this[to]()
  },

  onLoad() {
    this.rebuildEntries()
  },

  onShow() {
    this.loadEntryCfg()
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
