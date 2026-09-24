const { callApi } = require('../../utils/cloud')

const MISSIONS = [
  { icon: '🫂', text: '抱抱 30 秒，不许松手' },
  { icon: '🧋', text: '请对方喝一杯奶茶' },
  { icon: '🌟', text: '今晚一起去看星星' },
  { icon: '🎬', text: '挑一部电影一起看完' },
  { icon: '🍳', text: '为对方做一顿饭' },
  { icon: '💌', text: '写一封 100 字的情书' },
  { icon: '📸', text: '拍一张搞怪合影' },
  { icon: '🎧', text: '分享一首单曲循环的歌' },
  { icon: '🚶', text: '手牵手散步 20 分钟' },
  { icon: '💆', text: '给对方按摩 5 分钟' },
  { icon: '🍓', text: '投喂对方一种水果' },
  { icon: '🌙', text: '互道晚安，不许先睡' }
]

Page({
  data: {
    missions: MISSIONS,
    drawing: false,
    result: null,
    showResult: false,
    particles: [],
    list: [],
    doneCount: 0,
    total: 0,
    loading: true
  },

  onShow() { this.reload() },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()) },

  async reload() {
    this.setData({ loading: true })
    try {
      const res = await callApi('listDraws', {}, { silent: true })
      this.setData({ list: res.list || [], doneCount: res.doneCount || 0, total: res.total || 0 })
    } catch (e) {}
    this.setData({ loading: false })
  },

  draw() {
    if (this.data.drawing) return
    this.setData({ drawing: true, showResult: false, result: null })
    const pick = MISSIONS[Math.floor(Math.random() * MISSIONS.length)]
    setTimeout(async () => {
      try {
        await callApi('addDraw', { mission: pick.text, icon: pick.icon })
      } catch (e) {}
      this.setData({ result: pick, showResult: true, drawing: false })
      this.burst()
      this.reload()
    }, 1200)
  },

  burst() {
    const icons = ['💗', '✨', '💕', '🌸', '💌', '⭐']
    const arr = []
    for (let i = 0; i < 18; i++) {
      arr.push({
        id: i,
        t: icons[i % icons.length],
        x: 10 + Math.random() * 80,
        d: (1.2 + Math.random() * 1.2).toFixed(2),
        delay: (Math.random() * 0.4).toFixed(2),
        s: (40 + Math.random() * 32).toFixed(0)
      })
    }
    this.setData({ particles: arr })
    setTimeout(() => this.setData({ particles: [] }), 3200)
  },

  closeResult() { this.setData({ showResult: false }) },

  async markDone(e) {
    const id = e.currentTarget.dataset.id
    try {
      await callApi('doneDraw', { id })
      wx.showToast({ title: '甜蜜 +1 ♡' })
      this.reload()
    } catch (err) {}
  }
})
