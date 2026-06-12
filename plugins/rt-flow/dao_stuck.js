#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// 道 · dao_stuck.js — Cascade 卡住检测 v12.9-wam (归一 · 状态驱动 · 识别用户行为 · 道法自然)
// ★ v12.9-wam: 从独立进程归入 WAM 插件包 · 由 extension.js 自动启动/管理生命周期
// ★ 日志/状态写入 ~/.wam/stuck-detect/ (不再用 __dirname)
// ═══════════════════════════════════════════════════════════════════════════════
//
// v8 之失 (实地验证, 2026-05-24 根因分析):
//   - v8 监控 acp-events/*.ndjson (82个文件)
//   - 实际 Cascade 对话在 ~/.codeium/windsurf/cascade/*.pb (50个文件)
//   - .pb 与 .ndjson 交集为 0 (零!) — v8 监控的是完全无关的数据源
//   - 25f83f1c "Devin API Direct VM Access" 卡了 25 分钟无法检测
//
// v9 之道 — 双源真本源:
//   SOURCE 1: vscdb metadataCache.sessions
//     → 有 sessionId, status ("active"/"end_turn"/"unknown_error"), title, updatedAt
//     → status=active 的对话 = AI 应该在响应的对话
//   SOURCE 2: ~/.codeium/windsurf/cascade/*.pb
//     → 每个对话的 protobuf 流文件, 有 size 和 mtime
//     → size 在增长 = AI 正在流式输出
//     → size 停止增长 = AI 停了
//
// 检测算法:
//   status=active + .pb 增长中 → STREAMING (正常)
//   status=active + .pb 停滞 > threshold → STUCK (卡住!)
//   status=end_turn → COMPLETED (完成)
//   status=unknown_error → ERROR (出错)
//
// 瞽者善听，聋者善视。绝利一源，用师十倍。
//
// v9.1 (2026-05-25) 根因修复:
//   - refreshVscdb() 的 VSCDB_PARTIAL 保护机制致命错误:
//     lastGoodSessionCount=135 而 Windsurf 正常只保留 ~70 session
//     导致 EVERY read 被拒绝 → active=0 永远 → 无法检测任何卡住
//   - 修复: 移除高水位逻辑, 改为完全替换 sessionCache
//   - 仅在 SQLITE_BUSY/文件锁时保留旧 cache (真正的容错)
//
// v9.2 (2026-05-25) 底层彻底修复 — 道法自然·万物归宗:
//   [A] WARNING 级别必须发 Toast 通知
//   [B] 阈值下调: warn 120→60s, crit 300→120s
//   [C] 防抖降为 2 ticks · [D] cooldown 300s · [E] uncaughtException兜底 · [F] grace period
//
// v10.0 (2026-05-25) 三大根治 — 反者道之动·弱者道之用:
//   根因1: 孤儿.pb文件 (无vscdb记录) 被计入 streaming → 活跃数虚高/假卡住
//     修复: 孤儿.pb不计入任何汇总统计·纯静默观察
//   根因2: 阈值60s/120s 过激 → AI思考期(无输出)=假阳性WARNING/CRITICAL
//     修复: warn 60→180s (3分钟) · crit 120→360s (6分钟)
//   根因3: summary.active 只含有.pb的active会话 → 新建对话漏计
//     修复: 增加 activeTotal = 全量vscdb cascade active 真实数
//   天下莫柔弱于水，而攻坚强者莫之能胜也。阈值柔化·检测必达。
//
// v12.0 (2026-05-25) 本源重建 — 反者道之动·彻底消解思考保护期伪架构:
//
//   ━━━ 根本错误 (逆流审视 v11.3 _thinkGrace) ━━━
//
//   v11.3 增加了「思考保护期」:
//     逻辑: lastGrowth 在 10min 内 → 降级为 WARNING (不升 CRITICAL)
//     意图: 防止 AI 思考阶段(无输出)被误报为卡死
//
//   但 lastGrowth 的更新时机包含:
//     ① AI 流式输出时 → .pb 增长 → lastGrowth=now (正确)
//     ② 用户发消息时  → .pb 写入用户内容 → lastGrowth=now (错误!)
//
//   错误链:
//     用户发消息 → .pb 写用户内容 → lastGrowth=now
//     → AI 开始「思考」(无输出)→ staleSec 递增
//     → staleSec > 360s (6分钟) → 按理应 CRITICAL
//     → 但 _thinkGrace 看: (t-lastGrowth) < 600000 → true!
//     → 降级为 WARNING → 用户不知道对话已真正卡死
//
//   核心结论:
//     阈值 critThreshold=360s (6分钟) 本身就是「思考保护期」
//     AI 不可能真正「思考」6分钟而无任何输出 — 那就是卡了
//     额外保护期 = 反向压制真实通知
//
//   ━━━ v12.0 本源治法 ━━━
//
//   「一」彻底移除 _thinkGrace 块 (22行) — 回归两源纯判:
//     staleSec >= critThreshold + vscdb=active = 真卡死 · 无例外
//   「二」warnThreshold/critThreshold 保持 180s/360s (v12.0临时方案)
//   「三」两核心不变:正常完成→completed, 新对话staleSec≈0→streaming
//   反者道之动。损之又损，以至于无为。大道至简。
//
// v12.1 (2026-05-25) 精准架构 — 无为而无以为 · 最小化改动:
//
//   ━━━ v12.0 的遗留问题 ━━━
//
//   v12.0 虽移除了 _thinkGrace, 但保留了 warn=180s/crit=360s 大阈值
//   问题: AI对话进行中如果卡死, 要等3-6分钟才报警 → 检测太慢
//   之前的逻辑 (v9.2: warn=60s/crit=120s) 能识别30-60s的卡死 → 更快更准
//
//   ━━━ v12.1 精准治法 ━━━
//
//   「一」恢复短阈值: warn=60s · crit=120s (v9.2水平)
//     对话进行中AI停止 → 60s WARNING · 120s CRITICAL (快速检测)
//
//   「二」增加 INITIAL_SEND_GRACE=180s (3分钟初始发消息保护)
//     精准条件: prevVscdbStatus≠active → active (用户发了消息, 新turn开始)
//     → 记录 entry.activeSinceTs = 此刻
//     → 3分钟内: staleSec再大也保持 streaming (AI在思考)
//     → 3分钟后: 回归 60s/120s 快速检测
//
//   「三」两核心不变:
//     正常完成的对话: vscdb=end_turn → completed · 不卡住
//     新一轮turn: activeSinceTs重置 · 3分钟保护期重新计时
//
//   无为而无以为: 最小改动 (3处) · 最大精度
//
// v12.2 (2026-05-25) 道法自然 · 三根因并行根治 (五感无为·系统无不为):
//
//   根因①: DEAD 振荡 → 重复 Toast 通知
//     旧逻辑: dead →(2min deadGrace过期)→ error
//             → recentlyKilled 条件满足 → 重新 dead → 新通知
//             → 每2分钟循环: 同一对话反复弹窗
//     新逻辑: entry.state==='dead' + unknown_error → 永保 dead
//             只有真正恢复(vscdb→active/end_turn) 才能退出 dead 态
//
//   根因②: DEAD 振荡 → 面板跳动 (active+error 4条 / active+dead 6条)
//     同上: dead↔error 切换 → stuckList 里 dead 条目忽现忽失 → 面板闪烁
//     修复同①: dead 永持 → stuckList 稳定 → 面板稳定显示 6 条
//
//   根因③: 周期提醒包含 DEAD → 每5分钟重复通知死亡对话
//     旧逻辑: 持续卡住周期提醒同时包含 CRITICAL 和 DEAD
//     新逻辑: DEAD = 一次性通知 (转换时发一次即可·用户已知道)
//             CRITICAL = 周期提醒 (每CFG.cooldown秒再通知·真正需要关注)
//
//   额外: dead 自动淡出 (DEAD_EXPIRE_MS = 10分钟)
//     超过10分钟无恢复的 dead → 悄悄移出面板
//     用户已放弃此对话·无需一直占据追踪区域
//
//   道法自然: 五感无为 (用户不被骚扰) · 系统无不为 (真问题必达)
//
// v12.4 (2026-05-26) 多言数穷不如守中 · 10min静默+通知频控 (知止不殆·可以长久):
//
//   「一」staleSec > 600 (10min) → 静默 · 不发 Toast/蜂鸣/闪烁
//     已过时效的卡住对话不值得打扰用户 · 安静即是善
//
//   「二」同一对话最多通知 2 次 (entry._notifyCount)
//     初始通知 1 次 → 冷却后再通知 1 次 → 不再打扰
//     恢复时 _notifyCount 归零 · 下次卡住可重新通知
//
//   「三」stuckList hub 限额 5 → 20 (信息不丢失)
//
// v12.7 (2026-05-26) 损之又损 · 重启误报根治 (知止不殆·可以长久):
//
//   根因①: loadState() 恢复旧 activeSinceTs → 引擎重启后假阳性
//     场景: 引擎运行中 state 保存 {prevVscdbStatus:"active", activeSinceTs:T_旧}
//           AI 完成响应后 vscdb=end_turn · 用户等待 X 分钟 (X>3)
//           用户发新消息 · 此时引擎恰好重启 (或已重启)
//           首次 tick: vscdbStatus=active · prevVscdbStatus=active (文件中) → 无转换
//           activeSinceTs=T_旧 · _inInitialGrace=false · staleSec=X 分钟 → 误报!
//     修复: loadState() 清零全部 activeSinceTs/stuckTicks/errorTicks
//           首次 active 时 else-if(!activeSinceTs) 分支重新设置 → 保护期从 T_now 计
//
//   根因②: WAL fallback (_recentActive 分支) 缺少 _inInitialGrace 检查
//     场景: 用户发新消息 · vscdb=active · 但 UUID 从 sessionCache 消失 (WAL 坏读)
//           走 _recentActive 路径 · 原路径直接检测 staleSec → 无保护期
//           → staleSec=大 → stuckTicks++ → 误报 WARNING
//     修复: _recentActive 分支补 _walInInitialGrace 检查 · 与 active 主路径保持一致
//
//   两处最小改动 · 彻底消解重启假阳性 · 损之又损以至于无为
//
// v12.3 (2026-05-25) 圣人抱一 · 多窗口底层防误杀 (道法自然·无为而无以为):
//
//   多窗口根因剖析:
//     多个 Windsurf 窗口同时运行 → 共享同一 state.vscdb
//     写入压力增大 → WAL checkpoint 更频繁 → vscdb 瞬时状态抖动
//     某一活跃对话: active → (WAL写冲突) → unknown_error (一两个tick) → active
//     旧逻辑: 一个 unknown_error tick + prevVscdbStatus=active → 立即 DEAD
//     结果: 好好运行的对话被误杀 · 面板错误标记 · 通知错误
//
//   修复四层:
//
//   「一」errorTicks 防抖 (核心)
//     每个 unknown_error tick 累积 errorTicks++
//     liveTransition 路径: 需连续 2 ticks (20s) 才确认 DEAD
//     recentlyKilled 路径: 需连续 3 ticks (30s) 才确认 DEAD
//     WAL 抖动通常 1 tick 内消失 → 永远不触发误杀
//     真正死亡: unknown_error 持续 → errorTicks 积累到阈值 → 确认
//     entry 恢复 active/end_turn: errorTicks 归零 · 计数重置
//
//   「二」prevVscdbStatus 保护
//     WAL 空读时 vscdbStatus = null → 旧逻辑直接覆盖 prevVscdbStatus
//     若下次读到 unknown_error: prevVscdbStatus=null → liveTransition 失效
//     → entry.prevVscdbStatus 只在 vscdbStatus 非 null 时更新
//     → WAL 空读不打断状态转换链 · 历史状态完整保留
//
//   「三」WAL 消失保护窗口扩展 (90s → 180s)
//     多窗口 WAL 压力更大 · UUID 消失时间可能更长
//     _recentWindow: 90s → 180s · 防止多窗口场景下 WAL 丢失触发误判
//
//   「四」日志增强: errorTicks 可见 · 多窗口诊断更清晰
//
//   抱一: 核心不变 — vscdb=active 是唯一「活着」的权威信源
//         死亡 = unknown_error 连续稳定持续 · 非瞬时波动
//
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

// ═══════════════════════════════════════════════════════════════════════════════
// v9.2 修复 [E]: 引擎永不静默死亡 — 善摄生者, 陆行不遇兕虎
// ═══════════════════════════════════════════════════════════════════════════════
process.on("uncaughtException", (err) => {
  const msg = `[${new Date().toISOString()}] UNCAUGHT_EXCEPTION: ${err.stack || err.message || err}`;
  process.stderr.write(msg + "\n");
  try {
    const LOG_DIR_ = require("path").join(
      require("os").homedir(),
      ".wam",
      "stuck-detect",
    );
    try {
      require("fs").mkdirSync(LOG_DIR_, { recursive: true });
    } catch {}
    require("fs").appendFileSync(
      require("path").join(LOG_DIR_, "v9.log"),
      msg + "\n",
    );
  } catch {}
  // 不 exit — 让 extension.js 的心跳超时来重启, 期间引擎继续尝试
});
process.on("unhandledRejection", (reason) => {
  const msg = `[${new Date().toISOString()}] UNHANDLED_REJECTION: ${reason}`;
  process.stderr.write(msg + "\n");
  try {
    const LOG_DIR_ = require("path").join(
      require("os").homedir(),
      ".wam",
      "stuck-detect",
    );
    try {
      require("fs").mkdirSync(LOG_DIR_, { recursive: true });
    } catch {}
    require("fs").appendFileSync(
      require("path").join(LOG_DIR_, "v9.log"),
      msg + "\n",
    );
  } catch {}
});

