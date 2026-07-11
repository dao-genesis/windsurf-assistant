$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot 'bundled-origin'
# 把 anchor.py 同步到 锚.py (中文名 fallback)
Copy-Item "$dir\anchor.py" "$dir\锚.py" -Force
# 重算 VERSION
$ver = (Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw | ConvertFrom-Json).version
$lines = @($ver)
$names = @('源.js','锚.py','anchor.py','_dao_81.txt')
foreach ($n in $names) {
    $p = Join-Path $dir $n
    if (Test-Path $p) {
        $bytes = [System.IO.File]::ReadAllBytes($p)
        $sha = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
        $hex16 = ([BitConverter]::ToString($sha) -replace '-','').Substring(0,16)
        $lines += "$n`tsha256-16=$hex16  size=$($bytes.Length)"
    }
}
$lines += ''
$out = ($lines -join "`n")
[System.IO.File]::WriteAllText("$dir\VERSION", $out, (New-Object System.Text.UTF8Encoding $false))
Write-Host '=== VERSION ==='
Get-Content "$dir\VERSION"
