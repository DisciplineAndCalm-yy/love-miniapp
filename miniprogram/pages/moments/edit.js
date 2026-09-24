const { callApi, uploadImage } = require('../../utils/cloud')
const TAGS = [
  { t: '吃饭', icon: '🍱' },
  { t: '午睡', icon: '😴' },
  { t: '上厕所', icon: '🚻' },
  { t: '上班', icon: '💼' },
  { t: '通勤', icon: '🚇' },
  { t: '运动', icon: '🏃' },
  { t: '追剧', icon: '📺' },
  { t: '出门', icon: '🌳' },
  { t: '日常', icon: '✨' }
]
Page({
  data: { tags: TAGS, doing: '吃饭', content: '', photos: [], saving: false },
  pickTag(e) { this.setData({ doing: e.currentTarget.dataset.t }) },
  onContent(e) { this.setData({ content: e.detail.value }) },
  async addPhoto() {
    const left = 6 - this.data.photos.length
    if (left <= 0) { wx.showToast({ title: '最多6张', icon: 'none' }); return }
    try {
      const ids = await uploadImage(left)
      const arr = Array.isArray(ids) ? ids : [ids]
      this.setData({ photos: this.data.photos.concat(arr).slice(0, 6) })
    }
    catch (e) { if (e && e.errMsg && e.errMsg.includes('cancel')) return; wx.showToast({ title: '上传失败', icon: 'none' }) }
  },
  delPhoto(e) { const i = e.currentTarget.dataset.i; this.setData({ photos: this.data.photos.filter((_, k) => k !== i) }) },
  async submit() {
    if (this.data.saving) return
    if (!this.data.content.trim() && !this.data.photos.length) { wx.showToast({ title: '写点什么吧', icon: 'none' }); return }
    this.setData({ saving: true })
    try {
      await callApi('saveMoment', { doing: this.data.doing, content: this.data.content.trim(), photos: this.data.photos })
      wx.showToast({ title: '已记录' })
      wx.navigateBack()
    } catch (e) { wx.showToast({ title: '发布失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
})
