const { callApi } = require('../../../utils/cloud')

const MISSIONS = [
  { icon: 'ðŸ«‚', text: 'æŠ±æŠ± 30 ç§’ï¼Œä¸�è®¸æ�¾æ‰‹' },
  { icon: 'ðŸ§‹', text: 'è¯·å¯¹æ–¹å–�ä¸€æ�¯å¥¶èŒ¶' },
  { icon: 'ðŸŒŸ', text: 'ä»Šæ™šä¸€èµ·åŽ»çœ‹æ˜Ÿæ˜Ÿ' },
  { icon: 'ðŸŽ¬', text: 'æŒ‘ä¸€éƒ¨ç”µå½±ä¸€èµ·çœ‹å®Œ' },
  { icon: 'ðŸ�³', text: 'ä¸ºå¯¹æ–¹å�šä¸€é¡¿é¥­' },
  { icon: 'ðŸ’Œ', text: 'å†™ä¸€å°� 100 å­—çš„æƒ…ä¹¦' },
  { icon: 'ðŸ“¸', text: 'æ‹�ä¸€å¼ æ�žæ€ªå�ˆå½±' },
  { icon: 'ðŸŽ§', text: 'åˆ†äº«ä¸€é¦–å�•æ›²å¾ªçŽ¯çš„æ­Œ' },
  { icon: 'ðŸš¶', text: 'æ‰‹ç‰µæ‰‹æ•£æ­¥ 20 åˆ†é’Ÿ' },
  { icon: 'ðŸ’†', text: 'ç»™å¯¹æ–¹æŒ‰æ‘© 5 åˆ†é’Ÿ' },
  { icon: 'ðŸ�“', text: 'æŠ•å–‚å¯¹æ–¹ä¸€ç§�æ°´æžœ' },
  { icon: 'ðŸŒ™', text: 'äº’é�“æ™šå®‰ï¼Œä¸�è®¸å…ˆç�¡' }
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
    const icons = ['ðŸ’—', 'âœ¨', 'ðŸ’•', 'ðŸŒ¸', 'ðŸ’Œ', 'â­�']
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
      wx.showToast({ title: 'ç”œèœœ +1 â™¡' })
      this.reload()
    } catch (err) {}
  }
})
