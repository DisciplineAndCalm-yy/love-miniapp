const { callApi, shareCard } = require('../../utils/cloud')

const FLOATERS = ['💗', '✨', '💖', '🌸', '💫', '🎀', '💞', '🌷']

Page({
  data: {
    loading: true,
    paired: false,
    cw: 300,
    ch: 510,
    particles: []
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const cw = Math.min(360, Math.floor((info.windowWidth || 375) * 0.88))
    const ch = Math.round(cw * 1.92)
    const particles = []
    for (let i = 0; i < 16; i += 1) {
      particles.push({
        id: i,
        emoji: FLOATERS[i % FLOATERS.length],
        left: Math.round(Math.random() * 92),
        delay: (Math.random() * 6).toFixed(2),
        dur: (6 + Math.random() * 6).toFixed(2),
        size: (22 + Math.round(Math.random() * 20))
      })
    }
    this.setData({ cw, ch, particles })
  },
  onShow() { this.load() },
  onShareAppMessage() { return shareCard('我们的回忆册 ♡') },

  async load() {
    const app = getApp()
    await app.whenReady()
    if (!app.globalData.couple) { this.setData({ loading: false, paired: false }); return }
    const user = app.globalData.user || {}
    const partner = app.globalData.partner || {}
    try {
      const ov = await callApi('intimacyOverview', {}, { silent: true })
      this.mem = {
        myName: user.nickName || '我',
        partnerName: partner.nickName || 'TA',
        days: ov.togetherDays || 0,
        since: (app.globalData.couple && app.globalData.couple.togetherSince) || '',
        level: ov.level || null,
        stats: ov.stats || {},
        got: ov.gotCount || 0,
        total: ov.badgeTotal || 0
      }
      this.setData({ loading: false, paired: true }, () => this.draw())
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  draw() {
    const m = this.mem
    if (!m) return
    const q = wx.createSelectorQuery()
    q.select('#memCanvas').fields({ node: true, size: true }).exec((res) => {
      const info = res && res[0]
      if (!info || !info.node) return
      const canvas = info.node
      const ctx = canvas.getContext('2d')
      const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const dpr = win.pixelRatio || 2
      const W = this.data.cw
      const H = this.data.ch
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.scale(dpr, dpr)
      this.canvasNode = canvas
      this.paint(ctx, W, H, m)
    })
  },

  // ===== 基础绘制工具 =====
  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  },
  heartPath(ctx, x, y, s) {
    ctx.beginPath()
    ctx.moveTo(x, y + s * 0.3)
    ctx.bezierCurveTo(x, y, x - s * 0.5, y - s * 0.1, x - s * 0.5, y + s * 0.28)
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.62, x, y + s * 0.82, x, y + s * 1.06)
    ctx.bezierCurveTo(x, y + s * 0.82, x + s * 0.5, y + s * 0.62, x + s * 0.5, y + s * 0.28)
    ctx.bezierCurveTo(x + s * 0.5, y - s * 0.1, x, y, x, y + s * 0.3)
    ctx.closePath()
  },
  starPath(ctx, cx, cy, r, inner, points) {
    ctx.beginPath()
    for (let i = 0; i < points * 2; i += 1) {
      const radius = i % 2 === 0 ? r : r * inner
      const a = (Math.PI / points) * i - Math.PI / 2
      const px = cx + Math.cos(a) * radius
      const py = cy + Math.sin(a) * radius
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
  },
  sparkle(ctx, x, y, s, color) {
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x, y - s)
    ctx.quadraticCurveTo(x + s * 0.18, y - s * 0.18, x + s, y)
    ctx.quadraticCurveTo(x + s * 0.18, y + s * 0.18, x, y + s)
    ctx.quadraticCurveTo(x - s * 0.18, y + s * 0.18, x - s, y)
    ctx.quadraticCurveTo(x - s * 0.18, y - s * 0.18, x, y - s)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  },
  flower(ctx, cx, cy, r, petal, core) {
    for (let i = 0; i < 5; i += 1) {
      const a = (Math.PI * 2 / 5) * i - Math.PI / 2
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, r * 0.55, 0, Math.PI * 2)
      ctx.fillStyle = petal
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
    ctx.fillStyle = core
    ctx.fill()
  },

  paint(ctx, W, H, m) {
    const u = W
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#FFF8F0')
    g.addColorStop(0.45, '#FFEAF0')
    g.addColorStop(1, '#FFE3C9')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // 波点
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    const step = u * 0.10
    for (let y = u * 0.06; y < H; y += step) {
      for (let x = (Math.round(y / step) % 2) * step * 0.5; x < W; x += step) {
        ctx.beginPath(); ctx.arc(x, y, u * 0.012, 0, Math.PI * 2); ctx.fill()
      }
    }

    // 手账彩旗
    this.drawBunting(ctx, u)

    // 顶部和纸胶带
    this.washi(ctx, u * 0.14, u * 0.20, u * 0.26, u * 0.075, -0.28, 'rgba(255,183,197,0.85)')
    this.washi(ctx, u * 0.84, u * 0.22, u * 0.24, u * 0.07, 0.30, 'rgba(198,182,242,0.82)')

    // 标题
    ctx.textAlign = 'center'
    ctx.fillStyle = '#C86B7E'
    ctx.font = `bold ${u * 0.075}px sans-serif`
    ctx.fillText('我们的回忆册', W / 2, u * 0.335)
    // 标题两侧心
    ctx.fillStyle = 'rgba(255,120,150,0.9)'
    this.heartPath(ctx, W / 2 - u * 0.27, u * 0.285, u * 0.055); ctx.fill()
    this.heartPath(ctx, W / 2 + u * 0.27, u * 0.285, u * 0.055); ctx.fill()
    // 闪光
    this.sparkle(ctx, W / 2 - u * 0.20, u * 0.30, u * 0.028, 'rgba(255,210,120,0.95)')
    this.sparkle(ctx, W / 2 + u * 0.21, u * 0.31, u * 0.022, 'rgba(255,210,120,0.95)')

    // 名字飘带
    this.drawRibbon(ctx, W / 2, u * 0.415, `${m.myName} ♥ ${m.partnerName}`, u)

    // 拍立得卡片
    const px = u * 0.13
    const pw = u * 0.74
    const py = u * 0.48
    const ph = u * 0.62
    ctx.save()
    ctx.shadowColor = 'rgba(200,120,140,0.28)'
    ctx.shadowBlur = u * 0.06
    ctx.shadowOffsetY = u * 0.02
    ctx.fillStyle = '#FFFFFF'
    this.roundRect(ctx, px, py, pw, ph, u * 0.04)
    ctx.fill()
    ctx.restore()

    // 照片区
    const pm = u * 0.045
    const photoX = px + pm
    const photoY = py + pm
    const photoW = pw - pm * 2
    const photoH = ph - pm - u * 0.16
    const pg = ctx.createLinearGradient(photoX, photoY, photoX + photoW, photoY + photoH)
    pg.addColorStop(0, '#FFB7C6')
    pg.addColorStop(0.55, '#FF93A8')
    pg.addColorStop(1, '#FFC08A')
    ctx.fillStyle = pg
    this.roundRect(ctx, photoX, photoY, photoW, photoH, u * 0.03)
    ctx.fill()
    // 照片区小装饰
    this.sparkle(ctx, photoX + photoW * 0.16, photoY + photoH * 0.2, u * 0.03, 'rgba(255,255,255,0.85)')
    this.flower(ctx, photoX + photoW * 0.84, photoY + photoH * 0.24, u * 0.05, 'rgba(255,255,255,0.9)', 'rgba(255,220,150,1)')
    // 大心 + 天数
    const hx = photoX + photoW / 2
    const hy = photoY + photoH * 0.40
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    this.heartPath(ctx, hx, hy - u * 0.10, u * 0.42)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#E14E68'
    ctx.font = `bold ${u * 0.17}px sans-serif`
    ctx.fillText(String(m.days), hx, hy + u * 0.10)
    ctx.fillStyle = '#C86B7E'
    ctx.font = `bold ${u * 0.045}px sans-serif`
    ctx.fillText('在一起的 天', hx, hy + u * 0.16)
    // 等级胶囊
    if (m.level) {
      const txt = `${m.level.title} · Lv.${m.level.lv}`
      ctx.font = `bold ${u * 0.04}px sans-serif`
      const tw = ctx.measureText(txt).width + u * 0.10
      const tX = hx - tw / 2
      const tY = photoY + photoH - u * 0.085
      const cg = ctx.createLinearGradient(tX, tY, tX + tw, tY + u * 0.07)
      cg.addColorStop(0, '#FF9FB2'); cg.addColorStop(1, '#E14E68')
      ctx.fillStyle = cg
      this.roundRect(ctx, tX, tY, tw, u * 0.07, u * 0.035)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(txt, hx, tY + u * 0.05)
    }
    // 照片底部说明（拍立得留白）
    ctx.fillStyle = '#A98C90'
    ctx.font = `${u * 0.038}px sans-serif`
    ctx.fillText(m.since ? `从 ${m.since} 一起走到现在` : '我们的故事，还在继续', hx, py + ph - u * 0.055)

    // 统计贴纸（3×2）
    const s = m.stats || {}
    const items = [
      ['💌', '签到', s.checkinTotal || 0], ['🌈', '动态', s.momentCount || 0], ['📝', '文章', s.postCount || 0],
      ['💬', '悄悄话', s.msgCount || 0], ['🌙', '晚安', s.nightCount || 0], ['💗', '互动', s.interactCount || 0]
    ]
    const areaX = u * 0.09
    const areaW = u * 0.82
    const gap = u * 0.03
    const colW = (areaW - gap * 2) / 3
    const rowH = u * 0.16
    const startY = u * 1.16
    const tints = ['#FFF1F4', '#F0F5FF', '#FFF8E9', '#F0FFF5', '#F5F0FF', '#FFF4EC']
    items.forEach((it, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = areaX + col * (colW + gap)
      const y = startY + row * (rowH + gap)
      ctx.save()
      ctx.shadowColor = 'rgba(200,150,160,0.16)'
      ctx.shadowBlur = u * 0.03
      ctx.shadowOffsetY = u * 0.008
      ctx.fillStyle = tints[i]
      this.roundRect(ctx, x, y, colW, rowH, u * 0.035)
      ctx.fill()
      ctx.restore()
      ctx.textAlign = 'center'
      ctx.fillStyle = '#E14E68'
      ctx.font = `bold ${u * 0.06}px sans-serif`
      ctx.fillText(String(it[2]), x + colW / 2, y + rowH * 0.52)
      ctx.fillStyle = '#A98C90'
      ctx.font = `${u * 0.032}px sans-serif`
      ctx.fillText(`${it[0]} ${it[1]}`, x + colW / 2, y + rowH * 0.82)
    })

    // 成就行
    const streak = (s.streaks && s.streaks.mine) || 0
    ctx.textAlign = 'center'
    ctx.fillStyle = '#8C7478'
    ctx.font = `bold ${u * 0.038}px sans-serif`
    ctx.fillText(`🔥 连续签到 ${streak} 天    🏅 成就 ${m.got}/${m.total}`, W / 2, u * 1.58)

    // 便签寄语（和纸胶带贴）
    const noteW = u * 0.80
    const noteH = u * 0.15
    const nx = (W - noteW) / 2
    const ny = u * 1.62
    ctx.save()
    ctx.shadowColor = 'rgba(200,150,160,0.16)'
    ctx.shadowBlur = u * 0.03
    ctx.fillStyle = '#FFFBEC'
    this.roundRect(ctx, nx, ny, noteW, noteH, u * 0.025)
    ctx.fill()
    ctx.restore()
    this.washi(ctx, W / 2 - u * 0.09, ny - u * 0.02, u * 0.18, u * 0.05, 0.02, 'rgba(255,205,140,0.9)')
    ctx.textAlign = 'center'
    ctx.fillStyle = '#B0797F'
    ctx.font = `bold ${u * 0.036}px sans-serif`
    ctx.fillText(`在一起的第 ${m.days} 天，也想一直和你走下去`, W / 2, ny + noteH * 0.62)
    // 小爱心收尾
    ctx.fillStyle = 'rgba(255,120,150,0.85)'
    this.heartPath(ctx, W / 2, ny + noteH + u * 0.02, u * 0.05)
    ctx.fill()
  },

  drawBunting(ctx, u) {
    const topY = u * 0.10
    const colors = ['#FF9FB2', '#FFC978', '#9FE0C0', '#C6B6F2', '#8FD4FF']
    const n = 7
    const left = u * 0.06
    const right = u * 0.94
    ctx.strokeStyle = 'rgba(180,140,150,0.5)'
    ctx.lineWidth = Math.max(1, u * 0.006)
    ctx.beginPath()
    ctx.moveTo(left, topY)
    ctx.quadraticCurveTo(u / 2, topY + u * 0.05, right, topY)
    ctx.stroke()
    for (let i = 0; i < n; i += 1) {
      const t = i / (n - 1)
      const x = left + (right - left) * t
      const y = topY + Math.sin(Math.PI * t) * u * 0.05
      const fw = u * 0.05
      const fh = u * 0.065
      ctx.beginPath()
      ctx.moveTo(x - fw / 2, y)
      ctx.lineTo(x + fw / 2, y)
      ctx.lineTo(x, y + fh)
      ctx.closePath()
      ctx.fillStyle = colors[i % colors.length]
      ctx.fill()
    }
  },

  washi(ctx, x, y, w, h, rot, color) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.globalAlpha = 0.9
    ctx.fillStyle = color
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.globalAlpha = 1
    ctx.restore()
  },

  drawRibbon(ctx, cx, cy, text, u) {
    ctx.font = `bold ${u * 0.055}px sans-serif`
    const tw = ctx.measureText(text).width
    const w = tw + u * 0.16
    const h = u * 0.10
    const x = cx - w / 2
    const y = cy - h / 2
    // 飘带尾
    ctx.fillStyle = '#E14E68'
    ctx.beginPath()
    ctx.moveTo(x, y); ctx.lineTo(x - u * 0.05, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x + w, y); ctx.lineTo(x + w + u * 0.05, y + h / 2); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill()
    // 主体
    const rg = ctx.createLinearGradient(x, y, x + w, y + h)
    rg.addColorStop(0, '#FF8FA6'); rg.addColorStop(1, '#E14E68')
    ctx.fillStyle = rg
    this.roundRect(ctx, x, y, w, h, u * 0.02)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.fillText(text, cx, y + h * 0.68)
  },

  save() {
    if (!this.canvasNode) return
    wx.canvasToTempFilePath({
      canvas: this.canvasNode,
      success: (r) => {
        wx.saveImageToPhotosAlbum({
          filePath: r.tempFilePath,
          success: () => wx.showToast({ title: '已存到相册 ♡' }),
          fail: (err) => {
            const msg = String((err && err.errMsg) || '')
            if (msg.indexOf('auth') >= 0 || msg.indexOf('deny') >= 0) {
              wx.showModal({
                title: '需要相册权限',
                content: '请在设置里允许「保存到相册」后重试',
                confirmText: '去设置',
                success: (mm) => { if (mm.confirm) wx.openSetting({}) }
              })
            } else {
              wx.showToast({ title: '保存失败，可截屏保存', icon: 'none' })
            }
          }
        })
      },
      fail: () => wx.showToast({ title: '生成图片失败，可截屏保存', icon: 'none' })
    })
  }
})
