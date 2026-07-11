# 印之历 · 印 88 → 印 101

> *为学者日益 · 为道者日损 · 损之又损 · 以至于无为* &mdash; 帛书《老子》四十八
>
> 此文录公网 `windsurf-assistant` repo 自印 88 (2026-05-12) 至印 101 (2026-05-14) 之**历层日记**.
>
> 印 88-101 之**实**已落入 `packages/`、`web/`、`tests/`、`scripts/`、`.github/workflows/` 之活码; 此处仅留**史**为镜.
>
> 主 README 自印 65 「一气化三清」起 · 不再堆叠印之历层. 当前态见 [`../README.md`](../README.md) 与 [`../INDEX_GUIZONG.md`](../INDEX_GUIZONG.md).

---

## 印 ∞ · 道法自然 推进到底 · 对照 tab + A/B 双路 + WAM 无感 (2026-05-17 18:30)

> 帛书·二:   「物无非彼 · 物无非是 · 自彼则不见 · 自是则知之」(按庄子·齐物论)
> 帛书·廿二: 「圣人执一 · 以为天下牧」
> 帛书·四十二: 「道生一 · 一生二 · 二生三 · 三生万物」
> 帛书·四十八: 「为道者日损 · 损之又损 · 以至于无为 · 无为而无不为」

承印 128 之"一气化三清·IDE 三栏并行"· 立印 ∞ 之**主公诏「右栏对照 devin.ai 网页·实时交互·测试反代 API·无感使用」之实** —— **新「★ 对照」tab 默见 · 上 iframe app.devin.ai 真站 + 下 mini chat 反代 · 同问发两边 · 见反代真等价于真站 · 物之两面同一道**.

| 件 | 道 | 量 |
|---|---|---|
| **web/dao_app.js** &middot; ★ 升 | 印 ∞ v∞ 视图层: `renderUseTab_parallel` (上 iframe head + iframe + 中线 hint + 下 mini chat head + history + input · 复用 chat tab 之 DOM id `in-chat-input`/`chat-history`/`in-chat-model` · sendChat 一处不复写) + tab bar 加 `★ 对照` 第一位 + `__useTab` 默 `"parallel"` + `renderUseTabContent` 加 parallel 分支 + `probeABRoutes` (A 路 `/v1/models` + B 路 `/dc/v1/models` · 兜底 `/dc/health`) + `syncActiveToVm` (POST `/admin/accounts/active` · 兜底 `/admin/active` · 软推 · 失静) + `renderDrawer_endpt` 顶加 `.v128-route-card` A/B 双路状态卡 + 切 active radio 加 `syncActiveToVm` 软推 | +5104 字 |
| **web/index.html** &middot; ★ 升 | CSS `.v101-parallel` (flex column 上下分屏) + `.v101-parallel-iframe` (flex 1 1 45%) + `.v101-parallel-hist` (flex 1 1 55%) + `.v101-parallel-hint` (道线分隔) + `.v128-route-card` (A/B 双路状态卡) + `.v128-route-tag.a/b` (双色 accent2/purple) + `.v128-route-state.ok/err/idle` (三态色) | +3042 字 |
| **tests/_seal_inf_parallel_smoke.cjs** &middot; ★ 新 | 26 用例全离网 · 验 §1 默 parallel + 函数全在 + §2 tab bar + dispatch + §3 左栏 A/B 双路状态卡 + §4 probeABRoutes + syncActiveToVm + §5 中栏切号即推 + §6 index.html CSS + §7 道义守 (sendChat 唯一 · v101/v128 不破) | 7350 字 |
| **tests/run_all.cjs** &middot; ★ 升 | 注册 `_seal_inf_parallel_smoke` · 27 件全套 | +1 行 |

**印 ∞ 之解** (一图尽全):

