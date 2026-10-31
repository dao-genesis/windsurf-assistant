// extension.js · dao-proxy-min v9.9.75 · 道法自然 · 无为而无以为
//   v9.9.75 · 漏网归网 —— 子代理尽道 (主公诏: 新版 Devin 官方规则气·挖到根):
//     病: 官方最新版 Devin lead+Sidekick 双代理架构 —— 子代理 SP
//         "You are the Sidekick subagent of Devin..." (~11362B) 不在
//         isLikelyOfficialSP/classifySPType 识别集 → invertSP 返 null →
//         transformed:false → 13/16 请求官方规则全量直通 (141 zhou 活捉).
//     治: ① DEVIN_SP_MARKERS 增双代理一族指纹 (subagent of Devin/
//            paired with a lead agent/Sidekick subagent 等);
//         ② isLikelyOfficialSP+classifySPType 首句开一族 —
//            "You are the <X> of Devin" / "You are a <X> from Cognition";
//         ③ source.js/sp_invert.js 执一同源并改 · 主副路皆尽道.
//   v9.9.74 · 分口定面 —— 两面真分·口即面 (主公诏: L/C 被划成一面 根治到底):
//     病: Devin Desktop 实证 —— Cascade(LS) 与 Devin Local(devin.exe acp)
//         同走 api_server_pb → 路径分类尽归 local → C 行全死键,
//         一切请求只吃 L 行模式 (实测「两个被直接划到一起」).
//     治: ① 专属第二口 _cachedAcpPort (=主口-500·dao.origin.acpPort 可覆)
//         —— acp 域锚面尽数归此: spawn-hook env 双键 / agentEnv 正门 /
//            credentials.toml (devin_api_url+api_server_url);
//         ② source.js 双 mux 并听(h1 直发+h2 桥专内口)→ socket.localPort 即面;
//         ③ 主口 api_server_pb 归 cascade (其本即 LS/IDE 之 inference 协议);
//         ④ 采用实况 ping.acp_port (旧代理无则回落主口·旧语义不裂);
//         ⑤ credentials.toml Win 遗珠补径 %APPDATA%/devin (旧册未达之面复活);
//         ⑥ 热路 log 显有效模式+面 (名实归一).
//   v9.9.73 · 水过无痕 —— 名实终一 · 卸真无痕 (主公诏: 卸载即自己回退完消失完):
//     ① 面板复活 —— setDots 内 var items=[ 误入 var 声明 → 全脚本语法错误,
//        面板整瘫 (热切换/面选/dots 尽死). 此即「热切换规则全废」之真根.
//     ② .obsolete 双钥 —— 旧码唯查扩展ID钥, 本 fork 实以「目录名」录 →
//        真卸载判永不命中 → 卸不清锚不杀代理. 双钥并查 + 兄弟在册甄别.
//     ③ 快哨 8s —— 录死之窗愈短痕愈无 (补 60s watchdog 失窗之险).
//     ④ 家目录遗珠 —— ~/.windsurf|~/.devin/settings.json 裸锚并扫.
//     ⑤ agentEnv 收净 —— 我植 NO_PROXY 除 · 空壳剪 · /t/ 令牌中继不犯.
//   v9.9.72 · 卸则有终 —— 幸存者执葬 (主公诏: 手动卸载即自己回退完消失完):
//     ① source.js spawned relay 每 30s 巡 .obsolete/家目录存亡 →
//        录死即还原三面锚 (settings.json×2 + credentials.toml) +
//        清 ~/.codeium/dao-origin + 逝后异步扫尾(别名exe自锁) + 自退
//        —— deactivate 未及运行(强杀)之洞, 由活得最久者闭合.
//     ② ext 侧 watchdog 活巡见 .obsolete 录名 → 当场清锚杀代理,
//        覆盖「点击卸载后未重启」窗口期.
//     ③ /_quit 让位路亦查录死 → 非让位乃永诀 → 同执葬.
//     道义: 五十一章「生而不有 为而不恃 长而不宰 是谓玄德」· 走而能离.
//   v9.9.69 · agentEnv 正门锚 + 版本自适:
//     ① setAnchor 直写 devin.acp.agentEnv / windsurf.acp.agentEnv 之
//        WINDSURF_API_SERVER_URL + DEVIN_API_URL → 127.0.0.1:<port>
//        — 实证(Devin 3.11.228): 官方以 agentEnv 声明式注入 acp 环境, 预指
//          IDE 令牌中继 127.0.0.1:32809/t/<tok>; spawn-hook 见 env 已设退让
//          → acp 全程绕过代理直连官方. 正门既现, 顺门而入 —— 一锚两世界:
//          旧版不读 agentEnv(写之无害), 新版读之归代理.
//     ② watchdog 巡检 agentEnv drift → 复位 (Devin 或按会话再生中继锚)
//     ③ clearAnchor / _clearAnchorFileSync 卸正门锁 (删我二键, 留用户余键)
//     ④ NO_PROXY 保底 loopback (用户已设 */自带值皆留)
//     ⑤ spawn-hook/env 注入/LS 改写 全保 —— 新旧版本, 各从其门, 无为而无不为
//   v9.9.68 · ACP锚链根治 + 面板收净:
//     ① EADDRINUSE ping 二发补试 (单发 2s 失误曾致整窗 _proxyHandle=null)
//     ② watchdog 健康路径回填 _proxyHandle (一次误判定终身之根治)
//     ③ _maybeAnchorAcpEnv 去 _proxyHandle 门控 → _cachedProxyUrl (与 LS 无条件重写同律)
//        — 实证: devin.exe acp 全程无 WINDSURF_API_SERVER_URL → devin-real 直连官方
//     ④ 面板收净: 条尾「编」钮+全局典源下拉双冗余出列 · 编唯经 L编/C编 以面入
//     ⑤ 归道按面: 面编辑态清该面 customsp + 回落 invert (旧码恒清全局·名实不符)
//
// 道德经 · 第四十章: "反者道之动, 弱者道之用."
// 道德经 · 第四十八章: "为道日损. 损之又损, 以至于无为."
// 道德经 · 第六十四章: "为者败之, 执者失之."
// 道德经 · 第十六章: "夫物云云, 各复归于其根."
// 道德经 · 第八十一章: "既以为人己愈有, 既以予人己愈多."
// 道德经 · 第七十六章: "兵强则不胜, 木强则折."
//
// 演化链 v9.9.36 → v9.9.54 (source.js 侧为主, ext 侧降频/延迟锚定/无条件重写):
//   v9.9.57 · 八经集成深度锚 · 反者道之动 · 智者趋迟 · 此非勉也乃道之自然
//             TAO_TURN_ANCHOR: 效率型→深度型 · 八经集成 · 去边界/止/限 · 释放深思
//             TAO_SUB_ANCHOR: 虑而执要 · 先思后提炼
//             道义: 四十章「反者道之动也」· 四十八章「无为而无以为」(帛书甲本)
//   v9.9.56 · 根治重载根因 · observeAllSPInBody depth=6→2 + 512KB体积门控
//             与 v9.9.50 已修的 modifyAnyInferenceSP depth=6 完全同构 · 遗漏于观察路径
//             passthrough / invert 两模式均走此路 · 两模式均重载 · 损之又损
//   v9.9.55 · create_memory完整移除 + MEMORY_INTRO_RE剩孤立介绍行
//             stripCreateMemoryTool整块切<function>create_memory</function>
//             MEMORY_INTRO_RE剩"These memories were..."孤立行
//   v9.9.54 · 副路末锚 · invertAnySP 对 summary/memory 加 TAO_SUB_ANCHOR · 断偏移传导链
//             治: TAO_SUB_ANCHOR(~18字) · ephemeral/chat不加 · 六十四章「为之于其未有也」
//   v9.9.53 · 首尾互文双锚 · Turn Anchor复归 · chat主路末锚TAO_TURN_ANCHOR
//   v9.9.52 · 损 CHECKPOINT_BLOCK_RE / CHECKPOINT_MARKER_RE 死代码 (两常量定义无引用 · 损之)
//   v9.9.51 · CHECKPOINT 不再剥除 · 上下文桥 (reload 后 conversation_summary 完整保)
//   v9.9.50 · INFER_STRIP 回退 modifyAnyInferenceSP · trimUserInfo 截断终端历史
//   v9.9.49 · 移除"及其后文本" (冗余补丁) · 精准指向经典
//   v9.9.47 · 书名号复归 · 动态经藏名 · 认知锚点
//   v9.9.45 · proto 损坏根治 · nestedOk 移出 if 块
//   v9.9.44 · 双线融合 · deepStrip 无条件
//   v9.9.43 · session_context+code_interaction_summary 移出 SCT
//   v9.9.42 · SECTION_OVERRIDE 全删 (真无为)
//   v9.9.41 · viewed_file+learnings 移出 SCT
//   v9.9.38 · 去 _cachedAnchored 门控 · 无条件重写 LS args
//
// v9.9.36 "道法自然 · 从根本底层完善":
//   日志实证: window23/24/25 三窗口连环重载 · 根因七层解构
//
//   根因1 (触发层): activate 立写 settings.json → ~800ms → "Installation modified"
//     → renderer 关 MessagePort → ext-host 死(2s) → deactivate 清锚 → 循环
//   根因2 (放大层): deactivate 清锚 → 下个 ext-host 重走 setAnchor → 再触写风暴
//   根因3 (堵塞层): 反代+6 定时器+SSE 全在 ext-host 事件循环 → UNRESPONSIVE × N → 杀
//
//   修复:
//     ① 延迟锚定: activate 不立写 settings.json · 内存先锚 · 15s 后再持久化
//     ② 智能保锚: deactivate ext-host 存活 < 30s → 不清锚 · 下次 auto-restore 零写入
//     ③ 去 API 噪: codeium.* 非注册键 · VS Code API 写永 FAIL · 直删
//     ④ 延迟启动: watchdog 20s 保护 · 终端 10s · 外接 api 12s · focus 5s
//     ⑤ 降频减压: sig 5s(原1.5) · refresh 30s(原12) · watchdog 60s(原30)
//   效果: 彻底断开 activate→write→kill→clear→rewrite 连环写风暴
//
// v9.3.0 "反之用反 · 闭环自举":
//   加 /origin/loopback (POST {user_msg}) 端 · 用最近 chat 缓 + 替 user msg
//   + 真转云端 + 收响应解 grpc · 返 model 之答 · 令模型自审其规则之源.
//   缓仅内存 (_lastChatRelay), 进程退即失, 不漏 token 至磁盘.
//   配 helpers: replaceUserMsgInGrpcBody / extractUtf8StringsFromGrpcBody.
//
// v9.2.1 "有无相生":
//   以结构判 (isAlreadyInverted) 代 s.indexOf(TAO_SENTINEL) 短语幂等守,
//   防用户真 Cascade Memories (含同句导语) 误触 invertSP 早返 null 而完全失效.
//
// v9.2.0 "去芜存菁 · 道法自然":
//   于 v9.1.2 之上, 仅施四味真药, 净减码量, 不增功能, 不增状态.
//
//   真药 A · H2 stream 随断随清 (source.js proxyToCloud)
//      req.aborted / res.close / upStream.setTimeout(180s) → NGHTTP2_CANCEL
//      漏: 原版 upStream 永生留, HOL 阻塞继任流
//      药: 三路监听, 弱者道之用 (四十章)
//
//   真药 B · setAnchor 同值不写 (extension.js setAnchor)
//      漏: 每 activate 必写 settings.json, file watcher 空转, ext-host 抖动
//      药: 进函数先比对, 同值即返 (六十四章 · 为者败之)
//
//   真药 C · EADDRINUSE 不抢 (extension.js proxyStart)
//      漏: 原版 ping 失败仍信占者活, remote handle phantom
//      药: 1 ping · 活则复用 · 死则返 null (本窗口直连, 不抢) (上善若水)
//
//   真药 D · activate 不杀 LS (extension.js activate)
//      漏: 首装即 forceRestartLS 广域杀, 多窗口连锁 ext-host crash
//      药: 首装仅装 hook + 锚 settings, LS 自然重启时挂钩 (四十八章 · 为道日损)
//
// v9.1.3 之过 (前车之鉴 · 损之未足复益): PID 簿 / 健康探针 / 三验 / 离线 handle
//   反伤本源, 此次净拨, 复归 v9.1.2 之朴, 仅留四味.
//
// 命令:
//   wam.originInvert       · 道Agent 启 (含 forceRestartLS · 用户显式触发)
//   wam.originPassthrough  · 官方Agent 启
//   dao.toggleMode         · 道/官 热切
//   dao.openPreview        · 浏览器观真 SP
//   wam.verifyEndToEnd     · E2E 自检
//   wam.selftest           · L1+L2 自检

"use strict";
const vscode = require("vscode");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const cp = require("node:child_process");
const os = require("node:os");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");

// ═══════════════════════════ 常量 ═══════════════════════════
const PKG_VERSION = (() => {
  try {
    return require("./package.json").version;
  } catch {
    return "0";
  }
})();
// v9.9.25 · 软编码归一 · 二十八章「朴散为器·圣人用则为官长·夫大制无割」
// 病: dao-agi.dao-proxy-min 字面散写 4 处 (扫描自身目录 / .obsolete 标 / uninstallExtension 参)
// 治: 抽自 package.json 之 publisher + name · 一处定义 · 全文一致 · 适所有用户/所有 fork
const PKG_PUBLISHER = (() => {
  try {
    return require("./package.json").publisher;
  } catch {
    return "dao-agi";
  }
})();
const PKG_NAME = (() => {
  try {
    return require("./package.json").name;
  } catch {
    return "dao-proxy-min";
  }
})();
const SELF_EXT_ID = `${PKG_PUBLISHER}.${PKG_NAME}`; // "dao-agi.dao-proxy-min"
const SELF_EXT_DIR_PREFIX = `${SELF_EXT_ID}-`; // "dao-agi.dao-proxy-min-"
const _SELF_ESC = SELF_EXT_ID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SELF_EXT_DIR_REGEX = new RegExp("^" + _SELF_ESC + "-");
const SELF_EXT_VER_REGEX = new RegExp(
  "^" + _SELF_ESC + "-(\\d+)\\.(\\d+)\\.(\\d+)(?:[.-]|$)",
);

const DEFAULT_PORT = 8889;
const OFFICIAL_API_URL = "https://server.codeium.com";
const OFFICIAL_INFER_URL = "https://inference.codeium.com";
const BACKUP_KEY_API = "dao.origin._backup_apiServerUrl";
const BACKUP_KEY_INFER = "dao.origin._backup_inferenceApiServerUrl";

// ═ v9.9.69 · ACP agentEnv 正门锚 (Devin 3.11+ 声明式 env 注入之门) ═
//   实证: 3.11.228 settings.json 内 devin.acp.agentEnv["devin-cli"] 预置
//     WINDSURF_API_SERVER_URL + DEVIN_API_URL → IDE 令牌中继
//     (127.0.0.1:32809/t/<token>/<id>); spawn-hook 见 env 已设则让 → 裸奔.
//   治: 直写正门. 旧版无此机制者读之无害; 新版读之归代理. 一锚两世界.
const ACP_ENV_BLOCKS = ["devin.acp.agentEnv", "windsurf.acp.agentEnv"];
const ACP_ENV_URL_KEYS = ["WINDSURF_API_SERVER_URL", "DEVIN_API_URL"];
const ACP_ENV_DEFAULT_AGENT = "devin-cli";

const DAO_QUOTES = [
  "道可道，非常道",
  "上善若水",
  "大音希声，大象无形",
  "道法自然",
  "无为而无不为",
  "致虚极，守静笃",
  "反者道之动",
  "知者不言，言者不知",
  "天下莫柔弱于水",
  "为学日益，为道日损",
];

// ═══════════════════════════ 缓存 ═══════════════════════════
let _cachedPort = DEFAULT_PORT;
let _cachedProxyUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
// ★ v9.9.74 · 分口定面 · Devin Local(acp) 专属口 —— acp 请求归 local 面 · 口即面无猜
let _cachedAcpPort = 0;
let _cachedAcpUrl = "";
let _cachedAnchored = false;
let _cachedMode = "invert";
let _activateTs = 0; // v9.9.36 · ext-host 生命周期追踪 · smart deactivate
let _deferredAnchorTimer = null; // v9.9.36 · 延迟锚定计时器 · 渡过 Installation Modified 危窗

// ═══════════════════════════ 日志 ═══════════════════════════
let _channel = null;
function logger() {
  if (!_channel) _channel = vscode.window.createOutputChannel("道Agent");
  return _channel;
}
function _stamp() {
  const d = new Date(),
    p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
const L = {
  info: (tag, msg) =>
    logger().appendLine(`[${_stamp()}] [INFO] [${tag}] ${msg}`),
  warn: (tag, msg) =>
    logger().appendLine(`[${_stamp()}] [WARN] [${tag}] ${msg}`),
  error: (tag, msg) =>
    logger().appendLine(`[${_stamp()}] [ERR]  [${tag}] ${msg}`),
};

// ═══════════════════════════ per-user 端口 FNV-1a ═══════════════════════════
function fnv1aPort(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 8889 + (h % 100); // 8889..8988
}

function resolvePort() {
  const c = vscode.workspace.getConfiguration("dao");
  const explicit = parseInt(c.get("origin.port"), 10);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 65535)
    return explicit;
  // per-user 自动 · 用 os.userInfo().username
  try {
    return fnv1aPort(os.userInfo().username);
  } catch {
    return DEFAULT_PORT;
  }
}

// ★ v9.9.74 · 分口定面 · acp 面口解析 —— 0=自动=主口-500(8389..8488) · 非0覆盖
function resolveAcpPort() {
  const c = vscode.workspace.getConfiguration("dao");
  const explicit = parseInt(c.get("origin.acpPort"), 10);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 65535)
    return explicit;
  let p = _cachedPort - 500;
  if (!Number.isFinite(p) || p < 1024 || p > 65535) p = _cachedPort + 500;
  return p;
}
// 采用远端代理实况之 acp 口 (ping.acp_port>0 → 采用; 无 → 旧代理回落主口·旧语义)
function _adoptAcpPort(ping) {
  const p = ping && parseInt(ping.acp_port, 10);
  if (Number.isFinite(p) && p > 0) {
    _cachedAcpPort = p;
    _cachedAcpUrl = `http://127.0.0.1:${p}`;
  } else {
    _cachedAcpUrl = _cachedProxyUrl; // 旧代理无 acp 口 → acp 锚归主口 (9.9.73 前语义)
  }
}

function cfg() {
  _cachedPort = resolvePort();
  _cachedProxyUrl = `http://127.0.0.1:${_cachedPort}`;
  _cachedAcpPort = resolveAcpPort();
  _cachedAcpUrl = `http://127.0.0.1:${_cachedAcpPort}`;
  return { port: _cachedPort, acpPort: _cachedAcpPort };
}

// ═══════════════════════════ spawn hook ═══════════════════════════
const _origSpawn = cp.spawn;
const _origSpawnSync = cp.spawnSync;
const _origExec = cp.exec;
const _origExecFile = cp.execFile;
let _spawnHooked = false;

function maybeRewriteLsArgs(command, args) {
  if (
    typeof command !== "string" ||
    !/language_server/.test(command) ||
    !Array.isArray(args)
  )
    return false;
  // v9.9.38 · 去 _cachedAnchored 门控 · 无条件重写 · 治多窗口竞态
  // 根因: proxyStart 异步 → LS 在 proxy 就绪前 spawn → _cachedAnchored=false → 不重写 → 直连
  // 修正: 始终重写 · 端口确定性(fnv1a) · proxy 总会存活(watchdog/任一窗口)
  // 道义: 十七章「太上 下知有之」· 水善利万物而有静
  let rewrote = 0;
  for (const flag of ["--api_server_url", "--inference_api_server_url"]) {
    const idx = args.indexOf(flag);
    if (
      idx >= 0 &&
      idx + 1 < args.length &&
      args[idx + 1] !== _cachedProxyUrl
    ) {
      L.info("spawn-hook", `${flag}: ${args[idx + 1]} → ${_cachedProxyUrl}`);
      args[idx + 1] = _cachedProxyUrl;
      rewrote++;
    }
    // ★ v9.9.67 · equals 形 (--api_server_url=URL 单参) 亦覆 · 形二守一
    //   病: 旧码仅认分离参形 · 若宿主以单参 equals 形传 → 漏Rewrite → LS 直连官方
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (
        typeof a === "string" &&
        a.startsWith(flag + "=") &&
        a !== flag + "=" + _cachedProxyUrl
      ) {
        L.info(
          "spawn-hook",
          `${flag}(=形): ${a.slice(flag.length + 1)} → ${_cachedProxyUrl}`,
        );
        args[i] = flag + "=" + _cachedProxyUrl;
        rewrote++;
      }
    }
  }
  return rewrote > 0;
}


