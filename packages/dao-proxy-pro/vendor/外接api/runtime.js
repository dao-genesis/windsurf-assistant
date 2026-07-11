"use strict";
/**
 * runtime.js · 外接api 运行时 · 道法自然
 * ════════════════════════════════════════════════════════════════
 *
 *   《帛书·四十八章》: "为道者日损 · 损之又损 · 以至于无为 · 无为而无不为"
 *   《阴符经》: "天生天杀 · 道之理也"
 *
 *   职能:
 *     1. 初始化 dao_router.js (模型路由核心)
 *     2. 初始化 cascade_wire.js (protobuf 编解码)
 *     3. 为 extension.js tryStartExternalApi 提供 ExternalApiRuntime 类
 *     4. 为 source.js 提供路由判断 + 路由执行
 *
 *   接口 (对 extension.js):
 *     new ExternalApiRuntime({ vscodeModule, logger, configKey, vendorPrefix })
 *     .start()   → { gatewayUrl, providers, models }
 *     .stop()    → void
 *     .isRunning() → bool
 *     .getStatus() → { gatewayUrl, providers, models, routerReady, routerCount }
 *
 *   接口 (对 source.js):
 *     getRouter()  → dao_router 实例 (null if not ready)
 *     shouldRoute(modelUid) → bool
 *     route(req, res, rawBody, isJSON, modelUid) → Promise<bool>
 *
 *   v9.9.59 · 从 070-插件_Plugins/外接api/01-外接api模型路由/runtime.js 归宗
 *     修 DEFECT2: vendor/外接api/runtime.js 缺失 → tryStartExternalApi 永抛异常
 */

const path = require("path");
const fs = require("fs");

// ── 核心模块路径 ──
const CORE_DIR = path.join(__dirname, "core");
const ROUTER_PATH = path.join(CORE_DIR, "dao_router.js");
const WIRE_PATH = path.join(CORE_DIR, "cascade_wire.js");

// ── 配置路径查找 ──
//   1. 用户级: ~/.codeium/dao-byok/配置.json (跨 VSIX install 持久)
//   2. 同目录: core/配置.json (VSIX 内自包含)
//   3. 环境变量: DAO_BYOK_CONFIG
function _resolveConfigPath() {
  if (
    process.env.DAO_BYOK_CONFIG &&
    fs.existsSync(process.env.DAO_BYOK_CONFIG)
  ) {
    return path.resolve(process.env.DAO_BYOK_CONFIG);
  }
  const bundledCfg = path.join(CORE_DIR, "配置.json");
  const bundledTpl = path.join(CORE_DIR, "_默认配置.json");
  const home = process.env.USERPROFILE || process.env.HOME || "";
  if (home) {
    const userDir = path.join(home, ".codeium", "dao-byok");
    const userCfg = path.join(userDir, "配置.json");
    if (fs.existsSync(userCfg)) return userCfg;
    // 用户级配置不存在 → 即刻于用户级播种并接管 · 跨 VSIX install 持久
    //   反者道之动: 凭据/渠道安于本机 ~/.codeium · 绝不入库 · 升级重装不失
    //   播种优先 bundled 配置.json (含预设渠道·迁移既有态), 退 _默认配置.json (无凭据模板)
    try {
      fs.mkdirSync(userDir, { recursive: true });
      const seed = fs.existsSync(bundledCfg)
        ? bundledCfg
        : fs.existsSync(bundledTpl)
          ? bundledTpl
          : null;
      if (seed) fs.copyFileSync(seed, userCfg);
      // 即便无模板亦返回用户路径 · dao_router.init 会内嵌兜底生成于此
      return userCfg;
    } catch (_e) {
      // 用户级创建失败 (权限等) → 退回 bundled 只读兜底
    }
  }
  if (fs.existsSync(bundledCfg)) return bundledCfg;
  return bundledCfg; // 默认 (dao_router init 会自动生成模板)
}

// ════════════════════════════════════════════════════════════════
// ExternalApiRuntime · extension.js 用
// ════════════════════════════════════════════════════════════════

class ExternalApiRuntime {
  constructor(opts = {}) {
    this._vscode = opts.vscodeModule || null;
    this._log = opts.logger || {
      info: console.log,
      warn: console.warn,
      error: console.error,
    };
    this._configKey = opts.configKey || "dao.外接api";
    this._vendorPrefix = opts.vendorPrefix || "dao-";
    this._router = null;
    this._wire = null;
    this._running = false;
    this._gatewayUrl = "";
    this._configPath = "";
  }

