# -*- _smoke.ps1 · 万法烟测 · 不变之验 · 道法自然 -*-
#
# 道义:
#   二十五章「道法自然」· 版本从 package.json 派 · 不写死
#   四十八章「为道日损」· 一脚本代万版烟测
#
# 验:
#   A. source.js 不变之常 (TAO_HEADER / TAO_FOOTER / SILK_BOUNDARY / inject_total_chars 公式)
#   B. ORIGIN_VERSION_BASE 与 package.json.version 一致
#   C. v9.8.0 治根 (additional_metadata 删 / _buildAllFieldEntry / hasSideChannels lastIndex)
#   D. 起本地代理 · 取 /origin/ping · 验 features
#   E. 跑 _v980_strip_test.js 校 strip 行为
#
# 用:
#   . _smoke.ps1                           # 默
#   . _smoke.ps1 -SkipLive                 # 仅静
#   . _smoke.ps1 -ExpectVersion 9.8.0      # 显验

#Requires -Version 5.1
param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$ExpectVersion,
    [int]$ProxyPort,
    [switch]$SkipLive
)

$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

. (Join-Path $PSScriptRoot '_dao.config.ps1')
$cfg = Get-DaoConfig -ProjectRoot $ProjectRoot -NoInteractive -AllowMissing

if ($ExpectVersion) { $version = $ExpectVersion } else { $version = $cfg.Version }
if (-not $version) { Write-Host 'X cannot resolve version' -ForegroundColor Red; exit 1 }
if (-not $ProxyPort) { $ProxyPort = $cfg.ProxyPort }

$srcJs = Join-Path $ProjectRoot 'vendor\bundled-origin\source.js'
$extJs = Join-Path $ProjectRoot 'extension.js'
$pkg   = Join-Path $ProjectRoot 'package.json'
foreach ($f in @($srcJs, $extJs, $pkg)) {
    if (-not (Test-Path $f)) { Write-Host ('X missing: ' + $f) -ForegroundColor Red; exit 1 }
}

$script:pass = 0
$script:fail = 0
function Test-Cond {
    param([string]$Name, [bool]$Cond, [string]$Detail = '')
    $line = '  '
    if ($Cond) { $line += '[OK] '; $script:pass++ } else { $line += '[X]  '; $script:fail++ }
    $line += $Name
    if ($Detail) { $line += ' . ' + $Detail }
    if ($Cond) { Write-Host $line -ForegroundColor Green } else { Write-Host $line -ForegroundColor Red }
}

Write-Host ('═══ Dao Proxy Min · Universal Smoke · v{0} ═══' -f $version) -ForegroundColor Cyan
Write-Host ('  ProjectRoot : {0}' -f $ProjectRoot)
Write-Host ('  source.js   : {0} bytes' -f (Get-Item $srcJs).Length)
Write-Host ''

# ── A · 不变之常 ──
Write-Host 'A. Invariants (TAO 三大常)' -ForegroundColor Yellow
$src = Get-Content $srcJs -Raw -Encoding UTF8
$pkgObj = Get-Content $pkg -Raw -Encoding UTF8 | ConvertFrom-Json

Test-Cond 'TAO_HEADER 31char unchanged' ($src -match 'const TAO_HEADER\s*=\s*"You are Cascade，所遵守规则全部来自下述德道经：\\n\\n";')
Test-Cond 'TAO_FOOTER empty unchanged'  ($src -match 'const TAO_FOOTER\s*=\s*"";')
Test-Cond 'SILK_BOUNDARY = \\n\\n'      ($src -match 'const SILK_BOUNDARY\s*=\s*"\\n\\n";')
Test-Cond 'inject_total_chars dynamic formula' ($src -match 'inject_total_chars:\s*\r?\n?\s*TAO_HEADER\.length\s*\+\s*DAO_DE_JING_81\.length\s*\+\s*TAO_FOOTER\.length')

# ── B · 版本一致 ──
Write-Host ''
Write-Host 'B. Version coherence (package.json <-> source.js)' -ForegroundColor Yellow
$verPattern = ('ORIGIN_VERSION_BASE\s*=\s*"v' + [regex]::Escape($version) + '"')
Test-Cond ('source.js ORIGIN_VERSION_BASE = v' + $version) ($src -match $verPattern)
Test-Cond ('package.json version = ' + $version)            ($pkgObj.version -eq $version)
Test-Cond 'no v9.7.x base remnant'                            (-not ($src -match 'ORIGIN_VERSION_BASE\s*=\s*"v9\.7\.[0-9]"' -and -not ($version -match '^9\.7\.')))

# ── C · v9.8.0 治根 (将仍是核心不变量) ──
Write-Host ''
Write-Host 'C. v9.8.0 守一不离 (forever invariant since v9.8.0)' -ForegroundColor Yellow

$pat_no_addl_in_tags = '(?ms)const SIDE_CHANNEL_TAGS\s*=\s*\[[^\]]*"additional_metadata"'
Test-Cond 'SIDE_CHANNEL_TAGS NO additional_metadata' (-not ($src -match $pat_no_addl_in_tags))

