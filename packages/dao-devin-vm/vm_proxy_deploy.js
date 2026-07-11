#!/usr/bin/env node
/**
 * vm_proxy_deploy.js · 印 106 · 原汤化原食 · 反代部署于自身 VM
 * 末改 · 印 121 (auth_chain 三口同源) · 印 122 (yin122 全审纳入) · 印 128 (印号统一)
 *
 *   「道恒无名。侯王若能守之，万物将自宾」(三十二)
 *   「治大国若烹小鲜，以道莅天下」(六十)
 *
 * 用法:
 *   node vm_proxy_deploy.js              # 部署到 keepalive omni VM
 *   node vm_proxy_deploy.js --idx 0      # 部署到指定 VM
 *   node vm_proxy_deploy.js --check      # 仅探活已部署的 (不重部署)
 *   node vm_proxy_deploy.js --restart    # 杀旧 node + 重起
 *   node vm_proxy_deploy.js --logs       # 查 VM 内 proxy 日志
 *
 * 部署 7 件:
 *   1. /home/ubuntu/dao_proxy/真本源_单器.js
 *   2. /home/ubuntu/dao_proxy/tokens_dao.txt
 *   3. /home/ubuntu/dao_proxy/tokens_ws.txt
 *   4. /home/ubuntu/dao_proxy/帛书_silk.txt (silk SP source)
 *   5. /home/ubuntu/dao_proxy/.env
 *   6. /home/ubuntu/dao_proxy/start.sh
 *   7. nohup node ... > /home/ubuntu/dao_proxy/proxy.log 2>&1 &
 */
"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const { URL } = require("url");

const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const RESTART = args.includes("--restart");
const LOGS = args.includes("--logs");
const IDX = parseInt(
  args.find((a) => a.startsWith("--idx="))?.split("=")[1] ||
    args[args.indexOf("--idx") + 1] ||
    "-1",
  10,
);

const BASE_DIR = __dirname; // 真本源_单器 / dao_proxy.js 之所在
// 印 115 · 反者道之动 · POOL_FILE 同包优先 (GH Actions runner 自包含)
//   1. env DAO_POOL_JSON 显式指定 (最高优先)
//   2. __dirname/_state/vm_pool.json (同包 · packages/dao-devin-vm/_state/)
//   3. legacy: ../../虚拟机资源/_state/vm_pool.json (主公本机原位)
const POOL_FILE_LOCAL = path.join(BASE_DIR, "_state", "vm_pool.json");
const POOL_FILE_LEGACY = path.resolve(
  BASE_DIR,
  "../../虚拟机资源/_state/vm_pool.json",
);
const POOL_FILE =
  process.env.DAO_POOL_JSON ||
  (fs.existsSync(POOL_FILE_LOCAL) ? POOL_FILE_LOCAL : POOL_FILE_LEGACY);
const REMOTE_DIR = "/home/ubuntu/dao_proxy";
const AUTH_FILE =
  process.env.DAO_AUTH_FILE || path.join(__dirname, ".dao_auth_token");
// 印 115 · 反者道之动 · DAO_PROXY_FILE 同包优先
//   原 vm_proxy_deploy 期 真本源_单器.js 同目录 · 新名 dao_proxy.js (同义异名)
const _legacyPayload = path.join(__dirname, "真本源_单器.js");
const _newPayload = path.join(__dirname, "dao_proxy.js");
const DAO_PROXY_FILE =
  process.env.DAO_PROXY_FILE ||
  (fs.existsSync(_newPayload) ? _newPayload : _legacyPayload);

// 印 106 · 生成或读 auth token (一笔生 · 不漏)
function readOrGenAuth() {
  if (fs.existsSync(AUTH_FILE)) {
    return fs.readFileSync(AUTH_FILE, "utf-8").trim();
  }
  // 32 字节随机 → 64 字符 hex
  const tok = require("crypto").randomBytes(32).toString("hex");
  fs.writeFileSync(AUTH_FILE, tok + "\n", { mode: 0o600 });
  return tok;
}

const C = {
  G: (s) => `\x1b[32m${s}\x1b[0m`,
  Y: (s) => `\x1b[33m${s}\x1b[0m`,
  R: (s) => `\x1b[31m${s}\x1b[0m`,
  B: (s) => `\x1b[36m${s}\x1b[0m`,
  GR: (s) => `\x1b[90m${s}\x1b[0m`,
};

