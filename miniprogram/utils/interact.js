// 点赞 / 评论 / 未读 的前端封装(targetType: 'moment' | 'post' | 'checkin')
const { callApi } = require('./cloud')

function toggleLike(targetType, targetId) {
  return callApi('toggleLike', { targetType, targetId })
}

function toggleReaction(targetType, targetId, emoji) {
  return callApi('toggleReaction', { targetType, targetId, emoji })
}

function addComment(targetType, targetId, content, replyTo, replyToName) {
  return callApi('addComment', { targetType, targetId, content, replyTo: replyTo || '', replyToName: replyToName || '' })
}

function removeComment(id) {
  return callApi('removeComment', { id })
}

// 打开某条内容时调用:会顺带把它标记为已读
function listInteractions(targetType, targetId) {
  return callApi('listInteractions', { targetType, targetId }, { silent: true })
}

function markRead(targetType, targetId) {
  return callApi('markInteractionRead', { targetType, targetId }, { silent: true })
}

// 未读汇总:total / byType / recent
function summary() {
  return callApi('interactionSummary', {}, { silent: true })
}

// 相对时间,用于评论列表
function relativeTime(ts) {
  const n = Number(ts) || 0
  if (!n) return ''
  const diff = Date.now() - n
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  const d = new Date(n)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 把评论数组补上 timeText
function decorateComments(comments) {
  return (comments || []).map((c) => ({ ...c, timeText: relativeTime(c.createdAt) }))
}

module.exports = { toggleLike, toggleReaction, addComment, removeComment, listInteractions, markRead, summary, relativeTime, decorateComments }
