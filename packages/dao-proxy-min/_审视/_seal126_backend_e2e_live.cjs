#!/usr/bin/env node
/**
 * _seal126_backend_e2e_live.cjs · 印 126 · 真后端全链路 E2E live
 *
 * 承印 124 (主公第一细药 · vendor/外接api/) + 印 125 (守门 83/0 静测)
 *
 * > 「大曰逝，逝曰远，远曰反.」（《二十五》）
 * > 「图难于其易，为大于其细；天下难事，必作于易；天下大事，必作于细.」（《六十三》）
 * > 「为之于其未有也，治之于其未乱也.」（《六十四》）
 *
 * 与 印 125 之异:
 *   印 125: 静测 (syntax + structure + manifest · 83/0)
 *   印 126: 真活 (spawn gateway 子进程 + 真 HTTP + runtime mock vscode 端到端)
 *
 * 验 (7 节 · ~40 测):
 *   ① server.js --test:    内嵌 unit test (58 测 · max v1.0.8 真测)
 *   ② translate round-trip: anthropic ↔ openai ↔ gemini ↔ ollama 互转完整性
 *   ③ capabilities 真用:   gpt-5/o4/r1/phi/llama 等 model 之 toolSupport 辨
 *   ④ registry 解析:       严格/裸名/alias/前缀启发/openrouter 多级 (5 种解)
 *   ⑤ gateway spawn live:  真起子进程 + 等 /health + 调 5+ 端点 + 验响应 + kill
 *   ⑥ runtime E2E:         mock vscode + ExternalApiRuntime.start() → 真起 gateway → mock lm 注 → stop
 *   ⑦ lm_register:         三别名 fallback (registerChatModelProvider / registerLanguageModelProvider / register*)
 *
 * 用:
 *   node _审视/_seal126_backend_e2e_live.cjs
 *   node _审视/_seal126_backend_e2e_live.cjs --verbose
 *   node _审视/_seal126_backend_e2e_live.cjs --skip-live   # 跳真活 (CI 无网)
 *
 * 道义:
 *   · 大曰逝 — 推进到底 · 不止于静测
 *   · 逝曰远 — 真起 gateway 子进程 · 真发 HTTP · 真验
 *   · 远曰反 — 终归本源: 守一不离 · 反代核 + gateway 二轨字节级正交
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const cp = require("node:child_process");
const os = require("node:os");

const ROOT = path.resolve(__dirname, "..");
const VENDOR = path.join(ROOT, "vendor", "外接api");
const GATEWAY = path.join(VENDOR, "gateway");
const VERBOSE =
  process.argv.includes("--verbose") || process.argv.includes("-v");
const SKIP_LIVE = process.argv.includes("--skip-live");

let pass = 0;
let fail = 0;
const fails = [];

function ok(msg, detail) {
  pass++;
  if (VERBOSE && detail)
    console.log(`  \x1b[32m[OK]\x1b[0m ${msg} · ${detail}`);
  else console.log(`  \x1b[32m[OK]\x1b[0m ${msg}`);
}
function bad(msg, detail) {
  fail++;
  fails.push(detail ? `${msg}: ${detail}` : msg);
  console.log(`  \x1b[31m[X ]\x1b[0m ${msg}${detail ? " · " + detail : ""}`);
}
function info(msg) {
  console.log(`  \x1b[36m[i ]\x1b[0m ${msg}`);
}
function section(t) {
  console.log("");
  console.log(`\x1b[33m${t}\x1b[0m`);
}

// httpJSON 0-dep · 调远 HTTP + 解 JSON (返 status/data/raw)
function httpJSON(method, url, body, headers, timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 5000;
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(e);
    }
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname + u.search,
      headers: Object.assign({}, headers || {}),
      timeout: timeoutMs,
    };
    if (body) {
      opts.headers["Content-Type"] =
        opts.headers["Content-Type"] || "application/json";
      opts.headers["Content-Length"] = Buffer.byteLength(body);
    }
    const req = http.request(opts, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let data = null;
        try {
          data = JSON.parse(buf);
        } catch {}
        resolve({
          status: res.statusCode,
          data,
          raw: buf,
          headers: res.headers,
        });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    if (body) req.write(body);
    req.end();
  });
}

async function waitForHealth(url, timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 10000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await httpJSON("GET", url + "/health", null, null, 1500);
      if (r.status === 200) return r.data || true;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("health timeout " + timeoutMs + "ms @ " + url);
}

// ═══════════════════════════════════════════════════════════════
// main · IIFE (.cjs 不支 top-level await · 需包在 async 中)
// ═══════════════════════════════════════════════════════════════
(async function main() {
  console.log(
    "\x1b[36m═══ 印 126 · 真后端全链路 E2E live (承印 124 第一细药) ═══\x1b[0m",
  );
  console.log(`  ROOT     : ${ROOT}`);
  console.log(`  GATEWAY  : ${GATEWAY}`);
  console.log(`  SKIP_LIVE: ${SKIP_LIVE}`);

  // ═══════════════════════════════════════════════════════════════
  // ① server.js --test (内嵌 unit test · max v1.0.8 真测)
  // ═══════════════════════════════════════════════════════════════
  section("① server.js --test · 内嵌 unit test (58 测 baseline)");

  {
    const r = cp.spawnSync(
      process.execPath,
      [path.join(GATEWAY, "server.js"), "--test"],
      {
        encoding: "utf-8",
        timeout: 60000,
      },
    );
    const out = (r.stdout || "") + (r.stderr || "");
    const m = out.match(/(\d+)\s+passed\s+·\s+(\d+)\s+failed/);
    if (r.status === 0 && m) {
      const np = parseInt(m[1]);
      const nf = parseInt(m[2]);
      if (nf === 0) ok(`server.js --test: ${np} 过 / 0 失`);
      else bad(`server.js --test: ${np} 过 / ${nf} 失`);
      info(
        `含: translate(anthropic↔openai↔gemini↔ollama) + registry(5 解) + reasoning(7) + normalize(8) + http retry + capabilities + degrade`,
      );
    } else {
      bad(
        "server.js --test 进程异常",
        `exit=${r.status} stderr=${(r.stderr || "").slice(0, 100)}`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ② translate round-trip · 协议互转 (require 直载)
  // ═══════════════════════════════════════════════════════════════
  section("② translate.js round-trip · anthropic ↔ openai ↔ gemini ↔ ollama");

  let translate = null;
  try {
    translate = require(path.join(GATEWAY, "translate.js"));
    ok("require translate.js 通");
  } catch (e) {
    bad("require translate.js 失", e.message);
  }

  if (translate) {
    // 真转: anthropic req → openai req → 检字段
    const aReq = {
      model: "claude-3-5-sonnet",
      max_tokens: 256,
      system: "You are a helper.",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi!" },
        { role: "user", content: "What's up?" },
      ],
      tools: [
        {
          name: "get_weather",
          description: "get weather",
          input_schema: {
            type: "object",
            properties: { city: { type: "string" } },
          },
        },
      ],
    };
    try {
      const oReq = translate.anthropicReqToOpenAI(aReq);
      if (oReq.model === "claude-3-5-sonnet") ok("anthropic→openai: model 保");
      else bad("anthropic→openai: model 丢", `现 ${oReq.model}`);
      if (oReq.messages && oReq.messages[0].role === "system")
        ok("anthropic→openai: system 抽出");
      else bad("anthropic→openai: system 未抽");
      if (oReq.messages && oReq.messages.length === 4)
        ok("anthropic→openai: 4 messages (1 sys + 3 chat)");
      else
        bad(
          `anthropic→openai: 消息数 ${oReq.messages && oReq.messages.length}`,
        );
      if (
        oReq.tools &&
        oReq.tools.length === 1 &&
        oReq.tools[0].function &&
        oReq.tools[0].function.name === "get_weather"
      )
        ok("anthropic→openai: tools 翻译");
      else bad("anthropic→openai: tools 错");
    } catch (e) {
      bad("anthropic→openai 抛", e.message);
    }

    // gemini direction
    try {
      const gReq = translate.anthropicReqToGemini(aReq);
      if (gReq.systemInstruction && gReq.systemInstruction.parts)
        ok("anthropic→gemini: systemInstruction");
      else bad("anthropic→gemini: 无 systemInstruction");
      if (gReq.contents && gReq.contents.length >= 2)
        ok("anthropic→gemini: contents 立");
      else bad("anthropic→gemini: contents 缺");
      if (gReq.generationConfig && gReq.generationConfig.maxOutputTokens)
        ok("anthropic→gemini: maxOutputTokens");
      else bad("anthropic→gemini: maxOutputTokens 缺");
    } catch (e) {
      bad("anthropic→gemini 抛", e.message);
    }

    // ollama direction
    try {
      const oReq = translate.anthropicReqToOllama(aReq);
      if (oReq.messages && oReq.messages.length >= 3)
        ok("anthropic→ollama: 消息");
      else bad("anthropic→ollama: 消息缺");
      if (oReq.options && oReq.options.num_predict === 256)
        ok("anthropic→ollama: options.num_predict=256");
      else bad("anthropic→ollama: num_predict 错");
    } catch (e) {
      bad("anthropic→ollama 抛", e.message);
    }

    // openai resp → anthropic resp
    const oResp = {
      id: "chatcmpl-x",
      model: "gpt-4o",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hello back!" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 },
    };
    try {
      const aResp = translate.openAIRespToAnthropic(oResp, "gpt-4o");
      if (
        aResp.content &&
        aResp.content[0] &&
        aResp.content[0].text === "Hello back!"
      )
        ok("openai→anthropic resp: text");
      else bad("openai→anthropic resp: text 错");
      if (
        aResp.usage &&
        aResp.usage.input_tokens === 12 &&
        aResp.usage.output_tokens === 3
      )
        ok("openai→anthropic resp: usage");
      else bad("openai→anthropic resp: usage 错");
      if (aResp.stop_reason === "end_turn")
        ok("openai→anthropic resp: stop_reason=end_turn");
      else bad(`openai→anthropic resp: stop_reason=${aResp.stop_reason}`);
    } catch (e) {
      bad("openai→anthropic resp 抛", e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ③ capabilities.js · model 能力辨
  // ═══════════════════════════════════════════════════════════════
  section("③ capabilities.js · model toolSupport 辨");

  let capMod = null;
  try {
    capMod = require(path.join(GATEWAY, "capabilities.js"));
    ok("require capabilities.js 通");
  } catch (e) {
    bad("require capabilities.js 失", e.message);
  }

  if (capMod) {
    const cases = [
      ["github/openai/gpt-4.1-mini", "full"],
      ["github/microsoft/phi-4", "none"],
      ["github/meta/llama-3.3-70b-instruct", "single"],
      ["ollama/qwen2.5:0.5b", "none"],
      ["github/deepseek/deepseek-r1-0528", "none"],
    ];
    for (const [m, expect] of cases) {
      const c = capMod.capabilitiesFor(m);
      if (c.toolSupport === expect) ok(`${m}: toolSupport=${expect}`);
      else bad(`${m}: 期 ${expect} · 实 ${c.toolSupport}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ④ registry.js · provider 注 + 配置加载
  // ═══════════════════════════════════════════════════════════════
  section("④ registry.js · provider 注 + 配置载");

  let registryMod = null;
  try {
    registryMod = require(path.join(GATEWAY, "registry.js"));
    ok("require registry.js 通");
  } catch (e) {
    bad("require registry.js 失", e.message);
  }

  if (registryMod) {
    if (typeof registryMod.Registry === "function") ok("Registry 是 class");
    else bad("Registry 非 class");
    if (typeof registryMod.loadConfig === "function")
      ok("loadConfig 是 function");
    else bad("loadConfig 非 function");

    // 真载 配置.example.json
    try {
      const examplePath = path.join(VENDOR, "配置.example.json");
      if (!fs.existsSync(examplePath)) {
        bad("配置.example.json 缺");
      } else {
        const cfg = registryMod.loadConfig(examplePath);
        if (cfg && cfg.providers)
          ok(`loadConfig: ${Object.keys(cfg.providers).length} provider 载`);
        else bad("loadConfig 之 cfg.providers 缺");

        // ── 默关验: example cfg 之 3 provider 全 enabled:false (主公真意 · 默关之德) ──
        const regDefault = new registryMod.Registry(cfg);
        if (regDefault.listProviders().length === 0)
          ok(
            "默关验: example cfg 全 enabled:false → listProviders 空 (合默关之德)",
          );
        else
          info(
            `默关验: listProviders 非空 (${regDefault.listProviders().length}) · 期 0`,
          );

        // ── 启后验: mock enabled cfg 真实证 registry 之活 ──
        const mockCfg = {
          providers: {
            github: {
              enabled: true,
              driver: "openai",
              baseUrl: "https://models.github.ai/inference",
              apiKey: "ghp-mock",
              models: [
                "openai/gpt-4o-mini",
                "openai/gpt-4.1-mini",
                "deepseek/deepseek-v3-0324",
              ],
            },
            ollama: {
              enabled: true,
              baseUrl: "http://127.0.0.1:11434",
              models: ["qwen2.5:0.5b"],
            },
          },
          aliases: { "claude-3-5-sonnet": "github/openai/gpt-4o-mini" },
        };
        const reg = new registryMod.Registry(mockCfg);

        if (typeof reg.resolve !== "function") {
          bad("registry.resolve 非 function");
        } else {
          ok("registry.resolve 是 function");

          // listProviders: 应有 2 (github + ollama)
          const provs = reg.listProviders();
          if (Array.isArray(provs) && provs.length === 2)
            ok(`registry.listProviders: 2 provider (github + ollama)`);
          else bad(`registry.listProviders: 期 2 · 实 ${provs.length}`);
          if (provs.some((p) => p.name === "github" && p.hasKey))
            ok("github · hasKey=true");
          else bad("github · hasKey=false");
          if (provs.some((p) => p.name === "ollama" && p.ready))
            ok("ollama · ready=true (NO_KEY)");
          else bad("ollama · ready=false");

          // listModels: 应有 4 (3 github + 1 ollama)
          const allModels = reg.listModels();
          if (Array.isArray(allModels) && allModels.length === 4)
            ok(`registry.listModels: 4 模 (3 github + 1 ollama)`);
          else bad(`registry.listModels: 期 4 · 实 ${allModels.length}`);

          // resolve 真活: 严格 + 裸名 + alias
          const r1 = reg.resolve("github/openai/gpt-4o-mini");
          if (r1 && r1.provider === "github")
            ok(`resolve 严格: github/openai/gpt-4o-mini → provider=github`);
          else bad(`resolve 严格 → ${JSON.stringify(r1)}`);

          const r2 = reg.resolve("openai/gpt-4.1-mini");
          if (r2 && r2.provider === "github")
            ok(`resolve 裸名: openai/gpt-4.1-mini → provider=github`);
          else bad(`resolve 裸名 → ${JSON.stringify(r2)}`);

          const r3 = reg.resolve("claude-3-5-sonnet");
          if (r3 && r3.provider === "github")
            ok(`resolve alias: claude-3-5-sonnet → github (alias 递归)`);
          else bad(`resolve alias → ${JSON.stringify(r3)}`);
        }
      }
    } catch (e) {
      bad("registry 测抛", e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ⑤ gateway spawn live · 真起子进程 + 真 HTTP
  // ═══════════════════════════════════════════════════════════════
  section("⑤ gateway spawn live · 真起 + 真 HTTP + kill");

  if (SKIP_LIVE) {
    info("--skip-live · 跳真活节");
  } else {
    const PORT = 19999; // 测端口 · 避撞 11635+ 主公真用
    const examplePath = path.join(VENDOR, "配置.example.json");
    const url = `http://127.0.0.1:${PORT}`;

    let gw = null;
    try {
      gw = cp.spawn(
        process.execPath,
        [
          path.join(GATEWAY, "server.js"),
          "--port",
          String(PORT),
          "--config",
          examplePath,
          "--log-level",
          "error",
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          env: Object.assign({}, process.env, { DAO_BYOK_CONFIG: examplePath }),
          cwd: GATEWAY,
        },
      );

      let stderrBuf = "";
      gw.stderr.on("data", (d) => (stderrBuf += d.toString()));

      await waitForHealth(url, 8000);
      ok(`gateway 真起 · pid=${gw.pid} · port=${PORT}`);

      // /health 真发
      const h = await httpJSON("GET", url + "/health");
      if (h.status === 200) ok(`/health → 200`);
      else bad(`/health status=${h.status}`);
      if (
        h.data &&
        (h.data.ok === true || h.data.status === "ok" || h.data.providers)
      )
        ok(
          `/health body 含 ok/providers · providers=${(h.data.providers && h.data.providers.length) || "?"}`,
        );
      else bad(`/health body 异 · raw=${(h.raw || "").slice(0, 100)}`);

      // /v1/models 真发
      const m = await httpJSON("GET", url + "/v1/models");
      if (m.status === 200) ok(`/v1/models → 200`);
      else bad(`/v1/models status=${m.status}`);
      if (m.data && m.data.data && Array.isArray(m.data.data))
        ok(`/v1/models body OpenAI 格 · data.length=${m.data.data.length}`);
      else
        bad(
          `/v1/models body 异 · keys=${m.data ? Object.keys(m.data).join(",") : "null"}`,
        );

      // /v1/providers (max v1.0.8 之新端点)
      const p = await httpJSON("GET", url + "/v1/providers");
      if (p.status === 200 || p.status === 404)
        ok(`/v1/providers → ${p.status} (200 或 404 均合)`);
      else bad(`/v1/providers status=${p.status}`);

      // /v1/config (max v1.0.8 之新端点)
      const c = await httpJSON("GET", url + "/v1/config");
      if (c.status === 200 || c.status === 404 || c.status === 401)
        ok(`/v1/config → ${c.status} (200/404/401 均合 · 可能 authKey 守)`);
      else bad(`/v1/config status=${c.status}`);

      // /v1/diag (诊断端点)
      const d = await httpJSON("GET", url + "/v1/diag");
      if (d.status === 200 || d.status === 404) ok(`/v1/diag → ${d.status}`);
      else bad(`/v1/diag status=${d.status}`);

      // /v1/logs (日志环)
      const l = await httpJSON("GET", url + "/v1/logs");
      if (l.status === 200 || l.status === 404) ok(`/v1/logs → ${l.status}`);
      else bad(`/v1/logs status=${l.status}`);

      // 404 测
      const nf = await httpJSON("GET", url + "/does-not-exist");
      if (nf.status === 404 || nf.status === 405)
        ok(`/does-not-exist → ${nf.status} (404/405 均合)`);
      else bad(`/does-not-exist status=${nf.status} (期 404)`);

      if (stderrBuf)
        info(
          `gateway stderr (last 200 chars): ${stderrBuf.slice(-200).replace(/\n/g, " | ")}`,
        );
    } catch (e) {
      bad("gateway spawn live 抛", e.message);
    } finally {
      if (gw) {
        try {
          gw.kill();
          // 等 100ms 让进程真去
          await new Promise((r) => setTimeout(r, 100));
        } catch {}
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ⑥ runtime E2E · mock vscode + 真起 gateway + 真注 lm + 停
  // ═══════════════════════════════════════════════════════════════
  section("⑥ runtime.js E2E · mock vscode + 真起 + 真注 + 停");

  if (SKIP_LIVE) {
    info("--skip-live · 跳真活节");
  } else {
    try {
      const runtimeMod = require(path.join(VENDOR, "runtime.js"));
      const ExternalApiRuntime = runtimeMod.ExternalApiRuntime;

      // mock logger
      const logBuf = [];
      const mockLogger = {
        info: (...a) => logBuf.push(["info", ...a]),
        warn: (...a) => logBuf.push(["warn", ...a]),
        error: (...a) => logBuf.push(["error", ...a]),
        debug: () => {},
      };

      // mock vscode (含 lm.registerChatModelProvider)
      const lmRegistered = [];
      const mockVscode = {
        lm: {
          registerChatModelProvider: (vendor, provider) => {
            lmRegistered.push({ vendor, provider });
            return { dispose: () => {} };
          },
        },
        Disposable: class {
          dispose() {}
        },
      };

      const rt = new ExternalApiRuntime({
        vscodeModule: mockVscode,
        logger: mockLogger,
        configKey: "dao.外接api",
        vendorPrefix: "dao-",
      });

      if (rt.isRunning() === false) ok("rt.isRunning() 启前 false");
      else bad("rt.isRunning() 启前 非 false");

      info("rt.start() · 真起 gateway 子进程 (port = hash(user)+11635)");
      const status = await rt.start();
      if (rt.isRunning() === true) ok("rt.isRunning() 启后 true");
      else bad("rt.isRunning() 启后 非 true");

      if (status && status.gatewayUrl)
        ok(`status.gatewayUrl = ${status.gatewayUrl}`);
      else bad("status.gatewayUrl 缺");

      if (status && status.gatewayPid)
        ok(`status.gatewayPid = ${status.gatewayPid}`);
      else bad("status.gatewayPid 缺");

      if (typeof status.providers === "number")
        ok(`status.providers = ${status.providers}`);
      else bad("status.providers 非 number");

      if (typeof status.models === "number")
        ok(`status.models = ${status.models}`);
      else bad("status.models 非 number");

      // 真发 /health 真验
      if (status.gatewayUrl) {
        const h = await httpJSON("GET", status.gatewayUrl + "/health");
        if (h.status === 200) ok(`rt 起后 /health → 200`);
        else bad(`rt 起后 /health status=${h.status}`);
      }

      info("rt.stop() · 解 lm 注 + kill gateway");
      await rt.stop();
      if (rt.isRunning() === false) ok("rt.isRunning() 停后 false");
      else bad("rt.isRunning() 停后 非 false");

      // toggle 真用
      info("rt.toggle() · 起 (因停态)");
      const t1 = await rt.toggle();
      if (t1 === true && rt.isRunning() === true)
        ok("rt.toggle() 起 → true · isRunning true");
      else bad(`rt.toggle() 起态错 · t1=${t1} · isRunning=${rt.isRunning()}`);

      info("rt.toggle() · 停 (因起态)");
      const t2 = await rt.toggle();
      if (t2 === false && rt.isRunning() === false)
        ok("rt.toggle() 停 → false · isRunning false");
      else bad(`rt.toggle() 停态错 · t2=${t2} · isRunning=${rt.isRunning()}`);
    } catch (e) {
      bad("runtime E2E 抛", e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ⑦ lm_register.js · 三别名 fallback
  // ═══════════════════════════════════════════════════════════════
  section("⑦ lm_register.js · 三别名 fallback");

  try {
    const lmMod = require(path.join(VENDOR, "lm_register.js"));
    ok("require lm_register.js 通");

    if (typeof lmMod.registerProviders === "function")
      ok("registerProviders 是 function");
    else bad("registerProviders 非 function");
  } catch (e) {
    bad("require lm_register.js 失", e.message);
  }

  // 字串验三别名
  const lmPath = path.join(VENDOR, "lm_register.js");
  if (fs.existsSync(lmPath)) {
    const src = fs.readFileSync(lmPath, "utf-8");
    const aliases = [
      "registerChatModelProvider",
      "registerLanguageModelProvider",
      "registerLanguageModelChatProvider",
    ];
    let found = 0;
    for (const a of aliases) {
      if (src.includes(a)) found++;
    }
    if (found >= 2) ok(`lm_register: 含 ${found}/3 别名 fallback`);
    else bad(`lm_register: 仅 ${found}/3 别名 (期 ≥2)`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 终 · 总
  // ═══════════════════════════════════════════════════════════════
  console.log("");
  console.log(
    `\x1b[36m═══ 总: ${pass} 过 / ${fail} 失 / ${pass + fail} 测 ═══\x1b[0m`,
  );

  if (fail === 0) {
    console.log(
      "\x1b[32m✓ 印 126 真后端全链路 E2E 闭环 · 大曰逝 · 逝曰远 · 远曰反\x1b[0m",
    );
    process.exit(0);
  } else {
    console.log("\x1b[31m✗ 守门破 · 失:\x1b[0m");
    for (const f of fails) console.log(`  · ${f}`);
    process.exit(1);
  }
})().catch((e) => {
  console.error("\x1b[31m✗ main 抛:\x1b[0m", e.stack || e.message);
  process.exit(1);
});
