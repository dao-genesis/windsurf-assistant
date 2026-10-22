# ═══════════════════════════════════════════════════════════════════════════
# windsurf-multi.ps1 · 道法自然 · 多实例启动器 · 一生二 · 二生三 · 三生万物
# ═══════════════════════════════════════════════════════════════════════════
# 帛书·四十二: 道生一，一生二，二生三，三生万物
# 帛书·六十一: 大邦者下流也 · 天下之牝也 · 牝恒以靚胜牡 · 为其靚也故宜为下
#
# 用法:
#   .\windsurf-multi.ps1                       # 交互式选择实例
#   .\windsurf-multi.ps1 -Instance cloud        # 启动 Cloud 专用实例
#   .\windsurf-multi.ps1 -Instance dev           # 启动 Dev 日常实例
#   .\windsurf-multi.ps1 -Instance test          # 启动 Test 测试实例
#   .\windsurf-multi.ps1 -Instance <自定义名>    # 启动任意命名实例
#   .\windsurf-multi.ps1 -List                   # 列出所有已配置实例
#   .\windsurf-multi.ps1 -Kill <名>              # 关闭指定实例
#   .\windsurf-multi.ps1 -KillAll                 # 关闭所有多实例
#   .\windsurf-multi.ps1 -Init                    # 初始化配置文件
#
# 原理:
#   Windsurf = VS Code/Electron → 支持 --user-data-dir
#   不同 user-data-dir = 完全独立的 IDE 实例
#   各实例: 独立认证 / 独立扩展 / 独立 WAM / 独立 cascade
#   Devin Cloud 实例不切号 → session 永不丢失
# ═══════════════════════════════════════════════════════════════════════════

param(
    [string]$Instance = "",
    [switch]$List,
    [switch]$KillAll,
    [string]$Kill = "",
    [switch]$Init,
    [switch]$DryRun
)

$ErrorActionPreference = "Continue"

# ── 常量 ──
#   v3.18.4 · 可移植: Windsurf.exe 自动探测 (PATH → LOCALAPPDATA → ProgramFiles → 注册表卸载项)
$WindsurfExe = $null
foreach ($cand in @(
    (Get-Command Windsurf.exe -ErrorAction SilentlyContinue).Source,
    (Join-Path $env:LOCALAPPDATA "Programs\Windsurf\Windsurf.exe"),
    (Join-Path ${env:ProgramFiles} "Windsurf\Windsurf.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Windsurf\Windsurf.exe")
  )) {
  if ($cand -and (Test-Path $cand)) { $WindsurfExe = $cand; break }
}
if (-not $WindsurfExe) {
  try {
    $un = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*","HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName -match "Windsurf" } | Select-Object -First 1
    if ($un -and $un.InstallLocation) {
      $c = Join-Path $un.InstallLocation "Windsurf.exe"
      if (Test-Path $c) { $WindsurfExe = $c }
    }
  } catch {}
}
$ConfigFile = Join-Path $env:USERPROFILE ".wam-multi" "instances.json"