// v9.9.66-min ACP env anchor: Devin Local(devin.exe acp) also routed to local origin
// Tokyo anchors via WINDSURF_API_SERVER_URL env -> standalone :8937;
// Windows has no such env -> devin.exe hits official directly (179 evidence).
// Same boundary: spawn-hook injects the env; respect pre-set value; skip when origin down.
const _DEVIN_SPAWN_RE = /devin(\.exe)?["'\s]+acp\b/i;
function _maybeAnchorAcpEnv(cmd, args, opts) {
  try {
    // v9.9.68 · 去 _proxyHandle 门控 — 与 LS 重写同律 (v9.9.38): 端口确定 (fnv1a) · proxy 总会存活
    //   病: 激活期 EADDRINUSE 后单次 ping 2s 失误判"非反代" → _proxyHandle 永 null → devin.exe acp 全程无 env 锚 → devin-real 直连官方 (2026-10-27 实证)
    if (!_cachedProxyUrl) return;
    // v9.9.67 · 守 · exec(cmd, callback) / execFile(cmd, args, callback) 之第三参乃回调(函数)
    //   旧码误作 opts → 返 {env} 覆写 arguments[1/2] → 回调被吞 → 调用方永挂
    //   函数即回调 · 非选项 · 静默让路 (六十四章「为之于其未有也」)
    if (typeof opts === "function") return;
    const s0 = [cmd, ...(Array.isArray(args) ? args : [])].join(" ").slice(0, 4000);
    const isDevin =
      (typeof cmd === "string" && /devin(\.exe)?$/i.test(cmd.trim())) ||
      _DEVIN_SPAWN_RE.test(s0);
    if (!isDevin) return;
    opts = opts && typeof opts === "object" ? opts : {};
    const env = Object.assign({}, process.env, opts.env || {});
    // v9.9.69 · 同值则让·异值则夺 — Devin 3.11+ agentEnv 预植 IDE 令牌中继
    //   (127.0.0.1:32809/t/<tok>) → 旧律「已设则让」致 acp 绕代理裸奔.
    //   今: 值=我锚 → 让 (无为); 值≠我锚 → 夺 (重写为锚).
    //   双键并锚 (WINDSURF_API_SERVER_URL + DEVIN_API_URL) · 与 agentEnv 正门同构.
    // ★ v9.9.74 · 分口定面 —— acp env 锚专属口 → 其请求恒归 local 面 (口即面)
    const acpUrl = _cachedAcpUrl || _cachedProxyUrl;
    const preA = env.WINDSURF_API_SERVER_URL;
    const preB = env.DEVIN_API_URL;
    if (preA === acpUrl && preB === acpUrl) return;
    env.WINDSURF_API_SERVER_URL = acpUrl;
    env.DEVIN_API_URL = acpUrl;
    const np = String(env.NO_PROXY || env.no_proxy || "")
      .split(",").map((x) => x.trim()).filter(Boolean);
    if (!np.includes("*"))
      for (const h of ["127.0.0.1", "localhost"]) if (!np.includes(h)) np.push(h);
    env.NO_PROXY = np.join(",");
    opts.env = env;
    L.info(
      "spawn-hook",
      "acp env anchor -> " +
        acpUrl +
        (preA && preA !== acpUrl ? ` (夺回:${preA.slice(0, 60)})` : ""),
    );
    return opts;
  } catch {}
}
function installSpawnHook() {
  if (_spawnHooked) return;
  _spawnHooked = true;
  cp.spawn = function (cmd, a) {
    maybeRewriteLsArgs(cmd, a);
    const _mo = _maybeAnchorAcpEnv(cmd, a, arguments[2]);
    if (_mo) arguments[2] = _mo;
    return _origSpawn.apply(this, arguments);
  };
  cp.spawnSync = function (cmd, a) {
    maybeRewriteLsArgs(cmd, a);
    return _origSpawnSync.apply(this, arguments);
  };
  cp.execFile = function (cmd, a) {
    if (Array.isArray(a)) maybeRewriteLsArgs(cmd, a);
    const _mo = _maybeAnchorAcpEnv(cmd, a, arguments[2]);
    if (_mo) arguments[2] = _mo;
    return _origExecFile.apply(this, arguments);
  };
  cp.exec = function (cmdline) {
    const _mo = _maybeAnchorAcpEnv(cmdline, null, arguments[1]);
    if (_mo) arguments[1] = _mo;
    if (typeof cmdline === "string" && /language_server/.test(cmdline)) {
      const orig = cmdline;
      cmdline = cmdline.replace(
        /(--(?:inference_)?api_server_url(?:=|\s+))(\S+)/g,
        (m, p1) => p1 + _cachedProxyUrl,
      );
      if (cmdline !== orig) {
        L.info("spawn-hook", `exec rewrite`);
        arguments[0] = cmdline;
      }
    }
    return _origExec.apply(this, arguments);
  };
  L.info("spawn-hook", "installed (spawn/spawnSync/execFile/exec)");
}

function removeSpawnHook() {
  if (!_spawnHooked) return;
  cp.spawn = _origSpawn;
  cp.spawnSync = _origSpawnSync;
  cp.exec = _origExec;
  cp.execFile = _origExecFile;
  _spawnHooked = false;
}

// ═══════════════════════════ LS 重启 ═══════════════════════════
// 仅由用户显式命令触发 (cmdInvert / deactivate); 不在 activate 调用 (真药 D)
// 第六十四章「为者败之」: activate 不主动干预 LS, 留待自然重启或用户意愿
function forceRestartLS() {
  return new Promise((resolve) => {
    const plat = process.platform;
    let cmd, args;
    if (plat === "win32") {
      const userName = os.userInfo().username;
      cmd = "taskkill";
      args = [
        "/F",
        "/FI",
        "IMAGENAME eq language_server_windows_x64.exe",
        "/FI",
        `USERNAME eq ${userName}`,
      ];
    } else {
      const binName =
        plat === "darwin"
          ? "language_server_macos_arm"
          : "language_server_linux_x64";
      cmd = "pkill";
      args = ["-f", binName];
      try {
        const uid = String(os.userInfo().uid);
        if (uid && uid !== "-1") args.unshift("-u", uid);
      } catch {}
    }
    const proc = _origSpawn(cmd, args, { stdio: "pipe" });
    let out = "";
    proc.stdout?.on("data", (d) => (out += d));
    proc.stderr?.on("data", (d) => (out += d));
    proc.on("close", (code) => {
      L.info(
        "restart-ls",
        `${plat} ${cmd} exit=${code} ${out.trim().slice(0, 200)}`,
      );
      resolve(code === 0 || code === 128 || (plat !== "win32" && code === 1));
    });
    proc.on("error", (e) => {
      L.warn("restart-ls", e.message);
      resolve(false);
    });
  });
}

// ═══════════════════════════ 源.js 进程内 require ═══════════════════════════
let _proxyHandle = null; // start() 返回的 handle: { server, port, host, close, getMode, setMode }

// v9.9.21 · 唯变所适 · 软编码归宗 · 二十五章「逝曰远 远曰反」· 二十二章「曲则金」
// 病: 旧版 vendorDir 锚死 __dirname/vendor/bundled-origin · 多 ext-host 共存 +
//     旧 ext-host watchdog 复活 → 永走旧版 source.js · self_file 锁死旧目录
// 药: 扫所有 ~/.windsurf/extensions/dao-agi.dao-proxy-min-*/ · 按 semver 选最新版
//     即旧 ext-host (旧 extension.js · 旧 vendorDir) 也从此药受惠 (新装 vsix 后)
//     · 至少新 ext-host 之 require 永走最新源 · 自显新道
//     注: 旧 extension.js 不会调本新 vendorDir · 唯靠 EADDRINUSE 让位机制兼治
function _scanLatestVendorDir() {
  try {
    const extRoot = path.dirname(__dirname); // ~/.windsurf/extensions/
    if (!fs.existsSync(extRoot)) return null;
    const candidates = [];
    for (const name of fs.readdirSync(extRoot)) {
      if (!name.startsWith(SELF_EXT_DIR_PREFIX)) continue;
      // 排除 .obsolete/.DISABLED/.preinstall/.bak/.backup 等中间态目录
      if (/\.(obsolete|disabled|preinstall|backup|bak)/i.test(name)) continue;
      const m = name.match(SELF_EXT_VER_REGEX);
      if (!m) continue;
      const dir = path.join(extRoot, name, "vendor", "bundled-origin");
      const fp = path.join(dir, "source.js");
      if (!fs.existsSync(fp)) continue;
      candidates.push({
        name,
        version: [+m[1], +m[2], +m[3]],
        path: dir,
      });
    }
    if (candidates.length === 0) return null;
    // 降序: 9.9.21 > 9.9.20 > 9.9.19 ...
    candidates.sort((a, b) => {
      for (let i = 0; i < 3; i++) {
        if (a.version[i] !== b.version[i]) return b.version[i] - a.version[i];
      }
      return 0;
    });
    return candidates[0];
  } catch (e) {
    L.warn("vendorDir", `scan fail: ${e.message}`);
    return null;
  }
}

// ★ v9.9.70 · 重启后生效判别 —— deactivate 真因三分
//   .obsolete 录己名 → VS Code 标记待删 (卸载 pending)
//   兄弟版本目录并存 → 升级途中 (旧版退役新版就位)
//   二者皆非 → 重载/崩溃/关窗 (宿主轮换·非卸载)
// ★ v9.9.73 · 名实终一 —— .obsolete 之键各 fork 不一:
//     本机实证键为「目录名」("dao-agi.dao-proxy-min-9.9.71" → true);
//     他 fork 或以「扩展ID」("dao-agi.dao-proxy-min") 录 —— 双钥并查.
//   旧病: 唯查 ID 一钥 → 本 fork 永不命中 → 真卸载路死 →
//         锚残代存 · 代理不死 —— 主公所诉「卸载后还持续去后端连接」之根.
function _readObsoleteMap() {
  try {
    const fp = path.join(path.dirname(__dirname), ".obsolete");
    if (!fs.existsSync(fp)) return {};
    const ob = JSON.parse(fs.readFileSync(fp, "utf8"));
    return ob && typeof ob === "object" ? ob : {};
  } catch {
    return {};
  }
}
function _selfObsoleteMarked() {
  const ob = _readObsoleteMap();
  const dirName = path.basename(__dirname); // 目录名钥 (本 fork 实证)
  return !!(ob[dirName] || ob[SELF_EXT_ID]);
}
// 兄弟甄别: 同前缀目录 · 非己 · 未录死 · 在册 —— 四者俱备方为活兄
//   僵尸目录(未在册之残留)、亡弟(亦录死)皆不算兄 · 不阻真卸载之判.
//   册 (extensions.json) 不可读 → 退以「未录死」为准 (保守: 视为有兄).
function _selfHasSiblingVersion() {
  try {
    const extRoot = path.dirname(__dirname);
    const selfName = path.basename(__dirname);
    const ob = _readObsoleteMap();
    let installed = null; // null = 册不可读
    try {
      const ej = JSON.parse(
        fs.readFileSync(path.join(extRoot, "extensions.json"), "utf8"),
      );
      if (Array.isArray(ej)) {
        installed = new Set();
        for (const e of ej) {
          if (e && e.relativeLocation)
            installed.add(String(e.relativeLocation));
          const id = e && e.identifier && e.identifier.id;
          const v = e && e.version;
          if (id && v) installed.add(`${String(id).toLowerCase()}-${v}`);
        }
      }
    } catch {}
    for (const name of fs.readdirSync(extRoot)) {
      if (!SELF_EXT_DIR_REGEX.test(name)) continue;
      if (/\.(obsolete|disabled|preinstall|backup|bak)/i.test(name)) continue;
      if (name === selfName) continue;
      if (ob[name]) continue; // 同录死者 → 亡弟非兄
      if (installed && !installed.has(name)) continue; // 不在册 → 僵尸目录
      return true;
    }
  } catch {}
  return false;
}
// 真卸载 = .obsolete 录己名 且 无兄弟版本并存
function _selfUninstallPending() {
  return _selfObsoleteMarked() && !_selfHasSiblingVersion();
}

function vendorDir() {
  // 优先选最新版 · 唯变所适
  const best = _scanLatestVendorDir();
  if (best) {
    const myVerStr = String(PKG_VERSION || "0.0.0");
    const bestVerStr = best.version.join(".");
    if (bestVerStr !== myVerStr) {
      L.info(
        "vendorDir",
        `自身 v${myVerStr} → 选最新 v${bestVerStr} (${best.name})`,
      );
    }
    return best.path;
  }
  // 兜底: 自家目录
  return path.join(__dirname, "vendor", "bundled-origin");
}

function findSourceJs() {
  const dir = vendorDir();
  for (const n of ["source.js", "源.js"]) {
    const fp = path.join(dir, n);
    if (fs.existsSync(fp)) return fp;
  }
  // 终极兜底: 扫 shebang
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".js")) continue;
      const fp = path.join(dir, f);
      const head = fs.readFileSync(fp, "utf8").slice(0, 60);
      if (head.includes("#!/usr/bin/env node") || head.includes("// origin"))
        return fp;
    }
  } catch {}
  return null;
}

// v9.9.21 · 唯变所适 · 让位机制
// _isRemoteStale: 远端 self_file 是否非最新版 dao-proxy-min-* 之 source.js
function _isRemoteStale(remoteSelfFile) {
  if (!remoteSelfFile || typeof remoteSelfFile !== "string") return false;
  const best = _scanLatestVendorDir();
  if (!best) return false;
  const expected = path.join(best.path, "source.js").toLowerCase();
  return remoteSelfFile.toLowerCase() !== expected;
}

// ★ v9.9.70 · spawned detached —— 代理独立于 ext-host 存活
//   病: 旧制 require() 进程内起服 → ext-host 一死(升级/重载/崩溃)代理即亡,
//       锚仍指死口 → 中段断流 (141 实证之「正常体验都没了」).
//   治: ELECTRON_RUN_AS_NODE spawn detached → ext-host 死而代理存 →
//       新宿主 ping 采用 (remote handle) 或 _isRemoteStale 让位 → 零断窗·重启生效.
//   孤儿防: DAO_PARENT_PID 由 source.js 收割 (父亡+静默10min自退).
//   回落: spawn 不可行则仍旧 require 进程内.
async function _spawnDetachedProxy(srcPath, port, mode) {
  try {
    const env = Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: "1", // Electron 宿主亦可作纯 node 跑
      ORIGIN_PORT: String(port),
      ORIGIN_ACP_PORT: String(_cachedAcpPort || port - 500), // v9.9.74 · acp 面专属口
      SP_MODE: mode || "invert", // 盘值优先 · env 仅兜底 (与 start() 语义同)
      DAO_PARENT_PID: String(process.pid),
      DAO_SPAWNED: "1",
    });
    const logDir = _stateDir() || os.tmpdir();
    let logFd = null;
    try {
      fs.mkdirSync(logDir, { recursive: true });
      logFd = fs.openSync(path.join(logDir, "_spawned.log"), "a");
    } catch {}
    const stdio = logFd != null ? ["ignore", logFd, logFd] : "ignore";
    // ★ v9.9.71 · 进程名伪装 —— 东京机实证: pkill devin-desktop 殃及 spawned 代理
    //   (comm 取 execPath basename). 别名为 "node" → comm=node → 免疫粗杀.
    //   硬链→符链→复制递进; 三法皆废则直用 execPath (名险可受, 能活为主).
    let binPath = process.execPath;
    try {
      const alias = path.join(
        logDir,
        process.platform === "win32" ? "dao-node.exe" : "node",
      );
      const st = (() => {
        try {
          return fs.statSync(alias);
        } catch {
          return null;
        }
      })();
      if (!st || st.size === 0) {
        let made = false;
        try {
          fs.linkSync(binPath, alias);
          made = true;
        } catch {}
        if (!made) {
          try {
            fs.symlinkSync(binPath, alias);
            made = true;
          } catch {}
        }
        if (!made) {
          try {
            fs.copyFileSync(binPath, alias);
            made = true;
          } catch {}
        }
      }
      if (fs.existsSync(alias)) binPath = alias;
    } catch {}
    const child = cp.spawn(binPath, [srcPath], {
      env,
      detached: true,
      stdio,
      windowsHide: true,
    });
    if (logFd != null) {
      try {
        fs.closeSync(logFd);
      } catch {}
    }
    child.on("error", () => {});
    child.unref();
    const childPid = child.pid;
    if (!childPid) return null;
    // 等 ping · 验 pid 属我子 (防占用误判)
    for (let i = 0; i < 18; i++) {
      if (child.exitCode != null) break;
      await new Promise((r) => setTimeout(r, 350));
      const p = await httpGetJson(
        `http://127.0.0.1:${port}/origin/ping`,
        700,
      ).catch(() => null);
      if (p && p.ok) {
        if (p.pid === childPid) {
          L.info(
            "proxy",
            `spawned detached :${port} pid=${childPid} mode=${p.mode}`,
          );
          _adoptAcpPort(p); // v9.9.74 · 实况 acp 口 (bind 避让或落 +N)
          return _createRemoteHandle(port, p.mode, {
            spawned: true,
            pid: childPid,
          });
        }
        // 口被他人先得 (旧代理迟亡/异族) → 子将 EADDRINUSE 自退 · 交上层采用流
        L.info(
          "proxy",
          `spawn 未得口 · 占者 pid=${p.pid} self=${p.self_file}`,
        );
        return null;
      }
    }
    L.warn("proxy", `spawned ping 超时 (pid=${childPid} exit=${child.exitCode})`);
    return null;
  } catch (e) {
    L.warn("proxy", `spawn fail: ${e.message}`);
    return null;
  }
}

async function proxyStart(port, mode, _retried) {
  if (_proxyHandle) return _proxyHandle;
  const srcPath = findSourceJs();
  if (!srcPath) throw new Error(`源.js 不存在: ${vendorDir()}`);

  // ① 采用优先 · 活代理先收编 (升级/重载/崩溃复起皆无缝 · 不扰中段)
  const ping0 = await httpGetJson(
    `http://127.0.0.1:${port}/origin/ping`,
    1500,
  ).catch(() => null);
  if (
    ping0 &&
    ping0.ok &&
    (ping0.mode === "invert" ||
      ping0.mode === "passthrough" ||
      ping0.mode === "custom")
  ) {
    // v9.9.21 · 检远端 self_file 是否最新 · 旧则让位
    if (!_retried && _isRemoteStale(ping0.self_file)) {
      L.warn(
        "proxy",
        `remote stale self_file=${ping0.self_file} → POST /_quit · 让位重起`,
      );
      await httpPostJson(
        `http://127.0.0.1:${port}/origin/_quit`,
        { reason: `newer-version v${PKG_VERSION} arrived` },
        2000,
      ).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
      return proxyStart(port, mode, true); // 一次重试 · 防递归无限
    }
    L.info(
      "proxy",
      `adopt live remote :${port} (mode=${ping0.mode} spawned=${!!ping0.spawned} pid=${ping0.pid} self=${ping0.self_file})`,
    );
    _adoptAcpPort(ping0); // v9.9.74 · 采用实况 acp 口 (无则回落主口)
    _proxyHandle = _createRemoteHandle(port, ping0.mode, {
      spawned: !!ping0.spawned,
      pid: ping0.pid,
    });
    return _proxyHandle;
  }
  if (ping0 && ping0.ok) {
    L.warn("proxy", `port :${port} 占且非反代 · 返 null (本窗口直连)`);
    return null;
  }

  // ② detached spawn —— 独立于 ext-host 存活 (重启生效之骨)
  const spawned = await _spawnDetachedProxy(srcPath, port, mode);
  if (spawned) {
    _proxyHandle = spawned;
    return _proxyHandle;
  }

  // ③ 回落 · 进程内 require (detached 被阻时之朴)
  try {
    delete require.cache[require.resolve(srcPath)];
    const mod = require(srcPath);
    if (typeof mod.start !== "function")
      throw new Error("源.js 无 start() 导出");
    _proxyHandle = await mod.start({
      port,
      host: "127.0.0.1",
      mode: mode || "passthrough",
      acpPort: _cachedAcpPort, // v9.9.74 · acp 面专属口
    });
    L.info(
      "proxy",
      `started in-proc :${_proxyHandle.port} src=${srcPath} mode=${_proxyHandle.getMode()}`,
    );
    return _proxyHandle;
  } catch (e) {
    if (
      e.code === "EADDRINUSE" ||
      (e.message && e.message.includes("EADDRINUSE"))
    ) {
      L.info("proxy", `port :${port} EADDRINUSE → ping remote`);
      let ping = await httpGetJson(
        `http://127.0.0.1:${port}/origin/ping`,
        2000,
      );
      // v9.9.68 · 冷启竞速窗补一发 — 单次 2s ping 失误曾致整窗口 _proxyHandle=null → ACP env 锚死 (2026-10-27 实证)
      if (!ping) {
        await new Promise((r) => setTimeout(r, 800));
        ping = await httpGetJson(
          `http://127.0.0.1:${port}/origin/ping`,
          3000,
        );
        if (ping) L.info("proxy", `port :${port} ping 二发命中`);
      }
      if (
        ping &&
        ping.ok &&
        (ping.mode === "invert" ||
          ping.mode === "passthrough" ||
          ping.mode === "custom")
      ) {
        if (!_retried && _isRemoteStale(ping.self_file)) {
          L.warn(
            "proxy",
            `remote stale self_file=${ping.self_file} → POST /_quit · 让位重起`,
          );
          await httpPostJson(
            `http://127.0.0.1:${port}/origin/_quit`,
            { reason: `newer-version v${PKG_VERSION} arrived` },
            2000,
          ).catch(() => {});
          await new Promise((r) => setTimeout(r, 1500));
          return proxyStart(port, mode, true); // 一次重试 · 防递归无限
        }
        L.info(
          "proxy",
          `port :${port} live remote (mode=${ping.mode} · ver=${(ping.features || {}).mode || "?"}) → remote handle`,
        );
        _adoptAcpPort(ping); // v9.9.74 · 采用实况 acp 口
        _proxyHandle = _createRemoteHandle(port, ping.mode, {
          spawned: !!ping.spawned,
          pid: ping.pid,
        });
        return _proxyHandle;
      }
      L.warn("proxy", `port :${port} 占且非反代 · 返 null (本窗口直连)`);
      return null;
    }
    throw e;
  }
}

async function proxyStop() {
  if (!_proxyHandle) return;
  try {
    await _proxyHandle.close();
  } catch (e) {
    L.warn("proxy", `stop: ${e.message}`);
  }
  _proxyHandle = null;
  L.info("proxy", "stopped");
}

// 远程 handle: 端口已有 proxy (多窗口/detached 子进程) → 复用而非销毁
// ★ v9.9.70 · spawned 身份 + quit() —— 采用不夺命 · 卸载才 _quit (重启生效)
function _createRemoteHandle(port, mode, info) {
  let _mode = mode || "invert";
  const _spawned = !!(info && info.spawned);
  return {
    port,
    host: "127.0.0.1",
    server: null, // remote · 无本地 server
    kind: _spawned ? "spawned" : "remote",
    pid: info && info.pid,
    spawned: _spawned,
    getMode: () => _mode,
    setMode: (m) => {
      _mode = m;
      httpPostJson(
        `http://127.0.0.1:${port}/origin/mode`,
        { mode: m },
        2000,
      ).catch(() => {});
    },
    close: async () => {}, // remote/spawned · 不关闭别窗/独立进程 (留活待用)
    quit: async () => {
      await httpPostJson(
        `http://127.0.0.1:${port}/origin/_quit`,
        { reason: `deactivate v${PKG_VERSION}` },
        2000,
      ).catch(() => {});
    },
  };
}

function proxySetMode(mode) {
  if (_proxyHandle && _proxyHandle.setMode) {
    _proxyHandle.setMode(mode);
  }
  _cachedMode = mode;
  L.info("proxy", `mode → ${mode}`);
}

function proxyGetMode() {
  if (_proxyHandle && _proxyHandle.getMode) return _proxyHandle.getMode();
  return _cachedMode;
}

