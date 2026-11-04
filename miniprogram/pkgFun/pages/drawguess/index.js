const { callApi } = require('../../../utils/cloud')

const WORDS = [
  '苹果', '月亮', '小猫', '蛋糕', '太阳', '雨伞', '气球', '星星',
  '冰淇淋', '兔子', '恐龙', '钢琴', '草莓', '雪人', '彩虹', '乌龟',
  '风筝', '机器人', '爱心', '房子', '汽车', '西瓜', '蘑菇', '眼镜'
]

const COLOR = '#E14E68'

Page({
  data: {
    role: 'none', // none | drawer | guesser
    answer: '',
    words: WORDS,
    guess: '',
    myScore: 0,
    partnerScore: 0,
    partnerName: 'TA',
    status: '',
    loading: true
  },

  _pollTimer: null,
  _polling: false,
  _cur: null,
  _sig: '',

  onShow() {
    this.poll()
    this.startPoll()
  },
  onReady() { this.initCanvas().then(() => this.poll()) },
  onHide() { this.stopPoll() },
  onUnload() { this.stopPoll() },

  initCanvas() {
    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .select('#dgCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const info = res && res[0]
          if (!info || !info.node) { resolve(); return }
          const canvas = info.node
          const ctx = canvas.getContext('2d')
          let dpr = 2
          try {
            const si = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
            dpr = si.pixelRatio || 2
          } catch (e) {}
          const W = info.width
          const H = info.height
          canvas.width = Math.round(W * dpr)
          canvas.height = Math.round(H * dpr)
          ctx.scale(dpr, dpr)
          this._canvas = canvas
          this.ctx = ctx
          this.W = W
          this.H = H
          this._linePx = 5
          resolve()
        })
    })
  },

  startPoll() {
    this.stopPoll()
    this._pollTimer = setInterval(() => this.poll(), 1200)
  },
  stopPoll() {
    if (this._pollTimer) clearInterval(this._pollTimer)
    this._pollTimer = null
  },

  async poll() {
    if (this._polling) return
    this._polling = true
    try {
      const res = await callApi('drawState', {}, { silent: true })
      const app = getApp()
      const myId = app.globalData.openid
      const partner = app.globalData.partner
      const scores = res.scores || {}
      let role = 'none'
      if (res.drawer) role = res.drawer === myId ? 'drawer' : 'guesser'
      const prevRole = this.data.role
      this.setData({
        role,
        answer: res.answer || '',
        myScore: scores[myId] || 0,
        partnerScore: partner ? (scores[partner.openid] || 0) : 0,
        partnerName: (partner && partner.nickName) || 'TA',
        loading: false,
        status: prevRole !== 'guesser' && role === 'guesser' ? '' : this.data.status
      })
      const sig = `${res.round || 0}|${(res.strokes || []).length}`
      if (sig !== this._sig && !this._cur) {
        this._sig = sig
        this.render(res.strokes || [])
      }
    } catch (e) {
      this.setData({ loading: false })
    } finally {
      this._polling = false
    }
  },

  render(strokes) {
    const { ctx, W, H } = this
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    strokes.forEach((s) => {
      if (!s.pts || !s.pts.length) return
      ctx.strokeStyle = s.color || COLOR
      ctx.lineWidth = Math.max(2, (s.w || 0.02) * W)
      ctx.beginPath()
      s.pts.forEach((p, i) => {
        const x = p[0] * W
        const y = p[1] * H
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      if (s.pts.length === 1) {
        ctx.arc(s.pts[0][0] * W, s.pts[0][1] * H, Math.max(1, (s.w || 0.02) * W / 2), 0, Math.PI * 2)
        ctx.fillStyle = s.color || COLOR
        ctx.fill()
      } else {
        ctx.stroke()
      }
    })
  },

  touchPoint(e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return null
    return { x: t.x, y: t.y }
  },

  onTouchStart(e) {
    if (this.data.role !== 'drawer' || !this.ctx) return
    const p = this.touchPoint(e)
    if (!p) return
    this._cur = { pts: [[p.x / this.W, p.y / this.H]] }
    this._last = p
    this.ctx.fillStyle = COLOR
    this.ctx.beginPath()
    this.ctx.arc(p.x, p.y, this._linePx / 2, 0, Math.PI * 2)
    this.ctx.fill()
  },

  onTouchMove(e) {
    if (this.data.role !== 'drawer' || !this._cur) return
    const p = this.touchPoint(e)
    if (!p) return
    this._cur.pts.push([p.x / this.W, p.y / this.H])
    const ctx = this.ctx
    ctx.strokeStyle = COLOR
    ctx.lineWidth = this._linePx
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(this._last.x, this._last.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    this._last = p
  },

  onTouchEnd() {
    if (this.data.role !== 'drawer' || !this._cur) return
    const stroke = { color: COLOR, w: this._linePx / this.W, pts: this._cur.pts.slice(0, 400) }
    this._cur = null
    if (stroke.pts.length) {
      callApi('drawPush', { stroke }, { silent: true }).catch(() => {})
    }
  },

  async chooseWord(e) {
    const word = e.currentTarget.dataset.w
    try {
      await callApi('drawStart', { word })
      this._sig = ''
      this.setData({ answer: word, role: 'drawer', status: '' })
      if (this.ctx) this.render([])
      this.poll()
    } catch (err) {}
  },

  async clearBoard() {
    if (this.ctx) this.render([])
    this._sig = ''
    callApi('drawClear', {}, { silent: true }).catch(() => {})
    try { wx.vibrateShort({ type: 'light' }) } catch (e) {}
  },

  async giveUp() {
    try {
      await callApi('drawEnd')
      if (this.ctx) this.render([])
      this._sig = ''
      this.setData({ role: 'none', answer: '' })
      this.poll()
    } catch (err) {}
  },

  onGuess(e) { this.setData({ guess: e.detail.value }) },

  async submitGuess() {
    const guess = (this.data.guess || '').trim()
    if (!guess) return
    try {
      const res = await callApi('drawGuess', { guess }, { silent: true })
      if (res.correct) {
        this.setData({ guess: '', status: `🎉 猜对啦！就是「${res.answer}」` })
        try { wx.vibrateShort({ type: 'light' }) } catch (e) {}
        this._sig = ''
        this.poll()
      } else {
        this.setData({ status: res.message || '不对哦，再想想～' })
      }
    } catch (err) {}
  }
})
