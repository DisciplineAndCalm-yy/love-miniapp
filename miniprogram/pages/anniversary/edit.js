const { requireCouple, callApi } = require('../../utils/cloud')
const { todayKey } = require('../../utils/date')

const COLORS = ['#E86A7A', '#D4A574', '#7AA3C9', '#C9A0DC', '#7BC4A0']

Page({
  data: {
    id: '',
    title: '',
    date: todayKey(),
    repeatYearly: true,
    emoji: '♡',
    color: '#E86A7A',
    colors: COLORS,
    note: ''
  },

  onLoad(query) {
    if (query.id) {
      this.setData({ id: query.id })
      this.load(query.id)
    }
  },

  async load(id) {
    const { data } = await getApp().db().collection('anniversaries').doc(id).get()
    this.setData({
      title: data.title,
      date: data.date,
      repeatYearly: !!data.repeatYearly,
      emoji: data.emoji || '♡',
      color: data.color || '#E86A7A',
      note: data.note || ''
    })
  },

  onTitle(e) { this.setData({ title: e.detail.value }) },
  onNote(e) { this.setData({ note: e.detail.value }) },
  onEmoji(e) { this.setData({ emoji: e.detail.value }) },
  onDate(e) { this.setData({ date: e.detail.value }) },
  onRepeat(e) { this.setData({ repeatYearly: e.detail.value }) },
  onColor(e) { this.setData({ color: e.currentTarget.dataset.color }) },

  async save() {
    if (!requireCouple()) return
    const title = this.data.title.trim()
    if (!title || !this.data.date) {
      wx.showToast({ title: '标题和日期必填', icon: 'none' })
      return
    }
    try {
      await callApi('saveAnniversary', {
        id: this.data.id,
        title,
        date: this.data.date,
        repeatYearly: this.data.repeatYearly,
        emoji: this.data.emoji,
        color: this.data.color,
        note: this.data.note.trim()
      })
      wx.navigateBack()
    } catch (err) {
      console.error(err)
    }
  },

  async remove() {
    if (!this.data.id) return
    const ok = await wx.showModal({ title: '删除这个纪念日？', confirmColor: '#e86a7a' })
    if (!ok.confirm) return
    try {
      await callApi('removeAnniversary', { id: this.data.id })
      wx.navigateBack()
    } catch (err) {
      console.error(err)
    }
  }
})
