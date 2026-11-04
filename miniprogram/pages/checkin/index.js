const { todayKey } = require('../../utils/date')
const { requireCouple, uploadImage, fileIDToURL, fileIDsToURLs, callApi } = require('../../utils/cloud')
const interact = require('../../utils/interact')
const { MOOD_LIST, moodLabel, MOOD_MAP, QUICK_CHECKINS } = require('../../utils/mood')
const { dailyPraise } = require('../../utils/praise')
const { themeById } = require('../../utils/theme')
const cache = require('../../utils/cache')

const COND_EMOJI = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', thunder: '⛈️', fog: '🌫️', general: '🌤️' }

Page({
  data: {
    moods: MOOD_LIST,
    moodMap: MOOD_MAP,
    quicks: QUICK_CHECKINS,
    mood: 'love',
    content: '',
    photo: '',
    place: '',
    themeBg: '#FFF1F4',
    mine: null,
    partner: null,
    partnerName: 'TA',
    partnerMoodLabel: '',
    streaks: { mine: 0, partner: 0, together: 0 },
    saving: false,
    paired: false,
    loaded: false,
    weather: null,
    weatherEmoji: '🌤️',
    praise: '',
    // 签到成功撒花
    burst: [],
    // TA 签到卡上的互动
    taComments: [],
    taLikeCount: 0,
    taLikedByMe: false,
    taReactions: [],
    taQuickEmojis: ['😘', '🥰', '😂', '😭', '👏', '🔥'],
    taReplyTo: { id: '', name: '' },
    taCommentInput: '',
    showTaComments: false,
    taSending: false,
    taLiking: false
  },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh())
  },

  async load(force) {
    if (!force && this._lastLoadAt && Date.now() - this._lastLoadAt < 10000) return
    this._lastLoadAt = Date.now()
    const app = getApp()
    await app.whenReady()
    try {
      const palette = (themeById(app.globalData.theme || 'sakura') || {}).palette || {}
      this.setData({ themeBg: palette.bg || '#FFF1F4' })
      app.applyTheme(app.globalData.theme)
    } catch (e) {}
    if (!force) {
      const c = cache.get('checkin')
      if (c && c.data) this.setData(Object.assign({ loaded: true }, c.data))
    }
    let couple = app.globalData.couple
    if (!couple && !app.globalData._coupleFetched) {
      await app.refreshCouple()
      couple = app.globalData.couple
    }
    if (!couple) {
      this.setData({
        paired: false,
        loaded: true,
        mine: null,
        partner: null,
        streaks: { mine: 0, partner: 0, together: 0 }
      })
      return
    }
    const today = todayKey()
    const [todayRes, streakRes] = await Promise.all([
      callApi('todayCheckins', { dateKey: today }, { silent: true }).catch(() => ({})),
      callApi('getStreaks', {}, { silent: true }).catch(() => ({}))
    ])
    const todayList = (todayRes && todayRes.list) || []
    const mine = todayList.find((item) => item.isMine) || null
    const partner = todayList.find((item) => !item.isMine) || null
    const partnerInfo = app.globalData.partner
    const streaks = (streakRes && streakRes.streaks) || this.data.streaks
    const patch = {
      paired: true,
      loaded: true,
      mine,
      partner,
      partnerName: (partner && partner.authorName) || (partnerInfo && partnerInfo.nickName) || 'TA',
      partnerInitial: (partner && partner.initial) || '♡',
      partnerMoodLabel: (partner && partner.moodLabel) || '',
      partnerAvatarUrl: (partner && (partner.authorAvatarUrl || partner.authorAvatar)) || '',
      partnerPhotoUrl: (partner && (partner.photoUrl || partner.photo)) || '',
      streaks
    }
    // 只有「今天已有签到记录」时才回填编辑区。
    // 未签到时若也把 mood/content/photo 重置,从相册/相机返回触发的 onShow→load 会晚于
    // 选图后的 setData 完成,把刚选好的图冲成 '',于是「提示已添加却看不到图」。
    if (mine) {
      patch.mood = mine.mood || 'love'
      patch.content = mine.content || ''
      patch.photo = mine.photo || ''
      patch.photoUrl = mine.photoUrl || ''
      patch.place = mine.place || ''
    }
    this.setData(patch)
    cache.set('checkin', {
      mine, partner,
      partnerName: patch.partnerName, partnerInitial: patch.partnerInitial,
      partnerMoodLabel: patch.partnerMoodLabel, partnerAvatarUrl: patch.partnerAvatarUrl,
      partnerPhotoUrl: patch.partnerPhotoUrl, streaks,
      mood: patch.mood, content: patch.content, photo: patch.photo, photoUrl: patch.photoUrl, place: patch.place
    })
    this.loadWeather(today)
    if (partner) this.loadTaInteractions(partner._id)
  },

  // TA 的签到卡:载入点赞/评论(打开即视为已读)
  async loadTaInteractions(targetId) {
    if (!targetId) return
    try {
      const res = await interact.listInteractions('checkin', targetId)
      this.setData({
        taLikeCount: res.likeCount,
        taLikedByMe: res.likedByMe,
        taComments: interact.decorateComments(res.comments),
        taReactions: res.reactions || []
      })
    } catch (e) {}
  },
  async toggleTaLike() {
    const p = this.data.partner
    if (!p || this.data.taLiking) return
    this.setData({ taLiking: true })
    try {
      const res = await interact.toggleLike('checkin', p._id)
      this.setData({ taLikedByMe: res.liked, taLikeCount: res.likeCount })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    } catch (e) {} finally { this.setData({ taLiking: false }) }
  },
  toggleTaComments() { this.setData({ showTaComments: !this.data.showTaComments }) },
  async toggleTaReaction(e) {
    const p = this.data.partner
    const emoji = e.currentTarget.dataset.emoji
    if (!p || !emoji) return
    try {
      const res = await interact.toggleReaction('checkin', p._id, emoji)
      this.setData({ taReactions: res.reactions || [] })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    } catch (e) {}
  },
  onTaReply(e) {
    this.setData({ taReplyTo: { id: e.currentTarget.dataset.id, name: e.currentTarget.dataset.name } })
  },
  cancelTaReply() { this.setData({ taReplyTo: { id: '', name: '' } }) },
  onTaAt() {
    const name = this.data.partnerName && this.data.partnerName !== 'TA' ? this.data.partnerName : 'TA'
    const cur = this.data.taCommentInput || ''
    const sep = cur && !/\s$/.test(cur) ? ' ' : ''
    this.setData({ taCommentInput: cur + sep + '@' + name + ' ' })
  },
  onTaCommentInput(e) { this.setData({ taCommentInput: e.detail.value }) },
  async sendTaComment() {
    const p = this.data.partner
    const content = (this.data.taCommentInput || '').trim()
    if (!p || !content || this.data.taSending) return
    this.setData({ taSending: true })
    const reply = this.data.taReplyTo || { id: '', name: '' }
    try {
      const res = await interact.addComment('checkin', p._id, content, reply.id, reply.name)
      const c = { ...res.comment, timeText: interact.relativeTime(res.comment.createdAt) }
      this.setData({ taComments: this.data.taComments.concat(c), taCommentInput: '', taReplyTo: { id: '', name: '' }, showTaComments: true })
    } catch (e) {} finally { this.setData({ taSending: false }) }
  },
  removeTaComment(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条评论？', confirmColor: '#c94b5c',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await interact.removeComment(id)
          this.setData({ taComments: this.data.taComments.filter((c) => c._id !== id) })
        } catch (err) {}
      }
    })
  },

  // 今日天气 + 夸夸:与签到融合在同一页;没设城市时静默降级,只留夸夸
  async loadWeather(today) {
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
      praise = dailyPraise(today, 'general')
    }
    this.setData({ weather, weatherEmoji, praise })
  },

  usePraise() {
    const p = this.data.praise
    if (!p) return
    this.setData({ content: p })
    wx.showToast({ title: '已填进寄语 ♡', icon: 'none' })
  },

  goWeather() {
    wx.navigateTo({ url: '/pages/weather/index' })
  },

  onMood(e) {
    this.setData({ mood: e.currentTarget.dataset.id })
  },
  fillQuick(e) {
    this.setData({ content: e.currentTarget.dataset.text })
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
  },

  async onPickPhoto() {
    try {
      wx.showLoading({ title: '上传中…', mask: true })
      const photo = await uploadImage()
      // fileID 在部分机型(尤其 iOS)直接渲染会空白,统一换成 https 临时链接反显
      const photoUrl = await fileIDToURL(photo)
      wx.hideLoading()
      this.setData({ photo, photoUrl })
      wx.showToast({ title: '已添加 ♡', icon: 'none' })
    } catch (err) {
      // 关键:iOS 上 showLoading 未 hide 会把后续 showToast 一起吞掉,表现为“无反应”
      wx.hideLoading()
      const msg = String((err && (err.errMsg || err.message)) || '')
      if (msg.includes('cancel')) return
      if (msg.startsWith('upload:')) {
        wx.showToast({ title: '上传失败,检查网络或云存储权限', icon: 'none', duration: 2500 })
      } else if (/privacy|scope|auth|permission|deny/i.test(msg)) {
        wx.showToast({ title: '请在微信设置里允许相册/相机权限', icon: 'none', duration: 2600 })
      } else {
        wx.showToast({ title: String((err && err.message) || '没能打开相册,再试一次').slice(0, 26), icon: 'none' })
      }
    }
  },

  clearPhoto() {
    this.setData({ photo: '', photoUrl: '' })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/profile/index' })
  },

  goMoments() {
    wx.navigateTo({ url: '/pages/moments/index' })
  },

  choosePlace() {
    wx.chooseLocation({
      success: (res) => {
        const name = (res && (res.name || res.address)) || ''
        if (name) this.setData({ place: String(name).slice(0, 40) })
      },
      fail: (err) => {
        const msg = String((err && err.errMsg) || '')
        if (msg.includes('cancel')) return
        if (msg.includes('auth') || msg.includes('permission') || msg.includes('deny')) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置里允许位置权限后再选择地点',
            confirmText: '去设置',
            success: (r) => { if (r.confirm && wx.openSetting) wx.openSetting({}) }
          })
          return
        }
        wx.showToast({ title: '地图选点不可用', icon: 'none' })
      }
    })
  },
  clearPlace() { this.setData({ place: '' }) },

  goCalendar() {
    wx.switchTab({ url: '/pages/calendar/index' })
  },

  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url], current: url })
  },

  photoError() {
    // 临时链接失效时回落到 fileID 再试一次
    if (this.data.photoUrl) this.setData({ photoUrl: '' })
  },

  partnerPhotoError() {
    if (this.data.partnerPhotoUrl) this.setData({ partnerPhotoUrl: '' })
  },

  partnerAvatarError() {
    if (this.data.partnerAvatarUrl) this.setData({ partnerAvatarUrl: '' })
  },

  async onSubmit() {
    if (!requireCouple()) return
    if (this.data.saving) return
    if (this.data.mine) { wx.showToast({ title: '今天已经签到啦', icon: 'none' }); return }
    this.setData({ saving: true })
    try {
      const res = await callApi('saveCheckin', {
        mood: this.data.mood,
        content: this.data.content.trim(),
        photo: this.data.photo,
        place: this.data.place
      })
      this.setData({ streaks: res.streaks })
      wx.showToast({ title: '已盖章 ♡' })
      this.celebrate()
      this.load(true)
    } catch (err) {
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  },

  celebrate() {
    const icons = ['🌸', '♡', '✨', '💗', '🎀', '⭐']
    this.setData({
      burst: Array.from({ length: 18 }, (_, i) => ({
        id: i,
        t: icons[i % icons.length],
        x: 4 + Math.random() * 92,
        s: 30 + Math.random() * 34,
        d: (1.2 + Math.random() * 1.3).toFixed(2),
        delay: (Math.random() * 0.6).toFixed(2)
      }))
    })
    setTimeout(() => this.setData({ burst: [] }), 2600)
  }
})
