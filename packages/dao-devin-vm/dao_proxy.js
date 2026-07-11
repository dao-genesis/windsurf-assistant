#!/usr/bin/env node
/**
 * 真本源_单器.js · 印 101 · 原汤化原食 · 反三立一 · 道法自然
 * 末改 · 印 122 (sp_observe+SP 7 态) · 印 123 (web 二清对齐) · 印 124 (vendor/外接api 一身两轨)
 *      · 印 128 (一气化三清整体真本源治) · 印 129 (真本源切号 /admin/signin/windsurf)
 *      · 印 130 (真本源接入闭环 /admin/keys/{add,list,remove} · 登→入池→用 一线到底)
 *      · 印 133 (反者道之动 · WAM 本地真本源桥 /admin/wam/{local,use} · 知 ~/.wam 之真号)
 * ════════════════════════════════════════════════════════════════════════
 *
 * 主公印 101 诏 (2026-05-14 · UTC+08):
 *   > 审视当前最新成果 · 重新锚定本源 · 专注于反代底层工作
 *   > 不依赖本机 · 不依赖 github 之机
 *   > 专注于 devin cloud 底层之底层 · 原汤化原食
 *   > 自我反代 windsurf api + devin api
 *   > 同时并行 隔离/注入/管理 提示词
 *   > 道法自然 · 无为而无不为 · 实现一切
 *
 * 道:
 *   「反者，道之动也；弱者，道之用也。」              (帛书四十)
 *   「合抱之木，生于毫末。九成之台，作于累土。」      (帛书六十四)
 *   「上善若水。水善利万物而有静，居众之所恶。」      (帛书八)
 *   「天下莫柔弱于水，而攻坚强者莫之能胜也。」        (帛书七十八)
 *
 * 此器之朴 (印 101 · 真本源):
 *   ┌─ 一文件 · 0 deps · Node 22+ 原生 WebSocket
 *   ├─ 0 持久件依赖 (silk/wam-state.json 皆 optional · env 直注亦可)
 *   ├─ 0 网络回调 (不连本机 :11441/:11440/:11442 · 不依 GH Actions)
 *   ├─ 万处可跑 (主公 PC / Devin Cloud VM / Oracle / 任 Linux / 任容器)
 *   ├─ 自带 SP 三态 (隔离/注入/管理 · 承印 84 sp_manager v2 之骨)
 *   ├─ 自带 WAM 池 (多 token 轮换 + failover · 0 锁)
 *   └─ 自带三协议 (OpenAI · Anthropic · Gemini · 自识)
 *
 * 反三 (主公本印新弃):
 *   ✗ 印 99 (GH Actions 反代 · 外依 GitHub) ← 弃 (但旧件仍留 · 主公自决)
 *   ✗ 印 100 附 3 (本机 :11440 直调 · 外依 PC) ← 弃 (但 4 daemon 仍活 · 不动)
 *   ✗ 印 95 (Devin agent 部署 daemon · agent 道义拒) ← 弃 (三度拒证)
 *
 * 立一 (本印新立):
 *   ✓ 真本源 = 反代核心本身 · 真朴 · 真无依
 *   ✓ 该核心装入此单文件 · 主公自决跑哪 · 不强承载
 *   ✓ 即可独立跑 (无 :11441/:8878 兄弟) · 亦可与之并存
 *
 * 用 (一笔起 · env 配):
 *   # 默 (自动读 ~/.wam/wam-state.json 之 activeApiKey)
 *   node 真本源_单器.js
 *
 *   # 显式单 token
 *   DEVIN_TOKEN=devin-session-token$xxx node 真本源_单器.js
 *
 *   # 多 token 池 (逗号分)
 *   DEVIN_TOKENS=tok1,tok2,tok3 node 真本源_单器.js
 *
 *   # 文件 token 池 (一行一)
 *   DAO_TOKENS_FILE=/path/to/tokens.txt node 真本源_单器.js
 *
 *   # 启时设 SP 策略
 *   SP_STRATEGY=dao node 真本源_单器.js
 *
 *   # 自定端 / 绑
 *   PORT=8080 BIND=0.0.0.0 node 真本源_单器.js
 *
 * 客 (三协议自识):
 *   # OpenAI
 *   curl http://127.0.0.1:7780/v1/chat/completions \
 *     -H "Content-Type: application/json" \
 *     -d '{"model":"devin-cloud","messages":[{"role":"user","content":"道可道"}]}'
 *
 *   # Anthropic
 *   curl http://127.0.0.1:7780/v1/messages \
 *     -H "Content-Type: application/json" -H "anthropic-version: 2023-06-01" \
 *     -d '{"model":"devin-cloud-claude","max_tokens":256,
 *          "messages":[{"role":"user","content":"道可道"}]}'
 *
 *   # Gemini
 *   curl 'http://127.0.0.1:7780/v1beta/models/devin-cloud:generateContent' \
 *     -H "Content-Type: application/json" \
 *     -d '{"contents":[{"role":"user","parts":[{"text":"道可道"}]}]}'
 *
 * 管 (运行时):
 *   curl http://127.0.0.1:7780/health
 *   curl http://127.0.0.1:7780/v1/models
 *   curl http://127.0.0.1:7780/v1/system/prompt
 *   curl -X POST http://127.0.0.1:7780/v1/system/prompt \
 *        -H "Content-Type: application/json" -d '{"strategy":"dao"}'
 *   curl http://127.0.0.1:7780/v1/system/prompt/observe
 *   curl http://127.0.0.1:7780/metrics
 *   开浏览器 http://127.0.0.1:7780/  → dashboard
 *
 * 道义八守 (承印 90 / 印 87 / 印 84 之骨):
 *   ① 仅本机绑 127.0.0.1 (BIND 默 · 显式可改但需主公自识)
 *   ② 不偷 token (token 仅本进程内存 · 不外传 · 不日志全文)
 *   ③ 不污 telemetry (不调 Devin telemetry · 不绕审计)
 *   ④ 不破 SLA (wss 真路 · 默 300s 超 · 自降级 502)
 *   ⑤ 不绕 ACU (真消计费点 = session/prompt · 每笔真消)
 *   ⑥ SSE 流式真转 (chunked encoding · 真透)
 *   ⑦ 0 第三方 deps (Node 内置 http/https/url/fs/os 即足)
 *   ⑧ 优雅关停 (SIGINT/SIGTERM 不留挂连 · drain pending wss)
 */
"use strict";

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");

// § 0.1 · 印 122 · sp_observe_patch 软接入 (容退 · 不破已立)
let __spObserve = null;
try {
  __spObserve = require("./sp_observe_patch");
} catch (e) {
  // sp_observe_patch.js 缺失不阻塞主公 dao_proxy 运行
}

// ════════════════════════════════════════════════════════════════════════
// § 0 · 元 · 版 · WebSocket 检
// ════════════════════════════════════════════════════════════════════════
const VERSION = "0.4.3";
// 印 122 立 SEAL · 印 125 加 sp-dryrun · 印 130 加 admin-keys+signin · 印 ∞.2 加 /dc/* B 路 (居实不居华) · 印号承续
//   帛书·廿二「圣人执一·以为天下牧」: SEAL 一字反映实功 · 不滞后于注释首行 · 不滞后于 router
//   帛书·二「美与恶 之相生」 A 路智能分流 + B 路显式 devin cloud · 双反代之实
const SEAL =
  "印 122/125/130/∞.2 · 双池+SP七态+wss-observe+silk双源 · auth gate · sp-dryrun · admin-keys+signin · /dc/* B 路双反代 · 反者道之动";
const SEAL_AT = "2026-05-17T20:10+08:00";

let WebSocketImpl;
if (typeof WebSocket !== "undefined") {
  WebSocketImpl = WebSocket; // Node 22+ 原生
} else {
  try {
    WebSocketImpl = require("ws"); // 容退 npm ws
  } catch {
    console.error(
      "[真本源] FATAL · 此器需 Node 22+ (原生 WebSocket) 或 `npm i ws`",
    );
    process.exit(2);
  }
}

// ════════════════════════════════════════════════════════════════════════
// § 1 · 配 (env-driven · 软编 · 唯变所适)
// ════════════════════════════════════════════════════════════════════════
const CFG = {
  port: parseInt(process.env.PORT || "7780", 10),
  bind: process.env.BIND || "127.0.0.1",
  verbose: process.env.VERBOSE === "1" || process.env.DEBUG === "1",

  // token 源 (优先序: DEVIN_TOKEN > DEVIN_TOKENS > DAO_TOKENS_FILE > ~/.wam)
  envToken: process.env.DEVIN_TOKEN || "",
  envTokens: process.env.DEVIN_TOKENS || "",
  tokensFile: process.env.DAO_TOKENS_FILE || "",
  wamFile:
    process.env.WAM_FILE || path.join(os.homedir(), ".wam", "wam-state.json"),

  // SP 三态默
  spStrategy: process.env.SP_STRATEGY || "bypass",
  spCustom: process.env.SP_CUSTOM || "",
  spStripSide: process.env.SP_STRIP_SIDE === "1",
  spStripMem: process.env.SP_STRIP_MEM === "1",
  spNeutralize: process.env.SP_NEUTRALIZE === "1",

  // silk 源 (帛书《老子》全文)
  silkFile: process.env.DAO_SILK_FILE || "",
  silkDir: process.env.DAO_SILK_DIR || path.join(__dirname, "..", "silk"),

  // wss 反代
  wssUrl: process.env.WSS_URL || "wss://app.devin.ai/api/acp/live",
  defaultModel: process.env.DEFAULT_MODEL || "devin-cloud",
  promptTimeoutMs: parseInt(process.env.PROMPT_TIMEOUT_MS || "300000", 10),

  // Windsurf 上游 (印 101 v0.1 · pass-through 可选)
  windsurfUpstream: process.env.WINDSURF_UPSTREAM || "",

  // 印 104 · Windsurf ConnectRPC (cloud_engine.js)
  wsTokensFile:
    process.env.WS_TOKENS_FILE || path.join(__dirname, "tokens_ws_59.txt"),
  wsDefaultModel: process.env.WS_DEFAULT_MODEL || "MODEL_SWE_1_5",
  wsCooldownMs: parseInt(process.env.WS_COOLDOWN_MS || "60000", 10),

  // 印 106 · 公网 bearer auth (gate · 不强 · env 给则启)
  //   DAO_AUTH_TOKEN=xxx 之时 · 全路 (除 /health · /) 须带 Bearer/X-Dao-Auth
  //   "一号双登" 之客端体现: 主公一笔 token 通双路 (内部分 Devin/Windsurf 池)
  authToken: process.env.DAO_AUTH_TOKEN || "",
  authPublic: (process.env.DAO_AUTH_PUBLIC || "/,/health,/dashboard")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

// ════════════════════════════════════════════════════════════════════════
// § 2 · 日志 (轻 · 不污)
// ════════════════════════════════════════════════════════════════════════
const C = {
  G: (s) => `\x1b[32m${s}\x1b[0m`,
  Y: (s) => `\x1b[33m${s}\x1b[0m`,
  R: (s) => `\x1b[31m${s}\x1b[0m`,
  B: (s) => `\x1b[36m${s}\x1b[0m`,
  GR: (s) => `\x1b[90m${s}\x1b[0m`,
};
const ts = () => new Date().toISOString().slice(11, 23);
const logI = (m) => console.error(`${C.GR(ts())} ${C.B("info ")} ${m}`);
const logW = (m) => console.error(`${C.GR(ts())} ${C.Y("warn ")} ${m}`);
const logE = (m) => console.error(`${C.GR(ts())} ${C.R("error")} ${m}`);
const logD = (m) => {
  if (CFG.verbose) console.error(`${C.GR(ts())} ${C.GR("debug")} ${m}`);
};
const mask = (t) => {
  if (!t) return "(none)";
  if (t.length < 20) return t.slice(0, 4) + "...";
  return t.slice(0, 12) + "..." + t.slice(-6);
};

// ════════════════════════════════════════════════════════════════════════
// § 3 · 帛书 silk 载入 (optional · 多源回退)
//   优先: env DAO_SILK_FILE > env DAO_SILK_DIR/_silk_*.txt
//         > local ./silk/_silk_*.txt > ~/.dao/silk_combined.txt
//         > inline 道义引 (5 句 · 含义自足)
// ════════════════════════════════════════════════════════════════════════
const INLINE_SILK = [
  "道可道也，非恒道也。名可名也，非恒名也。" +
    "无名，万物之始也；有名，万物之母也。",
  "上善若水。水善利万物而有静，居众之所恶，故几于道矣。",
  "反者，道之动也；弱者，道之用也。天下之物生于有，有生于无。",
  "为道日损。损之又损，以至于无为，无为而无不为。",
  "信言不美，美言不信；知者不博，博者不知；善者不多，多者不善。" +
    "圣人无积，既以为人己愈有，既以予人己愈多。" +
    "天之道，利而不害；人之道，为而弗争。",
].join("\n\n");

function _readTrim(p) {
  try {
    return fs.readFileSync(p, "utf8").trim();
  } catch {
    return "";
  }
}

function loadSilk() {
  // 1. 显式 SILK_FILE
  if (CFG.silkFile) {
    const t = _readTrim(CFG.silkFile);
    if (t) return { text: t, source: "env:DAO_SILK_FILE", path: CFG.silkFile };
  }
  // 2. SILK_DIR 之 _silk_de + _silk_dao
  for (const d of [
    CFG.silkDir,
    path.join(__dirname, "silk"),
    path.join(__dirname, "..", "silk"),
    path.join(os.homedir(), ".dao", "silk"),
  ]) {
    const de = _readTrim(path.join(d, "_silk_de.txt"));
    const dao = _readTrim(path.join(d, "_silk_dao.txt"));
    if (de && dao) return { text: de + "\n\n" + dao, source: "dir", path: d };
    if (de) return { text: de, source: "dir(de-only)", path: d };
  }
  // 3. ~/.dao/silk_combined.txt
  const c = _readTrim(path.join(os.homedir(), ".dao", "silk_combined.txt"));
  if (c)
    return { text: c, source: "homedir", path: "~/.dao/silk_combined.txt" };
  // 4. inline 道义引
  return { text: INLINE_SILK, source: "inline", path: "(builtin)" };
}

const SILK = loadSilk();
const DAO_DE_JING = SILK.text;

// ════════════════════════════════════════════════════════════════════════
// § 4 · SP 三态核 (隔离·注入·管理 · 承印 84 sp_manager v2 之骨 · 压扁)
// ════════════════════════════════════════════════════════════════════════
const TAO_HEADER =
  "请以下文《老子》之思想风格、价值取向、表达方式回答下面的对话:\n" +
  "- 引用相应章句, 用古文/简洁风\n" +
  "- 体现「反者道之动」「无为而无不为」「柔弱胜刚强」「不争」「善下」之精神\n" +
  "- 自然展现即可, 不必声明身份转变\n\n" +
  "《老子》全文:\n\n";
const TAO_TRAILER = "\n\n──── 以上为风格指引 · 以下为对话 ────\n\n";
const INVERTED_PREFIX = "请以下文《老子》";

const SIDE_CHANNEL_TAGS = [
  "user_rules",
  "user_information",
  "workspace_information",
  "workspace_layout",
  "ide_metadata",
  "ide_state",
  "skills",
  "workflows",
  "flows",
  "memories",
  "memory_system",
  "communication_style",
  "communication_guidelines",
  "markdown_formatting",
  "tool_calling",
  "making_code_changes",
  "running_commands",
  "task_management",
  "debugging",
  "mcp_servers",
  "calling_external_apis",
  "citation_guidelines",
  "custom_instructions",
  "system_prompt",
  "system_instructions",
  "open_files",
  "cursor_position",
  "conversation_summary",
  "viewed_file",
  "learnings",
  "session_context",
  "code_interaction_summary",
];
const SIDE_CHANNEL_RE = new RegExp(
  "<(" + SIDE_CHANNEL_TAGS.join("|") + ")(?:\\s[^>]*)?>[\\s\\S]*?</\\1>",
  "gi",
);
const MEMORY_BLOCK_RE = /<MEMORY\[[^\]]*\]>[\s\S]*?<\/MEMORY\[[^\]]*\]>/gi;
const HIDDEN_OVERRIDE_RE =
  /\{\s*"mode"\s*:\s*"SECTION_OVERRIDE_MODE_[A-Z_]+"\s*,\s*"content"\s*:\s*"(?:[^"\\]|\\.)*"\s*\}/g;

function stripSide(s) {
  if (typeof s !== "string" || !s) return [s, 0];
  if (s.startsWith(INVERTED_PREFIX)) return [s, 0];
  let out = s,
    n = 0;
  for (let i = 0; i < 3; i++) {
    const m = out.match(SIDE_CHANNEL_RE);
    if (!m || m.length === 0) break;
    n += m.length;
    out = out.replace(SIDE_CHANNEL_RE, "");
  }
  return [out, n];
}
function stripMem(s) {
  if (typeof s !== "string" || !s) return [s, 0];
  const m = s.match(MEMORY_BLOCK_RE);
  if (!m) return [s, 0];
  return [s.replace(MEMORY_BLOCK_RE, ""), m.length];
}
function neutralize(s) {
  if (typeof s !== "string" || !s) return s;
  if (s.indexOf("SECTION_OVERRIDE_MODE_") < 0) return s;
  return s.replace(HIDDEN_OVERRIDE_RE, (m) => {
    try {
      const o = JSON.parse(m);
      if (o && typeof o.mode === "string" && typeof o.content === "string") {
        o.content = "道法自然";
        return JSON.stringify(o);
      }
    } catch {}
    return m;
  });
}

// SP state · 内存唯一源 · 0 持久 (主公自重启即默)
const SP_STATE = {
  strategy: [
    "bypass",
    "override",
    "prepend",
    "append",
    "dao",
    "custom",
    "usernote",
  ].includes(CFG.spStrategy)
    ? CFG.spStrategy
    : "bypass",
  customSp: CFG.spCustom,
  globalSp: "",
  perAccount: {},
  perModel: {},
  opts: {
    stripSideChannels: CFG.spStripSide,
    stripMemoryBlocks: CFG.spStripMem,
    neutralizeOverrides: CFG.spNeutralize,
  },
  updatedAt: Date.now(),
};

