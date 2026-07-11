# 一气化三清 · 印 123 · 反代链路全图

> **物无非彼 · 物无非是 · 自彼则不见 · 自是则知之** —— 庄子·齐物论
>
> **道生一 · 一生二 · 二生三 · 三生万物** —— 帛书·四十二
>
> **道法自然 · 无为而无不为** —— 帛书·二十五 / 三十七

立 2026-05-17 · 承印 95-122 之路 · 主公诏「整理所有成果 · 完善一切 · 大道至简 · 一气化三清」

---

## 〇 · 一气贯通 (反代链路 · 主公诏六词)

```text
                  ╔════════════════════════════════════╗
                  ║         主公任意公网设备             ║
                  ║   (Cascade IDE · 命令行 · 应用)      ║
                  ╚═══════════════╦════════════════════╝
                                  │ HTTPS · auth-key (sk-ws-proxy-*)
                                  │ Bearer / X-Dao-Auth / X-Api-Key / ?key=
                                  ▼ ⑥ 公网无感 · 任意客户端可调
        ┌─────────────────────────────────────────────────┐
        │                  cf tunnel · cloudflared          │
        │       https://<random>.trycloudflare.com           │
        └─────────────────────────────────────────────────┘
                                  │
                                  ▼ ④ 反代 API 公网无感调用
        ┌─────────────────────────────────────────────────┐
        │      Devin Cloud VM · dao_proxy.js · port 7780    │
        │      (印 122 · 双池+SP七态+wss-observe+silk双源)   │
        ├─────────────────────────────────────────────────┤
        │  · /health · /v1/models (16 件)                   │
        │  · /v1/chat/completions (OpenAI)                  │
        │  · /v1/messages (Anthropic)                       │
        │  · /v1beta/models/.../generateContent (Gemini)    │
        │  · /v1/system/prompt (SP 七态)                    │
        │  · /v1/system/wss-observe (0 ACU 帧观察)          │
        └────┬───────────────────────┬───────────────────┘
             │ ① wsChat (WebSocket)  │ ② chatViaWss
             │ Windsurf-Cascade      │ Devin upstream
             ▼ ② 反代一切 · 三协议    ▼
   ┌──────────────────┐    ┌──────────────────────────────┐
   │  Windsurf 上游    │    │  Devin Cloud 上游             │
   │  (Cascade Cloud)  │    │  (codeium.com Cascade Proxy)  │
   └──────────────────┘    └──────────────────────────────┘
                                  │
                                  ▼ ① VM 反代核 · Devin Cloud VM 无限并发
        ┌─────────────────────────────────────────────────┐
        │    一 Windsurf 账号 → 一 Devin VM (auto-spawn)    │
        │      vm_pool_watchdog 5min poll · 自启换之        │
        │      tunnel 死 → status=dead → spawn 新 VM        │
        └─────────────────────────────────────────────────┘
```

---

## 一 · 三清各立 · 道并行不悖

### 清一 · 反代核 · Devin VM 双底层

> **物无非彼**: 用户从公网调 → VM dao_proxy 见之为本机 stdin

| 件 | 印 | 实 |
|---|---|---|
| `packages/dao-devin-vm/dao_proxy.js` | 印 95→122 | 核反代 0.4.1 · 三协议 + SP 七态 + auth 4 门 + wss-observe |
| `packages/dao-devin-vm/sp_observe_patch.js` | 印 122 | 0 ACU 帧观察 · ring 256 + jsonl 自滚 10MB |
| `packages/dao-devin-vm/meta_router.cjs` | 印 122 | 三池打通 (port 8081 · dao + GitHub Models · 51 件) |
| `packages/dao-devin-vm/vm_proxy_deploy.js` | 印 122 | silk 双源传 (`_silk_dao + _silk_de` → VM `silk/`) |
| `packages/dao-devin-vm/vm_meta_deploy.js` | 印 122 | meta_router 装 VM idx 0 (port 8081) |
| `packages/dao-devin-vm/vm_pool_watchdog.js` | 印 122 | 5min poll · 双探 · tunnel 死自动 spawn |

