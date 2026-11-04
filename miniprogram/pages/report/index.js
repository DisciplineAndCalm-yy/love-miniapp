const { callApi, shareCard } = require('../../utils/cloud')

const MOOD_EMOJI = { love: '❤️', miss: '💭', calm: '🌿', busy: '💼', sad: '🌧️' }

Page({
  data: {
    loading: true,
    paired: false,
    myName: '我',
    partnerName: 'TA',
    days: 0,
    togetherSince: '',
    level: null,
    exp: 0,
    chips: [],
    moodDots: [],
    moodDays: 0
  },

  onShow() { this.load() },
  onShareAppMessage() { return shareCard(`我们已经在一起 ${this.data.days || 0} 天啦 ♡`) },
  noop() {},

  async load() {
    const app = getApp()
    await app.whenReady()
    if (!app.globalData.couple) { this.setData({ loading: false, paired: false }); return }
    const user = app.globalData.user || {}
    const partner = app.globalData.partner
    this.setData({ myName: user.nickName || '我', partnerName: (partner && partner.nickName) || 'TA' })
    try {
      const [ov, moods] = await Promise.all([
        callApi('intimacyOverview', {}, { silent: true }),
        callApi('recentMoods', {}, { silent: true })
      ])
      const s = ov.stats || {}
      const chips = [
        { icon: '📆', label: '在一起', value: ov.togetherDays || 0 },
        { icon: '🗓️', label: '签到', value: s.checkinTotal || 0 },
        { icon: '📸', label: '动态', value: s.momentCount || 0 },
        { icon: '💌', label: '文章', value: s.postCount || 0 },
        { icon: '💬', label: '悄悄话', value: s.msgCount || 0 },
        { icon: '🌙', label: '晚安', value: s.nightCount || 0 },
        { icon: '💞', label: '互动', value: s.interactCount || 0 },
        { icon: '🔥', label: '连续签到', value: (s.streaks && s.streaks.mine) || 0 }
      ]
      const moodList = (moods.list || []).slice(0, 28)
      const moodDots = moodList.map((m, i) => ({ emoji: MOOD_EMOJI[m.mood] || '❤️', mine: m.mine, k: (m.dateKey || '') + '_' + i }))
      this.setData({
        loading: false,
        paired: true,
        days: ov.togetherDays || 0,
        level: ov.level || null,
        exp: ov.exp || 0,
        chips,
        moodDots,
        moodDays: moodList.length,
        togetherSince: (app.globalData.couple && app.globalData.couple.togetherSince) || ''
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  savePoster() {
    wx.showToast({ title: '长按图片或直接截屏保存吧 ♡', icon: 'none' })
  },

  goMoodBoard() {
    wx.navigateTo({ url: '/pages/moodboard/index' })
  }
})