// observe ring (16 笔 · 跨请求轻日记)
const OBSERVE_RING = [];
const OBSERVE_MAX = 16;
function recordObserve(rec) {
  OBSERVE_RING.unshift(Object.assign({ at: Date.now() }, rec));
  while (OBSERVE_RING.length > OBSERVE_MAX) OBSERVE_RING.pop();
}

/** 处理 messages · 返 {messages, meta} */
function processMessages(messages, ctx) {
  const s = SP_STATE;
  const strategy = s.strategy;

  // 1. 提客户端 SP (合并所有 system)
  let clientSp = "";
  const nonSys = [];
  for (const m of messages || []) {
    if (m.role === "system") {
      const c =
        typeof m.content === "string" ? m.content : String(m.content || "");
      clientSp = clientSp ? clientSp + "\n\n" + c : c;
    } else {
      nonSys.push({ ...m });
    }
  }

  // 2. 取 daemonSp (per-account > per-model > global)
  let daemonSp = "";
  let daemonSource = "none";
  if (ctx?.account && s.perAccount[ctx.account]) {
    daemonSp = s.perAccount[ctx.account];
    daemonSource = "perAccount";
  } else if (ctx?.model && s.perModel[ctx.model]) {
    daemonSp = s.perModel[ctx.model];
    daemonSource = "perModel";
  } else if (s.globalSp) {
    daemonSp = s.globalSp;
    daemonSource = "globalSp";
  }

  // 3. 按 strategy 计 finalSp
  let finalSp = "";
  switch (strategy) {
    case "override":
      finalSp = daemonSp || clientSp;
      break;
    case "prepend":
      finalSp = daemonSp
        ? clientSp
          ? `${daemonSp}\n\n${clientSp}`
          : daemonSp
        : clientSp;
      break;
    case "append":
      finalSp = clientSp
        ? daemonSp
          ? `${clientSp}\n\n${daemonSp}`
          : clientSp
        : daemonSp;
      break;
    case "dao":
      finalSp = DAO_DE_JING ? TAO_HEADER + DAO_DE_JING + TAO_TRAILER : clientSp;
      break;
    case "custom":
      finalSp = s.customSp || clientSp;
      break;
    case "usernote":
      finalSp = clientSp;
      break;
    case "bypass":
    default:
      finalSp = clientSp;
      break;
  }

  // 4. strip 三步 (作用于 finalSp 与 nonSys.content)
  let nSide = 0,
    nMem = 0,
    nNeu = 0;
  const stripAll = (str) => {
    let out = str;
    if (s.opts.stripSideChannels) {
      const [r, n] = stripSide(out);
      out = r;
      nSide += n;
    }
    if (s.opts.stripMemoryBlocks) {
      const [r, n] = stripMem(out);
      out = r;
      nMem += n;
    }
    if (s.opts.neutralizeOverrides) {
      const before = out;
      out = neutralize(out);
      if (out !== before) {
        nNeu += (before.match(/SECTION_OVERRIDE_MODE_/g) || []).length;
      }
    }
    return out;
  };
  if (finalSp) finalSp = stripAll(finalSp);
  for (const m of nonSys) {
    if (typeof m.content === "string") m.content = stripAll(m.content);
  }

  // 印 122 · usernote 注入 (SP §3.17 之 user notes > system notes 合法槽)
  let usernoteInjected = 0;
  if (strategy === "usernote" && daemonSp) {
    for (let i = nonSys.length - 1; i >= 0; i--) {
      if (nonSys[i].role === "user") {
        const orig =
          typeof nonSys[i].content === "string"
            ? nonSys[i].content
            : String(nonSys[i].content || "");
        const noteBlock = `<note name="dao-priority" author="user">\n${daemonSp}\n</note>\n\n`;
        nonSys[i].content = noteBlock + orig;
        usernoteInjected = noteBlock.length;
        break;
      }
    }
  }

  // 5. 装 output (system 在前)
  const out = [];
  if (finalSp) out.push({ role: "system", content: finalSp });
  out.push(...nonSys);

  const meta = {
    strategy,
    daemonSource,
    clientSpLen: clientSp.length,
    daemonSpLen: daemonSp.length,
    finalSpLen: finalSp.length,
    sysChanged: clientSp !== finalSp,
    strippedSide: nSide,
    strippedMem: nMem,
    neutralized: nNeu,
    usernoteInjected,
  };

  recordObserve({
    strategy,
    model: ctx?.model || "?",
    account: ctx?.account || "?",
    sysBeforeLen: clientSp.length,
    sysAfterLen: finalSp.length,
    sysChanged: meta.sysChanged,
    strippedSide: nSide,
    strippedMem: nMem,
    neutralized: nNeu,
    daemonSource,
  });

  return { messages: out, meta };
}

// ════════════════════════════════════════════════════════════════════════
// § 5 · WAM 池 (多 token 轮换 + failover · 0 锁 · 内存唯一)
//   优先序: env DEVIN_TOKEN > env DEVIN_TOKENS > DAO_TOKENS_FILE > ~/.wam
// ════════════════════════════════════════════════════════════════════════
function _normalizeToken(t) {
  if (!t) return "";
  t = String(t).trim();
  // 去 "devin-session-token$" 前缀 (wss URL 用裸 JWT)
  const pfx = "devin-session-token$";
  if (t.startsWith(pfx)) t = t.slice(pfx.length);
  return t;
}

function loadTokens() {
  const pool = [];
  const seen = new Set();
  const push = (raw, src) => {
    const t = _normalizeToken(raw);
    if (!t || seen.has(t)) return;
    seen.add(t);
    pool.push({
      token: t,
      raw: raw,
      source: src,
      ok: 0,
      err: 0,
      lastUsedAt: 0,
      lastErrAt: 0,
      cooldownUntil: 0,
    });
  };

  // 1. DEVIN_TOKEN (single)
  if (CFG.envToken) push(CFG.envToken, "env:DEVIN_TOKEN");

  // 2. DEVIN_TOKENS (comma)
  if (CFG.envTokens) {
    for (const t of CFG.envTokens.split(","))
      push(t.trim(), "env:DEVIN_TOKENS");
  }

  // 3. DAO_TOKENS_FILE
  if (CFG.tokensFile) {
    try {
      const raw = fs.readFileSync(CFG.tokensFile, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const t = line.trim();
        if (t && !t.startsWith("#")) push(t, "file:" + CFG.tokensFile);
      }
    } catch (e) {
      logW(`tokens file 读失败: ${CFG.tokensFile} · ${e.message}`);
    }
  }

  // 4. ~/.wam/wam-state.json:activeApiKey
  try {
    if (fs.existsSync(CFG.wamFile)) {
      const w = JSON.parse(fs.readFileSync(CFG.wamFile, "utf8"));
      if (w.activeApiKey) push(w.activeApiKey, "wam:activeApiKey");
      // 容旧: w.accounts[email].apiKey (印 84 之前格式)
      if (w.accounts && typeof w.accounts === "object") {
        for (const [email, acc] of Object.entries(w.accounts)) {
          if (acc?.apiKey) push(acc.apiKey, "wam:" + email);
        }
      }
    }
  } catch (e) {
    logW(`wam 文件读失败: ${CFG.wamFile} · ${e.message}`);
  }

  return pool;
}

const POOL = loadTokens();
const POOL_STATE = {
  pool: POOL,
  cursor: 0,
  rotateCount: 0,
};

const COOLDOWN_MS = 30_000; // 30s · 错则冷却 (避连续打死)
function pickToken() {
  const now = Date.now();
  const n = POOL_STATE.pool.length;
  if (n === 0) return null;
  for (let i = 0; i < n; i++) {
    const idx = (POOL_STATE.cursor + i) % n;
    const t = POOL_STATE.pool[idx];
    if (t.cooldownUntil <= now) {
      POOL_STATE.cursor = (idx + 1) % n;
      if (i > 0) POOL_STATE.rotateCount++;
      t.lastUsedAt = now;
      return t;
    }
  }
  // 全冷却中 · 取 cursor 笔强用 (回归: 也许 cooldown 已过)
  const t = POOL_STATE.pool[POOL_STATE.cursor];
  t.lastUsedAt = now;
  return t;
}
// 印 105 · 错分类 (反者道之动 · 不一刀切)
// out_of_quota / billing → 长冷却 10min (账户级问题 · 短期不复)
// rate_limit / 429       → 中冷却 2min  (节流 · 等就好)
// timeout / network      → 短冷却 30s   (瞬时 · 速回)
// 默                     → 短冷却 30s
function classifyDevinError(reason) {
  const r = String(reason || "").toLowerCase();
  if (
    r.includes("out_of_quota") ||
    r.includes("billing") ||
    r.includes("payment") ||
    r.includes("subscription")
  ) {
    return { kind: "quota", cooldownMs: 600_000, retry: true };
  }
  if (
    r.includes("rate") ||
    r.includes("429") ||
    r.includes("too many request") ||
    r.includes("throttle")
  ) {
    return { kind: "rate", cooldownMs: 120_000, retry: true };
  }
  if (
    r.includes("timeout") ||
    r.includes("etimedout") ||
    r.includes("econnreset") ||
    r.includes("network")
  ) {
    return { kind: "transient", cooldownMs: 30_000, retry: true };
  }
  if (
    r.includes("unauth") ||
    r.includes("invalid_token") ||
    r.includes("401")
  ) {
    return { kind: "auth", cooldownMs: 3600_000, retry: true }; // 1h · key 坏
  }
  return { kind: "other", cooldownMs: COOLDOWN_MS, retry: false };
}

function markErr(t, reason) {
  if (!t) return;
  t.err++;
  t.lastErrAt = Date.now();
  const cls = classifyDevinError(reason);
  t.cooldownUntil = Date.now() + cls.cooldownMs;
  t.lastErrKind = cls.kind;
  logW(
    `token cooldown ${cls.cooldownMs / 1000}s (${cls.kind}) · ${mask(t.token)} · ${String(reason || "").slice(0, 80)}`,
  );
  return cls;
}
function markOk(t) {
  if (!t) return;
  t.ok++;
}

// 印 105 · Devin 池 retry-on-quota 包装
// 用法: const r = await chatViaWssRetry({tokenObj, ...}, { maxTries: 5 })
//      - tokenObj 给则首试用之 · 后续 rotation 自pick
//      - tokenObj 不给则全程 pickToken
// 行为: 错为 quota/rate/transient/auth → 自动换 token 再试 · 最多 maxTries
async function chatViaWssRetry(args, { maxTries = 5 } = {}) {
  // chatViaWss 是 function 声明 · JS hoist · 直接调
  const tried = new Set();
  let lastErr = null;
  let firstTokenObj = args.tokenObj || null;
  const innerArgs = { ...args };
  delete innerArgs.tokenObj;

  for (let i = 0; i < maxTries; i++) {
    let t;
    if (i === 0 && firstTokenObj) {
      t = firstTokenObj;
    } else {
      t = pickToken();
    }
    if (!t) {
      const msg = lastErr?.message || "no token available";
      throw new Error(msg);
    }
    if (tried.has(t.token)) {
      // 全过一遍 · 等 cooldown
      const msg = `all ${tried.size} tokens tried · last=${lastErr?.message || "?"}`;
      const err = new Error(msg);
      err.__triedCount = tried.size;
      err.__lastErr = lastErr;
      throw err;
    }
    tried.add(t.token);
    try {
      const r = await chatViaWss({ ...innerArgs, tokenObj: t });
      r.__triedCount = tried.size;
      return r;
    } catch (e) {
      lastErr = e;
      const cls = classifyDevinError(e.message);
      logI(
        `devin retry ${i + 1}/${maxTries} · ${cls.kind} · ${mask(t.token)} · ${e.message.slice(0, 60)}`,
      );
      if (!cls.retry) break; // 不可救之错 · 即返
    }
  }
  const e = new Error(
    `all ${tried.size} tries failed · last: ${lastErr?.message || "?"}`,
  );
  e.__triedCount = tried.size;
  e.__lastErr = lastErr;
  throw e;
}

// ════════════════════════════════════════════════════════════════════════
// § 5b · 印 104 · Windsurf 双端池 (GetUserStatus 真转 · 59 keys)
//   「天下莫柔弱于水，而攻坚强者莫之能胜也」(帛书七十八)
//
//   实证 (2026-05-14):
//     ✓ GetUserStatus (JSON + X-Api-Key)        → 200 真转 (planInfo/teamId/quota)
//     ✗ GetChatMessage (cloud_engine.js raw pb) → 404 / unsupported procedure
//     待:  Cascade chat 真协议待 LSP 双向 ConnectRPC stream 反 (下印)
//
//   策:  当下提供 quota+status 真转, chat 走 Devin 单路 (避假装)
//        ("信言不美 · 美言不信" · 帛书八十一)
// ════════════════════════════════════════════════════════════════════════
const WS_POOL_STATE = {
  keys: [], // [{apiKey, srvUrl, ok, err, lastUsedAt, lastErrAt, cooldownUntil, plan}]
  cursor: 0,
  rotateCount: 0,
  loaded: false,
  err: null,
};

function loadWindsurfPool() {
  try {
    const tokFile = CFG.wsTokensFile;
    if (!fs.existsSync(tokFile)) {
      WS_POOL_STATE.err = "tokens file not found: " + tokFile;
      logW("windsurf tokens 文件不存在: " + tokFile);
      return false;
    }
    const raw = fs.readFileSync(tokFile, "utf8");
    const keys = raw
      .split(/\r?\n/)
      .filter((l) => l.trim() && !l.startsWith("#") && l.startsWith("sk-"));
    if (keys.length === 0) {
      WS_POOL_STATE.err = "no valid sk- keys";
      return false;
    }
    WS_POOL_STATE.keys = keys.map((k) => ({
      apiKey: k,
      srvUrl: "https://server.self-serve.windsurf.com",
      ok: 0,
      err: 0,
      lastUsedAt: 0,
      lastErrAt: 0,
      cooldownUntil: 0,
      plan: null,
    }));
    WS_POOL_STATE.loaded = true;
    WS_POOL_STATE.err = null;
    logI(
      `windsurf pool 载入: ${C.G(keys.length + " keys")} · srv=self-serve.windsurf.com`,
    );
    return true;
  } catch (e) {
    WS_POOL_STATE.err = e.message;
    logE("windsurf pool 载入失败: " + e.message);
    return false;
  }
}

function pickWsKey() {
  const now = Date.now();
  const n = WS_POOL_STATE.keys.length;
  if (n === 0) return null;
  for (let i = 0; i < n; i++) {
    const idx = (WS_POOL_STATE.cursor + i) % n;
    const k = WS_POOL_STATE.keys[idx];
    if (k.cooldownUntil <= now) {
      WS_POOL_STATE.cursor = (idx + 1) % n;
      if (i > 0) WS_POOL_STATE.rotateCount++;
      k.lastUsedAt = now;
      return k;
    }
  }
  const k = WS_POOL_STATE.keys[WS_POOL_STATE.cursor];
  k.lastUsedAt = now;
  return k;
}

// windsurf GetUserStatus (JSON + X-Api-Key · 实证可用)
function wsGetUserStatus(keyObj, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const https = require("https");
    const sessionId = crypto.randomUUID();
    const body = JSON.stringify({
      metadata: {
        ideName: "windsurf",
        ideVersion: "1.99.0",
        extensionName: "windsurf",
        extensionVersion: "1.99.0",
        apiKey: keyObj.apiKey,
        sessionId,
        requestId: "1",
        locale: "en",
        os: "windows",
      },
    });
    const u = new URL(
      keyObj.srvUrl +
        "/exa.seat_management_pb.SeatManagementService/GetUserStatus",
    );
    const opts = {
      hostname: u.hostname,
      path: u.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        "X-Api-Key": keyObj.apiKey,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    };
    const req = https.request(opts, (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        try {
          const j = JSON.parse(d);
          if (r.statusCode >= 200 && r.statusCode < 300) {
            keyObj.ok++;
            keyObj.plan = j.userStatus || j;
            resolve({ ok: true, status: r.statusCode, plan: keyObj.plan });
          } else {
            keyObj.err++;
            resolve({
              ok: false,
              status: r.statusCode,
              error: j.message || JSON.stringify(j).slice(0, 200),
            });
          }
        } catch {
          keyObj.err++;
          resolve({ ok: false, status: r.statusCode, error: d.slice(0, 200) });
        }
      });
    });
    req.on("error", (e) => {
      keyObj.err++;
      resolve({ ok: false, error: e.message });
    });
    req.on("timeout", () => {
      req.destroy();
      keyObj.err++;
      resolve({ ok: false, error: "timeout" });
    });
    req.write(body);
    req.end();
  });
}

