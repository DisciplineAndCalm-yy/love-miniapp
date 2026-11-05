const { callApi } = require('../../utils/cloud')
const { relativeTime } = require('../../utils/interact')
const { noticeTmplId } = require('../../config')

const KIND_META = {
  'interaction:like': { icon: '❤️', text: '赞了你的内容' },
  'interaction:comment': { icon: '💬', text: '评论了你的内容' },
  'interaction:reaction': { icon: '😘', text: '回应了你' },
  checkin: { icon: '🗓️', text: '今天签到了' },
  night: { icon: '🌙', text: '说了晚安' }
}

Page({
  data: {
    feed: [],
    loading: true,
    unread: 0,
    noticeOn: false,
    noticeQuota: null,
    canPush: !!noticeTmplId
  },

  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },

  async load() {
    this.setData({ loading: true })
    try {
      const res = await callApi('notificationList', {}, { silent: true })
      const feed = (res.feed || []).map((f, i) => {
        const key = f.kind === 'interaction' ? `interaction:${f.type}` : f.kind
        const meta = KIND_META[key] || { icon: '🔔', text: '' }
        return {
          ...f,
          id: 'n' + i,
          icon: meta.icon,
          label: f.kind === 'interaction'
            ? (f.type === 'like' ? '赞了你的内容' : (f.type === 'reaction' ? `用 ${f.content} 回应了你` : `评论了你：${f.content}`))
            : (f.kind === 'checkin' ? `今天签到了：${f.content || '已盖章'}` : `说：${f.content || '晚安 ♡'}`),
          timeText: f.createdAt ? relativeTime(f.createdAt) : '今天'
        }
      })
      this.setData({ feed, unread: res.unread || 0, noticeQuota: (typeof res.noticeQuota === 'number' ? res.noticeQuota : 0), loading: false })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  open(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    const { targetType, targetId, kind } = item
    if (kind === 'night') return wx.navigateTo({ url: '/pkgFun/pages/night/index' })
    if (targetType === 'moment' && targetId) return wx.navigateTo({ url: `/pages/moments/detail?id=${targetId}` })
    if (targetType === 'post' && targetId) return wx.navigateTo({ url: `/pages/blog/detail?id=${targetId}` })
    if (targetType === 'checkin') return wx.switchTab({ url: '/pages/checkin/index' })
  },

  async markAllRead() {
    if (!this.data.unread) return
    try {
      await callApi('markInteractionRead', {}, { silent: true })
      const feed = this.data.feed.map((f) => ({ ...f, unread: false }))
      this.setData({ feed, unread: 0 })
      wx.showToast({ title: '都看过啦 ♡', icon: 'none' })
    } catch (e) {}
  },

  // 订阅微信服务通知(需先在控制台配置模板 ID 并在 config.js 填入)
  async enablePush() {
    if (!noticeTmplId) {
      wx.showToast({ title: '还差模板 ID 配置', icon: 'none' })
      return
    }
    try {
      const r = await wx.requestSubscribeMessage({ tmplIds: [noticeTmplId] })
      if (r[noticeTmplId] === 'accept') {
        const res = await callApi('enableNoticePush', { enabled: true })
        const quota = (res && typeof res.noticeQuota === 'number') ? res.noticeQuota : 1
        this.setData({ noticeOn: true, noticeQuota: quota })
        wx.showToast({ title: '已订阅，可接收 1 条提醒 ♡', icon: 'none' })
      }
    } catch (e) {}
  }
})
