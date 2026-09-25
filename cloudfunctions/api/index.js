const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const MOODS = ['love', 'miss', 'calm', 'busy', 'sad']

const MOOD_LABELS = { love: '❤️ 甜蜜', miss: '💭 想念', calm: '🌿 平静', busy: '💼 忙碌', sad: '🌧️ 低落' }

function moodLabelOf(mood) {
  return MOOD_LABELS[mood] || '❤️ 甜蜜'
}

function todayKey() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
}

function shiftDate(key, delta) {
  const d = new Date(`${key}T00:00:00+08:00`)
  d.setDate(d.getDate() + delta)
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
}

function keyFromTs(ts) {
  const n = Number(ts)
  if (!n) return ''
  try {
    return new Date(n).toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10)
  } catch (e) {
    return ''
  }
}

function normKey(item) {
  const k = item && item.dateKey
  if (typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k)) return k
  return keyFromTs(item && (item.createdAt || item.time || item.timestamp))
}

function calcStreak(keys, today) {
  const set = new Set(keys)
  let cursor = today
  if (!set.has(cursor)) {
    cursor = shiftDate(today, -1)
    if (!set.has(cursor)) return 0
  }
  let n = 0
  while (set.has(cursor)) {
    n += 1
    cursor = shiftDate(cursor, -1)
  }
  return n
}

async function getUser(openid) {
  const { data } = await db.collection('users').where({ _openid: openid }).limit(1).get()
  return data[0] || null
}

async function requireUser(openid) {
  const user = await getUser(openid)
  if (!user) throw new Error('请先打开小程序完成登录')
  return user
}

async function requireCouple(user, openid) {
  if (!user.coupleId) throw new Error('先去绑定两个人吧')
  const { data } = await db.collection('couples').doc(user.coupleId).get()
  if (!data || !data.memberOpenids.includes(openid)) {
    throw new Error('不在这个空间里')
  }
  if (data.status === 'dissolved') throw new Error('空间已解散，重新绑定可恢复')
  return data
}

async function fetchAllCheckins(where, fields) {
  const pageSize = 100
  let skip = 0
  const all = []
  for (let i = 0; i < 20; i += 1) {
    const query = db.collection('checkins').where(where)
    const { data } = await (fields
      ? query.field(fields).skip(skip).limit(pageSize).get()
      : query.skip(skip).limit(pageSize).get())
    all.push(...data)
    if (data.length < pageSize) break
    skip += pageSize
  }
  return all
}

async function dateKeys(coupleId, openid) {
  const data = await fetchAllCheckins(
    { coupleId, _openid: openid },
    { dateKey: true }
  )
  return data.map((item) => item.dateKey)
}

async function bothDateKeys(coupleId) {
  const data = await fetchAllCheckins(
    { coupleId },
    { dateKey: true, _openid: true }
  )
  const byDay = {}
  data.forEach((item) => {
    byDay[item.dateKey] = byDay[item.dateKey] || new Set()
    byDay[item.dateKey].add(item._openid)
  })
  return Object.keys(byDay).filter((key) => byDay[key].size >= 2)
}

async function streaksFor(user, couple) {
  const today = todayKey()
  const mineKeys = await dateKeys(couple._id, user._openid)
  const partnerId = couple.memberOpenids.find((id) => id !== user._openid)
  const partnerKeys = partnerId ? await dateKeys(couple._id, partnerId) : []
  const togetherKeys = await bothDateKeys(couple._id)
  return {
    mine: calcStreak(mineKeys, today),
    partner: calcStreak(partnerKeys, today),
    together: calcStreak(togetherKeys, today)
  }
}

async function loadMembers(memberOpenids) {
  if (!memberOpenids || !memberOpenids.length) return []
  let data = []
  try {
    const r = await db.collection('users').where({
      _openid: _.in(memberOpenids)
    }).limit(20).get()
    data = r.data || []
  } catch (e) {
    console.warn('loadMembers failed', e)
    data = []
  }
  // 同一个 openid 可能有重复记录(并发登录等),合并并优先取有头像/昵称的那条
  const map = {}
  data.forEach((u) => {
    const cur = map[u._openid] || { openid: u._openid, nickName: '', avatarUrl: '', _id: '' }
    map[u._openid] = {
      openid: u._openid,
      _id: u._id || cur._id,
      nickName: (u.nickName && u.nickName !== '还没起名字' ? u.nickName : cur.nickName) || u.nickName || '还没起名字',
      avatarUrl: u.avatarUrl || cur.avatarUrl || ''
    }
  })
  const list = memberOpenids.map((id) => map[id] || {
    openid: id,
    _id: '',
    nickName: '还没起名字',
    avatarUrl: ''
  })
  // 头像是云存储 fileID 时,统一换成 https 临时链接,避免各端渲染空白
  try {
    const files = [...new Set(list.map((m) => m.avatarUrl).filter((f) => f && String(f).startsWith('cloud://')))]
    if (files.length) {
      const { fileList } = await cloud.getTempFileURL({ fileList: files })
      const urlMap = {}
      ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
      list.forEach((m) => { if (urlMap[m.avatarUrl]) m.avatarUrl = urlMap[m.avatarUrl] })
    }
  } catch (e) {
    console.warn('loadMembers getTempFileURL failed', e)
  }
  // 清掉本地临时路径(wxfile:// 等),它们换设备必然加载失败,让前端回落到首字占位
  list.forEach((m) => {
    const url = String(m.avatarUrl || '')
    if (url && !url.startsWith('http') && !url.startsWith('cloud://')) m.avatarUrl = ''
  })
  return list
}

async function removeFiles(fileList) {
  const ids = (fileList || []).filter(Boolean)
  if (!ids.length) return
  try {
    await cloud.deleteFile({ fileList: ids })
  } catch (err) {
    console.warn('deleteFile failed', err)
  }
}

function fail(message) {
  return { ok: false, message }
}

// ===== 冒险剧情:状态机 + 回合制战斗 =====
// battle 节点:进入后开战,打赢按掉落表 roll 战利品再跳 winNext
// drops: [{name, atk(装备攻击加成), rate(0~1)}], gold: [min,max]
const ADV_DEFS = {
  forest: {
    title: '🌲 雾林物语', start: 'start',
    nodes: {
      start: { choices: [{ id: 'left', label: '🐉 左行屠龙' }, { id: 'right', label: '💎 右行寻宝' }] },
      left: { choices: [{ id: 'fight', label: '⚔️ 正面迎战' }, { id: 'feed', label: '🍖 分它烤肉' }] },
      right: { choices: [{ id: 'sneak', label: '🐾 悄悄潜入' }, { id: 'rush', label: '🏃 直接冲' }] },
      feed: { loot: [{ name: '🐉 龙鳞', atk: 1, rate: 1 }], hp: 10, next: 'trail' },
      fight: {
        battle: {
          name: '饿坏的幼龙', icon: '🐉', hp: 45, atk: 9,
          drops: [
            { name: '🗡️ 龙牙剑', atk: 4, rate: 1 },
            { name: '🐉 龙鳞', atk: 1, rate: 0.5 },
            { name: '🥚 龙蛋', atk: 0, rate: 0.2 }
          ],
          gold: [30, 60], winNext: 'nest'
        }
      },
      sneak: { gold: 30, next: 'cabin' },
      rush: { gold: 45, hp: -20, next: 'cabin' },
      cabin: { choices: [{ id: 'knock', label: '🚪 敲门问路' }, { id: 'peek', label: '👀 扒窗看看' }] },
      knock: { loot: [{ name: '🍖 烤肉干', atk: 0, rate: 1 }], hp: 12, next: 'trail' },
      peek: { loot: [{ name: '🧭 旧指南针', atk: 1, rate: 1 }], gold: 15, next: 'trail' },
      nest: { choices: [{ id: 'rest', label: '⛺ 在龙巢休息' }, { id: 'march', label: '🥾 继续深入' }] },
      rest: { hp: 25, gold: -10, next: 'trail' },
      march: { atk: 1, next: 'trail' },
      trail: { journey: { total: 16, exit: 'deep' } },
      deep: { choices: [{ id: 'cut', label: '🗡️ 劈开荆棘' }, { id: 'talk', label: '💬 问它口令' }] },
      cut: { ending: '👑 精灵王之友', gold: 20, next: null },
      talk: { ending: '🌸 花海漫步', hp: 15, next: null }
    }
  },
  sea: {
    title: '🌊 深海之歌', start: 'start',
    nodes: {
      start: { choices: [{ id: 'take', label: '🐚 带它走' }, { id: 'leave', label: '🚶 留它在沙滩' }] },
      take: { choices: [{ id: 'fight', label: '⚔️ 和海盗干一架' }, { id: 'trade', label: '💰 拿金币换平安' }] },
      leave: { choices: [{ id: 'back', label: '💗 回头看看' }, { id: 'go', label: '🏖️ 继续晒太阳' }] },
      fight: {
        battle: {
          name: '独眼海盗船长', icon: '🏴‍☠️', hp: 40, atk: 8,
          drops: [
            { name: '🔪 海盗弯刀', atk: 3, rate: 1 },
            { name: '🍾 朗姆酒', atk: 0, rate: 0.6 },
            { name: '🗺️ 藏宝图', atk: 0, rate: 0.35 }
          ],
          gold: [25, 55], winNext: 'deck'
        }
      },
      trade: { loot: [{ name: '🗺️ 藏宝图', atk: 0, rate: 1 }], gold: -15, next: 'trail' },
      back: { hp: 20, loot: [{ name: '🧜 人鱼的祝福', atk: 1, rate: 1 }], next: 'trail' },
      go: { ending: '☀️ 咸鱼也有梦', gold: 10, next: null },
      trail: { journey: { total: 16, exit: 'wish' } },
      deck: { choices: [{ id: 'spare', label: '🕊️ 放走海盗' }, { id: 'recruit', label: '🤝 招安当水手' }] },
      spare: { hp: 10, gold: 10, next: 'trail' },
      recruit: { loot: [{ name: '⚓ 船锚徽章', atk: 2, rate: 1 }], next: 'trail' },
      wish: { choices: [{ id: 'rich', label: '💰 要数不完的金币' }, { id: 'love', label: '💞 要永远在一起' }] },
      rich: { ending: '💰 富贵鸳鸯', gold: 60, next: null },
      love: { ending: '🌈 彩虹之誓', hp: 10, gold: 10, next: null }
    }
  },
  star: {
    title: '🌟 星夜列车', start: 'start',
    nodes: {
      start: { choices: [{ id: 'past', label: '⏪ 回到初遇那天' }, { id: 'future', label: '⏩ 去十年后看看' }] },
      past: { choices: [{ id: 'hello', label: '👋 上去打招呼' }, { id: 'watch', label: '👀 默默看着' }] },
      future: { choices: [{ id: 'hotpot', label: '🍲 火锅！' }, { id: 'guess', label: '🤔 瞎猜一个' }] },
      hello: { hp: 10, next: 'trail_hello' },
      watch: { gold: 15, next: 'trail_watch' },
      hotpot: { gold: 20, next: 'trail_hotpot' },
      guess: {
        battle: {
          name: '星尘守卫', icon: '🌟', hp: 35, atk: 7,
          drops: [
            { name: '✨ 星尘剑', atk: 3, rate: 1 },
            { name: '⭐ 星星碎片', atk: 1, rate: 0.6 },
            { name: '🌙 月光石', atk: 0, rate: 0.3 }
          ],
          gold: [20, 50], winNext: 'trail'
        }
      },
      trail: { journey: { total: 14, exit: 'star_end' } },
      trail_hello: { journey: { total: 10, exit: 'hello_end' } },
      trail_watch: { journey: { total: 10, exit: 'watch_end' } },
      trail_hotpot: { journey: { total: 10, exit: 'hotpot_end' } },
      hello_end: { ending: '💫 初心不改', gold: 20, next: null },
      watch_end: { ending: '🎫 免票乘客', gold: 20, next: null },
      hotpot_end: { ending: '🏠 灯火可亲', gold: 20, next: null },
      star_end: { choices: [{ id: 'home', label: '🏠 回家睡觉' }, { id: 'more', label: '🚀 继续冒险' }] },
      home: { ending: '🌙 星夜晚安', hp: 15, next: null },
      more: { ending: '🚀 银河无界', gold: 30, next: null }
    }
  }
}

function advAtkTotal(doc) {
  const base = doc.atk == null ? 10 : doc.atk
  const gear = (doc.items || []).reduce((s, it) => s + (Number(it.atk) || 0), 0)
  return base + gear
}

function advLog(doc, entry) {
  return [...(doc.log || []), { ...entry, at: Date.now() }].slice(-30)
}

const THEME_NAME = { forest: '雾林', sea: '深海', star: '星夜' }

// 把事件节点(nd)结算进 patch;返回 {done, event}
function settleAdvEvent(patch, doc, nd, nodeId, openid) {
  const maxHp = doc.maxHp || 100
  patch.hp = Math.max(0, Math.min(maxHp, patch.hp + (nd.hp || 0)))
  patch.atk = (patch.atk == null ? (doc.atk == null ? 10 : doc.atk) : patch.atk) + (nd.atk || 0)
  patch.gold = Math.max(0, (patch.gold == null ? (doc.gold || 0) : patch.gold) + (nd.gold || 0))
  patch.items = [...(patch.items || doc.items || []), ...((nd.loot || []).map((l) => ({ name: l.name, atk: l.atk || 0, at: Date.now(), by: openid })))]
  if (nd.ending) {
    patch.endings = [...(patch.endings || doc.endings || []), { name: nd.ending, at: Date.now(), by: openid }]
    patch.node = nodeId
    return { done: true, event: { type: 'ending', name: nd.ending } }
  }
  if (nd.next) {
    patch.node = nd.next
    return { done: true, event: { type: 'advance', loot: (nd.loot || []).map((l) => l.name), gold: nd.gold || 0, hp: nd.hp || 0 } }
  }
  patch.node = nodeId
  return { done: true, event: null }
}

function applyAdvChoice(doc, choiceId, openid) {
  const def = ADV_DEFS[doc.storyId]
  if (!def) return { ok: false, message: '剧本不存在' }
  if ((doc.endings || []).length) return { ok: false, message: '本局已完结,开新一局吧' }
  if (doc.battle && doc.battle.name) return { ok: false, message: '先打完这场战斗吧' }
  const node = def.nodes[doc.node]
  if (!node || !node.choices) return { ok: false, message: '这里点不了,下拉刷新同步一下 ♡' }
  const valid = (node.choices || []).some((c) => c.id === choiceId)
  if (!valid) return { ok: false, message: '这条路走过了,下拉刷新同步一下 ♡' }
  const target = def.nodes[choiceId]
  if (!target) return { ok: false, message: '剧情走丢了' }
  // 进入旅途:初始化 N 连难并生成第一难
  if (target.journey) {
    const r = enterJourney(doc, target.journey, openid, choiceId)
    return { ok: true, patch: r.patch, event: r.event }
  }
// 进入旅途:返回 {patch, event};fromChoice 用于日志
function enterJourney(doc, journeyDef, openid, fromChoice) {
  const total = Math.min(20, Math.max(1, journeyDef.total || 10))
  const journey = { total, left: total, exit: journeyDef.exit, theme: doc.storyId || 'forest', usedEvents: [], usedFoes: [] }
  const enc = genTrail(journey, 1)
  const patch = {
    node: 'trail', journey,
    trail: normTrail(1, total, enc),
    hp: (doc.hp == null ? 100 : doc.hp),
    atk: (doc.atk == null ? 10 : doc.atk),
    gold: (doc.gold || 0),
    items: [...(doc.items || [])],
    flags: { ...(doc.flags || {}), [(fromChoice || 'trail')]: true },
    endings: [...(doc.endings || [])],
    battle: {},
    log: advLog(doc, { node: 'trail', choice: fromChoice || 'enter', text: `🗺️ 踏入旅途（共 ${total} 难）`, by: openid })
  }
  // 第一难就是战斗:直接开战
  if (enc.kind === 'battle') {
    patch.battle = normBattle(enc.battle)
  } else if (enc.kind === 'rest') {
    // 安营:直接结算奖励并推进
    const maxHp = doc.maxHp || 100
    patch.hp = Math.max(0, Math.min(maxHp, patch.hp + (enc.hp || 0)))
    patch.gold = Math.max(0, patch.gold + (enc.gold || 0))
    journey.left -= 1
    patch.journey = journey
    const next = genTrail(journey, 2)
    patch.trail = normTrail(2, total, next)
    if (next.kind === 'battle') {
      patch.battle = normBattle(next.battle)
    }
    return { patch, event: { type: 'trail', depth: 1, total, rested: true } }
  }
  return { patch, event: { type: 'trail', depth: 1, total } }
}
  const chosenLabel = ((node.choices || []).find((c) => c.id === choiceId) || {}).label || choiceId
  const patch = {
    node: choiceId,
    hp: (doc.hp == null ? 100 : doc.hp),
    atk: (doc.atk == null ? 10 : doc.atk),
    gold: (doc.gold || 0),
    items: [...(doc.items || [])],
    flags: { ...(doc.flags || {}), [choiceId]: true },
    endings: [...(doc.endings || [])],
    battle: {},
    log: advLog(doc, { node: choiceId, choice: choiceId, text: `👉 ${chosenLabel}`, by: openid })
  }
  // 落到战斗节点:开战(战斗结算走 advBattle)
  if (target.battle) {
    const b = target.battle
    patch.battle = {
      node: choiceId, from: doc.node,
      name: b.name, icon: b.icon, hp: b.hp, max: b.hp, atk: b.atk,
      drops: b.drops, gold: b.gold, winNext: b.winNext,
      defending: false, rounds: []
    }
    return { ok: true, patch, event: { type: 'battle', name: b.name, icon: b.icon } }
  }
  // 落到事件节点:直接结算;若结算后落在旅途入口,顺势初始化旅途(防空转)
  if (!target.choices && !target.battle) {
    const r = settleAdvEvent(patch, doc, target, choiceId, openid)
    const gainParts = []
    if (target.gold) gainParts.push(`金币${target.gold > 0 ? '+' : ''}${target.gold}`)
    if (target.hp) gainParts.push(`生命${target.hp > 0 ? '+' : ''}${target.hp}`)
    if (target.atk) gainParts.push(`攻击+${target.atk}`)
    if ((target.loot || []).length) gainParts.push(`获得 ${target.loot.map((l) => l.name).join('、')}`)
    if (target.ending) gainParts.push(`达成结局「${target.ending}」`)
    if (gainParts.length) patch.log = advLog({ log: patch.log }, { node: choiceId, text: `　↳ ${gainParts.join('，')}`, by: openid })
    const landed = def.nodes[patch.node]
    if (landed && landed.journey) {
      const jr = enterJourney({ ...doc, hp: patch.hp, atk: patch.atk, gold: patch.gold, items: patch.items, flags: patch.flags, endings: patch.endings, log: patch.log }, landed.journey, openid, choiceId)
      return { ok: true, patch: { ...patch, ...jr.patch }, event: jr.event }
    }
    return { ok: true, patch, event: r.event }
  }
  return { ok: true, patch, event: null }
}

