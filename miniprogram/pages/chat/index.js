const { chatTmplId } = require('../../config')

Page({
  data: {
    list: [],
    input: '',
    loading: true,
    sending: false,
    showQuick: true,
    chatNotifyOn: false,
    chatQuota: 0,
    quicks: ['早安 ♡', '想你了', '在干嘛呀？', '抱抱', '晚安，好梦', '吃饭了吗？', '路上小心', '爱你 ❤️'],
    emojiPanel: false,
    emojis: ['❤️', '😘', '🥺', '😂', '👀', '🫂', '🌙', '☀️', '🍓', '🐱', '🐶', '💤'],
    partnerTyping: false,
    partnerReadAt: 0,
    lastOwnTs: 0,
    peerRead: false,
    keyboardHeight: 0,
    voiceMode: false,
    recording: false,
    playingId: '',
    themeBg: '#FFF1F4'
  },
  pollTimer: null,
  watchConn: null,
  loadDebounce: null,
  lastTs: 0,
  pageTopTs: 0,
  marking: false,

  onLoad() {
    try {
      const th = require('../../utils/theme').themeById(getApp().globalData.theme || 'sakura')
      this.setData({ themeBg: (th.palette && th.palette.bg) || '#FFF1F4' })
      getApp().applyTheme(getApp().globalData.theme)
    } catch (e) {}
    this.load(true); this.initRecorder()
  },
  onShow() {
    this.startRealtime()
    this.load(false).then(() => this.markRead())
    wx.setNavigationBarTitle({ title: '悄悄话 ♡' })
    let on = false
    try { on = !!wx.getStorageSync('chatNotifyOn') } catch (e) {}
    this.setData({ chatNotifyOn: on })
    this.loadQuota()
  },
  async loadQuota() {
    try {
      const { callApi } = require('../../utils/cloud')
      const q = await callApi('getQuota', {}, { silent: true })
      this.setData({ chatQuota: q.chatQuota || 0 })
    } catch (e) {}
  },
  enableChatNotify() {
    if (!chatTmplId) { wx.showToast({ title: '未配置模板', icon: 'none' }); return }
    const { callApi } = require('../../utils/cloud')
    wx.requestSubscribeMessage({
      tmplIds: [chatTmplId],
      success: async (r) => {
        if (r && r[chatTmplId] === 'accept') {
          try {
            await callApi('subChat', {}, { silent: true })
            const sub = await callApi('getQuota', {}, { silent: true })
            try { wx.setStorageSync('chatNotifyOn', true) } catch (e) {}
            this.setData({ chatNotifyOn: true, chatQuota: sub.chatQuota || 0 })
            wx.showToast({ title: `悄悄话剩余 ${sub.chatQuota || 0} 次提醒`, icon: 'none' })
          } catch (e) {
            wx.showToast({ title: '授权成功，但额度记录失败', icon: 'none' })
          }
        } else {
          wx.showToast({ title: '未开启悄悄话提醒', icon: 'none' })
        }
      },
      fail: (err) => wx.showToast({ title: (err && err.errMsg || '订阅失败').slice(0, 30), icon: 'none' })
    })
  },
  onHide() { this.stopRealtime(); this.stopPoll(); this.stopAudio(); if (this.data.keyboardHeight) this.setData({ keyboardHeight: 0 }) },
  onUnload() { this.stopRealtime(); this.stopPoll(); this.stopAudio() },
  onPullDownRefresh() { this.loadMore().finally(() => wx.stopPullDownRefresh()) },
  onPageScroll() {},

  // ===== 实时监听(云开发 watch),失败自动降级为轮询 =====
  startRealtime() {
    this.stopRealtime()
    const app = getApp()
    const couple = app && app.globalData && app.globalData.couple
    if (!couple || !couple._id || !wx.cloud) { this.startPoll(); return }
    try {
      const db = wx.cloud.database()
      this._myOpenid = (app.globalData && app.globalData.openid) || ''
      this.watchConn = db.collection('chats')
        .where({ coupleId: couple._id })
        .orderBy('createdAt', 'desc')
        .limit(20)
        .watch({
          onChange: (snap) => this.onChatChange(snap),
          onError: (err) => this.onWatchError(err)
        })
    } catch (e) {
      console.warn('[chat] watch init failed, fallback to poll', e)
      this.startPoll()
    }
  },
  stopRealtime() {
    if (this.watchConn) {
      try { this.watchConn.close() } catch (e) {}
      this.watchConn = null
    }
    if (this.loadDebounce) { clearTimeout(this.loadDebounce); this.loadDebounce = null }
  },
  onChatChange(snap) {
    if (!snap || snap.type === 'init') return
    const changes = snap.docChanges || []
    if (!changes.length) return
    const incoming = changes.some((c) => c && c.dataType === 'add' && c.doc && c.doc._openid && c.doc._openid !== this._myOpenid)
    if (incoming) { try { wx.vibrateShort({ type: 'light' }) } catch (e) {} }
    this.scheduleReload()
  },
  onWatchError(err) {
    console.warn('[chat] watch error, fallback to poll', err)
    this.stopRealtime()
    this.startPoll()
  },
  scheduleReload() {
    if (this.loadDebounce) return
    this.loadDebounce = setTimeout(() => {
      this.loadDebounce = null
      this.load(false)
    }, 120)
  },

  startPoll() {
    this.stopPoll()
    this.pollTimer = setInterval(() => this.load(false), 4000)
  },
  stopPoll() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
  },

  async markRead() {
    const { callApi } = require('../../utils/cloud')
    if (this.marking) return
    this.marking = true
    try {
      const res = await callApi('markChatRead', {}, { silent: true })
      this.setData({ partnerReadAt: res.partnerReadAt || 0 })
      this.updatePeerRead()
      try { getApp().markChatRead(this.lastTs || Date.now()) } catch (e) {}
    } catch (e) {} finally { this.marking = false }
  },

  updatePeerRead() {
    const { lastOwnTs, partnerReadAt } = this.data
    this.setData({ peerRead: !!(lastOwnTs && partnerReadAt && partnerReadAt >= lastOwnTs) })
  },

  async load(first = false) {
    const { callApi } = require('../../utils/cloud')
    try {
      if (first) this.setData({ loading: true })
      const res = await callApi('listChats', { limit: 50 }, { silent: !first })
      const raw = res.list || []
      const list = raw.map(m => ({ ...m, time: this.fmt(m.createdAt) }))
      const last = list.length ? list[list.length - 1].createdAt : 0
      const isNew = last > this.lastTs
      this.lastTs = last
      const ownTs = [...raw].reverse().find(m => m.isMine)
      this.setData({
        list,
        loading: false,
        partnerReadAt: res.partnerReadAt || this.data.partnerReadAt,
        lastOwnTs: ownTs ? ownTs.createdAt : 0
      })
      this.updatePeerRead()
      if (first || isNew) this.scrollBottom()
      if (isNew || first) this.markRead()
      else if (first) this.markRead()
    } catch (e) { this.setData({ loading: false }) }
  },

  async loadMore() {
    if (this.loadingMore) return
    const { callApi } = require('../../utils/cloud')
    if (!this.data.list.length) return this.load(true)
    const before = this.data.list[0].createdAt
    this.loadingMore = true
    try {
      const res = await callApi('listChats', { limit: 30, before }, { silent: true })
      const more = (res.list || []).map(m => ({ ...m, time: this.fmt(m.createdAt) }))
      if (more.length) {
        this.keepPosition = true
        this.setData({ list: [...more, ...this.data.list], toView: '' })
      }
      else wx.showToast({ title: '没有更早的消息啦', icon: 'none' })
    } catch (e) {} finally { this.loadingMore = false }
  },

  fmt(ts) {
    const d = new Date(ts)
    const p = n => String(n).padStart(2, '0')
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    return sameDay ? `${p(d.getHours())}:${p(d.getMinutes())}` : `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  },

  onInput(e) { this.setData({ input: e.detail.value }) },
  onKeyboardHeight(e) {
    // 自定义底栏是 fixed 定位,系统不会自动上推,这里按键盘高度把输入区顶起来,避免遮挡
    const h = (e && e.detail && e.detail.height) || 0
    if (h === this.data.keyboardHeight) return
    this.setData({ keyboardHeight: h })
    if (h) this.scrollBottom()
  },
  toggleEmoji() { this.setData({ emojiPanel: !this.data.emojiPanel }) },
  addEmoji(e) {
    const ch = e.currentTarget.dataset.ch
    this.setData({ input: (this.data.input || '') + ch })
  },
  sendQuick(e) {
    const text = e.currentTarget.dataset.text
    this.doSend(text, 'text')
  },
  toggleQuick() { this.setData({ showQuick: !this.data.showQuick }) },

  send() {
    const text = (this.data.input || '').trim()
    if (!text) return
    this.doSend(text, 'text')
  },

  async doSend(content, kind) {
    const { callApi } = require('../../utils/cloud')
    if (this.data.sending) return
    this.setData({ sending: true })
    try {
      await callApi('sendChat', { content, kind })
      this.setData({ input: '', emojiPanel: false, peerRead: false })
      await this.load(false)
    } catch (e) {} finally { this.setData({ sending: false }) }
  },

  async sendImage() {
    const { uploadImage } = require('../../utils/cloud')
    try {
      const fileID = await uploadImage(1)
      this.doSend(fileID, 'image')
    } catch (e) {}
  },

  // ===== 语音消息 =====
  initRecorder() {
    if (this.recordMgr) return
    try {
      const rm = wx.getRecorderManager()
      rm.onStop((res) => this.onRecordStop(res))
      rm.onError(() => {
        this.setData({ recording: false })
        wx.showToast({ title: '录音失败，检查麦克风权限', icon: 'none' })
      })
      this.recordMgr = rm
    } catch (e) { this.recordMgr = null }
  },
  toggleVoice() {
    this.setData({ voiceMode: !this.data.voiceMode, emojiPanel: false })
  },
  startRecord() {
    if (this.data.recording) return
    this.initRecorder()
    if (!this.recordMgr) { wx.showToast({ title: '当前环境不支持录音', icon: 'none' }); return }
    this.setData({ recording: true })
    try {
      this.recordMgr.start({ duration: 60000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000 })
    } catch (e) { this.setData({ recording: false }) }
  },
  stopRecord() {
    if (!this.data.recording) return
    this.setData({ recording: false })
    try { this.recordMgr.stop() } catch (e) {}
  },
  async onRecordStop(res) {
    const ms = (res && res.duration) || 0
    if (ms < 1000) { wx.showToast({ title: '太短啦，再按住说一会', icon: 'none' }); return }
    const { callApi } = require('../../utils/cloud')
    const duration = Math.min(120, Math.max(1, Math.round(ms / 1000)))
    wx.showLoading({ title: '发送中…' })
    try {
      const p = (res.tempFilePath || '').split('.')
      const ext = p.length > 1 ? p[p.length - 1] : 'mp3'
      const cloudPath = `love/voice-${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`
      const up = await wx.cloud.uploadFile({ cloudPath, filePath: res.tempFilePath })
      if (!up || !up.fileID) throw new Error('upload failed')
      await callApi('sendChat', { content: up.fileID, kind: 'voice', duration })
      await this.load(false)
    } catch (e) {
      wx.showToast({ title: '语音发送失败', icon: 'none' })
    } finally { wx.hideLoading() }
  },
  playVoice(e) {
    const src = e.currentTarget.dataset.src
    const id = e.currentTarget.dataset.id
    if (!src) return
    this.stopAudio()
    try {
      const audio = wx.createInnerAudioContext()
      this._audio = audio
      audio.src = src
      this.setData({ playingId: id })
      audio.onEnded(() => this.setData({ playingId: '' }))
      audio.onError(() => { this.setData({ playingId: '' }); wx.showToast({ title: '播放失败', icon: 'none' }) })
      audio.play()
    } catch (err) { this.setData({ playingId: '' }) }
  },
  stopAudio() {
    if (this._audio) {
      try { this._audio.stop(); this._audio.destroy() } catch (e) {}
      this._audio = null
    }
    if (this.data.playingId) this.setData({ playingId: '' })
  },

  preview(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({ urls: [url], current: url })
  },

  imgError(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.list.map((m) => {
      if (m._id === id && m.url) return { ...m, url: '' }
      return m
    })
    this.setData({ list })
  },

  recall(e) {
    const id = e.currentTarget.dataset.id
    const { callApi } = require('../../utils/cloud')
    wx.showModal({
      title: '撤回这条消息？', content: '对方也会看不到这条', confirmText: '撤回',
      success: async (r) => {
        if (!r.confirm) return
        try { await callApi('recallChat', { id }); this.load(false) } catch (err) {}
      }
    })
  },

  scrollBottom() {
    this.setData({ toView: '' })
    wx.nextTick(() => {
      this.setData({ toView: 'bottom-anchor' })
    })
  }
})
