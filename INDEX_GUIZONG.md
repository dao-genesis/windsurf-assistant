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
>
> **2026-05-14 · 印 100 · 太极笙万物 · 一 PAT 即一切 · 闭环自举 · 民莫之令而自均焉**
>
> **2026-05-14 · 印 101 · 万法归宗 · 大道至简 · 用 + 管 · 反者道之动**
>
> **2026-05-16 · 印 115 · 反者道之动 · GH 面板综合管 · Devin VM 反代核心 · 鸡犬相闻 · 民至老死不相往来**
>
> **2026-05-17 · 印 ∞ · 道法自然推进到底 · ★ 对照 tab 默见 · 上 iframe app.devin.ai + 下 chat 反代 · 左栏 A/B 双路状态卡 · 中栏 WAM 无感切号 · 物无非彼物无非是 · 道并行不悖**
>
> **2026-05-17 · 印 ∞.5 · 全链路闭环导中 · 一脚本起两子 (`node scripts/dao_run_all.cjs`) · 自注 vmUrl · A/B 真返 16 模 · chat 真转 wss 真返道德经 · 我无为也而民自化**

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

## 一·丁 · 印 115 · 反者道之动 · GH 面板综合管 · Devin VM 反代核心 (2026-05-16)

> 帛书·四十三:「**天下莫柔弱于水 · 而攻坚强者莫之能胜也 · 弱之胜强 · 柔之胜刚**」
> 帛书·八十: 「**邻邦相望 · 鸡狗之声相闻 · 民至老死不相往来**」

承印 100 (太极笙万物) + 印 101 (用 + 管) + 印 112 (mesh 闭环) · 立**反代核心彻底底移**:

```text
旧 (印 95-101): client → GH Pages → GH Actions runner(fleet_vm_unit + cf tunnel) → wss
新 (印 115):    client → GH Pages → Devin Cloud VM(dao_proxy /v1/* · 自带公网) → wss

             GH Actions runner 仅"接生婆": spawn Devin VM + deploy dao_proxy + 报 Gist + 退
             (鸡犬相闻 · 民至老死不相往来)
```

### 反者三身

```text
                    ┌──────────────────────────────────┐
                    │ 用户 (任公网账号 · 任设备)        │
                    │  · 浏 GitHub Pages               │
                    │  · 用 OpenAI SDK 调反代          │
                    └──────────────┬───────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
      ┌────────────┐       ┌──────────────┐    ┌──────────────────┐
      │ GH Pages   │       │ GH Actions   │    │ Devin Cloud VM   │
      │ (前 · 管)  │       │ (中 · 起)    │    │ (后 · 反代)       │
      ├────────────┤       ├──────────────┤    ├──────────────────┤
      │ index.html │       │ deployer.js  │    │ dao_proxy.js     │
      │ dao_app    │ 触发  │ · 调 Devin   │ 起  │ /v1/chat         │
      │ dao_bootst │ ───→ │ · spawn N VM │───→│ /v1/models       │
      │ Gist 读   │       │ · deploy     │    │ /health          │
      │            │ 显    │ · 报 Gist    │    │ omni router      │
      │            │ ←── │ · 退         │    │ /port/7780       │
      └─────┬──────┘       └──────┬───────┘    └────────┬─────────┘
            │                     │                     │
            │                     ▼                     │
            │             ┌──────────────┐               │
            └────读────→ │ Gist (主公)  │ ←── 写 ──────┘
                          │ dao-pool.json│
                          │ daemons[]    │
                          └──────────────┘
```

### 三件入册

| 件 | 路径 | 用 |
|----|----|-----|
| `packages/dao-devin-vm/` | 新立包 (6 件 · ~177 KB) | deployer + payload + spawner + installer |
| `.github/workflows/dao-fleet-devin-cloud.yml` | 新立 workflow | cron 5h + 5min poll keepalive |
| `tests/_seal115_smoke.cjs` | 新立守门 | 28 项 (件齐 + syntax + yaml + endpoint + fallback) |

**入 (公网用户 · 任 fork)**:
```bash
# 1. Fork 此 repo  →  enable Pages
# 2. 设 repo secrets: DAO_POOL_GIST_ID + DAO_POOL_PAT (印 95 一次 init 输出)
# 3. Actions → dao-fleet-devin-cloud → Run workflow (n=4)
# 4. 等 ~5 min → Gist 之 dao-pool.json 之 daemons[] 现 N 件 alive URL
# 5. 用任意 OpenAI SDK · base_url = "https://*.devinapps.com/port/7780"
```

