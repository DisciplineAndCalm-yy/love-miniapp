Page({
  data: {
    words: ['明天也要一起加油！', '梦里见 ♡', '今天辛苦啦，好好休息', '爱你，晚安'],
    word: '',
    mineDone: false,
    partnerDone: false,
    list: [],
    streak: 0,
    loading: true,
    showDream: false,
    particles: [],
    sending: false
  },

  onLoad() { this.load() },
  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },

  onWord(e) { this.setData({ word: e.detail.value, pickedWord: '' }) },
  pickWord(e) { this.setData({ word: e.currentTarget.dataset.w, pickedWord: e.currentTarget.dataset.w }) },

  async send() {
    if (this.data.sending || this.data.mineDone) return
    const { callApi } = require('../../utils/cloud')
    this.setData({ sending: true })
    try {
      const word = (this.data.word || '').trim().slice(0, 60) || '晚安，好梦 ♡'
      await callApi('sendGoodnight', { word })
      this.setData({ word: '' })
      await this.load()
      this.dream()
    } catch (err) {} finally { this.setData({ sending: false }) }
  },

  dream() {
    const icons = ['🌙', '⭐', '💤', '✨', '🌟', '💜']
    this.setData({
      showDream: true,
      particles: Array.from({ length: 22 }, (_, i) => ({
        id: i,
        t: icons[i % icons.length],
        x: 5 + Math.random() * 90,
        s: 34 + Math.random() * 40,
        d: (1.4 + Math.random() * 1.4).toFixed(2),
        delay: (Math.random() * 0.8).toFixed(2)
      }))
    })
    setTimeout(() => this.setData({ showDream: false, particles: [] }), 4000)
  },

  async load() {
    const { callApi } = require('../../utils/cloud')
    try {
      this.setData({ loading: true })
      const res = await callApi('listGoodnights', {}, { silent: true })
      this.setData({
        list: res.list || [],
        mineDone: !!res.mineDone,
        partnerDone: !!res.partnerDone,
        streak: res.streak || 0,
        loading: false
      })
      if (res.mineDone && res.partnerDone && !this.data.showDream) {
        // 两人都说了,静静撒一次星星
      }
    } catch (e) { this.setData({ loading: false }) }
  }
})
