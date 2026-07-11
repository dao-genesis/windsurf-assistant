# Changelog

## v17.42.19 · 深根固柢 · 长生久视

> 反者道之动. — 治大国若烹小鲜, 不动声色, 添两道哨兵.

### 一 · 死链自愈 (`_getAutoUpdateSource`)

**病史**: v17.42.13~17 默认源 `_DEFAULT_PUBLIC_SOURCE` 写死 `AiCodeHelper/rt-flow` (404 死仓), v17.42.18 改指 `zhouyoukang/windsurf-assistant`. 但**已显式配置过老 URL** 的用户, 即使升到 v17.42.18+ 仍卡在死链, 永远收不到新版.

**药方**: `_getAutoUpdateSource` 新增死链拦截

```js
const _DEAD_SOURCES = [/AiCodeHelper\/rt-flow/i];
function _isDeadAutoUpdateSource(src) { ... }
function _getAutoUpdateSource() {
  const userSrc = _cfg("autoUpdate.source", "");
  if (userSrc && _isDeadAutoUpdateSource(userSrc)) {
    log(`autoUpdate: 死链自愈 ${userSrc} → ${_DEFAULT_PUBLIC_SOURCE}`);  // 一次性
    return _DEFAULT_PUBLIC_SOURCE;
  }
  ...
}
```

效果: 用户配置不变, 仅运行时改写指向, 一次性日志告知.

### 二 · ExtHost 卡顿哨兵 (long-lived `setImmediate` 探针)

**起因**: 上次 LAPTOP-AKCGC7BM 远程, `_cfg` 修后 Devin 复活, 但 ExtHost 仍 unresponsive 15+min — 真凶是 workspace 含 `pom.xml` 触发 `redhat.java` 加载 JDT Language Server (2 进程 926MB), 拖死 event loop. WAM 自身能动作但用户从外部看就是"WAM 不工作了".

**药方**: WAM 自带 30s 探针 (`setImmediate` 测调度延迟), 超阈值 (默认 5s) 即记日志 + 列出活跃重型 LS 嫌疑

```js
const _HEAVY_LS_EXTENSION_IDS = ["redhat.java", "fwcd.kotlin",
  "mathiasfrohlich.Kotlin", "rust-lang.rust-analyzer",
  "ms-dotnettools.csharp", "ms-python.vscode-pylance"];
const _HEAVY_LS_EXTENSION_PREFIXES = ["vscjava.", "redhat."];
// 仅日志 · 无侵入弹窗 · 用户依据 wam.log 自决禁用
```

新增 3 配置: `wam.extHostLag.{enabled,probeIntervalMs,thresholdMs}`. 默认开启, 周期 30s, 阈值 5s. 仅日志, 不弹窗.

### 三 · 前作回顾

`_cfg` 空字符串回退 (v17.42.18) + `_DEFAULT_PUBLIC_SOURCE` 改指 (v17.42.18) 仍是 v17.42.19 基石. 本版仅添哨兵 + 自愈, 无破坏性变更.

### 四 · 实测

- E2E: 全绿 (新增 L32 三条断言)
- 不动手: 工作区无重型 LS → 哨兵静默, 0 日志, 0 性能损失
- 动手: 工作区有 redhat.java + 卡顿 → `wam.log` 立现 `extHostLag: 7234ms ... 嫌疑首报 [redhat.java]`

道法自然 · 长生久视 · 治人事天莫若啬.

---

## v17.42.18 · _cfg 空字符串回退根治 · Devin 登录复活

> 一字之差, 满盘皆死. — 损之又损, 单行可治.

### 病根 (根因 · 五层连锁)

```
L1  package.json  "wam.devin.loginUrl": { type:"string", default:"" }
L2  vscode.workspace.getConfiguration("wam").get("devin.loginUrl")  →  ""
L3  _cfg("devin.loginUrl", "https://windsurf.com/_devin-auth/password/login")
    旧: if (val === "" && typeof defaultVal !== "string") return defaultVal;
    val="" 且 default 是 string → 返回 ""  (本应回退到代码 default 真值)
L4  new URL("")  →  TypeError [ERR_INVALID_URL]: Invalid URL
L5  Devin 4 通道 (direct-auto/direct-raw/proxy/native) 全 throw "Invalid URL"
    Firebase 兜底亦 INVALID_LOGIN_CREDENTIALS · 切号弹窗死循环
```

**影响**: 全用户 (不限平台). 所有 v17.42.17 及以前用户, 凡未在 settings 显式覆盖
`wam.devin.loginUrl` (即 99% 用户) Devin 登录路径全死.

### 药方 (单行 · `_cfg`)

```diff
  function _cfg(key, defaultVal) {
    try {
      const val = vscode.workspace.getConfiguration("wam").get(key);
      if (val === undefined || val === null) return defaultVal;
-     if (val === "" && typeof defaultVal !== "string") return defaultVal;
+     // 空字符串回退: 默认非字符串 (类型不匹配) 或默认是非空字符串 (package.json 声明 default:""
+     // 但代码侧给了真值 · 此时 vscode.get 返 "" 应回到代码 default)
+     if (val === "" && (typeof defaultVal !== "string" || defaultVal !== "")) return defaultVal;
      return val;
    } catch {}
    return defaultVal;
  }
```

### 同 bug 影响的 9 个 string 配置 (一并修)

| 配置键 | package.json default | 代码侧 default |
|---|---|---|
| `wam.devin.loginUrl` | `""` | `https://windsurf.com/_devin-auth/password/login` |
| `wam.devin.postAuthUrl` | `""` | `https://windsurf.com/_backend/...WindsurfPostAuth` |
| `wam.registerUrl` | `""` | `https://windsurf.com/_backend/...RegisterUser` |
| `wam.chatCapacityUrl` | `""` | `https://server.codeium.com/.../CheckChatCapacity` |
| `wam.relayHost` | `""` | (空 = 禁用 · 此项保持空) |
| `wam.firebase.referer` | `""` | `https://windsurf.com` |
| `wam.dataDir` | `""` | (空 = 自动检测 · 此项保持空) |
| `wam.wamHotDir` | `""` | (空 = `~/.wam-hot` · 此项保持空) |
| `wam.claudeProbeModel` | `""` | `claude-sonnet-4-6` |

修后: 用户未配置 `wam.devin.loginUrl` 时, _cfg 返代码 default 真值, `new URL` 解析成功, 全 4 通道恢复.

### 配套: `_DEFAULT_PUBLIC_SOURCE` 死链复活

旧默认源 `https://cdn.jsdelivr.net/gh/AiCodeHelper/rt-flow@main/wam-bundle/`
经实测 `AiCodeHelper/rt-flow` 不存在 (404). 改指 `zhouyoukang/windsurf-assistant`
主仓 `wam-bundle/` 目录 (本版同步建立). 公网用户 `wam.autoUpdate.autoDiscover=true`
默认走 jsDelivr 取主仓 wam-bundle, 全自更新通道复活.

### 实测 (LAPTOP-AKCGC7BM 远程一台)

```
修前: _devinLogin ch[direct-auto/direct-raw/proxy]: Invalid URL  (4/4 通道全死)
       fetchQuota Devin FAIL  · pool 弹 INVALID_LOGIN_CREDENTIALS 死循环
修后: _devinLogin ch[direct-auto/direct-raw/proxy]: OK  (3 路 OK)
       fetchQuota: <email> devin-known sessionToken=devin-session-token$...
       proto L3: D100 W100 plan=Trial tier=DEVIN_TRIAL prompt=0/10000 flow=0/20000
       devin: ⚡ session cache HIT (节省 ~3000ms)
```

15 OK / 0 Invalid URL / 26 真号入池 / 0 黑名单. 全链路复活.

---

## v17.42.17 · 重新锚定本源 · 一对话一会话 · 多对话并行 · TurnTracker

> 道生一, 一生二, 二生三, 三生万物. — 《德道经·四十二》
>
> 一对话一 turn (单会话原子). 多对话各自一 turn (并行不悖). 万物负阴而抱阳, 冲气以为和.

### 用户原则 (锚点)

> **每个对话内, 给 agent 发送消息的那一刻所对应的活跃账号 = 此次 turn 所用账号.**
> **多对话并行: 用户可在不同对话各自发送, 切号已分流, 各 turn 独立跟踪生命周期.**
> **实时监测会话生命周期: 一直没结束 = 使用中. 结束 (agent 处理完毕) = 取消标记.**

### 病根 (v17.42.16 修复"独占"模型不适用多对话场景)

v17.42.16 引入 `_inUse {instId, source}` 协议把 UI 限到 "本实例最近一次 send" → 单对话语义正确, 但**多对话场景失语**:

- 用户在对话 A send (账号 a), 自动切号到 b.
- 用户在对话 B send (账号 b), 自动切号到 c.
- 此时 a 还在跑 (turn 未结束), b 也在跑 — UI 应显两条 "使用中".
- v17.42.16 模型: `getConversationInUseEmail()` 至多返单个 → b 显使用中, a 不显. **名不副实**.

更深层: v17.42.16 用 `lastChange + cooldownMs` (120s) 估算 turn 终结 → **不是真理, 是猜测**. 真正的真理是 "**agent 是否还在处理**", 由配额变化轨迹推断.

### 药方 (从根本·三刀立柱)

#### 刀一 · `TurnTracker` 内存本源 (`_turns` Map)

新增 ~190 行模块, 完整覆盖 turn 生命周期:

| 字段 | 含义 |
|---|---|
| `turnId` | 短 id `<inst>.<seq>` (如 `a1b2.7`) |
| `email` | 此 turn 关联的账号 |
| `startTs` | 起点 = `_msgAnchorTrigger` 那一刻 |
| `lastQuotaChangeTs` | 该 email 配额最近一次变化点 (monitor / scan 喂养) |
| `baselineD/W` `lastD/W` | 基线 + 最新值 (变化检测) |
| `status` | `active` \| `completed` |
| `endTs` `reason` | 终结时刻 + 原因 (`stable`\|`timeout`\|`manual`) |

12 个公开函数: `_startTurn` / `_endTurn` / `_observeTurnQuotaForEmail` / `_tickTurns` / `_pruneTurns` / `_startTurnTicker` / `_stopTurnTicker` / `_activeTurnsByEmail` / `_hasActiveTurnForEmail` / `_activeTurnCount` / `_endAllActiveTurnsForEmail` / `_getTurnSnapshot`.

#### 刀二 · 双层模型 (turn 真理 / `_inUse` 协调)

| 层 | 介质 | 作用 |
|---|---|---|
| `_turns` | 内存 (per-instance) | 真理 · UI 使用中 = 该 email 有 active turn |
| `_inUse` | 持盘 (cross-instance) | 协调 · `getBestIndex` 跳过, 现有 `{since, lastChange}` 协议不动 |

`_startTurn(email)` 内部同步 `markInUse(email)` 投影到协调层, `_endTurn` 在 "该 email 无其他 active turn" 时 `clearInUse(email)`. **多 turn 同 email 共存合法** (用户在切号前快速二次 send 同一对话).

#### 刀三 · "结束" 由配额稳定自然推断 (替代 cooldown 猜测)

`_tickTurns` (默认 1s) 检查每个 active turn:

```
age = now - startTs
idle = now - lastQuotaChangeTs
age >= maxMs (180s) → 终结 reason='timeout'  // 兜底
age >= minMs (3s) AND idle >= stableMs (8s) → 终结 reason='stable'  // 自然
```

监测引擎喂养 `_observeTurnQuotaForEmail`:
- `monitorActiveQuota`: 活跃账号每轮 (默认 3s) 抓配额 · 变化即更新 `lastQuotaChangeTs`
- `_scanOneAccount`: 非活跃账号 (含切号后旧号) 每轮 (默认 45s) 抓配额 · **关键** — 否则切号后的 turn 永远 stable 不到, 只能等 maxMs 兜底

### UI 改造

| 位置 | v17.42.15 行为 | v17.42.17 行为 |
|---|---|---|
| 状态栏 `[N占]` | `_inUse.size` | `_activeTurnCount()` (本对话真值) |
| 面板列表 `使用中(Ns)` | cooldown 倒计时 | 真实 turn 持续秒 + 多 turn 时 `×N` |
| 面板底栏 `N占` | `_inUse.size` | `N占 +M协` (本对话 + 跨实例协调) |
| QuickPick `[使用中]` | 任一 `_inUse` | `[使用中×N]` 本对话 / `[协调]` 跨实例 |
| `wam.status` 命令 | `inUseEmails` 一锅端 | 分两行: 本对话(N): turnId/age, 协调: emails |

### 配置 (6 项 `wam.turn.*` · 软编码)

```jsonc
"wam.turn.enabled":            true,    // 总开关 (false → 回退 v17.42.15 行为)
"wam.turn.stableMs":           8000,    // 配额稳定多久视为 agent 处理完
"wam.turn.minMs":              3000,    // 最少持续 (防 send 后立即误判)
"wam.turn.maxMs":              180000,  // 最长持续 (兜底防永挂)
"wam.turn.tickIntervalMs":     1000,    // ticker 周期
"wam.turn.retainCompletedMs":  60000    // completed turn 保留多久 (供查询)
```

### 受影响文件

- `extension.js` ~190 行新增 (TurnTracker 模块) + ~80 行改写 (msgAnchor / monitor / scan / engines / AccountStore / UI / wam.status)
- `package.json` +6 turn 配置项 + 版本 17.42.15 → 17.42.17
- `_wam_e2e.js` L31 层重写为 v17.42.17 turn 生命周期断言 (TurnTracker 模块 / 12 核心函数 / 6 配置 / 引擎生命周期 / UI / package.json) · 480 assert ALL GREEN

### 兼容性

- `wam.turn.enabled=false` 时 `_startTurn` no-op · `isInUseByThisConversation` 永返 false · 完全回退 v17.42.15 行为 (含独占模型缺陷)
- `_inUse` 持盘协议 `{since, lastChange}` 不动 → 跨实例混版部署兼容
- 历史 `_loadInUse` / `_persistInUse` 路径无改动

---

## v17.42.16 · 一刻一账号 · 名正而实归 · 使用中识别到切号全链路根治

> 名可名, 非常名. 无, 名天地之始; 有, 名万物之母. — 《德道经·一》
>
> 道生一, 一生二. 一对话, 一账号. 发送消息的那一刻所对应的账号 = 此对话所用账号.

### 用户原则 (根本定义)

> **任何对话中给 agent 发消息的那一刻所对应的账号为此对话所用账号.**
> **一个问答结束后等待下一次对话发送也取决于发送消息的那一刻所登录的账号.**

翻译到代码不变量: **本实例任一时刻 "使用中" ≤ 1 个** — 即最近一次 `_msgAnchorTrigger` 时的 `activeIndex`, 且仍为活跃 (未被切走).

### 病根 (实地证据 · 现场图示 9 号同显"使用中")

截图: 面板头部 `占=9`, 列表里 `使用中(17s/80s/80s/103s/95s/95s/14s/56s)` 九行并存 —
道家语: **名不副实, 混而不分**.

三条混流把 `_inUse` Map 灌成"八仙过海":

| # | 源 | 行为 | 后果 |
|---|---|---|---|
| 1 | `_msgAnchorTrigger` @`extension.js:664` | 每次 send 标当前 active, 从不清旧 | 切号后旧号继续显"使用中" cooldown 120s |
| 2 | `scanBackgroundQuota` @`extension.js:8353` | **非活跃号**波动也标, 无源区分 | 跨实例/外部活动污染本实例 UI |
| 3 | `_loadInUse` @`extension.js:1508-1532` | 盘上数据直灌同一 Map | 他实例发送号在本实例显"使用中" |

现场后果: UI "占" = `_inUse.size` = 9, 用户不知何号真正为"本对话所用".

### 药方 (从根本·五刀正名)

#### 刀一 · 记录升级 `{instId, source}`

`AccountStore._inUse` 从 `{since, lastChange}` → `{since, lastChange, instId, source}`:

- `source: 'send'` 本实例对话在用 (msgAnchor / monitor 活跃号波动) · **UI 显示**
- `source: 'quotaChange'` scan 嗅到非活跃号波动 (他实例/外部) · UI 不显
- `source: 'remote'` `_loadInUse` 合入他实例 send 标 · UI 不显
- `instId` = 标记源实例 (=_instanceId 即本实例)

#### 刀二 · `markInUseByConversation` 独占语义

新 API `markInUseByConversation(email)` 每次调用 **先清本实例其他 send 标**:

```js
if (src === "send") {
  for (const [k, v] of this._inUse) {
    if (k !== key && v.source === "send" && v.instId === _instanceId) {
      this._inUse.delete(k); // 一刻一账号 · 独占
    }
  }
}
```

不变量: `全表中 source==='send' && instId===_instanceId 的记录数 ≤ 1`.

#### 刀三 · 调用点正名

- `_msgAnchorTrigger` → `markInUseByConversation` (@`extension.js:664`)
- `monitorActiveQuota` 活跃号波动 → `markInUseByConversation` (@`extension.js:8072`)
- `scanBackgroundQuota` 非活跃号波动 → `markInUse(email, 'quotaChange')` (@`extension.js:8449`)

#### 刀四 · 切号成功即清 send 标

`_afterSwitchSuccess` 新增第 7 不变量:

```js
_store.clearLocalConversationMarks(); // 上一对话已毕 · 新号待下一次 send
```

→ 切号后 UI 立即净化: 旧号不再"使用中", 新号也不 (道法自然 · 活跃而不在用, 待触发).

#### 刀五 · UI 严查本对话 + `_loadInUse` 三分

- `buildHtml` 行渲染用 `isInUseByThisConversation` (严查 `source==='send' && instId===_instanceId`)
- 状态栏 `inUseCount` 同查本实例 send · 严格 ≤ 1
- 面板尾部 `N占` = 本对话 + 新增 `N协` = 跨实例/scan 协调池 (带 tooltip)
- `wam.status` 命令分显: `本对话: xxx` + `协调: yyy[source]`
- QuickPick: `[本对话]` vs `[协调]` 两种标签
- `_loadInUse` 三分入盘:
  - 本实例 send 标 → 不被覆盖 (本对话独享真理)
  - 他实例 send 标 → 降 `remote` (仅协调跳过 · UI 不显)
  - `quotaChange`/legacy → 原样合并

### 改动 (大制不割 · 八处归一)

| 位置 | 改动 | 行数 |
|------|------|------|
| `@extension.js:2093-2100` | `_inUse` 字段注释升级 | +8 |
| `@extension.js:3117-3236` | `markInUse(email,source)` + `markInUseByConversation` + `clearLocalConversationMarks` + `isInUseByThisConversation` + `getConversationInUseEmail` | +90 |
| `@extension.js:664` | `_msgAnchorTrigger` → `markInUseByConversation` | ~1 |
| `@extension.js:8072` | `monitorActiveQuota` → `markInUseByConversation` | ~1 |
| `@extension.js:8449` | `scanBackgroundQuota` → `markInUse(email,'quotaChange')` | ~2 |
| `@extension.js:1508-1559` | `_loadInUse` 三分入盘 (本实例 send 护本 · 他实例 send 降 remote) | +25 |
| `@extension.js:7945-7946` | `_afterSwitchSuccess` 调 `clearLocalConversationMarks` (第 7 不变量) | +3 |
| `@extension.js:8629-8635` | `updateStatusBar` `inUseCount` 严查本实例 send | +7 |
| `@extension.js:8995-9007` | `buildHtml` 拆本对话/协调池计数 + `isInUseByThisConversation` 渲染 | +10 |
| `@extension.js:9126-9140` | 面板尾部 `N占` + `N协` 分显 | +5 |
| `@extension.js:9991-9994` | QuickPick 标 `[本对话]`/`[协调]` | +3 |
| `@extension.js:10740-10757` | `wam.status` 命令分显 本对话 vs 协调 | +10 |
| `@extension.js:17` | 头注释锚 v17.42.16 | +7 |
| `@extension.js:567` | `WAM_VERSION = "17.42.16"` | ~1 |
| `@package.json:5` | `version: "17.42.16"` | ~1 |
| `@_wam_e2e.js:+L31` | 新增 22 断言层 (L31) · 版本锚对齐 | +180 |

### 验证

```
WAM E2E v17.42.16-一刻一账号 · RESULT: 448 pass / 0 fail / 0 skip
STATUS: ✅ ALL GREEN (L1-L31 全绿 · 新增 22 断言覆盖五刀)
```

### 哲学

```text
太上不知有之. 功成事遂, 百姓皆谓我自然.

v17.42 将 markInUse 分散多路 · 为"兼收并蓄" —
九路道并行, 反成九号同显使用中, 用户不辨真妄.

v17.42.16 返本归真:
  - 名正 · _inUse {source, instId} 三分: send / quotaChange / remote
  - 实归 · UI 只认本实例 send 且严格 ≤ 1
  - 自然 · 切号即清 · 新号待发则置 · 无为而无不为

一对话一账号. 发送那一刻所对应的账号即此对话所用.
Q&A毕 · 等待间 · 无号"使用中" · 新送时方置新.
```

---

## v17.42.14 · 不冤枉 · purge Devin路径网络/代理错→skip · 镜像Firebase路径

> 天之道，不争而善胜，不言而善应 — 《德道经·七十三》

### 根因 (179机器 · 实地验证)

v17.42.13 `verifyAndPurgeExpired` Devin 路径存在**"不冤枉"漏洞**: 当4通道全部失败时，无论原因是网络/代理故障还是真实账号死亡，一律归档。

179机器现场证据:
```
_wam_purged.json: 10个账号
_purgeReason全部为: devin_dead: login/direct-raw:Failed to establish a socket connection to proxies: PROXY 127.0.0.1:7799 | direct-auto:connect ECONNREFUSED 127.0.0.1:7799 | proxy:Client network socket disconnected | native:Failed to fetch
windsurf-login-accounts.json: [] (账号池清空)
```

**根因**: 死代理 `127.0.0.1:7799` (已关闭的本地ClashX) 导致4通道全失败 → 10个DEVIN_TRIAL账号被误判devin_dead → 永久拉黑 → 账号池清空。

对比已正确的Firebase路径 (5668-5679行):
```javascript
// 永久性错误 → 标记移除
if (/INVALID|NOT_FOUND|DISABLED|WRONG/.test(err)) { ... archive ... }
// 网络/临时错误 → 跳过 (不冤枉)  ← Firebase路径有此逻辑, Devin路径缺失
log(`purge: ${acc.email} → skip (${err})`);
```