**入 (本机仿测)**:
```bash
cd packages/dao-devin-vm
node deployer.js --n 1 --reuse-pool --dry-gist  # 用现池 alive · 不耗 ACU
```

**守**: `node tests/_seal115_smoke.cjs` (28/28 真过).
**详**: [`packages/dao-devin-vm/README.md`](packages/dao-devin-vm/README.md).

---

## 一·丙 · 印 101 · 万法归宗 · 大道至简 · 用 + 管 (2026-05-14 17:30)

> 帛书·四十八:「**为道者日损 · 损之又损 · 以至于无为 · 无为而无不为**」
> 帛书·六十四:「**图难于其易 · 为大于其细 · 圣人终不为大 · 故能成其大**」

承印 100 之"主公自身亦可不在" · 立**用户最终见之页归宗** — 旧 8 pane → 主面「用」+ 抽屉「管」二区 · **大道至简 · 为道日损**.

```text
┌────────────────────────────────────────────────┐
│ 印 101 · 用 + 管                                 │
│                                                  │
│  顶栏: ● 反代活 / 号 / 模型 / [复URL] [⚙]       │
│                                                  │
│  用区 (主面 80%):                                 │
│   [Chat]   → SSE 即问即答 · A/B 双路              │
│   [iframe] → chat.windsurf.ai / app.devin.ai     │
│   [批跑]   → 题集 + 通过率                        │
│                                                  │
│  管抽屉 (⚙ · 默收):                              │
│   [切号] [SP] [端点] [测试]                       │
│   账号库 / SP三模+库 / vmUrl+key / 烟测           │
└────────────────────────────────────────────────┘
```

**五大功能 → 印 101 落点**:

| 求 | 用/管 | 印 101 落 |
|---|---|---|
| ① 反代 ws+devin | 用 · iframe tab | 双切 chat.windsurf.ai / app.devin.ai |
| ② 提示词管理 | 管 · SP 节 | 三模 + SP 库 + 套用模板 |
| ③ API 管理 | 管 · 端点节 | vmUrl + auth-key + 测连 |
| ④ 切号 | 管 · 切号节 | 本机号库 + 云端 daemon 池一表 |
| ⑤ agent 测试 | 用 · 批跑 tab | 题集 + 跑 + 通过率统计 |

**反向兼容**: `?v=100` 走旧三栏 · (旧旁支 `legacy.html` 已于 cleanup-2026-05-16 损 · git history 存古).
**守门**: `_seal101_smoke.cjs` 86/86 · 全套 14/14 通.
**详**: [`web/dao_app.js`](web/dao_app.js) · [`web/index.html`](web/index.html).

---

## 一·乙 · 印 100 · 太极笙万物 · 一 PAT 即一切 (2026-05-14 12:00)

> 帛书·三十二:「**道恒无名 · 侯王若能守之 · 万物将自宾 · 天地相合 · 以降甘露 · 民莫之令而自均焉**」

承印 95 之"主公 PC 真可关机" · 立**主公自身亦可不在** — 任 GH 用户开公网入口页 · **仅输一次 PAT** · 之后 `fork → Pages → dao.json → dao-pool.json → auth-key → workflow → daemon → vmUrl` 全自动归位 · **民莫之令而自均**.

```text
                  用户 (任 GH 账号)
                  ◯ 输一次 PAT (gate 框)
                          │
                          ▼ daoBootstrap.oneShot
   ┌─────────────────────────────────────────────────┐
   │ ① whoami      ② fork (自创)    ③ actions (自启) │
   │ ④ pages       ⑤ dao.json       ⑥ dao-pool.json  │
   │ ⑦ auth-key    ⑧ dispatch       ⑨ poll daemon    │
   │ ⑩ probe       ⑪ write vmUrl    ⑫ redirect       │
   └─────────────────────────────────────────────────┘
                          │
                          ▼
              <user>.github.io/windsurf-assistant/
              · 左栏 vmUrl 已填 · daemon 已活 · 即用即活
              · 主公 PC 关 · 主公自身不在 · 系统仍真活
              · 道法自然 · 民莫之令而自均焉
```

