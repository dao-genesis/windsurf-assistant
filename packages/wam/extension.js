// WAM · 万法归宗 v4.11.0 · 7号板块闲置闭环: 24h 无活跃对话即触发 全量备份→清理→出库(与低额触发并联·软编码开关) · 道法自然
// WAM · 万法归宗 v4.9.0 · 自动清理默认开 + 归零移除(额度归零账号全量备份+清理后自动出库·备份严格校验) · 道法自然
// WAM · 万法归宗 v4.5.0 · 对话额度上限(余额-缓冲·自动中停)·自动清理阈值$1·余额精确到分 · 道法自然
// WAM · 万法归宗 v4.4.0 · 文件夹备份·HTML/MD双视图·自动备份阈值·自动清理 · 道法自然
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
// 第五板块 · Devin Cloud 接入底层 (对话提取/备份/追踪/水过无痕清理)
const devinCloud = require("./devin_cloud");
const devinWeb = require("./devin_web"); // v4.8.0 · 浏览器多实例隔离+账号注入 (自足·CDP 注入 auth1_session)
const devinProxy = require("./devin_proxy"); // v4.8.2 · IDE 内置浏览器自足注入反代 (每账号独立端口·多实例·不赖 dao-vsix)
const devinGit = require("./devin_git"); // 第三板块 · Git(GitHub) 接入 (整合 devin-git-auth 核心)

// v4.8.2 · IDE 内置浏览器多实例 webview 标签登记 (email → WebviewPanel) · 同号复用·异号并行
const _ideWebPanels = new Map();

// v4.8.2 · IDE 内置浏览器外壳 (满铺 iframe 指向本账号注入反代; CSP 仅放行 localhost frame)。
// v4.9.6 · E: 注入 setState({email}) → 供 WebviewPanelSerializer 在 IDE 重启后还原此面板到原账号。
function _ideBrowserHtml(url, email) {
  const u = String(url).replace(/"/g, "&quot;");
  const em = JSON.stringify(String(email || ""));
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; frame-src http://localhost:* http://127.0.0.1:*;">' +
    "<style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#1e1e1e}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head>" +
    '<body><iframe src="' + u + '" allow="clipboard-read; clipboard-write; microphone; camera"></iframe>' +
    "<script>try{var v=acquireVsCodeApi();v.setState({email:" + em + "});}catch(e){}</script>" +
    "</body></html>"
  );
}

// v4.8.2 · 路由某账号官网 → IDE 内置浏览器 (自足注入反代·多实例标签·不赖 dao-vsix)。
//   每账号独立端口反代注入其 auth1 登录态 → 各标签各登各号, 并行不串号 (鸡犬相闻)。
async function openIdeAccountBrowser(acc) {
  // 取该账号注入态 (缓存命中秒开; 否则后台五步登录换 auth1)。
  let auth = devinCloud.getCachedAuth(acc.email);
  if ((!auth || !auth.auth1) && acc.password) {
    const r = await devinCloud.getAuth(acc.email, acc.password);
    if (r && r.ok) auth = r;
  }
  if (!auth || !auth.auth1) return { ok: false, error: "no-auth1" };
  const pr = await devinProxy.ensureProxyForAccount(
    acc.email,
    { auth1: auth.auth1, userId: auth.userId, orgId: auth.orgId, orgName: auth.orgName },
    log,
  );
  if (!pr.ok) return { ok: false, error: pr.error || "proxy-fail" };

  const key = String(acc.email).toLowerCase();
  const short = acc.email.split("@")[0];
  let panel = _ideWebPanels.get(key);
  if (panel) {
    try {
      panel.reveal(vscode.ViewColumn.Active);
      panel.webview.html = _ideBrowserHtml(pr.url, acc.email);
      return { ok: true, reused: true };
    } catch {
      _ideWebPanels.delete(key);
      panel = null;
    }
  }
  panel = vscode.window.createWebviewPanel(
    "wamDevinWeb",
    "Devin · " + short,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  panel.webview.html = _ideBrowserHtml(pr.url, acc.email);
  panel.onDidDispose(() => {
    if (_ideWebPanels.get(key) === panel) _ideWebPanels.delete(key);
  });
  _ideWebPanels.set(key, panel);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════════════
// v5.0.0 · 归一 · 单面板多窗口多实例 (对齐手机版 APK)
//   一个 webview 面板 = 顶部标签栏 + 多个 iframe; 每标签指向「该账号独立端口反代」origin,
//   localStorage 各自隔离 → 各登各号·并行不串号。近期对话「多实例」与账号行「路由→IDE」
//   全部归到此面板的不同标签 (一个面板里好几个窗口)。
// ────────────────────────────────────────────────────────────────────────────────────
let _multiPanel = null;
let _multiReady = false;
const _multiQueue = [];
const _multiTabs = new Map(); // id -> {id,label,url,email,devinId,accNo,dollars,title,status}
// 归一 · 「全功能面板六大板块」提供者 (由 dao-vsix 经 _internals.setCloudProvider 注入)。
// {buildHtml, handleMessage, setHostPost, refresh} — 外壳以 blob-iframe 挂载其 HTML 当同级子网页。
let _cloudProvider = null;
// 归一 · 内嵌「切号」宿主回推 (dao-vsix registerWamHost 经 _internals.setHostPost 注入)。
//   根治: 内嵌六板里的真 WAM 切号面板靠此把广播(toast/切号动画/对话区/整页重渲)中继进 iframe,
//   否则面板渲染后即"死页"——数据不刷新。与单独左侧面板像素级一致。
let _hostPost = null;
function _postMulti(m) {
  if (_multiPanel && _multiReady) {
    try { _multiPanel.webview.postMessage(m); } catch (e) {}
  } else {
    _multiQueue.push(m);
  }
}
// 持久化: 打开的标签/书签/历史 → globalState, 软件重载后经序列化器自动续接。
function _saveMultiTabs() {
  try {
    if (_ctx && _ctx.globalState) {
      const arr = Array.from(_multiTabs.values()).map((t) => ({
        email: t.email, devinId: t.devinId, accNo: t.accNo,
        dollars: t.dollars, title: t.title, status: t.status, statusClass: t.statusClass,
      }));
      _ctx.globalState.update("dao.multiTabs", arr);
    }
  } catch (e) {}
}
function _getMultiFavs() {
  try { return (_ctx && _ctx.globalState && _ctx.globalState.get("dao.multiFavs")) || []; } catch (e) { return []; }
}
function _setMultiFavs(f) {
  try { if (_ctx && _ctx.globalState) _ctx.globalState.update("dao.multiFavs", f || []); } catch (e) {}
}
// 浏览器下载管理: 网页内下载的真实文件由代理层落盘到 ~/.dao/downloads + _index.json,
//   此处只读/删该清单(与「对话备份」彻底无关), 供 /shell ⬇下载悬浮窗罗列。
function _daoDownloadsIndexPath() { return path.join(os.homedir(), ".dao", "downloads", "_index.json"); }
function _listDaoDownloads() {
  try {
    const idx = JSON.parse(fs.readFileSync(_daoDownloadsIndexPath(), "utf8")) || [];
    return idx.filter((d) => { try { return d && d.path && fs.existsSync(d.path); } catch (e) { return false; } });
  } catch (e) { return []; }
}
function _delDaoDownload(p) {
  try {
    if (p) { try { fs.unlinkSync(p); } catch (e) {} }
    const idx = JSON.parse(fs.readFileSync(_daoDownloadsIndexPath(), "utf8")) || [];
    fs.writeFileSync(_daoDownloadsIndexPath(), JSON.stringify(idx.filter((d) => d && d.path !== p)));
  } catch (e) {}
}
function _getMultiHist() {
  try { return (_ctx && _ctx.globalState && _ctx.globalState.get("dao.multiHistory")) || []; } catch (e) { return []; }
}
function _pushMultiHist(url, label, kind) {
  try {
    if (!url || !_ctx || !_ctx.globalState) return;
    let h = _getMultiHist().filter((x) => x.url !== url);
    h.unshift({ url: url, label: label || url, ts: Date.now(), kind: kind || "acc" });
    h = h.slice(0, 200);
    _ctx.globalState.update("dao.multiHistory", h);
  } catch (e) {}
}
function _setMultiHist(h) {
  try { if (_ctx && _ctx.globalState) _ctx.globalState.update("dao.multiHistory", Array.isArray(h) ? h : []); } catch (e) {}
}
// 批量删历史(urls 集合)/清空。返回更新后的列表。
function _delMultiHist(urls) {
  const set = new Set((urls || []).map(String));
  const h = _getMultiHist().filter((x) => !set.has(String(x.url)));
  _setMultiHist(h); return h;
}
// ── 归一 · 用户脚本/扩展(对接 Chrome 扩展体系: 解压目录 / .crx/.zip · 非油猴) ──
//   每条 = {id,name,enabled,matches:[],js,css,runAt,source}. content_scripts 注入到
//   /shell 宝主自渲染的账号页(会话列表/对话正文) · 同源·CSP 放行内联。
function _getUserScripts() {
  try { const a = (_ctx && _ctx.globalState && _ctx.globalState.get("dao.userScripts")) || []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
}
function _setUserScripts(a) {
  try { if (_ctx && _ctx.globalState) _ctx.globalState.update("dao.userScripts", Array.isArray(a) ? a.slice(0, 200) : []); } catch (e) {}
}
function _usId() { return "us_" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
// chrome match pattern / 通配 glob → 正则 (支持 * 与 <all_urls>)
function _usGlobToRe(p) {
  p = String(p || "").trim();
  if (!p || p === "<all_urls>" || p === "*") return /^.*$/;
  const re = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + re + "$", "i");
}
function _usMatches(s, url) {
  try {
    const ms = (s && s.matches) || [];
    if (!ms.length) return false;
    for (let i = 0; i < ms.length; i++) { if (_usGlobToRe(ms[i]).test(url)) return true; }
    return false;
  } catch (e) { return false; }
}
// 构造注入片段(<style>+chrome 垫片+<script>) — 仅匹配且启用者。
function _buildUserScriptInject(url) {
  let list = [];
  try { list = _getUserScripts().filter((s) => s && s.enabled !== false && _usMatches(s, url)); } catch (e) { list = []; }
  if (!list.length) return "";
  let css = "", js = "";
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.css) css += String(s.css) + "\n";
    if (s.js) js += "\n;(function(){try{\n" + String(s.js) + "\n}catch(e){try{console.error('[dao-userscript]',e);}catch(_){}}})();";
  }
  const shim = "(function(){var w=window;if(w.chrome&&w.chrome.storage)return;var KP='dao.cs.kv.';"
    + "function gv(k){try{var v=localStorage.getItem(KP+k);return v==null?undefined:JSON.parse(v);}catch(e){return undefined;}}"
    + "function sv(o){try{for(var k in o)localStorage.setItem(KP+k,JSON.stringify(o[k]));}catch(e){}}"
    + "w.chrome=w.chrome||{};w.chrome.runtime=w.chrome.runtime||{id:'dao-ext',getURL:function(p){return String(p||'');},onMessage:{addListener:function(){}},sendMessage:function(){}};"
    + "w.chrome.storage=w.chrome.storage||{local:{get:function(keys,cb){var out={};try{if(typeof keys==='string')out[keys]=gv(keys);else if(Array.isArray(keys))keys.forEach(function(k){out[k]=gv(k);});else if(keys&&typeof keys==='object'){for(var k in keys){var v=gv(k);out[k]=(v===undefined?keys[k]:v);}}}catch(e){}if(typeof keys==='function'){cb=keys;}if(cb)cb(out);return Promise.resolve(out);},set:function(o,cb){sv(o||{});if(cb)cb();return Promise.resolve();},remove:function(k,cb){if(cb)cb();return Promise.resolve();}}};"
    + "w.GM_addStyle=w.GM_addStyle||function(c){try{var st=document.createElement('style');st.textContent=c;(document.head||document.documentElement).appendChild(st);}catch(e){}};"
    + "})();";
  let out = "";
  if (css) out += "<style data-dao-userscript>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
  out += "<scr" + "ipt data-dao-userscript>" + shim + "</scr" + "ipt>";
  if (js) out += "<scr" + "ipt data-dao-userscript>" + js.replace(/<\/script/gi, "<\\/script") + "</scr" + "ipt>";
  return out;
}
// 最小 ZIP 读取(仅取所需文件) — 支持 .crx(Cr24 头后即 zip) / .zip, 无第三方依赖。
function _zipEntries(buf) {
  const zlib = require("node:zlib");
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("非法 zip(无 EOCD)");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commLen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    const comp = buf.slice(dataStart, dataStart + compSize);
    let data;
    try { data = method === 0 ? comp : zlib.inflateRawSync(comp); } catch (e) { data = null; }
    if (data) out[name] = data;
    off += 46 + nameLen + extraLen + commLen;
  }
  return out;
}
function _crxToZip(buf) {
  if (buf.length > 16 && buf.toString("ascii", 0, 4) === "Cr24") {
    const ver = buf.readUInt32LE(4);
    if (ver === 2) { const pubLen = buf.readUInt32LE(8); const sigLen = buf.readUInt32LE(12); return buf.slice(16 + pubLen + sigLen); }
    if (ver === 3) { const hdrLen = buf.readUInt32LE(8); return buf.slice(12 + hdrLen); }
  }
  return buf;
}
// 从「解压目录」或「.crx/.zip 文件」导入 Chrome 扩展的 content_scripts → 用户脚本条目。
function _usImportExtension(p) {
  p = String(p || "").trim().replace(/^[\"']|[\"']$/g, "");
  if (!p) throw new Error("路径为空");
  let readFile, manifestRaw, extName = path.basename(p);
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    manifestRaw = fs.readFileSync(path.join(p, "manifest.json"), "utf8");
    readFile = (rel) => { try { return fs.readFileSync(path.join(p, String(rel).replace(/^\.?\//, "")), "utf8"); } catch (e) { return ""; } };
  } else {
    const zip = _zipEntries(_crxToZip(fs.readFileSync(p)));
    if (!zip["manifest.json"]) throw new Error("扩展内无 manifest.json");
    manifestRaw = zip["manifest.json"].toString("utf8");
    readFile = (rel) => { const k = String(rel).replace(/^\.?\//, ""); return zip[k] ? zip[k].toString("utf8") : ""; };
  }
  const mani = JSON.parse(manifestRaw);
  extName = mani.name || extName;
  const cs = mani.content_scripts || [];
  if (!cs.length) throw new Error("该扩展无 content_scripts(仅支持注入内容脚本)");
  const added = [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    let js = "", css = "";
    (c.js || []).forEach((f) => { js += "\n/* " + f + " */\n" + readFile(f); });
    (c.css || []).forEach((f) => { css += "\n/* " + f + " */\n" + readFile(f); });
    added.push({
      id: _usId(), name: extName + (cs.length > 1 ? (" #" + (i + 1)) : ""), enabled: true,
      matches: c.matches || ["<all_urls>"], js, css, runAt: c.run_at || "document_idle", source: "ext:" + p,
    });
  }
  const all = _getUserScripts().concat(added);
  _setUserScripts(all);
  return { name: extName, count: added.length, list: _getUserScripts() };
}
// 设备迁移(对照手机端一键导出/注入): 整包 = 账号库(可重导格式 email password) + 书签 + 历史 + 已开标签 + 安装元信息。
function _migBuildBundle() {
  const accounts = (((_store && _store.accounts) || [])).map((a) => ({ email: a.email, password: a.password || "" }));
  let favs = [], history = [], shellTabs = [], userScripts = [];
  try { favs = _getMultiFavs(); } catch (e) {}
  try { history = _getMultiHist(); } catch (e) {}
  try { shellTabs = (_ctx && _ctx.globalState && _ctx.globalState.get("dao.shellTabs")) || []; } catch (e) {}
  try { userScripts = _getUserScripts(); } catch (e) {}
  return {
    kind: "dao-migration", version: VERSION, exportedAt: Date.now(),
    activeEmail: (_store && _store.activeEmail) || "",
    counts: { accounts: accounts.length, favs: favs.length, history: history.length, tabs: shellTabs.length, userScripts: userScripts.length },
    accounts, favs, history, shellTabs, userScripts,
    install: { plugin: "dao", version: VERSION, note: "新设备安装对应版本插件后, 在「页面工具 · 整包导入」选择本文件即可恢复账号库与状态。" },
  };
}
async function _migApplyBundle(data) {
  if (!data || data.kind !== "dao-migration") throw new Error("非 dao 迁移文件(kind 不符)");
  let addedAcc = 0;
  try {
    if (Array.isArray(data.accounts) && data.accounts.length && _store && _store.addBatch) {
      const text = data.accounts.map((a) => String((a && a.email) || "") + " " + String((a && a.password) || "")).filter((s) => s.trim().length > 1).join("\n");
      if (text) { const r = _store.addBatch(text); addedAcc = (r && r.added) || 0; }
    }
  } catch (e) {}
  try { if (data.activeEmail && _store) { _store.activeEmail = data.activeEmail; if (_store.save) _store.save(); } } catch (e) {}
  try { if (Array.isArray(data.favs)) _setMultiFavs(data.favs); } catch (e) {}
  try { if (Array.isArray(data.history)) _setMultiHist(data.history); } catch (e) {}
  try { if (Array.isArray(data.shellTabs) && _ctx && _ctx.globalState) _ctx.globalState.update("dao.shellTabs", data.shellTabs.slice(0, 40)); } catch (e) {}
  try { if (Array.isArray(data.userScripts)) _setUserScripts(data.userScripts); } catch (e) {}
  return { addedAcc, favs: (data.favs || []).length, history: (data.history || []).length, tabs: (data.shellTabs || []).length };
}
// v4.9.3 · 归一修复: 六大板块经 blob-iframe 挂载, frame-src 必须放行 blob: 否则
// 子网页被 CSP 静默拦截 → 标签全空白(用户反馈"加载不进去")。createObjectURL 不抛错,
// 故 mountBoard 的 srcdoc 兜底不触发, 必须在此放行 blob:。
function _multiShellHtml(opts) {
  opts = opts || {};
  const _mobile = !!opts.mobile;
  let _html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: https:; frame-src blob: http://localhost:* http://127.0.0.1:*;">
<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#0e1116;color:#cdd3de;font:12px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
#app{display:flex;flex-direction:column;height:100%}
#tb{display:flex;align-items:center;gap:4px;height:36px;padding:0 6px;background:#161b22;border-bottom:1px solid #21262d;flex:0 0 auto}
.tbtn{background:#21262d;border:1px solid #30363d;color:#cdd3de;border-radius:6px;height:25px;min-width:27px;padding:0 7px;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.tbtn:hover{background:#2d333b;color:#fff}
#addr{flex:1;min-width:60px;height:25px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#cdd3de;padding:0 9px;font-size:12px;outline:none}
#addr:focus{border-color:#1f6feb}
#eng{height:25px;background:#21262d;border:1px solid #30363d;color:#9aa4b2;border-radius:6px;font-size:11px;cursor:pointer}
#zlbl{min-width:40px;text-align:center;color:#9aa4b2;font-size:11px;cursor:pointer;user-select:none}
#tabs{display:flex;align-items:stretch;height:30px;background:#11151b;border-bottom:1px solid #21262d;overflow-x:auto;overflow-y:hidden;white-space:nowrap;flex:0 0 auto;scrollbar-width:none;-ms-overflow-style:none}
#tabs::-webkit-scrollbar{height:0;width:0;display:none;background:transparent}
#daowin .cvtabs{scrollbar-width:none;-ms-overflow-style:none}#daowin .cvtabs::-webkit-scrollbar{height:0;width:0;display:none}
.tab{display:inline-flex;align-items:center;gap:4px;padding:0 6px;max-width:230px;border-right:1px solid #21262d;cursor:pointer;color:#9aa4b2;font-size:12px;user-select:none;flex:0 0 auto}
.tab:hover{background:#1b212b}
.tab.on{background:#0e1116;color:#e6edf3;box-shadow:inset 0 -2px 0 #1f6feb}
.tab.on2{background:#0e1116;color:#e6edf3;box-shadow:inset 0 -2px 0 #3fb950}
.tab .dot{width:10px;height:10px;border-radius:50%;background:#6e7681;flex:0 0 auto}
.tab .dot.running{background:#3fb950;box-shadow:0 0 6px #3fb950}.tab .dot.finished{background:#58a6ff}.tab .dot.blocked{background:#f0883e}.tab .dot.expired{background:#f85149}.tab .dot.exhausted{background:#a371f7}.tab .dot.awaiting{background:#d29922}
@keyframes dpul{0%,100%{opacity:1}50%{opacity:.35}}/* 正常/运行态常亮绿灯·不呼吸(用户诉求) */.tab .dot.running{animation:none}
.tab .no{min-width:10px;height:11px;line-height:11px;text-align:center;font-size:7px;font-weight:700;color:#9cdcfe;background:#1c2733;border:1px solid #2d4a63;border-radius:3px;padding:0 1px;flex:0 0 auto;opacity:.8}
.tab .lbl{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tab .amt{color:#3fb950;font-weight:700;font-size:9px;flex:0 0 auto}
.tab .x{opacity:.5;font-size:14px;padding:0 2px;border-radius:3px;flex:0 0 auto}
.tab .x:hover{opacity:1;background:#3a3a3a}
#body{position:relative;flex:1;overflow:hidden}
#stack{position:absolute;inset:0}
#stack iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
#splitbar{position:absolute;top:0;bottom:0;width:8px;margin-left:-4px;cursor:col-resize;z-index:6;display:none}
#splitbar.on{display:block}
#splitbar::after{content:'';position:absolute;top:0;bottom:0;left:50%;width:2px;margin-left:-1px;background:#30363d}
#splitbar:hover::after,#splitbar.drag::after{background:#1f6feb;width:3px;margin-left:-1.5px}
#hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#6e7681;font-size:13px;text-align:center;padding:24px;flex-direction:column;gap:10px}
#hint .big{font-size:36px}
.spin{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(14,17,22,.55);z-index:5;color:#9aa4b2;font-size:12px}
.spin.on{display:flex}
.spin .ld{width:22px;height:22px;border:3px solid #30363d;border-top-color:#1f6feb;border-radius:50%;animation:spin 1s linear infinite;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
#menu{position:absolute;top:36px;left:6px;width:216px;background:#161b22;border:1px solid #30363d;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.5);z-index:25;display:none;overflow:hidden}
#menu.on{display:block}
.mi{display:flex;align-items:center;gap:9px;padding:9px 12px;font-size:13px;color:#cdd3de;cursor:pointer;border-bottom:1px solid #1c222b}
.mi:hover{background:#1f6feb22;color:#fff}
.mi .ic{width:18px;text-align:center}
#ov{position:absolute;inset:0;background:#0e1116;z-index:18;display:none;flex-direction:column}
#ov.on{display:flex}
.ov-top{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#161b22;border-bottom:1px solid #21262d;flex:0 0 auto}
.ov-top .ti{font-size:14px;font-weight:600;color:#e6edf3;flex:1}
.ov-body{flex:1;overflow:auto;padding:10px 12px 40px}
.li{display:flex;align-items:center;gap:8px;background:#161b22;border:1px solid #21262d;border-radius:8px;padding:8px 10px;margin-bottom:7px}
.li .g{flex:1;overflow:hidden}
.li .t{color:#e6edf3;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.li .s{color:#6e7681;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.li .b{background:#21262d;border:1px solid #30363d;color:#cdd3de;border-radius:6px;padding:5px 9px;font-size:12px;cursor:pointer;flex:0 0 auto}
.li .b.pri{background:#0e639c;border-color:#0e639c;color:#fff}
.empty{color:#6e7681;text-align:center;padding:30px;font-size:13px}
.note{color:#8b949e;font-size:12px;line-height:1.8}
#drop{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(31,111,235,.16);border:3px dashed #1f6feb;z-index:30;color:#cfe6ff;font-size:15px;font-weight:700}
#drop.on{display:flex}
#convdrop{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(35,134,54,.18);border:3px dashed #2ea043;z-index:31;color:#d5f5dd;font-size:15px;font-weight:700;pointer-events:none}
#convdrop.on{display:flex;pointer-events:auto}
.rc[draggable=true]{cursor:grab}
.rc.cdragging{opacity:.5}
.rc[data-cdrag],.rc[data-dldrag]{cursor:grab}
.pdghost{position:fixed;z-index:100000;pointer-events:none;background:#1f6feb;color:#fff;font-size:12px;font-weight:600;padding:5px 11px;border-radius:7px;box-shadow:0 8px 24px rgba(0,0,0,.55);max-width:280px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.97;left:-9999px;top:-9999px}
body.pdragging,body.pdragging *{cursor:grabbing!important;user-select:none!important}
/* 归一·手机版模式 (UA 自动识别 / ?m=1): 不依赖视口宽度, 强制移动端布局 — 触控放大·菜单底部抽屉 */
html.m #tb{flex-wrap:wrap;height:auto;min-height:40px;padding:5px 6px;gap:4px}
html.m #eng{display:none}
html.m #addr{order:9;width:100%;min-width:0;height:36px;margin-top:4px;font-size:14px}
html.m .tbtn{height:36px;min-width:40px;font-size:17px}
html.m #tabs{height:42px}
html.m .tab{max-width:62vw;font-size:14px;padding:0 12px}
html.m #menu{position:fixed;left:0;right:0;top:auto;bottom:0;width:100%;max-width:none;border-radius:14px 14px 0 0;max-height:72vh;overflow:auto;box-shadow:0 -10px 30px rgba(0,0,0,.55)}
html.m .mi{padding:14px 16px;font-size:16px}
html.m .li .b{padding:10px 14px;font-size:14px}
html.m #hint{font-size:14px;padding:18px}
/* 归一 · 手机版适配: 窄屏(手机/窄面板)响应式 — 工具条换行·隐藏次要控件·加大触控目标 */
@media (max-width:560px){
  #tb{flex-wrap:wrap;height:auto;min-height:36px;padding:4px 6px;gap:3px}
  #eng{display:none}
  #addr{order:9;width:100%;min-width:0;height:32px;margin-top:3px;font-size:13px}
  .tbtn{height:32px;min-width:36px;font-size:16px}
  #zlbl{min-width:34px;font-size:12px}
  #tabs{height:38px}
  .tab{max-width:60vw;font-size:13px;padding:0 10px}
  #menu{width:84vw;max-width:300px}
  .mi{padding:12px 14px;font-size:15px}
  .ov-top .ti{font-size:15px}
  .li{padding:11px 12px}
  .li .b{padding:9px 13px;font-size:13px}
  #hint{font-size:14px;padding:18px}
  #daowin{width:96vw!important;height:84%!important;right:2vw!important;left:auto}
}
/* ── 归一 · 下载/备份悬浮窗(复刻手机端 APK daopan.html) ── */
#daowin{position:absolute;top:44px;right:10px;width:500px;height:64%;max-width:96vw;max-height:88%;background:#0e1116;border:1px solid #2a313c;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.6);z-index:26;display:none;flex-direction:column;overflow:hidden}
#daowin.on{display:flex}
#daowin .dwh{display:flex;align-items:center;gap:8px;padding:8px 11px;background:#161b22;border-bottom:1px solid #21262d;cursor:move;flex:0 0 auto;user-select:none}
#daowin .dwh .t{flex:1;font-size:13px;font-weight:700;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#daowin .dwtabs{display:flex;background:#161b22;border-bottom:1px solid #21262d;flex:0 0 auto}
#daowin .dwtab{flex:1;text-align:center;padding:9px 4px;font-size:13px;color:#8b949e;cursor:pointer;border-bottom:2px solid transparent}
#daowin .dwtab.on{color:#e6edf3;border-bottom-color:#1f6feb;font-weight:600}
#daowin .dwbar{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #21262d;flex:0 0 auto}
#daowin .dwbody{flex:1;position:relative;overflow:hidden}
#daowin .dwview{position:absolute;inset:0;overflow:auto;display:none;padding:6px 8px 36px}
#daowin .dwview.on{display:block}
#daowin .rc{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:8px 9px;margin-bottom:7px}
#daowin .rc .r1{display:flex;align-items:center;gap:7px}
#daowin .acc-no{flex:0 0 auto;min-width:20px;height:18px;line-height:18px;text-align:center;font-size:11px;font-weight:800;color:#9cdcfe;background:#1c2733;border:1px solid #2d4a63;border-radius:4px;padding:0 3px}
#daowin .st{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:#6e7681}
#daowin .st.running{background:#3fb950}#daowin .st.finished{background:#58a6ff}#daowin .st.awaiting{background:#d29922}#daowin .st.blocked{background:#f0883e}#daowin .st.expired{background:#f85149}
#daowin .ti{flex:1;font-size:13px;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#daowin .meta{font-size:11px;color:#8b949e;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap}
#daowin .acts{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
#daowin .b{flex:1;min-width:56px;text-align:center;background:#21262d;border:1px solid #30363d;border-radius:6px;padding:6px 0;font-size:12px;cursor:pointer;color:#cdd3de}
#daowin .b:hover{background:#2d333b}
#daowin .b.pri{background:#0e639c;border-color:#0e639c;color:#fff}
#daowin .gh{margin-top:9px;font-size:12px;color:#8b94a2;font-weight:800;padding:3px 2px;border-bottom:1px dashed #2a2f37}
#daowin .empty{color:#6e7681;text-align:center;padding:26px 12px;font-size:13px}
#daowin .tip{font-size:11px;color:#6e7681;padding:6px 4px 2px}
#daowin .srch{flex:1;min-width:80px;background:#0d1117;color:#cdd3de;border:1px solid #30363d;border-radius:6px;padding:6px 9px;font-size:12px;outline:none}
#daowin .srch:focus{border-color:#1f6feb}
#daowin .mini{background:#21262d;color:#cdd3de;border:1px solid #30363d;border-radius:6px;padding:6px 9px;font-size:12px;cursor:pointer;white-space:nowrap}
#daowin .dwx{background:#21262d;border:1px solid #30363d;border-radius:6px;color:#cdd3de;padding:5px 10px;font-size:12px;cursor:pointer;flex:0 0 auto}
#daowin #cv{position:absolute;inset:0;background:#0e1116;display:none;flex-direction:column;z-index:20}
#daowin #cv.on{display:flex}
#daowin .cvtop{display:flex;align-items:center;gap:6px;padding:6px 7px;background:#161b22;border-bottom:1px solid #21262d;flex:0 0 auto}
#daowin .cvtabs{flex:1;display:flex;gap:5px;overflow-x:auto;overflow-y:hidden}
#daowin .cvtab{flex:0 0 auto;max-width:170px;display:flex;align-items:center;gap:6px;background:#1b212b;border:1px solid #2a313c;border-radius:6px;padding:5px 8px;font-size:12px;color:#9aa4b2;cursor:pointer;white-space:nowrap}
#daowin .cvtab.on{background:#11304d;border-color:#1f6feb;color:#e6edf3}
#daowin .cvtab .nm{overflow:hidden;text-overflow:ellipsis;max-width:120px}
#daowin .cvtab .x{color:#6e7681;font-weight:700;padding:0 1px}
#daowin .cvacts{display:flex;gap:6px;padding:5px 8px;border-bottom:1px solid #21262d;flex:0 0 auto}
#daowin .cvbody{flex:1;overflow:auto;padding:12px 12px 50px;white-space:pre-wrap;word-break:break-word;font:12.5px/1.6 ui-monospace,Consolas,monospace;color:#cdd3de}
.dtoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(8px);background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:9px 16px;font-size:13px;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;z-index:99999;max-width:90%;box-shadow:0 8px 30px rgba(0,0,0,.5)}
.dtoast.show{opacity:1;transform:translateX(-50%) translateY(0)}.dtoast.fail{border-color:#f85149}.dtoast.ok{border-color:#3fb950}
.tbtn.faved{color:#f0b400}
#find{position:fixed;top:66px;right:14px;display:none;align-items:center;gap:4px;background:#161b22;border:1px solid #30363d;border-radius:8px;padding:5px 7px;z-index:45;box-shadow:0 6px 20px rgba(0,0,0,.45)}
#find.on{display:flex}
#find input{background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3;padding:4px 8px;font-size:12.5px;width:180px;outline:none}
#find.nf input{border-color:#f85149}
#find .fi{color:#8b949e;font-size:11.5px;min-width:34px;text-align:center}
#tabctx{position:fixed;display:none;flex-direction:column;background:#1b212b;border:1px solid #30363d;border-radius:8px;padding:4px;z-index:60;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
#tabctx.on{display:flex}
#tabctx .ci{padding:7px 12px;font-size:12.5px;color:#cdd3de;cursor:pointer;border-radius:6px;white-space:nowrap}
#tabctx .ci:hover{background:#11304d;color:#e6edf3}
#tabctx .sep{height:1px;background:#30363d;margin:3px 4px}
.tab.dragging{opacity:.45}
.tab.dh-l{box-shadow:inset 2px 0 0 #1f6feb}
.tab.dh-r{box-shadow:inset -2px 0 0 #1f6feb}
/* 归一 · ⬇下载悬浮窗(独立于对话备份, 对齐手机 APK 下载悬浮窗) */
#dlwin{position:absolute;top:44px;right:10px;width:480px;height:66%;max-width:96vw;max-height:88%;background:#0e1116;border:1px solid #2a313c;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.6);z-index:27;display:none;flex-direction:column;overflow:hidden}
#dlwin.on{display:flex}
#dlwin .dwh{display:flex;align-items:center;gap:8px;padding:8px 11px;background:#161b22;border-bottom:1px solid #21262d;cursor:move;flex:0 0 auto;user-select:none}
#dlwin .dwh .t{flex:1;font-size:13px;font-weight:700;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#dlwin .dwbar{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #21262d;flex:0 0 auto}
#dlwin .dlbody{flex:1;overflow:auto;padding:6px 8px 30px}
#dlwin .rc{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:8px 9px;margin-bottom:7px}
#dlwin .rc .ti{font-size:13px;color:#e6edf3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#dlwin .rc .meta{font-size:11px;color:#8b949e;margin-top:3px;display:flex;gap:8px;flex-wrap:wrap}
#dlwin .acts{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
#dlwin .b{flex:1;min-width:56px;text-align:center;background:#21262d;border:1px solid #30363d;border-radius:6px;padding:6px 0;font-size:12px;cursor:pointer;color:#cdd3de}
#dlwin .b:hover{background:#2d333b}#dlwin .b.pri{background:#0e639c;border-color:#0e639c;color:#fff}
#dlwin .mini{background:#21262d;color:#cdd3de;border:1px solid #30363d;border-radius:6px;padding:6px 9px;font-size:12px;cursor:pointer;white-space:nowrap}
#dlwin .dwx{background:#21262d;border:1px solid #30363d;border-radius:6px;color:#cdd3de;padding:5px 10px;font-size:12px;cursor:pointer;flex:0 0 auto}
#dlwin .empty{color:#6e7681;text-align:center;padding:26px 12px;font-size:13px}
#dlwin .tip{font-size:11px;color:#6e7681;padding:4px 4px 6px}
/* 悬浮窗可缩放(对齐常规软件·拖边框/拖角) — daowin/dlwin 同 */
#daowin,#dlwin{min-width:340px;min-height:240px}
.rzh{position:absolute;z-index:30;user-select:none;-webkit-user-select:none}
.rzh.e{top:6px;bottom:14px;right:0;width:6px;cursor:ew-resize}
.rzh.w{top:6px;bottom:14px;left:0;width:6px;cursor:ew-resize}
.rzh.n{left:6px;right:14px;top:0;height:5px;cursor:ns-resize}
.rzh.s{left:6px;right:14px;bottom:0;height:6px;cursor:ns-resize}
.rzh.se{right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:31}
.rzh.se::after{content:"";position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-right:2px solid #55606d;border-bottom:2px solid #55606d;border-radius:0 0 2px 0}
.rzh.se:hover::after{border-color:#1f6feb}
</style></head><body>
<div id="app">
  <div id="tb">
    <button class="tbtn" id="bMenu" title="菜单 · 页面">☰</button>
    <button class="tbtn" id="bAdd" title="新建标签 · 新 Devin 对话页">＋</button>
    <button class="tbtn" id="bRefresh" title="刷新当前页">⟳</button>
    <button class="tbtn" id="bHome" title="回到账号首页">🏠</button>
    <input id="addr" placeholder="Devin 路径(/sessions/..)、网址 或 搜索词，回车" />
    <select id="eng" title="搜索引擎">
      <option value="https://www.bing.com/search?q=" selected>Bing</option>
      <option value="https://www.google.com/search?q=">Google</option>
      <option value="https://duckduckgo.com/?q=">DuckDuckGo</option>
      <option value="https://www.baidu.com/s?wd=">百度</option>
      <option value="https://search.yahoo.com/search?p=">Yahoo</option>
      <option value="https://www.sogou.com/web?query=">搜狗</option>
    </select>
    <button class="tbtn" id="bZo" title="缩小">A−</button>
    <span id="zlbl" title="点击复位 100%">100%</span>
    <button class="tbtn" id="bZi" title="放大">A+</button>
    <button class="tbtn" id="bStar" title="收藏当前页">☆</button>
    <button class="tbtn" id="bTr" title="整页翻译(Edge 引擎·对照手机 APK)·再点恢复原文">译</button>
    <button class="tbtn" id="bDl" title="下载 · 网页内下载的文件(浏览器下载管理)">⬇</button>
    <button class="tbtn" id="bBk" title="对话备份 · 近期对话 / 对话记录">📁</button>
    <button class="tbtn" id="bExt" title="用系统浏览器打开当前页">↗</button>
  </div>
  <div id="tabs"></div>
  <div id="body">
    <div id="hint"><div class="big">🌐</div><div>归一面板 · 一个外壳多子网页(对齐手机 APK)<br>点 ☰ 选六大板块：🏠主页 / 🔀切号 / 🌐公网穿透 / 💬对话备份 / 💉反向注入 / 🧩MCP，或新建 Devin 标签<br>六大板块分而治之 · 各开一张独立子网页(网页套网页) · 与多实例账号页同级并排 · 各登各号互不串号</div></div>
    <div id="stack"></div>
    <div id="splitbar" title="拖动调整分屏比例"></div>
    <div class="spin" id="spin"><span class="ld"></span>加载中…</div>
    <div id="drop">松开以拖入文件到当前窗口</div>
    <div id="convdrop">⬆ 松开 · 上传到当前网页</div>
  </div>
</div>
<div id="menu"></div>
<div id="find"><input id="fQ" placeholder="页内查找…(Ctrl+F)" autocomplete="off"/><span class="fi" id="fInfo"></span><button class="tbtn" id="fPrev" title="上一个 · Shift+Enter">▲</button><button class="tbtn" id="fNext" title="下一个 · Enter">▼</button><button class="tbtn" id="fX" title="关闭 · Esc">✕</button></div>
<div id="tabctx"></div>
<div id="ov"><div class="ov-top"><span class="ti" id="ovTi"></span><button class="tbtn" id="ovClose">✕ 关闭</button></div><div class="ov-body" id="ovBody"></div></div>
<div id="daowin">
  <div class="dwh" id="dwHead"><span>💬</span><span class="t" id="dwTitle">对话备份</span><button class="dwx" id="dwClose">✕ 关闭</button></div>
  <div class="dwtabs"><div class="dwtab on" id="dwTabR">☁ 近期对话</div><div class="dwtab" id="dwTabB">🗂 对话记录(备份)</div></div>
  <div class="dwbar" id="dwBarR"><input class="srch" id="dwQ" placeholder="检索 账号 / 对话名称…" autocomplete="off"/><button class="mini" id="dwRefresh">🔄 刷新</button></div>
  <div class="dwbar" id="dwBarB" style="display:none"><input class="srch" id="dwBQ" placeholder="检索 账号 / 备份名称…" autocomplete="off"/><button class="mini" id="dwRoot">📁 根目录</button></div>
  <div class="dwbody">
    <div class="dwview on" id="dwViewR"><div class="tip">跨全部已登录账号 · 近期更新对话 · ⬇MD 秒存 · 📦全部文件含产出 · <b>拖对话卡到网页</b>即上传该对话内容到当前网页上传框(🌐进入=在网页打开)</div><div id="dwRecent"><div class="empty">加载中…</div></div></div>
    <div class="dwview" id="dwViewB"><div id="dwBackup"><div class="empty">加载中…</div></div></div>
    <div id="cv"><div class="cvtop"><button class="dwx" id="cvBack">‹ 返回</button><div class="cvtabs" id="cvTabs"></div></div><div class="cvacts" id="cvActs"></div><div class="cvbody" id="cvBody"></div></div>
  </div>
  <div class="rzh e" data-rz="e"></div><div class="rzh w" data-rz="w"></div><div class="rzh n" data-rz="n"></div><div class="rzh s" data-rz="s"></div><div class="rzh se" data-rz="se"></div>
</div>
<div id="dlwin">
  <div class="dwh" id="dlHead"><span>⬇</span><span class="t" id="dlTitle">下载</span><button class="dwx" id="dlClose">✕ 关闭</button></div>
  <div class="dwbar"><button class="mini" id="dlRefresh">🔄 刷新</button><button class="mini" id="dlFolder">📁 下载文件夹</button></div>
  <div class="dlbody"><div class="tip">浏览器下载 · 在网页中下载的文件都会出现在这里 · <b>拖文件卡到网页</b>即上传到当前网页上传框(与对话备份无关 · 对齐手机 APK)</div><div id="dlList"><div class="empty">加载中…</div></div></div>
  <div class="rzh e" data-rz="e"></div><div class="rzh w" data-rz="w"></div><div class="rzh n" data-rz="n"></div><div class="rzh s" data-rz="s"></div><div class="rzh se" data-rz="se"></div>
</div>
<div class="dtoast" id="daotoast"></div>
<script>
(function(){
var vscode=acquireVsCodeApi();
var tabs={},order=[],active=null,favs=[],history=[],accounts=[],bridge=null,userScripts=[],_usEdit=null;var MOBILE=false;
// 归一·分而治之: 六大板块各开一张独立子网页(各自一个 iframe), 不再共用一个全功能面板。
// BOARDS[tab] = {req,mounted,ready,frame,url}; 外壳标签 id = 'board:'+tab。
var BOARDS={};
var BOARD_META={home:['🏠','主页·六合一'],overview:['🏠','主页'],switch:['🔀','切号'],bridge:['🌐','公网穿透'],backups:['💬','对话备份'],inject:['💉','反向注入'],mcp:['🧩','MCP']};
function boardId(tab){return 'board:'+tab;}
function isBoard(){return !!active&&active.indexOf('board:')===0;}
function activeBoardTab(){return isBoard()?active.slice(6):'';}
var S=document.getElementById('stack'),BAR=document.getElementById('tabs'),HINT=document.getElementById('hint');
var ADDR=document.getElementById('addr'),ENG=document.getElementById('eng'),ZL=document.getElementById('zlbl'),SPIN=document.getElementById('spin');
var MENU=document.getElementById('menu'),OV=document.getElementById('ov'),OVB=document.getElementById('ovBody'),OVT=document.getElementById('ovTi'),DROP=document.getElementById('drop');
var SBAR=document.getElementById('splitbar');
// 归一·浏览器分屏(对照 Windows 贴靠/Chrome 分屏): splitId=与 active 并排的另一张标签; splitRatio=左窗占比
var splitId=null,splitRatio=0.5;
function _splitOn(){return !!(splitId&&tabs[splitId]&&tabs[active]&&active!==splitId);}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function sync(){HINT.style.display=order.length?'none':'flex';}
function curOrigin(){try{return tabs[active].url.split('/').slice(0,3).join('/');}catch(e){return '';}}
function setActive(id){
  if(splitId&&!tabs[splitId])splitId=null;
  if(splitId&&id===splitId)splitId=active; // 点击副窗标签 → 聚焦它并与原主窗对调, 保持分屏
  active=id;var split=_splitOn();
  for(var k in tabs){var isA=(k===active),isB=(split&&k===splitId);var on=isA||isB;
    tabs[k].frame.style.display=on?'block':'none';
    tabs[k].btn.className='tab'+(isA?' on':'')+(isB?' on2':'');
    if(on)applyZoom(tabs[k]);}
  if(SBAR){if(split){SBAR.style.left=(splitRatio*100)+'%';SBAR.className='on';}else SBAR.className='';}
  if(tabs[active]){ADDR.value=tabs[active].url;ZL.textContent=Math.round((tabs[active].zoom||1)*100)+'%';}
  spin(!!(tabs[active]&&tabs[active].loading));hideOverlay();syncStar();schedLazyLoad();_syncDocTitle();}
function markStar(on){var sb=document.getElementById('bStar');if(sb){sb.textContent=on?'★':'☆';sb.classList.toggle('faved',!!on);}}
// 收藏键 = 账号/对话标签 → 与宿主 favAdd 完全同构的 key, 保证「亮金↔取消」前后端一致命中。
function _acctFavKey(id){var p=String(id||'').split('|');var email=(p[0]||'').toLowerCase();var tail=p[1]||'home';var did=(tail!=='home'&&tail.indexOf('page')!==0)?tail:'';return email+'|'+(did||'home');}
function _curFavKey(){if(isBoard())return 'board:'+activeBoardTab();if(active)return _acctFavKey(active);return '';}
function _isFaved(){var k=_curFavKey();return !!k&&(favs||[]).some(function(f){return f&&f.key===k;});}
function syncStar(){markStar(_isFaved());}
function _otherTab(id){for(var i=order.length-1;i>=0;i--){if(order[i]!==id)return order[i];}return null;}
function toggleSplitWith(id){
  if(splitId){clearSplit();daoToast('已退出分屏');return;}
  var partner=(id===active)?_otherTab(id):active;if(!partner)partner=_otherTab(id);
  if(!partner){daoToast('分屏需要至少两个标签页',true);return;}
  splitId=id;active=partner;setActive(active);daoToast('▣ 已开启分屏并排 · 拖中缝调比例');}
function clearSplit(){splitId=null;if(tabs[active])setActive(active);else if(order.length)setActive(order[order.length-1]);}
// 归一 · 对齐 APK 左右切页: 在标签序内前后循环切换 (键盘 Ctrl+Tab / 手机标签条左右滑)
function cycleTab(dir){if(!order.length)return;var i=order.indexOf(active);if(i<0)i=0;var n=(i+dir+order.length)%order.length;setActive(order[n]);var b=tabs[order[n]];if(b&&b.btn&&b.btn.scrollIntoView){try{b.btn.scrollIntoView({inline:'center',block:'nearest'});}catch(e){}}}
// 分屏感知缩放布局: 主窗(左)占 splitRatio, 副窗(右)占 1-splitRatio; 非分屏占满。width 计入缩放补偿。
function applyZoom(t){var side='full';
  if(_splitOn()){if(t===tabs[active])side='left';else if(t===tabs[splitId])side='right';}
  var z=t.zoom||1,frac=(side==='full')?1:(side==='left'?splitRatio:(1-splitRatio)),off=(side==='right')?splitRatio:0;
  t.frame.style.transformOrigin='0 0';t.frame.style.transform='scale('+z+')';
  t.frame.style.left=(off*100)+'%';t.frame.style.right='auto';
  t.frame.style.width=(frac*100/z)+'%';t.frame.style.height=(100/z)+'%';}
function spin(on){SPIN.className='spin'+(on?' on':'');}
// 归一·每标签独立加载态 + 三重兜底(load/error/超时): 单一全屏遮罩只反映「当前活动标签」的加载,
//   后台标签(如卡住的官网多实例)永不再污染前台其他页面; 超时 15s 强制收起, 杜绝「一直加载中」。
function _clrLoadTO(t){if(t&&t._loadTO){clearTimeout(t._loadTO);t._loadTO=null;}}
function setLoading(id,on){var t=tabs[id];if(!t){spin(!!on);return;}
  t.loading=!!on;_clrLoadTO(t);
  if(on){t._loadTO=setTimeout(function(){t.loading=false;t._loadTO=null;if(active===id)spin(false);},15000);}
  if(active===id)spin(!!on);}
// 归一·多实例提速(对齐手机端·惰性加载): 新建/后台标签不预载 iframe, 仅当其成为活动(或分屏)标签时才挂 src;
//   批量恢复(restoreTabs 连发 reopen→mkTab)经 80ms 去抖只加载最终活动页, 其余后台页点开即载, 杜绝 N 实例齐发拖慢整机。
function _ensureLoaded(id){var t=tabs[id];if(!t||t._loaded||!t.url)return;t._loaded=true;t.frame.setAttribute('src',t.url);setLoading(id,true);}
var _lazyT=null;
function _lazyLoadVisible(){_lazyT=null;if(active)_ensureLoaded(active);if(_splitOn()&&splitId)_ensureLoaded(splitId);}
function schedLazyLoad(){clearTimeout(_lazyT);_lazyT=setTimeout(_lazyLoadVisible,80);}
function closeTab(id){var t=tabs[id];if(!t)return;_clrLoadTO(t);if(id===splitId)splitId=null;if(t.btn.parentNode)t.btn.parentNode.removeChild(t.btn);if(t.frame.parentNode)t.frame.parentNode.removeChild(t.frame);delete tabs[id];order=order.filter(function(x){return x!==id;});if(id.indexOf('board:')===0){var _bt=id.slice(6);var _b=BOARDS[_bt];if(_b){if(_b.url){try{URL.revokeObjectURL(_b.url)}catch(e){}}delete BOARDS[_bt];}}else{vscode.postMessage({type:'closed',id:id});}if(active===id){active=null;if(order.length)setActive(order[order.length-1]);}sync();schedPersist();}
function mkTab(m){var id=m.id;if(tabs[id]){if(m.url&&tabs[id].url!==m.url){tabs[id].url=m.url;tabs[id]._loaded=false;}setActive(id);return;}
  var btn=document.createElement('div');btn.className='tab';
  var dot=document.createElement('span');dot.className='dot'+_dotCls(m.statusClass||m.status);btn.appendChild(dot);
  var am=document.createElement('span');am.className='amt';am.textContent=m.dollars?('$'+m.dollars):'';am.style.display=m.dollars?'':'none';btn.appendChild(am);
  var no=document.createElement('span');no.className='no';if(m.accNo){no.textContent='#'+m.accNo;}else{no.style.display='none';}btn.appendChild(no);
  var lb=document.createElement('span');lb.className='lbl';lb.textContent=m.label||'Devin';btn.appendChild(lb);
  var x=document.createElement('span');x.className='x';x.textContent='×';btn.appendChild(x);
  btn.onclick=function(e){if(e.target===x)return;setActive(id);};
  btn.ondblclick=function(e){if(e.target===x)return;vscode.postMessage({type:'copyCred',id:id});};
  bindTabBtn(btn,id);
  x.onclick=function(e){e.stopPropagation();closeTab(id);};
  btn.title='双击复制账号密码';
  BAR.appendChild(btn);
  var fr=document.createElement('iframe');fr.setAttribute('allow','clipboard-read; clipboard-write; microphone; camera');fr.style.display='none';
  fr.addEventListener('load',function(){setLoading(id,false);});fr.addEventListener('error',function(){setLoading(id,false);});
  S.appendChild(fr);
  m.baseLabel=m.baseLabel||m.label||'';
  tabs[id]={btn:btn,frame:fr,url:m.url,email:m.email||'',zoom:1,meta:m,loading:false,_loaded:false,_dot:dot,_lbl:lb,_amt:am};order.push(id);applyZoom(tabs[id]);setActive(id);sync();schedPersist();try{schedStatusSoon();}catch(e){}
  vscode.postMessage({type:'histPush',url:m.url,label:m.label||'Devin',kind:'acc'});}
// 归一 · 状态字符串 → 状态点类名(对齐 devin_cloud.classifySession · 软兜底): 空=idle灰, 余映射 running/awaiting/blocked/finished。
function _dotCls(s){s=String(s==null?'':s).toLowerCase().trim();if(!s)return '';
  if(s==='idle')return '';
  if(s==='running'||s==='finished'||s==='blocked'||s==='awaiting'||s==='expired'||s==='exhausted')return ' '+s;
  if(/out_of_quota|usage_limit|insufficient|overage|exceeded|quota|depleted|allowance|no.*credit/.test(s))return ' exhausted';
  if(/await|waiting|needs_input|user_input|ask_user|action_required/.test(s))return ' awaiting';
  if(/credit|billing|error|failed|stuck|crash|blocked|interrupt|abort|disconnect|timeout/.test(s))return ' blocked';
  if(/finished|completed|done|stopped|suspend|expired|exited|archived|deleted/.test(s))return ' finished';
  if(/running|working|in_progress|streaming|active|started|resumed|busy|thinking|executing|coding|planning|testing/.test(s))return ' running';
  return ' running';}
// 归一 · 状态 → 中文提醒文案(对照手机 APK sessStatus 六态): exhausted 额度耗尽 / blocked 卡住·待处理 / awaiting 待输入。
function _statusZh(s){s=String(s||'').toLowerCase();if(s==='exhausted')return '额度耗尽';if(s==='blocked')return '卡住·待处理';if(s==='awaiting')return '待输入';if(s==='finished')return '完成';if(s==='running')return '运行中';return s;}
// 归一 · 状态 → 指示灯图标(对齐手机 APK 标签指示灯): 浏览器/IDE 外层标签页标题同步活跃对话名+状态灯。
function _statusIcon(s){s=String(s||'').toLowerCase();if(s==='running')return '🟢';if(s==='awaiting')return '🟡';if(s==='blocked')return '🔴';if(s==='exhausted')return '💳';if(s==='finished')return '⚪';return '';}
function _syncDocTitle(){try{var t=tabs[active];var name='',ic='';
  if(t){var le=t._lbl||(t.btn&&t.btn.querySelector('.lbl'));name=(le&&le.textContent)||'';var mt=t.meta||{};ic=_statusIcon(mt.statusClass||mt.status);}
  document.title=(ic?ic+' ':'')+(name?name+' · ':'')+'Devin Cloud';}catch(e){}}
// 归一 · 标签状态实时刷新(对齐手机端): 宿主轮询会话状态 → 更新状态点/对话名/额度, 并在转入「卡住/待输入」时提示。
function updateTab(m){var t=tabs[m.id];if(!t)return;var mt=t.meta||(t.meta={});
  if(m.statusClass!=null){var prev=mt.statusClass||'';mt.statusClass=m.statusClass;if(t._dot)t._dot.className='dot'+_dotCls(m.statusClass);
    var _sc=m.statusClass;if(_sc!==prev&&(_sc==='blocked'||_sc==='awaiting'||_sc==='exhausted')){try{var _ic=(_sc==='exhausted'?'💳 ':(_sc==='blocked'?'⚠ ':'⏳ '));daoToast(_ic+_statusZh(_sc)+' · '+(mt.label||'Devin'),_sc!=='awaiting');}catch(e){}}}
  if(m.label){mt.label=m.label;if(t._lbl)t._lbl.textContent=m.label;}
  if(m.dollars!=null){mt.dollars=m.dollars;if(t._amt){t._amt.textContent=m.dollars?('$'+m.dollars):'';t._amt.style.display=m.dollars?'':'none';}}
  if(m.id===active)_syncDocTitle();}
// 归一 · /shell 标签状态实时轮询(补 shell 侧此前缺失·对照手机端): 收集打开中的账号标签(email+devinId) →
//   宿主按号 listRunningSessions 判六态 → 回推 tabUpdate 上色/回填对话名/额度。web/board 标签不参与。
var _shStatT=null;
// 归一 · iframe 内导航感知(同源反代可读 pathname · 对照手机 APK): 用户在号首页/新建标签里点进某对话 →
//   捕获 /sessions/<id> 回填 meta.devinId, 后续轮询即按该对话回填对话名+状态灯(而非只显额度/账号名)。
function _captureTabConv(t,mt){try{var loc=t&&t.frame&&t.frame.contentWindow&&t.frame.contentWindow.location;var pth=(loc&&loc.pathname)||'';var mm=pth.match(/\\/sessions\\/(?:devin-)?([A-Za-z0-9_-]+)/);if(mm&&mm[1]&&mt.devinId!==mm[1]){mt.devinId=mm[1];schedPersist();}}catch(e){}}
// 归一 · 跨域 iframe 导航上报(对齐手机 APK · 注入桥 __daoConvNav): IDE webview 里反代 iframe 为
//   跨域源, contentWindow.location 不可读 → 由页内注入桥 postMessage 上报当前对话 sid + 标题;
//   据 ev.source 定位所属标签, 回填 devinId + 即时对话名, 并立刻触发一轮状态轮询上灯。
function _onConvNav(src,d){d=d||{};var sid=String(d.sid||'');var tt=String(d.title||'').trim();
  for(var i=0;i<order.length;i++){var id=order[i];if(id.indexOf('board:')===0||id.indexOf('web:')===0)continue;var t=tabs[id];
    if(!t||!t.frame||t.frame.contentWindow!==src)continue;var mt=t.meta||(t.meta={});
    var chg=false;
    if(mt.devinId!==sid){mt.devinId=sid;chg=true;}
    if(sid&&tt&&tt!=='Devin'&&tt!=='(未命名)'&&mt.label!==tt){mt.label=tt;if(t._lbl)t._lbl.textContent=tt;chg=true;}
    if(!sid&&chg&&t._lbl&&mt.email){var _fb=mt.baseLabel||mt.email.split('@')[0];mt.label=_fb;t._lbl.textContent=_fb;}
    if(chg){schedPersist();schedStatusSoon();if(id===active)_syncDocTitle();}
    return;}}
function shellStatusTick(){try{var arr=[];for(var i=0;i<order.length;i++){var id=order[i];if(id.indexOf('board:')===0||id.indexOf('web:')===0)continue;var t=tabs[id];var mt=(t&&t.meta)||{};if(!mt.email)continue;_captureTabConv(t,mt);arr.push({id:id,email:mt.email,devinId:mt.devinId||''});}if(arr.length)vscode.postMessage({type:'shellStatus',tabs:arr});}catch(e){}}
function schedStatusSoon(){clearTimeout(_shStatT);_shStatT=setTimeout(shellStatusTick,1200);}
// 对齐手机端刷新手感: 12s→5s (活跃对话额度/状态/卡住提示更新提速 · 每账号一次轻量 listSessions)
try{setInterval(shellStatusTick,5000);}catch(e){}
// 归一 · 状态续接(对齐手机端会话保持): 持久化当前打开的标签集 → 宿主 globalState;
//   重开 /shell 时宿主在 ready 回推 restoreTabs, 逐个还原(老用户停在原网页·新用户落主页)。
var _persistT=null;
function _liveWebUrl(t){try{var loc=t.frame.contentWindow.location;if((loc.pathname||'').indexOf('/__web')!==0)return '';var m=/[?&]u=([^&]+)/.exec(loc.search||'');return m?decodeURIComponent(m[1]):'';}catch(e){return '';}}
function _liveAccPath(t){try{var loc=t.frame.contentWindow.location;var p=(loc.pathname||'')+(loc.search||'');p=p.replace(/[?&]dao_acct=[^&]*/g,'');if(p.indexOf('?')<0)p=p.replace('&','?');if(!p||p==='/'||p==='/?'||p.indexOf('/__web')===0)return '';return p;}catch(e){return '';}}
function persistShell(){try{var arr=[];for(var i=0;i<order.length;i++){var id=order[i];
  if(id.indexOf('board:')===0){arr.push({kind:'board',board:id.slice(6)});}
  else if(id.indexOf('web:')===0){var tw=tabs[id];var mw=(tw&&tw.meta)||{};var wu=_liveWebUrl(tw)||mw.origUrl||'';if(wu)arr.push({kind:'web',url:wu,label:mw.label||wu});}
  else{var t=tabs[id];var mt=(t&&t.meta)||{};if(mt.email)arr.push({kind:'acc',email:mt.email,devinId:mt.devinId||'',path:_liveAccPath(t),title:mt.label||'',status:mt.status||''});}}
  vscode.postMessage({type:'shellSaveTabs',tabs:arr});}catch(e){}}
function schedPersist(){clearTimeout(_persistT);_persistT=setTimeout(persistShell,400);}
setInterval(function(){try{persistShell();}catch(e){}},15000); // 页内导航(iframe 内跳转)无事件可钩 → 周期性抓实时位置持久化
function restoreTabs(arr){if(!arr||!arr.length)return;for(var i=0;i<arr.length;i++){var s=arr[i]||{};try{
  if(s.kind==='board'){openBoard(s.board||'home');}
  else if(s.kind==='web'&&s.url){vscode.postMessage({type:'openWebTab',url:s.url,label:s.label||s.url});}
  else if(s.kind==='acc'&&s.email){vscode.postMessage({type:'reopen',email:s.email,devinId:s.devinId||'',path:s.path||''});}}catch(e){}}}
// 归一 · 站内新标签开任意网页/搜索(复刻手机端 APK · 不再弹外部系统浏览器):
//   经本地 HTTP 代理 /__web?u= 直出(剥 XFO/CSP · 注入 base + 链接/表单拦截), 当 iframe 挂一张站内标签。
function openWebTab(u,label){if(!u)return;vscode.postMessage({type:'openWebTab',url:u,label:(label||u).slice(0,60),hist:1});}
function navigate(v){v=(v||'').trim();if(!v)return;var isU=/^https?:\\/\\//i.test(v);if(!isU&&/^([\\w-]+\\.)+[a-z]{2,}(:\\d+)?([\\/?#]\\S*)?$/i.test(v)){v='https://'+v;isU=true;}var t=tabs[active];
  if(isBoard()||!t){
    if(isU){openWebTab(v,v);}
    else if(v.charAt(0)==='/'){vscode.postMessage({type:'openCloudPage',path:v});}
    else{openWebTab(ENG.value+encodeURIComponent(v),v);}
    try{ADDR.blur();}catch(e){}return;}
  if(isU){var o=curOrigin();if(o&&v.indexOf(o)===0){t.url=v;t._loaded=true;t.frame.setAttribute('src',v);setLoading(active,true);}else{openWebTab(v,v);}return;}
  if(v.charAt(0)==='/'){var u=curOrigin()+v;t.url=u;t._loaded=true;t.frame.setAttribute('src',u);setLoading(active,true);ADDR.value=u;return;}
  openWebTab(ENG.value+encodeURIComponent(v),v);}
// 归一 · 设备类型自动识别 (UA / ?m=1·见 _multiShellHtml MOBILE 注入) — 移除手动「切换 电脑版/手机版」(点击会重载致整体失效)。
var PAGES=[['🏠','主页 · 六合一(含全部板块)','board:home'],['🔀','切号 · 账号池','board:switch'],['🌐','公网穿透 · DAO Bridge','board:bridge'],['💬','对话备份','board:backups'],['💉','反向注入 · 全账号','board:inject'],['🧩','MCP 服务器','board:mcp'],['➕','新建 Devin 标签','newDevin'],['🕘','浏览历史','history'],['⭐','书签收藏','favs'],['🔌','用户脚本 / 扩展','userscripts'],['🛠','页面工具','tools'],['❔','关于 · 说明','about']];
function buildMenu(){var h='';for(var i=0;i<PAGES.length;i++){h+='<div class="mi" data-p="'+PAGES[i][2]+'" data-l="'+esc(PAGES[i][1])+'"><span class="ic">'+PAGES[i][0]+'</span><span>'+PAGES[i][1]+'</span></div>';}MENU.innerHTML=h;
  var items=MENU.querySelectorAll('.mi');for(var j=0;j<items.length;j++){items[j].onclick=function(){MENU.className='';onPage(this.getAttribute('data-p'),this.getAttribute('data-l'));};}}
function toggleMenu(){MENU.className=MENU.className?'':'on';}
function onPage(p,l){if(p&&p.indexOf('board:')===0){openBoard(p.slice(6));return;}
  if(p==='newDevin'){vscode.postMessage({type:'newDevinTab'});return;}
  if(p==='history')showHistory();else if(p==='favs')showFavs();else if(p==='userscripts')showUserscripts();else if(p==='tools')showTools();else if(p==='about')showAbout();}
// 归一·分而治之 · 六大板块 = 与多实例账号页同级的独立子网页(各板块各自一张 iframe·网页套网页)。
// 点某板块 → 若已挂载则切到该标签, 否则向宿主取该板块的「单板块」HTML(隐藏导航·只渲染该板块)挂一张新子网页。
// 宿主单一面板状态共享, cloudHost 数据广播到所有板块帧, 各帧只渲染自己的板块 → 复用面板逻辑·零重写。
function openBoard(tab){tab=tab||'overview';var id=boardId(tab);var b=BOARDS[tab];
  if(b&&b.mounted){setActive(id);return;}
  if(!b){b=BOARDS[tab]={req:false,mounted:false,ready:false,frame:null,url:''};}
  if(!b.req){b.req=true;spin(true);b._initTO=setTimeout(function(){if(!b.mounted)spin(false);},15000);vscode.postMessage({type:'cloudInit',board:tab});}}
function _boardHostAll(msg){for(var k in BOARDS){var b=BOARDS[k];if(b&&b.frame&&b.frame.contentWindow){try{b.frame.contentWindow.postMessage(msg,'*');}catch(e){}}}}
function mountBoardSolo(html,tab,srcUrl){tab=tab||'overview';var id=boardId(tab);var b=BOARDS[tab]||(BOARDS[tab]={req:false,mounted:false,ready:false,frame:null,url:''});
  var SHIM='<scr'+'ipt>(function(){var _s={};window.acquireVsCodeApi=function(){return{postMessage:function(m){try{parent.postMessage({__cwRelay:m,__board:"'+tab+'"},"*")}catch(e){}},getState:function(){try{var st=parent.__wamSt&&parent.__wamSt["'+tab+'"];if(st)return st}catch(e){}return _s},setState:function(s){_s=s;try{parent.__wamSt=parent.__wamSt||{};parent.__wamSt["'+tab+'"]=s}catch(e){}return s}}};})();<\/scr'+'ipt>';
  var doc=/<head[^>]*>/i.test(html)?html.replace(/<head([^>]*)>/i,'<head$1>'+SHIM):SHIM+html;
  if(!tabs[id]){
    var meta=BOARD_META[tab]||['🎛',tab];
    var btn=document.createElement('div');btn.className='tab';
    var lb=document.createElement('span');lb.className='lbl';lb.textContent=meta[0]+' '+meta[1];btn.appendChild(lb);
    var x=document.createElement('span');x.className='x';x.textContent='×';
    btn.onclick=function(e){if(e.target===x)return;setActive(id);};
    x.onclick=function(e){e.stopPropagation();closeTab(id);};btn.appendChild(x);
    bindTabBtn(btn,id);
    BAR.appendChild(btn);
    var fr=document.createElement('iframe');fr.setAttribute('allow','clipboard-read; clipboard-write; microphone; camera');fr.style.cssText='width:100%;height:100%;border:none;background:#1e1e1e;display:none';
    fr.addEventListener('load',function(){b.ready=true;if(b._initTO){clearTimeout(b._initTO);b._initTO=null;}setLoading(id,false);vscode.postMessage({type:'cloudReady',board:tab});});
    fr.addEventListener('error',function(){if(b._initTO){clearTimeout(b._initTO);b._initTO=null;}setLoading(id,false);});
    S.appendChild(fr);b.frame=fr;
    tabs[id]={btn:btn,frame:fr,url:'',zoom:1,meta:{board:tab}};order.push(id);
  }
  b.ready=false;
  // 重挂前留住滚动位 (blob iframe 同源可读) — 根治「删除/结构变化 → 面板回弹到顶」
  try{var _cw=b.frame&&b.frame.contentWindow;if(_cw&&_cw.document&&_cw.document.scrollingElement){var _sy=_cw.document.scrollingElement.scrollTop||0;if(_sy>0){window.__wamSt=window.__wamSt||{};var _st0=window.__wamSt[tab]||{};_st0.__scrollY=_sy;window.__wamSt[tab]=_st0;}}}catch(e){}
  if(srcUrl){b.frame.removeAttribute('srcdoc');if(b.url&&b.url.indexOf('blob:')===0){try{URL.revokeObjectURL(b.url)}catch(e){}}b.frame.src=srcUrl;b.url=srcUrl;}
  else{try{var blob=new Blob([doc],{type:'text/html'});var url=URL.createObjectURL(blob);b.frame.removeAttribute('srcdoc');b.frame.src=url;if(b.url&&b.url.indexOf('blob:')===0){try{URL.revokeObjectURL(b.url)}catch(e){}}b.url=url;}catch(e){b.frame.srcdoc=doc;}}
  b.mounted=true;b.req=false;setActive(id);setLoading(id,true);sync();schedPersist();}
function showOverlay(title,html){OVT.textContent=title;OVB.innerHTML=html;OV.className='on';}
function hideOverlay(){OV.className='';}
function bindOpen(){var ob=OVB.querySelectorAll('button[data-u]');for(var i=0;i<ob.length;i++){ob[i].onclick=function(){navigate(this.getAttribute('data-u'));hideOverlay();};}}
// 批量操作工具条(对齐电脑浏览器历史/书签): 全选 + 删除所选 + 清空。selSel=勾选项选择器, attr=取值属性。
function _ovBulkBar(idPfx){return '<div class="li" style="background:transparent;border:none;padding:0 0 8px;gap:10px"><label class="g" style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:none"><input type="checkbox" id="'+idPfx+'All"/> 全选</label><div style="flex:1"></div><button class="b" id="'+idPfx+'Del">删除所选</button><button class="b" id="'+idPfx+'Clear">清空</button></div>';}
function _ovBindBulk(idPfx,ckSel,attr,onDel,onClear){
  var all=document.getElementById(idPfx+'All');if(all)all.onchange=function(){var cks=OVB.querySelectorAll(ckSel);for(var j=0;j<cks.length;j++)cks[j].checked=all.checked;};
  var del=document.getElementById(idPfx+'Del');if(del)del.onclick=function(){var cks=OVB.querySelectorAll(ckSel),v=[];for(var j=0;j<cks.length;j++)if(cks[j].checked)v.push(cks[j].getAttribute(attr));if(v.length)onDel(v);};
  var clr=document.getElementById(idPfx+'Clear');if(clr)clr.onclick=function(){onClear();};}
function showHistory(){if(!history.length){showOverlay('🕘 浏览历史','<div class="empty">暂无浏览记录</div>');return;}
  var accH=[],webH=[];for(var i=0;i<history.length;i++){var it=history[i];((it.kind==='web')?webH:accH).push(it);}
  function _hRow(it){return '<div class="li"><input type="checkbox" class="hck" data-u="'+esc(it.url)+'" style="flex:none"/><div class="g"><div class="t">'+esc(it.label)+'</div><div class="s">'+esc(it.url)+'</div></div><button class="b" data-u="'+esc(it.url)+'">打开</button></div>';}
  function _hSec(t,a){if(!a.length)return '';var s='<div class="note" style="margin:6px 0 4px;font-weight:600;color:#9cdcfe">'+t+' ('+a.length+')</div>';for(var j=0;j<a.length;j++)s+=_hRow(a[j]);return s;}
  var h=_ovBulkBar('h')+_hSec('🔀 多实例账号页',accH)+_hSec('🌐 普通浏览',webH);
  showOverlay('🕘 浏览历史 ('+history.length+')',h);bindOpen();
  _ovBindBulk('h','.hck','data-u',function(v){vscode.postMessage({type:'histDel',urls:v});},function(){vscode.postMessage({type:'histClear'});});}
function showFavs(){if(!favs.length){showOverlay('⭐ 书签收藏','<div class="empty">暂无书签 · 工具条点 ☆ 收藏当前页</div>');return;}
  var h=_ovBulkBar('f');for(var i=0;i<favs.length;i++){var f=favs[i];var _ob=(f.kind==='board')?('<button class="b pri" data-goto-board="'+esc(f.board||'')+'">打开</button>'):('<button class="b pri" data-re-email="'+esc(f.email||'')+'" data-re-did="'+esc(f.devinId||'')+'">打开</button>');var _sub=(f.kind==='board')?'板块':('#'+esc(f.accNo||'')+' '+esc(f.email||''));h+='<div class="li"><input type="checkbox" class="fck" data-k="'+esc(f.key)+'" style="flex:none"/><div class="g"><div class="t">'+esc(f.label)+'</div><div class="s">'+_sub+'</div></div>'+_ob+'<button class="b" data-del="'+esc(f.key)+'">删</button></div>';}showOverlay('⭐ 书签收藏 ('+favs.length+')',h);
  var gb=OVB.querySelectorAll('[data-goto-board]');for(var g=0;g<gb.length;g++){gb[g].onclick=function(){try{openBoard(this.getAttribute('data-goto-board'));}catch(e){}hideOverlay();};}
  var ob=OVB.querySelectorAll('[data-re-email]');for(var a=0;a<ob.length;a++){ob[a].onclick=function(){vscode.postMessage({type:'reopen',email:this.getAttribute('data-re-email'),devinId:this.getAttribute('data-re-did')});hideOverlay();};}
  var db=OVB.querySelectorAll('[data-del]');for(var b=0;b<db.length;b++){db[b].onclick=function(){vscode.postMessage({type:'favDel',key:this.getAttribute('data-del')});};}
  _ovBindBulk('f','.fck','data-k',function(v){vscode.postMessage({type:'favDelMany',keys:v});},function(){vscode.postMessage({type:'favClear'});});}
// 归一 · 手动切换 电脑版 / 手机版: 经 ?m 重载当前 /shell 页 (UA 自识之上的手动覆盖)。
// MOBILE 真→切回电脑版(m=0); 假→切手机版(m=1)。webview 内无真实 URL, try/catch 静默兜底。
function toggleMobileMode(){try{var _u=new URL(location.href);_u.searchParams.set('m',MOBILE?'0':'1');location.href=_u.toString();}catch(e){}}
function _usInput(id,ph,val){return '<input id="'+id+'" placeholder="'+ph+'" value="'+esc(val||'')+'" style="background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3;padding:7px 9px;font-size:12.5px;outline:none"/>';}
function showUserscripts(){
  var h='<div class="note">🧩 用户脚本/扩展(对接 Chrome 扩展体系 · 非油猴): content_scripts 会注入到 /shell 自渲染的账号页(会话列表/对话正文) · 同源。可手写脚本, 或导入「解压扩展目录 / .crx / .zip」。</div>';
  h+='<div class="li" style="gap:6px"><input id="usPath" placeholder="扩展解压目录绝对路径 或 ext.crx/.zip" style="flex:1;min-width:0;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#cdd3de;padding:7px 9px;font-size:12.5px;outline:none"/><button class="b pri" id="usImp">导入扩展</button><button class="b" id="usNew">＋新建</button></div>';
  if(_usEdit){var e=_usEdit;
    h+='<div class="li" style="flex-direction:column;align-items:stretch;gap:6px">'
      +_usInput('usName','脚本名称',e.name)
      +_usInput('usMatch','匹配(逗号/换行分隔, 如 *://app.devin.ai/* 或 <all_urls>)',(e.matches||[]).join(', '))
      +'<textarea id="usCss" placeholder="CSS(可选)" style="height:54px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#cdd3de;padding:7px 9px;font:12px monospace;outline:none;resize:vertical">'+esc(e.css||'')+'</textarea>'
      +'<textarea id="usJs" placeholder="JavaScript content script" style="height:120px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#cdd3de;padding:7px 9px;font:12px monospace;outline:none;resize:vertical">'+esc(e.js||'')+'</textarea>'
      +'<div style="display:flex;gap:6px;justify-content:flex-end"><button class="b" id="usCancel">取消</button><button class="b pri" id="usSaveBtn">保存</button></div></div>';}
  if(!userScripts.length && !_usEdit) h+='<div class="empty">暂无用户脚本 · 点「＋新建」或导入扩展</div>';
  for(var i=0;i<userScripts.length;i++){var s=userScripts[i];
    h+='<div class="li"><input type="checkbox" class="usck" data-id="'+esc(s.id)+'" '+(s.enabled!==false?'checked':'')+' style="flex:none"/><div class="g"><div class="t">'+esc(s.name||'(未命名)')+'</div><div class="s">'+esc((s.matches||[]).join(', ').slice(0,80))+'</div></div><button class="b" data-edit="'+esc(s.id)+'">编辑</button><button class="b" data-del="'+esc(s.id)+'">删</button></div>';}
  showOverlay('🧩 用户脚本 / 扩展 ('+userScripts.length+')',h);
  var ip=document.getElementById('usImp');if(ip)ip.onclick=function(){var p=(document.getElementById('usPath')||{}).value||'';if(!p){daoToast('请填扩展路径',true);return;}daoToast('导入中…');vscode.postMessage({type:'usImport',path:p});};
  var nw=document.getElementById('usNew');if(nw)nw.onclick=function(){_usEdit={name:'',matches:['*://app.devin.ai/*'],css:'',js:''};showUserscripts();};
  var cc=document.getElementById('usCancel');if(cc)cc.onclick=function(){_usEdit=null;showUserscripts();};
  var sb=document.getElementById('usSaveBtn');if(sb)sb.onclick=function(){var name=(document.getElementById('usName')||{}).value||'';var mt=((document.getElementById('usMatch')||{}).value||'').split(/[\\n,]+/).map(function(x){return x.trim();}).filter(Boolean);var css=(document.getElementById('usCss')||{}).value||'';var js=(document.getElementById('usJs')||{}).value||'';var entry={name:name,matches:mt.length?mt:['<all_urls>'],css:css,js:js,enabled:true};if(_usEdit&&_usEdit.id)entry.id=_usEdit.id;_usEdit=null;vscode.postMessage({type:'usSave',entry:entry});};
  var cks=OVB.querySelectorAll('.usck');for(var c=0;c<cks.length;c++)cks[c].onchange=function(){vscode.postMessage({type:'usToggle',id:this.getAttribute('data-id')});};
  var eb=OVB.querySelectorAll('[data-edit]');for(var d=0;d<eb.length;d++)eb[d].onclick=function(){var id=this.getAttribute('data-edit');for(var k=0;k<userScripts.length;k++){if(userScripts[k].id===id){_usEdit=JSON.parse(JSON.stringify(userScripts[k]));break;}}showUserscripts();};
  var xb=OVB.querySelectorAll('[data-del]');for(var x=0;x<xb.length;x++)xb[x].onclick=function(){vscode.postMessage({type:'usDelete',id:this.getAttribute('data-del')});};}
function showTools(){var t=tabs[active];var u=t?t.url:'';showOverlay('🛠 页面工具',
  '<div class="li"><div class="g"><div class="t">复制当前页链接</div><div class="s">'+esc(u||'(无)')+'</div></div><button class="b" id="tCopy">复制</button></div>'
  +'<div class="li"><div class="g"><div class="t">系统浏览器打开当前页</div></div><button class="b pri" id="tExt">打开</button></div>'
  +'<div class="li"><div class="g"><div class="t">翻译当前页(系统浏览器 · Google 翻译)</div></div><button class="b" id="tTr">翻译</button></div>'
  +'<div class="li"><div class="g"><div class="t">切换 电脑版 / 手机版</div><div class="s">当前: '+(MOBILE?'手机版':'电脑版')+' · 切换后经 ?m 重新载入</div></div><button class="b" id="tMob">切换</button></div>'
  +'<div class="note" style="margin:10px 0 4px">🧳 设备迁移(对照手机端一键导出/导入) · 把账号库+书签+历史+已开标签整包导出, 新设备装好插件后导入即用。</div>'
  +'<div class="li"><div class="g"><div class="t">整包导出</div><div class="s">下载迁移文件 dao-migration-*.json</div></div><button class="b pri" id="tMigExp">导出</button></div>'
  +'<div class="li"><div class="g"><div class="t">整包导入</div><div class="s">选择迁移文件 · 合并到本机账号库</div></div><button class="b" id="tMigImp">导入</button></div>'
  +'<input type="file" id="tMigFile" accept="application/json,.json" style="display:none"/>'
  +'<div class="note" style="margin-top:8px">缩放: 工具条 A− / A＋；点百分比复位。刷新: ⟳ 。回首页: 🏠 。</div>');
  var c=document.getElementById('tCopy');if(c)c.onclick=function(){vscode.postMessage({type:'clip',text:u});};
  var e=document.getElementById('tExt');if(e)e.onclick=function(){if(u)vscode.postMessage({type:'openExternal',url:u});};
  var tr=document.getElementById('tTr');if(tr)tr.onclick=function(){if(u)vscode.postMessage({type:'openExternal',url:'https://translate.google.com/translate?sl=auto&tl=zh-CN&u='+encodeURIComponent(u)});};
  var tm=document.getElementById('tMob');if(tm)tm.onclick=toggleMobileMode;
  var me=document.getElementById('tMigExp');if(me)me.onclick=function(){daoToast('正在打包迁移文件…');vscode.postMessage({type:'migExport'});};
  var mi=document.getElementById('tMigImp');if(mi)mi.onclick=function(){var f=document.getElementById('tMigFile');if(f)f.click();};
  var mf=document.getElementById('tMigFile');if(mf)mf.onchange=function(){var file=this.files&&this.files[0];if(!file)return;var rd=new FileReader();rd.onload=function(){try{var data=JSON.parse(rd.result);daoToast('正在导入…');vscode.postMessage({type:'migImport',data:data});}catch(e){daoToast('迁移文件解析失败',true);}};rd.readAsText(file);this.value='';};}
function migDownload(m){try{var name=m.name||('dao-migration-'+Date.now()+'.json');var blob=new Blob([m.json||'{}'],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){try{URL.revokeObjectURL(a.href);}catch(e){}a.remove();},1500);daoToast('✓ 已导出迁移文件 · '+name);}catch(e){daoToast('导出失败',true);}}
function showAbout(){showOverlay('❔ 关于 · 说明','<div class="note">多实例浏览器 · 归一面板多窗口(对齐手机版 APK)。<br><br>• 每个标签 = 一个账号/对话，经该账号独立端口反代登录，各登各号、互不串号。<br>• 标签显示: 状态点 + #账号编号 + 名称 + $额度；<b>双击标签复制账号(+密码)</b>。<br>• 工具条: 刷新 / 首页 / 地址栏+搜索引擎 / 缩放 / 收藏 / 系统浏览器打开。<br>• 书签、历史、打开的标签均持久化，软件重载后自动续接。<br>• 支持从 IDE 拖拽文件进窗口(捕获路径)。<br><br>🔎 搜索 / 外链: 经站内代理 <code>/__web</code> 内嵌直出(剥 X-Frame-Options/CSP·直连+本机代理双赛道·链接/表单/整页跳转自动续走代理)，如手机端，不再弹外部系统浏览器；Devin 自身页面经反代可完美内嵌。个别强校验或需登录态的站点会回退「↗ 用系统浏览器打开」。</div>');}
// 归一 · ⬇下载 / 📁备份库 悬浮窗(对齐手机 APK 工具条): 复用 showOverlay + 主机 devinCloud.listBackups 同源数据,零另起炉灶。
var _bkTree=null,_bkMode='',_bkQ='';
function _bkWhen(ms){try{return ms?new Date(ms).toLocaleString():'';}catch(e){return '';}}
function _bkBindActions(){var ob=OVB.querySelectorAll('[data-open]');for(var i=0;i<ob.length;i++){ob[i].onclick=function(){var p=this.getAttribute('data-open');if(p)vscode.postMessage({type:'shellOpenFile',path:p});};}
  var rb=OVB.querySelectorAll('[data-reveal]');for(var j=0;j<rb.length;j++){rb[j].onclick=function(){var p=this.getAttribute('data-reveal');if(p)vscode.postMessage({type:'shellRevealFile',path:p});};}}
function reqBackups(mode){_bkMode=mode;vscode.postMessage({type:'shellBackups'});}
function showBkLib(){_bkMode='bk';_bkQ='';renderBkLib();reqBackups('bk');}
function showDownloads(){_bkMode='dl';renderDownloads();reqBackups('dl');}
function renderBkLib(){if(!_bkTree){showOverlay('📁 备份库','<div class="empty">正在扫描本地备份…</div>');return;}
  var accs=_bkTree.accounts||[],q=(_bkQ||'').trim().toLowerCase(),na=0,nc=0,body='';
  var head='<input id="bkSearch" placeholder="检索 账号 / 对话名称…" autocomplete="off" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:8px 10px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#cdd3de;font-size:13px;outline:none"/>';
  for(var i=0;i<accs.length;i++){var a=accs[i];var accHit=(String(a.email||'').toLowerCase().indexOf(q)>=0)||(String(a.account||'').toLowerCase().indexOf(q)>=0);
    var rows=(a.conversations||[]).filter(function(c){return !q||accHit||String(c.title||c.name||'').toLowerCase().indexOf(q)>=0;});
    if(!rows.length)continue;na++;
    body+='<div style="margin-top:9px;font-size:12px;color:#8b94a2;font-weight:800;padding:3px 2px;border-bottom:1px dashed #2a2f37">'+esc(a.email||a.account)+' · '+rows.length+' 备份</div>';
    for(var k=0;k<rows.length;k++){var c=rows[k];nc++;
      body+='<div class="li"><div class="g"><div class="t">'+esc(c.title||c.name||c.devinId||'(未命名)')+'</div><div class="s">'+_bkWhen(c.mtime)+(c.eventCount?(' · '+c.eventCount+' 事件'):'')+'</div></div>'
        +(c.hasHtml?'<button class="b pri" data-open="'+esc(c.htmlPath||'')+'">打开正文</button>':'')
        +'<button class="b" data-reveal="'+esc(c.path||c.htmlPath||a.dir||'')+'">文件夹</button></div>';}}
  if(!body)body='<div class="empty">无备份记录 · 先在「💬对话备份」板块或开启自动备份</div>';
  showOverlay('📁 备份库 ('+na+'账号·'+nc+'对话)',head+body);
  var si=document.getElementById('bkSearch');if(si){si.value=_bkQ||'';si.oninput=function(){_bkQ=this.value;var pos=this.selectionStart;renderBkLib();var s2=document.getElementById('bkSearch');if(s2){s2.focus();try{s2.setSelectionRange(pos,pos);}catch(e){}}};}
  _bkBindActions();}
function renderDownloads(){if(!_bkTree){showOverlay('⬇ 下载','<div class="empty">正在扫描…</div>');return;}
  var accs=_bkTree.accounts||[],all=[];
  for(var i=0;i<accs.length;i++){var a=accs[i];var cs=a.conversations||[];for(var k=0;k<cs.length;k++)all.push({c:cs[k],email:a.email||a.account,dir:a.dir});}
  all.sort(function(x,y){return (y.c.mtime||0)-(x.c.mtime||0);});
  var body='<div class="li"><div class="g"><div class="t">下载/备份根目录</div><div class="s">'+esc(_bkTree.root||'(未配置)')+'</div></div><button class="b pri" data-reveal="'+esc(_bkTree.root||'')+'">打开文件夹</button></div>';
  for(var j=0;j<all.length;j++){var it=all[j],c=it.c;
    body+='<div class="li"><div class="g"><div class="t">'+esc(c.title||c.name||c.devinId||'(未命名)')+'</div><div class="s">'+esc(it.email)+' · '+_bkWhen(c.mtime)+'</div></div>'
      +(c.hasHtml?'<button class="b pri" data-open="'+esc(c.htmlPath||'')+'">打开</button>':'')
      +'<button class="b" data-reveal="'+esc(c.path||c.htmlPath||it.dir||'')+'">文件夹</button></div>';}
  if(!all.length)body+='<div class="empty">暂无已下载/备份的对话 · 在「💬对话备份」板块备份后此处即可见</div>';
  showOverlay('⬇ 下载 ('+all.length+')',body);_bkBindActions();}
// ── 归一 · 下载/备份悬浮窗(复刻手机端 APK daopan.html) · CSP 安全(事件委托·无内联 onclick) ──
var DAO_REC=[],CV_TABS=[],CV_ACT=-1,_daoBkQ='',_convDrag=null,_convDragActive=false,_bkOpen={};
var DAO_REC_VIEW_MAX=34; // 近期对话(☁)无搜索时只显示最近此条数(对齐手机 APK·精简);全量按号分层在「🗂 对话记录(备份)」
function _dEl(id){return document.getElementById(id);}
function daoToast(msg,bad){var t=_dEl('daotoast');if(!t)return;t.textContent=msg;t.className='dtoast show'+(bad?' fail':' ok');clearTimeout(t._tm);t._tm=setTimeout(function(){t.className='dtoast';},2200);}
function daoAgo(ms){if(!ms)return'';var d=Date.now()-ms;if(d<0)d=0;var mn=Math.floor(d/60000);if(mn<1)return'刚刚';if(mn<60)return mn+'分钟前';var h=Math.floor(mn/60);if(h<24)return h+'小时前';var dd=Math.floor(h/24);if(dd<30)return dd+'天前';try{return new Date(ms).toLocaleDateString();}catch(e){return'';}}
function daoOpen(tab){_dEl('daowin').className='on';daoTab(tab||'recent');}
function daoClose(){_dEl('daowin').className='';}
// ── 归一 · ⬇下载悬浮窗(浏览器下载管理): 罗列网页内下载的真实文件, 与对话备份彻底无关 ──
var DAO_DL=[];
function _fsize(n){n=+n||0;if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';if(n<1073741824)return (n/1048576).toFixed(1)+' MB';return (n/1073741824).toFixed(2)+' GB';}
function dlOpen(){_dEl('dlwin').className='on';dlLoad();}
function dlClose(){_dEl('dlwin').className='';}
function dlLoad(){if(!DAO_DL.length)_dEl('dlList').innerHTML='<div class="empty">加载中…</div>';vscode.postMessage({type:'shellDownloads'});}
function dlRender(){var box=_dEl('dlList');if(!box)return;
  if(!DAO_DL.length){box.innerHTML='<div class="empty">暂无下载 · 在网页中下载文件后会自动出现在这里</div>';var t=_dEl('dlTitle');if(t)t.textContent='下载';return;}
  var h='';for(var i=0;i<DAO_DL.length;i++){var d=DAO_DL[i];var host='';try{host=new URL(d.url||'').host;}catch(e){}
    h+='<div class="rc" draggable="false" data-dldrag="'+esc(d.path||'')+'" data-dlname="'+esc(d.name||'')+'" title="拖拽此文件可上传/发送"><div class="ti" title="'+esc(d.name||'')+'">'+esc(d.name||'(未命名)')+'</div>'+
      '<div class="meta"><span>'+_fsize(d.size)+'</span>'+(host?'<span>'+esc(host)+'</span>':'')+(d.time?'<span>'+daoAgo(d.time)+'</span>':'')+'</div>'+
      '<div class="acts"><span class="b pri" data-dlup="'+esc(d.path||'')+'" data-dlupname="'+esc(d.name||'')+'" title="上传此文件到当前打开的网页上传框(对齐手机 APK·免拖拽)">⬆ 传网页</span><span class="b" data-dlopen="'+esc(d.path||'')+'">打开</span><span class="b" data-dlrev="'+esc(d.path||'')+'">所在文件夹</span><span class="b" data-dldel="'+esc(d.path||'')+'">删除</span></div></div>';}
  box.innerHTML=h;var tt=_dEl('dlTitle');if(tt)tt.textContent='下载 ('+DAO_DL.length+')';}
function daoTab(t){var rec=t==='recent';
  _dEl('dwTabR').classList.toggle('on',rec);_dEl('dwTabB').classList.toggle('on',!rec);
  _dEl('dwViewR').classList.toggle('on',rec);_dEl('dwViewB').classList.toggle('on',!rec);
  _dEl('dwBarR').style.display=rec?'flex':'none';_dEl('dwBarB').style.display=rec?'none':'flex';
  daoHideCv();if(rec)daoLoadRecent();else daoLoadBackup();}
var DAO_REC_CK='dao.recent.cache';
function daoLoadRecent(){
  // 秒开: 先用本地缓存渲染(若有), 再后台流式拉取持续刷新 — 对齐手机 daopan.html, 不再空等全量。
  if(!DAO_REC.length){try{var c=JSON.parse(localStorage.getItem(DAO_REC_CK)||'null');if(c&&c.list&&c.list.length){DAO_REC=c.list;daoRenderRecent();}}catch(e){}}
  if(!DAO_REC.length)_dEl('dwRecent').innerHTML='<div class="empty">加载中…(跨账号近期对话)</div>';
  vscode.postMessage({type:'dlRecent'});}
var _recRenderT=null;
function _recRenderThrottled(){if(_recRenderT)return;_recRenderT=setTimeout(function(){_recRenderT=null;daoRenderRecent();},150);}
// 按账号合并增量: 只用新数据替换「本轮已刷过账号(covered)」的行, 其余账号保留缓存行 →
//   点开即显缓存全量最新, 流式只就地精修各号, 消除「先缩成一个号再慢慢涨回」的跳伞/一分钟抖动。
function _mergeRecent(incoming,covered){
  var cov=Object.create(null);(covered||[]).forEach(function(e){cov[String(e).toLowerCase()]=1;});
  var kept=DAO_REC.filter(function(it){return !cov[String(it.email||'').toLowerCase()];});
  var all=kept.concat(incoming||[]);
  all.sort(function(a,b){return (b.updatedAt||0)-(a.updatedAt||0);});
  var seen=Object.create(null),ded=[];
  for(var i=0;i<all.length;i++){var it=all[i];if(it.sid&&seen[it.sid])continue;if(it.sid)seen[it.sid]=1;ded.push(it);}
  DAO_REC=ded;
}
function daoOnRecent(m){
  // 兼容老形态(直接传 list)与新形态(带 partial/done/total/covered 的增量包)。
  if(Array.isArray(m)){DAO_REC=m||[];daoRenderRecent();return;}
  m=m||{};
  // 无 covered 字段(老宿主) → 退回整体替换; 有则按账号合并(不丢未刷账号的缓存行)。
  if(m.covered){_mergeRecent(m.list||[],m.covered);}else{DAO_REC=m.list||[];}
  // 防跳伞: 流式增量包期间节流重绘(最多 ~150ms 一次)并保留滚动位置; 完成包才落地最终渲染。
  if(m.partial){
    if(!DAO_REC.length){var b=_dEl('dwRecent');if(b&&(!b.firstChild||b.querySelector('.empty')))b.innerHTML='<div class="empty">加载中… '+(m.done||0)+'/'+(m.total||'?')+' 账号</div>';}
    else _recRenderThrottled();
  }else{
    if(_recRenderT){clearTimeout(_recRenderT);_recRenderT=null;}
    daoRenderRecent();
    try{localStorage.setItem(DAO_REC_CK,JSON.stringify({ts:Date.now(),list:DAO_REC.slice(0,80)}));}catch(e){}
  }}
function daoRenderRecent(){var q=(_dEl('dwQ').value||'').trim().toLowerCase(),box=_dEl('dwRecent');var _sc=box?box.scrollTop:0;
  if(!DAO_REC.length){box.innerHTML='<div class="empty">暂无近期对话 · 先在 🔀切号 面板登录账号</div>';return;}
  // 无搜索时只渲染最近 DAO_REC_VIEW_MAX 条(DAO_REC 已按 updatedAt 降序;slice 自头取保留原 idx 映射);
  // 有搜索时跨全量匹配。全量历史在「🗂 对话记录(备份)」按号分层。
  var src=q?DAO_REC:DAO_REC.slice(0,DAO_REC_VIEW_MAX);
  var html='';src.forEach(function(it,idx){
    if(q){var hay=((it.email||'')+' '+it.title+' '+it.sid+' '+it.accNo).toLowerCase();if(hay.indexOf(q)<0)return;}
    html+='<div class="rc" draggable="false" data-cdrag="1" data-email="'+esc(it.email||'')+'" data-sid="'+esc(it.sid||'')+'" data-title="'+esc(it.title||'')+'"><div class="r1"><span class="acc-no">#'+esc(String(it.accNo))+'</span><span class="st '+esc(it.statusClass||'')+'" title="'+esc(it.status||'')+'"></span><span class="ti" title="'+esc(it.title)+'">'+esc(String(it.title).slice(0,70))+'</span></div>'+
      '<div class="meta"><span>'+esc(String(it.email||'').split('@')[0])+'</span>'+(it.status?'<span>'+esc(it.status)+'</span>':'')+(it.updatedAt?'<span>'+daoAgo(it.updatedAt)+'</span>':'')+'</div>'+
      '<div class="acts"><span class="b" data-act="view" data-idx="'+idx+'">👁 查看</span><span class="b" data-act="enter" data-idx="'+idx+'" title="切到该账号并在网页端打开此对话">🌐 进入</span><span class="b" data-act="md" data-idx="'+idx+'">⬇ MD</span><span class="b pri" data-act="zip" data-idx="'+idx+'">📦 全部文件</span><span class="b" data-act="up" data-idx="'+idx+'" title="上传此对话内容(MD)到当前打开的网页上传框(对齐手机 APK·免拖拽)">⬆ 传网页</span></div></div>';});
  if(!q&&DAO_REC.length>DAO_REC_VIEW_MAX){html+='<div class="empty" style="padding:8px 4px;line-height:1.5">仅显示最近 '+DAO_REC_VIEW_MAX+' 条 · 共 '+DAO_REC.length+' 条<br>搜索可跨全部 · 全量历史见 🗂 对话记录(备份)</div>';}
  box.innerHTML=html||'<div class="empty">无匹配 · 清空搜索查看全部</div>';try{box.scrollTop=_sc;}catch(e){}}
function daoEnter(idx){var it=DAO_REC[idx];if(!it)return;vscode.postMessage({type:'openCloudPage',path:'sessions/'+String(it.sid||'').replace(/^devin-/,''),label:it.title});daoToast('已请求打开 · '+String(it.email||'').split('@')[0]);}
function daoMd(idx){var it=DAO_REC[idx];if(!it)return;daoToast('下载 MD…');vscode.postMessage({type:'dlExportMd',email:it.email,sid:it.sid,title:it.title,save:true});}
function daoZip(idx){var it=DAO_REC[idx];if(!it)return;daoToast('打包全部文件…(增量补全·稍候定位)');vscode.postMessage({type:'dlZip',email:it.email,sid:it.sid,title:it.title});}
function daoView(idx){var it=DAO_REC[idx];if(!it)return;var ex=-1;for(var i=0;i<CV_TABS.length;i++){if(CV_TABS[i].sid===it.sid){ex=i;break;}}
  if(ex>=0)CV_ACT=ex;else{CV_TABS.push({email:it.email,sid:it.sid,title:it.title||it.sid,md:'',loading:true});CV_ACT=CV_TABS.length-1;}
  _dEl('cv').className='on';daoRenderCv();if(ex<0)vscode.postMessage({type:'dlExportMd',email:it.email,sid:it.sid,title:it.title,save:false});}
function daoOnExport(d){
  if(d.save){daoToast(d.ok?('✓ 已保存: '+(d.name||'对话.md')):('下载失败: '+(d.error||'')),!d.ok);return;}
  for(var i=0;i<CV_TABS.length;i++){if(CV_TABS[i].sid===d.sid){CV_TABS[i].md=d.ok?(d.md||''):('(提取失败: '+(d.error||'')+')');CV_TABS[i].loading=false;if(d.title)CV_TABS[i].title=d.title;}}
  daoRenderCv();}
function daoActCv(ti){CV_ACT=ti;daoRenderCv();}
function daoCloseCv(ti){CV_TABS.splice(ti,1);if(!CV_TABS.length){CV_ACT=-1;daoHideCv();return;}if(CV_ACT>=CV_TABS.length)CV_ACT=CV_TABS.length-1;daoRenderCv();}
function daoHideCv(){_dEl('cv').className='';}
function daoRenderCv(){var tabsEl=_dEl('cvTabs'),bodyEl=_dEl('cvBody'),actEl=_dEl('cvActs'),h='';
  CV_TABS.forEach(function(t,i){h+='<div class="cvtab'+(i===CV_ACT?' on':'')+'" data-cv="act" data-i="'+i+'"><span class="nm" title="'+esc(t.title)+'">'+esc(String(t.title).slice(0,40))+'</span><span class="x" data-cv="close" data-i="'+i+'">✕</span></div>';});
  tabsEl.innerHTML=h;var cur=CV_TABS[CV_ACT];
  if(!cur){bodyEl.textContent='';actEl.innerHTML='';return;}
  actEl.innerHTML='<span class="b" data-cvact="md" data-i="'+CV_ACT+'">⬇ MD</span><span class="b pri" data-cvact="zip" data-i="'+CV_ACT+'">📦 全部文件</span>';
  bodyEl.textContent=cur.loading?'提取对话中…':(cur.md||'(空)');bodyEl.scrollTop=0;}
function daoCvMd(ti){var t=CV_TABS[ti];if(!t)return;daoToast('下载 MD…');vscode.postMessage({type:'dlExportMd',email:t.email,sid:t.sid,title:t.title,save:true});}
function daoCvZip(ti){var t=CV_TABS[ti];if(!t)return;daoToast('打包全部文件…');vscode.postMessage({type:'dlZip',email:t.email,sid:t.sid,title:t.title});}
function daoLoadBackup(){if(!_bkTree)_dEl('dwBackup').innerHTML='<div class="empty">正在扫描本地备份…</div>';vscode.postMessage({type:'shellBackups'});}
function daoRenderBackup(){var box=_dEl('dwBackup');if(!box)return;if(!_bkTree){box.innerHTML='<div class="empty">正在扫描…</div>';return;}
  // 一级目录=账号文件夹(默认折叠·点开看该号对话), 对齐手机版悬浮窗分层逻辑; 搜索时自动展开命中账号。
  var accs=(_bkTree.accounts||[]).slice();var q=(_daoBkQ||'').trim().toLowerCase(),na=0,nc=0,body='';
  // 账号按其最新对话时间降序 → 最近用过的号置顶 (对齐手机版"最新在前", 根治"看不到最新对话")。
  function _accLatest(a){var cs=a&&a.conversations||[],m=0;for(var j=0;j<cs.length;j++){var t=+cs[j].mtime||0;if(t>m)m=t;}return m;}
  accs.sort(function(x,y){return _accLatest(y)-_accLatest(x);});
  for(var i=0;i<accs.length;i++){var a=accs[i];var em=String(a.email||a.account||'');var accHit=em.toLowerCase().indexOf(q)>=0;
    var rows=(a.conversations||[]).filter(function(c){return !q||accHit||String(c.title||c.name||c.devinId||'').toLowerCase().indexOf(q)>=0;});
    rows.sort(function(x,y){return (+y.mtime||0)-(+x.mtime||0);}); // 号内对话按最新时间降序
    if(!rows.length)continue;na++;nc+=rows.length;
    var key=String(a.account||em||i).toLowerCase();var open=q?true:!!_bkOpen[key];
    // 最活跃 = 号内最新对话标题(rows 已按 mtime 降序), 作为账号副标签, 一眼知该号在忙什么。
    var topC=rows[0]||{};var topT=String(topC.title||topC.name||topC.devinId||'').trim();
    body+='<div class="bkacc" data-bkacc="'+esc(key)+'" data-bkemail="'+esc(em)+'" title="双击复制账号+密码" style="display:flex;align-items:center;gap:7px;margin-top:7px;padding:8px 10px;background:#11161d;border:1px solid #232a33;border-radius:7px;cursor:pointer;user-select:none">'
      +'<span style="width:12px;flex:none;color:#7d8794;font-size:11px">'+(open?'▾':'▸')+'</span>'
      +'<span style="flex:none">📁</span>'
      +'<span style="flex:1;min-width:0">'
        +'<span style="display:block;font-size:12.5px;color:#cdd3de;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(em)+'">'+esc(em||'(未命名账号)')+'</span>'
        +(topT?'<span style="display:block;font-size:10.5px;color:#7d8794;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px" title="最活跃对话: '+esc(topT)+'">🗨 '+esc(topT.slice(0,46))+'</span>':'')
      +'</span>'
      +'<span style="flex:none;font-size:11px;color:#8b94a2;background:#1b2129;border:1px solid #2a313b;border-radius:10px;padding:1px 8px">'+rows.length+' 对话</span>'
      +'<span class="b" data-bkcopy="'+esc(em)+'" title="复制账号+密码">📋</span>'
      +'<span class="b" data-reveal="'+esc(a.dir||'')+'" title="打开账号文件夹">📂</span></div>';
    if(open){body+='<div style="padding-left:6px;border-left:2px solid #232a33;margin:2px 0 4px 6px">';
      for(var k=0;k<rows.length;k++){var c=rows[k];
        body+='<div class="rc" draggable="false" data-cdrag="1" data-email="'+esc(em)+'" data-sid="'+esc(c.devinId||'')+'" data-title="'+esc(c.title||c.name||c.devinId||'')+'"><div class="r1"><span class="ti" title="'+esc(c.title||c.name||c.devinId||'')+'">'+esc(c.title||c.name||c.devinId||'(未命名)')+'</span></div><div class="meta"><span>'+_bkWhen(c.mtime)+(c.eventCount?(' · '+c.eventCount+' 事件'):'')+'</span></div>'+
          '<div class="acts">'+(c.hasHtml?'<span class="b pri" data-open="'+esc(c.htmlPath||'')+'">打开正文</span>':'')+'<span class="b" data-reveal="'+esc(c.path||c.htmlPath||a.dir||'')+'">文件夹</span></div></div>';}
      body+='</div>';}}
  box.innerHTML=body||'<div class="empty">无备份记录 · 先在「💬对话备份」板块备份或开启自动备份</div>';
  var ttl=_dEl('dwTitle');if(ttl)ttl.textContent='下载 / 备份库 ('+na+'账号·'+nc+'对话'+(q?'·已筛':'')+')';}
// 事件委托(CSP 安全): 所有悬浮窗内点击统一在 #daowin 上处理
_dEl('daowin').addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('[data-act],[data-cv],[data-cvact],[data-open],[data-reveal],[data-bkcopy],[data-bkacc]');if(!el)return;
  var bcp=el.getAttribute('data-bkcopy');if(bcp!=null){e.stopPropagation();vscode.postMessage({type:'copyCredEmail',email:bcp});return;}
  var bk=el.getAttribute('data-bkacc');if(bk!=null){_bkOpen[bk]=!_bkOpen[bk];daoRenderBackup();return;}
  var a=el.getAttribute('data-act');if(a){var idx=+el.getAttribute('data-idx');if(a==='view')daoView(idx);else if(a==='enter')daoEnter(idx);else if(a==='md')daoMd(idx);else if(a==='zip')daoZip(idx);else if(a==='up'){var _it=DAO_REC[idx];if(_it){if(_daoUploadToActive({kind:'conv',email:_it.email,sid:_it.sid,title:_it.title})){daoToast('⏳ 上传此对话到当前网页 · '+String(_it.title||_it.sid||'').slice(0,24));try{daoClose();}catch(_e){}}}}return;}
  var cv=el.getAttribute('data-cv');if(cv){var ci=+el.getAttribute('data-i');if(cv==='act')daoActCv(ci);else if(cv==='close'){e.stopPropagation();daoCloseCv(ci);}return;}
  var cva=el.getAttribute('data-cvact');if(cva){var cj=+el.getAttribute('data-i');if(cva==='md')daoCvMd(cj);else daoCvZip(cj);return;}
  var op=el.getAttribute('data-open');if(op){vscode.postMessage({type:'shellOpenFile',path:op});return;}
  var rv=el.getAttribute('data-reveal');if(rv){vscode.postMessage({type:'shellRevealFile',path:rv});return;}});
// 备份库账号行双击 → 复制账号+密码(对齐手机版双击复制); 双击同时触发两次单击=展开再收起, 净无副作用。
_dEl('daowin').addEventListener('dblclick',function(e){var el=e.target.closest&&e.target.closest('[data-bkemail]');if(!el)return;var em=el.getAttribute('data-bkemail');if(em){e.preventDefault();vscode.postMessage({type:'copyCredEmail',email:em});}});
// ── 归一 · 拖拽上传到当前网页 (下载文件 / 近期对话 MD → 投递当前账号网页上传框) ──
//   外壳同源可靠接住 drop(#convdrop 覆盖网页区)→ postMessage 命令该标签内嵌桥(/__daobridge.js)
//   fetch /__dlfile|/__convmd 取字节 → feed 落上传框。不依赖跨 iframe 原生 DnD(webview 跨源 iframe 不稳)。
//   「进入网页打开此对话」改由卡片上 🌐进入 按钮(data-act=enter)承担, 拖拽专司上传, 各司其职。
var _uploadDrag=null;
function _activeFrameWin(){try{var t=tabs[active];return (t&&t.frame&&t.frame.contentWindow)||null;}catch(e){return null;}}
function _daoUploadToActive(p){if(!p)return false;var w=_activeFrameWin();if(!w){daoToast('请先打开一个账号网页标签再拖入上传',true);return false;}try{w.postMessage({__daoUpload:p},'*');return true;}catch(e){return false;}}
function _showUploadDrop(txt){var cd=_dEl('convdrop');if(cd){cd.textContent=txt||'⬆ 松开 · 上传到当前网页';cd.className='on';}}
function _hideUploadDrop(){var cd=_dEl('convdrop');if(cd)cd.className='';}
// ═══ 道并行 · 指针拖拽引擎(取代 webview 跨源 iframe 不可靠的原生 HTML5 DnD) ═══
// 原生 dragstart/drop 在 webview 内拖经子 iframe 时会丢事件(上游已注释其不稳)。改用
// mousedown→mousemove→mouseup 自管: 拖拽期把所有子 iframe pointer-events:none(同 #splitbar
// 手法)令父文档恒收到 move/up; 落点按坐标判定——落网页区=上传当前网页, 落标签栏=标签重排。
// 任何 IDE(VSCode/Cursor/Windsurf)/任何 webview 一致可用, 不依赖原生 DnD。
var _PD=null;
function _pdFramesPE(off){var k;for(k in tabs){try{tabs[k].frame.style.pointerEvents=off?'none':'';}catch(e){}}for(k in BOARDS){try{if(BOARDS[k]&&BOARDS[k].frame)BOARDS[k].frame.style.pointerEvents=off?'none':'';}catch(e){}}}
function _rectHit(el,x,y){if(!el)return false;var r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
function _pdInBar(x,y){return _rectHit(BAR,x,y);}
function _pdInPage(x,y){return _rectHit(_dEl('body'),x,y)&&!_pdInBar(x,y);}
function _tabIdOf(btn){for(var k in tabs){if(tabs[k].btn===btn)return k;}return null;}
function _pdTabAt(x){var ts=BAR.querySelectorAll('.tab');for(var i=0;i<ts.length;i++){var r=ts[i].getBoundingClientRect();if(x>=r.left-4&&x<=r.right+4)return{btn:ts[i],before:(x<r.left+r.width/2)};}return null;}
function _endPDrag(){_clearDragMark();_hideUploadDrop();_pdFramesPE(false);_convDragActive=false;document.body.classList.remove('pdragging');try{var d1=BAR.querySelector('.tab.dragging');if(d1)d1.classList.remove('dragging');}catch(e){}try{var d2=document.querySelector('.rc.cdragging');if(d2)d2.classList.remove('cdragging');}catch(e){}if(_PD&&_PD.ghost&&_PD.ghost.parentNode)_PD.ghost.parentNode.removeChild(_PD.ghost);_PD=null;}
function startPDrag(downEvt,opt){if(downEvt.button!=null&&downEvt.button!==0)return;if(_PD)_endPDrag();
  var sx=downEvt.clientX,sy=downEvt.clientY,started=false;
  function begin(){started=true;_convDragActive=true;_PD={payload:opt.payload||null,reorderId:opt.reorderId||null};
    var g=document.createElement('div');g.className='pdghost';g.textContent=opt.label||'拖拽…';document.body.appendChild(g);_PD.ghost=g;
    _pdFramesPE(true);document.body.classList.add('pdragging');
    if(_PD.reorderId&&tabs[_PD.reorderId]){try{tabs[_PD.reorderId].btn.classList.add('dragging');}catch(e){}}
    if(opt.srcEl){try{opt.srcEl.classList.add('cdragging');}catch(e){}}
    if(_PD.payload)_showUploadDrop(opt.dropHint||'⬆ 松开到网页 = 上传到当前网页');}
  function mv(e){if(!started){if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)<6)return;begin();}
    e.preventDefault();
    if(_PD.ghost){_PD.ghost.style.left=(e.clientX+14)+'px';_PD.ghost.style.top=(e.clientY+12)+'px';}
    _clearDragMark();
    if(_PD.reorderId&&_pdInBar(e.clientX,e.clientY)){var t=_pdTabAt(e.clientX);if(t)t.btn.classList.add(t.before?'dh-l':'dh-r');}}
  function up(e){document.removeEventListener('mousemove',mv,true);document.removeEventListener('mouseup',up,true);
    if(started){var x=e.clientX,y=e.clientY,done=false;
      if(_PD.reorderId&&_pdInBar(x,y)){var t=_pdTabAt(x);if(t){var dst=_tabIdOf(t.btn);if(dst&&dst!==_PD.reorderId)reorderTab(_PD.reorderId,dst,t.before);}done=true;}
      if(!done&&_PD.payload&&_pdInPage(x,y)){if(_daoUploadToActive(_PD.payload)){daoToast('⏳ 正在上传到当前网页 · '+String((_PD.payload.title||_PD.payload.name||_PD.payload.sid)||'').slice(0,24));try{daoClose();}catch(_1){}try{dlClose();}catch(_2){}}}}
    _endPDrag();}
  document.addEventListener('mousemove',mv,true);document.addEventListener('mouseup',up,true);}
// 近期对话 / 备份卡片 → 指针拖拽上传(点卡片按钮不触发拖拽)
_dEl('daowin').addEventListener('mousedown',function(e){if(e.button!==0)return;var el=e.target.closest&&e.target.closest('.rc[data-cdrag]');if(!el)return;
  if(e.target.closest&&e.target.closest('.b,.acts,[data-act],[data-open],[data-reveal],[data-bkcopy],[data-bkacc]'))return;
  var email=el.getAttribute('data-email')||'',sid=el.getAttribute('data-sid')||'',title=el.getAttribute('data-title')||'';
  if(!email||!sid)return;
  startPDrag(e,{srcEl:el,label:'💬 '+String(title||sid).slice(0,28),payload:{kind:'conv',email:email,sid:sid,title:title},dropHint:'⬆ 松开到网页 = 上传此对话内容到当前网页'});});
(function(){var cd=_dEl('convdrop');if(!cd)return;cd.addEventListener('dragover',function(e){if(!_convDragActive)return;e.preventDefault();try{e.dataTransfer.dropEffect='copy';}catch(x){}});cd.addEventListener('drop',function(e){e.preventDefault();e.stopPropagation();cd.className='';_convDragActive=false;var p=_uploadDrag;try{var sc=e.dataTransfer.getData('application/x-dao-conv');if(sc){var o=JSON.parse(sc);p={kind:'conv',email:o.email,sid:o.sid,title:o.title};}else{var sf=e.dataTransfer.getData('application/x-dao-file');if(sf){var of=JSON.parse(sf);p={kind:'file',path:of.path,name:of.name};}}}catch(x){}if(_daoUploadToActive(p)){daoToast('⏳ 正在上传到当前网页 · '+String((p&&(p.title||p.name||p.sid))||'').slice(0,24));try{daoClose();}catch(_1){}try{dlClose();}catch(_2){}}_uploadDrag=null;});})();
_dEl('dwClose').onclick=daoClose;
_dEl('dwTabR').onclick=function(){daoTab('recent');};
_dEl('dwTabB').onclick=function(){daoTab('backup');};
_dEl('dwRefresh').onclick=daoLoadRecent;
_dEl('dwQ').oninput=daoRenderRecent;
_dEl('dwBQ').oninput=function(){_daoBkQ=this.value;daoRenderBackup();};
_dEl('dwRoot').onclick=function(){if(_bkTree&&_bkTree.root)vscode.postMessage({type:'shellRevealFile',path:_bkTree.root});};
_dEl('cvBack').onclick=daoHideCv;
// 悬浮窗拖拽(按标题栏)
(function(){var w=_dEl('daowin'),hd=_dEl('dwHead'),dx=0,dy=0,drag=false;if(!w||!hd)return;
  hd.addEventListener('mousedown',function(e){if(e.target&&e.target.id==='dwClose')return;drag=true;var r=w.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;w.style.right='auto';w.style.left=r.left+'px';w.style.top=r.top+'px';e.preventDefault();});
  window.addEventListener('mousemove',function(e){if(!drag)return;var x=Math.max(0,Math.min(window.innerWidth-90,e.clientX-dx)),y=Math.max(0,Math.min(window.innerHeight-40,e.clientY-dy));w.style.left=x+'px';w.style.top=y+'px';});
  window.addEventListener('mouseup',function(){if(drag){drag=false;try{window._daoWinSave&&window._daoWinSave(w);}catch(e){}}});})();
// ⬇下载悬浮窗 事件: 关闭/刷新/打开文件夹 + 列表内 打开/定位/删除(事件委托·CSP 安全) + 标题栏拖拽
_dEl('dlClose').onclick=dlClose;
_dEl('dlRefresh').onclick=dlLoad;
_dEl('dlFolder').onclick=function(){if(DAO_DL[0]&&DAO_DL[0].path)vscode.postMessage({type:'shellRevealFile',path:DAO_DL[0].path});else daoToast('暂无下载文件',true);};
// ── 下载列表拖拽上传(参考手机 APK): 拖动文件卡 → 携带 file:// 路径与 DownloadURL, 可拖到网页上传区/其它应用 ──
var _dlDrag=null;
_dEl('dlwin').addEventListener('dragstart',function(e){var el=e.target.closest&&e.target.closest('.rc[data-dldrag]');if(!el)return;var p=el.getAttribute('data-dldrag')||'',nm=el.getAttribute('data-dlname')||'';if(!p){try{e.preventDefault();}catch(x){}daoToast('该文件无本地路径, 无法拖拽',true);return;}_dlDrag={path:p,name:nm};_uploadDrag={kind:'file',path:p,name:nm};_convDragActive=true;el.classList.add('cdragging');try{var uri='file:///'+String(p).replace(/\\\\/g,'/').replace(/^\\/+/,'');e.dataTransfer.effectAllowed='copyLink';e.dataTransfer.setData('text/uri-list',uri);e.dataTransfer.setData('text/plain',p);try{e.dataTransfer.setData('DownloadURL','application/octet-stream:'+nm+':'+uri);}catch(x2){}try{e.dataTransfer.setData('application/x-dao-file',JSON.stringify({path:p,name:nm}));}catch(x3){}}catch(x){}_showUploadDrop('⬆ 松开 · 上传此文件到当前网页');});
_dEl('dlwin').addEventListener('dragend',function(){_dlDrag=null;_uploadDrag=null;_convDragActive=false;_hideUploadDrop();var dg=_dEl('dlwin').querySelector('.rc.cdragging');if(dg)dg.classList.remove('cdragging');});
// 下载文件卡片 → 指针拖拽上传(点按钮不触发拖拽; 原生 dragstart 在 draggable=false 后不再触发)
_dEl('dlwin').addEventListener('mousedown',function(e){if(e.button!==0)return;var el=e.target.closest&&e.target.closest('.rc[data-dldrag]');if(!el)return;
  if(e.target.closest&&e.target.closest('.b,.acts,[data-dlup],[data-dlopen],[data-dlrev],[data-dldel]'))return;
  var p=el.getAttribute('data-dldrag')||'',nm=el.getAttribute('data-dlname')||'';
  if(!p)return;
  startPDrag(e,{srcEl:el,label:'📄 '+String(nm||p).slice(0,28),payload:{kind:'file',path:p,name:nm},dropHint:'⬆ 松开到网页 = 上传此文件到当前网页'});});
_dEl('dlwin').addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('[data-dlopen],[data-dlrev],[data-dldel],[data-dlup]');if(!el)return;
  var op=el.getAttribute('data-dlopen');if(op){vscode.postMessage({type:'shellOpenFile',path:op});return;}
  var rv=el.getAttribute('data-dlrev');if(rv){vscode.postMessage({type:'shellRevealFile',path:rv});return;}
  var dl=el.getAttribute('data-dldel');if(dl){vscode.postMessage({type:'shellDownloadDel',path:dl});daoToast('已删除');return;}
  var up=el.getAttribute('data-dlup');if(up){if(_daoUploadToActive({kind:'file',path:up,name:el.getAttribute('data-dlupname')||''})){daoToast('⏳ 上传此文件到当前网页 · '+String(el.getAttribute('data-dlupname')||'').slice(0,24));try{dlClose();}catch(_e){}}return;}});
(function(){var w=_dEl('dlwin'),hd=_dEl('dlHead'),dx=0,dy=0,drag=false;if(!w||!hd)return;
  hd.addEventListener('mousedown',function(e){if(e.target&&e.target.id==='dlClose')return;drag=true;var r=w.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;w.style.right='auto';w.style.left=r.left+'px';w.style.top=r.top+'px';e.preventDefault();});
  window.addEventListener('mousemove',function(e){if(!drag)return;var x=Math.max(0,Math.min(window.innerWidth-90,e.clientX-dx)),y=Math.max(0,Math.min(window.innerHeight-40,e.clientY-dy));w.style.left=x+'px';w.style.top=y+'px';});
  window.addEventListener('mouseup',function(){if(drag){drag=false;try{window._daoWinSave&&window._daoWinSave(w);}catch(e){}}});})();
// 悬浮窗可缩放(拖四边/拖角·对齐常规软件) + 尺寸与位置持久化 — daowin/dlwin 同一套
(function(){
  function saveSz(w){try{localStorage.setItem('dao_wsz_'+w.id,JSON.stringify({w:w.style.width,h:w.style.height,l:w.style.left,t:w.style.top}));}catch(e){}}
  window._daoWinSave=saveSz;
  function restoreSz(w){try{var s=JSON.parse(localStorage.getItem('dao_wsz_'+w.id)||'null');if(!s)return;if(s.w){w.style.width=s.w;w.style.maxWidth='none';}if(s.h){w.style.height=s.h;w.style.maxHeight='none';}
    if(s.l&&s.t){var l=parseFloat(s.l),t=parseFloat(s.t);if(isFinite(l)&&isFinite(t)){l=Math.max(0,Math.min(window.innerWidth-90,l));t=Math.max(0,Math.min(window.innerHeight-40,t));w.style.right='auto';w.style.left=l+'px';w.style.top=t+'px';}}}catch(e){}}
  function mk(w){if(!w)return;restoreSz(w);var rz=false,dir='',sx=0,sy=0,sw=0,sh=0,sl=0,st=0;
    w.addEventListener('mousedown',function(e){var g=e.target.closest&&e.target.closest('.rzh');if(!g)return;
      dir=g.getAttribute('data-rz')||'se';var r=w.getBoundingClientRect();sx=e.clientX;sy=e.clientY;sw=r.width;sh=r.height;sl=r.left;st=r.top;
      w.style.right='auto';w.style.left=r.left+'px';w.style.top=r.top+'px';w.style.maxWidth='none';w.style.maxHeight='none';
      rz=true;e.preventDefault();e.stopPropagation();});
    window.addEventListener('mousemove',function(e){if(!rz)return;
      if(dir.indexOf('e')>=0)w.style.width=Math.max(340,Math.min(window.innerWidth-8,sw+(e.clientX-sx)))+'px';
      if(dir.indexOf('s')>=0)w.style.height=Math.max(240,Math.min(window.innerHeight-8,sh+(e.clientY-sy)))+'px';
      if(dir.indexOf('w')>=0){var nw2=Math.max(340,Math.min(window.innerWidth-8,sw-(e.clientX-sx)));w.style.left=(sl+sw-nw2)+'px';w.style.width=nw2+'px';}
      if(dir.indexOf('n')>=0){var nh2=Math.max(240,Math.min(window.innerHeight-8,sh-(e.clientY-sy)));w.style.top=Math.max(0,st+sh-nh2)+'px';w.style.height=nh2+'px';}});
    window.addEventListener('mouseup',function(){if(rz){rz=false;saveSz(w);}});}
  mk(_dEl('daowin'));mk(_dEl('dlwin'));})();
// ── 整页翻译(对照手机 APK translate.js·Edge 免费引擎) ──────────────────────
//   手机: 原生桥 __dcTr 做 HTTP; 桌面: 宿主做 HTTP(translate 消息), 外壳直改同源 iframe 文本节点。
//   遍历可见文本节点(含开放 Shadow DOM) → 分批送译 → 回填(保留原文可一键恢复) + MutationObserver 增量。
var _trCbs={},_trSeq=0,_trCache={},_trCacheN=0;
function _trNative(texts,to){return new Promise(function(res){var id='t'+(++_trSeq)+'_'+Date.now();_trCbs[id]=res;setTimeout(function(){if(_trCbs[id]){delete _trCbs[id];res(null);}},20000);vscode.postMessage({type:'translate',reqId:id,texts:texts,to:to||'zh-Hans'});});}
var _TR_SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,TEXTAREA:1,CODE:1,PRE:1,KBD:1,SAMP:1,SVG:1,CANVAS:1,MATH:1};
var _TR_LETTER=/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u0370-\u03FF\u3040-\u30FF\uAC00-\uD7AF]/;
function _trRejectByParent(n){var p=n.parentNode;while(p&&p.nodeType===1){if(_TR_SKIP[p.tagName])return true;if(p.isContentEditable)return true;var tr=p.getAttribute&&p.getAttribute('translate');if(tr==='no')return true;var cls=(p.className&&p.className.baseVal!==undefined)?p.className.baseVal:p.className;if(typeof cls==='string'&&/(^|\s)notranslate(\s|$)/.test(cls))return true;p=p.parentNode;}return false;}
function _trAllRoots(root){var roots=[root];try{var els=root.querySelectorAll?root.querySelectorAll('*'):[];for(var i=0;i<els.length;i++){var sr=els[i].shadowRoot;if(sr){var sub=_trAllRoots(sr);for(var j=0;j<sub.length;j++)roots.push(sub[j]);}}}catch(e){}return roots;}
function _trCollect(S,doc,root){var out=[];var filter={acceptNode:function(n){if(n.__dcOrig!==undefined)return NodeFilter.FILTER_REJECT;var t=n.nodeValue;if(!t)return NodeFilter.FILTER_REJECT;var s=t.trim();if(s.length<2||!_TR_LETTER.test(s))return NodeFilter.FILTER_REJECT;if(_trRejectByParent(n))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}};
  var roots=_trAllRoots(root);for(var r=0;r<roots.length;r++){try{var w=doc.createTreeWalker(roots[r],NodeFilter.SHOW_TEXT,filter);var n;while((n=w.nextNode()))out.push(n);_trObserveRoot(S,roots[r]);}catch(e){}}return out;}
function _trBatch(nodes){var batches=[],cur=[],chars=0;for(var i=0;i<nodes.length;i++){var len=nodes[i].nodeValue.length;if(cur.length&&(cur.length>=64||chars+len>7000)){batches.push(cur);cur=[];chars=0;}cur.push(nodes[i]);chars+=len;}if(cur.length)batches.push(cur);return batches;}
function _trApply(n,v){if(v!=null&&v!==''&&v!==n.nodeValue){n.__dcOrig=n.nodeValue;n.nodeValue=v;return 1;}if(v!=null)n.__dcOrig=n.nodeValue;return 0;}
function _trRemember(src,v){if(v==null)return;if(_trCacheN>4000){_trCache={};_trCacheN=0;}if(_trCache[src]===undefined){_trCache[src]=v;_trCacheN++;}}
function _trRunOnce(S,doc){var all=_trCollect(S,doc,doc.body||doc.documentElement);if(!all.length)return Promise.resolve(0);
  // SPA 重渲染会重建文本节点 → 命中译文缓存的同步秒回填(不等网络), 消除中英来回闪烁
  var nodes=[],done=0;for(var i=0;i<all.length;i++){var c=_trCache[all[i].nodeValue];if(c!==undefined)done+=_trApply(all[i],c);else nodes.push(all[i]);}
  if(!nodes.length)return Promise.resolve(done);var batches=_trBatch(nodes),bi=0;
  return new Promise(function(resolve){function next(){if(!S.active||bi>=batches.length){resolve(done);return;}var grp=batches[bi++];var texts=grp.map(function(n){return n.nodeValue;});
    _trNative(texts).then(function(tr){if(tr&&tr.length){for(var i=0;i<grp.length;i++){_trRemember(texts[i],tr[i]);done+=_trApply(grp[i],tr[i]);}}next();});}next();});}
function _trObserveRoot(S,root){try{if(!root||S.observed.indexOf(root)>=0)return;var mo=new MutationObserver(function(){clearTimeout(S.debounce);S.debounce=setTimeout(function(){if(S.active)_trRunOnce(S,S.doc);},250);});mo.observe(root,{childList:true,subtree:true,characterData:true});S.observed.push(root);S.mos.push(mo);}catch(e){}}
function _trRestore(S){try{S.active=false;for(var i=0;i<S.mos.length;i++){try{S.mos[i].disconnect();}catch(e){}}S.mos=[];S.observed=[];var roots=_trAllRoots(S.doc.documentElement);for(var r=0;r<roots.length;r++){try{var w=S.doc.createTreeWalker(roots[r],NodeFilter.SHOW_TEXT,null);var n;while((n=w.nextNode())){if(n.__dcOrig!==undefined){n.nodeValue=n.__dcOrig;delete n.__dcOrig;}}}catch(e){}}}catch(e){}}
function toggleTranslate(){var t=tabs[active];var fr=t?t.frame:(isBoard()&&BOARDS[activeBoardTab()]?BOARDS[activeBoardTab()].frame:null);
  if(!fr){daoToast('请先打开一个页面再翻译',true);return;}
  var doc;try{doc=fr.contentDocument||(fr.contentWindow&&fr.contentWindow.document);}catch(e){doc=null;}
  if(!doc||!doc.documentElement){
    // 跨源自愈: 页面在代理外(整页跳转逃逸/直连外站) → 问宿主要一条同源可达地址再重载续译。
    //   (旧病灶: 前端自拼 /__web?u= — webview 里相对路径落在 vscode-webview 源、Devin SPA 经 /__web
    //    又被 ES module CORS 全拦 → 点译即整页白屏。现由宿主按运行态选同源反代/代理地址, 无可达地址则不动原页。)
    var ru=t&&t.url?String(t.url):'';
    if(t&&ru&&t.__trRerouted!==ru){ // 按 URL 记重载: 换页后又可自愈, 同页只重载一次不无限循环
      t.__trRerouted=ru;window.__trPendTid=active;vscode.postMessage({type:'trReroute',url:ru});return;}
    daoToast('本页不可翻译(跨源)',true);return;}
  if(t)t.__trRerouted=null;
  var win=fr.contentWindow;var S=win.__daoTrans;
  if(S&&S.active){_trRestore(S);daoToast('已恢复原文');return;}
  S=win.__daoTrans={active:true,doc:doc,observed:[],mos:[],debounce:null};
  daoToast('🌐 翻译中…');
  _trRunOnce(S,doc).then(function(c){if(!S.active)return;daoToast(c>0?('✓ 已翻译 '+c+' 段'):'本页无可翻译内容');});}
document.getElementById('bDl').onclick=function(){dlOpen();};
document.getElementById('bBk').onclick=function(){daoOpen('recent');};
document.getElementById('bMenu').onclick=function(e){e.stopPropagation();toggleMenu();};
// 浏览器细节·点菜单外任意处一键自动收起(对齐桌面浏览器下拉菜单): 捕获阶段判定点击落点不在 #menu/#bMenu 即收起;
// 点进子网页(iframe)会令父窗口失焦 → window blur 兜底收起(iframe 内点击不冒泡到父文档)。
document.addEventListener('click',function(e){if(!MENU.className)return;var t=e.target;if(t&&t.closest&&(t.closest('#menu')||t.closest('#bMenu')))return;MENU.className='';},true);
window.addEventListener('blur',function(){if(MENU.className)MENU.className='';});
// 融化为浏览器 MCP 可驱动: 把外壳标签系统以稳定 API 挂到 window.__daoShell, 供 browser_shell_tab
//   (CDP eval)在「同一张归一网页内部」开/关/切标签与板块 — MCP 与用户共视同一网页(道并行而不相悖)。
window.__daoShell={
  open:function(u,label){u=String(u||'');if(!u)return false;
    // 站内相对路径(如 /?dao_acct=<email> 的多实例账号页)走同源直开(openCloudPage), 与地址栏 navigate 同径;
    // 绝对 URL 才经 /__web 站内代理开外站标签 — 相对路径塞进 /__web?u= 会 400。
    if(u.charAt(0)==='/'){vscode.postMessage({type:'openCloudPage',path:u,label:(label||u).slice(0,60)});return true;}
    openWebTab(u,label);return true;},
  close:function(id){closeTab(id);return true;},
  activate:function(id){setActive(id);return true;},
  board:function(b){openBoard(b);return true;},
  list:function(){var r=[];for(var i=0;i<order.length;i++){var id=order[i];var t=tabs[id];r.push({id:id,active:id===active,label:t&&t.btn?String(t.btn.textContent||'').trim().slice(0,80):id,url:(t&&t.url)||''});}return r;}
};
document.getElementById('bAdd').onclick=function(e){e.stopPropagation();openWebTab('https://app.devin.ai/','＋登 Devin');};
document.getElementById('bRefresh').onclick=function(){if(isBoard()){var bt=activeBoardTab();closeTab(boardId(bt));openBoard(bt);return;}var t=tabs[active];if(t){t.frame.setAttribute('src',t.url);setLoading(active,true);}};
document.getElementById('bHome').onclick=function(){openBoard('home');};
document.getElementById('bZi').onclick=function(){var t=tabs[active];if(t){t.zoom=Math.min(3,(t.zoom||1)+0.1);applyZoom(t);ZL.textContent=Math.round(t.zoom*100)+'%';}};
document.getElementById('bZo').onclick=function(){var t=tabs[active];if(t){t.zoom=Math.max(0.3,(t.zoom||1)-0.1);applyZoom(t);ZL.textContent=Math.round(t.zoom*100)+'%';}};
ZL.onclick=function(){var t=tabs[active];if(t){t.zoom=1;applyZoom(t);ZL.textContent='100%';}};
document.getElementById('bStar').onclick=function(){
  var key=_curFavKey();
  if(!key){daoToast('请先打开一个页面再收藏',true);return;}
  if(_isFaved()){vscode.postMessage({type:'favDel',key:key});markStar(false);daoToast('☆ 已取消收藏');return;}
  if(isBoard()){var bt=activeBoardTab();var meta=BOARD_META[bt]||['⭐',bt];vscode.postMessage({type:'favAdd',board:bt,label:meta[0]+' '+meta[1]});markStar(true);daoToast('★ 已收藏当前板块');}
  else{vscode.postMessage({type:'favAdd',id:active});markStar(true);daoToast('★ 已收藏当前页');}
};
document.getElementById('bExt').onclick=function(){var t=tabs[active];if(t)vscode.postMessage({type:'openExternal',url:t.url});};
document.getElementById('bTr').onclick=function(){toggleTranslate();};
document.getElementById('ovClose').onclick=hideOverlay;
ADDR.addEventListener('keydown',function(e){if(e.key==='Enter')navigate(ADDR.value);});
document.addEventListener('click',function(){if(MENU.className)MENU.className='';});
window.addEventListener('keydown',function(e){if(e.key==='Escape'){if(FBAR&&FBAR.className){closeFind();e.preventDefault();return;}if(TCTX&&TCTX.className){TCTX.className='';return;}}if(e.ctrlKey&&(e.key==='f'||e.key==='F')){openFind();e.preventDefault();}else if(e.ctrlKey&&(e.key==='='||e.key==='+')){document.getElementById('bZi').click();e.preventDefault();}else if(e.ctrlKey&&e.key==='-'){document.getElementById('bZo').click();e.preventDefault();}else if(e.ctrlKey&&e.key==='0'){ZL.click();e.preventDefault();}else if(e.ctrlKey&&(e.key==='r'||e.key==='R')){document.getElementById('bRefresh').click();e.preventDefault();}else if(e.ctrlKey&&(e.key==='l'||e.key==='L')){ADDR.focus();ADDR.select();e.preventDefault();}else if(e.ctrlKey&&e.key==='Tab'){cycleTab(e.shiftKey?-1:1);e.preventDefault();}else if(e.ctrlKey&&e.key==='PageDown'){cycleTab(1);e.preventDefault();}else if(e.ctrlKey&&e.key==='PageUp'){cycleTab(-1);e.preventDefault();}else if(e.ctrlKey&&(e.key==='w'||e.key==='W')){if(active)closeTab(active);e.preventDefault();}else if(e.ctrlKey&&(e.key==='\\\\'||e.key==='|')){if(active)toggleSplitWith(active);e.preventDefault();}});
// ── 归一·浏览器交互(对照 Chrome/Edge): 标签横向滚轮 / 拖拽排序 / 右键菜单 / 页内查找(Ctrl+F·不外跳) ──
var _dragId=null;
BAR.addEventListener('wheel',function(e){if(e.deltaY&&Math.abs(e.deltaY)>=Math.abs(e.deltaX||0)){BAR.scrollLeft+=e.deltaY;e.preventDefault();}},{passive:false});
function _clearDragMark(){var ts=BAR.querySelectorAll('.tab');for(var i=0;i<ts.length;i++){ts[i].classList.remove('dh-l');ts[i].classList.remove('dh-r');}}
function reorderTab(src,dst,before){if(!src||!dst||src===dst)return;var si=order.indexOf(src),di=order.indexOf(dst);if(si<0||di<0)return;order.splice(si,1);di=order.indexOf(dst);order.splice(before?di:di+1,0,src);var sb=tabs[src].btn,db=tabs[dst].btn;if(before)BAR.insertBefore(sb,db);else BAR.insertBefore(sb,db.nextSibling);schedPersist();}
function enableTabDnD(btn,id){btn.draggable=false;btn.setAttribute('data-tabid',id);
  // 道并行: 标签拖拽改指针式(原生 DnD 在 webview 跨 iframe 丢事件)。落标签栏=重排, 落网页区=上传该标签对话。
  btn.addEventListener('mousedown',function(e){if(e.button!==0)return;
    var _tt=tabs[id],_tm=(_tt&&_tt.meta)||{};var _te=_tm.email||(_tt&&_tt.email)||'',_ts=String(_tm.devinId||_tm.sid||'').replace(/^devin-/,'');
    var payload=null,label='🔖 '+String((_tt&&(_tt.title||_tt.label))||id).slice(0,28);
    if(_te&&_ts){var _ti=_tm.label||_tm.title||'';payload={kind:'conv',email:_te,sid:_ts,title:_ti};label='💬 '+String(_ti||_ts).slice(0,28);}
    startPDrag(e,{reorderId:id,payload:payload,label:label,dropHint:'⬆ 网页=上传此标签对话 · 标签栏=重排'});});}
var TCTX=document.getElementById('tabctx');
function _closeOthers(id){var ids=order.slice();for(var i=0;i<ids.length;i++)if(ids[i]!==id)closeTab(ids[i]);}
function _closeRight(id){var i=order.indexOf(id);if(i<0)return;var ids=order.slice(i+1);for(var j=0;j<ids.length;j++)closeTab(ids[j]);}
function openTabCtx(x,y,id){var t=tabs[id];if(!t)return;var isB=(id.indexOf('board:')===0);
  var rows=[['⟳ 刷新此页','reload']];
  if(!isB)rows.push(['🔗 复制链接','copy'],['↗ 系统浏览器打开','ext']);
  rows.push(['SEP'],[(splitId?'▣ 退出分屏':'▣ 与当前页分屏并排'),'split']);
  rows.push(['SEP'],['✕ 关闭','close'],['✕ 关闭其他','others'],['✕ 关闭右侧','right']);
  var h='';for(var i=0;i<rows.length;i++){h+=(rows[i][0]==='SEP')?'<div class="sep"></div>':('<div class="ci" data-a="'+rows[i][1]+'">'+rows[i][0]+'</div>');}
  TCTX.innerHTML=h;TCTX.style.left=Math.min(x,window.innerWidth-170)+'px';TCTX.style.top=Math.min(y,window.innerHeight-230)+'px';TCTX.className='on';
  var cis=TCTX.querySelectorAll('.ci');for(var k=0;k<cis.length;k++){cis[k].onclick=function(){var a=this.getAttribute('data-a');TCTX.className='';
    if(a==='reload'){setActive(id);document.getElementById('bRefresh').click();}
    else if(a==='copy'){vscode.postMessage({type:'clip',text:t.url||''});daoToast('已复制链接');}
    else if(a==='ext'){if(t.url)vscode.postMessage({type:'openExternal',url:t.url});}
    else if(a==='close'){closeTab(id);}
    else if(a==='others'){_closeOthers(id);}
    else if(a==='right'){_closeRight(id);}
    else if(a==='split'){toggleSplitWith(id);}};}}
document.addEventListener('click',function(){if(TCTX.className)TCTX.className='';});
function bindTabBtn(btn,id){enableTabDnD(btn,id);btn.addEventListener('contextmenu',function(e){e.preventDefault();e.stopPropagation();openTabCtx(e.clientX,e.clientY,id);});btn.addEventListener('auxclick',function(e){if(e.button===1){e.preventDefault();closeTab(id);}});}
// 分屏中缝拖拽调比例(拖拽时置 iframe pointer-events:none, 防子帧吞掉 mousemove)
if(SBAR){SBAR.addEventListener('mousedown',function(e){if(!_splitOn())return;e.preventDefault();SBAR.classList.add('drag');
  for(var kk in tabs)tabs[kk].frame.style.pointerEvents='none';
  function mv(ev){var r=S.getBoundingClientRect();var ratio=(ev.clientX-r.left)/(r.width||1);ratio=Math.max(.15,Math.min(.85,ratio));splitRatio=ratio;
    if(tabs[active])applyZoom(tabs[active]);if(tabs[splitId])applyZoom(tabs[splitId]);SBAR.style.left=(ratio*100)+'%';}
  function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);SBAR.classList.remove('drag');for(var kk in tabs)tabs[kk].frame.style.pointerEvents='';schedPersist&&schedPersist();}
  document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);});}
var FBAR=document.getElementById('find'),FQ=document.getElementById('fQ'),FINFO=document.getElementById('fInfo');
function activeWin(){var t=tabs[active];try{return t&&t.frame?t.frame.contentWindow:null;}catch(e){return null;}}
function openFind(){if(!active){daoToast('请先打开一个网页',true);return;}FBAR.className='on';FQ.focus();FQ.select();}
function closeFind(){FBAR.className='';try{var w=activeWin();if(w&&w.getSelection)w.getSelection().removeAllRanges();}catch(e){}}
function doFind(back){var q=FQ.value;if(!q){FINFO.textContent='';return;}var w=activeWin();if(!w||!w.find){daoToast('此页不支持页内查找',true);return;}var ok=false;try{ok=w.find(q,false,!!back,true,false,true,false);}catch(e){daoToast('此页不可检索(跨域)',true);return;}FBAR.classList.toggle('nf',!ok);FINFO.textContent=ok?'':'无结果';}
FQ.addEventListener('input',function(){FBAR.classList.remove('nf');FINFO.textContent='';});
FQ.addEventListener('keydown',function(e){if(e.key==='Enter'){doFind(e.shiftKey);e.preventDefault();}else if(e.key==='Escape'){closeFind();e.preventDefault();}});
document.getElementById('fNext').onclick=function(){doFind(false);};
document.getElementById('fPrev').onclick=function(){doFind(true);};
document.getElementById('fX').onclick=function(){closeFind();};
// 归一 · 手机端左右手势(复用 APK 切页逻辑): 在标签条上快速左右滑 → 切上/下一个标签
(function(){var sx=0,sy=0,st=0;BAR.addEventListener('touchstart',function(e){var t=e.touches[0];sx=t.clientX;sy=t.clientY;st=Date.now();},{passive:true});BAR.addEventListener('touchend',function(e){var t=e.changedTouches[0];var dx=t.clientX-sx,dy=t.clientY-sy,dt=Date.now()-st;if(dt<500&&Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*2){cycleTab(dx<0?1:-1);}},{passive:true});})();
window.addEventListener('dragover',function(e){if(_dragId||_convDragActive)return;e.preventDefault();DROP.className='on';});
window.addEventListener('dragleave',function(e){if(e.relatedTarget===null||e.relatedTarget===document.documentElement)DROP.className='';});
window.addEventListener('drop',function(e){if(_dragId||_convDragActive){DROP.className='';_convDragActive=false;return;}e.preventDefault();DROP.className='';var uris='';try{uris=e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain')||'';}catch(x){}var names=[];try{if(e.dataTransfer.files)for(var i=0;i<e.dataTransfer.files.length;i++)names.push(e.dataTransfer.files[i].name);}catch(x){}vscode.postMessage({type:'filesDropped',uris:uris,names:names});});
window.addEventListener('message',function(ev){var m=ev.data||{};
  if(m.__cwRelay){vscode.postMessage({type:'cloudRelay',msg:m.__cwRelay,board:m.__board||''});return;}
  if(m.__daoConvNav){try{_onConvNav(ev.source,m.__daoConvNav);}catch(e){}return;}
  if(m.type==='open'){mkTab(m);}
  else if(m.type==='tabUpdate'){try{updateTab(m);}catch(e){}}
  else if(m.type==='closeAll'){var ks=order.slice();for(var i=0;i<ks.length;i++)closeTab(ks[i]);vscode.postMessage({type:'closeAllAck'});}
  else if(m.type==='favs'){favs=m.list||[];syncStar();if(OV.className&&OVT.textContent.indexOf('书签')>=0)showFavs();}
  else if(m.type==='history'){history=m.list||history;if(OV.className&&OVT.textContent.indexOf('历史')>=0)showHistory();}
  else if(m.type==='accounts'){accounts=m.list||[];}
  else if(m.type==='userscripts'){userScripts=m.list||[];if(OV.className&&OVT.textContent.indexOf('用户脚本')>=0)showUserscripts();}
  else if(m.type==='usError'){try{daoToast('导入失败: '+(m.error||''),true);}catch(e){}}
  else if(m.type==='bridgeState'){bridge=m.data||null;}
  else if(m.type==='cloudInitHtml'){mountBoardSolo(m.html||'',m.board||'overview',m.url||'');}
  else if(m.type==='gotoBoard'){try{openBoard(m.board||'home');}catch(e){}}
  else if(m.type==='restoreTabs'){try{restoreTabs(m.tabs);}catch(e){}}
  else if(m.type==='cloudHost'){_boardHostAll(m.msg||{});}
  else if(m.type==='shellBackupsData'){_bkTree=m.tree||{root:'',accounts:[]};if(OV.className){if(_bkMode==='dl')renderDownloads();else if(_bkMode==='bk')renderBkLib();}try{daoRenderBackup();}catch(e){}}
  else if(m.type==='shellDownloadsData'){DAO_DL=m.list||[];dlRender();}
  else if(m.type==='dlRecentData'){try{daoOnRecent(m);}catch(e){}}
  else if(m.type==='dlExportData'){try{daoOnExport(m);}catch(e){}}
  else if(m.type==='dlZipDone'){try{daoToast(m.ok?('✓ 已打包: '+(m.name||'')):('打包失败: '+(m.error||'')),!m.ok);}catch(e){}}
  else if(m.type==='migBundle'){try{migDownload(m);}catch(e){}}
  else if(m.type==='migDone'){try{daoToast(m.ok?('✓ 导入完成 · '+(m.summary||'')):('导入失败: '+(m.error||'')),!m.ok);}catch(e){}}
  else if(m.type==='focusTab'){if(tabs[m.id])setActive(m.id);}
  else if(m.type==='toast'){try{daoToast(m.text||'',!!m.bad);}catch(e){}}
  else if(m.type==='translated'){try{var _tc=_trCbs[m.reqId];if(_tc){delete _trCbs[m.reqId];_tc(m.arr||null);}}catch(e){}}
  else if(m.type==='trRerouteRes'){try{var _ttid=window.__trPendTid;window.__trPendTid=null;var _tt=_ttid?tabs[_ttid]:null;
    if(!m.ok||!m.src||!_tt){daoToast('本页不可翻译(跨源·无同源通道)',true);}
    else{daoToast('🌐 经同源通道重载后自动翻译…');var fr2=_tt.frame;
      var onl=function(){fr2.removeEventListener('load',onl);var n=0;(function poll(){if(active!==_ttid)return;
        var d2=null;try{d2=fr2.contentDocument||(fr2.contentWindow&&fr2.contentWindow.document);}catch(e){}
        if(d2&&d2.documentElement){toggleTranslate();return;}
        if(++n<20)setTimeout(poll,500);else daoToast('本页不可翻译(重载后仍跨源)',true);})();};
      fr2.addEventListener('load',onl);
      _tt.url=m.src;_tt._loaded=true;fr2.setAttribute('src',m.src);setLoading(_ttid,true);}}catch(e){}}
  else if(m.type==='winOpen'&&m.url){try{window.open(m.url,'_blank','noopener');}catch(e){}}});
buildMenu();
vscode.postMessage({type:'ready',mobile:MOBILE});
// 归一·手机版冷启动: 与 APK app.html 一致, 首屏直接打开「🔀切号」板块(电脑端数据源), 而非空提示页。
if(MOBILE){try{openBoard('switch');}catch(e){}}
})();
</script></body></html>`;
  if (_mobile) {
    _html = _html
      .replace('<!DOCTYPE html><html>', '<!DOCTYPE html><html class="m">')
      .replace('var MOBILE=false;', 'var MOBILE=true;');
  }
  return _html;
}
// ════════════════════════════════════════════════════════════════════════
// 归一 · 独立 HTTP 外壳 (适配所有 IDE / 任意浏览器 / 手机 · 参照手机端 APK)
//   同一个 _multiShellHtml 外壳直出为可在任意浏览器打开的单页:
//     · 传输层从 VS Code webview 的 acquireVsCodeApi/postMessage 改走纯 HTTP —
//       页面→宿主: POST /api/shell/msg; 宿主→页面: SSE /api/shell/events。
//     · 由 dao-vsix 本地服务器经 /shell 路由直出, 故不再绑定 VS Code webview,
//       任何 IDE 的内置浏览器(乃至手机/远程经 DAO Bridge)皆可开同一套 UI。
//   六大板块仍走 cloudInit→cloudInitHtml(blob-iframe)与 cloudRelay/cloudHost
//   中继, 与 webview 路径同源复用·零重写。
// ════════════════════════════════════════════════════════════════════════
// 传输垫片: 宿主→页面双通道 (SSE 快路 + 长轮询回退·过任意代理), 按 _q 序号跨通道去重。
//   公网经 Cloudflare 等代理时 SSE 整体被缓冲 → 收不到任何字节; 故 SSE 若 ~3s 内无消息
//   (或报错) 即启动长轮询 (普通完整 HTTP 响应·必过代理), 补回排队消息 → 与 IDE 内一致。
const SHELL_HTTP_SHIM = "(function(){"
  + "var SID='sh_'+Math.random().toString(36).slice(2)+Date.now().toString(36);"
  + "var _st={};var lastSeq=0;var gotAny=false;var polling=false;"
  // 双重兜底(参照手机 APK P2P/中继多路失效转移): 当前源持续打不通 → 探测备用公网源(Worker 恒定地址
  //   / CF 快速隧道, 由宿主注入 DAO_ALTS + 链接携带 ?dao_alt=), 探活成功即整页跳转到备用源 /shell 续用。
  + "var _foFails=0,_foT=0,_foBusy=false;"
  + "function _foAlts(){var a=[];try{(window.DAO_ALTS||[]).forEach(function(u){a.push(u);});}catch(e){}"
  + "try{var qa=new URLSearchParams(location.search).get('dao_alt');if(qa)a.push(qa);}catch(e){}"
  + "var seen={},out=[];a.forEach(function(u){u=String(u||'').replace(/\\/+$/,'');if(!/^https?:\\/\\//i.test(u))return;"
  + "if(u.toLowerCase()===String(location.origin).toLowerCase())return;if(seen[u])return;seen[u]=1;out.push(u);});return out;}"
  + "function _foOk(){_foFails=0;_foT=0;}"
  + "function _foTry(){if(_foBusy)return;var alts=_foAlts();if(!alts.length)return;_foBusy=true;"
  + "(function next(i){if(i>=alts.length){_foBusy=false;_foFails=0;_foT=0;return;}var base=alts[i];"
  + "fetch(base+'/api/health',{mode:'no-cors'}).then(function(){"
  + "var m='';try{m=new URLSearchParams(location.search).get('m')||'';}catch(e){}"
  + "location.replace(base+'/shell?dao_alt='+encodeURIComponent(location.origin)+(m?('&m='+m):''));"
  + "}).catch(function(){next(i+1);});})(0);}"
  + "function _foFail(){_foFails++;if(!_foT)_foT=Date.now();if(_foFails>=6&&(Date.now()-_foT)>15000)_foTry();}"
  + "function post(m){try{fetch('/api/shell/msg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sid:SID,msg:m})}).catch(function(){});}catch(e){}}"
  + "function apply(m){if(!m)return;if(typeof m._q==='number'){if(m._q<=lastSeq)return;lastSeq=m._q;}gotAny=true;"
  + "if(m.type==='__copy'){try{navigator.clipboard.writeText(m.text||'');}catch(e){}return;}"
  + "try{window.postMessage(m,'*');}catch(e){}}"
  + "function pollLoop(){fetch('/api/shell/poll?sid='+encodeURIComponent(SID)+'&after='+lastSeq).then(function(r){return r.json();}).then(function(j){_foOk();if(j){if(typeof j.last==='number'&&j.last<lastSeq){lastSeq=0;}if(j.msgs){j.msgs.forEach(apply);}}setTimeout(pollLoop,40);}).catch(function(){_foFail();setTimeout(pollLoop,2000);});}"
  + "function startPoll(){if(polling)return;polling=true;pollLoop();}"
  + "window.acquireVsCodeApi=function(){return{postMessage:function(m){try{"
  + "if(m&&m.type==='openExternal'&&m.url){window.open(m.url,'_blank');return;}"
  + "if(m&&m.type==='clip'&&m.text){try{navigator.clipboard.writeText(m.text);}catch(e){}return;}"
  + "post(m);"
  + "}catch(e){}},getState:function(){return _st;},setState:function(s){_st=s;return s;}};};"
  + "function connect(){try{var es=new EventSource('/api/shell/events?sid='+encodeURIComponent(SID));"
  + "es.onmessage=function(ev){var m;try{m=JSON.parse(ev.data);}catch(e){return;}apply(m);};"
  + "es.onerror=function(){if(!gotAny)startPoll();};}catch(e){startPoll();}}connect();"
  + "startPoll();"
  + "})();";
// 直出独立外壳: 复用 _multiShellHtml, 放开 CSP 的 connect-src(同源 fetch/SSE) 并注入 HTTP 传输垫片。
//   opts.alts: 备用公网源列表(Worker 恒定地址 / CF 快速隧道) — 注入 DAO_ALTS 供双重兜底失效转移;
//   connect-src 放开 https:(仅用于对备用源 /api/health 的 no-cors 探活)。
function _standaloneShellHtml(opts) {
  opts = opts || {};
  let html = _multiShellHtml({ mobile: !!opts.mobile });
  html = html.replace(
    /<meta http-equiv="Content-Security-Policy"[^>]*>/i,
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; connect-src \'self\' https: http://localhost:* http://127.0.0.1:*; img-src data: https: http://localhost:* http://127.0.0.1:*; frame-src blob: \'self\' http://localhost:* http://127.0.0.1:*;">'
  );
  const alts = (Array.isArray(opts.alts) ? opts.alts : [])
    .map((u) => String(u || '').replace(/\/+$/, ''))
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 4);
  const shim = '<scr' + 'ipt>window.DAO_ALTS=' + JSON.stringify(alts) + ';' + SHELL_HTTP_SHIM + '</scr' + 'ipt>';
  html = html.replace(/<head([^>]*)>/i, '<head$1>' + shim);
  return html;
}
// ── 宿主→页面单向推送总线: SSE (快路) + 长轮询 (回退) 双通道, 每会话(sid)隔离 ──
//   缘起 (实证·公网): Cloudflare quick tunnel (含用户自有 DAO Bridge) 会整体缓冲
//     `text/event-stream` 响应 — SSE 一字节都到不了浏览器 → 公网用户六大板块永远「加载中」。
//   正法: 不依赖流式。每会话维护带序号(seq)的出站消息队列:
//     · 有 SSE 连接 → 立即写 SSE (本地/IDE 内置浏览器·零延迟)。
//     · 同时入队 → 任意代理后的公网用户改用 GET /api/shell/poll?sid=&after=<seq> 长轮询取回,
//       每次返回的是普通完整 HTTP 响应 (不流式·必过 CF) → 与 IDE 内完全一致。
//   去重: 每条消息带 `_q` 单调序号; 页面跨两通道按 lastSeq 去重, 绝不重复处理。
//   隔离: 队列、序号、长轮询 waiter 全部按 sid 分治 → 多用户道并行而不相悖。
const _shellClients = new Map(); // sid → SSE res (在线流式连接)
const _shellQueues = new Map();  // sid → { seq, msgs:[{seq,obj}], waiters:[], touch }
const _SHELL_Q_MAX = 600;        // 每会话保留最近 N 条 (回退轮询补发窗口)
const _SHELL_SID_MAX = 60;       // 最多保留 N 个会话队列 (LRU 淘汰·防泄漏)
function _shellQ(sid) {
  let q = _shellQueues.get(sid);
  if (!q) {
    q = { seq: 0, msgs: [], waiters: [], touch: Date.now() };
    _shellQueues.set(sid, q);
    if (_shellQueues.size > _SHELL_SID_MAX) {
      let oldK = null, oldT = Infinity;
      for (const [k, v] of _shellQueues) { if (!_shellClients.has(k) && v.touch < oldT) { oldT = v.touch; oldK = k; } }
      if (oldK != null) { const ov = _shellQueues.get(oldK); if (ov) { for (const w of ov.waiters.splice(0)) { try { w.done(); } catch (e) {} } } _shellQueues.delete(oldK); }
    }
  } else { q.touch = Date.now(); }
  return q;
}
// 核心: 给某 sid 派发一条消息 — 入队(带 seq)、写 SSE(若在线)、唤醒长轮询 waiter。
function _shellEmit(sid, msg) {
  if (!sid) return false;
  const q = _shellQ(sid);
  const seq = ++q.seq;
  const obj = Object.assign({}, msg, { _q: seq });
  q.msgs.push({ seq, obj });
  if (q.msgs.length > _SHELL_Q_MAX) q.msgs.splice(0, q.msgs.length - _SHELL_Q_MAX);
  const res = _shellClients.get(sid);
  if (res) { try { res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch (e) {} }
  if (q.waiters.length) { for (const w of q.waiters.splice(0)) { try { w.fire(); } catch (e) {} } }
  return true;
}
function _shellAttach(sid, res) {
  if (!sid || !res) return;
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
  } catch (e) { return; }
  _shellQ(sid); // 确保队列存在 → 后续广播/回退轮询覆盖此会话
  const prev = _shellClients.get(sid);
  if (prev && prev !== res) { try { prev.end(); } catch (e) {} }
  _shellClients.set(sid, res);
  const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch (e) {} }, 25000);
  const close = () => { clearInterval(ka); if (_shellClients.get(sid) === res) _shellClients.delete(sid); };
  try { res.on('close', close); } catch (e) {}
  try { res.on('error', close); } catch (e) {}
}
function _shellSend(sid, msg) { return _shellEmit(sid, msg); }
function _shellBroadcast(msg) {
  // 广播给所有已知会话 (含仅长轮询·无 SSE 的公网会话), 各自独立 seq。
  const sids = new Set();
  for (const k of _shellClients.keys()) sids.add(k);
  for (const k of _shellQueues.keys()) sids.add(k);
  let n = 0;
  for (const sid of sids) { if (_shellEmit(sid, msg)) n++; }
  return n;
}
// GET /api/shell/poll?sid=&after=<seq> — 长轮询回退 (公网/任意代理后均可用·非流式)。
//   返回 seq>after 的全部排队消息; 无则挂起至多 ~25s, 有新消息即返回 (空则返回空数组)。
function _shellPoll(sid, after, res) {
  if (!sid || !res) { try { res && res.end(); } catch (e) {} return; }
  const q = _shellQ(sid);
  const aft = Math.max(0, parseInt(after, 10) || 0);
  let done = false;
  const respond = () => {
    if (done) return; done = true;
    const pending = q.msgs.filter((it) => it.seq > aft);
    const last = q.msgs.length ? q.msgs[q.msgs.length - 1].seq : aft;
    try {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, last, msgs: pending.map((it) => it.obj) }));
    } catch (e) {}
  };
  // 已有积压 → 立即返回
  if (q.msgs.some((it) => it.seq > aft)) { respond(); return; }
  // 否则挂起等待新消息 (或超时)
  const waiter = { fire: respond, done: respond };
  q.waiters.push(waiter);
  const timer = setTimeout(() => {
    const i = q.waiters.indexOf(waiter); if (i >= 0) q.waiters.splice(i, 1);
    respond();
  }, 25000);
  const cleanup = () => { clearTimeout(timer); const i = q.waiters.indexOf(waiter); if (i >= 0) q.waiters.splice(i, 1); };
  try { res.on('close', cleanup); } catch (e) {}
  try { res.on('error', cleanup); } catch (e) {}
}
// ── 多用户「道并行而不相悖」· 六大板块宿主回推按会话隔离 ──────────────────
//   病灶: 旧实现 setHostPost 恒走 _shellBroadcast — 把某用户触发的板块数据/回包
//   广播给所有连接的浏览器 → 公网多用户互相串台 (相悖)。
//   正法: _cloudProvider 是「单一宿主、状态为号主共享」的实例, 故:
//     · 单用户发起的请求(cloudInit/cloudRelay/cloudReady)经 _shellCloudRun 串行化执行,
//       执行期间把 _shellCloudActiveSid 锁定为该 sid, 宿主一切回推(含 await 后的异步回包)
//       只经 SSE 发给这个 sid → 各用户各得其所·互不串台 (鸡犬相闻·老死不相往来)。
//     · 任务之间(active 为空)宿主若有后台主动刷新(refresh), 因数据本为号主共享, 广播给所有页。
//   串行化代价: 各用户的板块操作排队执行; 板块多为快读, 而切号/清理等本就是改号主共享态的
//   全局变更, 串行+广播结果正是其应有语义, 故无碍。
let _shellCloudActiveSid = '';
let _shellCloudQueue = Promise.resolve();
function _shellCloudDispatch(mm) {
  if (_shellCloudActiveSid) _shellSend(_shellCloudActiveSid, { type: 'cloudHost', msg: mm });
  else _shellBroadcast({ type: 'cloudHost', msg: mm });
}
function _shellCloudRun(sid, fn) {
  _shellCloudQueue = _shellCloudQueue.then(async () => {
    _shellCloudActiveSid = sid || '';
    try { if (_cloudProvider && _cloudProvider.setHostPost) _cloudProvider.setHostPost(_shellCloudDispatch); } catch (e) {}
    try { await fn(); } catch (e) { try { log('[shell] cloud task err: ' + (e && e.message)); } catch (x) {} }
    finally { _shellCloudActiveSid = ''; }
  });
  return _shellCloudQueue;
}
// ── 归一 · 公网同源前缀 · dao 自渲染 (道并行而不相悖) ──────────────────────────
// 病灶其一(已解): _shellResolveOpen 旧返 `http://localhost:<随机端口>/…`(绑 127.0.0.1·公网打不开)。
// 病灶其二(根本): 现版 Devin 官网迁移到 Auth0/SSO, 账号密码登录只得旧 auth1 令牌、官网 SPA 已不收;
//   故「内嵌官网 SPA + 注入 auth1_session」对密码池账号根本走不通(IDE 内多实例按钮失效亦同因)。
// 归一正解: 每账号映射到不可枚举 accKey, 经主口 9920 同源路径 `/i/<accKey>/*` 暴露; 该路径不再反代
//   官网 SPA, 改由 dao 用 auth1 调内部 REST API、服务端自渲染原生页(对话列表 / 对话视图)——Auth0 免疫、
//   令牌只在服务端、手机(APK 网页)与电脑(归一网页)前端/逻辑一致。隧道主口直达, 公网设备无感访问。
// ── 同源前缀路由判定 (纯函数·可单测) ──
//   '/sessions/<id>' → 原生对话视图; '/__dao/create'(POST) → 新建对话; '/__dao/sessions' → JSON 列表;
//   '/favicon.ico' → 204; 其余(含根 '/') → 原生对话列表。
function _shellAccRoute(pathOnly) {
  const p = String(pathOnly || '/') || '/';
  if (p === '/favicon.ico') return { kind: 'favicon' };
  if (p === '/__dao/create') return { kind: 'create' };
  if (p === '/__dao/sessions') return { kind: 'sessionsJson' };
  const m = p.match(/^\/sessions\/([^\/?]+)/);
  if (m) return { kind: 'conv', id: decodeURIComponent(m[1]) };
  return { kind: 'list' };
}
const _shellAccSalt = crypto.randomBytes(16).toString('hex'); // 进程级盐 → accKey 不可枚举(防公网猜测)
const _shellAccByKey = new Map();   // accKey → emailLower
const _shellAccByEmail = new Map(); // emailLower → accKey
function _shellAccKey(email) {
  const e = String(email || '').toLowerCase();
  let k = _shellAccByEmail.get(e);
  if (k) return k;
  k = 'a' + crypto.createHmac('sha256', _shellAccSalt).update(e).digest('hex').slice(0, 20);
  _shellAccByEmail.set(e, k);
  _shellAccByKey.set(k, e);
  return k;
}
// 主口 9920 的 /i/<accKey>/* 路由就地调用: 解析账号 auth → dao 用 auth1 调内部 REST API 服务端自渲染。
//   restPath 为已剥 `/i/<accKey>` 的同源路径 (含 query)。直接写 res (流式)。令牌只在服务端, 不下发浏览器。
async function shellAccountProxy(accKey, restPath, req, res) {
  let _csUrl = '/';
  const _txt = (status, s) => { if (res && !res.headersSent) { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); } if (res) res.end(s); };
  const _html = (status, s) => {
    if (status === 200 && typeof s === 'string') {
      try { const inj = _buildUserScriptInject(_csUrl); if (inj) { s = /<\/body>/i.test(s) ? s.replace(/<\/body>/i, inj + '</body>') : (s + inj); } } catch (e) {}
      // 拖拽上传桥(同源 /__daobridge.js): 拖文件/会话到该页 → 投递上传框 (对齐手机 APK)。
      try { const dbg = '<script src="/__daobridge.js"></script>'; s = /<\/body>/i.test(s) ? s.replace(/<\/body>/i, dbg + '</body>') : (s + dbg); } catch (e) {}
    }
    if (res && !res.headersSent) {
      res.writeHead(status, {
        'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'self'; img-src data:; connect-src 'self'; form-action 'self'",
      });
    }
    if (res) res.end(s);
  };
  const _json = (status, obj) => { if (res && !res.headersSent) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); } if (res) res.end(JSON.stringify(obj)); };
  try {
    const email = _shellAccByKey.get(String(accKey || ''));
    if (!email) { _txt(404, 'unknown account'); return; }
    const base = '/i/' + accKey;
    let rest = String(restPath == null ? '/' : restPath);
    if (rest.charAt(0) !== '/') rest = '/' + rest;
    const qIdx = rest.indexOf('?');
    const pathOnly = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
    _csUrl = 'https://app.devin.ai' + (pathOnly || '/');
    const route = _shellAccRoute(pathOnly);
    if (route.kind === 'favicon') { if (res && !res.headersSent) res.writeHead(204); if (res) res.end(); return; }

    const auth = await _resolveAuthForEmail(email);
    if (!auth || !auth.auth1) {
      // 账号未登录: 列表/对话给出可读原生页, 接口给 JSON
      if (route.kind === 'create' || route.kind === 'sessionsJson') { _json(502, { ok: false, error: 'account not logged in' }); return; }
      _html(502, devinCloud.buildSessionsListHtml(email, [], { base, error: '账号未登录 · 请在切号面板登录后重试' }));
      return;
    }
    const authObj = { auth1: auth.auth1, userId: auth.userId, orgId: auth.orgId, orgBare: auth.orgBare, orgName: auth.orgName, email };

    if (route.kind === 'create') {
      let body = '';
      await new Promise((resolve) => {
        try { req.on('data', (d) => { body += d; if (body.length > 1e6) body = body.slice(0, 1e6); }); req.on('end', resolve); req.on('error', resolve); }
        catch (e) { resolve(); }
      });
      let prompt = '';
      try { const j = JSON.parse(body || '{}'); prompt = String(j.prompt || j.user_message || ''); } catch (e) {}
      if (!prompt.trim()) { _json(400, { ok: false, error: 'empty prompt' }); return; }
      const r = await devinCloud.createSession(authObj, prompt);
      if (r && r.ok && r.devinId) _json(200, { ok: true, devinId: r.devinId, url: base + '/sessions/' + encodeURIComponent(r.devinId) });
      else _json(502, { ok: false, error: (r && r.error) || 'create failed' });
      return;
    }
    if (route.kind === 'sessionsJson') {
      const r = await devinCloud.listSessions(authObj, 200);
      _json(r && r.ok ? 200 : 502, r && r.ok ? { ok: true, sessions: r.sessions } : { ok: false, error: (r && r.error) || 'list failed' });
      return;
    }
    if (route.kind === 'conv') {
      let events = [];
      try { events = await devinCloud.getEventStream(authObj, route.id); } catch (e) { events = []; }
      let title = route.id;
      try { const d = await devinCloud.getSessionDetail(authObj, route.id); if (d && (d.title || d.name)) title = d.title || d.name; } catch (e) {}
      _html(200, devinCloud.buildConversationHtml(title, route.id, events || [], { account: email, base }));
      return;
    }
    // 默认: 原生对话列表
    const lr = await devinCloud.listSessions(authObj, 200);
    _html(200, devinCloud.buildSessionsListHtml(email, (lr && lr.ok ? lr.sessions : []) || [], {
      base, orgName: auth.orgName || auth.orgId || '', error: (lr && lr.ok) ? '' : ((lr && lr.error) || ''),
    }));
  } catch (e) {
    _txt(500, 'render fail: ' + (e && e.message));
  }
}
// 拖拽会话到网页 → 该会话最新 MD (实时 getEventStream 导出·即最新数据·复用备份引擎 buildConversationMd)。
//   供 /__convmd 端点同源取用; 网页内 drop 桥据此合成 .md File 喂入页面上传框 (对齐手机 APK 拖会话=拖其 MD)。
async function resolveConvMd(email, sid) {
  email = String(email || '').trim();
  sid = String(sid || '').trim().replace(/^devin-/, '');
  if (!email || !sid) return null;
  try {
    const auth = await _resolveAuthForEmail(email);
    if (!auth || !auth.auth1) return null;
    const authObj = { auth1: auth.auth1, userId: auth.userId, orgId: auth.orgId, orgBare: auth.orgBare, orgName: auth.orgName, email };
    let events = [];
    try { events = await devinCloud.getEventStream(authObj, sid); } catch (e) { events = []; }
    let title = sid;
    try { const d = await devinCloud.getSessionDetail(authObj, sid); if (d && (d.title || d.name)) title = d.title || d.name; } catch (e) {}
    const md = devinCloud.buildConversationMd(title, sid, events || []);
    if (!md) return null;
    const safe = String(title || sid).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 80) || sid;
    return { name: safe + '.md', text: md };
  } catch (e) { return null; }
}
// 取数指引 MD (对照手机 APK · 与对话 MD 配套的第二份文档): 账号坐标+Session ID+提取流程。
async function resolveConvGuide(email, sid) {
  email = String(email || '').trim();
  sid = String(sid || '').trim().replace(/^devin-/, '');
  if (!email || !sid) return null;
  try {
    const acc = ((_store && _store.accounts) || []).find((a) => String(a.email || '').toLowerCase() === email.toLowerCase()) || { email };
    let orgName = '', orgId = '';
    try { const auth = await _resolveAuthForEmail(email); if (auth) { orgName = auth.orgName || ''; orgId = auth.orgId || ''; } } catch (e) {}
    let title = sid;
    try { const auth2 = await _resolveAuthForEmail(email); if (auth2 && auth2.auth1) { const d = await devinCloud.getSessionDetail({ auth1: auth2.auth1, userId: auth2.userId, orgId: auth2.orgId, orgBare: auth2.orgBare, email }, sid); if (d && (d.title || d.name)) title = d.title || d.name; } } catch (e) {}
    const text = devinCloud.buildAccessGuide({ email: acc.email, password: acc.password || '', orgName, orgId }, sid, title);
    const safe = String(title || sid).replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 70) || sid;
    return { name: safe + '_取数指引.md', text };
  } catch (e) { return null; }
}
// 会话是否仍在进行(活跃) — 拖拽上传择路: 进行中=两份 MD(对话+取数指引) / 已结束=整包 ZIP。
async function resolveConvActive(email, sid) {
  email = String(email || '').trim();
  sid = String(sid || '').trim().replace(/^devin-/, '');
  if (!email || !sid) return { ok: false, active: false };
  try {
    const auth = await _resolveAuthForEmail(email);
    if (!auth || !auth.auth1) return { ok: false, active: false };
    const authObj = { auth1: auth.auth1, userId: auth.userId, orgId: auth.orgId, orgBare: auth.orgBare, email };
    let active = [];
    try { active = await devinCloud.listRunningSessions(authObj); } catch (e) { active = []; }
    const hit = (active || []).some((s) => String(s.devinId || '').replace(/^devin-/, '') === sid);
    return { ok: true, active: hit };
  } catch (e) { return { ok: false, active: false }; }
}
// 会话整包 ZIP (已结束对话·全量备份): 复用备份引擎 backupOneConversation(增量语义 —
//   事件未增长直接复用既有 zip; 有更新则重备覆盖 → ZIP 数据覆盖型增量更新为最新)。
async function resolveConvZip(email, sid) {
  email = String(email || '').trim();
  sid = String(sid || '').trim().replace(/^devin-/, '');
  if (!email || !sid) return null;
  try {
    const auth = await _resolveAuthForEmail(email);
    if (!auth || !auth.auth1) return null;
    const authObj = { auth1: auth.auth1, userId: auth.userId, orgId: auth.orgId, orgBare: auth.orgBare, orgName: auth.orgName, email };
    let title = sid;
    try { const d = await devinCloud.getSessionDetail(authObj, sid); if (d && (d.title || d.name)) title = d.title || d.name; } catch (e) {}
    const accountDir = _dvAccountBackupDir(email);
    const one = await devinCloud.backupOneConversation(authObj, { devin_id: sid, title }, accountDir, { incremental: true, turbo: true });
    let zipPath = one && one.zip;
    if (one && one.skipped) { // 无新事件 → 复用既有 zip
      try {
        const st = devinCloud.readBackupState ? devinCloud.readBackupState() : null;
        const nm = st && st[authObj.orgBare + ':' + sid] && st[authObj.orgBare + ':' + sid].zip;
        if (nm) zipPath = path.join(accountDir, nm);
      } catch (e) {}
      if (!zipPath) { const one2 = await devinCloud.backupOneConversation(authObj, { devin_id: sid, title }, accountDir, { incremental: false, turbo: true }); zipPath = one2 && one2.zip; }
    }
    if (!zipPath || !fs.existsSync(zipPath)) return null;
    return { name: path.basename(zipPath), buf: fs.readFileSync(zipPath) };
  } catch (e) { return null; }
}
// 解析「开一个账号标签」的元数据 (同 openMultiInstance 的反代解析, 但不创建 webview —
// 独立页自身经 mkTab 以 iframe 开标签)。返回与 webview 'open' 消息同形的对象。
//   归一: url 改为同源相对 `/i/<accKey>/…` → IDE 内置浏览器(localhost:9920)与公网隧道两端皆可达。
async function _shellResolveOpen(opts) {
  opts = opts || {};
  const email = String(opts.email || '').trim();
  if (!email) return null;
  const sid = String(opts.devinId || '').trim().replace(/^devin-/, '');
  const auth = await _resolveAuthForEmail(email, opts.password);
  if (!auth || !auth.auth1) return null;
  const base = '/i/' + _shellAccKey(email); // 同源相对前缀 (隧道主口 9920 直达·公网设备无感)
  const pageRaw = String(opts.path || '').trim();
  const pagePath = pageRaw ? ('/' + pageRaw.replace(/^\/+/, '')) : '';
  // 归一·整 SPA 同源直出: 账号页经同源反代 `/org|/sessions…?dao_acct=<email>` 开整 Devin SPA
  //   (含真·上传框 → 拖拽桥可投递·对齐手机; 静态资源走缓存 → 提速; auth 按 dao_acct 逐页钉死注入·
  //   多号并行各取各 auth 不串)。取代旧 `/i/` 服务端轻渲染页(无上传框 → 拖文件无处落)。
  void base; // (旧 /i/ 前缀保留以兼容历史; 现统一走整 SPA 同源直出)
  const acctQ = 'dao_acct=' + encodeURIComponent(email);
  let url;
  if (pagePath) {
    url = pagePath + (pagePath.indexOf('?') >= 0 ? '&' : '?') + acctQ;
  } else if (sid) {
    url = '/sessions/' + encodeURIComponent(sid) + '?' + acctQ;
  } else {
    // 首页 → 同源根 '/'(带 dao_acct): SPA 据本号 auth-pinned API 自解析正确 org 跳 /org/<真 slug>。
    //   不自拼 /org/<orgName>: orgName 是 org「显示名」非「URL slug」(实测 nuek 的 orgName=um94c,
    //   但 /org/um94c 客户端 404) → 唯 SPA 自身知其真 slug。多号同源(9920)的残留缓存串号问题,
    //   由注入桥的「账号切换即涤除上一号 localStorage 残留」闭环兜底(见 daoCloudProxyRoute authBridge)。
    url = '/?' + acctQ;
  }
  const short = email.split('@')[0];
  const fresh = !!opts.fresh; // 新建标签/汉堡「新建 Devin 标签」→ 每次开一张全新页(唯一 id·不折叠到已存在的账号首页)
  const id = email.toLowerCase() + '|' + (pagePath ? ('page' + pagePath) : (sid || 'home')) + (fresh ? ('|n' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)) : '');
  let accNo = 0, dollars = 0;
  try {
    const idx = ((_store && _store.accounts) || []).findIndex(
      (a) => String(a.email).toLowerCase() === email.toLowerCase(),
    );
    if (idx >= 0) accNo = idx + 1;
    const h = _store && _store.getHealth ? _store.getHealth(email) : null;
    if (h && h.overageDollars > 0) dollars = Math.round(h.overageDollars);
  } catch (e) {}
  const title = String(opts.title || '').trim();
  const pageLabel = String(opts.label || '').trim();
  const label = title || (short + (pagePath ? (' · ' + (pageLabel || pagePath)) : (sid ? (' · ' + sid.slice(0, 8)) : '')));
  const status = String(opts.status || '').trim();
  return { type: 'open', id, label, url, accNo, dollars, status, email, devinId: sid };
}
// 道·同源全功能 Devin 页: 外壳内开 Devin(＋按钮/地址栏) → 经同源反代 `/org|/sessions…?dao_acct=<活动账号>`
//   直出整 SPA。同源(主口 9920) → 与下载/备份窗口同文档 → 拖拽桥可用·无 CORS·静态资源走缓存提速;
//   取代旧 `/__web?u=app.devin.ai`(注 <base href=app.devin.ai> → SPA 的 ES module 分包按绝对地址跨源
//   import 被 CORS 全拦 → 整页空白)。返回同源相对路径; 非 Devin 站点或无登录态 → null(回落 /__web)。
async function _shellDevinSameOrigin(rawUrl) {
  try {
    let u; try { u = new URL(String(rawUrl || '')); } catch (e) { return null; }
    if (!/(^|\.)devin\.ai$/i.test(u.hostname)) return null;
    const email = (_store && _store.activeEmail) || ((_store && _store.accounts && _store.accounts[0] && _store.accounts[0].email) || '');
    if (!email) return null;
    const auth = await _resolveAuthForEmail(email);
    if (!auth || !auth.auth1) return null;
    // 首页留 '/'(同源根 + dao_acct → SPA 据 auth-pinned API 自解析真 slug 跳 /org/<真 slug>);
    //   不自拼 /org/<orgName>(orgName 是显示名非 URL slug, 实测会 404)。串号由 authBridge 涤除残留兜底。
    let p = u.pathname || '/';
    if (p === '') p = '/';
    const q = (u.search ? (u.search + '&') : '?') + 'dao_acct=' + encodeURIComponent(email);
    return p + q;
  } catch (e) { return null; }
}
// 独立 HTTP 外壳的宿主侧消息处理 (复刻 _wireMultiPanel, 但 send 经 SSE; 开标签经 _shellResolveOpen)。
async function shellHandleMessage(sid, m) {
  if (!m || !m.type) return;
  const send = (msg) => _shellSend(sid, msg);
  try {
    switch (m.type) {
      case 'ready':
        send({ type: 'favs', list: _getMultiFavs() });
        send({ type: 'history', list: _getMultiHist() });
        send({ type: 'userscripts', list: _getUserScripts() });
        // 状态续接: 有已存标签 → 还原(老用户停在原网页); 无 → 电脑端落「六合一主页」(新用户), 手机端由前端冷启动开🔀切号。
        try {
          const st = (_ctx && _ctx.globalState && _ctx.globalState.get('dao.shellTabs')) || [];
          if (st.length) send({ type: 'restoreTabs', tabs: st });
          else if (!m.mobile) send({ type: 'gotoBoard', board: 'home' });
        } catch (e) {}
        return;
      case 'shellSaveTabs':
        try { if (_ctx && _ctx.globalState) _ctx.globalState.update('dao.shellTabs', Array.isArray(m.tabs) ? m.tabs.slice(0, 40) : []); } catch (e) {}
        return;
      case 'shellStatus': {
        await _handleShellStatus(m, send);
        return;
      }
      case 'trReroute': {
        // 翻译跨源自愈: 前端碰到跨源页 → 宿主选同源可达地址(Devin 站 → 同源反代相对路径; 其余 http(s) → /__web 同源代理)。
        const ru = String(m.url || '');
        let src = '';
        try { src = (await _shellDevinSameOrigin(ru)) || ''; } catch (e) { src = ''; }
        if (!src && /^https?:\/\//i.test(ru) && !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(ru)) src = '/__web?u=' + encodeURIComponent(ru);
        send({ type: 'trRerouteRes', ok: !!src, src });
        return;
      }
      case 'translate': {
        // 归一 · 整页翻译(对照手机 APK TranslateBridge): 宿主做 HTTP → Edge 免费引擎(无 key·国内可直连)。
        const reqId = String(m.reqId || ''); if (!reqId) return;
        const texts = Array.isArray(m.texts) ? m.texts.slice(0, 128).map((x) => String(x == null ? '' : x)) : [];
        let arr = null;
        try { arr = await _edgeTranslate(texts, String(m.to || 'zh-Hans')); } catch (e) { arr = null; }
        send({ type: 'translated', reqId, arr: arr || [] });
        return;
      }
      case 'usList': send({ type: 'userscripts', list: _getUserScripts() }); return;
      case 'usSave': {
        const list = _getUserScripts();
        const e = m.entry || {};
        if (e.id) { const i = list.findIndex((x) => x.id === e.id); if (i >= 0) list[i] = Object.assign({}, list[i], e); else list.push(Object.assign({ id: _usId(), enabled: true }, e)); }
        else list.push(Object.assign({ id: _usId(), enabled: true }, e));
        _setUserScripts(list); send({ type: 'userscripts', list: _getUserScripts() }); _toast('✓ 用户脚本已保存'); return;
      }
      case 'usToggle': {
        const list = _getUserScripts(); const i = list.findIndex((x) => x.id === m.id);
        if (i >= 0) { list[i].enabled = list[i].enabled === false; _setUserScripts(list); } send({ type: 'userscripts', list: _getUserScripts() }); return;
      }
      case 'usDelete': { _setUserScripts(_getUserScripts().filter((x) => x.id !== m.id)); send({ type: 'userscripts', list: _getUserScripts() }); return; }
      case 'usImport': {
        try { const r = _usImportExtension(m.path); send({ type: 'userscripts', list: r.list }); _toast('✓ 已导入扩展 ' + r.name + ' (' + r.count + ' 脚本)'); }
        catch (e) { _toast('导入失败: ' + ((e && e.message) || e)); send({ type: 'usError', error: (e && e.message) || String(e) }); }
        return;
      }
      case 'getAccounts': {
        const list = (((_store && _store.accounts) || [])).map((a, i) => {
          let dollars = 0;
          try { const h = _store && _store.getHealth ? _store.getHealth(a.email) : null; if (h && h.overageDollars > 0) dollars = Math.round(h.overageDollars); } catch (e) {}
          return { accNo: i + 1, email: a.email, name: a.name || String(a.email || '').split('@')[0], dollars };
        });
        send({ type: 'accounts', list });
        // v3.51.0 · 切号板一开即后台节流预热前若干号 auth1 → 随后多实例首开秒开 (受控并发·不抛·不阻塞)
        try { _prewarmAuthThrottled(list.map((x) => x && x.email)); } catch (e) {}
        return;
      }
      case 'newDevinTab': {
        // 新建标签(＋) → 登录官网 (而非跳进已登录账号): 独立外壳经浏览器新标签打开官网登录页。
        if (m.clean) { send({ type: 'winOpen', url: 'https://app.devin.ai/' }); _toast('已打开官网登录页 · 登录后可在切号面板入号池'); return; }
        const accs = ((_store && _store.accounts) || []);
        const cand = [];
        const pushE = (e) => { const k = String(e || '').trim().toLowerCase(); if (k && cand.indexOf(k) < 0) cand.push(k); };
        pushE(m.email);
        pushE(_store && _store.activeEmail);
        for (const a of accs) { try { const au = devinCloud.getCachedAuth(a.email); if (au && au.auth1) pushE(a.email); } catch (e) {} }
        for (const a of accs) { if (a && a.password) pushE(a.email); }
        for (const a of accs) pushE(a.email);
        if (!cand.length) { _toast('无可用账号 · 请先在账号库添加'); return; }
        let open = null;
        for (const e of cand) { try { open = await _shellResolveOpen({ email: e, fresh: true }); } catch (er) { open = null; } if (open) break; }
        if (open) send(open); else _toast('账号反代未就绪 · 请先在切号面板登录一个账号');
        return;
      }
      case 'switchOpen':
      case 'reopen': {
        const open = await _shellResolveOpen({ email: m.email, devinId: m.devinId, path: m.path });
        if (open) send(open);
        return;
      }
      case 'openCloudPage': {
        const email = (_store && _store.activeEmail) || ((_store && _store.accounts && _store.accounts[0] && _store.accounts[0].email) || '');
        if (!email) { _toast('无可用账号'); return; }
        const open = await _shellResolveOpen({ email, path: m.path, label: m.label });
        if (open) send(open);
        return;
      }
      case 'openWebTab': {
        // 站内新标签开任意网页/搜索(＋按钮·地址栏 URL/搜索词) → 经同源相对 /__web 代理直出
        //   (剥 XFO/CSP·隧道与本机内置浏览器两端皆可达, 不再弹外部系统浏览器·不再静默丢弃)。
        if (!m.url) return;
        let abs = await _shellDevinSameOrigin(m.url);
        if (!abs) abs = '/__web?u=' + encodeURIComponent(m.url);
        if (m.hist) { try { _pushMultiHist(m.url, m.label || m.url, 'web'); send({ type: 'history', list: _getMultiHist() }); } catch (e) {} }
        send({ type: 'open', id: 'web:' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), url: abs, origUrl: String(m.url), label: String(m.label || m.url || '网页').slice(0, 60) });
        return;
      }
      case 'histPush': _pushMultiHist(m.url, m.label, m.kind); send({ type: 'history', list: _getMultiHist() }); return;
      case 'favAdd': {
        if (m.board) {
          const bkey = 'board:' + m.board;
          const bfavs = _getMultiFavs();
          if (!bfavs.some((f) => f.key === bkey)) {
            bfavs.push({ key: bkey, label: m.label || ('板块·' + m.board), board: m.board, kind: 'board' });
            _setMultiFavs(bfavs); _toast('⭐ 已收藏 · ' + (m.label || m.board));
          }
          send({ type: 'favs', list: _getMultiFavs() });
          return;
        }
        const parts = String(m.id || '').split('|');
        const email = parts[0] || '';
        const tail = parts[1] || 'home';
        const devinId = (tail !== 'home' && tail.indexOf('page') !== 0) ? tail : '';
        if (!email) return;
        const key = email.toLowerCase() + '|' + (devinId || 'home');
        const favs = _getMultiFavs();
        if (!favs.some((f) => f.key === key)) {
          favs.push({ key, label: email.split('@')[0], email, devinId, accNo: 0, dollars: 0 });
          _setMultiFavs(favs); _toast('⭐ 已收藏 · ' + email.split('@')[0]);
        }
        send({ type: 'favs', list: _getMultiFavs() });
        return;
      }
      case 'favDel': {
        const favs = _getMultiFavs().filter((f) => f.key !== m.key);
        _setMultiFavs(favs); send({ type: 'favs', list: favs });
        return;
      }
      case 'favDelMany': {
        const set = new Set((m.keys || []).map(String));
        const favs = _getMultiFavs().filter((f) => !set.has(String(f.key)));
        _setMultiFavs(favs); send({ type: 'favs', list: favs });
        return;
      }
      case 'favClear': _setMultiFavs([]); send({ type: 'favs', list: [] }); return;
      case 'histDel': { const h = _delMultiHist(m.urls || []); send({ type: 'history', list: h }); return; }
      case 'histClear': _setMultiHist([]); send({ type: 'history', list: [] }); return;
      case 'migExport': {
        try { const b = _migBuildBundle(); send({ type: 'migBundle', json: JSON.stringify(b, null, 2), name: 'dao-migration-' + new Date().toISOString().slice(0, 10) + '.json' }); }
        catch (e) { send({ type: 'migDone', ok: false, error: String((e && e.message) || e) }); }
        return;
      }
      case 'migImport': {
        try {
          const r = await _migApplyBundle(m.data);
          send({ type: 'favs', list: _getMultiFavs() });
          send({ type: 'history', list: _getMultiHist() });
          send({ type: 'migDone', ok: true, summary: '账号+' + r.addedAcc + ' · 书签' + r.favs + ' · 历史' + r.history + ' · 标签' + r.tabs });
        } catch (e) { send({ type: 'migDone', ok: false, error: String((e && e.message) || e) }); }
        return;
      }
      case 'getBridge': {
        let data = null; try { data = await vscode.commands.executeCommand('dao.getBridgeState'); } catch (e) {}
        send({ type: 'bridgeState', data: data || null });
        return;
      }
      case 'bridgeAct': {
        try { await vscode.commands.executeCommand('dao.bridgeAction', { cmd: m.cmd }); } catch (e) {}
        let data = null; try { data = await vscode.commands.executeCommand('dao.getBridgeState'); } catch (e) {}
        send({ type: 'bridgeState', data: data || null });
        return;
      }
      case 'dlRecent': case 'dlExportMd': case 'dlZip':
        await _daoDownloadData(m, send); return;
      case 'shellBackups': {
        try {
          let root; try { root = vscode.workspace.getConfiguration('wam').get('devinCloudBackupDir'); } catch (e) {}
          const tree = devinCloud.listBackups(root || undefined);
          send({ type: 'shellBackupsData', tree });
        } catch (e) { send({ type: 'shellBackupsData', tree: { root: '', accounts: [] }, error: String((e && e.message) || e) }); }
        return;
      }
      case 'shellDownloads': {
        send({ type: 'shellDownloadsData', list: _listDaoDownloads() });
        return;
      }
      case 'shellDownloadDel': {
        _delDaoDownload(m.path);
        send({ type: 'shellDownloadsData', list: _listDaoDownloads() });
        return;
      }
      case 'shellOpenFile': {
        if (!m.path) return;
        try { await vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.file(m.path).toString()); }
        catch (e) { try { await vscode.env.openExternal(vscode.Uri.file(m.path)); } catch (e2) {} }
        return;
      }
      case 'shellRevealFile': {
        if (!m.path) return;
        try { await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(m.path)); } catch (e) {}
        return;
      }
      case 'cloudInit': {
        if (!_cloudProvider) { send({ type: 'toast', text: '六大板块面板未就绪' }); return; }
        // 按会话隔离: buildHtml 与其触发的宿主回推仅发给本 sid (道并行而不相悖)
        await _shellCloudRun(sid, async () => {
          let html = '';
          try { html = _cloudProvider.buildHtml(m.board) || ''; } catch (e) {}
          send({ type: 'cloudInitHtml', html, board: m.board || 'overview' });
        });
        return;
      }
      case 'cloudReady': _shellCloudRun(sid, async () => { try { _cloudProvider && _cloudProvider.refresh(); } catch (e) {} }); return;
      case 'cloudRelay': _shellCloudRun(sid, async () => { try { if (_cloudProvider) await _cloudProvider.handleMessage(m.msg); } catch (e) {} }); return;
      case 'filesDropped': {
        const uris = String(m.uris || '').split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
        const paths = uris.map((u) => { try { return u.startsWith('file:') ? vscode.Uri.parse(u).fsPath : u; } catch (e) { return u; } });
        const list = paths.length ? paths : (m.names || []);
        if (list.length) { try { await vscode.env.clipboard.writeText(list.join('\n')); } catch (e) {} _toast('📎 已捕获 ' + list.length + ' 个文件路径(已复制)'); }
        return;
      }
      case 'copyCred': {
        try {
          const email = String(m.id || '').split('|')[0] || '';
          const acc = ((_store && _store.accounts) || []).find((a) => String(a.email).toLowerCase() === email.toLowerCase());
          const text = email + (acc && acc.password ? ('\t' + acc.password) : '');
          if (email) send({ type: '__copy', text });
        } catch (e) {}
        return;
      }
      case 'toast': if (m.msg) _toast(m.msg); return;
      case 'closed': case 'closeAllAck': return;
      default: return;
    }
  } catch (e) { try { log('[shell] msg err: ' + (e && e.message)); } catch (x) {} }
}
// ════════════════════════════════════════════════════════════════════
// 归一 · 下载/备份悬浮窗(复刻手机端 APK daopan.html)宿主数据通道
//   dlRecent   → 跨全部已登录账号聚合近期对话(状态/账号号/更新时间)
//   dlExportMd → 单对话导出 MD(save=false 仅返回正文供查看; save=true 落盘+定位)
//   dlZip      → 单对话「全部文件」增量补全后打 ZIP 并在资源管理器定位
// reply(obj): 统一回推(VS Code webview 与 standalone shell 同形态)。
// ════════════════════════════════════════════════════════════════════
function _daoRecencyMs(s) {
  s = s || {};
  const t = s.updated_at || s.last_updated_at || s.last_message_at || s.last_event_at || s.last_activity_at || s.modified_at || s.created_at || 0;
  if (typeof t === "number") return t > 1e12 ? t : t * 1000;
  const p = Date.parse(t); return isNaN(p) ? 0 : p;
}
async function _daoPool(items, conc, fn) {
  let idx = 0; const n = items.length; conc = Math.max(1, Math.min(conc, n || 1));
  async function w() { while (idx < n) { const i = idx++; try { await fn(items[i]); } catch (e) {} } }
  const ws = []; for (let c = 0; c < conc; c++) ws.push(w()); await Promise.all(ws);
}
async function _daoDownloadData(m, reply) {
  const t = m && m.type;
  if (t === "dlRecent") {
    const accs = (_store && _store.accounts) || [];
    const noOf = (email) => { const i = accs.findIndex((a) => String(a.email).toLowerCase() === String(email).toLowerCase()); return i >= 0 ? i + 1 : "?"; };
    let emails = []; try { emails = devinCloud.cachedEmails() || []; } catch (e) {}
    const perAcc = Math.max(1, Math.min(20, Number(m.perAcc) || 12));
    // 流式增量(对齐手机 daopan.html): 每账号回来即合并去重排序回推一次(节流~250ms),
    //   末尾再回推一次 partial:false。前端先用缓存秒开, 收到增量持续刷新 → 不再等全量阻塞。
    const out = [];
    let doneN = 0, lastPaint = 0;
    const covered = Object.create(null);
    const emit = (partial) => {
      const sorted = out.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const seen = Object.create(null), ded = [];
      for (const it of sorted) { if (it.sid && seen[it.sid]) continue; if (it.sid) seen[it.sid] = 1; ded.push(it); }
      // covered = 本轮已真刷过的账号(含返回 0 对话者) → 前端据此只替换这些号的行, 其余保留缓存, 消除「先缩后涨」的跳伞。
      reply({ type: "dlRecentData", list: ded.slice(0, 80), accounts: emails.length, partial: !!partial, done: doneN, total: emails.length, covered: Object.keys(covered) });
    };
    if (!emails.length) { reply({ type: "dlRecentData", list: [], accounts: 0, partial: false, done: 0, total: 0, covered: [] }); return true; }
    // 同源·首屏即见最新: 先以对话追踪聚合(_dvStatusAgg)合成实时条目立即回推(covered 空 → 前端只并入不清缓存),
    //   打开即见正在运行/最新对话, 不等逐号 API 爬完(旧病灶: 首屏先显十几小时前的缓存旧对话)。
    try {
      const live = [];
      for (const [em, st] of _dvStatusAgg) {
        if (!st || !Array.isArray(st.items)) continue;
        for (const it of st.items) {
          const sid = String((it && it.id) || ""); if (!sid) continue;
          live.push({ email: em, accNo: noOf(em), sid, title: (it && it.title) || sid, status: (it && it.cls) || "", statusClass: (it && it.cls) || "", updatedAt: st.ts || Date.now(), live: true });
        }
      }
      if (live.length) reply({ type: "dlRecentData", list: live.slice(0, 80), accounts: emails.length, partial: true, done: 0, total: emails.length, covered: [] });
      // 追踪中的活跃账号优先爬取 → 最新对话的权威数据最先回来
      const hot = new Set();
      for (const [em, st] of _dvStatusAgg) { if (st && Array.isArray(st.items) && st.items.length) hot.add(String(em).toLowerCase()); }
      if (hot.size) emails = emails.slice().sort((a, b) => (hot.has(String(b).toLowerCase()) ? 1 : 0) - (hot.has(String(a).toLowerCase()) ? 1 : 0));
    } catch (e) {}
    await _daoPool(emails, 8, async (email) => {
      try {
        const auth = devinCloud.getCachedAuth(email);
        if (auth && auth.auth1) {
          const ls = await devinCloud.listSessions(auth, perAcc);
          if (ls && ls.ok) {
            (ls.sessions || []).forEach((s) => {
              const sid = s.devin_id || s.session_id || s.id; if (!sid) return;
              out.push({ email, accNo: noOf(email), sid, title: s.title || s.name || s.prompt || sid, status: s.status || s.activity_status || "", statusClass: devinCloud.classifySession(s), updatedAt: _daoRecencyMs(s) });
            });
          }
        }
      } catch (e) {}
      covered[String(email).toLowerCase()] = 1;
      doneN++;
      const now = Date.now();
      if (now - lastPaint > 250) { lastPaint = now; emit(true); }
    });
    emit(false);
    return true;
  }
  if (t === "dlExportMd") {
    const email = String(m.email || ""), sid = String(m.sid || "");
    try {
      const auth = await _resolveAuthForEmail(email);
      if (!auth || !auth.auth1) { reply({ type: "dlExportData", save: !!m.save, ok: false, sid, error: "账号未解锁(无 auth1) · 先在切号面板登录" }); return true; }
      const events = await devinCloud.getEventStream(auth, sid);
      let title = m.title || sid;
      try { const detail = await devinCloud.getSessionDetail(auth, sid); if (detail && (detail.title || detail.name)) title = detail.title || detail.name; } catch (e) {}
      const md = devinCloud.buildConversationMd(title, sid, events);
      if (m.save) {
        const dir = _dvFindOrMakeConvDir(email, sid, title);
        const outPath = path.join(dir, "对话.md");
        fs.writeFileSync(outPath, md, "utf8");
        try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outPath)); } catch (e) {}
        reply({ type: "dlExportData", save: true, ok: true, sid, name: path.basename(outPath), path: outPath });
      } else {
        reply({ type: "dlExportData", save: false, ok: true, sid, title, md });
      }
    } catch (e) { reply({ type: "dlExportData", save: !!m.save, ok: false, sid, error: String((e && e.message) || e) }); }
    return true;
  }
  if (t === "dlZip") {
    const email = String(m.email || ""), sid = String(m.sid || "");
    try {
      const auth = await _resolveAuthForEmail(email);
      if (!auth || !auth.auth1) { reply({ type: "dlZipDone", ok: false, sid, error: "账号未解锁(无 auth1)" }); return true; }
      const title = m.title || sid;
      const one = await devinCloud.backupOneConversation(auth, { devin_id: sid, title }, _dvAccountBackupDir(email), { incremental: false, turbo: true });
      if (one && one.zip) { try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(one.zip)); } catch (e) {} reply({ type: "dlZipDone", ok: true, sid, name: path.basename(one.zip), path: one.zip }); }
      else reply({ type: "dlZipDone", ok: false, sid, error: "打包失败" });
    } catch (e) { reply({ type: "dlZipDone", ok: false, sid, error: String((e && e.message) || e) }); }
    return true;
  }
  return false;
}
function _wireMultiPanel(panel) {
  panel.webview.onDidReceiveMessage(async (m) => {
    if (!m) return;
    try {
      if (m.type === "ready") {
        _multiReady = true;
        while (_multiQueue.length) { try { panel.webview.postMessage(_multiQueue.shift()); } catch (e) {} }
        try { panel.webview.postMessage({ type: "favs", list: _getMultiFavs() }); } catch (e) {}
        try { panel.webview.postMessage({ type: "history", list: _getMultiHist() }); } catch (e) {}
        try { panel.webview.postMessage({ type: "userscripts", list: _getUserScripts() }); } catch (e) {}
        return;
      }
      // 归一 · 用户脚本 (与公网 /shell 一致): IDE webview 路径补齐 us* 处理, 否则同一套前端的脚本面板在 IDE 内形同虚设。
      if (m.type === "usList") { try { panel.webview.postMessage({ type: "userscripts", list: _getUserScripts() }); } catch (e) {} return; }
      if (m.type === "usSave") {
        const list = _getUserScripts();
        const e = m.entry || {};
        if (e.id) { const i = list.findIndex((x) => x.id === e.id); if (i >= 0) list[i] = Object.assign({}, list[i], e); else list.push(Object.assign({ id: _usId(), enabled: true }, e)); }
        else list.push(Object.assign({ id: _usId(), enabled: true }, e));
        _setUserScripts(list);
        try { panel.webview.postMessage({ type: "userscripts", list: _getUserScripts() }); } catch (e2) {}
        _toast("✓ 用户脚本已保存"); return;
      }
      if (m.type === "usToggle") {
        const list = _getUserScripts(); const i = list.findIndex((x) => x.id === m.id);
        if (i >= 0) { list[i].enabled = list[i].enabled === false; _setUserScripts(list); }
        try { panel.webview.postMessage({ type: "userscripts", list: _getUserScripts() }); } catch (e) {} return;
      }
      if (m.type === "usDelete") { _setUserScripts(_getUserScripts().filter((x) => x.id !== m.id)); try { panel.webview.postMessage({ type: "userscripts", list: _getUserScripts() }); } catch (e) {} return; }
      if (m.type === "usImport") {
        try { const r = _usImportExtension(m.path); try { panel.webview.postMessage({ type: "userscripts", list: r.list }); } catch (e2) {} _toast("✓ 已导入扩展 " + r.name + " (" + r.count + " 脚本)"); }
        catch (e) { _toast("导入失败: " + ((e && e.message) || e)); try { panel.webview.postMessage({ type: "usError", error: (e && e.message) || String(e) }); } catch (e2) {} }
        return;
      }
      // 归一 · 标签状态轮询(与公网 /shell 同一宿主入口): 前端 5s tick 上报打开中的账号标签
      //   (email + 注入桥回填的 devinId) → listRunningSessions 判六态 → tabUpdate 上灯/回填对话名/额度。
      if (m.type === "shellStatus") { await _handleShellStatus(m, (x) => { try { panel.webview.postMessage(x); } catch (e) {} }); return; }
      if (m.type === "closed") { _multiTabs.delete(m.id); _saveMultiTabs(); return; }
      if (m.type === "closeAllAck") { _multiTabs.clear(); _saveMultiTabs(); return; }
      if (m.type === "copyCred") {
        const t = _multiTabs.get(m.id); if (!t) return;
        let pw = "";
        try {
          const acc = ((_store && _store.accounts) || []).find((a) => String(a.email).toLowerCase() === String(t.email).toLowerCase());
          if (acc) pw = acc.password || "";
        } catch (e) {}
        const text = t.email + (pw ? "\t" + pw : "");
        try { await vscode.env.clipboard.writeText(text); _toast("📋 已复制账号" + (pw ? "+密码" : "") + " · " + String(t.email).split("@")[0]); } catch (e) {}
        return;
      }
      // 备份库账号行「双击/📋 复制账号+密码」(对齐手机版): 按 email 直接查账号池, 不依赖已开标签。
      if (m.type === "copyCredEmail" && m.email) {
        let pw = "";
        try {
          const acc = ((_store && _store.accounts) || []).find((a) => String(a.email).toLowerCase() === String(m.email).toLowerCase());
          if (acc) pw = acc.password || "";
        } catch (e) {}
        const text = String(m.email) + (pw ? "\t" + pw : "");
        try { await vscode.env.clipboard.writeText(text); _toast("📋 已复制账号" + (pw ? "+密码" : "(密码未在账号池)") + " · " + String(m.email).split("@")[0]); } catch (e) {}
        return;
      }
      if (m.type === "clip" && m.text) {
        try { await vscode.env.clipboard.writeText(String(m.text)); _toast("📋 已复制链接"); } catch (e) {}
        return;
      }
      if (m.type === "openExternal" && m.url) {
        if (m.hist) { try { _pushMultiHist(m.url, m.label || m.url, "web"); panel.webview.postMessage({ type: "history", list: _getMultiHist() }); } catch (e) {} }
        try { await vscode.env.openExternal(vscode.Uri.parse(m.url)); } catch (e) {}
        return;
      }
      if (m.type === "trReroute" && m.url) {
        // 翻译跨源自愈(webview): Devin 站 → 主口同源反代绝对地址; 其余 http(s) → /__web 绝对地址。
        const ru = String(m.url || "");
        let src = "";
        try {
          const rel = await _shellDevinSameOrigin(ru);
          let base = "";
          try { if (_cloudProvider && typeof _cloudProvider.webUrl === "function") { const probe = _cloudProvider.webUrl("https://x") || ""; const mm = probe.match(/^https?:\/\/[^/]+/i); if (mm) base = mm[0]; } } catch (e) {}
          if (rel && base) src = base + rel;
          else if (/^https?:\/\//i.test(ru) && !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(ru)) { try { src = (_cloudProvider && _cloudProvider.webUrl(ru)) || ""; } catch (e) {} }
        } catch (e) {}
        try { panel.webview.postMessage({ type: "trRerouteRes", ok: !!src, src }); } catch (e) {}
        return;
      }
      if (m.type === "translate") {
        // 整页翻译(webview 泵): 与 /shell 泵同源同法 — 宿主做 HTTP → Edge 免费引擎。
        //   (病灶: 此泵此前无 translate 分支 → IDE 内点翻译恒 20s 超时静默, 翻译"完全不通"之根因。)
        const reqId = String(m.reqId || ""); if (!reqId) return;
        const texts = Array.isArray(m.texts) ? m.texts.slice(0, 128).map((x) => String(x == null ? "" : x)) : [];
        let arr = null;
        try { arr = await _edgeTranslate(texts, String(m.to || "zh-Hans")); } catch (e) { arr = null; }
        try { panel.webview.postMessage({ type: "translated", reqId, arr: arr || [] }); } catch (e) {}
        return;
      }
      if (m.type === "openWebTab" && m.url) {
        // 站内新标签开任意网页/搜索 → 经本地 HTTP 代理 /__web 直出(剥 XFO·当 iframe 加载), 不再弹外部系统浏览器。
        let abs = "";
        try { if (_cloudProvider && typeof _cloudProvider.webUrl === "function") abs = _cloudProvider.webUrl(m.url) || ""; } catch (e) {}
        if (!abs) { try { await vscode.env.openExternal(vscode.Uri.parse(m.url)); } catch (e) {} return; }
        if (m.hist) { try { _pushMultiHist(m.url, m.label || m.url, "web"); panel.webview.postMessage({ type: "history", list: _getMultiHist() }); } catch (e) {} }
        try { panel.webview.postMessage({ type: "open", id: "web:" + Date.now().toString(36), url: abs, label: (m.label || m.url) }); } catch (e) {}
        return;
      }
      if (m.type === "dlRecent" || m.type === "dlExportMd" || m.type === "dlZip") {
        await _daoDownloadData(m, (x) => { try { panel.webview.postMessage(x); } catch (e) {} });
        return;
      }
      // 归一 · ⬇下载 / 📁备份库 悬浮窗数据源: 复用内联备份引擎 devinCloud.listBackups(同 dao-vsix 六大板块备份板块同源)。
      if (m.type === "shellBackups") {
        try {
          let root; try { root = vscode.workspace.getConfiguration("wam").get("devinCloudBackupDir"); } catch (e) {}
          const tree = devinCloud.listBackups(root || undefined);
          panel.webview.postMessage({ type: "shellBackupsData", tree });
        } catch (e) { try { panel.webview.postMessage({ type: "shellBackupsData", tree: { root: "", accounts: [] }, error: String((e && e.message) || e) }); } catch (e2) {} }
        return;
      }
      if (m.type === "shellDownloads") {
        try { panel.webview.postMessage({ type: "shellDownloadsData", list: _listDaoDownloads() }); } catch (e) {}
        return;
      }
      if (m.type === "shellDownloadDel") {
        _delDaoDownload(m.path);
        try { panel.webview.postMessage({ type: "shellDownloadsData", list: _listDaoDownloads() }); } catch (e) {}
        return;
      }
      if (m.type === "shellOpenFile" && m.path) {
        try { await vscode.commands.executeCommand("simpleBrowser.show", vscode.Uri.file(m.path).toString()); }
        catch (e) { try { await vscode.env.openExternal(vscode.Uri.file(m.path)); } catch (e2) {} }
        return;
      }
      if (m.type === "shellRevealFile" && m.path) {
        try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(m.path)); } catch (e) {}
        return;
      }
      if (m.type === "favAdd") {
        if (m.board) {
          const bkey = "board:" + m.board;
          const bfavs = _getMultiFavs();
          if (!bfavs.some((f) => f.key === bkey)) {
            bfavs.push({ key: bkey, label: m.label || ("板块·" + m.board), board: m.board, kind: "board" });
            _setMultiFavs(bfavs); _toast("⭐ 已收藏 · " + (m.label || m.board));
          }
          try { panel.webview.postMessage({ type: "favs", list: _getMultiFavs() }); } catch (e) {}
          return;
        }
        const t = _multiTabs.get(m.id); if (!t) return;
        const favs = _getMultiFavs();
        const key = String(t.email).toLowerCase() + "|" + (t.devinId || "home");
        if (!favs.some((f) => f.key === key)) {
          favs.push({ key: key, label: t.label, email: t.email, devinId: t.devinId || "", accNo: t.accNo, dollars: t.dollars });
          _setMultiFavs(favs); _toast("⭐ 已收藏 · " + t.label);
        }
        try { panel.webview.postMessage({ type: "favs", list: _getMultiFavs() }); } catch (e) {}
        return;
      }
      if (m.type === "favDel") {
        const favs = _getMultiFavs().filter((f) => f.key !== m.key);
        _setMultiFavs(favs);
        try { panel.webview.postMessage({ type: "favs", list: favs }); } catch (e) {}
        return;
      }
      if (m.type === "favDelMany") {
        const set = new Set((m.keys || []).map(String));
        const favs = _getMultiFavs().filter((f) => !set.has(String(f.key)));
        _setMultiFavs(favs);
        try { panel.webview.postMessage({ type: "favs", list: favs }); } catch (e) {}
        return;
      }
      if (m.type === "favClear") { _setMultiFavs([]); try { panel.webview.postMessage({ type: "favs", list: [] }); } catch (e) {} return; }
      if (m.type === "histDel") { const h = _delMultiHist(m.urls || []); try { panel.webview.postMessage({ type: "history", list: h }); } catch (e) {} return; }
      if (m.type === "histClear") { _setMultiHist([]); try { panel.webview.postMessage({ type: "history", list: [] }); } catch (e) {} return; }
      if (m.type === "migExport") {
        try { const b = _migBuildBundle(); panel.webview.postMessage({ type: "migBundle", json: JSON.stringify(b, null, 2), name: "dao-migration-" + new Date().toISOString().slice(0, 10) + ".json" }); }
        catch (e) { try { panel.webview.postMessage({ type: "migDone", ok: false, error: String((e && e.message) || e) }); } catch (e2) {} }
        return;
      }
      if (m.type === "migImport") {
        try {
          const r = await _migApplyBundle(m.data);
          panel.webview.postMessage({ type: "favs", list: _getMultiFavs() });
          panel.webview.postMessage({ type: "history", list: _getMultiHist() });
          panel.webview.postMessage({ type: "migDone", ok: true, summary: "账号+" + r.addedAcc + " · 书签" + r.favs + " · 历史" + r.history + " · 标签" + r.tabs });
        } catch (e) { try { panel.webview.postMessage({ type: "migDone", ok: false, error: String((e && e.message) || e) }); } catch (e2) {} }
        return;
      }
      if (m.type === "shellSaveTabs") { try { if (_ctx && _ctx.globalState) _ctx.globalState.update("dao.shellTabs", Array.isArray(m.tabs) ? m.tabs.slice(0, 40) : []); } catch (e) {} return; }
      if (m.type === "reopen") {
        try { await openMultiInstance({ email: m.email, devinId: m.devinId, path: m.path }); } catch (e) {}
        return;
      }
      if (m.type === "histPush") { _pushMultiHist(m.url, m.label, m.kind); try { panel.webview.postMessage({ type: "history", list: _getMultiHist() }); } catch (e) {} return; }
      if (m.type === "newDevinTab") {
        // 新建标签(＋) → 登录官网 (而非跳进已登录账号): IDE 内经 Simple Browser 打开官网登录页 (绕过 X-Frame-Options)。
        if (m.clean) {
          try { await vscode.commands.executeCommand("simpleBrowser.show", "https://app.devin.ai/"); }
          catch (e) { try { await vscode.env.openExternal(vscode.Uri.parse("https://app.devin.ai/")); } catch (e2) {} }
          _toast("已打开官网登录页 · 登录后可在切号面板入号池");
          return;
        }
        const accs = ((_store && _store.accounts) || []);
        const cand = [];
        const pushE = (e) => { const k = String(e || "").trim().toLowerCase(); if (k && cand.indexOf(k) < 0) cand.push(k); };
        pushE(m.email);
        pushE(_store && _store.activeEmail);
        for (const a of accs) { try { const au = devinCloud.getCachedAuth(a.email); if (au && au.auth1) pushE(a.email); } catch (e) {} }
        for (const a of accs) { if (a && a.password) pushE(a.email); }
        for (const a of accs) pushE(a.email);
        if (!cand.length) { _toast("无可用账号 · 请先在账号库添加"); return; }
        let ok = false;
        for (const e of cand) { try { const r = await openMultiInstance({ email: e, fresh: true }); if (r && r.ok) { ok = true; break; } } catch (er) {} }
        if (!ok) _toast("账号反代未就绪 · 请先在切号面板登录一个账号");
        return;
      }
      if (m.type === "openCloudPage") {
        const email = (_store && _store.activeEmail) || ((_store && _store.accounts && _store.accounts[0] && _store.accounts[0].email) || "");
        if (email) { try { await openMultiInstance({ email: email, path: m.path, label: m.label }); } catch (e) {} }
        else _toast("无可用账号 · 请先在账号库添加");
        return;
      }
      if (m.type === "getAccounts") {
        const list = (((_store && _store.accounts) || [])).map((a, i) => {
          let dollars = 0;
          try { const h = _store && _store.getHealth ? _store.getHealth(a.email) : null; if (h && h.overageDollars > 0) dollars = Math.round(h.overageDollars); } catch (e) {}
          return { accNo: i + 1, email: a.email, name: a.name || String(a.email || "").split("@")[0], dollars: dollars };
        });
        try { panel.webview.postMessage({ type: "accounts", list: list }); } catch (e) {}
        return;
      }
      if (m.type === "switchOpen") {
        if (m.email) { try { await openMultiInstance({ email: m.email }); } catch (e) {} }
        return;
      }
      if (m.type === "getBridge") {
        let data = null;
        try { data = await vscode.commands.executeCommand("dao.getBridgeState"); } catch (e) {}
        try { panel.webview.postMessage({ type: "bridgeState", data: data || null }); } catch (e) {}
        return;
      }
      if (m.type === "bridgeAct") {
        try { await vscode.commands.executeCommand("dao.bridgeAction", { cmd: m.cmd }); } catch (e) {}
        let data = null;
        try { data = await vscode.commands.executeCommand("dao.getBridgeState"); } catch (e) {}
        try { panel.webview.postMessage({ type: "bridgeState", data: data || null }); } catch (e) {}
        return;
      }
      if (m.type === "revealPage") {
        try { await vscode.commands.executeCommand("dao.openCloudPanel"); } catch (e) {}
        if (m.page === "bridge") _toast("公网穿透在 Devin Cloud 面板内 · 已打开面板");
        return;
      }
      if (m.type === "filesDropped") {
        const uris = String(m.uris || "").split(/[\r\n]+/).map((s) => s.trim()).filter(Boolean);
        const paths = uris.map((u) => { try { return u.startsWith("file:") ? vscode.Uri.parse(u).fsPath : u; } catch (e) { return u; } });
        const list = paths.length ? paths : (m.names || []);
        if (list.length) {
          try { await vscode.env.clipboard.writeText(list.join("\n")); } catch (e) {}
          _toast("📎 已捕获 " + list.length + " 个文件路径(已复制) · 受跨域限制可在对话内粘贴 · " + (list[0] || "").split(/[\\/]/).pop());
        }
        return;
      }
      // 归一 · 六大板块子网页: 外壳请求挂载全功能面板 HTML (blob-iframe + 中继)
      if (m.type === "cloudInit") {
        if (!_cloudProvider) { _toast("六大板块面板未就绪"); return; }
        try { _cloudProvider.setHostPost((mm) => { try { panel.webview.postMessage({ type: "cloudHost", msg: mm }); } catch (e) {} }); } catch (e) {}
        // webview 框架层封禁 blob: 子帧 → 优先经本地 HTTP(127.0.0.1) 直出板块当 iframe 加载; 无 URL 时回退 blob。
        let url = ""; try { if (typeof _cloudProvider.boardUrl === "function") url = _cloudProvider.boardUrl(m.board) || ""; } catch (e) {}
        let html = ""; if (!url) { try { html = _cloudProvider.buildHtml(m.board) || ""; } catch (e) {} }
        try { panel.webview.postMessage({ type: "cloudInitHtml", html: html, url: url, board: m.board || "overview" }); } catch (e) {}
        return;
      }
      // 子网页 iframe 载毕 → 推送初始数据 (init/auth/bridge…)
      if (m.type === "cloudReady") { try { _cloudProvider && _cloudProvider.refresh(); } catch (e) {} return; }
      // 子网页 → 扩展宿主: 中继全功能面板的命令到 handleMiddlePanelMessage
      if (m.type === "cloudRelay") { try { _cloudProvider && _cloudProvider.handleMessage(m.msg); } catch (e) {} return; }
      if (m.type === "toast" && m.msg) { _toast(m.msg); return; }
    } catch (e) { try { log("[multi] msg err: " + (e && e.message)); } catch (x) {} }
  });
  panel.onDidDispose(() => { _multiPanel = null; _multiReady = false; _multiQueue.length = 0; if (_multiStatusTimer) { clearInterval(_multiStatusTimer); _multiStatusTimer = null; } try { _cloudProvider && _cloudProvider.setHostPost(null); } catch (e) {} });
  _multiPanel = panel;
}
function _ensureMultiPanel() {
  if (_multiPanel) return _multiPanel;
  _multiReady = false; _multiQueue.length = 0;
  const panel = vscode.window.createWebviewPanel(
    'daoMultiInstance', '\uD83C\uDF10 多实例 · Devin', vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  panel.webview.html = _multiShellHtml();
  _wireMultiPanel(panel);
  if (!_multiStatusTimer) _multiStatusTimer = setInterval(() => { _multiTabStatusTick().catch(() => {}); }, 8000); // 20s→8s · 对齐手机端状态/额度刷新手感
  return panel;
}
// 归一 · 标签状态轮询宿主端(公网 /shell 与 IDE 多实例 webview 同一入口·对照手机 APK sessStatus 六态):
//   每账号一次 listRunningSessions → 命中: running/awaiting/blocked(额度类经账号实时额度对账 →
//   真无余量才 exhausted, 有余量归 finished 休眠·复刻手机 quotaLive 防误标); 未命中: finished。
//   并回填对话名(非活跃对话经标题缓存兜底) + 实时额度。
async function _handleShellStatus(m, send) {
  const tabsIn = Array.isArray(m.tabs) ? m.tabs.slice(0, 60) : [];
  if (!tabsIn.length) return;
  const byEmail = new Map();
  for (const t of tabsIn) { const e = String((t && t.email) || '').toLowerCase(); if (!e || !t.id) continue; if (!byEmail.has(e)) byEmail.set(e, []); byEmail.get(e).push(t); }
  const QRE = /out_of_quota|usage_limit|insufficient|overage|exceeded|quota|depleted|allowance/i;
  for (const [email, tl] of byEmail) {
    try {
      let auth = devinCloud.getCachedAuth(email);
      // auth 未缓存(如 IDE 重启后还原的标签) → 节流自动登录取号(每号 10min 一试·不阻塞其他号),
      //   否则该号标签永无状态灯/对话名(旧病灶: 直接 continue 即静默死区)。
      if (!auth || !auth.auth1) auth = await _shellEnsureAuth(email);
      if (!auth || !auth.auth1) continue;
      let act = [];
      try { act = await devinCloud.listRunningSessions(auth); } catch (e) {}
      const amap = new Map();
      for (const s of (act || [])) { const id2 = String(s.devinId || '').replace(/^devin-/, ''); if (id2) amap.set(id2, s); }
      let h = null, dollars = null;
      try { await _refreshHealthForTick(email); } catch (e) {}
      try { h = _store && _store.getHealth ? _store.getHealth(email) : null; if (h && h.overageDollars > 0) dollars = Math.round(h.overageDollars); } catch (e) {}
      for (const t of tl) {
        const sid = String(t.devinId || '').replace(/^devin-/, '');
        // 账号首页标签(无具体对话·对齐手机 APK): 以该号最新活跃会话回填对话名+状态灯; 无活跃 → idle 灰。
        const hit = sid ? amap.get(sid) : ((act && act.length) ? act[0] : null);
        let cls = hit ? (hit.statusClass || 'running') : (sid ? 'finished' : 'idle');
        try {
          if (hit && cls === 'blocked' && QRE.test(JSON.stringify(hit.latest_status_contents || '') + ' ' + String(hit.status || ''))) {
            const live = !!(h && (((typeof h.dPct === 'number') && h.dPct > 0) || ((typeof h.wPct === 'number') && h.wPct > 0) || ((typeof h.overageDollars === 'number') && h.overageDollars > 0)));
            cls = live ? 'finished' : 'exhausted';
          }
        } catch (e) {}
        const upd = { type: 'tabUpdate', id: t.id, statusClass: cls };
        let title = hit && String(hit.title || '').trim();
        // 非活跃对话(已结束/休眠)不在 listRunningSessions 内 → 从对话标题缓存回填, 页签仍显对话名。
        if ((!title || title === '(未命名)') && sid) { try { title = String(_convTitleMap[sid] || _convTitleMap['devin-' + sid] || '').trim(); } catch (e) {} }
        if (title && title !== '(未命名)') upd.label = title;
        if (dollars != null) upd.dollars = dollars;
        send(upd);
      }
    } catch (e) {}
  }
}
// /shell 状态轮询取号: auth 未缓存时经 _resolveAuthForEmail 自动登录, 但每号 10min 内只试一次
//   (负缓存·防坏密码每 5s tick 反复打登录接口), in-flight 去重防并发重登。
const _shellAuthNeg = new Map(); // emailLower → lastFailTs
const _shellAuthInflight = new Map(); // emailLower → Promise
async function _shellEnsureAuth(email) {
  const key = String(email || '').toLowerCase();
  if (!key) return null;
  const neg = _shellAuthNeg.get(key);
  if (neg && Date.now() - neg < 10 * 60 * 1000) return null;
  if (_shellAuthInflight.has(key)) return _shellAuthInflight.get(key);
  const p = (async () => {
    try {
      const auth = await _resolveAuthForEmail(key);
      if (auth && auth.auth1) { _shellAuthNeg.delete(key); return auth; }
      _shellAuthNeg.set(key, Date.now());
      return null;
    } catch (e) { _shellAuthNeg.set(key, Date.now()); return null; }
    finally { _shellAuthInflight.delete(key); }
  })();
  _shellAuthInflight.set(key, p);
  return p;
}
async function _resolveAuthForEmail(email, password) {
  let auth = devinCloud.getCachedAuth(email);
  if (!auth || !auth.auth1) {
    let pw = password;
    if (!pw) {
      try {
        const acc = ((_store && _store.accounts) || []).find(
          (a) => String(a.email).toLowerCase() === String(email).toLowerCase(),
        );
        if (acc) pw = acc.password;
      } catch (e) {}
    }
    if (pw) { const r = await devinCloud.getAuth(email, pw); if (r && r.ok) auth = r; }
  }
  return auth;
}
// 归一 · 状态字符串 → 状态点类名(宿主侧·与前端 _dotCls 同构): 供首开标签即上色。
function _classStr(s){s=String(s==null?'':s).toLowerCase().trim();if(!s)return '';
  if(/await|waiting|needs_input|user_input|ask_user|action_required/.test(s))return 'awaiting';
  if(/out_of_quota|usage_limit|insufficient|overage|credit|billing|exceeded|quota|error|failed|stuck|crash|blocked/.test(s))return 'blocked';
  if(/finished|completed|done|stopped|suspend|expired|exited|archived|deleted/.test(s))return 'finished';
  if(/running|working|in_progress|streaming|active|started|resumed|busy|thinking|executing|coding|planning|testing/.test(s))return 'running';
  return 'running';}
// 归一 · 状态轮询中的额度保鲜(限频·仅 session-cache 快路·零 devinLogin·零限速风险):
//   getHealth 只读缓存 → 标签 $ 额度可能长期陈旧; 此处每账号限频(默 300s)经 verifyOneAccount
//   缓存快路真拉一次 planStatus 回写 setHealth, 让状态轮询回填的额度真正保鲜。
const _healthTickAt = new Map();
async function _refreshHealthForTick(email) {
  try {
    const k = String(email || '').toLowerCase(); if (!k) return;
    const iv = Math.max(60, +_cfg('statusHealthRefreshSec', 300) || 300) * 1000;
    const last = _healthTickAt.get(k) || 0; if (Date.now() - last < iv) return;
    _healthTickAt.set(k, Date.now());
    const a = (_store.accounts || []).find((x) => String(x.email || '').toLowerCase() === k); if (!a) return;
    if (!_getCachedSession(a.email)) return; // 无缓存会话 → 不走全路(防批量 devinLogin 触限速)
    const vr = await verifyOneAccount(a);
    if (vr && vr.ok && vr.q) _store.setHealth(a.email, vr.q);
  } catch (e) {}
}
// 归一 · 多实例标签状态实时轮询(对齐手机端·仅打开中的少量标签·每账号一次 listSessions):
//   命中活跃会话 → running/awaiting/blocked + 回填对话名; 未命中 → finished。并回填实时额度。
let _multiStatusTimer = null;
async function _multiTabStatusTick() {
  if (!_multiPanel || !_multiReady) return;
  const list = Array.from(_multiTabs.values()).filter((t) => t && t.devinId);
  if (!list.length) return;
  const byEmail = new Map();
  for (const t of list) { const e = String(t.email || '').toLowerCase(); if (!e) continue; if (!byEmail.has(e)) byEmail.set(e, []); byEmail.get(e).push(t); }
  for (const [email, tabsForEmail] of byEmail) {
    try {
      const auth = devinCloud.getCachedAuth(email);
      if (!auth || !auth.auth1) continue;
      let active = [];
      try { active = await devinCloud.listRunningSessions(auth); } catch (e) {}
      const amap = new Map();
      for (const s of (active || [])) { const id = String(s.devinId || '').replace(/^devin-/, ''); if (id) amap.set(id, s); }
      let dollars = null;
      try { await _refreshHealthForTick(email); } catch (e) {}
      try { const h = _store && _store.getHealth ? _store.getHealth(email) : null; if (h && h.overageDollars > 0) dollars = Math.round(h.overageDollars); } catch (e) {}
      for (const t of tabsForEmail) {
        const sid = String(t.devinId || '').replace(/^devin-/, '');
        const hit = amap.get(sid);
        const cls = hit ? (hit.statusClass || 'running') : 'finished';
        const upd = { type: 'tabUpdate', id: t.id, statusClass: cls };
        const title = hit && String(hit.title || '').trim();
        if (title && title !== '(未命名)' && title !== t.title) { t.title = title; t.label = title; upd.label = title; }
        if (dollars != null && dollars !== t.dollars) { t.dollars = dollars; upd.dollars = dollars; }
        t.status = cls; t.statusClass = cls;
        _postMulti(upd);
      }
    } catch (e) {}
  }
  try { _saveMultiTabs(); } catch (e) {}
}
// 归一入口: 在统一多实例面板里为某账号(可带具体对话)开/聚焦一个标签。
async function openMultiInstance(opts) {
  opts = opts || {};
  const email = String(opts.email || '').trim();
  _routeDbg("openMultiInstance ENTER email=" + email + " devinId=" + (opts.devinId || "") + " path=" + (opts.path || ""));
  if (!email) { _routeDbg("openMultiInstance ABORT no-email"); return { ok: false, error: 'no-email' }; }
  const sid = String(opts.devinId || '').trim().replace(/^devin-/, '');
  const auth = await _resolveAuthForEmail(email, opts.password);
  if (!auth || !auth.auth1) { _routeDbg("openMultiInstance ABORT no-auth1 email=" + email); return { ok: false, error: 'no-auth1' }; }
  const pr = await devinProxy.ensureProxyForAccount(
    email, { auth1: auth.auth1, userId: auth.userId, orgId: auth.orgId, orgName: auth.orgName }, log,
  );
  if (!pr.ok) { _routeDbg("openMultiInstance ABORT proxy-fail email=" + email + " err=" + (pr.error || "")); return { ok: false, error: pr.error || 'proxy-fail' }; }
  const portBase = pr.url || ('http://localhost:' + pr.port + '/');
  const base = String(portBase).replace(/\/+$/, '');
  // 归一 · Devin Cloud 板块即页面: opts.path(/sessions、/knowledge、/settings/secrets ...) → 经该账号反代加载真实网页(会话态登录·可内嵌)
  const pageRaw = String(opts.path || '').trim();
  const pagePath = pageRaw ? ('/' + pageRaw.replace(/^\/+/, '')) : '';
  const fresh = !!opts.fresh && !pagePath && !sid;
  const url = pagePath ? (base + pagePath) : (sid ? (base + '/sessions/' + encodeURIComponent(sid)) : (base + '/'));
  const short = email.split('@')[0];
  const id = email.toLowerCase() + '|' + (pagePath ? ('page' + pagePath) : (sid || (fresh ? ('new' + Date.now()) : 'home')));
  // 富标签 (对齐手机版): #账号编号 + 名称 + $额度 + 对话状态点。
  let accNo = 0, dollars = 0;
  try {
    const idx = ((_store && _store.accounts) || []).findIndex(
      (a) => String(a.email).toLowerCase() === email.toLowerCase(),
    );
    if (idx >= 0) accNo = idx + 1;
    const h = _store && _store.getHealth ? _store.getHealth(email) : null;
    if (h && h.overageDollars > 0) dollars = Math.round(h.overageDollars);
  } catch (e) {}
  const title = String(opts.title || '').trim();
  const pageLabel = String(opts.label || '').trim();
  const label = title || (short + (pagePath ? (' · ' + (pageLabel || pagePath)) : (sid ? (' · ' + sid.slice(0, 8)) : (fresh ? ' · 新对话' : ''))));
  const status = String(opts.status || '').trim();
  const statusClass = String(opts.statusClass || '').trim() || _classStr(status);
  const meta = { id, label, url, email, devinId: sid, accNo, dollars, title, status, statusClass, path: pagePath, pageLabel };
  _multiTabs.set(id, meta);
  _saveMultiTabs();
  _ensureMultiPanel();
  try { _multiPanel.reveal(vscode.ViewColumn.Active); } catch (e) {}
  _postMulti({ type: 'open', id, label, url, accNo, dollars, status, statusClass, email, devinId: sid });
  _routeDbg("openMultiInstance OK email=" + email + " url=" + url + " panel=" + (_multiPanel ? "yes" : "no"));
  return { ok: true };
}
// 归一 · 9921 综合外壳入口: 仅确保/聚焦面板, 不强开账号 Devin 对话框; 冷启动落「六合板块主页」(home)。
//   已保存标签由序列化器 _resumePersistedTabs 还原(状态保留) → 二者不冲突。
async function openShellHome(board) {
  try {
    _ensureMultiPanel();
    _postMulti({ type: "gotoBoard", board: board || "home" });
    try { _multiPanel.reveal(vscode.ViewColumn.Active); } catch (e) {}
    return { ok: true };
  } catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
}
// v4.16.0 · 归一 · 单账号「路由官网→IDE」实现抽出为可复用函数 (供单点 routeToIde + 多选批量 routeToIdeBatch 共用)。
async function _routeAccountToIde(i) {
  if (i < 0 || i >= _store.accounts.length) return;
  const a = _store.accounts[i];
  _toast("⏳ 注入登录态·路由官网→IDE · " + a.email.split("@")[0]);
  try {
    const r = await openMultiInstance({ email: a.email, password: a.password });
    if (r.ok) {
      _toast(
        (r.reused ? "🖥 已聚焦该号标签 · " : "🖥 已注入登录态·IDE标签已开 · ") +
          a.email.split("@")[0],
      );
      return;
    }
    log("[routeToIde] 自足反代失败(" + (r.error || "") + "), 回退 dao/simpleBrowser");
  } catch (e) {
    log("[routeToIde] 自足反代异常: " + (e && e.message));
  }
  try {
    if (!(_switching && Date.now() - _switchingStartTime < 10000)) {
      try { await loginAccount(_store, i); } catch {}
    }
    // 登录取号后 auth1 已入缓存 → 重试自足反代(命中缓存即秒开·仍留在 IDE 内)。
    try {
      const r2 = await openMultiInstance({ email: a.email, password: a.password });
      if (r2 && r2.ok) { _toast("🖥 已注入登录态·IDE标签已开 · " + a.email.split("@")[0]); return; }
    } catch (e) {}
    try {
      await vscode.commands.executeCommand("dao.routeOfficialForAccount", { email: a.email, mode: "ide" });
      _toast("🖥 已路由官网→IDE(兜底) · " + a.email.split("@")[0]);
    } catch (e) {
      // 「路由官网→IDE」永不跳系统浏览器: 未注入的外部官网页毫无意义(掉登录), 只会造成
      // 「点 IDE 却弹出外面」的错乱。打不开就明说, 让用户重试或改用系统浏览器按钮。
      _toast("✗ IDE 内路由失败(该号登录未取到) · 请重试或改用「系统浏览器」按钮 · " + a.email.split("@")[0]);
    }
  } catch (e) {
    _toast("✗ 路由失败: " + (e && e.message));
  }
}
// v4.16.0 · 单账号「系统浏览器多实例」实现抽出 (供单点 openSysBrowser + 多选批量 openSysBrowserBatch 共用)。
async function _openAccountSysBrowser(i) {
  if (i < 0 || i >= _store.accounts.length) return;
  const a = _store.accounts[i];
  const who = a.email.split("@")[0];
  _toast("⏳ 系统浏览器启动中 · " + who);
  try {
    let auth = devinCloud.getCachedAuth(a.email);
    if (!auth && a.password) {
      const r = await devinCloud.getAuth(a.email, a.password);
      if (r && r.ok) auth = r;
    }
    const res = await devinWeb.launchAccountBrowser({
      email: a.email, auth1: auth && auth.auth1, userId: auth && auth.userId,
      orgId: auth && auth.orgId, orgName: auth && auth.orgName, log,
    });
    if (res.ok) {
      _toast(
        res.injected
          ? "🌐 独立隔离实例已开并自动登录 · " + who
          : "🌐 独立隔离实例已开 · " + who + " (首次手动登录一次后自动续登)",
      );
      return;
    }
    if (res.error && res.error !== "no-browser")
      log("openSysBrowser: devin_web 启动异常 " + res.error);
  } catch (e) {
    log("openSysBrowser: devin_web 异常 " + (e && e.message));
  }
  try {
    await vscode.commands.executeCommand("dao.routeOfficialForAccount", { email: a.email, mode: "sys" });
    _toast("🌐 系统浏览器已打开官网(反代) · " + who);
    return;
  } catch {}
  try {
    await vscode.env.openExternal(vscode.Uri.parse("https://app.devin.ai"));
    _toast("🌐 默认浏览器已打开官网(未隔离·未注入)");
  } catch (e) {
    _toast("✗ 浏览器启动失败: " + (e && e.message));
  }
}
// 软件重载续接: 据 globalState 已存标签, 重新解析各账号反代 → 逐个还原标签。
async function _resumePersistedTabs() {
  let saved = [];
  try { saved = (_ctx && _ctx.globalState && _ctx.globalState.get("dao.multiTabs")) || []; } catch (e) {}
  // v3.51.0 · 多实例首开提速: 先节流预热这批要还原的账号 auth1 缓存 (受控并发,
  //   下面的 openMultiInstance 即命中缓存秒开 · 不再逐个串行慢登录)。
  try { await _prewarmAuthThrottled(saved.map((t) => t && t.email)); } catch (e) {}
  for (const t of saved) {
    try { await openMultiInstance({ email: t.email, devinId: t.devinId, title: t.title, status: t.status, statusClass: t.statusClass, path: t.path, label: t.pageLabel }); }
    catch (e) { try { log("[multi] resume err: " + (e && e.message)); } catch (x) {} }
  }
}

// v3.51.0 · 道法自然 · 反者道之动 · 多实例首开提速 · 节流预热 (auth1 缓存)
//   本源校正: 多实例首开慢的根因是「并发过多→网络拥塞」, 非被官网限速。
//             故不再因噎废食地全禁预热, 而是「鱼与熊掌皆得」——预热回归,
//             但用 受控并发 + 请求间隔 + 仅热有限的近期/已开账号, 网络占用极小(对齐手机版)。
//   守柔(零再增弊端):
//     · 单飞 _prewarmInProgress 防重叠 · 并发默认 2 · 间隔默认 400ms · 上限默认 8 个号
//     · 命中缓存(已有 auth1)即跳过 · 黑名单跳过 · 全程 try/catch 不抛
//     · 仍保留限速感知安全网: _devinLoginRateLimitedUntil 窗口内整体让位(零网络)
//     · 配置开关: wam.prewarm.enabled / .concurrency / .gapMs / .maxCount
let _prewarmInProgress = false;
async function _prewarmAuthThrottled(emails, opts) {
  opts = opts || {};
  if (_prewarmInProgress) return { ok: false, busy: true };
  if (!_cfg("prewarm.enabled", true)) return { ok: false, disabled: true };
  // 限速窗口内不预热 (守安全网 · 即便根因是并发拥塞, 窗口期亦无谓再打)
  if (Date.now() < _devinLoginRateLimitedUntil) return { ok: false, rateLimited: true };
  const conc = Math.max(1, Math.min(4, (opts.concurrency != null ? opts.concurrency : (_cfg("prewarm.concurrency", 2) | 0)) || 2));
  const gapMs = Math.max(0, (opts.gapMs != null ? opts.gapMs : (_cfg("prewarm.gapMs", 400) | 0)));
  const maxCount = Math.max(1, Math.min(50, (opts.maxCount != null ? opts.maxCount : (_cfg("prewarm.maxCount", 8) | 0)) || 8));
  // 去重 + 过滤(已缓存/黑名单/无密码) + 限量
  const seen = new Set();
  const targets = [];
  for (const raw of (emails || [])) {
    const email = String(raw || "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    try { if (_store && _store.isBanned && _store.isBanned(email)) continue; } catch (e) {}
    try { const au = devinCloud.getCachedAuth(email); if (au && au.auth1) continue; } catch (e) {} // 已热即跳
    targets.push(email);
    if (targets.length >= maxCount) break;
  }
  if (!targets.length) return { ok: true, warmed: 0 };
  _prewarmInProgress = true;
  const t0 = Date.now();
  let ok = 0, fail = 0;
  log("prewarm: 启动 · 目标 " + targets.length + " · 并发 " + conc + " · 间隔 " + gapMs + "ms");
  const queue = targets.slice();
  async function _pwWorker() {
    while (queue.length) {
      // 任务执行中若进入限速窗口 → 整队让位 (清空 queue · 零再打)
      if (Date.now() < _devinLoginRateLimitedUntil) { queue.length = 0; break; }
      const email = queue.shift();
      try { const auth = await _resolveAuthForEmail(email); if (auth && auth.auth1) ok++; else fail++; }
      catch (e) { fail++; }
      if (gapMs && queue.length) await new Promise((r) => setTimeout(r, gapMs));
    }
  }
  try {
    const ws = [];
    for (let c = 0; c < conc; c++) ws.push(_pwWorker());
    await Promise.all(ws);
  } finally {
    _prewarmInProgress = false;
    log("prewarm: 完成 · ok " + ok + " · fail " + fail + " · 用时 " + (Date.now() - t0) + "ms");
  }
  return { ok: true, warmed: ok, failed: fail };
}

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
const VERSION = "4.9.4";
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
// ── 有界 keep-alive 共享 Agent · 釜底抽薪根治 app.devin.ai socket 风暴 ──
// 病因(141 实测): httpsReq (登录/postauth/取 orgId/额度/billing) 走 Node 默认 globalAgent
//   (keepAlive:false · maxSockets:Infinity), 每账号预载/校验都新建 socket 且不复用、不限并发,
//   ~数百账号一拥而上 → 单进程对 app.devin.ai 堆出 700+ ESTABLISHED, 把家用路由器 conntrack 打满。
//   devin_cloud.js 早已用有界 Agent 收敛 api 侧, 但 extension.js 这条 app 侧旁路一直未纳管 → 漏网根因。
// 治法: 与 devin_cloud 同理 — 单进程一组复用池, 对同一 host 并发 socket 硬上限 + 空闲回收。
const HTTP_MAX_SOCKETS_PER_HOST = 8; // 单进程对同一 host 并发 socket 硬上限 (超出排队·不再无限新建)
const _httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: HTTP_MAX_SOCKETS_PER_HOST,
  maxFreeSockets: 4,
  timeout: 15000, // 空闲 socket 超时回收 (防 Bound/FinWait/TimeWait 堆积)
  scheduling: "fifo",
});
const WAM_DIR = path.join(os.homedir(), ".wam");
const STATE_FILE = path.join(WAM_DIR, "wam-state.json");
// v2.7.4 (补入v3.0.2) · 道恒无名·侯王若能守之·万物将自宾·民莫之令而自均焉 (三十二章)
//   独立🔒持久化 · 专司一事 · 不被 multi-window race 污染 wam-state.json 大对象
//   只有 toggleSkip 读写 · save() 从此文件读 · multi-process 自宾不争
const LOCK_FILE = path.join(WAM_DIR, "lock-state.json");
// v3.7.6 · dismiss 跨窗口持久化 · 小邦寺民·各得其欲·大者宜为下
const DISMISS_FILE = path.join(WAM_DIR, "_conv_dismiss.json"); // uuid→ts 共享持久文件·多窗口共守
const CONV_DISMISS_TTL = 600000; // 10min dismiss 自动过期时长

// ═══ 归一·深融 · 进程内事件总线 + 共享 auth 库 ════════════════════════════════
// 反者道之动: rt-flow 一次登录已得真 auth1 → 直接共享给全能板(dao-vsix), 免其重复登录、免轮询延迟。
// 三引擎同 extension host 进程 → 共享 global 总线; auth1 落 ~/.dao/dao-accounts-auth.json
// (dao-vsix 路径A 据邮箱即命中, 复用同一令牌)。损之又损 · 一次登录驱动全体。
const DAO_DIR = path.join(os.homedir(), ".dao");
const DAO_ACCOUNTS_AUTH_FILE = path.join(DAO_DIR, "dao-accounts-auth.json");
function _daoBus() {
  try {
    const g = global;
    if (!g.__daoOneBus) {
      g.__daoOneBus = new (require("node:events").EventEmitter)();
      g.__daoOneBus.setMaxListeners(50);
    }
    return g.__daoOneBus;
  } catch {
    return null;
  }
}
// 把已得真 auth1 写入共享库 (dao-vsix 据邮箱命中, 复用同一令牌) — 仅存真 auth1_, 不存 session-token
function _daoShareAuth(email, auth1, orgId, apiKey, apiServerUrl) {
  try {
    const e = String(email || "").trim().toLowerCase();
    if (!e || !auth1 || String(auth1).startsWith("devin-session-token$")) return;
    let store = {};
    try {
      store = JSON.parse(fs.readFileSync(DAO_ACCOUNTS_AUTH_FILE, "utf8")) || {};
    } catch {
      store = {};
    }
    const prev = store[e] || {};
    store[e] = {
      auth1: auth1,
      orgId: orgId || prev.orgId || "",
      orgName: prev.orgName || "",
      orgSlug: prev.orgSlug || "",
      userId: prev.userId || "",
      accountId: prev.accountId || "",
      apiKey: apiKey && String(apiKey).startsWith("cog_") ? apiKey : prev.apiKey || "",
      apiServerUrl: apiServerUrl || prev.apiServerUrl || "",
      savedAt: new Date().toISOString(),
    };
    fs.mkdirSync(DAO_DIR, { recursive: true });
    fs.writeFileSync(DAO_ACCOUNTS_AUTH_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* 守柔 */
  }
}
// 同源·「得一」: 切号板 PAT注密钥 → 同步落入反向注入档案(~/.dao/dao-inject-profile.json)的 GITHUB_PAT。
//   旧病灶: gitInjectSecretBatch 只写活账号的 Devin 密钥, 从不触及注入档案 → 反向注入板 GITHUB_PAT 卡片恒
//   显旧值/未设置("死数据"), 且后续新号自动注入仍用陈旧 PAT。故此处以「覆盖式 upsert」把 PAT 写回档案:
//   dao-vsix 反向注入板下次 getInjectProfile 即读到新值(其档案文件监听亦触发池对账), 两侧恒同源。
const DAO_INJECT_PROFILE_FILE = path.join(DAO_DIR, "dao-inject-profile.json");
function _daoUpsertInjectProfilePat(pat) {
  try {
    const p = String(pat || "").trim();
    if (!p) return false;
    let j = {};
    try { j = JSON.parse(fs.readFileSync(DAO_INJECT_PROFILE_FILE, "utf8")) || {}; } catch { j = {}; }
    if (!Array.isArray(j.secrets)) j.secrets = [];
    const ex = j.secrets.find((s) => s && s.name === "GITHUB_PAT");
    if (ex) { if (ex.value === p) return false; ex.value = p; }
    else j.secrets.push({ name: "GITHUB_PAT", value: p });
    fs.mkdirSync(DAO_DIR, { recursive: true });
    fs.writeFileSync(DAO_INJECT_PROFILE_FILE, JSON.stringify(j, null, 2), "utf8");
    // PAT 换值 → 同步清收敛签名缓存(dao-inject-sig.json): 否则批量注入的 sig 快路把「已收敛」org
    //   全跳过, 新 PAT 永不重注(用户见到的仍是老数据)。清缓存即令下一轮全池强制重注。
    try { fs.unlinkSync(path.join(DAO_DIR, "dao-inject-sig.json")); } catch (e) {}
    return true;
  } catch { return false; }
}
// 广播切号事件 → 全能板即刻跟随 (auto 模式) · 复用既有 auth1, 无重复登录
function _daoEmitAccount(email, auth1, orgId, apiKey, apiServerUrl) {
  try {
    const b = _daoBus();
    if (b)
      b.emit("dao:account", {
        email: email || "",
        auth1: auth1 || "",
        orgId: orgId || "",
        apiKey: apiKey || "",
        apiServerUrl: apiServerUrl || "",
      });
  } catch {
    /* 守柔 */
  }
}
// v4.8.0 · 永久取消追踪 (二次点击 X · Cascade 同款) · uuid 集 · 跨窗口持久 · 永不复现
const UNTRACK_FILE = path.join(WAM_DIR, "_conv_untrack.json");
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
  _untrackedConvUuids = new Set(), // v4.8.0 · uuid · 二次点击 X → 永久取消追踪 · 永不复现 (Cascade 同款)
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
// v4.17.0 · 多实例路由专用诊断落盘 (~/.wam/_route_debug.log) — 与高噪 wam.log 隔离, 便于定位「点了没反应」根因。
function _routeDbg(m) {
  try {
    const p = path.join(os.homedir(), ".wam", "_route_debug.log");
    fs.appendFileSync(p, "[" + new Date().toISOString().substring(11, 23) + "] " + m + "\n");
  } catch (e) {}
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
          if (_convUuid) {
            _activeNotifyResolvers.delete(_convUuid);
            // 用户点 × = 真 dismiss(与面板 × 同权): 落 dismiss 表并持久化跨窗口,
            // 否则对话恢复→再卡的抖动会清掉一次性闸门致同一提醒反复复弹。
            try {
              _dismissedConvUuids.set(_convUuid, Date.now());
              _saveDismissedToDisk();
            } catch (e) {}
          }
          resolve();
        });
      }),
  );
}
// ── 整页翻译 · Edge 免费引擎(对照手机 APK doTranslate/ensureTransToken) ─────
//   令牌: GET edge.microsoft.com/translate/auth (JWT ~10min, 缓存 8min 复用)
//   翻译: POST api-edge.cognitive.microsofttranslator.com/translate (无 key·国内可直连)
let _trTok = "";
let _trTokTs = 0;
function _trHttp(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      const bufs = [];
      res.on("data", (c) => bufs.push(c));
      res.on("end", () => resolve({ code: res.statusCode || 0, body: Buffer.concat(bufs).toString("utf8") }));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { try { req.destroy(new Error("timeout")); } catch (e) {} });
    if (body) req.write(body);
    req.end();
  });
}
async function _ensureTransToken() {
  if (_trTok && Date.now() - _trTokTs < 8 * 60 * 1000) return _trTok;
  const r = await _trHttp({ hostname: "edge.microsoft.com", path: "/translate/auth", method: "GET", headers: { "User-Agent": "Mozilla/5.0" } });
  const tok = String(r.body || "").trim();
  if (r.code >= 200 && r.code < 300 && tok) { _trTok = tok; _trTokTs = Date.now(); }
  return _trTok;
}
async function _edgeTranslate(texts, to) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const token = await _ensureTransToken();
  if (!token) return null;
  const body = Buffer.from(JSON.stringify(texts.map((t) => ({ Text: String(t == null ? "" : t) }))), "utf8");
  const tgt = to || "zh-Hans";
  const r = await _trHttp({
    hostname: "api-edge.cognitive.microsofttranslator.com",
    path: "/translate?api-version=3.0&to=" + encodeURIComponent(tgt),
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8", "Authorization": "Bearer " + token, "Content-Length": body.length },
  }, body);
  if (r.code === 401) _trTok = ""; // 令牌过期 → 下次重取
  let res;
  try { res = JSON.parse(r.body); } catch (e) { return null; }
  if (!Array.isArray(res)) return null;
  return res.map((it) => {
    const tr = it && it.translations;
    return Array.isArray(tr) && tr.length ? String(tr[0].text || "") : "";
  });
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
    if (s.uuid && _untrackedConvUuids.has(s.uuid)) return false; // v4.8.0 · 永久取消追踪 · 永不复现
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

      // v4.8.0 · 永久取消追踪 → 彻底不通知
      if (_untrackedConvUuids.has(s.uuid)) continue;
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
      if (_untrackedConvUuids.has(c.uuid)) continue; // v4.8.0 · 永久取消追踪 → 不通知
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

// ═══ v4.8.0 · 永久取消追踪 (二次点击 X · Cascade 同款) · 跨窗口持久 ═══
//   一次点 X = 10min 静默 (旧)；静默态再点 X = 永久取消追踪 · 永不复现
//   反者道之动 · 知止不殆 — 用户主权终态 · 可 wam.clearConvUntrack 复原
function _loadUntrackedFromDisk() {
  try {
    if (!fs.existsSync(UNTRACK_FILE)) return false;
    const arr = JSON.parse(fs.readFileSync(UNTRACK_FILE, "utf8"));
    if (!Array.isArray(arr)) return false;
    let changed = false;
    for (const u of arr) {
      if (typeof u === "string" && u && !_untrackedConvUuids.has(u)) {
        _untrackedConvUuids.add(u);
        changed = true;
      }
    }
    return changed;
  } catch {
    return false;
  }
}
function _saveUntrackedToDisk() {
  try {
    // 合并磁盘已有 (其他窗口写入) + 当前内存 · 不覆盖他窗 · 大者宜为下
    try {
      if (fs.existsSync(UNTRACK_FILE)) {
        const arr = JSON.parse(fs.readFileSync(UNTRACK_FILE, "utf8"));
        if (Array.isArray(arr)) for (const u of arr) if (u) _untrackedConvUuids.add(u);
      }
    } catch {}
    atomicWrite(UNTRACK_FILE, JSON.stringify([..._untrackedConvUuids]));
  } catch (e) {
    log("untrack-save err: " + (e.message || e));
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
    _loadUntrackedFromDisk(); // v4.8.0 · 启动加载永久取消追踪集
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
    // v4.8.0 · 永久取消追踪文件监视 · 跨窗口同步
    fs.watchFile(UNTRACK_FILE, { persistent: true, interval: 1500 }, () => {
      if (_loadUntrackedFromDisk()) {
        _broadcastConvSection();
        log("untrack-sync: 跨窗口同步永久取消追踪集");
      }
    });
    context.subscriptions.push({
      dispose: () => {
        try {
          fs.unwatchFile(UNTRACK_FILE);
        } catch {}
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
// v4.9.9 · F2/F3 真根因 — 对话区 html 内嵌每秒变动的 staleSec("Ns前")/sizeKB/陈旧图标,
//   且其"· 分隔符 + 图标"会随 staleSec 0↔>0 出现/消失 → 即便屏蔽数值, html 串仍每秒不同 →
//   conv-section 每秒整段重建 → 闪。治本: 签名只取"结构性数据"(对话uuid集 + 硬状态 + 计数 + 灯色),
//   不含任何 staleSec/sizeKB/age/陈旧切换 → 纯时间滴答不再触发任何 DOM 重建。
let _convStructSig = "";
function _getConvTrackingHtml() {
  // v3.11.4: 每次渲染前尝试从 vscdb 裸读刷新标题 (增量·有去重·10s节流)
  _refreshTitlesFromVscdbRaw();
  const hub = _hubData;
  const backupDir = _cfg("conversationBackupDir", "") || CONV_BACKUP_DEFAULT;
  // ── 无 Hub 数据时 · 显示简要状态 ──
  if (!hub || !hub.ts) {
    _convStructSig = "nohub:" + (_autoBackupDone ? "1" : "0");
    return `<div class="conv-section">
<div class="conv-header" onclick="toggleConv()"><span>&#128172; 对话追踪</span><span id="convArrow">&#9660;</span></div>
<div class="conv-body" id="convBody">
<div class="conv-empty">对话追踪引擎未运行 · 自动备份仍在运行</div>
<div class="conv-actions">
<button onclick="doSetBackupDir()" class="conv-btn" title="Cascade 备份目录·已有备份自动迁移·每日自动全量备份·新对话实时增量同步">&#128193; Cascade 备份配置</button>
${_autoBackupDone ? '<span style="color:#4ec9b0;font-size:9px">&#10003; 已自动备份</span>' : '<span style="color:#888;font-size:9px">启动中待备份(8s)</span>'}
</div>
<div class="conv-backup-path" title="${_esc(backupDir)}">Cascade备份: ${_esc(backupDir)}</div>
${_dvBackupPanelHtml()}
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
      if (s.uuid && _untrackedConvUuids.has(s.uuid)) return false; // v4.8.0 · 永久取消追踪
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
    if (_untrackedConvUuids.has(c.uuid)) return false; // v4.8.0 · 永久取消追踪
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
      .map((c, _ci) => {
        // v13.1: 只显示用户可读标题，不再 shortId 兜底
        const shortT = _truncTitle(c._displayTitle, 25);
        const _cvNo = '<span class="cv-no" title="对话编号 ' + (_ci + 1) + ' (Cascade)">' + (_ci + 1) + "</span>";
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
        return `<div class="cv-current">${_cvNo}<span class="cv-streaming">${_stateIcon}</span> <b>${_esc(shortT)}</b>${c.sizeKB ? " · " + c.sizeKB + "KB" : ""}${st ? " · " + st : ""}${_stateHint}${_xBtn}</div>`;
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
  // v4.9.9 · 结构签名 (只含会"改变页面结构/语义"的字段; 刻意排除 staleSec/sizeKB/age/陈旧切换)
  _convStructSig = JSON.stringify({
    d: dotCls,
    cc: _visibleConversationCount,
    fc: _visibleFlowCount,
    es: _effectiveStuck,
    ee: _effectiveError,
    s: _streamingFiltered.map(
      (c) =>
        (c.uuid || c._displayTitle || "") +
        "|" +
        (c.isAwaitingUser ? "A" : "") +
        (c.state === "warning" || c.state === "stuck" ? "W" : "") +
        (c.state === "no_pb" ? "N" : ""),
    ),
    cur:
      _streamingFiltered.length === 0 && hub.current
        ? (hub.current.uuid || "") + "|" + (hub.current.phase || "")
        : "",
    k: visibleStuck.map((s) => (s.uuid || s._displayTitle || "") + "|" + s.level),
  });
  return `<div class="conv-section">
<div class="conv-header" onclick="toggleConv()"><span>&#128172; 对话追踪</span>${_badgeCount > 0 ? '<span class="cv-badge">' + _badgeCount + "</span>" : ""}<span id="convArrow">&#9660;</span></div>
<div class="conv-body" id="convBody">
${sumHtml}${currentHtml}${stuckHtml ? '<div class="cv-stuck-list">' + stuckHtml + "</div>" : ""}
<div class="conv-actions">
<button onclick="doSetBackupDir()" class="conv-btn" title="选择 Cascade 备份目录·已有备份自动迁移·每日自动备份·新对话实时同步">&#128193; Cascade 备份配置</button>
${backupStatus}
</div>
<div class="conv-backup-path" title="${_esc(backupDir)}">Cascade备份: ${_esc(backupDir)}</div>
${_dvBackupPanelHtml()}
</div></div>`;
}
// v4.7.8 · 同步短睡 (rename 退避用) · Atomics.wait 优先 · 退化忙等兜底 (≤数百 ms·仅锁冲突时触发)
function _sleepSyncMs(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}
function atomicWrite(filePath, content) {
  ensureDir(path.dirname(filePath));
  const tmp = filePath + "." + process.pid + "." + Date.now() + ".tmp";
  fs.writeFileSync(tmp, content);
  // v4.7.8 · 本源修复(141 实测 EPERM ×81): Windows 上 wam-state.json 被瞬时锁
  //   (杀软扫描/并发读)时 fs.renameSync 抛 EPERM/EBUSY/EACCES。旧实现 catch 内即便
  //   copyFileSync 兜底成功也无条件 throw → 数据其实已落盘却被记为 "store.save fail"
  //   (假失败刷屏)且无重试。治法: 锁类错误短退避重试(40/80/120/160ms); 终败再 copyFile
  //   兜底, 兜底成功即返回(不抛)。消除假失败 + 防数据丢失。
  let lastErr = null;
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(tmp, filePath);
      return; // 真原子落盘成功
    } catch (e) {
      lastErr = e;
      const code = e && e.code;
      const transient = code === "EPERM" || code === "EBUSY" || code === "EACCES";
      if (!transient || i === 4) break; // 非锁类错误 或 已是最后一次 → 跳出走兜底
      _sleepSyncMs(40 * (i + 1)); // 退避后重试 (锁多在数十 ms 内自解)
    }
  }
  // rename 终败 → copyFile 兜底覆写 (数据仍落盘)
  try {
    fs.copyFileSync(tmp, filePath);
    try {
      fs.unlinkSync(tmp);
    } catch {}
    return; // 兜底成功 · 数据已持久化 · 不抛 (消除假失败)
  } catch (e2) {
    // 两路均败 · 清 .tmp 防累孤儿 · 如实上抛 (v2.4.4 bug5)
    try {
      fs.unlinkSync(tmp);
    } catch {}
    throw lastErr || e2;
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
let _openExternalGuardWarned = false; // v4.7.8 · 降级只记一次 (防 27× 刷屏)
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
    // v4.7.8 · 本源修复(141 实测 Cannot redefine property ×27): 某些 Windsurf/VSCode
    //   版本 vscode.env.openExternal 为「不可配置」访问器 → Object.defineProperty 必抛
    //   "Cannot redefine property", 且每次模式切换都重试 → 刷屏且守卫从未装上。
    //   治法: 先探属性描述符, 不可配置则跳过 defineProperty(避免抛错), 退而尝试可写赋值兜底;
    //   仍装不上则静默降级且只记一次 (不影响核心功能)。
    const desc = Object.getOwnPropertyDescriptor(vscode.env, "openExternal");
    let installed = false;
    if (!desc || desc.configurable) {
      try {
        Object.defineProperty(vscode.env, "openExternal", {
          value: _guard,
          configurable: true,
          writable: true,
        });
        installed = vscode.env.openExternal === _guard;
      } catch {}
    }
    if (!installed && (!desc || desc.writable || typeof desc.set === "function")) {
      try {
        vscode.env.openExternal = _guard; // 可写访问器/数据属性 → 直接赋值兜底
        installed = vscode.env.openExternal === _guard;
      } catch {}
    }
    _openExternalGuardActive = installed;
    if (installed) {
      log("🛡️ openExternal guard: 已安装 · 切号窗口保护中");
    } else {
      // 不可配置/不可写 · 静默降级 · 只记一次 (不再每次切换都抛错刷屏)
      if (!_openExternalGuardWarned) {
        log("🛡️ openExternal guard: 该 IDE openExternal 不可重定义 · 降级无守卫(不影响核心功能)");
        _openExternalGuardWarned = true;
      }
      _origOpenExternal = null;
    }
  } catch (e) {
    if (!_openExternalGuardWarned) {
      log("🛡️ openExternal guard: 安装失败 · " + (e.message || e));
      _openExternalGuardWarned = true;
    }
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
    // v4.6.0 反者道之动: 既存锁定也存解锁 (显式 false), 缺省态由 lockByDefault 决定 (默锁).
    //   旧法 (默解锁): unlock=delete key → 缺省=解锁. 新法须显式记录用户每次解锁意图.
    cur[k] = { skipAutoSwitch: !!locked, ts: Date.now() };
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
      // v4.6.0 反者道之动: 显式记录锁定/解锁两态 (缺省态由 lockByDefault 决定)
      cur[k] = { skipAutoSwitch: locked, ts: Date.now() };
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
  // v4.8.5 · 去除"过期即排除"硬门槛 · Free 试用 planEnd 过期但 D/W 仍可用 → 不应排除
  //   真不可用由下方 D/W 最低门槛与双零守门拦截; 真不可登录由黑名单(banned)拦截
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
  if (_expiryFirst && h.planEnd > Date.now() && h.daysLeft < 7 && _effQ > 0)
    return true;
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
        agent: _httpsAgent, // 有界复用池 · 防 globalAgent 无限新建 socket 打满 conntrack
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
    // v4.6.0 反者道之动 · 默认锁定: 账号无显式 lock-state 记录时, 按 lockByDefault(默 true) 视为🔒锁定.
    //   缺省锁定 ⇒ 自动切号被禁止; 用户主动🔓解锁某号(显式写 false)后, 该号才进入自动切号候选.
    //   兼容回退: wam.lockByDefault=false 复旧行为(缺省解锁).
    const lockByDefault = _cfg("lockByDefault", true);
    let restored = 0;
    let defaulted = 0;
    for (const a of this.accounts) {
      const meta = locks[a.email.toLowerCase()];
      if (meta && typeof meta.skipAutoSwitch === "boolean") {
        a.skipAutoSwitch = meta.skipAutoSwitch; // 用户显式意图(锁或解锁)优先
        if (a.skipAutoSwitch) restored++;
      } else {
        a.skipAutoSwitch = !!lockByDefault; // 无记录 → 默认锁定(反转)
        if (a.skipAutoSwitch) defaulted++;
      }
    }
    if (restored > 0 || defaulted > 0)
      log(
        "reloadAccounts: 🔒 显式锁号 " +
          restored +
          " 个 · 默认锁(无记录·lockByDefault=" +
          lockByDefault +
          ") " +
          defaulted +
          " 个",
      );
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
      duplicate = 0,
      updated = 0;
    const addedEmails = []; // v2.4.3 · 返新加 email 给 webview handler 即时 verify
    const updatedEmails = []; // 返改密 email · 同样即时 verify (清陈旧 health 后令其重验)
    for (const a of newOnes) {
      const exists = this.accounts.find(
        (x) => x.email.toLowerCase() === a.email.toLowerCase(),
      );
      if (exists) {
        // 重复邮箱 · 密码不同 → 更新密码 (修正错误密码的唯一面板入口)
        //   清陈旧 health/blacklist 令其按新密码重新验证 (旧密码缓存导致"未验"假象的根治)
        if (a.password && exists.password !== a.password) {
          exists.password = a.password;
          const k = exists.email.toLowerCase();
          delete this.health[k];
          delete this.blacklist[k];
          delete this.inUseUntil[k];
          updatedEmails.push(exists.email);
          updated++;
        } else {
          duplicate++;
        }
        continue;
      }
      this.accounts.push({
        email: a.email,
        password: a.password,
        addedAt: Date.now(),
      });
      this._purgeAccountResiduals(a.email); // 重加即新生: 旧冷却/清理残态不随号还魂 (addedAt 另予 24h 免自动出库保护)
      addedEmails.push(a.email);
      added++;
    }
    if (added > 0 || updated > 0) this._persistAccountsToMd();
    return { added, duplicate, updated, tokens, addedEmails, updatedEmails };
  }
  // 彻底清账号残留态(防幽灵·对照手机 APK purgeAccountState): 出库后不留任何按 email 索引的残留态,
  //   重加必可见且按全新账号对待 (24h 冷却锚/概览缓存不再污染新一轮判定)。
  _purgeAccountResiduals(email) {
    const k = String(email || "").toLowerCase();
    if (!k) return;
    try { devinCloud.clearCleanupState(k); } catch {}
    try { _dvOverviewCache.delete(k); } catch {}
  }
  remove(idx) {
    if (idx < 0 || idx >= this.accounts.length) return false;
    const r = this.accounts.splice(idx, 1)[0];
    if (r) {
      delete this.health[r.email.toLowerCase()];
      delete this.blacklist[r.email.toLowerCase()];
      delete this.inUseUntil[r.email.toLowerCase()]; // v2.3.0
      this._purgeAccountResiduals(r.email);
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
      this._purgeAccountResiduals(r.email);
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
      // 防幽灵 · 同步镜像候选末位 accounts-backup.json (对照手机 APK mirrorAccountsToVault):
      //   出库后金库不再回拉已移除账号 — 否则 accounts.md 清空后 loadAccountsFromFs 回落
      //   陈旧 backup.json 会让移除的账号死而复生(重加又显「已在库中」的终结态)。
      try {
        atomicWrite(
          path.join(WAM_DIR, "accounts-backup.json"),
          JSON.stringify(
            { accounts: this.accounts.map((a) => ({ email: a.email, password: a.password })) },
            null,
            2,
          ),
        );
      } catch {}
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

    // v4.8.5 · 去除"过期排除" · planEnd 过期但 D/W 仍可用(如 Free 池续配)→ 按真实额度评分, 不再 -∞
    //   真耗尽由下方双零/最低门槛拦截; 真不可登录由黑名单拦截
    // ═══ 临期主导加成 (v3.3.1 · 反者道之动 · 不用即废先消耗) ═══
    //   (60 - daysLeft) × 2000 · 1日差=2000 > quota 最大差 ~1880 → 临期主导
    //   daysLeft≥60 或 planEnd=0(永久/Pro): bonus=0 · 与 v3.3.0 同
    //   daysLeft=2 (截图红): bonus=116_000 · daysLeft=0(<12h): bonus=120_000
    const expiryFirst =
      typeof _cfg === "function" ? !!_cfg("expiryFirst", true) : true;
    const expBonus =
      expiryFirst && h.planEnd > Date.now()
        ? Math.max(0, (60 - h.daysLeft) * 2000)
        : 0;

    // ═══ 第二层 · 📊 百分比池 (v3.4.1 · 临期主导 + 额度次排 · 唯变所适) ═══
    //   v3.4.1 核心变更: effQ<threshold 且 daysLeft<7 且 effQ>0 → 仍加 expBonus
    //   根因: v3.3.1 对 effQ<threshold 不加 → 临期耗尽号永远不被选中 → 不可逆损失
    //   道: 「天下莫柔弱于水·而攻坚强者莫之能胜也·以其无以易之也」
    const effQ = Math.min(Math.max(h.daily, 0), Math.max(h.weekly, 0));
    const _threshold =
      typeof _cfg === "function" ? +_cfg("autoSwitchThreshold", 5) || 5 : 5;
    const _isExpiryRescue =
      expiryFirst && h.planEnd > Date.now() && h.daysLeft < 7 && effQ > 0;

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
    // v3.50.65 · 路丁(vscdb直写)依赖 Windows DPAPI(CryptUnprotectData) 解密 Local State,
    //   非 Windows 平台(Linux/macOS Devin Desktop)本无此 API → 早退返清晰原因,
    //   免去 spawn 一个注定失败的 python helper 及其误导性的 "AppData/Roaming 路径不存在" 报错。
    if (process.platform !== "win32")
      return { ok: false, reason: "ding-windows-only(platform=" + process.platform + ")" };
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
        windowsHide: true,
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
      // 归一·深融 · 缓存切号也广播 → 全能板即刻跟随 (auth1 已在上次全登录写入共享库)
      try { _daoEmitAccount(acc.email, "", "", _cached.apiKey, _cached.apiServerUrl); } catch {}
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
    return { ok: false, stage: "devinLogin", error: dl.error, status: dl.status, retryAfterSec: dl.retryAfterSec };
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
  // v3.50.65 · 注入降级激活 (道法自然·不因末技废本源) — 决策见 devinCloud.resolveSwitchActivation
  //   registerUser 预验成功(_regApiKey 存在) ⟺ auth1 token 有效 ⟺ 账号在 /shell·API·
  //   多实例反代·反向注入层面完全可用。IDE 原生注入(路丙/丁)在 headless/Linux 本不可用,
  //   不应因此判 switch 失败而让 _tick 永久空转。token 有效则仍激活(路径记 'none' 降级)。
  const _sw = devinCloud.resolveSwitchActivation(!!inj.ok, !!_regApiKey);
  let _injPath = inj.path;
  if (!inj.ok) {
    if (_sw.activate) {
      _injPath = "none";
      log(
        "  inject ✗ 路" + inj.path + " " + (inj.note || "") +
          " · token 有效 → 逻辑激活(注入降级 none · /shell·API·多实例仍可用)",
      );
    } else {
      log("  inject ✗ 路" + inj.path + " " + inj.note);
      _bumpFailure(store, acc.email, "inject: " + (inj.note || ""));
      return { ok: false, stage: "inject", error: inj.note };
    }
  }
  store.setActive(
    idx,
    acc.email,
    pa.sessionToken,
    _regApiKey,
    _regApiServerUrl,
    _injPath,
  );
  if (_regApiKey) {
    store.activeApiKey = _regApiKey;
    store.activeApiServerUrl = _regApiServerUrl;
    store.save();
  }
  // v3.0.3 · 全登录成功 → 更新缓存 (下次切号可跳 devinLogin)
  _cacheSession(acc.email, pa.sessionToken, _regApiKey, _regApiServerUrl);
  // 归一·深融 · 把已得真 auth1 写入共享库 + 广播 → 全能板免重复登录即刻跟随同步
  try {
    const _org = (pa && pa.primaryOrgId) || "";
    _daoShareAuth(acc.email, dl.auth1, _org, _regApiKey, _regApiServerUrl);
    _daoEmitAccount(acc.email, dl.auth1, _org, _regApiKey, _regApiServerUrl);
  } catch {}
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
  log("login: ✓ " + tag + " · 路" + _injPath + (_injPath === "none" ? "(注入降级)" : "") + " · " + ms + "ms");
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
  return { ok: true, path: _injPath, ms, degraded: _injPath === "none" ? (inj.note || "inject-unavailable") : undefined };
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
// v4.9.10 · 切号面板"每隔几秒整页重渲"根治 (用户实测: 面板每几秒刷新一次·无法操作)
//   根因: _tick() (5~10s 周期监控) 与各处状态变更统一走 _broadcastUI → 无条件 webview.html=buildHtml()
//     → 即便结构/数据毫无变化, 整个 webview DOM 被销毁重建 → 闪烁/滚动丢失/下拉收起/无法点击。
//   治法 (对齐 conv-section 的 _convStructSig 思路): 计算"只含结构性数据"的面板签名,
//     仅当结构真变化 (账号集/活跃/额度整数/锁定/封禁/标签/进行中对话…) 才整页重建;
//     纯时间滴答 (重置倒计时/"min前切"/采样龄/封禁秒/使用中秒) 不进签名 → 不再触发任何重建。
//   结构未变时只增量刷新对话追踪区 (_broadcastConvSection 自带签名去抖) → 永不整页闪。
let _panelStructSig = null;
let _wamRebuildThrottleTs = 0;
// 全池耗尽提醒去抖 (episode 语义) — 根治左下角「全部账号额度已耗尽」删不掉/反复弹:
//   旧病: _tick(5~10s)+硬耗尽看门狗(2s) 每轮都 _notify → 用户点 × 后几秒内又弹, 强干扰。
//   治法: 同一耗尽事件(episode)只提醒一次且限时自动消失; 切号成功/有可用号即重置 episode。
let _exhaustNotifyTs = 0;
function _resetExhaustEpisode() { _exhaustNotifyTs = 0; }
function _notifyExhaustOnce(msg) {
  const gapMs = Math.max(1, +_cfg("exhaustNotifyIntervalMin", 360) || 360) * 60000;
  if (Date.now() - _exhaustNotifyTs < gapMs) return;
  _exhaustNotifyTs = Date.now();
  _notifyTimed("warn", msg, 600000); // 10min 自动淡去 · 可手动关 · 不再重弹
}
let _broadcastForce = false; // 结构性用户动作(删号等) → 绕过重挂节流·立即回显
function _computePanelStructSig() {
  if (!_store) return "init";
  const store = _store;
  const stats = store.getStats();
  const accounts = store.accounts;
  const activeI = store.activeIdx;
  const parts = [
    "m=" + _wamMode,
    "ar=" + (_cfg("autoRotate", true) ? 1 : 0),
    "ai=" + activeI,
    "cc=" + stats.checkedCount,
    "dr=" + (stats.drought ? 1 : 0),
  ];
  const order = _wamDisplayOrder(accounts);
  for (const i of order) {
    const a = accounts[i];
    const h = store.getHealth(a.email);
    const checked = !!(h && h.checked);
    parts.push(
      [
        i,
        a.email,
        checked ? 1 : 0,
        checked ? Math.round(h.daily) : -1,
        checked ? Math.round(h.weekly) : -1,
        i === activeI ? 1 : 0,
        store.isBanned(a.email) ? 1 : 0,
        i !== activeI && store.isInUse(a.email) ? 1 : 0,
        (h && h.plan) || "",
        checked ? Math.round(h.overageDollars || 0) : 0,
        isClaudeAvailable(h) ? 1 : 0,
        a.skipAutoSwitch ? 1 : 0,
        h && h.hasSnap ? 1 : 0,
        devinCloud.getTag(a.email) || "",
        checked ? _parseTimeMs(h.planEnd) : 0,
        _hasLiveConv(a.email) ? 1 : 0,
      ].join("\u0001"),
    );
  }
  return parts.join("\u0002");
}
function _broadcastUI(force) {
  if (force) _broadcastForce = true;
  // v3.0.6 · 防抖 · 合并高频调用 · 根治验证/切号期多次全量重建卡顿
  //   verify N个新账号 → N次 broadcastUI → 合并为1次 · 用户无感 · 系统无不为
  // v3.11.3 · 软编码 · 60→200ms (wam.broadcastDebounceMs) · 多选操作时用户手速<200ms·不触发中途重建
  if (_broadcastUITimer) clearTimeout(_broadcastUITimer);
  const _debMs = Math.max(30, +_cfg("broadcastDebounceMs", 200) || 200);
  _broadcastUITimer = setTimeout(() => {
    _broadcastUITimer = null;
    const _force = _broadcastForce;
    _broadcastForce = false;
    // v4.9.10 · 结构签名门: 结构未变 → 不整页重建 (只增量刷对话区) → 杜绝每几秒整页闪
    const sig = _computePanelStructSig();
    if (sig === _panelStructSig && !_force) {
      _broadcastConvSection();
      updateStatusBar();
      return;
    }
    _panelStructSig = sig;
    if (_sidebarProvider) _sidebarProvider.refresh(true);
    let _rebuilt = null;
    if (_editorPanel) {
      try {
        _rebuilt = buildHtml();
        _editorPanel.webview.html = _rebuilt;
      } catch {}
    }
    // 归一 · 内嵌「切号」: 结构性变化 → 整页重渲推回宿主 → 六板 iframe 重挂 (__wamRebuild)
    // v4.26.4 · 节流 15s: 大批量验号期间结构签名高频变化, 不至于每几秒重挂 iframe(滚动跳顶·无法操作)
    if (_hostPost) {
      if (_force || Date.now() - _wamRebuildThrottleTs >= 15000) {
        _wamRebuildThrottleTs = Date.now();
        try { _hostPost({ type: "__wamRebuild", html: _rebuilt || buildHtml(), force: !!_force }); } catch {}
      }
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
          _resetExhaustEpisode(); // 切号成功 = 新 episode · 下次全池耗尽可再提醒一次
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
  _panelStructSig = _computePanelStructSig();
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
    _panelStructSig = _computePanelStructSig();
    webviewView.webview.onDidReceiveMessage((msg) => handleWebviewMessage(msg));
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.refresh(true);
    });
  }
  refresh(force) {
    if (!(this._view && this._view.visible)) return;
    // v4.9.10 · 非强制刷新先过结构签名门: 结构未变只增量刷对话区·不整页重建 (杜绝闪)
    if (!force) {
      const sig = _computePanelStructSig();
      if (sig === _panelStructSig) {
        _broadcastConvSection();
        return;
      }
      _panelStructSig = sig;
    }
    this._view.webview.html = buildHtml();
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
  // v4.8.5 · 道法自然 · 去"过期"语义 · 账号能登录即发亮 · 不以有效期判死
  //   旧法之患: Free 试用 planEnd 过期即标红"已过期" · 但 D/W=100 仍完全可用 → 误导
  //   新法: 未来到期显绿色"N天"(正向信息) · 已过/无 planEnd 一律 ∞ 发亮 · 永不显"已过期"
  if (!h || !h.checked) {
    return '<span class="days" style="color:#888" title="点🔍刷新有效期 ∞">∞</span>';
  }
  const now = Date.now();
  const planEnd = _parseTimeMs(h.planEnd);
  if (planEnd > now) {
    const daysLeft = _calcDaysLeft(planEnd, now);
    const dStr = _formatExpiryTime(planEnd);
    const remain = _formatDurationMs(planEnd - now);
    return `<span class="days" style="color:#4ec9b0" title="到期: ${_esc(dStr)} · 剩 ${daysLeft} 天 · ${_esc(remain)}">${daysLeft}天</span>`;
  }
  return '<span class="days" style="color:#888" title="无到期限制 · 账号可用即发亮 ∞">∞</span>';
}

// v4.9.7 · F4: 识别某号是否"进行中对话"(running/待输入/卡住), 据 _dvStatusAgg 聚合缓。
//   口径与 badge/追踪面一致: total>0 且 3 分内有效且 running+awaiting+blocked > 0。
function _hasLiveConv(email) {
  try {
    const st = _dvStatusAgg.get(String(email || "").toLowerCase());
    if (!st || (st.total | 0) <= 0) return false;
    if (Date.now() - (st.ts || 0) > DV_STATUS_HOLD_MS) return false;
    return ((st.running | 0) + (st.awaiting | 0) + (st.blocked | 0)) > 0;
  } catch {
    return false;
  }
}
// v4.9.7 · F4: 显示顺序 — 有进行中对话的号顶置, 其余维持原编号顺序 (稳排; 与手机版 _computeOrder 同源)。
function _wamDisplayOrder(accounts) {
  const order = accounts.map((_, i) => i);
  order.sort((x, y) => {
    const lx = _hasLiveConv(accounts[x].email) ? 1 : 0;
    const ly = _hasLiveConv(accounts[y].email) ? 1 : 0;
    if (lx !== ly) return ly - lx; // 进行中 → 顶置
    return x - y; // 其余维持原编号顺序
  });
  return order;
}

function buildHtml() {
  if (!_store)
    return `<html><body style="color:#888;font:12px sans-serif;padding:12px">WAM 初始化中...</body></html>`;
  const store = _store,
    stats = store.getStats(),
    accounts = store.accounts,
    activeI = store.activeIdx;
  const autoOn = _cfg("autoRotate", true);
  // v4.9.7 · F4: 进行中对话的账号自动顶置(与 dao-vsix 二合一同源); 仅改显示顺序, data-i/编号/activeIdx 仍用原索引 i → 切号/锁/onclick 全不受影响。
  const _dispOrder = _wamDisplayOrder(accounts);
  const _liveCount = _dispOrder.filter((i) => _hasLiveConv(accounts[i].email)).length;
  let rows = "";
  for (let _oi = 0; _oi < _dispOrder.length; _oi++) {
    const i = _dispOrder[_oi];
    // v4.9.7 · F4: 在"运行组"与"其余"边界插入对齐分隔栏 (仅两组都非空时)
    if (_oi === _liveCount && _liveCount > 0 && _liveCount < _dispOrder.length) {
      rows += '<div class="run-sep"><span>&#9650; 运行中对话 · 其余账号 &#9660;</span></div>';
    }
    const a = accounts[i],
      h = store.getHealth(a.email);
    const dvTag = devinCloud.getTag(a.email);
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
    // v4.8.5 · 去除"陈年 / Nh前"标记 · 数据新鲜度不再使账号变灰 (endpoint 挂仍由顶部红条提示)
    let staleTag = "";
    let isStaleRow = false;
    rows += `
    <div class="row${isActive ? " act" : ""}${isBanned ? " banned" : ""}${isInUse ? " inuse" : ""}" data-i="${i}" data-email="${_esc(a.email.toLowerCase())}">
      <input type="checkbox" class="chk" data-i="${i}" />
      <span class="acc-no" title="账号编号 ${i + 1} · 对话追踪中 Devin Cloud 对话用此编号区分">${i + 1}</span>
      <span class="dm ${domainBadge}" title="${_esc(domain)}">${domainBadge}</span>
      <span class="em" title="${_esc(a.email)}">${_esc(emailShort)}</span>
      ${expTag}${planTag}${h.checked && h.overageDollars > 0 ? `<span class="eua" title="Extra Usage Active · $${h.overageDollars.toFixed(0)} · Cascade quota=0时仍完全可用">$${Math.round(h.overageDollars)}</span>` : ""}${h.checked && !h.overageDollars ? `<span class="eua0" title="已验 · 无Extra Usage余额">$0</span>` : ""} ${claudeTag}${bnTag}${iuTag}${staleTag}${freshTag}${liveTag}${ucTag}
      <span class="qt">
        <span class="mb"><span class="mf" style="width:${dPct}%;background:${dC}"></span></span>
        <span class="ql" style="color:${dC}">${isU ? "D?" : "D" + dPct}</span>
        <span class="mb"><span class="mf" style="width:${isU ? 0 : wPct}%;background:${wC}"></span></span>
        <span class="ql" style="color:${wC}">${isU ? "W?" : "W" + wPct}</span>
      </span>
      <span class="dv-run" data-email="${_esc(a.email.toLowerCase())}" title="Devin Cloud 运行中对话">${dvTag ? `<span class="dv-tag" title="账号标签">${_esc(dvTag)}</span>` : ""}</span>
      <span class="acts">
        <button class="b dv" onclick="dv(${i})" title="Devin Cloud · 展开本账号对话/知识库/概览">&#9729;&#9662;</button>
        <button class="b sk" onclick="sk(${i})" data-locked="${a.skipAutoSwitch ? "1" : "0"}" title="${a.skipAutoSwitch ? "已锁定·自动切号跳过此号(点击解锁)" : "锁定·防止自动切号选到此号"}" style="opacity:${a.skipAutoSwitch ? "1;color:#f0c674" : ".4"}">${a.skipAutoSwitch ? "&#128274;" : "&#128275;"}</button>
        <button class="b sw" onclick="sw(${i})" title="手动切换(无限制)"${isBanned ? " disabled" : ""}${_wamMode === "official" ? ' disabled style="opacity:.3;cursor:not-allowed"' : ""}>&#9889;</button>
        <button class="b vf" onclick="vf(${i})" title="验证">&#128270;</button>
        <button class="b cp" onclick="cp(${i})" title="复制">&#128203;</button>
        <button class="b rt" onclick="rt(${i})" title="路由官网→IDE内置浏览器(自足反代注入该号登录·多实例标签·各登各号)">&#128421;</button>
        <button class="b sb" onclick="sb(${i})" title="系统默认浏览器打开官网(跳出IDE·多实例)">&#127760;</button>
        <button class="b wp" onclick="wp(${i})" title="水过无痕·一键清理本账号 Devin Cloud 全部痕迹(对话/知识库/剧本/密钥/Git)">&#127754;</button>
        <button class="b rm" onclick="rm(${i})" title="删除">&times;</button>
      </span>
    </div>
    <div class="dv-detail${_dvOpenEmails.has(a.email.toLowerCase()) ? " open" : ""}" id="dvDetail${i}" data-i="${i}" data-email="${_esc(a.email.toLowerCase())}">${(() => { const cc = _dvCacheFresh(a.email); return _dvOpenEmails.has(a.email.toLowerCase()) && cc ? _dvOverviewHtml(cc.ov, i, cc.gitSt) : ""; })()}</div>`;
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
      planExpiryTag = ` <span style="color:var(--green)" title="到期: ${_esc(_formatExpiryTime(ah.planEnd))} · 剩 ${ah.daysLeft} 天 · ${_esc(_formatDurationMs(ah.planEnd - Date.now()))}">${ah.daysLeft}天</span>`;
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
:root{--bg:#0e1116;--fg:#cdd3de;--border:#2d333b;--input-bg:#0d1117;--input-border:#30363d;--btn:#1f6feb;--btn-h:#388bfd;--green:#4ec9b0;--orange:#ce9178;--red:#f85149;--blue:#9cdcfe}
*{margin:0;padding:0;box-sizing:border-box}
body{font:12px/1.5 -apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--fg);padding:6px 8px;overflow-x:hidden}
body.resizing *{animation-play-state:paused!important;transition:none!important}
body.resizing .row{contain:strict;contain-intrinsic-size:auto 28px}
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
.row{display:flex;align-items:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;gap:4px;user-select:none;content-visibility:auto;contain-intrinsic-size:auto 28px}
.run-sep{display:flex;align-items:center;justify-content:center;gap:6px;margin:3px 0;padding:2px 0;font-size:9px;font-weight:700;letter-spacing:.5px;color:#6cb3ff;border-top:1px dashed #2d4a63;border-bottom:1px dashed #2d4a63;background:#141c24;user-select:none}
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
.acc-no{flex-shrink:0;min-width:14px;height:14px;line-height:14px;text-align:center;font-size:9px;font-weight:700;color:#9cdcfe;background:#1c2733;border:1px solid #2d4a63;border-radius:3px;padding:0 2px}
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
.b.dv{background:#1e3a4a;color:#9cdcfe;width:auto;padding:0 3px;font-size:10px}.b.dv:hover{background:#2a4a5a}
.b.wp{background:#1a2e3a;color:#4ec9b0}.b.wp:hover{background:#2a3e4a;color:#7fffd4}
.dv-run{display:inline-flex;align-items:center;gap:3px;min-width:0;margin-left:2px}
.dv-run .run{color:#4ec9b0;font-size:9px;font-weight:700;background:#13332b;border:1px solid #1e5a4a;border-radius:3px;padding:0 3px;white-space:nowrap}
.dv-run .awa{color:#d29922;font-size:9px;font-weight:700;background:#332a13;border:1px solid #5a4a1e;border-radius:3px;padding:0 3px;white-space:nowrap;margin-left:2px}
.dv-run .blk{color:#f44;font-size:9px;font-weight:700;background:#3a1a1a;border:1px solid #5a2a2a;border-radius:3px;padding:0 3px;white-space:nowrap;margin-left:2px}
.dv-tag{color:#d7ba7d;font-size:9px;background:#332d1a;border:1px solid #5a4a1e;border-radius:3px;padding:0 3px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis}
.dv-detail{display:none;background:#101417;border:1px solid #233;border-radius:4px;margin:0 2px 4px;padding:6px 8px;font-size:11px;content-visibility:auto;contain-intrinsic-size:auto 0px}
.dv-detail.open{display:block}
.dv-detail .dv-h{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:5px}
.dv-detail .dv-stat{color:#9cdcfe;font-size:10px;background:#16232c;border:1px solid #244;border-radius:3px;padding:1px 5px}
.dv-detail .dv-sess{padding:3px 4px;border-bottom:1px solid #1a2226;display:flex;gap:6px;align-items:center}
.dv-detail .dv-sess .st{font-size:9px;border-radius:3px;padding:0 4px;white-space:nowrap}
.dv-detail .dv-sess .st.running{color:#4ec9b0;background:#13332b}
.dv-detail .dv-sess .st.awaiting{color:#d29922;background:#332a13}
.dv-detail .dv-sess .st.blocked{color:#f44;background:#3a1a1a}
.dv-detail .dv-sess .st.finished{color:#888;background:#222}
.dv-detail .dv-sess .tt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dv-detail .dv-acts{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
/* v4.7.0 · 单对话操作: 查看/下载ZIP/清理 + 多选合并 */
.dv-detail .dv-sess .dvc-chk{margin:0;cursor:pointer;flex:none}
.dv-detail .dv-sess .dvc-acts{display:flex;gap:3px;flex:none;opacity:.5;transition:opacity .15s}
.dv-detail .dv-sess:hover .dvc-acts{opacity:1}
.dvc-b{background:#16232c;color:#9cdcfe;border:1px solid #244;border-radius:3px;cursor:pointer;font-size:10px;line-height:1;padding:2px 5px}
.dvc-b:hover{background:#1e3340;border-color:#4ec9b0}
.dvc-b.dvc-b-s{color:#c87a7a;border-color:#4a2a2a;background:#2a1414}
.dvc-b.dvc-b-s:hover{background:#3a1a1a;border-color:#f44}
.dvc-bar{display:none;background:#16232c;border:1px solid #244;border-radius:4px;padding:3px 7px;margin:4px 0;font-size:10px;color:#9cdcfe;align-items:center;gap:6px;flex-wrap:wrap}
.dvc-bar.on{display:flex}
.dv-git{margin:5px 0;padding:5px 6px;background:#0d1a14;border:1px solid #1f3a2a;border-radius:4px}
.dv-git-h{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:5px}
.dv-git-tag{color:#4ec9b0;font-size:10px;font-weight:bold}
.dv-git-id{color:#9cdcfe;font-size:10px;background:#16232c;border:1px solid #244;border-radius:3px;padding:1px 5px}
.dv-git-meta{color:#888;font-size:10px}
.dv-git-meta.ok{color:#4ec9b0}
.dv-git-meta.no{color:#c87a7a}
.dv-git-acts{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.dv-git-pat{flex:1;min-width:120px;background:#0a0f0c;border:1px solid #2a3a2a;color:#cdd;border-radius:3px;padding:2px 6px;font-size:10px;font-family:monospace}
.dv-git-pat:focus{outline:none;border-color:#4ec9b0}
.dv-tb{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0;align-items:center}
.dv-tb-git{background:#0d1a14;border:1px solid #1f3a2a;border-radius:4px;padding:4px 6px}
.dv-stat-c{cursor:pointer;text-decoration:underline dotted #555}.dv-stat-c:hover{color:#9cdcfe;text-decoration-color:#9cdcfe}
.dv-board{margin:3px 0 5px;padding:4px 6px;background:#10151c;border:1px solid #243;border-radius:4px;max-height:160px;overflow:auto}
.dv-board-item{font-size:10px;color:#cdd;padding:2px 4px;border-bottom:1px solid #1c2530;display:flex;align-items:center;gap:5px}
.dv-board-item .bd-nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dv-board-item .dvc-chk{margin:0;flex:none;cursor:pointer}
.dv-board-item .bd-acts{display:flex;gap:3px;flex:none;opacity:.5;transition:opacity .15s}
.dv-board-item:hover .bd-acts{opacity:1}
.dv-board-empty{font-size:10px;color:#666}
.dv-board-bar{display:none;background:#16232c;border:1px solid #244;border-radius:4px;padding:2px 6px;margin:2px 0;font-size:10px;color:#9cdcfe;align-items:center;gap:5px;flex-wrap:wrap}
.dv-board-bar.on{display:flex}
.b.sk{background:transparent;color:#666;font-size:12px}.b.sk:hover{color:#f0c674}
.b.vf,.b.cp{background:#333;color:var(--blue)}.b.vf:hover,.b.cp:hover{background:#444}
.b.rm{background:transparent;color:#555;font-size:14px}.b.rm:hover{color:var(--red)}
.toast{position:fixed;bottom:8px;left:8px;right:8px;background:#264f78;color:var(--blue);padding:6px 10px;border-radius:4px;font-size:11px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:99}
.toast.show{opacity:1}
.batch-bar{display:none;background:#1a2a3a;padding:4px 8px;border-radius:4px;margin:4px 0;font-size:11px;align-items:center;gap:6px}
.batch-bar.visible{display:flex}
.batch-bar button{background:#5a1d1d;color:var(--red);border:none;padding:2px 10px;border-radius:3px;cursor:pointer;font-size:11px}
.monitor-bar{display:flex;align-items:center;gap:6px;background:#1a2a1a;border:1px solid #2a3a2a;border-radius:4px;padding:3px 8px;margin:4px 0;font-size:10px;color:var(--blue);flex-wrap:wrap}
.mon-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:none}
.mon-dot.off{background:#666;animation:none}
.mon-stat{padding:0 3px}
.mode-sw{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#666;float:right}
.mode-sw button{background:transparent;color:#555;border:1px solid #333;padding:1px 6px;border-radius:3px;cursor:pointer;font-size:10px;transition:all .15s}
.mode-sw button:hover{color:var(--blue);border-color:#555}
.mode-sw button.on{color:var(--green);border-color:#2a4a2a}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.live-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--green);margin:0 2px;animation:none}
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
.dv-trk-section{margin-top:7px;padding-top:6px;border-top:1px dashed #2a3a44}
.dv-trk-hd{font-size:10px;color:#9cdcfe;font-weight:600;margin-bottom:4px}
.dv-trk-hd .dv-trk-sep{color:#667;font-weight:400;font-size:9px}
.dv-trk-empty{font-size:10px;color:#778;padding:2px 0}
.dv-trk-sum{display:flex;align-items:center;gap:8px;font-size:10px;color:#aaa;padding:2px 0}
.dv-trk-sum .dv-trk-tag{color:#9cdcfe;font-weight:600}
.dv-trk-item{display:flex;align-items:center;gap:5px;padding:2px 0;font-size:10px}
.dv-trk-st{font-size:9px;font-weight:700;border-radius:3px;padding:0 4px;white-space:nowrap;flex-shrink:0}
.dv-trk-st.running{color:#4ec9b0;background:#13332b}
.dv-trk-st.awaiting{color:#d29922;background:#332a13}
.dv-trk-st.blocked{color:#f44;background:#3a1a1a}
.dv-trk-no{flex-shrink:0;min-width:13px;height:13px;line-height:13px;text-align:center;font-size:9px;font-weight:700;color:#9cdcfe;background:#1c2733;border:1px solid #2d4a63;border-radius:3px;padding:0 2px}
.dv-trk-who{color:#d7ba7d;flex-shrink:0;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dv-trk-x{margin-left:auto;flex-shrink:0;color:#777;font-size:10px;cursor:pointer;padding:0 3px;border-radius:3px;line-height:1.2}
.dv-trk-x:hover{color:#f44;background:#3a1a1a}
.dv-trk-go{flex-shrink:0;color:#888;font-size:11px;cursor:pointer;padding:0 3px;border-radius:3px;line-height:1.2}
.dv-trk-go:hover{color:#9cdcfe;background:#1f3a45}
.dv-trk-tt{color:#bbb;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cv-summary{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:11px}
.cv-summary b{margin-left:2px}
.cv-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.cv-dot.ok{background:#4ec9b0}
.cv-dot.stuck{background:#f0883e;animation:none}/* 异常纯橙·不呼吸(用户诉求) */
.cv-dot.off{background:#555}
@keyframes cvpulse{0%,100%{opacity:1}50%{opacity:.3}}
.cv-stuck-n{color:#f44}
.cv-err-n{color:#f88}
.cv-current{padding:3px 0;border-bottom:1px solid #2a2a2a}
.cv-no{display:inline-block;min-width:13px;height:13px;line-height:13px;text-align:center;font-size:9px;font-weight:700;color:#d7ba7d;background:#2a2418;border:1px solid #5a4a1e;border-radius:3px;padding:0 2px;margin-right:3px}
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
<div class="batch-bar" id="batchBar"><span>已选 <b id="batchCount">0</b> 个 · 点选中行 🔒锁/📋复制/×删/🖥IDE多实例/🌐浏览器多实例 批量</span><button onclick="batchDelete()">批量删除</button><button onclick="clearSelection()" style="background:#333;color:var(--blue)">取消</button></div>
<div class="add-section">
<div class="add-header" onclick="toggleAdd()"><span>&#43; 添加账号</span><span id="addArrow">${_uiAddOpen ? "&#9650;" : "&#9660;"}</span></div>
<div class="add-body${_uiAddOpen ? " open" : ""}" id="addBody">
<textarea id="addInput" placeholder="万法识号 v2.7 · 任意格式·一文混万法·自动识号：&#10;email password   /   email:password   /   email----password&#10;email|password   /   email,password   /   email\tpassword&#10;邮箱:x@y.com / 账号:x / 卡号1:x   (多行标签·支持数字编号·全角:也行)&#10;密码:abc123 / 卡密1:abc / 口令:abc   (含@亦无碍·守一不退)&#10;{&quot;email&quot;:&quot;x&quot;,&quot;password&quot;:&quot;y&quot;}   (JSON)&#10;devin-session-token$xxx / eyJ…JWT / auth1_…   (直接登录)&#10;微信发货消息原文亦可粘 (自动剥(去掉点)·跳订单/账号管理器)"></textarea>
<div class="add-actions"><button onclick="doAdd()">添加</button><button onclick="copyAll()" style="background:#333;color:var(--blue);margin-left:auto">&#128203; 一键导出</button></div>
<div class="add-hint">万法识号 v2.7 · 守道反者 · 卡号/卡密/微信发货/含@密码 皆通 · 原始 token 自动直登 · 重复邮箱·密码不同→改密重验·相同→跳过</div>
</div></div>
<div class="sec"><span>&#9660; 账号列表 (${stats.pwCount})</span></div>
<div class="dv-tb">
<button onclick="dvExportMd()" class="conv-btn" title="导出 MD 操作指令·复制给本地 Agent 即可后端驱动全部功能">&#128196; 导出 MD</button>
<button onclick="dvBackupAll()" class="conv-btn" title="备份所有(或已选)账号的全部 Devin Cloud 对话·增量">&#128190; 全部备份</button>
<button onclick="dvWipeSel()" class="conv-btn conv-btn-s" title="水过无痕·清理已选账号的全部 Devin Cloud 痕迹">&#127754; 批量清理</button>
<button onclick="dvCleanupNow()" class="conv-btn conv-btn-s" title="立即清理(参手机版·无模态): 对已选(无选→全部)账号 先全量备份→对话/账号整体归零→出库, 一气呵成">&#9889; 立即清理</button>
<button onclick="dvMigrateRoot()" class="conv-btn" title="迁移备份到数据盘: 把 C 盘旧备份整体搬到自动择优的数据盘(非系统盘·剩余最大), 之后默认落该盘·不压系统盘">&#128190;&#10141; 迁移到数据盘</button>
<label style="font-size:10px;color:#888;display:flex;align-items:center;gap:3px" title="开启后定时自动增量备份运行/更新过的对话"><input type="checkbox" id="dvAutoBk" ${_cfg("devinCloudAutoBackup", true) ? "checked" : ""} onchange="dvToggleAuto(this.checked)">自动备份</label>
<label style="font-size:10px;color:#888;display:flex;align-items:center;gap:3px" title="v4.4.0 · 默认开 · 备份完成且额度低于阈值时自动水过无痕清理"><input type="checkbox" id="dvAutoClean" ${_cfg("devinCloudAutoCleanup", true) ? "checked" : ""} onchange="dvToggleCleanup(this.checked)">自动清理</label>
<label style="font-size:10px;color:#888;display:flex;align-items:center;gap:3px" title="v4.9.12 · 默认开·归零移除闭环 · 额度完全归零的账号在全量备份+清理无残留后自动从账号库移除(不再显示). 取消勾选则仅清痕迹+本地留底,账号保留"><input type="checkbox" id="dvRmZero" ${_cfg("devinCloudAutoRemoveZeroQuota", true) ? "checked" : ""} onchange="dvToggleRemoveZero(this.checked)">归零移除</label>
<label style="font-size:9px;color:#888;display:flex;align-items:center;gap:2px" title="v4.4.0 · 额度低于此阈值($)时触发自动备份+清理">$<input type="number" id="dvThreshold" value="${_cfg("devinCloudAutoBackupThreshold", 3)}" min="0" step="1" style="width:30px;background:#1e1e1e;color:#ccc;border:1px solid #444;border-radius:3px;font-size:9px;padding:1px 2px" onchange="dvSetThreshold(this.value)"></label>
<label style="font-size:10px;color:#888;display:flex;align-items:center;gap:3px" title="v4.5.0 · 对话额度上限·知止不殆: 每对话上限=余额-缓冲·实时跟随余额; 余额≤停止阈值自动中停运行中对话"><input type="checkbox" id="dvConvCap" ${_cfg("devinCloudConvQuotaCap", true) ? "checked" : ""} onchange="dvToggleConvCap(this.checked)">对话上限</label>
<label style="font-size:9px;color:#888;display:flex;align-items:center;gap:2px" title="v4.5.0 · 对话上限缓冲($): 每对话上限=余额-此缓冲 (余额$70→上限$67)">缓冲$<input type="number" id="dvConvBuf" value="${_cfg("devinCloudConvQuotaBuffer", 3)}" min="0" step="0.01" style="width:34px;background:#1e1e1e;color:#ccc;border:1px solid #444;border-radius:3px;font-size:9px;padding:1px 2px" onchange="dvSetConvBuffer(this.value)"></label>
<label style="font-size:10px;color:#888;display:flex;align-items:center;gap:3px" title="v4.7.3 · 耗尽自动重置·将欲予之必故予之: 余额抵缓冲(上限本将归0)时不困住这笔钱, 反向把上限抬回剩余余额, 让美金真正用尽; 仅余额≤抽干地板才最终中停"><input type="checkbox" id="dvConvDrain" ${_cfg("devinCloudConvDrainToZero", true) ? "checked" : ""} onchange="dvToggleDrain(this.checked)">耗尽重置</label>
<select style="font-size:9px;background:#1e1e1e;color:#888;border:1px solid #444;border-radius:3px;padding:1px 2px" title="v4.4.0 · 备份模式: folder=文件夹(HTML/MD·推荐) zip=传统ZIP" onchange="dvSetMode(this.value)"><option value="folder" ${_cfg("devinCloudBackupMode", "folder") === "folder" ? "selected" : ""}>文件夹</option><option value="zip" ${_cfg("devinCloudBackupMode", "folder") === "zip" ? "selected" : ""}>ZIP</option></select>
</div>
<div class="dv-tb dv-tb-git" title="多个 Devin 账号归一连接到同一个 GitHub：先勾选账号，再点批量连Git">
<span class="dv-git-tag">&#128279; 批量归一</span>
<input class="dv-git-pat" id="gitBatchPat" type="password" placeholder="批量 PAT (留空→各账号默认/映射)" autocomplete="off" style="max-width:200px"/>
<button onclick="gitBatchConnect()" class="conv-btn" title="把勾选的多个 Devin 账号全部连接到同一个 GitHub（同一 PAT 注入+落库密钥+核验）">&#128279; 批量连Git</button>
<button onclick="gitBatchDisconnect()" class="conv-btn conv-btn-s" title="真解绑勾选账号的 Git 连接（复查扫除·连接归零·删密钥）">&#9986; 批量断Git</button>
<button onclick="gitInjectPatAll()" class="conv-btn" title="PAT 反向注入: 把上面 PAT 框的 PAT 作为 GITHUB_PAT 密钥写入「全部账号」(若已勾选则仅勾选账号)·写后双读确认·dao-vsix 1.3.3 同源">&#128273; PAT注密钥</button>
<span style="font-size:10px;color:#888">勾选→多 Devin 绑同一 GitHub</span>
</div>
<div id="list" style="contain:layout style paint">${rows}</div>
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
function _persistScroll(){try{const st=vscode.getState()||{};const y=(document.scrollingElement||document.documentElement).scrollTop||0;vscode.setState({...st,__scrollY:y});}catch(e){}}
let _scrT=null;window.addEventListener('scroll',()=>{if(_scrT)clearTimeout(_scrT);_scrT=setTimeout(_persistScroll,150);},{passive:true});
(function(){try{const st=vscode.getState()||{};const y=+st.__scrollY||0;if(y>0)requestAnimationFrame(()=>{(document.scrollingElement||document.documentElement).scrollTop=y;});}catch(e){}})();
function _persistSel(){try{const st=vscode.getState()||{};const emails=[...document.querySelectorAll('.chk:checked')].map(c=>{const r=c.closest('.row');return r&&r.dataset.email||'';}).filter(Boolean);vscode.setState({...st,selEmails:emails,selTs:Date.now()});}catch(e){}}
function _restoreSel(){try{const st=vscode.getState()||{};const arr=Array.isArray(st.selEmails)?st.selEmails:[];if(!arr.length)return;const ttl=600000;if(st.selTs&&Date.now()-st.selTs>ttl){vscode.setState({...st,selEmails:[],selTs:0});return;}const set=new Set(arr);document.querySelectorAll('.row').forEach(r=>{const em=(r.dataset.email||'').toLowerCase();if(em&&set.has(em)){const c=r.querySelector('.chk');if(c){c.checked=true;r.classList.add('sel');}}});}catch(e){}}
let _lastSel=-1,_dragSel=false,_dragVal=false;
function sw(i){_clickFb(event);send('switch',i);}
function sk(i){_clickFb(event);const b=event&&event.target&&event.target.closest('.sk');const locked=!(b&&b.dataset.locked==='1');vscode.postMessage({type:'setSkipBatch',indices:_selectedFor(i),locked:locked});}
function vf(i){_clickFb(event);send('verify',i);}
function cp(i){_clickFb(event);const ix=_selectedFor(i);vscode.postMessage({type:ix.length>1?'copyAccounts':'copyAccount',index:i,indices:ix});}
function rt(i){_clickFb(event);const ix=_selectedFor(i);if(ix.length>1){showToast('\u23F3 \u6279\u91cf\u8def\u7531\u5b98\u7f51\u2192IDE \u00b7 '+ix.length+' \u4e2a\u2026');vscode.postMessage({type:'routeToIdeBatch',indices:ix});}else{showToast('\u23F3 \u5207\u6b64\u53f7\u00b7\u8def\u7531\u5b98\u7f51\u2192IDE\u2026');vscode.postMessage({type:'routeToIde',index:i});}}
function sb(i){_clickFb(event);const ix=_selectedFor(i);if(ix.length>1){showToast('\u23F3 \u6279\u91cf\u7cfb\u7edf\u6d4f\u89c8\u5668 \u00b7 '+ix.length+' \u4e2a\u2026');vscode.postMessage({type:'openSysBrowserBatch',indices:ix});}else{vscode.postMessage({type:'openSysBrowser',index:i});}}
function _emailAt(i){const r=document.querySelector('.row[data-i="'+i+'"]');return (r&&r.dataset.email)||'';}
function rm(i){_clickFb(event);const ix=_selectedFor(i);if(ix.length>1)vscode.postMessage({type:'removeBatch',indices:ix,emails:ix.map(_emailAt)});else vscode.postMessage({type:'remove',index:i,email:_emailAt(i)});}
function copyAll(){vscode.postMessage({type:'copyAllAccounts'});}
function setMode(m){vscode.postMessage({type:'setMode',mode:m});}
// ── 第五板块 · Devin Cloud 前端 (最小化) ──
function _dvOpenSet(){try{return new Set((vscode.getState()||{}).dvOpen||[]);}catch(e){return new Set();}}
function _dvSaveOpen(s){try{const st=vscode.getState()||{};vscode.setState({...st,dvOpen:[...s]});}catch(e){}}
function dv(i){_clickFb(event);const d=document.getElementById('dvDetail'+i);if(!d)return;const em=(d.dataset.email||'');const open=_dvOpenSet();if(d.classList.contains('open')){d.classList.remove('open');d.innerHTML='';open.delete(em);_dvSaveOpen(open);vscode.postMessage({type:'dvCollapse',index:i});return;}d.classList.add('open');if(!d.innerHTML.trim())d.innerHTML='<span style="color:#888">登录并拉取 Devin Cloud 概览…</span>';open.add(em);_dvSaveOpen(open);vscode.postMessage({type:'devinExpand',index:i});}
function gitConnect(i){_clickFb(event);const el=document.getElementById('gitPat'+i);const pat=el?el.value.trim():'';vscode.postMessage({type:'gitConnect',index:i,pat:pat});if(el)el.value='';}
function gitDisconnect(i){_clickFb(event);vscode.postMessage({type:'gitDisconnect',index:i});}
function wp(i){_clickFb(event);const ix=_selectedFor(i);vscode.postMessage({type:'devinWipe',index:i,indices:ix});}
function dvBackup(i){vscode.postMessage({type:'devinBackupAccount',index:i});}
function dvCreate(i){vscode.postMessage({type:'devinCreateSession',index:i});}
function dvBrowse(){vscode.postMessage({type:'devinBrowseBackups'});}
function dvUnlock(p){vscode.postMessage({type:'devinUnlockBackup',zipPath:p});}
function dvViewConv(p){vscode.postMessage({type:'devinViewBackupConv',path:p});}
function dvReveal(p){vscode.postMessage({type:'devinRevealPath',path:p});}
function dvCloseBk(){const o=document.getElementById('dvBkOverlay');if(o)o.remove();}
function dvSetTag(i){vscode.postMessage({type:'devinSetTag',index:i});}
function dvExportMd(){vscode.postMessage({type:'devinExportMd',indices:_selIx()});}
function dvBackupAll(){vscode.postMessage({type:'devinBackupAll',indices:_selIx()});}
function dvWipeSel(){const ix=_selIx();if(!ix.length){showToast('\\u2717 先勾选账号');return;}vscode.postMessage({type:'devinWipe',indices:ix});}
/* 立即清理(参手机版): 对已选(无选→全部)账号一键 先备份→对话/账号整体归零→出库, 全程 toast 无模态 · 道法自然 */
function dvCleanupNow(){const ix=_selIx();showToast('\\u23F3 立即清理: 先备份再归零'+(ix.length?(' · 已选'+ix.length):' · 全部'));vscode.postMessage({type:'devinCleanupImmediate',indices:ix});}
function dvCleanupNowOne(i){_clickFb(event);showToast('\\u23F3 立即清理本账号: 先备份再归零');vscode.postMessage({type:'devinCleanupImmediate',indices:[i]});}
/* 迁移备份到数据盘: 把 C: 旧备份整体搬到自动择优的数据盘, 之后默认落该盘 */
function dvMigrateRoot(){showToast('\\u23F3 迁移备份到数据盘…');vscode.postMessage({type:'devinMigrateBackupRoot'});}
/* v4.7.0 · 单对话多选(支持 Shift 区间) + 查看/下载ZIP/清理 */
let _dvcLast={};
function _dvcChks(i){return [...document.querySelectorAll('.dvc-chk[data-i="'+i+'"]')];}
function dvcSel(ev,i){const chks=_dvcChks(i);const cur=ev&&ev.target?chks.indexOf(ev.target):-1;if(ev&&ev.shiftKey&&_dvcLast[i]!=null&&cur>=0){const a=Math.min(cur,_dvcLast[i]),b=Math.max(cur,_dvcLast[i]);const on=ev.target.checked;for(let k=a;k<=b;k++)chks[k].checked=on;}if(cur>=0)_dvcLast[i]=cur;_dvcSync(i);}
function _dvcSync(i){const n=_dvcChks(i).filter(c=>c.checked).length;const bar=document.getElementById('dvcBar'+i);const cnt=document.querySelector('.dvc-cnt[data-i="'+i+'"]');if(cnt)cnt.textContent=n;if(bar)bar.classList.toggle('on',n>0);}
function _dvcIds(i){return _dvcChks(i).filter(c=>c.checked).map(c=>c.dataset.did);}
function dvcClear(i){_dvcChks(i).forEach(c=>c.checked=false);_dvcLast[i]=null;_dvcSync(i);}
function dvConvDetail(i,did){showToast('\u23F3 拉取对话详情…');vscode.postMessage({type:'dvConvDetail',index:i,devinId:did});}
function dvConvZip(i,did){showToast('\u23F3 打包对话 ZIP…');vscode.postMessage({type:'dvConvZip',index:i,devinId:did});}
function dvConvDel(i,did){vscode.postMessage({type:'dvConvDel',index:i,devinId:did});}
function dvConvZipBatch(i){const ids=_dvcIds(i);if(!ids.length){showToast('\u2717 先勾选对话');return;}showToast('\u23F3 合并打包 '+ids.length+' 个对话…');vscode.postMessage({type:'dvConvZipBatch',index:i,devinIds:ids});}
function dvConvDelBatch(i){const ids=_dvcIds(i);if(!ids.length){showToast('\u2717 先勾选对话');return;}vscode.postMessage({type:'dvConvDelBatch',index:i,devinIds:ids});}
/* v4.9.6 · C: 本地对话拉取(已清零号) — 切换显示 + 请求本账号本地备份清单 */
function dvLocalConvs(i){const c=document.getElementById('dvLocal'+i);if(!c)return;if(c.style.display!=='none'&&c.innerHTML.trim()){c.style.display='none';return;}c.style.display='block';c.innerHTML='<span style="color:#888;font-size:11px">\u8bfb\u53d6\u672c\u5730\u5907\u4efd\u2026</span>';vscode.postMessage({type:'dvLocalConvs',index:i});}
document.addEventListener('click',function(e){const t=e.target;if(!t||!t.closest)return;const v=t.closest('.dv-localview');if(v&&v.dataset.path){e.preventDefault();vscode.postMessage({type:'devinViewBackupConv',path:v.dataset.path});return;}const r=t.closest('.dv-localreveal');if(r&&r.dataset.path){e.preventDefault();vscode.postMessage({type:'devinRevealPath',path:r.dataset.path});return;}});
/* 追踪行按钮改 pointerdown 委派 — 根治第一行(运行中对话)点不动: convUpdate 在 mousedown→mouseup 间 replaceWith 重建 DOM → click 不再触发; pointerdown 先于重建到达 */
document.addEventListener('pointerdown',function(e){if(e.button!==0&&e.pointerType==='mouse')return;const t=e.target;if(!t||!t.closest)return;
  const x=t.closest('.dv-trk-x');if(x&&x.dataset.id){e.preventDefault();e.stopPropagation();const it=x.closest('.dv-trk-item');if(it)it.style.display='none';vscode.postMessage({type:'dvUntrackConv',id:x.dataset.id});return;}
  const g=t.closest('.dv-trk-go');if(!g)return;
  if(g.dataset.batch){e.preventDefault();e.stopPropagation();if(g.dataset.batch==='clr')_trkClear();else trkBatch(g.dataset.batch);return;}
  if(g.dataset.act){e.preventDefault();e.stopPropagation();const em=g.dataset.email||'';const did=g.dataset.did||'';if(g.dataset.act==='convRt'){showToast('\u23F3 \u6b64\u5bf9\u8bdd\u2192IDE\u591a\u5b9e\u4f8b\u2026');vscode.postMessage({type:'convRouteToIde',email:em,devinId:did});}else if(g.dataset.act==='convSb'){showToast('\u23F3 \u6b64\u5bf9\u8bdd\u2192\u6d4f\u89c8\u5668\u591a\u5b9e\u4f8b\u2026');vscode.postMessage({type:'convOpenSysBrowser',email:em,devinId:did});}return;}});
/* 追踪行多选(Shift 区间) + 批量 IDE/网页/取消追踪 — 选择持久化跨 convUpdate 重建 */
let _trkLastCk=null;
function _trkCks(){return [...document.querySelectorAll('.dv-trk-ck')];}
function _trkSync(){const n=_trkCks().filter(c=>c.checked).length;const b=document.getElementById('trkBar');if(b)b.style.display=n?'inline-flex':'none';const c=document.getElementById('trkCnt');if(c)c.textContent=n;}
function _trkPersist(){try{const st=vscode.getState()||{};vscode.setState({...st,trkSel:_trkCks().filter(c=>c.checked).map(c=>c.dataset.did),trkTs:Date.now()});}catch(e){}}
function _trkRestore(){try{const st=vscode.getState()||{};const arr=Array.isArray(st.trkSel)?st.trkSel:[];if(!arr.length)return;if(st.trkTs&&Date.now()-st.trkTs>600000)return;const s=new Set(arr);_trkCks().forEach(c=>{if(s.has(c.dataset.did))c.checked=true;});_trkSync();}catch(e){}}
function trkSel(ev){const cks=_trkCks();const cur=ev&&ev.target?cks.indexOf(ev.target):-1;if(ev&&ev.shiftKey&&_trkLastCk!=null&&cur>=0){const a=Math.min(cur,_trkLastCk),b=Math.max(cur,_trkLastCk),on=ev.target.checked;for(let k=a;k<=b;k++)cks[k].checked=on;}if(cur>=0)_trkLastCk=cur;_trkSync();_trkPersist();}
function _trkClear(){_trkCks().forEach(c=>c.checked=false);_trkLastCk=null;_trkSync();_trkPersist();}
function trkBatch(act){const cks=_trkCks().filter(c=>c.checked);if(!cks.length){showToast('\u2717 先勾选对话');return;}for(const c of cks){const em=c.dataset.email||'',did=c.dataset.did||'';if(act==='rt')vscode.postMessage({type:'convRouteToIde',email:em,devinId:did});else if(act==='sb')vscode.postMessage({type:'convOpenSysBrowser',email:em,devinId:did});else if(act==='x'){const it=c.closest('.dv-trk-item');if(it)it.style.display='none';vscode.postMessage({type:'dvUntrackConv',id:did});}}showToast((act==='x'?'已批量取消追踪 ':'\u23F3 批量打开 ')+cks.length+' 个');if(act==='x')_trkClear();}
try{_trkRestore();}catch(e){}
/* v4.7.0 · 知识库/剧本/密钥 多选(Shift) + 查看/下载/删除 + 批量 */
let _bdLast={};
function _bdChks(i,k){return [...document.querySelectorAll('.bd-chk[data-i="'+i+'"][data-k="'+k+'"]')];}
function dvBoardSel(ev,i,k){const chks=_bdChks(i,k);const cur=ev&&ev.target?chks.indexOf(ev.target):-1;const kk=i+'|'+k;if(ev&&ev.shiftKey&&_bdLast[kk]!=null&&cur>=0){const a=Math.min(cur,_bdLast[kk]),b=Math.max(cur,_bdLast[kk]);const on=ev.target.checked;for(let j=a;j<=b;j++)chks[j].checked=on;}if(cur>=0)_bdLast[kk]=cur;_bdSync(i,k);}
function _bdSync(i,k){const n=_bdChks(i,k).filter(c=>c.checked).length;const bar=document.getElementById('bdBar'+i+k);const cnt=document.querySelector('.bd-cnt[data-i="'+i+'"][data-k="'+k+'"]');if(cnt)cnt.textContent=n;if(bar)bar.classList.toggle('on',n>0);}
function _bdIds(i,k){return _bdChks(i,k).filter(c=>c.checked).map(c=>c.dataset.id);}
function dvBoardClear(i,k){_bdChks(i,k).forEach(c=>c.checked=false);_bdLast[i+'|'+k]=null;_bdSync(i,k);}
function dvBoardAct(i,k,id,act){if(act==='delete'){vscode.postMessage({type:'dvBoardDelete',index:i,boardKey:k,id:id});}else if(act==='view'){showToast('\u23F3 拉取内容…');vscode.postMessage({type:'dvBoardView',index:i,boardKey:k,id:id});}else if(act==='download'){showToast('\u23F3 下载…');vscode.postMessage({type:'dvBoardDownload',index:i,boardKey:k,id:id});}}
function dvBoardBatch(i,k,act){const ids=_bdIds(i,k);if(!ids.length){showToast('\u2717 先勾选');return;}if(act==='delete'){vscode.postMessage({type:'dvBoardDeleteBatch',index:i,boardKey:k,ids:ids});}else{showToast('\u23F3 批量下载 '+ids.length+' 项…');vscode.postMessage({type:'dvBoardDownloadBatch',index:i,boardKey:k,ids:ids});}}
function dvToggleAuto(on){vscode.postMessage({type:'devinToggleAuto',on:!!on});}
function dvToggleCleanup(on){vscode.postMessage({type:'devinToggleCleanup',on:!!on});}
function dvToggleRemoveZero(on){vscode.postMessage({type:'devinToggleRemoveZero',on:!!on});}
function dvSetThreshold(v){vscode.postMessage({type:'devinSetThreshold',value:+v});}
function dvToggleConvCap(on){vscode.postMessage({type:'devinToggleConvCap',on:!!on});}
function dvSetConvBuffer(v){vscode.postMessage({type:'devinSetConvBuffer',value:+v});}
function dvToggleDrain(on){vscode.postMessage({type:'devinToggleDrain',on:!!on});}
function dvSetMode(v){vscode.postMessage({type:'devinSetMode',value:v});}
function dvTog(id){const e=document.getElementById(id);if(e)e.style.display=(e.style.display==='none'||!e.style.display)?'block':'none';}
function gitBatchConnect(){const ix=_selIx();if(!ix.length){showToast('\u2717 \u8bf7\u5148\u52fe\u9009\u8d26\u53f7','fail');return;}const el=document.getElementById('gitBatchPat');const pat=el?el.value:'';vscode.postMessage({type:'gitConnectBatch',indices:ix,pat:pat});}
function gitBatchDisconnect(){const ix=_selIx();if(!ix.length){showToast('\u2717 \u8bf7\u5148\u52fe\u9009\u8d26\u53f7','fail');return;}vscode.postMessage({type:'gitDisconnectBatch',indices:ix});}
/* v4.7.2 · PAT 反向注入: PAT→GITHUB_PAT 密钥, 写入全部(或勾选)账号 */
function gitInjectPatAll(){const el=document.getElementById('gitBatchPat');const pat=el?el.value.trim():'';if(!pat){showToast('\u2717 \u5148\u5728\u6279\u91cfPAT\u6846\u586b ghp_\u2026','fail');return;}const ix=_selIx();showToast('\u23F3 PAT \u6ce8\u5165\u5bc6\u94a5 '+(ix.length?ix.length+' \u4e2a\u52fe\u9009':'\u5168\u90e8')+'\u8d26\u53f7\u2026');vscode.postMessage({type:'gitInjectSecretBatch',indices:ix,pat:pat});}
function toggleConv(){const b=document.getElementById('convBody');if(!b)return;b.classList.toggle('collapsed');const arr=document.getElementById('convArrow');const ic=b.classList.contains('collapsed');if(arr)arr.textContent=ic?'\u25BC':'\u25B2';try{localStorage.setItem('dao-conv-collapsed',ic?'1':'0');}catch(e){}}
function doSetBackupDir(){vscode.postMessage({type:'selectBackupDir'});}
function doSetDevinBackupDir(){vscode.postMessage({type:'devinSelectBackupDir'});}
// v3.7.5+3.7.6 · 对话手动关闭 · 反者道之动 · 即时本地消除+持久化
// v4.8.0 · Cascade 同款两段式: 一次点 X = 8s 内可二次确认; 二次点 X = 永久取消追踪 · 永不复现
//   未二次点击 → 8s 后落 10min 静默 (旧行为)。反者道之动 · 用户主权终态
function dismissConv(uuid){
  if(!uuid)return;
  const btn=document.querySelector('.cv-close[data-uuid="'+uuid+'"]');
  if(!btn){vscode.postMessage({type:'dismissConv',uuid:uuid});return;}
  const item=btn.closest('.cv-stuck-item')||btn.closest('.cv-current');
  if(btn.getAttribute('data-armed')==='1'){
    if(btn._t){clearTimeout(btn._t);btn._t=null;}
    if(item)item.remove();
    showToast('\u2713 \u5df2\u6c38\u4e45\u53d6\u6d88\u8ffd\u8e2a\u6b64\u5bf9\u8bdd');
    vscode.postMessage({type:'dismissConv',uuid:uuid,permanent:true});
    return;
  }
  btn.setAttribute('data-armed','1');
  btn.style.color='#e5a';btn.style.fontWeight='bold';
  btn.title='\u518d\u70b9\u4e00\u6b21 = \u6c38\u4e45\u53d6\u6d88\u8ffd\u8e2a (8\u79d2\u5185)';
  if(item)item.style.opacity='0.5';
  showToast('\u518d\u70b9\u4e00\u6b21X=\u6c38\u4e45\u53d6\u6d88\u8ffd\u8e2a\uff0c\u5426\u52198s\u540e\u9759\u9ed810min');
  btn._t=setTimeout(function(){
    btn.removeAttribute('data-armed');btn.style.color='';btn.style.fontWeight='';
    if(item)item.remove();
    vscode.postMessage({type:'dismissConv',uuid:uuid});
  },8000);
}
function toggleAdd(){const b=document.getElementById('addBody');b.classList.toggle('open');const isOpen=b.classList.contains('open');document.getElementById('addArrow').textContent=isOpen?'\\u25B2':'\\u25BC';const s=vscode.getState()||{};vscode.setState({...s,addOpen:isOpen});vscode.postMessage({type:'setAddOpen',open:isOpen});}
function doAdd(){const ta=document.getElementById('addInput');const t=ta.value.trim();if(!t)return;vscode.postMessage({type:'addBatch',text:t});ta.value='';const s=vscode.getState()||{};vscode.setState({...s,addText:''});}
function showToast(m,cls){const t=document.getElementById('toast');t.textContent=m;t.className='toast show'+(cls?' '+cls:'');setTimeout(()=>{t.className='toast';},2200);}
function updateBatchBar(){_refreshSelClasses();const c=_checked();document.getElementById('batchCount').textContent=c.length;document.getElementById('batchBar').classList.toggle('visible',c.length>0);_persistSel();}
function batchDelete(){const ix=_selIx();if(ix.length===0)return;vscode.postMessage({type:'removeBatch',indices:ix,emails:ix.map(_emailAt)});}
function clearSelection(){document.querySelectorAll('.chk:checked').forEach(c=>{c.checked=false;const r=c.closest('.row');if(r)r.classList.remove('sel');});updateBatchBar();}
function _hitSel(e){return e&&e.target&&e.target.closest&&e.target.closest('.row');}
function _startSelect(e){const row=_hitSel(e);if(!row||e.target.closest('.acts,.b,button,textarea,a'))return;if(e.target.matches('input:not(.chk),select'))return;const i=parseInt(row.dataset.i);const c=row.querySelector('.chk');if(!Number.isFinite(i)||!c)return;e.preventDefault();const v=!c.checked;if(e.shiftKey&&_lastSel>=0)_applyRange(_lastSel,i,v);else{_setRowSel(i,v);_lastSel=i;}_dragSel=true;_dragVal=v;updateBatchBar();}
document.addEventListener('mousedown',e=>{if(e.button!==0)return;_startSelect(e);});
document.addEventListener('click',e=>{if(e.target.classList&&e.target.classList.contains('chk'))e.preventDefault();},true);
document.addEventListener('mouseover',e=>{if(!_dragSel)return;const row=_hitSel(e);if(!row)return;const i=parseInt(row.dataset.i);if(!Number.isFinite(i))return;_setRowSel(i,_dragVal);updateBatchBar();});
document.addEventListener('mouseup',()=>{_dragSel=false;});
document.addEventListener('change',e=>{if(e.target.classList.contains('chk')){const i=parseInt(e.target.dataset.i);if(Number.isFinite(i))_lastSel=i;updateBatchBar();}});
// v4.9.6 · 滚动位置持久化 — 根治 _broadcastUI 全量重建后回弹到顶("回主页"). 守柔: 程序复位期不计为用户滚动.
// v4.9.7 · F2/F3: 增量更新去抖签名 — 状态/对话区每轮轮询若内容未变则不动 DOM, 根治"一刷新就闪/跳/回弹".
// 道法自然 · resize 节流: 拖拽期暂停动画+强化 contain, 释放后恢复 · 根治大数据量面板拖拽卡顿
let _resizeT;
window.addEventListener('resize',function(){document.body.classList.add('resizing');clearTimeout(_resizeT);_resizeT=setTimeout(function(){document.body.classList.remove('resizing');},150);},{passive:true});
let _scrTimer=null,_scrRestoring=false,_lastConvHtml='',_lastConvSig='',_lastRunKey='';
function _saveScroll(){if(_scrRestoring)return;try{const el=document.scrollingElement||document.documentElement;const st=vscode.getState()||{};vscode.setState({...st,scrollTop:el.scrollTop|0});}catch(e){}}
window.addEventListener('scroll',function(){if(_scrRestoring)return;if(_scrTimer)clearTimeout(_scrTimer);_scrTimer=setTimeout(_saveScroll,100);},{passive:true});
function _restoreScroll(){try{const st=vscode.getState()||{};const y=st.scrollTop|0;if(y<=0)return;const el=document.scrollingElement||document.documentElement;_scrRestoring=true;const ap=function(){el.scrollTop=y;};ap();requestAnimationFrame(ap);setTimeout(ap,80);setTimeout(function(){ap();_scrRestoring=false;},240);}catch(e){_scrRestoring=false;}}
_restoreScroll();
(function(){const s=vscode.getState()||{};if(s.addText){const ta=document.getElementById('addInput');if(ta)ta.value=s.addText;}const ta=document.getElementById('addInput');if(ta)ta.addEventListener('input',function(){const st=vscode.getState()||{};vscode.setState({...st,addText:this.value});});
// v3.11.2 · 多选持久化复位 — 重建后立即按 email 恢复 checked + .sel + batchBar 计数
try{_restoreSel();updateBatchBar();}catch(e){}
// 第五板块: 重建后自动重开之前展开的 Devin Cloud 下拉 + 请求运行状态
try{const op=_dvOpenSet();document.querySelectorAll('.dv-detail').forEach(d=>{const em=(d.dataset.email||'');if(op.has(em)){const i=parseInt(d.dataset.i);if(Number.isFinite(i)){d.classList.add('open');if(!d.innerHTML.trim())d.innerHTML='<span style="color:#888">拉取 Devin Cloud 概览…</span>';vscode.postMessage({type:'devinExpand',index:i});}}});vscode.postMessage({type:'devinRunPoll'});}catch(e){}
// Fix4: 恢复 conv 区块 collapsed 状态
try{if(localStorage.getItem('dao-conv-collapsed')==='1'){const cb=document.getElementById('convBody');const ca=document.getElementById('convArrow');if(cb){cb.classList.add('collapsed');if(ca)ca.textContent='\u25BC';}}}catch(e){}})();
window.addEventListener('message',e=>{const m=e.data;
if(m.type==='toast'){const cls=m.text&&m.text.startsWith('\\u2713')?'ok':m.text&&m.text.startsWith('\\u2717')?'fail':'';showToast(m.text,cls);}
if(m.type==='switching'){const r=document.querySelector('.row[data-i=\"'+m.index+'\"]');if(r){r.classList.add('switching');showToast('\\u26A1 \\u5207\\u6362\\u4E2D...');}}
if(m.type==='verifying'){const r=document.querySelector('.row[data-i=\"'+m.index+'\"]');if(r){r.classList.add('verifying');}}
if(m.type==='quotaChange'){const r=document.querySelector('.row[data-email=\"'+(m.email||'').toLowerCase()+'\"]');if(r){r.classList.add('quota-flash');setTimeout(()=>r.classList.remove('quota-flash'),700);}}
if(m.type==='devinOverview'){const d=document.getElementById('dvDetail'+m.index);if(d&&d.classList.contains('open')){d.innerHTML=m.html||'';}}
if(m.type==='gitDone'){const d=document.getElementById('dvDetail'+m.index);if(d&&d.classList.contains('open')){vscode.postMessage({type:'devinExpand',index:m.index,refresh:true});}}
if(m.type==='gitBatchDone'){document.querySelectorAll('.dv-detail.open').forEach(d=>{const i=parseInt(d.getAttribute('data-i'));if(Number.isFinite(i))vscode.postMessage({type:'devinExpand',index:i,refresh:true});});}
if(m.type==='devinRunStatus'&&Array.isArray(m.items)){const _rk=JSON.stringify(m.items);if(_rk===_lastRunKey)return;_lastRunKey=_rk;document.querySelectorAll('.dv-run').forEach(el=>{el.querySelectorAll('.run,.awa,.blk').forEach(x=>x.remove());});m.items.forEach(it=>{const el=document.querySelector('.dv-run[data-email="'+(it.email||'').toLowerCase()+'"]');if(!el)return;const tip=(it.titles||[]).join(' | ');const mk=(cls,txt,n)=>{if(!(n>0))return;const s=document.createElement('span');s.className=cls;s.textContent=txt+n;s.title=tip;el.insertBefore(s,el.firstChild);};mk('blk','\\u25CF 卡住',it.blocked);mk('awa','\\u25CF 待输入',it.awaiting);mk('run','\\u25CF 运行',it.running);});}
if(m.type==='devinConvCap'&&Array.isArray(m.items)){m.items.forEach(it=>{const sp=document.querySelector('.dv-stat[data-capemail="'+(it.email||'').toLowerCase()+'"]');if(sp){const c=(typeof it.cap==='number')?it.cap.toFixed(2):'\\u2014';sp.textContent='\\u5bf9\\u8bdd\\u4e0a\\u9650 $'+c+(it.drain?' \\u00b7\\u62bd\\u5e72\\u4e2d':'')+(it.inUse?' \\u00b7\\u4f7f\\u7528\\u4e2d':'');sp.style.color=it.drain?'#dcaa55':(it.inUse?'#4ec9b0':'');}});}
if(m.type==='convUpdate'&&m.html){const _sig=(m.sig!=null?m.sig:m.html);if(_sig===_lastConvSig)return;_lastConvSig=_sig;_lastConvHtml=m.html;const old=document.querySelector('.conv-section');if(old){const ic=!!(old.querySelector('.conv-body')&&old.querySelector('.conv-body').classList.contains('collapsed'));const tmp=document.createElement('div');tmp.innerHTML=m.html;const nw=tmp.querySelector('.conv-section');if(nw){const el=document.scrollingElement||document.documentElement;const _y=el?el.scrollTop|0:0;old.replaceWith(nw);if(ic){const nb=nw.querySelector('.conv-body');const na=nw.querySelector('#convArrow');if(nb){nb.classList.add('collapsed');if(na)na.textContent='\u25BC';}}if(el&&_y>0&&el.scrollTop!==_y){el.scrollTop=_y;requestAnimationFrame(()=>{el.scrollTop=_y;});}try{_trkRestore();}catch(e){}}}}
if(m.type==='devinBackupTree'){_dvShowBackups(m.tree);}
if(m.type==='dvLocalConvList'){const c=document.getElementById('dvLocal'+m.index);if(c){c.style.display='block';c.innerHTML=m.html||'';}}
});
function _dvShowBackups(tree){
  const _esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const _attr=s=>_esc(s).replace(/"/g,'&quot;');
  let ov=document.getElementById('dvBkOverlay');if(ov)ov.remove();
  ov=document.createElement('div');ov.id='dvBkOverlay';
  ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 0;';
  const box=document.createElement('div');
  box.style.cssText='background:#1e1e1e;border:1px solid #444;border-radius:8px;max-width:92%;width:760px;max-height:88%;overflow:auto;padding:14px 18px;';
  let html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;position:sticky;top:0;background:#1e1e1e;padding-bottom:6px;z-index:1"><b>📁 Devin Cloud 备份浏览</b><button class="conv-btn conv-btn-s" onclick="dvCloseBk()">✕ 关闭</button></div>';
  if(!tree||!tree.accounts||!tree.accounts.length){
    html+='<div style="color:#888">暂无备份。先用「导出全部对话」备份。</div>';
  }else{
    html+='<div style="color:#888;font-size:11px;margin-bottom:8px">'+_esc(tree.root||'')+'</div>';
    for(const a of tree.accounts){
      const no=a.accountNo?('<span style="background:#2ea043;color:#fff;border-radius:4px;padding:1px 7px;font-weight:700;margin-right:6px">#'+a.accountNo+'</span>'):'';
      html+='<div style="margin-top:12px;padding-top:8px;border-top:1px solid #444">'+no+'<b>'+_esc(a.email||a.account)+'</b> <span style="color:#888">('+a.count+' 条对话)</span>';
      if(a.account&&a.account!==a.email){html+=' <span style="color:#666;font-size:11px">'+_esc(a.account)+'</span>';}
      if(a.hasAccountInfo){html+=' <button class="conv-btn conv-btn-s" onclick="dvReveal(this.dataset.p)" data-p="'+_attr(a.accountInfoPath)+'">📂 账号信息</button>';}
      html+='</div>';
      if(!a.conversations.length){html+='<div style="color:#666;font-size:12px;padding:4px 0">(无对话记录)</div>';}
      var _allConv=(a.conversations||[]).slice().sort(function(x,y){return (y.mtime||0)-(x.mtime||0);});
      var _CONV_CAP=50;var _convShow=_allConv.slice(0,_CONV_CAP);
      for(let i=0;i<_convShow.length;i++){
        const c=_convShow[i];
        const n=c.num||(i+1);
        const label=c.title||c.name;
        let meta;
        if(c.type==='zip'){meta='<span style="color:#666">'+(c.size?((c.size/1024).toFixed(0)+'KB'):'ZIP')+'</span>';}
        else{meta='<span style="color:#666">'+(c.eventCount||0)+' 事件</span>';}
        let actions='';
        if(c.type==='folder'){
          if(c.hasHtml){actions+='<button class="conv-btn conv-btn-s" onclick="dvViewConv(this.dataset.p)" data-p="'+_attr(c.htmlPath)+'">👁 查看</button> ';}
          actions+='<button class="conv-btn conv-btn-s" onclick="dvReveal(this.dataset.p)" data-p="'+_attr(c.path)+'">📂</button>';
        }else{
          actions+='<button class="conv-btn conv-btn-s" onclick="dvUnlock(this.dataset.p)" data-p="'+_attr(c.path)+'">🔓 解锁</button>';
        }
        html+='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:4px 0;border-bottom:1px solid #2a2a2a">'+
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:430px" title="'+_attr(label)+'"><span style="color:#58a6ff;font-weight:600">'+n+'.</span> '+_esc(label)+' '+meta+'</span>'+
          '<span style="white-space:nowrap">'+actions+'</span></div>';
      }
      if(_allConv.length>_CONV_CAP){html+='<div style="color:#8b949e;font-size:11px;padding:4px 0">… 共 '+_allConv.length+' 条,仅展示最近 '+_CONV_CAP+' 条(全量在文件夹·按需解锁)</div>';}
    }
  }
  box.innerHTML=html;ov.appendChild(box);
  // 不再点击空白处自动关闭 (避免还没看清就误触回弹) — 仅可由 ✕ 关闭。
  document.body.appendChild(ov);
}
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
  try { _shellBroadcast({ type: "toast", text }); } catch (e) {}
}

// ═══ 第五板块 · Devin Cloud 后端编排 (无 UI · 全软编码) ═══════════════════
let _dvAutoTimer = null;
// v4.6.0 · Devin Cloud 状态聚合 (问题①+⑤): email.lower → {running, awaiting, blocked, total, ts, items[]}
//   _dvRunPoll 每轮写入; 对话追踪面板 (_getConvTrackingHtml) 据此渲染 Devin Cloud 子板块 (复用追踪 UI)。
const _dvStatusAgg = new Map();
// v4.8.1 · 持久化·根治"一闪一没": email.lower → 首次空轮时刻 (距上次非空)
//   暂态空(限流429/网络抖动/服务端最终一致性)在宽限窗口内不清除状态;
//   连续空持续超窗才判定对话真的结束并移除 ("对话结束了那就OK")。
const _dvEmptySince = new Map();
const DV_STATUS_STICKY_MS = 90000; // 维持已知状态的宽限窗(默 90s ≈ 跨 1~2 个轮询周期)
// 道·守柔不失: 显示保留窗(默 30min)。与手机版 switch.html 的 TRK_HOLD_MS 同源同理 ——
//   面板/角标/排序「显示新鲜度」绝不因计时器到点而误灰; 状态由 running→消失只由
//   _dvRunPoll 一次成功轮询确认空(超 DV_STATUS_STICKY_MS 宽限)主动 delete 触发,
//   而非「ts 一过 3min 就当陈旧不显示」。轮询若暂态停摆(进程繁忙/网络抖动)亦沿用上次态。
const DV_STATUS_HOLD_MS = 1800000;
let _dvPreloadTimer = null;

// ═══ v4.8.4 · 跨窗口选主 (singleton sweeps · 釜底抽薪根治多窗口网络并发风暴) ═══
//   病因: 同机多个 IDE 窗口各是独立扩展宿主进程, 每个都无条件地周期性对【整个账号池
//   (~数百个)】做 登录/状态轮询(_dvRunPoll)/预加载(_dvPreloadAll)/云端备份(_dvStartAuto)。
//   N 个窗口 = N 倍出网扇出, 开机瞬间拉起几百条 TLS 短连接 + 高 TIME_WAIT churn,
//   把家用路由器 NAT/conntrack 连接表打满 → 不只本机, 整个局域网一起丢包卡顿。
//   (devin_cloud.js 仅收敛了【单进程】socket 预算, 未消除【多窗口=多进程】这个倍增源。)
//   治法 (天下之至柔·绝利一源): 用心跳租约文件选出唯一「主窗口」执行全局网络扫描,
//   主窗口把聚合状态写入共享文件, 其余窗口读共享文件渲染面板/角标 → 功能完全不变,
//   网络并发 ÷ 窗口数; 主窗口关闭/崩溃后, 其余窗口在租约过期后自动接管。
const DV_LEASE_FILE = path.join(WAM_DIR, "_dv_poll_lease.json"); // 主窗口心跳租约
const DV_STATUS_FILE = path.join(WAM_DIR, "_dv_status.json"); // 主窗口写·跟随窗口读 (聚合状态)
const _dvInstanceId =
  String(process.pid) + "-" + Math.random().toString(36).slice(2, 8); // 本窗口唯一标识
let _dvIsLeader = false; // 本窗口当前是否为主窗口
let _dvLeaseTimer = null; // 选主/续租心跳定时器
let _dvPollTimer = null; // _dvRunPoll 周期定时器 (仅主窗口持有)
let _dvFollowerWatching = false; // 跟随窗口是否已在监听共享状态文件
function _dvLeaseTtlMs() {
  // 租约有效期 (默 75s ≈ 跨 1~2 个轮询周期); 主窗口每 TTL/2 续租一次, 过期即可被接管。
  return Math.max(30000, +_cfg("devinCloudLeaseTtlMs", 75000) || 75000);
}
function _dvLeaseRead() {
  try {
    return JSON.parse(fs.readFileSync(DV_LEASE_FILE, "utf8"));
  } catch {
    return null;
  }
}
// 尝试当选/续租: 无租约 或 租约已过期 或 本就是自己 → 写入并复读确认 (last-writer-wins, 自愈)。
function _dvTryBecomeLeader() {
  const ttl = _dvLeaseTtlMs();
  const now = Date.now();
  const cur = _dvLeaseRead();
  const fresh = cur && cur.ts && now - cur.ts < ttl;
  if (fresh && cur.owner !== _dvInstanceId) return false; // 他人持新鲜租约 → 当跟随
  try {
    atomicWrite(
      DV_LEASE_FILE,
      JSON.stringify({ owner: _dvInstanceId, pid: process.pid, ts: now }),
    );
  } catch {
    return _dvIsLeader; // 写失败 → 维持原状态
  }
  const after = _dvLeaseRead(); // 复读: 并发写入时仅最后写入者胜出
  return !!(after && after.owner === _dvInstanceId);
}
function _dvLeaseRelease() {
  const cur = _dvLeaseRead();
  if (cur && cur.owner === _dvInstanceId) {
    try {
      fs.unlinkSync(DV_LEASE_FILE);
    } catch {}
  }
}
// 主窗口启动全局网络扫描 (幂等)
function _dvLeaderStartSweeps() {
  if (_cfg("devinCloudAutoBackup", true)) _dvStartAuto();
  const pollMin = Math.max(0, _cfg("devinCloudRunPollMin", 1));
  if (pollMin > 0 && !_dvPollTimer) {
    _dvPollTimer = setInterval(() => {
      if (!_dvIsLeader) return; // 二重保险: 失主后即便定时器残留也空跑
      _dvRunPoll().catch(() => {});
    }, pollMin * 60000);
  }
  _dvStartPreload();
  if (_cfg("devinCloudConvQuotaCap", true)) _dvConvCapSchedule();
}
// 让出主窗口 → 停止全局网络扫描 (转为跟随·只读共享状态)
function _dvLeaderStopSweeps() {
  _dvStopAuto();
  if (_dvPollTimer) {
    clearInterval(_dvPollTimer);
    _dvPollTimer = null;
  }
  _dvStopPreload();
  try {
    _dvConvCapStop();
  } catch {}
}
// 主窗口把聚合状态写入共享文件 (跟随窗口据此渲染·功能不变)
function _dvWriteSharedStatus() {
  try {
    const agg = [];
    for (const [k, v] of _dvStatusAgg) agg.push([k, v]);
    atomicWrite(
      DV_STATUS_FILE,
      JSON.stringify({ ts: Date.now(), by: _dvInstanceId, agg }),
    );
  } catch {}
}
// 跟随窗口: 读共享状态文件 → 渲染面板/角标 (与 _dvRunPoll 末尾同口径·不发起网络)
function _dvRenderFromShared() {
  try {
    const j = JSON.parse(fs.readFileSync(DV_STATUS_FILE, "utf8"));
    if (!j || !Array.isArray(j.agg)) return;
    _dvStatusAgg.clear();
    for (const [k, v] of j.agg) if (k && v) _dvStatusAgg.set(k, v);
    const items = [];
    for (const [_em, _st] of _dvStatusAgg) {
      if (!_st || (_st.total | 0) <= 0) continue;
      if (Date.now() - _st.ts > DV_STATUS_HOLD_MS) continue;
      items.push({
        email: _em,
        running: _st.running,
        awaiting: _st.awaiting,
        blocked: _st.blocked,
        titles: (_st.items || []).map((x) => x.title),
      });
    }
    _broadcastMsg({ type: "devinRunStatus", items });
    try {
      _broadcastConvSection();
    } catch {}
  } catch {}
}
function _dvStartFollowerWatch() {
  if (_dvFollowerWatching) return;
  _dvFollowerWatching = true;
  try {
    fs.watchFile(DV_STATUS_FILE, { persistent: false, interval: 2000 }, () =>
      _dvRenderFromShared(),
    );
  } catch {}
  _dvRenderFromShared(); // 立即渲染一次当前共享状态
}
function _dvStopFollowerWatch() {
  if (!_dvFollowerWatching) return;
  _dvFollowerWatching = false;
  try {
    fs.unwatchFile(DV_STATUS_FILE);
  } catch {}
}
// 选主心跳: 当选则跑全局扫描·落选则转跟随 (每 TTL/2 续租/重选)
function _dvElectionTick() {
  const was = _dvIsLeader;
  _dvIsLeader = _dvTryBecomeLeader();
  if (_dvIsLeader && !was) {
    log("devin-cloud: 本窗口当选轮询主窗口 (singleton·id=" + _dvInstanceId + ")");
    _dvStopFollowerWatch();
    _dvLeaderStartSweeps();
  } else if (!_dvIsLeader && was) {
    log("devin-cloud: 让出轮询主窗口 → 转跟随 (读共享状态·停本窗口网络扫描)");
    _dvLeaderStopSweeps();
    _dvStartFollowerWatch();
  } else if (!_dvIsLeader && !was) {
    _dvStartFollowerWatch(); // 持续跟随
  }
}
function _dvStartElection(context) {
  _dvElectionTick(); // 立即选一次
  if (!_dvLeaseTimer) {
    _dvLeaseTimer = setInterval(
      _dvElectionTick,
      Math.max(15000, Math.floor(_dvLeaseTtlMs() / 2)),
    );
  }
  context.subscriptions.push({
    dispose: () => {
      if (_dvLeaseTimer) {
        clearInterval(_dvLeaseTimer);
        _dvLeaseTimer = null;
      }
      _dvLeaderStopSweeps();
      _dvStopFollowerWatch();
      _dvLeaseRelease(); // 关窗即让出 → 其余窗口立即可接管 (不必等租约过期)
    },
  });
}
// v4.7.4 · 账号编号 (1-based · 与侧栏勾选框旁编号一致): email.lower → 序号; 用于对话追踪区分 Devin Cloud 各账号。
function _dvAccountNo(email) {
  if (!_store || !_store.accounts) return 0;
  const key = String(email || "").toLowerCase();
  for (let i = 0; i < _store.accounts.length; i++) {
    if ((_store.accounts[i].email || "").toLowerCase() === key) return i + 1;
  }
  return 0;
}
// 某账号的备份目录 (编号+账号+密码表层命名·与自动备份一致) → <root>/<NN_email_pwd>/
function _dvAccountBackupDir(email) {
  const root = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
  const acc = (_store.accounts || []).find((a) => (a.email || "").toLowerCase() === String(email || "").toLowerCase()) || {};
  return path.join(root, devinCloud.accountFolderName({ email }, { accountNo: _dvAccountNo(email), password: acc.password || "" }));
}
// 找/建某对话的备份文件夹 (在 <账号>/对话/ 下, 已存在则复用·按 ID末8位 匹配) → 供面板直存。
function _dvFindOrMakeConvDir(email, devinId, title) {
  const convParent = path.join(_dvAccountBackupDir(email), "对话");
  const shortId = String(devinId).replace(/^devin-/, "").slice(0, 8);
  try {
    if (fs.existsSync(convParent)) {
      const hit = fs.readdirSync(convParent, { withFileTypes: true }).find((d) => d.isDirectory() && d.name.endsWith("_" + shortId));
      if (hit) return path.join(convParent, hit.name);
    }
  } catch {}
  const dir = path.join(convParent, devinCloud.convFolderName(0, title, devinId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
// 在对话 HTML 中注入「右上角下载工具条」(MD/HTML 秒存 · 完整ZIP) → 面板内直接下载, 见落点。
function _dvInjectConvToolbar(html) {
  const bar =
    '<div style="position:fixed;top:12px;right:16px;z-index:99999;display:flex;gap:6px;font-family:-apple-system,Segoe UI,sans-serif">' +
    '<button onclick="__dl(\'md\')" style="background:#238636;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">⬇ MD</button>' +
    '<button onclick="__dl(\'html\')" style="background:#1f6feb;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">⬇ HTML</button>' +
    '<button onclick="__dl(\'full\')" style="background:#6e40c9;color:#fff;border:0;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px">⬇ 完整(含文件)</button>' +
    '</div>' +
    '<script>const __v=acquireVsCodeApi();function __dl(f){__v.postMessage({type:"dvSaveConv",fmt:f})}</script>';
  return html.includes("</body>") ? html.replace("</body>", bar + "\n</body>") : html + bar;
}
let _dvPreloadInFlight = false;
let _dvLastPreloadTs = 0;
// 取账号(index)的 Devin Cloud 登录态: 复用缓存·必要时 email+password 重登
async function _dvAuthFor(i) {
  const acc = _store.accounts[i];
  if (!acc || !acc.email) return { ok: false, error: "账号不存在" };
  if (!acc.password) return { ok: false, error: acc.email + " 无密码·无法登录 Devin Cloud" };
  try {
    const r = await devinCloud.getAuth(acc.email, acc.password);
    if (!r.ok) return { ok: false, error: r.error || "登录失败", email: acc.email };
    return { ok: true, auth: r, email: acc.email };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), email: acc.email };
  }
}
// v4.7.0 · 清理/变更后无感刷新某账号概览 (失效缓存 → 重拉 → 推送最新 HTML)
async function _dvRefreshOverview(index, r) {
  try {
    const email = (r.email || "").toLowerCase();
    _dvOverviewCache.delete(email);
    // v4.9.11: 已清理账号优先从本地备份读 (云端↔本地无感切换)
    const cst = devinCloud.getCleanupState(email);
    if (cst && cst.cleanedAt) {
      const ov = _dvLocalOverview(email);
      _dvOverviewCache.set(email, { ov, gitSt: null, ts: Date.now(), local: true });
      _broadcastMsg({ type: "devinOverview", index, html: _dvOverviewHtml(ov, index, null) });
      return;
    }
    const [ov, gitSt] = await Promise.all([
      devinCloud.accountOverview(r.auth),
      devinGit.gitStatus(r.auth).catch(() => null),
    ]);
    _dvOverviewCache.set(email, { ov, gitSt, ts: Date.now() });
    _broadcastMsg({ type: "devinOverview", index, html: _dvOverviewHtml(ov, index, gitSt) });
    // v4.9.11: 检测云端有新对话活动 → 刷新 lastConvUpdateAt (维持冷却期计时)
    if (ov && (ov.counts || {}).running > 0) {
      devinCloud.setCleanupState(email, { lastConvUpdateAt: Date.now() });
    }
    _dvRunPoll().catch(() => {});
  } catch (e) {
    log("dvRefreshOverview err: " + ((e && e.message) || e));
  }
}
// v4.9.11: 从本地备份构建概览 (已清理账号的数据源)
function _dvLocalOverview(email) {
  const dir = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
  const tree = devinCloud.listBackups(dir);
  const acc = (tree.accounts || []).find((a) => (a.email || "").toLowerCase() === email.toLowerCase());
  const convs = acc ? acc.conversations || [] : [];
  return {
    email,
    orgId: "",
    _localSource: true,
    sessions: convs.map((c, i) => ({
      devinId: c.devinId || (c.name || "").replace(/^.*_/, "").replace(/\.zip$/i, "") || ("local-" + i),
      title: c.title || c.name || "(本地备份)",
      status: "backed_up",
      statusClass: "finished",
      createdAt: c.mtime ? Math.floor(c.mtime / 1000) : 0,
      updatedAt: c.mtime ? Math.floor(c.mtime / 1000) : 0,
      tags: [],
    })),
    counts: { sessions: convs.length, running: 0, awaiting: 0, blocked: 0, knowledge: 0, playbooks: 0, secrets: 0, gitConnections: 0 },
    knowledge: [], playbooks: [], secrets: [], gitConnections: [],
    billing: null,
  };
}
// v4.7.0 · 知识库/剧本/密钥 板块: 标签/取项/内容文本/删除 (Phase D)
function _dvBoardLabel(key) { return key === "kn" ? "知识库" : key === "pb" ? "剧本" : key === "sc" ? "密钥" : "项目"; }
async function _dvFetchBoardItem(auth, key, id) {
  if (key === "kn") { const r = await devinCloud.listKnowledge(auth); return (r.learnings || []).find((x) => String(x.id) === String(id)); }
  if (key === "pb") { const r = await devinCloud.listPlaybooks(auth); return (r.playbooks || []).find((x) => String(x.id || x.playbook_id) === String(id)); }
  if (key === "sc") { const r = await devinCloud.listSecrets(auth); return (r.secrets || []).find((x) => String(x.id || x.secret_id) === String(id) || x.name === id); }
  return null;
}
function _dvBoardItemText(key, it) {
  if (!it) return "";
  if (key === "kn") {
    return "# " + (it.name || it.id || "知识") + "\n\n" +
      (it.trigger_description ? "**触发场景**: " + it.trigger_description + "\n\n" : "") +
      "---\n\n" + (it.body || "(空)");
  }
  if (key === "pb") {
    return "# " + (it.title || it.name || it.id || "剧本") + "\n\n" +
      (it.access ? "**可见性**: " + it.access + "\n\n" : "") + "---\n\n" + (it.body || "(空)");
  }
  // 密钥: 仅有名称/元数据, 后端不返回明文值
  return "# 密钥 · " + (it.name || it.id || "") + "\n\n(Devin 后端不回传密钥明文, 仅可查看名称与删除)\n\n" + JSON.stringify(it, null, 2);
}
function _dvBoardDelete(auth, key, id) {
  if (key === "kn") return devinCloud.deleteKnowledge(auth, id);
  if (key === "pb") return devinCloud.deletePlaybook(auth, id);
  return devinCloud.deleteSecret(auth, id);
}
function _dvBoardFileName(key, it, id) {
  const nm = (it && (it.name || it.title)) || id;
  return devinCloud.safeName(_dvBoardLabel(key) + "_" + nm, 80) + ".md";
}
// ═══ 第三板块 · Git 下拉框状态缓存 + 开合追踪 (根治"回弹": 全量重建 webview 时按缓存预填) ═══
// _dvOpenEmails: 当前展开的账号 email 集合 (host 侧权威, 渲染时据此预填 open + 内容)
// _dvOverviewCache: email → {ov, gitSt, ts} 概览数据缓存; 渲染时用当前 index 重生 HTML (索引不串)
const _dvOpenEmails = new Set();
const _dvOverviewCache = new Map();
const DV_CACHE_TTL = 90000; // 90s 内复用缓存, 避免每次扫描 tick 重新登录/拉取
function _dvCacheFresh(email) {
  const c = _dvOverviewCache.get(String(email || "").toLowerCase());
  return c && Date.now() - c.ts < DV_CACHE_TTL ? c : null;
}
// 账号概览 → 下拉框 HTML (对话着重 · 知识库/Git/额度 简要 + Git 板块归一连接)
function _dvOverviewHtml(ov, i, gitSt) {
  const c = ov.counts || {};
  const tag = devinCloud.getTag(ov.email);
  // v4.5.0: 余额精确到分 (与官网每刀额度同步) · 委托 billingBalance 计真余额, 再 toFixed(2)
  const _bal = devinCloud.billingBalance(ov.billing);
  const credits =
    _bal !== null
      ? "额度 $" + _bal.toFixed(2)
      : ov.billing && ov.billing.billing_error
        ? "额度异常"
        : "";
  // v4.5.0: 对话额度上限 (开启时显示本账号当前每对话上限·实时跟随余额)
  const _capState = _dvConvCapFor(ov.email);
  const capTxt = _cfg("devinCloudConvQuotaCap", true) && _capState
    ? "对话上限 $" + (typeof _capState.cap === "number" ? _capState.cap.toFixed(2) : "—") + (_capState.drain ? " ·抽干中" : "") + (_capState.inUse ? " ·使用中" : "")
    : "";
  let h = '<div class="dv-h">';
  // v4.9.11: 数据源指示 (本地备份/云端)
  if (ov._localSource) h += '<span class="dv-stat" style="color:#4ec9b0" title="已清理账号·数据来自本地备份(不拉云端)">&#128204; 本地</span>';
  // v4.6.0 · 对话状态细分显示: 运行/待输入/卡住 都显示 (问题①)
  h += '<span class="dv-stat">对话 ' + c.sessions +
    (c.running ? ' · <span style="color:#4ec9b0">运行 ' + c.running + '</span>' : "") +
    (c.awaiting ? ' · <span style="color:#d29922">待输入 ' + c.awaiting + '</span>' : "") +
    (c.blocked ? ' · <span style="color:#f44">卡住 ' + c.blocked + '</span>' : "") + "</span>";
  h += '<span class="dv-stat dv-stat-c" title="点击查看知识库清单" onclick="dvTog(\'dvB' + i + 'kn\')">知识库 ' + c.knowledge + "</span>";
  h += '<span class="dv-stat dv-stat-c" title="点击查看剧本清单" onclick="dvTog(\'dvB' + i + 'pb\')">剧本 ' + (c.playbooks || 0) + "</span>";
  h += '<span class="dv-stat dv-stat-c" title="点击查看密钥清单" onclick="dvTog(\'dvB' + i + 'sc\')">密钥 ' + (c.secrets || 0) + "</span>";
  h += '<span class="dv-stat">Git ' + (c.gitConnections || 0) + "</span>";
  if (credits) h += '<span class="dv-stat">' + _esc(credits) + "</span>";
  if (capTxt) h += '<span class="dv-stat" title="v4.5.0 · 每对话使用额度上限=余额-缓冲·实时跟随余额·余额≤停止阈值自动中停" data-capemail="' + _esc(ov.email) + '">' + _esc(capTxt) + "</span>";
  h += "</div>";
  // 查看面板（点击上方统计块展开/收起）：知识库/剧本/密钥名称清单
  h += _dvBoardListHtml(i, "kn", "知识库", ov.knowledge);
  h += _dvBoardListHtml(i, "pb", "剧本", ov.playbooks);
  h += _dvBoardListHtml(i, "sc", "密钥", ov.secrets);
  // ── Git(GitHub) 板块 · 最小化前端: 身份/仓库/密钥 一行 + PAT 输入 + 连接/断开 ──
  h += _dvGitSectionHtml(i, gitSt, ov.email);
  const sess = (ov.sessions || []).slice(0, 40);
  if (!sess.length) h += '<div style="color:#666">（无对话）</div>';
  // v4.7.0 · 多选合并条 (Shift 多选对话 → 合并下载ZIP / 批量清理)
  if (sess.length) {
    h += '<div class="dvc-bar" id="dvcBar' + i + '">已选 <b class="dvc-cnt" data-i="' + i + '">0</b> 个对话 · ' +
      '<button class="dvc-b" onclick="dvConvZipBatch(' + i + ')" title="把已选对话合并成一个 ZIP 下载到本地">&#11015; 合并下载ZIP</button>' +
      '<button class="dvc-b dvc-b-s" onclick="dvConvDelBatch(' + i + ')" title="水过无痕·批量清理已选对话">&#127754; 批量清理</button>' +
      '<button class="dvc-b" style="margin-left:auto;background:#222;color:#888;border-color:#333" onclick="dvcClear(' + i + ')">取消</button></div>';
  }
  for (const s of sess) {
    const cls = s.statusClass || "idle";
    const stTxt = cls === "running" ? "运行" : cls === "awaiting" ? "待输入" : cls === "blocked" ? "卡住" : cls === "finished" ? "完成" : "空闲";
    const did = _esc(s.devinId || "");
    h +=
      '<div class="dv-sess" data-did="' + did + '">' +
      '<input type="checkbox" class="dvc-chk" data-i="' + i + '" data-did="' + did + '" onclick="dvcSel(event,' + i + ')">' +
      '<span class="st ' + cls + '">' + stTxt + "</span>" +
      '<span class="tt" title="' + _esc(s.title) + " · " + did + '">' + _esc(s.title) + "</span>" +
      '<span class="dvc-acts">' +
      '<button class="dvc-b" title="查看对话详情/Output 全文" onclick="dvConvDetail(' + i + ",'" + did + "')\">&#128065;</button>" +
      '<button class="dvc-b" title="下载本对话为 ZIP 到本地(增量补全文件)" onclick="dvConvZip(' + i + ",'" + did + "')\">&#11015;</button>" +
      '<button class="dvc-b dvc-b-s" title="水过无痕·清理本对话" onclick="dvConvDel(' + i + ",'" + did + "')\">&#128465;</button>" +
      "</span></div>";
  }
  if ((ov.sessions || []).length > 40) h += '<div style="color:#666">… 共 ' + ov.sessions.length + " 个，更多见备份</div>";
  h +=
    '<div class="dv-acts">' +
    '<button class="conv-btn" onclick="dvBackup(' + i + ')" title="增量备份本账号全部对话">&#128190; 导出全部对话</button>' +
    '<button class="conv-btn conv-btn-s" onclick="dvCreate(' + i + ')" title="代替我在此账号发起一个新 Devin Cloud 对话">&#9729; 发起对话</button>' +
    '<button class="conv-btn conv-btn-s" onclick="dvBrowse()" title="浏览备份文件夹·一键解锁(解压)对话ZIP">&#128193; 浏览备份</button>' +
    '<button class="conv-btn conv-btn-s" onclick="dvLocalConvs(' + i + ')" title="从本地备份拉取本账号对话(已清零号也可查看正文/下载ZIP·数据已云→本地)·与上方云端残留并行可见">&#128194; 本地对话</button>' +
    '<button class="conv-btn conv-btn-s" onclick="dvSetTag(' + i + ')">&#127991;&#65039; 标签' + (tag ? "：" + _esc(tag) : "") + "</button>" +
    '<button class="conv-btn conv-btn-s" onclick="wp(' + i + ')" title="水过无痕清理本账号">&#127754; 水过无痕</button>' +
    '<button class="conv-btn conv-btn-s" onclick="dvCleanupNowOne(' + i + ')" title="立即清理本账号(参手机版·无模态): 先全量备份→对话/账号整体归零→出库, 一气呵成">&#9889; 立即清理</button>' +
    "</div>" +
    '<div class="dv-local" id="dvLocal' + i + '" style="display:none;margin-top:6px;border-top:1px dashed #333;padding-top:6px"></div>';
  return h;
}
// v4.9.6 · C: 本地备份对话清单 HTML (已清零号也可查看正文/定位/ZIP · 数据已云→本地). 路径走 data-path + 事件委托(规避反斜杠转义).
function _dvLocalConvHtml(convs, i, dir) {
  convs = Array.isArray(convs) ? convs : [];
  let h = '<div class="dv-local-h" style="color:#888;font-size:11px;margin:4px 0">本地备份对话 ' + convs.length + ' 条 · 已云→本地' +
    (dir ? ' <a href="#" class="dv-localreveal" data-path="' + _esc(dir) + '" style="color:#4ec9b0">打开目录</a>' : "") + "</div>";
  if (!convs.length) { h += '<div style="color:#666;font-size:11px">（本地暂无备份 · 账号在线时先「导出全部对话」即可留底）</div>'; return h; }
  for (const c of convs) {
    const t = c.title || c.name || "(无题)";
    h += '<div class="dv-sess">' +
      '<span class="tt" title="' + _esc(t) + " · " + _esc(c.type || "") + '">' + _esc(t) + "</span>" +
      '<span class="dvc-acts">' +
      (c.hasHtml ? '<button class="dvc-b dv-localview" data-path="' + _esc(c.htmlPath) + '" title="查看本地对话正文(无需云端)">&#128065;</button>' : "") +
      '<button class="dvc-b dv-localreveal" data-path="' + _esc(c.path) + '" title="在文件管理器中定位(可下载/压缩ZIP)">&#128193;</button>' +
      "</span></div>";
  }
  return h;
}
// 查看面板 HTML: 某个 Devin Cloud 板块(知识库/剧本/密钥)的名称清单，默认收起，点统计块展开
function _dvBoardListHtml(i, key, label, list) {
  list = Array.isArray(list) ? list : [];
  const viewable = key === "kn" || key === "pb"; // 密钥无可取值, 仅删除/多选
  let s = '<div class="dv-board" id="dvB' + i + key + '" style="display:none">';
  if (!list.length) {
    s += '<div class="dv-board-empty">（无' + label + "）</div>";
  } else {
    // 多选批量条 (Shift 区间) · 批量删除 / 批量下载
    s += '<div class="dv-board-bar" id="bdBar' + i + key + '">已选 <b class="bd-cnt" data-i="' + i + '" data-k="' + key + '">0</b> · ' +
      (viewable ? '<button class="dvc-b" onclick="dvBoardBatch(' + i + ",'" + key + "','download')\" title=\"批量下载已选" + label + '到本地">&#11015; 批量下载</button>' : "") +
      '<button class="dvc-b dvc-b-s" onclick="dvBoardBatch(' + i + ",'" + key + "','delete')\" title=\"批量删除已选" + label + '">&#128465; 批量删除</button>' +
      '<button class="dvc-b" style="margin-left:auto;background:#222;color:#888;border-color:#333" onclick="dvBoardClear(' + i + ",'" + key + "')\">取消</button></div>";
    for (const it of list) {
      const id = String((it && it.id) || "");
      const nm = (it && (it.name || it.id)) || "(未命名)";
      const del = it && it.deletable !== false;
      s += '<div class="dv-board-item" title="' + _esc(id) + (del ? "" : " · 本源默认(不可删)") + '">' +
        '<input type="checkbox" class="dvc-chk bd-chk" data-i="' + i + '" data-k="' + key + '" data-id="' + _esc(id) + '" onclick="dvBoardSel(event,' + i + ",'" + key + "')\">" +
        '<span class="bd-nm">' + _esc(String(nm)) + (del ? "" : ' <span style="color:#666">·默认</span>') + "</span>" +
        '<span class="bd-acts">' +
        (viewable ? '<button class="dvc-b" title="查看' + label + '内容" onclick="dvBoardAct(' + i + ",'" + key + "','" + _esc(id) + "','view')\">&#128065;</button>" : "") +
        (viewable ? '<button class="dvc-b" title="下载' + label + '到本地" onclick="dvBoardAct(' + i + ",'" + key + "','" + _esc(id) + "','download')\">&#11015;</button>" : "") +
        (del ? '<button class="dvc-b dvc-b-s" title="删除' + label + '" onclick="dvBoardAct(' + i + ",'" + key + "','" + _esc(id) + "','delete')\">&#128465;</button>" : "") +
        "</span></div>";
    }
  }
  s += "</div>";
  return s;
}
// Git 板块 HTML (整合 devin-git-auth · 最小化前端变动): 已绑身份 + 仓库数 + 密钥 + PAT 输入 + 连/断按钮
function _dvGitSectionHtml(i, gitSt, email) {
  const has = gitSt && (gitSt.connections > 0 || gitSt.login);
  const hasPat = !!devinGit.patFor(email);
  let g = '<div class="dv-git">';
  g += '<div class="dv-git-h"><span class="dv-git-tag">Git · GitHub</span>';
  if (has) {
    g += '<span class="dv-git-id" title="已绑定 GitHub 身份">@' + _esc(gitSt.login || (gitSt.connNames || [])[0] || "github") + "</span>";
    g += '<span class="dv-git-meta">' + (gitSt.repoCount || 0) + " 仓库</span>";
    g += '<span class="dv-git-meta ' + (gitSt.secret ? "ok" : "no") + '">' + (gitSt.secret ? "Sec✓" : "无Sec") + "</span>";
  } else if (gitSt) {
    g += '<span class="dv-git-meta no">未连接</span>';
  } else {
    g += '<span class="dv-git-meta" style="color:#666">…</span>';
  }
  g += "</div>";
  g += '<div class="dv-git-acts">';
  g += '<input class="dv-git-pat" id="gitPat' + i + '" type="password" placeholder="' + (hasPat ? "PAT 已就绪(留空用默认)" : "ghp_… GitHub PAT") + '" autocomplete="off" />';
  g += '<button class="conv-btn conv-btn-s" onclick="gitConnect(' + i + ')" title="用 PAT 把此 Devin 账号归一连接到 GitHub 仓库(注入 PAT + 落库密钥 + 核验)">&#128279; 连接Git</button>';
  g += '<button class="conv-btn conv-btn-s" onclick="gitDisconnect(' + i + ')" title="真解绑: 撤连接 + 断 OAuth 用户 + 删 GITHUB_PAT 密钥, 连接数归零">&#9986; 断开Git</button>';
  g += "</div></div>";
  return g;
}
// v4.6.0 · 轮询「已登录(缓存内)」账号的活跃对话 (运行/等待输入/卡住), 聚合后广播。
//   预加载开启时 cachedEmails 已含全部可登录账号 → 等效全账号实时状态 (问题①+②)。
async function _dvRunPoll() {
  try {
    const emails = new Set(devinCloud.cachedEmails());
    if (!emails.size) return;
    for (const acc of _store.accounts) {
      const key = (acc.email || "").toLowerCase();
      if (!emails.has(key)) continue;
      const auth = devinCloud.getCachedAuth(acc.email);
      if (!auth) continue;
      try {
        let active = await devinCloud.listRunningSessions(auth);
        // v4.9.7 · F1: 永久取消追踪的对话(devinId 命中)从活跃集剔除 — 不统计/不通知/不显示, 跨窗口持久
        if (_untrackedConvUuids.size) active = active.filter((s) => !(s.devinId && _untrackedConvUuids.has(s.devinId)));
        let running = 0, awaiting = 0, blocked = 0;
        for (const s of active) {
          if (s.statusClass === "awaiting") awaiting++;
          else if (s.statusClass === "blocked") blocked++;
          else running++;
          _dvMaybeNotify(acc.email, s);
        }
        // v4.7.5 · 卡死监测: 运行中会话长时间无进展 → 实时提醒 (实时监测·实时反馈)
        _dvStallCheck(acc.email, active);
        // v4.7.5 · 低余额预警: 有活跃对话的账号余额跌破阈值($3) → 直接给用户发消息提示快用完
        if (active.length) { await _dvLowBalanceCheck(acc, auth, active).catch(() => {}); }
        if (active.length) {
          _dvEmptySince.delete(key); // 有活跃 → 清宽限计时
          _dvStatusAgg.set(key, {
            no: _dvAccountNo(acc.email),
            tag: devinCloud.getTag(acc.email) || "",
            running, awaiting, blocked, total: active.length,
            items: active.map((r) => ({ title: r.title, cls: r.statusClass, id: r.devinId })),
            ts: Date.now(),
          });
          _dvDetectFinished(acc.email, active); // 有活跃 → 正常离场检测
        } else {
          // v4.8.1 · 持久化·根治"一闪一没": 单轮空(限流429/网络抖动/服务端最终一致性)
          //   不立即清除 — 保留上轮 _dvStatusAgg 条目 → 面板/badge 持续显示;
          //   仅当连续空持续超过宽限窗口(对话真的结束) → 移除并生成终报。
          const _since = _dvEmptySince.get(key);
          if (!_since) {
            _dvEmptySince.set(key, Date.now()); // 首次空 → 起算宽限·本轮不动旧态(不闪)
          } else if (Date.now() - _since >= DV_STATUS_STICKY_MS) {
            _dvStatusAgg.delete(key);
            _dvEmptySince.delete(key);
            _dvDetectFinished(acc.email, active); // 确认离场 → 终报
          }
          // 宽限窗口内: 不调 _dvDetectFinished, 避免暂态空误报"对话已完成"
        }
      } catch {
        // 拉取失败(网络/限流) → 暂态: 保留旧状态·不清除·不误报 (天下之至柔)
      }
    }
    // v4.8.1 · badge/列表统一以 _dvStatusAgg(含宽限态)为准 → 暂态失败/限流也不闪没
    const items = [];
    for (const [_em, _st] of _dvStatusAgg) {
      if (!_st || (_st.total | 0) <= 0) continue;
      if (Date.now() - _st.ts > DV_STATUS_HOLD_MS) continue; // 与 _dvStatusAggHtml 同口径(显示保留窗)
      items.push({
        email: _em,
        running: _st.running, awaiting: _st.awaiting, blocked: _st.blocked,
        titles: (_st.items || []).map((x) => x.title),
      });
    }
    _broadcastMsg({ type: "devinRunStatus", items });
    _dvWriteSharedStatus(); // v4.8.4 · 落盘共享 → 其余窗口(跟随)据此渲染·不重复发起网络
    // v4.7.7 · 实时进展摘要 (每轮末聚合, 供面板/终报使用)
    const prog = _dvProgressSummary();
    if (prog.totalActive > 0) log("dv-progress: " + prog.totalRunning + " run / " + prog.totalAwaiting + " wait / " + prog.totalBlocked + " blocked / " + prog.totalStalled + " stall · health=" + prog.health);
    // v4.6.0 · 同步刷新对话追踪面板 (Devin Cloud 子板块随之更新 · 增量·不重建侧栏)
    try { _broadcastConvSection(); } catch {}
  } catch {}
}
// 运行/等待输入/卡住/完成 通知 (左下角 IDE) · 去抖 (问题①: 中途任何停顿都告知)
const _dvSeen = new Map(); // devinId → statusClass
function _dvMaybeNotify(email, sess) {
  const prev = _dvSeen.get(sess.devinId);
  const _no = _dvAccountNo(email);
  const who = (_no ? "#" + _no + " " : "") + (devinCloud.getTag(email) || email.split("@")[0]);
  if (sess.statusClass === "blocked" && prev !== "blocked") {
    _notify("warn", "[" + who + "] 对话疑似卡住/额度超限: " + sess.title);
  } else if (sess.statusClass === "awaiting" && prev !== "awaiting") {
    _notify("warn", "[" + who + "] 对话等待你的输入/回答: " + sess.title);
  }
  _dvSeen.set(sess.devinId, sess.statusClass);
}

// ═══ v4.7.5 · 对话最终模块加固: 卡死实时监测 + 低余额(≤$3)主动提醒用户 · 道法自然 ═══
//   "实时监测·实时反馈": 各对话最终卡住/卡死, 在 _dvRunPoll 每轮(默 1min)即检出并左下角提醒;
//   低余额: 对话所在账号余额 ≤ 阈值($3) 时直接发消息(IDE 通知 + 尽力往运行中对话续写一条)提示快用完。
const _dvSessSig = new Map();    // devinId → { sig, since } 上次进展指纹 + 该指纹起始时刻
const _dvStallSeen = new Set();  // devinId 已就"本段卡死"提醒过 (不刷屏·进展恢复后清)
const _dvLowBalSeen = new Map(); // email(lc) → bool 是否已就当前低余额段提醒过 (回升后复位)

// 卡死监测: 运行中会话进展指纹「持续不变」超过阈值 → 疑似卡死/长时间无进展, 提醒一次。
//   保守: 仅 statusClass==="running" 计时(awaiting/blocked 已各有独立提醒); 进展(指纹变)即复位计时与已警。
function _dvStallCheck(email, active) {
  if (!_cfg("devinCloudStallAlert", true)) return;
  const stallMs = Math.max(0, (+_cfg("devinCloudStallMin", 15) || 0)) * 60000;
  if (stallMs <= 0) return;
  const now = Date.now();
  const live = new Set(active.map((s) => s.devinId));
  for (const s of active) {
    if (s.statusClass !== "running") { _dvStallSeen.delete(s.devinId); _dvSessSig.delete(s.devinId); continue; }
    const sig = devinCloud.sessionSignature(s);
    const prev = _dvSessSig.get(s.devinId);
    if (!prev || prev.sig !== sig) {
      _dvSessSig.set(s.devinId, { sig, since: now }); // 有进展 → 重新计时
      _dvStallSeen.delete(s.devinId);
      continue;
    }
    if (devinCloud.stallVerdict(now - prev.since, stallMs) && !_dvStallSeen.has(s.devinId)) {
      _dvStallSeen.add(s.devinId);
      const _no = _dvAccountNo(email);
      const who = (_no ? "#" + _no + " " : "") + (devinCloud.getTag(email) || email.split("@")[0]);
      const mins = Math.round((now - prev.since) / 60000);
      _notify("warn", "[" + who + "] 对话疑似卡死·已 " + mins + " 分钟无进展: " + s.title);
      log("dv-stall: " + s.devinId + " 无进展 " + mins + "min · " + s.title);
    }
  }
  // 清理已离场会话的指纹/已警态 (无为·不占内存)
  for (const id of [..._dvSessSig.keys()]) if (!live.has(id)) _dvSessSig.delete(id);
  for (const id of [..._dvStallSeen]) if (!live.has(id)) _dvStallSeen.delete(id);
}

// 低余额预警: 账号实时余额 ≤ 阈值 → 给用户发消息(快用完了)。一次跌破只提醒一次, 回升后才再提醒。
//   "也可以利用这个对话最终的模块去给用户发送消息": 除 IDE 通知外, 尽力往运行中对话续写一条提醒(需 apk_ Key·缺则仅通知, 不臆造成功)。
async function _dvLowBalanceCheck(acc, auth, active) {
  if (!_cfg("devinCloudLowBalanceAlert", true)) return;
  const key = (acc.email || "").toLowerCase();
  const threshold = Math.max(0, +_cfg("devinCloudLowBalanceThreshold", 3) || 0);
  let balance = null;
  try { balance = devinCloud.billingBalance(await devinCloud.getBilling(auth)); } catch {}
  const verdict = devinCloud.lowBalanceVerdict(balance, threshold, _dvLowBalSeen.get(key));
  _dvLowBalSeen.set(key, verdict.alerted);
  if (!verdict.alert) return;
  const _no = _dvAccountNo(acc.email);
  const who = (_no ? "#" + _no + " " : "") + (devinCloud.getTag(acc.email) || key.split("@")[0]);
  _notify("warn", "[" + who + "] 余额仅剩 $" + balance.toFixed(2) + " ≤ $" + threshold + " · 额度快用完了, 请尽快充值/转移工作 (再低将自动中停对话)");
  log("dv-lowbal: " + key + " 余额 $" + balance.toFixed(2) + " ≤ $" + threshold + " → 已提醒用户");
  // 尽力往运行中对话续写一条提醒消息 (需 apk_ API Key; 缺失/失败则仅 IDE 通知·不臆造)
  if (_cfg("devinCloudLowBalanceMessageSession", true)) {
    const apiKey = _cfg("devinCloudApiKey", "") || (auth && auth.apiKey) || "";
    if (apiKey) {
      const text = "⚠️ 额度提醒 (rt-flow 自动监测): 本账号 Devin 余额仅剩 $" + balance.toFixed(2) + " (≤ $" + threshold + ")，即将用尽。请尽快充值或转移工作，以免对话被自动中停。";
      for (const s of active) {
        try {
          const r = await devinCloud.sendMessage(auth, s.devinId, text, { apiKey });
          if (r && r.ok) log("dv-lowbal: 已向对话 " + s.devinId + " 续写额度提醒");
          else log("dv-lowbal: 续写提醒未成 " + s.devinId + " · " + ((r && r.error) || ""));
        } catch (e) { log("dv-lowbal send err: " + ((e && e.message) || e)); }
      }
    }
  }
}
// v4.6.0 · Devin Cloud 概览预加载 + 增量刷新 (问题②: 彻底消除点击后加载耗时)
//   后台对账号库内全部「有密码」账号并发(受限)登录 + 预拉概览/Git → 入 _dvOverviewCache;
//   展开账号时直接命中缓存秒开。已展开的账号顺带推送最新概览 HTML (增量更新)。
async function _dvPreloadAll(opts) {
  opts = opts || {};
  if (_dvPreloadInFlight) return;
  if (_wamMode !== "wam") return;
  _dvPreloadInFlight = true;
  try {
    const conc = Math.min(6, Math.max(1, +_cfg("devinCloudPreloadConcurrency", 3) || 3));
    const targets = [];
    for (let i = 0; i < _store.accounts.length; i++) {
      const acc = _store.accounts[i];
      if (!acc || !acc.email || !acc.password) continue;
      const email = acc.email.toLowerCase();
      // 增量: 缓存新鲜则跳过 (除非强制) · 知止不殆
      if (!opts.force && _dvCacheFresh(email)) continue;
      targets.push({ i, acc, email });
    }
    if (!targets.length) { _dvRunPoll().catch(() => {}); return; }
    log("devin-cloud: 预加载 " + targets.length + " 个账号 (并发" + conc + ")");
    let idx = 0;
    const worker = async () => {
      while (idx < targets.length) {
        const t = targets[idx++];
        try {
          const r = await _dvAuthFor(t.i);
          if (!r.ok) continue;
          const [ov, gitSt] = await Promise.all([
            devinCloud.accountOverview(r.auth),
            devinGit.gitStatus(r.auth).catch(() => null),
          ]);
          _dvOverviewCache.set(t.email, { ov, gitSt, ts: Date.now() });
          // 已展开 → 增量推送最新 HTML (用户无感刷新)
          if (_dvOpenEmails.has(t.email)) {
            _broadcastMsg({ type: "devinOverview", index: t.i, html: _dvOverviewHtml(ov, t.i, gitSt) });
          }
        } catch (e) {
          log("preload " + t.email + " err: " + ((e && e.message) || e));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(conc, targets.length) }, worker));
    _dvLastPreloadTs = Date.now();
    // 预登录后缓存内即有全部账号 → 立即跑一轮状态轮询 (问题①)
    await _dvRunPoll().catch(() => {});
    log("devin-cloud: 预加载完成 · 缓存账号 " + devinCloud.cachedEmails().length + " 个");
  } finally {
    _dvPreloadInFlight = false;
  }
}
function _dvStartPreload() {
  if (!_cfg("devinCloudPreload", true)) return;
  // 启动后延迟首次预加载 (避开冷启动登录风暴 · 让切号/验证先行)
  setTimeout(() => { if (_dvIsLeader) _dvPreloadAll().catch(() => {}); }, 6000); // v4.8.4 · 仅主窗口
  const refreshMin = Math.max(0, +_cfg("devinCloudPreloadRefreshMin", 5) || 0);
  if (refreshMin > 0 && !_dvPreloadTimer) {
    _dvPreloadTimer = setInterval(() => { if (_dvIsLeader) _dvPreloadAll().catch(() => {}); }, refreshMin * 60000); // v4.8.4 · 仅主窗口
    log("devin-cloud: 预加载增量刷新定时器 · " + refreshMin + "min");
  }
}
function _dvStopPreload() {
  if (_dvPreloadTimer) { clearInterval(_dvPreloadTimer); _dvPreloadTimer = null; }
}
// v4.6.0 · Devin Cloud 状态聚合 → 对话追踪面板子板块 HTML (复用追踪 UI · 问题⑤)
function _dvStatusAggHtml() {
  let totalRun = 0, totalAwait = 0, totalBlocked = 0;
  const rows = [];
  for (const [email, st] of _dvStatusAgg) {
    if (!st || (st.total | 0) <= 0) continue;
    if (Date.now() - st.ts > DV_STATUS_HOLD_MS) continue; // 显示保留窗内不撤(只由确认轮询清)
    totalRun += st.running; totalAwait += st.awaiting; totalBlocked += st.blocked;
    const who = st.tag || email.split("@")[0];
    const no = st.no || _dvAccountNo(email); // 账号编号 (与侧栏勾选框旁一致)
    const noBadge = no ? '<span class="dv-trk-no" title="账号编号 ' + no + ' (Devin Cloud)">' + no + "</span>" : "";
    for (const it of st.items.slice(0, 6)) {
      const cls = it.cls === "running" ? "running" : it.cls === "awaiting" ? "awaiting" : "blocked";
      const tip = cls === "running" ? "运行中" : cls === "awaiting" ? "等待你的输入" : "卡住/额度超限";
      const _xBtn = it.id ? '<span class="dv-trk-x" data-id="' + _esc(String(it.id)) + '" title="取消追踪此对话(永久·不再统计/通知·可wam.clearConvUntrack复原)">\u2715</span>' : "";
      // v4.16.0 · 对话级直达: 每行加「IDE内多实例 / 浏览器多实例」, 直接开此对话(注入该号登录), 免下拉
      const _goBtns = it.id ? (
        '<span class="dv-trk-go" style="margin-left:auto" data-act="convRt" data-email="' + _esc(email) + '" data-did="' + _esc(String(it.id)) + '" title="此对话 → IDE 内置浏览器多实例(注入该号登录·各登各号)">\uD83D\uDDA5</span>' +
        '<span class="dv-trk-go" data-act="convSb" data-email="' + _esc(email) + '" data-did="' + _esc(String(it.id)) + '" title="此对话 → 系统浏览器多实例(独立隔离·注入该号)">\uD83C\uDF10</span>'
      ) : "";
      const _ckBox = it.id ? '<input type="checkbox" class="dv-trk-ck" data-did="' + _esc(String(it.id)) + '" data-email="' + _esc(email) + '" onclick="trkSel(event)" title="勾选此对话(Shift 可区间多选) · 批量 IDE/网页/取消追踪" style="margin:0;flex-shrink:0">' : "";
      rows.push('<div class="dv-trk-item">' + _ckBox + noBadge + '<span class="dv-trk-st ' + cls + '" title="' + tip + '">' +
        (cls === "running" ? "运行" : cls === "awaiting" ? "待输入" : "卡住") + "</span>" +
        '<span class="dv-trk-who">' + _esc(who) + "</span>" +
        '<span class="dv-trk-tt" title="' + _esc(it.title) + '">' + _esc(_truncTitle(it.title, 22)) + "</span>" + _goBtns + _xBtn + "</div>");
    }
  }
  const cached = devinCloud.cachedEmails().length;
  const totalActive = totalRun + totalAwait + totalBlocked;
  if (totalActive === 0 && rows.length === 0) {
    const hint = _dvPreloadInFlight
      ? "预加载中…"
      : cached > 0
        ? "无活跃对话 · 已预载 " + cached + " 号"
        : (_cfg("devinCloudPreload", true) ? "待预加载(启动后约8s)" : "预加载已关 · 展开账号即拉取");
    return '<div class="dv-trk-empty">&#9729; Devin Cloud · ' + hint + "</div>";
  }
  const sum = '<div class="dv-trk-sum"><span class="dv-trk-tag">&#9729; Devin Cloud</span>' +
    '<span>运行<b style="color:#4ec9b0">' + totalRun + "</b></span>" +
    (totalAwait ? '<span>待输入<b style="color:#d29922">' + totalAwait + "</b></span>" : "") +
    (totalBlocked ? '<span>卡住<b style="color:#f44">' + totalBlocked + "</b></span>" : "") +
    '<span id="trkBar" style="display:none;gap:4px;align-items:center;margin-left:auto">已选<b id="trkCnt" style="color:#9cdcfe">0</b>' +
    '<span class="dv-trk-go" data-batch="rt" title="勾选对话 → 批量 IDE 内多实例">\uD83D\uDDA5批</span>' +
    '<span class="dv-trk-go" data-batch="sb" title="勾选对话 → 批量系统浏览器多实例">\uD83C\uDF10批</span>' +
    '<span class="dv-trk-go" data-batch="x" title="批量取消追踪勾选对话">\u2715批</span>' +
    '<span class="dv-trk-go" data-batch="clr" title="清除勾选">清</span></span>' +
    "</div>";
  return sum + rows.join("");
}
// v4.6.0 · Devin Cloud 独立追踪+备份板块 (问题④⑤: 与 Cascade 备份配置分开·并排·复用追踪UI)
//   插入对话追踪面板底部, 紧邻 Cascade 备份配置板块。含: Devin Cloud 实时状态 + 独立备份目录配置。
function _dvBackupPanelHtml() {
  const dir = _cfg("devinCloudBackupDir", "") || (devinCloud.paths && devinCloud.paths.DC_BACKUP_DEFAULT) || "";
  const autoOn = _cfg("devinCloudAutoBackup", true);
  const autoTag = autoOn
    ? '<span style="color:#4ec9b0;font-size:9px" title="账号库内所有可登录账号的对话自动增量备份">&#10003; 自动备份开</span>'
    : '<span style="color:#888;font-size:9px">自动备份关</span>';
  return (
    '<div class="dv-trk-section">' +
    '<div class="dv-trk-hd">&#9729; Devin Cloud · 对话追踪 + 备份 <span class="dv-trk-sep">(独立于 Cascade)</span></div>' +
    _dvStatusAggHtml() +
    '<div class="conv-actions">' +
    '<button onclick="doSetDevinBackupDir()" class="conv-btn" title="选择 Devin Cloud 对话备份目录(独立于 Cascade)·账号库内所有对话自动增量备份·随更新增量同步">&#128193; Devin Cloud 备份配置</button>' +
    autoTag +
    "</div>" +
    '<div class="conv-backup-path" title="' + _esc(dir) + '">Devin备份: ' + _esc(dir) + "</div>" +
    "</div>"
  );
}
// v4.26.2: 「近期对话(跨账号)·数千条下拉」已从对话追踪面板移除 —— 该列表对用户是负担,
//   且与悬浮窗「💬对话备份」板块(近期对话=API 限量·对话记录=全量按号分层)职责重复。
//   近期速查走悬浮窗对话记录板块, 全量在备份文件夹。此处不再内嵌跨账号全量清单。

const _dvRunningMemo = new Map(); // email → Set(devinId) 上轮运行集合
const _dvRunningDetail = new Map(); // devinId → session obj (上轮详情, 供终报使用)
const _dvFinalReports = []; // 最近 N 份终报 (环形·最多 50 条, 供面板/导出)
const DV_FINAL_REPORTS_MAX = 50;

function _dvDetectFinished(email, running) {
  const key = email.toLowerCase();
  const nowRun = new Set(running.map((r) => r.devinId));
  // 更新当轮详情快照 (为下轮终报提供 session 数据)
  for (const r of running) { _dvRunningDetail.set(r.devinId, r); }
  const prevRun = _dvRunningMemo.get(key);
  if (prevRun) {
    for (const id of prevRun) {
      if (!nowRun.has(id)) {
        const st = _dvSeen.get(id);
        const _no = _dvAccountNo(email);
        const who = (_no ? "#" + _no + " " : "") + (devinCloud.getTag(email) || email.split("@")[0]);
        // v4.7.7 · 终报: 对话离场时生成结构化终报 (善始且善成)
        const detail = _dvRunningDetail.get(id);
        const stalled = _dvStallSeen.has(id);
        const report = devinCloud.conversationFinalReport(detail || { devinId: id, statusClass: st }, { stalled });
        report.account = who;
        _dvFinalReports.push(report);
        if (_dvFinalReports.length > DV_FINAL_REPORTS_MAX) _dvFinalReports.shift();
        if (st !== "blocked") {
          const durTxt = report.durationMin !== null ? " · 耗时 " + report.durationMin + " min" : "";
          const costTxt = report.cost !== null ? " · $" + report.cost.toFixed(2) : "";
          _notify("info", "[" + who + "] 对话已完成 (" + report.outcome + durTxt + costTxt + ")");
        }
        log("dv-final: " + id + " outcome=" + report.outcome + " dur=" + report.durationMin + "min cost=" + (report.cost !== null ? "$" + report.cost.toFixed(2) : "n/a") + " stalled=" + report.stalled);
        _dvRunningDetail.delete(id); // 已离场·释放内存 (无为)
      }
    }
  }
  // 清理已不活跃的详情缓存 (防内存泄漏)
  for (const id of [..._dvRunningDetail.keys()]) { if (!nowRun.has(id)) _dvRunningDetail.delete(id); }
  _dvRunningMemo.set(key, nowRun);
}

// ═══ v4.7.7 · 对话最终模块·进展摘要 (实时聚合全活跃对话的进度指标) ═══
//   道法自然·大制无割: 将分散于多账号多对话的实时状态汇聚为一份结构化摘要,
//   供面板/日志/后续「终报」一致消费。每 _dvRunPoll 轮次末调用, 写入 _dvProgressCache。
const _dvProgressCache = { ts: 0, summary: null };
function _dvProgressSummary() {
  const now = Date.now();
  let totalActive = 0, totalRunning = 0, totalAwaiting = 0, totalBlocked = 0, totalStalled = 0;
  const perAccount = [];
  for (const [email, st] of _dvStatusAgg) {
    totalActive += st.total || 0;
    totalRunning += st.running || 0;
    totalAwaiting += st.awaiting || 0;
    totalBlocked += st.blocked || 0;
    // 卡死计数: 从 _dvStallSeen 中统计该账号有多少对话已判卡死
    let stalled = 0;
    for (const item of (st.items || [])) {
      // 无法直接用 devinId (statusAgg 不存), 以 title + cls 近似 (显示用·不做自动决策)
      if (item.cls === "running" && _dvStallSeen.size > 0) stalled++; // 上界估计
    }
    totalStalled += stalled;
    perAccount.push({
      email,
      no: st.no || 0,
      tag: st.tag || "",
      running: st.running || 0,
      awaiting: st.awaiting || 0,
      blocked: st.blocked || 0,
      stalled,
      total: st.total || 0,
    });
  }
  const summary = {
    ts: now,
    totalActive,
    totalRunning,
    totalAwaiting,
    totalBlocked,
    totalStalled,
    accountCount: perAccount.length,
    perAccount,
    health: totalBlocked === 0 && totalStalled === 0 ? "green" : (totalBlocked > 0 ? "red" : "amber"),
  };
  _dvProgressCache.ts = now;
  _dvProgressCache.summary = summary;
  return summary;
}

// 自动增量备份定时器
function _dvStartAuto() {
  if (_dvAutoTimer) return;
  const mins = Math.max(5, _cfg("devinCloudAutoBackupIntervalMin", 30));
  const periodMs = mins * 60000;
  // 错峰轮询 (绝利一源): 多窗口/多账号不在同一墙钟瞬间一起备份, 避免出口 socket
  // 扇出叠加把家用路由器 NAT 打满。首次延迟随机散布在 [0, period), 之后每周期再加 ±10% 抖动。
  const jitter = () => Math.floor(periodMs * 0.1 * (Math.random() * 2 - 1));
  const tick = () => {
    if (!_dvIsLeader) { _dvAutoTimer = null; return; } // v4.8.4 · 仅主窗口备份 (失主即停)
    _dvAutoBackupRun().catch(() => {});
    _dvAutoTimer = setTimeout(tick, Math.max(60000, periodMs + jitter()));
  };
  const initial = Math.floor(Math.random() * periodMs);
  _dvAutoTimer = setTimeout(tick, initial);
  log("devin-cloud: auto-backup 定时器启动 · " + mins + "min · 错峰首延 " + Math.round(initial / 1000) + "s");
}
function _dvStopAuto() {
  if (_dvAutoTimer) {
    clearTimeout(_dvAutoTimer);
    _dvAutoTimer = null;
    log("devin-cloud: auto-backup 定时器停止");
  }
}
// 7号板块(切号)·远端本源闲置度: 返回该号最新非终态会话距今的毫秒数(全无活跃会话 → Infinity)。
//   终态会话(挂起/过期/停止/完成/归档)不计活跃 — 平台会周期性触碰终态会话的 updated_at。
async function _dvRemoteIdleMs(auth) {
  const _ls = await devinCloud.listSessions(auth);
  const _ss = (_ls && _ls.sessions) || [];
  const _TERM = { suspended: 1, expired: 1, stopped: 1, finished: 1, archived: 1, interrupted: 1, deleted: 1 };
  let _mx = 0;
  for (const _s of _ss) {
    const _st = String(_s.status_enum || _s.status || "").toLowerCase();
    if (_TERM[_st] || _s.is_archived === true || _s.is_archived === "true") continue;
    const _t = Date.parse(_s.updated_at || _s.created_at || "") || 0; if (_t > _mx) _mx = _t;
  }
  return _mx === 0 ? Infinity : Date.now() - _mx;
}
async function _dvAutoBackupRun() {
  // v4.10.0 · 修复: 不再仅依赖 cachedEmails(12h TTL), 改为遍历全池逐号按需登录 (同 devinCleanupZeroQuota 模式)
  //   旧逻辑: cachedEmails() 只返回 12h 内活跃账号 → 闲置(恰好需要清理的)账号永远被跳过 → 归零清理「根本没有用」。
  //   新逻辑: 遍历 _store.accounts, 用 _dvAuthFor(i) 按需登录, 登录失败(无密码/凭证坏)才跳过。
  if (!_store.accounts.length) return;
  const dir = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
  const mode = _cfg("devinCloudBackupMode", "folder");
  const threshold = Math.max(0, +_cfg("devinCloudAutoBackupThreshold", 3) || 3);
  const autoCleanup = !!_cfg("devinCloudAutoCleanup", true);
  // v4.9.6 · 清理阈值默认对齐备份阈值(动态·默3) → 「额度 < 3 即在全量备份校验后自动清理」(用户可调单一阈值 dvThreshold)
  const cleanupThreshold = Math.max(0, +_cfg("devinCloudAutoCleanupThreshold", threshold) || threshold);
  // v4.9.12 · 归零移除默认开 — 闭合「备份→清理→出库」整套循环: 额度彻底归零的账号在全量备份(严格校验)+清理无残留后自动出库. 取消勾选 (dvRmZero=false) 则仅清痕迹+本地留底·账号保留.
  const autoRemoveZero = !!_cfg("devinCloudAutoRemoveZeroQuota", true);
  // v4.26.6 · 出库阈值默认对齐清理阈值(清理即出库·闭环): 旧默认0 只出库「分文不剩」的号 →
  //   残留 $0.27~$2 的耗尽号被反复清理却永不出库·永久滞留仓库(实测全池如此)。
  //   用户显式配置仍优先(含显式 0=仅完全归零才出库)。
  const _rtRaw = +_cfg("devinCloudAutoRemoveThreshold", cleanupThreshold);
  const removeThreshold = Math.max(0, Number.isFinite(_rtRaw) ? _rtRaw : cleanupThreshold);
  const removeEmails = [];
  // v4.26.6 · 即时出库(逐号落盘): 旧法攒到循环末统一出库 — 全池扫描以小时计,
  //   窗口 reload/中途异常即丢 removeEmails → 已清理号永不落盘出库(实测病灶)。
  //   现法: 每号条件满足当即 _store.remove() 落盘, 循环末批处理保留为兜底。
  const _evictNow = (email, why) => {
    try {
      const _ei = _store.accounts.findIndex(
        (a) => (a.email || "").toLowerCase() === String(email).toLowerCase(),
      );
      if (_ei >= 0 && _store.remove(_ei)) {
        log("auto-remove: " + email + " 即时出库 · " + why);
        try { _broadcastUI(true); } catch {}
        return true;
      }
    } catch (e) { log("auto-remove error: " + email + ": " + (e.message || e)); }
    removeEmails.push(email);
    return false;
  };
  for (let _abIdx = 0; _abIdx < _store.accounts.length; _abIdx++) {
    const acc = _store.accounts[_abIdx];
    if (!acc || !acc.email) continue;
    // v4.10.0: 按需登录 — 缓存有效直接用, 过期则 _dvAuthFor 重新登录(需密码), 无密码/登录失败 → 跳过
    let auth = devinCloud.getCachedAuth(acc.email);
    if (!auth) {
      try { const r = await _dvAuthFor(_abIdx); if (r && r.ok) auth = r; } catch {}
    }
    if (!auth) continue;
    // 编号(同步 WAM)+ 密码 写入备份目录命名 (账号+密码表层·编号 1:1)
    const naming = { accountNo: _dvAccountNo(acc.email), password: acc.password || "" };
    try {
      // v4.4.0: 检查额度阈值 · 低于阈值时触发全量备份
      let billing = null;
      try { billing = await devinCloud.getBilling(auth); } catch {}
      const totalCredits = _billingTotalDollars(billing);
      // 7号板块(切号)·闲置触发: 24h 无活跃对话 → 全量自动备份 → 清理出库 (与低额触发并联·同一闭环)。
      //   软编码: wam.devinCloudIdleCleanup(默 true) · wam.devinCloudIdleHours(默 24)。
      const lowCredit = totalCredits !== null && totalCredits < threshold;
      let idleTrigger = false;
      if (!lowCredit && !!_cfg("devinCloudIdleCleanup", true)) {
        try {
          const _idleMs = await _dvRemoteIdleMs(auth);
          const _idleWin = Math.max(1, +_cfg("devinCloudIdleHours", 24) || 24) * 3600000;
          idleTrigger = _idleMs >= _idleWin;
          if (idleTrigger) log("idle-cleanup: " + acc.email + " 远端无活跃对话" + (isFinite(_idleMs) ? "~" + Math.round(_idleMs / 3600000) + "h" : "(全无活跃会话)") + " ≥ " + Math.round(_idleWin / 3600000) + "h → 触发 全量备份→清理→出库");
        } catch {}
      }
      if (lowCredit || idleTrigger) {
        const _credits = totalCredits !== null ? totalCredits : 0;
        // v4.10.2 · 先门控后备份(根治「老号清不动」): 旧法对每个低额号每周期都先跑一遍全量备份,
        //   再查冷却门 — 百余归零号 × 全量备份(分钟级/号) → 单轮扫描以小时计, 窗口一 reload 又从头,
        //   队尾老号永远轮不到清理。修法: 冷却门/本源判老(廉价·一次 listSessions)先行, 全量备份只在
        //   三种真正需要时做: ① 首备落锚(开启 24h 冷却钟) ② 清理前留底(临删前拍最终快照) ③ 用户关闭
        //   自动清理(仅留底模式)。门未满的号零备份直接跳过 → 单轮分钟级扫完全池, 老号真正清得动。
        const cooldownMs = Math.max(0, +_cfg("devinCloudCleanupCooldownHours", 24) || 24) * 3600000;
        const cleanupCheck = devinCloud.isCleanupReady(acc.email, cooldownMs);
        // addedAt 24h 免出库保护 (对照手机 APK): 重加/新加的账号在冷却期内绝不自动移出库
        const _addedRecently = acc.addedAt && Date.now() - acc.addedAt < cooldownMs;
        // 本源判老(对照手机 APK·根治「老旧归零号还要再等 24h」): 冷却锚点只是「我们何时首次备份」,
        //   与账号真实活跃无关 — 陈年归零号锚点新落也得干等 24h。故锚点未满时再看远端本源:
        //   该号最新对话 updated_at 已早于冷却窗(或全无对话) → 账号本就沉寂, 直接视为冷却已满。
        //   活跃归零号(远端近 24h 有更新)由此门天然豁免 — 只清老号, 绝不动近期在用的号。
        if (autoCleanup && !cleanupCheck.ready && cleanupCheck.reason === "cooldown" && !_addedRecently && (_credits <= cleanupThreshold || idleTrigger)) {
          try {
            const _ls = await devinCloud.listSessions(auth);
            const _ss = (_ls && _ls.sessions) || [];
            let _mx = 0;
            // 终态会话(挂起/过期/停止/完成/归档)不计活跃: 平台会周期性触碰终态会话(尤其 suspended)
            //   的 updated_at → 陈年归零号恒有「假·新鲜」时间戳, 本源判老永不通过(实测全池如此)。
            const _TERM = { suspended: 1, expired: 1, stopped: 1, finished: 1, archived: 1, interrupted: 1, deleted: 1 };
            for (const _s of _ss) {
              const _st = String(_s.status_enum || _s.status || "").toLowerCase();
              if (_TERM[_st] || _s.is_archived === true || _s.is_archived === "true") continue;
              const _t = Date.parse(_s.updated_at || _s.created_at || "") || 0; if (_t > _mx) _mx = _t;
            }
            if (_mx === 0 || Date.now() - _mx >= cooldownMs) {
              cleanupCheck.ready = true;
              log("auto-cleanup: " + acc.email + " 冷却锚点未满但远端最新对话已沉寂" + (_mx ? "~" + Math.round((Date.now() - _mx) / 3600000) + "h" : "(无对话)") + " → 本源判老·视为冷却已满");
            }
          } catch {}
        }
        const _willClean = autoCleanup && cleanupCheck.ready && (_credits <= cleanupThreshold || idleTrigger);
        const _needAnchor = cleanupCheck.reason === "no_backup" || cleanupCheck.reason === "already_cleaned";
        let backupRes = null, backupOk = false;
        if (_needAnchor || _willClean || !autoCleanup) {
          log("auto-backup: " + acc.email + (idleTrigger ? " 闲置触发(24h 无活跃)" : " 额度 $" + _credits.toFixed(2) + " < $" + threshold) + " → 全量备份(" + (_willClean ? "清理前留底" : _needAnchor ? "首备落锚" : "仅留底") + ")");
          try {
            backupRes = (mode === "folder")
              ? await devinCloud.backupAccountFullFolders(auth, Object.assign({ targetDir: dir, incremental: false }, naming))
              : await devinCloud.backupAccountFull(auth, Object.assign({ targetDir: dir, incremental: false }, naming));
            // v4.9.0: 严格校验「全量备份」真正完整, 唯有完整才允许后续破坏性清理 (数据一定要全量备份完)
            backupOk = _dvBackupVerifiedFull(backupRes);
            if (!backupOk) log("auto-backup: " + acc.email + " 备份未通过完整性校验 → 跳过自动清理(未全量备份不删) · " + _dvBackupVerifyNote(backupRes));
            // v4.10.1 · 冷却期锚点「本源起算」: 仅当尚无锚点、或上轮已清理(cleanedAt≥旧锚点·需为新一轮
            //   重新起算)时落点; 锚点保持不动 → 24h 真正能走完。充值再用由 recent_update 门守住, 不误清。
            if (backupOk) {
              const _cs = devinCloud.getCleanupState(acc.email);
              if (!_cs || !_cs.backupCompletedAt || (_cs.cleanedAt && _cs.cleanedAt >= _cs.backupCompletedAt)) {
                devinCloud.setCleanupState(acc.email, { backupCompletedAt: Date.now() });
              }
            }
          } catch (be) {
            log("auto-backup full error: " + acc.email + ": " + (be.message || be) + " → 跳过自动清理(未备份不删)");
          }
        }
        if (autoCleanup && (_credits <= cleanupThreshold || idleTrigger)) {
          if (!cleanupCheck.ready) {
            // 补出库: 上一轮已清理但未出库(旧版无出库/中途断) 的归零账号 —— 备份已校验、
            //   痕迹已清、24h 无新对话 → 直接出库, 不再卡死在 already_cleaned 永久滞留态。
            const _cs2 = devinCloud.getCleanupState(acc.email);
            const _staleConv = !_cs2 || !_cs2.lastConvUpdateAt || Date.now() - _cs2.lastConvUpdateAt >= cooldownMs;
            if (
              cleanupCheck.reason === "already_cleaned" &&
              autoRemoveZero &&
              !_addedRecently &&
              _staleConv &&
              (_credits <= removeThreshold || idleTrigger)
            ) {
              if (_evictNow(acc.email, "额度归零·痕迹已清(上轮)·补出库")) _abIdx--;
              _notify("info", "[" + acc.email.split("@")[0] + "] 额度归零·痕迹已清(上轮) → 补出库");
            } else {
              const hrs = cleanupCheck.remaining ? Math.ceil(cleanupCheck.remaining / 3600000) : "?";
              log("auto-cleanup: " + acc.email + " 冷却期未满(" + cleanupCheck.reason + ", 剩余~" + hrs + "h) → 跳过清理");
            }
          } else if (!backupOk) {
            log("auto-cleanup: " + acc.email + " 冷却已满但清理前留底备份未通过校验 → 跳过(未全量备份不删·守柔)");
          } else {
            log("auto-cleanup: " + acc.email + (idleTrigger ? " 闲置触发(24h 无活跃)" : " 额度 $" + _credits.toFixed(2) + " ≤ $" + cleanupThreshold) + " 且全量备份已校验+24h冷却期已满 → 自动清理");
            try {
              const rep = await devinCloud.wipeAccount(auth, { onProgress: (m) => log("auto-cleanup: " + m) });
              log("auto-cleanup: " + acc.email + " 完成 · 对话已清理" + rep.sessions.deleted + " 知识" + rep.knowledge.deleted + " 剧本" + rep.playbooks.deleted + " 密钥" + rep.secrets.deleted);
              try { await devinGit.robustDisconnectGit(auth); } catch (ge) { log("auto-cleanup git: " + ge.message); }
              _dvOverviewCache.delete(acc.email.toLowerCase());
              devinCloud.setCleanupState(acc.email, { cleanedAt: Date.now() });
              const wipeClean = !!rep && rep.sessions.failed === 0 && rep.knowledge.failed === 0 && rep.playbooks.failed === 0 && rep.secrets.failed === 0;
              if (autoRemoveZero && wipeClean && !_addedRecently && (_credits <= removeThreshold || idleTrigger)) {
                if (_evictNow(acc.email, "已全量备份+清理无残留")) _abIdx--;
                _notify("info", "[" + acc.email.split("@")[0] + "] 额度归零 · 已全量备份+清理 → 从账号库移除");
              } else {
                // 出库决策落盘可见可验(旧法仅 toast → 静默跳过无从排查)
                log("auto-remove: " + acc.email + " 不出库 · autoRemoveZero=" + autoRemoveZero + " wipeClean=" + wipeClean + (wipeClean ? "" : "(对话残" + rep.sessions.failed + " 知识残" + rep.knowledge.failed + " 剧本残" + rep.playbooks.failed + " 密钥残" + rep.secrets.failed + ")") + " addedRecently=" + !!_addedRecently + " idleTrigger=" + idleTrigger + " credits=$" + _credits.toFixed(2) + " vs 出库阈值$" + removeThreshold);
                _notify("info", "[" + acc.email.split("@")[0] + "] 自动清理完成 · 已回归本源(对话已清理" + rep.sessions.deleted + "条·本地已留底)");
              }
            } catch (ce) {
              log("auto-cleanup error: " + acc.email + ": " + ce.message);
            }
          }
        }
      } else {
        // 正常增量备份 + 更新活动检测 (24h 冷却期: 有新事件则刷新 lastConvUpdateAt)
        let incrRes = null;
        if (mode === "folder") {
          incrRes = await devinCloud.backupAccountFolders(auth, Object.assign({ targetDir: dir, incremental: true }, naming));
        } else {
          incrRes = await devinCloud.backupAccount(auth, Object.assign({ targetDir: dir, incremental: true }, naming));
        }
        if (incrRes && (incrRes.backedUp || 0) > 0) {
          devinCloud.setCleanupState(acc.email, { lastConvUpdateAt: Date.now() });
        }
      }
    } catch (e) {
      log("auto-backup error: " + acc.email + ": " + (e.message || e));
    }
  }
  // v4.9.0 · 归零账号统一出库 (循环外·避免迭代中改数组) — 备份+清理已完成且痕迹已清, 此处仅从账号库移除
  if (removeEmails.length) {
    const idx = removeEmails
      .map((em) => _store.accounts.findIndex((a) => (a.email || "").toLowerCase() === String(em).toLowerCase()))
      .filter((i) => i >= 0);
    if (idx.length) {
      _store.removeBatch(idx);
      log("auto-remove: 归零账号出库 " + idx.length + " 个 · " + removeEmails.join(", "));
      try { _broadcastUI(true); } catch {}
    }
  }
}
// v4.4.0: 从 billing 提取可用余额(美元) · 委托 devin_cloud.billingBalance(可单测·实测字段)
// 返回 null = 无法判定 → 调用方据此跳过破坏性自动清理(防误删健康号)
function _billingTotalDollars(billing) {
  return devinCloud.billingBalance(billing);
}
// v4.9.0 · 严格校验「全量备份」是否真正完整 — 唯有完整才允许后续破坏性清理。
//   对话: 无异常(convError 空) 且 failed===0; 账号数据快照: 非 partial(知识/剧本/密钥/Git/会话全拉到)。
//   account 无对话 → conversations.total=0/failed=0 视为完整 (无可备亦即备齐)。
function _dvBackupVerifiedFull(res) {
  if (!res || !res.ok) return false;
  if (res.convError) return false;
  const c = res.conversations;
  if (!c || (c.failed || 0) > 0) return false;
  const s = res.snapshot;
  if (!s || s.partial) return false;
  return true;
}
function _dvBackupVerifyNote(res) {
  if (!res) return "无备份结果";
  const parts = [];
  if (res.convError) parts.push("对话异常:" + res.convError);
  if (res.conversations && (res.conversations.failed || 0) > 0) parts.push("对话失败" + res.conversations.failed);
  if (!res.conversations) parts.push("无对话结果");
  if (res.snapshot && res.snapshot.partial) parts.push("快照部分:" + ((res.snapshot.errors || []).join("/")));
  if (!res.snapshot) parts.push("无快照");
  return parts.join(" · ") || "未知";
}

// ═══ v4.5.0 · 对话额度上限 (per-conversation quota cap · 知止不殆 · 道法自然) ═══
//   核心: 每对话使用额度上限 = 账号实时余额 - 缓冲(默 $3)。
//         (余额 $70 → 上限 $67; 消耗至 $55 → 自动下调上限 $52。与官网每刀额度同步·精确到分)
//   使用中判定: 余额较上轮下降(正在消耗) 或 有运行中对话 → 该账号"使用中"。
//   自适应轮询: 使用中提速(秒级·默 30s)、空闲降速(分钟级·默 30min) — 日常无谓频繁。
//   余额 ≤ 停止阈值($3) → 自动中停其运行中对话 (devinCloud.stopSession 实探端点·不臆造)。
const _dvConvCap = new Map(); // email(lc) → { balance, cap, lastBalance, inUse, ts, stopped:Set<devinId> }
let _dvConvCapTimer = null;
function _dvConvBuffer() { return Math.max(0, +_cfg("devinCloudConvQuotaBuffer", 3) || 0); }
function _dvConvStopThreshold() { return Math.max(0, +_cfg("devinCloudConvStopThreshold", 3) || 0); }
function _dvConvDrainFloor() { return Math.max(0, +_cfg("devinCloudConvDrainFloor", 0.1) || 0); }
function _dvConvCapFor(email) { return _dvConvCap.get(String(email || "").toLowerCase()) || null; }

// 一轮: 拉各已登录账号余额(精确到分)→ 算上限 → 检测使用中 → 必要时中停 → 广播前端。
// 返回 true = 有账号使用中 (供调度器提速下一轮)。
async function _dvConvCapTick() {
  if (!_cfg("devinCloudConvQuotaCap", true)) return false;
  const emails = new Set(devinCloud.cachedEmails());
  if (!emails.size) return false;
  const buffer = _dvConvBuffer();
  const stopAt = _dvConvStopThreshold();
  const drainOn = !!_cfg("devinCloudConvDrainToZero", true);
  const floor = _dvConvDrainFloor();
  let anyInUse = false;
  const items = [];
  for (const acc of _store.accounts) {
    const key = (acc.email || "").toLowerCase();
    if (!emails.has(key)) continue;
    const auth = devinCloud.getCachedAuth(acc.email);
    if (!auth) continue;
    let balance = null;
    try { balance = devinCloud.billingBalance(await devinCloud.getBilling(auth)); } catch {}
    if (balance === null) continue; // 无法判定余额 → 跳过(安全·不臆断)
    const prev = _dvConvCap.get(key) || { stopped: new Set() };
    // 反向重置·将欲予之必故予之: 余额抵缓冲(上限本将归0)→ 不困住这笔钱, 把上限反抬回剩余余额, 让美金用尽。
    const { cap, drain } = devinCloud.computeConvCap(balance, buffer, drainOn, floor);
    let running = [];
    try { running = await devinCloud.listRunningSessions(auth); } catch {}
    const consuming = typeof prev.balance === "number" && balance < prev.balance - 0.001;
    const inUse = consuming || running.length > 0;
    if (inUse) anyInUse = true;
    // 知止: 抽干模式下仅在真正见底(≤地板)才中停; 否则沿用停止阈值。每对话仅尝试一次·避免重复打扰。
    const stopBound = drainOn ? floor : stopAt;
    if (balance <= stopBound && running.length) {
      for (const r of running) {
        if (prev.stopped.has(r.devinId)) continue;
        try {
          const st = await devinCloud.stopSession(auth, r.devinId);
          if (st.stopped) {
            prev.stopped.add(r.devinId);
            _notify("warn", "[" + (devinCloud.getTag(acc.email) || key.split("@")[0]) + "] 余额 $" + balance.toFixed(2) + " ≤ $" + stopBound + (drainOn ? "(抽干地板·已用尽)" : "") + " · 已中停对话: " + r.title);
            log("conv-cap: 已中停 " + r.devinId + " (bal=$" + balance.toFixed(2) + " via " + st.endpoint + ")");
          } else {
            log("conv-cap: stopSession 无可用端点 " + r.devinId + " · " + JSON.stringify(st.tried));
          }
        } catch (e) { log("conv-cap stop err: " + (e.message || e)); }
      }
    } else if (drain && running.length) {
      // 进入抽干模式且仍在运行 → 把曾因旧阈值停过的记录释放(本轮不停), 仅记录日志
      log("conv-cap: 抽干模式 " + key.split("@")[0] + " bal=$" + balance.toFixed(2) + " 上限反抬至 $" + cap.toFixed(2) + " · 不中停·让美金用尽");
    }
    // v4.9.5 · 反向注入·随时及时: 把算出的 cap 实时写入该账号「每条消息额度上限」(Devin Usage limits)。
    //   余额70→上限67→64 跟随; 抽干模式下 cap 反抬回余额(>缓冲)让美金真正用尽。
    //   仅在 cap 较上轮变化时回写(幂等·避免无谓并发请求, 不重蹈批量并发卡网覆辙)。
    let injectedCap = prev.injectedCap;
    if (_cfg("devinCloudConvInjectLimit", true) && Number.isFinite(cap) && cap >= 0) {
      const capInt = devinCloud.messageLimitInt(cap); // 服务端 max_credits 须为整数≥1·向下取整·不可设则 null
      if (capInt !== null) {
        // 幂等按「实际下发的整数」比对(旧版按浮点比对·每轮微抖即误判变化→空写刷屏)
        const changed = typeof prev.injectedCap !== "number" || Math.floor(prev.injectedCap) !== capInt;
        if (changed) {
          try {
            const sr = await devinCloud.setMessageLimit(auth, capInt);
            if (sr.ok) { injectedCap = capInt; log("conv-cap: 反注消息上限 " + key.split("@")[0] + " → " + capInt + (drain ? "(抽干)" : "")); }
            else log("conv-cap: 反注消息上限失败 " + key.split("@")[0] + " status=" + sr.status);
          } catch (e) { log("conv-cap inject-limit err: " + (e.message || e)); }
        }
      }
    }
    _dvConvCap.set(key, { balance, cap, drain, injectedCap, lastBalance: prev.balance, inUse, ts: Date.now(), stopped: prev.stopped });
    items.push({ email: key, balance: +balance.toFixed(2), cap, drain, inUse, stopThreshold: stopBound, injectedCap });
  }
  _broadcastMsg({ type: "devinConvCap", items });
  return anyInUse;
}

// 自适应自调度: 使用中→秒级、空闲→分钟级。开关关闭则不调度。
function _dvConvCapSchedule() {
  if (_dvConvCapTimer) { clearTimeout(_dvConvCapTimer); _dvConvCapTimer = null; }
  if (!_cfg("devinCloudConvQuotaCap", true)) return;
  const run = async () => {
    let inUse = false;
    try { inUse = await _dvConvCapTick(); } catch (e) { log("conv-cap tick err: " + (e.message || e)); }
    const activeSec = Math.max(10, +_cfg("devinCloudConvPollActiveSec", 30) || 30);
    const idleMin = Math.max(1, +_cfg("devinCloudConvPollIdleMin", 30) || 30);
    const nextMs = inUse ? activeSec * 1000 : idleMin * 60000;
    _dvConvCapTimer = setTimeout(run, nextMs);
  };
  _dvConvCapTimer = setTimeout(run, 3000);
  log("conv-cap: 对话额度上限调度启动 · buffer=$" + _dvConvBuffer() + " stop=$" + _dvConvStopThreshold());
}
function _dvConvCapStop() {
  if (_dvConvCapTimer) { clearTimeout(_dvConvCapTimer); _dvConvCapTimer = null; log("conv-cap: 调度停止"); }
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
    // 用 Python 直接读 vscdb (最完整·覆盖当前活跃对话)
    const pyExe = _findPythonExt();
    const helperPy = path.join(__dirname, "_vscdb_helper.py");
    if (!pyExe || !fs.existsSync(helperPy)) return;
    // v3.12.0: 设 PYTHONIOENCODING=utf-8 · 三重保险第三层
    const r = require("child_process").spawnSync(pyExe, [helperPy], {
      timeout: 10000,
      windowsHide: true,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    if (r.status !== 0 || !r.stdout) return;
    const sessions = JSON.parse(r.stdout.trim());
    if (!Array.isArray(sessions)) return;
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
// v4.9.8 · F2/F3 根因修复 — 对话区 HTML 内嵌每秒变动的相对时间(staleSec "Ns前")/文件大小(sizeKB 流式增长)/引擎age,
//   导致 m.html 每轮轮询都不同 → 旧的 html 全等去抖失效 → conv-section 每 2s 整段重建 → 滚动丢失/闪烁/✕忽隐忽现。
//   解法: 计算"剔除易变装饰"的稳定签名, 仅当结构性内容(对话集/状态/计数/✕id)真变化时才换 DOM。
function _convSig(html) {
  try {
    return String(html)
      .replace(/title="[^"]*"/g, "")                                   // 去全部 tooltip(含引擎age/标题悬浮)
      .replace(/\d+(?:\.\d+)?\s*KB/g, "#KB")                           // 文件大小(流式增长)
      .replace(/\d+\s*min前/g, "#T").replace(/\d+\s*s前/g, "#T")        // 相对时间"N分/秒前"
      .replace(/<span class="cv-stale">[^<]*<\/span>/g, '<span class="cv-stale"></span>') // 卡住相对时长
      .replace(/\s+/g, " ").trim();                                     // 归一空白
  } catch (e) {
    return String(html);
  }
}
function _broadcastConvSection() {
  const html = _getConvTrackingHtml();
  // v4.9.9 · 优先用结构签名(纯数据·无易变装饰); 退化用 html 屏蔽签名
  _broadcastMsg({ type: "convUpdate", html, sig: _convStructSig || _convSig(html) });
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
  // 归一 · 内嵌「切号」: 同一广播回推给宿主 → 中继进六板 iframe (toast/切号/对话区增量)
  if (_hostPost) {
    try { _hostPost(msg); } catch {}
  }
}

// email 锚定索引解析: 前端行索引可能因渲染后库变动而错位, 有 email 时以 email 为准
function _resolveAccIdx(index, email) {
  const em = String(email || "").toLowerCase();
  if (em) {
    const i = _store.accounts.findIndex((a) => (a.email || "").toLowerCase() === em);
    if (i >= 0) return i;
    return -1;
  }
  const n = +index;
  return Number.isInteger(n) && n >= 0 && n < _store.accounts.length ? n : -1;
}
function _resolveAccIdxBatch(indices, emails) {
  const out = [];
  const ix = Array.isArray(indices) ? indices : [];
  const ems = Array.isArray(emails) ? emails : [];
  for (let k = 0; k < Math.max(ix.length, ems.length); k++) {
    const i = _resolveAccIdx(ix[k], ems[k]);
    if (i >= 0) out.push(i);
  }
  return [...new Set(out)];
}

async function handleWebviewMessage(msg) {
  try {
    if (msg && /^(routeToIde|routeToIdeBatch|openSysBrowser|openSysBrowserBatch|convRouteToIde|convOpenSysBrowser)$/.test(msg.type)) {
      _routeDbg("handleWebviewMessage type=" + msg.type + " index=" + (msg.index) + " indices=" + JSON.stringify(msg.indices || null) + " email=" + (msg.email || "") + " devinId=" + (msg.devinId || ""));
    }
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
      // ★ 归一 · 路由官网→IDE 内置浏览器 (自足注入反代·多实例标签·不赖 dao-vsix)
      //   首选: rt-flow 自带每账号独立端口注入反代 → IDE webview 标签自动登录该账号
      //   (各号独立 origin → localStorage 隔离 → 多标签各登各号, 无需全局切号)。
      //   回退: dao-vsix 反代 → simpleBrowser (无注入·仅兜底)。
      case "routeToIde": {
        await _routeAccountToIde(msg.index);
        break;
      }
      // v4.16.0 · 多选批量: 选中 N 个后点任一 → 依次路由官网→IDE 多实例标签 (各登各号·小间隔防风暴)
      case "routeToIdeBatch": {
        const ixs = Array.isArray(msg.indices) ? msg.indices.filter((n) => Number.isFinite(n)) : [];
        _toast("⏳ 批量路由官网→IDE · " + ixs.length + " 个…");
        for (const ix of ixs) { await _routeAccountToIde(ix); await new Promise((r) => setTimeout(r, 500)); }
        _toast("🖥 批量路由完成 · " + ixs.length + " 个");
        break;
      }
      // ★ 归一 · 系统浏览器多实例隔离 + 账号注入 (v4.9.0 · 自足直注优先)
      //   首选 devin_web 自足直注: 独立 --user-data-dir profile + CDP 注入 auth1_session 直登
      //     app.devin.ai (不赖 dao-vsix 反代/本地端口·多实例互不串号·根治"打开是死页/没作用")。
      //   失败回退 dao-vsix 反代隔离启动器; 再无 Chrome/Edge 才落系统默认浏览器。
      //   全程即时 toast + 必有兜底 → 杜绝"点了完全没反应"。
      case "openSysBrowser": {
        await _openAccountSysBrowser(msg.index);
        break;
      }
      // v4.16.0 · 多选批量: 选中 N 个后点任一 → 依次开独立隔离浏览器实例 (各登各号·稍大间隔防启动风暴)
      case "openSysBrowserBatch": {
        const ixs = Array.isArray(msg.indices) ? msg.indices.filter((n) => Number.isFinite(n)) : [];
        _toast("⏳ 批量系统浏览器 · " + ixs.length + " 个…");
        for (const ix of ixs) { await _openAccountSysBrowser(ix); await new Promise((r) => setTimeout(r, 800)); }
        _toast("🌐 批量打开完成 · " + ixs.length + " 个");
        break;
      }
      // v4.16.0 · 对话级直达: 对话追踪行「IDE内多实例」→ 直接开此对话(注入该号登录)的 IDE 标签
      case "convRouteToIde": {
        const email = String(msg.email || "").trim();
        // Ask/ada 查询 id(非 devin- 前缀)无 /sessions/<id> 页 → 降级开该号主页(仍可用)
        const did = (function (v) { return /^devin-/.test(v) ? v : ""; })(String(msg.devinId || "").trim());
        if (!email) break;
        _toast("⏳ 此对话→IDE · " + email.split("@")[0]);
        try {
          const idx = _store.accounts.findIndex((a) => String(a.email).toLowerCase() === email.toLowerCase());
          const pw = idx >= 0 ? _store.accounts[idx].password : undefined;
          const r = await openMultiInstance({ email, password: pw, devinId: did });
          if (r.ok) { _toast("🖥 已开此对话标签 · " + email.split("@")[0]); break; }
          _toast("✗ 打开失败: " + (r.error || ""));
        } catch (e) { _toast("✗ 异常: " + (e && e.message)); }
        break;
      }
      // v4.16.0 · 对话级直达: 对话追踪行「浏览器多实例」→ 独立隔离实例直开此对话(注入该号登录)
      case "convOpenSysBrowser": {
        const email = String(msg.email || "").trim();
        // Ask/ada 查询 id(非 devin- 前缀)无 /sessions/<id> 页 → 降级开该号主页(仍可用)
        const did = (function (v) { return /^devin-/.test(v) ? v : ""; })(String(msg.devinId || "").trim());
        if (!email) break;
        const who = email.split("@")[0];
        _toast("⏳ 此对话→系统浏览器 · " + who);
        const _sid = did.replace(/^devin-/, "");
        try {
          let auth = devinCloud.getCachedAuth(email);
          if (!auth) {
            const idx = _store.accounts.findIndex((a) => String(a.email).toLowerCase() === email.toLowerCase());
            const pw = idx >= 0 ? _store.accounts[idx].password : "";
            if (pw) { const r = await devinCloud.getAuth(email, pw); if (r && r.ok) auth = r; }
          }
          const pagePath = _sid ? ("sessions/" + _sid) : "";
          const res = await devinWeb.launchAccountBrowser({ email, auth1: auth && auth.auth1, userId: auth && auth.userId, orgId: auth && auth.orgId, orgName: auth && auth.orgName, pagePath, log });
          if (res.ok) { _toast(res.injected ? "🌐 独立实例已开此对话 · " + who : "🌐 独立实例已开 · " + who); break; }
        } catch (e) { log("convOpenSysBrowser 异常 " + (e && e.message)); }
        try { await vscode.env.openExternal(vscode.Uri.parse("https://app.devin.ai" + (_sid ? "/sessions/" + _sid : ""))); _toast("🌐 默认浏览器已打开此对话"); } catch (e) { _toast("✗ 失败: " + (e && e.message)); }
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
      case "remove": {
        // 按 email 锚定行(防前端渲染后库变动→索引错位误删/漏删)
        const _ri = _resolveAccIdx(msg.index, msg.email);
        if (_ri < 0) { _toast("✗ 删除失败: 账号已不在库 (" + String(msg.email || msg.index) + ")"); _broadcastUI(true); break; }
        const _em = _store.accounts[_ri].email;
        const _ok = _store.remove(_ri);
        _toast(_ok ? "✓ 已删除 " + _em : "✗ 删除失败 " + _em);
        _broadcastUI(true);
        break;
      }
      case "removeBatch": {
        const _ixs = _resolveAccIdxBatch(msg.indices || [], msg.emails || []);
        const r = _store.removeBatch(_ixs);
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
        _broadcastUI(true);
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
        if (r.updated > 0) info += " · 改密 " + r.updated;
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
          const newEmails = [
            ...(r.addedEmails || []),
            ...(r.updatedEmails || []), // 改密账号同样即时重验 (清陈旧 health 后按新密码验证)
          ];
          if (newEmails.length > 0) {
            const _vq = [...newEmails]; // 共享队列 · 3 worker 竞争消费
            log(
              "addBatch · 新加 " +
                (r.addedEmails || []).length +
                " · 改密 " +
                (r.updatedEmails || []).length +
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
          // v4.6.0 反转: 显式记录两态 (解锁也存 false · 防 disk 读失败时被默认锁覆盖)
          _store._savedAccountMeta[k] = { skipAutoSwitch: locked };
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
          // v4.6.0 反转: 显式记录两态 (解锁也存 false)
          _store._savedAccountMeta[_lk] = { skipAutoSwitch: !!acc3.skipAutoSwitch };
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
      // v4.6.0 · Devin Cloud 独立备份目录选择 (与 Cascade conversationBackupDir 完全分开 · 问题④)
      case "devinSelectBackupDir": {
        const picked = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: "选择 Devin Cloud 备份目录",
          title: "选择 Devin Cloud 对话备份存储位置 (独立于 Cascade · 已有备份将自动迁移)",
        });
        if (picked && picked.length > 0) {
          const newDir = picked[0].fsPath;
          const oldDir =
            _cfg("devinCloudBackupDir", "") ||
            (devinCloud.paths && devinCloud.paths.DC_BACKUP_DEFAULT) ||
            "";
          // 自动迁移旧目录已有备份 → 新目录 (与 Cascade 迁移逻辑一致)
          if (oldDir && oldDir !== newDir && fs.existsSync(oldDir)) {
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
              log("devin-backup-migrate: " + moved + " 项 " + oldDir + " → " + newDir);
            } catch (e) {
              log("devin-backup-migrate err: " + (e.message || e));
            }
          }
          await vscode.workspace
            .getConfiguration("wam")
            .update(
              "devinCloudBackupDir",
              newDir,
              vscode.ConfigurationTarget.Global,
            );
          _toast("✓ Devin Cloud 备份目录: " + newDir);
          log("devin-cloud-backup-dir: " + newDir);
          // 立即触发一次全量备份 (账号库内所有可登录账号) · 不阻塞 UI
          _dvAutoBackupRun().catch((e) => log("devin set-dir backup err: " + ((e && e.message) || e)));
          _broadcastConvSection();
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
      // v4.0 · Devin Cloud 备份浏览 (账号→对话ZIP 树) · 道法自然
      case "devinBrowseBackups": {
        try {
          const root = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
          const tree = devinCloud.listBackups(root);
          _broadcastMsg({ type: "devinBackupTree", tree });
        } catch (e) {
          _toast("\u2717 浏览备份失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.8.3 · 浏览备份: 直接查看某条对话备份的正文 (打开 对话.html · 不解压·不回弹)
      case "devinViewBackupConv": {
        try {
          let p = msg.path;
          // 传目录则取其 对话.html
          try { if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "对话.html"); } catch {}
          if (!p || !fs.existsSync(p)) { _toast("\u2717 未找到对话正文 (对话.html)"); break; }
          const html = fs.readFileSync(p, "utf8");
          const panel = vscode.window.createWebviewPanel(
            "wam.backupConv", "备份对话 · " + path.basename(path.dirname(p)).slice(0, 28),
            vscode.ViewColumn.Active, { enableScripts: false, retainContextWhenHidden: true },
          );
          panel.webview.html = html;
          _toast("\u2713 已打开备份对话");
        } catch (e) {
          _toast("\u2717 查看失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.8.3 · 浏览备份: 在系统文件管理器中定位某文件夹 (对话目录/账号信息)
      case "devinRevealPath": {
        try {
          if (!msg.path || !fs.existsSync(msg.path)) { _toast("\u2717 路径不存在"); break; }
          await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(msg.path));
        } catch (e) {
          _toast("\u2717 定位失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.9.7 · F1: 取消追踪某条 Devin Cloud 对话(点叉号) — devinId 入永久取消集·持久·跨窗口, 立即从聚合移除并刷新追踪区
      case "dvUntrackConv": {
        try {
          const _id = String(msg.id || "");
          if (!_id) break;
          _untrackedConvUuids.add(_id);
          _saveUntrackedToDisk();
          // 从聚合状态剔除该对话 → 计数/列表即时更新 (无须等下一轮轮询)
          for (const [_em, _st] of _dvStatusAgg) {
            if (!_st || !Array.isArray(_st.items)) continue;
            const kept = _st.items.filter((x) => x.id !== _id);
            if (kept.length !== _st.items.length) {
              _st.items = kept;
              _st.total = kept.length;
              _st.running = kept.filter((x) => x.cls === "running").length;
              _st.awaiting = kept.filter((x) => x.cls === "awaiting").length;
              _st.blocked = kept.filter((x) => x.cls === "blocked").length;
              if (!kept.length) _dvStatusAgg.delete(_em);
            }
          }
          try { _dvWriteSharedStatus(); } catch {}
          try { _broadcastConvSection(); } catch {}
          _toast("\u2713 已取消追踪此对话");
        } catch (e) {
          log("dvUntrackConv err: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.9.6 · C: 已清零号本地对话拉取 — 从本地备份目录读取本账号对话清单(可查看/定位/ZIP), 数据已云→本地, 与云端残留并行可见
      case "dvLocalConvs": {
        try {
          const accL = _store.accounts[msg.index];
          const emailL = accL && accL.email ? accL.email : "";
          const rootL = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
          const treeL = devinCloud.listBackups(rootL);
          const meL = (treeL.accounts || []).find((a) => (a.email || "").toLowerCase() === emailL.toLowerCase());
          const convsL = ((meL && meL.conversations) || []).map((c) => ({
            title: c.title || c.name || "", path: c.path, htmlPath: c.htmlPath || "",
            hasHtml: !!c.hasHtml, type: c.type, num: c.num || 0, eventCount: c.eventCount || 0,
          }));
          _broadcastMsg({ type: "dvLocalConvList", index: msg.index, html: _dvLocalConvHtml(convsL, msg.index, meL ? meL.dir : "") });
        } catch (e) {
          _broadcastMsg({ type: "dvLocalConvList", index: msg.index, html: '<span style="color:#f44">读取本地备份失败: ' + _esc(String((e && e.message) || e)) + "</span>" });
        }
        break;
      }
      // v4.0 · 一键解锁(解压)某个对话备份 ZIP → 同名文件夹并打开
      case "devinUnlockBackup": {
        try {
          const res = devinCloud.unlockBackup(msg.zipPath, {});
          if (res.ok) {
            _toast("\u2713 已解锁 " + res.files + " 个文件 → " + res.outDir);
            // revealFileInOS 在系统文件管理器中定位解压目录; 比 openExternal(dir)
            // 更稳妥 — 后者在 explorer 启动失败时会弹出原生错误框 (实测 0x2)。
            try {
              await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(res.outDir));
            } catch {}
          } else {
            _toast("\u2717 解锁失败: " + (res.error || "未知"));
          }
        } catch (e) {
          _toast("\u2717 解锁失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.0 · 代替用户发起一个 Devin Cloud 对话 (createSession)
      case "devinCreateSession": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        let prompt = msg.prompt;
        if (typeof prompt !== "string") {
          prompt = await vscode.window.showInputBox({
            title: "Devin Cloud · 代替我发起对话",
            prompt: "输入要发给 [" + r.email + "] 的首条消息：",
            ignoreFocusOut: true,
          });
          if (prompt === undefined) break;
        }
        _toast("\u23F3 发起对话…");
        try {
          const res = await devinCloud.createSession(r.auth, prompt, { title: msg.title });
          if (res.ok) {
            _toast("\u2713 已发起: " + res.devinId);
            _notify("info", "[" + r.email + "] 已发起新对话 " + res.devinId);
            _dvRunPoll().catch(() => {});
          } else {
            _toast("\u2717 发起失败: " + (res.error || res.status));
          }
        } catch (e) {
          _toast("\u2717 发起失败: " + String((e && e.message) || e));
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
      // ═══ 第五板块 · Devin Cloud 消息处理 ═══
      // 展开账号下拉 → 登录 + 拉取概览 → 回传 HTML
      case "devinExpand": {
        const acc0 = _store.accounts[msg.index];
        const email0 = acc0 && acc0.email ? acc0.email.toLowerCase() : "";
        if (email0) _dvOpenEmails.add(email0); // host 侧记录开合, 渲染时据此预填(根治回弹)
        // 缓存新鲜 → 立即回传(无网络·无闪烁); 否则登录拉取
        const cached = _dvCacheFresh(email0);
        if (cached) {
          _broadcastMsg({ type: "devinOverview", index: msg.index, html: _dvOverviewHtml(cached.ov, msg.index, cached.gitSt) });
          if (!msg.refresh) { _dvRunPoll().catch(() => {}); break; }
        }
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) {
          _broadcastMsg({
            type: "devinOverview",
            index: msg.index,
            html: '<span style="color:#f44">登录失败: ' + _esc(r.error || "") + "</span>",
          });
          break;
        }
        try {
          // Devin Cloud 概览 + Git 板块状态 并行拉取; Git 失败不阻断概览(allSettled 形态)
          const [ov, gitSt] = await Promise.all([
            devinCloud.accountOverview(r.auth),
            devinGit.gitStatus(r.auth).catch(() => null),
          ]);
          _dvOverviewCache.set(email0, { ov, gitSt, ts: Date.now() });
          _broadcastMsg({ type: "devinOverview", index: msg.index, html: _dvOverviewHtml(ov, msg.index, gitSt) });
          // 顺带刷新运行状态标记
          _dvRunPoll().catch(() => {});
        } catch (e) {
          _broadcastMsg({
            type: "devinOverview",
            index: msg.index,
            html: '<span style="color:#f44">拉取失败: ' + _esc(String((e && e.message) || e)) + "</span>",
          });
        }
        break;
      }
      // 折叠下拉 → host 侧移除开合记录(渲染时不再预填)
      case "dvCollapse": {
        const accC = _store.accounts[msg.index];
        if (accC && accC.email) _dvOpenEmails.delete(accC.email.toLowerCase());
        break;
      }
      // ═══ 第三板块 · Git(GitHub) 归一连接 / 真解绑 ═══
      case "gitConnect": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        const email = r.email.toLowerCase();
        const pat = (msg.pat && String(msg.pat).trim()) || devinGit.patFor(r.email);
        if (!pat) { _toast("\u2717 无 PAT · 请在输入框填 ghp_… 或配置 ~/.dao/git-pats.json"); break; }
        _toast("\u23F3 连接 Git: " + email.split("@")[0] + " …");
        try {
          const res = await devinGit.connectWithPat(r.auth, pat);
          if (res.appConn) {
            // 已连到「别的 GitHub 身份」(经 App·非本 PAT 主) — 如实告知需上官网移除后再归一, 不冒充已连本仓
            _toast("\u26A0 该号经 GitHub App 连到 @" + res.appConn.name + "(" + res.appConn.repos + "仓) · 非本 PAT 主");
            _notify("warn", "[" + r.email + "] 连到别的 GitHub 身份 @" + res.appConn.name + " — 经 App 的连接断后不可经 API 复原。如需归一到本 PAT 主, 请在 app.devin.ai 该组织 Settings→Integrations 移除该 GitHub App 后再连。");
          } else if (res.ok) {
            _toast("\u2713 已连接 @" + (res.login || "github") + " · " + res.repoCount + " 仓库" + (res.secret ? " · Sec\u2713" : ""));
            _notify("info", "[" + r.email + "] Git 归一连接 @" + (res.login || "?") + " · " + res.repoCount + " 仓库 · 连接" + res.connections + (res.secret ? " · 密钥已落库" : ""));
          } else if (res.invalidPat) {
            _toast("\u2717 PAT 无效或已过期");
          } else if (res.ghost) {
            _toast("\u2717 平台孤儿态: 已注册却无连接 · 需上官网移除 GitHub 后重连");
            _notify("warn", "[" + r.email + "] " + (res.error || "平台侧孤儿注册·API 不可清"));
          } else {
            _toast("\u2717 连接未生效: " + (res.error || "0 连接/0 仓库"));
          }
        } catch (e) {
          _toast("\u2717 连接异常: " + String((e && e.message) || e));
        }
        _dvOverviewCache.delete(email); // 失效缓存 → 下次展开拉新状态
        _broadcastMsg({ type: "gitDone", index: msg.index });
        break;
      }
      case "gitDisconnect": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        const email = r.email.toLowerCase();
        _toast("\u23F3 断开 Git: " + email.split("@")[0] + " …(复查扫除·真解绑)");
        try {
          const logs = await devinGit.robustDisconnectGit(r.auth);
          const cleared = logs.some((l) => l.indexOf("已真水过无痕") >= 0);
          const residual = logs.find((l) => l.indexOf("仍残留") >= 0) || "";
          _toast(cleared ? "\u2713 已真水过无痕 · 身份/仓库/连接/密钥皆空" : ("\u26A0 已断开但仍有残留 · " + (residual ? residual.replace(/^.*仍残留/, "残留") : "详见日志")));
          _notify(cleared ? "info" : "warn", "[" + r.email + "] Git 断开: " + (cleared ? "真水过无痕(身份/仓库/连接/密钥皆空)" : "仍残留 — " + (residual || "需上官网撤销 GitHub App 授权")));
          log("[git] disconnect " + email + "\n  " + logs.join("\n  "));
        } catch (e) {
          _toast("\u2717 断开异常: " + String((e && e.message) || e));
        }
        _dvOverviewCache.delete(email);
        _broadcastMsg({ type: "gitDone", index: msg.index });
        break;
      }
      // 批量归一连接: 多个 Devin 账号 → 同一个 GitHub(同一 PAT) · 四两拨千斤
      case "gitConnectBatch": {
        const idx = Array.isArray(msg.indices) && msg.indices.length ? msg.indices : [];
        if (!idx.length) { _toast("\u2717 请先勾选账号"); break; }
        const sharedPat = (msg.pat && String(msg.pat).trim()) || "";
        // 同源·先落档: 批量前即覆盖式写入注入档案 GITHUB_PAT → 反向注入板即时反映, 不等整批跑完
        if (sharedPat) _daoUpsertInjectProfilePat(sharedPat);
        _toast("\u23F3 批量连 Git " + idx.length + " 账号 → 同一 GitHub …");
        let ok = 0, fail = 0, warn = 0, secOk = 0; const fails = [];
        for (const i of idx) {
          const r = await _dvAuthFor(i);
          if (!r.ok) { fail++; fails.push((r.email || "?") + ":登录失败"); continue; }
          const pat = sharedPat || devinGit.patFor(r.email);
          if (!pat) { fail++; fails.push(r.email + ":无PAT"); continue; }
          try {
            const res = await devinGit.connectWithPat(r.auth, pat);
            if (res.appConn) {
              // v4.10.0 · PAT双流: 连仓库失败(appConn/ghost)时, 仍注入 PAT 为 GITHUB_PAT 密钥 → 对话可用
              warn++;
              try { await devinGit.ensureGithubPatSecret(r.auth, pat); secOk++; } catch (e2) {}
              fails.push(r.email + ":仓库连别身份@" + res.appConn.name + "(已注密钥·对话可用)");
            } else if (res.ok) {
              ok++;
              _toast("\u23F3 [" + (ok + fail + warn) + "/" + idx.length + "] " + r.email.split("@")[0] + " → @" + (res.login || "?") + " " + res.repoCount + "仓");
            } else if (res.ghost) {
              // v4.10.0 · PAT双流: 孤儿态无法连仓库, 但 PAT 密钥仍可注入 → 对话正常
              warn++;
              try { await devinGit.ensureGithubPatSecret(r.auth, pat); secOk++; } catch (e2) {}
              fails.push(r.email + ":孤儿态(已注密钥·对话可用·如需仓库请上官网操作)");
            } else if (res.invalidPat) {
              fail++; fails.push(r.email + ":PAT无效");
            } else {
              // v4.10.0 · 连接未生效但不致命 → 尝试注入密钥兜底
              try { await devinGit.ensureGithubPatSecret(r.auth, pat); secOk++; warn++; fails.push(r.email + ":仓库未生效(已注密钥兜底)"); } catch (e2) { fail++; fails.push(r.email + ":" + (res.error || "未生效")); }
            }
          } catch (e) { fail++; fails.push(r.email + ":" + String((e && e.message) || e)); }
          _dvOverviewCache.delete(r.email.toLowerCase());
        }
        _toast((fail ? "\u26A0" : "\u2713") + " 批量连 Git: 归一 " + ok + " · 密钥兜底 " + secOk + " · 失败 " + fail + "/" + idx.length);
        _notify("info", "批量归一连接 GitHub: 归一到本PAT主 " + ok + " · 密钥兜底(对话可用) " + secOk + " · 失败 " + fail + "/" + idx.length + (fails.length ? ("\n明细: " + fails.join("; ")) : ""));
        log("[git] batch-connect ok=" + ok + " warn=" + warn + " secOk=" + secOk + " fail=" + fail + (fails.length ? "\n  " + fails.join("\n  ") : ""));
        _broadcastMsg({ type: "gitBatchDone" });
        break;
      }
      // v4.7.2 · PAT 反向注入: 把 PAT 作为 GITHUB_PAT 密钥写入「全部(或勾选)账号」(dao-vsix 1.3.3 同源·写后双读确认)
      case "gitInjectSecretBatch": {
        const pat = (msg.pat && String(msg.pat).trim()) || "";
        if (!pat) { _toast("\u2717 无 PAT"); break; }
        // 同源·先落档: 批量注号前先覆盖式写入注入档案 → 反向注入板即时反映, 不等整批跑完
        const profSynced = _daoUpsertInjectProfilePat(pat);
        const idx = Array.isArray(msg.indices) && msg.indices.length
          ? msg.indices
          : _store.accounts.map((_, k) => k); // 未勾选 → 全部账号
        _toast("\u23F3 PAT 反向注入 GITHUB_PAT 密钥 → " + idx.length + " 账号 …");
        let ok = 0, fail = 0, skip = 0; const fails = [];
        for (const i of idx) {
          const r = await _dvAuthFor(i);
          if (!r.ok) { skip++; continue; } // 未登录/无密码 → 跳过(只注入可登录账号)
          try {
            const done = await devinGit.ensureGithubPatSecret(r.auth, pat);
            if (done) {
              ok++;
              _toast("\u23F3 [" + (ok + fail) + "/" + idx.length + "] " + r.email.split("@")[0] + " · GITHUB_PAT \u2713");
            } else { fail++; fails.push(r.email + ":写后复核未确认"); }
          } catch (e) { fail++; fails.push(r.email + ":" + String((e && e.message) || e)); }
          _dvOverviewCache.delete(r.email.toLowerCase());
        }
        _toast((fail ? "\u26A0" : "\u2713") + " PAT 注密钥: 成功 " + ok + " · 失败 " + fail + (skip ? " · 跳过(不可登录)" + skip : "") + "/" + idx.length + (profSynced ? " · 注入档案已同步" : ""));
        _notify("info", "PAT 反向注入 GITHUB_PAT 密钥: 成功 " + ok + " · 失败 " + fail + " · 跳过(不可登录) " + skip + "/" + idx.length + (fails.length ? ("\n明细: " + fails.join("; ")) : ""));
        log("[git] inject-secret-batch ok=" + ok + " fail=" + fail + " skip=" + skip + (fails.length ? "\n  " + fails.join("\n  ") : ""));
        _broadcastMsg({ type: "gitBatchDone" });
        break;
      }
      // 批量真解绑: 勾选账号的 Git 连接全部复查扫除 · 连接归零 · 删密钥
      case "gitDisconnectBatch": {
        const idx = Array.isArray(msg.indices) && msg.indices.length ? msg.indices : [];
        if (!idx.length) { _toast("\u2717 请先勾选账号"); break; }
        _toast("\u23F3 批量断 Git " + idx.length + " 账号(复查扫除·真解绑)…");
        let ok = 0, fail = 0; const fails = [];
        for (const i of idx) {
          const r = await _dvAuthFor(i);
          if (!r.ok) { fail++; fails.push((r.email || "?") + ":登录失败"); continue; }
          try {
            const logs = await devinGit.robustDisconnectGit(r.auth);
            // v4.6.0 · 以终核结果(身份/仓库/连接/密钥皆空)为真解绑判据 (问题⑦)
            const cleared = logs.some((l) => l.indexOf("已真水过无痕") >= 0);
            const residual = logs.find((l) => l.indexOf("仍残留") >= 0);
            ok++;
            if (cleared) {
              _toast("\u23F3 [" + (ok + fail) + "/" + idx.length + "] " + r.email.split("@")[0] + " 真水过无痕✓");
            } else if (residual) {
              _toast("\u26A0 [" + (ok + fail) + "/" + idx.length + "] " + r.email.split("@")[0] + " " + residual.replace("终核: ", ""));
            } else {
              _toast("\u23F3 [" + (ok + fail) + "/" + idx.length + "] " + r.email.split("@")[0] + " 已处理");
            }
            log("[git] batch-disconnect " + r.email + "\n  " + logs.join("\n  "));
          } catch (e) { fail++; fails.push(r.email + ":" + String((e && e.message) || e)); }
          _dvOverviewCache.delete(r.email.toLowerCase());
        }
        _toast((fail ? "\u26A0" : "\u2713") + " 批量断 Git: 成功 " + ok + " · 失败 " + fail + "/" + idx.length);
        _notify("info", "批量断开 GitHub: 成功 " + ok + " · 失败 " + fail + "/" + idx.length + (fails.length ? ("\n失败明细: " + fails.join("; ")) : ""));
        _broadcastMsg({ type: "gitBatchDone" });
        break;
      }
      // 备份单账号全部对话 (增量)
      case "devinBackupAccount": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) {
          _toast("\u2717 " + (r.error || "登录失败"));
          break;
        }
        _toast("\u23F3 备份中: " + r.email.split("@")[0] + " …");
        try {
          const dir = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
          const res = await devinCloud.backupAccount(r.auth, {
            targetDir: dir,
            incremental: true,
            turbo: true, // 用户主动点「备份此账号」→ 前台极速档
            onProgress: (m) => _toast("\u23F3 " + m),
          });
          _toast("\u2713 备份完成: 新" + res.backedUp + " 跳过" + res.skipped + " 失败" + res.failed);
          _notify("info", "[" + r.email + "] Devin Cloud 备份: 新备份 " + res.backedUp + " · 跳过 " + res.skipped + " → " + res.dir);
        } catch (e) {
          _toast("\u2717 备份失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.8.3 · 单对话: 查看详情 + 面板内直接快速下载 (MD/HTML 秒存·无需慢速ZIP)
      case "dvConvDetail": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        try {
          const events = await devinCloud.getEventStream(r.auth, msg.devinId);
          const detail = await devinCloud.getSessionDetail(r.auth, msg.devinId);
          const cached = _dvOverviewCache.get(r.email.toLowerCase());
          const sm = cached && cached.ov && (cached.ov.sessions || []).find((s) => s.devinId === msg.devinId);
          const title = (detail && (detail.title || detail.name)) || (sm && sm.title) || msg.devinId;
          const html = devinCloud.buildConversationHtml(title, msg.devinId, events, { account: r.email });
          const panel = vscode.window.createWebviewPanel(
            "wam.convDetail", "对话详情 · " + String(title).slice(0, 28),
            vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true },
          );
          panel.webview.html = _dvInjectConvToolbar(html);
          // 面板内下载: 内容已在内存(events/detail) → MD/HTML 秒存; 完整(含产出文件)走增量补全。
          const _idx = msg.index, _email = r.email, _auth = r.auth, _did = msg.devinId;
          panel.webview.onDidReceiveMessage(async (m) => {
            if (!m || m.type !== "dvSaveConv") return;
            try {
              if (m.fmt === "zip" || m.fmt === "full") {
                _toast("\u23F3 打包完整对话(含产出文件)…");
                const accountDir = _dvAccountBackupDir(_email);
                const one = await devinCloud.backupOneConversation(_auth, { devin_id: _did, title }, accountDir, { incremental: false, turbo: true });
                if (one && one.zip) {
                  _toast("\u2713 已下载完整ZIP: " + path.basename(one.zip));
                  try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(one.zip)); } catch {}
                } else { _toast("\u2717 打包失败"); }
                return;
              }
              const convDir = _dvFindOrMakeConvDir(_email, _did, title);
              const isHtml = m.fmt === "html";
              const body = isHtml ? html : devinCloud.buildConversationMd(title, _did, events);
              const outPath = path.join(convDir, isHtml ? "对话.html" : "对话.md");
              fs.writeFileSync(outPath, body, "utf8");
              _toast("\u2713 已下载: " + path.basename(outPath));
              _notify("info", "[" + _email + "] 对话已直接下载 → " + outPath);
              try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outPath)); } catch {}
            } catch (e) {
              _toast("\u2717 下载失败: " + String((e && e.message) || e));
            }
          });
          _toast("\u2713 详情已打开 · 可在面板右上角直接下载");
        } catch (e) {
          _toast("\u2717 拉取失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.7.0 · 单对话: 下载为 ZIP 到本地 (增量补全文件后打包·并在资源管理器中定位)
      case "dvConvZip": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        try {
          const cached = _dvOverviewCache.get(r.email.toLowerCase());
          const sm = cached && cached.ov && (cached.ov.sessions || []).find((s) => s.devinId === msg.devinId);
          const title = (sm && sm.title) || msg.devinId;
          const accountDir = _dvAccountBackupDir(r.email);
          const one = await devinCloud.backupOneConversation(r.auth, { devin_id: msg.devinId, title }, accountDir, { incremental: false, turbo: true });
          if (one && one.zip) {
            _toast("\u2713 已下载 ZIP: " + path.basename(one.zip));
            _notify("info", "[" + r.email + "] 单对话 ZIP 已下载 → " + one.zip);
            try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(one.zip)); } catch {}
          } else { _toast("\u2717 打包失败"); }
        } catch (e) {
          _toast("\u2717 打包失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.7.0 · 多选: 合并多个对话为一个 ZIP 下载
      case "dvConvZipBatch": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        const ids = Array.isArray(msg.devinIds) ? msg.devinIds : [];
        if (!ids.length) { _toast("\u2717 未选对话"); break; }
        try {
          const cached = _dvOverviewCache.get(r.email.toLowerCase());
          const all = (cached && cached.ov && cached.ov.sessions) || [];
          const sessList = ids.map((id) => { const m = all.find((s) => s.devinId === id); return { devin_id: id, title: (m && m.title) || id }; });
          const outDir = _dvAccountBackupDir(r.email);
          const res = await devinCloud.backupConversationsBundle(r.auth, sessList, outDir, { turbo: true, onProgress: (m) => _toast("\u23F3 " + m) });
          _toast("\u2713 合并ZIP完成 " + res.count + "/" + res.total + ": " + path.basename(res.outPath));
          _notify("info", "[" + r.email + "] 合并下载 " + res.count + " 个对话 → " + res.outPath);
          try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(res.outPath)); } catch {}
        } catch (e) {
          _toast("\u2717 合并失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.7.0 · 单对话: 水过无痕清理 · 先确认 → 从仪表盘移除 → 无感刷新概览
      case "dvConvDel": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        const cached = _dvOverviewCache.get(r.email.toLowerCase());
        const sm = cached && cached.ov && (cached.ov.sessions || []).find((s) => s.devinId === msg.devinId);
        const title = (sm && sm.title) || msg.devinId;
        const pick = await vscode.window.showWarningMessage(
          "【水过无痕·清理对话】将从仪表盘移除该对话(本地已留底)：\n\n" + title + "\n\n建议先「下载ZIP」留底。是否继续？",
          { modal: true }, "确认清理",
        );
        if (pick !== "确认清理") { _toast("已取消"); break; }
        try {
          const d = await devinCloud.deleteSession(r.auth, msg.devinId);
          if (d.ok) {
            _toast("\u2713 已清理: " + String(title).slice(0, 24));
            _notify("info", "[" + r.email + "] 已清理对话: " + title);
            await _dvRefreshOverview(msg.index, r);
          } else { _toast("\u2717 清理失败 HTTP " + d.status); }
        } catch (e) {
          _toast("\u2717 清理异常: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.7.0 · 多选: 批量清理对话
      case "dvConvDelBatch": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        const ids = Array.isArray(msg.devinIds) ? msg.devinIds : [];
        if (!ids.length) { _toast("\u2717 未选对话"); break; }
        const pick = await vscode.window.showWarningMessage(
          "【水过无痕·批量清理】将从仪表盘移除 " + ids.length + " 个对话(本地已留底)。建议先合并下载ZIP留底。是否继续？",
          { modal: true }, "确认批量清理",
        );
        if (pick !== "确认批量清理") { _toast("已取消"); break; }
        let ok = 0, fail = 0;
        for (const id of ids) {
          try { const d = await devinCloud.deleteSession(r.auth, id); if (d.ok) ok++; else fail++; } catch { fail++; }
          _toast("\u23F3 清理 " + (ok + fail) + "/" + ids.length + " …");
        }
        _toast("\u2713 批量清理完成: 成功" + ok + " 失败" + fail);
        _notify("info", "[" + r.email + "] 批量清理 " + ok + "/" + ids.length + " 个对话");
        await _dvRefreshOverview(msg.index, r);
        break;
      }
      // v4.7.0 · 知识库/剧本/密钥 — 查看内容 (新面板)
      case "dvBoardView": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        try {
          const it = await _dvFetchBoardItem(r.auth, msg.boardKey, msg.id);
          if (!it) { _toast("\u2717 未找到该" + _dvBoardLabel(msg.boardKey)); break; }
          const text = _dvBoardItemText(msg.boardKey, it);
          const ttl = _dvBoardLabel(msg.boardKey) + " · " + ((it.name || it.title || it.id || "")).slice(0, 24);
          const esc = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const panel = vscode.window.createWebviewPanel(
            "wam.boardView", ttl, vscode.ViewColumn.Active,
            { enableScripts: false, retainContextWhenHidden: true },
          );
          panel.webview.html =
            '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#0d1117;color:#cdd;font:13px/1.6 -apple-system,Segoe UI,sans-serif;padding:16px}pre{white-space:pre-wrap;word-break:break-word;background:#10151c;border:1px solid #243;border-radius:6px;padding:14px}</style></head><body><pre>' +
            esc(text) + "</pre></body></html>";
          _toast("\u2713 已打开");
        } catch (e) {
          _toast("\u2717 拉取失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.7.0 · 知识库/剧本 — 下载到本地 (.md) 并在资源管理器中定位
      case "dvBoardDownload": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        try {
          const it = await _dvFetchBoardItem(r.auth, msg.boardKey, msg.id);
          if (!it) { _toast("\u2717 未找到该" + _dvBoardLabel(msg.boardKey)); break; }
          const outDir = path.join(_dvAccountBackupDir(r.email), "账号信息", _dvBoardLabel(msg.boardKey));
          fs.mkdirSync(outDir, { recursive: true });
          const outPath = path.join(outDir, _dvBoardFileName(msg.boardKey, it, msg.id));
          fs.writeFileSync(outPath, _dvBoardItemText(msg.boardKey, it), "utf8");
          _toast("\u2713 已下载: " + path.basename(outPath));
          _notify("info", "[" + r.email + "] " + _dvBoardLabel(msg.boardKey) + " 已下载 → " + outPath);
          try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outPath)); } catch {}
        } catch (e) {
          _toast("\u2717 下载失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.7.0 · 知识库/剧本 — 批量下载
      case "dvBoardDownloadBatch": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        const ids = Array.isArray(msg.ids) ? msg.ids : [];
        if (!ids.length) { _toast("\u2717 未选项目"); break; }
        try {
          const outDir = path.join(_dvAccountBackupDir(r.email), "账号信息", _dvBoardLabel(msg.boardKey));
          fs.mkdirSync(outDir, { recursive: true });
          let ok = 0;
          for (const id of ids) {
            const it = await _dvFetchBoardItem(r.auth, msg.boardKey, id);
            if (!it) continue;
            fs.writeFileSync(path.join(outDir, _dvBoardFileName(msg.boardKey, it, id)), _dvBoardItemText(msg.boardKey, it), "utf8");
            ok++;
            _toast("\u23F3 下载 " + ok + "/" + ids.length + " …");
          }
          _toast("\u2713 批量下载完成: " + ok + "/" + ids.length + " → " + _dvBoardLabel(msg.boardKey));
          _notify("info", "[" + r.email + "] 批量下载 " + ok + " 个" + _dvBoardLabel(msg.boardKey) + " → " + outDir);
          try { await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outDir)); } catch {}
        } catch (e) {
          _toast("\u2717 批量下载失败: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.7.0 · 知识库/剧本/密钥 — 删除 (确认 → 删 → 无感刷新)
      case "dvBoardDelete": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        const it = await _dvFetchBoardItem(r.auth, msg.boardKey, msg.id);
        const nm = (it && (it.name || it.title)) || msg.id;
        const pick = await vscode.window.showWarningMessage(
          "【删除" + _dvBoardLabel(msg.boardKey) + "】将永久删除：\n\n" + nm + "\n\n是否继续？",
          { modal: true }, "删除",
        );
        if (pick !== "删除") { _toast("已取消"); break; }
        try {
          const d = await _dvBoardDelete(r.auth, msg.boardKey, msg.id);
          if (d.ok) {
            _toast("\u2713 已删除: " + String(nm).slice(0, 24));
            _notify("info", "[" + r.email + "] 已删除" + _dvBoardLabel(msg.boardKey) + ": " + nm);
            await _dvRefreshOverview(msg.index, r);
          } else { _toast("\u2717 删除失败 HTTP " + d.status); }
        } catch (e) {
          _toast("\u2717 删除异常: " + String((e && e.message) || e));
        }
        break;
      }
      // v4.7.0 · 知识库/剧本/密钥 — 批量删除
      case "dvBoardDeleteBatch": {
        const r = await _dvAuthFor(msg.index);
        if (!r.ok) { _toast("\u2717 " + (r.error || "登录失败")); break; }
        const ids = Array.isArray(msg.ids) ? msg.ids : [];
        if (!ids.length) { _toast("\u2717 未选项目"); break; }
        const pick = await vscode.window.showWarningMessage(
          "【批量删除" + _dvBoardLabel(msg.boardKey) + "】将永久删除 " + ids.length + " 个。是否继续？",
          { modal: true }, "批量删除",
        );
        if (pick !== "批量删除") { _toast("已取消"); break; }
        let ok = 0, fail = 0;
        for (const id of ids) {
          try { const d = await _dvBoardDelete(r.auth, msg.boardKey, id); if (d.ok) ok++; else fail++; } catch { fail++; }
          _toast("\u23F3 删除 " + (ok + fail) + "/" + ids.length + " …");
        }
        _toast("\u2713 批量删除完成: 成功" + ok + " 失败" + fail);
        _notify("info", "[" + r.email + "] 批量删除 " + ok + "/" + ids.length + " 个" + _dvBoardLabel(msg.boardKey));
        await _dvRefreshOverview(msg.index, r);
        break;
      }
      // 备份全部(或已选)账号
      case "devinBackupAll": {
        const idx = Array.isArray(msg.indices) && msg.indices.length ? msg.indices : _store.accounts.map((_, i) => i);
        _toast("\u23F3 批量备份 " + idx.length + " 个账号…");
        let done = 0;
        const dir = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
        for (const i of idx) {
          const r = await _dvAuthFor(i);
          if (!r.ok) continue;
          try {
            const mode = _cfg("devinCloudBackupMode", "folder");
            const fb = mode === "folder"
              ? await devinCloud.backupAccountFullFolders(r.auth, { targetDir: dir, incremental: true, turbo: true })
              : await devinCloud.backupAccountFull(r.auth, { targetDir: dir, incremental: true, turbo: true });
            const res = fb.conversations || { backedUp: 0, skipped: 0 };
            const sc = (fb.snapshot && fb.snapshot.counts) || {};
            done++;
            _toast("\u23F3 " + r.email.split("@")[0] + ": 对话新" + res.backedUp + "/跳" + res.skipped + " 知识" + (sc.knowledge || 0) + " 剧本" + (sc.playbooks || 0) + " (" + done + "/" + idx.length + ")");
          } catch {}
        }
        _toast("\u2713 批量备份完成 " + done + "/" + idx.length + " → " + dir);
        _notify("info", "Devin Cloud 批量备份完成: " + done + "/" + idx.length + " → " + dir);
        break;
      }
      // 水过无痕: 一键清理(单/批) · 先 dry-run 扫描 → 模态确认 → 删除
      case "devinWipe": {
        const idx = Array.isArray(msg.indices) && msg.indices.length ? msg.indices : [msg.index];
        // 1. 扫描所有目标账号痕迹
        _toast("\u23F3 扫描待清理痕迹…");
        const scans = [];
        for (const i of idx) {
          const r = await _dvAuthFor(i);
          if (!r.ok) {
            scans.push({ i, ok: false, email: r.email || "?", error: r.error });
            continue;
          }
          try {
            const rep = await devinCloud.wipeAccount(r.auth, { dryRun: true });
            scans.push({ i, ok: true, email: r.email, auth: r.auth, rep });
          } catch (e) {
            scans.push({ i, ok: false, email: r.email, error: String((e && e.message) || e) });
          }
        }
        const good = scans.filter((s) => s.ok);
        if (!good.length) {
          _toast("\u2717 无可清理账号: " + (scans[0] && scans[0].error ? scans[0].error : ""));
          break;
        }
        const summary = good
          .map(
            (s) =>
              "• " + s.email + ": 待清(用户数据) 对话" + s.rep.sessions.found + " 知识库" + s.rep.knowledge.found +
              " 剧本" + s.rep.playbooks.found + " 密钥" + s.rep.secrets.found + " Git" + s.rep.gitConnections.found +
              ((s.rep.native && (s.rep.native.knowledge || s.rep.native.playbooks))
                ? "  [本源默认保留: 内置知识" + s.rep.native.knowledge + " 社区剧本" + s.rep.native.playbooks + "]"
                : ""),
          )
          .join("\n");
        const pick = await vscode.window.showWarningMessage(
          "【水过无痕·不可逆】将永久删除以下账号在 Devin Cloud 的全部痕迹(对话/知识库/剧本/密钥/Git 连接)，使账号回到未使用本源态。\n\n" +
            summary +
            "\n\n推荐「备份并清空」：先把对话正文+知识库/剧本/密钥/Git 全量留底本地，再一键清空回归本源。\n仅用于已用尽额度、不再需要的账号。",
          { modal: true },
          "备份并清空(回归本源)",
          "仅清空(不备份)",
        );
        if (pick !== "备份并清空(回归本源)" && pick !== "仅清空(不备份)") {
          _toast("已取消清理");
          break;
        }
        // 1.5 备份并清空: 先全量留底 (对话 ZIP + 账号数据快照), 再清空
        if (pick === "备份并清空(回归本源)") {
          const dir = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
          for (const s of good) {
            _toast("\u23F3 留底 " + s.email.split("@")[0] + " …");
            try {
              const bkMode = _cfg("devinCloudBackupMode", "folder");
              const fb = bkMode === "folder"
                ? await devinCloud.backupAccountFullFolders(s.auth, { targetDir: dir, incremental: true, turbo: true, onProgress: (m) => _toast("\u23F3 " + m) })
                : await devinCloud.backupAccountFull(s.auth, { targetDir: dir, incremental: true, turbo: true, onProgress: (m) => _toast("\u23F3 " + m) });
              const sc = (fb.snapshot && fb.snapshot.counts) || {};
              _toast("\u2713 已留底 " + s.email.split("@")[0] + ": 对话" + (fb.conversations ? fb.conversations.backedUp + fb.conversations.skipped : 0) + " 知识" + (sc.knowledge || 0) + " 剧本" + (sc.playbooks || 0) + " 密钥" + (sc.secrets || 0));
            } catch (e) {
              const stop = await vscode.window.showWarningMessage(
                "[" + s.email + "] 留底失败: " + String((e && e.message) || e) + "\n仍要继续清空该账号吗？(数据将无法恢复)",
                { modal: true },
                "跳过此账号",
                "仍要清空",
              );
              if (stop !== "仍要清空") { s._skip = true; }
            }
          }
        }
        // 2. 执行删除
        // 道法自然 · 水过无痕「移出账号库」: 备份并清空(回归本源)路径 = 全量备份→全量清理→移出账号库 一气呵成。
        //   仅在「备份并清空」且清理无残留时出库(已留底→无痕→出库); 「仅清空」不出库(无留底, 防误删)。
        const _wpEvict = pick === "备份并清空(回归本源)";
        const _wpEvictEmails = [];
        for (const s of good) {
          if (s._skip) { _toast("\u23ED 跳过 " + s.email.split("@")[0] + " (留底失败)"); continue; }
          _toast("\u23F3 清理 " + s.email.split("@")[0] + " …");
          try {
            const rep = await devinCloud.wipeAccount(s.auth, { onProgress: (m) => _toast("\u23F3 " + m) });
            // 清理无残留(对话/知识/剧本/密钥皆 0 失败) → 标记出库
            if (_wpEvict && rep && rep.sessions.failed === 0 && rep.knowledge.failed === 0 && rep.playbooks.failed === 0 && rep.secrets.failed === 0) {
              _wpEvictEmails.push(s.email);
            }
            _toast(
              "\u2713 " + s.email.split("@")[0] + " 已回归本源: 对话已清理" + rep.sessions.deleted + "/" + rep.sessions.found +
                " 知识库" + rep.knowledge.deleted + " 剧本" + rep.playbooks.deleted + " 密钥" + rep.secrets.deleted +
                (rep.gitConnections.found ? " Git" + rep.gitConnections.deleted + "/" + rep.gitConnections.found : "") +
                (rep.errors.length ? " · " + rep.errors.length + " 项失败" : ""),
            );
            _notify(
              rep.errors.length ? "warn" : "info",
              "[" + s.email + "] 水过无痕 · 对话已清理 " + rep.sessions.deleted + "/" + rep.sessions.found +
                " 知识" + rep.knowledge.deleted + " 剧本" + rep.playbooks.deleted + " 密钥" + rep.secrets.deleted +
                " · 本源默认保留(内置知识" + rep.native.knowledge + "/社区剧本" + rep.native.playbooks + ")" +
                (rep.errors.length ? " · " + rep.errors.length + " 项失败" : ""),
            );
            // v4.6.0 · 真水过无痕: 删连接 + 断 GitHub 身份/OAuth + 删密钥 + 终核(身份/仓库/连接/密钥皆空)。
            //   问题⑦: 旧法清对话但 GitHub 身份未断 → 用户仍能发消息。终核报明残留, 不臆造已断净。
            try {
              const gl = await devinGit.robustDisconnectGit(s.auth);
              const cleared = gl.some((l) => l.indexOf("已真水过无痕") >= 0);
              const residual = gl.find((l) => l.indexOf("仍残留") >= 0);
              if (cleared) _toast("\u2713 " + s.email.split("@")[0] + " GitHub 真水过无痕(身份已断)");
              else if (residual) _notify("warn", "[" + s.email + "] GitHub " + residual.replace("终核: ", "") );
              log("[wipe-git-sweep] " + s.email + (cleared ? " 真水过无痕✓" : "") + "\n  " + gl.join("\n  "));
            } catch (ge) { log("[wipe-git-sweep] " + s.email + " 异常: " + String((ge && ge.message) || ge)); }
            _dvOverviewCache.delete(s.email.toLowerCase());
          } catch (e) {
            _toast("\u2717 清理失败: " + String((e && e.message) || e));
          }
        }
        // 移出账号库 (循环外·避免迭代中改数组) — 备份+清理已完成且痕迹已清, 此处仅从账号库移除
        if (_wpEvictEmails.length) {
          const _ix = _wpEvictEmails
            .map((em) => _store.accounts.findIndex((a) => (a.email || "").toLowerCase() === String(em).toLowerCase()))
            .filter((i) => i >= 0);
          if (_ix.length) {
            _store.removeBatch(_ix);
            _toast("\u2713 已移出账号库 " + _ix.length + " 个 (水过无痕·一气呵成)");
            _notify("info", "水过无痕 · 已全量备份+清理 → 移出账号库 " + _ix.length + " 个: " + _wpEvictEmails.join(", "));
            log("[wp-evict] 移出账号库 " + _ix.length + " 个 · " + _wpEvictEmails.join(", "));
          }
        }
        _broadcastUI(true);
        break;
      }
      // 道法自然 · 一气呵成清理额度归零账号: 全量备份 → 全量清理 → 移出账号库 (供切号面板/Agent 调用)
      //   仅作用于「额度权威归零」(billing ≤ 阈值)的账号; 备份须通过完整性校验方可清理(未全量备份不删);
      //   清理无残留方可出库。健康号(无法判定额度/有订阅)一律跳过, 防误删。
      case "devinCleanupZeroQuota": {
        const dir = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
        const bkMode = _cfg("devinCloudBackupMode", "folder");
        // v4.26.6 · 同自动环: 出库阈值默认对齐清理阈值 → 手动按钮也能收拾残留 $0.x~$2 的耗尽号
        const _zqCleanTh = Math.max(0, +_cfg("devinCloudAutoCleanupThreshold", Math.max(0, +_cfg("devinCloudAutoBackupThreshold", 3) || 3)) || 3);
        const _zqRaw = +_cfg("devinCloudAutoRemoveThreshold", _zqCleanTh);
        const removeThreshold = Math.max(0, Number.isFinite(_zqRaw) ? _zqRaw : _zqCleanTh);
        _toast("\u23F3 扫描额度归零账号…");
        // 1. 找出额度归零账号 (billing 权威判定)
        const zero = [];
        for (let i = 0; i < _store.accounts.length; i++) {
          const r = await _dvAuthFor(i);
          if (!r.ok) continue;
          let billing = null;
          try { billing = await devinCloud.getBilling(r.auth); } catch {}
          const tc = _billingTotalDollars(billing);
          if (tc !== null && tc <= removeThreshold) zero.push({ i, email: r.email, auth: r.auth, credits: tc });
        }
        if (!zero.length) { _toast("\u2713 无额度归零账号 · 无需清理"); break; }
        const pick = await vscode.window.showWarningMessage(
          "【额度归零清理·不可逆】将对以下 " + zero.length + " 个额度归零账号一气呵成: 全量备份 → 全量清理(对话/知识/剧本/密钥/Git) → 移出账号库。\n\n" +
            zero.map((z) => "• " + z.email + " ($" + z.credits.toFixed(2) + ")").join("\n") +
            "\n\n仅在全量备份校验完整且清理无残留时出库。",
          { modal: true },
          "备份+清理+出库",
        );
        if (pick !== "备份+清理+出库") { _toast("已取消"); break; }
        const evictEmails = [];
        for (const z of zero) {
          // 2. 全量备份 (严格校验)
          _toast("\u23F3 留底 " + z.email.split("@")[0] + " …");
          let backupOk = false;
          try {
            const naming = { accountNo: _dvAccountNo(z.email), password: (_store.accounts[z.i] && _store.accounts[z.i].password) || "" };
            const br = bkMode === "folder"
              ? await devinCloud.backupAccountFullFolders(z.auth, Object.assign({ targetDir: dir, incremental: false }, naming))
              : await devinCloud.backupAccountFull(z.auth, Object.assign({ targetDir: dir, incremental: false }, naming));
            backupOk = _dvBackupVerifiedFull(br);
          } catch (be) { log("[cleanup-zero] backup err " + z.email + ": " + (be.message || be)); }
          if (!backupOk) { _toast("\u26A0 " + z.email.split("@")[0] + " 备份未通过校验 → 跳过(不删)"); continue; }
          // 3. 全量清理
          _toast("\u23F3 清理 " + z.email.split("@")[0] + " …");
          try {
            const rep = await devinCloud.wipeAccount(z.auth, { onProgress: (m) => _toast("\u23F3 " + m) });
            try { await devinGit.robustDisconnectGit(z.auth); } catch {}
            _dvOverviewCache.delete(z.email.toLowerCase());
            const clean = rep && rep.sessions.failed === 0 && rep.knowledge.failed === 0 && rep.playbooks.failed === 0 && rep.secrets.failed === 0;
            if (clean) evictEmails.push(z.email);
          } catch (ce) { _toast("\u2717 清理失败 " + z.email.split("@")[0] + ": " + (ce.message || ce)); }
        }
        // 4. 移出账号库 (循环外)
        if (evictEmails.length) {
          const ix = evictEmails
            .map((em) => _store.accounts.findIndex((a) => (a.email || "").toLowerCase() === String(em).toLowerCase()))
            .filter((i) => i >= 0);
          if (ix.length) {
            _store.removeBatch(ix);
            _notify("info", "额度归零清理 · 全量备份+清理 → 移出账号库 " + ix.length + " 个: " + evictEmails.join(", "));
            log("[cleanup-zero] 出库 " + ix.length + " 个 · " + evictEmails.join(", "));
          }
        }
        _toast("\u2713 归零清理完成 · 出库 " + evictEmails.length + "/" + zero.length + " (一气呵成)");
        _broadcastUI(true);
        break;
      }
      // 道法自然 · 立即清理(参手机版「立即清理」按钮): 无模态·一气呵成 — 对指定(无选→全部)账号 先全量备份(严格校验)→ 整体归零(对话/知识/剧本/密钥/Git)→ 出库.
      //   与 devinCleanupZeroQuota 同骨架, 但: ① 不看额度(用户主动点即清, 专注「对话用完即归零」) ② 全程 toast 无模态(浏览器/手机版同样可用).
      //   铁律: 备份未通过完整性校验 → 跳过不删 (先备份再移除·宁可不删不可误删).
      case "devinCleanupImmediate": {
        const dir = _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT;
        const bkMode = _cfg("devinCloudBackupMode", "folder");
        const idx = (Array.isArray(msg.indices) && msg.indices.length)
          ? msg.indices.slice()
          : _store.accounts.map((_, i) => i);
        if (!idx.length) { _toast("\u2717 无账号可清理"); break; }
        _toast("\u23F3 立即清理 " + idx.length + " 个账号 · 先备份再归零(无模态·一气呵成)");
        const evictEmails = [];
        let done = 0;
        for (const i of idx) {
          const r = await _dvAuthFor(i);
          if (!r.ok) { _toast("\u2717 [" + (r.email || "?") + "] 登录失败 → 跳过"); continue; }
          done++;
          // 1. 全量备份 (严格校验·未过校验不删)
          _toast("\u23F3 [" + done + "/" + idx.length + "] 留底 " + r.email.split("@")[0] + " …");
          let backupOk = false;
          try {
            const naming = { accountNo: _dvAccountNo(r.email), password: (_store.accounts[i] && _store.accounts[i].password) || "" };
            const br = bkMode === "folder"
              ? await devinCloud.backupAccountFullFolders(r.auth, Object.assign({ targetDir: dir, incremental: false, turbo: true, onProgress: (m) => _toast("\u23F3 " + m) }, naming))
              : await devinCloud.backupAccountFull(r.auth, Object.assign({ targetDir: dir, incremental: false, turbo: true, onProgress: (m) => _toast("\u23F3 " + m) }, naming));
            backupOk = _dvBackupVerifiedFull(br);
          } catch (be) { log("[cleanup-now] backup err " + r.email + ": " + ((be && be.message) || be)); }
          if (!backupOk) { _toast("\u26A0 " + r.email.split("@")[0] + " 备份未过校验 → 跳过(不删·守柔)"); continue; }
          // 2. 整体归零 (对话/知识/剧本/密钥)
          _toast("\u23F3 归零 " + r.email.split("@")[0] + " …");
          try {
            const rep = await devinCloud.wipeAccount(r.auth, { onProgress: (m) => _toast("\u23F3 " + m) });
            try { await devinGit.robustDisconnectGit(r.auth); } catch {}
            _dvOverviewCache.delete(r.email.toLowerCase());
            const clean = rep && rep.sessions.failed === 0 && rep.knowledge.failed === 0 && rep.playbooks.failed === 0 && rep.secrets.failed === 0;
            if (clean) evictEmails.push(r.email);
            _toast(
              "\u2713 " + r.email.split("@")[0] + " 已归零: 对话" + rep.sessions.deleted + "/" + rep.sessions.found +
                " 知识" + rep.knowledge.deleted + " 剧本" + rep.playbooks.deleted + " 密钥" + rep.secrets.deleted +
                (rep.errors.length ? " · " + rep.errors.length + " 项失败" : ""),
            );
          } catch (ce) { _toast("\u2717 归零失败 " + r.email.split("@")[0] + ": " + ((ce && ce.message) || ce)); }
        }
        // 3. 出库 (循环外·避免迭代中改数组) — 已备份+归零无残留方可出库
        if (evictEmails.length) {
          const ix = evictEmails
            .map((em) => _store.accounts.findIndex((a) => (a.email || "").toLowerCase() === String(em).toLowerCase()))
            .filter((i) => i >= 0);
          if (ix.length) {
            _store.removeBatch(ix);
            _notify("info", "立即清理 · 全量备份+归零 → 出库 " + ix.length + " 个: " + evictEmails.join(", "));
            log("[cleanup-now] 出库 " + ix.length + " 个 · " + evictEmails.join(", "));
          }
        }
        _toast("\u2713 立即清理完成 · 出库 " + evictEmails.length + "/" + done + " (先备份再归零·一气呵成)");
        _broadcastUI(true);
        break;
      }
      // 道法自然 · 迁移备份到数据盘: 把现有(C 盘/home)备份整体搬到自动择优的数据盘(非系统盘·剩余最大), 之后默认落该盘 — 不再压系统盘.
      case "devinMigrateBackupRoot": {
        let newRoot = "";
        try { newRoot = devinCloud.getOptimalBackupRoot(); } catch (e) {}
        const homeRoot = (devinCloud.paths && devinCloud.paths.DC_HOME_BACKUP) || "";
        const curCfg = _cfg("devinCloudBackupDir", "");
        const oldRoot = curCfg || homeRoot;
        if (!newRoot || path.resolve(newRoot) === path.resolve(oldRoot)) {
          _toast("\u2713 当前备份已在数据盘(或无更优数据盘) · 无需迁移: " + (newRoot || oldRoot));
          break;
        }
        _toast("\u23F3 迁移备份: " + oldRoot + " → " + newRoot);
        let res;
        try {
          res = devinCloud.migrateBackups(oldRoot, newRoot, { onProgress: (m) => _toast("\u23F3 " + m) });
        } catch (e) {
          _toast("\u2717 迁移失败: " + String((e && e.message) || e));
          break;
        }
        if (!res.ok) { _toast("\u2717 迁移失败: " + (res.error || "未知")); break; }
        // 钉住目标盘 + 写 config (后续默认落数据盘)
        try { devinCloud.setBackupRoot(newRoot); } catch (e) {}
        try {
          await vscode.workspace.getConfiguration("wam").update("devinCloudBackupDir", newRoot, vscode.ConfigurationTarget.Global);
        } catch (e) {}
        _toast(
          res.skipped
            ? ("\u2713 已切换默认备份盘 → " + newRoot + " (无既有备份需搬)")
            : ("\u2713 迁移完成: " + res.files + " 文件 / " + (res.bytes / 1048576).toFixed(1) + " MB → " + newRoot + " · 默认已切此盘"),
        );
        _notify("info", "备份盘迁移 · " + oldRoot + " → " + newRoot + (res.skipped ? " (无既有备份)" : " · " + res.files + " 文件 / " + (res.bytes / 1048576).toFixed(1) + " MB"));
        log("[migrate-root] " + oldRoot + " → " + newRoot + " · files=" + res.files + " bytes=" + res.bytes + " skipped=" + res.skipped);
        _broadcastConvSection();
        _broadcastUI();
        break;
      }
      // 设置账号标签 (防搞混) · 用扩展宿主 showInputBox (webview prompt 被屏蔽)
      case "devinSetTag": {
        const acc = _store.accounts[msg.index];
        if (!acc || !acc.email) break;
        let tag = msg.tag;
        if (typeof tag !== "string") {
          tag = await vscode.window.showInputBox({
            title: "Devin Cloud 账号标签",
            prompt: "为 " + acc.email + " 设置标签(防搞混)，留空清除：",
            value: devinCloud.getTag(acc.email) || "",
            ignoreFocusOut: true,
          });
          if (tag === undefined) break; // 用户取消
        }
        devinCloud.setTag(acc.email, tag || "");
        _toast("\u2713 标签已" + (tag ? "设置" : "清除"));
        _broadcastUI();
        break;
      }
      // 导出 MD 操作指令 (给本地 Agent)
      case "devinExportMd": {
        const idx = Array.isArray(msg.indices) && msg.indices.length ? msg.indices : _store.accounts.map((_, i) => i);
        const accounts = idx.map((i) => _store.accounts[i]).filter((a) => a && a.email).map((a) => ({ email: a.email }));
        const md = devinCloud.buildAgentMd({
          accounts,
          backupRoot: _cfg("devinCloudBackupDir", "") || devinCloud.paths.DC_BACKUP_DEFAULT,
        });
        try {
          const doc = await vscode.workspace.openTextDocument({ content: md, language: "markdown" });
          await vscode.window.showTextDocument(doc);
          _toast("\u2713 已导出 MD 操作指令");
        } catch (e) {
          _toast("\u2717 导出失败: " + String((e && e.message) || e));
        }
        break;
      }
      // 运行状态轮询 (前端重建后触发)
      case "devinRunPoll": {
        _dvRunPoll().catch(() => {});
        break;
      }
      // 自动备份开关
      case "devinToggleAuto": {
        await vscode.workspace
          .getConfiguration("wam")
          .update("devinCloudAutoBackup", !!msg.on, vscode.ConfigurationTarget.Global);
        if (msg.on) _dvStartAuto();
        else _dvStopAuto();
        _toast(msg.on ? "\u2713 已开启 Devin Cloud 自动增量备份" : "已关闭自动备份");
        break;
      }
      // v4.4.0 · 自动清理开关
      case "devinToggleCleanup": {
        await vscode.workspace
          .getConfiguration("wam")
          .update("devinCloudAutoCleanup", !!msg.on, vscode.ConfigurationTarget.Global);
        _toast(msg.on ? "\u2713 已开启自动清理(额度低于阈值时备份后水过无痕)" : "已关闭自动清理");
        break;
      }
      // v4.9.0 · 归零移除开关 (额度完全归零账号备份+清理后从账号库出库)
      case "devinToggleRemoveZero": {
        await vscode.workspace
          .getConfiguration("wam")
          .update("devinCloudAutoRemoveZeroQuota", !!msg.on, vscode.ConfigurationTarget.Global);
        _toast(msg.on ? "\u2713 已开启归零移除(额度归零账号备份+清理后自动出库)" : "已关闭归零移除");
        break;
      }
      // v4.4.0 · 设置自动备份/清理阈值
      case "devinSetThreshold": {
        const v = Math.max(0, +(msg.value) || 3);
        await vscode.workspace.getConfiguration("wam").update("devinCloudAutoBackupThreshold", v, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration("wam").update("devinCloudAutoCleanupThreshold", v, vscode.ConfigurationTarget.Global);
        _toast("\u2713 自动备份/清理阈值: $" + v);
        break;
      }
      // v4.5.0 · 对话额度上限开关
      case "devinToggleConvCap": {
        await vscode.workspace
          .getConfiguration("wam")
          .update("devinCloudConvQuotaCap", !!msg.on, vscode.ConfigurationTarget.Global);
        if (msg.on) _dvConvCapSchedule();
        else _dvConvCapStop();
        _toast(msg.on ? "\u2713 已开启对话额度上限(余额-缓冲·余额≤停止阈值自动中停)" : "已关闭对话额度上限");
        break;
      }
      // v4.5.0 · 设置对话上限缓冲
      case "devinSetConvBuffer": {
        const v = Math.max(0, +(msg.value) || 0);
        await vscode.workspace.getConfiguration("wam").update("devinCloudConvQuotaBuffer", v, vscode.ConfigurationTarget.Global);
        _toast("\u2713 对话上限缓冲: $" + v.toFixed(2));
        if (_cfg("devinCloudConvQuotaCap", true)) _dvConvCapSchedule();
        break;
      }
      // v4.7.3 · 耗尽自动重置(抽干至零)开关
      case "devinToggleDrain": {
        await vscode.workspace.getConfiguration("wam").update("devinCloudConvDrainToZero", !!msg.on, vscode.ConfigurationTarget.Global);
        _toast(msg.on ? "\u2713 已开启耗尽自动重置(余额抵缓冲→反向抬回上限·让美金用尽·仅见底才中停)" : "已关闭耗尽自动重置(余额≤停止阈值即中停)");
        if (_cfg("devinCloudConvQuotaCap", true)) _dvConvCapSchedule();
        break;
      }
      // v4.4.0 · 设置备份模式
      case "devinSetMode": {
        const mode = msg.value === "zip" ? "zip" : "folder";
        await vscode.workspace.getConfiguration("wam").update("devinCloudBackupMode", mode, vscode.ConfigurationTarget.Global);
        _toast("\u2713 备份模式: " + (mode === "folder" ? "文件夹(HTML/MD)" : "ZIP"));
        break;
      }
      // v3.7.5 · 对话手动关闭 · 反者道之动 · 道法自然
      // v3.7.6 · 关闭即持久化 · 多窗口同步 · 小邦寺民·各得其欲
      // 用户点 × 关闭某条卡住对话提醒 → 本地静默 10min → 面板立即消失
      case "dismissConv": {
        if (msg.uuid) {
          if (msg.permanent) {
            // v4.8.0 · 二次点击 X = 永久取消追踪 (Cascade 同款) · 永不复现
            _untrackedConvUuids.add(msg.uuid);
            _dismissedConvUuids.delete(msg.uuid);
            _saveUntrackedToDisk();
            _saveDismissedToDisk();
            log(
              "conv-untrack: " +
                msg.uuid.substring(0, 8) +
                " (永久取消追踪 · 已写盘)",
            );
            _broadcastConvSection(); // 立即更新面板 · 永久移除
            _toast("✓ 已永久取消追踪此对话 (命令面板 wam.clearConvUntrack 可恢复)");
          } else {
            _dismissedConvUuids.set(msg.uuid, Date.now());
            _saveDismissedToDisk(); // v3.7.6: 持久化 · 多窗同步 (A窗dismiss→写盘→B窗watchFile触发)
            log(
              "conv-dismiss: " +
                msg.uuid.substring(0, 8) +
                " (10min静默 · 已写盘)",
            );
            _broadcastConvSection(); // 立即更新面板 · 移除该条目
            _toast("✓ 已静默10min · 再点一次X=永久取消追踪");
          }
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
      // v4.6.1 · 锁反转副作用修正 (反者道之动 · 无为非无能)
      //   lockByDefault=true 后, 账号默认🔒锁定 ⇒ getSortedIndices 天然排除 ⇒ order 可能为空.
      //   旧法此时落到尾部 "所有账号都失败" 红错, 与事实相悖(登录其实成功·只是无解锁候选),
      //   正是用户所诉"状态弹错". 此处先辨因: 全锁=预期态(用户主权)·仅 log 不惊扰;
      //   真无可登录账号=温和提示; 二者皆非红错.
      if (order.length === 0) {
        const others = this.store.accounts.filter(
          (_, i) => i !== this.store.activeIdx,
        );
        const loginable = others.filter((a) => a && a.password);
        const lockedCnt = loginable.filter((a) => a.skipAutoSwitch).length;
        if (loginable.length > 0 && lockedCnt === loginable.length) {
          log(
            "rotate: 0 候选 · " +
              lockedCnt +
              " 个可登录账号均🔒锁定(lockByDefault) · 属预期·非错误 · 面板🔓解锁后启用自动切号",
          );
          return { ok: false, stage: "all-locked" };
        }
        if (loginable.length === 0) {
          _notify("warn", "WAM: 无可登录账号 (账号库为空或缺密码)");
          return { ok: false, stage: "no-loginable" };
        }
      }
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
      // v3.1.4 · 限速窗口内不主动 rotate · 与 prewarm/devinLogin 同源让位
      //   全池共享同一限速窗口 → 窗口内任何 login 必返 rate-limit-window
      //   仍每 tick rotate 只会空转刷屏 (no-active churn) · 窗口内整体让位至窗口结束
      if (Date.now() < _devinLoginRateLimitedUntil) return;
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
        _notifyExhaustOnce("WAM: ⚠️ " + reason + "，全部账号额度已耗尽");
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
          _resetExhaustEpisode(); // 切号成功 = 新 episode · 下次全池耗尽可再提醒一次
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
        } else if (sr.error === "rate-limit-window" || sr.status === 429) {
          // v3.1.4 · 命中限速窗口 → 全池共享窗口 · 3s 重试必再命中 · 立即让位 (止 churn)
          log(tag + " FAIL: " + (sr.error || "rate-limit") + " · 限速让位·不重试");
          _predictiveCandidate = -1;
          break;
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

  // v4.9.6 · E: IDE 内浏览器面板持久化 — 注册序列化器, IDE 重启后据 state.email 自动还原各账号面板。
  if (vscode.window.registerWebviewPanelSerializer) {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer("wamDevinWeb", {
        async deserializeWebviewPanel(panel, state) {
          const email = state && state.email ? String(state.email) : "";
          const key = email.toLowerCase();
          if (!key) { try { panel.dispose(); } catch {} return; }
          try { panel.webview.options = { enableScripts: true }; } catch {}
          _ideWebPanels.set(key, panel);
          panel.onDidDispose(() => { if (_ideWebPanels.get(key) === panel) _ideWebPanels.delete(key); });
          const acc = (_store.accounts || []).find((a) => (a.email || "").toLowerCase() === key);
          if (!acc) {
            panel.title = "Devin · " + key.split("@")[0] + " (账号不在库)";
            panel.webview.html = "<!DOCTYPE html><html><body style='background:#1e1e1e;color:#888;font-family:sans-serif;padding:24px'>该账号已不在账号库, 无法还原此页。请在切号面板重新打开。</body></html>";
            return;
          }
          panel.webview.html = "<!DOCTYPE html><html><body style='background:#1e1e1e;color:#888;font-family:sans-serif;padding:24px'>还原中 · " + _esc(acc.email.split("@")[0]) + " …</body></html>";
          openIdeAccountBrowser(acc).catch((e) => log("ideWeb restore err: " + ((e && e.message) || e)));
        },
      }),
    );
    // v6.0.0 · 归一多实例浏览器面板序列化器 — 软件重载后自动还原已打开的全部标签。
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer("daoMultiInstance", {
        async deserializeWebviewPanel(panel) {
          try { panel.webview.options = { enableScripts: true }; } catch {}
          _multiReady = false; _multiQueue.length = 0; _multiTabs.clear();
          panel.webview.html = _multiShellHtml();
          _wireMultiPanel(panel);
          // 状态保留: 有已存标签 → 还原; 无 → 落「六合板块主页」(首次/空状态)。
          let _savedCnt = 0;
          try { _savedCnt = (((_ctx && _ctx.globalState && _ctx.globalState.get("dao.multiTabs")) || [])).length; } catch (e) {}
          if (_savedCnt > 0) _resumePersistedTabs().catch((e) => log("multi resume err: " + ((e && e.message) || e)));
          else _postMulti({ type: "gotoBoard", board: "home" });
        },
      }),
    );
  }

  const cmds = [
    ["wam.openEditor", () => openEditorPanel()],
    // ── 第五板块 · Devin Cloud 命令 (供命令面板/Agent 调用) ──
    [
      "wam.devinExportMd",
      () => handleWebviewMessage({ type: "devinExportMd", indices: [] }),
    ],
    [
      "wam.devinBackupAccount",
      async () => {
        const i = _store.activeIdx >= 0 ? _store.activeIdx : 0;
        await handleWebviewMessage({ type: "devinBackupAccount", index: i });
      },
    ],
    [
      "wam.devinBackupAll",
      () => handleWebviewMessage({ type: "devinBackupAll", indices: [] }),
    ],
    [
      "wam.devinCleanupZeroQuota",
      () => handleWebviewMessage({ type: "devinCleanupZeroQuota" }),
    ],
    [
      "wam.devinCleanupImmediate",
      () => handleWebviewMessage({ type: "devinCleanupImmediate", indices: [] }),
    ],
    [
      "wam.devinMigrateBackupRoot",
      () => handleWebviewMessage({ type: "devinMigrateBackupRoot" }),
    ],
    [
      "wam.devinWipeAccount",
      async () => {
        const i = _store.activeIdx >= 0 ? _store.activeIdx : 0;
        await handleWebviewMessage({ type: "devinWipe", index: i });
      },
    ],
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
      async (arg) => {
        // 可选 text 入参(如 dao-one 驾驶舱「粘贴即换」直接传整行) → 跳过输入框
        const text =
          typeof arg === "string" && arg.trim()
            ? arg.trim()
            : await vscode.window.showInputBox({
                prompt:
                  "邮箱密码 (任意分隔: 空格/Tab/:/----/|/,/;) · 也可粘贴 token 直登",
                placeHolder:
                  "foo@bar.com mypass  或  email:pass  或  devin-session-token$…",
              });
        if (!text) return;
        const r = _store.addBatch(text);
        let info = "添加 " + r.added + " 个" + (r.updated > 0 ? " · 改密 " + r.updated : "") + " · 跳重 " + r.duplicate;
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
    [
      // v4.8.0 · 复原全部「永久取消追踪」的对话 (清空 untrack 集)
      "wam.clearConvUntrack",
      async () => {
        const n = _untrackedConvUuids.size;
        if (n === 0) {
          _notify("info", "WAM: 当前无永久取消追踪的对话");
          return;
        }
        _untrackedConvUuids.clear();
        try {
          atomicWrite(UNTRACK_FILE, JSON.stringify([]));
        } catch {}
        _broadcastConvSection();
        _notify("info", "WAM: 已复原 " + n + " 个永久取消追踪的对话 (将重新追踪)");
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

  // ── 第五板块 · Devin Cloud 初始化 (运行状态轮询 + 自动备份 + 全账号预加载) ──
  try {
    // v4.8.4 · 跨窗口选主 (singleton): 全局网络扫描(轮询/预加载/备份/额度调度)只由当选的
    //   「主窗口」执行, 其余窗口读共享状态文件渲染 → 功能不变·网络并发 ÷ 窗口数 (根治多窗口
    //   conntrack 风暴)。启停由 _dvStartElection 内的选主心跳统一管理 (见 _dvLeaderStartSweeps)。
    _dvStartElection(context);
    log("devin-cloud: 第五板块就绪 (singleton 选主) · autoBackup=" + _cfg("devinCloudAutoBackup", true) + " pollMin=" + Math.max(0, _cfg("devinCloudRunPollMin", 1)) + " preload=" + _cfg("devinCloudPreload", true) + " convCap=" + _cfg("devinCloudConvQuotaCap", true));
  } catch (e) {
    log("devin-cloud init err: " + ((e && e.message) || e));
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
          _resetExhaustEpisode(); // 切号成功 = 新 episode · 下次全池耗尽可再提醒一次
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
  try { devinProxy.stopAll(); } catch {} // v4.8.2 · 收束 IDE 内置浏览器注入反代
  if (_store) _store.save();
  log("WAM deactivate");
}

module.exports = {
  activate,
  deactivate,
  // 暴露给 harness · 用于真打验证 (生产代码不依赖)
  _internals: {
    _daoDownloadData, // 近期对话同源数据引擎 · 暴露给 dao-vsix 六大板块(对话备份「近期对话」与悬浮窗一致)
    devinLogin,
    windsurfPostAuth,
    registerUserViaSession,
    tryFetchPlanStatus,
    _parsePlanStatusJson,
    verifyOneAccount,
    verifyAllAccounts,
    _prewarmAuthThrottled, // v3.51.0 · 多实例首开节流预热 · 暴露给守门测试
    get _prewarmInProgress() {
      return _prewarmInProgress;
    },
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
    openShellHome, // 归一 · 9921 综合外壳入口 (冷启动落六合主页·不强开 Devin 对话框)
    handleWebviewMessage, // 归一 · 内嵌「切号」消息处理 (dao-vsix wamRelay 中继 → 此 · 根治内嵌面板按钮全失效)
    setHostPost(fn) { _hostPost = (typeof fn === "function") ? fn : null; }, // 归一 · 内嵌「切号」宿主回推注入 (live 同步)
    openEditorPanel,
    openMultiInstance, // v5.0.0 · 归一多实例单面板多标签 (供 dao-vsix 委托)
    // 归一 · 独立 HTTP 外壳 (适配所有 IDE/浏览器/手机·参照 APK): 供 dao-vsix 本地服务器 /shell 路由调用
    getStandaloneShellHtml: _standaloneShellHtml, // GET /shell → 直出同一外壳 (注入 HTTP 传输垫片)
    shellAttach: _shellAttach, // GET /api/shell/events → SSE 挂载 (宿主→页面·快路)
    shellPoll: _shellPoll, // GET /api/shell/poll → 长轮询回退 (公网/任意代理后均可用)
    shellHandleMessage, // POST /api/shell/msg → 页面→宿主消息处理
    shellAccountProxy, // GET/POST /i/<accKey>/* → dao 自渲染账号页 (公网手机/电脑无感·含多实例)
    resolveConvMd, // GET /__convmd?email=&sid= → 会话最新 MD (拖拽对话上传桥数据源)
    resolveConvGuide, // GET /__convguide?email=&sid= → 取数指引 MD (与对话 MD 配套 · 对照手机 APK)
    resolveConvActive, // GET /__convinfo?email=&sid= → {active} 拖拽上传择路(进行中=两MD/结束=ZIP)
    resolveConvZip, // GET /__convzip?email=&sid= → 整包 ZIP (备份引擎增量 · 覆盖型更新)
    // 归一 · 把 dao-vsix out 层的拖拽上传桥路由服务函数注入 IDE 内多实例反代 (devin_proxy),
    //   使 /__daobridge.js·/__dlfile·/__convmd 就地同源服务于各账号反代端口 → 拖拽落点页可直取。
    setDevinProxyBridgeServe(fn) { try { devinProxy.setBridgeServe(fn); } catch (e) { /* 守柔 */ } },
    _shellAccKey, // (供单测) email → 稳定不可枚举 accKey
    _shellAccRoute, // (供单测) 同源前缀路径 → 路由类型 (list/conv/create/sessionsJson/favicon)
    setCloudProvider(p) { _cloudProvider = p || null; }, // 归一 · dao-vsix 注入「六大板块」面板提供者
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