### 药方 (一行治本 · 镜像Firebase路径)

在 `verifyAndPurgeExpired` Devin 路径 `else` 分支增加永久错Pattern判断:

```javascript
const permanentDevinPat = /invalid|not[\s_-]?found|disabled|wrong|email|credentials|unauthorized/i;
if (permanentDevinPat.test(errStr)) {
  // 真实账号死亡 (auth error) → 归档
  toRemoveIndices.push(i);
  reasons[i] = `devin_dead: ${ds.stage || "login"}/${ds.error}`;
} else {
  // 网络/代理错误 → skip 保留不冤枉 (与Firebase路径对称)
  log(`purge: ${acc.email} → DEVIN skip (网络/代理错误: ...), 保留不冤枉`);
}
```

### 改动 (为最小改动)

| 位置 | 改动 | 行数 |
|------|------|------|
| `@extension.js:5650-5665` | else分支增加 `permanentDevinPat` 判断 | +10 |
| `@extension.js:557` | `WAM_VERSION = "17.42.14"` + 头注释 | +1 |
| `@package.json:5` | `version: "17.42.14"` | +0 |
| `@_wam_e2e.js:+L29` | 8个新断言: permanentDevinPat / skip日志 / 版本锚点 / 对称性 | +60 |

### 附: 179账号池修复

同步提供 `_179_recover_falsely_purged.ps1` 恢复脚本，将10个被误归档账号还原:
- 移除 `_purgeReason` / `_purgedAt` 等归档标记
- 标记 `_unverified` 待重验
- 从 `_wam_purged.json` 黑名单移除 (彻底解除黑名单)

### 验证

```
WAM E2E v17.42.14-不冤枉 · RESULT: 395 pass / 0 fail / 0 skip
STATUS: ✅ ALL GREEN (L1-L29 全绿 · +8 新断言)
179现场: 10个DEVIN_TRIAL账号已恢复 · purged归档清零
```

---

## v17.42.13 · 道冲用之不盈 · 渊兮似万物之宗 · 适应所有用户/环境/变化

> 道冲, 而用之或不盈. 渊兮, 似万物之宗. — 《德道经·四》
>
> 兵无常势, 水无常形, 能因敌变化而取胜者, 谓之神.

### 病根 (七破口深审 · 以神遇不以目视)

v17.42.12 已具八代适应性底座 (`_cfg` 三级兜底 · `_detectProductName` · `_resolveDataDir` · `_adaptive` RTT P95 学习 · 代理/端点/注入命令全软盖). **七道破口仍使核心刚则断**:

| # | 破口 | 违背原则 | 风险 |
|---|------|----------|------|
| 1 | `activate()` 无外层 try/catch · 任一行抛异常插件哑火 | 违**曲则全** | 🔴 高 |
| 2 | `WAM_DIR = ~/.wam-hot` 单路径 · 只读/沙箱 FS 即崩 | 违**水无常形** | 🟠 中 |
| 3 | 多用户同机共享 `~/.wam-hot` · instance 锁路径冲突 | 违**各安其位** | 🟠 中 |
| 4 | `_detectProductName` 取 `appName` 首词 · 空/单字无兜底 | 违**以神遇不以目视** | 🟡 低 |
| 5 | `_resolveDataDir` 不存在即退首选 · 下游写盘无回落 | 违**利而不害** | 🟡 低 |
| 6 | Firebase API key 唯一硬编码 · Google 轮换即死 | 违**兵无常势** | 🟡 低 · 已延 |
| 7 | 认证系统二元固化 `firebase\|devin` · rebrand 再手术 | 违**反者道之动** | 🟡 低 · 已延 |

**本版聚焦破口 1-4 一次贯通** (少则得 · 行小变不失大常).

### 药方 (渊兮似万物之宗 · 四级适应)

**① `_isPathWritable(p)` 路径可写性探测** (曲则全 · 不可写即降级)

- `fs.mkdirSync({recursive:true})` 不存在即尝创建
- `.wam_write_probe` 探针写+删, 任一异常→返回 false
- 任意兜底路径用前必探

**② `_getUserDiscriminator()` 用户隔离标识** (各安其位)

- `os.userInfo().username` 优先 → `env.USERNAME|USER|LOGNAME` 兜底 → `"shared"` 末路
- 清洗 `[^A-Za-z0-9_-]` · 截至 32 字

**③ `_resolveWamDir(context)` 六级兜底** (渊兮似万物之宗)

| 级 | 路径 | 用途 |
|---|------|------|
| 1 | `env.WAM_HOT_DIR` | 运维最高权 |
| 2 | cfg `wam.wamHotDir` | 用户权 |
| 3 | `~/.wam-hot` (legacy 沿用) | 老数据零迁移 |
| 4 | `~/.wam-hot/<user>` (新默认) | 多用户共机不冲突 |
| 5 | `context.globalStorageUri/wam-hot` | 沙箱/只读盘兜底 |
| 6 | `tmpdir()/wam-hot-<user>` | 末路单会话 |

- 每级调 `_isPathWritable` · 不可写即跳
- 级3 向后完全兼容 · 老 `~/.wam-hot` 存在即沿用, 不强迁

**④ `_detectProductName()` 三级强化** (以神遇不以目视)

| 优先 | 源 | 过滤 |
|------|-----|------|
| 1 | cfg `wam.productName` | 非空+trim |
| 2 | `vscode.env.appName` 首词 | 含字母/中文 (排纯空白/符号) |
| **3 新** | `process.execPath` basename | 排除 node/electron/code/code-oss 纯 runtime |

**⑤ `_resolveDataDir()` 多 fork 级联** (水无常形)

- 候选链: `productName` + `[Windsurf, Cursor, Trae, Code]` 全尝试
- linux 加 `XDG_CONFIG_HOME` 优先
- `home=""` 异常兜底

**⑥ `activate()` 四级容错** (大器晚成)

```
let _activateDegraded = null;
const _activateErrs = [];
try { PRODUCT_NAME = _detectProductName() || "Windsurf"; } catch(e) { _activateErrs.push(...); }
try { DATA_DIR = _resolveDataDir(PRODUCT_NAME) || ""; } catch(e) { _activateErrs.push(...); }
try {
  WAM_DIR = _resolveWamDir(context);
  _deriveWamPaths();
  if (!_isPathWritable(WAM_DIR)) {
    _activateDegraded = "storage-readonly";  // 五级兜底后仍不可写→降级为纯内存
  }
} catch(e) { _activateDegraded ||= "storage-partial"; _activateErrs.push(...); }
try { log(...); } catch {}
```

**降级状态机**:

| 状态 | 含义 | 行为 |
|------|------|------|
| `null` | 全活 (99%) | 正常运行 |
| `storage-readonly` | 五级兜底后仍不可写 | 内存模式, 重启后重试 |
| `storage-partial` | 解析异常但部分成功 | 沿用默认, 继续初始化 |

### 损 (为道日损)

| 位置 | 改动 | 行数 |
|------|------|------|
| `@extension.js:10-12` | 头注释新增 v17.42.13 里程碑 | +3 |
| `@extension.js:24-28` | 新块 "道冲·用之或不盈" 哲学注释 | +5 |
| `@extension.js:30-64` | `_detectProductName()` 三级强化 | ~35 改 |
| `@extension.js:66-125` | `_resolveDataDir()` 多 fork + XDG + 空候选兜底 | ~60 改 |
| `@extension.js:437-478` | **新** `_isPathWritable(p)` + `_getUserDiscriminator()` | +42 |
| `@extension.js:480-532` | `_resolveWamDir(context)` 六级兜底 (重写) | ~50 改 |
| `@extension.js:553-560` | `WAM_VERSION = "17.42.13"` + 历史锚点 | ~5 改 |
| `@extension.js:9225-9270` | `activate()` 四段 try/catch + 降级标记 | ~45 改 |
| `@package.json:5` | `version: "17.42.13"` | +0 |
| `@_wam_e2e.js:+1552-1702` | **新** L28 层 · 28 断言 | +151 |
| 同步 | `@wam-proxy/vendor/wam/extension.js` + `package.json` | 镜像 (symlink · _dao_link.ps1 管) |
| 自动 | `@020/dao-agi/vendor/wam/*` (符号链) | 零操作 |

### 益 (为学日益 → 为道日损)

**适应性矩阵** (覆盖前不曾适应的场景):

| 场景 | v17.42.12 | v17.42.13 |
|------|-----------|-----------|
| 只读 home FS (企业锁盘) | ❌ 写失败崩 | ✅ globalStorageUri 兜底 |
| 沙箱 FS (Flatpak/Snap) | ❌ 权限拒绝崩 | ✅ tmpdir 末路 |
| 多用户同机 (家庭/远程) | ⚠️ 共享污染 | ✅ `~/.wam-hot/<user>` 隔离 |
| Windsurf fork (Trae/Void/Kiro) | ⚠️ 可能路径错 | ✅ appName + execPath 兜底 |
| `appName=""`/单字/纯空白 | ❌ 退 Windsurf 错路 | ✅ execPath basename 兜底 |
| `homedir()` 抛 (测试 env) | ❌ 整个插件死 | ✅ 空串+候选空+四级降级 |
| linux 无 `~/.config` | ⚠️ 候选不存在 | ✅ `XDG_CONFIG_HOME` + tmpdir |
| `activate()` 任一异常 | ❌ 静默哑火 | ✅ 四级降级+诊断日志 |

### 验 (知常曰明)

```
WAM E2E v17.42.13-渊兮似万物之宗 · RESULT: 387 pass / 0 fail / 0 skip
STATUS: ✅ ALL GREEN
```

L1-L28 全绿 · 新增 L28 层 28 断言覆盖:

- `_isPathWritable` / `_getUserDiscriminator` 函数存在 (×4)
- `_resolveWamDir(context)` 六级兜底含 WAM_HOT_DIR/wamHotDir/legacy/user-isolated/globalStorageUri/tmpdir (×7)
- `_detectProductName` 三级含 execPath basename (×5)
- `_resolveDataDir` 多 fork 候选 + XDG (×2)
- `activate()` 四段 try/catch + 降级模式 + 复验可写性 (×7)
- 版本锚点 v17.42.13 + v17.42.12 历史保留 (×3)

### 向后兼容 (无为而无不为)

- ✅ 老 `~/.wam-hot` 存在即沿用 (级3 优先)
- ✅ `env.WAM_HOT_DIR` / `cfg.wam.wamHotDir` 配置继续最高优先
- ✅ `_resolveWamDir()` 无参调用仍可 (context 为 optional)
- ✅ v17.42.12 / v17.42.6 历史锚点注释保留
- ✅ 所有 27 层 E2E 继续全绿 · 零回归

### 延后 (知止可以不殆)

破口 6 (Firebase key 动态抽取) · 破口 7 (认证系统可插拔) 暂延 — Devin-first (`v17.40`) 已是主路, Firebase 为次, 风险已实质对冲. 待 Cognition 下次 rebrand 动因时再手术.

---

## v17.42.2 · 去芜存菁 · 大制不割 · 切号后 state 不变量归一 `_afterSwitchSuccess`

### 病根 (v17.42.1 深审 · 以神遇而不以目视)

