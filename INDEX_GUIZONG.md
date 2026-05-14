# 万法归宗 · 一文锚三身

> *道生一·一生二·二生三·三生万物.* —— 帛书《老子》四十二
>
> *为道日损·损之又损·以至于无为.* —— 四十八
>
> *道并行而不相悖.*
>
> **2026-05-13 · 印 93 · 一文尽全 · 一入即知何处用**
>
> **2026-05-14 · 印 95 · 真本源闭环 · 主公 PC 真可关机 · 一 GitHub 账号即一切**

---

## 〇 · 此文之意

`windsurf-assistant` 立印 67 至印 92 · 历**一气化五清**之程 ·
功能已全 (反代 windsurf + devin · 提示词管理 · API 管理 · WAM 切号 · agent 交互测试) ·
唯欠**一文锚之** · 新入者一目即知何处入. 此文即一.

---

## 一 · 三身一道 (一图尽全)

```text
                    ┌─────────────────────────────┐
                    │   道 · 五合一 · 万法归宗     │
                    │  反代+提示词+切号+Agent      │
                    └────────────┬────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
  ┌───────────┐            ┌───────────┐            ┌───────────┐
  │ A · 公网  │            │ B · 本地  │            │ C · Devin │
  │ this repo │            │  自托管   │            │  云原生   │
  │  Pages    │            │ admin:7870│            │ :11445/6  │
  ├───────────┤            ├───────────┤            ├───────────┤
  │ 受众:     │            │ 受众:     │            │ 受众:     │
  │  公网用户 │            │ 开发者    │            │ 主公本机  │
  │ 形:       │            │ 形:       │            │ 形:       │
  │  gate→    │            │ 左API+SP /│            │ 五职中枢+ │
  │  onb→mine │            │ 中WAM /   │            │ 太上pilot │
  │  三态     │            │ 右chat    │            │           │
  └───────────┘            └───────────┘            └───────────┘
```

**一道**: 三身共**一组 fleet_vm_unit + cloud_engine + sp_handler + dao_accounts**.
**三身**: 因受众不同各立其面 · 并行不悖.

---

## 一·甲 · 印 95 · 云端主路 (2026-05-14)

> 帛书·廿五: 「**独立而不垓 · 可以为天地母**」

承三身一道, 立**真本源闭环** — daemon 不再由主公 PC 起, **token 池**入主公**私 Gist** (替 `~/.wam/wam-state.json`), **GH Actions cron 5h** 自起 fleet_vm_unit + cf tunnel, **报 URL 回 Gist**, Web UI **pane F** 用 PAT 读 Gist 见所有活 daemon → 一笔设左栏 vmUrl.

```text
┌─────────────────────────────┐
│ 主公 GitHub 账号             │
│  Private Gist (真本源)       │  ← 替 ~/.wam (链中再无主公 PC)
│   dao-pool.json              │
└────────────┬────────────────┘
             │ PAT (gist scope)
             ▼
┌─────────────────────────────┐
│ GH Actions runner            │
│  dao-fleet-cloud.yml         │  cron 5h + dispatch + push
│  dao-fleet-keepalive.yml     │  cron 30min · 全死才触
└─────────────────────────────┘
             ▲
             │ workflow_dispatch
             │
┌─────────────────────────────┐
│ 任何 fork 之公网用户          │
│  Pane F · PAT 读 Gist 见 URL │  ← 一笔设左栏 vmUrl
└─────────────────────────────┘
```

**入**: `node packages/dao-pool/cli.js init --pat $GH_PAT --from ~/.wam/wam-state.json` → 出 Gist URL.
**详**: [`packages/dao-pool/README.md`](packages/dao-pool/README.md) · [`05-文档_docs/SEAL_yin95.md`](../../05-文档_docs/SEAL_yin95.md).

---

## 二 · 用户最终面 · 五合一对照

| 用户求 | 道身 A (公网) | 道身 B (本地) | 道身 C (Devin) |
|---|---|---|---|
| 反代 Windsurf | `/v1/*` cloud_engine | admin :7870 透 :7861 | — |
| 反代 Devin | `/dc/v1/*` (印 88) | `_kernel/devin_cloud_engine.js` | pilot playwright (印 92) |
| 提示词管理 | `/sp/*` (透/道/自定) + injector wss hook (印 90) + proxy-min VSIX | `_kernel/sp_handler.js` + 左栏 SP | `sp_manager.js` |
| 反代 API 管理 | 左栏 VM URL/auth key/测试 | 同 | — |
| WAM 切号 | `packages/wam` VSIX + 中栏账号库 | `_kernel/wam_bridge.js` + WAM iframe | 印91 §1 一键切 |
| Agent 交互 | 右栏 SSE chat (A/B 双路) | 右栏 Cascade/Devin 双模 | pilot ask/observe |
| 一笔起 24h VM | `packages/dao-vm/vm_up.js` (印 92 · 1 ACU) | — | pilot launch |

