Page({
  data: {
    questions: [
      { icon: '🍜', text: '第一次约会吃的是？', options: ['火锅', '奶茶小吃', '西餐', '记不清了'] },
      { icon: '🧋', text: 'TA 最爱喝什么？', options: ['奶茶', '咖啡', '白开水', '快乐水'] },
      { icon: '🎬', text: '一起看的第一部电影是？', options: ['爱情片', '喜剧片', '恐怖片', '没看过电影'] },
      { icon: '😴', text: 'TA 生气时你该？', options: ['立刻抱抱', '讲笑话', '静静陪着', '买好吃的'] },
      { icon: '✈️', text: '最想一起去哪旅行？', options: ['海边', '雪山', '古镇', '游乐园'] },
      { icon: '🎁', text: 'TA 最想要的礼物是？', options: ['陪伴', '包包', '数码产品', '一封长信'] },
      { icon: '🌙', text: '睡前最后一件事是？', options: ['互道晚安', '刷手机', '聊八卦', '秒睡'] },
      { icon: '🏠', text: '理想的周末是？', options: ['宅家追剧', '出门约会', '见朋友', '各忙各的'] }
    ],
    current: 0,
    picked: {},
    mineCount: 0,
    partnerCount: 0,
    both: null,
    result: null,
    loading: true,
    answering: false,
    particles: []
  },
  timer: null,
  round: 'love8',

  onLoad() { this.sync(true) },
  onShow() {
    this.sync(false)
    clearInterval(this.timer)
    this.timer = setInterval(() => this.sync(false), 5000)
  },
  onHide() { clearInterval(this.timer) },
  onUnload() { clearInterval(this.timer) },
  onPullDownRefresh() { this.sync(false).finally(() => wx.stopPullDownRefresh()) },

  async sync(first) {
    const { callApi } = require('../../utils/cloud')
    try {
      if (first) this.setData({ loading: true })
      const res = await callApi('quizState', { round: this.round }, { silent: !first })
      const mine = res.mine || {}
      const mineCount = Object.keys(mine).length
      const update = { loading: false, mineCount, partnerCount: res.partnerCount || 0, picked: mine }
      if (mineCount >= this.data.questions.length) {
        const firstUnanswered = this.data.questions.findIndex((_, i) => mine[i] === undefined)
        update.current = firstUnanswered === -1 ? this.data.questions.length - 1 : firstUnanswered
      }
      if (res.both) {
        update.both = res.both
        update.result = this.calcResult(res.both)
        if (!this.data.result) this.burst()
      } else {
        update.both = null
        update.result = null
      }
      this.setData(update)
    } catch (e) { this.setData({ loading: false }) }
  },

  calcResult(both) {
    const keys = Object.keys(both)
    if (keys.length < 2) return null
    const a = both[keys[0]]
    const b = both[keys[1]]
    const total = this.data.questions.length
    let same = 0
    const detail = this.data.questions.map((q, i) => {
      const hit = a[i] !== undefined && a[i] === b[i]
      if (hit) same += 1
      return { i, hit, a: a[i], b: b[i] }
    })
    const pct = Math.round((same / total) * 100)
    let title = '还需磨合'
    let face = '🌱'
    let tip = '多聊聊天，下次一定更高！'
    if (pct === 100) { title = '心有灵犀'; face = '💞'; tip = '满分！你们是天生一对！' }
    else if (pct >= 75) { title = '天生一对'; face = '💗'; tip = '超高默契，继续保持！' }
    else if (pct >= 50) { title = '渐入佳境'; face = '🌸'; tip = '已经很不错了，再接再厉！' }
    return { same, total, pct, title, face, tip, detail }
  },

  async pick(e) {
    const idx = Number(e.currentTarget.dataset.i)
    const qid = this.data.current
    if (this.data.answering) return
    const { callApi } = require('../../utils/cloud')
    this.setData({ answering: true })
    try {
      await callApi('answerQuiz', { round: this.round, qid, choice: idx })
      const picked = { ...this.data.picked, [qid]: idx }
      const next = qid + 1 < this.data.questions.length ? qid + 1 : qid
      this.setData({ picked, current: next, mineCount: Object.keys(picked).length })
      this.sync(false)
    } catch (err) {} finally { this.setData({ answering: false }) }
  },

  goQ(e) {
    this.setData({ current: Number(e.currentTarget.dataset.q) })
  },

  burst() {
    const icons = ['💗', '✨', '💕', '🌸', '💌', '⭐']
    const particles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      t: icons[i % icons.length],
      x: 5 + Math.random() * 90,
      s: 36 + Math.random() * 40,
      d: (1.2 + Math.random() * 1.2).toFixed(2),
      delay: (Math.random() * 0.6).toFixed(2)
    }))
    this.setData({ particles })
  },

  async again() {
    const { callApi } = require('../../utils/cloud')
    const ok = await wx.showModal({ title: '再来一轮？', content: '会清空本轮双方答案', confirmText: '再来' })
    if (!ok.confirm) return
    try {
      await callApi('resetQuiz', { round: this.round })
      this.setData({ current: 0, picked: {}, mineCount: 0, partnerCount: 0, both: null, result: null, particles: [] })
      this.sync(false)
    } catch (e) {}
  }
})