v17.42.1 仅修了 4 路 (msgAnchor/monitor/exhaust/ratelim) 的 `_monitorConsecutiveFails=0`. **一查发现**:

- 另有 **4 路 user-driven 切号成功位**同样遗漏 (`setMode webview / doAutoRotate / panicSwitch / wam.wamMode`)
- 这 4 路连 `_lastSwitchTime = Date.now()` 也未写 · 用户手动切号后冷却闸门失效 · msgAnchor/ratelim 可立即连环切
- 即: **8 路切号成功位 · state 更新散落各处 · 任一路遗漏一项即产生不一致**

### 药方 (大制不割 · 朴散则为器)

抽出 `_afterSwitchSuccess(bestI, email)` helper · 集中 6 项不变量:

```
1. _store.activeIndex = bestI        ← 切换指针
2. _store.switchCount++              ← 累计计数
3. _lastSwitchTime = Date.now()      ← 冷却起点
4. _monitorConsecutiveFails = 0      ← 新号不继承旧退避
5. _store.save()                     ← 持久化 (v17.37 根治)
6. _quotaSnapshots.delete + _schedulePersist  ← 快照失效
```

**8 路切号成功位全部改为 `_afterSwitchSuccess(bestI, email)` 一行调用**:

| # | 路径 | 文件行 | v17.42.1 遗漏项 |
|---|------|--------|-----------------|
| 1 | msgAnchor | `@extension.js:611` | (完整) |
| 2 | monitor 额度变化 | `@extension.js:6600` | (完整) |
| 3 | 耗尽保护 | `@extension.js:6756` | (完整) |
| 4 | rate-limit 拦截 | `@extension.js:8996` | (完整) |
| 5 | **webview setMode** | `@extension.js:7303` | **_lastSwitchTime + _monitorConsecutiveFails + 快照** |
| 6 | **doAutoRotate 手动轮转** | `@extension.js:7903` | **_lastSwitchTime + _monitorConsecutiveFails** |
| 7 | **panicSwitch 紧急切换** | `@extension.js:8812` | **_lastSwitchTime + _monitorConsecutiveFails** |
| 8 | **wam.wamMode 模式命令** | `@extension.js:8886` | **_lastSwitchTime + _monitorConsecutiveFails + 快照** |

新增路径再不可能遗漏 · 一处修复全链生效 · **大制不割**.

### 损 (为道日损)

| 位置 | 改动 |
|------|------|
| `@extension.js:9` | 头注释新增 v17.42.2 行 |
| `@extension.js:437` | `WAM_VERSION = "17.42.2"` |
| `@extension.js:6371-6403` | 新增 `_afterSwitchSuccess(bestI, email)` helper (33 行 · 含病根药方注释) |
| `@extension.js:611/6600/6756/7303/7903/8812/8886/8996` | 8 路切号成功位改为 helper 调用 |
| `@package.json:5` | `version: "17.42.2"` |
| `@_wam_e2e.js` | +L19 共 11 条断言 (helper 存在 / 6 项不变量 / ≥ 8 调用 / 散落归一) |

### 验证

- **Source E2E**: 160 pass / 0 fail / 0 skip · L1-L19 十九层全绿
- **收益**: 8 路统一 · 未来新增切号路径忘了重置 backoff/冷却的 bug 类彻底杜绝

---

## v17.42.1 · 去芜存菁 · 切号即重置 monitor 退避 + origFetch 完整声明

### 病根 (v17.42.0 深审 · 去芜存菁)

1. **切号后 monitor 退避未重置** · 旧账号因网络等原因连续失败 30 次后 backoff 升至 8x (30s) · 切到新账号仍继承旧退避 · 新账号监测异常慢
2. **`_msgAnchor.paths.network` 初始状态缺 `origFetch: null`** · fetch hook 安装/卸载状态跟踪不完整

### 药方

1. 所有成功切号路径 (msgAnchor/monitor 额度变化/耗尽保护/rate-limit 拦截) 统一 `_monitorConsecutiveFails = 0` · 新账号从正常频率开始监测
2. 初始状态补全 `origFetch: null` · 确保 fetch hook 生命周期完整

### 验证

- **E2E**: 149 pass / 0 fail · L1-L18 + 2 新断言 (退避重置 ≥4 处 + origFetch 声明)
- **三端部署**: source / 141 / 179 hash 一致 · 全绿

---

## v17.42.0 · 反者道之动 · 逆向本源根治 msgAnchor · localhost gRPC + http2 hook + 五感快速退出

### 病根 (v17.41 实地深测 · 反者道之动)

v17.41 去除硬路径硬编码后, 179 实测发现 **消息锚定命中率 N0** — 切号链仍"静默":

```
msgAnchor send# | N0 C2 F0 H0 R0   ← network 路径永远 0 命中
```

**三重病根**:

1. **旧 network hook 仅匹配云端** · `codeium.com/windsurf.com` · 但 Windsurf 实际架构是 `extension → localhost:PORT(LS) → cloud` — **请求目标是 localhost, 非云端**
2. **ConnectRPC 使用 `globalThis.fetch` (undici)** · 非 `https.request` — 旧 monkey-patch 永远不触发
3. **HTTP/2 session 启动前已缓存** · `http2.connect = patched` 只拦截新 session · 已建立的不受影响

### 药方 (反者道之动 · 逆向溯源)

| 改 | 旧 | 新 |
|----|----|----|
| **Path A 网络** | 仅云端 `codeium.com` | 双层: 云端宽松 + localhost 精确 gRPC 匹配 (`SendUserCascadeMessage` 等逆向确认的 RPC 方法) |
| **Path A fetch** | 无 | `globalThis.fetch` hook (覆盖 ConnectRPC undici) |
| **Path E HTTP/2** | 无 | `ClientHttp2Session.prototype.request` 原型链穿透 (覆盖启动前创建的 session) |
| **消息即使用中** | 依赖额度变化标记 | `_msgAnchorTrigger` → 立即 `markInUse` (消息发送=使用中) |
| **五感快速退出** | inject 失败重试 3 次 × 12s | inject 系统性失败立即 break (知止可以不殆) |
| **monitor 退避** | 固定 3s 间隔 | 连续失败递增: 0-3→1x, 4-10→2x, 10-30→4x, 30+→8x (最大 30s) |

### 新 Path E · HTTP/2 原型链穿透

```
策略1: process._getActiveHandles() → 找活跃 Http2Session → patch prototype.request
  → 覆盖所有 session (含启动前已建立的) · 一次 patch 终身生效
策略2 fallback: http2.connect hook → 仅拦截未来 session (兼容无活跃 session 的场景)
```

### 损 (为道日损)

| 位置 | 改动 |
|------|------|
| `@extension.js:437` | `WAM_VERSION = "17.42.0"` |
| `@extension.js:14` | `require("http2")` |
| `@extension.js:470-477` | 消息锚定路径表更新 · 新增 E·HTTP/2 路径说明 |
| `@extension.js:479-497` | `_msgAnchor.paths.http2` 状态对象 |
| `@extension.js:527-536` | `_msgAnchorTrigger` 消息即标记使用中 (`markInUse`) |
| `@extension.js:626-654` | `_msgAnchorDoSwitch` 五感注入失败快速退出 |
| `@extension.js:657-758` | `_installNetworkAnchor` 重写: localhost 双层匹配 + `globalThis.fetch` hook |
| `@extension.js:760-798` | `_installCommandAnchor` 精确匹配逆向确认的命令名 |
| `@extension.js:861-950` | 新 `_installHttp2Anchor` + `_uninstallHttp2Anchor` (原型链穿透策略) |
| `@extension.js:6367-6408` | `_monitorConsecutiveFails` + 动态退避间隔 `monitorInterval()` |
| `@package.json:5` | `version: "17.42.0"` |
| `@_wam_e2e.js` | +L18 共 12 条新断言 · 147/147 ALL GREEN |

### 验证

- **Source E2E**: 147 pass / 0 fail / 0 skip
- **141 本机**: 部署就绪
- **179 远程**: 144 pass / 0 fail / 1 skip (预期 · .vscodeignore 不入运行时)
- **Hash 一致**: source ↔ 179 `extension.js = 1c9b261063420ce8`

---

## v17.40.0 · 万法归宗 · Devin-first 直连本源 · 持久化根治

### 病根 (实地底层测 · 反者道之动)

v17.39 消息锚定解决"触发晚", 但用户侧观察 "采样无数据" — 额度识别仍未真正打通. 调用本地 91 账号底层直测:

```
byAuth: { (unset): 76, devin: 15 }       ← 76 账号仍未标记 devin
Firebase: 6/6 timeout 16s                ← identitytoolkit.googleapis.com 不可达
Devin:    6/6 OK 1-2s (login→postAuth→GetPlanStatus 200)
```

**三重病根**:

1. **Firebase 端点不可达** · `identitytoolkit.googleapis.com` TCP timeout 5s (可能 GFW/路由)
2. **76 账号仍 `(unset)`** · 每次 `fetchQuota` 先等 Firebase 16s 超时, 再降级 Devin
3. **持久化 bug @extension.js:4011** · Firebase fail → Devin OK 时 `acc._authSystem="devin"` 仅内存, **缺 `_store.save()`** → 重启清零回到原点

### 药方 (万法归宗 · 损之又损)

**Phase-1 立竿见影** (不改插件代码):
- 批量迁移 141 本机 76 + 179 远程 92 账号 → `_authSystem="devin"` 持久化到 accounts.json
- Reload 即 91 账号皆走快速路径

**Phase-2 根治** (extension.js:3973-4087 重写 `fetchAccountQuota`):

| 改 | 旧 | 新 |
|----|----|----|
| **主道** | `devin-known ? Devin : Firebase` | `goDevinFirst ? Devin : Firebase` (devinKnown ∥ preferDevinFirst) |
| **持久化** | 只在 "migrated" 401 时 save | `_persistDevinMark` + `_persistFirebaseMark` 首次标记即 save |
| **Firebase 超时** | 12-16s 无保护 | `Promise.race` + `firebaseMaxTimeoutMs=4000` 上限 |
| **Devin 失败** | 直接 return FAIL | → Firebase 兜底 (双路互为应急) |
| **错误标识** | `devin_login: xxx` | `both_auth_failed: devin=xxx firebase=xxx` (诊断更清晰) |

### 新 config

| key | 默认 | 用途 |
|-----|------|------|
| `wam.preferDevinFirst` | `true` | 未知账号默认直走 Devin · Firebase 明确标记账号仍走 Firebase |
| `wam.firebaseMaxTimeoutMs` | `4000` | Firebase 整体超时 ms · 快失败让 Devin 兜底 |

### 实测对比

| 场景 | 旧 (v17.39) | 新 (v17.40) |
|------|-------------|-------------|
| unset 账号首次 fetchQuota | ~16-18s (Firebase timeout + Devin) | **~2-4s** (Devin 直连) |
| devin 账号稳态 fetchQuota | ~2-3s (已优) | ~2-3s (不变) |
| Firebase 账号 (legacy) | ~1-3s | ~1-3s (Firebase-first, 保留 legacy 行为) |
| 重启后 devin 标记 | ❌ 丢失 (v17.35 bug) | ✅ 持久化 (v17.40 修复) |

### 损 (为道日损)

