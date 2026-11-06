@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在保存博客改动...
git add .
if errorlevel 1 goto failed
git diff --cached --quiet
if errorlevel 2 goto failed
if not errorlevel 1 goto push
git commit -m "更新博客界面与账号文章评论功能"
if errorlevel 1 goto failed
:push
echo 正在上传 GitHub。如果弹出登录或授权窗口，请完成授权。
git -c http.sslBackend=openssl -c http.proxy=http://127.0.0.1:7897 push -u origin main
if errorlevel 1 goto failed
echo.
echo 上传成功！GitHub Pages 将自动构建发布，通常需要几分钟。
echo 查看进度：https://github.com/weizhiqq0-glitch/personal--blog-/actions
echo 网站：https://weizhiqq0-glitch.github.io/personal--blog-/
echo 注意：公网账号与评论需要另行部署后端。
pause
exit /b 0
:failed
echo.
echo 发布尚未成功。请保留本窗口，并把上面的错误发给我。
echo 不要删除项目，也不要使用强制推送。
pause
exit /b 1
