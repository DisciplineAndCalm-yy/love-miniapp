const { callApi, shareCard } = require('../../utils/cloud')
const { todayKey } = require('../../utils/date')

const CATS = {
  food: { emoji: '🍜', label: '吃' },
  fun: { emoji: '🎉', label: '玩' },
  daily: { emoji: '🛒', label: '日用' },
  other: { emoji: '✨', label: '其他' }
}

Page({
  data: {
    tab: 'todo',
    loading: true,
    sending: false,
    myName: '我',
    partnerName: 'TA',
    todos: [],
    notes: [],
    ledgers: [],
    ledgerTotal: 0,
    myPaid: 0,
    partnerPaid: 0,
    chartBars: [],
    todoInput: '',
    todoAssignee: 'both',
    todoDue: '',
    noteInput: '',
    noteColor: 'yellow',
    noteColors: ['yellow', 'pink', 'blue', 'green', 'purple'],
    ledgerAmount: '',
    ledgerNote: '',
    ledgerPayer: 'me',
    ledgerCategory: 'food',
    catBars: []
  },

  onShow() { this.loadAll() },
  onPullDownRefresh() { this.loadAll().finally(() => wx.stopPullDownRefresh()) },
  onShareAppMessage() { return shareCard('我们的小事，一起把日子过好 ♡') },

  async loadAll() {
    const app = getApp()
    await app.whenReady()
    const partner = app.globalData.partner
    const user = app.globalData.user || {}
    this.setData({
      myName: user.nickName || '我',
      partnerName: (partner && partner.nickName) || 'TA'
    })
    await Promise.all([this.loadTodos(), this.loadNotes(), this.loadLedgers()])
    this.setData({ loading: false })
  },

  assigneeLabel(a) {
    if (a === 'me') return this.data.myName || '我'
    if (a === 'partner') return this.data.partnerName || 'TA'
    return '一起'
  },
  payerLabel(p) {
    return p === 'partner' ? (this.data.partnerName || 'TA') : (this.data.myName || '我')
  },
  decorateTodo(t) {
    const today = todayKey()
    const due = t.due || ''
    const overdue = !!(due && !t.done && due < today)
    const dueToday = !!(due && !t.done && due === today)
    let dueLabel = ''
    if (due) dueLabel = overdue ? `已逾期 ${due}` : (dueToday ? '今天截止' : `${due} 截止`)
    return { ...t, assigneeLabel: this.assigneeLabel(t.assignee), due, overdue, dueLabel }
  },

  async loadTodos() {
    try {
      const res = await callApi('lifeList', { type: 'todo' }, { silent: true })
      const todos = (res.list || []).map((t) => this.decorateTodo(t))
      this.setData({ todos })
    } catch (e) {}
  },
  async loadNotes() {
    try {
      const res = await callApi('lifeList', { type: 'note' }, { silent: true })
      this.setData({ notes: res.list || [] })
    } catch (e) {}
  },
  async loadLedgers() {
    try {
      const res = await callApi('lifeList', { type: 'ledger' }, { silent: true })
      const ledgers = (res.list || []).map((l) => ({ ...l, payerLabel: this.payerLabel(l.payer), catEmoji: (CATS[l.category] || CATS.other).emoji }))
      this.setData({ ledgers })
      this.recalcTotal(ledgers)
      this.buildChart(ledgers)
    } catch (e) {}
  },
  buildChart(src) {
    const list = src || this.data.ledgers || []
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getMonth() + 1}月` })
    }
    const sums = {}
    list.forEach((l) => {
      const d = new Date(Number(l.createdAt) || 0)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      sums[key] = (sums[key] || 0) + (Number(l.amount) || 0)
    })
    const max = Math.max(1, ...months.map((m) => sums[m.key] || 0))
    const chartBars = months.map((m) => {
      const raw = sums[m.key] || 0
      return { label: m.label, val: Math.round(raw * 100) / 100, h: Math.max(3, Math.round((raw / max) * 100)) }
    })
    this.setData({ chartBars })
  },
  recalcTotal(list) {
    const src = list || this.data.ledgers
    let total = 0
    let my = 0
    let partner = 0
    src.forEach((l) => {
      const a = Number(l.amount) || 0
      total += a
      if (l.payer === 'partner') partner += a
      else my += a
    })
    const sums = { food: 0, fun: 0, daily: 0, other: 0 }
    src.forEach((l) => {
      const k = sums[l.category] != null ? l.category : 'other'
      sums[k] += Number(l.amount) || 0
    })
    const catBars = Object.keys(CATS).map((k) => {
      const val = Math.round(sums[k] * 100) / 100
      const pct = total > 0 ? Math.round((sums[k] / total) * 100) : 0
      return { key: k, emoji: CATS[k].emoji, label: CATS[k].label, val, pct }
    })
    this.setData({
      ledgerTotal: Math.round(total * 100) / 100,
      myPaid: Math.round(my * 100) / 100,
      partnerPaid: Math.round(partner * 100) / 100,
      catBars
    })
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab && tab !== this.data.tab) this.setData({ tab })
  },

  // ===== 待办 =====
  onTodoInput(e) { this.setData({ todoInput: e.detail.value }) },
  onTodoDue(e) { this.setData({ todoDue: e.detail.value }) },
  setTodoAssignee(e) { this.setData({ todoAssignee: e.currentTarget.dataset.a }) },
  async addTodo() {
    const text = (this.data.todoInput || '').trim()
    if (!text || this.data.sending) return
    this.setData({ sending: true })
    try {
      const res = await callApi('lifeAdd', { type: 'todo', text, assignee: this.data.todoAssignee, due: this.data.todoDue }, { silent: true })
      const item = this.decorateTodo(res.item)
      this.setData({ todos: [item, ...this.data.todos], todoInput: '', todoDue: '' })
    } catch (e) { wx.showToast({ title: (e && (e.message || e.errMsg)) || '添加失败', icon: 'none' }) } finally { this.setData({ sending: false }) }
  },
  async toggleTodo(e) {
    const id = e.currentTarget.dataset.id
    const todo = this.data.todos.find((t) => t._id === id)
    if (!todo) return
    const done = !todo.done
    this.setData({ todos: this.data.todos.map((t) => (t._id === id ? this.decorateTodo({ ...t, done }) : t)) })
    try { await callApi('lifeUpdate', { type: 'todo', id, done }, { silent: true }) } catch (err) {}
  },
  removeTodo(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条待办？', confirmColor: '#c94b5c',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await callApi('lifeRemove', { type: 'todo', id }, { silent: true })
          this.setData({ todos: this.data.todos.filter((t) => t._id !== id) })
        } catch (err) {}
      }
    })
  },

  // ===== 便签 =====
  onNoteInput(e) { this.setData({ noteInput: e.detail.value }) },
  setNoteColor(e) { this.setData({ noteColor: e.currentTarget.dataset.c }) },
  async addNote() {
    const text = (this.data.noteInput || '').trim()
    if (!text || this.data.sending) return
    this.setData({ sending: true })
    try {
      const res = await callApi('lifeAdd', { type: 'note', text, color: this.data.noteColor }, { silent: true })
      this.setData({ notes: [res.item, ...this.data.notes], noteInput: '' })
    } catch (e) { wx.showToast({ title: (e && (e.message || e.errMsg)) || '添加失败', icon: 'none' }) } finally { this.setData({ sending: false }) }
  },
  removeNote(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '撕掉这张便签？', confirmColor: '#c94b5c',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await callApi('lifeRemove', { type: 'note', id }, { silent: true })
          this.setData({ notes: this.data.notes.filter((n) => n._id !== id) })
        } catch (err) {}
      }
    })
  },

  // ===== 账本 =====
  onLedgerAmount(e) { this.setData({ ledgerAmount: e.detail.value }) },
  onLedgerNote(e) { this.setData({ ledgerNote: e.detail.value }) },
  setLedgerPayer(e) { this.setData({ ledgerPayer: e.currentTarget.dataset.p }) },
  setLedgerCategory(e) { this.setData({ ledgerCategory: e.currentTarget.dataset.c }) },
  async addLedger() {
    const amt = Number(this.data.ledgerAmount)
    if (!Number.isFinite(amt) || amt <= 0) { wx.showToast({ title: '金额不对哦', icon: 'none' }); return }
    if (this.data.sending) return
    this.setData({ sending: true })
    try {
      const res = await callApi('lifeAdd', { type: 'ledger', amount: amt, note: this.data.ledgerNote, payer: this.data.ledgerPayer, category: this.data.ledgerCategory }, { silent: true })
      const item = { ...res.item, payerLabel: this.payerLabel(res.item.payer), catEmoji: (CATS[res.item.category] || CATS.other).emoji }
      const ledgers = [item, ...this.data.ledgers]
      this.setData({ ledgers, ledgerAmount: '', ledgerNote: '' })
      this.recalcTotal(ledgers)
    } catch (e) { wx.showToast({ title: (e && (e.message || e.errMsg)) || '添加失败', icon: 'none' }) } finally { this.setData({ sending: false }) }
  },
  removeLedger(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除这条账目？', confirmColor: '#c94b5c',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await callApi('lifeRemove', { type: 'ledger', id }, { silent: true })
          const ledgers = this.data.ledgers.filter((l) => l._id !== id)
          this.setData({ ledgers })
          this.recalcTotal(ledgers)
        } catch (err) {}
      }
    })
  },

  // ===== 到家报平安 =====
  async homeSafe() {
    try {
      await callApi('sendChat', { content: '我到家啦 🏠 别担心～', kind: 'text' }, { silent: true })
      wx.showToast({ title: '已告诉 TA 你到家啦 ♡', icon: 'none' })
    } catch (e) {
      wx.showToast({ title: '还没绑定 TA 哦', icon: 'none' })
    }
  }
})