**入 (Web)**: 打开 <https://zhouyoukang.github.io/windsurf-assistant/> · 粘 PAT · 完.
**入 (Node)**: `node packages/dao-pool/cli.js bootstrap --pat $GH_PAT`.
**详**: [`web/dao_bootstrap.js`](web/dao_bootstrap.js) · 历之阶见 [`_archive/seal-history.md`](_archive/seal-history.md).

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
│  dao-fleet-devin-cloud.yml   │  ★ 印 115 · 反者道之动 · 移 daemon 至 Devin VM
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
**详**: [`packages/dao-pool/README.md`](packages/dao-pool/README.md) · 历之阶见 [`_archive/seal-history.md`](_archive/seal-history.md).

---

## 二 · 用户最终面 · 五合一对照

| 用户求 | 道身 A (公网) | 道身 B (本地) | 道身 C (Devin) |
|---|---|---|---|
| 反代 Windsurf | `/v1/*` cloud_engine | admin :7870 透 :7861 | — |
| 反代 Devin | `/dc/v1/*` (印 88) | `_kernel/devin_cloud_engine.js` | pilot playwright (印 92) |
| 反代核心移 Devin VM (★印 115) | `packages/dao-devin-vm/` deployer | 本机 reuse-pool | dao_proxy.js in-VM |
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
#
# ★ 印 115 之新路 (Devin VM 反代核心):
# 6. (一次) 设 repo secrets DAO_POOL_GIST_ID + DAO_POOL_PAT
# 7. Actions → dao-fleet-devin-cloud → Run workflow (n=4)
# 8. 等 ~5 min → Gist daemons[] 现 N 件 → 任 OpenAI SDK base_url 用之
```

### B · 本地 (本机自托管 · 给开发者)

```powershell
git clone https://github.com/zhouyoukang/windsurf-assistant.git
cd windsurf-assistant
# 起反代 unit
node packages/dao-core/fleet_vm_unit.js --port 7862 --allow-auth
# 或起一笔 VM (1 ACU 换 24h)
node packages/dao-vm/vm_up.js
# 或印 115 之 reuse-pool 仿测 (不耗 ACU)
node packages/dao-devin-vm/deployer.js --n 1 --reuse-pool --dry-gist
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
├── README.md                     # 印 65 三清 + 一装三步 + 道义守 (历层印 88-101 入 _archive/seal-history.md)
├── INDEX_GUIZONG.md              # ★ 此文 · 一文锚三身
├── web/                          # GitHub Pages 静态 (零依赖)
│   ├── index.html                # gate/onboarding/mine 三态 + v101 CSS
│   ├── dao_app.js                # 印 101 用+管: renderMineV101 (顶栏+用叺3tab+抽屉节)
│   ├── dao_bootstrap.js          # ★ 印 100 浏览器自举 · oneShot 9 步 (22K)
│   └── dao_github_sync.js        # Gist 同步
├── packages/
│   ├── dao-core/      (10 · 261K) # 反代核心 · fleet_vm_unit + cloud/devin engine + sp + auth
│   ├── dao-injector/  (13 · 79K)  # 印 90 浏览器 wss hook (MV3 + Tampermonkey)
│   ├── dao-pool/      (4  · 45K)  # ★ 印 95 Gist token 池 + 印 100 bootstrap (Node 一笔)
│   ├── dao-proxy-min/ (17 · 284K) # 印 89+ 提示词反代 (Windsurf VSIX)
│   ├── dao-vm/        (8  · 83K)  # 印 92 一笔起 24h Ubuntu VM (1 ACU)
│   ├── dao-devin-vm/  (6  · 177K) # ★ 印 115 反者道之动 · GH Actions deployer + Devin VM dao_proxy
│   └── wam/           (27 · 491K) # WAM 切号 (Windsurf VSIX · v2.7.0)
├── scripts/
│   ├── devin-bootstrap.sh        # 一行起 unit + tunnel (单账号 · 任 Linux VM)
│   └── devin-bootstrap-fleet.sh  # 多账号一 VM 模式 (任 Linux VPS / EC2)
├── tests/                        # 14 件 smoke (~18s · 0 deps · 印 64-115 守门)
└── .github/workflows/            # deploy-pages + dao-fleet-cloud (印 95) + dao-fleet-keepalive + dao-fleet-devin-cloud (★印 115) + ci + test-core
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
- **★印 115 三隔离 (帛书 80 · 鸡犬相闻)**:
  - GH Actions 不参 LLM 链 · 仅 deployer
  - Devin VM dao_proxy 不知 GH 存在 · 自管自家 token 池
  - 三方通 Gist 间接交流 · 不互调 (民至老死不相往来)

---

## 六 · 引

