# WAM · RT Flow · v3.18.6 · 道法自然 · 万法归宗

> 太上，下知有之 · 道法自然 · 用户无为 · 插件无不为
>
> *天下莫柔弱于水，而攻坚强者莫之能胜也，以其无以易之也*

WAM (`rt-flow`) · Windsurf/Devin 多账号管理 · 自动切号 · 对话追踪 · 会话库 · 备份 · 全本地运行

---

## 〇 · 一句话目标

```text
用户在 Windsurf Cascade panel 发消息 → WAM 自动切到下一健康号
↑
用户无为（无任何额外操作）
插件无不为（auto-verify · 评分 · 切号 · 流式避让 · 额度守护 · 对话追踪 · 备份）
```

---

## 一 · 快速开始

### 1. 安装

**方式 A · VSIX 本地安装（推荐）**

```text
Ctrl+Shift+P → Extensions: Install from VSIX → 选择 devaid.rt-flow-<版本>.vsix
```

最新 VSIX 见 [Releases](https://github.com/zhouyoukang/windsurf-assistant/releases)

**方式 B · 开发者部署（从源码）**

```powershell
# 克隆后进入扩展目录, 打包为 VSIX
cd packages/wam
npx @vscode/vsce package          # 或任意等效 vsix 打包

# 安装
# Ctrl+Shift+P → Extensions: Install from VSIX → 选择生成的 .vsix
# 重载生效
# Ctrl+Shift+P → Developer: Reload Window
```

### 2. 添加账号

打开 WAM 面板（左侧活动栏 **RT Flow** 图标）→ `+ 添加账号`

支持任意格式粘贴（`email password` / 微信发货文本 / 卡号卡密 / Token 等）

或直接编辑 `~/.wam/accounts.md`（每行一个账号：`email password`）

### 3. 开始使用

WAM 启动后自动：

- 验证所有账号额度（D%/W%）
- 选择最优账号登录
- 用户发 Cascade 消息后自动切到下一健康号
- 额度归零时立即切号（硬耗尽越权保护）
- 对话卡死/陈旧时左下角通知
- 全量增量备份所有 Cascade 对话到 `~/.wam/conversation_backups/`

---

## 二 · 核心功能

### ⚡ 自动切号（Auto-Switch · v15.0 根治）

| 触发 | 条件 | skipAutoSwitch 锁 |
|------|------|-----------------|
| 每条消息 | 用户发 Cascade 消息 | 尊重 |
| W% 脉动 | 周额度下降 ≥ 0.3% | 尊重 |
| 软耗尽 | effQuota < threshold (默 5%) | 尊重 |
| **硬耗尽** ★ | D=0% 或 W=0% | **越权**（0% 已无可消耗） |
| 零额度紧急 | 切入后 300ms 发现 D=0/W=0 | — |
| **硬耗尽看门狗** ★★ | 独立 2s 周期 · 高频救场 | — |
| 时间轮转 | rotatePeriodMs 到期 | 尊重 |

**v15.0 关键修复（credits ≠ quota%）**:

- Cascade premium model 后端**只看 weekly%** 计费 · 与 credits 无关
- v3.7.6 旧 bug: credits 充裕的 W=0% 号被视为「可用」永远不切走
- v15.0 治法: `_isValidAutoTarget`/`_scoreOf`/`_tick.isHardExhausted` 三处 credits 不再豁免主门槛
- 兼容回退: `wam.creditsBypassQuotaGate=true` 恢复 v3.7.6 行为（适纯 Devin agent 场景）

**切号守门（防切入低额号）**:

- `D < autoSwitchDailyMin (默 5%)` → 不进候选池
- `W ≤ autoSwitchWeeklyMin (默 3%，非干旱)` → 不进候选池
- 切入后发现 D=0/W=0 → 300ms 内重触（`wam.zeroQuotaRetickMs`）

### 📊 账号评分体系

```text
第一层  💎 Extra Usage（overageActive）     [1_000_000+]  存量绝对优先
第二层  📊 百分比配额 + credits + 临期加成   [1~999_999]   综合评分
候补层  ⏳ 未验证账号                         100
−∞      永禁  无密码 / skipAutoSwitch / 过期
```

### 🔍 对话追踪（v15.0 全量识别 · v15.1 用户主权）

内置 Cascade 对话卡住引擎（`dao_stuck.js`），自动：

- 检测 Cascade 对话卡住 / 死亡 / 陈旧 / 恢复
- 在 Windsurf 左下角弹通知（一次性 · 10min 自动消退 · X 可关闭）
- WAM 激活时自动启动子进程 · 崩溃自动重启
- **真名标题**（v3.11.8）：通过 `_vscdb_helper.py` 直读 `state.vscdb` 的 metadataCache → uuid→title 真名映射
- **30min 软窗**（v15.0）：旧 5min 硬过滤致 stale>5min 完全失明 → 30min 软窗 + `_isStale` 字段三态渲染
- **streamingList X 主权**（v15.1）：所有显示对话用户都能 X 关闭 · 10min 静默期
- **陈旧通知**（v15.1）：AI 中断 + `_turnGrowth>4KB` 也触发通知（旧版 _awaitingUser 静默漏报）

UI 三态渲染:

- ▶ 新鲜（绿）· lastGrowth < 60s
- ◐ 陈旧（黄）· 60s ~ 30min · `_isStale=true`
- ❓ NO_PB（灰）· 无 .pb 文件

左侧追踪面板为**统一列表**：Cascade（◆ 徽标）与 Devin Local（◇ 徽标）会话并入同一流，不另设本地块。

### 📚 会话库（v3.18.5 全新）

命令面板 `RT-flow: 会话库`（或面板按钮）打开独立页：

- 汇聚全部 Cascade `.pb`（多 codeium 根 × 多 backend）+ 全部 `sessions.db`（多 Devin 实例）
- 每行标注 **provider 徽标 · 标题 · 工作区 · 状态 · 消息数 · 更新时间 · 实例**
- 行内 **复制路径 / 在资源管理器显示** 按钮（源文件与备份文件）
- **点击行 → 页内阅读器**：
  - Cascade：解密 `.pb` 解析消息流（失败回退备份 Markdown）
  - Devin Local：读 `sessions.db` `message_nodes`（role: user/assistant/tool）
  - 一键导出 Markdown 到编辑器

### 💾 对话备份

- 自动**全量**备份 `.pb` 对话文件到 `~/.wam/conversation_backups/`
- **增量**备份（防抖 3s · 合并高频小批写）
- 多密钥池兜底解密（应对 Windsurf 版本升级换密钥）
- 全字段 Markdown 导出：用户消息 + AI思考 + 工具调用 + 错误 + 代码上下文
- 备份索引 `_index.json`：uuid → { title, size, ts, fields[] }

---

## 三 · 关键配置（`wam.*`）

> 全部配置均可在 `Ctrl+,` → 搜索 `RT Flow` 中查看和修改

### 切号行为

| 配置项 | 默认 | 说明 |
|--------|------|------|
| `wam.autoSwitchThreshold` | 5 | 自动切号阈值（effQuota < 此值触发） |
| `wam.autoSwitchDailyMin` | 5 | 日额度最低门槛（D<5% 不进候选池） |
| `wam.autoSwitchWeeklyMin` | 3 | 周额度最低门槛（W≤3% 非干旱不进候选） |
| `wam.zeroQuotaRetickMs` | 300 | ★ v15.0 切入零额度账号后紧急重触延迟（旧 2000） |
| `wam.creditsBypassQuotaGate` | false | ★ v15.0 默 false=Cascade 模式 W=0 必切 / true=Devin 兼容老逻辑 |
| `wam.hardExhaustWatchdogMs` | 2000 | ★ v15.0 硬耗尽看门狗周期（2s 高频救场 · 0=禁用） |
| `wam.rotateOnEveryMessage` | true | 每条消息自动切号 |
| `wam.switchCooldownMs` | 15000 | 两次自动切号最小间隔 |
| `wam.waitResetHours` | 3 | 距重置 N 小时内等待重置而非切号 |
| `wam.preferOverageFirst` | true | Extra Usage 账号绝对优先 |
| `wam.expiryFirst` | true | 临期账号（<60天）加分优先消耗 |
| `wam.creditsThreshold` | 1000 | credits 可用的最低总量（promptCredits + flowCredits） |

### 额度检测信号

| 配置项 | 默认 | 说明 |
|--------|------|------|
| `wam.scanIntervalMs` | 10000 | W% 轮询周期（ms，最小 5000） |
| `wam.quotaPulseMinDelta` | 0.3 | W% 脉动触发阈值（%） |
| `wam.walDetect` | true | WAL 直达触发（click Send 底层信号） |
| `wam.perMessageMinIntervalMs` | 60000 | 全局切号最小间隔（全 reason 强锁） |

### 验证 & 启动

| 配置项 | 默认 | 说明 |
|--------|------|------|
| `wam.autoVerifyOnStartupMs` | 30000 | 启动后自动验号延迟（0=关） |
| `wam.autoVerifyPeriodMs` | 1800000 | 周期自动验号间隔（30min） |
| `wam.verify.parallel` | 3 | 批量验号并发数 |
| `wam.startupDelayMs` | 3500 | 启动后延迟首次登录 |

### 对话追踪 & 备份 & 通知

| 配置项 | 默认 | 说明 |
|--------|------|------|
| `wam.stuckNotify` | true | 对话卡住/死亡通知 |
| `wam.streamStaleMaxSec` | 1800 | ★ v15.0 streaming 真死透剔除阈值（30min · 0=永不剔除） |
| `wam.notifyOnStaleStream` | true | ★ v15.1 陈旧 streaming 也通知（治 AI 中断静默） |
| `wam.notifyOnAwaitingUser` | false | v15.1 等待用户对话也通知（极端场景） |
| `wam.hubNotifyGlobalCdMs` | 5000 | 任意两次通知间最小间隔 |
| `wam.conversationBackupDir` | "" | 备份目录（空=默认 `~/.wam/conversation_backups`） |
| `wam.autoBackupStartDelayMs` | 8000 | 启动后备份延迟 |
| `wam.incrementalBackupDebounceMs` | 3000 | 增量备份防抖 |
| `wam.pythonPath` | "" | ★ v15.2 显式 Python 路径（空=自动探测·见下） |

---

## 四 · 系统依赖（软编码 · 万家适配）

### Node.js · 必备

Windsurf 自带 Electron Node 即可。WAM 子进程引擎也可用系统 `node`（PATH 上）。

### Python 3 · 推荐（影响对话标题真名显示）

WAM v3.11.4+ 通过 `_vscdb_helper.py` 直读 `state.vscdb` 拿真实对话标题（uuid → title 映射）。

**自动探测顺序**（七层兜底 · v15.2）:

1. `wam.pythonPath` 配置（最高优先）
2. `WAM_PYTHON_PATH` 环境变量
3. PATH 中的 `python3` / `python`
4. PATH 中的 `py`（Windows Python Launcher · python.org 安装默认装的桥）
5. `%LOCALAPPDATA%\Programs\Python\Python3X\python.exe`（用户级安装 · 3.7~3.15）
6. `%ProgramFiles%\Python3X\python.exe` + Microsoft Store 路径
7. `%USERPROFILE%\anaconda3\python.exe` / Miniconda / `/opt/homebrew/bin/python3` / pyenv

**没有 Python 也能用** — 仅对话标题退化为 `对话 #短UUID` 兜底（其他功能不受影响）

**手动指定**: 在 Windsurf settings.json 加：

```json
{
  "wam.pythonPath": "C:/Users/xxx/AppData/Local/Programs/Python/Python312/python.exe"
}
```

### PowerShell · 可选能力

仅用于：

- `windsurf-multi.ps1` 多实例启动器（PS 5.1+，Windows 自带）
- 左下角通知（`spawn powershell -NoProfile`）
- `_vscdb_*.py` 认证直写助手（依赖 Windows DPAPI，仅 Windows 生效）

非 Windows 平台上述功能退化，核心账号池/验证/切号不受影响。

---

## 五 · 账号格式（万法识号）

支持任意粘贴格式：

```text
# 标准格式
email@example.com  password123

# 卡号卡密格式
卡号1: a@b.com
卡密1: pass123

# 微信发货文本（含"密码:含@的字符串"等复杂格式）
账号: a@b.com
密码: My@Pass!1

# Token 直登（auth1/session/JWT/apikey）
auth1_xxxxxxxxxxxxxxxxxxxxx
```

---

## 六 · 数据目录（`~/.wam/` · 软编码 · 跨用户跨平台）

```text
~/.wam/                         <-- os.homedir() · 不硬编码用户名 · 跨用户跨平台
├── accounts.md                 账号库（主私产 · gitignored）
├── wam-state.json              账号健康数据 + 验证结果
├── lock-state.json             skipAutoSwitch 锁持久化
├── _conv_dismiss.json          v3.7.6 跨窗口 dismiss 持久化
├── _conv_titles.json           v3.11.4 uuid → title 持久化缓存
├── _conv_notify_claims/        v13.2 跨窗口通知一次性闸门
├── _hub.json                   对话追踪引擎心跳数据 (active/streaming/stuck)
├── _api.json                   Agent API 接口（供外部调用）
├── wam.log                     运行日志（Output:WAM · 2MB 滚动）
├── conversation_backups/       Cascade 对话备份
│   ├── backup_YYYYMMDD_HHMMSS/
│   │   ├── *.pb                原始对话文件
│   │   ├── *.md                解密导出 Markdown
│   │   └── _index.json         uuid → { title, size, ts } 索引
└── stuck-detect/               卡住检测引擎（dao_stuck.js）
    ├── engine_v9.pid           单实例 PID 文件
    ├── stuck_state_v9.json     引擎内部状态（conversations 全量）
    ├── _signals/               信号文件
    └── v9.log                  引擎日志
```

实际路径解析（Windows 例）: `C:\Users\<当前用户>\.wam\` · 通过 `os.homedir()` / `process.env.USERPROFILE` 自动计算 · 不绑特定用户名。

---

## 七 · 打包与部署

扩展为纯 JS 实现，无原生依赖。打包成 VSIX 后拖到任意 Windsurf / Devin / 兼容 VS Code 的 IDE 即可：

```powershell
# 打包 (任一方式)
npx @vscode/vsce package          # 标准 vsce
python _build_vsix.py             # 或仓库自带的无依赖打包器

# 手动部署: 解压 vsix 至扩展目录
#   %USERPROFILE%\.windsurf\extensions\devaid.rt-flow-<ver>\   (Windsurf)
#   %USERPROFILE%\.devin\extensions\devaid.rt-flow-<ver>\      (Devin)
# 并在同级 extensions.json 中登记该版本, 重载窗口生效
```

**私有配置层**: `~/.wam/_local.json` —— 机器私有覆盖文件（不入版本库）。当某项 `wam.*` 配置只想对本机生效而又不改 IDE 设置时，写入该文件即可（如自备接码端点）。优先级：IDE 显式设置 > `_local.json` > 扩展声明默认值。

---

## 八 · 文件清单

```text
# 核心（随包发布）
extension.js           ~600 KB   插件核心
package.json            ~25 KB   配置声明
dao_stuck.js           ~125 KB   对话追踪引擎
_vscdb_helper.py        ~1 KB    vscdb 直读助手 (Windows DPAPI·仅 Windows)
_vscdb_inject_helper.py          vscdb 注入助手 (Windows-only)
windsurf-multi.ps1               多实例启动器 (Windows-only)
media/                           图标
changelog.md / readme.md / LICENSE.txt
```

---

## 九 · 版本历史（精要）

| 版本 | 日期 | 核心 |
|------|------|------|
| **v3.11.9** | 2026-05-28 | ★ Python 探测七层兜底（适配 launcher/Python.org/Microsoft Store/Anaconda）+ wam.pythonPath 软编码 |
| v3.11.8 | 2026-05-28 | 用户主权强化（v15.1）：真实标题 + streamingList X 主权 + 陈旧通知 |
| v3.11.7 | 2026-05-28 | 对话识别根治（v15.0）：5min 硬过滤 → 30min 软窗 + _isStale 字段 |
| v3.11.6 | 2026-05-28 | ★★ 自动切号根治（v15.0）：credits ≠ quota% · 看门狗 2s · 14/14 测试通过 |
| v3.11.5 | 2026-05-27 | 对话追踪全量根治（v14.0）：streamingList 不限 1 条 · UUID 兜底代替静默丢弃 |
| v3.11.4 | 2026-05-27 | _vscdb_helper.py · Python sqlite3 直读拿 title（无 better-sqlite3 也可） |
| v3.11.3 | 2026-05-27 | UI 抖动根治 · 软编码归一 · 单实例闸门 |
| v3.10.2 | 2026-05-27 | 备份体系完善（多密钥池 · stub MD · retroactive 三重重试） |
| v3.10.0 | 2026-05-27 | 卡住引擎归一（dao_stuck.js 内嵌 VSIX · 自动管理生命周期） |
| v3.9.1 | 2026-05-27 | 硬耗尽双层（D=0 越权 · 软耗尽尊重用户） |
| v3.8.4 | 2026-05-26 | 绝对最低门槛（D<5 或 W≤3 不入候选池） |
| v3.7.0 | 2026-05-25 | 三维度归一（credits 独立 · 临期+余额协同） |
| v3.3.0 | 2026-05-24 | Extra Usage 绝对优先分层（存量>流量） |
| v2.7.0 | 2026-05-09 | 万法识号（任意格式账号文本解析） |
| v2.6.14 | 2026-05-08 | 三守俱全（全栏 60s + WAL 冷却 2s + 启动暖启 5s） |
| v2.6.11 | 2026-05-07 | W% 脉动真本源（后端计费信号 · 零噪音） |

完整历史见 [CHANGELOG.md](https://github.com/zhouyoukang/windsurf-assistant/blob/HEAD/CHANGELOG.md)

---

## 十 · 故障诊断

### 对话面板全是 `#UUID` 编号（看不到真名）

**原因**: `_vscdb_helper.py` 未部署 或 系统找不到 Python

**诊断**:

```powershell
# 1. 检查文件存在
Test-Path "$env:USERPROFILE\.windsurf\extensions\devaid.rt-flow-*\_vscdb_helper.py"

# 2. 检查 Python 可用性
python --version   # 或 py --version

# 3. 看引擎日志
Get-Content "$env:USERPROFILE\.wam\wam.log" -Tail 30 | Select-String 'python_'
```

**手动修复**: 在 settings.json 加 `"wam.pythonPath": "C:/path/to/python.exe"` 即可。

### W=0% 但 WAM 不切号

**原因**: 旧 v3.7.6 bug — credits 充裕的 W=0% 号被视为「可用」

**诊断**: 检查 VERSION：`Get-Content extension.js | Select-String 'const VERSION'`

**修复**: 升级到 v3.11.6+ · 默认 `wam.creditsBypassQuotaGate=false`（Cascade 模式严守 W%）

### 对话卡住没通知

**原因**: 旧版 _awaitingUser=true 静默漏报

**修复**: 升级到 v3.11.8+ · 默认 `wam.notifyOnStaleStream=true`（AI 中断 + _turnGrowth>4KB 触发）

---

## 十一 · GitHub

- 仓库: <https://github.com/zhouyoukang/windsurf-assistant>
- 插件目录: [`packages/wam/`](https://github.com/zhouyoukang/windsurf-assistant/tree/main/packages/wam)
- Releases: <https://github.com/zhouyoukang/windsurf-assistant/releases>
- Issues: <https://github.com/zhouyoukang/windsurf-assistant/issues>

---

## 十二 · 隐私与数据

- **全部数据留在本机**：账号库、健康数据、对话备份、日志均在 `~/.wam/`（或 `WAM_HOME` 指定目录）。
- **网络请求只有两类**：① 官方 planStatus/login API（验证账号额度）② 用户自行配置的可选端点（接码/代理）。
- **无遥测、无分析、无上报**。
- 账号明文存于 `accounts.md`（本机文件，权限同普通用户文件）——同机器其他进程可读，请自行评估风险。
- `_local.json` 是机器私有覆盖文件，不应提交到任何公共仓库。

## 十三 · 卸载

1. IDE 扩展面板 → RT Flow → Uninstall。
2. 可选：删除数据目录 `~/.wam/`（账号库/对话备份/日志）。
3. 可选：删除 `~/.codeium/*/cascade/` 下由本扩展创建的内容不存在——本扩展只读不写该目录。
4. 多实例环境：删除 `~/.wam-*` 各实例目录与 `windsurf-multi.ps1` 创建的 `--user-data-dir` 目录。

---

*道法自然 · 用户无为 · 插件无不为 · 无为而无以为*
