# _dao_postreload_verify.ps1 - generic post-reload verifier
#
# 道法自然 · 唯变所适 · 验证之常 · 与版本无关
#
# Examples:
#   .\_dao_postreload_verify.ps1                       # use source VERSION
#   .\_dao_postreload_verify.ps1 -ExpectVersion 2.6.7  # explicit
#   .\_dao_postreload_verify.ps1 -Target 179           # remote (smb log)

[CmdletBinding()]
param(
    [string]$ExpectVersion = '',
    [string]$Target = 'local'
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot '_dao_lib.ps1')

if (-not $ExpectVersion) {
    $ExpectVersion = Get-WamSourceVersion
}
if (-not $ExpectVersion) {
    Write-Host '[FATAL] cannot determine ExpectVersion (no source extension.js?)' -ForegroundColor Red
    exit 2
}

$daoEnv = Get-DaoEnv
$tList = Get-Targets -Filter @($Target) -Env $daoEnv
if ($tList.Count -eq 0) {
    Write-Host ('[FATAL] target not found: {0}' -f $Target) -ForegroundColor Red
    exit 2
}
$tgt = $tList[0]
if (-not $tgt.ok) {
    Write-Host ('[FATAL] target unresolved: {0}' -f $tgt.reason) -ForegroundColor Red
    exit 2
}

$logPath = $tgt.log
$src = Join-Path $PSScriptRoot 'extension.js'

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host (' dao verify - expect v{0} on [{1}]' -f $ExpectVersion, $tgt.label) -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if (-not (Test-Path $logPath)) {
    Write-Host ('[ERR] wam.log not found: {0}' -f $logPath) -ForegroundColor Red
    exit 2
}
$lines = Get-Content $logPath -Encoding utf8

# 道法自然 · 唯实证活体之版本是真 ─ 优先寻 'WAM vX.Y.Z activate' (实际 reload 后 process 入口)
# 退化 fallback: DEPLOY MARKER (仅文件部署 · 未必 reload 生效)
$activatePat = ('WAM v' + [regex]::Escape($ExpectVersion) + ' activate')
$markerPat   = ('v' + [regex]::Escape($ExpectVersion) + ' DEPLOY MARKER')
$activateIdx = -1
$markerIdx   = -1
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
    if ($activateIdx -lt 0 -and $lines[$i] -match $activatePat) { $activateIdx = $i }
    if ($markerIdx   -lt 0 -and $lines[$i] -match $markerPat)   { $markerIdx   = $i }
    if ($activateIdx -ge 0 -and $markerIdx -ge 0) { break }
}

if ($activateIdx -ge 0) {
    # 用最后一次 activate 作分割 · 只看 reload 后的活体行为 (v2.6.9 真区段)
    $cutIdx = $activateIdx
    $cutSrc = 'last activate'
} elseif ($markerIdx -ge 0) {
    Write-Host ('[? warn] no v{0} activate found - using DEPLOY MARKER (process not reloaded yet?)' -f $ExpectVersion) -ForegroundColor Yellow
    $cutIdx = $markerIdx
    $cutSrc = 'deploy marker'
} else {
    Write-Host ('[?] v{0} activate / DEPLOY MARKER both not found - run _dao_deploy.ps1 first' -f $ExpectVersion) -ForegroundColor Yellow
    exit 1
}
$post = $lines[($cutIdx + 1)..($lines.Count - 1)]
Write-Host ('Cut: line {0} ({1}) - post lines: {2}' -f ($cutIdx + 1), $cutSrc, $post.Count) -ForegroundColor Gray

# [1] activate marker (用 cutIdx 已含活体检测 · 复显其行)
if ($activateIdx -ge 0) {
    Write-Host ('[OK 1] process reloaded to v{0} (line {1})' -f $ExpectVersion, ($activateIdx + 1)) -ForegroundColor Green
    Write-Host ('    ' + $lines[$activateIdx]) -ForegroundColor DarkGray
} else {
    Write-Host ('[?? 1] no v{0} activate seen - did you Reload Window?' -f $ExpectVersion) -ForegroundColor Yellow
    Write-Host '       Ctrl+Shift+P -> Developer: Reload Window' -ForegroundColor Yellow
    exit 1
}

