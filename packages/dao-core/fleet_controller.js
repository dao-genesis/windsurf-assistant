/**
 * fleet_controller.js — 印 62 · 一账号一虚拟机一反代 · 并行底层直连
 * ════════════════════════════════════════════════════════════════════════
 *
 *   帛书·四十二章: 「道生一，一生二，二生三，三生万物。」
 *   帛书·四十三章: 「天下之至柔，驰骋于天下之致坚；无有入于无间。」
 *
 *   架构:
 *     Account-1 ←→ VM-1 ←→ Proxy-1 (FP-1, IP-1) → Windsurf API
 *     Account-2 ←→ VM-2 ←→ Proxy-2 (FP-2, IP-2) → Windsurf API
 *     ...
 *     Account-N ←→ VM-N ←→ Proxy-N (FP-N, IP-N) → Windsurf API
 *
 *     Local Fleet Gateway [:7870]
 *       └── /v1/chat/completions → pick best unit → proxy to unit
 *
 *   状态: ~/.dao/fleet.json
 *   零外部依赖 · 仅 Node.js 内置 (fs, path, os, http, https, crypto)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const https = require("https");
const crypto = require("crypto");

// ════════════════════════════════════════════════════════════════
// §1  常量与路径
// ════════════════════════════════════════════════════════════════

const DAO_DIR = path.join(os.homedir(), ".dao");
const FLEET_FILE =
  process.env.DAO_FLEET_FILE || path.join(DAO_DIR, "fleet.json");

const DEFAULT_STATE = {
  version: 1,
  units: [],
  gateway: {
    enabled: false,
    mode: "best-quota", // round-robin | least-load | best-quota | random
    healthIntervalMs: 30000,
    deadAfterMs: 120000,
    fallbackLocal: true, // 全军覆没时回落本地 kernel
  },
  // 印 62 · fleet secret · VM 注册须携此 secret 防野接入
  secret: null,
  createdAt: null,
  lastModified: null,
};

// ════════════════════════════════════════════════════════════════
// §2  状态 IO
// ════════════════════════════════════════════════════════════════

function ensureDir() {
  try {
    fs.mkdirSync(DAO_DIR, { recursive: true });
  } catch {}
}

function load() {
  try {
    if (!fs.existsSync(FLEET_FILE)) return { ...DEFAULT_STATE, units: [] };
    const j = JSON.parse(fs.readFileSync(FLEET_FILE, "utf8"));
    if (!j || typeof j !== "object") return { ...DEFAULT_STATE, units: [] };
    return {
      version: j.version || 1,
      units: Array.isArray(j.units) ? j.units : [],
      gateway: { ...DEFAULT_STATE.gateway, ...(j.gateway || {}) },
      secret: j.secret || null,
      createdAt: j.createdAt || null,
      lastModified: j.lastModified || null,
    };
  } catch {
    return { ...DEFAULT_STATE, units: [] };
  }
}

function save(state) {
  ensureDir();
  state.lastModified = new Date().toISOString();
  const tmp = FLEET_FILE + ".tmp." + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  try {
    if (fs.existsSync(FLEET_FILE)) fs.unlinkSync(FLEET_FILE);
  } catch {}
  fs.renameSync(tmp, FLEET_FILE);
  try {
    fs.chmodSync(FLEET_FILE, 0o600);
  } catch {}
}

// ════════════════════════════════════════════════════════════════
// §3  Fleet Secret · 防野接入
// ════════════════════════════════════════════════════════════════

/** 初始化或返回 fleet secret (lazy) */
function ensureSecret() {
  const state = load();
  if (state.secret) return state.secret;
  state.secret = "fleet-" + crypto.randomBytes(24).toString("base64url");
  state.createdAt = new Date().toISOString();
  save(state);
  return state.secret;
}

function verifySecret(provided) {
  const state = load();
  if (!state.secret) return false;
  return provided === state.secret;
}

// ════════════════════════════════════════════════════════════════
// §4  Unit 管理 (注册/心跳/摘除)
// ════════════════════════════════════════════════════════════════

