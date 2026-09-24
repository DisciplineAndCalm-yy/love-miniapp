Page({
  data: {
    list: [],
    input: '',
    loading: true,
    sending: false,
    showQuick: true,
    quicks: ['早安 ♡', '想你了', '在干嘛呀？', '抱抱', '晚安，好梦', '吃饭了吗？', '路上小心', '爱你 ❤️'],
    emojiPanel: false,
    emojis: ['❤️', '😘', '🥺', '😂', '👀', '🫂', '🌙', '☀️', '🍓', '🐱', '🐶', '💤'],
    partnerTyping: false,
    partnerReadAt: 0,
    lastOwnTs: 0,
    peerRead: false
  },
  pollTimer: null,
  lastTs: 0,
  pageTopTs: 0,
  marking: false,

  onLoad() { this.load(true) },
  onShow() {
    this.startPoll()
    this.load(false).then(() => this.markRead())
    wx.setNavigationBarTitle({ title: '悄悄话 ♡' })
  },
  onHide() { this.stopPoll() },
  onUnload() { this.stopPoll() },
  onPullDownRefresh() { this.loadMore().finally(() => wx.stopPullDownRefresh()) },
  onPageScroll() {},

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
