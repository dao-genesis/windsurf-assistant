# WAM Bundle · v2.1.0

> 水善, 利万物而有静, 居众之所恶, 故几于道矣。 —— 帛书《老子》道经

Windsurf multi-account manager — deployment bundle.
Single file `extension.js`, zero dependencies, works everywhere.

---

## Features

- **Auto-rotate** — monitors active account quota (daily/weekly %), switches to best available when exhausted
- **Predictive pre-warming** — pre-selects next candidate before quota hits zero
- **Time rotation** — optional `rotatePeriodMs` for stealth periodic switching
- **Drought mode** — all weekly quotas exhausted → daily-only fallback
- **Claude gate** — detect Claude model availability per account
- **3-path injection** — IDE internal API → clipboard → hijack (failover chain)
- **Webview panel** — sidebar + editor panel with live quota bars, domain badges
- **Batch verify** — parallel account verification with rate-limiting
- **Invisible mode** — `wam.invisible: true` for zero-UI stealth
- **Zero config** — works out of the box with `onStartupFinished`

---

## Install

**Option A — Copy to extensions dir:**
```
cp -r wam-bundle/ ~/.windsurf/extensions/rt-flow-2.1.0/
```

**Option B — Build VSIX:**
```bash
cd wam-bundle
npx @vscode/vsce package    # → rt-flow-2.1.0.vsix
```
Then `Ctrl+Shift+P` → `Extensions: Install from VSIX...`

---

## Account File

Put accounts in `~/.wam/accounts.md` (one per line):

```
user@example.com password123
user2@shop.com----password456
user3@gmail.com:password789
user4@outlook.com|password000
```

Multiple separators supported: space, `----`, tab, `:`, `|`

---

## Configuration

All settings under `wam.*`:

| Setting | Default | Description |
|---|---|---|
| `wam.autoRotate` | `true` | Enable auto-switching |
| `wam.invisible` | `false` | Stealth mode — minimal status bar + zero toast |
| `wam.autoSwitchThreshold` | `5` | Switch when daily or weekly < N% |
| `wam.rotatePeriodMs` | `0` | Time rotation (ms, 0=off). Suggest 10800000 (3h) |
| `wam.scanIntervalMs` | `60000` | Quota scan interval (ms, min 30s) |
| `wam.verify.parallel` | `3` | Batch verify parallelism (1-8) |
| `wam.predictiveThreshold` | `25` | Pre-select next candidate below this % |
| `wam.switchCooldownMs` | `15000` | Min interval between auto-switches (ms) |
| `wam.waitResetHours` | `3` | Wait for reset when within N hours |
| `wam.accountsFile` | `""` | Account file (empty = auto-detect) |
| `wam.notifyLevel` | `notify` | silent / notify / verbose |
| `wam.startupDelayMs` | `3500` | Delay before first auto-login (ms) |

---

## Architecture

```
extension.js      — single file, zero dependencies (~106KB)
_test_harness.cjs — offline test suite (24 cases, mocks vscode API)
package.json      — VSCode extension manifest (neutral naming: rt-flow)
```

| Component | Role |
|---|---|
| `Store` | Account pool + health state + persistence (`~/.wam/wam-state.json`) |
| `Engine` | Auto-rotation loop, exhaust/time rotation, health checks |
| `buildHtml` | Webview UI (domain badges, quota bars, Claude gate, drought banner) |
| `verifyAllAccounts` | Parallel batch verify with configurable gap/parallelism |
| `loginAccount` | Devin 3-step: login → postAuth → registerUser → inject |
| `injectToken` | 3-path failover: IDE API (丙) → clipboard (乙) → hijack (甲) |

---

## Testing

```bash
node _test_harness.cjs           # offline (24 cases)
node _test_harness.cjs --devin   # live pipeline (needs accounts)
```

---

## Origin

This is the deployment bundle of [windsurf-assistant](https://github.com/zhouyoukang/windsurf-assistant).

Full edition with advanced features (message anchoring, token pool, proxy scanning, Firebase auth, auto-update, ExtHost sentinel) lives at `packages/wam/`.

---

## License

MIT