/**
 * 注册一个 VM unit
 * @param {Object} info
 * @param {string} info.tunnelUrl - 穿透 URL (https://xxx.trycloudflare.com)
 * @param {string} info.account   - 绑定的账号 email
 * @param {string} [info.region]  - VM 区域 (自报)
 * @param {string} [info.vmIp]    - VM 出口 IP (自报)
 * @returns {Object} 注册后的 unit
 */
function registerUnit(info) {
  if (!info || !info.tunnelUrl || !info.account) {
    throw new Error("tunnelUrl + account 必需");
  }
  const state = load();
  // 去重: 同 account 不重复注册 (覆写)
  const existing = state.units.findIndex((u) => u.account === info.account);
  const id =
    existing >= 0
      ? state.units[existing].id
      : "unit-" + crypto.randomBytes(8).toString("hex");
  const unit = {
    id,
    account: info.account,
    tunnelUrl: info.tunnelUrl.replace(/\/+$/, ""), // 去尾 /
    status: "active",
    registeredAt: new Date().toISOString(),
    lastHealthAt: new Date().toISOString(),
    lastHealthOk: true,
    dPercent: -1, // 未知
    wPercent: -1,
    requestCount: 0,
    errorCount: 0,
    rateLimitedAt: null,
    metadata: {
      vmIp: info.vmIp || null,
      region: info.region || null,
      fingerprint: info.fingerprint || null,
    },
  };
  if (existing >= 0) {
    state.units[existing] = unit;
  } else {
    state.units.push(unit);
  }
  save(state);
  return unit;
}

/**
 * 心跳更新
 * @param {string} unitId
 * @param {Object} health
 * @param {number} [health.dPercent]
 * @param {number} [health.wPercent]
 * @param {boolean} [health.kernelOk]
 */
function heartbeat(unitId, health) {
  const state = load();
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return null;
  unit.lastHealthAt = new Date().toISOString();
  unit.lastHealthOk = true;
  unit.status = "active";
  if (health) {
    if (typeof health.dPercent === "number") unit.dPercent = health.dPercent;
    if (typeof health.wPercent === "number") unit.wPercent = health.wPercent;
  }
  // 从 rate-limited 恢复
  if (unit.rateLimitedAt) {
    const elapsed = Date.now() - new Date(unit.rateLimitedAt).getTime();
    if (elapsed > 65 * 60 * 1000) {
      // 65 分钟冷却
      unit.rateLimitedAt = null;
      unit.status = "active";
    }
  }
  save(state);
  return unit;
}

/** 标记某 unit 被限流 */
function markRateLimited(unitId) {
  const state = load();
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return;
  unit.rateLimitedAt = new Date().toISOString();
  unit.status = "rate-limited";
  save(state);
}

/** 移除 unit */
function removeUnit(unitId) {
  const state = load();
  const idx = state.units.findIndex((u) => u.id === unitId);
  if (idx < 0) return false;
  state.units.splice(idx, 1);
  save(state);
  return true;
}

/** 清理死 unit (超时未心跳) */
function reapDead() {
  const state = load();
  const now = Date.now();
  const deadMs = state.gateway.deadAfterMs || 120000;
  let reaped = 0;
  for (const unit of state.units) {
    if (unit.status === "dead") continue;
    const lastMs = unit.lastHealthAt
      ? new Date(unit.lastHealthAt).getTime()
      : 0;
    if (now - lastMs > deadMs) {
      unit.status = "dead";
      unit.lastHealthOk = false;
      reaped++;
    }
  }
  if (reaped > 0) save(state);
  return reaped;
}

// ════════════════════════════════════════════════════════════════
// §5  网关路由 · 选最佳 unit
// ════════════════════════════════════════════════════════════════

/** 获取所有可用 unit (active, 非 rate-limited, 非 dead) */
function getAvailableUnits() {
  const state = load();
  return state.units.filter(
    (u) => u.status === "active" && !u.rateLimitedAt && u.lastHealthOk,
  );
}

