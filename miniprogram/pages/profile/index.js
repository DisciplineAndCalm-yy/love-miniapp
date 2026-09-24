const { callApi, requestAnniversaryRemind, uploadImage } = require('../../utils/cloud')

// 取首字(emoji 安全,charAt 会把 emoji 拆成乱码问号)
function firstChar(name, fallback) {
  const s = String(name || '').trim()
  if (!s) return fallback
  return Array.from(s)[0] || fallback
}

// 只有 http(s) 链接能直接渲染;fileID 由云端换链,本地临时路径直接判无效
function isDisplayable(url) {
  const s = String(url || '')
  return s.startsWith('http://') || s.startsWith('https://')
}

Page({
  data: {
    nickName: '',
    avatarUrl: '',
    inviteCode: '',
    joinCode: '',
    paired: false,
    pending: false,
    togetherSince: '',
    memberCount: 0,
    remindEnabled: false,
    partnerName: '',
    partnerAvatar: '',
    unbinding: false
  },

  onShow() {
    this.sync()
  },

  onPullDownRefresh() {
    this.sync().finally(() => wx.stopPullDownRefresh())
  },

  async sync() {
    const app = getApp()
    await app.whenReady()
    await app.refreshCouple()
    // 刷新成员资料,避免对方新换的头像/昵称因缓存看不到
    await app.refreshMembers()
    const user = app.globalData.user || {}
    const couple = app.globalData.couple
    const partner = app.globalData.partner
    const mine = (app.globalData.members || []).find((m) => m.openid === app.globalData.openid) || {}
    const myAvatar = mine.avatarUrl || user.avatarUrl || ''
    this.setData({
      nickName: user.nickName || '',
      myInitial: firstChar(user.nickName, '我'),
      avatarUrl: myAvatar,
      avatarUrlShown: isDisplayable(myAvatar) ? myAvatar : '',
      inviteCode: (couple && couple.inviteCode) || '',
      paired: !!(couple && couple.status === 'paired'),
      pending: !!(couple && couple.status === 'pending'),
      togetherSince: (couple && couple.togetherSince) || '',
      memberCount: couple ? couple.memberOpenids.length : 0,
      remindEnabled: !!user.remindEnabled,
      partnerName: (partner && partner.nickName) || '',
      partnerInitial: firstChar(partner && partner.nickName, 'TA'),
      partnerAvatar: (partner && partner.avatarUrl) || '',
      partnerAvatarUrl: isDisplayable(partner && partner.avatarUrl) ? partner.avatarUrl : ''
    })
  },

  avatarError(e) {
    // 链接失效时回落到首字占位,保证头像位不空白
    if (e.currentTarget.dataset.which === 'partner') this.setData({ partnerAvatarUrl: '' })
    else this.setData({ avatarUrlShown: '' })
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

  onChooseAvatar(e) {
    const url = e.detail.avatarUrl
    if (!url) return
    this.uploadAvatar(url)
  },

  async pickAvatar() {
    try {
      const fileID = await uploadImage()
      await this.saveAvatar(fileID)
    } catch (err) {
      if (err && err.errMsg && err.errMsg.includes('cancel')) return
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  async uploadAvatar(tempPath) {
    wx.showLoading({ title: '上传头像' })
    try {
      const ext = (tempPath.split('.').pop() || 'jpg').toLowerCase()
      const cloudPath = `love/avatar-${Date.now()}.${ext}`
      const up = await wx.cloud.uploadFile({ cloudPath, filePath: tempPath })
      await this.saveAvatar(up.fileID)
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '上传失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async saveAvatar(avatarUrl) {
    const res = await callApi('saveProfile', {
      nickName: this.data.nickName.trim() || '还没起名字',
      avatarUrl
    })
    const app = getApp()
    if (app.globalData.user) {
      app.globalData.user.nickName = res.nickName
      app.globalData.user.avatarUrl = res.avatarUrl
    }
    this.setData({ avatarUrl: res.avatarUrl, nickName: res.nickName })
    await app.refreshMembers()
    wx.showToast({ title: '头像已更新' })
  },

  async saveNick() {
    try {
      const res = await callApi('saveProfile', {
        nickName: this.data.nickName.trim() || '还没起名字',
        avatarUrl: this.data.avatarUrl
      })
      const app = getApp()
      if (app.globalData.user) {
        app.globalData.user.nickName = res.nickName
        if (res.avatarUrl) app.globalData.user.avatarUrl = res.avatarUrl
      }
      await app.refreshMembers()
      wx.showToast({ title: '已保存' })
    } catch (err) {
      console.error(err)
    }
  },

  async create() {
    if (this.data.creating) return
    this.setData({ creating: true })
    wx.showLoading({ title: '生成邀请码', mask: true })
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('请求超时，请重试')), 15000))
    try {
      const call = wx.cloud.callFunction({
        name: 'bindCouple',
        data: { action: 'create', togetherSince: this.data.togetherSince || '' }
      })
      const res = await Promise.race([call, timeout])
      console.log('bindCouple create', res)
      const result = (res && res.result) || {}
      if (!result.ok) {
        wx.showToast({ title: String(result.message || '生成失败').slice(0, 30), icon: 'none' })
        return
      }
      const app = getApp()
      if (app.globalData.user) app.globalData.user.coupleId = result.coupleId
      await app.refreshCouple()
      await this.sync()
      wx.showToast({ title: '已生成' })
    } catch (err) {
      console.error('create failed', err)
      const msg = String((err && (err.errMsg || err.message)) || '生成失败').slice(0, 30)
      wx.showToast({ title: msg, icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ creating: false })
    }
  },

  async join() {
    const code = (this.data.joinCode || '').trim().toUpperCase()
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '加入中' })
    try {
      const res = await wx.cloud.callFunction({
        name: 'bindCouple',
        data: {
          action: 'join',
          code,
          togetherSince: this.data.togetherSince
        }
      })
      console.log('bindCouple join', res)
      const result = (res && res.result) || {}
      if (!result.ok) {
        wx.showToast({ title: result.message || '加入失败', icon: 'none' })
        return
      }
      const app = getApp()
      if (app.globalData.user) app.globalData.user.coupleId = result.coupleId
      await app.refreshCouple()
      await this.sync()
      wx.showToast({ title: '绑定成功' })
    } catch (err) {
      console.error('join failed', err)
      wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async saveTogether() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'bindCouple',
        data: { action: 'updateTogether', togetherSince: this.data.togetherSince }
      })
      const result = (res && res.result) || {}
      if (result.ok) {
        await getApp().refreshCouple()
        wx.showToast({ title: '已更新' })
      } else {
        wx.showToast({ title: result.message || '更新失败', icon: 'none' })
      }
    } catch (err) {
      console.error('saveTogether failed', err)
      wx.showToast({ title: '更新失败', icon: 'none' })
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
  },

  goPet() {
    wx.navigateTo({ url: '/pages/pet/index' })
  },

  goMoments() {
    wx.navigateTo({ url: '/pages/moments/index' })
  },

  async unbind() {
    const ok = await wx.showModal({
      title: '退出情侣空间？',
      content: '退出后空间数据会保留，双方都回到未绑定；用旧邀请码可和原TA恢复数据，和新人绑定则开启新空间。',
      confirmText: '退出',
      confirmColor: '#c94b5c'
    })
    if (!ok.confirm) return
    this.setData({ unbinding: true })
    try {
      await callApi('unbind')
      getApp().clearCoupleLocal()
      this.setData({
        inviteCode: '',
        paired: false,
        pending: false,
        memberCount: 0,
        partnerName: '',
        partnerAvatar: ''
      })
      wx.showToast({ title: '已退出' })
    } catch (err) {
      console.error(err)
    } finally {
      this.setData({ unbinding: false })
    }
  }
})
