App({
  globalData: {
    envId: '',
    openid: '',
    user: null,
    couple: null,
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

  async bootstrap() {
    try {
      const login = await wx.cloud.callFunction({ name: 'login' })
      this.globalData.openid = login.result.openid
      this.globalData.user = login.result.user
      await this.refreshCouple()
    } catch (err) {
      console.warn('cloud bootstrap failed', err)
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
      return null
    }
    const { data } = await this.db().collection('couples').doc(user.coupleId).get()
    this.globalData.couple = data
    return data
  }
})