$pat_build_helper = 'function\s+_buildAllFieldEntry\s*\(c,\s*mode\)'
Test-Cond '_buildAllFieldEntry helper exists' ($src -match $pat_build_helper)
Test-Cond '_buildAllFieldEntry calls strip'   ($src -match 'stripSideChannelBlocks\(after\)')
Test-Cond '_buildAllFieldEntry calls neutralize' ($src -match 'neutralizeHiddenOverrides\(after\)')
Test-Cond 'main handler uses _buildAllFieldEntry' ($src -match '_buildAllFieldEntry\(c,\s*SP_MODE\)')

$pat_lastindex_fix = 'SIDE_CHANNEL_TAGS_RE\.lastIndex\s*=\s*0[\s\S]{0,80}MEMORY_BLOCK_RE\.lastIndex\s*=\s*0'
Test-Cond 'hasSideChannels resets lastIndex (g flag fix)' ($src -match $pat_lastindex_fix)

# ── D · live ping ──
if ($SkipLive) {
    Write-Host ''
    Write-Host 'D. Live ping · SKIPPED (-SkipLive)' -ForegroundColor DarkGray
}
else {
    Write-Host ''
    Write-Host ('D. Live ping (local node ' + $srcJs + ')') -ForegroundColor Yellow
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host '  (skip · node not in PATH)' -ForegroundColor DarkYellow
    } else {
        $tmpPort = if ($env:DAO_PROXY_PORT) { [int]$env:DAO_PROXY_PORT } else { Get-Random -Minimum 18890 -Maximum 18988 }
        $env:ORIGIN_PORT = "$tmpPort"
        $stdout = Join-Path $env:TEMP ("dao_smoke_stdout_$tmpPort.log")
        $stderr = Join-Path $env:TEMP ("dao_smoke_stderr_$tmpPort.log")
        $proc = Start-Process -FilePath 'node' -ArgumentList @($srcJs) -WorkingDirectory $ProjectRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        Start-Sleep -Seconds 2
        try {
            $ping = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/origin/ping" -f $tmpPort) -TimeoutSec 5
            Test-Cond 'ping ok'                              ($ping.ok -eq $true)
            Test-Cond 'ping mode valid'                       (@('invert','passthrough') -contains $ping.mode) ("mode=" + $ping.mode)
            if ($ping.features) {
                Test-Cond ('features.mode contains v' + $version) ($ping.features.mode -match ('v' + [regex]::Escape($version)))
                Test-Cond 'features.tao_header_chars > 0'         ($ping.features.tao_header_chars -gt 0)
                Test-Cond 'features.dao_chars > 5000'             ($ping.features.dao_chars -gt 5000)
                Test-Cond 'features.inject_total_chars in 6500..8500' ($ping.features.inject_total_chars -ge 6500 -and $ping.features.inject_total_chars -le 8500) ("real=" + $ping.features.inject_total_chars)
            }

            # E · strip-test (若同目存在)
            $stripTest = Join-Path $PSScriptRoot '_v980_strip_test.js'
            if (Test-Path $stripTest) {
                Write-Host ''
                Write-Host ('E. Strip behavior (node ' + (Split-Path -Leaf $stripTest) + ')') -ForegroundColor Yellow
                $stripOut = & node $stripTest 2>&1 | Out-String
                $jsonLine = ($stripOut -split "`n" | Where-Object { $_ -match '^\s*\{' } | Select-Object -Last 1)
                if ($jsonLine) {
                    try {
                        $sj = $jsonLine | ConvertFrom-Json
                        Test-Cond 'strip KEEPS additional_metadata tag' ($sj.hasAddl -eq $true)
                        Test-Cond 'strip KEEPS Cascade ID line'         ($sj.hasCID -eq $true)
                        Test-Cond 'hasSideChannels FALSE for additional_metadata' ($sj.hsc_addl -eq $false)
                        Test-Cond 'hasSideChannels TRUE for user_rules' ($sj.hsc_userrules -eq $true)
                    } catch {
                        Write-Host ('  X strip-test JSON parse: ' + $_.Exception.Message) -ForegroundColor Red
                        $script:fail++
                    }
                } else {
                    Write-Host ('  (no JSON line in strip-test output · check ' + $stripTest + ')') -ForegroundColor DarkYellow
                    $script:fail++
                }
            }
        } catch {
            Write-Host ('  X http err: ' + $_.Exception.Message) -ForegroundColor Red
            $script:fail++
        } finally {
            if ($proc -and -not $proc.HasExited) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
            Remove-Item Env:\ORIGIN_PORT -ErrorAction SilentlyContinue
        }
    }
}

# ── F · extension.js + package.json ──
Write-Host ''
Write-Host 'F. extension.js + package.json' -ForegroundColor Yellow
$ext = Get-Content $extJs -Raw -Encoding UTF8
Test-Cond ('extension.js mentions v' + $version) ($ext -match ('v' + [regex]::Escape($version)))
Test-Cond 'extension.js TAO_HEADER mirror unchanged' ($ext -match 'const TAO_HEADER\s*=\s*"You are Cascade，所遵守规则全部来自下述德道经：\\n\\n"')

Write-Host ''
Write-Host ('═══ pass={0} · fail={1} ═══' -f $pass, $fail) -ForegroundColor Cyan
if ($fail -eq 0) {
    Write-Host 'OK · 一切如一' -ForegroundColor Green
    exit 0
} else {
    Write-Host 'X · has fails' -ForegroundColor Red
    exit 1
}
