// runtime.js · 外接 api 运行时 · dao-proxy-min v9.9.0 · 印 124 · 第一细药
//
// 帛书《老子》:
//   六十三章 · 图难于其易也, 为大于其细也. 天下之难作于易, 天下之大作于细.
//   是以圣人终不为大, 故能成其大.
//   六十四章 · 为之于其未有也, 治之于其未乱也.
//   四十八章 · 损之又损, 以至于无为, 无为而无不为.
//
// 职:
//   ① 启停 gateway 子进程 (spawn vendor/外接api/gateway/server.js)
//   ② 等 gateway /health 200 后召 lm_register
//   ③ 停时先解 lm 注册 · 再 kill gateway 进程
//   ④ 默关 · 主公一字开 (dao.外接api.enabled=true 才启)
//
// 与 min 主反代 (vendor/bundled-origin/source.js) 字节级正交:
//   反代核走 codeium.apiServerUrl :8889..8988 (per-user FNV-1a) · 处理 Cascade Connect-RPC
//   外接 api gateway 走独立端口 :11635..11734 (per-user FNV-1a) · 处理 OpenAI/Anthropic chat
//   vscode.lm 注册让 14 provider 之模型现身 Cascade 选单 (与 4 BYOK 一视同仁)
//
// 道义: 一身两轨, 反代守 SP 注入之心, 外接展 N 模选用之能. 二轨不撞.

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const cp = require("node:child_process");
const os = require("node:os");

const lmRegister = require("./lm_register");

const GATEWAY_PORT_BASE = 11635;
const GATEWAY_PORT_RANGE = 100;

// FNV-1a 32-bit · 与 extension.js 内 fnv1aPort 同算
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function hashGatewayPort() {
  const user = (os.userInfo().username || "anon") + ":gateway";
  return GATEWAY_PORT_BASE + (fnv1a(user) % GATEWAY_PORT_RANGE);
}

function resolveConfigPath() {
  // 用户级 (跨 vsix install 持久 · 与 max gateway resolveConfigPath 同顺)
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const candidates = [
    process.env.DAO_BYOK_CONFIG,
    path.join(home, ".codeium", "dao-byok", "配置.json"),
    path.join(home, ".codeium", "dao-byok", "config.json"),
    path.resolve(__dirname, "配置.json"),
    path.resolve(__dirname, "配置.example.json"),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return path.resolve(__dirname, "配置.example.json"); // 兜底
}

function ensureUserConfigSeeded() {
  // 首启时若 ~/.codeium/dao-byok/配置.json 不存, 复 配置.example.json 至此 (主公可改不可丢)
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const userDir = path.join(home, ".codeium", "dao-byok");
  const userCfg = path.join(userDir, "配置.json");
  if (fs.existsSync(userCfg)) return userCfg;
  const example = path.resolve(__dirname, "配置.example.json");
  if (!fs.existsSync(example)) return null;
  try {
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    fs.copyFileSync(example, userCfg);
    return userCfg;
  } catch {
    return null;
  }
}

function httpJSON(method, url, timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 3000;
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(e);
    }
    const req = http.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || 80,
        path: u.pathname + u.search,
        timeout: timeoutMs,
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => {
          buf += c;
        });
        res.on("end", () => {
          let data = null;
          try {
            data = JSON.parse(buf);
          } catch {}
          resolve({ status: res.statusCode, data, raw: buf });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.end();
  });
}

async function waitForHealth(url, timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 15000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await httpJSON("GET", url + "/health", 1500);
      if (r.status === 200) return r.data || true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("gateway /health 不应 (timeout " + timeoutMs + "ms)");
}

// ═══════════════════════════════════════════════════════════════════
// ExternalApiRuntime
// ═══════════════════════════════════════════════════════════════════

class ExternalApiRuntime {
  /**
   * @param {object} opts
   *   - vscodeModule:   require("vscode") (由 extension.js 传, 避此件直 require 而失 host 隔离)
   *   - logger:         {info, warn, error} (复用 min 之 L)
   *   - configKey:      vscode.workspace.getConfiguration namespace, 默 "dao.外接api"
   *   - vendorPrefix:   lm 注 vendor 名前缀, 默 "dao-"
   */
  constructor(opts) {
    this.vscode = opts.vscodeModule;
    this.log = opts.logger || console;
    this.configKey = opts.configKey || "dao.外接api";
    this.vendorPrefix = opts.vendorPrefix || "dao-";

    this.gatewayProc = null;
    this.gatewayUrl = null;
    this.lmRegistrations = [];
    this.lmRegisteredProviders = [];
    this._running = false;
  }

  isRunning() {
    return this._running;
  }