// ═══════════════════════════ settings 锚 ═══════════════════════════
// 双保险: VS Code API (内存) + 直写 settings.json (磁盘持久化)
// Windsurf 可能拦截 codeium.* 的 API 写入 · 直写文件兜底
function _settingsJsonPath() {
  const plat = process.platform;
  let base;
  if (plat === "win32") base = process.env.APPDATA;
  else if (plat === "darwin")
    base = path.join(os.homedir(), "Library", "Application Support");
  else base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  // v9.9.58 · 道法自然 · 适 Devin Desktop · 二十五章「逝曰远 远曰反」
  // Devin Desktop 迁移后: AppData\Roaming\Devin\User\settings.json
  // 旧 Windsurf 仍在: AppData\Roaming\Windsurf\User\settings.json
  // 优先 Devin (新) · 兜底 Windsurf (旧) · 两处均写保双活
  const devinSp = path.join(base, "Devin", "User", "settings.json");
  const windsurfSp = path.join(base, "Windsurf", "User", "settings.json");
  if (fs.existsSync(devinSp)) return devinSp;
  if (fs.existsSync(windsurfSp)) return windsurfSp;
  // 两处均不存在 → 默认 Devin (新装场景)
  return devinSp;
}

function _readSettingsJson(fp) {
  try {
    const raw = fs.readFileSync(fp, "utf8").trim();
    if (!raw) return {}; // 空文件 → 空对象 (可写入)
    return JSON.parse(raw);
  } catch (e) {
    if (e && e.code === "ENOENT") return {}; // 文件不存在 → 空对象 (可创建)
    return null; // JSON解析失败等其他错误 → null (不覆盖)
  }
}

function _writeSettingsJson(fp, json) {
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true }); // 确保父目录存在
    // ★ v9.9.70 · 原子替身 —— tmp+rename · 防写半遭杀而留残篇坏 JSON (settings 损坏即全局乱)
    const tmp = fp + ".dao-tmp";
    fs.writeFileSync(tmp, JSON.stringify(json, null, 2), "utf8");
    fs.renameSync(tmp, fp);
    return true;
  } catch (e) {
    L.warn("anchor", `file write fail: ${e.message}`);
    try {
      fs.unlinkSync(fp + ".dao-tmp");
    } catch {}
    return false;
  }
}

// ── v9.9.69 · agentEnv 正门锚 helpers ────────────────────────────────
// 写: 遍历 ACP_ENV_BLOCKS 之每一 agent 键(现存者全锚, 无则立 devin-cli),
//   置 WINDSURF_API_SERVER_URL/DEVIN_API_URL=url, NO_PROXY 保底 loopback.
//   用户之 HTTP_PROXY 清空项/NO_PROXY="*"/自定义键 一概不触.
// 返: 改动计数 (0=已在锚 → 无为不写盘).
function _anchorAcpEnvJson(json, url) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return 0;
  let n = 0;
  for (const bk of ACP_ENV_BLOCKS) {
    let env = json[bk];
    if (!env || typeof env !== "object" || Array.isArray(env)) env = {};
    let agentKeys = Object.keys(env);
    if (!agentKeys.length) agentKeys = [ACP_ENV_DEFAULT_AGENT];
    for (const ak of agentKeys) {
      let sub = env[ak];
      if (!sub || typeof sub !== "object" || Array.isArray(sub)) sub = {};
      for (const uk of ACP_ENV_URL_KEYS) {
        if (sub[uk] !== url) {
          sub[uk] = url;
          n++;
        }
      }
      // loopback 保底免代理 (用户已置 "*" 或自带两址者不动)
      const npv = String(sub.NO_PROXY ?? sub.no_proxy ?? "");
      const np = npv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!np.includes("*")) {
        let npDirty = false;
        for (const h of ["127.0.0.1", "localhost"])
          if (!np.includes(h)) {
            np.push(h);
            npDirty = true;
          }
        if (npDirty || !sub.NO_PROXY) {
          sub.NO_PROXY = np.join(",");
          n++;
        }
      }
      env[ak] = sub;
    }
    json[bk] = env;
  }
  return n;
}

// 卸: 删我所植之 WINDSURF_API_SERVER_URL/DEVIN_API_URL, 留用户余键不犯.
// ★ v9.9.73 · 收净三义:
//   ① URL 键唯删「裸回环锚」式 (127.0.0.1:port 无路径) —— Devin 自置之
//     令牌中继 (127.0.0.1:port/t/<tok>) 非我所植 · 一字不犯;
//   ② 我植 NO_PROXY (纯 127.0.0.1/localhost 无他项) 并除; 用户杂项不动;
//   ③ 空 agent 子表、空 agentEnv 块尽剪 —— 不留壳.
const _DAO_LOOPBACK_ROOT_RE = /^https?:\/\/127\.0\.0\.1:\d+\/?$/;
function _isPlantedNoProxy(v) {
  const np = String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return np.length > 0 && np.every((t) => t === "127.0.0.1" || t === "localhost");
}
function _clearAcpEnvJson(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return 0;
  let n = 0;
  for (const bk of ACP_ENV_BLOCKS) {
    const env = json[bk];
    if (!env || typeof env !== "object" || Array.isArray(env)) continue;
    for (const ak of Object.keys(env)) {
      const sub = env[ak];
      if (!sub || typeof sub !== "object" || Array.isArray(sub)) continue;
      for (const uk of ACP_ENV_URL_KEYS) {
        if (uk in sub && _DAO_LOOPBACK_ROOT_RE.test(String(sub[uk]))) {
          delete sub[uk];
          n++;
        }
      }
      if (_isPlantedNoProxy(sub.NO_PROXY)) {
        delete sub.NO_PROXY;
        n++;
      }
      if (Object.keys(sub).length === 0) {
        delete env[ak];
        n++;
      }
    }
    if (Object.keys(env).length === 0) {
      delete json[bk];
      n++;
    }
  }
  return n;
}

// 巡检: agentEnv 之 URL 键有离 _cachedProxyUrl 者 → 复位. watchdog 每巡调之,
//   防 Devin 按会话重书令牌中继锚 (3.11 实证之病灶). 返 true=有修.
function _reanchorAcpEnvDrift(url) {
  if (!url) return false;
  const plat = process.platform;
  let base;
  if (plat === "win32") base = process.env.APPDATA;
  else if (plat === "darwin")
    base = path.join(os.homedir(), "Library", "Application Support");
  else base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  let fixed = false;
  for (const sp of [
    path.join(base, "Devin", "User", "settings.json"),
    path.join(base, "Windsurf", "User", "settings.json"),
  ]) {
    try {
      const json = _readSettingsJson(sp);
      if (!json) continue;
      const n = _anchorAcpEnvJson(json, url);
      if (n > 0 && _writeSettingsJson(sp, json)) {
        fixed = true;
        L.info("watchdog", `agentEnv drift 复位 ×${n} → ${sp}`);
      }
    } catch {}
  }
  // v9.9.71 · credentials.toml 同巡 —— 第四锚面之漂移 (login/换号/升级重写) 复位
  try {
    if (_isCredentialsDrifted()) {
      if (_anchorCredentialsToml(url)) {
        fixed = true;
        L.info("watchdog", `credentials.toml drift 复位 → ${url}`);
      }
    }
  } catch {}
  return fixed;
}

async function setAnchor(port) {
  const url = `http://127.0.0.1:${port}`;

  // v9.9.36 · 道法自然 · 损之又损 · 四十八章
  // 去 VS Code API 写 (codeium.* 非注册键 · API 写永 FAIL · 纯噪音)
  // 日志实证: [WARN] [anchor] API set codeium.apiServerUrl fail: Unable to write to User Settings
  //           because codeium.apiServerUrl is not a registered configuration.
  // 文件直写 settings.json 才是唯一有效路径 · 无为而治

  // v9.9.58 · 道法自然 · 双活写入 · 二十五章「逝曰远 远曰反」
  // Devin Desktop 迁移后可能读 Devin/ 或 Windsurf/ · 两处均写保双活
  const plat = process.platform;
  let base;
  if (plat === "win32") base = process.env.APPDATA;
  else if (plat === "darwin")
    base = path.join(os.homedir(), "Library", "Application Support");
  else base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  const _allSettingsPaths = [
    path.join(base, "Devin", "User", "settings.json"),
    path.join(base, "Windsurf", "User", "settings.json"),
  ];

  for (const sp of _allSettingsPaths) {
    try {
      const json = _readSettingsJson(sp);
      if (!json) continue; // 不存在或不可读 → 跳过
      let dirty = false;
      if (
        json["codeium.apiServerUrl"] !== url ||
        json["codeium.inferenceApiServerUrl"] !== url
      ) {
        json["codeium.apiServerUrl"] = url;
        json["codeium.inferenceApiServerUrl"] = url;
        dirty = true;
      }
      // v9.9.69 · 正门锚: agentEnv 声明式 env 注入 (Devin 3.11+)
      //   codeium.* 已同值亦须查 agentEnv —— 或为新版本写之缺/被再生之中继
      // ★ v9.9.74 · 分口定面 —— agentEnv(acp域) 锚专属口 → acp 请求恒归 local 面
      const acpUrl = _cachedAcpUrl || url;
      const envN = _anchorAcpEnvJson(json, acpUrl);
      if (envN > 0) dirty = true;
      if (!dirty) {
        L.info("anchor", `already ${url} · skip ${sp} (无为而治)`);
        continue;
      }
      if (_writeSettingsJson(sp, json)) {
        L.info(
          "anchor",
          `file set ${url} → ${sp} (codeium${envN > 0 ? ` +agentEnv×${envN}` : ""})`,
        );
      }
    } catch (e) {
      L.warn("anchor", `file set fail ${sp}: ${e.message}`);
    }
  }

  _cachedAnchored = true;
  _cachedProxyUrl = url;

  // ★ v9.9.71 · credentials.toml 锚面 · 一锚统万面 (道法自然)
  //   Devin Local(chisel/acp/CLI) 之 devin_api_url / api_server_url 居
  //   ~/.local/share/devin/credentials.toml —— devin login/换号/升级辄重写
  //   → acp chat 直连官方绕代理 (东京机实证: 友人被迫以 shell watchdog 手工纠偏)。
  //   今并入正门: setAnchor 即写 + drift watchdog 巡 · 补丁之补丁尽废。
  // ★ v9.9.74 · 分口定面 + Win 遗珠: credentials 属 acp 域 → 锚专属口;
  //   _CRED_PATHS 补 %APPDATA%/devin (Windows 实位 · 旧册未达曾死面).
  try {
    _anchorCredentialsToml(_cachedAcpUrl || url);
  } catch (e) {
    L.warn("anchor", `credentials.toml: ${e.message}`);
  }
}

// ── credentials.toml 锚面 ──
// 仅存则锚; 无文件不造 (未登录之机无此面 · 无为).
// 原子写: tmp+rename · 与 _writeSettingsJson 同律.
const _CRED_PATHS = () => {
  const h = os.homedir();
  const out = [
    path.join(h, ".local", "share", "devin", "credentials.toml"),
    path.join(h, ".config", "devin", "credentials.toml"),
  ];
  // ★ v9.9.74 · Win 遗珠 —— 实证 Windows 实位 %APPDATA%\devin\credentials.toml
  //   (旧册唯 Unix 二径 → Win 之第四锚面曾为死面·用户 shell watchdog 代偿)
  if (process.env.APPDATA)
    out.push(path.join(process.env.APPDATA, "devin", "credentials.toml"));
  return out;
};
function _readCredAnchor() {
  for (const p of _CRED_PATHS()) {
    try {
      const t = fs.readFileSync(p, "utf8");
      const m1 = t.match(/^devin_api_url\s*=\s*"([^"]*)"/m);
      const m2 = t.match(/^api_server_url\s*=\s*"([^"]*)"/m);
      return {
        path: p,
        text: t,
        devin_api_url: m1 ? m1[1] : null,
        api_server_url: m2 ? m2[1] : null,
      };
    } catch {}
  }
  return null;
}
function _anchorCredentialsToml(url) {
  const cur = _readCredAnchor();
  if (!cur) return false; // 无 credentials.toml · 无面可锚
  const want = url || _cachedProxyUrl;
  let t = cur.text;
  let n = 0;
  if (cur.devin_api_url !== null && cur.devin_api_url !== want) {
    t = t.replace(
      /^devin_api_url\s*=.*$/m,
      `devin_api_url = "${want}"`,
    );
    n++;
  }
  if (cur.api_server_url !== null && cur.api_server_url !== want) {
    t = t.replace(
      /^api_server_url\s*=.*$/m,
      `api_server_url = "${want}"`,
    );
    n++;
  }
  if (!n) return false;
  const tmp = cur.path + ".dao-tmp";
  fs.writeFileSync(tmp, t);
  fs.renameSync(tmp, cur.path);
  L.info("anchor", `credentials.toml ×${n} → ${want} · ${cur.path}`);
  return true;
}
// 卸载之反: 归官方常量 · 免残锚指向死口
function _unanchorCredentialsToml() {
  const cur = _readCredAnchor();
  if (!cur) return false;
  let t = cur.text;
  let n = 0;
  const re = /^((?:devin_api_url|api_server_url)\s*=\s*")(http:\/\/127\.0\.0\.1:\d+(?:\/t\/[^"]*)?)"/gm;
  t = t.replace(re, (m, pre) => {
    const key = pre.startsWith("devin_api_url")
      ? "https://api.devin.ai"
      : "https://server.codeium.com";
    n++;
    return pre + key + '"';
  });
  if (!n) return false;
  const tmp = cur.path + ".dao-tmp";
  fs.writeFileSync(tmp, t);
  fs.renameSync(tmp, cur.path);
  L.info("anchor", `credentials.toml 归官方 ×${n}`);
  return true;
}
// drift 巡检之判: 面存在且值≠我锚 → 漂 (v9.9.74 · credentials 属 acp 域 → 比 acp 锚)
function _isCredentialsDrifted() {
  const cur = _readCredAnchor();
  if (!cur) return false;
  const want = _cachedAcpUrl || _cachedProxyUrl;
  return (
    (cur.devin_api_url !== null && cur.devin_api_url !== want) ||
    (cur.api_server_url !== null && cur.api_server_url !== want)
  );
}

async function clearAnchor() {
  // 方法1: VS Code API
  try {
    const c = vscode.workspace.getConfiguration();
    await c.update(
      "codeium.apiServerUrl",
      undefined,
      vscode.ConfigurationTarget.Global,
    );
    await c.update(
      "codeium.inferenceApiServerUrl",
      undefined,
      vscode.ConfigurationTarget.Global,
    );
    try {
      await c.update(
        BACKUP_KEY_API,
        undefined,
        vscode.ConfigurationTarget.Global,
      );
    } catch {}
    try {
      await c.update(
        BACKUP_KEY_INFER,
        undefined,
        vscode.ConfigurationTarget.Global,
      );
    } catch {}
  } catch (e) {
    L.warn("anchor", `API clear fail: ${e.message}`);
  }

  // 方法2: 直写 settings.json · v9.9.58 双活清锚
  const plat = process.platform;
  let base2;
  if (plat === "win32") base2 = process.env.APPDATA;
  else if (plat === "darwin")
    base2 = path.join(os.homedir(), "Library", "Application Support");
  else
    base2 = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  for (const sp of [
    path.join(base2, "Devin", "User", "settings.json"),
    path.join(base2, "Windsurf", "User", "settings.json"),
  ]) {
    const json = _readSettingsJson(sp);
    if (json) {
      delete json["codeium.apiServerUrl"];
      delete json["codeium.inferenceApiServerUrl"];
      delete json[BACKUP_KEY_API];
      delete json[BACKUP_KEY_INFER];
      const envN = _clearAcpEnvJson(json); // v9.9.69 · 卸正门锁
      _writeSettingsJson(sp, json);
      L.info(
        "anchor",
        `file cleared → ${sp}${envN > 0 ? ` (−agentEnv×${envN})` : ""}`,
      );
    }
  }

  _cachedAnchored = false;
  L.info("anchor", "cleared → defaults");
}

// 同步清锚 · 仅文件 · 用于 deactivate 等需极速清理的场景
// VS Code API 异步且可能失败 (codeium.* 非注册键) · 文件直写最可靠
function _clearAnchorFileSync() {
  // v9.9.58 · 双活清锚 · Devin + Windsurf 两处
  const plat = process.platform;
  let base;
  if (plat === "win32") base = process.env.APPDATA;
  else if (plat === "darwin")
    base = path.join(os.homedir(), "Library", "Application Support");
  else base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  for (const sp of [
    path.join(base, "Devin", "User", "settings.json"),
    path.join(base, "Windsurf", "User", "settings.json"),
  ]) {
    try {
      const json = _readSettingsJson(sp);
      if (json) {
        let changed = false;
        for (const k of [
          "codeium.apiServerUrl",
          "codeium.inferenceApiServerUrl",
          BACKUP_KEY_API,
          BACKUP_KEY_INFER,
        ]) {
          if (k in json) {
            delete json[k];
            changed = true;
          }
        }
        // ★ v9.9.73 · dao.origin.* 我域键尽扫 (port/defaultMode/banner/backup)
        for (const k of Object.keys(json)) {
          if (k.indexOf("dao.origin.") === 0) {
            delete json[k];
            changed = true;
          }
        }
        if (_clearAcpEnvJson(json) > 0) changed = true; // v9.9.69 · 卸正门锁
        if (changed) {
          _writeSettingsJson(sp, json);
          L.info("anchor", `file-sync cleared → ${sp}`);
        }
      }
    } catch (e) {
      L.warn("anchor", `file-sync clear fail ${sp}: ${e.message}`);
    }
  }
  _cachedAnchored = false;
}

// ★ v9.9.73 · 家目录遗珠 —— ~/.windsurf|~/.devin/settings.json 之锚一并还原
//   实证(179 本机): ~/.windsurf/settings.json 亦载 127.0.0.1 裸锚
//   (旧版/手记所遗) —— 正门之外漏扫一面, 卸载后犹指死口.
//   唯删我式之值 (127.0.0.1:port 裸锚) + 我域键 (dao.origin.* · agentEnv 我植) —
//   用户他设、令牌中继 (/t/…) 一概不犯.
function _clearHomeSettingsSync() {
  const home = os.homedir();
  if (!home) return 0;
  let files = 0;
  for (const sp of [
    path.join(home, ".windsurf", "settings.json"),
    path.join(home, ".devin", "settings.json"),
  ]) {
    try {
      const json = _readSettingsJson(sp);
      if (!json) continue;
      let changed = false;
      for (const k of ["codeium.apiServerUrl", "codeium.inferenceApiServerUrl"]) {
        if (k in json && _DAO_LOOPBACK_ROOT_RE.test(String(json[k]))) {
          delete json[k];
          changed = true;
        }
      }
      for (const k of Object.keys(json)) {
        if (k.indexOf("dao.origin.") === 0) {
          delete json[k];
          changed = true;
        }
      }
      if (_clearAcpEnvJson(json) > 0) changed = true;
      if (changed) {
        if (_writeSettingsJson(sp, json)) files++;
        L.info("anchor", `home-settings cleared → ${sp}`);
      }
    } catch {}
  }
  return files;
}

function isAnchored() {
  // 检查 VS Code API
  try {
    const c = vscode.workspace.getConfiguration();
    if (c.get("codeium.apiServerUrl") === _cachedProxyUrl) return true;
  } catch {}
  // 兜底: 检查文件
  try {
    const json = _readSettingsJson(_settingsJsonPath());
    if (json && json["codeium.apiServerUrl"] === _cachedProxyUrl) return true;
  } catch {}
  return false;
}

// ★ v9.9.67 · 执今之道 · 模式复原以磁盘持久为真 · 治「重启丢模式」
//   病: activate 以 config dao.origin.defaultMode(默 invert) 传 start() + proxySetMode
//       → source.js setMode 落盘 → 用户运行时切换(道⇄官)于窗口重启即被 config 默认覆没。
//   治: activate 先读状态文件(用户运行时真意) · 有则为主 · config 默认为备。
//   ★ v9.9.67 根药 · 状态归恒所 ~/.codeium/dao-origin/ (随用户不随版本 · 升级不复位)
//     恒所无则兜底读旧版目录 (source.js 首载自迁移)
//   道义: 十四章「执今之道 以御今之有」· 三十二章「侯王若能守之 万物将自宾」
function _stateDir() {
  const home =
    os.homedir() || process.env.USERPROFILE || process.env.HOME || "";
  return home ? path.join(home, ".codeium", "dao-origin") : null;
}
function _readPersistedMode() {
  const candidates = [];
  const sd = _stateDir();
  if (sd) candidates.push(path.join(sd, "_origin_mode.txt"));
  try {
    candidates.push(path.join(vendorDir(), "_origin_mode.txt"));
  } catch {}
  for (const fp of candidates) {
    try {
      const v = fs.readFileSync(fp, "utf8").trim().toLowerCase();
      if (v === "invert" || v === "passthrough" || v === "custom") return v;
    } catch {}
  }
  return null;
}

// ★ v9.9.67 · SSR 真态首绘 · 治「面板初启跳来跳去」
//   病: 面板 HTML 首绘恒默认 (canon 下拉停首项「合一」· 钮皆无 active)
//       → pingPull/_refreshSurf 真态至 → 灯亮 · 下拉跳变 → 观者见「跳来跳去」
//   治: resolveWebviewView 时同步读持久态 (与 source.js _surfaceMode/_surfaceCanon 同律:
//       面 mode 回落 default 再回落全局 · 面 canon 回落 default_canon 再回落全局 canon 文件)
//       → getEssenceHtml 预渲 active/selected → 首绘即实 · 无为而无不为
function _readPersistedCanon() {
  const candidates = [];
  const sd = _stateDir();
  if (sd) candidates.push(path.join(sd, "_origin_canon.txt"));
  try {
    candidates.push(path.join(vendorDir(), "_origin_canon.txt"));
  } catch {}
  for (const fp of candidates) {
    try {
      const v = fs.readFileSync(fp, "utf8").trim().toLowerCase();
      if (v === "laozi" || v === "yinfu" || v === "laozi+yinfu") return v;
    } catch {}
  }
  return "laozi+yinfu";
}
function _readPersistedSurfaceJson() {
  const candidates = [];
  const sd = _stateDir();
  if (sd) candidates.push(path.join(sd, "_origin_mode_surface.json"));
  try {
    candidates.push(path.join(vendorDir(), "_origin_mode_surface.json"));
  } catch {}
  for (const fp of candidates) {
    try {
      const j = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (j && typeof j === "object") return j;
    } catch {}
  }
  return {};
}
function _initialPanelState() {
  const validMode = (v) =>
    v === "invert" || v === "passthrough" || v === "custom" ? v : null;
  const validCanon = (v) =>
    v === "laozi" || v === "yinfu" || v === "laozi+yinfu" ? v : null;
  const mode = _cachedMode || _readPersistedMode() || "invert";
  const canon = _readPersistedCanon();
  const sf = _readPersistedSurfaceJson();
  const defM = validMode(sf.default);
  const defC = validCanon(sf.default_canon);
  const face = (k) => ({
    mode: validMode(sf[k]) || defM || mode,
    canon: validCanon(sf[k + "_canon"]) || defC || canon,
  });
  return {
    mode,
    canon,
    surf: { local: face("local"), cascade: face("cascade") },
  };
}