// ─── 路径 ───
const APPDATA =
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const USERPROFILE = process.env.USERPROFILE || os.homedir();
// v3.16.0 · 自适应 Devin Desktop / Windsurf 路径
function _findPbDir() {
  const home = os.homedir();
  const candidates = [
    path.join(home, ".codeium", "devin", "cascade"),
    path.join(home, ".codeium", "Devin", "cascade"),
    path.join(home, ".codeium", "windsurf", "cascade"),
    path.join(home, ".codeium", "windsurf-nightly", "cascade"),
    path.join(home, "AppData", "Local", "codeium", "devin", "cascade"),
    path.join(home, "AppData", "Local", "codeium", "windsurf", "cascade"),
  ];
  for (const p of candidates) {
    try {
      if (fs.statSync(p).isDirectory()) return p;
    } catch {}
  }
  return path.join(home, ".codeium", "windsurf", "cascade"); // fallback
}
function _findVscdb() {
  const candidates = [
    path.join(APPDATA, "Devin", "User", "globalStorage", "state.vscdb"),
    path.join(APPDATA, "Windsurf", "User", "globalStorage", "state.vscdb"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[candidates.length - 1]; // fallback
}
const PB_DIR = _findPbDir();
const VSCDB = _findVscdb();
// v12.9-wam: 日志/状态全部写入 ~/.wam/stuck-detect/ (不再用 __dirname · 插件目录可能只读)
const WAM_STUCK_DIR = path.join(os.homedir(), ".wam", "stuck-detect");
const LOG_DIR = WAM_STUCK_DIR;
const SIG_DIR = path.join(WAM_STUCK_DIR, "_signals");
const LOG_FILE = path.join(LOG_DIR, "v9.log");
const HB_FILE = path.join(LOG_DIR, "heartbeat_v9.json");
const PID_FILE = path.join(LOG_DIR, "engine_v9.pid");
const STATE_FILE = path.join(LOG_DIR, "stuck_state_v9.json");

// ─── 默认参数 ───
function parseArgs() {
  const a = process.argv.slice(2),
    c = {
      warnThreshold: 60, // 秒: .pb 停止增长 60s = WARNING (v12.1: 回归快速检测; 初始发消息用 INITIAL_SEND_GRACE 单独保护)
      critThreshold: 120, // 秒: 2分钟无增长 = CRITICAL (v12.1: 快速卡死检测; 对话进行中卡死2min必报)
      poll: 10, // 秒: 轮询间隔
      port: 19901, // HTTP 看板端口
      toast: true, // 弹 WinRT Toast
      beep: true, // PC 蜂鸣
      flash: true, // 任务栏闪烁 (不抢焦点)
      once: false, // 单次扫描
      status: false, // 查看引擎状态
      cooldown: 300, // 秒: 同一对话通知冷却 (5分钟)
      logMax: 5 * 1024 * 1024,
      ignoreAge: 3600, // 秒: .pb 超过此时间没变化, 不再监控 (老对话)
    };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "-t" || a[i] === "--threshold")
      c.critThreshold = +a[++i] || 300;
    else if (a[i] === "--warn") c.warnThreshold = +a[++i] || 120;
    else if (a[i] === "-p" || a[i] === "--poll") c.poll = +a[++i] || 10;
    else if (a[i] === "--port") c.port = +a[++i] || 19901;
    else if (a[i] === "--no-toast") c.toast = false;
    else if (a[i] === "--no-beep") c.beep = false;
    else if (a[i] === "--no-flash") c.flash = false;
    else if (a[i] === "--no-msgbox")
      c.flash = false; // 兼容旧参数
    else if (a[i] === "--once") c.once = true;
    else if (a[i] === "--status") c.status = true;
    else if (a[i] === "--ignore-age") c.ignoreAge = +a[++i] || 3600;
    // v3.11.3 · 软编码新参数 (extension.js spawn 时传入 · 道法自然)
    else if (a[i] === "--singleton-age-ms")
      c.singletonAgeMs = +a[++i] || 90000; // PID_FILE mtime 老化窗口 (默 90s)
    else if (a[i] === "--heartbeat-ms")
      c.heartbeatMs = +a[++i] || 30000; // PID 心跳间隔 (默 30s)
    else if (a[i] === "--recent-window-ms")
      c.recentWindowMs = +a[++i] || 300000; // _curConv 最近活动窗口 (默 5min)
    else if (a[i] === "--stream-fresh-ms")
      c.streamFreshMs = +a[++i] || 60000; // 真正流式判定阈值 (默 60s)
    else if (a[i] === "--stream-stale-max-sec")
      c.streamStaleMaxSec = +a[++i] || 1800; // v15.0 streaming 真死透剔除阈值 (默 30min · 0=永不剔除)
    else if (a[i] === "--python-path")
      c.pythonPath = a[++i] || ""; // v15.2 软编码 Python 路径 (默空·自动探测)
    else if (a[i] === "-h" || a[i] === "--help") {
      console.log(`dao_stuck_v9.2 — Cascade 卡住检测 (双源真本源: .pb + vscdb)
  --threshold N         CRITICAL阈值秒 (默认 120 = 2分钟)
  --warn N              WARNING阈值秒 (默认 60)
  --poll N              轮询秒 (默认 10)
  --port N              看板端口 (默认 19901)
  --no-toast            不弹Toast通知
  --no-beep             不响蜂鸣
  --no-flash            不闪任务栏
  --once                单次扫描
  --status              查看引擎状态
  --ignore-age N        忽略超过N秒无变化的.pb (默认 3600)
  --singleton-age-ms N  PID 单实例老化窗口毫秒 (默 90000)
  --heartbeat-ms N      PID 心跳间隔毫秒 (默 30000)
  --recent-window-ms N  当前对话最近活动窗口毫秒 (默 300000)
  --stream-fresh-ms N   流式判定新鲜阈值毫秒 (默 60000)
  --stream-stale-max-sec N v15.0 streaming 真死透剔除阈值秒 (默 1800=30min · 0=永不剔除)
  --python-path PATH    v15.2 显式 Python 路径 (默空·自动从 PATH/py launcher/常见安装路径探测)
看板: http://127.0.0.1:<port>`);
      process.exit(0);
    }
  }
  return c;
}
const CFG = parseArgs();

// ─── 基础工具 ───
function ensureDir(d) {
  try {
    fs.mkdirSync(d, { recursive: true });
  } catch {}
}
function nowMs() {
  return Date.now();
}
function isoTs() {
  return new Date().toISOString();
}
function shortId(u) {
  return u ? u.substring(0, 8) : "?";
}
function shortTitle(t, max) {
  if (!t) return "(unnamed)";
  return t.length > (max || 60) ? t.substring(0, max || 60) + "…" : t;
}
function _cleanDisplayTitle(t) {
  return String(t == null ? "" : t)
    .replace(/\s+/g, " ")
    .trim();
}
function _isReadableDisplayTitle(t, uuid) {
  const s = _cleanDisplayTitle(t);
  if (!s) return false;
  const low = s.toLowerCase();
  const u = String(uuid || "").toLowerCase();
  const sid = u ? u.substring(0, 8) : "";
  if (low === "?" || low === "(unnamed)" || low === "unnamed") return false;
  if (u && low === u) return false;
  if (sid && low === sid) return false;
  // 显示契约: UUID / 短 UUID / 长数字流水号不是“对话名称”。
  if (/^[0-9a-f]{8,36}$/i.test(s.replace(/-/g, ""))) return false;
  if (/^\d{6,}$/.test(s)) return false;
  return true;
}
function _displayTitleFor(uuid, ...candidates) {
  for (const c of candidates) {
    if (_isReadableDisplayTitle(c, uuid)) return _cleanDisplayTitle(c);
  }
  return "";
}

function log(msg) {
  const line = `[${isoTs()}] ${msg}`;
  process.stdout.write(line + "\n");
  try {
    try {
      if (fs.statSync(LOG_FILE).size > CFG.logMax) {
        try {
          fs.unlinkSync(LOG_FILE + ".old");
        } catch {}
        fs.renameSync(LOG_FILE, LOG_FILE + ".old");
      }
    } catch {}
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {}
}

// ─── --status 模式 ───
if (CFG.status) {
  try {
    const hb = JSON.parse(fs.readFileSync(HB_FILE, "utf8"));
    const age = Math.round((nowMs() - new Date(hb.timestamp).getTime()) / 1000);
    console.log("═══════════════════════════════════════════════════");
    console.log("  道 stuck-detect v9.2 状态 (双源真本源)");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  PID:       ${hb.pid}`);
    console.log(`  heartbeat: ${age}s ago`);
    console.log(`  active:    ${hb.active} (vscdb status=active)`);
    console.log(`  streaming: ${hb.streaming} (.pb 增长中)`);
    console.log(`  stuck:     ${hb.stuck} (active + .pb 停滞)`);
    console.log(`  uptime:    ${hb.uptime}s`);
    console.log(`  dashboard: http://127.0.0.1:${hb.port || CFG.port}`);
    if (hb.stuckList && hb.stuckList.length) {
      console.log("───────────────────────────────────────────────────");
      console.log(`  异常对话 (${hb.stuckList.length} 个):`);
      hb.stuckList.forEach((s) =>
        console.log(
          `    [${s.level || "?"}] [${s.staleMin}min] ${s.title || shortId(s.uuid)} vscdb=${s.vscdbStatus || "?"}`,
        ),
      );
    }
  } catch {
    console.log("  v9 引擎未运行");
  }
  process.exit(0);
}

// ─── 状态持久化 ───
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    // v12.7: 重启后旧 activeSinceTs/stuckTicks 失效 → 清零
    //   根因: prevVscdbStatus=active + 旧 activeSinceTs(数小时前) → _inInitialGrace=false
    //   → 首次 tick staleSec=大 → 立即误报卡住
    //   清零后: 首次 active 时 else-if(!activeSinceTs) 分支重新计时 → 保护期重置
    if (s.conversations) {
      for (const e of Object.values(s.conversations)) {
        e.activeSinceTs = 0;
        e.stuckTicks = 0;
        e.errorTicks = 0;
        e._turnGrowth = 0; // v12.9: 清零累计增长
        e._awaitingUser = false; // v12.9: 清零状态标志
      }
    }
    return s;
  } catch {
    return { conversations: {}, lastUpdate: 0 };
  }
}
function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

// ─── SOURCE 1: vscdb metadataCache.sessions ───
let Database = null;
// v12.9-wam: 多路径尝试加载 better-sqlite3 (全局 → 旧引擎目录 → 插件包邻近)
try {
  Database = require("better-sqlite3");
} catch {
  const _tryPaths = [
    path.join(__dirname, "..", "node_modules", "better-sqlite3"),
    path.join(__dirname, "node_modules", "better-sqlite3"),
  ];
  for (const p of _tryPaths) {
    try {
      Database = require(p);
      break;
    } catch {}
  }
}