# [2] _per_msg_diag.json (only meaningful for local kind)
if ($tgt.kind -eq 'local') {
    # v2.7.0 软编码归一·走 Get-WamDir (尊 _dao_env(.local).psd1)
    $diagPath = Join-Path (Get-WamDir -Env $daoEnv) '_per_msg_diag.json'
    if (Test-Path $diagPath) {
        try {
            $diag = Get-Content $diagPath -Raw -Encoding utf8 | ConvertFrom-Json
            $hits      = if ($diag.totalHits)      { $diag.totalHits }      else { 0 }
            $rotates   = if ($diag.totalRotates)   { $diag.totalRotates }   else { 0 }
            $debounced = if ($diag.totalDebounced) { $diag.totalDebounced } else { 0 }
            Write-Host '[OK 2] _per_msg_diag.json:' -ForegroundColor Green
            Write-Host ('   totalHits      = {0}' -f $hits)      -ForegroundColor Cyan
            Write-Host ('   totalRotates   = {0}' -f $rotates)   -ForegroundColor Cyan
            Write-Host ('   totalDebounced = {0}' -f $debounced) -ForegroundColor $(if ($debounced -gt 0) {'Green'} else {'Yellow'})
        } catch {
            Write-Host ('[?? 2] diag json parse fail: {0}' -f $_.Exception.Message) -ForegroundColor Yellow
        }
    } else {
        Write-Host '[?? 2] _per_msg_diag.json not found - send a message first' -ForegroundColor Yellow
    }
}

# [3] log signal counts
$debouncedLog = $post | Where-Object { $_ -match 'per-msg debounced#' }
$hitsLog      = $post | Where-Object { $_ -match 'per-msg hit#' }
$rotateLog    = $post | Where-Object { $_ -match 'per-msg rotate#' }
$pbSettle     = $post | Where-Object { $_ -match 'pb.settle:|pb settle:' }
$pbNew        = $post | Where-Object { $_ -match 'pb.new:|pb new:' }
$walSettle    = $post | Where-Object { $_ -match 'WAL . settle:|WAL settle:' }
# v2.6.9 新信号: 边沿首发 + 全局强锁拦截
$walEdge      = $post | Where-Object { $_ -match 'WAL . edge.fire: \+' }    # 精确匹配 fire 行 (排除 minInterval-locked 里的 L6→wal·edge 记录)
$walEdgeSkip  = $post | Where-Object { $_ -match 'edge.skip\[checkpoint' }  # v2.6.10 · checkpoint 过滤
$minLocked    = $post | Where-Object { $_ -match 'minInterval-locked' }
Write-Host ''
Write-Host '[OK 3] log signal counts (post-marker):' -ForegroundColor Green
Write-Host ('   per-msg hit#         : {0}' -f $hitsLog.Count) -ForegroundColor Cyan
Write-Host ('   per-msg rotate#      : {0}' -f $rotateLog.Count) -ForegroundColor Cyan
Write-Host ('   per-msg debounced#   : {0}  (4s 防抖)' -f $debouncedLog.Count) -ForegroundColor $(if ($debouncedLog.Count -gt 0) {'Green'} else {'Yellow'})
Write-Host ('   minInterval-locked   : {0}  (v2.6.9 60s 全局强锁拦截·应见证强锁工作)' -f $minLocked.Count) -ForegroundColor $(if ($minLocked.Count -gt 0) {'Green'} else {'Yellow'})
Write-Host ('   pb new               : {0}  (新对话·v2.6.9 唯一 pb 信号)' -f $pbNew.Count) -ForegroundColor Cyan
Write-Host ('   pb settle (v2.6.9 应=0): {0}' -f $pbSettle.Count) -ForegroundColor $(if ($pbSettle.Count -eq 0) {'Green'} else {'Red'})
Write-Host ('   wal settle (v2.6.9 应=0): {0}' -f $walSettle.Count) -ForegroundColor $(if ($walSettle.Count -eq 0) {'Green'} else {'Red'})
Write-Host ('   wal edge (v2.6.9 新源·边沿首发): {0}' -f $walEdge.Count) -ForegroundColor Cyan
Write-Host ('   wal edge skip (v2.6.10 checkpoint 过滤): {0}' -f $walEdgeSkip.Count) -ForegroundColor $(if ($walEdgeSkip.Count -gt 0) {'Green'} else {'DarkGray'})