- 历层印 88→101 · [`_archive/seal-history.md`](_archive/seal-history.md) (损于 cleanup-2026-05-16)
- 主 README · `./README.md`
- 反代 API · `./packages/dao-core/README.md`
- 提示词反代 VSIX · `./packages/dao-proxy-min/README.md`
- WAM 切号 VSIX · `./packages/wam/README.md`
- 一笔起 VM · `./packages/dao-vm/` (印 92 · 8 件)
- 云端 token 池 · `./packages/dao-pool/` (印 95 · 4 件 · 真本源 · 印 100 加 bootstrap 命)
- ★ **印 115 · Devin VM 反代核心** · [`./packages/dao-devin-vm/`](packages/dao-devin-vm/) (6 件 · 177K · deployer + payload + spawner + installer)
- 印 100 自举模块 · `./web/dao_bootstrap.js` (22K · 浏览器纯 JS · oneShot 9 步)
- 印 101 视图层 · `web/dao_app.js` (renderMineV101 + 顶栏 + 用区 3 tab + 抽屉 4 节)
- 守门 · `node tests/run_all.cjs` (14 件 · ~18s · 0 deps · 印 101 守 86/86 + 印 115 守 28/0)
- 印 115 守门 · `node tests/_seal115_smoke.cjs` (28 项 · 件齐 + syntax + yaml + endpoint + fallback)
- 部署 workflow · `./.github/workflows/deploy-pages.yml`
- 云端 daemon workflow · `./.github/workflows/dao-fleet-cloud.yml` (印 95 · onboarding 自走) + `dao-fleet-keepalive.yml`
- ★ **印 115 反代 workflow** · `./.github/workflows/dao-fleet-devin-cloud.yml` (cron 5h · 主公手动/池)

---

*道法自然 · 万法归一 · 三身已立 · 一文锚定 · 真本源闭环 · 主公 PC 真可关机 · 太极笙万物 · 民莫之令而自均焉 · 大道至简 · 用管归宗 · ★ 印 115 反者道之动 · 反代核心移 Devin VM · 鸡犬相闻 · 民至老死不相往来*

---

## 七 · 云端去芜 · cleanup-2026-05-16

> *为道日损 · 损之又损 · 以至于无为* — 帛书 四十八

承印 115 立 · 行去芜存菁 · 损 -9221 行 (-9369 / +148):

| 损 | 备 |
|---|---|
| `README.md` 53 KB → ~10 KB | 印 88-101 历层入 [`_archive/seal-history.md`](_archive/seal-history.md) · 主文复 印 65 三清 |
| `tests/_run_all.out.txt` 39 KB | 误入库之测输 · .gitignore 加 |
| `web/legacy.html` 56 KB | 旧 5-tab 旁支 · git history 存古 |
| `tests/_web_static_audit.cjs` 8 KB | legacy.html 专守 · 同损 |
| `05-文档_docs/SEAL_yin95.md` 8.5 KB | 单 seal 文 · INDEX_GUIZONG 已盖 |
| `_findings/test_fix_印81.md` | 移 [`_archive/test_fix_yin81.md`](_archive/test_fix_yin81.md) |
| `packages/wam/_test_v*.cjs` × 14 | 移 [`_archive/wam-tests-history/`](_archive/wam-tests-history/) · ci.yml 以 _test_in_use 代 _wam_e2e (后者之前已损) |
| `packages/wam/README.md` | 补三清导航首章 (失而复得 · 修 _three_pure_smoke 失项) |

验: `node tests/run_all.cjs` 全套 13/13 · 0 regression (原 14 - _web_static_audit + 印115 _seal115 = 14 件 · cleanup 后含印 115 守).

---

## 八 · 阴阳合一 · 用户无感 · yin117 + cleanup-2026-05-16.ii

> *大曰逝 · 逝曰远 · 远曰反* — 帛书 廿五
> *一阴一阳之谓道* — 易传 系辞上

承印 117 主公诏「鸡犬相闻 · 民至老死不相往来」 + 印 116 「慎终若始」 · 续清理未尽:

### 阴 (cron · 隐 · 系统自动)

