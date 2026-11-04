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
  data: { tags: TAGS, doing: '吃饭', content: '', photos: [], place: '', saving: false },
  pickTag(e) { this.setData({ doing: e.currentTarget.dataset.t }) },
  onContent(e) { this.setData({ content: e.detail.value }) },
  choosePlace() {
    wx.chooseLocation({
      success: (res) => {
        const name = (res && (res.name || res.address)) || ''
        if (name) this.setData({ place: String(name).slice(0, 40) })
      },
      fail: (err) => {
        const msg = String((err && err.errMsg) || '')
        if (msg.includes('cancel')) return
        if (msg.includes('auth') || msg.includes('permission') || msg.includes('deny')) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置里允许位置权限后再选择地点',
            confirmText: '去设置',
            success: (r) => { if (r.confirm && wx.openSetting) wx.openSetting({}) }
          })
          return
        }
        wx.showToast({ title: '地图选点不可用', icon: 'none' })
      }
    })
  },
  clearPlace() { this.setData({ place: '' }) },
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
      await callApi('saveMoment', { doing: this.data.doing, content: this.data.content.trim(), photos: this.data.photos, place: this.data.place })
      wx.showToast({ title: '已记录' })
      wx.navigateBack()
    } catch (e) { wx.showToast({ title: '发布失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
})