/** 选最佳 unit · 按 gateway.mode */
function pickUnit() {
  const state = load();
  const avail = state.units.filter(
    (u) => u.status === "active" && !u.rateLimitedAt && u.lastHealthOk,
  );
  if (avail.length === 0) return null;
  if (avail.length === 1) return avail[0];

  const mode = state.gateway.mode || "best-quota";

  if (mode === "round-robin") {
    // 按 requestCount 最少优先 (近似 round-robin)
    avail.sort((a, b) => (a.requestCount || 0) - (b.requestCount || 0));
    return avail[0];
  }

  if (mode === "least-load") {
    // 按 errorCount 最少 + requestCount 最少
    avail.sort(
      (a, b) =>
        (a.errorCount || 0) - (b.errorCount || 0) ||
        (a.requestCount || 0) - (b.requestCount || 0),
    );
    return avail[0];
  }

  if (mode === "best-quota") {
    // 按 D%+W% 最高优先 (配额最充裕)
    avail.sort((a, b) => {
      const sa =
        (a.dPercent >= 0 ? a.dPercent : 100) +
        (a.wPercent >= 0 ? a.wPercent : 100);
      const sb =
        (b.dPercent >= 0 ? b.dPercent : 100) +
        (b.wPercent >= 0 ? b.wPercent : 100);
      return sb - sa;
    });
    return avail[0];
  }

  if (mode === "random") {
    return avail[Math.floor(Math.random() * avail.length)];
  }

  // 默认 round-robin
  avail.sort((a, b) => (a.requestCount || 0) - (b.requestCount || 0));
  return avail[0];
}

/**
 * 记录一次请求到 unit
 * @param {string} unitId
 * @param {boolean} [isError]
 */
function recordRequest(unitId, isError) {
  const state = load();
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return;
  unit.requestCount = (unit.requestCount || 0) + 1;
  if (isError) unit.errorCount = (unit.errorCount || 0) + 1;
  save(state);
}

// ════════════════════════════════════════════════════════════════
// §6  网关代理 · 转发至 unit tunnel · 重试/故障转移
//   帛书·七十七: 「天下之道，损有余而益不足。」
//   帛书·七十八: 「天下莫柔弱于水，而攻坚强者莫之能胜也。」
//   失败时流水般转移到下一 unit · 最多 MAX_RETRY 个 · 柔弱胜刚强
// ════════════════════════════════════════════════════════════════

const MAX_RETRY = 3;

/**
 * 代理请求至 fleet unit (含重试/故障转移)
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} targetPath - 转发路径 (如 /v1/chat/completions)
 * @returns {boolean} 是否接管 (false = 无可用 unit / 未启用, 调者应 fallback)
 */