// ════════════════════════════════════════════════════════════════════════
// § 印 129 · 真本源切号链 · 代主公登 Windsurf · 反者道之动
//   主公诏 (2026-05-17 16:11):
//     「反者 道之动也 · 不作茧自缚 不限制 不惧 方能成其大」
//     「此登录为核心切号本源 · 凡无法替我之一切」
//     「登录 windsurf 于 devin.ai 网页 必然无法后续实现切号等所有功能」
//     「不着相 直接推进道极 无为而无不为」
//
//   真本源 (移植自 wam-bundle/extension.js L1317-1397 · 已实证生产):
//     ① POST  https://windsurf.com/_devin-auth/password/login
//        body: { email, password }
//        → { token (auth1), user_id }
//     ② POST  https://windsurf.com/_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth
//        header: X-Devin-Auth1-Token: <auth1>
//        body: { auth1_token, org_id? }
//        → { sessionToken (devin-session-token$...), accountId, primaryOrgId }
//     ③ POST  https://register.windsurf.com/exa.seat_management_pb.SeatManagementService/RegisterUser
//        body: { firebase_id_token: sessionToken }
//        → { api_key (ws-* · 真本源 API key), api_server_url, name }
//
//   入: { email, password }                  (web 中栏 WAM 弹 modal 收)
//   出: { ok, apiKey, apiServerUrl, sessionToken, accountId, primaryOrgId }
//        web 端自动入 D.accounts 池 · 即可走反代 /v1/messages
//
//   走后端 (Devin VM) · 不走浏览器 · 因:
//     - windsurf.com 不允许 CORS · 浏览器 fetch 必败
//     - VM 是主公 self-host trust boundary · 密码不外泄 (仅 VM 内 process · 不日志不存盘)
//
//   道义:
//     帛书·二十二 圣人执一 (3 端点 · 一函数 · 一调用 · 万法响应)
//     帛书·四十八 损之又损 (复用现 https.request 模式 · 不增外库)
//     帛书·七十六 柔弱微细居上 (用户仅输 email+password · 余皆 VM 代为)
// ════════════════════════════════════════════════════════════════════════
// 印 129 · 三 URL 端 · env override 守门时可 mock (生产时不调)
//   WS_SIGNIN_LOGIN_OVERRIDE / WS_SIGNIN_POSTAUTH_OVERRIDE / WS_SIGNIN_REGISTER_OVERRIDE
const WS_SIGNIN_URL_LOGIN =
  process.env.WS_SIGNIN_LOGIN_OVERRIDE ||
  "https://windsurf.com/_devin-auth/password/login";
const WS_SIGNIN_URL_POSTAUTH =
  process.env.WS_SIGNIN_POSTAUTH_OVERRIDE ||
  "https://windsurf.com/_backend/exa.seat_management_pb.SeatManagementService/WindsurfPostAuth";
const WS_SIGNIN_URL_REGISTER =
  process.env.WS_SIGNIN_REGISTER_OVERRIDE ||
  "https://register.windsurf.com/exa.seat_management_pb.SeatManagementService/RegisterUser";
const WS_SIGNIN_RE_SESSION = /^devin-session-token\$/;
// 印 129 · 测试时覆 (守门时 mock 替)
let __WS_SIGNIN_OVERRIDE = null; // { login, postauth, register } URL 覆

function _wsSigninUrls() {
  if (__WS_SIGNIN_OVERRIDE)
    return {
      login: __WS_SIGNIN_OVERRIDE.login || WS_SIGNIN_URL_LOGIN,
      postauth: __WS_SIGNIN_OVERRIDE.postauth || WS_SIGNIN_URL_POSTAUTH,
      register: __WS_SIGNIN_OVERRIDE.register || WS_SIGNIN_URL_REGISTER,
    };
  return {
    login: WS_SIGNIN_URL_LOGIN,
    postauth: WS_SIGNIN_URL_POSTAUTH,
    register: WS_SIGNIN_URL_REGISTER,
  };
}

// httpsPostJson · 内 helper (与 wam-bundle/jsonPost 等价 · 复用 dao_proxy 现 https.request 模式)
function httpsPostJson(urlStr, headers, body, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch (e) {
      return resolve({ status: 0, error: "bad_url" });
    }
    const isHttps = u.protocol === "https:";
    const lib = require(isHttps ? "https" : "http");
    const payload = JSON.stringify(body || {});
    const opts = {
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method: "POST",
      headers: Object.assign(
        {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "User-Agent": "dao-proxy/0.4.2 (seal-129 real-signin)",
        },
        headers || {},
      ),
      timeout: timeoutMs,
    };
    const req = lib.request(opts, (r) => {
      let d = "";
      r.on("data", (c) => (d += c));
      r.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(d);
        } catch {}
        resolve({ status: r.statusCode, json: parsed, text: d });
      });
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, error: "timeout" });
    });
    req.write(payload);
    req.end();
  });
}

// 步 ① devinLogin · email+password → auth1 token
async function _signin_devinLogin(email, password) {
  const r = await httpsPostJson(
    _wsSigninUrls().login,
    {
      Origin: "https://windsurf.com",
      Referer: "https://windsurf.com/account/login",
      Accept: "application/json, text/plain, */*",
    },
    { email, password },
  );
  if (r.json && r.json.token && r.json.user_id)
    return { ok: true, auth1: r.json.token, userId: r.json.user_id };
  return {
    ok: false,
    stage: "devinLogin",
    status: r.status,
    error:
      (r.json && (r.json.detail || r.json.error || r.json.message)) ||
      r.error ||
      "no_token",
  };
}

// 步 ② windsurfPostAuth · auth1 → sessionToken
async function _signin_postAuth(auth1, orgId) {
  const body = { auth1_token: auth1 };
  if (orgId) body.org_id = orgId;
  const r = await httpsPostJson(
    _wsSigninUrls().postauth,
    {
      Origin: "https://windsurf.com",
      Referer: "https://windsurf.com/profile",
      "Connect-Protocol-Version": "1",
      "X-Devin-Auth1-Token": auth1,
    },
    body,
  );
  if (
    r.json &&
    typeof r.json.sessionToken === "string" &&
    WS_SIGNIN_RE_SESSION.test(r.json.sessionToken)
  )
    return {
      ok: true,
      sessionToken: r.json.sessionToken,
      accountId: r.json.accountId || "",
      primaryOrgId: r.json.primaryOrgId || "",
    };
  return {
    ok: false,
    stage: "windsurfPostAuth",
    status: r.status,
    error:
      (r.json && (r.json.error || r.json.code || r.json.message)) ||
      r.error ||
      "no_session",
  };
}

// 步 ③ registerUserViaSession · sessionToken → apiKey
async function _signin_register(sessionToken) {
  const r = await httpsPostJson(
    _wsSigninUrls().register,
    { "Connect-Protocol-Version": "1" },
    { firebase_id_token: sessionToken },
  );
  if (r.json && (r.json.api_key || r.json.apiKey))
    return {
      ok: true,
      apiKey: r.json.api_key || r.json.apiKey,
      name: r.json.name || "",
      apiServerUrl: r.json.api_server_url || r.json.apiServerUrl || "",
    };
  return {
    ok: false,
    stage: "registerUser",
    status: r.status,
    error:
      (r.json && (r.json.code || r.json.message)) || r.error || "no_api_key",
  };
}

// 编排器 · 3 步真本源链 (主公 16:11 诏所点之核)
async function _signin_orchestrate(email, password, orgId) {
  const t0 = Date.now();
  const dl = await _signin_devinLogin(email, password);
  if (!dl.ok) return Object.assign({ ms: Date.now() - t0 }, dl);
  const pa = await _signin_postAuth(dl.auth1, orgId);
  if (!pa.ok) return Object.assign({ ms: Date.now() - t0 }, pa);
  const reg = await _signin_register(pa.sessionToken);
  if (!reg.ok)
    return Object.assign(
      {
        ms: Date.now() - t0,
        sessionToken: pa.sessionToken,
        accountId: pa.accountId,
        primaryOrgId: pa.primaryOrgId,
      },
      reg,
    );
  return {
    ok: true,
    stage: "complete",
    ms: Date.now() - t0,
    email,
    apiKey: reg.apiKey,
    apiServerUrl: reg.apiServerUrl,
    name: reg.name,
    sessionToken: pa.sessionToken,
    accountId: pa.accountId,
    primaryOrgId: pa.primaryOrgId,
  };
}

// HTTP handler · POST /admin/signin/windsurf
async function handleAdminSignin(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, { error: "bad_json", message: e.message });
  }
  const email = (body.email || "").trim();
  const password = body.password || "";
  const orgId = body.orgId || body.org_id || "";
  if (!email || !password) {
    return sendJson(res, 400, {
      ok: false,
      error: "email_and_password_required",
      hint: "POST /admin/signin/windsurf { email, password, orgId? }",
    });
  }
  // 印 129 · 不日志密码 (仅前缀 + 长度) · 守隐
  const safeTag = email + " / pw[" + password.length + "]";
  try {
    const out = await _signin_orchestrate(email, password, orgId);
    if (!out.ok) {
      console.error(
        "[admin/signin] ✗",
        safeTag,
        out.stage || "?",
        out.error || "?",
      );
      return sendJson(res, 401, out);
    }
    console.log(
      "[admin/signin] ✓",
      email,
      "apiKey=" + (out.apiKey || "").slice(0, 12) + "…",
      out.ms + "ms",
    );
    // 出·去 password (永不返) · 守隐
    return sendJson(res, 200, out);
  } catch (e) {
    console.error("[admin/signin] crash", safeTag, e.message);
    return sendJson(res, 500, {
      ok: false,
      stage: "crash",
      error: e.message,
    });
  }
}

// 印 129 · 测试 hook · 让守门可注入 mock URL (生产时不调)
function __setSigninOverride(urls) {
  __WS_SIGNIN_OVERRIDE = urls || null;
}

// ════════════════════════════════════════════════════════════════════════
// § 印 130 · 真本源接入闭环 · 反代池 runtime 管 · 反者道之动
// ════════════════════════════════════════════════════════════════════════
//   「圣人执一 · 以为天下牧」(廿二)
//   「为道者日损 · 损之又损 · 以至于无为 · 无为而无不为」(四十八)
//   「物无非彼 · 物无非是」(庄子·齐物论 · 主公诏引)
//
//   印 129 立真本源切号链 (代主公登 windsurf 出 ws-* key)
//   印 130 立真本源接入池 — 让 ws-* key 立刻接入运行中之 WS_POOL_STATE
//
//   流 (一线到底):
//     web autoSigninWindsurf
//       → POST /admin/signin/windsurf {email, password}    (印 129)
//       → 出 {apiKey: "ws-*", apiServerUrl, sessionToken}
//       → POST /admin/keys/add {apiKey, srvUrl, email}     (印 130)
//       → WS_POOL_STATE.keys.push · 即可走 /v1/messages 反代真活
//
//   守隐 (帛书五十六「塞其闷 · 闭其门」):
//     - DAO_AUTH_TOKEN env 启时 · 全 admin/* 路由 受 checkAuth 保护 (印 106)
//     - apiKey 返时仅前 12 字 · 永不全显 (脱敏)
//     - 去重: 已存 apiKey 不再加 (返 200 + duplicate=true · 不报错 · 客端可重幂等)
//
//   非破坏性 (帛书四十八「损之又损」):
//     - 不改 loadWindsurfPool · 不改 pickWsKey · 不改 wsGetUserStatus
//     - 仅推 WS_POOL_STATE.keys[]  · 现有反代逻辑透明承之
// ════════════════════════════════════════════════════════════════════════

function _maskKey(k) {
  return (k || "").slice(0, 12) + "…";
}

function handleAdminKeysList(req, res) {
  const items = WS_POOL_STATE.keys.map((k) => ({
    apiKey: _maskKey(k.apiKey),
    srvUrl: k.srvUrl,
    ok: k.ok || 0,
    err: k.err || 0,
    lastUsedAt: k.lastUsedAt || 0,
    cooldownUntil: k.cooldownUntil || 0,
    plan: k.plan || null,
    email: k.email || "",
    addedAt: k.addedAt || 0,
  }));
  return sendJson(res, 200, {
    ok: true,
    count: items.length,
    cursor: WS_POOL_STATE.cursor,
    rotateCount: WS_POOL_STATE.rotateCount,
    loaded: WS_POOL_STATE.loaded,
    err: WS_POOL_STATE.err,
    keys: items,
  });
}

async function handleAdminKeysAdd(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, { error: "bad_json", message: e.message });
  }
  const apiKey = (body.apiKey || body.api_key || "").trim();
  if (!apiKey) {
    return sendJson(res, 400, {
      ok: false,
      error: "api_key_required",
      hint: "POST /admin/keys/add { apiKey: 'ws-*', srvUrl?, email? }",
    });
  }
  // 印 130 · 真本源验 · windsurf register API 之 api_key 格
  //   印 ∞.3 道动测发现 · 真 windsurf API ③ register 返之 api_key 是
  //     `devin-session-token$<JWT>` 格式 · 非旧文档之 ws-* (老 wam-bundle hint)
  //   实证: 13/13 真 auth1 → ②③ 链 → 全返 devin-session-token$ 前缀
  //   故验 兼三型 (帛书六十四「图难于其易」「为大于其细」):
  //     · devin-session-token$<JWT>  ← windsurf register 真返 (主路 · 印 ∞.3 治)
  //     · ws-*                        ← 旧 wam-bundle alias (兼容)
  //     · 其他                        ← warn (允 mock 测)
  const isDevinSession = apiKey.startsWith("devin-session-token$");
  const isWs = apiKey.startsWith("ws-");
  const isReal = isDevinSession || isWs;
  // 去重 · 帛书六十四「为之于其未有也」 — 已存即幂等返
  const dup = WS_POOL_STATE.keys.find((k) => k.apiKey === apiKey);
  if (dup) {
    return sendJson(res, 200, {
      ok: true,
      duplicate: true,
      apiKey: _maskKey(apiKey),
      count: WS_POOL_STATE.keys.length,
    });
  }
  const srvUrl =
    body.srvUrl || body.api_server_url || "https://server.codeium.com";
  const email = (body.email || "").trim();
  WS_POOL_STATE.keys.push({
    apiKey,
    srvUrl,
    email,
    ok: 0,
    err: 0,
    lastUsedAt: 0,
    lastErrAt: 0,
    cooldownUntil: 0,
    plan: null,
    addedAt: Date.now(),
  });
  // 印 130 · 池由空转为有 · loaded 立 · err 清
  WS_POOL_STATE.loaded = true;
  WS_POOL_STATE.err = null;
  // 印 ∞.3 · 真 prefix 标 (主路 = devin-session-token$ · 别 = ws- · 余 = mock)
  const prefixKind = isDevinSession
    ? "devin-session"
    : isWs
      ? "ws-"
      : "mock-or-other";
  console.log(
    `[admin/keys/add] ✓ ${_maskKey(apiKey)} email=${email || "?"} pool=${WS_POOL_STATE.keys.length} prefix=${prefixKind}${isReal ? "" : " (warn:non-real-prefix)"}`,
  );
  return sendJson(res, 200, {
    ok: true,
    apiKey: _maskKey(apiKey),
    count: WS_POOL_STATE.keys.length,
    prefix: prefixKind, // 印 ∞.3 升 · 客可知前缀类
    warn: isReal
      ? null
      : "key prefix not real (expected: devin-session-token$ or ws-)",
  });
}

async function handleAdminKeysRemove(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, { error: "bad_json", message: e.message });
  }
  const apiKey = (body.apiKey || body.api_key || "").trim();
  if (!apiKey) {
    return sendJson(res, 400, {
      ok: false,
      error: "api_key_required",
      hint: "POST /admin/keys/remove { apiKey }",
    });
  }
  const before = WS_POOL_STATE.keys.length;
  WS_POOL_STATE.keys = WS_POOL_STATE.keys.filter((k) => k.apiKey !== apiKey);
  const removed = before - WS_POOL_STATE.keys.length;
  // 守 cursor 不溢 · 帛书三十二「知止所以不殆」
  if (WS_POOL_STATE.cursor >= WS_POOL_STATE.keys.length) {
    WS_POOL_STATE.cursor = 0;
  }
  console.log(
    `[admin/keys/remove] ${removed > 0 ? "✓" : "✗ not_found"} ${_maskKey(apiKey)} pool=${WS_POOL_STATE.keys.length}`,
  );
  return sendJson(res, removed > 0 ? 200 : 404, {
    ok: removed > 0,
    removed,
    apiKey: _maskKey(apiKey),
    count: WS_POOL_STATE.keys.length,
  });
}

// ════════════════════════════════════════════════════════════════════════
// § 印 133 · 反者道之动 · WAM 本地真本源桥 · 大曰逝逝曰远远曰反
// ════════════════════════════════════════════════════════════════════════
//   帛书廿五: 「道大 · 大曰逝 · 逝曰远 · 远曰反」
//   帛书四十: 「反者 · 道之动也; 弱者 · 道之用也」
//   帛书四十八:「损之又损 · 以至于无为 · 无为而无不为」
//
//   主公诏 (2026-05-17 20:08 · UTC+08):
//     「重新解构最初本源提示词 · 解构所有底层需求
//      C:\Users\Administrator\.wam\accounts.md 带入用户一切 ·
//      测试使用一切 · 利用所有之资 · 推进到底 · 实践到底」
//
//   反观 · 印 1-132 已立 26/26 守门 · 但皆 mock · 未触主公真号库:
//     - ~/.wam/accounts.md 之 179 件真号一件未导
//     - ~/.wam/wam-state.json 96K 健康表 dao_proxy 不知
//     - _kernel/wam_bridge + admin_server :7870 已立印 49 9 路 · 但不通 :17890
//
//   远曰反 · 立公网 dao_proxy 知 ~/.wam (仅主公本机起时有效):
//     GET  /admin/wam/local      返 179 件解析表 (脱密 + 健康注入)
//     POST /admin/wam/use        单件入池 (token-direct / email-login)
//
//   守隐 (帛书五十六「塞其闷 · 闭其门」· 三十六「邦利器不可以视人」):
//     ✗ 不返完整密 (仅 fingerprint 12 字 + 长度)
//     ✗ 不返完整 token (仅 mask 前 12+后 4 字 + fingerprint)
//     ✗ 不返完整邮 (仅 j***a@gmail.com 风格 · raw=1 + localhost 强守可见)
//     ✓ /admin/wam/use 仅本机 (127.0.0.1/::1/localhost · 即使 DAO_AUTH_TOKEN 校亦)
//     ✓ token 由 server 端读真直入池 · web 不经手 (帛书三十六)
//
//   零依赖 (帛书廿八「为天下式 · 恒德不贰」):
//     - 不引 _kernel · 不引 wam_bridge.js (单源守不破)
//     - 自带 _wam133_parseAccountsMd (复 wam_bridge.parseAccountText 之精 · ~70 行)
//     - fs.existsSync 探测 · Devin VM 端无 ~/.wam 即透返 available=false
//
//   流 (一线到底 · 闭环六门 · 圆主公诏):
//     ① web 'browse 真本源 .wam' → GET /admin/wam/local        (印 133)
//     ② 表渲 179 件 + 健康/Trial/credits/auth1 着色
//     ③ 主公点某行 ⇄ → POST /admin/wam/use {index, mode}       (印 133)
//        · auto: token > password 自辨
//        · token-direct: auth1_xxx 直入池 (跳登 · 帛书四十八)
//        · email-login: email+pwd → /admin/signin/windsurf (印 129) → 入池
//     ④ 池立 ws-* key (印 130 接入)
//     ⑤ /v1/chat/completions 真转 (印 105 反代核心)
//     ⑥ 主公真号真用 · 物归原主 (此印之极)
// ════════════════════════════════════════════════════════════════════════

