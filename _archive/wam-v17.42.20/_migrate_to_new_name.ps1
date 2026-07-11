$ErrorActionPreference = 'Continue'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$vsix = $args[0]
if (-not $vsix) {
  Write-Error 'usage: _migrate_to_new_name.ps1 <vsix-path>'
  exit 1
}

$cli = (Get-Command windsurf -EA SilentlyContinue).Source
if (-not $cli) { $cli = 'E:\Windsurf\bin\windsurf.cmd' }

'=== [0] 环境 ==='
"CLI : $cli ($(Test-Path $cli))"
"VSIX: $vsix ($((Get-Item $vsix -EA SilentlyContinue).Length)B)"
"host: $env:COMPUTERNAME / $env:USERNAME"

'=== [1] 当前扩展 (wam*) ==='
Get-ChildItem "$env:USERPROFILE\.windsurf\extensions" -Directory -EA SilentlyContinue | Where-Object { $_.Name -match 'wam|windsurf-assistant' } | Select-Object Name, LastWriteTime | Format-Table -AutoSize

'=== [2] 卸 zhouyoukang.wam ==='
& $cli --uninstall-extension 'zhouyoukang.wam' 2>&1
"exit=$LASTEXITCODE"

'=== [3] 装 zhouyoukang.windsurf-assistant 新 VSIX ==='
& $cli --install-extension $vsix --force 2>&1
"exit=$LASTEXITCODE"

'=== [4] 清老残目录 ==='
$old = "$env:USERPROFILE\.windsurf\extensions\zhouyoukang.wam-17.21.0"
if (Test-Path $old) {
  Remove-Item $old -Recurse -Force -EA SilentlyContinue
  "  cleaned old $old · still=$(Test-Path $old)"
} else { '  无残' }

'=== [5] extensions.json 去孤儿 ==='
$meta = "$env:USERPROFILE\.windsurf\extensions\extensions.json"
if (Test-Path $meta) {
  $j = Get-Content $meta -Raw | ConvertFrom-Json
  $before = $j.Count
  $clean = @($j | Where-Object { $_.identifier.id -ne 'zhouyoukang.wam' })
  if ($clean.Count -lt $before) {
    $clean | ConvertTo-Json -Depth 10 -Compress | Set-Content $meta -Encoding UTF8
    "  去孤儿 wam: before=$before after=$($clean.Count)"
  } else { '  无孤儿' }
}

'=== [6] 最终 ==='
Get-ChildItem "$env:USERPROFILE\.windsurf\extensions" -Directory -EA SilentlyContinue | Where-Object { $_.Name -match 'wam|windsurf-assistant' } | Select-Object Name, LastWriteTime | Format-Table -AutoSize

'=== [7] bundled-origin 完 ==='
$extDir = "$env:USERPROFILE\.windsurf\extensions\zhouyoukang.windsurf-assistant-17.21.0"
if (Test-Path $extDir) {
  Get-ChildItem "$extDir\bundled-origin" -EA SilentlyContinue | Select-Object Name, Length | Format-Table -AutoSize
}

'=== [8] proxy :8889 仍活 · 不干扰 ==='
try {
  $r = Invoke-RestMethod 'http://127.0.0.1:8889/origin/ping' -TimeoutSec 3
  "pid=$($r.pid) mode=$($r.mode) up=$($r.uptime_s)s dao=$($r.dao_chars) req=$($r.req_total)"
} catch { "proxy 无 (扩展未初或 Reload 后由新 ext 接)" }