function rnd(n) {
  return Math.floor(Math.random() * (n + 1))
}

// 云库 update 遇到 undefined 字段直接报 -502001;所有冒险写库前先洗一遍
function cleanPatch(p) {
  return JSON.parse(JSON.stringify(p))
}

// 构造冒险写库数据:battle/trail/journey 用 _.set 整体替换(否则云库会把对象做增量合并,清不干净),
// 其余字段清洗掉 undefined,统一补 updatedAt
function advWriteData(patch) {
  const data = cleanPatch(patch)
  if (Object.prototype.hasOwnProperty.call(data, 'battle')) data.battle = _.set(data.battle || {})
  if (Object.prototype.hasOwnProperty.call(data, 'trail')) data.trail = _.set(data.trail || {})
  if (Object.prototype.hasOwnProperty.call(data, 'journey')) data.journey = _.set(data.journey || {})
  data.updatedAt = Date.now()
  return data
}

// 云库 update 会把嵌套对象展开成点路径(battle.atk);若旧存档里 battle/trail/journey 是 null,
// 就会报 "Cannot create field 'atk' in element {battle: null}"。此处把 null 容器一次性补成 {}
async function healContainers(doc) {
  const fix = {}
  if (doc.battle === null || doc.battle === undefined) fix.battle = _.set({})
  if (doc.trail === null || doc.trail === undefined) fix.trail = _.set({})
  if (doc.journey === null || doc.journey === undefined) fix.journey = _.set({})
  if (!Object.keys(fix).length) return
  await db.collection('adventures').doc(doc._id).update({ data: fix })
  if (fix.battle) doc.battle = {}
  if (fix.trail) doc.trail = {}
  if (fix.journey) doc.journey = {}
}

// trail/battle 对象统一构造:所有键永远有定义,从源头杜绝 undefined
// (a/b 只在事件难有效, battle/hp/gold 只在战斗/安营难有效,缺省一律 null/0)
function normTrail(depth, total, enc) {
  const kind = enc.kind || 'event'
  return {
    depth, total,
    title: enc.title || '',
    text: enc.text || '',
    kind,
    a: kind === 'event' ? (enc.a || null) : null,
    b: kind === 'event' ? (enc.b || null) : null,
    eventId: enc.eventId || '',
    battle: kind === 'battle' ? (enc.battle || null) : {},
    hp: enc.hp || 0,
    gold: enc.gold || 0
  }
}

