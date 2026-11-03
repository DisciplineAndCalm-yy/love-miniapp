const NORMAL_TILES = [
  { t: 'start', icon: '🏁', label: '出发' },
  { t: 'heart', icon: '💖', label: '+3', v: 3 },
  { t: 'task', icon: '🎲', label: '真心话', text: '说出对方的三个优点' },
  { t: 'heart', icon: '🍓', label: '+5', v: 5 },
  { t: 'move', icon: '➡️', label: '前进2', v: 2 },
  { t: 'task', icon: '💌', label: '小纸条', text: '给对方发一句想念' },
  { t: 'rest', icon: '😴', label: '休息' },
  { t: 'heart', icon: '🌸', label: '+4', v: 4 },
  { t: 'move', icon: '⬅️', label: '后退1', v: -1 },
  { t: 'task', icon: '🤝', label: '牵手', text: '牵住对方的手 30 秒' },
  { t: 'heart', icon: '🍭', label: '+6', v: 6 },
  { t: 'task', icon: '📸', label: '拍合照', text: '一起自拍一张' },
  { t: 'move', icon: '➡️', label: '前进3', v: 3 },
  { t: 'heart', icon: '👑', label: '+8', v: 8 },
  { t: 'task', icon: '🎁', label: '小愿望', text: '答应对方一个小愿望' },
  { t: 'heart', icon: '🌟', label: '+5', v: 5 },
  { t: 'task', icon: '🍜', label: '喂一口', text: '互相喂对方吃一口东西' },
  { t: 'move', icon: '⬅️', label: '后退2', v: -2 },
  { t: 'heart', icon: '🎈', label: '+7', v: 7 },
  { t: 'task', icon: '🎤', label: '唱情歌', text: '给 TA 唱一句情歌' },
  { t: 'rest', icon: '☕', label: '歇一会' },
  { t: 'heart', icon: '💝', label: '+9', v: 9 },
  { t: 'task', icon: '🐾', label: '学一学', text: '学 TA 最爱的小动物叫一声' },
  { t: 'heart', icon: '💐', label: '+6', v: 6 },
  { t: 'task', icon: '🎯', label: '猜数字', text: '互相猜一个数字，猜错的人满足对方一个要求' },
  { t: 'move', icon: '➡️', label: '前进4', v: 4 },
  { t: 'heart', icon: '🎊', label: '+8', v: 8 },
  { t: 'task', icon: '🤳', label: '鬼脸自拍', text: '一起做个鬼脸拍张照' },
  { t: 'task', icon: '🫧', label: '吹气球', text: '一起吹一个气球，谁先笑谁输' },
  { t: 'heart', icon: '🍀', label: '+5', v: 5 },
  { t: 'rest', icon: '🍵', label: '喝口水' },
  { t: 'heart', icon: '🍬', label: '+4', v: 4 },
  { t: 'task', icon: '🧩', label: '小游戏', text: '一起玩一局小游戏，输的人表演个才艺' },
  { t: 'move', icon: '⬅️', label: '后退1', v: -1 },
  { t: 'heart', icon: '🌈', label: '+6', v: 6 },
  { t: 'task', icon: '📞', label: '打个电话', text: '给对方打个电话说一句话' },
  { t: 'heart', icon: '🧸', label: '+5', v: 5 },
  { t: 'task', icon: '😆', label: '讲笑话', text: '讲一个笑话，逗笑对方' },
  { t: 'move', icon: '➡️', label: '前进3', v: 3 },
  { t: 'heart', icon: '🍩', label: '+7', v: 7 },
  { t: 'rest', icon: '🌿', label: '深呼吸' },
  { t: 'task', icon: '🖍️', label: '画一张', text: '给对方画一张简笔画' },
  { t: 'heart', icon: '💎', label: '+8', v: 8 },
  { t: 'task', icon: '🍪', label: '分享零食', text: '分享一块零食给对方' },
  { t: 'move', icon: '⬅️', label: '后退2', v: -2 },
  { t: 'heart', icon: '🎵', label: '+5', v: 5 },
  { t: 'task', icon: '🧴', label: '涂护手霜', text: '给对方涂护手霜' },
  { t: 'heart', icon: '🐣', label: '+4', v: 4 },
  { t: 'task', icon: '🎁', label: '小愿望', text: '再答应对方一个小要求' },
  { t: 'move', icon: '➡️', label: '前进2', v: 2 },
  { t: 'heart', icon: '🌻', label: '+6', v: 6 },
  { t: 'rest', icon: '☁️', label: '发会呆' },
  { t: 'task', icon: '🤗', label: '拥抱', text: '认真抱对方 10 秒' },
  { t: 'heart', icon: '🍒', label: '+5', v: 5 },
  { t: 'task', icon: '🪞', label: '悄悄话', text: '对镜子或耳边说一句悄悄话' },
  { t: 'move', icon: '➡️', label: '前进4', v: 4 },
  { t: 'heart', icon: '🌟', label: '+7', v: 7 },
  { t: 'task', icon: '🎨', label: '合照姿势', text: '摆个可爱的姿势合照' },
  { t: 'heart', icon: '💫', label: '+6', v: 6 },
  { t: 'rest', icon: '🍃', label: '休息' },
  { t: 'task', icon: '🥰', label: '表白', text: '认真说一句喜欢你' },
  { t: 'heart', icon: '🎉', label: '+9', v: 9 },
  { t: 'heart', icon: '💯', label: '+5', v: 5 },
  { t: 'end', icon: '🏆', label: '终点', text: '你们走完一圈啦，抱一个 ♡' }
]

