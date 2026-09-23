# 我们 · love-miniapp

一对情侣用的微信小程序脚手架：日常打卡、博客空间、日历、纪念日。数据层按微信云开发设计。

## 打开工程

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 导入目录：`C:\Users\d\love-miniapp`。
3. 填入自己的 AppID（`project.config.json`）。
4. 开通云开发，创建一个环境。
5. 把 `miniprogram/app.js` 里的 `envId` 改成你的环境 ID。
6. 云开发控制台创建集合：`users`、`couples`、`checkins`、`posts`、`anniversaries`。
7. 上传并部署云函数 `login`、`bindCouple`。
8. 权限规则可参考 `database/rules.json`，索引参考 `database/indexes.json`。

本机当前没有安装 Git。需要版本管理时，装好 Git 后在本目录执行 `git init` 即可。

## 功能入口

| 页面 | 作用 |
| --- | --- |
| 首页 | 在一起天数、双方今日打卡、下一纪念日 |
| 打卡 | 心情 + 一句话 + 照片 |
| 日历 | 月视图，叠加打卡和纪念日 |
| 空间 | 共同博客 |
| 我们 | 绑定邀请码、纪念日、昵称 |

更完整的产品与表结构见 [DESIGN.md](./DESIGN.md)。
