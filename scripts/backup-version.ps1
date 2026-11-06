param([string]$Revision = 'HEAD')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$folder = Join-Path $root 'private\version-backups'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$lock = $null
$temporary = $null
Push-Location -LiteralPath $root
try {
    # Exclusive lock prevents concurrent front/backend updates racing retention.
    try { $lock = [IO.File]::Open((Join-Path $folder '.backup.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { throw '另一个版本备份正在运行，请完成后重试。此次更新已停止。' }
    $sha = (git rev-parse --verify ($Revision + '^{commit}') | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $sha -notmatch '^[a-f0-9]{40,64}$') { throw '无法确定更新前版本，已停止更新以免没有备份。' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $existing = @(Get-ChildItem -LiteralPath $folder -File | Where-Object { $_.Name -match ('^blog-version-\d{8}-\d{9}-' + $sha + '\.zip$') })
    $valid = $false
    foreach ($file in $existing) {
        try {
            $archive = [IO.Compression.ZipFile]::OpenRead($file.FullName)
            try { $valid = $archive.Entries.Count -gt 0 -and $null -ne $archive.GetEntry('README.md') } finally { $archive.Dispose() }
        } catch { $valid = $false }
        if ($valid) { Write-Host ('该版本已有备份：' + $file.FullName); break }
    }
    if (-not $valid) {
        $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmssfff')
        $destination = Join-Path $folder ('blog-version-' + $stamp + '-' + $sha + '.zip')
        $temporary = Join-Path $folder ([Guid]::NewGuid().ToString('N') + '.partial')
        git archive --format=zip --output=$temporary $sha
        if ($LASTEXITCODE -ne 0) { throw '压缩备份失败，更新已停止。' }
        $archive = [IO.Compression.ZipFile]::OpenRead($temporary)
        try {
            if ($archive.Entries.Count -eq 0 -or $null -eq $archive.GetEntry('README.md')) { throw '备份内容校验失败，更新已停止。' }
        } finally { $archive.Dispose() }
        Move-Item -LiteralPath $temporary -Destination $destination
        $temporary = $null
        Write-Host ('更新前版本已备份：' + $destination) -ForegroundColor Green
    }
    # Only delete archives owned by this tool, after a usable archive exists.
    $archives = @(Get-ChildItem -LiteralPath $folder -File | Where-Object { $_.Name -match '^blog-version-\d{8}-\d{9}-[a-f0-9]{40,64}\.zip$' } | Sort-Object Name -Descending)
    foreach ($old in @($archives | Select-Object -Skip 3)) {
        $resolved = [IO.Path]::GetFullPath($old.FullName)
        if (-not $resolved.StartsWith([IO.Path]::GetFullPath($folder) + '\', [StringComparison]::OrdinalIgnoreCase)) { throw '备份清理路径异常。' }
        Remove-Item -LiteralPath $resolved -Force
        Write-Host ('已删除最早备份：' + $old.Name)
    }
} finally {
    if ($temporary -and (Test-Path -LiteralPath $temporary)) { Remove-Item -LiteralPath $temporary -Force }
    if ($lock) { $lock.Dispose() }
    Pop-Location
}
