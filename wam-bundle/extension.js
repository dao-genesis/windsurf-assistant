// WAM · 万法归宗 v2.6.8 · 道极版 · 道法自然 · 太上下知有之
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
const VERSION = "2.6.8";
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
const URL_GET_PLAN_STATUS = URL_GET_USER_STATUS_LIST[0];
// v2.6.0 · 软编码 · 会话 token 格式单点定义 · 后端变更时仅此一处修
const RE_SESSION_TOKEN = /^devin-session-token\$/;
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
const BACKUP_DIR = path.join(WAM_DIR, "backups");
const PENDING_TOKEN_FILE = path.join(WAM_DIR, "_pending_token.json");
const MAX_BACKUPS = 10;
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
  _switchingStartTime = 0,
  _lastSwitchTime = 0, // 上次切号成功时间 (冷却用)
  _predictiveCandidate = -1, // 预判候选 idx (本源 v8 · 额度低时提前选好下一号)
  _lastInjectFail = 0, // 上次注入失败时间 (rate-limit 拦截冷却)
  _lastDocChangeAt = 0, // 最近文档变化时间 (Cascade 流式避让 · 对齐本源 v17.42.5)
  _lastSwitchMs = 0, // 上次切号耗时ms (对齐本源 switchToAccount.ms)
  _lastPerMsgTriggerAt = 0, // v2.5 per-msg 触发防抖
  _perMsgHits = 0, // v2.5 Layer 6 命中累计 (诊断)
  _perMsgRotates = 0, // v2.5 Layer 6 触发切号累计 (诊断)
  _perMsgDebounced = 0, // v2.6.7 守一 · 防抖拦截累计 (修后应 ≥ hits 数量级)
  _lastRotateToastAt = 0, // 状态栏切号反馈 3s 高亮
  _lastRotateToastEmail = "", // 状态栏切号反馈上次 email
  _layer6Stop = null; // Layer 6 dispose 函数
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
function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
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
function _esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
function isWeeklyDrought() {
  if (!_store) return false;
  const s = _store.getStats();
  return s.drought;
}
function isTrialPlan(p) {
  return /trial|free/i.test(p || "");
}
function isClaudeAvailable(h) {
  if (!h || !h.checked) return false;
  const p = (h.plan || "").toLowerCase();
  // 兵无常势: 所有免费层 → Claude 死刑 (对齐本源 v17.42.4 _FREE_TIER_SET)
  if (/^free$|^devin.free$|^waitlist/i.test(p)) return false;
  // Trial 过期 + 额度耗尽 → 不可用
  if (
    isTrialPlan(p) &&
    h.planEnd > 0 &&
    Date.now() > h.planEnd &&
    h.daily <= 0 &&
    h.weekly <= 0
  )
    return false;
  return true;
}
// v2.3.0 锁🔒 全链路贯通 — 单一真相门 · 凡五辨一不齐即无效
// 五辨: password · skipAutoSwitch (手动锁) · isBanned (15min 真黑) · isInUse (120s 使用中守) · isClaudeAvailable
function _isValidAutoTarget(i) {
  if (i < 0 || !_store) return false;
  const acc = _store.accounts[i];
  if (!acc || !acc.password) return false;
  if (acc.skipAutoSwitch) return false; // 用户手动锁 → 禁止自动切号
  if (_store.isBanned(acc.email)) return false;
  if (_store.isInUse(acc.email)) return false; // v2.3.0 使用中🔒 · 120s 内刚切过的号自动切号跳
  const h = _store.getHealth(acc.email);
  if (!isClaudeAvailable(h)) return false;
  return true;
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

// ═══ § 万法识号 · 道法自然 · 一切账号格式同源 ═══
// 输入: 任意文本 (粘贴自微信/邮件/JSON/CSV/Token面板)
// 输出: { accounts: [{email, password}], tokens: [string] }
// 兼容: email password / email:pass / email----pass / email|pass / email,pass / email;pass / email\tpass
//        反序 (pass email) · JSON · 多行标签 (邮箱：x\n密码：y / Email: x\nPassword: y)
//        全角 ：=＝ · 原始 token (devin-session-token$ / eyJ JWT / auth1_ / 长 base64)
function parseAccountText(content) {
  const accounts = [];
  const tokens = [];
  if (!content || typeof content !== "string") return { accounts, tokens };

  const RE_LABEL_EMAIL =
    /^\s*(?:邮箱|账号|账户|帐号|帐户|用户名|用户|email|account|user(?:name)?|login|mail|id)\s*[:：=＝]\s*/i;
  const RE_LABEL_PASS =
    /^\s*(?:密码|口令|秘钥|password|pass|pwd|passwd|secret)\s*[:：=＝]\s*/i;
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

  function tryPair(a, b) {
    a = (a || "").trim();
    b = (b || "").trim();
    if (!a || !b) return null;
    if (a.includes("@")) return { email: a, password: b };
    if (b.includes("@")) return { email: b, password: a };
    return null;
  }

  function parseSingleLine(ln) {
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
    for (const sep of [",", ";"]) {
      if (ln.includes(sep)) {
        const p = ln.split(sep);
        if (p.length === 2) {
          const r = tryPair(p[0], p[1]);
          if (r) return r;
        }
      }
    }
    // 6. 空白 · email 在前
    let m = ln.match(/^(\S+@\S+)\s+(\S.*)$/);
    if (m) return { email: m[1], password: m[2].trim() };
    // 7. 空白 · email 在后 (反序)
    m = ln.match(/^(\S+)\s+(\S+@\S+)\s*$/);
    if (m && !m[1].includes("@")) return { email: m[2], password: m[1] };
    return null;
  }

  // 词法 · 把每一行归类为 email | pass | pair | token
  const items = [];
  for (const raw of content.split(/\r?\n/)) {
    let ln = raw.trim();
    if (!ln || ln.startsWith("#") || ln.startsWith("//")) continue;

    // 0. 整行就是 token
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
        if (e && p && String(e).includes("@")) {
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

    // 2. 标签前缀 · 密码
    const passM = ln.match(RE_LABEL_PASS);
    if (passM) {
      const v = ln.substring(passM[0].length).trim();
      if (v && !v.includes("@")) {
        if (looksLikeToken(v)) items.push({ type: "token", raw: v });
        else items.push({ type: "pass", password: v });
        continue;
      }
      ln = v || ln;
    }

    // 3. 标签前缀 · 邮箱
    const emailM = ln.match(RE_LABEL_EMAIL);
    if (emailM) {
      const v = ln.substring(emailM[0].length).trim();
      if (v.includes("@") && !/[\s|:：\t]/.test(v)) {
        items.push({ type: "email", email: v });
        continue;
      }
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

    // 5. 兜底: 整行就是邮箱 (待与下一行密码配对)
    if (/^\S+@\S+$/.test(ln)) {
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

  // 序列配对 · email 后接 pass
  let pendingEmail = null;
  for (const it of items) {
    if (it.type === "pair") {
      if (it.email && it.password && it.email.includes("@"))
        accounts.push({ email: it.email, password: it.password });
      pendingEmail = null;
    } else if (it.type === "email") {
      pendingEmail = it.email;
    } else if (it.type === "pass") {
      if (pendingEmail) {
        accounts.push({ email: pendingEmail, password: it.password });
        pendingEmail = null;
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
      if (!fs.existsSync(STATE_FILE)) return false;
      const j = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
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
      // v2.1.2 · 锁🔒贯通 · accountMeta 持久化 (skipAutoSwitch 重启不丢)
      if (j.accountMeta && typeof j.accountMeta === "object")
        this._savedAccountMeta = j.accountMeta;
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
  // v2.4.0 · 启动时自动清洗 D=W 污染数据 · 反者道之动 · 错镜像谬之绝
  // 背景: v2.1.3 之前代码错误镜像 weekly → daily, 写入伪相同 (D=W 且都 != 0/100)
  // 修复后旧数据仍在 wam-state.json · 本函数启动时检测 + 清除污染标记
  // 清后该号 health.checked = false · 仍可参与切号 (未验号基础分 50)
  //
  // stale 阈值: 12h (与 UI getHealth.isStale 同步 · v2.4.0 收严)
  //   endpoint 挂时全部号都会 stale · 顶部红条提示即可 · 单行不再标
  _cleanseHealthOnLoad() {
    const report = { dwPolluted: 0, staleCount: 0, trialNoPlanEnd: 0 };
    const STALE_HOURS = 12; // 超过 12h 认为陈年 (UI 会显 stale)
    const now = Date.now();
    for (const key of Object.keys(this.health)) {
      const h = this.health[key];
      if (!h) continue;
      // 检测 D=W 污染 (D=W 且 0 < D < 100 · 独立资源池同值概率极低)
      if (
        h.checked &&
        typeof h.daily === "number" &&
        typeof h.weekly === "number" &&
        h.daily === h.weekly &&
        h.daily > 0 &&
        h.daily < 100
      ) {
        // 标记为未验 · 清陯 D/W · 保留其他元数据 (planEnd/credits)
        h._dwPollutedAt = now;
        h.checked = false;
        h.daily = 0;
        h.weekly = 0;
        report.dwPolluted++;
      }
      // v2.5.4 · Trial 脏数据清洗 · 软编码判据 (兼容 Team Trial/Free Trial 等变体)
      //   实证: 2026-05-04 前 header X-Devin-Auth1-Function 缺 → parsePlan 跑过但 planEnd 可能遗失
      //   法: _isTrialLike(h) && planEnd==0 && checked=true · 标 checked=false · 下次自动重验
      if (h.checked && _isTrialLike(h) && (!h.planEnd || h.planEnd === 0)) {
        h._trialDirtyAt = now;
        h.checked = false;
        report.trialNoPlanEnd++;
      }
      // 统计 stale
      if (h.lastChecked && now - h.lastChecked > STALE_HOURS * 3600 * 1000) {
        report.staleCount++;
      }
    }
    return report;
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
      // v2.1.2 · 锁🔒贯通 · 提取 accountMeta (仅保存非默认状态以控制体积)
      const accountMeta = {};
      for (const a of this.accounts) {
        if (a && a.skipAutoSwitch) {
          accountMeta[a.email.toLowerCase()] = { skipAutoSwitch: true };
        }
      }
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
    // v2.1.2 · 锁🔒贯通 · 从持久化 accountMeta 恢复 skipAutoSwitch
    if (this._savedAccountMeta) {
      let restored = 0;
      for (const a of this.accounts) {
        const meta = this._savedAccountMeta[a.email.toLowerCase()];
        if (meta && meta.skipAutoSwitch) {
          a.skipAutoSwitch = true;
          restored++;
        }
      }
      if (restored > 0) log("reloadAccounts: 恢复 🔒 锁号 " + restored + " 个");
    }
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
    const sorted = [...indices].sort((a, b) => b - a);
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
      merged.daysLeft = Math.max(
        0,
        Math.round((merged.planEnd - Date.now()) / 86400000),
      );
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
    return Object.assign({}, h, {
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
  // ── v2.3.0 评分 — 道法自然 · D/W 综合 + 干旱/重置倒计时/锁/Claude门控 + 使用中🔒 ──
  _scoreOf(idx) {
    const a = this.accounts[idx];
    if (!a || !a.password) return -Infinity;
    if (a.skipAutoSwitch) return -Infinity; // 🔒 锁号不参与自动切号
    if (this.isBanned(a.email)) return -Infinity;
    if (this.isInUse(a.email)) return -Infinity; // v2.3.0 使用中🔒 120s 不参与
    const h = this.getHealth(a.email);
    if (!h.checked) return 50; // 未验号给基础分 (好过跳过)
    if (!isClaudeAvailable(h)) return -Infinity; // Free/过期耗尽不选
    const hrsToDaily = hoursUntilDailyReset();
    const hrsToWeekly = hoursUntilWeeklyReset();
    const drought = isWeeklyDrought();
    if (drought) {
      // ── 干旱模式: 只看 Daily ──
      if (h.daily <= 0 && hrsToDaily > 4) return -Infinity;
      let s = h.daily * 15;
      if (h.daily <= 5 && hrsToDaily <= 2)
        s += 300; // 即将重置 · 低额度也值得
      else if (h.daily <= 5 && hrsToDaily <= 6) s += 120;
      if (h.daily > 50) s += 200;
      if (h.staleMin >= 0 && h.staleMin < 5) s += 30;
      else if (h.staleMin >= 0 && h.staleMin > 60) s += 60;
      return s;
    }
    // ── 正常模式: D+W 综合评分 ──
    const eff = Math.min(h.daily, h.weekly);
    if (h.daily <= 0 && h.weekly <= 0 && hrsToDaily > 4 && hrsToWeekly > 4)
      return -Infinity;
    if (h.weekly <= 0 && hrsToWeekly > 6) return -Infinity;
    let s = eff * 10 + h.weekly * 8 + h.daily * 3;
    if (h.daily <= 5 && hrsToDaily <= 2) s += 250;
    else if (h.daily <= 5 && hrsToDaily <= 6) s += 100;
    if (h.weekly <= 5 && hrsToWeekly <= 4) s += 350;
    if (h.daily > 50 && h.weekly > 50) s += 200;
    if (h.staleMin >= 0 && h.staleMin < 5) s += 80;
    else if (h.staleMin >= 0 && h.staleMin < 30) s += 40;
    else if (h.staleMin < 0 || h.staleMin > 120) s -= 50;
    return s;
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
  getStats() {
    let totalD = 0,
      totalW = 0,
      checkedCount = 0,
      unchecked = 0,
      available = 0,
      exhausted = 0;
    for (const a of this.accounts) {
      const h = this.getHealth(a.email);
      if (!h.checked) {
        unchecked++;
        continue;
      }
      checkedCount++;
      totalD += h.daily;
      totalW += h.weekly;
      const eff = Math.min(h.daily, h.weekly);
      if (eff < 1) exhausted++;
      else available++;
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
    if (isRealSwitch) this.switches++;
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
  try {
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
    ideName: "windsurf",
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
      if (r.status === 401) _quotaEndpointHealth.consecutive401++;
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
      if (r.status === 401) break; // 认证拒绝 · 换 endpoint 无救
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
  // ── planEnd: ISO/proto-Timestamp/unix ms 兼容 ──
  let pe = 0;
  const peRaw = ps.planEnd || ps.plan_end || planInfo.endTimestamp || 0;
  if (typeof peRaw === "string") {
    const t = Date.parse(peRaw);
    if (!isNaN(t)) pe = t;
  } else if (peRaw && typeof peRaw === "object" && peRaw.seconds != null) {
    pe = Number(peRaw.seconds) * 1000;
  } else {
    pe = Number(peRaw) || 0;
  }
  const daysLeft =
    pe > 0 ? Math.max(0, Math.round((pe - Date.now()) / 86400000)) : 0;
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
  if (typeof psRaw === "string") {
    const t2 = Date.parse(psRaw);
    if (!isNaN(t2)) ps2 = t2;
  } else if (psRaw && typeof psRaw === "object" && psRaw.seconds != null) {
    ps2 = Number(psRaw.seconds) * 1000;
  } else {
    ps2 = _parseUnixTs(psRaw);
  }
  // ── teamsTier (软编码: 适配所有 plan 类型) ──
  const tierRaw = planInfo.teamsTier || planInfo.teams_tier || 0;
  let teamsTier = 0;
  if (typeof tierRaw === "number") teamsTier = tierRaw;
  else if (typeof tierRaw === "string") {
    const m = tierRaw.match(/\d+/);
    if (m) teamsTier = Number(m[0]);
  }
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
  };
}

// ═══ § 3b · 批量验证 (verifyOne / verifyAll) · 不切号 · 仅探测 quota ═══
// 取之尽锱铢: 用 devinLogin → postAuth → tryFetchPlanStatus 三步链条 · 不调 inject
// 用之如泥沙: 并行 + 间隔抖动 + 限速回退 · 防 Devin 整批拉黑
async function verifyOneAccount(account) {
  if (!account || !account.email || !account.password)
    return { ok: false, stage: "init", error: "no creds" };
  const dl = await devinLogin(account.email, account.password);
  if (!dl.ok) return { ok: false, stage: "devinLogin", error: dl.error };
  const pa = await windsurfPostAuth(dl.auth1);
  if (!pa.ok) return { ok: false, stage: "postAuth", error: pa.error };
  // v2.4.1 · 加 RegisterUser 步: 拿真 api_key + 动态 api_server_url
  //   GetUserStatus 真路径需 X-Api-Key Header · trial 里 sessionToken == apiKey, 失败时降级
  const reg = await registerUserViaSession(pa.sessionToken);
  const apiKey = (reg.ok && reg.apiKey) || pa.sessionToken;
  const apiServerUrl = (reg.ok && reg.apiServerUrl) || pa.apiServerUrl || "";
  const q = await tryFetchPlanStatus(apiKey, {
    apiServerUrl: apiServerUrl,
    silent: true,
  });
  if (!q) return { ok: false, stage: "planStatus", error: "fetch null" };
  return {
    ok: true,
    q,
    sessionToken: pa.sessionToken,
    apiKey,
    apiServerUrl,
  };
}

// 批量验证 · onlyStale=true 时跳过最近验过的 (默认 staleMin <= 30)
// v2.1.1 根治: 全局限速协调 + 指数退避 + 失败自动重试 · 新用户首次全池验证不再卡死
// parallel: 默认 3 (保守 · 防 Devin 限速 · 用户可改 wam.verify.parallel)
// gapMs: 每个 verify 完成后的间隔 (默认 250ms 抖动)
async function verifyAllAccounts(opts) {
  if (_verifyAllInProgress) return { ok: false, busy: true };
  _verifyAllInProgress = true;
  const o = opts || {};
  const onlyStale = !!o.onlyStale;
  const userParallel = Math.max(
    1,
    Math.min(8, _cfg("verify.parallel", 3) | 0 || 3),
  );
  const gapMs = Math.max(0, _cfg("verify.gapMs", 250) | 0);
  const staleThresholdMin = Math.max(1, _cfg("verify.staleMin", 30) | 0);
  const total = _store.accounts.length;
  // 构建队列 (排除黑名单 + onlyStale 时排除最近验过的)
  const queue = [];
  let uncheckedCount = 0;
  for (let i = 0; i < total; i++) {
    const a = _store.accounts[i];
    if (_store.isBanned(a.email)) continue;
    const h = _store.getHealth(a.email);
    if (!h.checked) uncheckedCount++;
    if (onlyStale) {
      if (h.checked && h.staleMin >= 0 && h.staleMin < staleThresholdMin)
        continue;
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
      (onlyStale ? " · onlyStale" : ""),
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
  _verifyAllInProgress = false;
  _broadcastUI();
  const dur = Math.round((Date.now() - t0) / 1000);
  log("verifyAll: 完成 · " + ok + " ✓ / " + fail + " ✗ · " + dur + "s");
  return { ok: true, total: ok + fail, ok, fail, durSec: dur };
}

async function injectViaJia(token) {
  const orig_show = vscode.window.showInputBox;
  const orig_open = vscode.env.openExternal;
  let showCalls = 0,
    openCalls = 0;
  const probeShow = async () => {
    showCalls++;
    return token;
  };
  const probeOpen = async () => {
    openCalls++;
    return false;
  };
  let installed = false;
  try {
    Object.defineProperty(vscode.window, "showInputBox", {
      value: probeShow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(vscode.env, "openExternal", {
      value: probeOpen,
      configurable: true,
      writable: true,
    });
    installed =
      vscode.window.showInputBox === probeShow &&
      vscode.env.openExternal === probeOpen;
  } catch (e) {
    return { ok: false, reason: "defineProperty: " + e.message };
  }
  if (!installed) return { ok: false, reason: "not-sticky" };
  let cmdErr = null;
  try {
    await vscode.commands.executeCommand("windsurf.loginWithAuthToken");
  } catch (e) {
    cmdErr = e && e.message ? e.message : String(e);
  } finally {
    try {
      Object.defineProperty(vscode.window, "showInputBox", {
        value: orig_show,
        configurable: true,
        writable: true,
      });
    } catch {}
    try {
      Object.defineProperty(vscode.env, "openExternal", {
        value: orig_open,
        configurable: true,
        writable: true,
      });
    } catch {}
  }
  if (showCalls === 0)
    return { ok: false, reason: "showInputBox-never-called", cmdErr };
  if (cmdErr) return { ok: false, reason: "handleAuthToken-error", cmdErr };
  return { ok: true, showCalls, openCalls };
}
// 路乙: clipboard + 命令触发 inputBox · silent 模式不弹 modal (自动切号场景)
// v2.1.2: 增加 opts.silent · 默认 silent=true (避免阻塞自动切号)
async function injectViaYi(token, opts) {
  const silent = !opts || opts.silent !== false;
  await vscode.env.clipboard.writeText(token);
  // silent 模式: 5s 超时 · 不弹 modal · 自动切号链不阻塞
  if (silent) {
    const r = await Promise.race([
      vscode.commands.executeCommand("windsurf.loginWithAuthToken").then(
        () => ({ ok: true }),
        (e) => ({ ok: false, error: (e && e.message) || String(e) }),
      ),
      new Promise((r) =>
        setTimeout(() => r({ ok: false, error: "timeout-silent" }), 5000),
      ),
    ]);
    return { ok: r.ok, reason: r.error || "", silent: true };
  }
  // 用户手动场景: 保留 modal 提示
  const promise = vscode.commands
    .executeCommand("windsurf.loginWithAuthToken")
    .then(
      () => ({ ok: true }),
      (e) => ({ ok: false, error: (e && e.message) || String(e) }),
    );
  vscode.window.showInformationMessage(
    "WAM: token 已复制 · 请在 inputBox 按 Ctrl+V 然后 Enter",
    "Got it",
  );
  const r = await promise;
  return { ok: r.ok, reason: r.error || "" };
}
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
    const c = await Promise.race([
      vscode.commands.executeCommand(
        "windsurf.provideAuthTokenToAuthProvider",
        token,
      ),
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

// v2.1.2: opts.silent (默认 true) · opts.preferYi (debug 用)
async function injectToken(token, opts) {
  opts = opts || {};
  // preferYi 强走旧路 (debug)
  if (_cfg("preferYi", false) || opts.preferYi) {
    const r = await injectViaYi(token, { silent: opts.silent !== false });
    return { ok: r.ok, path: "乙", note: r.reason || "" };
  }
  // 路丙: IDE 内部 API (主路径 · 真无为)
  log("inject 路丙 provideAuthTokenToAuthProvider");
  const c = await injectViaBing(token);
  if (c.ok) {
    log("路丙 ✓ " + (c.detail || ""));
    return { ok: true, path: "丙" };
  }
  log("路丙 ✗ " + c.reason);
  // 路甲兜底: hijack
  log("降路甲 hijack");
  const a = await injectViaJia(token);
  if (a.ok) {
    log("路甲 ✓ showCalls=" + a.showCalls);
    return { ok: true, path: "甲" };
  }
  log("路甲 ✗ " + a.reason + (a.cmdErr ? " err: " + a.cmdErr : ""));
  // 路乙兜底: clipboard (默认 silent · 不阻塞自动切号)
  log("降路乙 clipboard" + (opts.silent === false ? " (modal)" : " (silent)"));
  const b = await injectViaYi(token, { silent: opts.silent !== false });
  return { ok: b.ok, path: "乙", note: b.reason || "" };
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
  // v2.4.1 · loginAccount 走完整 v2.4.1 链: RegisterUser → apiKey + apiServerUrl → GetUserStatus
  // 先发起 register (synchronous-ish) 以拿真 apiKey, 再 tryFetchPlanStatus 用它做 auth
  registerUserViaSession(pa.sessionToken)
    .then((reg) => {
      const apiKey = (reg.ok && reg.apiKey) || pa.sessionToken;
      const apiServerUrl =
        (reg.ok && reg.apiServerUrl) || pa.apiServerUrl || "";
      // 先写 active api key/url (loginAccount 之后的 healthCheck/tick 也要用)
      if (reg.ok) {
        store.activeApiKey = reg.apiKey;
        store.activeApiServerUrl = reg.apiServerUrl;
        store.save();
      }
      return tryFetchPlanStatus(apiKey, { apiServerUrl });
    })
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
      }
    })
    .catch(() => {});
  const inj = await injectToken(pa.sessionToken);
  if (!inj.ok) {
    log("  inject ✗ 路" + inj.path + " " + inj.note);
    _bumpFailure(store, acc.email, "inject: " + (inj.note || ""));
    return { ok: false, stage: "inject", error: inj.note };
  }
  store.setActive(idx, acc.email, pa.sessionToken, null, null, inj.path);
  // v2.3.0: 登陆成 · 消 _bumpFailure 计数 (不让历史泛黄　转转不休)
  {
    const k = acc.email.toLowerCase();
    const b = store.blacklist[k];
    if (b && !b.until) {
      delete store.blacklist[k];
      store.save();
    }
  }
  registerUserViaSession(pa.sessionToken)
    .then((r) => {
      if (r.ok) {
        store.activeApiKey = r.apiKey;
        store.activeApiServerUrl = r.apiServerUrl;
        store.save();
        log("  registerUser ✓ apiServerUrl=" + r.apiServerUrl);
      }
    })
    .catch(() => {});
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
  if (_sidebarProvider) _sidebarProvider.refresh();
  if (_editorPanel) {
    try {
      _editorPanel.webview.html = buildHtml();
    } catch {}
  }
  updateStatusBar();
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

// ═══ § v2.5 直觉切号 · Layer 6 跨进程信号触发 ═══
// 道法自然 · 不主动量度 · 仅在 cascade webview 写 state.vscdb 时随之切号
//
// 反者道之动: v2.3-v2.4.13b 尝试 Layer 1-5 (http/net/fetch/http2/sock) hook
// 均在 ext host 进程内 · 但 cascade webview 在独立 electron renderer 进程
// 跨进程隔离实证失效 · self-test 自触被误为真命中 → v2.5 大减法弃 L1-L5
//
// 配置: wam.rotateOnEveryMessage (默认 true)
//      wam.perMessageDebounceMs (默认 4000ms)
//      wam.perMessageDelayMs (默认 1500ms · 切号延迟 · 让当前消息先发出)
function _maybeTrigger(reason, hint) {
  // v2.3.0 道法自然 · 默认开 (rotateOnEveryMessage=true) · 可手关
  if (!_cfg("rotateOnEveryMessage", true)) return;
  if (_wamMode !== "wam") return;
  if (_switching) return;
  if (!_store || _store.activeIdx < 0) return;
  if (_engine && _engine.rotating) return;

  const now = Date.now();
  const debounceMs = Math.max(500, _cfg("perMessageDebounceMs", 4000) | 0);
  if (now - _lastPerMsgTriggerAt < debounceMs) {
    // v2.6.7 守一: 防抖拦截入诊断 · 修后多源派生 settle 应在此聚合到一条切号
    _perMsgDebounced++;
    log(
      "👁 per-msg debounced#" +
        _perMsgDebounced +
        " · " +
        reason +
        " · " +
        (hint || "?") +
        " (Δ=" +
        (now - _lastPerMsgTriggerAt) +
        "ms<" +
        debounceMs +
        "ms)",
    );
    try {
      const diagP = path.join(WAM_DIR, "_per_msg_diag.json");
      const prev = fs.existsSync(diagP)
        ? JSON.parse(fs.readFileSync(diagP, "utf8"))
        : { hits: [], rotates: [] };
      prev.totalDebounced = _perMsgDebounced;
      prev.lastDebounced = now;
      atomicWrite(diagP, JSON.stringify(prev, null, 2));
    } catch {}
    return; // 防抖: 一轮对话多请求只算一次
  }
  // v2.3.0: 去 switchCooldownMs 闸 · 由 in-use 锁 (120s) 更细粒度替代 (全局 cooldown 会拦正当切号)
  if (now - _lastInjectFail < 30000) return; // 注入失败冷却仍保 · 30s
  // v2.5.9: 最小切号间隔 · pb·new 为精确信号故默认 0 · 可手动配置兜底
  const minIntervalMs = Math.max(0, _cfg("perMessageMinIntervalMs", 0) | 0);
  if (minIntervalMs > 0 && now - _lastSwitchTime < minIntervalMs) return;

  _lastPerMsgTriggerAt = now;
  _perMsgHits++;
  log(
    "👁 per-msg hit#" +
      _perMsgHits +
      " · " +
      reason +
      " · " +
      (hint || "?") +
      " → 计划切号",
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

  // 异步切 · 让当前消息先送出 (perMessageDelayMs)
  const delayMs = Math.max(0, _cfg("perMessageDelayMs", 1500) | 0);
  setTimeout(async () => {
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
  }, delayMs);
}

// ═══ Layer 6 · 跨进程文件信号 (v2.5.9 · 反者道之动 · 万法归宗) ═══
// v2.5.9 道极简化: 只监 cascade/*.pb 新文件创建
//   · 实证: Windsurf 每个新对话 = 新建一个 UUID.pb 文件
//   · 信号: 新文件出现 → 用户开启新对话 → 切一次号 (1:1 精确对应)
//   · 无噪: 无 WAL checkpoint 噪音 · 无 size-growth 误判
//   · 普适: 所有 Windsurf 窗口共享 cascade 目录 · 任一窗口新对话均触发
//   旧 v2.5.8: 双信号(pb·size + WAL) · 过触发 · v2.5.9 损之又损 → 唯一真信号
function _resolveCascadePbDir() {
  // v2.5.8: ~/.codeium/windsurf/cascade/ —— Cascade 对话直接存储
  const candidates = [
    path.join(os.homedir(), ".codeium", "windsurf", "cascade"),
    path.join(os.homedir(), ".codeium", "windsurf-nightly", "cascade"),
    path.join(
      os.homedir(),
      "AppData",
      "Local",
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
  // Windows hardcode fallback
  const win = path.join(
    os.homedir(),
    "AppData",
    "Roaming",
    "Windsurf",
    "User",
    "workspaceStorage",
  );
  if (fs.existsSync(win)) return win;
  // macOS/Linux fallback
  const mac = path.join(
    os.homedir(),
    ".config",
    "Windsurf",
    "User",
    "workspaceStorage",
  );
  if (fs.existsSync(mac)) return mac;
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
        _lastPerMsgTriggerAt = 0;
        _maybeTrigger("L6→pb·new", f.slice(0, 8));
        const gap = Math.max(0, _cfg("perMessageDelayMs", 1500) | 0) + 2000;
        await new Promise((r) => setTimeout(r, gap));
      }
      _queueRunning = false;
    }

    const POLL_MS = 600;
    // v2.6.6 反者道之动: settle (debounce trailing edge) 替 cooloff
    // SETTLE_MS: 文件增长后静默此时长 = AI 已停 = 真切号时机
    const SETTLE_MS = Math.max(3000, _cfg("sendDetectSettleMs", 15000) | 0);
    // ACCUM_MIN: settle 期间累积增量阈值 · 低于此值视为心跳/元数据 · 不切号
    const ACCUM_MIN = Math.max(256, _cfg("sendDetectAccumMin", 5120) | 0);
    // 单次最小增量: 低于此值不入累积 (噪声过滤)
    const GROW_MIN = Math.max(20, _cfg("sendDetectGrowMin", 30) | 0);
    // 单次大增量兜底: 单写 ≥ LARGE_DELTA 直接立即切 (AI 大代码块持续流式时不憋太久)
    const LARGE_DELTA = 131072; // 128KB

    // settle 状态: f → { accum: number, timer: NodeJS.Timeout, claimed: bool }
    const pbSettle = new Map();

    function _firePbSettle(f, total, reason) {
      // 跨实例声明锁: 时间桶 key · SETTLE_MS 窗口内唯一
      const _bucket = Math.floor(Date.now() / SETTLE_MS);
      const _claim = path.join(
        L6_CLAIM_DIR,
        f.slice(0, 8) + "." + _bucket + ".settle",
      );
      try {
        fs.writeFileSync(_claim, String(process.pid), { flag: "wx" });
      } catch {
        return; // 已被另一实例认领
      }
      log(
        "Layer 6 · pb·settle: " +
          f.slice(0, 8) +
          " 累积" +
          total +
          "B · " +
          reason +
          " [pid=" +
          process.pid +
          "] → 切号",
      );
      // v2.6.7 守一 · 删 _lastPerMsgTriggerAt = 0 (自夺防抖) · 让多源派生 settle 自然合一
      _maybeTrigger("L6→pb·settle", f.slice(0, 8) + "+" + total);
    }

    const timer = setInterval(() => {
      try {
        let hasNew = false;
        for (const f of fs.readdirSync(cascadePbDir)) {
          if (!f.endsWith(".pb")) continue;
          const fpath = path.join(cascadePbDir, f);

          if (!knownPbs.has(f)) {
            // ── 信号①: 新文件 = 新对话 → 立即入队切号 ──
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
          } else {
            // ── 信号②: 存量文件增量 → settle 累积 → 静默后切号 (反者道之动) ──
            try {
              const newSz = fs.statSync(fpath).size;
              const oldSz = pbSizes.get(f) || 0;
              const delta = newSz - oldSz;
              pbSizes.set(f, newSz);
              if (delta < 0) {
                // 文件缩小(重写/截断) → 清空累积 + 取消 settle
                const st = pbSettle.get(f);
                if (st && st.timer) clearTimeout(st.timer);
                pbSettle.delete(f);
                continue;
              }
              if (delta < GROW_MIN) continue; // 单次太小·跳过

              // 累积
              let st = pbSettle.get(f);
              if (!st) {
                st = { accum: 0, timer: null };
                pbSettle.set(f, st);
              }
              st.accum += delta;

              // 单次大增量兜底: 立即切 + 重置累积
              if (delta >= LARGE_DELTA && st.accum >= ACCUM_MIN) {
                if (st.timer) clearTimeout(st.timer);
                const total = st.accum;
                st.accum = 0;
                st.timer = null;
                _firePbSettle(f, total, "大块" + delta + "B");
                continue;
              }

              // 重置 settle 计时器: SETTLE_MS 后到期 → 切号
              if (st.timer) clearTimeout(st.timer);
              st.timer = setTimeout(() => {
                const total = st.accum;
                st.accum = 0;
                st.timer = null;
                if (total < ACCUM_MIN) {
                  // 累积未达阈值 (心跳/小元数据) · 不切号
                  log(
                    "Layer 6 · pb·settle·skip: " +
                      f.slice(0, 8) +
                      " 累积" +
                      total +
                      "B<" +
                      ACCUM_MIN +
                      " [pid=" +
                      process.pid +
                      "]",
                  );
                  return;
                }
                _firePbSettle(f, total, "静默" + SETTLE_MS + "ms");
              }, SETTLE_MS);
            } catch {}
          }
        }
        if (hasNew) _drainQueue().catch(() => {});
      } catch {}
    }, POLL_MS);

    _layer6Stop = () => {
      clearInterval(timer);
      // 清理悬挂 settle 计时器 (防退出残留)
      for (const st of pbSettle.values()) {
        if (st && st.timer) clearTimeout(st.timer);
      }
      pbSettle.clear();
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
      "Layer 6 · watch[pb·new+pb·settle] · " +
        POLL_MS +
        "ms · settle=" +
        SETTLE_MS +
        "ms · accum≥" +
        ACCUM_MIN +
        "B · grow≥" +
        GROW_MIN +
        "B · " +
        cascadePbDir,
    );
  } catch (e) {
    log("Layer 6 · install fail: " + (e.message || e));
  }
}

// ── WAL 直达触发 (v2.6.3 · 大道至简 · Send 按鈕最底层信号源) ──
// state.vscdb-wal 在用户点击 Send 后同步写入 SQLite WAL 帧
// 高于 pb 文件: WAL 写入在 HTTP 请求前发生 · 300ms 轮询 · 比 pb 轮询快一倍
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

    // v2.6.6 反者道之动: WAL 同走 settle 模型 (debounce trailing edge)
    const WAL_SETTLE_MS = Math.max(3000, _cfg("walDetectSettleMs", 15000) | 0);
    const WAL_ACCUM_MIN = Math.max(512, _cfg("walDetectAccumMin", 10240) | 0);
    // SQLite WAL 帧 = pageSize(4096) + 24B 帧头 · 任意有效内容写入必然 ≥1 帧
    const WAL_GROW_MIN = Math.max(100, _cfg("walDetectGrowMin", 1024) | 0);
    const WAL_POLL_MS = 300; // 比 pb 轮询(600ms)快一倍 · 更贴近真实 send 时刻
    const WAL_LARGE = 524288; // 单次 ≥512KB 立即 settle 兜底

    let walAccum = 0;
    let walSettleTimer = null;

    function _fireWalSettle(total, reason) {
      const bucket = Math.floor(Date.now() / WAL_SETTLE_MS);
      const claim = path.join(L6_CLAIM_DIR, "wal." + bucket + ".settle");
      try {
        fs.writeFileSync(claim, String(process.pid), { flag: "wx" });
      } catch {
        return; // 已被其他实例认领
      }
      log(
        "WAL · settle: 累积" +
          total +
          "B · " +
          reason +
          " [pid=" +
          process.pid +
          "] → 切号",
      );
      // v2.6.7 守一 · 删 _lastPerMsgTriggerAt = 0 (自夺防抖) · WAL 与 pb 同源派生收一道
      _maybeTrigger("L6→wal·settle", "+" + total);
    }

    const timer = setInterval(() => {
      try {
        const newSz = fs.statSync(walPath).size;
        const delta = newSz - walSz;
        if (delta < 0) {
          // WAL checkpoint: 主 DB 吸收 WAL 后 WAL 缩小 · 重置累积
          walSz = newSz;
          if (walSettleTimer) clearTimeout(walSettleTimer);
          walSettleTimer = null;
          walAccum = 0;
          return;
        }
        if (delta < WAL_GROW_MIN) return;
        walSz = newSz;
        walAccum += delta;

        // 单次大块兜底
        if (delta >= WAL_LARGE && walAccum >= WAL_ACCUM_MIN) {
          if (walSettleTimer) clearTimeout(walSettleTimer);
          const total = walAccum;
          walAccum = 0;
          walSettleTimer = null;
          _fireWalSettle(total, "大块" + delta + "B");
          return;
        }

        // 重置 settle
        if (walSettleTimer) clearTimeout(walSettleTimer);
        walSettleTimer = setTimeout(() => {
          const total = walAccum;
          walAccum = 0;
          walSettleTimer = null;
          if (total < WAL_ACCUM_MIN) {
            log(
              "WAL · settle·skip: 累积" +
                total +
                "B<" +
                WAL_ACCUM_MIN +
                " [pid=" +
                process.pid +
                "]",
            );
            return;
          }
          _fireWalSettle(total, "静默" + WAL_SETTLE_MS + "ms");
        }, WAL_SETTLE_MS);
      } catch {}
    }, WAL_POLL_MS);

    log(
      "WAL watcher · " +
        WAL_POLL_MS +
        "ms · settle=" +
        WAL_SETTLE_MS +
        "ms · accum≥" +
        WAL_ACCUM_MIN +
        "B · grow≥" +
        WAL_GROW_MIN +
        "B · " +
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
    { enableScripts: true, retainContextWhenHidden: true },
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
    webviewView.webview.options = { enableScripts: true };
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
//     有效 (daysLeft>0):                    "N天" + 阈值色 (≤2红 ≤5橙 其它绿)
//     过期 (planEnd>0 且 daysLeft<=0):      "已过期" 红
//     Trial 脏数据 (Trial 且 planEnd=0):    "Trial?" 黄 · tooltip 提示重验
//     永久 (其它 · planEnd=0 已验):         "∞" 灰 · Pro/Free 或后端缺字段
function _buildExpTag(h) {
  if (!h || !h.checked) {
    return '<span class="days" style="color:#555" title="未验·点🔍获取剩余有效期">?天</span>';
  }
  if (h.daysLeft > 0) {
    const ec =
      h.daysLeft <= 2 ? "#f44" : h.daysLeft <= 5 ? "#ce9178" : "#4ec9b0";
    const dStr = h.planEnd
      ? new Date(h.planEnd).toLocaleDateString("zh-CN")
      : "?";
    return `<span class="days" style="color:${ec}" title="Plan 到期 ${dStr} · 剩 ${h.daysLeft} 天">${h.daysLeft}天</span>`;
  }
  if (h.planEnd > 0) {
    const dStr = new Date(h.planEnd).toLocaleDateString("zh-CN");
    return `<span class="days" style="color:#f44" title="Trial 已过期 (${dStr})">已过期</span>`;
  }
  // planEnd==0 且 checked · 判 Trial 脏数据还是真 Pro 永久
  if (_isTrialLike(h)) {
    return '<span class="days" style="color:#d4c05a" title="Trial 剩余天数未知·点🔍重新验证">Trial?</span>';
  }
  return '<span class="days" style="color:#888" title="无 Plan 到期·Pro 永久或字段缺">∞</span>';
}

function buildHtml() {
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
      ${expTag}${planTag}${claudeTag}${bnTag}${iuTag}${staleTag}${freshTag}${liveTag}${ucTag}
      <span class="qt">
        <span class="mb"><span class="mf" style="width:${dPct}%;background:${dC}"></span></span>
        <span class="ql" style="color:${dC}">${isU ? "D?" : "D" + dPct}</span>
        <span class="mb"><span class="mf" style="width:${isU ? 0 : wPct}%;background:${wC}"></span></span>
        <span class="ql" style="color:${wC}">${isU ? "W?" : "W" + wPct}</span>
      </span>
      <span class="acts">
        <button class="b sk" onclick="sk(${i})" title="${a.skipAutoSwitch ? "已锁定·自动切号跳过此号(点击解锁)" : "锁定·防止自动切号选到此号"}" style="opacity:${a.skipAutoSwitch ? "1;color:#f0c674" : ".4"}">${a.skipAutoSwitch ? "&#128274;" : "&#128275;"}</button>
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
    if (ah.daysLeft > 0) {
      const ec =
        ah.daysLeft <= 2
          ? "var(--red)"
          : ah.daysLeft <= 5
            ? "var(--orange)"
            : "var(--green)";
      planExpiryTag = ` <span style="color:${ec}">${ah.daysLeft}天</span>`;
    } else if (ah.planEnd > 0) {
      planExpiryTag = ' <span style="color:var(--red)">已过期</span>';
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
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
.row{display:flex;align-items:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;gap:4px}
.row:hover{background:#2a2d2e}
.row.act{background:#264f7844;border-left:2px solid var(--blue)}
.row.banned{opacity:.5;background:#2a1a1a}
.row.inuse{background:#1a2a3a;border-left:2px solid #6cb3ff66}
.iu{font-size:9px;background:#1a3a5a;color:#6cb3ff;padding:0 4px;border-radius:3px;font-weight:600}
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
</style></head><body>
<div class="hd">
<div class="st"><span style="color:${poolColor};font-weight:700">D${stats.totalD} W${stats.totalW}</span><span><b>${stats.available}</b>可用</span>${stats.exhausted > 0 ? `<span class="ex"><b>${stats.exhausted}</b>耗尽</span>` : ""}<span><b>${stats.pwCount}</b>号</span>${stats.unchecked > 0 ? `<span style="color:var(--blue)"><b>${stats.unchecked}</b>未验</span>` : ""}${stats.banned > 0 ? `<span style="color:var(--red)"><b>${stats.banned}</b>黑</span>` : ""}${stats.inUse > 0 ? `<span style="color:#6cb3ff" title="v2.3.0 使用中锁·120s后可再选"><b>${stats.inUse}</b>🔒</span>` : ""}<span class="mode-sw"><button class="${_wamMode === "wam" ? "on" : ""}" onclick="setMode('wam')" title="WAM 自动切号">WAM</button><button class="${_wamMode === "official" ? "on" : ""}" onclick="setMode('official')" title="官方登录·停引擎">官方</button></span></div>
<div class="pool-bar"><div class="pool-fill" style="width:${poolPct}%"></div></div>
${activeHtml}${monitorBar}
${_wamMode === "official" ? '<div style="background:#2a1a1a;border:1px solid #4a2a2a;border-radius:4px;padding:6px 10px;margin:4px 0;font-size:11px;color:#f87171"><b>&#128274; 官方登录模式</b><br>WAM 引擎已停 (扫描/切号/心跳)<br>切回 WAM 模式可恢复自动轮转</div>' : ""}
${stats.drought ? '<div style="background:#2a2a1a;border:1px solid #4a4a2a;border-radius:4px;padding:4px 10px;margin:4px 0;font-size:11px;color:#eab308">&#127964;&#65039; <b>Weekly 干旱</b> 全池W耗尽·D重置 ' + stats.hrsToDaily.toFixed(1) + "h后 · 自动换号仅看D</div>" : ""}
${_verifyAllInProgress ? '<div style="background:#1a2a3a;border:1px solid #2a3a5a;border-radius:4px;padding:4px 10px;margin:4px 0;font-size:11px;color:#9cdcfe">&#9203; <b>正在批量验证</b> · 见 Output 实时进度</div>' : ""}
${_quotaEndpointDead() ? `<div class="endpoint-warn">&#9888;&#65039; <b>GetPlanStatus endpoint 已挂</b> &middot; 连续 ${_quotaEndpointHealth.consecutive401} 次 401 invalid token &middot; 服务端可能已迁移 &middot; quota% 数据保持陈年 &middot; <code>切号决策仍然工作</code> (rate-limit 拦截 + per-msg 切号 + in-use 锁)</div>` : ""}
</div>
<div class="batch-bar" id="batchBar"><span>已选 <b id="batchCount">0</b> 个</span><button onclick="batchDelete()">批量删除</button><button onclick="clearSelection()" style="background:#333;color:var(--blue)">取消</button></div>
<div class="add-section">
<div class="add-header" onclick="toggleAdd()"><span>&#43; 添加账号</span><span id="addArrow">&#9660;</span></div>
<div class="add-body" id="addBody">
<textarea id="addInput" placeholder="支持任意格式，每行一个 (自动识别)：&#10;email password   /   email:password   /   email----password&#10;email|password   /   email,password   /   email\tpassword&#10;邮箱：x@y.com&#10;密码：abc123    (多行标签 · 全角:也行)&#10;{&quot;email&quot;:&quot;x&quot;,&quot;password&quot;:&quot;y&quot;}    (JSON)&#10;devin-session-token$xxx   或   eyJ…JWT   (直接登录)"></textarea>
<div class="add-actions"><button onclick="doAdd()">添加</button><button onclick="copyAll()" style="background:#333;color:var(--blue);margin-left:auto">&#128203; 一键导出</button></div>
<div class="add-hint">万法识号 · 邮箱密码自动入库 · 原始 token 自动直登 · 重复跳过</div>
</div></div>
<div class="sec"><span>&#9660; 账号列表 (${stats.pwCount})</span></div>
<div id="list">${rows}</div>
<div class="footer">WAM <span class="v">v${VERSION}</span><br>${_esc(store.accountsSource || "")}</div>
<div class="toast" id="toast"></div>
<script>
const vscode = acquireVsCodeApi();
function send(t,i){vscode.postMessage({type:t,index:i});}
function _clickFb(e){if(!e||!e.target)return;const b=e.target.closest('.b');if(b){b.classList.add('clicked');setTimeout(()=>b.classList.remove('clicked'),150);}}
function sw(i){_clickFb(event);send('switch',i);}
function sk(i){_clickFb(event);send('toggleSkip',i);}
function vf(i){_clickFb(event);send('verify',i);}
function cp(i){_clickFb(event);vscode.postMessage({type:'copyAccount',index:i});}
function rm(i){_clickFb(event);send('remove',i);}
function copyAll(){vscode.postMessage({type:'copyAllAccounts'});}
function setMode(m){vscode.postMessage({type:'setMode',mode:m});}
function toggleAdd(){const b=document.getElementById('addBody');b.classList.toggle('open');document.getElementById('addArrow').textContent=b.classList.contains('open')?'\\u25B2':'\\u25BC';}
function doAdd(){const ta=document.getElementById('addInput');const t=ta.value.trim();if(!t)return;vscode.postMessage({type:'addBatch',text:t});ta.value='';}
function showToast(m,cls){const t=document.getElementById('toast');t.textContent=m;t.className='toast show'+(cls?' '+cls:'');setTimeout(()=>{t.className='toast';},2200);}
function updateBatchBar(){const c=document.querySelectorAll('.chk:checked');document.getElementById('batchCount').textContent=c.length;document.getElementById('batchBar').classList.toggle('visible',c.length>0);}
function batchDelete(){const ix=[...document.querySelectorAll('.chk:checked')].map(c=>parseInt(c.dataset.i));if(ix.length===0)return;vscode.postMessage({type:'removeBatch',indices:ix});}
function clearSelection(){document.querySelectorAll('.chk:checked').forEach(c=>c.checked=false);updateBatchBar();}
document.addEventListener('change',e=>{if(e.target.classList.contains('chk'))updateBatchBar();});
window.addEventListener('message',e=>{const m=e.data;
if(m.type==='toast'){const cls=m.text&&m.text.startsWith('\\u2713')?'ok':m.text&&m.text.startsWith('\\u2717')?'fail':'';showToast(m.text,cls);}
if(m.type==='switching'){const r=document.querySelector('.row[data-i=\"'+m.index+'\"]');if(r){r.classList.add('switching');showToast('\\u26A1 \\u5207\\u6362\\u4E2D...');}}
if(m.type==='verifying'){const r=document.querySelector('.row[data-i=\"'+m.index+'\"]');if(r){r.classList.add('verifying');}}
if(m.type==='quotaChange'){const r=document.querySelector('.row[data-email=\"'+(m.email||'').toLowerCase()+'\"]');if(r){r.classList.add('quota-flash');setTimeout(()=>r.classList.remove('quota-flash'),700);}}
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
        // v17.42.20 手动抢占: _switching 超 30s 强制释放
        if (_switching) {
          const lockAge = Date.now() - _switchingStartTime;
          if (lockAge < 30000) {
            _toast("正在切换中(" + Math.round(lockAge / 1000) + "s)...");
            return;
          }
          log(
            "switch: 手动抢占 — 强制释放超时锁(" +
              Math.round(lockAge / 1000) +
              "s)",
          );
          _switching = false;
        }
        if (_engine.rotating && !_switching) {
          _toast("引擎正在轮转中...");
          return;
        }
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
        _broadcastMsg({ type: "verifying", index: i });
        _toast("🔍 验证中: " + a.email.split("@")[0]);
        const dl = await devinLogin(a.email, a.password);
        if (!dl.ok) {
          _bumpFailure(_store, a.email, "verify-devin: " + dl.error);
          _toast("✗ devin: " + dl.error + " · " + (Date.now() - vt0) + "ms");
          _broadcastUI();
          return;
        }
        const pa = await windsurfPostAuth(dl.auth1);
        if (!pa.ok) {
          _bumpFailure(_store, a.email, "verify-postAuth: " + pa.error);
          _toast("✗ postAuth: " + pa.error + " · " + (Date.now() - vt0) + "ms");
          _broadcastUI();
          return;
        }
        // v2.4.1 · webview 单号验: 加 RegisterUser 拿真 apiKey · 走 GetUserStatus 真路径
        const reg = await registerUserViaSession(pa.sessionToken);
        const apiKey = (reg.ok && reg.apiKey) || pa.sessionToken;
        const apiServerUrl =
          (reg.ok && reg.apiServerUrl) || pa.apiServerUrl || "";
        const q = await tryFetchPlanStatus(apiKey, { apiServerUrl });
        const vms = Date.now() - vt0;
        if (q) {
          _store.setHealth(a.email, q);
          _toast(
            "✓ " +
              a.email.split("@")[0] +
              " D" +
              q.daily +
              "% W" +
              q.weekly +
              "% " +
              (q.plan || "") +
              " · " +
              vms +
              "ms",
          );
        } else {
          _store.setHealth(a.email, { plan: "?", daily: 0, weekly: 0 });
          _toast("✓ 登录通 · PlanStatus 未取到 · " + vms + "ms");
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
        const r = _store.addBatch(msg.text || "");
        let info = "添加 " + r.added + " 个";
        if (r.duplicate > 0) info += " · 跳重 " + r.duplicate;
        const tks = r.tokens || [];
        if (tks.length > 0) {
          info += " · 检出 " + tks.length + " token";
          // 直登 · 注入第一个 token (后续 token 仅记录)
          const inj = await injectToken(tks[0]);
          if (inj.ok) {
            _store.lastInjectPath = inj.path;
            _store.activeTokenShort = (tks[0] || "").substring(0, 24) + "…";
            _store.save();
            info += " ✓路" + inj.path;
            log(
              "addBatch token直登 ✓ 路" +
                inj.path +
                " · 余 " +
                (tks.length - 1) +
                " 个未用",
            );
          } else {
            info += " ✗" + (inj.note || inj.path || "?");
            log("addBatch token直登 ✗ " + (inj.note || ""));
          }
        }
        _toast(info);
        _store.reloadAccounts();
        _broadcastUI();
        // v2.4.3 · 新加号即时后台 verify · 不再等 30min stale 周期
        //   · 1s 后启动 (让 UI 先 render 加号成功)
        //   · 串行 + 800ms 抖动 (防 Devin 拉黑)
        //   · 失败不重试 (用户可手动点🔍按钮)
        if (r.added > 0 && r.addedEmails && r.addedEmails.length > 0) {
          const newEmails = r.addedEmails.slice();
          setTimeout(async () => {
            log(
              "addBatch · 新加 " + newEmails.length + " 号 · 后台即时 verify",
            );
            for (const em of newEmails) {
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
                  _broadcastUI();
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
              // 抖动 800ms ± 30%
              await new Promise((rr) =>
                setTimeout(rr, 800 + Math.random() * 480),
              );
            }
            _broadcastUI();
          }, 1000);
        }
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
      case "copyAllAccounts": {
        const lines = _store.accounts.map((a) => a.email + ":" + a.password);
        await vscode.env.clipboard.writeText(lines.join("\n"));
        _toast("\u2713 已导出 " + lines.length + " 个账号到剪贴板");
        break;
      }
      // ── 本源 v17.42.7 锁🔒 toggleSkip ──
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
          log(
            "🔒 " +
              (acc3.skipAutoSwitch ? "锁" : "解锁") +
              ": " +
              acc3.email.substring(0, 20),
          );
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
        const m = msg.mode === "official" ? "official" : "wam";
        if (m === _wamMode) {
          _toast(
            "当前已是 " + (m === "wam" ? "WAM切号" : "官方登录") + " 模式",
          );
          break;
        }
        _wamMode = m;
        if (m === "official") {
          if (_engine) _engine.stopMonitor();
          _toast("已切官方登录模式 · WAM 引擎停");
          log("setMode: official · 引擎停");
        } else {
          if (_engine) _engine.startMonitor();
          _toast("已切 WAM 切号模式 · 引擎启");
          log("setMode: wam · 引擎启");
        }
        if (_ctx) _ctx.globalState && _ctx.globalState.update("wam.mode", m);
        _broadcastUI();
        break;
      }
      // ── 对齐本源: refresh (刷新视图) ──
      case "refresh": {
        _store.reloadAccounts();
        _broadcastUI();
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
    if (this.rotating) {
      log("rotate: in-progress");
      return { ok: false, busy: true };
    }
    this.rotating = true;
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
      log("rotate: 候选 " + order.length + " 个 (按 score 降序)");
      // v2.4.13b · rate-limit 早停 (知止所以不殆)
      //   Devin 返回 "Rate limit exceeded" 是 IP/device 级 · 全号都会 fail
      //   继续 for-loop 会把所有 73 可用号都失败 3 次入 15min 黑
      //   实测 thrash: 一次 rotate 扩展成 50+ 号 ban · 号池瞬间坍
      const RE_RATE_LIMIT = /rate.?limit|too.?many.?request|429/i;
      let rateLimitHit = false;
      for (const idx of order) {
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
    const ms = Math.max(30000, _cfg("scanIntervalMs", 60000) | 0);
    log("monitor start · period=" + ms + "ms");
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
            this.store.accounts[_predictiveCandidate].email.substring(0, 20),
        );
    }
    if (effQuota >= predictiveThreshold) _predictiveCandidate = -1;

    // ── 耗尽保护: 额度极低时强制切号 ──
    const isExhausted = effQuota < threshold;
    const switchCooldown = Date.now() - _lastSwitchTime < switchCooldownMs;
    if (isExhausted && !_switching && !switchCooldown && !acc.skipAutoSwitch) {
      // 重置等待: Daily/Weekly 即将重置 → 不切号
      if (q.daily < threshold && hrsToDaily <= waitResetHours) {
        log(
          "⏳ Daily耗尽(" +
            q.daily +
            "%) 但" +
            hrsToDaily.toFixed(1) +
            "h后重置 → 等待",
        );
        return;
      }
      if (
        !drought &&
        q.daily >= threshold &&
        q.weekly < threshold &&
        hrsToWeekly <= waitResetHours
      ) {
        log(
          "⏳ Weekly耗尽(" +
            q.weekly +
            "%) 但" +
            hrsToWeekly.toFixed(1) +
            "h后重置 → 等待",
        );
        return;
      }
      const reason = drought
        ? "Daily耗尽(" + q.daily + "%)"
        : q.weekly < threshold
          ? "Weekly耗尽(" + q.weekly + "%)"
          : "Daily耗尽(" + q.daily + "%)";
      // v17.42.7 锁🔒贯通: 统一由 _isValidAutoTarget 四辨
      let bestI = _isValidAutoTarget(_predictiveCandidate)
        ? _predictiveCandidate
        : this.store.getBestIndex(activeI);
      if (bestI >= 0) {
        log(
          "⚡ 耗尽保护: " +
            reason +
            " → " +
            this.store.accounts[bestI].email.substring(0, 20),
        );
        await this._doAutoSwitch(bestI, activeI, "exhaust");
      } else {
        log("耗尽保护: " + reason + ", 无可用账号");
        _notify("warn", "WAM: " + reason + "，无空闲账号");
      }
    } else if (!isExhausted) {
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
      for (let _retry = 0; _retry < 3 && !switchOk; _retry++) {
        if (_retry > 0) {
          bestI = this.store.getBestIndex(excludeI);
          if (bestI < 0) break;
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
        _broadcastUI();
        try {
          const r = await loginAccount(_store, pick.idx);
          if (r.ok) _notify("info", "WAM: ✓ " + _store.activeEmail);
          else _notify("error", "WAM: ✗ " + r.stage + ": " + r.error);
        } finally {
          _engine.rotating = false;
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
        if (_wamMode === "wam") {
          _notify("info", "WAM: 已是 WAM 模式");
          return;
        }
        _wamMode = "wam";
        if (_engine) _engine.startMonitor();
        if (context.globalState) context.globalState.update("wam.mode", "wam");
        _notify("info", "WAM: 切 WAM 切号模式 · 引擎启");
        _broadcastUI();
      },
    ],
    [
      "wam.setModeOfficial",
      async () => {
        if (_wamMode === "official") {
          _notify("info", "WAM: 已是官方登录模式");
          return;
        }
        _wamMode = "official";
        if (_engine) _engine.stopMonitor();
        if (context.globalState)
          context.globalState.update("wam.mode", "official");
        _notify("info", "WAM: 切官方登录模式 · 引擎停 · 用户可用官方登录");
        _broadcastUI();
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
      const tv = setTimeout(() => {
        if (_wamMode !== "wam") return;
        if (_verifyAllInProgress) return;
        log("auto-verify(stale): 启动 · 内化 refresh 按钮");
        verifyAllAccounts({ onlyStale: true }).catch((e) =>
          log("auto-verify err: " + (e.message || e)),
        );
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
        log("auto-verify(stale): 周期触发");
        verifyAllAccounts({ onlyStale: true }).catch((e) =>
          log("periodic-verify err: " + (e.message || e)),
        );
      }, periodicVerifyMs);
      context.subscriptions.push({ dispose: () => clearInterval(ti) });
    }

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
      " activated · 道法自然 · 太上下知有之 · settle 模型[pb·new+pb·settle+wal·settle] · 4s 防抖" +
      (_cfg("rotateOnEveryMessage", true) ? " [开]" : " [关]") +
      " · 使用中🔒 " +
      Math.round(_cfg("inUseLockMs", 120000) / 1000) +
      "s · 不禁号·永不入黑",
  );
}

function deactivate() {
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
    _isValidAutoTarget,
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