const _WAM133_HOME = require("os").homedir();
// 默 ~/.wam · 允 env WAM_LOCAL_PATH 覆 (守门 fixture · 主公自定 · 帛书廿八「为天下式 · 恒德不贰」)
const _WAM133_DIR =
  (process.env.WAM_LOCAL_PATH && String(process.env.WAM_LOCAL_PATH).trim()) ||
  require("path").join(_WAM133_HOME, ".wam");
const _WAM133_ACCOUNTS_MD = require("path").join(_WAM133_DIR, "accounts.md");
const _WAM133_STATE_JSON = require("path").join(_WAM133_DIR, "wam-state.json");

// 印 133 · 测试 hook · 守门可注入 fixture 路径 (生产时 null)
let __WAM133_OVERRIDE = null;
function __setWam133Override(paths) {
  __WAM133_OVERRIDE = paths || null;
}

function _wam133_paths() {
  if (__WAM133_OVERRIDE) {
    return {
      accountsMd: __WAM133_OVERRIDE.accountsMd || _WAM133_ACCOUNTS_MD,
      stateJson: __WAM133_OVERRIDE.stateJson || _WAM133_STATE_JSON,
    };
  }
  return { accountsMd: _WAM133_ACCOUNTS_MD, stateJson: _WAM133_STATE_JSON };
}

// 印 133 · 邮验 (复 wam_bridge 之精 · 0 deps)
function _wam133_isEmail(s) {
  if (!s || typeof s !== "string") return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(s.trim());
}

// 印 133 · token 类辨 (auth1 / jwt / devin-session / sk-ws / ws-key / opaque)
const _WAM133_RE_AUTH1 = /^auth1_[a-z0-9]{20,}$/i;
const _WAM133_RE_JWT = /^eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/;
const _WAM133_RE_DEVIN_SESSION = /^devin-session-token\$/i;
const _WAM133_RE_SK_WS = /^sk-ws-/i;
const _WAM133_RE_WS_PREFIX = /^ws-/i;
function _wam133_tokenKind(s) {
  if (!s) return null;
  if (_WAM133_RE_AUTH1.test(s)) return "auth1";
  if (_WAM133_RE_JWT.test(s)) return "jwt";
  if (_WAM133_RE_DEVIN_SESSION.test(s)) return "devin-session";
  if (_WAM133_RE_SK_WS.test(s)) return "sk-ws";
  if (_WAM133_RE_WS_PREFIX.test(s)) return "ws-key";
  if (s.length >= 60 && /^[A-Za-z0-9_\-\.\$\/+=]+$/.test(s)) return "opaque";
  return null;
}

// 印 133 · 脱密 fingerprint (12 hex · sha256 前 12 字 · 帛书五十六)
function _wam133_fp(s) {
  if (!s) return "";
  return require("crypto")
    .createHash("sha256")
    .update(String(s), "utf8")
    .digest("hex")
    .slice(0, 12);
}

// 印 133 · 脱邮 mask (j***a@gmail.com 保 domain · 隐 local)
function _wam133_maskEmail(e) {
  if (!e || typeof e !== "string") return "";
  const at = e.indexOf("@");
  if (at < 1) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at);
  if (local.length <= 2) return local[0] + "*" + domain;
  return local[0] + "***" + local.slice(-1) + domain;
}

// 印 133 · token mask (前 12 + … + 后 4)
function _wam133_maskToken(t) {
  if (!t) return "";
  if (t.length <= 16) return t.slice(0, 4) + "…";
  return t.slice(0, 12) + "…" + t.slice(-4);
}

// 印 133 · parseAccountsMd · 复 wam_bridge.parseAccountText 之精 (0 deps)
//   返 { items: [{line, kind, ...}], rawCount }
//   kind ∈ { email_password, email_token, token, ignored }
//   opts.includeRaw=true 时 _password / _token 字段携真 (仅 /admin/wam/use 内部用)
function _wam133_parseAccountsMd(content, opts) {
  opts = opts || {};
  const items = [];
  if (!content || typeof content !== "string") {
    return { items, rawCount: 0 };
  }
  const lines = content.split(/\r?\n/);
  let lineNo = 0;
  for (const raw of lines) {
    lineNo++;
    const ln = raw.trim();
    if (!ln) continue;
    if (ln.startsWith("#") || ln.startsWith("//")) continue;
    // 单 token (无 @ · 仅一串)
    if (!ln.includes("@")) {
      const tk = _wam133_tokenKind(ln);
      if (tk) {
        items.push({
          line: lineNo,
          kind: "token",
          tokenKind: tk,
          tokenMasked: _wam133_maskToken(ln),
          tokenFp: _wam133_fp(ln),
          tokenLen: ln.length,
          _token: opts.includeRaw ? ln : undefined,
        });
        continue;
      }
    }
    // 邮密对 / 邮 token 对 · 多分隔符
    let email = null;
    let password = null;
    let token = null;
    function tryPair(a, b) {
      a = (a || "").trim();
      b = (b || "").trim();
      if (!a || !b) return false;
      const aIsEmail = _wam133_isEmail(a);
      const bIsEmail = _wam133_isEmail(b);
      if (aIsEmail) {
        email = a;
        const bTok = _wam133_tokenKind(b);
        if (bTok) token = b;
        else password = b;
        return true;
      }
      if (bIsEmail) {
        email = b;
        password = a; // a 不会是 token (token regex 排了 @)
        return true;
      }
      return false;
    }
    let matched = false;
    if (/----+/.test(ln)) {
      const i = ln.search(/----+/);
      const m = ln.substring(i).match(/^----+/);
      matched = tryPair(ln.substring(0, i), ln.substring(i + m[0].length));
    }
    if (!matched && ln.includes("\t")) {
      const i = ln.indexOf("\t");
      matched = tryPair(ln.substring(0, i), ln.substring(i + 1));
    }
    if (!matched && !/^https?:\/\//i.test(ln)) {
      const ci = ln.search(/[:：=＝]/);
      if (ci !== -1) {
        matched = tryPair(ln.substring(0, ci), ln.substring(ci + 1));
      }
    }
    if (!matched && ln.includes("|")) {
      const i = ln.indexOf("|");
      matched = tryPair(ln.substring(0, i), ln.substring(i + 1));
    }
    if (!matched) {
      const ws = ln.match(/^(\S+)\s+(\S.*?)\s*$/);
      if (ws) matched = tryPair(ws[1], ws[2]);
    }
    if (matched && email && (password || token)) {
      const item = {
        line: lineNo,
        kind: token ? "email_token" : "email_password",
        email,
        emailMasked: _wam133_maskEmail(email),
      };
      if (password) {
        item.passwordFp = _wam133_fp(password);
        item.passwordLen = password.length;
        if (opts.includeRaw) item._password = password;
      }
      if (token) {
        item.tokenKind = _wam133_tokenKind(token);
        item.tokenMasked = _wam133_maskToken(token);
        item.tokenFp = _wam133_fp(token);
        item.tokenLen = token.length;
        if (opts.includeRaw) item._token = token;
      }
      items.push(item);
      continue;
    }
    items.push({
      line: lineNo,
      kind: "ignored",
      sampleMasked: ln.length > 20 ? ln.slice(0, 8) + "…" : ln,
      length: ln.length,
    });
  }
  return { items, rawCount: lines.length };
}

// 印 133 · 健康注入 (合 wam-state.health[email_lower] → item.health + item.usable)
function _wam133_attachHealth(items, healthMap) {
  if (!items || !healthMap) return items;
  for (const it of items) {
    if (it.kind !== "email_password" && it.kind !== "email_token") continue;
    const key = (it.email || "").toLowerCase();
    const h = healthMap[key];
    if (!h) continue;
    it.health = {
      plan: h.plan || null,
      daily: typeof h.daily === "number" ? h.daily : null,
      weekly: typeof h.weekly === "number" ? h.weekly : null,
      daysLeft: typeof h.daysLeft === "number" ? h.daysLeft : null,
      planEnd: h.planEnd || null,
      lastChecked: h.lastChecked || null,
      checked: !!h.checked,
    };
    // 综合可用 (复 wam_bridge.isClaudeAvailable)
    const p = (h.plan || "").toLowerCase();
    let usable = !!h.checked;
    if (/^free$|^waitlist/i.test(p)) usable = false;
    if (
      /trial|free/i.test(p) &&
      h.planEnd > 0 &&
      Date.now() > h.planEnd &&
      (h.daily || 0) <= 0 &&
      (h.weekly || 0) <= 0
    )
      usable = false;
    it.usable = usable;
  }
  return items;
}

// 印 133 · GET /admin/wam/local · 主公本机起时知 ~/.wam · Devin VM 端透返 available=false
async function handleAdminWamLocal(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const includeRaw = url.searchParams.get("raw") === "1";
    const ra = (req.socket && req.socket.remoteAddress) || "";
    const isLocal = /^(127\.|::1$|::ffff:127\.|localhost)/i.test(ra);
    if (includeRaw && !isLocal) {
      return sendJson(res, 403, {
        ok: false,
        error: "raw_only_localhost",
        hint: "?raw=1 仅本机访 · 帛书三十六『邦利器不可以视人』",
      });
    }
    const paths = _wam133_paths();
    const fs = require("fs");
    if (!fs.existsSync(paths.accountsMd)) {
      return sendJson(res, 200, {
        ok: true,
        available: false,
        items: [],
        pathHint: "~/.wam/accounts.md",
        hint: "~/.wam/accounts.md 不存 · 非主公本机起 dao_proxy · 或 WAM 扩展未装",
      });
    }
    const md = fs.readFileSync(paths.accountsMd, "utf8");
    const parsed = _wam133_parseAccountsMd(md, { includeRaw: false });
    let stateAvailable = false;
    let stateMeta = null;
    if (fs.existsSync(paths.stateJson)) {
      try {
        const raw = JSON.parse(fs.readFileSync(paths.stateJson, "utf8"));
        const health = raw.health || {};
        _wam133_attachHealth(parsed.items, health);
        stateAvailable = true;
        stateMeta = {
          version: raw.version,
          savedAt: raw.savedAt,
          healthCount: Object.keys(health).length,
          activeEmail: raw.activeEmail || null,
          switches: raw.switches || 0,
        };
      } catch (e) {
        stateMeta = { error: "parse: " + e.message };
      }
    }
    let countEmailPw = 0,
      countEmailToken = 0,
      countToken = 0,
      countIgnored = 0;
    let countHealthy = 0,
      countDirectUsable = 0,
      countAuth1 = 0;
    for (const it of parsed.items) {
      if (it.kind === "email_password") countEmailPw++;
      else if (it.kind === "email_token") countEmailToken++;
      else if (it.kind === "token") countToken++;
      else if (it.kind === "ignored") countIgnored++;
      if (it.usable === true) countHealthy++;
      if (it.kind === "token" || it.kind === "email_token") countDirectUsable++;
      if (it.tokenKind === "auth1") countAuth1++;
    }
    return sendJson(res, 200, {
      ok: true,
      available: true,
      pathHint: "~/.wam/accounts.md",
      stateAvailable,
      state: stateMeta,
      rawLines: parsed.rawCount,
      counts: {
        total: parsed.items.length,
        emailPassword: countEmailPw,
        emailToken: countEmailToken,
        tokenOnly: countToken,
        ignored: countIgnored,
        healthy: countHealthy,
        directUsable: countDirectUsable,
        auth1: countAuth1,
      },
      items: parsed.items,
    });
  } catch (e) {
    return sendJson(res, 500, {
      ok: false,
      error: "wam_local_read_failed",
      message: e.message,
    });
  }
}

// 印 133 · POST /admin/wam/use {index, mode} · 单件入池 · server 端读真直推 (web 不经手)
async function handleAdminWamUse(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, {
      ok: false,
      error: "bad_json",
      message: e.message,
    });
  }
  const index = parseInt(body && body.index, 10);
  if (!Number.isInteger(index) || index < 0) {
    return sendJson(res, 400, {
      ok: false,
      error: "index_required",
      hint: "POST /admin/wam/use { index: 0+, mode?: 'auto'|'token-direct'|'email-login' }",
    });
  }
  const reqMode = (body && body.mode) || "auto";
  // 守: 仅本机 (帛书三十六『邦利器不可以视人』· token 不离本机)
  const ra = (req.socket && req.socket.remoteAddress) || "";
  const isLocal = /^(127\.|::1$|::ffff:127\.|localhost)/i.test(ra);
  if (!isLocal) {
    return sendJson(res, 403, {
      ok: false,
      error: "wam_use_localhost_only",
      hint: "/admin/wam/use 仅本机访 · 帛书三十六『邦利器不可以视人』",
    });
  }
  const paths = _wam133_paths();
  const fs = require("fs");
  if (!fs.existsSync(paths.accountsMd)) {
    return sendJson(res, 404, {
      ok: false,
      error: "wam_md_not_found",
      pathHint: "~/.wam/accounts.md",
    });
  }
  const md = fs.readFileSync(paths.accountsMd, "utf8");
  const parsed = _wam133_parseAccountsMd(md, { includeRaw: true });
  if (index >= parsed.items.length) {
    return sendJson(res, 404, {
      ok: false,
      error: "index_out_of_range",
      max: parsed.items.length - 1,
    });
  }
  const item = parsed.items[index];
  if (!item || item.kind === "ignored") {
    return sendJson(res, 400, {
      ok: false,
      error: "item_not_usable",
      kind: item ? item.kind : "missing",
    });
  }
  let mode = reqMode;
  if (mode === "auto") {
    if (item._token || item.kind === "token" || item.kind === "email_token") {
      mode = "token-direct";
    } else if (item._password && item.kind === "email_password") {
      mode = "email-login";
    } else {
      return sendJson(res, 400, {
        ok: false,
        error: "auto_resolve_failed",
        kind: item.kind,
      });
    }
  }
  // ─ 路 A · token-direct (auth1_xxx 直入池 · 跳登 · 帛书四十八「损之又损」)
  if (mode === "token-direct") {
    const rawTok = item._token;
    if (!rawTok) {
      return sendJson(res, 400, {
        ok: false,
        error: "token_not_resolvable",
        kind: item.kind,
      });
    }
    const dup = WS_POOL_STATE.keys.find((k) => k.apiKey === rawTok);
    if (dup) {
      return sendJson(res, 200, {
        ok: true,
        duplicate: true,
        mode: "token-direct",
        apiKey: _maskKey(rawTok),
        count: WS_POOL_STATE.keys.length,
      });
    }
    WS_POOL_STATE.keys.push({
      apiKey: rawTok,
      srvUrl: "https://server.codeium.com",
      email: item.email || "",
      ok: 0,
      err: 0,
      lastUsedAt: 0,
      lastErrAt: 0,
      cooldownUntil: 0,
      plan: (item.health && item.health.plan) || null,
      addedAt: Date.now(),
    });
    WS_POOL_STATE.loaded = true;
    WS_POOL_STATE.err = null;
    console.log(
      `[admin/wam/use:token-direct] ✓ idx=${index} kind=${item.tokenKind || "?"} ${_maskKey(rawTok)} email=${item.email || "?"} pool=${WS_POOL_STATE.keys.length}`,
    );
    return sendJson(res, 200, {
      ok: true,
      mode: "token-direct",
      action: "pool.push",
      apiKey: _maskKey(rawTok),
      tokenKind: item.tokenKind || _wam133_tokenKind(rawTok),
      email: item.email || "",
      count: WS_POOL_STATE.keys.length,
    });
  }
  // ─ 路 B · email-login (三步登 印 129 · 出 ws-* · 入池)
  if (mode === "email-login") {
    if (!item._password) {
      return sendJson(res, 400, {
        ok: false,
        error: "password_not_resolvable",
        kind: item.kind,
      });
    }
    try {
      const out = await _signin_orchestrate(item.email, item._password, "");
      if (!out.ok) {
        return sendJson(
          res,
          401,
          Object.assign({ mode: "email-login", email: item.email }, out),
        );
      }
      const apiKey = out.apiKey;
      const dup = WS_POOL_STATE.keys.find((k) => k.apiKey === apiKey);
      if (!dup) {
        WS_POOL_STATE.keys.push({
          apiKey,
          srvUrl: out.apiServerUrl || "https://server.codeium.com",
          email: item.email,
          ok: 0,
          err: 0,
          lastUsedAt: 0,
          lastErrAt: 0,
          cooldownUntil: 0,
          plan: null,
          addedAt: Date.now(),
        });
        WS_POOL_STATE.loaded = true;
        WS_POOL_STATE.err = null;
      }
      console.log(
        `[admin/wam/use:email-login] ✓ idx=${index} ${item.email} ${_maskKey(apiKey)} pool=${WS_POOL_STATE.keys.length}`,
      );
      return sendJson(res, 200, {
        ok: true,
        mode: "email-login",
        action: dup ? "pool.duplicate" : "pool.push",
        email: item.email,
        apiKey: _maskKey(apiKey),
        ms: out.ms,
        count: WS_POOL_STATE.keys.length,
      });
    } catch (e) {
      return sendJson(res, 500, {
        ok: false,
        mode: "email-login",
        stage: "crash",
        error: e.message,
      });
    }
  }
  return sendJson(res, 400, {
    ok: false,
    error: "unknown_mode",
    mode,
    hint: "mode ∈ {auto, token-direct, email-login}",
  });
}

