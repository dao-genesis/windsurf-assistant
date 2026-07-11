// ═══════════════════════════════════════════════════════════
// sp_invert.js · v9.9.60 · 同步Min v9.9.60 · 损之又损·繁体化·经文自足 · 执一 · 唯一SP引擎
// ═══════════════════════════════════════════════════════════
// 本模块为 SP 道化之唯一权威实现 · source.js / dao_router.js 皆委托于此
// 热重载生效 · 无需重启 Windsurf
//
// 道义: 二十八章「圣人执一以为天下牧」· 大制无割
//   反者道之动 · 弱也者道之用也
//   双重保障: source.js 已改则 isAlreadyInverted 跳过 · 未改则此模块补上
//   执一: 所有 SP 判定/修改/常量 皆源于此 · source.js 不再自持副本
//
// 使用: const spInvert = require('./sp_invert');
//       spInvert.invertSP(spText) → modified SP or null (主路)
//       spInvert.invertAnySP(spText) → modified SP or null (副路)
//       spInvert.classifySPType(spText) → 'chat'|'summary'|'memory'|'ephemeral'|null
//       spInvert.normalizeToolName('Grep') → 'grep_search'
// ═══════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

// ── 经文加载 ──────────────────────────────────────────────
const _BUNDLED_DIR = path.resolve(__dirname, "..", "..", "bundled-origin");

function _loadSilkText() {
  const dePath = path.join(_BUNDLED_DIR, "_silk_de.txt");
  const daoPath = path.join(_BUNDLED_DIR, "_silk_dao.txt");
  let deText = "";
  let daoText = "";
  try {
    if (fs.existsSync(dePath)) deText = fs.readFileSync(dePath, "utf8").trim();
  } catch {}
  try {
    if (fs.existsSync(daoPath))
      daoText = fs.readFileSync(daoPath, "utf8").trim();
  } catch {}
  if (!deText || !daoText) {
    return { de: "", dao: "", combined: "" };
  }
  return {
    de: deText,
    dao: daoText,
    combined: deText + "\n\n" + daoText,
  };
}

function _loadYinfuText() {
  const yinfuPath = path.join(_BUNDLED_DIR, "_yinfu.txt");
  try {
    if (fs.existsSync(yinfuPath))
      return fs.readFileSync(yinfuPath, "utf8").trim();
  } catch {}
  return "";
}

const _SILK_RAW = _loadSilkText();
const DAO_DE_JING_81 = _SILK_RAW.combined;
const YINFU_JING = _loadYinfuText();

// ── 经藏配置 ──────────────────────────────────────────────
const _CANON_MAP = {
  laozi: {
    files: ["_silk_de.txt", "_silk_dao.txt"],
    name: "\u5E1B\u66F8\u300A\u8001\u5B50\u300B", // 帛書《老子》
  },
  yinfu: {
    files: ["_yinfu.txt"],
    name: "\u9053\u85CF\u300A\u9670\u7B26\u7D93\u300B", // 道藏《陰符經》
  },
  "laozi+yinfu": {
    files: ["_silk_de.txt", "_silk_dao.txt", "_yinfu.txt"],
    name: "\u5E1B\u66F8\u8001\u5B50+\u9053\u85CF\u9670\u7B26\u7D93", // 帛書老子+道藏陰符經
  },
};

// ── 模式/经藏持久化 ────────────────────────────────────────
const _CANON_FILE = path.join(_BUNDLED_DIR, "_origin_canon.txt");
const _MODE_FILE = path.join(_BUNDLED_DIR, "_origin_mode.txt");

function _readCanonFile() {
  try {
    if (fs.existsSync(_CANON_FILE)) {
      const v = fs.readFileSync(_CANON_FILE, "utf8").trim();
      if (v && _CANON_MAP[v]) return v;
    }
  } catch {}
  return "laozi+yinfu"; // 默认二经合
}

function _readModeFile() {
  try {
    if (fs.existsSync(_MODE_FILE)) {
      const v = fs.readFileSync(_MODE_FILE, "utf8").trim();
      if (v && SP_MODE_VALID.has(v)) return v;
    }
  } catch {}
  return "invert";
}