# ── 默认实例配置 ──
$DefaultInstances = @{
    "cloud" = @{
        desc = "Devin Cloud 专用 · 不切号 · session 永不丢失"
        wamMode = "official"
        color = "Cyan"
    }
    "dev" = @{
        desc = "日常开发 · 可自由切号"
        wamMode = "wam"
        color = "Green"
    }
    "test" = @{
        desc = "测试专用 · 可自由切号"
        wamMode = "wam"
        color = "Yellow"
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════════════════════════

function Write-DaoLog {
    param([string]$Msg, [string]$Color = "White")
    Write-Host $Msg -ForegroundColor $Color
}

function Ensure-Dir {
    param([string]$Dir)
    if (-not (Test-Path $Dir)) {
        New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    }
}

function Get-InstanceConfig {
    if (-not (Test-Path $ConfigFile)) {
        return @{ instances = $DefaultInstances }
    }
    try {
        return Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json -AsHashtable
    } catch {
        return @{ instances = $DefaultInstances }
    }
}

function Save-InstanceConfig {
    param([hashtable]$Config)
    $dir = Split-Path $ConfigFile -Parent
    Ensure-Dir $dir
    $Config | ConvertTo-Json -Depth 5 | Set-Content $ConfigFile -Encoding UTF8 -NoNewline
}

function Get-UserDataDir {
    param([string]$Name)
    # 标准: %APPDATA%\Windsurf-<Name>
    # 默认实例 (无前缀) = %APPDATA%\Windsurf
    if ($Name -eq "default") {
        return Join-Path $env:APPDATA "Windsurf"
    }
    return Join-Path $env:APPDATA "Windsurf-$Name"
}

function Get-WamHomeDir {
    param([string]$Name)
    if ($Name -eq "default") {
        return Join-Path $env:USERPROFILE ".wam"
    }
    return Join-Path $env:USERPROFILE ".wam-$Name"
}

function Get-CodeiumDir {
    param([string]$Name)
    if ($Name -eq "default") {
        return Join-Path $env:USERPROFILE ".codeium"
    }
    return Join-Path $env:USERPROFILE ".codeium-$Name"
}

function Get-ExtensionsDir {
    param([string]$Name)
    # Windsurf stores extensions in ~/.windsurf/extensions by default
    # For multi-instance, each instance gets its own extensions dir
    if ($Name -eq "default") {
        return Join-Path $env:USERPROFILE ".windsurf" "extensions"
    }
    return Join-Path $env:USERPROFILE ".windsurf-$Name" "extensions"
}

function Get-RunningInstances {
    $result = @{}
    $procs = Get-CimInstance Win32_Process -Filter "Name='Windsurf.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
        $cmd = $p.CommandLine
        if ($cmd -match '--user-data-dir\s+"?([^"\s]+)"?') {
            $dataDir = $Matches[1]
            # 从路径提取实例名: Windsurf-Cloud → cloud
            $dirName = Split-Path $dataDir -Leaf
            if ($dirName -match '^Windsurf-(.+)$') {
                $instName = $Matches[1].ToLower()
            } elseif ($dirName -eq "Windsurf") {
                $instName = "default"
            } else {
                $instName = $dirName
            }
            if (-not $result.ContainsKey($instName)) {
                $result[$instName] = @()
            }
            $result[$instName] += $p.ProcessId
        }
    }
    return $result
}

# ═══════════════════════════════════════════════════════════════════════════
# 初始化
# ═══════════════════════════════════════════════════════════════════════════

function Initialize-MultiInstance {
    Write-DaoLog "═══ 初始化 Windsurf 多实例配置 ═══" "Magenta"
    
    $config = Get-InstanceConfig
    Save-InstanceConfig $config
    Write-DaoLog "  配置文件: $ConfigFile" "Gray"
    
    # 为每个默认实例创建目录
    foreach ($name in @("cloud", "dev", "test")) {
        $dataDir = Get-UserDataDir $name
        $wamDir = Get-WamHomeDir $name
        
        Ensure-Dir $dataDir
        Ensure-Dir (Join-Path $dataDir "User")
        Ensure-Dir (Join-Path $dataDir "User" "globalStorage")
        Ensure-Dir $wamDir
        
        Write-DaoLog "  实例 [$name]:" "Cyan"
        Write-DaoLog "    user-data-dir: $dataDir" "Gray"
        Write-DaoLog "    WAM_HOME:      $wamDir" "Gray"
    }
    
    # 创建桌面快捷方式
    $desktop = [Environment]::GetFolderPath("Desktop")
    foreach ($name in @("cloud", "dev", "test")) {
        $lnkPath = Join-Path $desktop "Windsurf-$name.lnk"
        $dataDir = Get-UserDataDir $name
        $extDir = Get-ExtensionsDir $name
        
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($lnkPath)
        $shortcut.TargetPath = $WindsurfExe
        $shortcut.Arguments = "--user-data-dir `"$dataDir`" --extensions-dir `"$extDir`""
        $shortcut.WorkingDirectory = Split-Path $WindsurfExe -Parent
        $shortcut.Description = "Windsurf - $name instance"
        $shortcut.Save()
        
        Write-DaoLog "  快捷方式: $lnkPath" "Gray"
    }
    
    Write-DaoLog ""
    Write-DaoLog "  ✓ 初始化完成 · 桌面已创建 3 个快捷方式" "Green"
    Write-DaoLog "  · Windsurf-cloud.lnk  → Devin Cloud 专用 (不切号)" "Cyan"
    Write-DaoLog "  · Windsurf-dev.lnk    → 日常开发 (可切号)" "Green"
    Write-DaoLog "  · Windsurf-test.lnk   → 测试专用 (可切号)" "Yellow"
}

# ═══════════════════════════════════════════════════════════════════════════
# 列出实例
# ═══════════════════════════════════════════════════════════════════════════

function Show-Instances {
    Write-DaoLog "═══ Windsurf 多实例状态 ═══" "Magenta"
    
    $config = Get-InstanceConfig
    $running = Get-RunningInstances
    
    # 默认实例
    $defaultPids = @()
    if ($running.ContainsKey("default")) {
        $defaultPids = $running["default"]
    }
    $defaultStatus = if ($defaultPids.Count -gt 0) { "▶ 运行中 ($($defaultPids.Count) 进程)" } else { "○ 未运行" }
    Write-DaoLog ""
    Write-DaoLog "  [default]  $defaultStatus" "White"
    Write-DaoLog "    user-data-dir: $(Get-UserDataDir 'default')" "Gray"
    Write-DaoLog "    WAM_HOME:      $(Get-WamHomeDir 'default')" "Gray"
    
    # 配置的实例
    if ($config.instances) {
        foreach ($name in $config.instances.Keys) {
            $inst = $config.instances[$name]
            $pids = @()
            if ($running.ContainsKey($name)) {
                $pids = $running[$name]
            }
            $status = if ($pids.Count -gt 0) { "▶ 运行中 ($($pids.Count) 进程)" } else { "○ 未运行" }
            $color = $inst.color ?? "White"
            
            Write-DaoLog ""
            Write-DaoLog "  [$name]  $status" $color
            Write-DaoLog "    描述:    $($inst.desc)" "Gray"
            Write-DaoLog "    WAM模式: $($inst.wamMode)" "Gray"
            Write-DaoLog "    user-data-dir: $(Get-UserDataDir $name)" "Gray"
            Write-DaoLog "    WAM_HOME:      $(Get-WamHomeDir $name)" "Gray"
        }
    }
    
    # 未配置但正在运行的实例
    foreach ($name in $running.Keys) {
        if ($name -eq "default") { continue }
        if ($config.instances -and $config.instances.ContainsKey($name)) { continue }
        $pids = $running[$name]
        Write-DaoLog ""
        Write-DaoLog "  [$name]  ▶ 运行中 ($($pids.Count) 进程) [未配置]" "DarkYellow"
        Write-DaoLog "    user-data-dir: $(Get-UserDataDir $name)" "Gray"
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# 启动实例
# ═══════════════════════════════════════════════════════════════════════════

function Start-WindsurfInstance {
    param([string]$Name)
    
    if ([string]::IsNullOrWhiteSpace($Name)) {
        # 交互式选择
        Write-DaoLog "═══ 选择要启动的实例 ═══" "Magenta"
        Write-DaoLog ""
        Write-DaoLog "  0) default  — 当前默认实例" "White"
        Write-DaoLog "  1) cloud    — Devin Cloud 专用 (不切号)" "Cyan"
        Write-DaoLog "  2) dev      — 日常开发 (可切号)" "Green"
        Write-DaoLog "  3) test     — 测试专用 (可切号)" "Yellow"
        Write-DaoLog "  4) <自定义> — 输入任意名称" "DarkGray"
        Write-DaoLog ""
        $choice = Read-Host "请选择 [0-4]"
        
        switch ($choice) {
            "0" { $Name = "default" }
            "1" { $Name = "cloud" }
            "2" { $Name = "dev" }
            "3" { $Name = "test" }
            "4" { $Name = Read-Host "输入实例名称" }
            default { $Name = "default" }
        }
    }
    
    $dataDir = Get-UserDataDir $Name
    $wamHome = Get-WamHomeDir $Name
    $extDir = Get-ExtensionsDir $Name
    
    # 确保目录存在
    Ensure-Dir $dataDir
    Ensure-Dir (Join-Path $dataDir "User")
    Ensure-Dir (Join-Path $dataDir "User" "globalStorage")
    Ensure-Dir $wamHome
    Ensure-Dir $extDir
    
    # 检查是否已在运行
    $running = Get-RunningInstances
    if ($running.ContainsKey($Name.ToLower())) {
        Write-DaoLog "  实例 [$Name] 已在运行 (PID: $($running[$Name.ToLower()] -join ', '))" "Yellow"
        Write-DaoLog "  如需重启请先: .\windsurf-multi.ps1 -Kill $Name" "Gray"
        return
    }
    
    # 设置环境变量
    $env:WAM_HOME = $wamHome
    $env:WAM_INSTANCE = $Name
    
    # 获取 WAM 模式
    $config = Get-InstanceConfig
    $wamMode = "wam"
    if ($config.instances -and $config.instances.ContainsKey($Name)) {
        $wamMode = $config.instances[$Name].wamMode ?? "wam"
    }
    if ($Name -eq "cloud") { $wamMode = "official" }
    $env:WAM_MODE_DEFAULT = $wamMode
    
    # 构建 codeium 数据目录环境变量
    $codeiumDir = Get-CodeiumDir $Name
    $env:CODEIUM_DATA_DIR = $codeiumDir
    
    Write-DaoLog "═══ 启动实例 [$Name] ═══" "Magenta"
    Write-DaoLog "  user-data-dir:  $dataDir" "Gray"
    Write-DaoLog "  extensions-dir: $extDir" "Gray"
    Write-DaoLog "  WAM_HOME:       $wamHome" "Gray"
    Write-DaoLog "  WAM_MODE:       $wamMode" "Gray"
    Write-DaoLog "  CODEIUM_DIR:    $codeiumDir" "Gray"
    
    if ($DryRun) {
        Write-DaoLog "  [DryRun] 不实际启动" "Yellow"
        return
    }
    
    # 启动 Windsurf (含 --user-data-dir + --extensions-dir)
    $launchArgs = "--user-data-dir `"$dataDir`" --extensions-dir `"$extDir`""
    
    try {
        $proc = Start-Process $WindsurfExe -ArgumentList $launchArgs -PassThru
        Write-DaoLog "  ✓ 已启动 (PID: $($proc.Id))" "Green"
    } catch {
        Write-DaoLog "  ✗ 启动失败: $_" "Red"
        return
    }
    
    # 等待实例初始化 (给 5 秒)
    Write-DaoLog "  等待实例初始化..." "Gray"
    Start-Sleep -Seconds 3
    
    # 验证实例已启动
    $running = Get-RunningInstances
    if ($running.ContainsKey($Name.ToLower())) {
        Write-DaoLog "  ✓ 实例 [$Name] 运行确认" "Green"
    } else {
        Write-DaoLog "  ⚠ 实例可能仍在初始化中" "Yellow"
    }
    
    Write-DaoLog ""
    Write-DaoLog "  提示:" "Cyan"
    if ($Name -eq "cloud") {
        Write-DaoLog "    · 此实例专用于 Devin Cloud · 建议登录固定账号" "Cyan"
        Write-DaoLog "    · WAM 已设为 official 模式 · 不会自动切号" "Cyan"
        Write-DaoLog "    · 需手动安装 WAM 扩展 (Ctrl+Shift+P → Install from VSIX)" "Gray"
    } else {
        Write-DaoLog "    · 此实例可自由切号 · WAM 模式: $wamMode" "Green"
        Write-DaoLog "    · 需手动安装 WAM 扩展 (Ctrl+Shift+P → Install from VSIX)" "Gray"
    }
    Write-DaoLog "    · 首次启动需登录账号 · 登录后认证状态独立于其他实例" "Gray"
}

# ═══════════════════════════════════════════════════════════════════════════
# 关闭实例
# ═══════════════════════════════════════════════════════════════════════════

function Stop-WindsurfInstance {
    param([string]$Name)
    
    $running = Get-RunningInstances
    $key = $Name.ToLower()
    
    if (-not $running.ContainsKey($key)) {
        Write-DaoLog "  实例 [$Name] 未在运行" "Yellow"
        return
    }
    
    $pids = $running[$key]
    Write-DaoLog "  关闭实例 [$Name] (PID: $($pids -join ', '))..." "Yellow"
    
    foreach ($procId in $pids) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    
    Start-Sleep -Seconds 2
    $running2 = Get-RunningInstances
    if ($running2.ContainsKey($key)) {
        Write-DaoLog "  ⚠ 部分进程仍在运行 · 可能需要手动关闭" "Yellow"
    } else {
        Write-DaoLog "  ✓ 实例 [$Name] 已关闭" "Green"
    }
}

function Stop-AllInstances {
    Write-DaoLog "═══ 关闭所有多实例 ═══" "Magenta"
    
    $running = Get-RunningInstances
    foreach ($name in $running.Keys) {
        if ($name -eq "default") { continue }  # 不关闭默认实例
        Stop-WindsurfInstance $name
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════════════════

if ($Init) {
    Initialize-MultiInstance
} elseif ($List) {
    Show-Instances
} elseif ($KillAll) {
    Stop-AllInstances
} elseif (-not [string]::IsNullOrWhiteSpace($Kill)) {
    Stop-WindsurfInstance $Kill
} else {
    Start-WindsurfInstance $Instance
}

# ═══════════════════════════════════════════════════════════════════════════
# 道法自然 · 用户无为 · 插件无不为 · 无为而无以为
# ═══════════════════════════════════════════════════════════════════════════