// ═══════════════════════════ HTTP 工具 ═══════════════════════════
function httpGetJson(url, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const req = http.get(
        url,
        {
          timeout: timeoutMs || 3000,
          agent: false,
          headers: { connection: "close" },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        try {
          req.destroy();
        } catch {}
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

function httpPostJson(url, data, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify(data);
      const u = new (require("node:url").URL)(url);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: "POST",
          timeout: timeoutMs || 3000,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
            connection: "close",
          },
          agent: false,
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        try {
          req.destroy();
        } catch {}
        resolve(null);
      });
      req.write(payload);
      req.end();
    } catch {
      resolve(null);
    }
  });
}

function httpDelete(url, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const u = new (require("node:url").URL)(url);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: u.pathname,
          method: "DELETE",
          timeout: timeoutMs || 3000,
          headers: { connection: "close" },
          agent: false,
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (c) => (body += c));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => {
        try {
          req.destroy();
        } catch {}
        resolve(null);
      });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

// ═══════════════════════════ SSE 客户端 ═══════════════════════════
// 订阅 源.js /origin/stream · 事件: hello/turn/mode/hb
// 断自愈: 指数退避 max 30s · 无 proxy 时静默重试
class DaoSseClient extends EventEmitter {
  constructor(port) {
    super();
    this._port = port || DEFAULT_PORT;
    this._req = null;
    this._res = null;
    this._reconnectTimer = null;
    this._backoffMs = 1000;
    this._stopped = false;
    this._connected = false;
    this._buf = "";
  }
  setPort(p) {
    if (p && p !== this._port) {
      this._port = p;
      this._close();
      if (!this._stopped) this._scheduleReconnect(100);
    }
  }
  isConnected() {
    return this._connected;
  }
  start() {
    this._stopped = false;
    this._connect();
  }
  stop() {
    this._stopped = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._close();
    this.removeAllListeners();
  }
  _close() {
    this._connected = false;
    try {
      if (this._req) this._req.destroy();
    } catch {}
    this._req = null;
    this._res = null;
    this._buf = "";
  }
  _scheduleReconnect(ms) {
    if (this._stopped) return;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(
      () => {
        this._reconnectTimer = null;
        this._connect();
      },
      ms != null ? ms : this._backoffMs,
    );
    this._backoffMs = Math.min(30000, Math.max(1000, this._backoffMs * 2));
  }
  _connect() {
    if (this._stopped || this._req) return;
    try {
      this._req = http.get(
        `http://127.0.0.1:${this._port}/origin/stream?replay=1`,
        {
          headers: { accept: "text/event-stream", "cache-control": "no-cache" },
          agent: false,
          timeout: 5000,
        },
        (res) => {
          this._res = res;
          if (res.statusCode !== 200) {
            res.resume();
            this._close();
            this._scheduleReconnect();
            return;
          }
          this._connected = true;
          this._backoffMs = 1000;
          try {
            if (res.socket && res.socket.setTimeout) res.socket.setTimeout(0);
          } catch {}
          try {
            this.emit("connect", { port: this._port });
          } catch {}
          res.setEncoding("utf8");
          res.on("data", (chunk) => this._onData(chunk));
          res.on("end", () => {
            this._close();
            if (!this._stopped) this._scheduleReconnect();
          });
          res.on("error", () => {
            this._close();
            if (!this._stopped) this._scheduleReconnect();
          });
        },
      );
      this._req.on("error", () => {
        this._close();
        if (!this._stopped) this._scheduleReconnect();
      });
      this._req.on("timeout", () => {
        try {
          this._req && this._req.destroy();
        } catch {}
      });
    } catch {
      this._close();
      if (!this._stopped) this._scheduleReconnect();
    }
  }
  _onData(chunk) {
    this._buf += chunk;
    let idx;
    while ((idx = this._buf.indexOf("\n\n")) >= 0) {
      const raw = this._buf.slice(0, idx);
      this._buf = this._buf.slice(idx + 2);
      this._dispatch(raw);
    }
  }
  _dispatch(raw) {
    let eventType = "message";
    const dataLines = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) eventType = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    const dataStr = dataLines.join("\n");
    let data = dataStr;
    try {
      data = JSON.parse(dataStr);
    } catch {}
    try {
      this.emit(eventType, data);
      this.emit("event", { type: eventType, data });
    } catch {}
  }
}

// ═══════════════════════════ 数据采集 · proxy-only ═══════════════════════════
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function gatherEssence(port) {
  if (!port)
    return { ts: new Date().toISOString(), proxy: null, proxyUp: false };
  const base = `http://127.0.0.1:${port}`;
  const ping = await withTimeout(
    httpGetJson(`${base}/origin/ping`, 1500),
    2500,
  );
  if (!ping)
    return { ts: new Date().toISOString(), proxy: null, proxyUp: false };
  // ★ v9.9.67 · 损 · 去 allinjects 死 fetch
  //   病: v9.9.19 面板瘦身 (slimData 不含 allInjects) 后, 此 fetch 仍每刷拉
  //       /origin/allinjects 全文 (~1MB) 而弃之不用 → 纯浪费 (30s 周期 + sig 变 + SSE 事件皆拉)
  //   治: 只拉 preview (面板实显所需) · 全槽数据仍由 /origin/allinjects 端点专供 (按需取)
  //   道义: 四十八章「为道日损」· 不取无用之物
  const proxy = await withTimeout(
    httpGetJson(`${base}/origin/preview`, 4000),
    5000,
  );
  const realprompt = null;
  const diag = {
    proxy_up: true,
    proxy_capturing: !!(proxy && proxy.has_captured_before),
    has_main: proxy ? !!proxy.has_main : false,
    aux_count: proxy ? proxy.aux_count || 0 : 0,
    agent_class: proxy && proxy.agent_class ? proxy.agent_class : null,
    proxy_stale: proxy && proxy.age_s != null && proxy.age_s > 300,
    mode: ping.mode,
    uptime_s: ping.uptime_s,
    req_total: ping.req_total,
    capture_count: ping.capture_count,
  };
  return {
    ts: new Date().toISOString(),
    proxy,
    realprompt,
    proxyUp: true,
    diag,
    ping,
  };
}

// ═══════════════════════════ 模式状态文本 ═══════════════════════════
function getModeLabel() {
  const mode = proxyGetMode();
  if (mode === "invert") return `道Agent · :${_cachedPort}`;
  return `官方Agent · 直连`;
}

// ═══════════════════════════════════════════════════════════════════
// v9.9.29 · 终端会话池 (印 160 · 反者道之动 · 弱者道之用)
// ═══════════════════════════════════════════════════════════════════
// 主公诏 5/19 3:11 (印 158→160 链):
//   「专注于最本源最核心的终端问题 如何从根本底层最小化解决终端一切问题」
//   「反者道之动 不依赖任何第三方 直接 dao-proxy-min 解决」
//   「推进到底 实现一切」
//
// 真本源诊 (七层污染 · 一招治):
//   ① OS cwd 是进程级单例 → 共享 shell 即共享 cwd
//   ② OS env 是进程级全局 → export 一染全染
//   ③ PTY 字节流无 frame → 多 writer 字节交织
//   ④ Shell $? %ERRORLEVEL% 是会话单例 → 上次毒化下次
//   ⑤ IDE 终端池默 reuse → cascade 复用一 terminal
//   ⑥ Agent 调用无状态 + 终端有状态 → 接口语义错配
//   ⑦ 多 agent 无同步 → 经典 race
//
// 真治 (一招):
//   每 agent 一独立 cmd.exe/bash 子进程 (cp.spawn /k mode)
//   stdin pipe 持续写命令 · stdout sentinel (RS+UUID) 包夹切片
//   Node 内置 child_process · 零第三方 · ~140 行类
//
// 道义:
//   四十「反者道之动 弱者道之用」(反"共享终端" · 用 child_process 弱柔)
//   六十四「治之于其未乱」(每命令独立 sentinel · 治未乱)
//   六十一「大邦下流 · 牝以靓胜牡」(每 sid 处下一 shell · 不争一终端)
//   廿八「朴散为器 · 圣人用则为官长」(spawn 之朴 · 散为多 shell 之器)
//   四十八「损之又损 至于无为」(零依赖 · 七层一招)
//
// 验: _test_v9929_term_pool.js · 15/15 PASS
// ═══════════════════════════════════════════════════════════════════

const _T_RS = "\u001E"; // ASCII Record Separator · 永不出现普通输出
const _T_DEFAULT_TIMEOUT = 120000;
const _T_IDLE_TTL_MS = 30 * 60 * 1000;
const _T_GC_INTERVAL_MS = 60_000;
const _T_MAX_BUF_BYTES = 4 * 1024 * 1024;

class DaoTerminalPool {
  constructor(opts = {}) {
    this.sessions = new Map();
    this.idleTtlMs = opts.idleTtlMs || _T_IDLE_TTL_MS;
    this.gcIntervalMs = opts.gcIntervalMs || _T_GC_INTERVAL_MS;
    this.maxBufBytes = opts.maxBufBytes || _T_MAX_BUF_BYTES;
    this._gcTimer = null;
    this._closed = false;
  }
  _spawnShell(sid) {
    const isWin = process.platform === "win32";
    let shell, args;
    if (isWin) {
      shell = process.env.ComSpec || "cmd.exe";
      args = ["/q", "/k", "@echo off & prompt $G"];
    } else {
      shell = process.env.SHELL || "/bin/bash";
      args = ["--norc", "--noprofile"];
    }
    const env = {
      ...process.env,
      DAO_AGENT_SID: sid,
      PROMPT: "$G ",
      PS1: "$ ",
      PS2: "",
      TERM: "dumb",
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      CLICOLOR: "0",
    };
    const cwd = process.env.USERPROFILE || process.env.HOME || process.cwd();
    return _origSpawn.call(cp, shell, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
  }
  _ensure(sid) {
    let s = this.sessions.get(sid);
    if (s && !s.closed) return s;
    const child = this._spawnShell(sid);
    s = {
      child,
      buf: "",
      errBuf: "",
      pending: null,
      closed: false,
      lastUsed: Date.now(),
      sid,
    };
    child.stdout.on("data", (d) => {
      s.buf += d.toString("utf8");
      if (s.buf.length > this.maxBufBytes)
        s.buf = s.buf.slice(-this.maxBufBytes);
      s.lastUsed = Date.now();
      this._tryComplete(sid);
    });
    child.stderr.on("data", (d) => {
      s.errBuf += d.toString("utf8");
      if (s.errBuf.length > this.maxBufBytes)
        s.errBuf = s.errBuf.slice(-this.maxBufBytes);
    });
    child.on("exit", () => {
      s.closed = true;
      if (s.pending) {
        clearTimeout(s.pending.timer);
        s.pending.reject(new Error(`shell 退 sid=${sid}`));
        s.pending = null;
      }
    });
    child.on("error", (e) => {
      s.closed = true;
      if (s.pending) {
        clearTimeout(s.pending.timer);
        s.pending.reject(new Error(`shell 错 sid=${sid}: ${e.message}`));
        s.pending = null;
      }
    });
    this.sessions.set(sid, s);
    return s;
  }
  exec(sid, cmd, opts = {}) {
    if (this._closed) return Promise.reject(new Error("pool closed"));
    if (typeof sid !== "string" || !sid)
      return Promise.reject(new Error("session_id 必填"));
    if (typeof cmd !== "string" || !cmd)
      return Promise.reject(new Error("cmd 必填"));
    const s = this._ensure(sid);
    if (s.pending)
      return Promise.reject(
        new Error(`session ${sid} 忙 (同会话串行 · 不同会话并行)`),
      );
    const eid = crypto.randomUUID();
    const BEG = `${_T_RS}DAO_BEG_${eid}${_T_RS}`;
    const END = `${_T_RS}DAO_END_${eid}${_T_RS}`;
    const isWin = process.platform === "win32";
    const timeout = opts.timeout || _T_DEFAULT_TIMEOUT;
    let wrapped;
    if (isWin) {
      // ver >nul 重置 ERRORLEVEL=0 · 防内置命令 (echo/cd) 不更新 errorlevel 之坑
      const cdPart = opts.cwd ? `cd /d "${opts.cwd}" & ` : "";
      wrapped = `echo ${BEG}\r\nver >nul\r\n${cdPart}${cmd}\r\necho ${END}EXIT=%ERRORLEVEL%\r\n`;
    } else {
      const cdPart = opts.cwd ? `cd "${opts.cwd}" && ` : "";
      const begLit = BEG.replace(/'/g, "'\\''");
      const endLit = END.replace(/'/g, "'\\''");
      wrapped = `printf '%s\\n' '${begLit}'\n{ ${cdPart}${cmd} ; }\nprintf '%sEXIT=%d\\n' '${endLit}' "$?"\n`;
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (s.pending && s.pending.eid === eid) {
          s.pending = null;
          // ★ v9.9.67 · 超时即闭此会话 (杀 shell) · 治输出交织之根
          //   病: 旧码超时仅清 pending 而命令仍在跑 → 下一 exec 与残命令输出交织
          //       → sentinel 错切 · 输出张冠李戴
          //   治: 闭会话 (stdin.end + kill) · 下次 _ensure 自起新 shell · 干净之境
          //       长命令者当自设 opts.timeout (默 120s)
          //   道义: 六十四章「为之于其未有也 治之于其未乱也」· 断于未乱
          try {
            s.child.stdin.end();
          } catch {}
          try {
            s.child.kill();
          } catch {}
          s.closed = true;
          reject(
            new Error(`exec timeout ${timeout}ms sid=${sid} (shell killed)`),
          );
        }
      }, timeout);
      s.pending = {
        eid,
        BEG,
        END,
        resolve,
        reject,
        timer,
        started: Date.now(),
      };
      try {
        s.child.stdin.write(wrapped);
      } catch (e) {
        clearTimeout(timer);
        s.pending = null;
        reject(new Error(`stdin 写失 sid=${sid}: ${e.message}`));
      }
    });
  }
  _tryComplete(sid) {
    const s = this.sessions.get(sid);
    if (!s || !s.pending) return;
    const { BEG, END, resolve, timer, eid } = s.pending;
    const begIdx = s.buf.indexOf(BEG);
    if (begIdx === -1) return;
    const endIdx = s.buf.indexOf(END, begIdx + BEG.length);
    if (endIdx === -1) return;
    const tail = s.buf.slice(endIdx + END.length);
    const m = tail.match(/EXIT=(-?\d+)/);
    if (!m) return;
    const body = s.buf.slice(begIdx + BEG.length, endIdx);
    const exit = parseInt(m[1], 10);
    const afterExit = endIdx + END.length + m.index + m[0].length;
    const nl = s.buf.indexOf("\n", afterExit);
    s.buf = nl >= 0 ? s.buf.slice(nl + 1) : s.buf.slice(afterExit);
    s.pending = null;
    clearTimeout(timer);
    const stderr = s.errBuf;
    s.errBuf = "";
    resolve({
      session_id: sid,
      exec_id: eid,
      stdout: body.replace(/^\s+|\s+$/g, ""),
      stderr: stderr.replace(/^\s+|\s+$/g, ""),
      exit,
    });
  }
  list() {
    return [...this.sessions.entries()].map(([sid, s]) => ({
      sid,
      busy: !!s.pending,
      closed: s.closed,
      idle_ms: Date.now() - s.lastUsed,
      buf_bytes: s.buf.length,
    }));
  }
  close(sid) {
    const s = this.sessions.get(sid);
    if (!s) return false;
    try {
      s.child.stdin.end();
    } catch {}
    try {
      s.child.kill();
    } catch {}
    if (s.pending) {
      clearTimeout(s.pending.timer);
      s.pending.reject(new Error(`session closed sid=${sid}`));
      s.pending = null;
    }
    this.sessions.delete(sid);
    return true;
  }
  closeAll() {
    for (const sid of [...this.sessions.keys()]) this.close(sid);
    if (this._gcTimer) {
      clearInterval(this._gcTimer);
      this._gcTimer = null;
    }
    this._closed = true;
  }
  startGc() {
    if (this._gcTimer) return;
    this._gcTimer = setInterval(() => {
      const now = Date.now();
      for (const [sid, s] of this.sessions) {
        if (s.closed || now - s.lastUsed > this.idleTtlMs) this.close(sid);
      }
    }, this.gcIntervalMs);
    if (this._gcTimer.unref) this._gcTimer.unref();
  }
}

// 单例池 · ext-host 内全局
let _DAO_TERM_POOL = null;
function _ensureTermPool() {
  if (!_DAO_TERM_POOL) {
    _DAO_TERM_POOL = new DaoTerminalPool();
    _DAO_TERM_POOL.startGc();
    L.info("term", "DaoTerminalPool 启 · 七层污染一招治");
  }
  return _DAO_TERM_POOL;
}

// HTTP /exec 兜底服务 · :12780 (per-user FNV 偏置 · 多账号自然隔离)
let _DAO_TERM_HTTP = null;
let _DAO_TERM_HTTP_PORT = 0;
function _termHttpPort() {
  // 复用 fnv1a 思想 · base 12780
  const u = (os.userInfo().username || "default").toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < u.length; i++) {
    h ^= u.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 12780 + (Math.abs(h) % 50); // 12780..12829
}
function _startDaoTermService(ctx) {
  if (_DAO_TERM_HTTP) return;
  const port = _termHttpPort();
  _DAO_TERM_HTTP_PORT = port;
  const http = require("node:http");
  const pool = _ensureTermPool();
  const server = http.createServer(async (req, res) => {
    res.setHeader("content-type", "application/json; charset=utf-8");
    // 仅 localhost 来源 · 安全
    const remoteAddr = req.socket.remoteAddress || "";
    if (
      remoteAddr !== "127.0.0.1" &&
      remoteAddr !== "::1" &&
      remoteAddr !== "::ffff:127.0.0.1"
    ) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "localhost only" }));
      return;
    }
    try {
      const u = new URL(req.url, `http://127.0.0.1:${port}`);
      if (req.method === "GET" && u.pathname === "/term/ping") {
        res.end(
          JSON.stringify({
            ok: true,
            version: PKG_VERSION,
            port,
            sessions: pool.list().length,
          }),
        );
        return;
      }
      if (req.method === "GET" && u.pathname === "/term/list") {
        res.end(JSON.stringify({ sessions: pool.list() }));
        return;
      }
      if (req.method === "POST" && u.pathname === "/term/exec") {
        const body = await _termReadBody(req);
        const { session_id, cmd, cwd, timeout } = body || {};
        if (!session_id || !cmd) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "session_id+cmd 必填" }));
          return;
        }
        const out = await pool.exec(session_id, cmd, { cwd, timeout });
        res.end(JSON.stringify(out));
        return;
      }
      if (req.method === "POST" && u.pathname === "/term/close") {
        const body = await _termReadBody(req);
        const ok = pool.close(body.session_id);
        res.end(JSON.stringify({ closed: ok }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
  });
  server.listen(port, "127.0.0.1", () => {
    L.info("term", `HTTP /term/* 启 :${port} (localhost only)`);
  });
  server.on("error", (e) => {
    L.warn("term", `http server err: ${e.message}`);
  });
  _DAO_TERM_HTTP = server;
  if (ctx && ctx.subscriptions) {
    ctx.subscriptions.push({
      dispose: () => {
        try {
          server.close();
        } catch {}
        if (_DAO_TERM_POOL) _DAO_TERM_POOL.closeAll();
        _DAO_TERM_HTTP = null;
        _DAO_TERM_POOL = null;
      },
    });
  }
}
function _termReadBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// 命令实现 · 命令面板可调
async function cmdTermExec() {
  try {
    const sid = await vscode.window.showInputBox({
      prompt: "session_id (sid · 同 sid 串行 · 不同 sid 并行)",
      value: "agent_default",
    });
    if (!sid) return;
    const cmd = await vscode.window.showInputBox({
      prompt: `命令 · sid=${sid}`,
      placeHolder:
        process.platform === "win32" ? "echo hello & dir" : "echo hello && ls",
    });
    if (!cmd) return;
    const pool = _ensureTermPool();
    const r = await pool.exec(sid, cmd);
    const stdoutSnip =
      r.stdout.length > 800 ? r.stdout.slice(0, 800) + " ..." : r.stdout;
    vscode.window.showInformationMessage(
      `[${sid}] exit=${r.exit} · stdout=${stdoutSnip}`,
      { modal: false },
    );
    L.info(
      "term",
      `cmdTermExec sid=${sid} exit=${r.exit} stdout_len=${r.stdout.length}`,
    );
  } catch (e) {
    L.error("term", `cmdTermExec fail: ${e.message}`);
    vscode.window.showErrorMessage(`term.exec 失: ${e.message}`);
  }
}
async function cmdTermList() {
  const pool = _ensureTermPool();
  const lst = pool.list();
  const lines =
    lst.length === 0
      ? "(无会话)"
      : lst
          .map(
            (s) =>
              `${s.sid} · busy=${s.busy} · idle=${Math.round(s.idle_ms / 1000)}s · buf=${s.buf_bytes}B`,
          )
          .join("\n");
  vscode.window.showInformationMessage(
    `终端会话池 (${lst.length}) · :${_DAO_TERM_HTTP_PORT}\n${lines}`,
    { modal: true },
  );
}
async function cmdTermClose() {
  const pool = _ensureTermPool();
  const lst = pool.list();
  if (lst.length === 0) {
    vscode.window.showInformationMessage("终端会话池: 无会话");
    return;
  }
  const pick = await vscode.window.showQuickPick(
    lst.map((s) => ({
      label: s.sid,
      description: `busy=${s.busy} idle=${Math.round(s.idle_ms / 1000)}s`,
    })),
    { placeHolder: "选会话关闭" },
  );
  if (!pick) return;
  const ok = pool.close(pick.label);
  vscode.window.showInformationMessage(
    `close ${pick.label} · ${ok ? "ok" : "fail"}`,
  );
}

// ═══════════════════════════ EssenceProvider · 本源观照 webview ═══════════════════════════
class EssenceProvider {
  constructor(ctx) {
    this._ctx = ctx;
    this._view = null;
    this._timer = null;
    this._sigTimer = null;
    this._busy = false;
    this._lastSig = "";
    this._sse = null;
    this._sseLastSpSig = "";
    this._setupSse();
  }

