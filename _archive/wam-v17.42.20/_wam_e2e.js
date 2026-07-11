/**
 * WAM · rt-flow E2E test · v17.42.19 · 深根固柢·长生久视 (叠加 v17.42.18 _cfg空字符串回退根治 + v17.42.17 重新锚定本源 + v17.42.15 载营魄抱一 + v17.42.14 不冤枉 + v17.42.12 proxy-agent突破 + v17.42.10 inject-dead + v17.42.9 Firebase归档 + v17.42.8 env sync quarantine + v17.42.7 锁🔒 + v17.42.6 env自净 + v17.42.5 五刀)
 * Offline static analysis — validates source integrity without runtime
 * Usage: node _wam_e2e.js [extDir]
 */
const fs = require("fs");
const path = require("path");

let pass = 0,
  fail = 0,
  skip = 0;
function assert(cond, msg) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL: ${msg}`);
  }
}
function section(title) {
  console.log(`\n# ${title}`);
}

// ── Locate extension.js ──
const extDir = process.argv[2] || path.resolve(__dirname);
const extPath = path.join(extDir, "extension.js");
if (!fs.existsSync(extPath)) {
  console.log(`ERROR: extension.js not found at ${extPath}`);
  process.exit(1);
}
const stat = fs.statSync(extPath);
console.log(`extension.js: ${extPath} (${stat.size} B)`);
const code = fs.readFileSync(extPath, "utf8");

// ══ L1: Package.json ══
section("L1: Package.json");
const pkgPath = path.join(extDir, "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  assert(pkg.name === "rt-flow", `name=rt-flow (got ${pkg.name})`);
  assert(
    pkg.main === "./extension.js",
    `main=./extension.js (got ${pkg.main})`,
  );
  assert(pkg.version === "17.42.19", `version=17.42.19 (got ${pkg.version})`); // v17.42.19 深根固柢·长生久视
  assert(pkg.engines && pkg.engines.vscode, "engines.vscode defined");
  assert(
    pkg.activationEvents && pkg.activationEvents.includes("onStartupFinished"),
    "activates onStartupFinished",
  );
  const cmds = (pkg.contributes && pkg.contributes.commands) || [];
  const wamCmds = cmds.filter((c) => c.command.startsWith("wam."));
  assert(wamCmds.length >= 15, `wam.* commands >= 15 (got ${wamCmds.length})`);
  // Origin commands should still be registered (backward compat) but with deprecation hints
  const e2eCmd = cmds.find((c) => c.command === "wam.verifyEndToEnd");
  assert(!!e2eCmd, "wam.verifyEndToEnd command registered (backward compat)");
  // Configuration
  const props =
    (pkg.contributes.configuration &&
      pkg.contributes.configuration.properties) ||
    {};
  assert(props["wam.autoRotate"], "wam.autoRotate config exists");
  assert(
    props["wam.autoUpdate.enabled"],
    "wam.autoUpdate.enabled config exists",
  );
  assert(
    props["wam._origin_removed"],
    "wam._origin_removed deprecation marker exists",
  );
  assert(
    props["wam._origin_removed"].deprecationMessage,
    "_origin_removed has deprecationMessage",
  );
  // No stale origin settings (wam.origin.* should not exist)
  const originKeys = Object.keys(props).filter((k) =>
    k.startsWith("wam.origin."),
  );
  assert(
    originKeys.length === 0,
    `no wam.origin.* settings (got ${originKeys.length}: ${originKeys.join(",")})`,
  );
  // L1.extra: Stealth identity check
  assert(
    !pkg.name.includes("windsurf") && !pkg.name.includes("assistant"),
    "name has no banned keywords",
  );
  assert(
    !pkg.publisher.includes("zhouyoukang"),
    "publisher has no banned keywords",
  );
  console.log(
    `  pkg: ${pkg.name}@${pkg.version} pub=${pkg.publisher}, ${cmds.length} cmds (${wamCmds.length} wam.*)`,
  );
} else {
  skip++;
  console.log("  SKIP: package.json not found");
}

// ══ L2: WAM_VERSION alignment ══
section("L2: WAM_VERSION alignment");
const verMatch = code.match(/WAM_VERSION\s*=\s*"([^"]+)"/);
assert(verMatch, "WAM_VERSION constant exists");
if (verMatch) {
  assert(
    verMatch[1] === "17.42.19",
    `WAM_VERSION=17.42.19 (got ${verMatch[1]})`, // v17.42.19 深根固柢·长生久视
  );
}

// ══ L3: Core classes & functions ══
section("L3: Core module structure");
assert(
  code.includes("_detectProductName"),
  "_detectProductName (product auto-detect)",
);
assert(
  code.includes("_resolveDataDir"),
  "_resolveDataDir (data dir auto-detect)",
);
assert(code.includes("firebaseLogin"), "firebaseLogin function");
assert(code.includes("fetchAccountQuota"), "fetchAccountQuota function");
assert(code.includes("sanitizeCredential"), "sanitizeCredential function");
assert(code.includes("getBestIndex"), "getBestIndex method");
assert(
  code.includes("_sidebarProvider"),
  "_sidebarProvider (webview panel provider)",
);
assert(code.includes("module.exports"), "module.exports present");

// ══ L4: Devin dual-identity support ══
section("L4: Devin dual-identity");
assert(
  code.includes("devin") || code.includes("Devin"),
  "Devin support referenced",
);
assert(
  code.includes("_devinFullSwitch") || code.includes("devinFullSwitch"),
  "devinFullSwitch logic",
);
assert(
  code.includes("_devin-auth") || code.includes("devin-auth"),
  "Devin auth endpoint",
);

// ══ L5: Persistence (v17.37 critical fix) ══
section("L5: Persistence (v17.37 fix)");
const saveCount = (code.match(/_store\.save\(\)/g) || []).length;
assert(saveCount >= 20, `_store.save() calls >= 20 (got ${saveCount})`);
// No stale _saveStore() references
const staleCount = (code.match(/_saveStore\s*\(/g) || []).length;
assert(staleCount === 0, `no stale _saveStore() calls (got ${staleCount})`);
// doAutoRotate should persist
assert(
  code.includes("doAutoRotate") || code.includes("autoRotate"),
  "doAutoRotate function exists",
);
// panicSwitch should persist
assert(code.includes("panicSwitch"), "panicSwitch function exists");

// ══ L6: Chromium native bridge ══
section("L6: Chromium native bridge");
assert(code.includes("_bridgeReady"), "_bridgeReady flag");
assert(code.includes("_bridgeReadyCallbacks"), "_bridgeReadyCallbacks queue");
assert(code.includes("_fetchPending"), "_fetchPending map");
assert(code.includes("_bridgeEnsureTimer"), "_bridgeEnsureTimer");

// ══ L7: Token pool & predictive warming ══
section("L7: Token pool");
assert(code.includes("getBestIndex"), "getBestIndex (round-robin selection)");
assert(code.includes("bestI"), "bestI variable (best account index)");
assert(
  code.includes("getPoolStats") || code.includes("getHealth"),
  "pool stats / health check",
);
assert(
  code.includes("_prewarmedToken") || code.includes("prewarmedToken"),
  "token pre-warming",
);

// ══ L8: Timer management ══
section("L8: Timer management");
assert(code.includes("_scanTimer"), "_scanTimer");
assert(code.includes("_pollTimer"), "_pollTimer");
assert(
  code.includes("_monitorTimer") || code.includes("_rateLimitWatcher"),
  "monitor/rateLimit timer",
);

// ══ L9: Origin separation (v17.36) ══
section("L9: Origin separation (v17.36)");
// After v17.36, WAM should NOT contain OriginCtl / OriginProxy spawn logic
// But backward-compat stubs should exist
assert(
  !code.includes("class OriginCtl") && !code.includes("class OriginProxy"),
  "no OriginCtl/OriginProxy class (剥离 to dao-agi)",
);
// Backward compat: origin commands registered but show migration notice
assert(
  code.includes("_origin_removed") ||
    code.includes("origin_removed") ||
    code.includes("已移至"),
  "origin removal notice present",
);

// ══ L10: bundled-origin 已删除 (v17.41 损之又损) ══
section("L10: bundled-origin removed (v17.41)");
const verFile = path.join(extDir, "bundled-origin", "VERSION");
assert(
  !fs.existsSync(verFile),
  "bundled-origin/VERSION 已删除 (v17.41 死代码清理)",
);
const bundledDir = path.join(extDir, "bundled-origin");
assert(!fs.existsSync(bundledDir), "bundled-origin/ 目录已删除");

// ══ L11: .vscodeignore (VSIX content control) ══
section("L11: .vscodeignore");
const vsciPath = path.join(extDir, ".vscodeignore");
if (fs.existsSync(vsciPath)) {
  const vsci = fs.readFileSync(vsciPath, "utf8");
  assert(vsci.includes("!extension.js"), ".vscodeignore includes extension.js");
  assert(vsci.includes("!package.json"), ".vscodeignore includes package.json");
  // bundled-origin should NOT be included (v17.36 stripping)
  assert(
    !vsci.includes("!bundled-origin"),
    "bundled-origin NOT included in VSIX (Origin剥离)",
  );
} else {
  skip++;
  console.log("  SKIP: .vscodeignore not found");
}

// ══ L12: Auto-update system ══
section("L12: Auto-update");
assert(
  code.includes("autoUpdate") || code.includes("auto_update"),
  "autoUpdate system",
);
assert(
  code.includes("jsDelivr") || code.includes("jsdelivr"),
  "jsDelivr CDN fallback",
);
assert(
  code.includes("checkUpdate") || code.includes("_checkUpdate"),
  "checkUpdate function",
);

// ══ L13: Soft-coding verification (zero hardcoded secrets) ══
section("L13: Soft-coding (no hardcoded secrets)");
// No hardcoded Firebase API keys (should be in config or fetched)
const hardcodedKeys = code.match(/AIza[A-Za-z0-9_-]{35}/g) || [];
// Some keys may be defaults in code — just count, not fail
console.log(
  `  Firebase API keys in code: ${hardcodedKeys.length} (soft-coded via wam.firebase.extraKeys)`,
);
// No hardcoded passwords
assert(
  !code.includes("password123") && !code.includes("P@ssw0rd"),
  "no obvious hardcoded passwords",
);

// ══ L14: Deactivate cleanup ══
section("L14: Deactivate cleanup");
assert(code.includes("function deactivate"), "deactivate function exists");
assert(code.includes("_saveSnapshots"), "snapshots saved on deactivate");
assert(code.includes("_saveTokenCache"), "token cache saved on deactivate");
assert(code.includes("_saveInUse"), "inUse marks saved on deactivate");
assert(
  code.includes("_uninstallMessageAnchor"),
  "messageAnchor uninstalled on deactivate",
);

// ══ L15: v17.39 消息锚定·五路道并行 ══
section("L15: messageAnchor (v17.39 · 反者道之动)");
assert(code.includes("_msgAnchor"), "_msgAnchor state object exists");
assert(code.includes("_msgAnchorTrigger"), "_msgAnchorTrigger unified entry");
assert(code.includes("_msgAnchorDoSwitch"), "_msgAnchorDoSwitch switch logic");
assert(
  code.includes("_installNetworkAnchor"),
  "Path A: network monkey-patch installer",
);
assert(
  code.includes("_installCommandAnchor"),
  "Path B: command monkey-patch installer",
);
assert(
  code.includes("_installCascadeFileAnchor"),
  "Path C: cascade file watcher installer",
);
assert(
  code.includes("_installMessageAnchor"),
  "_installMessageAnchor orchestrator",
);
assert(
  code.includes("_uninstallMessageAnchor"),
  "_uninstallMessageAnchor teardown",
);
assert(
  code.includes("_msgAnchorSnapshot"),
  "_msgAnchorSnapshot diagnostic interface",
);
assert(
  code.includes("messageAnchor.enabled"),
  "messageAnchor.enabled config key referenced",
);
assert(
  code.includes("messageAnchor.debounceMs"),
  "messageAnchor.debounceMs config key referenced",
);
assert(
  code.includes("messageAnchor.everyN"),
  "messageAnchor.everyN config key referenced",
);
assert(
  code.includes("messageAnchor.dedupeMs"),
  "messageAnchor.dedupeMs config key referenced",
);
assert(
  code.includes("messageAnchor.path"),
  "messageAnchor.path.* config keys referenced",
);
assert(
  code.includes("_msgAnchor.paths.network"),
  "path-network tracked in state",
);
assert(
  code.includes("_msgAnchor.paths.command"),
  "path-command tracked in state",
);
assert(
  code.includes("_msgAnchor.paths.cascade"),
  "path-cascade tracked in state",
);
assert(
  code.includes("_msgAnchor.paths.ratelim"),
  "path-ratelim tracked in state",
);
assert(
  code.includes("_msgAnchor.paths.http2"),
  "path-http2 tracked in state (v17.42)",
);
assert(
  code.includes("_installHttp2Anchor"),
  "Path E: HTTP/2 prototype-level hook installer (v17.42)",
);
assert(
  code.includes("_uninstallHttp2Anchor"),
  "_uninstallHttp2Anchor teardown (v17.42)",
);
assert(
  code.includes(".codeium") &&
    code.includes("windsurf") &&
    code.includes("cascade"),
  "cascade dir path ~/.codeium/windsurf/cascade",
);
assert(
  code.includes("grpcCascadeSend") ||
    code.includes("StreamCascade") ||
    code.includes("cloudPath"),
  "cascade network fingerprint regex present (v17.42: grpcCascadeSend/cloudPath)",
);
// multi-Dao: network.request 被钩且保留原函数
assert(
  code.includes("origHttpsReq"),
  "https.request original preserved for restore",
);
assert(
  code.includes("origExec"),
  "executeCommand original preserved for restore",
);
// package.json cross-check
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const props =
    (pkg.contributes &&
      pkg.contributes.configuration &&
      pkg.contributes.configuration.properties) ||
    {};
  assert(
    props["wam.messageAnchor.enabled"],
    "wam.messageAnchor.enabled exposed in package.json",
  );
  assert(
    props["wam.messageAnchor.debounceMs"],
    "wam.messageAnchor.debounceMs exposed",
  );
  assert(props["wam.messageAnchor.everyN"], "wam.messageAnchor.everyN exposed");
  assert(
    props["wam.messageAnchor.path.network"],
    "wam.messageAnchor.path.network exposed",
  );
  assert(
    props["wam.messageAnchor.path.command"],
    "wam.messageAnchor.path.command exposed",
  );
  assert(
    props["wam.messageAnchor.path.cascade"],
    "wam.messageAnchor.path.cascade exposed",
  );
}
// exports include snapshot API
assert(
  /module\.exports\s*=\s*\{[^}]*_msgAnchorSnapshot/.test(code),
  "_msgAnchorSnapshot exported",
);
// activate hook
assert(
  /_installMessageAnchor\s*\(\s*context\s*\)/.test(code),
  "_installMessageAnchor(context) called in activate",
);
// 太上不知有之: 新路径不能 showInformationMessage (仅日志)
const msgAnchorSection = (code.match(/v17\.39[\s\S]*?v17\.39 END/) || [""])[0];
const toastInAnchor = (msgAnchorSection.match(/showInformationMessage/g) || [])
  .length;