# v2.6.9 切号率分析 (与 v2.6.8 baseline 比对)
if ($rotateLog.Count -ge 2) {
    $tsRegex = '\[(\d+:\d+:\d+\.\d+)\]'
    $rotateTimes = @()
    foreach ($line in $rotateLog) {
        if ($line -match $tsRegex) {
            try { $rotateTimes += [datetime]::ParseExact($matches[1], 'HH:mm:ss.fff', $null) } catch {}
        }
    }
    if ($rotateTimes.Count -ge 2) {
        $deltas = @()
        for ($i = 1; $i -lt $rotateTimes.Count; $i++) {
            $deltas += [int]($rotateTimes[$i] - $rotateTimes[$i-1]).TotalSeconds
        }
        $median = ($deltas | Sort-Object)[[int]($deltas.Count / 2)]
        $avg    = ($deltas | Measure-Object -Average).Average
        $minD   = ($deltas | Measure-Object -Minimum).Minimum
        $maxD   = ($deltas | Measure-Object -Maximum).Maximum
        Write-Host ''
        Write-Host '[OK 3+] 切号间隔分析 (v2.6.8 baseline: median 22s, min 5s, 9 倍率):' -ForegroundColor Green
        Write-Host ('   切号 count    : {0}' -f $rotateTimes.Count) -ForegroundColor Cyan
        Write-Host ('   median 间隔   : {0}s  (v2.6.9 期: ≥60s)' -f $median) -ForegroundColor $(if ($median -ge 60) {'Green'} elseif ($median -ge 30) {'Yellow'} else {'Red'})
        Write-Host ('   avg 间隔      : {0:N1}s' -f $avg) -ForegroundColor Cyan
        Write-Host ('   min 间隔      : {0}s  (v2.6.9 期: ≥60s 强锁应硬切)' -f $minD) -ForegroundColor $(if ($minD -ge 60) {'Green'} elseif ($minD -ge 30) {'Yellow'} else {'Red'})
        Write-Host ('   max 间隔      : {0}s' -f $maxD) -ForegroundColor Cyan

        # v2.6.8 baseline 22s/次 · v2.6.9 期 ≥60s/次 → 降幅 ≥ 63%
        $baseline = 22
        if ($median -gt 0) {
            $reduction = [math]::Round((1 - $baseline / $median) * 100, 1)
            $color = if ($reduction -ge 75) { 'Green' } elseif ($reduction -ge 50) { 'Yellow' } else { 'Red' }
            Write-Host ('   降幅 vs v2.6.8: {0}%  (期: ≥75%)' -f $reduction) -ForegroundColor $color
        }
    }
}

if ($debouncedLog.Count -gt 0) {
    Write-Host ''
    Write-Host '   last 3 debounced events:' -ForegroundColor Gray
    $debouncedLog | Select-Object -Last 3 | ForEach-Object { Write-Host ('   ' + $_) -ForegroundColor DarkGray }
}
if ($minLocked.Count -gt 0) {
    Write-Host ''
    Write-Host '   last 3 minInterval-locked events:' -ForegroundColor Gray
    $minLocked | Select-Object -Last 3 | ForEach-Object { Write-Host ('   ' + $_) -ForegroundColor DarkGray }
}
if ($walEdge.Count -gt 0) {
    Write-Host ''
    Write-Host '   last 3 wal·edge events:' -ForegroundColor Gray
    $walEdge | Select-Object -Last 3 | ForEach-Object { Write-Host ('   ' + $_) -ForegroundColor DarkGray }
}

# [4] SRC vs DEP sha (only when target.extRoot is reachable)
$loc = Resolve-DevaidLocation -ExtRoot $tgt.extRoot -ExtensionId $daoEnv.extensionId
if ($loc.ok -and (Test-Path (Join-Path $loc.path 'extension.js'))) {
    $srcSha = (Get-FileHash $src -Algorithm SHA256).Hash.Substring(0, 16).ToLower()
    $dstSha = (Get-FileHash (Join-Path $loc.path 'extension.js') -Algorithm SHA256).Hash.Substring(0, 16).ToLower()
    if ($srcSha -eq $dstSha) {
        Write-Host ''
        Write-Host ('[OK 4] SRC sha === DEP sha = {0}' -f $srcSha) -ForegroundColor Green
    } else {
        Write-Host ''
        Write-Host ('[FAIL 4] SRC sha={0} != DEP sha={1}' -f $srcSha, $dstSha) -ForegroundColor Red
    }
}

# [5] state.json (local only by default)
if ($tgt.kind -eq 'local') {
    # v2.7.0 软编码归一·走 Get-WamDir (尊 _dao_env(.local).psd1)
    $ws = Join-Path (Get-WamDir -Env $daoEnv) 'wam-state.json'
    if (Test-Path $ws) {
        try {
            $j = Get-Content $ws -Raw -Encoding utf8 | ConvertFrom-Json
            Write-Host ''
            Write-Host ('  state active={0} switches={1}' -f $j.activeEmail, $j.switches) -ForegroundColor Cyan
        } catch {}
    }
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' verify done - dao fa zi ran' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
