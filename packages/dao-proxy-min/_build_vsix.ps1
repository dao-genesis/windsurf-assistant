# _build_vsix.ps1 · 道Agent · 极简构建脚本 (v9.8.0+)
# 用:
#   .\_build_vsix.ps1                # 仅打包
#   .\_build_vsix.ps1 -Smoke         # 打包前先跑 _审视\_smoke.ps1 (任失即终止)
#   .\_build_vsix.ps1 -InstallLocal  # 打包 + 装本机 Windsurf
#
# 道义: 四十八章「为道日损·损之又损」 — L1/L2 之繁尽损·smoke 一令通验

param(
    [switch]$Smoke,
    [switch]$InstallLocal
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

Write-Host '═══ 道Agent · 构建 vsix ═══' -ForegroundColor Cyan
Write-Host ''

# ── 0. 校验 essence 件齐 ──
$requiredFiles = @(
    'extension.js',
    'package.json',
    'README.md',
    'LICENSE',
    'media\icon.png',
    'vendor\bundled-origin\source.js',
    'vendor\bundled-origin\_silk_de.txt',
    'vendor\bundled-origin\_silk_dao.txt'
)
foreach ($f in $requiredFiles) {
    if (-not (Test-Path $f)) {
        Write-Host ('  X 缺: ' + $f) -ForegroundColor Red
        exit 1
    }
}
Write-Host ('  OK essence 件齐 (' + $requiredFiles.Count + ' 必)') -ForegroundColor Green

# ── 1. (可选) smoke ──
if ($Smoke) {
    Write-Host ''
    Write-Host '── _审视\_smoke.ps1 ──' -ForegroundColor Cyan
    $smokePath = Join-Path $here '_审视\_smoke.ps1'
    if (-not (Test-Path $smokePath)) {
        Write-Host '  X 缺 _审视\_smoke.ps1' -ForegroundColor Red
        exit 1
    }
    & pwsh -NoProfile -ExecutionPolicy Bypass -File $smokePath
    if ($LASTEXITCODE -ne 0) {
        Write-Host ('  X smoke 失 (exit=' + $LASTEXITCODE + ') · 不打包') -ForegroundColor Red
        exit $LASTEXITCODE
    }
    Write-Host '  OK smoke 全过' -ForegroundColor Green
}

# ── 2. 删旧 vsix ──
Write-Host ''
Write-Host '── 删旧 vsix ──'
Get-ChildItem -Path . -Filter 'dao-proxy-min*.vsix' | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host ('  DEL ' + $_.Name)
}

# ── 3. 打包 ──
Write-Host ''
Write-Host '── 打包 (vsce package) ──' -ForegroundColor Cyan
$pkgVersion = (Get-Content package.json -Raw -Encoding UTF8 | ConvertFrom-Json).version
Write-Host ('  version: ' + $pkgVersion)

$vsceArgs = @('@vscode/vsce', 'package', '--no-dependencies', '--allow-missing-repository')
& npx @vsceArgs 2>&1 | ForEach-Object { Write-Host ('  ' + $_) }
if ($LASTEXITCODE -ne 0) {
    Write-Host '  X vsce 打包失' -ForegroundColor Red
    exit $LASTEXITCODE
}

$vsixFile = Get-ChildItem -Path . -Filter 'dao-proxy-min*.vsix' | Select-Object -First 1
if (-not $vsixFile) {
    Write-Host '  X 未生成 vsix' -ForegroundColor Red
    exit 1
}
Write-Host ''
Write-Host ('  OK 打包: ' + $vsixFile.Name + ' (' + [math]::Round($vsixFile.Length / 1KB, 1) + ' KB)') -ForegroundColor Green

# ── 4. (可选) 装本机 ──
if ($InstallLocal) {
    Write-Host ''
    Write-Host '── 装本机 Windsurf ──' -ForegroundColor Cyan

    $windsurfBin = $null
    $candidates = @(
        'E:\Windsurf\bin\windsurf.cmd',
        'C:\Program Files\Windsurf\bin\windsurf.cmd',
        ($env:LOCALAPPDATA + '\Programs\Windsurf\bin\windsurf.cmd')
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $windsurfBin = $c; break }
    }
    if (-not $windsurfBin) {
        $found = Get-Command windsurf -ErrorAction SilentlyContinue
        if ($found) { $windsurfBin = $found.Source }
    }
    if (-not $windsurfBin) {
        Write-Host ('  X 找不 windsurf.cmd · 手装: windsurf --install-extension ' + $vsixFile.FullName) -ForegroundColor Yellow
        exit 0
    }

    Write-Host ('  windsurf: ' + $windsurfBin)
    & $windsurfBin --install-extension $vsixFile.FullName --force 2>&1 | ForEach-Object { Write-Host ('  ' + $_) }
    if ($LASTEXITCODE -eq 0) {
        Write-Host '  OK 装毕 · 重载 Windsurf 窗口生效' -ForegroundColor Green
    } else {
        Write-Host ('  X 装失 (exit ' + $LASTEXITCODE + ')') -ForegroundColor Red
    }
}

Write-Host ''
Write-Host '════════════════════════════════════════' -ForegroundColor Cyan