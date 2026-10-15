const { todayKey } = require('../../utils/date')
const { praisePair, BY_COND, GENERAL } = require('../../utils/praise')

const COND_EMOJI = {
  sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', thunder: '⛈️', fog: '🌫️', general: '🌤️'
}
// 每种天气的氛围粒子（emoji + 数量 + 动效）
const COND_FX = {
  sunny: { emojis: ['✨', '🌤️', '💛'], n: 14, cls: 'fx-float' },
  cloudy: { emojis: ['☁️', '🌫️'], n: 12, cls: 'fx-drift' },
  rain: { emojis: ['💧', '🌧️', '💦'], n: 22, cls: 'fx-fall' },
  snow: { emojis: ['❄️', '🌨️', '✨'], n: 20, cls: 'fx-fall-slow' },
  thunder: { emojis: ['⚡', '💧', '🌩️'], n: 18, cls: 'fx-fall' },
  fog: { emojis: ['🌫️', '☁️'], n: 12, cls: 'fx-drift' },
  general: { emojis: ['✨', '🌤️', '♡'], n: 12, cls: 'fx-float' }
}
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function dayLabel(dateStr, idx) {
  if (idx === 0) return '今天'
  if (idx === 1) return '明天'
  if (idx === 2) return '后天'
  const d = new Date(`${dateStr}T00:00:00+08:00`)
  return `周${WEEK[d.getDay()]}`
}
function md(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}`
}

Page({
  data: {
    loading: true,
    needCity: false,
    triedLocate: false,
    weather: null,
    condClass: 'cond-general',
    particles: [],
    cityInput: '',
    showCityInput: false,
    praiseMain: '',
    praiseSub: '',
    praisePop: false
  },

  onLoad() { this.load() },
  onShow() { if (!this.data.loading) this.load() },
  onPullDownRefresh() { this.load(true).finally(() => wx.stopPullDownRefresh()) },

  async load(force) {
    const { callApi } = require('../../utils/cloud')
    try {
      this.setData({ loading: true, needCity: false })
      const res = await callApi('getWeather', {}, { silent: true })
      this.apply(res.weather)
    } catch (e) {
      this.setData({ loading: false })
      const msg = String((e && (e.message || e.errMsg)) || '')
      if (msg.indexOf('城市') >= 0 && !this.data.triedLocate) {
        this.locate()
      } else {
        this.setData({ needCity: true })
      }
    }
  },

  apply(w) {
    if (!w || !w.now) { this.setData({ loading: false, needCity: true }); return }
    const cond = (w.now && w.now.cond) || 'general'
    const days = (w.days || []).map((d, i) => ({
      ...d,
      label: dayLabel(d.date, i),
      md: md(d.date),
      emoji: COND_EMOJI[d.cond] || '🌤️'
    }))
    const fx = COND_FX[cond] || COND_FX.general
    const particles = Array.from({ length: fx.n }, (_, i) => ({
      id: i,
      t: fx.emojis[i % fx.emojis.length],
      x: Math.random() * 96,
      s: 22 + Math.random() * 30,
      d: (2.6 + Math.random() * 3.2).toFixed(2),
      delay: (Math.random() * 3).toFixed(2)
    }))
    const pair = praisePair(todayKey(), cond)
    const t0 = days[0] || {}
    this.setData({
      loading: false,
      needCity: false,
      condClass: `cond-${cond}`,
      particles,
      fxClass: fx.cls,
      weather: {
        ...w,
        emoji: COND_EMOJI[cond] || '🌤️',
        days,
        todayMax: t0.max,
        todayMin: t0.min,
        cond
      },
      praiseMain: pair.main,
      praiseSub: pair.sub
    })
  },

  // 彩虹屁:随手换一条
  rerollPraise() {
    const cond = (this.data.weather && this.data.weather.cond) || 'general'
    const pool = (BY_COND[cond] || []).concat(GENERAL)
    let main = pool[Math.floor(Math.random() * pool.length)]
    if (pool.length > 1 && main === this.data.praiseMain) {
      main = pool[(pool.indexOf(main) + 1) % pool.length]
    }
    let sub = GENERAL[Math.floor(Math.random() * GENERAL.length)]
    if (sub === main && GENERAL.length > 1) sub = GENERAL[(GENERAL.indexOf(sub) + 1) % GENERAL.length]
    this.setData({ praiseMain: main, praiseSub: sub, praisePop: true })
    setTimeout(() => this.setData({ praisePop: false }), 400)
  },

  locate() {
    const { callApi } = require('../../utils/cloud')
    this.setData({ triedLocate: true })
    wx.getLocation({
      type: 'wgs84',
      success: async (r) => {
        try {
          await callApi('saveLocation', { lat: r.latitude, lon: r.longitude }, { silent: true })
          this.load()
        } catch (e) { this.setData({ needCity: true }) }
      },
      fail: () => this.setData({ needCity: true })
    })
  },

  onCityInput(e) { this.setData({ cityInput: e.detail.value }) },

  toggleCity() { this.setData({ showCityInput: !this.data.showCityInput }) },

  async saveCity() {
    const city = (this.data.cityInput || '').trim()
    if (!city) { wx.showToast({ title: '填个城市名吧', icon: 'none' }); return }
    const { callApi } = require('../../utils/cloud')
    try {
      await callApi('saveLocation', { city })
      this.setData({ showCityInput: false, cityInput: '' })
      this.load()
    } catch (e) {}
  },

  retry() { this.load() }
})
