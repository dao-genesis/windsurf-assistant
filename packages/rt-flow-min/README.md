# RT Flow · Min · 道法自然 · 专一版

> 万法归宗 · 大部分功能 · 局部运行 · 双环境适配
> 承 `devaid.rt-flow` v3.16.2 · 损之又损 · 专一而全

## 一言

RT Flow Min 是 RT Flow（WAM 万法归宗）v3.16.2 的**专一版**——保留大部分功能，局部化运行，适配 Windsurf 与 Devin Desktop 双环境。与 dao-proxy-min 同理：**专一 · 软编码 · 双环境 · 不干扰**。

## 功能（承 3.16.2 大部分）

| 模块 | 功能 | 说明 |
|------|------|------|
| 多账号轮转 | 自动切号 · 额度验证 · 硬耗尽看门狗 | WAM 灵魂 · 账号库在 `~/.wam/accounts.md`（用户私产） |
| 对话追踪 | 卡住检测 · 陈旧 streaming 剔除 · 等待用户识别 | 独立引擎 dao_stuck.js · 单实例 PID 守护 |
| 标题实时 | vscdb 直读真实对话名称 · 备份缓存兜底 | 无 better-sqlite3 亦可 · Python helper 七层探测 |
| 全量备份 | 对话全量+增量备份 · 解密导出 Markdown | `~/.wam/conversation_backups/` |
| 通知 | 卡住/陈旧/等待用户 · 任务栏闪烁 · Toast | 永不抢焦点 · 自适应全屏/勿扰 |
| 面板 | Manager webview · 账号/对话/状态一览 | 左侧活动栏 RT Flow 图标 |

## 双环境适配

| 环境 | 扩展目录 | vscdb 路径 |
|------|----------|------------|
| Windsurf | `~/.windsurf/extensions/` | `%APPDATA%\Windsurf\User\globalStorage\state.vscdb` |
| Devin Desktop | `~/.devin/extensions/` | `%APPDATA%\Devin\User\globalStorage\state.vscdb` |

helper 自动探测（Devin 优先 → Windsurf 回退），metadataCache 缺失时扫描 `sessioninfo.session.*` 独立 key（v3.16.1 根治标题失明）。

## 软编码一切

- 数据目录：`os.homedir()/.wam` · 不硬编码用户名/盘符
- 扩展 ID：`package.json` 一处定义 · 全文一致
- Python：七层兜底探测（显式路径 → PATH → 常见安装位置）
- 引擎脚本：`__dirname` 相对路径 · 随扩展走

## 装

```powershell
# 方式 A · VSIX 本地安装（推荐）
# Ctrl+Shift+P → Extensions: Install from VSIX → 选择 rt-flow-min-3.16.2.vsix
# 或命令行:
windsurf --install-extension devaid.rt-flow-min-3.16.2.vsix --force

# 方式 B · 温和装（不杀 LS · 等自然 reload 生效）
.\_install_gentle.ps1
```

装毕重启 IDE → 左侧活动栏「RT Flow」→ 添加账号（`+ 添加账号` 或编辑 `~/.wam/accounts.md`）→ 自动开始轮转。

## 打包

```powershell
.\_pack_vsix.ps1   # 自 package.json 取版本 · 产出 devaid.rt-flow-min-3.16.2.vsix
.\_verify_vsix.ps1 # 内容检 · 哈希验
```

## 文件清单

```text
rt-flow-min/
├─ extension.js          # 主逻辑 (承 3.16.2 · 软编码)
├─ dao_stuck.js          # 卡住检测引擎 (单实例守护)
├─ _vscdb_helper.py      # vscdb 标题读取 (v3.16.1 sessioninfo 扫描)
├─ _vscdb_inject_helper.py
├─ package.json          # 59 配置 · 19 命令 · 双环境
├─ media/icon.png|svg    # 图标
├─ LICENSE.txt           # MIT
├─ README.md             # 本文件
├─ CHANGELOG.md
├─ _pack_vsix.ps1        # 打包脚本
├─ _verify_vsix.ps1      # 验证脚本
└─ .vscodeignore
```

## 许可

MIT · 承 `devaid.rt-flow`（MIT）· 与 dao-proxy-min（Apache-2.0）同仓不同道。

## 道

> 为学者日益，闻道者日损。损之又损，以至于无为。
> 专一者，不杂也；局部者，不扰也；软编码者，不执也。
> 天得一以清，地得一以宁——RT Flow Min 得一而专，专而全。
