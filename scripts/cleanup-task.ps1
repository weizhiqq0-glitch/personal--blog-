param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$targets = @('private\npm-cache', 'private\browser-check', 'private\owner-device-hash.tmp', 'backend\.wrangler\build', 'frontend\dist')
foreach ($relative in $targets) {
    $target = [IO.Path]::GetFullPath((Join-Path $root $relative))
    if (-not $target.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw '清理目标超出项目目录，已停止。' }
    if (Test-Path -LiteralPath $target) {
        Write-Host ('清理临时文件：' + $relative)
        if (-not $CheckOnly) { Remove-Item -LiteralPath $target -Recurse -Force }
    }
}
Write-Host '保留源码、正式数据、设备绑定授权码及版本备份。此工具不会删除安全记录、登录报备或全局缓存。'
