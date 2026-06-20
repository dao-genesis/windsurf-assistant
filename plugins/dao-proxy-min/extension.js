// extension.js · dao-proxy-min v9.9.57 · 道法自然 · 无为而无以为
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
const BACKUP_KEY_API = "daomin.origin._backup_apiServerUrl";
const BACKUP_KEY_INFER = "daomin.origin._backup_inferenceApiServerUrl";

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
let _cachedAnchored = false;
let _cachedMode = "invert";
let _activateTs = 0; // v9.9.36 · ext-host 生命周期追踪 · smart deactivate
let _deferredAnchorTimer = null; // v9.9.36 · 延迟锚定计时器 · 渡过 Installation Modified 危窗

// ═══════════════════════════ 日志 ═══════════════════════════
let _channel = null;
function logger() {
  if (!_channel) _channel = vscode.window.createOutputChannel("道Agent · min");
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
  const c = vscode.workspace.getConfiguration("daomin");
  const explicit = parseInt(c.get("origin.port"), 10);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 65535)
    return explicit;
  // per-user 自动 · 用 os.userInfo().username + ":min" · 与 pro 同用户不撞端口
  try {
    return fnv1aPort(os.userInfo().username + ":min");
  } catch {
    return DEFAULT_PORT;
  }
}

function cfg() {
  _cachedPort = resolvePort();
  _cachedProxyUrl = `http://127.0.0.1:${_cachedPort}`;
  return { port: _cachedPort };
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
  }
  return rewrote > 0;
}

