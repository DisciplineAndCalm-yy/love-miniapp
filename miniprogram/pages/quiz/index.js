const BANK = [
  { icon: '🍜', text: '第一次约会吃的是？', options: ['火锅', '奶茶小吃', '西餐', '记不清了'] },
  { icon: '🧋', text: 'TA 最爱喝什么？', options: ['奶茶', '咖啡', '白开水', '快乐水'] },
  { icon: '🎬', text: '一起看的第一部电影是？', options: ['爱情片', '喜剧片', '恐怖片', '没看过电影'] },
  { icon: '😴', text: 'TA 生气时你该？', options: ['立刻抱抱', '讲笑话', '静静陪着', '买好吃的'] },
  { icon: '✈️', text: '最想一起去哪旅行？', options: ['海边', '雪山', '古镇', '游乐园'] },
  { icon: '🎁', text: 'TA 最想要的礼物是？', options: ['陪伴', '包包', '数码产品', '一封长信'] },
  { icon: '🌙', text: '睡前最后一件事是？', options: ['互道晚安', '刷手机', '聊八卦', '秒睡'] },
  { icon: '🏠', text: '理想的周末是？', options: ['宅家追剧', '出门约会', '见朋友', '各忙各的'] },
  { icon: '🍓', text: 'TA 最爱吃的水果是？', options: ['草莓', '西瓜', '芒果', '葡萄'] },
  { icon: '🌶️', text: 'TA 能吃辣吗？', options: ['无辣不欢', '微辣就行', '一点不碰', '看心情'] },
  { icon: '🎵', text: '一起单曲循环过哪类歌？', options: ['情歌', '民谣', '摇滚', '古风'] },
  { icon: '📱', text: 'TA 睡前刷手机一般在看？', options: ['短视频', '聊天', '购物', '小说'] },
  { icon: '☕', text: '约会必点的是？', options: ['奶茶', '咖啡', '果汁', '白开水'] },
  { icon: '🌧️', text: '下雨天 TA 最想？', options: ['宅家睡觉', '看雨发呆', '出门踩水', '煮火锅'] },
  { icon: '🐱', text: 'TA 更喜欢哪种小动物？', options: ['猫', '狗', '兔子', '仓鼠'] },
  { icon: '🎮', text: '一起玩得最多的是？', options: ['王者', '吃鸡', '消消乐', '不玩游戏'] },
  { icon: '😷', text: 'TA 感冒时最需要？', options: ['热水', '陪伴', '药', '抱抱'] },
  { icon: '💐', text: 'TA 最喜欢的花是？', options: ['玫瑰', '向日葵', '郁金香', '多肉'] },
  { icon: '🚗', text: '出门约会谁导航？', options: ['我', 'TA', '一起看', '随缘走'] },
  { icon: '🍰', text: 'TA 选甜品先看？', options: ['颜值', '口味', '价格', '分量'] },
  { icon: '🛋️', text: 'TA 在家的经典姿势是？', options: ['葛优躺', '盘腿坐', '趴着', '正襟危坐'] },
  { icon: '📸', text: '拍照时 TA 是？', options: [' pose 达人', '表情包本包', '躲镜头', '专拍对方'] },
  { icon: '🎉', text: '过生日 TA 更想要？', options: ['惊喜派对', '二人晚餐', '礼物', '平淡也开心'] },
  { icon: '💤', text: 'TA 的睡眠质量？', options: ['秒睡', '熬夜冠军', '浅眠', '认床'] },
  { icon: '🧹', text: '大扫除时 TA 负责？', options: ['拖地', '擦窗', '指挥', '点外卖'] },
  { icon: '🌅', text: '最想一起看？', options: ['日出', '日落', '星空', '烟花'] },
  { icon: '🍿', text: '看电影必备？', options: ['爆米花', '可乐', '纸巾', '肩膀'] },
  { icon: '👗', text: 'TA 出门前纠结最久的是？', options: ['穿什么', '背哪个包', '发型', '不纠结就走'] },
  { icon: '💰', text: '发工资 TA 先想？', options: ['存起来', '请对方吃饭', '买心头好', '还花呗'] },
  { icon: '🤧', text: 'TA 难过时你第一句说？', options: ['我在呢', '别哭了', '带你吃好吃的', '静静抱住'] }
]

function drawQids(n) {
  const pool = BANK.map((_, i) => i)
  const out = []
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return out
}