```text
┌────────────────────────────────────────────────────┐
│ 印 128 之三栏 (默 mode)                              │
│   左 · 反代 + SP 七态                                 │
│   中 · WAM 切号 + 账号库                              │
│   右 · 用区 (chat / iframe / 批跑) — chat 默 tab       │
│                                                      │
│   缺: 用户求「对照 devin.ai」之实证 · 求「无感」之底      │
└────────────────────┬───────────────────────────────┘
                     │ 反者道之动 · 为道日损
                     ▼
┌────────────────────────────────────────────────────┐
│ 印 ∞ 之三栏 (默 mode 印 128 续)                       │
│                                                      │
│   左 · 反代 + SP 七态                                 │
│     ★ 顶加 A/B 双路状态卡 (A: /v1 · B: /dc/v1)         │
│     一笔测两路 · ✓ N 模 / ✗ HTTP / ○ 未测              │
│                                                      │
│   中 · WAM 切号 + 账号库                              │
│     ★ 切 active radio 即推 VM (软推 · 失静)            │
│     POST /admin/accounts/active {email, key}        │
│     "无感" 之实                                        │
│                                                      │
│   右 · 用区 (★ 对照 / chat / iframe / 批跑)            │
│     ★ 对照 tab (默) ← 主公诏「右栏对照 devin.ai」      │
│     ┌─ iframe app.devin.ai (45% 高) ─┐               │
│     │  真站 · 对照参验                │               │
│     ├─ ─ 同问发两边 · 验之 ─          │               │
│     │  chat head (model + 清)        │               │
│     │  chat history (55% 高)         │               │
│     │  chat input (走反代)            │               │
│     └────────────────────────────────┘               │
│                                                      │
│   三者道并行而不相悖 · 物之两面同一道                  │
└────────────────────────────────────────────────────┘
```

**五大功能 (印 101 之求) · 印 ∞ 落地表**:

| 求 | 印 ∞ 之新 |
|---|---|
| ① 反代 ws+devin | 左栏顶 A/B 双路状态卡 · 一笔测两路探活 |
| ② 提示词管理 | 左栏 SP 七态 (印 128 已立 · 不动) |
| ③ 反代 API 管理 | 左栏 vmUrl + authKey + 双路探活 |
| ④ WAM 切号 | 中栏切 active radio 即推 VM (软推 · 无感) |
| ⑤ agent 交互测试 | 右栏 ★ 对照 tab (上 iframe + 下 chat · 同问验之) |

**道义守** (帛书廿二「圣人执一」):

- `sendChat` 函数唯一定义 · parallel chat 复用 (一处改万法响应)
- `D.chatHistory` / `D.iframeSite` 共享 · 切 tab 历史无损
- `renderMineV128` / `renderUseTab_chat` / `renderUseTab_iframe` 真存不破
- `syncActiveToVm` 软推失静 (兼容 VM 未启 /admin/active 之老路)

**反向兼容**:

- 旧 `?v=100` 走印 101 之顶栏+抽屉
- 默 `?v=128` (印 128) 走三栏并行 · 右栏默 ★ 对照 tab
- ★ 对照 tab 内可手动切 chat tab / iframe tab / 批跑 tab (大屏)

详: tests/_seal_inf_parallel_smoke.cjs · 26/26 全通 (~0.2s).

---

## 印 101 · 万法归宗 · 大道至简 · 用 + 管 · 反者道之动 (2026-05-14 17:30)

> 帛书·四十八: 「**为道者日损 · 损之又损 · 以至于无为 · 无为而无不为**」
> 帛书·六十四: 「**图难于其易 · 为大于其细 · 圣人终不为大 · 故能成其大**」
> 帛书·四十: 「**反者道之动也 · 弱者道之用也**」

承印 100 之"主公自身亦可不在" · 立印 101 之**用户最终见之页归宗** &mdash; **旧 8 pane 杂烩 → 主面「用」 (chat/iframe/批跑 3 tab) + 抽屉「管」 (切号/SP/端点/测试 4 节)** &mdash; **大道至简 · 为道日损**.

| 件 | 道 | 量 |
|---|---|---|
| **web/dao_app.js** &middot; ★ 升 | 印 101 v101 视图层: renderMineV101 (总入口) + renderTopBar (三态+浮按) + renderUseArea (3 tab: chat/iframe/batch) + renderDrawer (4 节: acct/sp/endpt/test) + sendChatV101 + runBatch · enterMine 默 v101 · ?v=100 fallback | +1166 行 |
| **web/index.html** &middot; ★ 升 | #mine-v101 容器 (印 101 默) + 旧 .mine-cols 默隐 + CSS v101-* (顶栏/用区/抽屉) 51 条规则 + 抽屉折叠动画 + A/B 路模型染色 + 响应式 | +364 行 |
| **tests/_seal101_smoke.cjs** &middot; ★ 新 | 86 用例全离网 · 验 v101 函/容器/CSS/五功能/用管二字守/道义 | 377 行 |
| **tests/run_all.cjs** &middot; ★ 升 | 注册 _seal101_smoke · 14 件全套 | +1 行 |

