// 三条故事线完整剧本(与云函数 ADV_DEFS 节点 id 对齐,只做展示)
const STORIES = {
  forest: {
    title: '🌲 雾林物语', desc: '左行遇龙，右行遇宝。两个结局。', icon: '🌲',
    nodes: {
      start: { text: '清晨的雾气漫过脚踝，森林入口的木牌上刻着两行字——左行遇龙，右行遇宝。你们十指相扣，谁也不想先松开，那就一起选吧。', choices: [{ id: 'left', label: '🐉 左行屠龙' }, { id: 'right', label: '💎 右行寻宝' }] },
      left: { text: '小径尽头，一只幼龙蜷在岩石上，肚子咕咕叫，眼睛却凶巴巴的。它饿坏了，也怕极了。你们交换了一个眼神：打，还是喂？', choices: [{ id: 'fight', label: '⚔️ 正面迎战' }, { id: 'feed', label: '🍖 分它烤肉' }] },
      right: { text: '山洞里金光闪闪，但门口有陷阱的痕迹。', choices: [{ id: 'sneak', label: '🐾 悄悄潜入' }, { id: 'Rush', label: '🏃 直接冲' }] },
      feed: { text: '你们掏出包里的烤肉，幼龙狼吞虎咽，吃完竟蹭了蹭你们的手心，吐出一枚温热的龙鳞。不打不相识，它成了你们的向导。', auto: true },
      fight: { text: '它扑过来了！鳞片坚硬，火焰灼热——真正的恶战，现在开始！', battle: { name: '饿坏的幼龙', icon: '🐉' } },
      sneak: { text: '你们屏住呼吸，脚尖点地，一个陷阱、两个陷阱……全部绕过！抱起那袋金币时，你们笑得像两个得逞的小孩。', auto: true },
      rush: { text: '“哎哟！”陷阱还是咬了你们一口。不过金币是真多，数着数着，疼都忘了。', auto: true },
      cabin: { text: '穿过山洞，后山竟有一座冒着炊烟的小木屋。是敲门问路，还是先扒窗看看？', choices: [{ id: 'knock', label: '🚪 敲门问路' }, { id: 'peek', label: '👀 扒窗看看' }] },
      knock: { text: '开门的是位白胡子猎人，他塞给你们烤肉干和一张手绘地图：“深林里，善良比刀剑好用。”', auto: true },
      peek: { text: '窗后挂满了旧指南针和探险笔记。主人发现了你们，却笑着送了个指南针：“拿着，别再迷路了。”', auto: true },
      nest: { text: '龙巢暖烘烘的，干草堆散发着阳光的味道。赶了一天的路，是歇一晚，还是趁热打铁继续深入？', choices: [{ id: 'rest', label: '⛺ 在龙巢休息' }, { id: 'march', label: '🥾 继续深入' }] },
      rest: { text: '你们挤在干草堆里分吃干粮，幼龙在洞口替你们守夜。一夜好眠，伤口都愈合了大半，只是干粮钱花了不少。', auto: true },
      march: { text: '趁着月色赶路，雾气渐渐散了。长途跋涉让你们的配合愈发默契，脚步都踩在同一个节奏上。', auto: true },
      deep: { text: '林深处传来抽泣声，一只小精灵抱着膝盖坐在荆棘前：“出口被封住了，只有勇敢或温柔能打开它。”', choices: [{ id: 'cut', label: '🗡️ 劈开荆棘' }, { id: 'talk', label: '💬 问它口令' }] },
      cut: { text: '荆棘应声而开，身后竟是灯火辉煌的精灵王国！国王亲自迎接，为你们戴上花环：“朋友，今夜不醉不归。”', ending: '👑 精灵王之友' },
      talk: { text: '小精灵破涕为笑：“口令是——爱。”荆棘如潮水般退开，它牵着你们穿过花海，满世界都是香的。', ending: '🌸 花海漫步' },
      trail: { text: '', auto: true }
    }
  },
  sea: {
    title: '🌊 深海之歌', desc: '贝壳的愿望，人鱼的歌。三个结局。', icon: '🌊',
    nodes: {
      start: { text: '退潮后的沙滩上，一只贝壳突然开口说话：“带我回大海，我实现你们一个愿望。”你们面面相觑——这贝壳，认真的吗？', choices: [{ id: 'take', label: '🐚 带它走' }, { id: 'leave', label: '🚶 留它在沙滩' }] },
      take: { text: '刚把贝壳捧起来，海面骤起大浪，一艘破烂的海盗船逼近。独眼船长吼道：“把贝壳交出来！”', choices: [{ id: 'fight', label: '⚔️ 和海盗干一架' }, { id: 'trade', label: '💰 拿金币换平安' }] },
      leave: { text: '你们把贝壳放回沙滩，走出没多远，身后传来空灵的歌声——是人鱼在哭。回去，还是继续走？', choices: [{ id: 'back', label: '💗 回头看看' }, { id: 'go', label: '🏖️ 继续晒太阳' }] },
      fight: { text: '海盗们从四面围上来，弯刀出鞘！你们背靠着背——真正的海战，现在开始！', battle: { name: '独眼海盗船长', icon: '🏴‍☠️' } },
      trade: { text: '船长掂了掂金币，咧嘴一笑：“爽快！再送你们一张藏宝图，算交个朋友。”原来海盗也讲义气。', auto: true },
      back: { text: '人鱼的尾巴被渔网缠住了。你们小心翼翼解开它，它唱起祝福之歌，海水都变甜了，身上的擦伤也不疼了。', auto: true },
      go: { text: '你们在沙滩上躺了一下午，捡了一兜漂亮贝壳。没有冒险，但有彼此——平淡，也是答案。', ending: '☀️ 咸鱼也有梦' },
      deck: { text: '缴获的海盗船随波摇晃，俘虏们垂头丧气。船长问：“他们怎么办？”', choices: [{ id: 'spare', label: '🕊️ 放走海盗' }, { id: 'recruit', label: '🤝 招安当水手' }] },
      spare: { text: '海盗们千恩万谢，临走塞给你们一小袋金币：“以后这片海，你们横着走！”', auto: true },
      recruit: { text: '海盗们当场起誓效忠，还献上船锚徽章。从今天起，你们也是有船的人了！', auto: true },
      wish: { text: '夜幕降临，贝壳发出柔光：“说吧，你们唯一的愿望是什么？”海风都屏住了呼吸。', choices: [{ id: 'rich', label: '💰 要数不完的金币' }, { id: 'love', label: '💞 要永远在一起' }] },
      rich: { text: '一箱金币凭空出现，金光晃眼。可你们对视一眼，都笑了——最闪的，分明是对方的眼睛。', ending: '💰 富贵鸳鸯' },
      love: { text: '贝壳化作万千光点，海面上升起一道双人彩虹。人鱼们浮出水面鼓掌，浪花都在说：恭喜。', ending: '🌈 彩虹之誓' },
      trail: { text: '', auto: true }
    }
  },
  star: {
    title: '🌟 星夜列车', desc: '去过去，或去未来。四个结局。', icon: '🌟',
    nodes: {
      start: { text: '午夜十二点，一辆洒满星光的列车悄无声息停在窗前。列车长探出头：“只剩两个座位——去过去，还是去未来？”', choices: [{ id: 'past', label: '⏪ 回到初遇那天' }, { id: 'future', label: '⏩ 去十年后看看' }] },
      past: { text: '列车穿过银河，停在你们初遇的那条街角。年轻的你们正擦肩而过，空气里都是紧张的心跳。', choices: [{ id: 'hello', label: '👋 上去打招呼' }, { id: 'watch', label: '👀 默默看着' }] },
      future: { text: '十年后的家灯火通明，可大门紧闭，门上贴着纸条：“想进来？先回答——我们第一次约会吃的什么？”', choices: [{ id: 'hotpot', label: '🍲 火锅！' }, { id: 'guess', label: '🤔 瞎猜一个' }] },
      hello: { text: '年轻的你们相视一笑，时间线泛起涟漪。列车长抹了抹眼睛：“原来心动，从来没变过。”可列车不停站——真正的考验，是前方十难的银河旅途。', auto: true },
      watch: { text: '你们手牵手看完了那场相遇，谁也没出声。列车员含着泪免了票：“这段路，免费。但前面的路，得你们自己走。”', auto: true },
      hotpot: { text: '“叮——回答正确！”门开了，桌上留着纸条：“记得按时吃饭，按时想我。——十年后的你们。”吃饱喝足，列车再度启动，载你们驶向更深的星海。', auto: true },
      guess: { text: '“回答错误！”警报响起，一个星尘守卫从门后转了出来。它可不管你们是谁，先打赢再说！', battle: { name: '星尘守卫', icon: '🌟' } },
      star_end: { text: '列车重新启动，窗外银河倾泻。列车长问：“下一站，去哪儿？”', choices: [{ id: 'home', label: '🏠 回家睡觉' }, { id: 'more', label: '🚀 继续冒险' }] },
      home: { text: '回到温暖的被窝，星星碎片在床头一闪一闪，像在替列车长说晚安。', ending: '🌙 星夜晚安' },
      more: { text: '列车冲向银河深处，你们靠在一起。故事很长，而你们，有的是时间。', ending: '🚀 银河无界' },
      hello_end: { text: '走完银河十难，列车广播响起：“终点站·初心。”你们相视一笑——兜兜转转，心动还是最初那个。', ending: '💫 初心不改' },
      watch_end: { text: '走完银河十难，列车员把当年的免票根递给你们：“留着吧，这是爱情的车票。”', ending: '🎫 免票乘客' },
      hotpot_end: { text: '走完银河十难，十年后的你们在终点站等着，一桌热气腾腾的火锅：“欢迎回家，辛苦了。”', ending: '🏠 灯火可亲' },
      trail: { text: '', auto: true }
    }
  }
}

