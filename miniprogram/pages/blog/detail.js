const { callApi, shareCard } = require('../../utils/cloud')
const interact = require('../../utils/interact')
const { formatDateTime } = require('../../utils/date')

const QUICK_EMOJIS = ['😘', '🥰', '😂', '😭', '👏', '🔥']

Page({
  data: {
    post: null,
    mine: false,
    authorName: '',
    timeText: '',
    likeCount: 0, likedByMe: false, comments: [], commentInput: '', sending: false, liking: false,
    reactions: [], quickEmojis: QUICK_EMOJIS, partnerName: 'TA', replyTo: { id: '', name: '' }
  },

  onShareAppMessage() { const p = this.data.post || {}; return shareCard(p.title || '我们的一封情书 ♡') },

  onLoad(query) {    this._id = query.id
    this.load()
  },

  async load() {
    const app = getApp()
    await app.whenReady()
    let detail = null
    try {
      const res = await callApi('getPost', { id: this._id })
      detail = res.detail
    } catch (err) {
      console.warn('getPost failed', err)
    }
    if (!detail) return
    const urls = detail.photoUrls || {}
    const partner = app.globalData.partner
    this.setData({
      post: { ...detail, photos: (detail.photos || []).map((p) => urls[p] || p) },
      mine: detail._openid === app.globalData.openid,
      authorName: detail.authorName || app.memberName(detail._openid),
      partnerName: (partner && partner.nickName) || 'TA',
      timeText: formatDateTime(detail.createdAt),
      likeCount: detail.likeCount || 0,
      likedByMe: !!detail.likedByMe
    })
    this.loadComments()
  },

  async loadComments() {
    try {
      const res = await interact.listInteractions('post', this._id)
      this.setData({ likeCount: res.likeCount, likedByMe: res.likedByMe, comments: interact.decorateComments(res.comments), reactions: res.reactions || [] })
    } catch (e) {}
  },

  async toggleLike() {
    if (this.data.liking) return
    this.setData({ liking: true })
    try {
      const res = await interact.toggleLike('post', this._id)
      this.setData({ likedByMe: res.liked, likeCount: res.likeCount })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    } catch (e) {} finally { this.setData({ liking: false }) }
  },
  async toggleReaction(e) {
    const emoji = e.currentTarget.dataset.emoji
    if (!emoji) return
    try {
      const res = await interact.toggleReaction('post', this._id, emoji)
      this.setData({ reactions: res.reactions || [] })
      wx.vibrateShort && wx.vibrateShort({ type: 'light' })
    } catch (e) {}
  },

  onCommentInput(e) { this.setData({ commentInput: e.detail.value }) },
  onReply(e) {
    this.setData({ replyTo: { id: e.currentTarget.dataset.id, name: e.currentTarget.dataset.name } })
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
      const res = await interact.addComment('post', this._id, content, reply.id, reply.name)
      const c = { ...res.comment, timeText: interact.relativeTime(res.comment.createdAt) }
      this.setData({ comments: this.data.comments.concat(c), commentInput: '', replyTo: { id: '', name: '' } })
    } catch (e) {} finally { this.setData({ sending: false }) }
  },
  removeComment(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条评论？', confirmColor: '#e86a7a',
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
    const urls = this.data.post.photos || []
    wx.previewImage({
      current: e.currentTarget.dataset.src,
      urls
    })
  },

  edit() {
    wx.navigateTo({ url: `/pages/blog/edit?id=${this._id}` })
  },

  async remove() {
    const ok = await wx.showModal({ title: '删除这篇文章？', confirmColor: '#e86a7a' })
    if (!ok.confirm) return
    try {
      await callApi('removePost', { id: this._id })
      wx.navigateBack()
    } catch (err) {
      console.error(err)
    }
  }
})