Page({
  data: {
    bankSize: BANK.length,
    questions: BANK.slice(0, 8),
    current: 0,
    picked: {},
    mineCount: 0,
    partnerCount: 0,
    mineDone: false,
    both: null,
    result: null,
    loading: true,
    answering: false,
    particles: []
  },
  timer: null,
  round: 'love8',
  myQids: null,

  onLoad() { this.sync(true) },
  onShow() {
    this.sync(false)
    clearInterval(this.timer)
    this.timer = setInterval(() => this.sync(false), 5000)
  },
  onHide() { clearInterval(this.timer) },
  onUnload() { clearInterval(this.timer) },
  onPullDownRefresh() { this.sync(false).finally(() => wx.stopPullDownRefresh()) },

  async sync(first) {
    const { callApi } = require('../../utils/cloud')
    try {
      if (first) this.setData({ loading: true })
      const total = 8
      const res = await callApi('quizState', { round: this.round, total }, { silent: !first })
      const mine = res.mine || {}
      const mineCount = Object.keys(mine).length
      const partnerCount = res.partnerCount || 0
      const mineDone = mineCount >= total
      const done = mineDone && partnerCount >= total
      // 题面以服务端锁定的 qids 为准;本轮还没题就本地抽 8 道,随第一题答案一起锁定
      let qids = Array.isArray(res.qids) && res.qids.length === 8 ? res.qids : null
      if (!qids && !this.myQids) this.myQids = drawQids(total)
      if (!qids) qids = this.myQids
      const update = { loading: false, mineCount, partnerCount, picked: mine, mineDone, questions: qids.map((i) => BANK[i]) }
      if (mineDone) {
        const firstUnanswered = qids.findIndex((_, i) => mine[i] === undefined)
        update.current = firstUnanswered === -1 ? total - 1 : firstUnanswered
      }
      // 只有双方都答完 8 题才出结果,避免只答 1 题就"结束"
      if (done && res.both) {
        update.both = res.both
        update.result = this.calcResult(res.both, qids)
        if (!this.data.result) this.burst()
      } else {
        update.both = null
        update.result = null
      }
      this.setData(update)
    } catch (e) { this.setData({ loading: false }) }
  },

  calcResult(both, qids) {
    const keys = Object.keys(both)
    if (keys.length < 2) return null
    const a = both[keys[0]]
    const b = both[keys[1]]
    const total = qids.length
    let same = 0
    const detail = qids.map((qid, i) => {
      const hit = a[i] !== undefined && a[i] === b[i]
      if (hit) same += 1
      return { i, hit, a: a[i], b: b[i] }
    })
    const pct = Math.round((same / total) * 100)
    let title = '还需磨合'
    let face = '🌱'
    let tip = '多聊聊天，下次一定更高！'
    if (pct === 100) { title = '心有灵犀'; face = '💞'; tip = '满分！你们是天生一对！' }
    else if (pct >= 75) { title = '天生一对'; face = '💗'; tip = '超高默契，继续保持！' }
    else if (pct >= 50) { title = '渐入佳境'; face = '🌸'; tip = '已经很不错了，再接再厉！' }
    return { same, total, pct, title, face, tip, detail }
  },

  async pick(e) {
    const idx = Number(e.currentTarget.dataset.i)
    const qid = this.data.current
    const total = 8
    if (this.data.answering) return
    const { callApi } = require('../../utils/cloud')
    this.setData({ answering: true })
    try {
      // 第一题答案顺带把本轮 8 道题锁定进云端,之后题面不再变化
      const res = await callApi('answerQuiz', { round: this.round, qid, choice: idx, qids: this.myQids || undefined })
      if (Array.isArray(res.qids) && res.qids.length === 8) this.myQids = res.qids
      const picked = { ...this.data.picked, [qid]: idx }
      const next = qid + 1 < total ? qid + 1 : qid
      this.setData({ picked, current: next, mineCount: Object.keys(picked).length })
      this.sync(false)
    } catch (err) {} finally { this.setData({ answering: false }) }
  },

  goQ(e) {
    this.setData({ current: Number(e.currentTarget.dataset.q) })
  },

  burst() {
    const icons = ['💗', '✨', '💕', '🌸', '💌', '⭐']
    const particles = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      t: icons[i % icons.length],
      x: 5 + Math.random() * 90,
      s: 36 + Math.random() * 40,
      d: (1.2 + Math.random() * 1.2).toFixed(2),
      delay: (Math.random() * 0.6).toFixed(2)
    }))
    this.setData({ particles })
  },

  async again() {
    const { callApi } = require('../../utils/cloud')
    const ok = await wx.showModal({ title: '再来一轮？', content: '会清空本轮双方答案并重新随机 8 题', confirmText: '再来' })
    if (!ok.confirm) return
    try {
      await callApi('resetQuiz', { round: this.round })
      this.myQids = drawQids(8)
      this.setData({ current: 0, picked: {}, mineCount: 0, partnerCount: 0, mineDone: false, both: null, result: null, particles: [], questions: this.myQids.map((i) => BANK[i]) })
      this.sync(false)
    } catch (e) {}
  }
})