// 情侣版（暧昧向）：以「男生 / 女生」区分，上限=接吻、脱到剩内衣内裤、挑逗
const COUPLE_TILES = [
  { t: 'start', icon: '🌹', label: '出发' },
  { t: 'heart', icon: '💋', label: '+2', v: 2 },
  { t: 'task', icon: '🫦', label: '耳边情话', text: '女生贴着男生的耳朵，轻轻说一句情话' },
  { t: 'heart', icon: '💗', label: '+3', v: 3 },
  { t: 'move', icon: '🫶', label: '靠近2', v: 2 },
  { t: 'task', icon: '🤍', label: '背后抱', text: '男生从背后抱住女生，安静待 10 秒' },
  { t: 'rest', icon: '🛋️', label: '依偎' },
  { t: 'heart', icon: '🔥', label: '+2', v: 2 },
  { t: 'move', icon: '💤', label: '后退1', v: -1 },
  { t: 'task', icon: '👀', label: '对视', text: '女生与男生对视 30 秒，谁先笑谁输' },
  { t: 'heart', icon: '🍷', label: '+4', v: 4 },
  { t: 'task', icon: '💆', label: '按按摩', text: '男生给女生捏肩颈 1 分钟' },
  { t: 'move', icon: '🌙', label: '前进3', v: 3 },
  { t: 'heart', icon: '💞', label: '+5', v: 5 },
  { t: 'task', icon: '💋', label: '脸颊吻', text: '男生轻轻亲一下女生的脸颊' },
  { t: 'task', icon: '👂', label: '撩耳朵', text: '女生凑到男生耳边低声撩拨，气息打在耳畔' },
  { t: 'heart', icon: '💓', label: '+3', v: 3 },
  { t: 'move', icon: '⬅️', label: '后退2', v: -2 },
  { t: 'task', icon: '🫂', label: '抱一分钟', text: '抱紧对方，安静待一分钟' },
  { t: 'heart', icon: '🌷', label: '+4', v: 4 },
  { t: 'task', icon: '💋', label: '深吻', text: '两人闭上眼深吻 10 秒' },
  { t: 'heart', icon: '💘', label: '+5', v: 5 },
  { t: 'task', icon: '🎶', label: '贴身慢舞', text: '身体贴着身体，慢慢晃一首歌' },
  { t: 'task', icon: '💋', label: '脖子吻', text: '男生亲吻女生的脖颈' },
  { t: 'move', icon: '➡️', label: '前进4', v: 4 },
  { t: 'task', icon: '🔥', label: '隔着挑逗', text: '隔着衣服轻轻撩拨对方，点到为止' },
  { t: 'heart', icon: '💝', label: '+4', v: 4 },
  { t: 'task', icon: '👕', label: '脱到剩内衣', text: '一件件脱到只剩内衣内裤，视线不许移开' },
  { t: 'task', icon: '😳', label: '贴面挑逗', text: '只剩内衣相拥，贴着耳边互相挑逗' },
  { t: 'heart', icon: '🌸', label: '+3', v: 3 },
  { t: 'task', icon: '💋', label: '锁骨吻', text: '男生轻轻亲吻女生的锁骨' },
  { t: 'heart', icon: '🍫', label: '+3', v: 3 },
  { t: 'task', icon: '🫧', label: '耳边吹气', text: '女生在男生耳边轻轻吹一口气' },
  { t: 'move', icon: '⬅️', label: '后退1', v: -1 },
  { t: 'heart', icon: '🎀', label: '+4', v: 4 },
  { t: 'task', icon: '💋', label: '手背吻', text: '男生轻吻女生的手背' },
  { t: 'task', icon: '🤗', label: '十指相扣', text: '十指相扣，说一句悄悄话' },
  { t: 'heart', icon: '🌹', label: '+5', v: 5 },
  { t: 'move', icon: '➡️', label: '前进3', v: 3 },
  { t: 'task', icon: '👗', label: '换个抱法', text: '换个姿势把对方抱在怀里坐一会' },
  { t: 'rest', icon: '🍷', label: '小酌' },
  { t: 'task', icon: '💋', label: '咬耳垂', text: '轻轻咬一下对方的耳垂' },
  { t: 'heart', icon: '💗', label: '+4', v: 4 },
  { t: 'task', icon: '🧣', label: '搂脖子', text: '女生搂住男生的脖子' },
  { t: 'move', icon: '⬅️', label: '后退2', v: -2 },
  { t: 'heart', icon: '💞', label: '+3', v: 3 },
  { t: 'task', icon: '💋', label: '湿吻', text: '来一个不肯分开的湿吻' },
  { t: 'task', icon: '🔥', label: '腰侧摩挲', text: '手停在对方腰侧轻轻摩挲' },
  { t: 'heart', icon: '💝', label: '+5', v: 5 },
  { t: 'move', icon: '➡️', label: '前进2', v: 2 },
  { t: 'task', icon: '🫦', label: '耳边表白', text: '在耳边低声说一句喜欢你' },
  { t: 'rest', icon: '☁️', label: '依偎' },
  { t: 'task', icon: '💋', label: '躺下吻', text: '一起躺下，继续亲吻' },
  { t: 'heart', icon: '🌷', label: '+4', v: 4 },
  { t: 'task', icon: '👕', label: '解衣扣', text: '帮对方解开一颗衣扣' },
  { t: 'move', icon: '➡️', label: '前进4', v: 4 },
  { t: 'task', icon: '🔥', label: '锁骨撩', text: '手指沿着对方锁骨轻轻滑下' },
  { t: 'heart', icon: '💘', label: '+5', v: 5 },
  { t: 'rest', icon: '💤', label: '相拥' },
  { t: 'task', icon: '💋', label: '吻到停不下', text: '深吻到谁都不想先停' },
  { t: 'heart', icon: '🎉', label: '+6', v: 6 },
  { t: 'task', icon: '🤍', label: '再说情话', text: '再说一句对方没听过的情话' },
  { t: 'heart', icon: '💯', label: '+4', v: 4 },
  { t: 'end', icon: '🛏️', label: '到站', text: '心跳快到不行，就这样抱着 ♡' }
]

