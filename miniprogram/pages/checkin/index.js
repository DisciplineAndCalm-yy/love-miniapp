const { todayKey } = require('../../utils/date')
const { requireCouple, uploadImage, fileIDToURL, fileIDsToURLs, callApi } = require('../../utils/cloud')
const { MOOD_LIST, moodLabel, MOOD_MAP, QUICK_CHECKINS } = require('../../utils/mood')
const { dailyPraise } = require('../../utils/praise')

const COND_EMOJI = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', thunder: '⛈️', fog: '🌫️', general: '🌤️' }

Page({
  data: {
    moods: MOOD_LIST,
    moodMap: MOOD_MAP,
    quicks: QUICK_CHECKINS,
    mood: 'love',
    content: '',
    photo: '',
    mine: null,
    partner: null,
    partnerName: 'TA',
    partnerMoodLabel: '',
    streaks: { mine: 0, partner: 0, together: 0 },
    saving: false,
    paired: false,
    weather: null,
    weatherEmoji: '🌤️',
    praise: '',
    // 签到成功撒花
    burst: []
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
      this.setData({
        paired: false,
        mine: null,
        partner: null,
        streaks: { mine: 0, partner: 0, together: 0 }
      })
      return
    }
    const today = todayKey()
    let todayList = []
    try {
      const res = await callApi('todayCheckins', { dateKey: today }, { silent: true })
      todayList = res.list || []
    } catch (err) {
      console.warn('todayCheckins failed', err)
    }
    const mine = todayList.find((item) => item.isMine) || null
    const partner = todayList.find((item) => !item.isMine) || null
    const partnerInfo = app.globalData.partner
    let streaks = this.data.streaks
    try {
      const stats = await callApi('getStreaks', {}, { silent: true })
      streaks = stats.streaks
    } catch (err) {
      console.warn(err)
    }
    const patch = {
      paired: true,
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
    }
    this.setData(patch)
    this.loadWeather(today)
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
        photo: this.data.photo
      })
      this.setData({ streaks: res.streaks })
      wx.showToast({ title: '已盖章 ♡' })
      this.celebrate()
      this.load()
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
