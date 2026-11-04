// 主题皮肤 & 挂件定义（纯前端，颜色用内联 style 套用，配合页面根节点主题 class）
const THEMES = [
  {
    id: 'sakura',
    name: '粉樱',
    emoji: '🌸',
    desc: '甜甜的恋爱味',
    palette: {
      bg: '#FFF1F4', bg2: '#FFE1EA', card: '#FFFFFF', text: '#7A5A5F', sub: '#B79A9E',
      accent: '#E14E68', accent2: '#C9405A', soft: '#FFECF1', ring: '#FBE0E4'
    }
  },
  {
    id: 'night',
    name: '星夜',
    emoji: '✨',
    desc: '安静的二人宇宙',
    palette: {
      bg: '#1B1B2A', bg2: '#2A2440', card: '#2C2A44', text: '#E7E3F5', sub: '#9C97BE',
      accent: '#9B8CFF', accent2: '#7C6BF0', soft: '#332F52', ring: '#453F6B'
    }
  },
  {
    id: 'cream',
    name: '奶油',
    emoji: '🍦',
    desc: '温柔的日常感',
    palette: {
      bg: '#FFF9F0', bg2: '#FBEAD0', card: '#FFFFFF', text: '#6E5B4A', sub: '#B39C86',
      accent: '#E0A458', accent2: '#C98A38', soft: '#FDF1DC', ring: '#F1E0C4'
    }
  }
]

const PENDANTS = [
  { id: '', name: '无', emoji: '' },
  { id: 'heart', name: '爱心', emoji: '❤️' },
  { id: 'star', name: '星星', emoji: '⭐' },
  { id: 'crown', name: '皇冠', emoji: '👑' },
  { id: 'moon', name: '月亮', emoji: '🌙' },
  { id: 'sakura', name: '樱花', emoji: '🌸' }
]

function themeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

function pendantById(id) {
  return PENDANTS.find((p) => p.id === id) || PENDANTS[0]
}

module.exports = { THEMES, PENDANTS, themeById, pendantById }
