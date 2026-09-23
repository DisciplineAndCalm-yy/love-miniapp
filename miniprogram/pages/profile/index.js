const { callApi, requestAnniversaryRemind } = require('../../utils/cloud')

Page({
  data: {
    nickName: '',
    inviteCode: '',
    joinCode: '',
    paired: false,
    pending: false,
    togetherSince: '',
    memberCount: 0,
    remindEnabled: false
  },

  onShow() {
    this.sync()
  },

  async sync() {
    const app = getApp()
    await app.whenReady()
    const user = app.globalData.user || {}
    const couple = app.globalData.couple
    this.setData({
      nickName: user.nickName || '',
      inviteCode: (couple && couple.inviteCode) || '',
      paired: !!(couple && couple.status === 'paired'),
      pending: !!(couple && couple.status === 'pending'),
      togetherSince: (couple && couple.togetherSince) || '',
      memberCount: couple ? couple.memberOpenids.length : 0,
      remindEnabled: !!user.remindEnabled
    })
  },

  onNick(e) {
    this.setData({ nickName: e.detail.value })
  },

  onJoinCode(e) {
    this.setData({ joinCode: e.detail.value.toUpperCase() })
  },

  onTogether(e) {
    this.setData({ togetherSince: e.detail.value })
  },

  async saveNick() {
    try {
      const res = await callApi('saveProfile', {
        nickName: this.data.nickName.trim() || '还没起名字'
      })
      const app = getApp()
      if (app.globalData.user) app.globalData.user.nickName = res.nickName
      wx.showToast({ title: '已保存' })
    } catch (err) {
      console.error(err)
    }
  },

  async create() {
    wx.showLoading({ title: '生成邀请码' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'bindCouple',
        data: { action: 'create', togetherSince: this.data.togetherSince }
      })
      if (!res.result.ok) {
        wx.showToast({ title: res.result.message, icon: 'none' })
        return
      }
      const app = getApp()
      app.globalData.user.coupleId = res.result.coupleId
      await app.refreshCouple()
      this.sync()
    } finally {
      wx.hideLoading()
    }
  },

  async join() {
    wx.showLoading({ title: '加入中' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'bindCouple',
        data: {
          action: 'join',
          code: this.data.joinCode,
          togetherSince: this.data.togetherSince
        }
      })
      if (!res.result.ok) {
        wx.showToast({ title: res.result.message, icon: 'none' })
        return
      }
      const app = getApp()
      app.globalData.user.coupleId = res.result.coupleId
      await app.refreshCouple()
      this.sync()
    } finally {
      wx.hideLoading()
    }
  },

  async saveTogether() {
    const res = await wx.cloud.callFunction({
      name: 'bindCouple',
      data: { action: 'updateTogether', togetherSince: this.data.togetherSince }
    })
    if (res.result.ok) {
      await getApp().refreshCouple()
      wx.showToast({ title: '已更新' })
    } else {
      wx.showToast({ title: res.result.message, icon: 'none' })
    }
  },

  async enableRemind() {
    try {
      const ok = await requestAnniversaryRemind()
      if (ok) {
        this.setData({ remindEnabled: true })
        wx.showToast({ title: '提醒已打开' })
      }
    } catch (err) {
      console.error(err)
    }
  },

  copyCode() {
    wx.setClipboardData({ data: this.data.inviteCode })
  },

  goAnniversary() {
    wx.navigateTo({ url: '/pages/anniversary/index' })
  }
})