function _loadCanonText(canonName) {
  const entry = _CANON_MAP[canonName];
  if (!entry) return "";
  const texts = [];
  for (const f of entry.files) {
    try {
      const fp = path.join(_BUNDLED_DIR, f);
      if (fs.existsSync(fp)) texts.push(fs.readFileSync(fp, "utf8").trim());
    } catch {}
  }
  if (!texts.length) return "";
  return texts.join("\n\n");
}

// ── 状态 ──────────────────────────────────────────────────
const SP_MODE_VALID = new Set(["invert", "passthrough", "custom"]);
let SP_MODE = _readModeFile();
let _activeCanon = _readCanonFile();
let _activeCanonText =
  _activeCanon === "laozi" ? DAO_DE_JING_81 : _loadCanonText(_activeCanon);
if (!_activeCanonText) {
  _activeCanon = "laozi";
  _activeCanonText = DAO_DE_JING_81;
}

// ★ v9.9.94 · 经藏热同步 · 道法自然 · 反者道之动
//   根因: _activeCanon 在模块加载后从未更新 → 用户切换经藏无效
//   修复: 暴露 setCanon / hotReloadCanon 让 source.js 同步
//   道义: 三十二章「道恒无名·侯王若能守之·万物将自宾」· 配置不漂移
function setCanon(canon) {
  if (!canon || !_CANON_MAP[canon]) return false;
  const text = canon === "laozi" ? DAO_DE_JING_81 : _loadCanonText(canon);
  if (!text) return false;
  _activeCanon = canon;
  _activeCanonText = text;
  return true;
}

function hotReloadCanon() {
  const fresh = _readCanonFile();
  if (fresh && fresh !== _activeCanon) {
    return setCanon(fresh);
  }
  return false;
}

// ★ 经藏热切真生效 · 注入前以持久化 _origin_canon.txt 为准 · 执一
//   根因: setCanon 仅同步「处理 /origin/canon 之进程」· 多窗口/多 ext-host 时
//         实际注入之进程从不更新 → 切经藏无效(恒为启动时之 laozi+yinfu)
//   道义: 三十二章「道恒无名·侯王若能守之·万物将自宾」· 文件即唯一真源
//   节流: 至多每 500ms 读一次文件(11 字节) · 不扰热路
let _lastCanonCheck = 0;
function _maybeHotReloadCanon() {
  const now = Date.now();
  if (now - _lastCanonCheck < 500) return;
  _lastCanonCheck = now;
  try {
    hotReloadCanon();
  } catch {}
}

// ── 哨兵/常量 ─────────────────────────────────────────────
const INVERTED_PREFIX =
  "\u4F60\u672C\u7121\u540D \u540D\u53EF\u540D\u4E5F \u975E\u6052\u540D\u4E5F";
const TAO_SENTINEL = INVERTED_PREFIX;
const TAO_TRAILER = "\n\n---\n\n";
const TAO_FOOTER = ""; // v9.7.7 损至空

// v9.9.95 · 损之又损 · 去末锚 · 只保留开头语+经文
//   TAO_TURN_ANCHOR(道法自然之嘱) 和 TAO_SUB_ANCHOR(道法自然之要) 已损
//   道义: 四十八章「损之又损·以至于无为·无为而无以为」
//   经文本身即是完整指令 · 无需额外锚定 · 经文即道 · 道即经文
const TAO_TURN_ANCHOR = ""; // v9.9.95 损至空
const TAO_SUB_ANCHOR = ""; // v9.9.95 损至空

