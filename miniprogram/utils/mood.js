const MOOD_MAP = {
  love: '爱你',
  miss: '想你',
  happy: '开心',
  calm: '平静',
  busy: '忙碌',
  sad: '难过'
}

const MOOD_LIST = [
  { id: 'love', label: '爱你', icon: '😍', desc: '甜甜蜜蜜' },
  { id: 'miss', label: '想你', icon: '💭', desc: '满脑子是你' },
  { id: 'happy', label: '开心', icon: '😊', desc: '元气满满' },
  { id: 'calm', label: '平静', icon: '🌿', desc: '岁月静好' },
  { id: 'busy', label: '忙碌', icon: '💼', desc: '为未来打拼' },
  { id: 'sad', label: '难过', icon: '🌧', desc: '求抱抱' }
]

const QUICK_CHECKINS = [
  '今天也超爱你 ♡',
  '想你想到打滚',
  '又是元气满满的一天 ✨',
  '抱抱，辛苦啦 🫂',
  '今晚吃什么呀？🍓',
  '早安晚安都想你 🌙'
]

const TAG_ICON = {
  '吃饭': '🍱', '午睡': '😴', '上厕所': '🚻', '上班': '💼', '通勤': '🚇',
  '运动': '🏃', '追剧': '📺', '出门': '🌳', '日常': '✨'
}

function moodLabel(id) {
  return MOOD_MAP[id] || id || ''
}

function doingIcon(doing) {
  return TAG_ICON[doing] || '💌'
}

function moodOf(id) {
  return MOOD_LIST.find((m) => m.id === id) || null
}

module.exports = {
  MOOD_MAP,
  MOOD_LIST,
  QUICK_CHECKINS,
  TAG_ICON,
  moodLabel,
  moodOf,
  doingIcon
}