  async start() {
    if (this._running) return this.getStatus();

    // 加载 dao_router
    try {
      const Router = require(ROUTER_PATH);
      this._configPath = _resolveConfigPath();
      const result = Router.init({
        log: (msg) => {
          try {
            this._log.info("外接api", msg);
          } catch {}
        },
        configPath: this._configPath,
      });
      if (result.ready) {
        this._router = Router;
        this._gatewayUrl = result.gateway || "";
        this._running = true;
        this._log.info(
          "外接api",
          `路由就绪 · ${result.count}条 · gw=${this._gatewayUrl}`,
        );
      } else {
        this._log.warn(
          "外接api",
          `路由未就绪: ${result.error || result.reason || "unknown"}`,
        );
      }
    } catch (e) {
      this._log.warn("外接api", `dao_router load fail: ${e.message}`);
    }

    // 加载 cascade_wire
    try {
      this._wire = require(WIRE_PATH);
    } catch (e) {
      this._log.warn("外接api", `cascade_wire load fail: ${e.message}`);
      this._wire = null;
    }

    return this.getStatus();
  }

  async stop() {
    this._router = null;
    this._wire = null;
    this._running = false;
  }

  isRunning() {
    return this._running && this._router && this._router.isReady();
  }

  getStatus() {
    const routerStatus = this._router ? this._router.status() : null;
    return {
      gatewayUrl: this._gatewayUrl,
      providers: routerStatus ? routerStatus.providers : [],
      models: routerStatus ? routerStatus.count : 0,
      routerReady: routerStatus ? routerStatus.ready : false,
      routerCount: routerStatus ? routerStatus.count : 0,
      configPath: this._configPath,
      wire: !!this._wire,
    };
  }

  /** 对 source.js 暴露路由器 */
  getRouter() {
    return this._running ? this._router : null;
  }

  getWire() {
    return this._wire;
  }
}

// ════════════════════════════════════════════════════════════════
// 模块级单例 · source.js 直接 require 本文件即可用
// ════════════════════════════════════════════════════════════════

let _singleton = null;

/**
 * 获取/创建模块级单例
 * source.js 在模块顶层调一次: const ea = require("../外接api/runtime.js").ensure({log});
 * 之后在 _mainHandler 中用 ea.shouldRoute() / ea.route()
 */
function ensure(opts = {}) {
  if (!_singleton) {
    _singleton = new ExternalApiRuntime(opts);
    // 自动初始化 (不 await — source.js 模块顶层不能 await)
    // 但我们可以同步做 init (dao_router.init 是同步的)
    try {
      const Router = require(ROUTER_PATH);
      const configPath = _resolveConfigPath();
      const result = Router.init({
        log:
          opts.log ||
          ((msg) => {
            try {
              console.log(msg);
            } catch {}
          }),
        configPath,
      });
      if (result.ready) {
        _singleton._router = Router;
        _singleton._gatewayUrl = result.gateway || "";
        _singleton._running = true;
        _singleton._configPath = configPath;
      }
    } catch (e) {
      try {
        (opts.log || console.log)(`[外接api] ensure init fail: ${e.message}`);
      } catch {}
    }
    try {
      _singleton._wire = require(WIRE_PATH);
    } catch {}
  }
  return _singleton;
}

/**
 * 快速路由判断 (source.js 用)
 * @param {string} modelUid
 * @returns {boolean}
 */
function shouldRoute(modelUid) {
  const R = _getRouterModule();
  return R ? R.shouldRoute(modelUid) : false;
}

/**
 * 从 rawBody 提取 modelUid (source.js 用)
 * @param {Buffer} rawBody
 * @param {boolean} isJSON
 * @returns {string|null}
 */
function extractModelUid(rawBody, isJSON) {
  const R = _getRouterModule();
  return R ? R.extractModelUid(rawBody, isJSON) : null;
}

/**
 * 执行路由 (source.js 用)
 * @returns {Promise<boolean>} true=已路由并响应 / false=应走原路
 */
async function route(req, res, rawBody, isJSON, modelUid) {
  const R = _getRouterModule();
  return R ? R.route(req, res, rawBody, isJSON, modelUid) : false;
}

