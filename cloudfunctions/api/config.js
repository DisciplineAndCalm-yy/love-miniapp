// 天气数据源配置（部署 api 云函数时生效）
// 填入和风天气 key + 专属 API Host 即用和风;缺任一项则自动回落免 Key 的 wttr.in
// 订阅消息：填入公众平台「订阅消息」里选用的模板 ID 后，互动推送才会发送
// 模板字段：对齐「新留言提醒」thing1=文章标题 / thing2=留言用户 / thing3=留言内容 / date4=留言时间 / time6=发送时间
// 注意：仅体验版时无需改动；代码统一用 miniprogramState = 'trial'
module.exports = {
  qweatherKey: process.env.QWEATHER_KEY || '14fbd1fd464e4dcdb8a9b8d274624721',
  // 专属 API Host:到 https://console.qweather.com/setting 复制(只填域名,不要带 https://)
  // 注意:它是 key 之外的第二重认证,公共域名 devapi/api/geoapi 已于 2026 起逐步停用
  qweatherHost: process.env.QWEATHER_HOST || 'nm3yfg9crr.re.qweatherapi.com',

  // 互动订阅消息模板 ID（「新留言提醒」，与 miniprogram/config.js 的 noticeTmplId 保持一致）
  noticeTmplId: process.env.NOTICE_TMPL_ID || '67fn5dkUn3IC2P5jXFfaMI1oouODhoLJd19rMpxyMRw',
  // 模板字段映射：对齐「新留言提醒」模板
  noticeFields: { title: 'thing1', user: 'thing2', content: 'thing3', date: 'date4', time: 'time6' },
  // 各事件是否推送（省额度：默认只推评论和晚安，点赞/表情/签到默认关）
  noticeEvents: { comment: true, night: true, reaction: false, like: false, checkin: true },

  // 聊天消息订阅消息模板 ID（「聊天消息通知」，与 miniprogram/config.js 的 chatTmplId 保持一致）
  chatTmplId: process.env.CHAT_TMPL_ID || 'fM7noc0HEswxg8bfPKP6kSsUteWwjfciRc9HUAy6b4s',
  // 模板字段映射：对齐「聊天消息通知」模板
  chatFields: { title: 'thing1', count: 'thing2', from: 'thing3', note: 'thing5', time: 'time6' }
}
