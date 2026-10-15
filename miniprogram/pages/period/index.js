const { todayKey, normDateKey, shiftDateKey } = require('../../utils/date')

function md(key) {
  if (!key || typeof key !== 'string') return ''
  const [y, m, d] = key.split('-')
  return `${Number(m)}月${Number(d)}日`
}

const PHASE_FACE = {
  period: '🩸', fertile: '🌷', ovulation: '💛', normal: '🌿'
}

Page({
  data: {
    loading: true,
    mine: null,
    partner: null,
    particles: [],
    // 编辑表单
    editing: false,
    fLast: '',
    fCycle: 28,
    fPeriod: 5,
    fShare: true,
    saving: false
  },

  onLoad() { this.load() },
  onShow() { if (!this.data.loading) this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },

  bloom() {
    const icons = ['🌸', '🌷', '💗', '✨', '🌺']
    this.setData({
      particles: Array.from({ length: 16 }, (_, i) => ({
        id: i,
        t: icons[i % icons.length],
        x: Math.random() * 94,
        s: 24 + Math.random() * 28,
        d: (4 + Math.random() * 4).toFixed(2),
        delay: (Math.random() * 5).toFixed(2)
      }))
    })
  },

  async load() {
    const { callApi } = require('../../utils/cloud')
    try {
      this.setData({ loading: true })
      const res = await callApi('getPeriod', {}, { silent: true })
      const mine = this.decorate(res.mine)
      const partner = res.partner ? this.decorate(res.partner) : null
      const p = (res.mine && res.mine.set) ? res.mine : null
      this.setData({
        loading: false,
        mine,
        partner,
        fLast: (p && p.lastStart) || todayKey(),
        fCycle: (p && p.cycle) || 28,
        fPeriod: (p && p.length) || 5,
        fShare: !p || p.shared !== false
      })
      if (mine && mine.view === 'ok') this.bloom()
    } catch (e) { this.setData({ loading: false }) }
  },

  decorate(p) {
    if (!p) return null
    if (p.shared === false) return { ...p, view: 'hidden' }
    if (!p.set) return { ...p, view: 'unset' }
    if (p.bad) return { ...p, view: 'bad' }
    const face = PHASE_FACE[p.phase] || '🌸'
    const ringPct = Math.round(((p.dayOfCycle - 1) / p.cycle) * 100)
    let big = '', bigSub = '', phaseLabel = ''
    if (p.inPeriod) {
      big = `经期第 ${p.periodDay} 天`
      bigSub = `本轮预计 ${md(shiftDateKey(p.thisStart, p.length - 1))} 结束，好好休息 ♡`
      phaseLabel = '🩸 经期中'
    } else if (p.phase === 'ovulation') {
      big = '排卵日'
      bigSub = `距下次开始还有 ${p.daysToNext} 天`
      phaseLabel = '💛 排卵日'
    } else if (p.phase === 'fertile') {
      big = `还有 ${p.daysToNext} 天`
      bigSub = '正处易孕期，注意安全 ♡'
      phaseLabel = '🌷 易孕期'
    } else {
      big = p.daysToNext === 0 ? '就是今天' : `还有 ${p.daysToNext} 天`
      bigSub = p.daysToNext === 0 ? '记得照顾好自己 ♡' : '稳稳当当，继续美丽'
      phaseLabel = '🌿 安全期'
    }
    const upcoming = []
    let cursor = p.nextStart
    for (let i = 0; i < 3; i += 1) {
      upcoming.push(md(cursor))
      cursor = shiftDateKey(cursor, p.cycle)
    }
    return {
      ...p,
      view: 'ok',
      face,
      ringPct,
      big,
      bigSub,
      phaseLabel,
      nextLabel: md(p.nextStart),
      lastLabel: md(p.lastStart),
      ovuLabel: md(p.ovulation),
      fertileLabel: `${md(p.fertileStart)} ~ ${md(p.fertileEnd)}`,
      dayLabel: `第 ${p.dayOfCycle} / ${p.cycle} 天`,
      upcoming
    }
  },

  openEdit() { this.setData({ editing: true }) },
  closeEdit() { this.setData({ editing: false }) },
  noop() {},
  onDate(e) { this.setData({ fLast: normDateKey(e.detail.value) || this.data.fLast }) },
  stepCycle(e) {
    const d = Number(e.currentTarget.dataset.d) || 0
    const v = Math.min(45, Math.max(20, (this.data.fCycle || 28) + d))
    this.setData({ fCycle: v })
  },
  stepPeriod(e) {
    const d = Number(e.currentTarget.dataset.d) || 0
    const v = Math.min(10, Math.max(2, (this.data.fPeriod || 5) + d))
    this.setData({ fPeriod: v })
  },
  onShare(e) { this.setData({ fShare: !!e.detail.value }) },

  async save() {
    if (this.data.saving) return
    const { callApi } = require('../../utils/cloud')
    if (!normDateKey(this.data.fLast)) {
      wx.showToast({ title: '选一下上次开始的日期', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      await callApi('savePeriod', { lastStart: this.data.fLast, cycle: this.data.fCycle, period: this.data.fPeriod, share: this.data.fShare })
      this.setData({ editing: false })
      await this.load()
      wx.showToast({ title: '记好啦 ♡', icon: 'none' })
    } catch (e) {} finally { this.setData({ saving: false }) }
  }
})