| 位置 | 改动 |
|------|------|
| `@extension.js:400` | `WAM_VERSION = "17.40.0"` |
| `@extension.js:3973-4087` | `fetchAccountQuota` 分支重构 · `_persistDevinMark`/`_persistFirebaseMark` 辅助 · `Promise.race` Firebase 超时保护 |
| `@package.json` | +2 config · `wam.preferDevinFirst` + `wam.firebaseMaxTimeoutMs` |
| `@_wam_e2e.js` | +L16 共 14 条断言 · 104/104 ALL GREEN |
| `@bundled-origin/VERSION` | `17.39.0` → `17.40.0` |
| `@accounts.json` (运行时) | 141: 76 unset→devin · 179: 92 unset→devin (脚本迁移, 非插件产物) |

### 验证

- **Source E2E**: 104 pass / 0 fail / 0 skip
- **141 本机**: 100/100 ALL GREEN · 91 账号全 devin
- **179 远程**: 100/100 ALL GREEN · 92 账号全 devin
- **Hash 三端**: `extension.js=f98b66151ab82d38` · `package.json=4b3ebd741f28d6de`
- **底层实测**: 3/3 迁移后账号 Devin 全链路 1.5-2.5s 完成 (vs 18s 改前)
- **VSIX**: `rt-flow-17.40.0.vsix` 122 KB

---

## v17.39.0 · 反者道之动 · 消息锚定·五路道并行 · 跳出轮询表象

### 病根 (v17.38-stealth 换身份后深审)

身份替换为 `devaid.rt-flow` 虽解 ban, 但**切号链仍断**. 深察发现病根不在身份, 而在**触发机制**:

| 环节 | 旧机制 | 病 |
|------|--------|-----|
| 触发 | `monitorActiveQuota` 轮询 → `fetchAccountQuota` 命中外部 API → 额度变 → 切号 | 外部 API 任一环节失效 (ban/限流/迁移/网络) 即整链死寂 |
| 症状 | 用户发消息 → 额度轮询下一轮未到 → 无反应 | 依赖间接信号 · 最坏延迟 45s |
| 本源 | 对话发送后立即切号 (用户真实需求) | 从未被直接满足 |

### 药方 (反者道之动 · 五路道并行 · 道并行不相悖)

跳出"轮询额度变化"的表象, 直接锚定"消息发送"动作本身. 五路探针独立工作, 任一命中即排队切号, **外部 API 失效亦不影响**.

| 路 | 探针 | 原理 | 文件 |
|----|------|------|------|
| **A** 网络 | monkey-patch `https.request`/`http.request` | 嗅探 `*.codeium\.com`/`*.windsurf\.com` + `StreamCascade` 指纹 | `_installNetworkAnchor` |
| **B** 命令 | monkey-patch `vscode.commands.executeCommand` | 匹配 `windsurf.cascade.*`/`cascade.*` 等指令 ID | `_installCommandAnchor` |
| **C** 文件 | `fs.watch ~/.codeium/windsurf/cascade/*.pb` | 每次发送一轮即写盘, mtime 变化即触发 | `_installCascadeFileAnchor` |
| **D** 错速 | 既有 `_rateLimitWatcher` + 文档 "Rate limit" 关键字 | 独立并行保留 (`民至老死不相往来`) | 既有 + `_msgAnchor.paths.ratelim.hits` |

### 统一触发器

```js
_msgAnchorTrigger(source)  // 任一探针调用
  → 300ms 多路去重         // 避免 network+cascade 同时命中重算
  → sendCounter++          // 每 N 次分流 (默认 1=每次)
  → 1500ms debounce        // 让当前 stream 完成再切
  → _msgAnchorDoSwitch     // 与 monitorActiveQuota 同一套风控闸门
```

### 品德 (太上不知有之 · 上德若偷 · 上善如水)

- **零 Toast**: 五路触发切号均仅 `log()`, 无任何 `showInformationMessage` (E2E L15 断言 `toastInAnchor === 0`)
- **零改写**: 网络/命令拦截仅观察, 原函数原样返回 (`origHttpsReq`/`origExec` 保留, `_uninstall*` 可一键还原)
- **零硬编码**: 全部参数走 `wam.messageAnchor.*` 配置 (可单路禁用)
- **兜底恢复**: `deactivate` 自动 `_uninstallMessageAnchor`, `context.subscriptions` 一并清理

### 损 (为道日损)

| 位置 | 改动 |
|------|------|
| `@extension.js:400` | `WAM_VERSION = "17.39.0"` |
| `@extension.js:425-790` | +365 行 · 消息锚定五路道并行模块 (`_msgAnchor`/`_msgAnchorTrigger`/`_msgAnchorDoSwitch`/3×installer/snapshot) |
| `@extension.js` activate | `_installMessageAnchor(context)` 钩入 rate-limit 之后 |
| `@extension.js` rate-limit 拦截 | 追加 `_msgAnchor.paths.ratelim.hits++` 统计 |
| `@extension.js` deactivate | `_uninstallMessageAnchor()` 兜底 |
| `@extension.js` exports | `+ _msgAnchorSnapshot` 供诊断 |
| `@package.json` | +7 个 `wam.messageAnchor.*` 配置 (enabled/debounceMs/everyN/dedupeMs + 3 path.*) |
| `@_wam_e2e.js` | +L15 共 34 条断言 · 88/88 ALL GREEN |
| `@bundled-origin/VERSION` | `17.37.0` → `17.39.0` |

### 验证

- **Source E2E**: 88 pass / 0 fail / 0 skip
- **141 本机**: 84 pass / 0 fail / 2 skip (预期 · .vscodeignore/bundled-origin 不入运行时)
- **179 远程**: 84 pass / 0 fail / 2 skip (同上)
- **Hash 校验**: source ↔ 141 ↔ 179 三端 `extension.js`=`f7308263a64d3345` · `package.json`=`ae04e889e50e909e`
- **Ban traces**: extension.js 0 · package.json 0 (隐匿身份完好)
- **VSIX**: `rt-flow-17.39.0.vsix` 119 KB

### 下一步

`Ctrl+Shift+P` → `Developer: Reload Window` → 新消息锚定即刻生效. 任一路命中即切号, 无论额度 API 是否可达.

---

## v17.37.0 · 道法自然 · 四处持久化缺失修复 · 各安其位

### 真根承 v17.36 (纯切号归位后深审)

v17.36 剥离 origin 层后, WAM 回归纯切号本体. 深审核心切号链路发现 **四处持久化缺失**:

1. **`doAutoRotate` 切号成功后不落盘**: `_store.activeIndex = bestI; _store.switchCount++` 后无 `_store.save()` — 重启丢失切号状态
2. **`panicSwitch` 紧急切换后不落盘**: 同上 — 紧急切换后 Reload Window 回到旧号
3. **`switchAccount` (webview 手动切) 后不落盘**: `case "switch"` 分支 `_store.activeIndex = msg.index` 后无 save
4. **代码中残存 `_saveStore()` 调用**: 旧 v17.35 遗留的函数名, 实际应为 `_store.save()` — 若残存则 ReferenceError 静默吞

### 损 (为道日损 · 最小补)

| 位置 | 改动 |
|------|------|
| `@extension.js:400` | `WAM_VERSION = "17.37.0"` |
| `@extension.js` doAutoRotate 成功分支 | 补 `_store.save()` |
| `@extension.js` panicSwitch 成功分支 | 补 `_store.save()` |
| `@extension.js` case "switch" 成功分支 | 补 `_store.save()` |
| `@extension.js` 全文 | `_saveStore()` → `_store.save()` (若有残存) |
| `@bundled-origin/VERSION:1` | `17.36.0` → `17.37.0` (E2E L10 对齐) |

### 本源之理

**功遂身退**: 四处补全皆单行 `_store.save()`, 不改架构不改流程. 切号成功 → 落盘 → 重启不丢. 此即"为而不恃, 功成而弗居".

---

## v17.36.0 · 道法自然 · Origin 剥离 · WAM 归本位 · 各得其序

### 人法地 · 地法天 · 天法道 · 道法自然

v17.21 "二核合一" 将切号 + 道Agent 合入同一 VSIX. 经 15 版迭代 (v17.22→v17.35), 两核耦合渐深:
- origin 层 (proxy/anchor/SP注入) 占 extension.js 约 40% 代码量
- origin 配置项 (wam.origin.*) 占 package.json 8 项
- origin 命令 (wam.originInvert/wam.originPassthrough/wam.verifyEndToEnd) 3 个
- 切号本体与 origin 生命周期交织 (activate/deactivate 皆触 proxy spawn/kill)

**各得其序**: 切号是切号, 道Agent 是道Agent. 混则乱, 分则治.

### 剥离清单

| 去 (从 WAM 移除) | 归 (移至 020-道VSIX_DaoAgi) |
|---|---|
| `OriginCtl` 全模块 (spawn/kill/anchor/ensure/status) | dao-agi 独立 VSIX |
| `_origFindNode` / `_origFindDir` / `_origKillByPort` | dao-agi extension.js |
| `_origHealCodeiumPatch` / `_origDetectSystemProxy` | dao-agi |
| `wam.originInvert` / `wam.originPassthrough` 命令 | dao-agi 命令 |
| `wam.verifyEndToEnd` (E2E 十层自检) | dao-agi E2E |
| `wam.origin.*` 8 项配置 | dao-agi package.json |
| `bundled-origin/` 内嵌资源自解压逻辑 | dao-agi 内嵌 |
| webview setOrigin/setCombo 之 origin 分支 | dao-agi webview |

### 保留 (WAM 纯切号本体)

- 全部切号引擎: Firebase/Devin 双身份, 账号池, 额度监测, 消息锚定, 智能轮转
- Chromium 原生桥 (网络层)
- Token Pool 预热, 自适应运行时 (_adaptive)
- 自动更新 (autoUpdate)
- 写盘诊断, 自诊断
- Webview 管理面板 (切号专用, 去 origin 控制区)

### 向后兼容

- `wam.originInvert` / `wam.originPassthrough` / `wam.verifyEndToEnd` 命令**保留注册** → 提示"已移至 020-道VSIX_DaoAgi"
- `wam._origin_removed` 弃用标记 → settings.json 迁移提示
- `setOrigin` / `setCombo` webview 消息 → 提示已剥离

### 本源之理

**大制不割**: 不是删除 origin, 是各归其位. WAM 为器 (切号), dao-agi 为道 (SP注入). 器各安位, 道各循序. 圣人之道, 为而不争.

---

## v17.35.0 · 道法自然 · Devin 迁移全面适配 · fetchQuota 从底层打通

### 真根承 v17.34 (Firebase idToken 被 "migrated" 拒绝)

v17.34 在 3 官方通道加了 `Authorization: Bearer` header, 但实测 179 揭示 **更深层根因**:

1. **账号已迁移至 Devin**: Cognition 收购 Windsurf 后全部账号迁移, `server.codeium.com` 和 `web-backend.windsurf.com` 对 Firebase idToken 返回 `401 "Your account has been migrated. Please log in again."`.
2. **Clash 代理 TLS 全面失效**: 179 机器 Clash(:7890) CONNECT 成功但 TLS 握手断开, 导致 Firebase login 超时 → `all_channels_failed`.
3. **Devin fallback 门槛过严**: 旧代码仅在 Firebase 返回 `INVALID/NOT_FOUND/DISABLED/WRONG` 时尝试 Devin, 网络超时/`all_channels_failed` 被遗漏.

