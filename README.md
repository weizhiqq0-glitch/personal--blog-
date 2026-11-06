# 个人博客项目

这是一个前后端分离的个人博客，所有内容放在同一个项目目录中，方便以后搬到服务器。

## 目录

- frontend：React 前端页面
- backend：Express 后端接口
- README.md：中文说明书

## 启动前端

cd frontend
npm run dev

浏览器打开 http://localhost:5173。

## 启动后端

打开另一个终端：

cd backend
npm run dev

浏览器打开 http://localhost:3000/api/health，看到 JSON 就表示后端正常。

## 文件说明

- frontend/src/App.jsx：博客页面结构和交互
- frontend/src/App.css：博客页面样式
- frontend/src/index.css：全局基础样式
- backend/server.js：后端服务器和 API 接口
- package.json：依赖和启动命令

当前是基础展示版，文章数据暂时写在前端代码中。下一步再接入数据库、注册登录、管理员权限和评论系统。

