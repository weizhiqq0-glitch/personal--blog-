# GitHub 与开源工具（本地新版）

本批功能已准备发布。正式入口：博客 `#/github`、`#/github-search`、`#/tools`、`#/folia`；独立播放器 https://mowu-folia.mowu-weizhi.workers.dev/ 。线上曲库、AI 与同步仍未配置。

## 怎么打开

1. 关闭旧的本地测试窗口，再双击 `tools/本地测试新版.cmd`。
2. 打开 http://127.0.0.1:5189/#/github 。顶栏有 GitHub 入口。
3. 点“搜索 GitHub 项目”，输入关键词。点项目标题，在小站里读 README。
4. 工具箱在 `#/tools`，可转换 JPG、PNG、WebP；文件只在本机浏览器处理。
5. Folia 在 `#/folia`。新版统一启动器会同时启动已安装的 Folia，再点“打开 Folia 播放器”。单独启动也可运行 `tools/启动Folia.cmd`。

## 搜索的范围与国内访问

这是公开仓库资料浏览器，不是整个 GitHub 镜像。前端通过自己的博客后端查询官方 GitHub API，访客无需直接连接 GitHub 即可看搜索结果和 README；打开原仓库、Git 克隆和发行包下载仍需访问 GitHub。

未接入第三方下载代理，不接收 GitHub 密码或令牌。README 按纯文本显示，不执行 HTML，不加载外部图片。关键词和仓库名会发送给 GitHub，请不要输入私密资料。

国内实际体验取决于用户能否访问博客前端/API入口，以及后端能否访问 GitHub。当前本地实测使用本机已有网络代理，不能由此保证国内所有网络稳定可用。上线后应使用国内手机网络再验收。

分类数据每个后端实例缓存6小时；搜索/详情缓存30分钟，最多40条；合并重复请求，同时最多3个上游请求。每IP每实例每10分钟最多30次搜索/详情请求。上游限流时冷却重试，这些内存限制不是跨所有实例共享的全局额度保证。未配置 GitHub Token，受官方匿名 API 额度限制。

热门、新兴、经典分类的条件写在页面上，按累计 Star 排序，不代表使用人数、推荐人数或官方 Trending。GitHub 不可用时明确展示旧数据或精选快照及采集时间。

## 接入了什么

| 项目 | 当前状态 |
| --- | --- |
| KnifeLemon/Filee（MIT） | 完成适配评估。原版依赖桌面/.NET及本地转换引擎，未冒充网页版；站内提供独立图片转换工具。 |
| chthollyphile/folia-major（AGPL-3.0） | 原版固定版本本地运行，独立服务和页面入口，未修改上游代码。已看到原版音乐库与本地导入入口；未验证实际歌曲播放，也未配置在线曲库、AI或同步服务。 |
| elysia395/dsh-wallpaper-engine（MIT） | 候选方案，依赖 DSH 宿主和本地文件服务，不是网页可直接读取 Steam 工坊的组件。现有后台图片/视频背景保留；未接入任意工坊场景。 |
| HelloGitHub / awesome-selfhosted / free-for-dev / it-tools | 已添加站内仓库说明入口，作为查找成熟方案的工具合集。各子项目许可仍须单独核对。 |

## Folia 迁移与许可证

原版源码与依赖在 `integrations/folia/source/`，不提交到博客仓库；版本与源码压缩包校验值在 `integrations/folia/upstream.json`。迁移整个博客文件夹可保留它；新机器只拿博客仓库时，启动脚本从官方固定版本重新下载并校验，再安装锁定依赖（禁用安装脚本）。需 Node.js 24、npm、tar及能访问 GitHub/npm 的网络。需要代理时在启动终端设置自己的 HTTPS_PROXY；脚本不修改系统代理。

Folia 是独立应用，不接收博客登录令牌。本地仅监听127.0.0.1:5191；关闭启动窗口即停止。线上独立播放器已部署，前端工作流已设置公开的 `VITE_FOLIA_URL=https://你的播放器地址/`，并重新构建前端。这个地址不是密钥。

保留 AGPL-3.0 及上游版权，向访问者提供对应完整源码：

- 上游：https://github.com/chthollyphile/folia-major
- 固定版本：https://github.com/chthollyphile/folia-major/tree/4b1e7b3e879e93e00ba9bbd4c5574c172aeadfc4
- 对应源码：https://github.com/chthollyphile/folia-major/archive/4b1e7b3e879e93e00ba9bbd4c5574c172aeadfc4.tar.gz
- 许可证：https://github.com/chthollyphile/folia-major/blob/4b1e7b3e879e93e00ba9bbd4c5574c172aeadfc4/LICENSE

首次开发加载 Folia 较慢，缺在线服务时显示“还没有连接在线平台”是预期状态。在线音乐平台接口需要独立配置，不使用访客的博客账号自动登录。

## 其余本批变化

绿色星星眼睛会眨眼，浏览器标签图标也会眨眼；用户启用减少动态效果时停止动画，页面隐藏时暂停 favicon 动画。原有站主头像同步、美化样式、看板猫、文章和管理权限保留。

恢复美化只需移除 main.jsx 的 Beautify.css 引入；不要整份覆盖 App.jsx，以免丢失功能。