function normBattle(b, from) {
  return {
    node: 'trail', from: from || 'trail',
    name: b.name || '怪物', icon: b.icon || '👾',
    hp: b.hp || 30, max: b.hp || 30, atk: b.atk || 5,
    drops: b.drops || [], gold: b.gold || [0, 0],
    winNext: b.winNext || null, trail: true,
    defending: false, rounds: []
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ===== 八十一难式随机旅途:主线中段插入 N 连难,每难含 1 次选择(+可能一场战斗) =====
// 每个主题 30 组专属奇遇,按 storyId 取池;6 种怪随层数成长,保证每次开局路线都不一样
const TRAIL_EVENT_POOLS = {
  forest: [
    { id: 'f_fog', title: '🌫️ 浓雾迷途', text: '雾气浓得伸手不见五指，隐约有两个声音在喊你们的名字——一个苍老，一个稚嫩。跟谁走？',
      a: { label: '👴 跟苍老的声音走', hp: 8, gold: 12, msg: '老人是守林人，送你们驱雾灯油，还塞了盘缠。' },
      b: { label: '🧒 跟稚嫩的声音走', gold: -8, hp: 5, msg: '小孩是雾妖变的！戳破它后捡到它掉落的金叶子，有惊无险。' } },
    { id: 'f_bridge', title: '🌉 断桥', text: '独木桥从中断裂，对岸的宝箱在招手。是冒险跳过去，还是绕远路？',
      a: { label: '🦘 跳过去！', hp: -12, gold: 35, msg: '落地崴了脚，但宝箱是真的！金币滚了一地。' },
      b: { label: '🥾 绕远路', hp: 6, gold: 8, msg: '绕路发现了野果林，吃饱喝足还顺手卖了果子。' } },
    { id: 'f_merchant', title: '🧙 林间货郎', text: '斗篷货郎拦住你们：“生命药水 20 金，锻造服务 15 金，不买也别走，买个平安。”',
      a: { label: '🧪 买药水(20金)', needGold: 20, hp: 30, gold: -20, msg: '药水温热下肚，伤口以肉眼可见的速度愈合。' },
      b: { label: '🔨 锻造武器(15金)', needGold: 15, atk: 2, gold: -15, msg: '武器淬火后寒光逼人，攻击+2！' } },
    { id: 'f_spring', title: '⛲ 月光泉', text: '林间空地有一汪发光的泉水，牌子上写：饮一口，忘忧；泡一泡，回血。',
      a: { label: '💧 喝一口', hp: 15, msg: '泉水甘甜，疲惫一扫而空。' },
      b: { label: '🛁 泡一泡', hp: 25, gold: -5, msg: '泡完神清气爽，只是被路过的小精灵收了 5 金“门票”。' } },
    { id: 'f_riddle', title: '🦉 夜枭谜题', text: '巨枭挡住去路：“答对我的谜题就放行——什么东西越洗越脏？”',
      a: { label: '💧 答案：水', gold: 25, msg: '巨枭满意地让开，还掉了根羽毛，羽毛换了赏钱。' },
      b: { label: '🤔 瞎蒙一个', hp: -8, msg: '答错了！巨枭啄了你们一人一下，气鼓鼓地飞走了。' } },
    { id: 'f_camp', title: '🔥 旅人营地', text: '空地上有堆快熄的篝火，旁边刻着字：后来者，添柴者得食，守夜者得星。',
      a: { label: '🪵 添柴做饭', hp: 12, gold: 6, msg: '火重新旺起来，前人留的腊肉真香，还剩了点干粮换钱。' },
      b: { label: '🌌 守夜观星', atk: 1, hp: 6, msg: '整夜守着火堆，看流星悟出了一招半式，攻击+1。' } },
    { id: 'f_thief', title: '🥷 飞贼光顾', text: '半夜行囊窸窣作响——有个黑影在偷你们的金币！追，还是设套？',
      a: { label: '🏃 追上去！', hp: -10, gold: 20, msg: '追了三条街逮住他，拿回金币还多要了“精神损失费”。' },
      b: { label: '🪤 装睡设套', atk: 1, gold: 10, msg: '飞贼被绊倒，武器掉了一地，挑了件顺手的留下。' } },
    { id: 'f_elder', title: '👵 山神婆婆', text: '雾中走出一位婆婆：“年轻人，替我捶捶背，老身送你们一场造化。”',
      a: { label: '💆 捶背捏肩', hp: 18, gold: 15, msg: '婆婆舒坦了，赏了金豆子，还传了你们一套顺气的呼吸法。' },
      b: { label: '💨 赶路要紧', hp: -5, msg: '婆婆叹了口气，雾气化作小石子绊了你们一跤——赶路也不差这一会儿嘛。' } },
    { id: 'f_pond', title: '🐸 青蛙合唱', text: '黄昏的池塘边，一群青蛙正叠着罗汉合唱。它们邀请你们加入，说唱得好有奖励。',
      a: { label: '🎤 跟着合唱', hp: 8, gold: 18, msg: '你们跑调的歌声逗乐了青蛙，它们扔来一串金铃铛当“版权费”。' },
      b: { label: '🤫 悄悄离开', hp: 4, msg: '你们蹑手蹑脚绕开，青蛙们却没生气，还递来两片荷叶当帽子。' } },
    { id: 'f_library', title: '📚 废墟图书馆', text: '坍塌的图书馆里，一本书自己翻到某一页飘过来：“读我，或烧我，选一个。”',
      a: { label: '📖 认真读它', atk: 1, hp: 10, msg: '这是一本古老的武技秘籍，你们照着比划，竟真悟出了招式，攻击+1。' },
      b: { label: '📕 收进背包', gold: 22, msg: '书合上了，安稳躺进背包，书脊里竟夹着几张旧票子。' } },
    { id: 'f_balloon', title: '🎈 会说话的灯笼', text: '一只红灯笼飘在你们头顶：“许个愿吧，我帮你们送上天。不过天上风大，可能飘歪。”',
      a: { label: '🌟 许个大愿', gold: 30, hp: -6, msg: '愿望送上天，灯笼被风吹回来砸了下脑袋，却衬了一袋金币掉在脚边。' },
      b: { label: '🍀 许个小心愿', hp: 10, gold: 6, msg: '灯笼满意地飘走，落下一颗幸运草，你们捡到后一路顺遂。' } },
    { id: 'f_puppet', title: '🎭 提线木偶', text: '路边一个木偶自己动了起来，扯着线跳舞：“陪我玩一局，赢了放你们走。”',
      a: { label: '🎲 陪它玩', gold: 22, hp: -4, msg: '木偶棋艺不精，输了比赛恼羞成怒，还是乖乖交出了彩头。' },
      b: { label: '🎼 给它伴奏', hp: 12, atk: 1, msg: '木偶跟着节奏跳得更欢，尽兴后教了你们一段战斗舞步，攻击+1。' } },
    { id: 'f_forge', title: '⚒️ 荒废铁匠铺', text: '铁砧还在发烫，炉火未熄，墙上刻着：兵器有价，情义无价。',
      a: { label: '🔨 打一把武器', needGold: 20, gold: -20, atk: 3, msg: '炉火映亮你们的脸，一把带着两人温度的武器出炉，攻击+3！' },
      b: { label: '🔥 取炉火取暖', hp: 20, msg: '你们把炉火拨旺，烤了烤手，还热了一顿冷掉的干粮，浑身暖洋洋。' } },
    { id: 'f_tea', title: '🍵 云中茶摊', text: '半山腰飘着一座茶摊，老板递上两杯热茶：“赶路人，喝口茶再走，前程似锦。”',
      a: { label: '🍵 趁热喝', hp: 14, gold: 8, msg: '热茶下肚，寒气尽消。老板看你们般配，还塞了包茶叶让你们路上卖钱。' },
      b: { label: '🫖 买壶带走', needGold: 10, gold: -10, hp: 22, msg: '买下的茶壶保温极了，此后每一难都能喝口热的，回血更多。' } },
    { id: 'f_mirror', title: '🪞 照心魔镜', text: '一面镜子立在路中央，镜中映出的却是十年后的你们。它低声问：现在后悔吗？',
      a: { label: '💗 不后悔', hp: 15, msg: '镜子泛起涟漪，映出的两人相视一笑，一股暖流涌遍全身。' },
      b: { label: '😶 沉默以对', gold: 18, msg: '镜子沉默片刻，碎成星点，掉出一把没见过的金币——像是替谁道了歉。' } },
    { id: 'f_mushroom', title: '🍄 蘑菇圈', text: '一圈彩色蘑菇围成圆环，中间蹲着一只发光的兔子：“踏进来，能听见对方最深的秘密。”',
      a: { label: '🐇 踏进圈里', hp: 8, atk: 1, msg: '你们闭眼站定，心口一暖——听见的不是秘密，是对方反复念叨的名字。' },
      b: { label: '🌿 采蘑菇', hp: 14, gold: 6, msg: '你们采了些能吃的蘑菇，兔子摊手：“好吧，也算缘分。”还指点了一处避风地。' } },
    { id: 'f_vine', title: '🌿 缠人藤蔓', text: '藤蔓突然卷住你们的脚踝，越挣扎缠得越紧，远处传来细微的求救声。',
      a: { label: '✂️ 用力挣脱', hp: -9, gold: 18, msg: '你们削断藤蔓冲出去，发现缠绕的树洞里有被卷住的钱袋。' },
      b: { label: '🫱 顺着求救走', hp: 10, msg: '你们顺着声音轻柔剥离藤蔓，救下一只小鹿，它驮着你们抄近道出了林子。' } },
    { id: 'f_sprite', title: '✨ 林间小精灵', text: '一只小精灵摔断了翅膀，可怜巴巴地看着你们：“能陪我等到天亮吗？”',
      a: { label: '🤲 陪它守夜', hp: 20, gold: 10, msg: '天亮了，小精灵翅膀痊愈，撒下一把会发光的种子，你们揣进兜里换了好价钱。' },
      b: { label: '⏰ 赶路要紧', hp: -6, msg: '你们留下一块干粮就走，回头看它孤零零的，心里有点不是滋味。' } },
    { id: 'f_berry', title: '🫐 可疑浆果', text: '灌木上结满了蓝汪汪的浆果，旁边有半块被啃过的牌子：“有毒/没毒”。',
      a: { label: '😋 大胆尝一颗', hp: 14, gold: 8, msg: '甜得惊艳！你们摘了满满一兜，路上边走边吃，连路都走得欢快。' },
      b: { label: '🧪 谨慎绕开', hp: 6, msg: '你们没敢吃，继续赶路。回头看见一只山雀吃了浆果后呼呼大睡——幸好没试。' } },
    { id: 'f_deer', title: '🦌 灵鹿引路', text: '一头白鹿站在岔路口，回头望你们一眼，又朝一条小径走去。',
      a: { label: '🦌 跟着它走', hp: 12, gold: 12, msg: '白鹿带你们穿过密林，尽头是一眼温泉和一片熟透的野果，像专门的礼物。' },
      b: { label: '🧭 走自己的路', atk: 1, msg: '你们按地图走，白鹿愣了一下跑开了。你们独自开路，倒练出一身攀爬本领。' } },
    { id: 'f_oldtree', title: '🌳 千年古树', text: '古树的树干中空，刻着一行字：把烦恼写下来塞进去，树会替你扛。',
      a: { label: '📝 写下烦恼', hp: 16, msg: '你们把心事写在叶子上塞进树洞，树身轻轻一颤，掉下两枚能安神的果子。' },
      b: { label: '🌰 掏树洞', gold: 22, hp: -4, msg: '你们好奇掏了掏，摸出一把前人藏的铜钱，也惊起一群树蜂，头皮被叮了两下。' } },
    { id: 'f_hunter', title: '🏹 迷路猎人', text: '一个猎人蹲在树后发抖：“我把猎物的踪迹跟丢了，还惹了它，能陪我出去吗？”',
      a: { label: '🤝 带他出去', hp: 8, gold: 16, msg: '你们把猎人平安送出林子，他硬塞给你们一袋干粮和几张好皮革。' },
      b: { label: '🏃 先避为妙', hp: -8, msg: '你们刚想走，那只野兽就追了出来，你们和猎人一起狼狈逃命，灰头土脸。' } },
    { id: 'f_wolf', title: '🐺 独眼山狼', text: '一头独眼老狼挡在路中央，却瘦得不行，眼睛盯着你们手里的干粮。',
      a: { label: '🍖 分它干粮', hp: 6, gold: 14, msg: '老狼吃完，绕到你们身前带路，把你们领到一处埋着金币的旧营地。' },
      b: { label: '🗡️ 举刀吓退', hp: -6, atk: 1, msg: '老狼退了几步，眼神竟像失望。你们心虚地赶路，脚步比平时沉。' } },
    { id: 'f_beehive', title: '🐝 野蜂巢', text: '树梢挂着个沉甸甸的蜂巢，蜂蜜顺着树干往下滴，诱人得很。',
      a: { label: '🍯 冒险取蜜', hp: -10, gold: 20, msg: '你们顶着蜂群摘了蜜，被蜇了几口，但那罐野蜜卖了高价。' },
      b: { label: '💤 熏烟取蜜', hp: 8, gold: 6, msg: '你们生烟把蜂群哄睡，从容取了半块蜜，蜜蜂醒来也没记仇。' } },
    { id: 'f_crossroad', title: '🧭 三岔路口', text: '三条路各立一块牌：左“近而险”，中“直而长”，右“美而迷”。',
      a: { label: '⬅️ 走左路', hp: -8, gold: 24, msg: '左路果然险，你们手脚并用滚下陡坡，却正好落在一个废弃钱箱上。' },
      b: { label: '➡️ 走右路', hp: 10, msg: '右路风景美到不真实，你们边走边玩，忘了疲惫，绕了点远却精神抖擞。' } },
    { id: 'f_mistpool', title: '🌫️ 迷雾水潭', text: '水潭倒映着不属于这里的星空，伸手一碰，水面泛起涟漪，涟漪里闪着字。',
      a: { label: '🖐️ 搅动水面', hp: 8, gold: 16, msg: '你们拨水，字汇成了句悄悄话：“小心前路。”潭底竟浮上来几枚旧币。' },
      b: { label: '👀 只看不动', hp: 12, msg: '你们静静看着倒影，心也跟着静了，休息片刻后浑身是劲。' } },
    { id: 'f_owlpost', title: '📮 猫头鹰邮局', text: '树洞里藏着个邮局，猫头鹰邮差问：“有信要寄吗？能寄给任意时候的人。”',
      a: { label: '✉️ 寄一封信', hp: 10, atk: 1, msg: '你们给未来的自己写了信。猫头鹰收下，回赠一根羽毛，握在手里格外安心。' },
      b: { label: '📬 取一封信', hp: 14, gold: 10, msg: '你们取出一封陌生人寄来的信，里面夹着张老地图和几枚铜钱。' } },
    { id: 'f_dew', title: '💧 拂晓露珠', text: '草叶上挂着比拳头还大的露珠，映着天光，喝了据说能让人变精神。',
      a: { label: '🥤 接来喝', hp: 18, msg: '露珠入口清凉甘甜，困意一扫而空，你们相视一笑，脚步轻快许多。' },
      b: { label: '📷 拍它', hp: 8, gold: 10, msg: '你们小心翼翼拍了半天，露珠在镜头里像颗太阳，围观的路人纷纷掏钱买照片。' } },
    { id: 'f_ram', title: '🐏 顶角公羊', text: '一只公羊横在窄路上，低头瞪你们，鼻子里喷着白气，像是在下战书。',
      a: { label: '🐏 和它顶牛', hp: -8, atk: 1, msg: '你们合伙把羊顶开，胳膊酸得发抖，却觉得肩更硬了，攻击+1。' },
      b: { label: '🍎 用苹果收买', hp: 10, gold: 8, msg: '公羊吃了苹果竟摇尾巴，带着你们抄了条只有羊知道的小路。' } },
    { id: 'f_stone', title: '🗿 会说话的石头', text: '路边一块大石头突然开口：“我被施了咒，能陪我聊会儿天吗？三百年没人理我了。”',
      a: { label: '💬 陪它聊天', hp: 12, gold: 14, msg: '你们陪它唠了半天，石头开心极了，从身下挪出个装满古币的陶罐。' },
      b: { label: '🎵 唱歌给它听', hp: 16, atk: 1, msg: '石头听得直发颤，叹了口气：“咒解了一点。”它送你们一块温润的护身石。' } }
  ],
  sea: [
    { id: 's_tide', title: '🌊 退潮奇遇', text: '退潮后礁石间困着好多小生物：海星、螃蟹、透明的虾。帮它们回海，还是趁早赶路？',
      a: { label: '🦀 一一放归', hp: 10, gold: 12, msg: '你们把小生命逐一带回浪里，一只老龟浮上来点头，托着一袋贝壳钱给你们。' },
      b: { label: '👣 继续赶路', hp: 4, gold: 6, msg: '你们赶路要紧，顺手捡了几个漂亮海螺，卖了点零钱。' } },
    { id: 's_shell', title: '🐚 会唱歌的贝壳', text: '一只贝壳靠自己唱起了歌，调子忧伤而悠长，引得好多鱼围成一圈听。',
      a: { label: '🎶 静静听完', hp: 15, msg: '歌毕，你们眼眶微红，贝壳满意地合上，留下一股让人安心的暖意。' },
      b: { label: '💰 捡走换钱', gold: 20, hp: -3, msg: '你们把贝壳收进兜，歌声戛然而止，鱼群散尽——心里有点空落落的。' } },
    { id: 's_jelly', title: '🪼 水母灯海', text: '夜色里一片水母浮上海面，蓝蓝的光把海面照成星河，美得让人忘了赶路。',
      a: { label: '🛟 驻足欣赏', hp: 18, msg: '你们靠在小艇边看了一整片灯海，连日的疲累都被这光熨平了。' },
      b: { label: '🕸️ 打捞几只', gold: 16, hp: -5, msg: '你们捞了几只，指尖被蜇得发麻，但那夜光粉在集市上竟是抢手货。' } },
    { id: 's_wreck', title: '🚢 沉船宝藏', text: '一艘半沉的古船卡在礁石上，船舱里隐约有金光，可船身还在缓缓下沉。',
      a: { label: '💎 冲进船舱', hp: -12, gold: 38, msg: '你们抢在沉没前抱出一箱金币，代价是被断木划了道口子。' },
      b: { label: '⚓ 只取船首像', hp: 6, gold: 10, msg: '你们卸下船首的铜像留作纪念，雕像背后竟刻着一句祝福，还有几枚压舱铜钱。' } },
    { id: 's_dolphin', title: '🐬 海豚引路', text: '一群海豚在船头跳跃，像是要带你们去什么地方，嘴边“咿咿”直叫。',
      a: { label: '🐬 跟着它们', hp: 10, gold: 14, msg: '海豚把你们引到一片鱼群密集的浅湾，你们顺手捞了不少名贵海鱼。' },
      b: { label: '🧭 按航线走', hp: 6, atk: 1, msg: '你们坚持原航线，海豚追了一阵作罢。独自破浪让船技长进不少。' } },
    { id: 's_storm', title: '⛈️ 海上风暴', text: '乌云压顶，狂风掀起巨浪，小船在浪尖上打转，必须马上做决定。',
      a: { label: '⚓ 抛锚硬扛', hp: -10, gold: 8, msg: '你们死死抱住桅杆扛过风浪，浪退后甲板上冲上来不少值钱的海货。' },
      b: { label: '🏝️ 抢滩上岸', hp: 8, msg: '你们趁隙冲向最近的小岛，虽然狼狈，却躲开了最凶的一波浪头。' } },
    { id: 's_island', title: '🏝️ 荒岛拾荒', text: '临时靠岸的荒岛上满是碎石和旧木箱，时间不多，只够翻一处。',
      a: { label: '📦 撬开木箱', hp: -4, gold: 24, msg: '木箱里是前任漂流者留下的金币和一张潦草的地图。' },
      b: { label: '🌴 摘椰子', hp: 16, gold: 4, msg: '你们摘了一兜椰子，喝了个饱，剩下的卖了钱，浑身又充满了水。' } },
    { id: 's_merchant', title: '🧜 海市商人', text: '海雾里浮出一个摊子，章鱼老板挥着八只手：“补血 20 金，加固船板 15 金，童叟无欺。”',
      a: { label: '💊 买补血(20金)', needGold: 20, hp: 30, gold: -20, msg: '一碗腥甜的汤药下肚，你们的面色肉眼可见地红润起来。' },
      b: { label: '🔧 加固船(15金)', needGold: 15, atk: 2, gold: -15, msg: '章鱼给船头包了层铁皮，往后撞上什么都有底气，攻击+2！' } },
    { id: 's_pearl', title: '🦪 珍珠蚌', text: '一只巨蚌张开半边，里面亮得刺眼，旁边礁石上刻着：凡取珠者，须留一物。',
      a: { label: '💍 取珠留物', hp: 6, gold: 26, msg: '你们留下一枚旧发卡，取出珍珠，蚌合拢时竟像在轻轻道谢。' },
      b: { label: '🙅 不动它', hp: 12, msg: '你们尊重规矩没取珠，蚌却缓缓吐出一颗小珍珠滚到你们脚边。' } },
    { id: 's_pirateflag', title: '🏴‍☠️ 海盗旗', text: '礁石上插着一面破海盗旗，旗杆下堆着没搬走的补给箱，四周静得可疑。',
      a: { label: '📦 搬走补给', gold: 22, hp: -6, msg: '你们刚搬起箱子，暗桩弹出划了你们一下，好在补给里有药膏和金币。' },
      b: { label: '🔍 先探路', hp: 8, gold: 10, msg: '你们绕圈查探，摸清了暗桩位置，从容取走补给还拆了不少机关零件。' } },
    { id: 's_whale', title: '🐋 鲸落', text: '一头巨鲸静静沉向海底，周围鱼群肃穆，像在参加一场盛大的告别。',
      a: { label: '🙏 行礼送别', hp: 20, msg: '你们低头默哀，鲸的尾鳍轻摆，一股温柔的洋流托着你们前行了很久。' },
      b: { label: '🦴 打捞鲸骨', gold: 26, hp: -4, msg: '你们捞了些漂亮鲸骨，集市上价值不菲，只是心里总有些不忍。' } },
    { id: 's_mermaid', title: '🧜‍♀️ 人鱼歌谣', text: '人鱼在月光下唱歌，歌声让人昏昏欲睡，却又莫名安心。',
      a: { label: '😴 闭眼聆听', hp: 24, msg: '你们枕着歌声睡着了，醒来时神清气爽，人鱼早已消失，只留海面涟漪。' },
      b: { label: '🎼 记下曲调', atk: 1, hp: 6, msg: '你们强撑着记下旋律，日后哼起来，动作竟也跟着有了节拍感，攻击+1。' } },
    { id: 's_coral', title: '🪸 珊瑚迷宫', text: '一片珊瑚长得像迷宫，中间隐约有条能走的水道，旁边还有条绕远的安全线。',
      a: { label: '🌀 穿迷宫', hp: -8, gold: 22, msg: '你们在珊瑚丛里转得头晕，终于钻出去，出口礁缝里卡着一袋金币。' },
      b: { label: '🧭 绕安全线', hp: 10, msg: '你们老老实实绕行，沿途捡了不少五彩贝，也躲开了一路暗流。' } },
    { id: 's_kraken', title: '🐙 触手戏弄', text: '一条大触手探出水面，缠住了你们的船桨，却不使劲，像在逗你们玩。',
      a: { label: '🤝 和它玩', hp: 8, gold: 12, msg: '你们被甩得七荤八素，最后触手把它珍藏的亮晶晶石头塞给船就走了。' },
      b: { label: '🔪 割断触手', atk: 1, hp: -8, msg: '你们费劲割断一截触手，触手缩回深海，留下根滑溜溜的腕带，攻击+1。' } },
    { id: 's_bottle', title: '🍾 漂流瓶', text: '一个封着蜡的瓶子随浪漂来，瓶里泡着一张泛黄的信纸。',
      a: { label: '📖 读信', hp: 12, gold: 12, msg: '信是一个水手写给远方爱人的，读着读着，你们更握紧了彼此的手。' },
      b: { label: '🪙 换瓶中之物', gold: 20, msg: '瓶底竟压着几枚老银币，你们小心取出，把信重新封好放回海里。' } },
    { id: 's_lighthouse', title: '🗼 熄灯灯塔', text: '灯塔守夜人睡着了，灯快灭了，远处有船在雾里打转。',
      a: { label: '🔥 帮它点灯', hp: -5, gold: 26, msg: '你们爬上塔顶重新点灯，雾里的船靠岸，船长上岸硬塞给你们一袋谢礼。' },
      b: { label: '😴 让它睡吧', hp: 10, msg: '你们守到天亮，雾散船安，守夜人醒来给你们讲了整夜的航海故事。' } },
    { id: 's_anchor', title: '⚓ 旧船锚', text: '一枚锈迹斑斑的船锚半埋沙里，锚上刻着一个名字和一串看不懂的符号。',
      a: { label: '🔨 挖出来卖', gold: 24, hp: -5, msg: '你们挖了半天，锚重得离谱，好歹拖去铁匠那儿换了一袋金属钱。' },
      b: { label: '📜 临摹符号', hp: 8, atk: 1, msg: '你们把符号描进本子里，日后才知这是古航术，让你们对风向格外敏感。' } },
    { id: 's_gull', title: '🕊️ 海鸥抢食', text: '一群海鸥盯上了你们晒的鱼干，领头的那只胆大包天，直接落在船头。',
      a: { label: '🐟 分它一条', hp: 6, gold: 10, msg: '海鸥吃饱后，竟叼来一小串渔民遗落的铜钱当“回礼”。' },
      b: { label: '🧹 赶走它们', hp: -5, msg: '你们挥桨驱赶，海鸥扑腾起来弄翻了半筐鱼干，心疼坏了。' } },
    { id: 's_sunset', title: '🌅 海上日落', text: '太阳慢慢沉进海里，整片海面烧成金红，这一刻安静得不真实。',
      a: { label: '💞 并肩看日落', hp: 20, msg: '你们挨着坐，谁也没说话，肩头的温度比落日还暖，疲惫一扫而空。' },
      b: { label: '📸 记下此刻', hp: 8, gold: 10, msg: '你们把美景刻进记忆，也在礁石缝里捡到几枚被夕阳照得发亮的贝壳。' } },
    { id: 's_seaweed', title: '🌿 发光海藻', text: '一片海藻在黑水里发着幽幽绿光，跟着水流轻轻摆动，像在招手。',
      a: { label: '🫧 捞一把', hp: 8, gold: 14, msg: '海藻入手冰凉，捏碎了有淡淡甜香，渔民说这是稀罕的香料，值不少钱。' },
      b: { label: '🏊 在此歇息', hp: 16, msg: '你们在发光的海藻丛里泡了会儿，水不冷不热，伤口也愈合得快了。' } },
    { id: 's_ruins', title: '🏛️ 海底遗迹', text: '透过清水的浅海，一座石砌古城静静沉在底下，城门半开，透出微光。',
      a: { label: '🤿 下潜探城', hp: -8, gold: 30, msg: '你们憋气下潜，在城门石阶下摸到一只雕刻精美的金盒，沉甸甸的。' },
      b: { label: '🛶 水面观察', hp: 10, atk: 1, msg: '你们在船上对照古城布局，悟出些门道，日后赶路辨方向都快人一步。' } },
    { id: 's_fisher', title: '🎣 老渔夫', text: '一个老渔夫坐在礁石上钓了半天，鱼篓空空，嘴上却一直笑。',
      a: { label: '🐟 帮他钓', hp: 8, gold: 12, msg: '你们运气好，帮他钓上好几尾，他分你们一半，还教了个辨天气的诀窍。' },
      b: { label: '☕ 陪他聊', hp: 14, msg: '你们听他讲了半辈子的海，心里踏实，临走他硬塞了包梅子干。' } },
    { id: 's_ghost', title: '👻 幽灵船', text: '一艘无人的黑船缓缓漂过，甲板上灯火通明，隐约有人影举杯，笑声飘过来。',
      a: { label: '🍻 上船看看', hp: -6, gold: 26, msg: '你们鼓勇登船，鬼影举杯致意，桌上凭空留下几枚古币，再抬头船已远去。' },
      b: { label: '🙇 远远作揖', hp: 10, msg: '你们站在自己船上朝它深深一揖，幽灵船灯火微晃，算是回了礼。' } },
    { id: 's_rainbow', title: '🌈 雨后彩虹', text: '一场急雨过后，海面架起一道彩虹，彩虹尽头的水面泛着异样的光。',
      a: { label: '🏃 奔向虹脚', hp: -6, gold: 24, msg: '你们划到彩虹尽头，那处水面浮起一串亮片，捞起来全是值钱的彩贝。' },
      b: { label: '🌂 原地赏虹', hp: 16, msg: '你们撑伞看了会儿彩虹，心里说不出的舒畅，拔锚时船都轻快了几分。' } },
    { id: 's_octopus', title: '🦑 章鱼墨汁', text: '一只小章鱼受了惊，喷出好大一团墨汁，把你们的船和脸都染黑了。',
      a: { label: '😂 笑作一团', hp: 10, gold: 8, msg: '你们互相看着对方的黑脸笑疯了，墨汁竟意外地能当颜料卖钱。' },
      b: { label: '🫧 堵它喷口', hp: 6, atk: 1, msg: '你们手忙脚乱堵住喷口，小章鱼委屈地送了你们一块会吸光的黑石当武器。' } },
    { id: 's_current', title: '♨️ 暖流', text: '一股温热的洋流推着你们的船走，速度比划桨快得多，方向却由不得自己。',
      a: { label: '😌 顺流而下', hp: 14, gold: 8, msg: '你们索性躺平休息，暖流把船稳稳送到渔获丰富的海湾。' },
      b: { label: '💪 硬要改道', hp: -6, gold: 16, msg: '你们咬牙偏航，累得气喘，却在逆流处捞到一箱被冲散的货物。' } },
    { id: 's_map', title: '🗺️ 半张藏宝图', text: '浪里漂着半张烧焦的图，剩下的半边早不知去向，图上标着个红叉。',
      a: { label: '🔴 去找红叉', hp: -8, gold: 28, msg: '你们按残缺的标记摸索过去，运气不错，红叉处真埋着一小箱金币。' },
      b: { label: '🖼️ 收起来', hp: 6, gold: 12, msg: '你们把残图收好当信物，旅途中有人出了个好价钱买下它。' } },
    { id: 's_reef', title: '🪨 暗礁', text: '前方水面下有片暗礁，浪头在这里翻得格外急，绕行要多花大半天。',
      a: { label: '⛵ 小心穿过', hp: -10, gold: 20, msg: '你们屏息掌舵，船底蹭出几道痕，却抄了近道，礁缝里还卡着沉船遗物。' },
      b: { label: '🔄 老实绕行', hp: 8, msg: '你们稳妥绕行，路上风平浪静，也捡了几只被浪冲上礁石的海螺。' } },
    { id: 's_porpoise', title: '🐬 江豚嬉戏', text: '几只圆滚滚的江豚围着船打转，用背蹭船底，像一群撒娇的孩子。',
      a: { label: '🫳 伸手摸摸', hp: 14, msg: '你们探手摸了摸光滑的背，江豚欢喜地驮着你们的一段航程。' },
      b: { label: '🥕 喂它们鱼', hp: 8, gold: 10, msg: '你们把小鱼分给它们，江豚玩闹间竟叼来些亮晶晶的贝壳。' } },
    { id: 's_whirl', title: '🌀 海眼漩涡', text: '海面突然塌出一个巨大的漩涡，把附近的浮木和碎货都吸了进去。',
      a: { label: '🎣 捞漩涡边的货', gold: 26, hp: -8, msg: '你们冒险贴着漩涡边缘打捞，捞上不少漂来的货物，也险些被卷进去。' },
      b: { label: '⛵ 远远避开', hp: 10, msg: '你们果断避开，绕出老远才松口气，庆幸没有逞强。' } }
  ],
  star: [
    { id: 't_comet', title: '☄️ 彗星许愿', text: '一尾彗星拖着长长的光尾划过，老人说：这时候许的愿，最容易实现。',
      a: { label: '🌠 认真许愿', hp: 12, msg: '你们闭眼许下同一个愿——别松手。睁眼时，心里暖得像揣了颗小太阳。' },
      b: { label: '🔭 记下轨迹', atk: 1, gold: 8, msg: '你们描下彗星轨迹，发现它标着一个坐标，挖开那儿竟有前人埋的星石。' } },
    { id: 't_meteor', title: '✨ 流星雨', text: '天空忽然下起了流星雨，一颗颗银光落向远方，像是银河在洒礼物。',
      a: { label: '🌌 躺下看雨', hp: 18, msg: '你们躺平在草地上接流星，许了好多愿，聊了好多不敢开口的话。' },
      b: { label: '🏃 去捡落的', hp: -6, gold: 20, msg: '你们追着落点跑，捡到几块还烫手的陨石，敲碎了里头的矿石竟很值钱。' } },
    { id: 't_rabbit', title: '🌙 月兔捣药', text: '月兔在银盘似的月亮上捣药，冲你们喊：“帮我看会儿药杵，我下去遛遛！”',
      a: { label: '🥄 帮忙看药', hp: 20, gold: 10, msg: '你们认真守了会儿，月兔回来塞给你们一包“思乡散”，吃了浑身轻快。' },
      b: { label: '🙅 婉拒', hp: 6, msg: '你们摇头谢绝，月兔撇撇嘴，还是撒了点月华下来，落进斗篷里暖烘烘的。' } },
    { id: 't_constellation', title: '🔭 星座连线', text: '天上散落的星星突然连成了线，拼出两个奇怪的字，像在给谁留话。',
      a: { label: '🔗 顺势连下去', atk: 1, hp: 8, msg: '你们接着星线往下连，拼出“跟紧”两个字，心里莫名多了几分底气。' },
      b: { label: '📓 抄下来', gold: 16, hp: 4, msg: '你们把星图抄进本子，旅客说这是星象藏宝图，出价买走了。' } },
    { id: 't_cloud', title: '☁️ 云朵棉花糖', text: '一朵低垂的云像是棉花糖，凑近了还能闻到甜味，舌头一舔真的是甜的。',
      a: { label: '😋 啃一大口', hp: 16, gold: 6, msg: '你们啃了半朵云，甜到心里，剩下的卖了钱，云朵“哎哟”一声飘走了。' },
      b: { label: '☁️ 让它飘走', hp: 10, msg: '你们没舍得吃，目送它飘开。云朵转过头，洒下几滴甜甜的雨当谢礼。' } },
    { id: 't_merchant', title: '🛸 星际商人', text: '一个顶着玻璃罩的商人漂浮而来：“回血 20 金，升级武器 15 金，星际物价，概不还价。”',
      a: { label: '💉 买回血(20金)', needGold: 20, hp: 30, gold: -20, msg: '一支荧光的银河注射液推进血管，遍体舒坦，像被星光灌满了。' },
      b: { label: '⚙️ 升级武器(15金)', needGold: 15, atk: 2, gold: -15, msg: '商人在武器上嵌了枚能量宝石，出鞘时嗡嗡作响，攻击+2！' } },
    { id: 't_gate', title: '🚪 时空之门', text: '一道半透明的门立在虚空中，门后隐约是你们生活的城市，还有走丢的旧时光。',
      a: { label: '👀 推门看看', hp: -6, gold: 18, msg: '门后闪过初见的画面，你们看呆了，门缝里飘出的旧钱币被你们顺手接住。' },
      b: { label: '🚶 绕门而行', hp: 14, msg: '你们没推门，只在门前牵紧了手，门便自行化作一束光融进了你们衣袖。' } },
    { id: 't_robot', title: '🤖 废弃机器人', text: '一个锈迹斑斑的机器人蹲在路边擦眼泪，胸腔里的灯一闪一闪。',
      a: { label: '🔧 帮它修好', hp: 6, gold: 14, msg: '你们拧紧了它松掉的螺丝，它欢喜地转圈跳舞，把攒的能量币送给了你们。' },
      b: { label: '🔋 拆它的电池', gold: 20, hp: -6, msg: '你们取走它的电池，灯灭了，它最后看了你们一眼——心里说不出的别扭。' } },
    { id: 't_ufo', title: '🛸 迷你飞碟', text: '一只巴掌大的飞碟嗡嗡悬停，伸出小手比划着，像是在问路。',
      a: { label: '🧭 帮它指路', hp: 8, gold: 16, msg: '你们对着星图帮它定位，飞碟感激地绕着你们转了三圈，抛下一小罐星砂。' },
      b: { label: '📸 拍下来', hp: 6, atk: 1, msg: '你们举起镜头，飞碟受了惊快速升空，留下一道弧光，恰好教会你们一段闪身走位。' } },
    { id: 't_spaceport', title: '🛰️ 太空港', text: '一座漂浮的太空港灯火通明，来往飞船排队停靠，广播念着一段你们没听过的目的地。',
      a: { label: '🚀 去登船口', hp: -5, gold: 22, msg: '你们挤到登船口看热闹，捡到一张被遗落的高价船票，转手换了金币。' },
      b: { label: '🛋️ 在候船厅歇', hp: 18, msg: '你们在候船厅的软椅上睡了一觉，广播的白噪音意外地让人安心。' } },
    { id: 't_satellite', title: '📡 漂流卫星', text: '一颗老式卫星缓缓漂过，天线还在有一下没一下地闪着，像在发微弱信号。',
      a: { label: '🔊 回应它', hp: 8, gold: 12, msg: '你们对着它挥手，卫星竟回了一段温和的摩斯电码：“谢谢有人记得我。”' },
      b: { label: '🛠️ 拆点零件', gold: 20, hp: -4, msg: '你们拆了些还能用的零件去卖，卫星渐渐安静，回头想想有点不是滋味。' } },
    { id: 't_blackhole', title: '🕳️ 迷你黑洞', text: '路边竟有个拳头大的黑洞，周围的草叶都被拉得笔直，连光都绕了道。',
      a: { label: '🎯 扔石头试探', hp: -8, gold: 18, msg: '你们扔的石子被吸进去，反震出一小堆凝成晶的矿石——差点连手也搭进去。' },
      b: { label: '🚶 远远绕开', hp: 12, msg: '你们明智地绕行，走出老远才敢回头，那小黑洞还在安安静静地噬着星光。' } },
    { id: 't_stardust', title: '💌 星尘信', text: '一封信封着星尘从天而降，落进你们手里，收信人一栏写着“将来的我们”。',
      a: { label: '📖 拆开读', hp: 16, msg: '信里是你们未来的笔迹，写着：“别怕，你们会一直在一起。”看完眼眶发热。' },
      b: { label: '📮 原封收起', hp: 8, gold: 12, msg: '你们把信仔细收好，信封一角竟漏出几粒星砂，落在掌心化作碎金。' } },
    { id: 't_post', title: '🏤 星际邮局', text: '一座流光邮局飘在轨道上，窗口的机器人问：“要寄往哪个星系？按重量收费。”',
      a: { label: '✉️ 寄给彼此', hp: 14, gold: 6, msg: '你们互相寄了封信，没走远就被“退”了回来——原来对方早就等在同一个地址。' },
      b: { label: '📦 领个无人包裹', gold: 20, hp: 4, msg: '你们认领了一个无人认领的包裹，里头是件旧披风，卖了还挺值钱。' } },
    { id: 't_crater', title: '🪨 陨石坑', text: '一个新鲜陨石坑还冒着烟，坑底嵌着半截发光的石头，热得烫手。',
      a: { label: '🔥 冒险取石', hp: -8, gold: 26, msg: '你们用外套包住滚烫的陨石抠出来，烫红了手，却换回一袋沉甸甸的金币。' },
      b: { label: '💧 等它冷却', hp: 12, msg: '你们等石头凉透再取，从容又安稳，还把坑边的余热烤了几个红薯。' } },
    { id: 't_aurora', title: '🌌 极光', text: '天幕突然铺开一整片极光，绿色紫色的光带缓缓流淌，把你们的脸也照亮了。',
      a: { label: '🤝 牵手看光', hp: 20, msg: '你们在极光下并肩站着，光影流转间，仿佛整个世界只剩你们两个。' },
      b: { label: '🎨 描下颜色', atk: 1, hp: 6, msg: '你们临摹极光的颜色，竟悟出光影里的规律，脚步也跟着灵巧起来。' } },
    { id: 't_passenger', title: '🧳 同车旅人', text: '车厢里坐着个沉默的旅人，怀里抱着一台老相机，一直望着窗外。',
      a: { label: '💬 主动搭话', hp: 8, gold: 14, msg: '他给你们拍了张合影，临走塞来一卷胶卷：“冲出来，是给有缘人的。”' },
      b: { label: '🤐 各看各的', hp: 12, msg: '你们没打扰他，却学着他的样子看风景，意外发现沿途藏着好多从没注意过的美。' } },
    { id: 't_dream', title: '💤 梦境站台', text: '列车停在一个叫“梦境”的站台，广播说：下车的人，会短暂回到最幸福的时刻。',
      a: { label: '🚪 下车走走', hp: -6, gold: 16, msg: '你们回到了初遇那天，还顺手从记忆的街角“捡”到几枚当时的硬币。' },
      b: { label: '🛏️ 留在车上', hp: 16, msg: '你们没下车，靠在一起小睡。醒来时嘴角带笑，仿佛真去幸福里逛了一圈。' } },
    { id: 't_clocktower', title: '🕰️ 时间钟楼', text: '一座钟楼的指针半悬着，几个数字掉在地上打滚，看楼的老头摊手：“手滑，见笑了。”',
      a: { label: '🔧 帮着装回去', hp: 8, gold: 16, msg: '你们把数字一一嵌回钟面，老头一高兴，偷偷把停摆的钟拨快了一刻钟。' },
      b: { label: '🕳️ 捡数字卖', gold: 22, hp: -4, msg: '你们揣走两个数字，老头追了三条街，好不容易才讨回去，罚你们点小钱。' } },
    { id: 't_memory', title: '🎞️ 记忆胶片', text: '一卷胶片悬在半空缓缓展开，每一格都是你们相识以来的画面。',
      a: { label: '👀 从头看完', hp: 20, msg: '你们把胶片从头看到尾，看到争吵那格时都笑了，看见牵手那格时都沉默了。' },
      b: { label: '✂️ 剪下一格', hp: 4, gold: 18, msg: '你们剪下最美的一格收好，剩下的胶片被人高价收走当了“怀旧藏品”。' } },
    { id: 't_wishstar', title: '⭐ 许愿星', text: '一个小小的星星精灵落在你们肩上：“我今天值班，可以实现一个不太大的愿望。”',
      a: { label: '🙏 愿彼此平安', hp: 18, msg: '你们没求富贵，只求彼此平安。星星精灵愣了一下，笑着洒下满身柔光。' },
      b: { label: '💰 愿来点钱', gold: 26, hp: -4, msg: '星星精灵哭笑不得，变出一小袋金币：“就这？行吧，钱货两清。”' } },
    { id: 't_galaxy', title: '🌠 银河渡口', text: '一艘摆渡船横在银河边，船夫伸手：“过河吗？船票是一段回忆。”',
      a: { label: '🎫 交一段回忆', hp: 10, gold: 16, msg: '你们交了段糗事当船票，船夫笑了一路，靠岸还倒找了几枚星币。' },
      b: { label: '🏊 自己游过去', hp: -8, atk: 1, msg: '你们跳进银河自己游，呛了几口星光，却把水性练得又稳又快。' } },
    { id: 't_moondust', title: '🌫️ 月光尘埃', text: '一缕月光落在地上散成尘埃，踩上去软软的，还会往靴子里钻。',
      a: { label: '🫙 收集起来', hp: 6, gold: 18, msg: '你们把月光尘装进小瓶，夜里打开它会自己发光，被人重金买走。' },
      b: { label: '✨ 撒向彼此', hp: 18, msg: '你们把月尘撒向对方，两人的轮廓都镀了层银边，笑着笑着就靠得更近了。' } },
    { id: 't_shooting', title: '🏹 追星少年', text: '一个少年举着手网追着低飞的星星跑，边跑边回头喊：“帮我拦一下！”',
      a: { label: '🏃 帮忙拦截', hp: 8, gold: 14, msg: '你们合力网住一颗星，少年分你们一半星砂作谢礼，笑得像捞到月亮。' },
      b: { label: '😄 看他追', hp: 12, msg: '你们在旁边看他追得满头大汗，笑作一团，连日的累仿佛被笑没了。' } },
    { id: 't_record', title: '🎵 老唱片', text: '一台留声机无人自转，黑胶上唱着首老情歌，唱到动情处唱片轻轻发颤。',
      a: { label: '💃 跟着跳一曲', hp: 16, msg: '你们在星夜里笨拙地跳了一段，踩了彼此好几脚，却笑得停不下来。' },
      b: { label: '🎼 记下旋律', atk: 1, hp: 6, msg: '你们把旋律记在心里，日后走夜路哼起来，脚步也跟着有了节奏。' } },
    { id: 't_seat', title: '💺 空座位', text: '车厢里始终空着一个座位，可每次你们望向它，座位上就多一分看不见的温度。',
      a: { label: '👋 朝它点头', hp: 12, gold: 8, msg: '你们朝空座点头致意，座位扶手上凭空多出两枚温热的旧币，像谁的谢意。' },
      b: { label: '🪟 换到别处', hp: 16, msg: '你们换了个座位，夜里睡得格外安稳，梦见有人替你们守着车窗外的星。' } },
    { id: 't_ticket', title: '🎫 过期车票', text: '脚边躺着一张过期车票，日期是三年前，背面写着：“如果还来得及。”',
      a: { label: '🗓️ 试着检票', hp: -6, gold: 20, msg: '你们抱着侥幸去检票，闸机咔嗒开了，带你们抄了段极短的捷径。' },
      b: { label: '📥 收进钱包', hp: 10, msg: '你们把车票收好，像收着谁没说出口的遗憾，心里也软了几分。' } },
    { id: 't_dawn', title: '🌅 星夜尽头', text: '列车驶到银河尽头，天边泛起第一缕鱼肚白，广播轻声说：旅程将尽。',
      a: { label: '🌄 迎向晨光', hp: 20, gold: 10, msg: '你们迎着晨光张开手臂，新的一天明明刚开始，你们却觉得已经收获了整个人间。' },
      b: { label: '💫 回首星河', atk: 1, hp: 8, msg: '你们回头望了眼身后的星河，把一路的风景都记进心里，脚步也稳了。' } },
    { id: 't_parade', title: '🎺 星体巡游', text: '行星们排成队缓缓巡游，火星吹着号，木星挺着大肚子，连月亮都来凑热闹。',
      a: { label: '🎊 加入队伍', hp: 10, gold: 16, msg: '你们混进行星队伍走了段路，被塞了满兜“巡游纪念币”，乐得合不拢嘴。' },
      b: { label: '📸 当观众', hp: 16, msg: '你们在路边鼓掌欢呼，巡游队伍特意为你们放了一束小烟花，浪漫坏了。' } },
    { id: 't_carpet', title: '🧶 会飞的毯子', text: '一张旧毯子抖了抖身上的灰，飘起来蹭了蹭你们：“要搭顺风毯吗？只收一点点勇气。”',
      a: { label: '🐎 勇敢搭上', hp: -6, gold: 22, msg: '毯子带你们飞过一座发光的山谷，风把帽子都吹走了，落地还顺手捡了袋星币。' },
      b: { label: '🙅 谢绝好意', hp: 12, msg: '你们摆摆手，毯子有点失望，还是替你们把前方的星图铺平，省了不少路。' } }
  ]
}

const TRAIL_FOE_POOLS = {
  forest: [
    { name: '雾隐狼', icon: '🐺', hp: 30, atk: 7, drops: [{ name: '🐺 狼牙', atk: 1, rate: 0.6 }, { name: '🥩 狼肉干', atk: 0, rate: 0.5 }], gold: [12, 28] },
    { name: '荆棘怪', icon: '🌵', hp: 34, atk: 7, drops: [{ name: '🌵 荆棘刺', atk: 2, rate: 0.6 }, { name: '🌸 荆棘花', atk: 0, rate: 0.4 }], gold: [12, 26] },
    { name: '拦路石像', icon: '🗿', hp: 42, atk: 6, drops: [{ name: '🗿 石像碎片', atk: 1, rate: 0.7 }, { name: '💎 石中玉', atk: 0, rate: 0.3 }], gold: [15, 30] },
    { name: '捣蛋小妖', icon: '👺', hp: 26, atk: 8, drops: [{ name: '👺 妖怪面具', atk: 2, rate: 0.5 }, { name: '🍬 妖怪糖果', atk: 0, rate: 0.6 }], gold: [10, 24] },
    { name: '毒蘑菇精', icon: '🍄', hp: 29, atk: 7, drops: [{ name: '🍄 迷魂孢子', atk: 1, rate: 0.6 }, { name: '🧪 解毒剂', atk: 0, rate: 0.5 }], gold: [11, 25] },
    { name: '疯狂野猪', icon: '🐗', hp: 38, atk: 8, drops: [{ name: '🐗 獠牙', atk: 2, rate: 0.6 }, { name: '🥓 野猪肉', atk: 0, rate: 0.5 }], gold: [13, 28] },
    { name: '藤蔓巨蟒', icon: '🐍', hp: 36, atk: 8, drops: [{ name: '🐍 蛇鳞护腕', atk: 2, rate: 0.55 }, { name: '🌿 蛇胆', atk: 0, rate: 0.4 }], gold: [14, 29] },
    { name: '树精守卫', icon: '🌳', hp: 46, atk: 6, drops: [{ name: '🌳 树心木', atk: 1, rate: 0.7 }, { name: '🍃 翠叶甲', atk: 0, rate: 0.4 }], gold: [16, 32] },
    { name: '山魈', icon: '👹', hp: 33, atk: 9, drops: [{ name: '👹 鬼面铃', atk: 2, rate: 0.5 }, { name: '🪶 魈羽', atk: 0, rate: 0.5 }], gold: [14, 30] },
    { name: '巨型蛛后', icon: '🕷️', hp: 30, atk: 9, drops: [{ name: '🕷️ 蛛丝手套', atk: 1, rate: 0.6 }, { name: '🕸️ 千年蛛网', atk: 0, rate: 0.4 }], gold: [13, 27] }
  ],
  sea: [
    { name: '深渊触手', icon: '🐙', hp: 38, atk: 8, drops: [{ name: '🐙 触手腕带', atk: 2, rate: 0.55 }, { name: '🦑 墨汁炸弹', atk: 0, rate: 0.4 }], gold: [14, 30] },
    { name: '礁石巨蟹', icon: '🦀', hp: 42, atk: 7, drops: [{ name: '🦀 巨钳护臂', atk: 2, rate: 0.55 }, { name: '🦪 蟹黄', atk: 0, rate: 0.5 }], gold: [15, 31] },
    { name: '巨浪海蛇', icon: '🐍', hp: 35, atk: 8, drops: [{ name: '🐍 海鳞软甲', atk: 2, rate: 0.55 }, { name: '🌊 浪心珠', atk: 0, rate: 0.4 }], gold: [14, 28] },
    { name: '灯笼水母', icon: '🪼', hp: 26, atk: 9, drops: [{ name: '🪼 夜光触须', atk: 2, rate: 0.6 }, { name: '💡 磷光粉', atk: 0, rate: 0.5 }], gold: [11, 25] },
    { name: '嗜血鲨鱼', icon: '🦈', hp: 44, atk: 8, drops: [{ name: '🦈 鲨齿利刃', atk: 3, rate: 0.5 }, { name: '🍖 鲨鱼肉', atk: 0, rate: 0.5 }], gold: [16, 33] },
    { name: '缠绕章鱼', icon: '🦑', hp: 36, atk: 8, drops: [{ name: '🦑 吸盘护手', atk: 2, rate: 0.55 }, { name: '🖤 章鱼墨玉', atk: 0, rate: 0.4 }], gold: [14, 29] },
    { name: '海妖塞壬', icon: '🧜', hp: 33, atk: 9, drops: [{ name: '🧜 海妖笛', atk: 2, rate: 0.5 }, { name: '🐚 惑心螺', atk: 0, rate: 0.5 }], gold: [15, 31] },
    { name: '狂暴电鳗', icon: '⚡', hp: 27, atk: 10, drops: [{ name: '⚡ 电鳗脊骨', atk: 2, rate: 0.6 }, { name: '🔋 蓄电囊', atk: 0, rate: 0.4 }], gold: [12, 27] },
    { name: '珊瑚巨像', icon: '🪸', hp: 50, atk: 6, drops: [{ name: '🪸 珊瑚坚盾', atk: 1, rate: 0.75 }, { name: '💗 红珊瑚', atk: 0, rate: 0.4 }], gold: [17, 34] },
    { name: '深海鮟鱇', icon: '🐟', hp: 40, atk: 9, drops: [{ name: '🐟 鮟鱇提灯', atk: 2, rate: 0.55 }, { name: '🫧 深海之泪', atk: 0, rate: 0.4 }], gold: [15, 31] }
  ],
  star: [
    { name: '星尘守卫', icon: '🌟', hp: 38, atk: 8, drops: [{ name: '🌟 星辉短刃', atk: 2, rate: 0.55 }, { name: '✨ 星尘袋', atk: 0, rate: 0.45 }], gold: [15, 31] },
    { name: '失控机器人', icon: '🤖', hp: 40, atk: 7, drops: [{ name: '🤖 机械臂甲', atk: 2, rate: 0.55 }, { name: '🔩 能量核心', atk: 0, rate: 0.45 }], gold: [14, 30] },
    { name: '陨石怪', icon: '🪨', hp: 46, atk: 7, drops: [{ name: '🪨 陨铁护腕', atk: 2, rate: 0.55 }, { name: '💠 星核碎片', atk: 0, rate: 0.4 }], gold: [16, 33] },
    { name: '虚空幽灵', icon: '👻', hp: 30, atk: 9, drops: [{ name: '👻 幽影斗篷', atk: 2, rate: 0.5 }, { name: '🌫️ 虚空气息', atk: 0, rate: 0.5 }], gold: [13, 28] },
    { name: '黑洞触须', icon: '🕳️', hp: 42, atk: 8, drops: [{ name: '🕳️ 引力腕带', atk: 2, rate: 0.55 }, { name: '⚫ 暗物质', atk: 0, rate: 0.4 }], gold: [16, 32] },
    { name: '星海巨鲸', icon: '🐋', hp: 48, atk: 8, drops: [{ name: '🐋 鲸骨巨刃', atk: 3, rate: 0.5 }, { name: '🎶 鲸歌结晶', atk: 0, rate: 0.45 }], gold: [17, 34] },
    { name: '光子精灵', icon: '✨', hp: 28, atk: 10, drops: [{ name: '✨ 光棱法杖', atk: 2, rate: 0.55 }, { name: '🔆 纯净光子', atk: 0, rate: 0.5 }], gold: [12, 27] },
    { name: '时空猎手', icon: '⏳', hp: 36, atk: 8, drops: [{ name: '⏳ 逆流沙漏', atk: 2, rate: 0.55 }, { name: '🌀 时间碎片', atk: 0, rate: 0.4 }], gold: [15, 31] },
    { name: '冷冻彗核', icon: '☄️', hp: 39, atk: 8, drops: [{ name: '☄️ 彗尾冰晶', atk: 2, rate: 0.55 }, { name: '❄️ 寒霜核', atk: 0, rate: 0.4 }], gold: [15, 31] },
    { name: '机械巨蟹', icon: '🛸', hp: 37, atk: 9, drops: [{ name: '🛸 反重力环', atk: 2, rate: 0.55 }, { name: '🔫 等离子炮', atk: 0, rate: 0.4 }], gold: [15, 32] }
  ]
}

const TRAIL_FOE_AMBIENT = {
  forest: ['雾中', '暗处', '草丛后', '大树旁'],
  sea: ['浪里', '暗流中', '礁石后', '船舷边'],
  star: ['星云里', '轨道旁', '陨石后', '舱门边']
}

// 生成一难:depth 越深怪越强;返回 {kind:'event'|'battle'|'rest', ...}
// journey.usedEvents / usedFoes 记录本局已出现过的 id,同局不重复;用光了才重置
function pickUnused(pool, usedArr, idOf) {
  const used = usedArr || []
  let avail = pool.filter((x) => !used.includes(idOf(x)))
  if (!avail.length) { avail = pool.slice(); used.length = 0 }
  const chosen = avail[Math.floor(Math.random() * avail.length)]
  const id = idOf(chosen)
  if (!used.includes(id)) used.push(id)
  return chosen
}

function genTrail(journey, depth) {
  const roll = Math.random()
  const scale = 1 + (depth - 1) * 0.18
  if (!journey.usedEvents) journey.usedEvents = []
  if (!journey.usedFoes) journey.usedFoes = []
  if (roll < 0.45) {
    const theme = journey.theme || 'forest'
    const foes = TRAIL_FOE_POOLS[theme] || TRAIL_FOE_POOLS.forest
    const ambient = TRAIL_FOE_AMBIENT[theme] || TRAIL_FOE_AMBIENT.forest
    const f = pickUnused(foes, journey.usedFoes, (x) => x.name)
    return {
      kind: 'battle', title: `${f.icon} 第${depth}难·${f.name}`,
      text: `${f.icon} ${f.name}从${pick(ambient)}扑了出来！这是第 ${depth} 难，气息比之前更强了。`,
      battle: {
        name: `${f.name}`, icon: f.icon,
        hp: Math.round(f.hp * scale), atk: Math.round(f.atk * scale),
        drops: f.drops, gold: [Math.round(f.gold[0] * scale), Math.round(f.gold[1] * scale)],
        winNext: null, trail: true
      }
    }
  }
  if (roll < 0.58) {
    return { kind: 'rest', title: '⛺ 难得的安营', text: `走了 ${depth - 1} 难，你们找了处避风的地方扎营。篝火噼啪，TA 靠在你们肩上睡着了。好好休息，明难再战。`, hp: 20, gold: 5 }
  }
  const e = pickUnused(TRAIL_EVENT_POOLS[journey.theme] || TRAIL_EVENT_POOLS.forest, journey.usedEvents, (x) => x.id)
  return { kind: 'event', title: `${e.title}（第${depth}难）`, text: e.text, eventId: e.id, a: e.a, b: e.b }
}

function trailProgress(journey) {
  const total = journey.total || 10
  const done = total - (journey.left || 0)
  return { depth: Math.min(total, done + 1), total }
}

// 旅途推进器:从 journey 当前剩余层数生成下一个可玩遭遇.
// 安营福利难自动结算并跳过(循环+上限防卡死);走完返回 done+exit.
// 返回 {trail, battle, hp, gold, journey, done, exit, rested}
function settleTrailExit(def, exitId, openid) {
  // 出站口若是结局节点(无选项、有 ending),直接记一笔结局,免得卡死在无按钮界面
  const node = (def && def.nodes || {})[exitId]
  if (node && node.ending && !node.choices) {
    return { name: node.ending, at: Date.now(), by: openid }
  }
  return null
}
function progressTrail(hp, gold, journey, startNode, maxHp) {
  const j = { ...(journey || {}), total: (journey && journey.total) || 10, left: Math.max(0, (journey && journey.left) || 0) }
  let curHp = hp
  let curGold = gold
  let rested = false
  for (let guard = 0; guard < 25; guard += 1) {
    if (j.left <= 0) {
      return { hp: curHp, gold: curGold, journey: j, done: true, exit: j.exit || startNode || 'start', rested }
    }
    const prog = trailProgress(j)
    const next = genTrail(j, prog.depth)
    if (next.kind === 'rest') {
      curHp = Math.max(0, Math.min(maxHp || 100, curHp + (next.hp || 0)))
      curGold = Math.max(0, curGold + (next.gold || 0))
      j.left = Math.max(0, j.left - 1)
      rested = true
      continue
    }
    const trail = normTrail(prog.depth, j.total, next)
    let battle = null
    if (next.kind === 'battle' && next.battle) {
      battle = normBattle(next.battle)
    }
    return { trail, battle, hp: curHp, gold: curGold, journey: j, done: false, rested }
  }
  return { hp: curHp, gold: curGold, journey: j, done: true, exit: j.exit || startNode || 'start', rested }
}

// 回合制战斗:move attack/defend/flee
async function applyAdvBattle(doc, move, openid, petMood) {
  const def = ADV_DEFS[doc.storyId]
  const b = doc.battle
  if (!def) return { ok: false, message: '剧本不存在' }
  if (!b) return { ok: false, message: '当前没有战斗' }
  if ((doc.endings || []).length) return { ok: false, message: '本局已完结' }
  const maxHp = doc.maxHp || 100
  let hp = doc.hp == null ? 100 : doc.hp
  let enemyHp = b.hp
  const atkTotal = advAtkTotal(doc)
  const petBonus = (petMood || 0) >= 60 ? 2 : 0
  const rounds = [...(b.rounds || [])]
  const pushRound = (t) => { rounds.push({ t, at: Date.now() }); while (rounds.length > 6) rounds.shift() }

  if (move === 'flee') {
    if (Math.random() < 0.5) {
      hp = Math.max(1, hp - 5)
      pushRound('🏃 你们趁乱溜走了(-5生命)')
      const patch = { hp, battle: {}, log: advLog(doc, { node: b.node, choice: 'flee-ok', text: `🏃 趁乱逃出${b.name}的爪牙`, by: openid }) }
      patch.battleRounds = rounds
      if (b.trail) {
        // 旅途战斗逃脱:消耗本难并推进到下一遭(无战利品,避免卡死)
        const journey = { ...(doc.journey || {}), left: Math.max(0, (doc.journey || {}).left - 1) }
        const pr = progressTrail(patch.hp, doc.gold || 0, journey, def.start, maxHp)
        patch.hp = pr.hp
        patch.gold = pr.gold
        patch.journey = pr.journey
        if (pr.done) {
          patch.node = pr.exit || def.start
          patch.trail = {}
          const endGot = settleTrailExit(def, patch.node, openid)
          if (endGot) patch.endings = [...(doc.endings || []), endGot]
          return { ok: true, patch, event: { type: 'flee', ok: true, rounds, trailDone: true, exit: patch.node, ending: endGot ? endGot.name : undefined } }
        }
        patch.trail = pr.trail
        if (pr.battle) patch.battle = pr.battle
        return { ok: true, patch, event: { type: 'flee', ok: true, rounds, trailNext: true, rested: pr.rested } }
      }
      patch.node = b.from || doc.node
      return { ok: true, patch, event: { type: 'flee', ok: true, rounds } }
    }
    const dmg = Math.max(1, b.atk + rnd(2) - 1)
    hp = Math.max(0, hp - dmg)
    pushRound(`🏃 没跑掉!${b.name}追击造成 ${dmg} 点伤害`)
  } else if (move === 'defend') {
    const dmg = Math.max(0, Math.ceil((b.atk + rnd(2) - 1) / 2))
    hp = Math.max(0, hp - dmg)
    pushRound(`🛡️ 你们架起防御,只受到 ${dmg} 点伤害`)
  } else {
    // attack
    const dmg = Math.max(1, atkTotal + rnd(4) + petBonus)
    enemyHp = Math.max(0, enemyHp - dmg)
    pushRound(`⚔️ 你们造成 ${dmg} 点伤害${petBonus ? '(含宠物助战+2)' : ''}`)
    if (enemyHp > 0) {
      const back = Math.max(1, b.atk + rnd(3) - 1)
      hp = Math.max(0, hp - back)
      pushRound(`${b.icon} ${b.name}反击,造成 ${back} 点伤害`)
    }
  }

  // 战败:抬回营地,30 血复活,原怪满血重来(直接重建战斗,避免无交互卡死)
  if (hp <= 0) {
    const revive = {
      node: b.node || 'trail', from: b.from || 'trail',
      name: b.name, icon: b.icon, hp: b.max || b.hp, max: b.max || b.hp, atk: b.atk,
      drops: b.drops || [], gold: b.gold || [0, 0],
      winNext: b.winNext || null, trail: !!b.trail,
      defending: false, rounds: []
    }
    const patch = { hp: 30, battle: revive, battleRounds: [], log: advLog(doc, { node: b.node, choice: 'defeated', text: `💀 被${b.name}打趴，营地 30 血复活`, by: openid }) }
    return { ok: true, patch, event: { type: 'defeat', name: b.name, rounds } }
  }
  // 胜利:roll 掉落
  if (enemyHp <= 0) {
    const got = []
    ;(b.drops || []).forEach((d) => {
      if (Math.random() <= (d.rate == null ? 1 : d.rate)) got.push({ name: d.name, atk: d.atk || 0, at: Date.now(), by: openid })
    })
    const gRange = b.gold || [0, 0]
    const goldGot = gRange[0] + rnd(Math.max(0, gRange[1] - gRange[0]))
    const isTrailBattle = !!b.trail
    const target = (!isTrailBattle && b.winNext) ? def.nodes[b.winNext] : null
    const patch = {
      hp,
      gold: Math.max(0, (doc.gold || 0) + goldGot),
      items: [...(doc.items || []), ...got],
      battle: {},
      node: isTrailBattle ? (doc.node || 'trail') : b.winNext,
      flags: { ...(doc.flags || {}), [(b.node || 'battle')]: true },
      endings: [...(doc.endings || [])],
      log: advLog(doc, { node: doc.node, choice: 'win', text: `🏆 击败${b.name}，金币+${goldGot}${got.length ? '，拾取 ' + got.map((g) => g.name).join('、') : ''}`, by: openid })
    }
    pushRound(`🏆 ${b.name}倒下了!金币+${goldGot}${got.length ? ',拾取:' + got.map((g) => g.name).join('、') : ''}`)
    let event = { type: 'victory', name: b.name, gold: goldGot, loot: got.map((g) => g.name), rounds }
    if (isTrailBattle) {
      // 旅途战斗胜利:消耗一难,用 progressTrail 推进(自动跳过安营福利难,防卡死)
      const journey = { ...(doc.journey || {}), left: Math.max(0, (doc.journey || {}).left - 1) }
      patch.journey = journey
      const pr = progressTrail(patch.hp, patch.gold, journey, def.start, maxHp)
      patch.hp = pr.hp
      patch.gold = pr.gold
      patch.journey = pr.journey
      if (pr.done) {
        patch.node = pr.exit || def.start
        patch.trail = {}
        const endGot = settleTrailExit(def, patch.node, openid)
        if (endGot) {
          patch.endings = [...(patch.endings || []), endGot]
        }
        event = { ...event, trailDone: true, exit: patch.node, ending: endGot ? endGot.name : undefined }
      } else {
        patch.trail = pr.trail
        event = { ...event, trailNext: true, depth: pr.trail.depth, total: pr.trail.total }
        if (pr.battle) {
          patch.battle = pr.battle
          event = { ...event, chainedBattle: true }
        }
        if (pr.rested) event = { ...event, rested: true }
      }
    } else if (target && !target.choices && !target.battle) {
      const r = settleAdvEvent(patch, { ...doc, hp, gold: patch.gold, items: patch.items, endings: patch.endings }, target, b.winNext, openid)
      if (r.event) event = { ...event, chained: r.event }
    }
    return { ok: true, patch, event }
  }
  // 继续打
  const patch = {
    hp,
    battle: { ...b, hp: enemyHp, defending: move === 'defend', rounds },
    log: advLog(doc, { node: b.node, choice: `battle-${move}`, text: `⚔️ 对战${b.name}：${({ attack: '出手攻击', defend: '举盾防御', flee: '尝试逃跑' })[move] || '出手'}`, by: openid })
  }
  return { ok: true, patch, event: { type: 'round', rounds } }
}

// 同日历页:listXXX 下发前,把 fileID 照片/头像批量换成 https 临时链接
// pickers:从每条记录里取 fileID 或 fileID 数组的函数列表;结果写入 d.photoUrls(与输入顺序对应)
async function attachPhotoUrls(list, pickers) {
  try {
    const files = []
    list.forEach((d) => {
      pickers.forEach((pick) => {
        const v = pick(d)
        const arr = Array.isArray(v) ? v : [v]
        arr.forEach((f) => { if (f && String(f).startsWith('cloud://') && !files.includes(f)) files.push(f) })
      })
    })
    if (!files.length) {
      list.forEach((d) => { d.photoUrls = {} })
      return
    }
    const { fileList } = await cloud.getTempFileURL({ fileList: files })
    const urlMap = {}
    ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
    list.forEach((d) => { d.photoUrls = urlMap })
  } catch (e) {
    console.warn('attachPhotoUrls failed', e)
    list.forEach((d) => { d.photoUrls = d.photoUrls || {} })
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  try {
    const user = await requireUser(OPENID)
    user._openid = OPENID

    if (action === 'saveProfile') {
      const nickName = String(event.nickName || '').trim() || '还没起名字'
      const patch = { nickName }
      if (typeof event.avatarUrl === 'string') {
        patch.avatarUrl = event.avatarUrl.slice(0, 500)
      }
      await db.collection('users').doc(user._id).update({ data: patch })
      return { ok: true, nickName: patch.nickName, avatarUrl: patch.avatarUrl || user.avatarUrl || '' }
    }

    if (action === 'enableRemind') {
      await db.collection('users').doc(user._id).update({
        data: {
          remindEnabled: !!event.enabled,
          remindUpdatedAt: Date.now()
        }
      })
      return { ok: true, remindEnabled: !!event.enabled }
    }

    if (action === 'getMembers') {
      const couple = await requireCouple(user, OPENID)
      const members = await loadMembers(couple.memberOpenids)
      return { ok: true, members, couple }
    }

    if (action === 'getCouple') {
      if (!user.coupleId) return { ok: true, couple: null, members: [] }
      try {
        const { data: couple } = await db.collection('couples').doc(user.coupleId).get()
        if (!couple || !couple.memberOpenids.includes(OPENID) || couple.status === 'dissolved') {
          try { await db.collection('users').doc(user._id).update({ data: { coupleId: '' } }) } catch (e) {}
          return { ok: true, couple: null, members: [], staleCleared: true }
        }
        const members = await loadMembers(couple.memberOpenids)
        return { ok: true, couple, members }
      } catch (err) {
        return { ok: true, couple: null, members: [] }
      }
    }

    if (action === 'getStreaks') {
      const couple = await requireCouple(user, OPENID)
      return { ok: true, streaks: await streaksFor(user, couple) }
    }

    if (action === 'unbind') {
      if (!user.coupleId) return fail('还没有绑定')
      const cid = user.coupleId
      let couple = null
      try { couple = (await db.collection('couples').doc(cid).get()).data } catch (e) {}
      await db.collection('users').doc(user._id).update({ data: { coupleId: '' } })
      if (!couple || !couple.memberOpenids.includes(OPENID)) return { ok: true, dissolved: true }
      const remain = couple.memberOpenids.filter((id) => id !== OPENID)
      const prevMembers = Array.from(new Set([...(couple.prevMembers || []), ...couple.memberOpenids]))
      // 只要曾经配对成功过，一方退出即整间解散，双方都回到未绑定，数据保留在原coupleId下
      if (couple.everPaired || couple.status === 'paired' || remain.length === 0) {
        await db.collection('couples').doc(couple._id).update({
          data: { memberOpenids: [], status: 'dissolved', prevMembers, dissolvedAt: Date.now() }
        })
        // 把对方也踢成未绑定，前端下次getCouple自动清
        for (const oid of remain) {
          try {
            const { data: ulist } = await db.collection('users').where({ _openid: oid }).limit(1).get()
            if (ulist[0]) await db.collection('users').doc(ulist[0]._id).update({ data: { coupleId: '' } })
          } catch (e) {}
        }
        return { ok: true, dissolved: true }
      }
      // 从未配对成功（单方等待期），对方退出=创建者自己走，保留等待位不变
      await db.collection('couples').doc(couple._id).update({
        data: { memberOpenids: remain, status: 'pending', prevMembers }
      })
      return { ok: true, dissolved: false }
    }

    if (action === 'saveCheckin') {
      const couple = await requireCouple(user, OPENID)
      const mood = MOODS.includes(event.mood) ? event.mood : 'love'
      const content = String(event.content || '').trim().slice(0, 120)
      const photo = String(event.photo || '')
      const dateKey = todayKey()
      const { data: exists } = await db.collection('checkins').where({
        coupleId: couple._id,
        _openid: OPENID,
        dateKey
      }).limit(1).get()

      // 每天只能签到一次，不支持修改
      if (exists[0]) return fail('今天已经签到啦，明天再来 ♡')

      await db.collection('checkins').add({
        data: {
          _openid: OPENID,
          coupleId: couple._id,
          dateKey,
          mood,
          content,
          photo,
          createdAt: Date.now()
        }
      })
      return { ok: true, streaks: await streaksFor(user, couple) }
    }

    if (action === 'listMonthCheckins') {
      const couple = await requireCouple(user, OPENID)
      const start = String(event.start || '')
      const end = String(event.end || '')
      const prefix = start.slice(0, 7)
      // 只按 coupleId 拉取，月份在内存里过滤，避免组合查询漏数据
      const all = await fetchAllCheckins({ coupleId: couple._id })
      const raw = all.filter((item) => {
        const k = normKey(item)
        if (!k) return false
        if (start && end) return k >= start && k <= end
        return k.slice(0, 7) === prefix
      })
      // 同一人同一天若有多条(历史脏数据),优先保留有图/有文字的
      const byDay = {}
      raw.forEach((item) => {
        const k = normKey(item)
        const key = `${item._openid}|${k}`
        const weight = ((item.photo || item.image || item.img || item.photoFileID || (Array.isArray(item.photos) && item.photos[0])) ? 4 : 0) +
          ((item.content) ? 2 : 0) +
          (item.createdAt || 0) / 1e15
        if (!byDay[key] || byDay[key]._w < weight) byDay[key] = { ...item, _w: weight }
      })
      const data = Object.values(byDay)
      data.sort((a, b) => {
        const ka = normKey(a); const kb = normKey(b)
        return ka < kb ? 1 : ka > kb ? -1 : (b.createdAt || 0) - (a.createdAt || 0)
      })
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = data.map((item) => {
        const m = map[item._openid] || {}
        const photos = Array.isArray(item.photos) ? item.photos : []
        return {
          _id: item._id,
          _openid: item._openid,
          isMine: item._openid === OPENID,
          dateKey: normKey(item),
          mood: item.mood,
          moodLabel: moodLabelOf(item.mood),
          content: item.content || '',
          photo: item.photo || item.image || item.img || item.photoFileID || photos[0] || '',
          createdAt: item.createdAt || 0,
          authorName: m.nickName || 'TA',
          authorAvatar: m.avatarUrl || ''
        }
      })
      list.forEach((d) => { d.initial = (d.authorName || 'TA').charAt(0) || '♡' })
      // fileID 在部分机型直接渲染空白,批量换 https 临时链接下发
      try {
        const files = [...new Set(list.flatMap((d) => [d.photo, d.authorAvatar]).filter((f) => f && f.startsWith('cloud://')))]
        if (files.length) {
          const { fileList } = await cloud.getTempFileURL({ fileList: files })
          const urlMap = {}
          ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
          list.forEach((d) => {
            if (urlMap[d.photo]) d.photoUrl = urlMap[d.photo]
            if (urlMap[d.authorAvatar]) d.authorAvatarUrl = urlMap[d.authorAvatar]
          })
        }
      } catch (e) { console.warn('monthCheckins getTempFileURL failed', e) }
      return { ok: true, list, members }
    }

    if (action === 'savePost') {
      const couple = await requireCouple(user, OPENID)
      const title = String(event.title || '').trim().slice(0, 40)
      const content = String(event.content || '').trim().slice(0, 5000)
      const photos = Array.isArray(event.photos) ? event.photos.slice(0, 9) : []
      if (!title || !content) return fail('标题和正文都要写')
      if (event.id) {
        const { data: post } = await db.collection('posts').doc(event.id).get()
        if (!post || post._openid !== OPENID) return fail('只能改自己的文章')
        const removed = (post.photos || []).filter((id) => !photos.includes(id))
        await db.collection('posts').doc(event.id).update({
          data: { title, content, photos, updatedAt: Date.now() }
        })
        await removeFiles(removed)
        return { ok: true, id: event.id }
      }
      const add = await db.collection('posts').add({
        data: {
          _openid: OPENID,
          coupleId: couple._id,
          title,
          content,
          photos,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'removePost') {
      const { data: post } = await db.collection('posts').doc(event.id).get()
      if (!post || post._openid !== OPENID) return fail('只能删自己的文章')
      await db.collection('posts').doc(event.id).remove()
      await removeFiles(post.photos || [])
      return { ok: true }
    }

    if (action === 'saveAnniversary') {
      const couple = await requireCouple(user, OPENID)
      const title = String(event.title || '').trim().slice(0, 20)
      const date = String(event.date || '')
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('标题和日期必填')
      const payload = {
        title,
        date,
        repeatYearly: !!event.repeatYearly,
        emoji: String(event.emoji || '♡').slice(0, 4),
        color: String(event.color || '#E86A7A').slice(0, 16),
        note: String(event.note || '').trim().slice(0, 200)
      }
      if (event.id) {
        const { data: doc } = await db.collection('anniversaries').doc(event.id).get()
        if (!doc || doc.coupleId !== couple._id) return fail('找不到这个纪念日')
        await db.collection('anniversaries').doc(event.id).update({ data: payload })
        return { ok: true, id: event.id }
      }
      const add = await db.collection('anniversaries').add({
        data: {
          _openid: OPENID,
          coupleId: couple._id,
          ...payload,
          createdAt: Date.now()
        }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'removeAnniversary') {
      const couple = await requireCouple(user, OPENID)
      const { data: doc } = await db.collection('anniversaries').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这个纪念日')
      await db.collection('anniversaries').doc(event.id).remove()
      return { ok: true }
    }

    if (action === 'listMoments') {
      const couple = await requireCouple(user, OPENID)
      const limit = Math.min(30, Math.max(5, Number(event.limit) || 20))
      const q = { coupleId: couple._id }
      if (event.before) q.createdAt = _.lt(Number(event.before))
      if (event.doing) q.doing = String(event.doing)
      const { data } = await db.collection('moments').where(q).orderBy('createdAt', 'desc').limit(limit).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = data.map((d) => ({ ...d, author: map[d._openid] || null }))
      await attachPhotoUrls(list, [(d) => d.photos, (d) => d.author && d.author.avatarUrl])
      return { ok: true, list, hasMore: data.length >= limit }
    }

    if (action === 'saveMoment') {
      const couple = await requireCouple(user, OPENID)
      const doing = String(event.doing || '日常').slice(0, 8)
      const content = String(event.content || '').trim().slice(0, 500)
      const photos = Array.isArray(event.photos) ? event.photos.slice(0, 6) : []
      if (!content && !photos.length) return fail('写点什么或传张图吧')
      if (event.id) {
        const { data: doc } = await db.collection('moments').doc(event.id).get()
        if (!doc || doc.coupleId !== couple._id || doc._openid !== OPENID) return fail('只能改自己的动态')
        const removed = (doc.photos || []).filter((id) => !photos.includes(id))
        await db.collection('moments').doc(event.id).update({ data: { doing, content, photos, updatedAt: Date.now() } })
        await removeFiles(removed)
        return { ok: true, id: event.id }
      }
      const add = await db.collection('moments').add({ data: { _openid: OPENID, coupleId: couple._id, doing, content, photos, createdAt: Date.now(), updatedAt: Date.now() } })
      return { ok: true, id: add._id }
    }

    if (action === 'getMoment') {
      const couple = await requireCouple(user, OPENID)
      const { data: doc } = await db.collection('moments').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这条动态')
      const members = await loadMembers([doc._openid])
      const detail = { ...doc, author: members[0] || null }
      await attachPhotoUrls([detail], [(d) => d.photos, (d) => d.author && d.author.avatarUrl])
      return { ok: true, detail }
    }

    if (action === 'removeMoment') {
      const { data: doc } = await db.collection('moments').doc(event.id).get()
      if (!doc || doc._openid !== OPENID) return fail('只能删自己的动态')
      await db.collection('moments').doc(event.id).remove()
      await removeFiles(doc.photos || [])
      return { ok: true }
    }

    if (action === 'listPosts') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('posts').where({ coupleId: couple._id }).orderBy('createdAt', 'desc').limit(50).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = data.map((d) => ({ ...d, authorName: (map[d._openid] || {}).nickName || 'TA' }))
      await attachPhotoUrls(list, [(d) => d.photos])
      return { ok: true, list }
    }

    if (action === 'getPost') {
      const couple = await requireCouple(user, OPENID)
      const { data: doc } = await db.collection('posts').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这篇文章')
      const members = await loadMembers([doc._openid])
      const detail = { ...doc, authorName: (members[0] || {}).nickName || 'TA' }
      await attachPhotoUrls([detail], [(d) => d.photos])
      return { ok: true, detail }
    }

    if (action === 'getPet') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
      const pet = data[0] || null
      if (!pet) return { ok: true, pet: null }
      const hours = Math.max(0, (Date.now() - (pet.updatedAt || Date.now())) / 3600000)
      const decay = Math.min(30, Math.floor(hours * 2))
      if (decay > 0 && ((pet.hunger || 0) > 0 || (pet.mood || 0) > 0)) {
        const patch = { hunger: Math.max(0, (pet.hunger || 0) - decay), mood: Math.max(0, (pet.mood || 0) - decay), updatedAt: Date.now() }
        await db.collection('pets').doc(pet._id).update({ data: patch })
        return { ok: true, pet: { ...pet, ...patch } }
      }
      return { ok: true, pet }
    }

    if (action === 'adoptPet') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
      if (data[0]) return fail('已经领养过啦')
      const species = ['cat', 'dog', 'bunny', 'fox', 'panda'].includes(event.species) ? event.species : 'cat'
      const name = String(event.name || '').trim().slice(0, 10) || '团子'
      const add = await db.collection('pets').add({
        data: { _openid: OPENID, coupleId: couple._id, species, name, hunger: 80, mood: 80, clean: 80, energy: 80, exp: 0, level: 1, state: 'idle', updatedAt: Date.now(), createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'feedPet' || action === 'playPet' || action === 'interactPet') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
      const pet = data[0]
      if (!pet) return fail('先领养一只宠物吧')
      const kind = action === 'interactPet' ? String(event.kind || 'pat') : (action === 'feedPet' ? 'feed' : 'play')
      const patch = { hunger: pet.hunger || 0, mood: pet.mood || 0, clean: pet.clean != null ? pet.clean : 80, energy: pet.energy != null ? pet.energy : 80, exp: pet.exp || 0 }
      let state = 'happy', msg = '好开心!'
      if (kind === 'feed') { patch.hunger = Math.min(100, patch.hunger + 18); patch.mood = Math.min(100, patch.mood + 5); patch.exp += 6; state = 'eat'; msg = '吃得好饱!' }
      else if (kind === 'play') { patch.mood = Math.min(100, patch.mood + 18); patch.energy = Math.max(0, patch.energy - 8); patch.exp += 6; state = 'play'; msg = '玩得好开心!' }
      else if (kind === 'pat') { patch.mood = Math.min(100, patch.mood + 10); patch.exp += 3; state = 'love'; msg = '被摸摸了 ♡' }
      else if (kind === 'bathe') { patch.clean = 100; patch.mood = Math.min(100, patch.mood + 6); patch.exp += 4; state = 'bath'; msg = '洗香香啦!' }
      else if (kind === 'sleep') { patch.energy = 100; patch.hunger = Math.max(0, patch.hunger - 5); patch.exp += 2; state = 'sleep'; msg = '睡了个好觉 Zzz' }
      else if (kind === 'dance') { patch.mood = Math.min(100, patch.mood + 8); patch.energy = Math.max(0, patch.energy - 5); patch.exp += 4; state = 'dance'; msg = '扭起来!' }
      patch.level = Math.min(99, 1 + Math.floor(patch.exp / 100))
      patch.state = state
      patch.updatedAt = Date.now()
      await db.collection('pets').doc(pet._id).update({ data: patch })
      return { ok: true, pet: { ...pet, ...patch }, msg, state }
    }

    if (action === 'renamePet') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
      const pet = data[0]
      if (!pet) return fail('先领养一只宠物吧')
      const name = String(event.name || '').trim().slice(0, 10)
      if (!name) return fail('起个名字吧')
      await db.collection('pets').doc(pet._id).update({ data: { name, updatedAt: Date.now() } })
      return { ok: true, name }
    }

    if (action === 'sendChat') {
      const couple = await requireCouple(user, OPENID)
      const kind = event.kind === 'image' ? 'image' : 'text'
      const content = String(event.content || '').trim().slice(0, kind === 'image' ? 500 : 500)
      if (!content) return fail('说点什么吧')
      const add = await db.collection('chats').add({
        data: { _openid: OPENID, coupleId: couple._id, kind, content, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listChats') {
      const couple = await requireCouple(user, OPENID)
      const limit = Math.min(50, Math.max(10, Number(event.limit) || 30))
      const q = { coupleId: couple._id }
      if (event.before) q.createdAt = _.lt(Number(event.before))
      const { data } = await db.collection('chats').where(q).orderBy('createdAt', 'desc').limit(limit).get()
      const asc = data.reverse()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = asc.map((d) => ({ ...d, isMine: d._openid === OPENID, authorName: (map[d._openid] || {}).nickName || 'TA', authorAvatar: (map[d._openid] || {}).avatarUrl || '' }))
      // 图片消息换临时可访问链接,避免对方因存储权限看不到图
      const files = list.filter((d) => d.kind === 'image' && d.content && d.content.startsWith('cloud://')).map((d) => d.content)
      if (files.length) {
        try {
          const { fileList } = await cloud.getTempFileURL({ fileList: [...new Set(files)] })
          const urlMap = {}
          ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
          list.forEach((d) => { if (d.kind === 'image' && urlMap[d.content]) d.url = urlMap[d.content] })
        } catch (e) { console.warn('getTempFileURL failed', e) }
      }
      const reads = await db.collection('chatReads').where({ coupleId: couple._id }).get()
      let partnerReadAt = 0
      reads.data.forEach((r) => { if (r._openid !== OPENID) partnerReadAt = Math.max(partnerReadAt, r.lastReadAt || 0) })
      return { ok: true, list, partnerReadAt }
    }

    if (action === 'recallChat') {
      const { data: doc } = await db.collection('chats').doc(event.id).get()
      if (!doc || doc._openid !== OPENID) return fail('只能撤回自己的消息')
      if (Date.now() - (doc.createdAt || 0) > 2 * 60 * 1000) return fail('超过2分钟不能撤回啦')
      await db.collection('chats').doc(event.id).remove()
      if (doc.kind === 'image') await removeFiles([doc.content])
      return { ok: true }
    }

    if (action === 'todayCheckins') {
      const couple = await requireCouple(user, OPENID)
      const dateKey = String(event.dateKey || todayKey()).slice(0, 10)
      const { data } = await db.collection('checkins').where({ coupleId: couple._id, dateKey }).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const list = data.map((item) => {
        const m = map[item._openid] || {}
        return {
          _id: item._id,
          _openid: item._openid,
          isMine: item._openid === OPENID,
          dateKey: item.dateKey,
          mood: item.mood,
          moodLabel: moodLabelOf(item.mood),
          content: item.content || '',
          photo: item.photo || '',
          createdAt: item.createdAt || 0,
          authorName: m.nickName || 'TA',
          authorAvatar: m.avatarUrl || ''
        }
      })
      // 同日历页:fileID 批量换 https 临时链接,保证双方都能看见
      try {
        const files = [...new Set(list.flatMap((d) => [d.photo, d.authorAvatar]).filter((f) => f && String(f).startsWith('cloud://')))]
        if (files.length) {
          const { fileList } = await cloud.getTempFileURL({ fileList: files })
          const urlMap = {}
          ;(fileList || []).forEach((f) => { if (f.fileID && f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
          list.forEach((d) => {
            if (urlMap[d.photo]) d.photoUrl = urlMap[d.photo]
            if (urlMap[d.authorAvatar]) d.authorAvatarUrl = urlMap[d.authorAvatar]
            d.initial = Array.from(d.authorName || 'TA')[0] || '♡'
          })
        } else {
          list.forEach((d) => { d.initial = Array.from(d.authorName || 'TA')[0] || '♡' })
        }
      } catch (e) { console.warn('todayCheckins getTempFileURL failed', e) }
      return { ok: true, list }
    }

    if (action === 'listAnnis') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('anniversaries').where({ coupleId: couple._id }).get()
      return { ok: true, list: data }
    }

    if (action === 'advState') {
      const couple = await requireCouple(user, OPENID)
      const found = await db.collection('adventures').where({ coupleId: couple._id }).get()
      const doc = found.data[0] || null
      let pet = null
      try {
        const pr = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
        pet = pr.data[0] || null
      } catch (e) {}
      // 自愈:版本断层/脏数据/空转的旅途战斗 → 修复,保留属性装备
      let recovered = false
      if (doc) await healContainers(doc)
      if (doc && !(doc.endings || []).length && !(doc.battle && doc.battle.name)) {
        const def = ADV_DEFS[doc.storyId]
        const nodeOk = !!(def && def.nodes[doc.node]) || (doc.node === 'trail' && doc.trail && doc.trail.kind)
        // 旅途战斗却没了战斗对象(旧版逃跑/战败遗留):就地重开本难
        const stuckTrailBattle = doc.node === 'trail' && doc.trail && doc.trail.kind === 'battle'
        if (stuckTrailBattle && doc.journey && (doc.journey.left || 0) > 0 && def) {
          const pr = progressTrail(doc.hp == null ? 100 : doc.hp, doc.gold || 0, { theme: doc.storyId || 'forest', ...doc.journey }, def.start, doc.maxHp || 100)
          const p2 = pr.done
            ? { node: pr.exit || def.start, trail: {}, battle: {}, journey: pr.journey }
            : { node: 'trail', trail: pr.trail, battle: pr.battle || {}, journey: pr.journey }
          await db.collection('adventures').doc(doc._id).update({ data: advWriteData(p2) })
          Object.assign(doc, p2)
          recovered = true
        } else if (stuckTrailBattle && def) {
          // 旅途已到尽头:直接进终章/回起点
          const p2 = { node: def.start, trail: {}, journey: {}, battle: {} }
          await db.collection('adventures').doc(doc._id).update({ data: advWriteData(p2) })
          Object.assign(doc, p2)
          recovered = true
        } else if (!nodeOk && def) {
          await db.collection('adventures').doc(doc._id).update({
            data: advWriteData({ node: def.start, trail: {}, journey: {}, battle: {} })
          })
          doc.node = def.start
          doc.trail = {}
          doc.journey = {}
          recovered = true
        }
      }
      return { ok: true, adv: doc, recovered, pet: pet ? { name: pet.name, species: pet.species, level: pet.level || 1, mood: pet.mood || 0, hunger: pet.hunger || 0, exp: pet.exp || 0 } : null }
    }

    if (action === 'advStart') {
      const couple = await requireCouple(user, OPENID)
      const storyId = ['forest', 'sea', 'star'].includes(event.storyId) ? event.storyId : 'forest'
      const mode = event.mode === 'duo' ? 'duo' : 'solo'
      const found = await db.collection('adventures').where({ coupleId: couple._id }).get()
      for (const d of found.data) {
        try { await db.collection('adventures').doc(d._id).remove() } catch (e) {}
      }
      const add = await db.collection('adventures').add({
        data: {
          _openid: OPENID, coupleId: couple._id, storyId, mode,
          node: 'start', hp: 100, maxHp: 100, atk: 10, gold: 20,
          items: [], flags: {}, log: [], endings: [],
          battle: {}, trail: {}, journey: {},
          partnerJoined: false, createdAt: Date.now(), updatedAt: Date.now()
        }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'advJoin') {
      const couple = await requireCouple(user, OPENID)
      const found = await db.collection('adventures').where({ coupleId: couple._id }).get()
      const doc = found.data[0]
      if (!doc) return fail('还没有冒险,先开一局吧')
      if (doc._openid === OPENID) return fail('这是你自己开的局,等TA加入')
      if (doc.mode !== 'duo') return fail('这是单人局')
      await db.collection('adventures').doc(doc._id).update({ data: { partnerJoined: true, hp: Math.min(doc.maxHp || 100, (doc.hp || 50) + 30), updatedAt: Date.now() } })
      return { ok: true }
    }

    if (action === 'advChoose') {
      const couple = await requireCouple(user, OPENID)
      const found = await db.collection('adventures').where({ coupleId: couple._id }).get()
      const doc = found.data[0]
      if (!doc) return fail('冒险不存在,重新开一局吧')
      await healContainers(doc)
      const res = applyAdvChoice(doc, String(event.choice || ''), OPENID)
      if (!res.ok) return res
      await db.collection('adventures').doc(doc._id).update({ data: advWriteData(res.patch) })
      return { ok: true, adv: { ...doc, ...res.patch }, event: res.event }
    }

    if (action === 'advTrail') {
      const couple = await requireCouple(user, OPENID)
      const found = await db.collection('adventures').where({ coupleId: couple._id }).get()
      const doc = found.data[0]
      if (!doc) return fail('冒险不存在,重新开一局吧')
      await healContainers(doc)
      if ((doc.endings || []).length) return fail('本局已完结')
      if (doc.battle && doc.battle.name) return fail('先打完这场战斗吧')
      const def = ADV_DEFS[doc.storyId]
      if (!def) return fail('剧本不存在')
      const trail = doc.trail
      const journey = doc.journey
      if (!trail || !journey || trail.kind !== 'event') return fail('当前不在事件中,下拉刷新同步一下 ♡')
      const which = event.which === 'b' ? 'b' : 'a'
      const opt = trail[which]
      if (!opt || !opt.label) return fail('这条路走过了,下拉刷新同步一下 ♡')
      const maxHp = doc.maxHp || 100
      if (opt.needGold && (doc.gold || 0) < opt.needGold) return fail(`金币不够,需要 ${opt.needGold} 金`)
      const patch = {
        hp: Math.max(0, Math.min(maxHp, (doc.hp == null ? 100 : doc.hp) + (opt.hp || 0))),
        atk: (doc.atk == null ? 10 : doc.atk) + (opt.atk || 0),
        gold: Math.max(0, (doc.gold || 0) + (opt.gold || 0)),
        log: advLog(doc, { node: 'trail', choice: `trail-${which}`, text: `👉 ${opt.label}`, by: OPENID })
      }
      const nj = { ...journey, left: Math.max(0, (journey.left || 0) - 1) }
      let ev = { type: 'trailResolve', msg: opt.msg || '', hp: opt.hp || 0, gold: opt.gold || 0, atk: opt.atk || 0 }
      const pr2 = progressTrail(patch.hp, patch.gold, nj, (nj.exit || 'start'), maxHp)
      patch.hp = pr2.hp
      patch.gold = pr2.gold
      patch.journey = pr2.journey
      if (pr2.done) {
        patch.node = pr2.exit || 'start'
        patch.trail = null
        const endGot2 = settleTrailExit(def, patch.node, OPENID)
        if (endGot2) {
          patch.endings = [...(doc.endings || []), endGot2]
        }
        ev = { ...ev, trailDone: true, exit: patch.node, ending: endGot2 ? endGot2.name : undefined }
      } else {
        patch.trail = pr2.trail
        ev = { ...ev, depth: pr2.trail.depth, total: pr2.trail.total }
        if (pr2.battle) {
          patch.battle = pr2.battle
          ev = { ...ev, chainedBattle: true }
        }
        if (pr2.rested) ev = { ...ev, rested: true }
      }
      // 分段写库:先标量+旅途进度,再遭遇对象,最后战斗对象。
      // 某段失败直接报段名,一次定位,不再整单猜谜。
      const docId = doc._id
      try {
        await db.collection('adventures').doc(docId).update({
          data: advWriteData({ hp: patch.hp, atk: patch.atk, gold: patch.gold, node: patch.node, journey: patch.journey, log: patch.log })
        })
      } catch (e1) {
        console.error('advTrail stage1(scalars) failed', e1 && e1.message)
        return fail(`标量段写入失败(${(e1 && e1.message) || '未知'})，截图发我定位`)
      }
      try {
        await db.collection('adventures').doc(docId).update({ data: advWriteData({ trail: patch.trail }) })
      } catch (e2) {
        console.error('advTrail stage2(trail) failed', e2 && e2.message, 'kind:', patch.trail && patch.trail.kind, 'eventId:', patch.trail && patch.trail.eventId)
        return fail(`遭遇段写入失败(${(e2 && e2.message) || '未知'})，截图发我定位`)
      }
      if (patch.battle) {
        try {
          await db.collection('adventures').doc(docId).update({ data: advWriteData({ battle: patch.battle }) })
        } catch (e3) {
          console.error('advTrail stage3(battle) failed', e3 && e3.message)
          return fail(`战斗段写入失败(${(e3 && e3.message) || '未知'})，截图发我定位`)
        }
      }
      return { ok: true, adv: { ...doc, ...patch }, event: ev }
    }

    if (action === 'advBattle') {
      const couple = await requireCouple(user, OPENID)
      const found = await db.collection('adventures').where({ coupleId: couple._id }).get()
      const doc = found.data[0]
      if (!doc) return fail('冒险不存在,重新开一局吧')
      await healContainers(doc)
      const move = ['attack', 'defend', 'flee'].includes(event.move) ? event.move : 'attack'
      let petMood = 0
      try {
        const pr = await db.collection('pets').where({ coupleId: couple._id }).limit(1).get()
        if (pr.data[0]) petMood = pr.data[0].mood || 0
      } catch (e) {}
      const res = await applyAdvBattle(doc, move, OPENID, petMood)
      if (!res.ok) return res
      const patch = { ...res.patch }
      delete patch.battleRounds
      await db.collection('adventures').doc(doc._id).update({ data: advWriteData(patch) })
      return { ok: true, adv: { ...doc, ...patch }, event: res.event }
    }

    // 存档自修复:节点非法(不在剧本/旅途对象缺失/无战斗/未完结)则修复,保留数值装备
    if (action === 'advRepair') {
      const couple = await requireCouple(user, OPENID)
      const found = await db.collection('adventures').where({ coupleId: couple._id }).get()
      const doc = found.data[0]
      if (!doc) return fail('还没有开局,先选一条故事线吧')
      await healContainers(doc)
      const def = ADV_DEFS[doc.storyId]
      if (!def) return fail('剧本不存在,结束本局重开吧')
      const nodeOk = !!(def.nodes[doc.node] || (doc.node === 'trail' && doc.trail && doc.trail.kind) || (doc.battle && doc.battle.name))
      const finished = (doc.endings || []).length > 0
      if (nodeOk || finished) return { ok: true, adv: doc, repaired: false }
      // 空转在旅途入口(比如 node=trail 但旅途对象丢失):就地重进旅途,不断档
      const landed = def.nodes[doc.node]
      if (landed && landed.journey) {
        const jr = enterJourney(doc, landed.journey, OPENID, 'repair')
        await db.collection('adventures').doc(doc._id).update({ data: advWriteData(jr.patch) })
        return { ok: true, adv: { ...doc, ...jr.patch }, repaired: true, where: 'trail' }
      }
      // 有未走完的旅途进度:用推进器续上(自动跳过安营,必定落在可玩遭遇)
      if (doc.journey && (doc.journey.left || 0) > 0) {
        const pr = progressTrail(doc.hp == null ? 100 : doc.hp, doc.gold || 0, { theme: doc.storyId || 'forest', ...doc.journey }, def.start, doc.maxHp || 100)
        const patch = {
          node: pr.done ? (pr.exit || def.start) : 'trail',
          hp: pr.hp,
          gold: pr.gold,
          journey: pr.journey,
          trail: pr.done ? {} : pr.trail,
          battle: pr.done ? {} : pr.battle
        }
        await db.collection('adventures').doc(doc._id).update({ data: advWriteData(patch) })
        return { ok: true, adv: { ...doc, ...patch }, repaired: true, where: 'trail' }
      }
      await db.collection('adventures').doc(doc._id).update({
        data: advWriteData({ node: def.start, battle: {}, trail: {}, journey: {}, hp: Math.max(30, doc.hp == null ? 100 : doc.hp) })
      })
      const { data: fresh } = await db.collection('adventures').doc(doc._id).get()
      return { ok: true, adv: fresh || { ...doc, node: def.start, battle: {}, trail: {}, journey: {} }, repaired: true, where: 'start' }
    }

    if (action === 'advAbandon') {
      const couple = await requireCouple(user, OPENID)
      const found = await db.collection('adventures').where({ coupleId: couple._id }).get()
      for (const d of found.data) {
        try { await db.collection('adventures').doc(d._id).remove() } catch (e) {}
      }
      return { ok: true }
    }

    if (action === 'chatUnread') {
      const couple = await requireCouple(user, OPENID)
      const mine = await db.collection('chatReads').where({ coupleId: couple._id, _openid: OPENID }).get()
      const since = mine.data.length ? (mine.data[0].lastReadAt || 0) : (Number(event.since) || 0)
      const { total } = await db.collection('chats').where({
        coupleId: couple._id,
        createdAt: _.gt(since),
        _openid: _.neq(OPENID)
      }).count()
      return { ok: true, count: total || 0 }
    }

    if (action === 'markChatRead') {
      const couple = await requireCouple(user, OPENID)
      const now = Date.now()
      const found = await db.collection('chatReads').where({ coupleId: couple._id, _openid: OPENID }).get()
      if (found.data.length) {
        await db.collection('chatReads').doc(found.data[0]._id).update({ data: { lastReadAt: now } })
      } else {
        await db.collection('chatReads').add({ data: { coupleId: couple._id, _openid: OPENID, lastReadAt: now, createdAt: now } })
      }
      const partner = await db.collection('chatReads').where({ coupleId: couple._id, _openid: _.neq(OPENID) }).get()
      return { ok: true, at: now, partnerReadAt: partner.data.length ? (partner.data[0].lastReadAt || 0) : 0 }
    }

    if (action === 'addDraw') {
      const couple = await requireCouple(user, OPENID)
      const mission = String(event.mission || '').trim().slice(0, 100)
      const icon = String(event.icon || '🎁').slice(0, 8)
      if (!mission) return fail('任务是空的')
      const add = await db.collection('draws').add({
        data: { _openid: OPENID, coupleId: couple._id, mission, icon, done: false, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listDraws') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('draws').where({ coupleId: couple._id }).orderBy('createdAt', 'desc').limit(30).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const doneCount = data.filter((d) => d.done).length
      return { ok: true, list: data.map((d) => ({ ...d, isMine: d._openid === OPENID, byName: (map[d._openid] || {}).nickName || 'TA' })), doneCount, total: data.length }
    }

    if (action === 'doneDraw') {
      const couple = await requireCouple(user, OPENID)
      const { data: doc } = await db.collection('draws').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这颗扭蛋')
      await db.collection('draws').doc(event.id).update({ data: { done: true, doneAt: Date.now() } })
      return { ok: true }
    }

    if (action === 'answerQuiz') {
      const couple = await requireCouple(user, OPENID)
      const round = String(event.round || '').slice(0, 20) || 'love8'
      const qid = Number(event.qid)
      const choice = Number(event.choice)
      if (!(qid >= 0) || !(choice >= 0)) return fail('答案无效')
      // 本轮题面锁定:首个答题人带来的 qids 存档,之后任何人不得更改
      let qids = Array.isArray(event.qids) ? event.qids.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 30) : []
      qids = [...new Set(qids)].slice(0, 8)
      const found = await db.collection('quiz').where({ coupleId: couple._id, round }).get()
      // 并发可能产生多条,合并进最早的一条,其余删除
      const docs = (found.data || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      let doc = docs[0]
      const answers = (doc && doc.answers) || {}
      docs.slice(1).forEach((d) => {
        Object.keys(d.answers || {}).forEach((k) => {
          answers[k] = { ...(answers[k] || {}), ...(d.answers[k] || {}) }
        })
      })
      for (const d of docs.slice(1)) {
        try { await db.collection('quiz').doc(d._id).remove() } catch (e) {}
      }
      if (!doc) {
        if (qids.length !== 8) return fail('先抽取本轮题目')
        const add = await db.collection('quiz').add({
          data: { _openid: OPENID, coupleId: couple._id, round, qids, answers: { [OPENID]: { [qid]: choice } }, createdAt: Date.now(), updatedAt: Date.now() }
        })
        return { ok: true, mine: { [qid]: choice }, qids }
      }
      if ((!doc.qids || !doc.qids.length) && qids.length === 8) {
        await db.collection('quiz').doc(doc._id).update({ data: { qids, updatedAt: Date.now() } })
        doc.qids = qids
      }
      answers[OPENID] = { ...(answers[OPENID] || {}), [qid]: choice }
      await db.collection('quiz').doc(doc._id).update({ data: { answers, updatedAt: Date.now() } })
      return { ok: true, mine: answers[OPENID] || {}, qids: doc.qids || [] }
    }

    if (action === 'quizState') {
      const couple = await requireCouple(user, OPENID)
      const round = String(event.round || '').slice(0, 20) || 'love8'
      const found = await db.collection('quiz').where({ coupleId: couple._id, round }).get()
      if (!found.data.length) return { ok: true, empty: true, mine: {}, partnerCount: 0, qids: [] }
      const docs = found.data.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      const doc = docs[0]
      const answers = {}
      docs.forEach((d) => {
        Object.keys(d.answers || {}).forEach((k) => {
          answers[k] = { ...(answers[k] || {}), ...(d.answers[k] || {}) }
        })
      })
      const total = Math.min(20, Math.max(1, Number(event.total) || 8))
      const mineKeys = Object.keys(answers[OPENID] || {}).length
      const partnerKey = Object.keys(answers).find((k) => k !== OPENID)
      const partnerKeys = partnerKey ? Object.keys(answers[partnerKey] || {}).length : 0
      const complete = mineKeys >= total && partnerKeys >= total
      return {
        ok: true,
        mine: answers[OPENID] || {},
        partnerCount: partnerKeys,
        partnerDone: partnerKeys >= total,
        qids: doc.qids || [],
        both: complete ? answers : null
      }
    }

    if (action === 'resetQuiz') {
      const couple = await requireCouple(user, OPENID)
      const round = String(event.round || '').slice(0, 20) || 'love8'
      const found = await db.collection('quiz').where({ coupleId: couple._id, round }).get()
      for (const d of found.data) await db.collection('quiz').doc(d._id).remove()
      return { ok: true }
    }

    if (action === 'rollDice') {
      const couple = await requireCouple(user, OPENID)
      const options = (Array.isArray(event.options) ? event.options : []).map((o) => String(o).trim().slice(0, 30)).filter(Boolean).slice(0, 8)
      const text = String(event.text || '').trim().slice(0, 60)
      const face = Math.min(6, Math.max(1, Number(event.face) || 1))
      const add = await db.collection('dices').add({
        data: { _openid: OPENID, coupleId: couple._id, face, text, options, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listDice') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('dices').where({ coupleId: couple._id }).orderBy('createdAt', 'desc').limit(20).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      return { ok: true, list: data.map((d) => ({ ...d, isMine: d._openid === OPENID, byName: (map[d._openid] || {}).nickName || 'TA' })) }
    }

    if (action === 'drawCard') {
      const couple = await requireCouple(user, OPENID)
      const kind = event.kind === 'dare' ? 'dare' : 'truth'
      const text = String(event.text || '').trim().slice(0, 120)
      if (!text) return fail('卡片是空的')
      const add = await db.collection('cards').add({
        data: { _openid: OPENID, coupleId: couple._id, kind, text, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listCards') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('cards').where({ coupleId: couple._id }).orderBy('createdAt', 'desc').limit(30).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      return { ok: true, list: data.map((d) => ({ ...d, isMine: d._openid === OPENID, byName: (map[d._openid] || {}).nickName || 'TA' })) }
    }

    if (action === 'sendGoodnight') {
      const couple = await requireCouple(user, OPENID)
      const today = todayKey()
      const word = String(event.word || '').trim().slice(0, 60)
      const found = await db.collection('nights').where({ coupleId: couple._id, dateKey: today }).get()
      // 归并:兼容新结构(doc.words)与旧结构(一人一条)
      const words = {}
      found.data.forEach((d) => {
        if (d.words && typeof d.words === 'object') {
          Object.keys(d.words).forEach((k) => { if (d.words[k] !== undefined) words[k] = d.words[k] })
        } else if (d._openid) {
          words[d._openid] = d.word || '晚安，好梦 ♡'
        }
      })
      if (words[OPENID]) return fail('今晚已经说过晚安啦')
      words[OPENID] = word
      const main = found.data.find((d) => d.words && typeof d.words === 'object') || found.data[0]
      if (main) {
        // 只用 update 合并 words,不碰 _openid 等系统字段
        await db.collection('nights').doc(main._id).update({ data: { words, updatedAt: Date.now() } })
        for (const d of found.data) {
          if (d._id !== main._id) await db.collection('nights').doc(d._id).remove()
        }
      } else {
        await db.collection('nights').add({
          data: { _openid: OPENID, coupleId: couple._id, dateKey: today, words, createdAt: Date.now() }
        })
      }
      return { ok: true }
    }

    if (action === 'listGoodnights') {
      const couple = await requireCouple(user, OPENID)
      const today = todayKey()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const all = await db.collection('nights').where({ coupleId: couple._id }).limit(200).get()
      // 按天归并:兼容新结构(doc.words)与旧结构(一人一条)
      const byDay = {}
      all.data.forEach((d) => {
        const day = d.dateKey
        if (!day) return
        byDay[day] = byDay[day] || {}
        if (d.words && typeof d.words === 'object') {
          Object.keys(d.words).forEach((k) => {
            if (d.words[k] || d.words[k] === '') byDay[day][k] = d.words[k]
          })
        } else if (d._openid) {
          byDay[day][d._openid] = d.word || '晚安，好梦 ♡'
        }
      })
      const todayWords = byDay[today] || {}
      const list = Object.keys(todayWords).map((openid) => ({
        _id: openid,
        _openid: openid,
        isMine: openid === OPENID,
        word: todayWords[openid],
        byName: (map[openid] || {}).nickName || 'TA'
      }))
      let streak = 0
      let cursor = today
      for (let i = 0; i < 200; i += 1) {
        const dayWords = byDay[cursor]
        const both = dayWords && Object.keys(dayWords).length >= 2
        if (both) {
          streak += 1
          cursor = shiftDate(cursor, -1)
        } else {
          break
        }
      }
      return { ok: true, list, mineDone: !!todayWords[OPENID], partnerDone: Object.keys(todayWords).some((k) => k !== OPENID), streak }
    }

    if (action === 'throwBottle') {
      const couple = await requireCouple(user, OPENID)
      const kind = ['wish', 'todo', 'gift'].includes(event.kind) ? event.kind : 'wish'
      const content = String(event.content || '').trim().slice(0, 120)
      if (!content) return fail('先写下心愿再丢哦')
      const icons = { wish: '🌟', todo: '📝', gift: '🎁' }
      const add = await db.collection('wishes').add({
        data: { _openid: OPENID, coupleId: couple._id, kind, icon: icons[kind], content, done: false, createdAt: Date.now() }
      })
      return { ok: true, id: add._id }
    }

    if (action === 'listWishes') {
      const couple = await requireCouple(user, OPENID)
      const { data } = await db.collection('wishes').where({ coupleId: couple._id }).orderBy('createdAt', 'desc').limit(30).get()
      const members = await loadMembers(couple.memberOpenids)
      const map = {}
      members.forEach((m) => { map[m.openid] = m })
      const unfinished = data.filter((d) => !d.done).length
      return {
        ok: true,
        unfinished,
        list: data.map((d) => ({ ...d, isMine: d._openid === OPENID, byName: (map[d._openid] || {}).nickName || 'TA' }))
      }
    }

    if (action === 'grantWish') {
      const couple = await requireCouple(user, OPENID)
      const { data: doc } = await db.collection('wishes').doc(event.id).get()
      if (!doc || doc.coupleId !== couple._id) return fail('找不到这个瓶子')
      if (doc._openid === OPENID) return fail('自己的心愿要等 TA 来实现哦')
      await db.collection('wishes').doc(event.id).update({ data: { done: true, doneAt: Date.now() } })
      return { ok: true }
    }

    return fail('未知操作')
  } catch (err) {
    return fail(err.message || '失败了')
  }
}