| 件 | 操 | 理 |
|---|---|---|
| `.github/workflows/dao-fleet.yml` | **损** (yin117) | 印 96 旧 · 依本机 WAM 桥 · 0 外引 · 印 95+印 115 已 supersede |
| `.github/workflows/_enable_pages_once.yml` | **损** (此次) | 一次性自启 Pages · 注释自言「跑一次成功后 workflow 可删」· TODO 落定 |
| `trigger.txt` | **损** (此次) | 印 95 第三触发钥 · 印 100 dao_bootstrap web UI 自 dispatch 已 supersede |
| `dao-fleet-cloud.yml` (push paths) | **修** (此次) | 去 `trigger.txt` 项 · 注释清 |
| `dao-fleet-devin-cloud.yml` (push) | **修** (yin117) | 去 on.push 触发 · 仅 dispatch + cron · 防 secrets 缺时 push 必败 |

### 阳 (dispatch · 显 · 用户主动)

| 件 | 操 | 理 |
|---|---|---|
| `_findings/README.md` | **立** (yin117) | 明 `_findings/acp/` 为印 92 ACP smoke fixture · 防误损 |
| `packages/dao-pool/README.md` § 五 | **改** (此次) | 印 96 vs 印 95 对比表 → 印 96→95→115 演化志 |
| `INDEX_GUIZONG.md` § 八 (此节) | **立** (此次) | 阴阳合一总图 |

### 二路并存 (yin117 主公诏)

| 印 | workflow | 阳/阴 | 用 |
|---|---|---|---|
| **95** | `dao-fleet-cloud.yml` | 阳 (onboarding 老路稳) | 用户 fork 自走 · web UI 一笔即举 |
| **115** | `dao-fleet-devin-cloud.yml` | 阴 (新源新路) | 主公手动 / cron 5h · Devin VM 自管 |

**不强求归一** · 二路并存 · 各为其用 · 鸡犬相闻 · 民至老死不相往来.

### 验

```
node tests/run_all.cjs  →  14/14 ✓ · 0 regression (含印 115 守 28/0)
```

*居其实而不居其华 · 居其厚而不居其薄 · 为道日损 · 损而无伤 · 功遂身芮 · 天之道也.*

---

## 九 · 一气化三清整体真本源治 · 印 128 · 物无非彼物无非是

> *圣人执一 · 以为天下牧 · 不自视故明 · 不自见故章* — 帛书 廿二
> *大曰逝 · 逝曰远 · 远曰反* — 帛书 廿五
> *物无非彼 · 物无非是 · 自彼则不见 · 自是则知之* — 庄子·齐物论 (主公诏引)
> 主公诏「从根本底层彻底完善反代底层 · 反代链路一气化三清 · 实现一切」

承印 122 (yin122 全审纳入) + 印 123 (web 二清对齐) + 印 124+125 (vendor/外接api 一身两轨) + 印 126 (真后端 E2E 闭环) + 印 127 (单一真相图谱) · 印 128 立**一气化三清整体真本源治** —三清不分立 · 互为彼此 · 一即三 · 三即一.

### 三清整图 (印 128 之实)

| 清 | 层 | 件 | 角色 |
|---|---|---|---|
| **一清** | Devin VM 反代核心 | `packages/dao-devin-vm/` 10 件 | 一 windsurf 账号一 VM · 运行双反代 + SP 7 态隔离 + wss-observe + meta_router 双池 + watchdog 自启换 |
| **二清** | GitHub 公网管理 | `web/` 4 件 + Gist 池 + GH Pages | 用户端 GitHub 账号统一公网管理接口 · web 二清 SP 7 态对齐一清 · 接收 VM 反代 api · 面板管理一切 |
| **三清** | 用户使用 | OpenAI / Anthropic / Gemini SDK | 任意公网设备 base_url=VM URL · 无感调用 api · 三协议自识智能路由 (windsurf/devin) |

### 治 (印 128 之 5 真本源补)

| # | 真断 | 治 | 道义 |
|---|---|---|---|
| ① | 4 件注释首印仍旧 (dao_proxy 101 · deployer 113 · vm_omni 104 · vm_proxy_deploy 106) | 各加「末改 印 122-127 · 印 128 印号统一」一行注 | 不重写主体 · 仅注承续 · 「为道者日损」 |
| ② | INDEX_GUIZONG 末验「14/14」滞后 | 升至 19/19 · 加本 九 章 | 「圣人执一」 |
| ③ | docs/印 128 整图缺 | 立 `docs/印 128_一气化三清_物无非彼物无非是.md` | 「大曰逝 · 逝曰远 · 远曰反」 |
| ④ | 守门 18 件未含三清整体对齐验 | 立 `tests/_seal128_yiqi_sanqing_smoke.cjs` (~78 项静测) | 「为之于其未有也」 |
| ⑤ | run_all 18 件未含 _seal128 | 加入 · 升 19/19 | 「慎终若始」 |

