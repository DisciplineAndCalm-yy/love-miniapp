const { callApi, shareCard } = require('../../utils/cloud')

function pad(n) { return String(n).padStart(2, '0') }
function dayKey(ts) { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function dayLabel(ts) {
  const d = new Date(ts)
  const now = new Date()
  const base = `${d.getMonth() + 1}月${d.getDate()}日`
  if (d.toDateString() === now.toDateString()) return `今天 · ${base}`
  const y = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
  if (d.toDateString() === y.toDateString()) return `去年今天 · ${base}`
  return `${d.getFullYear()}年 ${base}`
}
function fmtTime(ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }

function buildGroups(list) {
  const map = {}
  const order = []
  ;(list || []).forEach((p) => {
    const k = dayKey(p.createdAt)
    if (!map[k]) { map[k] = { key: k, label: dayLabel(p.createdAt), items: [] }; order.push(k) }
    map[k].items.push({ ...p, time: fmtTime(p.createdAt) })
  })
  return order.map((k) => map[k])
}

const SOURCE_NAME = { checkin: '签到', moment: '动态', post: '文章' }

Page({
  data: {
    groups: [],
    photos: [],
    total: 0,
    filteredCount: 0,
    memories: [],
    loading: true,
    hasMore: true,
    nextBefore: 0,
    loadingMore: false,
    // 筛选
    timeFilter: 'all',
    sourceFilter: 'all',
    timeTabs: [
      { id: 'all', name: '全部' },
      { id: 'month', name: '本月' },
      { id: 'year', name: '今年' },
      { id: 'past', name: '往年' }
    ],
    sourceTabs: [
      { id: 'all', name: '全部来源' },
      { id: 'checkin', name: '签到' },
      { id: 'moment', name: '动态' },
      { id: 'post', name: '文章' }
    ],
    tagFilter: 'all',
    tagTabs: [{ id: 'all', name: '全部标签' }],
    placeFilter: 'all',
    placeTabs: [{ id: 'all', name: '全部地点' }],
    // 看图 / 点赞评论
    lbShow: false,
    lbItem: null,
    lbLiked: false,
    lbLikes: 0,
    lbComments: [],
    lbLoading: false,
    lbInput: '',
    lbSource: '',
    // 年度回忆册
    posterShow: false,
    posterYear: 0,
    posterCount: 0,
    posterPhotos: [],
    posterNames: ''
  },

  onShow() { this.reload() },
  onPullDownRefresh() { this.reload().finally(() => wx.stopPullDownRefresh()) },
  onReachBottom() { this.more() },
  onShareAppMessage() { return shareCard('我们的相册，藏满回忆 ♡') },

  async reload() {
    this.setData({ loading: true })
    this.loadMemories()
    try {
      const res = await callApi('albumList', { limit: 60 }, { silent: true })
      const photos = res.list || []
      this.setData({
        photos,
        total: photos.length,
        hasMore: !!res.hasMore,
        nextBefore: res.nextBefore || 0
      })
      this.computeTagTabs()
      this.computePlaceTabs()
      this.applyFilter()
    } catch (e) {}
    this.setData({ loading: false })
  },

  async more() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return
    this.setData({ loadingMore: true })
    try {
      const res = await callApi('albumList', { before: this.data.nextBefore, limit: 60 }, { silent: true })
      const photos = this.data.photos.concat(res.list || [])
      this.setData({
        photos,
        total: photos.length,
        hasMore: !!res.hasMore,
        nextBefore: res.nextBefore || 0
      })
      this.computeTagTabs()
      this.computePlaceTabs()
      this.applyFilter()
    } catch (e) {} finally { this.setData({ loadingMore: false }) }
  },

  applyFilter() {
    const { photos, timeFilter, sourceFilter, tagFilter, placeFilter } = this.data
    let arr = photos
    if (sourceFilter !== 'all') arr = arr.filter((p) => p.source === sourceFilter)
    if (tagFilter !== 'all') arr = arr.filter((p) => (p.tag || '日常') === tagFilter)
    if (placeFilter !== 'all') arr = arr.filter((p) => (p.place || '') === placeFilter)
    if (timeFilter !== 'all') {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth()
      arr = arr.filter((p) => {
        const d = new Date(p.createdAt)
        if (timeFilter === 'month') return d.getFullYear() === y && d.getMonth() === m
        if (timeFilter === 'year') return d.getFullYear() === y
        if (timeFilter === 'past') return d.getFullYear() < y
        return true
      })
    }
    this.setData({ groups: buildGroups(arr), filteredCount: arr.length })
  },

  setTimeFilter(e) {
    this.setData({ timeFilter: e.currentTarget.dataset.id }, () => this.applyFilter())
  },
  setSourceFilter(e) {
    this.setData({ sourceFilter: e.currentTarget.dataset.id }, () => this.applyFilter())
  },
  setTagFilter(e) {
    this.setData({ tagFilter: e.currentTarget.dataset.id }, () => this.applyFilter())
  },
  computeTagTabs() {
    const map = {}
    this.data.photos.forEach((p) => { const t = p.tag || '日常'; map[t] = (map[t] || 0) + 1 })
    const tabs = Object.keys(map).sort((a, b) => map[b] - map[a]).slice(0, 12).map((t) => ({ id: t, name: `${t} ${map[t]}` }))
    let tagFilter = this.data.tagFilter
    if (tagFilter !== 'all' && !map[tagFilter]) tagFilter = 'all'
    this.setData({ tagTabs: [{ id: 'all', name: '全部标签' }].concat(tabs), tagFilter })
  },
  setPlaceFilter(e) {
    this.setData({ placeFilter: e.currentTarget.dataset.id }, () => this.applyFilter())
  },
  computePlaceTabs() {
    const map = {}
    this.data.photos.forEach((p) => { const t = p.place; if (t) map[t] = (map[t] || 0) + 1 })
    const tabs = Object.keys(map).sort((a, b) => map[b] - map[a]).slice(0, 12).map((t) => ({ id: t, name: `${t} ${map[t]}` }))
    let placeFilter = this.data.placeFilter
    if (placeFilter !== 'all' && !map[placeFilter]) placeFilter = 'all'
    this.setData({ placeTabs: [{ id: 'all', name: '全部地点' }].concat(tabs), placeFilter })
  },

  async loadMemories() {
    try {
      const res = await callApi('onThisDay', {}, { silent: true })
      this.setData({ memories: res.items || [] })
    } catch (e) { this.setData({ memories: [] }) }
  },

  preview(e) {
    const urls = this.data.photos.map((p) => p.url).filter(Boolean)
    wx.previewImage({ urls, current: e.currentTarget.dataset.url })
  },

  // ===== 看图 + 点赞评论 =====
  openLightbox(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    this.setData({
      lbShow: true,
      lbItem: item,
      lbSource: SOURCE_NAME[item.source] || '照片',
      lbLiked: !!item.liked,
      lbLikes: item.likeCount || 0,
      lbComments: [],
      lbInput: '',
      lbLoading: true
    })
    this.loadComments()
  },

  closeLightbox() { this.setData({ lbShow: false, lbItem: null }) },

  async loadComments() {
    const item = this.data.lbItem
    if (!item || !item.key) { this.setData({ lbLoading: false }); return }
    try {
      const res = await callApi('photoComments', { photoKey: item.key }, { silent: true })
      this.setData({
        lbLiked: !!res.likedByMe,
        lbLikes: res.likeCount || 0,
        lbComments: (res.comments || []).map((c) => ({ ...c, time: this.fmtShort(c.createdAt) })),
        lbLoading: false
      })
    } catch (e) { this.setData({ lbLoading: false }) }
  },

  async toggleLike() {
    const item = this.data.lbItem
    if (!item || !item.key) return
    try {
      const res = await callApi('photoLike', { photoKey: item.key }, { silent: true })
      this.setData({ lbLiked: !!res.liked, lbLikes: res.likeCount || 0 })
      try { wx.vibrateShort({ type: 'light' }) } catch (e) {}
      this.updatePhotoCounts(item.key, !!res.liked, res.likeCount || 0)
    } catch (e) {}
  },

  updatePhotoCounts(key, liked, likeCount) {
    const photos = this.data.photos.map((p) => (p.key === key ? { ...p, liked, likeCount } : p))
    this.setData({ photos })
    this.applyFilter()
  },

  onCommentInput(e) { this.setData({ lbInput: e.detail.value }) },

  async submitComment() {
    const item = this.data.lbItem
    const content = (this.data.lbInput || '').trim()
    if (!content || !item) return
    try {
      await callApi('photoComment', { photoKey: item.key, content })
      this.setData({ lbInput: '' })
      this.loadComments()
    } catch (e) {}
  },

  previewBig() {
    const item = this.data.lbItem
    if (!item || !item.url) return
    const urls = this.data.photos.map((p) => p.url).filter(Boolean)
    wx.previewImage({ urls, current: item.url })
  },

  fmtShort(ts) {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  },

  // ===== 年度回忆册 =====
  openPoster() {
    const now = new Date()
    const y = now.getFullYear()
    let arr = this.data.photos.filter((p) => new Date(p.createdAt).getFullYear() === y)
    let year = y
    if (!arr.length) { arr = this.data.photos; year = arr.length ? new Date(arr[0].createdAt).getFullYear() : y }
    const names = [...new Set(arr.map((p) => p.byName).filter(Boolean))]
    this.setData({
      posterShow: true,
      posterYear: year,
      posterCount: arr.length,
      posterPhotos: arr.slice(0, 12),
      posterNames: names.join(' & ')
    })
  },
  closePoster() { this.setData({ posterShow: false }) },

  goRecallVideo() {
    wx.navigateTo({ url: '/pages/recall-video/index' })
  },

  openMemory(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    if (item.type === 'moment' && item.id) return wx.navigateTo({ url: `/pages/moments/detail?id=${item.id}` })
    if (item.type === 'post' && item.id) return wx.navigateTo({ url: `/pages/blog/detail?id=${item.id}` })
    if (item.type === 'checkin') return wx.switchTab({ url: '/pages/checkin/index' })
  },

  noop() {}
})