function req(url, opts = {}, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOpts = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: opts.method || "GET",
      headers: opts.headers || {},
      auth:
        u.username && u.password
          ? `${u.username}:${decodeURIComponent(u.password)}`
          : undefined,
      timeout: opts.timeout || 60000,
    };
    const r = https.request(reqOpts, (res) => {
      let chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: buf,
          text: buf.toString("utf-8"),
        });
      });
    });
    r.on("error", reject);
    r.on("timeout", () => {
      r.destroy();
      reject(new Error("timeout"));
    });
    if (body) r.write(body);
    r.end();
  });
}

// 印 108 · 探 omni VM tunnel 是否真活 (而非仅 pool 记录 keepalive=true)
// VM 自身 keepalive 不代表 tunnel 仍通 · cf 路由可能漂至 AWS S3 (真死)
async function probeOmniLive(omniUrl, timeoutMs = 5000) {
  try {
    const r = await req(`${omniUrl}/_/health`, { timeout: timeoutMs });
    return r.statusCode === 200 && /"ok"\s*:\s*true/.test(r.text || "");
  } catch (_) {
    return false;
  }
}

async function findOmniVM() {
  const pool = JSON.parse(fs.readFileSync(POOL_FILE, "utf-8"));
  const getOmniPort = (vm) =>
    vm.ports?.find((p) => (p.service || "").toLowerCase().includes("omni"));

  // 显指 idx · 不探活 (主公明)
  if (IDX >= 0 && IDX < pool.length) {
    const vm = pool[IDX];
    const omniPort = getOmniPort(vm);
    if (!omniPort) throw new Error(`VM idx=${IDX} 无 omni port`);
    return { vm, omniUrl: omniPort.url };
  }

  const omniVms = pool.filter(
    (r) => r.keepalive === true && Array.isArray(r.ports) && getOmniPort(r),
  );
  if (omniVms.length === 0)
    throw new Error("无 omni VM · 起 node vm_omni.js 先");

  // 印 108 · 顺序探活 · 第一活者用 (节带宽 · 不并发)
  for (let i = 0; i < omniVms.length; i++) {
    const vm = omniVms[i];
    const omniUrl = getOmniPort(vm).url;
    const host = omniUrl.split("@")[1]?.split("/")[0] || omniUrl;
    process.stderr.write(`  探 [${i}] ${host} ... `);
    const alive = await probeOmniLive(omniUrl);
    if (alive) {
      process.stderr.write("✓ 活\n");
      return { vm, omniUrl };
    }
    process.stderr.write("✗ 死\n");
  }
  throw new Error(
    `${omniVms.length} 笔 omni VM 全死 (tunnel 失) · 起新 node vm_omni.js 或 --idx N`,
  );
}

async function omniHealth(omniUrl) {
  const r = await req(`${omniUrl}/_/health`, { timeout: 10000 });
  if (r.statusCode !== 200) throw new Error(`health ${r.statusCode}`);
  return r.text;
}

async function omniRun(omniUrl, cmd, opts = {}) {
  const body = JSON.stringify({
    cmd,
    timeout: opts.timeout || 30000,
    cwd: opts.cwd || "/home/ubuntu",
    shell: opts.shell || "/bin/bash",
  });
  const r = await req(
    `${omniUrl}/_/run`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: (opts.timeout || 30000) + 5000,
    },
    body,
  );
  if (r.statusCode !== 200)
    throw new Error(`run ${r.statusCode}: ${r.text.slice(0, 300)}`);
  return JSON.parse(r.text);
}

