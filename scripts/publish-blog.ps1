param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
try {
    if (-not (Test-Path -LiteralPath (Join-Path $projectPath '.git'))) { throw '找不到博客项目，请把本窗口截图发给我。' }
    Set-Location -LiteralPath $projectPath
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw '找不到 Git。' }
    if ($CheckOnly) { Write-Host '检查通过：启动文件、中文编码、项目路径和 Git 均正常。'; exit 0 }
    Write-Host '正在保存博客改动……'
    git add --all
    if ($LASTEXITCODE -ne 0) { throw '保存改动失败。' }
    git diff --cached --quiet
    $diffResult = $LASTEXITCODE
    if ($diffResult -eq 1) {
        git commit -m 'Update blog'
        if ($LASTEXITCODE -ne 0) { throw '创建提交失败。' }
    } elseif ($diffResult -ne 0) { throw '检查改动失败。' }
    Write-Host '正在上传 GitHub。请保持 Clash 开启；如出现授权窗口，请完成授权。'
    git -c http.sslBackend=openssl -c http.proxy=http://127.0.0.1:7897 push -u origin main
    if ($LASTEXITCODE -ne 0) { throw '上传尚未成功，请把上面的完整错误截图发给我。' }
    Write-Host '上传成功！GitHub Pages 会自动构建，通常需要几分钟。' -ForegroundColor Green
    Write-Host '发布进度：https://github.com/weizhiqq0-glitch/personal--blog-/actions'
    Write-Host '网站：https://weizhiqq0-glitch.github.io/personal--blog-/'
    Write-Host '公网登录和评论仍需部署后端。'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host '请保留此窗口并截图，不要强制推送。'
}
Read-Host '按回车键关闭窗口'