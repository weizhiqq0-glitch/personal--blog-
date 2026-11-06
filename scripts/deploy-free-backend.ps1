param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectRoot 'backend'
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '没有找到 Node.js。' }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw '没有找到 npm。' }
    foreach ($name in @('worker.mjs', 'wrangler.jsonc', 'create-admin.js')) {
        if (-not (Test-Path -LiteralPath (Join-Path $backendPath $name))) { throw "缺少后端文件：$name" }
    }
    if ($CheckOnly) { Write-Host '检查通过：部署入口、项目路径、Node.js 和 npm 均正常。'; exit 0 }
    Set-Location -LiteralPath $backendPath
    # Only use the user's known local proxy when it is running. These variables
    # live in this launcher process; no global proxy configuration is changed.
    $proxyProbe = New-Object System.Net.Sockets.TcpClient
    try {
        $connection = $proxyProbe.ConnectAsync('127.0.0.1', 7897)
        if ($connection.Wait(500) -and $proxyProbe.Connected -and -not $env:HTTPS_PROXY) {
            $env:HTTPS_PROXY = 'http://127.0.0.1:7897'
            $env:HTTP_PROXY = 'http://127.0.0.1:7897'
            $env:NO_PROXY = 'localhost,127.0.0.1,::1'
            $env:NODE_USE_ENV_PROXY = '1'
            Write-Host '已为本次部署启用本机7897代理。'
        }
    } catch { } finally { $proxyProbe.Dispose() }
    if (-not (Test-Path 'node_modules\wrangler\bin\wrangler.js') -or -not (Test-Path 'node_modules\@neondatabase\serverless')) {
        Write-Host '正在安装部署工具……'
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw '安装依赖失败。请截图上方错误。' }
    }
    Write-Host '正在验证 Cloudflare 部署包……'
    npm.cmd run worker:check
    if ($LASTEXITCODE -ne 0) { throw '部署包检查失败，尚未发布。请截图上方错误。' }
    Write-Host ''
    Write-Host '1 = 首次部署或升级账号体系：初始化数据库并创建/认领站主'
    Write-Host '2 = 已经创建过新版站主，继续部署'
    $choice = Read-Host '请输入 1 或 2'
    if ($choice -eq '1') {
        Write-Host '请输入 Neon 连接串、站主账号和预留邮箱。新密码为6—14位，连接串及密码输入不显示。'
        node create-admin.js --remote
        if ($LASTEXITCODE -ne 0) { throw '站主预创建尚未成功，请保留上方错误。已有站主不会被覆盖。' }
    } elseif ($choice -ne '2') { throw '没有选择部署方式，请重新运行。' }
    Write-Host '即将打开 Cloudflare 授权页面，请在浏览器中允许 Wrangler 部署你的 Worker。'
    node node_modules\wrangler\bin\wrangler.js login
    if ($LASTEXITCODE -ne 0) { throw 'Cloudflare 授权尚未完成。' }
    Write-Host '正在创建免费后端。首次发布尚未连接数据库，下一步将添加私密连接配置。'
    npm.cmd run worker:deploy
    if ($LASTEXITCODE -ne 0) { throw '后端发布尚未成功。请截图上方错误。' }
    Write-Host '请在接下来的 secret 输入框中再次粘贴 Neon 连接串，然后按回车。'
    node node_modules\wrangler\bin\wrangler.js secret put DATABASE_URL
    if ($LASTEXITCODE -ne 0) { throw '数据库私密配置尚未成功。' }
    Write-Host '正在发布含数据库配置的后端……'
    npm.cmd run worker:deploy
    if ($LASTEXITCODE -ne 0) { throw '后端最终发布失败。' }
    Write-Host ''
    Write-Host '后端发布命令已成功完成！' -ForegroundColor Green
    Write-Host '请把上面 https:// 开头、以 .workers.dev 结尾的公开网址发给我。'
    Write-Host '随后还需要检查健康接口，并把 GitHub Pages 前端连接到这个网址。'
    Write-Host '新版注册、绑定和找回密码需要配置邮箱验证码服务。请按账号权限说明运行 configure-email.cmd。'
    Write-Host '数据库连接串和管理员密码不需要发给我。'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host '请保留本窗口并截图错误。截图中请隐藏连接串和密码。'
}
Read-Host '按回车关闭窗口'