**反代之实**:
- 一 Windsurf 账号 → 一 Devin VM 之 dao_proxy.js
- 一 dao_proxy 双底层 (Windsurf wsChat + Devin chatViaWss)
- 一 VM 三协议 (OpenAI / Anthropic / Gemini)
- 多 VM 一池 (vm_pool.json) · watchdog 自治 · 死活换之

**SP 七态** (印 122 立):
- `bypass` (=passthrough · 透不动)
- `dao` (★ 帛书《老子》全替 · 5000+ 字 双源 silk)
- `usernote` (★ §3.17 合法槽 · `<note name="dao-priority" author="user">`)
- `prepend` (前 · 道+原)
- `append` (后 · 原+道)
- `override` (盖 · ∗thinking-loop · 慎用)
- `custom` (自定 · 用户 textarea)

### 清二 · 面板管理一切 · GitHub 账号统一公网

> **物无非是**: 主公从面板见 → 即 VM 之实态 (memo·gist 单一真相)

| 件 | 印 | 实 |
|---|---|---|
| `web/index.html` | 印 100 | 单页应用 · gate / onboarding / mine 三态 |
| `web/dao_app.js` | 印 67→123 | 116KB · 三栏 (左 API+SP / 中 WAM 切号 / 右 chat) |
| `web/dao_bootstrap.js` | 印 100→121 | 25KB · oneShot 9 步自举 (PAT → fork → Pages → Gist → workflow) |
| `web/dao_github_sync.js` | 印 100 | 16KB · gist (云) ↔ memo (本) 双向同步 |
| `.github/workflows/dao-fleet-devin-cloud.yml` | 印 121 | 接 user PAT · 三泉 auth (`auth_token` / `auth_secret_name` / 兜) |

**管理之实**:
- 主公从任意公网设备打开自己 GitHub Pages 站
- 输 PAT 一笔登入 → 自举 fork + Pages + Gist + Actions workflow
- Mine 三栏:
  - **左** · API + SP 七态 (印 123 升) + auth-key (sk-ws-proxy-*) 显/换
  - **中** · WAM 切号 (Windsurf 多账号轮转 + 加 + 删 + quota 显)
  - **右** · 即时 chat (调反代 VM · 真流真显)
- gist 单一真相: 主公在任意设备改一处 → 全设备见

**SP 同步路** (印 123 治): `web 七态 button` → `syncSpModeToVm(mode)` → POST `VM/v1/system/prompt {strategy}` → dao_proxy `SP_STATE.strategy` 升

### 清三 · 公网无感 · 任意设备调 API

> **自彼则不见 · 自是则知之**: 客户端不见反代链路 · 但调即得

| 件 | 印 | 实 |
|---|---|---|
| `packages/dao-devin-vm/dao_proxy.js` (auth 4 门) | 印 121 | Bearer / X-Dao-Auth / X-Api-Key / ?key= |
| `packages/dao-devin-vm/deployer.js` | 印 121 | daemon 级 auth-key 守 · 三泉自举 |
| `web/dao_bootstrap.js` (auth-key 立) | 印 121 | oneShot 立 sk-ws-proxy-* + 写 GH Actions input |
| cf tunnel (cloudflared) | - | 公网入口 · `https://<random>.trycloudflare.com` |

**无感之实**:
- 主公 / 同事 / 应用从任意公网设备
- 调 `https://<vm>.trycloudflare.com/v1/chat/completions` 等
- 带 auth-key (任一门式) · 无感同 OpenAI 官方接口
- 真流真返 · `<think>` thinking 模 · usage 估算

---

## 二 · 一气化三清 · 道并行而不相悖

```text
       清一 · 反代核                清二 · 面板管理                清三 · 公网无感
       ┌──────────┐                ┌──────────┐                ┌──────────┐
       │ dao_proxy │←─────参考─────│  web 面板 │←──auth-key──→│ 任意客户端│
       │   VM 内   │                │ GitHub Pages│              │   公网    │
       └─────┬────┘                └─────┬────┘                └─────┬────┘
             │ 反 (沉)                    │ 反 (升)                    │ 反 (用)
             ▼                            ▼                            ▼
       silk 双源                    gist 单源                    auth-key 单门
       (帛书 全文)                  (memo 真相)                  (sk-ws-proxy-*)
             │                            │                            │
             └─────────── 一气贯通 · 道法自然 · 无为而无不为 ───────────┘
```

