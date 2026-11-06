# 个人博客

一个 React + Express 前后端分离的博客基础项目。

## 目前可以做什么

- 首页、文章示例卡片、关键词搜索。
- 日间和夜间主题切换、手机布局。
- Express 健康检查接口。

当前文章与统计为前端示例数据；阅读按钮、联系邮箱为占位内容。尚未实现数据库、注册登录、管理员权限和评论。后端文章接口目前返回空数组。

## 项目目录

| 位置 | 作用 |
| --- | --- |
| frontend/src/App.jsx | 页面内容和 React 交互 |
| frontend/src/App.css | 页面布局、颜色与响应式样式 |
| frontend/src/index.css | 全站基础样式 |
| frontend/src/main.jsx | React 应用入口 |
| frontend/public | 无需编译的静态文件 |
| frontend/vite.config.js | Vite 开发和构建配置 |
| backend/server.js | Express 服务器和接口 |
| scripts/start-blog.ps1 | Windows 本地一键启动脚本 |
| 启动博客.cmd | 双击启动入口 |
| 启动说明.md | 一键启动使用方法 |
| package.json | 各子项目依赖和运行命令 |
| package-lock.json | 锁定依赖版本 |
| .gitignore | 阻止依赖目录、构建产物和环境配置进入 Git |

## 本地运行

安装 Node.js 24 LTS 和 Git。第一次下载项目后分别安装依赖：

```powershell
npm --prefix frontend ci
npm --prefix backend ci
```

Windows 下双击“启动博客.cmd”即可。也可打开两个终端分别运行：

```powershell
cd frontend
npm run dev
```

```powershell
cd backend
npm run dev
```

前端通常为 http://localhost:5173；后端默认为 http://localhost:3000/api/health。一键启动器遇到后端端口占用时会选择 3001-3010 中可用的端口，以终端显示为准。

## 发布网页到 Vercel

1. 在 Vercel 导入本 GitHub 仓库。
2. Root Directory 选择 frontend。
3. Framework Preset 选择 Vite。
4. Build Command 使用 npm run build，Output Directory 使用 dist。
5. 点击 Deploy，完成后获得公网网址。

目前网页不依赖后端，部署前端即可访问当前展示版。部署后网站由云平台运行，不需要保持个人电脑开机。后续加入账号和评论时，另外部署 backend 并配置数据库、环境变量和允许访问的前端域名。

## 搬到新电脑或服务器

通过 Git 克隆整个仓库，在前后端分别执行 npm ci。不要复制 node_modules，依赖会根据锁文件重新安装。环境变量需要在部署平台单独设置，密码等私密配置不要提交到仓库。

本地开发启动器不用于生产服务器；生产部署应构建前端，并为后端设置正式启动命令和进程管理。
