param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
try {
    Set-Location -LiteralPath (Join-Path $projectRoot 'backend')
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw '请先安装 Node.js 24 LTS。' }
    if ($CheckOnly) { Write-Host '检查通过：后端更新工具路径正常。'; exit 0 }
    $probe = New-Object System.Net.Sockets.TcpClient
    try {
        if ($probe.ConnectAsync('127.0.0.1', 7897).Wait(500) -and $probe.Connected -and -not $env:HTTPS_PROXY) {
            $env:HTTPS_PROXY = 'http://127.0.0.1:7897'
            $env:HTTP_PROXY = $env:HTTPS_PROXY
            $env:NO_PROXY = 'localhost,127.0.0.1,::1'
            $env:NODE_USE_ENV_PROXY = '1'
        }
    } catch { } finally { $probe.Dispose() }
    if (-not (Test-Path -LiteralPath 'node_modules\wrangler\bin\wrangler.js')) {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw '依赖安装失败。' }
    }
    & (Join-Path $PSScriptRoot 'check-public.ps1')
    & (Join-Path $PSScriptRoot 'backup-version.ps1')
    npm.cmd run worker:deploy
    if ($LASTEXITCODE -ne 0) { throw '部署失败，请保留错误信息；Cloudflare 授权过期时请重新授权。' }
    Write-Host '后端更新成功。前端改动请另运行发布博客。' -ForegroundColor Green
} catch { Write-Host $_.Exception.Message -ForegroundColor Red }
Read-Host '按回车关闭'
