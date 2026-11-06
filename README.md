# 个人博客

前后端分离的博客项目，支持邮箱验证码注册登录、管理员/用户权限、文章和评论。另提供唯一站主，用于授权管理员、管理账号和查看邮件额度。

- 源码仓库：https://github.com/weizhiqq0-glitch/personal--blog-
- 在线演示：https://weizhiqq0-glitch.github.io/personal--blog-/
- 管理后台：https://weizhiqq0-glitch.github.io/personal--blog-/#/admin
- 后端健康检查：https://mowu-blog-api-gateway.pages.dev/api/health

## 技术与功能

| 部分 | 技术与功能 |
| --- | --- |
| 前端 | React、Vite；独立管理后台、用户设置浮层、头像、图片/视频背景、文章与扩展板块 |
| 后端 | Node.js、Express REST API；认证与权限由后端执行 |
| 数据库 | 本地 SQLite，线上 Neon PostgreSQL；真实数据不提交仓库 |
| 在线部署 | GitHub Pages 前端 + Pages 免费接口入口 + Cloudflare Workers 后端 + Neon |
| 账号 | 邮箱验证码注册、密码6—14位、用户名唯一、邮箱找回密码 |
| 身份 | 访客、用户、管理员、唯一站主；普通注册不能自选管理身份 |
| 文章 | 管理员/站主发布、编辑、删除；访客阅读 |
| 评论 | 已验证用户发表、删除自己的评论；管理员/站主管理评论 |
| 其他 | 站员、照片墙、音乐、说说、友链、项目、圆盘导航、问题反馈、访客统计、邮件额度、授权天气、定时主题 |

密码保存为加盐哈希；会话令牌随机生成，数据库只保存摘要。文章与评论按纯文本渲染，不执行用户提交的HTML。没有公共默认管理员密码。

## 目录

```text
personal-blog/
├─ README.md              项目介绍
├─ 博客工具.cmd            Windows统一工具箱
├─ frontend/              前端源码、配置、依赖清单
├─ backend/               后端源码、测试、数据库适配、Workers配置
├─ gateway/               Pages免费接口入口，通过内部绑定访问原后端
├─ docs/                  使用、部署、权限、隐私、交付、迁移说明
├─ tools/                 启动、发布、更新后端等双击入口
├─ scripts/               工具使用的PowerShell实现
└─ .github/workflows/     自动测试与GitHub Pages发布
```

日常双击根目录 **博客工具.cmd**。工具按项目相对路径运行；移动整个项目无需改盘符。旧快捷方式搬家后可能需重建。

## 新电脑本地运行

需要 Node.js 24 LTS（24.13以上）和 Git。在项目根目录执行：

```powershell
npm --prefix backend ci
npm --prefix frontend ci
```

双击 `博客工具.cmd` 选择启动，或双击 `tools/启动博客.cmd`。本地网页：http://127.0.0.1:5173/ 。后端默认3000端口，占用时启动器尝试3001—3010。

本地首次启用账号功能：

1. 参考 `backend/.env.example` 创建私密的 `backend/.env`，配置邮件服务；真实密钥不能提交。
2. `npm --prefix backend run admin` 创建自己的本地站主。线上与本地数据库相互独立。
3. `node backend/calibrate-mail.js`，按EmailJS控制台填当前剩余额度、下次重置时间。
4. 登录验证站主邮箱。普通用户正常邮箱注册；管理员由站主在管理页授权。

未配置发信时会拒绝发送，不提供假验证码。首次额度未校准时暂停发信；离线管理工具可先校准，避免站主尚未验证就无法使用网页校准。

## 更新线上网站

1. `tools/更新后端.cmd`：发布到自己的Cloudflare Worker，需已有授权和Secrets。
2. `tools/发布博客.cmd`：检查公开文件、保存提交、推送GitHub，自动构建发布前端。
3. 等待GitHub Actions检查和发布成功，刷新网页验收。

只改文档无需重新部署后端。首次部署见 [Cloudflare免费部署说明](docs/Cloudflare免费部署说明.md)，邮件服务见 [邮箱验证码配置说明](docs/邮箱验证码配置说明.md)。

Git推送脚本的代理参数针对当前电脑7897端口，换电脑后按实际网络调整 `scripts/publish-blog.ps1`。Cloudflare脚本仅发现该代理正在运行时才使用，不修改系统代理。

**GitHub只包含源码，不包含线上账号数据库、私钥或服务商登录授权。** 下载仓库不会取得当前站主权限。

## 检查

```powershell
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend run worker:check
```

Windows可运行 `tools/检查公开文件.cmd`；发布前也自动检查私密文件和常见密钥模式，不能代替完整安全审计。完整Workers/原生PostgreSQL测试需要隔离的 `WORKER_TEST_DATABASE_URL`（GitHub CI提供）；本地未配置会跳过这一项，其余SQLite/PostgreSQL测试照常运行。

## 更多说明

- [头像、背景与 Wallpaper Engine 的使用边界](docs/头像与背景.md)
- [向别人介绍前后端与管理功能](docs/前后端与管理功能说明.md)

新版也可隔离本地测试：双击 `tools/本地测试新版.cmd`，打开 http://127.0.0.1:5189/ ，参见 [本地新版测试](docs/本地新版测试.md)。测试库与线上完全独立。

通过工具发布前端或更新后端时，会先把更新前的 Git 源码版本压缩到 `private/version-backups/`，最多保留最近3个不同版本，超过自动删除最早的压缩包。备份失败则停止更新，同一版本反复运行不会重复占用份数。详见 [版本备份](docs/版本备份.md)。

- [交付与演示顺序](docs/交付说明.md)
- [迁移与备份](docs/迁移与备份.md)
- [隐私与邮件额度](docs/隐私与邮件额度说明.md)
- [账号权限](docs/账号权限说明.md)

当前正文是纯文本，未实现富文本、图片上传或私信。免费服务额度和网络可用性以平台实际状态为准。

新增：标签页标题切换、可关闭的Live2D看板猫、每日60s与B站游乐场入口；站主可配置三次点击月亮的专属登录入口。详见 [新增功能说明](docs/看板猫与每日简报.md)。