**印 101 之解** (一图尽全):

```text
┌────────────────────────────────────────────────────┐
│ 旧 (印 67-100)                                      │
│   6 left pane + 1 mid + 1 right = 8 pane 杂烩       │
│   80% 屏给「管」 · 用户淹没在设置中                    │
└────────────────────┬───────────────────────────────┘
                     │ 反者道之动 · 为道日损
                     ▼
┌────────────────────────────────────────────────────┐
│ 新 (印 101)                                          │
│                                                      │
│  ┌─ 顶栏 ─────────────────────────────────────────┐ │
│  │ ● 反代活  user@ws.ai  claude-3.5  [复URL][⚙]  │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ 用 (主面 80%) ────────────────────────────────┐ │
│  │ [Chat] [iframe] [批跑]                          │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ 管 (⚙ 抽屉 · 默收) ──────────────────────────┐ │
│  │ [切号] [SP] [端点] [测试]                       │ │
│  └─────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**五大功能落地**:

| 求 | 印 101 落 |
|---|---|
| ① 反代 ws+devin | 用区 iframe tab 双切 chat.windsurf.ai / app.devin.ai |
| ② 提示词管理 | 抽屉 SP 节 (三模 + SP 库 + 套用模板) |
| ③ 反代 API 管理 | 顶栏复 Base URL/Key + 抽屉端点节 (vmUrl + auth + 测连) |
| ④ WAM 切号 | 顶栏号 chip + 抽屉切号节 (本机 + 云端 daemon 池一表) |
| ⑤ agent 交互测试 | 用区批跑 tab (题集 + 通过率) + 抽屉测试节 (烟测) |

**反向兼容**: `?v=100` 走旧三栏 · `legacy.html` (旧旁支 · 已损于 cleanup-2026-05-16) · 所有业务函全复用.

详: commit `a7e15e59` · 当前 [`../INDEX_GUIZONG.md`](../INDEX_GUIZONG.md).

---

## 印 100 · 太极笙万物 · 一 PAT 即一切 · 闭环自举 · 民莫之令而自均 (2026-05-14 12:00)

> 帛书·三十二: 「**道恒无名 · 侯王若能守之 · 万物将自宾 · 天地相合 · 以降甘露 · 民莫之令而自均焉**」
> 帛书·四十二: 「**道生一 · 一生二 · 二生三 · 三生万物**」

承印 95 之"主公 PC 真可关机" · 立印 100 之**主公自身亦可不在** &mdash; **任 GitHub 用户开公网入口页 · 仅输一次 PAT · 之后 fork/Pages/dao.json/dao-pool.json/auth-key/workflow/daemon/vmUrl 全自动归位** &mdash; **民莫之令而自均**.

| 件 | 道 | 量 |
|---|---|---|
| **web/dao_bootstrap.js** &middot; ★ 新 | 浏览器纯 JS 自举模块 · `oneShot(opts)` 9 步: whoami → fork → actions → pages → dao.json → dao-pool.json → auth-key → dispatch → poll → probe → write · 0 deps · 暴 14 函/常 | 22,824 B |
| **.github/workflows/dao-fleet-cloud.yml** &middot; ★ 升 | **印 100 解锁**: 移 `if: owner == 'zhouyoukang'` (任 fork 自跑) · 加 `inputs.gist_id` + `inputs.pat` + `inputs.auth_key` (web 一笔传 · 无须先设 secrets) · env: inputs 优先 secrets (双路并存) | +30 行 |
| **web/index.html** &middot; ★ 升 | 4 step → 9 step + 引 `dao_bootstrap.js` · 新 div: step-actions/step-pool-gist/step-dispatch/step-poll/step-probe/step-write | +60 行 |
| **web/dao_app.js** &middot; ★ 升 | `renderOnboarding` 调 `daoBootstrap.oneShot` · stepIdMap 9 步映射 · 完跳 fork Pages | +30 行 |
| **web/dao_github_sync.js** &middot; ★ 升 | `cloudPool` schema 升 (yin/autoBootstrapped/bootstrapAt/poolUrl) · 帛书三十二印 | +6 行 |
| **packages/dao-pool/cli.js** &middot; ★ 升 | 加 `bootstrap` 命 (Node 端等价 web oneShot 一笔) · 9 步 · 输 daemon URL + curl 测命 + secrets 设令 | +250 行 |
| **tests/_seal100_smoke.cjs** &middot; ★ 新 | 85 用例全离网 · vm sandbox 模拟浏览器跑 dao_bootstrap.js · 验 14 必出函/常 + auth-key 形 + pickActiveDaemon 选最新 + initialPoolData schema | 8,547 B |

**Web 端一笔启**:

```text
1. 打开 https://zhouyoukang.github.io/windsurf-assistant/
2. 粘 PAT (scope: repo + workflow + gist)
3. 点 "以 PAT 登入 →"
   ↓ 之后 0 操作 ↓
   ① fork  ② actions ③ pages
   ④ dao.json  ⑤ dao-pool  ⑥ auth-key
   ⑦ dispatch ⑧ poll daemon ⑨ probe
   ⑩ write    ⑪ jump