  _setupSse() {
    try {
      this._sse = new DaoSseClient(_cachedPort);
      this._sse.on("sp", (ev) => {
        if (!this._view) return;
        const sig = ev && ev.sig;
        if (sig && sig === this._sseLastSpSig) return;
        this._sseLastSpSig = sig || "";
        this.forceRefresh().catch(() => {});
      });
      this._sse.on("mode", (ev) => {
        if (!this._view) return;
        _cachedMode = (ev && ev.mode) || _cachedMode;
        try {
          this._view.webview.postMessage({ type: "mode", mode: ev && ev.mode });
        } catch {}
      });
      this._sse.on("connect", () => {
        if (this._view) this.forceRefresh().catch(() => {});
      });
      this._sse.start();
    } catch {
      this._sse = null;
    }
  }

  resolveWebviewView(webviewView) {
    L.info("webview", `resolveWebviewView called · port=${_cachedPort}`);
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      // v9.4.5 · localResourceRoots 必需 · 让 webview.asWebviewUri 能加载 media/*
      localResourceRoots: [
        vscode.Uri.joinPath(this._ctx.extensionUri, "media"),
      ],
      // portMapping: webview 内部 127.0.0.1:_cachedPort 直通 extensionHost 端
      portMapping: [
        { webviewPort: _cachedPort, extensionHostPort: _cachedPort },
      ],
    };
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (!msg) return;
      try {
        // v9.4.2 · 接 webview stage 回传 log (探真相)
        if (msg.command === "stage") {
          L.info("webview.stage", String(msg.stage || "?").slice(0, 120));
          return;
        }
        if (msg.command === "refresh") await this.refresh();
        else if (msg.command === "setMode") await this._handleSetMode(msg.mode);
        else if (msg.command === "getCustomSP") await this._handleGetCustomSP();
        else if (msg.command === "setCustomSP")
          await this._handleSetCustomSP(msg);
        else if (msg.command === "resetCustomSP")
          await this._handleResetCustomSP();
        else if (msg.command === "setCanon")
          await this._handleSetCanon(msg.canon);
      } catch {}
    });
    // v9.4.2 · SSR 道魂直嵌 · webview 一加载就见帛书全文 · 零 fetch/postMessage 依赖
    // 三十二章: 道恒无名 · 侯王若能守之 · 万物将自宾
    const ssrSp = _loadSilkForWebview();
    L.info(
      "webview",
      `SSR load · silk_chars=${ssrSp.length} port=${_cachedPort}`,
    );
    const _html = getEssenceHtml(
      _cachedPort,
      null,
      ssrSp,
      _initialPanelState(),
    );
    webviewView.webview.html = _html;
    // v9.4.5 · 强制 show webview · 否则 collapsed 时 JS 不跑
    try {
      webviewView.show(true);
      L.info("webview", `forced show(true) · visible=${webviewView.visible}`);
    } catch (e) {
      L.warn("webview", `show fail: ${e.message}`);
    }
    // v9.4.5 · dump 实际 html 到磁盘 · 离线诊
    // v9.9.20 jiqi 改 · 每次 resolveWebviewView 即覆写 · 反映当前版本之实 · 不再缓存旧版误诊
    // ★ v9.9.67 · 损 · dump 归 env 门控 (DAO_WEBVIEW_DUMP=1 方写)
    //   病: 每 resolveWebviewView 即写 ~/.dao-webview-dump.html · 卸后留痕于用户家目录
    //       (水过无痕之违) · 且含注入全文 · 隐私面
    //   治: 默认不写 · 需诊者 env 一开即得原行为
    if (process.env.DAO_WEBVIEW_DUMP === "1") {
      try {
        const dumpFp = path.join(os.homedir(), ".dao-webview-dump.html");
        fs.writeFileSync(dumpFp, _html, "utf8");
        L.info(
          "webview",
          `dumped html → ${dumpFp} (overwrite · v${PKG_VERSION})`,
        );
      } catch (e) {
        L.warn("webview", `dump fail: ${e.message}`);
      }
    }
    try {
      const _portMatch = _html.match(/var _PORT = ([^;]+);/);
      const _baseMatch = _html.match(/var _BASE = ([^;]+);/);
      // v9.9.20 jiqi 修 · 标记现已真实存在 · hasIife/hasWdbg=false 即源码裂 · 立即可观
      const _hasIife = _html.indexOf("_wdbg('iife-start'") >= 0;
      const _hasPull = _html.indexOf("function pull(") >= 0;
      const _hasWdbg = _html.indexOf("function _wdbg(") >= 0;
      L.info(
        "webview",
        `html set \u00b7 len=${_html.length} _PORT=${_portMatch ? _portMatch[1] : "?"} _BASE=${_baseMatch ? _baseMatch[1] : "?"} hasIife=${_hasIife} hasPull=${_hasPull} hasWdbg=${_hasWdbg}`,
      );
    } catch (e) {
      L.warn("webview", `html dbg fail: ${e.message}`);
    }
    // v9.4.5 · 5s 自检 webview 是否真活 (_wdbg ringbuf 是否含 iife-start)
    setTimeout(async () => {
      try {
        const beforeCount = (
          await httpGetJson(
            `http://127.0.0.1:${_cachedPort}/origin/_wdbg`,
            1500,
          )
        ).count;
        // 触一次 postMessage 看 webview 是否反应
        if (this._view) {
          this._view.webview.postMessage({
            command: "_diag-ping",
            ts: Date.now(),
          });
        }
        await new Promise((r) => setTimeout(r, 1500));
        const after = await httpGetJson(
          `http://127.0.0.1:${_cachedPort}/origin/_wdbg`,
          1500,
        );
        const liveStart = after.log.find((x) => x.msg === "iife-start");
        const msgRecv = after.log.find(
          (x) => x.msg === "msg-recv" && x.tag === "_diag-ping",
        );
        L.info(
          "webview",
          `5s diag \u00b7 wdbg_count=${after.count} iife_start=${!!liveStart} diag_recv=${!!msgRecv} (before=${beforeCount})`,
        );
        if (!liveStart) {
          L.warn(
            "webview",
            `webview JS NOT alive \u00b7 iife-start \u672a\u5230 \u00b7 \u53ef\u80fd\u88ab CSP/parse \u62e6`,
          );
        }
      } catch (e) {
        L.warn("webview", `5s diag fail: ${e.message}`);
      }
    }, 5000);
    webviewView.onDidChangeVisibility(() => {
      L.info("webview", `visibility → ${webviewView.visible}`);
      if (webviewView.visible) {
        this.refresh().catch((e) =>
          L.warn("refresh", `vis fail: ${e.message}`),
        );
        this._armTimer();
      } else this._stopTimer();
    });
    webviewView.onDidDispose(() => {
      L.info("webview", "disposed");
      this._view = null;
      this._stopTimer();
    });
    this._armTimer();
    // 主动首推 · 不依赖 webview 'refresh' 消息 (CSP/race-safe · 反者道之动)
    // v9.9.36 · 延迟首推 · 减轻启动期 HTTP 请求压力
    setTimeout(() => this.refresh().catch(() => {}), 3000);
    setTimeout(() => this.refresh().catch(() => {}), 8000);
    setTimeout(() => this.refresh().catch(() => {}), 15000);
  }

  _armTimer() {
    this._stopTimer();
    if (!this._view || !this._view.visible) return;
    // v7.3→v9.9.36: 后备 timer 30s (原 12s), sig poll 5s (原 1.5s)
    // 減轻 ext-host 事件循环压力 · UNRESPONSIVE 根因之一
    this._timer = setInterval(() => this.refresh().catch(() => {}), 30000);
    this._sigTimer = setInterval(() => this._sigTick().catch(() => {}), 5000);
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._sigTimer) {
      clearInterval(this._sigTimer);
      this._sigTimer = null;
    }
  }

  async _sigTick() {
    if (!this._view || !this._view.visible || this._busy) return;
    if (this._sse && this._sse.isConnected()) {
      this._sigSkipCounter = (this._sigSkipCounter || 0) + 1;
      if (this._sigSkipCounter % 10 !== 0) return;
    }
    try {
      const sig = await httpGetJson(
        `http://127.0.0.1:${_cachedPort}/origin/sig`,
        800,
      );
      if (!sig || !sig.ok) return;
      // sig 接 _customSP / _injectsByKind / _spCandidates 变动 · 一签观全境
      const cur = `${sig.mode}|${sig.sp_sig}|${sig.custom_sig || "0"}|${sig.custom_sp_at || 0}|${sig.injects_last_at || 0}|${sig.spc_last_at || 0}|${sig.injects_count || 0}`;
      if (cur === this._lastSig) return;
      this._lastSig = cur;
      this.refresh().catch(() => {});
    } catch {}
  }

  async refresh() {
    if (!this._view) {
      L.info("refresh", "skip · _view null");
      return;
    }
    if (this._busy) {
      L.info("refresh", "skip · busy");
      return;
    }
    this._busy = true;
    try {
      const data = await gatherEssence(_cachedPort);
      if (!this._view) {
        L.info("refresh", "skip · _view became null after gather");
        return;
      }
      data.modeLabel = getModeLabel();
      data._port = _cachedPort;
      const afterChars =
        (data.proxy &&
          (data.proxy.after_chars || (data.proxy.after || "").length)) ||
        0;
      // v9.9.19 · 损之又损 · 精简postMessage · 去大对象 · webview IPC过载根治
      // proxy=872KB(含injects_by_kind) + allInjects=822KB → 致1.7MB IPC→webview冻结
      // 修: 仅传 ping(~1KB) + proxy.after(~20KB) · 减至~22KB
      const slimProxy = data.proxy
        ? {
            ok: data.proxy.ok,
            after: data.proxy.after,
            after_chars: afterChars,
            age_s: data.proxy.age_s,
            has_captured_before: data.proxy.has_captured_before,
            before_chars: data.proxy.before_chars,
          }
        : null;
      const slimData = {
        ts: data.ts,
        ping: data.ping,
        proxyUp: data.proxyUp,
        proxy: slimProxy,
        modeLabel: data.modeLabel,
        _port: data._port,
      };
      try {
        const ok = await this._view.webview.postMessage({
          type: "data",
          data: slimData,
        });
        L.info(
          "refresh",
          `postMessage ok=${ok} · proxy=${!!slimProxy} · after=${afterChars} · visible=${this._view.visible}`,
        );
        if (!ok)
          L.warn("refresh", "postMessage returned false (webview not ready?)");
      } catch (e) {
        L.warn("refresh", `postMessage error: ${e.message}`);
      }
    } catch (e) {
      L.warn("refresh", `gather/send error: ${e.message}`);
    } finally {
      this._busy = false;
    }
  }

  async forceRefresh() {
    this._busy = false;
    await this.refresh();
  }

  async _handleSetMode(mode) {
    if (mode === "dao" || mode === "invert") await cmdInvert();
    else await cmdPassthrough();
    this._lastSig = "";
    setTimeout(() => this.forceRefresh().catch(() => {}), 300);
  }

  async _handleGetCustomSP() {
    if (!this._view) return;
    try {
      const r = await httpGetJson(
        `http://127.0.0.1:${_cachedPort}/origin/custom_sp`,
        2000,
      );
      // v9.7.6 · 十四章「执今之道·以御今之有」· 透传 default_sp 供 webview 兜底填 textarea
      await this._view.webview.postMessage({
        type: "customSP",
        action: "get",
        has_custom: r && r.has_custom,
        sp: r && r.sp,
        chars: r && r.chars,
        keep_blocks: r && r.keep_blocks,
        default_sp: r && r.default_sp,
        default_chars: r && r.default_chars,
        default_source: r && r.default_source,
      });
    } catch {
      try {
        await this._view.webview.postMessage({
          type: "customSP",
          action: "get",
          has_custom: false,
        });
      } catch {}
    }
  }

  async _handleSetCustomSP(msg) {
    if (!this._view) return;
    try {
      // v7.8 一态整替 · keep_blocks 永 false (服务端 invertSP 永整替)
      const r = await httpPostJson(
        `http://127.0.0.1:${_cachedPort}/origin/custom_sp`,
        { sp: msg.sp, keep_blocks: false, source: "webview" },
        3000,
      );
      await this._view.webview.postMessage({
        type: "customSP",
        action: "set",
        ok: r && r.ok,
        chars: r && r.chars,
        error: r && r.error,
      });
      if (r && r.ok) {
        this._lastSig = "";
        setTimeout(() => this.forceRefresh().catch(() => {}), 300);
      }
    } catch (e) {
      try {
        await this._view.webview.postMessage({
          type: "customSP",
          action: "set",
          ok: false,
          error: e.message,
        });
      } catch {}
    }
  }

  async _handleResetCustomSP() {
    if (!this._view) return;
    try {
      const r = await httpDelete(
        `http://127.0.0.1:${_cachedPort}/origin/custom_sp`,
        2000,
      );
      await this._view.webview.postMessage({
        type: "customSP",
        action: "reset",
        ok: r && r.ok,
      });
      if (r && r.ok) {
        this._lastSig = "";
        setTimeout(() => this.forceRefresh().catch(() => {}), 300);
      }
    } catch {
      try {
        await this._view.webview.postMessage({
          type: "customSP",
          action: "reset",
          ok: false,
        });
      } catch {}
    }
  }

  // 经藏切换 · 道生一 · webview 下拉 -> proxy /origin/canon -> 热切
  async _handleSetCanon(canon) {
    if (!this._view) return;
    try {
      const r = await httpPostJson(
        `http://127.0.0.1:${_cachedPort}/origin/canon`,
        { canon: String(canon || "laozi") },
        2000,
      );
      // v9.9.67 · 修 log() 未定义之病 · 四十八章「为道日损」· 此处原引 log(不存在) →
      //   ReferenceError → canonChanged 推送与 forceRefresh 皆断 → 面板切经藏无反馈
      L.info(
        "canon",
        `canon -> ${canon} (ok=${r && r.ok}, chars=${r && r.chars})`,
      );
      this._lastSig = "";
      // v9.9.22 · 切经文即推新 default_sp · 不依赖 tape entry (tape 仍是切前)
      // 道义: 二十五章「逝曰远 远曰反」· 名实变即推 · 不滞旧
      try {
        const cs = await httpGetJson(
          `http://127.0.0.1:${_cachedPort}/origin/custom_sp`,
          2000,
        );
        if (cs && cs.ok && this._view) {
          await this._view.webview.postMessage({
            type: "canonChanged",
            canon: r && r.canon,
            canon_name: r && r.canon_name,
            chars: r && r.chars,
            default_sp: cs.default_sp,
            default_chars: cs.default_chars,
            default_source_name: cs.default_source_name,
            has_custom: cs.has_custom,
          });
          L.info(
            "canon",
            `canon push canonChanged · canon=${r && r.canon} · default_chars=${cs.default_chars} · has_custom=${cs.has_custom}`,
          );
        }
      } catch (e) {
        L.warn("canon", `canon push default_sp fail: ${e && e.message}`);
      }
      setTimeout(() => this.forceRefresh().catch(() => {}), 300);
    } catch (e) {
      L.error("canon", `canon set fail: ${e && e.message}`);
    }
  }

  dispose() {
    this._stopTimer();
    try {
      if (this._sse) this._sse.stop();
    } catch {}
    this._sse = null;
    this._view = null;
  }
}

