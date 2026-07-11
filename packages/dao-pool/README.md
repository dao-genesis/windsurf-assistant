# dao-pool · 印 95 真本源闭环 · token 池云端化

> 帛书·四十: 「反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无」
> 帛书·廿二: 「圣人执一 · 以为天下牧」
> 帛书·二十五: 「独立而不垓 · 可以为天地母」

**主公诏 (2026-05-14):** 「重新锚定本源 · 此核心所有均运行于云端 GitHub Actions · 不依赖本地一切 · 一 GitHub 账号即一切 · 道法自然」

---

## 〇 · 此包之意

**真本源问题** (印 99 之缺):
- token 池在主公本机 `~/.wam/wam-state.json` (137 号 · 67KB)
- 主公 PC 关机 → token + bundle 链断 → daemon 死

**真本源解** (印 95):
- token 池入主公 GitHub **私 gist** (PAT gist scope · 仅. · 不需 repo)
- GH Actions 拉 gist → 立 `~/.dao/accounts.json` → 起 daemon → 报 URL 回 gist
- Web UI 用 user 自家 PAT (已存于 gate 态) 读 gist · 见 daemon URL · 一键复制

**结**: 一 GH 账号即一切. 主公 PC 真可关机.

---

## 一 · 三件 · 主公一笔起

```bash
# 〇 · 装 gh CLI (一次)
gh auth login --scopes 'gist,repo,workflow'

# ① 主公本机 · 立 gist + 推 token 池 (从 ~/.wam/wam-state.json)
cd packages/dao-pool
node cli.js init --pat $(gh auth token)

# (输出): gist id 之 → 设为 repo secret
gh secret set DAO_POOL_GIST_ID --body '<gist-id>' -R zhouyoukang/windsurf-assistant
gh secret set DAO_POOL_PAT --body $(gh auth token) -R zhouyoukang/windsurf-assistant

# ② 触发 dao-fleet-cloud workflow (主公手动一次或 cron 自起)
gh workflow run dao-fleet-cloud.yml -R zhouyoukang/windsurf-assistant

# ③ 用 (Web UI 自动显 · 或手动 curl)
node cli.js daemons --gist $DAO_POOL_GIST_ID --pat $(gh auth token)
# → 输出当前活 daemon URL
```

---

## 二 · gist schema (`dao-pool.json`)

```json
{
  "version": 1,
  "seal": "印 95 · 真本源闭环 · 一 GH 账号即一切",
  "lastSync": "2026-05-14T00:00:00Z",
  "pool": {
    "total": 137,
    "accounts": [
      {
        "email": "user1@gmail.com",
        "apiKey": "devin-session-token$JWT...",
        "type": "devin",
        "apiServerUrl": "https://server.self-serve.windsurf.com",
        "daily": 100,
        "weekly": 0,
        "lastUsedAt": null,
        "frozen": false
      }
    ]
  },
  "daemons": [
    {
      "host": "runnervmeorf1",
      "url": "https://xxxx.trycloudflare.com",
      "sessionId": "actions-25811469835",
      "daemonPort": 7862,
      "reportedAt": "2026-05-14T01:00:00Z",
      "ageSec": 60,
      "ok": true,
      "version": "0.3.0",
      "poolTotal": 137
    }
  ]
}
```

---

## 三 · CLI

```text
dao-pool · 印 95 真本源闭环 · CLI

子命:
  init       立新 gist + 从 ~/.wam/wam-state.json 推 token 池
  push       从本地 wam-state 重推 gist (主公更号后)
  pull       gist → ~/.dao/accounts.json (workflow 之入)
  report     报 daemon URL 回 gist (host + url)
  list       列 pool 摘要 + daemon 表
  find       搜主公已存 dao-pool gist
  daemons    列 daemon URL (供 web UI / curl)
  prune      清过期 daemon (默 15min)
  help       此帮

全 PAT scope: gist (一项即可)
```

### 用例