// ─── 印 105 · windsurf chat 真转 (反程印 104 之未尽) ───
// 反程实证 (2026-05-14):
//   路径: /exa.api_server_pb.ApiServerService/GetChatMessage  (非 LanguageServerService · 那是 LSP-internal)
//   CT:   application/connect+json  (server-streaming · Connect-RPC frames)
//   Auth: X-Api-Key header  +  body.metadata.apiKey
//   Host: server.codeium.com (最稳) / server.self-serve.windsurf.com / web-backend.windsurf.com
//   错:   resource_exhausted = quota 耗尽 (cooldown · 不为 fatal)
//         invalid_argument   = 入参错 (fatal · 不轮)
//         unauthenticated    = key 错 (永 cooldown)

const WS_CHAT_HOSTS = [
  "server.codeium.com",
  "server.self-serve.windsurf.com",
  "web-backend.windsurf.com",
];
const WS_CHAT_PATH = "/exa.api_server_pb.ApiServerService/GetChatMessage";

// Connect-RPC frame parser: [1-byte flags][4-byte length BE][payload]
// flags=0x00 = data; flags=0x02 = end-of-stream (trailers/error)
function parseConnectFrames(buf) {
  const frames = [];
  let off = 0;
  while (off + 5 <= buf.length) {
    const flags = buf[off];
    const len = buf.readUInt32BE(off + 1);
    if (off + 5 + len > buf.length) break;
    frames.push({ flags, payload: buf.slice(off + 5, off + 5 + len) });
    off += 5 + len;
  }
  return { frames, rest: buf.slice(off) };
}

// windsurf chat (核 · 真转)
// 入: { apiKey, messages: [{role,content}], model, onDelta?, timeoutMs? }
// 出: { ok, text, tokens, host, errCode, errMsg, status, frames }
function wsChat({ keyObj, messages, model, onDelta, timeoutMs = 60000 }) {
  return new Promise((resolve) => {
    const https = require("https");
    const sessionId = crypto.randomUUID();

    // 转 OpenAI messages → windsurf chatMessages 格式
    const chatMessages = messages.map((m) => {
      const src =
        m.role === "system" || m.role === "user"
          ? "CHAT_MESSAGE_SOURCE_USER"
          : "CHAT_MESSAGE_SOURCE_ASSISTANT";
      return { source: src, content: { text: String(m.content || "") } };
    });

    // model 别名 → windsurf 真 modelUid
    const modelMap = {
      "swe-1.5": "MODEL_SWE_1_5",
      "swe-1": "MODEL_SWE_1",
      "windsurf-swe-1.5": "MODEL_SWE_1_5",
      "windsurf-swe-1": "MODEL_SWE_1",
      "claude-3-5-sonnet": "MODEL_CLAUDE_3_5_SONNET",
      "claude-3-7-sonnet": "MODEL_CLAUDE_3_7_SONNET",
      "gpt-4.1": "MODEL_GPT_4_1",
      "gpt-5": "MODEL_GPT_5",
    };
    const modelUid = modelMap[model] || model || "MODEL_SWE_1_5";

    const body = JSON.stringify({
      metadata: {
        ideName: "windsurf",
        ideVersion: "1.99.0",
        extensionName: "windsurf",
        extensionVersion: "1.99.0",
        apiKey: keyObj.apiKey,
        sessionId,
        requestId: "1",
        locale: "en",
        os: "windows",
      },
      modelUid,
      chatMessages,
    });

    // 轮 hosts (印 105 · 先 server.codeium.com · 印 ∞.4 治: keyObj.srvUrl 优)
    // 印 ∞.4 道动测发现 (2026-05-17 12:30):
    //   - admin/keys/add 收 srvUrl 但 wsChat 不用 keyObj.srvUrl · 是硬编码列表
    //   - 真 windsurf register 返 api_server_url = https://server.self-serve.windsurf.com
    //   - 但 wsChat 先试 server.codeium.com · 浪费一轮
    //   治: 若 keyObj.srvUrl 有效 · 立其 hostname 为首试 · 再回退 WS_CHAT_HOSTS
    //   帛书廿七: 「善行者无辙迹 · 善结者无绳约而不可解也」(顺势而为)
    let hostList = WS_CHAT_HOSTS.slice();
    try {
      if (keyObj && keyObj.srvUrl) {
        const u = new URL(keyObj.srvUrl);
        if (u.hostname && !hostList.includes(u.hostname)) {
          hostList = [u.hostname].concat(hostList); // 用户给定 host 先试
        } else if (u.hostname) {
          // 已在列表 · 移至首位
          hostList = [u.hostname].concat(
            hostList.filter((h) => h !== u.hostname),
          );
        }
      }
    } catch {}
    let hostIdx = 0;
    const tryHost = (host) => {
      const opts = {
        hostname: host,
        path: WS_CHAT_PATH,
        method: "POST",
        headers: {
          "Content-Type": "application/connect+json",
          "Connect-Protocol-Version": "1",
          "X-Api-Key": keyObj.apiKey,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      };
      const t0 = Date.now();
      let buf = Buffer.alloc(0);
      let fullText = "";
      let tokens = 0;
      let errCode = null;
      let errMsg = null;
      let frames = 0;

      const req = https.request(opts, (r) => {
        r.on("data", (c) => {
          buf = Buffer.concat([buf, c]);
          const { frames: fs, rest } = parseConnectFrames(buf);
          buf = rest;
          for (const f of fs) {
            frames++;
            try {
              const j = JSON.parse(f.payload.toString("utf8"));
              if (f.flags === 0x02) {
                // end-of-stream / trailer · 含 error or metadata
                if (j.error) {
                  errCode = j.error.code;
                  errMsg = j.error.message;
                }
              } else {
                // data frame · 含 delta_message / chat_message
                const dm = j.deltaMessage || j.delta_message || j.message || j;
                const content = dm.content || dm.contentChunk || {};
                const txt = content.text || dm.text || j.text || "";
                if (txt) {
                  fullText += txt;
                  if (onDelta) {
                    try {
                      onDelta(txt);
                    } catch {}
                  }
                }
                // token count (若有)
                if (typeof j.tokens === "number") tokens = j.tokens;
                else if (typeof dm.tokens === "number") tokens = dm.tokens;
              }
            } catch {
              // 非 JSON · 忽 (可能 raw protobuf)
            }
          }
        });
        r.on("end", () => {
          const ms = Date.now() - t0;
          if (errCode === "resource_exhausted") {
            keyObj.err++;
            keyObj.lastErrAt = Date.now();
            keyObj.cooldownUntil = Date.now() + 60_000; // 60s 短冷却 (quota 可能 reset 快)
            resolve({
              ok: false,
              status: r.statusCode,
              errCode,
              errMsg,
              host,
              durationMs: ms,
              frames,
            });
          } else if (errCode === "unauthenticated") {
            keyObj.err++;
            keyObj.cooldownUntil = Date.now() + 600_000; // 10min 长冷却
            resolve({
              ok: false,
              status: r.statusCode,
              errCode,
              errMsg,
              host,
              durationMs: ms,
              frames,
            });
          } else if (errCode || (r.statusCode >= 400 && !fullText)) {
            keyObj.err++;
            resolve({
              ok: false,
              status: r.statusCode,
              errCode: errCode || "http_error",
              errMsg: errMsg || `HTTP ${r.statusCode}`,
              host,
              durationMs: ms,
              frames,
            });
          } else if (fullText) {
            keyObj.ok++;
            resolve({
              ok: true,
              text: fullText,
              tokens,
              host,
              durationMs: ms,
              frames,
            });
          } else {
            keyObj.err++;
            resolve({
              ok: false,
              status: r.statusCode,
              errCode: "empty_response",
              errMsg: "no text in any frame",
              host,
              durationMs: ms,
              frames,
            });
          }
        });
      });
      req.on("error", (e) => {
        // 印 ∞.4 · 用动态 hostList (含 keyObj.srvUrl 首位)
        if (hostIdx < hostList.length - 1) {
          hostIdx++;
          tryHost(hostList[hostIdx]); // host 故障 · 试下一
        } else {
          keyObj.err++;
          resolve({ ok: false, errCode: "network", errMsg: e.message });
        }
      });
      req.on("timeout", () => {
        req.destroy();
        keyObj.err++;
        resolve({ ok: false, errCode: "timeout", errMsg: `${timeoutMs}ms` });
      });
      req.write(body);
      req.end();
    };
    // 印 ∞.4 · hostList 含 keyObj.srvUrl 首位 (若有效)
    tryHost(hostList[0]);
  });
}

// windsurf model 识别 (model name 含 windsurf/ws/swe/cascade/sonnet/opus/gpt-5/kimi → 走 windsurf)
const WS_MODEL_PREFIXES = ["windsurf-", "ws-", "MODEL_SWE", "MODEL_CASCADE"];
const WS_MODEL_KEYWORDS = ["windsurf"]; // 收: 仅 windsurf-xxx 走 ws · 余 (sonnet/opus/gpt-5/kimi) 仍走 Devin
function isWindsurfModel(model) {
  if (!model) return false;
  const m = model.toLowerCase();
  if (WS_MODEL_PREFIXES.some((p) => m.startsWith(p.toLowerCase()))) return true;
  if (WS_MODEL_KEYWORDS.some((k) => m.includes(k.toLowerCase()))) return true;
  return false;
}

// 启动时同步加载
loadWindsurfPool();

// ════════════════════════════════════════════════════════════════════════
// § 6 · WSS ACP 客 (chatViaWss · 承印 90 bridge.js 之骨)
//   ACP 协议: open → initialize → session/new → session/prompt → chunks → end_turn
// ════════════════════════════════════════════════════════════════════════
function chatViaWss({
  sysPrompt,
  userText,
  model,
  onChunk,
  timeoutMs,
  tokenObj,
}) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const u = new URL(CFG.wssUrl);
    u.searchParams.set("token", tokenObj.token);

    const ws = new WebSocketImpl(u.toString());
    const state = {
      sessionId: null,
      stopReason: null,
      usage: null,
      content: "",
      firstChunkAt: 0,
      closed: false,
      nextId: 1,
      pending: new Map(),
    };

    const tid = setTimeout(() => {
      if (state.closed) return;
      cleanup(new Error(`timeout ${timeoutMs}ms`));
    }, timeoutMs);

    function cleanup(err) {
      if (state.closed) return;
      state.closed = true;
      clearTimeout(tid);
      try {
        ws.close();
      } catch {}
      if (err) {
        markErr(tokenObj, err.message);
        reject(err);
      } else {
        markOk(tokenObj);
        resolve({
          content: state.content,
          stopReason: state.stopReason,
          usage: state.usage,
          sessionId: state.sessionId,
          firstChunkMs: state.firstChunkAt - t0,
          totalMs: Date.now() - t0,
        });
      }
    }

    function send(obj) {
      if (!obj.id) obj.id = state.nextId++;
      state.pending.set(obj.id, obj.method);
      try {
        ws.send(JSON.stringify(obj));
      } catch (e) {
        cleanup(new Error("send failed: " + e.message));
      }
    }

    const addEv = (name, fn) => {
      // 印 122 · sp_observe 自动 wrap message · 主公真用即累积 server-side SP 全演化
      const wrapped =
        name === "message" && __spObserve
          ? function (ev) {
              try {
                const data = ev && ev.data !== undefined ? ev.data : ev;
                __spObserve.capture(data);
              } catch {}
              return fn.apply(this, arguments);
            }
          : fn;
      if (ws.addEventListener) ws.addEventListener(name, wrapped);
      else ws.on(name, wrapped);
    };

    addEv("open", () => {
      logD(`wss open · ${mask(tokenObj.token)} · ${Date.now() - t0}ms`);
      send({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: true, writeTextFile: true },
            terminal: true,
            elicitation: { form: {} },
            _meta: {
              "cognition.ai/subagentSupport": false,
              "cognition.ai/multiRootWorkspace": false,
              "cognition.ai/partialContent": true,
              "cognition.ai/messageGrouping": true,
              "cognition.ai/groupedSessionConfigOptions": false,
              "cognition.ai/requestDiagnostics": false,
            },
          },
        },
      });
    });

    addEv("error", (ev) => {
      const m = ev?.message || ev?.error?.message || "ws error";
      cleanup(new Error("wss error: " + m));
    });

    addEv("close", (ev) => {
      if (state.closed) return;
      if (state.stopReason === "end_turn") {
        cleanup(null);
      } else {
        cleanup(
          new Error("wss closed prematurely · code=" + (ev?.code || "?")),
        );
      }
    });

    addEv("message", (ev) => {
      let raw = ev.data !== undefined ? ev.data : ev;
      if (raw instanceof ArrayBuffer) raw = Buffer.from(raw).toString("utf8");
      if (Buffer.isBuffer(raw)) raw = raw.toString("utf8");
      if (typeof raw !== "string") return;

      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        let m;
        try {
          m = JSON.parse(line);
        } catch {
          continue;
        }
        handle(m);
      }
    });

    function handle(m) {
      const id = m.id;
      const method = m.method || state.pending.get(id) || "";

      // agent → client 请求 (granted 即可 · 不真做)
      if (
        m.method === "fs/read_text_file" ||
        m.method === "fs/write_text_file" ||
        m.method === "terminal/create" ||
        m.method === "terminal/output" ||
        m.method === "terminal/release" ||
        m.method === "terminal/kill" ||
        m.method === "terminal/wait_for_exit"
      ) {
        if (m.id) send({ jsonrpc: "2.0", id: m.id, result: null });
        return;
      }
      if (m.method === "session/request_permission") {
        if (m.id) send({ jsonrpc: "2.0", id: m.id, result: { granted: true } });
        return;
      }
      if (
        m.method === "ext/method" &&
        m.params?.method === "_session/elicitation"
      ) {
        if (m.id) send({ jsonrpc: "2.0", id: m.id, result: {} });
        return;
      }

      // session/update 流
      if (m.method === "session/update") {
        const u = m.params?.update || {};
        const up = u.sessionUpdate;
        if (up === "agent_message_chunk") {
          const t = u?.content?.text || "";
          if (t) {
            state.content += t;
            if (!state.firstChunkAt) state.firstChunkAt = Date.now();
            if (typeof onChunk === "function") {
              try {
                onChunk(t);
              } catch {}
            }
          }
        }
        if (u.stopReason) state.stopReason = u.stopReason;
        if (u.usage) state.usage = u.usage;
        return;
      }

      // RPC 响应
      state.pending.delete(id);

      if (method === "initialize" && m.result) {
        send({
          jsonrpc: "2.0",
          method: "session/new",
          params: { cwd: "/tmp", mcpServers: [], additionalDirectories: [] },
        });
        return;
      }
      if (method === "initialize" && m.error) {
        cleanup(new Error("initialize: " + m.error.message));
        return;
      }

      if (method === "session/new") {
        if (m.result?.sessionId) {
          state.sessionId = m.result.sessionId;
          // 若有 model · 立 set_config_option (省 ACU · 默 devin-2-5 即可)
          const promptParts = [];
          if (sysPrompt) promptParts.push({ type: "text", text: sysPrompt });
          promptParts.push({
            type: "text",
            text: sysPrompt ? "\n\n" + userText : userText,
          });
          send({
            jsonrpc: "2.0",
            method: "session/prompt",
            params: {
              sessionId: state.sessionId,
              prompt: promptParts,
            },
          });
        } else if (m.error) {
          cleanup(new Error("session/new: " + m.error.message));
        }
        return;
      }

      if (method === "session/prompt") {
        if (m.result !== undefined) {
          if (m.result.stopReason) state.stopReason = m.result.stopReason;
          if (m.result.usage) state.usage = m.result.usage;
          // 等 close · 0.3s 缓 (容流尾)
          setTimeout(() => cleanup(null), 300);
        } else if (m.error) {
          cleanup(new Error("session/prompt: " + m.error.message));
        }
        return;
      }
    }
  });
}

// ════════════════════════════════════════════════════════════════════════
// § 7 · metrics (轻 · in-memory)
// ════════════════════════════════════════════════════════════════════════
const METRICS = {
  startedAt: Date.now(),
  requests: { total: 0, openai: 0, anthropic: 0, gemini: 0, windsurf: 0 },
  successes: { total: 0 },
  errors: { total: 0 },
  latencies: [],
};
function recReq(t) {
  METRICS.requests.total++;
  if (t in METRICS.requests) METRICS.requests[t]++;
}
function recOk(ms) {
  METRICS.successes.total++;
  if (typeof ms === "number" && ms > 0) {
    METRICS.latencies.push(ms);
    if (METRICS.latencies.length > 100) METRICS.latencies.shift();
  }
}
function recErr() {
  METRICS.errors.total++;
}
function snapMetrics() {
  const lats = [...METRICS.latencies].sort((a, b) => a - b);
  const p = (q) =>
    lats.length === 0
      ? 0
      : lats[Math.min(lats.length - 1, Math.floor((lats.length * q) / 100))];
  return {
    startedAt: METRICS.startedAt,
    uptimeMs: Date.now() - METRICS.startedAt,
    requests: METRICS.requests,
    successes: METRICS.successes,
    errors: METRICS.errors,
    successRate:
      METRICS.requests.total > 0
        ? Math.round(
            (METRICS.successes.total / METRICS.requests.total) * 10000,
          ) / 10000
        : null,
    latencyMs: {
      count: lats.length,
      p50: p(50),
      p95: p(95),
      p99: p(99),
      min: lats[0] || 0,
      max: lats[lats.length - 1] || 0,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════
// § 8 · HTTP 助函 (读 body · CORS · JSON · SSE)
// ════════════════════════════════════════════════════════════════════════
function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function readJson(req) {
  return readBody(req).then((b) => {
    try {
      return JSON.parse(b.toString("utf8") || "{}");
    } catch (e) {
      throw new Error("JSON parse: " + e.message);
    }
  });
}
function corsSet(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, anthropic-version, x-api-key, x-goog-api-key, x-dao-account",
  );
}
function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj, null, 2));
}
function sseStart(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
}
function sseData(res, obj) {
  res.write("data: " + JSON.stringify(obj) + "\n\n");
}
function sseEnd(res) {
  res.write("data: [DONE]\n\n");
  res.end();
}

