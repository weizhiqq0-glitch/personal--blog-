# 我的个人博客 · 使用说明

新版账号规则与配置以 [账号权限说明.md](账号权限说明.md) 为准：新密码6—14位，邮箱验证码绑定，访客/用户/管理员/站主四种身份；管理员由站主在网页授权。旧账号保留，需补绑邮箱后才能启用操作权限。

## 已完成功能

这是前后端分离的博客基础版。React 负责网页，Express 提供 REST API；本机默认使用 SQLite，免费线上部署使用 Neon PostgreSQL，保存用户、文章、评论和登录会话。

当前不绑卡的免费上线方案请按 [Cloudflare免费部署说明.md](Cloudflare免费部署说明.md) 操作：GitHub Pages 托管前端、Cloudflare Workers 运行后端、Neon 保存数据库。Windows 双击 deploy-free-backend.cmd 引导部署。

原来的 Render 方案见 [免费部署说明.md](免费部署说明.md)，但实际注册部署时可能要求银行卡验证，因此目前优先使用 Cloudflare。

| 身份 | 可以做什么 |
| --- | --- |
| 访客 | 浏览、搜索文章、阅读评论、注册、登录 |
| 普通用户 | 访客功能、发表评论、删除自己的评论、退出 |
| 管理员 | 用户功能、管理文章和评论、封禁普通用户及浏览器访客 |
| 站主 | 全部能力、授权或限制其他账号权限、管理用户与管理员身份 |

前端按钮根据身份显示，后端会再次校验权限。注册接口不能指定管理员角色。没有公共默认管理员密码。

## 一、启动

要求 Node.js 24.13 或更新的 24 LTS 版本。首次下载时，在项目根目录执行：

```powershell
npm --prefix frontend ci
npm --prefix backend ci
```

Windows 双击“启动博客.cmd”或已有“启动我的博客”快捷方式。它会启动两个终端并打开网页。如果旧版本服务仍在运行，请先关闭旧的 Blog Frontend / Blog Backend 窗口，再双击启动。

- 网页：http://127.0.0.1:5173/
- 后端默认端口：3000；如果占用，启动器在3001—3010中选择可用端口。
- 启动器把当前后端地址写入 frontend/.env.local，Vite 将 /api 请求转发给后端。
- 关闭两个终端即可停止服务。数据库文件保留。

也可以手动在两个终端分别启动：

```powershell
npm --prefix backend run dev
```

```powershell
npm --prefix frontend run dev
```

手动启动时确保 frontend/.env.local 中 BLOG_BACKEND_URL 与后端实际端口一致。否则在 frontend/.env.local 中写 BLOG_BACKEND_URL=http://127.0.0.1:3000。

## 二、创建你自己的站主账号

打开项目目录中的 PowerShell，运行：

```powershell
npm --prefix backend run admin
```

按提示输入用户名、预留邮箱、6—14位密码并确认。密码输入不会显示。用户名2—32位，可用中文、字母、数字、下划线或短横线。此命令只在自己的电脑/服务器运行，创建或认领唯一站主，不提供公开提权接口。

先按 [账号权限说明.md](账号权限说明.md) 配置真实发信服务，再登录站主账号，收取验证码并验证预留邮箱，激活站主权限。普通注册仅创建用户；管理员由站主在网页“账号管理”里授权。旧账号补绑邮箱前仅保留基础浏览权限。

忘记密码可在登录弹窗点击“忘记密码”，通过绑定邮箱验证后重设密码，旧会话会失效。不要通过重复创建账号找回站主。

## 三、发表文章与评论

1. 管理员登录 → 写文章 → 输入标题、正文和标签 → 保存并发布。
2. 文章列表点击“阅读”打开正文；管理员可以编辑或删除。
3. 普通用户注册/登录后，打开文章，在评论框发表内容。
4. 评论作者能删除自己的评论，管理员能删除任意评论。
5. 删除文章会连同它的评论一起删除，页面会先要求确认。

当前正文和评论按纯文本显示，保留换行，不执行 HTML。已支持邮箱验证和邮箱找回密码；暂未提供图片上传、草稿、评论审核或富文本编辑器。登录会话有效期7天，当前浏览器标签页关闭后需重新登录；退出会使该会话立即失效。

## 四、每个文件是干什么的

| 文件/目录 | 作用 |
| --- | --- |
| frontend/src/App.jsx | 首页、登录注册、文章编辑、详情和评论界面 |
| frontend/src/api.js | 调用后端接口，附带当前用户的会话令牌 |
| frontend/src/App.css | 博客样式和手机布局 |
| frontend/src/index.css | 全局样式 |
| frontend/src/main.jsx | React 入口 |
| frontend/vite.config.js | 开发代理、构建资源路径 |
| frontend/.env.example | 前端配置示例，可复制为 .env.local |
| backend/server.js | 读取环境配置并启动后端 |
| backend/app.js / backend/api.js | 本机入口及共用文章、评论 REST API |
| backend/accounts.js / backend/permissions.js | 邮箱账号、角色、授权、封禁与后端权限检查 |
| backend/email.js / backend/verification.js | 真实邮件发送适配和验证码有效期、尝试次数控制 |
| frontend/src/ManagementPanel.jsx | 站主和管理员账号管理面板 |
| backend/database.js | 建表、数据库连接、密码哈希和令牌哈希 |
| backend/create-admin.js | 交互式创建或认领唯一站主（保留旧文件名） |
| backend/data/blog.sqlite | 实际数据库，首次启动自动生成，不上传 GitHub |
| backend/.env.example | 后端配置示例，可复制为 .env |
| backend/test/blog.test.js | 注册、权限、文章、评论和持久化集成测试 |
| scripts/start-blog.ps1 | Windows 一键启动器 |
| 启动博客.cmd | 双击启动入口 |
| .github/workflows/pages.yml | GitHub Actions 自动构建发布前端 |
| package.json / package-lock.json | 子项目运行命令和依赖版本 |