Page({
  data: {
    stories: [
      { id: 'forest', icon: '🌲', title: '雾林物语', desc: '左行遇龙，右行遇宝' },
      { id: 'sea', icon: '🌊', title: '深海之歌', desc: '贝壳的愿望，人鱼的歌' },
      { id: 'star', icon: '🌟', title: '星夜列车', desc: '去过去，或去未来' }
    ],
    themes: {
      forest: { bits: ['🌲', '🍃', '🦋', '✨'], scene: ['🌲', '🦌', '🌲', '🍄', '🌲'], label: '雾林' },
      sea: { bits: ['🌊', '🐠', '🐚', '✨'], scene: ['🌊', '🐠', '🐚', '🌊', '🐢'], label: '深海' },
      star: { bits: ['⭐', '🌙', '💫', '✨'], scene: ['🌙', '⭐', '🚂', '⭐', '💫'], label: '星夜' }
    },
    adv: null,
    pet: null,
    nodeText: '',
    nodeChoices: [],
    nodeEnding: '',
    choosing: false,
    battling: false,
    battleRounds: [],
    atkTotal: 10,
    enemyLv: 1,
    trailDepth: 0,
    trailTotal: 0,
    trailPct: 0,
    trailText: '',
    trailChoices: [],
    loading: true,
    startMode: 'solo',
    startStory: 'forest',
    showEnd: false,
    endName: '',
    particles: [],
    log: [],
    themeKey: 'forest',
    themeBits: ['🌲', '🍃', '🦋', '✨'],
    themeLabel: '雾林',
    themeScene: ['🌲', '🦌', '🌲', '🍄', '🌲']
  },

  onLoad() { this.sync(true) },
  onShow() { this.sync(false) },
  onPullDownRefresh() {
    this.sync(false, true).finally(() => wx.stopPullDownRefresh())
  },

  // 校验存档是否卡死(未知节点且无战斗/旅途/结局),卡死则自动修复
  async ensurePlayable(adv) {
    if (!adv) return false
    if ((adv.endings || []).length) return false
    if (this.inBattle(adv)) return false
    // 旅途战斗却没有战斗对象 = 卡死,需修复;其余可正常渲染的旅途/节点不算卡死
    const stuckTrailBattle = adv.node === 'trail' && this.hasTrail(adv) && adv.trail.kind === 'battle'
    if (!stuckTrailBattle) {
      if (adv.node === 'trail' && this.hasTrail(adv)) return false
      if (this.nodeOf(adv)) return false
    }
    const { callApi } = require('../../utils/cloud')
    try {
      const res = await callApi('advRepair', {}, { silent: true })
      if (res.repaired) {
        wx.showToast({ title: '卡住的剧情修好了，继续冒险 ♡', icon: 'none', duration: 2500 })
        return true
      }
    } catch (e) {}
    return false
  },

  applyTheme(key) {
    const t = this.data.themes[key] || this.data.themes.forest
    this.setData({ themeKey: key, themeBits: t.bits, themeLabel: t.label, themeScene: t.scene })
  },

  nodeOf(adv) {
    const story = STORIES[adv.storyId]
    if (!story) return null
    // trail_hello 这类分支旅途入口:统一走旅途渲染,不再逐个建表
    if (typeof adv.node === 'string' && adv.node.indexOf('trail') === 0) return { text: '', auto: true }
    return story.nodes[adv.node] || null
  },

  calcAdv(adv) {
    // 总攻击 = 存档基础(含开局 10 点 + 事件加成)+ 全身装备加成
    const gear = (adv.items || []).reduce((s, it) => s + (Number(it.atk) || 0), 0)
    return { atkTotal: (adv.atk == null ? 10 : adv.atk) + gear, gear }
  },

  async sync(first, fromPull) {
    const { callApi } = require('../../utils/cloud')
    try {
      if (first) this.setData({ loading: true })
      const res = await callApi('advState', {}, { silent: !first })
      let adv = res.adv
      // 下拉/进页时自检:卡死 automatically repair and reload
      if (adv && !first) {
        const fixed = await this.ensurePlayable(adv)
        if (fixed) {
          try {
            const res2 = await callApi('advState', {}, { silent: true })
            adv = res2.adv
          } catch (e) {}
        }
      }
      if (res.recovered) {
        wx.showToast({ title: '剧情断层已修复，回到起点继续 ♡', icon: 'none', duration: 2500 })
      }
      const update = { loading: false, adv, pet: res.pet || null }
      if (adv) {
        this.applyTheme(adv.storyId)
        const inBattle = this.inBattle(adv)
        const hasTrail = this.hasTrail(adv)
        const node = this.nodeOf(adv)
        const trail = hasTrail ? adv.trail : null
        update.inBattle = inBattle
        update.hasTrail = hasTrail
        update.nodeText = trail ? '' : (node ? node.text : '剧情走丢了…')
        update.nodeChoices = (!trail && node && node.choices && !inBattle) ? node.choices : []
        const endings = adv.endings || []
        update.nodeEnding = endings.length ? endings[endings.length - 1].name : ''
        update.log = (adv.log || []).slice().reverse()
        const c = this.calcAdv(adv)
        update.atkTotal = c.atkTotal
        update.battleRounds = (inBattle && adv.battle.rounds) || []
        update.enemyLv = inBattle ? Math.max(1, Math.round(((adv.battle.max || 40) + (adv.battle.atk || 8)) / 8)) : 1
        update.trailDepth = trail ? trail.depth : 0
        update.trailTotal = trail ? trail.total : 0
        update.trailPct = trail ? Math.round(((trail.total - ((adv.journey || {}).left || 0)) / trail.total) * 100) : 0
        update.trailText = trail ? trail.text : ''
        update.trailChoices = trail && trail.kind === 'event' && !inBattle ? [{ id: 'a', label: (trail.a || {}).label || 'A' }, { id: 'b', label: (trail.b || {}).label || 'B' }] : []
        if (endings.length && !this.data.showEnd) {
          update.showEnd = true
          update.endName = update.nodeEnding
          this.burst()
        }
        if (!endings.length && this.data.showEnd) {
          update.showEnd = false
          update.endName = ''
        }
      }
      this.setData(update)
      if (fromPull) wx.showToast({ title: '已刷新 ♡', icon: 'none', duration: 1200 })
    } catch (e) { this.setData({ loading: false }) }
  },

  pickStartMode(e) { this.setData({ startMode: e.currentTarget.dataset.m }) },
  pickStartStory(e) {
    const s = e.currentTarget.dataset.s
    this.setData({ startStory: s })
    this.applyTheme(s)
  },

  async start() {
    const { callApi } = require('../../utils/cloud')
    try {
      await callApi('advStart', { storyId: this.data.startStory, mode: this.data.startMode })
      this.setData({ showEnd: false, endName: '', particles: [] })
      wx.showToast({ title: '冒险开始！', icon: 'none' })
      this.sync(false)
    } catch (e) {}
  },

  async join() {
    const { callApi } = require('../../utils/cloud')
    try {
      await callApi('advJoin', {})
      wx.showToast({ title: '已加入队伍 ♡', icon: 'none' })
      this.sync(false)
    } catch (e) {}
  },

  async trailChoose(e) {
    const which = e.currentTarget.dataset.w
    if (this.data.choosing) return
    const { callApi } = require('../../utils/cloud')
    this.setData({ choosing: true })
    try {
      const res = await callApi('advTrail', { which })
      if (res.event && res.event.msg) {
        const parts = [res.event.msg]
        if (res.event.hp) parts.push(`生命${res.event.hp > 0 ? '+' : ''}${res.event.hp}`)
        if (res.event.gold) parts.push(`金币${res.event.gold > 0 ? '+' : ''}${res.event.gold}`)
        if (res.event.atk) parts.push(`攻击+${res.event.atk}`)
        wx.showToast({ title: parts.join(' ').slice(0, 32), icon: 'none', duration: 2400 })
      }
      if (res.event && res.event.trailDone) {
        if (res.event.ending) {
          this.setData({ showEnd: true, endName: res.event.ending })
          this.burst()
        } else {
          wx.showToast({ title: '旅途走完啦，前方就是终章！', icon: 'none', duration: 2200 })
        }
      }
      if (res.adv) this.applyAdv(res.adv, null)
      this.sync(false)
    } catch (err) {
      // 报错多半是手慢/TA 先选了:自动同步到最新状态,不用重进;
      // 写库类错误则弹窗展示全文(不截断),方便截图定位
      const msg = (err && err.message) || ''
      if (/写入失败|fail/.test(msg)) {
        wx.showModal({ title: '遇到一点问题', content: `${msg}\n\n已自动同步到最新状态，截图发我定位。`, showCancel: false, confirmText: '知道了' })
      }
      this.sync(false)
    } finally { this.setData({ choosing: false }) }
  },

  // 把服务端 adv 渲染进页面(含旅途/战斗/结局)
  // 注意:云库禁止 null→对象覆写,服务端以 {} 表示"无战斗/无旅途",此处按 name/kind 判定
  inBattle(adv) {
    return !!(adv && adv.battle && adv.battle.name)
  },
  hasTrail(adv) {
    return !!(adv && adv.trail && adv.trail.kind)
  },
  applyAdv(adv, ev) {
    const node = this.nodeOf(adv)
    const endings = adv.endings || []
    const c = this.calcAdv(adv)
    const inBattle = this.inBattle(adv)
    const hasTrail = this.hasTrail(adv)
    const trail = hasTrail ? adv.trail : null
    const update = {
      adv,
      inBattle,
      hasTrail,
      nodeText: node ? node.text : '',
      nodeChoices: node && node.choices && !inBattle && !hasTrail ? node.choices : [],
      nodeEnding: endings.length ? endings[endings.length - 1].name : '',
      log: (adv.log || []).slice().reverse(),
      atkTotal: c.atkTotal,
      battleRounds: (ev && ev.rounds) || ((inBattle && adv.battle.rounds) || []),
      enemyLv: inBattle ? Math.max(1, Math.round(((adv.battle.max || 40) + (adv.battle.atk || 8)) / 8)) : 1,
      trailDepth: trail ? trail.depth : 0,
      trailTotal: trail ? trail.total : 0,
      trailPct: trail ? Math.round(((trail.total - (adv.journey ? adv.journey.left : 0)) / trail.total) * 100) : 0,
      trailText: trail ? trail.text : '',
      trailChoices: trail && trail.kind === 'event' && !inBattle ? [{ id: 'a', label: (trail.a || {}).label || '选左' }, { id: 'b', label: (trail.b || {}).label || '选右' }] : []
    }
    if (ev && ev.type === 'ending') {
      update.showEnd = true
      update.endName = ev.name
      this.burst()
    }
    this.setData(update)
  },

  async choose(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.choosing) return
    const { callApi } = require('../../utils/cloud')
    this.setData({ choosing: true })
    try {
      const res = await callApi('advChoose', { choice: id })
      if (res.adv) {
        const adv = res.adv
        this.applyAdv(adv, res.event)
        if (res.event && res.event.type === 'battle') {
          this.setData({ battling: true })
          setTimeout(() => this.setData({ battling: false }), 700)
          wx.showToast({ title: `${res.event.icon} ${res.event.name}出现了!`, icon: 'none', duration: 2000 })
        } else if (res.event && (res.event.type === 'trail')) {
          wx.showToast({ title: `启程！共 ${res.event.total} 难`, icon: 'none', duration: 2000 })
        } else if (res.event && res.event.type === 'advance') {
          const gains = []
          if ((res.event.loot || []).length) gains.push(`获得 ${(res.event.loot || []).join('、')}`)
          if (res.event.gold) gains.push(`金币 ${res.event.gold > 0 ? '+' : ''}${res.event.gold}`)
          if (res.event.hp) gains.push(`生命 ${res.event.hp > 0 ? '+' : ''}${res.event.hp}`)
          if (gains.length) wx.showToast({ title: gains.join(' · ').slice(0, 30), icon: 'none', duration: 2200 })
        }
      }
      this.sync(false)
    } catch (err) {
      this.sync(false)
    } finally { this.setData({ choosing: false }) }
  },

  async battle(e) {
    const move = e.currentTarget.dataset.m
    if (this.data.battling) return
    const { callApi } = require('../../utils/cloud')
    this.setData({ battling: true })
    try {
      const res = await callApi('advBattle', { move })
      if (res.adv) {
        const adv = res.adv
        const ev = res.event || {}
        this.applyAdv(adv, ev)
        if (ev.type === 'victory') {
          const gains = [`金币+${ev.gold || 0}`]
          if ((ev.loot || []).length) gains.push(`拾取:${ev.loot.join('、')}`)
          wx.showToast({ title: `🏆 胜利!${gains.join(' ').slice(0, 28)}`, icon: 'none', duration: 2600 })
          if (ev.trailDone) {
            if (ev.ending) {
              this.setData({ showEnd: true, endName: ev.ending })
              this.burst()
            } else {
              wx.showToast({ title: '旅途走完啦，前方就是终章！', icon: 'none', duration: 2200 })
            }
          }
          if (ev.chained && ev.chained.type === 'ending') {
            this.setData({ showEnd: true, endName: ev.chained.name })
            this.burst()
          }
        } else if (ev.type === 'defeat') {
          wx.showModal({ title: '被打趴了…', content: '村民把你们抬回营地，30 血复活。装备都在，再打一次吧！', showCancel: false, confirmText: '再战！' })
        } else if (ev.type === 'flee' && ev.ok) {
          if (ev.trailDone) {
            if (ev.ending) {
              this.setData({ showEnd: true, endName: ev.ending })
              this.burst()
            } else {
              wx.showToast({ title: '溜出了这场，继续赶路 ♡', icon: 'none', duration: 2000 })
            }
          } else if (ev.trailNext) {
            wx.showToast({ title: '溜了溜了，继续赶路 🏃', icon: 'none', duration: 1800 })
          } else {
            wx.showToast({ title: '溜了溜了 🏃', icon: 'none' })
          }
        } else if (ev.type === 'ending') {
          this.setData({ showEnd: true, endName: ev.name })
          this.burst()
        }
      }
      this.sync(false)
    } catch (err) {} finally {
      setTimeout(() => this.setData({ battling: false }), 600)
    }
  },

  async abandon() {
    const ok = await wx.showModal({ title: '结束本局？', content: '进度会清空，可以随时开新局', confirmText: '结束' })
    if (!ok.confirm) return
    const { callApi } = require('../../utils/cloud')
    try {
      await callApi('advAbandon', {})
      this.setData({ adv: null, showEnd: false, endName: '', particles: [], nodeChoices: [], nodeText: '' })
    } catch (e) {}
  },

  closeEnd() { this.setData({ showEnd: false, particles: [] }) },

  burst() {
    const icons = ['🗡️', '💎', '✨', '🌟', '🏆', '💗']
    this.setData({
      particles: Array.from({ length: 20 }, (_, i) => ({
        id: i,
        t: icons[i % icons.length],
        x: 5 + Math.random() * 90,
        s: 36 + Math.random() * 40,
        d: (1.2 + Math.random() * 1.2).toFixed(2),
        delay: (Math.random() * 0.6).toFixed(2)
      }))
    })
  }
})