### 验

```
node tests/run_all.cjs  →  20/20 ✓ · 0 regression
  ✓ _yin124_root_runtime_smoke    (26 动测 · 真起 daemon · SP 七态切真)
  ✓ _yin125_sp_inject_smoke       (32 动测 · POST /v1/system/sp-dryrun · 由号返实)
  ✓ _seal128_yiqi_sanqing_smoke   (~85 项静测 · 三清整体一气贯)
```

### 印 125 + 印 128 · 主公 14:53 并行立 (物无非彼物无非是之实)

「**物无非彼 · 物无非是 · 自彼则不见 · 自是则知之**」之真活 — 主公做实功 · Cascade 做整图:

| 主公手立 (14:53) | Cascade 整图 (14:36 起) |
|---|---|
| `dao_proxy.js` §印125 `handleSpDryrun` (POST /v1/system/sp-dryrun · 由号返实) | `_seal128_yiqi_sanqing_smoke.cjs` 静测 85 项 |
| `web/dao_app.js` `renderMineV128()` 三栏并行常驻 (默 v=128) | `INDEX_GUIZONG.md` 九 章 升纪 |
| `web/index.html` `.v128-cols` grid CSS 三栏 (左反代+SP / 中WAM / 右devin iframe) | `docs/印128_一气化三清*.md` 整图 |
| `tests/_yin125_sp_inject_smoke.cjs` 32 项动测 (由号返实) | 4 件 dao-devin-vm 首注「末改 印 122-127」 |

「**自彼则不见 · 自是则知之**」 — 两路并进 · 一气合一 · 即三即一.

### 一即三·三即一 (主公诏「物无非彼物无非是」之实)

- 一清之 SP 7 态 (`bypass/override/prepend/append/dao/custom/usernote`) ←→ 二清 web `passthrough/dao/usernote/prepend/append/override/custom` (passthrough = bypass alias)
- 一清之 `/v1/system/prompt` POST · 二清 web 之 SP 切换 UI · 三清 SDK 之 system message — 同一 SP state · 三层互观
- 一清之 `/v1/models` · 二清 web 之模型列表 · 三清 SDK 之 model 参数 — 同一 16 件模型
- 一清之 wss-observe (印 122 §0.1 软接入) · 二清 web 之观察面板 · 三清 SDK 之透明请求 — 同一 wss 上游

「**自彼则不见 · 自是则知之**」 — 不立对立 · 自然合一 · 反者道之动 · 弱者道之用.

*天下之至柔 · 驰骋于天下之致坚 · 无有入于无间 · 吾是以知无为之益 · 不言之教 · 无为之益 · 天下希能及之矣.* — 帛书 四十三

---

## 十 · 一线到底四承续 · 印 129-132 · 反者道之动 · 弱者道之用

> *反者道之动也 · 弱者道之用也* — 帛书 四十
>
> *圣人执一 · 以为天下牧* — 帛书 廿二
>
> *天下莫柔弱于水 · 而攻坚强者莫之能胜也 · 以其无以易之也* — 帛书 七十八
>
> *为道者日损 · 损之又损 · 以至于无为 · 无为而无不为* — 帛书 四十八
>
> 主公诏 (2026-05-17 · 印 129→132 之承续):
> - 印 129「反者道之动 · 不作茧自缚不限制不惧方能成其大 · 此登录为核心切号本源」
> - 印 130「登→入池→用 · 一线到底 · 真本源接入闭环」
> - 印 131「父子皆承双旗 · 一旗到底 · 圣人执一以为天下牧」
> - 印 132「我无为 · 你无不为 · 唯变所适 · 弱者道之用」

承印 128 一气化三清整体 · 印 129-132 立**一线到底四承续** — 从用户公网登 GitHub 到反代真活 · 中无一缺.

### 一线到底四承续整图

