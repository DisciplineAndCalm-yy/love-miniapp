const { callApi, shareCard } = require('../../utils/cloud')

const SCORE = { love: 5, happy: 5, miss: 4, calm: 3, busy: 2, sad: 1 }
const NAME = { love: '爱你', miss: '想你', happy: '开心', calm: '平静', busy: '忙碌', sad: '难过' }

function pad(n) { return n < 10 ? `0${n}` : `${n}` }
function dayKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

Page({
  data: {
    loading: true,
    paired: false,
    myName: '我',
    partnerName: 'TA',
    hasData: false,
    together: 0,
    weekCheckins: 0,
    streakMine: 0,
    streakPartner: 0,
    summary: '',
    heatCells: [],
    heatTotal: 0,
    rangeText: ''
  },

  onShow() { this.load() },
  onShareAppMessage() { return shareCard('看看我们的心情曲线 ♡') },

  async load() {
    const app = getApp()
    await app.whenReady()
    if (!app.globalData.couple) { this.setData({ loading: false, paired: false }); return }
    const user = app.globalData.user || {}
    const partner = app.globalData.partner
    const myName = user.nickName || '我'
    const partnerName = (partner && partner.nickName) || 'TA'
    this.setData({ myName, partnerName })

    try {
      const today = new Date()
      const start = new Date(today)
      start.setDate(start.getDate() - 69)
      const [mc, ov] = await Promise.all([
        callApi('listMonthCheckins', { start: dayKey(start), end: dayKey(today) }, { silent: true }),
        callApi('intimacyOverview', {}, { silent: true })
      ])

      const byDay = {}
      ;((mc && mc.list) || []).forEach((it) => {
        const k = it.dateKey
        if (!k) return
        if (!byDay[k]) byDay[k] = { mine: [], partner: [] }
        const arr = it.isMine ? byDay[k].mine : byDay[k].partner
        arr.push(it.mood)
      })

      // ===== 14 天折线数据 =====
      const CHART_DAYS = 14
      const mine = []
      const partnerLine = []
      const labels = []
      for (let i = CHART_DAYS - 1; i >= 0; i -= 1) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const cell = byDay[dayKey(d)]
        mine.push(cell && cell.mine.length ? SCORE[cell.mine[cell.mine.length - 1]] : null)
        partnerLine.push(cell && cell.partner.length ? SCORE[cell.partner[cell.partner.length - 1]] : null)
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
      }
      this._chart = { mine, partner: partnerLine }
      const rangeText = `${labels[0]} - ${labels[labels.length - 1]}`

      // ===== 63 天热力图 =====
      const heatCells = []
      let heatTotal = 0
      for (let i = 62; i >= 0; i -= 1) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const cell = byDay[dayKey(d)]
        const moods = []
        if (cell) { moods.push(...cell.mine, ...cell.partner) }
        let level = 0
        if (moods.length) {
          heatTotal += 1
          const avg = moods.reduce((a, m) => a + (SCORE[m] || 3), 0) / moods.length
          level = avg >= 4.5 ? 4 : avg >= 3.5 ? 3 : avg >= 2.25 ? 2 : 1
        }
        heatCells.push({ k: dayKey(d), level })
      }

      // ===== 本周打卡（近 7 天，两人合计） =====
      let weekCheckins = 0
      for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const c = byDay[dayKey(d)]
        if (c) weekCheckins += c.mine.length + c.partner.length
      }

      // ===== 最近心情一句话 =====
      let summary = '还没有最近的签到，去记录今天的心情吧 ♡'
      for (let i = 0; i < 70; i += 1) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const c = byDay[dayKey(d)]
        if (c && (c.mine.length || c.partner.length)) {
          const parts = []
          if (c.mine.length) parts.push(`你是「${NAME[c.mine[c.mine.length - 1]] || '甜蜜'}」`)
          if (c.partner.length) parts.push(`${partnerName}是「${NAME[c.partner[c.partner.length - 1]] || '甜蜜'}」`)
          summary = `最近一次签到：${parts.join('，') || '都记录了心情'}。`
          break
        }
      }

      const stats = (ov && ov.stats) || {}
      const streaks = stats.streaks || {}
      this.setData({
        loading: false,
        paired: true,
        hasData: heatTotal > 0,
        heatCells,
        heatTotal,
        weekCheckins,
        streakMine: streaks.mine || 0,
        streakPartner: streaks.partner || 0,
        together: (ov && ov.togetherDays) || 0,
        rangeText,
        summary
      }, () => this.drawChart())
    } catch (e) {
      console.warn('[moodboard] load failed', e)
      this.setData({ loading: false, paired: true, hasData: false, summary: '数据暂时没加载出来，下拉重试～' })
    }
  },

  drawChart() {
    const chart = this._chart
    if (!chart) return
    wx.createSelectorQuery()
      .select('#moodChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0]
        if (!info || !info.node) return
        const canvas = info.node
        const ctx = canvas.getContext('2d')
        let dpr = 2
        try {
          const si = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
          dpr = si.pixelRatio || 2
        } catch (e) {}
        const W = info.width || 320
        const H = info.height || 150
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
        ctx.scale(dpr, dpr)
        this.paint(ctx, W, H, chart)
      })
  },

  paint(ctx, W, H, chart) {
    const padL = 30, padR = 12, padT = 14, padB = 10
    const iw = W - padL - padR
    const ih = H - padT - padB
    ctx.clearRect(0, 0, W, H)
    const levelText = ['低落', '忙碌', '平静', '想念', '甜蜜']
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.font = '9px sans-serif'
    for (let s = 1; s <= 5; s += 1) {
      const y = padT + ih * (1 - (s - 1) / 4)
      ctx.strokeStyle = 'rgba(150,120,130,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(W - padR, y)
      ctx.stroke()
      ctx.fillStyle = '#C0A3A7'
      ctx.fillText(levelText[s - 1], padL - 6, y)
    }
    const n = chart.mine.length
    const xAt = (i) => padL + (n <= 1 ? iw / 2 : (iw * i) / (n - 1))
    const yAt = (score) => padT + ih * (1 - (score - 1) / 4)
    const drawSeries = (arr, color) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      let pen = false
      for (let i = 0; i < arr.length; i += 1) {
        const s = arr[i]
        if (s == null) { pen = false; continue }
        const x = xAt(i), y = yAt(s)
        if (!pen) { ctx.beginPath(); ctx.moveTo(x, y); pen = true } else { ctx.lineTo(x, y) }
      }
      ctx.stroke()
      ctx.fillStyle = color
      for (let i = 0; i < arr.length; i += 1) {
        const s = arr[i]
        if (s == null) continue
        ctx.beginPath()
        ctx.arc(xAt(i), yAt(s), 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    drawSeries(chart.partner, '#5B8DEF')
    drawSeries(chart.mine, '#E14E68')
  }
})
