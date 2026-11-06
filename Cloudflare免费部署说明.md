# 免费后端：Cloudflare Workers + Neon

这是不绑银行卡方向的部署方案。前端继续放 GitHub Pages，后端使用 Workers Free，数据库继续使用已经创建的 Neon Free。使用平台提供的 workers.dev 网址即可上线，域名可以以后再绑定。Render 的配置不再是当前部署步骤。

账号升级须先阅读 [账号权限说明.md](账号权限说明.md)：新密码6—14位；创建唯一站主并验证预留邮箱，管理员由站主授权。

## 最少需要的操作

1. 注册并验证 Cloudflare 邮箱，登录 https://dash.cloudflare.com/ 。保持 Workers Free，无需购买域名或升级付费。
2. 在 Neon 的 Connect 弹窗复制完整 PostgreSQL 连接串，开启 Connection pooling。连接串包含密码，自己保管。
3. 在项目根目录双击 deploy-free-backend.cmd。首次选择1；本次账号规则升级选择1迁移数据库并创建或认领站主；新版站主已准备好才选2。
4. 工具会检查部署包。首次部署时，需要粘贴 Neon 连接串并输入站主用户名、预留邮箱、6—14位密码和确认密码。密码和连接串输入都不显示。工具将初始化 Neon 的表及 pgcrypto 扩展，并创建或认领唯一站主。
5. 工具打开 Cloudflare 授权页面时，在自己的账号中允许 Wrangler 操作。网页已经登录也需要这次命令行授权。
6. 发布工具要求 secret 值时，再次粘贴完整 Neon 连接串。它存为 Cloudflare 加密 Secret，不会写入仓库。
7. 成功后保留输出的 https://personal-blog-api.你的子域名.workers.dev 公开网址。
8. 打开“公开后端网址/api/health”。返回 ok: true、version: 2 代表后端可以连接数据库。第一次访问 Neon 可能需要等待唤醒。

如果 Cloudflare 提示创建 workers.dev 子域名，可选择一个自己喜欢且尚未占用的英文名称；这是免费平台子域名，不是购买域名。如果出现付费或银行卡要求，先核实是否误入 Workers Paid、域名注册或其他产品，不必完成付款。

## 连接现有 GitHub Pages 前端

1. 打开 https://github.com/weizhiqq0-glitch/personal--blog-/settings/variables/actions 。
2. 添加或修改仓库 Variable：VITE_API_URL，值为上一步的 HTTPS 后端根网址，不带 /api。
3. 仓库 Actions 中运行 Deploy blog to GitHub Pages 工作流，等它完成。
4. 打开 https://weizhiqq0-glitch.github.io/personal--blog-/ ，配置下述邮件服务后，用站主账号登录并验证预留邮箱，再发文章；普通用户通过邮箱验证码注册、评论。
5. 双击已经修复的“发布博客.cmd”把当前代码上传 GitHub，保存本次后端改动。不要手工上传数据库或私密配置。

## 文件与配置的作用

| 文件 | 用途 |
| --- | --- |
| backend/api.js | 本机与 Cloudflare 共同使用的 Express 接口和权限逻辑 |
| backend/app.js | 本机 Node.js 入口适配，保留 SQLite 开发方式 |
| backend/worker.mjs | Cloudflare Workers 入口，使用官方 Node HTTP 适配运行 Express |
| backend/neon.js | 通过 HTTPS 访问 Neon，无需常驻服务器或 TCP 连接池 |
| backend/postgres.js | 共用 SQL 语句和数据库表结构 |
| backend/online-security.js | 线上密码哈希与持久化登录频率限制 |
| backend/security.js | 本机密码哈希、令牌摘要、格式检查 |
| backend/wrangler.jsonc | Worker 名称、入口、兼容日期、允许的前端域名 |
| scripts/deploy-free-backend.ps1 | Windows 引导部署工具 |
| deploy-free-backend.cmd | 双击部署入口 |

数据库需要 DATABASE_URL 私密配置；真实邮件验证现改用 EmailJS，需要 EMAILJS_SERVICE_ID、EMAILJS_TEMPLATE_ID、EMAILJS_PUBLIC_KEY、EMAILJS_PRIVATE_KEY。先按 [邮箱验证码配置说明.md](邮箱验证码配置说明.md) 连接邮箱并配置模板，再双击 configure-email.cmd 配置并重部署。必须实际收到验证码后再开放注册，详情见账号权限说明。CORS_ORIGINS 和 EMAIL_PROVIDER 已写在 wrangler.jsonc 中。Node 服务器使用的 HOST、PORT、NODE_VERSION、TRUST_PROXY_HOPS 等 Render 环境变量不需要搬过来。

## 密码和数据

Workers Free 对每个请求的 CPU 时间有限制。线上密码使用数据库 pgcrypto 的 bcrypt，工作因子12；先对完整密码做 SHA-256 再 bcrypt，避免 bcrypt 的72字节限制截断长密码。密码验证的计算由 Neon 完成，Worker 只进行轻量处理和 HTTPS 查询。数据库不保存明文密码。

线上账号都使用这一密码格式。不要把以前的本机 SQLite 文件直接当作 Neon 数据库上传；本机旧账号和文章保持原样，线上是独立数据。若需要迁移，另外安排格式和账号迁移。本机 scrypt 哈希不能直接用于当前 Workers 密码验证。

登录会话仍使用随机令牌，数据库保存令牌摘要。普通用户注册无法获得管理员角色。线上登录/注册频率限制存入 Neon，不依赖临时 Worker 实例内存。

## 免费额度与更新

Workers Free 和 Neon Free 都有额度限制，不承诺无限使用或永久政策不变。根据官方文档，Workers Free 当前每天10万次请求、每请求10毫秒 CPU 时间。网络等待不计入 CPU 时间，免费额度足够与否需要观察自己的访问量和请求指标；超额不必自动升级付费。

Neon 仍有数据库计算、存储、流量额度，数据库会在闲置后暂停计算，下次查询自动唤醒。定期备份重要数据，备份不要存到公开仓库。

后续代码更新可以在 backend 目录执行 npm run worker:deploy。只改代码时不必重新创建站主或重设数据库连接串。当前一键工具用于首次部署及配置恢复。

官方参考：

- https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://neon.com/docs/serverless/serverless-driver
- https://neon.com/docs/extensions/pgcrypto
