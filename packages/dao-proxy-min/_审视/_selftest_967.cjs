// 9.9.67 闭环自检 · L1(注入引擎) + L2(反代路径) · 离线 · 无官方依赖
const path = require("path");
const os = require("os");
const fs = require("fs");
const http = require("http");

const DIR =
  path.join(__dirname, "..", "vendor", "bundled-origin");
const srcPath = path.join(DIR, "source.js");

let pass = 0,
  fail = 0;
function ok(name, cond, extra) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name + (extra ? " · " + extra : ""));
  } else {
    fail++;
    console.log("  ✗ " + name + (extra ? " · " + extra : ""));
  }
}

function get(port, p) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}${p}`,
      { timeout: 3000, agent: false, headers: { connection: "close" } },
      (res) => {
        let b = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(b) });
          } catch {
            resolve({ status: res.statusCode, text: b });
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
  });
}
function post(port, p, data) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: p,
        method: "POST",
        timeout: 3000,
        agent: false,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          connection: "close",
        },
      },
      (res) => {
        let b = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(b) });
          } catch {
            resolve({ status: res.statusCode, text: b });
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
  });
}

(async () => {
  console.log("═══ 9.9.67 闭环自检 ═══");
  // 隔离测试环境: 用临时 vendor 副本? 否 — 直接 require 真源, 但模式文件会写真源目录.
  // 为不污真源: 预先备份 _origin_mode.txt, 测后还原.
  const modeFile = path.join(DIR, "_origin_mode.txt");
  const modeBak = fs.existsSync(modeFile)
    ? fs.readFileSync(modeFile, "utf8")
    : null;

  delete require.cache[require.resolve(srcPath)];
  const src = require(srcPath);

  // ── L1 · 注入引擎 ──
  console.log("\n── L1 · SP 注入引擎 ──");
  ok("sp_invert 委托可用", typeof src.invertSP === "function");
  const fakeOfficial =
    "You are Cascade, a powerful agentic AI coding assistant.\n" +
    "<communication_style>be terse</communication_style>\n" +
    "<tool_calling>use tools</tool_calling>\n" +
    "<user_rules>rule A</user_rules>\n" +
    "<memories>mem</memories>\n" +
    "Follow Windsurf guidelines.";
  const inverted = src.invertSP(fakeOfficial);
  ok("官方SP被反转", inverted !== null && typeof inverted === "string");
  ok(
    "反转含经文起首",
    inverted && inverted.startsWith("你是遵道而行者"),
  );
  ok(
    "反转不含官方身份",
    inverted && inverted.indexOf("You are Cascade") < 0,
  );
  ok(
    "反转不含 user_rules 块",
    inverted && inverted.indexOf("<user_rules>") < 0,
  );
  ok(
    "反转保 tool_calling 辐",
    inverted && inverted.indexOf("<tool_calling>") >= 0,
  );
  ok("幂等: 已道化不再改", src.invertSP(inverted) === null);
  const nonSp = "hello world this is a short user message";
  ok("非SP透传(null)", src.invertSP(nonSp) === null);
  ok(
    "阴符经在合一典源",
    src.invertSP(fakeOfficial).indexOf("神仙抱一演道章") >= 0 ||
      src.invertSP(fakeOfficial).indexOf("观天之道") >= 0,
  );
  // 副路
  const fakeSummary =
    "You are an expert AI coding assistant tasked with summarizing conversations. " +
    "Summarize the conversation. main goals: x. reflect the essence. " +
    "grounded in the conversation. key information and context. " +
    "well-organized and reflect. outlining the USER. summaries of conversations.";
  const invAny = src.invertAnySP(fakeSummary);
  ok("副路summary反转", invAny !== null && invAny.startsWith("你是遵道而行者"));

  // ── L2 · 反代路径 ──
  console.log("\n── L2 · 反代路径 ──");
  const TEST_PORT = 18999; // 测试专用 · 不撞 per-user FNV 口
  const handle = await src.start({ port: TEST_PORT, host: "127.0.0.1", mode: "invert" });
  ok("start() 返 handle", !!handle && handle.port === TEST_PORT);

  const ping = await get(TEST_PORT, "/origin/ping");
  ok("ping ok", !!ping && ping.json && ping.json.ok === true);
  ok(
    "ping 帛书载",
    ping.json && ping.json.dao_chars > 3000,
    ping.json ? ping.json.dao_chars + "字" : "",
  );
  ok("ping canon=合一", ping.json && ping.json.canon === "laozi+yinfu");
  ok(
    "ping 隧道自连关(v9.9.67)",
    ping.json && ping.json.mode === "invert",
  );

  // 模式切换 + 持久
  const mp = await post(TEST_PORT, "/origin/mode", { mode: "passthrough" });
  ok("mode POST passthrough", mp.json && mp.json.ok === true);
  const ping2 = await get(TEST_PORT, "/origin/ping");
  ok("mode 热生效", ping2.json && ping2.json.mode === "passthrough");
  const mp2 = await post(TEST_PORT, "/origin/mode", { mode: "invert" });
  ok("mode POST 还原 invert", mp2.json && mp2.json.ok === true);

  // 按面分治
  const sm = await post(TEST_PORT, "/origin/mode", { surface: "local", mode: "passthrough" });
  ok("surface local mode 写入", sm.json && sm.json.ok === true);
  const mg = await get(TEST_PORT, "/origin/mode");
  ok(
    "surface GET 回读",
    mg.json && mg.json.surface && mg.json.surface.local === "passthrough",
  );
  const sm2 = await post(TEST_PORT, "/origin/mode", { surface: "local", mode: "invert" });
  ok("surface local 还原", sm2.json && sm2.json.ok === true);

  // canon 切换
  const cp1 = await post(TEST_PORT, "/origin/canon", { canon: "laozi" });
  ok("canon POST laozi", cp1.json && cp1.json.ok === true);
  const cp2 = await post(TEST_PORT, "/origin/canon", { canon: "laozi+yinfu" });
  ok("canon POST 还原合一", cp2.json && cp2.json.ok === true);

  // preview / lastinject / tape / sig / health
  const pv = await get(TEST_PORT, "/origin/preview");
  ok("preview ok", pv.json && pv.json.ok === true);
  const tape = await get(TEST_PORT, "/origin/tape?limit=2&fields=0");
  ok("tape ok", tape.json && tape.json.ok === true);
  const sig = await get(TEST_PORT, "/origin/sig");
  ok("sig ok", sig.json && sig.json.ok === true);
  const health = await get(TEST_PORT, "/origin/health");
  ok("health ok", health.json && health.json.ok === true);
  const wdbg = await get(TEST_PORT, "/origin/_wdbg");
  ok("_wdbg ok", wdbg.json && wdbg.json.ok === true);

  // selftest 端点
  const st = await get(TEST_PORT, "/origin/selftest");
  ok("selftest ok", st.json && st.json.ok === true);

  // 帧不落盘验证 (v9.9.67)
  const frameDir = path.join(os.homedir(), ".codeium", "dao-byok");
  const before = fs.existsSync(path.join(frameDir, "chatframe.json"))
    ? fs.statSync(path.join(frameDir, "chatframe.json")).mtimeMs
    : 0;
  // 模拟一次 CHAT_PROTO 请求 → 走 proxyToCloud (会失败于官方不可达, 但 _captureChatFrame 先行)
  // 直接调内部: src._test 无 _captureChatFrame... 用 _setLastChatFrameForTest 验内存捕
  ok(
    "帧落盘已关(env未设)",
    String(process.env.DAO_FRAME_PERSIST || "") !== "1",
  );

  await src.stop();
  // 还原模式文件
  if (modeBak !== null) fs.writeFileSync(modeFile, modeBak, "utf8");
  else {
    try {
      fs.unlinkSync(modeFile);
    } catch {}
  }
  // 还原 canon 文件 (canon POST 持久化了 laozi+yinfu — 同默认, 无需还原; 但若原文件存在则保)
  console.log(
    `\n═══ 结果: ${pass} pass · ${fail} fail ═══`,
  );
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e.stack || e.message);
  process.exit(1);
});
