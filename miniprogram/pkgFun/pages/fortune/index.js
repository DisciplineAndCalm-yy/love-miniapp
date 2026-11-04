const POOLS = [
  {
    id: 'luck',
    name: '今日运势',
    icon: '🍀',
    items: [
      { head: '大吉', body: '今天适合勇敢说爱，主动一点就有惊喜 ♡' },
      { head: '大吉', body: '想见的人也在想你，抓住今天的小心动' },
      { head: '中吉', body: '稳稳的一天，小小确幸正在靠近你' },
      { head: '中吉', body: '一句“我在”能治愈今天所有的疲惫' },
      { head: '小吉', body: '别急，好事会慢慢发生，先好好吃饭' },
      { head: '小吉', body: '今天很适合一起散步，聊聊心事' },
      { head: '吉', body: '一个拥抱，能抵过今天的全部烦恼' },
      { head: '吉', body: '把想说的话说出口，今天不会踩雷' }
    ]
  },
  {
    id: 'task',
    name: '甜蜜任务',
    icon: '💌',
    items: [
      { head: '甜蜜任务', body: '给对方发一句早安，并配一个亲亲表情 😘' },
      { head: '甜蜜任务', body: '牵住对方的手，认真说一句“谢谢你”' },
      { head: '甜蜜任务', body: '给对方点一杯 TA 爱喝的，不看价格' },
      { head: '甜蜜任务', body: '抱抱 30 秒，中间谁都不许说话' },
      { head: '甜蜜任务', body: '一起拍一张鬼脸自拍发到空间' },
      { head: '甜蜜任务', body: '夸对方三个优点，要具体不许笼统' },
      { head: '甜蜜任务', body: '给对方揉揉肩，边揉边说一句悄悄话' },
      { head: '甜蜜任务', body: '一起定一个本周要完成的小约会' }
    ]
  },
  {
    id: 'date',
    name: '约会灵感',
    icon: '🎬',
    items: [
      { head: '约会灵感', body: '一起逛超市，各挑一样没吃过的东西' },
      { head: '约会灵感', body: '找个傍晚去散步，谁先提回去就请一杯奶茶' },
      { head: '约会灵感', body: '在家开个电影夜，关灯 + 零食 + 毯子' },
      { head: '约会灵感', body: '去公园喂猫，顺便聊聊小时候的趣事' },
      { head: '约会灵感', body: '一起下厨做一道新菜，难吃也要吃完' },
      { head: '约会灵感', body: '坐公交到终点站，再慢慢走回来' },
      { head: '约会灵感', body: '去逛一家书店，给对方挑一本书' },
      { head: '约会灵感', body: '在家拼一副拼图，谁拼错谁负责切水果' }
    ]
  }
]

Page({
  data: {
    pools: POOLS,
    cur: 0,
    pool: POOLS[0],
    drawing: false,
    result: null,
    preview: '',
    particles: [],
    count: 0
  },

  switchPool(e) {
    if (this.data.drawing) return
    const i = Number(e.currentTarget.dataset.i)
    this.setData({ cur: i, pool: this.data.pools[i], result: null })
  },

  draw() {
    if (this.data.drawing) return
    const items = this.data.pool.items
    this.setData({ drawing: true, result: null })
    let ticks = 0
    clearInterval(this._timer)
    this._timer = setInterval(() => {
      ticks += 1
      const it = items[Math.floor(Math.random() * items.length)]
      this.setData({ preview: it.head })
      if (ticks >= 12) {
        clearInterval(this._timer)
        const pick = items[Math.floor(Math.random() * items.length)]
        this.setData({ drawing: false, result: pick, preview: '', count: this.data.count + 1 })
        this.burst()
        try { wx.vibrateShort({ type: 'light' }) } catch (e) {}
      }
    }, 80)
  },

  burst() {
    const icons = ['🍀', '✨', '🎉', '💗', '⭐', '🎋']
    this.setData({
      particles: Array.from({ length: 18 }, (_, i) => ({
        id: i,
        t: icons[i % icons.length],
        x: 5 + Math.random() * 90,
        s: 34 + Math.random() * 34,
        d: (1.1 + Math.random() * 1.1).toFixed(2),
        delay: (Math.random() * 0.4).toFixed(2)
      }))
    })
    setTimeout(() => this.setData({ particles: [] }), 2600)
  },

  onUnload() { clearInterval(this._timer) }
})