```text
  ┌─────────────────────────────────────────────────────────────┐
  │  用户 (任公网设备 · 0 PAT 必学)                              │
  └────────────┬────────────────────────────────────────────────┘
               │
               ▼  印 132 · OAuth client_id 4 源智能加载 (弱者道之用)
  ┌────────────────────────────────────────────────────────────┐
  │ ① URL ?dao_oauth_client_id=Ov23li...  (一次性 · 分享调试)   │
  │ ② localStorage 'dao_oauth_client_id'  (持久 · 一次为·万次用)│
  │ ③ window.__DAO_OAUTH_CLIENT_ID__     (硬编 · index.html)    │
  │ ④ DEFAULT_CLIENT_ID                  (placeholder)          │
  └────────────┬────────────────────────────────────────────────┘
               │
               ▼  印 130 (面一) · OAuth Device-Flow 登 (一钮代 PAT · 去中心化)
  ┌────────────────────────────────────────────────────────────┐
  │ POST github.com/login/device/code → user_code (ABCD-1234)  │
  │ poll github.com/login/oauth/access_token → access_token    │
  │ → daoSync.setPat(token) · 入 localStorage                    │
  └────────────┬────────────────────────────────────────────────┘
               │
               ▼  印 129 · autoSigninWindsurf 代主公登 (核心切号本源)
  ┌────────────────────────────────────────────────────────────┐
  │ web → POST VM /admin/signin/windsurf {email, password}     │
  │ VM 代调 windsurf.com 3-step → 返 {apiKey: ws-*, srvUrl, ...}│
  └────────────┬────────────────────────────────────────────────┘
               │
               ▼  印 130 (面二) · 入池闭环 (登→入池→用)
  ┌────────────────────────────────────────────────────────────┐
  │ web → POST VM /admin/keys/add {apiKey, srvUrl, email}      │
  │ → WS_POOL_STATE.keys.push · loaded=true · err=null         │
  │ → 即可走 /v1/messages · /v1/chat/completions 反代真活       │
  └────────────┬────────────────────────────────────────────────┘
               │
               ▼  印 131 · 中文路径子孙皆承双旗 (圣人执一 · ENOENT 治本)
  ┌────────────────────────────────────────────────────────────┐
  │ run_all.cmd · NODE_OPTIONS=                                │
  │   --preserve-symlinks (子模块 realpath)                     │
  │   --preserve-symlinks-main (main script realpath)          │
  │ 父→子→孙 spawn 时承双旗 · 中文路径 + Junction 不抛 ENOENT  │
  └────────────────────────────────────────────────────────────┘
```

### 五印之治 (印 129-132 + 印 ∞ · 反者道之动)