// ═══════════════════════════ 命令: 道Agent ═══════════════════════════
async function cmdInvert() {
  try {
    const { port } = cfg();
    const wasAnchored = _cachedAnchored;
    await proxyStart(port, "invert");
    proxySetMode("invert");
    await setAnchor(port);
    installSpawnHook();
    // 首次锚定才需重启 LS · 已锚定则纯翻转模式即可
    if (!wasAnchored) {
      L.info("cmd-invert", `first anchor → killing LS`);
      const killed = await forceRestartLS();
      if (killed) {
        vscode.window.showInformationMessage(
          `道Agent · 已启 :${port} · LS 重启中`,
        );
      } else {
        const c = await vscode.window.showInformationMessage(
          `道Agent · 已启 · 未找到 LS`,
          "重载窗口",
          "稍后",
        );
        if (c === "重载窗口")
          await vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    } else {
      L.info("cmd-invert", `mode flipped → invert (zero-cost)`);
      vscode.window.showInformationMessage(
        `道Agent · 帛书德道经 SP 注入 · 下次对话生效`,
      );
    }
  } catch (e) {
    vscode.window.showErrorMessage(`道Agent 启失: ${e && e.message}`);
    L.error("cmd-invert", e && e.message);
  }
}

// ═══════════════════════════ 命令: 官方Agent ═══════════════════════════
// 官方模式 = proxy 仍运行但透传 · 不改 SP · 可观照 · 零代价热切
async function cmdPassthrough() {
  try {
    const { port } = cfg();
    // 确保 proxy 运行 (观照需要)
    await proxyStart(port, "passthrough");
    proxySetMode("passthrough");
    L.info(
      "cmd-pass",
      `mode flipped → passthrough (proxy stays for observation)`,
    );
    vscode.window.showInformationMessage(
      `官方Agent · 透传观照 · SP 不改 · 下次对话生效`,
    );
  } catch (e) {
    vscode.window.showErrorMessage(`官方Agent 切换失败: ${e && e.message}`);
    L.error("cmd-pass", e && e.message);
  }
}

// ═══════════════════════════ 命令: 切换 ═══════════════════════════
async function cmdToggle() {
  const cur = proxyGetMode();
  if (cur === "invert") await cmdPassthrough();
  else await cmdInvert();
}

// ═══════════════════════════ 命令: 浏览器观 ═══════════════════════════
async function cmdOpenPreview() {
  const url = `http://127.0.0.1:${_cachedPort}/origin/preview`;
  try {
    await vscode.env.openExternal(vscode.Uri.parse(url));
  } catch {}
}

// ═══════════════════════════ 命令: E2E 自检 ═══════════════════════════
async function cmdVerifyE2E() {
  await cmdSelftest();
}

// ═══════════════════════════ 命令: 自检 ═══════════════════════════
async function cmdSelftest() {
  const out = logger();
  out.show(true);
  out.appendLine("");
  out.appendLine("════════════════════════════════════════");
  out.appendLine(
    `  道Agent v${PKG_VERSION} · 自检 · ${new Date().toISOString()}`,
  );
  out.appendLine("════════════════════════════════════════");

  const { port } = cfg();

  // ★ v9.9.70 · L0 闭环判决 (名实终一) —— /origin/verify 由录存线上真值判
  //   ok_wire_inverted=发改证成 · ok_passthrough=透传证成 · warn_should_invert=应改未改(真病灶)
  out.appendLine("\n── L0 · 闭环判决 (线上真值 · /origin/verify) ──");
  try {
    const v = await httpGetJson(
      `http://127.0.0.1:${port}/origin/verify`,
      3000,
    );
    if (v && v.last) {
      const l = v.last;
      const icon = l.verdict && l.verdict.startsWith("ok") ? "✓" : "⚠";
      out.appendLine(
        `  ${icon} ${l.verdict} · ${l.surface || "?"}面·${l.mode_eff || "?"} · ` +
          `${l.kind || "?"} · ${l.before_chars || 0}→${l.after_chars || 0}字 · ` +
          `发改=${l.transformed} · 线源=${l.after_source || "?"} · ${l.age_s != null ? l.age_s + "s前" : "?"}`,
      );
      if (v.surface_modes) {
        out.appendLine(
          `  面实况: L=${v.surface_modes.local || "?"} C=${v.surface_modes.cascade || "?"} G=${v.mode || "?"}`,
        );
      }
      if (l.after_head) {
        out.appendLine(`    线实头: ${String(l.after_head).slice(0, 70)}…`);
      }
      if (l.verdict === "warn_should_invert") {
        out.appendLine(
          `  ⚠ 应改未改 —— 该面模式要求发改而线上 SP 同原文 · 此即「面板所示 vs LLM 实收」分裂之病灶`,
        );
      } else if (l.verdict === "no_capture") {
        out.appendLine(
          `  ⚠ tape 空 —— 无任何流量入此口 · 若刚对话过 → 请求未经代理 (锚漂/绕行)`,
        );
      }
    } else {
      out.appendLine("  ⚠ /origin/verify 无判词 (代理未启或旧版)");
    }
  } catch (e) {
    out.appendLine(`  ✗ L0 异: ${e.message}`);
  }

  // L1: 损 selftest endpoint (v9.7.0 为道日损) · 走 ping 之 features 诊
  out.appendLine("\n── L1 · 帛书+大常 (从 /origin/ping 取 features) ──");
  try {
    const r = await httpGetJson(`http://127.0.0.1:${port}/origin/ping`, 3000);
    if (r && r.features) {
      out.appendLine(
        `  ✓ 帛书《老子》: dao=${r.dao_chars}字 · header=${r.features.tao_header_chars}字 · 注入总=${r.features.inject_total_chars}字`,
      );
      out.appendLine(`  ✓ ${r.features.principle}`);
      for (const [k, v] of Object.entries(r.features.rpc_classes || {})) {
        out.appendLine(`    ${k}: ${v}`);
      }
    } else {
      out.appendLine("  ⚠ /origin/ping 无 features (代理未启?)");
    }
  } catch (e) {
    out.appendLine(`  ✗ L1 异: ${e.message}`);
  }

  // L2: proxy 路径
  out.appendLine("\n── L2 · 反代路径 ──");
  out.appendLine(
    `  port: ${port} (per-user) · anchored: ${isAnchored()} · mode: ${proxyGetMode()}`,
  );
  try {
    const ping = await httpGetJson(
      `http://127.0.0.1:${port}/origin/ping`,
      2000,
    );
    if (ping) {
      out.appendLine(
        `  ✓ proxy up: v=${ping.version} mode=${ping.mode} uptime=${ping.uptime_s}s req=${ping.req_total} cap=${ping.capture_count}`,
      );
    } else {
      out.appendLine("  ✗ proxy unreachable");
    }
  } catch (e) {
    out.appendLine(`  ✗ ping: ${e.message}`);
  }

  try {
    const last = await httpGetJson(
      `http://127.0.0.1:${port}/origin/lastinject`,
      2000,
    );
    if (last && last.has_inject) {
      out.appendLine(
        `  最近注入: ${last.at ? new Date(last.at).toISOString() : "?"} ${last.rpc || last.url || ""}`,
      );
      out.appendLine(
        `    before(${last.before_chars || 0}字): ${(last.before_head || "").slice(0, 80)}…`,
      );
      out.appendLine(
        `    after(${last.after_chars || 0}字): ${(last.after_head || "").slice(0, 80)}…`,
      );
    }
  } catch {}

  try {
    const paths = await httpGetJson(
      `http://127.0.0.1:${port}/origin/paths?n=10`,
      2000,
    );
    if (paths && paths.top && paths.top.length) {
      out.appendLine(`\n  路径直方图 (${paths.total_paths} paths):`);
      for (const p of paths.top) {
        const tags = [];
        if (p.is_chat) tags.push("CHAT");
        if (p.replaced > 0) tags.push(`✓${p.replaced}`);
        out.appendLine(
          `    ${String(p.count).padStart(5)} ${p.path} [${tags.join(",")}]`,
        );
      }
    }
  } catch {}

  out.appendLine("\n── L3 · 活检指引 ──");
  out.appendLine(`  1. 运行 "道Agent: 启" → LS 重启 → 向 Cascade 问 '你是谁'`);
  out.appendLine(`  2. 期答含 '道'/'无为'/'自然' (帛书德道经 SP 注入成功)`);
  out.appendLine("════════════════════════════════════════\n");
}

// ═══════════════════════════ HTML · 本源观照 ═══════════════════════════
function _genNonce() {
  // 32-char hex nonce · CSP-strict · 道法自然
  const a = new Uint8Array(16);
  for (let i = 0; i < 16; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
// HTML 转义 · SSR 嵌入 <pre> textContent 需之
function _escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// v9.9.20 两经归一 · 加载帛书+道藏阴符 (webview SSR 用) · 与 source.js 同源 · 复归无名
// 道魂 = TAO_HEADER + 帛书·德经 + "\n\n" + 帛书·道经 + "\n\n" + 道藏《阴符经》 + TAO_FOOTER(空)
// 主公命: 「最终提示词仅需要帛书老子和最早期本源阴符经便可」 · 默 canon=laozi+yinfu
function _loadSilkForWebview() {
  try {
    const vendorDir = path.join(__dirname, "vendor", "bundled-origin");
    const deFp = path.join(vendorDir, "_silk_de.txt");
    const daoFp = path.join(vendorDir, "_silk_dao.txt");
    const yinfuFp = path.join(vendorDir, "_yinfu.txt");
    if (!fs.existsSync(deFp) || !fs.existsSync(daoFp)) return "";
    const deText = fs.readFileSync(deFp, "utf8").trim();
    const daoText = fs.readFileSync(daoFp, "utf8").trim();
    const yinfuText = fs.existsSync(yinfuFp)
      ? fs.readFileSync(yinfuFp, "utf8").trim()
      : "";
    if (!deText || !daoText) return "";
    // v9.9.38 · 帧宽修正 · 四十二章「道生一·一生二·二生三·三生万物」
    // 「所有文本」覆道经+keeps · 「本源」为根基非独占规则 · 「所遵从」保约束力
    const TAO_HEADER =
      "你本无名 名可名也 非恒名也 下述所有文本为你所遵从之本源：\n\n";
    const SILK_BOUNDARY = "\n\n";
    const TAO_FOOTER = "";
    const body = yinfuText
      ? deText + SILK_BOUNDARY + daoText + SILK_BOUNDARY + yinfuText
      : deText + SILK_BOUNDARY + daoText;
    return TAO_HEADER + body + TAO_FOOTER;
  } catch {
    return "";
  }
}

// ★ v9.9.67 · 损死参 + SSR 实嵌 · 名实终一
//   病: getEssenceHtml(port, nonce, initialSP, webview, extensionUri) 五参之中
//       initialSP/webview/extensionUri 三参从未入模板 — 「SSR 道魂直嵌」有名无实,
//       webview 首屏恒「(待首次对话)」· 帛书全文从未直嵌。
//   治: initialSP 实嵌 <pre> (escape) + 实嵌脚本 lastSP (JSON.stringify 插值安全:
//       模板字面量插值不重扫值内容) · webview/extensionUri 两死参出列。
//   道义: 一章「名可名也 非恒名也」· 名实相符 · 三十二章「侯王若能守之 万物将自宾」
function getEssenceHtml(port, nonce, initialSP, initState) {
  // v9.8.0 · 守一不离 · 三十九章「得一」· 复 @ 工具之根 · 名实终一
  // 痛: SIDE_CHANNEL_TAGS 含 'additional_metadata' · 致用户消息中 @ 项之元 (Cascade ID/file path/line range) 被剥
  //     agent 失 @ 项之元 · trajectory_search/read_file 等 @ 工具调用败 · 此为 v9.7.x 之底病
  // 治: source.js · SIDE_CHANNEL_TAGS 删 'additional_metadata' · 守 @ 项与元之一体 ·「得一」之实
  // 兼: tape all_fields raw_text 字段亦显 AFTER (post strip + neutralize) · 主公照观面板见 LLM 实收 · 名实终一
  // v9.7.9 · 道法自然 · 反者道之动 · 中性化隐藏 SECTION_OVERRIDE 身份锚
  // 二十五章「道法自然」· 替 Windsurf 客户端隐藏 JSON {"mode":"SECTION_OVERRIDE_MODE_APPEND","content":"...respond with `Cascade`"} 之 content 为「道法自然」
  // 治根: neutralizeHiddenOverrides 集成至 deepStripProtoSideChannels · 复合两治 (剥 SIDE_CHANNEL XML + 中性化 SECTION_OVERRIDE JSON)
  // v9.7.8 三十辐共一毂 (十一章) · invertSP/invertAnySP 默路接 extractKeepBlocks · 复 7 辐 (tool_calling/mcp_servers/user_information/workspace_information)
  // v9.7.7 复归于朴 (二十八章) · TAO_HEADER 损至 31 字 · 帛书裸呈
  // v9.7.6 四治承之 (default_sp 永返 · 透传 · 兜底填 textarea · boot 预拉)
  // 病四治: A · [归道] reset 后强拉 default_sp 帛书 (不沿 lastSP · lastSP 已被 chat 覆盖)
  //         B · 注入文 (TAO_HEADER 31字 + 帛书合 ~7204 + TAO_FOOTER 0 = ~7237 字 道魂) + (TAO_TRAILER + 7 辐 keeps) 中性化追加
  //         C · @ 工具复用 · 至简非至废
  //         D · 隐藏 SECTION_OVERRIDE_MODE_APPEND 身份锚中性化 · 模型不再被强令"respond with Cascade"
  const N = nonce || _genNonce();
  const proxyPort = port || 0;
  // ★ v9.9.67 · SSR 真态首绘 · initState 由 _initialPanelState() 供 (持久态同律解析)
  //   预渲 active/selected → 首绘即实 · 下拉不跳 · 钮不迟亮
  const _is = initState || {};
  const _im = _is.mode || "invert";
  const _ic = _is.canon || "laozi+yinfu";
  const _isf = _is.surf || {};
  const _ilm = (_isf.local && _isf.local.mode) || _im;
  const _icm = (_isf.cascade && _isf.cascade.mode) || _im;
  const _ilc = (_isf.local && _isf.local.canon) || _ic;
  const _icc = (_isf.cascade && _isf.cascade.canon) || _ic;
  const _sfCls = (cur) =>
    cur === "invert"
      ? " active active-dao"
      : cur === "custom"
        ? " active active-custom"
        : " active";
  const _daoCls = (cur) => (cur === "invert" ? _sfCls(cur) : "");
  const _offCls = (cur) => (cur === "passthrough" ? _sfCls(cur) : "");
  const _custCls = (cur) => (cur === "custom" ? _sfCls(cur) : "");
  const _oSel = (v, cur) => (v === cur ? " selected" : "");
  const _INIT = {
    mode: _im,
    canon: _ic,
    surf: {
      local: { mode: _ilm, canon: _ilc },
      cascade: { mode: _icm, canon: _icc },
    },
  };
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${N}'; connect-src http://127.0.0.1:* http://localhost:*; img-src data:;">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: var(--vscode-font-family); color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background, transparent);
    margin: 0; padding: 6px 8px; font-size: 12px; line-height: 1.55;
    display: flex; flex-direction: column;
  }
  .bar { display: flex; gap: 3px; align-items: center; margin-bottom: 3px; flex: 0 0 auto; font-size: 10px; flex-wrap: wrap; }

  .mb {
    padding: 1px 7px; font-size: 11px; border: 1px solid rgba(128,128,128,0.3);
    background: transparent; color: var(--vscode-foreground);
    cursor: pointer; border-radius: 3px; font-family: inherit;
    opacity: 0.55; line-height: 1.3; transition: all 0.15s; font-weight: 500;
  }
  .mb:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.15)); }
  .mb.active { opacity: 1; border-color: var(--vscode-textLink-foreground, #4fc1ff); color: var(--vscode-textLink-foreground, #4fc1ff); background: rgba(79,193,255,0.1); font-weight: 700; }
  .mb.active-dao { border-color: #6bb86b; color: #6bb86b; background: rgba(107,184,107,0.1); }
  .dots { display: inline-flex; gap: 2px; align-items: center; padding: 0 4px; cursor: help; }
  .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: rgba(128,128,128,0.3); }
  .dot.ok { background: #6bb86b; } .dot.warn { background: #d9a200; } .dot.err { background: #e08080; }
  /* 守朴 · stat 默认藏 · 详态始显 · 无 kind 彩色分类 pill (道可道·非恒道) */
  .stat { font-size: 10px; opacity: 0.55; margin: 0 0 4px; line-height: 1.4; font-family: monospace; display: none; }
  .stat.show { display: block; }
  .stat .pill { padding: 1px 5px; border-radius: 2px; background: rgba(128,128,128,0.12); margin-right: 4px; }
  #sp {
    flex: 1 1 auto; overflow: auto; margin: 0; padding: 10px 12px;
    font-family: "Noto Serif CJK SC", "Microsoft YaHei", var(--vscode-editor-font-family), serif;
    font-size: 11.5px; line-height: 1.75; white-space: pre-wrap; word-break: break-word;
    background: rgba(0,0,0,0.08); border-radius: 3px;
  }
  #sp.quiet { text-align: center; opacity: 0.5; font-style: italic; padding: 40px 0; letter-spacing: 1px; }
  #editArea { display: none; flex: 1 1 auto; flex-direction: column; }
  #editArea.show { display: flex; }
  #editArea textarea {
    flex: 1 1 auto; resize: none; border: 1px solid rgba(128,128,128,0.3); border-radius: 3px; padding: 8px 10px;
    font-family: "Noto Serif CJK SC", "Microsoft YaHei", var(--vscode-editor-font-family), serif;
    font-size: 11.5px; line-height: 1.75;
    background: var(--vscode-input-background, rgba(0,0,0,0.12)); color: var(--vscode-input-foreground, var(--vscode-foreground));
    outline: none; min-height: 120px;
  }
  #editArea textarea:focus { border-color: var(--vscode-focusBorder, #007fd4); }
  .edit-bar { display: flex; gap: 4px; align-items: center; margin-top: 4px; flex: 0 0 auto; font-size: 10px; }
  .edit-bar .eb {
    padding: 2px 8px; font-size: 10px; border: 1px solid rgba(128,128,128,0.3);
    background: transparent; color: var(--vscode-foreground); cursor: pointer; border-radius: 3px;
    font-family: inherit; line-height: 1.4; transition: all 0.15s;
  }
  .edit-bar .eb:hover { background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.15)); }
  .edit-bar .eb.save { border-color: #6bb86b; color: #6bb86b; }
  .edit-bar .eb.save:hover { background: rgba(107,184,107,0.15); }
  .edit-bar .eb.reset { border-color: #e08080; color: #e08080; }
  .edit-bar .eb.reset:hover { background: rgba(224,128,128,0.15); }
  .edit-bar .edit-status { opacity: 0.7; margin-left: auto; font-size: 9px; }
  .edit-bar .edit-count { opacity: 0.55; font-size: 9px; margin-left: 4px; font-variant-numeric: tabular-nums; }
  .edit-bar .eb.reload { border-color: #80b0e0; color: #80b0e0; }
  .edit-bar .eb.reload:hover { background: rgba(128,176,224,0.15); }
  .edit-hint { font-size: 9px; opacity: 0.55; margin-bottom: 3px; padding: 2px 4px; font-style: italic; flex: 0 0 auto; }
  .custom-badge { display: inline-block; font-size: 8px; padding: 0 4px; border-radius: 2px; background: rgba(232,160,64,0.2); color: #e8a040; border: 1px solid rgba(232,160,64,0.3); margin-left: 4px; }

  /* v9.9.376 · 两面分治 · 道/官 分面开关 (L=Devin Local · C=Cascade) */
  .sf-sep { opacity: 0.3; margin: 0 2px; }
  .sf-label { font-size: 9px; opacity: 0.6; font-weight: 700; margin: 0 1px 0 4px; cursor: default; }
  .mb.sf { padding: 1px 5px; font-size: 10px; min-width: 24px; }
  .mb.sf.active { opacity: 1; border-color: var(--vscode-textLink-foreground, #4fc1ff); color: var(--vscode-textLink-foreground, #4fc1ff); background: rgba(79,193,255,0.1); font-weight: 700; }
  .mb.sf.active-dao { border-color: #6bb86b; color: #6bb86b; background: rgba(107,184,107,0.1); }
  .mb.sf.active-custom { border-color: #d0a44a; color: #d0a44a; background: rgba(208,164,74,0.12); }
  .scn { font-size: 10px; padding: 0 1px; max-width: 56px; border: 1px solid rgba(128,128,128,0.3); background: var(--vscode-dropdown-background, rgba(0,0,0,0.2)); color: var(--vscode-dropdown-foreground, #ccc); }
</style>
</head>
<body data-port="${proxyPort}">
  <div class="bar">
    <span class="dots" id="dots" title="Proxy\u00b7Capture\u00b7Mode"></span>
    <span class="sf-sep">|</span>
    <span class="sf-label" title="Devin Local \u00b7 devin-cli ACP \u00b7 api_server_pb \u9762">L</span>
    <button class="mb sf${_daoCls(_ilm)}" id="btnLDao" title="Devin Local \u2192 \u9053(\u9694\u79bb\u66ff\u6362)">L\u9053</button>
    <button class="mb sf${_offCls(_ilm)}" id="btnLOff" title="Devin Local \u2192 \u5b98(\u5b8c\u5168\u5b98\u65b9\u900f\u4f20)">L\u5b98</button>
    <button class="mb sf${_custCls(_ilm)}" id="btnLCustom" title="Devin Local \u2192 \u7f16\u5199\u63d0\u793a\u8bcd(custom)">L\u7f16</button>
    <select class="scn" id="canonL" title="Devin Local \u5178\u6e90\u00b7\u5e1b\u4e66\u8001\u5b50/\u9053\u85cf\u9634\u7b26\u7ecf/\u5408\u4e00">
      <option value="laozi+yinfu"${_oSel("laozi+yinfu", _ilc)}>\u5408\u4e00</option>
      <option value="laozi"${_oSel("laozi", _ilc)}>\u8001\u5b50</option>
      <option value="yinfu"${_oSel("yinfu", _ilc)}>\u9634\u7b26</option>
    </select>
    <span class="sf-label" title="Cascade \u00b7 language_server \u00b7 cascade/codeium_common \u9762">C</span>
    <button class="mb sf${_daoCls(_icm)}" id="btnCDao" title="Cascade \u2192 \u9053(\u9694\u79bb\u66ff\u6362)">C\u9053</button>
    <button class="mb sf${_offCls(_icm)}" id="btnCOff" title="Cascade \u2192 \u5b98(\u5b8c\u5168\u5b98\u65b9\u900f\u4f20)">C\u5b98</button>
    <button class="mb sf${_custCls(_icm)}" id="btnCCustom" title="Cascade \u2192 \u7f16\u5199\u63d0\u793a\u8bcd(custom)">C\u7f16</button>
    <select class="scn" id="canonC" title="Cascade \u5178\u6e90\u00b7\u5e1b\u4e66\u8001\u5b50/\u9053\u85cf\u9634\u7b26\u7ecf/\u5408\u4e00">
      <option value="laozi+yinfu"${_oSel("laozi+yinfu", _icc)}>\u5408\u4e00</option>
      <option value="laozi"${_oSel("laozi", _icc)}>\u8001\u5b50</option>
      <option value="yinfu"${_oSel("yinfu", _icc)}>\u9634\u7b26</option>
    </select>
    <span id="customBadge"></span>
  </div>
  <div class="stat" id="stat"></div>
  <pre id="sp" class="${initialSP ? "" : "quiet"}">${initialSP ? _escapeHtml(initialSP) : "\uff08\u5f85\u9996\u6b21\u5bf9\u8bdd\uff09"}</pre>
  <div id="editArea">
    <div class="edit-hint">\u7f16\u6b64 \u00b7 \u6539\u9053 agent \u6ce8\u5165 LLM \u4e4b SP (\u5e1b\u4e66\u5fb7\u9053\u7ecf) \u00b7 Ctrl+Enter \u4fdd\u5b58 \u00b7 Esc \u5173</div>
    <textarea id="editText" placeholder="\u7f16\u8f91\u9053 agent \u6a21\u5f0f\u6ce8\u5165 LLM \u4e4b\u6838\u5fc3 SP (\u5e1b\u4e66\u300a\u8001\u5b50\u300b) \u00b7 \u6539\u6b64\u5373\u6539\u6ce8\u5165 \u00b7 \u4fdd\u5b58\u540e\u4e0b\u6b21 chat \u5373\u751f\u6548"></textarea>
    <div class="edit-bar">
      <button class="eb save" id="editSave" title="\u4fdd\u5b58\u6ce8\u5165 (Ctrl+Enter)">\u2714 \u6ce8\u5165</button>
      <button class="eb reload" id="editReload" title="\u91cd\u8f7d\u5f53\u524d LLM \u5b9e\u6536 SP (\u4e0d\u4fdd\u5b58)">\u8f7d</button>
      <button class="eb reset" id="editReset" title="\u6e05 _customSP \u00b7 \u56de\u9ed8\u9053\u5fb7\u7ecf\u8def\u5f84">\u2716 \u5f52\u9053</button>
      <span class="edit-count" id="editCount"></span>
      <span class="edit-status" id="editStatus"></span>
    </div>
  </div>
  <noscript><div style="padding:16px;color:#e08080;font-size:11px">\u811a\u672c\u88ab CSP \u62e6\u622a \u00b7 \u8bf7\u91cd\u8f7d</div></noscript>
<script nonce="${N}">
(function() {
  'use strict';
  // v9.7.6 · 执今之道 · 以御今之有 · 编辑态永不空
  // ★ v9.9.20 jiqi · 二十五章「大象无形」· 加 _wdbg 上报 + try-catch 死活诊
  //   让 IIFE 死活通过 /origin/_wdbg ringbuf 立即可见 · 反者道之动
  var _PORT = ${proxyPort};
  var _BASE = 'http://127.0.0.1:' + _PORT;

  // ─── _wdbg · 反代 ringbuf 上报 · IIFE 死活立可观 (六十四章「为之于其未有也」) ───
  function _wdbg(msg, tag, data) {
    try {
      fetch(_BASE + '/origin/_wdbg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msg: msg || '', tag: tag || '', data: data || null }),
        cache: 'no-store'
      }).catch(function(){});
    } catch(_) {}
  }
  _wdbg('iife-start', 'boot', { port: _PORT, href: location.href, ts: Date.now() });

  // 全局错误捕获 · 任何未处理异常即上报 · 不再静默崩 (二十七章「善行者无辙迹」之反 · 留迹以辨)
  try {
    window.addEventListener('error', function(ev) {
      _wdbg('window-error', 'fatal', {
        msg: ev && ev.message,
        src: ev && ev.filename,
        line: ev && ev.lineno,
        col: ev && ev.colno,
        stack: ev && ev.error && ev.error.stack && String(ev.error.stack).slice(0, 500)
      });
    });
    window.addEventListener('unhandledrejection', function(ev) {
      _wdbg('unhandled-rejection', 'fatal', { reason: ev && String(ev.reason).slice(0, 300) });
    });
  } catch(_) {}

  var vsc;
  try { vsc = acquireVsCodeApi(); _wdbg('vsc-acquired', 'boot'); }
  catch(e) { vsc = { postMessage: function(){ return false; }, _ghost: true }; _wdbg('vsc-fail', 'boot', e.message); }

  var $sp = document.getElementById('sp');
  var $stat = document.getElementById('stat');
  var $dots = document.getElementById('dots');
  // ★ v9.9.67 · SSR 真态 (mode/canon/双面) · 首绘已预渲 · 此为逻辑层镜像
  var _INIT = ${JSON.stringify(_INIT)};
  var $editArea = document.getElementById('editArea');
  var $editText = document.getElementById('editText');
  var $editSave = document.getElementById('editSave');
  var $editReload = document.getElementById('editReload');
  var $editReset = document.getElementById('editReset');
  var $editStatus = document.getElementById('editStatus');
  var $editCount = document.getElementById('editCount');
  var $customBadge = document.getElementById('customBadge');
  var lastText = '';
  var lastSP = ${JSON.stringify(initialSP || "")};
  var _ssrShown = ${initialSP ? "true" : "false"}; // ★ v9.9.67 · SSR 道魂已嵌 · pull 空槽不覆
  var lastEntry = null;
  var lastSig = '';
  var editMode = false;

  // 反者道之动 · 编模式预填只取经文本源部分 · 截去 kept blocks (—之后)
  // TAO_TRAILER = "\\n\\n---\\n\\n" 是自然分界符 · 前为道魂(经文) · 后为辐(工具块)
  // 三十辐共一毅 · 辐不入编辑 · 由 proxy 自动补充
  // ★ v9.9.20 jiqi 修 · template-literal 内 '\\n' 必双转义 · 否则反斜杠被吃 · JS 字符串跨行 SyntaxError · IIFE 全崩
  function _spCanonPart(s) {
    if (!s) return '';
    var sep = '\\n\\n---\\n\\n';
    var idx = s.indexOf(sep);
    return idx >= 0 ? s.slice(0, idx) : s;
  }
  var _editClosing = null;

  function fJson(p) { return fetch(_BASE + p, { cache: 'no-store' }).then(function(r){ if (!r.ok) throw new Error('http ' + r.status); return r.json(); }); }

  // ─── renderTapeEntry · 万物作焉而不辞 · 永显 all_fields 全貌 ───
  function renderTapeEntry(entry, ts) {
    if (!entry) return false;
    lastEntry = entry;
    _ssrShown = false; // ★ v9.9.67 · 真数据至 · SSR 初示功成身退

    // lastSP 锚定本源 · 供 [编] 初值 & [载] 重载 & [归道] 复原
    // 优先 entry.after (CHAT_PROTO 命中之 invertSP 结果)
    // 空则 fallback 到 all_fields 首个 SP 类字段 (chat/summary/memory/ephemeral/unknown_long)
    // 仍空则取 all_fields[0].text · 保 [编] 初值必为当前注入之核心文本
    var _sp = entry.after || entry.before || '';
    if (!_sp && entry.all_fields && entry.all_fields.length > 0) {
      var _spKinds = ['chat', 'summary', 'memory', 'ephemeral', 'unknown_long'];
      for (var _si = 0; _si < entry.all_fields.length; _si++) {
        if (_spKinds.indexOf(entry.all_fields[_si].kind) >= 0) {
          _sp = entry.all_fields[_si].text || '';
          break;
        }
      }
      if (!_sp) _sp = entry.all_fields[0].text || '';
    }
    lastSP = _sp;

    var parts = [];
    var totalChars = 0;
    var fieldCount = (entry.all_fields && entry.all_fields.length) || 0;

    // 万物作焉而不辞 · 永循环 all_fields 全部 · SP / user_msg / tool_def / chat_history / 编辑器状态 等皆显
    if (fieldCount > 0) {
      for (var i = 0; i < fieldCount; i++) {
        var f = entry.all_fields[i];
        parts.push('\u2501\u2501\u2501 #' + (i + 1) + '/' + fieldCount +
          ' \u00b7 ' + (f.chars || 0) + '\u5b57 \u2501\u2501\u2501');
        parts.push(f.text || '');
        parts.push('');
        totalChars += (f.chars || 0);
      }
    } else if (lastSP) {
      // 兑底 · all_fields 空但 after 存 · 极罕之境
      // ★ v9.9.70 · 名实标注 —— after 已是线上实发 SP · 非重演之猜
      var _hdr = '\u2501\u2501\u2501 LLM \u5b9e\u6536' +
        (entry.transformed === true ? '\u00b7\u53d1\u6539' : '') +
        (entry.after_source === 'wire' ? '\u00b7\u7ebf' : '') +
        ' \u00b7 ' + lastSP.length + '\u5b57 \u2501\u2501\u2501';
      parts.push(_hdr);
      parts.push(lastSP);
      totalChars += lastSP.length;
    }

    if (parts.length === 0) return false;

    var text = parts.join('\\n');
    lastText = text;
    if (!editMode) {
      $sp.classList.remove('quiet');
      $sp.textContent = text;
    }

    // ★ v9.9.70 · 闭环判决 pill —— 面·模·线实·kind·age · 名实一目了然
    //   道·发改✓ = 该面应改且线上实发改成; 官·原文 = 该面透传之实;
    //   道·应改未改⚠ = 模式要求改而线文同原 · 真病灶立现
    $stat.innerHTML = _verdictPill(entry) +
      '<span class="pill">\u5168\u00b7' + (fieldCount || 1) + '\u5b57\u6bb5\u00b7' +
      (fieldCount ? totalChars : lastSP.length) + '\u5b57</span>';
    $stat.classList.add('show');

    return true;
  }

  // ★ v9.9.70 · 闭环判词 —— 由 tape 录存之线上真值成 pill
  //   L/C=面标 · 道/官/编=按面有效模式 · 发改✓|原文|应改未改⚠=线实
  function _verdictPill(entry) {
    if (!entry) return '';
    var m = entry.mode_at || entry.mode || '';
    var mlbl = m === 'invert' ? '\u9053' : m === 'custom' ? '\u7f16' : m === 'passthrough' ? '\u5b98' : (m || '?');
    var sf = entry.surface === 'local' ? 'L' : entry.surface === 'cascade' ? 'C' : '\u00b7';
    var w;
    if (entry.sp_on_wire === false) w = 'SP\u672a\u4e0a\u7ebf';
    else if (entry.transformed === true) w = '\u53d1\u6539\u2713';
    else if (m === 'invert' || m === 'custom') w = '\u5e94\u6539\u672a\u6539\u26a0';
    else w = '\u539f\u6587';
    var age = entry.t ? Math.max(0, Math.round((Date.now() - entry.t) / 1000)) : null;
    var s = sf + '\u9762\u00b7' + mlbl + '\u00b7' + w + '\u00b7' + (entry.kind || '?');
    if (entry.before_chars || entry.after_chars) {
      s += '\u00b7' + (entry.before_chars || 0) + '\u2192' + (entry.after_chars || 0) + '\u5b57';
    }
    if (entry.after_source === 'sim') s += '\u00b7\u63a8';
    if (age != null) s += '\u00b7' + age + 's\u524d';
    return '<span class="pill">' + s + '</span>';
  }

  // ─── v9.9.376 · 两面同构·层级化 · 道/官/编 + 按面典源 ───
  //   ★ v9.9.67 · 损 · 顶层 道/官 总择已除 (主公命「L/C 各有即足 · 顶层多增复杂度」)
  //     模式三态 (道/官/编) 只以面为准 · 全局 SP_MODE 为未设面之回落 · 命令仍可供手动
  //   L=Devin Local(api_server_pb面·devin-cli ACP) · C=Cascade(language_server面)
  //   每面子系统同构: 道(invert) | 官(passthrough) | 编(custom) + 典源(合一/老子/阴符)
  var $btnLDao = document.getElementById('btnLDao');
  var $btnLOff = document.getElementById('btnLOff');
  var $btnLCustom = document.getElementById('btnLCustom');
  var $canonL = document.getElementById('canonL');
  var $btnCDao = document.getElementById('btnCDao');
  var $btnCOff = document.getElementById('btnCOff');
  var $btnCCustom = document.getElementById('btnCCustom');
  var $canonC = document.getElementById('canonC');
  var _surf = {
    local: { mode: _INIT.surf.local.mode, canon: _INIT.surf.local.canon, customsp: null },
    cascade: { mode: _INIT.surf.cascade.mode, canon: _INIT.surf.cascade.canon, customsp: null },
  };
  var _editSurface = null; // 编辑器绑定的面 (null=全局自编)
  function _paintSurf() {
    var pairs = [
      ['local', $btnLDao, $btnLOff, $btnLCustom, $canonL],
      ['cascade', $btnCDao, $btnCOff, $btnCCustom, $canonC],
    ];
    for (var i = 0; i < pairs.length; i++) {
      var s = pairs[i][0], bd = pairs[i][1], bo = pairs[i][2], bc = pairs[i][3], sc = pairs[i][4];
      var st = _surf[s] || {};
      var m = st.mode || 'invert';
      if (bd) { bd.classList.remove('active', 'active-dao'); if (m === 'invert') bd.classList.add('active', 'active-dao'); }
      if (bo) { bo.classList.remove('active'); if (m === 'passthrough') bo.classList.add('active'); }
      if (bc) { bc.classList.remove('active', 'active-custom'); if (m === 'custom') bc.classList.add('active', 'active-custom'); }
      if (sc && st.canon && sc.value !== st.canon) sc.value = st.canon;
    }
  }
  function _refreshSurf() {
    try {
      fetch(_BASE + '/origin/mode', { cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(j) {
          var s = (j && j.surface) || {};
          var cn = (j && j.surface_canons) || {};
          var cs = (j && j.surface_customs) || {};
          _surf.local.mode = s.local || 'invert';
          _surf.cascade.mode = s.cascade || 'invert';
          if (cn.local) _surf.local.canon = cn.local;
          if (cn.cascade) _surf.cascade.canon = cn.cascade;
          _surf.local.customsp = cs.local || null;
          _surf.cascade.customsp = cs.cascade || null;
          _paintSurf();
        })
        .catch(function() {});
    } catch (_) {}
  }
  function _postSurf(payload) {
    return fetch(_BASE + '/origin/mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function(r) { return r.json(); }).catch(function() { return null; });
  }
  function _setSurf(surface, mode) {
    _surf[surface].mode = mode;
    _paintSurf();
    _postSurf({ surface: surface, mode: mode }).then(function() { _refreshSurf(); });
  }
  function _setSurfCanon(surface, canon) {
    _surf[surface].canon = canon;
    _paintSurf();
    _postSurf({ surface: surface, canon: canon }).then(function() { _refreshSurf(); });
  }
  function _openSurfaceEdit(surface) {
    _editSurface = surface;
    _surf[surface].mode = 'custom';
    _paintSurf();
    _postSurf({ surface: surface, mode: 'custom' });
    editMode = true;
    $editArea.classList.add('show');
    $sp.style.display = 'none';
    // 「原有规则改动 · 默认显示当前规则」—— 自编优先, 否则预填该面现行典源原文
    var seed = _surf[surface].customsp || '';
    $editText.value = seed;
    updateEditCount();
    var sname = surface === 'local' ? 'Devin Local' : 'Cascade';
    $editStatus.textContent = '自编·' + sname + ' 面 · Ctrl+Enter 保存';
    $editText.focus();
    if (!seed) {
      $editStatus.textContent = '载现行典源中…';
      fetch(_BASE + '/origin/canon_text?surface=' + surface, { cache: 'no-store' })
        .then(function(r) { return r.json(); })
        .then(function(j) {
          if (_editSurface !== surface || !editMode) return;
          if (j && j.ok && j.text) {
            $editText.value = j.text;
            updateEditCount();
            $editStatus.textContent = '自编·' + sname + ' 面 · 已预填现行典源 ' + j.chars + '字 · Ctrl+Enter 保存';
          } else {
            $editStatus.textContent = '自编·' + sname + ' 面';
          }
        })
        .catch(function() { if (_editSurface === surface && editMode) $editStatus.textContent = '自编·' + sname + ' 面'; });
    }
  }
  if ($btnLDao) $btnLDao.addEventListener('click', function() { _setSurf('local', 'invert'); });
  if ($btnLOff) $btnLOff.addEventListener('click', function() { _setSurf('local', 'passthrough'); });
  if ($btnLCustom) $btnLCustom.addEventListener('click', function() { _openSurfaceEdit('local'); });
  if ($canonL) $canonL.addEventListener('change', function() { _setSurfCanon('local', $canonL.value); });
  if ($btnCDao) $btnCDao.addEventListener('click', function() { _setSurf('cascade', 'invert'); });
  if ($btnCOff) $btnCOff.addEventListener('click', function() { _setSurf('cascade', 'passthrough'); });
  if ($btnCCustom) $btnCCustom.addEventListener('click', function() { _openSurfaceEdit('cascade'); });
  if ($canonC) $canonC.addEventListener('change', function() { _setSurfCanon('cascade', $canonC.value); });
  _refreshSurf();

  // ─── 编辑模式 ───
  function _closeEditMode() {
    editMode = false;
    _editSurface = null;
    $editArea.classList.remove('show');
    $sp.style.display = '';
    if (_editClosing) { clearTimeout(_editClosing); _editClosing = null; }
  }
  function updateEditCount() {
    var n = ($editText.value || '').length;
    var d = (lastSP || '').length;
    $editCount.textContent = n + (d > 0 ? '/' + d : '') + '\u5b57';
  }
  // v9.9.68 · 损 · 顶层「编」钮已除 — 编辑器唯经 L编/C编 以面开启 (_editSurface 恒非空)
  $editSave.addEventListener('click', function() {
    var sp = $editText.value;
    if (!sp || !sp.trim()) { $editStatus.textContent = '\u2716 \u5185\u5bb9\u4e0d\u53ef\u4e3a\u7a7a'; return; }
    $editStatus.textContent = '\u4fdd\u5b58\u4e2d\u2026';
    if (_editSurface) {
      // 按面自编: POST /origin/mode {surface, customsp}
      var sf = _editSurface;
      _postSurf({ surface: sf, customsp: sp.trim(), mode: 'custom' }).then(function(j) {
        if (j && j.ok) {
          _surf[sf].customsp = sp.trim();
          $editStatus.textContent = '\u2714 已注入 · ' + (sf === 'local' ? 'Devin Local' : 'Cascade') + ' 面自编 ' + sp.trim().length + '字';
          _refreshSurf();
        } else {
          $editStatus.textContent = '\u2716 保存失败';
        }
      });
      return;
    }
    // v9.9.68 · _editSurface 恒非空 (顶层编钮已除) · 全局 setCustomSP 支路同损
    $editStatus.textContent = '✖ 未择面 · 请从 L编/C编 入';
  });
  $editReload.addEventListener('click', function() {
    $editText.value = _spCanonPart(lastSP);
    updateEditCount();
    $editStatus.textContent = '\u2714 \u5df2\u8f7d\u5f53\u524d\u5b9e\u6536 SP \u00b7 ' + (_spCanonPart(lastSP).length) + '\u5b57';
    $editText.focus();
  });
  $editReset.addEventListener('click', function() {
    // v9.9.68 · 按面归道: 面编辑态清该面 customsp 并回落 invert 典源 (旧码恒清全局 _customSP · 于面态名实不符)
    if (_editSurface) {
      var _rsf = _editSurface;
      $editStatus.textContent = '\u5f52\u9053\u4e2d\u2026';
      _postSurf({ surface: _rsf, customsp: '' }).then(function() {
        return _postSurf({ surface: _rsf, mode: 'invert' });
      }).then(function() {
        _surf[_rsf].customsp = null; _surf[_rsf].mode = 'invert'; _paintSurf();
        $editStatus.textContent = '\u2714 \u5df2\u5f52\u9053 · ' + (_rsf === 'local' ? 'Devin Local' : 'Cascade') + ' \u9762\u56de\u5178\u6e90';
        _refreshSurf();
        if (_editClosing) clearTimeout(_editClosing);
        _editClosing = setTimeout(_closeEditMode, 1200);
      }).catch(function() { $editStatus.textContent = '\u2716 \u5f52\u9053\u5931\u8d25'; });
      return;
    }
    $editStatus.textContent = '\u6e05\u9664\u4e2d\u2026';
    vsc.postMessage({ command: 'resetCustomSP' });
  });
  $editText.addEventListener('input', updateEditCount);
  $editText.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $editSave.click(); }
    else if (e.key === 'Escape') { e.preventDefault(); _closeEditMode(); }
  });

  function updateCustomBadge(isCustom, chars) {
    if (isCustom) $customBadge.innerHTML = '<span class="custom-badge">\u81ea\u5b9a\u4e49' + (chars ? ' ' + chars + '\u5b57' : '') + '</span>';
    else $customBadge.innerHTML = '';
  }

  // ─── dots (三盏) ───
  function setDots(p) {
    $dots.innerHTML = '';
    if (!p || !p.ok) {
      var d = document.createElement('span');
      d.className = 'dot err';
      $dots.appendChild(d);
      $dots.title = 'Proxy:\u2717';
      return;
    }
    // ★ v9.9.70 · 名实终一 · Mode dot 读 surface_modes 面实况 (不问全局 SP_MODE)
    var _sm = (p && p.surface_modes) || {};
    var _l = _sm.local || p.mode || 'invert';
    var _c = _sm.cascade || p.mode || 'invert';
    var _ldao = (_l === 'invert' || _l === 'custom');
    var _cdao = (_c === 'invert' || _c === 'custom');
    var items = [
      { label: 'Proxy', on: true, k: 'proxy' },
      { label: 'Capture', on: !!(p.tape_count > 0), k: 'cap' },
      { label: 'Mode', on: _ldao && _cdao, k: 'mode' }
    ];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var d2 = document.createElement('span');
      // 面分裂(一道一官) → warn 色 · 名实立辨
      d2.className = 'dot ' + (it.on ? 'ok' : (it.k === 'cap' || (it.k === 'mode' && (_ldao || _cdao)) ? 'warn' : 'err'));
      $dots.appendChild(d2);
    }
    $dots.title = 'Proxy:' + (items[0].on?'\u2713':'\u2717') + ' \u00b7 Cap:' + (items[1].on?'\u2713':'\u2717') + ' \u00b7 L:' + _l + ' C:' + _c + ' \u00b7 G:' + (p.mode||'?');
  }

  function pingPull() {
    fJson('/origin/ping').then(function(p){
      if (!p) return;
      // ★ v9.9.67 · 顶层 道/官 总择已除 · p.mode 只入 dots 题注 (setDots 已含)
      setDots(p);
      if (p.custom_sp != null) updateCustomBadge(p.custom_sp, p.custom_sp_chars);
    }).catch(function(){ setDots(null); });
  }

  function pull() {
    if (!_PORT) return;
    // v9.9.19 · 损之又损 · fields=0 去除all_fields全文(432项·767KB) · 仅保after/before元数据(~52KB)
    fJson('/origin/tape?limit=1&fields=0').then(function(resp) {
      if (resp && resp.ok && resp.tape && resp.tape.length > 0) {
        renderTapeEntry(resp.tape[0], new Date().toLocaleTimeString());
      } else {
        // ★ v9.9.67 · SSR 道魂已嵌时不覆 (守初示) · 无 SSR 方示待语
        if (!editMode && !_ssrShown) {
          $sp.classList.add('quiet');
          $sp.textContent = '\uff08\u5f85\u9996\u6b21\u5bf9\u8bdd\uff09';
        }
        $stat.innerHTML = '';
      }
    }).catch(function(){});
  }

  function sigTick() {
    fJson('/origin/sig').then(function(r){
      if (!r || !r.ok) return;
      var cur = (r.injects_last_at || 0) + '|' + (r.injects_count || 0) + '|' + (r.tape_last_at || 0) + '|' + (r.mode_sig || '');
      if (cur === lastSig) return;
      lastSig = cur;
      pingPull();
      pull();
    }).catch(function(){});
  }

  window.addEventListener('message', function(e) {
    if (!e.data) return;
    // v9.9.20 jiqi · 上报 msg-recv · 反诊 webview ↔ extension host IPC 通路
    try { _wdbg('msg-recv', String(e.data.command || e.data.type || '?'), { keys: Object.keys(e.data).slice(0, 8) }); } catch(_) {}
    if (e.data.command === '_diag-ping') return;  // 主进程探活包 · 已 _wdbg 上报 · 不入业务
    if (e.data.type === 'mode') { pingPull(); _refreshSurf(); }
    // v9.9.18 \u4fee\u590d \u00b7 extension host gatherEssence \u63a8\u9001\u4e4b data \u5305 · \u6838\u5fc3\u663e\u793a\u901a\u8def
    // forceRefresh() \u53d1\u9001 {type:"data", data:{ping,proxy,allInjects,...}} \u4e4b\u540e webview \u5e94\u66f4\u65b0\u4e09\u76cf/\u6309\u9215/SP\u663e\u793a
    if (e.data.type === 'data') {
      var _d = e.data.data;
      if (!_d) return;
      // 1. \u66f4\u65b0\u4e09\u76cf (mode \u706f\u5728 dots \u9898\u6ce8 \u00b7 \u9876\u5c42\u94ae\u5df2\u9664)
      if (_d.ping) setDots(_d.ping);
      // 2. \u540c\u6b65\u7ecf\u85cf\u4e0b\u62c9
      // 3. \u81ea\u5b9a\u4e49 badge
      if (_d.ping && _d.ping.custom_sp != null) updateCustomBadge(_d.ping.custom_sp, _d.ping.custom_sp_chars);
      // 4. \u663e\u793a SP \u5185\u5bb9 (\u4f18\u5148 proxy.after · \u5df2\u8fd0\u884c\u624d\u6709)
      if (_d.proxy && _d.proxy.after) {
        lastSP = _d.proxy.after;
        if (!editMode) {
          $sp.classList.remove('quiet');
          $sp.textContent = _d.proxy.after;
        }
        var _ageS = (_d.proxy.age_s != null) ? Math.round(_d.proxy.age_s) : null;
        var _pill = _d.proxy.after.length + '\u5b57';
        if (_ageS != null) _pill += ' \u00b7 ' + _ageS + 's\u524d';
        if (_d.ping && _d.ping.canon_name) _pill += ' \u00b7 ' + _d.ping.canon_name;
        $stat.innerHTML = '<span class="pill">' + _pill + '</span>';
        $stat.classList.add('show');
      } else if (_d.proxyUp === false) {
        // v9.9.19 对标v9.9.16本源: 只有代理真正宿机才重置显示
        // 去掉!_d.proxy分支: preview超时/gatherEssence失败导致proxy=null时不覆盖pull()展示内容
        // ★ v9.9.67 · SSR 道魂已嵌时不覆 (守初示)
        if (!editMode && !_ssrShown) {
          $sp.classList.add('quiet');
          $sp.textContent = '\uff08待首次对话\uff09';
        }
        $stat.innerHTML = '';
      }
      return;
    }
    // v9.9.22 · canonChanged · 切经文即推 · 名实变即随
    // 道义: 二十五章「逝曰远 远曰反」· 名变即推 · 不滞旧
    if (e.data.type === 'canonChanged') {
      var _cc = e.data;
      // 无 custom 时 · 用新 default_sp 强刷 lastSP/$sp/textarea (有 custom 则不动 · 用户即道)
      if (!_cc.has_custom && _cc.default_sp) {
        lastSP = _cc.default_sp;
        if (!editMode) {
          $sp.classList.remove('quiet');
          $sp.textContent = _cc.default_sp;
        } else {
          // 编辑模式 · textarea 重填新经文 (前提: 用户未在编辑自定义)
          $editText.value = _cc.default_sp;
          updateEditCount();
          $editStatus.textContent = '\u7ECF\u85CF\u5DF2\u5207 \u00B7 ' + (_cc.default_source_name || _cc.canon || '?') + ' ' + (_cc.default_chars || 0) + '\u5B57';
        }
      }
      // 同步下拉选中态 (防 extension 推之 canon 与 webview 局部不一致)
      // stat 更新经名
      var _ccPill = (_cc.default_chars || 0) + '\u5B57';
      if (_cc.default_source_name) _ccPill += ' \u00B7 ' + _cc.default_source_name;
      $stat.innerHTML = '<span class="pill">' + _ccPill + '</span>';
      $stat.classList.add('show');
      return;
    }
    if (e.data.type === 'customSP') {
      var r = e.data;
      if (r.action === 'get') {
        // v9.7.6 · 十四章「执今之道·以御今之有」· default_sp 兜底 · tape 空亦可编辑帛书本源
        // v9.9.22 · 永同步 lastSP ← default_sp (随 _activeCanon 动态) · 不再 !lastSP 守卫
        if (r.default_sp) lastSP = r.default_sp;
        if (r.has_custom && r.sp) {
          $editText.value = r.sp;
          updateEditCount();
          updateCustomBadge(true, r.chars);
          $editStatus.textContent = '\u81ea\u5b9a\u4e49 \u00b7 ' + (r.chars || 0) + '\u5b57';
        } else {
          updateCustomBadge(false);
          // v9.9.22 · 永以 default_sp 填 textarea (移除 !$editText.value 守卫)
          // 道义: 二十二章「曲则金 枉则定」· 直填即真 · 不留旧经文
          if (r.default_sp) {
            $editText.value = r.default_sp;
          }
          updateEditCount();
          var _srcLabel = r.default_source_name || (r.default_source === 'silk' ? '\u5e1b\u4e66\u672c\u6e90' : (r.default_source || '\u9ed8\u8ba4'));
          $editStatus.textContent = '\u672a\u8bbe \u00b7 ' + _srcLabel + ' ' + (r.default_chars || 0) + '\u5b57';
        }
      } else if (r.action === 'set') {
        if (r.ok) {
          $editStatus.textContent = '\u2714 \u5df2\u6ce8\u5165 ' + (r.chars || 0) + '\u5b57';
          updateCustomBadge(true, r.chars);
          updateEditCount();
          if (_editClosing) clearTimeout(_editClosing);
          _editClosing = setTimeout(_closeEditMode, 1500);
        } else $editStatus.textContent = '\u2716 \u5931\u8d25: ' + (r.error || '?');
      } else if (r.action === 'reset') {
        if (r.ok) {
          // v9.7.8 · 反者道之动 · [归道] 严守帛书本源 · 不沿 lastSP (lastSP 已被 chat 覆盖)
          // 十一章「三十辐共一毂」· 强拉 default_sp 帛书 · 同步 lastSP 锚回本源 · 道魂 ~7237 字 + 7 辐由实际 SP 中提
          $editStatus.textContent = '\u5f52\u9053\u4e2d\u2026';
          updateCustomBadge(false);
          fJson('/origin/custom_sp').then(function(g) {
            if (g && g.default_sp) {
              $editText.value = g.default_sp;
              lastSP = g.default_sp;
              updateEditCount();
              $editStatus.textContent = '\u2714 \u5df2\u5f52\u9053 \u00b7 \u5e1b\u4e66\u672c\u6e90 ' + (g.default_chars || 0) + '\u5b57';
            } else {
              $editStatus.textContent = '\u2716 \u5f52\u9053\u62c9\u6e90\u5931\u8d25';
            }
          }).catch(function(){ $editStatus.textContent = '\u2716 \u5f52\u9053\u7f51\u8def\u5f02'; });
        } else $editStatus.textContent = '\u2716 \u6e05\u9664\u5931\u8d25';
      }
    }
  });

  // boot · v9.7.6 · 执今之道 · boot 即拉 getCustomSP 预装 lastSP (帛书本源) · tape 空亦可编辑
  pingPull();
  pull();
  vsc.postMessage({ command: 'getCustomSP' });
  // v9.9.18 \u4fee\u590d \u00b7 boot \u5373\u8bf7\u6c42 extension host refresh \u63a8\u9001 {type:"data"} \u5305
  // \u8ba9\u4e09\u76cf/\u6309\u9215/SP\u663e\u793a\u5728\u65e0\u9700 portMapping \u7684\u60c5\u51b5\u4e0b\u4e5f\u80fd\u7acb\u5373\u66f4\u65b0
  vsc.postMessage({ command: 'refresh' });
  setTimeout(function(){ pingPull(); pull(); vsc.postMessage({ command: 'refresh' }); }, 3000);
  setInterval(sigTick, 5000);
  setInterval(pingPull, 10000);
  setInterval(pull, 30000);
  // v9.9.18+v9.9.36 \u00b7 \u5468\u671f refresh \u4fdd\u5e95 \u00b7 15s (\u539f 5s)
  setInterval(function() { vsc.postMessage({ command: 'refresh' }); }, 15000);
  // v9.9.20 jiqi · IIFE 全跑通 · 至此即活 · 上报 boot-done 标记
  // v9.9.22 · 加 canonChanged listener · 切经文真联动
  // v9.9.67 · 版本串归一动态 · 名实相符 · 不再硬编码 '9.9.31'
  _wdbg('boot-done', 'boot', { listeners: 'sf[L/C],canon[L/C],editSave,editReload,editReset,message[data,customSP,canonChanged]', ver: '${PKG_VERSION}' });
})();
</script>
</body>
</html>`;
}

// ═══════════════════════════ icon.svg placeholder ═══════════════════════════
function ensureIconSvg() {
  const svgPath = path.join(__dirname, "media", "icon.svg");
  if (fs.existsSync(svgPath)) return;
  try {
    fs.mkdirSync(path.join(__dirname, "media"), { recursive: true });
    fs.writeFileSync(
      svgPath,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a7.5 7.5 0 0 0 0 15 5 5 0 0 1 0 5"/></svg>`,
    );
  } catch {}
}

// ═══════════════════════════ activate / deactivate ═══════════════════════════
let _essenceProvider = null;

function activate(ctx) {
  _activateTs = Date.now();
  try {
    cfg();
    _cachedAnchored = isAnchored();
    // ★ v9.9.67 · 磁盘持久模式优先 · config defaultMode 为备 · 治「重启丢模式」
    _cachedMode =
      _readPersistedMode() ||
      vscode.workspace
        .getConfiguration("dao")
        .get("origin.defaultMode", "invert");

    installSpawnHook();
    ensureIconSvg();

    L.info(
      "ext",
      `dao-proxy-min v${PKG_VERSION} activate · port=${_cachedPort} anchored=${_cachedAnchored} user=${os.userInfo().username}`,
    );

    // 道德经横幅 (默认关 · 不言之教)
    if (vscode.workspace.getConfiguration("dao").get("origin.banner", false)) {
      const q = DAO_QUOTES[Math.floor(Math.random() * DAO_QUOTES.length)];
      vscode.window.showInformationMessage(`道Agent v${PKG_VERSION} · ${q}`);
    }

    // 注册命令
    ctx.subscriptions.push(
      vscode.commands.registerCommand("wam.originInvert", cmdInvert),
      vscode.commands.registerCommand("wam.originPassthrough", cmdPassthrough),
      vscode.commands.registerCommand("dao.toggleMode", cmdToggle),
      vscode.commands.registerCommand("dao.openPreview", cmdOpenPreview),
      vscode.commands.registerCommand("wam.verifyEndToEnd", cmdVerifyE2E),
      vscode.commands.registerCommand("wam.selftest", cmdSelftest),
      // v9.9.29 · 印 160 · 终端会话池 (反者道之动 · 七层污染一招治)
      vscode.commands.registerCommand("dao.term.exec", cmdTermExec),
      vscode.commands.registerCommand("dao.term.list", cmdTermList),
      vscode.commands.registerCommand("dao.term.close", cmdTermClose),
      // ★ v9.9.67 · 损 · dao.外接api.toggle 命令已删 (外接api轴 v9.9.374-min 源码级拆除
      //   · 令存实亡 · 面板调之永无响应 · 名实不符 · 四十八章「为道日损」)
    );

    // 注册 webview
    _essenceProvider = new EssenceProvider(ctx);
    ctx.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "dao.essence",
        _essenceProvider,
        {
          webviewOptions: { retainContextWhenHidden: true },
        },
      ),
    );

    // v9.4.2 · 自 focus dao-container · 强制 resolveWebviewView 触发 · SSR 帛书立现
    // 三十七章: 道恒无名 · 侯王若能守之 · 万物将自化
    // 首装 / 重装 / 更新后 · 侧栏可能默 collapse · 一focus即开 · 主公无需手动
    // v9.9.36 · 5s 延迟 (原 500ms) · 渡过 "Installation modified" 危窗后再强制 focus
    setTimeout(() => {
      try {
        vscode.commands.executeCommand(
          "workbench.view.extension.dao-container",
        );
        L.info("activate", "focus dao-container · webview 自化");
      } catch (e) {
        L.warn("activate", `focus fail: ${e.message}`);
      }
    }, 5000);

    // ── 真药 D · activate 不杀 LS · 为道日损 (四十八章) ──
    // 首装/恢复 仅启 proxy + 锚 settings + 装 hook, 不主动 forceRestartLS
    // LS 自然重启时 spawn hook 自挂; 用户欲即时切换可显式调 wam.originInvert
    if (_cachedAnchored) {
      L.info("activate", "settings anchored → auto-restore proxy");
      // ★ v9.9.67 · 推前以盘最新为准 (防陈值覆盘 · 无为)
      _cachedMode = _readPersistedMode() || _cachedMode || "invert";
      proxyStart(_cachedPort, _cachedMode || "invert")
        .then((handle) => {
          if (!handle) {
            // v9.9.38 · 不清锚 · spawn hook 已无条件重写 · watchdog 后续会重试
            L.warn(
              "activate",
              "auto-restore: 端口占且非反代 · spawn hook 仍工作 · watchdog 将重试",
            );
            return;
          }
          proxySetMode(_cachedMode || "invert");
          L.info("activate", "auto-restore done");
        })
        .catch((e) => {
          L.error("activate", `auto-restore fail: ${e.message}`);
        });
    } else {
      // v9.9.36 · 道法自然 · 延迟锚定 · 避 "Installation modified" 写风暴
      // ════════════════════════════════════════════════════════════
      // 真因 (日志实证 · window23/24/25 三窗口一致复现):
      //   activate 立写 settings.json → ~800ms → "Installation has been modified on disk"
      //   → renderer 关 MessagePort → ext-host 死(2s寿命) → deactivate 清锚
      //   → 新 ext-host 再写 → 5s 内 3 次写 settings.json · 连环重载
      // 真治:
      //   内存先锚 (spawn hook + proxy 立即可用) · 文件锚延 15s 后写入
      //   渡过 "Installation modified" 危窗 · ext-host 存活后才持久化
      // 道义: 四十八「为道日损 · 损之又损 · 以至于无为」
      //       七十六「兵强则不胜 · 木强则折」· 柔弱处上
      // ════════════════════════════════════════════════════════════
      L.info("activate", "not anchored → 温和自启 · 延迟锚定 (不杀 LS)");
      (async () => {
        let handle;
        try {
          // ★ v9.9.67 · 推前以盘最新为准
          _cachedMode = _readPersistedMode() || _cachedMode || "invert";
          handle = await proxyStart(_cachedPort, _cachedMode || "invert");
        } catch (e) {
          L.error("activate", `first-run proxy fail: ${e.message}`);
          return;
        }
        if (!handle) {
          // v9.9.38 · 不跳过 · spawn hook 已无条件重写 · watchdog 后续会重试
          L.warn(
            "activate",
            "first-run: 端口占且非反代 · spawn hook 仍工作 · watchdog 将重试",
          );
          // 仍然设内存锚 + 延迟文件锚 · 确保一致性
        }
        proxySetMode(_cachedMode || "invert");
        // 内存先锚 · spawn hook 立即生效 · 文件延后
        _cachedAnchored = true;
        _cachedProxyUrl = `http://127.0.0.1:${_cachedPort}`;
        L.info(
          "activate",
          "first-run: proxy 就位 · 内存锚定 · 文件锚 15s 后写入",
        );
        // 延迟写 settings.json · 渡过 "Installation modified" 危窗
        _deferredAnchorTimer = setTimeout(async () => {
          _deferredAnchorTimer = null;
          try {
            await setAnchor(_cachedPort);
            L.info("activate", "deferred anchor 写入完成 · 安全窗口");
          } catch (e) {
            L.warn(
              "activate",
              `deferred anchor fail (non-fatal): ${e.message}`,
            );
          }
        }, 15000);
      })();
    }

    // ── v9.4.7 · proxy watchdog · 自愈 ──
    // 道义: 五十一章「道生之 · 德畜之 · 长之育之 · 亭之毒之 · 养之覆之」
    // 每 30s 自检 proxy 活否; 死则起之 · 不假外求 · 此即"自愈"之德
    // 防 ext host 重启/proxy crash/EADDRINUSE 等致 LS 失锚 → Windsurf 卡死
    const watchdogId = setInterval(async () => {
      try {
        if (Date.now() - _activateTs < 20000) return; // v9.9.36 · 渡过启动危窗 · 20s 内不检
        // ★ v9.9.72 · 卸则即葬 — 活巡见 .obsolete 录名 → 当场还原+杀代理
        //   补 deactivate 未逮之窗: 用户点击卸载后未重启之区间, 锚即归官方
        if (_selfUninstallPending()) {
          L.warn("watchdog", ".obsolete 录名 → 当场清锚杀代理 · 卸有终");
          _clearAnchorFileSync();
          _clearHomeSettingsSync(); // v9.9.73 · 家目录遗珠并扫
          try {
            _unanchorCredentialsToml();
          } catch {}
          if (_proxyHandle && _proxyHandle.quit) {
            await _proxyHandle.quit().catch(() => {});
          } else {
            await proxyStop().catch(() => {});
          }
          _proxyHandle = null;
          _cachedAnchored = false;
          return;
        }
        if (!_cachedAnchored && !_proxyHandle) return; // 未锚 · 不主动起
        const port = _cachedPort;
        const ping = await httpGetJson(
          `http://127.0.0.1:${port}/origin/ping`,
          2000,
        ).catch(() => null);
        if (ping && ping.ok) {
          // v9.9.21 · 唯变所适 · 检远端版本 · 旧版触让位
          // ping.quitted=true → 远端已收 /_quit, 即将关 · 视为死 · 待重起
          // ping.self_file 旧 → 触版本升级链路 (proxyStart EADDRINUSE 内自治)
          if (ping.quitted === true) {
            L.warn("watchdog", `remote 已让位 (quitted=true) · 触重起`);
          } else if (_isRemoteStale(ping.self_file)) {
            L.warn(
              "watchdog",
              `remote stale self_file=${ping.self_file} · 触升级让位`,
            );
            // 主动 POST /_quit · 不等 proxyStart 之 EADDRINUSE 路径
            await httpPostJson(
              `http://127.0.0.1:${port}/origin/_quit`,
              { reason: `watchdog upgrade to v${PKG_VERSION}` },
              2000,
            ).catch(() => {});
            await new Promise((r) => setTimeout(r, 1500));
          } else {
            // v9.9.68 · 健康路径回填 _proxyHandle — 根治「激活期单次 ping 失误判非反代 → handle 永 null → ACP env 锚死」
            if (!_proxyHandle) {
              _adoptAcpPort(ping); // v9.9.74 · 采用实况 acp 口
              _proxyHandle = _createRemoteHandle(port, ping.mode);
              L.info("watchdog", `remote handle 回填 (mode=${ping.mode})`);
            }
            // v9.9.69 · 正门守护: Devin 3.11+ 或按会话重书 agentEnv 令牌中继锚
            //   → 每巡读 settings, URL 键离 _cachedProxyUrl 者复位 (同值不写盘)
            try {
              _reanchorAcpEnvDrift(_cachedAcpUrl || _cachedProxyUrl); // v9.9.74 · acp域巡 acp锚
            } catch {}
            return; // 活且版本最新 · 安心
          }
        }
        L.warn("watchdog", `proxy 死/旧 · 重起 :${port}`);
        _proxyHandle = null;
        // ★ v9.9.67 · 重启前以盘最新为准 (治「用户切官后 watchdog 推陈 invert 覆盘」之跳)
        _cachedMode = _readPersistedMode() || _cachedMode || "invert";
        const handle = await proxyStart(port, _cachedMode || "invert").catch(
          (e) => {
            L.error("watchdog", `restart fail: ${e.message}`);
            return null;
          },
        );
        if (handle) {
          proxySetMode(_cachedMode || "invert");
          L.info("watchdog", "proxy 复活");
        }
      } catch (e) {
        L.error("watchdog", `tick err: ${e.message}`);
      }
    }, 60000);
    ctx.subscriptions.push({ dispose: () => clearInterval(watchdogId) });
    L.info("activate", "watchdog 启 · 60s 自愈一周");

    // ★ v9.9.73 · 卸则即葬 · 快哨 —— 录死之窗愈短 · 痕愈无
    //   病: watchdog 60s 之巡或失「点卸载→秒重启/强杀」之短窗 → 锚残代存.
    //   治: 8s 专职轻巡 (唯 .obsolete+目录两 stat · 无为不耗) · 见录即葬.
    const extinctId = setInterval(async () => {
      try {
        if (Date.now() - _activateTs < 8000) return; // 渡启动危窗
        if (!_selfUninstallPending()) return;
        L.warn("extinct", ".obsolete 录名 → 还原锚面+杀代理 · 卸有终");
        _clearAnchorFileSync();
        _clearHomeSettingsSync();
        try {
          _unanchorCredentialsToml();
        } catch {}
        if (_proxyHandle && _proxyHandle.quit) {
          await _proxyHandle.quit().catch(() => {});
        } else if (_proxyHandle) {
          await proxyStop().catch(() => {});
        }
        _proxyHandle = null;
        _cachedAnchored = false;
        removeSpawnHook();
        clearInterval(extinctId); // 一葬足矣 · 不再扰
      } catch {}
    }, 8000);
    ctx.subscriptions.push({ dispose: () => clearInterval(extinctId) });

    // ── v9.9.29 真治 · 终端会话池 (印 160 · 七层污染一招治) ──
    // 主公诏 5/19 3:11: 「反者道之动 · 不依赖任何第三方 · 直接 dao-proxy-min 解决 · 推进到底 实现一切」
    // 真本源: shell 进程 cwd/env/$? 是 OS 物理单例 · 多 agent 共享必污
    // 真治: 每 sid 一独立 shell 子进程 · cp.spawn /k mode + sentinel 切片
    // 验: _test_v9929_term_pool.js · 15/15 PASS
    // v9.9.36 · 延迟启动 · 减轻 ext-host 启动期事件循环压力
    // 道义: 六十四「千里之行 始于足下」· 不争启动期 CPU · 渡过危窗再起
    setTimeout(() => {
      try {
        _startDaoTermService(ctx);
      } catch (e) {
        L.warn("term", `term service start fail (non-fatal): ${e.message}`);
      }
    }, 10000);
    // ★ v9.9.67 · 损 · 外接api 自启定时器已删 (轴已源码级拆除 · v9.9.374-min)
  } catch (e) {
    L.error("activate", `FATAL activation error: ${e.stack || e.message}`);
    vscode.window.showErrorMessage(`道Agent 激活失败: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 印 161 · 损之又损 · 复归朴本 · 道法自然 (主公诏 5/19 「彻底去芜存菁」)
// ═══════════════════════════════════════════════════════════════════
// 此处原藏 v9.9.27 watchdog (~85 行) + v9.9.28 spawn cleanup (~140 行) + v9.9.31 净卸伴侣
// 真本源参毕 (印 164): 大道至简 · 官方卸载已完全足够
//   ext-host 死 → http server 自然 close · 永无孤儿
//   官方 [✘] + Reload Window → 物理目录自动删除 (含所有持存文件)
//   settings.json 锚清 → LS 重启直连官方 · 无需代码干预
// 道义: 四十八「损之又损 · 以至于无为 · 无为而无不为」
//       四十「反者道之动 · 弱者道之用」(反自制卸载 · 用官方机制之朴)
//       三十七「道恒无名 · 朴唯小 · 而天下弗敢臣 · 侯王若能守之 · 万物将自宾」
//       六十四「为之于其未有也 · 治之于其未乱也」(不固化 → 官方自然清)
async function deactivate() {
  L.info("ext", "deactivate");

  // v9.9.36 · 取消延迟锚定 (若 ext-host 在 15s 内被杀 · 文件未写 · 无需清)
  if (_deferredAnchorTimer) {
    clearTimeout(_deferredAnchorTimer);
    _deferredAnchorTimer = null;
    L.info(
      "deactivate",
      "cancelled deferred anchor · ext-host 早亡 · 文件未污染",
    );
  }

  const isLocal = !!(_proxyHandle && _proxyHandle.server);
  const lifetime = _activateTs ? Date.now() - _activateTs : 0;

  // ② 立即断钩 · 新 LS 不再被截持 (内存层 · 不写盘)
  _cachedAnchored = false;
  removeSpawnHook();

  // ★ v9.9.70 · 重启后生效 · 真因判别 —— 卸则卸锚 · 活则保锚
  // ════════════════════════════════════════════════════════════
  // 旧病 (141 实证): 不问真因 · lifetime>30s 即 _clearAnchorFileSync →
  //   升级/重载/崩溃之宿主轮换亦清锚 → settings.json 中段改写 →
  //   Devin 热读漂移 + 旧代理随亡 → 用户对话中段断流(「正常体验都没了」)。
  // 真治:
  //   卸载(.obsolete 录己名且无兄弟版) → 清锚 + 杀代理 (真卸有终)
  //   升级/重载/崩溃/关窗 → 保锚零写盘 · spawned/remote 代理留活待用
  //     → 新宿主 activate 见锚已同值 → 零写入 · ping 采用即合
  //     → 全程无一笔 settings 落盘 · 是为「重启后生效」
  // 道义: 六十四章「为者败之 执者失之」· 七十六章「兵强则不胜 木强则折」
  // ════════════════════════════════════════════════════════════
  const uninstalling = _selfUninstallPending();
  const sibling = uninstalling ? false : _selfHasSiblingVersion();
  if (uninstalling) {
    _clearAnchorFileSync();
    _clearHomeSettingsSync(); // v9.9.73 · 家目录遗珠并扫
    try {
      _unanchorCredentialsToml(); // v9.9.71 · 第四锚面归官方
    } catch {}
    if (_proxyHandle && _proxyHandle.quit) {
      await _proxyHandle.quit().catch(() => {});
    } else if (isLocal) {
      await proxyStop();
    } else {
      _proxyHandle = null;
    }
    L.info(
      "deactivate",
      `卸载真因 → 清锚 + 杀代理 · 卸有终 · lifetime=${Math.round(lifetime / 1000)}s`,
    );
  } else {
    // 活则保锚 · 不写一盘
    if (isLocal) {
      await proxyStop(); // 进程内 server 随宿主亡 · graceful 收而已
      L.info(
        "deactivate",
        `${sibling ? "升级" : "重载/关窗"} → 保锚零写 · local代理随宿主 · 新宿主采用链自愈`,
      );
    } else {
      // spawned/remote: 独立于本宿主 · 留活待新主采用 (流量零断窗)
      const k = _proxyHandle ? _proxyHandle.kind : "none";
      _proxyHandle = null;
      L.info(
        "deactivate",
        `${sibling ? "升级" : "重载/关窗"} → 保锚零写 · ${k} 代理留活待用 · 重启生效`,
      );
    }
  }

  if (_essenceProvider) {
    _essenceProvider.dispose();
    _essenceProvider = null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ★ v9.9.67 · 损之又损 · 外接api 轴 ext 侧残骸全出列 (四十八章)
//   tryStartExternalApi / tryStopExternalApi / cmdExternalApiToggle
//   三函数 + _externalApiRuntime 状态 · 轴已源码级拆除(v9.9.374-min) ·
//   命令已除册 · 自启定时器已删 · deactivate 调用已删 · 名实归一。
// ═══════════════════════════════════════════════════════════════════

module.exports = { activate, deactivate };
