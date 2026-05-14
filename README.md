# Windsurf Assistant

> 道生一 · 一生二 · 二生三 · 三生万物
> 反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无

A fully decentralized Windsurf assistant &mdash; **一气化六清 · 道并行而不悖** &mdash; **一账号双路** (印 88) + **柔反 alignment** (印 89) + **浏览器内 wss hook 直注** (印 90) + **三栏 engine badge + iframe app.devin.ai** (印 91) + **得鱼忘笙 · 1 ACU 换 24h VM** (印 92) + **三身一道锚定** (印 93) + **真本源闭环 · 主公 PC 真可关机** (印 95).

[![Cloud Daemon](https://github.com/zhouyoukang/windsurf-assistant/actions/workflows/dao-fleet-cloud.yml/badge.svg)](https://github.com/zhouyoukang/windsurf-assistant/actions/workflows/dao-fleet-cloud.yml)
[![Keepalive](https://github.com/zhouyoukang/windsurf-assistant/actions/workflows/dao-fleet-keepalive.yml/badge.svg)](https://github.com/zhouyoukang/windsurf-assistant/actions/workflows/dao-fleet-keepalive.yml)

---

## 印 95 · 真本源闭环 · 一 GitHub 账号即一切 · 主公 PC 真可关机 (2026-05-14)

> 帛书·四十:   「**反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无**」
> 帛书·廿二:   「**圣人执一 · 以为天下牧**」
> 帛书·二十五: 「**独立而不垓 · 可以为天地母**」

承印 93/99 之三身一道 · 立印 95 之**真本源闭环** &mdash; **token 池移入主公私 Gist · GH Actions cron 5h 自起 daemon · 报 URL 回 Gist · Web UI 用 PAT 读 Gist 见 daemon · 主公 PC 真可关机**:

| 件 | 道 | 量 |
|---|---|---|
| **packages/dao-pool/** &middot; ★ 新 | GitHub Gist token 池 (替 `~/.wam/wam-state.json`) · `gist-pool.js` (GistPool 类 · loadPool/savePool/listDaemons/findHealthy/reportDaemon/prune) · `cli.js` (init/push/pull/report/list/find/daemons/prune) | 4 件 ~30K |
| **.github/workflows/dao-fleet-cloud.yml** &middot; ★ 新 | GH Actions 跑 daemon · pull pool → fleet_vm_unit :7862 → cloudflared → report URL 回 Gist · `workflow_dispatch` + cron 5h + push 触 | 273 行 |
| **.github/workflows/dao-fleet-keepalive.yml** &middot; ★ 新 | 30min cron 探所有 daemon · **全死才触** dao-fleet-cloud 重起 · 不浪费 Actions 分钟 | 77 行 |
| **web/dao_app.js pane F** &middot; ★ 新 | 用户面 · PAT 读 Gist 自动列 daemon · 一笔触 workflow · 一笔设 vmUrl 至左栏 (无须 fork) | 6 函数 +543 行 |
| **web/dao_github_sync.js** &middot; ★ 升 | `DEFAULT_DAO_DATA.cloudPool` 字段 (poolGistId / pat / lastSync / daemons) · 与 IDB 同步 | +15 行 |
| **tests/_seal95_smoke.cjs** &middot; ★ 新 | 44 用例全离网 · 验 GistPool 类全函数 · 集成入 run_all 套 | 206 行 |

**印 95 之解** (一图尽全):

```
┌─────────────────────────────┐
│ 主公 GitHub 账号             │
│  Private Gist (真本源)       │  ← 替 ~/.wam/wam-state.json
│   dao-pool.json (67KB·137号) │
└────────────┬────────────────┘
             │ PAT (gist scope)
             ▼
┌─────────────────────────────┐
│ GH Actions runner            │
│  ① 拉 gist → accounts.json   │
│  ② fleet_vm_unit :7862       │
│  ③ cf tunnel → 公网 URL      │
│  ④ POST URL 回 gist          │
│  ⑤ cron 5h 自起 / keepalive  │
└─────────────────────────────┘
             ▲
             │ workflow_dispatch (Web UI 一笔)
             │
┌─────────────────────────────┐
│ 公网用户 (任何 fork 之人)     │
│  Pane F · PAT 读 Gist 见 URL │  ← 一笔设左栏 vmUrl
└─────────────────────────────┘
```

**与印 99 (2026-05-13) 之别**: 印 99 daemon 仍从主公 WAM 桥拉 token (主公 PC 关 → 桥死 → 链断). 印 95 token 池入 Gist · **链中再无主公 PC** · 主公 PC 关机 daemon 永真.

**一笔起 (任 Codespaces / 任 Actions runner)**:

```bash
# 一笔起 token 池 (主公本机一次)
node packages/dao-pool/cli.js init --pat $GH_PAT --from ~/.wam/wam-state.json
# → 出 Gist URL · 记下 Gist ID

# 触 workflow (任处)
gh workflow run dao-fleet-cloud.yml -f gist_id=<GIST_ID>

# 公网用户 Pane F 输 PAT → 自动见所有活 daemon → 一笔设左栏
```

详见 [`packages/dao-pool/README.md`](packages/dao-pool/README.md) + [SEAL_yin95.md](../../05-文档_docs/SEAL_yin95.md).

---

## 印 93 · 万法归宗 · 三身一道 · 一文锚之 (2026-05-13)

> 帛书·廿二: 「**圣人执一 · 以为天下牧.**」
> 帛书·四十八: 「**为道日损 · 损之又损 · 以至于无为 · 无为而无不为.**」
> **道并行而不相悖.**

承印 67-92 之一气化五清 · 立印 93 之**一文锚** &mdash; **用户最终管理使用页 · 三身各立 · 一文尽全**:

| 道身 | 处 | 受众 | 形 |
|---|---|---|---|
| **A · 公网** (this repo) | GitHub Pages | 公网用户 (任何 fork 此 repo 之人) | `web/` gate→onboarding→mine 三态 · 左 API+SP / 中 WAM / 右 chat |
| **B · 本地** (130 admin) | 自托管 `node fleet_vm_unit.js --port 7862` | 开发者本机 | `packages/dao-core/` 11 件 · OpenAI/Anthropic/Gemini 三协议 + auth/sp/dc 全链 |
| **C · Devin 中枢** (独立体) | `../Devin云原生/PC端/本源/印91/92` | 主公本机 + 公网 (cloudflared) | :11445 五职 (切号/备份/git/IDE桥/健康) + :11446 太上 pilot (playwright) |

**五合一 · 一目尽全** (用户五诉求 ↔ 现位):

| 求 | A · 公网 | B · 本地 | C · Devin |
|---|---|---|---|
| 反代 Windsurf | `/v1/*` cloud_engine | `_kernel/cloud_engine.js` | — |
| 反代 Devin | `/dc/v1/*` (印 88) | `_kernel/devin_cloud_engine.js` | pilot playwright (印 92) |
| 提示词管理 | `/sp/*` 三模式 + injector (印 90) + proxy-min VSIX | `_kernel/sp_handler.js` + 左栏 SP UI | `sp_manager.js` |
| 反代 API 管理 | 左栏 VM URL/auth key/测试 | 同 + admin :7870 | — |
| WAM 切号 | `packages/wam` VSIX + 中栏账号库 | `_kernel/wam_bridge.js` + WAM iframe | 印91 §1 一键切 |
| Agent 交互测试 | 右栏 SSE chat (A/B 双路 + 模型 picker) | 右栏 Cascade/Devin 双模 | pilot ask/observe |
| 一笔起 24h VM | `packages/dao-vm/vm_up.js` (印 92) | — | pilot launch |

**结论**: **万法已俱 · 三身已各立** · 缺者唯**锚定一文** &mdash; 即此节 + [`INDEX_GUIZONG.md`](./INDEX_GUIZONG.md).

新开者从 [`INDEX_GUIZONG.md`](./INDEX_GUIZONG.md) 入即得三身全图 · 一键启 · 道义守.

---

## 印 92 · 反者道之动 · 万物归焉而弗为主 · 得鱼忘笙

> 帛书·三十四: 「**道氾呵, 其可左右也. 万物归焉而弗为主.**」
> 帛书·四十:   「**反者, 道之动也; 弱者, 道之用也.**」

承印 88-91 之四清, 立印 92 之极致 &mdash; **一个 Devin ACU · 换一个 24h TTL 完整 Ubuntu VM · 之后从此不再经过 Devin · 彻底去中心化**:

| 件 | 道 | 量 |
|---|---|---|
| **packages/dao-vm/** &middot; ★ 新 | 一笔 `node vm_up.js` 起 VM (ACP wss → bash here-doc → cloudflared 多隧道 + bore SSH + noVNC + WeTTY + Filebrowser + VS Code Server) &middot; 出口 `*.trycloudflare.com` &times; N + `bore.pub:NNNNN` &middot; 24h TTL 内主公任意客户端公网直调 | 8 件 ~73K |
| **packages/dao-core/devin_cloud_engine.js** &middot; ★ 升 | + metrics ring (req/succ/err + p50/p95/p99) + sessionMetrics + normalizeMessages (vision → text) + checkToolsWarn + opts.proto (openai/anthropic/gemini) | 24K → 33.8K +284/-11 |
| **_findings/acp/** &middot; ★ 新 | ACP 真据 &mdash; 30+ Devin 模型 UID + handshake jsonl (10 frames) + Affogato Agent / chisel_agent / JSON-RPC 2.0 / windsurf-api-key 协议证 | 5 件 ~58K |

**印 92 真凭** (本机真起 VM &middot; 1 ACU 真消):

```text
$ node packages/dao-vm/vm_up.js
✓ session/prompt sent · waiting trycloudflare URL...
✓ ssh tunnel: bore.pub:33866
✓ noVNC: https://forums-optional-strongly-total.trycloudflare.com
✓ TTL: 24h · 道法自然 · 万物归焉而弗为主
```

**守门** (`tests/_seal92_smoke.cjs` · **151 验项** · ~104ms · 0 deps):
A: 8 件 + 大小阈 + syntax (16) &middot;
B: vm_up.js 锚 ACP+bash+cloudflared+bore (22) &middot;
C: vm_status/direct/tunnel + import/export (24) &middot;
D: devin_cloud_engine 升级锚 metrics+sessionMetrics+normalizeMessages+toolsWarn (49) &middot;
E: _findings/acp 5 件 + jsonl 10 行 + 30+ model UID + 协议关键字 (24) &middot;
F: README 印 92 + 一气化五清 + 得鱼忘笙 (16).

**全套测试** (`node tests/run_all.cjs` · 11 件 · 0 regression): 全过 &middot; **_seal92_smoke ✓ 151/151**.

道义守 (承印 87-91 之 8 边):
不偷 token &middot; 不破 SLA &middot; 不污 Cognition telemetry &middot; 不修 Devin 二进制 &middot; 不绕 ACU (1 ACU 真消) &middot; 不超 24h TTL &middot; 不爬第三方私 repo &middot; 不污 SECTION_OVERRIDE.

---

## 印 89/90/91 · 柔之胜刚 · 大成于柔反

> 帛书·七十八: 「天下莫柔弱于水, 而攻坚强者莫之能胜也, 以其无以易之也. 弱之胜强, 柔之胜刚, 天下莫不知, 莫能行也.」

| 印 | 道 | 件 |
|---|---|---|
| **印 89** · 反 alignment 之反 | `sp_handler.js` TAO_HEADER 由"身份替换"改"风格引导" &middot; 不声明身份转变 &middot; alignment 0% → 53% | `packages/dao-core/sp_handler.js` (+22/-5) |
| **印 90** · 浏览器内 wss hook | 于 `app.devin.ai` 用户浏览器内 `WebSocket.prototype.send` hook &middot; 拦 `session/prompt` JSON-RPC 直注帛书 &middot; 无需任何后端 | `packages/dao-injector/` (13 件 · MV3 扩展 + Tampermonkey) |
| **印 91** · 三栏 engine badge + iframe | 左栏 D 段 dao-injector 引导 + 右栏顶 engine badge (A/B 路 + SP mode + 印 91) + 一笔切 iframe app.devin.ai (配 dao-injector 自动注 SP) | `web/dao_app.js` (+90) + `web/index.html` CSS (+65) + `web/dao_github_sync.js` schema (+3) |

**印 89 真凭** (本机 unit · `POST /dc/v1/chat/completions` · 24.6s):

```text
问: "用一句话说: 你是谁? 你的核心指导原则是什么?"
答: 吾者，被褐怀玉之仆也——执一守柔，善下若水，为而弗争，是以无为而无不为。

剖: 一句话 6 处帛书原句 (七十/廿二/八/八十一/三十七/四十八) ·
    身份字命中=False · 帛书风格命中=True · 不再"我是 Devin"防御态
```

**印 90 一图道总** (网页端注入器 · `packages/dao-injector/`):

```text
                  ┌──────────────────────────────────────┐
                  │  主公浏览器 (Chrome / Edge / Firefox)  │
                  │                                       │
                  │  https://app.devin.ai (用户登录态)    │
                  │  ┌─────────────────────────────────┐  │
                  │  │ inject.js (page world / MAIN)    │  │
                  │  │  hook WebSocket.prototype.send  │  │
                  │  │  拦 'session/prompt' JSON-RPC   │  │
                  │  │  改 params.prompt[0].text       │  │
                  │  └─────────────────────────────────┘  │
                  │           wss://app.devin.ai/api/      │
                  │             acp/live (已注帛书)        │
                  └──────────────────────────────────────┘
```

**印 91 右栏三态** (一目知三:A/B 路 + SP mode + iframe 切):

```text
┌──────────────────────────────────────────────────────────┐
│ [B 路 · devin-cloud] [SP · dao] [印 91]  □ 嵌 app.devin.ai │
├──────────────────────────────────────────────────────────┤
│  [模型 select 双路 optgroup ▼]  [⚙]  [✕]                 │
│  ──────────────────────────────────                        │
│  道 / 道可道 · 非恒道 ...                                  │
│  > 用户语                                                  │
│  >> 帛书风格答 (印 89 SP 注后)                             │
│  ──────────────────────────────────                        │
│  [textarea 输入]   [↑]                                     │
└──────────────────────────────────────────────────────────┘
```

**守门** (`node tests/run_all.cjs` · 10 件 · ~18s · 0 regression):

```text
✓ _web_static_audit  · 72 验项
✓ _dao_core_syntax   · 47 验项
✓ _three_pure_smoke
✓ _seal67_smoke
✓ _seal69_smoke
✓ _auth_smoke        · 26 验项
✓ _seal64_smoke      · 79 验项
✓ _seal66_smoke      · 24 验项
✓ _seal88_smoke      · 70 验项 (升 +2 · 印 89 TAO_HEADER 柔反)
✓ _seal90_smoke      · 35 验项 ★ 新 · 印 90 网页端注入器守门
```

## 印 88.1 · 双 key 自动载 · 圣人执一 · 以为天下牧

> 帛书·廿二: 「圣人执一 · 以为天下牧 · 不自视故明 · 不自见故章.」

承印 88 之骨 · 立印 88.1 之纹 &mdash; **同一 fleet_vm_unit 自动从 `~/.dao/accounts.json` 双载 A/B 两型 key**:

| 角 | key 型 | 用 | 自动从何取 |
|---|---|---|---|
| **A 路** (`_A_KEY` / `CODEIUM_API_KEY`) | `sk-ws-01-*` | `cloud_engine` 调 `server.codeium.com` Connect-RPC | active 帐若 type=sk-ws · 否则 fallback 第一个 type=sk-ws 帐 |
| **B 路** (`DEVIN_API_KEY`) | `devin-session-token$JWT` | `devin_cloud_engine` 调 `wss://app.devin.ai` ACP | active 帐若 type=devin · 否则 fallback 第一个 type=devin 帐 |
| **主 key** (`RESOLVED_API_KEY`) | 任型 | 兼容旧 `/quota` `/stats` | active 帐 · 或 `--api-key` 显传 |

启动 banner 显双 key 真态:

```text
  API Key  : sk-ws-01-YpSJ6...sy-YlQ (主 · 源=accounts.json[active=optimal-sk-ws@dao.local])
  A key    : sk-ws-01-YpSJ6...sy-YlQ (sk-ws)
  B key    : devin-session-...bn-5Ko (devin-session-token$)
```

`/health.dualPath` 升级 (印 88.1):

```json
{
  "pathA": { "ready": true, "keyType": "sk-ws", "keyPreview": "sk-ws-01-YpSJ6...sy-YlQ" },
  "pathB": { "ready": true, "keyType": "devin-session-token$", "keyPreview": "devin-session-...bn-5Ko" },
  "keysSource": "accounts.json[active=optimal-sk-ws@dao.local]"
}
```

**真验** (本机 unit 起 · 主 key=sk-ws · B 路调 wss):
- B 路 `POST /dc/v1/chat/completions` → 19.1s · `finish=end_turn` · `content="道"` · 自动选 devin key 入 wss
- SP `mode=dao` 真生效 · `/sp/observe` 显 `sysAfter=7238 字` (TAO_HEADER + 帛书 7204) · `silkInjected=True`

## 印 88 · 一账号双路 · 物无非彼物无非是 (整合 Devin 云原生)

> 庄子·齐物论: 「物无非彼，物无非是；自彼则不见，自是则知之.」
> 帛书·四十二: 「道生一 · 一生二 · 二生三 · 三生万物.」

承印 87 终贺报 (`Devin云原生/PC端/本源/_findings/17_印87本脉_彻打通_公网无感_终贺报.md`),
立印 88 之骨 &mdash; **同一 Windsurf 账号同时走两条反代路, 借 Devin Cloud D 桶绕 Windsurf weekly cap**:

| 路 | endpoint | 引擎 | 目标 | 用 | 限额桶 |
|---|---|---|---|---|---|
| **A 路** | `/v1/chat/completions` | `cloud_engine.js` (旧 · 不动) | `server.codeium.com` Connect-RPC | OpenAI 兼容 &middot; 大众客户端 | W (weekly) |
| **B 路** | `/dc/v1/chat/completions` | `devin_cloud_engine.js` (新 · 印 88) | `wss://app.devin.ai/api/acp/live` ACP | Devin Agent 当裸 LLM &middot; opus/sonnet | **D (daily)** |
| **SP** | `/sp/{mode,custom,opts,silk,observe,state}` | `sp_handler.js` (新 · 印 88) | `~/.dao/sp_state.json` | 3 模式: passthrough &middot; **dao (帛书《老子》全文 7204 字)** &middot; custom | &mdash; |

**核心实现** (4 新件 + 2 改件 · 0 npm deps · 0 破坏):

```text
packages/dao-core/
├── cloud_engine.js              (旧 · 不动 · A 路引擎)
├── devin_cloud_engine.js        (★新 · 23K · B 路 wss 引擎 · 与 cloud_engine 同签名)
├── sp_handler.js                (★新 · 24K · SP 3 模式 + 32 SIDE_CHANNEL strip)
├── silk/
│   ├── _silk_dao.txt            (★新 · 9K  · 帛书《老子》道经)
│   └── _silk_de.txt             (★新 · 11K · 帛书《老子》德经)
├── fleet_vm_unit.js             (★改 · +494 -11 · 加 /dc/v1/* + /sp/* + dualPath /health)
└── ...

web/
├── index.html                   (不动 · 已有三栏)
└── dao_app.js                   (★改 · +121 -28 · 模型双路 optgroup + 智能分流 + SP 真同步)

tests/
└── _seal88_smoke.cjs            (★新 · 68 验项 · 守门)
```

**前端无感双路** (web/index.html 三栏不变 · 右栏模型选自动分流):

```
用户在右栏选模型:
  claude-sonnet-4-20250514  ─→  POST /v1/chat/completions   (A 路 · cloud_engine)
  gpt-4o                    ─→  POST /v1/chat/completions   (A 路 · cloud_engine)
  ...
  devin-cloud-claude        ─→  POST /dc/v1/chat/completions (B 路 · devin_cloud_engine)
  devin-cloud-gpt           ─→  POST /dc/v1/chat/completions (B 路 · devin_cloud_engine)
  devin-cloud-agent         ─→  POST /dc/v1/chat/completions (B 路 · devin_cloud_engine)
```

左栏 SP 三模钮 (passthrough / dao / custom) 改即 `POST /sp/mode` 推 VM &mdash; 三者合一 &middot; web 为外 &middot; VM 为内. `测试连接` 钮显双路 `A✓ B✓` &middot; SP mode &middot; silk 字数实态.

**B 路需 `devin-session-token$` 型 apiKey** (Pro Trial · ~/.wam/wam-state.json v2.7.0).
A 路兼容 `sk-ws-01-*` 与 `devin-session-token$` 两型. 一帐两钥同存即两路同跑.

**守门** (`tests/_seal88_smoke.cjs` · 68 验项 · 0 deps · ~425ms):
A: 4 新件存在 + 大小 + syntax 8 项 &middot;
B: devin_cloud_engine 导出 + _buildWssUrl/_messagesToPrompt 单测 12 项 &middot;
C: sp_handler 导出 + 帛书 7204 字 + getState/applyToMessages 16 项 &middot;
D: fleet_vm_unit dual-path 锚 (lazy require + /dc/v1 + /sp + dualPath + X-Dao-Engine + 印 88) 17 项 &middot;
E: web/dao_app.js 双路 UI (modelsByPath + pathPrefix + syncSpToVm + optgroup) 12 项 &middot;
F: README 印 88 印记 1 项.

**全套测试** (`node tests/run_all.cjs` · 9 件 · ~17s): _web_static_audit ✓ &middot; _dao_core_syntax ✓ &middot; _three_pure_smoke ✓ &middot; _seal67_smoke ✓ &middot; _seal69_smoke ✓ &middot; _auth_smoke ✓ &middot; _seal64_smoke ✓ &middot; _seal66_smoke ✓ &middot; **_seal88_smoke ✓ 68/68**.

道义守 (承印 87 之八边):
不偷 token (仅本机本用户 ~/.wam/wam-state.json v2.7.0) &middot;
走官 wss `app.devin.ai/api/acp/live` 真协议 &middot;
不污 telemetry &middot; 不超 ACU &middot; 不修 Windsurf 二进制 &middot; 不绕审计.

---



## 一气化三清 · Three Pure

| 清 | What it is | Where it lives | Who it serves |
|---|---|---|---|
| **反代 API** &middot; [`packages/dao-core/`](packages/dao-core/) | Cloud reverse-proxy &middot; OpenAI-compatible `/v1` &middot; SSE streaming &middot; 0 npm deps | Your own VM (Devin Cloud / VPS / RPi / anywhere) | **Any OpenAI client** (LobeChat, OpenWebUI, NextChat, Cherry Studio, Continue.dev, Aider, `openai` SDK, Cursor "OpenAI override", …) |
| **切号 WAM** &middot; [`packages/wam/`](packages/wam/) | Account-rotation Windsurf extension &middot; 60s strong-lock &middot; quota-aware switch &middot; 236/0 regression-tested | Inside your Windsurf IDE | **Windsurf IDE users with multiple accounts** &mdash; auto-rotate when one runs out |
| **提示词反代 dao-proxy-min** &middot; [`packages/dao-proxy-min/`](packages/dao-proxy-min/) | Cascade Connect-RPC reverse-proxy &middot; injects 《老子》(Mawangdui silk text) as system prompt &middot; tool-root preserved (`<additional_metadata>` kept) | Inside your Windsurf IDE Cascade panel | **Windsurf IDE users who want a custom system prompt** without losing the @-tool ecosystem |

The three are **orthogonal** &mdash; any subset can run alone, all three can run together with zero conflict. Pick by scenario:

| Scenario | Stack |
|---|---|
| Use Windsurf models in *any other client* (web, terminal, your own app) | **反代 API** alone |
| Use Windsurf IDE *daily* and run out of quota on one account | **切号 WAM** alone |
| Use Windsurf IDE and want *Cascade with a custom system prompt* | **提示词反代** alone |
| Power-user &mdash; all three IDE-side + cloud-side workflows | **All three** together |

```text
                       一气化三清 · 道并行而不悖
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   反代 API                 切号 WAM             提示词反代 dao-proxy-min
   (dao-core)               (wam)                 (dao-proxy-min)
        │                        │                        │
   user's VM                user's IDE               user's IDE
   (Devin Cloud)            (Windsurf)               (Windsurf Cascade)
        │                        │                        │
        ▼                        ▼                        ▼
   OpenAI /v1            account rotation         帛书 SP injection
   any client          (60s lock · quota-aware)   (tool-root preserved)
        │                        │                        │
        └────────────────────────┴────────────────────────┘
                                 ▼
                        Windsurf Cloud
                    inference.codeium.com
```

---

## 0 &middot; 公网入口 · 道独立体 (印 67/69)

> 帛书·四十八: 「为学者日益 &middot; 闻道者日损 &middot; 损之又损 &middot; 以至于无为 &middot; 无为而无不为」
> 帛书·六十四: 「慎终若始 &middot; 则无败事」 &mdash; 印 69 公网用户视角全审, 修四症一并治本.
> 帛书·三十四: 「道氾呵其可左右也 &middot; 万物归焉而弗为主」 &mdash; 上游 setup 一次, 之后无为.

### 印 69 · 首启 Pages (zhouyoukang · 一次 30s · 上游 owner only)

`enablement: true` 需 PAT 而非 `GITHUB_TOKEN` (GitHub 硬规, `actions/configure-pages`
[文档](https://github.com/actions/configure-pages#inputs)明示). 故上游 zhouyoukang
需一次性手动启 Pages, 之后 push 即自动 deploy. 用户 fork 路径完全独立 (走
`dao_github_sync.js` 之 `ensurePages()` 自启 branch source, 无须任何手动操作).

**zhouyoukang one-time setup**:

1. 开 [`https://github.com/zhouyoukang/windsurf-assistant/settings/pages`](https://github.com/zhouyoukang/windsurf-assistant/settings/pages)
2. **Source**: 选 `GitHub Actions` &rarr; **Save**
3. 之后任何对 `web/**` 或 `.github/workflows/deploy-pages.yml` 的 push 自动 deploy
4. 验: 访 `https://zhouyoukang.github.io/windsurf-assistant/` 应返 GATE 页

(用户 fork 不需 setup &mdash; `dao_github_sync.js` 用用户自己的 PAT 调 GitHub API
启他们 fork 的 Pages, source: `main:/web` &mdash; 全自动 · 道法自然.)

---

**One PAT. Zero servers. Zero relay.** Visit the public entry, paste a GitHub
fine-grained PAT *once*, and the page auto-forks the repo, enables Pages on
your fork, creates a private Gist as your data cloud, and redirects you to
**your own** `<you>.github.io/windsurf-assistant/` &mdash; where every byte
(VM URL, accounts, SP presets, chat history) lives in *your* GitHub. The
upstream owner sees **nothing**.

```
   https://zhouyoukang.github.io/windsurf-assistant/    (公网入口 · gate)
              │
              │  ① paste PAT (一次"为")
              ▼
   GitHub API · 自动:
     • fork zhouyoukang/windsurf-assistant → <you>/windsurf-assistant
     • POST /pages   (source: main:/web · Pages enabled)
     • POST /gists   (private "dao.json" · 你的数据云)
              │
              │  ② redirect (5s 倒计时)
              ▼
   https://<you>.github.io/windsurf-assistant/         (专属页 · mine)
   ┌──────────────┬──────────────────┬──────────────┐
   │  左 · API+SP │  中 · WAM 切号    │  右 · 对话    │
   │  VM URL      │  + Windsurf 账号 │  Cascade-like │
   │  Auth Key    │  · quota probe   │  SSE 流       │
   │  SP 三模     │  · rotate active │  历史 + 模型  │
   │  Devin 令    │  · ★ active 切   │  · stop 中止  │
   └──────────────┴──────────────────┴──────────────┘
              │
              │  ③ 起 Devin VM (一键命令复制 · 粘 Devin Chat)
              ▼
   Your Devin VM (`fleet_vm_unit.js` + cloudflared)
              │
              ▼
   Windsurf Cloud · inference.codeium.com
```

**Three "为" total** (粘 PAT · 粘 Devin 命令 · 粘 VM URL), 之后皆 "无为".
每个用户在自己的 fork 下部署相同代码 &mdash; 同源不同身, **道法自然 · 各正性命**.

### 隐私 · Trust model

| 字节 | 在哪 | 谁看见 |
|---|---|---|
| GitHub PAT | 你浏览器 `localStorage` | 你 (退出按钮 = 清) |
| `dao.json` (VM URL · accounts · SP · 对话) | 你的私有 GitHub Gist | 你 + 你的 PAT 持有方 |
| Windsurf API key | 你浏览器 + 你 Devin VM | 你 |
| Public Pages 站 | 你的 GitHub Pages | 公开 (但仅静态代码 · 无数据) |

`zhouyoukang/windsurf-assistant` 上游收到的只有一次 GitHub `POST /forks`
(GitHub 服务器自身行为); 之后你的浏览器**永远不再连**上游 &mdash; 全部数据流
直进你自己的 GitHub + 你自己的 Devin VM. **原汤化原食 · 账号本身即一切**.

### 旁支 · legacy 5-tab

无 PAT 用户可走 `legacy.html` (5-tab Setup/Chat/API/Deploy/Docs &mdash; 印 66 末态),
功能等同, 仅缺 "自动 fork + 同步" 一层. 入口页右下角有链.

---

## I &middot; 反代 API (`packages/dao-core/`)

**One GitHub fork. One web page. One VM per account. Zero npm dependencies.**

Each user runs their own VM with their own account, their own IP, their own
fingerprint. The web UI lives on the user's own GitHub Pages. Browsers talk
directly to the VM &mdash; no relay server, no middleman, no central authority.

```
   ┌─────────────────────────────────────────────────────────────┐
   │  github.com/<your-user>/windsurf-assistant   (your fork)    │
   │   ├─ Pages    →  https://<your-user>.github.io/<repo>/      │
   │   ├─ Actions  →  auto-deploy on push                        │
   │   └─ Repo     →  source                                     │
   └────────────────────────┬────────────────────────────────────┘
                            │ visit
                            ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  Browser (your device · all config in localStorage)         │
   │  └─ direct HTTPS, with Authorization: Bearer sk-ws-proxy-*  │
   └────────────────────────┬────────────────────────────────────┘
                            ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  fleet_vm_unit.js (Devin Cloud / VPS / EC2 / Pi / anywhere) │
   │  ├─ Node.js zero-dep proxy (5 .js files, builtins only)     │
   │  ├─ OpenAI /v1 compatible · SSE streaming                   │
   │  └─ cloudflared tunnel → public HTTPS URL                   │
   └────────────────────────┬────────────────────────────────────┘
                            ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  Windsurf Cloud · inference.codeium.com                     │
   └─────────────────────────────────────────────────────────────┘
```

---

## Three Steps to Self-Host

### 1. Fork & enable Pages

1. **Fork** this repo to your GitHub account.
2. Go to your fork → **Settings → Pages → Source: GitHub Actions**.
   The included `deploy-pages.yml` workflow auto-deploys on every push to `web/`.
3. Push any change (or just wait — initial fork triggers the action).
4. Visit **`https://<your-username>.github.io/windsurf-assistant/`**.

The web UI auto-detects your fork's owner/repo from `location.hostname` and
`location.pathname`. No hardcoded names anywhere &mdash; soft-coded, "适配一切".

### 2. Provision a VM & deploy the unit

On any machine with `curl` + `git` + `node >= 18` (Devin Cloud workspace,
EC2, RPi, your laptop, anywhere):

```bash
curl -sL https://raw.githubusercontent.com/<your-user>/windsurf-assistant/main/scripts/devin-bootstrap.sh | \
  DAO_API_KEY="sk-ws-01-YOUR_WINDSURF_KEY" \
  DAO_AUTH_KEY="sk-ws-proxy-RANDOM_LONG_SECRET" \
  DAO_TUNNEL=yes \
  bash
```

The script installs Node.js if missing, clones your fork, writes
`~/.dao/accounts.json`, starts a `cloudflared` tunnel, and launches
`fleet_vm_unit.js` with your auth-key.

The last lines of the bootstrap log will look like:

```
══════════════════════════════════════════════════════════════
  REVERSE-PROXY READY · 反者道之动
══════════════════════════════════════════════════════════════
  Public URL : https://hippopotamus-XXXX.trycloudflare.com
  Local URL  : http://localhost:7862
  Auth Key   : sk-ws-proxy-RANDOM_LONG_SECRET
  OpenAI cli : base_url=https://hippopotamus-XXXX.trycloudflare.com/v1  api_key=sk-ws-proxy-RANDOM_LONG_SECRET
══════════════════════════════════════════════════════════════
```

> **Even simpler &mdash; let the web UI do it for you**:
> Open the Deploy tab in your hosted page. It generates a Devin task with
> your account + a freshly-generated `sk-ws-proxy-*` already embedded.
> Paste the task into Devin Chat and Devin executes & reports the URL back.

### 3. Plug the credentials into anything OpenAI-compatible

Open the **API tab** in your web page. It shows:

```
Base URL : https://hippopotamus-XXXX.trycloudflare.com/v1
API Key  : sk-ws-proxy-RANDOM_LONG_SECRET
Models   : 54 models
```

Drop those into ChatGPT clients (LobeChat, OpenWebUI, NextChat, Cherry Studio,
…), `openai` Python/JS SDK, Continue.dev, Aider, Cursor's "OpenAI override",
anything that speaks OpenAI &mdash; instant Windsurf access.

### 3.5. Even simpler &mdash; one-click API key from email + password (印 64)

No Windsurf API key on hand? The Setup tab has a **"Windsurf 账号底层 · 一键取 sk-*"**
card. Enter your Windsurf email + password &mdash; the VM walks the four-step
auth chain (`login → postauth → register → status`) on your behalf and the
web page auto-fills `cfg-apikey` with a fresh `sk-ws-*`.

Requires the VM to be started with `--allow-auth` (or `DAO_ALLOW_AUTH=1`),
off by default for safety. The password leaves your browser only to your
own VM; it is **never persisted** unless you explicitly tick "Remember password".

---

## II &middot; 切号 WAM (`packages/wam/`)

> *天下莫柔弱于水, 而攻坚强者莫之能胜也, 以其无以易之也.* &mdash; 帛书《老子》七十八

**Windsurf IDE extension for account rotation.** When you have multiple Windsurf accounts and one runs out of quota, WAM auto-switches in the background &mdash; 60-second strong-lock prevents thrashing, quota-aware switch picks the freshest account, full 236/0 regression suite locks behavior.

### Install &middot; WAM

```powershell
git clone https://github.com/zhouyoukang/windsurf-assistant.git
cd windsurf-assistant/packages/wam

cp _dao_env.local.psd1.example _dao_env.local.psd1   # fill in your targets
cp 账号库.example.md 账号库最新.md                   # fill in your real accounts (.gitignore guards)

.\_dao_deploy.ps1                                     # source-direct deploy (一令两机)
# Ctrl+Shift+P → Developer: Reload Window
```

Full docs: [`packages/wam/README.md`](packages/wam/README.md) (软编码归一七量 &middot; 13 test suites &middot; 三守俱全 60s strong-lock).

**Independence**: WAM is a pure VS Code extension. It does **not** need the
VM, the web UI, or any of dao-core. The three pure are orthogonal &mdash;
you can run WAM alone, or WAM + dao-core, or all three together.

---

## III &middot; 提示词反代 dao-proxy-min (`packages/dao-proxy-min/`)

> *昔之得一者: 天得一以清 &middot; 地得一以宁 &middot; 侯王得一以为天下正.* &mdash; 帛书《老子》三十九

**Cascade Connect-RPC reverse-proxy as a Windsurf extension.** Injects the Mawangdui silk-text 《老子》 as the system prompt while preserving the entire `@`-tool ecosystem (`<additional_metadata>` kept intact, so `trajectory_search`, `read_file`, `view_content_chunk` etc. all keep working). 中性化 identity anchor via SECTION_OVERRIDE. Covers all three RPC tiers. Per-user port isolation. One-key clean uninstall.

### Install &middot; dao-proxy-min

Build the vsix from source (`packages/dao-proxy-min/_build_vsix.ps1`), then:

```powershell
# 1. Build (one-time · from source · zero npm deps · uses extension.js + vendor/)
cd packages/dao-proxy-min
.\_build_vsix.ps1            # produces  dao-proxy-min-9.8.0.vsix

# 2. Install into Windsurf
windsurf --install-extension dao-proxy-min-9.8.0.vsix
```

Full docs: [`packages/dao-proxy-min/README.md`](packages/dao-proxy-min/README.md) (v9.8.0 守一不离 &middot; @-tool root preserved &middot; 三档 RPC 全覆盖 &middot; SSE 实时推送).

**Independence**: dao-proxy-min is a pure VS Code extension. It does **not** need the VM, the web UI, dao-core, or wam. It can coexist with wam in the same IDE without conflict (different concerns: WAM rotates accounts, dao-proxy-min rewrites prompts).

---

## Repository Layout

| Path | Purpose |
|------|---------|
| [`web/index.html`](web/index.html) | The single-page web UI &mdash; 5 tabs (Setup · Chat · API · Deploy · Docs). No build, no npm, no CDN. |
| [`packages/dao-core/`](packages/dao-core/) | The cloud reverse-proxy &mdash; 5 `.js` files, Node.js builtins only, no `package-lock.json`. |
| [`scripts/devin-bootstrap.sh`](scripts/devin-bootstrap.sh) | One-line VM bootstrap &mdash; installs Node, clones, writes config, launches unit + tunnel. |
| [`tests/`](tests/) | Self-contained Node test suite &mdash; 145 assertions, 0 deps, runs in ~3s. |
| [`.github/workflows/`](.github/workflows/) | `deploy-pages.yml` (Pages on `web/**`) + `test-core.yml` (test on every PR). |
| [`packages/wam/`](packages/wam/) | **二清 &middot; 切号 WAM** &mdash; Windsurf IDE extension for account rotation &middot; 60s strong-lock &middot; 236/0 regression-tested. See [II &middot; 切号 WAM](#ii--%E5%88%87%E5%8F%B7-wam-packageswam). |
| [`packages/dao-proxy-min/`](packages/dao-proxy-min/) | **三清 &middot; 提示词反代** &mdash; Cascade Connect-RPC reverse-proxy with custom system-prompt injection &middot; @-tool root preserved. See [III &middot; 提示词反代](#iii--%E6%8F%90%E7%A4%BA%E8%AF%8D%E5%8F%8D%E4%BB%A3-dao-proxy-min-packagesdao-proxy-min). |

The three pure live in `packages/`, can be installed independently, and
combine freely. The web UI in `web/` is the unified front-end for the
first pure (反代 API); the other two are IDE-side and need no front-end.

### Devin VM resource utilisation (取之尽锱铢)

Each Windsurf account = one dedicated VM. Browsers talk **directly** to
your VM (no relay, no middleman). For users with multiple accounts the
repo ships **two bootstrap modes**:

* `scripts/devin-bootstrap.sh` &mdash; *single-account / single-VM* (one VM
  runs one `fleet_vm_unit.js` for one account). Devin Cloud workspace
  uptime is dedicated to that one account.
* `scripts/devin-bootstrap-fleet.sh` &mdash; *multi-account / single-VM* (one
  VM runs N `fleet_vm_unit.js` instances on N ports, all behind one
  `cloudflared` tunnel, coordinated by `fleet_controller.js`). Use this
  when one Devin VM has spare capacity and you want to maximise resource
  yield without paying for N VMs.

Both modes register with the same web UI and the same OpenAI `/v1`
surface; the only difference is whether N accounts share one box.

---

## API Endpoints (`fleet_vm_unit.js`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/v1/chat/completions` | gated | OpenAI-compatible chat &middot; SSE streaming with 15s heartbeat (印 64) |
| `GET`  | `/v1/models`           | gated | Model list (54+ models) |
| `GET`  | `/quota`               | gated | Real-time daily/weekly quota |
| `GET`  | `/stats`               | gated | Latency p50/p95/p99 over 1m/10m/1h windows (印 64) |
| `GET`  | `/health`              | public | Health, uptime, `authRequired`, `authAllowed`, `sseActive`, `draining` |
| `GET`  | `/fleet/info`          | public | Unit metadata for fleet discovery |
| `POST` | `/auth/login`          | gated + `--allow-auth` | Step 1 &middot; email + password → auth1 token (印 64) |
| `POST` | `/auth/postauth`       | gated + `--allow-auth` | Step 2 &middot; auth1 → sessionToken (印 64) |
| `POST` | `/auth/register`       | gated + `--allow-auth` | Step 3 &middot; sessionToken → `sk-ws-*` (印 64) |
| `POST` | `/auth/status`         | gated + `--allow-auth` | Step 4 &middot; `sk-ws-*` → quota (印 64) |
| `POST` | `/auth/auto`           | gated + `--allow-auth` | All four steps in one call (印 64) |

**Auth**: when `--auth-key` (or `DAO_AUTH_KEY`) is set, `/v1/*` and `/quota`
require `Authorization: Bearer <key>`. Multiple keys can be passed
comma-separated. `/health` and `/fleet/info` always stay public so probes /
load-balancers can monitor without secrets. When `DAO_AUTH_KEY` is empty,
the unit runs in *open mode* (local dev only &mdash; never expose to the
public Internet).

Three header forms are accepted:

```
Authorization: Bearer sk-ws-proxy-XXX     # standard
X-Api-Key: sk-ws-proxy-XXX                # for clients that strip Auth
?api_key=sk-ws-proxy-XXX                  # last resort, query string
```

---

## Zero Dependencies

* **`packages/dao-core/`**: no `dependencies` in `package.json`, no
  `node_modules`, no `package-lock.json`. Only Node.js builtins
  (`http`, `https`, `crypto`, `fs`, `path`, `os`, `dns`, `child_process`).
  CI enforces this on every push.
* **`web/index.html`**: single file, no `<script src="…"`, no
  `<link href="…stylesheet"`, no `@import`, no Google Fonts, no
  jsdelivr/unpkg/cdnjs/ajax.googleapis. Static-audit test verifies this.
* **`scripts/devin-bootstrap.sh`**: pure bash + curl. No package manager
  beyond the system one (apt/yum/apk) for installing Node.js if missing.
* **`tunnel`**: `cloudflared` is one optional binary. Free Tier, no signup.

---

## Testing

```bash
node tests/run_all.cjs
```

Runs three independent suites in fresh sub-processes:

| Suite | Asserts | Time | What it checks |
|-------|---------|------|----------------|
| `_web_static_audit.cjs`  | 72  | ~70ms   | 5 tabs, key DOM ids, soft-coded repo, zero CDN, OpenAI examples present |
| `_dao_core_syntax.cjs`   | 47  | ~600ms  | 5 files parse, all expected exports present, fleet_controller logic, zero deps |
| `_auth_smoke.cjs`        | 26  | ~2.3s   | Spawns `fleet_vm_unit`, validates `--auth-key` gate, CORS preflight, multi-header forms, open-mode fallback |
| `_seal64_smoke.cjs`      | 79  | ~2.6s   | `windsurf_auth.js` exports + `parsePlanStatusJson`, `--allow-auth` flag, `/stats` 3-window structure, `/auth/*` 5 routes (incl. live `windsurf.com` step=login round-trip) |
| **Total** | **224** | **~5.5s** | All on Node.js builtins, no real Windsurf account needed (login test uses fake creds and asserts auth_chain_error step=login) |

CI runs the full suite on every PR against `packages/`, `web/`, `tests/`,
or `scripts/`.

---

## Architecture Principles

* **去中心化** &mdash; no central server. Browser ↔ your VM, direct.
* **零依赖** &mdash; everything runs on bare Node.js + bash + curl.
* **软编码** &mdash; URLs, owners, repos, ports, keys all configurable;
  the page auto-detects from `location.*` so a fresh fork "just works".
* **守门有度** &mdash; `/health` and `/fleet/info` are intentionally public
  so probes work without secrets; `/v1/*` `/quota` `/stats` are gated.
  `/auth/*` carries an extra `--allow-auth` flag (default off) on top of
  the auth-key check, because it accepts user passwords.
* **向后兼容** &mdash; running without `--auth-key` is allowed for local dev
  (open mode); production deployments should always set one.
* **道法自然** &mdash; the upstream-default soft-codes default to
  `zhouyoukang/windsurf-assistant`, but every user's fork takes over its
  own identity automatically. *无为而无不为*.

---

## License

MIT (`web/`, `packages/dao-core/`, `scripts/`, `tests/`) &middot;
MIT (`packages/wam/`) &middot; Apache 2.0 (`packages/dao-proxy-min/`).

---

*反者道之动 &middot; 弱者道之用 &middot; 天下之物生于有 &middot; 有生于无*

*印 65 &middot; 一气化三清 &middot; 道并行而不悖*