```bash
# 主公本机 (一次)
node cli.js init --pat ghp_xxx

# Workflow 内 (Actions runner)
node cli.js pull --gist abc123 --pat $DAO_POOL_PAT
# → ~/.dao/accounts.json 立 · fleet_vm_unit.js 即可起

node cli.js report --gist abc123 --pat $DAO_POOL_PAT \
  --host actions-25811469835 \
  --url https://xxxx.trycloudflare.com \
  --version 0.3.0 --pool-total 137

# 主公看现态 (任处)
node cli.js list --gist abc123 --pat ghp_xxx

# 主公看活 daemon URL (供任客)
node cli.js daemons --gist abc123 --pat ghp_xxx
# 或 JSON:
node cli.js daemons --gist abc123 --pat ghp_xxx --json
```

---

## 四 · 道义守

> 帛书·七十三:「天网恢恢 · 疏而不失」
> 帛书·六十六:「江海所以能为百谷王者 · 以其善下之」

- **一 GH 账号即一切** · gist + repo + Actions 全于一 (zhouyoukang)
- **不偷 token** · token 在主公自己 gist · 仅主公 PAT 可读
- **私 gist 默** · `init` 默 `--public=false` · 公网不见
- **PAT scope = gist** · 仅. · 不可碰 repo (除非主公另设)
- **daemon URL 回报** · 即此件之"江海"·百谷之王
- **过期清** · daemon 15min 无报即弃 · 不滥留
- **不夺主公本源** · `~/.wam/wam-state.json` 仍在主公本机 · 此包仅"读"之 (主公手动 push)
- **不强同** · 主公关机时 · gist 数据冻 · daemon 用旧 token (尚活时段) · 全死才触新 run
- **守同步律 (印 68)** · 此包入 130/_kernel + 公网/packages 双源 · sha 校

---

## 五 · 演化志 · 印 96 → 印 95 → 印 115

> *大曰逝 · 逝曰远 · 远曰反* — 帛书 廿五

| 印 | workflow | 角 | 状 |
|---|---|---|---|
| 96 | `dao-fleet.yml` | 依本机 WAM 桥 · cf tunnel 上报 daemon URL | **已损** (yin117 · 2026-05-16 · git history 存古) |
| **95** | `dao-fleet-cloud.yml` | gist 主源 · GH Actions 跑 fleet_vm_unit · 0 PC 依 (本包之路) | **活** · onboarding 自走 (用户 fork inputs 一笔自举) |
| **115** | `dao-fleet-devin-cloud.yml` | GH Actions 仅 deployer · 反代核心移 Devin VM · 鸡犬相闻 | **活** · 主公手动/cron · 真本源底层 |

**一阴一阳之谓道** (yin117 主公诏):
- **阳** · 印 95 cloud-only: 用户 fork onboarding 老路稳 · web UI 一笔即举
- **阴** · 印 115 devin-cloud: 主公手动/cron · Devin VM 自管自家 token 池 · 民至老死不相往来
- **不强求归一** · 二路并存 · 各为其用

---

## 六 · 路 1.0 (本印 95) → 路 2.0 (未来)

**1.0 (此立)**: token 池在 gist · daemon 在 Actions · cron 自续 · 主公关机活

**2.0 (未来候)**:
- gist 也用 GitHub App (取代 PAT · 更安) · GH Actions 用 OIDC 联系 (无 secret)
- daemon 入 Cloudflare Worker (永真 · 无 350min 限) · gist 仍主源
- 多 GH 账号联立 (account-of-account · 帛书·四十二「二生三」)
- token rotation 服务化 (定时刷 quota · 自冻无效号)

---

## 七 · 锚

`packages/dao-pool/`
├── `gist-pool.js`     · 本源 (lib · 零依赖 · GitHub API client + GistPool 类)
├── `cli.js`           · CLI 入口 (init / push / pull / report / list / find / daemons / prune)
├── `package.json`     · 包元
└── `README.md`        · 此文

测试: `tests/_seal95_smoke.cjs` (smoke · 无网络)

工作流: `.github/workflows/dao-fleet-cloud.yml` (印 95 · 真本源闭环之云端 fleet)

---

**立印日**: 2026-05-14 · 印 95 · 真本源闭环 · 一 GH 账号即一切

「**反者道之动 · 弱者道之用**」—— 帛书四十

主公 PC 关机 → daemon 真活 (Actions cron) → token 真新 (gist) → URL 真报 (gist) → Web UI 真见 (gist) → 任客真用 (任协议)

**一 GitHub 账号 · 即一切.**
