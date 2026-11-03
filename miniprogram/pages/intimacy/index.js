const { callApi, shareCard } = require('../../utils/cloud')

const STAT_META = [
  { key: 'togetherDays', icon: '📆', label: '在一起', unit: '天' },
  { key: 'checkinTotal', icon: '🗓️', label: '签到', unit: '次' },
  { key: 'momentCount', icon: '📸', label: '动态', unit: '条' },
  { key: 'postCount', icon: '💌', label: '文章', unit: '篇' },
  { key: 'interactCount', icon: '💞', label: '互动', unit: '次' },
  { key: 'msgCount', icon: '💬', label: '悄悄话', unit: '条' },
  { key: 'nightCount', icon: '🌙', label: '晚安', unit: '次' }
]

Page({
  data: {
    loading: true,
    paired: false,
    exp: 0,
    level: null,
    togetherDays: 0,
    statChips: [],
    badges: [],
    gotCount: 0,
    badgeTotal: 0
  },

  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },
  onShareAppMessage() { return shareCard(`我们的亲密度 Lv.${(this.data.level && this.data.level.lv) || 1} 啦 ♡`) },

  async load() {
    this.setData({ loading: true })
    try {
      const res = await callApi('intimacyOverview', {}, { silent: true })
      const s = res.stats || {}
      const statChips = STAT_META.map((m) => ({
        ...m,
        value: m.key === 'togetherDays' ? (res.togetherDays || 0) : (s[m.key] || 0)
      }))
      const level = res.level || null
      const toNext = level && level.nextMin ? Math.max(0, level.nextMin - (res.exp || 0)) : 0
      this.setData({
        paired: true,
        exp: res.exp || 0,
        level,
        toNext,
        togetherDays: res.togetherDays || 0,
        statChips,
        badges: res.badges || [],
        gotCount: res.gotCount || 0,
        badgeTotal: res.badgeTotal || 0,
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  }
})