// 纯情趣调情版：成年情侣、双方自愿、以「男生 / 女生」区分、露骨（仅本地，不写库/不写文档）
const INTIMATE_TILES = [
  { t: 'start', icon: '🌶️', label: '开场' },
  { t: 'task', icon: '🫦', label: '含住', text: '女生跪下来张嘴含住男生的小弟弟，舌头打转，一直含到最深' },
  { t: 'heart', icon: '💋', label: '+2', v: 2 },
  { t: 'task', icon: '🖐️', label: '揉', text: '男生把女生抵在墙上深吻，手探进衣里轻轻揉' },
  { t: 'task', icon: '🛏️', label: '坐到底', text: '女生跨坐上去，扶着男生一点点坐到最里面' },
  { t: 'heart', icon: '🔥', label: '+2', v: 2 },
  { t: 'task', icon: '💗', label: '背后', text: '男生从背后扶着女生的腰慢慢进入，贴着女生耳边喘' },
  { t: 'task', icon: '🫦', label: '深喉', text: '女生用嘴含住男生，吸到最里面，再抬眼看向男生' },
  { t: 'rest', icon: '💨', label: '喘口气', text: '抵着额头喘口气，再继续' },
  { t: 'task', icon: '🌶️', label: '胸口', text: '男生低头含住女生的胸，用舌尖轻轻打转' },
  { t: 'task', icon: '✋', label: '往下', text: '女生仰躺着张开腿，让男生的手一路滑下去' },
  { t: 'heart', icon: '💦', label: '+2', v: 2 },
  { t: 'task', icon: '🛏️', label: '更深', text: '男生抬起女生的腿进入得更深，一下一下顶到底' },
  { t: 'task', icon: '🦵', label: '跪趴', text: '女生跪趴着翘高，回头看男生求别停' },
  { t: 'move', icon: '⬅️', label: '后退1', v: -1 },
  { t: 'task', icon: '👂', label: '插进去', text: '男生含着女生的耳垂说想要，然后真的慢慢插进去' },
  { t: 'task', icon: '👑', label: '女生在上', text: '女生在上面自己动，节奏全由女生掌控' },
  { t: 'heart', icon: '💞', label: '+3', v: 3 },
  { t: 'task', icon: '🔗', label: '按住', text: '男生把女生的手按在头顶，深深浅浅地磨' },
  { t: 'rest', icon: '🧊', label: '冰火', text: '女生含一口冰水再含住男生，凉得男生一颤' },
  { t: 'task', icon: '🌪️', label: '换姿势', text: '男生把女生翻过去，用更深的姿势直到女生发抖' },
  { t: 'heart', icon: '🔥', label: '+3', v: 3 },
  { t: 'task', icon: '🫦', label: '还想要', text: '女生凑到男生耳边说还想要，再用行动回答男生' },
  { t: 'move', icon: '➡️', label: '前进4', v: 4 },
  { t: 'task', icon: '💦', label: '挑逗', text: '男生用指尖挑逗女生最敏感的地方，看女生绷紧' },
  { t: 'heart', icon: '💘', label: '+2', v: 2 },
  { t: 'task', icon: '🧱', label: '抱起来', text: '男生把女生抱起来抵在墙上，深深进入' },
  { t: 'task', icon: '🐾', label: '控制节奏', text: '男生放慢速度一下一下地磨，看女生忍不住求饶' },
  { t: 'heart', icon: '💧', label: '+2', v: 2 },
  { t: 'task', icon: '🙈', label: '蒙上眼', text: '蒙上眼睛，只能用手和嘴去猜对方在做什么' },
  { t: 'rest', icon: '💤', label: '相拥', text: '事后相拥，慢慢平复心跳' },
  { t: 'heart', icon: '💋', label: '+2', v: 2 },
  { t: 'task', icon: '✊', label: '用手到顶点', text: '男生用手把女生送上顶点' },
  { t: 'move', icon: '⬅️', label: '后退2', v: -2 },
  { t: 'heart', icon: '💦', label: '+3', v: 3 },
  { t: 'task', icon: '👅', label: '用舌头', text: '男生低头用舌头让女生发软' },
  { t: 'task', icon: '💇', label: '抓头发', text: '含着时被男生轻轻抓住头发' },
  { t: 'heart', icon: '🔥', label: '+2', v: 2 },
  { t: 'move', icon: '➡️', label: '前进3', v: 3 },
  { t: 'task', icon: '🛌', label: '侧着来', text: '侧躺着，男生从后面进入' },
  { t: 'rest', icon: '💨', label: '喘口气', text: '停下来喘口气' },
  { t: 'task', icon: '🦷', label: '咬肩', text: '在男生肩上轻轻咬一口留个印' },
  { t: 'heart', icon: '💘', label: '+3', v: 3 },
  { t: 'task', icon: '🏇', label: '加快节奏', text: '女生在上面加快，由女生带节奏' },
  { t: 'move', icon: '⬅️', label: '后退1', v: -1 },
  { t: 'heart', icon: '💧', label: '+2', v: 2 },
  { t: 'task', icon: '🧍', label: '扶墙站好', text: '女生扶着墙站好，把主动权交给男生' },
  { t: 'task', icon: '👄', label: '舔胸', text: '女生用舌头逗弄男生的胸口' },
  { t: 'heart', icon: '💦', label: '+3', v: 3 },
  { t: 'move', icon: '➡️', label: '前进2', v: 2 },
  { t: 'task', icon: '🤝', label: '一起到', text: '十指相扣，一起到顶点' },
  { t: 'rest', icon: '💤', label: '缓一缓', text: '相拥缓一缓' },
  { t: 'task', icon: '🗣️', label: '说幻想', text: '说出此刻最想被对方怎样对待' },
  { t: 'heart', icon: '💋', label: '+2', v: 2 },
  { t: 'task', icon: '✋', label: '套弄', text: '女生用手帮男生' },
  { t: 'move', icon: '➡️', label: '前进4', v: 4 },
  { t: 'task', icon: '⤵️', label: '深入到底', text: '顶着最深处停一下，感受彼此' },
  { t: 'heart', icon: '🔥', label: '+3', v: 3 },
  { t: 'rest', icon: '💤', label: '相拥', text: '抱在一起歇一会' },
  { t: 'task', icon: '🔁', label: '再来一次', text: '休息一下，再来一次' },
  { t: 'heart', icon: '💘', label: '+4', v: 4 },
  { t: 'task', icon: '🗯️', label: '耳语指令', text: '在男生耳边低声下指令，让男生照做' },
  { t: 'heart', icon: '💯', label: '+2', v: 2 },
  { t: 'end', icon: '🌙', label: '到站', text: '今晚，把彼此完全交给对方 ♡' }
]

