// WAM · 无感切号 · 道法自然
// 载营魄抱一，能无离乎？专气致柔，能如婴儿乎？
// ─ 五感原则 ─ 切号绝不调用 windsurf.logout · 绝不重启 extension host · 绝不写 state.vscdb
// ─ 锚本源 ─ Chromium 原生桥 > 系统代理感知 > 直连 > 动态端口 (末路兜底)
// ─ 双身份 ─ Firebase (主) · Devin (/_devin-auth/ · 新号) 自动探测切换
// ─ v17.36 ─ origin/proxy 功能已剥离至独立插件 · 本源纯 WAM 切号
// ─ v17.41 ─ 唯变所适: WAM_DIR 支持 env WAM_HOT_DIR + wam.wamHotDir 覆盖 · 默认 ~/.wam-hot
// ─ v17.42 ─ 反者道之动: 逆向本源根治msgAnchor · localhost gRPC双层匹配 + http2 hook + 消息即标记使用中
// ─ v17.42.2 ─ 去芜存菁: 切号后 state 不变量统一 · _afterSwitchSuccess · 大制不割 (8 路归一)
// ─ v17.42.13 ─ 道冲·用之不盈·渊兮似万物之宗: 适应所有用户/环境/变化
// ─ v17.42.14 ─ 不冤枉·purge Devin路径: 网络/代理错→skip, 仅永久业务错才归档 (镜像Firebase路径)
//                存储五级兜底 (env→cfg→legacy→user-isolated→globalStorageUri→tmpdir) · _isPathWritable 探测
//                用户隔离 ~/.wam-hot/<user> · 产品名三级强化 (cfg→appName→execPath basename) · activate 四级容错
// ─ v17.42.15 ─ 载营魄抱一·存储本源五重机制 (账号永不分离)
//                L1 原子写 (tmp→fsync→rename) · L2 内容感知分层备份 (近N+日1) · L3 灾难回退 (_wam_backups)
//                L4 文件锁 (PID+ts) · L5 事件journal (append-only·7MB滚动) · NULL-WIPE 护本 · healthCheck自愈
// 详细迭代历史见 git log (v15~v17.42 凡 60+ 代 · 为学日益已化为 git 考古, 源码去芜留菁)
// ── 水之四德 (选举/降频/滚切/熔断) · 上善如水 · 不破不夺 · 失败 noop ──
try {
  require("./_water_virtues.js");
} catch (_e) {}
const vscode = require("vscode");
const crypto = require("crypto");
const https = require("https");
const http = require("http");
const http2 = require("http2"); // v17.42: ConnectRPC HTTP/2 transport hook
const net = require("net");
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ── 配置 · 道法自然 — 一切从环境动态获取, 设置可覆盖, 零硬编码 ──

// ── v17.42.13 · 道冲 · 用之或不盈 · 渊兮似万物之宗 ──
// 本源哲学: 产品名/数据目录/工作目录 · 三级适应 · 五级兜底 · 涵容一切未知环境
//   兵无常势, 水无常形 — 产品可为任何 VSCode fork
//   能因敌变化而取胜者谓之神 — 空值/单字/纯空白/陌生 appName 皆能自适
//   曲则全 — 不存在即回退, 不可写即降级, 从不抛

// ── 产品名自适应: 检测实际IDE产品名 (Windsurf/Cursor/VSCode fork等) ──
// v17.42.13: 三级强化 — appName + appHost + execPath basename
function _detectProductName() {
  // 优先 1: VS Code settings 显式配置 (运维最高权)
  try {
    const cfgName = vscode.workspace
      .getConfiguration("wam")
      .get("productName", "");
    if (cfgName && typeof cfgName === "string" && cfgName.trim().length > 0)
      return cfgName.trim();
  } catch {}
  // 优先 2: vscode.env.appName (运行时真实产品名)
  try {
    if (vscode.env.appName && typeof vscode.env.appName === "string") {
      // appName 可能是 "Windsurf", "Visual Studio Code", "Cursor", "Trae", ...
      const raw = vscode.env.appName.trim();
      if (raw.length > 0) {
        const name = raw.split(/\s+/)[0];
        // v17.42.13: 单字符也可能是有效 fork 名 (但排除纯空白/纯符号)
        if (name && /[A-Za-z\u4e00-\u9fa5]/.test(name)) return name;
      }
    }
  } catch {}
  // 优先 3 (v17.42.13 新): process.execPath basename · IDE 二进制自带品牌
  try {
    const exe = process.execPath || "";
    const base = path.basename(exe, path.extname(exe));
    // 排除 "node"/"electron" 等纯 runtime, 只接受 fork 品牌
    if (base && !/^(node|electron|code|code-oss)$/i.test(base)) {
      // 首字母大写规范化
      return base.charAt(0).toUpperCase() + base.slice(1);
    }
  } catch {}
  return "Windsurf"; // 兜底默认 (不变 · 向后兼容)
}

// ── 数据目录自适应: 跨平台 + 自定义安装 ──
// v17.42.13: 新增 XDG 支持 + 多 fork 级联候选
function _resolveDataDir(productName) {
  // 优先: VS Code settings 显式配置
  try {
    const cfgDir = vscode.workspace.getConfiguration("wam").get("dataDir", "");
    if (cfgDir && fs.existsSync(cfgDir)) return cfgDir;
  } catch {}
  // 按平台构建候选路径列表
  const candidates = [];
  let home = "";
  try {
    home = os.homedir() || "";
  } catch {
    home = "";
  }
  switch (process.platform) {
    case "win32": {
      const appdata =
        process.env.APPDATA ||
        (home ? path.join(home, "AppData", "Roaming") : "");
      if (appdata) {
        candidates.push(path.join(appdata, productName));
        // 兼容: 主流 fork 名均尝试 (水无常形)
        for (const alt of ["Windsurf", "Cursor", "Trae", "Code"]) {
          if (productName !== alt) candidates.push(path.join(appdata, alt));
        }
      }
      break;
    }
    case "darwin": {
      if (home) {
        const appSup = path.join(home, "Library", "Application Support");
        candidates.push(path.join(appSup, productName));
        for (const alt of ["Windsurf", "Cursor", "Trae", "Code"]) {
          if (productName !== alt) candidates.push(path.join(appSup, alt));
        }
      }
      break;
    }
    default: {
      // linux / bsd / else — XDG_CONFIG_HOME 优先 (v17.42.13 新)
      const xdg =
        process.env.XDG_CONFIG_HOME || (home ? path.join(home, ".config") : "");
      if (xdg) {
        candidates.push(path.join(xdg, productName));
        for (const alt of ["Windsurf", "Cursor", "Trae", "Code"]) {
          if (productName !== alt) candidates.push(path.join(xdg, alt));
        }
      }
      break;
    }
  }
  // 返回第一个存在的
  for (const dir of candidates) {
    try {
      if (dir && fs.existsSync(dir)) return dir;
    } catch {}
  }
  return candidates[0] || ""; // v17.42.13: 候选空时返回空串 (上游有 globalStorageUri 兜底)
}

// ── 延迟初始化: activate()时调用一次, 之后全局可用 ──
let PRODUCT_NAME = "Windsurf"; // activate()时由_initConfig()设置
let DATA_DIR = ""; // 产品数据根目录 (如 %APPDATA%/Windsurf)

// ── 配置读取辅助: 从wam.*设置读取, 带类型安全默认值 ──
function _cfg(key, defaultVal) {
  try {
    const val = vscode.workspace.getConfiguration("wam").get(key);
    // 道法自然: 0/false是合法值, 只拒绝undefined/null
    if (val === undefined || val === null) return defaultVal;
    // 空字符串回退: 默认非字符串 (类型不匹配) 或默认是非空字符串 (package.json 声明 default:"" 但代码侧给了真值)
    // v17.42.18 根治: 凡 wam.devin.loginUrl 等 string 配置, package.json default:"" 与代码 default 真值并存时
    //                  vscode.get 返回 ""・原 _cfg 返回空字符串 → new URL("") 抛 "Invalid URL" → Devin 登录全死
    if (val === "" && (typeof defaultVal !== "string" || defaultVal !== ""))
      return defaultVal;
    return val;
  } catch {}
  return defaultVal;
}

// ═══════════════════════════════════════════════════════════════════
// v17.11 太上·不知有之 · 自适应运行时 (Adaptive Runtime)
// ───────────────────────────────────────────────────────────────────
// 反者道之动: v17.9-17.10 曝光 19 项用户可调 → v17.11 彻底反转
// 唯变所适: 根据实测 RTT P95 + 错误率自动计算 13 项性能参数
// 功成而弗居: 用户零感知零配置, ops 仍可通过 _cfg override 应急
// 为道日损: package.json 只保留 wam.autoRotate (用户意图开关, 非参数)
// ═══════════════════════════════════════════════════════════════════
const _adaptive = {
  // 实测指标 · 滑动窗口
  _rttSamples: [], // 最近 50 次成功请求 RTT (ms)
  _errorSamples: [], // 最近 100 次请求结果 (0=ok, 1=err)
  _lastRecompute: 0,
  _RECOMPUTE_INTERVAL_MS: 5000, // 5s 节流避免抖动

  // 自动导出值 · 初始默认 = v17.10 默认值 (零破坏兼容)
  injectPhase1Timeout: 3000,
  injectPhase2Timeout: 4000,
  injectPhase3Timeout: 4000,
  injectPhase4Timeout: 5000,
  dohTimeout: 8000,
  logoutTimeout: 8000,
  injectRetryDelay: 1000,
  purgeDelay: 1500,
  switchRetryDelay: 3000,
  watcherRestartDelay: 5000,
  scanConcurrency: 4,
  scanPerBatchDelay: 200,
  monitorIntervalMs: 3000,
  scanIntervalMs: 45000,
  quotaMinIntervalMs: 10000,
  switchCooldownMs: 15000,

  // 采样入口 · 由 _httpsPostRaw / _httpsPostRawViaProxy 调用
  sampleRtt(ms) {
    if (typeof ms !== "number" || ms <= 0 || ms > 60000) return; // 过滤异常值
    this._rttSamples.push(ms);
    if (this._rttSamples.length > 50) this._rttSamples.shift();
    this._maybeRecompute();
  },
  sampleOutcome(ok) {
    this._errorSamples.push(ok ? 0 : 1);
    if (this._errorSamples.length > 100) this._errorSamples.shift();
    this._maybeRecompute();
  },

  // 统计计算
  _rttP95() {
    if (this._rttSamples.length < 3) return 500; // 样本不足 · 乐观默认 500ms
    const sorted = [...this._rttSamples].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] || 500;
  },
  _errRate() {
    if (this._errorSamples.length < 3) return 0; // 样本不足 · 零错误
    let sum = 0;
    for (const e of this._errorSamples) sum += e;
    return sum / this._errorSamples.length;
  },
  _clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, Math.round(v)));
  },

  // 核心: 唯变所适 · 根据 RTT/错率自动调整所有性能参数
  _maybeRecompute() {
    const now = Date.now();
    if (now - this._lastRecompute < this._RECOMPUTE_INTERVAL_MS) return;
    this._lastRecompute = now;
    const rtt = this._rttP95();
    const err = this._errRate();

    // ── 超时类: RTT × 倍数 · 慢网自动放大 · 上下限防失控 ──
    // 基准: 本地 ~50ms · 国内 ~200-500ms · VPN/跨境 ~1000-3000ms
    this.injectPhase1Timeout = this._clamp(rtt * 3, 3000, 15000);
    this.injectPhase2Timeout = this._clamp(rtt * 4, 4000, 20000);
    this.injectPhase3Timeout = this._clamp(rtt * 4, 4000, 20000);
    this.injectPhase4Timeout = this._clamp(rtt * 5, 5000, 25000);
    this.dohTimeout = this._clamp(rtt * 10, 5000, 30000);
    this.logoutTimeout = this._clamp(rtt * 5, 8000, 30000);

    // ── 并发类: 错率低→升, 错率高→降 (err=0→8, err=0.1→~4, err=0.5→~1, err=1→1) ──
    this.scanConcurrency = this._clamp(8 / (1 + err * 10), 1, 16);

    // ── 节流类: 错率高时放慢 (err=0→基准, err=0.5→~2.5x, err=1→~4x) ──
    const slowFactor = 1 + err * 3;
    this.scanIntervalMs = this._clamp(45000 * slowFactor, 30000, 180000);
    this.scanPerBatchDelay = this._clamp(200 * (1 + err * 5), 100, 2000);
    this.monitorIntervalMs = this._clamp(3000 * (1 + err * 2), 2000, 10000);
    this.quotaMinIntervalMs = this._clamp(10000 * (1 + err * 5), 10000, 60000);
    this.switchCooldownMs = this._clamp(15000 * (1 + err * 2), 15000, 60000);
    this.switchRetryDelay = this._clamp(3000 * (1 + err * 3), 3000, 15000);
    this.injectRetryDelay = this._clamp(1000 * (1 + err * 3), 1000, 5000);
    this.purgeDelay = this._clamp(1500 * (1 + err * 2), 1500, 5000);
    this.watcherRestartDelay = this._clamp(5000 * (1 + err * 5), 5000, 30000);
  },

  // 诊断快照 (供 log 用, 不暴露给用户 UI)
  snapshot() {
    return {
      rttP95: Math.round(this._rttP95()),
      errRate: Math.round(this._errRate() * 1000) / 1000,
      samples: { rtt: this._rttSamples.length, err: this._errorSamples.length },
      exports: {
        injectPhase1: this.injectPhase1Timeout,
        injectPhase2: this.injectPhase2Timeout,
        injectPhase3: this.injectPhase3Timeout,
        injectPhase4: this.injectPhase4Timeout,
        doh: this.dohTimeout,
        logout: this.logoutTimeout,
        scanConcurrency: this.scanConcurrency,
        scanInterval: this.scanIntervalMs,
        monitorInterval: this.monitorIntervalMs,
        quotaMinInterval: this.quotaMinIntervalMs,
        switchCooldown: this.switchCooldownMs,
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════
// v17.13 反者道之动 · injectAuth 自适应 (独立于网络 RTT)
// ───────────────────────────────────────────────────────────────────
// 逆流推原: v17.11 _adaptive 把 injectAuth 超时绑到网络 RTT (rtt*3)
//           但 executeCommand 是 IDE 内部调用 · 无关网络
//           结果 P1=3000ms 误触发 P2 的 4s 延续死等 · 90% 切号浪费 1-2s
// 唯变所适: _injectAdaptive 记录 executeCommand 实测耗时 · 自学 p95
//           样本 < 5: 悲观默认 8000ms (防误触发 P2)
//           样本 ≥ 5: p95 × 1.5, clamp [3000, 15000]
//           重试延迟: p95 × 0.1, clamp [100, 2000], 默认 200ms
// 柔弱胜刚强: 删除 Phase 2 死等 (原 P1+P2 合并) · 慢场景 -2s, 卡死 -4s
// ═══════════════════════════════════════════════════════════════════
const _injectAdaptive = {
  _latencies: [], // 最近 30 次成功 executeCommand 耗时 (ms)
  _MAX_SAMPLES: 30,
  // v17.15 冷启乐观: 实战 P95 ~1500ms · 3500ms=2×P95 保留裕量
  // 旧 8000ms 过于悲观 · 首次切号 P1 必超时 → 触发 P2 浪费 4-5s
  _DEFAULT_TIMEOUT_MS: 3500,
  _DEFAULT_RETRY_DELAY_MS: 200, // 样本不足时激进重试

  // 采样入口 · 由 injectAuth 成功分支调用
  sample(ms) {
    if (typeof ms !== "number" || ms <= 0 || ms > 30000) return; // 过滤异常
    this._latencies.push(ms);
    if (this._latencies.length > this._MAX_SAMPLES) this._latencies.shift();
  },

  // 统计
  _p95() {
    if (this._latencies.length < 5) return this._DEFAULT_TIMEOUT_MS;
    const sorted = [...this._latencies].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] || this._DEFAULT_TIMEOUT_MS;
  },
  _clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, Math.round(v)));
  },

  // 主超时 (样本足够时 p95 × 1.5, 留 50% 裕量)
  getTimeoutMs() {
    if (this._latencies.length < 5) return this._DEFAULT_TIMEOUT_MS;
    return this._clamp(this._p95() * 1.5, 3000, 15000);
  },

  // 重试延迟 (p95 × 0.1, 极短让 IDE 喘息即可)
  getRetryDelayMs() {
    if (this._latencies.length < 5) return this._DEFAULT_RETRY_DELAY_MS;
    return this._clamp(this._p95() * 0.1, 100, 2000);
  },

  // 诊断快照
  snapshot() {
    return {
      samples: this._latencies.length,
      p95: Math.round(this._p95()),
      timeout: this.getTimeoutMs(),
      retryDelay: this.getRetryDelayMs(),
    };
  },
};

// ── Firebase配置 — 可通过wam.firebase.*覆盖 ──
function _getFirebaseKeys() {
  const extra = _cfg("firebase.extraKeys", []);
  const base = ["AIzaSyDsOl-1XpT5err0Tcnx8FFod1H8gVGIycY"];
  return Array.isArray(extra) && extra.length > 0 ? [...base, ...extra] : base;
}
function _getFirebaseReferer() {
  return (
    _cfg("firebase.referer", "https://windsurf.com/") || "https://windsurf.com/"
  );
}
function _getFirebaseHost() {
  return _cfg("firebase.host", "identitytoolkit.googleapis.com");
}

// 万法归宗 — 消灭一切固定端口/固定地址常量
// 代理发现优先级: 系统代理(env/vscode/registry) > LAN网关 > localhost动态扫描
// 端口扫描仅为末路兜底 — 真正的proxy由 _getSystemProxy() 动态获取
const _DEFAULT_SCAN_PORTS = [
  7890, 7897, 7891, 10808, 10809, 1080, 8118, 3128, 8080,
];
function _getFallbackScanPorts() {
  // 道法自然: scanPorts完全替换, extraPorts追加扩展
  const override = _cfg("proxy.scanPorts", []);
  if (Array.isArray(override) && override.length > 0) return override;
  const extra = _cfg("proxy.extraPorts", []);
  const base = _DEFAULT_SCAN_PORTS;
  if (Array.isArray(extra) && extra.length > 0) {
    const merged = [...base];
    for (const p of extra) {
      if (typeof p === "number" && !merged.includes(p)) merged.push(p);
    }
    return merged;
  }
  return base;
}
// LAN网关扫描端口 — 同样可扩展
const _DEFAULT_GW_PORTS = [7890, 3128, 8080, 1080];
function _getGatewayPorts() {
  // 道法自然: gatewayPorts完全替换, extraGatewayPorts追加扩展
  const override = _cfg("proxy.gatewayPorts", []);
  if (Array.isArray(override) && override.length > 0) return override;
  const extra = _cfg("proxy.extraGatewayPorts", []);
  const base = _DEFAULT_GW_PORTS;
  if (Array.isArray(extra) && extra.length > 0) {
    const merged = [...base];
    for (const p of extra) {
      if (typeof p === "number" && !merged.includes(p)) merged.push(p);
    }
    return merged;
  }
  return base;
}

// 官方API端点 — 直连Windsurf/Codeium, 不经中继, 根治relay单点故障
// 可通过 wam.officialEndpoints 追加自定义端点
const _DEFAULT_PLAN_STATUS_URLS = [
  "https://server.codeium.com/exa.seat_management_pb.SeatManagementService/GetPlanStatus",
  "https://web-backend.windsurf.com/exa.seat_management_pb.SeatManagementService/GetPlanStatus",
  "https://register.windsurf.com/exa.seat_management_pb.SeatManagementService/GetPlanStatus",
];
// v16: Claude可用性地检 — RegisterUser + CheckChatCapacity (唯一可靠的Claude访问权验证)
// v17.41 唯变所适: 端点与模型全可配 · 适配公网万千环境
function _getRegisterUrl() {
  return _cfg(
    "registerUrl",
    "https://server.codeium.com/exa.seat_management_pb.SeatManagementService/RegisterUser",
  );
}
function _getChatCapacityUrl() {
  return _cfg(
    "chatCapacityUrl",
    "https://server.codeium.com/exa.language_server_pb.LanguageServerService/CheckChatCapacity",
  );
}
function _getClaudeProbeModel() {
  return _cfg("claudeProbeModel", "claude-sonnet-4-6");
}
function _getOfficialPlanStatusUrls() {
  // 道法自然: planStatusUrls完全替换, officialEndpoints追加扩展
  const override = _cfg("planStatusUrls", []);
  if (Array.isArray(override) && override.length > 0) return override;
  const extra = _cfg("officialEndpoints", []);
  if (Array.isArray(extra) && extra.length > 0)
    return [..._DEFAULT_PLAN_STATUS_URLS, ...extra];
  return _DEFAULT_PLAN_STATUS_URLS;
}

// 注入命令候选 — 版本自适应, 按优先级尝试
// 可通过 wam.injectCommands 覆盖整个列表
const _DEFAULT_INJECT_COMMANDS = [
  "windsurf.provideAuthTokenToAuthProvider",
  "codeium.provideAuthToken",
  "windsurf.provideAuthToken",
];
function _getInjectCommands() {
  const custom = _cfg("injectCommands", []);
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return _DEFAULT_INJECT_COMMANDS;
}
let _workingInjectCmd = null; // 缓存验证成功的注入命令

// ── Relay配置 — 可通过wam.relayHost覆盖, 占位符自动禁用 ──
function _getRelayHost() {
  const host = _cfg("relayHost", "");
  // 占位符/空值 → 返回null, 调用方跳过relay通道
  if (
    !host ||
    host === "YOUR_RELAY_HOST.example.com" ||
    host.includes("example.com")
  )
    return null;
  return host;
}

// ── v17.42.13 · 路径可写性探测 (曲则全 · 不可写即降级) ──
function _isPathWritable(p) {
  try {
    if (!p || typeof p !== "string") return false;
    if (!fs.existsSync(p)) {
      try {
        fs.mkdirSync(p, { recursive: true });
      } catch {
        return false;
      }
    }
    const probe = path.join(p, ".wam_write_probe");
    fs.writeFileSync(probe, String(Date.now()));
    try {
      fs.unlinkSync(probe);
    } catch {}
    return true;
  } catch {
    return false;
  }
}

// ── v17.42.13 · 用户隔离标识 (各安其位 · 多用户同机不相侵) ──
function _getUserDiscriminator() {
  try {
    const u = os.userInfo();
    if (u && u.username) {
      return String(u.username)
        .replace(/[^A-Za-z0-9_-]/g, "_")
        .substring(0, 32);
    }
  } catch {}
  try {
    const n = process.env.USERNAME || process.env.USER || process.env.LOGNAME;
    if (n) {
      return String(n)
        .replace(/[^A-Za-z0-9_-]/g, "_")
        .substring(0, 32);
    }
  } catch {}
  return "shared"; // 兜底 · 单用户兼容
}

// ── WAM_DIR 可配化 + 五级兜底 · v17.42.13 渊兮似万物之宗 ──
//   级1 env WAM_HOT_DIR (运维最高权)
//   级2 vscode config wam.wamHotDir (用户权)
//   级3 legacy ~/.wam-hot (老目录已存在即沿用 · 无感迁移 · 向后兼容)
//   级4 用户隔离 ~/.wam-hot/<user> (新默认 · 多用户共机不冲突)
//   级5 context.globalStorageUri (VSCode 保证可写 · 沙箱/只读盘兜底)
//   级6 os.tmpdir()/wam-hot-<user> (末路 · 至少能跑一个会话)
function _resolveWamDir(context) {
  // 级1
  if (process.env.WAM_HOT_DIR && _isPathWritable(process.env.WAM_HOT_DIR)) {
    return process.env.WAM_HOT_DIR;
  }
  // 级2
  try {
    const cfgDir = vscode.workspace
      .getConfiguration("wam")
      .get("wamHotDir", "");
    if (cfgDir && _isPathWritable(cfgDir)) return cfgDir;
  } catch {}
  // 级3 + 级4: home 相关
  let home = "";
  try {
    home = os.homedir() || "";
  } catch {
    home = "";
  }
  if (home) {
    const legacy = path.join(home, ".wam-hot");
    // 级3 legacy 已存在且可写 → 沿用 (老数据零迁移)
    if (fs.existsSync(legacy) && _isPathWritable(legacy)) return legacy;
    // 级4 用户隔离默认
    const isolated = path.join(home, ".wam-hot", _getUserDiscriminator());
    if (_isPathWritable(isolated)) return isolated;
  }
  // 级5 globalStorageUri (沙箱友好)
  try {
    const gsPath =
      context && context.globalStorageUri && context.globalStorageUri.fsPath;
    if (gsPath) {
      const wamHot = path.join(gsPath, "wam-hot");
      if (_isPathWritable(wamHot)) return wamHot;
    }
  } catch {}
  // 级6 tmpdir 末路
  try {
    const tmp = path.join(os.tmpdir(), "wam-hot-" + _getUserDiscriminator());
    if (_isPathWritable(tmp)) return tmp;
  } catch {}
  // 完全失败 → 返回 legacy sentinel (activate 层会检测并降级到纯内存模式)
  return home ? path.join(home, ".wam-hot") : path.join(os.tmpdir(), "wam-hot");
}
let WAM_DIR = path.join(os.homedir(), ".wam-hot"); // 模块加载默认值 · activate() 时 _resolveWamDir(context) 重新解析
function _deriveWamPaths() {
  TOKEN_FILE = path.join(WAM_DIR, "oneshot_token.json");
  RESULT_FILE = path.join(WAM_DIR, "inject_result.json");
  LOG_FILE = path.join(WAM_DIR, "wam.log");
  SNAPSHOT_FILE = path.join(WAM_DIR, "quota_snapshots.json");
  INUSE_FILE = path.join(WAM_DIR, "inuse_marks.json");
  RELOAD_SIGNAL = path.join(WAM_DIR, "_reload_signal");
  RELOAD_READY = path.join(WAM_DIR, "_reload_ready");
  MODE_FILE = path.join(WAM_DIR, "wam_mode.json");
  INSTANCE_LOCK_FILE = path.join(WAM_DIR, "instance_claims.json");
  TOKEN_CACHE_FILE = path.join(WAM_DIR, "_token_cache.json");
}
let TOKEN_FILE = path.join(WAM_DIR, "oneshot_token.json");
let RESULT_FILE = path.join(WAM_DIR, "inject_result.json");
let LOG_FILE = path.join(WAM_DIR, "wam.log");
let SNAPSHOT_FILE = path.join(WAM_DIR, "quota_snapshots.json");
let INUSE_FILE = path.join(WAM_DIR, "inuse_marks.json");
let RELOAD_SIGNAL = path.join(WAM_DIR, "_reload_signal");
let RELOAD_READY = path.join(WAM_DIR, "_reload_ready");
// TRIAL_MAX_DAYS已移除 — 官方Trial是14天(非90天), 且过期后仍有配额, 不再用时间猜测过期
// PURGE_INTERVAL_MS → _getPurgeIntervalMs() (v17.1 getter化)
const WAM_VERSION = "17.42.20"; // v17.42.19: ExtHost 卡死根治 — 启动宽限期 + msgAnchor 延迟安装 + 0 号池跳过引擎 + Bridge 延迟唤醒 — package.json string default:"" 与代码 default 真值并存时, vscode.get 返回 ""・原 _cfg 返回空字符串 → new URL("") 抛 Invalid URL → Devin/Firebase 登录全死. 修: val==="" 且 default 非空字符串时回退到代码 default
// v17.42.17: 重新锚定本源 — 一对话一会话·多对话并行 (TurnTracker: msgAnchor 起点 → 配额 stable / maxMs 兜底 终结)
// 历史锚点: v17.42.15: 载营魄抱一 — 存储本源五重机制 (L1原子写+L2内容感知备份+L3灾难回退+L4文件锁+L5journal+NULL-WIPE护本)
// 根因: ~/.wam-hot 单路径刚则断 · _detectProductName 首词为空即退 Windsurf · activate 无try/catch
// 突破: _resolveWamDir 六级链 (env→cfg→legacy→user-isolated→globalStorageUri→tmpdir) · _isPathWritable 探测 · activate 四级降级模式
// 历史锚点保留 (向后兼容/审计): v17.42.12: 道法自然·@vscode/proxy-agent本源突破 — env隔离+undici重置 + proxySupport='on'+agent:false绕死代理
// 历史锚点保留 (向后兼容/审计): v17.42.6: 死代理 env 自净 (启动 TCP 验活 · 死则剔 env)
let _deadProxyQuarantined = false;
let _savedProxySupport = null; // 原 http.proxySupport 值 · quarantine 时保存 · 活代理恢复时还原

let _store = null;
let _sidebarProvider = null;
let _editorPanel = null;
let _statusBarItem = null;
let _watcher = null;
// v15: Chromium原生网络桥 — 万法归宗
// Webview在Chromium渲染进程中运行, 自动继承系统代理/DNS/TLS
// 只要用户能官方登录Windsurf, 此通道必然可达Firebase/Codeium
let _fetchIdCounter = 0;
const _fetchPending = new Map();
let _bridgeReady = false; // v15.1: Chromium桥就绪标志 — 道法自然: 有桥才走桥
let _bridgeReadyCallbacks = []; // v15.1: 桥就绪后执行的回调队列
let _bridgeEnsureTimer = null; // v15.1: 自动确保桥可用的定时器
let _switching = false;
let _switchingStartTime = 0; // v7.3: 切号锁开始时间, 用于超时释放+手动抢占
let _activateTs = 0; // v17.42.19: activate 时间戳 · 启动宽限期基准
const _STARTUP_GRACE_MS = 15000; // v17.42.19: LS 冷启宽限 15s · 宽限期内 monkey-patch 不触发 · 防事件循环饥饿
let _pollTimer = null;
let _purgeRunning = false;
let _lastPurgeTime = 0;
let _mode = "wam"; // 'wam' = 切号模式 | 'official' = 官方登录模式
let MODE_FILE = path.join(WAM_DIR, "wam_mode.json");

// v17.36 · 反者道之动 · proxy/origin 状态变量已剥离 · WAM 纯切号

// ════════════════════════════════════════════════════════════════════════
// v17.39 · 消息锚定 · 五路道并行 · 反者道之动 · 太上不知有之
// ────────────────────────────────────────────────────────────────────────
// 病根: monitorActiveQuota 依赖 fetchAccountQuota 成功 → 外部 API 被 ban/限流
//       即等于切号链断 · 用户发消息后毫无反应
// 药方: 跳出"轮询额度变化"的表象 · 直接锚定"消息发送"动作本身
//       多路探针独立工作 · 任一命中即直接排队一次切号 · 零外部依赖
//       道并行而不相悖 · 鸡狗之声相闻·民至老死不相往来 — 各路互不通信各自为战
// 路径:
//   A · 网络层: monkey-patch https/http.request, 嗅探 localhost gRPC + 云端 cascade 流量 (v17.42 根治: localhost双层匹配)
//   B · 命令层: monkey-patch vscode.commands.executeCommand, 嗅探 cascade 命令 (v17.42: 逆向确认真实命令名)
//   C · 文件层: ~/.codeium/windsurf/cascade/*.pb mtime 变化 (发送即写盘)
//   D · 错误层: 既有 _rateLimitWatcher · 独立平行保留
//   E · HTTP/2层: monkey-patch http2.connect, 嗅探 ConnectRPC gRPC 方法 (v17.42 新增: 覆盖 HTTP/2 transport)
// 品德: 太上不知有之 — 零 Toast · 日志独白 · 切号延 1.5s 让流完成再切
// v17.42: 消息发送即刻标记使用中 (不等额度变化) · 与 monitorActiveQuota 道并行而不相悖
// ════════════════════════════════════════════════════════════════════════
const _msgAnchor = {
  lastSendTs: 0, // 最后一次任意路径检测到的 send (用于多路去重)
  sendCounter: 0, // 累计 send 次数 (用于 everyN 分流)
  lastSwitchTriggerTs: 0, // 最后一次排队切号时间 (用于 cooldown 日志)
  debounceTimer: null,
  paths: {
    network: {
      active: false,
      hits: 0,
      last: 0,
      origHttpsReq: null,
      origHttpReq: null,
      origFetch: null, // v17.42.1: globalThis.fetch hook 状态完整声明
    },
    command: { active: false, hits: 0, last: 0, origExec: null },
    cascade: { active: false, hits: 0, last: 0, watcher: null, dir: "" },
    http2: { active: false, hits: 0, last: 0, origConnect: null }, // v17.42: ConnectRPC HTTP/2 transport
    ratelim: { active: false, hits: 0, last: 0 }, // 既有 _rateLimitWatcher · 仅统计
  },
};

// ════════════════════════════════════════════════════════════════════════
// v17.42.17 · 重新锚定本源 · TurnTracker (一对话一会话 · 多对话并行)
// ════════════════════════════════════════════════════════════════════════
// 用户原则:
//   1. 每个对话内 send 那一刻所对应的活跃账号 = 此次 turn 所用账号
//   2. 多对话并行: 不同对话先后 send · 切号已分流 · 各 turn 独立跟踪
//   3. 实时监测会话生命周期: 没结束 = 使用中 · 结束 = 取消标记
//   4. 道法自然: turn 终结由 (active 配额 stableMs 不变) 自然推断 · 兜底 maxMs 强制
// 设计:
//   _turns      内存本源 (不持盘) — 每个 turn 一记录 · status active|completed
//   _inUse      跨实例协调 (持盘) — turn 创建/终结时同步增删 (现有协议不动)
//   isInUseByThisConversation(email) → 等价 _hasActiveTurnForEmail(email)
//   多 turn 同 email 共存合法 (用户在切号前快速二次发送同一对话)
// ────────────────────────────────────────────────────────────────────────
const _turns = new Map(); // turnId → Turn { turnId, email, startTs, lastQuotaChangeTs, baselineD, baselineW, lastD, lastW, status, endTs, reason }
let _turnTicker = null;
let _turnSeq = 0; // 单实例自增序列, 配 _instanceId 拼 turnId

function _newTurnId() {
  _turnSeq++;
  // 短 id 便于日志阅读: 实例首4字 + 自增 base36
  const inst = String(_instanceId || "i").substring(0, 4);
  return `${inst}.${_turnSeq.toString(36)}`;
}

function _activeTurnsByEmail(email) {
  const key = String(email || "").toLowerCase();
  if (!key) return [];
  const out = [];
  for (const t of _turns.values()) {
    if (t.status === "active" && t.email === key) out.push(t);
  }
  return out;
}

function _hasActiveTurnForEmail(email) {
  return _activeTurnsByEmail(email).length > 0;
}

function _activeTurnCount() {
  let n = 0;
  for (const t of _turns.values()) if (t.status === "active") n++;
  return n;
}

function _startTurn(email) {
  if (!_getTurnEnabled() || !email) return null;
  const key = String(email).toLowerCase();
  const now = Date.now();
  let baseD = -1,
    baseW = -1;
  try {
    const snap = _quotaSnapshots && _quotaSnapshots.get(key);
    if (snap) {
      baseD = typeof snap.daily === "number" ? snap.daily : -1;
      baseW = typeof snap.weekly === "number" ? snap.weekly : -1;
    }
  } catch {}
  const turnId = _newTurnId();
  const turn = {
    turnId,
    email: key,
    startTs: now,
    lastQuotaChangeTs: now, // 起步即视为"刚变化", 让 stableMs 从 send 后计
    baselineD: baseD,
    baselineW: baseW,
    lastD: baseD,
    lastW: baseW,
    status: "active",
    endTs: 0,
    reason: "",
  };
  _turns.set(turnId, turn);
  // 同步投影到 _inUse: 跨实例可见 · 现有协议 (since/lastChange 二元组) 不动
  if (_store && typeof _store.markInUse === "function") {
    try {
      _store.markInUse(key);
    } catch {}
  }
  log(
    `🌀 turn-start ${turnId} ${key.substring(0, 24)} D=${baseD}% W=${baseW}% · active=${_activeTurnCount()}`,
  );
  return turnId;
}

function _observeTurnQuotaForEmail(email, daily, weekly) {
  if (!_getTurnEnabled() || !email) return false;
  const key = String(email).toLowerCase();
  const now = Date.now();
  let touched = false;
  for (const t of _turns.values()) {
    if (t.status !== "active" || t.email !== key) continue;
    const dChanged = typeof daily === "number" && daily !== t.lastD;
    const wChanged =
      typeof weekly === "number" && weekly >= 0 && weekly !== t.lastW;
    if (dChanged || wChanged) {
      t.lastD = typeof daily === "number" ? daily : t.lastD;
      t.lastW = typeof weekly === "number" && weekly >= 0 ? weekly : t.lastW;
      t.lastQuotaChangeTs = now;
      touched = true;
    }
  }
  return touched;
}

function _endTurn(turnId, reason) {
  const t = _turns.get(turnId);
  if (!t || t.status !== "active") return null;
  t.status = "completed";
  t.endTs = Date.now();
  t.reason = reason || "completed";
  // 该 email 是否还有别的 active turn? 无 → 释放 _inUse 标 (turn 是真理)
  const stillActive = _hasActiveTurnForEmail(t.email);
  if (!stillActive && _store) {
    try {
      _store.clearInUse(t.email);
    } catch {}
  }
  log(
    `🌀 turn-end ${turnId} ${t.email.substring(0, 24)} · ${reason || "completed"} · ${Math.round((t.endTs - t.startTs) / 1000)}s · active剩=${_activeTurnCount()}`,
  );
  return t;
}

function _pruneTurns() {
  const cutoff = Date.now() - _getTurnRetainMs();
  for (const [k, t] of _turns) {
    if (t.status !== "active" && t.endTs && t.endTs < cutoff) {
      _turns.delete(k);
    }
  }
}

function _tickTurns() {
  if (!_getTurnEnabled()) return;
  const now = Date.now();
  const stableMs = _getTurnStableMs();
  const minMs = _getTurnMinMs();
  const maxMs = _getTurnMaxMs();
  for (const [tid, t] of _turns) {
    if (t.status !== "active") continue;
    const age = now - t.startTs;
    const idle = now - t.lastQuotaChangeTs;
    if (age >= maxMs) {
      _endTurn(tid, "timeout");
    } else if (age >= minMs && idle >= stableMs) {
      _endTurn(tid, "stable");
    }
  }
  _pruneTurns();
}

function _startTurnTicker() {
  if (_turnTicker) return;
  if (!_getTurnEnabled()) return;
  _turnTicker = setInterval(() => {
    try {
      _tickTurns();
    } catch (e) {
      log(`turn tick err: ${e.message}`);
    }
  }, _getTurnTickMs());
  log(
    `🌀 turn ticker on · stableMs=${_getTurnStableMs()} minMs=${_getTurnMinMs()} maxMs=${_getTurnMaxMs()} tick=${_getTurnTickMs()}`,
  );
}

function _stopTurnTicker() {
  if (_turnTicker) {
    clearInterval(_turnTicker);
    _turnTicker = null;
    // v17.42.17 终结统计: 报告还有多少 active turn 残留 (deactivate / 模式切换审计)
    const stats = { active: 0, completed: 0 };
    for (const t of _turns.values()) {
      if (t.status === "active") stats.active++;
      else stats.completed++;
    }
    log(
      `🌀 turn ticker off · active=${stats.active} completed=${stats.completed}`,
    );
  }
}

function _endAllActiveTurnsForEmail(email, reason) {
  for (const t of _activeTurnsByEmail(email)) {
    _endTurn(t.turnId, reason || "manual");
  }
}

function _getTurnSnapshot() {
  // 供 wam.status / E2E / 调试 · 返回所有 turn 概要
  const out = [];
  for (const t of _turns.values()) {
    out.push({
      turnId: t.turnId,
      email: t.email,
      status: t.status,
      ageMs:
        t.status === "active" ? Date.now() - t.startTs : t.endTs - t.startTs,
      idleMs: t.status === "active" ? Date.now() - t.lastQuotaChangeTs : 0,
      reason: t.reason || "",
    });
  }
  return out;
}

function _getMsgAnchorEnabled() {
  return _cfg("messageAnchor.enabled", true); // 默认启用 · 太上不知有之
}
function _getMsgAnchorDebounceMs() {
  // send 检测到后延后多少 ms 再切号 (让当前 stream 完成)
  return _cfg("messageAnchor.debounceMs", 1500);
}
function _getMsgAnchorEveryN() {
  return _cfg("messageAnchor.everyN", 1); // 每 N 次 send 切一次 (1=每次)
}
function _getMsgAnchorDedupeMs() {
  // 多路并发命中去重窗口 (ms)
  return _cfg("messageAnchor.dedupeMs", 300);
}
function _getMsgAnchorPathEnabled(p) {
  // 允许运维单独关路 (默认全开)
  return _cfg(`messageAnchor.path.${p}`, true);
}

// 统一触发入口: 任一探针调用此函数
function _msgAnchorTrigger(source) {
  if (!_getMsgAnchorEnabled()) return;
  const now = Date.now();
  // v17.42.19 知止可以不殆: LS 冷启宽限期 · 防 gRPC 风暴 × 正则匹配致事件循环饥饿
  if (_activateTs > 0 && now - _activateTs < _STARTUP_GRACE_MS) return;
  const p = _msgAnchor.paths[source];
  if (p) {
    p.hits++;
    p.last = now;
  }
  // v17.42.17 重新锚定本源 · 一对话一会话 · 多对话并行:
  //   send 那一刻 = 一新 turn 起点 · 关联当时活跃账号 (用户原则)
  //   不独占: 多对话场景允许多 turn 同时 active (各自不同 email · 切号已分流)
  //   终结: 由 _tickTurns 周期检测 (active 配额 stableMs 不变 / maxMs 兜底)
  //   切号: 现有 msgAnchorDoSwitch debounce 1.5s 不变 (everyN=1 默认每次 send 切)
  //   _startTurn 内部已同步 _store.markInUse(email) 投影到跨实例协调层
  if (_store && _store.activeIndex >= 0) {
    const activeAcc = _store.get(_store.activeIndex);
    if (activeAcc) {
      _startTurn(activeAcc.email);
    }
  }
  // 多路并发命中去重 · 窗口内仅算一次
  if (now - _msgAnchor.lastSendTs < _getMsgAnchorDedupeMs()) return;
  _msgAnchor.lastSendTs = now;
  _msgAnchor.sendCounter++;
  const everyN = Math.max(1, _getMsgAnchorEveryN());
  log(
    `📬 msgAnchor[${source}] send#${_msgAnchor.sendCounter} | N${_msgAnchor.paths.network.hits} C${_msgAnchor.paths.command.hits} F${_msgAnchor.paths.cascade.hits} H${_msgAnchor.paths.http2.hits} R${_msgAnchor.paths.ratelim.hits}`,
  );
  if (_msgAnchor.sendCounter % everyN !== 0) return; // N 轮切一次
  if (_msgAnchor.debounceTimer) clearTimeout(_msgAnchor.debounceTimer);
  _msgAnchor.debounceTimer = setTimeout(() => {
    _msgAnchor.debounceTimer = null;
    _msgAnchorDoSwitch(source).catch((e) =>
      log(`msgAnchor[${source}] switch err: ${e.message}`),
    );
  }, _getMsgAnchorDebounceMs());
}

async function _msgAnchorDoSwitch(source) {
  // 闸门 (与 monitorActiveQuota 同一套风控)
  if (!_store || !isWamMode()) return;
  if (_switching) {
    log(`msgAnchor[${source}]: 切号中, 跳过`);
    return;
  }
  const autoRotate = vscode.workspace
    .getConfiguration("wam")
    .get("autoRotate", true);
  if (!autoRotate) return;
  const sinceLast = Date.now() - _lastSwitchTime;
  if (sinceLast < _getSwitchCooldownMs()) {
    log(
      `msgAnchor[${source}]: 切号冷却 ${Math.round(sinceLast / 1000)}s/${_getSwitchCooldownMs() / 1000}s, 跳过`,
    );
    return;
  }
  const injectCd = Date.now() - _lastInjectFail < _getInjectFailCooldown();
  if (injectCd) {
    log(`msgAnchor[${source}]: 注入失败冷却中, 跳过`);
    return;
  }
  const activeI = _store.activeIndex;
  const activeAcc = activeI >= 0 ? _store.get(activeI) : null;
  if (activeAcc?.skipAutoSwitch) {
    log(`msgAnchor[${source}]: 活跃账号已锁定, 跳过`);
    return;
  }
  // v17.42.7 锁🔒贯通: stale _predictiveCandidate 必经 _isValidAutoTarget 四辨 (含 skipAutoSwitch)
  let bestI =
    _predictiveCandidate >= 0 && _isValidAutoTarget(_predictiveCandidate)
      ? _predictiveCandidate
      : _store.getBestIndex(activeI, true);
  if (bestI < 0) {
    log(`msgAnchor[${source}]: 无可用账号`);
    return;
  }
  let bestAcc = _store.get(bestI);
  log(
    `⚡ msgAnchor[${source}] → ${bestAcc.email.substring(0, 25)}${_predictiveCandidate >= 0 ? " [预判]" : ""}`,
  );
  _switching = true;
  _switchingStartTime = Date.now();
  _msgAnchor.lastSwitchTriggerTs = Date.now();
  try {
    let ok = false;
    for (let r = 0; r < 3 && !ok; r++) {
      if (r > 0) {
        bestI = _store.getBestIndex(activeI, true);
        if (bestI < 0) break;
        bestAcc = _store.get(bestI);
        log(`  msgAnchor retry#${r}: → ${bestAcc.email.substring(0, 25)}`);
      }
      const sr = await switchToAccount(bestAcc.email, bestAcc.password);
      if (sr.ok) {
        _afterSwitchSuccess(bestI, bestAcc.email); // v17.42.2 不变量统一
        _predictiveCandidate = _store.getBestIndex(bestI, true);
        if (_predictiveCandidate >= 0)
          _prewarmCandidateToken(_predictiveCandidate);
        _burstUntil = Date.now() + _getBurstDuration();
        updateStatusBar();
        refreshAll();
        // 太上不知有之: 零 Toast · 日志独白
        log(`  ✅ msgAnchor[${source}] OK ${sr.account} [${sr.ms}ms]`);
        ok = true;
      } else if (sr.error && /登录失败/.test(sr.error)) {
        continue;
      } else if (
        sr.error &&
        /五感模式|已保留现有会话|inject failed/i.test(sr.error)
      ) {
        // v17.42 道法自然: 五感注入失败是系统性问题 — 重试同一机制无效
        //   日志显示 175 次无效重试 · 每次 12s+ · 总锁时间 30min+
        //   知止可以不殆: 立即放弃重试 · 缩短冷却 · 快速释放 _switching 锁
        _lastInjectFail = Date.now();
        _predictiveCandidate = -1;
        log(
          `  ⚠️ msgAnchor[${source}] 五感注入失败(系统性) — 不重试: ${sr.error}`,
        );
        break;
      } else {
        if (r < 2) {
          await new Promise((s) => setTimeout(s, _getSwitchRetryDelayMs()));
          continue;
        }
        _lastInjectFail = Date.now();
        _predictiveCandidate = -1;
        log(`  ❌ msgAnchor[${source}] FAIL: ${sr.error}`);
        break;
      }
    }
  } finally {
    _switching = false;
  }
}

// ── Path A · 网络拦截 (monkey-patch https.request / http.request) ──
// 上善如水: 非侵入观察 · 仅嗅探不改写 · 任何异常直接 fall-through 原函数
function _installNetworkAnchor() {
  if (_msgAnchor.paths.network.active) return false;
  if (!_getMsgAnchorPathEnabled("network")) return false;
  const st = _msgAnchor.paths.network;
  try {
    st.origHttpsReq = https.request;
    st.origHttpReq = http.request;
    // v17.42 反者道之动 · 逆向本源:
    //   Windsurf extension → ConnectRPC (gRPC-Web) → localhost:PORT (本地 LS) → server.codeium.com
    //   旧版仅匹配 codeium.com → 永远不命中 localhost 上的 Cascade gRPC 请求
    //   根因修复: 双层匹配 — 云端宽松 + 本地精确
    const cloudHost = /codeium\.com|windsurf\.com|exafunction/i;
    const localHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i;
    // 精确: Windsurf LanguageServerService Cascade 发送动作 (逆向确认的 RPC 方法)
    const grpcCascadeSend =
      /SendUserCascadeMessage|StartCascade|HandleCascadeUserInteraction|BranchCascade|SpawnArenaMode/i;
    // 宽松: 云端 API / 泛 cascade 流量 (兼容旧版)
    const cloudPath =
      /Stream(Cascade|Chat|Turn)|Cascade(Request|Turn|Chat)|SubmitUser|SendMessage|PushTurn|RunTurn|\/chat\//i;
    const hook = (orig) =>
      function patched(arg0, arg1, arg2) {
        try {
          let host = "";
          let _path = "";
          if (typeof arg0 === "string") {
            try {
              const u = new URL(arg0);
              host = u.hostname + (u.port ? ":" + u.port : "");
              _path = u.pathname + u.search;
            } catch {}
          } else if (arg0 && typeof arg0 === "object") {
            host = String(arg0.hostname || arg0.host || "");
            _path = String(arg0.path || "");
          }
          // 道并行: 云端宽松匹配 OR 本地精确 gRPC 匹配 — 任一命中即触发
          if (
            (cloudHost.test(host) && cloudPath.test(_path)) ||
            (localHost.test(host) && grpcCascadeSend.test(_path))
          ) {
            _msgAnchorTrigger("network");
          }
        } catch {}
        return orig.apply(this, arguments);
      };
    https.request = hook(st.origHttpsReq);
    http.request = hook(st.origHttpReq);
    // v17.42 突破: globalThis.fetch hook (Node 18+ / undici)
    //   根因: ConnectRPC 使用 fetch 而非 http.request — 旧 hook 永远 N0
    //   fetch 是全局引用 · 不存在缓存问题 · patch 后立即对所有调用者生效
    if (typeof globalThis.fetch === "function") {
      st.origFetch = globalThis.fetch;
      const _cloudHost = cloudHost;
      const _localHost = localHost;
      const _grpcSend = grpcCascadeSend;
      const _cloudPathRe = cloudPath;
      globalThis.fetch = function patchedFetch(input, init) {
        try {
          let url = "";
          if (typeof input === "string") url = input;
          else if (input instanceof URL) url = input.href;
          else if (input && typeof input === "object" && input.url)
            url = input.url;
          if (url) {
            try {
              const u = new URL(url);
              const h = u.hostname + (u.port ? ":" + u.port : "");
              const p = u.pathname + u.search;
              if (
                (_cloudHost.test(h) && _cloudPathRe.test(p)) ||
                (_localHost.test(h) && _grpcSend.test(p))
              ) {
                _msgAnchorTrigger("network");
              }
            } catch {}
          }
        } catch {}
        return st.origFetch.apply(this, arguments);
      };
      log("msgAnchor: path-A fetch hook active (undici/globalThis.fetch)");
    }
    st.active = true;
    log(
      "msgAnchor: 🌊 path-A network installed (v17.42 localhost+cloud+fetch)",
    );
    return true;
  } catch (e) {
    log(`msgAnchor: path-A install FAIL ${e.message}`);
    return false;
  }
}
function _uninstallNetworkAnchor() {
  const st = _msgAnchor.paths.network;
  if (!st.active) return;
  try {
    if (st.origHttpsReq) https.request = st.origHttpsReq;
    if (st.origHttpReq) http.request = st.origHttpReq;
    if (st.origFetch) globalThis.fetch = st.origFetch;
  } catch {}
  st.active = false;
}

// ── Path B · 命令拦截 (monkey-patch vscode.commands.executeCommand) ──
// 柔弱胜刚强: 原函数原样返回 · 仅旁路触发事件
function _installCommandAnchor() {
  if (_msgAnchor.paths.command.active) return false;
  if (!_getMsgAnchorPathEnabled("command")) return false;
  const st = _msgAnchor.paths.command;
  try {
    st.origExec = vscode.commands.executeCommand.bind(vscode.commands);
    // v17.42 反者道之动: 逆向确认 Windsurf 真实命令 + 内部 type-dispatch 命令名
    //   windsurf.setWorkspaceCascadeMap → 每次 Cascade 会话创建/切换时触发
    //   windsurf.onShellCommand* → Agent 执行命令时触发 (间接=有对话在进行)
    //   保留旧版宽松匹配作为兜底
    const hit =
      /^(windsurf\.cascade|windsurf\.chat|cascade\.|windsurf\.submit|windsurf\.send|windsurf\.setWorkspaceCascadeMap|windsurf\.onShellCommand|windsurf\.onManagedTerminal|windsurf\.updateTerminal)/i;
    const skip =
      /^(wam\.|workbench\.|windsurf\.signIn|windsurf\.lifeguard|windsurf\.resetProduct|windsurf\.openAcp|windsurf\.reloadAcp|windsurf\.setPortal)/i;
    vscode.commands.executeCommand = function patchedExec(cmdId, ...rest) {
      try {
        if (typeof cmdId === "string" && !skip.test(cmdId) && hit.test(cmdId)) {
          _msgAnchorTrigger("command");
        }
      } catch {}
      return st.origExec(cmdId, ...rest);
    };
    st.active = true;
    log("msgAnchor: 🌊 path-B command installed");
    return true;
  } catch (e) {
    log(`msgAnchor: path-B install FAIL ${e.message}`);
    return false;
  }
}
function _uninstallCommandAnchor() {
  const st = _msgAnchor.paths.command;
  if (!st.active) return;
  try {
    if (st.origExec) vscode.commands.executeCommand = st.origExec;
  } catch {}
  st.active = false;
}

// ── Path C · Cascade 会话文件监听 ──
// ~/.codeium/windsurf/cascade/*.pb · 每次发送一轮即写盘 · 此路最准
function _installCascadeFileAnchor() {
  if (_msgAnchor.paths.cascade.active) return false;
  if (!_getMsgAnchorPathEnabled("cascade")) return false;
  const st = _msgAnchor.paths.cascade;
  try {
    const home = os.homedir();
    const candidates = [
      path.join(home, ".codeium", "windsurf", "cascade"),
      path.join(home, ".codeium", "windsurf", "brain"),
    ];
    let dir = "";
    for (const d of candidates) {
      try {
        if (fs.existsSync(d) && fs.statSync(d).isDirectory()) {
          dir = d;
          break;
        }
      } catch {}
    }
    if (!dir) {
      log("msgAnchor: path-C skip (no cascade dir)");
      return false;
    }
    const recentMtimes = new Map(); // 文件 → 最后见到的 mtime (抑制同文件短时多次改写)
    st.watcher = fs.watch(dir, (eventType, filename) => {
      if (!filename) return;
      if (!/\.pb$/i.test(filename)) return;
      try {
        const full = path.join(dir, filename);
        const m = fs.statSync(full).mtimeMs;
        const prev = recentMtimes.get(filename) || 0;
        if (m - prev < 500) return; // 500ms 文件级去抖
        recentMtimes.set(filename, m);
        _msgAnchorTrigger("cascade");
      } catch {}
    });
    st.watcher.on("error", (err) => {
      log(`msgAnchor: path-C error ${err?.message || ""}`);
    });
    st.dir = dir;
    st.active = true;
    log(`msgAnchor: 🌊 path-C cascade installed · dir=${dir}`);
    return true;
  } catch (e) {
    log(`msgAnchor: path-C install FAIL ${e.message}`);
    return false;
  }
}
function _uninstallCascadeFileAnchor() {
  const st = _msgAnchor.paths.cascade;
  if (!st.active) return;
  try {
    st.watcher?.close();
  } catch {}
  st.watcher = null;
  st.active = false;
}

// ── Path E · HTTP/2 拦截 (prototype-level hook) ──
// v17.42 反者道之动 · 道法自然:
//   根因: Windsurf 在启动时已 require("http2") 并缓存了 connect 引用
//   我们的 http2.connect = patched 只能拦截 新 session · 无法拦截已建立的
//   突破: 直接 patch ClientHttp2Session.prototype.request
//   原型链是共享的 — 所有 session (含启动前创建的) 调用 .request() 都走 patched 路径
//   非侵入观察: 仅嗅探 stream header 中的 :path 伪头 · 不改写任何数据
function _installHttp2Anchor() {
  if (_msgAnchor.paths.http2.active) return false;
  if (!_getMsgAnchorPathEnabled("http2")) return false;
  const st = _msgAnchor.paths.http2;
  try {
    const grpcSend =
      /SendUserCascadeMessage|StartCascade|HandleCascadeUserInteraction|BranchCascade|SpawnArenaMode/i;
    // 策略1: 从活跃进程句柄中定位 ClientHttp2Session 原型
    //   http2 模块不直接导出 ClientHttp2Session 类
    //   但 process._getActiveHandles() 可以找到运行中的 session 实例
    //   通过实例获取原型 → patch 一次 → 覆盖所有 session (含已存在的)
    let proto = null;
    try {
      const handles = process._getActiveHandles
        ? process._getActiveHandles()
        : [];
      for (const h of handles) {
        if (
          h &&
          h.constructor &&
          /Http2Session/i.test(h.constructor.name) &&
          typeof h.request === "function"
        ) {
          proto = Object.getPrototypeOf(h);
          break;
        }
      }
    } catch {}
    if (proto && typeof proto.request === "function") {
      st.origProtoRequest = proto.request;
      st._patchedProto = proto;
      proto.request = function patchedH2ProtoRequest(headers, opts) {
        try {
          const p = headers && (headers[":path"] || headers["path"] || "");
          if (typeof p === "string" && grpcSend.test(p)) {
            _msgAnchorTrigger("http2");
          }
        } catch {}
        return st.origProtoRequest.apply(this, arguments);
      };
      st.active = true;
      log(
        "msgAnchor: 🌊 path-E http2 installed (prototype-level · 覆盖所有session)",
      );
      return true;
    }
    // 策略2 fallback: 无活跃 session · 退回 connect hook (拦截未来 session)
    st.origConnect = http2.connect;
    http2.connect = function patchedH2Connect(authority, options) {
      const session = st.origConnect.apply(this, arguments);
      try {
        const origReq = session.request.bind(session);
        session.request = function patchedH2Request(headers, opts) {
          try {
            const p = headers && (headers[":path"] || headers["path"] || "");
            if (typeof p === "string" && grpcSend.test(p)) {
              _msgAnchorTrigger("http2");
            }
          } catch {}
          return origReq.call(this, headers, opts);
        };
      } catch {}
      return session;
    };
    st.active = true;
    log("msgAnchor: 🌊 path-E http2 installed (connect-level fallback)");
    return true;
  } catch (e) {
    log(`msgAnchor: path-E http2 install FAIL ${e.message}`);
    return false;
  }
}
function _uninstallHttp2Anchor() {
  const st = _msgAnchor.paths.http2;
  if (!st.active) return;
  try {
    if (st.origProtoRequest && st._patchedProto) {
      st._patchedProto.request = st.origProtoRequest;
    }
    if (st.origConnect) http2.connect = st.origConnect;
  } catch {}
  st.active = false;
}

// ── 外部接口: 状态快照 (selfTest/E2E 可读) ──
function _msgAnchorSnapshot() {
  const snap = {
    enabled: _getMsgAnchorEnabled(),
    sendCounter: _msgAnchor.sendCounter,
    lastSendTs: _msgAnchor.lastSendTs,
    lastSwitchTriggerTs: _msgAnchor.lastSwitchTriggerTs,
    paths: {},
  };
  for (const [k, v] of Object.entries(_msgAnchor.paths)) {
    snap.paths[k] = { active: v.active, hits: v.hits, last: v.last };
  }
  return snap;
}

// ── 总装/总拆 ──
function _installMessageAnchor(context) {
  if (!_getMsgAnchorEnabled()) {
    log("msgAnchor: disabled via config");
    return;
  }
  _installNetworkAnchor();
  _installCommandAnchor();
  _installCascadeFileAnchor();
  _installHttp2Anchor(); // v17.42 path-E: ConnectRPC HTTP/2 transport
  // path-D (ratelim) 由既有 _rateLimitWatcher 负责 · 在检测到切号时同步标记命中
  context.subscriptions.push({
    dispose() {
      _uninstallMessageAnchor();
    },
  });
  const active = Object.entries(_msgAnchor.paths)
    .filter(([, v]) => v.active)
    .map(([k]) => k)
    .join(",");
  log(`msgAnchor: 🌊 installed · active=${active || "(none)"}`);
}
function _uninstallMessageAnchor() {
  _uninstallNetworkAnchor();
  _uninstallCommandAnchor();
  _uninstallCascadeFileAnchor();
  _uninstallHttp2Anchor(); // v17.42 path-E
  if (_msgAnchor.debounceTimer) {
    clearTimeout(_msgAnchor.debounceTimer);
    _msgAnchor.debounceTimer = null;
  }
}
// ════════════════════════════════════════════════════════════════════════
// v17.42 END · 消息锚定 · 六路道并行 (A网络+B命令+C文件+D限流+E·HTTP/2)
// ════════════════════════════════════════════════════════════════════════

// ── 性能参数 · v17.11 太上不知有之: 自适应主导, _cfg override 作为 ops 应急兜底 ──
// 用户零感知: package.json 不曝光, _adaptive 自动从 RTT/错率推算
function _getMonitorFastMs() {
  const v = _cfg("monitorIntervalMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.monitorIntervalMs;
}
function _getScanSlowMs() {
  const v = _cfg("scanIntervalMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.scanIntervalMs;
}
function _getScanBatchSize() {
  return _cfg("scanBatchSize", 10);
}
function _getChangeThreshold() {
  return _cfg("changeThreshold", 0.01);
}
function _getTokenCacheTtl() {
  return _cfg("tokenCacheTtlMin", 50) * 60000;
}
function _getInuseCooldownMs() {
  return _cfg("inUseCooldownMs", 120000);
}
// ──────────────────────────────────────────────────────────────────────────
// v17.42.17 · 重新锚定本源 · Turn 生命周期 (一对话一会话 · 多对话并行)
//   turn = 一次完整 Q&A 周期: 用户 send 提示词 → agent 接收处理 → 处理完毕
//   多 turn 并行: 用户在不同对话各自 send · 各 turn 独立跟踪生命周期
//   完成监测: 配额稳定 (D/W stableMs 不变) + max 兜底 → turn 终止
// ──────────────────────────────────────────────────────────────────────────
function _getTurnEnabled() {
  return _cfg("turn.enabled", true);
}
function _getTurnStableMs() {
  // 活跃账号配额稳定多久后视为 agent 处理完毕
  return _cfg("turn.stableMs", 8000);
}
function _getTurnMinMs() {
  // turn 最少持续 ms (避免 send 后立即误判完成)
  return _cfg("turn.minMs", 3000);
}
function _getTurnMaxMs() {
  // turn 最长持续 ms · 超时强制终止 (兜底防永挂)
  return _cfg("turn.maxMs", 180000);
}
function _getTurnTickMs() {
  return _cfg("turn.tickIntervalMs", 1000);
}
function _getTurnRetainMs() {
  // turn 完成后保留多久 (供 wam.status / 调试查询历史)
  return _cfg("turn.retainCompletedMs", 60000);
}
function _getBurstMs() {
  return _cfg("burstIntervalMs", 1500);
}
function _getBurstDuration() {
  return _cfg("burstDurationMs", 60000);
}
function _getAutoSwitchThreshold() {
  const base = _cfg("autoSwitchThreshold", 5);
  // v17.42.5 无感模式: 更激进预切, 比底线早触发 (10% vs 5%) · 太上不知有之
  // 用户永远不会看到 D/W 真的降到危险值, 因为提前切了
  if (_isInvisibleMode()) return Math.max(base, 10);
  return base;
}
function _getPredictiveThreshold() {
  const base = _cfg("predictiveThreshold", 25);
  // 无感模式: 更早预热候选 token (35% vs 25%)
  if (_isInvisibleMode()) return Math.max(base, 35);
  return base;
}
function _getDailyResetHourUtc() {
  return _cfg("dailyResetHourUtc", 8);
}
function _getWeeklyResetDay() {
  return _cfg("weeklyResetDay", 0);
}
function _getWaitResetHours() {
  return _cfg("waitResetHours", 3);
}
function _getInstanceHeartbeatMs() {
  return _cfg("instanceHeartbeatMs", 30000);
}
function _getInstanceDeadMs() {
  return _cfg("instanceDeadMs", 60000);
}
// v17.1 去芜留菁: 所有行为常量均已getter化, 零残留
// ── 注入/清理 时序 ──
function _getInjectFailCooldown() {
  return _cfg("injectFailCooldownMs", 3000);
}
function _getPurgeIntervalMs() {
  return _cfg("purgeIntervalMs", 21600000);
}
// ── 代理缓存 TTL ──
function _getProxyCacheTtl() {
  return _cfg("proxyCacheTtlMs", 300000);
}
function _getProxyFailTtl() {
  return _cfg("proxyFailTtlMs", 30000);
}
// ── 实例Claims缓存 ──
function _getClaimsCacheTtl() {
  return _cfg("claimsCacheTtlMs", 5000);
}
// ── 额度查询节流 · v17.11 自适应 ──
function _getQuotaMinInterval() {
  const v = _cfg("quotaMinIntervalMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.quotaMinIntervalMs;
}
function _getQuota429Backoff() {
  return _cfg("quota429BackoffMs", 60000);
}
// ── Relay IP缓存 ──
function _getRelayIpTtl() {
  return _cfg("relayIpTtlMs", 600000);
}
// ── Token活水池 ──
function _getTokenPoolBurstMs() {
  return _cfg("tokenPool.burstMs", 5000);
}
function _getTokenPoolCruiseMs() {
  return _cfg("tokenPool.cruiseMs", 45000);
}
function _getTokenPoolBurstDuration() {
  return _cfg("tokenPool.burstDurationMs", 180000);
}
function _getTokenPoolMargin() {
  return _cfg("tokenPool.marginMs", 600000);
}
function _getPoolParallelBurst() {
  return _cfg("tokenPool.parallelBurst", 3);
}
function _getPoolParallelCruise() {
  return _cfg("tokenPool.parallelCruise", 1);
}
function _getPoolTempBanThreshold() {
  return _cfg("tokenPool.tempBanThreshold", 3);
}
function _getPoolTempBanDuration() {
  return _cfg("tokenPool.tempBanDurationMs", 900000);
}
// ── 切号/限速冷却 · v17.11 自适应 ──
function _getSwitchCooldownMs() {
  const v = _cfg("switchCooldownMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.switchCooldownMs;
}
function _getRateLimitCooldownMs() {
  return _cfg("rateLimitCooldownMs", 10000);
}
function _getDroughtCacheTtlMs() {
  return _cfg("droughtCacheTtlMs", 10000);
}
// v17.11 太上不知有之: 自适应主导, _cfg override 作 ops 应急兜底 ──────────
// 道法自然 · 实测 RTT/错率自动推算, 用户零感知零配置
function _getScanConcurrency() {
  const v = _cfg("scanConcurrency", null);
  return typeof v === "number" && v >= 1 ? v : _adaptive.scanConcurrency;
}
function _getScanPerBatchDelayMs() {
  const v = _cfg("scanPerBatchDelayMs", null);
  return typeof v === "number" && v >= 0 ? v : _adaptive.scanPerBatchDelay;
}
function _getLogoutTimeoutMs() {
  const v = _cfg("logoutTimeoutMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.logoutTimeout;
}
function _getInjectRetryDelayMs() {
  const v = _cfg("injectRetryDelayMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.injectRetryDelay;
}
function _getPurgeDelayMs() {
  const v = _cfg("purgeDelayMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.purgeDelay;
}
function _getSwitchRetryDelayMs() {
  const v = _cfg("switchRetryDelayMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.switchRetryDelay;
}
function _getWatcherRestartDelayMs() {
  const v = _cfg("watcherRestartDelayMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.watcherRestartDelay;
}
// injectAuth 4 段 timeout (自适应)
function _getInjectPhase1TimeoutMs() {
  const v = _cfg("injectPhase1TimeoutMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.injectPhase1Timeout;
}
function _getInjectPhase2TimeoutMs() {
  const v = _cfg("injectPhase2TimeoutMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.injectPhase2Timeout;
}
function _getInjectPhase3TimeoutMs() {
  const v = _cfg("injectPhase3TimeoutMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.injectPhase3Timeout;
}
function _getInjectPhase4TimeoutMs() {
  const v = _cfg("injectPhase4TimeoutMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.injectPhase4Timeout;
}
function _getDohTimeoutMs() {
  const v = _cfg("dohTimeoutMs", null);
  return typeof v === "number" && v > 0 ? v : _adaptive.dohTimeout;
}
function _getStartupScanDelayMs() {
  return _cfg("startupScanDelayMs", 2000); // 启动后首次 scan 延迟
}
function _getMonitorBurstDelayMs() {
  return _cfg("monitorBurstDelayMs", 1500); // burst 后 monitor 再触发延迟
}
// v17.10 太上·不知有之: autoUpdate 自动推送新版本 (各扩展无感接收)
// v17.17 公网天网: autoDiscover 默认开启 · source 未配置时默认走 jsDelivr 多镜像 fallback · 道法自然
function _getAutoUpdateEnabled() {
  return _cfg("autoUpdate.enabled", true); // 默认启用 · v17.17 后无配置亦能走公网
}
function _getAutoUpdateAutoDiscover() {
  // source 未设时 · 是否自动使用 jsDelivr 默认源 + 多镜像 fallback
  return _cfg("autoUpdate.autoDiscover", true);
}
// v17.38 主仓归宗: 默认源指向公开主仓 wam-bundle/ · 零隐私·对外正式发布地址
// v17.42.18 死链复活: AiCodeHelper/rt-flow 不存在 (404) · 改指 zhouyoukang/windsurf-assistant 主仓 wam-bundle/
const _DEFAULT_PUBLIC_SOURCE =
  "https://cdn.jsdelivr.net/gh/zhouyoukang/windsurf-assistant@main/wam-bundle/";
function _getAutoUpdateSource() {
  const userSrc = _cfg("autoUpdate.source", ""); // SMB 路径 或 HTTPS URL
  if (userSrc) return userSrc;
  // v17.17 道法自然: 用户未配置时·若 autoDiscover=true 则默认用公网 jsDelivr (fallback 链自动选通的镜像)
  if (_getAutoUpdateAutoDiscover()) return _DEFAULT_PUBLIC_SOURCE;
  return "";
}
function _getAutoUpdateCheckIntervalMs() {
  return Math.max(60000, _cfg("autoUpdate.checkIntervalMs", 3600000)); // 默认 1h · 最小 1min
}
function _getAutoUpdateStartDelayMs() {
  return _cfg("autoUpdate.startDelayMs", 10000); // 启动后延迟首次检查
}
function _getAutoUpdateNotifyUser() {
  return _cfg("autoUpdate.notifyUser", false); // 默认静默 · 太上不知有之
}

let INSTANCE_LOCK_FILE = path.join(WAM_DIR, "instance_claims.json");

let _quotaSnapshots = new Map(); // email -> {daily, weekly, ts}
let _tokenCache = new Map(); // email -> {idToken, expiresAt}
let TOKEN_CACHE_FILE = path.join(WAM_DIR, "_token_cache.json"); // v13.1: 持久化
let _tokenCacheDirty = false; // 标记是否需要落盘
let _monitorTimer = null;
let _scanTimer = null;
let _scanRunning = false;
let _scanOffset = 0;
let _monitorActive = false; // 正在执行监测
let _totalMonitorCycles = 0;
let _lastMonitorSaveTs = 0; // 监测循环save节流时间戳
let _totalChangesDetected = 0;
let _burstUntil = 0; // 突发模式截止时间戳
let _consecutiveChanges = 0; // 连续变动计数 (锚定强度)
let _lastSwitchTime = 0; // 上次切号时戳
let _lastInjectFail = 0; // v13.4: 上次注入失败时间戳
let _consecutiveInjectFails = 0; // v14.2: 连续注入失败计数 → 触发_workingInjectCmd重置
let _lastSelfActivity = 0; // 上次本实例活动时间 (编辑器/终端/对话)
let _instanceId = crypto.randomBytes(4).toString("hex"); // 本实例唯一ID
let _heartbeatTimer = null;
let _predictiveCandidate = -1; // 预判候选账号索引 (-1=无)
let _prewarmedToken = null; // v8: 预热Token缓存 {email, idToken, ts} — 道法自然: 切号前已备好弹药
let _rateLimitWatcher = null; // v8: Rate-limit错误拦截器
let _reloadWatcher = null; // v13.6: 热部署自动重载定时器
let _droughtCache = { value: false, ts: 0 }; // Weekly干旱缓存 (10秒TTL)
let _tokenPoolTimer = null; // v12: 永续Token活水池定时器

let _logDirReady = false;
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  if (!_logDirReady) {
    try {
      fs.mkdirSync(WAM_DIR, { recursive: true });
      _logDirReady = true;
    } catch {}
  }
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
  console.log("WAM:", msg);
}

// ═══════════════════════════════════════════════════════════════════
// v17.42.5 · 太上不知有之 · 通知/无感三级治理
// ═══════════════════════════════════════════════════════════════════
// 道法自然 · 为而不争 · 披褐怀玉
//   silent  : 零 Toast · 仅日志 (怡然自得)
//   notify  : 仅用户主动操作 · 自动行为一律静默 (默认)
//   verbose : 现状 · 全量 Toast (调试可见)
//
//   wam.invisible = true  →  强制 silent + 状态栏极简 + 激进预切
//                            (太上 · 百姓皆谓我自然)
// ─────────────────────────────────────────────────────────────────
function _isInvisibleMode() {
  return !!_cfg("invisible", false);
}
function _getNotifyLevel() {
  // 无感模式 → 强制 silent (覆盖用户配置)
  if (_isInvisibleMode()) return "silent";
  const lvl = String(_cfg("notify.level", "notify")).toLowerCase();
  return ["silent", "notify", "verbose"].includes(lvl) ? lvl : "notify";
}
// kind: "user"  → 用户主动命令结果 (手动切号/添加/模式切换等) · notify/verbose 显示
//       "auto"  → 后台自动行为 (自动切号/autoUpdate/Devin识别等) · 仅 verbose 显示
//       "fatal" → 致命错误 (归档账号/切号失败等) · 永远显示
function _shouldNotify(kind) {
  if (kind === "fatal") return true; // 致命永不静默
  const lvl = _getNotifyLevel();
  if (lvl === "silent") return false;
  if (lvl === "notify") return kind === "user"; // notify 只响应用户主动
  return true; // verbose 全量
}
function _notifyInfo(msg, kind = "user") {
  log(`[notify:${kind}] ${msg}`);
  if (_shouldNotify(kind)) vscode.window.showInformationMessage(msg);
}
function _notifyWarn(msg, kind = "user") {
  log(`[notify:${kind}:warn] ${msg}`);
  if (_shouldNotify(kind)) vscode.window.showWarningMessage(msg);
}
function _notifyError(msg) {
  // error 保留 vscode 原生路径 · 永不静默 (符合用户关键反馈预期)
  log(`[notify:error] ${msg}`);
  vscode.window.showErrorMessage(msg);
}

// ── 凭证净化 — 道法自然·反者道之动 ──
// 聊天软件/输入法/Markdown渲染器 会把 ASCII 特殊字符悄悄换成 look-alike 全角/零宽:
//   "*" ↔ "＊"(U+FF0A)   "&" ↔ "＆"(U+FF06)   "$" ↔ "＄"(U+FF04)
//   "%" ↔ "％"(U+FF05)   "^" ↔ "＾"(U+FF3E)   "@" ↔ "＠"(U+FF20)
//   NBSP(U+00A0) / ZWSP(U+200B) / ZWNJ(U+200C) / ZWJ(U+200D) / BOM(U+FEFF)
// 肉眼看是 ASCII, bytes 却非 ASCII → Firebase 返回 INVALID_LOGIN_CREDENTIALS
// 修复: 入池前先 NFKC 归一 (全角→半角) + 剔零宽. 对纯ASCII无副作用.
function _sanitizeCredential(s) {
  if (typeof s !== "string" || !s) return s;
  // 快路径: 纯 ASCII 直接返回, 零开销
  let allAscii = true;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) {
      allAscii = false;
      break;
    }
  }
  if (allAscii) return s;
  // 慢路径: NFKC 归一化 + 剔除零宽字符 + 剔除 NBSP
  return s.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "");
}

// 调试用: 把字符串首尾 16 字节 hex dump (便于排查伪装字符)
function _hexFingerprint(s) {
  if (typeof s !== "string" || !s) return "";
  const buf = Buffer.from(s, "utf8");
  if (buf.length <= 24) return buf.toString("hex");
  return (
    buf.slice(0, 12).toString("hex") + ".." + buf.slice(-12).toString("hex")
  );
}

// ── 持久化引擎 — 快照/使用中标记 落盘 (反者道之动: 不信内存, 只信磁盘) ──
let _snapshotDirty = false;
let _inUseDirty = false;
let _persistTimer = null;

function _saveSnapshots() {
  try {
    const obj = {};
    for (const [k, v] of _quotaSnapshots) obj[k] = v;
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(obj), "utf8");
  } catch (e) {
    log(`snapshot save err: ${e.message}`);
  }
  _snapshotDirty = false;
}

function _loadSnapshots() {
  try {
    if (fs.existsSync(SNAPSHOT_FILE)) {
      const data = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
      let loaded = 0;
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v.daily === "number" && typeof v.weekly === "number") {
          const existing = _quotaSnapshots.get(k);
          if (!existing || !existing.ts || (v.ts && v.ts > existing.ts)) {
            _quotaSnapshots.set(k, v);
            loaded++;
          }
        }
      }
      if (loaded > 0)
        log(
          `snapshots: merged ${loaded} from disk (total=${_quotaSnapshots.size})`,
        );
    }
  } catch (e) {
    log(`snapshot load err: ${e.message}`);
  }
}

function _saveInUse(store) {
  try {
    const obj = {};
    for (const [k, v] of store._inUse) obj[k] = v;
    fs.writeFileSync(INUSE_FILE, JSON.stringify(obj), "utf8");
  } catch (e) {
    log(`inUse save err: ${e.message}`);
  }
  _inUseDirty = false;
}

function _loadInUse(store) {
  try {
    if (fs.existsSync(INUSE_FILE)) {
      const data = JSON.parse(fs.readFileSync(INUSE_FILE, "utf8"));
      const now = Date.now();
      let loaded = 0;
      for (const [k, v] of Object.entries(data)) {
        if (v && v.lastChange && now - v.lastChange < _getInuseCooldownMs()) {
          const existing = store._inUse.get(k);
          // 只合并更新的标记 (不覆盖本实例更新鲜的数据)
          if (!existing || v.lastChange > existing.lastChange) {
            store._inUse.set(k, v);
            loaded++;
          }
        }
      }
      if (loaded > 0)
        log(
          `inUse: merged ${loaded} marks from disk (total=${store._inUse.size})`,
        );
    }
  } catch (e) {
    log(`inUse load err: ${e.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// v17.42.15 · 载营魄抱一 · 存储本源五重机制 (账号永不分离)
//   L1 原子写    — tmp → fsync → rename · 写半程不损本
//   L2 内容感知备份 — 坏件不挤好备 · 分层保留 (近 N + 日 1 + 初启 1)
//   L3 灾难侦测  — load 空而盘曾有 → 扫 _wam_backups 回退自愈
//   L4 文件锁    — 多实例串行写 · PID+ts · 无库依赖
//   L5 事件 journal — append-only · 7MB 滚动 · 永不互覆
// 绵绵若存, 用之不勤 · 生而不有, 为而不恃 · 功成事遂, 百姓皆谓我自然
// ──────────────────────────────────────────────────────────────────────────

// 同步睡眠 (Atomics.wait · 纯 JS 原生 · 锁 retry 用)
function _sleepMsSync(ms) {
  try {
    Atomics.wait(
      new Int32Array(new SharedArrayBuffer(4)),
      0,
      0,
      Math.max(1, ms | 0),
    );
  } catch {}
}

// L1 · 原子写 JSON: tmp → fsync → rename · 永不抛 · 返回 {ok, err, bytes}
//   rename 在 NTFS/Posix 都是原子替换, 写半程崩溃主文件保持旧态不损
function _atomicWriteJson(filePath, obj, opts) {
  opts = opts || {};
  const fsyncOn = opts.fsync !== false;
  const tmp = filePath + ".tmp-" + process.pid + "-" + Date.now().toString(36);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const json = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
    const fd = fs.openSync(tmp, "w");
    try {
      fs.writeSync(fd, json, 0, "utf8");
      if (fsyncOn) {
        try {
          fs.fsyncSync(fd);
        } catch {}
      }
    } finally {
      try {
        fs.closeSync(fd);
      } catch {}
    }
    fs.renameSync(tmp, filePath);
    return { ok: true, bytes: Buffer.byteLength(json, "utf8") };
  } catch (e) {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {}
    return { ok: false, err: e };
  }
}

// L3 辅助 · 安全读账号文件: JSON 合法 + Array + 统计有效数 · 永不抛
function _safeReadAccountsFile(p) {
  try {
    if (!p || !fs.existsSync(p))
      return { ok: false, err: "not-exist", count: 0 };
    const stat = fs.statSync(p);
    if (stat.size === 0)
      return { ok: false, err: "empty-file", count: 0, bytes: 0 };
    const raw = fs.readFileSync(p, "utf8");
    if (!raw || !raw.trim())
      return { ok: false, err: "empty-content", count: 0, bytes: stat.size };
    const data = JSON.parse(raw);
    if (!Array.isArray(data))
      return { ok: false, err: "not-array", count: 0, bytes: stat.size };
    const validCount = data.filter((a) => a && a.email && a.password).length;
    return {
      ok: true,
      data,
      count: data.length,
      validCount,
      bytes: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  } catch (e) {
    return {
      ok: false,
      err: String((e && e.message) || e).substring(0, 200),
      count: 0,
    };
  }
}

// L3 · 扫备份目录: 按 validCount 倒序 · 时间倒序 tie-break
function _scanAccountBackups(backupDir) {
  const out = [];
  try {
    if (!fs.existsSync(backupDir)) return out;
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => /^accounts.*\.json$/i.test(f));
    for (const f of files) {
      const full = path.join(backupDir, f);
      const probe = _safeReadAccountsFile(full);
      if (!probe.ok) continue;
      const m = f.match(/(\d{10,})/);
      let ts = m ? Number(m[1]) : 0;
      if (!ts) ts = probe.mtimeMs | 0;
      out.push({
        path: full,
        file: f,
        ts,
        count: probe.count,
        validCount: probe.validCount,
        bytes: probe.bytes,
      });
    }
    out.sort((a, b) => b.validCount - a.validCount || b.ts - a.ts);
  } catch {}
  return out;
}

// L3 · 灾难回退: 优先取 validCount 最多的最新备份
function _recoverFromBackupDir(backupDir) {
  const backups = _scanAccountBackups(backupDir);
  if (backups.length === 0) return null;
  const best = backups[0];
  if (best.validCount === 0) return null;
  const probe = _safeReadAccountsFile(best.path);
  if (!probe.ok) return null;
  return {
    data: probe.data,
    srcPath: best.path,
    srcFile: best.file,
    count: best.count,
    validCount: best.validCount,
    candidates: backups.length,
  };
}

// L4 · 文件锁 (best-effort): 排他 · 最多等 waitMs · 死锁自夺 (>60s 或 PID 不存在)
function _acquireStoreLock(lockPath, waitMs) {
  const myClaim = {
    pid: process.pid,
    ts: Date.now(),
    inst: typeof _instanceId !== "undefined" ? _instanceId : "",
  };
  const deadline = Date.now() + Math.max(0, waitMs | 0);
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        fs.writeSync(fd, JSON.stringify(myClaim), 0, "utf8");
        try {
          fs.fsyncSync(fd);
        } catch {}
      } finally {
        try {
          fs.closeSync(fd);
        } catch {}
      }
      return {
        ok: true,
        release: () => {
          try {
            fs.unlinkSync(lockPath);
          } catch {}
        },
      };
    } catch {
      // 锁被占 — 探死活
      let isDead = false;
      try {
        const raw = fs.readFileSync(lockPath, "utf8");
        const claim = JSON.parse(raw);
        const age = Date.now() - (claim.ts || 0);
        if (age > 60000) isDead = true;
        else if (claim.pid) {
          try {
            process.kill(claim.pid, 0);
          } catch {
            isDead = true;
          }
        }
      } catch {
        isDead = true; // 锁文件损坏 → 死
      }
      if (isDead) {
        try {
          fs.unlinkSync(lockPath);
        } catch {}
        continue;
      }
      if (Date.now() >= deadline) {
        return { ok: false, release: () => {}, reason: "busy" };
      }
      _sleepMsSync(40);
    }
  }
}

// L5 · 事件 journal: append-only · 7MB 滚动 · 永不丢历史
function _appendStoreJournal(journalPath, entry) {
  try {
    const line =
      JSON.stringify(Object.assign({ ts: Date.now() }, entry)) + "\n";
    try {
      if (
        fs.existsSync(journalPath) &&
        fs.statSync(journalPath).size > 7 * 1024 * 1024
      ) {
        const rolled = journalPath.replace(/\.jsonl$/, ".1.jsonl");
        try {
          fs.unlinkSync(rolled);
        } catch {}
        try {
          fs.renameSync(journalPath, rolled);
        } catch {}
      }
    } catch {}
    fs.appendFileSync(journalPath, line, "utf8");
  } catch {}
}

function _schedulePersist() {
  if (_persistTimer) return;
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    if (_snapshotDirty) _saveSnapshots();
    if (_inUseDirty && _store) _saveInUse(_store);
  }, 2000);
}

// ── 重置时间计算引擎 (锚定官方机制) ──
// 官方: Daily resets at 4:00 PM GMT+8 = 8:00 UTC every day
// 官方: Weekly resets at 4:00 PM GMT+8 on Sunday (诊断实证: API field 18 = Sunday 08:00 UTC)
function getNextDailyResetMs() {
  const now = new Date();
  const todayReset = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      _getDailyResetHourUtc(),
      0,
      0,
    ),
  );
  return todayReset.getTime() > now.getTime()
    ? todayReset.getTime()
    : todayReset.getTime() + 86400000;
}

function getNextWeeklyResetMs() {
  const now = new Date();
  let d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      _getDailyResetHourUtc(),
      0,
      0,
    ),
  );
  // 找到下一个Sunday 4PM UTC+8 (诊断实证: Windsurf weekly reset = Sunday)
  while (
    d.getUTCDay() !== _getWeeklyResetDay() ||
    d.getTime() <= now.getTime()
  ) {
    d = new Date(d.getTime() + 86400000);
  }
  return d.getTime();
}

function hoursUntilDailyReset() {
  return Math.max(0, (getNextDailyResetMs() - Date.now()) / 3600000);
}

function hoursUntilWeeklyReset() {
  return Math.max(0, (getNextWeeklyResetMs() - Date.now()) / 3600000);
}

// ── Weekly干旱检测 ──
// 当>=80%已验证账号Weekly<=阈值时，整个池子进入干旱模式
// 干旱模式下: 不因W0触发切号，只看Daily，避免无效切号死循环
function isWeeklyDrought() {
  const now = Date.now();
  if (now - _droughtCache.ts < _getDroughtCacheTtlMs())
    return _droughtCache.value;
  if (!_store) {
    _droughtCache = { value: false, ts: now };
    return false;
  }
  let checked = 0,
    wDry = 0;
  for (const a of _store.accounts) {
    if (!a.password) continue; // 干旱检测仅计有密码可登录的账号
    const h = _store.getHealth(a);
    if (!h.checked) continue;
    checked++;
    if (h.weekly <= _getAutoSwitchThreshold()) wDry++;
  }
  const result = checked > 0 && wDry / checked >= 0.8;
  _droughtCache = { value: result, ts: now };
  if (result)
    log(
      `🏜️ Weekly干旱: ${wDry}/${checked}号W耗尽(${Math.round((wDry / checked) * 100)}%), 周重置${hoursUntilWeeklyReset().toFixed(1)}h后`,
    );
  return result;
}

// ── Claude模型可用性判定 — 真正锚定底层 ──
// 道法自然: planEnd过期 ≠ 不可用! Windsurf有宽限期, 实际以D/W配额为准
// Free plan(D0/W0) → 唯一死刑 | 有配额(D>0或W>0) → 可用
// v17.42.4: 新增 teamsTier enum 快速路径 (19=DEVIN_FREE/6=WAITLIST_PRO 直接死刑)
//           + gracePeriod=3(EXPIRED) 官方过期状态直接死刑 (替代手算时间)
function isTrialPlan(plan, teamsTier) {
  // teamsTier 优先 (官方枚举最权威)
  const t = Number(teamsTier || 0);
  if (t > 0) {
    if (tierIsPaid(t)) return false; // PRO/ENTERPRISE/DEVIN_PRO/MAX 等
    if (tierIsTrial(t)) return true; // TRIAL / DEVIN_TRIAL
    if (tierIsFree(t)) return true; // DEVIN_FREE 归类试用性质(不是正规付费)
  }
  const p = (plan || "").toLowerCase();
  return !["pro", "enterprise", "team", "individual"].includes(p);
}

function isClaudeAvailable(health) {
  // ── v17.42.4 优先路径: 用 teamsTier 官方枚举 精确判定 ──
  const tier = Number(health.teamsTier || 0);
  if (tier > 0) {
    if (tierIsFree(tier)) return false; // DEVIN_FREE / WAITLIST_PRO → 死刑
    if (tierIsPaid(tier)) return true; // 付费层 → 全量可用
  }
  // Grace period 官方过期状态 → 死刑 (替代手算 planEnd>Date.now())
  if (health.gracePeriod === 3) return false; // EXPIRED

  const plan = (health.plan || "").toLowerCase();
  // v17.8 道法自然: 删除 plan==='devin' 假豁免 — Devin 账号走真实 plan (Trial/Pro/Free) 判断
  // v16根因修复: Free plan无论配额多少, Claude付费模型均不可用
  // 根因: free plan有D100月度配额(免费模型), 旧代码误以为D>0=Claude可用
  if (plan === "free") return false;
  // 付费计划: Claude始终可用
  if (["pro", "enterprise", "team", "individual"].includes(plan)) return true;
  // 有实际配额(D>0或W>0) → 可用(无论planEnd是否过期)
  if ((health.daily || 0) > 0 || (health.weekly || 0) > 0) return true;
  // 未检测账号: 不确定, 给予机会
  if (!health.checked) return true;
  // 兜底: 没有足够信息判定不可用时, 保留
  return true;
}

// 判断账号是否"有效可切" — Claude可用性 · 干旱感知 · 重置时间感知
// 反者道之动: D/W配额是表象, Claude可用性是本质
function isAccountSwitchable(health) {
  // Claude不可用(Free/试用过期) → 不可切
  if (!isClaudeAvailable(health)) return false;
  // v17.8 道法自然: 删除 plan==='devin' 假豁免 — Devin 账号与普通账号同轨走真实 D/W 判断
  //   Devin fallback 成功 (sessionToken 拿到真实 plan) → 按 D/W 自然评估
  //   Devin fallback 失败 → daily/weekly=0 → 不可切 (真实反映, 不再虚构永续)
  // weeklyUnknown时只用daily判断, 不因W未知而误拒
  const effectiveW = health.weeklyUnknown ? health.daily : health.weekly;
  const eff = Math.min(health.daily, effectiveW);
  if (eff > _getAutoSwitchThreshold()) return true;
  // Weekly干旱模式 或 weeklyUnknown: Daily充足即可用
  if (
    (isWeeklyDrought() || health.weeklyUnknown) &&
    health.daily > _getAutoSwitchThreshold()
  )
    return true;
  // Daily耗尽但即将重置 + Weekly充足 → 仍可用(等重置)
  if (
    health.daily <= _getAutoSwitchThreshold() &&
    effectiveW > _getAutoSwitchThreshold()
  ) {
    if (hoursUntilDailyReset() <= _getWaitResetHours()) return true;
  }
  // Daily耗尽但即将重置 + 干旱模式 → 等重置
  if (
    (isWeeklyDrought() || health.weeklyUnknown) &&
    health.daily <= _getAutoSwitchThreshold() &&
    hoursUntilDailyReset() <= _getWaitResetHours()
  )
    return true;
  return false;
}

// ── 模式管理 (WAM切号 / 官方登录) ──
function loadMode() {
  try {
    if (fs.existsSync(MODE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MODE_FILE, "utf8"));
      if (data.mode === "official" || data.mode === "wam") _mode = data.mode;
    }
  } catch {}
}

function saveMode(mode) {
  _mode = mode;
  try {
    fs.mkdirSync(WAM_DIR, { recursive: true });
    fs.writeFileSync(MODE_FILE, JSON.stringify({ mode, ts: Date.now() }));
  } catch {}
  log(`mode → ${mode}`);
}

function isWamMode() {
  return _mode === "wam";
}

// ── 官方模式: 彻底隔离第三方套层, 回归本源 ──
// 万法归宗 — 真正的零干扰隔离
//   1. windsurf.logout 登出WAM注入的会话
//   2. 停止所有引擎+心跳+文件监听
//   3. 清除activeIndex/instance claim
//   4. 清除内存+磁盘状态
//   5. 清除代理环境变量
async function cleanupThirdPartyState() {
  // 动态使用DATA_DIR而非硬编码产品名
  const cleanFiles = [
    ...(DATA_DIR
      ? [
          path.join(DATA_DIR, "_fp_salt.txt"),
          path.join(DATA_DIR, "_pool_apikey.txt"),
        ]
      : []),
    path.join(WAM_DIR, "oneshot_token.json"),
    path.join(WAM_DIR, "inject_result.json"),
  ];
  let cleaned = 0;
  for (const f of cleanFiles) {
    try {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
        cleaned++;
        log(`cleanup: deleted ${path.basename(f)}`);
      }
    } catch (e) {
      log(`cleanup: failed ${path.basename(f)}: ${e.message}`);
    }
  }
  // 登出WAM注入的会话 — 回归本源, 让用户用自己的账号
  try {
    log("cleanup: windsurf.logout — 登出WAM会话");
    await Promise.race([
      vscode.commands.executeCommand("windsurf.logout"),
      new Promise((r) => setTimeout(r, _getLogoutTimeoutMs())),
    ]);
    cleaned++;
    log("cleanup: logout OK");
  } catch (e) {
    log(`cleanup: logout skipped: ${e.message}`);
  }
  // 停止所有引擎
  _stopEngines();
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  // 停止心跳定时器
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
    log("cleanup: heartbeat stopped");
  }
  // 停止文件监听
  if (_watcher) {
    _watcher.close();
    _watcher = null;
    log("cleanup: watcher stopped");
  }
  // 清除activeIndex + instance claim
  if (_store) {
    _store.activeIndex = -1;
    log("cleanup: activeIndex cleared");
  }
  try {
    const claims = _readInstanceClaims();
    delete claims[_instanceId];
    fs.writeFileSync(
      INSTANCE_LOCK_FILE,
      JSON.stringify(claims, null, 2),
      "utf8",
    );
    log("cleanup: instance claim cleared");
  } catch {}
  // 清除active account marker
  try {
    const markerPath = path.join(WAM_DIR, "_active_account.txt");
    if (fs.existsSync(markerPath)) {
      fs.unlinkSync(markerPath);
      cleaned++;
    }
  } catch {}
  // 清除内存状态并落盘 (防止重启后恢复旧数据)
  _quotaSnapshots.clear();
  _tokenCache.clear();
  if (_store) _store._inUse.clear();
  try {
    _saveSnapshots();
  } catch {}
  try {
    if (_store) _saveInUse(_store);
  } catch {}
  _burstUntil = 0;
  _consecutiveChanges = 0;
  _predictiveCandidate = -1;
  _prewarmedToken = null; // v8: 清除预热Token
  // 清除旧版本可能设置的代理环境变量污染 — 唯变所适
  // 不再硬编码单一地址, 而是检测所有WAM可能设过的localhost代理值
  for (const envKey of ["HTTP_PROXY", "HTTPS_PROXY"]) {
    const val = process.env[envKey];
    if (val && /^https?:\/\/127\.0\.0\.1:\d+\/?$/.test(val)) {
      delete process.env[envKey];
      cleaned++;
      log(`cleanup: removed ${envKey}=${val}`);
    }
  }
  log(
    `cleanup: ${cleaned} items cleaned, engines+heartbeat+watcher stopped, session logged out — 回归本源`,
  );
  return cleaned;
}

// 回切WAM时重启所有后台服务 (watcher + heartbeat)
function _restartBackgroundServices() {
  if (!_watcher) startFileWatcher();
  if (!_heartbeatTimer) {
    _heartbeatTimer = setInterval(() => {
      if (!isWamMode()) return;
      const activeAcc =
        _store && _store.activeIndex >= 0
          ? _store.get(_store.activeIndex)
          : null;
      _writeInstanceClaim(activeAcc?.email || "");
      _cleanDeadInstances();
    }, _getInstanceHeartbeatMs());
  }
  // v17.37 道法自然: 引擎随服务同生 — monitor/scan/tokenPool/autoUpdate/autoVerify/autoExpiry
  // _ensureEngines 幂等 (已启动则跳过) · 官方→WAM 切换时确保引擎全部就位 · 不再依赖下游各处单独调用
  _ensureEngines();
  log("services restarted: watcher + heartbeat + engines");
}

// ============================================================
// AccountStore — 账号池CRUD + 使用中标记 + 批量操作
// ============================================================
class AccountStore {
  constructor(globalStoragePath) {
    this._dir = globalStoragePath;
    // 动态文件名: 基于产品名, 兼容windsurf旧文件
    const accountFile = `${PRODUCT_NAME.toLowerCase()}-login-accounts.json`;
    this._path = path.join(globalStoragePath, accountFile);
    // 共享路径: 让pool_engine等外部工具也能读到
    this._sharedPath = path.join(globalStoragePath, "..", accountFile);
    // 兼容旧文件名 (windsurf-login-accounts.json)
    this._legacyPath =
      PRODUCT_NAME.toLowerCase() !== "windsurf"
        ? path.join(globalStoragePath, "windsurf-login-accounts.json")
        : null;
    this.accounts = [];
    this.switchCount = 0;
    this.activeIndex = -1;
    this.lastRefresh = 0;
    this._inUse = new Map(); // email -> {since, lastChange} 消息锚定: 单次波动即标记, 冷却后清除
    this.load();
  }

  load() {
    const candidates = [
      this._path,
      path.join(
        this._dir,
        "..",
        `${PRODUCT_NAME.toLowerCase()}-login-accounts.json`,
      ),
      // 兼容旧文件名
      ...(this._legacyPath
        ? [
            this._legacyPath,
            path.join(this._dir, "..", "windsurf-login-accounts.json"),
          ]
        : []),
    ];
    // 黑名单: 读取归档池中的死号,防止从其他路径被重新合并
    const blacklist = new Set();
    try {
      const archPath = path.join(path.dirname(this._path), "_wam_purged.json");
      if (fs.existsSync(archPath)) {
        const arch = JSON.parse(fs.readFileSync(archPath, "utf8"));
        if (Array.isArray(arch))
          arch.forEach((a) => {
            if (a.email) blacklist.add(a.email.toLowerCase());
          });
      }
    } catch {}
    const seen = new Set();
    const merged = [];
    let sources = 0,
      blocked = 0;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const data = JSON.parse(fs.readFileSync(p, "utf8"));
          if (Array.isArray(data)) {
            let added = 0;
            for (const a of data) {
              // 清洗: 去掉email末尾分隔符残留 (修复----解析bug遗留)
              if (a.email) a.email = a.email.replace(/[-=|:,\s]+$/, "").trim();
              const e = (a.email || "").toLowerCase();
              if (!a.password) continue; // 道法自然: 无密码不入池，根除phantom D50/W50幻影号
              if (blacklist.has(e)) {
                blocked++;
                continue;
              } // 黑名单: 已归档死号不再入池
              if (a.usage && a.usage.mode) delete a.usage.mode; // 清除旧系统mode=quota残留
              // Claude可用性门控: cached plan=free → 不入池 (反者道之动: D100/W100是假象)
              const cachedPlan = (
                (a.usage && a.usage.plan) ||
                ""
              ).toLowerCase();
              if (cachedPlan === "free") {
                blocked++;
                continue;
              }
              // 试用过期门控: 仅当D=0且W=0时才阻止(planEnd过期但有配额仍可用)
              const cachedPlanEnd = (a.usage && a.usage.planEnd) || 0;
              // 兼容两种格式 — number(82) 或 object({remaining:82})
              const _rd = (f) =>
                f == null
                  ? -1
                  : typeof f === "number"
                    ? f
                    : f && f.remaining != null
                      ? f.remaining
                      : -1;
              const cachedD = a.usage ? _rd(a.usage.daily) : -1;
              const cachedW = a.usage ? _rd(a.usage.weekly) : -1;
              if (
                cachedPlanEnd > 0 &&
                Date.now() > cachedPlanEnd &&
                isTrialPlan(cachedPlan) &&
                cachedD === 0 &&
                cachedW === 0
              ) {
                blocked++;
                continue;
              }
              // 格式迁移 — 统一 usage.daily/weekly 为 {remaining: N} 对象格式
              if (a.usage && typeof a.usage.daily === "number") {
                a.usage.daily = { remaining: a.usage.daily };
                a._migrated = true;
              }
              if (a.usage && typeof a.usage.weekly === "number") {
                a.usage.weekly = { remaining: a.usage.weekly };
                a._migrated = true;
              }
              if (e && !seen.has(e)) {
                seen.add(e);
                merged.push(a);
                added++;
              }
            }
            if (added > 0) sources++;
          }
        }
      } catch {}
    }
    this.accounts = merged.filter((a) => a && a.email);
    log(
      `store: loaded ${this.accounts.length} accounts (${this.pwCount()} with pw) from ${sources} sources${blocked > 0 ? ` (${blocked} blacklisted)` : ""}`,
    );

    // v17.42.15 L3 · 灾难回退 (致虚极, 守静笃 · 归根曰静)
    //   常规路径加载 0 条 + 备份目录有有效账号 → 自动恢复
    //   根因修复: 主+shared+legacy 全损/空 时, 旧版直接返回空 → 账号永久丢失
    //   现在: 扫 _wam_backups 找最优备份, 过滤黑名单后恢复
    if (this.accounts.length === 0) {
      const backupDir = path.join(path.dirname(this._path), "_wam_backups");
      const recovery = _recoverFromBackupDir(backupDir);
      if (recovery) {
        log(
          `store: ⚠️ L3 灾难回退! 主/shared/legacy 全空 → 从备份恢复 (src=${recovery.srcFile}, ${recovery.validCount}/${recovery.count})`,
        );
        const recoveredMerged = [];
        for (const a of recovery.data) {
          if (a.email) a.email = a.email.replace(/[-=|:,\s]+$/, "").trim();
          const e = (a.email || "").toLowerCase();
          if (!a.password) continue;
          if (blacklist.has(e)) continue;
          const cachedPlan = ((a.usage && a.usage.plan) || "").toLowerCase();
          if (cachedPlan === "free") continue;
          if (e && !seen.has(e)) {
            seen.add(e);
            recoveredMerged.push(a);
          }
        }
        if (recoveredMerged.length > 0) {
          this.accounts = recoveredMerged;
          log(
            `store: L3 恢复 ${this.accounts.length} 账号 (${this.pwCount()} with pw) from ${recovery.srcFile}`,
          );
          try {
            _appendStoreJournal(
              path.join(path.dirname(this._path), "_wam_journal.jsonl"),
              {
                op: "load_disaster_recovery",
                inst: _instanceId,
                recovered: this.accounts.length,
                src: recovery.srcFile,
                candidates: recovery.candidates,
              },
            );
          } catch {}
          // 恢复后立即保存到主文件 (确保下次启动也能读到)
          this.save();
        }
      }
    }

    // L5 journal · 记录每次启动 load 结果 (便于灾后追溯)
    try {
      _appendStoreJournal(
        path.join(path.dirname(this._path), "_wam_journal.jsonl"),
        {
          op: "load",
          inst: _instanceId,
          total: this.accounts.length,
          valid: this.pwCount(),
          sources,
          blocked,
        },
      );
    } catch {}

    // 格式迁移后立即持久化，避免file watcher反复读旧格式
    if (this.accounts.some((a) => a.usage && a._migrated)) {
      this.accounts.forEach((a) => {
        if (a._migrated) delete a._migrated;
      });
      this.save();
      log("store: format migration persisted");
    }
    // v17.8 道法自然 · 返本归真: 清理 v17.7 历史假数据 (磁盘污染自愈)
    //   识别特征: _authSystem='devin' 且 usage.plan='Devin' (大写 D · v17.7 软编码指纹)
    //   Codeium 真实 API 返回的是 Trial/Pro/Free 等小写, 不会出现大写 'Devin'
    //   清理后: 还原未验自然态, 真实数据由 fetchAccountQuota (内建 Firebase→Devin fallback) 按需补齐
    let _cleaned = 0;
    for (const a of this.accounts) {
      if (
        a &&
        a._authSystem === "devin" &&
        a.usage &&
        a.usage.plan === "Devin" // v17.7 软编码特征: 首字母大写 "Devin"
      ) {
        // 清除假数据 · 保留 _authSystem + _devinVerified + _lastVerified 等身份字段
        delete a.usage.daily;
        delete a.usage.weekly;
        delete a.usage.plan;
        delete a.usage.planEnd;
        delete a.usage.resetTime;
        delete a.usage.weeklyReset;
        delete a.usage.lastChecked;
        if (Object.keys(a.usage).length === 0) delete a.usage;
        _cleaned++;
      }
    }
    if (_cleaned > 0) {
      this.save();
      log(
        `store: v17.8 道法自然 — 清理 ${_cleaned} 个 Devin 账号 v17.7 假 plan="Devin" 数据`,
      );
    }
  }

  // v17.42.15 载营魄抱一 · 存储本源五重机制
  //   保存流程:
  //     ① _mergeFromDisk 合并磁盘 (旧)
  //     ② NULL-WIPE 护本: 内存=0 但磁盘有未归档账号 → 拒绝写入 (抗误空 · 根因修复)
  //     ③ _autoBackup 内容感知备份旧主文件
  //     ④ L4 best-effort 文件锁
  //     ⑤ L1 原子写 主 + shared (tmp → fsync → rename)
  //     ⑥ L5 journal 事件追加
  //     ⑦ 双路全失才告警 (v17.3 留存)
  save() {
    // ① 合并磁盘 — 保留pipeline注入的apiKey和新增账号
    this._mergeFromDisk();

    // ② NULL-WIPE GUARD (根因修复 · 抗意外空写)
    //   反者道之动: 内存突然归零 + 磁盘有未归档账号 → 绝不写入
    //   触发场景: 崩溃恢复/初始化竞态/bug 导致 accounts=[]
    //   不触发: 用户主动 remove 最后账号 (已在 _wam_purged 黑名单 · 非"未归档")
    if (this.accounts.length === 0) {
      const diskProbe = _safeReadAccountsFile(this._path);
      if (diskProbe.ok && diskProbe.validCount > 0) {
        const blacklist = new Set();
        try {
          const archPath = path.join(
            path.dirname(this._path),
            "_wam_purged.json",
          );
          if (fs.existsSync(archPath)) {
            const arch = JSON.parse(fs.readFileSync(archPath, "utf8"));
            if (Array.isArray(arch))
              arch.forEach((a) => {
                if (a && a.email) blacklist.add(a.email.toLowerCase());
              });
          }
        } catch {}
        const nonArchived = diskProbe.data.filter(
          (a) =>
            a &&
            a.email &&
            a.password &&
            !blacklist.has((a.email || "").toLowerCase()),
        );
        if (nonArchived.length > 0) {
          log(
            `store save GUARD: mem=0 disk=${nonArchived.length}非归档 → 拒绝写入 (抗 null-wipe · 护本)`,
          );
          try {
            _appendStoreJournal(
              path.join(path.dirname(this._path), "_wam_journal.jsonl"),
              {
                op: "save_guard_refused",
                inst: _instanceId,
                memCount: 0,
                diskValid: diskProbe.validCount,
                nonArchived: nonArchived.length,
              },
            );
          } catch {}
          return;
        }
      }
    }

    const json = JSON.stringify(this.accounts, null, 2);
    // ③ 自动备份 (内容感知 · 坏件不挤好备)
    this._autoBackup();

    // ④ L4 文件锁 (best-effort · 2s 超时继续 · 原子 rename 已保不损)
    const lockPath = path.join(path.dirname(this._path), "_wam_store.lock");
    const _lock = _acquireStoreLock(lockPath, 2000);
    if (!_lock.ok) {
      log(`store save: lock busy (${_lock.reason}) · 原子写继续 (rename 护本)`);
    }

    // ⑤ L1 原子写 · 主 + shared
    let primaryErr = null,
      sharedErr = null;
    const r1 = _atomicWriteJson(this._path, json, {
      fsync: this._getFsyncEnabled(),
    });
    if (!r1.ok) {
      primaryErr = r1.err;
      log(
        `store save error [primary=${this._path}]: ${primaryErr.code || ""} ${primaryErr.message}`,
      );
    }
    if (this._sharedPath) {
      const r2 = _atomicWriteJson(this._sharedPath, json, {
        fsync: this._getFsyncEnabled(),
      });
      if (!r2.ok) {
        sharedErr = r2.err;
        log(
          `store save error [shared=${this._sharedPath}]: ${sharedErr.code || ""} ${sharedErr.message}`,
        );
      }
    }

    _lock.release();

    // ⑥ L5 journal
    try {
      _appendStoreJournal(
        path.join(path.dirname(this._path), "_wam_journal.jsonl"),
        {
          op: "save",
          inst: _instanceId,
          total: this.accounts.length,
          valid: this.accounts.filter((a) => a && a.email && a.password).length,
          primaryOk: !primaryErr,
          sharedOk: !sharedErr,
          bytes: json.length,
        },
      );
    } catch {}

    // ⑦ 双通道同时失败才告警 (避免噪音), 且每 5 分钟最多 1 次
    if (primaryErr && sharedErr) {
      const now = Date.now();
      if (
        !this._lastSaveErrNotify ||
        now - this._lastSaveErrNotify > 5 * 60 * 1000
      ) {
        this._lastSaveErrNotify = now;
        vscode.window
          .showErrorMessage(
            `WAM 写盘失败! primary=${primaryErr.code || primaryErr.message}, shared=${sharedErr.code || sharedErr.message}. 内存池将在重启后丢失.`,
            "查看日志",
            "打开目录",
            "健康诊断",
          )
          .then((choice) => {
            if (choice === "查看日志") {
              vscode.workspace
                .openTextDocument(vscode.Uri.file(LOG_FILE))
                .then((doc) => vscode.window.showTextDocument(doc))
                .then(undefined, () => {});
            } else if (choice === "打开目录") {
              vscode.env.openExternal(
                vscode.Uri.file(path.dirname(this._path)),
              );
            } else if (choice === "健康诊断") {
              vscode.commands.executeCommand("wam.healthCheck");
            }
          });
      }
    }
  }

  // v17.42.15 · 分层备份保留上限 (软编码 · 可通过 wam.storage.maxBackups 配置)
  _getMaxBackups() {
    try {
      const v = vscode.workspace
        .getConfiguration("wam")
        .get("storage.maxBackups", 10);
      return typeof v === "number" && v >= 3 ? Math.min(v, 100) : 10;
    } catch {
      return 10;
    }
  }

  // v17.42.15 · fsync 开关 (默认开 · 性能场景可关)
  _getFsyncEnabled() {
    try {
      const v = vscode.workspace
        .getConfiguration("wam")
        .get("storage.fsync", true);
      return v !== false;
    } catch {
      return true;
    }
  }

  _mergeFromDisk() {
    // 读取磁盘上的共享池文件, 合并pipeline注入的apiKey和新增账号
    const candidates = [this._sharedPath, this._path].filter(Boolean);
    // 道法自然: 归档黑名单 — 防止purged账号从共享文件回流 (根因修复)
    const purgedBlacklist = new Set();
    try {
      const archPath = path.join(path.dirname(this._path), "_wam_purged.json");
      if (fs.existsSync(archPath)) {
        const arch = JSON.parse(fs.readFileSync(archPath, "utf8"));
        if (Array.isArray(arch))
          arch.forEach((a) => {
            if (a.email) purgedBlacklist.add(a.email.toLowerCase());
          });
      }
    } catch {}
    const memMap = new Map();
    for (const a of this.accounts) {
      if (a.email) memMap.set(a.email.toLowerCase(), a);
    }
    let merged = 0,
      added = 0;
    for (const p of candidates) {
      try {
        if (!fs.existsSync(p)) continue;
        const disk = JSON.parse(fs.readFileSync(p, "utf8"));
        if (!Array.isArray(disk)) continue;
        for (const da of disk) {
          const e = (da.email || "").toLowerCase();
          if (!e || !da.password) continue;
          if (purgedBlacklist.has(e)) continue; // 黑名单: 不回流已归档死号
          // Free plan门控: 缓存plan=free → 不回流 (与load()一致)
          if (((da.usage && da.usage.plan) || "").toLowerCase() === "free")
            continue;
          const mem = memMap.get(e);
          if (mem) {
            // 合并apiKey: 磁盘有而内存无 → 补充
            if (da.apiKey && !mem.apiKey) {
              mem.apiKey = da.apiKey;
              merged++;
            }
            // 合并password: 磁盘有而内存无 → 补充
            if (da.password && !mem.password) {
              mem.password = da.password;
              merged++;
            }
          } else {
            // 磁盘有而内存无 → 新增
            this.accounts.push(da);
            memMap.set(e, da);
            added++;
          }
        }
      } catch {}
    }
    if (merged > 0 || added > 0) {
      log(`store: disk merge +${added} new, ${merged} fields synced`);
    }
  }

  // v17.42.15 载营魄抱一 · L2 内容感知备份 + 分层保留
  //   坏件不挤好备 · 近 maxN + 每日最新 1 · 善抱者不脱
  _autoBackup() {
    try {
      if (!fs.existsSync(this._path)) return;
      const backupDir = path.join(path.dirname(this._path), "_wam_backups");
      fs.mkdirSync(backupDir, { recursive: true });

      // L2 · 内容感知: 主文件必须合法 + 有效才备份 (坏件不入)
      const probe = _safeReadAccountsFile(this._path);
      if (!probe.ok) {
        log(`backup skip: 主文件无效 (${probe.err}), 不覆盖既有好备份`);
        return;
      }
      // 零有效账号 + 既有备份有账号 → 跳过 (抗空文件挤走好备份)
      if (probe.validCount === 0) {
        const existing = _scanAccountBackups(backupDir);
        if (existing.length > 0 && existing[0].validCount > 0) {
          log(
            `backup skip: 主文件 valid=0, 既有备份 valid=${existing[0].validCount}, 不覆盖`,
          );
          return;
        }
      }

      const ts = Date.now();
      // 用原子写备份 (非 copyFileSync · 避免主文件写半程时拷到一半)
      const r = _atomicWriteJson(
        path.join(backupDir, `accounts_${ts}.json`),
        probe.data,
        { fsync: this._getFsyncEnabled() },
      );
      if (!r.ok) {
        log(`backup error: ${(r.err && r.err.message) || r.err}`);
        return;
      }

      // 分层保留: 近 maxN 个 + 每日最新 1 个 (至少保 7 天)
      const maxN = this._getMaxBackups();
      const all = _scanAccountBackups(backupDir);
      const keep = new Set();
      // 近 maxN 个 (按 validCount 倒序已排好)
      for (let i = 0; i < Math.min(maxN, all.length); i++)
        keep.add(all[i].path);
      // 每日最新 1 个 (按 YYYY-MM-DD 分组)
      const daily = new Map();
      for (const b of all) {
        const d = new Date(b.ts).toISOString().slice(0, 10);
        if (!daily.has(d) || daily.get(d).ts < b.ts) daily.set(d, b);
      }
      for (const b of daily.values()) keep.add(b.path);
      // 删除不在 keep 里的
      let pruned = 0;
      for (const b of all) {
        if (!keep.has(b.path)) {
          try {
            fs.unlinkSync(b.path);
            pruned++;
          } catch {}
        }
      }
      if (pruned > 0)
        log(`backup: pruned ${pruned} old backups (kept ${keep.size})`);
    } catch (e) {
      log(`backup error: ${e.message}`);
    }
  }

  get(i) {
    return this.accounts[i] || null;
  }
  count() {
    return this.accounts.length;
  }
  pwCount() {
    return this.accounts.filter((a) => a.password).length;
  }

  add(email, password) {
    // v17.4 根因修复: 单路(parseBatch) + 双路(API/命令直呼) 都经过 add,
    // 在这里再净化一次做防御 (反者道之动·不信调用方). 同时记录伪装指纹.
    const rawEmailHex = _hexFingerprint(email);
    const rawPwHex = _hexFingerprint(password);
    email = _sanitizeCredential(email);
    password = _sanitizeCredential(password);
    const cleanPwHex = _hexFingerprint(password);
    if (rawPwHex !== cleanPwHex) {
      log(
        `sanitize: ${email} — 密码伪装字符命中! raw[${rawPwHex}] → clean[${cleanPwHex}]`,
      );
    }
    // 清洗: 去掉email末尾分隔符残留, 去掉password首尾空格
    email = email.replace(/[-=|:,\s]+$/, "").trim();
    password = (password || "").trim();
    if (!email || !email.includes("@") || !password) return false;
    void rawEmailHex; // reserved for future forensic (避免 lint warning)
    if (
      this.accounts.some(
        (a) => (a.email || "").toLowerCase() === email.toLowerCase(),
      )
    )
      return false;
    this.accounts.push({
      email,
      password,
      loginCount: 0,
      addedAt: Date.now(),
      usage: null,
      _unverified: true, // Claude可用性未验证标记
    });
    this.save();
    // 异步验证Claude可用性 — 不阻塞add()返回，后台验证后自动清理
    this._asyncVerifyAccount(email, password);
    return true;
  }

  // 异步验证新入池账号的Claude可用性 (反者道之动: 不信表象, 只信API)
  async _asyncVerifyAccount(email, password) {
    try {
      log(`verify-gate: ${email} — 异步验证Claude可用性...`);
      const quota = await fetchAccountQuota(email, password);
      const idx = this.accounts.findIndex(
        (a) => (a.email || "").toLowerCase() === email.toLowerCase(),
      );
      if (idx < 0) return; // 已被其他流程移除
      if (quota.ok) {
        const plan = (quota.planName || "").toLowerCase();
        const planEnd = quota.planEndUnix ? quota.planEndUnix * 1000 : 0;
        const isExpired = planEnd > 0 && Date.now() > planEnd;
        // v17.42.4: teamsTier + gracePeriod 三位一体精确判定 (替代手算时间)
        const tier = Number(quota.teamsTier || 0);
        const isFreeTier = tier > 0 && tierIsFree(tier); // DEVIN_FREE/WAITLIST_PRO
        const isPaidTier = tier > 0 && tierIsPaid(tier); // PRO/ENTERPRISE/等
        const isGraceExpired = quota.gracePeriod === 3; // 官方 EXPIRED
        // 拒绝条件:
        //   1. Free tier 官方标记 (tier=19/6) → 死刑
        //   2. Free plan 字符串 (legacy API 兼容)
        //   3. 试用计划 + grace period 官方过期 (gracePeriod=3)
        //   4. 试用计划 + planEnd 过期 (legacy 兜底, 无 gracePeriod 信号时用)
        const rejectFreeTier = isFreeTier;
        const rejectFreePlan = plan === "free";
        const rejectGraceExpired =
          isGraceExpired && (isTrialPlan(plan, tier) || isFreeTier);
        const rejectLegacyExpired =
          !quota.gracePeriod && // 仅当无 gracePeriod 信号时启用兜底
          isExpired &&
          isTrialPlan(plan, tier);
        if (
          rejectFreeTier ||
          rejectFreePlan ||
          rejectGraceExpired ||
          rejectLegacyExpired
        ) {
          let reason;
          if (rejectFreeTier)
            reason = `verify_gate_free_tier: tier=${quota.teamsTierName}(${tier}) · Claude付费模型不可用`;
          else if (rejectFreePlan)
            reason = `verify_gate_free: plan=free, D${quota.daily}W${quota.weekly}仅限免费模型, Claude不可用`;
          else if (rejectGraceExpired)
            reason = `verify_gate_grace_expired: plan=${plan}(${quota.teamsTierName || tier}), gracePeriod=EXPIRED, D${quota.daily}W${quota.weekly}, Claude不可用`;
          else
            reason = `verify_gate_expired: plan=${plan}过期, D${quota.daily}W${quota.weekly}, Claude不可用`;
          log(`verify-gate: ${email} → 拒绝 (${reason})`);
          this._archiveRemoved([this.accounts[idx]], reason);
          this.accounts.splice(idx, 1);
          if (this.activeIndex === idx) this.activeIndex = -1;
          else if (this.activeIndex > idx) this.activeIndex--;
          this.save();
          _notifyWarn(
            `WAM: 已拒绝 ${email} — ${
              rejectFreeTier
                ? "Free层无Claude"
                : rejectFreePlan
                  ? "Free计划无Claude"
                  : rejectGraceExpired
                    ? "试用宽限期已结束"
                    : "试用已过期"
            }`,
            "fatal",
          );
          refreshAll();
          return;
        }
        // 验证通过 → 清除未验证标记
        delete this.accounts[idx]._unverified;
        this.accounts[idx]._verifiedPlan = plan;
        if (tier) this.accounts[idx]._verifiedTier = tier;
        this.save();
        const tierTag = quota.teamsTierName
          ? ` tier=${quota.teamsTierName}`
          : "";
        const paidTag = isPaidTier ? " ✓paid" : "";
        const graceTag =
          quota.gracePeriod > 1 ? ` grace=${quota.gracePeriodName}` : "";
        log(
          `verify-gate: ${email} → 通过 (plan=${plan}${tierTag}${paidTag}${graceTag}, D${quota.daily}W${quota.weekly})`,
        );
      } else {
        // v17.4 取证: 失败时印密码 hex 指纹 (便于排查是否仍有伪装字符漏网)
        // 只印前后 12 字节, 不泄露完整密码. 只要 hex 与用户贴入时一致 → Firebase 端真的密码错
        const pwFp = _hexFingerprint(password);
        log(
          `verify-gate: ${email} → 探测失败: ${quota.error} (pwFp=${pwFp} len=${password.length}B, 保留等待下次purge)`,
        );
        // v17.3 道法自然: 登录失败不再立即归档死号, 仅标记+告警
        // 反者道之动: Firebase INVALID_LOGIN 可能源于网络抖动·密码暂不同步·Key限流
        //   之前"秒归档+黑名单"让无辜账号永久殉葬, 违反"无为而无不为"
        //   改为: 标记 _verifyFailed, 用户可自主重试; 真死号留给 purge 批量二次确认
        if (/INVALID|NOT_FOUND|DISABLED|WRONG/.test(quota.error || "")) {
          // v17.5 道法自然: Firebase INVALID → 探测是否 Devin-only 账号
          // 成功 → 标记 _authSystem='devin', 重置失败计数, 保护账号不被归档/拉黑
          const devinCheck = await _devinLogin(email, password);
          if (devinCheck.ok) {
            log(
              `verify-gate: ${email} → Firebase INVALID 但 Devin 登录成功 (auth1=${(devinCheck.auth1Token || "").slice(0, 20)}..., uid=${devinCheck.userId}) — 标记 Devin-only 账号, 保护不归档`,
            );
            this.accounts[idx]._authSystem = "devin";
            this.accounts[idx]._devinUserId = devinCheck.userId;
            this.accounts[idx]._devinDetectedAt = Date.now();
            // v17.5 补完+: 打验证标记, 供 getHealth/getBestIndex/UI 识别
            this.accounts[idx]._devinVerified = true;
            this.accounts[idx]._lastVerified = Date.now();
            delete this.accounts[idx]._verifyFailed;
            delete this.accounts[idx]._verifyFailedAt;
            this.accounts[idx]._verifyFailedCount = 0;
            delete this.accounts[idx]._unverified;
            this.save();
            // v17.8 道法自然: 触发 fetchAccountQuota — Devin fallback 自动拿真实 plan
            //   fire-and-forget · cooldown 防重复 · 与 scan/purge 共享路径
            fetchAccountQuota(email, password)
              .then((q) => {
                if (q.ok) {
                  try {
                    this.save();
                    refreshAll();
                  } catch {}
                }
              })
              .catch(() => {});
            _notifyInfo(
              `WAM: ${email} 识别为 Devin-only 账号 — 已保护 (真实 Plan 后台获取中)`,
              "auto",
            );
            refreshAll();
            return;
          }
          log(
            `verify-gate: ${email} → 登录失败(${quota.error}), 标记 _verifyFailed 保留池中可重试`,
          );
          this.accounts[idx]._verifyFailed = quota.error;
          this.accounts[idx]._verifyFailedAt = Date.now();
          this.accounts[idx]._verifyFailedCount =
            (this.accounts[idx]._verifyFailedCount || 0) + 1;
          // 连续 3 次失败才归档 (给 3 次机会: 网络抖动/代理切换/Firebase 恢复)
          if (this.accounts[idx]._verifyFailedCount >= 3) {
            log(
              `verify-gate: ${email} → 连续${this.accounts[idx]._verifyFailedCount}次失败, 归档`,
            );
            this._archiveRemoved(
              [this.accounts[idx]],
              `verify_gate_dead_after_retries: ${quota.error}`,
            );
            this.accounts.splice(idx, 1);
            if (this.activeIndex === idx) this.activeIndex = -1;
            else if (this.activeIndex > idx) this.activeIndex--;
            _notifyWarn(
              `WAM: 已拒绝 ${email} — 登录失败3次(${quota.error})`,
              "fatal",
            );
          } else {
            _notifyWarn(
              `WAM: ${email} 验证失败 ${this.accounts[idx]._verifyFailedCount}/3 (${quota.error}) — 保留池中可重试`,
              "auto",
            );
          }
          this.save();
          refreshAll();
        }
      }
    } catch (e) {
      log(`verify-gate: ${email} error: ${e.message}`);
    }
  }

  remove(index) {
    if (index < 0 || index >= this.accounts.length) return false;
    const removed = this.accounts[index];
    this._archiveRemoved([removed], "manual_remove");
    this.accounts.splice(index, 1);
    if (this.activeIndex === index) this.activeIndex = -1;
    else if (this.activeIndex > index) this.activeIndex--;
    this.save();
    return true;
  }

  removeBatch(indices) {
    const sorted = [...indices].sort((a, b) => b - a);
    const removed = [];
    let count = 0;
    for (const i of sorted) {
      if (i >= 0 && i < this.accounts.length) {
        removed.push(this.accounts[i]);
        this.accounts.splice(i, 1);
        if (this.activeIndex === i) this.activeIndex = -1;
        else if (this.activeIndex > i) this.activeIndex--;
        count++;
      }
    }
    if (count > 0) {
      this._archiveRemoved(removed, "batch_remove");
      this.save();
    }
    return count;
  }

  // 归档被删除的账号 (追加写入，永不丢失)
  _archiveRemoved(accounts, reason) {
    try {
      const archivePath = path.join(
        path.dirname(this._path),
        "_wam_purged.json",
      );
      let existing = [];
      try {
        existing = JSON.parse(fs.readFileSync(archivePath, "utf8"));
      } catch {}
      if (!Array.isArray(existing)) existing = [];
      for (const acc of accounts) {
        existing.push({ ...acc, _purgeReason: reason, _purgedAt: Date.now() });
      }
      fs.writeFileSync(archivePath, JSON.stringify(existing, null, 2), "utf8");
    } catch (e) {
      log(`archive error: ${e.message}`);
    }
  }

  // 智能解析: 支持任意格式 email:password / email password / email\tpassword
  // 也支持 "email----password" / "email|password" / CSV格式等
  addBatch(text) {
    const lines = text
      .split(/[\n\r;]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    let added = 0,
      skipped = 0,
      duplicate = 0;
    for (const line of lines) {
      const parsed = this._parseLine(line);
      if (parsed) {
        const result = this.add(parsed.email, parsed.password);
        if (result) added++;
        else duplicate++;
      } else {
        skipped++;
        log(`parse skip: ${line.substring(0, 60)}`);
      }
    }
    return { added, skipped, duplicate, total: lines.length };
  }

  _parseLine(line) {
    // 入口先净化: NFKC 全角→半角 + 剔零宽. 聊天软件/IME 污染到此为止.
    line = _sanitizeCredential(line);
    line = line
      .replace(/^\uFEFF/, "")
      .replace(/^["']+|["']+$/g, "")
      .trim();
    if (!line || !line.includes("@")) return null;

    // 辅助: 是否像合法email (含@, @后有.tld, 无多余分隔符)
    const _ok = (s) => {
      const a = s.indexOf("@");
      return a > 0 && s.indexOf(".", a) > a && !/[\s:,|]/.test(s);
    };

    // ── P1: 破折号分隔 (2+连续破折号, indexOf+split最可靠) ──
    // 从最长的匹配开始尝试, 同时尝试首次和末次出现位置
    for (const sep of ["----", "---", "--"]) {
      for (const idx of [line.indexOf(sep), line.lastIndexOf(sep)]) {
        if (idx <= 0) continue;
        const L = line.substring(0, idx).trim();
        const R = line.substring(idx).replace(/^-+/, "").trim();
        if (_ok(L) && R) return { email: L, password: R };
        if (_ok(R) && L) return { email: R, password: L };
      }
    }

    // ── P2: 冒号/管道/逗号/等号分隔 (最常见: email:password) ──
    let m = line.match(/^([^\s:,|=]+@[^\s:,|=]+)[:\s,|=]+(.+)$/);
    if (m) return { email: m[1].trim(), password: m[2].trim() };

    // ── P3: 反向 password:email ──
    m = line.match(/^([^\s@:,|=]+)[:\s,|=]+([^\s:,|=]+@[^\s:,|=]+)$/);
    if (m) return { email: m[2].trim(), password: m[1].trim() };

    // ── P4: Tab分隔 ──
    const tabs = line.split("\t");
    if (tabs.length >= 2) {
      const eI = tabs.findIndex((t) => t.includes("@"));
      if (eI >= 0)
        return {
          email: tabs[eI].trim(),
          password: tabs[eI === 0 ? 1 : 0].trim(),
        };
    }

    // ── P5: 空格分隔 ──
    const sp = line.indexOf(" ");
    if (sp > 0) {
      const L = line.substring(0, sp).trim();
      const R = line.substring(sp + 1).trim();
      if (L.includes("@") && R) return { email: L, password: R };
      if (R.includes("@") && L) return { email: R, password: L };
    }

    // ── P6: 纯邮箱 (无密码) → 拒绝入池，无密码不可切号 ──

    return null;
  }

  getHealth(acc) {
    const u = acc.usage || {};
    const snap = _quotaSnapshots.get((acc.email || "").toLowerCase());
    // v17.5 补完: Devin 账号经 _devinFullSwitch 验证后视为已验证
    const _devinChecked =
      acc._authSystem === "devin" &&
      (acc._devinVerified || acc._lastVerified > 0);
    const checked =
      !!(
        acc.usage &&
        (acc.usage.daily || acc.usage.lastChecked || acc.loginCount > 0)
      ) ||
      !!snap ||
      _devinChecked;
    // 兼容两种格式 — usage.daily 可能是数字(82)或对象({remaining:82})
    const _readQuota = (field) => {
      if (field == null) return undefined;
      if (typeof field === "number") return field; // 数字格式: 82
      if (typeof field === "object" && field.remaining != null)
        return field.remaining; // 对象格式: {remaining:82}
      return undefined;
    };
    const rawD = _readQuota(u.daily);
    const rawW = _readQuota(u.weekly);
    const storedD = rawD != null ? rawD : checked ? 0 : -1;
    const storedW = rawW != null ? rawW : checked ? 0 : -1;
    // 反者道之动: 快照是实时真相, acc.usage是历史兜底
    // weekly始终0-100(absent=0), snap.weekly<0仅极端防御
    const dr = snap ? Math.max(0, Math.min(100, snap.daily)) : storedD;
    let wr;
    let weeklyUnknown = false;
    if (snap) {
      if (snap.weekly >= 0) {
        wr = Math.max(0, Math.min(100, snap.weekly));
      } else {
        // weekly未知时回退到存储值, 兜底=0(耗尽), 绝不镜像daily
        weeklyUnknown = true;
        wr = storedW >= 0 ? storedW : 0;
      }
    } else {
      wr = storedW;
    }
    // v17.8 道法自然 · 返本归真: plan 完全来自 u.plan (真实 Firebase/Codeium 数据)
    //   反者道之动: v17.5+ 强给 "Devin" 是造假, 真实 Devin 账号官方 plan 是 Trial/Pro/Free 等
    //   未验账号显示空 plan (不假装 "Trial"), 触发 UI 显示未验徽章
    const plan = u.plan || (checked ? "Trial" : "");
    const planEnd = u.planEnd || 0;
    const resetTime = u.resetTime || 0;
    const weeklyReset = u.weeklyReset || 0;
    const lastChecked = snap ? snap.ts : u.lastChecked || 0;
    const now = Date.now();
    // 道法自然: daysLeft允许负值, 负值=过期天数, UI据此区分宽限期(有配额)和真死(无配额)
    const daysLeft = planEnd ? (planEnd - now) / 86400000 : 0;
    const age = acc.addedAt ? Math.round((now - acc.addedAt) / 86400000) : 0;
    const staleMin = lastChecked ? Math.round((now - lastChecked) / 60000) : -1;
    const dailyResetIn =
      resetTime > now ? Math.round((resetTime - now) / 1000) : 0;
    const weeklyResetIn =
      weeklyReset > now ? Math.round((weeklyReset - now) / 1000) : 0;
    // v17.8 道法自然: getHealth 纯映射真实数据 · 不再虚造 _devin/_devinPerpetual 标志
    //   Devin 账号与普通账号同构 → 前端零分支判断
    //   身份识别仅留在后端 (acc._authSystem), 不泄漏到前端 Health 结构
    // v17.42.4: 新增 teamsTier/gracePeriod/credits 三类字段 · 本源真数据透传 UI 与判定
    const teamsTier = Number(u.teamsTier || 0);
    const teamsTierName = u.teamsTierName || tierName(teamsTier);
    const gracePeriod = Number(u.gracePeriod || 0);
    return {
      checked,
      daily: dr,
      weekly: wr,
      plan,
      daysLeft: Math.round(daysLeft * 10) / 10,
      age,
      staleMin,
      planEnd,
      resetTime,
      weeklyReset,
      lastChecked,
      dailyResetIn,
      weeklyResetIn,
      hasSnap: !!snap,
      weeklyUnknown,
      // ═ v17.42.4 本源真数据 ═
      teamsTier,
      teamsTierName,
      isDevin: !!u.isDevin,
      hasPaidFeatures: !!u.hasPaidFeatures,
      gracePeriod,
      gracePeriodName: GRACE_PERIOD[gracePeriod] || null,
      gracePeriodEnd: u.gracePeriodEnd || 0,
      promptCredits: u.promptCredits || { used: 0, available: 0, monthly: 0 },
      flowCredits: u.flowCredits || { used: 0, available: 0, monthly: 0 },
      flexCredits: u.flexCredits || { used: 0, available: 0, monthly: 0 },
      overageMicros: u.overageMicros || 0,
      topUp: u.topUp || { enabled: false, monthly: 0, spent: 0, increment: 0 },
    };
  }

  getPoolStats() {
    let totalD = 0,
      totalW = 0,
      available = 0,
      exhausted = 0,
      waiting = 0,
      pwCount = 0,
      unchecked = 0;
    const drought = isWeeklyDrought();
    for (const a of this.accounts) {
      pwCount++;
      if (!a.password) continue;
      const h = this.getHealth(a);
      if (!h.checked) {
        unchecked++;
        continue;
      }
      // v17.8 道法自然: Devin 账号走真实数据 (fetchAccountQuota 补齐后) 与普通账号同轨
      //   无独立 available_devin 计数 — 有配额归 available, 无配额归 exhausted/waiting, 与普通账号一致
      totalD += h.daily;
      totalW += h.weekly;
      if (!isClaudeAvailable(h)) exhausted++;
      else if (isAccountSwitchable(h)) available++;
      else if (drought ? h.daily <= _getAutoSwitchThreshold() : h.weekly <= 2)
        exhausted++;
      else waiting++;
    }
    // 优先用活跃账号的API重置时间, 仅在无API数据时用计算值兜底
    const now = Date.now();
    const activeAcc =
      this.activeIndex >= 0 ? this.accounts[this.activeIndex] : null;
    const activeUsage = activeAcc ? activeAcc.usage || {} : {};
    const apiDailyMs = activeUsage.resetTime || 0;
    const apiWeeklyMs = activeUsage.weeklyReset || 0;
    const hrsD =
      apiDailyMs > now ? (apiDailyMs - now) / 3600000 : hoursUntilDailyReset();
    const hrsW =
      apiWeeklyMs > now
        ? (apiWeeklyMs - now) / 3600000
        : hoursUntilWeeklyReset();
    return {
      totalD: Math.round(totalD),
      totalW: Math.round(totalW),
      count: this.accounts.length,
      pwCount,
      available,
      exhausted,
      waiting,
      unchecked,
      drought,
      switches: this.switchCount,
      lastRefresh: this.lastRefresh,
      hrsToDaily: hrsD,
      hrsToWeekly: hrsW,
    };
  }

  // 标记使用中 — 消息锚定: 单次波动即刻标记, 冷却_getInuseCooldownMs()后清除 (持久化)
  markInUse(email) {
    const key = email.toLowerCase();
    const now = Date.now();
    const existing = this._inUse.get(key);
    if (existing) {
      existing.lastChange = now;
    } else {
      this._inUse.set(key, { since: now, lastChange: now });
    }
    _inUseDirty = true;
    _schedulePersist();
  }

  // 清除已冷却的使用中标记 (持久化)
  cleanInUse() {
    const now = Date.now();
    let cleaned = false;
    for (const [email, info] of this._inUse) {
      if (now - info.lastChange > _getInuseCooldownMs()) {
        this._inUse.delete(email);
        cleaned = true;
      }
    }
    if (cleaned) {
      _inUseDirty = true;
      _schedulePersist();
    }
  }

  // 判断是否被占用 — union: 任一来源 (本对话 turn / 跨实例 _inUse 协调)
  //   getBestIndex 用 · 跨实例不抢号
  isInUse(email) {
    this.cleanInUse();
    if (typeof _hasActiveTurnForEmail === "function") {
      if (_hasActiveTurnForEmail(email)) return true;
    }
    return this._inUse.has(email.toLowerCase());
  }

  // v17.42.17 · 是否本对话在用 (本实例 active turn 有该 email) — UI 显示用
  //   多 turn 同 email 共存合法 · 任一 active 即 true
  //   "结束" 由 _tickTurns 自然推断 (active 配额 stableMs 不变 / maxMs 兜底)
  isInUseByThisConversation(email) {
    if (!email) return false;
    if (typeof _hasActiveTurnForEmail === "function") {
      return _hasActiveTurnForEmail(email);
    }
    return false;
  }

  // v17.42.17 · 本对话所有在用 email (多对话并行 · 可 ≥ 1) · UI / status 命令用
  getConversationInUseEmails() {
    const out = [];
    if (typeof _turns !== "undefined" && _turns instanceof Map) {
      const seen = new Set();
      for (const t of _turns.values()) {
        if (t.status === "active" && !seen.has(t.email)) {
          seen.add(t.email);
          out.push(t.email);
        }
      }
    }
    return out;
  }

  // v17.42.17 · 本对话首个 active turn 的 email (向后兼容入口) · 无则 null
  getConversationInUseEmail() {
    if (typeof _turns !== "undefined" && _turns instanceof Map) {
      for (const t of _turns.values()) {
        if (t.status === "active") return t.email;
      }
    }
    return null;
  }

  // 获取剩余冷却秒数 (UI显示用)
  getInUseCooldown(email) {
    const info = this._inUse.get(email.toLowerCase());
    if (!info) return 0;
    const remaining = _getInuseCooldownMs() - (Date.now() - info.lastChange);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  clearInUse(email) {
    this._inUse.delete(email.toLowerCase());
    _inUseDirty = true;
    _schedulePersist();
  }

  // 使用中置信度 (0=无, 1=低, 2=中, 3=高)
  getInUseConfidence(email) {
    const key = email.toLowerCase();
    const info = this._inUse.get(key);
    if (!info) return 0;
    const elapsed = Date.now() - info.lastChange;
    if (elapsed > _getInuseCooldownMs()) return 0;
    if (elapsed < 10000) return 3;
    if (elapsed < 30000) return 2;
    return 1;
  }

  getBestIndex(excludeIndex = -1, skipInUse = true) {
    let bestI = -1,
      bestScore = -Infinity;
    const hrsToDaily = hoursUntilDailyReset();
    const hrsToWeekly = hoursUntilWeeklyReset();
    const drought = isWeeklyDrought();

    for (let i = 0; i < this.accounts.length; i++) {
      if (i === excludeIndex) continue;
      const a = this.accounts[i];
      if (!a.password) continue;
      if (a._unverified && !(a._authSystem === "devin" && a._devinVerified))
        continue; // Claude可用性未验证 → 不参与切号 (Devin已验证账号跳过)
      if (a.skipAutoSwitch) continue; // 用户手动锁定 → 自动切号不选此号
      if (skipInUse && this.isInUse(a.email)) continue;
      if (_isClaimedByOther(a.email)) continue; // 跨实例协调: 跳过被其他存活实例占用的账号
      // pool永久黑名单/临时拉黑 → 跳过 (根治all_channels_failed)
      const ek = a.email.toLowerCase();
      if (_tokenPoolBlacklist.has(ek)) continue;
      const streak = _poolFailStreak.get(ek);
      if (
        streak &&
        streak.count >= _getPoolTempBanThreshold() &&
        Date.now() - streak.lastFail < _getPoolTempBanDuration()
      )
        continue;
      const h = this.getHealth(a);
      // Claude不可用(Free/试用过期) → 跳过
      if (!isClaudeAvailable(h)) continue;

      // token缓存加分 — 有弹药的号优先, 根治live-login失败
      const cached = _tokenCache.get(ek);
      const hasWarmToken = cached && cached.expiresAt > Date.now() + 60000; // 至少1min有效
      const tokenBonus = hasWarmToken ? 500 : 0;
      // pool连续失败降分 (未达拉黑阈值但有失败记录)
      const failPenalty = streak && streak.count > 0 ? streak.count * 150 : 0;

      // v17.8 道法自然: 无 Devin 独立评分 — 所有账号统一按 D/W 配额评分 (eff*10 + W*8 + D*3 + 新鲜度 + tokenBonus - failPenalty)
      //   Devin 账号数据来源: fetchAccountQuota Firebase→Devin fallback 补齐真实 plan/quota
      //   Fallback 失败 → D/W=0 → 自然 continue · 不参与自动切号 (手动切号独立走 _devinFullSwitch 通道)

      // weeklyUnknown时走干旱模式逻辑(只看daily)
      if (drought || h.weeklyUnknown) {
        // ── 干旱/W未知模式: 只看Daily ──
        if (h.daily <= 0 && hrsToDaily > 4) continue;
        let score = 0;
        score += h.daily * 15;
        if (h.daily <= 5 && hrsToDaily <= 2) score += 300;
        else if (h.daily <= 5 && hrsToDaily <= 6) score += 120;
        if (h.daily > 50) score += 200;
        if (h.staleMin >= 0 && h.staleMin < 5) score += 30;
        else if (h.staleMin >= 0 && h.staleMin > 60) score += 60;
        score += tokenBonus - failPenalty; // v14.1
        if (score > bestScore) {
          bestScore = score;
          bestI = i;
        }
      } else {
        // ── 正常模式: D+W综合评分 ──
        const eff = Math.min(h.daily, h.weekly);
        if (h.daily <= 0 && h.weekly <= 0 && hrsToDaily > 4 && hrsToWeekly > 4)
          continue;
        if (h.weekly <= 0 && hrsToWeekly > 6) continue;
        let score = 0;
        score += eff * 10;
        score += h.weekly * 8;
        score += h.daily * 3;
        if (h.daily <= 5 && hrsToDaily <= 2) score += 250;
        else if (h.daily <= 5 && hrsToDaily <= 6) score += 100;
        if (h.weekly <= 5 && hrsToWeekly <= 4) score += 350;
        if (h.daily > 50 && h.weekly > 50) score += 200;
        if (h.staleMin >= 0 && h.staleMin < 5) score += 80;
        else if (h.staleMin >= 0 && h.staleMin < 30) score += 40;
        else if (h.staleMin < 0 || h.staleMin > 120) score -= 50;
        score += tokenBonus - failPenalty; // v14.1
        if (score > bestScore) {
          bestScore = score;
          bestI = i;
        }
      }
    }
    return bestI;
  }
}

// ============================================================
// 实例协调引擎 — 跨Windsurf实例的账号占用协调
// ============================================================
function _writeInstanceClaim(email) {
  try {
    fs.mkdirSync(WAM_DIR, { recursive: true });
    let claims = {};
    try {
      claims = JSON.parse(fs.readFileSync(INSTANCE_LOCK_FILE, "utf8"));
    } catch {}
    claims[_instanceId] = {
      email: (email || "").toLowerCase(),
      ts: Date.now(),
      pid: process.pid,
    };
    fs.writeFileSync(
      INSTANCE_LOCK_FILE,
      JSON.stringify(claims, null, 2),
      "utf8",
    );
    _claimsCache = { data: claims, ts: Date.now() }; // v14.3.1: 写后立即更新缓存
  } catch (e) {
    log(`instance-claim write error: ${e.message}`);
  }
}

function _readInstanceClaims() {
  try {
    if (!fs.existsSync(INSTANCE_LOCK_FILE)) return {};
    return JSON.parse(fs.readFileSync(INSTANCE_LOCK_FILE, "utf8"));
  } catch {
    return {};
  }
}

// claims缓存 — getBestIndex每个账号都调用_isClaimedByOther, 50号=50次readFileSync
// 缓存5秒TTL, 将N次磁盘读降为1次
let _claimsCache = { data: null, ts: 0 };

function _isClaimedByOther(email) {
  const now = Date.now();
  if (!_claimsCache.data || now - _claimsCache.ts > _getClaimsCacheTtl()) {
    _claimsCache = { data: _readInstanceClaims(), ts: now };
  }
  const claims = _claimsCache.data;
  const key = email.toLowerCase();
  for (const [instId, claim] of Object.entries(claims)) {
    if (instId === _instanceId) continue;
    if (now - claim.ts > _getInstanceDeadMs()) continue;
    if (claim.email === key) return true;
  }
  return false;
}

function _cleanDeadInstances() {
  try {
    const claims = _readInstanceClaims();
    const now = Date.now();
    let changed = false;
    for (const [instId, claim] of Object.entries(claims)) {
      if (now - claim.ts > _getInstanceDeadMs()) {
        delete claims[instId];
        changed = true;
        log(
          `instance-clean: removed dead ${instId} (${Math.round((now - claim.ts) / 1000)}s stale)`,
        );
      }
    }
    if (changed)
      fs.writeFileSync(
        INSTANCE_LOCK_FILE,
        JSON.stringify(claims, null, 2),
        "utf8",
      );
  } catch {}
}

// ============================================================
// 认证引擎 v4 — 纯Node.js · 多通道并行竞速 · 零外部依赖
// ============================================================

// ── 基础HTTPS请求 — v15.2: 自动感知系统代理 ──
// 道可道非常道: 固定direct=死路, 自适应代理=活路
// 当系统配置了代理(env/vscode/registry)时, 自动通过代理发送
// 否则直连 (适合可直通Google Cloud的网络)
function _httpsPost(url, body, opts = {}) {
  // 如果系统有代理且caller没明确指定hostname → 自动走代理
  if (!opts.hostname && !opts._skipAutoProxy) {
    const sysProxy = _getSystemProxy();
    if (sysProxy) {
      return _httpsViaProxy(
        sysProxy.host,
        sysProxy.port,
        url,
        body,
        opts.timeout || 12000,
        opts.headers || {},
      );
    }
  }
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: opts.hostname || parsed.hostname,
      port: opts.port || parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Host: parsed.hostname,
        ...(opts.headers || {}),
      },
      timeout: opts.timeout || 12000,
      rejectUnauthorized:
        opts.rejectUnauthorized !== undefined ? opts.rejectUnauthorized : true,
      servername:
        opts.servername !== undefined ? opts.servername : parsed.hostname,
    };
    // v17.42.12: agent:false 绕 @vscode/proxy-agent (proxySupport='on' 时 agent!==undefined → 跳过代理)
    if (_deadProxyQuarantined) reqOpts.agent = false;
    const req = https.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ _raw: data, _status: res.statusCode });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.write(body);
    req.end();
  });
}

// ── 通过HTTP代理发送HTTPS请求 (CONNECT隧道 + https.request自动处理chunked) ──
function _httpsViaProxy(
  proxyHost,
  proxyPort,
  targetUrl,
  body,
  timeout = 12000,
  extraHeaders = {},
) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const timer = setTimeout(() => {
      reject(new Error("proxy_timeout"));
    }, timeout);
    const connOpts = {
      host: proxyHost,
      port: proxyPort,
      method: "CONNECT",
      path: `${parsed.hostname}:443`,
      timeout: 3000,
    };
    // v17.42.12: CONNECT 请求也需绕 proxy-agent · 否则对本地代理的 CONNECT 又被劫持到死代理
    if (_deadProxyQuarantined) connOpts.agent = false;
    const connReq = http.request(connOpts);
    connReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        socket.destroy();
        reject(new Error(`proxy_connect_${res.statusCode}`));
        return;
      }
      // 用https.request接管已建立的CONNECT隧道socket，自动处理chunked/gzip
      const req = https.request(
        {
          socket, // 复用CONNECT隧道
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            Host: parsed.hostname,
            ...extraHeaders,
          },
          servername: parsed.hostname,
          rejectUnauthorized: false,
          timeout: timeout - 2000,
          agent: false, // socket 已建 · 不需 agent 介入
        },
        (resp) => {
          let data = "";
          resp.on("data", (c) => (data += c));
          resp.on("end", () => {
            clearTimeout(timer);
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ _raw: data, _status: resp.statusCode });
            }
          });
        },
      );
      req.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      req.on("timeout", () => {
        clearTimeout(timer);
        req.destroy();
        reject(new Error("req_timeout"));
      });
      req.write(body);
      req.end();
    });
    connReq.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    connReq.on("timeout", () => {
      clearTimeout(timer);
      connReq.destroy();
      reject(new Error("proxy_conn_timeout"));
    });
    connReq.end();
  });
}

// ── v16.0: 统一代理描述符 — 万法归宗·从根本去除端口依赖 ──
// 旧版: _proxyPortCache(端口号) + _proxyHostCache(主机名) 双全局 → 隐式耦合·易出错
// 新版: 单一 _proxyCache 描述符 {host, port, source} | null → 自洽·无歧义
let _proxyCache = null; // {host, port, source} | null — 验证通过的代理
let _proxyCacheTs = 0;
// PROXY_CACHE_TTL / PROXY_FAIL_TTL → _getProxyCacheTtl() / _getProxyFailTtl() (v17.1 getter化)
let _proxyDetectPromise = null; // v16.1: 共享Promise — 并发调用方等待同一次检测, 不再返回null
const _PROXY_NOT_FOUND = Symbol("no_proxy"); // 区分"未检测"(null)和"检测过无结果"

// 功能验证: 不仅TCP连通, 还要CONNECT隧道能打通Google
function _verifyProxyPort(host, port) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(false);
    }, 2000);
    const _vpOpts = {
      host,
      port,
      method: "CONNECT",
      path: `${_getFirebaseHost()}:443`,
      timeout: 1500,
    };
    // v17.42.12: 代理验证 CONNECT 也需绕 proxy-agent
    if (_deadProxyQuarantined) _vpOpts.agent = false;
    const connReq = http.request(_vpOpts);
    connReq.on("connect", (res, socket) => {
      clearTimeout(timer);
      socket.destroy();
      resolve(res.statusCode === 200);
    });
    connReq.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    connReq.on("timeout", () => {
      connReq.destroy();
      clearTimeout(timer);
      resolve(false);
    });
    connReq.end();
  });
}

// 系统代理自适应 — 读取环境变量/VS Code配置, 不硬编码任何主机名/IP
function _getSystemProxy() {
  // 优先级: HTTPS_PROXY > HTTP_PROXY > ALL_PROXY > VS Code http.proxy
  const envVars = [
    "HTTPS_PROXY",
    "https_proxy",
    "HTTP_PROXY",
    "http_proxy",
    "ALL_PROXY",
    "all_proxy",
  ];
  for (const key of envVars) {
    const val = process.env[key];
    if (val) {
      try {
        const u = new URL(val);
        const host = u.hostname;
        const port = parseInt(u.port) || (u.protocol === "https:" ? 443 : 80);
        if (host && port) return { host, port, source: `env:${key}` };
      } catch {
        const m = val.match(/^(?:https?:\/\/)?([^:\/]+):(\d+)/);
        if (m)
          return { host: m[1], port: parseInt(m[2]), source: `env:${key}` };
      }
    }
  }
  // VS Code 代理设置
  try {
    const vsProxy = vscode.workspace.getConfiguration("http").get("proxy", "");
    if (vsProxy) {
      try {
        const u = new URL(vsProxy);
        const host = u.hostname;
        const port = parseInt(u.port) || 80;
        if (host && port) return { host, port, source: "vscode" };
      } catch {
        const m = vsProxy.match(/^(?:https?:\/\/)?([^:\/]+):(\d+)/);
        if (m) return { host: m[1], port: parseInt(m[2]), source: "vscode" };
      }
    }
  } catch {}
  // Windows registry proxy detection — 读取系统代理设置 (v2rayN/Clash/SSR等设置系统代理时写入此处)
  if (process.platform === "win32") {
    try {
      const { execSync } = require("child_process");
      const regOut = execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer 2>nul',
        { encoding: "utf8", timeout: 2000 },
      );
      const m = regOut.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
      if (m) {
        const val = m[1].trim();
        // 格式: "host:port" 或 "http=host:port;https=host:port;..."
        const simple = val.match(/^(?:https?:\/\/)?([^:;=\/]+):(\d+)$/);
        if (simple) {
          return {
            host: simple[1],
            port: parseInt(simple[2]),
            source: "registry",
          };
        }
        // 协议前缀格式: https=host:port
        const proto = val.match(/https?=([^:;]+):(\d+)/);
        if (proto) {
          return {
            host: proto[1],
            port: parseInt(proto[2]),
            source: "registry",
          };
        }
      }
    } catch {}
  }
  return null;
}

// 动态发现默认网关 — 唯变所适·道法自然
// 企业/VPN/家庭环境中, 代理可能运行在网关而非localhost
function _detectDefaultGateway() {
  try {
    const interfaces = os.networkInterfaces();
    for (const [, addrs] of Object.entries(interfaces)) {
      for (const addr of addrs) {
        if (addr.family === "IPv4" && !addr.internal && addr.address) {
          // 根据IP地址推断网关 (常见模式: x.x.x.1)
          const parts = addr.address.split(".");
          if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.1`;
          }
        }
      }
    }
  } catch {}
  // Windows: 尝试从route命令获取网关
  if (process.platform === "win32") {
    try {
      const { execSync } = require("child_process");
      const out = execSync("route print 0.0.0.0 2>nul", {
        encoding: "utf8",
        timeout: 2000,
      });
      const m = out.match(/0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/);
      if (m) return m[1];
    } catch {}
  }
  return null;
}

// _detectProxy() 返回统一描述符 — 万法归宗·从根本去除端口依赖
// 旧版: 返回 Promise<number> (端口号, 0=无代理) + 隐式_proxyHostCache全局
// 新版: 返回 Promise<{host,port,source}|null> — 自洽, 无隐式状态, 调用方解构即用
function _detectProxy() {
  const now = Date.now();
  // 缓存命中: 返回已验证的描述符或null
  if (
    _proxyCache !== null &&
    _proxyCache !== _PROXY_NOT_FOUND &&
    now - _proxyCacheTs < _getProxyCacheTtl()
  )
    return Promise.resolve(_proxyCache);
  if (
    _proxyCache === _PROXY_NOT_FOUND &&
    now - _proxyCacheTs < _getProxyFailTtl()
  )
    return Promise.resolve(null);
  // 共享Promise — 并发调用方等待同一次检测结果, 不再返回null丢失代理
  if (_proxyDetectPromise) return _proxyDetectPromise;

  _proxyDetectPromise = new Promise(async (resolve) => {
    // 构建候选列表 — 锚定本源·动态发现·零固定常量
    // 优先级: 系统代理(env/vscode/registry) → localhost动态扫描 → LAN网关扫描
    const candidates = [];
    const seen = new Set(); // 去重 host:port

    // 层1: 系统代理 — 本源 (用户明确配置的代理, 最高优先)
    const sysProxy = _getSystemProxy();
    if (sysProxy) {
      const key = `${sysProxy.host}:${sysProxy.port}`;
      candidates.push({
        host: sysProxy.host,
        port: sysProxy.port,
        source: sysProxy.source,
      });
      seen.add(key);
      log(
        `proxy: system proxy detected ${sysProxy.host}:${sysProxy.port} (${sysProxy.source})`,
      );
    }

    // 层2: localhost动态端口扫描 — 末路兜底 (代理运行但未设系统代理)
    for (const port of _getFallbackScanPorts()) {
      const key = `127.0.0.1:${port}`;
      if (!seen.has(key)) {
        candidates.push({ host: "127.0.0.1", port, source: "scan" });
        seen.add(key);
      }
    }

    // 层3: LAN网关代理发现 — 道法自然·适应万物
    // 企业/VPN/家庭环境代理可能运行在网关上 (路由器/专用代理服务器)
    const gateway = _detectDefaultGateway();
    if (gateway && gateway !== "127.0.0.1") {
      for (const port of _getGatewayPorts()) {
        const key = `${gateway}:${port}`;
        if (!seen.has(key)) {
          candidates.push({ host: gateway, port, source: `gw:${gateway}` });
          seen.add(key);
        }
      }
      log(`proxy: LAN gateway detected ${gateway} — adding scan candidates`);
    }

    if (candidates.length === 0) {
      _proxyCache = _PROXY_NOT_FOUND;
      _proxyCacheTs = Date.now();
      _proxyDetectPromise = null;
      resolve(null);
      return;
    }

    // 并行TCP探测: 快速找到可连接的端口
    const alive = [];
    await new Promise((doneProbe) => {
      let pending = candidates.length;
      if (pending === 0) {
        doneProbe();
        return;
      }
      for (const c of candidates) {
        const s = new net.Socket();
        s.setTimeout(800);
        s.connect(c.port, c.host, () => {
          s.destroy();
          alive.push(c);
          if (--pending === 0) doneProbe();
        });
        s.on("error", () => {
          s.destroy();
          if (--pending === 0) doneProbe();
        });
        s.on("timeout", () => {
          s.destroy();
          if (--pending === 0) doneProbe();
        });
      }
    });

    // 并行CONNECT验证 — 所有alive端口同时验证, 第一个成功立即返回
    if (alive.length > 0) {
      try {
        const winner = await Promise.any(
          alive.map((c) =>
            _verifyProxyPort(c.host, c.port).then((ok) => {
              if (!ok) throw new Error("verify_fail");
              return c;
            }),
          ),
        );
        _proxyCache = {
          host: winner.host,
          port: winner.port,
          source: winner.source,
        };
        _proxyCacheTs = Date.now();
        _proxyDetectPromise = null;
        log(
          `proxy: ${winner.host}:${winner.port} verified ✓ (${winner.source})`,
        );
        resolve(_proxyCache);
        return;
      } catch {
        // all CONNECT verify failed
      }
    }
    // 全部失败
    _proxyCache = _PROXY_NOT_FOUND;
    _proxyCacheTs = Date.now();
    _proxyDetectPromise = null;
    resolve(null);
  });
  return _proxyDetectPromise;
}

// 代理失效时强制刷新缓存 (被调用方在请求失败时调用)
function _invalidateProxyCache() {
  _proxyCache = null;
  _proxyCacheTs = 0;
  _proxyDetectPromise = null;
}

// ── v17.42.7: 锁🔒 全链路贯通 — 太上不知有之 · 以神遇不以目视 ──
// 根因: stale _predictiveCandidate 在 msgAnchor/monitor/exhaust 三处被信任使用,
//       只验 password/claimed/blacklist, 漏验 skipAutoSwitch —
//       用户锁号后, 若该号仍是 _predictiveCandidate, 自动切号仍会落到已锁号上
// 治法: 单一真相 _isValidAutoTarget(i) · 所有自动切号候选必经此门 ·
//       凡四辨 (账号存在/有密码/未锁/未被他占) 一不齐即视为无效
function _isValidAutoTarget(i) {
  if (i < 0 || !_store) return false;
  const acc = _store.get(i);
  if (!acc || !acc.password) return false;
  if (acc.skipAutoSwitch) return false; // 用户手动锁 → 禁止作为切号目标
  if (_isClaimedByOther(acc.email)) return false;
  // pool 黑名单 / 临时拉黑 (同 getBestIndex 一致)
  const ek = acc.email.toLowerCase();
  if (_tokenPoolBlacklist && _tokenPoolBlacklist.has(ek)) return false;
  return true;
}

// ── v17.42.8: 同步隔离死代理 env + undici Dispatcher 重置 — 反者道之动 · 渊兮似万物之宗 ──
// 上溯 v17.42.6: 死代理 env 自净 (异步 2s TCP probe 窗口 · 已升级)
//   v17.42.6 根因注释保留 (E2E 锚点): ① _httpsPost/_httpsPostRaw 信任 _getSystemProxy() 返回 → 盲连死代理
//   ② Node 22+ https.request 原生读 env.HTTPS_PROXY → _skipAutoProxy 挡不住
// v17.42.8 症: WAM all_channels_failed + Devin Cloud is disconnected (Windsurf 官方) 双症共源
// v17.42.8 根因链 (庖丁解牛):
//   ① Explorer session env 污染: 过去某时 setx HTTPS_PROXY=141:17890 · 写 HKCU\Environment
//   ② winlogon 登录时已 inherit · 清 registry 后 · 当前 session 仍保留
//   ③ Windsurf/所有子进程 inherit 此 env · 启动瞬间 env 含死代理
//   ④ Electron Chromium net stack + Node undici 首次 fetch 时即锁定 ProxyAgent → "PROXY 141:17890"
//   ⑤ v17.42.6 async fire-and-forget purge: TCP probe 2s 阻塞 · activate 后 2s 才 delete env
//      但此时 undici ProxyAgent 已 cache · delete env 无效 · 错误持续
// v17.42.8 治法 (太上不知有之):
//   ① activate 第一行 _quarantineEnvProxySync(): 同步遍历 env 六 key · 立即 delete · 内存备份
//      零秒窗口 · 早于任何 fetch/https.request
//   ② setGlobalDispatcher(new undici.Agent()): 重置已 cache 的 ProxyAgent
//      无论 WAM activate 早晚于官方扩展 · 皆清
//   ③ 后续 _verifyAndRestoreEnvProxy(): TCP 探活 · 活则回写 env (不让用户真代理丢失)
function _tcpProbe(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {}
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      finish(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      finish(false);
    });
    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

const _ENV_PROXY_KEYS = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
];
const _savedEnvProxy = Object.create(null); // 隔离期暂存 · 待 TCP 验活后回写

// v17.42.8: 同步隔离 — activate 第一行调用 · 零秒窗口 · 早于任何 fetch/https.request
//   返回隔离数量 · 无 TCP probe (不阻塞) · 纯内存操作
//   同步重置 undici 全局 Dispatcher: 若已 cache ProxyAgent (本扩展或其它扩展先 activate 造成)
//     则用新 Agent 替换 · 后续 fetch 都走无代理 agent · 双保险
function _quarantineEnvProxySync() {
  let n = 0;
  for (const k of _ENV_PROXY_KEYS) {
    const v = process.env[k];
    if (v) {
      _savedEnvProxy[k] = v;
      delete process.env[k];
      n++;
    }
  }
  // 重置 undici 全局 Dispatcher (Node 18+ 内置 undici · require 不会失败)
  //   如已被其它扩展先 activate 建 ProxyAgent · 此处立即替换
  try {
    const undici = require("undici");
    if (undici && typeof undici.setGlobalDispatcher === "function") {
      undici.setGlobalDispatcher(new undici.Agent());
    }
  } catch {
    // 某些环境无 undici (老 Node) · 无妨 · 仅失去双保险 · env 隔离仍生效
  }
  // v17.42.12: @vscode/proxy-agent 本源突破
  //   proxy-agent patch http(s).request: proxySupport='override' 时无条件劫持 agent
  //   改为 'on' → 仅当 agent===undefined 时走代理 → 我们的 agent:false 绕过
  if (n > 0) {
    _deadProxyQuarantined = true;
    try {
      const httpCfg = vscode.workspace.getConfiguration("http");
      _savedProxySupport = httpCfg.get("proxySupport", "override");
      if (_savedProxySupport !== "on") {
        httpCfg.update("proxySupport", "on", true).then(
          () =>
            log(
              `env-proxy: http.proxySupport → 'on' (was '${_savedProxySupport}') · agent:false 绕 proxy-agent`,
            ),
          () => {}, // settings 写入偶尔失败 · 不阻塞
        );
      }
    } catch {}
  }
  return n;
}

// v17.42.8: 异步验活 + 恢复活代理 — activate 注入后 fire-and-forget
//   对 _savedEnvProxy 中每个暂存代理做 TCP probe (2s)
//   活: 回写 process.env · 日志 restore
//   死: 保持隔离 · 日志 quarantine
//   与老 _purgeDeadEnvProxy 行为对齐: 若有死代 · _invalidateProxyCache 让 _detectProxy 重扫
async function _verifyAndRestoreEnvProxy() {
  const keys = Object.keys(_savedEnvProxy);
  if (keys.length === 0) {
    log(`env-proxy: 启动时 env 无代理变量 · 无需验活`);
    return { restored: 0, quarantined: 0 };
  }
  const seen = new Map(); // "host:port" -> boolean
  let restored = 0,
    quarantined = 0;
  for (const key of keys) {
    const val = _savedEnvProxy[key];
    let host, port;
    try {
      const u = new URL(val);
      host = u.hostname;
      port = parseInt(u.port) || (u.protocol === "https:" ? 443 : 80);
    } catch {
      const m = val.match(/^(?:https?:\/\/)?([^:\/]+):(\d+)/);
      if (m) {
        host = m[1];
        port = parseInt(m[2]);
      }
    }
    if (!host || !port) {
      delete _savedEnvProxy[key];
      continue;
    }
    const k = `${host}:${port}`;
    let alive;
    if (seen.has(k)) {
      alive = seen.get(k);
    } else {
      alive = await _tcpProbe(host, port, 2000);
      seen.set(k, alive);
    }
    if (alive) {
      process.env[key] = val; // 回写活代理
      restored++;
      log(`env-proxy restore: ${key}=${val} (TCP OK · 活 · 已回写 env)`);
    } else {
      quarantined++;
      log(
        `env-proxy quarantine: ${key}=${val} (dead · TCP timeout/refused · 保持隔离)`,
      );
    }
    delete _savedEnvProxy[key];
  }
  if (quarantined > 0) {
    _invalidateProxyCache();
    _deadProxyQuarantined = true;
    log(
      `env-proxy: ${quarantined} 个死代理保持隔离 · _deadProxyQuarantined=true · proxySupport='on' · agent:false 生效`,
    );
  }
  if (restored > 0 && quarantined === 0) {
    _deadProxyQuarantined = false;
    // 还原 http.proxySupport
    if (_savedProxySupport && _savedProxySupport !== "on") {
      try {
        vscode.workspace
          .getConfiguration("http")
          .update("proxySupport", _savedProxySupport, true)
          .then(
            () =>
              log(
                `env-proxy: http.proxySupport → '${_savedProxySupport}' (还原)`,
              ),
            () => {},
          );
      } catch {}
      _savedProxySupport = null;
    }
    log(`env-proxy: 全部活代理已回写 env · _deadProxyQuarantined=false`);
  }
  return { restored, quarantined };
}

// v17.42.8 兼容别名: 老名字 _purgeDeadEnvProxy 保留 · 指向新实现
//   外部若有其它入口调此 (搜无 · 仅 activate) · 仍可工作
async function _purgeDeadEnvProxy() {
  // 向后兼容: 若未经过同步 quarantine (例如测试单独 require 调此) · 先做同步 quarantine
  if (Object.keys(_savedEnvProxy).length === 0) {
    const hasEnv = _ENV_PROXY_KEYS.some((k) => !!process.env[k]);
    if (hasEnv) _quarantineEnvProxySync();
  }
  const { quarantined } = await _verifyAndRestoreEnvProxy();
  return quarantined;
}

// ── v15.1: Bridge就绪信号 + 自动确保 — 道法自然·有桥才走桥 ──
// 根因修复: startup时webview不存在 → _nativeFetch全部no_webview → 所有native通道死
// 修复策略:
//   1. _onBridgeReady(): sidebar/editor创建时调用, 触发排队的回调
//   2. _ensureBridgeWebview(): 如果sidebar未打开, 自动创建隐藏editor panel作为bridge
//   3. _nativeFetch内部: no_webview时尝试auto-ensure, 而非直接reject
function _onBridgeReady() {
  if (_bridgeReady) return;
  _bridgeReady = true;
  log("bridge: Chromium网络桥就绪 — 万法归宗");
  // 执行所有排队的回调
  const cbs = _bridgeReadyCallbacks.splice(0);
  for (const cb of cbs) {
    try {
      cb();
    } catch (e) {
      log(`bridge callback err: ${e.message}`);
    }
  }
}

function _ensureBridgeWebview() {
  // 已有可用webview → 无需操作
  if ((_sidebarProvider && _sidebarProvider._view) || _editorPanel) return;
  // v16: 道法自然·真无感 — 不创建可见editor panel, 改为唤醒侧边栏
  // 根因: createWebviewPanel必然创建可见标签页, preserveFocus只是不抢焦点
  // 修复: 用sidebar做bridge, WebviewView不产生编辑器标签, 真正无感
  try {
    log("bridge: 唤醒侧边栏作为网络桥 (不创建editor panel)");
    vscode.commands.executeCommand("wam.panel.focus");
  } catch (e) {
    log(`bridge: sidebar唤醒失败: ${e.message}`);
  }
}

function _getActiveWebview() {
  if (_sidebarProvider && _sidebarProvider._view)
    return _sidebarProvider._view.webview;
  if (_editorPanel) return _editorPanel.webview;
  return null;
}

// ── v15: Chromium原生网络桥 — 万法归宗·道法自然 ──
// 核心原理: Webview的fetch()运行在Chromium渲染进程, 自动继承:
//   1. Windows注册表系统代理 (v2rayN/Clash等)
//   2. PAC脚本自动代理配置
//   3. Chromium DNS解析 (绕过Node.js DNS劫持)
//   4. 与Windsurf官方登录完全相同的网络路径
// 只要用户能用Windsurf → 此通道必然能到达Firebase/Codeium
// no_webview时自动尝试_ensureBridgeWebview, 而非直接放弃
function _nativeFetch(url, opts = {}) {
  return new Promise((resolve, reject) => {
    let wv = _getActiveWebview();
    if (!wv) {
      // 自动确保bridge — 不再静默放弃
      _ensureBridgeWebview();
      wv = _getActiveWebview();
    }
    if (!wv) {
      reject(new Error("no_webview"));
      return;
    }
    const id = ++_fetchIdCounter;
    const timer = setTimeout(() => {
      _fetchPending.delete(id);
      reject(new Error("native_timeout"));
    }, opts.timeout || 15000);
    _fetchPending.set(id, { resolve, reject, timer });
    const msg = {
      type: "_fetch",
      id,
      url,
      method: opts.method || "POST",
      headers: opts.headers || {},
      binary: !!opts.binary,
    };
    if (Buffer.isBuffer(opts.body)) {
      msg.body = Array.from(opts.body);
      msg.bodyType = "binary";
    } else if (opts.body != null) {
      msg.body = String(opts.body);
      msg.bodyType = "text";
    }
    wv.postMessage(msg);
  });
}

function _handleFetchResult(msg) {
  const cb = _fetchPending.get(msg.id);
  if (!cb) return;
  clearTimeout(cb.timer);
  _fetchPending.delete(msg.id);
  if (msg.ok) {
    cb.resolve({ status: msg.status, data: msg.data });
  } else {
    cb.reject(new Error(msg.error || "native_fetch_failed"));
  }
}

// ── Raw HTTPS POST (返回Buffer, 用于protobuf二进制响应) — v15.2: 自动感知系统代理 ──
// 入口采样 RTT/outcome → _adaptive 自动调节所有性能参数
function _httpsPostRaw(url, body, opts = {}) {
  // 系统有代理且caller没指定hostname → 自动走代理 (道法自然)
  if (!opts.hostname && !opts._skipAutoProxy) {
    const sysProxy = _getSystemProxy();
    if (sysProxy) {
      return _httpsPostRawViaProxy(
        sysProxy.host,
        sysProxy.port,
        url,
        body,
        opts.timeout || 12000,
      );
    }
  }
  const _startTs = Date.now();
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: opts.hostname || parsed.hostname,
      port: opts.port || parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/proto",
        "Content-Length": Buffer.byteLength(body),
        Host: parsed.hostname,
        "connect-protocol-version": "1",
        ...(opts.headers || {}),
      },
      timeout: opts.timeout || 12000,
      rejectUnauthorized: false,
      servername: parsed.hostname,
    };
    // v17.42.12: agent:false 绕 @vscode/proxy-agent
    if (_deadProxyQuarantined) reqOpts.agent = false;
    const req = https.request(reqOpts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        // v17.11 唯变所适: 2xx/3xx = success, 4xx/5xx/429 = outcome fail (RTT 仍计)
        const rtt = Date.now() - _startTs;
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        _adaptive.sampleRtt(rtt);
        _adaptive.sampleOutcome(ok);
        resolve({ buf: Buffer.concat(chunks), status: res.statusCode });
      });
    });
    req.on("error", (e) => {
      _adaptive.sampleOutcome(false);
      reject(e);
    });
    req.on("timeout", () => {
      _adaptive.sampleOutcome(false);
      req.destroy();
      reject(new Error("timeout"));
    });
    req.write(body);
    req.end();
  });
}

function _httpsPostRawViaProxy(
  proxyHost,
  proxyPort,
  targetUrl,
  body,
  timeout = 12000,
  opts = {},
) {
  const _startTs = Date.now();
  const _rej = (err) => {
    _adaptive.sampleOutcome(false);
    return err;
  };
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const timer = setTimeout(() => {
      reject(_rej(new Error("proxy_raw_timeout")));
    }, timeout);
    const connOptsR = {
      host: proxyHost,
      port: proxyPort,
      method: "CONNECT",
      path: `${parsed.hostname}:443`,
      timeout: 3000,
    };
    // v17.42.12: CONNECT 请求也需绕 proxy-agent
    if (_deadProxyQuarantined) connOptsR.agent = false;
    const connReq = http.request(connOptsR);
    connReq.on("connect", (res, socket) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        socket.destroy();
        reject(_rej(new Error(`proxy_connect_${res.statusCode}`)));
        return;
      }
      const req = https.request(
        {
          socket,
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: "POST",
          headers: {
            "Content-Type": "application/proto",
            "Content-Length": Buffer.byteLength(body),
            Host: parsed.hostname,
            "connect-protocol-version": "1",
            ...(opts.headers || {}),
          },
          servername: parsed.hostname,
          rejectUnauthorized: false,
          timeout: timeout - 2000,
          agent: false, // socket 已建 · 防 VS Code 二次代理
        },
        (resp) => {
          const chunks = [];
          resp.on("data", (c) => chunks.push(c));
          resp.on("end", () => {
            clearTimeout(timer);
            // v17.11 采样 RTT + outcome (via proxy 路径)
            const rtt = Date.now() - _startTs;
            const ok = resp.statusCode >= 200 && resp.statusCode < 400;
            _adaptive.sampleRtt(rtt);
            _adaptive.sampleOutcome(ok);
            resolve({ buf: Buffer.concat(chunks), status: resp.statusCode });
          });
        },
      );
      req.on("error", (e) => {
        clearTimeout(timer);
        reject(_rej(e));
      });
      req.on("timeout", () => {
        clearTimeout(timer);
        req.destroy();
        reject(_rej(new Error("req_timeout")));
      });
      req.write(body);
      req.end();
    });
    connReq.on("error", (e) => {
      clearTimeout(timer);
      reject(_rej(e));
    });
    connReq.on("timeout", () => {
      clearTimeout(timer);
      connReq.destroy();
      reject(_rej(new Error("proxy_conn_timeout")));
    });
    connReq.end();
  });
}

// ── Protobuf 编解码 (Windsurf API使用Connect协议) ──
function encodeProtoString(str) {
  const b = Buffer.from(str, "utf8");
  const lenBytes = [];
  let l = b.length;
  while (l > 127) {
    lenBytes.push((l & 0x7f) | 0x80);
    l >>= 7;
  }
  lenBytes.push(l);
  return Buffer.concat([Buffer.from([0x0a, ...lenBytes]), b]);
}

function readVarint(buf, pos) {
  let v = 0,
    s = 0;
  while (pos < buf.length) {
    const x = buf[pos++];
    v |= (x & 0x7f) << s;
    if (!(x & 0x80)) return [v, pos];
    s += 7;
  }
  return [v, pos];
}

// ── Protobuf逐字段解析器 ──
// 返回 { varints: {fieldNum: value}, messages: {fieldNum: Buffer} }
// varints = 所有varint字段, messages = 所有length-delimited字段的原始字节
function parseProtoFields(buf) {
  const varints = {},
    messages = {};
  let pos = 0;
  while (pos < buf.length) {
    const [tag, tagEnd] = readVarint(buf, pos);
    if (tagEnd === pos || tag === 0) break;
    pos = tagEnd;
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x07;
    if (fieldNum === 0 || fieldNum > 10000) break;
    switch (wireType) {
      case 0: {
        // varint
        const [val, nextPos] = readVarint(buf, pos);
        if (nextPos === pos) {
          pos = buf.length;
          break;
        }
        pos = nextPos;
        varints[fieldNum] = val;
        break;
      }
      case 1: // 64-bit fixed
        if (pos + 8 > buf.length) {
          pos = buf.length;
          break;
        }
        pos += 8;
        break;
      case 2: {
        // length-delimited (string/bytes/nested)
        const [len, nextPos] = readVarint(buf, pos);
        if (nextPos === pos || nextPos + len > buf.length) {
          pos = buf.length;
          break;
        }
        if (!messages[fieldNum])
          messages[fieldNum] = buf.slice(nextPos, nextPos + len);
        pos = nextPos + len;
        break;
      }
      case 5: // 32-bit fixed
        if (pos + 4 > buf.length) {
          pos = buf.length;
          break;
        }
        pos += 4;
        break;
      default:
        pos = buf.length; // unknown wire type → bail
    }
  }
  return { varints, messages };
}

// ═════════════════════════════════════════════════════════════════════
// v17.42.4 · 万法归宗 · PlanStatus proto schema (逆向 windsurf.com 本源)
// ═════════════════════════════════════════════════════════════════════
// 源: _webrev/chunks/47399-*.js (`exa.codeium_common_pb.PlanStatus` + `PlanInfo`)
// 探针: _proto_deep_probe.js (proto + JSON 双通道交叉验证 · 18 字段对齐)
//
// 官方 PlanStatus 18 字段:
//   1 plan_info (PlanInfo msg)    10 top_up_status (TopUpStatus msg)
//   2 plan_start (Timestamp)      11 was_reduced_by_orphaned_usage (bool)
//   3 plan_end   (Timestamp)      12 grace_period_status (enum 0-3)
//   4 available_flex_credits      13 grace_period_end (Timestamp)
//   5 used_flow_credits           14 daily_quota_remaining_percent (0-100)
//   6 used_prompt_credits         15 weekly_quota_remaining_percent (0-100)
//   7 used_flex_credits           16 overage_balance_micros (int64)
//   8 available_prompt_credits    17 daily_quota_reset_at_unix (int64)
//   9 available_flow_credits      18 weekly_quota_reset_at_unix (int64)
// ─────────────────────────────────────────────────────────────────────
const TEAMS_TIER = {
  0: "UNSPECIFIED",
  1: "TEAMS",
  2: "PRO",
  3: "ENTERPRISE_SAAS",
  4: "HYBRID",
  5: "ENTERPRISE_SELF_HOSTED",
  6: "WAITLIST_PRO",
  7: "TEAMS_ULTIMATE",
  8: "PRO_ULTIMATE",
  9: "TRIAL",
  10: "ENTERPRISE_SELF_SERVE",
  11: "ENTERPRISE_SAAS_POOLED",
  12: "DEVIN_ENTERPRISE",
  14: "DEVIN_TEAMS",
  15: "DEVIN_TEAMS_V2",
  16: "DEVIN_PRO",
  17: "DEVIN_MAX",
  18: "MAX",
  19: "DEVIN_FREE",
  20: "DEVIN_TRIAL",
};
const GRACE_PERIOD = {
  0: "UNSPECIFIED",
  1: "NONE",
  2: "ACTIVE",
  3: "EXPIRED",
};
// 付费层 · Claude 全量可用
const _PAID_TIER_SET = new Set([
  2, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 16, 17, 18,
]);
// 试用层 · 有 plan_end + 可能进 grace period
const _TRIAL_TIER_SET = new Set([9, 20]); // TRIAL, DEVIN_TRIAL
// 免费层 · Claude 付费模型死刑
const _FREE_TIER_SET = new Set([6, 19]); // WAITLIST_PRO, DEVIN_FREE
function tierIsPaid(t) {
  return _PAID_TIER_SET.has(Number(t));
}
function tierIsTrial(t) {
  return _TRIAL_TIER_SET.has(Number(t));
}
function tierIsFree(t) {
  return _FREE_TIER_SET.has(Number(t));
}
function tierName(t) {
  return TEAMS_TIER[Number(t)] || null;
}

// ── 从解析结果中提取 PlanStatus 全字段 ─────────────────────────────
// v10.2: proto field 14/15 = remainingPercent (官方UI显示 100-此值)
// v17.42.4: 18 字段完整解析 + PlanInfo 嵌套 + Grace/TopUp/Overage · 本源对齐
function _extractQuotaFields(v, msgs) {
  // A) 百分比 · 0-100 (field 14/15)
  const dailyR = v[14];
  const weeklyR = v[15];
  // B) 重置时间 · unix 秒 int64 (field 17/18)
  const dReset = v[17];
  const wReset = v[18];
  // C) Credit 整数计数 (field 4-9) · proto3 absent=0
  const usedPrompt = v[6] || 0;
  const availPrompt = v[8] || 0;
  const usedFlow = v[5] || 0;
  const availFlow = v[9] || 0;
  const usedFlex = v[7] || 0;
  const availFlex = v[4] || 0;
  // D) Grace period (field 12) · 0/1/2/3 enum
  const gracePeriod = v[12] || 0;
  // E) Overage 微美元 (field 16) · int64 varint
  const overageMicros = v[16] || 0;
  // F) Orphan 扣减 bool (field 11)
  const orphanReduce = !!v[11];

  // 基础有效性门控 (至少 2 个合理字段, 防止 relay wrapper 误读)
  let valid = 0;
  if (dailyR !== undefined && dailyR >= 0 && dailyR <= 100) valid++;
  if (weeklyR !== undefined && weeklyR >= 0 && weeklyR <= 100) valid++;
  if (dReset !== undefined && dReset > 1700000000) valid++;
  if (wReset !== undefined && wReset > 1700000000) valid++;
  if (availPrompt > 0) valid++;
  if (availFlow > 0) valid++;
  if (msgs && msgs[1] && msgs[1].length > 2) valid++; // plan_info 存在
  if (valid < 2) return null;

  // G) PlanInfo 嵌套 (msgs[1]) · 30+ 字段取精华
  let planName = null,
    teamsTier = 0;
  let monthlyPrompt = 0,
    monthlyFlow = 0,
    monthlyFlex = 0;
  let isDevin = false,
    isEnterprise = false,
    isTeams = false;
  let hasPaidFeatures = false,
    canBuyMore = false;
  if (msgs && msgs[1]) {
    try {
      const pi = parseProtoFields(msgs[1]);
      teamsTier = pi.varints[1] || 0;
      if (pi.messages[2]) {
        const nm = pi.messages[2].toString("utf8").trim();
        if (nm && nm.length <= 64 && /^[\x20-\x7E]+$/.test(nm)) planName = nm;
      }
      monthlyPrompt = pi.varints[12] || 0;
      monthlyFlow = pi.varints[13] || 0;
      monthlyFlex = pi.varints[14] || 0;
      isEnterprise = !!pi.varints[16];
      isTeams = !!pi.varints[17];
      canBuyMore = !!pi.varints[18];
      hasPaidFeatures = !!pi.varints[32];
      isDevin = !!pi.varints[34];
    } catch {}
  }

  // 旧格式字符串 fallback (API 偏移容错)
  if (!planName && msgs) {
    const knownPlans =
      /^(free|pro_trial|pro|trial|enterprise|team|individual)$/i;
    for (const fn of Object.keys(msgs)) {
      try {
        const str = msgs[fn].toString("utf8").trim();
        if (knownPlans.test(str)) {
          planName = str;
          break;
        }
      } catch {}
    }
  }
  // teamsTier → planName 兜底推导
  if (!planName && teamsTier > 0) planName = tierName(teamsTier);

  // H) Plan 起止时间 (msgs[2]/[3]) · 嵌套 Timestamp
  let planStartUnix = 0,
    planEndUnix = 0;
  const _readTs = (buf) => {
    try {
      const f = parseProtoFields(buf);
      const s = f.varints[1];
      if (s && s > 1700000000 && s < 2100000000) return s;
    } catch {}
    return 0;
  };
  if (msgs && msgs[2]) planStartUnix = _readTs(msgs[2]);
  if (msgs && msgs[3]) planEndUnix = _readTs(msgs[3]);
  // 交叉验证区间合理性 (1-365 天)
  if (planStartUnix && planEndUnix) {
    const durDays = (planEndUnix - planStartUnix) / 86400;
    if (planStartUnix >= planEndUnix || durDays > 365) {
      log(
        `planDate suspect: start=${new Date(planStartUnix * 1000).toISOString().slice(0, 10)} end=${new Date(planEndUnix * 1000).toISOString().slice(0, 10)} dur=${durDays.toFixed(1)}d → discard`,
      );
      planStartUnix = 0;
      planEndUnix = 0;
    }
  }

  // I) Grace period end (msgs[13])
  let gracePeriodEndUnix = 0;
  if (msgs && msgs[13]) gracePeriodEndUnix = _readTs(msgs[13]);

  // J) TopUpStatus (msgs[10])
  let topUpEnabled = false,
    monthlyTopUp = 0,
    topUpSpent = 0,
    topUpIncrement = 0;
  if (msgs && msgs[10]) {
    try {
      const tu = parseProtoFields(msgs[10]);
      topUpEnabled = !!tu.varints[2];
      monthlyTopUp = tu.varints[3] || 0;
      topUpSpent = tu.varints[4] || 0;
      topUpIncrement = tu.varints[5] || 0;
    } catch {}
  }

  const dailyVal =
    dailyR !== undefined && dailyR >= 0 && dailyR <= 100 ? dailyR : 0;
  const weeklyVal =
    weeklyR !== undefined && weeklyR >= 0 && weeklyR <= 100 ? weeklyR : 0;

  return {
    // ── 百分比 (向后兼容) ──
    daily: dailyVal,
    weekly: weeklyVal,
    dailyResetUnix: dReset && dReset > 1700000000 ? dReset : 0,
    weeklyResetUnix: wReset && wReset > 1700000000 ? wReset : 0,
    // ── Plan 基础 (向后兼容) ──
    planName,
    planStartUnix,
    planEndUnix,
    // ── v17.42.4 新增: 本源真数据 ──
    teamsTier,
    teamsTierName: tierName(teamsTier),
    isDevin,
    isEnterprise,
    isTeams,
    hasPaidFeatures,
    canBuyMore,
    // Credit 整数计数 (不再除 100 · 直接对齐官方 UI)
    promptUsed: usedPrompt,
    promptAvailable: availPrompt,
    promptMonthly: monthlyPrompt,
    flowUsed: usedFlow,
    flowAvailable: availFlow,
    flowMonthly: monthlyFlow,
    flexUsed: usedFlex,
    flexAvailable: availFlex,
    flexMonthly: monthlyFlex,
    // Grace period (官方过期状态 · 替代手算 planEnd>Date.now())
    gracePeriod,
    gracePeriodName: GRACE_PERIOD[gracePeriod] || null,
    gracePeriodEndUnix,
    // Overage / 其他
    overageMicros,
    orphanReduce,
    // Top-up
    topUpEnabled,
    monthlyTopUp,
    topUpSpent,
    topUpIncrement,
    // ── 兼容字段 (v17.42.4 语义修正 · 不再 /100) ──
    // 老字段 creditsUsed/Total 现在 = 真实整数 (prompt credits 计数)
    creditsUsed: usedPrompt,
    creditsTotal: monthlyPrompt || usedPrompt + availPrompt || 0,
  };
}

function parsePlanStatus(buf) {
  // 非protobuf响应快速拒绝 (JSON/HTML错误页)
  if (buf.length < 50 || buf[0] === 0x7b || buf[0] === 0x3c) return null; // '{' or '<'
  // ── 层1: 剥离gRPC 5字节envelope (flags[1]+length[4]) ──
  let pb = buf;
  let stripped = false;
  if (pb.length >= 5) {
    const flags = pb[0];
    const msgLen = pb.readUInt32BE(1);
    if (
      (flags === 0x00 || flags === 0x02) &&
      msgLen > 0 &&
      msgLen + 5 <= pb.length
    ) {
      pb = pb.slice(5, 5 + msgLen);
      stripped = true;
    }
  }

  const top = parseProtoFields(pb);

  // ── 关键策略: 深层优先 ──
  // GetPlanStatusResponse 顶层 field 1 = plan_status (PlanStatus msg)
  // field 2 = team_used_prompt_credits (int64)
  // relay 可能在 field 1 外再包一层 wrapper, 所以 L3/L4 深度优先

  // ── 层3/4: 优先解析wrapper内部 (v9.3: 强化验证 — 要求D/W+至少一个reset字段) ──
  const _hasResetField = (v) =>
    (v[17] && v[17] > 1700000000) || (v[18] && v[18] > 1700000000);
  // v17.42.4: 日志带上 tier/grace/credits 三项 · 诊断颗粒度倍增
  const _fmtLog = (lvl, r) => {
    const bits = [`proto ${lvl}: D${r.daily} W${r.weekly}`];
    if (r.planName) bits.push(`plan=${r.planName}`);
    if (r.teamsTierName) bits.push(`tier=${r.teamsTierName}`);
    if (r.gracePeriod && r.gracePeriod > 1)
      bits.push(`grace=${r.gracePeriodName}`);
    if (r.promptMonthly || r.promptAvailable)
      bits.push(
        `prompt=${r.promptUsed}/${r.promptMonthly || r.promptUsed + r.promptAvailable}`,
      );
    if (r.flowMonthly || r.flowAvailable)
      bits.push(
        `flow=${r.flowUsed}/${r.flowMonthly || r.flowUsed + r.flowAvailable}`,
      );
    if (r.planEndUnix)
      bits.push(
        `end=${new Date(r.planEndUnix * 1000).toISOString().slice(0, 10)}`,
      );
    if (r.overageMicros)
      bits.push(`overage=$${(Number(r.overageMicros) / 1e6).toFixed(2)}`);
    return bits.join(" ");
  };
  if (top.messages[1] && top.messages[1].length > 10) {
    const inner = parseProtoFields(top.messages[1]);
    let result = _extractQuotaFields(inner.varints, inner.messages);
    if (result && _hasResetField(inner.varints)) {
      log(`${_fmtLog("L3", result)} env=${stripped} ${pb.length}B`);
      return result;
    } else if (result) {
      log(
        `proto L3: D${result.daily} W${result.weekly} REJECTED (no reset field — likely relay metadata)`,
      );
    }
    // 层4: 再深一层
    if (inner.messages[1] && inner.messages[1].length > 10) {
      const deep = parseProtoFields(inner.messages[1]);
      result = _extractQuotaFields(deep.varints, deep.messages);
      if (result && _hasResetField(deep.varints)) {
        log(`${_fmtLog("L4", result)} env=${stripped} ${pb.length}B`);
        return result;
      } else if (result) {
        log(
          `proto L4: D${result.daily} W${result.weekly} REJECTED (no reset field — likely relay metadata)`,
        );
      }
    }
  }

  // ── 层2: fallback — 仅当没有wrapper时才用顶层字段 ──
  let result = _extractQuotaFields(top.varints, top.messages);
  if (result) {
    log(
      `${_fmtLog("L2", result)} env=${stripped} ${pb.length}B b0=0x${buf[0].toString(16)}`,
    );
    return result;
  }

  log(
    `parsePlanStatus: no quota in ${pb.length}B env=${stripped} b0=0x${buf[0].toString(16)} top=${Object.keys(top.varints).join(",")} hex=${pb.slice(0, 48).toString("hex")}`,
  );
  return null;
}

// ── 单通道Firebase登录 ──
async function _firebaseVia(channel, email, password, key) {
  const payload = JSON.stringify({ email, password, returnSecureToken: true });
  const url = `https://${_getFirebaseHost()}/v1/accounts:signInWithPassword?key=${key}`;

  switch (channel) {
    case "direct":
      return _httpsPost(url, payload, {
        timeout: 8000,
        headers: { Referer: _getFirebaseReferer() },
      });

    case "proxy":
      return _detectProxy().then((proxy) => {
        if (!proxy) throw new Error("no_proxy");
        return _httpsViaProxy(proxy.host, proxy.port, url, payload, 10000, {
          Referer: _getFirebaseReferer(),
        });
      });

    case "native":
      // v15: Chromium原生通道 — 万法归宗
      // Webview的fetch()自动继承系统代理, 与Windsurf官方登录网络路径完全一致
      return _nativeFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Referer: _getFirebaseReferer(),
        },
        body: payload,
        timeout: 12000,
      }).then((resp) => {
        if (typeof resp.data === "string") {
          try {
            return JSON.parse(resp.data);
          } catch {
            throw new Error("native_parse_error");
          }
        }
        throw new Error("native_invalid_response");
      });

    default:
      throw new Error(`unknown_channel: ${channel}`);
  }
}

// ── v11: 全并行竞速 Firebase 登录 — 天下之至柔，驰骋天下之至坚 ──
// 旧版v10: for(key of KEYS){Promise.any([ch1,ch2])} 串行迭代key → 实测42s超时
// v11: ALL keys×channels 同时发射, 第一个成功立即返回 → 实测1-3s, 最差10s
async function firebaseLogin(email, password) {
  const channels = ["native", "proxy", "direct"];
  const errors = {};

  // Phase 1: 全并行竞速 — 2keys × 2channels = 4个请求同时发射
  const blastPromises = [];
  for (const key of _getFirebaseKeys()) {
    const keySuffix = key.slice(-4);
    for (const ch of channels) {
      blastPromises.push(
        _firebaseVia(ch, email, password, key)
          .then((result) => {
            if (result && result.idToken)
              return {
                ok: true,
                idToken: result.idToken,
                channel: `${ch}-${keySuffix}`,
              };
            const err = result?.error;
            const msg = (typeof err === "object" ? err?.message : err) || "";
            if (/INVALID|NOT_FOUND|DISABLED|WRONG/.test(msg))
              return { ok: false, permanent: true, error: msg };
            throw new Error(msg || "no_token");
          })
          .catch((e) => {
            errors[`${ch}-${keySuffix}`] = e.message;
            throw e;
          }),
      );
    }
  }

  try {
    const result = await Promise.any(blastPromises);
    if (result.ok) return result;
    if (result.permanent)
      return { ok: false, error: result.error, channel: "permanent" };
  } catch (aggErr) {
    const permanentErr = Object.values(errors).find((e) =>
      /INVALID|NOT_FOUND|DISABLED|WRONG/.test(e),
    );
    if (permanentErr)
      return { ok: false, error: permanentErr, channel: "permanent" };
  }

  // Phase 2: 刷新代理后全并行重试 (v11: 全keys×channels, 不再只retry单key)
  _invalidateProxyCache();
  const retryPromises = [];
  for (const key of _getFirebaseKeys()) {
    const keySuffix = key.slice(-4);
    for (const ch of channels) {
      retryPromises.push(
        _firebaseVia(ch, email, password, key)
          .then((r) => {
            if (r && r.idToken)
              return {
                ok: true,
                idToken: r.idToken,
                channel: `retry-${ch}-${keySuffix}`,
              };
            throw new Error("no_token");
          })
          .catch((e) => {
            errors[`retry-${ch}-${keySuffix}`] = e.message;
            throw e;
          }),
      );
    }
  }
  try {
    const result = await Promise.any(retryPromises);
    if (result.ok) return result;
  } catch {}

  return { ok: false, error: "all_channels_failed", details: errors };
}

// ── v17.5: Devin 密码登录回退 — 道法自然·Windsurf 身份迁移适配 ──
// 背景: Cognition 收购 Windsurf 后身份迁至 Devin, 新账号只在 Devin 不在 Firebase
// 验证: /_devin-auth/password/login 返回 {token:auth1_xxx, user_id:user-xxx, email}
// 作用: Firebase INVALID_LOGIN_CREDENTIALS 时探测此账号是否 Devin-only, 识别后避免被永久拉黑
function _getDevinLoginUrl() {
  return _cfg(
    "devin.loginUrl",
    "https://windsurf.com/_devin-auth/password/login",
  );
}
// v17.41 唯变所适: Referer/Origin 从端点 URL 自动推导 · 零硬编码域名
function _deriveOrigin(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.origin;
  } catch {
    return "https://windsurf.com";
  }
}
async function _devinLogin(email, password) {
  const url = _getDevinLoginUrl();
  const urlOrigin = _deriveOrigin(url);
  const payload = JSON.stringify({ email, password });
  // v17.42.3 反者道之动: 匹配官网 fetch("/_devin-auth/password/login") 的完整 header
  // 逆向 chunks/1635-5df1cbfb398b94c8.js (function h) 与 chunks/46097 (Firebase config)
  // 同源 fetch 自带 Origin/Referer, 扩展必须显式补齐, 否则 Cloudflare WAF 可能降级
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    Origin: urlOrigin,
    Referer: `${urlOrigin}/account/login`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
  // v17.42.3: 重构三路 — 道法自然·四路归一
  //   ① direct-auto: 不 _skipAutoProxy, 让 _httpsPost 自动感知 VSCode http.proxy / env / registry
  //      根治: 用户 VSCode 代理仅此路能感知 (env/registry 可能空, native CORS 永拒)
  //   ② proxy-explicit: _detectProxy → _httpsViaProxy CONNECT 隧道
  //   ③ direct-raw: _skipAutoProxy 硬直连 (网络对 windsurf.com 无阻时最快)
  //   ④ native: webview fetch (多数环境 CORS 会拒, 仅作末路)
  const channels = [
    {
      n: "direct-auto",
      fn: async () => {
        const r = await _httpsPost(url, payload, { timeout: 10000, headers });
        return { status: 200, text: JSON.stringify(r || {}) };
      },
    },
    {
      n: "proxy",
      fn: async () => {
        const proxy = await _detectProxy();
        if (!proxy) throw new Error("no_proxy");
        const r = await _httpsViaProxy(
          proxy.host,
          proxy.port,
          url,
          payload,
          10000,
          headers,
        );
        return { status: 200, text: JSON.stringify(r || {}) };
      },
    },
    {
      n: "direct-raw",
      fn: async () => {
        const r = await _httpsPost(url, payload, {
          timeout: 8000,
          headers,
          _skipAutoProxy: true,
        });
        return { status: 200, text: JSON.stringify(r || {}) };
      },
    },
    {
      n: "native",
      fn: async () => {
        const r = await _nativeFetch(url, {
          method: "POST",
          headers,
          body: payload,
          timeout: 12000,
        });
        if (typeof r.data !== "string") throw new Error("devin_native_no_data");
        return { status: r.status, text: r.data };
      },
    },
  ];
  // v17.42.3: 捕获每路错误到具名 map, 而非仅信 Promise.any.errors[0]
  const perCh = {};
  try {
    const result = await Promise.any(
      channels.map(({ n, fn }) =>
        fn()
          .then((r) => {
            let j = null;
            try {
              j = typeof r.text === "string" ? JSON.parse(r.text) : r.text;
            } catch {
              throw new Error("devin_parse_error");
            }
            if (j && j.token && j.user_id) {
              log(`_devinLogin ch[${n}]: OK`);
              return {
                ok: true,
                auth1Token: j.token,
                userId: j.user_id,
                email: j.email,
                viaChannel: n,
              };
            }
            // 200/401 但无 token: 密码错 / email 不存在 / 账号禁用 — 业务级 permanent 错
            // v17.42.3: 按网页源码 (chunks/1635 function h) 优先读 j.detail (windsurf.com 401 返回格式)
            const err =
              (j && (j.detail || j.error || j.message)) || "devin_no_token";
            throw new Error(err);
          })
          .catch((e) => {
            perCh[n] = (e && e.message) || String(e);
            throw e;
          }),
      ),
    );
    return result;
  } catch (aggErr) {
    for (const [n, m] of Object.entries(perCh))
      log(`_devinLogin ch[${n}]: ${m}`);
    // v17.42.3: 先挑业务级永久错 (INVALID/NOT_FOUND/USER_DISABLED 等 — 任一通道拿到)
    const permanentPat = /invalid|not[\s_-]?found|disabled|wrong|email/i;
    for (const [n, m] of Object.entries(perCh)) {
      if (permanentPat.test(m)) return { ok: false, error: m, viaChannel: n };
    }
    const combined = Object.entries(perCh)
      .map(([n, m]) => `${n}:${m}`)
      .join(" | ");
    return { ok: false, error: combined || "devin_all_failed" };
  }
}

// ── v17.5 Level 2: WindsurfPostAuth — auth1_token → sessionToken ──
// 背景: Windsurf IDE 原生接受 3 种 token 前缀: sk-ws-01- / devin-session-token$ / cog_
//       Devin 登录后拿到 auth1_token, 必须经 WindsurfPostAuth 换取 sessionToken (devin-session-token$ 前缀)
// 验证: POST /_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth
//       body: {auth1_token, org_id?}  →  {sessionToken, auth1Token, accountId, primaryOrgId}
function _getWindsurfPostAuthUrl() {
  return _cfg(
    "devin.postAuthUrl",
    "https://windsurf.com/_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth",
  );
}

async function _devinPostAuth(auth1Token, orgId) {
  const url = _getWindsurfPostAuthUrl();
  const urlOrigin = _deriveOrigin(url);
  const bodyObj = { auth1_token: auth1Token };
  if (orgId) bodyObj.org_id = orgId;
  const payload = JSON.stringify(bodyObj);
  const headers = {
    "Content-Type": "application/json",
    Origin: urlOrigin,
    Referer: `${urlOrigin}/profile`,
  };
  const channels = [
    async () => {
      const r = await _nativeFetch(url, {
        method: "POST",
        headers,
        body: payload,
        timeout: 12000,
      });
      if (typeof r.data !== "string")
        throw new Error("postauth_native_no_data");
      return { status: r.status, text: r.data };
    },
    async () => {
      const proxy = await _detectProxy();
      if (!proxy) throw new Error("no_proxy");
      const r = await _httpsViaProxy(
        proxy.host,
        proxy.port,
        url,
        payload,
        10000,
        headers,
      );
      return { status: 200, text: JSON.stringify(r || {}) };
    },
    async () => {
      // v17.35: _skipAutoProxy 确保 direct 通道真正直连 (windsurf.com 不需要代理)
      const r = await _httpsPost(url, payload, {
        timeout: 8000,
        headers,
        _skipAutoProxy: true,
      });
      return { status: 200, text: JSON.stringify(r || {}) };
    },
  ];
  try {
    const result = await Promise.any(
      channels.map((ch) =>
        ch().then((r) => {
          let j = null;
          try {
            j = typeof r.text === "string" ? JSON.parse(r.text) : r.text;
          } catch {
            throw new Error("postauth_parse_error");
          }
          if (
            j &&
            typeof j.sessionToken === "string" &&
            j.sessionToken.startsWith("devin-session-token$")
          ) {
            return {
              ok: true,
              sessionToken: j.sessionToken,
              auth1Token: j.auth1Token || auth1Token,
              accountId: j.accountId || "",
              primaryOrgId: j.primaryOrgId || "",
            };
          }
          const err =
            (j && (j.error || j.message || j.code)) || "postauth_no_session";
          throw new Error(err);
        }),
      ),
    );
    return result;
  } catch (aggErr) {
    const msg =
      (aggErr &&
        aggErr.errors &&
        aggErr.errors[0] &&
        aggErr.errors[0].message) ||
      String(aggErr && aggErr.message ? aggErr.message : aggErr);
    return { ok: false, error: msg };
  }
}

// ── v17.14 反者道之动 · Devin sessionToken 缓存 · 重复切号节省 ~3000ms ──
// 逆流推源: v17.13 实测 switch 5090ms = _devinFullSwitch(~3585ms) + injectAuth(~1505ms)
//           _devinLogin + _devinPostAuth 两次串行 HTTPS · 无缓存 · 每次切号重跑
// 唯变所适: 复用 Firebase _tokenCache 设计 · 缓存 Devin sessionToken
//           命中 → 跳过两阶 HTTPS · 直接 injectAuth · 总耗时压到 ~1500ms
// 持久化: 与 _tokenCache 一并 _saveTokenCache / _loadTokenCache · 跨会话有效
const _devinSessionCache = new Map(); // email → { sessionToken, auth1Token, accountId, primaryOrgId, userId, expiresAt }
let _devinCacheDirty = false;

function _getDevinCached(email) {
  const key = (email || "").toLowerCase();
  const c = _devinSessionCache.get(key);
  if (!c || !c.sessionToken) return null;
  if (c.expiresAt <= Date.now()) {
    _devinSessionCache.delete(key);
    _devinCacheDirty = true;
    return null;
  }
  return c;
}

function _setDevinCache(email, data) {
  const key = (email || "").toLowerCase();
  _devinSessionCache.set(key, {
    sessionToken: data.sessionToken,
    auth1Token: data.auth1Token || "",
    accountId: data.accountId || "",
    primaryOrgId: data.primaryOrgId || "",
    userId: data.userId || "",
    expiresAt: Date.now() + _getTokenCacheTtl(),
  });
  _devinCacheDirty = true;
}

function _invalidateDevinCache(email) {
  const key = (email || "").toLowerCase();
  if (_devinSessionCache.has(key)) {
    _devinSessionCache.delete(key);
    _devinCacheDirty = true;
  }
}

// ── v17.5 Level 2 + v17.14 Devin 缓存: 完整 Devin 切号流程 ──
// password → [cache HIT?] → _devinLogin(auth1_token) → _devinPostAuth(sessionToken) → injectAuth
// opts.forceRefresh=true: 跳过缓存强制重新登录 (用于 inject 失败后重试)
async function _devinFullSwitch(email, password, opts = {}) {
  // 缓存快速路径 (省去两次 HTTPS · ~3000ms)
  if (!opts.forceRefresh) {
    const cached = _getDevinCached(email);
    if (cached) {
      log(
        `devin: ⚡ session cache HIT ${email.substring(0, 20)} (节省 ~3000ms)`,
      );
      return {
        ok: true,
        sessionToken: cached.sessionToken,
        auth1Token: cached.auth1Token,
        accountId: cached.accountId,
        primaryOrgId: cached.primaryOrgId,
        userId: cached.userId,
        _fromCache: true,
      };
    }
  }
  // 冷路径: 完整两阶登录
  const dl = await _devinLogin(email, password);
  if (!dl.ok) return { ok: false, stage: "login", error: dl.error };
  const pa = await _devinPostAuth(dl.auth1Token);
  if (!pa.ok) return { ok: false, stage: "postauth", error: pa.error };
  const result = {
    ok: true,
    sessionToken: pa.sessionToken,
    auth1Token: pa.auth1Token,
    accountId: pa.accountId,
    primaryOrgId: pa.primaryOrgId,
    userId: dl.userId,
  };
  _setDevinCache(email, result);
  return result;
}

// ── v17.8 道法自然 · 真实数据通道 · 统一 fetchAccountQuota 入口 ──
// 历史: v17.7 _softEncodeDevinUsage 造假 (daily=100/weekly=100/plan='Devin'/planEnd=+365d) 违背道法 → 已彻底删除
// 现状: Firebase idToken 与 Devin sessionToken 共用同一 proto schema → fetchAccountQuota 内建 fallback
//       scanBackgroundQuota/verifyAndPurgeExpired/monitor/pool-tick 一视同仁 · 上层零差别
// 原则: 无为 (不造假) · 无不为 (真实数据自然流动)

// ── 获取缓存的idToken或重新登录 ──
async function getCachedToken(email, password) {
  const key = email.toLowerCase();
  const cached = _tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now())
    return { ok: true, idToken: cached.idToken };
  const loginResult = await firebaseLogin(email, password);
  if (!loginResult.ok) return loginResult;
  _tokenCache.set(key, {
    idToken: loginResult.idToken,
    expiresAt: Date.now() + _getTokenCacheTtl(),
  });
  _tokenCacheDirty = true;
  return loginResult;
}

// ── 获取账号实时额度 (Firebase登录→Relay→PlanStatus) ──
// 速率限制 — 每账号最少间隔10秒，429后退避60秒
const _quotaFetchCooldown = new Map(); // email → {nextAllowedTs}
// QUOTA_MIN_INTERVAL / QUOTA_429_BACKOFF → _getQuotaMinInterval() / _getQuota429Backoff() (v17.1 getter化)

// DoH解析relay真实IP (绕过Clash fake-ip DNS返回127.0.0.1的问题)
let _relayIPCache = { ip: null, ts: 0 };
// RELAY_IP_TTL → _getRelayIpTtl() (v17.1 getter化)

async function _resolveRelayIP() {
  const relayHost = _getRelayHost();
  if (!relayHost) return null; // relay未配置 → 跳过
  if (_relayIPCache.ip && Date.now() - _relayIPCache.ts < _getRelayIpTtl())
    return _relayIPCache.ip;
  // 方法1: DoH via proxy (dns.google)
  try {
    const proxy = await _detectProxy();
    if (proxy) {
      const dohResult = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("doh_timeout")),
          _getDohTimeoutMs(),
        );
        const connReq = http.request({
          host: proxy.host,
          port: proxy.port,
          method: "CONNECT",
          path: "dns.google:443",
          timeout: 5000,
        });
        connReq.on("connect", (res, socket) => {
          if (res.statusCode !== 200) {
            clearTimeout(timer);
            socket.destroy();
            reject(new Error("doh_proxy"));
            return;
          }
          const req = https.request(
            {
              socket,
              hostname: "dns.google",
              path: `/resolve?name=${relayHost}&type=A`,
              method: "GET",
              headers: { Host: "dns.google" },
              servername: "dns.google",
              rejectUnauthorized: false,
              timeout: 6000,
            },
            (resp) => {
              let d = "";
              resp.on("data", (c) => (d += c));
              resp.on("end", () => {
                clearTimeout(timer);
                try {
                  const j = JSON.parse(d);
                  // 过滤A记录(type=1), 跳过CNAME(type=5)等
                  if (j.Answer && Array.isArray(j.Answer)) {
                    const aRecords = j.Answer.filter(
                      (r) =>
                        r.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(r.data),
                    );
                    resolve(aRecords.length > 0 ? aRecords[0].data : null);
                  } else {
                    resolve(null);
                  }
                } catch {
                  resolve(null);
                }
              });
            },
          );
          req.on("error", (e) => {
            clearTimeout(timer);
            reject(e);
          });
          req.end();
        });
        connReq.on("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
        connReq.end();
      });
      // 正确处理CNAME链+多A记录 — 筛选真正的IPv4 A记录
      const resolvedIP = (() => {
        if (!dohResult) return null;
        // 如果直接返回的就是IP, 用它
        if (
          typeof dohResult === "string" &&
          /^\d+\.\d+\.\d+\.\d+$/.test(dohResult)
        )
          return dohResult;
        return null;
      })();
      if (resolvedIP) {
        _relayIPCache = { ip: resolvedIP, ts: Date.now() };
        log(`relay IP resolved via DoH: ${resolvedIP}`);
        return resolvedIP;
      }
    }
  } catch (e) {
    log(`DoH resolve err: ${e.message}`);
  }
  // Cloudflare DoH备用 (1.1.1.1 — 不依赖代理, 直连)
  try {
    const cfResult = await new Promise((cfResolve, cfReject) => {
      const timer = setTimeout(
        () => cfReject(new Error("cf_doh_timeout")),
        _getDohTimeoutMs(),
      );
      const req = https.request(
        {
          hostname: "1.1.1.1",
          path: `/dns-query?name=${relayHost}&type=A`,
          method: "GET",
          headers: {
            Accept: "application/dns-json",
            Host: "cloudflare-dns.com",
          },
          timeout: 5000,
          rejectUnauthorized: false,
        },
        (resp) => {
          let d = "";
          resp.on("data", (c) => (d += c));
          resp.on("end", () => {
            clearTimeout(timer);
            try {
              const j = JSON.parse(d);
              if (j.Answer && Array.isArray(j.Answer)) {
                const aRec = j.Answer.filter(
                  (r) => r.type === 1 && /^\d+\.\d+\.\d+\.\d+$/.test(r.data),
                );
                cfResolve(aRec.length > 0 ? aRec[0].data : null);
              } else cfResolve(null);
            } catch {
              cfResolve(null);
            }
          });
        },
      );
      req.on("error", (e) => {
        clearTimeout(timer);
        cfReject(e);
      });
      req.on("timeout", () => {
        req.destroy();
        clearTimeout(timer);
        cfReject(new Error("cf_timeout"));
      });
      req.end();
    });
    if (cfResult && /^\d+\.\d+\.\d+\.\d+$/.test(cfResult)) {
      _relayIPCache = { ip: cfResult, ts: Date.now() };
      log(`relay IP resolved via Cloudflare DoH: ${cfResult}`);
      return cfResult;
    }
  } catch (e) {
    log(`Cloudflare DoH err: ${e.message}`);
  }
  return _relayIPCache.ip; // 返回过期缓存总比没有好
}

async function fetchAccountQuota(email, password) {
  const key = email.toLowerCase();
  const now = Date.now();
  const cd = _quotaFetchCooldown.get(key);
  if (cd && now < cd.nextAllowedTs) {
    return {
      ok: false,
      error: "rate_limited",
      retryAfter: cd.nextAllowedTs - now,
    };
  }
  _quotaFetchCooldown.set(key, { nextAllowedTs: now + _getQuotaMinInterval() });

  // v17.40 道法自然 · 万法归宗 · Devin-first 直连本源 · 反者道之动
  // 背景: Cognition 全面迁移至 Devin · Firebase endpoint (identitytoolkit.googleapis.com) 实测不可达
  //       16s Firebase 超时 × 每账号 × 每次 fetchQuota = 整链僵死
  // 策略 (损之又损 · 无为而无不为):
  //   1. wam.preferDevinFirst=true (默认) → Devin 优先 · unset 账号直走 Devin · 跳 Firebase 超时
  //   2. 已明确 _authSystem=firebase 的账号 → 仍走 Firebase 优先 (legacy 尊重)
  //   3. 首次 Devin 成功 → 持久化 _authSystem=devin + _store.save() (v17.40 修复: 此前缺 save 导致重启丢失)
  //   4. Devin 失败 → Firebase 兜底 (水善利万物, 双路互为应急)
  //   5. GetPlanStatus 返回 "migrated" → 标记 devin + _store.save() (既有)
  const _firebaseTimeoutMs = _cfg("firebaseMaxTimeoutMs", 4000); // Firebase 整体超时上限 (Promise.any 协同 timeout)
  const _preferDevinFirst = _cfg("preferDevinFirst", true);
  let authToken = null;
  const acc = _store
    ? _store.accounts.find((a) => a.email.toLowerCase() === key)
    : null;
  const devinKnown = !!(acc && acc._authSystem === "devin");
  const firebaseLocked = !!(acc && acc._authSystem === "firebase"); // 明确标记 · 不被 override
  const goDevinFirst = devinKnown || (_preferDevinFirst && !firebaseLocked);

  // ── 首次 Devin 成功的持久化辅助 ──
  const _persistDevinMark = (ds) => {
    if (!acc) return;
    const wasDevin = acc._authSystem === "devin";
    acc._authSystem = "devin";
    acc._devinUserId = ds.userId || acc._devinUserId;
    acc._devinAccountId = ds.accountId || acc._devinAccountId;
    acc._devinOrgId = ds.primaryOrgId || acc._devinOrgId;
    acc._devinSessionAt = Date.now();
    acc._devinVerified = true;
    acc._lastVerified = Date.now();
    delete acc._verifyFailed;
    delete acc._verifyFailedAt;
    acc._verifyFailedCount = 0;
    delete acc._unverified;
    // v17.40 根治 · 持久化 (v17.35 此处缺失 → 每次重启丢失 devin 标记)
    if (!wasDevin) {
      try {
        _store.save();
        log(`fetchQuota: ${email} 🌊 首次标记 devin · 已持久化`);
      } catch (e) {
        log(`fetchQuota: ${email} devin 持久化失败 ${e.message}`);
      }
    }
  };
  // v17.42.5 反者道之动 · 认证本源化:
  //   删除"Devin 失败 → Firebase 成功 → 自动标记 firebase"路径
  //   原因: 该标记让账号下次落入 Firebase-first 轨道 (4s 超时浪费 · 偏离官网本源)
  //   新法: Firebase 仍作为当次 fallback, 但不做持久化标记
  //          账号 _authSystem 保持 undefined → 下次仍 Devin-first (符合 windsurf.com 官方路径)
  //          只有 Devin 链路全链路通才标记 devin (既有 _persistDevinMark)
  //          只有用户显式设置 _authSystem='firebase' 才走 Firebase-first (legacy opt-in)
  const _persistFirebaseMark = () => {
    // No-op · 保留 helper 以防回滚 · 不再自动标记
    // 用户显式标记仍通过 acc._authSystem='firebase' 设置 (不经此路径)
  };

  if (goDevinFirst) {
    // 主道: Devin 直连 (v17.40 新默认 · 实测 1-2s)
    const ds = await _devinFullSwitch(email, password);
    if (ds.ok) {
      authToken = ds.sessionToken;
      _persistDevinMark(ds);
      log(
        `fetchQuota: ${email} ${devinKnown ? "devin-known" : "devin-first"} sessionToken=${ds.sessionToken.substring(0, 30)}...`,
      );
    } else {
      // Devin 失败 → Firebase 兜底 (水善利万物 · 双路互备)
      log(
        `fetchQuota: ${email} Devin FAIL ${ds.stage}/${ds.error} — Firebase 兜底`,
      );
      const firebasePromise = getCachedToken(email, password);
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(
          () => rej(new Error("firebase_overall_timeout")),
          _firebaseTimeoutMs,
        ),
      );
      let loginResult;
      try {
        loginResult = await Promise.race([firebasePromise, timeoutPromise]);
      } catch (e) {
        loginResult = { ok: false, error: e.message };
      }
      if (!loginResult.ok) {
        log(
          `fetchQuota: ${email} 两路皆 FAIL · devin=${ds.error} firebase=${loginResult.error}`,
        );
        return {
          ok: false,
          error: `both_auth_failed: devin=${ds.error} firebase=${loginResult.error}`,
        };
      }
      authToken = loginResult.idToken;
      _persistFirebaseMark();
    }
  } else {
    // Legacy 通道: 明确 _authSystem=firebase 的账号走 Firebase 优先
    const firebasePromise = getCachedToken(email, password);
    const timeoutPromise = new Promise((_, rej) =>
      setTimeout(
        () => rej(new Error("firebase_overall_timeout")),
        _firebaseTimeoutMs,
      ),
    );
    let loginResult;
    try {
      loginResult = await Promise.race([firebasePromise, timeoutPromise]);
    } catch (e) {
      loginResult = { ok: false, error: e.message };
    }
    if (loginResult.ok) {
      authToken = loginResult.idToken;
    } else {
      _tokenCache.delete(key);
      const err = loginResult.error || "";
      log(`fetchQuota: ${email} Firebase FAIL(${err}) — Devin fallback`);
      const ds = await _devinFullSwitch(email, password);
      if (!ds.ok) {
        log(`fetchQuota: ${email} Devin FAIL ${ds.stage}/${ds.error}`);
        return { ok: false, error: `devin_${ds.stage}: ${ds.error}` };
      }
      authToken = ds.sessionToken;
      _persistDevinMark(ds); // v17.40 根治 · 持久化
      log(
        `fetchQuota: ${email} Devin OK sessionToken=${ds.sessionToken.substring(0, 30)}...`,
      );
    }
  }
  const proto = encodeProtoString(authToken);
  const relayHost = _getRelayHost();
  const planUrl = relayHost
    ? `https://${relayHost}/windsurf/plan-status`
    : null;

  // v15: 5通道竞速 — Chromium原生优先, 官方API直连次之, 中继兜底
  // 优先级: Chromium原生(万法归宗) > 官方(proxy) > 官方(direct) > Relay IP > Relay(proxy)
  // v17.34 道法自然 · 三官方通道统一加 Authorization: Bearer ${authToken}
  //                      API 期望 header auth · body proto 为 GetPlanStatusRequest · 二者皆需
  const _authHeaders = {
    "Content-Type": "application/proto",
    "connect-protocol-version": "1",
    Authorization: "Bearer " + authToken,
  };
  const channels = [
    // 通道0: Chromium原生 — 万法归宗 (系统代理自适应, 不依赖手动探测)
    async () => {
      for (const url of _getOfficialPlanStatusUrls()) {
        try {
          const resp = await _nativeFetch(url, {
            method: "POST",
            headers: _authHeaders,
            body: proto,
            binary: true,
            timeout: 10000,
          });
          if (resp.status === 200 && resp.data && resp.data.length > 20) {
            return { status: resp.status, buf: Buffer.from(resp.data) };
          }
        } catch {}
      }
      throw new Error("all_official_native_failed");
    },
    // 通道1: 官方API via proxy (最可靠: 官方服务器不限流WAM)
    async () => {
      const proxy = await _detectProxy();
      if (!proxy) throw new Error("no_proxy");
      for (const url of _getOfficialPlanStatusUrls()) {
        try {
          const resp = await _httpsPostRawViaProxy(
            proxy.host,
            proxy.port,
            url,
            proto,
            10000,
            { headers: { Authorization: "Bearer " + authToken } },
          );
          if (resp.status === 200 && resp.buf && resp.buf.length > 20)
            return resp;
        } catch {}
      }
      throw new Error("all_official_proxy_failed");
    },
    // 通道2: 官方API直连 (无proxy, 适合可直连Google Cloud的网络)
    // v17.35: _skipAutoProxy 确保真正直连 (server.codeium.com 可直达)
    async () => {
      for (const url of _getOfficialPlanStatusUrls()) {
        try {
          const resp = await _httpsPostRaw(url, proto, {
            timeout: 10000,
            headers: { Authorization: "Bearer " + authToken },
            _skipAutoProxy: true,
          });
          if (resp.status === 200 && resp.buf && resp.buf.length > 20)
            return resp;
        } catch {}
      }
      throw new Error("all_official_direct_failed");
    },
    // 通道3: Relay直连真实IP (DoH解析绕过fake-ip) — relay未配置时跳过
    async () => {
      if (!planUrl) throw new Error("relay_not_configured");
      const ip = await _resolveRelayIP();
      if (!ip) throw new Error("no_relay_ip");
      return _httpsPostRaw(planUrl, proto, { timeout: 12000, hostname: ip });
    },
    // 通道4: Relay via proxy (最后手段) — relay未配置时跳过
    async () => {
      if (!planUrl) throw new Error("relay_not_configured");
      const proxy = await _detectProxy();
      if (!proxy) throw new Error("no_proxy");
      return _httpsPostRawViaProxy(
        proxy.host,
        proxy.port,
        planUrl,
        proto,
        10000,
      );
    },
  ];

  log(`quota: ${channels.length}ch for ${email.substring(0, 15)}`);
  // 并行竞速 — 天下之至柔驰骋天下之至坚, 先到者胜
  const racePromises = channels.map((chFn, i) => {
    const chName = `ch${i + 1}`;
    return chFn()
      .then((resp) => {
        if (resp.status === 429) {
          _quotaFetchCooldown.set(key, {
            nextAllowedTs: Date.now() + _getQuota429Backoff(),
          });
          log(`${chName}: 429 → backoff ${_getQuota429Backoff() / 1000}s`);
          throw new Error("429");
        }
        if (resp.status === 200 && resp.buf && resp.buf.length > 50) {
          const q = parsePlanStatus(resp.buf);
          if (q) {
            _updateAccountUsage(email, q);
            log(
              `${chName}: OK D${q.daily} W${q.weekly}${q.planName ? " " + q.planName : ""}`,
            );
            return { ok: true, email, channel: chName, ...q };
          }
          log(`${chName}: parse fail ${resp.buf.length}B`);
        } else {
          // v17.35: detect "migrated" signal from backend
          const bodySniff = resp.buf
            ? resp.buf.toString("utf8", 0, Math.min(resp.buf.length, 300))
            : "";
          if (resp.status === 401 && bodySniff.includes("migrated")) {
            log(`${chName}: 401 MIGRATED`);
            throw new Error("account_migrated");
          }
          log(`${chName}: status=${resp.status} len=${resp.buf?.length || 0}`);
        }
        throw new Error(`${chName}_no_data`);
      })
      .catch((e) => {
        // v17.15 披褐怀玉: 业务错误 (relay_not_configured/no_relay_ip) 属用户配置 · 非代理故障
        // 旧代码每次都 log + invalidate proxy cache → proxy 5min TTL 失效 → 每 fetchQuota 重检
        // 新: 业务错误静默 · 仅真实网络/代理错误 invalidate
        const isBusinessErr =
          e.message === "relay_not_configured" || e.message === "no_relay_ip";
        if (!isBusinessErr) log(`${chName}: ${e.message}`);
        if (i === channels.length - 1 && !isBusinessErr)
          _invalidateProxyCache();
        throw e;
      });
  });
  try {
    return await Promise.any(racePromises);
  } catch (aggErr) {
    // v17.35: detect migration signal across all channels
    const isMigrated = (aggErr?.errors || []).some(
      (e) => e?.message === "account_migrated",
    );
    if (isMigrated && acc && acc._authSystem !== "devin") {
      acc._authSystem = "devin";
      _tokenCache.delete(key);
      _invalidateDevinCache(email);
      log(`fetchQuota: ${email} MIGRATED → marked devin · Devin路径下次生效`);
      _store.save();
    }
    return {
      ok: false,
      error: isMigrated ? "account_migrated" : "quota_fetch_failed",
    };
  }
}

// 将API获取到的额度写回账号对象
function _updateAccountUsage(email, quota) {
  if (!_store) return;
  const acc = _store.accounts.find(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  );
  if (!acc) return;
  const prev = acc.usage || {};
  const now = Date.now();

  // API提供的重置时间优先, 否则用计算值
  const apiDailyReset = quota.dailyResetUnix ? quota.dailyResetUnix * 1000 : 0;
  const apiWeeklyReset = quota.weeklyResetUnix
    ? quota.weeklyResetUnix * 1000
    : 0;
  const calcDailyReset = getNextDailyResetMs();
  const calcWeeklyReset = getNextWeeklyResetMs();

  // 始终信任API重置时间, 仅在API无值时用计算值兜底
  const effectiveWeeklyReset =
    apiWeeklyReset || calcWeeklyReset || prev.weeklyReset || 0;

  // weekly现在始终为0-100(proto3 absent=0), 不再有-1. 兜底保留旧值仅防极端情况
  const effectiveWeekly =
    quota.weekly >= 0
      ? quota.weekly
      : prev.weekly && typeof prev.weekly === "object"
        ? prev.weekly.remaining
        : typeof prev.weekly === "number"
          ? prev.weekly
          : 0;
  acc.usage = {
    daily: { remaining: quota.daily },
    weekly: { remaining: effectiveWeekly },
    // 道法自然: Free确定性不可被Trial覆写 — 已降级账号无法自我升级
    // 根因: API对降级账号仍返回"Trial"(planName字段滞后), 若直接覆写会破坏purge检测
    plan: (() => {
      const prevP = (prev.plan || "").toLowerCase();
      const newP = (quota.planName || "").toLowerCase();
      if (
        prevP === "free" &&
        (!newP || newP === "trial" || newP === "pro_trial")
      )
        return prev.plan; // Free不可逆: 保持Free, 忽略滞后Trial响应
      return quota.planName || prev.plan || "Trial";
    })(),
    // v16根因修复: 始终保留真实planEnd, 不再因有配额而清除过期planEnd
    // 旧逻辑"宽限期清除planEnd"导致缓存兜底无法检测到已转free账号
    planEnd: (() => {
      const pe = quota.planEndUnix ? quota.planEndUnix * 1000 : 0;
      return pe || prev.planEnd || 0;
    })(),
    planStart: (() => {
      const ps = quota.planStartUnix ? quota.planStartUnix * 1000 : 0;
      return ps || prev.planStart || 0;
    })(),
    // 重置时间: API值 > 计算值 > 旧值
    resetTime: apiDailyReset || calcDailyReset || prev.resetTime || 0,
    weeklyReset: effectiveWeeklyReset,
    lastChecked: now,
    // 额外追踪: credits数据 + 有效配额
    creditsUsed: quota.creditsUsed || prev.creditsUsed || 0,
    creditsTotal: quota.creditsTotal || prev.creditsTotal || 0,
    effective: Math.min(quota.daily, effectiveWeekly),
    // ═══ v17.42.4 · 本源真数据 (逆向 windsurf.com PlanStatus 18字段) ═══
    // TeamsTier enum (0-20) · 精确区分 PRO/DEVIN_PRO/TRIAL/DEVIN_TRIAL/FREE 等 21 种
    teamsTier:
      quota.teamsTier !== undefined && quota.teamsTier !== null
        ? quota.teamsTier
        : prev.teamsTier || 0,
    teamsTierName: quota.teamsTierName || prev.teamsTierName || null,
    // isDevin 标记 · 用于 UI 徽章 + 分支逻辑
    isDevin: quota.isDevin !== undefined ? !!quota.isDevin : !!prev.isDevin,
    hasPaidFeatures:
      quota.hasPaidFeatures !== undefined
        ? !!quota.hasPaidFeatures
        : !!prev.hasPaidFeatures,
    // Grace period 官方状态 (0=unspec 1=none 2=active 3=expired)
    gracePeriod:
      quota.gracePeriod !== undefined
        ? quota.gracePeriod
        : prev.gracePeriod || 0,
    gracePeriodEnd: quota.gracePeriodEndUnix
      ? quota.gracePeriodEndUnix * 1000
      : prev.gracePeriodEnd || 0,
    // Credits 三类 · 整数计数 · 直接对齐官方 UI 显示
    promptCredits: {
      used:
        typeof quota.promptUsed === "number"
          ? quota.promptUsed
          : (prev.promptCredits && prev.promptCredits.used) || 0,
      available:
        typeof quota.promptAvailable === "number"
          ? quota.promptAvailable
          : (prev.promptCredits && prev.promptCredits.available) || 0,
      monthly:
        typeof quota.promptMonthly === "number" && quota.promptMonthly > 0
          ? quota.promptMonthly
          : (prev.promptCredits && prev.promptCredits.monthly) || 0,
    },
    flowCredits: {
      used:
        typeof quota.flowUsed === "number"
          ? quota.flowUsed
          : (prev.flowCredits && prev.flowCredits.used) || 0,
      available:
        typeof quota.flowAvailable === "number"
          ? quota.flowAvailable
          : (prev.flowCredits && prev.flowCredits.available) || 0,
      monthly:
        typeof quota.flowMonthly === "number" && quota.flowMonthly > 0
          ? quota.flowMonthly
          : (prev.flowCredits && prev.flowCredits.monthly) || 0,
    },
    flexCredits: {
      used:
        typeof quota.flexUsed === "number"
          ? quota.flexUsed
          : (prev.flexCredits && prev.flexCredits.used) || 0,
      available:
        typeof quota.flexAvailable === "number"
          ? quota.flexAvailable
          : (prev.flexCredits && prev.flexCredits.available) || 0,
      monthly:
        typeof quota.flexMonthly === "number" && quota.flexMonthly > 0
          ? quota.flexMonthly
          : (prev.flexCredits && prev.flexCredits.monthly) || 0,
    },
    overageMicros:
      typeof quota.overageMicros === "number" ||
      typeof quota.overageMicros === "bigint"
        ? Number(quota.overageMicros)
        : prev.overageMicros || 0,
    topUp: {
      enabled:
        quota.topUpEnabled !== undefined
          ? !!quota.topUpEnabled
          : (prev.topUp && prev.topUp.enabled) || false,
      monthly:
        typeof quota.monthlyTopUp === "number"
          ? quota.monthlyTopUp
          : (prev.topUp && prev.topUp.monthly) || 0,
      spent:
        typeof quota.topUpSpent === "number"
          ? quota.topUpSpent
          : (prev.topUp && prev.topUp.spent) || 0,
      increment:
        typeof quota.topUpIncrement === "number"
          ? quota.topUpIncrement
          : (prev.topUp && prev.topUp.increment) || 0,
    },
    orphanReduce:
      quota.orphanReduce !== undefined
        ? !!quota.orphanReduce
        : !!prev.orphanReduce,
  };
}

// ── v17.13 反者道之动 · 命令注入三阶重构 ──────────────────────────
// 逆流推源: v14.3 的 P1(3s)+P2(4s死等) 是基于网络 RTT 的错误归因
//           executeCommand 是 IDE 内部调用 · 不经网络 · P50 ~ 5s
//           P1=3s 必 timeout → P2 延续死等 4s · 90% 切号浪费 1-4s
// 唯变所适: P1 超时改为 _injectAdaptive.getTimeoutMs() · 默认 8s · 学习后 p95×1.5
//           P2 死等彻底删除 (无新信息 · 零价值)
//           原 P3/P4 重命名为 P2/P3, 超时/重试延迟同走 _injectAdaptive
// 柔弱胜刚强: 成功分支 sample 实测耗时 · 系统自学收敛 · 用户零感知
async function injectAuth(idToken) {
  // 连续失败 3 次 → 重置命令缓存, 允许 Phase 3 尝试所有备选
  if (_consecutiveInjectFails >= 3 && _workingInjectCmd) {
    log(
      `inject: ⚠️ ${_consecutiveInjectFails}次连续失败 → 重置命令缓存 (was: ${_workingInjectCmd})`,
    );
    _workingInjectCmd = null;
  }
  const cmd = _workingInjectCmd || _getInjectCommands()[0];
  const t0 = Date.now();
  const adaptiveTimeout = _injectAdaptive.getTimeoutMs();
  let gotCode0 = false;

  // ── Phase 1 (原 P1+P2 合并): 主命令 · 自适应单次等待 ──
  // 超时 = 8000ms 默认, 学习后 = p95×1.5 clamp[3000,15000]
  //         P95 的网络慢场景自动放大, P50 的快场景超时也不会误触发
  log(`inject: p1 t=${adaptiveTimeout}ms [+${Date.now() - t0}ms]`);
  const cmdP = vscode.commands.executeCommand(cmd, idToken);
  try {
    const r1 = await Promise.race([
      cmdP,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("p1_timeout")), adaptiveTimeout),
      ),
    ]);
    const ex1 = _extractInjectResult(r1);
    if (ex1) {
      const latency = Date.now() - t0;
      _injectAdaptive.sample(latency); // 喂数据 · 系统自学
      _workingInjectCmd = cmd;
      log(
        `inject: OK p1 [${latency}ms] adaptive=${JSON.stringify(_injectAdaptive.snapshot())}`,
      );
      _lastSwitchTime = Date.now();
      _lastInjectFail = 0;
      _consecutiveInjectFails = 0;
      return ex1;
    }
    if (r1?.error?.code === 0) {
      gotCode0 = true;
      log(`inject: p1 code:0 [${Date.now() - t0}ms]`);
    } else {
      log(`inject: p1 unexpected [${Date.now() - t0}ms]`);
    }
  } catch {
    log(`inject: p1 ${adaptiveTimeout}ms超时 [${Date.now() - t0}ms]`);
  }

  // ── Phase 2 (原 P3): 新命令重试 · 自适应延迟 + 自适应超时 ──
  // retryDelay = 200ms 默认 (原 1000ms), 学习后 = p95×0.1 clamp[100,2000]
  //         IDE 极短喘息即可, 无需死等
  const retryDelay = _injectAdaptive.getRetryDelayMs();
  await new Promise((r) => setTimeout(r, retryDelay));
  log(
    `inject: p2 retry${gotCode0 ? " (code:0)" : " (timeout)"} delay=${retryDelay}ms t=${adaptiveTimeout}ms [+${Date.now() - t0}ms]`,
  );
  const retryP = vscode.commands.executeCommand(cmd, idToken);
  try {
    const r2 = await Promise.race([
      retryP,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("p2_timeout")), adaptiveTimeout),
      ),
    ]);
    const ex2 = _extractInjectResult(r2);
    if (ex2) {
      const latency = Date.now() - t0;
      _injectAdaptive.sample(latency); // 慢场景也喂数据 · 学习真实 p95
      _workingInjectCmd = cmd;
      log(`inject: OK p2 [${latency}ms]`);
      _lastSwitchTime = Date.now();
      _lastInjectFail = 0;
      _consecutiveInjectFails = 0;
      return ex2;
    }
    if (r2?.error?.code === 0) {
      log(`inject: p2 code:0 [${Date.now() - t0}ms] — 再次拒绝`);
    }
  } catch {
    log(`inject: p2 ${adaptiveTimeout}ms超时 [${Date.now() - t0}ms]`);
  }

  // ── Phase 3 (原 P4): 备选命令 · 连续失败/未确认时尝试所有备选 ──
  if (!_workingInjectCmd || _consecutiveInjectFails >= 2) {
    for (const altCmd of _getInjectCommands()) {
      if (altCmd === cmd) continue;
      log(
        `inject: p3 trying ${altCmd} t=${adaptiveTimeout}ms [+${Date.now() - t0}ms]`,
      );
      try {
        const altP = vscode.commands.executeCommand(altCmd, idToken);
        const r3 = await Promise.race([
          altP,
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("p3_timeout")), adaptiveTimeout),
          ),
        ]);
        const ex3 = _extractInjectResult(r3);
        if (ex3) {
          const latency = Date.now() - t0;
          _injectAdaptive.sample(latency);
          _workingInjectCmd = altCmd;
          log(`inject: OK p3 ${altCmd} [${latency}ms]`);
          _lastSwitchTime = Date.now();
          _lastInjectFail = 0;
          _consecutiveInjectFails = 0;
          return ex3;
        }
      } catch {
        log(`inject: p3 ${altCmd} failed [${Date.now() - t0}ms]`);
      }
    }
  }

  _consecutiveInjectFails++;
  log(
    `inject: failed [${Date.now() - t0}ms] (×${_consecutiveInjectFails}) — 五感模式: 保持现有会话, 不logout`,
  );
  return { ok: false, error: "inject failed (五感模式: 已保留现有会话)" };
}

// 提取注入结果的通用辅助 (避免重复代码)
function _extractInjectResult(result) {
  if (!result) return null;
  if (result.session) {
    const s = result.session;
    return {
      ok: true,
      account: s.account?.label || "?",
      apiKey: s.accessToken || "",
      sessionId: s.id || "",
    };
  }
  if (result.account && !result.error) {
    return {
      ok: true,
      account: result.account?.label || result.account || "?",
      apiKey: result.accessToken || "",
      sessionId: result.id || "",
    };
  }
  return null;
}

// ── Firebase accounts:lookup — 获取账号创建时间 (官方API) ──
async function firebaseLookup(idToken) {
  const payload = JSON.stringify({ idToken });
  for (const key of _getFirebaseKeys()) {
    const url = `https://${_getFirebaseHost()}/v1/accounts:lookup?key=${key}`;
    try {
      const result = await _httpsPost(url, payload, {
        timeout: 8000,
        headers: { Referer: _getFirebaseReferer() },
      });
      if (result?.users?.[0]) return result.users[0];
    } catch {}
    // 也尝试代理通道
    try {
      const proxy = await _detectProxy();
      if (proxy) {
        const url2 = `https://${_getFirebaseHost()}/v1/accounts:lookup?key=${key}`;
        const result = await _httpsViaProxy(
          proxy.host,
          proxy.port,
          url2,
          payload,
          10000,
          { Referer: _getFirebaseReferer() },
        );
        if (result?.users?.[0]) return result.users[0];
      }
    } catch {}
  }
  return null;
}

// ── v16: RegisterUser — 用idToken换apiKey (用于CheckChatCapacity) ──
async function _registerUser(idToken) {
  const body = encodeProtoString(idToken); // field 1 = idToken
  const channels = [
    () => _httpsPostRaw(_getRegisterUrl(), body, { timeout: 10000 }),
    async () => {
      const proxy = await _detectProxy();
      if (!proxy) throw new Error("no_proxy");
      return _httpsPostRawViaProxy(
        proxy.host,
        proxy.port,
        _getRegisterUrl(),
        body,
        10000,
      );
    },
  ];
  for (const ch of channels) {
    try {
      const resp = await ch();
      if (resp.status === 200 && resp.buf && resp.buf.length > 10) {
        const fields = parseProtoFields(resp.buf);
        if (fields.messages[1]) {
          const ak = fields.messages[1].toString("utf8").trim();
          if (ak.startsWith("sk-ws-")) return { ok: true, apiKey: ak };
        }
      }
    } catch {}
  }
  return { ok: false, error: "register_failed" };
}

// ── v16: CheckChatCapacity — 验证账号对Claude模型的实际访问权 ──
// 这是唯一可靠的Claude可用性信号: pro_trial→true, free/expired→false
// Proto: F1=metadata{F1=apiKey}, F2=modelUid
async function _checkClaudeCapacity(apiKey) {
  // 编码请求: metadata submsg + model string
  function _encVarIntBuf(v) {
    const b = [];
    while (v > 0x7f) {
      b.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    b.push(v);
    return Buffer.from(b);
  }
  function _encField(fieldNum, strOrBuf) {
    const data =
      typeof strOrBuf === "string" ? Buffer.from(strOrBuf, "utf8") : strOrBuf;
    const tag = _encVarIntBuf((fieldNum << 3) | 2);
    return Buffer.concat([tag, _encVarIntBuf(data.length), data]);
  }
  const metaBytes = _encField(1, apiKey); // metadata.field1 = apiKey
  const body = Buffer.concat([
    _encField(1, metaBytes),
    _encField(2, _getClaudeProbeModel()),
  ]);
  const channels = [
    () => _httpsPostRaw(_getChatCapacityUrl(), body, { timeout: 8000 }),
    async () => {
      const proxy = await _detectProxy();
      if (!proxy) throw new Error("no_proxy");
      return _httpsPostRawViaProxy(
        proxy.host,
        proxy.port,
        _getChatCapacityUrl(),
        body,
        8000,
      );
    },
  ];
  for (const ch of channels) {
    try {
      const resp = await ch();
      if (resp.status === 200 && resp.buf && resp.buf.length >= 2) {
        const fields = parseProtoFields(resp.buf);
        // F1 = has_capacity (varint bool), F2 = message (string)
        const hasCap = fields.varints[1];
        const msg =
          fields.messages && fields.messages[2]
            ? fields.messages[2].toString("utf8")
            : "";
        return { ok: true, hasCapacity: hasCap === 1, message: msg };
      }
    } catch {}
  }
  return { ok: false, error: "capacity_check_failed" };
}

// ── 判断账号是否真正过期(已被isClaudeAvailable取代用于清理决策) ──
// 反者道之动: planEnd过期→试用降级Free→Claude($$$)不可用
// 清理决策统一由isClaudeAvailable()判定, 此函数保留用于兼容
function isTrialExpired(createdAtMs, acc) {
  const planEnd = acc?.usage?.planEnd;
  if (planEnd && planEnd > 0) {
    return Date.now() > planEnd;
  }
  // 不再用createdAt猜测——官方Trial是14天而非90天, 且过期后仍可用
  return false;
}

// ── 批量验证 + 自动剔除 (官方Firebase机制) ──
async function verifyAndPurgeExpired(store, opts = {}) {
  if (_purgeRunning) {
    log("purge: already running");
    return { purged: 0 };
  }
  _purgeRunning = true;
  const silent = opts.silent || false;
  const toRemoveIndices = [];
  const reasons = {}; // index -> reason string
  const pwAccounts = [];

  for (let i = 0; i < store.accounts.length; i++) {
    if (store.accounts[i].password) pwAccounts.push(i);
  }

  log(`purge: verifying ${pwAccounts.length} accounts...`);
  if (!silent)
    broadcastMessage({
      type: "toast",
      text: `正在验证 ${pwAccounts.length} 个账号...`,
    });

  for (const i of pwAccounts) {
    const acc = store.accounts[i];
    if (!acc) continue;

    // v17.5 补完: Devin-only 账号跳过 Firebase, 走 Devin 全链路验证
    // 反者道之动: DEAD6 在 Firebase 侧永久 INVALID, 但 Devin 侧活 — 不可冤枉
    if (acc._authSystem === "devin") {
      try {
        const ds = await _devinFullSwitch(acc.email, acc.password);
        if (ds.ok) {
          acc._lastVerified = Date.now();
          acc._devinUserId = ds.userId;
          acc._devinAccountId = ds.accountId;
          acc._devinOrgId = ds.primaryOrgId;
          acc._devinSessionAt = Date.now();
          acc._devinVerified = true;
          delete acc._unverified;
          delete acc._verifyFailed;
          delete acc._verifyFailedAt;
          acc._verifyFailedCount = 0;
          if (store && typeof store.save === "function") store.save();
          // v17.8 道法自然: 触发 fetchAccountQuota — 真实 plan 自动写回 acc.usage
          await fetchAccountQuota(acc.email, acc.password).catch(() => {});
          if (store && typeof store.save === "function") store.save();
          log(
            `purge: ${acc.email} → DEVIN✓ (userId=${(ds.userId || "").substring(0, 16)}... accountId=${(ds.accountId || "").substring(0, 16)}...) ${ds.ms}ms`,
          );
        } else {
          // v17.42.14: 网络/代理错误 → skip 保留不冤枉 (道法自然·不冤枉)
          //   与 Firebase 路径一致: 永久业务错才归档, 网络抖动/死代理不杀号
          //   根因: 179机器 127.0.0.1:7799 死代理导致全部4通道失败 → 10号被误判devin_dead归档
          //   永久业务错特征: invalid / not_found / disabled / wrong / email / unauthorized
          //   网络错特征: ECONNREFUSED / ETIMEDOUT / socket / Failed to fetch / proxy / no_proxy
          const errStr = (ds.error || ds.stage || "").toString();
          const permanentDevinPat =
            /invalid|not[\s_-]?found|disabled|wrong|email|credentials|unauthorized/i;
          if (permanentDevinPat.test(errStr)) {
            toRemoveIndices.push(i);
            reasons[i] = `devin_dead: ${ds.stage || "login"}/${ds.error}`;
            log(
              `purge: ${acc.email} → DEVIN DEAD (永久错: ${errStr.slice(0, 120)})`,
            );
          } else {
            log(
              `purge: ${acc.email} → DEVIN skip (网络/代理错误: ${errStr.slice(0, 120)}), 保留不冤枉`,
            );
          }
        }
      } catch (devinErr) {
        log(
          `purge: ${acc.email} → DEVIN skip (${devinErr.message}), 保留不冤枉`,
        );
      }
      // v17.9 软编码: purge 每账号间延迟可通过 wam.purgeDelayMs 覆盖
      await new Promise((r) => setTimeout(r, _getPurgeDelayMs()));
      continue;
    }

    // Step 1: Firebase登录验证
    const loginResult = await firebaseLogin(acc.email, acc.password);

    if (!loginResult.ok) {
      const err = loginResult.error || "";
      // 永久性错误 → 标记移除
      if (/INVALID|NOT_FOUND|DISABLED|WRONG/.test(err)) {
        toRemoveIndices.push(i);
        reasons[i] = `login_dead: ${err}`;
        log(`purge: ${acc.email} → DEAD (${err})`);
        continue;
      }
      // 网络/临时错误 → 跳过 (不冤枉)
      log(`purge: ${acc.email} → skip (${err})`);
      continue;
    }

    // Step 2: 用idToken查询账号元信息 (官方Firebase lookup)
    const userInfo = await firebaseLookup(loginResult.idToken);
    if (userInfo) {
      const createdAt = Number(userInfo.createdAt || 0);
      const ageDays = createdAt ? (Date.now() - createdAt) / 86400000 : 0;

      // 写回信息到账号对象
      acc._firebaseCreatedAt = createdAt;
      acc._firebaseDisplayName = userInfo.displayName || "";
      acc._lastVerified = Date.now();

      if (userInfo.disabled) {
        toRemoveIndices.push(i);
        reasons[i] = "account_disabled";
        log(`purge: ${acc.email} → DISABLED`);
        continue;
      }

      log(`purge: ${acc.email} → login OK (${ageDays.toFixed(1)}d)`);
    }

    // Step 2.5: 深度探测 — 获取实时Plan状态, 不信缓存只信API
    // v16根因修复: 显式验证前清除速率限制冷却, 确保获取新鲜数据(非限流缓存)
    if (!toRemoveIndices.includes(i)) {
      _quotaFetchCooldown.delete(acc.email.toLowerCase()); // 强制绕过冷却期
      const _prePlan = (acc.usage?.plan || "").toLowerCase(); // 探测前快照: 防API覆写
      try {
        const quota = await fetchAccountQuota(acc.email, acc.password);
        if (quota.ok) {
          const freshPlan = (quota.planName || "").toLowerCase();
          const freshPlanEnd = quota.planEndUnix ? quota.planEndUnix * 1000 : 0;
          const isExpired = freshPlanEnd > 0 && Date.now() > freshPlanEnd;
          const daysExpired = isExpired
            ? (Date.now() - freshPlanEnd) / 86400000
            : 0;

          // Case 1: 实时plan是free → 无Claude($$$)权限 → 清理
          if (freshPlan === "free") {
            toRemoveIndices.push(i);
            reasons[i] =
              `probe_free: plan=free, D${quota.daily}W${quota.weekly}仅限免费模型, Claude不可用`;
            log(
              `purge: ${acc.email} → FREE (实时探测: plan=${freshPlan}, D${quota.daily}W${quota.weekly})`,
            );
          }
          // Case 2: 试用过期且无配额 → 清理
          else if (
            isExpired &&
            isTrialPlan(freshPlan) &&
            quota.daily === 0 &&
            quota.weekly === 0
          ) {
            toRemoveIndices.push(i);
            reasons[i] =
              `expired_trial_no_quota: plan=${freshPlan}过期${daysExpired.toFixed(1)}天且D0/W0, Claude不可用`;
            log(
              `purge: ${acc.email} → EXPIRED+D0W0 ${daysExpired.toFixed(1)}d (plan=${freshPlan}, end=${new Date(freshPlanEnd).toISOString().slice(0, 10)})`,
            );
          }
          // Case 2b: 试用过期但有配额 → 实证表明已转free, Claude不可用 → 清理
          // v16根因修复: 旧代码错误保留(认为是宽限期), 实测证明trial过期后Claude立即失效
          else if (isExpired && isTrialPlan(freshPlan)) {
            toRemoveIndices.push(i);
            reasons[i] =
              `expired_trial_with_quota: plan=${freshPlan}过期${daysExpired.toFixed(1)}天已转free, D${quota.daily}W${quota.weekly}仅限免费模型`;
            log(
              `purge: ${acc.email} → EXPIRED→FREE (plan=${freshPlan} expired ${daysExpired.toFixed(1)}d, D${quota.daily}W${quota.weekly}, Claude不可用)`,
            );
          }
          // Case 3: plan未知或未确认 → 调用CheckChatCapacity进行地检
          else {
            // v16 根本修复: GetPlanStatus无法可靠判断Claude可用性(试用转free后plan仍显示Trial)
            // 唯一可靠信号: CheckChatCapacity直接测试模型访问权
            let claudeOk = true; // 默认保留
            try {
              const regResult = await _registerUser(loginResult.idToken);
              if (regResult.ok) {
                const capResult = await _checkClaudeCapacity(regResult.apiKey);
                if (capResult.ok) {
                  claudeOk = capResult.hasCapacity;
                  if (!claudeOk) {
                    toRemoveIndices.push(i);
                    reasons[i] =
                      `claude_no_capacity: ${_getClaudeProbeModel()}不可用(${capResult.message || "no_capacity"}), plan=${freshPlan} D${quota.daily}W${quota.weekly}`;
                    log(
                      `purge: ${acc.email} → NO_CLAUDE (capacity=false: ${capResult.message}), plan=${freshPlan} D${quota.daily}W${quota.weekly}`,
                    );
                  } else {
                    log(
                      `purge: ${acc.email} → CLAUDE✓ (capacity=true, plan=${freshPlan} D${quota.daily}W${quota.weekly})`,
                    );
                  }
                } else {
                  if (_prePlan === "free") {
                    toRemoveIndices.push(i);
                    reasons[i] =
                      `cap_fail_free: pre_plan=free, check_failed=${capResult.error}`;
                    log(
                      `purge: ${acc.email} → FREE (cap_check_failed+pre_plan=free)`,
                    );
                  } else {
                    log(
                      `purge: ${acc.email} → CLAUDE✓ (capacity_check_failed: ${capResult.error}, 保留)`,
                    );
                  }
                }
              } else {
                if (_prePlan === "free") {
                  toRemoveIndices.push(i);
                  reasons[i] =
                    `register_fail_free: pre_plan=free, register_failed=${regResult.error}`;
                  log(
                    `purge: ${acc.email} → FREE (register_failed+pre_plan=free)`,
                  );
                } else {
                  log(
                    `purge: ${acc.email} → CLAUDE✓ (register_failed: ${regResult.error}, plan=${freshPlan} D${quota.daily}W${quota.weekly}, 保留)`,
                  );
                }
              }
            } catch (e2) {
              if (_prePlan === "free") {
                toRemoveIndices.push(i);
                reasons[i] = `probe_err_free: pre_plan=free, err=${e2.message}`;
                log(
                  `purge: ${acc.email} → FREE (capacity_probe_error+pre_plan=free)`,
                );
              } else {
                log(
                  `purge: ${acc.email} → CLAUDE✓ (capacity_probe_error: ${e2.message}, 保留)`,
                );
              }
            }
          }
        } else {
          if (_prePlan === "free") {
            toRemoveIndices.push(i);
            reasons[i] =
              `probe_fail_free: pre_plan=free, probe_failed=${quota.error}`;
            log(`purge: ${acc.email} → FREE (probe_failed+pre_plan=free)`);
          } else {
            log(
              `purge: ${acc.email} → probe failed: ${quota.error} (保留, 不冤枉)`,
            );
          }
        }
      } catch (e) {
        if (_prePlan === "free") {
          toRemoveIndices.push(i);
          reasons[i] = `exception_free: pre_plan=free, err=${e.message}`;
          log(`purge: ${acc.email} → FREE (exception+pre_plan=free)`);
        } else {
          log(`purge: ${acc.email} → probe error: ${e.message} (保留, 不冤枉)`);
        }
      }
    }

    // 限速保护
    await new Promise((r) => setTimeout(r, 300));
  }

  // Step 3: 缓存兜底 — 深度探测可能遗漏的(网络失败等), 用缓存数据补刀
  for (let i = 0; i < store.accounts.length; i++) {
    if (toRemoveIndices.includes(i)) continue;
    const acc = store.accounts[i];
    // v17.5 补完: Devin 账号已在 Step 0 验证过, 不受 Firebase 缓存误杀
    if (acc._authSystem === "devin") continue;
    const h = store.getHealth(acc);
    if (!acc.password) {
      // 无密码账号: 无法Firebase验证, 仅凭缓存判断 — 道法自然: 已知plan=free即清理
      if (h.checked && (h.plan || "").toLowerCase() === "free") {
        toRemoveIndices.push(i);
        reasons[i] = `no_pw_free: 无密码+缓存plan=free, Claude不可用`;
        log(`purge: ${acc.email} → NO_PW_FREE (缓存兜底)`);
      }
      continue;
    }

    // 缓存plan是free → 清理
    if ((h.plan || "").toLowerCase() === "free") {
      toRemoveIndices.push(i);
      reasons[i] = "cached_free: 缓存plan=free, Claude不可用";
      log(`purge: ${acc.email} → FREE (缓存兜底)`);
      continue;
    }

    // v16: 缓存planEnd已过期 + 试用计划 → 清理(无论配额多少, trial过期即转free)
    if (h.planEnd > 0 && h.daysLeft <= 0 && isTrialPlan(h.plan)) {
      toRemoveIndices.push(i);
      reasons[i] =
        `cached_expired_no_quota: plan=${h.plan}过期${Math.abs(h.daysLeft).toFixed(1)}天且D0/W0, Claude不可用`;
      log(
        `purge: ${acc.email} → EXPIRED+D0W0 (缓存兜底: plan=${h.plan}, daysLeft=${h.daysLeft})`,
      );
    }
  }

  // 执行移除 — 归档而非永久删除，保障可恢复
  let purgedCount = 0;
  if (toRemoveIndices.length > 0) {
    const archived = [];
    const sorted = [...toRemoveIndices].sort((a, b) => b - a);
    for (const idx of sorted) {
      const acc = store.accounts[idx];
      if (!acc) continue;
      log(`purge: archiving [${idx}] ${acc.email} — ${reasons[idx]}`);
      archived.push({
        ...acc,
        _purgeReason: reasons[idx],
        _purgedAt: Date.now(),
      });
      store.accounts.splice(idx, 1);
      if (store.activeIndex === idx) store.activeIndex = -1;
      else if (store.activeIndex > idx) store.activeIndex--;
      purgedCount++;
    }
    // 写入归档文件 (追加模式，永不丢失)
    _archivePurged(store, archived);
    store.save();
    // 道法自然: 封印save()回流 — 归档后直接擦除磁盘上的死号(包括save()遍历_mergeFromDisk可能回写的)
    _cleanPurgedFromDisk(store);
  }

  _purgeRunning = false;
  _lastPurgeTime = Date.now();

  const rv = Object.values(reasons);
  const loginDead = rv.filter((r) => r.startsWith("login_dead")).length;
  const disabled = rv.filter((r) => r === "account_disabled").length;
  const probeFree = rv.filter(
    (r) => r.startsWith("probe_free") || r.startsWith("cached_free"),
  ).length;
  const expiredTrial = rv.filter(
    (r) => r.startsWith("expired_trial") || r.startsWith("cached_expired"),
  ).length;
  const msg = `验证完成: ${pwAccounts.length}个账号, 剔除${purgedCount}个 (${loginDead}登录失败, ${disabled}禁用, ${probeFree}Free无Claude, ${expiredTrial}试用过期)`;
  log(`purge: ${msg}`);
  if (!silent) {
    _notifyInfo(`WAM: ${msg}`, "user");
    refreshAll();
  }

  return { purged: purgedCount, total: pwAccounts.length, reasons };
}

// ── 归档被清理的账号 (追加写入，可恢复) ──
// 道法自然: 归档后对两个磁盘文件做二次清理, 防_mergeFromDisk回流
// 反者道之动: save()可能把已归档账号写回磁盘, 此函数直接擦除
function _cleanPurgedFromDisk(store) {
  try {
    const archPath = path.join(path.dirname(store._path), "_wam_purged.json");
    if (!fs.existsSync(archPath)) return;
    const purgedArr = JSON.parse(fs.readFileSync(archPath, "utf8"));
    if (!Array.isArray(purgedArr) || purgedArr.length === 0) return;
    const bl = new Set(purgedArr.map((a) => (a.email || "").toLowerCase()));
    // 同步清理内存: 防止_mergeFromDisk回流后的内存污染再次写入磁盘
    const memBefore = store.accounts.length;
    store.accounts = store.accounts.filter((a) => {
      const e = (a.email || "").toLowerCase();
      if (bl.has(e)) return false;
      if (((a.usage && a.usage.plan) || "").toLowerCase() === "free")
        return false;
      return true;
    });
    if (store.accounts.length < memBefore)
      log(
        `purge: mem_clean: ${memBefore}→${store.accounts.length} (-${memBefore - store.accounts.length})`,
      );
    // 同步清理两个磁盘文件
    const targets = [store._path, store._sharedPath].filter(Boolean);
    for (const p of targets) {
      try {
        if (!fs.existsSync(p)) continue;
        const accs = JSON.parse(fs.readFileSync(p, "utf8"));
        if (!Array.isArray(accs)) continue;
        const cleaned = accs.filter((a) => {
          const e = (a.email || "").toLowerCase();
          if (bl.has(e)) return false;
          if (((a.usage && a.usage.plan) || "").toLowerCase() === "free")
            return false;
          return true;
        });
        if (cleaned.length < accs.length) {
          fs.writeFileSync(p, JSON.stringify(cleaned, null, 2), "utf8");
          log(
            `purge: disk_clean ${p.split(/[\\/]/).pop()}: ${accs.length}→${cleaned.length} (-${accs.length - cleaned.length})`,
          );
        }
      } catch {}
    }
    // 内存+磁盘双清后再保存一次, 确保磁盘与内存同步且干净
    try {
      fs.writeFileSync(
        store._path,
        JSON.stringify(store.accounts, null, 2),
        "utf8",
      );
    } catch {}
    try {
      if (store._sharedPath)
        fs.writeFileSync(
          store._sharedPath,
          JSON.stringify(store.accounts, null, 2),
          "utf8",
        );
    } catch {}
  } catch (e) {
    log(`purge: disk_clean error: ${e.message}`);
  }
}

function _archivePurged(store, archived) {
  try {
    const archivePath = path.join(
      path.dirname(store._path),
      "_wam_purged.json",
    );
    let existing = [];
    try {
      existing = JSON.parse(fs.readFileSync(archivePath, "utf8"));
    } catch {}
    if (!Array.isArray(existing)) existing = [];
    existing.push(...archived);
    fs.writeFileSync(archivePath, JSON.stringify(existing, null, 2), "utf8");
    log(`purge: archived ${archived.length} accounts to ${archivePath}`);
  } catch (e) {
    log(`purge archive error: ${e.message}`);
  }
}

// _syncToAllUsers removed — 不再跨用户写入文件

// ── 完整切号流程 (v8.0 — 道法自然: 预热快速路径 + 无感热替换) ──
// 切号分两条路径:
//   快速路径: 预热Token命中 → 跳过Firebase登录 → 直接注入 (目标<3s)
//   标准路径: Firebase登录 → 注入 (目标<10s, 替代旧版26s)
async function switchToAccount(email, password) {
  log(`switch: ${email}`);
  const t0 = Date.now();
  const emailKey = email.toLowerCase();

  // ── v17.5 Level 2: Devin-only 账号 → 完整 Devin 链路 (跳过 Firebase) ──
  // 账号 _authSystem='devin' 由 verify-gate / pool-tick / clearBlacklist 命令预先标记
  // 流程: password → auth1_token (devinLogin) → sessionToken (WindsurfPostAuth) → injectAuth
  const _devinAccIdx = _store
    ? _store.accounts.findIndex((a) => a.email.toLowerCase() === emailKey)
    : -1;
  const _devinAcc = _devinAccIdx >= 0 ? _store.accounts[_devinAccIdx] : null;
  if (_devinAcc && _devinAcc._authSystem === "devin") {
    log(`switch: ${email} → Devin-only 链路`);
    const ds = await _devinFullSwitch(email, password);
    if (!ds.ok) {
      log(
        `switch FAIL (devin-${ds.stage}): ${ds.error} [${Date.now() - t0}ms]`,
      );
      return {
        ok: false,
        error: `Devin 切号失败 [${ds.stage}]: ${ds.error}`,
        ms: Date.now() - t0,
      };
    }
    // 持久化最新 Devin 元数据 — v17.5 补完+: 附加验证时戳 + 标记
    _devinAcc._devinUserId = ds.userId;
    _devinAcc._devinAccountId = ds.accountId;
    _devinAcc._devinOrgId = ds.primaryOrgId;
    _devinAcc._devinSessionAt = Date.now();
    _devinAcc._devinVerified = true;
    _devinAcc._lastVerified = Date.now();
    // v17.8 道法自然: switch 成功 → 异步 fetchAccountQuota (不阻塞切号)
    fetchAccountQuota(_devinAcc.email, _devinAcc.password)
      .then(() => {
        try {
          _store.save();
          refreshAll();
        } catch {}
      })
      .catch(() => {});
    try {
      _store.save();
    } catch {}
    // 注入 sessionToken (Windsurf IDE 原生接受 devin-session-token$ 前缀)
    const injectResult = await injectAuth(ds.sessionToken);
    const ms = Date.now() - t0;
    if (!injectResult.ok) {
      const injErrD = String(injectResult.error || "");
      // inject 失败 → 失效 Devin 缓存 (可能 sessionToken 已过期)
      _invalidateDevinCache(email);
      log(
        `switch FAIL inject (devin): ${JSON.stringify(injectResult.error)} [${ms}ms] · cache 已失效`,
      );
      // v17.42.9 知人者智 (Devin-only 分支本源归档): inject code:0 = Windsurf 内部 auth 拒绝
      // 与 L6102-6151 Firebase 路径同构 · 镜像 login fail 归档 (L6047-6081) · 3 次 → archive
      // _devinAcc / _devinAccIdx 上文已就绪 (L5842-5845) · 直接复用
      if (_devinAccIdx >= 0 && _devinAcc) {
        _devinAcc._injectFailed = injErrD;
        _devinAcc._injectFailedAt = Date.now();
        _devinAcc._injectFailedCount = (_devinAcc._injectFailedCount || 0) + 1;
        if (_devinAcc._injectFailedCount >= 3) {
          log(
            `switch: archiving inject-dead account [${_devinAccIdx}] ${email} (devin) — Windsurf auth 风控拒绝×${_devinAcc._injectFailedCount}`,
          );
          _archivePurged(_store, [
            {
              ..._devinAcc,
              _purgeReason: `inject_dead_after_retries: ${injErrD}`,
              _purgedAt: Date.now(),
            },
          ]);
          _store.remove(_devinAccIdx);
          _notifyWarn(
            `WAM: 已归档 ${email} (Windsurf 内部 auth 拒绝×3 · Devin-only)，可用 "WAM: 从归档恢复" 找回`,
            "auto",
          );
        } else {
          log(
            `switch: ${email} (devin) inject 拒绝 ${_devinAcc._injectFailedCount}/3, 保留`,
          );
          _store.save();
        }
      }
      return {
        ok: false,
        error: `Devin 注入失败: ${JSON.stringify(injectResult.error)}`,
        ms,
      };
    }
    log(
      `switch OK (devin): ${injectResult.account} accountId=${ds.accountId.substring(0, 16)}... ${ms}ms`,
    );
    // v17.42.9: inject OK 清 inject-dead 标记 (Devin-only 分支)
    if (_devinAccIdx >= 0 && _devinAcc && _devinAcc._injectFailedCount > 0) {
      delete _devinAcc._injectFailed;
      delete _devinAcc._injectFailedAt;
      _devinAcc._injectFailedCount = 0;
      try {
        _store.save();
      } catch {}
    }
    _lastSwitchTime = Date.now();
    _writeInstanceClaim(email);
    try {
      fs.mkdirSync(WAM_DIR, { recursive: true });
      fs.writeFileSync(
        RESULT_FILE,
        JSON.stringify({
          ok: true,
          ts: Date.now(),
          email,
          account: injectResult.account,
          apiKey: (injectResult.apiKey || "").substring(0, 25) + "...",
          sessionId: injectResult.sessionId,
          _authSystem: "devin",
          _devinAccountId: ds.accountId,
        }),
      );
    } catch {}
    return {
      ok: true,
      account: injectResult.account,
      apiKey: injectResult.apiKey,
      ms,
      _authSystem: "devin",
    };
  }

  // ── 快速路径: 检查预热Token缓存 (道法自然: 弹药已备好, 一触即发) ──
  let idToken = null;
  if (
    _prewarmedToken &&
    _prewarmedToken.email === emailKey &&
    Date.now() - _prewarmedToken.ts < _getTokenCacheTtl()
  ) {
    idToken = _prewarmedToken.idToken;
    log(
      `switch: ⚡ pre-warmed token HIT (${Math.round((Date.now() - _prewarmedToken.ts) / 1000)}s old) [${Date.now() - t0}ms]`,
    );
    _prewarmedToken = null; // 一次性消费
  }

  // ── 标准路径: 检查通用Token缓存 ──
  if (!idToken) {
    const cached = _tokenCache.get(emailKey);
    if (cached && cached.expiresAt > Date.now()) {
      idToken = cached.idToken;
      log(`switch: token cache HIT [${Date.now() - t0}ms]`);
    }
  }

  // ── 兜底路径: Firebase登录 ──
  if (!idToken) {
    const loginResult = await firebaseLogin(email, password);
    if (!loginResult.ok) {
      const err = loginResult.error || "";
      log(`switch FAIL login: ${err} [${Date.now() - t0}ms]`);
      // 登录失败反馈到poolFailStreak → getBestIndex自动避开此号
      if (/all_channels_failed/.test(err)) {
        const fs0 = _poolFailStreak.get(emailKey) || { count: 0, lastFail: 0 };
        fs0.count++;
        fs0.lastFail = Date.now();
        _poolFailStreak.set(emailKey, fs0);
      }
      if (/INVALID|NOT_FOUND|DISABLED|WRONG/.test(err)) {
        // v17.5 Level 2: Firebase INVALID 先试 Devin 完整链路
        // 反者道之动: 新 Devin-only 账号首次切号即能识别并成功, 不必等 verify-gate 慢预热
        try {
          const ds = await _devinFullSwitch(email, password);
          if (ds.ok) {
            log(
              `switch: ${email} Firebase INVALID 但 Devin 成功 (accountId=${(ds.accountId || "").substring(0, 16)}...) — 标记并注入`,
            );
            const idx2 = _store?.accounts.findIndex(
              (a) => a.email.toLowerCase() === emailKey,
            );
            if (idx2 >= 0) {
              const acc2 = _store.accounts[idx2];
              acc2._authSystem = "devin";
              acc2._devinUserId = ds.userId;
              acc2._devinAccountId = ds.accountId;
              acc2._devinOrgId = ds.primaryOrgId;
              acc2._devinSessionAt = Date.now();
              acc2._devinDetectedAt = Date.now();
              // v17.5 补完+: 打验证标记, 供 getHealth/getBestIndex/UI 识别
              acc2._devinVerified = true;
              acc2._lastVerified = Date.now();
              delete acc2._verifyFailed;
              delete acc2._verifyFailedAt;
              acc2._verifyFailedCount = 0;
              delete acc2._switchFailed;
              delete acc2._switchFailedAt;
              acc2._switchFailedCount = 0;
              // v17.8 道法自然: 异步 fetchAccountQuota 拿真实 plan (不阻塞注入)
              fetchAccountQuota(acc2.email, acc2.password)
                .then(() => {
                  try {
                    _store.save();
                    refreshAll();
                  } catch {}
                })
                .catch(() => {});
              try {
                _store.save();
              } catch {}
            }
            const inj = await injectAuth(ds.sessionToken);
            const ms2 = Date.now() - t0;
            if (!inj.ok) {
              log(
                `switch FAIL inject (devin-fallback): ${JSON.stringify(inj.error)} [${ms2}ms]`,
              );
              return {
                ok: false,
                error: `Devin 注入失败: ${JSON.stringify(inj.error)}`,
                ms: ms2,
              };
            }
            log(
              `switch OK (devin-fallback): ${inj.account} ${ms2}ms — 账号已标记 _authSystem=devin`,
            );
            _lastSwitchTime = Date.now();
            _writeInstanceClaim(email);
            try {
              fs.mkdirSync(WAM_DIR, { recursive: true });
              fs.writeFileSync(
                RESULT_FILE,
                JSON.stringify({
                  ok: true,
                  ts: Date.now(),
                  email,
                  account: inj.account,
                  apiKey: (inj.apiKey || "").substring(0, 25) + "...",
                  sessionId: inj.sessionId,
                  _authSystem: "devin",
                  _devinAccountId: ds.accountId,
                }),
              );
            } catch {}
            return {
              ok: true,
              account: inj.account,
              apiKey: inj.apiKey,
              ms: ms2,
              _authSystem: "devin",
            };
          }
        } catch (de) {
          log(`switch: Devin fallback 探测异常 ${email} (${de.message || de})`);
        }
        // v17.3 道法自然: switchToAccount 第二处死刑也需缓冲 (与 verify-gate 一致)
        // 反者道之动: 单次失败不归档, 连续3次才归档 — 给网络/限流/暂时同步留机会
        const idx = _store?.accounts.findIndex(
          (a) => a.email.toLowerCase() === emailKey,
        );
        if (idx >= 0) {
          const deadAcc = _store.accounts[idx];
          deadAcc._switchFailed = err;
          deadAcc._switchFailedAt = Date.now();
          deadAcc._switchFailedCount = (deadAcc._switchFailedCount || 0) + 1;
          if (deadAcc._switchFailedCount >= 3) {
            log(
              `switch: archiving dead account [${idx}] ${email} (${err}) 连续${deadAcc._switchFailedCount}次`,
            );
            _archivePurged(_store, [
              {
                ...deadAcc,
                _purgeReason: `switch_dead_after_retries: ${err}`,
                _purgedAt: Date.now(),
              },
            ]);
            _store.remove(idx);
            _notifyWarn(
              `WAM: 已归档无效账号 ${email} (${err})连续3次，可用 "WAM: 从归档恢复" 找回`,
              "fatal",
            );
          } else {
            log(
              `switch: ${email} 登录失败 ${deadAcc._switchFailedCount}/3 (${err}), 保留`,
            );
            _store.save();
            _notifyWarn(
              `WAM: ${email} 登录失败 ${deadAcc._switchFailedCount}/3 (${err}) — 保留池中`,
              "auto",
            );
          }
        }
      }
      return {
        ok: false,
        error: `登录失败: ${err}`,
        ms: Date.now() - t0,
        permanent: /INVALID|NOT_FOUND|DISABLED|WRONG/.test(err),
      };
    }
    idToken = loginResult.idToken;
    _tokenCache.set(emailKey, {
      idToken,
      expiresAt: Date.now() + _getTokenCacheTtl(),
    });
    _tokenCacheDirty = true;
    _saveTokenCache();
    log(
      `switch: login OK via ${loginResult.channel} (${idToken.length}ch) [${Date.now() - t0}ms]`,
    );
  }

  // ── 注入 (v8: 无感热替换, 不中断对话) ──
  const injectResult = await injectAuth(idToken);
  const ms = Date.now() - t0;
  if (!injectResult.ok) {
    const injErr = String(injectResult.error || "");
    log(`switch FAIL inject: ${JSON.stringify(injectResult.error)} [${ms}ms]`);

    // v17.42.9 知人者智 · 以神遇不以目视: inject code:0 非 provider 忙 (忙→timeout)
    //   而是 Windsurf 内部 auth 对 idToken 风控拒绝 (同一 token 重试必同果)
    //   镜像 login fail 归档机制 (L6047-6081) · 3 次 inject fail → archive
    //   保 token cache (token 本身有效) · 仅 account 下架
    const idxI = _store?.accounts.findIndex(
      (a) => a.email.toLowerCase() === emailKey,
    );
    if (idxI >= 0) {
      const deadAcc = _store.accounts[idxI];
      deadAcc._injectFailed = injErr;
      deadAcc._injectFailedAt = Date.now();
      deadAcc._injectFailedCount = (deadAcc._injectFailedCount || 0) + 1;
      if (deadAcc._injectFailedCount >= 3) {
        log(
          `switch: archiving inject-dead account [${idxI}] ${email} — Windsurf auth 风控拒绝×${deadAcc._injectFailedCount}`,
        );
        _archivePurged(_store, [
          {
            ...deadAcc,
            _purgeReason: `inject_dead_after_retries: ${injErr}`,
            _purgedAt: Date.now(),
          },
        ]);
        _store.remove(idxI);
        _notifyWarn(
          `WAM: 已归档 ${email} (Windsurf 内部 auth 拒绝×3)，可用 "WAM: 从归档恢复" 找回`,
          "auto",
        );
      } else {
        log(
          `switch: ${email} inject 拒绝 ${deadAcc._injectFailedCount}/3, 保留`,
        );
        _store.save();
      }
    }

    // 注入失败不清除token缓存 — token有效, 是auth provider忙
    // 仅当token确实过期(>50min)时自然淘汰, 避免无谓重新登录
    return {
      ok: false,
      error: `注入失败: ${JSON.stringify(injectResult.error)}`,
      ms,
    };
  }
  log(
    `switch OK: ${injectResult.account} apiKey=${(injectResult.apiKey || "").substring(0, 20)}... ${ms}ms`,
  );
  _lastSwitchTime = Date.now();
  // v17.42.9: inject OK 清 inject-dead 标记 (镜像 L5985-5987 _switchFailed 清)
  const idxOk = _store?.accounts.findIndex(
    (a) => a.email.toLowerCase() === emailKey,
  );
  if (idxOk >= 0) {
    const accOk = _store.accounts[idxOk];
    if (accOk._injectFailedCount > 0) {
      delete accOk._injectFailed;
      delete accOk._injectFailedAt;
      accOk._injectFailedCount = 0;
      _store.save();
    }
  }
  _writeInstanceClaim(email);
  try {
    fs.mkdirSync(WAM_DIR, { recursive: true });
    fs.writeFileSync(
      RESULT_FILE,
      JSON.stringify({
        ok: true,
        ts: Date.now(),
        email,
        account: injectResult.account,
        apiKey: (injectResult.apiKey || "").substring(0, 25) + "...",
        sessionId: injectResult.sessionId,
      }),
    );
  } catch {}
  return {
    ok: true,
    account: injectResult.account,
    apiKey: injectResult.apiKey,
    ms,
  };
}

// ── v11: Token池预热引擎 — 天下之至柔，驰骋天下之至坚 ──
// v8原版只预热1个候选 → v11预热top 3候选, 任一命中即<1s切号
// v17.16 秒切引擎: Devin 账号预热 sessionToken · 切号 Devin cache HIT → 1300ms
//   逆流本源: 切号耗时 = token准备 + inject · cache HIT 时 token准备=0 · 只剩 inject
//   无为而无不为: 预热失败不阻塞 · 异步后台 · 切号时自然 cache HIT
async function _prewarmCandidateToken(candidateIndex) {
  if (candidateIndex < 0 || !_store) return;
  const acc = _store.get(candidateIndex);
  if (!acc || !acc.password) return;
  const emailKey = acc.email.toLowerCase();

  // v17.16 Devin 分支: 秒切引擎 · 预热 sessionToken 覆盖 _devinSessionCache
  if (acc._authSystem === "devin") {
    const devinCached = _getDevinCached(emailKey);
    if (devinCached) {
      log(
        `🔥 prewarm: ${acc.email.substring(0, 20)} Devin session cached (expires ${Math.round((devinCached.expiresAt - Date.now()) / 60000)}min)`,
      );
      _prewarmPool(candidateIndex).catch(() => {});
      return;
    }
    // 冷启: 后台填充 Devin cache · 下次切号即 HIT (跳过 3000ms HTTPS 往返)
    log(`🔥 prewarm: firing Devin for ${acc.email.substring(0, 20)}...`);
    try {
      const r = await _devinFullSwitch(acc.email, acc.password);
      if (r.ok) {
        log(
          `🔥 prewarm: Devin OK for ${acc.email.substring(0, 20)} (sessionToken cached · 秒切就绪)`,
        );
      } else {
        log(
          `🔥 prewarm: Devin FAIL for ${acc.email.substring(0, 20)}: ${r.stage}/${r.error}`,
        );
      }
    } catch (e) {
      log(
        `🔥 prewarm: Devin error ${acc.email.substring(0, 20)}: ${e.message}`,
      );
    }
    _prewarmPool(candidateIndex).catch(() => {});
    return;
  }

  // 如果已有有效缓存, 不重复预热
  const cached = _tokenCache.get(emailKey);
  if (cached && cached.expiresAt > Date.now() + 300000) {
    // 至少还有5分钟有效期
    _prewarmedToken = {
      email: emailKey,
      idToken: cached.idToken,
      ts: cached.expiresAt - _getTokenCacheTtl(),
    };
    log(`🔥 prewarm: ${acc.email.substring(0, 20)} already cached`);
    // v11: 即使主候选已缓存, 仍异步预热额外候选
    _prewarmPool(candidateIndex).catch(() => {});
    return;
  }

  // 后台异步获取 (不阻塞主流程)
  try {
    log(`🔥 prewarm: firing for ${acc.email.substring(0, 20)}...`);
    const loginResult = await firebaseLogin(acc.email, acc.password);
    if (loginResult.ok) {
      _prewarmedToken = {
        email: emailKey,
        idToken: loginResult.idToken,
        ts: Date.now(),
      };
      _tokenCache.set(emailKey, {
        idToken: loginResult.idToken,
        expiresAt: Date.now() + _getTokenCacheTtl(),
      });
      _tokenCacheDirty = true;
      log(
        `🔥 prewarm: OK for ${acc.email.substring(0, 20)} (${loginResult.idToken.length}ch)`,
      );
    } else {
      log(
        `🔥 prewarm: FAIL for ${acc.email.substring(0, 20)}: ${loginResult.error}`,
      );
    }
  } catch (e) {
    log(`🔥 prewarm: error ${acc.email.substring(0, 20)}: ${e.message}`);
  }
  // v11: 主候选预热后, 异步预热额外候选池
  _prewarmPool(candidateIndex).catch(() => {});
}

// v11: 池预热 — 异步预热top 2-3候选进_tokenCache (不设_prewarmedToken, 仅缓存)
async function _prewarmPool(excludeIndex) {
  if (!_store) return;
  const poolSize = 2; // 额外预热2个候选
  let warmed = 0;
  // 从最佳候选开始, 跳过excludeIndex和已缓存的
  let searchFrom = excludeIndex;
  for (let i = 0; i < poolSize; i++) {
    const nextI = _store.getBestIndex(searchFrom, true);
    if (nextI < 0 || nextI === excludeIndex) break;
    const nextAcc = _store.get(nextI);
    if (!nextAcc || !nextAcc.password) {
      searchFrom = nextI;
      continue;
    }
    const ek = nextAcc.email.toLowerCase();
    const existing = _tokenCache.get(ek);
    if (existing && existing.expiresAt > Date.now() + 300000) {
      searchFrom = nextI;
      continue; // 已有有效缓存
    }
    try {
      const lr = await firebaseLogin(nextAcc.email, nextAcc.password);
      if (lr.ok) {
        _tokenCache.set(ek, {
          idToken: lr.idToken,
          expiresAt: Date.now() + _getTokenCacheTtl(),
        });
        _tokenCacheDirty = true;
        warmed++;
        log(`🔥 pool: +${nextAcc.email.substring(0, 20)}`);
      }
    } catch {}
    searchFrom = nextI;
  }
  if (warmed > 0) log(`🔥 pool: ${warmed} extra tokens cached`);
}

// ── v12: 永续Token活水池 — 上善如水·水善利万物而有静 ──
// 核心: 后台持续刷新ALL账号的Token缓存, 像活水流淌不息
// 效果: 任意手动切号 → 必然cache HIT → 跳过3-4s Firebase登录 → inject-only切号
// 节奏: N个账号/50分钟TTL → 每~(50*60/N)秒刷新1个 → CPU近零·网络极低
// 道法自然: 水不等溃堤才流, Token不等切号才取 — 始终备好, 一触即发
// TOKEN_POOL_* / POOL_* 常量 → getter化 (v17.1 去芜留菁)
let _tokenPoolStartTs = 0; // 活水池启动时间
let _tokenPoolTickCount = 0; // v13: pool自己的tick计数器
const _tokenPoolBlacklist = new Set(); // 永久失败账号 (INVALID_PASSWORD等)
const _poolFailStreak = new Map(); // email -> {count, lastFail} 连续网络失败计数

async function _tokenPoolTick() {
  if (!_store || _switching || !isWamMode()) return;
  const accounts = _store.accounts;
  if (!accounts || accounts.length === 0) return;

  // v13: 收集所有需要刷新的候选, 按紧急度排序, 取top N并行获取
  const candidates = [];
  let totalCached = 0;
  let totalWithPw = 0;
  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    if (!acc || !acc.password) continue;
    totalWithPw++;
    const ek = acc.email.toLowerCase();
    if (_tokenPoolBlacklist.has(ek)) continue;
    // 连续网络失败临时拉黑 — 有静·水善利万物而有静
    const streak = _poolFailStreak.get(ek);
    if (
      streak &&
      streak.count >= _getPoolTempBanThreshold() &&
      Date.now() - streak.lastFail < _getPoolTempBanDuration()
    )
      continue;
    if (
      streak &&
      streak.count >= _getPoolTempBanThreshold() &&
      Date.now() - streak.lastFail >= _getPoolTempBanDuration()
    )
      _poolFailStreak.delete(ek); // 解禁
    // v17.16 秒切引擎: Devin-only 账号走 sessionToken 缓存路径 · 不再 continue
    //   逆流本源: 让 Devin 账号也永远 cache HIT · 切号 ~1300ms
    const isDevin = acc._authSystem === "devin";
    const cached = isDevin ? _getDevinCached(ek) : _tokenCache.get(ek);
    if (cached && cached.expiresAt > Date.now()) totalCached++;
    let urgency = 0;
    if (!cached || cached.expiresAt <= Date.now()) {
      urgency = 3; // 无缓存或已过期: 最紧急
    } else if (cached.expiresAt < Date.now() + _getTokenPoolMargin()) {
      urgency = 2; // 即将过期: 紧急
    } else if (cached.expiresAt < Date.now() + _getTokenCacheTtl() * 0.6) {
      urgency = 1; // 已过半: 低优先
    } else {
      continue; // 充足
    }
    candidates.push({
      idx: i,
      urgency,
      exp: cached ? cached.expiresAt : 0,
      isDevin,
    });
  }

  _tokenPoolTickCount++;
  // v13: pool自己的周期报告 (每10 ticks或填满时)
  const isBurstPhase =
    Date.now() - _tokenPoolStartTs < _getTokenPoolBurstDuration();
  if (
    _tokenPoolTickCount % 10 === 0 ||
    _tokenPoolTickCount <= 3 ||
    totalCached === totalWithPw
  ) {
    log(
      `🔥 pool: ${totalCached}/${totalWithPw} cached, bl=${_tokenPoolBlacklist.size}, tick#${_tokenPoolTickCount} ${isBurstPhase ? "BURST" : "cruise"}`,
    );
  }

  if (candidates.length === 0) return; // 所有Token充足

  // 按紧急度降序, 同紧急度按过期时间升序
  candidates.sort((a, b) => b.urgency - a.urgency || a.exp - b.exp);

  // v13: 冲刺期多路并发, 巡航期单路 — 上善如水, 水善利万物而有静
  const isBurst = Date.now() - _tokenPoolStartTs < _getTokenPoolBurstDuration();
  const parallel = isBurst ? _getPoolParallelBurst() : _getPoolParallelCruise();
  const batch = candidates.slice(0, parallel);

  await Promise.allSettled(
    batch.map(async ({ idx, isDevin }) => {
      if (_switching) return;
      const acc = accounts[idx];
      const ek = acc.email.toLowerCase();
      // v17.16 秒切引擎: Devin 账号走 sessionToken 预热 · 切号 cache HIT → 1300ms
      if (isDevin) {
        try {
          const r = await _devinFullSwitch(acc.email, acc.password);
          if (r.ok) {
            _poolFailStreak.delete(ek);
            // v17.37: 补全 Devin 元数据 — 无此则 getBestIndex 因 _unverified+!_devinVerified 跳过
            acc._devinVerified = true;
            acc._lastVerified = Date.now();
            acc._devinSessionAt = Date.now();
            if (r.accountId) acc._devinAccountId = r.accountId;
            if (r.primaryOrgId) acc._devinOrgId = r.primaryOrgId;
            if (r.userId) acc._devinUserId = r.userId;
            delete acc._unverified;
            log(`🔥 pool: +${acc.email.substring(0, 20)} (Devin sessionToken)`);
          } else {
            const fs0 = _poolFailStreak.get(ek) || { count: 0, lastFail: 0 };
            fs0.count++;
            fs0.lastFail = Date.now();
            _poolFailStreak.set(ek, fs0);
            log(
              `🔥 pool: Devin fail ${acc.email.substring(0, 20)} (${r.stage}/${r.error}) [×${fs0.count}]`,
            );
          }
        } catch (e) {
          log(
            `🔥 pool: Devin threw ${acc.email.substring(0, 20)} (${e.message || e})`,
          );
        }
        return;
      }
      try {
        const lr = await firebaseLogin(acc.email, acc.password);
        if (lr.ok) {
          _tokenCache.set(ek, {
            idToken: lr.idToken,
            expiresAt: Date.now() + _getTokenCacheTtl(),
          });
          _tokenCacheDirty = true;
          _poolFailStreak.delete(ek); // 成功则清除失败计数
          if (idx === _predictiveCandidate) {
            _prewarmedToken = {
              email: ek,
              idToken: lr.idToken,
              ts: Date.now(),
            };
          }
        } else {
          // v13: 记录失败原因 (以前静默吞掉 → 池为什么不填无从诊断)
          if (/INVALID|NOT_FOUND|DISABLED|WRONG/.test(lr.error || "")) {
            // 拉黑前探测 Devin-only — 道法自然·不让 Devin 账号永久殉葬
            // v17.37: 升级为 _devinFullSwitch 全链路验证 + 补全 _devinVerified 元数据
            try {
              const dv = await _devinFullSwitch(acc.email, acc.password);
              if (dv.ok) {
                acc._authSystem = "devin";
                acc._devinUserId = dv.userId;
                acc._devinDetectedAt = Date.now();
                acc._devinSessionAt = Date.now();
                acc._devinVerified = true;
                acc._lastVerified = Date.now();
                if (dv.accountId) acc._devinAccountId = dv.accountId;
                if (dv.primaryOrgId) acc._devinOrgId = dv.primaryOrgId;
                delete acc._unverified;
                delete acc._verifyFailed;
                delete acc._verifyFailedAt;
                acc._verifyFailedCount = 0;
                if (_store && typeof _store.save === "function") _store.save();
                log(
                  `🔥 pool: ${acc.email.substring(0, 20)} Devin 全链路通 (accountId=${(dv.accountId || "").substring(0, 16)}...) — 已标记+验证`,
                );
                return; // 跳过拉黑
              }
            } catch {}
            _tokenPoolBlacklist.add(ek);
            log(
              `🔥 pool: blacklisted ${acc.email.substring(0, 20)} (${lr.error})`,
            );
          } else {
            // 连续网络失败计数 — 多言数穷不如守中
            const fs0 = _poolFailStreak.get(ek) || { count: 0, lastFail: 0 };
            fs0.count++;
            fs0.lastFail = Date.now();
            _poolFailStreak.set(ek, fs0);
            if (fs0.count === _getPoolTempBanThreshold()) {
              log(
                `🔥 pool: temp-ban ${acc.email.substring(0, 20)} (×${fs0.count} consecutive fails, ${_getPoolTempBanDuration() / 60000}min)`,
              );
            } else {
              log(
                `🔥 pool: login fail ${acc.email.substring(0, 20)} (${lr.error || "unknown"}) [×${fs0.count}]`,
              );
            }
          }
        }
      } catch (e) {
        log(
          `🔥 pool: login threw ${acc.email.substring(0, 20)} (${e.message || e})`,
        );
      }
    }),
  );
  // 每个tick结束后持久化缓存到磁盘
  _saveTokenCache();
}

// v13.1 + v17.14: Token 缓存持久化 (idToken + devinSession 双 bucket)
// 文件 schema: 兼容旧版纯扁平 idToken map, 以及新版 { _v: 2, idTokens: {...}, devinSessions: {...} }
function _loadTokenCache() {
  try {
    const raw = fs.readFileSync(TOKEN_CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    let loadedIdToken = 0;
    let loadedDevin = 0;
    const now = Date.now();
    // v2 新格式 (包含 devinSessions)
    if (parsed && typeof parsed === "object" && parsed._v === 2) {
      const idTokens = parsed.idTokens || {};
      for (const [email, data] of Object.entries(idTokens)) {
        if (data && data.expiresAt > now && data.idToken) {
          _tokenCache.set(email, data);
          loadedIdToken++;
        }
      }
      const devinSessions = parsed.devinSessions || {};
      for (const [email, data] of Object.entries(devinSessions)) {
        if (data && data.expiresAt > now && data.sessionToken) {
          _devinSessionCache.set(email, data);
          loadedDevin++;
        }
      }
    } else {
      // v1 旧格式 (扁平 idToken map) · 保持兼容
      for (const [email, data] of Object.entries(parsed)) {
        if (data && data.expiresAt > now && data.idToken) {
          _tokenCache.set(email, data);
          loadedIdToken++;
        }
      }
    }
    if (loadedIdToken > 0 || loadedDevin > 0) {
      log(
        `🔥 pool: loaded ${loadedIdToken} idTokens + ${loadedDevin} devin sessions from disk (survive restart)`,
      );
      _tokenPoolStartTs = Date.now() - _getTokenPoolBurstDuration();
    }
  } catch {}
}

function _saveTokenCache() {
  if (!_tokenCacheDirty && !_devinCacheDirty) return;
  try {
    const idTokens = {};
    for (const [k, v] of _tokenCache) idTokens[k] = v;
    const devinSessions = {};
    for (const [k, v] of _devinSessionCache) devinSessions[k] = v;
    const obj = { _v: 2, idTokens, devinSessions };
    fs.mkdirSync(WAM_DIR, { recursive: true });
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(obj));
    _tokenCacheDirty = false;
    _devinCacheDirty = false;
  } catch {}
}

// ── v17.10 太上·不知有之: autoUpdate 自动推送新版本 (各扩展无感接收后续之新法) ──
// 源支持: SMB/本地路径 (\\host\share\bundle 或 D:\...) · HTTPS URL
// 流程: 读远端 package.json → 对比版本 → 下载 extension.js + package.json → 备份 → 原子 rename
// 安全: source 默认空 · 用户必须显式配置才启用 · 默认静默 · 备份可回滚
// 道法自然 · 无为而无不为 · 太上不知有之
let _autoUpdateTimer = null;
let _autoUpdateLastCheck = 0;
let _autoUpdateLastResult = null;

function _compareVersions(a, b) {
  // 返回 >0 if a>b, <0 if a<b, 0 if equal · 按 semver 三段式
  const pa = String(a || "")
    .split(/[.-]/)
    .map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "")
    .split(/[.-]/)
    .map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function _autoUpdateJoinPath(source, filename) {
  const isHttp = /^https?:\/\//i.test(source);
  if (isHttp) {
    return source.endsWith("/") ? source + filename : source + "/" + filename;
  }
  // 本地/SMB 路径: 用 path.join 规范化
  return path.join(source, filename);
}

// v17.17 公网天网: jsDelivr 四镜像故障转移 · DNS 污染自感知所规避
// China DNS 偶将 cdn.jsdelivr.net 污染至 8.7.198.46 (失效 IP) · fastly/gcore/testingcf 均通
// 顺序: 用户 source 优先 → 同域名 → 其他镜像 (切换无感·打一次成功即返)
const _JSDELIVR_MIRRORS = [
  "cdn.jsdelivr.net",
  "fastly.jsdelivr.net",
  "gcore.jsdelivr.net",
  "testingcf.jsdelivr.net",
];
function _expandJsdelivrSources(source) {
  // 非 HTTP 或非 jsDelivr 域名 → 原样返回 (不扩展)
  const m = source.match(/^(https?):\/\/([^/]+)(\/.*)?$/i);
  if (!m) return [source];
  const proto = m[1];
  const host = m[2].toLowerCase();
  const rest = m[3] || "/";
  if (!_JSDELIVR_MIRRORS.includes(host)) return [source];
  // 当前域名优先 · 其他镜像作 fallback
  const ordered = [host, ..._JSDELIVR_MIRRORS.filter((h) => h !== host)];
  return ordered.map((h) => `${proto}://${h}${rest}`);
}

// v17.14 公网闭环: 支持 301/302/307/308 重定向 (GitHub Releases `/latest/download/` 依赖 302)
async function _autoUpdateHttpGet(url, asBuffer = false, redirectCount = 0) {
  const MAX_REDIRECTS = 5;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, (resp) => {
      const status = resp.statusCode || 0;
      // 重定向
      if ([301, 302, 303, 307, 308].includes(status) && resp.headers.location) {
        resp.resume(); // 丢弃 body
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error(`HTTP redirect loop > ${MAX_REDIRECTS}`));
          return;
        }
        const next = new URL(resp.headers.location, url).toString();
        log(`autoUpdate: ${status} redirect → ${next.substring(0, 80)}`);
        _autoUpdateHttpGet(next, asBuffer, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }
      if (status >= 400) {
        reject(new Error(`HTTP ${status}`));
        resp.resume();
        return;
      }
      const chunks = [];
      resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve(asBuffer ? buf : buf.toString("utf8"));
      });
      resp.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("HTTP timeout"));
    });
  });
}

// jsDelivr 镜像 fallback · 对 jsDelivr 域名源自动展开多个镜像顺次尝试·其他 source (SMB/非 jsDelivr HTTPS) 原样返回
async function _autoUpdateFetchTextHttp(source, filename) {
  const candidates = _expandJsdelivrSources(source);
  let lastErr;
  for (let i = 0; i < candidates.length; i++) {
    const src = candidates[i];
    try {
      const text = await _autoUpdateHttpGet(
        _autoUpdateJoinPath(src, filename),
        false,
      );
      if (candidates.length > 1 && i > 0) {
        try {
          log(`autoUpdate: fallback ok via ${new URL(src).host} (${filename})`);
        } catch {}
      }
      return text;
    } catch (e) {
      lastErr = e;
      if (candidates.length > 1) {
        try {
          log(
            `autoUpdate: ${new URL(src).host} fail ${(e && e.message ? e.message : String(e)).split("\n")[0].substring(0, 80)}`,
          );
        } catch {}
      }
    }
  }
  throw lastErr || new Error("all jsDelivr mirrors failed");
}
async function _autoUpdateFetchBytesHttp(source, filename) {
  const candidates = _expandJsdelivrSources(source);
  let lastErr;
  for (let i = 0; i < candidates.length; i++) {
    const src = candidates[i];
    try {
      const buf = await _autoUpdateHttpGet(
        _autoUpdateJoinPath(src, filename),
        true,
      );
      if (candidates.length > 1 && i > 0) {
        try {
          log(`autoUpdate: fallback ok via ${new URL(src).host} (${filename})`);
        } catch {}
      }
      return buf;
    } catch (e) {
      lastErr = e;
      if (candidates.length > 1) {
        try {
          log(
            `autoUpdate: ${new URL(src).host} fail ${(e && e.message ? e.message : String(e)).split("\n")[0].substring(0, 80)}`,
          );
        } catch {}
      }
    }
  }
  throw lastErr || new Error("all jsDelivr mirrors failed");
}

async function _autoUpdateReadJson(source, filename) {
  const isHttp = /^https?:\/\//i.test(source);
  if (isHttp) {
    const text = await _autoUpdateFetchTextHttp(source, filename);
    return JSON.parse(text);
  }
  // SMB/本地: Node.js fs.readFileSync 原生支持 \\host\share\path
  const full = _autoUpdateJoinPath(source, filename);
  const raw = fs.readFileSync(full, "utf8");
  // 去除 UTF-8 BOM
  const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(clean);
}

async function _autoUpdateReadBytes(source, filename) {
  const isHttp = /^https?:\/\//i.test(source);
  if (isHttp) {
    return await _autoUpdateFetchBytesHttp(source, filename);
  }
  const full = _autoUpdateJoinPath(source, filename);
  return fs.readFileSync(full);
}

async function _autoUpdateCheck(manual = false) {
  try {
    if (!_getAutoUpdateEnabled() && !manual) {
      return { ok: false, reason: "disabled" };
    }
    const source = _getAutoUpdateSource();
    if (!source) {
      return { ok: false, reason: "no_source" };
    }
    _autoUpdateLastCheck = Date.now();
    log(`autoUpdate: 检查 ${source}`);

    // Step 1: 读远端 package.json 拿版本号
    const remotePkg = await _autoUpdateReadJson(source, "package.json");
    if (!remotePkg || !remotePkg.version) {
      _autoUpdateLastResult = { ok: false, reason: "remote_no_version" };
      return _autoUpdateLastResult;
    }
    const localVer = WAM_VERSION;
    const remoteVer = remotePkg.version;
    const cmp = _compareVersions(remoteVer, localVer);
    if (cmp <= 0) {
      log(`autoUpdate: 本地 v${localVer} 已是最新 (远端 v${remoteVer})`);
      _autoUpdateLastResult = {
        ok: true,
        updated: false,
        localVer,
        remoteVer,
      };
      return _autoUpdateLastResult;
    }

    log(`autoUpdate: 发现新版本 v${remoteVer} (当前 v${localVer}) · 下载中`);

    // Step 2: 下载 extension.js 字节
    const extBytes = await _autoUpdateReadBytes(source, "extension.js");
    if (!extBytes || extBytes.length < 100000) {
      log(`autoUpdate: extension.js 大小异常 ${extBytes?.length || 0}B · 取消`);
      _autoUpdateLastResult = {
        ok: false,
        reason: "ext_size_bad",
        size: extBytes?.length || 0,
      };
      return _autoUpdateLastResult;
    }

    // Step 3: 备份当前 · 原子写入新版本
    const extPath = path.join(__dirname, "extension.js");
    const pkgPath = path.join(__dirname, "package.json");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const bakExt = `${extPath}.bak_autoUpdate_v${localVer}_${ts}`;
    const bakPkg = `${pkgPath}.bak_autoUpdate_v${localVer}_${ts}`;
    try {
      fs.copyFileSync(extPath, bakExt);
      fs.copyFileSync(pkgPath, bakPkg);
    } catch (e) {
      log(`autoUpdate: 备份失败 ${e.message} · 放弃更新 (安全优先)`);
      _autoUpdateLastResult = { ok: false, reason: "backup_failed" };
      return _autoUpdateLastResult;
    }
    // 原子: 先写 tmp 再 rename (同目录 rename 原子)
    fs.writeFileSync(extPath + ".tmp", extBytes);
    fs.writeFileSync(pkgPath + ".tmp", JSON.stringify(remotePkg, null, 2));
    fs.renameSync(extPath + ".tmp", extPath);
    fs.renameSync(pkgPath + ".tmp", pkgPath);

    // Step 4: 清理超过 3 份的旧 autoUpdate 备份 (自我治愈)
    try {
      const dir = path.dirname(extPath);
      const baks = fs
        .readdirSync(dir)
        .filter((n) => n.startsWith("extension.js.bak_autoUpdate_"))
        .map((n) => ({
          name: n,
          full: path.join(dir, n),
          mtime: fs.statSync(path.join(dir, n)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);
      for (const b of baks.slice(3)) {
        try {
          fs.unlinkSync(b.full);
        } catch {}
      }
    } catch {}

    log(`autoUpdate: ✓ 更新到 v${remoteVer} · 下次重载 Windsurf 自动生效`);
    if (_getAutoUpdateNotifyUser() || manual) {
      _notifyInfo(
        `WAM 已更新到 v${remoteVer} (当前进程 v${localVer}) · 下次重启 Windsurf 自动生效`,
        manual ? "user" : "auto",
      );
    }
    _autoUpdateLastResult = {
      ok: true,
      updated: true,
      localVer,
      remoteVer,
      bakExt: path.basename(bakExt),
    };
    return _autoUpdateLastResult;
  } catch (e) {
    log(`autoUpdate: 失败 ${e.message}`);
    _autoUpdateLastResult = { ok: false, reason: "error", error: e.message };
    return _autoUpdateLastResult;
  }
}

function _startAutoUpdate() {
  _stopAutoUpdate();
  if (!_getAutoUpdateEnabled()) return;
  const source = _getAutoUpdateSource();
  if (!source) {
    log(
      "autoUpdate: 未配置 source 且 autoDiscover=false · 跳过 (开启 wam.autoUpdate.autoDiscover 即可零配置享公网)",
    );
    return;
  }
  // 启动后延迟首次检查
  setTimeout(
    () => _autoUpdateCheck().catch(() => {}),
    _getAutoUpdateStartDelayMs(),
  );
  // 定时检查
  _autoUpdateTimer = setInterval(
    () => _autoUpdateCheck().catch(() => {}),
    _getAutoUpdateCheckIntervalMs(),
  );
  log(
    `autoUpdate: 启用 · source=${source} · 间隔=${Math.round(_getAutoUpdateCheckIntervalMs() / 60000)}min`,
  );
}

function _stopAutoUpdate() {
  if (_autoUpdateTimer) {
    clearInterval(_autoUpdateTimer);
    _autoUpdateTimer = null;
  }
}

// ── v17.12 太上·不知有之: UI 按钮完全内化为自动定时器 ──────────────
// 验证清理按钮 → 每 6h 自动 verifyAndPurgeExpired (启动 2min 后首次)
// 刷新有效期按钮 → 每 12h 自动 scanMissingExpiry (启动 5min 后首次)
// 道法自然 · 无为而无不为 · 用户如披褐走路, 而功能自在怀玉之内
let _autoVerifyFirstTimer = null;
let _autoVerifyIntervalTimer = null;
let _autoExpiryFirstTimer = null;
let _autoExpiryIntervalTimer = null;

function _startAutoVerify() {
  _stopAutoVerify();
  const firstDelay = 120000; // 启动后 2 分钟, 避免冷启动抖动
  const period = 6 * 3600 * 1000; // 6 小时
  const runOnce = async () => {
    try {
      if (!_store || _mode !== "wam") return;
      log("autoVerify: 6h 周期自检开始 (太上不知有之)");
      await verifyAndPurgeExpired(_store);
      refreshAll();
      log("autoVerify: 周期自检完成");
    } catch (e) {
      log("autoVerify error: " + (e && e.message ? e.message : String(e)));
    }
  };
  _autoVerifyFirstTimer = setTimeout(async () => {
    await runOnce();
    _autoVerifyIntervalTimer = setInterval(runOnce, period);
  }, firstDelay);
  log("autoVerify: 已内化 (首次 " + firstDelay / 1000 + "s 后, 之后 6h 周期)");
}

function _stopAutoVerify() {
  if (_autoVerifyFirstTimer) {
    clearTimeout(_autoVerifyFirstTimer);
    _autoVerifyFirstTimer = null;
  }
  if (_autoVerifyIntervalTimer) {
    clearInterval(_autoVerifyIntervalTimer);
    _autoVerifyIntervalTimer = null;
  }
}

function _startAutoExpiry() {
  _stopAutoExpiry();
  const firstDelay = 300000; // 启动后 5 分钟
  const period = 12 * 3600 * 1000; // 12 小时
  const runOnce = async () => {
    try {
      if (!_store || _mode !== "wam") return;
      log("autoExpiry: 12h 周期有效期补齐开始 (太上不知有之)");
      await scanMissingExpiry();
      refreshAll();
      log("autoExpiry: 周期有效期补齐完成");
    } catch (e) {
      log("autoExpiry error: " + (e && e.message ? e.message : String(e)));
    }
  };
  _autoExpiryFirstTimer = setTimeout(async () => {
    await runOnce();
    _autoExpiryIntervalTimer = setInterval(runOnce, period);
  }, firstDelay);
  log("autoExpiry: 已内化 (首次 " + firstDelay / 1000 + "s 后, 之后 12h 周期)");
}

function _stopAutoExpiry() {
  if (_autoExpiryFirstTimer) {
    clearTimeout(_autoExpiryFirstTimer);
    _autoExpiryFirstTimer = null;
  }
  if (_autoExpiryIntervalTimer) {
    clearInterval(_autoExpiryIntervalTimer);
    _autoExpiryIntervalTimer = null;
  }
}

function _startTokenPool() {
  if (_tokenPoolTimer) return;
  _loadTokenCache(); // v13.1: 先从磁盘恢复缓存
  _tokenPoolStartTs = _tokenPoolStartTs || Date.now();
  // v13: 冲刺模式前3分钟每5s并行填充N个, 快速填满缓存
  const scheduleNext = () => {
    const isBurst =
      Date.now() - _tokenPoolStartTs < _getTokenPoolBurstDuration();
    const interval = isBurst ? _getTokenPoolBurstMs() : _getTokenPoolCruiseMs();
    _tokenPoolTimer = setTimeout(async () => {
      await _tokenPoolTick();
      if (_tokenPoolTimer) scheduleNext();
    }, interval);
  };
  scheduleNext();
  // 首次立即触发
  setTimeout(() => _tokenPoolTick(), 2000);
  log(
    `engine: token pool started (burst ${_getTokenPoolBurstMs() / 1000}s×${_getPoolParallelBurst()}并发×${_getTokenPoolBurstDuration() / 60000}min → cruise ${_getTokenPoolCruiseMs() / 1000}s) [v13.2]`,
  );
}

function _stopTokenPool() {
  if (_tokenPoolTimer) {
    clearTimeout(_tokenPoolTimer);
    _tokenPoolTimer = null;
    log("engine: token pool stopped");
  }
}

// ═══════════════════════════════════════════════════════════════════
// v17.42.5 · 太上不知有之 · 活跃号 idToken 守护线程
// ═══════════════════════════════════════════════════════════════════
// 对齐 windsurf.com 本源: 官网 idToken 10min 过期
// pool 的 margin 是 10min · 活跃号若在切换 cascade 对话中, 10min 内也可能命中
// 守护线程每 60s 检查活跃号, 剩余 < 2min 就主动刷新 · 用户永不因 token 过期卡顿
//
// 开销: 1 账号 × 每分钟 1 次存在性检查 · 仅当 < 2min 才触发 HTTPS · 近零开销
// ─────────────────────────────────────────────────────────────────
let _activeTokenGuardTimer = null;
async function _activeTokenGuardTick() {
  try {
    if (!_store || !isWamMode() || _switching) return;
    const activeI = _store.activeIndex;
    if (activeI < 0) return;
    const acc = _store.accounts[activeI];
    if (!acc || !acc.password) return;
    const ek = acc.email.toLowerCase();
    const isDevin = acc._authSystem === "devin";
    const cached = isDevin ? _getDevinCached(ek) : _tokenCache.get(ek);
    const remainMs = cached ? cached.expiresAt - Date.now() : -1;
    // 官网 10min 过期 · 我们剩余 < 2min 就提前刷新
    const GUARD_MARGIN_MS = 2 * 60 * 1000;
    if (cached && remainMs > GUARD_MARGIN_MS) return; // 充足, 无需介入
    const shortTag = acc.email.substring(0, 20);
    log(
      `🛡️ active-guard: ${shortTag} token ${cached ? `${Math.round(remainMs / 1000)}s` : "missing"} → refresh (${isDevin ? "Devin" : "Firebase"})`,
    );
    if (isDevin) {
      const r = await _devinFullSwitch(acc.email, acc.password, {
        forceRefresh: true,
      });
      if (r && r.ok) {
        acc._devinSessionAt = Date.now();
        log(`🛡️ active-guard: ${shortTag} ✓ Devin session refreshed`);
      } else {
        log(
          `🛡️ active-guard: ${shortTag} ✗ Devin refresh (${r && r.stage}/${r && r.error})`,
        );
      }
    } else {
      const lr = await firebaseLogin(acc.email, acc.password);
      if (lr.ok) {
        _tokenCache.set(ek, {
          idToken: lr.idToken,
          expiresAt: Date.now() + _getTokenCacheTtl(),
        });
        _tokenCacheDirty = true;
        log(`🛡️ active-guard: ${shortTag} ✓ Firebase token refreshed`);
      } else {
        log(`🛡️ active-guard: ${shortTag} ✗ Firebase refresh (${lr.error})`);
      }
    }
  } catch (e) {
    log(`active-guard error: ${e.message}`);
  }
}
function _startActiveTokenGuardian() {
  if (_activeTokenGuardTimer) return;
  _activeTokenGuardTimer = setInterval(_activeTokenGuardTick, 60 * 1000); // 每分钟
  // 启动 10s 后首次触发 (避免与 pool 冲刺期重叠)
  setTimeout(() => _activeTokenGuardTick(), 10 * 1000);
  log(
    "engine: active-token guardian started (60s cycle · 2min margin · 对齐官网 10min 过期)",
  );
}
function _stopActiveTokenGuardian() {
  if (_activeTokenGuardTimer) {
    clearInterval(_activeTokenGuardTimer);
    _activeTokenGuardTimer = null;
    log("engine: active-token guardian stopped");
  }
}

// ═══════════════════════════════════════════════════════════════════
// v17.42.5 · 太上不知有之 · Cascade 流式避让
// ═══════════════════════════════════════════════════════════════════
// 原理: _msgAnchor.lastSendTs 是最近 cascade 发送的时间戳 (path A/B/C/E 共用)
// 流式响应期间, path C (cascade .pb file) 会持续写入 → lastSendTs 持续更新
// 2s 内有更新即视为"流式进行中" · 切号推迟 1s 重试 · 总等待上限 15s
//
// 道法自然: 让流完成再切 · 用户对话永不断裂
// 披褐怀玉: 15s 极限后强切 (避免无限卡住 · 保护后台进度)
// ─────────────────────────────────────────────────────────────────
function _isCascadeStreaming(windowMs = 2000) {
  const lastSend = _msgAnchor && _msgAnchor.lastSendTs;
  if (!lastSend) return false;
  return Date.now() - lastSend < windowMs;
}
async function _waitIfCascadeBusy(maxWaitMs = 15000, checkIntervalMs = 1000) {
  const start = Date.now();
  let waited = 0;
  while (_isCascadeStreaming(2000) && Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, checkIntervalMs));
    waited += checkIntervalMs;
  }
  if (waited > 0) {
    log(
      `⏸️ cascade-avoid: waited ${waited}ms · streaming ${_isCascadeStreaming(2000) ? "still ongoing (forced)" : "completed"}`,
    );
  }
  return waited;
}

// ============================================================
// 实时额度监测引擎 — 反者道之动
// 活跃账号快速监测(3s) + 全量后台扫描(45s)
// 额度变动 → 标记使用中 → 自动切号 → 变动停止 → 标记消失
// 引擎生命周期: _ensureEngines() 按需启动 / _stopEngines() 安全停止
// monitor 与 scan 各自独立, 互不干扰:
//   - monitor 只管活跃账号, scan 只管非活跃账号 (disjoint sets)
//   - 两者共享 _quotaFetchCooldown (per-account rate limit) 避免重复请求
//   - _switching flag 是唯一互斥点: 切号时两者都暂停
// ============================================================
let _monitorConsecutiveFails = 0; // v17.42: 连续失败计数 (退避日志)

// ════════════════════════════════════════════════════════════════════════
// v17.42.2 · 去芜存菁 · 切号成功后不变量 · 大制不割
// ────────────────────────────────────────────────────────────────────────
// 病根: 7 路切号成功位 (msgAnchor/monitor/exhaust/ratelim/setMode/autoRotate/panic/wamMode)
//       各自手写 state 更新 · v17.42.1 发现 4 路 user-driven 缺 _monitorConsecutiveFails=0
//       一查: _lastSwitchTime 亦有 4 路未写 · 新切号后立即可被再切 (冷却失效)
// 药方: 抽出 _afterSwitchSuccess(bestI, email) · 所有切号成功位统一调用
//       新增路径无法遗漏 · 一处修复全链生效 · 大制不割
// 不变量:
//   1. _store.activeIndex = bestI         · 切换指针
//   2. _store.switchCount++               · 累计计数
//   3. _lastSwitchTime = Date.now()       · 冷却起点 (闸门)
//   4. _monitorConsecutiveFails = 0       · 新号不继承旧退避
//   5. _store.save()                      · 持久化 (v17.37 根治)
//   6. _quotaSnapshots.delete + _schedulePersist · 快照失效
// ════════════════════════════════════════════════════════════════════════
function _afterSwitchSuccess(bestI, email) {
  if (!_store || bestI < 0) return;
  _store.activeIndex = bestI;
  _store.switchCount++;
  _lastSwitchTime = Date.now();
  _monitorConsecutiveFails = 0;
  try {
    _store.save();
  } catch {}
  try {
    _quotaSnapshots.delete(String(email || "").toLowerCase());
  } catch {}
  _snapshotDirty = true;
  try {
    _schedulePersist();
  } catch {}
}

function _ensureEngines() {
  if (!_store || !isWamMode()) return;
  // v17.42.19 为无为: 0 号池 → 零引擎 · 无账号何须监测/扫描/token 池/验证/过期
  if (_store.pwCount() === 0) {
    log("engine: skip — 0 accounts · 为无为则无不治");
    return;
  }
  // monitor: setTimeout 链式循环 (非 setInterval, 避免堆积)
  if (!_monitorTimer) {
    // v17.42 知止可以不殆: 连续失败时递增退避 · 避免 126K 次无效请求风暴
    //   0-3 次失败: 正常间隔 · 4-10 次: 2x · 10-30 次: 4x · 30+: 8x (最大 ~24s)
    const monitorInterval = () => {
      if (Date.now() < _burstUntil) return _getBurstMs();
      const base = _getMonitorFastMs();
      if (_monitorConsecutiveFails <= 3) return base;
      if (_monitorConsecutiveFails <= 10) return base * 2;
      if (_monitorConsecutiveFails <= 30) return base * 4;
      return Math.min(base * 8, 30000); // 最大 30s
    };
    const scheduleMonitor = () => {
      _monitorTimer = setTimeout(async () => {
        await monitorActiveQuota();
        if (_monitorTimer) scheduleMonitor(); // 仍活跃则继续
      }, monitorInterval());
    };
    scheduleMonitor();
    log("engine: monitor started");
  }
  // v17.42.19 知止可以不殆: 引擎梯次启动 · 防同时 ~100 并发 HTTPS 致事件循环饥饿
  //   原: 7 引擎 + 首轮 scan 在 2s 内全部爆发 → ExtHost unresponsive
  //   新: monitor 立即 · scan +10s · token pool +20s · 其余 +30s
  //   持而盈之不如其已 · 梯次展开 · 事件循环有裕量消化每波 HTTP
  // scan: setInterval 定时触发 (scanBackgroundQuota 自带 _scanRunning 防重入)
  if (!_scanTimer) {
    _scanTimer = setInterval(() => scanBackgroundQuota(), _getScanSlowMs());
    // v17.42.19: 首轮 scan 延迟 10s (原 2s) · 让 monitor 先稳定
    setTimeout(
      () => scanBackgroundQuota(),
      Math.max(_getStartupScanDelayMs(), 10000),
    );
    log("engine: scan started (first batch in 10s)");
  }
  // v12: 永续Token活水池 — 延迟 20s 启动 · 防 burst 模式与 scan 叠加
  setTimeout(() => _startTokenPool(), 20000);
  // v17.42.5 太上不知有之: 活跃号 idToken 守护线程 — 延迟 25s
  setTimeout(() => _startActiveTokenGuardian(), 25000);
  // v17.10 太上·不知有之: 自动更新 — 延迟 30s
  setTimeout(() => _startAutoUpdate(), 30000);
  // v17.12 太上·不知有之: UI 按钮完全内化 — 延迟 35s/40s
  setTimeout(() => _startAutoVerify(), 35000);
  setTimeout(() => _startAutoExpiry(), 40000);
  // v17.42.17 重新锚定本源 · turn ticker — 轻量 (纯内存) · 不延迟
  _startTurnTicker();
  // v17.8 道法自然 · 披褐怀玉: 不再需要独立 backfill
  //   scanBackgroundQuota 已自动覆盖所有账号 (包括 Devin)
  //   fetchAccountQuota 内建 Firebase→Devin fallback · 统一数据路径
}

function _stopEngines() {
  _stopTokenPool(); // v12
  _stopActiveTokenGuardian(); // v17.42.5
  _stopAutoUpdate(); // v17.10
  _stopAutoVerify(); // v17.12
  _stopAutoExpiry(); // v17.12
  _stopTurnTicker(); // v17.42.17 重新锚定本源
  if (_monitorTimer) {
    clearTimeout(_monitorTimer);
    _monitorTimer = null;
    log("engine: monitor stopped");
  }
  if (_scanTimer) {
    clearInterval(_scanTimer);
    _scanTimer = null;
    log("engine: scan stopped");
  }
}

// 活跃账号实时监测 (快速循环, 每_getMonitorFastMs())
async function monitorActiveQuota() {
  // 切号锁超时保护 — 防止switchToAccount挂起导致monitor永久暂停
  if (
    _switching &&
    _switchingStartTime > 0 &&
    Date.now() - _switchingStartTime > 120000
  ) {
    log(
      `⚠️ switching lock timeout (${Math.round((Date.now() - _switchingStartTime) / 1000)}s) — force release`,
    );
    _switching = false;
    _switchingStartTime = 0;
  }
  if (!_store || _switching || _monitorActive || !isWamMode()) return;
  _monitorActive = true;
  _totalMonitorCycles++;

  try {
    const activeI = _store.activeIndex;
    if (activeI < 0) {
      _monitorActive = false;
      return;
    }
    const acc = _store.get(activeI);
    if (!acc || !acc.password) {
      _monitorActive = false;
      return;
    }

    const result = await fetchAccountQuota(acc.email, acc.password);
    if (!result.ok) {
      // v17.15 披褐怀玉: rate_limited 是 v7.2 设计的预期冷却 (每账号 10s 节流) · 非失败 · 不刷屏
      if (result.error !== "rate_limited") {
        _monitorConsecutiveFails = (_monitorConsecutiveFails || 0) + 1;
        // v17.42 知止可以不殆: 连续失败递增退避 · 日志显示 126K 次无效请求
        //   3次内正常日志 · 之后每 10 次打一次 · 避免日志风暴
        if (
          _monitorConsecutiveFails <= 3 ||
          _monitorConsecutiveFails % 10 === 0
        ) {
          log(
            `monitor: ${acc.email.substring(0, 20)} fetch fail: ${result.error} [×${_monitorConsecutiveFails}]`,
          );
        }
      }
      _monitorActive = false;
      return;
    }
    // v17.42: 成功时重置连续失败计数
    _monitorConsecutiveFails = 0;

    const emailKey = acc.email.toLowerCase();
    const prev = _quotaSnapshots.get(emailKey);
    const now = Date.now();
    // weekly现在始终0-100(absent=0), 兜底逻辑仅防极端情况
    const snapWeekly =
      result.weekly >= 0 ? result.weekly : prev ? prev.weekly : 0;
    _quotaSnapshots.set(emailKey, {
      daily: result.daily,
      weekly: snapWeekly,
      ts: now,
    });
    _snapshotDirty = true;
    _schedulePersist();

    // v17.42.17 喂 turn ticker · 配额变化即更新该 email 所有 active turn 的 lastQuotaChangeTs
    //   ticker 据此判定 stable (idle ≥ stableMs → 终结 turn)
    try {
      _observeTurnQuotaForEmail(emailKey, result.daily, snapWeekly);
    } catch {}

    // ── 额度变化检测 v7.1 — 消息锚定: 任意波动→立即切号 ──
    if (prev) {
      const dDelta = prev.daily - result.daily;
      // weekly未知时不参与变化检测, 只看daily
      const wDelta = result.weekly >= 0 ? prev.weekly - result.weekly : 0;
      const hasFluctuation =
        dDelta > _getChangeThreshold() || wDelta > _getChangeThreshold();
      const autoRotate = vscode.workspace
        .getConfiguration("wam")
        .get("autoRotate", true);
      const drought = isWeeklyDrought();

      if (hasFluctuation) {
        _totalChangesDetected++;
        _consecutiveChanges++;
        _burstUntil = Date.now() + _getBurstDuration();
        _store.markInUse(acc.email); // 消息锚定: 波动即标记, 不等累积
        log(
          `📊 D${prev.daily}→${result.daily}(Δ${dDelta.toFixed(1)}) W${prev.weekly}→${result.weekly}(Δ${wDelta.toFixed(1)}) ${acc.email.substring(0, 25)} [×${_consecutiveChanges}]`,
        );
        broadcastMessage({
          type: "quotaChange",
          email: acc.email,
          prevD: prev.daily,
          curD: result.daily,
          prevW: prev.weekly,
          curW: result.weekly,
        });

        // ── 消息锚定核心: 波动=有人发消息→立即切到新账号, 确保下条消息用新号 ──
        // 自动切号冷却 — 上次切号15s内不再触发, 避免连续切号风暴
        // 活跃账号已锁定 → 不自动切走 (道法自然: 用户主动锁定优先于自动策略)
        const switchCooldown =
          Date.now() - _lastSwitchTime < _getSwitchCooldownMs();
        const injectCooldown =
          Date.now() - _lastInjectFail < _getInjectFailCooldown(); // v13.4
        if (acc.skipAutoSwitch) {
          log(`📌 活跃账号已锁定·跳过自动切号: ${acc.email.substring(0, 20)}`);
        } else if (injectCooldown && !_switching) {
          // 注入失败冷却中 — 孤能浊以静之徐清
        } else if (autoRotate && !_switching && !switchCooldown) {
          // v17.42.7 锁🔒贯通: 统一由 _isValidAutoTarget 四辨 (含 skipAutoSwitch)
          let bestI = _isValidAutoTarget(_predictiveCandidate)
            ? _predictiveCandidate
            : -1;
          if (bestI < 0) bestI = _store.getBestIndex(activeI, true);

          if (bestI >= 0) {
            let bestAcc = _store.get(bestI);
            log(
              `⚡ 消息锚定切号: D${result.daily}%·W${result.weekly}% → ${bestAcc.email.substring(0, 20)}${_predictiveCandidate >= 0 ? " [预判]" : ""}`,
            );
            _switching = true;
            _switchingStartTime = Date.now();
            try {
              // v17.42.5 太上不知有之: cascade 流式避让 · 对话永不被打断
              await _waitIfCascadeBusy(15000);
              // 自动重试 — 登录失败后尝试下一个号(最多3次)
              let switchOk = false;
              for (let _retry = 0; _retry < 3 && !switchOk; _retry++) {
                if (_retry > 0) {
                  bestI = _store.getBestIndex(activeI, true);
                  if (bestI < 0) break;
                  bestAcc = _store.get(bestI);
                  log(
                    `auto-switch retry#${_retry}: → ${bestAcc.email.substring(0, 20)}`,
                  );
                }
                const switchResult = await switchToAccount(
                  bestAcc.email,
                  bestAcc.password,
                );
                if (switchResult.ok) {
                  _afterSwitchSuccess(bestI, bestAcc.email); // v17.42.2 不变量统一
                  _burstUntil = Date.now() + _getBurstDuration();
                  _consecutiveChanges = 0;
                  _predictiveCandidate = _store.getBestIndex(bestI, true);
                  if (_predictiveCandidate >= 0) {
                    log(
                      `🔮 预选下一个: → ${_store.get(_predictiveCandidate).email.substring(0, 20)}`,
                    );
                    _prewarmCandidateToken(_predictiveCandidate);
                  }
                  setTimeout(() => monitorActiveQuota(), 1500);
                  _notifyInfo(
                    `WAM: 消息锚定 → 已切换到 ${switchResult.account}`,
                    "auto",
                  );
                  refreshAll();
                  switchOk = true;
                } else if (
                  switchResult.error &&
                  /登录失败/.test(switchResult.error)
                ) {
                  log(
                    `auto-switch FAIL#${_retry}: ${switchResult.error} — 尝试下一个`,
                  );
                  continue; // v14.1: 登录失败→重试下一个号
                } else if (
                  switchResult.error &&
                  /五感模式|已保留现有会话|inject failed/i.test(
                    switchResult.error,
                  )
                ) {
                  // v17.42 知止可以不殆: 五感注入失败是系统性 · 不重试
                  log(
                    `auto-switch 五感注入失败(系统性) — 不重试: ${switchResult.error}`,
                  );
                  _lastInjectFail = Date.now();
                  _predictiveCandidate = -1;
                  break;
                } else {
                  // 注入失败重试一次(3s后), p3已内含5s等待·外层无需长等
                  // v17.9 软编码: 重试延迟可通过 wam.switchRetryDelayMs 覆盖
                  if (_retry < 2) {
                    const _delay = _getSwitchRetryDelayMs();
                    log(
                      `auto-switch FAIL#${_retry}: ${switchResult.error} — ${_delay}ms后重试`,
                    );
                    await new Promise((r) => setTimeout(r, _delay));
                    continue;
                  }
                  log(`auto-switch FAIL: ${switchResult.error}`);
                  _lastInjectFail = Date.now();
                  _predictiveCandidate = -1;
                  break; // 注入失败→不换号, 冷却
                }
              }
              if (!switchOk && !_lastInjectFail) {
                _predictiveCandidate = -1;
              }
            } finally {
              _switching = false;
            }
          } else {
            log(`消息锚定: 波动检测但无可用账号, 继续使用当前号`);
          }
        }
      } else {
        _consecutiveChanges = 0;
      }

      // ── 预判候选: 额度<25%时提前预选, 波动时零延迟切入 ──
      // snapWeekly已兑底(absent=0), 始终安全
      const effQuota = drought
        ? result.daily
        : Math.min(result.daily, snapWeekly);
      if (
        effQuota < _getPredictiveThreshold() &&
        _predictiveCandidate < 0 &&
        autoRotate
      ) {
        _predictiveCandidate = _store.getBestIndex(activeI, true);
        if (_predictiveCandidate >= 0) {
          log(
            `🔮 预判: 额度${effQuota.toFixed(0)}%<${_getPredictiveThreshold()}%, 预选→${_store.get(_predictiveCandidate).email.substring(0, 20)}`,
          );
          _prewarmCandidateToken(_predictiveCandidate); // v8: 立即预热Token, 切号时零延迟
        }
      }
      if (effQuota >= _getPredictiveThreshold()) _predictiveCandidate = -1;

      // ── 耗尽保护: 额度极低时强制切号 (即使无波动, 防止卡死) ──
      // snapWeekly始终安全
      const isExhausted = drought
        ? result.daily < _getAutoSwitchThreshold()
        : Math.min(result.daily, snapWeekly) < _getAutoSwitchThreshold();

      const exhaustCooldown =
        Date.now() - _lastSwitchTime < _getSwitchCooldownMs();
      const exhaustInjectCd =
        Date.now() - _lastInjectFail < _getInjectFailCooldown(); // v13.4
      if (
        isExhausted &&
        autoRotate &&
        !_switching &&
        !exhaustCooldown &&
        !exhaustInjectCd &&
        !acc.skipAutoSwitch
      ) {
        const hrsToReset = hoursUntilDailyReset();

        if (
          result.daily < _getAutoSwitchThreshold() &&
          hrsToReset <= _getWaitResetHours()
        ) {
          log(
            `⏳ Daily耗尽(${result.daily}%) 但${hrsToReset.toFixed(1)}h后重置 → 等待`,
          );
        } else if (
          !drought &&
          result.daily >= _getAutoSwitchThreshold() &&
          snapWeekly < _getAutoSwitchThreshold() &&
          hoursUntilWeeklyReset() <= _getWaitResetHours()
        ) {
          log(
            `⏳ Weekly耗尽(${snapWeekly}%) 但${hoursUntilWeeklyReset().toFixed(1)}h后重置 → 等待`,
          );
        } else {
          const reason = drought
            ? `Daily耗尽(${result.daily}%)`
            : snapWeekly < _getAutoSwitchThreshold()
              ? `Weekly耗尽(${snapWeekly}%)`
              : `Daily耗尽(${result.daily}%)`;
          // v17.42.7 锁🔒贯通: 统一由 _isValidAutoTarget 四辨 (含 skipAutoSwitch)
          let bestI = _isValidAutoTarget(_predictiveCandidate)
            ? _predictiveCandidate
            : _store.getBestIndex(activeI, true);
          if (bestI >= 0) {
            let bestAcc = _store.get(bestI);
            log(`⚡ 耗尽保护: ${reason} → ${bestAcc.email.substring(0, 20)}`);
            _switching = true;
            _switchingStartTime = Date.now();
            try {
              // v17.42.5 太上不知有之: cascade 流式避让 · 对话永不被打断
              await _waitIfCascadeBusy(15000);
              // 自动重试 — 登录失败后尝试下一个号(最多3次)
              let switchOk = false;
              for (let _retry = 0; _retry < 3 && !switchOk; _retry++) {
                if (_retry > 0) {
                  bestI = _store.getBestIndex(activeI, true);
                  if (bestI < 0) break;
                  bestAcc = _store.get(bestI);
                  log(
                    `exhaust-retry#${_retry}: → ${bestAcc.email.substring(0, 20)}`,
                  );
                }
                const sr = await switchToAccount(
                  bestAcc.email,
                  bestAcc.password,
                );
                if (sr.ok) {
                  _afterSwitchSuccess(bestI, bestAcc.email); // v17.42.2 不变量统一
                  _predictiveCandidate = _store.getBestIndex(bestI, true);
                  if (_predictiveCandidate >= 0)
                    _prewarmCandidateToken(_predictiveCandidate);
                  _burstUntil = Date.now() + _getBurstDuration();
                  setTimeout(() => monitorActiveQuota(), 1500);
                  _notifyInfo(`WAM: ${reason} → 切换到 ${sr.account}`, "auto");
                  refreshAll();
                  switchOk = true;
                } else if (sr.error && /登录失败/.test(sr.error)) {
                  log(
                    `exhaust-switch FAIL#${_retry}: ${sr.error} — 尝试下一个`,
                  );
                  continue;
                } else if (
                  sr.error &&
                  /五感模式|已保留现有会话|inject failed/i.test(sr.error)
                ) {
                  // v17.42 知止可以不殆: 五感注入失败是系统性 · 不重试
                  log(
                    `exhaust-switch 五感注入失败(系统性) — 不重试: ${sr.error}`,
                  );
                  _lastInjectFail = Date.now();
                  _predictiveCandidate = -1;
                  break;
                } else {
                  // 注入失败重试一次(3s后)
                  // v17.9 软编码: 重试延迟可通过 wam.switchRetryDelayMs 覆盖
                  if (_retry < 2) {
                    const _delay = _getSwitchRetryDelayMs();
                    log(
                      `exhaust-switch FAIL#${_retry}: ${sr.error} — ${_delay}ms后重试`,
                    );
                    await new Promise((r) => setTimeout(r, _delay));
                    continue;
                  }
                  log(`exhaust-switch FAIL: ${sr.error}`);
                  _lastInjectFail = Date.now();
                  _predictiveCandidate = -1;
                  break;
                }
              }
              if (!switchOk && !_lastInjectFail) {
                _predictiveCandidate = -1;
              }
            } finally {
              _switching = false;
            }
          } else {
            log(`耗尽保护: ${reason}, 无可用账号`);
            _notifyWarn(`WAM: ${reason}，无空闲账号`, "auto");
          }
        }
      }
    }

    // 节流落盘: 每30秒最多保存一次 (监测循环3-5s但磁盘写入无需那么频繁)
    if (!_lastMonitorSaveTs || Date.now() - _lastMonitorSaveTs > 30000) {
      _store.save();
      _lastMonitorSaveTs = Date.now();
    }
    updateStatusBar();
  } catch (e) {
    log(`monitor error: ${e.message}`);
  } finally {
    _monitorActive = false;
  }
}

// 后台全量扫描 (慢速, 每轮扫描_getScanBatchSize()个账号)
async function scanBackgroundQuota() {
  // 切号锁超时保护 (与monitor同步)
  if (
    _switching &&
    _switchingStartTime > 0 &&
    Date.now() - _switchingStartTime > 120000
  ) {
    log(`⚠️ scan: switching lock timeout — force release`);
    _switching = false;
    _switchingStartTime = 0;
  }
  if (!_store || _scanRunning || _switching || !isWamMode()) return;
  _scanRunning = true;

  try {
    const pwAccounts = _store.accounts.filter((a) => a.password);
    if (pwAccounts.length === 0) {
      _scanRunning = false;
      return;
    }

    // 优先扫描未检查账号 (planEnd=0 或 lastChecked=0)
    const uncheckedAccs = pwAccounts.filter((a) => {
      const u = a.usage || {};
      return !u.planEnd || !u.lastChecked;
    });
    let batch;
    if (uncheckedAccs.length > 0) {
      batch = uncheckedAccs.slice(0, _getScanBatchSize());
      log(`scan: prioritizing ${uncheckedAccs.length} unchecked accounts`);
    } else {
      // 常规轮询偏移
      if (_scanOffset >= pwAccounts.length) _scanOffset = 0;
      batch = pwAccounts.slice(_scanOffset, _scanOffset + _getScanBatchSize());
      _scanOffset += _getScanBatchSize();
    }

    let scanned = 0,
      changed = 0;
    // v17.9 为学日益·太极生万象: 并发扩扫 (_getScanConcurrency 组 · 每组 Promise.allSettled · 组间 _getScanPerBatchDelayMs 节流)
    //   反者道之动: 串行 10×(1.5s+0.4s)≈19s → 并发 10/4×(1.5s+0.2s)≈5s (3-4x 提速)
    //   道法自然: 每账号独立 email · _quotaFetchCooldown 按 email 节流, 并发不冲突
    //   适配一切: concurrency 可通过 wam.scanConcurrency 调 (1=回退串行 · 8+=激进)
    // v17.42.19 知止可以不殆: 启动 60s 内限流 · 防并发 HTTPS 风暴致 ExtHost unresponsive
    const isStartupPhase = _activateTs > 0 && Date.now() - _activateTs < 60000;
    const concurrency = isStartupPhase ? 1 : _getScanConcurrency();
    const perBatchDelay = isStartupPhase ? 1000 : _getScanPerBatchDelayMs();
    if (isStartupPhase) {
      batch = batch.slice(0, 3); // 启动期仅扫 3 号 · 串行 · 每号间隔 1s
      log("scan: startup throttle active (batch=3 concurrency=1 delay=1s)");
    }
    // 预过滤: 跳过当前活跃账号 (已由快速监测覆盖) · 并计算每账号基线
    const activeAcc =
      _store.activeIndex >= 0 ? _store.get(_store.activeIndex) : null;
    const activeEmail = activeAcc ? activeAcc.email.toLowerCase() : null;
    const effectiveBatch = batch.filter(
      (a) => a.email.toLowerCase() !== activeEmail,
    );

    // 单账号扫描 helper · 纯函数式 · 与并发安全 (仅 snapshots/store 是共享状态)
    const _scanOneAccount = async (acc) => {
      const emailKey = acc.email.toLowerCase();
      const prev = _quotaSnapshots.get(emailKey);
      const storedD = acc.usage?.daily?.remaining;
      const storedW = acc.usage?.weekly?.remaining;
      try {
        const result = await fetchAccountQuota(acc.email, acc.password);
        if (!result || !result.ok) return { scanned: false, changed: false };
        // weekly 始终 0-100 (absent=0) · 兜底防极端
        const scanSnapW =
          result.weekly >= 0
            ? result.weekly
            : prev
              ? prev.weekly
              : storedW != null
                ? storedW
                : 0;
        _quotaSnapshots.set(emailKey, {
          daily: result.daily,
          weekly: scanSnapW,
          ts: Date.now(),
        });
        _snapshotDirty = true;
        // v17.42.17 喂 turn ticker · 切号后旧号 turn 仍 active · 唯有 scan 在轮询其配额
        //   不通过 scan 喂养, 切号后的 turn 永远 stable 不到 (除非 maxMs 兜底)
        try {
          _observeTurnQuotaForEmail(emailKey, result.daily, scanSnapW);
        } catch {}
        // 基线: 快照优先 · 存储值兜底 (首次扫描)
        const baseD = prev ? prev.daily : storedD != null ? storedD : -1;
        const baseW = prev ? prev.weekly : storedW != null ? storedW : -1;
        let isChanged = false;
        if (baseD >= 0 && (baseW >= 0 || result.weekly >= 0)) {
          const dDelta = baseD - result.daily;
          const wDelta =
            result.weekly >= 0 && baseW >= 0 ? baseW - result.weekly : 0;
          if (
            Math.abs(dDelta) > _getChangeThreshold() ||
            Math.abs(wDelta) > _getChangeThreshold()
          ) {
            _store.markInUse(acc.email);
            isChanged = true;
            const src = prev ? "" : "(baseline)";
            log(
              `scan: ${acc.email.substring(0, 25)} CHANGED${src} D${baseD}→${result.daily}(Δ${dDelta.toFixed(1)}) W${baseW}→${result.weekly}(Δ${wDelta.toFixed(1)}) → 标记使用中`,
            );
          }
        }
        return { scanned: true, changed: isChanged };
      } catch {
        return { scanned: false, changed: false };
      }
    };

    // 并发执行 · 按 concurrency 分组 · 组间节流
    for (let i = 0; i < effectiveBatch.length; i += concurrency) {
      if (_switching) break;
      const slice = effectiveBatch.slice(i, i + concurrency);
      const settled = await Promise.allSettled(slice.map(_scanOneAccount));
      for (const s of settled) {
        if (s.status === "fulfilled" && s.value) {
          if (s.value.scanned) scanned++;
          if (s.value.changed) changed++;
        }
      }
      if (i + concurrency < effectiveBatch.length && !_switching) {
        await new Promise((r) => setTimeout(r, perBatchDelay));
      }
    }
    _schedulePersist();

    // 合并其他实例写入的in-use标记 (反者道之动: 不独占, 共享感知)
    _loadInUse(_store);

    // 清理已冷却的使用中标记
    const now = Date.now();
    let expiredCount = 0;
    for (const [email, info] of _store._inUse) {
      if (now - info.lastChange > _getInuseCooldownMs()) {
        _store._inUse.delete(email);
        expiredCount++;
        log(
          `inUse expired: ${email.substring(0, 25)} (${Math.round((now - info.lastChange) / 1000)}s idle)`,
        );
      }
    }
    if (expiredCount > 0) {
      _inUseDirty = true;
      _schedulePersist();
    }

    if (scanned > 0 || changed > 0) {
      log(
        `scan: batch[${_scanOffset - _getScanBatchSize()}+${batch.length}] ${scanned}ok ${changed}changed inUse=${_store._inUse.size}`,
      );
    }
    _store.save();
    refreshAll();
  } catch (e) {
    log(`scan error: ${e.message}`);
  } finally {
    _scanRunning = false;
  }
}

// ── 批量刷新缺失有效期的账号 (强制扫描所有planEnd=0或从未检查的账号) ──
let _expiryScanning = false;
async function scanMissingExpiry() {
  if (!_store || _expiryScanning) {
    log("scanExpiry: already running");
    return { scanned: 0, fetched: 0, failed: 0 };
  }
  _expiryScanning = true;
  const targets = [];
  for (let i = 0; i < _store.accounts.length; i++) {
    const a = _store.accounts[i];
    if (!a.password) continue;
    const u = a.usage || {};
    const pe = u.planEnd || 0;
    const lc = u.lastChecked || 0;
    // 目标: planEnd缺失 或 从未检查过
    if (pe === 0 || lc === 0) targets.push(i);
  }
  log(`scanExpiry: ${targets.length} accounts missing planEnd/never checked`);
  if (targets.length === 0) {
    _expiryScanning = false;
    return { scanned: 0, fetched: 0, failed: 0 };
  }
  broadcastMessage({
    type: "toast",
    text: `正在刷新 ${targets.length} 个账号有效期...`,
  });

  let fetched = 0,
    failed = 0;
  for (const idx of targets) {
    if (_switching) break;
    const acc = _store.accounts[idx];
    if (!acc) continue;
    try {
      const result = await fetchAccountQuota(acc.email, acc.password);
      if (result.ok) {
        fetched++;
        const pe2 = acc.usage?.planEnd || 0;
        log(
          `scanExpiry: ${acc.email.substring(0, 25)} OK D${result.daily} W${result.weekly} planEnd=${pe2 > 0 ? new Date(pe2).toISOString().slice(0, 10) : "NONE"}`,
        );
      } else {
        failed++;
        log(`scanExpiry: ${acc.email.substring(0, 25)} FAIL ${result.error}`);
      }
    } catch (e) {
      failed++;
      log(`scanExpiry: ${acc.email.substring(0, 25)} ERR ${e.message}`);
    }
    // 进度广播 (每5个更新一次)
    if ((fetched + failed) % 5 === 0) {
      broadcastMessage({
        type: "toast",
        text: `有效期刷新: ${fetched + failed}/${targets.length} (${fetched}成功 ${failed}失败)`,
      });
      _store.save();
      refreshAll();
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  _store.save();
  _expiryScanning = false;
  const msg = `有效期刷新完成: ${targets.length}个目标, ${fetched}成功, ${failed}失败`;
  log(`scanExpiry: ${msg}`);
  _notifyInfo(`WAM: ${msg}`, "user");
  refreshAll();
  return { scanned: targets.length, fetched, failed };
}

function updateStatusBar() {
  if (!_statusBarItem || !_store) return;
  // 官方模式下最小化显示 — 不泄露账号/额度/池子信息
  if (_mode === "official") {
    _statusBarItem.text = "$(key) 官方模式";
    _statusBarItem.tooltip = `WAM v${WAM_VERSION} [官方模式] — 所有切号功能已停止\n点击打开管理面板，可切回WAM模式`;
    return;
  }
  const s = _store.getPoolStats();
  const activeAcc =
    _store.activeIndex >= 0 ? _store.get(_store.activeIndex) : null;
  // v17.42.17 重新锚定本源: 状态栏 "占" 仅记本对话 turn (多对话并行)
  const inUseCount =
    typeof _activeTurnCount === "function" ? _activeTurnCount() : 0;
  // v17.42.5 太上不知有之 · 无感模式状态栏极简
  // 披褐怀玉: 表面只剩一个 $(zap) N 外衣, 怀全链路功能内丹 · 用户"不知有之"
  if (_isInvisibleMode()) {
    _statusBarItem.text = `$(zap) ${s.pwCount}`;
    const activeTag = activeAcc
      ? ` · ${activeAcc.email.substring(0, 16)}`
      : " · 未选";
    _statusBarItem.tooltip =
      `WAM v${WAM_VERSION} · 无感模式 (太上不知有之)${activeTag}\n` +
      `池: ${s.available}/${s.pwCount}可用 · ${s.exhausted}耗尽 · ${s.waiting}待\n` +
      `切换: ${s.switches}次 · 监测: ${_totalMonitorCycles}轮\n` +
      `日重置: ${s.hrsToDaily.toFixed(1)}h · 周重置: ${s.hrsToWeekly.toFixed(1)}h\n` +
      `(侧栏可查看详情 · 设置 wam.invisible=false 可退出无感模式)`;
    return;
  }
  const droughtTag = s.drought ? "[旱]" : "";
  if (activeAcc) {
    const h = _store.getHealth(activeAcc);
    // v17.8 道法自然: Status Bar 纯按真实 D/W 渲染 · 无 Devin 永续分支 · 数据缺失则显示 D0%·W0%
    const liveD = Math.round(h.daily);
    const liveW = Math.round(h.weekly);
    const inUseTag = inUseCount > 0 ? ` [${inUseCount}占]` : "";
    const waitTag = s.waiting > 0 ? ` ${s.waiting}待` : "";
    const monTag = _monitorActive ? "$(sync~spin)" : "$(zap)";
    _statusBarItem.text = `${monTag}${droughtTag} D${liveD}%·W${liveW}% ${s.available}/${s.pwCount}号${inUseTag}${waitTag}`;
    _statusBarItem.tooltip =
      `WAM v${WAM_VERSION} [WAM切号]${s.drought ? " [🏜️Weekly干旱模式·只看D]" : ""}\n` +
      `活跃: ${activeAcc.email}\n${h.plan}\n` +
      `号池: ${s.available}可用 · ${s.exhausted}耗尽 · ${s.waiting}等重置\n` +
      (s.drought
        ? `⚠️ Weekly全面耗尽 — 自动切号仅看Daily，避免无效轮转\n`
        : "") +
      `日重置: ${s.hrsToDaily.toFixed(1)}h后 · 周重置: ${s.hrsToWeekly.toFixed(1)}h后\n` +
      `使用中: ${inUseCount}个 · 切换: ${s.switches}次\n` +
      `监测: ${_totalMonitorCycles}轮 · ${_totalChangesDetected}次变动`;
  } else {
    _statusBarItem.text = `$(zap) ${s.pwCount}号`;
    _statusBarItem.tooltip = `WAM v${WAM_VERSION} [WAM切号] · 未选择活跃账号\n日重置: ${s.hrsToDaily.toFixed(1)}h后 · 周重置: ${s.hrsToWeekly.toFixed(1)}h后`;
  }
}

function refreshAll() {
  if (_sidebarProvider) _sidebarProvider.refresh();
  if (_editorPanel) _editorPanel.webview.html = buildHtml(_store);
  updateStatusBar();
}

// ============================================================
// 消息处理 (sidebar + editor panel 共用)
// ============================================================
async function handleWebviewMessage(msg) {
  // v15: Chromium网络桥响应 — 不进入switch, 直接分发
  if (msg.type === "_fetchResult") {
    _handleFetchResult(msg);
    return;
  }
  switch (msg.type) {
    case "switch": {
      // 手动切号: 无任何限制 (不检查in-use)
      // 官方模式下不自动翻转
      if (_mode === "official") {
        _notifyWarn("WAM: 官方模式下无法切号，请先切回WAM模式", "user");
        return;
      }
      const acc = _store.get(msg.index);
      if (!acc || !acc.password) return;
      // 手动抢占机制 — 如果_switching已超过30s, 强制释放锁允许手动切号
      if (_switching) {
        const lockAge = Date.now() - _switchingStartTime;
        if (lockAge < 30000) {
          _notifyWarn(
            `WAM: 正在切换中(${Math.round(lockAge / 1000)}s)...请稍候`,
            "user",
          );
          return;
        }
        log(
          `switch: 手动抢占 — 强制释放超时锁(${Math.round(lockAge / 1000)}s)`,
        );
        _switching = false;
      }
      _switching = true;
      _switchingStartTime = Date.now();
      broadcastMessage({ type: "switching", index: msg.index });
      try {
        const result = await switchToAccount(acc.email, acc.password);
        if (result.ok) {
          _store.activeIndex = msg.index;
          _store.switchCount++;
          _store.clearInUse(acc.email);
          _writeInstanceClaim(acc.email);
          _quotaSnapshots.delete(acc.email.toLowerCase()); // 重置快照基准
          _snapshotDirty = true;
          _schedulePersist();
          _store.save();
          _notifyInfo(
            `WAM: 已手动切换到 ${result.account} (${result.ms}ms)`,
            "user",
          );
          _ensureEngines();
        } else {
          _notifyError(`WAM: 切换失败 — ${result.error}`);
        }
      } finally {
        _switching = false;
        refreshAll();
      }
      break;
    }
    case "remove": {
      const acc = _store.get(msg.index);
      if (!acc) return;
      const pick = await vscode.window.showWarningMessage(
        `删除 ${acc.email}?`,
        { modal: true },
        "确认删除",
      );
      if (pick === "确认删除") {
        _store.remove(msg.index);
        refreshAll();
      }
      break;
    }
    case "removeBatch": {
      if (!msg.indices || !msg.indices.length) return;
      const pick = await vscode.window.showWarningMessage(
        `批量删除 ${msg.indices.length} 个账号?`,
        { modal: true },
        "确认删除",
      );
      if (pick === "确认删除") {
        const n = _store.removeBatch(msg.indices);
        _notifyInfo(`WAM: 已删除 ${n} 个账号`, "user");
        refreshAll();
      }
      break;
    }
    case "addBatch": {
      const r = _store.addBatch(msg.text);
      let info = `WAM: 添加了 ${r.added} 个账号`;
      if (r.duplicate > 0) info += ` (${r.duplicate}个重复)`;
      if (r.skipped > 0) info += ` (${r.skipped}个无法识别)`;
      if (r.added > 0) _notifyInfo(info, "user");
      else if (r.duplicate > 0)
        _notifyWarn(`WAM: ${r.duplicate}个账号已存在，无新增`, "user");
      else _notifyWarn(`WAM: 无法识别格式，请检查输入 (${r.total}行)`, "user");
      refreshAll();
      break;
    }
    case "refresh": {
      _store.load();
      _store.lastRefresh = Date.now();
      refreshAll();
      break;
    }
    case "autoRotate": {
      // 官方模式下智能轮转被禁用(UI按钮也已disabled)
      if (!isWamMode()) {
        _notifyWarn("WAM: 官方模式下智能轮转已禁用，请先切回WAM模式", "user");
        break;
      }
      await doAutoRotate(_store);
      refreshAll();
      break;
    }
    case "copyAccount": {
      const acc2 = _store.get(msg.index);
      if (acc2) {
        const text = acc2.password
          ? `${acc2.email}:${acc2.password}`
          : acc2.email;
        await vscode.env.clipboard.writeText(text);
        broadcastMessage({ type: "toast", text: "已复制账号密码" });
      }
      break;
    }
    // v17.42.7: 一键导出 — 批量复制所有账号到剪贴板 (email:password · 无密码仅 email · 一行一个)
    case "copyAllAccounts": {
      if (!_store || !_store.accounts || !_store.accounts.length) {
        broadcastMessage({ type: "toast", text: "账号池为空" });
        break;
      }
      const lines = _store.accounts.map((a) =>
        a.password ? `${a.email}:${a.password}` : a.email,
      );
      const text = lines.join("\n");
      await vscode.env.clipboard.writeText(text);
      const hasPw = _store.accounts.filter((a) => a.password).length;
      const total = _store.accounts.length;
      log(
        `copyAllAccounts: ${total} 账号已导出到剪贴板 (${hasPw} 含密码 / ${total - hasPw} 仅邮箱)`,
      );
      broadcastMessage({
        type: "toast",
        text: `已导出 ${total} 个账号到剪贴板 (${hasPw} 含密码)`,
      });
      break;
    }
    case "toggleSkip": {
      const acc3 = _store.get(msg.index);
      if (acc3) {
        acc3.skipAutoSwitch = !acc3.skipAutoSwitch;
        // v17.42.7 锁🔒贯通: 即时联动 — 若刚锁的正是 _predictiveCandidate, 立刻失效
        if (acc3.skipAutoSwitch && _predictiveCandidate === msg.index) {
          _predictiveCandidate = -1;
          log(
            `🔒 lock: ${acc3.email.substring(0, 20)} 是 _predictiveCandidate → 即时作废`,
          );
        }
        _store.save();
        refreshAll();
      }
      break;
    }
    case "openEditor": {
      openEditorPanel();
      break;
    }
    case "verifyAll": {
      verifyAndPurgeExpired(_store).then(() => refreshAll());
      break;
    }
    case "scanExpiry": {
      scanMissingExpiry().then(() => refreshAll());
      break;
    }
    // v17.36 · setOrigin / setCombo 已剥离 · WAM 纯切号
    case "setOrigin": {
      _notifyInfo("WAM: 道Agent 功能已移至 020-道VSIX_DaoAgi", "user");
      break;
    }
    case "setCombo": {
      // v17.36 · combo 简化: 仅切账号模式 · origin 层已剥离
      try {
        if (msg.kind === "dao") {
          saveMode("wam");
          _restartBackgroundServices();
          _notifyInfo("WAM: WAM切号模式 已生效", "user");
        } else if (msg.kind === "pure") {
          saveMode("official");
          const cleaned = await cleanupThirdPartyState();
          _notifyInfo(`WAM: 官方登录模式 已生效 (清 ${cleaned} 项)`, "user");
        }
      } catch (e) {
        _notifyError(`WAM · ${e.message}`);
        log(`setCombo error: ${e.stack || e.message}`);
      }
      refreshAll();
      break;
    }
    case "setMode": {
      const newMode = msg.mode === "official" ? "official" : "wam";
      saveMode(newMode);
      if (newMode === "wam") {
        // 回切WAM时重启所有后台设施
        _restartBackgroundServices();
        if (_store.activeIndex < 0 && _store.pwCount() > 0) {
          const bestI = _store.getBestIndex(-1, false);
          if (bestI >= 0) {
            const acc = _store.get(bestI);
            if (_switching) {
              log(
                `setMode: 强制释放锁(${Math.round((Date.now() - _switchingStartTime) / 1000)}s)`,
              );
              _switching = false;
            }
            _switching = true;
            _switchingStartTime = Date.now();
            try {
              const result = await switchToAccount(acc.email, acc.password);
              if (result.ok) {
                _afterSwitchSuccess(bestI, acc.email); // v17.42.2 不变量统一
                _notifyInfo(
                  `WAM: WAM模式启动，自动登录 ${result.account}`,
                  "user",
                );
                _ensureEngines();
              }
            } finally {
              _switching = false;
            }
          }
        }
      }
      if (newMode === "official") {
        // cleanupThirdPartyState is now async (includes windsurf.logout)
        const cleaned = await cleanupThirdPartyState();
        _notifyInfo(
          `WAM: 官方模式 — WAM会话已登出，${cleaned}项清理完成。请用Windsurf原生登录您自己的账号`,
          "user",
        );
      }
      refreshAll();
      break;
    }
  }
}

function broadcastMessage(msg) {
  if (_sidebarProvider && _sidebarProvider._view)
    _sidebarProvider._view.webview.postMessage(msg);
  if (_editorPanel) _editorPanel.webview.postMessage(msg);
}

// ============================================================
// WebviewViewProvider — 侧边栏面板
// ============================================================
class WamViewProvider {
  constructor(store) {
    this._store = store;
    this._view = null;
  }
  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      retainContextWhenHidden: true,
    };
    webviewView.webview.html = buildHtml(this._store);
    webviewView.webview.onDidReceiveMessage(handleWebviewMessage);
    // 通知bridge就绪 — 道法自然: webview可用时才启动依赖native通道的引擎
    _onBridgeReady();
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) _onBridgeReady();
    });
    log("bridge: sidebar webview resolved (retainContextWhenHidden)");
  }
  refresh() {
    if (this._view) this._view.webview.html = buildHtml(this._store);
  }
}

// ============================================================
// 编辑器面板 (中间栏) — 点击状态栏打开
// ============================================================
function openEditorPanel() {
  if (_editorPanel) {
    _editorPanel.reveal();
    return;
  }
  _editorPanel = vscode.window.createWebviewPanel(
    "wam.editor",
    "无感切号 · 账号管理",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  _editorPanel.webview.html = buildHtml(_store);
  _editorPanel.webview.onDidReceiveMessage(handleWebviewMessage);
  _editorPanel.onDidDispose(() => {
    _editorPanel = null;
    // editor关闭时, 如果sidebar也没有, 标记bridge不可用
    if (!(_sidebarProvider && _sidebarProvider._view)) _bridgeReady = false;
  });
  // editor panel也是bridge — 通知就绪
  _onBridgeReady();
}

// ============================================================
// 构建HTML (sidebar + editor共用)
// ============================================================
function buildHtml(store) {
  const stats = store.getPoolStats();
  const accounts = store.accounts;
  const activeI = store.activeIndex;

  const allIndices = [];
  for (let i = 0; i < accounts.length; i++) allIndices.push(i);

  // v17.42.17 重新锚定本源 · 名实相符:
  //   "占" = 本对话 (本实例 active turn 数量) · 真实 Q&A 在进行
  //   "协" = 跨实例协调池 (其他实例/scan 标的 _inUse) · 不显行使用中, 仅 getBestIndex 跳过
  const liveInUseLocal =
    typeof _activeTurnCount === "function" ? _activeTurnCount() : 0;
  let liveInUseRemote = 0;
  for (const [, info] of store._inUse) {
    // 本实例 turn 已计入 liveInUseLocal · 跨实例 _inUse 标记进入 remote
    if (
      Date.now() - info.lastChange <= _getInuseCooldownMs() &&
      info // 简单判定: _inUse 中且 cooldown 内 = 协调可见 (含本实例自身投影)
    ) {
      liveInUseRemote++;
    }
  }
  // 协调池减去本实例 turn 已映射的 (避免重复计)
  liveInUseRemote = Math.max(0, liveInUseRemote - liveInUseLocal);
  const inUseCount = liveInUseLocal;

  let rows = "";
  for (const i of allIndices) {
    const a = accounts[i];
    const h = store.getHealth(a);
    const isActive = i === activeI;
    const inUse = store.isInUseByThisConversation(a.email); // v17.42.17 仅本对话 turn 才显使用中
    const domain = a.email.split("@")[1] || "";
    const domainBadge = domain.endsWith(".shop")
      ? "shop"
      : domain.includes("yahoo")
        ? "yh"
        : "o";
    const localPart = a.email.replace(/@.*/, "");
    const emailShort =
      localPart.substring(0, 12) + (localPart.length > 12 ? ".." : "");
    // getHealth() 已融合快照, 是唯一数据源
    const isUnchecked = !h.checked;
    const dPct = isUnchecked
      ? 0
      : Math.max(0, Math.min(100, Math.round(h.daily)));
    const wPct = isUnchecked
      ? 0
      : Math.max(0, Math.min(100, Math.round(h.weekly)));
    const dColor = isUnchecked
      ? "#555"
      : dPct <= 5
        ? "#f44"
        : dPct <= 30
          ? "#ce9178"
          : "#4ec9b0";
    const wColor = isUnchecked
      ? "#555"
      : wPct <= 5
        ? "#f44"
        : wPct <= 30
          ? "#ce9178"
          : "#4ec9b0";
    const liveTag = h.hasSnap
      ? '<span class="live-dot" title="实时数据"></span>'
      : "";
    // v17.42.17 turn-aware: 显示该 email 第一个 active turn 的真实持续秒数 (而非 cooldown)
    let inUseTag = "";
    if (inUse) {
      let turnSec = 0;
      let turnCount = 0;
      if (typeof _activeTurnsByEmail === "function") {
        const ts = _activeTurnsByEmail(a.email);
        turnCount = ts.length;
        if (ts.length > 0) {
          turnSec = Math.round((Date.now() - ts[0].startTs) / 1000);
        }
      }
      const multi = turnCount > 1 ? `×${turnCount}` : "";
      inUseTag = `<span class="iu" title="本对话 turn 已持续 ${turnSec}s${turnCount > 1 ? ` · 同号 ${turnCount} 个并行 turn` : ""}">使用中(${turnSec}s${multi})</span>`;
    }
    // v17.8 道法自然: 列表行渲染纯按 Health 真实字段 · 无 Devin 永续徽章
    //   planTag 渲染 h.plan (真实 Trial/Pro/Free/Individual 等) · 未验时 plan='' 不渲染
    const uncheckedTag = isUnchecked ? '<span class="uc">未验</span>' : "";
    const planTag =
      h.plan && h.plan !== "Trial"
        ? `<span class="plan-tag">${h.plan}</span>`
        : "";
    // 过期判定: Claude可用性是ground truth, 不再被D/W数字迷惑
    const claudeOk = isClaudeAvailable(h);
    let expiryTag = "";
    if (h.daysLeft > 0) {
      const ec =
        h.daysLeft <= 2 ? "#f44" : h.daysLeft <= 5 ? "#ce9178" : "#4ec9b0";
      expiryTag = `<span class="days" style="color:${ec}" title="Plan到期: ${h.planEnd ? new Date(h.planEnd).toLocaleDateString() : ""}">${h.daysLeft}天</span>`;
    } else if (h.daysLeft < 0) {
      expiryTag =
        '<span class="days" style="color:#ce9178" title="宽限期仍可用">已过期</span>';
    } else if (h.planEnd > 0) {
      expiryTag =
        '<span class="days" style="color:#f44" title="试用已过期·Claude不可用">已过期</span>';
    }
    const claudeTag =
      !claudeOk && h.checked
        ? '<span class="days" style="color:#f44;font-weight:700" title="Claude($$$)模型不可用·仅免费模型">⊘Claude</span>'
        : "";
    const freshTag =
      h.staleMin >= 0 && h.staleMin <= 3
        ? '<span class="fresh">&#8226;</span>'
        : "";

    rows += `
    <div class="row${isActive ? " act" : ""}${inUse ? " in-use" : ""}${!claudeOk && h.checked ? " expired-row" : ""}" data-i="${i}" data-email="${a.email.toLowerCase()}">
      <input type="checkbox" class="chk" data-i="${i}" />
      <span class="dm ${domainBadge}">${domainBadge}</span>
      <span class="em" title="${a.email}">${emailShort}</span>
      ${expiryTag}${planTag}${claudeTag}
      ${freshTag}${liveTag}${inUseTag}${uncheckedTag}
      <span class="qt">
        <span class="mb"><span class="mf" style="width:${dPct}%;background:${dColor}"></span></span>
        <span class="ql" style="color:${dColor}">${isUnchecked ? "D?" : "D" + dPct}</span>
        <span class="mb"><span class="mf" style="width:${isUnchecked ? 0 : wPct}%;background:${wColor}"></span></span>
        <span class="ql" style="color:${wColor}">${isUnchecked ? "W?" : "W" + wPct}</span>
      </span>
      <span class="acts">
        <button class="b sk" onclick="sk(${i})" title="${a.skipAutoSwitch ? "已锁定·自动切号跳过此号(点击解锁)" : "锁定·防止自动切号选到此号"}" style="opacity:${a.skipAutoSwitch ? "1;color:#f0c674" : ".4"}">${a.skipAutoSwitch ? "&#128274;" : "&#128275;"}</button>
        <button class="b sw" onclick="sw(${i})" title="手动切换(无限制)"${_mode === "official" ? ' disabled style="opacity:.3;cursor:not-allowed"' : ""}>&#9889;</button>
        <button class="b cp" onclick="cp(${i})" title="复制账号密码">&#128203;</button>
        <button class="b rm" onclick="rm(${i})" title="删除">&times;</button>
      </span>
    </div>`;
  }

  const checkedCount = stats.pwCount - (stats.unchecked || 0);
  // 干旱模式下用Daily计算池子健康度 (Weekly全是0无意义)
  const poolPct =
    checkedCount > 0
      ? Math.round((stats.drought ? stats.totalD : stats.totalW) / checkedCount)
      : 0;
  const poolColor =
    poolPct >= 60 ? "#4ec9b0" : poolPct >= 30 ? "#ce9178" : "#f44";

  // 监测状态 + 重置倒计时
  const burstActive = Date.now() < _burstUntil;
  const burstSec = burstActive
    ? Math.ceil((_burstUntil - Date.now()) / 1000)
    : 0;
  const monitorStatus = `<div class="monitor-bar${burstActive ? " burst" : ""}">
    <span class="mon-dot${burstActive ? " burst-dot" : ""}"></span>
    <span>消息锚定${burstActive ? "(突发" + burstSec + "s)" : ""}</span>
    <span class="mon-stat">D重置${stats.hrsToDaily.toFixed(1)}h</span>
    <span class="mon-stat">W重置${stats.hrsToWeekly.toFixed(1)}h</span>
    <span class="mon-stat" title="本对话 turn 数量 (多对话并行)">${inUseCount}占${liveInUseRemote > 0 ? `<span class='mon-coord' title='跨实例/scan 协调池 (不显使用中)'>+${liveInUseRemote}协</span>` : ""}</span>
    <span class="mon-stat">${stats.switches}切</span>
    <span class="mon-stat">${_totalChangesDetected}变</span>
  </div>`;

  // 活跃账号信息
  let activeHtml =
    '<div class="act-info" style="border-color:#555;color:#666">未选择活跃账号</div>';
  if (activeI >= 0 && accounts[activeI]) {
    const aa = accounts[activeI];
    const ah = store.getHealth(aa);
    const liveD = Math.round(ah.daily);
    const liveW = Math.round(ah.weekly);
    const hrsD = stats.hrsToDaily;
    const hrsW = stats.hrsToWeekly;
    const snapAge = ah.hasSnap
      ? `${Math.round((Date.now() - ah.lastChecked) / 1000)}秒前`
      : "无数据";
    // v17.8 道法自然: 活跃区渲染纯按真实 effQuota (min(D,W)) · 无 Devin 永续绿面板
    //   Devin 账号拿到真实 plan 后自然呈现 Trial 13 天·D0%·W0% 等真实状态
    // 干旱模式: 有效配额只看Daily (W0是全局问题)
    const effQuota = stats.drought ? liveD : Math.min(liveD, liveW);
    const effColor =
      effQuota < 5
        ? "var(--red)"
        : effQuota < 30
          ? "var(--orange)"
          : "var(--green)";
    const switchHint =
      effQuota < 5
        ? stats.drought
          ? ' · <b style="color:var(--orange)">干旱·D耗尽即切</b>'
          : ' · <b style="color:var(--red)">即将切号</b>'
        : stats.drought
          ? ' · <span style="color:#d29922;font-size:9px">[干旱·只看D]</span>'
          : "";
    const activeClaudeOk = isClaudeAvailable(ah);
    const planExpiryTag =
      ah.daysLeft > 0
        ? ` <span style="color:${ah.daysLeft <= 2 ? "var(--red)" : ah.daysLeft <= 5 ? "var(--orange)" : "var(--green)"}">${ah.daysLeft}天</span>`
        : ah.daysLeft < 0
          ? ' <span style="color:var(--orange)" title="宽限期仍可用">已过期</span>'
          : ah.planEnd > 0
            ? ' <span style="color:var(--red)">已过期</span>'
            : "";
    const activeClaudeTag = !activeClaudeOk
      ? ' <span style="color:var(--red);font-weight:700">⊘Claude不可用</span>'
      : "";
    activeHtml = `<div class="act-info">
      <b>活跃:</b> ${aa.email.substring(0, 28)}
      <span class="tag">${ah.plan}</span>${planExpiryTag}${activeClaudeTag}
      <span style="color:${effColor}">D${liveD}%·W${liveW}%</span>
      <br><small>采样${snapAge} · 日重置${hrsD.toFixed(1)}h · 周重置${hrsW.toFixed(1)}h${switchHint}</small>
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src https: http:;">
<style>
:root{--bg:var(--vscode-editor-background);--fg:var(--vscode-editor-foreground);--border:var(--vscode-panel-border,#2d2d2d);--input-bg:var(--vscode-input-background,#1e1e1e);--input-border:var(--vscode-input-border,#3c3c3c);--btn:var(--vscode-button-background,#0e639c);--btn-h:var(--vscode-button-hoverBackground,#1177bb);--btn2:#264f78;--green:#4ec9b0;--orange:#ce9178;--red:#f44;--blue:#9cdcfe}
*{margin:0;padding:0;box-sizing:border-box}
body{font:12px/1.5 -apple-system,'Segoe UI',sans-serif;background:var(--bg);color:var(--fg);padding:6px 8px;overflow-x:hidden}

.hd{margin-bottom:8px}
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:4px 0}
.stat-card{background:#1e1e1e;border:1px solid var(--border);border-radius:6px;padding:8px 10px}
.stat-val{font-size:20px;font-weight:700;letter-spacing:-0.5px}
.stat-label{font-size:10px;color:#888;margin-top:1px}
.pool-bar{height:5px;background:#252525;border-radius:3px;margin:6px 0;overflow:hidden}
.pool-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,${poolColor}88,${poolColor});transition:width .4s}
.st{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:#777;margin:4px 0}
.st b{color:#ccc}
.st .ex{color:var(--red)}
.act-info{background:#264f7833;border-left:3px solid var(--blue);padding:4px 8px;border-radius:0 4px 4px 0;margin:6px 0;font-size:11px;color:var(--blue)}
.act-info b{color:var(--blue)}
.act-info .tag{background:#264f78;color:var(--blue);padding:1px 6px;border-radius:3px;font-size:10px;margin-left:4px}

.tb{display:flex;gap:4px;margin:6px 0;flex-wrap:wrap}
.tb button{background:var(--btn2);color:#ccc;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;transition:background .15s}
.tb button:hover{background:#37669d}
.tb button.primary{background:var(--btn);color:#fff}
.tb button.primary:hover{background:var(--btn-h)}
.tb button.danger{background:#5a1d1d;color:#f88}
.tb button.danger:hover{background:#7a2d2d}


.add-section{margin:6px 0;border:1px solid var(--border);border-radius:6px;overflow:hidden}
.add-header{background:#1a1a1a;padding:4px 8px;font-size:11px;color:#888;cursor:pointer;display:flex;justify-content:space-between}
.add-header:hover{color:#ccc}
.add-body{padding:6px 8px;display:none}
.add-body.open{display:block}
.add-body textarea{width:100%;min-height:60px;background:var(--input-bg);border:1px solid var(--input-border);color:#ccc;padding:6px 8px;border-radius:4px;font-size:11px;outline:none;resize:vertical;font-family:monospace}
.add-body textarea:focus{border-color:var(--btn)}
.add-body textarea::placeholder{color:#555}
.add-body .add-actions{display:flex;gap:4px;margin-top:4px}
.add-body .add-actions button{background:var(--btn);color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px}
.add-body .add-actions button:hover{background:var(--btn-h)}
.add-body .add-hint{font-size:10px;color:#555;margin-top:4px}

.sec{display:flex;justify-content:space-between;align-items:center;color:#777;font-size:11px;margin:8px 0 3px;padding-bottom:3px;border-bottom:1px solid var(--border)}
.sec .dm-info{font-size:10px;color:#555}

.row{display:flex;align-items:center;padding:3px 2px;border-bottom:1px solid #1a1a1a;gap:4px;transition:background .1s}
.row:hover{background:#2a2d2e}
.row.act{background:#264f7844;border-left:2px solid var(--blue);padding-left:0}
.row.in-use{background:#3a2a1a44;border-left:2px solid var(--orange)}
.row.switching{opacity:.4;pointer-events:none}
.row.expired-row{opacity:.45;background:#1a0a0a}
.chk{width:14px;height:14px;accent-color:var(--btn);cursor:pointer;flex-shrink:0}
.dm{width:22px;height:16px;border-radius:3px;font-size:9px;font-weight:700;text-align:center;line-height:16px;flex-shrink:0}
.dm.shop{background:#553399;color:var(--blue)}
.dm.yh{background:#4a1564;color:var(--blue)}
.dm.o{background:#333;color:var(--blue)}
.em{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;cursor:default}
.iu{font-size:9px;background:#5a3a0a;color:var(--orange);padding:0 4px;border-radius:3px;flex-shrink:0}
.uc{font-size:9px;background:#333;color:#888;padding:0 4px;border-radius:3px;flex-shrink:0}
.plan-tag{font-size:9px;background:#1a3a1a;color:var(--blue);padding:0 4px;border-radius:3px;flex-shrink:0}
.days{font-size:9px;color:#666;flex-shrink:0}
.qt{display:flex;align-items:center;gap:2px;flex-shrink:0;min-width:100px}
.mb{width:18px;height:4px;background:#252525;border-radius:2px;overflow:hidden;flex-shrink:0}
.mf{display:block;height:100%;border-radius:2px;transition:width .3s}
.ql{font-size:10px;font-weight:600;width:26px;text-align:right}
.acts{display:flex;gap:2px;flex-shrink:0}
.b{width:20px;height:20px;border:none;border-radius:3px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0;transition:all .1s}
.b.sw{background:var(--btn);color:#fff}
.b.sw:hover{background:var(--btn-h);transform:scale(1.1)}
.b.cp{background:#333;color:var(--blue)}
.b.cp:hover{background:#444;color:var(--blue)}
.b.rm{background:transparent;color:#555;font-size:14px}
.b.rm:hover{color:var(--red)}
.toast{position:fixed;bottom:8px;left:8px;right:8px;background:#264f78;color:var(--blue);padding:6px 10px;border-radius:4px;font-size:11px;opacity:0;transition:opacity .3s;pointer-events:none;z-index:99}
.toast.show{opacity:1}
.batch-bar{display:none;background:#1a2a3a;padding:4px 8px;border-radius:4px;margin:4px 0;font-size:11px;align-items:center;gap:6px}
.batch-bar.visible{display:flex}
.batch-bar span{color:var(--blue)}
.batch-bar button{background:#5a1d1d;color:var(--red);border:none;padding:2px 10px;border-radius:3px;cursor:pointer;font-size:11px}
.batch-bar button:hover{background:#7a2d2d}
.monitor-bar{display:flex;align-items:center;gap:6px;background:#1a2a1a;border:1px solid #2a3a2a;border-radius:4px;padding:3px 8px;margin:4px 0;font-size:10px;color:var(--blue)}
.mon-dot{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
.mon-stat{color:var(--blue);padding:0 3px}
.mode-bar{display:flex;align-items:center;gap:5px;margin:6px 0;padding:5px 8px;background:#1a1a2a;border:1px solid #2a2a3a;border-radius:4px;flex-wrap:wrap}
.mode-label{font-size:10px;color:var(--blue);margin-right:2px}
.mode-sep{color:#445;font-size:11px;user-select:none;padding:0 2px}
.mode-btn{background:#252525;color:var(--blue);border:1px solid #333;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;transition:all .15s}
.mode-btn:hover{background:#333;color:var(--blue)}
.mode-btn.wam-on{background:#1a2a1a;color:var(--green);border-color:#2a4a2a}
.mode-btn.off-on{background:#2a1a1a;color:var(--red);border-color:#4a2a2a}
.mode-btn.org-on{background:#1a1a2a;color:#a78bfa;border-color:#3a2a5a}
.mode-btn.thr-on{background:#2a2310;color:#eab308;border-color:#4a3a1a}
.origin-hint{color:#888;font-size:10px;margin-left:2px}
.official-banner{background:#2a1a1a;border:1px solid #4a2a2a;border-radius:4px;padding:6px 10px;margin:6px 0;font-size:11px;color:var(--red);display:flex;align-items:center;gap:6px}
.official-banner b{color:var(--red)}
.drought-banner{background:#2a2a1a;border:1px solid #4a4a2a;border-radius:4px;padding:6px 10px;margin:6px 0;font-size:11px;color:var(--orange);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.drought-banner b{color:var(--orange)}
.combo-bar{display:flex;align-items:center;gap:6px;margin:4px 0 6px 0;padding:4px 8px;background:#151525;border:1px dashed #2a2a3a;border-radius:4px;flex-wrap:wrap;font-size:10px}
.combo-label{color:#778;margin-right:2px}
.combo-btn{background:#1a1a2a;color:#aab;border:1px solid #2a2a3a;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:10px;transition:all .15s}
.combo-btn:hover{background:#2a2a3a;color:#cce}
.combo-btn.dao{border-color:#3a2a5a;color:#a78bfa}
.combo-btn.dao:hover{background:#1a1a2a;color:#c4a5ff}
.combo-btn.pure{border-color:#4a3a1a;color:#eab308}
.combo-btn.pure:hover{background:#2a2310;color:#ffc52d}
.combo-now{color:#556;margin-left:auto;font-size:10px}
.combo-now.dao{color:#a78bfa}
.combo-now.pure{color:#eab308}
.combo-now.mix{color:#e56}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.mon-dot.grace{background:var(--orange);animation:pulse 1s infinite}
.mon-dot.burst-dot{background:var(--red);animation:pulse .5s infinite}
.monitor-bar.burst{background:#2a1a1a;border-color:#4a2a2a;color:var(--red)}
.live-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--green);margin:0 2px;flex-shrink:0;animation:pulse 2s infinite}
.fresh{color:var(--green);font-size:14px;line-height:1;flex-shrink:0;margin:0 1px}
.row.quota-flash{animation:qflash .6s}
@keyframes qflash{0%{background:#5a3a0a}100%{background:transparent}}
</style></head><body>

<div class="hd">
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-val" style="color:${poolColor}">${stats.totalD}D</div>
      <div class="stat-label">日额度总计</div>
    </div>
    <div class="stat-card">
      <div class="stat-val" style="color:${poolColor}">${stats.totalW}W</div>
      <div class="stat-label">周额度总计</div>
    </div>
  </div>
  <div class="pool-bar"><div class="pool-fill" style="width:${poolPct}%"></div></div>
  <div class="st">
    <span><b>${stats.available}</b> 可用</span>
    <span class="${stats.exhausted > 0 ? "ex" : ""}"><b>${stats.exhausted}</b> 耗尽</span>
    ${stats.waiting > 0 ? `<span style="color:var(--orange)"><b>${stats.waiting}</b> 等重置</span>` : ""}
    <span>切<b>${stats.switches}</b></span>
    <span><b>${stats.pwCount}</b>号</span>
    ${stats.unchecked > 0 ? `<span style="color:var(--blue)"><b>${stats.unchecked}</b>未验</span>` : ""}
  </div>
  ${activeHtml}
  ${monitorStatus}
  <div class="mode-bar">
    <span class="mode-label">模式:</span>
    <button class="mode-btn${_mode === "wam" ? " wam-on" : ""}" onclick="setWamMode('wam')" title="WAM 多号自动切换">&#9889; WAM切号</button>
    <button class="mode-btn${_mode === "official" ? " off-on" : ""}" onclick="setWamMode('official')" title="官方原生登录 · 停 WAM 引擎">&#128273; 官方登录</button>
  </div>
  ${_mode === "official" ? '<div class="official-banner"><b>&#128274; 官方登录模式</b><br>WAM 引擎已停 (切号/心跳/文件监听)<br>切回 WAM 模式可恢复自动轮转</div>' : ""}
  ${stats.drought ? `<div class="drought-banner">&#127964;&#65039; <b>Weekly干旱模式</b> 全池W耗尽·仅靠Daily轮换·周重置${stats.hrsToWeekly.toFixed(1)}h后 · <span style="color:var(--green)">不再因W0无效切号</span></div>` : ""}
</div>

<!-- 5 显性按钮已内化为自动机制 · 太上不知有之 -->

<div class="batch-bar" id="batchBar">
  <span>已选 <b id="batchCount">0</b> 个</span>
  <button onclick="batchDelete()">批量删除</button>
  <button onclick="clearSelection()" style="background:#333;color:var(--blue)">取消</button>
</div>

<div class="add-section">
  <div class="add-header" onclick="toggleAdd()">
    <span>&#43; 添加账号</span>
    <span id="addArrow">&#9660;</span>
  </div>
  <div class="add-body" id="addBody">
    <textarea id="addInput" placeholder="支持多种格式，每行一个：\nemail:password\nemail password\nemail\tpassword\nemail----password\nemail|password\n密码:邮箱（反向也行）"></textarea>
    <div class="add-actions">
      <button onclick="doAdd()">添加</button>
    </div>
    <div class="add-hint">支持批量粘贴，自动识别各种分隔符格式</div>
  </div>
</div>

<div class="sec" style="display:flex;justify-content:space-between;align-items:center">
  <span>&#9660; 账号列表</span>
  <button onclick="copyAll()" title="一键复制所有账号到剪贴板 (email:password 格式 · 每行一个)" style="background:#2d3f5c;color:var(--blue);border:1px solid #3a5178;padding:2px 8px;border-radius:3px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">&#128203; 一键导出</button>
</div>
<div id="list">${rows}</div>

<div class="toast" id="toast"></div>

<script>
const vscode = acquireVsCodeApi();

function send(type, index) { vscode.postMessage({type, index}); }
function setWamMode(mode) { vscode.postMessage({type:'setMode', mode}); }
// v17.36 · setOrigin/setCombo 已剥离 · 保留空函数防 HTML 残留调用
function setOrigin() {}
function setCombo() {}
function sw(i) { send('switch', i); }
function cp(i) { vscode.postMessage({type:'copyAccount', index:i}); }
function rm(i) { send('remove', i); }
function sk(i) { vscode.postMessage({type:'toggleSkip', index:i}); }
// v17.42.7: 一键导出所有账号到剪贴板
function copyAll() { vscode.postMessage({type:'copyAllAccounts'}); }

function toggleAdd() {
  const body = document.getElementById('addBody');
  body.classList.toggle('open');
  document.getElementById('addArrow').textContent = body.classList.contains('open') ? '\\u25B2' : '\\u25BC';
}

function doAdd() {
  const ta = document.getElementById('addInput');
  const text = ta.value.trim();
  if (!text) return;
  vscode.postMessage({type:'addBatch', text});
  ta.value = '';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1500);
}

// 批量选择
function updateBatchBar() {
  const checked = document.querySelectorAll('.chk:checked');
  const bar = document.getElementById('batchBar');
  const cnt = document.getElementById('batchCount');
  cnt.textContent = checked.length;
  bar.classList.toggle('visible', checked.length > 0);
}

function batchDelete() {
  const indices = [...document.querySelectorAll('.chk:checked')].map(c => parseInt(c.dataset.i));
  if (indices.length === 0) return;
  vscode.postMessage({type:'removeBatch', indices});
}

function clearSelection() {
  document.querySelectorAll('.chk:checked').forEach(c => c.checked = false);
  updateBatchBar();
}

document.addEventListener('change', e => {
  if (e.target.classList.contains('chk')) updateBatchBar();
});

window.addEventListener('message', async (e) => {
  const msg = e.data;
  // v15: Chromium\u7f51\u7edc\u6865 \u2014 \u4e07\u6cd5\u5f52\u5b97
  if (msg.type === '_fetch') {
    try {
      const opts = { method: msg.method || 'POST', headers: msg.headers || {} };
      if (msg.bodyType === 'binary' && Array.isArray(msg.body)) {
        opts.body = new Uint8Array(msg.body);
      } else if (msg.body != null) {
        opts.body = msg.body;
      }
      const resp = await fetch(msg.url, opts);
      if (msg.binary) {
        const buf = await resp.arrayBuffer();
        vscode.postMessage({ type: '_fetchResult', id: msg.id, ok: true, status: resp.status, data: Array.from(new Uint8Array(buf)) });
      } else {
        const text = await resp.text();
        vscode.postMessage({ type: '_fetchResult', id: msg.id, ok: true, status: resp.status, data: text });
      }
    } catch (err) {
      vscode.postMessage({ type: '_fetchResult', id: msg.id, ok: false, error: err.message });
    }
    return;
  }
  if (msg.type === 'switching') {
    const row = document.querySelector('.row[data-i="' + msg.index + '"]');
    if (row) { row.classList.add('switching'); showToast('\u6B63\u5728\u5207\u6362...'); }
  }
  if (msg.type === 'toast') showToast(msg.text);
  if (msg.type === 'quotaChange') {
    // 额度变动: 闪烁对应行, 显示变动信息
    const email = (msg.email || '').toLowerCase();
    const row = document.querySelector('.row[data-email="' + email + '"]');
    if (row) {
      row.classList.add('quota-flash', 'in-use');
      setTimeout(() => row.classList.remove('quota-flash'), 700);
    }
    showToast('D' + msg.prevD + '\\u2192' + msg.curD + ' W' + msg.prevW + '\\u2192' + msg.curW + ' \\u26A1\\u81EA\\u52A8\\u5207\\u53F7');
  }
});
</script>
</body></html>`;
}

// ============================================================
// Auto-rotate
// ============================================================
async function doAutoRotate(store) {
  const current = store.activeIndex;
  const drought = isWeeklyDrought();
  if (current >= 0) {
    const h = store.getHealth(store.get(current));
    if (isAccountSwitchable(h)) {
      // v17.8 道法自然: 手动提示纯按真实 D/W 渲染 · 无永续/Devin 分支文案
      const hrsD = hoursUntilDailyReset();
      const hrsW = hoursUntilWeeklyReset();
      const droughtTag = drought ? " [🏜️干旱模式·只看D]" : "";
      _notifyInfo(
        `WAM: 当前账号可用 D${Math.round(h.daily)}%·W${Math.round(h.weekly)}% | 日重置${hrsD.toFixed(1)}h·周重置${hrsW.toFixed(1)}h${droughtTag}`,
        "user",
      );
      return;
    }
  }
  const bestI = store.getBestIndex(current);
  if (bestI < 0) {
    const hrsD = hoursUntilDailyReset();
    const hrsW = hoursUntilWeeklyReset();
    const msg = drought
      ? `WAM: 🏜️干旱模式·D+W全面耗尽 (日重置${hrsD.toFixed(1)}h后·周重置${hrsW.toFixed(1)}h后)`
      : `WAM: 无可用账号 (日重置在${hrsD.toFixed(1)}h后)`;
    _notifyWarn(msg, "user");
    return;
  }
  const acc = store.get(bestI);
  // 智能轮转也需要抢占检查
  if (_switching) {
    const lockAge = Date.now() - _switchingStartTime;
    if (lockAge < 30000) {
      _notifyWarn(
        `WAM: 正在切换中(${Math.round(lockAge / 1000)}s)...请稍候`,
        "user",
      );
      return;
    }
    log(
      `autoRotate: 手动抢占 — 强制释放超时锁(${Math.round(lockAge / 1000)}s)`,
    );
    _switching = false;
  }
  _switching = true;
  _switchingStartTime = Date.now();
  try {
    const result = await switchToAccount(acc.email, acc.password);
    if (result.ok) {
      _afterSwitchSuccess(bestI, acc.email); // v17.42.2 不变量统一
      const droughtTag = drought ? " [干旱·D轮换]" : "";
      _notifyInfo(
        `WAM: 智能轮转到 ${result.account} (${result.ms}ms)${droughtTag}`,
        "user",
      );
      _ensureEngines();
    } else {
      _notifyError(`WAM: 轮转失败 — ${result.error}`);
    }
  } finally {
    _switching = false;
  }
}

// ============================================================
// 文件监听 — 外部bridge兼容
// ============================================================
function startFileWatcher() {
  // 防重入 — 已有watcher则不创建新的
  if (_watcher) return;
  try {
    fs.mkdirSync(WAM_DIR, { recursive: true });
  } catch {}
  _watcher = fs.watch(WAM_DIR, (eventType, filename) => {
    // 同时监听rename和change事件 (不同OS行为不同)
    if (
      filename === "oneshot_token.json" &&
      (eventType === "rename" || eventType === "change")
    ) {
      setTimeout(async () => {
        // 先检查文件是否存在, 避免无效rename抛错污染日志
        if (!fs.existsSync(TOKEN_FILE)) return;
        // 真原子性 — renameSync是文件系统级原子操作, 只有一个实例能成功rename
        const claimFile = path.join(WAM_DIR, `_claimed_${_instanceId}.json`);
        let rawData;
        try {
          fs.renameSync(TOKEN_FILE, claimFile); // 原子rename: 仅第一个成功, 其余ENOENT
          rawData = fs.readFileSync(claimFile, "utf8");
          try {
            fs.unlinkSync(claimFile);
          } catch {}
        } catch {
          return;
        } // rename失败 = 其他实例已抢走
        if (!isWamMode()) {
          log("watcher: skip injection (official mode)");
          return;
        }
        try {
          const data = JSON.parse(rawData);
          if (!data.idToken) return;
          log(`watcher: external token for ${data.email || "?"}`);
          const result = await injectAuth(data.idToken);
          try {
            fs.writeFileSync(
              RESULT_FILE,
              JSON.stringify({
                ok: result.ok,
                ts: Date.now(),
                email: data.email || "",
                account: result.account || "",
                apiKey: result.ok
                  ? (result.apiKey || "").substring(0, 25) + "..."
                  : "",
                error: result.error || undefined,
                sessionId: result.sessionId || "",
              }),
            );
          } catch (we) {
            log(`watcher: result write fail: ${we.message}`);
          }
          log(
            `watcher: inject ${result.ok ? "OK" : "FAIL"}: ${result.account || result.error}`,
          );
          refreshAll();
        } catch (e) {
          log(`watcher error: ${e.message}`);
        }
      }, 500);
    }
  });
  _watcher.on("error", (err) => {
    log(`watcher error event: ${err?.message || "unknown"}`);
    _watcher = null;
    // v17.9 软编码: watcher 重启延迟可通过 wam.watcherRestartDelayMs 覆盖
    setTimeout(startFileWatcher, _getWatcherRestartDelayMs());
  });
  log("watcher: started");
}

// ============================================================
// 自诊断 — 道法自然·验证一切
// ============================================================
async function selfTest() {
  const results = [];
  const t0 = Date.now();

  // 1. 代理检测 (v16.0: 统一描述符 — 系统代理 + LAN网关 + 动态扫描)
  try {
    const sysProxy = _getSystemProxy();
    const gateway = _detectDefaultGateway();
    const proxy = await _detectProxy();
    const parts = [];
    if (proxy) parts.push(`${proxy.host}:${proxy.port}(${proxy.source})`);
    if (sysProxy)
      parts.push(`sys=${sysProxy.source}(${sysProxy.host}:${sysProxy.port})`);
    if (gateway) parts.push(`gw=${gateway}`);
    if (!proxy && !sysProxy) parts.push("no proxy found");
    results.push({
      test: "proxy",
      ok: !!proxy || !!sysProxy,
      detail: parts.join(" | "),
    });
  } catch (e) {
    results.push({ test: "proxy", ok: false, detail: e.message });
  }

  // 1.5 Chromium原生网络桥 (v15.1: 万法归宗·自动确保)
  try {
    // selfTest时也尝试auto-ensure bridge
    if (!_getActiveWebview()) _ensureBridgeWebview();
    const wvAvail = !!_getActiveWebview();
    const bridgeSrc =
      _sidebarProvider && _sidebarProvider._view
        ? "sidebar"
        : _editorPanel
          ? "editor"
          : "none";
    if (wvAvail) {
      const nativeBody = JSON.stringify({ returnSecureToken: true });
      try {
        const nr = await _nativeFetch(
          `https://${_getFirebaseHost()}/v1/accounts:signUp?key=${_getFirebaseKeys()[0]}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: nativeBody,
            timeout: 8000,
          },
        );
        results.push({
          test: "native_bridge",
          ok: true,
          detail: `Chromium fetch OK (status:${nr.status}) via ${bridgeSrc} [bridgeReady=${_bridgeReady}]`,
        });
      } catch (e) {
        results.push({
          test: "native_bridge",
          ok: false,
          detail: `webview(${bridgeSrc}) avail but fetch failed: ${e.message}`,
        });
      }
    } else {
      results.push({
        test: "native_bridge",
        ok: false,
        detail: `no webview — auto-ensure failed [bridgeReady=${_bridgeReady}]`,
      });
    }
  } catch (e) {
    results.push({ test: "native_bridge", ok: false, detail: e.message });
  }

  // 2. Firebase连通性
  try {
    const testBody = JSON.stringify({ returnSecureToken: true });
    const proxy = await _detectProxy();
    let fbOk = false;
    if (proxy) {
      try {
        const r = await _httpsViaProxy(
          proxy.host,
          proxy.port,
          `https://${_getFirebaseHost()}/v1/accounts:signUp?key=${_getFirebaseKeys()[0]}`,
          testBody,
          8000,
          { Referer: _getFirebaseReferer() },
        );
        fbOk = !!r;
      } catch {}
    }
    if (!fbOk) {
      try {
        const r = await _httpsPost(
          `https://${_getFirebaseHost()}/v1/accounts:signUp?key=${_getFirebaseKeys()[0]}`,
          testBody,
          { timeout: 8000 },
        );
        fbOk = !!r;
      } catch {}
    }
    results.push({
      test: "firebase",
      ok: fbOk,
      detail: fbOk ? "reachable" : "unreachable",
    });
  } catch (e) {
    results.push({ test: "firebase", ok: false, detail: e.message });
  }

  // 3. 官方API端点
  try {
    let officialOk = false;
    let okEndpoint = "";
    const proxy = await _detectProxy();
    const dummyProto = encodeProtoString("test");
    for (const url of _getOfficialPlanStatusUrls()) {
      try {
        let resp;
        if (proxy) {
          resp = await _httpsPostRawViaProxy(
            proxy.host,
            proxy.port,
            url,
            dummyProto,
            8000,
          );
        } else {
          resp = await _httpsPostRaw(url, dummyProto, { timeout: 8000 });
        }
        if (resp.status && resp.status < 500) {
          officialOk = true;
          okEndpoint = new URL(url).hostname;
          break;
        }
      } catch {}
    }
    results.push({
      test: "official_api",
      ok: officialOk,
      detail: officialOk
        ? `${okEndpoint} reachable`
        : "all endpoints unreachable",
    });
  } catch (e) {
    results.push({ test: "official_api", ok: false, detail: e.message });
  }

  // 4. Relay端点 — relay未配置时跳过
  const selfTestRelayHost = _getRelayHost();
  if (selfTestRelayHost) {
    try {
      let relayOk = false;
      const ip = await _resolveRelayIP();
      if (ip) {
        try {
          const dummyProto = encodeProtoString("test");
          const rPlanUrl = `https://${selfTestRelayHost}/windsurf/plan-status`;
          const resp = await _httpsPostRaw(rPlanUrl, dummyProto, {
            timeout: 8000,
            hostname: ip,
          });
          relayOk = resp.status && resp.status < 500;
        } catch {}
      }
      results.push({
        test: "relay",
        ok: relayOk,
        detail: relayOk
          ? `${ip} reachable`
          : ip
            ? `${ip} unreachable`
            : "DNS failed",
      });
    } catch (e) {
      results.push({ test: "relay", ok: false, detail: e.message });
    }
  } else {
    results.push({
      test: "relay",
      ok: true,
      detail: "not configured (skipped)",
    });
  }

  // 5. 注入命令可用性
  try {
    const availCmds = await vscode.commands.getCommands(true);
    const found = _getInjectCommands().filter((c) => availCmds.includes(c));
    results.push({
      test: "inject_cmd",
      ok: found.length > 0,
      detail: found.length > 0 ? found.join(", ") : "no inject command found",
    });
    if (found.length > 0 && !_workingInjectCmd) {
      _workingInjectCmd = found[0];
      log(`selfTest: inject cmd detected → ${found[0]}`);
    }
  } catch (e) {
    results.push({ test: "inject_cmd", ok: false, detail: e.message });
  }

  const ms = Date.now() - t0;
  const allOk = results.every((r) => r.ok);
  const summary = results
    .map((r) => `${r.ok ? "✓" : "✗"} ${r.test}: ${r.detail}`)
    .join("\n");
  log(`selfTest [${ms}ms] ${allOk ? "ALL PASS" : "SOME FAIL"}:\n${summary}`);
  return { ok: allOk, results, ms, summary };
}

// ============================================================
// 激活 — v14.0 · 道法自然 · 万法归宗 · 反者道之动
// ============================================================
function activate(context) {
  _activateTs = Date.now(); // v17.42.19: 宽限期基准 · 必须最先
  // ── v17.42.8: 同步隔离死代理 env + undici Dispatcher 重置 — 必须第一行 ──
  // 为何必须最先: Electron Chromium net + Node undici 首次 fetch 即锁 ProxyAgent
  //   v17.42.6 异步 purge 有 2s TCP probe 窗口 · 窗口内 ProxyAgent 已被 cache · delete env 无效
  //   v17.42.8 同步 quarantine: 零秒窗口 · 早于任何 fetch/https.request · 内存备份原值
  //   同时 setGlobalDispatcher(new undici.Agent()) 重置已 cache 的 ProxyAgent (防其它扩展先 activate 已中毒)
  const _qN = _quarantineEnvProxySync();

  // ── v17.42.13 · 道冲用之不盈 · 存储初始化四级容错 · 曲则全 ──
  // 级0  全活 (99%)        · 产品名+DATA_DIR+WAM_DIR 全部解析成功且可写
  // 级1  storage-readonly · WAM_DIR 五级兜底后仍不可写 · 降级为纯内存模式
  // 级2  storage-partial  · PRODUCT_NAME/DATA_DIR 解析异常 · 仍沿用默认
  // 级3  storage-none     · 初始化全盘崩 · 仅注册最小命令集 (诊断 + selfTest)
  let _activateDegraded = null;
  const _activateErrs = [];
  try {
    // 道法自然: 动态初始化产品名和数据目录
    PRODUCT_NAME = _detectProductName() || "Windsurf";
  } catch (e) {
    _activateErrs.push(`detectProduct: ${e && e.message ? e.message : e}`);
  }
  try {
    DATA_DIR = _resolveDataDir(PRODUCT_NAME) || "";
  } catch (e) {
    _activateErrs.push(`resolveDataDir: ${e && e.message ? e.message : e}`);
  }
  try {
    // v17.41 唯变所适 · v17.42.13 五级兜底: WAM_DIR 动态解析 · 派生路径随之更新
    WAM_DIR = _resolveWamDir(context);
    _deriveWamPaths();
    // v17.42.13 最终可写性复验 · 五级兜底后仍不可写 → 降级
    if (!_isPathWritable(WAM_DIR)) {
      _activateDegraded = "storage-readonly";
      _activateErrs.push(`wamDirNotWritable: ${WAM_DIR}`);
    }
  } catch (e) {
    _activateDegraded = _activateDegraded || "storage-partial";
    _activateErrs.push(`resolveWamDir: ${e && e.message ? e.message : e}`);
  }
  try {
    log(
      `activate v${WAM_VERSION}-\u9053\u6cd5\u81ea\u7136 — inst=${_instanceId} product=${PRODUCT_NAME} dataDir=${DATA_DIR} wamDir=${WAM_DIR}${_activateDegraded ? ` \u00b7 DEGRADED(${_activateDegraded})` : ""} \u7edf\u4e00\u4ee3\u7406\u63cf\u8ff0\u7b26\u00b7\u96f6\u786e\u5b9a\u672c\u6e90`,
    );
    if (_activateErrs.length > 0) {
      log(
        `\u26a0\ufe0f activate errs [${_activateErrs.length}]: ${_activateErrs.join(" | ")}`,
      );
    }
  } catch {}
  if (_qN > 0) {
    try {
      log(
        `env-proxy quarantine: 同步隔离 ${_qN} 个 env 代理变量 + undici Dispatcher 已重置 (异步 TCP 验活中)`,
      );
    } catch {}
  }

  // ── v17.42.8 异步 TCP 验活 + 活代理回写 — fire-and-forget ──
  //   活: 回写 env (不损失用户真代理)
  //   死: 保持隔离 (_detectProxy 自扫 localhost/gateway 兜底)
  _verifyAndRestoreEnvProxy().catch((e) =>
    log(`env-proxy verify err: ${e.message}`),
  );

  const gsPath =
    context.globalStorageUri?.fsPath ||
    path.join(DATA_DIR, "User", "globalStorage");
  _store = new AccountStore(gsPath);
  _loadSnapshots(); // 恢复上次快照 (首次扫描就能检测变化)
  _loadInUse(_store); // 恢复使用中标记 (重启不丢失)
  loadMode();
  // v17.36 · 反者道之动 · proxy/origin 启动逻辑已剥离 · WAM 纯切号
  log(
    `startup mode: ${_mode} | snapshots: ${_quotaSnapshots.size} | inUse: ${_store._inUse.size}`,
  );

  // 检测活跃账号 (从marker文件)
  const markerPaths = [path.join(WAM_DIR, "_active_account.txt")];
  for (const mp of markerPaths) {
    try {
      if (fs.existsSync(mp)) {
        const ae = fs.readFileSync(mp, "utf8").trim();
        for (let i = 0; i < _store.accounts.length; i++) {
          if (_store.accounts[i].email === ae) {
            _store.activeIndex = i;
            break;
          }
        }
        if (_store.activeIndex >= 0) break;
      }
    } catch {}
  }

  // ── 侧边栏面板 ──
  _sidebarProvider = new WamViewProvider(_store);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("wam.panel", _sidebarProvider),
  );

  // ── v15.1: 网络环境变化感知 — 反者道之动·代理变则缓存废 ──
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("http.proxy") ||
        e.affectsConfiguration("http.proxyStrictSSL")
      ) {
        log("network: http.proxy config changed → invalidate proxy cache");
        _invalidateProxyCache();
      }
    }),
  );

  // ── v17.42.19: Bridge延迟唤醒 — 延至 T+55s · 在引擎启动前 5s 就绪 · 防冷启负载 ──
  _bridgeEnsureTimer = setTimeout(() => {
    _bridgeEnsureTimer = null;
    if (!_bridgeReady && isWamMode()) {
      log("bridge: sidebar未在55s内就绪 → 静默唤醒侧边栏");
      try {
        vscode.commands.executeCommand("wam.panel.focus");
      } catch (e) {
        log(`bridge: sidebar唤醒失败: ${e.message}`);
      }
    }
  }, 55000);
  context.subscriptions.push({
    dispose() {
      if (_bridgeEnsureTimer) clearTimeout(_bridgeEnsureTimer);
    },
  });

  // ── 状态栏小标 (右下角) ──
  _statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  _statusBarItem.command = "wam.openEditor";
  updateStatusBar();
  _statusBarItem.show();
  context.subscriptions.push(_statusBarItem);

  // ── 注册命令 ──
  context.subscriptions.push(
    vscode.commands.registerCommand("wam.openEditor", () => {
      openEditorPanel();
    }),
    // 手动切号: 无任何限制 (不检查in-use, 不跳过任何账号)
    vscode.commands.registerCommand("wam.switchAccount", async () => {
      // 官方模式下不自动翻转, 明确提示用户
      if (_mode === "official") {
        const choice = await vscode.window.showWarningMessage(
          "WAM: 当前为官方模式，切号将切回WAM模式。确认？",
          "切回WAM模式",
          "取消",
        );
        if (choice !== "切回WAM模式") return;
        saveMode("wam");
        _restartBackgroundServices();
        log("switchAccount: user confirmed → wam mode");
      }
      const items = _store.accounts.map((a, idx) => {
        const i = idx;
        const h = _store.getHealth(a);
        // v17.42.17 重新锚定本源: 本对话 turn 显 [使用中] · 跨实例协调显 [协调]
        let inUse = "";
        if (_store.isInUseByThisConversation(a.email)) {
          const turnCount =
            typeof _activeTurnsByEmail === "function"
              ? _activeTurnsByEmail(a.email).length
              : 1;
          inUse = turnCount > 1 ? ` [使用中×${turnCount}]` : " [使用中]";
        } else if (_store._inUse.has(a.email.toLowerCase())) {
          inUse = " [协调]";
        }
        const liveTag = h.hasSnap ? "●" : "";
        // v17.8 道法自然: QuickPick 描述纯按真实 D/W + h.plan (Trial/Pro/Devin未验等) 渲染
        const description = `${liveTag}D${Math.round(h.daily)}%·W${Math.round(h.weekly)}% ${h.plan}`;
        return {
          label: `${idx + 1}. ${a.email}${inUse}`,
          description,
          index: i,
        };
      });
      const pick = await vscode.window.showQuickPick(items, {
        placeHolder: "手动选择账号 (无任何限制)",
      });
      if (pick) {
        const acc = _store.get(pick.index);
        if (!acc || !acc.password) return;
        // 手动抢占机制 — 超过30s强制释放锁
        if (_switching) {
          const lockAge = Date.now() - _switchingStartTime;
          if (lockAge < 30000) {
            _notifyWarn(
              `WAM: 正在切换中(${Math.round(lockAge / 1000)}s)...请稍候`,
              "user",
            );
            return;
          }
          log(
            `switchAccount: 手动抢占 — 强制释放超时锁(${Math.round(lockAge / 1000)}s)`,
          );
          _switching = false;
        }
        _switching = true;
        _switchingStartTime = Date.now();
        try {
          const result = await switchToAccount(acc.email, acc.password);
          if (result.ok) {
            _store.activeIndex = pick.index;
            _store.switchCount++;
            _store.clearInUse(acc.email);
            _writeInstanceClaim(acc.email);
            _quotaSnapshots.delete(acc.email.toLowerCase()); // 重置快照基准
            _snapshotDirty = true;
            _schedulePersist();
            _store.save();
            _notifyInfo(`WAM: 已手动切换到 ${result.account}`, "user");
            _ensureEngines();
          }
        } finally {
          _switching = false;
          refreshAll();
        }
      }
    }),
    vscode.commands.registerCommand("wam.refreshAll", () => {
      _store.load();
      _store.lastRefresh = Date.now();
      refreshAll();
      _notifyInfo(`WAM: 已刷新 ${_store.pwCount()} 个账号`, "user");
    }),
    // v17.3 道法自然: 从归档恢复 — 挽救被秒删的账号
    vscode.commands.registerCommand("wam.restore", async () => {
      const archPath = path.join(
        path.dirname(_store._path),
        "_wam_purged.json",
      );
      if (!fs.existsSync(archPath)) {
        _notifyInfo("WAM: 归档文件不存在, 无可恢复", "user");
        return;
      }
      let arch = [];
      try {
        arch = JSON.parse(fs.readFileSync(archPath, "utf8"));
        if (!Array.isArray(arch)) arch = [];
      } catch (e) {
        _notifyError(`WAM: 归档文件解析失败: ${e.message}`);
        return;
      }
      if (arch.length === 0) {
        _notifyInfo("WAM: 归档为空", "user");
        return;
      }
      // 按归档时间倒序
      arch.sort((a, b) => (b._purgedAt || 0) - (a._purgedAt || 0));
      const items = arch.map((a, i) => {
        const age = a._purgedAt
          ? Math.round((Date.now() - a._purgedAt) / 86400000) + "天前"
          : "?";
        return {
          label: `${a.email}`,
          description: `${age} · ${a._purgeReason || "?"}`,
          detail: `plan=${(a.usage || {}).plan || "?"} D${(a.usage || {}).daily || 0} W${(a.usage || {}).weekly || 0}`,
          acc: a,
          idx: i,
        };
      });
      const picks = await vscode.window.showQuickPick(items, {
        placeHolder: `选择要恢复的账号 (共 ${arch.length} 个归档, 可多选)`,
        canPickMany: true,
      });
      if (!picks || picks.length === 0) return;
      const poolEmails = new Set(
        _store.accounts.map((a) => (a.email || "").toLowerCase()),
      );
      let restored = 0,
        dup = 0;
      const restoredEmails = new Set();
      for (const p of picks) {
        const em = (p.acc.email || "").toLowerCase();
        if (poolEmails.has(em)) {
          dup++;
          continue;
        }
        // 清除失败标记, 给账号新机会
        const clean = { ...p.acc };
        delete clean._verifyFailed;
        delete clean._verifyFailedAt;
        delete clean._verifyFailedCount;
        delete clean._switchFailed;
        delete clean._switchFailedAt;
        delete clean._switchFailedCount;
        delete clean._injectFailed; // v17.42.9: inject-dead 标记
        delete clean._injectFailedAt; // v17.42.9
        delete clean._injectFailedCount; // v17.42.9
        delete clean._purgeReason;
        delete clean._purgedAt;
        _store.accounts.push(clean);
        restoredEmails.add(em);
        restored++;
      }
      // 从归档中移除已恢复的
      const newArch = arch.filter(
        (a) => !restoredEmails.has((a.email || "").toLowerCase()),
      );
      try {
        fs.writeFileSync(archPath, JSON.stringify(newArch, null, 2), "utf8");
      } catch (e) {
        log(`restore: archive rewrite fail: ${e.message}`);
      }
      _store.save();
      refreshAll();
      _notifyInfo(
        `WAM: 已恢复 ${restored} 个账号 (${dup} 个与池中重复已跳过). 可重新测试登录.`,
        "user",
      );
    }),
    // v17.3 道法自然: 写盘诊断 — 主动探查 save 失败根因
    vscode.commands.registerCommand("wam.diagWrite", async () => {
      const checks = [];
      // 1. 主路径
      const primaryPath = _store._path;
      const primaryDir = path.dirname(primaryPath);
      const sharedPath = _store._sharedPath;
      const sharedDir = sharedPath ? path.dirname(sharedPath) : null;
      const wamDir = WAM_DIR;
      const purgedPath = path.join(primaryDir, "_wam_purged.json");
      // 测试 4 个关键路径的写入能力
      for (const [name, dir, file] of [
        ["primary accounts dir", primaryDir, primaryPath],
        ["shared accounts dir", sharedDir, sharedPath],
        ["wam-hot log dir", wamDir, LOG_FILE],
        ["purge archive dir", primaryDir, purgedPath],
      ]) {
        if (!dir) {
          checks.push({ name, status: "skip", note: "(未配置)" });
          continue;
        }
        const probe = path.join(dir, `_wam_write_probe_${Date.now()}.txt`);
        try {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(probe, "ok", "utf8");
          const read = fs.readFileSync(probe, "utf8");
          fs.unlinkSync(probe);
          // 测真实文件 append 1 字节
          let appendOk = false,
            appendErr = null;
          try {
            if (fs.existsSync(file)) {
              const stat = fs.statSync(file);
              const orig = fs.readFileSync(file);
              fs.writeFileSync(file, orig); // 不变原文件, 但测 write 能力
              appendOk = true;
            } else {
              appendOk = null; // 文件不存在, 无法测
            }
          } catch (e) {
            appendErr = `${e.code || ""} ${e.message}`;
          }
          checks.push({
            name,
            status: "ok",
            dir,
            file,
            probe: read === "ok" ? "R/W ok" : "WRITE ok but READ bad",
            existingWrite:
              appendOk === null
                ? "N/A (file absent)"
                : appendOk
                  ? "OK"
                  : `FAIL: ${appendErr}`,
          });
        } catch (e) {
          checks.push({
            name,
            status: "fail",
            dir,
            file,
            error: `${e.code || ""} ${e.message}`,
          });
        }
      }
      // 2. 各关键文件当前 mtime
      const fileInfo = [];
      for (const [name, p] of [
        ["primary accounts", primaryPath],
        ["shared accounts", sharedPath],
        ["purge archive", purgedPath],
        ["wam log", LOG_FILE],
      ]) {
        if (!p) {
          fileInfo.push({ name, note: "(not configured)" });
          continue;
        }
        try {
          if (!fs.existsSync(p)) {
            fileInfo.push({ name, exists: false, path: p });
          } else {
            const st = fs.statSync(p);
            fileInfo.push({
              name,
              exists: true,
              path: p,
              size: st.size,
              mtime: new Date(st.mtimeMs).toISOString(),
              age_sec: Math.round((Date.now() - st.mtimeMs) / 1000),
            });
          }
        } catch (e) {
          fileInfo.push({ name, path: p, error: e.message });
        }
      }
      // 3. 内存 vs 磁盘差
      let diskCount = -1;
      try {
        if (fs.existsSync(primaryPath)) {
          diskCount = JSON.parse(fs.readFileSync(primaryPath, "utf8")).length;
        }
      } catch {}
      const memCount = _store.accounts.length;
      const divergence = { memCount, diskCount, delta: memCount - diskCount };
      // 4. 强制触发 save + 观察是否生效
      const beforeMtime = fs.existsSync(primaryPath)
        ? fs.statSync(primaryPath).mtimeMs
        : 0;
      _store.save();
      const afterMtime = fs.existsSync(primaryPath)
        ? fs.statSync(primaryPath).mtimeMs
        : 0;
      const saveDetection = {
        before: new Date(beforeMtime).toISOString(),
        after: new Date(afterMtime).toISOString(),
        saveWorked: afterMtime > beforeMtime,
      };
      // 输出诊断报告到新文档
      const report = {
        _timestamp: new Date().toISOString(),
        _store_path: primaryPath,
        _shared_path: sharedPath,
        _wam_hot: wamDir,
        checks,
        files: fileInfo,
        divergence,
        saveDetection,
      };
      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(report, null, 2),
        language: "json",
      });
      await vscode.window.showTextDocument(doc);
      const msg = saveDetection.saveWorked
        ? `WAM 写盘诊断: save() OK (内存${memCount} 磁盘${diskCount})`
        : `WAM 写盘诊断: save() 未更新 mtime! 检查 checks[*].existingWrite 和 error 字段`;
      if (saveDetection.saveWorked) _notifyInfo(msg, "user");
      else _notifyWarn(msg, "user");
    }),
    // v17.42.15 载营魄抱一 · 健康诊断 + 一键自愈
    vscode.commands.registerCommand("wam.healthCheck", async () => {
      const primaryDir = path.dirname(_store._path);
      const backupDir = path.join(primaryDir, "_wam_backups");
      const journalPath = path.join(primaryDir, "_wam_journal.jsonl");
      const purgedPath = path.join(primaryDir, "_wam_purged.json");
      const lockPath = path.join(primaryDir, "_wam_store.lock");

      // 诊断各路状态
      const primary = _safeReadAccountsFile(_store._path);
      const shared = _safeReadAccountsFile(_store._sharedPath);
      const legacy = _store._legacyPath
        ? _safeReadAccountsFile(_store._legacyPath)
        : { ok: false, err: "no-legacy-path" };
      const backups = _scanAccountBackups(backupDir);
      const purged = _safeReadAccountsFile(purgedPath);

      let journalLines = 0,
        journalBytes = 0,
        lastJournal = null;
      try {
        if (fs.existsSync(journalPath)) {
          const jst = fs.statSync(journalPath);
          journalBytes = jst.size;
          const lines = fs
            .readFileSync(journalPath, "utf8")
            .split("\n")
            .filter(Boolean);
          journalLines = lines.length;
          if (lines.length > 0) {
            try {
              lastJournal = JSON.parse(lines[lines.length - 1]);
            } catch {}
          }
        }
      } catch {}

      let lockInfo = null;
      try {
        if (fs.existsSync(lockPath)) {
          const raw = fs.readFileSync(lockPath, "utf8");
          lockInfo = JSON.parse(raw);
          lockInfo._age_ms = Date.now() - (lockInfo.ts || 0);
        }
      } catch {}

      const memCount = _store.accounts.length;
      const memValid = _store.pwCount();

      // 检测不一致
      const issues = [];
      if (!primary.ok) issues.push(`主文件异常: ${primary.err}`);
      if (primary.ok && primary.validCount !== memValid)
        issues.push(`主文件(${primary.validCount}) ≠ 内存(${memValid})`);
      if (shared.ok && shared.validCount !== memValid)
        issues.push(`shared(${shared.validCount}) ≠ 内存(${memValid})`);
      if (memCount === 0 && backups.length > 0 && backups[0].validCount > 0)
        issues.push(`内存空但备份有${backups[0].validCount}个有效账号!`);
      if (lockInfo && lockInfo._age_ms > 60000)
        issues.push(
          `陈旧锁文件 (PID=${lockInfo.pid}, ${Math.round(lockInfo._age_ms / 1000)}s)`,
        );

      const report = {
        _timestamp: new Date().toISOString(),
        _version: WAM_VERSION,
        memory: { total: memCount, valid: memValid },
        primary: {
          path: _store._path,
          ok: primary.ok,
          count: primary.count,
          valid: primary.validCount || 0,
          bytes: primary.bytes || 0,
          err: primary.err || null,
        },
        shared: {
          path: _store._sharedPath,
          ok: shared.ok,
          count: shared.count,
          valid: shared.validCount || 0,
          err: shared.err || null,
        },
        legacy: {
          path: _store._legacyPath || "(none)",
          ok: legacy.ok,
          count: legacy.count,
        },
        backups: {
          dir: backupDir,
          total: backups.length,
          best: backups[0]
            ? {
                file: backups[0].file,
                validCount: backups[0].validCount,
                bytes: backups[0].bytes,
              }
            : null,
        },
        purged: {
          path: purgedPath,
          ok: purged.ok,
          count: purged.count,
        },
        journal: {
          path: journalPath,
          lines: journalLines,
          bytes: journalBytes,
          last: lastJournal,
        },
        lock: lockInfo,
        issues,
        _healthy: issues.length === 0,
      };

      const doc = await vscode.workspace.openTextDocument({
        content: JSON.stringify(report, null, 2),
        language: "json",
      });
      await vscode.window.showTextDocument(doc);

      if (issues.length === 0) {
        _notifyInfo(
          `WAM 健康诊断: ✓ 全绿 (内存${memValid}有效, ${backups.length}份备份, journal ${journalLines}条)`,
          "user",
        );
      } else {
        const choice = await vscode.window.showWarningMessage(
          `WAM 健康诊断: ${issues.length}项异常 — ${issues[0]}`,
          "自动修复",
          "仅查看",
        );
        if (choice === "自动修复") {
          // 自愈: 如内存空 + 备份有效 → 从最优备份恢复
          if (
            memCount === 0 &&
            backups.length > 0 &&
            backups[0].validCount > 0
          ) {
            const recovery = _recoverFromBackupDir(backupDir);
            if (recovery) {
              _store.accounts = recovery.data.filter(
                (a) => a && a.email && a.password,
              );
              _store.save();
              refreshAll();
              _notifyInfo(
                `WAM 自愈: 从 ${recovery.srcFile} 恢复 ${_store.accounts.length} 个账号`,
                "user",
              );
            }
          }
          // 清理死锁
          if (lockInfo && lockInfo._age_ms > 60000) {
            try {
              fs.unlinkSync(lockPath);
            } catch {}
            _notifyInfo("WAM 自愈: 陈旧锁文件已清理", "user");
          }
          // 主/shared 不一致 → 强制 save 同步
          if (memValid > 0 && primary.ok && primary.validCount !== memValid) {
            _store.save();
            _notifyInfo("WAM 自愈: 主/shared 与内存已同步", "user");
          }
        }
      }
    }),
    // v17.5 道法自然: 一键复活 — 清空内存黑名单 + 重置失败计数 + Devin 探测
    vscode.commands.registerCommand("wam.clearBlacklist", async () => {
      const before = _tokenPoolBlacklist.size;
      _tokenPoolBlacklist.clear();
      _poolFailStreak.clear();
      // 扫描所有有失败标记的账号, 探测 Devin-only
      const targets = _store.accounts.filter(
        (a) =>
          a &&
          a.password &&
          a._authSystem !== "devin" &&
          (a._verifyFailed || a._verifyFailedCount > 0),
      );
      _notifyInfo(
        `WAM: 清空内存黑名单 (原 ${before}), 对 ${targets.length} 个疑似账号做 Devin 探测...`,
        "user",
      );
      let devinCount = 0,
        errCount = 0;
      for (const acc of targets) {
        try {
          // v17.5 Level 2 升级: 不止 login, 全链路验证 PostAuth 也通
          const ds = await _devinFullSwitch(acc.email, acc.password);
          if (ds.ok) {
            acc._authSystem = "devin";
            acc._devinUserId = ds.userId;
            acc._devinAccountId = ds.accountId;
            acc._devinOrgId = ds.primaryOrgId;
            acc._devinDetectedAt = Date.now();
            acc._devinSessionAt = Date.now();
            // v17.5 补完+: 打验证时戳 + _devinVerified 标记
            //   供 getHealth 识别 plan="Devin" / getBestIndex 独立评分
            acc._devinVerified = true;
            acc._lastVerified = Date.now();
            delete acc._verifyFailed;
            delete acc._verifyFailedAt;
            acc._verifyFailedCount = 0;
            delete acc._unverified;
            delete acc._switchFailed;
            delete acc._switchFailedAt;
            acc._switchFailedCount = 0;
            // v17.8 道法自然: clearBlacklist → 同步 fetchAccountQuota (此流程本身阻塞, 等拿完)
            await fetchAccountQuota(acc.email, acc.password).catch(() => {});
            devinCount++;
            log(
              `clearBlacklist: ${acc.email} → Devin 全链路通 (uid=${ds.userId} accountId=${(ds.accountId || "").substring(0, 16)}...)`,
            );
          } else {
            // 重置失败计数给 Firebase 再 3 次机会
            acc._verifyFailedCount = 0;
            delete acc._verifyFailed;
            delete acc._verifyFailedAt;
            errCount++;
            log(
              `clearBlacklist: ${acc.email} → Devin ${ds.stage || ""} 也拒绝 (${ds.error}), 重置 Firebase 计数`,
            );
          }
        } catch (e) {
          errCount++;
        }
        await new Promise((r) => setTimeout(r, 500)); // 限速
      }
      _store.save();
      refreshAll();
      _notifyInfo(
        `WAM: 复活完成 — ${devinCount} 个 Devin-only 已识别, ${errCount} 个仍需检查, 池已解锁`,
        "user",
      );
    }),
    // v17.5 Level 2: Devin 切号链路诊断 — 不真正注入, 仅验证链路完整
    // 用途: 升级前验证代码健康度, 或故障排查"切号失败"时锁定是登录/PostAuth/注入哪一环
    vscode.commands.registerCommand("wam.testDevinSwitch", async () => {
      const picks = _store.accounts
        .filter((a) => a && a.email && a.password)
        .map((a) => ({
          label: `${a.email}`,
          description: a._authSystem === "devin" ? "[Devin-only]" : "",
          email: a.email,
          password: a.password,
        }));
      if (picks.length === 0) {
        _notifyWarn("WAM: 账号池为空", "user");
        return;
      }
      const pick = await vscode.window.showQuickPick(picks, {
        placeHolder: "选择要测试 Devin 切号链路的账号 (仅验证, 不注入)",
      });
      if (!pick) return;
      _notifyInfo(`WAM: 测试 ${pick.email} Devin 链路...`, "user");
      const t0 = Date.now();
      // Step 1: devinLogin
      const dl = await _devinLogin(pick.email, pick.password);
      if (!dl.ok) {
        _notifyError(
          `WAM 测试: ${pick.email} 登录失败 (${dl.error}) — 此账号不在 Devin 体系 [${Date.now() - t0}ms]`,
        );
        return;
      }
      // Step 2: WindsurfPostAuth
      const pa = await _devinPostAuth(dl.auth1Token);
      if (!pa.ok) {
        _notifyError(
          `WAM 测试: ${pick.email} PostAuth 失败 (${pa.error}) — 登录通但换 sessionToken 失败 [${Date.now() - t0}ms]`,
        );
        return;
      }
      const ms = Date.now() - t0;
      const sessPrefix = pa.sessionToken.split("$")[0];
      log(
        `testDevinSwitch: ${pick.email} full chain OK (auth1=${dl.auth1Token.substring(0, 20)}..., session=${sessPrefix}..., accountId=${(pa.accountId || "").substring(0, 16)}...) ${ms}ms`,
      );
      vscode.window.showInformationMessage(
        `WAM 测试 ✓ ${pick.email} Devin 全链路通 [${ms}ms]\n` +
          `  user_id: ${dl.userId}\n` +
          `  accountId: ${pa.accountId}\n` +
          `  primaryOrgId: ${pa.primaryOrgId}\n` +
          `  sessionToken 前缀: ${sessPrefix}$... (Windsurf IDE 原生接受)\n` +
          `  结论: 此账号可直接切号 (切换时会用 sessionToken 注入)`,
        { modal: true },
      );
    }),
    // v17.10 太上·不知有之: wam.checkUpdate — 手动触发自动更新检查 (用户主动 · 诊断用)
    vscode.commands.registerCommand("wam.checkUpdate", async () => {
      const source = _getAutoUpdateSource();
      if (!source) {
        const choice = await vscode.window.showWarningMessage(
          "WAM: 未配置自动更新源\n\n" +
            "在 settings.json 中添加 wam.autoUpdate.source:\n" +
            '  · SMB 路径: "\\\\\\\\<host>\\\\<share>\\\\wam-bundle"\n' +
            '  · HTTPS URL (默认已开启主仓 jsDelivr): "https://cdn.jsdelivr.net/gh/zhouyoukang/windsurf-assistant@main/wam-bundle/"\n' +
            '  · 或自定 HTTPS URL: "https://<your-host>/wam-bundle"',
          { modal: true },
          "打开 settings.json",
        );
        if (choice === "打开 settings.json") {
          await vscode.commands.executeCommand(
            "workbench.action.openSettingsJson",
          );
        }
        return;
      }
      _notifyInfo(`WAM: 正在检查更新 (${source})...`, "user");
      const r = await _autoUpdateCheck(true);
      if (r.ok && r.updated) {
        // Step 3 内部已显示通知
      } else if (r.ok && !r.updated) {
        _notifyInfo(
          `WAM: 当前 v${r.localVer} 已是最新 (远端 v${r.remoteVer})`,
          "user",
        );
      } else {
        _notifyError(
          `WAM: 更新失败 · ${r.reason || "unknown"}${r.error ? " (" + r.error + ")" : ""}`,
        );
      }
    }),
    // v17.11 太上·不知有之: wam.showConfig 命令已删除 (违背"用户零感知"原则)
    // _adaptive 自适应运行时自动调节所有性能参数 · 无需用户查看
    // ops 诊断如需查看请参考 log 中 _adaptive.snapshot() 输出
    vscode.commands.registerCommand("wam.addAccount", async () => {
      const input = await vscode.window.showInputBox({
        prompt: "粘贴账号 (支持多种格式)",
        placeHolder: "email:password 或 email password 或批量粘贴",
      });
      if (input) {
        const r = _store.addBatch(input);
        refreshAll();
        if (r.added > 0) _notifyInfo(`WAM: 添加了 ${r.added} 个账号`, "user");
        else _notifyWarn(`WAM: 无法识别格式或账号已存在`, "user");
      }
    }),
    vscode.commands.registerCommand("wam.autoRotate", async () => {
      // 官方模式下智能轮转被禁用
      if (!isWamMode()) {
        _notifyWarn("WAM: 官方模式下智能轮转已禁用，请先切回WAM模式", "user");
        return;
      }
      await doAutoRotate(_store);
      refreshAll();
    }),
    vscode.commands.registerCommand("wam.panicSwitch", async () => {
      // 官方模式下紧急切换也需确认
      if (_mode === "official") {
        const choice = await vscode.window.showWarningMessage(
          "WAM: 官方模式下紧急切换将切回WAM模式",
          "确认紧急切换",
          "取消",
        );
        if (choice !== "确认紧急切换") return;
        saveMode("wam");
        _restartBackgroundServices();
      }
      const bestI = _store.getBestIndex(_store.activeIndex, false); // 紧急切换不跳过使用中
      if (bestI < 0) {
        _notifyError("WAM: 无可用账号");
        return;
      }
      const acc = _store.get(bestI);
      // 紧急切换无条件抢占 — 不等待30s, 直接强制释放
      if (_switching) {
        log(
          `panicSwitch: 强制释放锁(${Math.round((Date.now() - _switchingStartTime) / 1000)}s)`,
        );
        _switching = false;
      }
      _switching = true;
      _switchingStartTime = Date.now();
      try {
        const result = await switchToAccount(acc.email, acc.password);
        if (result.ok) {
          _afterSwitchSuccess(bestI, acc.email); // v17.42.2 不变量统一
          _writeInstanceClaim(acc.email);
          _notifyInfo(
            `WAM: 紧急切换到 ${result.account} (${result.ms}ms)`,
            "user",
          );
          _ensureEngines();
        }
      } finally {
        _switching = false;
        refreshAll();
      }
    }),
    vscode.commands.registerCommand("wam.injectToken", async () => {
      if (!fs.existsSync(TOKEN_FILE)) {
        _notifyWarn("WAM: 无待注入token", "user");
        return;
      }
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
      const result = await injectAuth(data.idToken);
      if (result.ok) {
        try {
          fs.unlinkSync(TOKEN_FILE);
        } catch {}
        _notifyInfo(`WAM: 注入成功 — ${result.account}`, "user");
      } else {
        _notifyError(`WAM: 注入失败 — ${JSON.stringify(result.error)}`);
      }
      refreshAll();
    }),
    vscode.commands.registerCommand("wam.verifyAll", async () => {
      const result = await verifyAndPurgeExpired(_store);
      refreshAll();
    }),
    vscode.commands.registerCommand("wam.scanExpiry", async () => {
      await scanMissingExpiry();
      refreshAll();
    }),
    vscode.commands.registerCommand("wam.officialMode", async () => {
      const choice = await vscode.window.showWarningMessage(
        "WAM: 切换到官方模式？\n将登出WAM会话、清除所有第三方套层，回归Windsurf原生登录。",
        { modal: true },
        "确认回归本源",
      );
      if (choice !== "确认回归本源") return;
      saveMode("official");
      const cleaned = await cleanupThirdPartyState();
      _notifyInfo(
        `WAM: 官方模式已激活 — WAM会话已登出，${cleaned}项清理完成。请使用Windsurf原生登录您自己的账号`,
        "user",
      );
      refreshAll();
    }),
    vscode.commands.registerCommand("wam.wamMode", async () => {
      saveMode("wam");
      // 回切WAM时重启所有后台设施
      _restartBackgroundServices();
      if (_store.activeIndex < 0 && _store.pwCount() > 0) {
        const bestI = _store.getBestIndex(-1, false);
        if (bestI >= 0) {
          const acc = _store.get(bestI);
          if (_switching) {
            log(
              `wamMode: 强制释放锁(${Math.round((Date.now() - _switchingStartTime) / 1000)}s)`,
            );
            _switching = false;
          }
          _switching = true;
          _switchingStartTime = Date.now();
          try {
            const result = await switchToAccount(acc.email, acc.password);
            if (result.ok) {
              _afterSwitchSuccess(bestI, acc.email); // v17.42.2 不变量统一
              _notifyInfo(
                `WAM: WAM模式启动，自动登录 ${result.account}`,
                "user",
              );
              _ensureEngines();
            }
          } finally {
            _switching = false;
            refreshAll();
          }
          return;
        }
      }
      _notifyInfo("WAM: WAM切号模式已启动", "user");
      refreshAll();
    }),
    vscode.commands.registerCommand("wam.status", () => {
      const stats = _store.getPoolStats();
      const activeAcc =
        _store.activeIndex >= 0 ? _store.get(_store.activeIndex) : null;
      // v17.42.17 重新锚定本源: 区分本对话 turn 与跨实例协调池
      const turnSnap =
        typeof _getTurnSnapshot === "function" ? _getTurnSnapshot() : [];
      const activeTurns = turnSnap.filter((t) => t.status === "active");
      const turnDesc = activeTurns
        .map(
          (t) =>
            `${t.email.substring(0, 15)}[${t.turnId} ${Math.round(t.ageMs / 1000)}s]`,
        )
        .join(", ");
      const coordEmails = [..._store._inUse.keys()]
        .filter((e) => !activeTurns.some((t) => t.email === e.toLowerCase()))
        .map((e) => e.substring(0, 15))
        .join(", ");
      let msg = `WAM v${WAM_VERSION} | ${stats.pwCount}号 D${stats.totalD}·W${stats.totalW} | mode=${_mode} | 监测${_totalMonitorCycles}轮·${_totalChangesDetected}次变动·${_store.switchCount}次切号 | inst=${_instanceId}`;
      if (activeAcc) msg += ` | 活跃: ${activeAcc.email.substring(0, 20)}`;
      if (activeTurns.length > 0)
        msg += ` | 本对话(${activeTurns.length}): ${turnDesc}`;
      if (coordEmails) msg += ` | 协调: ${coordEmails}`;
      _notifyInfo(msg, "user");
    }),
    // v17.36 · origin 命令已剥离 (wam.originInvert / wam.originPassthrough / wam.verifyEndToEnd)
    // v17.36 · wam.verifyEndToEnd 已剥离 (所有 10 层皆 origin 专属)
    // v17.42.20 · 道法自然: try-catch 防 dao-proxy-min 先注册导致 activate 崩溃
    ...["wam.verifyEndToEnd", "wam.originInvert", "wam.originPassthrough"].map(
      (cmd) => {
        try {
          return vscode.commands.registerCommand(cmd, () =>
            _notifyInfo(`WAM: ${cmd} 已移至 020-道VSIX_DaoAgi`, "user"),
          );
        } catch {
          log(`cmd ${cmd} already registered (dao-proxy-min?) — skip`);
          return { dispose() {} };
        }
      },
    ),
    vscode.commands.registerCommand("wam.selfTest", async () => {
      _notifyInfo("WAM: 自诊断运行中...", "user");
      const result = await selfTest();
      const lines = result.results.map(
        (r) => `${r.ok ? "✓" : "✗"} ${r.test}: ${r.detail}`,
      );
      const header = result.ok
        ? `✅ ALL PASS (${result.ms}ms)`
        : `⚠️ SOME FAIL (${result.ms}ms)`;
      vscode.window.showInformationMessage(
        `WAM 自诊断: ${header}\n${lines.join("\n")}`,
        { modal: true },
      );
    }),
  );

  // ── v8: Rate-limit错误拦截器 — 道法自然: 不等用户报错, 主动感知并切号 ──
  // 拦截Windsurf的"Rate limit exceeded"错误, 自动触发无感切号
  _rateLimitWatcher = vscode.window.onDidChangeActiveTextEditor(() => {}); // placeholder for dispose
  try {
    // 监听所有信息/警告消息 (vscode.window的showInformationMessage无法拦截, 但可以监听output channel)
    const _rlInterceptor = vscode.workspace.onDidChangeTextDocument(
      async (e) => {
        if (!isWamMode() || _switching || !_store || _store.activeIndex < 0)
          return;
        // 检测Windsurf AI输出中的rate limit错误
        // 不调用getText() — 每次击键都序列化整个文档是纯开销
        if (!e.contentChanges.length) return;
        // 仅检查最近写入的内容 (性能优化: 不扫描整个文档)
        const lastChange = e.contentChanges[e.contentChanges.length - 1];
        if (!lastChange) return;
        const newText = lastChange.text;
        if (!newText || newText.length < 20 || newText.length > 500) return;
        if (/rate.?limit.?exceeded|Rate limit error/i.test(newText)) {
          // v17.39 path-D: 同步标记 ratelim 路径命中 (独立于 cooldown 判断)
          try {
            _msgAnchor.paths.ratelim.hits++;
            _msgAnchor.paths.ratelim.last = Date.now();
          } catch {}
          const cooldown =
            Date.now() - _lastSwitchTime < _getRateLimitCooldownMs();
          const rlInjectCd =
            Date.now() - _lastInjectFail < _getInjectFailCooldown(); // v13.4
          if (cooldown || rlInjectCd) return; // 刚切过或注入失败冷却中
          log(
            `🚨 rate-limit intercepted in document! Triggering proactive switch...`,
          );
          const autoRotate = vscode.workspace
            .getConfiguration("wam")
            .get("autoRotate", true);
          if (!autoRotate) return;
          // v17.42.7 锁🔒贯通: rate-limit 拦截也须 _isValidAutoTarget 四辨 (含 skipAutoSwitch)
          const bestI = _isValidAutoTarget(_predictiveCandidate)
            ? _predictiveCandidate
            : _store.getBestIndex(_store.activeIndex, true);
          if (bestI < 0) {
            log("rate-limit: no available account");
            return;
          }
          const bestAcc = _store.get(bestI);
          _switching = true;
          _switchingStartTime = Date.now();
          try {
            const sr = await switchToAccount(bestAcc.email, bestAcc.password);
            if (sr.ok) {
              _afterSwitchSuccess(bestI, bestAcc.email); // v17.42.2 不变量统一
              _predictiveCandidate = _store.getBestIndex(bestI, true);
              if (_predictiveCandidate >= 0)
                _prewarmCandidateToken(_predictiveCandidate);
              _notifyInfo(
                `WAM: 🚨 Rate-limit拦截 → 已无感切换到 ${sr.account} (${sr.ms}ms)`,
                "auto",
              );
              refreshAll();
            } else {
              _lastInjectFail = Date.now(); // v13.4
            }
          } finally {
            _switching = false;
          }
        }
      },
    );
    context.subscriptions.push(_rlInterceptor);
    log("v8: rate-limit interceptor registered");
  } catch (e) {
    log(`v8: rate-limit interceptor failed: ${e.message}`);
  }

  // ── v17.42.19 · 消息锚定 · 延迟安装 · 知止可以不殆 ──
  // 根治: activate 同步安装 5 路 monkey-patch → LS 冷启 gRPC 风暴 × 正则匹配 → 事件循环饥饿 → ExtHost unresponsive
  // 药方: 延迟 15s 安装 (LS 稳定后) · 用户不可能在 15s 内开始 Cascade 对话 · 零功能损失
  setTimeout(() => {
    try {
      _installMessageAnchor(context);
    } catch (e) {
      log(`v17.42.19: messageAnchor deferred install failed: ${e.message}`);
    }
  }, 45000); // v17.42.19: T+45s · 在引擎(T+60s)前安装 · LS 已完全稳定

  // ── 活动感知: 追踪本实例的编辑器/终端活动 (根治: 区分自使用vs外部使用) ──
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      _lastSelfActivity = Date.now();
    }),
    vscode.workspace.onDidChangeTextDocument(() => {
      _lastSelfActivity = Date.now();
    }),
    vscode.window.onDidOpenTerminal(() => {
      _lastSelfActivity = Date.now();
    }),
  );
  _lastSelfActivity = Date.now(); // 启动即视为活跃

  // ── 实例协调: 心跳 + 声明 (根治: 多实例抢号) ──
  // 官方模式下不启动心跳, 不写入instance claim
  if (isWamMode()) {
    _writeInstanceClaim(
      _store.activeIndex >= 0 ? _store.get(_store.activeIndex)?.email : "",
    );
    _heartbeatTimer = setInterval(() => {
      if (!isWamMode()) return; // v7.4: 官方模式下静默
      const activeAcc =
        _store.activeIndex >= 0 ? _store.get(_store.activeIndex) : null;
      _writeInstanceClaim(activeAcc?.email || "");
      _cleanDeadInstances();
    }, _getInstanceHeartbeatMs());
  }
  context.subscriptions.push({
    dispose() {
      if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    },
  });
  log(`instance: ${_instanceId} registered (pid=${process.pid})`);

  // ── v14.3: 热部署安全激活 — 不打断对话·用户选择时机 ──
  // 根因修复: reloadWindow杀死所有对话 → 改为restartExtensionHost(只重启扩展·保留对话)
  // 且不自动执行 — 弹通知让用户选择激活时机, 忽略则下次启动自动生效
  try {
    fs.mkdirSync(WAM_DIR, { recursive: true });
  } catch {}
  // 写入就绪标记: 告知_dao.ps1本扩展已支持自动重载
  try {
    fs.writeFileSync(RELOAD_READY, "v14.3", "utf8");
  } catch {}
  // 清理上次残留的信号文件 (避免启动即重载死循环)
  try {
    if (fs.existsSync(RELOAD_SIGNAL)) fs.unlinkSync(RELOAD_SIGNAL);
  } catch {}
  _reloadWatcher = setInterval(() => {
    try {
      if (!fs.existsSync(RELOAD_SIGNAL)) return;
      if (_switching) return; // 切号中不重载, 等完成
      let sigData = "";
      try {
        sigData = fs.readFileSync(RELOAD_SIGNAL, "utf8").trim();
      } catch {
        return;
      }
      try {
        fs.unlinkSync(RELOAD_SIGNAL);
      } catch {}
      log(`hot-deploy: ${sigData} — 落盘状态·重启扩展宿主(不中断对话)`);
      // 落盘全部状态
      try {
        if (_store) _store.save();
      } catch {}
      try {
        _saveSnapshots();
      } catch {}
      try {
        if (_store) _saveInUse(_store);
      } catch {}
      try {
        _saveTokenCache();
      } catch {}
      // restartExtensionHost — 只重启扩展进程, 对话/编辑器/终端全部保留
      // 根因: reloadWindow重载整个窗口→杀死所有对话 | restartExtensionHost仅触扩展→无感
      setTimeout(() => {
        vscode.commands.executeCommand("workbench.action.restartExtensionHost");
      }, 500);
    } catch {}
  }, 2000);
  context.subscriptions.push({
    dispose() {
      if (_reloadWatcher) {
        clearInterval(_reloadWatcher);
        _reloadWatcher = null;
      }
    },
  });

  // ── v17.42.19 延迟启动 — 分两阶段: 轻量(3s) + 重引擎(20s) · 防 LS 冷启期 HTTP 风暴 ──
  // 阶段1: 轻量操作 (文件监听 + activeIndex 恢复)
  setTimeout(() => {
    if (isWamMode()) {
      startFileWatcher();
      if (fs.existsSync(TOKEN_FILE)) {
        log("startup: pending token found");
        vscode.commands.executeCommand("wam.injectToken");
      }
      // v11: 恢复activeIndex (根治: 重启后activeIndex丢失→monitor不运行)
      if (_store && _store.activeIndex < 0) {
        try {
          const lastResult = JSON.parse(fs.readFileSync(RESULT_FILE, "utf8"));
          if (lastResult.ok && lastResult.email) {
            const ek = lastResult.email.toLowerCase();
            for (let i = 0; i < _store.accounts.length; i++) {
              if (_store.accounts[i].email.toLowerCase() === ek) {
                _store.activeIndex = i;
                _writeInstanceClaim(lastResult.email);
                log(
                  `startup: recovered activeIndex=${i} from inject_result (${lastResult.email.substring(0, 20)})`,
                );
                break;
              }
            }
          }
        } catch {}
      }
      log("startup: WAM模式 — 阶段1完成 (轻量) · 引擎延至宽限期后");
    } else {
      log("startup: 官方模式 — 零干扰·无监听/心跳/引擎");
    }
    updateStatusBar();
  }, 3000);
  // 阶段2: 重引擎 + 自诊断 (LS 稳定后)
  // v17.42.19 根治: 24号×3-5通道=~100并发 HTTPS 致事件循环饥饿
  //   药方: 引擎延至 T+60s · codeium.windsurf LS 完全稳定后再启动 WAM 引擎
  //   60s 内用户使用 Cascade 不受影响 (无需 WAM 切号) · 零功能损失
  setTimeout(() => {
    if (isWamMode()) {
      _ensureEngines();
      log("startup: WAM模式 — 阶段2完成 · 监测引擎+Token活水池已启动");
      selfTest()
        .then((r) => {
          if (!r.ok)
            log(
              `startup selfTest: ${r.results
                .filter((x) => !x.ok)
                .map((x) => x.test)
                .join(",")}`,
            );
        })
        .catch(() => {});
    }
  }, 60000);
}

// ════════════════════════════════════════════════════════════════════════
// v17.36 · 反者道之动 · 回归本源 · proxy/origin 代码已剥离
// WAM 专注无感切号 · 道Agent 独立为 020-道VSIX_DaoAgi
// ════════════════════════════════════════════════════════════════════════
// (原 OriginCtl 850+ 行已移除 · proxy/origin 功能独立为 020-道VSIX_DaoAgi)

function deactivate() {
  if (_watcher) {
    _watcher.close();
    _watcher = null;
  }
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  _stopEngines();
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  if (_persistTimer) {
    clearTimeout(_persistTimer);
    _persistTimer = null;
  }
  if (_rateLimitWatcher) {
    _rateLimitWatcher.dispose();
    _rateLimitWatcher = null;
  }
  if (_reloadWatcher) {
    clearInterval(_reloadWatcher);
    _reloadWatcher = null;
  }
  // v17.39 消息锚定清理 (context.subscriptions 已自动调用, 此处是兜底)
  try {
    _uninstallMessageAnchor();
  } catch {}
  // bridge cleanup
  if (_bridgeEnsureTimer) {
    clearTimeout(_bridgeEnsureTimer);
    _bridgeEnsureTimer = null;
  }
  _bridgeReady = false;
  _bridgeReadyCallbacks = [];
  _prewarmedToken = null;
  _switching = false;
  if (_editorPanel) {
    _editorPanel.dispose();
    _editorPanel = null;
  }
  // 关闭前存储账号数据
  try {
    if (_store) _store.save();
  } catch {}
  // 关闭前落盘: 确保快照和使用中标记不丢失
  try {
    _saveSnapshots();
  } catch {}
  try {
    if (_store) _saveInUse(_store);
  } catch {}
  // 先落盘再清缓存 — 根治deactivate时_tokenCacheDirty=true导致空cache覆盖磁盘
  try {
    _saveTokenCache();
  } catch {}
  _tokenCache.clear();
  // 清除实例声明
  try {
    const claims = _readInstanceClaims();
    delete claims[_instanceId];
    fs.writeFileSync(
      INSTANCE_LOCK_FILE,
      JSON.stringify(claims, null, 2),
      "utf8",
    );
  } catch {}
  log(
    `deactivate — inst=${_instanceId} 监测${_totalMonitorCycles}轮·${_totalChangesDetected}次变动·${_store?.switchCount || 0}次切换 snap=${_quotaSnapshots.size} inUse=${_store?._inUse?.size || 0}`,
  );
}

module.exports = { activate, deactivate, _msgAnchorSnapshot };
