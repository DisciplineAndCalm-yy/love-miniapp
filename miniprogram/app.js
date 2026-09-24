App({
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

    this.bootstrap()
  },

  onShow() {
    this.startChatBadge()
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

  // ===== 悄悄话未读角标 =====
  _chatBadgeTimer: null,
  startChatBadge() {
    this.stopChatBadge()
    this.refreshChatBadge()
    this._chatBadgeTimer = setInterval(() => this.refreshChatBadge(), 15000)
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
  async refreshChatBadge() {
    try {
      await this.whenReady()
      if (!this.globalData.couple) return
      const k = this.chatReadKey()
      const readTs = k ? (wx.getStorageSync(k) || 0) : 0
      const res = await wx.cloud.callFunction({ name: 'api', data: { action: 'chatUnread', since: readTs } })
      const n = (res.result && res.result.count) || 0
      if (n > 0) {
        wx.setTabBarBadge({ index: 2, text: n > 99 ? '99+' : String(n) })
      } else {
        try { wx.removeTabBarBadge({ index: 2 }) } catch (e) {}
      }
    } catch (e) {}
  }
})