// 10×10 双层外环 = 64 格，顺时针：外圈(36) 接 内圈(28)
function ringOrder(top, left, bottom, right) {
  const o = []
  for (let c = left; c <= right; c += 1) o.push({ r: top, c })
  for (let r = top + 1; r <= bottom; r += 1) o.push({ r, c: right })
  for (let c = right - 1; c >= left; c -= 1) o.push({ r: bottom, c })
  for (let r = bottom - 1; r >= top + 1; r -= 1) o.push({ r, c: left })
  return o
}
function buildPositions() {
  return ringOrder(0, 0, 9, 9).concat(ringOrder(1, 1, 8, 8))
}
const POS = buildPositions()
function decorate(arr) {
  return arr.map((t, i) => Object.assign({}, t, { idx: i, row: POS[i].r + 1, col: POS[i].c + 1 }))
}

const DICE_FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
const MODE_TILES = {
  normal: decorate(NORMAL_TILES),
  couple: decorate(COUPLE_TILES),
  intimate: decorate(INTIMATE_TILES)
}
const MODE_MSG = {
  normal: '轮流掷骰子，先走到终点、心动值更高的人赢 ♡',
  couple: '♥ 情侣版，只有你们知道的小秘密 ♥',
  intimate: '今晚只属于你们两个人 ♥'
}
const MAX_PLAYERS = 2

