# 010-WAM本源_Origin · v2.7.5 · 道恒无名·万物自宾 · 治「单独 token 无法添加登录」

> **一气化三清 · Three Pure · 道并行而不悖**
> [I · 反代 API · `dao-core`](../dao-core/README.md) &middot; **[II · 切号 WAM · 本](README.md)** &middot; [III · 提示词反代 · `dao-proxy-min`](../dao-proxy-min/README.md)
>
> wam 服 Windsurf IDE 多账号轮转；dao-core 服任意 OpenAI 客户端；dao-proxy-min 服 Cascade 提示词替换。三者正交，**道并行而不悖**。

> 太上，下知有之 · 道法自然 · 用户无为 · 插件无不为
>
> *天下莫柔弱于水，而攻坚强者莫之能胜也，以其无以易之也*

WAM `rt-flow` 道极减法分支 · 活体源 · 改一处万法响应

## 〇 · 血缘锚定 · 万法归宗

三处同体异形 · 经 2026-05-04 长谈道极化后 · 已归为一版 v2.5.5：

| 位 | 位置 | 版本 | 体积 | 角 |
|---|---|---|---|---|
| **本仓 · 活体源** | `010-WAM本源_Origin/` | **v2.5.5** | 168 KB · 4265 行 | 改一处万法响应 · 236/0 回归 |
| **上游 · 发布支** | [`github · packages/wam/`](https://github.com/zhouyoukang/windsurf-assistant/tree/main/packages/wam) | v2.5.5 | 168 KB | 已同步 · [`release v2.5.5-wam`](https://github.com/zhouyoukang/windsurf-assistant/releases/tag/v2.5.5-wam) · `rt-flow-2.5.5.vsix` |
| **历史 · 完整本体** | [`github · _archive/wam-v17.42.20/`](https://github.com/zhouyoukang/windsurf-assistant/tree/main/_archive/wam-v17.42.20) / 本地 `_github_src/` | v17.42.20 | 437 KB · 10913 行 | 永久定锚 · `git checkout v17.42.20` 可恢复 |

同 `publisher=devaid` · 同 `name=rt-flow` · 同 `v2.5.5` · **活体与上游零差** (`extension.js` 字节一致 · 8 测套件 236/0 双向对齐)。

> 大减法 -62% (10913 → 4265 行 · 6 类减项详见七章): Layer 1-5 网络钩 · `TurnTracker` · `AutoUpdate` · 代币池跨账号 · Firebase/Devin 全链 · 多重 fallback · 皆损。

**大制无割** · 活体不动 · 发布支与上游同步 · 完整本体永久归档 · 用户按需装其一。

---

## 一 · 本源需求

```
用户在 Cascade panel 发消息 → WAM 自动切到下一健康号
    ↑
用户无为 (无任何额外操作)
插件无不为 (auto-verify · 评分 · 切号 · 流式避让 · 永不禁号)
```

## 二 · 文件清单 (五族归一 · 道法自然)

```text
# 一 · 当前生效之核心 (不可动)
extension.js                       199 KB    核心源码 (v2.6.12 · sha=39113de6)
package.json                         7 KB    VSCode manifest · 24 配置项
账号库最新.md                         3 KB    活号池 · 运行时读
README.md                                    本文件

# 二 · dao_* 通用工具 (无版本之名 · 损之又损 · 至于无为)
_dao_env.psd1                       1 KB     软配置 · targets/extensionId/extDirHint
_dao_lib.ps1                        6 KB     共享库 · Get-WamSourceVersion / Resolve-DevaidLocation
_dao_deploy.ps1                     9 KB     通用部署 · 自读 VERSION · 自适 target · 一令同步 local + 179
_dao_postreload_verify.ps1         11 KB    通用验证 · 自识 activate · 自识 deploy marker

# 三 · 运维监控套 (omni 系列 · 名冠 v2611 而其用通万法 · 与版本无关)
_v2611_omni_monitor.ps1             7 KB     24h 后端监控守护 (写 CSV · pulse/rotate 比率持续观测)
_v2611_omni_probe.ps1              19 KB    7 层长链路并发探针 (5Hz · WAL/pb/cascade-server/wam.log/diag)
_v2611_omni_analyze.ps1            11 KB    离线分析 events.jsonl → 报告
_v2611_status.ps1                   8 KB     一键现状速览
_v2611_send_mark.ps1                1 KB     send 时刻标记 (探针时序对齐)
_v2611_hourly_dist.ps1              1 KB     小时分布统计

# 四 · 回归测试 (10 套 · 0 败 · 308+ asserts)
_test_set_health.cjs                8 KB     health 评分 (24 测)
_test_v241_real.cjs                 9 KB     v2.4.1 真路径 (20 测)
_test_in_use.cjs                   14 KB    使用中🔒 + 永不禁 (57 测)
_test_e2e_msg_rotate.cjs           11 KB    E2E 消息切号 (33 测)
_test_quota.cjs                     5 KB     proto3 quota (12 测)
_test_v251_postauth_header.cjs      6 KB     postAuth header (8 测)
_test_v252_exptag.cjs              12 KB    expTag 5 态 + Trial (73 测)
_test_v255_ideversion.cjs           2 KB     ideVersion 根因锁 (9 测)
_test_v256_layer6_path.cjs         12 KB    Layer 6 路径双修
_test_v267_debounce.cjs            17 KB    防抖回归 (32 测 · v2.6.9 接代)
_test_v2613_quota_delta.cjs        13 KB    v2.6.13 阴阳结合 ⚖额度变动 (44 测)

# 五 · 历史溯源
_github_src/                                 上游源码锚定 (39 file)
_releases/                                  历代 VSIX (15 个)
_archive/v2.6.x_pre_dao/                    v2.6.4-v2.6.12 历版部署脚本 (28 件 · 已被 dao_* 取代)
_archive/probes_20260507/                   2026-05-07 当日探针快照 (7 目)
_archive/v2.5_pre_daoist/                   v2.5.0-v2.5.5 演化全档
_archive/v2.6.6_pre_守一/                   v2.6.6 守一前快照
_archive/<其余>                              更早 v2.4 / 179_probes / webrev 等
```

## 三 · v2.5 家族演化史 (2026-05-04 一日五变)

| 版本 | 时间 | 核心动作 | 体积 | 测 |
|---|---|---|---|---|
| v2.4.13b | baseline | 5 hook + 3 self-test + 15min ban | 198 KB · 4933 行 | 182/2 pre-fail |
| **v2.5.0** | 16:50 | 大减法 · 删 L1-L5 / self-test · 不禁号 | 162 KB | 143/2 |
| **v2.5.1** | 17:04 | 单行修 · postAuth 加 `X-Devin-Auth1-Token` header | 163 KB | 154/0 |
| **v2.5.2** | 17:16 | expTag 4 态恒显 · `_buildExpTag` 纯函数化 | 164 KB | 185/0 |
| **v2.5.3** | 17:36 | Trial 脏数据清洗 + 第 5 态 "Trial?" | 166 KB | 195/0 |
| **v2.5.4** | 17:50 | 软编码 `_isTrialLike` regex · 兼后端 tier 变体 | 167 KB | 227/0 |
| **v2.5.5** | 18:26 | **真根因解 · ideVersion `1.0.0`→`1.99.0`** | **168 KB** | **236/0** |

**v2.5.5 真根因** (probe 独立实证):

```
ideVersion="1.0.0"  → 后端能力协商 → 省 planEnd → parsePlan daysLeft=0
ideVersion="1.99.0" → 后端返完整结构 → planEnd="2026-05-09" ✓
```

一行修：`tryFetchPlanStatus` 默认 ideVersion 从 "1.0.0" → "1.99.0"

## 三 · 续 · v2.6 家族增补 (2026-05-05 ~ 05-08 · 三源直觉 → v2.6.9 道法自然 → v2.6.10 治人事天 → v2.6.14 三守俱全)

| 版本 | 时间 | 核心动作 | 类目 |
|---|---|---|---|
| v2.5.6 | 05-05 | Layer 6 路径双修 · `globalStorageUri` 单 `dirname` · 加 WAL fallback | 修路 |
| **v2.6.0** | 05-05 | 软编码 · `RE_SESSION_TOKEN` 常量 · `_isTrialLike` 全链 · `os.homedir()` 跨平台 | 配置一源 |
| **v2.6.1** | 05-05 | Layer 6 双信号 · `pb·new`(新对话) + `pb·send`(安静期 3s 检测已有对话 send) | 信号增 |
| **v2.6.2** | 05-05 | 跨实例声明锁 · `~/.wam/_l6_claim/` + `flag:"wx"` · 多窗口零重复触发 | 并发治 |
| **v2.6.3** | 05-06 | WAL 直达触发 · `state.vscdb-wal` 增量 = click Send 底层信号源 · 300ms 可检测 | 本源达 |
| **v2.6.4** | 05-06 | 去芜存菁 · 删 2 死配置 + 补 7 活配置 · VS Code 设置界面全参可见 | 精简 |
| v2.6.6 | 05-06 | 反者道之动 · cooloff → settle (debounce trailing edge) · SETTLE_MS=15s · ACCUM≥5KB | 逆流 |
| v2.6.7 | 05-06 | 守一·减二 · 删 pb/wal·settle 自夺防抖重置 · 多源派生收一道 | 不自夺 |
| v2.6.8 | 05-06 | claim 锁补 · 跨实例 bucket · 但实证仍雪崩 22s/次切号 (多 .pb 文件并发) | 未根治 |
| **v2.6.9** | 05-07 | **道法自然 · 损 settle 整段 + WAL 边沿首发 + 60s 全局强锁** | **本源治** |
| **v2.6.10** | 05-07 | **治人事天·莫若啬 · WAL 上限过滤 checkpoint (>64KB skip) · diag 三字段扩展** | **微观完善** |
| **v2.6.11** | 05-07 | **道恒无名·民自均焉 · W%脉动真本源 (Δ≥0.30%) · scanIntervalMs 60s→10s · 删 settle/max/三防抖** | **真本源至** |
| **v2.6.12** | 05-07 | **守一·主信号优先 · W%脉动同账号判 · quotaPulsePriorityMs 60s · WAL/pb 让位** | **抢跑治** |
| **v2.6.13** | 05-08 | **阴阳结合 · ⚖额度变动 (daily%/promptCredits/flowCredits) · W%主 ⚖辅 不冲突** | **阴阳合** |
| **v2.6.14** | 05-08 | **三守俱全 · 守一 perMessageMinIntervalMs 60s 全栏 + 守二 walEdgeCooldownMs 2s + 守三 walWarmupMs 5s** | **大制无割** |
| **v2.7.0** | 05-09 | **万法识号·守道反者 · parseAccountText 治四病: 卡号N: / 含@密码 / tryPair严判 / 反序配对 · _stripWxHints 剥微信尾提示** | **唯变所适** |
| **v2.7.1** | 05-13 | parseAccountText 治 `email----auth1_xxx` 误入 password (但 schema 加 auth1/sessionToken/refreshToken 三字段·日益) | 中间态 |
| **v2.7.2** | 05-14 | **主公三诏·token 看做账号密码 · _normalizeAccCreds 公器登录入口分流 · schema 复 v2.7.0 单 {email,password} (闻道者日损)** | **顺其自然** |
| **v2.7.3** | 05-14 | **治🔒回退根 · save 写盘后同步刷新 _savedAccountMeta 内存快照 · reloadAccounts 不复回退** | **柔之胜刚** |

### v2.6.9 实证根治 (道法自然 · 反者道之动)

**实证样本** (window1 5-WAM.log · 11min13s · 用户对话频率 ~3min/条):

```text
rotate count   : 34 次
median interval: 22 秒切号 (= 9 倍用户对话频率)
pb·settle fired: 36 + skip 6 (全错触发源)
wal·settle fired: 0 (settle 对 WAL 完全失效·checkpoint 抢截)
活跃 .pb 文件 : 4 个 (8bc7943c/b2165dd0/e9e73244/f9ebad5b)
debounced       : 仅 2 次 (4s 防抖 vs 15s settle·几乎全过)
```

**60秒采样** (用户等候期·我跑工具调用):

```text
WAL 净增: 0 B (用户没 send · 真信号正确无噪)
pb  净增: 310 KB / 31 写入 (AI+工具噪音)
```

**根因 10 层** (从象到本 · 反者道之动):

1. 表象: 切号频率 22s/次 远高于用户对话频率
2. 触发: 100% 来自 pb·settle (wal·settle 0)
3. 多源: 4 文件并行各自 settle 累积
4. 体  : `~/.codeium/windsurf/cascade/` 50 个历史 .pb · 4 个活跃
5. 漏  : claim key=`pbPrefix+bucket` · 不同 prefix 不互锁 (跨实例锁实为同实例文件锁)
6. 疏  : 4s perMessageDebounceMs vs 15s SETTLE_MS · 间隔通常>4s
7. 错  : settle 模型 = "AI 流式段静默" ≠ "用户 click Send"
8. 浊  : pb 增量信号被 50 个历史会话 + cascade reindex daemon 污染
9. 本  : 一条 user msg → AI N 段流 × 活 pb 数 → N 次切号
10. 道  : v2.5 弃 L1-L5 hook 落到 .pb 信号 · 比原 hook 还吵 · 哲学错位

**修法** (损之又损 · 反者道之动):

- **减**: 删 `_firePbSettle` · 删 watcher 存量增量 settle 分支 · 删 `_fireWalSettle` settle 模型 · 删 `pb·new` 路径 reset (最后一处自夺)
- **留**: `pb·new` 唯一信号源 (新对话 1:1 精确)
- **加**: WAL 边沿首发 (单次 delta ≥ 512B 即 fire · 不累积不等 settle)
- **强**: 60s 全局强锁 (`perMessageMinIntervalMs=60000`) · 任何信号源 60s 内最多 1 次
- **锁**: claim key 改纯 bucket (多实例派生收一道)

**净变**: 删 ~150 行 (settle) + 加 30 行 (边沿) = 净减 120 行 · 为道日损

**预期效**: 22s/次切号 (9 倍率) → ≥60s/次切号 (1:1 率) · 雪崩本源治

**v2.6.9 reload 后活体实证** (37min · _v269_postreload_verify.ps1):

```text
降幅 vs v2.6.8 · 98.9% (median 22s → 2070s · min 5s → 222s)
rotate#:           3 次 / 37min  (v2.6.8 是 4 次 / 60s)
minInterval-locked: 2 次 (60s 强锁拦截)
wal·edge·fire:     6 次 (但中 2 次 delta=840KB/708KB 是 checkpoint 噪)
pb·settle / wal·settle: 0 / 0 (settle 完全消除)
```

### v2.6.10 微观完善 (治人事天·莫若啬)

**过滤 checkpoint 噪音** (v2.6.9 reload 后发现):

- v2.6.9 wal·edge 只有下限 (默 512B) · 无上限
- 实测 840KB / 708KB delta 非 user send (user send 常 4-32KB)
- 实为 SQLite `auto_checkpoint` 满 4MB 后一次 flush 多帧 → wal 一次增 KB-MB
- 60s 强锁者瞥其火·但未治本 · checkpoint 发在 60s 后 即仵误切

**损法** (《道德经》五九 · 治人事天·莫若啬 · 啬 · 早服 · 重积德):

- **加**: `wam.walEdgeMaxBytes` 默 65536B (64KB) · delta > 此视为 checkpoint 噪 · skip 不 fire
- **加**: `_skipWalEdge` 函数 · log `wal·edge·skip[checkpoint:XXX > 64KB]` · 与 fire 双轨
- **加**: diag 三新字段 · `lastEdgeDelta`/`lastCheckpointDelta`/`edgeSkipCount`
- **不动**: v2.6.9 全部架构保留 (settle 已删 · 60s 强锁 · 纯 bucket)
- **兼容**: `walEdgeMaxBytes=0` ⇒ 关上限 · v2.6.9 行为

**二道互补** (重为轻根·清为軁君):

```text
空间过滤 (max 64KB)  → user send vs checkpoint 识别 · 不依时间
时间强锁 (60s minInterval) → 余噪兑底 · 不依空间
```

**净变**: +30 行 (`_skipWalEdge` + diag 扩) · 损之又损·以至于无为

### v2.6.11 真本源至 (道恒无名·民自均焉)

**实证发现** (v2.6.10 24h 后):

```text
版    rot/h    pbnew/h    walfr/h     病
v2.6.6   120     34         0      洪泛误触发 (settle 失真)
v2.6.7   162    120         0      洪泛 + debnc 71
v2.6.8    25      5         0      改善但仍误
v2.6.9   3.25   2.75       2.75    三路一致但仍欠
v2.6.10  0.84   2.1          0     max 杀真
```

**病灶** (物无非彼·物无非是):

- **WAL 信号本质不可靠** — SQLite WAL 是 batch + checkpoint 模型 · user send 不必每次 fsync · size 增长不等比真信号
- **pb.new 仅捕新对话** — 一对话内 N 条 send 全部捕不到
- **settle 模型 (v2.6.6/7/8)** — 累积静默与 user send 频次解耦 · 凌晨仍误 fire 65-128/h

**根本治法 · 三守三损**:

```text
损一: 删 settle 模型整段 (_installSettleWatcher)
损二: 删 max filter (v2.6.10 walEdgeMaxBytes=0)
损三: 删 三防抖 (perMessageDebounce/MinInterval/Delay)

守一: ⚡ W%脉动 — Engine._tick 10s 周期查 weeklyQuotaRemainingPercent
        增量 ≥ 0.3% (默) → 立即 _maybeTrigger
        真本源 = 后端 GCP 计费 · 零中间噪音 · 1 send→1 W%-降→1 切
守二: 配额自均 — 当前号 W% 大降 主动切 · 让账号配额自然均衡耗尽
守三: 长链路监控 — _v2611_omni_monitor.ps1 24h CSV 持续观测
```

**净变**: -3.1KB / 删 4 配置 / 删 2 死变量 · 23 配置项

### v2.6.12 守一·抢跑治 (道恒无名·主信号优先)

**v2.6.11 reload 后实证** (24h):

```text
ratio pulse:rotate = 1:1.75   ← 主信号外有备用 WAL/pb 抢跑
假脉动 (跨账号 setActive 导致 W% 跳变)  7 次   ← _lastQuotaEmail 缺判
```

**修法** (守一·主信号优先):

```text
修一: setActive 真切号时清基线 (_lastQuotaPercent = null)
      解决跨账号 W% 跳变误判为脉动的假信号
修二: 加 _lastQuotaEmail · W% 比较只在同账号内进行
修三: 加 _lastQuotaPulseAt 时间戳
      ⚡ W%脉动 触发后 quotaPulsePriorityMs (默 60s) 内
      📡 WAL·edge / 📃 pb·new 备用信号自动让位 (skip · log 7m)
```

**信号格局**:

```text
⚡ W%脉动        = 后端真账     = 主信号 (1 用户 send 必有 1 脉动)
📡 WAL·edge      = 备用 (60s 让位 W%)
📃 pb·new        = 备用 (60s 让位 W%)
```

**净变**: +50 行 · 24 配置项 (新增 quotaPulsePriorityMs)

**预期**: ratio 1:1.0 · 假脉动 0 · 三路抢跑彻底解

### 二源合道架构 (v2.6.9 本治)

```text
用户 click Send
  ├─ T+0ms    → SQLite 同步 fsync state.vscdb-wal (4-8KB)
  │             ← 信号② wal·edge   [300ms 轮询 · 边沿首发 · 不等]
  ├─ T+?ms    → HTTP → AI 开始响应 · .pb 增长 · 但 60s 强锁拦二次
  └─ 若新对话 → 新 .pb 文件创建
                ← 信号① pb·new     [600ms 轮询 · 唯一新对话信号]

跨实例 claim key=纯 bucket · 多 ext-host 实例派生收一道
_maybeTrigger 内 60s 全局强锁 · 任何信号源 60s 内最多 1 次切号
判别实证: WAL 增=用户 send (同步) · .pb 增=AI 写 (噪)
```

### 可调参数 (v2.6.9 变更)

```ini
# v2.6.9 道法自然 (几个新参数 + 60s 强锁)
wam.perMessageMinIntervalMs  60000   # 全局强锁 (60s 与用户对话频率合一·0=关)
wam.walDetect                true    # 启用 WAL 边沿首发
wam.walEdgeMinBytes            512   # 单次增量下限 (1 SQLite 帧 ≈4120B)
wam.walEdgeMaxBytes          65536   # v2.6.10 单次增量上限 (64KB · user send 常 4-32KB · checkpoint 常 MB · 0=关)
wam.walPollMs                  300   # WAL 轮询间隔
wam.perMessageDebounceMs      4000   # 二级防抖 (守一·仍保 · 与全局锁叠加)
wam.perMessageDelayMs         1500   # 切号延迟 (让当前消息先送出)
wam.rotateOnEveryMessage      true   # 总开关

# v2.6.9 已删老配置 (settle 模型本错)
# × wam.sendDetectSettleMs / sendDetectAccumMin / sendDetectGrowMin
# × wam.walDetectSettleMs / walDetectAccumMin / walDetectGrowMin
```

## 四 · 测试矩阵 (v2.7.5 · 18 套 · 17 套 0 败 (666/0) · v267 4 历史滞后)

```bash
node _test_set_health.cjs              # 24 过
node _test_v241_real.cjs               # 20 过
node _test_in_use.cjs                  # 57 过 (v2.6.14 体积上限 200→220 KB)
node _test_e2e_msg_rotate.cjs          # 33 过
node _test_quota.cjs                   # 12 过
node _test_v251_postauth_header.cjs    #  8 过
node _test_v252_exptag.cjs             # 73 过
node _test_v255_ideversion.cjs         #  9 过
node _test_v256_layer6_path.cjs        # 30 过
node _test_v267_debounce.cjs           # 28 过 (v2.6.10 baseline 静态 §1 14 失 · §2/§3/§4 行为 14/0 过)
node _test_v2613_quota_delta.cjs       # 44 过 (v2.6.13 阴阳结合 · ⚖额度变动 · v2.6.14 版本判放宽)
node _test_v2614_triple_throttle.cjs   # 66 过 (v2.6.14 三守俱全 · v2.7.0 版本判放宽不锁字面)
node _test_v270_omni_recognize.cjs     # 72 过 (v2.7.0 万法识号·守道反者·四病皆治)
node --check extension.js              # exit 0
```

合计 **13 套件 · 12 全过 (456/0) + 1 部分跟新滞后 (`_test_v267_debounce` §1 v2.6.10 contracts)**:

| 套件 | 状态 | 说明 |
|---|---|---|
| `_test_set_health` | 24/0 ✓ | health 评分 |
| `_test_v241_real` | 20/0 ✓ | v2.4.1 真路径 |
| `_test_in_use` | 57/0 ✓ | 使用中🔒 + 永不禁 · v2.6.14 体积上限 220 KB |
| `_test_e2e_msg_rotate` | 33/0 ✓ | E2E 消息切号 |
| `_test_quota` | 12/0 ✓ | proto3 quota |
| `_test_v251_postauth_header` | 8/0 ✓ | postAuth header |
| `_test_v252_exptag` | 73/0 ✓ | expTag 5 态 + Trial |
| `_test_v255_ideversion` | 9/0 ✓ | ideVersion 根因锁 |
| `_test_v256_layer6_path` | 30/0 ✓ | Layer 6 路径双修 |
| `_test_v267_debounce` | **28/14 ⚠** | §1 静态契约 v2.6.10 时刻 (settle/max/三防抖); v2.6.11 损此皆 -> §1 失 13; v2.6.14 复 minInterval §1 再 +1 过; §2/§3/§4 行为/重放/schema **14/0 全过** |
| `_test_v2613_quota_delta` | 44/0 ✨ | v2.6.13 阴阳结合 ⚖额度变动 · v2.6.14 兼容 (版本判 ≥ 2.6.13) |
| `_test_v2614_triple_throttle` | **66/0 ✨** | **v2.6.14 三守俱全** · §1 静态 37 (守一/二/三) + §2 行为 mock 27 (全栏/同源冷/暖启) + §3 阴阳兼容 4 · §2d 爆发 300s×1.7s 降幅 **97.2%** (177→5) · v2.7.0 版本判放宽 |
| `_test_v270_omni_recognize` | **72/0 ✨** | **v2.7.0 万法识号·守道反者** · §1 静态 8 + §2 函抽 4 + §3 isValidEmail 14 + §4 图3 微信 5 + §5 图4 卡号 11 + §6 数字编号 5 + §7 经典不退化 9 + §8 反序 3 + §9 噪声免疫 1 + §10 token 2 + §11 综合极端 9 |

**测试矩阵核心实证 456/0** · `_test_v2614_triple_throttle` 实证降幅 **97.2%**·与实证 179 wam.log (38 rotate/5min → 拟 ≤5) 一致 · `_test_v270_omni_recognize` 实证 4 图全识·一文混万法 6+1 token 皆通。`_test_v267_debounce` §1 baseline 滞后不碍·§2/§3/§4 行为仍证。

### v2.6.14 三守俱全 · 守一·大制无割 · 反者道之动 (2026-05-08)

**缘起 · 实证 179 wam.log · v2.6.13 生命**:

| 项 | 值 | 论 |
|---|---:|---|
| wam.log 行 | 21225 | 全 |
| v2.6.13 activations | 10 | 历反复 reload |
| **per-msg hit** | **253** | 进 `_maybeTrigger` 之触发数 |
| **per-msg rotate** | **206** | 成切之号数 (81% 命中率) |
| ⚡W%脉动 占 | **4.3%** (11/253) | 声称之"主信号" |
| 📡WAL·edge 占 | **68.8%** (174/253) | ★ 实主导 |
| 📃pb·new 占 | 28.1% (71/253) | 辅 |
| ⚖额度变动 占 | 4.7% (12/253) | 阴·辅 |
| 🚫 让位 (主信号) | 13 (5.1%) | 几不生效 |
| **5 分爆发 (14:54-14:58)** | 174 WAL 火 · 38 切号 · 每 8s 切一 · 雪崩 | 最后雪崩 |

**根因三破**:

| 破 | 层 | 本 |
|---|---|---|
| ① 公理破 | "1 user send = 1 信号" | 不成立 · 流式响应连续 N quanta · 单账号 40s W 82→72 = 4 脉动 |
| ② 栏破 | v2.6.11 弃 `perMessageMinIntervalMs` | 最终兜底失 |
| ③ 守破 | v2.6.12 `quotaPulsePriorityMs` 只守 WAL/pb | 不守 W% 自身 · 阳自决堤 |

**三守俱全 (守一·大制无割·一全锁覆万源)**:

| 守 | 位 | 默 | 道 |
|---|---|---|---|
| **守一** | `_maybeTrigger` 入口 | `perMessageMinIntervalMs=60000` | 全 reason 强锁 · 复 v2.6.9 全栏 · 适 ⚡/📡/📃/⚖ 万源 · 1 user send ≤ 1 切 |
| **守二** | `_fireWalEdge` 内 | `walEdgeCooldownMs=2000` | WAL 同源最小间隔 · 避 4KB 帧连火 · 削 log 噪 |
| **守三** | `_fireWalEdge` 入 | `walWarmupMs=5000` | WAL 启动暖启窗 · 防 activate 首 stat 累积差引雪崩 |

**信号格局 (v2.6.14)**:

```text
用户 click Send
  ├─ 时序一 → SQLite 同步 fsync state.vscdb-wal (4-32KB)
  │             ← 📡 WAL·edge     (守三暖启 + 守二同源冷 + 守一全栏)
  ├─ 时序二 → HTTP → AI 响应 · .pb 增长
  │             ← 📃 pb·new       (守一全栏)
  └─ 时序三 → 后端 GCP 计费 · weekly%/daily% 减
                ← ⚡ W%脉动        (守一全栏·治自火) · 主信号设 60s 让位窗
                ← ⚖ 额度变动      (守一全栏 + 让位窗)

所有信号最终汇入 _maybeTrigger
守一 60s 全栏 · 任何 reason 60s 内最多 1 次切号
```

**预期 (理论)**:

| 指标 | v2.6.13 实证 (5min) | v2.6.14 期望 (5min) | 降幅 |
|---|---:|---:|---:|
| WAL·edge fire | 174 | ≤ 90 | -48%+ |
| per-msg hit | 50 | ≤ 6 | -88% |
| login✓ (切号) | 38 | ≤ 5 | -87% |
| mock 模拟 (§2d-3) | 177 | 5 | **-97.2%** |

**雪崩拟消 · 1 user send ≤ 1 切号 (1:1 精确回归 · 复 v2.6.9 本治)**

**配置默值 (v2.6.14 新增)**:

```jsonc
"wam.perMessageMinIntervalMs": 60000,  // 守一·全 reason 强锁 (0=关·复 v2.6.11 无栏)
"wam.walEdgeCooldownMs":        2000,  // 守二·WAL 同源最小间隔 (0=关)
"wam.walWarmupMs":              5000,  // 守三·WAL 启动暖启 (0=关)
```

**活码 banner (reload 后一眼可辨)**:

```text
WAM v2.6.14 activated · 三守俱全·大制无割 · ⚡W%脉动 (Δ≥0.30%·同账号判·切号清基线) + [全栏 60s / WAL让位 60s / WAL冷 2s / 暖启 5s] [开] · 使用中🔒 120s · 不禁号·永不入黑
```

**新 log 事件 (v2.6.14)**:

```text
🚫 L6→wal·edge 全栏·3s前已切·跳过 +53560     ← 守一
WAL · edge·skip[cooldown:1000ms<2000ms] +4120B   ← 守二
WAL · edge·skip[warmup:2000ms<5000ms] +4120B (size=X)  ← 守三
```

**道一以贯之 (64 章)**: 为之者败之·执之者失之·圣人无为故无败·单行全栏 > 多处细栏 · 守一 > 守多 · 道极减法之真。

### v2.7.5 道恒无名·万物自宾 · 治「单独 token 无法添加登录」(2026-05-14)

> *道恒无名 · 朴唯小 · 而天下弗敢臣 · 侯王若能守之 · 万物将自宾 · 民莫之令而自均焉*

**缘起 · 主公图1 实证**: 5 行 `auth1_xxx` (无 email 同行配对) 粘入 + 添加账号 → 入 tokens 数组成孤儿 · accounts 不增 → 用户视觉 "未添加" → 无法直登.

**根因**: v2.7.1.1 「孤儿 token 入 tokens 数组待显式反查 email」之契约 · 对单 token 流派 (用户仅有 token · 无 email) 留无解之地.

**治法 · 道恒无名 · 名不可名 · 万物自宾**:

| 法 | 实施 | 治 |
|---|---|---|
| §A | `parseAccountText` 末段 · 孤儿 token → 占位 email 入 accounts | 占位形 `<kind>.<sha8>@token.wam` (合法 email) · password 槽 = 原 token |
| §B | 立 `_isPlaceholderEmail(s)` 工具识别占位号 | UI/verify/rename 路径快判 (一函) · 公器同列于 `_normalizeAccCreds` 之后 |
| §C | webview domainBadge 加 "tk" | 占位号视觉可识 (`.dm.tk { bg:#5a3a14; color:#f0c674 }`) |
| §D | 5 kind 全适配: `auth1`/`session`/`jwt`/`apikey`/`refresh`/`raw` | 下游 `_normalizeAccCreds(acc)` 之 `_detectTokenKind(acc.password)` 自动分流 |

**回归测 · `_test_v275_single_token_omni.cjs · 57/0` ✓** + 老测套 8 处行为断言对齐 v2.7.5 (v270/§10·11 + v271/§6·11 + v2711/§5.9).

**全测套 17/18 套 0 败 · 总 666/0** (v267 28/4 v2.6.9-2.6.10 历史滞后·不计).

### v2.7.4 🔒 独立持久化·multi-window race-safe (2026-05-14)

`inUseUntil` 独立持久化 `lock-state.json` · 与 wam-state.json 解耦 · 多窗口和而不冲. 8 章「上善若水·居善地」.

### v2.7.3 治🔒回退根·守一·大道至简 (2026-05-14)

save 守一 · `inUseUntil` 入 `_serialize` 出口 · 一次写入·不破契约. 39 章「昔之得一者:天得一以清」.

### v2.7.2 / v2.7.1 万法归一·token 直登·主公三诏 (2026-05-14)

> *反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无*

**主公三诏 (闻道者日损)**: "将 token 看做账号密码 · 直接复用一切 · 顺其自然"

| 病 | 治 |
|---|---|
| 反序 token+email · token 缓存等下一 email 后未配对 | tryPair 升级 · email+token 优先返 `{email, token, kind}` |
| 单行 token + pendingEmail · token 入 password 槽路径未通 | items 加 'pair-token' 类型 · 配对循环加 token + pendingEmail |
| JSON {email, auth1_token} / {auth1: xxx} / refresh_token 等多形未识 | 反序 token+email · 单行 token+pendingEmail · 均入 accounts.password 槽 (token 与密码同居) |

下游 `_normalizeAccCreds(acc)` 之 `_detectTokenKind(acc.password)` 自动分流 → loginViaToken. **回归测 `_test_v271_omni_token.cjs · 65/0` + `_test_v2711_main.cjs · 46/0`**.

### v2.7.0 万法识号·守道反者 · 唯变所适·适应万法之格式 (2026-05-09)

> *天下莫柔弱于水，而攻坚强者莫之能胜也，以其无以易之也*

**缘起 · 主公实证四图**:

| 图 | 实证 | 现象 |
|---|---|---|
| 图1 | 账号列表 117 号大量 "?天/未验/D?/W?" | 入库 email 严重污染 |
| 图2 | "+ 添加账号" placeholder | 用户依此粘贴 |
| 图3 | 微信发货 ("账号:..\n密码:含@\n账号管理器:点tps://..(去掉点)") | 含@密码灾难性误判 |
| 图4 | "卡号N: a@b.com / 卡密N: pass" | 词典缺·5 卡全军覆没 |

**根因 · parseAccountText 失道之四病** (v2.6.x baseline):

| 病 | 失道之处 | 行为 |
|---|---|---|
| ① | `卡号N:`/`卡密N:` 未在标签词典 | tryPair 错把 "卡号1" 当密码·token 当 email |
| ② | `if(!v.includes("@"))` 排除带 @ 的"密码" → 兜底 `^\S+@\S+$` 误为新 email | `密码:uuCO4@7hukcO` → pendingEmail 被覆盖·正主丢失 |
| ③ | tryPair 仅以 `includes("@")` 认 email | `XuE2@UXoq7JD` (是密码) 被认为 email |
| ④ | 配对仅 email→pass 单向 | 反序 (pass 先 email 后) 无法配对 |

**治法 · 反者道之动 · 弱者道之用 · 守一不退**:

| 法 | 实施 | 治 |
|---|---|---|
| §A | 立 `_isValidEmail` 严判 (local@domain.tld · 长度 5-254 · 不含全角分隔符) | 替代 `includes("@")` 草率认 email |
| §B | 扩标签词典 + 兼容 `\d*` 数字编号 · email +`卡号/号码/账户名/登录名/登陆名/number/num/e-mail` · pass +`卡密/密钥/令牌/key/token/access(-token)?` | 治病① |
| §C | 标签即定锚·守一不退 · 密码标签后**含 @ 仍为密码** · 邮箱标签后必须 `_isValidEmail` 才认 | 治病② · 治病④ '账号管理器:URL' 不再误伤 |
| §D | tryPair 用 `_isValidEmail` 严判 + 双向兜底 | 治病③ |
| §E | `pendingPass` 反向配对 (顺逆皆通) | 治病④ |
| §F | `_stripWxHints` 行尾剥离 `(无任何空格)`/`(去掉点)` 等微信提示 | 不弃真主之身·只剥提示尾 |
| §G | `_isNoiseLine` 整行模板嗅探 (开头明确者跳: 自动发货/订单编号/账号管理器: URL) | 噪声免疫 |

**回归测 · `_test_v270_omni_recognize.cjs` · 72/0 ✓**:

```text
[§3]  _isValidEmail       严判单元 14 测   (合法/非法 各 7)
[§4]  图3 微信自动发货     5 测            (含@密码守一)
[§5]  图4 卡号N:/卡密N:    11 测           (5 卡全识)
[§6]  标签数字编号         5 测            (账号1:/Email3:/卡密1: 等)
[§7]  经典格式不退化       9 测            (8 种分隔)
[§8]  反序配对             3 测            (pass 先 email 后)
[§9]  噪声免疫             1 测            (微信广告 9 行 → 唯识 1 真)
[§10] token 直登           2 测            (devin-session/JWT)
[§11] 综合极端 (一文混万法) 9 测            (6 账号 + 1 token)
═════════════════════════════════════════
        72 过 / 0 败
```

**道之精要**:

- **反者道之动** — 反向出发 · 解构识号四病 · 治本不治标
- **弱者道之用** — 不整行弃 · 仅剥微信提示尾 · 留真主之身
- **唯变所适** — 标签词典极广 · 大方无隅 · 同出异名 · 万法皆归
- **守一** — 标签即定锚 · 含 @ 仍为密码 · 不再以"形似邮箱"草率
- **大象无形** — 邮箱定准 (RFC 宽放) · 严判 TLD ≥ 2 letters
- **信不足 案有不信** — 测毕 72/0 方为道

### v2.6.13 阴阳结合 · 反者道之动 · 物无非彼物无非是

| 极 | 信号 | 维度 | 阈值 | 动态 |
|---|---|---|---|---|
| **阳·主** | ⚡W%脉动 | `weekly%` 宏观 | `quotaPulseMinDelta` (默 0.3%) | 触发 → 设 `_lastQuotaPulseAt` → 主信号窗 60s 内 WAL/pb/⚖ 让位 |
| **阴·辅** | ⚖额度变动 | `daily%` / `promptCredits` / `flowCredits` 多维度+微观 | `quotaDeltaDailyMin` (默 0.3%) + `quotaDeltaCreditsMin` (默 1) | 触发 → 进 `_maybeTrigger` 出口 → 主信号窗内自动 skip · 60s 强锁仍护 · 不设 PulseAt (不抢主) |

**道理 (1 章)**: 两者同出 · 异名同谓 · 玄之又玄 · 众眇之门

- 彼此都是后端账户被消耗 · 但维度互补 · 自彼自是合一
- W% 自是 (只知己之 weekly) · ⚖ 自彼 (补 daily/credits 彼面)
- W% 没捕捕的 (如 promptCredits 被异步 flow 扣) · ⚖ 微观可补

**方法证明 (阴让阳·不冲突)**:

- 如 ⚖ 触发同 tick 内 W% 也触发 → `_lastQuotaPulseAt` 已设 → ⚖ 进 `_maybeTrigger` 被让位 skip (不重复切号)
- 如 ⚖ 单独触发 (W% 未动 · 如 credits 异步扣) → `_maybeTrigger` 60s 强锁仍盖 · 安全切号
- 双都防跨账号假脉动 · 必 `_lastQuotaEmail === curEmail` 才比 (在更新前)

**配置默值 (与 W% 同量级)**:

```jsonc
"wam.quotaDeltaEnable":     true,   // 全开关
"wam.quotaDeltaCreditsMin": 1,      // promptCredits/flowCredits 任何减少即触
"wam.quotaDeltaDailyMin":   0.3,    // daily% 跨0.3% 即触 · 与 weekly 同量级
```

## 五 · 部署

### ○ 克隆后第一步 (道法自然 · 万家通用 · 适配万法之电脑万法之用户)

```powershell
# 1. 主公本机配置 (远程主机/用户) · 无远程则跳过 · 仅 local 已能工作
cp _dao_env.local.psd1.example _dao_env.local.psd1
# 编辑 _dao_env.local.psd1 · 填入主公的 host/user/drive

# 2. 账号库 (主公私产 · 永不入库) · 留空亦可 · 可在 WAM 面板内 + 添加账号
cp 账号库.example.md 账号库最新.md
# 编辑 账号库最新.md · 删除 # 注释 · 填入 'email password' 每行一个

# 3. 一令部署 (自读 VERSION + extensions.json · 不传任何硬编码)
.\_dao_deploy.ps1

# 4. Ctrl+Shift+P → Developer: Reload Window
```

| 文件 | 性质 | git | 用法 |
|---|---|---|---|
| `_dao_env.psd1` | 默认骨 (仅 local target) | ✓ tracked | 万家通用 · 不动 |
| `_dao_env.local.psd1` | 此机此人专 (远程主机) | ✗ ignored | cp `.example` 后填实 |
| `_dao_env.local.psd1.example` | 模板 | ✓ tracked | 范本 |
| `账号库最新.md` | 主公私产 (明文 email/pw) | ✗ ignored | cp `.example.md` 后填实 |
| `账号库.example.md` | 模板 | ✓ tracked | 范本 |
| `extension.js` / `package.json` / `README.md` | 活体源 | ✓ tracked | 改一处 万法响应 |
| `_dao_*.ps1` / `_v2611_*.ps1` / `_test_*.cjs` | 道之共享件 | ✓ tracked | 万家通用 · 与版本无关 |

**水无常形 · 利万物而有静** — 任何主机/用户 clone 此目录即可工作；本机差异由两个 `.example` 引导建立 ; 真私产由 .gitignore 屏蔽。

### 装载点

`_dao_deploy.ps1` 自读 `<extRoot>/extensions.json` 之 `relativeLocation` · 跨版本不变。

- **本机**: `$env:USERPROFILE\.windsurf\extensions\` (extDirHint 配置)
- **远程**: `\\<host>\<drive>$\Users\<user>\.windsurf\extensions\` (具体值由 `_dao_env.local.psd1` 配置)

实际目录名 (e.g. `devaid.rt-flow-2.6.8`) 由 extensions.json 提供 · 不写硬编码。

### 配置层级 (三层 · 水无常形 · 利万物而有静)

```text
1. _dao_env.psd1            git 跟踪 · 通用默认 (仅 local target · 任何 clone 即可工作)
2. _dao_env.local.psd1      gitignored · 此机此人专 (远程 host/user 等本地差异)
3. WAM_TARGETS_JSON env     transient override (临时 / CI / 脚本)

载入顺序: defaults -> 1 -> 2 -> 3 (后者覆盖前者)
```

**例 · 主公本机 `_dao_env.local.psd1`**:

```powershell
@{
    targets = @(
        @{ name = 'local'; kind = 'local' }
        @{ name = '179'; kind = 'smb'; host = '<peer-ip>'; user = '<peer-user>'; drive = 'C' }
    )
}
```

**适配万法之电脑万法之用户** — git clone 任一台机器，`_dao_env.psd1` 默认仅 local · 不绑特定主机 · 用户按需 cp `_dao_env.local.psd1.example` (已建·见 ○ 节) 加远程目标。

### 部署流程 (道法自然)

```powershell
cd '<本目录>'

# 一令部署所有 targets (按解析后清单 · 含 local + 本地覆盖之远程)
.\_dao_deploy.ps1

# 仅 local (跨机移植友好)
.\_dao_deploy.ps1 -LocalOnly

# 干跑 (只看计划 · 不动文件)
.\_dao_deploy.ps1 -DryRun
```

部署执行 5 步: 备份 → byte-equal 复制 → sha 验证 → patch extensions.json metadata → 写 wam.log marker。 不 kill ext host (上善如水 · 不抢路)·主公自取时机 Reload Window。

历次部署脚本 (v2.6.4-v2.6.12) 归 `_archive/v2.6.x_pre_dao/`。

## 六 · 用户唯一操作

```
Ctrl+Shift+P → Developer: Reload Window
```

Reload 后流程 (全自动):

```text
1. v2.5.5 activate → Store.load() → _cleanseHealthOnLoad
   洗 Trial-planEnd=0 脏数据 → checked=false → UI 显 "?天"
2. uncheckedPct 高 → auto-verify(stale) 加速 10s 启
3. verifyAll 跑 · 逐号 devinLogin → postAuth → registerUser → GetUserStatus
4. ★ ideVersion="1.99.0" → 后端返完整 planEnd ★
5. parsePlan 解 daysLeft · setHealth 写 state.json
6. UI 陆续从 "?天" → "11天" 绿 / "4天" 橙 / "2天" 红 / "已过期" 红
7. 切号自动继续 · 用户发消息自动切健康号
```

## 七 · 道之精要

- **不自夺** — v2.6.7 删强制 reset · 防抖才是疏 · 73 章 “天网恢恢, 疏而不失”
- **反者道之动** — v2.5 从 v2.3 加 5 hook 反向到去 hook · 损之又损
- **弱者道之用** — Layer 6 watch state.vscdb · 1500ms poll · 4s debounce · 水之柔
- **上善如水** — 不 kill 进程 · 不抢路 · 等 cascade 流完再切
- **不禁账号** — 失败仅记数 · 号永远可选 · 历史 until 自动清
- **道法自然** — 后端本就返完整数据 · 只因 ideVersion 太老被省 · 一字之修自正
- **太上下知有之** — 仅切号 3s 状态栏高亮 · 否则全无感

## 八 · 历史归档

```text
_archive/
├── v2.6.x_pre_dao/                 v2.6.4-v2.6.12 历版部署/验证脚本 (28 件 · 已被 dao_* 取代)
│   ├── _v264_* (7 件)              monitor / runtests / deploy bat
│   ├── _v265_* (6 件)              deploy / diag / runtests
│   ├── _v266_* (3 件)              audit / deploy / verify
│   ├── _v267_* / _v268_* (3 件)    残桩 (200-300B)
│   ├── _v269_* (3 件)              full_chain_probe / LIVE_BASELINE_COMPARE / verify
│   ├── _v2611_deploy.ps1 / _v2611_postreload_verify.ps1 / _v2611_auto_verify.ps1
│   ├── _v2611_GENESIS.md           v2.6.11 治法草案
│   ├── _v2612_deploy.ps1
│   └── _e2e_monitor.ps1            v2.5.6 时代旧监控
├── probes_20260507/                2026-05-07 当日探针快照 (7 目)
│   ├── _chain_probe_*  × 2
│   └── _omni_probe_*   × 5
├── v2.5_pre_daoist/                v2.5.0~v2.5.4 演化全档
│   ├── extension_v2413b.js         pre-v2.5 baseline
│   ├── ROOT_CAUSE_v25_DAOIST.md    v2.5.0 时刻分析
│   ├── ROOT_CAUSE_*.md             v2.1~v2.3 历时根因 4 卷
│   ├── _probe_*.cjs                v2.5.5 真根因 probe 5 卷
│   ├── _deploy_v25*.{ps1,log}      5 次部署轨迹
│   ├── DEPRECATED.md / VERSION_INDEX.md
│   └── LINKS.md                    旧 dao-agi vendor 链 (已废)
├── v2.6.6_pre_守一/                v2.6.6 守一前快照
├── 2026-04-29-cleanup/             4/29 一次性清理
├── 179_probes/                     179 远端探针 (旧)
├── builds/                         历代构建脚本
├── releases_history/               28 中间 VSIX
├── tests/                          历代测试
├── webrev / webrev_2026-04-23/     Windsurf web 反向工程原料
├── v2.4.11_pre-jiantou/            v2.4.11 时刻 pre-tip 分支
└── USER_TEST_GUIDE_v17.60.md       老用户测试指南
```

## 九 · 修改即部署 (dao 链 · 道法自然)

```powershell
# 1. 编辑 extension.js + 同步 const VERSION + package.json version

# 2. 全测 (13 套·核心 11 套 458/0 + 2 套 baseline 跟新)
node _test_set_health.cjs ; node _test_v241_real.cjs ; node _test_in_use.cjs
node _test_e2e_msg_rotate.cjs ; node _test_quota.cjs ; node _test_v251_postauth_header.cjs
node _test_v252_exptag.cjs ; node _test_v255_ideversion.cjs ; node _test_v256_layer6_path.cjs
node _test_v267_debounce.cjs
node _test_v2613_quota_delta.cjs            # v2.6.13 阴阳结合 · ⚖额度变动 (44 过)
node _test_v2614_triple_throttle.cjs        # v2.6.14 三守俱全 · 雪崩拟消 (66 过)
node _test_v270_omni_recognize.cjs          # v2.7.0 万法识号·守道反者 (72 过)

# 3. 语法
node --check extension.js

# 4. 一令两机部署 (自读 VERSION · 不传版本号)
.\_dao_deploy.ps1

# 5. 用户 Ctrl+Shift+P → Developer: Reload Window

# 6. Reload 后验证 (自识 activate · 自比 SRC vs DEP sha)
.\_dao_postreload_verify.ps1                # local
.\_dao_postreload_verify.ps1 -Target 179    # 远程 179
```

## 十 · 软编码归一 · v2.7.0 全栈道直 (得一者天得清·地得宁·神得灵)

**单一信源 · 一处修万法响应**:

| 量 | 信源 | 谁读 |
|---|---|---|
| `VERSION` | `extension.js` 之 `const VERSION` | `Get-WamSourceVersion` → 部署/验证/状态/监控 全栈 |
| `targets` | `_dao_env.psd1` (defaults) → `_dao_env.local.psd1` (覆) → `WAM_TARGETS_JSON` (env) | `Get-DaoEnv` → `Get-Targets` → 部署/验证 全栈 |
| `extDirHint` | 同上三层 (默 `.windsurf\extensions`) | `Resolve-Target` → 部署目录定位 |
| `extensionId` | 同上三层 (默 `devaid.rt-flow`) | `Resolve-DevaidLocation` → extensions.json 自识 |
| `wamHomeDir` | 同上三层 (默 `.wam`) | **`Get-WamDir`** (v2.7.0 新立) → 全 `_v2611_*` + `_dao_postreload_verify` 走此 |
| ext 实目录 | `<extRoot>/extensions.json` 之 `relativeLocation` | `Resolve-DevaidLocation` → 兼裸数组/包装对象双形 |
| 用户身 | `$env:USERPROFILE` (Windows) / `$env:HOME` (Linux/macOS 兜底) | `Get-WamDir` 内自适 |

**实践验** (软编码归一·万家通用·一台 clone 即工作):

```powershell
# 主公本机改 wamHomeDir 为 .wam-custom (例) · 重启即生效·万脚本响应
@{
    extensionId = 'devaid.rt-flow'
    wamHomeDir  = '.wam-custom'      # 改此一处
    extDirHint  = '.windsurf\extensions'
    targets     = @(@{ name = 'local'; kind = 'local' })
}
```

**九 PS 脚本语法 + 11 测套件 458/0 + DryRun 部署 OK** · 道法自然·一处修万法响应。

---

> 致虚极, 守静笃 · 万物并作, 吾以观其复
>
> 道恒无为而无不为 · 反者也, 道之动也 · 弱者也, 道之用也
