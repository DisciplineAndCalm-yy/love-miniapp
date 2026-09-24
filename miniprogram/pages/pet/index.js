const { callApi } = require('../../utils/cloud')
const SPECIES = {
  cat: { emoji: '🐱', label: '小猫', desc: '傲娇但黏人' },
  dog: { emoji: '🐶', label: '小狗', desc: '热情小跟班' },
  bunny: { emoji: '🐰', label: '小兔', desc: '软乎乎糯米团' },
  fox: { emoji: '🦊', label: '小狐狸', desc: '机灵小可爱' },
  panda: { emoji: '🐼', label: '小熊猫', desc: '干饭达人' },
}
const ACTIONS = [
  { kind: 'feed', icon: '🍗', label: '喂食' },
  { kind: 'play', icon: '⚽', label: '陪玩' },
  { kind: 'pat', icon: '💗', label: '摸摸' },
  { kind: 'bathe', icon: '🫧', label: '洗澡' },
  { kind: 'sleep', icon: '🌙', label: '哄睡' },
  { kind: 'dance', icon: '🎀', label: '跳舞' },
]
const FACE = { cat: '🐱', dog: '🐶', bunny: '🐰', fox: '🦊', panda: '🐼' }
const STATE_EMOJI = { idle: '', eat: '🍗', play: '⚽', love: '💗', bath: '🫧', sleep: '💤', dance: '✨', happy: '💗' }
const PROP_LEFT = { eat: '🍱', play: '⚽', bath: '🛁', sleep: '🛏️', dance: '🎀', love: '🏠', idle: '🏠' }
const PROP_RIGHT = { love: '💗', bath: '🫧', sleep: '🌙', eat: '✨', play: '✨', dance: '✨', idle: '✨' }

