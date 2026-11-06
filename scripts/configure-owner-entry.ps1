param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
try {
    Set-Location -LiteralPath (Join-Path $root 'backend')
    if ($CheckOnly) { Write-Host '站主入口配置工具路径正常。'; exit 0 }
    Write-Host '此工具只配置入口口令，不修改站主密码。请输入你自己选择的入口口令。'
    $secure = Read-Host '入口口令（隐藏输入）' -AsSecureString
    $plain = [Net.NetworkCredential]::new('', $secure).Password
    if ($plain.Length -lt 8 -or $plain.Length -gt 128) { throw '入口口令须为8—128位。' }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($plain)))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose(); $plain = $null }
    $probe = New-Object System.Net.Sockets.TcpClient
    try {
        if ($probe.ConnectAsync('127.0.0.1',7897).Wait(500) -and $probe.Connected -and -not $env:HTTPS_PROXY) {
            $env:HTTPS_PROXY='http://127.0.0.1:7897'; $env:HTTP_PROXY=$env:HTTPS_PROXY; $env:NODE_USE_ENV_PROXY='1'; $env:NO_PROXY='localhost,127.0.0.1,::1'
        }
    } catch {} finally { $probe.Dispose() }
    $hash | & node node_modules/wrangler/bin/wrangler.js secret put OWNER_ENTRY_CODE_HASH
    if ($LASTEXITCODE -ne 0) { throw '保存未完成，请先确认Cloudflare已授权。' }
    $hash = $null
    Write-Host '入口口令摘要已保存至Cloudflare。请运行更新后端工具，随后通过三次点击月亮登录。' -ForegroundColor Green
} catch { Write-Host $_.Exception.Message -ForegroundColor Red }
Read-Host '按回车关闭'