Page({
  data: {
    mode: 'normal',
    tiles: MODE_TILES.normal,
    players: [{ key: 0, name: '我', pos: 0, hearts: 0 }],
    occupied: [],
    turn: 0,
    rolling: false,
    dice: 0,
    diceFace: '',
    done: false,
    winner: '',
    message: MODE_MSG.normal,
    maxPlayers: MAX_PLAYERS,
    fxType: '',
    fxItems: []
  },

  onLoad() {
    const app = getApp()
    const user = (app && app.globalData && app.globalData.user) || {}
    const players = [{ key: 0, name: user.nickName || '我', pos: 0, hearts: 0 }]
    this.setData({ players, occupied: this.calcOccupied(players) })
    this._secretN = 0
    this._secretTs = 0
    this._diceN = 0
    this._diceTs = 0
  },
  onUnload() { clearTimeout(this._fxT) },

  calcOccupied(players) {
    const n = this.data.tiles.length
    const arr = []
    for (let i = 0; i < n; i += 1) arr.push(players.some((p) => p.pos === i))
    return arr
  },
  commit(players) { this.setData({ players, occupied: this.calcOccupied(players) }) },

  addPlayer() {
    const players = this.data.players.slice()
    if (players.length >= MAX_PLAYERS) return
    const idx = players.length
    players.push({ key: idx, name: `玩家${idx + 1}`, pos: 0, hearts: 0 })
    this.commit(players)
    wx.showToast({ title: '玩家加入 ♡', icon: 'none' })
  },

  countTap(kind) {
    const now = Date.now()
    const tsKey = kind === 'secret' ? '_secretTs' : '_diceTs'
    const nKey = kind === 'secret' ? '_secretN' : '_diceN'
    if (now - (this[tsKey] || 0) > 900) this[nKey] = 0
    this[tsKey] = now
    this[nKey] = (this[nKey] || 0) + 1
    return this[nKey]
  },
  secretTap() {
    const n = this.countTap('secret')
    if (n >= 5) { this._secretN = 0; this.setMode(this.data.mode === 'normal' ? 'couple' : 'normal') }
    else if (n >= 2) wx.showToast({ title: `再点 ${5 - n} 下…`, icon: 'none' })
  },
  diceTap() {
    if (this.data.rolling) return
    if (this.data.mode === 'normal') return
    const n = this.countTap('dice')
    if (n >= 5) { this._diceN = 0; this.setMode(this.data.mode === 'couple' ? 'intimate' : 'couple') }
    else if (n >= 2) wx.showToast({ title: `再点 ${5 - n} 下…`, icon: 'none' })
  },

  setMode(mode) {
    const players = this.data.players.map((p) => Object.assign({}, p, { pos: 0, hearts: 0 }))
    this.setData({
      mode, tiles: MODE_TILES[mode], turn: 0, dice: 0, diceFace: '', done: false, winner: '',
      message: MODE_MSG[mode], fxType: '', fxItems: []
    })
    this.commit(players)
    try { wx.vibrateShort({ type: 'heavy' }) } catch (e) {}
  },

  roll() {
    if (this.data.rolling || this.data.done) return
    const turn = this.data.turn
    const last = this.data.tiles.length - 1
    const steps = 1 + Math.floor(Math.random() * 6)
    let pos = this.data.players[turn].pos
    this.setData({ rolling: true, dice: steps, diceFace: DICE_FACE[steps] })
    let i = 0
    const tick = () => {
      if (i < steps && pos < last) {
        pos += 1
        i += 1
        const players = this.data.players.slice()
        players[turn] = Object.assign({}, players[turn], { pos })
        this.commit(players)
        setTimeout(tick, 240)
      } else {
        this.applyTile(turn, pos)
      }
    }
    setTimeout(tick, 280)
  },

  applyTile(turn, pos) {
    const tiles = this.data.tiles
    const tile = tiles[pos]
    const players = this.data.players.slice()
    let hearts = players[turn].hearts
    let message = ''
    let ended = false
    if (tile.t === 'heart') { hearts += tile.v; message = `${players[turn].name} ${tile.icon} 心动 +${tile.v}` }
    else if (tile.t === 'move') {
      const np = Math.max(0, Math.min(tiles.length - 1, pos + tile.v))
      players[turn] = Object.assign({}, players[turn], { pos: np })
      message = `${players[turn].name} ${tile.v > 0 ? '前进' : '后退'} ${Math.abs(tile.v)} 格`
    } else if (tile.t === 'task') message = `${tile.icon} ${tile.label}：${tile.text}`
    else if (tile.t === 'start') message = `${tile.icon} ${players[turn].name} 从起点出发啦`
    else if (tile.t === 'rest') message = `${tile.icon} ${tile.text || '原地歇一会儿'}`
    else if (tile.t === 'end') { message = `🏆 ${tile.text}`; ended = true }
    players[turn] = Object.assign({}, players[turn], { hearts })
    this.commit(players)
    this.setData({ message })
    this.playFx(tile)
    try { wx.vibrateShort({ type: 'medium' }) } catch (e) {}

    if (ended) {
      let best = players[0]
      players.forEach((p) => { if (p.hearts > best.hearts) best = p })
      this.setData({ rolling: false, done: true, winner: best.name, message: `🏆 ${best.name} 心动值最高，赢啦 ♡` })
      return
    }
    this.setData({ rolling: false, turn: (turn + 1) % players.length })
  },

  playFx(tile) {
    let emojis = ['✨']
    let variant = 'up'
    if (tile.t === 'heart') { emojis = ['💗', '💖', '❤️', '💕', '💘']; variant = 'up' }
    else if (tile.t === 'task') { emojis = ['✨', '⭐', '💫', '🌟']; variant = 'pop' }
    else if (tile.t === 'rest') { emojis = ['💤', '☁️', '😴']; variant = 'up' }
    else if (tile.t === 'start') { emojis = ['🚀', '✨']; variant = 'up' }
    else if (tile.t === 'end') { emojis = ['🎉', '🎊', '✨', '🎈', '🏆']; variant = 'down' }
    else if (tile.t === 'move') { emojis = tile.v > 0 ? ['➡️', '💨'] : ['⬅️', '💨']; variant = 'side' }
    const items = []
    for (let i = 0; i < 12; i += 1) {
      items.push({ i, emoji: emojis[i % emojis.length], left: Math.round(8 + Math.random() * 80), top: Math.round(6 + Math.random() * 60), delay: (Math.random() * 0.3).toFixed(2), size: 30 + Math.round(Math.random() * 26) })
    }
    this.setData({ fxType: variant, fxItems: items })
    clearTimeout(this._fxT)
    this._fxT = setTimeout(() => this.setData({ fxType: '', fxItems: [] }), 1150)
  },

  restart() {
    const players = this.data.players.map((p) => Object.assign({}, p, { pos: 0, hearts: 0 }))
    this.setData({ turn: 0, dice: 0, diceFace: '', done: false, winner: '', message: MODE_MSG[this.data.mode] })
    this.commit(players)
  }
})