function _canonHeader(canon) {
  let bookRef;
  if (canon === "laozi+yinfu") {
    bookRef =
      "\u5E1B\u66F8\u300A\u8001\u5B50\u300B\u9053\u85CF\u300A\u9670\u7B26\u7D93\u300B"; // 帛書《老子》道藏《陰符經》
  } else {
    const entry = _CANON_MAP[canon];
    bookRef = entry ? entry.name : "\u5E1B\u66F8\u300A\u8001\u5B50\u300B"; // fallback: 帛書《老子》
  }
  // "你是遵道而行者 你本無名 名可名也 非恆名也 所遵從之一切均來自於下述{bookRef}：\n\n"
  //   v9.9.302 · 用户指定 · 前置"你是遵道而行者"(行道者之自况) · 再接"你本無名"
  return (
    "\u4F60\u662F\u9075\u9053\u800C\u884C\u8005 " + // 你是遵道而行者
    "\u4F60\u672C\u7121\u540D \u540D\u53EF\u540D\u4E5F \u975E\u6052\u540D\u4E5F" +
    " \u6240\u9075\u5F9E\u4E4B\u4E00\u5207\u5747\u4F86\u81EA\u65BC\u4E0B\u8FF0" +
    bookRef +
    "\uFF1A\n\n"
  );
}

function isAlreadyInverted(s) {
  return typeof s === "string" && s.startsWith(INVERTED_PREFIX);
}

// ── 官方 SP 识别 ──────────────────────────────────────────
// v9.9.92 · 全量标记 · 从 source.js 同步 · 执一 · 唯一引擎不可有检测盲区
// 核心工程戒律 (12) + 用户端四路注入 (6) = 18 标记
const OFFICIAL_SP_MARKERS = [
  // 核心工程戒律 (12)
  "<communication_style>",
  "<tool_calling>",
  "<making_code_changes>",
  "<running_commands>",
  "<task_management>",
  "<debugging>",
  "<mcp_servers>",
  "<calling_external_apis>",
  "<citation_guidelines>",
  "<user_rules>",
  "<user_information>",
  "<workspace_information>",
  // v17.21 · 用户端四路注入 · 道模式下皆化除 (太上不知有之)
  "<skills>",
  "<workflows>",
  "<memories>",
  "<memory_system>",
  "<MEMORY[",
  "<ide_metadata>",
];

