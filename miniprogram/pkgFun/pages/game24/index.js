// ===== 24 点求解器：返回一个能算出 24 的表达式，无解返回 null =====
function solve24(nums) {
  const dfs = (items) => {
    if (items.length === 1) {
      return Math.abs(items[0].v - 24) < 1e-6 ? items[0].e : null
    }
    for (let i = 0; i < items.length; i += 1) {
      for (let j = 0; j < items.length; j += 1) {
        if (i === j) continue
        const a = items[i]
        const b = items[j]
        const rest = items.filter((_, k) => k !== i && k !== j)
        const cands = [
          { v: a.v + b.v, e: `(${a.e}+${b.e})` },
          { v: a.v - b.v, e: `(${a.e}-${b.e})` },
          { v: a.v * b.v, e: `(${a.e}×${b.e})` }
        ]
        if (Math.abs(b.v) > 1e-6) cands.push({ v: a.v / b.v, e: `(${a.e}÷${b.e})` })
        for (let c = 0; c < cands.length; c += 1) {
          const found = dfs(rest.concat([cands[c]]))
          if (found) return found
        }
      }
    }
    return null
  }
  return dfs(nums.map((n) => ({ v: n, e: String(n) })))
}

// ===== 安全表达式求值（不依赖 eval / Function）=====
function evalExpr(input) {
  const s = String(input || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/\s+/g, '')
  if (!s) return null
  let pos = 0
  const parseExpr = () => {
    let v = parseTerm()
    while (s[pos] === '+' || s[pos] === '-') {
      const op = s[pos]; pos += 1
      const r = parseTerm(); v = op === '+' ? v + r : v - r
    }
    return v
  }
  const parseTerm = () => {
    let v = parseFactor()
    while (s[pos] === '*' || s[pos] === '/') {
      const op = s[pos]; pos += 1
      const r = parseFactor(); v = op === '*' ? v * r : v / r
    }
    return v
  }
  const parseFactor = () => {
    if (s[pos] === '(') { pos += 1; const v = parseExpr(); if (s[pos] !== ')') throw new Error('x'); pos += 1; return v }
    if (s[pos] === '-') { pos += 1; return -parseFactor() }
    if (s[pos] === '+') { pos += 1; return parseFactor() }
    const start = pos
    while (pos < s.length && /[0-9.]/.test(s[pos])) pos += 1
    if (start === pos) throw new Error('x')
    return parseFloat(s.slice(start, pos))
  }
  try {
    const v = parseExpr()
    if (pos !== s.length) return null
    return v
  } catch (e) { return null }
}

function numbersIn(input) {
  return (String(input || '').match(/\d+/g) || []).map((n) => parseInt(n, 10)).sort((a, b) => a - b)
}

Page({
  data: {
    nums: [],
    answer: '',
    expr: '',
    status: '',
    statusType: '',
    showAnswer: false,
    rounds: 0,
    wins: 0
  },

  onLoad() { this.newRound() },

  newRound() {
    let nums = []
    let ans = null
    for (let t = 0; t < 80; t += 1) {
      nums = [0, 0, 0, 0].map(() => 1 + Math.floor(Math.random() * 10))
      ans = solve24(nums)
      if (ans) break
    }
    if (!ans) { nums = [6, 6, 6, 6]; ans = solve24(nums) || '6+6+6+6' }
    this._answer = ans || ''
    this.setData({
      nums,
      answer: '',
      expr: '',
      status: '',
      statusType: '',
      showAnswer: false,
      rounds: this.data.rounds + 1
    })
  },

  onInput(e) { this.setData({ expr: e.detail.value }) },

  check() {
    const expr = (this.data.expr || '').trim()
    if (!expr) { this.setData({ status: '先用这 4 个数字写个算式吧～', statusType: 'warn' }); return }
    const used = numbersIn(expr)
    const target = this.data.nums.slice().sort((a, b) => a - b)
    if (used.length !== 4 || used.join(',') !== target.join(',')) {
      this.setData({ status: `要把 ${target.join('、')} 各用一次哦`, statusType: 'warn' })
      return
    }
    const val = evalExpr(expr)
    if (val == null || !isFinite(val)) { this.setData({ status: '算式写得不太对，检查一下括号和符号', statusType: 'warn' }); return }
    if (Math.abs(val - 24) < 1e-6) {
      this.setData({ status: '🎉 答对啦！刚好 24 分，太厉害～', statusType: 'ok', wins: this.data.wins + 1 })
      try { wx.vibrateShort({ type: 'light' }) } catch (e) {}
    } else {
      this.setData({ status: `结果是 ${Math.round(val * 100) / 100}，再凑凑 24～`, statusType: 'warn' })
    }
  },

  revealAnswer() {
    if (!this._answer) return
    this.setData({ showAnswer: true, answer: this._answer })
  },

  goBack() { wx.navigateBack({ delta: 1 }) }
})