function gatewayProxy(req, res, targetPath) {
  const state = load();
  if (!state.gateway.enabled) return false;

  reapDead(); // 先清理死 unit

  const avail = getAvailableUnits();
  if (!avail.length) return false;

  // 收集完整 body (用于重试时重发)
  const bodyChunks = [];
  let bodyDone = false;
  let bodyBuf = null;

  req.on("data", (c) => bodyChunks.push(c));
  req.on("end", () => {
    bodyDone = true;
    bodyBuf = Buffer.concat(bodyChunks);
    attemptProxy(0, new Set());
  });
  req.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "client request error" } }));
    }
  });

  function attemptProxy(attempt, triedIds) {
    // 选 unit (排除已试)
    const unit = pickUnitExcluding(triedIds);
    if (!unit) {
      // 全部试过仍无 · fallback 本地 kernel
      if (!res.headersSent) {
        // 不返错 · 让 admin_server fallback
        // 但此处 req body 已消费 · 需要重建 req 以 pipe
        // 最佳方案: 返 false 让调者知道 · 但 body 已消费
        // 妥协: 返 502 with fleet_exhausted
        res.writeHead(502, {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "x-dao-fleet-exhausted": "true",
        });
        res.end(
          JSON.stringify({
            error: {
              message: `fleet 所有 unit (${triedIds.size} 个) 均不可达 · 请检查 VM 状态`,
              type: "fleet_exhausted",
              tried: Array.from(triedIds),
            },
          }),
        );
      }
      return;
    }

    triedIds.add(unit.id);

    // 构建 target URL
    const targetUrl = new URL(targetPath || req.url, unit.tunnelUrl);
    const isHttps = targetUrl.protocol === "https:";
    const transport = isHttps ? https : http;

    const headers = { ...req.headers };
    delete headers.host;
    headers["content-length"] = bodyBuf.length;
    headers["x-dao-fleet-unit"] = unit.id;
    headers["x-dao-fleet-account"] = unit.account;

    const opts = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers,
      servername: targetUrl.hostname,
    };

    const proxyReq = transport.request(opts, (proxyRes) => {
      const statusCode = proxyRes.statusCode || 502;

      // 429/403 限流 → 标记 + 故障转移
      if ((statusCode === 429 || statusCode === 403) && attempt < MAX_RETRY) {
        markRateLimited(unit.id);
        recordRequest(unit.id, true);
        proxyRes.resume(); // drain
        attemptProxy(attempt + 1, triedIds);
        return;
      }

      // 502/503/504 → 故障转移
      if (
        (statusCode === 502 || statusCode === 503 || statusCode === 504) &&
        attempt < MAX_RETRY
      ) {
        recordRequest(unit.id, true);
        proxyRes.resume();
        attemptProxy(attempt + 1, triedIds);
        return;
      }

      recordRequest(unit.id, statusCode >= 400);

      const respHeaders = { ...proxyRes.headers };
      respHeaders["access-control-allow-origin"] = "*";
      respHeaders["x-dao-fleet-unit"] = unit.id;
      respHeaders["x-dao-fleet-mode"] = state.gateway.mode;
      respHeaders["x-dao-fleet-attempt"] = String(attempt + 1);

      res.writeHead(statusCode, respHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (e) => {
      recordRequest(unit.id, true);
      // 连接失败 → 故障转移
      if (attempt < MAX_RETRY && !res.headersSent) {
        attemptProxy(attempt + 1, triedIds);
        return;
      }
      if (!res.headersSent) {
        res.writeHead(502, {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        });
        res.end(
          JSON.stringify({
            error: {
              message: `fleet unit ${unit.id} 不可达: ${e.message}`,
              type: "fleet_unit_unreachable",
              unit: unit.id,
              tried: Array.from(triedIds),
              attempt: attempt + 1,
            },
          }),
        );
      } else {
        try {
          res.end();
        } catch {}
      }
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy(new Error("fleet proxy timeout"));
    });

    proxyReq.setTimeout(30000);
    proxyReq.write(bodyBuf);
    proxyReq.end();
  }

  return true; // 已接管 (异步处理中)
}

/**
 * 选 unit (排除指定 id 集合)
 * @param {Set<string>} excludeIds
 * @returns {Object|null}
 */
function pickUnitExcluding(excludeIds) {
  const state = load();
  const avail = state.units.filter(
    (u) => u.status === "active" && !excludeIds.has(u.id),
  );
  if (!avail.length) return null;

  const mode = state.gateway.mode;

  if (mode === "best-quota") {
    avail.sort((a, b) => {
      const sa =
        (a.dPercent >= 0 ? a.dPercent : 100) +
        (a.wPercent >= 0 ? a.wPercent : 100);
      const sb =
        (b.dPercent >= 0 ? b.dPercent : 100) +
        (b.wPercent >= 0 ? b.wPercent : 100);
      return sb - sa;
    });
    return avail[0];
  }
  if (mode === "least-load") {
    avail.sort((a, b) => {
      const la = (a.errorCount || 0) + (a.requestCount || 0);
      const lb = (b.errorCount || 0) + (b.requestCount || 0);
      return la - lb;
    });
    return avail[0];
  }
  if (mode === "random") {
    return avail[Math.floor(Math.random() * avail.length)];
  }
  // round-robin
  avail.sort((a, b) => (a.requestCount || 0) - (b.requestCount || 0));
  return avail[0];
}

// ════════════════════════════════════════════════════════════════
// §7  配置生成 · 为 N 个 VM 生成独立部署配置
// ════════════════════════════════════════════════════════════════

/**
 * 为指定账号列表生成 VM 部署配置
 * @param {string[]} emails - 要部署的账号 email 列表
 * @param {Object} opts
 * @param {string} opts.repoUrl      - git 仓库 URL
 * @param {string} opts.controllerUrl - fleet controller 的可达 URL
 * @returns {Object[]} 每个 email 一个部署配置
 */