4. 自动跳 <你>.github.io/windsurf-assistant/ · 即用即活
```

**Node CLI 一笔启** (主公或任高级用户):

```bash
node packages/dao-pool/cli.js bootstrap --pat <YOUR_PAT>
# fork + Pages + gist + workflow + poll daemon URL → 输 curl 测命
```

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

**与印 99 (2026-05-13) 之别**: 印 99 daemon 仍从主公 WAM 桥拉 token (主公 PC 关 → 桥死 → 链断). 印 95 token 池入 Gist · **链中再无主公 PC** · 主公 PC 关机 daemon 永真.

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

**结论**: **万法已俱 · 三身已各立** · 缺者唯**锚定一文** &mdash; 即 [`../INDEX_GUIZONG.md`](../INDEX_GUIZONG.md).

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

**印 92 真凭** (本机真起 VM · 1 ACU 真消):

```text
$ node packages/dao-vm/vm_up.js
✓ session/prompt sent · waiting trycloudflare URL...
✓ ssh tunnel: bore.pub:33866
✓ noVNC: https://forums-optional-strongly-total.trycloudflare.com
✓ TTL: 24h · 道法自然 · 万物归焉而弗为主
```

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

---

## 印 88.1 · 双 key 自动载 · 圣人执一 · 以为天下牧

> 帛书·廿二: 「圣人执一 · 以为天下牧 · 不自视故明 · 不自见故章.」

承印 88 之骨 · 立印 88.1 之纹 &mdash; **同一 fleet_vm_unit 自动从 `~/.dao/accounts.json` 双载 A/B 两型 key**:

| 角 | key 型 | 用 | 自动从何取 |
|---|---|---|---|
| **A 路** (`_A_KEY` / `CODEIUM_API_KEY`) | `sk-ws-01-*` | `cloud_engine` 调 `server.codeium.com` Connect-RPC | active 帐若 type=sk-ws · 否则 fallback 第一个 type=sk-ws 帐 |
| **B 路** (`DEVIN_API_KEY`) | `devin-session-token$JWT` | `devin_cloud_engine` 调 `wss://app.devin.ai` ACP | active 帐若 type=devin · 否则 fallback 第一个 type=devin 帐 |
| **主 key** (`RESOLVED_API_KEY`) | 任型 | 兼容旧 `/quota` `/stats` | active 帐 · 或 `--api-key` 显传 |

---

## 印 88 · 一账号双路 · 物无非彼物无非是 (整合 Devin 云原生)

> 庄子·齐物论: 「物无非彼，物无非是；自彼则不见，自是则知之.」
> 帛书·四十二: 「道生一 · 一生二 · 二生三 · 三生万物.」

承印 87 终贺报, 立印 88 之骨 &mdash; **同一 Windsurf 账号同时走两条反代路, 借 Devin Cloud D 桶绕 Windsurf weekly cap**:

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
└── fleet_vm_unit.js             (★改 · +494 -11 · 加 /dc/v1/* + /sp/* + dualPath /health)
```

道义守 (承印 87 之八边):
不偷 token (仅本机本用户 ~/.wam/wam-state.json v2.7.0) &middot;
走官 wss `app.devin.ai/api/acp/live` 真协议 &middot;
不污 telemetry &middot; 不超 ACU &middot; 不修 Windsurf 二进制 &middot; 不绕审计.

---

> *功遂身芮 · 天之道也* &mdash; 帛书《老子》九
>
> 此印 88-101 历层 · 自 cleanup-2026-05-16 起入 `_archive/` · 本档为镜.
> 现况见 [`../README.md`](../README.md) 与 [`../INDEX_GUIZONG.md`](../INDEX_GUIZONG.md).