---

## 三 · 一键启 (三身各启)

### A · 公网 (从这个 repo 起 · 给公网用户)

```bash
# 1. Fork 此 repo  →  enable Pages (Settings → Pages → Source: GitHub Actions)
# 2. 进入 https://<your-user>.github.io/windsurf-assistant/
# 3. 输 PAT (gist + repo scope) → 自动 fork + Pages + Gist + 跳专属页
# 4. 复制左栏 Devin Bootstrap 命令 → 粘 Devin Chat → 得 VM URL
# 5. URL 回粘左栏 → 测试连接 → 用任意 OpenAI/Anthropic/Gemini 客户端
```

### B · 本地 (本机自托管 · 给开发者)

```powershell
git clone https://github.com/zhouyoukang/windsurf-assistant.git
cd windsurf-assistant
# 起反代 unit
node packages/dao-core/fleet_vm_unit.js --port 7862 --allow-auth
# 或起一笔 VM (1 ACU 换 24h)
node packages/dao-vm/vm_up.js
```

### C · Devin 中枢 (本机·进阶 · 与本 repo 解耦)

```powershell
# 此为独立体 · 在 ../Devin云原生/PC端/本源/
cd Devin云原生/PC端/本源
node 印91_万法归宗中枢/server.js     # :11445 · 切号/备份/git/IDE桥/健康
node 印92_太上_pilot/pilot.js        # :11446 · playwright 操 app.devin.ai
```

---

## 四 · 仓骨

```text
├── README.md                     # 印 67-92 主文 (37.7K · 一气化五清详记)
├── INDEX_GUIZONG.md              # ★ 此文 · 一文锚三身
├── web/                          # GitHub Pages 静态 (零依赖)
│   ├── index.html                # gate/onboarding/mine 三态
│   ├── dao_app.js                # 三栏: 左 API+SP / 中 WAM / 右 chat
│   ├── dao_github_sync.js        # Gist 同步
│   └── legacy.html               # 旧 5-tab
├── packages/
│   ├── dao-core/    (10 · 261K)  # 反代核心 · fleet_vm_unit + cloud/devin engine + sp + auth
│   ├── dao-injector/(13 · 79K)   # 印 90 浏览器 wss hook (MV3 + Tampermonkey)
│   ├── dao-pool/    (4  · 30K)   # ★ 印 95 Gist token 池 (真本源 · 替 ~/.wam)
│   ├── dao-proxy-min/(17 · 284K) # 印 89+ 提示词反代 (Windsurf VSIX)
│   ├── dao-vm/      (8  · 83K)   # 印 92 一笔起 24h Ubuntu VM (1 ACU)
│   └── wam/         (27 · 491K)  # WAM 切号 (Windsurf VSIX · v2.7.0)
├── scripts/
│   ├── devin-bootstrap.sh        # 一行起 unit + tunnel
│   └── devin-bootstrap-fleet.sh  # 印 96 fleet workflow
├── tests/                        # 12 件 smoke (~18s · 0 deps · 印 64-95 守门)
└── .github/workflows/            # deploy-pages + dao-fleet + dao-fleet-cloud + dao-fleet-keepalive + ci + test-core
```

---

## 五 · 道义守 (本 repo 之自律)

帛书六十三 · *为之于其未有也·治之于其未乱也*:

- **不偷 token** · apiKey 仅本机本用户
- **不绕 ACU** · 印 92 真消 1 ACU 换 24h VM
- **不破 SLA** · 不超 24h TTL · 不并发 100+ session
- **不污 Cognition telemetry**
- **不修 Windsurf/Devin 二进制** · 仅协议层注入
- **去中心化** · 用户自 fork · 自 Pages · 自 VM · 无中心 relay

---

## 六 · 引

- 主 README · `./README.md`
- 反代 API · `./packages/dao-core/README.md`
- 提示词反代 VSIX · `./packages/dao-proxy-min/README.md`
- WAM 切号 VSIX · `./packages/wam/README.md`
- 一笔起 VM · `./packages/dao-vm/` (印 92 · 8 件)
- 云端 token 池 · `./packages/dao-pool/` (印 95 · 4 件 · 真本源)
- 守门 · `node tests/run_all.cjs` (12 件 · ~18s · 0 deps)
- 部署 workflow · `./.github/workflows/deploy-pages.yml`
- 云端 daemon workflow · `./.github/workflows/dao-fleet-cloud.yml` + `dao-fleet-keepalive.yml`

---

*道法自然 · 万法归一 · 三身已立 · 一文锚定 · 真本源闭环 · 主公 PC 真可关机*