function generateSpawnConfigs(emails, opts) {
  const state = load();
  const secret = ensureSecret();
  let daoAccounts;
  try {
    daoAccounts = require("./dao_accounts");
  } catch {
    return { error: "dao_accounts 不可加载" };
  }

  const allAccounts = daoAccounts.listAccounts();
  const configs = [];

  for (const email of emails) {
    const acct = allAccounts.find((a) => a.email === email);
    if (!acct) continue;

    const unitId =
      "unit-" +
      crypto.createHash("sha256").update(email).digest("hex").slice(0, 16);

    configs.push({
      unitId,
      email,
      apiKey: acct.apiKey,
      type: acct.type,
      apiServerUrl:
        acct.apiServerUrl || "https://server.self-serve.windsurf.com",
      // VM 需要这些环境变量
      env: {
        DAO_FLEET_UNIT_ID: unitId,
        DAO_FLEET_SECRET: secret,
        DAO_FLEET_CONTROLLER: opts.controllerUrl || "",
        DAO_FLEET_ACCOUNT: email,
        DAO_FLEET_API_KEY: acct.apiKey,
        DAO_FLEET_API_SERVER:
          acct.apiServerUrl || "https://server.self-serve.windsurf.com",
      },
      // 生成单账号 accounts.json (VM 上用)
      accountsJson: JSON.stringify(
        {
          version: 2,
          accounts: [
            {
              email: acct.email,
              apiKey: acct.apiKey,
              type: acct.type,
              added: new Date().toISOString(),
              lastUsed: null,
              useCount: 0,
              apiServerUrl:
                acct.apiServerUrl || "https://server.self-serve.windsurf.com",
              refreshToken: null,
              frozen: false,
            },
          ],
          active: acct.email,
          rotateMode: "manual",
          lastRotateAt: 0,
          rotateCount: 0,
        },
        null,
        2,
      ),
      // 生成部署脚本 (Devin 任务可直接执行)
      deployScript: generateDeployScript(unitId, email, secret, opts),
      // Devin 任务 Prompt
      devinPrompt: generateDevinPrompt(unitId, email, opts),
    });
  }

  return { configs, secret, total: configs.length };
}