### 三项修正

| # | 改动 | 位置 |
|---|------|------|
| 1 | **已知 Devin 账号直走 `_devinFullSwitch`** — 跳过 Firebase (省 10-42s 超时浪费) | `fetchAccountQuota` token 获取段 |
| 2 | **Firebase 失败 → 无条件 Devin fallback** — 不再限于 INVALID/WRONG 错误模式 | `fetchAccountQuota` else 分支 |
| 3 | **GetPlanStatus 401 "migrated" 自动标记 `_authSystem=devin`** — 下次循环直走 Devin | channel handler + `Promise.any` catch |

### 验证 (179 实测)

- `windsurf.com` 直连 200 ✓ (Devin auth 不需要 Clash)
- `server.codeium.com` 直连可达 ✓ (GetPlanStatus 不需要 Clash)
- Devin 全链路: `_devin-auth/password/login` → `WindsurfPostAuth` → `GetPlanStatus` → **200 OK 595B** ✓
- 对比: Firebase idToken → GetPlanStatus → `401 "migrated"` ✗

---

## v17.34.0 · 道法自然 · 账号池认证补齐 · fetchQuota Authorization 补

### 真根承 v17.33 (179 "回弹" 深层补余)

v17.33 已消 7 重真根 (旧 login-helper 冲突 / 双窗双 LS race / exthost errors / 扩展 metadata 残留 / codeium.windsurf 未 activate / chat 链不通 / proxy 单端口), chat 链路已通. 但 **179 深度诊断** 揭示账号池全面失效:

1. **`fetchAccountQuota` 3 通道 (ch1/ch2/ch3) 全 401**: `all_official_native_failed / _proxy_failed / _direct_failed`. 探 3 官方 endpoint (`server.codeium.com`/`web-backend.windsurf.com`/`register.windsurf.com`) → 皆返 **HTTP 401 application/json**.
2. **账号池 86/86 `plan=null`**: verify-gate 因 quotaFetch 失败不置 `_verifiedPlan` · 切号器找不到生效账号.
3. **根因**: 3 通道 headers 仅有 `Content-Type` + `connect-protocol-version` · **无 `Authorization`**. authToken (Firebase idToken / Devin sessionToken) 仅放 proto body (`encodeProtoString(authToken)`) · 但 API 期望 HTTP header + body 双重认证.

### 损 (为道日损 · 守不改架构 · 最小补)

**不做**:
- 不改竞速架构 · 不改 URL 列表 · 不改 cooldown 逻辑

**做**:

| 位置 | 改动 |
|------|------|
| `@package.json:5` | `version: "17.34.0"` |
| `@extension.js:400` | `WAM_VERSION = "17.34.0"` |
| `@extension.js:2665-2672` | `_httpsPostRawViaProxy` 加第 6 可选参数 `opts = {}` · 支持 `opts.headers` 合并 |
| `@extension.js:2707-2708` | proxy 版 headers spread `...(opts.headers || {})` |
| `@extension.js:3657-3665` | fetchQuota 共用 `_authHeaders` · 含 `Authorization: Bearer ${authToken}` |
| `@extension.js:3673` | ch0 (native) headers = `_authHeaders` |
| `@extension.js:3691-3698` | ch1 (proxy) 传 `{ headers: { Authorization: ... } }` |
| `@extension.js:3709-3712` | ch2 (direct) 传 `{ timeout, headers: { Authorization: ... } }` |

### 向后兼容

- `_httpsPostRawViaProxy` 其他 5 处 caller (register / chat capacity / self-test / auto-relay) 未传 opts · 默认空对象 · 行为不变
- `_httpsPostRaw` 签名本已支持 `opts.headers` · 零改

### 预期效果

- WAM 启动 ~90s 后 · wam.log 应现 `ch1: OK D... W... Trial / Pro_Trial / Free`
- 账号池 plan 从 null → 真 plan (Trial/Pro_Trial/Free)
- purge / verify-gate 正常过账 · 切号器选最优
- `inject_result.json` 按需刷新 · LS 拿 fresh apiKey

### 与 chat 关联

- **本版不改 chat 路径** (chat 路径 v17.33 已通, 无改动)
- 账号层正常生效 → 切号器有数据决策 → 长期稳定运行的基础

## v17.33.0 · 道法自然 · 全链路十层打通

### 真根承 v17.32 (完全打通 chat 后之广度)

v17.32 已消"proxy 杀之症", chat 路径已无回弹. 但 **十维底层诊断** 揭示仍有广度隐患:

1. **`codeium dist/extension.js` patch 脆弱** — Windsurf 升级 / 扩展重装 / `.bak` 恢复 皆让 patch 丢失 · LS 回归官方云 inference.codeium.com · 道Agent 瞬失效
2. **`server.self-serve.windsurf.com` 74 次 ECONNRESET** — 上游 TLS 层 RST · TCP 握手通但 HTTP 被 reset · mgmt 层 Ping/Auth/Quota 全死 · 虽不直接致回弹但影响配额/账号状态
3. **系统有 Clash/v2rayN :7890 但 proxy 不用** — `https.request` 直连上游 · 未自动走 HTTP tunnel · 错失规避 RST 的路径
4. **无一键自检命令** — 用户无法确认全链路是否齐备

### 损 (道法自然 · 无为而无不为)

**去**: 无 (保留 v17.32 全部修)

**加**:

| 位置 | 增益 |
|:-|:-|
| `@extension.js:400` | `WAM_VERSION = "17.33.0"` |
| `@extension.js:7546-7552` | `activate` 最早阶段 `_origHealCodeiumPatch()` · 自愈 patch (内置三盘路径候选 · 备份 `.bak` · 精确替换 + regex fallback) |
| `@extension.js:8598-8633` | 新 `_origDetectSystemProxy()` · 顺序探 `:7890,:10809,:1080,:8080,:7891` · 首个 listen 即返 |
| `@extension.js:8642-8699` | 新 `_origHealCodeiumPatch()` · 幂等 · 已 patch 零操作 · 未 patch 则备份 + 注入 |
| `@extension.js:9017-9034` | `_origSpawnProxy` env 加 `ORIGIN_UPSTREAM_PROXY` (自探结果注入) |
| `@extension.js:8331-8527` | 新命令 `wam.verifyEndToEnd` · 十层自检 · 输出 OutputChannel "WAM · E2E Verify" |
| `@bundled-origin/源.js:61-123` | 新 `HttpTunnelAgent` · 纯手写 HTTP CONNECT tunneling (无 npm 依赖) · 支持 env `ORIGIN_UPSTREAM_PROXY` |
| `@bundled-origin/源.js:757-777` | `proxyToCloud` 若有 tunnel agent 则走 · 日志加 `via :7890` 标识 |
| `@bundled-origin/源.js:927-941` | boot listening 日志加 upstream proxy 状态 |
| `@package.json:5` | `"version": "17.33.0"` |
| `@package.json:57` | 新命令 `wam.verifyEndToEnd` |
| `@package.json:124` | 新配置 `wam.origin.upstreamProxy` (手动覆盖自探) |

### 十层自检矩阵 (wam.verifyEndToEnd)

| 层 | 检 |
|:-|:-|
| L1 | codeium dist patch · 自愈即 PASS |
| L2 | proxy `:8889` · uptime / mode / req_total |
| L3 | proxy `:8890` · 独立 ping (外部独立验证 extra server) |
| L4 | `/origin/selftest` · 德道经 SP 真置换 (3 路径 × 0 leak) |
| L5 | `settings.codeium.inferenceApiServerUrl` 含 `:8890/i` |
| L6 | LS 进程参数 · wmic 查 `--api` + `--inference` 双命令行 |
| L7 | `origin_state.json` + `wam_mode.json` 皆在 |
| L8 | system proxy 自探结果 (诊参考 · 非 PASS/FAIL) |
| L9 | hot 目录完整 (`源.js` / `anchor.py` / `_dao_81.txt` / `VERSION`) |
| L10 | 版本 pkg 与 hot VERSION 一致 |

用户可于命令面板 `Windsurf Assistant: 全链路十层自检 (E2E)` 一键触发 · 10 秒出报告.

### 本源之理

**无为而无不为**: activate 时自愈 patch + spawn 时自探 proxy + `源.js` 内建 tunnel · 一切皆在背景默发 · 用户无感. 按一个 E2E 命令即见全貌.

**无感而万感**: proxy tunnel 不改体验 (只改路由) · selftest 证 SP 置换真伪 · wmic 证 LS 参数真态 · 十层皆可验证. 用户不用问"通不通", 按即见真.

## v17.32.0 · 为道再损 · 消 179 回弹真根

### 真根溯源 (v17.31 后四态控制变量实测)

179 v17.31 部署后实测, 发现 `origin_state=off + proxy 仍活` 之撕裂态, 并 chat 仍回弹. 深究四态矩阵 × LS 命令行 × proxy 存活三轴联动, 真根终显:

1. **v17.30 `dist/extension.js` 硬编 LS `--inference=:8890/i`** (本是为让 mgmt/infer origin 不同, 绕 codeium LS binary origin 比对 bug)
2. **`setOrigin("passthrough")` 与 `setCombo('pure')` 皆调 `OriginCtl.deactivate()` 杀 proxy** (v17.22 之"真正撤锚 + 杀 proxy · 零中间层" 有为之法)
3. 两轴相遇: 用户按"官方Agent" → proxy 死 → LS 命令行仍硬编 `:8890/i` → chat 打向**死端口** → **回弹** (LS `get client()` 抛 `Language server has not been started` 实为下游失败之上症)
4. **`ensure` 分支 1**: `proxy 未活 + passthrough · 停留 off 零操作` 之 v17.25 遗设, 在 v17.30 patch 后变成**破坏性路径** (off 态下 LS 打 :8890 必死)

### 损 (为道再损 · 无为而无不为)

**去**: 三处"官方Agent = 杀 proxy"之有为之法 + ensure 分支 1 之"停留 off"

**改**:

| 位置 | 旧 | 新 |
|------|----|----|
| `@extension.js:6480-6488` setOrigin("passthrough") | `OriginCtl.deactivate()` 杀 proxy | `OriginCtl.ensure("passthrough")` proxy 永在位 |
| `@extension.js:6542-6550` setCombo('pure') | `deactivate()` | `ensure("passthrough")` |
| `@extension.js:8303` wam.originPassthrough | `deactivate()` | `ensure("passthrough")` |
| `@extension.js:9172-9185` ensure 分支 1 | `proxy 未活 + passthrough → 停留 off · 零操作` | **去** · 直接走冷路径 activate (spawn + anchor 三层 · SP_MODE=passthrough 纯透传) |

### 本源之理 (源.js:768 所证)

```js
if (kind === "PASSTHROUGH" || SP_MODE === "passthrough") {
  proxyToCloud(req, res, undefined, rid);
  return;
}
```

SP_MODE=passthrough 时, proxy **纯透传字节**, 不改 body, 不注 SP. 体验 = 官方直连. 但 proxy 仍监 :8889 + :8890, LS 命令行硬编 :8890 永有人接. **proxy 存在 ≠ proxy 劫持**; 劫持由 `SP_MODE` 决定, 非由 proxy 是否存在决定. 此即"无为而无不为"之本意.

### 四态矩阵 (v17.32 已完备)

