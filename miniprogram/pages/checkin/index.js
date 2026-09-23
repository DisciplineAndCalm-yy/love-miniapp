const { todayKey } = require('../../utils/date')
const { requireCouple, uploadImage, callApi } = require('../../utils/cloud')

const MOODS = [
  { id: 'love', label: '爱你' },
  { id: 'miss', label: '想你' },
  { id: 'calm', label: '平静' },
  { id: 'busy', label: '忙碌' },
  { id: 'sad', label: '难过' }
]

Page({
  data: {
    moods: MOODS,
    mood: 'love',
    content: '',
    photo: '',
    mine: null,
    partner: null,
    streaks: { mine: 0, partner: 0, together: 0 },
    saving: false
  },

  onShow() {
    this.load()
  },

  async load() {
    const app = getApp()
    await app.whenReady()
    const couple = app.globalData.couple
    if (!couple) {
      this.setData({ mine: null, partner: null, streaks: { mine: 0, partner: 0, together: 0 } })
      return
    }
    const today = todayKey()
    const { data } = await app.db().collection('checkins').where({
      coupleId: couple._id,
      dateKey: today
    }).get()
    const openid = app.globalData.openid
    const mine = data.find((item) => item._openid === openid) || null
    const partner = data.find((item) => item._openid !== openid) || null
    let streaks = this.data.streaks
    try {
      const stats = await callApi('getStreaks', {}, { silent: true })
      streaks = stats.streaks
    } catch (err) {
      console.warn(err)
    }
    this.setData({
      mine,
      partner,
      mood: (mine && mine.mood) || 'love',
      content: (mine && mine.content) || '',
      photo: (mine && mine.photo) || '',
      streaks
    })
  },

  onMood(e) {
    this.setData({ mood: e.currentTarget.dataset.id })
  },

  onContent(e) {
    this.setData({ content: e.detail.value })
  },

  async onPickPhoto() {
    try {
      const photo = await uploadImage()
      this.setData({ photo })
    } catch (err) {
      if (err && err.errMsg && err.errMsg.includes('cancel')) return
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  async onSubmit() {
    if (!requireCouple()) return
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const res = await callApi('saveCheckin', {
        mood: this.data.mood,
        content: this.data.content.trim(),
        photo: this.data.photo
      })
      this.setData({ streaks: res.streaks })
      wx.showToast({ title: '记下了' })
      this.load()
    } catch (err) {
      console.error(err)
    } finally {
      this.setData({ saving: false })
    }
  }
})