/** 生成单 VM 部署脚本 */
function generateDeployScript(unitId, email, secret, opts) {
  const repoUrl =
    opts.repoUrl || "https://github.com/<your-repo>/dao-standalone.git";
  const controllerUrl = opts.controllerUrl || "https://<your-fleet-controller>";

  return `#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 道 Fleet Unit · ${unitId} · ${email}
# 一账号一虚拟机一反代 · 帛书·四十二 「道生一 一生二 二生三 三生万物」
# ═══════════════════════════════════════════════════════════
set -e

UNIT_ID="${unitId}"
FLEET_SECRET="${secret}"
CONTROLLER="${controllerUrl}"
ACCOUNT="${email}"

echo "═══ 道 Fleet Unit $UNIT_ID · 部署开始 ═══"

# 1. 克隆代码
if [ ! -d ~/dao-standalone ]; then
  git clone ${repoUrl} ~/dao-standalone 2>/dev/null || true
fi
cd ~/dao-standalone

# 2. 单账号配置注入
mkdir -p ~/.dao
cat > ~/.dao/accounts.json << 'ACCOUNTS_EOF'
${opts._accountsJson || "{}"}
ACCOUNTS_EOF

# 3. 生成 dao-sk key
mkdir -p ~/.dao
cat > ~/.dao/keys.json << 'KEYS_EOF'
{"keys":[{"key":"dao-sk-fleet-${unitId}","name":"fleet-unit","created":"${new Date().toISOString()}","revokedAt":null,"lastUsed":null}]}
KEYS_EOF

# 4. 启动 kernel
echo "  · 启动 kernel :7861 ..."
nohup node _kernel/道直连器.js > /tmp/kernel.log 2>&1 &
KERNEL_PID=$!
sleep 2

# 5. 启动 admin (public 模式)
echo "  · 启动 admin :7870 ..."
nohup node _kernel/admin_server.js --public --port 7870 > /tmp/admin.log 2>&1 &
ADMIN_PID=$!
sleep 1

# 6. cloudflared 穿透
echo "  · 启动 cloudflared tunnel :7870 ..."
npx --yes cloudflared tunnel --url http://localhost:7870 > /tmp/tunnel.log 2>&1 &
TUNNEL_PID=$!
sleep 8

# 提取穿透 URL
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\\.trycloudflare\\.com' /tmp/tunnel.log | head -1)

if [ -z "$TUNNEL_URL" ]; then
  echo "  ✗ 穿透 URL 未获取 · 查 /tmp/tunnel.log"
  cat /tmp/tunnel.log | tail -20
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  道 Fleet Unit 已起"
echo "  Unit ID  : $UNIT_ID"
echo "  Account  : $ACCOUNT"
echo "  Tunnel   : $TUNNEL_URL"
echo "  Kernel   : PID $KERNEL_PID"
echo "  Admin    : PID $ADMIN_PID"
echo "═══════════════════════════════════════════"
echo ""

# 7. 注册到 fleet controller
if [ -n "$CONTROLLER" ] && [ "$CONTROLLER" != "https://<your-fleet-controller>" ]; then
  echo "  · 注册到 fleet controller: $CONTROLLER ..."
  curl -s -X POST "$CONTROLLER/fleet/register" \\
    -H "Content-Type: application/json" \\
    -d "{\\"tunnelUrl\\":\\"$TUNNEL_URL\\",\\"account\\":\\"$ACCOUNT\\",\\"secret\\":\\"$FLEET_SECRET\\",\\"vmIp\\":\\"$(curl -s ifconfig.me)\\"}" || true
  echo ""
fi

# 8. 心跳循环 (每 30 秒)
echo "  · 心跳循环启动 (30s 间隔) ..."
while true; do
  sleep 30
  # 本地 health 检查
  HEALTH=$(curl -s http://localhost:7870/health 2>/dev/null || echo '{}')
  # D%/W% 探针 (通过 admin probe)
  PROBE=$(curl -s -X POST http://localhost:7870/admin/accounts/probe -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo '{}')
  D_PCT=$(echo "$PROBE" | grep -oP '"dailyPercent":\\s*\\K[0-9.-]+' | head -1 || echo -1)
  W_PCT=$(echo "$PROBE" | grep -oP '"weeklyPercent":\\s*\\K[0-9.-]+' | head -1 || echo -1)

  # 上报心跳
  if [ -n "$CONTROLLER" ] && [ "$CONTROLLER" != "https://<your-fleet-controller>" ]; then
    curl -s -X POST "$CONTROLLER/fleet/heartbeat" \\
      -H "Content-Type: application/json" \\
      -d "{\\"unitId\\":\\"$UNIT_ID\\",\\"secret\\":\\"$FLEET_SECRET\\",\\"dPercent\\":$D_PCT,\\"wPercent\\":$W_PCT}" > /dev/null 2>&1 || true
  fi
  echo "  ♥ $(date +%H:%M:%S) D=$D_PCT% W=$W_PCT%"
done
`;
}

/** 生成 Devin 任务 Prompt */
function generateDevinPrompt(unitId, email, opts) {
  return `请执行以下操作部署一个道反代服务单元:

1. 在 VM 中克隆代码仓库: ${opts.repoUrl || "<仓库URL>"}
2. 创建目录 ~/.dao/ 并写入我提供的 accounts.json (单账号配置)
3. 启动 kernel: node _kernel/道直连器.js (后台运行)
4. 启动 admin: node _kernel/admin_server.js --public --port 7870 (后台运行)
5. 安装并运行 cloudflared tunnel 穿透 7870 端口: npx cloudflared tunnel --url http://localhost:7870
6. 报告穿透 URL
7. 保持所有服务运行，不要退出

Unit ID: ${unitId}
Account: ${email}

完成后请告诉我穿透 URL，我会记录到 fleet 控制器中。`;
}

// ════════════════════════════════════════════════════════════════
// §8  状态查询
// ════════════════════════════════════════════════════════════════