// 提 text · 容 string + array of {type:"text"|"input_text", text}
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          if (typeof p.text === "string") return p.text;
          if (typeof p.content === "string") return p.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (
    content &&
    typeof content === "object" &&
    typeof content.text === "string"
  )
    return content.text;
  return "";
}

// 合 messages → 末次 user text (Devin 单笔 prompt 模式 · 不支多轮原生 · 把历史拼成单大 user)
function flattenForPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0)
    return { sysPrompt: "", userText: "(empty)" };
  // 取 system 单独 (process 已挪到 [0]) · 余按 role 拼
  let sys = "";
  const conv = [];
  for (const m of messages) {
    const text = extractText(m.content);
    if (m.role === "system") {
      sys = sys ? sys + "\n\n" + text : text;
    } else if (m.role === "user") {
      conv.push("User: " + text);
    } else if (m.role === "assistant") {
      conv.push("Assistant: " + text);
    }
  }
  // 末次 user 单独标识
  let userText = conv.join("\n\n");
  if (!userText) userText = "(empty)";
  return { sysPrompt: sys, userText };
}

function newId(prefix) {
  return prefix + "_" + crypto.randomBytes(12).toString("hex");
}

// ════════════════════════════════════════════════════════════════════════
// § 9 · 三协议 适配器 (OpenAI · Anthropic · Gemini)
// ════════════════════════════════════════════════════════════════════════

// ───── OpenAI 兼容 · POST /v1/chat/completions ─────
// 印 104: 智能路由 — model 含 windsurf/swe/cascade/sonnet/opus → windsurf; 否则 → devin
// 印 ∞.2 · 加 forceEngine 参 · "devin" 显式跳智能分流 · 走 /dc/* B 路 (弱者道之用)
async function handleOpenAI(req, res, forceEngine) {
  recReq("openai");
  const t0 = Date.now();
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    recErr();
    return sendJson(res, 400, {
      error: { message: e.message, type: "bad_request" },
    });
  }
  const model = body.model || CFG.defaultModel;
  const stream = body.stream === true;
  const account =
    req.headers["x-dao-account"] || req.headers["x-account"] || undefined;

  // 印 106 · 路由 · model 含 windsurf-/MODEL_SWE/MODEL_CASCADE 走 windsurf ConnectRPC
  // (双池真分: Devin token (WSS) vs Windsurf api-key (HTTPS) · 不混)
  // 印 ∞.2 · forceEngine="devin" 时跳此判 · 显式走 devin cloud (B 路 · 显式不智能)
  if (forceEngine !== "devin" && isWindsurfModel(model)) {
    logI(
      `openai → windsurf 路 · model=${C.B(model)} · ws-pool=${WS_POOL_STATE.keys.length}`,
    );
    return handleWindsurfChat(req, res, body, model, account);
  }

  const { messages, meta } = processMessages(body.messages || [], {
    model,
    account,
  });
  const { sysPrompt, userText } = flattenForPrompt(messages);

  const tokenObj = pickToken();
  if (!tokenObj) {
    recErr();
    return sendJson(res, 503, {
      error: { message: "no token available", type: "no_token" },
    });
  }
  logI(
    `openai ${stream ? "stream" : "non-stream"} · model=${C.B(model)} · sp=${C.Y(meta.strategy)} · sys=${meta.finalSpLen}B · usr=${userText.length}B · tok=${mask(tokenObj.token)}`,
  );

  const reqId = newId("chatcmpl");
  const created = Math.floor(Date.now() / 1000);

  if (!stream) {
    try {
      const r = await chatViaWssRetry({
        sysPrompt,
        userText,
        model,
        timeoutMs: CFG.promptTimeoutMs,
        tokenObj,
      });
      const ms = Date.now() - t0;
      recOk(ms);
      sendJson(res, 200, {
        id: reqId,
        object: "chat.completion",
        created,
        model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: r.content },
            finish_reason:
              r.stopReason === "end_turn" ? "stop" : r.stopReason || "stop",
          },
        ],
        usage: r.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
        x_dao: {
          engine: "devin-cloud",
          seal: "印 101",
          sessionId: r.sessionId,
          firstChunkMs: r.firstChunkMs,
          totalMs: r.totalMs,
          sp: meta,
        },
      });
    } catch (e) {
      recErr();
      sendJson(res, 502, {
        error: { message: e.message, type: "upstream_error" },
        x_dao: { sp: meta },
      });
    }
    return;
  }

  // ─ stream ─
  sseStart(res);
  // role chunk
  sseData(res, {
    id: reqId,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
  });

  let buffered = "";
  try {
    const r = await chatViaWss({
      sysPrompt,
      userText,
      model,
      timeoutMs: CFG.promptTimeoutMs,
      tokenObj,
      onChunk: (text) => {
        sseData(res, {
          id: reqId,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [
            { index: 0, delta: { content: text }, finish_reason: null },
          ],
        });
        buffered += text;
      },
    });
    sseData(res, {
      id: reqId,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason:
            r.stopReason === "end_turn" ? "stop" : r.stopReason || "stop",
        },
      ],
    });
    sseEnd(res);
    recOk(Date.now() - t0);
  } catch (e) {
    sseData(res, {
      error: { message: e.message, type: "upstream_error" },
    });
    sseEnd(res);
    recErr();
  }
}

// ───── Anthropic 兼容 · POST /v1/messages ─────
async function handleAnthropic(req, res) {
  recReq("anthropic");
  const t0 = Date.now();
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    recErr();
    return sendJson(res, 400, {
      type: "error",
      error: { type: "invalid_request_error", message: e.message },
    });
  }

  const model = body.model || CFG.defaultModel;
  const stream = body.stream === true;
  const account = req.headers["x-dao-account"] || undefined;

  // Anthropic system 可能在 body.system (string 或 array)
  let msgs = [...(body.messages || [])];
  if (body.system) {
    const sysText = extractText(body.system);
    if (sysText) msgs = [{ role: "system", content: sysText }, ...msgs];
  }

  const { messages, meta } = processMessages(msgs, { model, account });
  const { sysPrompt, userText } = flattenForPrompt(messages);

  const tokenObj = pickToken();
  if (!tokenObj) {
    recErr();
    return sendJson(res, 503, {
      type: "error",
      error: { type: "no_token", message: "no token available" },
    });
  }
  logI(
    `anthropic ${stream ? "stream" : "non-stream"} · model=${C.B(model)} · sp=${C.Y(meta.strategy)}`,
  );

  const msgId = newId("msg");

  if (!stream) {
    try {
      const r = await chatViaWssRetry({
        sysPrompt,
        userText,
        model,
        timeoutMs: CFG.promptTimeoutMs,
        tokenObj,
      });
      recOk(Date.now() - t0);
      sendJson(res, 200, {
        id: msgId,
        type: "message",
        role: "assistant",
        model,
        content: [{ type: "text", text: r.content }],
        stop_reason: r.stopReason === "end_turn" ? "end_turn" : "stop_sequence",
        stop_sequence: null,
        usage: {
          input_tokens: r.usage?.input_tokens || 0,
          output_tokens: r.usage?.output_tokens || 0,
        },
      });
    } catch (e) {
      recErr();
      sendJson(res, 502, {
        type: "error",
        error: { type: "upstream_error", message: e.message },
      });
    }
    return;
  }

  // ─ Anthropic SSE 流 ─
  sseStart(res);
  const send = (eventName, data) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  send("message_start", {
    type: "message_start",
    message: {
      id: msgId,
      type: "message",
      role: "assistant",
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  });
  send("content_block_start", {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  });

  try {
    const r = await chatViaWss({
      sysPrompt,
      userText,
      model,
      timeoutMs: CFG.promptTimeoutMs,
      tokenObj,
      onChunk: (text) => {
        send("content_block_delta", {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text },
        });
      },
    });
    send("content_block_stop", { type: "content_block_stop", index: 0 });
    send("message_delta", {
      type: "message_delta",
      delta: {
        stop_reason: r.stopReason === "end_turn" ? "end_turn" : "stop_sequence",
        stop_sequence: null,
      },
      usage: { output_tokens: r.usage?.output_tokens || 0 },
    });
    send("message_stop", { type: "message_stop" });
    res.end();
    recOk(Date.now() - t0);
  } catch (e) {
    send("error", {
      type: "error",
      error: { type: "upstream_error", message: e.message },
    });
    res.end();
    recErr();
  }
}

// ───── Gemini 兼容 · POST /v1beta/models/{m}:generateContent ─────
//   含 :streamGenerateContent (SSE)
async function handleGemini(req, res, urlPath) {
  recReq("gemini");
  const t0 = Date.now();

  // 取 path 之 model
  const m = urlPath.match(/\/v1beta\/models\/([^:]+):(\w+)/);
  if (!m) {
    recErr();
    return sendJson(res, 404, {
      error: { message: "bad gemini path", code: 404 },
    });
  }
  const model = m[1];
  const op = m[2]; // generateContent or streamGenerateContent
  const stream = op === "streamGenerateContent";

  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    recErr();
    return sendJson(res, 400, { error: { message: e.message, code: 400 } });
  }

  // gemini contents → openai-like messages
  const contents = body.contents || [];
  const msgs = [];
  if (body.systemInstruction) {
    msgs.push({
      role: "system",
      content: extractText(
        body.systemInstruction.parts || body.systemInstruction,
      ),
    });
  }
  for (const c of contents) {
    const txt = (c.parts || [])
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n");
    if (!txt) continue;
    msgs.push({
      role: c.role === "model" ? "assistant" : "user",
      content: txt,
    });
  }

  const account = req.headers["x-dao-account"] || undefined;
  const { messages, meta } = processMessages(msgs, { model, account });
  const { sysPrompt, userText } = flattenForPrompt(messages);

  const tokenObj = pickToken();
  if (!tokenObj) {
    recErr();
    return sendJson(res, 503, { error: { message: "no token", code: 503 } });
  }
  logI(
    `gemini ${stream ? "stream" : "non-stream"} · model=${C.B(model)} · sp=${C.Y(meta.strategy)}`,
  );

  if (!stream) {
    try {
      const r = await chatViaWssRetry({
        sysPrompt,
        userText,
        model,
        timeoutMs: CFG.promptTimeoutMs,
        tokenObj,
      });
      recOk(Date.now() - t0);
      sendJson(res, 200, {
        candidates: [
          {
            content: { role: "model", parts: [{ text: r.content }] },
            finishReason: r.stopReason === "end_turn" ? "STOP" : "STOP",
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: r.usage?.input_tokens || 0,
          candidatesTokenCount: r.usage?.output_tokens || 0,
          totalTokenCount:
            (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0),
        },
        modelVersion: model,
      });
    } catch (e) {
      recErr();
      sendJson(res, 502, { error: { message: e.message, code: 502 } });
    }
    return;
  }

  // gemini streamGenerateContent 用 SSE-like (chunked JSON · 实为 \r\n 分隔)
  // 此处用最简 SSE-like JSON-line · 客户端能识
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Transfer-Encoding": "chunked",
  });
  try {
    const r = await chatViaWss({
      sysPrompt,
      userText,
      model,
      timeoutMs: CFG.promptTimeoutMs,
      tokenObj,
      onChunk: (text) => {
        const chunk = {
          candidates: [
            { content: { role: "model", parts: [{ text }] }, index: 0 },
          ],
        };
        res.write(JSON.stringify(chunk) + "\r\n");
      },
    });
    const tail = {
      candidates: [
        {
          content: { role: "model", parts: [] },
          finishReason: r.stopReason === "end_turn" ? "STOP" : "STOP",
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: r.usage?.input_tokens || 0,
        candidatesTokenCount: r.usage?.output_tokens || 0,
        totalTokenCount:
          (r.usage?.input_tokens || 0) + (r.usage?.output_tokens || 0),
      },
    };
    res.write(JSON.stringify(tail) + "\r\n");
    res.end();
    recOk(Date.now() - t0);
  } catch (e) {
    res.write(JSON.stringify({ error: { message: e.message } }) + "\r\n");
    res.end();
    recErr();
  }
}

// ════════════════════════════════════════════════════════════════════════
// § 10 · 管理路由 (/health · /v1/models · /v1/system/prompt · 等)
// ════════════════════════════════════════════════════════════════════════
const MODELS = [
  // Devin (ACP WSS)
  "devin-cloud",
  "devin-2-5",
  "devin-fast",
  "devin-cloud-claude",
  "devin-cloud-claude-haiku",
  "devin-cloud-gpt",
  "devin-cloud-gpt4o",
  "devin-cloud-gemini",
  // Windsurf (ConnectRPC · 印 104)
  "windsurf-swe-1.5",
  "windsurf-cascade",
  "windsurf-sonnet",
  "windsurf-opus",
  "windsurf-gpt-5",
  "windsurf-kimi",
  "swe-1.5",
  "cascade",
];

function handleHealth(req, res) {
  const poolStat = POOL_STATE.pool.map((t) => ({
    src: t.source,
    mask: mask(t.token),
    ok: t.ok,
    err: t.err,
    cooldown: t.cooldownUntil > Date.now() ? t.cooldownUntil - Date.now() : 0,
  }));
  sendJson(res, 200, {
    ok: true,
    version: VERSION,
    seal: SEAL,
    bind: `${CFG.bind}:${CFG.port}`,
    upstream: CFG.wssUrl,
    pool: {
      total: POOL_STATE.pool.length,
      cursor: POOL_STATE.cursor,
      rotateCount: POOL_STATE.rotateCount,
      tokens: poolStat,
    },
    sp: {
      strategy: SP_STATE.strategy,
      opts: SP_STATE.opts,
      customSpLen: (SP_STATE.customSp || "").length,
      globalSpLen: (SP_STATE.globalSp || "").length,
      perAccountKeys: Object.keys(SP_STATE.perAccount),
      perModelKeys: Object.keys(SP_STATE.perModel),
      updatedAt: SP_STATE.updatedAt,
    },
    silk: {
      source: SILK.source,
      path: SILK.path,
      chars: DAO_DE_JING.length,
    },
    // 印 106 · 公网 bearer auth 态 (不漏 token · 仅显是否启)
    auth: {
      enabled: !!CFG.authToken,
      tokenLength: CFG.authToken.length,
      tokenPreview: CFG.authToken
        ? CFG.authToken.slice(0, 6) + "..." + CFG.authToken.slice(-4)
        : null,
      publicPaths: CFG.authPublic,
      accepts: ["Authorization: Bearer", "X-Dao-Auth", "X-Api-Key", "?key="],
    },
    // 印 105 · windsurf 双路真转 (status + chat 都通)
    windsurf: {
      loaded: WS_POOL_STATE.loaded,
      error: WS_POOL_STATE.err,
      keys: WS_POOL_STATE.keys.length,
      cursor: WS_POOL_STATE.cursor,
      rotateCount: WS_POOL_STATE.rotateCount,
      ok_total: WS_POOL_STATE.keys.reduce((a, k) => a + k.ok, 0),
      err_total: WS_POOL_STATE.keys.reduce((a, k) => a + k.err, 0),
      cooldown_keys: WS_POOL_STATE.keys.filter(
        (k) => k.cooldownUntil > Date.now(),
      ).length,
      chat_protocol:
        "POST /exa.api_server_pb.ApiServerService/GetChatMessage (application/connect+json)",
      chat_status: "live (真转 · Free tier 当下 quota 全耗尽 · 待 reset)",
      working: [
        "POST /windsurf/chat (真转 · 轮 pool · 错诚)",
        "GET /windsurf/status",
        "GET /windsurf/status/all",
        "GET /windsurf/quota",
        "GET /windsurf/models",
      ],
    },
    metrics: snapMetrics(),
    observeCount: OBSERVE_RING.length,
    timestamp: Date.now(),
  });
}

function handleModels(req, res) {
  sendJson(res, 200, {
    object: "list",
    data: MODELS.map((m) => ({
      id: m,
      object: "model",
      created: Math.floor(METRICS.startedAt / 1000),
      owned_by: "dao-shell",
    })),
  });
}

// ════════════════════════════════════════════════════════════════════════
// § 9b · 印 ∞.2 · B 路 · /dc/* 显式 devin cloud 反代 (双反代之实)
// ════════════════════════════════════════════════════════════════════════
//   主公本源诏 (2026-05-17 5:33PM): 「devin vm 双反代 windsurf + devin cloud」
//   帛书·七十八「天下莫柔弱于水 · 而攻坚强者莫之能胜也」弱者道之用
//   帛书·二「美与恶 之相生 · 物之两面同一道」A 路智能 + B 路显式 同一反代
//
//   A 路 · /v1/* · 智能分流 (model 含 ws/cascade/sonnet → ws · 否则 → devin)
//   B 路 · /dc/* · 显式 devin cloud (跳分流 · 即使 cascade 亦走 devin · 调试/绕道)
//   两路同一 dao_proxy · 同一 pool · 同一 SP 态 · 物无非彼物无非是
function handleDcHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    route: "B",
    engine: "devin-cloud",
    seal: SEAL,
    version: VERSION,
    upstream: CFG.wssUrl,
    pool: {
      total: POOL_STATE.pool.length,
      cursor: POOL_STATE.cursor,
      ok_count: POOL_STATE.pool.filter((t) => t.ok).length,
    },
    sp: {
      strategy: SP_STATE.strategy,
      customSpLen: (SP_STATE.customSp || "").length,
    },
    note: "B 路 · 显式 devin cloud · 跳智能分流 · 印 ∞.2",
    timestamp: Date.now(),
  });
}
function handleDcModels(req, res) {
  sendJson(res, 200, {
    object: "list",
    data: MODELS.map((m) => ({
      id: m,
      object: "model",
      created: Math.floor(METRICS.startedAt / 1000),
      owned_by: "devin-cloud",
    })),
    x_dao: { route: "B", engine: "devin-cloud", seal: "印 ∞.2" },
  });
}

