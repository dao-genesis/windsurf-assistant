# Devin Local 全灭根因修复 · v9.9.364 · 2026-10-21

## 病根（三证合一）

**「插件一开，Devin Local 连用都不能用」= ACP stdio 全哑。**

### 证链
1. `extension.js` spawn-hook 把 `devin.exe acp` 改写为 `process.execPath + dao-acp-stdio-proxy.js`。
   `process.execPath` 在扩展宿主里 = **`Devin.exe` 本体（Electron）**。
2. Electron 只有在 `ELECTRON_RUN_AS_NODE=1` 时才以 node 身份跑脚本。
   实测：`ELECTRON_RUN_AS_NODE=1 D:\Devin\Devin.exe -e "..."` → node v24.15.0 ✓
   反证：无该变量 → `Devin.exe noop.js` 起 **GUI 实例悬挂**（HasExited=false, 无输出）✓
3. 旧 hook **从不注入** `ELECTRON_RUN_AS_NODE`（且仅当 options 已存在才补 env）
   → 被包裹的 `Devin.exe proxy.js devin.exe acp` 实为又起一个隐藏 GUI，
   stdio 代理脚本根本没跑 → ACP 前端永远 Connecting → **Local 全灭**。

### 次因
- `dao-acp-stdio-proxy.js` 探活端口硬编码 `8937`，但插件端口是
  `8889 + fnv1a(username)%100`（zhou→8981 / Administrator→8937 / zhouyoukang→8957）
  → 探活必败 → 锚定缺失。实测三机三口全部吻合。
- spawn-hook 无条件包裹**所有** `devin.exe` 调用（--version/skills/sandbox 等），
  拦面过宽拖慢非 ACP 路径。

## 治法（已落地）

### `extension.js` v9.9.364
- `_fixAcpOpts(origOpts)` 统一出口：强制 `stdio:['pipe','pipe','pipe']` +
  `windowsHide` + **`ELECTRON_RUN_AS_NODE=1`** + `ACP_BACKEND=windsurf` +
  `DAO_ACP_API_URL=_cachedProxyUrl` + `_acpEnvAnchorApi` + 系统代理注入。
  三处 hook（spawn/spawnSync/execFile）一律经此，且**无 options 也补**
  （execFile 保 callback 位次）。
- `_rewriteAcpSpawn`：直启分支改为仅当 args 含 `acp` 子命令才包裹
  （`args.some(x=>x.toLowerCase()==='acp')`），其余调用原样放行。

### `dao-acp-stdio-proxy.js` v9.9.364
- 端口三溯 `_resolveProxyUrl()`：`DAO_ACP_API_URL`(spawn-hook 恒注) →
  `~/.dao/origin-port.json`(运行中反代自报) → `FNV-1a(username)` 回推 → 8937 保底。

## 实证（三级闭环）

### L1 本机 (zhouyoukang:8957)
- `Devin.exe(RUN_AS_NODE) proxy.js devin.exe acp` → chisel `initialize` 正确应答；
  `authenticate`/`session/new` 走通参数校验与鉴权语义。

### L2 141 进程级 (Administrator)
- 同命令包裹 `d:\Devin\...\devin.exe acp` → chisel 应答 `initialize` ✓

### L3 141 无头激活 (真 extension.js + vscode stub)
- `activate()` → dao-router 加载 **25 路由**（github/deepseek/xiaomi/glm/revproxy）→
  spawn-hook 改写 → chisel `initialize` ✓ → MCP(github/context7/playwright/tavily) 全连接 →
  反代 `[h2] connect https://server.self-serve.windsurf.com:443` 上游建立 ✓

## 141 部署态（ZHOU 账号）
- `C:\Users\zhou\.devin\extensions\dao-agi.dao-proxy-pro-9.9.364` 已落地（69 文件）
- `extensions.json` 已注册（location.path 用 `/c:/` URI 格式）
- `dao-agi.dao-proxy-min-9.9.64`：`extension.js→.off` 阉割 + `.obsolete` 标记
- `C:\Users\zhou\.codeium\dao-byok\配置.json` 已装（外接 API provider+路由）
- **ZHOU 已于 ~20:51 登出 console**（只剩 administrator session），Devin 随登出退出。
  下次 ZHOU 登录并开 Devin → ext host 启动 → pro `["*"]` 激活 → 全套生效，无需手工。

## 部署期踩坑记录（后世修法）
1. **改目录名禁用扩展 ≠ 干净**：shared process 的 `extensions.json` 残项 +
   目录扫描会引发 `_createExtensionPathIndex` ENOENT → 整个 ext host 初始化中断。
   正解：剔除 extensions.json 条目 or 留目录断 `extension.js` 主入口。
2. **tar 解到一半触发 onDidFilesChange**：shared process 扫到不存在的
   package.json 记坏档。正解：先解到 staging 目录再原子 move，或直接注册
   extensions.json 条目（`location.path` 必须 `/c:/...` URI 格式）。
3. ext host 崩溃循环保护：短时间被 kill ≥4 次后不再自动重启，需 GUI 点击
   Restart 或 reload window。远程 ssh(as admin) 无法拉起跨用户 GUI session
   （schtasks /it 需用户已登录）。

## 外接 API → Devin Local 链路（已通）
```
IDE ext host ─spawn──> Devin.exe(RUN_AS_NODE) dao-acp-stdio-proxy.js
                       └─WINDSURF_API_SERVER_URL=http://127.0.0.1:FNW(user)
                       └─DAO_ACP_API_URL 同上(自探活)
                            └─> devin.exe acp (chisel)
                                  │ Connect-RPC /exa.api_server_pb/*
                                  ▼
                        127.0.0.1:PORT source.js
                          ├ LOCAL_AUTH  → 本地 gRPC OK 兜底
                          ├ PASSTHROUGH → server.self-serve/inference/api 上游
                          └ CHAT_PROTO/RAW → dao_router → 外接 api 配置.json
                                                   ↓
                                        xiaomi/deepseek/glm/github/revproxy
```
提示词改动/变体走 CHAT_PROTO 的 sp_invert 同一劫持面，链路同构即覆盖。