function getStatus() {
  reapDead();
  const state = load();
  const active = state.units.filter((u) => u.status === "active").length;
  const rateLimited = state.units.filter(
    (u) => u.status === "rate-limited",
  ).length;
  const dead = state.units.filter((u) => u.status === "dead").length;

  return {
    total: state.units.length,
    active,
    rateLimited,
    dead,
    gatewayEnabled: state.gateway.enabled,
    gatewayMode: state.gateway.mode,
    units: state.units.map((u) => ({
      id: u.id,
      account: u.account,
      tunnelUrl: u.tunnelUrl,
      status: u.status,
      dPercent: u.dPercent,
      wPercent: u.wPercent,
      requestCount: u.requestCount,
      errorCount: u.errorCount,
      lastHealthAt: u.lastHealthAt,
      rateLimitedAt: u.rateLimitedAt,
      metadata: u.metadata,
    })),
  };
}

/** 设置网关模式 */
function setGatewayMode(mode) {
  const valid = ["round-robin", "least-load", "best-quota", "random"];
  if (!valid.includes(mode)) {
    throw new Error(`mode 必为: ${valid.join(" | ")}`);
  }
  const state = load();
  state.gateway.mode = mode;
  save(state);
  return state.gateway;
}

/** 启/停网关 */
function setGatewayEnabled(enabled) {
  const state = load();
  state.gateway.enabled = !!enabled;
  save(state);
  return state.gateway;
}

// ════════════════════════════════════════════════════════════════
// §9  主动健康检查 (admin_server 定时调)
// ════════════════════════════════════════════════════════════════

/**
 * 主动探测所有 active unit 的 /health 端点
 * @returns {Promise<Object[]>} 每个 unit 的健康结果
 */
async function probeAllUnits() {
  const state = load();
  const targets = state.units.filter((u) => u.status !== "dead");
  if (!targets.length) return [];

  const results = await Promise.allSettled(
    targets.map(
      (unit) =>
        new Promise((resolve) => {
          const url = new URL("/health", unit.tunnelUrl);
          const transport = url.protocol === "https:" ? https : http;
          const t0 = Date.now();
          const req = transport.get(
            {
              hostname: url.hostname,
              port: url.port || (url.protocol === "https:" ? 443 : 80),
              path: url.pathname,
              timeout: 10000,
              headers: { "user-agent": "dao-fleet-probe/1.0" },
            },
            (res) => {
              const chunks = [];
              res.on("data", (c) => chunks.push(c));
              res.on("end", () => {
                const lat = Date.now() - t0;
                let body = null;
                try {
                  body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                } catch {}
                resolve({
                  id: unit.id,
                  ok: res.statusCode === 200,
                  statusCode: res.statusCode,
                  latencyMs: lat,
                  health: body,
                });
              });
            },
          );
          req.on("error", (e) =>
            resolve({
              id: unit.id,
              ok: false,
              error: e.message,
              latencyMs: Date.now() - t0,
            }),
          );
          req.on("timeout", () => {
            req.destroy();
            resolve({
              id: unit.id,
              ok: false,
              error: "timeout",
              latencyMs: Date.now() - t0,
            });
          });
        }),
    ),
  );

  // 更新状态
  for (const r of results) {
    const val = r.status === "fulfilled" ? r.value : null;
    if (!val) continue;
    const unit = state.units.find((u) => u.id === val.id);
    if (!unit) continue;
    unit.lastHealthAt = new Date().toISOString();
    unit.lastHealthOk = !!val.ok;
    if (!val.ok && unit.status === "active") {
      // 健康检查失败但不立即标死 · 给一次机会
      // (deadAfterMs 会在 reapDead 中处理)
    }
  }
  save(state);

  return results.map((r) =>
    r.status === "fulfilled" ? r.value : { error: "rejected" },
  );
}

// ════════════════════════════════════════════════════════════════
// §10  导出
// ════════════════════════════════════════════════════════════════

module.exports = {
  // 常量
  FLEET_FILE,

  // IO
  load,
  save,

  // Secret
  ensureSecret,
  verifySecret,

  // Unit 管理
  registerUnit,
  heartbeat,
  markRateLimited,
  removeUnit,
  reapDead,

  // 网关
  getAvailableUnits,
  pickUnit,
  pickUnitExcluding,
  recordRequest,
  gatewayProxy,

  // 配置生成
  generateSpawnConfigs,

  // 状态
  getStatus,
  setGatewayMode,
  setGatewayEnabled,

  // 健康检查
  probeAllUnits,
};