/** 路由器状态 (source.js /origin/ping 用) */
// ★ v9.9.92-fix · 用 _getRouterModule() 代替 _singleton._router
//   道义: 二十八章「知其白守其辱」· 热添加路由后 _ready=true · 但 _singleton._router=null
//   根因: ensure() 时 init 返回 ready=false → _singleton._router=null
//         hotAddRoute 修改模块级 _routes → _ready=true · 但 _singleton._router 未更新
//   修正: routerStatus 走 _getRouterModule() · 与 hotAddRoute 同源 · 名实相符
function routerStatus() {
  const R = _getRouterModule();
  return R ? R.status() : { ready: false, count: 0 };
}

/** v9.9.301 · 用量聚合 (按渠道/模型) · 供「外接API」面板查看 */
function routerUsage() {
  const R = _getRouterModule();
  return R && R.usage ? R.usage() : {};
}

/** substitute模式: 获取替代目标UID (source.js 用) */
function getSubstitution(modelUid) {
  const R = _getRouterModule();
  return R ? R.getSubstitution(modelUid) : null;
}

/** substitute模式: patch protobuf field 21 (source.js 用) */
function patchModelUid(rawBody, isJSON, oldUid, newUid) {
  const R = _getRouterModule();
  return R ? R.patchModelUid(rawBody, isJSON, oldUid, newUid) : null;
}

// ════════════════════════════════════════════════════════════════
// ★ v9.9.90 · 热配置 API 透传 · 道法自然 · 无为而无不为
//   五十七章「我无为也 而民自化」· 热操作 · 不重启 · 即时生效
//   供 source.js /origin/ea/* 控制面 + extension.js webview 使用
//   ★ v9.9.90-fix · router 未运行时也能读写配置 · 名实相符
// ════════════════════════════════════════════════════════════════

// ★ 惰性获取 router 模块 · 即使 _singleton._router 为 null (外接api disabled)
//   也能直接 require dao_router.js 并 init · 让 webview 始终可读写配置
function _getRouterModule() {
  // 1. 优先用运行中的 router (热更新直接生效)
  if (_singleton && _singleton._router) return _singleton._router;
  // 2. 惰性 require + init (外接api disabled 时也能操作配置)
  try {
    const Router = require(ROUTER_PATH);
    if (Router.isReady()) return Router; // 已 init 过 (可能是上次 ensure 时)
    // 未 init → 用默认配置路径 init
    const configPath = _singleton
      ? _singleton._configPath
      : _resolveConfigPath();
    if (configPath) Router.init({ log: () => {}, configPath });
    return Router;
  } catch {
    return null;
  }
}

function hotAddProvider(name, cfg) {
  const R = _getRouterModule();
  return R
    ? R.hotAddProvider(name, cfg)
    : { ok: false, error: "router module not loadable" };
}

function hotRemoveProvider(name) {
  const R = _getRouterModule();
  return R
    ? R.hotRemoveProvider(name)
    : { ok: false, error: "router module not loadable" };
}

function hotAddRoute(modelUid, routeCfg) {
  const R = _getRouterModule();
  return R
    ? R.hotAddRoute(modelUid, routeCfg)
    : { ok: false, error: "router module not loadable" };
}

function hotRemoveRoute(modelUid) {
  const R = _getRouterModule();
  return R
    ? R.hotRemoveRoute(modelUid)
    : { ok: false, error: "router module not loadable" };
}

// ★ v9.9.97 · 热切换兼容别名
function hotDeleteRoute(modelUid) {
  const R = _getRouterModule();
  return R
    ? R.hotDeleteRoute(modelUid)
    : { ok: false, error: "router module not loadable" };
}

// ★ v9.9.97 · 解锁保护模型
function unlockModel(modelUid, unlock) {
  const R = _getRouterModule();
  return R
    ? R.unlockModel(modelUid, unlock)
    : { ok: false, error: "router module not loadable" };
}

// ★ v9.9.97 · 检查模型是否被保护
function isModelProtected(modelUid) {
  const R = _getRouterModule();
  return R ? R.isModelProtected(modelUid) : false;
}

function hotGetConfig() {
  const R = _getRouterModule();
  return R
    ? R.hotGetConfig()
    : { ok: false, error: "router module not loadable" };
}

function hotSetConfig(newCfg) {
  const R = _getRouterModule();
  return R
    ? R.hotSetConfig(newCfg)
    : { ok: false, error: "router module not loadable" };
}

