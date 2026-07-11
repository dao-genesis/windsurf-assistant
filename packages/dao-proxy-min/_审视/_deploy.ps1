# -*- _deploy.ps1 · 万法部署 · 版本驱动 · 道法自然 -*-
#
# 道义:
#   二十五章「道法自然」· 版本从 package.json · 主从环境 · 不写死
#   三十二章「侯王若能守之·万物将自宾」· 不 kill 既有 Windsurf · 主公 Reload Window 自激
#   四十八章「为道日损」· 一脚本代万版 _deploy_179_v9XX.ps1
#
# 用例:
#   . _deploy.ps1                           # 默配 (用 _dao.env.json + ENV + 交互)
#   . _deploy.ps1 -Version 9.8.0            # 显指版
#   . _deploy.ps1 -Computer 10.0.0.5 -User alice
#   . _deploy.ps1 -DryRun                   # 仅显配 不行
#
# 环境变量 (可代之):
#   $env:DAO_REMOTE_HOST  $env:DAO_REMOTE_USER  $env:DAO_REMOTE_PASS
#   $env:DAO_PROJECT_ROOT  $env:DAO_REMOTE_EXT_DIR

param(
    [string]$Version,
    [string]$Computer,
    [string]$User,
    [string]$ConfigFile,
    [string]$VsixPath,
    [switch]$StartIfDead,
    [switch]$DryRun,
    [switch]$NoInteractive
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()

. (Join-Path $PSScriptRoot '_dao.config.ps1')

$cfg = Get-DaoConfig -ConfigFile:$ConfigFile -NoInteractive:$NoInteractive
if ($Computer) { $cfg.Computer = $Computer }
if ($User)     { $cfg.User     = $User; $cfg.Credential = $null }
if ($Version)  { $cfg.Version  = $Version; $cfg.VsixPath = Join-Path $cfg.ProjectRoot ("dao-proxy-min-{0}.vsix" -f $Version) }
if ($VsixPath) { $cfg.VsixPath = $VsixPath }

# 凭证若被 -User 重置 · 重取
if (-not $cfg.Credential) {
    if ($env:DAO_REMOTE_PASS) {
        $sec = ConvertTo-SecureString $env:DAO_REMOTE_PASS -AsPlainText -Force
        $cfg.Credential = New-Object System.Management.Automation.PSCredential($cfg.User, $sec)
    } elseif (-not $NoInteractive) {
        $sec = Read-Host -Prompt "Password for $($cfg.User)@$($cfg.Computer)" -AsSecureString
        $cfg.Credential = New-Object System.Management.Automation.PSCredential($cfg.User, $sec)
    } else {
        throw 'No credential available'
    }
}

if (-not (Test-Path $cfg.VsixPath)) {
    throw "VSIX not found: $($cfg.VsixPath) · Pack first via _pack_vsix.ps1"
}

$vsixSize = (Get-Item $cfg.VsixPath).Length
$vsixHash = (Get-FileHash $cfg.VsixPath -Algorithm SHA256).Hash.Substring(0,16)

Write-Host '═══ Dao Proxy Min · Universal Deploy ═══' -ForegroundColor Cyan
Show-DaoConfig -Config $cfg
Write-Host ('  VSIX size    : {0} bytes · SHA[0:16]={1}' -f $vsixSize, $vsixHash)
Write-Host ''

if ($DryRun) {
    Write-Host '(DryRun · 不行 · 仅显配)' -ForegroundColor Yellow
    return
}

$targetDirName = "dao-agi.dao-proxy-min-$($cfg.Version)"
$vsixName      = Split-Path -Leaf $cfg.VsixPath

$s = New-PSSession -ComputerName $cfg.Computer -Credential $cfg.Credential -Authentication Negotiate -ErrorAction Stop
try {
    Write-Host '─── 1/5 · Connect ───' -ForegroundColor Yellow
    $remoteInfo = Invoke-Command -Session $s -ScriptBlock {
        @{
            Host        = $env:COMPUTERNAME
            UserProfile = $env:USERPROFILE
            ExtRootEnv  = $env:DAO_REMOTE_EXT_DIR
        }
    }
    $remoteExtRoot = if ($cfg.RemoteExtDir) { $cfg.RemoteExtDir }
                    elseif ($remoteInfo.ExtRootEnv) { $remoteInfo.ExtRootEnv }
                    else { Join-Path $remoteInfo.UserProfile '.windsurf\extensions' }
    Write-Host ('  Remote: {0} · UserProfile: {1}' -f $remoteInfo.Host, $remoteInfo.UserProfile)
    Write-Host ('  Ext root: {0}' -f $remoteExtRoot)

    Write-Host ''
    Write-Host '─── 2/5 · Purge old dao-agi.* ───' -ForegroundColor Yellow
    $cleaned = Invoke-Command -Session $s -ScriptBlock {
        param($extRoot)
        $purged = @()
        if (Test-Path $extRoot) {
            Get-ChildItem $extRoot -Directory -ErrorAction SilentlyContinue | Where-Object {
                $_.Name -like 'dao-agi.dao-proxy-min-*' -or $_.Name -like 'dao-agi.dao-agi-*'
            } | ForEach-Object {
                $purged += $_.Name
                try { Remove-Item $_.FullName -Recurse -Force -ErrorAction Stop }
                catch { Write-Host ('  WARN purge {0} failed (Windsurf may hold lock · skip): {1}' -f $_.Name, $_.Exception.Message) -ForegroundColor DarkYellow }
            }
        }
        return $purged
    } -ArgumentList $remoteExtRoot
    if ($cleaned.Count -gt 0) { foreach ($n in $cleaned) { Write-Host ('  purged: {0}' -f $n) } }
    else { Write-Host '  (no old install)' -ForegroundColor DarkGray }

    Write-Host ''
    Write-Host '─── 3/5 · Transfer VSIX ───' -ForegroundColor Yellow
    $remoteTmp = Invoke-Command -Session $s -ScriptBlock {
        param($name)
        $p = Join-Path $env:TEMP ("dao-deploy-{0}-{1}" -f $name, (Get-Random))
        New-Item -ItemType Directory -Path $p -Force | Out-Null
        return $p
    } -ArgumentList $cfg.Version
    Copy-Item -Path $cfg.VsixPath -Destination (Join-Path $remoteTmp $vsixName) -ToSession $s -Force
    $remoteStat = Invoke-Command -Session $s -ScriptBlock {
        param($tmp, $name)
        $f = Join-Path $tmp $name
        @{ size = (Get-Item $f).Length; hash = (Get-FileHash $f -Algorithm SHA256).Hash.Substring(0,16) }
    } -ArgumentList $remoteTmp, $vsixName
    if ($remoteStat.size -ne $vsixSize) { throw "VSIX size mismatch: local=$vsixSize remote=$($remoteStat.size)" }
    if ($remoteStat.hash -ne $vsixHash) { throw "VSIX hash mismatch: local=$vsixHash remote=$($remoteStat.hash)" }
    Write-Host ('  transferred {0} bytes · SHA[0:16]={1} (match)' -f $remoteStat.size, $remoteStat.hash)

    Write-Host ''
    Write-Host '─── 4/5 · Extract ───' -ForegroundColor Yellow
    $extract = Invoke-Command -Session $s -ScriptBlock {
        param($tmp, $name, $extRoot, $dirName)
        if (-not (Test-Path $extRoot)) { New-Item -ItemType Directory -Path $extRoot -Force | Out-Null }
        $target = Join-Path $extRoot $dirName
        $vsix   = Join-Path $tmp $name
        if (Test-Path $target) {
            try { Remove-Item $target -Recurse -Force -ErrorAction Stop }
            catch { throw "Old target locked: $($_.Exception.Message) · Reload Window then retry" }
        }
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $tmpExtract = Join-Path $tmp 'extract'
        New-Item -ItemType Directory -Path $tmpExtract -Force | Out-Null
        [System.IO.Compression.ZipFile]::ExtractToDirectory($vsix, $tmpExtract)
        Copy-Item (Join-Path $tmpExtract 'extension\*') $target -Recurse -Force
        Remove-Item $tmp -Recurse -Force
        $files = (Get-ChildItem $target -Recurse -File | Measure-Object).Count
        $size  = (Get-ChildItem $target -Recurse -File | Measure-Object -Property Length -Sum).Sum
        @{ target = $target; count = $files; size = $size }
    } -ArgumentList $remoteTmp, $vsixName, $remoteExtRoot, $targetDirName
    Write-Host ('  to: {0}' -f $extract.target)
    Write-Host ('  files: {0} · {1} KB' -f $extract.count, [math]::Round($extract.size/1KB,1))

    Write-Host ''
    Write-Host '─── 5/5 · Register extensions.json ───' -ForegroundColor Yellow
    $reg = Invoke-Command -Session $s -ScriptBlock {
        param($extRoot, $dirName, $version)
        $mf = Join-Path $extRoot 'extensions.json'
        $bak = "$mf.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        if (Test-Path $mf) { Copy-Item $mf $bak -Force }
        $arr = if (Test-Path $mf) { @(Get-Content $mf -Raw -Encoding UTF8 | ConvertFrom-Json) } else { @() }
        $before = $arr.Count
        $arr = @($arr | Where-Object {
            $_.identifier.id -notlike 'dao-agi.dao-proxy-min*' -and
            $_.identifier.id -notlike 'dao-agi.dao-agi*'
        })
        $now = [int64]([datetime]::UtcNow - (Get-Date '1970-01-01')).TotalMilliseconds
        $up  = $env:USERPROFILE.Replace('\','/')
        $entry = [PSCustomObject]@{
            identifier = [PSCustomObject]@{ id = 'dao-agi.dao-proxy-min' }
            version    = $version
            location   = [PSCustomObject]@{
                '$mid'   = 1
                fsPath   = (Join-Path $extRoot $dirName)
                _sep     = 1
                external = "file:///$($up.Replace(':','%3A'))/.windsurf/extensions/$dirName"
                path     = "/$up/.windsurf/extensions/$dirName"
                scheme   = 'file'
            }
            relativeLocation = $dirName
            metadata         = [PSCustomObject]@{ installedTimestamp = $now; source = 'vsix' }
        }
        $arr += $entry
        $tmp = "$mf.tmp"
        $json = $arr | ConvertTo-Json -Depth 20 -Compress:$false
        [System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false))
        Move-Item $tmp $mf -Force
        @{ before = $before; after = $arr.Count; entry = $dirName; bak = $bak }
    } -ArgumentList $remoteExtRoot, $targetDirName, $cfg.Version
    Write-Host ('  extensions.json: {0} -> {1}' -f $reg.before, $reg.after)
    Write-Host ('  entry: {0}' -f $reg.entry)
    Write-Host ('  backup: {0}' -f $reg.bak)

    Write-Host ''
    Write-Host '─── Optional · Windsurf process state (no kill) ───' -ForegroundColor Yellow
    $ws = Invoke-Command -Session $s -ScriptBlock {
        $procs = @(Get-Process Windsurf -ErrorAction SilentlyContinue)
        @{ count = $procs.Count; pids = ($procs | ForEach-Object { $_.Id }) }
    }
    if ($ws.count -gt 0) {
        Write-Host ('  Windsurf alive: {0} proc · pids: {1}' -f $ws.count, ($ws.pids -join ', ')) -ForegroundColor Green
        Write-Host '  Activate: Ctrl+Shift+P -> "Developer: Reload Window"' -ForegroundColor Cyan
    } else {
        Write-Host '  Windsurf not running' -ForegroundColor DarkGray
        if ($StartIfDead) {
            Write-Host '  -StartIfDead set · trying to launch...' -ForegroundColor Yellow
            $st = Invoke-Command -Session $s -ScriptBlock {
                $exe = "$env:LOCALAPPDATA\Programs\Windsurf\Windsurf.exe"
                if (-not (Test-Path $exe)) {
                    $alt = Get-ChildItem "$env:LOCALAPPDATA\Programs" -Filter 'Windsurf.exe' -Recurse -ErrorAction SilentlyContinue -Depth 3 | Select-Object -First 1
                    if ($alt) { $exe = $alt.FullName }
                }
                if (Test-Path $exe) {
                    $shell = New-Object -ComObject WScript.Shell
                    $shell.Run("`"$exe`"", 1, $false) | Out-Null
                    return @{ started = $true; exe = $exe }
                }
                return @{ started = $false; exe = $exe }
            }
            if ($st.started) { Write-Host ('  started: {0}' -f $st.exe) -ForegroundColor Green }
            else { Write-Host ('  Windsurf.exe not found ({0})' -f $st.exe) -ForegroundColor Red }
        }
    }

    Write-Host ''
    Write-Host ('═══ Deploy v{0} done · 守一不离 ═══' -f $cfg.Version) -ForegroundColor Green
    Write-Host '  二十五章「道法自然」· 三十二章「侯王若能守之·万物将自宾」'
    Write-Host '  Reload Window in IDE to activate.'
}
finally {
    Remove-PSSession $s
}
