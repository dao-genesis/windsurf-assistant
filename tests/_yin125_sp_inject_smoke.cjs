#!/usr/bin/env node
// _yin125_sp_inject_smoke.cjs · 印 125 · 反者道之动 · SP 真注入实证
// 帛书·三十八:「居其厚不居其薄·居其实不居其华」
// 帛书·二十五:「大曰逝·逝曰远·远曰反」
// 主公诏 (2026-05-17 14:53):
//   「锚定本源之底层需求·代替我之一切·推进到极·太极笙万物·实现一切」
//   「物无非彼·物无非是·自彼则不见·自是则知之」
//
// 印 124 测 SP "号" (strategy 字段切换)
// 印 125 测 SP "实" (真 message 注入 · final messages dump)
// 反者道之动 — 由"号"返"实" · 居实不居华
"use strict";
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

// 印 131 · 中文路径 · 子进程承双旗 (圣人执一)
function __preserveFlags() {
  const flags = (process.execArgv || []).slice();
  for (const f of ["--preserve-symlinks", "--preserve-symlinks-main"]) {
    if (!flags.includes(f)) flags.push(f);
  }
  return flags;
}

const ROOT = path.resolve(__dirname, "..");
const DAO = path.join(ROOT, "packages", "dao-devin-vm", "dao_proxy.js");
const PORT = 17781,
  BIND = "127.0.0.1";
const AUTH = "yin125-test-3a8b1c4d-e5f6-4789-9abc-def012345678";

let pass = 0,
  fail = 0;
const fails = [];
const ok = (n) => {
  console.log(`  \x1b[32m✓\x1b[0m ${n}`);
  pass++;
};
const ng = (n, w) => {
  console.log(`  \x1b[31m✗\x1b[0m ${n} · ${w}`);
  fail++;
  fails.push(n + ": " + w);
};

function probe(method, urlPath, headers, body) {
  return new Promise((resolve) => {
    const opts = {
      hostname: BIND,
      port: PORT,
      path: urlPath,
      method,
      headers: Object.assign({}, headers || {}),
      timeout: 4000,
    };
    let payload = null;
    if (body !== undefined) {
      payload = Buffer.from(JSON.stringify(body), "utf8");
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = String(payload.length);
    }
    const req = http.request(opts, (res) => {
      const cs = [];
      res.on("data", (c) => cs.push(c));
      res.on("end", () => {
        const text = Buffer.concat(cs).toString("utf8");
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {}
        resolve({ status: res.statusCode, text, json });
      });
    });
    req.on("error", (e) => resolve({ err: e.message }));
    req.on("timeout", () => {
      try {
        req.destroy();
      } catch {}
      resolve({ err: "timeout" });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

const H = { Authorization: "Bearer " + AUTH };

// 简助手: dryrun + 验
async function dry(strategy, messages, extra) {
  return probe(
    "POST",
    "/v1/system/sp-dryrun",
    H,
    Object.assign({ strategy, messages }, extra || {}),
  );
}

function spawnDaemon() {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      PORT: String(PORT),
      BIND,
      DAO_AUTH_TOKEN: AUTH,
      WAM_FILE: path.join(__dirname, "_yin125_no_wam.json"),
      DEVIN_TOKEN: "",
      DEVIN_TOKENS: "",
      DAO_TOKENS_FILE: "",
      WS_TOKENS_FILE: path.join(__dirname, "_yin125_no_ws.txt"),
    });
    const child = spawn(process.execPath, [...__preserveFlags(), DAO], {
      env,
      cwd: path.dirname(DAO),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "",
      resolved = false;
    const tmr = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try {
        child.kill("SIGKILL");
      } catch {}
      reject(new Error("daemon timeout · " + stderr.slice(-300)));
    }, 8000);
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (!resolved && stderr.includes("起 · 道法自然")) {
        resolved = true;
        clearTimeout(tmr);
        setTimeout(() => resolve(child), 250);
      }
    });
    child.on("error", (e) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(tmr);
        reject(e);
      }
    });
    child.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(tmr);
        reject(
          new Error("daemon 早退 code=" + code + " · " + stderr.slice(-300)),
        );
      }
    });
  });
}

function killDaemon(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    child.once("exit", fin);
    try {
      child.kill(process.platform === "win32" ? "SIGTERM" : "SIGINT");
    } catch {}
    setTimeout(() => {
      if (!done) {
        try {
          child.kill("SIGKILL");
        } catch {}
        setTimeout(fin, 400);
      }
    }, 4500);
  });
}