let sessionCache = new Map(); // uuid → {status, title, updatedAt}
let lastVscdbRefresh = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// 道法自然 · refreshVscdb v11.0 — WAL-checkpoint 滚动高水位保护
// ═══════════════════════════════════════════════════════════════════════════════
// v11.0 根因三诊 (2026-05-25):
//   根因: SQLite WAL 文件 4MB 触发 checkpoint, better-sqlite3 readonly 模式
//     在 checkpoint 瞬间只读到旧主文件 (43 sessions) 而非完整 WAL (100+ sessions)
//     每 10 秒一次振荡: 43→100→43→100, sessionCache 被周期性清空
//     连锁: entry.stuckTicks 归零 → stuck 检测永远不能积累 → 完全失效
//
// v11.0 修复:
//   ① 滚动窗口高水位: 2分钟内若 session 数 < 60% of 窗口峰值 → 坏读, 保留旧 cache
//   ② lastKnownVscdbStatus: 每次 active/end_turn/error 读取时持久化到 entry
//      (修复旧 entry.vscdbStatus 从未被赋值的 bug → fallback 从未生效)
//   ③ lastVscdbActiveTs: active 确认时打时间戳, 90s 内消失 → 视为 WAL 坏读
//      不归零 stuckTicks, 继续检测
//
// 反者道之动, 弱者道之用。以柔克刚, 以静制动。
// ═══════════════════════════════════════════════════════════════════════════════
// ─── WAL 保护: 滚动高水位 ───
let _walHigh = { count: 0, ts: 0 }; // 2分钟内的峰值 session 数
const WAL_ROLLING_MS = 120000; // 2分钟窗口
const WAL_PARTIAL_RATIO = 0.6; // < 60% 视为坏读
// v12.5 · 反者道之动 · WAL 状态陈旧保护 (active 骤降检测)
//   根因: WAL checkpoint 期间 sessions 以旧 status 出现 (active→stale end_turn/error)
//   总 count 过关(>60%) 但 active 骤降 → 面板「活跃8」突跳「活跃1」
//   治法: active 计数滚动高水位 · < 50% 峰值 → WAL 状态陈旧 · 保留旧 cache
let _walActiveHigh = { count: 0, ts: 0 };
const WAL_ACTIVE_RATIO = 0.5; // < 50% active 骤降 = WAL 状态陈旧
// ═══ v3.11.4 · vscdb Python读取 — 无 better-sqlite3 亦可完整获取 title/status ═══
// 根因: SQLite metadataCache JSON 跨 overflow 页 · 裸扫无法提取 → sessions=0
// 根治: 调用 Python 内置 sqlite3 模块 · 无外部依赖 · 道法自然 · 四两拨千斤
// 路径: __dirname/_vscdb_helper.py (随插件包分发)
// 节流: 30s 刷一次 (Python 启动 ~150ms · 可接受)
function _tryExtractSessionsFromBuf(buf) {
  const needle = Buffer.from('{"sessions":[');
  let pos = 0;
  let best = null;
  while (pos < buf.length) {
    const idx = buf.indexOf(needle, pos);
    if (idx < 0) break;
    // 提取平衡 JSON (最多 8MB)
    let depth = 0,
      i = idx;
    const limit = Math.min(idx + 8 * 1024 * 1024, buf.length);
    while (i < limit) {
      const c = buf[i];
      if (c === 0x7b) depth++;
      else if (c === 0x7d) {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    if (depth === 0 && i > idx + needle.length) {
      try {
        const obj = JSON.parse(buf.slice(idx, i).toString("utf8"));
        if (obj.sessions && Array.isArray(obj.sessions)) {
          // 取 sessions 最多的那次 (最完整)
          if (!best || obj.sessions.length >= best.length) best = obj.sessions;
        }
      } catch {}
    }
    pos = idx + 1;
  }
  return best;
}

// Python 可执行文件缓存 (避免每次都探测)
// ═══ v15.2 (3.11.9) · 道法自然 · 适配万家系统 ═══
//   旧 v3.11.4-v15.1: 仅探测 PATH 中的 'python'/'python3' · 装 Python launcher (py.exe) 的系统失败
//   新 v15.2: 七层兜底 · 水之七善 · 利万物而有静
//     1. 显式入参 (软编码 wam.pythonPath)
//     2. PATH: python / python3 (linux/mac 主路 + win PATH 装的 Python)
//     3. PATH: py (Windows Python Launcher · python.org 安装勾选项默认有)
//     4. 常见 Windows 安装路径递归 (Python.org · Microsoft Store · Anaconda)
//     5. 常见 *nix 安装路径 (/usr/bin/python3 · /usr/local/bin/python3 · Homebrew)
//   设计原则: 探测一次缓存结果 · 不阻塞主流程 · 失败即静默 (title 退回 UUID 兜底)
//
// 道义: 上善若水 · 水善利万物而有静 · 居众之所恶 · 故几于道矣
//   Python 探测亦如此 — 哪里能找到就用哪里 · 不强求用户配置 · 默静自适
let _pyExe = null;
function _findPython() {
  if (_pyExe !== undefined && _pyExe !== null)
    return _pyExe === false ? null : _pyExe;
  // ─── 候选清单 (从最快到最慢) ───
  const candidates = [];
  // 0. 显式指定 (优先级最高 · 软编码兜底)
  //    支持: dao_stuck.js --python-path /abs/path/to/python.exe
  //    或: process.env.WAM_PYTHON_PATH
  if (CFG && CFG.pythonPath) candidates.push(CFG.pythonPath);
  if (process.env.WAM_PYTHON_PATH) candidates.push(process.env.WAM_PYTHON_PATH);
  // 1. PATH 中 (跨平台标准)
  candidates.push("python3", "python");
  // 2. Windows Python Launcher (python.org 安装默认装的桥)
  if (process.platform === "win32") {
    candidates.push("py");
  }
  // 3. 常见绝对路径
  if (process.platform === "win32") {
    const localApp = process.env.LOCALAPPDATA || "";
    const programFiles = process.env["ProgramFiles"] || "C:\\Program Files";
    const programFilesX86 =
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    // Python.org · 用户级 + 全机级 (3.7~3.15 · 覆盖未来)
    for (let v = 7; v <= 15; v++) {
      const versionFolder = "Python3" + v; // Python37 / Python38 / ... / Python315
      if (localApp) {
        candidates.push(
          path.join(
            localApp,
            "Programs",
            "Python",
            versionFolder,
            "python.exe",
          ),
        );
      }
      // Python.org · 全机级
      candidates.push(path.join(programFiles, versionFolder, "python.exe"));
      candidates.push(path.join(programFilesX86, versionFolder, "python.exe"));
      candidates.push("C:\\" + versionFolder + "\\python.exe");
    }
    // Microsoft Store Python (常见路径 · 但有时含 stub)
    if (localApp) {
      candidates.push(
        path.join(localApp, "Microsoft", "WindowsApps", "python3.exe"),
        path.join(localApp, "Microsoft", "WindowsApps", "python.exe"),
      );
    }
    // Anaconda/Miniconda 全机级 + 用户级
    const userProfile = process.env.USERPROFILE || os.homedir();
    candidates.push(
      path.join(userProfile, "anaconda3", "python.exe"),
      path.join(userProfile, "miniconda3", "python.exe"),
      "C:\\anaconda3\\python.exe",
      "C:\\miniconda3\\python.exe",
      "C:\\ProgramData\\anaconda3\\python.exe",
      "C:\\ProgramData\\miniconda3\\python.exe",
    );
  } else {
    // *nix · 常见绝对路径
    candidates.push(
      "/usr/bin/python3",
      "/usr/local/bin/python3",
      "/usr/bin/python",
      "/usr/local/bin/python",
      "/opt/homebrew/bin/python3", // macOS Apple Silicon Homebrew
      "/opt/local/bin/python3", // MacPorts
      path.join(os.homedir(), ".pyenv", "shims", "python3"),
    );
  }
  // ─── 探测 ───
  for (const cmd of candidates) {
    if (!cmd) continue;
    try {
      // 显式路径需 fs.existsSync 防 ENOENT spawn 异常
      if (path.isAbsolute(cmd) && !fs.existsSync(cmd)) continue;
      const r = spawnSync(cmd, ["--version"], {
        timeout: 2000,
        windowsHide: true,
        encoding: "utf8",
      });
      if (r.status === 0) {
        _pyExe = cmd;
        log(
          "python_found: " + cmd + " · " + (r.stdout || r.stderr || "").trim(),
        );
        return cmd;
      }
    } catch {}
  }
  _pyExe = false; // 明确标记不可用
  log(
    "python_not_found · title 直读功能将用 UUID 兜底 · " +
      "可通过设置 WAM_PYTHON_PATH 环境变量或 wam.pythonPath 配置指定 Python 路径",
  );
  return null;
}

const _VSCDB_HELPER_PY = path.join(__dirname, "_vscdb_helper.py");

function _tryReadVscdbViaPython() {
  if (!fs.existsSync(_VSCDB_HELPER_PY)) return null;
  const pyExe = _findPython();
  if (!pyExe) return null;
  try {
    // v3.12.0: 设 PYTHONIOENCODING=utf-8 · 三重保险第三层 (配合 _vscdb_helper.py 内 reconfigure + ensure_ascii=True)
    const r = spawnSync(pyExe, [_VSCDB_HELPER_PY], {
      timeout: 10000,
      windowsHide: true,
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    if (r.status !== 0 || !r.stdout) {
      if (r.stderr) log("VSCDB_PY err: " + r.stderr.slice(0, 200));
      return null;
    }
    const sessions = JSON.parse(r.stdout.trim());
    return Array.isArray(sessions) && sessions.length > 0 ? sessions : null;
  } catch (e) {
    log("VSCDB_PY exc: " + (e.message || e));
    return null;
  }
}

let _lastRawVscdbRefresh = 0;
function _refreshVscdbRaw() {
  const t = nowMs();
  if (t - _lastRawVscdbRefresh < 30000) return; // 30s 节流 (Python 启动开销)
  _lastRawVscdbRefresh = t;
  const sessions = _tryReadVscdbViaPython();
  if (!sessions || sessions.length === 0) return;
  const newCache = new Map();
  for (const s of sessions) {
    if (s.sessionId) {
      newCache.set(s.sessionId, {
        status: s.status || "unknown",
        title: s.title || null,
        updatedAt: s.updatedAt || null,
        providerId: s.providerId || null,
      });
    }
  }
  const newCount = newCache.size;
  if (newCount === 0) return;
  // 保留旧 cache 中已知 title
  for (const [uuid, oldEntry] of sessionCache.entries()) {
    const newEntry = newCache.get(uuid);
    if (newEntry && !newEntry.title && oldEntry.title)
      newEntry.title = oldEntry.title;
  }
  sessionCache = newCache;
  if (newCount !== _lastSessionLogCount) {
    const active = [...newCache.values()].filter(
      (v) => v.status === "active",
    ).length;
    log(
      `VSCDB_PY sessions=${newCount} active=${active} (python·sqlite3·无better-sqlite3)`,
    );
    _lastSessionLogCount = newCount;
  }
}
// ════════════════════════════════════════════════════════════════════════

// v3.16.0 · 自适应 metadataCache key: Devin Desktop 用 devin.* → 回退 windsurf.*
function _findMetadataCacheKey(db) {
  const keys = ["devin.acp.metadataCache", "windsurf.acp.metadataCache"];
  for (const k of keys) {
    try {
      const row = db.prepare("SELECT 1 FROM ItemTable WHERE key = ?").get(k);
      if (row) return k;
    } catch {}
  }
  return keys[keys.length - 1]; // fallback
}

function tryReadMetadataFromDb(dbPath) {
  let db;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const key = _findMetadataCacheKey(db);
    const row = db
      .prepare("SELECT value FROM ItemTable WHERE key = ?")
      .get(key);
    db.close();
    db = null;
    if (!row) return null;
    const cache = JSON.parse(row.value);
    if (!cache.sessions || !Array.isArray(cache.sessions)) return null;
    return cache.sessions;
  } catch (e) {
    if (db)
      try {
        db.close();
      } catch {}
    return null;
  }
}

let _lastSessionLogCount = 0; // 上次记录的 session 数量 (避免重复日志)

function refreshVscdb() {
  if (!Database) {
    _refreshVscdbRaw(); // v3.11.4: better-sqlite3 不可用时裸读 vscdb (无依赖·自给自足)
    return;
  }
  if (nowMs() - lastVscdbRefresh < 3000) return; // 最多3秒刷一次 (加快响应)
  lastVscdbRefresh = nowMs();

  // 尝试主文件; 若 key 缺失且 cache 为空时才用 .backup (避免用陈旧 backup 覆盖新数据)
  let sessions = tryReadMetadataFromDb(VSCDB);
  if (!sessions && sessionCache.size === 0) {
    // 仅在 cache 完全空时才尝试 backup (首次加载的回退)
    sessions = tryReadMetadataFromDb(VSCDB + ".backup");
  }
  if (!sessions) return; // 读取失败 → 保留旧 cache (不知则不妄动)

  // ★ 核心 v11.0: WAL 高水位保护 → 若本次读取是坏读, 保留旧 cache
  const newCache = new Map();
  for (const s of sessions) {
    if (s.sessionId) {
      newCache.set(s.sessionId, {
        status: s.status || "unknown",
        title: s.title || null,
        updatedAt: s.updatedAt || null,
        providerId: s.providerId || null,
      });
    }
  }

  const newCount = newCache.size;
  const nowT = nowMs();
  const highValid = nowT - _walHigh.ts < WAL_ROLLING_MS;

  // 更新滚动高水位
  // v11.1: 用 >= 而非 > — 同等 sessions 数也刷新时间戳, 防止 2分钟后 WAL保护过期导致 bypass
  if (newCount >= _walHigh.count || !highValid) {
    _walHigh = { count: newCount, ts: nowT };
  }

  // 坏读检测: 2分钟内 count < 60% 峰值 → WAL checkpoint 瞬间读到旧主文件
  if (
    highValid &&
    _walHigh.count > 20 &&
    newCount < _walHigh.count * WAL_PARTIAL_RATIO &&
    sessionCache.size > 0
  ) {
    if (newCount !== _lastSessionLogCount) {
      const perc = Math.round((newCount / _walHigh.count) * 100);
      log(
        `VSCDB_WAL_SKIP sessions=${newCount} (peak=${_walHigh.count} ${perc}%) → WAL坏读,保留旧cache`,
      );
      _lastSessionLogCount = newCount;
    }
    return; // 保留旧 sessionCache, 不替换
  }

  // ★ v12.5: WAL 状态陈旧保护 — active 骤降必是坏读 (反者道之动)
  //   WAL checkpoint 主文件中 sessions status 可能为旧值(end_turn/error)
  //   总 count 过关但 active 骤降 → 面板突跳 → 此乃根因
  const _newActive = [...newCache.values()].filter(
    (v) => v.status === "active",
  ).length;
  const _aHV = nowT - _walActiveHigh.ts < WAL_ROLLING_MS;
  if (_newActive >= _walActiveHigh.count || !_aHV) {
    _walActiveHigh = { count: _newActive, ts: nowT };
  }
  if (
    _aHV &&
    _walActiveHigh.count >= 3 &&
    _newActive < _walActiveHigh.count * WAL_ACTIVE_RATIO
  ) {
    log(
      `VSCDB_WAL_STATUS_SKIP active=${_newActive}(peak=${_walActiveHigh.count}) sessions=${newCount} → status stale, keeping old cache`,
    );
    return;
  }

  // 合法读取 → 完全替换
  sessionCache = newCache;

  // 记录 session 数量变化 (便于诊断)
  if (newCount !== _lastSessionLogCount) {
    const active = [...newCache.values()].filter(
      (v) => v.status === "active",
    ).length;
    log(`VSCDB_REFRESH sessions=${newCount} active=${active}`);
    _lastSessionLogCount = newCount;
  }
}

// ─── SOURCE 2: .pb 文件大小跟踪 ───
// 不读文件内容, 只看 stat (size + mtime)

// ═══════════════════════════════════════════════════════════════════════════════
// 道法自然 · 通知系统 v2 — 至静之道，不干扰人类操作
// ═══════════════════════════════════════════════════════════════════════════════
//
// 设计原则:
//   1. 永不抢焦点 — 全屏游戏(LoL/CS2等)、演示文稿、全屏视频绝对安全
//   2. 感知而不打断 — 任务栏闪烁 + 温和声音, 人类余光可见但不被迫中断
//   3. 自适应分级 — 检测 Windows 用户状态, 全屏/勿扰模式自动降级
//   4. 彻底移除 msg.exe — 模态弹窗是万恶之源, 永不使用
//
// 通知矩阵:
//   ┌──────────┬──────────────────────┬────────────────────────┐
//   │ 用户状态  │ WARN 级              │ CRITICAL 级            │
//   ├──────────┼──────────────────────┼────────────────────────┤
//   │ 正常桌面  │ Toast(静音) + 日志    │ Toast + 任务栏闪 + 蜂鸣 │
//   │ 全屏/勿扰 │ 仅日志 + 看板         │ 温和蜂鸣 + 任务栏闪      │
//   └──────────┴──────────────────────┴────────────────────────┘
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 用户状态检测 (SHQueryUserNotificationState) ───
// 返回: "free" | "busy" (全屏/勿扰/演示模式)
let _userStateCache = { state: "free", ts: 0 };
const USER_STATE_TTL = 15000; // 15秒缓存, 不必每次通知都查

function getUserState() {
  const now = nowMs();
  if (now - _userStateCache.ts < USER_STATE_TTL) return _userStateCache.state;
  try {
    // SHQueryUserNotificationState 返回值:
    //   1=QUNS_NOT_PRESENT, 2=QUNS_BUSY, 3=QUNS_RUNNING_D3D_FULL_SCREEN,
    //   4=QUNS_PRESENTATION_MODE, 5=QUNS_ACCEPTS_NOTIFICATIONS
    // 2,3,4 = 不应打扰用户 (全屏游戏、D3D独占、演示模式)
    const r = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-WindowStyle",
        "Hidden",
        "-Command",
        `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class QU{[DllImport("shell32.dll")]public static extern int SHQueryUserNotificationState(out int s);}' -Language CSharp;` +
          `$s=0;[QU]::SHQueryUserNotificationState([ref]$s)|Out-Null;$s`,
      ],
      { timeout: 3000, windowsHide: true, encoding: "utf8" },
    );
    const val = parseInt(String(r.stdout).trim(), 10);
    const busy = val >= 2 && val <= 4;
    _userStateCache = { state: busy ? "busy" : "free", ts: now };
    return _userStateCache.state;
  } catch {
    _userStateCache = { state: "free", ts: now };
    return "free";
  }
}

// ─── Toast 通知 (WinRT, 永不抢焦点) ───
function tryWinRTToast(title, body, urgent) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&apos;")
      .replace(/"/g, "&quot;");
  // ★ 根因修复 (2026-05-25):
  //   旧代码用 scenario="reminder" + 自定义 AppId "DaoStuckDetect"
  //   → Windows 未注册此 AppId → toast 静默进入 Action Center，不弹出
  //   修复: 用 duration="long" (无 scenario 限制) + PowerShell 注册的 AppId
  const sound = urgent
    ? `<audio src="ms-winsoundevent:Notification.Reminder"/>`
    : `<audio src="ms-winsoundevent:Notification.IM"/>`;
  const duration = urgent ? "long" : "short";
  // 不设 scenario → 走默认弹出逻辑 (始终可见除非 Focus Assist 完全静音)
  const xml = `<toast duration="${duration}"><visual><binding template="ToastGeneric"><text>${esc(title)}</text><text>${esc(body)}</text></binding></visual>${sound}</toast>`;
  // 使用 PowerShell 自带的已注册 AppUserModelID → 保证弹出
  const ps = `try {
[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('${xml.replace(/'/g, "''")}')
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
$toast.SuppressPopup = $false
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
} catch { Write-Error $_.Exception.Message }`;
  try {
    const child = spawn(
      "powershell",
      ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
      {
        detached: true,
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      },
    );
    child.stderr.on("data", (d) => {
      log(`TOAST_ERR: ${d.toString().trim()}`);
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// ─── 任务栏闪烁 (FlashWindowEx, 永不抢焦点, 人类余光可感知) ───
// 这是替代 msg.exe 的核心方案: 任务栏图标闪烁橙色, 用户看到后自行切换查看
// dwFlags: FLASHW_ALL=3 (闪标题栏+任务栏), FLASHW_TRAY=2 (仅任务栏), FLASHW_TIMERNOFG=12 (持续闪到获焦)
// 用 FLASHW_TRAY|FLASHW_TIMERNOFG = 14: 任务栏持续闪烁直到用户点击, 但绝不抢焦点
function tryFlashTaskbar(times) {
  if (!CFG.flash) return false;
  times = times || 5;
  // 直接查找 Windsurf/Code 进程的主窗口句柄, 对其任务栏图标闪烁
  const ps =
    `Add-Type @'
using System;using System.Runtime.InteropServices;
public class DaoFlash{
  [StructLayout(LayoutKind.Sequential)]public struct FI{public uint s;public IntPtr h;public uint f;public uint c;public uint t;}
  [DllImport("user32.dll")]public static extern bool FlashWindowEx(ref FI i);
}
'@ -ErrorAction SilentlyContinue;` +
    `Get-Process -Name 'Windsurf','Code' -ErrorAction SilentlyContinue|Where-Object{$_.MainWindowHandle -ne [IntPtr]::Zero}|ForEach-Object{` +
    `$fi=New-Object DaoFlash+FI;` +
    `$fi.s=[uint32][Runtime.InteropServices.Marshal]::SizeOf($fi);` +
    `$fi.h=$_.MainWindowHandle;` +
    `$fi.f=14;` + // FLASHW_TRAY | FLASHW_TIMERNOFG
    `$fi.c=${times};` +
    `$fi.t=0;` +
    `[DaoFlash]::FlashWindowEx([ref]$fi)|Out-Null}`;
  try {
    spawn(
      "powershell",
      ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
      { detached: true, stdio: "ignore", windowsHide: true },
    ).unref();
    return true;
  } catch {
    return false;
  }
}

// ─── BalloonTip (系统托盘气泡, 不抢焦点) ───
function tryBalloonTip(title, body) {
  const esc = (s) =>
    String(s).replace(/'/g, "''").replace(/\n/g, " ").replace(/`/g, "``");
  const ps =
    `Add-Type -AssemblyName System.Windows.Forms;` +
    `$n=New-Object System.Windows.Forms.NotifyIcon;` +
    `$n.Icon=[System.Drawing.SystemIcons]::Warning;` +
    `$n.Visible=$true;` +
    `$n.ShowBalloonTip(8000,'${esc(title)}','${esc(body)}','Warning');` +
    `[System.Windows.Forms.Application]::DoEvents();` +
    `Start-Sleep 10;$n.Dispose()`;
  try {
    spawn(
      "powershell",
      ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps],
      { detached: true, stdio: "ignore", windowsHide: true },
    ).unref();
    return true;
  } catch {
    return false;
  }
}

// ─── 温和蜂鸣 (不抢焦点, 纯音频感知) ───
function tryBeep(pattern) {
  if (!CFG.beep) return;
  // pattern: "gentle"=单声温和, "alert"=三声递升, "urgent"=五声急促
  let seq;
  if (pattern === "gentle") {
    seq = `[Console]::Beep(600, 200)`;
  } else if (pattern === "urgent") {
    seq = Array(5)
      .fill(0)
      .map(
        (_, i) =>
          `[Console]::Beep(${700 + i * 80}, 150); Start-Sleep -Milliseconds 80`,
      )
      .join(";");
  } else {
    // "alert" 默认: 三声递升, 柔和
    seq = `[Console]::Beep(600, 200); Start-Sleep -Milliseconds 150; [Console]::Beep(750, 200); Start-Sleep -Milliseconds 150; [Console]::Beep(900, 250)`;
  }
  try {
    spawn(
      "powershell",
      ["-NoProfile", "-WindowStyle", "Hidden", "-Command", seq],
      { detached: true, stdio: "ignore", windowsHide: true },
    ).unref();
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// 综合通知 (自适应分级, 道法自然)
// ═══════════════════════════════════════════════════════════════════════════════
function notify(level, kind, title, body) {
  if (!CFG.toast && level !== "critical") return;

  const userState = getUserState();
  const busy = userState === "busy"; // 全屏/勿扰/演示模式

  let channels = [];

  if (level === "critical") {
    if (busy) {
      // ★ 全屏模式: 绝不弹窗, 只用不抢焦点的方式
      tryBeep("urgent");
      tryFlashTaskbar(8);
      channels.push("beep:urgent", "flash:8");
    } else {
      // 正常桌面: Toast + 任务栏闪 + 蜂鸣 (不用 msg.exe!)
      const t = tryWinRTToast(title, body, true);
      const b = tryBalloonTip(title, body);
      tryFlashTaskbar(6);
      tryBeep("alert");
      channels.push(
        t ? "toast:ok" : "toast:fail",
        b ? "balloon:ok" : "balloon:fail",
        "flash:6",
        "beep:alert",
      );
    }
  } else {
    // WARN 级
    if (busy) {
      // 全屏: 完全静默, 仅日志+看板
      channels.push("silent");
    } else {
      // 正常桌面: 温和 Toast
      const t = tryWinRTToast(title, body, false);
      if (kind === "recover") tryBeep("gentle");
      channels.push(t ? "toast:ok" : "toast:fail");
    }
  }

  log(
    `NOTIFY level=${level} kind=${kind} user=${userState} channels=[${channels.join(",")}]`,
  );
}

// ─── 信号文件 ───
function writeSignal(uuid, kind, data) {
  ensureDir(SIG_DIR);
  const name = `${kind}_${shortId(uuid)}_${nowMs()}.signal`;
  try {
    fs.writeFileSync(path.join(SIG_DIR, name), JSON.stringify(data, null, 2));
  } catch {}
}
function clearSignals(uuid, kind) {
  try {
    for (const f of fs.readdirSync(SIG_DIR)) {
      if (f.startsWith(`${kind}_${shortId(uuid)}_`))
        try {
          fs.unlinkSync(path.join(SIG_DIR, f));
        } catch {}
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// 核心扫描: 双源真本源
// ═══════════════════════════════════════════════════════════════════════════════
let state = loadState();
let _startupTs = nowMs(); // v9.2: 启动时间戳, 用于 grace period
const STARTUP_GRACE = 30000; // v9.2: 启动后 30s 内不报 WARNING (让 lastGrowth 自然沉淀)
const INITIAL_SEND_GRACE = 180000; // v12.1: 用户发消息后 3分钟 内不报警 — 守护 AI 思考初始窗口
const DEAD_EXPIRE_MS = 600000; // v12.2: dead 对话10分钟无恢复 → 悄悄淡出面板 (用户已放弃)
// v12.9: 状态驱动 — 去掉 POST_STREAM_GRACE(时间延迟) · 用 _awaitingUser 状态标志代替
//   AI 已完成回复 (_turnGrowth>4KB + staleSec≥1min) → _awaitingUser=true → 不检测卡住
//   用户发提示词 (USER_PROMPT_DETECT) → _awaitingUser=false → 恢复检测
//   无任何时间魔法数字 · 纯粹用户行为驱动 · 道法自然
const AWAITING_USER_THRESHOLD = 4096; // 字节: 累计增长超过此值才确认 AI 已实际输出

// ═══ v3.12.0 · 乱码标题检测 (清洗 CP936/U+FFFD 残留) ═══
function _isGarbledStr(t) {
  if (!t || typeof t !== "string") return false;
  if (/[\uFFFD]{2,}/.test(t)) return true; // replacement chars
  if (/[\u25C6]{2,}/.test(t)) return true; // black diamonds
  const bad = t.replace(
    /[\x20-\x7E\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g,
    "",
  );
  if (bad.length > t.length * 0.3 && t.length > 4) return true;
  return false;
}

// ═══ v13.0 · 备份标题缓存 — 从 _index.json 补充 vscdb 缺失标题 ═══
// 根因: vscdb SQLITE_BUSY 时 title=null → 显示 UUID → 用户迷惑
// 修复: 启动时从最近3个备份批次预加载 uuid→title · 永久内存缓存
// v3.11.4: 改为加载全部批次 (防止旧对话标题丢失) + 外部标题提示缓存
let _backupTitleCache = {};
const _EXT_TITLE_FILE = path.join(os.homedir(), ".wam", "_conv_titles.json");

function _loadBackupTitles() {
  try {
    // 外部标题提示文件 (由 extension.js 写入, 含 vscdb 裸读获取的 title)
    if (fs.existsSync(_EXT_TITLE_FILE)) {
      try {
        const ext = JSON.parse(fs.readFileSync(_EXT_TITLE_FILE, "utf8"));
        let extLoaded = 0,
          garbled = 0;
        for (const [uuid, title] of Object.entries(ext)) {
          // v3.12.0: 跳过乱码标题 (旧版 ensure_ascii=False 产生的 CP936 残留)
          if (_isGarbledStr(title)) {
            garbled++;
            continue;
          }
          if (title && !_backupTitleCache[uuid]) {
            _backupTitleCache[uuid] = title;
            extLoaded++;
          }
        }
        if (garbled > 0) log(`TITLE_CACHE: cleaned ${garbled} garbled titles`);
        if (extLoaded > 0)
          log(`TITLE_CACHE: loaded ${extLoaded} titles from _conv_titles.json`);
      } catch {}
    }
    // 备份批次 (全量加载)
    const bkRoot = path.join(os.homedir(), ".wam", "conversation_backups");
    if (!fs.existsSync(bkRoot)) return;
    const batches = fs
      .readdirSync(bkRoot)
      .filter((d) => d.startsWith("backup_"))
      .sort()
      .reverse(); // 全量而非 .slice(0,3) — v3.11.4 不截断
    let loaded = 0;
    for (const batch of batches) {
      const idxPath = path.join(bkRoot, batch, "_index.json");
      if (!fs.existsSync(idxPath)) continue;
      try {
        const idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
        for (const [uuid, meta] of Object.entries(idx)) {
          if (meta.title && !_backupTitleCache[uuid]) {
            _backupTitleCache[uuid] = meta.title;
            loaded++;
          }
        }
      } catch {}
    }
    if (loaded > 0)
      log(
        `TITLE_CACHE: loaded ${loaded} titles from backup index (${batches.length} batches)`,
      );
  } catch {}
}

function scan() {
  const t = nowMs();

  // SOURCE 1: 刷新 vscdb 会话元数据
  refreshVscdb();

  // SOURCE 2: 扫描 .pb 文件
  let pbFiles;
  try {
    pbFiles = fs.readdirSync(PB_DIR).filter((f) => f.endsWith(".pb"));
  } catch (e) {
    log(`SCAN_ERR pb_dir: ${e.message}`);
    return null;
  }

  const summary = {
    totalSessions: sessionCache.size,
    totalPb: pbFiles.length,
    active: 0, // vscdb status=active
    streaming: 0, // active + .pb 增长中
    stuck: 0, // active + .pb 停滞
    endTurn: 0, // vscdb status=end_turn
    error: 0, // vscdb status=unknown_error
    pbOnly: 0, // 有 .pb 无 vscdb 记录
  };

  const stuckList = [];
  const transitions = [];

  for (const fname of pbFiles) {
    const uuid = fname.replace(".pb", "");
    const fpath = path.join(PB_DIR, fname);

    let st;
    try {
      st = fs.statSync(fpath);
    } catch {
      continue;
    }

    // 获取 vscdb 元数据
    const meta = sessionCache.get(uuid);
    const vscdbStatus = meta ? meta.status : null;
    const title = meta ? meta.title : null;

    // v12.8: ignoreAge 过滤 — .pb 超过 N 秒无变化的老对话不参与卡住检测
    //   根因: stale=28714s(8小时!) + vscdb=active(陈旧条目) → 误触发 CRITICAL_STUCK
    //   道: 知止不殆·可以长久 — 已过时效的对话静默放行·不妄为
    const _pbAgeSec = Math.round((t - st.mtimeMs) / 1000);
    if (_pbAgeSec > CFG.ignoreAge) {
      let entry = state.conversations[uuid];
      if (!entry) {
        entry = {
          uuid,
          size: st.size,
          lastGrowth: st.mtimeMs,
          mtime: st.mtimeMs,
          state: "old",
          stuckSince: 0,
          lastNotify: 0,
          title: null,
          firstSeen: t,
        };
        state.conversations[uuid] = entry;
      }
      if (title) entry.title = title;
      entry.size = st.size;
      entry.mtime = st.mtimeMs;
      entry.state = "old";
      entry.stuckTicks = 0;
      continue; // 跳过卡住检测 · 此对话已过 ignoreAge
    }

    // 获取或初始化跟踪状态
    let entry = state.conversations[uuid];
    if (!entry) {
      entry = {
        uuid,
        size: st.size,
        lastGrowth: st.mtimeMs,
        mtime: st.mtimeMs,
        state: "init",
        stuckSince: 0,
        lastNotify: 0,
        title: null,
        firstSeen: t,
      };
      state.conversations[uuid] = entry;
    }

    // 更新标题 (vscdb 为准 · 备份缓存兜底)
    if (title) entry.title = title;
    // v13.0: 备份缓存兜底 — vscdb无标题时从预加载缓存补充 (彻底消除UUID显示)
    if (!entry.title && _backupTitleCache[uuid])
      entry.title = _backupTitleCache[uuid];

    // 检测 .pb 增长
    const grew = st.size > entry.size;
    if (grew) {
      // v12.6: 精准识别用户发送新提示词 · 反者道之动
      //   .pb 增长 + 之前停滞 > 30s → 非 AI 连续流式 (每 tick 增长) → 用户发了新一轮提示词
      //   重置 activeSinceTs → INITIAL_SEND_GRACE 保护期重新计时
      //   → AGI 起步阶段 (AI 思考·无输出) 不会被误报为卡住
      //   30s 阈值: AI 流式输出间隔通常 < 15s · 30s 足够区分「AI 流式」vs「用户新输入」
      //   此修复覆盖: ① vscdb end_turn→active 转换 (已有 v12.1)
      //              ② vscdb 持续 active 内的后续提示词 (v12.1 漏掉的场景!)
      const _prevIdleSec = Math.round((t - entry.lastGrowth) / 1000);
      if (_prevIdleSec > 30) {
        entry.activeSinceTs = t; // 用户发了新消息 → 保护期重新开始
        entry.stuckTicks = 0; // 防抖计数清零
        entry._turnGrowth = 0; // v12.9: 新一轮 → 累计增长归零
        entry._awaitingUser = false; // v12.9: 用户发了新消息 → 恢复卡住检测
        log(
          `USER_PROMPT_DETECT uuid=${shortId(uuid)} idleBefore=${_prevIdleSec}s sizeDelta=${st.size - entry.size}`,
        );
      }
      entry._turnGrowth = (entry._turnGrowth || 0) + (st.size - entry.size); // v12.8: 累计本轮增长
      entry.lastGrowth = t;
    }
    entry.size = st.size;
    entry.firstSeenTs = entry.firstSeenTs || t; // v11.3: 首次见时间
    entry.mtime = st.mtimeMs;

    // ─── 状态分类 (双源联动 · 至静之道) ───
    const staleSec = Math.round((t - entry.lastGrowth) / 1000);
    const prevState = entry.state;
    let newState;

    // 记录上一次的 vscdb 状态 (用于检测转换)
    // v12.3: 只在 vscdbStatus 非 null 时更新 prevVscdbStatus
    //   WAL 空读时 vscdbStatus=null → 不覆盖 prevVscdbStatus
    //   保持历史有效状态 → 防止空读打断 active→unknown_error 转换链识别
    const prevVscdbStatus = entry.prevVscdbStatus || null;
    if (vscdbStatus !== null) {
      entry.prevVscdbStatus = vscdbStatus; // 只记录真实状态·WAL空读不覆盖
    }

    // ★ 核心三层判断:
    //   层一: vscdb 确认 active + .pb 停滞 → 真卡住 (100% 确定)
    //   层二: vscdb 确认 end_turn/error → 不是卡住 (已结束)
    //   层三: vscdb=n/a → 不知则不妄为 ("不出于户，以知天下" → 不可能，只有诚实的 "vscdb=n/a 我不知道")

    if (vscdbStatus === "active") {
      // Windsurf 确认 AI 应该在响应 → 这是唯一能确认卡住的情况
      entry.lastKnownVscdbStatus = "active"; // v11: 持久化已知状态 (修复fallback从未生效的bug)
      entry.lastVscdbActiveTs = t; // v11: WAL保护时间戳
      entry.errorTicks = 0; // v12.3: 恢复活跃·重置 error 确认计数
      // v12.1: 追踪本轮 turn 开始时刻 (用户发消息 → vscdb 从非active转为active的那一刻)
      //   prevVscdbStatus !== "active" → 本轮刚开始 → 重置 activeSinceTs
      //   目的: 为「初始发消息保护期」提供精准时间起点
      if (prevVscdbStatus !== "active") {
        entry.activeSinceTs = t; // 新一轮 turn: 用户发送了消息
        entry._turnGrowth = 0; // v12.9: 新 turn → 累计增长归零
        entry._awaitingUser = false; // v12.9: 新 turn → 恢复卡住检测
      } else if (!entry.activeSinceTs) {
        entry.activeSinceTs = t; // 引擎首次见到此对话为 active
      }
      const _timeSinceActive = t - (entry.activeSinceTs || t);
      const _inInitialGrace = _timeSinceActive < INITIAL_SEND_GRACE; // 发消息后3分钟保护
      summary.active++;
      if (grew || staleSec < CFG.warnThreshold) {
        newState = "streaming"; // .pb 在增长 = AI 正常流式输出
        summary.streaming++;
        entry.stuckTicks = 0; // 重置防抖计数器
        entry._awaitingUser = false; // AI 在输出 → 不是「等待用户」状态
      } else if (entry._awaitingUser) {
        // v12.9: 状态驱动 — AI 已完成回复·等待用户发下一轮提示词
        //   根本原理: “只要识别到用户发提示词的行为” → 才开始计时
        //   AI 回复完成 + 用户还没发消息 = 自然间隔 → 绝对不报卡住
        //   无任何时间限制 · 纯粹等待用户行为触发
        //   清除条件: USER_PROMPT_DETECT(用户发消息) 或 vscdb 转换(新turn)
        //   道: 不出于户·以知天下 — 不姄动·等待用户自行
        newState = "streaming";
        summary.streaming++;
        entry.stuckTicks = 0;
      } else if (_inInitialGrace) {
        // v12.1: 用户发消息后 3分钟保护 — AI 思考/加载窗口
        newState = "streaming";
        summary.streaming++;
      } else if ((entry._turnGrowth || 0) > AWAITING_USER_THRESHOLD) {
        // v12.9 核心: AI 已完成回复 → 标记为「等待用户」→ 永不报卡住
        //   条件满足 = AI 本轮实际输出了 >4KB + .pb 已停止增长 >60s + 保护期已过
        //   → 唯一合理解释: AI 完成了回复 · 现在是用户在读/在思考
        //   → 标记 _awaitingUser · 下一 tick 起永远走 _awaitingUser 分支
        //   → 直到 USER_PROMPT_DETECT 或 vscdb 转换清除此标志
        //   不影响真卡住: AI 从未输出 >4KB → 不触发此分支 → 正常 60s/120s 快速检测
        //   道: 天下之至柔·驰骋于天下之致坚 — 识别行为·而非等待时间
        entry._awaitingUser = true;
        entry.stuckTicks = 0;
        newState = "streaming";
        summary.streaming++;
        log(
          `AWAITING_USER uuid=${shortId(uuid)} turnGrowth=${entry._turnGrowth} staleSec=${staleSec}`,
        );
      } else if (staleSec < CFG.critThreshold) {
        // AI 从未产生 >4KB 输出 + 停滞 >60s → 可能真卡住
        entry.stuckTicks = (entry.stuckTicks || 0) + 1;
        const inGrace = nowMs() - _startupTs < STARTUP_GRACE;
        if (entry.stuckTicks >= 2 && !inGrace) {
          newState = "warning";
          summary.stuck++;
        } else {
          newState = "streaming"; // 观察期或 grace period
          summary.streaming++;
        }
      } else {
        // AI 从未产生 >4KB 输出 + 停滞 >2min → 真正卡死
        //   _turnGrowth < 4KB = AI 根本没开始正常响应 → 确认卡死
        entry.stuckTicks = (entry.stuckTicks || 0) + 1;
        const inGrace = nowMs() - _startupTs < STARTUP_GRACE;
        if (entry.stuckTicks >= 2 && !inGrace) {
          newState = "stuck";
          summary.stuck++;
        } else {
          newState = "warning"; // 首 tick 防抖 (20s 内确认)
          summary.stuck++;
        }
      }
    } else if (vscdbStatus === "unknown_error") {
      summary.error++;
      entry.stuckTicks = 0;
      // v12.3 多窗口防误杀: 累积 errorTicks
      //   多窗口 WAL 写冲突可能导致 unknown_error 瞬时出现 (1-2 ticks 内消失)
      //   errorTicks 确保连续稳定的 unknown_error 才触发 DEAD
      entry.errorTicks = (entry.errorTicks || 0) + 1;
      // v12.2: 死亡终态永持 — 彻底消除 dead→error→dead 振荡
      if (entry.state === "dead") {
        newState = "dead"; // 永保死亡态 · 不触发状态转换 · 不重复通知
      } else {
        // ═══ DEAD 首次检测: 双路径 + errorTicks 防抖 ═══
        // 路径A: 实时转换 — active→error (prevVscdbStatus=active + 曾在响应)
        const liveTransition =
          prevVscdbStatus === "active" &&
          (entry.state === "streaming" ||
            entry.state === "warning" ||
            entry.state === "stuck");
        const updatedMs =
          meta && meta.updatedAt ? new Date(meta.updatedAt).getTime() : 0;
        // 路径B: updatedAt检测 — 引擎重启后无历史时判断近期死亡
        const recentlyKilled =
          !liveTransition &&
          updatedMs > 0 &&
          t - updatedMs < 3600000 && // 1小时内更新过
          st.size > 10240; // .pb > 10KB (真实对话)
        if (liveTransition || recentlyKilled) {
          // v12.3: 多窗口防误杀 — 需 N 个连续 unknown_error ticks 才确认 DEAD
          //   liveTransition (强信号·active直接转error): 2 ticks = 20s 确认
          //   recentlyKilled (弱信号·启动推断): 3 ticks = 30s 确认
          //   多窗口 WAL 抖动通常在 1 tick 内自愈 → 不触发误杀
          const _needTicks = liveTransition ? 2 : 3;
          if (entry.errorTicks >= _needTicks) {
            newState = "dead";
            entry.deadSince = entry.deadSince || t;
            if (!entry.stuckSince) entry.stuckSince = updatedMs || t;
            if (recentlyKilled && !liveTransition) {
              entry._recentlyKilled = true;
              entry._killedAgo = Math.round((t - updatedMs) / 60000);
              writeSignal(uuid, "dead", {
                type: "dead_on_startup",
                uuid,
                title: entry.title,
                timestamp: isoTs(),
                staleSec,
                size: st.size,
                vscdbUpdatedAt: meta.updatedAt,
              });
            }
            log(
              `DEAD_CONFIRM uuid=${shortId(uuid)} errorTicks=${entry.errorTicks} path=${liveTransition ? "A-live" : "B-recent"}`,
            );
          } else {
            newState = "error"; // errorTicks 观察期: 等待确认 (多窗口WAL抖动保护)
          }
        } else {
          newState = "error"; // 陈旧 error (> 1小时 / .pb 太小 / 不满足死亡条件)
        }
      }
    } else if (vscdbStatus === "end_turn") {
      entry.lastKnownVscdbStatus = "end_turn"; // v11
      newState = "completed";
      summary.endTurn++;
      entry.stuckTicks = 0;
      entry.errorTicks = 0; // v12.3: 对话正常结束·重置 error 确认计数
    } else {
      // ★ vscdb=n/a: 不知则不妄为!
      // sessionCache 为空 = vscdb 暂时不可读 (保持前态, 不做任何判断)
      // sessionCache 有数据但此 UUID 不在 = 已从 70-session 窗口满出 (老对话, 不管)
      if (sessionCache.size === 0) {
        // DB 暂时不可读 → 用 entry.lastKnownVscdbStatus 缓存作 fallback
        // v11修复: 旧代码用 entry.vscdbStatus 但该字段从未被赋值 → fallback完全失效
        const _cached = entry.lastKnownVscdbStatus; // v11: 正确字段
        if (_cached === "active") {
          // 上次确认是 active → DB锁期间继续计入 active
          summary.active++;
          if (grew || staleSec < CFG.warnThreshold) {
            summary.streaming++;
            newState = "streaming";
            entry.stuckTicks = 0;
          } else {
            newState = entry.state === "init" ? "streaming" : entry.state;
            if (newState === "streaming") summary.streaming++;
          }
        } else if (_cached === "end_turn") {
          newState = "completed";
          summary.endTurn++;
        } else if (_cached === "unknown_error") {
          newState = "error";
          summary.error++;
        } else {
          // 无历史 → 保持前态
          newState = entry.state === "init" ? "streaming" : entry.state;
          if (grew) {
            summary.streaming++;
            entry.stuckTicks = 0;
          }
        }
      } else {
        // sessionCache 有数据但此 UUID 不在
        // v11: 先判断是否是 WAL 坏读 (N秒内曾经active的对话突然消失)
        // ★ 启动grace(120s内): 扩展至5min窗口, 防STATE恢复的lastVscdbActiveTs过期→WAL保护完全失效
        // v12.3: 多窗口 WAL 压力更大 → 保护窗口由 90s 扩展至 180s
        const _recentWindow = t - _startupTs < 120000 ? 300000 : 180000;
        const _recentActive =
          entry.lastVscdbActiveTs &&
          t - entry.lastVscdbActiveTs < _recentWindow;
        if (_recentActive) {
          // ★ WAL checkpoint 坏读: 90s内确认过active, UUID消失是WAL瞬时问题
          //   继续按active处理: 不归零stuckTicks, 继续累积, 确保stuck检测不中断
          entry.lastKnownVscdbStatus = "active"; // 保持已知状态
          summary.active++;
          // v12.7: WAL fallback 也需检查初始发消息保护期 (与 active 主路径保持一致)
          //   根因: UUID消失时走此分支, 原来直接检测staleSec → 跳过 INITIAL_SEND_GRACE → 假阳性
          const _walTimeSinceActive = t - (entry.activeSinceTs || t);
          const _walInInitialGrace = _walTimeSinceActive < INITIAL_SEND_GRACE;
          if (grew || staleSec < CFG.warnThreshold) {
            newState = "streaming";
            summary.streaming++;
            entry.stuckTicks = 0;
            entry._awaitingUser = false; // v12.9: WAL fallback 同规则
          } else if (entry._awaitingUser) {
            newState = "streaming"; // v12.9: 等待用户 · WAL fallback 同规则
            summary.streaming++;
            entry.stuckTicks = 0;
          } else if (_walInInitialGrace) {
            newState = "streaming"; // v12.7: 保护期内 · WAL fallback 与主路径同规则
            summary.streaming++;
          } else if ((entry._turnGrowth || 0) > AWAITING_USER_THRESHOLD) {
            // v12.9: WAL fallback 同规则 — AI 已完成回复 → 等待用户
            entry._awaitingUser = true;
            entry.stuckTicks = 0;
            newState = "streaming";
            summary.streaming++;
          } else if (staleSec < CFG.critThreshold) {
            entry.stuckTicks = (entry.stuckTicks || 0) + 1;
            const inGrace = nowMs() - _startupTs < STARTUP_GRACE;
            newState =
              entry.stuckTicks >= 2 && !inGrace ? "warning" : "streaming";
            if (newState === "warning") summary.stuck++;
            else summary.streaming++;
          } else {
            entry.stuckTicks = (entry.stuckTicks || 0) + 1;
            const inGrace = nowMs() - _startupTs < STARTUP_GRACE;
            newState = entry.stuckTicks >= 2 && !inGrace ? "stuck" : "warning";
            summary.stuck++;
          }
        } else {
          // 真孤儿对话: 从未active或已离开vscdb活跃窗口超过90s
          // v10 根治: 不计入任何统计, 不检测卡住
          entry.stuckTicks = 0;
          if (grew && staleSec < 30) {
            newState = "streaming"; // 极短窗口: 刚创建·正在进入vscdb
            summary.streaming++;
            summary.pbOnly++;
          } else if (staleSec < 300) {
            newState = "old";
            summary.pbOnly++;
          } else {
            newState = "old"; // 历史对话·静默
          }
        }
      }
    }

    // ─── 状态转换 (防抖 + 确认后才行动) ───
    if (newState !== prevState) {
      entry.state = newState;
      if (newState === "stuck") {
        if (!entry.stuckSince) entry.stuckSince = entry.lastGrowth;
        const name = entry.title || shortId(uuid);
        transitions.push({
          type: "CRITICAL_STUCK",
          uuid,
          name,
          staleSec,
          size: st.size,
          vscdbStatus: vscdbStatus || "n/a",
        });
        writeSignal(uuid, "stuck", {
          type: "stuck",
          uuid,
          title: entry.title,
          timestamp: isoTs(),
          staleSec,
          size: st.size,
          vscdbStatus: vscdbStatus || "n/a",
        });
      } else if (newState === "warning" && prevState !== "stuck") {
        // 仅从 streaming/init 进入 warning 时记录 (从 stuck 降级到 warning 不重复记)
        if (!entry.stuckSince) entry.stuckSince = entry.lastGrowth;
        const name = entry.title || shortId(uuid);
        transitions.push({
          type: "WARN_STUCK",
          uuid,
          name,
          staleSec,
          size: st.size,
          vscdbStatus: vscdbStatus || "n/a",
        });
      } else if (newState === "dead") {
        entry.stuckSince = t;
        const name = entry.title || shortId(uuid);
        // v11.1: 携带路径B标识 (_recentlyKilled) 供日志/通知使用
        const _rk = entry._recentlyKilled || false;
        const _ka = entry._killedAgo || 0;
        transitions.push({
          type: "DEAD",
          uuid,
          name,
          staleSec,
          size: st.size,
          vscdbStatus: vscdbStatus || "n/a",
          prevStatus: _rk ? "active(估计)" : prevVscdbStatus,
          _recentlyKilled: _rk,
          _updatedAgo: _ka,
        });
        // 路径B已在classification段写了signal, 避免重复写
        if (!_rk) {
          writeSignal(uuid, "dead", {
            type: "dead",
            uuid,
            title: entry.title,
            timestamp: isoTs(),
            staleSec,
            size: st.size,
            vscdbStatus: vscdbStatus || "n/a",
          });
        }
        // 清除路径B标识 (一次性)
        delete entry._recentlyKilled;
        delete entry._killedAgo;
      } else if (
        (prevState === "stuck" ||
          prevState === "warning" ||
          prevState === "dead") &&
        (newState === "streaming" || newState === "completed")
      ) {
        const dur = Math.round((t - (entry.stuckSince || t)) / 1000);
        const name = entry.title || shortId(uuid);
        // ★ 仅在之前真正发过通知时才发 RECOVER 通知 (避免假 STUCK 后的假 RECOVER)
        const wasNotified =
          entry.lastNotify > 0 && t - entry.lastNotify < CFG.cooldown * 1000;
        transitions.push({
          type: "RECOVER",
          uuid,
          name,
          stuckDur: dur,
          wasNotified,
        });
        clearSignals(uuid, "stuck");
        clearSignals(uuid, "dead");
        entry.stuckSince = 0;
        entry.stuckTicks = 0;
        entry.deadSince = 0; // v11.2: 清除死亡保护期，允许未来再次死亡检测
        entry._notifyCount = 0; // v12.4: 恢复 → 重置通知计数 (允许下次卡住重新通知)
      }
    }

    // ─── 卡住列表 (包含 warning + stuck + dead) ───
    if (newState === "stuck" || newState === "warning" || newState === "dead") {
      // v12.2: dead 自动淡出 — 超过 10分钟 无恢复 → 静默移出面板 (用户已放弃此对话)
      const _isDeadExpired =
        newState === "dead" &&
        entry.deadSince &&
        t - entry.deadSince > DEAD_EXPIRE_MS;
      if (!_isDeadExpired) {
        stuckList.push({
          uuid,
          title: entry.title,
          shortId: shortId(uuid),
          staleSec,
          staleMin: Math.round(staleSec / 60),
          size: st.size,
          vscdbStatus: vscdbStatus || "n/a",
          updatedAt: meta ? meta.updatedAt : null,
          level:
            newState === "stuck"
              ? "CRITICAL"
              : newState === "dead"
                ? "DEAD"
                : "WARNING",
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 二次扫描: vscdb active+cascade 但无 .pb 文件的对话 (完全不可见的盲区!)
  // 这些对话在 Windsurf 看来是活跃的, 但引擎之前完全无法感知
  // 可能原因: .pb 尚未创建(新建对话) / .pb 被清理 / 运行在不同机器
  // 道法自然: 不知则不妄断, 但必须让用户知道这些存在
  // ═══════════════════════════════════════════════════════════════════════════
  const currentPbUuids = new Set(pbFiles.map((f) => f.replace(".pb", "")));
  let noPbActive = 0;
  for (const [uuid, meta] of sessionCache) {
    if (meta.status !== "active") continue;
    if (meta.providerId && meta.providerId !== "cascade") continue; // 只关注 cascade
    if (currentPbUuids.has(uuid)) continue; // 已有 .pb 在主循环追踪
    noPbActive++;
    // 加入 stuckList 供前端展示 (level=NO_PB)
    const updatedMs2 = meta.updatedAt ? new Date(meta.updatedAt).getTime() : 0;
    const noPbStaleSec =
      updatedMs2 > 0 ? Math.round((t - updatedMs2) / 1000) : 0;
    stuckList.push({
      uuid,
      title: meta.title,
      shortId: shortId(uuid),
      staleSec: noPbStaleSec,
      staleMin: Math.round(noPbStaleSec / 60),
      size: 0,
      vscdbStatus: "active",
      updatedAt: meta.updatedAt,
      level: "NO_PB", // 新级别: vscdb=active 但无 .pb 文件
      _noPb: true,
    });
  }
  summary.noPbActive = noPbActive;
  summary.activeTotal = summary.activeTotal || summary.active + noPbActive;
  for (const uuid of Object.keys(state.conversations)) {
    if (!currentPbUuids.has(uuid)) {
      delete state.conversations[uuid];
    }
  }

  // ─── 处理转换事件 ───
  for (const tr of transitions) {
    const entry = state.conversations[tr.uuid];
    if (tr.type === "CRITICAL_STUCK") {
      const _n1 = shortTitle(tr.name);
      log(
        `CRITICAL_STUCK uuid=${shortId(tr.uuid)} name="${_n1}" stale=${tr.staleSec}s size=${tr.size} vscdb=${tr.vscdbStatus}`,
      );
      // v12.4: staleSec > 600 (10min) → 静默 · 已无时效性
      if (tr.staleSec > 600) {
        /* 10min+ 不通知 */
      } else if (
        t - entry.lastNotify > CFG.cooldown * 1000 &&
        (entry._notifyCount || 0) < 2
      ) {
        notify(
          "critical",
          "stuck",
          "道·对话卡死!",
          `${_n1}\n已停滞 ${Math.round(tr.staleSec / 60)} 分钟!\n状态: ${tr.vscdbStatus}`,
        );
        entry.lastNotify = t;
        entry._notifyCount = (entry._notifyCount || 0) + 1;
      }
    } else if (tr.type === "WARN_STUCK") {
      const _n2 = shortTitle(tr.name);
      log(
        `WARN_STUCK uuid=${shortId(tr.uuid)} name="${_n2}" stale=${tr.staleSec}s vscdb=${tr.vscdbStatus}`,
      );
      // v12.4: staleSec > 600 (10min) → 静默 · 已无时效性
      if (tr.staleSec > 600) {
        /* 10min+ 不通知 */
      } else if (
        t - entry.lastNotify > CFG.cooldown * 1000 &&
        (entry._notifyCount || 0) < 2
      ) {
        notify(
          "warn",
          "stuck",
          "道·对话疑似卡住",
          `${_n2}\n停滞 ${Math.round(tr.staleSec / 60)} 分钟\nvscdb: ${tr.vscdbStatus}`,
        );
        entry.lastNotify = t;
        entry._notifyCount = (entry._notifyCount || 0) + 1;
      }
    } else if (tr.type === "DEAD") {
      const _n3 = shortTitle(tr.name);
      log(
        `DEAD uuid=${shortId(tr.uuid)} name="${_n3}" stale=${tr.staleSec}s vscdb=${tr.vscdbStatus} prev=${tr.prevStatus}`,
      );
      // v12.4: staleSec > 600 (10min) → 静默; DEAD 仅通知1次
      if (tr.staleSec > 600) {
        /* 10min+ 不通知 */
      } else if (
        t - entry.lastNotify > 60000 &&
        (entry._notifyCount || 0) < 2
      ) {
        notify(
          "critical",
          "dead",
          "道·对话死亡!",
          `${_n3}\n状态: active → ${tr.vscdbStatus}\n请检查并重试`,
        );
        entry.lastNotify = t;
        entry._notifyCount = (entry._notifyCount || 0) + 1;
      }
    } else if (tr.type === "RECOVER") {
      const _n4 = shortTitle(tr.name);
      log(
        `RECOVER uuid=${shortId(tr.uuid)} name="${_n4}" stuckDur=${tr.stuckDur}s notified=${tr.wasNotified}`,
      );
      // ★ 仅在之前真正发过 STUCK 通知时才发 RECOVER 通知
      if (tr.wasNotified && tr.stuckDur > 60) {
        // v11.3: RECOVER通知已移除 — 用户可在对话追踪面板查看恢复状态，减少通知密度
      }
    }
  }

  // ─── 持续卡住的周期性提醒 (仅 CRITICAL 卡死 · DEAD 一次性通知·不周期重复) ───
  // v12.4: staleSec > 10min 静默 + 同一对话最多通知2次
  for (const item of stuckList) {
    if (item.level !== "CRITICAL") continue;
    if (item._noPb) continue;
    if (item.staleSec > 600) continue; // v12.4: 10min+ 不通知
    const entry = state.conversations[item.uuid];
    if (!entry) continue;
    if ((entry._notifyCount || 0) >= 2) continue; // v12.4: 已通知2次·不再打扰
    if (t - entry.lastNotify > CFG.cooldown * 1000) {
      notify(
        "critical",
        "stuck",
        "道·对话仍卡死",
        `${item.title || item.shortId}\n已停滞 ${item.staleMin} 分钟\n状态: ${item.vscdbStatus}`,
      );
      entry.lastNotify = t;
      entry._notifyCount = (entry._notifyCount || 0) + 1;
    }
  }

  // 排序: 最久卡住的在前
  stuckList.sort((a, b) => b.staleSec - a.staleSec);

  // v10: 从 vscdb 统计全量真实 cascade active 数
  let activeTotal = 0;
  for (const [, meta] of sessionCache) {
    if (meta.status === "active" && meta.providerId === "cascade")
      activeTotal++;
  }
  // DB锁时 (sessionCache空) → 用 summary.active (含缓存状态) 作 fallback、最差用streaming
  summary.activeTotal =
    activeTotal > 0 ? activeTotal : summary.active || summary.streaming || 0;

  state.lastUpdate = t;
  state.lastSummary = summary;
  state.lastStuckList = stuckList;
  saveState(state);

  return { summary, stuckList, transitions };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP 看板
// ═══════════════════════════════════════════════════════════════════════════════
function dashboardHtml(summary, stuckList) {
  summary = summary || {
    totalSessions: 0,
    totalPb: 0,
    active: 0,
    streaming: 0,
    stuck: 0,
    endTurn: 0,
    error: 0,
    pbOnly: 0,
  };
  stuckList = stuckList || [];

  const rows = stuckList
    .map((s) => {
      const cls =
        s.level === "DEAD"
          ? "dead"
          : s.level === "CRITICAL"
            ? "critical"
            : "warning";
      return `<tr class="${cls}">
      <td><span class="level ${cls}">${s.level}</span></td>
      <td>${s.staleMin}min (${s.staleSec}s)</td>
      <td>${(s.title || s.shortId).replace(/</g, "&lt;")}</td>
      <td><code>${s.shortId}</code></td>
      <td>${(s.size / 1024).toFixed(0)}KB</td>
      <td>${s.vscdbStatus}</td>
      <td>${s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString("zh-CN") : "?"}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta http-equiv="refresh" content="10">
<title>道 · stuck-detect v9</title>
<style>
body{font-family:Consolas,"Microsoft YaHei",monospace;background:#1e1e1e;color:#d4d4d4;margin:0;padding:20px}
h1{color:#4ec9b0;margin:0 0 5px}
.ver{color:#569cd6;font-size:13px;margin-bottom:15px}
.box{background:#252526;padding:15px;border-radius:6px;margin-bottom:15px;border:1px solid #3e3e42}
.stat{display:inline-block;margin-right:25px}
.stat .v{font-size:28px;font-weight:bold;color:#dcdcaa}
.stat .l{color:#858585;font-size:11px;text-transform:uppercase}
.stuck .v{color:#f48771}
.streaming .v{color:#4ec9b0}
.active .v{color:#569cd6}
.error .v{color:#ce9178}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#2d2d30;text-align:left;padding:8px 10px;color:#9cdcfe;font-weight:normal;border-bottom:1px solid #3e3e42}
td{padding:8px 10px;border-bottom:1px solid #2d2d30}
tr.dead{background:#5a0a0a}
tr.dead td{color:#ff6b6b}
tr.critical{background:#5a1d1d}
tr.critical td:first-child{color:#f48771;font-weight:bold}
tr.warning{background:#3a2e1a}
tr.warning td:first-child{color:#dcdcaa;font-weight:bold}
tr.normal td:first-child{color:#9cdcfe}
.level{padding:2px 8px;border-radius:3px;font-weight:bold;font-size:11px}
.level.dead{background:#ff0000;color:#fff}
.level.critical{background:#e74c3c;color:#fff}
.level.warning{background:#f39c12;color:#fff}
code{background:#0e0e0e;padding:2px 6px;border-radius:3px;color:#ce9178}
.empty{text-align:center;color:#4ec9b0;padding:40px;font-size:16px}
.src{background:#1a3a1a;color:#4ec9b0;padding:8px 12px;border-radius:4px;margin-bottom:10px;font-size:12px}
.src b{color:#dcdcaa}
</style></head><body>
<h1>道 · Cascade 卡住检测 v9</h1>
<div class="ver">双源真本源 | WARNING &gt; ${CFG.warnThreshold}s | CRITICAL &gt; ${CFG.critThreshold}s | DEAD = active→error</div>

<div class="src">
  <b>SOURCE 1</b> vscdb sessions: ${summary.totalSessions} &nbsp;|&nbsp;
  <b>SOURCE 2</b> .pb files: ${summary.totalPb} &nbsp;|&nbsp;
  刷新: ${new Date().toLocaleString("zh-CN")} &nbsp;|&nbsp;
  warn=${CFG.warnThreshold}s crit=${CFG.critThreshold}s poll=${CFG.poll}s
</div>

<div class="box">
  <div class="stat active"><div class="v">${summary.active}</div><div class="l">active (vscdb)</div></div>
  <div class="stat streaming"><div class="v">${summary.streaming}</div><div class="l">streaming (.pb↑)</div></div>
  <div class="stat stuck"><div class="v">${summary.stuck}</div><div class="l">stuck</div></div>
  <div class="stat"><div class="v">${summary.endTurn}</div><div class="l">end_turn</div></div>
  <div class="stat error"><div class="v">${summary.error}</div><div class="l">error</div></div>
</div>

<div class="box">
  <h2 style="color:#f48771;margin-top:0;font-size:16px">异常对话 (${stuckList.length})</h2>
  ${
    stuckList.length === 0
      ? '<div class="empty">&#10003; 当前没有异常对话</div>'
      : `<table><thead><tr><th>级别</th><th>停滞时间</th><th>对话名称</th><th>UUID</th><th>.pb大小</th><th>vscdb状态</th><th>最后更新</th></tr></thead><tbody>${rows}</tbody></table>`
  }
</div>

<div style="font-size:11px;color:#555;margin-top:10px">
  PID ${process.pid} · 瞽者善听聋者善视 · 绝利一源用师十倍
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 全量实时看板 · 道法自然 · 万物并作吾以观其复
// ═══════════════════════════════════════════════════════════════════════════════
function fullDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>道 · Cascade Monitor v9.2</title>
<style>
*{box-sizing:border-box}
body{font-family:'Cascadia Code','Consolas','Microsoft YaHei',monospace;background:#0d1117;color:#c9d1d9;margin:0;padding:0;overflow-x:hidden}
.header{background:#161b22;border-bottom:1px solid #30363d;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.header h1{margin:0;font-size:18px;color:#58a6ff;font-weight:600}
.header .meta{font-size:11px;color:#8b949e}
.header .controls{display:flex;gap:8px}
.btn{background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;transition:all .15s}
.btn:hover{background:#30363d;border-color:#58a6ff}
.btn.danger{border-color:#f85149;color:#f85149}
.btn.danger:hover{background:#f8514920}
.stats{display:flex;gap:12px;padding:12px 20px;background:#161b22;border-bottom:1px solid #30363d;flex-wrap:wrap}
.stat{background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:8px 14px;min-width:90px;text-align:center}
.stat .v{font-size:22px;font-weight:700;line-height:1.2}
.stat .l{font-size:10px;color:#8b949e;text-transform:uppercase;letter-spacing:.5px}
.stat.streaming .v{color:#3fb950}
.stat.active .v{color:#58a6ff}
.stat.stuck .v{color:#f85149}
.stat.error .v{color:#d29922}
.stat.end .v{color:#8b949e}
.table-wrap{padding:12px 20px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead{position:sticky;top:52px;z-index:50}
th{background:#161b22;color:#8b949e;font-weight:500;text-align:left;padding:8px 10px;border-bottom:1px solid #30363d;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
td{padding:7px 10px;border-bottom:1px solid #21262d;vertical-align:middle}
tr{transition:background .2s}
tr:hover{background:#161b2280}
tr.streaming{border-left:3px solid #3fb950}
tr.warning{border-left:3px solid #d29922;background:#d2992208}
tr.stuck{border-left:3px solid #f85149;background:#f8514910}
tr.dead{border-left:3px solid #ff0000;background:#ff000015}
tr.completed{border-left:3px solid #30363d}
tr.error{border-left:3px solid #d29922}
tr.old{opacity:.5;border-left:3px solid transparent}
.badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:600;text-transform:uppercase}
.badge.streaming{background:#3fb95020;color:#3fb950;border:1px solid #3fb95040}
.badge.warning{background:#d2992220;color:#d29922;border:1px solid #d2992240}
.badge.stuck{background:#f8514920;color:#f85149;border:1px solid #f8514940}
.badge.dead{background:#ff000020;color:#ff4444;border:1px solid #ff000040}
.badge.completed{background:#30363d40;color:#8b949e;border:1px solid #30363d}
.badge.error{background:#d2992210;color:#d29922;border:1px solid #d2992230}
.badge.old{background:#21262d;color:#484f58;border:1px solid #30363d}
.badge.no_pb{background:#9d174d30;color:#f9a8d4;border:1px solid #9d174d60;animation:blink-nopb 2s ease-in-out infinite}
@keyframes blink-nopb{0%,100%{opacity:1}50%{opacity:.5}}
tr.no_pb{border-left:3px solid #f9a8d4;background:#9d174d08}
.stat.nopb .v{color:#f9a8d4}
.uuid{font-family:monospace;color:#79c0ff;font-size:11px;opacity:.8}
.title-cell{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.size{color:#8b949e;font-family:monospace}
.stale{font-family:monospace;font-weight:600}
.stale.fresh{color:#3fb950}
.stale.aging{color:#d29922}
.stale.old{color:#f85149}
.pulse{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;animation:pulse 1.5s infinite}
.pulse.live{background:#3fb950}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.footer{padding:12px 20px;font-size:11px;color:#484f58;border-top:1px solid #21262d;text-align:center}
.no-data{text-align:center;padding:60px 20px;color:#8b949e}
.no-data .icon{font-size:48px;margin-bottom:10px}
.vscdb-indicator{display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:4px}
.vscdb-indicator.ok{background:#3fb950}
.vscdb-indicator.na{background:#d29922}
#refresh-indicator{position:fixed;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:#3fb950;opacity:0;transition:opacity .3s}
#refresh-indicator.active{opacity:1}
.filter-bar{display:flex;gap:6px;padding:8px 20px;background:#0d1117;border-bottom:1px solid #21262d;flex-wrap:wrap;align-items:center}
.filter-bar .label{font-size:11px;color:#8b949e;margin-right:4px}
.fbtn{background:#21262d;border:1px solid #30363d;color:#8b949e;padding:3px 10px;border-radius:12px;cursor:pointer;font-size:11px;font-family:inherit;transition:all .15s}
.fbtn:hover{border-color:#58a6ff;color:#c9d1d9}
.fbtn.on{background:#58a6ff20;border-color:#58a6ff;color:#58a6ff}
.filter-bar .count{font-size:11px;color:#484f58;margin-left:auto}
</style></head>
<body>
<div id="refresh-indicator"></div>
<div class="header">
  <div>
    <h1>道 · Cascade Monitor</h1>
    <div class="meta">v9.2 | PID ${process.pid} | 瞽者善听聋者善视 · 绝利一源用师十倍</div>
  </div>
  <div class="controls">
    <button class="btn" onclick="testNotify()">🔔 测试通知</button>
    <button class="btn" onclick="location.href='/api/all'">📋 JSON</button>
    <span id="clock" style="font-size:11px;color:#8b949e;padding:5px 0"></span>
  </div>
</div>
<div class="stats" id="stats"></div>
<div class="filter-bar">
  <span class="label">Filter:</span>
  <button class="fbtn on" data-f="streaming" onclick="toggleFilter(this)">Streaming</button>
  <button class="fbtn on" data-f="warning" onclick="toggleFilter(this)">Warning</button>
  <button class="fbtn on" data-f="stuck" onclick="toggleFilter(this)">Stuck</button>
  <button class="fbtn on" data-f="dead" onclick="toggleFilter(this)">Dead</button>
  <button class="fbtn on" data-f="completed" onclick="toggleFilter(this)">Completed</button>
  <button class="fbtn on" data-f="error" onclick="toggleFilter(this)">Error</button>
  <button class="fbtn on" data-f="no_pb" onclick="toggleFilter(this)">No-PB</button>
  <button class="fbtn" data-f="old" onclick="toggleFilter(this)">Old</button>
  <span class="count" id="filter-count"></span>
</div>
<div class="table-wrap">
  <table>
    <thead><tr>
      <th>状态</th><th>停滞</th><th>对话名称</th><th>UUID</th><th>大小</th><th>vscdb</th><th>Provider</th><th>Ticks</th>
    </tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <div id="no-data" class="no-data" style="display:none">
    <div class="icon">☯</div>
    <div>正在等待数据...</div>
  </div>
</div>
<div class="footer">
  道法自然 · 万物并作吾以观其复 · 自动刷新 3s
</div>
<script>
const API = '/api/all';
let lastData = null;
// ─── 道·浏览器通知状态 ───
let _notifGranted = false;
let _lastStuckUuids = new Set();
let _audioCtx = null;
let _notifBannerTimeout = null;
// Filter state (persisted in localStorage)
// v10+: error默认开启(可能是近期死亡对话) + no_pb默认开启(异常对话)
let filters = JSON.parse(localStorage.getItem('dao-filters') || '{"streaming":true,"warning":true,"stuck":true,"dead":true,"completed":true,"error":true,"no_pb":true,"old":false}');
function initFilters() {
  document.querySelectorAll('.fbtn[data-f]').forEach(btn => {
    const f = btn.dataset.f;
    if (filters[f]) btn.classList.add('on'); else btn.classList.remove('on');
  });
}
function toggleFilter(btn) {
  const f = btn.dataset.f;
  filters[f] = !filters[f];
  btn.classList.toggle('on');
  localStorage.setItem('dao-filters', JSON.stringify(filters));
  if (lastData) renderTable(lastData.conversations);
}
initFilters();

async function refresh() {
  const ind = document.getElementById('refresh-indicator');
  ind.classList.add('active');
  try {
    const r = await fetch(API);
    const data = await r.json();
    lastData = data;
    renderStats(data.summary);
    renderTable(data.conversations);
    checkStuckNotify(data.conversations);
    document.getElementById('clock').textContent = new Date().toLocaleTimeString('zh-CN');
  } catch(e) {
    console.error('Fetch error:', e);
  }
  setTimeout(() => ind.classList.remove('active'), 300);
}

function renderStats(s) {
  if (!s) return;
  // v10+: 展示 activeTotal(真实活跃数) 和 noPbActive(盲区对话数)
  var totalActive = s.activeTotal || s.active || 0;
  var noPb = s.noPbActive || 0;
  var noPbHtml = noPb > 0
    ? '<div class="stat nopb"><div class="v">' + noPb + '</div><div class="l">No-PB 盲区</div></div>'
    : '';
  document.getElementById('stats').innerHTML =
    '<div class="stat streaming"><div class="v">' + (s.streaming||0) + '</div><div class="l">Streaming</div></div>' +
    '<div class="stat active"><div class="v">' + totalActive + '</div><div class="l">Active(真实)</div></div>' +
    '<div class="stat stuck"><div class="v">' + (s.stuck||0) + '</div><div class="l">Stuck</div></div>' +
    noPbHtml +
    '<div class="stat end"><div class="v">' + (s.endTurn||0) + '</div><div class="l">End Turn</div></div>' +
    '<div class="stat error"><div class="v">' + (s.error||0) + '</div><div class="l">Error/Dead</div></div>' +
    '<div class="stat"><div class="v">' + (s.totalSessions||0) + '</div><div class="l">Sessions</div></div>' +
    '<div class="stat"><div class="v">' + (s.totalPb||0) + '</div><div class="l">.pb Files</div></div>';
}

function renderTable(convos) {
  const tbody = document.getElementById('tbody');
  const noData = document.getElementById('no-data');
  if (!convos || convos.length === 0) {
    tbody.innerHTML = '';
    noData.style.display = 'block';
    return;
  }
  noData.style.display = 'none';
  // v10+: no_pb 对话从 stuckList 附加到 convos 廻末尾展示
  var allConvos = convos.slice();
  if (lastData && lastData.stuckList) {
    lastData.stuckList.forEach(function(item) {
      if (item._noPb) allConvos.push({ state: 'no_pb', title: item.title, shortId: item.shortId,
        uuid: item.uuid, staleSec: item.staleSec, staleStr: item.staleMin + 'm',
        sizeKB: 0, vscdbStatus: 'active', providerId: 'cascade', stuckTicks: 0 });
    });
  }
  const visible = allConvos.filter(c => filters[c.state] !== false);
  document.getElementById('filter-count').textContent = visible.length + '/' + allConvos.length;
  tbody.innerHTML = visible.map(function(c) {
    const staleClass = c.staleSec < 30 ? 'fresh' : c.staleSec < 120 ? 'aging' : 'old';
    const pulseHtml = (c.state === 'streaming' && c.staleSec < 15) ? '<span class="pulse live"></span>' : '';
    const vscdbDot = c.vscdbStatus === 'n/a' ? 'na' : 'ok';
    const stateLabel = c.state === 'no_pb' ? 'NO-PB\u26a0' : c.state;
    const rowNote = c.state === 'no_pb' ? ' <span style="font-size:9px;color:#f9a8d4;opacity:.7">(vscdb active, 无.pb文件)</span>' : '';
    return '<tr class="' + c.state + '">' +
      '<td><span class="badge ' + c.state + '">' + pulseHtml + stateLabel + '</span></td>' +
      '<td><span class="stale ' + staleClass + '">' + c.staleStr + '</span></td>' +
      '<td class="title-cell">' + esc(c.title || '(unnamed)') + rowNote + '</td>' +
      '<td class="uuid">' + c.shortId + '</td>' +
      '<td class="size">' + c.sizeKB + 'KB</td>' +
      '<td>' + c.vscdbStatus + '<span class="vscdb-indicator ' + vscdbDot + '"></span></td>' +
      '<td style="font-size:10px;color:#8b949e">' + (c.providerId || '-') + '</td>' +
      '<td style="color:' + (c.stuckTicks > 0 ? '#f85149' : '#484f58') + '">' + c.stuckTicks + '</td>' +
    '</tr>';
  }).join('');
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function testNotify() {
  try {
    const r = await fetch('/api/notify-test');
    const d = await r.json();
    alert(d.ok ? '通知已发送! 请检查系统通知区域' : '通知发送失败');
  } catch(e) { alert('Error: ' + e.message); }
}

// ═══════════════════════════════════════════════════════════════
// 道·浏览器通知 — 至静之道，通知须柔而必达
// 无为而无不为: 页面在后台也能主动告警
// ═══════════════════════════════════════════════════════════════
function _playBeep(freq, dur) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = _audioCtx.createOscillator();
    var g = _audioCtx.createGain();
    osc.connect(g); g.connect(_audioCtx.destination);
    osc.frequency.value = freq || 880;
    g.gain.setValueAtTime(0.25, _audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + (dur || 0.5));
    osc.start(); osc.stop(_audioCtx.currentTime + (dur || 0.5));
  } catch(e) {}
}

function _showBanner(msg, color) {
  var el = document.getElementById('dao-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dao-banner';
    el.style.cssText = 'position:fixed;bottom:20px;right:20px;max-width:340px;padding:12px 16px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.6);cursor:pointer;transition:opacity .3s';
    el.onclick = function(){ el.style.opacity='0'; setTimeout(function(){ el.style.display='none'; },300); };
    document.body.appendChild(el);
  }
  el.style.background = color || '#f85149';
  el.style.color = '#fff';
  el.style.display = 'block';
  el.style.opacity = '1';
  el.textContent = msg;
  if (_notifBannerTimeout) clearTimeout(_notifBannerTimeout);
  _notifBannerTimeout = setTimeout(function(){ el.style.opacity='0'; setTimeout(function(){ el.style.display='none'; },300); }, 8000);
}

async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { _notifGranted = (await Notification.requestPermission()) === 'granted'; } catch(e) {}
  } else {
    _notifGranted = Notification.permission === 'granted';
  }
  if (!_notifGranted) {
    _showBanner('道·Monitor: 请允许浏览器通知权限以获得卡住告警 (点击地址栏左侧锁图标)', '#d29922');
  }
}

function checkStuckNotify(conversations) {
  if (!conversations) return;
  // v10+: 也监控 stuckList 中的 dead + no_pb (stuckList 附在 lastData 中)
  var extraItems = (lastData && lastData.stuckList)
    ? lastData.stuckList.filter(function(s){ return s.level === 'DEAD' || s.level === 'NO_PB'; })
      .map(function(s){ return { uuid: s.uuid, state: s.level === 'DEAD' ? 'dead' : 'no_pb',
        title: s.title, shortId: s.shortId, staleStr: s.staleMin + 'm' }; })
    : [];
  var baseStuck = conversations.filter(function(c) {
    return c.state === 'stuck' || c.state === 'dead' || c.state === 'warning';
  });
  // 合并去重 (uuid 为 key)
  var seenUuids = new Set(baseStuck.map(function(c){ return c.uuid; }));
  var stuckNow = baseStuck.concat(extraItems.filter(function(e){ return !seenUuids.has(e.uuid); }));
  var newStuck = stuckNow.filter(function(c) { return !_lastStuckUuids.has(c.uuid); });
  _lastStuckUuids = new Set(stuckNow.map(function(c) { return c.uuid; }));

  // ★ Tab 标题实时反映卡住数 (最可感知的被动提示)
  var cnt = stuckNow.length;
  var critCnt = stuckNow.filter(function(c){ return c.state==='stuck'||c.state==='dead'; }).length;
  document.title = cnt > 0
    ? '[' + cnt + '\u5b58' + (critCnt ? '\u203c' : '\u26a0') + '] \u9053\u00b7Monitor'
    : '\u9053\u00b7Cascade Monitor';

  if (newStuck.length === 0) return;

  // ★ 页面内悬浮 Banner (页面在后台或最小化时仍会在恢复焦点时可见)
  var topItem = newStuck[0];
  var bannerColor = (topItem.state === 'dead' || topItem.state === 'stuck') ? '#f85149' : '#d29922';
  var names = newStuck.slice(0,3).map(function(c){ return (c.title||c.shortId); }).join(' / ');
  _showBanner('\u9053\u00b7\u5bf9\u8bdd\u5361\u4f4f! ' + names + ' \u505c\u6ede ' + topItem.staleStr, bannerColor);

  // ★ 音频提示 (页面在任何可见状态都有效)
  _playBeep(topItem.state === 'dead' ? 660 : 880, 0.4);
  if (newStuck.length > 1) setTimeout(function(){ _playBeep(880, 0.3); }, 600);

  // ★ Web Notification (后台 Tab 也能弹出系统级通知)
  if (_notifGranted && 'Notification' in window) {
    var lines = newStuck.slice(0,3).map(function(c){
      return (c.title||c.shortId) + ' - ' + c.staleStr;
    }).join('\\n');
    try {
      var notif = new Notification('\u9053\u00b7Cascade \u5361\u4f4f!', {
        body: lines,
        tag: 'dao-stuck',
        renotify: true,
        requireInteraction: true
      });
      notif.onclick = function(){ window.focus(); notif.close(); };
    } catch(e) {}
  }
}

// Initial load + auto refresh
initNotifications();
refresh();
setInterval(refresh, 3000);
</script>
</body></html>`;
}

function startHttpServer() {
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/api/status") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(
        JSON.stringify(
          {
            timestamp: isoTs(),
            summary: state.lastSummary || {},
            stuckList: state.lastStuckList || [],
            pid: process.pid,
            version: "v9.2",
            uptime: Math.round(process.uptime()),
            sources: { pb: PB_DIR, vscdb: VSCDB },
          },
          null,
          2,
        ),
      );
      return;
    }
    if (url === "/api/all") {
      // ★ 全量对话状态: 显示所有被跟踪的对话
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      const now = nowMs();
      const all = [];
      for (const [uuid, entry] of Object.entries(state.conversations)) {
        const meta = sessionCache.get(uuid);
        const staleSec = Math.round((now - entry.lastGrowth) / 1000);
        all.push({
          uuid,
          shortId: shortId(uuid),
          title: entry.title || (meta && meta.title) || null,
          state: entry.state || "unknown",
          vscdbStatus: meta ? meta.status : "n/a",
          size: entry.size || 0,
          sizeKB: Math.round((entry.size || 0) / 1024),
          staleSec,
          staleStr:
            staleSec < 60 ? `${staleSec}s` : `${Math.round(staleSec / 60)}m`,
          lastGrowth: entry.lastGrowth
            ? new Date(entry.lastGrowth).toISOString()
            : null,
          mtime: entry.mtime ? new Date(entry.mtime).toISOString() : null,
          providerId: meta ? meta.providerId : null,
          stuckTicks: entry.stuckTicks || 0,
        });
      }
      // 排序: active/streaming 在前, 然后按 staleSec 升序
      all.sort((a, b) => {
        const order = {
          streaming: 0,
          warning: 1,
          stuck: 2,
          dead: 3,
          completed: 4,
          error: 5,
          old: 6,
          init: 7,
        };
        const oa = order[a.state] ?? 8,
          ob = order[b.state] ?? 8;
        if (oa !== ob) return oa - ob;
        return a.staleSec - b.staleSec;
      });
      res.end(
        JSON.stringify(
          {
            timestamp: isoTs(),
            summary: state.lastSummary || {},
            conversations: all,
            stuckList: state.lastStuckList || [], // v10+: 含 no_pb + dead 条目供前端展示
            sessionCacheSize: sessionCache.size,
            pid: process.pid,
            uptime: Math.round(process.uptime()),
          },
          null,
          2,
        ),
      );
      return;
    }
    if (url === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          pid: process.pid,
          version: "v9.2",
          uptime: Math.round(process.uptime()),
        }),
      );
      return;
    }
    if (url === "/api/notify-test") {
      // 测试通知通道
      notify(
        "critical",
        "test",
        "道·通知测试",
        `如果你看到这条消息，通知通道正常\n时间: ${new Date().toLocaleTimeString("zh-CN")}`,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "Notification sent" }));
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(fullDashboardHtml());
  });
  let portRetries = 0;
  server.listen(CFG.port, "127.0.0.1", () => {
    log(`DASHBOARD http://127.0.0.1:${CFG.port}`);
  });
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE" && portRetries < 1) {
      portRetries++;
      const alt = CFG.port + 1;
      log(`PORT ${CFG.port} in use, trying ${alt}`);
      server.listen(alt, "127.0.0.1");
    } else if (e.code === "EADDRINUSE") {
      log(`PORT ${CFG.port}/${CFG.port + 1} both in use, dashboard disabled`);
    } else {
      log(`HTTP_ERR ${e.message}`);
    }
  });
  return server;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════════════════════
// ─── Hub 总线写入 (v3.3.0 · 三界归一 · 卅辐同一毂) ───
// 写 stuck 字段到 ~/.wam/_hub.json · WAM extension 读取呈现
// read-modify-write: 先读已有 hub (可能含 backup 字段) · 合并 stuck 字段 · 写回
const HUB_DIR = path.join(os.homedir(), ".wam");
const HUB_PATH = path.join(HUB_DIR, "_hub.json");

function _writeHub(stuckData) {
  try {
    ensureDir(HUB_DIR);
    let hub = {};
    try {
      hub = JSON.parse(fs.readFileSync(HUB_PATH, "utf8"));
    } catch {}
    hub.stuck = stuckData;
    // v12.5: atomic write (tmp+rename) — 防 extension 读到半写 JSON (道法自然·大制无割)
    const _tmp = HUB_PATH + "." + process.pid + ".tmp";
    fs.writeFileSync(_tmp, JSON.stringify(hub, null, 2));
    try {
      fs.renameSync(_tmp, HUB_PATH);
    } catch {
      try {
        fs.copyFileSync(_tmp, HUB_PATH);
      } catch {}
      try {
        fs.unlinkSync(_tmp);
      } catch {}
    }
  } catch {}
}

function _buildHubCurrent() {
  // 找出当前最活跃对话 (streaming 且最近增长的)
  // v3.11.3: 不再被 title 过滤 (与 streamingList 同构) · title 缺失时兜底「对话 #短UUID」
  const entries = Object.values(state.conversations);
  const _fallbackTitle = (uuid, title, cache) =>
    _displayTitleFor(uuid, title, cache) ||
    "对话 #" + String(uuid).replace(/-/g, "").slice(0, 8);
  // 优先找 streaming (正常活跃)
  const streaming = entries
    .filter((e) => e.state === "streaming")
    .sort((a, b) => b.lastGrowth - a.lastGrowth);
  if (streaming.length > 0) {
    const e = streaming[0];
    return {
      uuid: e.uuid,
      title: _fallbackTitle(e.uuid, e.title, _backupTitleCache[e.uuid]),
      phase: "streaming",
      staleSec: Math.round((nowMs() - e.lastGrowth) / 1000),
      sizeKB: Math.round((e.size || 0) / 1024),
    };
  }
  // 其次找 completed
  const completed = entries
    .filter((e) => e.state === "completed")
    .sort((a, b) => b.mtime - a.mtime);
  if (completed.length > 0) {
    const e = completed[0];
    return {
      uuid: e.uuid,
      title: _fallbackTitle(e.uuid, e.title, _backupTitleCache[e.uuid]),
      phase: "completed",
      staleSec: 0,
      sizeKB: Math.round((e.size || 0) / 1024),
    };
  }
  return null;
}

function writeHeartbeat(extra) {
  try {
    fs.writeFileSync(
      HB_FILE,
      JSON.stringify({
        timestamp: isoTs(),
        pid: process.pid,
        state: "running",
        version: "v9.1",
        port: CFG.port,
        ...extra,
      }),
    );
  } catch {}
  // 同步写 Hub 总线 (供 WAM extension 读取)
  try {
    // ═══ v15.0 全量对话失明根治 · 道法自然 · 知人者知也 自知者明也 ═══
    //
    // ★ 用户截图实证根因 (2026-05-28):
    //   stuck_state_v9.json 中 7 条 state=streaming · 但 hub.json 仅 4 条
    //   失明 3 条: 32f941bf "Windsurf Rate Limit Refinement" (50min前) + ...
    //   该对话仍 vscdb=active 但 .pb 长时间无增长 → 用户感觉卡住 · 需要提醒
    //   旧 v14.0 逻辑: `_recentWindowMs` 5min 硬过滤 → state=streaming 但 stale>5min 的全消失
    //
    // ★ 五大失明根因体系性盘点 (反者道之动·彻底审视):
    //   ① _recentWindowMs 5min 硬过滤 → state=streaming 但 stale>5min 完全失明 (主因·本次治)
    //   ② NO_PB 对话只进 stuckList · 不进 streamingList → 用户感知失明 (次因·本次治)
    //   ③ state.conversations cleanup 过激 → .pb 临时锁/重建时被即时删除 (边角·暂不治)
    //   ④ state="old" 转换不可逆 → ignoreAge(1h) 后即使重新活跃也卡 old (边角·暂不治)
    //   ⑤ USER_PROMPT_DETECT 30s 阈值 → <30s 内连续发消息 entry 状态保留旧值 (边角·暂不治)
    //
    // ★ 治法三层 (修复 ①②③):
    //   ① 5min 硬过滤 → 30min 软窗口 (streamStaleMaxMs)·30min 内的 streaming 都保留
    //   ② 加 _isStale 字段 (lastGrowth > _streamFreshMs) → UI 区分新鲜/陈旧
    //   ③ NO_PB 对话也进 streamingList (state="no_pb")·用户能看到「未生成 .pb」
    //
    // ★ 道义: 名可名也·非恒名也 — 5min 不是恒定真理 · 30min 软窗才合用户场景
    //         知不知尚矣 — 引擎已知 state=streaming · 就不该再用时间窗口隐藏
    const _now13 = nowMs();
    // 软编码: --stream-fresh-ms (默 60000=1min) · 区分新鲜流式
    const _streamFreshMs = Math.max(10000, +CFG.streamFreshMs || 60000);
    // v15.0 · streamStaleMaxMs: 真"死透"剔除阈值 · 默 30min · 0=永不剔除 (软编码 wam.streamStaleMaxSec)
    const _streamStaleMaxMs = Math.max(
      0,
      (+CFG.streamStaleMaxSec || 1800) * 1000,
    );
    // _titleFor: 优先真实 title · 缺失时 →「对话 #短UUID」兜底 (止跳·止隐身·无为而无不为)
    const _titleFor = (uuid, title, cache) =>
      _displayTitleFor(uuid, title, cache) ||
      "对话 #" + String(uuid).replace(/-/g, "").slice(0, 8);
    // v15.0 · 全量 streaming 对话 (不再 5min 硬过滤 · 30min 软剔除)
    const _allStreamingConvs = Object.values(state.conversations)
      .filter((e) => {
        if (e.state !== "streaming") return false;
        // 软窗口: > 30min 没增长 → 视为死透剔除 (0=永不剔除)
        if (_streamStaleMaxMs > 0 && _now13 - e.lastGrowth > _streamStaleMaxMs)
          return false;
        return true;
      })
      .sort((a, b) => b.lastGrowth - a.lastGrowth);
    // 真正流式计数: 不含等待用户回复 + 新鲜 (< _streamFreshMs)
    const _trueStreamingCount = _allStreamingConvs.filter(
      (e) => !e._awaitingUser && _now13 - e.lastGrowth < _streamFreshMs,
    ).length;
    // v15.0 修复② · NO_PB 对话也进 streamingList (state="no_pb")
    //   旧逻辑: NO_PB 仅入 stuckList → 状态栏「对话 流式 N」不含它 → 用户失明
    //   新逻辑: 同时入 streamingList (state="no_pb") → UI 显示「未生成 .pb」标签
    const _noPbList = (extra.stuckList || [])
      .filter((s) => s.level === "NO_PB")
      .map((s) => ({
        uuid: s.uuid,
        shortId: s.shortId,
        title: _titleFor(s.uuid, s.title, _backupTitleCache[s.uuid]),
        sizeKB: 0,
        staleSec: s.staleSec || 0,
        isAwaitingUser: false,
        state: "no_pb", // 新状态: vscdb=active 但无 .pb 文件
        _isStale: true,
        _noPb: true,
      }));
    // v14.0 根治②: _visibleStuckList 用 UUID 兜底 · 杜绝因无标题而隐身
    //   旧逻辑: _displayTitleFor 失败 → return null → 过滤 → 卡死对话完全消失
    //   新逻辑: 无真实标题 → "对话 #短UUID" 兜底 → 始终可见 · 用户至少看到UUID
    const _visibleStuckList = (extra.stuckList || [])
      .map((s) => {
        const t =
          _displayTitleFor(s.uuid, s.title, _backupTitleCache[s.uuid]) ||
          (s.uuid
            ? "对话 #" + String(s.uuid).replace(/-/g, "").slice(0, 8)
            : "");
        if (!t) return null;
        return {
          uuid: s.uuid,
          shortId: s.shortId,
          title: t,
          staleSec: s.staleSec,
          level: s.level,
          vscdbStatus: s.vscdbStatus,
          sizeKB: Math.round((s.size || 0) / 1024),
        };
      })
      .filter(Boolean)
      .slice(0, 20);
    // v15.0 · streamingList 三源合并: 新鲜 streaming + 陈旧 streaming + NO_PB
    //   每条均带 _isStale 字段 · UI 据此区分新鲜 (绿) / 陈旧 (黄·停滞) / NO_PB (灰·未生成)
    const _streamingListMerged = [
      ..._allStreamingConvs.map((e) => ({
        uuid: e.uuid,
        shortId: shortId(e.uuid),
        title: _titleFor(e.uuid, e.title, _backupTitleCache[e.uuid]),
        sizeKB: Math.round((e.size || 0) / 1024),
        staleSec: Math.round((_now13 - e.lastGrowth) / 1000),
        isAwaitingUser: e._awaitingUser || false,
        state: e.state,
        // v15.0 · 关键字段: 距上次 .pb 增长 > _streamFreshMs (默 1min) → 陈旧 → UI 黄
        _isStale: _now13 - e.lastGrowth > _streamFreshMs,
      })),
      ..._noPbList,
    ];
    const hubData = {
      ts: _now13,
      pid: process.pid,
      // v15.0: 全量计数 — streaming + 陈旧 + NO_PB 全包 · stuck 不重复计数
      active:
        _streamingListMerged.length +
        _visibleStuckList.filter(
          (s) => s.level !== "DEAD" && s.level !== "NO_PB",
        ).length,
      streaming: _trueStreamingCount,
      // v13.1 保留: Hub 计数与可见列表同源
      stuck: _visibleStuckList.filter((s) => s.level !== "DEAD").length,
      error: _visibleStuckList.filter((s) => s.level === "DEAD").length,
      stuckList: _visibleStuckList,
      current: _buildHubCurrent(),
      streamingList: _streamingListMerged,
    };
    _writeHub(hubData);
  } catch {}
}

function main() {
  ensureDir(LOG_DIR);
  ensureDir(SIG_DIR);

  // v3.11.2 · single-instance 闸门 — 多 Windsurf 窗口共存时只跑一份引擎
  //   根因: 旧逻辑每窗口都 spawn 引擎 → N 进程并发 read-modify-write _hub.json
  //         → conv 区数据 0↔1 弹来弹去 / stuckList 闪烁 / 通知重复
  //   治法: PID_FILE 存在且 pid 活 → 当前进程 exit 0 (不报错·让出位)
  //         上家进程退出后由 extension.js 重启逻辑接管
  //   道: 「上善若水·处众人之所恶」· 已有人在则让位
  //
  // v3.11.3 · 增强 · 端口锁原子化 + 软编码 ageMs (90s 硬编码 → CFG.singletonAgeMs)
  //   双保险:
  //     第一保险: PID_FILE + pid 活性 + age 窗口 (旧法兼容)
  //     第二保险: net.createServer().listen(CFG.port) — 端口被占必让位 (原子·无竞态)
  //   优先用第二保险 (端口绑定是 OS 级原子操作 · 无文件竞态)
  const _singletonAgeMs = Math.max(30000, +CFG.singletonAgeMs || 90000);
  try {
    if (fs.existsSync(PID_FILE)) {
      const _oldPidStr = fs.readFileSync(PID_FILE, "utf8").trim();
      const _oldPid = parseInt(_oldPidStr, 10);
      if (Number.isFinite(_oldPid) && _oldPid > 0 && _oldPid !== process.pid) {
        let _alive = false;
        try {
          // process.kill(pid, 0) 在 Windows/POSIX 上都用作探活 (不发信号)
          process.kill(_oldPid, 0);
          _alive = true;
        } catch (e) {
          // ESRCH = 不存在 · EPERM = 存在但无权限(也算活) · 其它视为不活
          _alive = e && e.code === "EPERM";
        }
        if (_alive) {
          // 另判: PID_FILE 写入时间在 ageMs 内 (防 PID 回收误判) · 软编码
          try {
            const _st = fs.statSync(PID_FILE);
            const _ageMs = Date.now() - _st.mtimeMs;
            if (_ageMs < _singletonAgeMs) {
              console.log(
                `[single-instance] dao_stuck v13.x 已在 pid=${_oldPid} 运行 (age=${Math.round(_ageMs / 1000)}s · 窗 ${Math.round(_singletonAgeMs / 1000)}s) · 本进程 ${process.pid} 让位退出`,
              );
              process.exit(0);
            }
          } catch {}
        }
      }
    }
  } catch (e) {
    // 闸门失败不阻塞启动 · 道法自然 · 兜不住就让它跑
  }

  // 验证 .pb 目录
  if (!fs.existsSync(PB_DIR)) {
    console.error(`FATAL: .pb 目录不存在: ${PB_DIR}`);
    process.exit(1);
  }

  // 验证 vscdb
  if (!fs.existsSync(VSCDB)) {
    log(`WARN: vscdb 不存在: ${VSCDB} (将仅依赖 .pb 文件)`);
  }

  if (!Database) {
    log(`WARN: better-sqlite3 不可用 (将仅依赖 .pb 文件跟踪, 无标题/状态信息)`);
  }

  // v13.0: 启动时预加载备份标题缓存 (补充vscdb缺失标题)
  _loadBackupTitles();

  try {
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch {}
  // v3.11.2 · PID 心跳 — 定期 touch PID_FILE 让 mtime 更新
  //   配合 single-instance ageMs 老化窗口 · 让接班者能在窗口外看出本进程已死
  // v3.11.3 · 软编码 — CFG.heartbeatMs (默 30000) · 应小于 singletonAgeMs/3
  const _heartbeatMs = Math.max(5000, +CFG.heartbeatMs || 30000);
  try {
    setInterval(() => {
      try {
        fs.writeFileSync(PID_FILE, String(process.pid));
      } catch {}
    }, _heartbeatMs).unref();
  } catch {}
  // v3.11.2 · 退出清理 — 正常退出删 PID_FILE · 让接班者立即上位
  const _cleanupPid = () => {
    try {
      const cur = fs.readFileSync(PID_FILE, "utf8").trim();
      if (parseInt(cur, 10) === process.pid) fs.unlinkSync(PID_FILE);
    } catch {}
  };
  process.on("exit", _cleanupPid);
  process.on("SIGINT", _cleanupPid);
  process.on("SIGTERM", _cleanupPid);
  log(
    `START v13.0 warn=${CFG.warnThreshold}s crit=${CFG.critThreshold}s initial_grace=${INITIAL_SEND_GRACE / 1000}s awaiting_user_threshold=${AWAITING_USER_THRESHOLD}B ignore_age=${CFG.ignoreAge}s dead_expire=${DEAD_EXPIRE_MS / 60000}min poll=${CFG.poll}s port=${CFG.port} pid=${process.pid} user_prompt_idle=30s`,
  );
  log(`SOURCE1: ${VSCDB} (${Database ? "OK" : "NO better-sqlite3"})`);
  log(`SOURCE2: ${PB_DIR}`);

  if (CFG.once) {
    const r = scan();
    if (r) {
      console.log("");
      console.log(
        `扫描结果: active=${r.summary.active} streaming=${r.summary.streaming} stuck=${r.summary.stuck} end_turn=${r.summary.endTurn} error=${r.summary.error}`,
      );
      console.log(
        `数据源: vscdb=${r.summary.totalSessions}sessions .pb=${r.summary.totalPb}files`,
      );
      console.log(
        `阈值: WARNING>${CFG.warnThreshold}s CRITICAL>${CFG.critThreshold}s`,
      );
      if (r.stuckList.length) {
        console.log("");
        console.log("异常对话:");
        r.stuckList.forEach((s) =>
          console.log(
            `  [${s.level}] [${s.staleMin}min] ${s.title || s.shortId} (${s.shortId}) vscdb=${s.vscdbStatus}`,
          ),
        );
      } else {
        console.log("✓ 当前无异常");
      }
    }
    return;
  }

  const server = startHttpServer();

  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    const r = scan();
    if (r) {
      writeHeartbeat({
        tick,
        active: r.summary.active,
        activeTotal: r.summary.activeTotal,
        streaming: r.summary.streaming,
        stuck: r.summary.stuck,
        endTurn: r.summary.endTurn,
        error: r.summary.error,
        totalPb: r.summary.totalPb,
        totalSessions: r.summary.totalSessions,
        stuckList: r.stuckList.slice(0, 10),
        uptime: tick * CFG.poll,
      });
      if (tick % Math.max(1, Math.round(60 / CFG.poll)) === 0) {
        log(
          `STATUS active=${r.summary.active} streaming=${r.summary.streaming} stuck=${r.summary.stuck} end_turn=${r.summary.endTurn} error=${r.summary.error} pb=${r.summary.totalPb} sessions=${r.summary.totalSessions}`,
        );
      }
    }
  }, CFG.poll * 1000);

  const stop = (sig) => {
    log(`STOP ${sig}`);
    clearInterval(timer);
    server.close();
    writeHeartbeat({ state: "stopped" });
    process.exit(0);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  // 启动时立即扫描
  const r = scan();
  if (r) {
    writeHeartbeat({
      tick: 0,
      active: r.summary.active,
      activeTotal: r.summary.activeTotal,
      streaming: r.summary.streaming,
      stuck: r.summary.stuck,
      endTurn: r.summary.endTurn,
      error: r.summary.error,
      totalPb: r.summary.totalPb,
      totalSessions: r.summary.totalSessions,
      stuckList: r.stuckList.slice(0, 10),
      uptime: 0,
    });
    log(
      `READY active=${r.summary.active} streaming=${r.summary.streaming} stuck=${r.summary.stuck} end_turn=${r.summary.endTurn} error=${r.summary.error}`,
    );
    if (r.stuckList.length) {
      log(`INITIAL_STUCK count=${r.stuckList.length}`);
      r.stuckList.forEach((s) =>
        log(
          `  STUCK [${s.staleMin}min] ${shortTitle(s.title || s.shortId)} (${s.shortId}) vscdb=${s.vscdbStatus}`,
        ),
      );
      if (CFG.toast) {
        // v11.2: 检查持久化cooldown，重启后5分钟内不重复发送初始通知
        // lastNotify 已存入 STATE_FILE，重启后 loadState() 恢复
        const needNotify = r.stuckList.filter((s) => {
          const ent = state.conversations[s.uuid];
          return (
            !ent ||
            !ent.lastNotify ||
            nowMs() - ent.lastNotify > CFG.cooldown * 1000
          );
        });
        if (needNotify.length > 0) {
          const top3 = needNotify
            .slice(0, 3)
            .map(
              (s) => `[${s.staleMin}min] ${shortTitle(s.title || s.shortId)}`,
            )
            .join("\n");
          notify(
            "critical",
            "initial",
            `道·发现 ${needNotify.length} 个异常对话`,
            top3,
          );
        } else {
          log(
            `INITIAL_STUCK cooldown=${Math.round((nowMs() - (state.conversations[r.stuckList[0].uuid]?.lastNotify || 0)) / 1000)}s → skip notify`,
          );
        }
      }
    }
  }
}

main();