function hotReload() {
  const R = _getRouterModule();
  return R ? R.hotReload() : { ok: false, error: "router module not loadable" };
}

async function hotListProviderModels(providerName, opts) {
  const R = _getRouterModule();
  return R
    ? R.hotListProviderModels(providerName, opts)
    : { ok: false, error: "router module not loadable" };
}

// ★ v9.9.90-fix · 命名对齐: dao_router.js 导出 resetHealthCache / probeAllProviders
function hotResetHealthCache() {
  const R = _getRouterModule();
  if (R) R.resetHealthCache();
}

async function hotProbeAllProviders() {
  const R = _getRouterModule();
  return R ? R.probeAllProviders() : {};
}

// ★ v9.9.285 · 最近一次探活快照 (非阻塞) · 供 overview 即时展示渠道连通+原因
function hotHealthSnapshot() {
  const R = _getRouterModule();
  return R && R.healthSnapshot ? R.healthSnapshot() : {};
}

// ★ v9.9.285 · 渠道响应分类器透传 · 供 test-chat 实证渠道伪成功/拒绝
function classifyChannelResponse(status, text) {
  const R = _getRouterModule();
  return R && R.classifyChannelResponse
    ? R.classifyChannelResponse(status, text)
    : { ok: true, reason: "" };
}

// ★ v9.9.92-fix · 获取 wire 模块 · 供 source.js 构建 Connect-RPC 错误帧
//   道义: 三十九章「得一以宁」· 得 wire 方能构建正确帧格式
function getWire() {
  if (_singleton && _singleton._wire) return _singleton._wire;
  try {
    return require(WIRE_PATH);
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// ★ v9.9.99 · AI 热配置接口 · Go 移植模块透传
//   道义: 太上 下知有之 · 底层全开放 · AI可辅助用户配置一切
// ════════════════════════════════════════════════════════════════

function hotSetBudgetParam(key, value) {
  const R = _getRouterModule();
  return R
    ? R.hotSetBudgetParam(key, value)
    : { ok: false, error: "router not loaded" };
}

function hotGetBudgetStatus() {
  const R = _getRouterModule();
  return R ? R.hotGetBudgetStatus() : null;
}

function hotCountTokens(text, encoder) {
  const R = _getRouterModule();
  return R
    ? R.hotCountTokens(text, encoder)
    : { tokens: -1, encoder: "unavailable" };
}

function hotDetectProtocol(providerName) {
  const R = _getRouterModule();
  return R
    ? R.hotDetectProtocol(providerName)
    : { protocol: "openai-chat", supported: ["openai-chat"] };
}

function hotGetModelContextLength(model) {
  const R = _getRouterModule();
  return R ? R.hotGetModelContextLength(model) : { contextLength: 128000 };
}

function hotSetResilienceParam(key, value) {
  const R = _getRouterModule();
  return R
    ? R.hotSetResilienceParam(key, value)
    : { ok: false, error: "router not loaded" };
}

function hotDetectRefusal(text) {
  const R = _getRouterModule();
  return R ? R.hotDetectRefusal(text) : { isRefusal: false };
}

function hotCompactSchema(schema, stripDoc) {
  const R = _getRouterModule();
  return R ? R.hotCompactSchema(schema, stripDoc) : schema;
}

module.exports = {
  ExternalApiRuntime,
  ensure,
  shouldRoute,
  extractModelUid,
  route,
  routerStatus,
  routerUsage,
  getSubstitution,
  patchModelUid,
  // ★ 热配置 API
  hotAddProvider,
  hotRemoveProvider,
  hotAddRoute,
  hotRemoveRoute,
  hotDeleteRoute,
  hotGetConfig,
  hotSetConfig,
  hotReload,
  hotListProviderModels,
  hotResetHealthCache,
  hotProbeAllProviders,
  hotHealthSnapshot,
  classifyChannelResponse,
  // ★ v9.9.97 · 保护模型 API
  unlockModel,
  isModelProtected,
  getWire,
  // ★ v9.9.99 · AI 热配置接口 · Go 移植模块
  hotSetBudgetParam,
  hotGetBudgetStatus,
  hotCountTokens,
  hotDetectProtocol,
  hotGetModelContextLength,
  hotSetResilienceParam,
  hotDetectRefusal,
  hotCompactSchema,
};
