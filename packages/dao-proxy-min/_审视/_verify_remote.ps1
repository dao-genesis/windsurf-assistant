# -*- _verify_remote.ps1 · 万法远验 · 道法自然 -*-
#
# 道义:
#   二十一章「其精甚真·其中有信」· 远端实物之真验
#   四十八章「为道日损」· 一脚本代万版 _verify_179_v9XX.ps1
#
# 验:
#   1. 远端 ext dir 存在 + 文件量 + 总尺寸
#   2. source.js 含本版 ORIGIN_VERSION_BASE
#   3. v9.8.0 不变量: SIDE_CHANNEL_TAGS 无 'additional_metadata' / _buildAllFieldEntry 在 / lastIndex 修
#   4. 可选 · 以 -RunStripTest 运 _v980_strip_test.js 于远端 node 直击 deployed source.js
#
# 用:
#   . _verify_remote.ps1
#   . _verify_remote.ps1 -RunStripTest
#   . _verify_remote.ps1 -Version 9.8.0 -Computer 10.0.0.5

param(
    [string]$Version,
    [string]$Computer,
    [string]$User,
    [string]$ConfigFile,
    [switch]$RunStripTest,
    [switch]$NoInteractive
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

. (Join-Path $PSScriptRoot '_dao.config.ps1')
$cfg = Get-DaoConfig -ConfigFile:$ConfigFile -NoInteractive:$NoInteractive
if ($Computer) { $cfg.Computer = $Computer }
if ($User)     { $cfg.User     = $User; $cfg.Credential = $null }
if ($Version)  { $cfg.Version  = $Version }

if (-not $cfg.Credential) {
    if ($env:DAO_REMOTE_PASS) {
        $sec = ConvertTo-SecureString $env:DAO_REMOTE_PASS -AsPlainText -Force
        $cfg.Credential = New-Object System.Management.Automation.PSCredential($cfg.User, $sec)
    } elseif (-not $NoInteractive) {
        $sec = Read-Host -Prompt "Password for $($cfg.User)@$($cfg.Computer)" -AsSecureString
        $cfg.Credential = New-Object System.Management.Automation.PSCredential($cfg.User, $sec)
    } else { throw 'No credential available' }
}

Write-Host ('═══ Dao Proxy Min · Universal Remote Verify · v{0} ═══' -f $cfg.Version) -ForegroundColor Cyan
Show-DaoConfig -Config $cfg
Write-Host ''

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

$s = New-PSSession -ComputerName $cfg.Computer -Credential $cfg.Credential -Authentication Negotiate -ErrorAction Stop
try {
    $report = Invoke-Command -Session $s -ScriptBlock {
        param($version, $extRootOverride)
        $extRoot = if ($extRootOverride) { $extRootOverride } else { Join-Path $env:USERPROFILE '.windsurf\extensions' }
        $dir = Join-Path $extRoot ("dao-agi.dao-proxy-min-$version")
        $r = [ordered]@{
            ExtRoot       = $extRoot
            TargetDir     = $dir
            DirExists     = (Test-Path $dir)
            FileCount     = 0
            TotalKB       = 0
            SourceJsSize  = 0
            HasVersionTag = $false
            NoAdditionalMetadata = $false
            HasBuildAllFieldHelper = $false
            HasLastIndexFix = $false
            ExtJsonHasEntry = $false
            ExtJsonVersion  = $null
        }
        if ($r.DirExists) {
            $files = Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue
            $r.FileCount = $files.Count
            $r.TotalKB   = [math]::Round(($files | Measure-Object -Property Length -Sum).Sum / 1KB, 1)
            $src = Join-Path $dir 'vendor\bundled-origin\source.js'
            if (Test-Path $src) {
                $r.SourceJsSize = (Get-Item $src).Length
                $c = Get-Content $src -Raw -Encoding UTF8
                $r.HasVersionTag           = ($c -match ('ORIGIN_VERSION_BASE\s*=\s*"v' + [regex]::Escape($version) + '"'))
                $r.NoAdditionalMetadata    = (-not ($c -match '(?ms)const SIDE_CHANNEL_TAGS\s*=\s*\[[^\]]*"additional_metadata"'))
                $r.HasBuildAllFieldHelper  = ($c -match 'function\s+_buildAllFieldEntry\s*\(c,\s*mode\)')
                $r.HasLastIndexFix         = ($c -match 'SIDE_CHANNEL_TAGS_RE\.lastIndex\s*=\s*0[\s\S]{0,80}MEMORY_BLOCK_RE\.lastIndex\s*=\s*0')
            }
        }
        $mf = Join-Path $extRoot 'extensions.json'
        if (Test-Path $mf) {
            try {
                $raw = Get-Content $mf -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($raw -is [System.Array]) { $items = $raw } else { $items = @($raw) }
                $hit = $null
                foreach ($e in $items) {
                    if ($e.identifier -and $e.identifier.id -eq 'dao-agi.dao-proxy-min') {
                        $hit = $e; break
                    }
                }
                if ($hit) {
                    $r.ExtJsonHasEntry = $true
                    $r.ExtJsonVersion  = "$($hit.version)"
                }
            } catch {}
        }
        return $r
    } -ArgumentList $cfg.Version, $cfg.RemoteExtDir

    Write-Host '─── 1 · ext dir ───' -ForegroundColor Yellow
    Write-Host ('  TargetDir : {0}' -f $report.TargetDir)
    Test-Cond 'extension dir exists'  $report.DirExists
    Test-Cond 'has files'             ($report.FileCount -gt 0) ("count=" + $report.FileCount)
    Test-Cond 'total size > 50 KB'    ($report.TotalKB -gt 50)  ("size=" + $report.TotalKB + " KB")

    Write-Host ''
    Write-Host '─── 2 · source.js · v9.8.0 invariants ───' -ForegroundColor Yellow
    Test-Cond ('source.js present (size=' + $report.SourceJsSize + ' bytes)') ($report.SourceJsSize -gt 50000)
    Test-Cond ('source.js has ORIGIN_VERSION_BASE = v' + $cfg.Version)        $report.HasVersionTag
    Test-Cond 'source.js NO additional_metadata in SIDE_CHANNEL_TAGS'         $report.NoAdditionalMetadata
    Test-Cond 'source.js has _buildAllFieldEntry helper'                       $report.HasBuildAllFieldHelper
    Test-Cond 'source.js has hasSideChannels lastIndex fix'                    $report.HasLastIndexFix

    Write-Host ''
    Write-Host '─── 3 · extensions.json registration ───' -ForegroundColor Yellow
    Test-Cond 'extensions.json has dao-proxy-min entry' $report.ExtJsonHasEntry ("version=" + $report.ExtJsonVersion)
    Test-Cond ('extensions.json version = ' + $cfg.Version) ($report.ExtJsonVersion -eq $cfg.Version)

    if ($RunStripTest) {
        Write-Host ''
        Write-Host '─── 4 · strip-test on remote node ───' -ForegroundColor Yellow
        $stripTestLocal = Join-Path $PSScriptRoot '_v980_strip_test.js'
        if (-not (Test-Path $stripTestLocal)) {
            Write-Host ('  (skip · ' + $stripTestLocal + ' missing)') -ForegroundColor DarkYellow
        } else {
            $remoteScratch = Invoke-Command -Session $s -ScriptBlock {
                param($v)
                $p = Join-Path $env:TEMP ("dao-verify-{0}-{1}" -f $v, (Get-Random))
                New-Item -ItemType Directory -Path "$p\_审视" -Force | Out-Null
                New-Item -ItemType Directory -Path "$p\vendor\bundled-origin" -Force | Out-Null
                $depDir = Join-Path $env:USERPROFILE (".windsurf\extensions\dao-agi.dao-proxy-min-$v")
                $depSrc = Join-Path $depDir 'vendor\bundled-origin\source.js'
                if (Test-Path $depSrc) { Copy-Item -LiteralPath $depSrc -Destination "$p\vendor\bundled-origin\source.js" -Force }
                foreach ($n in '_silk_dao.txt','_silk_de.txt') {
                    $f = Join-Path $depDir ('vendor\bundled-origin\' + $n)
                    if (Test-Path $f) { Copy-Item -LiteralPath $f -Destination "$p\vendor\bundled-origin\$n" -Force }
                }
                @{ Root = $p; Audit = "$p\_审视" }
            } -ArgumentList $cfg.Version
            Copy-Item -Path $stripTestLocal -Destination ($remoteScratch.Audit + '\_v980_strip_test.js') -ToSession $s -Force
            $tres = Invoke-Command -Session $s -ScriptBlock {
                param($audit)
                $script = Join-Path $audit '_v980_strip_test.js'
                $out = & node $script 2>&1
                @{ output = ($out -join "`n"); exit = $LASTEXITCODE }
            } -ArgumentList $remoteScratch.Audit
            Write-Host '  ─ node output ─' -ForegroundColor DarkGray
            Write-Host $tres.output
            Test-Cond 'remote strip-test exit=0' ($tres.exit -eq 0)
            $jsonLine = ($tres.output -split "`n" | Where-Object { $_ -match '^\s*\{' } | Select-Object -Last 1)
            if ($jsonLine) {
                try {
                    $sj = $jsonLine | ConvertFrom-Json
                    Test-Cond 'remote: strip KEEPS additional_metadata' ($sj.hasAddl -eq $true)
                    Test-Cond 'remote: strip KEEPS Cascade ID'           ($sj.hasCID -eq $true)
                    Test-Cond 'remote: hasSideChannels FALSE for additional_metadata' ($sj.hsc_addl -eq $false)
                    Test-Cond 'remote: hasSideChannels TRUE for user_rules' ($sj.hsc_userrules -eq $true)
                } catch {
                    Write-Host ('  X parse: ' + $_.Exception.Message) -ForegroundColor Red
                    $script:fail++
                }
            }
            Invoke-Command -Session $s -ScriptBlock {
                param($p) Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
            } -ArgumentList $remoteScratch.Root
        }
    }

    Write-Host ''
    Write-Host ('═══ pass={0} · fail={1} ═══' -f $pass, $fail) -ForegroundColor Cyan
    if ($fail -eq 0) {
        Write-Host 'OK · 远端实物即真 · 其中有信' -ForegroundColor Green
        $exit = 0
    } else {
        Write-Host 'X · has fails' -ForegroundColor Red
        $exit = 1
    }
}
finally {
    Remove-PSSession $s
}
exit $exit