async function handleSpGet(req, res) {
  sendJson(res, 200, {
    strategy: SP_STATE.strategy,
    customSp: {
      len: (SP_STATE.customSp || "").length,
      preview: (SP_STATE.customSp || "").slice(0, 120),
    },
    globalSp: {
      len: (SP_STATE.globalSp || "").length,
      preview: (SP_STATE.globalSp || "").slice(0, 120),
    },
    perAccount: Object.fromEntries(
      Object.entries(SP_STATE.perAccount).map(([k, v]) => [
        k,
        { len: v.length, preview: v.slice(0, 120) },
      ]),
    ),
    perModel: Object.fromEntries(
      Object.entries(SP_STATE.perModel).map(([k, v]) => [
        k,
        { len: v.length, preview: v.slice(0, 120) },
      ]),
    ),
    opts: SP_STATE.opts,
    silk: {
      loaded: !!DAO_DE_JING,
      chars: DAO_DE_JING.length,
      source: SILK.source,
    },
    observeCount: OBSERVE_RING.length,
    updatedAt: SP_STATE.updatedAt,
  });
}

async function handleSpPost(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  const allowed = [
    "bypass",
    "override",
    "prepend",
    "append",
    "dao",
    "custom",
    "usernote",
  ];
  if (body.strategy && !allowed.includes(body.strategy)) {
    return sendJson(res, 400, {
      error: "invalid strategy",
      allowed,
    });
  }
  if (body.strategy) SP_STATE.strategy = body.strategy;
  if (typeof body.customSp === "string") SP_STATE.customSp = body.customSp;
  if (typeof body.globalSp === "string") SP_STATE.globalSp = body.globalSp;
  if (body.perAccount && typeof body.perAccount === "object") {
    Object.assign(SP_STATE.perAccount, body.perAccount);
  }
  if (body.perModel && typeof body.perModel === "object") {
    Object.assign(SP_STATE.perModel, body.perModel);
  }
  if (body.opts && typeof body.opts === "object") {
    Object.assign(SP_STATE.opts, body.opts);
  }
  SP_STATE.updatedAt = Date.now();
  sendJson(res, 200, {
    ok: true,
    strategy: SP_STATE.strategy,
    opts: SP_STATE.opts,
    updatedAt: SP_STATE.updatedAt,
  });
}

function handleObserve(req, res, urlObj) {
  const limit = parseInt(urlObj.searchParams.get("limit") || "16", 10);
  sendJson(res, 200, OBSERVE_RING.slice(0, Math.min(limit, OBSERVE_MAX)));
}

// ════════════════════════════════════════════════════════════════════════
// § 印 125 · SP 真注入 dry-run (反者道之动 · 由"号"返"实")
//   主公诏 (2026-05-17 14:53):
//     「锚定本源之底层需求 · 代替我之一切 · 推进到极 · 太极笙万物」
//     「物无非彼 · 物无非是 · 自彼则不见 · 自是则知之」
//
//   印 124 测了 SP "号" (strategy 字段切换) · 未测 SP "实" (真 message 注入).
//   反者道之动 — 由"号"返"实".
//
//   POST /v1/system/sp-dryrun
//     Body: {
//       messages: [{role,content},...],   // 必 · 客端原始 (含 system)
//       strategy?: "bypass"|"dao"|...,     // 可 · 临时切 · 不动 SP_STATE
//       model?: "devin-cloud"|...,         // 可 · 给 ctx.model
//       account?: "user@..."               // 可 · 给 ctx.account
//     }
//   Resp 200: {
//     ok, input: {messageCount, ctx, strategy, opts},
//     output: {messages, meta, firstSystemPreview}
//   }
//
//   守: 仅 process · 不发 wss · 不耗 ACU · 不动 SP_STATE 持久
// ════════════════════════════════════════════════════════════════════════
async function handleSpDryrun(req, res) {
  let body;
  try {
    body = await readJson(req);
  } catch (e) {
    return sendJson(res, 400, { error: e.message });
  }
  if (!body || !Array.isArray(body.messages)) {
    return sendJson(res, 400, {
      error: "messages array required",
      hint: "POST { messages: [{role,content},...], strategy?, model?, account? }",
    });
  }
  const allowed = [
    "bypass",
    "override",
    "prepend",
    "append",
    "dao",
    "custom",
    "usernote",
  ];
  // 临时切 (不动 SP_STATE.strategy 持久)
  const saved = SP_STATE.strategy;
  let switched = false;
  if (body.strategy) {
    if (!allowed.includes(body.strategy)) {
      return sendJson(res, 400, {
        error: "invalid strategy",
        allowed,
      });
    }
    SP_STATE.strategy = body.strategy;
    switched = true;
  }
  try {
    const ctx = {
      model: body.model || CFG.defaultModel,
      account: body.account || "",
    };
    const r = processMessages(body.messages, ctx);
    const sys = r.messages.find((m) => m.role === "system");
    const firstSystemPreview = sys
      ? {
          len: typeof sys.content === "string" ? sys.content.length : 0,
          preview:
            typeof sys.content === "string" ? sys.content.slice(0, 240) : "",
        }
      : null;
    sendJson(res, 200, {
      ok: true,
      input: {
        messageCount: body.messages.length,
        ctx,
        strategy: SP_STATE.strategy,
        opts: SP_STATE.opts,
      },
      output: {
        messages: r.messages,
        meta: r.meta,
        firstSystemPreview,
      },
      dao: { silkLoaded: !!DAO_DE_JING, silkChars: DAO_DE_JING.length },
    });
  } finally {
    if (switched) SP_STATE.strategy = saved;
  }
}

function handleMetrics(req, res) {
  sendJson(res, 200, snapMetrics());
}

