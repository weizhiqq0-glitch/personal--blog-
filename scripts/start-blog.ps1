param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
function Test-BlogEndpoint([string]$Url, [string]$Kind) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        if ($Kind -eq 'backend') { return (($response.Content | ConvertFrom-Json).message -eq '博客后端运行正常') }
        return ($response.Content -match '/@vite/client')
    } catch { return $false }
}
function Test-PortBusy([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}
try {
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw '没有找到 npm，请先安装 Node.js，然后重新打开快捷方式。' }
    foreach ($folder in @('frontend', 'backend')) {
        if (-not (Test-Path (Join-Path $projectRoot "$folder\node_modules"))) { throw "$folder 依赖尚未安装，请在该目录执行 npm install。" }
    }
    $frontReady = Test-BlogEndpoint 'http://127.0.0.1:5173/' 'frontend'
    $backReady = Test-BlogEndpoint 'http://127.0.0.1:3000/api/health' 'backend'
    if (-not $frontReady -and (Test-PortBusy 5173)) { throw '5173 端口被其他程序占用，请先关闭占用程序。' }
    $backendPort = 3000
    if (-not $backReady) {
        while (Test-PortBusy $backendPort) {
            $backendPort++
            if ($backendPort -gt 3010) { throw 'No free backend port in 3000-3010.' }
            $backReady = Test-BlogEndpoint "http://127.0.0.1:$backendPort/api/health" 'backend'
            if ($backReady) { break }
        }
    }
    Write-Host "Backend: http://127.0.0.1:$backendPort/api/health"
    if ($CheckOnly) { Write-Host '检查通过：目录、依赖、npm 和端口正常。'; exit 0 }
    if (-not $backReady) {
        Start-Process -FilePath $env:ComSpec -WorkingDirectory (Join-Path $projectRoot 'backend') -ArgumentList "/d /k `"title Blog Backend & set PORT=$backendPort& npm.cmd run dev`""
    }
    if (-not $frontReady) {
        Start-Process -FilePath $env:ComSpec -WorkingDirectory (Join-Path $projectRoot 'frontend') -ArgumentList '/d /k "title Blog Frontend & npm.cmd run dev -- --port 5173 --strictPort --host 127.0.0.1"'
    }
    Write-Host '正在等待前端和后端启动……'
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ((Test-BlogEndpoint 'http://127.0.0.1:5173/' 'frontend') -and (Test-BlogEndpoint "http://127.0.0.1:$backendPort/api/health" 'backend')) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw '启动超时，请查看 Blog Frontend 和 Blog Backend 窗口中的报错。' }
    Start-Process 'http://127.0.0.1:5173/'
    Write-Host '博客已打开！关闭 Blog Frontend / Blog Backend 窗口即可停止对应服务。'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host '按 Enter 关闭此窗口'
    exit 1
}
