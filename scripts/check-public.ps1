param([switch]$Staged)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $root
try {
    $files = if ($Staged) { @(git -c core.quotepath=false diff --cached --name-only --diff-filter=ACMR) } else { @(git -c core.quotepath=false ls-files --cached --others --exclude-standard) }
    if ($LASTEXITCODE -ne 0) { throw '无法读取 Git 文件列表。' }
    $bad = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($file in $files) {
        if (-not $file) { continue }
        if ($file -match '(^|/)(node_modules|data|private|\.wrangler|\.local)(/|$)|(^|/)(\.env($|\.)|\.dev\.vars)|\.(sqlite([-.].*)?|db|pem|key|p12|pfx|log|sql|zip|7z|bak|dump)$') {
            if ($file -notmatch '(^|/)\.env\.example$') { [void]$bad.Add($file); continue }
        }
        $extension = [IO.Path]::GetExtension($file)
        if ($extension -in @('.png','.jpg','.jpeg','.webp','.ico','.woff','.woff2')) { continue }
        $content = if ($Staged) { (git show (':' + $file)) -join "`n" } elseif (Test-Path -LiteralPath $file -PathType Leaf) { [IO.File]::ReadAllText((Join-Path $root $file)) } else { '' }
        # Tests intentionally contain fake isolated credentials, never production secrets.
        $testFile = $file -match '(^|/)test/'
        if ($content -match '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|\bghp_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}') { [void]$bad.Add($file) }
        if (-not $testFile -and $content -match 'postgres(?:ql)?://[^\s:@]+:[^\s@]+@[^\s]+\.neon\.tech|(?:EMAILJS_PRIVATE_KEY|CLOUDFLARE_API_TOKEN|BREVO_API_KEY|RESEND_API_KEY)\s*[:=]\s*["''][A-Za-z0-9_-]{20,}["'']') { [void]$bad.Add($file) }
        if ($file -match '^frontend/' -and $content -match 'VITE_(?:DATABASE_URL|.*PRIVATE_KEY|.*PASSWORD|.*SECRET)\s*=\s*[^#\r\n]+') { [void]$bad.Add($file) }
    }
    if ($bad.Count) { throw ('这些文件可能含私密资料，已停止发布（不输出内容）：' + ($bad -join '，')) }
    Write-Host '公开文件检查通过：未发现被跟踪的私密文件或常见密钥模式。此检查不等于完整安全审计。' -ForegroundColor Green
} finally { Pop-Location }