const DAEMON_SP = "我是 dao_proxy 反代 · 道之代理";
const CUSTOM_SP = "印 125 · 反者道之动 · 自定 SP 真注入实证";

async function main() {
  console.log(
    "\n\x1b[1m═══ 印 125 · 反者道之动 · SP 真注入实证守门 ═══\x1b[0m",
  );
  console.log("\x1b[90m帛书·三十八:「居其厚不居其薄·居其实不居其华」\x1b[0m");
  console.log("\x1b[90m主公诏:「锚定本源底层·代替我之一切·推进到极」\x1b[0m\n");

  console.log("\x1b[1m[一] 真起 daemon (端 " + PORT + ")\x1b[0m");
  let child;
  try {
    child = await spawnDaemon();
    ok(`daemon spawn pid=${child.pid}`);
  } catch (e) {
    ng("daemon spawn", e.message);
    console.log("\n\x1b[31m✗ 一气未起\x1b[0m");
    process.exit(1);
  }

  try {
    // ── ② 设 daemon SP 状态 (globalSp + customSp + 三 strip toggle 启) ──
    console.log(
      "\n\x1b[1m[二] 设 daemon 状态 (globalSp · customSp · strip 三启)\x1b[0m",
    );
    const setG = await probe("POST", "/v1/system/prompt", H, {
      globalSp: DAEMON_SP,
    });
    if (setG.status === 200) ok("globalSp 设");
    else ng("globalSp 设", "status=" + setG.status);

    const setC = await probe("POST", "/v1/system/prompt", H, {
      customSp: CUSTOM_SP,
    });
    if (setC.status === 200) ok("customSp 设");
    else ng("customSp 设", "status=" + setC.status);

    const setOpts = await probe("POST", "/v1/system/prompt", H, {
      opts: {
        stripSideChannels: true,
        stripMemoryBlocks: true,
        neutralizeOverrides: true,
      },
    });
    if (setOpts.status === 200) ok("opts 三 strip 启");
    else ng("opts 三 strip 启", "status=" + setOpts.status);

    // ── ③ dryrun 入参验 ──
    console.log(
      "\n\x1b[1m[三] dryrun 入参守 (无 messages → 400 · 非法 strategy → 400)\x1b[0m",
    );
    const r400a = await probe("POST", "/v1/system/sp-dryrun", H, {
      strategy: "dao",
    });
    if (r400a.status === 400) ok("无 messages → 400");
    else ng("无 messages → 400", "实 " + r400a.status);
    const r400b = await dry("yin-fake", [{ role: "user", content: "hi" }]);
    if (r400b.status === 400 && Array.isArray(r400b.json?.allowed))
      ok(`非法 strategy → 400 allowed=${r400b.json.allowed.length}`);
    else ng("非法 strategy → 400", "实 " + r400b.status);

    // ── ④ bypass · 客 SP 原透 (无 daemonSp 加) ──
    console.log("\n\x1b[1m[四] bypass · 客端原透 (主公诏 SP §1)\x1b[0m");
    const r1 = await dry("bypass", [
      { role: "system", content: "client-sp-原" },
      { role: "user", content: "hi" },
    ]);
    if (r1.status === 200 && r1.json?.output?.messages?.length === 2) {
      const sys = r1.json.output.messages[0];
      if (sys.role === "system" && sys.content === "client-sp-原")
        ok("bypass · 客 SP 原透");
      else ng("bypass · 客 SP", `sys.content=${sys.content?.slice(0, 40)}`);
      if (r1.json.output.meta.strategy === "bypass")
        ok("bypass · meta.strategy=bypass");
      else ng("bypass meta", "strategy=" + r1.json.output.meta.strategy);
    } else ng("bypass dryrun", "status=" + r1.status);

    // 无 system msg 之 bypass · output 不应 inject
    const r1b = await dry("bypass", [{ role: "user", content: "hi" }]);
    if (
      r1b.json?.output?.messages?.length === 1 &&
      r1b.json.output.messages[0].role === "user"
    )
      ok("bypass · 无客 SP 时 · 不注入");
    else
      ng(
        "bypass 无客 SP",
        "msgs=" +
          JSON.stringify(r1b.json?.output?.messages?.map((m) => m.role)),
      );

    // ── ⑤ dao · 帛书真注入 (主公诏 SP §dao) ──
    console.log(
      "\n\x1b[1m[五] dao · 帛书《老子》真注入 (主公诏②隔离提示词)\x1b[0m",
    );
    const r2 = await dry("dao", [{ role: "user", content: "道可道乎?" }]);
    if (r2.status === 200) {
      const sys = r2.json.output.messages.find((m) => m.role === "system");
      if (sys && sys.content?.length > 5000)
        ok(`dao · sys 注入 ${sys.content.length} 字 (≥5000)`);
      else ng("dao sys 长", "len=" + (sys?.content?.length || 0));
      if (sys?.content?.includes("请以下文《老子》之思想风格"))
        ok("dao · 含 TAO_HEADER 头");
      else ng("dao TAO_HEADER", "缺");
      if (sys?.content?.includes("反者") || sys?.content?.includes("道可道"))
        ok("dao · 含帛书真句");
      else ng("dao 帛书句", "缺");
      if (sys?.content?.includes("以上为风格指引"))
        ok("dao · 含 TAO_TRAILER 尾");
      else ng("dao TAO_TRAILER", "缺");
    } else ng("dao dryrun", "status=" + r2.status);

    // ── ⑥ usernote · §3.17 合法槽 (用户笔下) ──
    console.log("\n\x1b[1m[六] usernote · §3.17 合法槽 (主公诏②)\x1b[0m");
    const r3 = await dry("usernote", [{ role: "user", content: "请助我" }]);
    if (r3.status === 200) {
      const u = r3.json.output.messages.find((m) => m.role === "user");
      if (u?.content?.includes('<note name="dao-priority"'))
        ok('usernote · 注入 <note name="dao-priority">');
      else
        ng("usernote note 注入", "u.content head=" + u?.content?.slice(0, 60));
      if (u?.content?.includes(DAEMON_SP)) ok("usernote · 含 globalSp 内容");
      else ng("usernote globalSp", "缺");
      const sys = r3.json.output.messages.find((m) => m.role === "system");
      if (!sys) ok("usernote · 无 system msg (合法槽 ≠ system)");
      else ng("usernote · 有 system", "应无");
      if (r3.json.output.meta.usernoteInjected > 0)
        ok(
          `usernote · meta.usernoteInjected=${r3.json.output.meta.usernoteInjected}`,
        );
      else ng("usernote meta", "应 > 0");
    } else ng("usernote dryrun", "status=" + r3.status);

    // ── ⑦ prepend / append / override ──
    console.log("\n\x1b[1m[七] prepend / append / override · 三合方略\x1b[0m");
    const r4 = await dry("prepend", [
      { role: "system", content: "客SP" },
      { role: "user", content: "hi" },
    ]);
    const r4sys = r4.json?.output?.messages?.find((m) => m.role === "system");
    if (r4sys?.content === DAEMON_SP + "\n\n客SP")
      ok("prepend · daemon + 客 (帛书三十六:友弱胜强)");
    else ng("prepend", "sys=" + r4sys?.content?.slice(0, 60));

    const r5 = await dry("append", [
      { role: "system", content: "客SP" },
      { role: "user", content: "hi" },
    ]);
    const r5sys = r5.json?.output?.messages?.find((m) => m.role === "system");
    if (r5sys?.content === "客SP\n\n" + DAEMON_SP) ok("append · 客 + daemon");
    else ng("append", "sys=" + r5sys?.content?.slice(0, 60));

    const r6 = await dry("override", [
      { role: "system", content: "客SP" },
      { role: "user", content: "hi" },
    ]);
    const r6sys = r6.json?.output?.messages?.find((m) => m.role === "system");
    if (r6sys?.content === DAEMON_SP)
      ok("override · daemon 替客 (帛书四十:反者道之动)");
    else ng("override", "sys=" + r6sys?.content?.slice(0, 60));

    // ── ⑧ custom ──
    console.log("\n\x1b[1m[八] custom · 自定 SP\x1b[0m");
    const r7 = await dry("custom", [{ role: "user", content: "hi" }]);
    const r7sys = r7.json?.output?.messages?.find((m) => m.role === "system");
    if (r7sys?.content === CUSTOM_SP) ok("custom · 自定 SP 真注入");
    else ng("custom", "sys=" + r7sys?.content?.slice(0, 60));

    // ── ⑨ strip 三步 (主公诏②隔离提示词) ──
    console.log(
      "\n\x1b[1m[九] strip 三步 · 隔离一切提示词污染 (主公诏②)\x1b[0m",
    );
    const polluted =
      '<workspace_layout>污1</workspace_layout>真\n<MEMORY[abc]>污2</MEMORY[abc]>\n{"mode":"SECTION_OVERRIDE_MODE_FOO","content":"污3"}';
    const r8 = await dry("bypass", [{ role: "user", content: polluted }]);
    if (r8.status === 200) {
      const u = r8.json.output.messages.find((m) => m.role === "user");
      if (!u?.content?.includes("<workspace_layout>"))
        ok("stripSide · 移除 <workspace_layout>");
      else ng("stripSide", "未移");
      if (!u?.content?.includes("<MEMORY[")) ok("stripMem · 移除 <MEMORY[]>");
      else ng("stripMem", "未移");
      if (!u?.content?.includes("污3") || u?.content?.includes("道法自然"))
        ok("neutralize · SECTION_OVERRIDE 中和 (帛书一:道法自然)");
      else ng("neutralize", "未中和");
      if (u?.content?.includes("真")) ok("strip · 真内容保留");
      else ng("strip 真", "丢");
      if (r8.json.output.meta.strippedSide >= 1)
        ok(`meta.strippedSide=${r8.json.output.meta.strippedSide}`);
      else ng("meta strippedSide", "应 ≥ 1");
      if (r8.json.output.meta.strippedMem >= 1)
        ok(`meta.strippedMem=${r8.json.output.meta.strippedMem}`);
      else ng("meta strippedMem", "应 ≥ 1");
    } else ng("strip dryrun", "status=" + r8.status);

    // ── ⑩ dryrun 不动 SP_STATE 持久 (反者道之动 · 不污) ──
    console.log(
      "\n\x1b[1m[十] dryrun 不动 SP_STATE 持久 (帛书六十四:无执故无失)\x1b[0m",
    );
    // 当前 SP_STATE.strategy 在 ② 之后是 "bypass" (默) · 验之
    const stateBefore = await probe("GET", "/v1/system/prompt", H);
    const stratBefore = stateBefore.json?.strategy;
    // dryrun 临时切 dao
    await dry("dao", [{ role: "user", content: "hi" }]);
    const stateAfter = await probe("GET", "/v1/system/prompt", H);
    const stratAfter = stateAfter.json?.strategy;
    if (stratBefore === stratAfter)
      ok(`dryrun 不动持久 · before=${stratBefore} after=${stratAfter}`);
    else ng("dryrun 持久", `before=${stratBefore} after=${stratAfter}`);

    // ── ⑪ 三协议端点真路由 (无 token 时返 50x · 不 500) ──
    console.log(
      "\n\x1b[1m[十一] 三协议真路由 (无 token 真返 5xx · 信言不美 帛书八十一)\x1b[0m",
    );
    const tri = [
      {
        name: "OpenAI",
        method: "POST",
        path: "/v1/chat/completions",
        body: {
          model: "devin-cloud",
          messages: [{ role: "user", content: "hi" }],
        },
      },
      {
        name: "Anthropic",
        method: "POST",
        path: "/v1/messages",
        body: {
          model: "devin-cloud",
          max_tokens: 64,
          messages: [{ role: "user", content: "hi" }],
        },
      },
      {
        name: "Gemini",
        method: "POST",
        path: "/v1beta/models/devin-cloud:generateContent",
        body: { contents: [{ role: "user", parts: [{ text: "hi" }] }] },
      },
    ];
    for (const t of tri) {
      const r = await probe(t.method, t.path, H, t.body);
      // 无 token · 三协议都应至少不 500 panic · 返 200 SSE 错或 503/502/401 都 OK
      if (r.status >= 200 && r.status < 600 && r.status !== 500)
        ok(`${t.name} → ${r.status} (路由通 · 不 500)`);
      else ng(`${t.name}`, `status=${r.status}`);
    }
  } finally {
    console.log("\n\x1b[1m[十二] 真关 daemon\x1b[0m");
    await killDaemon(child);
    ok("daemon 关停");
  }

  console.log(
    "\n\x1b[1m═══ 印 125 总: \x1b[32m" +
      pass +
      " 过\x1b[0m\x1b[1m / \x1b[31m" +
      fail +
      " 失\x1b[0m\x1b[1m ═══\x1b[0m",
  );
  if (fail > 0) {
    console.log("\n\x1b[31m失项:\x1b[0m");
    fails.forEach((f) => console.log("  · " + f));
    process.exit(1);
  } else {
    console.log(
      "\n\x1b[32m✓ SP 真注入实证通 · 反者道之动 · 居实不居华 · 道法自然\x1b[0m",
    );
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("\x1b[31m✗ 主跑异:\x1b[0m", e.stack || e.message);
  process.exit(2);
});
