Page({
  data: {
    faces: ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'],
    face: 5,
    rolling: false,
    templates: [
      { name: '今晚吃啥', icon: '🍜', options: ['火锅', '烧烤', '奶茶店', '寿司', '麻辣烫', '沙拉'] },
      { name: '约会去哪', icon: '💑', options: ['看电影', '逛公园', '压马路', '密室逃脱', '游乐园', '咖啡馆'] },
      { name: '周末干啥', icon: '🎉', options: ['宅家追剧', '短途旅行', '见朋友', '学做菜', '打游戏', '睡懒觉'] }
    ],
    tplIndex: 0,
    options: ['火锅', '烧烤', '奶茶店', '寿司', '麻辣烫', '沙拉'],
    editText: '',
    result: null,
    history: [],
    loading: true,
    particles: []
  },
  timer: null,

  onLoad() { this.loadHistory() },
  onShow() { this.loadHistory() },
  onPullDownRefresh() { this.loadHistory().finally(() => wx.stopPullDownRefresh()) },

  onEditInput(e) { this.setData({ editText: e.detail.value }) },
  switchTpl(e) {
    const i = Number(e.currentTarget.dataset.i)
    this.setData({
      tplIndex: i,
      options: [...this.data.templates[i].options],
      result: null
    })
  },
  addOption() {
    const t = (this.data.editText || '').trim().slice(0, 12)
    if (!t) return
    if (this.data.options.length >= 8) {
      wx.showToast({ title: '最多8个选项', icon: 'none' })
      return
    }
    this.setData({ options: [...this.data.options, t], editText: '' })
  },
  delOption(e) {
    const i = Number(e.currentTarget.dataset.i)
    if (this.data.options.length <= 2) {
      wx.showToast({ title: '至少留2个', icon: 'none' })
      return
    }
    this.setData({ options: this.data.options.filter((_, k) => k !== i) })
  },

  roll() {
    if (this.data.rolling || this.data.options.length < 2) return
    const { callApi } = require('../../utils/cloud')
    this.setData({ rolling: true, result: null })
    let ticks = 0
    clearInterval(this.timer)
    this.timer = setInterval(() => {
      ticks += 1
      this.setData({ face: 1 + Math.floor(Math.random() * 6) })
      if (ticks >= 12) {
        clearInterval(this.timer)
        const face = 1 + Math.floor(Math.random() * 6)
        const text = this.data.options[(face - 1) % this.data.options.length]
        this.setData({ face, rolling: false, result: { face: this.data.faces[face - 1], text } })
        this.burst()
        callApi('rollDice', { face, text, options: this.data.options }, { silent: true })
          .then(() => this.loadHistory())
          .catch(() => {})
      }
    }, 90)
  },

  burst() {
    const icons = ['🎲', '✨', '🎉', '💗', '⭐', '🍜']
    this.setData({
      particles: Array.from({ length: 16 }, (_, i) => ({
        id: i,
        t: icons[i % icons.length],
        x: 5 + Math.random() * 90,
        s: 36 + Math.random() * 36,
        d: (1.1 + Math.random() * 1.1).toFixed(2),
        delay: (Math.random() * 0.5).toFixed(2)
      }))
    })
  },

  closeResult() { this.setData({ result: null, particles: [] }) },

  async loadHistory() {
    const { callApi } = require('../../utils/cloud')
    try {
      this.setData({ loading: true })
      const res = await callApi('listDice', {}, { silent: true })
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