本机密码使用随机盐和 scrypt；Workers 使用数据库 pgcrypto 的 bcrypt，并先对完整密码做 SHA-256。数据库不保存明文密码。随机会话令牌只在登录时返回，后端数据库保存的是令牌摘要。

## 五、后端接口

| 接口 | 用途/权限 |
| --- | --- |
| GET /api/health | 健康检查 |
| POST /api/auth/verification-code | 发送邮箱验证码 |
| POST /api/auth/register | 验证邮箱并注册普通用户 |
| POST /api/auth/contact | 旧账号验证绑定邮箱 |
| POST /api/auth/password/reset | 邮箱验证后重置密码 |
| GET /api/management/users | 有管理权限的账号查询成员 |
| PATCH /api/management/users/:id | 仅站主调整角色与具体权限 |
| POST /api/auth/login | 登录 |
| GET /api/auth/me | 当前登录用户 |
| POST /api/auth/logout | 注销当前会话 |
| GET /api/stats | 真实文章、评论、成员数量 |
| GET /api/articles | 文章列表 |
| GET /api/articles/:id | 文章详情 |
| POST /api/articles | 管理员发布 |
| PUT /api/articles/:id | 管理员修改 |
| DELETE /api/articles/:id | 管理员删除 |
| GET /api/articles/:id/comments | 评论列表 |
| POST /api/articles/:id/comments | 登录用户评论 |
| DELETE /api/comments/:id | 本人或管理员删除评论 |

登录后的请求使用 Authorization: Bearer 会话令牌。JSON 请求需要 Content-Type: application/json。登录注册每个来源15分钟最多30次，单个用户每分钟最多10条评论。

## 六、如何让别人使用完整网站

GitHub 保存源代码。GitHub Pages 只能发布前端，不能运行本项目的账号数据库和 Express 后端。此版本上线必须同时安排一个可持续运行的后端。

可以先在本机用完整功能，确定后再选择后端平台或云服务器。SQLite 适合本项目初期单机使用，不用另外注册数据库服务。服务器需有持久磁盘，不能把数据库放在重部署会清空的临时文件系统。

部署后端时：

1. 克隆整个项目，在 backend 目录执行 npm ci --omit=dev。
2. 参考 backend/.env.example 配置 PORT、HOST=0.0.0.0、DB_PATH（持久磁盘绝对路径）。
3. CORS_ORIGINS 设置成 https://weizhiqq0-glitch.github.io（只包含协议和主机，不能带仓库路径）。多个站点以逗号分隔。
4. 通过 npm start 运行，并使用平台或反向代理提供 HTTPS。
5. 在同一 DB_PATH 配置下运行 npm run admin 创建或认领站主，并配置邮件服务、验证预留邮箱。本机数据库不会自动同步到服务器。
6. 一个 SQLite 文件由单个后端实例管理。备份和搬家时先停止后端，再复制整个 backend/data 目录；若设置了 DB_PATH，则备份对应数据库及相关文件。

部署 GitHub Pages 前端时：

1. 在仓库 Settings → Secrets and variables → Actions → Variables 新建仓库变量 VITE_API_URL，值为后端 HTTPS 域名，例如 https://api.example.com。不要附加 /api，也不要填密码或密钥。
2. Settings → Pages 的 Source 选择 GitHub Actions。
3. 运行 Deploy blog to GitHub Pages 工作流，或推送 main。
4. 前端网址：https://weizhiqq0-glitch.github.io/personal--blog-/

不配置公网后端时，线上界面会明确提示尚未连接后端。不会伪造成功注册、文章或评论。后端域名确定之后重新构建前端，VITE_ 变量会被打包公开。

## 七、检查与版本管理

```powershell
npm --prefix backend test
npm --prefix frontend run lint
npm --prefix frontend run build
```

测试使用系统临时目录中的隔离数据库，不改动真实账号和文章。node_modules、dist、环境配置和数据库已被 .gitignore 排除，不能手工上传包含密码的 .env 文件。

当前本机可完整使用。下一次上传这些代码会触发前端自动发布；请先配置 VITE_API_URL 和后端，避免用未连接后端的新页面替换旧展示页。

## 界面更新：登录注册弹窗

首页右上角点击“登录”或“加入小站”，会打开独立弹窗，不再把表单插入文章列表。登录/注册可在弹窗中切换。注册需要再次确认密码，支持密码显隐；登录失败在弹窗内提示。Esc、关闭按钮或点击遮罩均可关闭；提交中会避免重复操作。移动端使用单栏布局，夜间模式同步适配。

- frontend/src/AuthDialog.jsx：登录注册弹窗、表单和焦点管理。
- frontend/src/Icon.jsx：本站使用的 SVG 图标。
- 从评论区打开登录不会丢失当前文章，成功后可以接着评论。
- 首页与弹窗的山景由 CSS 绘制，不依赖参考网站的图片或账号资源。

视觉参考： https://www.paeardog.top/ 、其友链中的 https://www.yujingblog.top/ 。借鉴柔和配色、背景层次、独立入口和卡片留白，使用自己的布局和绘图。
