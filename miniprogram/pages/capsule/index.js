const { callApi, shareCard } = require('../../utils/cloud')
const { todayKey } = require('../../utils/date')

Page({
  data: {
    loading: true,
    sending: false,
    paired: false,
    myName: '我',
    partnerName: 'TA',
    content: '',
    unlockDate: '',
    today: '',
    minDate: '',
    readyCount: 0,
    list: []
  },

  onLoad() {
    const t = todayKey()
    this.setData({ today: t, minDate: t })
  },
  onShow() { this.load() },
  onShareAppMessage() { return shareCard('给未来的我们，一封慢慢拆的信 ♡') },

  async load() {
    const app = getApp()
    await app.whenReady()
    if (!app.globalData.couple) { this.setData({ loading: false, paired: false }); return }
    const user = app.globalData.user || {}
    const partner = app.globalData.partner
    this.setData({ myName: user.nickName || '我', partnerName: (partner && partner.nickName) || 'TA', paired: true })
    try {
      const res = await callApi('capsuleList', {}, { silent: true })
      const list = res.list || []
      const readyCount = list.filter((c) => c.unlocked).length
      this.setData({ list, readyCount, loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onContent(e) { this.setData({ content: e.detail.value }) },
  onUnlockDate(e) { this.setData({ unlockDate: e.detail.value }) },

  async createCapsule() {
    const content = (this.data.content || '').trim()
    if (!content) { wx.showToast({ title: '写点想说的话吧', icon: 'none' }); return }
    if (!this.data.unlockDate) { wx.showToast({ title: '选个解锁日期吧', icon: 'none' }); return }
    if (this.data.sending) return
    this.setData({ sending: true })
    try {
      await callApi('capsuleCreate', { content, unlockDate: this.data.unlockDate }, { silent: true })
      wx.showToast({ title: '已封存，到时再拆 ♡', icon: 'none' })
      this.setData({ content: '', unlockDate: '' })
      this.load()
    } catch (e) {
      wx.showToast({ title: (e && (e.message || e.errMsg)) || '封存失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },

  removeCapsule(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '收回这个胶囊？', confirmColor: '#c94b5c',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await callApi('capsuleRemove', { id }, { silent: true })
          const list = this.data.list.filter((c) => c._id !== id)
          this.setData({ list, readyCount: list.filter((c) => c.unlocked).length })
        } catch (err) {}
      }
    })
  }
})
