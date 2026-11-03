App({
  // 每次发版改这里,双方个人中心底部对比版本号,不一致就是有人没更新
  version: '1.6.1',
  globalData: {
    envId: 'cloud1-6gmcszx1cf01cffb',
    openid: '',
    user: null,
    couple: null,
    members: [],
    partner: null,
    ready: false
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '基础库过低',
        content: '请使用 2.2.3 或以上基础库以使用云开发',
        showCancel: false
      })
      return
    }

    wx.cloud.init({
      env: this.globalData.envId || wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true
    })

    console.log('[love-miniapp] version', this.version)

    this.bootstrap()
  },

  onShow() {
    this.startChatBadge()
  },

  onHide() {
    this.stopChatBadge()
  },

  onError(err) {
    console.error('[app onError]', err)
  },

  onUnhandledRejection(res) {
    console.error('[app onUnhandledRejection]', res && (res.reason || res))
  },

  async bootstrap() {
    try {
      const login = await wx.cloud.callFunction({ name: 'login' })
      if (!login || !login.result || !login.result.user) throw new Error('登录失败')
      this.globalData.openid = login.result.openid
      this.globalData.user = login.result.user
      await this.refreshCouple()
    } catch (err) {
      console.warn('cloud bootstrap failed', err)
      wx.showToast({ title: '网络开小差,下拉重试', icon: 'none' })
    } finally {
      this.globalData.ready = true
      this._readyWaiters.forEach((fn) => fn())
      this._readyWaiters = []
    }
  },

  _readyWaiters: [],

  whenReady() {
    if (this.globalData.ready) return Promise.resolve()
    return new Promise((resolve) => this._readyWaiters.push(resolve))
  },

  db() {
    return wx.cloud.database()
  },

  async refreshCouple() {
    const user = this.globalData.user
    if (!user || !user.coupleId) {
      this.globalData.couple = null
      this.globalData.members = []
      this.globalData.partner = null
      return null
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: { action: 'getCouple' }
      })
      const result = (res && res.result) || {}
      if (result.couple) {
        this.globalData.couple = result.couple
        const members = result.members || []
        this.globalData.members = members
        this.globalData.partner = members.find((m) => m.openid !== this.globalData.openid) || null
        return result.couple
      }
      // 云端已无空间(被删除/退出),清掉本地 coupleId
      if (result.ok && !result.couple) {
        if (this.globalData.user) this.globalData.user.coupleId = ''
        this.globalData.couple = null
        this.globalData.members = []
        this.globalData.partner = null
        return null
      }
      return this.globalData.couple
    } catch (err) {
      console.warn('refreshCouple failed', err)
      return this.globalData.couple
    }
  },

  async refreshMembers() {
    const couple = this.globalData.couple
    const openid = this.globalData.openid
    if (!couple) {
      this.globalData.members = []
      this.globalData.partner = null
      return []
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'api',
        data: { action: 'getMembers' }
      })
      if (res.result && res.result.ok) {
        const members = res.result.members || []
        this.globalData.members = members
        this.globalData.partner = members.find((m) => m.openid !== openid) || null
        if (res.result.couple) this.globalData.couple = res.result.couple
        return members
      }
    } catch (err) {
      console.warn('refreshMembers failed', err)
    }
    this.globalData.members = []
    this.globalData.partner = null
    return []
  },

  memberName(openid) {
    if (!openid) return 'TA'
    if (openid === this.globalData.openid) {
      return (this.globalData.user && this.globalData.user.nickName) || '我'
    }
    const found = (this.globalData.members || []).find((m) => m.openid === openid)
    if (found) return found.nickName || 'TA'
    if (this.globalData.partner && this.globalData.partner.openid === openid) {
      return this.globalData.partner.nickName || 'TA'
    }
    return 'TA'
  },

  clearCoupleLocal() {
    if (this.globalData.user) this.globalData.user.coupleId = ''
    this.globalData.couple = null
    this.globalData.members = []
    this.globalData.partner = null
  },

  // ===== tab 角标：一次接口同时刷新悄悄话+互动未读 =====
  _chatBadgeTimer: null,
  startChatBadge() {
    this.stopChatBadge()
    this.refreshBadges()
    this._chatBadgeTimer = setInterval(() => this.refreshBadges(), 20000)
  },
  stopChatBadge() {
    if (this._chatBadgeTimer) clearInterval(this._chatBadgeTimer)
    this._chatBadgeTimer = null
  },
  chatReadKey() {
    const c = this.globalData.couple
    return c ? `chatReadTs_${c._id}_${this.globalData.openid}` : null
  },
  markChatRead(ts) {
    const k = this.chatReadKey()
    if (!k) return
    try { wx.setStorageSync(k, ts || Date.now()) } catch (e) {}
    try { wx.removeTabBarBadge({ index: 2 }) } catch (e) {}
  },
  _itiUnread: 0,
  async refreshBadges() {
    try {
      await this.whenReady()
      if (!this.globalData.couple) return
      const k = this.chatReadKey()
      const readTs = k ? (wx.getStorageSync(k) || 0) : 0
      const res = await wx.cloud.callFunction({ name: 'api', data: { action: 'badges', since: readTs } })
      const r = (res && res.result) || {}
      const chat = r.chat || 0
      const notice = r.notice || 0
      this._itiUnread = notice
      try {
        if (chat > 0) wx.setTabBarBadge({ index: 2, text: chat > 99 ? '99+' : String(chat) })
        else wx.removeTabBarBadge({ index: 2 })
      } catch (e) {}
      try {
        if (notice > 0) wx.setTabBarBadge({ index: 0, text: notice > 99 ? '99+' : String(notice) })
        else wx.removeTabBarBadge({ index: 0 })
      } catch (e) {}
    } catch (e) {}
  }
})