async function omniPutFile(omniUrl, remotePath, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf-8");
  const r = await req(
    `${omniUrl}/_/file${remotePath.startsWith("/") ? remotePath : "/" + remotePath}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": buf.length,
      },
      timeout: 30000,
    },
    buf,
  );
  if (r.statusCode !== 200)
    throw new Error(`putFile ${r.statusCode}: ${r.text.slice(0, 200)}`);
  return JSON.parse(r.text);
}

async function omniSpawn(omniUrl, cmd, args = [], env = {}) {
  const body = JSON.stringify({ cmd, args, env, cwd: "/home/ubuntu" });
  const r = await req(
    `${omniUrl}/_/spawn`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 30000,
    },
    body,
  );
  if (r.statusCode !== 200)
    throw new Error(`spawn ${r.statusCode}: ${r.text.slice(0, 300)}`);
  return JSON.parse(r.text);
}

async function omniProxyHttp(omniUrl, port, pathSuffix, opts = {}) {
  const u = `${omniUrl}/port/${port}${pathSuffix.startsWith("/") ? pathSuffix : "/" + pathSuffix}`;
  return await req(u, opts);
}

async function logsCmd() {
  const { vm, omniUrl } = await findOmniVM();
  console.log(
    C.B(`VM: ${vm.sessionId} · ${omniUrl.split("@")[1].split("/")[0]}`),
  );
  const r = await omniRun(
    omniUrl,
    "tail -n 80 /home/ubuntu/dao_proxy/proxy.log",
  );
  console.log(r.stdout || "(空 · 是否未起?)");
  if (r.stderr) console.log(C.Y("stderr:"), r.stderr);
}

async function checkCmd() {
  const { vm, omniUrl } = await findOmniVM();
  console.log(C.B(`VM: ${vm.sessionId}`));
  console.log(`  omni: ${omniUrl.split("@")[1].split("/")[0]}`);
  console.log();

  // 1. 检 :7780 是否在 VM 内 listen
  const r1 = await omniRun(
    omniUrl,
    "ss -ltnp | grep ':7780' || echo 'NOT_LISTENING'",
  );
  console.log(C.B("  :7780 listen 态:"));
  console.log("  " + r1.stdout.trim());

  // 2. 检 keeper alive
  const rk = await omniRun(
    omniUrl,
    "pgrep -af keeper.sh | head -3 || echo 'NO_KEEPER'",
  );
  console.log(C.B("  keeper daemon:"));
  console.log("  " + rk.stdout.trim());

  // 3. health (auth-gated)
  const authToken = fs.existsSync(AUTH_FILE)
    ? fs.readFileSync(AUTH_FILE, "utf-8").trim()
    : "";
  console.log("");
  console.log(C.B("  /port/7780/health (通 omni 代 · 带 auth):"));
  try {
    const headers = authToken ? { "X-Dao-Auth": authToken } : {};
    const r2 = await req(`${omniUrl}/port/7780/health`, {
      method: "GET",
      headers,
      timeout: 10000,
    });
    console.log(`  status=${r2.statusCode}  size=${r2.body.length}B`);
    if (r2.statusCode === 200) {
      try {
        const j = JSON.parse(r2.text);
        console.log(C.G("  ✓"), `v=${j.version} seal=${j.seal}`);
        console.log(
          `    Devin: ${j.pool?.total} tokens · Windsurf: ${j.windsurf?.keys} keys`,
        );
        console.log(
          `    auth: enabled=${j.auth?.enabled} preview=${j.auth?.tokenPreview}`,
        );
        console.log(`    chat_status: ${j.windsurf?.chat_status}`);
        console.log(
          `    metrics: req=${j.metrics?.requests?.total} ok=${j.metrics?.successes?.total} rate=${Math.round((j.metrics?.successRate || 0) * 100)}%`,
        );
      } catch {
        console.log("  parse err: " + r2.text.slice(0, 300));
      }
    } else {
      console.log(C.R("  ✗"), r2.text.slice(0, 200));
    }
  } catch (e) {
    console.log(C.R("  ✗"), e.message);
  }
  console.log("");
  console.log(C.B("  公网 proxy URL:"));
  console.log(`  ${omniUrl}/port/7780/`);
  if (authToken) {
    console.log(C.B("  auth token (含):"));
    console.log(`  ${C.GR(authToken)}`);
  }
}

async function deployCmd() {
  const { vm, omniUrl } = await findOmniVM();
  console.log(C.B(`VM: ${vm.sessionId}`));
  console.log(`  omni: ${omniUrl.split("@")[1].split("/")[0]}`);
  console.log();

  // 检 VM 活
  console.log("[1/7] " + C.B("VM 健康检"));
  const h = await omniHealth(omniUrl);
  console.log(C.G("  ✓"), "VM alive");

  // 杀旧 proxy (若 RESTART)
  if (RESTART) {
    console.log("[2/7] " + C.Y("--restart: 杀旧 proxy"));
    await omniRun(
      omniUrl,
      "pkill -f '真本源_单器' 2>/dev/null; sleep 1; pkill -9 -f '真本源_单器' 2>/dev/null; true",
    );
    console.log(C.G("  ✓"), "old killed");
  }

  // 备目录
  console.log("[3/7] " + C.B("备目录 /home/ubuntu/dao_proxy"));
  await omniRun(
    omniUrl,
    "mkdir -p /home/ubuntu/dao_proxy && chmod 755 /home/ubuntu/dao_proxy",
  );
  console.log(C.G("  ✓"));

  // 上传文件
  console.log("[4/7] " + C.B("上传 真本源_单器.js + 数据"));
  // 注: omni server URL-encodes Chinese filenames · 故用 ASCII 文件名
  const files = [
    {
      remote: REMOTE_DIR + "/dao_proxy.js",
      local: DAO_PROXY_FILE, // 印 115 · 同包 dao_proxy.js 或 legacy 真本源_单器.js
    },
    {
      remote: REMOTE_DIR + "/tokens_dao.txt",
      local: path.join(BASE_DIR, "tokens_dao_123.txt"),
    },
    {
      remote: REMOTE_DIR + "/tokens_ws.txt",
      local: path.join(BASE_DIR, "tokens_ws_59.txt"),
    },
  ];

  // 印 122 · sp_observe_patch.js 软伴 (主公 yin122 之 require ./sp_observe_patch · 容退)
  // 若 BASE_DIR 内有此件 (00_本源/sp_observe_patch.js) 则一并上传 · 否则 dao_proxy 之 try/catch 自吞
  const spObserveLocal = path.join(BASE_DIR, "sp_observe_patch.js");
  if (fs.existsSync(spObserveLocal)) {
    files.push({
      remote: REMOTE_DIR + "/sp_observe_patch.js",
      local: spObserveLocal,
    });
  }

  // 印 122 · 真本源 silk 双源传 (dao_proxy.js loadSilk 期 _silk_de.txt + _silk_dao.txt)
  // 帛书·廿二「圣人执一·以为天下牧」+ 六十四「治之于其未乱也」
  // 旧路 silk.txt 单件 → 新路 silk/_silk_de.txt + silk/_silk_dao.txt 双源
  // 兼老: 若双源缺, fallback 旧路 silk.txt (留兼)
  const silkDaoLocal = path.join(BASE_DIR, "silk", "_silk_dao.txt");
  const silkDeLocal = path.join(BASE_DIR, "silk", "_silk_de.txt");
  if (fs.existsSync(silkDaoLocal) && fs.existsSync(silkDeLocal)) {
    files.push({
      remote: REMOTE_DIR + "/silk/_silk_dao.txt",
      local: silkDaoLocal,
    });
    files.push({
      remote: REMOTE_DIR + "/silk/_silk_de.txt",
      local: silkDeLocal,
    });
  } else {
    // fallback 旧路 (印 106 之 兼老 · 单件 silk.txt)
    const silkCandidates = [
      path.resolve(
        BASE_DIR,
        "../../05-文档_docs/image/道德经原文/帛书五千言.txt",
      ),
      path.resolve(BASE_DIR, "../../05-文档_docs/帛书五千言.txt"),
      path.resolve(BASE_DIR, "../帛书五千言.txt"),
    ];
    for (const sp of silkCandidates) {
      if (fs.existsSync(sp)) {
        files.push({ remote: REMOTE_DIR + "/silk.txt", local: sp });
        break;
      }
    }
  }

  for (const f of files) {
    if (!fs.existsSync(f.local)) {
      console.log(C.Y("  ! 缺"), f.local);
      continue;
    }
    const data = fs.readFileSync(f.local);
    await omniPutFile(omniUrl, f.remote, data);
    console.log(
      `  ${C.G("✓")} ${path.basename(f.remote).padEnd(28)} ${data.length}B`,
    );
  }

  // 印 106 · auth token (本机生 · 上传至 VM · 不漏端)
  const authToken = readOrGenAuth();
  console.log(
    "[5a/7] " +
      C.B("auth token: ") +
      C.GR(authToken.slice(0, 8) + "..." + authToken.slice(-4)),
  );
  await omniPutFile(omniUrl, REMOTE_DIR + "/.auth_token", authToken);
  await omniRun(omniUrl, "chmod 600 " + REMOTE_DIR + "/.auth_token");

  // start.sh
  console.log("[5b/7] " + C.B("写 start.sh + keeper.sh"));
  const startScript = `#!/bin/bash
# dao proxy starter · 印 106 · 原汤化原食 · 自同
cd /home/ubuntu/dao_proxy
export PORT=7780
export BIND=0.0.0.0
export DAO_TOKENS_FILE=/home/ubuntu/dao_proxy/tokens_dao.txt
export WS_TOKENS_FILE=/home/ubuntu/dao_proxy/tokens_ws.txt
export DAO_SILK_FILE=/home/ubuntu/dao_proxy/silk.txt
export DAO_AUTH_TOKEN=$(cat /home/ubuntu/dao_proxy/.auth_token 2>/dev/null)
# 清URL-encoded 旧文件 (印 106 修)
rm -f '/home/ubuntu/dao_proxy/%E7%9C%9F%E6%9C%AC%E6%BA%90_%E5%8D%95%E5%99%A8.js' 2>/dev/null
# 杀同名旧进程
pkill -f 'dao_proxy.js' 2>/dev/null
pkill -f '真本源_单器' 2>/dev/null
sleep 1
# nohup 后台 · stdout/stderr 同 log (印 106 · 滚动 5MB)
exec nohup node /home/ubuntu/dao_proxy/dao_proxy.js >> /home/ubuntu/dao_proxy/proxy.log 2>&1 &
echo "started PID=$!"
sleep 3
ss -ltnp | grep ':7780' || echo "WARN: :7780 not yet listening"
`;
  await omniPutFile(omniUrl, REMOTE_DIR + "/start.sh", startScript);
  await omniRun(omniUrl, "chmod +x " + REMOTE_DIR + "/start.sh");

  // keeper.sh · 守护 daemon · 60s 巡 · 若 :7780 死则重起
  // 印 112 修: 加 cf self-ping · 维 /port/7780/ 之 tunnel · 避 5-min idle snapshot
  const publicUrl = omniUrl; // 含 user:pass@host
  const keeperScript = `#!/bin/bash
# dao keeper · 印 106 · 道法自然 · 死则自起 · cf self-ping
# 用: nohup bash keeper.sh > keeper.log 2>&1 &
LOG=/home/ubuntu/dao_proxy/keeper.log
PROXY_LOG=/home/ubuntu/dao_proxy/proxy.log
INTERVAL=60
PUBLIC_URL='${publicUrl}'
echo "$(date '+%Y-%m-%d %H:%M:%S') keeper started · interval=\${INTERVAL}s · cf_self_ping=ON" >> $LOG
# 自避重启 keeper (PID file)
echo $$ > /home/ubuntu/dao_proxy/.keeper.pid
trap 'rm -f /home/ubuntu/dao_proxy/.keeper.pid; exit' INT TERM
while true; do
  # 检 :7780 是否 listen · 若死则起
  if ! ss -ltnp 2>/dev/null | grep -q ':7780'; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') :7780 down · 重起" >> $LOG
    # 日志 truncate (>10MB 时)
    if [ -f "$PROXY_LOG" ] && [ $(stat -c%s "$PROXY_LOG" 2>/dev/null || echo 0) -gt 10485760 ]; then
      tail -c 1048576 "$PROXY_LOG" > "\${PROXY_LOG}.tmp" && mv "\${PROXY_LOG}.tmp" "$PROXY_LOG"
      echo "$(date '+%Y-%m-%d %H:%M:%S') proxy.log truncated" >> $LOG
    fi
    bash /home/ubuntu/dao_proxy/start.sh >> $LOG 2>&1
  fi
  # 真本源 · 印 112: cf self-ping · 维 /port/7780/ 之 cf tunnel 之 public reach
  # 经 cf · 与 omni /_/health 路径相异 · 各路独维
  curl -sSf --max-time 10 -o /dev/null "\$PUBLIC_URL/port/7780/health" 2>/dev/null \\
    || echo "$(date '+%Y-%m-%d %H:%M:%S') cf self-ping fail (tunnel snapshot?)" >> $LOG
  sleep $INTERVAL
done
`;
  await omniPutFile(omniUrl, REMOTE_DIR + "/keeper.sh", keeperScript);
  await omniRun(omniUrl, "chmod +x " + REMOTE_DIR + "/keeper.sh");
  console.log(C.G("  ✓"));

  // 起 proxy
  console.log("[6a/8] " + C.B("起 proxy (bash start.sh)"));
  const r2 = await omniRun(omniUrl, "/home/ubuntu/dao_proxy/start.sh", {
    timeout: 15000,
  });
  console.log("  stdout: " + (r2.stdout || "").trim().split("\n").join("\n  "));
  if (r2.stderr) console.log(C.Y("  stderr: ") + r2.stderr.trim());

  // 起 keeper daemon (60s 巡 · 死则自起)
  console.log("[6b/8] " + C.B("起 keeper daemon (auto-restart)"));
  // 先杀旧 keeper
  await omniRun(
    omniUrl,
    "pkill -f 'keeper.sh' 2>/dev/null; sleep 1; pkill -9 -f 'keeper.sh' 2>/dev/null; true",
  );
  // 起新 keeper · 用 setsid 脱壳 · 持久后台
  const rk = await omniSpawn(
    omniUrl,
    "/bin/bash",
    ["/home/ubuntu/dao_proxy/keeper.sh"],
    {},
  );
  console.log(C.G("  ✓"), `keeper PID=${rk.pid || "?"}`);

  // 验
  console.log("[7/8] " + C.B("验 /port/7780/health (需 auth token)"));
  await new Promise((r) => setTimeout(r, 2000));
  try {
    // 用 auth token (X-Dao-Auth) 调
    const hh = await req(`${omniUrl}/port/7780/health`, {
      method: "GET",
      headers: { "X-Dao-Auth": authToken },
      timeout: 12000,
    });
    if (hh.statusCode === 200) {
      const j = JSON.parse(hh.text);
      console.log(C.G("  ✓ proxy alive (auth gate 通)"));
      console.log(`    v=${j.version} seal=${j.seal}`);
      console.log(
        `    Devin pool=${j.pool?.total} · Windsurf pool=${j.windsurf?.keys}`,
      );
      console.log(
        `    auth: enabled=${j.auth?.enabled} preview=${j.auth?.tokenPreview}`,
      );
      console.log(`    chat_status: ${j.windsurf?.chat_status}`);
    } else {
      console.log(C.R(`  ✗ HTTP ${hh.statusCode}: ${hh.text.slice(0, 200)}`));
    }
  } catch (e) {
    console.log(C.R("  ✗"), e.message);
  }

  // 验 keeper alive
  console.log("[8/8] " + C.B("验 keeper alive"));
  const rkc = await omniRun(omniUrl, "pgrep -af keeper.sh | head -3");
  if (rkc.stdout && rkc.stdout.trim()) {
    console.log(C.G("  ✓"), rkc.stdout.trim());
  } else {
    console.log(C.Y("  ! keeper not detected"));
  }

  // ════ 总结 ════
  console.log();
  console.log(C.G("═══════════════════════════════════════════════════"));
  console.log(C.G("  ★ 印 106 · 原汤化原食 · VM 自同 · 反代部署完成"));
  console.log(C.G("═══════════════════════════════════════════════════"));
  console.log();
  console.log("  ─ 公网 proxy URL ─");
  console.log(`    ${omniUrl}/port/7780/`);
  console.log();
  console.log("  ─ 本机 auth token (主公保) ─");
  console.log(`    ${authToken}`);
  console.log(C.GR(`    存: ${AUTH_FILE}`));
  console.log();
  console.log("  ─ 客端 (需 X-Dao-Auth header) ─");
  console.log(
    `    curl -H "X-Dao-Auth: ${authToken.slice(0, 8)}..." ${omniUrl}/port/7780/health`,
  );
  console.log(
    `    curl -H "X-Dao-Auth: ${authToken.slice(0, 8)}..." -X POST ${omniUrl}/port/7780/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"devin","messages":[{"role":"user","content":"道可道"}]}'`,
  );
  console.log();
  console.log("  ─ 公开 (无需 auth) ─");
  console.log(`    GET / · /health · /dashboard`);
  console.log();
  console.log("  ─ 状/日 ─");
  console.log(`    node vm_proxy_deploy.js --check     · 探活`);
  console.log(`    node vm_proxy_deploy.js --logs      · 看 proxy.log`);
  console.log(`    node vm_proxy_deploy.js --restart   · 重起`);
}

async function main() {
  try {
    if (LOGS) await logsCmd();
    else if (CHECK) await checkCmd();
    else await deployCmd();
  } catch (e) {
    console.error(C.R("✗"), e.message);
    process.exit(1);
  }
}

main();