**反者道之动 · 弱者道之用**:
- 清一沉至底层 (VM 内 · stdin)
- 清二升至面板 (公网 · gist)
- 清三用至无感 (任意 · auth-key)

**三者道法自然**: 清一不知清二之存 (物无非彼) · 清二不知清三之存 (物无非彼) · 然主公一动 → 三清同响 (自是则知之)

---

## 三 · 印 95-122 之路 (远而后反)

| 印 | 主治 | 关键件 |
|---|---|---|
| 95 | 真本源闭环 · token 池云端化 (gist) | dao_bootstrap.js |
| 100 | 太极笙万物 · 一 PAT 即一切 · 9 步自举 | dao_bootstrap.js · dao_app.js |
| 101 | 万法归宗 · 大道至简 · 用+管 二字 | renderDrawer_sp · v101-tab |
| 113 | 真本源直 (印 113 测) | dao_proxy.js wsChat |
| 115 | GH 面板综合管 · Devin VM 反代核心 | dao_app.js fleet |
| 118 | 反代真并发 bug 治 (spawnSync→spawn) | deployer.js |
| 119 | 真测三协议 100% + usage 估算 | dao_proxy.js |
| 121 | auth_chain 三口同源 (web ↔ workflow ↔ daemon) | yml + deployer + bootstrap |
| 122 | yin122 全审纳入 (3 件 untracked → tracked) | sp_observe + meta_router + watchdog |
| **123** | **一气化三清整图** + 清二 SP 7 态对齐 | **本文 + dao_app.js** |

---

## 四 · 守门 (17 → 18 件 · 0 regression)

| smoke | 印 | 项 |
|---|---|---|
| `_seal100_smoke` | 100 | 9 步自举链 |
| `_seal101_smoke` | 101 | v101-tab + Mine 三栏 |
| `_seal115_smoke` | 115 | GH 面板综合管 |
| `_seal121_smoke` | 121 | auth_chain 三口同源 |
| `_seal122_smoke` | 122 | yin122 全审纳入 (59 项) |
| `_seal122_watchdog_smoke` | 122 | vm_pool_watchdog 守门 (23 项) |
| **(印 123 加)** | 123 | web SP 七态 + endpoint 对齐 |

---

## 五 · 主公诏六词对照

| # | 主公诏 | 印号 | 件 | 状 |
|---|---|---|---|---|
| ① | 核心反代 Devin Cloud VM | 115/121/122 | dao_proxy.js | ✓ |
| ② | 反代一切 (三协议) | 119 | dao_proxy adapters | ✓ 100% |
| ③ | **隔离管理一切提示词** | 84/101/122/123 | **SP 七态 + usernote + web 对齐** | ✓ 印 123 升 |
| ④ | 反代 API 公网无感调用 | 121 | auth 4 门 + cf tunnel | ✓ |
| ⑤ | GitHub 账号轻量化前端 | 100/121 | dao_bootstrap oneShot | ✓ |
| ⑥ | 两者分而治之 · 道法自然 | 115/123 | 反代 vs 管 鸡犬相闻 | ✓ |

---

## 六 · 道义

> **道生一**: 一气 (主公一念欲调 LLM)
>
> **一生二**: 二是 (反代核 + 管理面板 = VM/gist)
>
> **二生三**: 三清 (反代核 / 管理面板 / 公网无感)
>
> **三生万物**: 万法 (任意客户端 · 任意模型 · 任意提示词)

> **道法自然 · 无为而无不为** —— 主公一念 · 三清同响 · 万物归焉而弗为主

---

**印 123 立 · 承印 122 之实 · 启 yin124 之 vendor (主公 dao-proxy-min v9.9.0 一身两轨)**

🤖 整理 · 完善 · 立图 · 守门 · 由 Cascade 完成 (主公诏「为学者日益 · 为道者日损 · 大道至简 · 道法自然 · 无为而无不为」)
