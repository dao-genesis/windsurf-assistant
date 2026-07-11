<#
.SYNOPSIS
  dao-proxy-pro · 卸载善后 · 系统级残留归零 (Windows · 不依赖扩展存活)
.DESCRIPTION
  即便扩展已被 force-remove(deactivate 没跑), 本脚本也能把机器还到「官方直连」零态:
    ① 跨所有 IDE settings.json 清除 dao 锚点/LS 外置重定向键 (写前自动 .bak 备份)
    ② 还原/删除 ~/.codeium/_dao_ls_port.txt (被 dao 覆盖前的官方原值)
    ③ 删除 ~/.codeium/dao-certs/ 目录
    ④ 解信任区自签 MITM 证书 (server/inference.codeium.com · localhost · 127.0.0.1)
    ⑤ 清除 CODEIUM_LANGUAGE_SERVER_BIN / VSCODE_DEV 持久化用户环变
    ⑥ 删除 ~/.codeium/_dao_csrf_token.txt
    ⑦ 还原 IDE 内置 windsurf 扩展被就地打补丁的死端口 (dist\extension.js · api/inference → 官方云端)
  保留不动: ~/.codeium/dao-byok (主公 key) · ~/.codeium/dao (Cascade 记忆/上下文).
  归零后请 Reload Window / 重启 IDE, 官方语言服务器将自连.
.PARAMETER DryRun
  只报告将做什么, 不实际改动.
.PARAMETER IdeRoot
  额外指定 IDE 安装根目录 (含 resources\app), 用于 IDE 未运行时定位内置扩展.
  例: -IdeRoot 'D:\Devin','E:\Windsurf'
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File dao-reset.ps1
  powershell -ExecutionPolicy Bypass -File dao-reset.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File dao-reset.ps1 -IdeRoot 'D:\Devin'
#>
[CmdletBinding()]
param([switch]$DryRun,[string[]]$IdeRoot)

$ErrorActionPreference = 'SilentlyContinue'
$script:Changed = 0
function Step($msg) { Write-Host ("  - " + $msg) }
function Did($msg)  { $script:Changed++; if ($DryRun) { Write-Host ("  [DRY] " + $msg) -ForegroundColor Yellow } else { Write-Host ("  [OK ] " + $msg) -ForegroundColor Green } }

Write-Host "dao-proxy-pro · 卸载归零 (Windows)$(if($DryRun){' · DRY-RUN'})" -ForegroundColor Cyan

# 待清键 (锚点 + LS 外置重定向 + 备份键)
$KEYS = @(
  'codeium.apiServerUrl',
  'codeium.inferenceApiServerUrl',
  'codeiumDev.externalLanguageServerAddress',
  'codeiumDev.externalLanguageServerLspPort',
  'dao.origin._backup_apiServerUrl',
  'dao.origin._backup_inferenceApiServerUrl'
)

Write-Host "[1/7] settings.json 锚点/LS 重定向清除"
$settingsPaths = @()
foreach ($ide in @('devin','Windsurf','Code','VSCodium')) {
  $p = Join-Path $env:APPDATA "$ide\User\settings.json"
  if (Test-Path $p) { $settingsPaths += $p }
}
foreach ($sp in $settingsPaths) {
  $raw = Get-Content $sp -Raw
  $orig = $raw
  foreach ($k in $KEYS) {
    $ke = [regex]::Escape($k)
    # 删除  "key": <string|number|bool> 可带行尾逗号 / 行首逗号
    $raw = [regex]::Replace($raw, "(?m)^\s*`"$ke`"\s*:\s*(`"[^`"]*`"|\d+|true|false)\s*,?\r?\n", "")
    $raw = [regex]::Replace($raw, ",(\s*`"$ke`"\s*:\s*(`"[^`"]*`"|\d+|true|false))", "")
  }
  # 修复可能出现的悬空逗号 (……, })
  $raw = [regex]::Replace($raw, ",(\s*[}\]])", '$1')
  if ($raw -ne $orig) {
    if (-not $DryRun) {
      $bakDir = Join-Path (Split-Path $sp) ".dao-settings-backups"
      New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
      $stamp = (Get-Date).ToString('yyyy-MM-ddTHH-mm-ss')
      Copy-Item $sp (Join-Path $bakDir ("settings.json.$stamp.bak")) -Force
      Set-Content -Path $sp -Value $raw -Encoding UTF8 -NoNewline
    }
    Did "清键 → $sp"
  } else {
    Step "无残键 → $sp"
  }
}

$codeium = Join-Path $env:USERPROFILE ".codeium"

Write-Host "[2/7] _dao_ls_port.txt 还原/删除"
$portFile = Join-Path $codeium "_dao_ls_port.txt"
$bak = "$portFile.dao_backup"
if (Test-Path $bak) {
  $orig = (Get-Content $bak -Raw)
  if (-not $DryRun) { Set-Content -Path $portFile -Value $orig -NoNewline; Remove-Item $bak -Force }
  Did "还原 _dao_ls_port.txt → $($orig.Trim())  (删 .dao_backup)"
} elseif (Test-Path $portFile) {
  if (-not $DryRun) { Remove-Item $portFile -Force }
  Did "删除 _dao_ls_port.txt (无 backup)"
} else { Step "_dao_ls_port.txt 不存在" }

Write-Host "[3/7] dao-certs/ 目录删除"
$certDir = Join-Path $codeium "dao-certs"
if (Test-Path $certDir) {
  if (-not $DryRun) { Remove-Item $certDir -Recurse -Force }
  Did "删除 $certDir"
} else { Step "dao-certs/ 不存在" }

