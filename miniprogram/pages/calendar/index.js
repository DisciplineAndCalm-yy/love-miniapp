const { todayKey, buildMonthCells } = require('../../utils/date')
const { callApi } = require('../../utils/cloud')
const { MOOD_LIST } = require('../../utils/mood')
const interact = require('../../utils/interact')
const cache = require('../../utils/cache')

const pad2 = (n) => String(n).padStart(2, '0')
const MOOD_ICON = {}
MOOD_LIST.forEach((m) => { MOOD_ICON[m.id] = m.icon })

const FESTIVALS = [
  { title: '情人节', mmdd: '02-14', emoji: '💘' },
  { title: '520', mmdd: '05-20', emoji: '💗' },
  { title: '儿童节', mmdd: '06-01', emoji: '🎈' },
  { title: '双十一', mmdd: '11-11', emoji: '🛍️' },
  { title: '圣诞', mmdd: '12-25', emoji: '🎄' },
  { title: '跨年', mmdd: '12-31', emoji: '🎆' }
]

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
    cellMeta: {},
    dayCheckins: [],
    dayAnnis: [],
    dayMoments: [],
    dayNights: [],
    dayTodos: [],
    dayCapsulesCount: 0,
    dayIsPeriod: false,
    paired: false,
    monthSummary: { mine: 0, partner: 0, together: 0 },
    themeBg: '#FFF1F4',
    viewMode: 'month',
    bursts: [],
    layers: { checkin: true, anno: true, moment: true, night: true, todo: true, capsule: true, period: true },
    reminders: [],
    summary: { checkinDays: 0, together: 0, moments: 0, nights: 0, places: [], topMood: '' },
    yearMonths: [],
    timeline: [],
    showDetail: false,
    detail: null,
    detailComments: [],
    detailLikeCount: 0,
    detailLikedByMe: false,
    detailReactions: [],
    detailEmojis: ['❤️', '😘', '🥰', '👏', '😂'],
    detailInput: '',
    detailReplyTo: { id: '', name: '' },
    detailSending: false
  },

  onShow() {
    const app = getApp()
    try {
      const th = require('../../utils/theme').themeById(app.globalData.theme || 'sakura')
      this.setData({ themeBg: (th.palette && th.palette.bg) || '#FFF1F4' })
      app.applyTheme(app.globalData.theme)
    } catch (e) {}
    const now = new Date()
    if (!this.data.year) {
      this.setData({
        year: now.getFullYear(),
        month: now.getMonth(),
        today: todayKey(),
        selected: todayKey()
      })
    }
    if (this.data.viewMode === 'year') this.renderYear()
    else this.render()
  },

  onPullDownRefresh() {
    const p = this.data.viewMode === 'year' ? this.renderYear() : this.render(true)
    Promise.resolve(p).finally(() => wx.stopPullDownRefresh())
  },

  async render(force) {
    const { year, month } = this.data
    const skey = `${year}-${month}`
    if (!force && this._lastRenderKey === skey && this._lastRenderAt && Date.now() - this._lastRenderAt < 8000) return
    this._lastRenderKey = skey
    this._lastRenderAt = Date.now()
    const cells = buildMonthCells(year, month)
    const monthLabel = `${year} 年 ${month + 1} 月`
    this.setData({ cells, monthLabel })

    if (!force) {
      const c = cache.get('cal_' + skey)
      if (c && c.data) {
        this._annis = c.data.annis || []
        this._checkins = c.data.checkins || []
        this.setData({
          checkinMap: c.data.checkinMap || {},
          anniMap: c.data.anniMap || {},
          paired: !!c.data.paired,
          monthSummary: c.data.monthSummary || this.data.monthSummary
        })
        this.refreshDay()
      }
    }

    const app = getApp()
    await app.whenReady()
    const couple = app.globalData.couple
    if (!couple) {
      this._annis = []
      this._checkins = []
      this._moments = {}
      this._todos = []
      this._capsules = []
      this._periodSet = new Set()
      this._nightsByDay = {}
      this._todosByDay = {}
      this._capsulesByDay = {}
      this.setData({ checkinMap: {}, anniMap: {}, paired: false, cellMeta: {}, periodDays: [] })
      this.refreshDay()
      return
    }

    const start = `${year}-${pad2(month + 1)}-01`
    const endDay = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${pad2(month + 1)}-${pad2(endDay)}`

    const [ckRes, anniRes, extrasRes] = await Promise.all([
      callApi('listMonthCheckins', { start, end }, { silent: true }).catch(() => ({})),
      callApi('listAnnis', {}, { silent: true }).catch(() => ({})),
      callApi('calendarExtras', { start, end }, { silent: true }).catch(() => ({}))
    ])
    const checkinList = ckRes.list || []
    const annis = anniRes.list || []

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

    const anniMap = {}
    const mm = pad2(month + 1)
    annis.forEach((item) => {
      const itemMmDd = String(item.date || '').slice(5)
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

    // 扩展数据
    this._moments = extrasRes.momentsByDay || {}
    this._todos = extrasRes.todos || []
    this._capsules = extrasRes.capsules || []
    this._periodSet = new Set(extrasRes.periodDays || [])
    this._nightsByDay = {}
    ;(extrasRes.nights || []).forEach((n) => { this._nightsByDay[n.dateKey] = n.words || [] })
    this._todosByDay = {}
    this._todos.forEach((t) => { (this._todosByDay[t.dateKey] = this._todosByDay[t.dateKey] || []).push(t) })
    this._capsulesByDay = {}
    this._capsules.forEach((c) => { (this._capsulesByDay[c.dateKey] = this._capsulesByDay[c.dateKey] || []).push(c) })
    this._memberNames = extrasRes.memberNames || {}

    this._annis = annis
    this._checkins = checkinList
    this.setData({ checkinMap, anniMap, paired: true, monthSummary, periodDays: extrasRes.periodDays || [] })
    cache.set('cal_' + skey, { annis, checkins: checkinList, checkinMap, anniMap, paired: true, monthSummary })
    this.buildMeta()
    this.buildTimeline()
    this.buildSummary()
    this.buildReminders()
    this.refreshDay()
  },

  buildMeta() {
    const meta = {}
    const m = (k) => {
      if (!meta[k]) meta[k] = { mine: false, partner: false, anno: 0, annoEmoji: '', moment: 0, night: 0, todo: 0, capsule: 0, period: false, mood: '' }
      return meta[k]
    }
    const myOpenid = (getApp().globalData || {}).openid
    ;(this._checkins || []).forEach((c) => {
      const x = m(c.dateKey)
      if (c.isMine || c._openid === myOpenid) x.mine = true
      else x.partner = true
      if (c.mood) x.mood = c.mood
    })
    const anniMap = this.data.anniMap || {}
    Object.keys(anniMap).forEach((k) => {
      const x = m(k)
      x.anno = (anniMap[k] || []).length
      const a = (anniMap[k] || [])[0]
      x.annoEmoji = (a && a.emoji) || '♡'
    })
    Object.keys(this._moments || {}).forEach((k) => { m(k).moment = (this._moments[k] || []).length })
    Object.keys(this._nightsByDay || {}).forEach((k) => { m(k).night = (this._nightsByDay[k] || []).length })
    Object.keys(this._todosByDay || {}).forEach((k) => { m(k).todo = (this._todosByDay[k] || []).length })
    Object.keys(this._capsulesByDay || {}).forEach((k) => { m(k).capsule = (this._capsulesByDay[k] || []).length })
    ;(this.data.periodDays || []).forEach((k) => { m(k).period = true })
    this.setData({ cellMeta: meta })
  },

  buildTimeline() {
    const days = {}
    const ensure = (k) => {
      if (!days[k]) days[k] = { dateKey: k, checkins: [], moments: [], night: [], todos: [], capsule: 0, annis: [] }
      return days[k]
    }
    ;(this._checkins || []).forEach((c) => ensure(c.dateKey).checkins.push(c))
    const anniMap = this.data.anniMap || {}
    Object.keys(anniMap).forEach((k) => { ensure(k).annis = anniMap[k] || [] })
    Object.keys(this._moments || {}).forEach((k) => { ensure(k).moments = this._moments[k] || [] })
    Object.keys(this._nightsByDay || {}).forEach((k) => { ensure(k).night = this._nightsByDay[k] || [] })
    Object.keys(this._todosByDay || {}).forEach((k) => { ensure(k).todos = this._todosByDay[k] || [] })
    Object.keys(this._capsulesByDay || {}).forEach((k) => { ensure(k).capsule = (this._capsulesByDay[k] || []).length })
    const arr = Object.keys(days).sort((a, b) => (a < b ? 1 : -1)).map((k) => {
      const d = days[k]
      d.count = d.checkins.length + d.moments.length + d.night.length + d.todos.length + (d.capsule ? 1 : 0) + d.annis.length
      d.mmdd = k.slice(5)
      return d
    })
    this.setData({ timeline: arr })
  },

  buildSummary() {
    const set = new Set()
    const together = {}
    const places = new Set()
    const moods = {}
    ;(this._checkins || []).forEach((c) => {
      set.add(c.dateKey)
      together[c.dateKey] = together[c.dateKey] || new Set()
      together[c.dateKey].add(c._openid)
      if (c.place) places.add(c.place)
      if (c.mood) moods[c.mood] = (moods[c.mood] || 0) + 1
    })
    let togetherDays = 0
    Object.keys(together).forEach((k) => { if (together[k].size >= 2) togetherDays += 1 })
    let moments = 0
    Object.keys(this._moments || {}).forEach((k) => {
      const list = this._moments[k] || []
      moments += list.length
      list.forEach((mm) => { if (mm.place) places.add(mm.place) })
    })
    let nights = 0
    Object.keys(this._nightsByDay || {}).forEach((k) => { if ((this._nightsByDay[k] || []).length) nights += 1 })
    let topMood = ''
    let top = 0
    Object.keys(moods).forEach((mk) => { if (moods[mk] > top) { top = moods[mk]; topMood = mk } })
    this.setData({
      summary: {
        checkinDays: set.size,
        together: togetherDays,
        moments,
        nights,
        places: [...places].slice(0, 8),
        topMood,
        topMoodIcon: MOOD_ICON[topMood] || '♡'
      }
    })
  },

  buildReminders() {
    const today = todayKey()
    const list = []
    const anniMap = this.data.anniMap || {}
    Object.keys(anniMap).forEach((k) => {
      if (k >= today) (anniMap[k] || []).forEach((a) => list.push({ dateKey: k, icon: a.emoji || '🎈', text: a.title }))
    })
    ;(this._todos || []).forEach((t) => { if (!t.done && t.dateKey >= today) list.push({ dateKey: t.dateKey, icon: '📝', text: '待办到期：' + t.text }) })
    ;(this._capsules || []).forEach((c) => { if (c.dateKey >= today) list.push({ dateKey: c.dateKey, icon: '📦', text: '时间胶囊可以拆啦' }) })
    list.sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1))
    this.setData({ reminders: list.slice(0, 4) })
  },

  refreshDay() {
    const key = this.data.selected
    const dayCheckins = (this._checkins || []).filter((item) => item.dateKey === key)
    const dayAnnis = (this.data.anniMap && this.data.anniMap[key]) || []
    const dayMoments = (this._moments && this._moments[key]) || []
    const dayNights = (this._nightsByDay && this._nightsByDay[key]) || []
    const dayTodos = (this._todosByDay && this._todosByDay[key]) || []
    const dayCapsules = (this._capsulesByDay && this._capsulesByDay[key]) || []
    this.setData({
      dayCheckins,
      dayAnnis,
      dayMoments,
      dayNights,
      dayTodos,
      dayCapsulesCount: dayCapsules.length,
      dayIsPeriod: !!(this._periodSet && this._periodSet.has(key))
    })
  },

  switchView(e) {
    const mode = e.currentTarget.dataset.mode
    if (!mode || mode === this.data.viewMode) return
    this.setData({ viewMode: mode })
    if (mode === 'year') this.renderYear()
    if (mode === 'timeline') this.buildTimeline()
    if (mode === 'month') this.render()
  },

  toggleLayer(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    const layers = Object.assign({}, this.data.layers)
    layers[key] = !layers[key]
    this.setData({ layers })
  },

  async renderYear() {
    const year = this.data.year || new Date().getFullYear()
    this.setData({ year })
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    let list = []
    try {
      const res = await callApi('listMonthCheckins', { start, end }, { silent: true })
      list = res.list || []
    } catch (e) { list = [] }
    const counts = {}
    list.forEach((c) => { counts[c.dateKey] = (counts[c.dateKey] || 0) + 1 })
    const months = []
    for (let mo = 0; mo < 12; mo += 1) {
      const dim = new Date(year, mo + 1, 0).getDate()
      const cells = []
      for (let d = 1; d <= dim; d += 1) {
        const key = `${year}-${pad2(mo + 1)}-${pad2(d)}`
        const cnt = counts[key] || 0
        cells.push({ day: d, dateKey: key, level: cnt >= 2 ? 3 : (cnt === 1 ? 2 : 0) })
      }
      months.push({ month: mo, label: `${mo + 1} 月`, cells })
    }
    this.setData({ yearMonths: months })
  },

  selectYearMonth(e) {
    const month = Number(e.currentTarget.dataset.month)
    if (!Number.isFinite(month)) return
    this.setData({ month, viewMode: 'month' })
    this.render(true)
  },

  selectYearDay(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    const month = Number(key.slice(5, 7)) - 1
    this.setData({ month, selected: key, viewMode: 'month' })
    this.render(true)
  },

  addFestival() {
    wx.showActionSheet({
      itemList: FESTIVALS.map((f) => `${f.emoji} ${f.title}（${f.mmdd.replace('-', '/')}）`),
      success: async (r) => {
        const fest = FESTIVALS[r.tapIndex]
        if (!fest) return
        const year = this.data.year || new Date().getFullYear()
        try {
          await callApi('saveAnniversary', {
            title: fest.title,
            date: `${year}-${fest.mmdd}`,
            repeatYearly: true,
            emoji: fest.emoji,
            color: '#E86A7A',
            note: ''
          })
          wx.showToast({ title: '已加入纪念日 ♡', icon: 'none' })
          this.render(true)
        } catch (e) {}
      }
    })
  },

  prevMonth() {
    let { year, month } = this.data
    month -= 1
    if (month < 0) { month = 11; year -= 1 }
    this.setData({ year, month, viewMode: 'month' })
    this.render()
  },

  nextMonth() {
    let { year, month } = this.data
    month += 1
    if (month > 11) { month = 0; year += 1 }
    this.setData({ year, month, viewMode: 'month' })
    this.render()
  },

  selectDay(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ selected: key })
    this.refreshDay()
  },

  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    const urls = (this.data.dayCheckins || []).map((c) => c.photoUrl || c.photo).filter(Boolean)
    wx.previewImage({ urls: urls.length ? urls : [url], current: url })
  },

  previewMomentPhoto(e) {
    const url = e.currentTarget.dataset.url
    const urls = []
    ;(this.data.dayMoments || []).forEach((mm) => (mm.photoUrls || []).forEach((u) => { if (u) urls.push(u) }))
    wx.previewImage({ urls: urls.length ? urls : [url], current: url })
  },

  avatarError(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      dayCheckins: (this.data.dayCheckins || []).map((c) => (c._id === id ? { ...c, authorAvatarUrl: '' } : c))
    })
  },

  photoError(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      dayCheckins: (this.data.dayCheckins || []).map((c) => (c._id === id ? { ...c, photoUrl: '' } : c))
    })
  },

  noop() {},

  openCheckinDetail(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.data.dayCheckins || []).find((c) => c._id === id)
    if (!item) return
    this.setData({
      showDetail: true,
      detail: item,
      detailComments: [],
      detailLikeCount: item.likeCount || 0,
      detailLikedByMe: !!item.likedByMe,
      detailReactions: [],
      detailInput: '',
      detailReplyTo: { id: '', name: '' }
    })
    this.loadCheckinInteractions(id)
  },
  closeCheckinDetail() { this.setData({ showDetail: false }) },
  async loadCheckinInteractions(id) {
    if (!id) return
    try {
      const res = await interact.listInteractions('checkin', id)
      this.setData({
        detailLikeCount: res.likeCount || 0,
        detailLikedByMe: !!res.likedByMe,
        detailComments: interact.decorateComments(res.comments),
        detailReactions: res.reactions || []
      })
      this.setData({
        dayCheckins: (this.data.dayCheckins || []).map((c) => (c._id === id ? { ...c, likeCount: res.likeCount || 0, commentCount: (res.comments || []).length } : c))
      })
    } catch (e) {}
  },
  async toggleDetailLike() {
    const d = this.data.detail
    if (!d || this.detailLiking) return
    this.detailLiking = true
    try {
      const res = await interact.toggleLike('checkin', d._id)
      this.setData({ detailLikedByMe: res.liked, detailLikeCount: res.likeCount })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    } catch (e) {} finally { this.detailLiking = false }
  },
  async toggleDetailReaction(e) {
    const d = this.data.detail
    const emoji = e.currentTarget.dataset.emoji
    if (!d || !emoji) return
    try {
      const res = await interact.toggleReaction('checkin', d._id, emoji)
      this.setData({ detailReactions: res.reactions || [] })
    } catch (e) {}
  },
  onDetailReply(e) {
    this.setData({ detailReplyTo: { id: e.currentTarget.dataset.id, name: e.currentTarget.dataset.name } })
  },
  cancelDetailReply() { this.setData({ detailReplyTo: { id: '', name: '' } }) },
  onDetailAt() {
    const name = (this.data.detail && this.data.detail.authorName) || 'TA'
    const cur = this.data.detailInput || ''
    const sep = cur && !/\s$/.test(cur) ? ' ' : ''
    this.setData({ detailInput: cur + sep + '@' + name + ' ' })
  },
  onDetailInput(e) { this.setData({ detailInput: e.detail.value }) },
  async sendDetailComment() {
    const d = this.data.detail
    const content = (this.data.detailInput || '').trim()
    if (!d || !content || this.data.detailSending) return
    this.setData({ detailSending: true })
    const reply = this.data.detailReplyTo || { id: '', name: '' }
    try {
      const res = await interact.addComment('checkin', d._id, content, reply.id, reply.name)
      const c = { ...res.comment, timeText: interact.relativeTime(res.comment.createdAt) }
      this.setData({
        detailComments: this.data.detailComments.concat(c),
        detailInput: '',
        detailReplyTo: { id: '', name: '' },
        dayCheckins: (this.data.dayCheckins || []).map((x) => (x._id === d._id ? { ...x, commentCount: (x.commentCount || 0) + 1 } : x))
      })
    } catch (e) {} finally { this.setData({ detailSending: false }) }
  },
  removeDetailComment(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条评论？', confirmColor: '#c94b5c',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await interact.removeComment(id)
          this.setData({ detailComments: this.data.detailComments.filter((c) => c._id !== id) })
        } catch (err) {}
      }
    })
  },
  previewDetailPhoto() {
    const d = this.data.detail
    if (!d) return
    const url = d.photoUrl || d.photo
    if (url) wx.previewImage({ urls: [url], current: url })
  },

  heartBurst(e) {
    let x = 375
    let y = 640
    const t = (e && e.changedTouches && e.changedTouches[0]) || (e && e.touches && e.touches[0])
    if (t && typeof t.clientX === 'number') { x = t.clientX; y = t.clientY }
    else if (e && e.detail && typeof e.detail.x === 'number') { x = e.detail.x; y = e.detail.y }
    const id = Date.now() + '-' + Math.floor(Math.random() * 1000)
    this.setData({ bursts: (this.data.bursts || []).concat([{ id, x, y }]) })
    setTimeout(() => {
      this.setData({ bursts: (this.data.bursts || []).filter((b) => b.id !== id) })
    }, 1200)
  },

  generatePoster(e) {
    this.heartBurst(e)
    const cells = this.data.cells || []
    if (!cells.length) { wx.showToast({ title: '先切到月视图再生成', icon: 'none' }); return }
    wx.showLoading({ title: '生成中…' })
    const rows = Math.max(5, Math.ceil(cells.length / 7))
    const W = 750
    const H = 334 + rows * 80 + 350
    wx.createSelectorQuery().select('#calCanvas').fields({ node: true, size: true }).exec((res) => {
      const info = res && res[0]
      if (!info || !info.node) { wx.hideLoading(); wx.showToast({ title: '画布未就绪', icon: 'none' }); return }
      const canvas = info.node
      const ctx = canvas.getContext('2d')
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const dpr = win.pixelRatio || 2
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
      this._posterCanvas = canvas
      try {
        this.paintPoster(ctx, W, H, rows)
        setTimeout(() => this.savePoster(), 150)
      } catch (e) {
        wx.hideLoading()
        wx.showToast({ title: '生成失败，可截屏', icon: 'none' })
      }
    })
  },

  rr(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  },

  paintPoster(ctx, W, H, rows) {
    const data = this.data
    const meta = data.cellMeta || {}
    const pad = 40
    const bg = ctx.createLinearGradient(0, 0, W, H)
    bg.addColorStop(0, '#FFF6F1'); bg.addColorStop(0.5, '#FFF0F4'); bg.addColorStop(1, '#F3F0FF')
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    this.rr(ctx, pad - 12, 24, W - (pad - 12) * 2, H - 48, 36); ctx.fill()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#C9777F'; ctx.font = 'bold 26px sans-serif'
    ctx.fillText('♡ 我们的日历 ♡', W / 2, 78)
    ctx.fillStyle = '#4A3236'; ctx.font = 'bold 48px sans-serif'
    ctx.fillText(data.monthLabel || '', W / 2, 132)

    const gap = 16
    const pillW = (W - pad * 2 - gap * 2) / 3
    const py = 158
    const pills = [
      { n: data.monthSummary.mine, l: '我的签到' },
      { n: data.monthSummary.partner, l: 'TA 的签到' },
      { n: data.monthSummary.together, l: '同一天' }
    ]
    pills.forEach((p, i) => {
      const x = pad + i * (pillW + gap)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      this.rr(ctx, x, py, pillW, 92, 18); ctx.fill()
      ctx.fillStyle = '#D14E64'; ctx.font = 'bold 40px sans-serif'
      ctx.fillText(String(p.n || 0), x + pillW / 2, py + 46)
      ctx.fillStyle = '#B79497'; ctx.font = '22px sans-serif'
      ctx.fillText(p.l, x + pillW / 2, py + 76)
    })

    const gridTop = 300
    const colW = (W - pad * 2) / 7
    const cellH = 80
    const weeks = ['日', '一', '二', '三', '四', '五', '六']
    ctx.textAlign = 'center'
    ctx.fillStyle = '#9a7f82'; ctx.font = 'bold 22px sans-serif'
    weeks.forEach((w, i) => ctx.fillText(w, pad + colW * i + colW / 2, gridTop + 24))

    const cellsTop = gridTop + 40
    const cells = data.cells || []
    cells.forEach((item, idx) => {
      if (!item || !item.day) return
      const col = idx % 7
      const row = Math.floor(idx / 7)
      const cx = pad + col * colW
      const cy = cellsTop + row * cellH
      const key = item.dateKey
      const m = meta[key]
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      this.rr(ctx, cx + 2, cy + 2, colW - 4, cellH - 6, 14); ctx.fill()
      if (m && (m.mine || m.partner)) {
        ctx.fillStyle = (m.partner && !m.mine) ? '#DCE6FF' : '#FFDDE6'
        this.rr(ctx, cx + 2, cy + 2, colW - 4, cellH - 6, 14); ctx.fill()
      }
      if (key === data.today) {
        ctx.strokeStyle = '#E14E68'; ctx.lineWidth = 3
        this.rr(ctx, cx + 2, cy + 2, colW - 4, cellH - 6, 14); ctx.stroke()
      }
      ctx.fillStyle = key === data.today ? '#E14E68' : '#4A3236'
      ctx.font = (key === data.today ? 'bold ' : '') + '24px sans-serif'
      ctx.fillText(String(item.day), cx + colW / 2, cy + 32)
      if (m) {
        const dots = []
        if (m.mine) dots.push('#e86a7a')
        if (m.partner) dots.push('#5B8DEF')
        if (m.anno) dots.push('#d4a574')
        if (m.moment) dots.push('#57b98a')
        if (m.night) dots.push('#9b7bd4')
        if (m.todo) dots.push('#e79a3c')
        if (m.capsule) dots.push('#3fb6c4')
        const show = dots.slice(0, 4)
        const gapD = 12
        const startX = cx + colW / 2 - ((show.length - 1) * gapD) / 2
        show.forEach((c, i) => {
          ctx.beginPath()
          ctx.fillStyle = c
          ctx.arc(startX + i * gapD, cy + cellH - 20, 4, 0, Math.PI * 2)
          ctx.fill()
        })
      }
    })

    let y = cellsTop + rows * cellH + 24
    ctx.textAlign = 'left'
    ctx.font = '20px sans-serif'; ctx.fillStyle = '#9a7f82'
    ctx.fillText('• 粉=签到  • 金=纪念日  • 绿=动态  • 紫=晚安', pad + 4, y)
    y += 36

    ctx.fillStyle = '#C9405A'; ctx.font = 'bold 30px sans-serif'
    ctx.fillText('本月小结 ♡', pad + 4, y + 26)
    y += 46
    const s = data.summary || {}
    const stats = [
      { n: s.checkinDays || 0, l: '一起打卡' },
      { n: s.together || 0, l: '同日签到' },
      { n: s.moments || 0, l: '动态' },
      { n: s.nights || 0, l: '晚安' }
    ]
    const sw = (W - pad * 2) / 4
    stats.forEach((st, i) => {
      const x = pad + i * sw + sw / 2
      ctx.textAlign = 'center'
      ctx.fillStyle = '#D14E64'; ctx.font = 'bold 38px sans-serif'
      ctx.fillText(String(st.n), x, y + 34)
      ctx.fillStyle = '#B79497'; ctx.font = '20px sans-serif'
      ctx.fillText(st.l, x, y + 62)
    })
    y += 92

    ctx.textAlign = 'left'
    if (s.topMood) {
      ctx.fillStyle = '#7A5A5F'; ctx.font = 'bold 24px sans-serif'
      ctx.fillText('最常心情：' + (s.topMoodIcon || '') + ' ' + s.topMood, pad + 4, y)
      y += 40
    }
    if (s.places && s.places.length) {
      ctx.fillStyle = '#7A5A5F'; ctx.font = 'bold 24px sans-serif'
      const placesText = '足迹：' + s.places.map((p) => '📍' + p).join('  ')
      const wrapped = this.wrapText(ctx, placesText, W - pad * 2 - 8)
      wrapped.forEach((line) => { ctx.fillText(line, pad + 4, y); y += 34 })
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = '#C0A3A7'; ctx.font = '22px sans-serif'
    ctx.fillText('一起把每一天写进我们的日历 ♡', W / 2, H - 54)
  },

  wrapText(ctx, text, maxWidth) {
    const lines = []
    let line = ''
    for (const ch of String(text)) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch }
      else line = test
    }
    if (line) lines.push(line)
    return lines
  },

  savePoster() {
    const canvas = this._posterCanvas
    if (!canvas) { wx.hideLoading(); return }
    wx.canvasToTempFilePath({
      canvas,
      success: (r) => {
        wx.hideLoading()
        const tmp = r.tempFilePath
        wx.saveImageToPhotosAlbum({
          filePath: tmp,
          success: () => wx.showToast({ title: '长图已存到相册 ♡' }),
          fail: (err) => {
            const msg = String((err && err.errMsg) || '')
            if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
              wx.showModal({
                title: '需要相册权限',
                content: '请在设置里允许「保存到相册」后重试',
                confirmText: '去设置',
                success: (mm) => { if (mm.confirm) wx.openSetting({}) }
              })
            } else {
              wx.previewImage({ urls: [tmp], current: tmp })
            }
          }
        })
      },
      fail: () => { wx.hideLoading(); wx.showToast({ title: '生成失败，可截屏保存', icon: 'none' }) }
    })
  },

  onShareAppMessage() {
    const s = this.data.summary || {}
    const label = this.data.monthLabel || '我们的日历'
    return {
      title: `${label}｜一起打卡 ${s.checkinDays || 0} 天，说了 ${s.nights || 0} 次晚安 ♡`,
      path: '/pages/calendar/index'
    }
  },

  goBind() {
    wx.navigateTo({ url: '/pages/profile/index' })
  }
})
