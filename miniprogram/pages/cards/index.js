Page({
  data: {
    truths: [
      '第一次注意到对方是什么时候？', '最想对 TA 说但没说出口的话？', '吵架时最怕听到哪句话？',
      '觉得 TA 最可爱的瞬间？', '如果回到相识那天，最想做什么？', 'TA 哪个习惯让你又好气又好笑？',
      '偷偷为 TA 做过最浪漫的事？', '用三个词形容 TA'
    ],
    dares: [
      '给 TA 一个 30 秒的抱抱', '对 TA 说三遍我爱你', '模仿 TA 的招牌表情',
      '给 TA 倒一杯水并说请喝水', '和 TA 拍一张搞怪合影', '给 TA 唱一句情歌',
      '让 TA 弹你一个脑瓜崩', '公主抱 TA 转一圈（量力而行）'
    ],
    mode: 'truth',
    flipping: false,
    current: null,
    history: [],
    loading: true,
    particles: []
  },

  onLoad() { this.loadHistory() },
  onShow() { this.loadHistory() },
  onPullDownRefresh() { this.loadHistory().finally(() => wx.stopPullDownRefresh()) },

  pickMode(e) {
    this.setData({ mode: e.currentTarget.dataset.k, current: null, particles: [] })
  },

  flip() {
    if (this.data.flipping) return
    const { callApi } = require('../../utils/cloud')
    const kind = this.data.mode
    const pool = kind === 'truth' ? this.data.truths : this.data.dares
    const text = pool[Math.floor(Math.random() * pool.length)]
    this.setData({ flipping: true, current: null })
    setTimeout(() => {
      this.setData({ flipping: false, current: { kind, text, back: false } })
      setTimeout(() => {
        this.setData({ 'current.back': true })
        this.burst()
      }, 350)
      callApi('drawCard', { kind, text }, { silent: true })
        .then(() => this.loadHistory())
        .catch(() => {})
    }, 600)
  },

  burst() {
    const icons = this.data.mode === 'truth' ? ['💬', '💗', '✨', '🌸'] : ['⚡', '🔥', '🎉', '💪']
    this.setData({
      particles: Array.from({ length: 14 }, (_, i) => ({
        id: i,
        t: icons[i % icons.length],
        x: 8 + Math.random() * 84,
        s: 34 + Math.random() * 36,
        d: (1 + Math.random()).toFixed(2),
        delay: (Math.random() * 0.4).toFixed(2)
      }))
    })
  },

  async loadHistory() {
    const { callApi } = require('../../utils/cloud')
    try {
      this.setData({ loading: true })
      const res = await callApi('listCards', {}, { silent: true })
      const p = (n) => String(n).padStart(2, '0')
      this.setData({
        history: (res.list || []).map((d) => {
          const t = new Date(d.createdAt)
          return { ...d, time: `${t.getMonth() + 1}/${t.getDate()} ${p(t.getHours())}:${p(t.getMinutes())}` }
        }),
        loading: false
      })
    } catch (e) { this.setData({ loading: false }) }
  }
})