Write-Host "[4/7] 信任区自签 MITM 证书解信任"
$certs = Get-ChildItem Cert:\CurrentUser\Root -EA SilentlyContinue | Where-Object {
  $_.Subject -eq $_.Issuer -and $_.Subject -match 'CN=(server\.codeium\.com|inference\.codeium\.com|\*\.codeium\.com|localhost|127\.0\.0\.1)$'
}
if ($certs) {
  foreach ($c in $certs) {
    if (-not $DryRun) { Remove-Item ("Cert:\CurrentUser\Root\" + $c.Thumbprint) -Force }
    Did "解信任 $($c.Subject) [thumb $($c.Thumbprint)]"
  }
} else { Step "无自签 codeium/localhost 证书" }

Write-Host "[5/7] 持久化用户环变清除 (CODEIUM_LANGUAGE_SERVER_BIN / VSCODE_DEV)"
foreach ($v in @('CODEIUM_LANGUAGE_SERVER_BIN','VSCODE_DEV')) {
  $cur = (Get-ItemProperty -Path 'HKCU:\Environment' -Name $v -EA SilentlyContinue).$v
  if ($null -ne $cur) {
    if (-not $DryRun) { Remove-ItemProperty -Path 'HKCU:\Environment' -Name $v -Force }
    Did "清环变 $v (原值: $cur)"
  } else { Step "环变 $v 未设" }
}

Write-Host "[6/7] _dao_csrf_token.txt 删除"
$csrf = Join-Path $codeium "_dao_csrf_token.txt"
if (Test-Path $csrf) {
  if (-not $DryRun) { Remove-Item $csrf -Force }
  Did "删除 _dao_csrf_token.txt"
} else { Step "_dao_csrf_token.txt 不存在" }

Write-Host "[7/7] IDE 内置 windsurf 扩展补丁还原 (dist\extension.js · api/inference → 官方云端)"
# 本源: dao 把死本地端口硬编码进 IDE 自带的 dist\extension.js · 卸载扩展根本不碰此文件
#   → 重启后官方 LS 仍被 --api_server_url http://127.0.0.1:<port> 指向死端口 → 「Unable to connect」
# 还原 3 处注入签名 (端口任意 \d+):
#   restart(A){A="http://127.0.0.1:P",...        → restart(A){this.apiServerUrl=A  (用调用方真实地址)
#   getApiServerUrlFromContext=A=>{return"http://127.0.0.1:P"} → 返官方 server.codeium.com
#   const i="http://127.0.0.1:P"  (inference)  → const i="https://inference.codeium.com"
$bundles = New-Object 'System.Collections.Generic.HashSet[string]'
function Add-Bundle($dir) {
  if (-not $dir) { return }
  $p = Join-Path $dir 'resources\app\extensions\windsurf\dist\extension.js'
  if (Test-Path $p) { [void]$bundles.Add((Resolve-Path $p).Path) }
}
# 来源① 运行中的 IDE / language_server 进程
Get-Process -EA SilentlyContinue | ForEach-Object {
  $pth = $_.Path; if (-not $pth) { return }
  if ($pth -match '\\resources\\app\\extensions\\windsurf\\bin\\') {
    $f = Join-Path (Split-Path (Split-Path $pth)) 'dist\extension.js'
    if (Test-Path $f) { [void]$bundles.Add((Resolve-Path $f).Path) }
  } elseif ($_.ProcessName -match '^(devin|windsurf|code|vscodium|cursor|trae|kiro|antigravity)$') {
    Add-Bundle (Split-Path $pth)
  }
}
# 来源② PATH 里的 IDE \bin → 父目录
($env:Path -split ';') | ForEach-Object {
  $d = $_.Trim(); if ($d -match '\\bin\\?$') { Add-Bundle (Split-Path $d) }
}
# 来源③ 显式 -IdeRoot
if ($IdeRoot) { foreach ($r in $IdeRoot) { Add-Bundle $r } }

if ($bundles.Count -eq 0) {
  Step '未发现 IDE 内置 windsurf 扩展 (IDE 未运行? 可用 -IdeRoot 指定安装目录)'
} else {
  $reApi  = 'restart\(A\)\{A="http://127\.0\.0\.1:\d+",this\.apiServerUrl=A'
  $reCtx  = 'getApiServerUrlFromContext=A=>\{return"http://127\.0\.0\.1:\d+"\}'
  $reInf  = 'const i="http://127\.0\.0\.1:\d+"'
  foreach ($f in $bundles) {
    $raw = Get-Content $f -Raw
    $new = $raw
    $new = [regex]::Replace($new, $reApi, 'restart(A){this.apiServerUrl=A')
    $new = [regex]::Replace($new, $reCtx, 'getApiServerUrlFromContext=A=>{return"https://server.codeium.com"}')
    $new = [regex]::Replace($new, $reInf, 'const i="https://inference.codeium.com"')
    if ($new -ne $raw) {
      if (-not $DryRun) {
        $bak = "$f.dao_patched_backup"
        if (-not (Test-Path $bak)) { Copy-Item $f $bak -Force }
        # 无 BOM 写回 (BOM 可能干扰 IDE 扩展加载)
        [System.IO.File]::WriteAllText($f, $new, (New-Object System.Text.UTF8Encoding $false))
      }
      Did "还原内置扩展补丁 → $f"
    } else {
      Step "无补丁(已净) → $f"
    }
  }
}

Write-Host ""
Write-Host "保留不动: ~/.codeium/dao-byok (主公 key) · ~/.codeium/dao (Cascade 记忆)" -ForegroundColor DarkGray
Write-Host ("归零完成 · 共 {0} 项{1}" -f $script:Changed, $(if($DryRun){' (DRY-RUN · 未实际改动)'}else{''})) -ForegroundColor Cyan
Write-Host "请 Reload Window / 重启 IDE → 官方语言服务器将自连 (无需本插件)" -ForegroundColor Cyan
