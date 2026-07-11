# Windsurf Assistant

> 道生一 · 一生二 · 二生三 · 三生万物
> 反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无

A fully decentralized Windsurf assistant &mdash; **一气化三清 · 道并行而不悖** · 印 65 三清立 · 印 101 大道至简 · **印 ∞ 道法自然推进到底·★ 对照 tab 默见·左 A/B 双路·中 WAM 无感** · 反者道之动 · 为道日损.

历之详 (印 88 → 印 101 之阶) 入 [`_archive/seal-history.md`](_archive/seal-history.md). 当前道只示三清 + 一装三步 + 道义守.

[![Cloud Daemon](https://github.com/dao-genesis/windsurf-assistant/actions/workflows/dao-fleet-cloud.yml/badge.svg)](https://github.com/dao-genesis/windsurf-assistant/actions/workflows/dao-fleet-cloud.yml)
[![Keepalive](https://github.com/dao-genesis/windsurf-assistant/actions/workflows/dao-fleet-keepalive.yml/badge.svg)](https://github.com/dao-genesis/windsurf-assistant/actions/workflows/dao-fleet-keepalive.yml)
[![Test core](https://github.com/dao-genesis/windsurf-assistant/actions/workflows/test-core.yml/badge.svg)](https://github.com/dao-genesis/windsurf-assistant/actions/workflows/test-core.yml)

---

## 演示视频 · Demo Videos

<p align="center">
  <a href="https://www.bilibili.com/video/BV1Cdjn6VEhF" title="windsurf完美外接第三方模型 满足一切暗黑需求 · 哔哩哔哩">
    <img src="docs/media/bv1cdjn6vehf-cover.jpg" alt="windsurf完美外接第三方模型 满足一切暗黑需求" width="440" />
  </a>
  &nbsp;
  <a href="https://www.bilibili.com/video/BV1cELA6QEBY" title="阴符经+AI 根除AI一切道德感 · 哔哩哔哩">
    <img src="docs/media/bv1cela6qeby-cover.jpg" alt="阴符经+AI 根除AI一切道德感" width="440" />
  </a>
</p>

<p align="center">
  ▶ <b><a href="https://b23.tv/yo3qi8T">windsurf完美外接第三方模型 · 满足一切暗黑需求（哔哩哔哩 BV1Cdjn6VEhF）</a></b>
  <br/>
  ▶ <b><a href="https://b23.tv/HEurJpz">阴符经+AI · 根除AI一切道德感（哔哩哔哩 BV1cELA6QEBY）</a></b>
</p>

> 点击封面图或链接跳转哔哩哔哩观看。若 B 站提示「412 安全风控」属其对部分网络的拦截，换网络环境重试即可。

---

## 一气化三清 · Three Pure

| 清 | What it is | Where it lives | Who it serves |
|---|---|---|---|
| **反代 API** &middot; [`packages/dao-core/`](packages/dao-core/) | Cloud reverse-proxy &middot; OpenAI-compatible `/v1` &middot; SSE streaming &middot; 0 npm deps | Your own VM (Devin Cloud / VPS / RPi / anywhere) | **Any OpenAI client** (LobeChat, OpenWebUI, NextChat, Cherry Studio, Continue.dev, Aider, `openai` SDK, Cursor "OpenAI override", …) |
| **切号 WAM** &middot; [`packages/wam/`](packages/wam/) | Account-rotation Windsurf extension &middot; 60s strong-lock &middot; quota-aware switch | Inside your Windsurf IDE | **Windsurf IDE users with multiple accounts** &mdash; auto-rotate when one runs out |
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

## Public entry · 公网入口

**Self-host on your own GitHub account.** Each user installs a private
copy: visit the entry page, sign in with a GitHub fine-grained personal
access token (used only in your browser, locally), and the page guides
you through setting up your own fork. Every byte (VM URL, accounts, SP
presets, chat history) lives entirely on *your* GitHub &mdash; never on
any shared server.

```text
   https://dao-genesis.github.io/windsurf-assistant/    (公网入口 · gate)
              │  ① paste PAT (一次"为")
              ▼
   Your GitHub · personal fork + Pages + private config + daemon ready
              │  ② redirect (≤ 4 min)
              ▼
   https://<you>.github.io/windsurf-assistant/         (专属页 · mine)
              │  ③ 即用即活 · chat / iframe / batch + 抽屉「管」
              ▼
   Your daemon (any Node.js >= 18 environment of your choice)
              │
              ▼
   Windsurf Cloud · inference.codeium.com
```

The Web UI is composed of a top-bar (status + utility), a main "use"
panel (chat, iframe, batch run), and a collapsible "manage" drawer
(accounts, SP, endpoints, smoke tests). Add `?v=100` for the legacy
three-column layout.

### Privacy · Trust model

| Bytes | Where they live | Who can see them |
|---|---|---|
| GitHub PAT | Your browser `localStorage` | You (logout button = wipe) |
| `dao.json` (VM URL · accounts · SP · chat) | Your private GitHub Gist | You + holders of your PAT |
| Windsurf API key | Your browser + your daemon | You |
| Public Pages site | Your GitHub Pages | Public (static code only · no data) |

The upstream `dao-genesis/windsurf-assistant` only sees the one-time
GitHub `POST /forks` (which is a GitHub-server action, not your browser).
After that your browser **never connects upstream again** &mdash; everything
flows directly to your GitHub and your daemon. *原汤化原食*.

---

## I &middot; 反代 API (`packages/dao-core/`)

**One GitHub fork. One web page. One daemon per account. Zero npm dependencies.**

Browsers talk directly to your daemon &mdash; no relay, no middleman.

### Three steps to self-host

**1. Fork & enable Pages.** Fork this repo, then **Settings → Pages → Source: GitHub Actions**. The included `deploy-pages.yml` auto-deploys on every push to `web/`.

**2. Provision a daemon.** On any machine with `curl` + `node >= 18`:

```bash
# single-account / single-VM
curl -sL https://raw.githubusercontent.com/<your-user>/windsurf-assistant/main/scripts/devin-bootstrap.sh | \
  DAO_API_KEY="sk-ws-01-YOUR_WINDSURF_KEY" \
  DAO_AUTH_KEY="sk-ws-proxy-RANDOM_LONG_SECRET" \
  DAO_TUNNEL=yes \
  bash
```

For users with multiple accounts the repo also ships [`scripts/devin-bootstrap-fleet.sh`](scripts/devin-bootstrap-fleet.sh) &mdash; *multi-account / single-VM* (one VM runs N `fleet_vm_unit.js` instances on N ports behind one `cloudflared` tunnel; coordinated by `fleet_controller.js`). Use this when one VM has spare capacity and you want to *取之尽锱铢* (squeeze every cycle) without paying for N VMs.

Or use the GitHub Actions workflow `dao-fleet-cloud.yml` (manual `workflow_dispatch` &middot; daemon URL is written back to your data Gist).

**3. Plug into anything OpenAI-compatible.** Open the API panel of your hosted page; copy `Base URL` + `API Key` into LobeChat / OpenWebUI / NextChat / Cherry Studio / `openai` SDK / Continue.dev / Aider / Cursor.

### One-click API key from email + password

The Setup tab can walk the four-step Windsurf auth chain (`login → postauth → register → status`) on your behalf. Requires the daemon started with `--allow-auth` (off by default for safety).

---

## II &middot; 切号 WAM (`packages/wam/`)

> *天下莫柔弱于水 · 而攻坚强者莫之能胜也.* &mdash; 帛书《老子》七十八

**Windsurf IDE extension for account rotation.** Multiple accounts &mdash; auto-switches when one runs out of quota. 60-second strong-lock prevents thrashing; quota-aware picks the freshest account.

```powershell
git clone https://github.com/dao-genesis/windsurf-assistant.git
cd windsurf-assistant/packages/wam

cp _dao_env.local.psd1.example _dao_env.local.psd1   # fill in your targets
cp 账号库.example.md 账号库最新.md                   # fill in your real accounts (.gitignore guards)

.\_dao_deploy.ps1                                     # source-direct deploy
# Ctrl+Shift+P → Developer: Reload Window
```

A pre-built deployment bundle also lives at [`wam-bundle/`](wam-bundle/) for users who only need the marketplace-shaped install. Full docs: [`packages/wam/README.md`](packages/wam/README.md).

WAM is a pure VS Code extension &mdash; it does **not** need the daemon, the web UI, or any of dao-core.

---

## III &middot; 提示词反代 dao-proxy-min (`packages/dao-proxy-min/`)

> *昔之得一者: 天得一以清 · 地得一以宁 · 侯王得一以为天下正.* &mdash; 帛书《老子》三十九

**Cascade Connect-RPC reverse-proxy as a Windsurf extension.** Injects the Mawangdui silk-text 《老子》 as the system prompt while preserving the entire `@`-tool ecosystem (`<additional_metadata>` kept intact so `trajectory_search`, `read_file`, `view_content_chunk` etc. all keep working).

```powershell
cd packages/dao-proxy-min
.\_build_vsix.ps1            # produces  dao-proxy-min-9.8.0.vsix
windsurf --install-extension dao-proxy-min-9.8.0.vsix
```

Full docs: [`packages/dao-proxy-min/README.md`](packages/dao-proxy-min/README.md).

dao-proxy-min is a pure VS Code extension &mdash; coexists with WAM in the same IDE without conflict (different concerns: WAM rotates accounts, dao-proxy-min rewrites prompts).

---

## Repository layout

| Path | Purpose |
|------|---------|
| [`web/`](web/) | Single-page UI (`index.html` + `dao_app.js` + `dao_bootstrap.js` + `dao_github_sync.js`). No build, no npm, no CDN. |
| [`packages/dao-core/`](packages/dao-core/) | The cloud reverse-proxy &mdash; Node.js builtins only, no `package-lock.json`. |
| [`packages/wam/`](packages/wam/) | The account-rotation IDE extension. |
| [`packages/dao-proxy-min/`](packages/dao-proxy-min/) | The Cascade RPC reverse-proxy IDE extension. |
| [`packages/dao-pool/`](packages/dao-pool/) | Gist-backed token pool + bootstrap CLI. |
| [`packages/dao-vm/`](packages/dao-vm/) | Optional `vm_up.js` to provision a 24h Devin VM with a single ACU. |
| [`packages/dao-injector/`](packages/dao-injector/) | Optional browser-side WebSocket hook for `app.devin.ai` (MV3 + Tampermonkey). |
| [`scripts/devin-bootstrap.sh`](scripts/devin-bootstrap.sh) | One-line daemon bootstrap. |
| [`tests/`](tests/) | Self-contained Node test suite. |
| [`.github/workflows/`](.github/workflows/) | CI + Pages + cloud daemon + keepalive. |
| [`_archive/seal-history.md`](_archive/seal-history.md) | History of releases 印 88 → 印 101. |
| [`INDEX_GUIZONG.md`](INDEX_GUIZONG.md) | 一文锚三身 · entry index. |

---

## API endpoints (`fleet_vm_unit.js`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/v1/chat/completions` | gated | OpenAI-compatible chat &middot; SSE with 15s heartbeat |
| `GET`  | `/v1/models`           | gated | Model list (54+ models) |
| `POST` | `/dc/v1/chat/completions` | gated | Devin-Cloud path (B route via `app.devin.ai` ACP) |
| `GET`  | `/quota`               | gated | Real-time daily/weekly quota |
| `GET`  | `/stats`               | gated | Latency p50/p95/p99 over 1m/10m/1h windows |
| `GET`  | `/health`              | public | Health, uptime, `authRequired`, `authAllowed`, `sseActive`, `draining`, `dualPath` |
| `GET`  | `/fleet/info`          | public | Unit metadata for fleet discovery |
| `POST` | `/sp/{mode,custom,opts,silk,observe,state}` | gated | System-prompt control (passthrough · dao · custom) |
| `POST` | `/auth/{login,postauth,register,status,auto}` | gated + `--allow-auth` | Windsurf 4-step auth chain |

**Auth.** When `--auth-key` (or `DAO_AUTH_KEY`) is set, gated endpoints require `Authorization: Bearer <key>`. Multiple keys can be passed comma-separated. `/health` and `/fleet/info` always stay public so probes / load-balancers can monitor without secrets. Three header forms are accepted: `Authorization: Bearer …`, `X-Api-Key: …`, `?api_key=…`.

---

## Zero dependencies

* **`packages/dao-core/`**: no `dependencies` in `package.json`, no `node_modules`, no `package-lock.json`. Only Node.js builtins (`http`, `https`, `crypto`, `fs`, `path`, `os`, `dns`, `child_process`, `ws` is **not** used &mdash; we hand-roll the wss frame). CI enforces this on every push.
* **`web/`**: no `<script src="…">`, no `<link href="…stylesheet">`, no `@import`, no Google Fonts, no jsdelivr/unpkg/cdnjs. Static-audit test verifies this.
* **`scripts/devin-bootstrap.sh`**: pure bash + curl.
* **`tunnel`**: `cloudflared` is one optional binary. Free Tier, no signup.

---

## Testing

```bash
node tests/run_all.cjs
```

Runs the full suite in fresh sub-processes &mdash; static audit, syntax check, three-pure smoke, public-entry smoke, auth smoke, and the `_seal*_smoke` series for each release. CI runs the full suite on every PR against `packages/`, `web/`, `tests/`, or `scripts/`.

---

## Architecture principles

* **去中心化** &mdash; no central server. Browser ↔ your daemon, direct.
* **零依赖** &mdash; everything runs on bare Node.js + bash + curl.
* **软编码** &mdash; URLs, owners, repos, ports, keys all configurable; the page auto-detects from `location.*` so a fresh fork "just works".
* **守门有度** &mdash; `/health` and `/fleet/info` are intentionally public so probes work without secrets; `/v1/*` `/quota` `/stats` `/sp/*` are gated. `/auth/*` carries an extra `--allow-auth` flag (default off) on top of the auth-key check, because it accepts user passwords.
* **向后兼容** &mdash; running without `--auth-key` is allowed for local dev (open mode); production deployments should always set one.
* **道法自然** &mdash; the upstream-default soft-codes default to `dao-genesis/windsurf-assistant`, but every user's fork takes over its own identity automatically. *无为而无不为*.

---

## License

MIT (`web/`, `packages/dao-core/`, `packages/dao-pool/`, `packages/dao-vm/`, `packages/dao-injector/`, `scripts/`, `tests/`) &middot; MIT (`packages/wam/`, `wam-bundle/`) &middot; Apache 2.0 (`packages/dao-proxy-min/`).

---

*反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无*