| mode | origin | 路径 | proxy | SP_MODE | chat 通 | 体验 |
|------|--------|------|-------|---------|---------|------|
| wam | invert | 道法自然 一键 | 活 | invert | ✓ | WAM 切号 + 德道经 SP 注入 |
| wam | passthrough | WAM + 官方Agent | 活 | passthrough | ✓ | WAM 切号 + 原生 SP 透传 |
| official | invert | 官方登录 + 道Agent | 活 | invert | ✓ | 用户账号 + 德道经 SP 注入 |
| official | passthrough | 纯官方 一键 | 活 | passthrough | ✓ | 用户账号 + 原生 SP 透传 |

**皆活 · 皆通 · 无回弹**. 4 态之差唯在 SP_MODE 一字.

### 保留 `OriginCtl.deactivate`

仅供 extension host `deactivate()` (VSCode 卸载/重装/关窗时) 调用, 不再暴露于 UI. 用户按钮永不触杀 proxy.

## v17.31.0 · 隔离体系显露 · 四态矩阵 + 一键组合

### 真根承 v17.30 (179 回弹之深究)

v17.30 已闭全链 (proxy 多端口 + LS 两 URL origin 不同 + codeium dist patch), 但 179 用户仍报"回弹". 取 179 当下全息发现:

1. **`exthost.log` 直揭**: `[error] Error: Language server has not been started!` @ `codeium.windsurf` extension 之 `get client()` · LS 尚未 spawn 前被调用 · **真回弹源之一**
2. **扩展激活时序 race**: `10:13:40 codeium.windsurf activate` → `10:13:40.746 exthost exit` → `10:13:51 wam activate (新 host)` → `10:13:54 [error] LS not started` · Windsurf 内部之 extension host race
3. **proxy.log 实际**: LS 启后 mgmt 流量 (Ping/RecordEvent/GetUserJwt) 皆 200 · 但 **0 条 inference/chat 流量** (用户试发消息 · 可能在 LS race 时 abort · 或 chat 根本未触到 proxy)
4. **隔离 UI 漏洞**: 用户难直观看清当前所处组合态 · "官方登录" 按钮只停 WAM · Agent 层若 `invert` 仍劫流量 · "纯官方"体验需两步操作
5. **`http.proxy=127.0.0.1:7890`**: 用户系统级 VS Code 代理 (v2rayN/Clash) · 对 LS native binary 无影响 · 但 webview/mgmt 吃此

### 损 (为道日损 · 守两轴正交 · 加原子组合)

**不做**:
- 不改 `setMode` / `setOrigin` 各自的正交行为 (守用户独立意愿)
- 不触 codeium 内部 LS race (非 wam 责任域)

**做**:

| 位置 | 改动 |
|------|------|
| `@package.json:5` | `version: "17.31.0"` |
| `@extension.js:400` | `WAM_VERSION = "17.31.0"` |
| `@extension.js:6511-6559` | 新 `setCombo` handler · `dao` = `setMode(wam) + ensure(invert)` · `pure` = `setMode(official) + cleanup + deactivate` |
| `@extension.js:6945-6975` | `mode-bar` 清晰分"账号/Agent"两层 + 新增 `combo-bar` 显当前组合态 (道法自然/纯官方/混合) |
| `@extension.js:6901-6912` | 新 CSS: `.combo-bar` `.combo-btn.dao` `.combo-btn.pure` `.combo-now.mix` |
| `@extension.js:7022` | `setCombo(kind)` JS helper |

### 用户体验

**UI 层**:
```
账号: [⚡ WAM切号] [🔑 官方登录]  ‖  Agent: [☯ 道Agent] [○ 官方Agent]  [注入 :8889]
一键: [☯ 道法自然] [🕊️ 纯官方]                  当前: 道法自然 ☯
```

按"官方登录" 只停 WAM 层 · 按"官方Agent" 只撤锚杀 proxy · 两按钮**正交** · 互不干扰.

按"道法自然" 原子切到 (WAM切号 + 道Agent) · 按"纯官方" 原子切到 (官方登录 + 官方Agent + 撤锚). 一步到位.

### 控制变量实验 (179 验收)

用户可按如下 4 态逐一测, 找"回弹"真根之控制变量:

| 组合 | 按钮路径 | 期望 chat 行为 | 观测 |
|------|---------|---------------|------|
| WAM + 道Agent | 一键"道法自然" | 德道经 SP 注入 · chat 走 proxy | proxy.log 现 `/i/` + `CHAT_PROTO` |
| WAM + 官方Agent | WAM切号 → 官方Agent | 官方 SP · chat 直连云 | LS 云端 TCP 增 · proxy.log 仅 mgmt |
| 官方 + 道Agent | 官方登录 → 道Agent | 仅原生账号, 德道经注入 | proxy.log 现 `/i/` · 无 WAM 流量 |
| 官方 + 官方Agent | 一键"纯官方" | 纯原版 Windsurf | proxy.log 几乎空 (WAM 引擎停) |

若某态下 chat 能发, 其他态回弹 → 差异即真根.

## v17.29.0 · 为道再损 · `anchor.py` 循环剥除灾难之终结

### 真根定位 (179 场景 · v17.28 上线后仍 "不可用")

v17.28 解 "kill 全段" 爆 exthost 之谬, 但 179 笔记本 chat 仍不可用. 深究:

1. **`LS pid=33596` TCP 证据**: `[192.168.31.179]:52264 → [35.223.238.178]:443` (googleusercontent.com · inference.codeium.com 真身) — **LS chat 直连云端 · 绕 proxy!**
2. **settings.json 真实状**: `codeium.inferenceApiServerUrl = ""` (空串!) — **被人为剥除?!**
3. **wam.log 实证**: 多次 `restore-inf: anchor.py restore-inference rc=1: Traceback` + `deactivate · restored + stopped` 循环
4. **真因揭**: `anchor.py` 第 398 行:
   ```python
   datetime.datetime.now(datetime.UTC)  # AttributeError
   # from datetime import datetime 后 datetime 已是 class
   # 无 datetime 属性; 无 UTC 属性
   ```

### 死穴之执行顺序

`op_restore_inference` 逻辑:
1. ✓ 读备份 JSON
2. ✓ **从 settings.json 移除 key `codeium.inferenceApiServerUrl`**
3. ✓ **保存 settings.json** (key 已被永久剥!)
4. ✗ 归档备份 (rename) → **抛 AttributeError**
5. function 崩溃, **backup 文件未归档 → 下次 restore 再 strip 一遍**

每次 `deactivate()` 触发一次剥除循环. 用户因"不可用"反复点"关闭",10+ 次 deactivate → settings.json 的 codeium.* 键被彻底洗白 → LS 启动时读 undefined, 用 Windsurf 硬编码默认 `http://127.0.0.1:8889` (无 `/i`) → LS 判 URL 不完整 → fallback 直连 `inference.codeium.com`.

### 损 (为道日损)

```diff
 def op_restore_inference():
     ...
-    s.pop(INFERENCE_KEY, None) or s[INFERENCE_KEY] = orig
-    _save_settings(s)                                   # 先改 settings
-    SETTINGS_BACKUP.rename(
-        f"_settings_backup_restored_{datetime.datetime.now(datetime.UTC)...}"  # 错·炸
-    )
+    # 先归档备份 (与 op_restore_globalstate 一致的正确写法)
+    SETTINGS_BACKUP.rename(
+        SETTINGS_BACKUP.stem + "_restored_" + datetime.now().strftime(...)
+    )
+    s.pop(INFERENCE_KEY, None) or s[INFERENCE_KEY] = orig
+    _save_settings(s)                                   # 备份归档后再改 settings
```

### 双重防御

1. **归档在前**: 若 rename 失败 (极端情况), settings 不会被剥 (exception 前未 save)
2. **归档成功后**: backup 已改名, 下次 restore "无备份跳过" · 循环自断

### 改动

| 位置 | 改动 |
|------|------|
| `@package.json:5` | `version: "17.29.0"` |
| `@extension.js:400` | `WAM_VERSION = "17.29.0"` |
| `@bundled-origin/anchor.py:383-406` | `op_restore_inference` 归档顺序调整 + datetime 修正 |
| `@bundled-origin/VERSION` | 版本号对齐 |

## v17.28.0 · 为道再损 · 精准杀 orphan · 弃端口全段爆破

v17.27 验收于 179 时揭第二真根: `init()` 之 `_killRange` 循环 111 次 `spawnSync powershell.exe`, 累计 30+ 秒, 阻塞 extension host 事件循环, VSCode 判"extension host 无响应"而杀之. wam.log 自 "init: pid 不符 ... kill 全段" 后寂灭, 活 proxy 变 detached child 被 reparent 至 SSH powershell, 呈假活之象.

### 损

单句替代: `for (p=8889;p<=8999;p++) _origKillByPort(p)` → `if(st.port)_origKillByPort(st.port); if(st.pid)_origKillPid(st.pid)`.

### 得

- **1 次 spawn 取代 111 次**: <100ms 取代 30+ 秒 · 不再爆 exthost
- **原则归真**: 只杀已辨之真 orphan (port+pid from ping body) · 不扫不猜
- **他端口野 proxy 容**: 若某实例在 :8900 · 与本无冲 · 不干预 (柔弱处下)

### 改动

| 位置 | 改动 |
|------|------|
| `@extension.js:400` | `WAM_VERSION = "17.28.0"` |
| `@extension.js:8979-9030` | `_killRange` → `_killOrphan` · port+pid 精准杀 |

## v17.27.0 · 为道日损 · 反者道之动 · 四损四得

为学者日益, 闻道者日损. 损之又损, 以至于无为. 无为而无不为.

本版损去三处"盲信"谬设, 损去一处外部依赖. 从根本解决 179 笔记本"发消息回弹"真根.

### 真根定位 (179 场景)

1. 部署脚本 pre-install `restore-all-force` 清三层锚 → 三层空
2. v17.24 extension host 仍跑 → orphan proxy 仍在 :8889
3. 安装 v17.25 VSIX (仅落盘 · 不触 host)
4. 用户 Reload → v17.25 `init()` 载入 state={mode:off}, `_originPort=0`
5. `status()` 用 `_originPort || 8889` → 击中 orphan → 返 `{alive:true, mode:"invert"}`
6. `auto-ensure("invert")` → **ensure Branch 2** (alive + mode 同) → **立即返 · 不调 anchor** → 三层仍空
7. Windsurf Cascade 请求 → 默认走 cloud → **回弹**

附: wam.log `proxy alive on :0` 之古怪日志亦属此 bug 之副征 (status 不副作用更新 `_originPort`).

### 四损四得

**损 1 · 得 1 · orphan 盲信**:
  - 损: `init()` 对 `state=off` 而 `status=alive` 之矛盾现象盲从
  - 得: 强辨 orphan (state=off 却 alive · 或 state.pid ≠ alive.pid) · kill 全端口段 · reset off · 让后续走冷路径正常启 + 锚

**损 2 · 得 2 · "proxy 活即锚齐"谬设**:
  - 损: `ensure()` 热路径假设"alive 则锚齐" · Branch 2/3 跳过 `_origAnchorAll`
  - 得: 热路径 invert 目标必调 `_origAnchorAll` (幂等 · anchor.py op_anchor 已锚则直返) · 防外置清锚后回弹