function installSpawnHook() {
  if (_spawnHooked) return;
  _spawnHooked = true;
  cp.spawn = function (cmd, a) {
    maybeRewriteLsArgs(cmd, a);
    return _origSpawn.apply(this, arguments);
  };
  cp.spawnSync = function (cmd, a) {
    maybeRewriteLsArgs(cmd, a);
    return _origSpawnSync.apply(this, arguments);
  };
  cp.execFile = function (cmd, a) {
    if (Array.isArray(a)) maybeRewriteLsArgs(cmd, a);
    return _origExecFile.apply(this, arguments);
  };
  cp.exec = function (cmdline) {
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

async function proxyStart(port, mode, _retried) {
  if (_proxyHandle) return _proxyHandle;
  const srcPath = findSourceJs();
  if (!srcPath) throw new Error(`源.js 不存在: ${vendorDir()}`);
  try {
    delete require.cache[require.resolve(srcPath)];
    const mod = require(srcPath);
    if (typeof mod.start !== "function")
      throw new Error("源.js 无 start() 导出");
    _proxyHandle = await mod.start({
      port,
      host: "127.0.0.1",
      mode: mode || "passthrough",
    });
    L.info(
      "proxy",
      `started :${_proxyHandle.port} src=${srcPath} mode=${_proxyHandle.getMode()}`,
    );
    return _proxyHandle;
  } catch (e) {
    if (
      e.code === "EADDRINUSE" ||
      (e.message && e.message.includes("EADDRINUSE"))
    ) {
      L.info("proxy", `port :${port} EADDRINUSE → ping remote`);
      const ping = await httpGetJson(
        `http://127.0.0.1:${port}/origin/ping`,
        2000,
      );
      if (
        ping &&
        ping.ok &&
        (ping.mode === "invert" || ping.mode === "passthrough")
      ) {
        // v9.9.21 · 检远端 self_file 是否最新 · 旧则让位
        // 二十二章「夫唯不争 故莫能与之争」 · 七十六章「兵强则不胜」
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
          // 等远端 server.close 完毕 (远端 setTimeout 100ms · 加 close 时间)
          await new Promise((r) => setTimeout(r, 1500));
          return proxyStart(port, mode, true); // 一次重试 · 防递归无限
        }
        L.info(
          "proxy",
          `port :${port} live remote (mode=${ping.mode} · ver=${(ping.features || {}).mode || "?"}) → remote handle`,
        );
        _proxyHandle = _createRemoteHandle(port, ping.mode);
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

// 远程 handle: 端口已有 proxy (多窗口) → 复用而非销毁
function _createRemoteHandle(port, mode) {
  let _mode = mode || "invert";
  return {
    port,
    host: "127.0.0.1",
    server: null, // remote · 无本地 server
    kind: "remote",
    getMode: () => _mode,
    setMode: (m) => {
      _mode = m;
      httpPostJson(
        `http://127.0.0.1:${port}/origin/mode`,
        { mode: m },
        2000,
      ).catch(() => {});
    },
    close: async () => {}, // remote · 不关闭别窗进程
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
    fs.writeFileSync(fp, JSON.stringify(json, null, 2), "utf8");
    return true;
  } catch (e) {
    L.warn("anchor", `file write fail: ${e.message}`);
    return false;
  }
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
      if (
        json["codeium.apiServerUrl"] === url &&
        json["codeium.inferenceApiServerUrl"] === url
      ) {
        L.info("anchor", `already ${url} · skip ${sp} (无为而治)`);
        continue;
      }
      json["codeium.apiServerUrl"] = url;
      json["codeium.inferenceApiServerUrl"] = url;
      if (_writeSettingsJson(sp, json)) {
        L.info("anchor", `file set ${url} → ${sp}`);
      }
    } catch (e) {
      L.warn("anchor", `file set fail ${sp}: ${e.message}`);
    }
  }

  _cachedAnchored = true;
  _cachedProxyUrl = url;
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
      _writeSettingsJson(sp, json);
      L.info("anchor", `file cleared → ${sp}`);
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
  // 一请观全槽 · /origin/allinjects 含 _injectsByKind 全槽
  // v9.4.5 · 删 realprompt fetch · 该端点 source.js 不存 · 仅 404 浪费
  const [proxy, allInjects] = (await withTimeout(
    Promise.all([
      httpGetJson(`${base}/origin/preview`, 4000),
      httpGetJson(`${base}/origin/allinjects`, 4000),
    ]),
    6000,
  )) || [null, null];
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
    allInjects,
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
          reject(new Error(`exec timeout ${timeout}ms sid=${sid}`));
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
  // 复用 fnv1a 思想 · base 12780 · :min 偏置 · 与 pro 同用户不撞
  const u = ((os.userInfo().username || "default") + ":min").toLowerCase();
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
      webviewView.webview,
      this._ctx.extensionUri,
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
      log(`canon -> ${canon} (ok=${r && r.ok}, chars=${r && r.chars})`);
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
          log(
            `canon push canonChanged · canon=${r && r.canon} · default_chars=${cs.default_chars} · has_custom=${cs.has_custom}`,
          );
        }
      } catch (e) {
        log(`canon push default_sp fail: ${e && e.message}`);
      }
      setTimeout(() => this.forceRefresh().catch(() => {}), 300);
    } catch (e) {
      log(`canon set fail: ${e && e.message}`);
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

function getEssenceHtml(port, nonce, initialSP, webview, extensionUri) {
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
  .ib {
    padding: 2px 5px; font-size: 12px; border: 1px solid transparent;
    background: transparent; color: var(--vscode-foreground);
    cursor: pointer; border-radius: 2px; font-family: inherit;
    opacity: 0.55; min-width: 20px; line-height: 1;
  }
  .ib:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.15)); }
  .ib.edit-active { opacity: 1; color: #e8a040; border-color: #e8a040; background: rgba(232,160,64,0.1); }
  .ib.detail-on { opacity: 1; color: #888; border-color: #888; background: rgba(128,128,128,0.08); }
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
  #canonSelect { font-size: 10px; padding: 1px 2px; border: 1px solid rgba(128,128,128,0.3); background: var(--vscode-dropdown-background, rgba(0,0,0,0.2)); color: var(--vscode-dropdown-foreground, var(--vscode-foreground)); border-radius: 3px; cursor: pointer; outline: none; font-family: inherit; max-width: 96px; margin-left: 4px; }
  #canonSelect:focus { border-color: var(--vscode-focusBorder, #007fd4); }
  #canonSelect option { background: var(--vscode-dropdown-listBackground, #252526); color: var(--vscode-dropdown-foreground, #ccc); }
</style>
</head>
<body data-port="${proxyPort}">
  <div class="bar">
    <span class="dots" id="dots" title="Proxy\u00b7Capture\u00b7Mode"></span>
    <button class="mb" id="btnDao" title="\u9053Agent\u00b7\u5e1b\u4e66\u524d\u7f6e">\u9053</button>
    <button class="mb" id="btnOff" title="\u5b98\u65b9Agent\u00b7\u900f\u4f20">\u5b98</button>
    <button class="ib" id="editToggle" title="\u7f16\u8f91\u6ce8\u5165 SP">\u7f16</button>
    <select id="canonSelect" title="\u7ecf\u85cf\u5207\u6362 \u00b7 \u4e24\u7ecf\u5f52\u4e00\u00b7\u9053\u751f\u4e00">
      <option value="laozi+yinfu">\u5e1b\u4e66\u8001\u5b50+\u9053\u85cf\u9634\u7b26\u7ecf</option>
      <option value="laozi">\u5e1b\u4e66\u300a\u8001\u5b50\u300b</option>
      <option value="yinfu">\u9053\u85cf\u300a\u9634\u7b26\u7ecf\u300b</option>
    </select>
    <span id="customBadge"></span>
  </div>
  <div class="stat" id="stat"></div>
  <pre id="sp" class="quiet">\uff08\u5f85\u9996\u6b21\u5bf9\u8bdd\uff09</pre>
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
  var $btnDao = document.getElementById('btnDao');
  var $btnOff = document.getElementById('btnOff');
  var $editToggle = document.getElementById('editToggle');
  var $editArea = document.getElementById('editArea');
  var $editText = document.getElementById('editText');
  var $editSave = document.getElementById('editSave');
  var $editReload = document.getElementById('editReload');
  var $editReset = document.getElementById('editReset');
  var $editStatus = document.getElementById('editStatus');
  var $editCount = document.getElementById('editCount');
  var $customBadge = document.getElementById('customBadge');
  var $canonSelect = document.getElementById('canonSelect');
  var lastText = '';
  var lastSP = '';
  var lastEntry = null;
  var lastSig = '';
  var curMode = 'invert';
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
      parts.push('\u2501\u2501\u2501 LLM \u5b9e\u6536 \u00b7 ' + lastSP.length + '\u5b57 \u2501\u2501\u2501');
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

    if (fieldCount > 0) {
      $stat.innerHTML = '<span class="pill">\u5168\u00b7' + fieldCount + '\u5b57\u6bb5\u00b7' + totalChars + '\u5b57</span>';
    } else if (lastSP) {
      $stat.innerHTML = '<span class="pill">\u5168\u00b71\u5b57\u6bb5\u00b7' + lastSP.length + '\u5b57</span>';
    } else {
      $stat.innerHTML = '';
    }

    return true;
  }

  // ─── 道/官 切换 ───
  function setModeUI(mode) {
    curMode = mode || 'invert';
    $btnDao.classList.remove('active', 'active-dao');
    $btnOff.classList.remove('active');
    if (curMode === 'invert') $btnDao.classList.add('active', 'active-dao');
    else $btnOff.classList.add('active');
  }
  $btnDao.addEventListener('click', function() {
    if (curMode === 'invert') return;
    setModeUI('invert');
    vsc.postMessage({ command: 'setMode', mode: 'dao' });
  });
  $btnOff.addEventListener('click', function() {
    if (curMode === 'passthrough') return;
    setModeUI('passthrough');
    vsc.postMessage({ command: 'setMode', mode: 'official' });
  });

  // ─── 经藏切换 · 道生一 一生二 二生三 三生万物 ───
  $canonSelect.addEventListener('change', function() {
    var c = $canonSelect.value;
    vsc.postMessage({ command: 'setCanon', canon: c });
  });

  // ─── 编辑模式 ───
  function _closeEditMode() {
    editMode = false;
    $editArea.classList.remove('show');
    $editToggle.classList.remove('edit-active');
    $sp.style.display = '';
    if (_editClosing) { clearTimeout(_editClosing); _editClosing = null; }
  }
  function updateEditCount() {
    var n = ($editText.value || '').length;
    var d = (lastSP || '').length;
    $editCount.textContent = n + (d > 0 ? '/' + d : '') + '\u5b57';
  }
  $editToggle.addEventListener('click', function() {
    editMode = !editMode;
    if (editMode) {
      $editArea.classList.add('show');
      $editToggle.classList.add('edit-active');
      $sp.style.display = 'none';
      // v9.9.22 · 不再用旧 lastSP 预填 (lastSP 可能是切前经文)
      // 道义: 十六章「致虚极 守静笃」· 清空守静以待真源 · getCustomSP 必返新 default_sp 填实
      $editText.value = '';
      updateEditCount();
      $editStatus.textContent = '\u52a0\u8f7d\u4e2d\u2026';
      vsc.postMessage({ command: 'getCustomSP' });
      $editText.focus();
    } else {
      _closeEditMode();
    }
  });
  $editSave.addEventListener('click', function() {
    var sp = $editText.value;
    if (!sp || !sp.trim()) { $editStatus.textContent = '\u2716 \u5185\u5bb9\u4e0d\u53ef\u4e3a\u7a7a'; return; }
    $editStatus.textContent = '\u4fdd\u5b58\u4e2d\u2026';
    vsc.postMessage({ command: 'setCustomSP', sp: sp.trim() });
  });
  $editReload.addEventListener('click', function() {
    $editText.value = _spCanonPart(lastSP);
    updateEditCount();
    $editStatus.textContent = '\u2714 \u5df2\u8f7d\u5f53\u524d\u5b9e\u6536 SP \u00b7 ' + (_spCanonPart(lastSP).length) + '\u5b57';
    $editText.focus();
  });
  $editReset.addEventListener('click', function() {
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
    var items = [
      { label: 'Proxy', on: true, k: 'proxy' },
      { label: 'Capture', on: !!(p.tape_count > 0), k: 'cap' },
      { label: 'Mode', on: p.mode === 'invert', k: 'mode' }
    ];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var d2 = document.createElement('span');
      d2.className = 'dot ' + (it.on ? 'ok' : (it.k === 'cap' ? 'warn' : 'err'));
      $dots.appendChild(d2);
    }
    $dots.title = 'Proxy:' + (items[0].on?'\u2713':'\u2717') + ' \u00b7 Cap:' + (items[1].on?'\u2713':'\u2717') + ' \u00b7 M:' + (p.mode||'?');
  }

  function pingPull() {
    fJson('/origin/ping').then(function(p){
      if (!p) return;
      if (p.mode) setModeUI(p.mode);
      if (p.canon && $canonSelect.value !== p.canon) $canonSelect.value = p.canon;
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
        if (!editMode) {
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
    if (e.data.type === 'mode') setModeUI(e.data.mode);
    // v9.9.18 \u4fee\u590d \u00b7 extension host gatherEssence \u63a8\u9001\u4e4b data \u5305 · \u6838\u5fc3\u663e\u793a\u901a\u8def
    // forceRefresh() \u53d1\u9001 {type:"data", data:{ping,proxy,allInjects,...}} \u4e4b\u540e webview \u5e94\u66f4\u65b0\u4e09\u76cf/\u6309\u9215/SP\u663e\u793a
    if (e.data.type === 'data') {
      var _d = e.data.data;
      if (!_d) return;
      // 1. \u66f4\u65b0\u4e09\u76cf + \u6309\u9215\u72b6\u6001
      if (_d.ping && _d.ping.mode) setModeUI(_d.ping.mode);
      if (_d.ping) setDots(_d.ping);
      // 2. \u540c\u6b65\u7ecf\u85cf\u4e0b\u62c9
      if (_d.ping && _d.ping.canon && $canonSelect.value !== _d.ping.canon) $canonSelect.value = _d.ping.canon;
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
        if (!editMode) {
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
      if (_cc.canon && $canonSelect.value !== _cc.canon) $canonSelect.value = _cc.canon;
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
  _wdbg('boot-done', 'boot', { listeners: 'btnDao,btnOff,canon,editToggle,editSave,editReload,editReset,message[data,customSP,canonChanged]', ver: '9.9.31' });
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
    _cachedMode = vscode.workspace
      .getConfiguration("daomin")
      .get("origin.defaultMode", "invert");

    installSpawnHook();
    ensureIconSvg();

    L.info(
      "ext",
      `dao-proxy-min v${PKG_VERSION} activate · port=${_cachedPort} anchored=${_cachedAnchored} user=${os.userInfo().username}`,
    );

    // 道德经横幅 (默认关 · 不言之教)
    if (vscode.workspace.getConfiguration("daomin").get("origin.banner", false)) {
      const q = DAO_QUOTES[Math.floor(Math.random() * DAO_QUOTES.length)];
      vscode.window.showInformationMessage(`道Agent v${PKG_VERSION} · ${q}`);
    }

    // 注册命令
    ctx.subscriptions.push(
      vscode.commands.registerCommand("daomin.originInvert", cmdInvert),
      vscode.commands.registerCommand("daomin.originPassthrough", cmdPassthrough),
      vscode.commands.registerCommand("daomin.toggleMode", cmdToggle),
      vscode.commands.registerCommand("daomin.openPreview", cmdOpenPreview),
      vscode.commands.registerCommand("daomin.verifyEndToEnd", cmdVerifyE2E),
      vscode.commands.registerCommand("daomin.selftest", cmdSelftest),
      // v9.9.0 · 印 124 · 第一细药 · 外接 api 开关 (默关 · 主公一字开)
      vscode.commands.registerCommand(
        "daomin.外接api.toggle",
        cmdExternalApiToggle,
      ),
      // v9.9.29 · 印 160 · 终端会话池 (反者道之动 · 七层污染一招治)
      vscode.commands.registerCommand("daomin.term.exec", cmdTermExec),
      vscode.commands.registerCommand("daomin.term.list", cmdTermList),
      vscode.commands.registerCommand("daomin.term.close", cmdTermClose),
    );

    // 注册 webview
    _essenceProvider = new EssenceProvider(ctx);
    ctx.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "daomin.essence",
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
          "workbench.view.extension.daomin-container",
        );
        L.info("activate", "focus daomin-container · webview 自化");
      } catch (e) {
        L.warn("activate", `focus fail: ${e.message}`);
      }
    }, 5000);

    // ── 真药 D · activate 不杀 LS · 为道日损 (四十八章) ──
    // 首装/恢复 仅启 proxy + 锚 settings + 装 hook, 不主动 forceRestartLS
    // LS 自然重启时 spawn hook 自挂; 用户欲即时切换可显式调 wam.originInvert
    if (_cachedAnchored) {
      L.info("activate", "settings anchored → auto-restore proxy");
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
            return; // 活且版本最新 · 安心
          }
        }
        L.warn("watchdog", `proxy 死/旧 · 重起 :${port}`);
        _proxyHandle = null;
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

    // ── v9.9.0 · 印 124 · 第一细药 · 外接 api 自启 (默关) ──
    // 帛书六十三章: 图难于其易 · 为大于其细 · 终不为大 · 故能成其大
    // dao.外接api.enabled=true 才启 · 失败不影响 min 反代主体
    setTimeout(() => {
      tryStartExternalApi(ctx).catch((e) => {
        L.warn("外接api", `自启失 (non-fatal): ${e.message}`);
      });
    }, 12000);
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

  const isLocal = _proxyHandle && _proxyHandle.server;
  const lifetime = _activateTs ? Date.now() - _activateTs : 0;

  // ① 先设透传 · 过渡期 LS 若仍连代理 · 透传至官方 · 不断不乱
  if (isLocal && _proxyHandle.setMode) {
    try {
      _proxyHandle.setMode("passthrough");
    } catch {}
  }

  // ② 立即断钩 · 新 LS 不再被截持
  _cachedAnchored = false;
  removeSpawnHook();

  // ③ 同步清锚 · v9.9.36 道法自然 · 短命 ext-host 不清锚
  // ════════════════════════════════════════════════════════════
  // 日志实证 (window23/24/25 三窗口一致):
  //   ext-host 存活 < 30s → 被 "Installation modified" 杀
  //   清锚导致下个 ext-host 重走 setAnchor → 再触写风暴 → 连环重载
  //   不清锚 → 下个 ext-host 走 "anchored → auto-restore" 快路 · 零写入
  // 道义: 七十六「兵强则不胜 · 木强则折」· 强清反害 · 柔保则安
  //       二十二「曲则金 · 枉则定」· 不争 · 故莫能与之争
  // ════════════════════════════════════════════════════════════
  if (isLocal && lifetime > 30000) {
    _clearAnchorFileSync();
    L.info(
      "deactivate",
      `清锚 · lifetime=${Math.round(lifetime / 1000)}s · 正常关闭`,
    );
  } else if (isLocal) {
    L.info(
      "deactivate",
      `保锚 · lifetime=${Math.round(lifetime / 1000)}s < 30s · 下次 auto-restore 零写入`,
    );
  }

  try {
    await tryStopExternalApi();
  } catch {}

  if (_essenceProvider) {
    _essenceProvider.dispose();
    _essenceProvider = null;
  }

  await proxyStop();

  L.info(
    "deactivate",
    isLocal
      ? `local: lifetime=${Math.round(lifetime / 1000)}s · ${lifetime > 30000 ? "清锚" : "保锚"} · 大道至简`
      : "remote: 仅停代理 · 无本地状态",
  );
}

// ═══════════════════════════════════════════════════════════════════
// v9.9.0 · 印 124 · 第一细药 · 外接 api 启停 helper
// ═══════════════════════════════════════════════════════════════════
// 帛书《老子》:
//   六十三章 · 图难其易 · 为大其细 · 终不为大 · 故能成其大
//   六十四章 · 为之于其未有也, 治之于其未乱也
//   四十八章 · 损之又损, 以至于无为, 无为而无不为
//
// 与 min 反代主体字节级正交:
//   反代核 :8889..8988 (per-user FNV) · 守 Cascade SP 注入之心 (字节级不动)
//   外接 api gateway :11635..11734 (per-user FNV) · 展 14 provider N 模选用之能
//   二轨不撞 · 道并行而不相悖

let _externalApiRuntime = null;

async function tryStartExternalApi(ctx) {
  // 默关 · 主公 dao.外接api.enabled=true 才启
  const enabled = vscode.workspace
    .getConfiguration("daomin")
    .get("外接api.enabled", false);
  if (!enabled) {
    L.info("外接api", "默关 (dao.外接api.enabled=false) · 跳启");
    return null;
  }
  if (_externalApiRuntime && _externalApiRuntime.isRunning()) {
    L.info("外接api", "已运行 · 跳启");
    return _externalApiRuntime;
  }
  let ExternalApiRuntime;
  try {
    ({ ExternalApiRuntime } = require("./vendor/外接api/runtime.js"));
  } catch (e) {
    L.warn("外接api", `vendor/外接api/runtime.js 不加载: ${e.message}`);
    return null;
  }
  _externalApiRuntime = new ExternalApiRuntime({
    vscodeModule: vscode,
    logger: L,
    configKey: "daomin.外接api",
    vendorPrefix: "dao-",
  });
  const status = await _externalApiRuntime.start();
  L.info(
    "外接api",
    `启 · gw=${status.gatewayUrl} · providers=${status.providers} · models=${status.models}`,
  );
  // 注入 dispose · 主进程退时 deactivate 已显式 stop · 此为兜底
  if (ctx && ctx.subscriptions) {
    ctx.subscriptions.push({
      dispose: () => {
        if (_externalApiRuntime) {
          _externalApiRuntime.stop().catch(() => {});
        }
      },
    });
  }
  return _externalApiRuntime;
}

async function tryStopExternalApi() {
  if (!_externalApiRuntime) return;
  try {
    await _externalApiRuntime.stop();
  } catch (e) {
    L.warn("外接api", `stop err: ${e.message}`);
  }
  _externalApiRuntime = null;
}

async function cmdExternalApiToggle() {
  try {
    const cfg = vscode.workspace.getConfiguration("daomin");
    const cur = cfg.get("外接api.enabled", false);
    const next = !cur;
    await cfg.update(
      "外接api.enabled",
      next,
      vscode.ConfigurationTarget.Global,
    );
    if (next) {
      const rt = await tryStartExternalApi(null);
      if (rt) {
        const status = rt.getStatus();
        vscode.window.showInformationMessage(
          `道Agent · 外接 api 启 · ${status.providers} provider · ${status.models} 模 · gw=${status.gatewayUrl}`,
        );
      } else {
        vscode.window.showWarningMessage(
          `道Agent · 外接 api 启失 · 见 Output 道Agent 频道`,
        );
      }
    } else {
      await tryStopExternalApi();
      vscode.window.showInformationMessage("道Agent · 外接 api 已停");
    }
  } catch (e) {
    L.error("外接api", `toggle fail: ${e.stack || e.message}`);
    vscode.window.showErrorMessage(`外接 api toggle 失: ${e.message}`);
  }
}

module.exports = { activate, deactivate };