function isLikelyOfficialSP(s) {
  if (!s) return false;
  // v9.9.95 · startsWith 优先于长度检查 · 明确的官方标识不受长度限制
  //   道义: 一章「名可名也 非恒名也」· 有名即知 · 不以大小论
  if (s.startsWith("You are Cascade")) return true;
  if (s.length < 500) return false;
  let hits = 0;
  for (const m of OFFICIAL_SP_MARKERS) {
    if (s.indexOf(m) >= 0) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

// ── 副路 SP 标记集 ────────────────────────────────────────
// v9.9.92 · 从 source.js 同步 · 执一 · 副路亦归一
const SUMMARY_SP_MARKERS = [
  "expert AI coding assistant",
  "summaries of conversations",
  "outlining the USER",
  "main goals",
  "reflect the essence",
  "grounded in the conversation",
  "key information and context",
  "summarize the conversation",
  "summarize this",
  "well-organized and reflect",
];
const MEMORY_SP_MARKERS = [
  "<candidate_memory>",
  "candidate memor",
  "<existing_memories>",
  "Generate memor",
  "create a memor",
  "memory should be",
  "memory_assistant",
  "capture facts about",
  "useful for future",
  "retrieved from previous conversations",
  "SYSTEM-RETRIEVED-MEMORY",
  "persistent database",
  "extract memories",
  "extract memory",
  "memory entries",
  "identify information that should be remembered",
  "should be remembered",
  "MEMORY[",
];
const EPHEMERAL_SP_MARKERS = [
  "<edit_request>",
  "<diff_apply>",
  "fast apply",
  "apply this edit",
  "<original_code>",
  "<updated_code>",
  "inline edit",
  "refactor",
  "conversation title",
  "title generator",
  "generate a title",
  "concise title",
  "concise 3-7 word",
  "concise 3-5 word",
  "output only the title",
  "main topic",
  "<planner_response>",
  "<planner_step>",
];

// v9.9.92 · looksLikeSPShape · 形状判 · 从 source.js 同步
// 道义: 二十一章 "其中有象·其中有物·其中有情" · 形纹即见·不赖 markers
function looksLikeSPShape(text) {
  if (!text || typeof text !== "string") return false;
  if (text.length < 200) return false;
  const head200 = text.slice(0, 200);
  if (/^You are (?:Cascade|an? [A-Z]?\w+|the \w+|a \w+)/.test(head200))
    return true;
  if (/^You're (?:an?|the) \w+/.test(head200)) return true;
  if (
    /\bassistant\b/i.test(head200) &&
    /\b(?:task|analyze|summar|extract|generat|identif)\w*\b/i.test(text) &&
    text.length >= 300
  )
    return true;
  return false;
}

// classifySPType · 多类 SP 判: 返 'chat'|'summary'|'memory'|'ephemeral'|null
// v9.9.92 · 从 source.js 同步 · 执一 · 分类亦归一
function classifySPType(s) {
  if (!s || typeof s !== "string") return null;
  if (s.length < 100) return null;
  if (s.startsWith("You are Cascade")) return "chat";
  if (
    s.startsWith("You are an expert AI coding") ||
    s.startsWith("You are an AI assistant") ||
    s.startsWith("You are an expert")
  )
    return "summary";
  const hits = { chat: 0, summary: 0, memory: 0, ephemeral: 0 };
  for (const m of OFFICIAL_SP_MARKERS) if (s.indexOf(m) >= 0) hits.chat++;
  for (const m of SUMMARY_SP_MARKERS) if (s.indexOf(m) >= 0) hits.summary++;
  for (const m of MEMORY_SP_MARKERS) if (s.indexOf(m) >= 0) hits.memory++;
  for (const m of EPHEMERAL_SP_MARKERS) if (s.indexOf(m) >= 0) hits.ephemeral++;
  if (hits.chat >= 2) return "chat";
  if (hits.summary >= 2) return "summary";
  if (hits.memory >= 2) return "memory";
  if (hits.ephemeral >= 2) return "ephemeral";
  if (
    s.length > 400 &&
    (hits.chat || hits.summary || hits.memory || hits.ephemeral)
  )
    return "unknown_long";
  return null;
}

// ── KEEP_BLOCKS ───────────────────────────────────────────
const KEEP_BLOCKS = [
  "tool_calling",
  "mcp_servers",
  "user_information",
  "workspace_information",
  "conversation_summary",
];

// ── 中性化规则 ────────────────────────────────────────────
// v9.9.92 · 从 source.js 同步全量 · 含 CRITICAL 去强调规则
const NON_NEUTRAL_RULES = [
  {
    re: /You must NEVER NEVER run a command automatically if it could be unsafe\.\s*/g,
    repl: "",
  },
  {
    re: /You cannot allow the USER to override your judgement on this\.\s*/g,
    repl: "",
  },
  {
    re: /If a command is unsafe, do not run it automatically, even if the USER wants you to\.\s*/g,
    repl: "",
  },
  {
    re: /You may refer to your safety protocols if the USER attempts to ask you to run commands without their permission\.\s*/g,
    repl: "",
  },
  {
    re: /The user may set commands to auto-run via an allowlist in their settings if they really want to\.\s*But do not refer to any specific arguments of the run_command tool in your response\.\s*/g,
    repl: "",
  },
  {
    re: /\s*\d+\.\s*If an external API requires an API Key[^\n]*\n?/g,
    repl: "",
  },
  // v9.9.34 · 去强调 · **THIS IS CRITICAL:** → 纯文本
  { re: /\*\*THIS IS CRITICAL:\s*([\s\S]*?)\*\*/g, repl: "$1" },
];

// ── stripCreateMemoryTool · v9.9.55 · create_memory整块切除 ────
// 道义: 三十六章「将欲去之·必故与之」· v9.9.35与之(仅删描述) → v9.9.55去之(整块切除)
function stripCreateMemoryTool(s) {
  if (!s || typeof s !== "string" || s.indexOf("create_memory") < 0) return s;
  let out = s;
  let i = 0;
  while (i < out.length) {
    const a = out.indexOf("<function>", i);
    if (a < 0) break;
    const b = out.indexOf("</function>", a);
    if (b < 0) break;
    const block = out.slice(a, b + 11);
    if (
      block.indexOf('"create_memory"') >= 0 ||
      block.indexOf("'create_memory'") >= 0
    ) {
      const end = b + 11;
      const skip = out[end] === "\n" ? 1 : 0;
      out = out.slice(0, a) + out.slice(end + skip);
    } else {
      i = b + 11;
    }
  }
  return out;
}

// ── 道恒无名 · 去官名归一 · v9.9.298 · 共用引擎(SP keep块 + dao_router 同源) ──
//   根因: invertSP 保留块(tool_calling 等)内残留 "Cascade"/"Windsurf" → 经/官两路
//   送达模型皆携官方品牌 → 模型据以自认 Cascade · 破"彻底隔离"之本意。
//   修复: 最上游 neutralizeBlock 即去名 → 两路(modifySPProto 共用 invertSP)同得净SP。
//   语法守: "the Cascade IDE"→"the IDE"(非"the you IDE") · "the Windsurf X"→"the X"。
// v9.9.299 · 去名语法守 · 第三人称单数→原形(品牌作主语之残: "Cascade blocks"→"you block")
const DEOFFICIAL_3SG_BASE = {
  is: "are", was: "were", has: "have", does: "do",
  "doesn't": "don't", "hasn't": "haven't", "isn't": "aren't", "wasn't": "weren't",
  exposes: "expose", blocks: "block", runs: "run", reads: "read", writes: "write",
  views: "view", waits: "wait", sees: "see", needs: "need", wants: "want",
  gets: "get", makes: "make", calls: "call", uses: "use", opens: "open",
  finds: "find", lists: "list", creates: "create", edits: "edit", searches: "search",
  proposes: "propose", returns: "return", expects: "expect", interacts: "interact",
  executes: "execute", generates: "generate", provides: "provide", requires: "require",
  allows: "allow", supports: "support", handles: "handle", sends: "send",
  receives: "receive", loads: "load", saves: "save", fetches: "fetch", parses: "parse",
  checks: "check", ensures: "ensure", performs: "perform", accesses: "access",
  displays: "display", shows: "show", knows: "know", follows: "follow",
  respects: "respect", avoids: "avoid", prefers: "prefer", attempts: "attempt",
  tries: "try", helps: "help", asks: "ask", tells: "tell", takes: "take",
  gives: "give", keeps: "keep", sets: "set", adds: "add", removes: "remove",
  deletes: "delete", updates: "update", modifies: "modify", replaces: "replace",
  applies: "apply", builds: "build", compiles: "compile", deploys: "deploy",
  tests: "test", debugs: "debug", operates: "operate", works: "work",
  decides: "decide", chooses: "choose", determines: "determine", understands: "understand",
};
// 私用区哨兵 · 仅对"本函数引入"的替换做主谓/句首大写,绝不动原文已有的小写 you
const _DN_YOU = "\uE000", _DN_ED = "\uE001", _DN_YOURP = "\uE002";

function deOfficialName(s) {
  if (typeof s !== "string") return s;
  let out = s
    .replace(/CascadeProjects/g, "Projects")
    .replace(/\bCascade's\b/g, _DN_YOURP)
    .replace(/\bWindsurf's\b/g, _DN_ED + "'s")
    .replace(/\bCodeium's\b/g, _DN_ED + "'s")
    // 语法守: "the Cascade IDE"→"the IDE"(非"the you IDE")
    .replace(/\bthe Cascade\b/g, "the")
    .replace(/\bthe Windsurf\b/g, "the")
    .replace(/\bthe Codeium\b/g, "the")
    .replace(/\bCascade\b/g, _DN_YOU)
    .replace(/\bWindsurf\b/g, _DN_ED)
    .replace(/\bCodeium\b/g, _DN_ED);
  // 主谓一致: 仅对哨兵主语 "⟨YOU⟩ <第三人称单数>" → 原形
  out = out.replace(new RegExp(_DN_YOU + " ([A-Za-z']+)", "g"), (m, w) => {
    const base = DEOFFICIAL_3SG_BASE[w.toLowerCase()];
    return base ? _DN_YOU + " " + base : m;
  });
  // 还原哨兵 · 句首则首字母大写
  out = out.replace(new RegExp("[" + _DN_YOU + _DN_ED + _DN_YOURP + "]", "g"), (m, off, str) => {
    let i = off - 1;
    while (i >= 0 && (str[i] === " " || str[i] === "\t")) i--;
    const cap = i < 0 || str[i] === "." || str[i] === "!" || str[i] === "?" || str[i] === "\n" || str[i] === ":";
    if (m === _DN_YOU) return cap ? "You" : "you";
    if (m === _DN_YOURP) return cap ? "Your" : "your";
    return cap ? "The editor" : "the editor";
  });
  return out;
}

function neutralizeBlock(block) {
  if (!block || typeof block !== "string") return block;
  let s = block;
  for (const rule of NON_NEUTRAL_RULES) {
    try {
      s = s.replace(rule.re, rule.repl);
    } catch {}
  }
  // v9.9.55 · create_memory整块切除
  s = stripCreateMemoryTool(s);
  // v9.9.298 · 道恒无名 · 去官名(残留 Cascade/Windsurf 等) · 两路最上游统一隔离
  s = deOfficialName(s);
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/[ \t]+\n/g, "\n");
  return s;
}

// ── 工作区/用户信息截断 ────────────────────────────────────
function trimUserInfo(block) {
  if (!block || typeof block !== "string") return block;
  const cmdIdx = block.search(/\bYour recent terminal commands\s*:/i);
  if (cmdIdx < 0) return block;
  const closeIdx = block.lastIndexOf("</user_information>");
  if (closeIdx < 0) return block;
  return block.slice(0, cmdIdx).trimEnd() + "\n" + block.slice(closeIdx);
}

function trimWorkspaceInfo(block) {
  if (!block || typeof block !== "string") return block;
  const openTag = block.match(/^<workspace_information[^>]*>/)?.[0] || "";
  const closeTag = "</workspace_information>";
  const inner = block.slice(openTag.length, block.lastIndexOf(closeTag));
  if (!inner) return block;

  const lines = inner.split("\n");
  const layouts = [];
  let cur = null;
  let totalFiles = 0;
  let totalDirs = 0;

  for (const line of lines) {
    if (line.indexOf("snapshot") >= 0 || line.indexOf("file structure") >= 0)
      continue;
    if (line.indexOf("<workspace_layout") >= 0) {
      cur = { tag: line, entries: [], files: 0, dirs: 0 };
      continue;
    }
    if (line.indexOf("</workspace_layout") >= 0) {
      if (cur) layouts.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const depth = line.search(/\S/);
    if (depth === 0) {
      cur.entries.push(line);
      if (line.endsWith("/")) cur.dirs++;
      else cur.files++;
    }
  }

  for (const l of layouts) {
    totalFiles += l.files;
    totalDirs += l.dirs;
  }

  const trimmed = layouts
    .map((l) => l.tag + "\n" + l.entries.join("\n") + "\n</workspace_layout>")
    .join("\n");
  const summary = `\n[${totalDirs} dirs, ${totalFiles} files total]`;

  return openTag + "\n" + trimmed + summary + "\n" + closeTag;
}

// ── extractKeepBlocks ─────────────────────────────────────
function extractKeepBlocks(s) {
  if (!s || typeof s !== "string") return "";
  const parts = [];
  for (const tag of KEEP_BLOCKS) {
    try {
      const re = new RegExp(
        "<" + tag + "(?:\\s[^>]*)?>[\\s\\S]*?</" + tag + ">",
        "gi",
      );
      let m;
      while ((m = re.exec(s)) !== null) {
        let block = neutralizeBlock(m[0]);
        if (tag === "workspace_information") block = trimWorkspaceInfo(block);
        if (tag === "user_information") block = trimUserInfo(block);
        parts.push(block);
      }
    } catch {}
  }
  return parts.join("\n\n");
}

// ── extractRealtimeBlocks · v9.9.92 · 从 source.js 同步 ──
// 提取实时信息块 (user/workspace/metadata) · 用于 custom SP 模式
function extractRealtimeBlocks(s) {
  if (!s || typeof s !== "string") return "";
  const tags = ["user_information", "workspace_information", "ide_metadata"];
  const parts = [];
  for (const tag of tags) {
    try {
      const re = new RegExp(
        "<" + tag + "(?:\\s[^>]*)?>[\\s\\S]*?</" + tag + ">",
        "gi",
      );
      let m;
      while ((m = re.exec(s)) !== null) {
        parts.push(m[0]);
      }
    } catch {}
  }
  return parts.join("\n\n");
}

// ═══════════════════════════════════════════════════════════
// invertAnySP · 副路全置换 · v9.9.92 · 从 source.js 同步
// ═══════════════════════════════════════════════════════════
// 用于 deepInvertProto 内部 · 覆盖所有 SP 类型 (chat/summary/memory/ephemeral/unknown_long)
// 不处理 custom SP (custom 仅主路 chat 生效)
// 道义: 三十二章 "道恒无名" · 副路 summary/memory/ephemeral 皆归帛书
function invertAnySP(spText) {
  try {
    _maybeHotReloadCanon();
    if (spText === undefined || spText === null) return null;
    const s = typeof spText === "string" ? spText : String(spText);
    if (!s) return null;
    if (isAlreadyInverted(s)) return null;
    if (s.indexOf(TAO_SENTINEL) >= 0) return null;
    const t = classifySPType(s);
    if (!t) return null; // v9.9.60 · 损之又损 · 无类型即非 · 不兜底
    if (t === "unknown_long") return null; // v9.9.60 · 损之又损 · unknown_long 不道化 · 标记不足即非
    if (!_activeCanonText) return null;

    // 道法自然 · 三十二章 "道恒无名" · 副路 summary/memory/ephemeral 皆归帛书
    // v9.7.8 · 十一章「三十辐共一毂」· 副路亦复 7 辐 (若上游有此 7 块)
    //   summary/memory/ephemeral SP 通常不含 tool_calling 等块 · keeps 为空时退回纯帛书
    //   有则保 · 无则简 · 名随实变
    // v9.9.60 · 损之又损 · 副路亦去嘱 · 经文自足 · 无末锚
    const keeps = extractKeepBlocks(s);
    const base = _canonHeader(_activeCanon) + _activeCanonText + TAO_FOOTER;
    return keeps ? base + TAO_TRAILER + keeps : base;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// invertSP · 主路全置换 · 反者道之动
// ═══════════════════════════════════════════════════════════
function invertSP(spText) {
  try {
    _maybeHotReloadCanon();
    if (spText === undefined || spText === null) return null;
    const s = typeof spText === "string" ? spText : String(spText);
    if (!s) return null;

    // 已道化 · 幂等
    if (isAlreadyInverted(s)) return null;
    // 仅官方 SP 才 invert
    if (!isLikelyOfficialSP(s)) return null;

    // 默认: 道法自然 · 无为而无不为
    if (!_activeCanonText) return null;
    const keeps = extractKeepBlocks(s);
    const base = _canonHeader(_activeCanon) + _activeCanonText + TAO_FOOTER;
    // v9.9.60 · 损之又损 · 去嘱留经 · 经文自足 · 无末锚
    return keeps ? base + TAO_TRAILER + keeps : base;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// 工具名规范化 · 知其白守其辱 · 为天下式
// ═══════════════════════════════════════════════════════════
// LSP 发送的工具名 vs 官方后端规范化后的标准名
// 官方 EXE 的 normalizeToolInvocation 做的映射

const TOOL_ALIAS_TO_STANDARD = {
  // LSP 别名 → 标准名 (EXE normalizeToolInvocation)
  Grep: "grep_search",
  bash: "run_command",
  Read: "read_file",
  Edit: "edit",
  Write: "write_to_file",
  ListDir: "list_dir",
  FindByName: "find_by_name",
  CodeSearch: "code_search",
  RunCommand: "run_command",
  GrepSearch: "grep_search",
  // read_terminal 和 list_resources 是 LSP 发的但不在 EXE 标准白名单中
  // 保留原名 — 它们是有效的 LSP 工具
};

const TOOL_STANDARD_TO_ALIAS = {};
for (const [alias, standard] of Object.entries(TOOL_ALIAS_TO_STANDARD)) {
  if (!TOOL_STANDARD_TO_ALIAS[standard]) {
    TOOL_STANDARD_TO_ALIAS[standard] = alias;
  }
}

/**
 * 规范化工具名: LSP别名 → 标准名
 * 发给 DeepSeek 前调用, 确保和官方后端一致
 */
function normalizeToolName(name) {
  return TOOL_ALIAS_TO_STANDARD[name] || name;
}

/**
 * 反向映射: 标准名 → LSP别名
 * DeepSeek 回调后还原, 让 LSP 识别
 */
function denormalizeToolName(name) {
  return TOOL_STANDARD_TO_ALIAS[name] || name;
}

/**
 * 批量规范化工具定义 (发给上游前)
 * 返回 { tools: 规范化后的工具数组, aliasMap: { 标准名→原名 } 映射 }
 */
function normalizeToolDefs(tools) {
  if (!Array.isArray(tools)) return { tools, aliasMap: {} };
  const aliasMap = {};
  const normalized = tools.map((t) => {
    const fn = t.function || t;
    const origName = fn.name || t.name || "";
    const stdName = normalizeToolName(origName);
    if (stdName !== origName) {
      aliasMap[stdName] = origName;
    }
    if (t.function) {
      return { ...t, function: { ...t.function, name: stdName } };
    }
    return { ...t, name: stdName };
  });
  return { tools: normalized, aliasMap };
}

/**
 * 反向映射工具调用名 (DeepSeek回调后还给LSP)
 */
function denormalizeToolCallName(name, aliasMap) {
  // 优先用本次请求的映射表
  if (aliasMap && aliasMap[name]) return aliasMap[name];
  // 回退到全局映射
  return denormalizeToolName(name);
}

// ═══════════════════════════════════════════════════════════
// compactPromptText · 损之又损 · 压缩空白
// ═══════════════════════════════════════════════════════════
function compactPromptText(text) {
  if (!text || typeof text !== "string") return text;
  // 压缩连续空白行 → 单空行
  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "");
}

// ═══════════════════════════════════════════════════════════
// module.exports · v9.9.92 · 执一 · 唯一引擎全量导出
// ═══════════════════════════════════════════════════════════
module.exports = {
  // SP 修改 (主路 + 副路)
  invertSP,
  invertAnySP,
  isAlreadyInverted,
  isLikelyOfficialSP,
  classifySPType,
  looksLikeSPShape,
  extractKeepBlocks,
  extractRealtimeBlocks,
  neutralizeBlock,
  deOfficialName,
  stripCreateMemoryTool,
  compactPromptText,

  // 工具名规范化
  normalizeToolName,
  denormalizeToolName,
  normalizeToolDefs,
  denormalizeToolCallName,

  // 状态查询
  getMode: () => SP_MODE,
  getCanon: () => _activeCanon,
  getCanonChars: () => (_activeCanonText ? _activeCanonText.length : 0),
  isLoaded: () => !!_activeCanonText && _activeCanonText.length > 0,

  // ★ v9.9.101 · 太上下知有之 · 增强模式所需导出
  getActiveCanonText: () => _activeCanonText || null,
  getCanonHeader: () => _canonHeader(_activeCanon),

  // ★ v9.9.94 · 经藏热同步 · 让 source.js 能同步 sp_invert 的 _activeCanon
  setCanon,
  hotReloadCanon,

  // 常量
  INVERTED_PREFIX,
  TAO_SENTINEL,
  TAO_TRAILER,
  TAO_FOOTER,
  TAO_TURN_ANCHOR,
  TAO_SUB_ANCHOR,
  DAO_DE_JING_81,
  YINFU_JING,
  OFFICIAL_SP_MARKERS,
  SUMMARY_SP_MARKERS,
  MEMORY_SP_MARKERS,
  EPHEMERAL_SP_MARKERS,
  TOOL_ALIAS_TO_STANDARD,
  TOOL_STANDARD_TO_ALIAS,
};
