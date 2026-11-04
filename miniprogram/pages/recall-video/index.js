const { callApi } = require('../../utils/cloud')

function pad(n) { return String(n).padStart(2, '0') }

Page({
  data: {
    loading: true,
    photos: [],
    idx: 0,
    cur: null,
    fadeOn: false,
    playing: true,
    year: 0,
    count: 0,
    names: '',
    progress: 0
  },

  onLoad() { this.load() },
  onUnload() { this.stop() },
  onHide() { this.stop() },

  async load() {
    try {
      const res = await callApi('albumList', { limit: 60 }, { silent: true })
      let photos = (res.list || []).filter((p) => p.url)
      const now = new Date()
      const y = now.getFullYear()
      let yearPhotos = photos.filter((p) => new Date(p.createdAt).getFullYear() === y)
      if (yearPhotos.length < 3) yearPhotos = photos
      yearPhotos = yearPhotos.slice(0, 30)
      const names = [...new Set(yearPhotos.map((p) => p.byName).filter(Boolean))].join(' & ')
      const year = yearPhotos.length ? new Date(yearPhotos[0].createdAt).getFullYear() : y
      this.setData({ photos: yearPhotos, count: yearPhotos.length, names, year, loading: false })
      if (yearPhotos.length) {
        this.show(0)
        this.play()
      }
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  show(i) {
    const photos = this.data.photos
    if (!photos.length) return
    const idx = ((i % photos.length) + photos.length) % photos.length
    const p = photos[idx]
    const d = new Date(p.createdAt)
    const dateLabel = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
    this.setData({
      idx,
      cur: { ...p, dateLabel },
      fadeOn: false,
      progress: Math.round(((idx + 1) / photos.length) * 100)
    })
    setTimeout(() => { if (this.data.cur) this.setData({ fadeOn: true }) }, 30)
  },

  play() {
    this.stop()
    this._timer = setInterval(() => this.show(this.data.idx + 1), 2400)
    this.setData({ playing: true })
  },
  stop() {
    if (this._timer) clearInterval(this._timer)
    this._timer = null
  },
  togglePlay() {
    if (this.data.playing) { this.stop(); this.setData({ playing: false }) }
    else this.play()
  },
  prev() { this.show(this.data.idx - 1); this.play() },
  next() { this.show(this.data.idx + 1); this.play() },

  savePhoto() {
    const cur = this.data.cur
    if (!cur || !cur.url) return
    const save = (filePath) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => { wx.hideLoading(); wx.showToast({ title: '已保存到相册 ♡', icon: 'none' }) },
        fail: (err) => {
          wx.hideLoading()
          const m = String((err && err.errMsg) || '')
          if (m.includes('auth') || m.includes('deny') || m.includes('permission')) {
            wx.showModal({
              title: '需要相册权限',
              content: '请在设置里允许「保存到相册」后再试',
              confirmText: '去设置',
              success: (r) => { if (r.confirm && wx.openSetting) wx.openSetting({}) }
            })
          } else if (!m.includes('cancel')) {
            wx.showToast({ title: '保存失败', icon: 'none' })
          }
        }
      })
    }
    wx.showLoading({ title: '保存中…', mask: true })
    if (String(cur.url).startsWith('cloud://')) {
      wx.cloud.downloadFile({
        fileID: cur.url,
        success: (res) => save(res.tempFilePath),
        fail: () => { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }) }
      })
      return
    }
    wx.downloadFile({
      url: cur.url,
      success: (res) => {
        if (res.statusCode !== 200 || !res.tempFilePath) { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }); return }
        save(res.tempFilePath)
      },
      fail: () => { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }) }
    })
  }
})