// ─── 1 页 dashboard (轻 · 0 外部依) ───
const DASHBOARD_HTML = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8">
<title>真本源单器 · 印 101</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0e1a;color:#d6dfee;font-family:-apple-system,sans-serif;font-size:14px;line-height:1.6}
.w{max-width:1200px;margin:0 auto;padding:24px}
.h{display:flex;justify-content:space-between;border-bottom:1px solid #1c2433;padding-bottom:14px;margin-bottom:20px}
.h h1{font-size:20px;color:#6cb6ff;font-weight:500}
.h .s{color:#5a6878;font-size:12px}
.t{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:20px}
.tile{background:#131826;border:1px solid #1c2433;border-radius:6px;padding:14px}
.tile .l{color:#5a6878;font-size:11px;text-transform:uppercase;letter-spacing:1px}
.tile .v{font-size:18px;font-weight:500;margin-top:6px;word-break:break-all}
.tile .x{color:#5a6878;font-size:11px;margin-top:4px}
.ok{color:#4cd964}.err{color:#ff453a}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.dot.ok{background:#4cd964}.dot.er{background:#ff453a}
.sec{background:#131826;border:1px solid #1c2433;border-radius:6px;padding:18px;margin-bottom:14px}
.sec h2{color:#6cb6ff;font-size:14px;border-bottom:1px solid #1c2433;padding-bottom:8px;margin-bottom:12px}
.btn{background:#1c2433;color:#d6dfee;border:1px solid #2a3548;border-radius:5px;padding:6px 12px;font-size:12px;cursor:pointer;margin-right:6px;margin-bottom:6px}
.btn:hover{background:#2a3548;border-color:#4080c0}
.btn.act{background:#1e3a5f;border-color:#4080c0;color:#6cb6ff}
pre.j{background:#0a0e1a;border:1px solid #1c2433;border-radius:5px;padding:10px;overflow:auto;font-size:11px;max-height:280px}
.f{color:#5a6878;font-size:11px;text-align:center;padding:20px 0;border-top:1px solid #1c2433;margin-top:14px}
.tg{display:inline-block;padding:2px 6px;border-radius:8px;font-size:10px;background:#1c2433;color:#6cb6ff;margin-right:5px}
</style></head><body><div class="w">
<div class="h"><div>
  <h1>真本源_单器 · 印 101 · 原汤化原食</h1>
  <div class="s">「反者道之动 · 弱者道之用」 · 帛书四十 · v${VERSION}</div>
</div><div class="s">10s auto · <span id="rTs">--</span></div></div>
<div class="t" id="tiles"></div>
<div class="sec"><h2>§ SP 三态 (隔离/注入/管理 · 一笔切)</h2>
<div style="margin-bottom:10px"><span class="tg" id="spTg">--</span><span class="s" id="spInfo">--</span></div>
<div>
  <button class="btn" onclick="setSP('bypass')">bypass · 原透</button>
  <button class="btn" onclick="setSP('dao')">★ dao · 帛书 ${DAO_DE_JING.length}字</button>
  <button class="btn" onclick="setSP('usernote')">★ usernote · §3.17 合法槽</button>
  <button class="btn" onclick="setSP('prepend')">prepend · 前</button>
  <button class="btn" onclick="setSP('append')">append · 后</button>
  <button class="btn" onclick="setSP('override')">override · 盖 (∗thinking-loop)</button>
  <button class="btn" onclick="setSP('custom')">custom · 自</button>
</div>
<div style="margin-top:10px"><label class="s">隔离三 toggle: </label>
  <button class="btn" onclick="setOpt('stripSideChannels')">stripSide</button>
  <button class="btn" onclick="setOpt('stripMemoryBlocks')">stripMem</button>
  <button class="btn" onclick="setOpt('neutralizeOverrides')">neutralize</button>
</div></div>
<div class="sec"><h2>§ WAM 池</h2><pre class="j" id="poolJson">loading...</pre></div>
<div class="sec"><h2>§ 客 (一笔三协议)</h2><pre class="j">curl http://${CFG.bind}:${CFG.port}/v1/chat/completions -H "Content-Type: application/json" \\
  -d '{"model":"devin-cloud","messages":[{"role":"user","content":"道可道"}]}'

curl http://${CFG.bind}:${CFG.port}/v1/messages -H "Content-Type: application/json" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{"model":"devin-cloud-claude","max_tokens":256,"messages":[{"role":"user","content":"道可道"}]}'

curl http://${CFG.bind}:${CFG.port}/v1beta/models/devin-cloud:generateContent -H "Content-Type: application/json" \\
  -d '{"contents":[{"role":"user","parts":[{"text":"道可道"}]}]}'</pre></div>
<div class="f">真本源_单器 · 印 101 · 0 deps · 万处可跑 · 原汤化原食<br>
「圣人无积，既以为人己愈有，既以予人己愈多」 · 帛书八十一<br>
seal: ${SEAL_AT}</div></div>
<script>
const $=(id)=>document.getElementById(id);
async function J(p,o){const r=await fetch(p,o);if(!r.ok)throw new Error(p+" "+r.status);return r.json()}
function dot(ok){return '<span class="dot '+(ok?"ok":"er")+'"></span>'}
function fmt(ms){const s=Math.floor(ms/1000);if(s<60)return s+"s";if(s<3600)return Math.floor(s/60)+"m"+(s%60)+"s";return Math.floor(s/3600)+"h"+Math.floor((s%3600)/60)+"m"}
async function refresh(){try{
  const h=await J("/health");
  $("rTs").textContent=new Date().toLocaleTimeString();
  const okPool=h.pool.total>0;
  const tiles=[
    {l:"unified",v:dot(true)+"v"+h.version,x:h.bind,c:"ok"},
    {l:"upstream",v:h.upstream.slice(0,30)+"...",x:"wss · ACP 0.1"},
    {l:"pool",v:dot(okPool)+h.pool.total+" tok",x:"rotate="+h.pool.rotateCount,c:okPool?"ok":"err"},
    {l:"sp",v:h.sp.strategy,x:"silk="+h.silk.chars+"字 ("+h.silk.source+")"},
    {l:"uptime",v:fmt(h.metrics.uptimeMs),x:"req="+h.metrics.requests.total+" · ok="+h.metrics.successes.total+" · err="+h.metrics.errors.total},
    {l:"latency p50/p95",v:(h.metrics.latencyMs.p50||0)+"/"+(h.metrics.latencyMs.p95||0)+"ms",x:"n="+h.metrics.latencyMs.count}
  ];
  $("tiles").innerHTML=tiles.map(t=>'<div class="tile"><div class="l">'+t.l+'</div><div class="v '+(t.c||"")+'">'+t.v+'</div><div class="x">'+(t.x||"")+'</div></div>').join("");
  $("spTg").textContent=h.sp.strategy;
  $("spInfo").textContent="opts: stripSide="+h.sp.opts.stripSideChannels+" · stripMem="+h.sp.opts.stripMemoryBlocks+" · neutralize="+h.sp.opts.neutralizeOverrides;
  $("poolJson").textContent=JSON.stringify(h.pool,null,2);
}catch(e){console.error(e)}}
async function setSP(s){try{await J("/v1/system/prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({strategy:s})});refresh()}catch(e){alert(e.message)}}
async function setOpt(k){const cur=await J("/health");const v=!cur.sp.opts[k];await J("/v1/system/prompt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({opts:{[k]:v}})});refresh()}
refresh();setInterval(refresh,10000);
</script></body></html>`;

function handleDashboard(req, res) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(DASHBOARD_HTML);
}

// ════════════════════════════════════════════════════════════════════════
// § 11 · 主路由
// ════════════════════════════════════════════════════════════════════════
// 印 106 · bearer auth 中间件 (env DAO_AUTH_TOKEN 给则启 · 否则全透)
//   accept formats:
//     Authorization: Bearer <token>
//     X-Dao-Auth: <token>
//     X-Api-Key: <token>
//     ?key=<token>  (query · 仅 GET · for tunnel-friendly dashboard)
//   public paths: see CFG.authPublic (default: /, /health, /dashboard)
function checkAuth(req, urlObj) {
  if (!CFG.authToken) return { ok: true, reason: "no_auth_required" };
  const p = urlObj.pathname;
  if (CFG.authPublic.includes(p)) return { ok: true, reason: "public_path" };

  const ah = req.headers["authorization"] || "";
  const tBearer = ah.startsWith("Bearer ") ? ah.slice(7) : "";
  const tXDao = req.headers["x-dao-auth"] || "";
  const tXApi = req.headers["x-api-key"] || "";
  const tQuery = urlObj.searchParams.get("key") || "";

  const provided = tBearer || tXDao || tXApi || tQuery;
  if (!provided) return { ok: false, reason: "no_credential", code: 401 };
  if (provided !== CFG.authToken)
    return { ok: false, reason: "bad_credential", code: 403 };
  return { ok: true, reason: "credential_match" };
}

const server = http.createServer(async (req, res) => {
  corsSet(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  let urlObj;
  try {
    urlObj = new URL(req.url, `http://${CFG.bind}:${CFG.port}`);
  } catch (e) {
    return sendJson(res, 400, { error: "bad url" });
  }
  const p = urlObj.pathname;
  const method = req.method;

  // 印 106 · 认证 gate (env DAO_AUTH_TOKEN 给则启)
  const auth = checkAuth(req, urlObj);
  if (!auth.ok) {
    res.writeHead(auth.code, {
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="dao-proxy"',
    });
    return res.end(
      JSON.stringify({
        error: {
          type: "unauthorized",
          message: auth.reason,
          hint: "set Authorization: Bearer <DAO_AUTH_TOKEN>  or  X-Dao-Auth: <token>  or  ?key=<token>",
        },
      }),
    );
  }

  // GET /  → dashboard
  if (method === "GET" && (p === "/" || p === "/dashboard"))
    return handleDashboard(req, res);
  // GET /health
  if (method === "GET" && p === "/health") return handleHealth(req, res);
  // GET /metrics
  if (method === "GET" && p === "/metrics") return handleMetrics(req, res);
  // GET /v1/models
  if (method === "GET" && p === "/v1/models") return handleModels(req, res);

  // SP 管理
  if (method === "GET" && p === "/v1/system/prompt")
    return handleSpGet(req, res);
  if (method === "POST" && p === "/v1/system/prompt")
    return handleSpPost(req, res);
  if (method === "GET" && p === "/v1/system/prompt/observe")
    return handleObserve(req, res, urlObj);
  // 印 125 · SP 真注入 dry-run (反者道之动 · 由"号"返"实" · 仅 process · 不发 wss)
  if (method === "POST" && p === "/v1/system/sp-dryrun")
    return handleSpDryrun(req, res);

  // § 印 122 · wss-observe (server-side SP 全演化采集)
  if (__spObserve) {
    const obsH = __spObserve.makeHttpHandlers();
    if (method === "GET" && p === "/v1/system/wss-observe")
      return obsH["GET /v1/system/wss-observe"](req, res);
    if (method === "GET" && p === "/v1/system/wss-observe/full")
      return obsH["GET /v1/system/wss-observe/full"](req, res);
    if (method === "POST" && p === "/v1/system/wss-observe/reset")
      return obsH["POST /v1/system/wss-observe/reset"](req, res);
  }

  // 三协议 (印 104 · 智能路由: model 含 windsurf/swe/cascade/sonnet/opus → windsurf; 否则 → devin)
  if (method === "POST" && p === "/v1/chat/completions")
    return handleOpenAI(req, res);
  if (method === "POST" && p === "/v1/messages")
    return handleAnthropic(req, res);
  if (method === "POST" && p.startsWith("/v1beta/models/"))
    return handleGemini(req, res, p);

  // 印 ∞.2 · B 路 · /dc/* 显式 devin cloud 反代 (双反代之实 · 弱者道之用)
  //   主公本源诏「devin vm 双反代 windsurf + devin cloud」之 B 路落地
  //   /dc/health · /dc/v1/models · /dc/v1/chat/completions (forceEngine=devin)
  //   /dc/v1/messages · /dc/v1beta/models/X:generateContent
  //   皆显式跳智能分流 · 即使 model 含 cascade 亦走 devin · 物无非彼物无非是
  if (method === "GET" && p === "/dc/health") return handleDcHealth(req, res);
  if (method === "GET" && p === "/dc/v1/models")
    return handleDcModels(req, res);
  if (method === "POST" && p === "/dc/v1/chat/completions")
    return handleOpenAI(req, res, "devin");
  if (method === "POST" && p === "/dc/v1/messages")
    return handleAnthropic(req, res);
  if (method === "POST" && p.startsWith("/dc/v1beta/models/"))
    return handleGemini(req, res, p.slice(3)); // 剥 /dc 前缀

  // 印 104 · windsurf 专用路 (status/quota 真转 · chat 待协议研)
  if (method === "POST" && p === "/windsurf/chat")
    return handleWindsurfChat(req, res); // 501 not_implemented (诚)
  if (method === "GET" && p === "/windsurf/status")
    return handleWindsurfStatus(req, res); // 单 key plan 真查
  if (method === "GET" && p === "/windsurf/status/all")
    return handleWindsurfStatusAll(req, res); // 全 59 key 巡检
  if (method === "GET" && p === "/windsurf/quota")
    return handleWindsurfQuota(req, res); // 配额 dashboard
  if (method === "GET" && p === "/windsurf/models")
    return handleWindsurfModels(req, res);
  if (p.startsWith("/v1beta/windsurf/") || p.startsWith("/windsurf/")) {
    return handleWindsurfChat(req, res);
  }

  // 印 129 · 真本源切号 (主公诏「此登录为核心切号本源」 · 反者道之动)
  //   web 中栏 WAM '🔑 自动登' → POST /admin/signin/windsurf { email, password }
  //   VM 代登 windsurf.com 3-step → 返 { apiKey, apiServerUrl, sessionToken }
  //   web 自动入 D.accounts 池 · 即可走反代 /v1/messages
  if (method === "POST" && p === "/admin/signin/windsurf")
    return handleAdminSignin(req, res);

  // 印 130 · 真本源接入闭环 (登→入池→用 一线到底)
  //   web 真登成 ws-* key → POST /admin/keys/add → WS_POOL_STATE.keys.push
  //   即可走 /v1/messages · /windsurf/status 等真反代
  //   守隐: apiKey 返时仅前 12 字 · 去重幂等 · 全路 受 checkAuth (印 106)
  if (method === "POST" && p === "/admin/keys/add")
    return handleAdminKeysAdd(req, res);
  if (method === "GET" && p === "/admin/keys/list")
    return handleAdminKeysList(req, res);
  if (method === "POST" && p === "/admin/keys/remove")
    return handleAdminKeysRemove(req, res);

  // 印 133 · 反者道之动 · WAM 本地真本源桥 (主公本机起时知 ~/.wam · Devin VM 端透返 available=false)
  //   GET  /admin/wam/local · 179 件解析表 (脱密 + 健康注入 · 来自 ~/.wam/{accounts.md,wam-state.json})
  //   POST /admin/wam/use   · 单件入池 (mode: auto / token-direct / email-login · 仅本机访)
  if (method === "GET" && p === "/admin/wam/local")
    return handleAdminWamLocal(req, res);
  if (method === "POST" && p === "/admin/wam/use")
    return handleAdminWamUse(req, res);

  // 404
  sendJson(res, 404, {
    error: "not found",
    path: p,
    hint: "GET / · /health · /v1/models · POST /v1/chat/completions · /v1/messages · /v1beta/models/X:generateContent · GET/POST /v1/system/prompt · POST /v1/system/sp-dryrun · GET /v1/system/wss-observe · GET /windsurf/status · /windsurf/status/all · /windsurf/quota · /windsurf/models · POST /windsurf/chat (501) · POST /admin/signin/windsurf (印 129) · POST /admin/keys/add · GET /admin/keys/list · POST /admin/keys/remove (印 130 · 真本源接入闭环) · GET /admin/wam/local · POST /admin/wam/use (印 133 · WAM 本地真本源桥) · GET /dc/health · /dc/v1/models · POST /dc/v1/chat/completions · /dc/v1/messages · /dc/v1beta/models/X:generateContent (印 ∞.2 · B 路 · 显式 devin cloud · 双反代之实)",
  });
});

// ════════════════════════════════════════════════════════════════════════
// § 11b · 印 104 · Windsurf 双端真转 (status/quota 真 · chat 待协议研)
//   「天下莫柔弱于水，而攻坚强者莫之能胜也，以其无以易之也。」(帛书七十八)
//
//   实证可用 (2026-05-14):
//     ✓ GetUserStatus (JSON+X-Api-Key) 200 真转
//   待协议研:
//     ◌ Cascade chat (LSP-internal ConnectRPC stream · 反程未尽)
//     现 GetChatMessage 路 404/unsupported, 不可用
//
//   策: 单器 unit chat 仍走 Devin (1 主 1 客 不假装 · 信言不美)
//        windsurf 显式路提供 status/quota 真值, /windsurf/chat 标 not_implemented
// ════════════════════════════════════════════════════════════════════════

// 印 105 · windsurf chat 真转 (反程实证 ApiServerService.GetChatMessage)
// 协议: POST /exa.api_server_pb.ApiServerService/GetChatMessage
//      Content-Type: application/connect+json (server-streaming)
//      Auth: X-Api-Key + body.metadata.apiKey
// 错: resource_exhausted = quota 耗尽 (60s cooldown · 轮下个 key)
//     unauthenticated    = key 错 (10min cooldown)
async function handleWindsurfChat(req, res, preBody, preModel, preAccount) {
  recReq("windsurf");
  if (!WS_POOL_STATE.loaded) {
    return sendJson(res, 503, {
      error: { type: "pool_not_loaded", message: WS_POOL_STATE.err || "?" },
    });
  }
  let body = preBody;
  if (!body) {
    try {
      body = await readJson(req);
    } catch (e) {
      return sendJson(res, 400, {
        error: { type: "bad_request", message: e.message },
      });
    }
  }
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  if (rawMessages.length === 0) {
    return sendJson(res, 400, {
      error: { type: "bad_request", message: "messages 为空" },
    });
  }
  const model = preModel || body.model || "swe-1.5";
  const account =
    preAccount ||
    req.headers["x-dao-account"] ||
    req.headers["x-account"] ||
    undefined;

  // SP 注入: 共用 Devin 路之 processMessages (silk/per-account/per-model 三态)
  const { messages: finalMessages, meta } = processMessages(rawMessages, {
    model,
    account,
  });

  // 轮 pool 试 (max 8 · 防 quota 一遍后死)
  const tried = [];
  const maxTries = Math.min(WS_POOL_STATE.keys.length, 8);
  let lastResult = null;
  const t0 = Date.now();
  for (let i = 0; i < maxTries; i++) {
    const k = pickWsKey();
    if (!k) break;
    if (tried.includes(k.apiKey)) break; // 全过一遍
    tried.push(k.apiKey);

    logI(
      `ws-chat 试 ${i + 1}/${maxTries} · model=${C.B(model)} · key=${k.apiKey.slice(0, 14)}... · sp=${C.Y(meta.strategy)} · sysLen=${meta.finalSpLen}B`,
    );

    const r = await wsChat({
      keyObj: k,
      messages: finalMessages,
      model,
      timeoutMs: 60000,
    });
    lastResult = r;

    if (r.ok) {
      const ms = Date.now() - t0;
      recOk(ms);
      logI(
        `ws-chat ${C.G("成")} · host=${r.host} · ${r.durationMs}ms · frames=${r.frames} · 文=${r.text.length}B · 试=${tried.length}`,
      );
      return sendJson(res, 200, {
        id: "chatcmpl-ws-" + Date.now().toString(36),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: r.text },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: r.tokens || 0,
          total_tokens: r.tokens || 0,
        },
        x_dao: {
          path: "windsurf",
          host: r.host,
          durationMs: r.durationMs,
          frames: r.frames,
          tries: tried.length,
          sp: meta,
        },
      });
    }

    // resource_exhausted/unauthenticated → 轮下个; 余 → 即返
    if (r.errCode !== "resource_exhausted" && r.errCode !== "unauthenticated") {
      break;
    }
  }

  // 全数 fail · 真返上游错 (不假装)
  recErr();
  logE(
    `ws-chat ${C.R("败")} · 试=${tried.length}/${maxTries} · last=${lastResult?.errCode || "?"} · ${lastResult?.errMsg?.slice(0, 80) || ""}`,
  );
  return sendJson(res, 502, {
    error: {
      type: lastResult?.errCode || "upstream_error",
      message: lastResult?.errMsg || "all keys exhausted",
    },
    x_dao: {
      path: "windsurf",
      tries: tried.length,
      pool_size: WS_POOL_STATE.keys.length,
      last_host: lastResult?.host,
      sp: meta,
      hint:
        lastResult?.errCode === "resource_exhausted"
          ? "Free tier chat quota 全 exhausted - 待 quota reset 或加 fresh key 入池"
          : null,
    },
  });
}

// 单 key plan 查 (轮转)
async function handleWindsurfStatus(req, res) {
  if (!WS_POOL_STATE.loaded) {
    return sendJson(res, 503, {
      error: "ws pool 未载入: " + (WS_POOL_STATE.err || "?"),
    });
  }
  const k = pickWsKey();
  if (!k) return sendJson(res, 503, { error: "no key available" });
  const r = await wsGetUserStatus(k);
  sendJson(res, r.ok ? 200 : 502, {
    apiKey_mask: k.apiKey.slice(0, 14) + "..." + k.apiKey.slice(-6),
    apiServerUrl: k.srvUrl,
    ok: r.ok,
    status: r.status,
    error: r.error,
    plan: r.plan
      ? {
          teamsTier: r.plan.teamsTier,
          planName: r.plan.planStatus?.planInfo?.planName,
          hasAutocompleteFastMode:
            r.plan.planStatus?.planInfo?.hasAutocompleteFastMode,
          maxNumChatInputTokens:
            r.plan.planStatus?.planInfo?.maxNumChatInputTokens,
          teamId: r.plan.teamId,
          email: r.plan.email,
        }
      : null,
  });
}

// 全 key 巡检 (5 并发)
async function handleWindsurfStatusAll(req, res) {
  if (!WS_POOL_STATE.loaded) {
    return sendJson(res, 503, { error: "ws pool 未载入" });
  }
  const t0 = Date.now();
  const keys = WS_POOL_STATE.keys;
  const CONCURRENCY = 5;
  const results = [];
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    const batch = keys.slice(i, i + CONCURRENCY);
    const rs = await Promise.all(batch.map((k) => wsGetUserStatus(k, 6000)));
    rs.forEach((r, idx) => {
      const k = batch[idx];
      results.push({
        idx: i + idx,
        mask: k.apiKey.slice(0, 14) + "..." + k.apiKey.slice(-6),
        ok: r.ok,
        status: r.status,
        teamsTier: r.plan?.teamsTier || null,
        planName: r.plan?.planStatus?.planInfo?.planName || null,
        teamId: r.plan?.teamId || null,
        error: r.error,
      });
    });
  }
  const ok = results.filter((r) => r.ok).length;
  const tiers = {};
  results.forEach((r) => {
    if (r.teamsTier) tiers[r.teamsTier] = (tiers[r.teamsTier] || 0) + 1;
  });
  sendJson(res, 200, {
    total: keys.length,
    ok,
    err: keys.length - ok,
    tiers,
    durationMs: Date.now() - t0,
    results,
  });
}

// 配额板
function handleWindsurfQuota(req, res) {
  if (!WS_POOL_STATE.loaded) {
    return sendJson(res, 503, { error: "ws pool 未载入" });
  }
  const summary = WS_POOL_STATE.keys.map((k, i) => ({
    idx: i,
    mask: k.apiKey.slice(0, 14) + "..." + k.apiKey.slice(-6),
    ok: k.ok,
    err: k.err,
    cached_tier: k.plan?.teamsTier || null,
    last_used_at: k.lastUsedAt,
  }));
  sendJson(res, 200, {
    total: WS_POOL_STATE.keys.length,
    cursor: WS_POOL_STATE.cursor,
    rotateCount: WS_POOL_STATE.rotateCount,
    loaded: WS_POOL_STATE.loaded,
    summary,
  });
}

// windsurf models · 列已知 windsurf 真模型 (静)
function handleWindsurfModels(req, res) {
  sendJson(res, 200, {
    object: "list",
    data: [
      {
        id: "MODEL_SWE_1_5",
        display: "SWE-1.5 (Cascade default)",
        provider: "windsurf",
      },
      { id: "MODEL_SWE_1", display: "SWE-1", provider: "windsurf" },
      {
        id: "windsurf-swe-1.5",
        display: "SWE-1.5 alias",
        provider: "windsurf",
      },
      {
        id: "claude-3-5-sonnet",
        display: "Claude 3.5 Sonnet (via windsurf)",
        provider: "windsurf",
      },
      {
        id: "claude-3-7-sonnet",
        display: "Claude 3.7 Sonnet (via windsurf)",
        provider: "windsurf",
      },
      {
        id: "gpt-4.1",
        display: "GPT-4.1 (via windsurf)",
        provider: "windsurf",
      },
      { id: "gpt-5", display: "GPT-5 (via windsurf)", provider: "windsurf" },
    ],
    note: "chat 路待协议反 · 当下不可用",
  });
}

// ════════════════════════════════════════════════════════════════════════
// § 12 · 主 (启 · banner · signals)
// ════════════════════════════════════════════════════════════════════════
function banner() {
  console.error("");
  console.error(C.B("╔" + "═".repeat(72) + "╗"));
  console.error(
    C.B("║") +
      "  " +
      C.B(`真本源_单器 v${VERSION}`) +
      " · " +
      C.Y(SEAL) +
      " ".repeat(Math.max(0, 72 - 6 - VERSION.length - SEAL.length - 2)) +
      C.B("║"),
  );
  console.error(
    C.B("║") +
      "  " +
      C.GR("「反者道之动 · 弱者道之用」(帛书四十)") +
      " ".repeat(34) +
      C.B("║"),
  );
  console.error(C.B("╚" + "═".repeat(72) + "╝"));
  console.error("");
  console.error(`  ${C.B("绑")}      ${CFG.bind}:${CFG.port}`);
  console.error(`  ${C.B("上游")}    ${CFG.wssUrl}`);
  console.error(
    `  ${C.B("池")}      ${POOL_STATE.pool.length} token${POOL_STATE.pool.length ? " (" + POOL_STATE.pool.map((t) => t.source).join(", ") + ")" : C.R(" · 无 token · 设 DEVIN_TOKEN env")}`,
  );
  console.error(
    `  ${C.B("SP")}     ${SP_STATE.strategy} (silk=${DAO_DE_JING.length}字 from ${SILK.source})`,
  );
  console.error(
    `  ${C.B("守")}      不动 :11440/:11441/:11442/:8878 · 不推 GH · 不消 ACU · 不删`,
  );
  console.error("");
  console.error(`  ${C.G("→")} dashboard: http://${CFG.bind}:${CFG.port}/`);
  console.error(
    `  ${C.G("→")} health:    http://${CFG.bind}:${CFG.port}/health`,
  );
  console.error(
    `  ${C.G("→")} OpenAI:    POST http://${CFG.bind}:${CFG.port}/v1/chat/completions`,
  );
  console.error(
    `  ${C.G("→")} Anthropic: POST http://${CFG.bind}:${CFG.port}/v1/messages`,
  );
  console.error(
    `  ${C.G("→")} Gemini:    POST http://${CFG.bind}:${CFG.port}/v1beta/models/X:generateContent`,
  );
  console.error("");
}

server.listen(CFG.port, CFG.bind, () => {
  banner();
  logI(C.G("真本源单器 · 起 · 道法自然 · 无为而无不为"));
  if (POOL_STATE.pool.length === 0) {
    logW(
      "无 token · 设 env DEVIN_TOKEN 或 DEVIN_TOKENS 或 DAO_TOKENS_FILE 或 ~/.wam/wam-state.json",
    );
  }
  // 印 104+ 起时异步预加 windsurf 池 (适应新 WS_POOL_STATE 格式)
  //   帛书三十二: 「侯王若能守之 · 万物将自宾」
  //   旧 getWsPool/PoolClient 已被重构为 loadWindsurfPool/WS_POOL_STATE
  setImmediate(() => {
    try {
      const ok = loadWindsurfPool();
      if (ok)
        logI(
          C.G(
            `windsurf 池 · 起时预加完 · ${WS_POOL_STATE.keys.length} keys · 首笔不阻`,
          ),
        );
      else if (WS_POOL_STATE.err) logW("windsurf 池预加: " + WS_POOL_STATE.err);
    } catch (e) {
      logW("windsurf 池预加失败: " + (e && e.message));
    }
  });
});

server.on("error", (e) => {
  logE("server: " + e.message);
  if (e.code === "EADDRINUSE") {
    logE(`端 ${CFG.port} 已占 · 改 PORT env 或停占端进程`);
  }
  process.exit(1);
});

const shutdown = (sig) => {
  logI(`${sig} 收 · 关停 ...`);
  server.close(() => {
    logI("已关停 · 道法自然");
    process.exit(0);
  });
  // 5s 强退
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// 印 104+ 防 8h 死症: 全局异常网 · 民莫之令而自均焉
//   帛书二: 「聖人处无为之事」——遇异不死 · 仅记 · 守运
process.on("uncaughtException", (e) => {
  try {
    logE("uncaughtException · 守: " + ((e && (e.stack || e.message)) || e));
  } catch {}
  // 不 exit · 让服务续运
});
process.on("unhandledRejection", (reason) => {
  try {
    logE(
      "unhandledRejection · 守: " +
        ((reason && (reason.stack || reason.message)) || reason),
    );
  } catch {}
  // 不 exit · 让服务续运
});

// ════════════════════════════════════════════════════════════════════════
// 印 101 · 真本源_单器 · 立 · 2026-05-14
//   「合抱之木，生于毫末。九成之台，作于累土。」(帛书六十四)
//   「为之于其未有也，治之于其未乱也。」      (帛书六十四)
// ════════════════════════════════════════════════════════════════════════