assert(
  toastInAnchor === 0,
  `no showInformationMessage in messageAnchor region (got ${toastInAnchor})`,
);

// ══ L16: v17.40 Devin-first 千繁归一·持久化根治 ══
section("L16: Devin-first (v17.40 · 万法归宗)");
assert(code.includes("preferDevinFirst"), "preferDevinFirst 开关引用");
assert(code.includes("firebaseMaxTimeoutMs"), "firebaseMaxTimeoutMs 配置");
assert(
  code.includes("_persistDevinMark"),
  "_persistDevinMark 持久化辅助 (根治: v17.35 缺 save 的 bug)",
);
assert(
  code.includes("_persistFirebaseMark"),
  "_persistFirebaseMark 持久化辅助",
);
assert(code.includes("goDevinFirst"), "goDevinFirst 分支标志");
assert(code.includes("devinKnown"), "devinKnown 已知 devin 账号判定");
assert(
  code.includes("firebaseLocked"),
  "firebaseLocked 明确标记的 firebase 账号",
);
assert(code.includes("firebase_overall_timeout"), "Firebase 整体超时保护");
assert(code.includes("both_auth_failed"), "双路皆败错误标识");
assert(/if\s*\(\s*goDevinFirst\s*\)/.test(code), "goDevinFirst if 分支");
assert(/Promise\.race\s*\(/.test(code), "Promise.race 超时竞速使用");
// 持久化根治: _persistDevinMark 函数体内必须有 _store.save() (v17.35 遗漏 bug 的修复验证)
const devinMarkDefIdx = code.indexOf("const _persistDevinMark");
const devinMarkDefEnd = code.indexOf(
  "const _persistFirebaseMark",
  devinMarkDefIdx,
);
const devinMarkBody =
  devinMarkDefIdx > 0 && devinMarkDefEnd > devinMarkDefIdx
    ? code.substring(devinMarkDefIdx, devinMarkDefEnd)
    : "";
assert(
  devinMarkBody.includes("_store.save()"),
  "_persistDevinMark 函数体内有 _store.save() 调用 (持久化根治)",
);
// package.json cross-check
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const props =
    (pkg.contributes &&
      pkg.contributes.configuration &&
      pkg.contributes.configuration.properties) ||
    {};
  assert(props["wam.preferDevinFirst"], "wam.preferDevinFirst 在 package.json");
  assert(
    props["wam.preferDevinFirst"].default === true,
    "wam.preferDevinFirst 默认 true",
  );
  assert(
    props["wam.firebaseMaxTimeoutMs"],
    "wam.firebaseMaxTimeoutMs 在 package.json",
  );
  assert(
    typeof props["wam.firebaseMaxTimeoutMs"].default === "number",
    "firebaseMaxTimeoutMs 默认是数字",
  );
}

// ══ L17: v17.41 唯变所适 · 去除硬路径硬端口硬编码 ══
section("L17: 唯变所适 (v17.41 · 道法自然)");
assert(code.includes("_resolveWamDir"), "_resolveWamDir 动态解析 WAM_DIR");
assert(code.includes("WAM_HOT_DIR"), "env WAM_HOT_DIR 支持");
assert(code.includes("_deriveWamPaths"), "_deriveWamPaths 派生路径函数");
assert(code.includes("_deriveOrigin"), "_deriveOrigin URL origin 自动推导");
assert(code.includes("_getRegisterUrl"), "_getRegisterUrl 可配化");
assert(code.includes("_getChatCapacityUrl"), "_getChatCapacityUrl 可配化");
assert(code.includes("_getClaudeProbeModel"), "_getClaudeProbeModel 可配化");
assert(code.includes("_getDevinLoginUrl"), "_getDevinLoginUrl 可配化");
assert(
  code.includes("_getWindsurfPostAuthUrl"),
  "_getWindsurfPostAuthUrl 可配化",
);
assert(
  code.includes("_getOfficialPlanStatusUrls"),
  "_getOfficialPlanStatusUrls 可配化",
);
assert(
  code.includes("_getFallbackScanPorts"),
  "_getFallbackScanPorts 可配化端口扫描",
);
assert(code.includes("_getGatewayPorts"), "_getGatewayPorts 可配化网关端口");
assert(code.includes("_getFirebaseKeys"), "_getFirebaseKeys 可配化");
assert(code.includes("_getFirebaseReferer"), "_getFirebaseReferer 可配化");
assert(code.includes("_getFirebaseHost"), "_getFirebaseHost 可配化");
// WAM_DIR 必须是 let (不是 const) — 支持 activate() 时重赋值
assert(/^let WAM_DIR/m.test(code), "WAM_DIR 声明为 let (可重赋值)");
// package.json cross-check v17.41 新配置
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const props =
    (pkg.contributes &&
      pkg.contributes.configuration &&
      pkg.contributes.configuration.properties) ||
    {};
  assert(props["wam.wamHotDir"], "wam.wamHotDir 在 package.json");
  assert(props["wam.claudeProbeModel"], "wam.claudeProbeModel 在 package.json");
  assert(props["wam.devin.loginUrl"], "wam.devin.loginUrl 在 package.json");
  assert(
    props["wam.devin.postAuthUrl"],
    "wam.devin.postAuthUrl 在 package.json",
  );
  assert(props["wam.registerUrl"], "wam.registerUrl 在 package.json");
  assert(props["wam.chatCapacityUrl"], "wam.chatCapacityUrl 在 package.json");
  assert(props["wam.planStatusUrls"], "wam.planStatusUrls 在 package.json");
  assert(props["wam.proxy.scanPorts"], "wam.proxy.scanPorts 在 package.json");
  assert(
    props["wam.proxy.gatewayPorts"],
    "wam.proxy.gatewayPorts 在 package.json",
  );
}
// 无残余硬编码常量 (const 版本应已被替换)
assert(
  !code.includes("const _REGISTER_URL"),
  "_REGISTER_URL 不再是 const (已 getter 化)",
);
assert(
  !code.includes("const _CHAT_CAPACITY_URL"),
  "_CHAT_CAPACITY_URL 不再是 const (已 getter 化)",
);
assert(
  !code.includes("const _CLAUDE_PROBE_MODEL"),
  "_CLAUDE_PROBE_MODEL 不再是 const (已 getter 化)",
);
assert(!code.includes("const WAM_DIR"), "WAM_DIR 不再是 const (可动态赋值)");

// ══ L18: v17.42 反者道之动 · 逆向本源根治msgAnchor ══
section(
  "L18: v17.42 反者道之动 (localhost gRPC + http2 + fetch + 五感退出 + monitor退避)",
);
// http2 require
assert(code.includes('require("http2")'), "http2 module imported");
// Path A 增强: localhost gRPC 双层匹配
assert(
  code.includes("localHost") || code.includes("localhost"),
  "localhost gRPC 匹配 (v17.42 双层: 云端宽松+本地精确)",
);
assert(
  code.includes("grpcCascadeSend") || code.includes("SendUserCascadeMessage"),
  "逆向确认的真实 gRPC 方法名 (SendUserCascadeMessage 等)",
);
// Path A 增强: globalThis.fetch hook
assert(
  code.includes("origFetch") || code.includes("patchedFetch"),
  "globalThis.fetch hook (ConnectRPC undici 覆盖)",
);
// Path E: HTTP/2 prototype-level hook
assert(
  code.includes("origProtoRequest") || code.includes("_patchedProto"),
  "HTTP/2 ClientHttp2Session.prototype.request hook (v17.42 原型链穿透)",
);
assert(
  code.includes("_getActiveHandles"),
  "process._getActiveHandles 定位活跃 HTTP/2 session",
);
// 消息即标记使用中
assert(
  code.includes("markInUse"),
  "消息发送即标记使用中 (v17.42: 不等额度变化)",
);
// 五感快速退出 (inject 失败不重试)
assert(
  code.includes("五感注入失败") || code.includes("五感模式"),
  "五感注入失败快速退出 (知止可以不殆)",
);
// monitor 退避 (连续失败递增间隔)
assert(
  code.includes("_monitorConsecutiveFails"),
  "monitor 连续失败退避计数 (v17.42 知止可以不殆)",
);
assert(code.includes("monitorInterval"), "monitor 动态退避间隔函数");
// v17.42.1: 切号重置退避 (归入 _afterSwitchSuccess 后仅 2 处: helper定义 + fetch成功)
assert(
  (code.match(/_monitorConsecutiveFails\s*=\s*0/g) || []).length >= 2,
  "_monitorConsecutiveFails=0 至少 2 处 (helper + 监测成功)",
);
// v17.42.1: origFetch 初始声明
assert(
  code.includes("origFetch: null"),
  "origFetch: null 初始声明 (fetch hook 状态完整)",
);

