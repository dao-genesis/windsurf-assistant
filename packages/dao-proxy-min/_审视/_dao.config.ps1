# -*- _dao.config.ps1 · 万法配加载器 · 唯变所适 · 道法自然 -*-
#
# 道义:
#   二十五章「人法地·地法天·天法道·道法自然」· 配从用户·从环境·从默
#   六十四章「为者败之·执者失之」· 不写死 · 不强求
#   四十八章「为道日损·损之又损」· 一处之配 · 万脚本之用
#
# 解析顺 (前胜后):
#   1. ENV 变量 (DAO_REMOTE_HOST / DAO_REMOTE_USER / DAO_REMOTE_PASS / DAO_PROJECT_ROOT / DAO_REMOTE_EXT_DIR / DAO_PROXY_PORT)
#   2. JSON 文件 (-ConfigFile <path> · 默 _审视/_dao.env.json · 不入 git/vsix)
#   3. 交互 prompt (-Interactive · 默 $true · 缺 password 必走 SecureString)
#   4. 不可解 → 抛 (除非 -AllowMissing)
#
# 用:
#   . "$PSScriptRoot\_dao.config.ps1"
#   $cfg = Get-DaoConfig
#   $sess = New-PSSession -ComputerName $cfg.Computer -Credential $cfg.Credential -Authentication Negotiate
#
# 守:
#   - 永不在脚本中写 plaintext password
#   - JSON 之 'Password' 字段不读 (防误存); 仅取 'PasswordFile' (DPAPI 加密文件 · Export-Clixml)
#   - 或用 ENV $env:DAO_REMOTE_PASS (CI / 临时 shell)
#   - 否则交互 Read-Host -AsSecureString

