param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw '未找到 Node.js。' }
    $cli = Join-Path $projectRoot 'backend\node_modules\wrangler\bin\wrangler.js'
    if (-not (Test-Path -LiteralPath $cli)) { throw '请先在 backend 目录执行 npm ci 安装部署工具。' }
    if ($CheckOnly) { Write-Host '检查通过：邮箱配置工具和 Cloudflare CLI 均正常。'; exit 0 }
    Set-Location -LiteralPath (Join-Path $projectRoot 'backend')
    $probe = New-Object System.Net.Sockets.TcpClient
    try {
        if ($probe.ConnectAsync('127.0.0.1', 7897).Wait(500) -and $probe.Connected -and -not $env:HTTPS_PROXY) {
            $env:HTTPS_PROXY = 'http://127.0.0.1:7897'; $env:HTTP_PROXY = $env:HTTPS_PROXY
            $env:NO_PROXY = 'localhost,127.0.0.1,::1'; $env:NODE_USE_ENV_PROXY = '1'
        }
    } catch { } finally { $probe.Dispose() }
    Write-Host '请先在 EmailJS 连接邮箱、创建验证码模板，并在安全设置启用后端请求和私钥验证。'
    Write-Host '接下来只在工具的隐藏输入框里粘贴密钥，不要发到聊天或提交到 GitHub。'
    node $cli login
    if ($LASTEXITCODE -ne 0) { throw 'Cloudflare 授权未完成。' }
    foreach ($name in @('EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', 'EMAILJS_PUBLIC_KEY', 'EMAILJS_PRIVATE_KEY')) {
        Write-Host "现在输入 EmailJS 的 $name ："
        node $cli secret put $name
        if ($LASTEXITCODE -ne 0) { throw "$name 配置失败。" }
    }
    npm.cmd run worker:deploy
    if ($LASTEXITCODE -ne 0) { throw '配置后的后端发布失败。' }
    Write-Host '配置命令已完成。请在网站点击获取验证码，确认自己确实收到邮件后再开放注册。' -ForegroundColor Green
} catch { Write-Host $_.Exception.Message -ForegroundColor Red }
Read-Host '按回车关闭窗口'
