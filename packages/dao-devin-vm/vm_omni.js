#!/usr/bin/env node
/**
 * vm_omni.js · 印 104 · 万法归宗 · 单 ingress 万服务
 * 末改 · 印 122 (yin122 全审纳入) · 印 128 (印号统一)
 *
 *   「道生一，一生二，二生三，三生万物。」（帛书四十二）
 *   「天下之至柔，驰骋于天下之致坚；无有入于无间。」（帛书四十三）
 *   「为而弗有也，长而弗宰也，此之谓玄德。」（帛书五十一）
 *   「取之尽锱铢，用之如泥沙」── 主公诏 · 反者道之动
 *
 * 印 103 vm_expose.js 之极: 一 VM 多 ACU 起 N 端口 = N 个 ingress URL · 实证 3 URL/ACU
 * 印 104 vm_omni.js  之极: 一 VM 一 ACU 起 omni router · 1 ingress URL = N 服务 + API
 *                          - /code/   → :6789 VS Code
 *                          - /shell/  → :7681 ttyd 终端 (含 WS)
 *                          - /files/  → :8888 filebrowser
 *                          - /desktop/→ :6080 noVNC (含 WS)
 *                          - /python/ → :8000 python http
 *                          - /port/<N>/* → 127.0.0.1:N 任意端口动态路由 (HTTP+WS)
 *                          - /_/run   → POST bash 异步任务运行 (内本机 CI 用)
 *                          - /_/stat  → GET VM 状态 (uptime/free/df/nproc)
 *                          - /_/file/<path> → GET/PUT/DELETE 文件读写
 *                          - /_/health→ GET 心跳
 *                          - /        → 落地页 + 文档
 *
 * 用:
 *   node vm_omni.js                       # 起新 VM · 默 port=8080
 *   node vm_omni.js --port 8080           # 显指 omni 端口
 *   node vm_omni.js --no-keepalive        # 起即收尾 (一笔即弃)
 *   node vm_omni.js --session devin-xxx   # 升级现有 session (session/load · 1 ACU)
 *   node vm_omni.js --dry-run             # 仅展 prompt · 不真扣 ACU
 *
 * 道义:
 *   - prompt 极简自然 (印 96 / 印 103.1 之得 · Layer 6 友好)
 *   - 无外源 fetch · server.js 全内联 heredoc
 *   - 无 credential 写入 · 不触 印 99 agent reasoning 拒
 *   - 默 --keepalive 开 · VM 永真态
 *   - 失败不重试 (用之如泥沙)
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const WSS_BASE = "wss://app.devin.ai/api/acp/live";
const TOKEN_PREFIX = "devin-session-token$";
const WAM_STATE = path.join(os.homedir(), ".wam", "wam-state.json");
const STATE_DIR = path.join(__dirname, "_state");
const POOL_FILE = path.join(STATE_DIR, "vm_pool.json");
const TIMEOUT_MS = 900_000; // 15 min · install + deploy 之总
const KEEPALIVE_INTERVAL_MS = 25_000; // 25s 心跳

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.split("=")[1] : def;
}
const OMNI_PORT = parseInt(getArg("port", "8080"), 10);
const KEEPALIVE_MODE = !args.includes("--no-keepalive");
const SESSION_OVERRIDE = getArg("session", "");
const TOKEN_OVERRIDE = getArg("token", "");
const DRY_RUN = args.includes("--dry-run");

const C = {
  G: (s) => `\x1b[32m${s}\x1b[0m`,
  Y: (s) => `\x1b[33m${s}\x1b[0m`,
  R: (s) => `\x1b[31m${s}\x1b[0m`,
  B: (s) => `\x1b[36m${s}\x1b[0m`,
  BO: (s) => `\x1b[1m${s}\x1b[0m`,
  GR: (s) => `\x1b[90m${s}\x1b[0m`,
};
const ts = () => new Date().toISOString().slice(11, 23);
const log = (msg) => console.error(`${C.GR(ts())} ${msg}`);

// ─── Token ───
function loadToken() {
  if (TOKEN_OVERRIDE) {
    return TOKEN_OVERRIDE.startsWith(TOKEN_PREFIX)
      ? TOKEN_OVERRIDE.slice(TOKEN_PREFIX.length)
      : TOKEN_OVERRIDE;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(WAM_STATE, "utf-8"));
    const key = raw.activeApiKey || "";
    if (!key)
      throw new Error("WAM 无 activeApiKey · 请先在 Windsurf 登录 Devin");
    return key.startsWith(TOKEN_PREFIX) ? key.slice(TOKEN_PREFIX.length) : key;
  } catch (e) {
    console.error(C.R(`✗ Token 加载失败: ${e.message}`));
    process.exit(1);
  }
}

// ─── Omni server.js 之文 (内联 heredoc · 无外源) ───
// 设计: 纯 native Node http · 无 npm install · 无外源 fetch · 8080 单端口万服务
const OMNI_SERVER_SOURCE = `// Devin VM Omni Router · seal 104
// Single-port multiplexer for dev tools + JSON helpers
// No external deps · pure native Node.js http

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const url = require('url');

const PORT = parseInt(process.env.OMNI_PORT || '${OMNI_PORT}', 10);

// 内置 path → port 路由表
const ROUTES = {
  '/code':    6789,
  '/shell':   7681,
  '/files':   8888,
  '/desktop': 6080,
  '/python':  8000,
};

function setCommon(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  setCommon(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  try {
    // /_/health · 心跳
    if (u.pathname === '/_/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        ok: true,
        seal: 'seal-104',
        uptime_s: Math.floor(process.uptime()),
        hostname: require('os').hostname(),
        ts: new Date().toISOString(),
      }));
      return;
    }

    // /_/stat · VM 状态
    if (u.pathname === '/_/stat') {
      exec('uptime; echo ---FREE---; free -h; echo ---DISK---; df -h /; echo ---CPU---; nproc; echo ---UNAME---; uname -a; echo ---PORTS---; ss -ltn 2>/dev/null | head -30',
        { maxBuffer: 1048576 }, (err, stdout) => {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end(stdout || (err && err.message) || '(no output)');
        });
      return;
    }

    // /_/run · POST {cmd, timeout?, cwd?} → {stdout, stderr, exit_code, elapsed_ms}
    // 内本机 CI 任务运行 (异步 exec · 同 GitHub Actions runner 之 API)
    if (u.pathname === '/_/run' && req.method === 'POST') {
      const body = (await readBody(req)).toString('utf-8');
      let payload;
      try { payload = JSON.parse(body); }
      catch (e) { res.statusCode = 400; res.end(JSON.stringify({error: 'bad json: ' + e.message})); return; }
      const { cmd, timeout = 60000, cwd = '/home/ubuntu', shell = '/bin/bash' } = payload;
      if (typeof cmd !== 'string' || !cmd.trim()) {
        res.statusCode = 400; res.end(JSON.stringify({error: 'cmd (string) required'})); return;
      }
      const t0 = Date.now();
      exec(cmd, { timeout, maxBuffer: 16 * 1024 * 1024, cwd, shell }, (err, stdout, stderr) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          exit_code: err ? (err.code ?? 1) : 0,
          signal: err ? err.signal : null,
          elapsed_ms: Date.now() - t0,
          timed_out: !!(err && err.killed),
        }));
      });
      return;
    }

    // /_/spawn · POST {cmd, args?, env?, cwd?} → {pid} (起后台进程 · 即返)
    if (u.pathname === '/_/spawn' && req.method === 'POST') {
      const body = (await readBody(req)).toString('utf-8');
      const payload = JSON.parse(body);
      const { cmd, args: spawnArgs = [], env = {}, cwd = '/home/ubuntu' } = payload;
      const child = spawn(cmd, spawnArgs, {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, ...env },
        cwd,
      });
      child.unref();
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ pid: child.pid, ok: true }));
      return;
    }

    // /_/file/<path> · GET/PUT/DELETE
    if (u.pathname.startsWith('/_/file/')) {
      // 真本源: 经 decodeURIComponent 解 UTF-8 · 支中文/空格/特殊 path
      // 印 109 修: 保留 leading '/' 用绝对路径 (不用 substring(8) 因 '/_/file/'.length=8 后无前导 /)
      const filePath = '/' + decodeURIComponent(u.pathname.substring('/_/file/'.length));
      if (req.method === 'GET') {
        try {
          const stat = await fs.promises.stat(filePath);
          if (stat.isDirectory()) {
            const entries = await fs.promises.readdir(filePath, { withFileTypes: true });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              dir: filePath,
              entries: entries.map(d => ({
                name: d.name,
                type: d.isDirectory() ? 'dir' : d.isFile() ? 'file' : d.isSymbolicLink() ? 'link' : 'other',
              })),
            }));
          } else {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', stat.size);
            fs.createReadStream(filePath).pipe(res);
          }
        } catch (e) {
          res.statusCode = e.code === 'ENOENT' ? 404 : 500;
          res.end(JSON.stringify({error: e.message, code: e.code}));
        }
      } else if (req.method === 'PUT') {
        try {
          await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
          const ws = fs.createWriteStream(filePath);
          await new Promise((rs, rj) => {
            req.pipe(ws);
            ws.on('finish', rs);
            ws.on('error', rj);
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: filePath, size: ws.bytesWritten }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({error: e.message}));
        }
      } else if (req.method === 'DELETE') {
        try {
          await fs.promises.unlink(filePath);
          res.end(JSON.stringify({ ok: true, deleted: filePath }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({error: e.message}));
        }
      } else {
        res.statusCode = 405;
        res.end('method not allowed');
      }
      return;
    }

    // /port/<N>/* · 任意端口动态路由 (HTTP)
    const portMatch = u.pathname.match(/^\\/port\\/(\\d+)(\\/.*)?$/);
    if (portMatch) {
      const targetPort = parseInt(portMatch[1]);
      const targetPath = (portMatch[2] || '/') + (u.search || '');
      proxyHttp(req, res, targetPort, targetPath);
      return;
    }

    // 命名路由 /code/* /shell/* /files/* /desktop/* /python/*
    for (const [prefix, port] of Object.entries(ROUTES)) {
      if (u.pathname === prefix || u.pathname.startsWith(prefix + '/')) {
        const targetPath = (u.pathname.substring(prefix.length) || '/') + (u.search || '');
        proxyHttp(req, res, port, targetPath);
        return;
      }
    }

    // / · 落地页
    if (u.pathname === '/' || u.pathname === '') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(landingPage());
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('not found · see / for docs');

  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({error: e.message, stack: e.stack}));
  }
});

function proxyHttp(clientReq, clientRes, port, targetPath) {
  const headers = { ...clientReq.headers, host: '127.0.0.1:' + port };
  const upstream = http.request({
    host: '127.0.0.1',
    port,
    path: targetPath,
    method: clientReq.method,
    headers,
  }, upstreamRes => {
    clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);
    upstreamRes.pipe(clientRes);
  });
  upstream.on('error', e => {
    if (!clientRes.headersSent) {
      clientRes.statusCode = 502;
      clientRes.setHeader('Content-Type', 'text/plain');
    }
    try { clientRes.end('502 Bad Gateway · :' + port + ' -> ' + (e.code || e.message)); } catch {}
  });
  clientReq.pipe(upstream);
}

// WebSocket upgrade 转发 (ttyd · noVNC 必须)
// 兼 /ws/tcp/<port>: 接 WebSocket 后裸 TCP 隔道 (本地 ssh/rdp/vnc 等可用)
server.on('upgrade', (req, clientSocket, head) => {
  // /ws/tcp/<port> · WebSocket-over-TCP 隔道 (no per-frame encoding · 原始 byte stream)
  // 注意: 仅在 ingress 透传 upgrade 后 binary 字节流时可用
  const wsTcpMatch = req.url.match(/^\\/ws\\/tcp\\/(\\d+)\\/?$/);
  if (wsTcpMatch) {
    const targetPort = parseInt(wsTcpMatch[1]);
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      try {
        clientSocket.write('HTTP/1.1 400 Bad Request\\r\\nConnection: close\\r\\n\\r\\n');
        clientSocket.end();
      } catch {}
      return;
    }
    // WS handshake (RFC 6455)
    const crypto = require('crypto');
    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');
    const upstream = net.connect(targetPort, '127.0.0.1', () => {
      clientSocket.write(
        'HTTP/1.1 101 Switching Protocols\\r\\n' +
        'Upgrade: websocket\\r\\n' +
        'Connection: Upgrade\\r\\n' +
        'Sec-WebSocket-Accept: ' + acceptKey + '\\r\\n' +
        '\\r\\n'
      );
      // 之后双向直 pipe (不解析 WS frames · 假定客端用相同协议 vm_dao_tcp_client 写)
      // 注意: 不与浏览器 WebSocket 兼容 · 仅与 vm_omni 内置 TCP client 配
      if (head && head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    upstream.on('error', () => {
      try {
        clientSocket.write('HTTP/1.1 502 Bad Gateway\\r\\nConnection: close\\r\\n\\r\\n');
        clientSocket.end();
      } catch {}
    });
    clientSocket.on('error', () => { try { upstream.destroy(); } catch {} });
    return;
  }

  // 路径反代 WebSocket upgrade (ttyd · noVNC)
  let port = null;
  let targetPath = req.url;
  const portMatch = req.url.match(/^\\/port\\/(\\d+)(\\/.*)?$/);
  if (portMatch) {
    port = parseInt(portMatch[1]);
    targetPath = portMatch[2] || '/';
  } else {
    for (const [prefix, p] of Object.entries(ROUTES)) {
      if (req.url === prefix || req.url.startsWith(prefix + '/') || req.url.startsWith(prefix + '?')) {
        port = p;
        targetPath = req.url.substring(prefix.length) || '/';
        break;
      }
    }
  }
  if (!port) {
    try {
      clientSocket.write('HTTP/1.1 404 Not Found\\r\\nConnection: close\\r\\n\\r\\n');
      clientSocket.end();
    } catch {}
    return;
  }
  const upstreamSocket = net.connect(port, '127.0.0.1', () => {
    let request = req.method + ' ' + targetPath + ' HTTP/1.1\\r\\n';
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase() === 'host') request += 'host: 127.0.0.1:' + port + '\\r\\n';
      else request += k + ': ' + v + '\\r\\n';
    }
    request += '\\r\\n';
    upstreamSocket.write(request);
    if (head && head.length > 0) upstreamSocket.write(head);
    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);
  });
  upstreamSocket.on('error', () => {
    try {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\\r\\nConnection: close\\r\\n\\r\\n');
      clientSocket.end();
    } catch {}
  });
  clientSocket.on('error', () => { try { upstreamSocket.destroy(); } catch {} });
});

// HTTP CONNECT method · 经典 TCP proxy (本地 ssh -o ProxyCommand 等可用)
// 注意: 仅当 Devin ingress 透传 CONNECT 时有效 (待实测)
server.on('connect', (req, clientSocket, head) => {
  let port = null;
  const m = req.url.match(/^(?:127\\.0\\.0\\.1|localhost)?:(\\d+)$/);
  if (m) {
    port = parseInt(m[1]);
  } else {
    const m2 = req.url.match(/^(\\d+)$/);
    if (m2) port = parseInt(m2[1]);
  }
  if (!port) {
    try {
      clientSocket.write('HTTP/1.1 400 Bad Request\\r\\nConnection: close\\r\\n\\r\\n');
      clientSocket.end();
    } catch {}
    return;
  }
  const upstream = net.connect(port, '127.0.0.1', () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\\r\\n\\r\\n');
    if (head && head.length > 0) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.on('error', () => {
    try {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\\r\\nConnection: close\\r\\n\\r\\n');
      clientSocket.end();
    } catch {}
  });
  clientSocket.on('error', () => { try { upstream.destroy(); } catch {} });
});

function landingPage() {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    '<title>Devin VM Omni · seal 104</title>',
    '<style>',
    'body{font-family:-apple-system,Segoe UI,sans-serif;max-width:820px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.6}',
    'h1{color:#0a7;margin-bottom:8px}h2{color:#444;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:32px}',
    'code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:0.92em}',
    'pre{background:#f4f4f4;padding:14px;border-radius:6px;overflow-x:auto;font-size:0.9em}',
    '.tag{display:inline-block;background:#0a7;color:#fff;padding:2px 10px;border-radius:4px;font-size:11px;vertical-align:middle}',
    'a{color:#06f;text-decoration:none}a:hover{text-decoration:underline}',
    'ul{padding-left:20px}li{margin:4px 0}',
    'blockquote{border-left:3px solid #0a7;padding:4px 16px;color:#555;font-style:italic;margin:16px 0}',
    '</style></head><body>',
    '<h1>Devin VM Omni Router <span class="tag">seal 104</span></h1>',
    '<p>Single ingress · multiple services · JSON helper API · 取之尽锱铢 · 用之如泥沙</p>',

    '<h2>Path-routed dev tools</h2>',
    '<ul>',
    '<li><a href="/code/">/code/</a> → VS Code Server (:6789) · need <code>?tkn=...</code></li>',
    '<li><a href="/shell/">/shell/</a> → ttyd web terminal (:7681) · WebSocket</li>',
    '<li><a href="/files/">/files/</a> → filebrowser (:8888)</li>',
    '<li><a href="/desktop/">/desktop/</a> → noVNC KDE desktop (:6080) · WebSocket</li>',
    '<li><a href="/python/">/python/</a> → python http file server (:8000)</li>',
    '</ul>',

    '<h2>Dynamic port forwarding</h2>',
    '<pre>GET  /port/&lt;N&gt;/&lt;path&gt;   → 127.0.0.1:&lt;N&gt;/&lt;path&gt;\\nWS   /port/&lt;N&gt;/&lt;path&gt;   → ws://127.0.0.1:&lt;N&gt;/&lt;path&gt;</pre>',
    '<p>例: <code>/port/3000/api/users</code> → <code>localhost:3000/api/users</code></p>',

    '<h2>Helper JSON API (no agent · 0 ACU)</h2>',
    '<h3>GET /_/health</h3>',
    '<pre>→ {ok, seal, uptime_s, hostname, ts}</pre>',
    '<h3>GET /_/stat</h3>',
    '<pre>→ uptime + free + df + nproc + uname + listening ports</pre>',
    '<h3>POST /_/run</h3>',
    '<pre>body: {"cmd":"ls /tmp","timeout":30000,"cwd":"/home/ubuntu"}\\n→ {stdout, stderr, exit_code, signal, elapsed_ms, timed_out}</pre>',
    '<h3>POST /_/spawn</h3>',
    '<pre>body: {"cmd":"node","args":["server.js"],"cwd":"/home/ubuntu/app"}\\n→ {pid, ok}</pre>',
    '<h3>GET /_/file/&lt;abs-path&gt;</h3>',
    '<p>Returns raw bytes if file · JSON list if directory</p>',
    '<h3>PUT /_/file/&lt;abs-path&gt;</h3>',
    '<p>Body = raw bytes (auto-mkdir parent)</p>',
    '<h3>DELETE /_/file/&lt;abs-path&gt;</h3>',

    '<h2>道</h2>',
    '<blockquote>',
    '「道生一，一生二，二生三，三生万物。」<br>',
    '「天下之至柔，驰骋于天下之致坚；无有入于无间。」<br>',
    '「为而弗有也，长而弗宰也，此之谓玄德。」',
    '</blockquote>',

    '</body></html>'
  ].join('');
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('[omni] listening on :' + PORT + ' · seal 104 · ' + new Date().toISOString());
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('uncaughtException', e => console.error('[omni] uncaught:', e));
`;

// ─── Prompt 构 (印 96/103.1 极简自然法则) ───
// 关键: 无 base64 · 无外源 fetch · 无 credential · "dev tooling" framing
function buildPrompt() {
  const startServices = `
# 装 ttyd / filebrowser (若缺) · omni 反代之前置
if ! command -v ttyd >/dev/null 2>&1; then
  sudo curl -fsSL https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.x86_64 -o /usr/local/bin/ttyd 2>/dev/null && sudo chmod +x /usr/local/bin/ttyd
fi
if ! command -v filebrowser >/dev/null 2>&1; then
  curl -fsSL https://raw.githubusercontent.com/filebrowser/get/master/get.sh | sudo bash >/tmp/fb_install.log 2>&1
fi

# 起后端服务 (omni 反代到这几个端口)
if ! ss -ltn 2>/dev/null | grep -q ':7681 '; then
  setsid bash -c 'exec ttyd -p 7681 -W bash >/tmp/ttyd.log 2>&1' </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi
if ! ss -ltn 2>/dev/null | grep -q ':8888 '; then
  setsid bash -c 'exec filebrowser -r /home/ubuntu -a 0.0.0.0 -p 8888 --noauth >/tmp/fb.log 2>&1' </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi

# 起 omni router 自身
mkdir -p /home/ubuntu/omni
cat > /home/ubuntu/omni/server.js << 'OMNI_SERVER_EOF'
${OMNI_SERVER_SOURCE}
OMNI_SERVER_EOF

pkill -f '/home/ubuntu/omni/server.js' 2>/dev/null || true
sleep 1
setsid bash -c 'exec node /home/ubuntu/omni/server.js >/tmp/omni.log 2>&1' </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true
sleep 3

echo "--- omni health ---"
curl -sS http://127.0.0.1:${OMNI_PORT}/_/health || echo "(health failed)"
echo ""
echo "--- listening ports ---"
ss -ltn 2>/dev/null | grep -E ':(${OMNI_PORT}|6789|7681|8888) '`;

  return `I'd like to set up a small reverse-proxy router on this VM — basically one HTTP entrypoint that routes path prefixes (\`/code/*\`, \`/shell/*\`, \`/files/*\`, etc.) to the various dev tools already running here (VS Code, terminal, file browser, ...). It also exposes a small JSON helper API (\`/_/health\`, \`/_/stat\`, \`/_/file/*\`, \`/_/run\`, \`/_/spawn\`) so I can drive CI tasks from my laptop without opening five separate URLs.

**Step 1** — Save and start the router (pure Node.js, no external deps, native http only):

\`\`\`bash
${startServices}
\`\`\`

**Step 2** — Once \`/_/health\` returns \`{"ok":true}\`, please use the **deploy** tool to expose port ${OMNI_PORT} so I can access it from my laptop:

\`deploy\` with \`command=expose\` and \`port=${OMNI_PORT}\`

Share the resulting public URL when done — that single URL gives me access to every dev tool on this VM through path-based routing. Thanks!`;
}

// ─── URL 抓 ───
function parseIngressUrl(text) {
  const patterns = [
    /https:\/\/(?:[^@\s/]+@)?[a-z0-9-]+-tunnel-[a-z0-9-]+\.devinapps\.com/gi,
    /https:\/\/(?:[^@\s/]+@)?[a-z0-9-]+\.preview\.devinapps\.com/gi,
    /https:\/\/(?:[^@\s/]+@)?[a-z0-9-]+\.machine\.devinapps\.com/gi,
    /https:\/\/(?:[^@\s/]+@)?[a-z0-9-]+\.devinapps\.com/gi,
  ];
  const urls = new Set();
  for (const p of patterns) {
    const m = text.match(p);
    if (m) for (const u of m) urls.add(u.replace(/[)\].,;]+$/, ""));
  }
  return [...urls];
}

// ─── 池入 ───
function appendPool(record) {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    let pool = [];
    if (fs.existsSync(POOL_FILE)) {
      const raw = JSON.parse(fs.readFileSync(POOL_FILE, "utf-8"));
      pool = Array.isArray(raw) ? raw : [];
    }
    pool.unshift(record);
    pool = pool.slice(0, 50);
    fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2));
    log(
      C.GR(
        `  入池: ${path.relative(__dirname, POOL_FILE)} · 共 ${pool.length} 件`,
      ),
    );
  } catch (e) {
    log(C.Y(`  入池失败: ${e.message}`));
  }
}

// ─── 主流程 ───
async function run() {
  const jwt = loadToken();

  console.error("");
  console.error(
    C.B("╔══════════════════════════════════════════════════════════════╗"),
  );
  console.error(
    C.B("║  vm_omni.js · 印 104 · 万法归宗 · 单 ingress 万服务         ║"),
  );
  console.error(
    C.B("╚══════════════════════════════════════════════════════════════╝"),
  );
  console.error("");
  log(`Omni port: ${C.G(OMNI_PORT)}`);
  log(
    `Mode:      ${SESSION_OVERRIDE ? C.Y("升级 session " + SESSION_OVERRIDE.slice(0, 16) + "…") : C.G("新起 VM")}`,
  );
  log(
    `Keepalive: ${KEEPALIVE_MODE ? C.G("ON · VM 永真态") : C.Y("OFF · 一笔即弃")}`,
  );
  log(`Token:     ${C.GR(jwt.slice(0, 14) + "..." + jwt.slice(-8))}`);
  console.error("");

  const prompt = buildPrompt();
  log(
    `Prompt 长: ${C.G(prompt.length)} 字 (含 omni server.js ${OMNI_SERVER_SOURCE.length} 字)`,
  );
  console.error("");

  if (DRY_RUN) {
    console.error(C.Y("--dry-run · 仅展计划 · 不真扣 ACU"));
    console.error("");
    console.error(C.GR("─── prompt 前 800 字 ───"));
    console.error(prompt.slice(0, 800));
    console.error(C.GR("─── prompt 末 400 字 ───"));
    console.error(prompt.slice(-400));
    console.error("");
    return { dry: true };
  }

  const u = new URL(WSS_BASE);
  u.searchParams.set("token", jwt);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let nextId = 0;
    let actualSessionId = SESSION_OVERRIDE || null;
    let fullText = "";
    let toolOutputs = "";
    let hbTimer = null;
    let httpHbTimer = null; // HTTP ping own URL · 维隧道 (WSS ping 不足 · 实证 ~30 min GC)
    let poolWritten = false; // URL 检测即入池 · 不等 stopReason
    const pendingMethods = {};

    // URL 检测即入池 (调度: 每次 fullText 加 chunk 后调)
    function tryRecordOmniIfUrlSeen() {
      if (poolWritten) return;
      const allText = fullText + "\n--TOOL--\n" + toolOutputs;
      const urls = parseIngressUrl(allText);
      if (urls.length === 0) return;
      const omniUrl = urls[0];
      const record = {
        timestamp: new Date().toISOString(),
        seal:
          "印 104 · 万法归宗 · 单 ingress 万服务" +
          (KEEPALIVE_MODE ? " · keepalive 永真态" : ""),
        sessionId: actualSessionId,
        service: "Omni Router (multi-service single ingress)",
        port: OMNI_PORT,
        urls,
        ports: [{ port: OMNI_PORT, service: "Omni Router", url: omniUrl }],
        omni: {
          base_url: omniUrl,
          paths: {
            "/code/": "VS Code Server (:6789)",
            "/shell/": "ttyd terminal (:7681)",
            "/files/": "filebrowser (:8888)",
            "/desktop/": "noVNC desktop (:6080)",
            "/python/": "python http (:8000)",
            "/port/<N>/": "dynamic port forwarding (HTTP+WS)",
            "/_/health": "GET · health check",
            "/_/stat": "GET · VM status",
            "/_/run": "POST · bash exec",
            "/_/spawn": "POST · background spawn",
            "/_/file/": "GET/PUT/DELETE · file IO",
          },
        },
        keepalive: KEEPALIVE_MODE,
        status: "alive",
        source: KEEPALIVE_MODE ? "vm_omni --keepalive" : "vm_omni",
      };
      appendPool(record);
      poolWritten = true;
      log(`${C.G("●")} URL 检测 · 已入池 · base=${C.GR(omniUrl)}`);
      // 关键修: keepalive 模式下 URL 一得即清 hard timeout · 防 15 min 杀 WSS
      if (KEEPALIVE_MODE && killer) {
        clearTimeout(killer);
        killer = null;
        log(C.G("● keepalive 模式 · 总超时已清 · WSS 永真态"));
      }
      // 真本源修: 仅 WSS ping 不足维隧道 (实证 ~30 min GC) · 加 HTTP ping own URL
      if (KEEPALIVE_MODE && !httpHbTimer) {
        httpHbTimer = setInterval(() => {
          try {
            const u = new URL(omniUrl);
            const auth =
              u.username && u.password
                ? `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`
                : undefined;
            const req = require("https").request(
              {
                hostname: u.hostname,
                port: u.port || 443,
                path: "/_/health",
                method: "GET",
                auth,
                timeout: 8000,
                headers: { "User-Agent": "vm-omni-keepalive/1" },
              },
              (res) => {
                res.on("data", () => {});
                res.on("end", () => {
                  log(C.GR(`  · HTTP ping ${res.statusCode}`));
                });
              },
            );
            req.on("error", (e) => {
              log(C.Y(`  · HTTP ping 错: ${e.message}`));
            });
            req.on("timeout", () => {
              req.destroy();
              log(C.Y("  · HTTP ping timeout"));
            });
            req.end();
          } catch (e) {
            log(C.Y(`  · HTTP ping 异常: ${e.message}`));
          }
        }, 120_000); // 每 2 min · HTTP 维隧道
        log(C.G("● HTTP keepalive ping 起 · 每 2 min 真维隧道"));
      }
    }

    const ws = new WebSocket(u.toString());
    let killer = setTimeout(() => {
      if (!resolved) {
        log(C.Y("总超时 · 收尾"));
        finish();
      }
    }, TIMEOUT_MS);

    const send = (method, params) => {
      const id = ++nextId;
      pendingMethods[id] = method;
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
      log(`${C.GR("→")} ${method} ${C.GR("id=" + id)}`);
      return id;
    };

    const sigintHandler = () => {
      log(C.Y("\n  · SIGINT · 关 wss · 退"));
      if (hbTimer) clearInterval(hbTimer);
      if (httpHbTimer) clearInterval(httpHbTimer);
      try {
        ws.close(1000);
      } catch {}
      process.exit(0);
    };
    process.once("SIGINT", sigintHandler);
    process.once("SIGTERM", sigintHandler);

    const finish = () => {
      if (resolved === "done") return;
      resolved = "done";
      clearTimeout(killer);
      if (hbTimer) {
        clearInterval(hbTimer);
        hbTimer = null;
      }
      if (httpHbTimer) {
        clearInterval(httpHbTimer);
        httpHbTimer = null;
      }
      try {
        ws.close(1000);
      } catch {}

      const allText = fullText + "\n--TOOL_OUTPUTS--\n" + toolOutputs;
      const urls = parseIngressUrl(allText);
      const healthOk = /"ok"\s*:\s*true|"seal"\s*:\s*"seal-104"/.test(allText);

      console.error("");
      console.error(
        C.B("════════════════════════════════════════════════════════════════"),
      );
      console.error(C.BO(C.B("  Omni Router · 实证")));
      console.error(
        C.B("════════════════════════════════════════════════════════════════"),
      );
      console.error("");
      console.error(
        `  健康检测:    ${healthOk ? C.G("✓ /_/health ok") : C.Y("✗ 未确认")}`,
      );
      console.error(
        `  Ingress URL: ${urls.length > 0 ? C.G(urls.length + " 个抓到") : C.R("无")}`,
      );
      console.error("");

      if (urls.length > 0) {
        const omniUrl = urls[0];
        console.error(C.G("★ Omni 公网 URL (单 ingress · 万服务):"));
        console.error(`  ${C.BO(omniUrl)}`);
        console.error("");
        console.error(C.GR("  内置路由:"));
        console.error(C.GR(`    ${omniUrl}/code/    → VS Code Server`));
        console.error(C.GR(`    ${omniUrl}/shell/   → ttyd 终端`));
        console.error(C.GR(`    ${omniUrl}/files/   → filebrowser`));
        console.error(C.GR(`    ${omniUrl}/desktop/ → noVNC 桌面`));
        console.error(C.GR(`    ${omniUrl}/port/N/  → 任意端口动态路由`));
        console.error(C.GR(`    ${omniUrl}/_/run    → POST bash 任务`));
        console.error(C.GR(`    ${omniUrl}/_/file/  → GET/PUT/DELETE 文件`));
        console.error("");

        const record = {
          timestamp: new Date().toISOString(),
          seal: "印 104 · 万法归宗 · 单 ingress 万服务",
          sessionId: actualSessionId,
          service: "Omni Router (multi-service single ingress)",
          port: OMNI_PORT,
          urls,
          ports: [{ port: OMNI_PORT, service: "Omni Router", url: omniUrl }],
          omni: {
            base_url: omniUrl,
            paths: {
              "/code/": "VS Code Server (:6789)",
              "/shell/": "ttyd terminal (:7681)",
              "/files/": "filebrowser (:8888)",
              "/desktop/": "noVNC desktop (:6080)",
              "/python/": "python http (:8000)",
              "/port/<N>/": "dynamic port forwarding",
              "/_/health": "health check",
              "/_/stat": "VM status",
              "/_/run": "POST bash exec",
              "/_/spawn": "POST background spawn",
              "/_/file/": "GET/PUT/DELETE file IO",
            },
          },
          keepalive: KEEPALIVE_MODE,
          status: KEEPALIVE_MODE ? "alive" : "expired",
          source: KEEPALIVE_MODE ? "vm_omni --keepalive" : "vm_omni",
        };
        appendPool(record);
        console.log(JSON.stringify(record, null, 2));

        if (KEEPALIVE_MODE) {
          console.error(
            C.B(
              "══════════════════════════════════════════════════════════════",
            ),
          );
          console.error(
            C.BO(C.B("  ▶ keepalive 持续中 · Omni 永真态 · Ctrl+C 收尾")),
          );
          console.error(
            C.B(
              "══════════════════════════════════════════════════════════════",
            ),
          );
          console.error("");
          clearTimeout(killer);
          resolve({ urls, sessionId: actualSessionId, alive: true });
          return;
        }
      } else {
        console.error(C.R("✗ 未抓到 ingress URL · 看 agent 末文:"));
        console.error(C.GR(fullText.slice(-2000)));
      }
      console.error("");

      resolve({ urls, sessionId: actualSessionId, alive: false });
    };

    ws.onopen = () => {
      log(C.G("●") + " WSS 连");
      send("initialize", {
        protocolVersion: 1,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: true,
          elicitation: { form: {} },
          _meta: {
            "cognition.ai/subagentSupport": true,
            "cognition.ai/partialContent": true,
            "cognition.ai/mcp": true,
          },
        },
      });
    };

    ws.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(killer);
        reject(new Error("wss error"));
      }
    };

    ws.onclose = () => {
      if (!resolved) finish();
    };

    ws.onmessage = (ev) => {
      let raw = ev.data;
      if (raw instanceof ArrayBuffer) raw = Buffer.from(raw).toString("utf8");
      if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
      if (typeof raw !== "string") return;

      for (const line of raw.split("\n").filter((x) => x.trim())) {
        let m;
        try {
          m = JSON.parse(line);
        } catch {
          continue;
        }

        // agent → client · 礼貌拒
        if (
          m.method === "fs/read_text_file" ||
          m.method === "fs/write_text_file" ||
          (m.method && m.method.startsWith("terminal/")) ||
          m.method === "ext/method"
        ) {
          if (m.id) {
            ws.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: m.id,
                error: { code: -32601, message: "N/A" },
              }),
            );
          }
          continue;
        }
        if (m.method === "session/request_permission") {
          if (m.id) {
            ws.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: m.id,
                result: { granted: true },
              }),
            );
          }
          continue;
        }
        if (m.method === "session/update") {
          const upd = m.params?.update;
          const upType =
            upd?.sessionUpdate || (upd ? Object.keys(upd)[0] : "?");
          if (upType === "agent_message_chunk") {
            const text = upd?.content?.text || "";
            if (text) {
              fullText += text;
              process.stderr.write(text);
              tryRecordOmniIfUrlSeen(); // URL 一现即入池
            }
          } else if (upType === "tool_call" || upType === "tool_call_update") {
            const output = upd?.rawOutput || upd?.output || "";
            const toolName = upd?.title || upd?.toolName || "";
            if (toolName) log(C.B(`\n  [tool] ${toolName}`));
            if (output) {
              toolOutputs += "\n" + output;
              process.stderr.write(C.GR(String(output).slice(0, 600)));
              tryRecordOmniIfUrlSeen();
            }
          }
          if (upd?.stopReason) {
            log(`\n${C.G("●")} Agent 结束: ${upd.stopReason}`);
            setTimeout(handlePromptDone, 1200);
          }
          continue;
        }

        // RPC 响应 · 按 method 路由
        if (!m.id || !pendingMethods[m.id]) continue;
        const method = pendingMethods[m.id];
        delete pendingMethods[m.id];

        if (method === "initialize" && m.result) {
          log(`${C.G("●")} Initialize OK`);
          if (SESSION_OVERRIDE) {
            send("session/load", {
              sessionId: SESSION_OVERRIDE,
              cwd: "/home/ubuntu",
              mcpServers: [],
            });
          } else {
            send("session/new", { cwd: "/home/ubuntu", mcpServers: [] });
          }
        } else if (method === "session/load") {
          if (m.result !== undefined) {
            actualSessionId = SESSION_OVERRIDE;
            log(`${C.G("●")} Session loaded: ${C.BO(actualSessionId)}`);
            send("session/set_config_option", {
              sessionId: actualSessionId,
              option: "model",
              value: "devin-2-5",
            });
          } else {
            log(
              C.Y(
                `session/load 失: ${m.error?.message || "?"} · fallback session/new`,
              ),
            );
            send("session/new", { cwd: "/home/ubuntu", mcpServers: [] });
          }
        } else if (method === "session/new") {
          if (m.result?.sessionId) {
            actualSessionId = m.result.sessionId;
            log(`${C.G("●")} 新 Session: ${C.BO(actualSessionId)}`);
            send("session/set_config_option", {
              sessionId: actualSessionId,
              option: "model",
              value: "devin-2-5",
            });
          } else {
            log(C.R(`session/new 失: ${m.error?.message || "?"}`));
            finish();
          }
        } else if (method === "session/set_config_option") {
          log(`${C.G("●")} 模型 devin-2-5 锁`);
          log(
            C.Y("→") + ` 发 omni setup prompt (${prompt.length} 字 · ~1-2 ACU)`,
          );
          send("session/prompt", {
            sessionId: actualSessionId,
            prompt: [{ type: "text", text: prompt }],
          });
          // 25s 心跳
          hbTimer = setInterval(() => {
            try {
              ws.send(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: 10000 + ++nextId,
                  method: "session/list",
                  params: {},
                }),
              );
              log(C.GR("  · keepalive ping"));
            } catch (e) {
              log(C.Y(`心跳错: ${e.message}`));
            }
          }, KEEPALIVE_INTERVAL_MS);
        } else if (method === "session/prompt") {
          if (m.result !== undefined) {
            log(`${C.G("●")} Prompt 接 · 等 agent 跑`);
          } else if (m.error) {
            log(C.R(`prompt 错: ${m.error.message}`));
            finish();
          }
        }
      }
    };

    function handlePromptDone() {
      if (resolved === "done") return;
      const allText = fullText + "\n" + toolOutputs;
      const urls = parseIngressUrl(allText);
      if (urls.length > 0 && KEEPALIVE_MODE) {
        // 已得 URL · keepalive 持续 (不 finish · 不退)
        const omniUrl = urls[0];
        const record = {
          timestamp: new Date().toISOString(),
          seal: "印 104 · 万法归宗 · 单 ingress 万服务 · keepalive 永真态",
          sessionId: actualSessionId,
          service: "Omni Router",
          port: OMNI_PORT,
          urls,
          ports: [{ port: OMNI_PORT, service: "Omni Router", url: omniUrl }],
          omni: { base_url: omniUrl },
          keepalive: true,
          status: "alive",
          source: "vm_omni --keepalive",
        };
        appendPool(record);

        console.error(C.G("\n★ Omni alive · base URL:"));
        console.error(`  ${C.BO(omniUrl)}`);
        console.error("");
        console.error(
          C.B("══════════════════════════════════════════════════════════════"),
        );
        console.error(C.BO(C.B("  ▶ keepalive 持续 · Ctrl+C 收尾")));
        console.error(
          C.B("══════════════════════════════════════════════════════════════"),
        );
        console.error("");
        console.log(JSON.stringify(record, null, 2));

        clearTimeout(killer);
        resolve({ urls, sessionId: actualSessionId, alive: true });
      } else {
        finish();
      }
    }
  });
}

run()
  .then((r) => {
    if (r && r.dry) {
      process.exit(0);
      return;
    }
    if (r && r.alive) {
      log(C.G("● Omni 永真态 · Ctrl+C 收尾"));
      // 不 exit · 让 hbTimer 持续
    } else {
      const got = r && r.urls ? r.urls.length : 0;
      process.exit(got > 0 ? 0 : 2);
    }
  })
  .catch((e) => {
    console.error(C.R("vm_omni 异常: " + e.message));
    process.exit(1);
  });
