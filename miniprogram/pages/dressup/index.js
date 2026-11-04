const { callApi } = require('../../utils/cloud')
const { THEMES, PENDANTS, themeById, pendantById } = require('../../utils/theme')

function firstChar(name, fallback) {
  const s = String(name || '').trim()
  if (!s) return fallback
  return Array.from(s)[0] || fallback
}
function isDisplayable(url) {
  const s = String(url || '')
  return s.startsWith('http://') || s.startsWith('https://')
}

Page({
  data: {
    themes: THEMES,
    pendants: PENDANTS,
    pickTheme: 'sakura',
    pickPendant: '',
    palette: themeById('sakura').palette,
    paletteName: '粉樱',
    myName: '我',
    myInitial: '我',
    myAvatar: '',
    myPendantEmoji: '',
    partnerName: '',
    partnerThemeName: '',
    partnerPendantEmoji: '',
    partnerPicked: false,
    saving: false
  },

  onShow() { this.load() },

  async load() {
    const app = getApp()
    await app.whenReady()
    const user = app.globalData.user || {}
    let theme = user.theme || 'sakura'
    let pendant = user.pendant || ''
    this._me = { theme, pendant }
    this.setData({
      pickTheme: theme,
      pickPendant: pendant,
      palette: themeById(theme).palette,
      paletteName: themeById(theme).name,
      myName: user.nickName || '我',
      myInitial: firstChar(user.nickName, '我'),
      myAvatar: isDisplayable(user.avatarUrl) ? user.avatarUrl : '',
      myPendantEmoji: pendantById(pendant).emoji
    })
    try {
      const res = await callApi('getThemes', {}, { silent: true })
      const me = res.me || {}
      if (me.theme || me.pendant) {
        theme = me.theme || theme
        pendant = me.pendant || pendant
        this._me = { theme, pendant }
        this.setData({
          pickTheme: theme,
          pickPendant: pendant,
          palette: themeById(theme).palette,
          paletteName: themeById(theme).name,
          myPendantEmoji: pendantById(pendant).emoji
        })
      }
      const partner = res.partner
      if (partner) {
        this.setData({
          partnerPicked: true,
          partnerName: partner.name || 'TA',
          partnerThemeName: themeById(partner.theme).name,
          partnerPendantEmoji: pendantById(partner.pendant).emoji
        })
      }
    } catch (e) {
      console.warn('[dressup] getThemes failed', e)
    }
  },

  selectTheme(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.pickTheme) return
    this.setData({ pickTheme: id, palette: themeById(id).palette, paletteName: themeById(id).name })
    try { wx.vibrateShort({ type: 'light' }) } catch (err) {}
  },

  selectPendant(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ pickPendant: id, myPendantEmoji: pendantById(id).emoji })
  },

  async save() {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      const theme = this.data.pickTheme
      const pendant = this.data.pickPendant
      await callApi('saveTheme', { theme, pendant })
      const app = getApp()
      if (app.globalData.user) {
        app.globalData.user.theme = theme
        app.globalData.user.pendant = pendant
      }
      app.globalData.theme = theme
      app.globalData.pendant = pendant
      try { wx.setStorageSync('theme', theme); wx.setStorageSync('pendant', pendant) } catch (e2) {}
      app.applyTheme(theme)
      wx.showToast({ title: '装扮已保存 ♡', icon: 'none' })
    } catch (e) {
      wx.showToast({ title: '保存失败，再试试', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