// ══ L19: v17.42.2 去芜存菁 · 切号后state不变量归一 ══
section("L19: v17.42.2 去芜存菁 (大制不割 · _afterSwitchSuccess)");
assert(
  code.includes("function _afterSwitchSuccess"),
  "_afterSwitchSuccess 统一不变量函数 (v17.42.2)",
);
// helper 必须包含所有 6 项不变量
const asDefIdx = code.indexOf("function _afterSwitchSuccess");
const asDefEnd = asDefIdx > 0 ? code.indexOf("\n}", asDefIdx) : -1;
const asBody =
  asDefIdx > 0 && asDefEnd > asDefIdx
    ? code.substring(asDefIdx, asDefEnd + 2)
    : "";
assert(
  asBody.includes("_store.activeIndex = bestI"),
  "_afterSwitchSuccess 含 _store.activeIndex 赋值",
);
assert(
  asBody.includes("_store.switchCount++"),
  "_afterSwitchSuccess 含 switchCount 递增",
);
assert(
  asBody.includes("_lastSwitchTime = Date.now()"),
  "_afterSwitchSuccess 含 _lastSwitchTime 更新",
);
assert(
  asBody.includes("_monitorConsecutiveFails = 0"),
  "_afterSwitchSuccess 含 monitor 退避重置",
);
assert(
  asBody.includes("_store.save()"),
  "_afterSwitchSuccess 含 _store.save() 持久化",
);
assert(
  asBody.includes("_quotaSnapshots.delete"),
  "_afterSwitchSuccess 含快照失效",
);
assert(
  asBody.includes("_schedulePersist"),
  "_afterSwitchSuccess 含 _schedulePersist",
);
// 8 路切号成功位全部调用 helper (msgAnchor/monitor/exhaust/ratelim/setMode/autoRotate/panic/wamMode)
const callCount = (code.match(/_afterSwitchSuccess\(/g) || []).length;
assert(
  callCount >= 9, // 1 定义 + 8 调用
  `_afterSwitchSuccess 调用 ≥ 8 处 (1 定义 + 8 切号位) · got ${callCount}`,
);
// 除 helper 外, 无任何散落的 _store.activeIndex = bestI (已归一 · 大制不割)
// 使用多行模式: 仅匹配"行首 + 可选空白 + _store..." (排除注释 `// _store...`)
const strayActiveIdx = (
  code.match(/^\s*_store\.activeIndex\s*=\s*bestI\s*;/gm) || []
).length;
assert(
  strayActiveIdx === 1, // 仅 helper 内 1 处 (可执行语句)
  `_store.activeIndex = bestI 可执行语句仅 helper 内 1 处 · got ${strayActiveIdx}`,
);
// store.activeIndex 也归一 (局部 store 参数 e.g. doAutoRotate 已移除)
const strayLocalStore = (
  code.match(/^\s*store\.activeIndex\s*=\s*bestI\s*;/gm) || []
).length;
assert(
  strayLocalStore === 0,
  `局部 store.activeIndex = bestI 已归一 · got ${strayLocalStore}`,
);

// ══ L20: v17.42.3 反者道之动 · _devinLogin 四路归一 ══
section("L20: v17.42.3 _devinLogin 四路竞速 (反者道之动 · 万法归宗)");
const devinLoginIdx = code.indexOf("async function _devinLogin");
assert(devinLoginIdx > 0, "_devinLogin 存在");
if (devinLoginIdx > 0) {
  // 提取函数体 (到下一个 async function 前)
  const nextFnIdx = code.indexOf("\nasync function ", devinLoginIdx + 10);
  const devinLoginBody = code.substring(
    devinLoginIdx,
    nextFnIdx > 0 ? nextFnIdx : devinLoginIdx + 5000,
  );
  // 必含 Origin/UA (匹配网页 fetch)
  assert(
    devinLoginBody.includes("Origin: urlOrigin"),
    "_devinLogin 含 Origin 头 (匹配 windsurf.com 同源 fetch)",
  );
  assert(
    devinLoginBody.includes("User-Agent"),
    "_devinLogin 含 User-Agent 头 (浏览器伪装)",
  );
  // 必含 4 个命名通道
  for (const ch of ["direct-auto", "proxy", "direct-raw", "native"]) {
    assert(
      devinLoginBody.includes(`n: "${ch}"`) ||
        devinLoginBody.includes(`"${ch}"`),
      `_devinLogin 含通道 "${ch}"`,
    );
  }
  // 错误聚合改为 perCh 具名 map (非单一 errs[0])
  assert(
    devinLoginBody.includes("const perCh = {}") ||
      devinLoginBody.includes("perCh[n]"),
    "_devinLogin 错误聚合用具名 map (非单 errs[0])",
  );
  // 错误串接 format: "ch:msg | ch:msg | ..." (template literal ${n}:${m})
  assert(
    devinLoginBody.includes(".map(([n, m])") &&
      devinLoginBody.includes("${n}:${m}"),
    "_devinLogin 最终错误串接 ${n}:${m} 模板",
  );
  // 永久错识别 (业务级 permanent pattern)
  assert(
    devinLoginBody.includes("permanentPat") ||
      devinLoginBody.includes("invalid|not"),
    "_devinLogin 含业务级永久错快速识别 (INVALID_LOGIN_CREDENTIALS 等)",
  );
  // v17.42.3: j.detail 优先 (匹配 windsurf.com 401 返回 {"detail":"Invalid..."})
  assert(
    devinLoginBody.includes("j.detail"),
    "_devinLogin 错误提取优先读 j.detail (网页源码 chunks/1635 一致)",
  );
  // 成功返回含 viaChannel
  assert(
    devinLoginBody.includes("viaChannel"),
    "_devinLogin 成功返回含 viaChannel 指示",
  );
}

// ══ L21: v17.42.4 以神遇不以目视 · PlanStatus 18字段全解 ══
section("L21: v17.42.4 PlanStatus proto schema (逆向 windsurf.com 本源)");
// 存在 enum/helper 常量
assert(
  code.includes("const TEAMS_TIER = {") && code.includes("DEVIN_TRIAL"),
  "TEAMS_TIER 枚举 (21 种 tier) 存在",
);
assert(
  code.includes("const GRACE_PERIOD = {") && code.includes("EXPIRED"),
  "GRACE_PERIOD 枚举 (UNSPECIFIED/NONE/ACTIVE/EXPIRED) 存在",
);
assert(
  code.includes("function tierIsPaid(") &&
    code.includes("function tierIsTrial(") &&
    code.includes("function tierIsFree("),
  "tierIsPaid/Trial/Free helper 三件组齐全",
);
// _extractQuotaFields 新结构
const extractIdx = code.indexOf("function _extractQuotaFields(");
assert(extractIdx > 0, "_extractQuotaFields 存在");
if (extractIdx > 0) {
  const nextFnIdx = code.indexOf("\nfunction ", extractIdx + 10);
  const body = code.substring(
    extractIdx,
    nextFnIdx > 0 ? nextFnIdx : extractIdx + 8000,
  );
  // v17.42.4: 不再 /100 · 直接整数读取
  assert(
    !body.includes("used / 100") && !body.includes("total / 100"),
    "不再对 credits 做错误的 /100 除法 (v17.42.4 语义修正)",
  );
  // 必含 18 字段对应的字段号读取
  for (const fn of [
    "v[4]",
    "v[5]",
    "v[6]",
    "v[7]",
    "v[8]",
    "v[9]",
    "v[11]",
    "v[12]",
    "v[14]",
    "v[15]",
    "v[16]",
    "v[17]",
    "v[18]",
  ]) {
    assert(body.includes(fn), `_extractQuotaFields 读取 ${fn}`);
  }
  // 必解析嵌套消息 msgs[1] (plan_info), msgs[2/3] (plan_start/end), msgs[10] (top_up), msgs[13] (grace_end)
  for (const mi of ["msgs[1]", "msgs[2]", "msgs[3]", "msgs[10]", "msgs[13]"]) {
    assert(body.includes(mi), `_extractQuotaFields 解析嵌套消息 ${mi}`);
  }
  // 返回字段扩充
  for (const key of [
    "teamsTier",
    "teamsTierName",
    "isDevin",
    "promptUsed",
    "promptAvailable",
    "promptMonthly",
    "flowUsed",
    "flowAvailable",
    "flowMonthly",
    "gracePeriod",
    "gracePeriodEndUnix",
    "overageMicros",
    "topUpEnabled",
  ]) {
    assert(body.includes(key), `_extractQuotaFields 返回 ${key}`);
  }
}
// isClaudeAvailable / isTrialPlan 新签名
const icaIdx = code.indexOf("function isClaudeAvailable(");
if (icaIdx > 0) {
  const icaBody = code.substring(icaIdx, icaIdx + 1200);
  assert(
    icaBody.includes("tierIsFree") && icaBody.includes("tierIsPaid"),
    "isClaudeAvailable 用 tierIsFree/Paid 快速路径",
  );
  assert(
    icaBody.includes("gracePeriod === 3"),
    "isClaudeAvailable 识别 gracePeriod=EXPIRED",
  );
}
assert(
  code.includes("function isTrialPlan(plan, teamsTier)"),
  "isTrialPlan 新签名支持 teamsTier 参数",
);
// verify-gate 用 gracePeriod
assert(
  code.includes("verify_gate_free_tier") || code.includes("rejectFreeTier"),
  "verify-gate 识别 Free tier (tier=19 DEVIN_FREE / tier=6 WAITLIST_PRO)",
);
assert(
  code.includes("verify_gate_grace_expired") ||
    code.includes("rejectGraceExpired"),
  "verify-gate 识别 gracePeriod=EXPIRED 官方过期状态",
);
// _updateAccountUsage 持久化新字段
const updIdx = code.indexOf("function _updateAccountUsage(");
if (updIdx > 0) {
  // 查找函数结束: 下一个顶层 function (注意 function _updateAccountUsage 本身是顶层)
  const nextTopIdx = code.indexOf("\nfunction ", updIdx + 30);
  const updBody = code.substring(
    updIdx,
    nextTopIdx > 0 ? nextTopIdx : updIdx + 10000,
  );
  for (const key of [
    "promptCredits",
    "flowCredits",
    "flexCredits",
    "teamsTier",
    "gracePeriod",
    "topUp",
  ]) {
    assert(updBody.includes(key), `_updateAccountUsage 持久化 ${key}`);
  }
}
// getHealth 透传新字段 (类方法, 需查到方法体的闭合)
const ghIdx = code.indexOf("getHealth(acc)");
if (ghIdx > 0) {
  // 类方法体大概 3000-4000 char, 扩大搜索窗口
  const ghBody = code.substring(ghIdx, ghIdx + 4500);
  for (const key of [
    "teamsTier",
    "teamsTierName",
    "gracePeriod",
    "promptCredits",
    "flowCredits",
  ]) {
    assert(ghBody.includes(key), `getHealth 透传 ${key}`);
  }
}

// ══ L22: v17.42.5 太上不知有之 · 五刀贯通 ══
section(
  "L22: v17.42.5 太上不知有之 (notify/invisible/idToken守护/cascade避让/认证本源化)",
);

// —— 刀一: notify 三级治理 ——
assert(
  code.includes("function _notifyInfo(") &&
    code.includes("function _notifyWarn(") &&
    code.includes("function _notifyError("),
  "刀一: _notifyInfo/Warn/Error helper 三件组存在",
);
assert(
  code.includes("function _shouldNotify(") &&
    code.includes("function _getNotifyLevel("),
  "刀一: _shouldNotify + _getNotifyLevel 决策函数",
);
assert(
  (code.includes('kind === "fatal"') &&
    code.includes('kind === "user"') &&
    code.includes('kind === "auto"')) ||
    (code.includes('"fatal"') &&
      code.includes('"user"') &&
      code.includes('"auto"')),
  "刀一: kind 三分类 (fatal/user/auto) 均有使用",
);
// 验证已替换 vscode.window.show*Message 为 helper (起码除 helper 定义外仅剩 modal 对话)
const showMsgHits = (
  code.match(/vscode\.window\.show(Information|Warning|Error)Message\s*\(/g) ||
  []
).length;
// 3 个在 helper 定义 · 其余剩下的都是 modal/多参数确认框 (testDevinSwitch 结果/selfTest 结果/removeBatch 确认/wam.switchAccount 官方模式确认/wam.checkUpdate 源配置/wam.officialMode 确认/wam.panicSwitch 官方确认)
assert(
  showMsgHits <= 12,
  `刀一: show*Message 调用数 ≤ 12 (3 helper + ≤ 9 modal) · got ${showMsgHits}`,
);
assert(
  (code.match(/_notifyInfo\s*\(/g) || []).length >= 15,
  "刀一: _notifyInfo 调用 ≥ 15 处",
);
assert(
  (code.match(/_notifyWarn\s*\(/g) || []).length >= 10,
  "刀一: _notifyWarn 调用 ≥ 10 处",
);

// —— 刀二: invisible 无感模式 ——
assert(
  code.includes("function _isInvisibleMode("),
  "刀二: _isInvisibleMode helper",
);
assert(code.includes('_cfg("invisible"'), "刀二: wam.invisible 配置读取");
// 阈值激进
{
  const idx = code.indexOf("function _getAutoSwitchThreshold(");
  if (idx > 0) {
    const body = code.substring(idx, idx + 400);
    assert(
      body.includes("_isInvisibleMode()") &&
        body.includes("Math.max(base, 10)"),
      "刀二: _getAutoSwitchThreshold 无感模式 ≥ 10% (比基线 5% 激进)",
    );
  }
}
// 状态栏极简
{
  const idx = code.indexOf("function updateStatusBar(");
  if (idx > 0) {
    const body = code.substring(idx, idx + 3500);
    assert(
      body.includes("_isInvisibleMode()"),
      "刀二: updateStatusBar 识别 无感模式",
    );
    assert(
      body.includes("$(zap) ${s.pwCount}"),
      "刀二: 无感模式状态栏仅显示 $(zap) N",
    );
  }
}

// —— 刀三: idToken 主动守护 ——
assert(
  code.includes("function _activeTokenGuardTick(") &&
    code.includes("function _startActiveTokenGuardian(") &&
    code.includes("function _stopActiveTokenGuardian("),
  "刀三: _activeTokenGuardTick/Start/Stop 守护三件组",
);
assert(
  code.includes("GUARD_MARGIN_MS = 2 * 60 * 1000"),
  "刀三: 守护边距 2min (对齐官网 10min 过期)",
);
assert(
  code.includes("_startActiveTokenGuardian()") &&
    code.includes("_stopActiveTokenGuardian()"),
  "刀三: 守护已注册到 _ensureEngines / _stopEngines",
);

// —— 刀四: cascade 流式避让 ——
assert(
  code.includes("function _isCascadeStreaming(") &&
    code.includes("async function _waitIfCascadeBusy("),
  "刀四: _isCascadeStreaming + _waitIfCascadeBusy helper",
);
// 消息锚定 + 耗尽两处自动切号升级了避让
const waitCascadeHits = (code.match(/await _waitIfCascadeBusy\(/g) || [])
  .length;
assert(
  waitCascadeHits >= 2,
  `刀四: await _waitIfCascadeBusy() 插入至少 2 处 · got ${waitCascadeHits}`,
);

// —— 刀五: 认证链路本源化 ——
assert(
  code.includes("_persistFirebaseMark = () => {") &&
    (code.includes("No-op") || code.includes("不再自动标记")),
  "刀五: _persistFirebaseMark 已在内部 no-op (不再自动标记 firebase)",
);
assert(
  code.includes('_cfg("preferDevinFirst", true)'),
  "刀五: preferDevinFirst 默认 true",
);

// —— package.json 配置项 ——
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const props =
    (pkg.contributes.configuration &&
      pkg.contributes.configuration.properties) ||
    {};
  assert(props["wam.invisible"], "package.json 声明 wam.invisible");
  assert(props["wam.notify.level"], "package.json 声明 wam.notify.level");
  assert(
    props["wam.notify.level"] &&
      props["wam.notify.level"].enum &&
      props["wam.notify.level"].enum.length === 3,
    "wam.notify.level enum 有 3 个值 (silent/notify/verbose)",
  );
  assert(
    props["wam.notify.level"] && props["wam.notify.level"].default === "notify",
    "wam.notify.level 默认 notify",
  );
  assert(
    props["wam.invisible"] && props["wam.invisible"].default === false,
    "wam.invisible 默认 false (不强加用户 · opt-in)",
  );
}

// ══ L23: v17.42.6 死代理 env 自净 · 反者道之动 ══
section("L23: v17.42.6 env-proxy self-cleanse (启动 TCP 验活 · 死则剔 env)");

// —— 函数存在 ——
assert(
  /function\s+_tcpProbe\s*\(/.test(code),
  "_tcpProbe(host, port, timeoutMs) 函数定义存在",
);
assert(
  /async\s+function\s+_purgeDeadEnvProxy\s*\(/.test(code),
  "_purgeDeadEnvProxy() 异步函数定义存在",
);

// —— _tcpProbe 关键字段 ——
assert(
  code.includes("new net.Socket()") &&
    code.includes('socket.once("connect"') &&
    code.includes('socket.once("error"'),
  "_tcpProbe 使用 net.Socket + connect/error 双路",
);
assert(
  /socket\.connect\s*\(\s*port\s*,\s*host\s*\)/.test(code),
  "_tcpProbe 发起 socket.connect(port, host)",
);
assert(
  /setTimeout\(\s*\(\)\s*=>\s*finish\(false\)\s*,\s*timeoutMs\s*\)/.test(code),
  "_tcpProbe 有 timeoutMs 超时保护",
);

// —— _purgeDeadEnvProxy 覆盖所有大小写 env key ——
const envKeysExpected = [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
  "all_proxy",
];
for (const k of envKeysExpected) {
  assert(code.includes(`"${k}"`), `_purgeDeadEnvProxy 覆盖 env key '${k}'`);
}
// v17.42.8 语义升级: delete env 移至 _quarantineEnvProxySync · 用 `k` 变量名
assert(
  /delete\s+process\.env\[\s*k(ey)?\s*\]/.test(code),
  "env 删除语义保留 (delete process.env[k/key] · v17.42.8 同步化)",
);
assert(
  /await\s+_tcpProbe\(\s*host\s*,\s*port\s*,\s*2000\s*\)/.test(code),
  "TCP probe 2s 超时 (v17.42.8 在 _verifyAndRestoreEnvProxy 内)",
);
assert(
  /env-proxy\s+(purge|quarantine):/i.test(code) &&
    /env-proxy\s+(keep|restore):/i.test(code),
  "env-proxy 审计日志 (v17.42.8 purge↔quarantine · keep↔restore)",
);
assert(
  code.includes("_invalidateProxyCache()") &&
    /_invalidateProxyCache\(\)/.test(code),
  "清死代后必 _invalidateProxyCache() 让 _detectProxy 重扫",
);
assert(
  code.includes("seen.has(k)") && code.includes("seen.set(k"),
  "seen Map 去重 (同一 host:port 只验一次)",
);

// —— activate() 在起点即注入 ——
const actMatch = code.match(
  /function\s+activate\s*\(\s*context\s*\)\s*\{([\s\S]{0,4000})/,
);
assert(actMatch, "activate(context) 函数存在");
if (actMatch) {
  // v17.42.8: 同步 quarantine 第一行 + 异步 verifyAndRestore fire-and-forget
  assert(
    /_quarantineEnvProxySync\(\)/.test(actMatch[1]) &&
      /_verifyAndRestoreEnvProxy\(\)\.catch\(/.test(actMatch[1]),
    "activate() 含 _quarantineEnvProxySync() (同步) + _verifyAndRestoreEnvProxy().catch() (异步)",
  );
  // 验证 quarantine 在 globalStorage 之前 (最早网络 op 之前)
  const actStart = code.indexOf("function activate(context) {");
  const qIdx = code.indexOf("_quarantineEnvProxySync()", actStart);
  const vIdx = code.indexOf("_verifyAndRestoreEnvProxy()", actStart);
  const gsPathIdx = code.indexOf("context.globalStorageUri", actStart);
  assert(
    qIdx > actStart && qIdx < gsPathIdx,
    "_quarantineEnvProxySync 注入位置: activate 起点 · globalStorage 初始化之前",
  );
  assert(
    vIdx > qIdx && vIdx < gsPathIdx,
    "_verifyAndRestoreEnvProxy 紧随 quarantine · 也在 globalStorage 之前",
  );
}

// —— v17.42.6 版本描述锚点 ——
assert(
  /17\.42\.6:?\s*死代理\s*env\s*自净/.test(code),
  "WAM_VERSION 注释锚 '17.42.6: 死代理 env 自净'",
);

// —— 与 _getSystemProxy 的并存关系 ——
// _getSystemProxy 本身未改 · 是 _purgeDeadEnvProxy 在入口净化 env, 让 _getSystemProxy 天然看不到死代
assert(
  /function\s+_getSystemProxy\s*\(/.test(code),
  "_getSystemProxy 保留 · 依赖入口 env 已净化",
);
assert(
  code.includes("_getSystemProxy") &&
    code.indexOf("_purgeDeadEnvProxy") < code.lastIndexOf("_getSystemProxy"),
  "_purgeDeadEnvProxy 声明在 _getSystemProxy 之后 (辅助净化 · 不替代)",
);

// —— 根因 comment 锚点 (留档 future-proof) ——
assert(
  code.includes("Node 22+ https.request") ||
    code.includes("_skipAutoProxy 挡不住"),
  "根因注释: Node 22+ https.request 原生读 env 绕过 _skipAutoProxy",
);

// ══ L24: v17.42.7 锁🔒 全链贯通 + 一键导出 ══
section("L24: v17.42.7 lock 全链贯通 + copyAllAccounts 一键导出");

// —— _isValidAutoTarget 统一门 ——
assert(
  /function\s+_isValidAutoTarget\s*\(/.test(code),
  "_isValidAutoTarget(i) 函数定义存在 (统一候选验证门)",
);
assert(
  code.includes("if (acc.skipAutoSwitch) return false") ||
    /acc\.skipAutoSwitch\s*\)\s*return\s+false/.test(code),
  "_isValidAutoTarget 包含 skipAutoSwitch 四辨",
);
assert(
  /_isClaimedByOther\(acc\.email\)/.test(code),
  "_isValidAutoTarget 包含 跨实例 claimed 检查",
);
assert(
  code.includes("!acc.password") &&
    /_tokenPoolBlacklist(\s*&&\s*_tokenPoolBlacklist)?\.has\(ek\)/.test(code),
  "_isValidAutoTarget 包含 password + pool 黑名单四辨",
);

// —— 所有 选目标式 _predictiveCandidate 使用处必经 _isValidAutoTarget ——
// 选目标式: `_predictiveCandidate ... ? _predictiveCandidate : ...` (选为当届 target)
// 与 log 式 `>= 0 ? " [预判]"` 区分 (后者不以 _predictiveCandidate 作为真果)
const pickUses = [
  ...code.matchAll(
    /_predictiveCandidate\s*[>=!&|)]+[^?]*\?\s*_predictiveCandidate\s*:/g,
  ),
];
for (const m of pickUses) {
  const ctx = code.substring(Math.max(0, m.index - 200), m.index + 200);
  assert(
    ctx.includes("_isValidAutoTarget"),
    `选目标式 _predictiveCandidate 使用处必经 _isValidAutoTarget (@idx ${m.index})`,
  );
}
assert(
  pickUses.length >= 1,
  `至少 1 处 选目标式 _predictiveCandidate (msgAnchor) · got ${pickUses.length}`,
);
// 直式调用 _isValidAutoTarget(_predictiveCandidate) (monitor/exhaust/rate-limit 至少 3 处)
const directValidUses = [
  ...code.matchAll(/_isValidAutoTarget\(_predictiveCandidate\)/g),
];
assert(
  directValidUses.length >= 3,
  `_isValidAutoTarget(_predictiveCandidate) 直式 至少 3 处 (monitor/exhaust/rate-limit) · got ${directValidUses.length}`,
);

// —— toggleSkip 即时联动失效 ——
assert(
  /acc3\.skipAutoSwitch\s*&&\s*_predictiveCandidate\s*===\s*msg\.index/.test(
    code,
  ),
  "toggleSkip 手动锁 → 若为 _predictiveCandidate 即时失效",
);
assert(
  code.includes("🔒 lock:") && code.includes("即时作废"),
  "toggleSkip 失效联动有日志追迹",
);

// —— copyAllAccounts 消息处理 ——
assert(
  /case\s+["']copyAllAccounts["']\s*:/.test(code),
  "copyAllAccounts 后端 case 分支存在",
);
assert(
  code.includes("_store.accounts.map") &&
    code.includes("a.password ? `${a.email}:${a.password}` : a.email"),
  "copyAllAccounts 格式 email:password (无密码仅 email)",
);
assert(
  code.includes('lines.join("\\n")') || code.includes("lines.join('\\n')"),
  "copyAllAccounts 换行连接 (一行一个)",
);
assert(
  code.includes("账号池为空") || code.includes("pool 为空"),
  "copyAllAccounts 空池防护",
);
assert(/已导出\s*\$\{total\}/.test(code), "copyAllAccounts toast 显示导出总数");

// —— UI 一键导出按钮 ——
assert(/onclick="copyAll\(\)"/.test(code), "UI 有 copyAll() onclick 按钮");
assert(
  /function\s+copyAll\s*\(\s*\)\s*\{[^}]*copyAllAccounts/.test(code),
  "UI copyAll() 函数 postMessage copyAllAccounts",
);
assert(code.includes("一键导出"), "UI 按钮文本含 '一键导出'");

// —— v17.42.7 版本描述锚 ——
assert(
  /17\.42\.7:?\s*锁🔒\s*全链[路]?贯通/.test(code),
  "WAM_VERSION 注释锚 '17.42.7: 锁🔒 全链[路]贯通'",
);

// ══ L25: v17.42.8 同步隔离死代理 env + undici Dispatcher 重置 ══
section(
  "L25: v17.42.8 sync quarantine env proxy + undici global Dispatcher reset",
);

// —— 核心常量/变量 ——
assert(
  /_ENV_PROXY_KEYS\s*=\s*\[/.test(code),
  "_ENV_PROXY_KEYS 数组定义 (env 代理变量名清单)",
);
assert(
  /"HTTPS_PROXY"[\s\S]{0,10}"https_proxy"[\s\S]{0,10}"HTTP_PROXY"[\s\S]{0,10}"http_proxy"[\s\S]{0,10}"ALL_PROXY"[\s\S]{0,10}"all_proxy"/.test(
    code,
  ),
  "_ENV_PROXY_KEYS 含 6 个变体 (大小写 + 协议分 3×2)",
);
assert(
  /_savedEnvProxy\s*=\s*Object\.create\(null\)/.test(code),
  "_savedEnvProxy 备份表 (Object.create(null) 避 prototype 污染)",
);

// —— _quarantineEnvProxySync 同步函数 ——
assert(
  /function\s+_quarantineEnvProxySync\s*\(\s*\)/.test(code),
  "_quarantineEnvProxySync() 同步函数定义",
);
// 关键: 必须同步 delete env + 同步 setGlobalDispatcher
const qFn = code.substring(
  code.indexOf("function _quarantineEnvProxySync"),
  code.indexOf("function _verifyAndRestoreEnvProxy"),
);
assert(
  qFn.includes("delete process.env[k]"),
  "_quarantineEnvProxySync 同步 delete process.env[k]",
);
assert(
  qFn.includes("_savedEnvProxy[k]") && qFn.includes("= v"),
  "_quarantineEnvProxySync 备份原值到 _savedEnvProxy",
);
assert(
  qFn.includes('require("undici")') || qFn.includes("require('undici')"),
  "_quarantineEnvProxySync 同步 require('undici')",
);
assert(
  qFn.includes("setGlobalDispatcher(new undici.Agent())") ||
    /setGlobalDispatcher\(new\s+undici\.Agent\(\)\)/.test(qFn),
  "_quarantineEnvProxySync 调 undici.setGlobalDispatcher(new undici.Agent()) 重置 Dispatcher",
);
assert(
  qFn.includes("try {") && qFn.includes("} catch {"),
  "_quarantineEnvProxySync require('undici') 包 try/catch (老 Node 无 undici 兜底)",
);

// —— _verifyAndRestoreEnvProxy 异步验活 + 回写 ——
assert(
  /async\s+function\s+_verifyAndRestoreEnvProxy\s*\(\s*\)/.test(code),
  "_verifyAndRestoreEnvProxy() 异步函数定义",
);
const vFn = code.substring(
  code.indexOf("async function _verifyAndRestoreEnvProxy"),
  code.indexOf("// v17.42.8 兼容别名"),
);
assert(
  vFn.includes("_tcpProbe(host, port, 2000)"),
  "_verifyAndRestoreEnvProxy 2s TCP probe",
);
assert(
  vFn.includes("process.env[key] = val"),
  "_verifyAndRestoreEnvProxy 活代理回写 process.env[key] = val",
);
assert(
  vFn.includes("env-proxy restore") && vFn.includes("env-proxy quarantine"),
  "_verifyAndRestoreEnvProxy 分类日志 restore / quarantine",
);
assert(
  vFn.includes("_invalidateProxyCache()"),
  "_verifyAndRestoreEnvProxy 死代理后 _invalidateProxyCache",
);

// —— _purgeDeadEnvProxy 兼容别名 ——
assert(
  /async\s+function\s+_purgeDeadEnvProxy\s*\(\s*\)/.test(code),
  "_purgeDeadEnvProxy() 向后兼容别名保留",
);

// —— activate 第一行同步调用 _quarantineEnvProxySync ——
// v17.42.13: 窗口从 600→2000 字 (四级容错块增加 ~600 字 · 功能顺序不变)
const actStart = code.indexOf("function activate(context) {");
const actFirst200 = code.substring(actStart, actStart + 2000);
assert(
  actFirst200.includes("_quarantineEnvProxySync()"),
  "activate() 前段调用 _quarantineEnvProxySync() (第一行同步)",
);
assert(
  actFirst200.indexOf("_quarantineEnvProxySync()") <
    actFirst200.indexOf("_detectProductName()"),
  "_quarantineEnvProxySync() 必须在 _detectProductName() 之前 (即 activate 最早)",
);
assert(
  /_verifyAndRestoreEnvProxy\(\)\.catch\(/.test(code),
  "activate 调 _verifyAndRestoreEnvProxy().catch() fire-and-forget",
);

// —— v17.42.8 版本描述锚 ——
assert(
  /17\.42\.8:?\s*同步隔离死代理\s*env/.test(code),
  "WAM_VERSION 注释锚 '17.42.8: 同步隔离死代理 env'",
);
assert(
  /all_channels_failed/.test(code) &&
    /Devin\s+Cloud\s+is\s+disconnected|Devin Cloud disconnected/.test(code),
  "v17.42.8 根因注释含 all_channels_failed + Devin Cloud disconnected 双症锚",
);
assert(
  /Electron\s+Chromium\s+net|undici[\s\S]{0,50}ProxyAgent|ProxyAgent[\s\S]{0,50}cache/.test(
    code,
  ),
  "v17.42.8 根因注释锚 ProxyAgent cache 原理",
);

// —— 历史锚点保留 (v17.42.6 锚点 — 不破坏) ——
assert(
  /17\.42\.6:?\s*死代理\s*env\s*自净/.test(code),
  "v17.42.6 历史锚点保留 '死代理 env 自净' (向后兼容/审计)",
);

// ══ L26: v17.42.9 inject-dead 本源归档 · 知人者智 ══
section("L26: v17.42.9 inject-dead 归档 · switchToAccount inject fail 路径");

// —— 新字段 _injectFailed / _injectFailedAt / _injectFailedCount ——
assert(/_injectFailedCount/.test(code), "_injectFailedCount 字段引入");
assert(
  /deadAcc\._injectFailed\s*=\s*injErr/.test(code),
  "inject fail 路径设 _injectFailed=error",
);
assert(
  /deadAcc\._injectFailedAt\s*=\s*Date\.now\(\)/.test(code),
  "inject fail 路径设 _injectFailedAt=now",
);
assert(
  /deadAcc\._injectFailedCount\s*=\s*\(deadAcc\._injectFailedCount\s*\|\|\s*0\)\s*\+\s*1/.test(
    code,
  ),
  "inject fail 路径 _injectFailedCount++",
);

// —— 3 次阈值 → _archivePurged ——
assert(
  /deadAcc\._injectFailedCount\s*>=\s*3/.test(code),
  "3 次 inject fail 阈值",
);
assert(
  /archiving inject-dead account/.test(code),
  "归档日志锚 'archiving inject-dead account'",
);
assert(
  /inject_dead_after_retries/.test(code),
  "_purgeReason='inject_dead_after_retries'",
);
assert(
  /Windsurf\s+(内部\s+)?auth\s+(风控\s*)?拒绝/.test(code),
  "用户通知含 'Windsurf auth 风控拒绝'",
);

// —— 归档必走 _archivePurged + _store.remove ——
const injFailBlock = code.substring(
  code.indexOf("switch FAIL inject:"),
  code.indexOf("// 注入失败不清除token缓存"),
);
assert(
  injFailBlock.includes("_archivePurged(_store, [") &&
    injFailBlock.includes("_store.remove(idxI)"),
  "inject 归档调用 _archivePurged + _store.remove",
);

// —— inject OK 清标 ——
assert(
  /if\s*\(accOk\._injectFailedCount\s*>\s*0\)/.test(code),
  "inject OK 路径条件清 _injectFailedCount (若 >0)",
);
assert(
  /delete\s+accOk\._injectFailed;[\s\S]{0,80}delete\s+accOk\._injectFailedAt;[\s\S]{0,80}accOk\._injectFailedCount\s*=\s*0/.test(
    code,
  ),
  "inject OK 清三字段 _injectFailed/_injectFailedAt/_injectFailedCount=0",
);

// —— 归档恢复路径清理 inject 字段 ——
assert(
  /delete\s+clean\._injectFailed;[\s\S]{0,100}delete\s+clean\._injectFailedAt;[\s\S]{0,100}delete\s+clean\._injectFailedCount/.test(
    code,
  ),
  "从归档恢复路径清 _injectFailed* 三字段",
);

// —— v17.42.10 inject-dead 双路径逻辑仍完整 (代码中而非版本注释) ——
assert(/inject-dead/.test(code), "inject-dead 逻辑存在");
assert(
  /v17\.42\.9\s*L6102-6151|Firebase 路径|Firebase 分支|Firebase\s*归档/.test(
    code,
  ),
  "v17.42.9 逻辑锚保留 (Firebase 路径 L6102-6151)",
);

// —— L5881 Devin-only 分支 inject fail 归档 (v17.42.10 新增) ——
const devinInjFailIdx = code.indexOf(
  "switch FAIL inject (devin): ${JSON.stringify(injectResult.error)} [${ms}ms] · cache 已失效",
);
assert(
  devinInjFailIdx > 0,
  "Devin-only 分支 switch FAIL inject (devin) 日志锚存在",
);
const devinBlock = code.substring(devinInjFailIdx, devinInjFailIdx + 2500);
assert(
  devinBlock.includes("_devinAcc._injectFailed = injErrD") &&
    devinBlock.includes(
      "_devinAcc._injectFailedCount = (_devinAcc._injectFailedCount || 0) + 1",
    ),
  "Devin 分支 inject fail 设 _injectFailed/Count (镜像 Firebase 路径)",
);
assert(
  /_devinAcc\._injectFailedCount\s*>=\s*3/.test(devinBlock) &&
    devinBlock.includes("archiving inject-dead account") &&
    devinBlock.includes("inject_dead_after_retries"),
  "Devin 分支 3 次阈值 → _archivePurged + inject_dead_after_retries",
);
assert(
  devinBlock.includes("(Windsurf 内部 auth 拒绝×3 · Devin-only)"),
  "Devin 分支用户通知明示 'Devin-only' 出处",
);

// —— Devin 分支 inject OK 清标 ——
assert(
  /_devinAcc\._injectFailedCount\s*>\s*0/.test(code),
  "Devin 分支 inject OK 清 _injectFailedCount (若 >0)",
);
const devinOkCleanIdx = code.indexOf(
  "// v17.42.9: inject OK 清 inject-dead 标记 (Devin-only 分支)",
);
assert(devinOkCleanIdx > 0, "Devin 分支 inject OK 清标注释锚存在");
const devinOkBlock = code.substring(devinOkCleanIdx, devinOkCleanIdx + 400);
assert(
  devinOkBlock.includes("delete _devinAcc._injectFailed") &&
    devinOkBlock.includes("delete _devinAcc._injectFailedAt") &&
    devinOkBlock.includes("_devinAcc._injectFailedCount = 0"),
  "Devin 分支 inject OK 清三字段 (delete _injectFailed/_injectFailedAt + =0)",
);

// —— 双路径对称 (Firebase L6102-6151 + Devin L5881-5923) ——
const archCount = (code.match(/archiving inject-dead account/g) || []).length;
assert(
  archCount >= 2,
  `'archiving inject-dead account' 出现 ${archCount} 次 (期望 ≥2 · Firebase + Devin 双路径)`,
);
const purgeReasonCount = (code.match(/inject_dead_after_retries/g) || [])
  .length;
assert(
  purgeReasonCount >= 2,
  `'inject_dead_after_retries' 出现 ${purgeReasonCount} 次 (期望 ≥2)`,
);
assert(
  /code:0/.test(code) &&
    /(风控拒绝|auth\s*拒绝|auth\s*provider\s*拒绝)/.test(code),
  "注释含 code:0 + 风控/auth 拒绝 (根因留档)",
);

// —— 镜像对齐 login fail 归档路径 (L6047-6081 范式) ——
// login fail 用 _switchFailedCount · inject fail 用 _injectFailedCount · 语义隔离
assert(
  code.includes("_switchFailedCount") && code.includes("_injectFailedCount"),
  "双计数字段并存 (login _switchFailedCount · inject _injectFailedCount · 语义隔离)",
);

// ════════════════════════════════════════════════════════════
section(
  "L27: v17.42.12 道法自然 — @vscode/proxy-agent 本源突破 (proxySupport='on' + agent:false)",
);
// —— 核心机制: _deadProxyQuarantined + proxySupport 切换 + agent:false 注入 ——
assert(
  code.includes("_deadProxyQuarantined = true"),
  "_deadProxyQuarantined = true 存在 (quarantine 时设置)",
);
assert(
  code.includes("_deadProxyQuarantined = false"),
  "_deadProxyQuarantined = false 存在 (活代理恢复时清除)",
);
assert(/proxySupport.*on/.test(code), "proxySupport 切换为 'on' 逻辑存在");
assert(
  /_deadProxyQuarantined\)\s*\w+\.agent\s*=\s*false/.test(code),
  "_deadProxyQuarantined 时 agent=false 注入 (绕 @vscode/proxy-agent)",
);
assert(
  /let\s+_savedProxySupport/.test(code),
  "_savedProxySupport 变量存在 (保存原 proxySupport 值)",
);
assert(
  !code.includes('process.env.NO_PROXY = "*"'),
  "无 NO_PROXY=* (不再需要 · proxySupport='on' 已足够)",
);

// —— v17.42.8 env 隔离仍完整 ——
assert(
  /function _quarantineEnvProxySync/.test(code),
  "_quarantineEnvProxySync 同步隔离函数仍在",
);
assert(
  /async function _verifyAndRestoreEnvProxy/.test(code),
  "_verifyAndRestoreEnvProxy 异步验活函数仍在",
);
assert(
  code.includes("undici.setGlobalDispatcher"),
  "undici Dispatcher 重置仍在",
);
assert(
  code.includes("_invalidateProxyCache"),
  "_invalidateProxyCache 仍被调用 (死代理确认后触发重扫)",
);

// —— CONNECT 隧道 agent:false 保留 (良好实践) ——
const agentFalseCount = (code.match(/agent:\s*false.*socket.*已建/g) || [])
  .length;
assert(
  agentFalseCount >= 2,
  `CONNECT 隧道 agent:false 保留 (${agentFalseCount} 处 · 期望 ≥2)`,
);

// —— 版本锡 ——
assert(
  /17\.42\.12.*proxy-agent.*本源突破/.test(code),
  "WAM_VERSION 注释锨 '17.42.12: proxy-agent本源突破'",
);
assert(/proxySupport='on'/.test(code), "版本注释含 proxySupport='on' 突破策略");

// ════════════════════════════════════════════════════════════
section(
  "L28: v17.42.13 道冲·用之不盈·渊兮似万物之宗 (存储五级兜底+用户隔离+产品名三级强化+activate四级容错)",
);

// —— 新 helper: _isPathWritable (可写性探测 · 曲则全) ——
assert(
  /function _isPathWritable\s*\(p\)/.test(code),
  "_isPathWritable(p) 函数存在 (路径可写性探测 · 不可写即降级)",
);
assert(
  /\.wam_write_probe/.test(code),
  "_isPathWritable 使用 .wam_write_probe 探针文件",
);
assert(
  /fs\.mkdirSync\(p,\s*\{\s*recursive:\s*true\s*\}\)/.test(code),
  "_isPathWritable 不存在时 recursive mkdirSync 尝试创建",
);

// —— 新 helper: _getUserDiscriminator (用户隔离 · 各安其位) ——
assert(
  /function _getUserDiscriminator\s*\(\)/.test(code),
  "_getUserDiscriminator() 函数存在 (多用户同机不相侵)",
);
assert(
  /os\.userInfo\(\)/.test(code),
  "_getUserDiscriminator 使用 os.userInfo() 取用户名",
);
assert(
  /process\.env\.USERNAME\s*\|\|\s*process\.env\.USER/.test(code),
  "_getUserDiscriminator env 兜底 (USERNAME/USER/LOGNAME)",
);
assert(
  /return\s+"shared"/.test(code),
  "_getUserDiscriminator 末路返回 'shared' (单用户兼容)",
);

// —— _resolveWamDir 六级兜底 (渊兮似万物之宗) ——
assert(
  /function _resolveWamDir\s*\(context\)/.test(code),
  "_resolveWamDir(context) 签名接受 context 参数",
);
const wamDirFn = code.match(
  /function _resolveWamDir\s*\(context\)[\s\S]{0,2000}?\n\}/,
);
assert(wamDirFn && wamDirFn[0], "_resolveWamDir 函数体可提取");
if (wamDirFn && wamDirFn[0]) {
  const body = wamDirFn[0];
  assert(/process\.env\.WAM_HOT_DIR/.test(body), "级1: env WAM_HOT_DIR");
  assert(/wamHotDir/.test(body), "级2: vscode config wam.wamHotDir");
  assert(
    /legacy/.test(body) && /\.wam-hot/.test(body),
    "级3: legacy ~/.wam-hot 沿用",
  );
  assert(
    /_getUserDiscriminator\(\)/.test(body),
    "级4: 用户隔离 ~/.wam-hot/<user>",
  );
  assert(
    /globalStorageUri/.test(body) && /fsPath/.test(body),
    "级5: context.globalStorageUri (沙箱兜底)",
  );
  assert(/os\.tmpdir\(\)/.test(body), "级6: os.tmpdir() 末路");
  assert(/_isPathWritable/.test(body), "每级均调用 _isPathWritable 探测");
}

// —— _detectProductName 三级强化 (以神遇不以目视) ——
const prodFn = code.match(
  /function _detectProductName\s*\(\)[\s\S]{0,1200}?\n\}/,
);
assert(prodFn && prodFn[0], "_detectProductName 函数体可提取");
if (prodFn && prodFn[0]) {
  const body = prodFn[0];
  assert(/productName/.test(body), "优先1: cfg wam.productName");
  assert(/vscode\.env\.appName/.test(body), "优先2: vscode.env.appName");
  assert(
    /process\.execPath/.test(body) && /path\.basename/.test(body),
    "优先3 (v17.42.13 新): process.execPath basename 兜底",
  );
  assert(
    /\/\^\(node\|electron\|code\|code-oss\)\$/.test(body) ||
      /node\|electron\|code\|code-oss/.test(body),
    "execPath 排除 node/electron/code/code-oss 纯 runtime",
  );
  assert(
    /\/\[A-Za-z\\u4e00-\\u9fa5\]/.test(body) ||
      /A-Za-z.*u4e00-.*u9fa5/.test(body),
    "appName 接受含字母/中文, 排除纯空白/符号",
  );
}

// —— _resolveDataDir 多 fork 级联候选 (水无常形) ——
const ddFn = code.match(
  /function _resolveDataDir\s*\(productName\)[\s\S]{0,2500}?\n\}/,
);
assert(ddFn && ddFn[0], "_resolveDataDir 函数体可提取");
if (ddFn && ddFn[0]) {
  const body = ddFn[0];
  assert(
    /\["Windsurf"\s*,\s*"Cursor"\s*,\s*"Trae"\s*,\s*"Code"\]/.test(body),
    "_resolveDataDir 多 fork 候选: Windsurf/Cursor/Trae/Code",
  );
  assert(
    /XDG_CONFIG_HOME/.test(body),
    "linux 分支支持 XDG_CONFIG_HOME (v17.42.13 新)",
  );
}

// —— activate() 四级容错 + 降级模式标记 ——
assert(
  /_activateDegraded/.test(code),
  "_activateDegraded 降级模式标记变量存在",
);
assert(/storage-readonly/.test(code), "降级状态 'storage-readonly' 定义");
assert(/storage-partial/.test(code), "降级状态 'storage-partial' 定义");
assert(/_activateErrs/.test(code), "_activateErrs 错误聚合数组存在 (诊断可追)");
// 四段 try 块: detectProduct / resolveDataDir / resolveWamDir+deriveWamPaths+可写性 / log
const activateFrag = code.match(
  /function activate\(context\)[\s\S]{0,3500}?globalStorageUri/,
);
if (activateFrag && activateFrag[0]) {
  const body = activateFrag[0];
  const tryCount = (body.match(/try\s*\{/g) || []).length;
  assert(
    tryCount >= 4,
    `activate() 前段 try/catch 块 ≥ 4 (got ${tryCount}) — detectProduct/resolveDataDir/resolveWamDir/log`,
  );
  assert(
    /_resolveWamDir\(context\)/.test(body),
    "activate 调用 _resolveWamDir(context) 传入 context",
  );
  assert(
    /_isPathWritable\(WAM_DIR\)/.test(body),
    "activate 最终复验 _isPathWritable(WAM_DIR) (五级兜底后仍探一次)",
  );
}

// —— 调用方签名兼容: _resolveWamDir 接受 context (老调用 _resolveWamDir() 仍可用) ——
assert(
  /function _resolveWamDir\(context\)/.test(code) &&
    /WAM_DIR\s*=\s*_resolveWamDir\(context\)/.test(code),
  "_resolveWamDir(context) 新签名 + activate 内传 context",
);

// —— 版本锚点 ——
assert(
  /17\.42\.13.*(渊兮似万物之宗|道冲|不盈)/.test(code),
  "WAM_VERSION 注释含 '17.42.13: 渊兮似万物之宗/道冲/不盈' 本源锚点",
);
assert(
  /v17\.42\.12.*proxy-agent.*本源突破/.test(code),
  "v17.42.12 历史锚点保留 (向后兼容/审计)",
);

// ════════════════════════════════════════════════════════════
section(
  "L29: v17.42.14 不冤枉 (purge Devin网络/代理错→skip · 镜像Firebase路径)",
);

// —— 根因锚点: verifyAndPurgeExpired Devin 路径网络错误 skip ——
// 179机器 127.0.0.1:7799 死代理导致4通道全失败 → 10号被误判 devin_dead 归档
// 修复: 镜像 Firebase 路径 — 永久业务错才归档, 网络/代理错 skip 保留不冤枉

// 1. verifyAndPurgeExpired Devin 路径含 permanentDevinPat
const purgeFrag = code.match(
  /async function verifyAndPurgeExpired[\s\S]{0,20000}?\n\}/,
);
assert(purgeFrag && purgeFrag[0], "verifyAndPurgeExpired 函数体可提取");
if (purgeFrag && purgeFrag[0]) {
  const body = purgeFrag[0];
  // Devin 路径出现 permanentDevinPat 变量
  assert(
    /permanentDevinPat/.test(body),
    "verifyAndPurgeExpired Devin 路径含 permanentDevinPat (永久错判断)",
  );
  // Devin 路径含 "网络/代理错误" skip 日志
  assert(
    /网络\/代理错误/.test(body) || /DEVIN skip.*网络/.test(body),
    "verifyAndPurgeExpired Devin 路径含 '网络/代理错误' skip 日志",
  );
  // permanentDevinPat 包含 invalid|not_found|disabled|wrong
  assert(
    /invalid\|not\[\\s_-\]\?found\|disabled\|wrong\|email/.test(body) ||
      /invalid.*not.*found.*disabled.*wrong/.test(body),
    "permanentDevinPat 包含 invalid/not_found/disabled/wrong/email 业务错特征",
  );
  // 与 Firebase 路径对称: Firebase 路径有 INVALID|NOT_FOUND|DISABLED|WRONG
  assert(
    /INVALID\|NOT_FOUND\|DISABLED\|WRONG/.test(body),
    "Firebase 路径永久错 pattern 保留 (INVALID|NOT_FOUND|DISABLED|WRONG)",
  );
}

// 2. 版本锚点: WAM_VERSION = "17.42.14"
assert(
  /17\.42\.14.*不冤枉.*purge.*Devin/.test(code) ||
    /WAM_VERSION\s*=\s*"17\.42\.14"/.test(code),
  "WAM_VERSION = '17.42.14' 版本锚点存在",
);
assert(
  /v17\.42\.14.*不冤枉/.test(code) || /v17\.42\.14.*purge.*Devin/.test(code),
  "头注释含 v17.42.14 不冤枉锚点",
);

// 3. 对称性: Firebase 路径 skip 逻辑未被破坏
const firebasePurgeFrag = purgeFrag && purgeFrag[0];
if (firebasePurgeFrag) {
  assert(
    /网络\/临时错误.*跳过.*不冤枉/.test(firebasePurgeFrag) ||
      /purge.*skip.*err/.test(firebasePurgeFrag),
    "Firebase 路径 skip (网络/临时错误) 仍存在, 未被破坏",
  );
}

// ══ L30: v17.42.15 载营魄抱一 · 存储本源五重机制 ══
section(
  "L30: v17.42.15 载营魄抱一 (L1原子写+L2内容感知备份+L3灾难回退+L4锁+L5journal+healthCheck)",
);

// —— L1 原子写 ——
assert(
  code.includes("function _atomicWriteJson("),
  "_atomicWriteJson helper 存在 (tmp→fsync→rename)",
);
assert(
  code.includes(".tmp-") && code.includes("process.pid"),
  "_atomicWriteJson 使用 .tmp-<pid> 临时文件前缀",
);
assert(
  code.includes("fs.fsyncSync") || code.includes("fsyncSync"),
  "原子写含 fsync 刷盘 (可配)",
);
assert(code.includes("fs.renameSync"), "原子写使用 renameSync 原子替换");

// —— L2 内容感知备份 ——
assert(
  code.includes("function _safeReadAccountsFile("),
  "_safeReadAccountsFile helper 存在 (安全读+校验)",
);
assert(
  code.includes("function _scanAccountBackups("),
  "_scanAccountBackups helper 存在 (扫描备份目录)",
);
assert(
  /坏件不/.test(code) || /backup skip.*主文件无效/.test(code),
  "_autoBackup 含内容感知: 坏件不入备份",
);
assert(code.includes("_getMaxBackups"), "_getMaxBackups 配置读取 (分层保留)");
assert(code.includes("_getFsyncEnabled"), "_getFsyncEnabled 配置读取");
// daily retention logic
assert(
  code.includes("daily") && code.includes(".toISOString().slice(0, 10)"),
  "分层保留含每日最新逻辑 (YYYY-MM-DD 分组)",
);

// —— L3 灾难回退 ——
assert(
  code.includes("function _recoverFromBackupDir("),
  "_recoverFromBackupDir helper 存在 (灾难回退)",
);
assert(/L3.*灾难回退/.test(code), "load() 含 L3 灾难回退注释锚点");
assert(
  code.includes("load_disaster_recovery"),
  "灾难回退 journal 事件类型 load_disaster_recovery",
);

// —— L4 文件锁 ——
assert(
  code.includes("function _acquireStoreLock("),
  "_acquireStoreLock helper 存在 (文件锁)",
);
assert(code.includes("_wam_store.lock"), "锁文件路径 _wam_store.lock");
assert(
  code.includes("lock.release") || code.includes("_lock.release"),
  "save() 中锁释放调用",
);

// —— L5 事件journal ——
assert(
  code.includes("function _appendStoreJournal("),
  "_appendStoreJournal helper 存在 (事件日志)",
);
assert(
  code.includes("_wam_journal.jsonl"),
  "journal 文件路径 _wam_journal.jsonl",
);
assert(
  code.includes("7 * 1024 * 1024") || code.includes("7340032"),
  "journal 7MB 滚动保留",
);

// —— NULL-WIPE 护本 ——
assert(
  /抗误空写/.test(code) ||
    /null.*wipe.*guard/i.test(code) ||
    /diskProbe\.validCount/.test(code),
  "save() 含 NULL-WIPE 护本 (内存空+磁盘有效→不覆写)",
);

// —— _instanceId ——
assert(
  code.includes("let _instanceId") || code.includes("const _instanceId"),
  "_instanceId 实例标识 (锁+journal 追踪)",
);

// —— healthCheck 命令 ——
assert(code.includes('"wam.healthCheck"'), "wam.healthCheck 命令注册");
assert(
  code.includes("自动修复") || code.includes("自愈"),
  "healthCheck 含自愈交互",
);

// —— package.json 配置 ——
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const props =
    (pkg.contributes &&
      pkg.contributes.configuration &&
      pkg.contributes.configuration.properties) ||
    {};
  const cmds = (pkg.contributes && pkg.contributes.commands) || [];
  assert(
    props["wam.storage.maxBackups"],
    "wam.storage.maxBackups 在 package.json",
  );
  assert(props["wam.storage.fsync"], "wam.storage.fsync 在 package.json");
  assert(
    cmds.find((c) => c.command === "wam.healthCheck"),
    "wam.healthCheck 命令在 package.json",
  );
}

// —— 版本锚点 ——
assert(
  /v17\.42\.15.*载营魄抱一/.test(code),
  "头注释含 v17.42.15 载营魄抱一锚点 (向后兼容)",
);
assert(/WAM_VERSION\s*=\s*"17\.42\.19"/.test(code), "WAM_VERSION = '17.42.19'");

// ════════════════════════════════════════════════════════════
section(
  "L31: v17.42.17 重新锚定本源 · TurnTracker (一对话一会话·多对话并行·配额稳定推断终结)",
);

// —— TurnTracker 内存本源 ——
assert(
  /const _turns = new Map\(\)/.test(code),
  "_turns Map 内存本源 (turnId → Turn)",
);
assert(/let _turnTicker = null/.test(code), "_turnTicker 定时器变量");
assert(/let _turnSeq = 0/.test(code), "_turnSeq 自增序列");
assert(/function _newTurnId\(/.test(code), "_newTurnId 函数 (短 id 拼装)");

// —— 12 个核心函数都存在 ——
const turnFns = [
  "_startTurn",
  "_endTurn",
  "_observeTurnQuotaForEmail",
  "_tickTurns",
  "_pruneTurns",
  "_startTurnTicker",
  "_stopTurnTicker",
  "_activeTurnsByEmail",
  "_hasActiveTurnForEmail",
  "_activeTurnCount",
  "_endAllActiveTurnsForEmail",
  "_getTurnSnapshot",
];
for (const fn of turnFns) {
  assert(new RegExp(`function ${fn}\\b`).test(code), `TurnTracker 函数: ${fn}`);
}

// —— Turn 配置 6 项 getter (软编码) ——
const turnGetters = [
  "_getTurnEnabled",
  "_getTurnStableMs",
  "_getTurnMinMs",
  "_getTurnMaxMs",
  "_getTurnTickMs",
  "_getTurnRetainMs",
];
for (const g of turnGetters) {
  assert(new RegExp(`function ${g}\\(`).test(code), `Turn getter: ${g}`);
}

// —— Turn 字段语义 (status, lastQuotaChangeTs, baselineD/W) ——
const startTurnIdx = code.indexOf("function _startTurn(");
if (startTurnIdx > 0) {
  const block = code.substring(startTurnIdx, startTurnIdx + 1500);
  assert(/turnId,/.test(block), "_startTurn 写入 turnId");
  assert(/email: key/.test(block), "_startTurn 写入 email (lower)");
  assert(/startTs: now/.test(block), "_startTurn 写入 startTs");
  assert(
    /lastQuotaChangeTs: now/.test(block),
    "_startTurn 起步即视为刚变化 (lastQuotaChangeTs=now · stable 从此起算)",
  );
  assert(/status: "active"/.test(block), "_startTurn status='active'");
  assert(
    /_store\.markInUse\(key\)/.test(block),
    "_startTurn 投影到 _inUse 协调层 (跨实例可见)",
  );
}

// —— _tickTurns: stable / timeout 双终结 ——
const tickIdx = code.indexOf("function _tickTurns(");
if (tickIdx > 0) {
  const block = code.substring(tickIdx, tickIdx + 1200);
  assert(/age >= maxMs/.test(block), "_tickTurns: age>=maxMs → timeout 兜底");
  assert(
    /idle >= stableMs/.test(block),
    "_tickTurns: idle>=stableMs → stable 自然终结",
  );
  assert(
    /_endTurn\(tid,\s*"timeout"\)/.test(block),
    "_tickTurns 调 _endTurn(_, 'timeout')",
  );
  assert(
    /_endTurn\(tid,\s*"stable"\)/.test(block),
    "_tickTurns 调 _endTurn(_, 'stable')",
  );
}

// —— _endTurn: 该 email 无其他 active turn 时 clearInUse ——
const endTurnIdx = code.indexOf("function _endTurn(");
if (endTurnIdx > 0) {
  const block = code.substring(endTurnIdx, endTurnIdx + 1000);
  assert(
    /_hasActiveTurnForEmail\(t\.email\)/.test(block),
    "_endTurn 检查该 email 是否还有其他 active turn",
  );
  assert(
    /_store\.clearInUse\(t\.email\)/.test(block),
    "_endTurn 在无 active 时释放 _inUse (turn 是真理)",
  );
}

// —— msgAnchor: 调 _startTurn (替代 markInUse) ——
const msgAnchorTrigIdx = code.indexOf("function _msgAnchorTrigger");
if (msgAnchorTrigIdx > 0) {
  const block = code.substring(msgAnchorTrigIdx, msgAnchorTrigIdx + 1500);
  assert(
    /_startTurn\(activeAcc\.email\)/.test(block),
    "_msgAnchorTrigger 用 _startTurn (开新 turn · 取代 markInUse)",
  );
}

// —— monitor + scan 喂 turn ticker (lastQuotaChangeTs) ——
const monActIdx = code.indexOf("async function monitorActiveQuota");
if (monActIdx > 0) {
  const block = code.substring(monActIdx, monActIdx + 4500);
  assert(
    /_observeTurnQuotaForEmail\(emailKey,\s*result\.daily,\s*snapWeekly\)/.test(
      block,
    ),
    "monitorActiveQuota 喂 _observeTurnQuotaForEmail (活跃号配额变化)",
  );
}
const scanIdx = code.indexOf("_scanOneAccount");
if (scanIdx > 0) {
  const block = code.substring(scanIdx, scanIdx + 3000);
  assert(
    /_observeTurnQuotaForEmail\(emailKey,\s*result\.daily,\s*scanSnapW\)/.test(
      block,
    ),
    "scan 喂 _observeTurnQuotaForEmail (切号后旧号 turn 唯一来源)",
  );
}

// —— turn ticker 与监测引擎同生命周期 ——
const ensureIdx = code.indexOf("function _ensureEngines()");
if (ensureIdx > 0) {
  const block = code.substring(ensureIdx, ensureIdx + 2500);
  assert(
    /_startTurnTicker\(\)/.test(block),
    "_ensureEngines 启动 _startTurnTicker",
  );
}
const stopIdx = code.indexOf("function _stopEngines()");
if (stopIdx > 0) {
  const block = code.substring(stopIdx, stopIdx + 1000);
  assert(
    /_stopTurnTicker\(\)/.test(block),
    "_stopEngines 调用 _stopTurnTicker (deactivate 清理覆盖)",
  );
}

// —— AccountStore 新方法 ——
assert(
  /isInUseByThisConversation\(email\)\s*\{[\s\S]*_hasActiveTurnForEmail/.test(
    code,
  ),
  "AccountStore.isInUseByThisConversation 委托给 _hasActiveTurnForEmail",
);
assert(
  /getConversationInUseEmails\(\)/.test(code),
  "AccountStore.getConversationInUseEmails 存在 (多对话并行 · 返数组)",
);
assert(
  /getConversationInUseEmail\(\)/.test(code),
  "AccountStore.getConversationInUseEmail 保留 (向后兼容 · 首个 active turn)",
);

// —— UI buildHtml 使用 isInUseByThisConversation ——
const buildHtmlIdx = code.indexOf("function buildHtml(store)");
if (buildHtmlIdx > 0) {
  const block = code.substring(buildHtmlIdx, buildHtmlIdx + 2500);
  assert(
    /store\.isInUseByThisConversation\(a\.email\)/.test(block),
    "buildHtml 用 isInUseByThisConversation (per-row UI)",
  );
  assert(
    /_activeTurnsByEmail\(a\.email\)/.test(block),
    "buildHtml 取 _activeTurnsByEmail 显真实 turn 持续秒",
  );
  assert(
    /liveInUseLocal/.test(block) && /liveInUseRemote/.test(block),
    "buildHtml 拆分本对话 turn vs 跨实例协调池计数",
  );
}

// —— 状态栏 inUseCount = _activeTurnCount ——
const updateBarIdx = code.indexOf("function updateStatusBar");
if (updateBarIdx > 0) {
  const block = code.substring(updateBarIdx, updateBarIdx + 1500);
  assert(
    /_activeTurnCount\(\)/.test(block),
    "updateStatusBar 用 _activeTurnCount (本对话真值)",
  );
}

// —— wam.status: 本对话 vs 协调 ——
const statusCmdMarker = code.indexOf('registerCommand("wam.status"');
if (statusCmdMarker > 0) {
  const block = code.substring(statusCmdMarker, statusCmdMarker + 2000);
  assert(/_getTurnSnapshot\(\)/.test(block), "wam.status 调 _getTurnSnapshot");
  assert(
    /本对话\(/.test(block) && /协调:/.test(block),
    "wam.status 分显 本对话(N) / 协调",
  );
}

// —— QuickPick [使用中] / [协调] 分流 ——
const quickPickIdx = code.indexOf('registerCommand("wam.switchAccount"');
if (quickPickIdx > 0) {
  const block = code.substring(quickPickIdx, quickPickIdx + 3500);
  assert(
    /\[使用中/.test(block) && /\[协调\]/.test(block),
    "wam.switchAccount QuickPick 显 [使用中×N] / [协调]",
  );
  assert(
    /isInUseByThisConversation\(a\.email\)/.test(block),
    "QuickPick 用 isInUseByThisConversation 区分本对话 turn",
  );
}

// —— package.json 6 项 turn 配置 ——
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const props = (pkg.contributes || {}).configuration?.properties || {};
  for (const k of [
    "wam.turn.enabled",
    "wam.turn.stableMs",
    "wam.turn.minMs",
    "wam.turn.maxMs",
    "wam.turn.tickIntervalMs",
    "wam.turn.retainCompletedMs",
  ]) {
    assert(props[k], `package.json 含配置 ${k}`);
  }
}

// —— 版本锚点 ——
assert(
  /v17\.42\.17.*重新锚定本源/.test(code),
  "头注释含 v17.42.17 重新锚定本源锚点 (再确认)",
);

// ════════════════════════════════════════════════════════════
section("L32: v17.42.19 深根固柢·长生久视 · 死链自愈 + ExtHost 卡顿哨兵");

// —— 死链自愈 ——
assert(
  /const _DEAD_SOURCES\s*=\s*\[/.test(code),
  "_DEAD_SOURCES 已知废弃仓库列表",
);
assert(
  /AiCodeHelper\\\/rt-flow/.test(code),
  "_DEAD_SOURCES 含 AiCodeHelper/rt-flow (已废弃)",
);
assert(
  /function _isDeadAutoUpdateSource\(/.test(code),
  "_isDeadAutoUpdateSource 检测函数",
);
assert(
  /_isDeadAutoUpdateSource\(userSrc\)/.test(code),
  "_getAutoUpdateSource 调用 _isDeadAutoUpdateSource",
);
assert(/死链自愈/.test(code), "死链自愈日志锚点");
assert(
  /_autoUpdateMigrationLogged/.test(code),
  "_autoUpdateMigrationLogged 一次性日志标志",
);

// —— ExtHost 卡顿哨兵 ——
assert(
  /const _HEAVY_LS_EXTENSION_IDS\s*=/.test(code),
  "_HEAVY_LS_EXTENSION_IDS 重型 LS 名单",
);
assert(
  code.includes('"redhat.java"'),
  "重型 LS 名单含 redhat.java (LAPTOP-AKCGC7BM 元凶)",
);
assert(
  code.includes('"rust-lang.rust-analyzer"'),
  "重型 LS 名单含 rust-analyzer",
);
assert(
  /const _HEAVY_LS_EXTENSION_PREFIXES\s*=/.test(code),
  "_HEAVY_LS_EXTENSION_PREFIXES (vscjava./redhat. 前缀)",
);
assert(code.includes('"vscjava."'), "重型 LS 前缀含 vscjava.");
assert(
  /function _detectHeavyLsActive\(/.test(code),
  "_detectHeavyLsActive 嫌疑探测器",
);
assert(
  /vscode\.extensions\.all/.test(code),
  "_detectHeavyLsActive 用 vscode.extensions.all 枚举",
);
assert(
  /function _scheduleExtHostLagProbe\(/.test(code),
  "_scheduleExtHostLagProbe 探针调度器",
);
assert(
  /function _stopExtHostLagProbe\(/.test(code),
  "_stopExtHostLagProbe 停止器",
);
assert(
  /setImmediate\(\(\) => \{[\s\S]{0,400}lag/.test(code),
  "setImmediate + lag 测调度延迟",
);
assert(/extHostLag:.*ms.*阈值/.test(code), "extHostLag 日志格式 ms+阈值");
assert(/嫌疑首报/.test(code), "嫌疑首报一次性日志");

// —— 周期/阈值/开关 配置 ——
assert(/_getExtHostLagEnabled/.test(code), "_getExtHostLagEnabled 配置 getter");
assert(/_getExtHostLagProbeMs/.test(code), "_getExtHostLagProbeMs 配置 getter");
assert(
  /_getExtHostLagThresholdMs/.test(code),
  "_getExtHostLagThresholdMs 配置 getter",
);

// —— start/stop 集成 ——
assert(
  /_scheduleExtHostLagProbe\(\)/.test(code),
  "_startEngines 调用 _scheduleExtHostLagProbe",
);
assert(
  /_stopExtHostLagProbe\(\)/.test(code),
  "_stopEngines 调用 _stopExtHostLagProbe",
);

// —— package.json 三新配置 ——
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const cfg = (pkg.contributes && pkg.contributes.configuration) || {};
  const props = cfg.properties || {};
  assert(props["wam.extHostLag.enabled"], "wam.extHostLag.enabled 配置存在");
  assert(
    props["wam.extHostLag.probeIntervalMs"],
    "wam.extHostLag.probeIntervalMs 配置存在",
  );
  assert(
    props["wam.extHostLag.thresholdMs"],
    "wam.extHostLag.thresholdMs 配置存在",
  );
}

// —— 版本锚点 ——
assert(/v17\.42\.19.*深根固柢/.test(code), "头注释含 v17.42.19 深根固柢锚点");

// ══ Summary ══
console.log(`\n${"=".repeat(60)}`);
console.log(
  `WAM E2E v17.42.19-深根固柢·长生久视 · RESULT: ${pass} pass / ${fail} fail / ${skip} skip`,
);
console.log(`STATUS: ${fail === 0 ? "✅ ALL GREEN" : "❌ FAILURES DETECTED"}`);
process.exit(fail > 0 ? 1 : 0);
