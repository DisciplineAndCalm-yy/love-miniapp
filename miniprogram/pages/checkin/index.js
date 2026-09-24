const { todayKey } = require('../../utils/date')
const { requireCouple, uploadImage, fileIDToURL, fileIDsToURLs, callApi } = require('../../utils/cloud')
const { MOOD_LIST, moodLabel, MOOD_MAP, QUICK_CHECKINS } = require('../../utils/mood')

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
    this.setData({
      paired: true,
      mine,
      partner,
      partnerName: (partner && partner.authorName) || (partnerInfo && partnerInfo.nickName) || 'TA',
      partnerInitial: (partner && partner.initial) || '♡',
      partnerMoodLabel: (partner && partner.moodLabel) || '',
      partnerAvatarUrl: (partner && (partner.authorAvatarUrl || partner.authorAvatar)) || '',
      partnerPhotoUrl: (partner && (partner.photoUrl || partner.photo)) || '',
      mood: (mine && mine.mood) || 'love',
      content: (mine && mine.content) || '',
      photo: (mine && mine.photo) || '',
      streaks
    })
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
      wx.showLoading({ title: '上传中…' })
      const photo = await uploadImage()
      // fileID 在部分机型直接渲染会空白,换成 https 临时链接反显
      const photoUrl = await fileIDToURL(photo)
      wx.hideLoading()
      this.setData({ photo, photoUrl })
      wx.showToast({ title: '已添加 ♡', icon: 'none' })
    } catch (err) {
      const msg = String((err && (err.errMsg || err.message)) || '')
      if (msg.includes('cancel')) return
      if (msg.startsWith('upload:')) {
        wx.showToast({ title: '上传失败,检查网络或云存储权限', icon: 'none', duration: 2500 })
      } else {
        wx.showToast({ title: '没能打开相册,再试一次', icon: 'none' })
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
      this.load()
    } catch (err) {
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  }
})
