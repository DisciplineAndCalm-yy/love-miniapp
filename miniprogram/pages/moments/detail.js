const { callApi, shareCard } = require('../../utils/cloud')
const interact = require('../../utils/interact')
const { doingIcon } = require('../../utils/mood')

const QUICK_EMOJIS = ['😘', '🥰', '😂', '😭', '👏', '🔥']

Page({
  data: {
    detail: null, time: '', icon: '💌', mine: false,
    likeCount: 0, likedByMe: false, comments: [], commentInput: '', sending: false, liking: false,
    reactions: [], quickEmojis: QUICK_EMOJIS, partnerName: 'TA', replyTo: { id: '', name: '' }
  },
  onShareAppMessage() { const m = this.data.detail || {}; return shareCard(m.content ? `我们的日常：${m.content}` : '我们的一天 ♡') },
  onLoad(o) { this.id = o.id; this.load() },
  async load() {
    try {
      const app = getApp()
      await app.whenReady()
      const partner = app.globalData.partner
      const res = await callApi('getMoment', { id: this.id })
      const d = new Date(res.detail.createdAt)
      const p = (n) => String(n).padStart(2, '0')
      this.setData({
        detail: res.detail,
        icon: doingIcon(res.detail.doing),
        mine: res.detail._openid === app.globalData.openid,
        partnerName: (partner && partner.nickName) || 'TA',
        time: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`,
        likeCount: res.detail.likeCount || 0,
        likedByMe: !!res.detail.likedByMe
      })
      this.loadComments()
    } catch (e) { wx.showToast({ title: '加载失败', icon: 'none' }) }
  },
  async loadComments() {
    try {
      const res = await interact.listInteractions('moment', this.id)
      this.setData({ likeCount: res.likeCount, likedByMe: res.likedByMe, comments: interact.decorateComments(res.comments), reactions: res.reactions || [] })
    } catch (e) {}
  },
  async toggleLike() {
    if (this.data.liking) return
    this.setData({ liking: true })
    try {
      const res = await interact.toggleLike('moment', this.id)
      this.setData({ likedByMe: res.liked, likeCount: res.likeCount })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    } catch (e) {} finally { this.setData({ liking: false }) }
  },
  async toggleReaction(e) {
    const emoji = e.currentTarget.dataset.emoji
    if (!emoji) return
    try {
      const res = await interact.toggleReaction('moment', this.id, emoji)
      this.setData({ reactions: res.reactions || [] })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    } catch (e) {}
  },
  onCommentInput(e) { this.setData({ commentInput: e.detail.value }) },
  onReply(e) {
    const id = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    this.setData({ replyTo: { id, name } })
    wx.pageScrollTo && wx.pageScrollTo({ selector: '.cmt-input', duration: 200 })
  },
  cancelReply() { this.setData({ replyTo: { id: '', name: '' } }) },
  onAt() {
    const name = this.data.partnerName && this.data.partnerName !== 'TA' ? this.data.partnerName : 'TA'
    const cur = this.data.commentInput || ''
    const sep = cur && !/\s$/.test(cur) ? ' ' : ''
    this.setData({ commentInput: cur + sep + '@' + name + ' ' })
  },
  async sendComment() {
    const content = (this.data.commentInput || '').trim()
    if (!content || this.data.sending) return
    this.setData({ sending: true })
    const reply = this.data.replyTo || { id: '', name: '' }
    try {
      const res = await interact.addComment('moment', this.id, content, reply.id, reply.name)
      const c = { ...res.comment, timeText: interact.relativeTime(res.comment.createdAt) }
      this.setData({ comments: this.data.comments.concat(c), commentInput: '', replyTo: { id: '', name: '' } })
    } catch (e) {} finally { this.setData({ sending: false }) }
  },
  removeComment(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条评论？', confirmColor: '#c94b5c',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await interact.removeComment(id)
          this.setData({ comments: this.data.comments.filter((c) => c._id !== id) })
        } catch (err) {}
      }
    })
  },
  preview(e) {
    const urls = (this.data.detail.photos || []).map((p) => (this.data.detail.photoUrls || {})[p] || p)
    wx.previewImage({ urls, current: e.currentTarget.dataset.src })
  },
  async remove() {
    const ok = await wx.showModal({ title: '删除这条动态？', confirmColor: '#c94b5c' })
    if (!ok.confirm) return
    await callApi('removeMoment', { id: this.id })
    wx.showToast({ title: '已删除' })
    wx.navigateBack()
  },
})
