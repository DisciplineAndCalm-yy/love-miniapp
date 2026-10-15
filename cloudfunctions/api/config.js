// 天气数据源配置（部署 api 云函数时生效）
// 填入和风天气 key + 专属 API Host 即用和风;缺任一项则自动回落免 Key 的 wttr.in
module.exports = {
  qweatherKey: process.env.QWEATHER_KEY || '14fbd1fd464e4dcdb8a9b8d274624721',
  // 专属 API Host:到 https://console.qweather.com/setting 复制(只填域名,不要带 https://)
  // 注意:它是 key 之外的第二重认证,公共域名 devapi/api/geoapi 已于 2026 起逐步停用
  qweatherHost: process.env.QWEATHER_HOST || 'nm3yfg9crr.re.qweatherapi.com'
}
