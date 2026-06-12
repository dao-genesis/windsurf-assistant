// WAM · 万法归宗 v3.10.1 · 零额度紧急重触 · 切号防御双完善 · 道法自然
//
// 本源需求: 用户在 Cascade panel 发消息 → WAM 自动切健康号 (用户无为 · 插件无不为)
//
// 纲领 (以《德道经》为经):
//   · 反者道之动 · 弃 Layer 1-5 ext-host hook (跨进程隔离·真消息从未命中)
//   · 弱者道之用 · 唯 Layer 6 watch state.vscdb 真跨进程信号 (webview 写文件)
//   · 不禁账号   · 失败仅记数 · 号永远可选 · rate-limit 退让 30s 即回池
//   · 上善如水   · 不 kill 进程 · 不抢路 · 等 cascade 流完再切
//   · 大制无割   · 198KB → ~80KB · 一层 hook 一条真路 (从 v2.4.13b 损之又损)
//
// v3.7.0 · 道法自然 · 三维度归一 · 锁止复元 · 彻底完善自动切号底层体系 (2026-05-25):
//
//   ━━━ 五大根治 (逆流审视 v3.6.0 · 反者道之动) ━━━
//
//   「一」三维度归一 — promptCredits/flowCredits 余额独立资源池入场
//     根因: _scoreOf/_isValidAutoTarget/_tick 完全忽略 credits 维度
//     现象: quota%耗尽但余额充裕的账号被误判「不可用」→ 不用即废 (不可逆损失)
//     治法: 新增 _hasUsableCredits(h) / creditsBonus 评分 / _tick 耗尽判定含credits
//     道: 「大成若缺·其用不敝·大盈若盅·其用不窘」
//
//   「二」锁止机制复元 — isInUse 降分回归 _scoreOf
//     根因: v3.0 以「全号平等」为由移除 isInUse 检查 → 锁止形存实亡
//     现象: A→B 切号后 A 立即可回选 → 来回震荡 · 无冷却效果
//     治法: _scoreOf 内加 _applyInUse(×0.01) → 锁中号降至1%分值 · 非 -∞ 仍可兜底
//     道: 「知止所以不殆」
//
//   「三」周日边沿修正 — hoursUntilWeeklyReset 精准化
//     根因: (7-0)%7=0 → 旧 ||7 强制跳下周 → 周日未重置前(UTC 07:59)算成7天后
//     现象: 周日16:00前系统误以为距重置7天 → waitResetHours判断失准
//     治法: dts=(7-day)%7 · 若算出时刻<=now再+7天 · 正确定位当前轮次
//     道: 「知常·明也·不知常·亡亡作凶」
//
//   「四」有效期临期+余额协同 — 临期号有credits双重加持
//     现象: daysLeft<7 账号若有 credits 应更强优先 (即将过期·credits+quota双废)
//     治法: expBonus 与 creditsBonus 同时生效 → 临期+充裕credits → 分值极高
//
//   「五」新增配置项: wam.creditsThreshold / wam.creditsInScore
//     creditsThreshold: credits 视为「可用」的最低总量 (默 1000)
//     creditsInScore: credits 是否纳入 _scoreOf 评分 (默 true)
//
// v3.0.0 · 道法自然 · 无为而无不为 · 全量解构自封体系 (2026-05-21):
//   「一」移除一切自动限制 · 有密码即可用 · Free/Trial/Pro 皆可进入候选池
//   「二」 _cleanseHealthOnLoad 彻底废止清洗 · 不主动覆写任何字段
//   「三」 _scoreOf 加为所有已验号给正分·双零才最低分 · 无门第封冻
//   「四」 endpoint 死亡检测扩展 400 · 不再漏检服务端故障
//   「五」 _tryDevinBillingFallback · GetUserStatus 400 时用 Devin billing API 探实隟额
//     实证: app.devin.ai/api/{orgId}/billing/status 返 overage_credits + billing_error
//
// v3.0.1 · 反者道之动 · 手动至高优先 · 彻底无阻 (2026-05-21):
//
//   ━━━ 五大结构性病灶 (逆流审视 v3.0.0) ━━━
//   「病灶一」 _engine.rotating && !_switching 永久无超时阻塞手动切号 (最致命)
//     根因: Engine.rotateNext() 只设 this.rotating=true·不设 _switching=true
//     效果: rotateNext 执行期间 (最长160s) 手动切号命中此判断 → 永久阻塞
//     30s 强制解锁逻辑仅针对 _switching·对 _engine.rotating 完全无效
//   「病灶二」 Engine.rotateNext() 不同步 _switching 全局锁
//     根因: rotateNext 仅管 this.rotating·_switching 始终为 false
//     效果: 手动切号30s超时保护对 rotateNext 场景完全失效
//   「病灶三」 命令面板 wam.switchAccount 不同步 _switching
//     根因: line 4820 设 _engine.rotating=true 但不设 _switching=true
//     效果: 命令面板切号期间 手动切号同样被永久阻塞
//   「病灶四」 rate-limit 时 rotateNext 串行遍历候选号 长时持锁
//     根因: for(idx of order) loginAccount(idx) 每次3-8s · 20号=最长160s
//     效果: 高速切号场景 IP 级 rate-limit → rotateNext 遍历全部失败 → 持锁分钟级
//   「病灶五」 手动切号 _switching 超时 30s 过长 · 用户体感卡顿严重
//
//   ━━━ v3.0.1 解法 (反者道之动·损之又损·一锁覆万源) ━━━
//   「修一」 手动切号删除 _engine.rotating && !_switching 永久阻塞
//     改为: 只检查 _switching (统一互斥锁) · 超时 30s→10s (手动不应久等)
//     力: 手动强占时同步清除 _engine.rotating (双锁归一)
//   「修二」 Engine.rotateNext() 设/清 _switching (与 _doAutoSwitch 对齐)
//     改为: this.rotating=true 时同步 _switching=true + _switchingStartTime
//     力: 手动10s超时保护对 rotateNext 场景生效 · 用户最长等10s即可抢占
//   「修三」 命令面板 wam.switchAccount 同步 _switching
//     改为: _engine.rotating=true 时同步 _switching=true
//   「守一」 _switching 成为唯一互斥锁 · _engine.rotating 仅用于UI显示
//     道理: 天下莫柔弱于水·水善利万物而不争 · 一锁至柔·覆万场景
//   「道法」 用户手动切号 = 最高优先 · 任何时候 ≤10s 必可执行
//     无为而无不为 · 不禁 · 不阻 · 不滞 · 回归本源
//
// v2.6.0 · 底层软编码 · 唯变所适 · 水无常形 (2026-05-05):
//   · RE_SESSION_TOKEN 常量统一 · "devin-session-token$" 两处字面量 → 单点定义
//     windsurfPostAuth / healthCheck 均改用 RE_SESSION_TOKEN.test() · 后端格式变时单行修
//   · buildHtml planTag 改用 _isTrialLike(h) · 与 _cleanseHealthOnLoad/_buildExpTag 全链对齐
//   · _resolveCascadePbDir Linux fallback 改用 os.homedir() · 跨发行版自适应
//   · startup recovery 阈值改用 _cfg("autoSwitchThreshold",5) · 与 Engine._tick 对齐 · 配置一源
//
// v2.6.1 · Layer 6 双信号 · 逆流到底 · 解构一切 (2026-05-05):
//   · 信号① pb·new: 新 .pb 文件 = 新对话 → 立即切号 (原有逻辑保留)
//   · 信号② pb·send: 存量 .pb 文件大小增量 + 安静期检测 = 已有对话用户发消息
//     原理: 用户 send → 文件首次写入(小增量·安静后) · AI 流式续写 → 连续写(不安静)
//     安静期 QUIET_MS(默认 3s): 距上次增长 >3s 的首次增量 → 视为用户 send
//     每文件冷却 COOLOFF_MS(默认 8s): 触发后 8s 内同文件不再触发 · 防 AI 慢响应重触
//     最小增量 GROW_MIN(默认 50B): 过滤元数据抖动
//   · 效果: 新对话/已有对话 每发一条消息均触发切号 · 真正 per-send 级精度
//
// v2.6.2 · 跨实例声明锁 · 观复知常 · 万物并作 (2026-05-05):
//   · 根因: 多 Windsurf 窗口各含独立 WAM 实例 · 共享同一 cascade 目录
//     实证: wam.log 显示同一 pb 文件在 495ms 内被记录两次 → 2 次切号
//   · 修法: ~/.wam/_l6_claim/ 声明目录 + flag:"wx" 原子排他创建
//     pb·new → <uuid>.pb.new 声明文件 · 第一个实例到者得之 · 其余静默跳过
//     pb·send → <prefix8>.<timebucket>.send 声明文件 · COOLOFF_MS 时间桶内唯一
//   · 声明文件在 _installLayer6FileWatcher 启动时清理 >5min 旧文件 · 零积累
//   · 效果: 无论几个 Windsurf 窗口同时运行 · 每个 send 事件精确触发一次切号
//
// v2.6.3 · WAL 直达触发 · 大道至简 · 回归本源 (2026-05-06):
//   · 信号源: state.vscdb-wal (用户 click Send 后 SQLite 同步写入的 WAL 帧)
//     实证: globalStorage/state.vscdb-wal 现已 11MB 且持续增长
//     原理: cascade 写对话元数据到 SQLite → WAL 帧增长 (SQLite 页 4096B+24B/帧)
//     这发生在向 AI 发出 HTTP 请求之前 —— 比 pb 文件增长早一个 IO 层
//   · 实现: _installWalWatcher(context) · 300ms 轮询 · 比 pb 轮询快一倍
//     quiet=2s (WAL 写入相对集中·AI 流连续写 pb 不安静)
//     cooloff=6s · min=1024B (1 个 WAL 帧大小)
//   · 参数: wam.walDetectQuietMs / wam.walDetectCooloffMs / wam.walDetectGrowMin
//   · 大道至简: pb·send 需 3s 安静期延迟切号 · WAL 在 click Send 的第一个 300ms 轮询内即可检测
//
// v2.6.4 · 去芜存菁 + quietSec 哨兵修 · 无为而无不为 (2026-05-06):
//   · 删 wam.netHookDisabled (v2.5.0 删 Layer 1-5 net.Socket hook 后遗留死配置·零引用)
//   · 删 wam.perMessageMinIntervalMs (默认 0 关·从未被 _cfg 读取·pb·new 已精确不需要)
//   · 补 wam.sendDetectQuietMs / sendDetectCooloffMs / sendDetectGrowMin (v2.6.1 pb·send 三参数)
//   · 补 wam.walDetect / walDetectQuietMs / walDetectCooloffMs / walDetectGrowMin (v2.6.3 WAL 四参数)
//   · 效果: VS Code 设置界面可见全部检测参数 · 用户可按环境微调 · 删 2 死补 7 活
//   · hotfix: pb·send / wal·send 首检测时 lastGrow=0 · quietSec 计算将 Unix 时戳泄入日志 (·56年)
//     事证: 2026-05-06 首部署后 wam.log 观到 quiet=1778003563s
//     修: lastGrow=0 哨兵化 · 首检测时 quiet="init" · isQuiet 仍为 true 保留触发逻辑
//
// v2.6.5 · 锚定本源 · 慎终若始 (2026-05-06):
//   · 根因: v2.6.4 hotfix 写入源后未提版本 · 部署 sha 与源一致 · 但运行进程加载的是旧 v2.6.4 (无 hotfix)
//     实证: wam.log 持续打 quiet=1778040905s · 0 条 quiet=init · 而 SRC sha === DEP sha 已含 hotfix
//   · 真因: VS Code extension host 不热重载 · Node module 缓存把 18:13~18:15Z 启动时读到的旧 disk 锁定
//   · 道法: 64 章 "慎终若始 · 则无败事" · v2.6.5 仅升版本号 + changelog · 行为零变化
//     效果: 主公 Reload Window 后 wam.log 出现 "WAM v2.6.5 activate" → 秒证 hotfix 生效
//   · 配套: 重跑 _v264_deploy.bat 刷新 DEP marker · 加 _v265_postreload_verify.cjs 一键跳验
//
// v2.6.6 · 反者道之动 · 解构一切 · 逆流到底 (2026-05-06):
//   · 实证: 40 分钟 wam.log 析: pb·send 触发 186 次 / 4 个 .pb 并发 / 主公真实 send ~5 条
//     单文件 56d148d6 触发 102 次 (23s/次) · quiets 主峰 8s×46 (= cooloff 解除即触发)
//     一条 send → AI 流式响应 → cooloff 8s 期满即重触 → 单 send 切号 5-10 次
//   · 病灶: 当前 cooloff 模型 [QUIET=3s · COOLOFF=8s · GROW≥50B] 三大缺陷:
//     ① cooloff 解除即触发 · AI 流式期间反复切号 (主峰 8s×46 即此)
//     ② GROW≥50B 太低 · 60-280B cascade 心跳/元数据被误判为 send
//     ③ 多 .pb 并发 · 4 个对话窗口同时活动 · 4 倍触发噪声
//   · 反者解 (40 章 "反者，道之动也"): cooloff (看见动就切) → settle (看见停才切)
//     debounce trailing edge 模式 · 文件增长重置 settle 计时器 · 静默 N ms 后才切号
//     流式期间所有续写吸收到一次 settle · 主公一条 send → 1 次 AI 响应 → 1 次切号
//   · 实现: pb·send → pb·settle / wal·send → wal·settle
//     SETTLE_MS=15000 (15s 静默 = AI 已停) · ACCUM_MIN=5120 (5KB 累积过滤心跳)
//     单次 GROW_MIN=30 (任何 ≥30B 累积) · LARGE_DELTA=131072 (单次 ≥128KB 直接 settle 兜底)
//   · 配置变化:
//     - wam.sendDetectQuietMs (3000)    → 删
//     - wam.sendDetectCooloffMs (8000)  → 改 wam.sendDetectSettleMs (15000)
//     - wam.sendDetectGrowMin (50)      → 改 wam.sendDetectGrowMin (30)
//     + wam.sendDetectAccumMin (5120)   · 累积阈值 · 过滤 cascade 心跳元数据
//     - wam.walDetectQuietMs (2000)     → 删
//     - wam.walDetectCooloffMs (6000)   → 改 wam.walDetectSettleMs (15000)
//     - wam.walDetectGrowMin (1024)     · 保留
//     + wam.walDetectAccumMin (10240)   · WAL 累积阈值 (WAL 帧密度高于 pb)
//   · 道一以贯之: 弱者道之用 · 不与 AI 流式抢路 · 等其自然停 · 上善如水
//
// v2.6.7 · 守一 · 减二 · 不自夺 (2026-05-06):
//   · 实证: 4 分钟 18 切号 / 24 hits / 末段 4 连 Rate-limit 雪崩
//     11:27:02.543/.551 同 8ms 内 0c3ec7c1 + fd300a99 双 fire (同一 send 派生多 .pb)
//     11:26:21/22 902ms 内 bb141f7a + df3fc58b 双 fire · 11:26:29/31 1.97s · 11:25:05/06 543ms
//     全部应被 perMessageDebounceMs=4000 拦 · 实际全过 → 防抖完全失效
//   · 病灶: pb·settle (line 2669) + wal·settle (line 2853) 两处 fire 前
//     强制 _lastPerMsgTriggerAt = 0 · 自夺防抖 · 一条 send 派生 N 文件 settle = N 切号
//   · 减法:
//     - 删 pb·settle 之前 _lastPerMsgTriggerAt = 0
//     - 删 wal·settle 之前 _lastPerMsgTriggerAt = 0
//     · 保 pb·new 队列里的 reset (queue gap 3500ms < debounce 4000ms · 串行排队需绕)
//   · 加法 (诊断): _perMsgDebounced 计数 · 防抖拦截入 _per_msg_diag.json
//     主公可读 totalDebounced 与 totalHits 比 · 验证修后过 fire 比降至预期
//   · 道一以贯之: 73 章 "天网恢恢, 疏而不失" · 防抖才是疏 · reset = 着相妄为
//     上善如水 · 多源派生 settle ≤4s 内重叠 · 收回一道 · 下游单切号
//
// v2.6.8 · 实证回归 · 字面归一 · 部署归宿 (2026-05-06):
//   · 实证 v2.6.7 在 179 远端: 文件 sha 一致 / 测 24/0 / 软重启 ext host (双轮 kill) / activate v2.6.7
//   · 实证 _per_msg_diag.json totalDebounced 字段写入 / wal settle 信号工作 / state ver=2.6.7 / switches+3
//   · 修字面: activated log "三源[pb·new+pb·send+wal·send]" 是 v2.6.4 旧描述
//     实际架构自 v2.6.6 已重构为 settle 模型 · 改为 "settle 模型[pb·new+pb·settle+wal·settle] · 4s 防抖"
//   · 修部署: _v267_deploy.ps1 hardcode 路径 "devaid.rt-flow-2.1.1" · 实际 windsurf 加载
//     extensions.json 里 location.path = "devaid.rt-flow-2.5.5" (vsix 多版本残留)
//     → _v268_deploy.ps1 改为读 extensions.json location.path 自动找正确目录
//   · 道一以贯之: 24 章 "自见者不明" · v2.6.7 自以为已部署 · 实际 windsurf 加载旧目录
//     必"不自见故章"·实证驱动·读权威源 (extensions.json) 而非假设目录命名
//
// v2.6.10 · 治人事天·莫若啬 · checkpoint 过滤 · 损之又损 (2026-05-07):
//   · v2.6.9 reload 后活体实证 37min · 降幅 98.9%·median 22s→2070s·min 5s→222s
//     但 wal·edge fire 6 次 / rotate 3 次 / minInterval-locked 2 次 · 差 1 未解
//     返查 log: edge·fire delta = +840480B / +708640B ← 非 user send (单次 send 常 4-32KB)
//     实为 SQLite auto_checkpoint 批量满 4MB 后 flush · 多帧合批 → wal 一次增 KB-MB
//   · 病灶: wal·edge 只有下限过滤·无上限·checkpoint 大批写 ≡ user send (信号混淆)
//     60s 强锁者瞥其火·但未治本 · 假如 checkpoint 发在 60s 后 即仵误切
//   · 损法 (59 章 治人事天·莫若啬 · 啬、早服、重积德):
//     · wam.walEdgeMaxBytes 默 65536B (64KB) · delta > 此 值视为 checkpoint 噪 · skip
//     · 新 log: wal·edge·skip[checkpoint:XXXB > 65536B] · 与 fire 双轨可观
//     · diag 增: edgeSkipCount / lastEdgeDelta / lastCheckpointDelta / last*At
//     · 空间过滤 + 时间强锁 = 两道互补 · 重为轻根·清为軁君
//   · 向后兼容: walEdgeMaxBytes=0 ⇒ 关上限 (v2.6.9 行为)
//   · 道一以贯之: 59 章 "重积德则无不克" · user-send 小·checkpoint 大 · 分而中之
//
// v2.6.13 · 阴阳结合 · 反者道之动 · 物无非彼物无非是 (2026-05-08):
//   · 缘起: 主公《齐物论》之诏 — 自彼则不见·自是则知之·阴阳互补不冲突
//     现有 W%脉动 (阳·主) 仅看 weekly% 单维度 · 自是只见己·不见彼
//     新增 ⚖额度变动 (阴·辅) 监 daily%/promptCredits/flowCredits 多维度
//   · 道理: 一阴一阳之谓道 · 主信号宏观百分比 · 辅信号微观额度池 · 二者互补显全象
//     · weekly% 是后端真账·主流·已建主信号窗 60s 让位
//     · daily% Pro plan 主用·与 weekly 维度独立
//     · promptCredits/flowCredits 绝对数池·与 quota% 解耦·任何 prompt/flow 调用即扣
//   · 结合: 同入 _maybeTrigger 出口 · 同受 60s 强锁保护 · W%脉动主信号窗内 ⚖ 让位 (skip)
//     防跨账号假脉动 同 W% · 必 _lastQuotaEmail === curEmail 才比
//   · 配置 (默全开·与 W%脉动同量级):
//     · wam.quotaDeltaEnable (默 true) · 全开关
//     · wam.quotaDeltaCreditsMin (默 1) · promptCredits/flowCredits delta 阈值
//     · wam.quotaDeltaDailyMin (默 0.3) · daily% delta 阈值
//   · 不冲突保证 (反者道之动·阴让阳):
//     · ⚖ 触发同 tick 内 W% 也触发 → _lastQuotaPulseAt 已设 → ⚖ 进 _maybeTrigger 让位
//     · ⚖ 单独触发 (W% 没动·如 promptCredits 异步扣) → _maybeTrigger 60s 强锁仍护
//   · 道一以贯之: 1 章 "两者同出·异名同谓·玄之又玄·众眇之门"
//     彼此异名同谓 — 都是后端账户被消耗 · 但维度互补 · 自彼自是合一
//
// v2.6.14 · 三守俱全 · 守一·大制无割 · 反者道之动 (2026-05-08):
//   · 缘起 (实证 179 wam.log · v2.6.13 生命 · 21225 行):
//     · 声设 ⚡W%脉动 = 主信号 · WAL/pb 让位 60s
//     · 实证信号占比 ⚡W%脉动 4.3% (11/253) · 📡WAL·edge 68.8% (174/253)
//     · 让位机制几不生效 (13/253) · "主信号优先" 形同虚设
//     · 5 分钟爆发 WAL 174 火 · 38 次真切号 · 每 8s 切一 · 雪崩复返
//   · 根因三破:
//     ① 公理破 — "1 user send = 1 信号" 不成立 · 流式响应是连续 N quanta 入两源
//                  实证: 单账号 40s 内 W 82→80→77→75→72 · 1 send 引 4 脉动
//     ② 栏破 — v2.6.11 弃 perMessageMinIntervalMs 60s 全锁 → 最终兜底失
//     ③ 守破 — v2.6.12 quotaPulsePriorityMs 只守 WAL/pb · 不守 W% 自身 · 阳自决堤
//   · 三守俱全 (守一 · 大制无割 · 一全锁覆万源):
//     守一: _maybeTrigger 入口加 perMessageMinIntervalMs 60s 全 reason 强锁
//           复 v2.6.9 之全栏 · 适万源 (W%/WAL/pb/⚖) · 1 user send ≤ 1 切
//     守二: WAL 同源最小间隔 walEdgeCooldownMs 2s (避 4KB 帧连火 · 削 log 噪)
//     守三: WAL 启动暖启 walWarmupMs 5000ms · 防 activate 首 stat 之累积差
//           (实证 14:54:03 reload · 14:54:03.540 即火 · 启动雪崩源头)
//   · 配置 (三新全默值已保守):
//     · wam.perMessageMinIntervalMs (默 60000) · 全 reason 强锁 (0=关复 v2.6.11)
//     · wam.walEdgeCooldownMs        (默 2000)  · WAL 同源最小间隔 (0=关)
//     · wam.walWarmupMs              (默 5000)  · WAL 启动暖启窗 (0=关)
//   · 不动: ⚡W%脉动 / ⚖额度变动 / 📃pb·new 算法 (阴阳已合)
//   · 预期 (理论): WAL·edge fire 174/5min → ≤ 75 (-57%)
//                  per-msg hit     50/5min →   ≤ 5  (-90%)
//                  login✓           38/5min →   ≤ 5  (-87%)
//                  雪崩拟消 · 1 user send ≤ 1 切号 (1:1 精确回归)
//   · 道一以贯之: 64 章 "为之者败之·执之者失之·圣人无为故无败" ·
//                单行全栏 >  多处细栏 · 守一 > 守多 · 道极减法之真
//
"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { URL } = require("node:url");

// ═══ § 1 · 万法之资 ═══
// v2.5.5 · 真根因 · ideVersion 能力协商 (2026-05-04 probe 实证):
//   根源: v2.5.3/v2.5.4 改了脏数据清洗/软判据 · 但用户截图仍 "Trial?" · planEnd 仍 0
//   · probe 独立测证: ideVersion="1.0.0" → 后端省 planEnd/planStart
//   ·                ideVersion="1.99.0" → 后端返完整结构 含 planEnd="2026-05-09"
//   · tryFetchPlanStatus 默认 ideVersion="1.0.0" → 后端能力协商省字段 → parsePlan planEnd=0
//   · 单行修: "1.0.0" → "1.99.0" · 后端返完整数据 · 98 号扣自然有 daysLeft
//   · 此乃 postAuth 401 / Trial 脏数据背后的 真道 · 后端实为有消息只是省了
//
// v2.5.4 · 软编码 · 唯变所适 (2026-05-04):
//   根源: 用户“道法自然·高适万法环境变化”呗 · 审 v2.5.3 硕存硬编码
//   · 抽 _isTrialLike(h) · regex /trial/i · 兼 Trial/Team Trial/Free Trial/Devin Trial
//   · _cleanseHealthOnLoad 用软判据替硬编 plan==="Trial"
//   · _buildExpTag 用软判据替硬编 plan==="Trial" · 任后端 tier 变体均兼容
//   · 暴 _isTrialLike 给 _internals 供测
//
// v2.5.3 · 根本解 · Trial 脏数据清洗 + 第 5 态 (2026-05-04):
//   实证根因: postAuth 401 时期 state.json 残留 98 个号 checked=true 但 planEnd=0
//   · _cleanseHealthOnLoad 加 Trial+planEnd=0 检测 · 签 checked=false · 下次自动重验
//   · _buildExpTag 加第 5 态 “Trial?” 黄 · tooltip 提示点🔍重验 (v2.5.2 ∞ 缩到真 Pro/Free)
//
// v2.5.2 · 道法自然 · 每行恭显剩余有效期 (2026-05-04):
//   · expTag 4 态全显: 未验?天 / 有效N天 / 已过期 / ∞ 永久 · 不再出现空字段
//   · .days CSS 加 min-width · 防“?天”与“100天”行间错位
//   · tooltip 增详 · 则 hover 可见到期日期 + 剩余天数
//
// v2.5.6 · 真根因 · Layer 6 信号文件 + 路径双修 (2026-05-05 实证):
//   根源: v2.5.0~v2.5.5 Layer 6 从未命中 · 日志永远 "Layer 6 · skip"
//   · 实测: globalStorage/state.vscdb-wal 11MB 实时随 Cascade 消息增长
//            workspaceStorage/<hash>/state.vscdb 16:01 停更 · 非 Cascade 写入
//   · 修①: 文件改为 globalStorage/state.vscdb-wal (真信号) · context.globalStorageUri 导出
//   · 修②: 旧 path.dirname(path.dirname(storageUri)) → ONE dirname 修正
//   · 修③: delta 策略 WAL 正增量 ≥1KB (过滤 checkpoint 缩减) · debounce 兜底
//   · fallback 四级: globalStorage WAL → globalStorage main → workspace → scan
//
// v2.5.1 · 从根本审视 · 道法自然 (2026-05-04 · 单行补丁):
//   · 根因: Windsurf 后端协议变更 → windsurfPostAuth 返 401 "missing required header: X-Devin-Auth1-Token"
//   · 修法: 加 header X-Devin-Auth1-Token (实测 3/3 号 200 OK) · body 兼容保留
//   · 实据: `X windsurfPostAuth: unauthenticated` 是所有切号失败的单点根因
//   · 效应: 账号有效期显示是正常 daysLeft 倒计时 · 号能切后自然消解用户的疑虑
//
// v2.5.0 · 道极大减法 (2026-05-04):
//   · 删 Layer 1-5 ext-host hook 整块 (~500 行 · 实证跨进程隔离·真消息从未命中)
//   · 删 self-test trigger 机制 (~120 行 · self-test 自触误为真命中·着相妄为)
//   · 不禁账号 · banFor/isBanned/_bumpFailure 改为纯记数 · 历史黑名单自动清
//   · 提 _maybeTrigger 为顶级函数 · Layer 6 直调 · 不再经 _layer6Trigger 中转
//
// v2.6.9 · 道法自然 · 损 settle · 留真信号 (2026-05-07 实证根治):
//   实证 (window1 5-WAM.log · 11min13s · 用户对话频率 ~3min/条):
//     · 切号 34 次 / 22s 中位间隔 · 频率 ≈ 用户对话 9 倍
//     · pb·settle fired 36 + skip 6 (全部错触发源)
//     · wal·settle fired 0 (settle 模型对 WAL 完全失效·SQLite checkpoint 抢截)
//     · 4 个并行 .pb 文件 (8bc7943c/b2165dd0/e9e73244/f9ebad5b)
//     · debounced 仅 2 次 (4s 防抖 vs 15s settle 间隔→几乎全过)
//   60秒采样 (用户等候期·我跑工具调用):
//     · WAL 净增 0B (用户没 send · 真信号正确无噪)
//     · pb 净增 310KB / 31 写入 (AI+工具噪音)
//   根因 (10 层):
//     1. 表象: 切号频率远高于用户对话频率
//     2. 触发: 100% 来自 pb·settle (wal·settle 0)
//     3. 多源: 4 文件并行各自 settle 累积
//     4. 体: ~/.codeium/windsurf/cascade/ 50 个历史 .pb · 4 个活跃
//     5. 漏: claim key=pbPrefix+bucket · 不同 prefix 不互锁 (跨实例锁实为同实例文件锁)
//     6. 疏: 4s perMessageDebounceMs vs 15s SETTLE_MS · 间隔通常>4s
//     7. 错: settle 模型 = "AI 流式段静默" ≠ "用户 click Send"
//     8. 浊: pb 增量信号被 50 个历史会话 + cascade reindex daemon 污染
//     9. 本: 一条 user msg → AI N 段流 × 活 pb 数 → N 次切号
//    10. 道: v2.5 弃 L1-L5 hook 落到 .pb 信号 · 比原 hook 还吵 · 哲学错位
//   修法 (反者道之动·损之又损):
//     · 减:
//       - 删 _firePbSettle 整段 (~26 行)
//       - 删 watcher 内"存量文件增量 settle"段 (~60 行)
//       - 删 _fireWalSettle settle 模型 (~70 行)
//       - 删 settle 常量 SETTLE_MS/ACCUM_MIN/GROW_MIN/LARGE_DELTA/pbSettle Map
//       - 删 pb·new 路径中 _lastPerMsgTriggerAt = 0 (旧自夺防抖最后一处)
//     · 留:
//       - 保 pb·new (新对话切号唯一无错配纯信号 · 1:1 精确对应)
//     · 加:
//       - WAL 边沿首发: 单次 delta ≥ 512B 立即 fire · 不等 settle
//         (用户 click Send 时 SQLite 同步 fsync WAL · 一次写 1-2 帧 ≈ 4-8KB · 立可见)
//       - 60s 全局强锁 (perMessageMinIntervalMs 默认 60000)
//         任何信号源 60s 内最多 1 次切号 · 兜底无为
//       - claim key 改纯 bucket (跨实例多源派生收一道)
//   实证锚:
//     v2.6.8: 22s/次切号 · 9倍率 · 31 hits / 2 debounced
//     v2.6.9 期: ≥60s/次切号 · 1倍率 · 边沿首发 + 60s 强锁兜底
//   道之精要:
//     · 反者道之动 — pb 增量(AI 写)→反向→ WAL 边沿(用户写) · 信号本源对位
//     · 弱者道之用 — 不再 settle 累积心跳/段间停顿 · 唯首帧即真
//     · 上善如水   — AI 流响应 .pb 增长不动·唯用户 SQLite 同步 fsync 时切
//     · 太上下知有之 — pb·new+wal·edge 两源精确·用户无感
//     · 大制无割   — 净减 ~150 行 (删 settle + 加边沿) · 损之又损
//     · 道法自然   — 用户日常对话 ~3min/条·切号 60s 强锁 → 自然合一
//
// v2.7.0 · 万法识号·守道反者 (2026-05-09):
//   · 用户实证 (4 图):
//     图1 账号列表大量 "?天/未验/D?/W?" → 入库 email 严重污染
//     图2 "+ 添加账号" placeholder · 用户依此粘贴
//     图3 微信发货 ("账号:..\n密码:含@\n账号管理器:点tps://..(去掉点)")
//     图4 卡号N:/卡密N: 带数字编号格式
//   · 病诊 (parseAccountText 失道之四):
//     ① 「卡号N:/卡密N:」未在标签词典 · tryPair 错把 "卡号1" 当密码
//     ② 「密码:uuCO4@7hukcO」(密码含 @) `if(!v.includes("@"))` 跳过 → 兜底误为新 email
//     ③ tryPair 仅以 includes("@") 认 email · 卡密 "XuE2@UXoq7JD" 被错当 email
//     ④ 反向配对 (pass 在前 email 在后) 缺失
//   · 治法 (反者·弱者·守一):
//     §A 立 _isValidEmail 严判 (local@domain.tld · 长度5-254 · 不含全角分隔符)
//     §B 扩标签词典 + 兼容 \d* 数字编号:
//        email +卡号|号码|账户名|登录名|登陆名|number|num|e-mail
//        pass  +卡密|密钥|令牌|key|token|access(-token)?
//     §C 标签即定锚·守一不退:
//        密码标签后含@仍为密码 (修②)
//        邮箱标签后必须 isValidEmail 才认 (修④ '账号管理器:URL' 不再误伤)
//     §D tryPair 用 _isValidEmail 替代 includes('@') (修③)
//     §E pendingPass 反向配对 (顺逆皆通)
//     §F _stripWxHints 行尾剥离 (无任何空格)/(去掉点) 等微信提示 · 不弃真主
//     §G _isNoiseLine 整行模板嗅探 (自动发货/订单编号/账号管理器: URL 等开头明确者)
//   · 行为对齐:
//     图3 微信 "账号:foo@gmail.com (无任何空格)\n密码:uuCO4@7hukcO" 识 1 账号 (修前 0)
//     图4 卡号N:/卡密N: 5 卡全识 (修前 0)
//     综合极端 _test_v270_omni_recognize.cjs · 72 过 / 0 败
//   · 道之精要:
//     · 反者道之动 — 反向出发 · 解构识号四病 · 治本不治标
//     · 弱者道之用 — 不整行弃 · 仅剥微信提示尾 · 留真主之身
//     · 唯变所适   — 标签词典极广 · 大方无隅 · 同出异名 · 万法皆归
//     · 守一       — 标签即定锚 · 含@仍为密码 · 不再以"形似邮箱"草率
//     · 大象无形   — 邮箱定准 (RFC 宽放) · 严判 TLD ≥2 letters
//     · 信不足 案有不信 — 测毕 72/0 方为道
//
// v3.0.2 · 反者道之动 · 持久化全量修复 · 道法自然 · 无为而无不为 (2026-05-22):
//   「一」 LOCK_FILE 独立持久化 (v2.7.4 补入) · lock-state.json 专司🔒 · multi-window race-safe
//   「二」 save() 守一同步 _savedAccountMeta (v2.7.3 补入) · 解锁不再悄悄回退
//   「三」 reloadAccounts() 实时读 LOCK_FILE · 反映其他窗口意图
//   「四」 toggleSkip 写 LOCK_FILE + 同步内存快照 · 锁意图即时落盘
//   「五」 verifyAllAccounts try/finally · _verifyAllInProgress 必重置 · 周期验证永不卡死
//   「六」 lock-state.json 文件监视器 · 跨窗口锁变更实时广播
//   「七」 autoVerifyStartupStaleMin (默认15min) · 启动验证不再跳过近期验过号
//   「八」 refresh 消息触发 onlyStale 后台验证 · 手动刷新不再只是 reloadAccounts
// v3.0.3 · 道法自然·无为而无不为 (2026-05-22 晚):
//   「一」 _sessionCache 预缓存体系 — verifyOneAccount 已登录的 sessionToken 缓存
//       loginAccount 弹延 devinLogin (速率限制根源) · 读缓存直射 injectToken
//   「二」 injectFailCooldownMs 软编码 — 原 30s 硬编码改配置 (silent 默认 5s)
//       预缓存命中时基本不再触发速率限制 · 5s 建基足夠口
//   「三」 切号快速通道 — cache 命中时跳过 devinLogin/windsurfPostAuth 整个网络往返
//       平均切号耗时: 3-8s(全登录) → <50ms(缓存命中) — 60倍提速
// v3.0.4 · 水无常形·万格通吃 · 账密解析全量增强 (2026-05-22):
//   「一」 _parseDualLabelLine — 双标签同行通吃 (邮箱：email----密码：pass · 任意顺序·任意分隔)
//   「二」 _stripAnyLabel     — tryPair双侧净化 · 密码含"密码："前缀自动剥取真值
//   「三」 行内标签检测       — email@x.com密码：pass / pass----邮箱：email 等无标准分隔形
//   「四」 JSON数组整体解析   — [{email,password},...] 批量导出格式
//   「五」 bracket标签兼容    — 【邮箱】email【密码】pass 等全角括号形
// v3.0.5 · 反者道之动·邮箱先定密码后识 · 一劳永逸根治 (2026-05-22):
//   「一」 _stripPassCandLabel — 密码候选保守剥 · 只剥中文标签与全英长词 · 不剥 pass/key/secret/pwd 短词
//       根因: _stripAnyLabel 含 pass(?:word|wd)? 使裸 pass/key 等短词也匹配 → pass:word123 被污染为 word123
//   「二」 tryPair 两阶段 — 第一阶裸检邮箱(保留原始密码) · 第二阶剥标签再检(针对有标签前缀的邮箱侧)
//       核心: 密码侧永远使用 _stripPassCandLabel 而非 _stripAnyLabel · 像AI一样 邮箱先锚定密码取余值
//   「三」 _emailAnchorExtract — 同步改用 _stripPassCandLabel · 根治兜底层同一病灶
// v3.0.6 · 损之又损·归零IP限速 · devinLogin 全局序列化+缓存快路 (2026-05-22):
//   【根因七层】: devinLogin = IP级速率限制唯一触发点
//     ① verifyOneAccount 无条件调 devinLogin (无缓存快路) → parallel=3 同时三调 → 直触限速
//     ② loginAccount 有缓存快路但 verifyOneAccount 没有 → verifyAll填cache途中手动切号 → miss → 再触
//     ③ 无全局序列化 → 任何时刻N个并发 devinLogin → IP限速必然
//   「一」 devinLogin 全局序列化门 — _devinLoginGate Promise chain
//       任意时刻只有一个 devinLogin 在飞 · 连续调用间自动保证 wam.devinLoginMinGapMs(默认1200ms)
//   「二」 verifyOneAccount 缓存快路 — 与 loginAccount 对齐
//       有效cache → 直接 tryFetchPlanStatus → 零 devinLogin · 二次verifyAll无任何限速
//       cache失效 → 驱逐 → 走全路 (devinLogin已被序列化保护)
// v3.1.0 · 根治浏览器弹窗 · 道法自然 · 天下之至柔驰骋于天下之致坚 (2026-05-23)
//
//   根因 (逆向 codeium.windsurf dist/extension.js 实证):
//     WindsurfAuthProvider.createSession() → login() → openExternal(loginUrl) = 浏览器弹窗
//     触发链: ① 路甲(hijack) 调 loginWithAuthToken → provideAuthToken() 内 openExternal(loginUrl)
//                  若 hijack 不粘 (Proxy/frozen) 或 Windsurf 在 hijack 前已捕获引用 → 泄漏弹窗
//             ② 路乙(clipboard) 同 loginWithAuthToken → 同理泄漏
//             ③ 路丙(provideAuthTokenToAuthProvider) 返 error 后降级到 ①② → 泄漏
//             ④ 切号窗口内 Cascade panel 检测 "未登录" 发 handleLogin → LOGIN_WITH_REDIRECT → 弹窗
//
//   治法 (三层根治):
//     「一」 openExternal 持久守卫 — 切号全程拦截 windsurf.com/auth URL · 从源头断弹窗
//     「二」 消灭路甲/路乙降级 — 路丙失败仅重试一次 · 不走 loginWithAuthToken (弹窗根源)
//     「三」 token 预验 — loginAccount 全登录路径先 registerUserViaSession 验 token 有效性
//           再 injectToken · 避免 handleAuthToken 内部 registerUser 失败扰动 auth 状态
//
//   帛书四十三章: 天下之至柔，驰骋于天下之致坚；无有入于无间
//   守卫无形(至柔) · 穿透一切弹窗路径(致坚) · 用户无感(无有入于无间)
//
// v3.1.1 · 不着相·不妄为·顺其自然·无为而无不为 (2026-05-23)
//
//   主公诏: 反者道之动·为道者日损·重新完善插件一切体系·最小化变动
//          专注于本源·彻底解决切号速度波动·突破官方一切限制
//          想切号就切号·想切多快就切多快·道并行而不相悖
//
//   反者审视 (v3.1.0 三处「日益」未损 + 一处「妄弃」未持):
//     「日益一」 injectViaJia 函数体 ~58 行 · v3.1.0 已声明永废 · 但代码仍在 → 真死代码
//     「日益二」 injectViaYi 函数体 ~32 行 · 同上 → 真死代码
//     「日益三」 _devinLoginGate Promise chain 互斥锁 ~36 行 · 实效仅等价于 _lastDevinLoginAt
//                单变量 minGap 检查 · Promise 链是繁形 · 简之即顺
//     「妄弃」 _sessionCache 仅 in-memory 15min · sessionToken JWT 实际有效 数小时-数天
//             重启 IDE 即丢 · 用户重启后首次切号必触 devinLogin · 必受 IP 限速 · 必感波动
//
//   治法 (顺其自然·三损一益):
//     「损一」 删 injectViaJia 函数体 (路甲·永废)
//     「损二」 删 injectViaYi 函数体 (路乙·永废)
//     「损三」 _devinLoginGate Promise chain → _lastDevinLoginAt minGap (单变量)
//     「益」 _sessionCache 持久化磁盘 ~/.wam/_session_cache.json
//             activate() 启动加载 → 重启不丢 → 全部账号秒切
//             24h TTL (sessionToken JWT 实际有效远超 in-memory 15min)
//             startup 后台 fire-forget verifyAllAccounts(staleMin=24h) 预热未缓存号
//
//   核心成效:
//     · 切号热路径 = injectViaBing 单步 50-200ms (cache 命中)
//     · 重启不丢 cache · 跨 IDE 会话永久有效 → 永远不再触发 IP 限速
//     · 用户感知: 想切号就切号 · 任意状态下秒级响应 (无 1200ms 序列化等待)
//     · 仅 cache 失效/未热 时才 fallback devinLogin (rare path)
//
//   帛书四十一章: 大成若缺，其用不敝；大盈若盅，其用不窘
//   损死代码 ≠ 缺 · 简日益 = 大成 · 持 sessionToken = 大盈 · 用之不敝不窘
//
//   实证: _test_v311_dao.cjs · 守门四章
//     §A 死代码确删 (injectViaJia/injectViaYi 不存在)
//     §B Promise chain 已简 (无 _devinLoginGate 引用)
//     §C sessionCache 持久化往返 (write→load→hit)
//     §D activate() 暴露 _internals._sessionCache + _persistSessionCache
//
// v3.1.2 · 道法自然·彻底审弊·零增弊端·彻底无感 (2026-05-23)
//
//   主公诏: 道法自然 顺其自然 无为而无不为
//          彻底审视所有方案弊端·彻底实现不增加任何弊端同时解决所有之问题
//
//   v3.1.1 残弊 (现场实证·用户报 × devinLogin: Rate limited later):
//     「弊一」 activate 后 8s prewarm verifyAll(staleMin=1440·parallel=2)
//             首次部署 cache 空 → 对所有 N 号挨个 devinLogin → IP 限速雪崩
//     「弊二」 startup auto-verify (30s) + periodic verify (30min) 仍批量
//             叠加 prewarm 三路并发 → 限速根源
//     「弊三」 _getCachedSession 用 _cfg(15min) 死阈值 · 磁盘加载来 24h entry 实际仅 15min 后失效
//             v3.1.1 持久化承诺 24h · 实际仅生效 15min (隐藏 bug)
//     「弊四」 cache hit 不续期 cachedAt → 24h 后活跃号必 cache miss → 必触 devinLogin
//     「弊五」 devinLogin 无限速感知 → 触发后无限重打服务器 · 永不退避
//
//   方案审弊 (反观三路 · 唯零弊端方可顺其自然):
//     方案A·全关 → 弊: 重启后 health 陈旧 · 冷号不验 · 体验降
//     方案B·感知 → 弊: 三路并发未除 · 首次仍限 (感知是事后补救)
//     方案C·慢预 → 弊: 主动切号也等 12s · 12min 内仍可能批量冲突
//     方案D·零弊 → 自动路径仅 verify cache 内号 (走 fast-path · 零 devinLogin)
//                未 cache 号 lazy on user switch (单次 · 永不批量)
//                + 限速感知 + cache hit 续期 + TTL 修隐藏 bug
//
//   治法 (顺其自然·三损三益·零增弊端):
//     「损一」 删 v3.1.1 prewarm (line 6169-6193) · 限速重叠源
//     「损二」 startup auto-verify 改 _cacheOnly=true · 仅 verify cache 内号
//             cache 内号走 tryFetchPlanStatus(apiKey) fast-path · 零 devinLogin
//             未 cache 号不主动批量 · 用户切到时 lazy login (单次·不限速)
//     「损三」 periodic verify 同改 _cacheOnly=true · 与启动同步
//     「益一」 devinLogin 限速自感知 (auto 5min backoff window)
//             响应 429 / json error 含 rate/limit → 设 _devinLoginRateLimitedUntil = now + 5min
//             入口检查窗口 → 命中即立返 · 零网络 · 永不打死服务器
//             配置 wam.devinLoginRateLimitWindowMs (默 300000ms · 0=关)
//     「益二」 _getCachedSession 命中续期 cachedAt + 修 TTL 隐藏 bug
//             命中后 c.cachedAt = Date.now() · 异步 _persistSessionCache (debounce)
//             过期检查优先用 entry.maxAgeMs (磁盘加载 24h) · fallback _cfg
//             效果: 活跃号永不过期 · 冷号 24h 后自然清理
//     「益三」 verifyAllAccounts 支持 {_cacheOnly:true} 选项
//             队列构建时过滤 _getCachedSession 为 null 的号 · 仅保留 cache 内号
//
//   零弊端确认 (审视所有可能弊端 · 一一闭环):
//     · 自动批量? → 删 (零 devinLogin·零限速)
//     · 重启 health 陈旧? → cache 内号仍刷新 (走 fast-path)
//     · 冷号不验? → lazy on switch · 反正未 cache 号必走 devinLogin · 现按需
//     · 限速误伤主动切号? → cache hit 不调 devinLogin·无影响 · 仅 cache miss 受影响 5min
//     · IO 风暴? → cache hit 续期走 _persistSessionCache debounce 500ms · 已合并
//     · 主动批量按钮? → 保留 + 限速感知保护 · 用户自主决定冒险
//
//   核心成效:
//     · 启动期零 devinLogin (cache 空时跳过 · cache 有则 fast-path)
//     · 切号热路径 = injectViaBing 单步 50-200ms (cache 命中 · 99%)
//     · cache miss 切号 = lazy 单次 devinLogin · 1-3s · 之后该号永久秒切
//     · 限速触发 → 5min 自动退避 → cache 切号无感
//     · 永不再批量 devinLogin → 永不再触发 IP 限速
//
//   帛书六十四章: 为之于其未有也，治之于其未乱也
//   未有之时即不为 (零批量) · 未乱之时即治 (限速感知) · 万乱不生
//
//   实证: _test_v312_dao.cjs · 守门四章
//     §A 弊一已损 (无 v3.1.1 prewarm setTimeout)
//     §B 弊三/四已益 (cache hit 续期 · entry.maxAgeMs 优先)
//     §C 益一限速感知 (window 内 devinLogin 立即拒绝)
//     §D 益三 _cacheOnly 队列过滤 (verifyAllAccounts 支持选项)
//
// v3.1.3 · effQuota 一以贯之 · 道法自然 · 反者道之动 (2026-05-23):
//   病灶: tick 判耗尽用 effQ = Math.min(D, W) · 但 _scoreOf 用 W*8+D*3
//     D=0/W=50 → effQ=0 触发切号 → _scoreOf 给 400 分 → 选入即刻再耗尽 → 无限循环
//   根因: 评分维度与实际可用性定义不对齐 · 天下大乱
//
//   ━━━ 四修 (损之又损 · 一以贯之) ━━━
//   「损一」 _scoreOf 正常模式: effQ < threshold → 大幅降权 (1-55分)
//     与 tick effQuota 定义完全对齐 · D=0/W=50 不再得高分
//   「损二」 _isValidAutoTarget 守门: 已验号 effQ < threshold → false
//     预选/候补/重试三路径均受守门 · 杜绝切入即耗尽
//   「损三」 getStats exhausted: 改用 effQ<1 计 (非仅双零)
//     D=0/W=50 → effQ=0 → 计入 exhausted (统计真相 · UI 如实反映)
//   「益一」 _doAutoSwitch: 首次+重试均加 _isValidAutoTarget 守门
//     getBestIndex 返低分号仍需验证 · 无有效候选即停 (不浪费 login)
//
//   道法自然 (37章): 道恒无名·侯王若守之·万物将自化
//     effQuota 为「一」· 评分/守门/统计皆归于此 · 一以贯之 · 万源自化
//
// v3.2.1 · 额度重置感知 · 无为而无不为 (2026-05-23):
//   天发杀机 · 移星易宿 — 额度重置瞬间自动全池刷新
//
//   ━━━ 重置感知 (道法自然·天人合发) ━━━
//   「感知」 _scheduleResetRefresh() — 精准 setTimeout 到下次重置时刻
//     每日 UTC 08:00 (北京 16:00) → 日额度重置 · 全池自动刷新
//     周日 UTC 08:00 (北京 周日 16:00) → 周+日额度重置 · 全池自动刷新
//   「效果」 耗尽号在重置瞬间自动复活 · 用户无感 · 系统无不为
//   「承」 v3.2.0 三处归一 + 去芜存菁
//
//   迅雷烈风 · 莫不蠢然 · 至乐性余 · 至静性廉
//
// v3.3.0 · 💎 额度绝对优先分层 · 反者道之动 · 存量先于流量 (2026-05-24):
//   反者道之动 · 弱者道之用 · 天下之物生于有 · 有生于无 — 帛书《老子》德经
//
//   ━━━ 解构本源 (先解构隐藏在需求下的底层目标) ━━━
//   · overage = Stock(存量·真金白银·不可再生·不用即损沉没)
//   · 百分比  = Flow (流量·周期重置·自然回潮·等待无损)
//   · 经济学本质截然不同 · 不应同坐标系比大小
//
//   ━━━ 病灶 (v3.2.1 之前 · 错误抽象) ━━━
//   _scoreOf 把 overage 与百分比塞同一连续坐标系打分:
//     overage:  300+min(100,$) +时效 ≈ 150~460 分
//     百分比:   W*8+D*3+时效         ≈ 0~1830 分 (W50/D50 即 480~)
//   → 主公图1 $195/$189/$208 等额度账号全部得 400 分 (被 min(100,$) 封顶)
//   → 实际行为反向: 百分比账号被优先消耗 · 额度账号被冷落浪费 · 与用户诉求相悖
//
//   ━━━ 治法 (九竅之邪在乎三要 · 可以動靜 · 分层各得其所) ━━━
//   第三层 💎 overage 池   [1_000_000, 1_099_950]
//     基础 1_000_000 · 内排按 overageDollars × 100 (全幅可比 · 去封顶)
//     $208=1_020_800 > $195=1_019_500 > $193=1_019_300 > $189=1_018_900 > $185=1_018_500
//   第二层 📊 百分比池      [1, 9_999]  上限封顶 · 永不突破第三层
//     沿用 v3.1.3 effQ 守门 · effQ<threshold 大幅降权
//   候补层 ⏳ 未验号        100  · 与 v3.0 一致 · 不夺主权 · 等 verify 决定真相
//   -∞   永禁              无密码 / 用户主动锁
//
//   ━━━ 自然顺应 (无为而无不为 · 一以贯之) ━━━
//   1. getBestIndex/getSortedIndices 天然受益 · 无需改动调用方
//   2. 当前 active 是 overage 切号 → 自然选下一 overage (excludeIdx 排自己)
//   3. overage 全耗 (overageActive=false) → 自然下沉百分比层
//   4. 重置时刻 overage 复活 → _scheduleResetRefresh 触发 verify → 自然上跃
//
//   ━━━ 门控 ━━━
//   wam.preferOverageFirst (默认 true · 道法自然) · false 回退 v3.2.1 兼容
//
//   ━━━ 守门 ━━━
//   _test_v330_overage_priority.cjs
//   · overage 永远 > 百分比 (无论 W%/D% 多高)
//   · overage 内部按金额排 ($208>$195>$193 顺序保留)
//   · overage 全锁 → 下沉百分比
//   · overage 全无 → 自然百分比
//   · 锁号 (skipAutoSwitch) 即使有 overage 也跳过
//
//   ━━━ 诉求印证 (用户原话) ━━━
//   "就是有额外额度的，就有额度的就先用额度的"
//   "百分比制的是没有额度之后才会跳转到百分比制"
//   "优先把有额度的账号先用完，而非先把有百分比的账号先用完"
//   → 完全实现 · 道法自然 · 无为而无不为
//
// v3.7.2 · 两向根治「未验证」· 道法自然 · 无为而无不为 (2026-05-25):
//   ━━━ 正向 (防止问题) ━━━
//   「一」store.load 备份恢复链: 主文件损坏/缺失 → 自动降级 ~/.wam/backups/ 日备份 → 无感恢复
//   「二」_persistSessionCache 防抖 500ms→100ms · 缩短断电丢 token 窗口
//   ━━━ 反向 (出现即自动修复) ━━━
//   「三」startup auto-verify: 不管何因 · 只要检测到未验号 → 立即全量自动加速验证
//         cache空+未验号>0 → verifyAllAccounts({onlyStale:false}) 全量加速
//         现有 isFirstTime 保护 (>50%未验→parallel=2·1500ms gap) 保驾护航
//         用户启动IDE → 后台自动验 → 2-5min全池复活 · 无需任何手动操作
//         cache非空 → 走原 _cacheOnly 快路 · v3.7.1 行为完全兼容 · 零退化
//   道: 「无为而无不为」·「民莫之令而自均焉」· 未验自愈 · 断电无感
//   守门: _test_v372_bidir.cjs · §A版本 · §B备份恢复 · §C启动反向 · §D sessionCache
//
// v3.7.3 · 断电防护集成 · 取两对话精华于WAM · 道法自然 · 无为而无以为 (2026-05-25):
//   来源: Conversation Loss Recovery 对话 (断电五层链式失效根因分析)
//   「一」_isValidPb() — .pb 健康识别函数
//       断电特征: size < 28B (12B nonce + 16B GCM tag 最小加密单元)
//       备份时跳过损常文件 → 不把断电祝事存入备份 → 备份质量保证
//   「二」_checkCascadeHealth() — 启动健康扫描函数
//       扫描 cascade/ 内所有 .pb 文件的健康状态
//       发现损常文件 → 日志 + Windsurf 内部警告 + 指引修复路径
//       正常却不打扰: 静默扫描 → 五感无为
//   「三」备份质量防守 — _backupConversations + _doIncrementalBackup 加健康检查
//       备份前先过 _isValidPb() 关 → 损常文件不备份入库
//       无为而无以为: 用户不知知 → 备份本身绽不受损
//
// v3.7.5 · 反者道之动 · 对话追踪前端关闭 + 提醒频率根治 · 道法自然 (2026-05-25):
//
//   ━━━ 三治 (逆流审视 v3.7.4 · 反者道之动) ━━━
//
//   「一」对话面板手动关闭 — 每条卡住/死亡对话新增 × 关闭按钮
//     根因: 用户无法主动关闭卡住通知 · 只能等 10min 自动消退 · 体验差
//     现象: DEAD 对话残留面板 · 须等引擎自然清理 · 用户无为但体感有为
//     治法: 新增 _dismissedConvUuids(Map) · 用户点 × → 本地静默 10min
//           面板立即消失 · 通知暂停 · 10min 自动过期重新显示
//     道: 「民之不畏威·则大威将至」· 轻叩即散 · 无为而无以为
//
//   「二」提醒频率根治 — 旧法周期再通知，v13.2 后归于“一次性闸门”
//     根因: CRITICAL 对话卡死时周期弹 Toast，久则扰民
//     治法: 同一 uuid 同一异常生命周期只提示一次；恢复/离开 stuckList 后才释放
//     道: 「知止不殆·可以长久」· 一知即止
//
//   「三」手动关闭联动 _processHubStuck — dismiss 后 10min 内彻底静默
//     治法: stuck 循环先 add curStuckUuids(防误触 recover) · 再检查 dismiss
//           dismiss 未过期 → continue 跳过通知; 过期 → 自动清除并恢复
//     道: 「反也者道之动」· 柔弱胜刚强 · 10min 后自然复生
//
// v3.7.6 · 道法自然 · 三根修 · 切号守门+关闭持久化+多窗同步 (2026-05-26):
//
//   ━━━ 三根修 (逆流审视 v3.7.5 · 反者道之动) ━━━
//
//   「一」切号守门根治 — 彻底封堪 D=0/W=0/过期账号进入切号路径
//     根因一: rotateNext 未调 _isValidAutoTarget → 0%/过期号被尝试登录
//     根因二: _scoreOf 双零真耗尽返回 1分而非 -Infinity → 中殼候选池
//     根因三: _isValidAutoTarget 未检 credits → quota=0但credits充裕的号被拒
//     根因四: _tick isExhausted 未豆免 credits → credits充裕时仍触发切号
//     治法: rotateNext for-loop 加 _isValidAutoTarget(守门二层)
//           _scoreOf 双零+无credits+无overage → -Infinity(真排除)
//           _isValidAutoTarget 加 credits 可用 → 放行
//           _tick isExhausted 加 credits 豁免
//     道: 「知止所以不殺」· 守门不争 · 耗尽即止
//
//   「二」× 关闭即时响应 — 点击立即消失· 无需等服务端
//     根因: dismissConv() 发 postMessage 后需等服务端渲染回传 → 用户感知延迟
//     治法: button 加 data-uuid 属性 · 点击立即 .remove() 本地消除 · 服务端异步确认
//     道: 「动其机·万化安」· 先动后静 · 轻叩即散
//
//   「三」 dismiss 跨窗口持久化 — DISMISS_FILE 专司持久·多窗自宾
//     根因: _dismissedConvUuids 仅内存 → 重启丢失·多窗口互不感知
//     治法: _saveDismissedToDisk/_loadDismissedFromDisk · atomicWrite 长存
//           fs.watchFile(_conv_dismiss.json) 跨窗同步: A窗口dismiss
//           → 写_conv_dismiss.json → B窗口watchFile触发 → B自动同步
//           启动时加载磁盘状态 · 10min 过期自动清理
//     道: 「小邦寺民·各得其欲·大者宜为下」· 多窗共守一文件 · 无为而自均
//
// v3.8.0 · 道法自然 · 四根修 · 10min静默+通知频控+计数修正+启动围栏 (2026-05-26):
//
//   ━━━ 四根修 (逆流审视 v3.7.6 · 反者道之动 · 弱者道之用) ━━━
//
//   「一」 10min 以上卡住 → 静默 (不通知·不显示)
//     根因: 卡住>10分钟的对话已无时效性 · 持续弹窗只打扰用户
//     现象: staleSec=25min/57min/58min 持续弹 Toast · 用户不胜其烦
//     治法: STUCK_STALE_MAX=600 · staleSec>600 → 自动 dismiss + 不弹通知
//     道: 「多言数穷·不如守中」· 已过时效则静默无扰
//
//   「二」 同一对话同一异常生命周期只通知1次 · 降低频率
//     根因: CRITICAL/DEAD 对话周期再通知 · 无限循环骚扰
//     现象: 同一对话 Toast 反复弹出 (初始+仍+仍+仍...)
//     治法: _hubLastStuckUuids + _conv_notify_claims 跨窗口 claim
//           首次通知1次 → 恢复/离开 stuckList 才释放 → 下一轮异常再提示
//     道: 「知止不殆·可以长久」· 一次足矣·过犹不及
//
//   「三」 有效计数从 visibleStuck 直算 (彻底修正错误17)
//     根因: hub.error=17 含所有历史 unknown_error 对话 (大量陈旧)
//     现象: 面板「错误17」与实际可见卡住列表严重不符
//     治法: _effectiveStuck/_effectiveError 从 visibleStuck 按 level 直接统计
//           DEAD→error · WARNING/CRITICAL→stuck · 历史数据不再污染
//     道: 「扣其锐·解其纷」· 眼见为实·不虚标
//
//   「四」 Windsurf 重启围栏 — 预启动卡住对话自动清零
//     根因: SP 跟踪器独立于 Windsurf · _hub.json 跨重启持久
//     现象: 重启后仍显示前一会话的「DEAD」/「CRITICAL」对话 (staleSec=54min)
//     治法: _wamStartTs 启动时间戳 · staleSec*1000 > uptime+缓冲
//           → 该对话卡住于 WAM启动前 → 自动 dismiss + 上盘
//     道: 「那个不是这个」· 前会话不守后会话 · 启启即清
//
// v3.7.4 · 反者道之动 · 根治「未验号永远未验」· 道法自然 · 太上下知有之 (2026-05-25):
//   ━━━ 病灶逆流审视 ━━━
//   v3.7.2 修复逻辑: if (_sessionCache.size === 0) { 检测未验号 → 全量验证 }
//     错误根因: _loadSessionCacheFromDisk() 在 activate 时已从磁盘加载
//     实际效果: _sessionCache.size 几乎永远 > 0 → 此门永远不开
//     全量验证路径: 从未被走到 → 未验号永久停留「未验」
//   ━━━ 三处根治 ━━━
//   「一」启动验证 — 先查未验号数量·再决策 (不受 cache 状态影响)
//       _uncheckedOnStart > 0 → onlyStale:false 全量验证 (无论 cache 多满)
//       无未验号 + cache空 → 跳过
//       无未验号 + cache非空 → _cacheOnly stale 快路 (v3.7.1 兼容)
//   「二」手动刷新 — 同步查未验号 · 有则走全量而非 onlyStale
//   「三」周期验证 — 同步查未验号 · 有则走全量
//   ━━━ 道 ━━━
//   未验号本不该留 · 只是门没开 · 门一开 · 民自化 · 无为而无不为
//
const VERSION = "3.16.0";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36";
const WINDSURF = "https://windsurf.com";
const REGISTER_BASE = "https://register.windsurf.com";
const URL_DEVIN_LOGIN = WINDSURF + "/_devin-auth/password/login";
const URL_POSTAUTH =
  WINDSURF +
  "/_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth";
const URL_REGISTER_USER =
  REGISTER_BASE + "/exa.seat_management_pb.SeatManagementService/RegisterUser";
// v2.4.1 · 真路径 GetUserStatus · 顺试多 endpoint (地区/自部署分流)
//   实测默认 codeium.com 立即 200 · 自部署区/EU 用户动态 apiServerUrl 优先
const URL_GET_USER_STATUS_LIST = [
  "https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetUserStatus",
  "https://server.self-serve.windsurf.com/exa.seat_management_pb.SeatManagementService/GetUserStatus",
  "https://windsurf.com/_route/api_server/exa.seat_management_pb.SeatManagementService/GetUserStatus",
];
// 兼容别名 (旧代码路径 + 导出 · 语义已转移)
const URL_GET_PLAN_STATUS_LIST = URL_GET_USER_STATUS_LIST;
// v2.6.0 · 软编码 · 会话 token 格式单点定义 · 后端变更时仅此一处修
const RE_SESSION_TOKEN = /^devin-session-token\$/;
const URL_DEVIN_ORG_AUTH = "https://app.devin.ai/api/users/post-auth";
// v3.13.0 · Devin Desktop 自适应 · 179实测修正 · 命令名已全面迁移为 devin.* 前缀
//   旧版 Windsurf: windsurf.provideAuthTokenToAuthProvider (单一命令)
//   新版 Devin Desktop: devin.provideWindsurfAuthTokenToAuthProvider (session token 注入)
//                      + devin.provideDevinAuthCodeToAuthProvider (auth code 注入)
//   自动检测: 先试 devin.* 新命令 · 未注册则试 windsurf.* 旧命令 · 零配置自适应
//   检测结果缓存于 _detectedAuthProvider · 全生命周期一次检测 · 不重复开销
const _AUTH_COMMANDS = {
  PROVIDE_AUTH_TOKEN: [
    "devin.provideWindsurfAuthTokenToAuthProvider",
    "windsurf.provideAuthTokenToAuthProvider",
    "devin.provideAuthTokenToAuthProvider",
  ],
  PROVIDE_DEVIN_AUTH_CODE: ["devin.provideDevinAuthCodeToAuthProvider"],
  LOGIN_WITH_AUTH_TOKEN: [
    "devin.loginWithAuthToken",
    "windsurf.loginWithAuthToken",
  ],
  LOGOUT: ["devin.logout", "windsurf.logout"],
  LOGIN: ["devin.login", "windsurf.login"],
  CANCEL_LOGIN: ["devin.cancelLogin"],
};
let _detectedAuthProvider = null; // 'windsurf' | 'devin' | null (未检测)
// v3.13.0 · 自适应命令检测 · 顺试 _AUTH_COMMANDS 内候选 · 首个可用即缓存
//   原理: vscode.commands.getCommands() 返回所有已注册命令 · 匹配前缀即知品牌
//   缓存: _detectedAuthProvider · 全局一次 · 零重复开销
async function _detectAuthCommands() {
  if (_detectedAuthProvider) return _detectedAuthProvider;
  try {
    const allCmds = await vscode.commands.getCommands(true);
    // v3.13.0 · 179实测: extensionId=codeium.windsurf 但命令前缀=devin.*
    //   因此必须基于命令名检测 · 不能依赖扩展ID
    //   检测顺序: devin.* 新命令优先 → windsurf.* 旧命令回退
    for (const candidate of _AUTH_COMMANDS.PROVIDE_AUTH_TOKEN) {
      if (allCmds.includes(candidate)) {
        _detectedAuthProvider = candidate.startsWith("devin.")
          ? "devin"
          : "windsurf";
        log(
          "自适应检测: authProvider = " +
            _detectedAuthProvider +
            " (命令: " +
            candidate +
            ")",
        );
        return _detectedAuthProvider;
      }
    }
    // fallback: 检查 devin.* 其他命令 (login/logout)
    const hasDevinCmd = allCmds.some(
      (c) =>
        (c.startsWith("devin.") && c.includes("login")) || c.includes("logout"),
    );
    if (hasDevinCmd) {
      _detectedAuthProvider = "devin";
      log("自适应检测: authProvider = devin (发现 devin.* login/logout 命令)");
    } else {
      _detectedAuthProvider = "windsurf"; // 默认回退
      log(
        "自适应检测: authProvider = windsurf (默认回退 · 未检测到 devin.* 命令)",
      );
    }
  } catch (e) {
    _detectedAuthProvider = "windsurf";
    log("自适应检测: 回退 windsurf (" + (e.message || e) + ")");
  }
  return _detectedAuthProvider;
}
// v3.13.0 · 获取自适应命令名 · 顺试候选列表 · 首个可用即返
async function _getAuthCommand(key) {
  const provider = await _detectAuthCommands();
  const candidates = _AUTH_COMMANDS[key] || [];
  // 优先返回已检测到的 provider 对应的命令
  for (const c of candidates) {
    if (c.startsWith(provider + ".")) return c;
  }
  return candidates[0] || ""; // fallback 第一个
}
// v2.4.0 · 全局 endpoint 健康度追踪 · 连续 401 时跳过 verifyAll · 不浪费请求
let _quotaEndpointHealth = {
  consecutive401: 0, // 连续 401 计数
  consecutiveOk: 0, // 连续成功计数
  lastSuccess: 0, // 最近一次成功 ts
  lastFailReason: "", // 最近一次失败原因 (status / error)
  totalCalls: 0, // 总调用数
  totalOk: 0, // 总成功数
  totalFail: 0, // 总失败数
};
function _quotaEndpointDead() {
  // 连续 ≥ 5 次 401 + 30min 内无成功 → 判定 endpoint 已挂
  if (_quotaEndpointHealth.consecutive401 < 5) return false;
  if (_quotaEndpointHealth.lastSuccess === 0) return true;
  return Date.now() - _quotaEndpointHealth.lastSuccess > 30 * 60 * 1000;
}
const HTTP_TIMEOUT_MS = 12000;
const WAM_DIR = path.join(os.homedir(), ".wam");
const STATE_FILE = path.join(WAM_DIR, "wam-state.json");
// v2.7.4 (补入v3.0.2) · 道恒无名·侯王若能守之·万物将自宾·民莫之令而自均焉 (三十二章)
//   独立🔒持久化 · 专司一事 · 不被 multi-window race 污染 wam-state.json 大对象
//   只有 toggleSkip 读写 · save() 从此文件读 · multi-process 自宾不争
const LOCK_FILE = path.join(WAM_DIR, "lock-state.json");
// v3.7.6 · dismiss 跨窗口持久化 · 小邦寺民·各得其欲·大者宜为下
const DISMISS_FILE = path.join(WAM_DIR, "_conv_dismiss.json"); // uuid→ts 共享持久文件·多窗口共守
const CONV_DISMISS_TTL = 600000; // 10min dismiss 自动过期时长
// v13.2 · 通知一次性闸门 · 跨窗口共享 · 同一异常生命周期只弹一次
const CONV_NOTIFY_DIR = path.join(WAM_DIR, "_conv_notify_claims"); // uuid.json 存在 = 本轮异常已提示
const BACKUP_DIR = path.join(WAM_DIR, "backups");
const PENDING_TOKEN_FILE = path.join(WAM_DIR, "_pending_token.json");
const MAX_BACKUPS = 10;
// v3.4.0 · 三界归一 · Hub 总线 + 对话追踪 (卅辐同一毂·当其无有·车之用也)
const HUB_FILE = path.join(WAM_DIR, "_hub.json");
const PB_DIR =
  _resolveCascadePbDir() ||
  path.join(os.homedir(), ".codeium", "windsurf", "cascade"); // v3.16.0: 动态解析 Devin/Windsurf
const CONV_BACKUP_DEFAULT = path.join(WAM_DIR, "conversation_backups");
// 道法自然 · 居善地 · 不再硬编码盘符 (v2.1.2: V:\ → __dirname 自适应)
// 扩展安装目录优先 (随扩展走) · 工作目录开发模式可见 · 兼容 VSIX/symlink/源码三种部署
const ACCOUNTS_DEFAULT_MD = path.join(__dirname, "账号库最新.md");
// v2.6.2 · 跨实例声明目录 (多窗口防重复触发)
const L6_CLAIM_DIR = path.join(WAM_DIR, "_l6_claim");

let _output = null,
  _ctx = null,
  _statusBar = null,
  _sidebarProvider = null,
  _editorPanel = null,
  _store = null,
  _engine = null,
  _verifyAllInProgress = false,
  _wamMode = "wam", // 'wam' | 'official' (本源同款) · 默认 wam · 用户自显式选官方时停引擎
  _switching = false, // 切号互斥锁 (本源 v17.42.7)
  _uiAddOpen = false, // v3.0.5 · 添加账号展开状态 · 跨 refresh 持久 · 防回退闪烁
  _switchingStartTime = 0,
  _lastSwitchTime = 0, // 上次切号成功时间 (冷却用)
  _predictiveCandidate = -1, // 预判候选 idx (本源 v8 · 额度低时提前选好下一号)
  _lastInjectFail = 0, // 上次注入失败时间 (rate-limit 拦截冷却)
  _lastDevinLoginAt = 0, // v3.0.6 上次 devinLogin 完成时间 · 全局最小间隔保证
  _broadcastUITimer = null, // v3.0.6 broadcastUI 防抖定时器 · 合并高频调用
  _openExternalGuardActive = false, // v3.1.0 openExternal 守卫开关 · 切号期间拦截 auth URL 弹窗
  _lastDocChangeAt = 0, // 最近文档变化时间 (Cascade 流式避让 · 对齐本源 v17.42.5)
  _lastSwitchMs = 0, // 上次切号耗时ms (对齐本源 switchToAccount.ms)
  _lastPerMsgTriggerAt = 0, // v2.5 per-msg 触发防抖
  _perMsgHits = 0, // v2.5 Layer 6 命中累计 (诊断)
  _perMsgRotates = 0, // v2.5 Layer 6 触发切号累计 (诊断)
  _quotaPulseCount = 0, // v2.6.11 道恒无名 · W%脉动信号累计 (真本源·后端计费增量计数)
  _lastQuotaWeekly = -1, // v2.6.11 上轮 weekly% (初始 -1 ·其他为 0-100)
  _lastQuotaEmail = "", // v2.6.12 守一 · 上轮 weekly% 对应 email · 切号后清·防跨账号假脉动
  _lastQuotaPulseAt = 0, // v2.6.12 守一 · 上次真脉动时刻 · WAL/pb 在窗口内让位
  _quotaPulseSuppressedCount = 0, // v2.6.12 守一 · 跨账号假脉动屏蔽计数 (诊断)
  _quotaDeltaCount = 0, // v2.6.13 阴阳结合 · ⚖额度变动信号累计 (阴·辅·诊断)
  _lastQuotaDaily = -1, // v2.6.13 阴 · 上轮 daily% (Pro plan 主用 · 与 weekly 维度互补)
  _lastQuotaPromptCredits = -1, // v2.6.13 阴 · 上轮 promptCredits (微观池·绝对数)
  _lastQuotaFlowCredits = -1, // v2.6.13 阴 · 上轮 flowCredits (微观池·绝对数)
  _lastRotateToastAt = 0, // 状态栏切号反馈 3s 高亮
  _lastRotateToastEmail = "", // 状态栏切号反馈上次 email
  _layer6Stop = null, // Layer 6 dispose 函数
  _resetRefreshTimer = null, // v3.2.1 · 额度重置感知定时器 · 精准唤醒
  _hardExhaustWatchdogTimer = null, // v15.0 · 硬耗尽看门狗 · 独立 2s 周期检测
  // v3.5.0 · 道法自然 · 对话追踪 Hub 状态 (天下之至柔·驰骋于天下之致坚)
  _hubData = null, // Hub 总线最新数据 (stuck 字段)
  _hubLastNotifyAt = 0, // Hub stuck 通知冷却时间戳
  _hubLastStuckUuids = new Map(), // uuid → { ts, name, level } · 本轮异常已通知闸门 (恢复才清)
  _stuckFirstNotifyTs = new Map(), // v13.0 · uuid → 首次通知时刻 (永不自删 · 10min自动消失基准)
  _activeNotifyResolvers = new Map(), // v3.12.1 · uuid → toast resolve fn · 对话恢复时主动消除通知
  _hubWatchDebounce = null, // Hub 文件监视防抖
  // v3.6.0 · 自动备份系统 (无为而无不为·不争而善胜)
  _convPbWatcher = null, // .pb 目录增量监视器
  _autoBackupDone = false, // 本次启动初始全量备份是否已完成
  _lastBackupDate = "", // 最近备份日期 (防当日重复)
  _incrementalDebounce = null, // 增量备份防抖计时器
  _hubLastRecoverNotify = 0, // 恢复通知冷却
  _hubPollTimer = null, // Hub 轮询定时器 (fs.watchFile 的保底)
  _stuckStatusBar = null, // 卡住状态 StatusBar (持久可见 · 根治弹窗消失后零感知)
  // v3.10.0 · 归一 · 卡住引擎子进程管理 (道生之·德畜之·长之·遂之)
  _stuckEngineProcess = null, // child_process 实例
  _stuckEngineRestarts = 0, // 重启计数 (诊断)
  _stuckEngineLastStart = 0, // 最后启动时间戳
  // v13.0 · 对话标题池 · uuid→title · 从备份索引构建·为前端标题显示提供兜底
  _convTitleMap = {}, // uuid → title (永久缓存 · 备份后旴新)
  // v3.7.5 · 对话手动关闭 · 反者道之动 · 道法自然
  _dismissedConvUuids = new Map(), // uuid → dismissTs · 10min 自动过期 · 用户手动关闭对话提醒
  // v3.7.6 · dismiss 持久化防抖 · 多窗口同步
  _dismissWatchDebounce = null, // dismiss 文件监视防抖定时器
  // v3.7.7 · 启动围栏 · staleSec > uptime+缓冲 → 该对话卡住于 WAM 启动前 → 自动清零
  _wamStartTs = Date.now(); // WAM activate 时刻 · 启动围栏基准时间戳
// v2.4.4 · log 落盘 (~/.wam/wam.log · 2MB 滚动 · 外部诊断可读)
let _logFileInit = false;
const _logMaxBytes = 2 * 1024 * 1024;
function _logToFile(line) {
  try {
    const home = os.homedir();
    if (!home) return;
    const p = path.join(home, ".wam", "wam.log");
    if (!_logFileInit) {
      try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
      } catch {}
      _logFileInit = true;
      // 启动时若超过 2MB · 截取尾部 1MB
      try {
        const st = fs.statSync(p);
        if (st.size > _logMaxBytes) {
          const buf = Buffer.alloc(_logMaxBytes / 2);
          const fd = fs.openSync(p, "r");
          fs.readSync(fd, buf, 0, buf.length, st.size - buf.length);
          fs.closeSync(fd);
          fs.writeFileSync(p, "[rolled] ...\n" + buf.toString("utf8"));
        }
      } catch {}
    }
    fs.appendFileSync(p, line);
  } catch {}
}
function log(m) {
  const t = new Date().toISOString().substring(11, 23);
  const line = "[" + t + "] " + m;
  if (_output) _output.appendLine(line);
  try {
    console.log("[wam] " + m);
  } catch {}
  _logToFile(line + "\n");
}
function _cfg(k, d) {
  return vscode.workspace.getConfiguration("wam").get(k, d);
}
function _notify(level, msg) {
  if (_cfg("invisible", false)) return;
  const lvl = _cfg("notifyLevel", "notify");
  if (lvl === "silent") return;
  if (lvl === "notify" && level === "verbose") return;
  if (level === "error") vscode.window.showErrorMessage(msg);
  else if (level === "warn") vscode.window.showWarningMessage(msg);
  else vscode.window.showInformationMessage(msg);
}
// v3.8.1: 自动消失通知 · 知止不殆 · 可以长久
// 与 _notify 的区别: 通知会在 ttlMs 后自动从通知中心完全消失
// 用于卡住/死亡等有时效性的通知 · 无需用户手动清除 · 10min 自然淡去
// 实现: vscode.window.withProgress(ProgressLocation.Notification)
//   → Promise resolve 时通知消失 · cancellable=true 支持用户手动关闭
// v3.12.1: 新增 _convUuid 参数 — 注册外部 resolve 句柄到 _activeNotifyResolvers
//   → 对话恢复时调用 _resolveConvNotify(uuid) 主动消除 toast (不等 10min)
//   三路消除: ① 10min自动超时 ② 用户点取消 ③ 对话恢复(外部调用)
function _notifyTimed(level, msg, ttlMs, _convUuid) {
  if (_cfg("invisible", false)) return;
  const lvl = _cfg("notifyLevel", "notify");
  if (lvl === "silent") return;
  if (lvl === "notify" && level === "verbose") return;
  ttlMs = ttlMs || 600000; // 默认 10min 自动消失
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: msg,
      cancellable: true,
    },
    (progress, token) =>
      new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (_convUuid) _activeNotifyResolvers.delete(_convUuid); // 超时清除句柄
          resolve();
        }, ttlMs);
        // v3.12.1: 注册外部取消句柄 (对话恢复路径调用)
        if (_convUuid) {
          _activeNotifyResolvers.set(_convUuid, () => {
            clearTimeout(timer);
            _activeNotifyResolvers.delete(_convUuid);
            resolve();
          });
        }
        token.onCancellationRequested(() => {
          clearTimeout(timer);
          if (_convUuid) _activeNotifyResolvers.delete(_convUuid);
          resolve();
        });
      }),
  );
}
// v3.12.1: 外部主动消除某对话的 toast (对话恢复时调用)
function _resolveConvNotify(uuid) {
  const fn = _activeNotifyResolvers.get(uuid);
  if (fn) fn(); // fn 内部已含 delete + resolve
}
function _convNotifyClaimPath(uuid) {
  const safe = String(uuid || "").replace(/[^a-zA-Z0-9_-]/g, "");
  return safe ? path.join(CONV_NOTIFY_DIR, safe + ".json") : "";
}
function _claimConvNotify(uuid, info) {
  try {
    const file = _convNotifyClaimPath(uuid);
    if (!file) return false;
    ensureDir(CONV_NOTIFY_DIR);
    // wx = 独占创建；多窗口同时处理同一 Hub 时只有一个窗口能抢到。
    const fd = fs.openSync(file, "wx");
    try {
      fs.writeFileSync(
        fd,
        JSON.stringify(
          {
            uuid,
            ts: Date.now(),
            pid: process.pid,
            ...info,
          },
          null,
          2,
        ),
      );
    } finally {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    return true;
  } catch {
    return false; // 已有 claim / 无权限 / 竞态失败: 都视作本轮已提示
  }
}
function _releaseConvNotifyClaim(uuid) {
  try {
    const file = _convNotifyClaimPath(uuid);
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}
function _sweepConvNotifyClaims(activeUuids) {
  try {
    if (!fs.existsSync(CONV_NOTIFY_DIR)) return;
    const activeSafe = new Set(
      [...(activeUuids || [])].map((u) =>
        String(u || "").replace(/[^a-zA-Z0-9_-]/g, ""),
      ),
    );
    for (const f of fs.readdirSync(CONV_NOTIFY_DIR)) {
      if (!f.endsWith(".json")) continue;
      const safe = f.slice(0, -5);
      // 当前 Hub 不再报告该 uuid 异常 → 视为恢复，释放本轮一次性闸门。
      if (!activeSafe.has(safe)) {
        try {
          fs.unlinkSync(path.join(CONV_NOTIFY_DIR, f));
        } catch {}
      }
    }
  } catch {}
}
function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
}

// ═══ § v3.4.0 · 三界归一 · 对话追踪 Hub 集成 (道生之·德畜之) ═══
//
// dao_stuck_v9.js 写 ~/.wam/_hub.json → WAM 扩展读取 → Windsurf 左下角通知
// 不走 Windows Toast/BalloonTip/PowerShell · 道冲而用之有弗盈也
//
// Hub stuck 数据结构:
//   { ts, pid, active, streaming, stuck, error,
//     stuckList: [{ uuid, shortId, title, staleSec, level, vscdbStatus, sizeKB }],
//     current: { uuid, title, phase, staleSec, sizeKB } }
//
function _readHub() {
  try {
    if (!fs.existsSync(HUB_FILE)) return null;
    const raw = fs.readFileSync(HUB_FILE, "utf8");
    const hub = JSON.parse(raw);
    return hub.stuck || null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// v3.5.0 · 道法自然 · 对话卡住前端通知 根因修复 (天下之至柔·驰骋于天下之致坚)
// ═══════════════════════════════════════════════════════════════════════════════
//
// v3.4.0 致命缺陷 (实地验证 2026-05-25 铁证):
//   1. _hubLastStuckUuids 是 Set (一次性锁·永不过期) → 通知只发1次·之后永远静默
//   2. 全局冷却30s → 3对话同时卡只通知1个 → 其余2个零感知
//   3. vscode弹窗15秒自动消失 → 无持久UI → 用户miss后零感知
//   4. 启动时只存数据不处理 → Extension重载后直到下次文件变化才通知
//   5. fs.watchFile persistent:false → 可能被GC静默停止
//
// v3.5.0 修复 (五层彻底):
//   [A] _hubLastStuckUuids 改 Map{uuid→ts} · 5分钟自动过期 · 允许重复通知
//   [B] 全局冷却 30s→5s · 允许连续通知多个卡住对话
//   [C] 新增独立 _stuckStatusBar (红色·持久可见·永不消失直到恢复)
//   [D] 启动时立即 _processHubStuck(initData) (不再只存不处理)
//   [E] 新增 10s Hub 轮询保底 (fs.watchFile 失效时的兜底)
//
// 哲学: 天下之至柔驰骋于天下之致坚。通知须柔(不抢焦点)而必达(永不漏报)。
// ═══════════════════════════════════════════════════════════════════════════════
// v13.2 · 知止不殆·可以长久 — 通知最小化哲学:
//   「一」同一 uuid 同一异常生命周期只提示一次 — 死亡/卡死/停滞同法
//   「二」通知 10min 自动消失，用户 Cancel 也只关闭通知本身，不触发重弹
//   「三」恢复/离开 stuckList 后释放闸门，下一轮新异常才允许再提示一次
const HUB_NOTIFY_GLOBAL_CD = 5000; // 不同 uuid 连续提示的全局最小间隔
const STUCK_STALE_MAX = 600; // 秒: staleSec 超过此值 → 不显示 (备用安全网)
const STUCK_NOTIFY_AUTO_DISMISS_MS = 600000; // v13.0: 10min无操作自动消失 (从首次通知时刻起算)

// ── 卡住状态栏 (持久可见 · 根治弹窗消失后零感知) ──
// v3.7.7「一」过滤已 dismiss/启动围栏 → 状态栏「N卡住」与对话面板同步
function _updateStuckStatusBar(data) {
  if (!_stuckStatusBar) return;
  if (!data || !data.stuckList || data.stuckList.length === 0) {
    // 无卡住 → 隐藏
    _stuckStatusBar.hide();
    return;
  }
  // v3.8.0: 过滤已 dismiss + 10min 以上静默 · 与 _getConvTrackingHtml 保持一致
  const _nowSb = Date.now();
  const visible = data.stuckList.filter((s) => {
    // 安全网: staleSec > 10min → 不显示
    if (s.staleSec > STUCK_STALE_MAX) return false;
    const _titleOk = _convDisplayTitle(
      s.uuid,
      s.title,
      s.uuid ? _convTitleMap[s.uuid] : "",
    );
    if (!_titleOk) return false;
    s._displayTitle = _titleOk;
    if (!s.uuid) return true;
    // v13.0: 10min无操作自动消失 (从首次通知时刻起算)
    const _fnt = _stuckFirstNotifyTs.get(s.uuid);
    if (_fnt && _nowSb - _fnt > STUCK_NOTIFY_AUTO_DISMISS_MS) {
      if (!_dismissedConvUuids.has(s.uuid))
        _dismissedConvUuids.set(s.uuid, _nowSb);
      return false; // 10min已过 · 自动消失
    }
    const dt = _dismissedConvUuids.get(s.uuid);
    if (!dt) return true;
    if (_nowSb - dt < CONV_DISMISS_TTL) return false; // 未过期 → 隐藏
    _dismissedConvUuids.delete(s.uuid); // 过期 → 自然清除
    return true;
  });
  if (visible.length === 0) {
    _stuckStatusBar.hide();
    return;
  }
  const count = visible.length;
  const worst = visible[0]; // stuckList 按严重度排序
  const staleStr =
    worst.staleSec >= 60
      ? Math.round(worst.staleSec / 60) + "min"
      : worst.staleSec + "s";
  _stuckStatusBar.text = "$(warning) " + count + "卡住";
  _stuckStatusBar.tooltip =
    "对话卡住! (" +
    count +
    "个)\n" +
    visible
      .map((s) => {
        const st =
          s.staleSec >= 60
            ? Math.round(s.staleSec / 60) + "min"
            : s.staleSec + "s";
        return (
          "[" + (s.level || "?") + "] " + s._displayTitle + " (" + st + ")"
        );
      })
      .join("\n") +
    "\n\n点击打开看板 http://127.0.0.1:19901";
  _stuckStatusBar.color = new vscode.ThemeColor(
    "statusBarItem.errorForeground",
  );
  _stuckStatusBar.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.errorBackground",
  );
  _stuckStatusBar.show();
}

function _processHubStuck(data) {
  if (!data) {
    _updateStuckStatusBar(null);
    return;
  }
  if (!_cfg("stuckNotify", true)) {
    _updateStuckStatusBar(null);
    return;
  }
  const now = Date.now();
  // Hub 数据过期判断 (>hubDataStaleMs 不处理 · 可能是 engine 已停) · v3.7.1 软编码
  const _hubStaleMs = Math.max(10000, +_cfg("hubDataStaleMs", 60000) || 60000);
  if (data.ts && now - data.ts > _hubStaleMs) {
    _updateStuckStatusBar(null);
    return;
  }

  // v3.7.7「二」启动围栏 — 预启动卡住对话自动 dismiss (重启即清·那个不是这个)
  // staleSec * 1000 > (now - _wamStartTs) + 缓冲 → 该对话卡住于 WAM 启动前 (前会话残留)
  const _fenceBuffer = 120000; // 2min 缓冲 · 防 Windsurf 启动+插件激活间隙误判
  const _wamUptime = now - _wamStartTs;
  let _autoDismissed = 0;
  if (data.stuckList && data.stuckList.length > 0) {
    for (const s of data.stuckList) {
      if (!s.uuid) continue;
      if (_dismissedConvUuids.has(s.uuid)) continue; // 已 dismiss 跳过
      const stuckMs = (s.staleSec || 0) * 1000;
      if (stuckMs > _wamUptime + _fenceBuffer) {
        // 卡住时长 > WAM 运行时长 → 该对话于 WAM 启动前已卡住 → 前会话残留
        _dismissedConvUuids.set(s.uuid, now);
        _autoDismissed++;
        log(
          "startup-fence: auto-dismiss " +
            s.uuid.substring(0, 8) +
            " level=" +
            (s.level || "?") +
            " staleSec=" +
            s.staleSec +
            " uptimeSec=" +
            Math.round(_wamUptime / 1000),
        );
      }
    }
    if (_autoDismissed > 0) {
      _saveDismissedToDisk(); // 持久化 + 多窗口同步
      log("startup-fence: 共自动清除 " + _autoDismissed + " 个前会话卡住对话");
      // 异步触发 conv-section 重渲染 (面板初始化可能晚于此处)
      setTimeout(() => _broadcastConvSection(), 100);
    }
  }

  // ★ [C] 持久状态栏: 无论如何先更新 (永远反映最新状态 · 不受冷却影响)
  _updateStuckStatusBar(data);

  // v13.2: 通知最小化 — 同一 uuid 同一异常生命周期只弹一次。
  // 不再按 cooldown / renotify 清除记录；只有恢复(离开 stuckList)才释放闸门。
  const _notifyGlobalCd = Math.max(
    1000,
    +_cfg("hubNotifyGlobalCdMs", HUB_NOTIFY_GLOBAL_CD) || HUB_NOTIFY_GLOBAL_CD,
  );
  const prevStuckUuids = new Set(_hubLastStuckUuids.keys());
  const curStuckUuids = new Set();
  for (const s of data.stuckList || []) {
    if (s && s.uuid) curStuckUuids.add(s.uuid);
  }
  // v15.1 修复③ · 陈旧 streaming 对话也进通知池 · 与 stuckList 同闸门
  //   根因: AI 完成 + _turnGrowth>4KB + 60s 停滞 → entry._awaitingUser=true →
  //         state="streaming" → 不进 stuckList → 旧版完全没通知
  //   场景: AI 真正中断 (网络/服务异常) + 已输出几 KB → 同样陷入此状态 → 用户失明
  //   治法: streamingList 中 _isStale=true (>60s 停滞) → 入通知池
  //         注意排除 _awaitingUser 真等待 (软编码 wam.notifyOnAwaitingUser 默 false)
  //   软编码: wam.notifyOnStaleStream (默 true · 0=关闭陈旧通知)
  const _notifyOnStale = !!_cfg("notifyOnStaleStream", true);
  const _notifyOnAwait = !!_cfg("notifyOnAwaitingUser", false);
  if (_notifyOnStale && Array.isArray(data.streamingList)) {
    for (const c of data.streamingList) {
      if (!c || !c.uuid) continue;
      if (!c._isStale) continue;
      if (c.state !== "streaming") continue; // 仅 state=streaming 的陈旧 (排除 no_pb)
      if (c.isAwaitingUser && !_notifyOnAwait) continue; // 默认排除"等待用户"
      if (curStuckUuids.has(c.uuid)) continue; // stuckList 已处理 · 不重复
      curStuckUuids.add(c.uuid);
    }
  }
  _sweepConvNotifyClaims(curStuckUuids);

  // ── 检测 stuck/dead 事件 → 通知 ──
  if (data.stuckList && data.stuckList.length > 0) {
    for (const s of data.stuckList) {
      if (!s.uuid) continue;

      // v3.8.0「一」staleSec > 10min → 已无时效性 · 不弹通知 (多言数穷·不如守中)
      if (s.staleSec > STUCK_STALE_MAX) continue;

      // v14.0 根治: 卡死对话必通知 — UUID 兜底代替静默丢弃
      //   旧逻辑: 标题失败 → continue → 卡死对话零通知 (用户毫无感知)
      //   新逻辑: 无可读标题 → "对话 #短UUID" 兜底 → 用户至少能看到UUID提醒
      //   道: 知不知尚矣 · 不知不知病矣 — 即使不知道名字也要通知
      const displayName =
        _convDisplayTitle(
          s.uuid,
          s.title,
          s.uuid ? _convTitleMap[s.uuid] : "",
        ) || (s.uuid ? "对话 #" + s.uuid.replace(/-/g, "").slice(0, 8) : "");
      if (!displayName) continue;

      // v3.7.5 · 手动关闭联动 · 10min 内静默通知 (自动过期后恢复)
      const _dismissTs = _dismissedConvUuids.get(s.uuid);
      if (_dismissTs) {
        if (now - _dismissTs < CONV_DISMISS_TTL) continue; // 未过期 · 跳过通知
        _dismissedConvUuids.delete(s.uuid); // 已过期 · 自动清除并恢复
      }

      // v13.2: 一次性闸门。本进程已提示过 → 不再弹；多窗口 claim 已存在 → 不再弹。
      const _prevEntry = _hubLastStuckUuids.get(s.uuid);
      if (_prevEntry) continue;

      // ★ [B] 全局冷却 (允许多对话快速连续通知 · 可配置)
      if (now - _hubLastNotifyAt < _notifyGlobalCd) continue;

      // 发 Windsurf 内部通知 (左下角) · v3.8.1: 自动消失 (10min)
      const name = displayName;
      const levelTag =
        s.level === "DEAD" ? "死亡" : s.level === "CRITICAL" ? "卡死" : "停滞";
      const staleStr =
        s.staleSec >= 60
          ? Math.round(s.staleSec / 60) + "min"
          : s.staleSec + "s";
      if (
        !_claimConvNotify(s.uuid, {
          name,
          level: s.level || "",
          staleSec: s.staleSec || 0,
        })
      ) {
        _hubLastStuckUuids.set(s.uuid, {
          ts: now,
          name,
          level: s.level || "",
          claimedElsewhere: true,
        });
        continue;
      }
      _notifyTimed(
        s.level === "DEAD" || s.level === "CRITICAL" ? "warn" : "info",
        "道·对话" + levelTag + ": " + name + " (停滞 " + staleStr + ")",
        STUCK_NOTIFY_AUTO_DISMISS_MS, // v13.0: 10min自动消失 · 知止不殆
        s.uuid, // v3.12.1: 注册 resolve 句柄 · 对话恢复时自动消除
      );
      _hubLastNotifyAt = now;
      // v13.0: 记录首次通知时刻 (不覆盖 · 10min自动消失基准点)
      if (!_stuckFirstNotifyTs.has(s.uuid))
        _stuckFirstNotifyTs.set(s.uuid, now);
      _hubLastStuckUuids.set(s.uuid, {
        ts: now,
        name: name,
        level: s.level || "",
      });
      log(
        "hub-stuck: " +
          levelTag +
          " " +
          (s.shortId || "?") +
          ' "' +
          (s.title || "") +
          '" stale=' +
          s.staleSec +
          "s once",
      );
    }
  }

  // v15.1 修复③ · 检测 streamingList 陈旧对话 → 一次性 toast (与 stuck 同闸门 · 不重复)
  //   通知文案: 道·对话陈旧停滞: {name} (停滞 {time}) · 同样 10min 自动消退 · 用户 X 可关闭
  if (_notifyOnStale && Array.isArray(data.streamingList)) {
    for (const c of data.streamingList) {
      if (!c || !c.uuid) continue;
      if (!c._isStale) continue;
      if (c.state !== "streaming") continue;
      if (c.isAwaitingUser && !_notifyOnAwait) continue;
      if (c.staleSec > STUCK_STALE_MAX) continue; // 10min+ 静默
      // 已 dismiss 跳过
      const _dt = _dismissedConvUuids.get(c.uuid);
      if (_dt) {
        if (now - _dt < CONV_DISMISS_TTL) continue;
        _dismissedConvUuids.delete(c.uuid);
      }
      // 一次性闸门: 已通知过此 uuid 的本轮停滞 → 跳过
      if (_hubLastStuckUuids.has(c.uuid)) continue;
      // 全局冷却
      if (now - _hubLastNotifyAt < _notifyGlobalCd) continue;
      // 用 _convDisplayTitle 兜底显示真名 / UUID
      const name =
        _convDisplayTitle(c.uuid, c.title, _convTitleMap[c.uuid]) ||
        "对话 #" + String(c.uuid).replace(/-/g, "").slice(0, 8);
      const staleStr =
        c.staleSec >= 60
          ? Math.round(c.staleSec / 60) + "min"
          : c.staleSec + "s";
      // claim 跨窗口闸门
      if (
        !_claimConvNotify(c.uuid, {
          name,
          level: "STALE",
          staleSec: c.staleSec || 0,
        })
      ) {
        _hubLastStuckUuids.set(c.uuid, {
          ts: now,
          name,
          level: "STALE",
          claimedElsewhere: true,
        });
        continue;
      }
      _notifyTimed(
        "warn",
        "道·对话陈旧停滞: " + name + " (停滞 " + staleStr + ")",
        STUCK_NOTIFY_AUTO_DISMISS_MS, // 10min 自动消退
        c.uuid, // v3.12.1: 注册 resolve 句柄 · 对话恢复时自动消除
      );
      _hubLastNotifyAt = now;
      if (!_stuckFirstNotifyTs.has(c.uuid))
        _stuckFirstNotifyTs.set(c.uuid, now);
      _hubLastStuckUuids.set(c.uuid, {
        ts: now,
        name,
        level: "STALE",
      });
      log(
        "hub-stale: " +
          (c.shortId || "?") +
          ' "' +
          (c.title || "") +
          '" stale=' +
          c.staleSec +
          "s once",
      );
    }
  }

  // ── 检测恢复 (之前 stuck 的 uuid 不在当前 stuckList 中) → 通知 ──
  for (const uuid of prevStuckUuids) {
    if (
      !curStuckUuids.has(uuid) &&
      now - _hubLastRecoverNotify > _notifyGlobalCd
    ) {
      const _recInfo = _hubLastStuckUuids.get(uuid);
      const _recName = (_recInfo && _recInfo.name) || uuid.substring(0, 8);
      // v11.3: RECOVER通知已移除 — 减少通知密度，用户可在对话追踪面板查看恢复
      _hubLastRecoverNotify = now;
      _hubLastStuckUuids.delete(uuid);
      _releaseConvNotifyClaim(uuid);
      _stuckFirstNotifyTs.delete(uuid); // v13.0: 对话恢复 → 清除首次通知计时
      // v3.12.1「三」恢复 → 主动消除 toast (withProgress resolve 即刻关闭通知)
      //   道: 反也者道之动 — 对话恢复·通知即止·无需等 10min
      _resolveConvNotify(uuid);
      // v3.12.1「三」恢复 → 清除 dismiss 状态 (新生命周期·下次卡住可重新提醒)
      //   道: 死不忘者寿 — dismiss 随生命周期走·恢复即清·不留旧痕
      if (_dismissedConvUuids.has(uuid)) {
        _dismissedConvUuids.delete(uuid);
        _saveDismissedToDisk();
      }
      log("hub-recover: " + uuid.substring(0, 8));
    }
  }

  // ★ [A] 安全阀: 防无限累积 (理论上不会到这里·但防御性编程)
  if (_hubLastStuckUuids.size > 100) {
    _hubLastStuckUuids.clear();
  }

  _hubData = data;
}

// ═══ v3.7.6 · dismiss 持久化 · 跨窗口共享 · 多窗自宾不争 ═══
// 小邦寺民·各得其欲·大者宜为下 · A窗口dismiss → _conv_dismiss.json → B窗口自动同步
function _loadDismissedFromDisk() {
  try {
    if (!fs.existsSync(DISMISS_FILE)) return false;
    const raw = fs.readFileSync(DISMISS_FILE, "utf8");
    const obj = JSON.parse(raw);
    const now = Date.now();
    let changed = false;
    for (const [uuid, ts] of Object.entries(obj)) {
      const t = Number(ts);
      if (!isNaN(t) && now - t < CONV_DISMISS_TTL) {
        if (
          !_dismissedConvUuids.has(uuid) ||
          _dismissedConvUuids.get(uuid) < t
        ) {
          _dismissedConvUuids.set(uuid, t);
          changed = true;
        }
      }
    }
    return changed;
  } catch {
    return false;
  }
}
function _saveDismissedToDisk() {
  try {
    const now = Date.now();
    const obj = {};
    // 合并: 读取磁盘现有 (其他窗口写入的) + 当前内存 (防覆盖其他窗口数据)
    try {
      if (fs.existsSync(DISMISS_FILE)) {
        const diskObj = JSON.parse(fs.readFileSync(DISMISS_FILE, "utf8"));
        for (const [uuid, ts] of Object.entries(diskObj)) {
          const t = Number(ts);
          if (!isNaN(t) && now - t < CONV_DISMISS_TTL) obj[uuid] = t;
        }
      }
    } catch {}
    // 写入当前内存 (内存优先 · 以最新 dismiss 时间戳为准)
    for (const [uuid, ts] of _dismissedConvUuids) {
      if (now - ts < CONV_DISMISS_TTL) obj[uuid] = ts;
    }
    atomicWrite(DISMISS_FILE, JSON.stringify(obj));
  } catch (e) {
    log("dismiss-save err: " + (e.message || e));
  }
}

// v3.5.0 · 安装 Hub 文件监视器 + 轮询保底 (双保险 · 善闭者无闩钥而不可启也)
function _installHubWatcher(context) {
  try {
    // ── 主通道: fs.watchFile (文件变化即时触发) ──
    fs.watchFile(HUB_FILE, { persistent: true, interval: 500 }, () => {
      clearTimeout(_hubWatchDebounce);
      _hubWatchDebounce = setTimeout(() => {
        const data = _readHub();
        if (data) {
          _processHubStuck(data);
          // Fix4: 仅更新 conv 区块，不全量重建 sidebar（防点击展开时混叠卡顿）
          _broadcastConvSection();
        }
      }, 300);
    });
    context.subscriptions.push({
      dispose: () => {
        try {
          fs.unwatchFile(HUB_FILE);
        } catch {}
        clearTimeout(_hubWatchDebounce);
      },
    });

    // ★ [E] 备份通道: 10s 轮询保底 (防 fs.watchFile 静默失效)
    _hubPollTimer = setInterval(() => {
      const data = _readHub();
      if (data) {
        _processHubStuck(data);
        // 不调 _broadcastUI() 避免频繁 webview 重建 · 状态栏已在 _processHubStuck 中更新
      }
    }, 10000);
    context.subscriptions.push({
      dispose: () => {
        if (_hubPollTimer) {
          clearInterval(_hubPollTimer);
          _hubPollTimer = null;
        }
      },
    });

    // ★ [D] 启动时立即读取并处理 (不再只存不通知)
    const initData = _readHub();
    if (initData) {
      _hubData = initData;
      // 延迟 2s 处理 (等 statusBar 等 UI 组件就绪)
      setTimeout(() => {
        _processHubStuck(initData);
      }, 2000);
    }

    // v3.7.6 ★ [F] dismiss 文件监视 · 跨窗口同步 (A窗口 dismiss → B窗口自动更新)
    _loadDismissedFromDisk(); // 启动时加载磁盘 dismiss 状态
    fs.watchFile(DISMISS_FILE, { persistent: true, interval: 1000 }, () => {
      clearTimeout(_dismissWatchDebounce);
      _dismissWatchDebounce = setTimeout(() => {
        const changed = _loadDismissedFromDisk();
        if (changed) {
          _broadcastConvSection(); // 其他窗口 dismiss 了某对话 · 本窗口同步隐藏
          log("dismiss-sync: 跨窗口同步 dismiss 状态");
        }
      }, 200);
    });
    context.subscriptions.push({
      dispose: () => {
        try {
          fs.unwatchFile(DISMISS_FILE);
        } catch {}
        clearTimeout(_dismissWatchDebounce);
      },
    });

    log(
      "hub-watcher: 监视+轮询 " +
        HUB_FILE +
        " · dismiss-watcher: " +
        DISMISS_FILE +
        " (v3.7.6 多窗同步)",
    );
  } catch (e) {
    log("hub-watcher init err: " + (e.message || e));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// v3.10.0 · 归一 · 卡住引擎子进程管理 (道生之·德畜之·长之·遂之·养之·复之)
// ═══════════════════════════════════════════════════════════════════════════════
//
// 架构:
//   extension.js (本进程·Windsurf VS Code 宿主)
//     └─ dao_stuck.js (子进程·独立 Node.js · 不阻塞 UI)
//          └─ 写 ~/.wam/_hub.json → extension.js 读取 → 通知/状态栏
//
// 生命周期: activate → 启动引擎 → 崩溃自动重启 (最多3次/5min) → deactivate → 优雅关闭
//
// 道法自然: 引擎随插件激活而生, 随插件停用而灭, 无需用户手动管理
// ═══════════════════════════════════════════════════════════════════════════════
const { spawn: _spawn } = require("child_process");
const STUCK_ENGINE_SCRIPT = path.join(__dirname, "dao_stuck.js");
const STUCK_ENGINE_MAX_RESTARTS = 3; // 5分钟内最多重启次数
const STUCK_ENGINE_RESTART_WINDOW = 300000; // 5分钟
let _stuckEngineRestartLog = []; // 重启时间戳记录 (滑动窗口)

function _launchStuckEngine() {
  // 前置检查: 引擎脚本是否存在
  if (!fs.existsSync(STUCK_ENGINE_SCRIPT)) {
    log(
      "stuck-engine: dao_stuck.js 不存在 → 跳过 (" + STUCK_ENGINE_SCRIPT + ")",
    );
    return;
  }
  // 防重复启动
  if (_stuckEngineProcess && !_stuckEngineProcess.killed) {
    try {
      _stuckEngineProcess.kill();
    } catch {}
    _stuckEngineProcess = null;
  }
  // 滑动窗口限流: 5分钟内最多重启3次 (防无限重启风暴)
  const now = Date.now();
  _stuckEngineRestartLog = _stuckEngineRestartLog.filter(
    (t) => now - t < STUCK_ENGINE_RESTART_WINDOW,
  );
  if (_stuckEngineRestartLog.length >= STUCK_ENGINE_MAX_RESTARTS) {
    log(
      "stuck-engine: 5min内已重启" +
        _stuckEngineRestartLog.length +
        "次 → 暂停自动重启 (防风暴)",
    );
    return;
  }
  _stuckEngineRestartLog.push(now);
  _stuckEngineLastStart = now;
  _stuckEngineRestarts++;

  // 启动子进程 (detached=false · 跟随 Windsurf 退出自然清理)
  // 道法自然: process.execPath 在 Windsurf 环境下是 Electron 二进制 · 不能直接运行 Node 脚本
  // 寻道: 优先 PATH 上的 node · 备选 Electron fork 模式
  // v3.11.3 · 软编码参数透传 — 让 dao_stuck 读 wam.* 配置 (道法自然·一源多用)
  const _singletonAgeMs = String(
    Math.max(30000, +_cfg("engineSingletonAgeMs", 90000) || 90000),
  );
  const _heartbeatMs = String(
    Math.max(5000, +_cfg("engineHeartbeatMs", 30000) || 30000),
  );
  const _recentWindowMs = String(
    Math.max(60000, +_cfg("recentConvWindowMs", 300000) || 300000),
  );
  const _streamFreshMs = String(
    Math.max(10000, +_cfg("streamingFreshMs", 60000) || 60000),
  );
  // v15.0 · 软编码: streaming 真死透剔除阈值 (默 30min · 0=永不剔除)
  const _streamStaleMaxSec = String(
    Math.max(0, +_cfg("streamStaleMaxSec", 1800) || 0),
  );
  // v15.2 (3.11.9) · 软编码: 显式 Python 路径 (空=自动探测·适配万家系统)
  const _pythonPath = String(_cfg("pythonPath", "") || "").trim();
  const args = [
    "--toast",
    "false", // 通知由 extension.js 接管 · 引擎不弹 toast
    "--singleton-age-ms",
    _singletonAgeMs,
    "--heartbeat-ms",
    _heartbeatMs,
    "--recent-window-ms",
    _recentWindowMs,
    "--stream-fresh-ms",
    _streamFreshMs,
    // v15.0 · 真死透剔除阈值 (默 1800s=30min · 0=永不剔除)
    "--stream-stale-max-sec",
    _streamStaleMaxSec,
  ];
  // v15.2 · 仅当用户显式配置时透传 (避免空字符串覆盖自动探测)
  if (_pythonPath) {
    args.push("--python-path", _pythonPath);
  }
  let _nodeExe = "node"; // 默认 PATH 上的 node
  try {
    // 检查 PATH 上 node 是否可用
    const { execFileSync } = require("child_process");
    execFileSync("node", ["--version"], {
      timeout: 3000,
      windowsHide: true,
      encoding: "utf8",
    });
  } catch {
    // PATH 上无 node · 回退到 process.execPath (Electron 也能跑 JS)
    _nodeExe = process.execPath;
    log("stuck-engine: PATH无node · 回退 " + _nodeExe);
  }
  try {
    const child = _spawn(_nodeExe, [STUCK_ENGINE_SCRIPT, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: false,
    });
    _stuckEngineProcess = child;
    const pid = child.pid || "?";
    log(
      "stuck-engine: 启动 pid=" +
        pid +
        " restarts=" +
        _stuckEngineRestarts +
        " script=" +
        STUCK_ENGINE_SCRIPT,
    );

    // stdout/stderr → WAM output channel (调试可见)
    if (child.stdout) {
      child.stdout.on("data", (data) => {
        const lines = data.toString().trim().split("\n");
        for (const line of lines) {
          if (line) log("stuck-engine[out]: " + line);
        }
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (data) => {
        const lines = data.toString().trim().split("\n");
        for (const line of lines) {
          if (line) log("stuck-engine[err]: " + line);
        }
      });
    }

    // 崩溃自动重启 (善闭者无闩钥而不可启也)
    child.on("exit", (code, signal) => {
      log(
        "stuck-engine: 退出 code=" + code + " signal=" + signal + " pid=" + pid,
      );
      _stuckEngineProcess = null;
      // 非正常退出 → 延迟5秒自动重启
      if (code !== 0 && code !== null) {
        log("stuck-engine: 异常退出 → 5s后自动重启");
        setTimeout(() => _launchStuckEngine(), 5000);
      }
    });
    child.on("error", (err) => {
      log("stuck-engine: 启动失败 " + (err.message || err));
      _stuckEngineProcess = null;
    });
  } catch (e) {
    log("stuck-engine: spawn 异常 " + (e.message || e));
    _stuckEngineProcess = null;
  }
}

function _stopStuckEngine() {
  if (_stuckEngineProcess) {
    const pid = _stuckEngineProcess.pid || "?";
    try {
      _stuckEngineProcess.kill("SIGTERM");
    } catch {}
    _stuckEngineProcess = null;
    log("stuck-engine: 已停止 pid=" + pid);
  }
}

// ═══ 道之解密 · 反者道之动 · .pb AES-256-GCM 解密引擎 ═══
// 格式确定: [12B nonce] + [ciphertext + 16B tag] · 无 AAD
// 密钥: 从 LS 二进制自动发现 (滑动窗口试解密) · 发现后缓存
const _crypto = require("crypto");
const _KEY_CACHE = path.join(WAM_DIR, "_cascade_key.json");
let _pbDecryptKey = null; // Buffer|null · 运行时缓存
function _loadDecryptKey() {
  if (_pbDecryptKey) return _pbDecryptKey;
  try {
    const c = JSON.parse(fs.readFileSync(_KEY_CACHE, "utf8"));
    if (c.key && c.key.length === 32) {
      _pbDecryptKey = Buffer.from(c.key, "ascii");
      return _pbDecryptKey;
    }
  } catch {}
  return null;
}
function _saveDecryptKey(key, source) {
  try {
    // v3.10.2 · 密钥池 · 积累历史密钥 (max 4 历史 + 当前 = 5 总) · 应对 Windsurf 更新换密钥
    let existing = {};
    try {
      existing = JSON.parse(fs.readFileSync(_KEY_CACHE, "utf8"));
    } catch {}
    const pool = [];
    // 收集旧 primary key 进 pool
    if (existing.key && existing.key.length === 32) {
      const ex = Buffer.from(existing.key, "ascii");
      if (!key.equals(ex))
        pool.push({
          key: existing.key,
          hex: ex.toString("hex"),
          source: existing.source || "?",
          discoveredAt: existing.discoveredAt || "",
        });
    }
    // 收集旧 pool keys
    if (Array.isArray(existing.keys)) {
      for (const k of existing.keys) {
        if (!k.key || k.key.length !== 32) continue;
        const kBuf = Buffer.from(k.key, "ascii");
        if (!key.equals(kBuf) && !pool.some((p) => p.key === k.key))
          pool.push(k);
      }
    }
    fs.writeFileSync(
      _KEY_CACHE,
      JSON.stringify(
        {
          key: key.toString("ascii"),
          hex: key.toString("hex"),
          source,
          discoveredAt: new Date().toISOString(),
          keys: pool.slice(-4), // 保留最近4个历史密钥
        },
        null,
        2,
      ),
    );
  } catch {}
}
// v3.10.2 · 加载全部已知密钥 (primary + pool) · 用于多密钥兜底解密
function _loadAllDecryptKeys() {
  try {
    const c = JSON.parse(fs.readFileSync(_KEY_CACHE, "utf8"));
    const keys = [];
    if (c.key && c.key.length === 32) keys.push(Buffer.from(c.key, "ascii"));
    if (Array.isArray(c.keys)) {
      for (const k of c.keys) {
        if (!k.key || k.key.length !== 32) continue;
        const b = Buffer.from(k.key, "ascii");
        if (!keys.some((x) => x.equals(b))) keys.push(b);
      }
    }
    return keys;
  } catch {
    return [];
  }
}
// v3.10.2 · 多密钥兜底解密 · primary → pool 依次试 · 返回 {pt,key}|null
// 应用场景: Windsurf 版本升级换密钥 · 跨机器 PB 备份 · 旧批次 PB 用旧密钥
function _decryptPbWithFallback(ct) {
  const primary = _loadDecryptKey();
  if (primary) {
    const pt = _tryDecryptPb(ct, primary);
    if (pt) return { pt, key: primary };
  }
  for (const k of _loadAllDecryptKeys()) {
    if (primary && k.equals(primary)) continue;
    const pt = _tryDecryptPb(ct, k);
    if (pt) return { pt, key: k };
  }
  return null;
}
function _decryptPb(ciphertext, key) {
  const nonce = ciphertext.slice(0, 12);
  const ctTag = ciphertext.slice(12);
  const tag = ctTag.slice(ctTag.length - 16);
  const ct = ctTag.slice(0, ctTag.length - 16);
  const d = _crypto.createDecipheriv("aes-256-gcm", key, nonce);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}
function _tryDecryptPb(ciphertext, candidateKey) {
  try {
    const pt = _decryptPb(ciphertext, candidateKey);
    if (pt.length > 2 && pt[0] === 0x0a) return pt;
    const wire = pt[0] & 7,
      field = pt[0] >>> 3;
    if (field >= 1 && field <= 20 && (wire === 0 || wire === 2)) return pt;
    return null;
  } catch {
    return null;
  }
}
// 从 .pb 解密提取标题 (搜索用户自然语言文本)
// 策略: 找含空格的 >20 字符可读字符串 (用户输入特征)
function _extractPbTitle(pbPath) {
  const key = _loadDecryptKey();
  if (!key) return "";
  try {
    const ct = fs.readFileSync(pbPath);
    if (ct.length < 29) return "";
    const pt = _decryptPb(ct, key);
    // 搜索范围: 前 64KB (用户消息在 step 子消息中)
    const limit = Math.min(pt.length, 65536);
    let start = -1;
    for (let i = 0; i <= limit; i++) {
      const c = i < limit ? pt[i] : 0;
      const ok = c >= 0x20 && c <= 0x7e;
      if (ok) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        const len = i - start;
        if (len > 20 && len < 500) {
          const s = pt.slice(start, i).toString("utf8").trim();
          if (s.length < 10) {
            start = -1;
            continue;
          }
          // 用户文本特征: 含空格 · 不是模型名/指标/UUID/路径/AI推理
          // v4.1 道法自然: 扩展过滤 — 排除模型头·AI推理·引用·JSON·路径·系统提示
          const spaces = (s.match(/ /g) || []).length;
          if (
            spaces >= 2 &&
            !/^[0-9a-f-]{36}$/.test(s) &&
            !s.includes("\\") &&
            !s.includes("`") &&
            !/cached_|^MODEL_|^[Cc]laude[ -]|^[Gg][Pp][Tt][-_ ]|^[Gg]emini |tokens"|^Response |^agent_|^Agent |^b\$|^\$|^The user|^They want |^I need to |^I'll |^I cannot |^Let me |^This (translates|is a request|means)|^Based on |^However[, ]|^The system|^As [A-Z]|^You are (Cascade|an AI)|^The USER|^I should |^Then |^@\[|^\{|^",|^[()"<]|^- |^_\w|MatchPerLine/.test(
              s,
            )
          ) {
            return s.substring(0, 80);
          }
        }
        start = -1;
      }
    }
  } catch {}
  return "";
}
// ══════════════════════════════════════════════════════════════════════════
// v3.8.2 · PB→MD 彻底贯通 · 道法自然 · 无为而无不为
// 原理: AES-256-GCM 解密 → raw protobuf 字段扫描 → 提取用户消息 → 输出 MD
// 实证: f19@depth1 = 用户输入 · f20@depth2 = 模型统计 · f5@depth0 = UUID
// ══════════════════════════════════════════════════════════════════════════
function _protoReadVarint(buf, pos) {
  let v = 0,
    s = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    v += (b & 0x7f) * Math.pow(2, s);
    if (!(b & 0x80)) break;
    s += 7;
    if (s > 49) break;
  }
  return { v: Math.floor(v), pos };
}
// v3.9.1 · 单层 protobuf 零拷贝扫描 (O(1) 额外内存 · 无 buf.slice)
// 返回 {fn, len, off} 引用数组 · off 为字段数据在 buf 中的绝对偏移
// 调用方按需 buf.slice(f.off, f.off+f.len) 取数据 (惰性求值)
function _protoScanFlat(buf, base, end) {
  const res = [];
  let pos = base;
  while (pos < end - 1) {
    const ts = pos;
    try {
      const t = _protoReadVarint(buf, pos);
      if (t.v === 0) {
        pos++;
        continue;
      }
      pos = t.pos;
      const wt = t.v & 7,
        fn = t.v >>> 3;
      if (wt === 0) {
        const r = _protoReadVarint(buf, pos);
        pos = r.pos;
      } else if (wt === 1) {
        pos += 8;
      } else if (wt === 2) {
        const lr = _protoReadVarint(buf, pos);
        pos = lr.pos;
        const len = lr.v;
        if (len < 0 || pos + len > end) {
          pos = ts + 1;
          continue;
        }
        if (len >= 4) res.push({ fn, len, off: pos });
        pos += len;
      } else if (wt === 5) {
        pos += 4;
      } else {
        pos = ts + 1;
      }
    } catch {
      pos = ts + 1;
    }
  }
  return res;
}
// 兼容旧接口 · 限制递归深度 + 大小 · 仅用于小缓冲区 (_extractBestStringFromMsg 等)
function _protoFields(buf, depth, maxDepth) {
  if (depth > maxDepth || buf.length < 2) return [];
  const res = [];
  let pos = 0;
  while (pos < buf.length - 1) {
    const ts = pos;
    try {
      const t = _protoReadVarint(buf, pos);
      if (t.v === 0) {
        pos++;
        continue;
      }
      pos = t.pos;
      const wt = t.v & 7,
        fn = t.v >>> 3;
      if (wt === 0) {
        const r = _protoReadVarint(buf, pos);
        pos = r.pos;
      } else if (wt === 1) {
        pos += 8;
      } else if (wt === 2) {
        const lr = _protoReadVarint(buf, pos);
        pos = lr.pos;
        const len = lr.v;
        if (len < 0 || pos + len > buf.length) {
          pos = ts + 1;
          continue;
        }
        const data = buf.slice(pos, pos + len);
        pos += len;
        if (len >= 4) {
          res.push({ fn, depth, len, data, byteOffset: pos - len });
          if (len < 204800) {
            const nested = _protoFields(data, depth + 1, maxDepth);
            nested.forEach((n) => res.push({ ...n, parentFn: fn }));
          }
        }
      } else if (wt === 5) {
        pos += 4;
      } else {
        pos = ts + 1;
      }
    } catch {
      pos = ts + 1;
    }
  }
  return res;
}
// 清洗 proto 字段文本: 保留 ASCII 可见 + CJK + 常用标点 + 换行
// v3.8.6 · 大道至简 · 12行循环 → 1行正则 · 行为完全等价 · 正则引擎更快
function _cleanPbText(raw) {
  return raw
    .replace(
      /[^\x20-\x7e\u4e00-\u9fff\u3000-\u30ff\uff00-\uffef\u2000-\u206f\n\t]/g,
      "",
    )
    .trim();
}
// v3.8.7 · 从 proto 子消息中提取最长可读字符串 (仅扫一层深度)
// 根因: fn=19@depth=1 的 f.data 是 proto 子消息 (含字段标签+长度前缀等二进制噪声)
//       直接 toString("utf8") → 文本残缺/乱码; 需扫子字段取最长纯文本串
// 实证: fn=3@depth=2 (最大子字段) = 用户输入的干净文本
function _extractBestStringFromMsg(buf) {
  let best = "";
  let pos = 0;
  while (pos < buf.length - 1) {
    const ts = pos;
    try {
      const t = _protoReadVarint(buf, pos);
      if (t.v === 0) {
        pos++;
        continue;
      }
      pos = t.pos;
      const wt = t.v & 7;
      if (wt === 0) {
        const r = _protoReadVarint(buf, pos);
        pos = r.pos;
      } else if (wt === 1) {
        pos += 8;
      } else if (wt === 2) {
        const lr = _protoReadVarint(buf, pos);
        pos = lr.pos;
        const len = lr.v;
        if (len < 0 || pos + len > buf.length) {
          pos = ts + 1;
          continue;
        }
        const data = buf.slice(pos, pos + len);
        pos += len;
        if (len >= 15) {
          const s = data.toString("utf8");
          const c = _cleanPbText(s);
          if (c.length / Math.max(s.length, 1) < 0.35) continue; // 文本密度太低
          // 排除 URL 编码路径: %XX 占比 > 8% 视为文件路径引用 (如 file:///e%3A/...)
          const urlEncCount = (c.match(/%[0-9A-Fa-f]{2}/g) || []).length;
          if ((urlEncCount * 3) / Math.max(c.length, 1) > 0.08) continue;
          // 得分 = 长度 (URL编码越少得分越高)
          if (c.length > best.length) best = c;
        }
      } else if (wt === 5) {
        pos += 4;
      } else {
        pos = ts + 1;
      }
    } catch {
      pos = ts + 1;
    }
  }
  return best.trim();
}
// v3.8.7 · 从 AI 轨迹字段 (fn=72@depth=1) 提取 PLANNER_RESPONSE 文本
// 实证: Windsurf 对话 PB 中 AI 文本输出被标记为 CORTEX_STEP_TYPE_PLANNER_RESPONSE
//       位于 fn=72@depth=1 → fn=4@depth=2 (CONTEXT_SNIPPET_TYPE_RAW_SOURCE) 内
function _extractAiResponseFromTrajectory(buf) {
  try {
    const raw = buf.toString("utf8");
    // 匹配: PLANNER_RESPONSE):\n[文本] 到下一个 Step N ( 或文件末尾
    const re =
      /CORTEX_STEP_TYPE_PLANNER_RESPONSE\)[):\n\r ]{0,6}([\s\S]+?)(?=\nStep \d+\s*\(|\s*$)/g;
    const parts = [];
    let m;
    while ((m = re.exec(raw)) !== null) {
      const txt = _cleanPbText(m[1]).trim();
      // 去重: 避免同一段落被多个 context snapshot 重复收录
      if (
        txt.length > 30 &&
        !parts.some((p) => p.includes(txt.substring(0, 40)))
      ) {
        parts.push(txt);
      }
    }
    // 取最后一条 = 最新的 AI 响应 (轨迹末尾)
    return parts.length > 0 ? parts[parts.length - 1] : "";
  } catch {
    return "";
  }
}
// v3.9.1 · 从 fn=20 字段中提取 AI 思考/推理文本 (核心突破)
function _extractAiThinkingText(buf) {
  try {
    const cleaned = buf
      .toString("utf8")
      .replace(
        /[^\x20-\x7e\u4e00-\u9fff\u3000-\u30ff\uff00-\uffef\u2000-\u206f\n\t]/g,
        "",
      );
    // 清除 base64/二进制噪声:
    //   ① 行尾长连续无空格串 (≥60字符 · 旧规则)
    //   ② 行内/行间大段无空格字符块 (≥80字符 · 二进制嵌入)
    const trimmed = cleaned
      .replace(/[A-Za-z0-9+/=]{80,}/g, " ") // 中间的 base64 块
      .replace(/[A-Za-z0-9+/=]{40,}$/gm, "") // 行尾 base64
      .replace(/\s{3,}/g, "\n") // 多余空白行压缩
      .trim();
    if (trimmed.length < 30 || !/[\s\u4e00-\u9fff]/.test(trimmed)) return "";
    return trimmed;
  } catch {
    return "";
  }
}
// v3.9.2 · 从 fn=28 字段提取工具调用+执行结果 (run_command / write_file / read_file)
// fn=28 @ depth=1 内部子字段:
//   sub.fn=21 → 工具结果文本 (file content / command result)
//   sub.fn=23 → 命令字符串 (CommandLine)
//   sub.fn=24 → 命令 stdout/stderr
//   sub.fn=25 → 更多 stdout
//   sub.fn=29 → 工作目录 (较短)
function _extractToolBlock(pt, f) {
  try {
    const d2 = _protoScanFlat(pt, f.off, f.off + f.len);
    let cmdStr = "",
      outParts = [],
      resultTxt = "";
    for (const sub of d2) {
      if (sub.wt !== 2 || sub.len < 4) continue;
      // 大于 500KB 的子字段跳过 (整个文件内容 · 避免MD过大)
      const cap = Math.min(sub.len, 50000);
      const raw = pt.slice(sub.off, sub.off + cap);
      const txt = _cleanPbText(raw.toString("utf8"));
      if (txt.length < 4) continue;
      if (sub.fn === 23 && txt.length < 1000) {
        cmdStr = txt;
      } else if ((sub.fn === 24 || sub.fn === 25) && txt.length > 20) {
        outParts.push(txt.substring(0, 8000));
      } else if (sub.fn === 21 && txt.length > resultTxt.length) {
        resultTxt = txt.substring(0, 8000);
      }
    }
    const parts = [];
    if (cmdStr) parts.push("`$ " + cmdStr + "`");
    for (const o of outParts) parts.push(o);
    if (resultTxt && outParts.length === 0 && !cmdStr) parts.push(resultTxt);
    return parts.join("\n").trim();
  } catch {
    return "";
  }
}
// v3.9.2 · 从 fn=13 字段提取代码上下文 (AI 当前查看的代码片段)
function _extractCodeContext(pt, f) {
  try {
    const d2 = _protoScanFlat(pt, f.off, f.off + f.len);
    let best = "";
    for (const sub of d2) {
      if (sub.wt !== 2 || sub.len < 20) continue;
      const raw = pt.slice(sub.off, sub.off + Math.min(sub.len, 20000));
      const txt = _cleanPbText(raw.toString("utf8"));
      if (txt.length > best.length && /[\s\n]/.test(txt))
        best = txt.substring(0, 5000);
    }
    return best;
  } catch {
    return "";
  }
}
// v3.9.2 · 全量对话提取 (道法自然 · 像官方一样提取一切)
// 字段映射 (实证于真实 Windsurf 对话 PB):
//   fn=19 → 用户消息        fn=20 → AI思考+回复
//   fn=28 → 工具调用+结果   fn=24 → 错误/限速消息
//   fn=13 → 代码上下文      fn=72 → AI轨迹响应
function _parsePbConversation(pt) {
  const d0 = _protoScanFlat(pt, 0, pt.length);
  const stepFields = d0.filter((x) => x.fn === 2 && x.len > 50);
  const allTurns = [],
    models = new Set(),
    seenText = new Set();
  // 内容指纹去重: 取前100字符作为指纹
  function addTurn(role, off, text) {
    if (!text || text.length < 10) return;
    const fp = text.substring(0, 80).replace(/\s+/g, " ");
    if (seenText.has(fp)) return;
    seenText.add(fp);
    allTurns.push({ role, byteOffset: off, text });
  }
  for (const step of stepFields) {
    const d1 = _protoScanFlat(pt, step.off, step.off + step.len);
    for (const f of d1) {
      // ① 用户消息
      if (f.fn === 19 && f.len >= 10) {
        try {
          const t = _extractBestStringFromMsg(pt.slice(f.off, f.off + f.len));
          const m = t.replace(/继续[\s↵]*|^@\[.*?\]\s*/g, "").trim();
          if (t.length >= 5 && m.length >= 5) addTurn("user", f.off, t);
        } catch {}
      }
      // ② AI 思考/回复
      else if (f.fn === 20 && f.len >= 30) {
        try {
          const t = _extractAiThinkingText(pt.slice(f.off, f.off + f.len));
          if (t.length >= 30) addTurn("ai", f.off, t);
        } catch {}
      }
      // ③ 工具调用+执行结果 (命令/文件读写)
      else if (f.fn === 28 && f.len >= 20) {
        try {
          const t = _extractToolBlock(pt, f);
          if (t.length >= 20) addTurn("tool", f.off, t);
        } catch {}
      }
      // ④ 错误/限速消息
      else if (f.fn === 24 && f.len >= 20) {
        try {
          const t = _cleanPbText(
            pt.slice(f.off, f.off + Math.min(f.len, 2000)).toString("utf8"),
          );
          if (t.length >= 20) addTurn("error", f.off, t);
        } catch {}
      }
      // ⑤ 代码上下文 (限大小避免 MD 爆炸)
      else if (f.fn === 13 && f.len >= 50 && f.len < 100000) {
        try {
          const t = _extractCodeContext(pt, f);
          if (t.length >= 50) addTurn("context", f.off, t);
        } catch {}
      }
      // ⑥ AI 轨迹响应
      else if (f.fn === 72 && f.len >= 100) {
        try {
          const t = _extractAiResponseFromTrajectory(
            pt.slice(f.off, f.off + f.len),
          );
          if (t.length > 20) addTurn("ai", f.off, t);
        } catch {}
      }
      // ⑦ 模型名称
      if (f.len > 15 && f.len < 5000) {
        try {
          const s = pt.slice(f.off, f.off + f.len).toString("utf8");
          for (const m of s.matchAll(
            /Model((?:Claude|Gemini|GPT|DeepSeek|Sonnet|Opus|Haiku|Flash)[\s\S]{2,50}?)(?:\x00|\x08|\x12|\x1a|$)/g,
          )) {
            const c = _cleanPbText(m[1]).trim();
            if (c.length > 3 && c.length < 60) models.add(c);
          }
        } catch {}
      }
    }
  }
  allTurns.sort((a, b) => a.byteOffset - b.byteOffset);
  // 相邻同角色包含去重 (context snapshot 重复)
  const deduped = [];
  for (const turn of allTurns) {
    if (deduped.length > 0) {
      const prev = deduped[deduped.length - 1];
      if (prev.role === turn.role) {
        const short =
          turn.text.length < prev.text.length ? turn.text : prev.text;
        const long =
          turn.text.length < prev.text.length ? prev.text : turn.text;
        if (
          short.length > 10 &&
          long.includes(short.substring(0, Math.floor(short.length * 0.7)))
        ) {
          deduped[deduped.length - 1] = { ...prev, text: long };
          continue;
        }
      }
    }
    deduped.push(turn);
  }
  const userMsgs = deduped.filter((x) => x.role === "user");
  return {
    userMsgs,
    turns: deduped,
    models: [...models],
    steps: stepFields.length,
  };
}
// PB 文件 → MD 内容字符串 (meta 含 title/backedUpAt)
function _pbToMdContent(pbPath, meta) {
  if (!_loadDecryptKey() && _loadAllDecryptKeys().length === 0) return null;
  try {
    const ct = fs.readFileSync(pbPath);
    if (ct.length < 29) return null;
    // v3.10.2 · 多密钥兜底: primary→pool · 全失败则写 stub MD (不再丢弃)
    const decResult = _decryptPbWithFallback(ct);
    if (!decResult) {
      const uuid = path.basename(pbPath, ".pb");
      const ts = (meta && meta.backedUpAt) || new Date().toISOString();
      let stub = "# " + uuid.substring(0, 8) + "\n\n";
      stub += "> **UUID**: `" + uuid + "`  \n";
      stub += "> **大小**: " + Math.round(ct.length / 1024) + " KB  \n";
      stub +=
        "> **时间**: " +
        ts.substring(0, 19).replace("T", " ") +
        "  \n\n---\n\n";
      stub +=
        "_（密钥不匹配 · 无法解密此备份 — 可能由不同 Windsurf 版本或机器生成 · 后续密钥更新后将自动重建）_\n";
      return stub;
    }
    const pt = decResult.pt;
    const conv = _parsePbConversation(pt);
    const uuid = path.basename(pbPath, ".pb");
    // v3.8.6 · 大道至简 · 三级兜底:
    //   ① meta.title (调用方已提供)  → 英文/备份索引标题直接用
    //   ② conv.userMsgs[0] 首条消息截取 → 中/英文对话均适用 (消除 _extractPbTitle ASCII-only 盲区)
    //   ③ uuid 前8位 (兜底)           → 无消息的空对话
    // 同时消除原 _extractPbTitle(pbPath) 调用带来的双重 readFileSync + 双重 decryptPb
    const _rawTitle = (meta && meta.title) || "";
    const title =
      _rawTitle ||
      (conv.userMsgs[0]
        ? conv.userMsgs[0].text
            .replace(/[\n\r]+/g, " ")
            .trim()
            .substring(0, 60)
        : "") ||
      uuid.substring(0, 8);
    const sizeKB = Math.round(ct.length / 1024);
    const ts = (meta && meta.backedUpAt) || new Date().toISOString();
    // v3.8.7: 使用 turns[] (user/ai 交织) 代替仅 userMsgs[]
    const turns =
      conv.turns && conv.turns.length > 0
        ? conv.turns
        : conv.userMsgs.map((m) => ({ ...m, role: "user" }));
    const aiCount = turns.filter((x) => x.role === "ai").length;
    const totalTextKB = Math.round(
      turns.reduce((s, t) => s + t.text.length, 0) / 1024,
    );
    let md = "# " + title.replace(/[#[\]]/g, "") + "\n\n";
    md += "> **UUID**: `" + uuid + "`  \n";
    md += "> **大小**: " + sizeKB + " KB  \n";
    md += "> **时间**: " + ts.substring(0, 19).replace("T", " ") + "  \n";
    if (conv.models.length > 0)
      md += "> **模型**: " + conv.models.join(" · ") + "  \n";
    md += "> **步骤**: " + conv.steps + " 轮  \n";
    md += "> **用户消息**: " + conv.userMsgs.length + " 条";
    if (aiCount > 0) md += "　**AI响应**: " + aiCount + " 条";
    md += "　**内容**: " + totalTextKB + " KB  \n";
    md += "\n---\n\n";
    if (turns.length === 0) {
      md += "_（未提取到对话内容 — 密钥不匹配或格式变更）_\n";
    } else {
      let uIdx = 0,
        aIdx = 0,
        tIdx = 0,
        eIdx = 0,
        cIdx = 0;
      turns.forEach((turn, i) => {
        const role = turn.role || "ai";
        if (role === "user") {
          uIdx++;
          md += "## \u{1F464} 用户 " + uIdx + "\n\n";
        } else if (role === "ai") {
          aIdx++;
          md += "## \u{1F916} AI " + aIdx + "\n\n";
        } else if (role === "tool") {
          tIdx++;
          md += "## \u{1F527} 操作 " + tIdx + "\n\n";
        } else if (role === "error") {
          eIdx++;
          md += "## \u26A0\uFE0F 错误 " + eIdx + "\n\n";
        } else {
          cIdx++;
          md += "## \u{1F4C4} 上下文 " + cIdx + "\n\n";
        }
        md += turn.text.trim() + "\n\n";
        if (i < turns.length - 1) md += "---\n\n";
      });
    }
    return md;
  } catch (e) {
    log("pb-to-md err " + path.basename(pbPath) + ": " + (e.message || e));
    return null;
  }
}
// 将 PB 文件导出为 MD 文件 (pbPath → mdPath · 返回是否成功)
function _writePbMd(pbPath, mdPath, meta) {
  try {
    const content = _pbToMdContent(pbPath, meta);
    if (!content) return false;
    fs.writeFileSync(mdPath, content, "utf8");
    return true;
  } catch {
    return false;
  }
}
// v4.2 道法自然 · 软编码适应一切 · 跨平台 LS 二进制自动发现
// 策略: vscode.env.appRoot 自我定位(最可靠) → 平台候选路径探测 → 全盘扫描
function _resolveLanguageServerBin() {
  const plat = process.platform; // win32 | darwin | linux
  const arch = process.arch; // x64 | arm64
  const platName =
    { win32: "windows", darwin: "darwin", linux: "linux" }[plat] || plat;
  const archName = { x64: "x64", arm64: "arm64", ia32: "x64" }[arch] || arch;
  const ext = plat === "win32" ? ".exe" : "";
  const binName = `language_server_${platName}_${archName}${ext}`;
  const relBin = path.join("extensions", "windsurf", "bin", binName);
  const candidates = [];
  // ① 自我定位 · vscode.env.appRoot (运行时推导 · 最可靠 · 道法自然)
  try {
    const ar = vscode.env.appRoot;
    if (ar) candidates.push(path.join(ar, relBin));
  } catch {}
  // ② 平台候选路径
  const home = os.homedir();
  if (plat === "win32") {
    // 扫描所有磁盘根 (不再硬编码 E:/C:)
    for (let c = 67; c <= 90; c++) {
      // C-Z
      const d = String.fromCharCode(c) + ":";
      try {
        if (fs.statSync(d + path.sep).isDirectory())
          candidates.push(path.join(d, "Windsurf", "resources", "app", relBin));
      } catch {}
    }
    candidates.push(
      path.join(
        home,
        "AppData",
        "Local",
        "Programs",
        "Windsurf",
        "resources",
        "app",
        relBin,
      ),
    );
    candidates.push(
      path.join(
        home,
        "AppData",
        "Local",
        "Windsurf",
        "resources",
        "app",
        relBin,
      ),
    );
  } else if (plat === "darwin") {
    candidates.push(
      path.join(
        "/Applications",
        "Windsurf.app",
        "Contents",
        "Resources",
        "app",
        relBin,
      ),
    );
    candidates.push(
      path.join(
        home,
        "Applications",
        "Windsurf.app",
        "Contents",
        "Resources",
        "app",
        relBin,
      ),
    );
  } else {
    candidates.push(
      path.join("/usr", "share", "windsurf", "resources", "app", relBin),
    );
    candidates.push(path.join("/opt", "windsurf", "resources", "app", relBin));
    candidates.push(
      path.join(
        home,
        ".local",
        "share",
        "windsurf",
        "resources",
        "app",
        relBin,
      ),
    );
  }
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}
// v3.8.7 · 补全所有批次中缺失的 MD (密钥已就绪时调用 · 异步)
function _retroactiveMdGeneration() {
  setTimeout(() => {
    try {
      const bkRoot = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
      if (!fs.existsSync(bkRoot)) return;
      let gen = 0,
        skip = 0,
        fail = 0;
      const batches = fs
        .readdirSync(bkRoot)
        .filter((d) => d.startsWith("backup_"))
        .sort();
      for (const batch of batches) {
        const batchDir = path.join(bkRoot, batch);
        try {
          const pbFiles = fs
            .readdirSync(batchDir)
            .filter((f) => f.endsWith(".pb"));
          for (const pb of pbFiles) {
            const pbPath = path.join(batchDir, pb);
            const mdPath = pbPath.replace(/\.pb$/, ".md");
            // v3.10.2 三重判定: MD需重建的条件
            //   ① MD 不存在 → 直接补
            //   ② MD/PB比 < 2% (pbSz>10KB) → 旧版解析器 (fn=20遗漏) · 需重建
            //   ③ MD 含「密钥不匹配」stub → 之前密钥未就绪 · 现在重试
            if (fs.existsSync(mdPath)) {
              try {
                const pbSz = fs.statSync(pbPath).size;
                const mdSz = fs.statSync(mdPath).size;
                if (pbSz > 10000 && mdSz / pbSz < 0.02) {
                  // ② 旧版 MD 质量不达标 · 重生成
                } else {
                  // ③ 检查是否为「密钥不匹配」stub
                  const mdHead = fs
                    .readFileSync(mdPath, "utf8")
                    .substring(0, 400);
                  if (
                    mdHead.includes("密钥不匹配") ||
                    mdHead.includes("未提取到对话内容")
                  ) {
                    // stub → 有新密钥后重试
                  } else {
                    skip++;
                    continue;
                  }
                }
              } catch {
                skip++;
                continue;
              }
            }
            try {
              if (_writePbMd(pbPath, mdPath, {})) gen++;
              else fail++;
            } catch {
              fail++;
            }
          }
        } catch {}
      }
      if (gen > 0 || fail > 0) {
        log(
          "retroactive-md: ✓补 " +
            gen +
            " 个 · 已有 " +
            skip +
            " · 失败 " +
            fail +
            " (共 " +
            (gen + skip + fail) +
            ")",
        );
      }
    } catch (e2) {
      log("retroactive-md err: " + (e2.message || e2));
    }
  }, 3000); // 3s 延迟 · 让备份系统先完成初始化
}
// 启动时自动发现密钥 (异步 · 不阻塞)
function _initDecryptKey() {
  if (_loadDecryptKey()) {
    log("decrypt-key: 缓存命中");
    _retroactiveMdGeneration(); // v3.8.7: 缓存命中时也补全历史MD
    return;
  }
  // 异步扫描 LS 二进制
  setTimeout(() => {
    try {
      // 找样本 (v4.2: HOME → os.homedir() · 修复 ReferenceError)
      const home = os.homedir();
      let sample = null;
      const memPb = path.join(home, ".codeium", "windsurf", "memories", ".pb");
      if (fs.existsSync(memPb)) {
        const b = fs.readFileSync(memPb);
        if (b.length >= 29) sample = b;
      }
      if (!sample && fs.existsSync(PB_DIR)) {
        const files = fs.readdirSync(PB_DIR).filter((f) => f.endsWith(".pb"));
        for (const f of files) {
          const fp = path.join(PB_DIR, f);
          try {
            const b = fs.readFileSync(fp);
            if (b.length >= 29) {
              sample = b;
              break;
            }
          } catch {}
        }
      }
      if (!sample) {
        log("decrypt-key: 无 .pb 样本");
        return;
      }
      // v4.2: 软编码 LS 二进制发现 (跨平台自适应 · 不再硬编码盘符/路径)
      const lsBin = _resolveLanguageServerBin();
      if (!lsBin) {
        log(
          "decrypt-key: LS 二进制未找到 (" +
            process.platform +
            "/" +
            process.arch +
            ")",
        );
        return;
      }
      log("decrypt-key: 扫描 " + lsBin + "...");
      const fileSize = fs.statSync(lsBin).size;
      const CHUNK = 32 * 1024 * 1024;
      const fd = fs.openSync(lsBin, "r");
      let found = null;
      for (let off = 0; off < fileSize && !found; off += CHUNK - 64) {
        const sz = Math.min(CHUNK, fileSize - off);
        const buf = Buffer.alloc(sz);
        fs.readSync(fd, buf, 0, sz, off);
        let runStart = -1;
        for (let i = 0; i <= buf.length && !found; i++) {
          const ok = i < buf.length && buf[i] >= 0x21 && buf[i] <= 0x7e;
          if (ok) {
            if (runStart < 0) runStart = i;
          } else if (runStart >= 0) {
            if (i - runStart >= 32) {
              for (let j = runStart; j <= i - 32 && !found; j++) {
                let u = false,
                  l = false;
                for (let k = 0; k < 32; k++) {
                  const c = buf[j + k];
                  if (c >= 0x41 && c <= 0x5a) u = true;
                  if (c >= 0x61 && c <= 0x7a) l = true;
                }
                if (!u || !l) continue;
                if (_tryDecryptPb(sample, buf.slice(j, j + 32))) {
                  found = Buffer.from(buf.slice(j, j + 32));
                }
              }
            }
            runStart = -1;
          }
        }
      }
      fs.closeSync(fd);
      if (found) {
        _pbDecryptKey = found;
        _saveDecryptKey(found, "binary-scan:" + lsBin);
        log(
          "decrypt-key: ★ 发现密钥 " +
            found.toString("ascii").substring(0, 8) +
            "...",
        );
        // v3.8.7: 首次发现密钥 → 立即补全历史MD (共享函数)
        _retroactiveMdGeneration();
      } else {
        log("decrypt-key: 未找到有效密钥 · 60s后单次重试");
        // v3.8.6 · 单次重试 · 覆盖启动期杀软锁文件/LS二进制延迟就绪等竞争条件
        setTimeout(_initDecryptKey, 60000);
      }
    } catch (e) {
      log("decrypt-key err: " + (e.message || e));
    }
  }, 5000); // 5s 后扫描 · 不影响插件启动
}

// ═══ 对话备份系统 v3.6.0 (自动初始+增量监视+目录迁移 · 无为而无不为) ═══
//
// 设计原则:
//   1. 启动即备: 插件激活时自动全量备份 (每天首次)
//   2. 新增即存: fs.watch PB_DIR → 新.pb立即增量备份
//   3. 改目录即迁: 用户选新目录 → 旧备份全量迁移 → 无缝切换
//   4. 防Windsurf删除: 官方只保留50个·我们永久保存所有历史
//
const BACKUP_META_FILE = path.join(WAM_DIR, "_backup_meta.json");
function _loadBackupMeta() {
  try {
    return JSON.parse(fs.readFileSync(BACKUP_META_FILE, "utf8"));
  } catch {
    return { lastInitDate: "", knownPbs: new Set() };
  }
}
function _saveBackupMeta(m) {
  try {
    const save = {
      lastInitDate: m.lastInitDate || "",
      knownPbs: [...(m.knownPbs || [])],
    };
    fs.writeFileSync(BACKUP_META_FILE, JSON.stringify(save, null, 2));
  } catch {}
}

// v3.7.3: .pb 健康检测 — 小于 28字节为损常 (断电截断写入特征)
// AES-256-GCM 最小结构: 12B nonce + 16B tag = 28B。小于此候必为空/捕个起头的损常文件
function _isValidPb(pbPath) {
  try {
    return fs.statSync(pbPath).size >= 28;
  } catch {
    return false;
  }
}

// v3.7.3: 启动 cascade/ 健康扫描 — 检测断电导致的损常文件 · 发现则警告用户
function _checkCascadeHealth() {
  try {
    if (!fs.existsSync(PB_DIR)) return 0;
    const pbFiles = fs.readdirSync(PB_DIR).filter((f) => f.endsWith(".pb"));
    const zeroed = pbFiles.filter((f) => !_isValidPb(path.join(PB_DIR, f)));
    if (zeroed.length > 0) {
      const uuids = zeroed.map((f) => f.substring(0, 8));
      log(
        "⚠️ cascade健康扫描: " +
          zeroed.length +
          " 个损常文件 " +
          uuids.join(", "),
      );
      _notify(
        "warn",
        "⚠️ 检测到 " +
          zeroed.length +
          " 个对话文件损常 (可能因断电导致)\n" +
          "包含 UUID: " +
          uuids.join(", ") +
          "\n" +
          "可运行: python dao_powerout_repair.py restore 进行修复\n" +
          "或从对话追踪面板备份中恢复",
      );
      return zeroed.length;
    }
    log("cascade健康扫描: " + pbFiles.length + " 个文件全部正常");
    return 0;
  } catch (e) {
    log("cascade健康扫描失败: " + (e.message || e));
    return 0;
  }
}

// 全量备份 (targetDir可选) → 返回 {ok, dir, copied, failed}
function _backupConversations(targetDir) {
  const dir =
    targetDir || _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
  ensureDir(dir);
  let copied = 0,
    failed = 0;
  try {
    if (!fs.existsSync(PB_DIR)) {
      return { ok: false, error: "Cascade 目录不存在", copied: 0, failed: 0 };
    }
    const files = fs.readdirSync(PB_DIR).filter((f) => f.endsWith(".pb"));
    const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    const batchDir = path.join(dir, "backup_" + ts);
    ensureDir(batchDir);
    // Fix3: 构建 UUID→标题映射 (hub.streamingList + stuckList 匹配)
    const _titleMap = {};
    if (_hubData) {
      const _allItems = [
        ...(_hubData.streamingList || []),
        ...(_hubData.stuckList || []),
      ];
      for (const item of _allItems) {
        if (item.shortId) {
          // shortId是 UUID 前8位，写入 prefix map
          _titleMap["_pfx_" + item.shortId] = item.title || "";
        }
        if (item.uuid) _titleMap[item.uuid] = item.title || "";
      }
    }
    const _index = {};
    for (const f of files) {
      try {
        const srcPb = path.join(PB_DIR, f);
        // v3.7.3: 跳过损常文件 — 不把断电祝事存入备份库
        if (!_isValidPb(srcPb)) {
          failed++;
          log("conv-backup: skip " + f + " (损常/过小)");
          continue;
        }
        fs.copyFileSync(srcPb, path.join(batchDir, f));
        copied++;
        // Fix3: 写入 _index.json 条目
        const uuid = f.replace(".pb", "");
        const short = uuid.substring(0, 8);
        const title =
          _titleMap[uuid] ||
          _titleMap["_pfx_" + short] ||
          _extractPbTitle(path.join(PB_DIR, f)) ||
          "";
        const backedUpAt = new Date().toISOString();
        _index[uuid] = {
          title,
          sizeBytes: (() => {
            try {
              return fs.statSync(path.join(PB_DIR, f)).size;
            } catch {
              return 0;
            }
          })(),
          backedUpAt,
        };
        // v3.8.2: 同步导出 MD (无为而无不为 · 备份同时即导出可读文档)
        if (_loadDecryptKey()) {
          try {
            const mdPath = path.join(batchDir, uuid + ".md");
            _writePbMd(srcPb, mdPath, { title, backedUpAt });
          } catch {}
        }
      } catch {
        failed++;
      }
    }
    try {
      fs.writeFileSync(
        path.join(batchDir, "_index.json"),
        JSON.stringify(_index, null, 2),
      );
      fs.writeFileSync(
        path.join(batchDir, "_meta.json"),
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            version: VERSION,
            totalFiles: files.length,
            copied,
            failed,
            hubSnapshot: _hubData || null,
            source: PB_DIR,
            // Fix2: @conversation突破提示
            restoreNote:
              "要使用备份对话: cp {uuid}.pb " +
              PB_DIR +
              " 即可被 @conversation 引用",
          },
          null,
          2,
        ),
      );
    } catch {}
    log(
      "conv-backup: " +
        copied +
        " 文件 → " +
        batchDir +
        " (失败 " +
        failed +
        ")",
    );
    return { ok: true, dir: batchDir, copied, failed };
  } catch (e) {
    log("conv-backup err: " + (e.message || e));
    return { ok: false, error: e.message || String(e), copied, failed };
  }
}

// 启动时自动初始全量备份 (每天一次)
function _initAutoBackup(context) {
  const today = new Date().toISOString().substring(0, 10);
  const meta = _loadBackupMeta();
  // v3.7.3: 启动即扫描 cascade/ 健康状态 (断电损常检测) · 2s 后执行 · 静默扫描不打扰
  setTimeout(() => _checkCascadeHealth(), 2000);
  if (meta.lastInitDate === today) {
    _autoBackupDone = true; // 今日已有备份 → 直接标记完成 (防"待备份"误显)
  } else if (!_autoBackupDone) {
    _autoBackupDone = true;
    setTimeout(
      () => {
        const bkDir = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
        const r = _backupConversations(bkDir);
        if (r.ok) {
          _lastBackupDate = today;
          // 初始化 knownPbs 集合
          const pbFiles = fs.existsSync(PB_DIR)
            ? fs.readdirSync(PB_DIR).filter((f) => f.endsWith(".pb"))
            : [];
          meta.lastInitDate = today;
          meta.knownPbs = new Set(pbFiles);
          _saveBackupMeta(meta);
          log("auto-backup: 今日初始全量 " + r.copied + " 个 → " + r.dir);
          _notify(
            "info",
            "对话自动备份完成: " + r.copied + " 个对话已安全备份",
          );
          _refreshConvTitleMap(); // v13.0: 备份后刷新标题缓存
          _broadcastUI();
        }
      },
      Math.max(1000, +_cfg("autoBackupStartDelayMs", 8000) || 8000),
    ); // v3.7.1 软编码·默8s·可经 wam.autoBackupStartDelayMs 覆盖
  }
  _installIncrementalWatcher(context);
}

// 标题户截: 超过n字加… (UI显示用)
function _truncTitle(t, n) {
  return t && t.length > n ? t.substring(0, n - 1) + "\u2026" : t || "?";
}
function _cleanConvDisplayTitle(t) {
  return String(t == null ? "" : t)
    .replace(/\s+/g, " ")
    .trim();
}
function _isConvDisplayTitle(t, uuid) {
  const s = _cleanConvDisplayTitle(t);
  if (!s) return false;
  const low = s.toLowerCase();
  const u = String(uuid || "").toLowerCase();
  const sid = u ? u.substring(0, 8) : "";
  if (low === "?" || low === "(unnamed)" || low === "unnamed") return false;
  if (u && low === u) return false;
  if (sid && low === sid) return false;
  if (/^[0-9a-f]{8,36}$/i.test(s.replace(/-/g, ""))) return false;
  if (/^\d{6,}$/.test(s)) return false;
  // v3.11.4: 拒绝 UUID 兜底格式 "对话 #xxxxxxxx" (来自 dao_stuck.js fallback)
  // 根因: dao_stuck.js 无 better-sqlite3 时生成 "对话 #短UUID" 兜底
  //       此兜底不应被视为有效标题 · 应继续 fallback 到 _convTitleMap
  if (/^对话\s*#[0-9a-f]{6,}/i.test(s)) return false;
  return true;
}
function _convDisplayTitle(uuid, ...candidates) {
  for (const c of candidates) {
    if (_isConvDisplayTitle(c, uuid)) return _cleanConvDisplayTitle(c);
  }
  return "";
}

// 增量监视: 新.pb文件出现时自动备份 (防Windsurf扩展50个对话被官方删除)
function _installIncrementalWatcher(context) {
  if (!fs.existsSync(PB_DIR)) return;
  try {
    const watcher = fs.watch(PB_DIR, { persistent: false }, (event, fname) => {
      if (!fname || !fname.endsWith(".pb")) return;
      clearTimeout(_incrementalDebounce);
      const _debMs = Math.max(
        500,
        +_cfg("incrementalBackupDebounceMs", 3000) || 3000,
      ); // v3.7.1 软编码
      _incrementalDebounce = setTimeout(
        () => _doIncrementalBackup(fname),
        _debMs,
      );
    });
    _convPbWatcher = watcher;
    context.subscriptions.push({
      dispose: () => {
        try {
          if (_convPbWatcher) {
            _convPbWatcher.close();
            _convPbWatcher = null;
          }
        } catch {}
      },
    });
    log("auto-backup: 增量监视器已安装 " + PB_DIR);
  } catch (e) {
    log("auto-backup watcher err: " + (e.message || e));
  }
}

// 增量备份单个新增/变大的.pb文件
function _doIncrementalBackup(fname) {
  try {
    const src = path.join(PB_DIR, fname);
    if (!fs.existsSync(src)) return;
    // v3.7.3: 跳过损常文件 — 断电损常的 .pb 不备份入库
    if (!_isValidPb(src)) {
      log("auto-backup: skip " + fname + " (损常/过小)");
      return;
    }
    const bkRoot = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
    if (!fs.existsSync(bkRoot)) return;
    // 找最新备份目录
    const dirs = fs
      .readdirSync(bkRoot)
      .filter((d) => d.startsWith("backup_"))
      .sort()
      .reverse();
    if (dirs.length === 0) return;
    const targetDir = path.join(bkRoot, dirs[0]);
    const dst = path.join(targetDir, fname);
    const srcSz = fs.statSync(src).size;
    const needBk = !fs.existsSync(dst) || fs.statSync(dst).size < srcSz;
    if (needBk) {
      fs.copyFileSync(src, dst);
      log(
        "auto-backup: +incr " + fname + " (" + Math.round(srcSz / 1024) + "KB)",
      );
      // v3.8.2: 增量备份同步导出 MD
      if (_loadDecryptKey()) {
        try {
          const uuid = fname.replace(".pb", "");
          const title = _extractPbTitle(src) || "";
          const mdPath = path.join(targetDir, uuid + ".md");
          _writePbMd(src, mdPath, {
            title,
            backedUpAt: new Date().toISOString(),
          });
        } catch {}
      }
    }
  } catch (e) {
    log("auto-backup incr err: " + (e.message || e));
  }
}

// ═══ Agent 开放 API 接口 (v3.6.0 · 善建者不拔·善结者不可解) ═══
//
// 写入 ~/.wam/_api.json 供外部 Agent 读取能力清单·直接调用工具
// Agent 可通过请求文件 (IPC) 触发 WAM 內部操作
//
// @conversation 50限制突破方案 (分析):
//   1. Windsurf 内置 @conversation 读 vscdb metadataCache (上限 ~86 sessions)
//   2. 我们的备份包含完整 .pb 文件 (AES-256-GCM加密)
//   3. 恢复方案: 将备份 .pb 复制回 cascade/ 并平叔 vscdb session 元数据
//   4. Windsurf 检测到 .pb 存在 → @conversation 可引用 (vscdb 窗口内的)
//   5. 卷动窗口内的旧会话: vscdb 窗口 = ~86 → 我们可注入先寻找过的会话
//   6. 临时需要时开启 / 不用时移出 → 动态管理 50个槽位
const AGENT_API_FILE = path.join(WAM_DIR, "_api.json");
function _writeAgentApi() {
  try {
    const bkRoot = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
    let backupCount = 0;
    try {
      if (fs.existsSync(bkRoot)) {
        backupCount = fs
          .readdirSync(bkRoot)
          .filter((d) => d.startsWith("backup_")).length;
      }
    } catch {}
    const api = {
      version: VERSION,
      pid: process.pid,
      ts: Date.now(),
      capabilities: [
        {
          name: "backup.list",
          desc: "列出所有备份目录",
          cmd: "wam.listBackups",
        },
        {
          name: "backup.full",
          desc: "触发全量备份",
          cmd: "wam.backupConversations",
        },
        {
          name: "backup.restore",
          desc: "将备份.pb恢复到cascade/ (vscdb注入)",
          cmd: "wam.restoreConversation",
        },
        { name: "conv.stuck", desc: "查询当前卡住对话", cmd: "via _hub.json" },
        { name: "conv.active", desc: "查询活跃对话列表", cmd: "via _hub.json" },
        {
          name: "account.switch",
          desc: "切换当前账号",
          cmd: "wam.switchAccount",
        },
        { name: "account.verify", desc: "验证账号额度", cmd: "wam.verifyAll" },
      ],
      ipc: {
        hubFile: path.join(WAM_DIR, "_hub.json"),
        reqFile: path.join(WAM_DIR, "_api_req.json"),
        resFile: path.join(WAM_DIR, "_api_res.json"),
      },
      backup: {
        dir: bkRoot,
        count: backupCount,
        pbDir: PB_DIR,
        // @conversation 突破: 备份 .pb 可通过恢复函数重新进入 Windsurf @引用库
        note: "备份.pb + vscdb注入 = 突破官方50对话限制·历史对话可被@引用",
      },
    };
    fs.writeFileSync(AGENT_API_FILE, JSON.stringify(api, null, 2));
  } catch {}
}

// ═══ 对话追踪前端 HTML 片段 (buildHtml 内嵌) ═══
// 读 Hub 数据 + 本地 .pb 目录 → 生成对话追踪区域 HTML
function _getConvTrackingHtml() {
  // v3.11.4: 每次渲染前尝试从 vscdb 裸读刷新标题 (增量·有去重·10s节流)
  _refreshTitlesFromVscdbRaw();
  const hub = _hubData;
  const backupDir = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
  // ── 无 Hub 数据时 · 显示简要状态 ──
  if (!hub || !hub.ts) {
    return `<div class="conv-section">
<div class="conv-header" onclick="toggleConv()"><span>&#128172; 对话追踪</span><span id="convArrow">&#9660;</span></div>
<div class="conv-body" id="convBody">
<div class="conv-empty">对话追踪引擎未运行 · 自动备份仍在运行</div>
<div class="conv-actions">
<button onclick="doSetBackupDir()" class="conv-btn" title="配置备份目录·已有备份自动迁移·每日自动全量备份·新对话实时增量同步">&#128193; 备份配置</button>
${_autoBackupDone ? '<span style="color:#4ec9b0;font-size:9px">&#10003; 已自动备份</span>' : '<span style="color:#888;font-size:9px">启动中待备份(8s)</span>'}
</div>
<div class="conv-backup-path" title="${_esc(backupDir)}">备份: ${_esc(backupDir)}</div>
</div></div>`;
  }

  // ── 有 Hub 数据 · 完整显示 ──
  const age = Math.round((Date.now() - hub.ts) / 1000);
  const isStale = age > 60;

  // v3.8.0「三」统一过滤 + 有效计数从 visibleStuck 直算 (扣其锐·解其纷·眼见为实)
  //   过滤条件: dismiss 未过期 → 隐藏 · staleSec > 10min → 静默隐藏
  //   有效计数: 直接从 visibleStuck 按 level 统计 (不再依赖 hub.stuck/hub.error 历史数据)
  //   根治: hub.error=17 含大量历史 unknown_error → 面板不再虚标
  const _nowCv = Date.now();
  let visibleStuck = [];
  if (hub.stuckList && hub.stuckList.length > 0) {
    visibleStuck = hub.stuckList.filter((s) => {
      if (s.staleSec > STUCK_STALE_MAX) return false;
      // v14.0 根治: UUID 兜底代替静默丢弃 — 卡死对话必显示·与通知同源
      //   旧逻辑「无标题就不显示」违反「卡死必告知」原则 → 用户失明
      //   新逻辑: title 失败 → "对话 #短UUID" 兜底 → 始终可见
      const _titleOk =
        _convDisplayTitle(
          s.uuid,
          s.title,
          s.uuid ? _convTitleMap[s.uuid] : "",
        ) ||
        (s.uuid ? "对话 #" + String(s.uuid).replace(/-/g, "").slice(0, 8) : "");
      if (!_titleOk) return false;
      s._displayTitle = _titleOk;
      if (!s.uuid) return true;
      // v13.0: 10min无操作自动消失 (从首次通知时刻起算)
      const _fntCv = _stuckFirstNotifyTs.get(s.uuid);
      if (_fntCv && _nowCv - _fntCv > STUCK_NOTIFY_AUTO_DISMISS_MS) {
        if (!_dismissedConvUuids.has(s.uuid))
          _dismissedConvUuids.set(s.uuid, _nowCv);
        return false;
      }
      const dt = _dismissedConvUuids.get(s.uuid);
      if (!dt) return true;
      if (_nowCv - dt < CONV_DISMISS_TTL) return false; // 未过期 dismiss · 隐藏
      _dismissedConvUuids.delete(s.uuid); // 10min 已过期 · 自然清除
      return true;
    });
  }
  // v3.8.0: 有效计数从 visibleStuck 直接按 level 统计 (DEAD→error, 其余→stuck)
  let _effectiveStuck = 0;
  let _effectiveError = 0;
  for (const s of visibleStuck) {
    if (s.level === "DEAD") _effectiveError++;
    else _effectiveStuck++;
  }
  // 有效计数驱动 dot 指示灯: 有可见卡住/错误→红灯 · 否则绿灯
  const dotCls = isStale
    ? "off"
    : _effectiveStuck > 0 || _effectiveError > 0
      ? "stuck"
      : "ok";
  const dotTitle = isStale
    ? "引擎数据过期 (" + age + "s)"
    : "引擎运行中 (pid " + (hub.pid || "?") + ")";

  // v10: 展示全部 streaming 对话 (hub.streamingList 优先、降级用 hub.current)
  // 标题超过25字户截: 天下之至柔·水善利万物而有静
  // v3.11.2「止跳」:
  //   ① 对话/流式计数用原始 streamingList 长度 · 不被 title 过滤抖动
  //      根因: cascade 新对话刚建时无 title → 旧逻辑过滤为 0 → 0↔1 弹来弹去
  //   ② 渲染时 title 失败 → 用短 UUID 兜底显示「对话 #abcd1234」
  //      契约: 计数与显示解耦 · 真活动数永真 · 标题随 cascade 自然填入
  let currentHtml = "";
  const _rawStreamingList = hub.streamingList || [];
  const _visibleStreamingList = _rawStreamingList
    .map((c) => {
      const title = _convDisplayTitle(
        c.uuid,
        c.title,
        c.uuid ? _convTitleMap[c.uuid] : "",
      );
      // v3.11.2 兜底: title 失败但 uuid 有 → 显示「对话 #短uuid」
      const _displayTitle =
        title ||
        (c.uuid ? "对话 #" + String(c.uuid).replace(/-/g, "").slice(0, 8) : "");
      return _displayTitle ? { ...c, _displayTitle } : null;
    })
    .filter(Boolean);
  // v15.1 · 应用 dismissed 过滤到 streamingList (与 stuckList 一致)
  //   用户主权扩展: streamingList 中也支持 X 关闭 → 已 dismissed 对话不再显示 (10min)
  const _nowSv = Date.now();
  const _streamingFiltered = _visibleStreamingList.filter((c) => {
    if (!c.uuid) return true;
    const _dt = _dismissedConvUuids.get(c.uuid);
    if (!_dt) return true;
    if (_nowSv - _dt < CONV_DISMISS_TTL) return false; // 未过期 · 隐藏
    _dismissedConvUuids.delete(c.uuid); // 过期 · 自然清除
    return true;
  });
  // v3.11.2 计数用过滤后 list 长度 · 显示同源
  let _visibleConversationCount = _streamingFiltered.length;
  let _visibleFlowCount = _streamingFiltered.filter(
    (c) => !c.isAwaitingUser && c.state === "streaming" && !c._isStale,
  ).length;
  if (_streamingFiltered.length > 0) {
    currentHtml = _streamingFiltered
      .map((c) => {
        // v13.1: 只显示用户可读标题，不再 shortId 兜底
        const shortT = _truncTitle(c._displayTitle, 25);
        const st =
          c.staleSec > 0
            ? (c.staleSec >= 60
                ? Math.round(c.staleSec / 60) + "min"
                : c.staleSec + "s") + "前"
            : "";
        // v15.0 · 状态标识三态:
        //   ▶ 流式 (新鲜·绿) / ⚠ 警告 (warning/stuck) / ◐ 陈旧 (_isStale·黄) / ❓ 未生成 (no_pb·灰)
        const _isNoPb = c.state === "no_pb";
        const _isWarning = c.state === "warning" || c.state === "stuck";
        const _isStale = c._isStale && !_isWarning && !_isNoPb;
        const _stateIcon = _isNoPb
          ? "&#10067;" // ❓ NO_PB
          : c.isAwaitingUser
            ? "&#9654;" // ▶ 等待用户输入
            : _isWarning
              ? "&#9888;" // ⚠ 警告
              : _isStale
                ? "&#9680;" // ◐ 陈旧停滞
                : "&#9654;"; // ▶ 流式输出
        // v15.0 · 文字提示三态
        const _stateHint = _isNoPb
          ? ' <span style="color:#888;font-size:9px">未生成 .pb</span>'
          : c.isAwaitingUser
            ? ' <span style="opacity:.5;font-size:9px">…待回</span>'
            : _isWarning
              ? ' <span style="color:#e5a;font-size:9px">停滞</span>'
              : _isStale
                ? ' <span style="color:#cc9a3a;font-size:9px">陈旧</span>'
                : "";
        // v15.1 修复② · 用户主权: streamingList 全部对话也加 X 按钮 (与 stuckList 同款)
        //   用户能对所有显示的对话主动关闭追踪 (10min 静默)
        //   防止有用对话被错误识别 · 不必等系统自动消退
        const _safeUuid = (c.uuid || "").replace(/'/g, "");
        const _xBtn = _safeUuid
          ? `<button class="cv-close" data-uuid="${_safeUuid}" onclick="dismissConv('${_safeUuid}')" title="关闭此对话追踪 · 10min 后若仍活跃将恢复">&#10005;</button>`
          : "";
        return `<div class="cv-current"><span class="cv-streaming">${_stateIcon}</span> <b>${_esc(shortT)}</b>${c.sizeKB ? " · " + c.sizeKB + "KB" : ""}${st ? " · " + st : ""}${_stateHint}${_xBtn}</div>`;
      })
      .join("");
  } else if (
    hub.current &&
    _convDisplayTitle(
      hub.current.uuid,
      hub.current.title,
      hub.current.uuid ? _convTitleMap[hub.current.uuid] : "",
    )
  ) {
    const c = hub.current;
    const displayTitle = _convDisplayTitle(
      c.uuid,
      c.title,
      c.uuid ? _convTitleMap[c.uuid] : "",
    );
    _visibleConversationCount = 1;
    _visibleFlowCount = c.phase === "streaming" ? 1 : 0;
    const phaseTag =
      c.phase === "streaming"
        ? '<span class="cv-streaming">&#9654; 流式中</span>'
        : c.phase === "completed"
          ? '<span class="cv-completed">&#10003; 已完成</span>'
          : '<span class="cv-other">' + _esc(c.phase || "?") + "</span>";
    const shortT = _truncTitle(displayTitle, 25);
    currentHtml = `<div class="cv-current">${phaseTag} <b>${_esc(shortT)}</b>${c.sizeKB ? " · " + c.sizeKB + "KB" : ""}${c.staleSec > 0 ? " · " + (c.staleSec >= 60 ? Math.round(c.staleSec / 60) + "min" : c.staleSec + "s") + "前" : ""}</div>`;
  }

  // v10+v3.7.7: 卡住列表 HTML (已统一过滤 · 用 visibleStuck)
  let stuckHtml = "";
  if (visibleStuck.length > 0) {
    stuckHtml = visibleStuck
      .map((s) => {
        const levelCls =
          s.level === "DEAD"
            ? "cv-dead"
            : s.level === "CRITICAL"
              ? "cv-crit"
              : "cv-warn";
        const staleStr =
          s.staleSec >= 60
            ? Math.round(s.staleSec / 60) + "min"
            : s.staleSec + "s";
        const safeUuid = (s.uuid || "").replace(/'/g, "");
        // v3.7.6: button 加 data-uuid → dismissConv() 点击即刻本地 .remove() 无需等服务端
        return `<div class="cv-stuck-item ${levelCls}"><span class="cv-level">${_esc(s.level)}</span> <span class="cv-name">${_esc(s._displayTitle)}</span> <span class="cv-stale">${staleStr}</span>${s.sizeKB ? `<span class="cv-size"> · ${s.sizeKB}KB</span>` : ""}<button class="cv-close" data-uuid="${safeUuid}" onclick="dismissConv('${safeUuid}')" title="关闭此提醒 (10min后若仍卡住将恢复)">&#10005;</button></div>`;
      })
      .join("");
  }

  // v10+v3.8.0: 统计摘要 · 有效计数从 visibleStuck 直算 (不再虚标历史数据)
  const sumHtml =
    `<div class="cv-summary"><span class="cv-dot ${dotCls}" title="${dotTitle}"></span>` +
    `<span>对话<b>${_visibleConversationCount}</b></span>` +
    `<span>流式<b>${_visibleFlowCount}</b></span>` +
    (_effectiveStuck > 0
      ? `<span class="cv-stuck-n">卡住<b>${_effectiveStuck}</b></span>`
      : "") +
    (_effectiveError > 0
      ? `<span class="cv-err-n">错误<b>${_effectiveError}</b></span>`
      : "") +
    `</div>`;

  // v3.6.0: 备份目录路径 + 自动备份状态
  const backupStatus = _autoBackupDone
    ? '<span style="color:#4ec9b0;font-size:9px">&#10003; 已自动备份</span>'
    : '<span style="color:#888;font-size:9px">待备份</span>';

  // v3.7.7: badge 用 visibleStuck.length (可见卡住数 · 与列表完全一致)
  const _badgeCount = visibleStuck.length;
  return `<div class="conv-section">
<div class="conv-header" onclick="toggleConv()"><span>&#128172; 对话追踪</span>${_badgeCount > 0 ? '<span class="cv-badge">' + _badgeCount + "</span>" : ""}<span id="convArrow">&#9660;</span></div>
<div class="conv-body" id="convBody">
${sumHtml}${currentHtml}${stuckHtml ? '<div class="cv-stuck-list">' + stuckHtml + "</div>" : ""}
<div class="conv-actions">
<button onclick="doSetBackupDir()" class="conv-btn" title="选择备份目录·已有备份自动迁移·每日自动备份·新对话实时同步">&#128193; 备份配置</button>
${backupStatus}
</div>
<div class="conv-backup-path" title="${_esc(backupDir)}">备份: ${_esc(backupDir)}</div>
</div></div>`;
}
function atomicWrite(filePath, content) {
  ensureDir(path.dirname(filePath));
  const tmp = filePath + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, content);
  try {
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try {
      fs.copyFileSync(tmp, filePath);
    } catch {}
    // v2.4.4 · bug 5: 无论 rename / copy 成败 · 必清 .tmp · 防累 70+ 个孤儿
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw e;
  }
}
// v2.4.4 · bug 5: 启动一次性清 ~/.wam 下 >1h 的孤儿 .tmp · 历史 atomicWrite 漏处理
function sweepOrphanTmp() {
  try {
    const dir = path.join(os.homedir(), ".wam");
    if (!fs.existsSync(dir)) return 0;
    const now = Date.now();
    const files = fs.readdirSync(dir);
    let n = 0;
    for (const f of files) {
      if (!f.endsWith(".tmp")) continue;
      // 形如 wam-state.json.28924.1777500147089.tmp · 截 mtime
      try {
        const st = fs.statSync(path.join(dir, f));
        if (now - st.mtimeMs > 3600 * 1000) {
          fs.unlinkSync(path.join(dir, f));
          n++;
        }
      } catch {}
    }
    if (n > 0) log("sweepOrphanTmp: 清 " + n + " 个孤儿 .tmp");
    return n;
  } catch (e) {
    return 0;
  }
}
// ═══ v2.7.4 (补入v3.0.2) · 🔒 独立持久化 · multi-window race-safe ═══
//   治法: lock-state.json 专司🔒 · A 写 lock-state → B 的 save() 不动此文件 → race 自消
function _readLockState() {
  try {
    if (!fs.existsSync(LOCK_FILE)) return {};
    const j = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
    return j && typeof j === "object" && j.locks ? j.locks : {};
  } catch (e) {
    log("_readLockState fail: " + e.message);
    return {};
  }
}
// 写: read-modify-write · 单进程内 atomic · multi-process last-writer-wins (安全·唯 toggleSkip 写)
// ═══ v3.0.3 · 🚀 Session 预缓存体系 · 切号全程运动利万物而不争 ═══
// 根治: devinLogin 是切号热路径的唱题 (IP级速率限制)
//   沿革: verifyOneAccount 已走 devinLogin 全流 → 缓存 token
//           rotateNext/loginAccount 先查缓存 → 命中则跳 devinLogin 直射 injectToken
//           缓存未命中/失效 → 退退 fallback 全登录路径
// 默认有效期: wam.tokenCacheMaxAgeMs (15min) · verifyAll周期为15-30min — 需单单对应
const _sessionCache = new Map(); // email.lower → { sessionToken, apiKey, apiServerUrl, cachedAt, maxAgeMs }
// v3.1.1 · _devinLoginGate Promise chain 已损 · 改用 _lastDevinLoginAt minGap (单变量·顺其自然)
// v3.1.1 · sessionCache 持久化磁盘 · 跨重启不丢 · 永久突破 IP 限速
// v3.1.2 · 默认 maxAgeMs 对齐 24h disk TTL (修 v3.1.1 隐藏 bug: in-memory 15min 与 disk 24h 不一致)
const SESSION_CACHE_FILE = path.join(WAM_DIR, "_session_cache.json");
const SESSION_CACHE_DISK_TTL_MS = 24 * 60 * 60 * 1000; // 24h · sessionToken JWT 实际有效远超此
// v3.1.2 · devinLogin 限速自感知窗口 (auto-backoff · 永不打死服务器)
let _devinLoginRateLimitedUntil = 0; // ms timestamp · 当前限速窗口结束时间
function _cacheSession(email, sessionToken, apiKey, apiServerUrl) {
  if (!email || !sessionToken) return;
  // v3.1.2 · 默认用 24h disk TTL · in-memory 与 disk 一致 · 修 v3.1.1 隐藏 bug
  const maxAgeMs = Math.max(
    60000,
    +_cfg("tokenCacheMaxAgeMs", SESSION_CACHE_DISK_TTL_MS) ||
      SESSION_CACHE_DISK_TTL_MS,
  );
  _sessionCache.set(email.toLowerCase(), {
    sessionToken,
    apiKey: apiKey || "",
    apiServerUrl: apiServerUrl || "",
    cachedAt: Date.now(),
    maxAgeMs,
  });
  // v3.1.1 · 写后同步落盘 (debounce 500ms 合并高频)
  if (typeof _persistSessionCache === "function") _persistSessionCache();
}
function _getCachedSession(email) {
  if (!email) return null;
  const c = _sessionCache.get(email.toLowerCase());
  if (!c) return null;
  // v3.1.2 · 优先用 entry 自身 maxAgeMs (磁盘加载/写入时已设) · fallback _cfg
  //   修 v3.1.1 隐藏 bug: 磁盘加载 entry maxAgeMs=24h 但原 _cfg(15min) 覆盖→仅 15min 后失效
  const maxAgeMs =
    c.maxAgeMs ||
    Math.max(
      60000,
      +_cfg("tokenCacheMaxAgeMs", SESSION_CACHE_DISK_TTL_MS) ||
        SESSION_CACHE_DISK_TTL_MS,
    );
  if (Date.now() - c.cachedAt > maxAgeMs) {
    _sessionCache.delete(email.toLowerCase());
    return null;
  }
  // v3.1.2 · 命中续期 · 活跃号永不过期 · 冷号 24h 后自然清理
  //   含义: cache hit = 号有使用 = sessionToken 实际仍有效 → 重置 TTL 计时
  //   异步落盘 (debounce 500ms) · IO 无风暴 · 高频切号安全
  c.cachedAt = Date.now();
  if (typeof _persistSessionCache === "function") _persistSessionCache();
  return c;
}
function _evictSessionCache(email) {
  if (email) _sessionCache.delete(email.toLowerCase());
  _persistSessionCache(); // v3.1.1 · 驱逐时同步落盘 · 保持磁盘一致
}
// v3.1.1 · sessionCache 持久化函数族 · 顺其自然·重启不丢
//   时机: _cacheSession 写入后 (debounce 500ms 合并高频) + _evictSessionCache 后 + deactivate
//   原子性: atomicWrite 单文件 · multi-window 安全 (last-writer-wins · 不致脏读)
//   形式: JSON · 字段同 in-memory Map · diskTtl 24h (sessionToken JWT 真实有效远超)
//   读出: _loadSessionCacheFromDisk 在 activate 启动时调用 · 静默忽略过期项
let _persistDebounceTimer = null;
function _persistSessionCache() {
  // 防抖 · 高频写入合并 (verifyAll 期间可能并发 100+ _cacheSession)
  // v3.7.2 · 防抖从 500ms 降至 100ms · 减少断电丢 token 窗口 (性能影响极小)
  if (_persistDebounceTimer) clearTimeout(_persistDebounceTimer);
  _persistDebounceTimer = setTimeout(() => {
    _persistDebounceTimer = null;
    try {
      const obj = {};
      const now = Date.now();
      for (const [email, c] of _sessionCache.entries()) {
        // 仅持久化未过期的 (磁盘 TTL 24h · 比 in-memory 15min 长得多)
        if (now - c.cachedAt < SESSION_CACHE_DISK_TTL_MS) {
          obj[email] = {
            sessionToken: c.sessionToken,
            apiKey: c.apiKey || "",
            apiServerUrl: c.apiServerUrl || "",
            cachedAt: c.cachedAt,
          };
        }
      }
      atomicWrite(SESSION_CACHE_FILE, JSON.stringify(obj, null, 0));
    } catch (e) {
      log("_persistSessionCache fail: " + (e.message || e));
    }
  }, 100); // v3.7.2: 100ms (原500ms) · 减少断电丢token窗口
}
function _loadSessionCacheFromDisk() {
  try {
    if (!fs.existsSync(SESSION_CACHE_FILE)) return 0;
    const j = JSON.parse(fs.readFileSync(SESSION_CACHE_FILE, "utf8"));
    if (!j || typeof j !== "object") return 0;
    const now = Date.now();
    let n = 0;
    for (const email of Object.keys(j)) {
      const c = j[email];
      if (!c || !c.sessionToken || !c.cachedAt) continue;
      // 磁盘 TTL 24h 过滤 (super-set of in-memory · 由 _getCachedSession 兜底再过滤)
      if (now - c.cachedAt >= SESSION_CACHE_DISK_TTL_MS) continue;
      _sessionCache.set(email.toLowerCase(), {
        sessionToken: c.sessionToken,
        apiKey: c.apiKey || "",
        apiServerUrl: c.apiServerUrl || "",
        cachedAt: c.cachedAt,
        maxAgeMs: SESSION_CACHE_DISK_TTL_MS, // 用磁盘 TTL · 不再受 wam.tokenCacheMaxAgeMs 限制
      });
      n++;
    }
    return n;
  } catch (e) {
    log("_loadSessionCacheFromDisk fail: " + (e.message || e));
    return 0;
  }
}
// ═══ v3.1.0 · openExternal 持久守卫 · 天下之至柔驰骋于天下之致坚 ═══
// 切号期间拦截 windsurf.com 认证 URL 的 openExternal 调用 · 从源头断弹窗
// 原理: Windsurf extension 内部 login() / provideAuthToken() / LOGIN_WITH_REDIRECT
//   都最终调 vscode.env.openExternal(loginUrl) 弹浏览器 · 我们在切号窗口内
//   替换 openExternal 为守卫函数 · 凡 windsurf.com/account URL 静默吞掉 · 其余放行
let _origOpenExternal = null; // 原始 openExternal 备份
let _guardBlockCount = 0; // 守卫拦截计数 (诊断)
function _installOpenExternalGuard() {
  if (_openExternalGuardActive) return; // 已安装 · 幂等
  try {
    _origOpenExternal = vscode.env.openExternal;
    const _guard = async (uri) => {
      const s = uri && (typeof uri === "string" ? uri : uri.toString());
      // v3.13.0 · 拦截 windsurf.com + devin.ai 认证相关 URL (account/login/auth/signin)
      //   Devin Desktop 品牌迁移后可能走 devin.ai 域名认证
      if (
        s &&
        (/windsurf\.com\/(account|_devin-auth|auth|signin|login)/i.test(s) ||
          /devin\.ai\/(auth|login|signin|oauth|account)/i.test(s))
      ) {
        _guardBlockCount++;
        log(
          "🛡️ openExternal guard: 拦截 auth URL #" +
            _guardBlockCount +
            " → " +
            (s.length > 80 ? s.substring(0, 80) + "..." : s),
        );
        return false; // 静默吞掉 · 不弹浏览器
      }
      // 非 auth URL → 放行 (如帮助页面等)
      return _origOpenExternal.call(vscode.env, uri);
    };
    Object.defineProperty(vscode.env, "openExternal", {
      value: _guard,
      configurable: true,
      writable: true,
    });
    _openExternalGuardActive = vscode.env.openExternal === _guard;
    if (_openExternalGuardActive) {
      log("🛡️ openExternal guard: 已安装 · 切号窗口保护中");
    } else {
      log("🛡️ openExternal guard: defineProperty 不粘 · 降级无守卫");
      _origOpenExternal = null;
    }
  } catch (e) {
    log("🛡️ openExternal guard: 安装失败 · " + (e.message || e));
    _origOpenExternal = null;
    _openExternalGuardActive = false;
  }
}
function _removeOpenExternalGuard() {
  if (!_openExternalGuardActive || !_origOpenExternal) {
    _openExternalGuardActive = false;
    return;
  }
  try {
    Object.defineProperty(vscode.env, "openExternal", {
      value: _origOpenExternal,
      configurable: true,
      writable: true,
    });
    log("🛡️ openExternal guard: 已卸载 · 拦截 " + _guardBlockCount + " 次");
  } catch (e) {
    log("🛡️ openExternal guard: 卸载失败 · " + (e.message || e));
  }
  _openExternalGuardActive = false;
  _origOpenExternal = null;
}
// v3.2.0 · 圣人抱一 · 模式切换三处归一
//   三处调用 (setMode webview · setModeWam cmd · setModeOfficial cmd) → 单一函数
//   官方模式: 停引擎 + windsurf.logout + 卸guard (v3.1.4 三步净身)
//   WAM模式: 装guard + 启引擎
//   返回: true=模式已变 / false=已是此模式 (无变化)
async function _setMode(mode) {
  const m = mode === "official" ? "official" : "wam";
  if (m === _wamMode) return false;
  _wamMode = m;
  if (m === "official") {
    if (_engine) _engine.stopMonitor();
    _removeOpenExternalGuard();
    log("_setMode: official · 引擎停 · guard卸 · 调 logout");
    try {
      // v3.13.0 · 自适应 logout 命令 · devin.logout 或 windsurf.logout
      const _logoutCmd = await _getAuthCommand("LOGOUT");
      await vscode.commands.executeCommand(_logoutCmd || "devin.logout");
      log("_setMode: " + (_logoutCmd || "devin.logout") + " ✓");
    } catch (_e) {
      log("_setMode: logout err: " + (_e.message || _e));
    }
    // v3.2.1 · 官方模式: 停重置感知定时器 (无需刷新)
    if (_resetRefreshTimer) {
      clearTimeout(_resetRefreshTimer);
      _resetRefreshTimer = null;
    }
    // v15.0 · 官方模式: 停硬耗尽看门狗
    _stopHardExhaustWatchdog();
  } else {
    _installOpenExternalGuard();
    if (_engine) _engine.startMonitor();
    // v3.2.1 · WAM模式: 启动重置感知定时器
    _scheduleResetRefresh();
    // v15.0 · WAM模式: 启动硬耗尽看门狗 (独立 2s 周期高频检测)
    _startHardExhaustWatchdog();
    log("_setMode: wam · 引擎启 · guard装 · 重置感知启 · 看门狗启");
  }
  if (_ctx) _ctx.globalState && _ctx.globalState.update("wam.mode", m);
  _broadcastUI();
  return true;
}
function _writeLockState(email, locked) {
  try {
    const cur = _readLockState();
    const k = String(email || "").toLowerCase();
    if (!k) return false;
    if (locked) cur[k] = { skipAutoSwitch: true, ts: Date.now() };
    else delete cur[k];
    atomicWrite(
      LOCK_FILE,
      JSON.stringify(
        { version: VERSION, savedAt: Date.now(), locks: cur },
        null,
        2,
      ),
    );
    return true;
  } catch (e) {
    log("_writeLockState fail: " + e.message);
    return false;
  }
}
function _writeLockStates(items) {
  try {
    const cur = _readLockState();
    let n = 0;
    for (const it of items || []) {
      const k = String((it && it.email) || "").toLowerCase();
      if (!k) continue;
      const locked = !!it.locked;
      const before = !!(cur[k] && cur[k].skipAutoSwitch);
      if (locked) cur[k] = { skipAutoSwitch: true, ts: Date.now() };
      else delete cur[k];
      if (before !== locked) n++;
    }
    atomicWrite(
      LOCK_FILE,
      JSON.stringify(
        { version: VERSION, savedAt: Date.now(), locks: cur },
        null,
        2,
      ),
    );
    return { ok: true, changed: n };
  } catch (e) {
    log("_writeLockStates fail: " + e.message);
    return { ok: false, changed: 0 };
  }
}
function _esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// v3.10.4 · 到期时间秒级归一 · 知止而不误杀
//   旧患: daysLeft=Math.round(diff/天) → 剩 <12h 被算 0 → UI 误显“已过期”
//   新法: planEnd 统一归一到毫秒；真过期只看 planEnd<=now；剩余天数用 ceil，未到期至少 1天
const EXPIRY_DAY_MS = 86400000;
function _parseTimeMs(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0;
    const t = Date.parse(s);
    if (!isNaN(t)) return t;
    return _parseTimeMs(Number(s));
  }
  if (typeof v === "object") {
    if (v.seconds != null) {
      const sec = Number(v.seconds);
      const nano = Number(v.nanos != null ? v.nanos : v.nanoseconds || 0);
      if (isFinite(sec))
        return Math.round(sec * 1000 + (isFinite(nano) ? nano / 1e6 : 0));
    }
    return 0;
  }
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return 0;
  if (n >= 1e12) return Math.round(n); // unix ms
  if (n >= 1e9) return Math.round(n * 1000); // unix seconds
  return 0;
}
function _calcDaysLeft(planEnd, now = Date.now()) {
  const pe = _parseTimeMs(planEnd);
  if (pe <= 0) return 0;
  const diff = pe - now;
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / EXPIRY_DAY_MS));
}
function _fmt2(n) {
  return String(Math.max(0, Math.floor(Number(n) || 0))).padStart(2, "0");
}
function _formatExpiryTime(planEnd) {
  const pe = _parseTimeMs(planEnd);
  if (pe <= 0) return "?";
  const d = new Date(pe);
  if (isNaN(d.getTime())) return "?";
  const now = new Date();
  const prefix =
    d.getFullYear() === now.getFullYear()
      ? `${d.getMonth() + 1}/${d.getDate()}`
      : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  return `${prefix} ${_fmt2(d.getHours())}:${_fmt2(d.getMinutes())}:${_fmt2(d.getSeconds())}`;
}
function _formatDurationMs(ms) {
  let sec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const days = Math.floor(sec / 86400);
  sec -= days * 86400;
  const hrs = Math.floor(sec / 3600);
  sec -= hrs * 3600;
  const mins = Math.floor(sec / 60);
  sec -= mins * 60;
  if (days > 0) return `${days}天 ${_fmt2(hrs)}:${_fmt2(mins)}:${_fmt2(sec)}`;
  if (hrs > 0) return `${hrs}时${_fmt2(mins)}分${_fmt2(sec)}秒`;
  return `${mins}分${_fmt2(sec)}秒`;
}
function hoursUntilDailyReset() {
  // 兵无常势: API 提供 dailyResetAt 时用真值, 否则 fallback UTC 08:00
  if (_store && _store.activeEmail) {
    const h = _store.getHealth(_store.activeEmail);
    if (h && h.dailyResetAt > Date.now())
      return (h.dailyResetAt - Date.now()) / 3600000;
  }
  const n = new Date();
  const u = new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 8, 0, 0),
  );
  if (u.getTime() < n.getTime()) u.setUTCDate(u.getUTCDate() + 1);
  return (u.getTime() - n.getTime()) / 3600000;
}
function hoursUntilWeeklyReset() {
  // 兵无常势: API 提供 weeklyResetAt 时用真值, 否则 fallback UTC 周日 08:00
  if (_store && _store.activeEmail) {
    const h = _store.getHealth(_store.activeEmail);
    if (h && h.weeklyResetAt > Date.now())
      return (h.weeklyResetAt - Date.now()) / 3600000;
  }
  const n = new Date();
  const day = n.getUTCDay();
  const dts = (7 - day) % 7 || 7;
  const s = new Date(n.getTime());
  s.setUTCDate(s.getUTCDate() + dts);
  s.setUTCHours(8, 0, 0, 0);
  return (s.getTime() - n.getTime()) / 3600000;
}

// ── 本源 v17.42.7: 自动切号辅助 ──

// v3.7.0 · 三维度归一: credits 资源池可用性检测 (道: 大盈若盅·其用不窘)
// promptCredits + flowCredits 余量 >= creditsThreshold → credits可用
// 与 quota% 独立 — quota耗尽但credits充裕时不触发切号
function _hasUsableCredits(h) {
  if (!h) return false;
  const enable =
    typeof _cfg === "function" ? !!_cfg("creditsInScore", true) : true;
  if (!enable) return false;
  const thr =
    typeof _cfg === "function" ? +_cfg("creditsThreshold", 1000) || 1000 : 1000;
  const total = (h.promptCredits || 0) + (h.flowCredits || 0);
  return total >= thr;
}

function isWeeklyDrought() {
  if (!_store) return false;
  const s = _store.getStats();
  return s.drought;
}
// v3.2.1 · 道法自然 · 额度重置感知 · 无为而无不为
//   核心: 每日 UTC 08:00 (北京16:00) 额度重置 · 周日同时刷周额度
//   策略: 精准 setTimeout 到下次重置时刻 → 自动全池刷新 → 用户无感
//   效果: 耗尽号在重置瞬间自动复活 · 无需手动 · 无需等 30min 周期扫描
function _scheduleResetRefresh() {
  if (_resetRefreshTimer) clearTimeout(_resetRefreshTimer);
  _resetRefreshTimer = null;
  if (_wamMode !== "wam") return;
  const hrsDaily = hoursUntilDailyReset();
  const hrsWeekly = hoursUntilWeeklyReset();
  const hrsMin = Math.min(hrsDaily, hrsWeekly);
  const isWeekly = hrsWeekly <= hrsDaily;
  // 重置后 30s 再刷 (留余量让服务端完成重置 · 软编码)
  const bufferMs = Math.max(
    5000,
    +_cfg("resetRefreshBufferMs", 30000) || 30000,
  );
  const delayMs = Math.max(5000, Math.round(hrsMin * 3600000) + bufferMs);
  _resetRefreshTimer = setTimeout(_onResetFired, delayMs);
  log(
    "_scheduleResetRefresh: " +
      (isWeekly ? "周+日" : "日") +
      "重置 · " +
      hrsMin.toFixed(2) +
      "h后 (" +
      Math.round(delayMs / 60000) +
      "min)",
  );
}
async function _onResetFired() {
  _resetRefreshTimer = null;
  if (_wamMode !== "wam") {
    _scheduleResetRefresh();
    return;
  }
  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  log(
    "⏰ 额度重置感知: " +
      (isSunday ? "周日(周+日)" : "日") +
      "重置 · 全池刷新 · " +
      now.toISOString(),
  );
  if (!_verifyAllInProgress) {
    try {
      await verifyAllAccounts({ onlyStale: false, _cacheOnly: true });
      log("⏰ 重置刷新完成 ✓");
    } catch (e) {
      log("⏰ 重置刷新 err: " + (e.message || e));
    }
  } else {
    log("⏰ 重置刷新: verifyAll 进行中 · 30s后重试");
    _resetRefreshTimer = setTimeout(_onResetFired, 30000);
    return;
  }
  _broadcastUI();
  // 刷新完毕 · 重新调度下次重置
  setTimeout(() => _scheduleResetRefresh(), 5000);
}
// v15.0 (3.11.6) · 硬耗尽看门狗 · 独立于 _tick 的高频检测
//
//   ★ 设计动机:
//     _tick 周期 = 10s (scanIntervalMs 默认) · 切号 → setHealth 后下次 _tick 才检测
//     用户感受: 切到的号若 W=0 · 最多卡 10s "Trial - Quota Exhausted"
//     根因: _tick 内既要 fetchPlanStatus 也要切号 · 频率不能太高 (API 速率)
//
//   ★ 治法:
//     看门狗只读 health 内存数据 (无 API 调用) · 高频 (2s) 巡检
//     发现 active 号已知耗尽 + 不在切号/冷却 → 立刻调 _engine._tick() 让其处理
//     与 _tick 防抖: 距上次 _tick < 1s 不再敲门 (避免双重并发)
//
//   ★ 价值:
//     _tick 间歇期 (0-10s) 内若 active 号被识别耗尽 · 看门狗能让 _tick 提前 8s
//     用户感觉: 切到 W=0 号 → 1-2s 后再切 (而非等 10s)
//
//   ★ 软编码: wam.hardExhaustWatchdogMs (默 2000ms · 0=禁用)
function _startHardExhaustWatchdog() {
  if (_hardExhaustWatchdogTimer) {
    clearInterval(_hardExhaustWatchdogTimer);
    _hardExhaustWatchdogTimer = null;
  }
  if (_wamMode !== "wam") return;
  const ms = Math.max(0, +_cfg("hardExhaustWatchdogMs", 2000) || 0);
  if (ms <= 0) return;
  _hardExhaustWatchdogTimer = setInterval(() => {
    try {
      if (!_engine || !_store || !_store.activeEmail) return;
      if (_switching || _engine.rotating) return;
      const h = _store.getHealth(_store.activeEmail);
      if (!h || !h.checked) return;
      if (h.overageActive) return; // overage 真金 · 不视为耗尽
      const _bypass =
        typeof _cfg === "function"
          ? !!_cfg("creditsBypassQuotaGate", false)
          : false;
      if (_bypass && _hasUsableCredits(h)) return; // 兼容老逻辑
      const drought = isWeeklyDrought();
      const isExhausted = drought
        ? h.daily <= 0
        : h.daily <= 0 || h.weekly <= 0;
      if (!isExhausted) return;
      // 防抖: 距上次 _tick < 1s 不再敲门 (避免与 _tick 同时触发)
      if (_engine.lastScanAt && Date.now() - _engine.lastScanAt < 1000) return;
      log(
        "🐶 硬耗尽看门狗触发: 当前号 D=" +
          h.daily +
          "% W=" +
          h.weekly +
          "% · 立即调用 _tick",
      );
      _engine
        ._tick()
        .catch((e) => log("watchdog tick err: " + (e.message || e)));
    } catch (e) {
      log("watchdog err: " + (e.message || e));
    }
  }, ms);
  log("🐶 硬耗尽看门狗启动 · 周期=" + ms + "ms (v15.0)");
}
function _stopHardExhaustWatchdog() {
  if (_hardExhaustWatchdogTimer) {
    clearInterval(_hardExhaustWatchdogTimer);
    _hardExhaustWatchdogTimer = null;
    log("🐶 硬耗尽看门狗停止");
  }
}

// v3.2.0 · isTrialPlan 已损 (从未被调用·真死代码 · _isTrialLike 已替代)
function isClaudeAvailable(h) {
  // v3.0 · 道法自然 · 无为而无不为 · 不限制任何账号
  //   旧法之患: Free/过期/!checked 均被封死 · 附加大量预判逻辑
  //   新法: 一切返 true · 让登录/API实际失败说话 · 不作茧自缚
  return true;
}
// v3.4.1 · 道法自然 · 唯变所适 · 守门候选判定 · 临期感知 (根治守门与临期冲突)
//
// v15.0 (3.11.6) · 道法自然 · 知人者知也 自知者明也 (彻底根治自动切号)
//
//   ★ 用户实地反馈根因 (2026-05-28 截图证据):
//     当前活跃号 julioleyfarley · D=91% W=0% · Trial · PC=10K + FC=20K
//     Windsurf 红字: "Your included weekly usage quota is exhausted"
//     状态栏: "Trial - Quota Exhausted"
//     但 WAM 未切号 · 用户卡死
//
//   ★ 根因链 (v3.7.6 设计错误):
//     _hasUsableCredits(h) = (10K+20K ≥ 1000) = true
//       → _isValidAutoTarget: if (_hasUsableCredits(h)) return true
//       → 当前号被视为"可用" · 不切走
//       → _tick.isHardExhausted = !_hasCreditsActive && (W=0)
//                               = !true && true = false
//       → 不走硬耗尽分支
//     ∴ credits 充裕的 W=0 号 = 永久免死金牌 · 系统失明
//
//   ★ 实证: Cascade premium model (Claude/GPT-4) 只看 weekly% 计费
//     credits (promptCredits/flowCredits) 是给 Devin agent 用 · 非给 Cascade
//     W=0 时 Cascade 后端 429/403 拒服 · 与 credits 余量无关
//
//   ★ 治法 (v15.0):
//     credits 不再单独放行 · 必须先过 quota% 主门槛
//     兼容开关 creditsBypassQuotaGate (默 false · 严守 quota%)
//     true 时回退 v3.7.6 老逻辑 (适用纯 Devin agent 场景)
//
// 历史治法 (v3.4.1 临期感知):
//   · effQ < threshold 且 daysLeft < 7 且 effQ > 0: 放行 (临期抢救 · 不用即废)
//   · effQ < threshold 且 (daysLeft >= 7 或 planEnd=0): 拒绝 (等重置 · 无损)
//   · effQ = 0: 拒绝 (无论临期否 · 真无法使用)
//   · overageActive: 放行 (存量资产 · 第三层主权)
function _isValidAutoTarget(i) {
  if (i < 0 || !_store) return false;
  const acc = _store.accounts[i];
  if (!acc || !acc.password) return false;
  if (acc.skipAutoSwitch) return false;
  const h = _store.getHealth(acc.email);
  if (!h.checked) return true;
  if (h.overageActive) return true; // overage 真金白银 · 永远放行 (Cascade 也认)
  // v15.0 · credits 旁路开关 (默 false · 严守 quota%)
  //   true → 老逻辑 (适纯 Devin agent · 不用 Cascade premium model)
  //   false → 新逻辑 (Cascade premium 模式 · W%=0 必切 · 默认安全)
  const _creditsBypass =
    typeof _cfg === "function"
      ? !!_cfg("creditsBypassQuotaGate", false)
      : false;
  if (_creditsBypass && _hasUsableCredits(h)) return true;
  if (h.planEnd > 0 && h.planEnd < Date.now()) return false;
  const _drought = isWeeklyDrought();
  // v3.8.4 · 绝对最低门槛 (高于临期感知 · 不论临期与否均拒绝)
  //   根因: 临期感知会放行 effQ>0 的临期号 · 但 D<5 或 W≤3 的账号实际无法提供有效额度
  //   治法: 在 effQ/临期 判断之前先过最低门槛 · 软编码可覆盖
  const _dailyMin =
    typeof _cfg === "function" ? +_cfg("autoSwitchDailyMin", 5) || 5 : 5;
  const _weeklyMin =
    typeof _cfg === "function" ? +_cfg("autoSwitchWeeklyMin", 3) || 3 : 3;
  if (h.daily < _dailyMin) return false; // D<5 → 拒绝
  if (!_drought && h.weekly <= _weeklyMin) return false; // W≤3 (非干旱) → 拒绝
  // v15.0 · 此处已过 D/W 主门槛 (D≥5 且 W>3) — credits 可作"次级放行"
  //   语义: quota% 足够 + credits 也充裕 → 双保险 · 优先选
  if (_hasUsableCredits(h)) return true;
  const _effQ = _drought ? h.daily : Math.min(h.daily, h.weekly);
  const _thr =
    typeof _cfg === "function" ? +_cfg("autoSwitchThreshold", 5) || 5 : 5;
  if (_effQ >= _thr) return true;
  // v3.4.1 临期感知: daysLeft<7 且 effQ>0 → 放行 (不用即废先消耗)
  //   注: 临期号已通过上方绝对门槛 (D≥5 且 W>3) · 确保真有可用额度
  const _expiryFirst =
    typeof _cfg === "function" ? !!_cfg("expiryFirst", true) : true;
  if (_expiryFirst && h.planEnd > 0 && h.daysLeft < 7 && _effQ > 0) return true;
  return false;
}

function httpsReq(method, urlStr, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      return reject(e);
    }
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: Object.assign({ "User-Agent": UA }, headers || {}),
        timeout: timeoutMs || HTTP_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks) }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (body) req.write(body);
    req.end();
  });
}
async function jsonPost(url, headers, body, timeoutMs) {
  const r = await httpsReq(
    "POST",
    url,
    Object.assign({ "Content-Type": "application/json" }, headers || {}),
    JSON.stringify(body),
    timeoutMs,
  );
  let parsed = null;
  const text = r.body.toString("utf8");
  try {
    parsed = JSON.parse(text);
  } catch {}
  return { status: r.status, json: parsed, text };
}

// ═══ § 万法识号 v2.7.0 · 道法自然 · 一切账号格式同源 ═══
// 反者道之动 · 弱之胜强 柔之胜刚 · 唯变所适 · 适应万法之格式 · 无为而无不为
//
// 输入: 任意文本 (粘贴自微信/邮件/JSON/CSV/Token面板/卡号卡密/订单消息)
// 输出: { accounts: [{email, password}], tokens: [string] }
//
// 兼容形 (大方无隅 · 同出异名):
//   - 紧贴/分隔: email password / email:pass / email----pass / email|pass / email,pass / email;pass / email\tpass
//   - 反序: pass email (空白分)
//   - JSON 单行 / 多行 JSON 数组
//   - 多行标签 (邮箱:x\n密码:y / Email:x\nPassword:y / 账号:..\n密码:.. / 卡号N:..\n卡密N:..)
//   - 标签数字编号: 卡号1:/账号2:/Email3: 自动剥
//   - 全角 ：=＝ · 标签词典极广 (邮箱|账号|账户|帐号|帐户|用户名|用户|登录名|登陆名|卡号|号码|email|...)
//   - 密码含 @ (如 uuCO4@7hukcO) 标签明确即守一不退 · 不再误为 email
//   - 原始 token (devin-session-token$ / eyJ JWT / auth1_ / 长 base64)
//   - 噪声免疫: '账号管理器:URL' '(无任何空格)' '(去掉点)' '订单编号:数字' '自动发货 时间' 等微信提示文静默跳过
//
// 守道之要 · 反者:
//   1. isValidEmail 严判 (local@domain.tld) · 不再以 includes('@') 草率认 email
//   2. 标签即定锚 · 守一不退 (密码标签后含@仍是密码 · 邮箱标签后非合法email则放过)
//   3. 双向配对 (pendingEmail / pendingPass · 顺逆皆通)

// 合法邮箱严判 · 大象无形 而有定准
function _isValidEmail(s) {
  if (!s || typeof s !== "string") return false;
  s = s.trim();
  if (s.length < 5 || s.length > 254) return false;
  if (/[\s|;,，；\t]/.test(s)) return false; // 分隔符即非法
  // local 段 RFC 宽放: A-Z a-z 0-9 . _ + -
  // domain 段必须有点且 TLD 字母 ≥2
  return /^[A-Za-z0-9._+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/.test(
    s,
  );
}

// 行尾提示剥离 · 微信常附 "(无任何空格)" "(去掉点)" 等于真账号行尾 · 弱者道之用
// 不整行跳过 · 仅剥尾 · 留真主之身
function _stripWxHints(ln) {
  if (!ln) return ln;
  // 反复剥尾 · 直到稳定
  let prev;
  do {
    prev = ln;
    ln = ln
      // 微信反屏蔽提示
      .replace(
        /[（(]\s*(?:无任何空格|去掉点|去点|去掉空格|无空格)\s*[）)]/g,
        "",
      )
      // 含 URL 的"账号管理器:"等子串 (整行嗅探漏过的中段)
      .replace(/\s+账号管理器\s*[:：=＝]\s*\S+/, "")
      .trim();
  } while (ln !== prev && ln.length > 0);
  return ln;
}

// 噪声行嗅探 · 微信/广告/订单 模板文 · 静默跳过
// 守一: 仅识"整行明显是模板文"者跳过 · 真账号行不在此列 (剥尾后另判)
function _isNoiseLine(ln) {
  if (!ln) return true;
  // 订单编号 · 自动发货 · 您的订单 等模板 (开头明确)
  if (
    /^(?:您的|您好|自动发货|订单编号|订单号|交易号|发货时间|订单时间|发货成功|交易成功|尊敬的)/.test(
      ln,
    )
  )
    return true;
  // 纯日期时间行 (无其他实质内容)
  if (/^\s*\d{4}[\-\/年]\d{1,2}[\-\/月]\d{1,2}[\s\d:：年月日时分秒]*$/.test(ln))
    return true;
  // 整行就是「账号管理器」类含 URL · 不是真账号
  // (注: 必须开头即此标签 · 否则可能是真账号行的尾巴 · 已由 _stripWxHints 剥)
  if (
    /^(?:账号管理器|管理面板|管理后台|官网|官方网站|官方地址|商城|售后|客服|发货)\s*[:：=＝]/.test(
      ln,
    )
  )
    return true;
  return false;
}

// ═══ v3.0.4 水无常形·万格通吃 · 账密解析全量增强 ═══
// 标签词典 MID版 (非行首锁定) · 用于行内搜索双标签同行 / bracket兼容
const _RE_EMAIL_LABEL_MID =
  /(?:\[|【)?(?:邮箱|邮件|账号|账户|帐号|帐户|用户名称?|用户|登录名|登陆名|登录账号|登陆账号|登录账户|卡号|号码|账户名|e[\-\s]?mail|email|account|user(?:name)?|login|mail|id|number|num)(?:\]|】)?\s*\d*\s*[:：=＝]\s*/i;
const _RE_PASS_LABEL_MID =
  /(?:\[|【)?(?:密码|登录密码|登陆密码|口令|秘钥|密钥|卡密|令牌|password|pass(?:word|wd)?|pwd|secret|key)(?:\]|】)?\s*\d*\s*[:：=＝]\s*/i;
// _stripAnyLabel: 剥首标签+数字序号 · tryPair双侧调用 · 密码含"密码："前缀自动净化
function _stripAnyLabel(s) {
  s = (s || "").trim();
  s = s.replace(/^(?:#\s*)?\(?\d+[.):\-、，]\s*/, "").trim();
  s = s
    .replace(
      /^(?:\[|【)?(?:邮箱|邮件|账号|账户|帐号|帐户|用户名称?|用户|登录名|登陆名|登录账号|登陆账号|登录账户|卡号|号码|账户名|e[\-\s]?mail|email|account|user(?:name)?|login|mail|id|number|num)(?:\]|】)?\s*\d*\s*[:：=＝]\s*/i,
      "",
    )
    .trim();
  s = s
    .replace(
      /^(?:\[|【)?(?:密码|登录密码|登陆密码|口令|秘钥|密钥|卡密|令牌|password|pass(?:word|wd)?|pwd|secret|key)(?:\]|】)?\s*\d*\s*[:：=＝]\s*/i,
      "",
    )
    .trim();
  return s;
}
// _stripPassTrail · 密码尾部注释净化 · 一劳永逸之本
// 密码永远没有格式 · 但人们常在密码后追加备注 【首次登录需修改】(备注:xxx) 等
// 凡此类尾部中文括号注释 · 全剥 · 还密码本真
function _stripPassTrail(s) {
  if (!s) return s;
  let prev;
  do {
    prev = s;
    // 尾部 【...】 （...） (...)
    s = s.replace(/[\s　]*[【（(][^】）)]{0,60}[】）)][\s　]*$/, "").trim();
    // 尾部 备注:xxx / 提示:xxx / 注意:xxx
    s = s.replace(/[\s　]*(?:备注|提示|注意|说明)\s*[:：].{0,60}$/, "").trim();
    // 尾部 首次登录/请修改/需修改 等动词提示
    s = s
      .replace(
        /[\s　]*(?:首次登录|请.*?修改|需.*?修改|初始密码|默认密码).{0,40}$/,
        "",
      )
      .trim();
  } while (s !== prev && s.length > 0);
  return s;
}
// _stripPassCandLabel · 密码候选侧保守剥 · v3.0.5 一劳永逸根治
// 哲学: 密码无结构 · 只有"确定无歧义"的标签才能被剥取 · 不能剥短歧义词(pass/key/secret/pwd)
//   _stripAnyLabel 含 pass(?:word|wd)? 使裸 pass 也匹配 → user@x.com:pass:word123 被污染为 word123
//   此函数专用于密码候选侧 · 只剥中文标签(无歧义) + 全英长词(>= 8char · 无歧义)
//   保留: pass:xxx / key:xxx / pwd:xxx / secret:xxx 等短英文 → 不再被误剥
function _stripPassCandLabel(s) {
  s = (s || "").trim();
  // 中文标签: 语义明确 无歧义 可安全剥
  s = s
    .replace(
      /^(?:\[|【)?(?:密码|登录密码|登陆密码|口令|秘钥|密钥|卡密|令牌)(?:\]|】)?\s*\d*\s*[:：=＝]\s*/i,
      "",
    )
    .trim();
  // 全英长词(>=8字符): password/passphrase/passwd 无歧义可安全剥 · 不含 pass/key/pwd/secret
  s = s
    .replace(/^(?:password|passphrase|passwd)\s*\d*\s*[:：=＝]\s*/i, "")
    .trim();
  return s;
}
// _emailAnchorExtract · 邮箱锚定通吃法 · 真正一劳永逸之本源
// 哲学: 邮箱是唯一有确定结构的字段 · 密码=行内去除邮箱+标签+噪声后的一切剩余
// 覆盖一切分隔符失效、未知格式、未来格式 — 永久兜底
// v3.0.5: 密码候选改用 _stripPassCandLabel (保守剥) · 不再用 _stripAnyLabel (可污染密码)
const _RE_EMAIL_SCAN =
  /[A-Za-z0-9._+\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}/;
function _emailAnchorExtract(ln) {
  const m = _RE_EMAIL_SCAN.exec(ln);
  if (!m) return null;
  const email = m[0];
  const before = ln
    .substring(0, m.index)
    .replace(/[-\s|,;，；=＝：:·#*（(【>]+$/, "")
    .trim();
  const after = ln
    .substring(m.index + email.length)
    .replace(/^[-\s|,;，；=＝：:·#*）)】<]+/, "")
    .trim();
  // v3.0.5: 保守剥 · 密码侧不再使用 _stripAnyLabel
  const passCand = _stripPassTrail(_stripPassCandLabel(after || before));
  if (!passCand || !_isValidEmail(email)) return null;
  return { email, password: passCand };
}

// _parseDualLabelLine: 双标签同行通吃 · 水无常形 · 任意顺序·任意分隔
// 覆盖: 邮箱：email----密码：pass / 邮箱：email 密码：pass / 密码：pass 邮箱：email
//       【邮箱】email【密码】pass / email:xxx password:yyy 等所有双标签同行格式
function _parseDualLabelLine(ln) {
  const em = _RE_EMAIL_LABEL_MID.exec(ln);
  const pm = _RE_PASS_LABEL_MID.exec(ln);
  if (!em || !pm) return null;
  let emailPart, passPart;
  if (em.index <= pm.index) {
    const afterEmail = ln.substring(em.index + em[0].length);
    const pm2 = _RE_PASS_LABEL_MID.exec(afterEmail);
    if (!pm2) return null;
    emailPart = afterEmail
      .substring(0, pm2.index)
      .replace(/[-\s|,;，；=＝：:·]+$/, "")
      .trim();
    passPart = afterEmail.substring(pm2.index + pm2[0].length).trim();
  } else {
    const afterPass = ln.substring(pm.index + pm[0].length);
    const em2 = _RE_EMAIL_LABEL_MID.exec(afterPass);
    if (!em2) return null;
    passPart = afterPass
      .substring(0, em2.index)
      .replace(/[-\s|,;，；=＝：:·]+$/, "")
      .trim();
    emailPart = afterPass.substring(em2.index + em2[0].length).trim();
  }
  emailPart = emailPart.replace(/^[-\s·]+/, "").trim();
  passPart = passPart.replace(/^[-\s·]+/, "").trim();
  if (!_isValidEmail(emailPart) || !passPart) return null;
  return { email: emailPart, password: passPart };
}

function parseAccountText(content) {
  const accounts = [];
  const tokens = [];
  if (!content || typeof content !== "string") return { accounts, tokens };

  // v3.0.4+ · JSON 数组整体解析 (批量导出 [{email,password},...] 格式优先尝试)
  const _tc = content.trim();
  if (_tc.startsWith("[")) {
    try {
      const _ja = JSON.parse(_tc);
      if (Array.isArray(_ja)) {
        for (const _j of _ja) {
          if (!_j || typeof _j !== "object") continue;
          const _je = String(
            _j.email ||
              _j.username ||
              _j.account ||
              _j.user ||
              _j.mail ||
              _j.login ||
              "",
          ).trim();
          const _jp = String(
            _j.password || _j.pass || _j.pwd || _j.passwd || _j.secret || "",
          ).trim();
          if (_je && _jp && _isValidEmail(_je))
            accounts.push({ email: _je, password: _jp });
          const _jt = String(
            _j.token ||
              _j.sessionToken ||
              _j.session_token ||
              _j.authToken ||
              _j.access_token ||
              "",
          ).trim();
          if (_jt) tokens.push(_jt);
        }
        if (accounts.length || tokens.length) return { accounts, tokens };
      }
    } catch {}
  }

  // 标签词典 · 大方无隅 · 标签后兼容 \d* 数字编号 (卡号1: / 账号2: / Email3:)
  const RE_LABEL_EMAIL =
    /^\s*(?:邮箱|邮件|账号|账户|帐号|帐户|用户名|用户名称|用户|登录名|登陆名|登录账号|登陆账号|登录账户|卡号|号码|账户名|e[\-\s]?mail|email|account|user(?:name)?|login|mail|id|number|num)\s*\d*\s*[:：=＝]\s*/i;
  const RE_LABEL_PASS =
    /^\s*(?:密码|登录密码|登陆密码|口令|秘钥|密钥|卡密|令牌|password|pass(?:word|wd)?|pwd|secret|key|token|access(?:[\-_]?token)?)\s*\d*\s*[:：=＝]\s*/i;
  const RE_TOKEN_PREFIX = /^(devin-session-token\$|auth1_|sk-)/i;
  const RE_JWT = /^eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/;

  function looksLikeToken(s) {
    if (!s) return false;
    if (s.includes("@")) return false;
    if (/[\s\|]|----/.test(s)) return false;
    if (RE_TOKEN_PREFIX.test(s)) return true;
    if (RE_JWT.test(s)) return true;
    // 长 base64-ish · 60+ chars · 仅 [A-Za-z0-9_-.$/+=]
    if (s.length >= 60 && /^[A-Za-z0-9_\-\.\$\/+=]+$/.test(s)) return true;
    return false;
  }

  // tryPair · v3.0.5 两阶段 · 邮箱先锚密码取余 · 像AI一样 · 一劳永逸
  // 第一阶: 裸检(不剥标签) · 保留原始密码值 · 覆盖: 无标签分隔格式、密码含:=等特殊字符
  // 第二阶: 邮箱侧剥标签后再检 · 覆盖: 邮箱有标签前缀(邮箱：xxx / email:xxx) 的情形
  // 密码侧永远使用 _stripPassCandLabel(保守剥) · 永不使用 _stripAnyLabel · 根治 pass:xxx 污染
  function tryPair(a, b) {
    a = (a || "").trim();
    b = (b || "").trim();
    if (!a || !b) return null;
    // 第一阶: 裸检 (无任何剥取) — 原始值最可信 · 密码含:=等不被误剥
    const aIsEmailRaw = _isValidEmail(a);
    const bIsEmailRaw = _isValidEmail(b);
    if (aIsEmailRaw && !bIsEmailRaw)
      return { email: a, password: _stripPassTrail(_stripPassCandLabel(b)) };
    if (bIsEmailRaw && !aIsEmailRaw)
      return { email: b, password: _stripPassTrail(_stripPassCandLabel(a)) };
    if (aIsEmailRaw && bIsEmailRaw)
      return { email: a, password: _stripPassTrail(b) };
    // 第二阶: 邮箱侧剥标签 (处理 "邮箱：xxx" / "email:xxx" 等有标签前缀的邮箱)
    // 密码侧 b/a 同样只用 _stripPassCandLabel (保守) · 不用 _stripAnyLabel
    const aStripped = _stripAnyLabel(a);
    const bStripped = _stripAnyLabel(b);
    if (!aStripped && !bStripped) return null;
    const aIsEmailSt = _isValidEmail(aStripped);
    const bIsEmailSt = _isValidEmail(bStripped);
    if (aIsEmailSt && !bIsEmailSt)
      return {
        email: aStripped,
        password: _stripPassTrail(_stripPassCandLabel(b)),
      };
    if (bIsEmailSt && !aIsEmailSt)
      return {
        email: bStripped,
        password: _stripPassTrail(_stripPassCandLabel(a)),
      };
    if (aIsEmailSt && bIsEmailSt)
      return { email: aStripped, password: _stripPassTrail(b) };
    return null;
  }

  function parseSingleLine(ln) {
    // 0. 双标签同行通吃 (邮箱：email----密码：pass · 任意顺序·任意分隔)
    const _dlr = _parseDualLabelLine(ln);
    if (_dlr) return _dlr;
    // 0b. 行内密码标签: email@x.com密码：pass / email@x.com 密码：pass
    const _inPm = _RE_PASS_LABEL_MID.exec(ln);
    if (_inPm && _inPm.index > 0) {
      const _ec = ln
        .substring(0, _inPm.index)
        .replace(/[-\s|,;，；=＝：:·]+$/, "")
        .trim();
      const _pc = ln.substring(_inPm.index + _inPm[0].length).trim();
      if (_isValidEmail(_ec) && _pc) return { email: _ec, password: _pc };
    }
    // 0c. 行内邮箱标签: pass 邮箱：email / pass----邮箱：email (密码在前邮箱在后)
    const _inEm = _RE_EMAIL_LABEL_MID.exec(ln);
    if (_inEm && _inEm.index > 0) {
      const _pc2 = _stripAnyLabel(
        ln
          .substring(0, _inEm.index)
          .replace(/[-\s|,;，；=＝：:·]+$/, "")
          .trim(),
      );
      const _ec2 = ln.substring(_inEm.index + _inEm[0].length).trim();
      if (_isValidEmail(_ec2) && _pc2) return { email: _ec2, password: _pc2 };
    }
    // 1. ---- (4+ dashes)
    if (/----+/.test(ln)) {
      const i = ln.search(/----+/);
      const m = ln.substring(i).match(/^----+/);
      const r = tryPair(ln.substring(0, i), ln.substring(i + m[0].length));
      if (r) return r;
    }
    // 2. tab
    if (ln.includes("\t")) {
      const i = ln.indexOf("\t");
      const r = tryPair(ln.substring(0, i), ln.substring(i + 1));
      if (r) return r;
    }
    // 3. colon (ASCII / 全角 / =) · 取首个分隔 · 排除 URL
    if (!/^https?:\/\//i.test(ln)) {
      const ci = ln.search(/[:：=＝]/);
      if (ci !== -1) {
        const r = tryPair(ln.substring(0, ci), ln.substring(ci + 1));
        if (r) return r;
      }
    }
    // 4. pipe
    if (ln.includes("|")) {
      const i = ln.indexOf("|");
      const r = tryPair(ln.substring(0, i), ln.substring(i + 1));
      if (r) return r;
    }
    // 5. comma · 分号 (仅 2 段)
    for (const sep of [",", ";", "，", "；"]) {
      if (ln.includes(sep)) {
        const p = ln.split(sep);
        if (p.length === 2) {
          const r = tryPair(p[0], p[1]);
          if (r) return r;
        }
      }
    }
    // 6. 空白 · 唯需一段为合法 email · 另一段为非空非 email 即认
    const ws = ln.match(/^(\S+)\s+(\S.*?)\s*$/);
    if (ws) {
      const r = tryPair(ws[1], ws[2]);
      if (r) return r;
    }
    // 7. 邮箱锚定通吃法 · 一劳永逸终极兜底 · 凡上述分隔符皆失效时仍可解
    //    原理: 邮箱是唯一有确定结构的字段，密码=行内去除邮箱+标签+噪声后的一切剩余
    //    覆盖: 未知分隔符·未来格式·任意语言注释混入·永不失效
    const _eae = _emailAnchorExtract(ln);
    if (_eae) return _eae;
    return null;
  }

  // 词法 · 把每一行归类为 email | pass | pair | token
  const items = [];
  for (const raw of content.split(/\r?\n/)) {
    let ln = raw.trim();
    if (!ln || ln.startsWith("#") || ln.startsWith("//")) continue;

    // 0a. 剥行尾微信提示 ((无任何空格)/(去掉点)/中段"账号管理器:URL")
    //     弱者道之用 · 不整行弃 · 留真主之身
    ln = _stripWxHints(ln);
    if (!ln) continue;

    // 0b. 噪声行 · 静默跳过 (微信广告模板/订单/账号管理器整行等)
    if (_isNoiseLine(ln)) continue;

    // 0b. 整行就是 token
    if (looksLikeToken(ln)) {
      items.push({ type: "token", raw: ln });
      continue;
    }

    // 1. JSON 单行
    if (ln.startsWith("{") && ln.endsWith("}")) {
      try {
        const j = JSON.parse(ln);
        const e =
          j.email || j.username || j.account || j.user || j.mail || j.login;
        const p = j.password || j.pass || j.pwd || j.passwd || j.secret;
        if (e && p && _isValidEmail(String(e).trim())) {
          items.push({
            type: "pair",
            email: String(e).trim(),
            password: String(p).trim(),
          });
          continue;
        }
        const tk =
          j.token ||
          j.sessionToken ||
          j.session_token ||
          j.authToken ||
          j.access_token;
        if (tk) {
          items.push({ type: "token", raw: String(tk).trim() });
          continue;
        }
      } catch {}
    }

    // 2. 标签前缀 · 密码 · 守一不退: 标签明确即定锚 · 内容含 @ 仍为密码
    const passM = ln.match(RE_LABEL_PASS);
    if (passM) {
      // v3.0.4+ · 双标签同行优先 (密码：pass----邮箱：email 逆序形 · 水无常形)
      const _dlrP = _parseDualLabelLine(ln);
      if (_dlrP) {
        items.push({
          type: "pair",
          email: _dlrP.email,
          password: _dlrP.password,
        });
        continue;
      }
      const v = _stripPassTrail(ln.substring(passM[0].length).trim());
      if (v) {
        // 标签即锚 · 不再以 含@ 排除 (修病二: uuCO4@7hukcO 不再误判)
        if (looksLikeToken(v)) items.push({ type: "token", raw: v });
        else items.push({ type: "pass", password: v });
        continue;
      }
      // v 为空 · 罕 · 跳过即可
      continue;
    }

    // 3. 标签前缀 · 邮箱 · 守一: 必须 isValidEmail 才认 (修病四: '账号管理器:URL' 不再误伤)
    const emailM = ln.match(RE_LABEL_EMAIL);
    if (emailM) {
      // v3.0.4+ · 双标签同行优先 (邮箱：email----密码：pass · 水无常形)
      const _dlrE = _parseDualLabelLine(ln);
      if (_dlrE) {
        items.push({
          type: "pair",
          email: _dlrE.email,
          password: _dlrE.password,
        });
        continue;
      }
      const v = ln.substring(emailM[0].length).trim();
      if (_isValidEmail(v)) {
        items.push({ type: "email", email: v });
        continue;
      }
      // 非合法 email · 可能是 "账号: foo@bar.com password" 之同行带密码
      // 剥前缀后让 parseSingleLine 处理
      ln = v || ln;
    }

    // 4. 组合行 (各种分隔符)
    const pair = parseSingleLine(ln);
    if (pair) {
      items.push({
        type: "pair",
        email: pair.email,
        password: pair.password,
      });
      continue;
    }

    // 5. 兜底: 整行就是合法邮箱 (待与下一行密码配对)
    if (_isValidEmail(ln)) {
      items.push({ type: "email", email: ln });
      continue;
    }

    // 6. 仍然像 token (放宽阈值 40+)
    if (
      ln.length >= 40 &&
      /^[A-Za-z0-9_\-\.\$\/+=]+$/.test(ln) &&
      !ln.includes("@")
    ) {
      items.push({ type: "token", raw: ln });
      continue;
    }
    // 不可识别 · 静默跳过
  }

  // 序列配对 · 双向 · 顺逆皆通
  let pendingEmail = null;
  let pendingPass = null;
  for (const it of items) {
    if (it.type === "pair") {
      if (it.email && it.password && _isValidEmail(it.email))
        accounts.push({ email: it.email, password: it.password });
      pendingEmail = null;
      pendingPass = null;
    } else if (it.type === "email") {
      if (pendingPass) {
        // 反序: 先 pass 后 email
        accounts.push({ email: it.email, password: pendingPass });
        pendingPass = null;
        pendingEmail = null;
      } else {
        // 已有 pendingEmail 而无 pass · 新 email 覆盖 (前者孤立 · 弃)
        pendingEmail = it.email;
      }
    } else if (it.type === "pass") {
      if (pendingEmail) {
        accounts.push({ email: pendingEmail, password: it.password });
        pendingEmail = null;
      } else {
        // 反序: pass 在前 · 缓存等下一 email
        pendingPass = it.password;
      }
    } else if (it.type === "token") {
      tokens.push(it.raw);
    }
  }

  return { accounts, tokens };
}
function loadAccountsFromFs() {
  const cfgPath = _cfg("accountsFile", "");
  const cands = [
    cfgPath,
    ACCOUNTS_DEFAULT_MD,
    path.join(WAM_DIR, "accounts.md"),
    path.join(WAM_DIR, "accounts-backup.json"),
  ].filter(Boolean);
  for (const p of cands) {
    try {
      if (!fs.existsSync(p)) continue;
      let accs;
      if (p.endsWith(".json")) {
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        const arr = Array.isArray(j) ? j : j.accounts || [];
        accs = arr
          .filter((a) => a && a.email && a.password)
          .map((a) => ({ email: a.email, password: a.password }));
      } else {
        const parsed = parseAccountText(fs.readFileSync(p, "utf8"));
        accs = parsed.accounts;
      }
      if (accs && accs.length) return { source: p, accounts: accs };
    } catch (e) {
      log("loadAccountsFromFs " + p + ": " + e.message);
    }
  }
  return { source: null, accounts: [] };
}

// ═══ § 2 · 万物之母 (Store) ═══
class Store {
  constructor() {
    this.accountsSource = null;
    this.accounts = [];
    this.health = {};
    this.blacklist = {};
    // v2.3.0 使用中🔒 · email-lowercase → timestamp(ms) · 瞬态·不持久化 (重启即清 符合无为)
    this.inUseUntil = {};
    this.activeIdx = -1;
    this.activeEmail = null;
    this.activeTokenShort = null;
    this.activeApiKey = null;
    this.activeApiServerUrl = null;
    this.lastInjectPath = null;
    this.lastRotateAt = 0;
    this.switches = 0;
    this.changesDetected = 0;
  }
  load() {
    try {
      // v3.7.2 · 断电备份恢复链 · 主文件缺/损时自动降级最近日备份 · 用户无感
      let j = null;
      let _loadSrc = "STATE_FILE";
      if (!fs.existsSync(STATE_FILE)) {
        log("store.load: STATE_FILE 不存在 · 尝试备份恢复");
      } else {
        try {
          j = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        } catch (pe) {
          log(
            "store.load: JSON解析失败 · 断电腐化? · 降级备份 · " + pe.message,
          );
        }
      }
      // v3.7.2 · 备份恢复: 主文件缺/损时遍历日备份 · 取最新可用
      if (!j) {
        try {
          if (fs.existsSync(BACKUP_DIR)) {
            const _bfs = fs
              .readdirSync(BACKUP_DIR)
              .filter((f) => f.startsWith("wam-state-") && f.endsWith(".json"))
              .sort()
              .reverse(); // YYYY-MM-DD 字典序=时间序 · 最新在前
            for (const _bf of _bfs) {
              try {
                const _bj = JSON.parse(
                  fs.readFileSync(path.join(BACKUP_DIR, _bf), "utf8"),
                );
                if (_bj && _bj.health && Object.keys(_bj.health).length > 0) {
                  j = _bj;
                  _loadSrc = _bf;
                  log(
                    "store.load: 🔄 断电备份恢复 · " +
                      _bf +
                      " · health=" +
                      Object.keys(_bj.health).length +
                      " 号",
                  );
                  break;
                }
              } catch (_be) {
                /* skip corrupted backup */
              }
            }
          }
        } catch (_bd) {
          log("store.load: backup dir err: " + _bd.message);
        }
      }
      if (!j) return false;
      if (_loadSrc !== "STATE_FILE")
        log(
          "store.load: ⚠️ 主文件失效 · 备份恢复成功 · src=" +
            _loadSrc +
            " · 建议重新验证全部账号",
        );
      if (j.health) this.health = j.health;
      if (j.blacklist) this.blacklist = j.blacklist;
      if (typeof j.switches === "number") this.switches = j.switches;
      if (typeof j.changesDetected === "number")
        this.changesDetected = j.changesDetected;
      if (typeof j.activeEmail === "string") this.activeEmail = j.activeEmail;
      if (typeof j.lastInjectPath === "string")
        this.lastInjectPath = j.lastInjectPath;
      // v2.1.2 · 大制不割 · 持久化活跃会话状态 (重启不失自动切号能力)
      if (typeof j.activeApiKey === "string")
        this.activeApiKey = j.activeApiKey;
      if (typeof j.activeTokenShort === "string")
        this.activeTokenShort = j.activeTokenShort;
      if (typeof j.activeApiServerUrl === "string")
        this.activeApiServerUrl = j.activeApiServerUrl;
      if (typeof j.lastRotateAt === "number")
        this.lastRotateAt = j.lastRotateAt;
      // v2.7.4 (补入v3.0.2) · 优先读独立 lock-state.json (multi-window race-safe)
      //   兼容: lock-state.json 不存在时 fallback 旧 accountMeta + 一次性 migrate
      const diskLocks = _readLockState();
      const hasLockFile = fs.existsSync(LOCK_FILE);
      if (hasLockFile) {
        this._savedAccountMeta = diskLocks;
        log(
          "store.load · lock-state.json 真本源 · " +
            Object.keys(diskLocks).length +
            " 个🔒",
        );
      } else if (j.accountMeta && typeof j.accountMeta === "object") {
        this._savedAccountMeta = j.accountMeta;
        try {
          atomicWrite(
            LOCK_FILE,
            JSON.stringify(
              {
                version: VERSION,
                savedAt: Date.now(),
                locks: j.accountMeta,
                _migratedFrom: "wam-state.json.accountMeta",
              },
              null,
              2,
            ),
          );
          log(
            "store.load · migrate accountMeta → lock-state.json · " +
              Object.keys(j.accountMeta).length +
              " 个🔒 (一次性)",
          );
        } catch (me) {
          log("store.load · migrate lock fail: " + me.message);
        }
      } else {
        this._savedAccountMeta = {};
      }
      // v2.4.0 · D=W 污染清洗 + 陈年数据标记 · 反者道之动
      const cleanReport = this._cleanseHealthOnLoad();
      log(
        "store.load ok · health=" +
          Object.keys(this.health).length +
          " · meta=" +
          (this._savedAccountMeta
            ? Object.keys(this._savedAccountMeta).length
            : 0) +
          " · activeApiKey=" +
          (this.activeApiKey ? "✓" : "✗") +
          (cleanReport.dwPolluted > 0
            ? " · 洗 D=W 污染 " + cleanReport.dwPolluted + " 个"
            : "") +
          (cleanReport.trialNoPlanEnd > 0
            ? " · 洗 Trial-planEnd=0 脏数据 " +
              cleanReport.trialNoPlanEnd +
              " 个"
            : "") +
          (cleanReport.staleCount > 0
            ? " · stale " +
              cleanReport.staleCount +
              "/" +
              Object.keys(this.health).length
            : ""),
      );
      return true;
    } catch (e) {
      log("store.load fail: " + e.message);
      return false;
    }
  }
  // v3.0 · 启动健康清洗废止 · 无为而无不为
  // 背景: 旧版曾在加载时清 D=W 污染与 Trial+planEnd=0 脏数据。
  // 新法: 只返回空报告；不再主动覆写 checked/daily/weekly/planEnd 等历史字段。
  // stale 只由 getHealth 派生 isStale，顶部/UI 提示即可。
  _cleanseHealthOnLoad() {
    // v3.0 · 无为 · 完全废止一切清洗操作 · 保留全部历史数据不动
    //   旧法之患:
    //     · D=W 污染清洗: 误标 checked=false → 冤杀正常号
    //     · Trial+planEnd=0 清洗: 误标 checked=false → GetUserStatus 400 时全军覆没
    //   新法: 直接返回空报告 · 绝不修改任何字段
    return { dwPolluted: 0, staleCount: 0, trialNoPlanEnd: 0 };
  }
  // v2.4.0 · 手动清空全部 health · 用户重置·从干净开始
  clearAllHealth() {
    const n = Object.keys(this.health).length;
    this.health = {};
    this.save();
    return n;
  }
  // v2.4.4 · 反者道之动 · orphan health 清洗 (accounts 已无 + 陈旧)
  //   道: 多闻数穷 · 不若守于中 · 残留 health 污染 UI 统计 + 占空间
  //   法: 只清 accounts 不存在 且 >24h 陈旧 的 health (保当下账号库外新加未刷号)
  pruneOrphanHealth() {
    if (!this.accounts || this.accounts.length === 0) return 0;
    const emails = new Set(this.accounts.map((a) => a.email.toLowerCase()));
    const now = Date.now();
    const ORPHAN_AGE_MS = 24 * 3600 * 1000;
    let removed = 0;
    for (const k of Object.keys(this.health)) {
      if (emails.has(k)) continue; // 活号 · 不动
      const h = this.health[k];
      const age = now - (h.lastChecked || 0);
      if (age < ORPHAN_AGE_MS) continue; // 新 orphan · 可能刚删暂保
      delete this.health[k];
      removed++;
    }
    if (removed > 0) {
      log("pruneOrphanHealth: " + removed + " 个陈旧 orphan 号清洗");
      this.save();
    }
    return removed;
  }
  save() {
    try {
      // v2.7.4 (补入v3.0.2) · 道恒无名·守一 · accountMeta 从 LOCK_FILE 真本源读 (non-raceable)
      //   v2.7.3 关键修: this._savedAccountMeta 同步 → reloadAccounts 不再回退锁状态
      //   v2.7.4 升级: 不再从 accounts 重算 (race-immune) · 读 LOCK_FILE 权威源
      const accountMeta = _readLockState(); // 真本源·非从 accounts 重算
      this._savedAccountMeta = accountMeta; // 守一·与盘同步 (v2.7.3 治🔒回退关键一行)
      const data = {
        version: VERSION,
        savedAt: Date.now(),
        health: this.health,
        blacklist: this.blacklist,
        switches: this.switches,
        changesDetected: this.changesDetected,
        activeEmail: this.activeEmail,
        lastInjectPath: this.lastInjectPath,
        // v2.1.2 · 大制不割 · 持久化活跃会话 + 锁号
        activeApiKey: this.activeApiKey || null,
        activeTokenShort: this.activeTokenShort || null,
        activeApiServerUrl: this.activeApiServerUrl || null,
        lastRotateAt: this.lastRotateAt || 0,
        accountMeta: accountMeta,
      };
      atomicWrite(STATE_FILE, JSON.stringify(data, null, 2));
      this._rotateBackups();
    } catch (e) {
      log("store.save fail: " + e.message);
    }
  }
  _rotateBackups() {
    try {
      ensureDir(BACKUP_DIR);
      const today = new Date().toISOString().substring(0, 10);
      const tf = path.join(BACKUP_DIR, "wam-state-" + today + ".json");
      if (!fs.existsSync(tf) && fs.existsSync(STATE_FILE))
        fs.copyFileSync(STATE_FILE, tf);
      const files = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith("wam-state-") && f.endsWith(".json"))
        .map((f) => ({
          name: f,
          full: path.join(BACKUP_DIR, f),
          stat: fs.statSync(path.join(BACKUP_DIR, f)),
        }))
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
      const max = Math.max(3, MAX_BACKUPS);
      for (let i = max; i < files.length; i++) {
        try {
          fs.unlinkSync(files[i].full);
        } catch {}
      }
    } catch (e) {
      log("rotateBackups: " + e.message);
    }
  }
  reloadAccounts() {
    const r = loadAccountsFromFs();
    this.accountsSource = r.source;
    this.accounts = r.accounts;
    // v2.7.4 (补入v3.0.2) · 实时读 lock-state.json (盘上真本源 · multi-window race-safe)
    //   旧法 (v2.1.2): 用 this._savedAccountMeta 内存快照 · 多窗口下被覆盖
    //   新法: 每次 reloadAccounts 都重读盘 · 反映其他窗口 toggleSkip 的最新意图
    //   降级 (lock-state.json 读失败): 继续用 _savedAccountMeta (load 时已 fallback)
    const diskLocks = _readLockState();
    const locks =
      Object.keys(diskLocks).length > 0
        ? diskLocks
        : this._savedAccountMeta || {};
    this._savedAccountMeta = locks; // 刷新内存快照·与盘上一致
    let restored = 0;
    for (const a of this.accounts) {
      const meta = locks[a.email.toLowerCase()];
      if (meta && meta.skipAutoSwitch) {
        a.skipAutoSwitch = true;
        restored++;
      }
    }
    if (restored > 0) log("reloadAccounts: 恢复 🔒 锁号 " + restored + " 个");
    if (this.activeEmail) {
      const idx = this.accounts.findIndex(
        (a) => a.email.toLowerCase() === this.activeEmail.toLowerCase(),
      );
      this.activeIdx = idx;
      // v2.1.2 · 启动恢复鲁棒性 · activeEmail 找不到 → 清状态以触发 rotateNext
      if (idx < 0) {
        log(
          "reloadAccounts: activeEmail '" +
            this.activeEmail +
            "' 不在 accounts 中 → 清状态 (将触发自动 rotate)",
        );
        this.activeEmail = null;
        this.activeApiKey = null;
        this.activeTokenShort = null;
        this.activeApiServerUrl = null;
      }
    } else {
      this.activeIdx = -1;
    }
    return r;
  }
  addBatch(text) {
    const parsed = parseAccountText(text);
    const newOnes = parsed.accounts;
    const tokens = parsed.tokens || [];
    let added = 0,
      duplicate = 0;
    const addedEmails = []; // v2.4.3 · 返新加 email 给 webview handler 即时 verify
    for (const a of newOnes) {
      const exists = this.accounts.find(
        (x) => x.email.toLowerCase() === a.email.toLowerCase(),
      );
      if (exists) {
        duplicate++;
        continue;
      }
      this.accounts.push({
        email: a.email,
        password: a.password,
        addedAt: Date.now(),
      });
      addedEmails.push(a.email);
      added++;
    }
    if (added > 0) this._persistAccountsToMd();
    return { added, duplicate, tokens, addedEmails };
  }
  remove(idx) {
    if (idx < 0 || idx >= this.accounts.length) return false;
    const r = this.accounts.splice(idx, 1)[0];
    if (r) {
      delete this.health[r.email.toLowerCase()];
      delete this.blacklist[r.email.toLowerCase()];
      delete this.inUseUntil[r.email.toLowerCase()]; // v2.3.0
      this._persistAccountsToMd();
      if (this.activeEmail === r.email) {
        this.activeIdx = -1;
        this.activeEmail = null;
      } else if (this.activeIdx > idx) this.activeIdx--;
      this.save();
    }
    return true;
  }
  // v2.1.2 · 大制不割 · 单次 IO + 错误反馈 (从 N 次写盘 → 1 次)
  removeBatch(indices) {
    const sorted = [
      ...new Set((indices || []).map(Number).filter(Number.isInteger)),
    ].sort((a, b) => b - a);
    let n = 0;
    let activeRemoved = false;
    const removedEmails = [];
    for (const i of sorted) {
      if (i < 0 || i >= this.accounts.length) continue;
      const r = this.accounts.splice(i, 1)[0];
      if (!r) continue;
      removedEmails.push(r.email);
      delete this.health[r.email.toLowerCase()];
      delete this.blacklist[r.email.toLowerCase()];
      delete this.inUseUntil[r.email.toLowerCase()]; // v2.3.0
      if (this.activeEmail === r.email) {
        this.activeIdx = -1;
        this.activeEmail = null;
        activeRemoved = true;
      } else if (this.activeIdx > i) this.activeIdx--;
      n++;
    }
    let persistOk = true;
    if (n > 0) {
      persistOk = this._persistAccountsToMd();
      this.save();
      log(
        "removeBatch: 删除 " +
          n +
          " 个 · persistOk=" +
          persistOk +
          (activeRemoved ? " · activeRemoved" : ""),
      );
    }
    return { count: n, persistOk, activeRemoved };
  }
  _persistAccountsToMd() {
    let target = this.accountsSource;
    if (!target || !target.endsWith(".md"))
      target = path.join(WAM_DIR, "accounts.md");
    try {
      const lines = this.accounts.map((a) => a.email + " " + a.password);
      atomicWrite(target, lines.join("\n") + "\n");
      log("persistAccountsToMd: " + this.accounts.length + " → " + target);
      return true;
    } catch (e) {
      log("persistAccountsToMd FAIL: " + e.message + " → " + target);
      return false;
    }
  }
  setHealth(email, h) {
    const k = email.toLowerCase();
    const prev = this.health[k] || {};
    const merged = Object.assign({}, prev, h, {
      lastChecked: Date.now(),
      hasSnap: true,
      checked: true,
    });
    // v2.4.4 · 反者道之动 · 0 值不覆盖 prev 非 0 (弱者道之用 · 守柔处下)
    //   bug: 老 ext host 进程跑旧 parsePlan 返 planEnd=0 · 覆盖 prev 的好值
    //   实证: state.json 78 号 fresh lastChecked 但 planEnd=0 · ancient 12 号保留好值
    //   道: 新值若为 falsy 0 而 prev 有真值 → 保留 prev (不让坏值污良值)
    const preserveIfZero = [
      "planEnd",
      "planStart",
      "daysLeft",
      "dailyResetAt",
      "weeklyResetAt",
      "promptCredits",
      "flowCredits",
      "promptMonth",
    ];
    for (const key of preserveIfZero) {
      if (
        (merged[key] === 0 || merged[key] == null) &&
        prev[key] &&
        prev[key] > 0
      ) {
        merged[key] = prev[key];
      }
    }
    // daysLeft 若 planEnd 被保留需要重算
    if (merged.planEnd > 0) {
      merged.planEnd = _parseTimeMs(merged.planEnd);
      merged.daysLeft = _calcDaysLeft(merged.planEnd);
    }
    this.health[k] = merged;
    if (
      typeof prev.daily === "number" &&
      typeof h.daily === "number" &&
      Math.abs(prev.daily - h.daily) > 0.01
    )
      this.changesDetected++;
    this.save();
  }
  getHealth(email) {
    const k = (email || "").toLowerCase();
    const h = this.health[k];
    if (!h)
      return {
        checked: false,
        daily: 0,
        weekly: 0,
        plan: "",
        planEnd: 0,
        daysLeft: 0,
        lastChecked: 0,
        hasSnap: false,
        staleMin: -1,
        staleHours: -1,
        isStale: false,
      };
    // v2.4.0 · staleHours 计算 + isStale 标志 · UI 据此变灰 · 不骗人
    const now = Date.now();
    const staleMs = h.lastChecked ? now - h.lastChecked : -1;
    const staleMin = staleMs >= 0 ? Math.round(staleMs / 60000) : -1;
    const staleHours = staleMs >= 0 ? Math.round(staleMs / 3600000) : -1;
    const planEnd = _parseTimeMs(h.planEnd);
    const daysLeft =
      planEnd > 0 ? _calcDaysLeft(planEnd, now) : Number(h.daysLeft) || 0;
    return Object.assign({}, h, {
      planEnd,
      daysLeft,
      staleMin,
      staleHours,
      // v2.4.0 · ≥ 12 小时 = stale (UI 变灰 · 不骗人 · 与 load cleanse 一致)
      //   endpoint 挂时所有号都 stale · 顶部红条告 · 单行不再重复
      isStale: staleHours >= 12,
    });
  }
  // v2.5.0 · 不禁号 · 「天之道 损有余而益不足」· 失败仅记数 · 号永远可选
  //   旧法之患: 3 失败 → 15min 黑 · 网络抖动冤杀可用号
  //   新法: 只累计 count · 永不写 until · 一律返 isBanned=false
  //   历史 until 自动清 (向后兼容老 state.json)
  banFor(email, ms, reason) {
    const k = email.toLowerCase();
    const cur = this.blacklist[k] || { count: 0 };
    // 不禁 · 只记 count 和 reason · 不写 until
    this.blacklist[k] = {
      reason: reason || "?",
      count: (cur.count || 0) + 1,
      lastFailAt: Date.now(),
    };
    log(
      "failure#" +
        this.blacklist[k].count +
        " " +
        email.split("@")[0] +
        " · " +
        reason +
        " (v2.5 不禁号 · 号仍可选)",
    );
    this.save();
  }
  isBanned(email) {
    const k = email.toLowerCase();
    const b = this.blacklist[k];
    if (!b) return false;
    // v2.5.0 · 向后兼容: 历史 until 存在 · 自动清
    if (b.until) {
      delete b.until;
      this.save();
    }
    return false; // 永远不禁
  }
  clearBlacklist() {
    const n = Object.keys(this.blacklist).length;
    this.blacklist = {};
    this.save();
    return n;
  }
  // ── v2.3.0 使用中🔒 (反者道之动 · 瞬态锁 · 不入 wam-state.json) ──
  // 切号成功即锁 · 锁期内自动切号不入选 · 手动切号不受影响 · 重启即清
  markInUse(email, ms) {
    if (!email || !(ms > 0)) return;
    const k = email.toLowerCase();
    this.inUseUntil[k] = Date.now() + (ms | 0);
    // 不 save · 瞬态状态不入磁化
  }
  isInUse(email) {
    if (!email) return false;
    const k = email.toLowerCase();
    const until = this.inUseUntil[k];
    if (!until) return false;
    if (Date.now() >= until) {
      delete this.inUseUntil[k];
      return false;
    }
    return true;
  }
  inUseRemainingMs(email) {
    if (!email) return 0;
    const k = email.toLowerCase();
    const until = this.inUseUntil[k];
    if (!until) return 0;
    return Math.max(0, until - Date.now());
  }
  clearInUse(email) {
    if (!email) return;
    delete this.inUseUntil[email.toLowerCase()];
  }
  clearAllInUse() {
    const n = Object.keys(this.inUseUntil).length;
    this.inUseUntil = {};
    return n;
  }
  // ── v3.3.0 道法自然 · 绝对分层 · 存量先于流量 · 各得其所 ──────────────
  //   §解构本源:
  //     · overage  = Stock(存量)  · 真金白银 · 不可再生 · 不用即损沉没
  //     · 百分比   = Flow (流量)  · 周期重置 · 自然回潮 · 等待无损
  //   §治法 (反者道之动 · 九竅之邪在乎三要 · 可以動靜):
  //     第三层 💎 overage 池     [1_000_000, 1_099_950]  内排按美元数 (v3.3.0·不变)
  //     第二层 📊 百分比池       [1, 999_999]             v3.3.1 · 内含临期主导加成
  //     候补层 ⏳ 未验号           100                       与 v3.0 一致 · 不夺主权
  //     -∞   永禁                 无密码 / 用户主动锁 / planEnd已过期(v3.3.1)
  //   §v3.3.1 临期微调 (最小不侵入·反者道之动·不用即废先消耗):
  //     · 百分比层末加 expBonus = max(0,(60-daysLeft)) × 2000
  //     · 1日差 = 2000 分 > quota 最大差 ~1880 → 临期维度主导·额度次排
  //     · daysLeft≥60 或 planEnd=0(永久): bonus=0 · 回退 v3.3.0 行为
  //     · 封顶 9_999→999_999 (容纳 max bonus 120_000 · 仍远低于第三层 1_000_000)
  //   §门控: wam.preferOverageFirst (默认 true) · wam.expiryFirst (默认 true·v3.3.1)
  _scoreOf(idx) {
    const a = this.accounts[idx];
    if (!a || !a.password) return -Infinity; // 无密码真无法登录
    if (a.skipAutoSwitch) return -Infinity; // 用户主动锁 · 尊重意愿
    // v3.7.0 「二」锁止复元: isInUse 降分 × 0.01 (非 -∞ · 可兜底)
    const _inUse = this.isInUse(a.email);
    const _applyInUse = (s) => (_inUse ? Math.max(1, Math.round(s * 0.01)) : s);
    const h = this.getHealth(a.email);
    if (!h.checked) return _inUse ? 1 : 100; // 未验号中等分 · 锁中降至1分
    // v3.7.0 「一」三维度: credits 加成 (独立于 quota%)
    const _creditsOk = _hasUsableCredits(h);
    const _creditsInScore =
      typeof _cfg === "function" ? !!_cfg("creditsInScore", true) : true;
    const creditsBonus =
      _creditsOk && _creditsInScore
        ? Math.min(500, ((h.promptCredits || 0) + (h.flowCredits || 0)) / 100)
        : 0;
    // isClaudeAvailable 永远 true · 不会 -Infinity
    const hrsToDaily = hoursUntilDailyReset();
    const hrsToWeekly = hoursUntilWeeklyReset();
    const drought = isWeeklyDrought();
    const preferOverageFirst =
      typeof _cfg === "function" ? !!_cfg("preferOverageFirst", true) : true;

    // ═══ 第三层 · 💎 OVERAGE 池 (绝对优先 · 道法自然 · 存量先用防废账) ═══
    //   触发: overageActive=true · GetUserStatus 返 overageBalanceMicros > 0
    //   主权: 1_000_000 基础分 · 永远凌驾于百分比层 9_999 上限
    //   内排: overageDollars × 100 → $1=+100 / $100=+10_000 / $200=+20_000 (全幅可比·主公图1中 $208>$195>$193>$189>$185 顺序天然保留)
    //   时效: 仅 ±50 分微调 · 不夺金额主权
    if (h.overageActive && preferOverageFirst) {
      let s = 1000000;
      s += Math.min(99900, Math.round((h.overageDollars || 0) * 100));
      if (h.staleMin >= 0 && h.staleMin < 15) s += 50;
      else if (h.staleMin >= 0 && h.staleMin < 60) s += 20;
      else if (h.staleMin >= 60 && h.staleMin < 360) s -= 10;
      else if (h.staleMin >= 360) s -= 30;
      return _applyInUse(s); // 区间 [999_970, 1_099_950]
    }
    // 旧 overage 逻辑 (preferOverageFirst=false · 兼容回退 · 与 v3.2.1 一致)
    if (h.overageActive) {
      let s = 300 + Math.min(100, h.overageDollars || 0);
      if (h.staleMin >= 0 && h.staleMin < 15) s += 60;
      else if (h.staleMin >= 0 && h.staleMin < 60) s += 30;
      else if (h.staleMin >= 60 && h.staleMin < 120) s -= 30;
      else if (h.staleMin >= 120 && h.staleMin < 360) s -= 80;
      else if (h.staleMin >= 360) s -= 150;
      return _applyInUse(s);
    }

    // ═══ 过期排除 (v3.3.1 · planEnd 已过 → 号失效 → -∞ 不浪费切号) ═══
    if (h.planEnd > 0 && h.planEnd < Date.now()) return -Infinity;
    // ═══ 临期主导加成 (v3.3.1 · 反者道之动 · 不用即废先消耗) ═══
    //   (60 - daysLeft) × 2000 · 1日差=2000 > quota 最大差 ~1880 → 临期主导
    //   daysLeft≥60 或 planEnd=0(永久/Pro): bonus=0 · 与 v3.3.0 同
    //   daysLeft=2 (截图红): bonus=116_000 · daysLeft=0(<12h): bonus=120_000
    const expiryFirst =
      typeof _cfg === "function" ? !!_cfg("expiryFirst", true) : true;
    const expBonus =
      expiryFirst && h.planEnd > 0 ? Math.max(0, (60 - h.daysLeft) * 2000) : 0;

    // ═══ 第二层 · 📊 百分比池 (v3.4.1 · 临期主导 + 额度次排 · 唯变所适) ═══
    //   v3.4.1 核心变更: effQ<threshold 且 daysLeft<7 且 effQ>0 → 仍加 expBonus
    //   根因: v3.3.1 对 effQ<threshold 不加 → 临期耗尽号永远不被选中 → 不可逆损失
    //   道: 「天下莫柔弱于水·而攻坚强者莫之能胜也·以其无以易之也」
    const effQ = Math.min(Math.max(h.daily, 0), Math.max(h.weekly, 0));
    const _threshold =
      typeof _cfg === "function" ? +_cfg("autoSwitchThreshold", 5) || 5 : 5;
    const _isExpiryRescue =
      expiryFirst && h.planEnd > 0 && h.daysLeft < 7 && effQ > 0;

    // v15.0 (3.11.6) · 道法自然 · 与 _isValidAutoTarget 一以贯之
    //   credits 旁路开关 (默 false · 严守 quota%)
    //   true → 老逻辑 v3.7.6 (credits 豁免双零) · 适纯 Devin agent
    //   false → 新逻辑 (Cascade premium 模式 · W=0 即清出候选池)
    const _creditsBypassScore =
      typeof _cfg === "function"
        ? !!_cfg("creditsBypassQuotaGate", false)
        : false;
    // v3.7.6 「一」真耗尽守门 — 双零+无overage = 彻底无法使用 → -Infinity
    //   v15.0 修正: credits 不再单独救场 (仅 creditsBypass=true 时兼容)
    //   知止所以不殺 · 耗尽即清·不入候选池 · 防 rotateNext 尝试登录 0% 账号
    const _droughtEffQ = drought ? Math.max(h.daily, 0) : effQ;
    if (
      _droughtEffQ === 0 &&
      !h.overageActive &&
      !(_creditsBypassScore && _creditsOk)
    )
      return -Infinity;
    // v3.8.4 · 绝对最低门槛对齐 _isValidAutoTarget: D<dailyMin 或 W≤weeklyMin(非干旱) → -Infinity
    //   v15.0 修正: credits 不再单独豁免最低门槛 (仅 creditsBypass=true 时兼容)
    //   目的: getBestIndex 不选这些号 · 与 _isValidAutoTarget 一以贯之 · 不浪费守门机会
    if (!h.overageActive && !(_creditsBypassScore && _creditsOk)) {
      const _dMin =
        typeof _cfg === "function" ? +_cfg("autoSwitchDailyMin", 5) || 5 : 5;
      const _wMin =
        typeof _cfg === "function" ? +_cfg("autoSwitchWeeklyMin", 3) || 3 : 3;
      if (h.daily < _dMin) return -Infinity;
      if (!drought && h.weekly <= _wMin) return -Infinity;
    }

    if (drought) {
      let s = Math.max(h.daily, 0) * 15;
      // v3.7.7: 道法自然 — D≤threshold 的号不给"即将重置"奖励分 (与 _isValidAutoTarget 对齐)
      //   原 h.daily<=5 bonus 使低配额号高分 → getBestIndex 选中 → _isValidAutoTarget 拒绝 → 浪费
      //   修: 仅 D > threshold 的号享受近重置加成 · D≤threshold 依然低分 · 一以贯之
      if (h.daily > _threshold && h.daily <= 20 && hrsToDaily <= 2) s += 150;
      if (h.daily > 50) s += 200;
      if (h.staleMin >= 0 && h.staleMin < 5) s += 30;
      return _applyInUse(Math.min(999999, Math.max(s + expBonus, 1)));
    }
    if (effQ < _threshold) {
      let s = effQ * 3;
      if (h.daily < _threshold && hrsToDaily <= 2) s += 20;
      if (!drought && h.weekly < _threshold && hrsToWeekly <= 2) s += 20;
      // v3.4.1 临期抢救: daysLeft<7 且 effQ>0 → 仍加 expBonus (不用即废)
      if (_isExpiryRescue)
        return _applyInUse(Math.min(999999, Math.max(s + expBonus, 1)));
      return _applyInUse(Math.max(s, 1));
    }
    // effQ >= threshold · 正常综合评分 + 临期加成
    // v3.7.7: 道法自然 — 此block中 effQ>=5, 故 daily/weekly 至少一个 >=5
    //   原 h.daily<=5 bonus 只在边界 daily=5 时触发 (因 effQ=min(d,w)>=5)
    //   移除: 边界号不应获得额外奖励 · 配额越高分越高 · 一以贯之
    let s = Math.max(h.weekly, 0) * 8 + Math.max(h.daily, 0) * 3;
    if (h.daily > 50 && h.weekly > 50) s += 200;
    if (h.staleMin >= 0 && h.staleMin < 5) s += 80;
    else if (h.staleMin >= 0 && h.staleMin < 30) s += 40;
    else if (h.staleMin < 0 || h.staleMin > 120) s -= 50;
    let finalS = Math.min(999999, Math.max(s + expBonus + creditsBonus, 1));
    // v3.7.0 「二」锁止: 锁中号得分×0.01 → 降至最低但保留兜底资格
    return _inUse ? Math.max(1, Math.round(finalS * 0.01)) : finalS;
  }
  getBestIndex(excludeIdx) {
    let best = -1,
      bestScore = -Infinity;
    for (let i = 0; i < this.accounts.length; i++) {
      if (i === excludeIdx) continue;
      const s = this._scoreOf(i);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    return best;
  }
  // 按 score 降序返回所有 idx (黑名单已排除) · rotateNext 阈值切号用
  getSortedIndices(excludeIdx) {
    const arr = [];
    for (let i = 0; i < this.accounts.length; i++) {
      if (i === excludeIdx) continue;
      const s = this._scoreOf(i);
      if (s > -Infinity) arr.push({ i, s });
    }
    arr.sort((a, b) => b.s - a.s);
    return arr.map((x) => x.i);
  }
  // ── v3.3.0 · 池层标识 · 透明性 · 让用户看见道之运行 ──
  //   💎 overage 池 (存量·绝对优先)  · 📊 百分比池 (流量·次选)
  //   ⏳ 候补 (未验·待 verify)        · 🔒 主动锁 (skipAutoSwitch)
  //   ✗ 永禁 (无密码)
  _tierOf(idx) {
    const a = this.accounts[idx];
    if (!a || !a.password) return "\u2717"; // ✗
    if (a.skipAutoSwitch) return "\uD83D\uDD12"; // 🔒
    const h = this.getHealth(a.email);
    if (!h.checked) return "\u23F3"; // ⏳
    return h.overageActive ? "\uD83D\uDC8E" : "\uD83D\uDCCA"; // 💎 / 📊
  }
  // 池层分布统计 (返 {ovg, pct, wait, lock, ban, total})
  _tierStats(excludeIdx) {
    const r = { ovg: 0, pct: 0, wait: 0, lock: 0, ban: 0, total: 0 };
    for (let i = 0; i < this.accounts.length; i++) {
      if (i === excludeIdx) continue;
      const a = this.accounts[i];
      r.total++;
      if (!a || !a.password) {
        r.ban++;
        continue;
      }
      if (a.skipAutoSwitch) {
        r.lock++;
        continue;
      }
      const h = this.getHealth(a.email);
      if (!h.checked) {
        r.wait++;
        continue;
      }
      if (h.overageActive) r.ovg++;
      else r.pct++;
    }
    return r;
  }
  getStats() {
    let totalD = 0,
      totalW = 0,
      checkedCount = 0,
      unchecked = 0,
      available = 0,
      exhausted = 0,
      overageAccounts = 0, // v2.8.4 · Extra Usage Active 账号数
      totalOverageDollars = 0, // v2.8.4 · 全池 Extra Usage 总额 (USD)
      checkedNoOverage = 0; // v2.8.5 · 已验但无 Extra Usage (仅展示用 · 不触发激活)
    for (const a of this.accounts) {
      const h = this.getHealth(a.email);
      if (!h.checked) {
        unchecked++;
        continue;
      }
      checkedCount++;
      totalD += h.daily;
      totalW += h.weekly;
      // v3.1.3 · effQuota 对齐: 有效额度<1 才算耗尽 (与 tick/scoreOf 一以贯之)
      //   正常: effQ = min(D, W) · D=0/W=50 → effQ=0 → 耗尽 (切入即触发)
      //   干旱: effQ = D · 仅看 daily
      const _isDrought =
        checkedCount > 0 && totalW / Math.max(checkedCount, 1) < 1;
      const _effQ = _isDrought ? h.daily : Math.min(h.daily, h.weekly);
      if (_effQ < 1) exhausted++;
      else available++;
      // v2.8.5 · overageActive 统计 (GetUserStatus 权威 · "Extra Usage Active")
      // overageActive = overageDollars > 0 (由 _parsePlanStatusJson 定义 · 不需双判)
      if (h.overageActive) {
        overageAccounts++;
        totalOverageDollars += h.overageDollars || 0;
      } else {
        checkedNoOverage++; // v2.8.5 · 已验 · 无 Extra Usage · 仅供展示计数
      }
    }
    const banned = Object.keys(this.blacklist).filter((k) =>
      this.isBanned(k),
    ).length;
    // v2.3.0 使用中🔒 计数 (仅未过期者)
    const inUse = Object.keys(this.inUseUntil).filter((k) =>
      this.isInUse(k),
    ).length;
    return {
      pwCount: this.accounts.length,
      checkedCount,
      unchecked,
      available,
      exhausted,
      banned,
      inUse, // v2.3.0
      totalD: Math.round(totalD),
      totalW: Math.round(totalW),
      switches: this.switches,
      changesDetected: this.changesDetected,
      hrsToDaily: hoursUntilDailyReset(),
      hrsToWeekly: hoursUntilWeeklyReset(),
      drought: checkedCount > 0 && totalW / checkedCount < 1,
      overageAccounts, // v2.8.4
      totalOverageDollars: Math.round(totalOverageDollars * 100) / 100, // v2.8.4
      checkedNoOverage, // v2.8.5 · 已验无 Extra Usage 账号数 (仅展示)
    };
  }
  setActive(idx, email, sessionToken, apiKey, apiServerUrl, injectPath) {
    // 大制不割: 仅真正换号才计数 · 同号 re-auth (启动恢复) 不虚增
    const isRealSwitch = email !== this.activeEmail || idx !== this.activeIdx;
    this.activeIdx = idx;
    this.activeEmail = email;
    this.activeTokenShort = sessionToken
      ? sessionToken.substring(0, 14) + "..."
      : null;
    this.activeApiKey = apiKey || sessionToken;
    this.activeApiServerUrl = apiServerUrl || null;
    this.lastInjectPath = injectPath || null;
    this.lastRotateAt = Date.now();
    if (isRealSwitch) {
      this.switches++;
      // v2.6.12 守一 · 真切号 → 清 W% 状态 · 防跨账号假脉动
      //   原 v2.6.11 漏: _lastQuotaWeekly 跨账号比 → 切号瞬间 ΔW% 自然>=0.3% → 假脉动 → 又切号 → 死循环
      //   新法: 切号即清 → 下轮 tick 重新建基线 (≥0 后才参与判)
      _lastQuotaWeekly = -1;
      _lastQuotaEmail = "";
      // v2.6.13 阴阳结合 · ⚖额度变动 同清 (与 W% 同步建基线)
      _lastQuotaDaily = -1;
      _lastQuotaPromptCredits = -1;
      _lastQuotaFlowCredits = -1;
    }
    // v2.3.0 使用中🔒 唯一枢纽点 · 凡 active 转换均打印 · 0=off
    // typeof 守 · 测试环境 _cfg 未注入时退默认 120000
    const lockMs = Math.max(
      0,
      typeof _cfg === "function" ? _cfg("inUseLockMs", 120000) | 0 : 120000,
    );
    if (lockMs > 0 && email) this.markInUse(email, lockMs);
    this.save();
  }
}

// ═══ § 3 · 万法之本 (Devin auth · inject · 切号主流水) ═══
async function devinLogin(email, password) {
  // v3.1.1 · 简化序列化门 · 单变量 minGap 替代 Promise chain (顺其自然·去日益)
  // v3.1.2 · 限速自感知门 (auto-backoff · 永不打死服务器·零增弊端)
  //   入口: 检查 _devinLoginRateLimitedUntil 窗口 → 命中即立返 · 零网络
  //   出口: 检测 429 / json error 含 rate/limit → 设 _devinLoginRateLimitedUntil = now + 5min
  //   配置: wam.devinLoginRateLimitWindowMs (默 300000ms · 0=关闭感知)
  //   零误伤: cache hit 切号走 injectViaBing 不调 devinLogin · 不受窗口影响
  //   仅 cache miss 切号 + 后台 verify 受窗口保护 · 5min 自动恢复
  // v3.1.2 · 限速窗口入口检查 (零网络·永不打死)
  const _rlNow = Date.now();
  if (_rlNow < _devinLoginRateLimitedUntil) {
    const remainSec = Math.ceil((_devinLoginRateLimitedUntil - _rlNow) / 1000);
    return {
      ok: false,
      error: "rate-limit-window",
      retryAfterSec: remainSec,
      status: 429,
    };
  }
  try {
    const _minGapMs = Math.max(0, +_cfg("devinLoginMinGapMs", 1200) || 1200);
    if (_minGapMs > 0) {
      const _elapsed = Date.now() - _lastDevinLoginAt;
      if (_elapsed < _minGapMs)
        await new Promise((r) => setTimeout(r, _minGapMs - _elapsed));
    }
    _lastDevinLoginAt = Date.now();
    const r = await jsonPost(
      URL_DEVIN_LOGIN,
      {
        Origin: WINDSURF,
        Referer: WINDSURF + "/account/login",
        Accept: "application/json, text/plain, */*",
      },
      { email, password },
    );
    if (r.json && r.json.token && r.json.user_id)
      return { ok: true, auth1: r.json.token, userId: r.json.user_id };
    const err =
      (r.json && (r.json.detail || r.json.error || r.json.message)) ||
      "no_token";
    // v3.1.2 · 限速感知 · 触发后开 5min 自动 backoff 窗口 (永不打死服务器)
    const _rlWinMs = Math.max(
      0,
      +_cfg("devinLoginRateLimitWindowMs", 300000) || 300000,
    );
    if (_rlWinMs > 0) {
      const _errLow = String(err || "").toLowerCase();
      const _isRateLimit =
        r.status === 429 ||
        r.status === 503 ||
        /rate.?limit|too.?many|throttl/.test(_errLow);
      if (_isRateLimit) {
        _devinLoginRateLimitedUntil = Date.now() + _rlWinMs;
        log(
          "devinLogin: 命中限速 (status=" +
            r.status +
            ") · auto-backoff " +
            Math.round(_rlWinMs / 1000) +
            "s · cache 命中切号无感",
        );
      }
    }
    return { ok: false, status: r.status, error: err };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
async function windsurfPostAuth(auth1, orgId) {
  try {
    // v2.5.1 · Windsurf 后端协议变更 (2026-05 起实证)
    //   旧法: body{auth1_token} → 401 "missing required header: X-Devin-Auth1-Token"
    //   新法: header{X-Devin-Auth1-Token} · body 可空 {} (实测 200 OK)
    //   兼容: body 内仍带 auth1_token · 后端若回滚仍认 · 不伤大雅
    const body = { auth1_token: auth1 };
    if (orgId) body.org_id = orgId;
    const r = await jsonPost(
      URL_POSTAUTH,
      {
        Origin: WINDSURF,
        Referer: WINDSURF + "/profile",
        "Connect-Protocol-Version": "1",
        "X-Devin-Auth1-Token": auth1,
      },
      body,
    );
    if (
      r.json &&
      typeof r.json.sessionToken === "string" &&
      RE_SESSION_TOKEN.test(r.json.sessionToken)
    )
      return {
        ok: true,
        sessionToken: r.json.sessionToken,
        accountId: r.json.accountId || "",
        primaryOrgId: r.json.primaryOrgId || "",
      };
    const err =
      (r.json && (r.json.error || r.json.code || r.json.message)) ||
      "no_session";
    return { ok: false, status: r.status, error: err };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
async function registerUserViaSession(sessionToken) {
  try {
    const r = await jsonPost(
      URL_REGISTER_USER,
      { "Connect-Protocol-Version": "1" },
      { firebase_id_token: sessionToken },
    );
    if (r.json && (r.json.api_key || r.json.apiKey))
      return {
        ok: true,
        apiKey: r.json.api_key || r.json.apiKey,
        name: r.json.name || "",
        apiServerUrl: r.json.api_server_url || r.json.apiServerUrl || "",
      };
    return {
      ok: false,
      status: r.status,
      error: (r.json && (r.json.code || r.json.message)) || "no_api_key",
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
// v2.4.1 · 真路径 GetUserStatus · X-Api-Key + metadata body
//   反向工程 windsurf dist/extension.js 实证的真协议 (实测 5/5 真号 200 OK)
//   第一参 apiKey: RegisterUser 返的 api_key (trial 中 == sessionToken, 向后兼容)
//   opts.apiServerUrl: 优先用 RegisterUser 动态 baseUrl (EU/自部署区)
//   opts.silent: 降噪 (verifyAll 批量不打每号 401)
async function tryFetchPlanStatus(apiKey, opts) {
  if (!apiKey) return null;
  const o = opts || {};
  const tries = [];
  if (o.apiServerUrl && typeof o.apiServerUrl === "string") {
    tries.push(
      o.apiServerUrl.replace(/\/$/, "") +
        "/exa.seat_management_pb.SeatManagementService/GetUserStatus",
    );
  }
  for (const u of URL_GET_USER_STATUS_LIST) {
    if (!tries.includes(u)) tries.push(u);
  }
  // 构建 metadata · 仿真 windsurf LSP 客户端请求体
  // v2.5.5 · 根因解 (2026-05-04 实证): 后端按 ideVersion 能力协商返回字段
  //   ideVersion="1.0.0" → 后端省略 planEnd/planStart (老客户端不懂)
  //   ideVersion="1.99.0" → 后端返 planEnd="2026-05-09T20:56:09Z" 完整结构
  //   probe 独立验证: 同账号同 API · 仅版本差异 · planEnd 字段有无之别
  //   此为 98 号 planEnd=0 脏数据的真正根因 (比 postAuth 401 更本)
  const metadata = {
    // v3.13.0 · 179实测: applicationName=devin-desktop · extensionId=codeium.windsurf
    //   ideName 跟随 IDE 品牌 (devin-desktop) · extensionName 跟随扩展ID (windsurf)
    ideName: _detectedAuthProvider === "devin" ? "devin-desktop" : "windsurf",
    ideVersion: o.ideVersion || "1.99.0",
    extensionName: "windsurf",
    extensionVersion: o.extensionVersion || "1.99.0",
    apiKey: apiKey,
    sessionId: o.sessionId || crypto.randomUUID(),
    requestId: String(o.requestId || 1),
    locale: "en",
    os: "windows",
  };
  let lastReason = "";
  for (const url of tries) {
    _quotaEndpointHealth.totalCalls++;
    try {
      const r = await jsonPost(
        url,
        {
          "Connect-Protocol-Version": "1",
          "X-Api-Key": apiKey, // ★ 真 auth 走 Header
        },
        { metadata: metadata }, // ★ body 嵌套 metadata
        8000,
      );
      if (r.status >= 200 && r.status < 300 && r.json) {
        _quotaEndpointHealth.consecutive401 = 0;
        _quotaEndpointHealth.consecutiveOk++;
        _quotaEndpointHealth.lastSuccess = Date.now();
        _quotaEndpointHealth.totalOk++;
        _quotaEndpointHealth.lastOkUrl = url;
        return _parsePlanStatusJson(r.json);
      }
      _quotaEndpointHealth.totalFail++;
      lastReason = "status=" + r.status;
      // v3.0 · 400 也是服务端故障信号 · 不只 401
      if (r.status >= 400) _quotaEndpointHealth.consecutive401++;
      _quotaEndpointHealth.consecutiveOk = 0;
      if (!o.silent) {
        log(
          "userStatus " +
            url.replace("https://", "").substring(0, 36) +
            " status=" +
            r.status +
            " · body=" +
            (r.text || "").substring(0, 100),
        );
      }
      if (r.status === 401 || r.status === 400) break; // v3.0 · 400/401 均换endpoint无救
    } catch (e) {
      _quotaEndpointHealth.totalFail++;
      _quotaEndpointHealth.consecutiveOk = 0;
      lastReason = "err: " + e.message;
      if (!o.silent) log("userStatus err: " + e.message);
    }
  }
  _quotaEndpointHealth.lastFailReason = lastReason;
  return null;
}
// Devin Trial 真返回示例 (2026-04-28 实测):
//   planInfo.planName = "Trial"
//   planInfo.teamsTier = "TEAMS_TIER_DEVIN_TRIAL"
//   planStart = "2026-04-25T20:56:09Z" (ISO string)
//   planEnd = "2026-05-09T20:56:09Z" (ISO string)
//   weeklyQuotaRemainingPercent = 32   ← weekly 真值 (REMAINING, 非 USAGE)
//   availablePromptCredits = 10000     ← 独立资源池, 与 quota% 无关!
//   availableFlowCredits = 20000
//   ⚠ Devin Trial 没有 dailyQuotaRemainingPercent · daily 镜像 weekly
//
// ★★★ proto3 语义 (本源 v17.42.4 对齐 · 2026-04-28 修正) ★★★
//   - 新号满量 W100 D100 → JSON 字段 PRESENT (100 ≠ default 0, 不被 omit)
//   - 用过的 W32        → JSON 显式带字段
//   - 耗尽 W0 D0       → JSON 字段 omit (proto3: default 0 suppressed)
//   ∴ 字段缺失 = 值为 0 = 耗尽. 不用 credits 启发 (credits ≠ quota%)
//   官方 UI 显示 "usage" = 100 - remaining (0%用量=满,100%用量=耗尽)
function _parsePlanStatusJson(j) {
  // v2.4.1 · 兼容新 (GetUserStatus) + 旧 (GetPlanStatus) 两种响应结构
  //   新: j.userStatus.planStatus.{dailyQuotaRemainingPercent, availableFlexCredits, ...}
  //   旧: j.planStatus.{weeklyQuotaRemainingPercent, dailyQuotaRemainingPercent, ...}
  const userStatus = j.userStatus || j.user_status || null;
  const ps =
    (userStatus && (userStatus.planStatus || userStatus.plan_status)) ||
    j.planStatus ||
    j.plan_status ||
    j;
  const planInfo =
    ps.planInfo ||
    ps.plan_info ||
    (userStatus && (userStatus.planInfo || userStatus.plan_info)) ||
    j.planInfo ||
    {};
  // ── plan name ──
  let plan =
    planInfo.planName ||
    planInfo.plan_name ||
    planInfo.tier ||
    planInfo.teamsTier ||
    planInfo.teams_tier ||
    ps.tier ||
    "Trial";
  if (typeof plan === "string" && /^TEAMS_TIER_/i.test(plan)) {
    const raw = plan.replace(/^TEAMS_TIER_/i, "").replace(/_/g, " ");
    // 兵无常势: 完整 tier 映射 (对齐本源 v17.42.4 TEAMS_TIER enum)
    if (/DEVIN.TRIAL/i.test(raw)) plan = "Trial";
    else if (/DEVIN.PRO/i.test(raw)) plan = "Pro";
    else if (/DEVIN.MAX/i.test(raw)) plan = "Max";
    else if (/DEVIN.FREE/i.test(raw)) plan = "Free";
    else if (/DEVIN.ENTERPRISE/i.test(raw)) plan = "Enterprise";
    else if (/DEVIN.TEAMS/i.test(raw)) plan = "Teams";
    else if (/PRO.ULTIMATE/i.test(raw)) plan = "Pro Ultimate";
    else if (/TEAMS.ULTIMATE/i.test(raw)) plan = "Teams Ultimate";
    else if (/^PRO$/i.test(raw)) plan = "Pro";
    else if (/^MAX$/i.test(raw)) plan = "Max";
    else if (/^TRIAL$/i.test(raw)) plan = "Trial";
    else if (/FREE|WAITLIST/i.test(raw)) plan = "Free";
    else if (/ENTERPRISE/i.test(raw)) plan = "Enterprise";
    else plan = raw; // 未知 tier → 原样保留
  }
  // ── credits (启发推算锚点) ──
  const promptUsed = Number(ps.usedPromptCredits || ps.promptUsed || 0);
  const promptAvail = Number(
    ps.availablePromptCredits || ps.promptAvailable || 0,
  );
  const promptMonth = Number(
    planInfo.monthlyPromptCredits || planInfo.monthly_prompt_credits || 0,
  );
  const flowUsed = Number(ps.usedFlowCredits || ps.flowUsed || 0);
  const flowAvail = Number(ps.availableFlowCredits || ps.flowAvailable || 0);
  const flowMonth = Number(
    planInfo.monthlyFlowCredits || planInfo.monthly_flow_credits || 0,
  );
  // ── weekly% 解析: 多字段名 · 兵无常势 · 唯变所适 ──
  // 核心语义: API 返回 REMAINING 百分比 (0=耗尽 100=满)
  //   官方 UI 显示 USAGE = 100 - remaining
  //   proto field 15 = weekly_quota_remaining_percent (本源 v17.42.4 逆向)
  let weeklyPct = null;
  if (ps.weeklyQuotaRemainingPercent != null)
    weeklyPct = Number(ps.weeklyQuotaRemainingPercent);
  else if (ps.weeklyPercentRemaining != null)
    weeklyPct = Number(ps.weeklyPercentRemaining);
  else if (ps.weekly_percent_remaining != null)
    weeklyPct = Number(ps.weekly_percent_remaining);
  else if (ps.weeklyQuotaUsagePercent != null)
    weeklyPct = 100 - Number(ps.weeklyQuotaUsagePercent);
  else if (ps.weeklyPercentUsed != null)
    weeklyPct = 100 - Number(ps.weeklyPercentUsed);
  else if (ps.weekly_percent_used != null)
    weeklyPct = 100 - Number(ps.weekly_percent_used);
  // v2.4.2 · 反者道之动 · 实证 (7 号真打 2026-05-03 14:47):
  //   availableFlexCredits 是独立 flex credits 资源池, 非 weekly% 的 proxy!
  //   实证:
  //     · vani.dosahe.ine.r2.31: daily=38 weekly<omit> flex<omit> 官方 UI W usage 100%
  //     · santiagitocadrera+gdxyrv: daily=47 weekly<omit> flex<omit> 官方 W usage 100%
  //     · walterr.ices394: daily=36 weekly=68 flex<omit>  ← weekly 有值时不 omit
  //   ∴ weekly omit == 0% · 走下方 weeklyResetAt 哨兵即可, 绝不用 flex 兜底
  //   历史: v2.4.1 错用 flex 兜底 → 耗尽号假显 W100 (因 flex 默认 100, 未用) + W=flex 假镜
  // ── daily% 解析 (Devin Trial 一般 omit · 镜像 weekly) ──
  let dailyPct = null;
  if (ps.dailyQuotaRemainingPercent != null)
    dailyPct = Number(ps.dailyQuotaRemainingPercent);
  else if (ps.dailyPercentRemaining != null)
    dailyPct = Number(ps.dailyPercentRemaining);
  else if (ps.daily_percent_remaining != null)
    dailyPct = Number(ps.daily_percent_remaining);
  else if (ps.dailyQuotaUsagePercent != null)
    dailyPct = 100 - Number(ps.dailyQuotaUsagePercent);
  else if (ps.dailyPercentUsed != null)
    dailyPct = 100 - Number(ps.dailyPercentUsed);
  else if (ps.daily_percent_used != null)
    dailyPct = 100 - Number(ps.daily_percent_used);
  // ── ★★★ proto3 语义严守 (v2.1.3 · 反者道之动 · 镜像谬之绝) ★★★ ──
  // proto3 JSON: 值=0 → 字段 omit (default suppression)
  //              值=100 → 字段 present (100 ≠ default 0)
  //              值=32 → 字段 present
  // ∴ 字段缺失 = 值为 0 = 耗尽 (不是 "未知"!)
  //
  // ★ 历史镜像谬之实证 (wam-state.json 现场捉获) ★
  //   d=11/w=11, d=23/w=23, d=42/w=42, d=50/w=50 等"伪相同"账号
  //   实为 daily=0 (耗尽) 被错镜像为 weekly · 致 UI 错示 + 自动切号失灵
  //
  // ★ 反证 (同库正常号 D/W 独立波动): d=85/w=43, d=44/w=57, d=16/w=12 ★
  //   daily 与 weekly 是独立资源池, 各有 reset 时间, 不可代理.
  //   "Devin Trial 没有 daily" 注释为代理人误判 — 实测 dailyResetAt 始终 >0.
  //
  // ★ 本源对齐 (_github_src/wam-bundle/extension.js · _extractQuotaFields) ★
  //   const dailyVal = dailyR >= 0 && dailyR <= 100 ? dailyR : 0;  // 不镜像
  //   const weeklyVal = weeklyR >= 0 && weeklyR <= 100 ? weeklyR : 0;
  //
  // ★ 哨兵 dailyResetAt / weeklyResetAt: 严守语义 + 兼容未来非追踪 plan ★
  //   resetAt > 0  → 此 plan 追踪此周期 → omit 当 0 (耗尽)
  //   resetAt == 0 → 此 plan 不追踪此周期 → omit 退化为另一周期值 (兼容)
  //   实战: 当前所有号 (Trial/Free) 双 resetAt 均 >0, 镜像分支永不进
  // ── 先解析 resetAt 以作语义哨兵 (上移自原 1102 处) ──
  const _parseUnixTs = (v) => {
    if (!v) return 0;
    if (typeof v === "object" && v.seconds != null)
      return Number(v.seconds) * 1000;
    const n = Number(v);
    if (n > 1e12) return n;
    if (n > 1e9) return n * 1000;
    return 0;
  };
  const dailyResetAt = _parseUnixTs(
    ps.dailyQuotaResetAtUnix ||
      ps.daily_quota_reset_at_unix ||
      ps.dailyResetAt ||
      0,
  );
  const weeklyResetAt = _parseUnixTs(
    ps.weeklyQuotaResetAtUnix ||
      ps.weekly_quota_reset_at_unix ||
      ps.weeklyResetAt ||
      0,
  );
  if (weeklyPct == null) {
    if (weeklyResetAt > 0 || dailyPct != null) {
      weeklyPct = 0; // 此 plan 追踪 weekly · omit = 耗尽
      log("  parsePlan: weekly% omit → 0 (proto3 default · 耗尽)");
    } else {
      weeklyPct = Number(dailyPct) || 0; // 极罕见: 双周期皆缺 · 兜底
      log("  parsePlan: weekly% omit & no wrst → fallback daily=" + weeklyPct);
    }
  }
  if (dailyPct == null) {
    if (dailyResetAt > 0) {
      dailyPct = 0; // 此 plan 追踪 daily · omit = 耗尽 (修复历史镜像谬)
      log("  parsePlan: daily% omit → 0 (proto3 default · 耗尽)");
    } else {
      // 此 plan 完全不追踪 daily (理论可能 · 实战未见) · 退化为 weekly
      dailyPct = Number(weeklyPct) || 0;
      log("  parsePlan: daily% omit & no drst → mirror weekly=" + dailyPct);
    }
  }
  // ── planEnd: ISO/proto-Timestamp/unix 秒/毫秒 兼容 · 秒级保存不截断 ──
  const peRaw =
    ps.planEnd ??
    ps.plan_end ??
    ps.planExpiresAt ??
    ps.plan_expires_at ??
    ps.expiresAt ??
    ps.expires_at ??
    planInfo.endTimestamp ??
    planInfo.end_timestamp ??
    planInfo.planEnd ??
    planInfo.plan_end ??
    (userStatus && (userStatus.planEnd ?? userStatus.plan_end)) ??
    j.planEnd ??
    j.plan_end ??
    0;
  const pe = _parseTimeMs(peRaw);
  const daysLeft = _calcDaysLeft(pe);
  // ── 防御 NaN/Infinity → 0 (不再用 `|| 0` 误吞 0) ──
  const safeDaily = Math.max(
    0,
    Math.min(100, Math.round(isFinite(dailyPct) ? dailyPct : 0)),
  );
  const safeWeekly = Math.max(
    0,
    Math.min(100, Math.round(isFinite(weeklyPct) ? weeklyPct : 0)),
  );
  // ── 重置时间 dailyResetAt/weeklyResetAt 已在上方哨兵处解析 (v2.1.3 上移) ──
  // ── planStart ──
  let ps2 = 0;
  const psRaw = ps.planStart || ps.plan_start || 0;
  ps2 = _parseTimeMs(psRaw);
  // ── teamsTier (软编码: 适配所有 plan 类型) ──
  const tierRaw = planInfo.teamsTier || planInfo.teams_tier || 0;
  let teamsTier = 0;
  if (typeof tierRaw === "number") teamsTier = tierRaw;
  else if (typeof tierRaw === "string") {
    const m = tierRaw.match(/\d+/);
    if (m) teamsTier = Number(m[0]);
  }
  // ── overageBalanceMicros → overageDollars ──────────────────────────────────
  // v2.8.6 · 反者道之动 · 多层查找 + uint32 无符号修正 + 合理性上限
  // proto3 int64 可能在多个层级: ps / userStatus / j (按精度降序尝试)
  // {lo,hi} / {low,high} 格式: lo/hi 是 JS signed int32 → 需 >>> 0 转 uint32
  const _m = (v) => {
    if (v == null || v === 0 || v === "0" || v === "") return 0;
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "object") {
      // proto int64 as {lo,hi} or {low,high} — lo/hi are signed JS ints
      const lo = v.lo != null ? v.lo : v.low != null ? v.low : null;
      const hi = v.lo != null ? v.hi : v.low != null ? v.high : null;
      if (lo != null) {
        const uLo = Number(lo) >>> 0; // uint32
        const uHi = Number(hi) >>> 0; // uint32
        return uLo + uHi * 4294967296;
      }
    }
    const n = Number(v);
    return isFinite(n) && n >= 0 ? n : 0;
  };
  // 多层 fallback: ps → userStatus → j (防字段藏在不同层级)
  const _rawOvg =
    ps.overageBalanceMicros ??
    ps.overage_balance_micros ??
    (userStatus &&
      (userStatus.overageBalanceMicros ?? userStatus.overage_balance_micros)) ??
    j.overageBalanceMicros ??
    j.overage_balance_micros ??
    0;
  const overageMicros = _m(_rawOvg);
  // 合理性上限: Devin 最高 $200 Extra Usage; 上限 $1000 防解析异常虚高
  const overageDollars = Math.min(
    1000,
    Math.round((overageMicros / 1000000) * 100) / 100,
  );
  const overageActive = overageDollars > 0;
  return {
    daily: safeDaily,
    weekly: safeWeekly,
    plan: typeof plan === "string" ? plan : "Trial",
    planEnd: pe,
    planStart: ps2,
    daysLeft,
    promptCredits: promptAvail,
    flowCredits: flowAvail,
    promptUsed,
    promptMonth,
    dailyResetAt,
    weeklyResetAt,
    teamsTier,
    overageDollars, // USD · $200 Extra Usage Balance
    overageActive, // true = Cascade quota=0 时仍完全可用
  };
}

async function _getOrgId(auth1) {
  try {
    const r = await jsonPost(
      URL_DEVIN_ORG_AUTH,
      { Authorization: "Bearer " + auth1 },
      {},
      6000,
    );
    const j = r && r.json;
    return (j && ((j.org && j.org.org_id) || j.org_id)) || null;
  } catch {
    return null;
  }
}

// v3.0 · Devin billing 后备探额 · GetUserStatus 400 时用此路径获取真实额度
// 实证: app.devin.ai/api/{orgId}/billing/status
//   返回 { overage_credits: number, billing_error: string|null }
//   overage_credits < 0 = 有 Extra Usage (平台对用户赏予)、>= 0 = 无额度
async function _tryDevinBillingFallback(auth1) {
  if (!auth1) return null;
  try {
    const orgId = await _getOrgId(auth1);
    if (!orgId) return null;
    const r = await httpsReq(
      "GET",
      "https://app.devin.ai/api/" + orgId + "/billing/status",
      { Authorization: "Bearer " + auth1, "User-Agent": UA },
      null,
      8000,
    );
    if (r.status !== 200) return null;
    let j;
    try {
      j = JSON.parse(r.body.toString());
    } catch {
      return null;
    }
    // overage_credits < 0 且无 billing_error → 有实际额度
    const hasFunds =
      typeof j.overage_credits === "number" &&
      j.overage_credits < 0 &&
      !j.billing_error;
    const dollarAmt = hasFunds ? Math.abs(j.overage_credits) : 0;
    return {
      checked: true,
      plan: "Trial", // billing API 不返 plan 名称 · 保守设 Trial
      daily: hasFunds ? 100 : 0,
      weekly: hasFunds ? 100 : 0,
      planEnd: 0,
      daysLeft: 0,
      overageActive: hasFunds,
      overageDollars: dollarAmt,
      billingError: j.billing_error || null,
      lastChecked: Date.now(),
      _source: "devin_billing_v3", // 标记数据来源
    };
  } catch {
    return null;
  }
}

// ═══ § 3b · 批量验证 (verifyOne / verifyAll) · 不切号 · 仅探测 quota ═══
// 取之尽锱铢: 用 devinLogin → postAuth → tryFetchPlanStatus 三步链条 · 不调 inject
// 用之如泥沙: 并行 + 间隔抖动 + 限速回退 · 防 Devin 整批拉黑
async function verifyOneAccount(account) {
  if (!account || !account.email || !account.password)
    return { ok: false, stage: "init", error: "no creds" };
  // v3.0.6 · 缓存快路 · 与 loginAccount 对齐 · 根治 verifyAll 批量触 IP限速
  //   有效 session cache → 直接 tryFetchPlanStatus · 零 devinLogin · 二次 verifyAll 无任何限速
  //   cache失效/quota获取失败 → 驱逐缓存 → 走全路 (devinLogin已被全局序列化门保护)
  const _cachedV = _getCachedSession(account.email);
  if (_cachedV) {
    const _qC = await tryFetchPlanStatus(_cachedV.apiKey, {
      apiServerUrl: _cachedV.apiServerUrl,
      silent: true,
    });
    if (_qC) {
      _cacheSession(
        account.email,
        _cachedV.sessionToken,
        _cachedV.apiKey,
        _cachedV.apiServerUrl,
      ); // 刷新 TTL
      return {
        ok: true,
        q: _qC,
        sessionToken: _cachedV.sessionToken,
        apiKey: _cachedV.apiKey,
        apiServerUrl: _cachedV.apiServerUrl,
      };
    }
    _evictSessionCache(account.email); // apiKey 失效 → 驱逐 → 走全路
  }
  const dl = await devinLogin(account.email, account.password);
  if (!dl.ok) return { ok: false, stage: "devinLogin", error: dl.error };
  const pa = await windsurfPostAuth(dl.auth1);
  if (!pa.ok) return { ok: false, stage: "postAuth", error: pa.error };
  // v2.4.1 · 加 RegisterUser 步: 拿真 api_key + 动态 api_server_url
  //   GetUserStatus 真路径需 X-Api-Key Header · trial 里 sessionToken == apiKey, 失败时降级
  const reg = await registerUserViaSession(pa.sessionToken);
  const apiKey = (reg.ok && reg.apiKey) || pa.sessionToken;
  const apiServerUrl = (reg.ok && reg.apiServerUrl) || pa.apiServerUrl || "";
  let q = await tryFetchPlanStatus(apiKey, { apiServerUrl, silent: true });
  // v3.0 · GetUserStatus 400 时用 Devin billing API 作后备探实隔额
  if (!q) {
    const qb = await _tryDevinBillingFallback(dl.auth1);
    if (qb) {
      q = qb;
      log(
        "  billing-fallback ✅ " +
          account.email.split("@")[0] +
          " overage=" +
          qb.overageActive +
          " $" +
          (qb.overageDollars || 0) +
          " err=" +
          (qb.billingError || "null") +
          " [" +
          qb._source +
          "]",
      );
    } else {
      return {
        ok: false,
        stage: "planStatus",
        error: "GetUserStatus 400 + billing fallback null",
      };
    }
  }
  // v3.0.3 · 🚀 验证阶段缓存 sessionToken · 下次切号可跳 devinLogin (道法自然·预赋)
  _cacheSession(account.email, pa.sessionToken, apiKey, apiServerUrl);
  return { ok: true, q, sessionToken: pa.sessionToken, apiKey, apiServerUrl };
}

// 批量验证 · onlyStale=true 时跳过最近验过的 (默认 staleMin <= 30)
// v2.1.1 根治: 全局限速协调 + 指数退避 + 失败自动重试 · 新用户首次全池验证不再卡死
// parallel: 默认 3 (保守 · 防 Devin 限速 · 用户可改 wam.verify.parallel)
// gapMs: 每个 verify 完成后的间隔 (默认 250ms 抖动)
async function verifyAllAccounts(opts) {
  if (_verifyAllInProgress) return { ok: false, busy: true };
  _verifyAllInProgress = true;
  // v3.0.2 · try/finally 保证 _verifyAllInProgress 必重置 · 周期验证永不卡死
  const _vADone = () => {
    _verifyAllInProgress = false;
  };
  const o = opts || {};
  const onlyStale = !!o.onlyStale;
  // v3.1.2 · _cacheOnly 选项 · 仅 verify cache 内号 (走 fast-path · 零 devinLogin)
  //   场景: 自动路径 (startup/periodic) 启用 · 永不批量 devinLogin · 永不触限速
  //   语义: 队列构建时过滤未 cache 号 · 仅保留 _getCachedSession 命中号
  //   未 cache 号: lazy on user switch · 反正未 cache 号必走 devinLogin · 现按需而非批量
  const cacheOnly = !!o._cacheOnly;
  const userParallel = Math.max(
    1,
    Math.min(8, _cfg("verify.parallel", 3) | 0 || 3),
  );
  const gapMs = Math.max(0, _cfg("verify.gapMs", 250) | 0);
  // v3.0.2 · startupStaleMin: 启动验证可传更短阈值 (默认15min) · 防重启后跳过近期验号
  const staleThresholdMin =
    o.startupStaleMin != null
      ? Math.max(1, o.startupStaleMin | 0)
      : Math.max(1, _cfg("verify.staleMin", 30) | 0);
  const total = _store.accounts.length;
  // 构建队列 (排除黑名单 + onlyStale 时排除最近验过的)
  const queue = [];
  let uncheckedCount = 0;
  let cacheOnlySkipCount = 0;
  for (let i = 0; i < total; i++) {
    const a = _store.accounts[i];
    if (_store.isBanned(a.email)) continue;
    const h = _store.getHealth(a.email);
    if (!h.checked) uncheckedCount++;
    if (onlyStale) {
      if (h.checked && h.staleMin >= 0 && h.staleMin < staleThresholdMin)
        continue;
    }
    // v3.1.2 · _cacheOnly 过滤 · 仅保留 cache 内号 (零 devinLogin · 零限速)
    //   注意: _getCachedSession 命中会续期 cachedAt · 但此处仅探测 · 不副作用 (peek)
    //   peek 实现: 直接查 _sessionCache.get + 手动 TTL 检查 · 不调 _getCachedSession
    if (cacheOnly) {
      const _peek = _sessionCache.get(a.email.toLowerCase());
      if (!_peek) {
        cacheOnlySkipCount++;
        continue;
      }
      const _peekTtl =
        _peek.maxAgeMs ||
        Math.max(
          60000,
          +_cfg("tokenCacheMaxAgeMs", SESSION_CACHE_DISK_TTL_MS) ||
            SESSION_CACHE_DISK_TTL_MS,
        );
      if (Date.now() - _peek.cachedAt > _peekTtl) {
        cacheOnlySkipCount++;
        continue;
      }
    }
    queue.push(i);
  }
  // 道法自然 · 首次验证 (>50% 未验) → 降低并行度 · 加大间隔 · 防 Devin 整批拉黑
  const isFirstTime = uncheckedCount > total * 0.5;
  const parallel = isFirstTime ? Math.min(userParallel, 2) : userParallel;
  const effectiveGapMs = isFirstTime ? Math.max(gapMs, 1500) : gapMs;
  log(
    "verifyAll: 启动 · 候选 " +
      queue.length +
      "/" +
      total +
      " · 未验 " +
      uncheckedCount +
      " · 并行 " +
      parallel +
      (isFirstTime ? "(首次降速)" : "") +
      " · gap " +
      effectiveGapMs +
      "ms" +
      (onlyStale ? " · onlyStale" : "") +
      (cacheOnly
        ? " · _cacheOnly (跳过未 cache 号 " + cacheOnlySkipCount + ")"
        : ""),
  );
  let ok = 0,
    fail = 0,
    done = 0;
  const t0 = Date.now();
  // v2.1.1 全局限速协调: 所有 worker 共享暂停状态 · 一人中招全队等
  let _globalPauseUntil = 0;
  let _rateLimitHits = 0;
  let _abortedDueToDeadEndpoint = false; // v2.4.0 · endpoint 死时整批跳出
  const _failedIndices = []; // 收集失败的 idx · 后续重试
  async function _waitGlobalPause() {
    while (Date.now() < _globalPauseUntil) {
      const wait = Math.min(_globalPauseUntil - Date.now(), 2000);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  }
  async function worker() {
    while (queue.length > 0) {
      // v2.4.0 · 反者道之动 · endpoint 已挂时整批跳出 · 不浪费 71 个号请求
      if (_quotaEndpointDead()) {
        if (!_abortedDueToDeadEndpoint) {
          _abortedDueToDeadEndpoint = true;
          log(
            "verifyAll: GetPlanStatus endpoint 已挂 (连续 " +
              _quotaEndpointHealth.consecutive401 +
              " 次 401) · 整批跳出 · queue 余 " +
              queue.length,
          );
        }
        queue.length = 0; // 清空 · 其他 worker 自然退出
        break;
      }
      await _waitGlobalPause(); // 尊重全局暂停
      const idx = queue.shift();
      const a = _store.accounts[idx];
      if (!a) continue;
      const tag = a.email.split("@")[0].substring(0, 14);
      try {
        const r = await verifyOneAccount(a);
        if (r.ok) {
          _store.setHealth(a.email, r.q);
          ok++;
          // 连续成功 → 逐步恢复退避
          if (_rateLimitHits > 0)
            _rateLimitHits = Math.max(0, _rateLimitHits - 1);
          log(
            "verify [" +
              idx +
              "] " +
              tag +
              " ✓ D" +
              r.q.daily +
              "% W" +
              r.q.weekly +
              "% " +
              r.q.plan +
              " " +
              r.q.daysLeft +
              "d",
          );
        } else {
          fail++;
          _failedIndices.push(idx);
          log("verify [" + idx + "] " + tag + " ✗ " + r.stage + ": " + r.error);
          // v2.1.1 全局限速: 指数退避 5s → 15s → 30s → 60s · 全 worker 共享
          if (r.error && /rate.?limit|too.many|429/i.test(String(r.error))) {
            _rateLimitHits++;
            const backoff = Math.min(
              60000,
              5000 * Math.pow(2, _rateLimitHits - 1),
            );
            _globalPauseUntil = Date.now() + backoff;
            log(
              "verifyAll: 限速#" +
                _rateLimitHits +
                " · 全局暂停 " +
                Math.round(backoff / 1000) +
                "s",
            );
          }
        }
      } catch (e) {
        fail++;
        _failedIndices.push(idx);
        log("verify [" + idx + "] " + tag + " 异常 " + e.message);
      }
      done++;
      // 每 3 个 broadcast 一次 (首次验证时用户需要更频繁的反馈)
      if (done % (isFirstTime ? 3 : 5) === 0 || queue.length === 0)
        _broadcastUI();
      if (effectiveGapMs > 0 && queue.length > 0) {
        // 抖动: gapMs ± 30%
        const jitter = Math.round(effectiveGapMs * (0.7 + Math.random() * 0.6));
        await new Promise((r) => setTimeout(r, jitter));
      }
    }
  }
  const workers = [];
  for (let i = 0; i < parallel; i++) workers.push(worker());
  try {
    await Promise.all(workers);
  } catch {}
  // v2.1.1 自动重试: 首轮失败的账号 · 串行 + 长间隔 · 水善利万物而不争
  // v2.4.0: endpoint 已挂时不重试 · 知止可以不殆
  if (
    !_abortedDueToDeadEndpoint &&
    _failedIndices.length > 0 &&
    _failedIndices.length <= total * 0.8
  ) {
    const retryCount = _failedIndices.length;
    log("verifyAll: 重试 " + retryCount + " 个失败账号 · 串行 · gap 3s");
    let retryOk = 0;
    for (const idx of _failedIndices) {
      // 重试期再检 endpoint · 死了就停
      if (_quotaEndpointDead()) {
        log("verifyAll: 重试期 endpoint 仍死 · 停止重试");
        break;
      }
      const a = _store.accounts[idx];
      if (!a) continue;
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000));
      try {
        const r = await verifyOneAccount(a);
        if (r.ok) {
          _store.setHealth(a.email, r.q);
          retryOk++;
          fail--;
          ok++;
          if (retryOk % 3 === 0) _broadcastUI();
        }
      } catch {}
    }
    log("verifyAll: 重试完成 · " + retryOk + "/" + retryCount + " 恢复");
  } else if (_abortedDueToDeadEndpoint) {
    log("verifyAll: 跳过重试 (endpoint 已挂) · 用 wam.endpointHealth 查诊断");
  }
  _vADone(); // v3.0.2 finally-equivalent · 必重置
  _broadcastUI();
  const dur = Math.round((Date.now() - t0) / 1000);
  log("verifyAll: 完成 · " + ok + " ✓ / " + fail + " ✗ · " + dur + "s");
  return { ok: true, total: ok + fail, ok, fail, durSec: dur };
}

// v3.1.1 · 路甲(injectViaJia hijack loginWithAuthToken) 已损 · 永废 · 弹窗根源
// v3.1.1 · 路乙(injectViaYi clipboard loginWithAuthToken) 已损 · 永废 · 弹窗根源
//   两者唯一安全替代 = 路丙 injectViaBing (provideAuthTokenToAuthProvider · IDE 内部 API)
//   功能不损: injectToken 仅走路丙 + 一次重试 (v3.1.0 已实证 74/74 守门通过)
//
// 路丙: IDE 内部 authProvider 命令 · 真无为 · 不弹 UI · 不重启
// 来源: codeium.windsurf 扩展 dist/extension.js @ ~678080 行真注册:
//   commands.registerCommand(t.PROVIDE_AUTH_TOKEN_TO_AUTH_PROVIDER, async A => {
//     try { return { session: await e.handleAuthToken(A), error: void 0 } }
//     catch(A) { return A instanceof WindsurfError ? {error: A.errorMetadata}
//                                                  : {error: GENERIC_ERROR} }
//   })
// 真返回结构: { session: <obj> | undefined, error: <ErrorMetadata> | undefined }
// v2.1.2 根治: 旧版误判 c.type === "failure", 实则永不命中 → 失败被错判为成功
async function injectViaBing(token) {
  try {
    // v3.13.0 · 自适应命令 · 自动检测 windsurf.* 或 devin.* 命令名
    const _cmdId = await _getAuthCommand("PROVIDE_AUTH_TOKEN");
    if (!_cmdId)
      return { ok: false, path: "丙", reason: "no-auth-command-found" };
    // v3.15.0 · 根治: provideWindsurfAuthTokenToAuthProvider 传入 sessionToken 字符串
    //   → handleAuthToken(typeof string) → looksLikeCodeiumAuthToken? (starts with "ott$") → false
    //   → handleDevinAuthToken(sessionToken) → exchangeDevinCode(sessionToken) → 失败!
    //   正法: 传 {kind:"codeium", accessToken: sessionToken} 对象
    //   → handleAuthToken(typeof object) → switch(kind) → handleCodeiumAuthToken(accessToken)
    //   → registerUser(sessionToken) → persistSessionAndRestart → 认证状态真正生效
    const _isDevinSession = RE_SESSION_TOKEN.test(token);
    const _arg = _isDevinSession
      ? { kind: "codeium", accessToken: token }
      : token;
    if (_isDevinSession)
      log("inject 路丙 devin-session-token → codeium对象路由 (v3.15.0 根治)");
    const c = await Promise.race([
      vscode.commands.executeCommand(_cmdId, _arg),
      new Promise((r) => setTimeout(() => r({ _wam_timeout: true }), 8000)),
    ]);
    // 命令未注册 → executeCommand 返回 undefined (vscode 行为)
    if (c == null)
      return { ok: false, path: "丙", reason: "command-void(not-registered?)" };
    if (c._wam_timeout) return { ok: false, path: "丙", reason: "timeout(8s)" };
    // ─── 真返回结构 { session, error } (codeium.windsurf 扩展注册) ───
    if (c.error) {
      const err =
        c.error.code ||
        c.error.description ||
        c.error.errorCode ||
        JSON.stringify(c.error).substring(0, 100);
      return { ok: false, path: "丙", reason: err };
    }
    if (c.session) {
      return { ok: true, path: "丙", detail: "session-ok" };
    }
    // ─── 兼容旧返回结构 { type: "success"/"failure" } ───
    if (c.type === "failure") {
      const err = c.error
        ? c.error.code || c.error.description || JSON.stringify(c.error)
        : "?";
      return { ok: false, path: "丙", reason: err };
    }
    if (c.type === "success") {
      return { ok: true, path: "丙", detail: "type-success" };
    }
    // ─── 兜底: 未知返回结构 → 视作可疑成功 (避免误降级) ───
    return {
      ok: true,
      path: "丙",
      detail: "unknown:" + JSON.stringify(c).substring(0, 80),
    };
  } catch (e) {
    return { ok: false, path: "丙", reason: e.message };
  }
}

// ═══ v3.14.0 · 路丁 (Path Ding) · vscdb 直写认证状态 ═══
// 根治: provideWindsurfAuthTokenToAuthProvider 传入 sessionToken
//       → handleDevinAuthToken 误当 devinCode → exchangeDevinCode 失败
//       → 路丁绕过命令系统 · 从根本底层写入认证状态
// 原理: Electron secrets = v10 + AES-256-GCM · 密钥由 DPAPI 保护
//       WAM 作为同用户进程 → Python helper 调 DPAPI 解密密钥 → 加密新 session → 直写 vscdb
//       内置扩展下次读取 context.secrets 时自动获取新 session · 无需重启
async function _injectViaDing(sessionToken, apiServerUrl) {
  try {
    const pyExe = _findPythonExt();
    if (!pyExe) return { ok: false, reason: "no-python-for-ding" };
    const helperPy = path.join(__dirname, "_vscdb_inject_helper.py");
    if (!fs.existsSync(helperPy))
      return { ok: false, reason: "no-helper-py:" + helperPy };
    const asu = apiServerUrl || "https://server.self-serve.windsurf.com";
    const r = require("child_process").spawnSync(
      pyExe,
      [helperPy, "inject", sessionToken, asu],
      {
        timeout: 10000,
        encoding: "utf-8",
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      },
    );
    if (r.error) return { ok: false, reason: "spawn:" + r.error.message };
    const stdout = (r.stdout || "").trim();
    if (!stdout) return { ok: false, reason: "empty-output:rc=" + r.status };
    try {
      const j = JSON.parse(stdout);
      if (j.ok) {
        // v3.14.0 · vscdb直写成功 · 认证状态已写入
        //   注意: 不自动重载窗口 (路丁→reload→WAM restart→路丙 fail→路丁→reload=死循环)
        //   内置扩展会在下次IDE启动时读取新session · 或通过 context.secrets.onDidChange 自然刷新
        //   windsurfAuthStatus 已同步更新 → 状态栏立即显示已登录
        log("路丁 vscdb写入成功 · 认证状态已注入 (下次启动生效)");
        return { ok: true, detail: j.detail || "vscdb-ok" };
      }
      return { ok: false, reason: j.error || "helper-fail" };
    } catch {
      return { ok: false, reason: "parse-fail:" + stdout.substring(0, 80) };
    }
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// v3.15.0: injectToken 主入口 · 路丙(根治) + 路丁(兜底) · 真无为 (顺其自然)
//   v3.15.0 根治: sessionToken 传 {kind:"codeium", accessToken} 对象 → handleCodeiumAuthToken
//   旧版根因: 传裸字符串 → handleDevinAuthToken → exchangeDevinCode 误判 → 切号不生效
//   openExternal 守卫已在 activate 永久安装 · 弹窗根源已断
//   路丙失败仅重试一次 · transient 失败可恢复 · 持久 failure 即返回 (绝不降级)
async function injectToken(token, opts) {
  opts = opts || {};
  // 路丙: IDE 内部 API (首选路径 · 真无为)
  log("inject 路丙 " + (await _getAuthCommand("PROVIDE_AUTH_TOKEN")));
  const c = await injectViaBing(token);
  if (c.ok) {
    log("路丙 ✓ " + (c.detail || ""));
    return { ok: true, path: "丙" };
  }
  log("路丙 ✗ " + c.reason + " · 500ms 后重试一次");
  // 路丙唯一重试 (transient failure: timeout / 暂时未注册 / 内部错误)
  await new Promise((r) => setTimeout(r, 500));
  const c2 = await injectViaBing(token);
  if (c2.ok) {
    log("路丙 retry ✓ " + (c2.detail || ""));
    return { ok: true, path: "丙retry" };
  }
  log("路丙 retry ✗ " + c2.reason);
  // v3.14.0 · 路丁: vscdb 直写认证状态 (路丙根治后的兜底路径)
  //   v3.15.0 后路丙已根治 (codeium对象路由) · 路丁仅在路丙彻底失败时触发
  //   原理: Electron secrets = v10 + AES-256-GCM · 密钥由 DPAPI 保护
  //   WAM 作为同用户进程可用 DPAPI 解密密钥 → 加密新 session → 直写 vscdb
  log("路丙2次均失败 · 尝试路丁 (vscdb直写)");
  const d = await _injectViaDing(token, opts.apiServerUrl);
  if (d.ok) {
    log("路丁 ✓ " + (d.detail || ""));
    return { ok: true, path: "丁", detail: d.detail };
  }
  log("路丁 ✗ " + (d.reason || ""));
  return {
    ok: false,
    path: "丙丁",
    note:
      "路丙2次均失败: " +
      c.reason +
      " / " +
      c2.reason +
      " · 路丁: " +
      (d.reason || "?"),
  };
}

function tryLoadPendingToken() {
  try {
    if (!fs.existsSync(PENDING_TOKEN_FILE)) return null;
    const j = JSON.parse(fs.readFileSync(PENDING_TOKEN_FILE, "utf8"));
    if (!j || !j.sessionToken || !j.email) return null;
    const ageMs = Date.now() - (j.timestamp || 0);
    if (ageMs > 5 * 60 * 1000) {
      log("pending expired");
      return null;
    }
    log("pending hit · age=" + Math.round(ageMs / 1000) + "s");
    return j;
  } catch (e) {
    log("loadPending: " + e.message);
    return null;
  }
}
function consumePendingToken() {
  try {
    if (fs.existsSync(PENDING_TOKEN_FILE)) fs.unlinkSync(PENDING_TOKEN_FILE);
  } catch {}
}
// v2.5.0 · 不禁号 · 「绝学无忧」· 简化失败处理
//   rate-limit: 不记任何事 (是 IP/device 级·跟号无关)
//   其它失败: 累计 count · 不禁号 · 号永远可选
function _bumpFailure(store, email, reason) {
  // rate-limit 完全豁免 · 连 count 都不 bump
  if (reason && /rate.?limit|too.?many.?request|429/i.test(String(reason))) {
    log("rate-limit skip · " + email.split("@")[0] + " (v2.5 号完好 · 不记数)");
    return;
  }
  // 其它失败: 记数 · 但不禁号 (banFor 在 v2.5 也不写 until)
  store.banFor(email, 0, reason);
}

async function loginAccount(store, idx) {
  if (idx < 0 || idx >= store.accounts.length)
    return { ok: false, error: "idx_out_of_range" };
  const acc = store.accounts[idx];
  if (store.isBanned(acc.email))
    return { ok: false, error: "banned", stage: "preCheck" };
  const t0 = Date.now();
  const tag = acc.email.split("@")[0].substring(0, 18);
  log("login: 试 [" + idx + "] " + tag);
  // v3.0.3 · 🚀 缓存快速通道 · 跳过 devinLogin/windsurfPostAuth 直射 injectToken (< 50ms vs 3-8s)
  //   根治: devinLogin = IP级速率限制根源 · 缓存命中则根本不会触发限制
  //   缓存来源: verifyOneAccount (verifyAll 已完成登录) · 上次切号成功
  const _cached = _getCachedSession(acc.email);
  if (_cached) {
    const _injC = await injectToken(_cached.sessionToken);
    if (_injC.ok) {
      store.setActive(
        idx,
        acc.email,
        _cached.sessionToken,
        _cached.apiKey,
        _cached.apiServerUrl,
        _injC.path,
      );
      const _msC = Date.now() - t0;
      _lastSwitchMs = _msC;
      _lastRotateToastAt = Date.now();
      _lastRotateToastEmail = acc.email;
      try {
        updateStatusBar();
        setTimeout(() => {
          try {
            updateStatusBar();
          } catch {}
        }, 3100);
      } catch {}
      log(
        "login: ✓ [cached] " +
          tag +
          " · 路" +
          _injC.path +
          " · " +
          _msC +
          "ms (无devinLogin)",
      );
      // 清除失败计数 (v2.3.0 逻辑)
      const _kb = acc.email.toLowerCase();
      const _bk = store.blacklist[_kb];
      if (_bk && !_bk.until) {
        delete store.blacklist[_kb];
        store.save();
      }
      return { ok: true, path: _injC.path, ms: _msC, cached: true };
    }
    // 缓存命中但注入失败 → 驱逐失效缓存 → fallback 全登录
    _evictSessionCache(acc.email);
    log("login: cached token 失效 · 驱逐 · fallback 全登录");
  }
  const dl = await devinLogin(acc.email, acc.password);
  if (!dl.ok) {
    log("  devinLogin ✗ " + (dl.error || "?"));
    _bumpFailure(store, acc.email, "devin: " + (dl.error || "?"));
    return { ok: false, stage: "devinLogin", error: dl.error };
  }
  const pa = await windsurfPostAuth(dl.auth1);
  if (!pa.ok) {
    log("  postAuth ✗ " + (pa.error || "?"));
    _bumpFailure(store, acc.email, "postAuth: " + (pa.error || "?"));
    return { ok: false, stage: "windsurfPostAuth", error: pa.error };
  }
  // v3.1.0 · token 预验 + openExternal 守卫 + 注入
  //   先 registerUserViaSession 验 token 有效性 · 再 injectToken
  //   避免 handleAuthToken 内部 registerUser 失败扰动 auth 状态 → 触发 LOGIN_WITH_REDIRECT 弹窗
  let _regApiKey = null,
    _regApiServerUrl = "";
  try {
    const reg = await registerUserViaSession(pa.sessionToken);
    if (reg.ok) {
      _regApiKey = reg.apiKey;
      _regApiServerUrl = reg.apiServerUrl || "";
      log("  registerUser 预验 ✓ apiServerUrl=" + _regApiServerUrl);
    } else {
      log("  registerUser 预验 ✗ (token 可能无效) · 仍尝试注入");
    }
  } catch (e) {
    log("  registerUser 预验 err: " + (e.message || e));
  }
  const inj = await injectToken(pa.sessionToken);
  if (!inj.ok) {
    log("  inject ✗ 路" + inj.path + " " + inj.note);
    _bumpFailure(store, acc.email, "inject: " + (inj.note || ""));
    return { ok: false, stage: "inject", error: inj.note };
  }
  store.setActive(
    idx,
    acc.email,
    pa.sessionToken,
    _regApiKey,
    _regApiServerUrl,
    inj.path,
  );
  if (_regApiKey) {
    store.activeApiKey = _regApiKey;
    store.activeApiServerUrl = _regApiServerUrl;
    store.save();
  }
  // v3.0.3 · 全登录成功 → 更新缓存 (下次切号可跳 devinLogin)
  _cacheSession(acc.email, pa.sessionToken, _regApiKey, _regApiServerUrl);
  // v2.3.0: 登陆成 · 消 _bumpFailure 计数 (不让历史泛黄　转转不休)
  {
    const k = acc.email.toLowerCase();
    const b = store.blacklist[k];
    if (b && !b.until) {
      delete store.blacklist[k];
      store.save();
    }
  }
  // planStatus 异步获取 (非关键路径 · 不阻塞切号)
  // v3.10.1: 切入新号后立即拿真实额度 · 若发现 D=0/W=0 → N ms 后重触 _tick 紧急救场
  //   根治: 旧逻辑仅依赖 10s scan interval → 切入零额度号后最多卡 10s "Trial - Quota Exhausted"
  //   新逻辑: 切号成功后立刻验证额度 · D/W=0 即重触 · 用户无感
  // v15.0 (3.11.6) · 默 2000ms → 300ms (近零延迟) · 一以贯之 credits 不再豁免双零
  if (_regApiKey) {
    tryFetchPlanStatus(_regApiKey, { apiServerUrl: _regApiServerUrl })
      .then((q) => {
        if (q) {
          store.setHealth(acc.email, q);
          log(
            "  planStatus: D" +
              q.daily +
              "% W" +
              q.weekly +
              "% " +
              q.plan +
              " " +
              q.daysLeft +
              "d",
          );
          _broadcastUI();
          // v15.0 · 零额度紧急重触: 切入新号发现 D=0/W=0 → N ms后重触_tick换号
          //   软编码: wam.zeroQuotaRetickMs (默 300ms · 0=禁用)
          //   v15.0 修正: credits 不再单独豁免 (与 _isValidAutoTarget 一以贯之)
          //     仅 overage 真金 或 creditsBypassQuotaGate=true 时才不视为硬耗尽
          const _dr = isWeeklyDrought();
          const _qHasCredits = _hasUsableCredits(q);
          const _qCreditsBypass =
            typeof _cfg === "function"
              ? !!_cfg("creditsBypassQuotaGate", false)
              : false;
          const _isD0 =
            !q.overageActive &&
            !(_qCreditsBypass && _qHasCredits) &&
            (_dr ? q.daily <= 0 : q.daily <= 0 || q.weekly <= 0);
          if (_isD0) {
            const _retickMs = Math.max(0, +_cfg("zeroQuotaRetickMs", 300) || 0);
            if (_retickMs > 0) {
              log(
                "  ⚠️ planStatus: 切入号额度归零(D=" +
                  q.daily +
                  "% W=" +
                  q.weekly +
                  "%) · " +
                  _retickMs +
                  "ms后重触_tick紧急换号",
              );
              setTimeout(() => {
                if (_engine && !_switching && !_engine.rotating) {
                  _engine
                    ._tick()
                    .catch((e) => log("retick: " + (e.message || e)));
                }
              }, _retickMs);
            }
          }
        }
      })
      .catch(() => {});
  }
  const ms = Date.now() - t0;
  _lastSwitchMs = ms;
  log("login: ✓ " + tag + " · 路" + inj.path + " · " + ms + "ms");
  // v2.4.13 · 切号反馈 toast · 3s 绿条高亮"✓ 已切→xxx"
  _lastRotateToastAt = Date.now();
  _lastRotateToastEmail = acc.email;
  try {
    updateStatusBar();
    // 3s 后再刷一次·toast 消失归正常显示
    setTimeout(() => {
      try {
        updateStatusBar();
      } catch {}
    }, 3100);
  } catch {}
  return { ok: true, path: inj.path, ms };
}

// ═══ § 4 · 万法之眼 (StatusBar + Webview) ═══
function updateStatusBar() {
  if (!_statusBar || !_store) return;
  const inv = _cfg("invisible", false);
  const stats = _store.getStats();
  const h = _store.activeEmail ? _store.getHealth(_store.activeEmail) : null;
  // ── 官方模式 · 最小化显示 (对齐本源 v17.42.20) ──
  if (_wamMode === "official") {
    _statusBar.text = "$(key) 官方模式";
    _statusBar.tooltip =
      "WAM v" +
      VERSION +
      " [官方模式] — 所有切号功能已停止\n点击打开管理面板，可切回WAM模式";
    _statusBar.color = undefined;
    _statusBar.backgroundColor = undefined;
    return;
  }
  const droughtTag = stats.drought ? "[旱]" : "";
  // v2.4.13 · 切号完成高亮 3s (用户可见反馈 · 道法自然)
  const TOAST_MS = 3000;
  const rotateToastActive =
    _lastRotateToastAt > 0 && Date.now() - _lastRotateToastAt < TOAST_MS;
  if (_engine && _engine.rotating) {
    const targetEmail = _store.activeEmail
      ? " →" + String(_store.activeEmail).split("@")[0].substring(0, 10)
      : "";
    _statusBar.text = "$(sync~spin)" + droughtTag + " 切换中" + targetEmail;
    _statusBar.color = new vscode.ThemeColor("statusBarItem.warningForeground");
    _statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  } else if (rotateToastActive && _lastRotateToastEmail) {
    // v2.4.13 · 刚切完 · 3s 内高亮显示已切到的号 (绿色提示)
    const shortEmail = String(_lastRotateToastEmail)
      .split("@")[0]
      .substring(0, 14);
    const liveD = h ? Math.round(h.daily || 0) : 0;
    const liveW = h ? Math.round(h.weekly || 0) : 0;
    _statusBar.text =
      "$(check) 已切→" + shortEmail + " D" + liveD + "·W" + liveW;
    _statusBar.color = new vscode.ThemeColor(
      "statusBarItem.prominentForeground",
    );
    _statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.prominentBackground",
    );
  } else if (_store.activeEmail && h) {
    const liveD = Math.round(h.daily || 0);
    const liveW = Math.round(h.weekly || 0);
    if (inv) {
      _statusBar.text = "$(zap) " + stats.pwCount;
    } else {
      _statusBar.text =
        "$(zap)" +
        droughtTag +
        " D" +
        liveD +
        "%·W" +
        liveW +
        "% " +
        stats.available +
        "/" +
        stats.pwCount +
        "号";
    }
    _statusBar.color = undefined;
    _statusBar.backgroundColor = undefined;
  } else if (_store.activeEmail) {
    _statusBar.text =
      "$(zap)" +
      droughtTag +
      " " +
      stats.available +
      "/" +
      stats.pwCount +
      "号";
    _statusBar.color = undefined;
    _statusBar.backgroundColor = undefined;
  } else {
    _statusBar.text = "$(zap) " + stats.pwCount + "号";
    _statusBar.color = new vscode.ThemeColor("statusBarItem.errorForeground");
    _statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
  }
  // ── tooltip · 对齐本源丰富信息 ──
  const ttLines = [
    "WAM v" +
      VERSION +
      (_wamMode === "wam" ? " [WAM切号]" : "") +
      (stats.drought ? " [🏜️干旱]" : ""),
  ];
  if (_store.activeEmail) ttLines.push("活跃: " + _store.activeEmail);
  if (h && h.checked)
    ttLines.push(
      h.plan +
        " · D" +
        Math.round(h.daily) +
        "% · W" +
        Math.round(h.weekly) +
        "%",
    );
  ttLines.push(
    "号池: " +
      stats.available +
      "可用 · " +
      stats.exhausted +
      "耗尽" +
      (stats.banned ? " · " + stats.banned + "黑" : ""),
  );
  ttLines.push(
    "日重置: " +
      stats.hrsToDaily.toFixed(1) +
      "h · 周重置: " +
      stats.hrsToWeekly.toFixed(1) +
      "h",
  );
  ttLines.push(
    "切换: " +
      stats.switches +
      "次" +
      (stats.changesDetected ? " · " + stats.changesDetected + "变动" : ""),
  );
  ttLines.push("点击 → 打开管理面板");
  _statusBar.tooltip = ttLines.join("\n");
}
function _broadcastUI() {
  // v3.0.6 · 防抖 · 合并高频调用 · 根治验证/切号期多次全量重建卡顿
  //   verify N个新账号 → N次 broadcastUI → 合并为1次 · 用户无感 · 系统无不为
  // v3.11.3 · 软编码 · 60→200ms (wam.broadcastDebounceMs) · 多选操作时用户手速<200ms·不触发中途重建
  if (_broadcastUITimer) clearTimeout(_broadcastUITimer);
  const _debMs = Math.max(30, +_cfg("broadcastDebounceMs", 200) || 200);
  _broadcastUITimer = setTimeout(() => {
    _broadcastUITimer = null;
    if (_sidebarProvider) _sidebarProvider.refresh();
    if (_editorPanel) {
      try {
        _editorPanel.webview.html = buildHtml();
      } catch {}
    }
    updateStatusBar();
  }, _debMs);
}

// ═══ Cascade 流式避让 (对齐本源 v17.42.5 · 道法自然: 让流完成再切 · 用户对话永不断裂) ═══
// 原理: onDidChangeTextDocument 持续追踪最近文档变化时间
// 2s 内有更新即视为"流式进行中" · 切号推迟 1s 重试 · 总等待上限 15s
// 披褐怀玉: 15s 极限后强切 (避免无限卡住 · 保护后台进度)
function _isCascadeBusy() {
  return Date.now() - _lastDocChangeAt < 2000;
}
async function _waitIfCascadeBusy(maxWaitMs) {
  if (!_isCascadeBusy()) return 0;
  const start = Date.now();
  let waited = 0;
  while (_isCascadeBusy() && Date.now() - start < (maxWaitMs || 15000)) {
    await new Promise((r) => setTimeout(r, 1000));
    waited += 1000;
  }
  if (waited > 0)
    log(
      "⏸️ cascade-avoid: waited " +
        waited +
        "ms · streaming " +
        (_isCascadeBusy() ? "still ongoing (forced)" : "completed"),
    );
  return waited;
}

// ═══ § v2.6.11 直觉切号 · 道恒无名 · 民自均焉 (终极简化) ═══
//
// 上德不德 · 是以有德 · 损之又损 · 以至于无为 · 无为而无不为
//
// v2.6.11 损法 (相对 v2.6.10):
//   · 删 perMessageDebounceMs (4s 防抖) — 真信号无抖·无需聚合
//   · 删 perMessageMinIntervalMs (60s 强锁) — 真信号即真·无须压制
//   · 删 perMessageDelayMs (1.5s 延迟) — 切号作用于下次 send·当前 send 已完成
//
// 守法:
//   · _switching 守卫 (避并发切)
//   · 30s 注入失败冷却 (避雪崩)
//   · in-use lock 120s (已在 setActive · 切后该号锁 · 不会切回)
//
// 配置: wam.rotateOnEveryMessage (默认 true)
function _maybeTrigger(reason, hint) {
  // v2.3.0 道法自然 · 默认开 (rotateOnEveryMessage=true) · 可手关
  if (!_cfg("rotateOnEveryMessage", true)) return;
  if (_wamMode !== "wam") return;
  if (_switching) return;
  if (!_store || _store.activeIdx < 0) return;
  if (_engine && _engine.rotating) return;

  const now = Date.now();
  // v3.0.3 · injectFailCooldownMs 软编码 (原 30s 硬编码 → 默认 5s · 缓存志下极少出现速率限制)
  const _injFailMs = Math.max(0, _cfg("injectFailCooldownMs", 5000) | 0);
  if (_injFailMs > 0 && now - _lastInjectFail < _injFailMs) return; // 注入失败冷却

  // v2.6.12 守一 · 主信号优先 (修 v2.6.11 三路抢跑 1.75 倍切号 bug):
  //   原 v2.6.11: ⚡W%脉动 + 📡WAL·edge + 📃pb·new 三路并发 → 1 send 引发 3 触发
  //   新法: ⚡W%脉动 = 后端真账 = 主信号 · 触发后 N 秒窗口内 WAL/pb 全部让位 (skip)
  //   理由: send 完成后后端 W% 必跌 · 文件 IO 是同 send 的副作用 · 不应重复
  const pulsePriorityMs = Math.max(
    0,
    +_cfg("quotaPulsePriorityMs", 60000) || 60000,
  );
  if (
    pulsePriorityMs > 0 &&
    reason !== "\u26a1W%\u8109\u52a8" && // 非 ⚡W%脉动 来源
    _lastQuotaPulseAt > 0 &&
    now - _lastQuotaPulseAt < pulsePriorityMs
  ) {
    const sinceMs = now - _lastQuotaPulseAt;
    log(
      "\ud83d\udeab " +
        reason +
        " \u8ba9\u4f4d\u00b7\u4e3b\u4fe1\u53f7\u00b7" +
        Math.round(sinceMs / 1000) +
        "s\u524d \u26a1W%\u8109\u52a8\u5df2\u5207\u00b7\u8df3\u8fc7 " +
        (hint || "?"),
    );
    return;
  }

  // v2.6.14 守一 · 全 reason 强锁 (复 v2.6.9 之全栏 · 适 W%/WAL/pb/⚖ 万源)
  //   实证 (179 v2.6.13): 单 send → AI 流 → W%自火 4/40s + WAL 自火 174/5min
  //   根因: quotaPulsePriorityMs 只守 WAL/pb · 不守 W% 自身 · 阳自决堤
  //   修: 入口加 perMessageMinIntervalMs 全 reason 强锁 · 大制无割 · 一全锁覆万源
  //   道: 64 章 "为之者败之·执之者失之·圣人无为故无败" · 单栏 > 多栏
  const minIntervalMs = Math.max(
    0,
    +_cfg("perMessageMinIntervalMs", 60000) || 60000,
  );
  if (
    minIntervalMs > 0 &&
    _lastPerMsgTriggerAt > 0 &&
    now - _lastPerMsgTriggerAt < minIntervalMs
  ) {
    const sinceMs = now - _lastPerMsgTriggerAt;
    log(
      "\ud83d\udeab " +
        reason +
        " \u5168\u680f\u00b7" + // 全栏
        Math.round(sinceMs / 1000) +
        "s\u524d\u5df2\u5207\u00b7\u8df3\u8fc7 " + // s前已切·跳过
        (hint || "?"),
    );
    return;
  }

  _lastPerMsgTriggerAt = now;
  _perMsgHits++;
  log(
    "👁 per-msg hit#" +
      _perMsgHits +
      " · " +
      reason +
      " · " +
      (hint || "?") +
      " → 立即切号 (v2.6.14 全栏 " +
      Math.round(minIntervalMs / 1000) +
      "s)",
  );
  // v2.2.0 文件诊断 (Output Channel 懒刷盘时仍可观)
  try {
    const diagP = path.join(WAM_DIR, "_per_msg_diag.json");
    const prev = fs.existsSync(diagP)
      ? JSON.parse(fs.readFileSync(diagP, "utf8"))
      : { hits: [], rotates: [] };
    prev.hits = (prev.hits || []).slice(-49);
    prev.hits.push({ t: now, reason, hint: hint || "", hit: _perMsgHits });
    prev.lastHit = now;
    prev.totalHits = _perMsgHits;
    prev.totalRotates = _perMsgRotates;
    atomicWrite(diagP, JSON.stringify(prev, null, 2));
  } catch {}

  // v2.6.11 立即切 · 不延迟 (W% 信号到达说明 send 已完成·后端已计费)
  (async () => {
    try {
      if (!_cfg("rotateOnEveryMessage", true)) return;
      if (_wamMode !== "wam" || _switching) return;
      if (!_store || _store.activeIdx < 0) return;
      if (_engine && _engine.rotating) return;
      const bestI = _isValidAutoTarget(_predictiveCandidate)
        ? _predictiveCandidate
        : _store.getBestIndex(_store.activeIdx);
      if (bestI < 0) {
        log("per-msg: 无候选 · 停");
        return;
      }
      // 流式避让 · 让当前对话流完再切 (max 8s)
      await _waitIfCascadeBusy(8000);
      _perMsgRotates++;
      log(
        "👁 per-msg rotate#" +
          _perMsgRotates +
          " → " +
          _store.accounts[bestI].email.substring(0, 24),
      );
      _switching = true;
      _switchingStartTime = Date.now();
      _engine.rotating = true;
      _broadcastUI();
      try {
        const sr = await loginAccount(_store, bestI);
        if (sr.ok) {
          _lastSwitchTime = Date.now();
          _predictiveCandidate = _store.getBestIndex(bestI);
          _notify("verbose", "WAM 直觉: → " + (_store.activeEmail || "?"));
        } else {
          _lastInjectFail = Date.now();
          log("per-msg rotate fail: " + (sr.error || "?"));
        }
        // v2.2.0 文件诊断: 切号尝试结果
        try {
          const diagP = path.join(WAM_DIR, "_per_msg_diag.json");
          const prev = fs.existsSync(diagP)
            ? JSON.parse(fs.readFileSync(diagP, "utf8"))
            : { hits: [], rotates: [] };
          prev.rotates = (prev.rotates || []).slice(-49);
          prev.rotates.push({
            t: Date.now(),
            ok: !!sr.ok,
            email: _store.activeEmail || "?",
            path: sr.path || "",
            error: sr.ok ? "" : sr.error || "?",
            rotate: _perMsgRotates,
          });
          prev.lastRotate = Date.now();
          prev.totalRotates = _perMsgRotates;
          atomicWrite(diagP, JSON.stringify(prev, null, 2));
        } catch {}
      } finally {
        _switching = false;
        _engine.rotating = false;
        _broadcastUI();
      }
    } catch (e) {
      log("per-msg rotate err: " + (e.message || e));
    }
  })();
}

// ═══ Layer 6 · 跨进程文件信号 (v2.5.9 · 反者道之动 · 万法归宗) ═══
// v2.5.9 道极简化: 只监 cascade/*.pb 新文件创建
//   · 实证: Windsurf 每个新对话 = 新建一个 UUID.pb 文件
//   · 信号: 新文件出现 → 用户开启新对话 → 切一次号 (1:1 精确对应)
//   · 无噪: 无 WAL checkpoint 噪音 · 无 size-growth 误判
//   · 普适: 所有 Windsurf 窗口共享 cascade 目录 · 任一窗口新对话均触发
//   旧 v2.5.8: 双信号(pb·size + WAL) · 过触发 · v2.5.9 损之又损 → 唯一真信号
function _resolveCascadePbDir() {
  // v3.16.0 · 跨平台自适应 · Devin Desktop + Windsurf cascade 路径
  const home = os.homedir();
  const candidates = [
    // Devin Desktop 优先 (新版)
    path.join(home, ".codeium", "devin", "cascade"),
    path.join(home, ".codeium", "Devin", "cascade"),
    path.join(home, "AppData", "Local", "codeium", "devin", "cascade"),
    // Windsurf (旧版/当前)
    path.join(home, ".codeium", "windsurf", "cascade"),
    path.join(home, ".codeium", "windsurf-nightly", "cascade"),
    // Windows: AppData\Local 候选
    path.join(home, "AppData", "Local", "codeium", "windsurf", "cascade"),
    // Linux: XDG_DATA_HOME 候选 (若 ~/.codeium 不存在)
    path.join(
      process.env.XDG_DATA_HOME || path.join(home, ".local", "share"),
      "codeium",
      "windsurf",
      "cascade",
    ),
  ];
  for (const p of candidates) {
    try {
      if (fs.statSync(p).isDirectory()) return p;
    } catch {}
  }
  return null;
}
function _resolveGlobalStorageDir(context) {
  if (context && context.globalStorageUri && context.globalStorageUri.fsPath) {
    return path.dirname(context.globalStorageUri.fsPath);
  }
  return null;
}
function _resolveWorkspaceStorageBase(globalStorageDir) {
  // .../User/globalStorage → .../User → .../User/workspaceStorage
  if (globalStorageDir) {
    const wsBase = path.join(
      path.dirname(globalStorageDir),
      "workspaceStorage",
    );
    if (fs.existsSync(wsBase)) return wsBase;
  }
  // v3.16.0: Devin Desktop 优先 → 回退 Windsurf
  const home = os.homedir();
  const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const candidates = [
    // Devin Desktop (Windows)
    path.join(appdata, "Devin", "User", "workspaceStorage"),
    // Windsurf (Windows)
    path.join(appdata, "Windsurf", "User", "workspaceStorage"),
    // macOS/Linux: Devin
    path.join(home, ".config", "Devin", "User", "workspaceStorage"),
    // macOS/Linux: Windsurf
    path.join(home, ".config", "Windsurf", "User", "workspaceStorage"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}
function _installLayer6FileWatcher(context) {
  try {
    if (_layer6Stop) {
      try {
        _layer6Stop();
      } catch {}
      _layer6Stop = null;
    }

    // ── 双信号: pb·new(新对话) + pb·send(存量对话用户发消息) (v2.6.1/v2.6.2) ──
    const cascadePbDir = _resolveCascadePbDir();
    if (!cascadePbDir) {
      log("Layer 6 · skip · cascade 目录未找到 (~/.codeium/windsurf/cascade/)");
      return;
    }

    // v2.6.2 · 跨实例声明目录: 启动时建目录 + 清理 >5min 过期声明文件
    try {
      fs.mkdirSync(L6_CLAIM_DIR, { recursive: true });
    } catch {}
    try {
      const _t0 = Date.now();
      for (const cf of fs.readdirSync(L6_CLAIM_DIR)) {
        try {
          if (_t0 - fs.statSync(path.join(L6_CLAIM_DIR, cf)).mtimeMs > 300000)
            fs.unlinkSync(path.join(L6_CLAIM_DIR, cf));
        } catch {}
      }
    } catch {}

    // 激活时记录已有文件 + 初始大小快照 (存量文件不触发·仅建立基准)
    const knownPbs = new Set();
    const pbSizes = new Map(); // f → 上次已知 size
    const pbLastGrowAt = new Map(); // f → 上次增长时间戳 (安静期检测)
    const pbLastTrigger = new Map(); // f → 上次触发时间戳 (每文件冷却)
    try {
      for (const f of fs.readdirSync(cascadePbDir)) {
        if (!f.endsWith(".pb")) continue;
        knownPbs.add(f);
        try {
          pbSizes.set(f, fs.statSync(path.join(cascadePbDir, f)).size);
        } catch {}
      }
    } catch {}
    log(
      "Layer 6 · 双信号[pb·new+pb·send] → " +
        cascadePbDir +
        " · 存量 " +
        knownPbs.size +
        " 个",
    );

    // 新对话队列 (pb·new 专用 · 顺序处理 · 保证每个新对话都切号)
    const _newConvQueue = [];
    let _queueRunning = false;
    async function _drainQueue() {
      if (_queueRunning) return;
      _queueRunning = true;
      while (_newConvQueue.length > 0) {
        const { f } = _newConvQueue.shift();
        for (
          let i = 0;
          i < 30 && (_switching || (_engine && _engine.rotating));
          i++
        ) {
          await new Promise((r) => setTimeout(r, 1000));
        }
        // v2.6.11 · 立即触发 (无防抖无强锁·_maybeTrigger 内 _switching 守卫足以)
        // pb·new 队列保留 3.5s gap·避同时多新对话造成切号抖动 (与 W%脉动 10s 周期协同)
        _maybeTrigger("L6→pb·new", f.slice(0, 8));
        await new Promise((r) => setTimeout(r, 3500));
      }
      _queueRunning = false;
    }

    // v2.6.9 道法自然 · 唯留 pb·new (新对话纯信号 · 1:1 精确)
    //   实证 v2.6.8: 4 个并行活 .pb 文件 (8bc7943c/b2165dd0/e9e73244/f9ebad5b)
    //     存量文件 settle 累积模型 = AI 流式段静默 ≠ 用户 click Send · 信号错位
    //     11min 实测 36 fired + 6 skip · 全部错触发 · 雪崩 9 倍率
    //   v2.6.9 损法: 删 _firePbSettle / pbSettle Map / settle 常量 / 存量增量分支
    //     (~150 行净减) · 大制无割 · 反者道之动
    //   留法: pb·new 唯一信号 · 用户开新对话 → 一新 .pb 文件 → 一切号
    const POLL_MS = 600;

    const timer = setInterval(() => {
      try {
        let hasNew = false;
        for (const f of fs.readdirSync(cascadePbDir)) {
          if (!f.endsWith(".pb")) continue;
          if (knownPbs.has(f)) continue; // v2.6.9: 存量文件不再监增量 (settle 错位本源)
          // ── 信号①: 新文件 = 新对话 → 立即入队切号 ──
          const fpath = path.join(cascadePbDir, f);
          knownPbs.add(f);
          try {
            const sz = fs.statSync(fpath).size;
            pbSizes.set(f, sz);
            if (sz < 64) continue; // Windsurf 预占位临时文件·跳过
          } catch {
            continue;
          }
          // v2.6.2 · 跨实例声明: 排他创建 · 第一到者触发 · 其余静默跳
          const _claimNew = path.join(L6_CLAIM_DIR, f + ".new");
          try {
            fs.writeFileSync(_claimNew, String(process.pid), { flag: "wx" });
          } catch {
            log("Layer 6 · pb·new: " + f.slice(0, 8) + " 已认领·跳");
            continue;
          }
          log(
            "Layer 6 · pb·new: " +
              f.slice(0, 12) +
              " [pid=" +
              process.pid +
              "]",
          );
          _newConvQueue.push({ f });
          hasNew = true;
        }
        if (hasNew) _drainQueue().catch(() => {});
      } catch {}
    }, POLL_MS);

    _layer6Stop = () => {
      clearInterval(timer);
    };
    if (context && context.subscriptions) {
      context.subscriptions.push({
        dispose: () => {
          try {
            if (_layer6Stop) _layer6Stop();
          } catch {}
          _layer6Stop = null;
        },
      });
    }
    log(
      "Layer 6 · watch[pb·new only · v2.6.9 损 settle] · " +
        POLL_MS +
        "ms · " +
        cascadePbDir,
    );
  } catch (e) {
    log("Layer 6 · install fail: " + (e.message || e));
  }
}

// ── WAL 边沿首发 (v2.6.11 · 备用信号源 · 真本源 W%脉动 已在 Engine._tick) ──
// state.vscdb-wal 在用户点击 Send 后 SQLite 同步写入 WAL 帧 (1-2 帧 ≈ 4-8KB)
//
// v2.6.11 修法 (道法自然·去芜存菁):
//   · 删 WAL_EDGE_MAX checkpoint 上限过滤 (实证 v2.6.10 9.5h walfr=0 杀真信号)
//   · 删 LOCK_MS bucket claim (perMessageMinIntervalMs 已删)
//   · WAL 仅作为 W%脉动信号的 backup (W% 主导·WAL 备用)
//   · 真本源迁至 Engine._tick 的 W%增量 (零中间噪音·后端真实计费)
//
// v2.6.9-v2.6.10 历史损法 (背景):
//   · 弃 settle 累积模型 (实证 v2.6.6-2.6.8 0 触发)
//   · 改首次增量边沿即 fire (WAL_EDGE_MIN ≥ 512B)
//   · v2.6.10 加 max filter 想拦 checkpoint·实证杀真信号·v2.6.11 删
function _installWalWatcher(context) {
  try {
    const gsDir = _resolveGlobalStorageDir(context);
    if (!gsDir) {
      log("WAL · skip · globalStorage 路径未解析");
      return null;
    }
    const walPath = path.join(gsDir, "state.vscdb-wal");
    let walSz = 0;
    try {
      walSz = fs.statSync(walPath).size;
    } catch {
      log("WAL · skip · state.vscdb-wal 不存在: " + walPath);
      return null;
    }

    // 道法自然 · 边沿首发参数
    const WAL_EDGE_MIN = Math.max(256, _cfg("walEdgeMinBytes", 512) | 0); // 单次 delta ≥ 此值即 fire (1 SQLite 帧最小 4KB·512B 即可捕捉部分写)
    const WAL_POLL_MS = Math.max(100, _cfg("walPollMs", 300) | 0);
    // v2.6.14 守二·守三 · WAL 同源冷 + 启动暖启
    const WAL_COOLDOWN_MS = Math.max(0, _cfg("walEdgeCooldownMs", 2000) | 0); // 同源最小间隔 (2s 避 4KB 帧连火)
    const WAL_WARMUP_MS = Math.max(0, _cfg("walWarmupMs", 5000) | 0); // 启动暖启 (5s 防 activate 首 stat 累积差引雪崩)
    const walInstalledAt = Date.now();
    let lastWalFireAt = 0;
    let walWarmupSkipCount = 0;
    let walCooldownSkipCount = 0;

    function _fireWalEdge(delta, totalSz) {
      // v2.6.14 守三 · 启动暖启窗 · 跳过首 WAL_WARMUP_MS 内之差 (cascade-server 流期累积)
      const sinceInstall = Date.now() - walInstalledAt;
      if (WAL_WARMUP_MS > 0 && sinceInstall < WAL_WARMUP_MS) {
        walWarmupSkipCount++;
        log(
          "WAL · edge·skip[warmup:" +
            sinceInstall +
            "ms<" +
            WAL_WARMUP_MS +
            "ms] +" +
            delta +
            "B (size=" +
            totalSz +
            ")",
        );
        return;
      }
      // v2.6.14 守二 · 同源最小间隔 · 避连续 4KB 帧连火 (log 噪削减)
      const sinceLastFire = Date.now() - lastWalFireAt;
      if (
        WAL_COOLDOWN_MS > 0 &&
        lastWalFireAt > 0 &&
        sinceLastFire < WAL_COOLDOWN_MS
      ) {
        walCooldownSkipCount++;
        log(
          "WAL · edge·skip[cooldown:" +
            sinceLastFire +
            "ms<" +
            WAL_COOLDOWN_MS +
            "ms] +" +
            delta +
            "B",
        );
        return;
      }
      lastWalFireAt = Date.now();
      log(
        "WAL · edge·fire: +" +
          delta +
          "B (size=" +
          totalSz +
          ") [pid=" +
          process.pid +
          "] → 切号",
      );
      // diag 记录 user send 真信号分布 (v2.6.14 加 warmup/cooldown 计)
      try {
        const diagP = path.join(WAM_DIR, "_per_msg_diag.json");
        const prev = fs.existsSync(diagP)
          ? JSON.parse(fs.readFileSync(diagP, "utf8"))
          : { hits: [], rotates: [] };
        prev.lastEdgeDelta = delta;
        prev.lastEdgeAt = Date.now();
        prev.walWarmupSkipCount = walWarmupSkipCount;
        prev.walCooldownSkipCount = walCooldownSkipCount;
        atomicWrite(diagP, JSON.stringify(prev, null, 2));
      } catch {}
      _maybeTrigger("L6→wal·edge", "+" + delta);
    }

    const timer = setInterval(() => {
      try {
        const newSz = fs.statSync(walPath).size;
        const delta = newSz - walSz;
        if (delta < 0) {
          // WAL checkpoint: 主 DB 吸收 WAL 后 WAL 缩小 · 仅更新 baseline
          walSz = newSz;
          return;
        }
        if (delta === 0) return;
        if (delta < WAL_EDGE_MIN) {
          // 太小 (SQLite 元数据微动) · 仅推 baseline · 不 fire
          walSz = newSz;
          return;
        }
        // v2.6.11 · 边沿首发 · 单次 delta ≥ MIN 即 fire (无 max·无累积·无 settle·无 bucket lock)
        walSz = newSz;
        _fireWalEdge(delta, newSz);
      } catch {}
    }, WAL_POLL_MS);

    log(
      "WAL watcher v2.6.14·守二守三·备用信号 · poll=" +
        WAL_POLL_MS +
        "ms · edge≥" +
        WAL_EDGE_MIN +
        "B · 同源冷=" +
        WAL_COOLDOWN_MS +
        "ms · 暖启=" +
        WAL_WARMUP_MS +
        "ms · " +
        walPath,
    );
    return timer;
  } catch (e) {
    log("WAL watcher install fail: " + (e.message || e));
    return null;
  }
}

// 大窗口面板 (本源 wam.openEditor 同款 · createWebviewPanel)
function openEditorPanel() {
  if (_editorPanel) {
    try {
      _editorPanel.reveal(vscode.ViewColumn.Active, false);
    } catch {}
    return _editorPanel;
  }
  _editorPanel = vscode.window.createWebviewPanel(
    "wam.editor",
    "WAM 切号管理",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: _ctx ? [_ctx.extensionUri] : [],
    },
  );
  _editorPanel.webview.html = buildHtml();
  _editorPanel.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg));
  _editorPanel.onDidDispose(() => {
    _editorPanel = null;
  });
  return _editorPanel;
}

class WamViewProvider {
  constructor() {
    this._view = null;
  }
  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: _ctx ? [_ctx.extensionUri] : [],
    };
    webviewView.webview.html = buildHtml();
    webviewView.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg));
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.refresh();
    });
  }
  refresh() {
    if (this._view && this._view.visible) this._view.webview.html = buildHtml();
  }
}

// v2.5.4 · 软编码判据 · 兵无常势·唯变所适
//   后端 plan/tier 未来可能变体: "Trial" / "Team Trial" / "Devin Trial" / "Free Trial"
//   硬编 `h.plan === "Trial"` 会漏识 · 改用 regex /trial/i 兼容所有变体
//   同兼容历史 tier 字符串 "TEAMS_TIER_DEVIN_TRIAL" (parsePlan 已展开为 "Trial" · 此为防御)
function _isTrialLike(h) {
  if (!h) return false;
  const p = h.plan;
  if (typeof p !== "string" || !p) return false;
  return /trial/i.test(p);
}

// v2.5.3 · 道法自然 · 每行恒显剩余有效期 (5 态全显 · 反者道之动)
//   旧法之患: 未验号 expTag="" · 行间高度抖动 · 用户不知 trial 到期
//   实证 (2026-05-04): windsurf API 结构 → planEnd 嵌在 userStatus.planStatus.planEnd
//     后端曾一度 postAuth 401 · state.json 里残留大量 checked=true 但 planEnd=0 · plan="Trial" 的脏数据
//   新法 5 态:
//     未验 (!checked):                      "?天" 灰 · tooltip 提示点🔍
//     有效 (planEnd>now):                   "N天" + tooltip 秒级到期/剩余
//     过期 (planEnd>0 且 planEnd<=now):     "已过期" 红 · 只按真实时间判定
//     Trial 脏数据 (Trial 且 planEnd=0):    "Trial?" 黄 · tooltip 提示重验
//     永久 (其它 · planEnd=0 已验):         "∞" 灰 · Pro/Free 或后端缺字段
function _buildExpTag(h) {
  if (!h || !h.checked) {
    return '<span class="days" style="color:#555" title="未验·点🔍获取剩余有效期">?天</span>';
  }
  const now = Date.now();
  const planEnd = _parseTimeMs(h.planEnd);
  const daysLeft =
    planEnd > 0 ? _calcDaysLeft(planEnd, now) : Number(h.daysLeft) || 0;
  if (planEnd > now) {
    const ec = daysLeft <= 2 ? "#f44" : daysLeft <= 5 ? "#ce9178" : "#4ec9b0";
    const dStr = _formatExpiryTime(planEnd);
    const remain = _formatDurationMs(planEnd - now);
    return `<span class="days" style="color:${ec}" title="到期: ${_esc(dStr)} · 剩 ${daysLeft} 天 · ${_esc(remain)}">${daysLeft}天</span>`;
  }
  if (planEnd > 0) {
    const dStr = _formatExpiryTime(planEnd);
    const ago = _formatDurationMs(now - planEnd);
    return `<span class="days" style="color:#f44" title="Trial 已过期 (${_esc(dStr)} · 已过 ${_esc(ago)})">已过期</span>`;
  }
  // planEnd==0 且 checked · 判 Trial 脏数据还是真 Pro 永久
  if (_isTrialLike(h)) {
    return '<span class="days" style="color:#d4c05a" title="Trial 剩余天数未知·点🔍重新验证">Trial?</span>';
  }
  return '<span class="days" style="color:#888" title="无 Plan 到期·Pro 永久或字段缺">∞</span>';
}

function buildHtml() {
  if (!_store)
    return `<html><body style="color:#888;font:12px sans-serif;padding:12px">WAM 初始化中...</body></html>`;
  const store = _store,
    stats = store.getStats(),
    accounts = store.accounts,
    activeI = store.activeIdx;
  const autoOn = _cfg("autoRotate", true);
  let rows = "";
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i],
      h = store.getHealth(a.email);
    const isActive = i === activeI;
    const isBanned = store.isBanned(a.email);
    const banInfo = isBanned ? store.blacklist[a.email.toLowerCase()] : null;
    const banSec = banInfo
      ? Math.max(0, Math.round((banInfo.until - Date.now()) / 1000))
      : 0;
    // v2.3.0 使用中🔒 · active 号不显 (本就在上) · 仅其他锁中号显
    const isInUse = !isActive && store.isInUse(a.email);
    const inUseSec = isInUse
      ? Math.ceil(store.inUseRemainingMs(a.email) / 1000)
      : 0;
    const localPart = a.email.replace(/@.*/, "");
    const domain = a.email.split("@")[1] || "";
    const domainBadge = domain.endsWith(".shop")
      ? "shop"
      : /yahoo/i.test(domain)
        ? "yh"
        : /gmail/i.test(domain)
          ? "gm"
          : /outlook|hotmail|live/i.test(domain)
            ? "ms"
            : "o";
    const emailShort =
      localPart.substring(0, 14) + (localPart.length > 14 ? ".." : "");
    const isU = !h.checked;
    const dPct = isU ? 0 : Math.max(0, Math.min(100, Math.round(h.daily)));
    const wPct = isU ? 0 : Math.max(0, Math.min(100, Math.round(h.weekly)));
    const dC = isU
      ? "#555"
      : dPct <= 5
        ? "#f44"
        : dPct <= 30
          ? "#ce9178"
          : "#4ec9b0";
    const wC = isU
      ? "#555"
      : wPct <= 5
        ? "#f44"
        : wPct <= 30
          ? "#ce9178"
          : "#4ec9b0";
    const liveTag = h.hasSnap
      ? '<span class="live-dot" title="实时"></span>'
      : "";
    const ucTag = isU ? '<span class="uc">未验</span>' : "";
    const bnTag = isBanned
      ? `<span class="bn" title="${_esc(banInfo.reason || "")}">黑${banSec}s</span>`
      : "";
    // v2.3.0 使用中🔒 标 (与 黑标 代色区 · 蓝调)
    const iuTag = isInUse
      ? `<span class="iu" title="v2.3.0 使用中锁·自动切号跳·手动不受影响">🔒${inUseSec}s</span>`
      : "";
    const planTag =
      h.plan && !_isTrialLike(h)
        ? `<span class="plan-tag">${_esc(h.plan)}</span>`
        : "";
    const claudeOk = isClaudeAvailable(h);
    const expTag = _buildExpTag(h);
    const claudeTag =
      !claudeOk && h.checked
        ? '<span class="days" style="color:#f44;font-weight:700" title="Claude($$$)模型不可用·仅免费模型">⊘Claude</span>'
        : "";
    const freshTag =
      h.staleMin >= 0 && h.staleMin <= 3
        ? '<span class="fresh">&#8226;</span>'
        : "";
    // v2.4.0 · stale 标记 · 不骗人 · h.staleHours 已含值
    //   知止可以不殆: endpoint 挂时所有号都陈年 · 每行显 stale 无意义
    //   改策略: endpoint dead 时不显单行 stale (顶部红条已告) · 只在少数号陈年时显
    let staleTag = "";
    let isStaleRow = false;
    const endpointDead = _quotaEndpointDead();
    if (!endpointDead && h.checked) {
      if (h.staleHours >= 48) {
        staleTag = `<span class="stale-old" title="数据极陈年 · ${h.staleHours} 小时前 · 用 wam.refreshAll 更新">陈年</span>`;
        isStaleRow = true;
      } else if (h.staleHours >= 12) {
        staleTag = `<span class="stale" title="数据已老 · ${h.staleHours} 小时前">${h.staleHours}h前</span>`;
        isStaleRow = true;
      }
    }
    rows += `
    <div class="row${isActive ? " act" : ""}${isBanned ? " banned" : ""}${isInUse ? " inuse" : ""}${!claudeOk && h.checked ? " expired-row" : ""}${isStaleRow ? " is-stale" : ""}" data-i="${i}" data-email="${_esc(a.email.toLowerCase())}">
      <input type="checkbox" class="chk" data-i="${i}" />
      <span class="dm ${domainBadge}" title="${_esc(domain)}">${domainBadge}</span>
      <span class="em" title="${_esc(a.email)}">${_esc(emailShort)}</span>
      ${expTag}${planTag}${h.checked && h.overageDollars > 0 ? (h.staleHours >= 6 ? `<span class="eua-stale" title="Extra Usage $${h.overageDollars.toFixed(0)} · 数据${h.staleHours}h前(可能已消耗·建议重验)">$${Math.round(h.overageDollars)}?</span>` : `<span class="eua" title="Extra Usage Active · $${h.overageDollars.toFixed(0)} · Cascade quota=0时仍完全可用${h.staleHours >= 1 ? " · " + h.staleHours + "h前验" : ""}">$${Math.round(h.overageDollars)}</span>`) : ""}${h.checked && !h.overageDollars ? `<span class="eua0" title="已验 · 无Extra Usage余额">$0</span>` : ""} ${claudeTag}${bnTag}${iuTag}${staleTag}${freshTag}${liveTag}${ucTag}
      <span class="qt">
        <span class="mb"><span class="mf" style="width:${dPct}%;background:${dC}"></span></span>
        <span class="ql" style="color:${dC}">${isU ? "D?" : "D" + dPct}</span>
        <span class="mb"><span class="mf" style="width:${isU ? 0 : wPct}%;background:${wC}"></span></span>
        <span class="ql" style="color:${wC}">${isU ? "W?" : "W" + wPct}</span>
      </span>
      <span class="acts">
        <button class="b sk" onclick="sk(${i})" data-locked="${a.skipAutoSwitch ? "1" : "0"}" title="${a.skipAutoSwitch ? "已锁定·自动切号跳过此号(点击解锁)" : "锁定·防止自动切号选到此号"}" style="opacity:${a.skipAutoSwitch ? "1;color:#f0c674" : ".4"}">${a.skipAutoSwitch ? "&#128274;" : "&#128275;"}</button>
        <button class="b sw" onclick="sw(${i})" title="手动切换(无限制)"${isBanned ? " disabled" : ""}${_wamMode === "official" ? ' disabled style="opacity:.3;cursor:not-allowed"' : ""}>&#9889;</button>
        <button class="b vf" onclick="vf(${i})" title="验证">&#128270;</button>
        <button class="b cp" onclick="cp(${i})" title="复制">&#128203;</button>
        <button class="b rm" onclick="rm(${i})" title="删除">&times;</button>
      </span>
    </div>`;
  }
  const cc = stats.checkedCount;
  const poolPct =
    cc > 0 ? Math.round((stats.drought ? stats.totalD : stats.totalW) / cc) : 0;
  const poolColor =
    poolPct >= 60 ? "#4ec9b0" : poolPct >= 30 ? "#ce9178" : "#f44";
  const monitorBar = `<div class="monitor-bar"><span class="mon-dot${autoOn ? "" : " off"}"></span><span class="mon-stat">D重置${stats.hrsToDaily.toFixed(1)}h</span><span class="mon-stat">W重置${stats.hrsToWeekly.toFixed(1)}h</span></div>`;
  let activeHtml =
    '<div class="act-info empty">未选择活跃账号 · 点击下方任意 ⚡ 即可登录</div>';
  if (activeI >= 0 && accounts[activeI]) {
    const aa = accounts[activeI],
      ah = store.getHealth(aa.email);
    const liveD = Math.round(ah.daily),
      liveW = Math.round(ah.weekly);
    const isDrought = stats.drought;
    const effQuota = isDrought ? liveD : Math.min(liveD, liveW);
    const ec =
      ah.checked && effQuota < 5
        ? "var(--red)"
        : ah.checked && effQuota < 30
          ? "var(--orange)"
          : "var(--green)";
    const switchHint =
      ah.checked && effQuota < 5
        ? isDrought
          ? ' · <b style="color:var(--orange)">干旱·D耗尽即切</b>'
          : ' · <b style="color:var(--red)">即将切号</b>'
        : isDrought
          ? ' · <span style="color:#d29922;font-size:9px">[干旱·只看D]</span>'
          : "";
    const activeClaudeOk = isClaudeAvailable(ah);
    const activeClaudeTag = !activeClaudeOk
      ? ' <span style="color:var(--red);font-weight:700">⊘Claude不可用</span>'
      : "";
    // v2.4.13 · planEnd=0 (Trial proto3 omit) 时 fallback 显 weekly 重置倒计时
    let planExpiryTag = "";
    if (ah.planEnd > Date.now()) {
      const ec =
        ah.daysLeft <= 2
          ? "var(--red)"
          : ah.daysLeft <= 5
            ? "var(--orange)"
            : "var(--green)";
      planExpiryTag = ` <span style="color:${ec}" title="到期: ${_esc(_formatExpiryTime(ah.planEnd))} · 剩 ${ah.daysLeft} 天 · ${_esc(_formatDurationMs(ah.planEnd - Date.now()))}">${ah.daysLeft}天</span>`;
    } else if (ah.planEnd > 0) {
      planExpiryTag = ` <span style="color:var(--red)" title="到期: ${_esc(_formatExpiryTime(ah.planEnd))}">已过期</span>`;
    } else if (ah.weeklyResetAt && ah.weeklyResetAt > Date.now()) {
      // Trial 号无 planEnd · 用 weeklyResetAt 倒计时作有效期提示
      const hrs = Math.max(
        0,
        Math.round((ah.weeklyResetAt - Date.now()) / 3600000),
      );
      const days = Math.floor(hrs / 24);
      const tag = days > 0 ? `~${days}天` : `~${hrs}h`;
      planExpiryTag = ` <span style="color:#9cdcfe" title="W 重置倒计时 · Trial 无 planEnd">${tag}</span>`;
    }
    const switchInfo = _lastSwitchMs > 0 ? " · " + _lastSwitchMs + "ms" : "";
    const switchAge =
      store.lastRotateAt > 0
        ? Math.round((Date.now() - store.lastRotateAt) / 60000)
        : 0;
    const switchAgeStr = switchAge > 0 ? switchAge + "min前切" : "";
    activeHtml = `<div class="act-info"><b>当前:</b> ${_esc(aa.email)}${ah.plan ? `<span class="tag">${_esc(ah.plan)}</span>` : ""}${planExpiryTag}${activeClaudeTag}<span style="color:${ec}">D${liveD}%·W${liveW}%</span>${switchHint}<br><small>token: ${_esc(store.activeTokenShort || "-")} · 路${_esc(store.lastInjectPath || "-")}${switchInfo} · ${ah.staleMin >= 0 ? ah.staleMin + "min前采样" : "无快照"}${switchAgeStr ? " · " + switchAgeStr : ""}</small></div>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; worker-src 'self' blob:;">
<style>
:root{--bg:var(--vscode-editor-background);--fg:var(--vscode-editor-foreground);--border:var(--vscode-panel-border,#2d2d2d);--input-bg:var(--vscode-input-background,#1e1e1e);--input-border:var(--vscode-input-border,#3c3c3c);--btn:var(--vscode-button-background,#0e639c);--btn-h:var(--vscode-button-hoverBackground,#1177bb);--green:#4ec9b0;--orange:#ce9178;--red:#f44;--blue:#9cdcfe}
*{margin:0;padding:0;box-sizing:border-box}
body{font:12px/1.5 -apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--fg);padding:6px 8px;overflow-x:hidden}
.hd{margin-bottom:8px}
.pool-bar{height:5px;background:#252525;border-radius:3px;margin:6px 0;overflow:hidden}
.pool-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,${poolColor}88,${poolColor});transition:width .4s}
.st{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:#777;margin:4px 0}
.st b{color:#ccc}.st .ex{color:var(--red)}
.act-info{background:#264f7833;border-left:3px solid var(--blue);padding:4px 8px;margin:6px 0;font-size:11px;color:var(--blue);border-radius:0 4px 4px 0}
.act-info.empty{color:#777;border-left-color:#555;background:#1a1a1a}
.act-info b{color:var(--blue)}
.act-info .tag{background:#264f78;color:var(--blue);padding:1px 6px;border-radius:3px;font-size:10px;margin-left:4px}
.add-section{margin:6px 0;border:1px solid var(--border);border-radius:6px;overflow:hidden}
.add-header{background:#1a1a1a;padding:4px 8px;font-size:11px;color:#888;cursor:pointer;display:flex;justify-content:space-between}
.add-body{padding:6px 8px;display:none}.add-body.open{display:block}
.add-body textarea{width:100%;min-height:80px;background:var(--input-bg);border:1px solid var(--input-border);color:#ccc;padding:6px 8px;border-radius:4px;font-size:11px;outline:none;resize:vertical;font-family:monospace}
.add-body .add-actions{display:flex;gap:4px;margin-top:4px}
.add-body .add-actions button{background:var(--btn);color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px}
.add-body .add-hint{font-size:10px;color:#555;margin-top:4px}
.sec{display:flex;justify-content:space-between;align-items:center;color:#777;font-size:11px;margin:8px 0 3px;padding-bottom:3px;border-bottom:1px solid var(--border)}
.row{display:flex;align-items:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;gap:4px;user-select:none}
.row:hover{background:#2a2d2e}
.row.sel{background:#1f3a45;box-shadow:inset 2px 0 0 var(--blue)}
.row.sel:hover{background:#254655}
.row.act{background:#264f7844;border-left:2px solid var(--blue)}
.row.banned{opacity:.5;background:#2a1a1a}
.row.inuse{background:#1a2a3a;border-left:2px solid #6cb3ff66}
.iu{font-size:9px;background:#1a3a5a;color:#6cb3ff;padding:0 4px;border-radius:3px;font-weight:600}
.eua{font-size:9px;background:#1a3a1a;color:#4ec9b0;padding:0 4px;border-radius:3px;font-weight:700;letter-spacing:.2px;flex-shrink:0}
.eua0{font-size:9px;background:#1e1e1e;color:#444;padding:0 4px;border-radius:3px;font-weight:600;letter-spacing:.2px;flex-shrink:0;border:1px solid #2a2a2a}
.eua-stale{font-size:9px;background:#2a1e00;color:#ce9178;padding:0 4px;border-radius:3px;font-weight:700;letter-spacing:.2px;flex-shrink:0;border:1px solid #4a3a10}
.row.expired-row{opacity:.55;background:#1a1515}
.row.switching{opacity:.6;pointer-events:none;position:relative}
.row.switching::after{content:'⏳';position:absolute;right:6px;animation:pulse 1s infinite}
.row.verifying{opacity:.7}
.row.verifying .b.vf{animation:spin .8s linear infinite}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.b.clicked{transform:scale(0.85);transition:transform .1s}
.toast.ok{background:#1a3a1a;color:var(--green);border:1px solid #2a5a2a}
.toast.fail{background:#3a1a1a;color:var(--red);border:1px solid #5a2a2a}
.chk{width:14px;height:14px;cursor:pointer;flex-shrink:0}
.dm{width:24px;height:14px;border-radius:2px;font-size:9px;font-weight:700;text-align:center;line-height:14px;flex-shrink:0;color:#aaa}
.dm.shop{background:#553399;color:#cdb}
.dm.yh{background:#4a1564;color:#cce}
.dm.gm{background:#3a3a3a;color:#9cdcfe}
.dm.ms{background:#1a3a5a;color:#9cf}
.dm.o{background:#333;color:#999}
.em{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.uc{font-size:9px;background:#333;color:#888;padding:0 4px;border-radius:3px}
.bn{font-size:9px;background:#5a1d1d;color:#f88;padding:0 4px;border-radius:3px}
.plan-tag{font-size:9px;background:#1a3a1a;color:var(--blue);padding:0 4px;border-radius:3px}
.days{font-size:9px;color:#666;min-width:32px;display:inline-block;text-align:center;flex-shrink:0}
.qt{display:flex;align-items:center;gap:2px;flex-shrink:0;min-width:100px}
.mb{width:18px;height:4px;background:#252525;border-radius:2px;overflow:hidden}
.mf{display:block;height:100%}
.ql{font-size:10px;font-weight:600;width:26px;text-align:right}
.acts{display:flex;gap:2px}
.b{width:20px;height:20px;border:none;border-radius:3px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0}
.b.sw{background:var(--btn);color:#fff}.b.sw:hover{background:var(--btn-h)}
.b.sw:disabled{opacity:.3;cursor:not-allowed}
.b.sk{background:transparent;color:#666;font-size:12px}.b.sk:hover{color:#f0c674}
.b.vf,.b.cp{background:#333;color:var(--blue)}.b.vf:hover,.b.cp:hover{background:#444}
.b.rm{background:transparent;color:#555;font-size:14px}.b.rm:hover{color:var(--red)}
.toast{position:fixed;bottom:8px;left:8px;right:8px;background:#264f78;color:var(--blue);padding:6px 10px;border-radius:4px;font-size:11px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:99}
.toast.show{opacity:1}
.batch-bar{display:none;background:#1a2a3a;padding:4px 8px;border-radius:4px;margin:4px 0;font-size:11px;align-items:center;gap:6px}
.batch-bar.visible{display:flex}
.batch-bar button{background:#5a1d1d;color:var(--red);border:none;padding:2px 10px;border-radius:3px;cursor:pointer;font-size:11px}
.monitor-bar{display:flex;align-items:center;gap:6px;background:#1a2a1a;border:1px solid #2a3a2a;border-radius:4px;padding:3px 8px;margin:4px 0;font-size:10px;color:var(--blue);flex-wrap:wrap}
.mon-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
.mon-dot.off{background:#666;animation:none}
.mon-stat{padding:0 3px}
.mode-sw{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#666;float:right}
.mode-sw button{background:transparent;color:#555;border:1px solid #333;padding:1px 6px;border-radius:3px;cursor:pointer;font-size:10px;transition:all .15s}
.mode-sw button:hover{color:var(--blue);border-color:#555}
.mode-sw button.on{color:var(--green);border-color:#2a4a2a}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.live-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--green);margin:0 2px;animation:pulse 2s infinite}
.fresh{color:var(--green);font-size:14px}
/* v2.4.0 · stale 陈年标记 · UI 不骗人 */
.stale{font-size:9px;color:#888;background:#2a2a1a;padding:0 4px;border-radius:3px;border:1px solid #4a4a2a}
.stale-old{font-size:9px;color:#a08;background:#2a1a2a;padding:0 4px;border-radius:3px;border:1px solid #4a2a4a}
.row.is-stale{opacity:.65}
.row.is-stale .qt .ql{color:#888 !important}
.endpoint-warn{background:#2a1a1a;border:1px solid #4a2a2a;border-radius:4px;padding:4px 10px;margin:4px 0;font-size:11px;color:#f88}
.endpoint-warn b{color:#f88}
.row.quota-flash{animation:qflash .6s}
@keyframes qflash{0%{background:#5a3a0a}100%{background:transparent}}
.footer{margin-top:8px;padding-top:6px;border-top:1px solid var(--border);font-size:10px;color:#555;text-align:center;word-break:break-all}
.footer .v{color:var(--blue)}
/* v3.4.0 · 对话追踪区域样式 */
.conv-section{margin:4px 0;border:1px solid var(--border);border-radius:4px;overflow:hidden}
.conv-header{display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:#1a1a2e;cursor:pointer;font-size:11px;user-select:none}
.conv-header:hover{background:#22223a}
.conv-body{padding:4px 8px;font-size:11px;overflow:hidden;max-height:600px;transition:max-height 0.18s ease,padding 0.18s ease,opacity 0.12s}
.conv-body.collapsed{max-height:0!important;padding-top:0!important;padding-bottom:0!important;overflow:hidden;opacity:0}
.conv-empty{color:#666;font-style:italic;padding:4px 0}
.conv-actions{display:flex;gap:4px;margin:6px 0 2px}
.conv-btn{padding:2px 8px;font-size:10px;background:#2a3a4a;color:#9cdcfe;border:1px solid #3a4a5a;border-radius:3px;cursor:pointer}
.conv-btn:hover{background:#3a4a5a}
.conv-btn-s{background:#2a2a3a;color:#bbb;border-color:#3a3a4a}
.conv-backup-path{font-size:9px;color:#7a9ec2;padding:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace}
.cv-summary{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px}
.cv-summary b{margin-left:2px}
.cv-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.cv-dot.ok{background:#4ec9b0}
.cv-dot.stuck{background:#f44;animation:cvpulse 1s infinite}
.cv-dot.off{background:#555}
@keyframes cvpulse{0%,100%{opacity:1}50%{opacity:.3}}
.cv-stuck-n{color:#f44}
.cv-err-n{color:#f88}
.cv-current{padding:3px 0;border-bottom:1px solid #2a2a2a}
.cv-streaming{color:#4ec9b0;font-size:10px}
.cv-completed{color:#888;font-size:10px}
.cv-other{color:#ce9178;font-size:10px}
.cv-stuck-list{padding:2px 0}
.cv-stuck-item{padding:2px 4px;border-radius:2px;margin:2px 0;display:flex;align-items:center;gap:4px;font-size:10px}
.cv-dead{background:#3a1a1a;border-left:2px solid #f44}
.cv-crit{background:#3a2a1a;border-left:2px solid #f88}
.cv-warn{background:#2a2a1a;border-left:2px solid #eab308}
.cv-level{font-weight:700;font-size:9px;min-width:50px}
.cv-dead .cv-level{color:#f44}
.cv-crit .cv-level{color:#f88}
.cv-warn .cv-level{color:#eab308}
.cv-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cv-stale{color:#ce9178;flex-shrink:0}
.cv-badge{background:#f44;color:#fff;font-size:9px;padding:0 4px;border-radius:8px;margin-left:4px;font-weight:700}
.cv-size{color:#888;flex-shrink:0}
/* v3.7.5 · 对话关闭按钮 · 反者道之动 */
.cv-close{background:none;border:none;color:#444;cursor:pointer;font-size:10px;padding:0 3px;line-height:1;flex-shrink:0;margin-left:auto;border-radius:2px;transition:color 0.15s,background 0.15s}
.cv-close:hover{color:#f66;background:#4a1a1a}
</style></head><body>
<div class="hd">
<div class="st"><span style="color:${poolColor};font-weight:700">D${stats.totalD} W${stats.totalW}</span><span><b>${stats.available}</b>可用</span>${stats.exhausted > 0 ? `<span class="ex"><b>${stats.exhausted}</b>耗尽</span>` : ""}<span><b>${stats.pwCount}</b>号</span>${stats.unchecked > 0 ? `<span style="color:var(--blue)"><b>${stats.unchecked}</b>未验</span>` : ""}${stats.banned > 0 ? `<span style="color:var(--red)"><b>${stats.banned}</b>黑</span>` : ""}${stats.inUse > 0 ? `<span style="color:#6cb3ff" title="v2.3.0 使用中锁·120s后可再选"><b>${stats.inUse}</b>🔒</span>` : ""}${stats.checkedCount > 0 ? `<span style="color:${stats.overageAccounts > 0 ? "#4ec9b0" : "#555"};font-size:10px" title="Extra Usage: ${stats.overageAccounts}已激活 / ${stats.checkedCount}已验 · $${Math.round(stats.totalOverageDollars)}"><b>${stats.overageAccounts}/${stats.checkedCount}</b>激活${stats.overageAccounts > 0 ? " $" + Math.round(stats.totalOverageDollars) : ""}</span>` : ""}<span class="mode-sw"><button class="${_wamMode === "wam" ? "on" : ""}" onclick="setMode('wam')" title="WAM 自动切号">WAM</button><button class="${_wamMode === "official" ? "on" : ""}" onclick="setMode('official')" title="官方登录·停引擎">官方</button></span></div>
<div class="pool-bar"><div class="pool-fill" style="width:${poolPct}%"></div></div>
${activeHtml}${monitorBar}
${_getConvTrackingHtml()}
${_wamMode === "official" ? '<div style="background:#2a1a1a;border:1px solid #4a2a2a;border-radius:4px;padding:6px 10px;margin:4px 0;font-size:11px;color:#f87171"><b>&#128274; 官方登录模式</b><br>WAM 引擎已停 (扫描/切号/心跳)<br>切回 WAM 模式可恢复自动轮转</div>' : ""}
${stats.drought ? '<div style="background:#2a2a1a;border:1px solid #4a4a2a;border-radius:4px;padding:4px 10px;margin:4px 0;font-size:11px;color:#eab308">&#127964;&#65039; <b>Weekly 干旱</b> 全池W耗尽·D重置 ' + stats.hrsToDaily.toFixed(1) + "h后 · 自动换号仅看D</div>" : ""}
${_verifyAllInProgress ? '<div style="background:#1a2a3a;border:1px solid #2a3a5a;border-radius:4px;padding:4px 10px;margin:4px 0;font-size:11px;color:#9cdcfe">&#9203; <b>正在批量验证</b> · 见 Output 实时进度</div>' : ""}
${_quotaEndpointDead() ? `<div class="endpoint-warn">&#9888;&#65039; <b>GetPlanStatus endpoint 已挂</b> &middot; 连续 ${_quotaEndpointHealth.consecutive401} 次 401 invalid token &middot; 服务端可能已迁移 &middot; quota% 数据保持陈年 &middot; <code>切号决策仍然工作</code> (rate-limit 拦截 + per-msg 切号 + in-use 锁)</div>` : ""}
</div>
<div class="batch-bar" id="batchBar"><span>已选 <b id="batchCount">0</b> 个 · 点选中行 🔒/📋/× 批量</span><button onclick="batchDelete()">批量删除</button><button onclick="clearSelection()" style="background:#333;color:var(--blue)">取消</button></div>
<div class="add-section">
<div class="add-header" onclick="toggleAdd()"><span>&#43; 添加账号</span><span id="addArrow">${_uiAddOpen ? "&#9650;" : "&#9660;"}</span></div>
<div class="add-body${_uiAddOpen ? " open" : ""}" id="addBody">
<textarea id="addInput" placeholder="万法识号 v2.7 · 任意格式·一文混万法·自动识号：&#10;email password   /   email:password   /   email----password&#10;email|password   /   email,password   /   email\tpassword&#10;邮箱:x@y.com / 账号:x / 卡号1:x   (多行标签·支持数字编号·全角:也行)&#10;密码:abc123 / 卡密1:abc / 口令:abc   (含@亦无碍·守一不退)&#10;{&quot;email&quot;:&quot;x&quot;,&quot;password&quot;:&quot;y&quot;}   (JSON)&#10;devin-session-token$xxx / eyJ…JWT / auth1_…   (直接登录)&#10;微信发货消息原文亦可粘 (自动剥(去掉点)·跳订单/账号管理器)"></textarea>
<div class="add-actions"><button onclick="doAdd()">添加</button><button onclick="copyAll()" style="background:#333;color:var(--blue);margin-left:auto">&#128203; 一键导出</button></div>
<div class="add-hint">万法识号 v2.7 · 守道反者 · 卡号/卡密/微信发货/含@密码 皆通 · 原始 token 自动直登 · 重复跳过</div>
</div></div>
<div class="sec"><span>&#9660; 账号列表 (${stats.pwCount})</span></div>
<div id="list">${rows}</div>
<div class="footer">WAM <span class="v">v${VERSION}</span><br>${_esc(store.accountsSource || "")}</div>
<div class="toast" id="toast"></div>
<script>
const vscode = acquireVsCodeApi();
function send(t,i){vscode.postMessage({type:t,index:i});}
function _clickFb(e){if(!e||!e.target)return;const b=e.target.closest('.b');if(b){b.classList.add('clicked');setTimeout(()=>b.classList.remove('clicked'),150);}}
function _checked(){return [...document.querySelectorAll('.chk:checked')];}
function _selIx(){return _checked().map(c=>parseInt(c.dataset.i)).filter(Number.isFinite);}
function _rowOf(i){return document.querySelector('.row[data-i="'+i+'"]');}
function _chkOf(i){const r=_rowOf(i);return r&&r.querySelector('.chk');}
function _selectedFor(i){const xs=_selIx();return xs.includes(i)&&xs.length>1?xs:[i];}
function _setRowSel(i,v){const c=_chkOf(i);if(!c)return;c.checked=!!v;const r=c.closest('.row');if(r)r.classList.toggle('sel',!!v);}
function _applyRange(a,b,v){const lo=Math.min(a,b),hi=Math.max(a,b);for(let j=lo;j<=hi;j++)_setRowSel(j,v);}
function _refreshSelClasses(){document.querySelectorAll('.row').forEach(r=>{const c=r.querySelector('.chk');r.classList.toggle('sel',!!(c&&c.checked));});}
// v3.11.2 · 多选持久化 — 反者道之动 · 全量重建不夺选择
//   以 email(行 data-email) 为锚 · 重建后按 email 复位 checked + .sel
//   根治 broadcastUI 全量 webview.html 重建导致的"刚选完几秒被弹回"
function _persistSel(){try{const st=vscode.getState()||{};const emails=[...document.querySelectorAll('.chk:checked')].map(c=>{const r=c.closest('.row');return r&&r.dataset.email||'';}).filter(Boolean);vscode.setState({...st,selEmails:emails,selTs:Date.now()});}catch(e){}}
function _restoreSel(){try{const st=vscode.getState()||{};const arr=Array.isArray(st.selEmails)?st.selEmails:[];if(!arr.length)return;const ttl=600000;if(st.selTs&&Date.now()-st.selTs>ttl){vscode.setState({...st,selEmails:[],selTs:0});return;}const set=new Set(arr);document.querySelectorAll('.row').forEach(r=>{const em=(r.dataset.email||'').toLowerCase();if(em&&set.has(em)){const c=r.querySelector('.chk');if(c){c.checked=true;r.classList.add('sel');}}});}catch(e){}}
let _lastSel=-1,_dragSel=false,_dragVal=false;
function sw(i){_clickFb(event);send('switch',i);}
function sk(i){_clickFb(event);const b=event&&event.target&&event.target.closest('.sk');const locked=!(b&&b.dataset.locked==='1');vscode.postMessage({type:'setSkipBatch',indices:_selectedFor(i),locked:locked});}
function vf(i){_clickFb(event);send('verify',i);}
function cp(i){_clickFb(event);const ix=_selectedFor(i);vscode.postMessage({type:ix.length>1?'copyAccounts':'copyAccount',index:i,indices:ix});}
function rm(i){_clickFb(event);const ix=_selectedFor(i);if(ix.length>1)vscode.postMessage({type:'removeBatch',indices:ix});else send('remove',i);}
function copyAll(){vscode.postMessage({type:'copyAllAccounts'});}
function setMode(m){vscode.postMessage({type:'setMode',mode:m});}
function toggleConv(){const b=document.getElementById('convBody');if(!b)return;b.classList.toggle('collapsed');const arr=document.getElementById('convArrow');const ic=b.classList.contains('collapsed');if(arr)arr.textContent=ic?'\u25BC':'\u25B2';try{localStorage.setItem('dao-conv-collapsed',ic?'1':'0');}catch(e){}}
function doSetBackupDir(){vscode.postMessage({type:'selectBackupDir'});}
// v3.7.5+3.7.6 · 对话手动关闭 · 反者道之动 · 即时本地消除+持久化
function dismissConv(uuid){if(!uuid)return;const btn=document.querySelector('.cv-close[data-uuid="'+uuid+'"]');if(btn){const item=btn.closest('.cv-stuck-item');if(item)item.remove();}vscode.postMessage({type:'dismissConv',uuid:uuid});}
function toggleAdd(){const b=document.getElementById('addBody');b.classList.toggle('open');const isOpen=b.classList.contains('open');document.getElementById('addArrow').textContent=isOpen?'\\u25B2':'\\u25BC';const s=vscode.getState()||{};vscode.setState({...s,addOpen:isOpen});vscode.postMessage({type:'setAddOpen',open:isOpen});}
function doAdd(){const ta=document.getElementById('addInput');const t=ta.value.trim();if(!t)return;vscode.postMessage({type:'addBatch',text:t});ta.value='';const s=vscode.getState()||{};vscode.setState({...s,addText:''});}
function showToast(m,cls){const t=document.getElementById('toast');t.textContent=m;t.className='toast show'+(cls?' '+cls:'');setTimeout(()=>{t.className='toast';},2200);}
function updateBatchBar(){_refreshSelClasses();const c=_checked();document.getElementById('batchCount').textContent=c.length;document.getElementById('batchBar').classList.toggle('visible',c.length>0);_persistSel();}
function batchDelete(){const ix=_selIx();if(ix.length===0)return;vscode.postMessage({type:'removeBatch',indices:ix});}
function clearSelection(){document.querySelectorAll('.chk:checked').forEach(c=>{c.checked=false;const r=c.closest('.row');if(r)r.classList.remove('sel');});updateBatchBar();}
function _hitSel(e){return e&&e.target&&e.target.closest&&e.target.closest('.row');}
function _startSelect(e){const row=_hitSel(e);if(!row||e.target.closest('.acts,.b,button,textarea,a'))return;if(e.target.matches('input:not(.chk),select'))return;const i=parseInt(row.dataset.i);const c=row.querySelector('.chk');if(!Number.isFinite(i)||!c)return;e.preventDefault();const v=!c.checked;if(e.shiftKey&&_lastSel>=0)_applyRange(_lastSel,i,v);else{_setRowSel(i,v);_lastSel=i;}_dragSel=true;_dragVal=v;updateBatchBar();}
document.addEventListener('mousedown',e=>{if(e.button!==0)return;_startSelect(e);});
document.addEventListener('click',e=>{if(e.target.classList&&e.target.classList.contains('chk'))e.preventDefault();},true);
document.addEventListener('mouseover',e=>{if(!_dragSel)return;const row=_hitSel(e);if(!row)return;const i=parseInt(row.dataset.i);if(!Number.isFinite(i))return;_setRowSel(i,_dragVal);updateBatchBar();});
document.addEventListener('mouseup',()=>{_dragSel=false;});
document.addEventListener('change',e=>{if(e.target.classList.contains('chk')){const i=parseInt(e.target.dataset.i);if(Number.isFinite(i))_lastSel=i;updateBatchBar();}});
(function(){const s=vscode.getState()||{};if(s.addText){const ta=document.getElementById('addInput');if(ta)ta.value=s.addText;}const ta=document.getElementById('addInput');if(ta)ta.addEventListener('input',function(){const st=vscode.getState()||{};vscode.setState({...st,addText:this.value});});
// v3.11.2 · 多选持久化复位 — 重建后立即按 email 恢复 checked + .sel + batchBar 计数
try{_restoreSel();updateBatchBar();}catch(e){}
// Fix4: 恢复 conv 区块 collapsed 状态
try{if(localStorage.getItem('dao-conv-collapsed')==='1'){const cb=document.getElementById('convBody');const ca=document.getElementById('convArrow');if(cb){cb.classList.add('collapsed');if(ca)ca.textContent='\u25BC';}}}catch(e){}})();
window.addEventListener('message',e=>{const m=e.data;
if(m.type==='toast'){const cls=m.text&&m.text.startsWith('\\u2713')?'ok':m.text&&m.text.startsWith('\\u2717')?'fail':'';showToast(m.text,cls);}
if(m.type==='switching'){const r=document.querySelector('.row[data-i=\"'+m.index+'\"]');if(r){r.classList.add('switching');showToast('\\u26A1 \\u5207\\u6362\\u4E2D...');}}
if(m.type==='verifying'){const r=document.querySelector('.row[data-i=\"'+m.index+'\"]');if(r){r.classList.add('verifying');}}
if(m.type==='quotaChange'){const r=document.querySelector('.row[data-email=\"'+(m.email||'').toLowerCase()+'\"]');if(r){r.classList.add('quota-flash');setTimeout(()=>r.classList.remove('quota-flash'),700);}}
if(m.type==='convUpdate'&&m.html){const old=document.querySelector('.conv-section');if(old){const ic=!!(old.querySelector('.conv-body')&&old.querySelector('.conv-body').classList.contains('collapsed'));const tmp=document.createElement('div');tmp.innerHTML=m.html;const nw=tmp.querySelector('.conv-section');if(nw){old.replaceWith(nw);if(ic){const nb=nw.querySelector('.conv-body');const na=nw.querySelector('#convArrow');if(nb){nb.classList.add('collapsed');if(na)na.textContent='\u25BC';}}}}}
});
</script></body></html>`;
}

function _toast(text) {
  if (_sidebarProvider && _sidebarProvider._view) {
    try {
      _sidebarProvider._view.webview.postMessage({ type: "toast", text });
    } catch {}
  }
  if (_editorPanel) {
    try {
      _editorPanel.webview.postMessage({ type: "toast", text });
    } catch {}
  }
}

// v4.0 · 导出对话备份目录为 MD 文档 · 道法自然 · 万物负阴而抱阳
// 从 _index.json + _meta.json 提取对话元数据 → 生成可读 Markdown
function _exportConversationsMd() {
  try {
    const bkRoot = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
    if (!fs.existsSync(bkRoot)) return { ok: false, error: "备份目录不存在" };
    const batches = fs
      .readdirSync(bkRoot)
      .filter((d) => d.startsWith("backup_"))
      .sort()
      .reverse();
    // 合并所有 _index.json
    const allConv = {};
    for (const batch of batches) {
      const idxFile = path.join(bkRoot, batch, "_index.json");
      if (fs.existsSync(idxFile)) {
        try {
          const idx = JSON.parse(fs.readFileSync(idxFile, "utf8"));
          for (const [uuid, info] of Object.entries(idx)) {
            if (!allConv[uuid]) allConv[uuid] = { ...info, batch, uuid };
          }
        } catch {}
      }
      // 补充: 扫描无 _index 批次中的 .pb 文件
      try {
        for (const f of fs
          .readdirSync(path.join(bkRoot, batch))
          .filter((x) => x.endsWith(".pb"))) {
          const uuid = f.replace(".pb", "");
          if (!allConv[uuid]) {
            const sz = (() => {
              try {
                return fs.statSync(path.join(bkRoot, batch, f)).size;
              } catch {
                return 0;
              }
            })();
            allConv[uuid] = {
              title: "",
              sizeBytes: sz,
              backedUpAt: "",
              batch,
              uuid,
            };
          }
        }
      } catch {}
    }
    const entries = Object.values(allConv).sort((a, b) =>
      (b.backedUpAt || "").localeCompare(a.backedUpAt || ""),
    );
    // cascade/ 中的 UUID 集合
    const cascadeSet = new Set(
      fs.existsSync(PB_DIR)
        ? fs
            .readdirSync(PB_DIR)
            .filter((f) => f.endsWith(".pb"))
            .map((f) => f.replace(".pb", ""))
        : [],
    );
    // 生成 MD
    let md = "# Windsurf Cascade 对话备份目录\n\n";
    md += "> 生成时间: " + new Date().toISOString() + "\n";
    md += "> 源目录: `" + PB_DIR + "`\n";
    md += "> 备份目录: `" + bkRoot + "`\n";
    md +=
      "> 对话总数: " + entries.length + " | 批次: " + batches.length + "\n\n";
    md += "## 对话列表\n\n";
    md += "| # | 标题 | UUID | 大小 | MD | @可引用 | 备份时间 |\n";
    md += "|---|------|------|------|----|---------|----------|\n";
    let idx = 1;
    let mdGenerated = 0;
    const hasKey = !!_loadDecryptKey();
    for (const e of entries) {
      const title = (e.title || "无标题").replace(/\|/g, "/").substring(0, 40);
      const uuid = e.uuid.substring(0, 8) + "...";
      const size = e.sizeBytes ? Math.round(e.sizeBytes / 1024) + "KB" : "?";
      const inCascade = cascadeSet.has(e.uuid) ? "Y" : "-";
      const time = (e.backedUpAt || "-").substring(0, 19);
      // v3.8.2: 检查/补生成 MD
      let mdStatus = "-";
      if (hasKey && e.batch) {
        const batchDir2 = path.join(bkRoot, e.batch);
        const pbPath2 = path.join(batchDir2, e.uuid + ".pb");
        const mdPath2 = path.join(batchDir2, e.uuid + ".md");
        if (fs.existsSync(mdPath2)) {
          mdStatus = "✓";
        } else if (fs.existsSync(pbPath2)) {
          const ok = _writePbMd(pbPath2, mdPath2, e);
          if (ok) {
            mdStatus = "✓(新)";
            mdGenerated++;
          } else mdStatus = "✗";
        }
      }
      md +=
        "| " +
        idx +
        " | " +
        title +
        " | `" +
        uuid +
        "` | " +
        size +
        " | " +
        mdStatus +
        " | " +
        inCascade +
        " | " +
        time +
        " |\n";
      idx++;
    }
    if (mdGenerated > 0)
      log("export-md: 补生成 " + mdGenerated + " 个 MD 文件");
    md += "\n## 备份批次\n\n";
    for (const batch of batches) {
      const dir = path.join(bkRoot, batch);
      const pbCount = (() => {
        try {
          return fs.readdirSync(dir).filter((f) => f.endsWith(".pb")).length;
        } catch {
          return 0;
        }
      })();
      md += "- **" + batch + "**: " + pbCount + " 个对话 · `" + dir + "`\n";
    }
    md += "\n## 加密与恢复说明\n\n";
    md += "- `.pb` 文件格式: AES-256-GCM 加密 (Go LS 管理密钥)\n";
    md +=
      "- 恢复方法: 将备份 `.pb` 复制回 `cascade/` 目录即可被 `@conversation` 引用\n";
    md += "- WAM 插件: 侧边栏 > 对话追踪 > 恢复对话 按钮可一键恢复\n";
    md += "- 限制: 官方 LS 保留最近 ~50 个对话 · 恢复后可能被下次启动清理\n";
    const mdFile = path.join(
      bkRoot,
      "对话备份目录_" +
        new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19) +
        ".md",
    );
    fs.writeFileSync(mdFile, md, "utf8");
    log("export-md: " + entries.length + " 条 → " + mdFile);
    return { ok: true, file: mdFile, count: entries.length };
  } catch (e) {
    log("export-md err: " + (e.message || e));
    return { ok: false, error: e.message || String(e) };
  }
}

// Fix2: @conversation突破 — 从备份恢复对话到cascade/ (vscdb还有元数据→可被@引用)
// 官方50限制原因: LS清理策略保留最近~50个.pb; vscdb仍有~101条元数据
// 突破: 备份.pb复制回cascade/ → LS立即感知 → @conversation可引用历史对话
async function _restoreConversationFromBackup() {
  const bkRoot = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
  if (!fs.existsSync(bkRoot)) {
    _toast("备份目录不存在");
    return;
  }
  // 收集所有备份.pb (从最新备份优先)
  const bkDirs = fs
    .readdirSync(bkRoot)
    .filter((d) => d.startsWith("backup_"))
    .sort()
    .reverse();
  if (bkDirs.length === 0) {
    _toast("无可用备份");
    return;
  }
  const seen = new Set();
  const items = [];
  // 加载最新backup的_index.json获取标题
  let idxData = {};
  try {
    idxData = JSON.parse(
      fs.readFileSync(path.join(bkRoot, bkDirs[0], "_index.json"), "utf8"),
    );
  } catch {}
  for (const d of bkDirs) {
    const dir = path.join(bkRoot, d);
    try {
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".pb"))) {
        const uuid = f.replace(".pb", "");
        if (seen.has(uuid)) continue;
        seen.add(uuid);
        const inCascade = fs.existsSync(path.join(PB_DIR, f));
        if (!inCascade) {
          const title = (idxData[uuid] && idxData[uuid].title) || "";
          const sz = Math.round(
            ((idxData[uuid] && idxData[uuid].sizeBytes) || 0) / 1024,
          );
          items.push({
            label: title
              ? title.substring(0, 40)
              : uuid.substring(0, 8) + "...",
            description: sz ? sz + "KB" : "",
            detail: uuid,
            srcFile: path.join(dir, f),
          });
        }
      }
    } catch {}
  }
  if (items.length === 0) {
    _toast("所有备份对话均已在cascade/中，无需恢复");
    return;
  }
  const pick = await vscode.window.showQuickPick(items, {
    placeHolder: "选择要恢复的对话 (恢复后可在 @conversation 中引用)",
    title: "从备份恢复对话 (" + items.length + "个可恢复)",
  });
  if (!pick) return;
  try {
    fs.copyFileSync(
      pick.srcFile,
      path.join(PB_DIR, path.basename(pick.srcFile)),
    );
    _toast("✓ 已恢复: " + pick.label + " → 现可在 @conversation 中引用");
    log("restore-conv: " + pick.detail + " from " + pick.srcFile);
  } catch (e) {
    _toast("✗ 恢复失败: " + (e.message || e));
  }
}
// ═══ v3.11.4 · vscdb 裸读 · 无 better-sqlite3 亦可直读 title/status ═══
// 根因: dao_stuck.js 子进程 + extension.js 均无法保证 better-sqlite3 可用
// 修复: 直接扫描 SQLite 文件原始字节 · 提取 {"sessions":[ JSON
// v3.14.0 · 自适应 Devin/Windsurf vscdb 路径
function _getVscdbPath() {
  const appdata =
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  // Devin Desktop 优先 (179实测: AppData/Roaming/Devin)
  const devinDb = path.join(
    appdata,
    "Devin",
    "User",
    "globalStorage",
    "state.vscdb",
  );
  if (fs.existsSync(devinDb)) return devinDb;
  const windsurfDb = path.join(
    appdata,
    "Windsurf",
    "User",
    "globalStorage",
    "state.vscdb",
  );
  return windsurfDb;
}
const _VSCDB_PATH = _getVscdbPath();
// v3.14.0 · Local State 路径 (DPAPI加密密钥)
function _getLocalStatePath() {
  const appdata =
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const devinLs = path.join(appdata, "Devin", "Local State");
  if (fs.existsSync(devinLs)) return devinLs;
  return path.join(appdata, "Windsurf", "Local State");
}
const _EXT_TITLE_FILE = path.join(os.homedir(), ".wam", "_conv_titles.json");
let _lastVscdbTitleRefresh = 0;

// v3.11.4: 裸扫已废弃 — JSON 跨 SQLite overflow 页无法扫描 · 改用 Python sqlite3
function _tryExtractSessionsFromBuf(_buf) {
  return null; // 保留函数签名以防调用 · 逻辑已移至 _refreshTitlesFromVscdbRaw
}
// ═══ v3.12.0 · Python 七层兜底探测 (与 dao_stuck.js 同步) ═══
// 旧版仅检查 python/python3 · 漏 py.exe/Anaconda/pyenv/用户级安装 等
// 道义: 上善若水 · 居众之所恶 · 故几于道矣
let _pyExeExt = undefined;
function _findPythonExt() {
  if (_pyExeExt !== undefined) return _pyExeExt;
  const candidates = [];
  // 0. 软编码配置 (wam.pythonPath) + 环境变量
  const cfgPy = String(_cfg("pythonPath", "") || "").trim();
  if (cfgPy) candidates.push(cfgPy);
  if (process.env.WAM_PYTHON_PATH) candidates.push(process.env.WAM_PYTHON_PATH);
  // 1. PATH 标准
  candidates.push("python3", "python");
  // 2. Windows Python Launcher
  if (process.platform === "win32") candidates.push("py");
  // 3. 常见绝对路径
  if (process.platform === "win32") {
    const localApp = process.env.LOCALAPPDATA || "";
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    for (let v = 7; v <= 15; v++) {
      const vf = "Python3" + v;
      if (localApp)
        candidates.push(
          path.join(localApp, "Programs", "Python", vf, "python.exe"),
        );
      candidates.push(path.join(pf, vf, "python.exe"));
      candidates.push(path.join(pf86, vf, "python.exe"));
      candidates.push("C:\\" + vf + "\\python.exe");
    }
    if (localApp) {
      candidates.push(
        path.join(localApp, "Microsoft", "WindowsApps", "python3.exe"),
      );
      candidates.push(
        path.join(localApp, "Microsoft", "WindowsApps", "python.exe"),
      );
    }
    const up = process.env.USERPROFILE || os.homedir();
    candidates.push(
      path.join(up, "anaconda3", "python.exe"),
      path.join(up, "miniconda3", "python.exe"),
      "C:\\anaconda3\\python.exe",
      "C:\\miniconda3\\python.exe",
      "C:\\ProgramData\\anaconda3\\python.exe",
      "C:\\ProgramData\\miniconda3\\python.exe",
    );
  } else {
    candidates.push(
      "/usr/bin/python3",
      "/usr/local/bin/python3",
      "/usr/bin/python",
      "/usr/local/bin/python",
      "/opt/homebrew/bin/python3",
      "/opt/local/bin/python3",
      path.join(os.homedir(), ".pyenv", "shims", "python3"),
    );
  }
  for (const cmd of candidates) {
    if (!cmd) continue;
    try {
      if (path.isAbsolute(cmd) && !fs.existsSync(cmd)) continue;
      const r = require("child_process").spawnSync(cmd, ["--version"], {
        timeout: 2000,
        windowsHide: true,
        encoding: "utf8",
      });
      if (r.status === 0) {
        _pyExeExt = cmd;
        log(
          "python_found(ext): " +
            cmd +
            " · " +
            (r.stdout || r.stderr || "").trim(),
        );
        return cmd;
      }
    } catch {}
  }
  _pyExeExt = null;
  log("python_not_found(ext) · 标题将用 UUID 兜底");
  return null;
}
// ═══ v3.12.0 · 乱码标题检测 (清洗 U+FFFD/菱形残留) ═══
function _isGarbledTitle(t) {
  if (!t || typeof t !== "string") return false;
  // U+FFFD = replacement char · U+25C6 = black diamond · 连续 2+ 个表示乱码
  if (/[\uFFFD]{2,}/.test(t)) return true;
  if (/[\u25C6]{2,}/.test(t)) return true;
  // 大量不可打印字符
  const bad = t.replace(
    /[\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g,
    "",
  );
  if (bad.length > t.length * 0.3 && t.length > 4) return true;
  return false;
}

function _refreshTitlesFromVscdbRaw() {
  try {
    const now = Date.now();
    if (now - _lastVscdbTitleRefresh < 15000) return; // 15s 节流
    _lastVscdbTitleRefresh = now;
    // 先读外部标题文件 (dao_stuck.js Python读取写入)
    if (fs.existsSync(_EXT_TITLE_FILE)) {
      try {
        const ext = JSON.parse(fs.readFileSync(_EXT_TITLE_FILE, "utf8"));
        let extAdded = 0;
        let garbledCleaned = 0;
        for (const [uuid, t] of Object.entries(ext)) {
          // v3.12.0: 跳过乱码标题 (旧版 ensure_ascii=False 产生的残留)
          if (_isGarbledTitle(t)) {
            garbledCleaned++;
            continue;
          }
          if (t && !_convTitleMap[uuid]) {
            _convTitleMap[uuid] = t;
            extAdded++;
          }
        }
        if (garbledCleaned > 0)
          log("vscdb-ext-title: 清洗 " + garbledCleaned + " 个乱码标题");
        if (extAdded > 0)
          log(
            "vscdb-ext-title: 新增 " +
              extAdded +
              " 个 (总 " +
              Object.keys(_convTitleMap).length +
              ")",
          );
      } catch {}
    }
    // v3.16.0: 双路径读取 vscdb — Python 优先 → Node.js native SQLite 回退
    let sessions = null;
    // 路径A: Python sqlite3 (最完整·跨 overflow 页)
    const pyExe = _findPythonExt();
    const helperPy = path.join(__dirname, "_vscdb_helper.py");
    if (pyExe && fs.existsSync(helperPy)) {
      const r = require("child_process").spawnSync(pyExe, [helperPy], {
        timeout: 10000,
        windowsHide: true,
        encoding: "utf8",
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
      if (r.status === 0 && r.stdout) {
        try {
          sessions = JSON.parse(r.stdout.trim());
        } catch {}
      }
    }
    // 路径B: Node.js native SQLite (v22+ · 无 Python 依赖时的回退)
    if (!sessions) {
      try {
        sessions = _readVscdbViaNodeSqlite();
      } catch {}
    }
    if (!sessions || !Array.isArray(sessions)) return;
    let added = 0;
    for (const s of sessions) {
      if (
        s.sessionId &&
        s.title &&
        !_isGarbledTitle(s.title) &&
        !_convTitleMap[s.sessionId]
      ) {
        _convTitleMap[s.sessionId] = s.title;
        added++;
      }
    }
    if (added > 0) {
      log(
        "vscdb-py-title: 新增 " +
          added +
          " 个标题 (总 " +
          Object.keys(_convTitleMap).length +
          ")",
      );
      _persistConvTitleHints();
    }
  } catch {}
}

// v3.16.0 · 纯 Node.js 读取 vscdb metadataCache · 无 Python 依赖
// 优先 node:sqlite (Node 22+ 内置) → 回退 better-sqlite3
function _readVscdbViaNodeSqlite() {
  const dbPath = _getVscdbPath();
  if (!dbPath || !fs.existsSync(dbPath)) return null;
  let db = null;
  try {
    // 路径1: node:sqlite (Node 22+ 内置 · 零依赖)
    try {
      const nsql = require("node:sqlite");
      const sdb = new nsql.DatabaseSync(dbPath, { readOnly: true });
      // 自适应 key: devin.acp.* → windsurf.acp.*
      let key = "windsurf.acp.metadataCache";
      try {
        const probe = sdb
          .prepare("SELECT 1 FROM ItemTable WHERE key=?")
          .get("devin.acp.metadataCache");
        if (probe) key = "devin.acp.metadataCache";
      } catch {}
      const row = sdb
        .prepare("SELECT value FROM ItemTable WHERE key=?")
        .get(key);
      sdb.close();
      if (row && row.value) {
        const data = JSON.parse(
          typeof row.value === "string" ? row.value : row.value.toString(),
        );
        return data.sessions || null;
      }
      return null;
    } catch (e1) {
      // node:sqlite 不可用 (Node < 22 或未启用)
    }
    // 路径2: better-sqlite3 (Windsurf 自带)
    try {
      const Database = require("better-sqlite3");
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
      let key = "windsurf.acp.metadataCache";
      try {
        const probe = db
          .prepare("SELECT 1 FROM ItemTable WHERE key=?")
          .get("devin.acp.metadataCache");
        if (probe) key = "devin.acp.metadataCache";
      } catch {}
      const row = db
        .prepare("SELECT value FROM ItemTable WHERE key=?")
        .get(key);
      db.close();
      db = null;
      if (row && row.value) {
        const data = JSON.parse(row.value);
        return data.sessions || null;
      }
      return null;
    } catch (e2) {
      // better-sqlite3 不可用
    }
    return null;
  } catch (e) {
    if (db)
      try {
        db.close();
      } catch {}
    return null;
  }
}

function _persistConvTitleHints() {
  try {
    const dir = path.join(os.homedir(), ".wam");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(_EXT_TITLE_FILE, JSON.stringify(_convTitleMap, null, 0));
  } catch {}
}

// v13.0 · 对话标题缓存刷新 · 从备份批次 + vscdb 裸读加载 uuid→title
// 调用时机: 备份完成后 · 插件激活时 · hub 刷新时(增量)
// v3.11.4: 全量备份批次 + vscdb raw scan + 持久化到 _conv_titles.json
function _refreshConvTitleMap() {
  try {
    const bkRoot = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
    if (!fs.existsSync(bkRoot)) return;
    const batches = fs
      .readdirSync(bkRoot)
      .filter((d) => d.startsWith("backup_"))
      .sort()
      .reverse();
    let loaded = 0;
    for (const batch of batches) {
      try {
        const idx = JSON.parse(
          fs.readFileSync(path.join(bkRoot, batch, "_index.json"), "utf8"),
        );
        for (const [uuid, m] of Object.entries(idx)) {
          if (m.title && !_convTitleMap[uuid]) {
            _convTitleMap[uuid] = m.title;
            loaded++;
          }
        }
      } catch {}
    }
    if (loaded > 0)
      log(
        "conv-title-map: 新增 " +
          loaded +
          " 个对话标题缓存 (总 " +
          Object.keys(_convTitleMap).length +
          ")",
      );
    // v3.11.4: 从 vscdb 裸读补充当前活跃对话标题
    _refreshTitlesFromVscdbRaw();
    // 持久化到外部文件 (供 dao_stuck.js 使用)
    _persistConvTitleHints();
  } catch {}
}

// Fix4: 对话追踪区块 targeted update (不触发全量 sidebar 重建)
function _broadcastConvSection() {
  const html = _getConvTrackingHtml();
  _broadcastMsg({ type: "convUpdate", html });
}

function _broadcastMsg(msg) {
  if (_sidebarProvider && _sidebarProvider._view) {
    try {
      _sidebarProvider._view.webview.postMessage(msg);
    } catch {}
  }
  if (_editorPanel) {
    try {
      _editorPanel.webview.postMessage(msg);
    } catch {}
  }
}

async function handleWebviewMessage(msg) {
  try {
    switch (msg.type) {
      case "switch": {
        // v3.0.1 手动至高优先 · 道法自然 · 用户意志即最高优先级
        //   超时 30s → 10s: 手动操作不应让用户等待超过10s
        //   删除 _engine.rotating && !_switching 永久阻塞 (v3.x 病灶一·最致命)
        //   _switching 统一互斥锁: rotateNext/命令面板 均已同步 (v3.0.1 修二·修三)
        if (_switching) {
          const lockAge = Date.now() - _switchingStartTime;
          if (lockAge < 10000) {
            _toast("正在切换中(" + Math.round(lockAge / 1000) + "s)...");
            return;
          }
          log(
            "switch: 手动强占 — 强制释放超时锁(" +
              Math.round(lockAge / 1000) +
              "s)",
          );
          _switching = false;
          if (_engine) _engine.rotating = false; // v3.0.1 双锁归一 同步清除
        }
        // v3.0.1: 已删除 _engine.rotating && !_switching 永久无超时阻塞
        // 手动切号不受引擎轮转状态约束 · 天下莫柔弱于水 · 一锁至柔覆万场景
        _switching = true;
        _switchingStartTime = Date.now();
        _engine.rotating = true;
        _broadcastMsg({ type: "switching", index: msg.index });
        _broadcastUI();
        try {
          const r = await loginAccount(_store, msg.index);
          if (r.ok) {
            _toast(
              "✓ " +
                (_store.activeEmail || "?").split("@")[0] +
                " · 路" +
                r.path +
                " · " +
                (r.ms || 0) +
                "ms",
            );
          } else {
            _toast("✗ " + r.stage + ": " + r.error);
          }
        } finally {
          _switching = false;
          _engine.rotating = false;
          _broadcastUI();
        }
        break;
      }
      case "verify": {
        const i = msg.index;
        if (i < 0 || i >= _store.accounts.length) return;
        const a = _store.accounts[i];
        const vt0 = Date.now();
        // v2.8.3 · 统一走 verifyOneAccount · 一码归一 · 无为而无以为
        _broadcastMsg({ type: "verifying", index: i });
        _toast("🔍 验证中: " + a.email.split("@")[0]);
        const vr = await verifyOneAccount(a);
        const vms = Date.now() - vt0;
        if (vr.ok && vr.q) {
          _store.setHealth(a.email, vr.q);
          const ovgStr = vr.q.overageActive
            ? " $" + Math.round(vr.q.overageDollars)
            : "";
          _toast(
            "✓ " +
              a.email.split("@")[0] +
              " D" +
              vr.q.daily +
              "% W" +
              vr.q.weekly +
              "% " +
              (vr.q.plan || "") +
              ovgStr +
              " · " +
              vms +
              "ms",
          );
        } else {
          _bumpFailure(
            _store,
            a.email,
            "verify: " + (vr.stage || "?") + " " + (vr.error || "?"),
          );
          _toast(
            "✗ " +
              (vr.stage || "?") +
              ": " +
              (vr.error || "?") +
              " · " +
              vms +
              "ms",
          );
        }
        const k = a.email.toLowerCase();
        if (_store.blacklist[k]) {
          delete _store.blacklist[k];
          _store.save();
        }
        _broadcastUI();
        break;
      }
      case "remove":
        _store.remove(msg.index);
        _toast("已删除");
        _broadcastUI();
        break;
      case "removeBatch": {
        const r = _store.removeBatch(msg.indices || []);
        if (r.count === 0) {
          _toast("批量删除: 0 个 (索引无效)");
        } else if (r.persistOk) {
          _toast(
            "✓ 批量删除 " +
              r.count +
              " 个" +
              (r.activeRemoved ? " · 含活跃号" : ""),
          );
        } else {
          _toast(
            "⚠️ 已删 " + r.count + " 但写盘失败 · 见 Output (重启可能恢复)",
          );
        }
        _broadcastUI();
        break;
      }
      case "addBatch": {
        // v3.0.6 · 无感无为 · 立即响应 · 零用户等待
        //   原病灶一: await injectToken 先阻塞 → 点「添加」后 N 秒无任何反馈
        //   原病灶二: 串行 verify + 800ms 抖动 → 20账号需 2-6 分钟 → 用户反复开面板都是"未验"
        //   原病灶三: reloadAccounts() 多余重读盘 (addBatch 已在内存 · 无需重读)
        //   修法: 3 并行 verify worker · 零初始延迟 · 无抖动 · devinLogin 序列化门已保证限速
        //         20 账号: 串行 2-6min → 并行 3 worker ~30-80s · 5 账号 ~10s · 用户可感
        const r = _store.addBatch(msg.text || "");
        const tks = r.tokens || [];
        let info = "添加 " + r.added + " 个";
        if (r.duplicate > 0) info += " · 跳重 " + r.duplicate;
        if (tks.length > 0) info += " · " + tks.length + " token (注入中…)";
        _toast(info); // ← 立即告知 · 不等 injectToken
        // 不调 reloadAccounts() — addBatch 已直接修改 this.accounts · accounts 已在内存
        _broadcastUI(); // ← 立即刷新 · 用户即见新账号列表
        // 后台 fire-forget: token 注入 + 3 worker 并行 verify
        (async () => {
          if (tks.length > 0) {
            const inj = await injectToken(tks[0]);
            if (inj.ok) {
              _store.lastInjectPath = inj.path;
              _store.activeTokenShort = (tks[0] || "").substring(0, 24) + "…";
              _store.save();
              _toast("✓ token 路" + inj.path);
              log(
                "addBatch token直登 ✓ 路" +
                  inj.path +
                  " · 余 " +
                  (tks.length - 1) +
                  " 个未用",
              );
              _broadcastUI();
            } else {
              _toast("token ✗ " + (inj.note || inj.path || "?"));
              log("addBatch token直登 ✗ " + (inj.note || ""));
            }
          }
          if (r.added > 0 && r.addedEmails && r.addedEmails.length > 0) {
            const newEmails = [...r.addedEmails];
            const _vq = [...newEmails]; // 共享队列 · 3 worker 竞争消费
            log(
              "addBatch · 新加 " +
                newEmails.length +
                " 号 · 并行 verify 3 workers · 零等待",
            );
            // 并行 verify worker · 共享 _vq 队列
            // devinLogin 序列化门保证: 任意时刻只 1 个 devinLogin 飞 · 最小间隔 1200ms
            // 3 worker 最终效果: 3x 加速 vs 串行 + cache快路账号完全不占门
            async function _addBatchVerifyWorker() {
              while (_vq.length > 0) {
                const em = _vq.shift();
                if (!em) continue;
                const a = _store.accounts.find(
                  (x) => x.email.toLowerCase() === em.toLowerCase(),
                );
                if (!a) continue;
                try {
                  const vr = await verifyOneAccount(a);
                  if (vr.ok && vr.q) {
                    _store.setHealth(a.email, vr.q);
                    log(
                      "addBatch verify ✓ " +
                        em.substring(0, 30) +
                        " D" +
                        vr.q.daily +
                        "% W" +
                        vr.q.weekly +
                        "% " +
                        vr.q.plan +
                        " " +
                        vr.q.daysLeft +
                        "d",
                    );
                    _broadcastUI(); // 逐账号更新 · 防抖合并 · 用户实时见进度
                  } else {
                    log(
                      "addBatch verify ✗ " +
                        em.substring(0, 30) +
                        " · " +
                        (vr.stage || "?") +
                        ": " +
                        (vr.error || "?"),
                    );
                  }
                } catch (e) {
                  log("addBatch verify err " + em + " · " + (e.message || e));
                }
                // 无额外等待 · devinLogin 序列化门已保证最小 1200ms 间隔 · 800ms 抖动冗余废除
              }
            }
            const nWorkers = Math.min(3, newEmails.length);
            await Promise.all(
              Array.from({ length: nWorkers }, _addBatchVerifyWorker),
            );
            _broadcastUI(); // 收尾刷新
          }
        })();
        break;
      }
      case "copyAccount": {
        const a = _store.accounts[msg.index];
        if (a) {
          await vscode.env.clipboard.writeText(a.email + ":" + a.password);
          _toast("\u2713 已复制 " + a.email.split("@")[0]);
        }
        break;
      }
      case "copyAccounts": {
        const indices = [
          ...new Set((msg.indices || []).map(Number).filter(Number.isInteger)),
        ];
        const lines = [];
        for (const i of indices) {
          const a = _store.accounts[i];
          if (a) lines.push(a.email + ":" + a.password);
        }
        if (lines.length === 0) {
          _toast("批量复制: 0 个 (索引无效)");
        } else {
          await vscode.env.clipboard.writeText(lines.join("\n"));
          _toast("\u2713 已复制 " + lines.length + " 个账号");
        }
        break;
      }
      case "copyAllAccounts": {
        const lines = _store.accounts.map((a) => a.email + ":" + a.password);
        await vscode.env.clipboard.writeText(lines.join("\n"));
        _toast("\u2713 已导出 " + lines.length + " 个账号到剪贴板");
        break;
      }
      case "setSkipBatch": {
        const locked = !!msg.locked;
        const indices = [
          ...new Set((msg.indices || []).map(Number).filter(Number.isInteger)),
        ];
        const items = [];
        for (const i of indices) {
          const acc = _store.accounts[i];
          if (!acc) continue;
          acc.skipAutoSwitch = locked;
          if (locked && _predictiveCandidate === i) _predictiveCandidate = -1;
          items.push({ email: acc.email, locked });
        }
        if (items.length === 0) {
          _toast("批量锁定: 0 个 (索引无效)");
          break;
        }
        const wr = _writeLockStates(items);
        if (!_store._savedAccountMeta) _store._savedAccountMeta = {};
        for (const it of items) {
          const k = it.email.toLowerCase();
          if (locked) _store._savedAccountMeta[k] = { skipAutoSwitch: true };
          else delete _store._savedAccountMeta[k];
        }
        log(
          "🔒 批量" +
            (locked ? "锁定" : "解锁") +
            " " +
            items.length +
            " 个 · persistOk=" +
            wr.ok,
        );
        _toast(
          (locked ? "🔒 已锁定 " : "🔓 已解锁 ") +
            items.length +
            " 个账号" +
            (wr.ok ? "" : " · 持久化失败⚠️"),
        );
        _store.save();
        _broadcastUI();
        break;
      }
      // ── 本源 v17.42.7 锁🔒 toggleSkip ──
      // v2.7.4 (补入v3.0.2) · 真本源持久化 · 写独立 lock-state.json (race-safe)
      case "toggleSkip": {
        const acc3 = _store.accounts[msg.index];
        if (acc3) {
          acc3.skipAutoSwitch = !acc3.skipAutoSwitch;
          // v17.42.7 锁🔒贯通: 即时联动 — 若刚锁的正是 _predictiveCandidate, 立刻失效
          if (acc3.skipAutoSwitch && _predictiveCandidate === msg.index) {
            _predictiveCandidate = -1;
            log(
              "🔒 lock: " +
                acc3.email.substring(0, 20) +
                " 是 _predictiveCandidate → 即时作废",
            );
          }
          // v2.7.4 · 写 lock-state.json 独立真本源 (其他窗口 save() 不会覆盖)
          const wOk = _writeLockState(acc3.email, !!acc3.skipAutoSwitch);
          log(
            "🔒 " +
              (acc3.skipAutoSwitch ? "锁" : "解锁") +
              ": " +
              acc3.email.substring(0, 20) +
              (wOk ? " · 持久化 ✓" : " · 持久化失败 ⚠️"),
          );
          // 同步内存快照 (reloadAccounts 路径不破)
          const _lk = acc3.email.toLowerCase();
          if (!_store._savedAccountMeta) _store._savedAccountMeta = {};
          if (acc3.skipAutoSwitch)
            _store._savedAccountMeta[_lk] = { skipAutoSwitch: true };
          else delete _store._savedAccountMeta[_lk];
          _toast(
            (acc3.skipAutoSwitch ? "🔒 已锁定 " : "🔓 已解锁 ") +
              acc3.email.split("@")[0],
          );
          _store.save();
          _broadcastUI();
        }
        break;
      }
      case "setMode": {
        // v3.2.0 · 三处归一 · 调统一 _setMode()
        const changed = await _setMode(msg.mode);
        if (!changed)
          _toast(
            "当前已是 " +
              (_wamMode === "wam" ? "WAM切号" : "官方登录") +
              " 模式",
          );
        else
          _toast(
            _wamMode === "official"
              ? "已切官方模式 · WAM 已登出 · 可用官方登录"
              : "已切 WAM 切号模式 · 引擎启",
          );
        break;
      }
      // ── 对齐本源: refresh (刷新视图 + 后台触发验证) ──
      // v3.0.2 · 手动 refresh 不再只是 reloadAccounts · 同步触发 stale 验证刷新额度
      // v3.7.4 · 手动刷新也先查未验号 · 有则全量 · 无则 onlyStale
      case "refresh": {
        _store.reloadAccounts();
        _broadcastUI();
        // 后台触发验证 (不阻塞 · 不重复 · 用户点刷新即更新额度)
        if (!_verifyAllInProgress && _wamMode === "wam") {
          setTimeout(() => {
            if (_verifyAllInProgress) return;
            const _refreshUnchecked = _store.accounts.filter(
              (a) => !_store.getHealth(a.email).checked,
            ).length;
            if (_refreshUnchecked > 0) {
              log("refresh: " + _refreshUnchecked + " 未验 · 全量验证");
              verifyAllAccounts({ onlyStale: false }).catch((e2) =>
                log("refresh-verify err: " + (e2.message || e2)),
              );
            } else {
              log("refresh: 无未验号 · 触发后台 onlyStale 验证");
              verifyAllAccounts({ onlyStale: true }).catch((e2) =>
                log("refresh-verify err: " + (e2.message || e2)),
              );
            }
          }, 300);
        }
        break;
      }
      // ── 对齐本源: autoRotate (智能轮转) ──
      case "autoRotate": {
        if (_wamMode === "official") {
          _toast("官方模式下不可自动切号");
          break;
        }
        _toast("⚡ 智能轮转中…");
        try {
          await _engine.rotateNext();
        } catch (e2) {
          log("autoRotate err: " + (e2.message || e2));
        }
        _broadcastUI();
        break;
      }
      // ── 对齐本源: verifyAll (全量验证) ──
      case "verifyAll": {
        if (_verifyAllInProgress) {
          _toast("验证已在运行中");
          break;
        }
        _toast("🔍 全量验证 " + _store.accounts.length + " 个号中…");
        verifyAllAccounts({ onlyStale: false })
          .then((r2) => {
            if (r2)
              _toast(
                "✓ 验证完成: " +
                  r2.ok +
                  " ✓ / " +
                  r2.fail +
                  " ✗ · " +
                  r2.durSec +
                  "s",
              );
            _broadcastUI();
          })
          .catch((e2) => log("verifyAll err: " + (e2.message || e2)));
        break;
      }
      // ── 对齐本源: scanExpiry (刷新缺失有效期) ──
      case "scanExpiry": {
        _toast("🔍 扫描缺失有效期…");
        let fetched2 = 0,
          failed2 = 0;
        for (const a of _store.accounts) {
          const hh = _store.getHealth(a.email);
          if (hh.checked && hh.planEnd > 0) continue;
          try {
            const vr = await verifyOneAccount(a);
            if (vr.ok && vr.q) {
              _store.setHealth(a.email, vr.q);
              fetched2++;
            } else failed2++;
          } catch {
            failed2++;
          }
          if ((fetched2 + failed2) % 5 === 0) _broadcastUI();
        }
        _toast("有效期扫描: " + fetched2 + " ✓ / " + failed2 + " ✗");
        _broadcastUI();
        break;
      }
      // ── 对齐本源: openEditor (从侧栏打开大窗口) ──
      case "openEditor": {
        openEditorPanel();
        break;
      }
      // v3.0.5 · 添加账号展开状态持久化 · 防回退闪烁
      // 客户端 toggleAdd() 点击时上报 → 服务端记住 → 下次 buildHtml() 正确渲染初始态
      case "setAddOpen": {
        _uiAddOpen = !!msg.open;
        break;
      }
      // v3.4.0 · 对话备份 · 道法自然
      case "backupConversations": {
        const result = _backupConversations();
        if (result.ok) {
          _toast("备份完成: " + result.copied + " 个对话 → " + result.dir);
          _notify(
            "info",
            "对话备份完成: " +
              result.copied +
              " 个文件 → " +
              (result.dir || ""),
          );
        } else {
          _toast("备份失败: " + (result.error || "未知错误"));
        }
        break;
      }
      // v3.6.0 · 选择备份目录 + 自动迁移已有备份 + 重新增量监视
      case "selectBackupDir": {
        const picked = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: "选择对话备份目录",
          title: "选择 Cascade 对话备份存储位置 (已有备份将自动迁移)",
        });
        if (picked && picked.length > 0) {
          const newDir = picked[0].fsPath;
          const oldDir =
            _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
          // ★ 自动迁移: 将旧目录所有备份移动到新目录
          if (oldDir !== newDir && fs.existsSync(oldDir)) {
            ensureDir(newDir);
            let moved = 0;
            try {
              for (const e of fs.readdirSync(oldDir)) {
                const src = path.join(oldDir, e);
                const dst = path.join(newDir, e);
                if (!fs.existsSync(dst)) {
                  fs.renameSync(src, dst);
                  moved++;
                }
              }
              log(
                "backup-migrate: " + moved + " 项 " + oldDir + " → " + newDir,
              );
            } catch (e) {
              log("backup-migrate err: " + (e.message || e));
            }
          }
          await vscode.workspace
            .getConfiguration("wam")
            .update(
              "conversationBackupDir",
              newDir,
              vscode.ConfigurationTarget.Global,
            );
          // 重置今日备份标记·立即在新目录做一次全量
          _autoBackupDone = false;
          _lastBackupDate = "";
          const r = _backupConversations(newDir);
          _toast(
            "备份目录: " +
              newDir +
              (r.ok ? " · 全量备份: " + r.copied + "个" : ""),
          );
          log("conv-backup-dir: " + newDir);
          _broadcastUI();
        }
        break;
      }
      // Fix2: @conversation突破 — 从备份恢复.pb到cascade/供@引用
      case "restoreConversation": {
        await _restoreConversationFromBackup();
        break;
      }
      // v4.0 · 打开 cascade 源目录 · 道法自然
      case "openPbDir": {
        try {
          await vscode.env.openExternal(vscode.Uri.file(PB_DIR));
        } catch (e) {
          log("openPbDir err: " + (e.message || e));
        }
        break;
      }
      // v4.0 · 打开备份目录 · 道法自然
      case "openBackupDir": {
        const _bkDir = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
        try {
          await vscode.env.openExternal(vscode.Uri.file(_bkDir));
        } catch (e) {
          log("openBackupDir err: " + (e.message || e));
        }
        break;
      }
      // v4.0 · 导出对话目录为 MD · 道法自然
      case "exportConvMd": {
        const mdResult = _exportConversationsMd();
        if (mdResult.ok) {
          _toast("\u2713 MD导出: " + mdResult.file);
          try {
            const doc = await vscode.workspace.openTextDocument(mdResult.file);
            await vscode.window.showTextDocument(doc);
          } catch {}
        } else {
          _toast("\u2717 MD导出失败: " + (mdResult.error || "未知"));
        }
        break;
      }
      // v3.7.5 · 对话手动关闭 · 反者道之动 · 道法自然
      // v3.7.6 · 关闭即持久化 · 多窗口同步 · 小邦寺民·各得其欲
      // 用户点 × 关闭某条卡住对话提醒 → 本地静默 10min → 面板立即消失
      case "dismissConv": {
        if (msg.uuid) {
          _dismissedConvUuids.set(msg.uuid, Date.now());
          _saveDismissedToDisk(); // v3.7.6: 持久化 · 多窗同步 (A窗dismiss→写盘→B窗watchFile触发)
          log(
            "conv-dismiss: " +
              msg.uuid.substring(0, 8) +
              " (10min静默 · 已写盘)",
          );
          _broadcastConvSection(); // 立即更新面板 · 移除该条目
          _toast("✓ 已关闭对话提醒 (10min后若仍卡住将恢复)");
        }
        break;
      }
    }
  } catch (e) {
    log("handleMsg err: " + (e.stack || e.message || e));
  }
}

// ═══ § 5 · 万法之运 (auto-rotate · 健康检查 · activate) ═══
class Engine {
  constructor(store) {
    this.store = store;
    this.rotating = false;
    this.scanTimer = null;
    this.lastScanAt = 0;
    this.bootRotateDone = false;
  }

  async rotateNext(opts) {
    if (this.rotating || _switching) {
      log(
        "rotate: in-progress (rotating=" +
          this.rotating +
          " switching=" +
          _switching +
          ")",
      );
      return { ok: false, busy: true };
    }
    this.rotating = true;
    _switching = true; // v3.0.1 · 与 _doAutoSwitch 对齐 · 手动10s超时生效
    _switchingStartTime = Date.now(); // v3.0.1
    _broadcastUI();
    try {
      if (opts && opts.tryPending) {
        const j = tryLoadPendingToken();
        if (j) {
          const inj = await injectToken(j.sessionToken);
          if (inj.ok) {
            consumePendingToken();
            let idx = this.store.accounts.findIndex(
              (a) => a.email.toLowerCase() === j.email.toLowerCase(),
            );
            if (idx < 0 && j.sourceIdx != null) idx = j.sourceIdx;
            if (idx >= 0)
              this.store.setActive(
                idx,
                j.email,
                j.sessionToken,
                null,
                null,
                inj.path,
              );
            log("pending inject ✓ 路" + inj.path);
            return { ok: true, path: inj.path };
          }
        }
      }
      if (this.store.accounts.length === 0) {
        _notify("warn", "WAM: 无账号可切");
        return { ok: false };
      }
      // 始终按健康分降序排 (黑名单已排除) · 高配额账号优先
      // boot 首次切: 排除当前 active idx · 后续切: 也排除当前 active 避免回切自己
      const order = this.store.getSortedIndices(this.store.activeIdx);
      if (!this.bootRotateDone) this.bootRotateDone = true;
      // v3.3.0 · 池层分布透明 · 让用户看见道之运行
      const _tS = this.store._tierStats(this.store.activeIdx);
      log(
        "rotate: 候选 " +
          order.length +
          " 个 (按 score 降序) · " +
          "\uD83D\uDC8E" +
          _tS.ovg +
          " \uD83D\uDCCA" +
          _tS.pct +
          " \u23F3" +
          _tS.wait +
          " \uD83D\uDD12" +
          _tS.lock,
      );
      // v2.4.13b · rate-limit 早停 (知止所以不殆)
      //   Devin 返回 "Rate limit exceeded" 是 IP/device 级 · 全号都会 fail
      //   继续 for-loop 会把所有 73 可用号都失败 3 次入 15min 黑
      //   实测 thrash: 一次 rotate 扩展成 50+ 号 ban · 号池瞬间坍
      const RE_RATE_LIMIT = /rate.?limit|too.?many.?request|429/i;
      let rateLimitHit = false;
      for (const idx of order) {
        // v3.7.6 「一」 rotateNext 守门 — 跳过 D=0/W=0/过期账号 (道: 知止所以不殺)
        if (!_isValidAutoTarget(idx)) continue;
        const r = await loginAccount(this.store, idx);
        if (r.ok) return r;
        if (r.error && RE_RATE_LIMIT.test(String(r.error))) {
          rateLimitHit = true;
          log(
            "rotate: 遇 rate-limit · 早停 · 不继续试其他号 (防 ban thrash · 30s 冷却)",
          );
          _lastInjectFail = Date.now(); // 触发 _maybeTrigger 30s 冷却
          break;
        }
      }
      if (rateLimitHit) {
        _notify(
          "warning",
          "WAM: Devin rate-limit · 30s 内暂停切号 · 见 Output: WAM",
        );
        return { ok: false, stage: "rate-limit" };
      }
      _notify("error", "WAM: 所有账号都失败 · 见 Output: WAM");
      return { ok: false };
    } finally {
      this.rotating = false;
      _switching = false; // v3.0.1 · 与 _doAutoSwitch 对齐
      _broadcastUI();
    }
  }

  async panicSwitch() {
    log("panic: 紧急切下一号");
    return this.rotateNext();
  }

  async refreshAll() {
    log("refreshAll → verifyAllAccounts(onlyStale)");
    return verifyAllAccounts({ onlyStale: true });
  }

  async healthCheck() {
    log("healthCheck: 自诊断 + 自愈");
    let activeOk = false;
    if (
      this.store.activeApiKey &&
      typeof this.store.activeApiKey === "string" &&
      RE_SESSION_TOKEN.test(this.store.activeApiKey)
    ) {
      // v2.4.0 · 优先用 registerUser 返回的动态 apiServerUrl (修复 v2.1.1 硬打 codeium 问题)
      const q = await tryFetchPlanStatus(this.store.activeApiKey, {
        apiServerUrl: this.store.activeApiServerUrl,
      });
      activeOk = !!q;
      if (q && this.store.activeEmail)
        this.store.setHealth(this.store.activeEmail, q);
    }
    log("healthCheck: active-token=" + (activeOk ? "✓" : "✗"));
    if (!activeOk && this.store.activeEmail) {
      log("自愈: rotateNext");
      await this.rotateNext();
    }
    _notify("info", "WAM 健康: " + (activeOk ? "✓ active有效" : "✗ 已自愈"));
    _broadcastUI();
    return { ok: activeOk };
  }

  startMonitor() {
    if (this.scanTimer) return;
    // v2.6.11 · min 5s (为 W%脉动信号争取实时性 · 原 30s 太慢·合并多次 send)
    const ms = Math.max(5000, _cfg("scanIntervalMs", 10000) | 0);
    log("monitor start · period=" + ms + "ms (v2.6.11 W%脉动真本源)");
    this.scanTimer = setInterval(() => {
      this._tick().catch((e) => log("tick err: " + (e.message || e)));
    }, ms);
  }

  stopMonitor() {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  // ── v2.1 _tick: 耗尽保护 · 预判候选 · 切号冷却 · 重试3次 · 重置等待 ──
  async _tick() {
    this.lastScanAt = Date.now();
    if (!_cfg("autoRotate", true)) return;
    // 切号锁超时保护 — 必须在 _switching 守卫之前 (v2.1 根治死代码)
    if (
      _switching &&
      _switchingStartTime > 0 &&
      Date.now() - _switchingStartTime > 120000
    ) {
      log("⚠️ switching lock timeout (>120s) — force release");
      _switching = false;
      _switchingStartTime = 0;
    }
    if (_switching || this.rotating) return;
    // v2.1.2 · 善行无辙迹 · 无活跃会话时主动 rotate (而非死等)
    // 触发条件: 有账号 · 有可用候选 · 距上次 rotate > 60s (避免抖动)
    if (!this.store.activeEmail || !this.store.activeApiKey) {
      const sinceRotate = Date.now() - (this.store.lastRotateAt || 0);
      if (
        this.store.accounts.length > 0 &&
        sinceRotate > 60000 &&
        Date.now() - _lastSwitchTime > 30000
      ) {
        const bestI = this.store.getBestIndex(-1);
        if (bestI >= 0) {
          log(
            "🌱 _tick: 无活跃会话 → 主动 rotate → " +
              this.store.accounts[bestI].email.substring(0, 20),
          );
          await this._doAutoSwitch(bestI, -1, "no-active");
        }
      }
      return;
    }

    // v2.4.0 · 优先用 registerUser 返回的动态 apiServerUrl
    //   修 v2.1.1 硬打 codeium 的核心漏洞: registerUser 返 self-serve.windsurf.com
    //   但 tick 仍打 codeium → 每分钟 401 · UI 数据永远陈年
    const q = await tryFetchPlanStatus(this.store.activeApiKey, {
      apiServerUrl: this.store.activeApiServerUrl,
    });
    if (!q) {
      log("tick: planStatus 拉空 · 跳过");
      return;
    }
    // v2.6.12 道恒无名 · 民自均焉 · W%脉动信号 (真本源 · 守一)
    //   原理: 每次 user send → 后端计费 → weekly% 减少 (Remaining%)
    //   两轮间 prevW% - newW% = 本轮 user send 总消耗
    //   外在文件 IO 全不必赖 · 零中间噪音 · 后端账即真账
    //
    //   v2.6.12 守一 (修 v2.6.11 跨账号假脉动 bug):
    //     · 必须同账号 (_lastQuotaEmail === activeEmail) 才比 W% (跨账号 ΔW% 是切号引起·非 send)
    //     · 真脉动 → 设 _lastQuotaPulseAt → 后续 N 秒内 WAL/pb 让位 (主信号优先)
    const pulseMinDelta = Math.max(
      0.01,
      +_cfg("quotaPulseMinDelta", 0.3) || 0.3,
    );
    const curEmail = this.store.activeEmail || "";
    if (
      _lastQuotaWeekly >= 0 &&
      _lastQuotaEmail === curEmail &&
      curEmail &&
      typeof q.weekly === "number" &&
      q.weekly >= 0 &&
      _lastQuotaWeekly - q.weekly >= pulseMinDelta
    ) {
      const dW = +(_lastQuotaWeekly - q.weekly).toFixed(3);
      _quotaPulseCount++;
      _lastQuotaPulseAt = Date.now(); // 守一 · 主信号窗口起点
      log(
        "\u26a1 W%\u8109\u52a8\u4fe1\u53f7#" +
          _quotaPulseCount +
          " \u00b7 W " +
          _lastQuotaWeekly.toFixed(2) +
          "% \u2192 " +
          q.weekly.toFixed(2) +
          "% \u00b7 \u0394=-" +
          dW +
          "% \u2192 \u89e6\u53d1\u5207\u53f7",
      );
      _maybeTrigger("\u26a1W%\u8109\u52a8", "-" + dW + "%");
    } else if (
      _lastQuotaWeekly >= 0 &&
      _lastQuotaEmail !== curEmail &&
      typeof q.weekly === "number" &&
      q.weekly >= 0 &&
      Math.abs(_lastQuotaWeekly - q.weekly) >= pulseMinDelta
    ) {
      // 跨账号变化 · 屏蔽假脉动 · 仅诊断计数 (不打 log 噪音 · 仅累计)
      _quotaPulseSuppressedCount++;
    }
    // v2.6.13 阴阳结合 · ⚖额度变动信号 (阴·辅 · 与 W%脉动互补)
    //   原理: weekly% (阳·主·宏观百分比) ↔ daily%/promptCredits/flowCredits (阴·辅·微观+其他维度)
    //   反者道之动: 自彼则不见 · 自是则知之 · W% 自是 · ⚖ 自彼 · 阴阳互补显全象
    //   不冲突: 同入 _maybeTrigger · 同受 60s 强锁 · W%脉动主信号窗内 ⚖ 让位 (主 _maybeTrigger 已处理)
    //   防跨账号假脉动: 同 W% · 必 _lastQuotaEmail === curEmail 才比 (在更新 _lastQuotaEmail 之前)
    if (
      _cfg("quotaDeltaEnable", true) &&
      curEmail &&
      _lastQuotaEmail === curEmail
    ) {
      const creditsMin = Math.max(1, +_cfg("quotaDeltaCreditsMin", 1) || 1);
      const dailyMin = Math.max(0.01, +_cfg("quotaDeltaDailyMin", 0.3) || 0.3);
      const dDaily =
        _lastQuotaDaily >= 0 && typeof q.daily === "number" && q.daily >= 0
          ? _lastQuotaDaily - q.daily
          : 0;
      const dPC =
        _lastQuotaPromptCredits >= 0 &&
        typeof q.promptCredits === "number" &&
        q.promptCredits >= 0
          ? _lastQuotaPromptCredits - q.promptCredits
          : 0;
      const dFC =
        _lastQuotaFlowCredits >= 0 &&
        typeof q.flowCredits === "number" &&
        q.flowCredits >= 0
          ? _lastQuotaFlowCredits - q.flowCredits
          : 0;
      const triggers = [];
      if (dDaily >= dailyMin) triggers.push("D-" + dDaily.toFixed(2) + "%");
      if (dPC >= creditsMin) triggers.push("PC-" + dPC);
      if (dFC >= creditsMin) triggers.push("FC-" + dFC);
      if (triggers.length > 0) {
        _quotaDeltaCount++;
        log(
          "\u2696 \u989d\u5ea6\u53d8\u52a8\u4fe1\u53f7#" + // ⚖ 额度变动信号#
            _quotaDeltaCount +
            " \u00b7 " + // ·
            triggers.join(",") +
            " \u2192 \u89e6\u53d1\u5207\u53f7", // → 触发切号
        );
        _maybeTrigger("\u2696\u989d\u5ea6\u53d8\u52a8", triggers.join(",")); // ⚖额度变动
      }
    }
    // 基线统一更新 (W% + ⚖ 同步) · 切号后 setActive 已清 -1 · 此处只更非负值
    _lastQuotaWeekly =
      typeof q.weekly === "number" ? q.weekly : _lastQuotaWeekly;
    _lastQuotaEmail = curEmail;
    _lastQuotaDaily =
      typeof q.daily === "number" && q.daily >= 0 ? q.daily : _lastQuotaDaily;
    _lastQuotaPromptCredits =
      typeof q.promptCredits === "number" && q.promptCredits >= 0
        ? q.promptCredits
        : _lastQuotaPromptCredits;
    _lastQuotaFlowCredits =
      typeof q.flowCredits === "number" && q.flowCredits >= 0
        ? q.flowCredits
        : _lastQuotaFlowCredits;
    this.store.setHealth(this.store.activeEmail, q);
    _broadcastUI();

    const activeI = this.store.activeIdx;
    const acc = activeI >= 0 ? this.store.accounts[activeI] : null;
    if (!acc) return;
    const threshold = _cfg("autoSwitchThreshold", 5);
    const predictiveThreshold = _cfg("predictiveThreshold", 25);
    const switchCooldownMs = _cfg("switchCooldownMs", 15000);
    const waitResetHours = _cfg("waitResetHours", 3);
    const drought = isWeeklyDrought();
    const effQuota = drought ? q.daily : Math.min(q.daily, q.weekly);
    const hrsToDaily = hoursUntilDailyReset();
    const hrsToWeekly = hoursUntilWeeklyReset();

    // ── 预判候选: 额度 < predictiveThreshold% 时提前预选 ──
    if (effQuota < predictiveThreshold && _predictiveCandidate < 0) {
      _predictiveCandidate = this.store.getBestIndex(activeI);
      if (_predictiveCandidate >= 0)
        log(
          "🔮 预判: 额度" +
            effQuota.toFixed(0) +
            "%<" +
            predictiveThreshold +
            "%, 预选→" +
            this.store._tierOf(_predictiveCandidate) +
            " " + // v3.3.0 池层标
            this.store.accounts[_predictiveCandidate].email.substring(0, 20),
        );
    }
    if (effQuota >= predictiveThreshold) _predictiveCandidate = -1;

    // ── 耗尽保护 v3.9.1: 双层防卡死 (道法自然·知止不殆) ──
    //
    // v15.0 (3.11.6) · 道法自然 · 知不知尚矣 · 与 _isValidAutoTarget/_scoreOf 一以贯之
    //   ★ 用户实地反馈根因 (2026-05-28 截图):
    //     julioleyfarley · D91% W0% · PC10K + FC20K · "Trial - Quota Exhausted" 红字
    //     旧逻辑: !_hasCreditsActive && (W=0) = !true && true = false → 不切号
    //     credits 充裕的 W=0 号 = 永久免死金牌 · 系统失明
    //   ★ 实证: Cascade premium model (Claude/GPT-4) 只看 weekly% 计费
    //     credits (PC/FC) 是给 Devin agent 用 · 非给 Cascade
    //     W=0 时 Cascade 后端 429/403 拒服 · 与 credits 余量无关
    //   ★ 治法: credits 不再单独兜底硬耗尽 · 仅 overage 真金可救场
    //     兼容开关 creditsBypassQuotaGate (默 false · 严守 quota%)
    //
    // v3.7.6 旧逻辑 (已修正): credits 豁免硬耗尽
    // v3.9.1 双层分离 (保留):
    //   硬耗尽 (D≤0 或 W≤0): 账号已死 → bypass 冷却 / 重置等待 / skipAutoSwitch
    //   软耗尽 (>0% 且 <阈值): 仍可用 → 尊重所有守卫 (用户主动消耗权)
    //
    // 道义辨别:
    //   锁 (skipAutoSwitch) = 用户「主动消耗权」· 1%-100% 范围内尊重之
    //   0% 时账号已死 · 「主动消耗权」自然失效 (无可消耗) · 锁成困局 → 必须越权接替
    //   损之又损，以至于无为. 损至零，则强为之，非违心，乃顺势 (《老子》四十八)
    const _hActive = this.store.getHealth(acc.email);
    const _hasCreditsActive = _hasUsableCredits(_hActive);
    // v15.0 · credits 旁路开关 (默 false · 严守 quota%)
    const _creditsBypassExhaust =
      typeof _cfg === "function"
        ? !!_cfg("creditsBypassQuotaGate", false)
        : false;
    // v15.0 · 真硬耗尽: D=0 或 W=0 → 立即硬耗尽 (除非 overage 真金或兼容开关 ON)
    //   overageActive: Extra Usage Balance · Cascade 也认 · 真金白银 → 救场
    //   creditsBypass=true: 兼容老逻辑 · 适用纯 Devin agent (非 Cascade premium)
    const isHardExhausted =
      !_hActive.overageActive &&
      !(_creditsBypassExhaust && _hasCreditsActive) &&
      (drought
        ? q.daily <= 0 // 干旱模式: D 归零即彻底卡死
        : q.daily <= 0 || q.weekly <= 0); // 正常模式: D 或 W 任一归零均需切
    // v15.0 · 软耗尽: 同样的语义对齐 · credits 不再单独豁免软耗尽
    const isSoftExhausted =
      !isHardExhausted &&
      !_hActive.overageActive &&
      !(_creditsBypassExhaust && _hasCreditsActive) &&
      effQuota < threshold;
    const switchCooldown = Date.now() - _lastSwitchTime < switchCooldownMs;

    // ─── 硬耗尽: 账号已死 · bypass 冷却 · bypass 重置等待 · bypass skipAutoSwitch ───
    if (isHardExhausted && !_switching) {
      const reason = drought
        ? "Daily硬耗尽(0%)"
        : q.daily <= 0
          ? "Daily耗尽(0%)"
          : "Weekly耗尽(0%)";
      // v3.9.1 越权日志: 让用户透明看到锁被绕过的真因
      if (acc.skipAutoSwitch) {
        log(
          "🚨 硬耗尽越权 skipAutoSwitch: " +
            reason +
            " · 当前号 🔒 已锁 · 但 0% 已无消耗权 · 强制接替救场",
        );
      }
      // v3.1.3 守门贯通: 预选 + 候补均需验证有效额度
      let bestI = _isValidAutoTarget(_predictiveCandidate)
        ? _predictiveCandidate
        : this.store.getBestIndex(activeI);
      if (bestI >= 0 && !_isValidAutoTarget(bestI)) bestI = -1;
      if (bestI >= 0) {
        log(
          "🚨 硬耗尽强切: " +
            reason +
            " → " +
            this.store._tierOf(bestI) +
            " " + // v3.3.0 池层标
            this.store.accounts[bestI].email.substring(0, 20),
        );
        await this._doAutoSwitch(bestI, activeI, "hard-exhaust");
      } else {
        log("硬耗尽: " + reason + ", 无可用账号");
        _notify("warn", "WAM: ⚠️ " + reason + "，全部账号额度已耗尽");
      }
      // ─── 软耗尽: 仍有余量 · 感知 reset 时间 · 尊重冷却 · 尊重用户锁 ───
      //   1%-100% 范围内 skipAutoSwitch 守卫保留 (用户主动消耗权 · 道法自然)
    } else if (
      isSoftExhausted &&
      !_switching &&
      !switchCooldown &&
      !acc.skipAutoSwitch
    ) {
      // v3.4.1 · 临期保留: 当前号是临期抢救目标 → 不触发耗尽保护 (第四重冲突根治)
      const _hCur = this.store.getHealth(acc.email);
      const _expiryFirstCfg = _cfg("expiryFirst", true);
      if (
        _expiryFirstCfg &&
        _hCur.planEnd > 0 &&
        _hCur.planEnd >= Date.now() &&
        _hCur.daysLeft < 7 &&
        effQuota > 0
      ) {
        if (this.lastScanAt % 10 === 0) {
          log(
            "⏳ 临期保留: daysLeft=" +
              _hCur.daysLeft +
              " effQ=" +
              effQuota.toFixed(0) +
              "% → 不触发耗尽保护",
          );
        }
        return;
      }
      // 重置等待: Daily/Weekly 即将重置 → 不切号 (v3.9.1: 加 >0 守卫 — 仅 >0% 时等待才有意义)
      if (q.daily > 0 && q.daily < threshold && hrsToDaily <= waitResetHours) {
        log(
          "⏳ Daily低额(" +
            q.daily.toFixed(1) +
            "%) 但" +
            hrsToDaily.toFixed(1) +
            "h后重置 → 等待",
        );
        return;
      }
      if (
        !drought &&
        q.daily >= threshold &&
        q.weekly > 0 &&
        q.weekly < threshold &&
        hrsToWeekly <= waitResetHours
      ) {
        log(
          "⏳ Weekly低额(" +
            q.weekly.toFixed(1) +
            "%) 但" +
            hrsToWeekly.toFixed(1) +
            "h后重置 → 等待",
        );
        return;
      }
      const reason = drought
        ? "Daily低额(" + q.daily.toFixed(0) + "%)"
        : q.weekly < threshold
          ? "Weekly低额(" + q.weekly.toFixed(0) + "%)"
          : "Daily低额(" + q.daily.toFixed(0) + "%)";
      // v3.1.3 · effQuota 守门贯通: 预选 + 候补均需验证有效额度
      let bestI = _isValidAutoTarget(_predictiveCandidate)
        ? _predictiveCandidate
        : this.store.getBestIndex(activeI);
      if (bestI >= 0 && !_isValidAutoTarget(bestI)) bestI = -1;
      if (bestI >= 0) {
        log(
          "⚡ 软耗尽切号: " +
            reason +
            " → " +
            this.store._tierOf(bestI) +
            " " + // v3.3.0 池层标
            this.store.accounts[bestI].email.substring(0, 20),
        );
        await this._doAutoSwitch(bestI, activeI, "exhaust");
      } else {
        log("软耗尽: " + reason + ", 无可用账号");
        _notify("warn", "WAM: " + reason + "，无空闲账号");
      }
    } else if (!isHardExhausted && !isSoftExhausted) {
      // ── 时间轮转: rotatePeriodMs > 0 时 · 定期换号防检测 (兵无常势) ──
      const rotatePeriodMs = Math.max(0, _cfg("rotatePeriodMs", 0) | 0);
      if (
        rotatePeriodMs > 0 &&
        _lastSwitchTime > 0 &&
        Date.now() - _lastSwitchTime > rotatePeriodMs &&
        !acc.skipAutoSwitch
      ) {
        const bestI2 = this.store.getBestIndex(activeI);
        if (bestI2 >= 0) {
          log(
            "⏰ 时间轮转: " +
              Math.round((Date.now() - _lastSwitchTime) / 60000) +
              "min已过 · 换→ " +
              this.store._tierOf(bestI2) +
              " " + // v3.3.0 池层标
              this.store.accounts[bestI2].email.substring(0, 20),
          );
          await this._doAutoSwitch(bestI2, activeI, "time-rotate");
        }
      } else if (this.lastScanAt % 5 === 0) {
        log("tick: D" + q.daily + "% W" + q.weekly + "% ok");
      }
    }
  }

  // ── 自动切号核心 (含 3 次重试 · 流式避让 · 对齐本源 v17.42.20) ──
  async _doAutoSwitch(bestI, excludeI, tag) {
    _switching = true;
    _switchingStartTime = Date.now();
    this.rotating = true;
    _broadcastUI();
    try {
      // v17.42.5 太上不知有之: cascade 流式避让 · 对话永不被打断
      await _waitIfCascadeBusy(15000);
      let switchOk = false;
      // v3.1.3 · 首次候选守门 (getBestIndex 返低分号仍需 effQ 验证)
      if (!_isValidAutoTarget(bestI)) {
        log(tag + ": 首候选 effQ 不足 · 跳过");
        bestI = -1;
      }
      for (let _retry = 0; _retry < 3 && !switchOk; _retry++) {
        if (_retry > 0 || bestI < 0) {
          bestI = this.store.getBestIndex(excludeI);
          if (bestI < 0) break;
          // v3.1.3 · 重试守门: 验证候选有效额度
          if (!_isValidAutoTarget(bestI)) {
            log(tag + "-retry#" + _retry + ": 候选 effQ 不足 · 跳过");
            break; // 无有效候选 · 不浪费重试
          }
          log(
            tag +
              "-retry#" +
              _retry +
              ": → " +
              this.store.accounts[bestI].email.substring(0, 20),
          );
        }
        const sr = await loginAccount(this.store, bestI);
        if (sr.ok) {
          _lastSwitchTime = Date.now();
          _predictiveCandidate = this.store.getBestIndex(bestI);
          if (_predictiveCandidate >= 0)
            log(
              "🔮 预选下一个: → " +
                this.store.accounts[_predictiveCandidate].email.substring(
                  0,
                  20,
                ),
            );
          const autoMs = Date.now() - _switchingStartTime;
          _notify(
            "verbose",
            "WAM: " +
              tag +
              " → " +
              (this.store.activeEmail || "?") +
              " · " +
              autoMs +
              "ms",
          );
          switchOk = true;
        } else if (sr.error && /登录失败/.test(sr.error)) {
          log(tag + " FAIL#" + _retry + ": " + sr.error + " — 尝试下一个");
          continue;
        } else {
          // 注入失败 → 短暂等待后重试
          if (_retry < 2) {
            log(
              tag +
                " FAIL#" +
                _retry +
                ": " +
                (sr.error || "?") +
                " — 3s后重试",
            );
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          log(tag + " FAIL: " + (sr.error || "?"));
          _predictiveCandidate = -1;
          break;
        }
      }
      if (!switchOk) _predictiveCandidate = -1;
    } finally {
      _switching = false;
      this.rotating = false;
      _broadcastUI();
    }
  }
}

// ═══ activate / deactivate ═══
async function activate(context) {
  _ctx = context;
  _output = vscode.window.createOutputChannel("WAM");
  context.subscriptions.push(_output);
  log("WAM v" + VERSION + " activate · pid=" + process.pid);
  // v3.13.0 · 早期自适应命令检测 · 尽早发现 Devin Desktop 命令命名
  _detectAuthCommands().then(() => {
    log("WAM v" + VERSION + " authProvider=" + (_detectedAuthProvider || "?"));
  });
  ensureDir(WAM_DIR);
  // v2.1.2 · 唯变所适 · 首次启动播种 (扩展安装目录有 账号库最新.md → 复制到 ~/.wam/accounts.md)
  // 居善地: 用户 .wam/accounts.md 优先 · 本扩展自带的 账号库最新.md 仅在用户库不存在时引种
  try {
    const userAccountsMd = path.join(WAM_DIR, "accounts.md");
    if (!fs.existsSync(userAccountsMd) && fs.existsSync(ACCOUNTS_DEFAULT_MD)) {
      fs.copyFileSync(ACCOUNTS_DEFAULT_MD, userAccountsMd);
      log("🌱 seed: 首次启动 · 复制扩展内置账号库 → " + userAccountsMd);
    }
  } catch (e) {
    log("seed: " + (e.message || e));
  }
  // v3.1.4 · openExternal 守卫延迟到 mode 加载后按需安装
  // WAM模式: 装守卫 (切号无弹窗) · 官方模式: 不装 (放行浏览器登录)
  // guard 的安装移至下方 wamMode 加载后的条件分支
  context.subscriptions.push({
    dispose: () => _removeOpenExternalGuard(),
  });
  // v3.1.1 · 顺其自然·从盘上加载 sessionCache · 跨重启不丢
  //   sessionToken JWT 实际有效 数小时-数天 · 远超 in-memory 15min · 持久化即顺
  //   全部账号秒切 · 不再触 devinLogin · 不再受 IP 限速
  const _cacheLoaded = _loadSessionCacheFromDisk();
  if (_cacheLoaded > 0) {
    log("sessionCache: 加载 " + _cacheLoaded + " 号 (重启不丢·秒切常态)");
  }
  // deactivate 时同步落盘 (清 debounce 即时 flush)
  context.subscriptions.push({
    dispose: () => {
      try {
        if (_persistDebounceTimer) clearTimeout(_persistDebounceTimer);
        _persistDebounceTimer = null;
        // 同步落盘
        const obj = {};
        const now = Date.now();
        for (const [email, c] of _sessionCache.entries()) {
          if (now - c.cachedAt < SESSION_CACHE_DISK_TTL_MS) {
            obj[email] = {
              sessionToken: c.sessionToken,
              apiKey: c.apiKey || "",
              apiServerUrl: c.apiServerUrl || "",
              cachedAt: c.cachedAt,
            };
          }
        }
        atomicWrite(SESSION_CACHE_FILE, JSON.stringify(obj, null, 0));
      } catch {}
    },
  });
  _store = new Store();
  _store.load();
  _store.reloadAccounts();
  // v2.4.4 · activate 时清 >24h orphan (accounts 已无的残留 health)
  _store.pruneOrphanHealth();
  // v2.4.4 · activate 时扫 .tmp 孤儿 (atomicWrite 历史漏)
  sweepOrphanTmp();
  _store.save();
  log(
    "accounts loaded: " +
      _store.accounts.length +
      " from " +
      (_store.accountsSource || "<none>"),
  );
  // v3.0.2 · lock-state.json 跨窗口实时锁同步监视器
  //   原理: Window A toggleSkip 写 lock-state.json → fs.watchFile 通知 Window B
  //           Window B 收到通知 → reloadAccounts() + _broadcastUI() → UI 即时同步锁状态
  let _lockWatchDebounce = null;
  try {
    fs.watchFile(LOCK_FILE, { persistent: false, interval: 1000 }, () => {
      clearTimeout(_lockWatchDebounce);
      _lockWatchDebounce = setTimeout(() => {
        if (_store) {
          log(
            "lockWatcher: lock-state.json 变更 → reloadAccounts + broadcastUI",
          );
          _store.reloadAccounts();
          _broadcastUI();
        }
      }, 500);
    });
    context.subscriptions.push({
      dispose: () => {
        try {
          fs.unwatchFile(LOCK_FILE);
        } catch {}
        clearTimeout(_lockWatchDebounce);
      },
    });
    log("lockWatcher: 监视 " + LOCK_FILE);
  } catch (e) {
    log("lockWatcher init err: " + (e.message || e));
  }
  // v3.5.0 · 道法自然 · 卡住状态栏 (持久可见 · 永不消失直到恢复)
  // 独立于主 statusBar · 左对齐最高优先级 · 红色醒目 · 用户一眼可见
  _stuckStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1000,
  );
  _stuckStatusBar.command = "wam.openEditor";
  _stuckStatusBar.hide(); // 初始隐藏 (无卡住时不显示)
  context.subscriptions.push(_stuckStatusBar);

  // v3.5.0 · Hub 总线监视器 + 轮询保底 (dao_stuck → _hub.json → WAM 扩展)
  _installHubWatcher(context);
  // v3.10.0 · 归一 · 卡住检测引擎自动启动 (道生之·德畜之)
  // 延迟3秒启动 (让 Hub watcher 先就绪 · 引擎写 _hub.json 时 watcher 立即响应)
  setTimeout(() => _launchStuckEngine(), 3000);
  context.subscriptions.push({ dispose: () => _stopStuckEngine() });
  // v4.0 · 密钥自动发现 (异步 · 不阻塞)
  _initDecryptKey();
  // v13.0 · 对话标题缓存预加载 (备份索引 uuid→title · 开启即加载)
  setTimeout(() => _refreshConvTitleMap(), 5000);
  // v3.6.0 · 自动备份系统 (启动即备+增量监视+目录迁移)
  _initAutoBackup(context);
  // v3.6.0 · Agent API 接口文件 (供外部 Agent 直接调用)
  _writeAgentApi();
  _engine = new Engine(_store);

  _statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  _statusBar.command = "wam.openEditor";
  context.subscriptions.push(_statusBar);
  updateStatusBar();
  _statusBar.show();

  _sidebarProvider = new WamViewProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("wam.panel", _sidebarProvider),
  );

  const cmds = [
    ["wam.openEditor", () => openEditorPanel()],
    [
      "wam.status",
      async () => {
        const stats = _store.getStats();
        const h = _store.activeEmail
          ? _store.getHealth(_store.activeEmail)
          : null;
        const lines = [
          "WAM v" + VERSION,
          "current: " + (_store.activeEmail || "-"),
          "token:   " + (_store.activeTokenShort || "-"),
          "path:    " + (_store.lastInjectPath || "-"),
          "accounts:" +
            stats.pwCount +
            " · 可用" +
            stats.available +
            " · 切" +
            stats.switches,
          h && h.checked
            ? "quota:   D" +
              Math.round(h.daily) +
              "% W" +
              Math.round(h.weekly) +
              "% " +
              (h.plan || "")
            : "quota:   (未验)",
          "auto:    " +
            (_cfg("autoRotate", true) ? "on" : "off") +
            " · 阈值=" +
            _cfg("autoSwitchThreshold", 5) +
            "%",
          "source:  " + (_store.accountsSource || "-"),
        ];
        const c = await vscode.window.showInformationMessage(
          lines.join(" | "),
          "Open Log",
          "Open Panel",
        );
        if (c === "Open Log") _output.show();
        else if (c === "Open Panel")
          vscode.commands.executeCommand("wam.panel.focus");
      },
    ],
    [
      "wam.switchAccount",
      async () => {
        if (_store.accounts.length === 0) {
          vscode.window.showWarningMessage(
            "WAM: 无账号 (从 " + (_store.accountsSource || "?") + ")",
          );
          return;
        }
        const items = _store.accounts.map((a, i) => {
          const h = _store.getHealth(a.email);
          const banned = _store.isBanned(a.email);
          return {
            label: (i === _store.activeIdx ? "$(check) " : "  ") + a.email,
            description: banned
              ? "✗ 黑名单"
              : h.checked
                ? "D" +
                  Math.round(h.daily) +
                  "% W" +
                  Math.round(h.weekly) +
                  "% " +
                  (h.plan || "")
                : "未验",
            idx: i,
          };
        });
        const pick = await vscode.window.showQuickPick(items, {
          placeHolder: "选择账号 · 当前: " + (_store.activeEmail || "无"),
          matchOnDescription: true,
        });
        if (!pick || pick.idx === _store.activeIdx) return;
        _engine.rotating = true;
        _switching = true; // v3.0.1 · 命令面板切号同步 _switching
        _switchingStartTime = Date.now(); // v3.0.1
        _broadcastUI();
        try {
          const r = await loginAccount(_store, pick.idx);
          if (r.ok) _notify("info", "WAM: ✓ " + _store.activeEmail);
          else _notify("error", "WAM: ✗ " + r.stage + ": " + r.error);
        } finally {
          _engine.rotating = false;
          _switching = false; // v3.0.1
          _broadcastUI();
        }
      },
    ],
    ["wam.panicSwitch", () => _engine.rotateNext()],
    [
      "wam.refreshAll",
      async () => {
        if (_verifyAllInProgress) {
          _notify("warn", "WAM: 验证已在运行");
          return;
        }
        _notify("info", "WAM: 开始验证 stale 账号·仅未验+老快照");
        const r = await verifyAllAccounts({ onlyStale: true });
        if (r.ok)
          _notify(
            "info",
            "WAM refreshAll: " +
              r.ok +
              " ✓ / " +
              r.fail +
              " ✗ · " +
              r.durSec +
              "s",
          );
      },
    ],
    [
      "wam.addAccount",
      async () => {
        const text = await vscode.window.showInputBox({
          prompt:
            "邮箱密码 (任意分隔: 空格/Tab/:/----/|/,/;) · 也可粘贴 token 直登",
          placeHolder:
            "foo@bar.com mypass  或  email:pass  或  devin-session-token$…",
        });
        if (!text) return;
        const r = _store.addBatch(text);
        let info = "添加 " + r.added + " 个 · 跳重 " + r.duplicate;
        const tks = r.tokens || [];
        if (tks.length > 0) {
          const inj = await injectToken(tks[0]);
          if (inj.ok) {
            _store.lastInjectPath = inj.path;
            _store.activeTokenShort = (tks[0] || "").substring(0, 24) + "…";
            _store.save();
            info += " · token直登 ✓ 路" + inj.path;
          } else {
            info += " · token直登 ✗ " + (inj.note || inj.path);
          }
        }
        _notify("info", "WAM: " + info);
        _store.reloadAccounts();
        _broadcastUI();
      },
    ],
    [
      "wam.injectToken",
      async () => {
        const t = await vscode.window.showInputBox({
          prompt:
            "粘贴 token · 支持 devin-session-token$/eyJ JWT/auth1_/原始base64",
          placeHolder: "devin-session-token$… 或 eyJ… 或 auth1_…",
        });
        if (!t) return;
        // 通过统一解析器 · 支持用户粘 JSON / 多行 / 带 "token: " 前缀 等任意形式
        const parsed = parseAccountText(t);
        const tk = (parsed.tokens && parsed.tokens[0]) || t.trim();
        const inj = await injectToken(tk);
        if (inj.ok) {
          _notify("info", "WAM: 注入 ✓ 路" + inj.path);
          _store.lastInjectPath = inj.path;
          _store.activeTokenShort = (tk || "").substring(0, 24) + "…";
          _store.save();
          _broadcastUI();
        } else _notify("error", "WAM: 注入 ✗ 路" + inj.path + ": " + inj.note);
      },
    ],
    [
      "wam.verifyAll",
      async () => {
        if (_verifyAllInProgress) {
          _notify("warn", "WAM: 验证已在运行");
          return;
        }
        // v2.4.0 · endpoint 已挂时提醒并询问 (反者道之动 · 知止可以不殆)
        if (_quotaEndpointDead()) {
          const pick = await vscode.window.showWarningMessage(
            "WAM: GetPlanStatus endpoint 已挂 (连续 " +
              _quotaEndpointHealth.consecutive401 +
              " 次 401) · 全量验证大概率失败 · 仍要试?",
            "强制验证",
            "查看诊断",
            "取消",
          );
          if (pick === "查看诊断") {
            vscode.commands.executeCommand("wam.endpointHealth");
            return;
          }
          if (pick !== "强制验证") return;
          // 强制验证 · 重置 endpoint 健康 (允许试一次)
          _quotaEndpointHealth.consecutive401 = 0;
          log("verifyAll: 用户强制 · 重置 endpoint 健康度");
        }
        _notify(
          "info",
          "WAM: 全量验证 " +
            _store.accounts.length +
            " 个号 · 并行 " +
            (_cfg("verify.parallel", 3) | 0 || 3) +
            " · 预计 " +
            Math.ceil(_store.accounts.length / 3) * 3 +
            "s",
        );
        const r = await verifyAllAccounts({ onlyStale: false });
        if (r.ok) {
          // 验后统计过期号 (仅提示·不自动删)
          let expired = 0;
          for (const a of _store.accounts) {
            const h = _store.getHealth(a.email);
            if (h.checked && h.daysLeft === 0 && h.planEnd > 0) expired++;
          }
          _notify(
            "info",
            "WAM verifyAll: " +
              r.ok +
              " ✓ / " +
              r.fail +
              " ✗ · " +
              r.durSec +
              "s" +
              (expired > 0 ? " · " + expired + " 过期" : ""),
          );
        }
      },
    ],
    [
      "wam.scanExpiry",
      async () => {
        let warn = [];
        for (const a of _store.accounts) {
          const h = _store.getHealth(a.email);
          if (h.daysLeft > 0 && h.daysLeft <= 3)
            warn.push(a.email + " " + h.daysLeft + "天");
        }
        _notify(
          "info",
          "WAM 有效期: 危急 " +
            warn.length +
            " 个 · " +
            warn.slice(0, 3).join(" / ") +
            (warn.length > 3 ? " ..." : ""),
        );
      },
    ],
    ["wam.healthCheck", () => _engine.healthCheck()],
    [
      "wam.clearBlacklist",
      () => {
        const n = _store.clearBlacklist();
        _notify("info", "WAM: 清空黑名单 (" + n + " 个)");
        _broadcastUI();
      },
    ],
    [
      "wam.clearAllInUse",
      () => {
        // v2.3.0 · 手清使用中锁 (调试用 · 有事不足以取天下)
        const n = _store.clearAllInUse();
        _notify("info", "WAM: 清空使用中🔒 (" + n + " 个)");
        log("clearAllInUse · 清 " + n + " 个 in-use 锁");
        _broadcastUI();
      },
    ],
    [
      "wam.clearAllHealth",
      async () => {
        // v2.4.0 · 手动重置全部 health · 用户可从干净开始
        // 反者道之动 · 当陈年数据/D=W 污染遮蔽真象时, 清空让真象自显
        const n = Object.keys(_store.health).length;
        const pick = await vscode.window.showWarningMessage(
          "WAM: 确认清空全部 " + n + " 条 health 数据? · 此操作不可撤销",
          { modal: true },
          "清空",
          "取消",
        );
        if (pick !== "清空") return;
        const cleared = _store.clearAllHealth();
        _notify("info", "WAM: 已清空 " + cleared + " 条 health · 从干净开始");
        log("clearAllHealth · 清 " + cleared + " 条 health");
        _broadcastUI();
      },
    ],
    [
      "wam.endpointHealth",
      () => {
        // v2.4.0 · 查看 GetPlanStatus endpoint 健康度 · 诊断用
        const e = _quotaEndpointHealth;
        const ageMin = e.lastSuccess
          ? Math.round((Date.now() - e.lastSuccess) / 60000)
          : -1;
        const dead = _quotaEndpointDead();
        const msg =
          "GetPlanStatus 端点状态:\n" +
          "  调用 " +
          e.totalCalls +
          " · 成 " +
          e.totalOk +
          " · 败 " +
          e.totalFail +
          "\n  连续 401: " +
          e.consecutive401 +
          " · 连续成功: " +
          e.consecutiveOk +
          "\n  最近成功: " +
          (ageMin >= 0 ? ageMin + "分前" : "从未") +
          "\n  最近失败: " +
          (e.lastFailReason || "—") +
          "\n  状态: " +
          (dead ? "✗ 已挂 (跳过批量验证)" : "✓ 可用");
        _notify("info", msg);
        log(
          "endpointHealth · " +
            JSON.stringify({
              ..._quotaEndpointHealth,
              dead,
              ageMin,
            }),
        );
      },
    ],
    [
      "wam.toggleAutoRotate",
      async () => {
        const cur = _cfg("autoRotate", true);
        await vscode.workspace
          .getConfiguration("wam")
          .update("autoRotate", !cur, vscode.ConfigurationTarget.Global);
        _notify("info", "WAM auto-rotate: " + (!cur ? "on" : "off"));
        _broadcastUI();
      },
    ],
    ["wam.show", () => _output.show()],
    [
      "wam.setModeWam",
      async () => {
        // v3.2.0 · 三处归一
        const changed = await _setMode("wam");
        if (!changed) _notify("info", "WAM: 已是 WAM 模式");
        else _notify("info", "WAM: 切 WAM 切号模式 · 引擎启");
      },
    ],
    [
      "wam.setModeOfficial",
      async () => {
        // v3.2.0 · 三处归一
        const changed = await _setMode("official");
        if (!changed) _notify("info", "WAM: 已是官方登录模式");
        else _notify("info", "WAM: 切官方登录模式 · 已登出 · 可用官方登录");
      },
    ],
  ];
  for (const [name, fn] of cmds) {
    context.subscriptions.push(vscode.commands.registerCommand(name, fn));
  }

  // ── wamMode 加载 (持久化) · 默认 wam ──
  try {
    const savedMode =
      (context.globalState && context.globalState.get("wam.mode")) || "wam";
    _wamMode = savedMode === "official" ? "official" : "wam";
    log("wamMode: " + _wamMode + " (loaded)");
  } catch {}

  // v3.1.4 · mode 已加载 → 按需安装 openExternal 守卫
  //   WAM 模式: 装守卫 (切号无弹窗)
  //   官方模式: 不装 (放行 windsurf.login 弹浏览器)
  if (_wamMode === "wam") {
    _installOpenExternalGuard();
    log("activate: WAM 模式 · guard 已装");
  } else {
    log("activate: 官方模式 · guard 不装 · 放行官方登录");
  }

  if (_store.accounts.length > 0 && _wamMode === "wam") {
    const delay = Math.max(1000, _cfg("startupDelayMs", 3500) | 0);
    log("scheduling first rotate in " + delay + "ms");
    const t = setTimeout(async () => {
      try {
        // v2.1 启动恢复: 如有持久化活跃号 → 尝试复用而非新轮转
        if (_store.activeIdx >= 0 && _store.accounts[_store.activeIdx]) {
          const acc = _store.accounts[_store.activeIdx];
          const ah = _store.getHealth(acc.email);
          if (
            ah.checked &&
            Math.min(ah.daily, ah.weekly) >= _cfg("autoSwitchThreshold", 5)
          ) {
            log(
              "startup: 尝试恢复 " +
                acc.email.substring(0, 20) +
                " (D" +
                Math.round(ah.daily) +
                "% W" +
                Math.round(ah.weekly) +
                "%)",
            );
            const r = await loginAccount(_store, _store.activeIdx);
            if (r.ok) {
              log("startup: 恢复 ✓ 路" + r.path);
              _broadcastUI();
              return; // 跳过 rotateNext
            }
            log("startup: 恢复失败 → rotateNext");
          }
        }
        await _engine.rotateNext({ tryPending: true });
      } catch (e) {
        log("first rotate err: " + (e.stack || e.message || e));
      }
    }, delay);
    context.subscriptions.push({ dispose: () => clearTimeout(t) });

    // ── 内化原 "refresh" 按钮: 启动后自动 verifyAll(stale) ──
    // 太上不知有之 · 用户启动后看到所有号自动验完 · 不需手动点
    // v2.1.1: 首次使用 (>50% 未验) → 10s 即开始验证 · 用户更快看到额度
    const uncheckedPct =
      _store.accounts.filter((a) => !_store.getHealth(a.email).checked).length /
      Math.max(1, _store.accounts.length);
    const baseVerifyDelay = _cfg("autoVerifyOnStartupMs", 30000) | 0;
    const verifyDelay = Math.max(
      5000,
      uncheckedPct > 0.5 ? Math.min(baseVerifyDelay, 10000) : baseVerifyDelay,
    );
    if (verifyDelay > 0) {
      log(
        "scheduling auto verify(stale) in " +
          verifyDelay +
          "ms" +
          (uncheckedPct > 0.5
            ? " (首次加速 · " + Math.round(uncheckedPct * 100) + "% 未验)"
            : ""),
      );
      // v3.0.2 · 启动验证使用 autoVerifyStartupStaleMin (默认15min)
      //   旧法: 始终用 30min 阈值 · 重启后若所有号均 <30min 前验 → 全部跳过 → 用户看到旧额度
      //   新法: startupStaleMin 默认15min · 覆盖 verify.staleMin · 启动后15min内未验也会刷新
      const startupStaleMin = Math.max(
        1,
        _cfg("autoVerifyStartupStaleMin", 15) | 0,
      );
      const tv = setTimeout(() => {
        if (_wamMode !== "wam") return;
        if (_verifyAllInProgress) return;
        // v3.7.4 · 根治: 先查未验号 · 有则全量 · 不受 cache 状态影响
        //   病灶: v3.7.2 用 _sessionCache.size===0 作门 · 但 loadSessionCacheFromDisk
        //         在 activate 时已预加载 → size 永远 > 0 → 全量验证路径永远不走
        //   修法: 先查 unchecked 数量 → >0 则全量 → =0 才走 _cacheOnly 快路
        const _uncheckedOnStart = _store.accounts.filter(
          (a) => !_store.getHealth(a.email).checked,
        ).length;
        if (_uncheckedOnStart > 0) {
          // 有未验号 → 全量验证 (无论 cache 多满 · isFirstTime 保护自动激活)
          log(
            "🔄 auto-verify: " +
              _uncheckedOnStart +
              "/" +
              _store.accounts.length +
              " 未验 · 全量加速验证 · isFirstTime保护已激活",
          );
          verifyAllAccounts({ onlyStale: false }).catch((e) =>
            log("startup-verify err: " + (e.message || e)),
          );
          return;
        }
        // 无未验号 → 走原路
        if (_sessionCache.size === 0) {
          log("auto-verify(stale): cache空 · 无未验号 · 跳过");
          return;
        }
        // cache非空 · 无未验号 → stale 快路 (v3.7.1 兼容)
        log(
          "auto-verify(stale): _cacheOnly · cache=" +
            _sessionCache.size +
            " · startupStaleMin=" +
            startupStaleMin +
            "min",
        );
        verifyAllAccounts({
          onlyStale: true,
          startupStaleMin,
          _cacheOnly: true,
        }).catch((e) => log("auto-verify err: " + (e.message || e)));
      }, verifyDelay);
      context.subscriptions.push({ dispose: () => clearTimeout(tv) });
    }

    // ── 内化原 "verify" 按钮: 周期重验 (每 N 分钟) · 默认 30min ──
    const periodicVerifyMs = Math.max(
      0,
      _cfg("autoVerifyPeriodMs", 30 * 60 * 1000) | 0,
    );
    if (periodicVerifyMs > 0) {
      log("scheduling periodic verify(stale) every " + periodicVerifyMs + "ms");
      const ti = setInterval(() => {
        if (_wamMode !== "wam") return;
        if (_verifyAllInProgress) return;
        // v3.1.2 · _cacheOnly 模式 · 与启动同步 · 零 devinLogin
        // v3.7.4 · 周期验证同步根治: 先查未验号
        const _uncheckedPeriodic = _store.accounts.filter(
          (a) => !_store.getHealth(a.email).checked,
        ).length;
        if (_uncheckedPeriodic > 0) {
          log(
            "🔄 auto-verify(periodic): " +
              _uncheckedPeriodic +
              " 未验 · 全量验证",
          );
          verifyAllAccounts({ onlyStale: false }).catch((e) =>
            log("periodic-verify err: " + (e.message || e)),
          );
          return;
        }
        if (_sessionCache.size === 0) {
          log("auto-verify(stale): cache 空 · 无未验号 · 周期跳过");
          return;
        }
        log(
          "auto-verify(stale): 周期·_cacheOnly · cache=" + _sessionCache.size,
        );
        verifyAllAccounts({ onlyStale: true, _cacheOnly: true }).catch((e) =>
          log("periodic-verify err: " + (e.message || e)),
        );
      }, periodicVerifyMs);
      context.subscriptions.push({ dispose: () => clearInterval(ti) });
    }

    // v3.2.1 · 额度重置感知 · 精准定时唤醒
    //   每日 UTC 08:00 (北京 16:00) + 周日 UTC 08:00 (北京 周日 16:00)
    //   重置后自动全池刷新 · 耗尽号瞬间复活 · 用户无感
    _scheduleResetRefresh();
    context.subscriptions.push({
      dispose: () => {
        if (_resetRefreshTimer) {
          clearTimeout(_resetRefreshTimer);
          _resetRefreshTimer = null;
        }
      },
    });

    // ── v2.1.3: 一次性 force verify-all 触发器 (经标志文件 · 部署后清污染用) ──
    // 用法: touch ~/.wam/_trigger_force_verify_all → 重启 exthost → 自动跑 verifyAll(onlyStale:false) → 清标志
    try {
      const triggerFile = path.join(
        os.homedir(),
        ".wam",
        "_trigger_force_verify_all",
      );
      if (fs.existsSync(triggerFile)) {
        log(
          "force-verify-all: 标志文件存在 · 8s 后跑 verifyAll(onlyStale:false)",
        );
        const tf = setTimeout(() => {
          if (_wamMode !== "wam") return;
          if (_verifyAllInProgress) return;
          try {
            fs.unlinkSync(triggerFile);
          } catch (_) {}
          log("force-verify-all: 启动 · 全量 (含已验过的)");
          verifyAllAccounts({ onlyStale: false }).catch((e) =>
            log("force-verify-all err: " + (e.message || e)),
          );
        }, 8000);
        context.subscriptions.push({ dispose: () => clearTimeout(tf) });
      }
    } catch (e) {
      log("force-verify-all init err: " + (e.message || e));
    }
  } else if (_store.accounts.length === 0) {
    vscode.window.showWarningMessage(
      "WAM-min: 无账号 · 配 wam.accountsFile 或确保账号库文件存在",
    );
  } else if (_wamMode === "official") {
    log("activate: 官方登录模式 · 跳过启动切号 + 引擎不启");
  }

  if (_wamMode === "wam") {
    _engine.startMonitor();
    context.subscriptions.push({ dispose: () => _engine.stopMonitor() });
    // v15.0 · 启动硬耗尽看门狗 (独立 2s 周期 · 配合 _tick 10s 互补救场)
    _startHardExhaustWatchdog();
    context.subscriptions.push({ dispose: () => _stopHardExhaustWatchdog() });

    // ── 文档变化追踪 + Rate-limit 拦截器 (对齐本源 v17.42.5 / v17.42.20) ──
    // 双重职责:
    //   1. 所有文档变化 → 更新 _lastDocChangeAt → 供 _isCascadeBusy 流式避让
    //   2. rate-limit 关键字 → 主动无感切号 (不言之教 · 无为之益)
    try {
      const _docDisp = vscode.workspace.onDidChangeTextDocument((e) => {
        // 职责1: 追踪文档变化 (流式检测)
        _lastDocChangeAt = Date.now();
        // 职责2: rate-limit 拦截 (异步 · 不阻塞编辑器)
        if (_wamMode !== "wam" || _switching || !_store || _store.activeIdx < 0)
          return;
        if (!e.contentChanges.length) return;
        const lastChange = e.contentChanges[e.contentChanges.length - 1];
        if (!lastChange) return;
        const t = lastChange.text;
        if (!t || t.length < 20 || t.length > 500) return;
        if (!/rate.?limit.?exceeded|Rate limit error/i.test(t)) return;
        const cooldown =
          Date.now() - _lastSwitchTime < _cfg("switchCooldownMs", 15000);
        const injCd = Date.now() - _lastInjectFail < 30000;
        if (cooldown || injCd || !_cfg("autoRotate", true)) return;
        log("\uD83D\uDEA8 rate-limit intercepted! Proactive switch...");
        (async () => {
          let bestI = _isValidAutoTarget(_predictiveCandidate)
            ? _predictiveCandidate
            : _store.getBestIndex(_store.activeIdx);
          if (bestI < 0) {
            log("rate-limit: no available account");
            return;
          }
          // 流式避让: 让当前对话完成再切
          await _waitIfCascadeBusy(15000);
          _switching = true;
          _switchingStartTime = Date.now();
          _engine.rotating = true;
          _broadcastUI();
          try {
            const sr = await loginAccount(_store, bestI);
            if (sr.ok) {
              _lastSwitchTime = Date.now();
              _predictiveCandidate = _store.getBestIndex(bestI);
              _notify(
                "verbose",
                "WAM: \uD83D\uDEA8 Rate-limit \u2192 " +
                  (_store.activeEmail || "?"),
              );
            } else {
              _lastInjectFail = Date.now();
            }
          } finally {
            _switching = false;
            _engine.rotating = false;
            _broadcastUI();
          }
        })();
      });
      context.subscriptions.push(_docDisp);
      log("doc-tracker + rate-limit interceptor registered");
    } catch (e) {
      log("doc-tracker/rate-limit setup failed: " + (e.message || e));
    }

    // ── 活跃号 token 守护线程 (对齐本源 v17.42.5 _startActiveTokenGuardian) ──
    // 太上不知有之: 每 20min 静默验证活跃 token · 失效则自愈 (重新登录当前号)
    // 用户对话永不因 token 过期而卡顿 · 近零开销
    const _guardianMs = 20 * 60 * 1000;
    const _guardDelay = 25000; // 延迟 25s 启动 (避免与启动切号 / verify 叠加)
    const _guardTimer = setTimeout(() => {
      const _gInterval = setInterval(async () => {
        if (_wamMode !== "wam" || _switching || !_store) return;
        if (!_store.activeEmail || !_store.activeApiKey) return;
        try {
          // v2.4.0 · guardTimer 也用动态 apiServerUrl
          const q = await tryFetchPlanStatus(_store.activeApiKey, {
            apiServerUrl: _store.activeApiServerUrl,
          });
          if (q) {
            _store.setHealth(_store.activeEmail, q);
            _broadcastUI();
            return; // token 有效 · 无事
          }
          // token 无效 → 自愈: 重新登录当前号
          log(
            "🛡️ guardian: token invalid → re-login " +
              _store.activeEmail.substring(0, 20),
          );
          if (_store.activeIdx >= 0) {
            const r = await loginAccount(_store, _store.activeIdx);
            if (r.ok) {
              log("🛡️ guardian: re-login ✓ 路" + r.path);
              _broadcastUI();
            } else {
              log("🛡️ guardian: re-login ✗ → rotateNext");
              await _engine.rotateNext();
            }
          }
        } catch (e) {
          log("guardian: " + (e.message || e));
        }
      }, _guardianMs);
      context.subscriptions.push({ dispose: () => clearInterval(_gInterval) });
      log("active-token guardian started (20min cycle · 25s delay)");
    }, _guardDelay);
    context.subscriptions.push({ dispose: () => clearTimeout(_guardTimer) });

    // v2.6.3 · 三源共流 · 层层递进 · 必视无遗
    //   信号① pb·new   : cascade 目录新 .pb 文件 = 新对话 → 立即切号
    //   信号② pb·send  : 存量 .pb 安静期后增量 = 已有对话用户 send (3s 延迟)
    //   信号③ wal·send : state.vscdb-wal 增量 = 用户 click Send 后 SQLite 同步写入
    //                          最直接信号源 · WAL 帧在 HTTP 请求前写入 · 300ms 内可检测
    //   跨实例声明锁 (L6_CLAIM_DIR) 三信号共用 · 同一 send 事件精确一切
    try {
      _installLayer6FileWatcher(context);
    } catch (e) {
      log("Layer 6 install fail: " + (e.message || e));
    }
    // WAL 直达触发 (最底层信号源 · Send 按鈕第一个可观测点)
    try {
      if (_cfg("walDetect", true)) {
        const _walTimer = _installWalWatcher(context);
        if (_walTimer) {
          context.subscriptions.push({
            dispose: () => clearInterval(_walTimer),
          });
        }
      }
    } catch (e) {
      log("WAL watcher install fail: " + (e.message || e));
    }
  }

  log(
    "WAM v" +
      VERSION +
      " activated · 三守俱全·大制无割 · ⚡W%脉动 (\u0394\u2265" +
      (+_cfg("quotaPulseMinDelta", 0.3)).toFixed(2) +
      "%·同账号判·切号清基线) + [全栏 " +
      Math.round(+_cfg("perMessageMinIntervalMs", 60000) / 1000) +
      "s / WAL让位 " +
      Math.round(+_cfg("quotaPulsePriorityMs", 60000) / 1000) +
      "s / WAL冷 " +
      Math.round(+_cfg("walEdgeCooldownMs", 2000) / 1000) +
      "s / 暖启 " +
      Math.round(+_cfg("walWarmupMs", 5000) / 1000) +
      "s]" +
      (_cfg("rotateOnEveryMessage", true) ? " [开]" : " [关]") +
      " · 使用中🔒 " +
      Math.round(_cfg("inUseLockMs", 120000) / 1000) +
      "s · 不禁号·永不入黑" +
      " · 🛡️guard=" +
      (_openExternalGuardActive ? "ON" : "OFF") +
      " · 💾cache=" +
      _sessionCache.size,
  );
  // v3.2.0 · v3.1.1 8s prewarm 已损 · 限速重叠源 · 零批量 devinLogin
  //   原因: 首次部署 cache 空 → prewarm 对所有 N 号挨个 devinLogin → IP 限速雪崩
  //   现走主道: startup auto-verify 上面已改 _cacheOnly=true · 仅 cache 内号 fast-path
  //   未 cache 号: lazy on user switch · 反正必走 devinLogin · 现按需不批量
  //   帛书六十四章: 为之于其未有也 · 不批量即不生万乱
}

function deactivate() {
  _stopStuckEngine(); // v3.10.0 · 归一 · 优雅停止卡住引擎
  _stopHardExhaustWatchdog(); // v15.0 · 停止硬耗尽看门狗
  if (_engine) _engine.stopMonitor();
  if (_store) _store.save();
  log("WAM deactivate");
}

module.exports = {
  activate,
  deactivate,
  // 暴露给 harness · 用于真打验证 (生产代码不依赖)
  _internals: {
    devinLogin,
    windsurfPostAuth,
    registerUserViaSession,
    tryFetchPlanStatus,
    _parsePlanStatusJson,
    verifyOneAccount,
    verifyAllAccounts,
    injectViaBing,
    injectToken, // v3.1.0 · 暴露给回归测
    _installOpenExternalGuard, // v3.1.0 · 暴露给回归测
    _removeOpenExternalGuard, // v3.1.0 · 暴露给回归测
    _setMode, // v3.2.0 · 三处归一统一函数
    _scheduleResetRefresh, // v3.2.1 · 额度重置感知
    _onResetFired, // v3.2.1 · 重置触发回调
    get _openExternalGuardActive() {
      return _openExternalGuardActive;
    },
    get _guardBlockCount() {
      return _guardBlockCount;
    },
    // v3.1.1 · sessionCache 持久化 · 暴露给守门测试
    _cacheSession,
    _getCachedSession,
    _evictSessionCache,
    _persistSessionCache,
    _loadSessionCacheFromDisk,
    // v3.1.2 · 限速感知窗口 · 暴露给守门测试 (允许测试 set·验证 rate-limit-window 入口)
    get _devinLoginRateLimitedUntil() {
      return _devinLoginRateLimitedUntil;
    },
    _setDevinLoginRateLimitedUntil(t) {
      _devinLoginRateLimitedUntil = +t || 0;
    },
    SESSION_CACHE_FILE,
    SESSION_CACHE_DISK_TTL_MS,
    get _sessionCache() {
      return _sessionCache;
    },
    _isValidAutoTarget,
    _parseTimeMs, // v3.10.4 · 到期时间秒级解析
    _calcDaysLeft, // v3.10.4 · 剩余天数 ceil 防误过期
    _formatExpiryTime, // v3.10.4 · tooltip 秒级时间
    _formatDurationMs, // v3.10.4 · tooltip 秒级剩余/已过
    _bumpFailure, // v2.3.0 暴露给回归测
    isClaudeAvailable,
    isWeeklyDrought,
    _buildExpTag, // v2.5.2 · expTag 4 态纯函数
    _isTrialLike, // v2.5.4 · 软编码 trial 判据
    _resolveGlobalStorageDir, // v2.5.6 · Layer 6 globalStorage 路径
    _resolveWorkspaceStorageBase, // v2.5.6 · Layer 6 workspaceStorage 路径
    _resolveCascadePbDir, // v2.5.9 · Layer 6 cascade pb 目录
    buildHtml,
    openEditorPanel,
    parseAccountText,
    Store,
    // v2.4.0 · 暴露 endpoint 健康度给回归测
    _quotaEndpointDead,
    get _quotaEndpointHealth() {
      return _quotaEndpointHealth;
    },
    URL_GET_PLAN_STATUS_LIST,
    get _store() {
      return _store;
    },
    get _predictiveCandidate() {
      return _predictiveCandidate;
    },
    set _predictiveCandidate(v) {
      _predictiveCandidate = v;
    },
  },
};