**损 3 · 得 3 · 外部 Node 依赖**:
  - 损: `_origFindNode` 复杂扫描链 (Windsurf resDir / ../node.exe / PATH)
  - 得: 直用 `process.execPath` + `ELECTRON_RUN_AS_NODE=1` · Electron runtime 即 Node runtime · 一切 VSCode 即一切 Node · 适一切电脑一切用户零安装

**损 4 · 得 4 · 日志真相不一**:
  - 损: `status()` 无副作用洁癖 · 导致 `_originPort=0` 却显示 alive
  - 得: `init()` 真活分支同步 `_originPort = st.port` · 消"proxy alive on :0"古怪日志

### 改动摘要

| 位置 | 改动 |
|------|------|
| `@extension.js:400` | `WAM_VERSION = "17.26.0"` |
| `@extension.js:8666-8687` | `_origFindNode` 改用 `process.execPath` |
| `@extension.js:8810-8826` | spawn env 加 `ELECTRON_RUN_AS_NODE: "1"` |
| `@extension.js:8979-9030` | `OriginCtl.init` 强辨 orphan (state vs alive 矛盾即 kill) |
| `@extension.js:9077-9143` | `OriginCtl.ensure` 热路径亦强验三层锚 (invert) |

### 验收 (`@extension.js:wam.log`)

```
init: orphan proxy :8889 pid=XXXXX (state=off) → kill 全段   # 若前版本 orphan
boot sweep: restore-all-force · done (proxy dead)            # 锚清
boot auto-ensure: invert · 道法自然 · 用户无感                 # 启 invert
proxy up · pid=YYYYY port=8889 node=E:\Windsurf\Windsurf.exe # node= Electron 自身 (证损 4)
activate mode=invert port=8889 anchored=3/3                  # 三层锚齐
```

## v17.25.0 · 二相归一 · 道法自然 · 默认道Agent · 大音希声

### 用户态 (大道至简)

- **二相归一**: 用户视角**只存二态**: **道Agent** (invert) ↔ **官方Agent** (passthrough) · `off` 概念从用户层消失
- **默认道Agent**: 插件首装 + Reload 后**自动启道Agent**, 无需用户按 `Ctrl+Shift+P → 道Agent: 启`
- **尊重用户**: 用户首次主动选"官方Agent"后, 意愿持久化到 `origin_state.json.intent`, 后续启动**不再自启道Agent**
- **命令面板**: `道Agent: 关闭` 命令**移除** · 仅保留 `切道Agent` / `切官方Agent` 二命令

### 引入字段

| | | |
|---|---|---|
| `_userIntent` | `"invert" \| "passthrough" \| null` | 用户意愿 (持久) · 与运行时 `_origin` 正交 |
| `origin_state.json.intent` | 磁盘持久 | `_userIntent` 落盘 |
| `wam.origin.defaultMode` | `"invert" \| "passthrough"` | 首装默认 (默认 `"invert"`) · 可在 settings.json 改 |

### Boot 链硬化

- **init 异常不阻断后续流程**: `try/catch` + `_origin = "off"` fallback
- **Boot sweep 基于 proxy 真活性**: `await OriginCtl.status()` 断是否 `!alive` 才 sweep (不依赖内存字段)
- **Boot auto-ensure(invert)**: 条件 = `defaultMode === "invert"` && `_userIntent !== "passthrough"` && `_origin !== "invert"` && `dir 可寻`

### UI 改

- `origin-hint` 从 `"proxy 未启"` / `:{port}` 改为:
  - `invert` → `道Agent 注入 :{port}`
  - `passthrough` → `官方Agent 直通 :{port}`
  - `off` (瞬态) → `启动中…`

### 逆推报告

本版源于一次"反者道之动 · 逆流至根"的审视. 发现多个真根: 验证脚本盲视 secret 层 (`_deploy_179_v1724.ps1` 76-84), 孤儿 proxy (detached + unref), boot sweep 条件脆弱 (依赖 `_origin === "off"`), 实证 globalState 残锚 `http://127.0.0.1:8889/i` 导致 Cascade 弹回. 本版修核心逆向所得.

## v17.24.0 · 唯变所适 · 全量软编码 · 道法自然

### 底层重构 (一切硬编码 → 软编码)

- **Origin 端口**: `ORIGIN_DEFAULT_PORT=8889` / `ORIGIN_PORT_MAX=8999` → `_cfg("origin.defaultPort")` / `_cfg("origin.portMax")` · settings.json 可覆盖
- **Origin 绑定地址**: `127.0.0.1` → `_cfg("origin.bindHost")` · 完全可配
- **Origin 超时**: fetch/anchor/spawn 三套超时全 `_cfg` getter 化 · ops 可应急调参
- **Origin 上游域名**: `server.self-serve.windsurf.com` / `inference.codeium.com` → `_cfg("origin.upstreamMgmt")` / `_cfg("origin.upstreamInfer")` · 万一上游迁域名零改代码
- **源.js**: PORT / BIND_HOST / UPSTREAM_MGMT / UPSTREAM_INFER / CLOUD_PORT 全 env 可覆盖
- **锚.py / anchor.py**: DEFAULT_ANCHOR / DEFAULT_INFERENCE_ANCHOR / CLOUD_ORIGIN 全 env 可覆盖
- **spawn env 传递**: extension.js spawn 源.js 时注入 ORIGIN_BIND_HOST / ORIGIN_UPSTREAM_MGMT / ORIGIN_UPSTREAM_INFER

### 跨平台适配

- **`_origKillByPort`**: Windows→powershell, Linux/macOS→fuser/lsof 三级 fallback · 不再 Windows-only
- **`_origFindDir` 盘符发现**: 硬编码 `[E:,D:,C:,F:]` → `DriveInfo.GetDrives()` 动态获取 (Windows) / `["/"]` (Unix)

### package.json 新增配置项

| 项 | 默认值 | 说明 |
|---|---|---|
| `wam.origin.defaultPort` | 8889 | 起始端口 |
| `wam.origin.portMax` | 8999 | 端口上界 |
| `wam.origin.bindHost` | 127.0.0.1 | 绑定地址 |
| `wam.origin.spawnReadyRetries` | 15 | spawn 就绪轮次 |
| `wam.origin.anchorTimeout` | 15000 | 锚.py 超时 ms |
| `wam.origin.fetchTimeout` | 2000 | 控制面超时 ms |
| `wam.origin.upstreamMgmt` | server.self-serve.windsurf.com | 管理上游 |
| `wam.origin.upstreamInfer` | inference.codeium.com | 推理上游 |

## v17.23.0 · anchor.py ASCII 名防编码断裂

## v17.22.0 · 根本归一 · 逆流寻本源

### 救火 (Cascade 回弹根治)

- **根因**: "官方Agent" 按钮旧语义是 `OriginCtl.ensure("passthrough")` — 只切 proxy 模式, **不撤锚**. 用户以为回到原生, 但 secret/settings.json/globalState 三层本地锚 (`http://127.0.0.1:8889`) 仍在, Cascade 流量仍经 proxy → 上游 404 → 消息回弹
- **根治**: "官方Agent" 现调 `OriginCtl.deactivate()` — 三层锚尽撤 + 杀 proxy · 原生直通云端 · 零中间层

### 结构修 (永杜残锚)

- **`锚.py` 新增 `restore-all-force`**: 无备份亦能无条件扫三层 (secret / settings.json / globalState) 内一切 `127.0.0.1` / `localhost` 残锚. 幂等 · 安全 · 任何时刻可调用
- **extension.js 启动即扫**: `activate()` 内 `OriginCtl.init()` 后若见 proxy off, 异步调 `restore-all-force` — 用户崩溃/手动卸载留下的残锚永不再累积
- **`_origRestoreAll` + `deactivateSync` 亦加入兜底**: 任何撤锚操作末尾都再跑一次 `restore-all-force`, 三层尽净

### 可视 (本源日志加 X 光)

- **`源.js` 请求入口日志**: `#{rid} IN {METHOD} {URL} kind={CHAT_PROTO|CHAT_RAW|PASSTHROUGH} mode={invert|passthrough}` — Cascade 真实端点一目了然
- **上游响应日志**: `#{rid} UP {host} {METHOD} {path} → {status} ct={...} ce={...} http/{ver} {ms}ms` — "回弹"之由可追到字节
- **HTTP Trailer 转发**: gRPC/Connect-RPC `grpc-status` 等 trailer 完整透传, 不再吞
- **改写失败兜底**: `modifySPProto` / `modifyRawSP` 异常 · 结果空帧 · 结果 3x 以上膨胀 — 皆 fallback 透传原 body (宁可道不注, 不可字节烂)

### 对照表 (v17.21 → v17.22)

| 项 | v17.21 | v17.22 |
|---|---|---|
| 官方Agent 按钮 | `ensure("passthrough")` · 仅切 proxy 模式 · **锚仍在** | `deactivate()` · **撤三层锚 + 杀 proxy** · 真·原生直通 |
| 启动自净 | 无 | `boot sweep: restore-all-force · done` · 任何残锚一键去 |
| 命令 `restore-all-force` | 无 | 新增 · 幂等 · 无需备份 |
| proxy 请求日志 | `[SP-PLAIN] msg[0] field=N before=xB` 单一 | `IN {METHOD} {URL} kind= mode=` + `UP {host} ... → {status} ct= ce= http/` 完整 |
| 改写失败处理 | 抛 500 / 回 JSON err | fallback passthrough 原 body |
| HTTP trailer | 不转发 | 转发 `grpc-status` 等 |

---

## v17.21.0 · 二核合一 · 道法自然

### 道Agent (为核)

- **四键一行 UI**: `⚡ WAM切号 | 🔑 官方登录 | ☯ 道Agent | ○ 官方Agent` — 账号轴 `|` Agent 轴
- **热切 1-3ms**: `OriginCtl.ensure(mode)` 分冷热路径 · 运行态切模式纯 HTTP POST · 进程复用 · 无 Reload Window
- **16 侧信道标记**: rules / skills / workflows / memories / memory_system / MEMORY[ / ide_metadata / communication_style / tool_calling / making_code_changes / running_commands / user_rules / user_information / workspace_information / Bug fixing discipline / Long-horizon workflow / Planning cadence — 任一命中整 SP 置换
- **三路径 invertSP**: plain utf-8 · nested chat_message · raw_sp field 3 — 皆归于德道经
- **自证**: `GET /origin/selftest` 返 `all_paths_pass` + `leaked_markers[]` + `leaked_count` 三路径摘要

### 切号 (为器)

- 项目更名 `windsurf-login-helper` → `windsurf-assistant`, VSIX 同步
- 扁平化: `wam-bundle/*` → 根
- `bundled-origin/` 进 VSIX (源.js + 锚.py + 德道经 + VERSION) · 首次 ☯ 道Agent 自解压到 `~/.wam-hot/origin/`

### 持久无感

- 过往所有 `WAM:` 命令名皆 `切号:` / `道Agent:` / `Windsurf Assistant:` 三分
- 老用户 command ID 不变 (`wam.*` 保留), 仅 UI 文案演化

---

历史变更见 [git tags](https://github.com/zhouyoukang/windsurf-assistant/tags) 与 [Releases](https://github.com/zhouyoukang/windsurf-assistant/releases).

---

*功成事遂, 百姓皆谓我自然.*