  getGatewayUrl() {
    return this.gatewayUrl;
  }

  getStatus() {
    const total = this.lmRegisteredProviders.reduce(
      (n, x) => n + (x.models ? x.models.length : 0),
      0,
    );
    return {
      running: this._running,
      gatewayUrl: this.gatewayUrl,
      gatewayPid: this.gatewayProc ? this.gatewayProc.pid : null,
      providers: this.lmRegisteredProviders.length,
      models: total,
      registered: this.lmRegisteredProviders.map((p) => ({
        vendor: p.vendor,
        provider: p.provider,
        modelCount: p.models ? p.models.length : 0,
      })),
    };
  }

  async start() {
    if (this._running) {
      this.log.info("外接api", "已运行 · 跳启");
      return this.getStatus();
    }
    // ① 配置预启 (用户级)
    const userCfg = ensureUserConfigSeeded();
    if (userCfg) this.log.info("外接api", "配置: " + userCfg);

    // ② 起 gateway 子进程
    const cfgPath = resolveConfigPath();
    const port = hashGatewayPort();
    const script = path.resolve(__dirname, "gateway", "server.js");
    if (!fs.existsSync(script)) {
      throw new Error("vendor/外接api/gateway/server.js 未找到 (vsix 损?)");
    }
    this.log.info(
      "外接api",
      "启 gateway · script=" + script + " · port=" + port + " · config=" + cfgPath,
    );
    this.gatewayProc = cp.spawn(
      process.execPath,
      [script, "--port", String(port), "--config", cfgPath, "--log-level", "info"],
      {
        detached: false, // 跟主进程死活同
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: Object.assign({}, process.env, { DAO_BYOK_CONFIG: cfgPath }),
        cwd: path.dirname(script),
      },
    );
    this.gatewayProc.stdout.on("data", (d) => {
      const t = d.toString().trimEnd();
      if (t)
        this.log.info(
          "外接api-gw",
          t.split("\n").slice(0, 2).join(" / ").slice(0, 220),
        );
    });
    this.gatewayProc.stderr.on("data", (d) => {
      const t = d.toString().trimEnd();
      if (t)
        this.log.warn(
          "外接api-gw",
          t.split("\n").slice(0, 2).join(" / ").slice(0, 220),
        );
    });
    this.gatewayProc.on("exit", (code) => {
      this.log.warn("外接api-gw", "退出 code=" + code);
      this.gatewayProc = null;
      this._running = false;
    });

    this.gatewayUrl = "http://127.0.0.1:" + port;

    // ③ 等 health ok
    try {
      const health = await waitForHealth(this.gatewayUrl, 12000);
      this.log.info(
        "外接api",
        "gateway 活 · providers=" +
          (health && health.providers ? health.providers.length : "?") +
          " · models=" +
          (health && health.modelCount) +
          " · " +
          this.gatewayUrl,
      );
    } catch (e) {
      this.log.error("外接api", "gateway 起失: " + e.message);
      await this.stop();
      throw e;
    }

    // ④ vscode.lm 注 14 provider 之 N 模
    try {
      const result = await lmRegister.registerProviders({
        vscodeModule: this.vscode,
        gatewayUrl: this.gatewayUrl,
        vendorPrefix: this.vendorPrefix,
        version: "9.9.0",
        logger: this.log,
      });
      this.lmRegistrations = result.registrations;
      this.lmRegisteredProviders = result.providers;
      this.log.info(
        "外接api",
        "✓ vscode.lm 目录就绪: " +
          result.providers.length +
          " providers · " +
          result.providers.reduce(
            (n, x) => n + (x.models ? x.models.length : 0),
            0,
          ) +
          " 模",
      );
    } catch (e) {
      this.log.error("外接api", "lm 注 失: " + e.message);
      // 注失不停 gateway (gateway 仍可 HTTP 直用)
    }

    this._running = true;
    return this.getStatus();
  }

  async stop() {
    // ① 解 lm 注
    for (const r of this.lmRegistrations) {
      try {
        r.dispose();
      } catch {}
    }
    this.lmRegistrations = [];
    this.lmRegisteredProviders = [];

    // ② kill gateway
    if (this.gatewayProc) {
      try {
        this.gatewayProc.kill();
      } catch {}
      this.gatewayProc = null;
    }
    this.gatewayUrl = null;
    this._running = false;
    this.log.info("外接api", "已停");
  }

  async toggle() {
    if (this._running) {
      await this.stop();
      return false;
    } else {
      await this.start();
      return true;
    }
  }
}

module.exports = {
  ExternalApiRuntime,
  resolveConfigPath,
  hashGatewayPort,
};