Page({
  data: {
    pet: null,
    loading: true,
    name: '',
    species: 'cat',
    speciesList: Object.keys(SPECIES).map((k) => ({ k, ...SPECIES[k] })),
    actions: ACTIONS,
    animating: 'idle',
    bubbles: [],
    reaction: '',
    toastMsg: '',
    moodFace: '😊',
    moodText: '',
    petFace: '🐱',
    leftProp: '🏠',
    rightProp: '✨',
    nextExp: 100,
    expPercent: 0,
    togetherDays: 0,
    speciesLabel: '小猫',
    imgErr: {},
    imgOk: {},
  },

  onShow() { this.load() },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()) },

  async load() {
    this.setData({ loading: true })
    try {
      const res = await callApi('getPet', {}, { silent: true })
      const pet = res.pet || null
      this.setData({ pet })
      if (pet) this.applyPet(pet)
    } catch (e) {
      console.warn(e)
    }
    this.setData({ loading: false })
  },

  applyPet(pet) {
    const info = SPECIES[pet.species] || SPECIES.cat
    const exp = pet.exp || 0
    const level = pet.level || Math.min(99, 1 + Math.floor(exp / 100))
    const safe = {
      ...pet,
      hunger: Math.round(pet.hunger != null ? pet.hunger : 80),
      mood: Math.round(pet.mood != null ? pet.mood : 80),
      clean: Math.round(pet.clean != null ? pet.clean : 80),
      energy: Math.round(pet.energy != null ? pet.energy : 80),
      exp,
      level,
    }
    this.setData({
      pet: safe,
      moodFace: this.faceOf(safe),
      moodText: this.moodTextOf(safe),
      petFace: FACE[pet.species] || '🐱',
      speciesLabel: info.label,
      nextExp: 100,
      expPercent: Math.min(100, exp % 100),
      togetherDays: pet.createdAt ? Math.max(1, Math.floor((Date.now() - pet.createdAt) / 86400000) + 1) : 1,
      leftProp: PROP_LEFT.idle,
      rightProp: PROP_RIGHT.idle,
    })
  },

  faceOf(p) {
    if (!p) return '🐾'
    if ((p.energy != null ? p.energy : 80) < 20) return '😴'
    if ((p.hunger || 80) < 30) return '🥺'
    if ((p.mood || 80) < 30) return '😿'
    if ((p.mood || 0) > 85) return '😋'
    return '😊'
  },

  moodTextOf(p) {
    if (!p) return ''
    if ((p.energy != null ? p.energy : 80) < 20) return '困困了'
    if ((p.hunger || 80) < 30) return '饿饿了'
    if ((p.mood || 80) < 30) return 'emo了'
    if ((p.mood || 0) > 85) return '超开心'
    return '心情不错'
  },

  onName(e) { this.setData({ name: e.detail.value }) },
  pickSpecies(e) { this.setData({ species: e.currentTarget.dataset.s }) },

  onImgLoad(e) {
    const k = e.currentTarget.dataset.k
    if (!k) return
    this.setData({ [`imgOk.${k}`]: true })
  },

  onImgError(e) {
    const k = e.currentTarget.dataset.k
    if (!k) return
    this.setData({ [`imgErr.${k}`]: true, [`imgOk.${k}`]: false })
  },

  tapPet() {
    if (this.data.animating && this.data.animating !== 'idle') return
    const REACTS = [
      { anim: 'love', msg: '嘿嘿♡', emo: '💗' },
      { anim: 'jump', msg: '呀！', emo: '✨' },
      { anim: 'dance', msg: '陪我玩~', emo: '🎀' },
      { anim: 'love', msg: '咕噜咕噜~', emo: '💕' },
      { anim: 'jump', msg: '呜哇！', emo: '💫' },
      { anim: 'dance', msg: '好开心！', emo: '⭐' },
    ]
    const r = REACTS[Math.floor(Math.random() * REACTS.length)]
    const anim = r.anim === 'jump' ? 'play' : r.anim === 'dance' ? 'dance' : 'love'
    this.setData({ animating: anim, toastMsg: r.msg, reaction: r.emo })
    this.spawn(r.emo + r.emo)
    clearTimeout(this._tap)
    this._tap = setTimeout(() => {
      if (this.data.animating !== 'idle') this.setData({ animating: 'idle', toastMsg: '', reaction: '' })
    }, 1100)
  },

  async adopt() {
    try {
      await callApi('adoptPet', { name: this.data.name.trim() || '团子', species: this.data.species })
      wx.showToast({ title: '领养成功 ♡' })
      this.load()
    } catch (e) {
      wx.showToast({ title: '先绑定两个人吧', icon: 'none' })
    }
  },

  async act(e) {
    const kind = e.currentTarget.dataset.k
    const meta = ACTIONS.find((a) => a.kind === kind) || {}
    const animState = kind === 'feed' ? 'eat' : kind === 'pat' ? 'love' : kind === 'bathe' ? 'bath' : kind
    // 把宠物滚回视野顶部,保证能看到反应
    try { wx.pageScrollTo({ scrollTop: 0, duration: 300 }) } catch (err) {}
    this.burst(kind)
    this.setData({
      animating: animState,
      leftProp: PROP_LEFT[animState] || '🏠',
      rightProp: PROP_RIGHT[animState] || '✨',
    })
    try {
      const r = await callApi('interactPet', { kind }, { silent: true })
      const pet = r.pet || this.data.pet
      const emo = STATE_EMOJI[r.state] || meta.icon || '💗'
      this.applyPet(pet)
      this.setData({ toastMsg: r.msg || '好开心!', reaction: emo })
      this.spawn(emo + emo)
    } catch (err) {
      this.setData({ toastMsg: '它还没反应过来…' })
    }
    clearTimeout(this._t)
    this._t = setTimeout(() => {
      this.setData({ animating: 'idle', toastMsg: '', reaction: '', leftProp: PROP_LEFT.idle, rightProp: PROP_RIGHT.idle })
    }, 1600)
  },

  burst(kind) {
    const map = { feed: ['🍗', '🍙', '🥛'], play: ['⚽', '🧸', '✨'], pat: ['💗', '💕', '♡'], bathe: ['🫧', '💧', '🧼'], sleep: ['💤', '🌙', '✨'], dance: ['✨', '🎀', '💃'] }
    const arr = (map[kind] || ['💗']).concat(['♡'])
    const bubbles = arr.map((t, i) => ({ t, id: Date.now() + '-' + i, x: 8 + i * 22, d: (0.9 + Math.random() * 0.8).toFixed(2) }))
    this.setData({ bubbles })
    setTimeout(() => this.setData({ bubbles: [] }), 1700)
  },

  spawn(t) {
    const chars = String(t || '💗').split('')
    const bubbles = chars.map((c, i) => ({ t: c, id: 's' + Date.now() + i, x: 32 + i * 14, d: '1.2' }))
    this.setData({ bubbles })
    setTimeout(() => this.setData({ bubbles: [] }), 1700)
  },

  onShareAppMessage() {
    const p = this.data.pet
    return { title: p ? `快来看看${p.name}！已经 Lv.${p.level} 啦 ♡` : '我们领养了一只小可爱 ♡', path: '/pages/pet/index' }
  },
  onShareTimeline() {
    const p = this.data.pet
    return { title: p ? `我们的${p.name} Lv.${p.level} 啦 ♡` : '我们领养了一只小可爱 ♡' }
  },
})