function Get-DaoConfig {
    [CmdletBinding()]
    param(
        [string]$ConfigFile,
        [string]$ProjectRoot,
        [switch]$NoInteractive,
        [switch]$AllowMissing
    )

    if (-not $ProjectRoot) {
        $ProjectRoot = Split-Path -Parent $PSScriptRoot
    }
    if (-not $ConfigFile) {
        $ConfigFile = Join-Path $PSScriptRoot '_dao.env.json'
    }

    # 步 1 · 默
    $cfg = [ordered]@{
        Computer        = '127.0.0.1'
        User            = $env:USERNAME
        ProjectRoot     = $ProjectRoot
        RemoteExtDir    = $null   # 远端解析时取 $env:USERPROFILE\.windsurf\extensions
        ProxyPort       = 8889
        Version         = $null   # 自 package.json 派
        VsixPath        = $null   # 自 ProjectRoot\dao-proxy-min-<Version>.vsix 派
        PasswordFile    = $null
        Credential      = $null
        Source          = @()     # 跟踪每键来源, 利于诊
    }

    # 步 2 · JSON 文件 (中胜)
    if (Test-Path $ConfigFile) {
        try {
            $j = Get-Content -LiteralPath $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($k in @('Computer','User','RemoteExtDir','PasswordFile')) {
                if ($null -ne $j.$k -and "$($j.$k)" -ne '') {
                    $cfg[$k] = $j.$k
                    $cfg.Source += "$k<-json"
                }
            }
            if ($null -ne $j.ProxyPort) {
                $cfg.ProxyPort = [int]$j.ProxyPort
                $cfg.Source += 'ProxyPort<-json'
            }
            if ($null -ne $j.Password -and "$($j.Password)" -ne '') {
                Write-Warning "_dao.env.json contains plaintext 'Password' field · IGNORED for safety. Use PasswordFile (Export-Clixml) or `$env:DAO_REMOTE_PASS instead."
            }
        } catch {
            Write-Warning "Read $ConfigFile failed: $($_.Exception.Message) · skipping JSON layer"
        }
    }

    # 步 3 · ENV (高胜)
    if ($env:DAO_REMOTE_HOST)    { $cfg.Computer    = $env:DAO_REMOTE_HOST;    $cfg.Source += 'Computer<-env' }
    if ($env:DAO_REMOTE_USER)    { $cfg.User        = $env:DAO_REMOTE_USER;    $cfg.Source += 'User<-env' }
    if ($env:DAO_PROJECT_ROOT)   { $cfg.ProjectRoot = $env:DAO_PROJECT_ROOT;   $cfg.Source += 'ProjectRoot<-env' }
    if ($env:DAO_REMOTE_EXT_DIR) { $cfg.RemoteExtDir= $env:DAO_REMOTE_EXT_DIR; $cfg.Source += 'RemoteExtDir<-env' }
    if ($env:DAO_PROXY_PORT)     { $cfg.ProxyPort   = [int]$env:DAO_PROXY_PORT; $cfg.Source += 'ProxyPort<-env' }

    # 步 4 · Version 自 package.json
    $pkgPath = Join-Path $cfg.ProjectRoot 'package.json'
    if (Test-Path $pkgPath) {
        try {
            $pkg = Get-Content $pkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($pkg.version) {
                $cfg.Version = "$($pkg.version)"
                $cfg.Source += 'Version<-package.json'
            }
        } catch {
            Write-Warning "Read package.json failed: $($_.Exception.Message)"
        }
    }
    if (-not $cfg.Version -and -not $AllowMissing) {
        throw "Cannot resolve Version from $pkgPath"
    }

    # 步 5 · VsixPath
    if ($cfg.Version) {
        $cfg.VsixPath = Join-Path $cfg.ProjectRoot ("dao-proxy-min-{0}.vsix" -f $cfg.Version)
    }

    # 步 6 · Credential 取
    $secPwd = $null
    if ($env:DAO_REMOTE_PASS) {
        $secPwd = ConvertTo-SecureString $env:DAO_REMOTE_PASS -AsPlainText -Force
        $cfg.Source += 'Password<-env'
    } elseif ($cfg.PasswordFile -and (Test-Path $cfg.PasswordFile)) {
        try {
            $secPwd = Import-Clixml -LiteralPath $cfg.PasswordFile
            if ($secPwd -is [System.Management.Automation.PSCredential]) {
                $cfg.Credential = $secPwd
                $secPwd = $null
                $cfg.Source += 'Credential<-PasswordFile(clixml)'
            } else {
                $cfg.Source += 'Password<-PasswordFile(clixml)'
            }
        } catch {
            Write-Warning "Read PasswordFile failed: $($_.Exception.Message)"
        }
    } elseif (-not $NoInteractive -and -not $AllowMissing) {
        $secPwd = Read-Host -Prompt "Password for $($cfg.User)@$($cfg.Computer)" -AsSecureString
        $cfg.Source += 'Password<-prompt'
    }

    if (-not $cfg.Credential -and $secPwd) {
        $cfg.Credential = New-Object System.Management.Automation.PSCredential($cfg.User, $secPwd)
    }
    if (-not $cfg.Credential -and -not $AllowMissing) {
        throw "Cannot resolve Credential. Provide one via: `$env:DAO_REMOTE_PASS, _dao.env.json[PasswordFile], or interactive prompt."
    }

    return $cfg
}

function Show-DaoConfig {
    param([Parameter(Mandatory)]$Config)
    Write-Host '─── Dao Config ───' -ForegroundColor Cyan
    Write-Host ('  Computer     : {0}' -f $Config.Computer)
    Write-Host ('  User         : {0}' -f $Config.User)
    Write-Host ('  ProjectRoot  : {0}' -f $Config.ProjectRoot)
    Write-Host ('  Version      : {0}' -f $Config.Version)
    Write-Host ('  VsixPath     : {0}' -f $Config.VsixPath)
    Write-Host ('  ProxyPort    : {0}' -f $Config.ProxyPort)
    if ($Config.RemoteExtDir) { $extDirShow = $Config.RemoteExtDir } else { $extDirShow = '<auto: $env:USERPROFILE\.windsurf\extensions>' }
    Write-Host ('  RemoteExtDir : {0}' -f $extDirShow)
    Write-Host ('  Credential   : {0}' -f $(if ($Config.Credential) { '<set>' } else { '<missing>' }))
    Write-Host ('  Source       : {0}' -f ($Config.Source -join ' | '))
}