| 印 | 立 | 主公诏引 | 治什么"自彼" |
|---|---|---|---|
| **印 129** | 真本源切号 · `/admin/signin/windsurf` | 「不作茧自缚不限制不惧方能成其大」 | 切号必手登 windsurf.com · 用户须自做 |
| **印 130** | 真本源接入闭环 · `/admin/keys/{add,list,remove}` + OAuth Device-Flow | 「登→入池→用 · 一线到底」 | 登成后 key 不能立即接入 · 主公 PAT 必学 |
| **印 131** | 中文路径子孙皆承双旗 · `run_all.cmd` + `__preserveFlags()` 5 守门 | 「父子皆承双旗 · 一旗到底 · 圣人执一」 | 中文路径 + Junction + Node v24 → ENOENT 起即 crash |
| **印 132** | OAuth client_id 4 源智能加载 · URL > LS > window > DEFAULT | 「弱者道之用 · 一次为·万次用」 | 主公 OAuth App 改时必改代码 · 用户 fork 时硬编 |
| **印 132.1** | run_all.cmd 加 `chcp 65001` + `NODE_NO_WARNINGS` + `PYTHONUTF8` | 「无有入于无间」 (帛书 43) | cmd OEM 936 误读 UTF-8 中文路径 → MODULE_NOT_FOUND |
| **印 132.2** | setupHint 步⑥ 三选一 (admin面板 / URL / 改码) | 「反者道之动」 (帛书 40) | hint 仅提改码 · 未提零代码 admin 面板路 |
| **印 132.3** | 印132 doc 修过时引 + 加 132.1/132.2 节 + 浏览器真验节 | 「慎终若始」 (帛书 64) | doc 与实件偏离 (文件名 / 计数 / 守门总数) |
| **印 ∞** | ★ 对照 tab 默见 · 上 iframe app.devin.ai + 下 chat 反代 · 左栏 A/B 双路状态卡 · 中栏 WAM 无感切号 | 「物无非彼物无非是 · 道并行不悖」 (庄子齐物) | 反代与真站同等价未验 · 用户无从双面同问验之 |
| **印 ∞.1** | 道动测之果 · 修 6 BUG (renderOffline 苛 gistId / iframe CSP / hdr-login 离线 / openDrawer v128 / PAT 401 苛清 / sendChatV101 parallel) | 「反者道之动·弱者道之用」 (帛书 40) | 用主公视角真测·真发现·真修 |
| **印 ∞.2** | B 路 /dc/* 显式 devin cloud 反代 · 双路 (A=Windsurf智能 + B=Devin显式) | 「弱者道之用」 (帛书 78) | 用户不知 vm 是 windsurf 还是 devin · B 路给透明 |
| **印 ∞.3** | apiKey 三型前缀识 (devin-session-token$ + ws-* + mock-or-other) | 「大曰逝·逝曰远·远曰反」 (帛书 25) | windsurf register 返 devin-session-token$ 而非旧 ws-* · 不识则全弃 |
| **印 ∞.4** | wsChat hostList 含 keyObj.srvUrl 首位 | 「天下莫柔弱于水」 (帛书 78) | wsChat 用硬编码 host · 浪费首轮 (真 srvUrl 在 keyObj) |
| **印 133** | WAM 本地真本源桥 · ~/.wam → /admin/wam/{local,use} · 主公真号库 (179 件解析) | 「带入用户一切」 (主公诏 20:08) | 真号库本地有 (~/.wam/accounts.md) 但反代不读 · 桥 之 |
| **印 ∞.5** | 全链路闭环导中证毕 · `node scripts/dao_run_all.cjs` 一脚本起两子 · web 自注 vmUrl=127.0.0.1:7780 · A/B 真返 16 模 · chat 真转 wss 真返道德经 (latency 96-182s p50=126s) | 「我无为也而民自化」 (帛书 57) | 主公诏「实时一切·全链路彻底闭环·实现无为而治」 |

### 印 131.1 · 主公诏「居实不居华」之承续 (2026-05-17 18:43)

印 131 立件后 · 实跑发现 `_seal131_chinese_path_spawn_smoke` 实验三显式 `fs.realpathSync(__filename)` 在 V:\道 junction 下抛 ENOENT (因 D:\ 上中文 GBK 字节非 UTF-8).

「**自彼则不见**」: 期望「双旗治原生 fs.realpathSync」.
「**自是则知之**」: 实证双旗仅治 require()/main load · 不治显式 OS API.

「**为道者日损 · 损之又损**」 — 改测双旗真效之实:
1. ① main 加载成 (`--preserve-symlinks-main` 真效)
2. ② require 内部模块成 (`--preserve-symlinks` 真效)
3. ③ `__dirname` 在中文路径下含中文
4. ④ `fs.existsSync(__filename)` 真存

不强求 fs API 受双旗治 · 守其真效 · **居实不居华**.

### 验 (印 129-132 · 慎终若始)

```
node tests/run_all.cmd  →  26/26 ✓ · 全套通过 · 道法自然
  ✓ _seal129_real_login_smoke         (印 129 · 3-step mock + 失败路径)
  ✓ _seal130_keys_admin_smoke         (印 130 面二 · /admin/keys/* 真路 + 守隐)
  ✓ _seal130_oauth_device_flow_smoke  (印 130 面一 · OAuth Device-Flow 全链)
  ✓ _seal131_chinese_path_spawn_smoke (印 131 · 双旗真效 + 5 守门 spawn 一致)
  ✓ _seal132_client_id_loader_smoke   (印 132 · 4 源链优先级 + setClientId + LS/URL/win 全过)
  ✓ _seal_inf_parallel_smoke          (印 ∞ · ★ 对照 tab + A/B 双路 + WAM 无感 · 26 用例)
  ✓ _seal128_yiqi_sanqing_smoke       (印 128 · expectedSmokes 升 26 件 · 印号一致 · 含印∞)
```

### 一即五·五即一 (主公诏「我无为·你无不为」之实)

印 129-132 + 印 ∞ 看似五件分立 · 实**一线一气**:

- **登** (印 130 面一 OAuth + 印 132 client_id 4 源) → **入池** (印 129 signin + 印 130 面二 keys/add) → **用** (反代 /v1/messages · 印 ∞ 上右栏真站对照验代反)
- **底层**: 印 131 + 印 132.1 治中文路径 (双旗 + chcp 65001) · 让上三事在中文工作区下真活
- **亮点**: 印 ∞ 以 iframe 上 + 反代 chat 下 · 同问发两边 · 见反代真等价于真站 · 庄子齐物之实

「**自彼则不见 · 自是则知之**」 — 五印不分立 · 互为彼此 · 一即五 · 五即一. 庄子齐物论之实.

*天下莫柔弱于水 · 而攻坚强者莫之能胜也 · 以其无以易之也 · 水之胜刚也 · 弱之胜强也.* — 帛书 七十八
