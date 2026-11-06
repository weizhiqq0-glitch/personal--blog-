param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ($CheckOnly) {
    foreach ($file in @('start-blog.ps1','publish-blog.ps1','update-backend.ps1','check-public.ps1','configure-email.ps1','deploy-free-backend.ps1')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $file))) { throw "缺少工具：$file" }
    }
    Write-Host '检查通过：统一工具箱路径完整。'
    exit 0
}
Write-Host '博客工具箱'
Write-Host '1  启动本地前端与后端'
Write-Host '2  更新线上后端（Cloudflare）'
Write-Host '3  发布源码与前端（GitHub）'
Write-Host '4  检查即将公开的文件'
Write-Host '5  配置邮箱验证码'
Write-Host '6  首次部署后端（搬迁到新账号时使用）'
Write-Host '7  创建线上站主（已有站主不要重复创建）'
Write-Host '8  校准线上邮件额度（首次启用或站主尚未验证时使用）'
Write-Host '9  打开项目文件夹'
Write-Host '0  退出'
$choice = Read-Host '请输入数字'
$scripts = @{ '1'='start-blog.ps1'; '2'='update-backend.ps1'; '3'='publish-blog.ps1'; '4'='check-public.ps1'; '5'='configure-email.ps1'; '6'='deploy-free-backend.ps1' }
try {
    if ($scripts.ContainsKey($choice)) {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot $scripts[$choice])
        if ($choice -eq '4') { Read-Host '按回车关闭' }
    } elseif ($choice -in @('7','8')) {
        $file = if ($choice -eq '7') { 'create-admin.js' } else { 'calibrate-mail.js' }
        & node (Join-Path $root ('backend\' + $file)) --remote
        Read-Host '按回车关闭'
    } elseif ($choice -eq '9') { Start-Process explorer.exe -ArgumentList ('"' + $root + '"') }
} catch { Write-Host $_.Exception.Message -ForegroundColor Red; Read-Host '按回车关闭' }
