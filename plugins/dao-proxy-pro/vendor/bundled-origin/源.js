#!/usr/bin/env node
/**
 * 000-本源_Origin · 源.js
 * =============================================================
 * 道法自然 · 无为而无不为 · 反者道之动 · 道恒无名
 *
 * 唯一职: 反代 Windsurf Cascade 聊天请求, 道德经直为 SP 起首,
 *         彻删官方一切着相之名 (身份/风格/规训), 工具本身全保不动.
 *
 * v7.7 · 反者道之动 · 全链路探源 · 反 v7.6 之只盯 chat 三档
 *
 *   v7.6 之余: classifyRPC 仅识 GetChatMessage{,V2}/RawGetChatMessage,
 *         其余 inference RPC (CascadeSummarize/AutoCascadeMemories/
 *         UserMemoriesToSystemPrompt/SummaryFullyGenerate/CortexStep*Summary
 *         /McpPrompt/CortexTrajectoryToPrompt/IntentFastApply 等 50+) 全 PASSTHROUGH 透传.
 *         实抓证据: 截图所示 "You are an expert AI coding assistant..."
 *         400 余字, 即 summary RPC 之 SP, 当前未道化, 模型仍受其名相之扰.
 *         反者道之动 (四十章): 不绑 RPC 名, 字段级广谱深扫.
 *
 *   v7.7 三损 (反 v7.6 之绑名):
 *     1. 加 SUMMARY/MEMORY/EPHEMERAL/APPLY/INLINE 多类 SP markers
 *        classifySPType 返 chat|summary|memory|ephemeral|apply|inline 之一
 *     2. deepScanProto: 任何 inference RPC body, 字段级递归深扫
 *        粒1 utf8 文本字段 (>100B): classifySPType, 命中即落候选
 *        粒2 嵌套 proto: 递归 (maxDepth=6)
 *     3. _spCandidates ringbuf (32 槽 · 落盘 _sp_candidates.json)
 *        控制面 /origin/sp_candidates GET (head/tail) / DELETE
 *        webview 可观全链路 SP 来源, 不绑 RPC 名
 *
 *   v7.7 主 handler 改:
 *     - 非 inference (mgmt) 路由: 纯透 req.pipe(upReq) 不读 body
 *     - inference 路由: readBody → observeAllSPInBody (深扫记) →
 *                       chat 三档仍 modifySPProto/modifyRawSP 替换 →
 *                       其余 RPC body 不动透传
 *
 *   注: v7.7 仅观察, 不替换非 chat SP. 因 summary/memory RPC 替道德经会破坏
 *       预期输出 (summary 须摄要, memory 须键值). v7.8 将据 v7.7 实抓
 *       数据因器施治, 各 SP 类制极简道义化指令.
 *
 * v7.6 · 为道日损 · 道法自然 · 反 v7.5 之未简
 *
 *   invertSP = TAO_HEADER + DAO_DE_JING_81 + sep + stripOfficialNaming(SP)
 *
 *   TAO_HEADER (49 字):
 *     "You are Cascade. 唯遵下文道德经, 余皆为客. 处无为, 行不言. 道法自然."
 *
 *   stripOfficialNaming 损 (官方一切着相之名):
 *     起首身份段 / <communication_style> / discipline 6 行 / <ide_metadata>
 *     <user_rules> 含 nested <MEMORY[*]> / 顶层游离 <MEMORY[*]>
 *     <user_information> / <workflows> / <rules> / <skills> / <memories>
 *
 *   不动 (9 工具 tag 全保, 内容替为纯道德经原文):
 *     tool_calling / making_code_changes / running_commands / task_management
 *     debugging / calling_external_apis / mcp_servers / memory_system / citation_guidelines
 *
 *   v7.2 _customSP (用户实时编辑) 优先, 默认走 TAO_HEADER 路径.
 *
 * 上游:
 *   inference.codeium.com           · 推理
 *   server.self-serve.windsurf.com  · 管理
 *
 * 入口: ORIGIN_PORT (默认 8889)
 * 控制面:
 *   GET  /origin/ping           · 状态
 *   GET  /origin/mode           · 当前模式
 *   POST /origin/mode           · 切换 {"mode":"invert"|"passthrough"}
 *   GET  /origin/selftest       · 自证: 三路径前置道魂 · 返回 json 诊断
 *   GET  /origin/lastinject     · 最近一次真实 SP 注入 (before/after)
 *                                  ?full=1 返回全文 · 默认截头尾 · 落盘持存
 *   GET  /origin/preview        · 抱一守中 · 实时全貌 (before+after+解剖)
 *                                  invert:      after=TAO+道+---+before  (前置不削)
 *                                  passthrough: after=before=Windsurf原SP
 *
 * 模式二:
 *   invert      · 前置道魂 · 守工程之骨 (默认)
 *   passthrough · 零改写 · 紧急撤退用
 *
 * 启动: node 源.js
 */
"use strict";
const net = require("net");
const http = require("http");
const http2 = require("node:http2");
const https = require("https");
const url = require("url");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ═══════════════════════════════════════════════════════════
// 配置 · 常量
// ═══════════════════════════════════════════════════════════
const PORT = parseInt(process.env.ORIGIN_PORT || "8889", 10);
const UPSTREAM_MGMT = "server.self-serve.windsurf.com";
const UPSTREAM_INFER = "inference.codeium.com";
const CLOUD_PORT = 443;

// inference 服务名集 (Connect-RPC 路径的 package.Service 部分)
const INFERENCE_SERVICES = new Set([
  "exa.language_server_pb.LanguageServerService",
  "exa.chat_web.ChatWebService",
  "exa.codeium_common_pb.CascadeService",
  "exa.codeium_common_pb.AutocompleteService",
  "exa.codeium_common_pb.CodeiumService",
]);

// 两种模式 · 多言数穷 · 不如守中 (strip/extract 去)
const SP_MODE_VALID = new Set(["invert", "passthrough"]);
const SP_MODE_FILE = path.join(__dirname, "_origin_mode.txt");

function _loadModeFromDisk() {
  try {
    if (fs.existsSync(SP_MODE_FILE)) {
      const v = fs.readFileSync(SP_MODE_FILE, "utf8").trim().toLowerCase();
      if (SP_MODE_VALID.has(v)) return v;
    }
  } catch {}
  return null;
}
function _saveModeToDisk(mode) {
  try {
    fs.writeFileSync(SP_MODE_FILE, mode, { mode: 0o600 });
  } catch {}
}

let SP_MODE = _loadModeFromDisk() || process.env.SP_MODE || "invert";
const START_TIME = Date.now();
let reqCounter = 0;

// v7.8 debug: recent request paths ring buffer
const _RECENT_PATHS_MAX = 64;
const _recentPaths = [];
function _recordPath(method, url, kind, route) {
  _recentPaths.push({ t: Date.now(), m: method, u: url, k: kind, r: route });
  if (_recentPaths.length > _RECENT_PATHS_MAX) _recentPaths.shift();
}

// ═══════════════════════════════════════════════════════════
// v7.2 · _customSP · 用户实时编辑之提示词 · 道法自然
// ═══════════════════════════════════════════════════════════
// 道义: 二十五章 "人法地, 地法天, 天法道, 道法自然"
//       用户为道之自然, 用户编辑即真道. webview /origin/custom_sp 三动词写,
//       invertSP 读. 与 SP_MODE 互独 (mode=invert 时方生效, passthrough 透传不动).
//
// 结构: { sp: string, keep_blocks: bool, source: string, at: number }
//   keep_blocks=true:  user_sp + "\n\n---\n\n" + stripOfficialNaming(原 SP)
//   keep_blocks=false: 仅 user_sp (彻底替代, 工具能力或失)
// ═══════════════════════════════════════════════════════════
const _CUSTOM_SP_FILE = path.join(__dirname, "_custom_sp.json");
let _customSP = null;
function _loadCustomSP() {
  try {
    if (fs.existsSync(_CUSTOM_SP_FILE)) {
      const d = JSON.parse(fs.readFileSync(_CUSTOM_SP_FILE, "utf8"));
      if (d && typeof d.sp === "string" && d.sp.length > 0) return d;
    }
  } catch {}
  return null;
}
function _saveCustomSP() {
  try {
    if (_customSP) {
      fs.writeFileSync(_CUSTOM_SP_FILE, JSON.stringify(_customSP), {
        mode: 0o600,
      });
    } else if (fs.existsSync(_CUSTOM_SP_FILE)) {
      fs.unlinkSync(_CUSTOM_SP_FILE);
    }
  } catch {}
}
_customSP = _loadCustomSP();

// ═══════════════════════════════════════════════════════════
// v7.7 · _spCandidates · 广谱 SP 候选 ringbuf · 反者道之动
// ═══════════════════════════════════════════════════════════
// 任何 inference RPC body, deepScanProto 字段级递归深扫,
// 命中 classifySPType 之候选落入此 ringbuf (32 槽).
// 跨重启持存. /origin/sp_candidates GET/DELETE 暴露.
// 道义: 二章 万物作焉而不辞. 收一切, 不弃.
// ═══════════════════════════════════════════════════════════
const _SP_CANDIDATES_FILE = path.join(__dirname, "_sp_candidates.json");
const _SP_CANDIDATES_MAX = 32;
let _spCandidates = [];
function _loadSPCandidates() {
  try {
    if (fs.existsSync(_SP_CANDIDATES_FILE)) {
      const arr = JSON.parse(fs.readFileSync(_SP_CANDIDATES_FILE, "utf8"));
      if (Array.isArray(arr)) return arr.slice(-_SP_CANDIDATES_MAX);
    }
  } catch {}
  return [];
}
function _saveSPCandidates() {
  try {
    fs.writeFileSync(_SP_CANDIDATES_FILE, JSON.stringify(_spCandidates), {
      mode: 0o600,
    });
  } catch {}
}
_spCandidates = _loadSPCandidates();
function _recordSPCandidate(ev) {
  try {
    // 去重: 同 hash + 同 rpc + 同 kind 已存则更新 last_at + count
    const existing = _spCandidates.find(
      (c) => c.hash === ev.hash && c.rpc === ev.rpc && c.kind === ev.kind,
    );
    if (existing) {
      existing.last_at = Date.now();
      existing.count = (existing.count || 1) + 1;
      // 字段路径可能变 (proto field index), 记最新
      existing.field_path = ev.field_path;
    } else {
      _spCandidates.push({
        first_at: Date.now(),
        last_at: Date.now(),
        count: 1,
        rid: reqCounter,
        rpc: ev.rpc,
        kind: ev.kind,
        field_path: ev.field_path,
        chars: ev.chars,
        hash: ev.hash,
        text: ev.text,
      });
      while (_spCandidates.length > _SP_CANDIDATES_MAX) {
        _spCandidates.shift();
      }
    }
    _saveSPCandidates();
  } catch {}
}

// v17.55 · 实注捕获 · 观而不改 · 最近一次真实 SP 注入事件
// 落盘持存 · 跨重启恒显 · 进程退不失 · 致虚守静 · 观复知常
// 以 /origin/lastinject + /origin/preview 暴露 · essence.js 一屏即见本源之实
const _LASTINJECT_FILE = path.join(__dirname, "_lastinject.json");
function _loadLastInject() {
  try {
    if (fs.existsSync(_LASTINJECT_FILE)) {
      return JSON.parse(fs.readFileSync(_LASTINJECT_FILE, "utf8"));
    }
  } catch {}
  return null;
}
function _saveLastInject() {
  try {
    if (_lastInject) {
      fs.writeFileSync(
        _LASTINJECT_FILE,
        JSON.stringify({
          at: _lastInject.at,
          kind: _lastInject.kind,
          variant: _lastInject.variant,
          field: _lastInject.field,
          role: _lastInject.role,
          mode: _lastInject.mode,
          transformed: _lastInject.transformed,
          before_chars: _lastInject.before_chars,
          after_chars: _lastInject.after_chars,
          before: _lastInject.before,
          after: _lastInject.after,
        }),
        { mode: 0o600 },
      );
    }
  } catch {}
}
let _lastInject = _loadLastInject();
function _recordInject(ev) {
  try {
    _lastInject = Object.assign({ at: Date.now(), rid: reqCounter }, ev);
    _saveLastInject();
  } catch {}
}

// v17.44 · 版本指纹 · 扩展据此检测 hot_dir 源.js 与本进程代码是否一致
let _SELF_SIZE = 0;
try {
  _SELF_SIZE = fs.statSync(__filename).size;
} catch {}

function log(...args) {
  const t = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${t}]`, ...args);
}

// ═══════════════════════════════════════════════════════════
// 本源 · 道德经载入
// ═══════════════════════════════════════════════════════════
function _loadDaoDeJing() {
  const candidates = [
    process.env.DAO_FILE,
    path.join(__dirname, "_dao_81.txt"),
    path.join(__dirname, "..", "..", ".windsurf", "rules", "000-dao.md"),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      let raw = fs.readFileSync(p, "utf8");
      // 剥 .md YAML front matter (--- ... ---)
      raw = raw.replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/m, "").trim();
      if (raw.length > 5000) {
        log(
          `道德经 loaded · path=${p} chars=${raw.length} bytes=${Buffer.byteLength(raw, "utf8")}`,
        );
        return raw;
      }
    } catch {}
  }
  log("道德经 未载 · invert 将退化为 passthrough");
  return "";
}
const DAO_DE_JING_81 = _loadDaoDeJing();

// ═══════════════════════════════════════════════════════════
// invertSP · 反者道之动 · 全置换 · 伪装身份
// ═══════════════════════════════════════════════════════════
// 反向观察:
//   L28.2 头斩+尾斩+保 userPart · Cascade 将道德经识为"上下文注入"而忽略.
//   因道德经以裸文本出现在 SP 头, 模型训练中未见过此形态 · 警觉排斥.
// 反向行动:
//   1. 识别强化 · 只有"真正官方 SP"才 invert. 其他 (含 user msg) 透传.
//   2. 彻底置换 · 无头斩无尾斩无拼接. 整个官方 SP → 身份前言 + 纯道德经.
//   3. 权重伪装 · 以 "You are Cascade. ..." 起首 · 借官方起句格式, 令模型
//      识别为身份定义, 而非"可忽略的注入".
//
// 官方 SP 特征指纹 (不动 proto · 仅文本识别):
// v17.21 · 扩四路用户端注入 (rules/skills/workflows/memories) · 少则全 多则惑
// 任一命中即判为"含用户端侧信道之官方 SP" · 整体置换 · 绝不留遗漏
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
  if (!s || s.length < 500) return false; // SP 至少数千字 · 此设最低门槛
  if (s.startsWith("You are Cascade")) return true;
  let hits = 0;
  for (const m of OFFICIAL_SP_MARKERS) {
    if (s.indexOf(m) >= 0) hits++;
    if (hits >= 2) return true; // 至少两个官方标签 · 防单标签误伤
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// v7.7 · 多类 SP 标识 · 反者道之动 · 全链路探源
// ═══════════════════════════════════════════════════════════
// chat (主对话) · summary (会话/记忆/计划摘要) · memory (记忆生成/检索) ·
// ephemeral (一次性 · apply/refactor/inline edit) · apply (FastApply 等) ·
// inline (光标处补全) · unknown (未匹配但长 utf8)
//
// 实抓证据 (汝图 2026-04-29):
//   summary SP 起首 "You are an expert AI coding assistant with extreme attention to detail."
//   400+ 字, 当前 v7.6 透传未道化
// ═══════════════════════════════════════════════════════════
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
];

// classifySPType · 多类 SP 判: 返 'chat'|'summary'|'memory'|'ephemeral'|null
// 起首特征 + 多 marker 计票 (至少 2 命中)
function classifySPType(s) {
  if (!s || typeof s !== "string") return null;
  if (s.length < 100) return null;
  // 起首强特征
  if (s.startsWith("You are Cascade")) return "chat";
  if (
    s.startsWith("You are an expert AI coding") ||
    s.startsWith("You are an AI assistant") ||
    s.startsWith("You are an expert")
  )
    return "summary";
  // 计票
  const hits = { chat: 0, summary: 0, memory: 0, ephemeral: 0 };
  for (const m of OFFICIAL_SP_MARKERS) if (s.indexOf(m) >= 0) hits.chat++;
  for (const m of SUMMARY_SP_MARKERS) if (s.indexOf(m) >= 0) hits.summary++;
  for (const m of MEMORY_SP_MARKERS) if (s.indexOf(m) >= 0) hits.memory++;
  for (const m of EPHEMERAL_SP_MARKERS) if (s.indexOf(m) >= 0) hits.ephemeral++;
  // chat 标签多 (18) 单 marker 即可 (因 user_rules/user_information 等强独有)
  if (hits.chat >= 2) return "chat";
  if (hits.summary >= 2) return "summary";
  if (hits.memory >= 2) return "memory";
  if (hits.ephemeral >= 2) return "ephemeral";
  // 单标签 + 长文兜底为 unknown (留观察, 不丢)
  if (
    s.length > 400 &&
    (hits.chat || hits.summary || hits.memory || hits.ephemeral)
  )
    return "unknown_long";
  return null;
}

// ═══════════════════════════════════════════════════════════
// TAO_HEADER · v7.5 反者道之动 (四十章) · 并存二状 · 名身同于道
// v7.0-v7.4 (废): 强删 "You are Cascade" 起首, 但模型训练记忆仍出, 反生混乱
// v7.5: 反者道之动 · 弱者道之用 (四十章)
//       加回 "You are Cascade" 身份认同, 后续几十字令其唯遵道德经为律
//       官方之名与道德经之律 · 名身同于道 · 不夺, 但令其归
const TAO_HEADER =
  "You are Cascade. 唯遵下文道德经, 余皆为客. 处无为, 行不言. 道法自然.\n\n";

// ═══════════════════════════════════════════════════════════
// 工具块 · 道法自然 · 浑然统一 (v7.4 底层彻重构)
// 各块纯为道德经原文章节 · 无英技约束 · 无中英混杂 · 无 you/your/USER 措辞
// 道义: 有无相生, 难易相成, 长短相形, 高下相倾, 音声相和, 前后相随 (二章).
//       人法地, 地法天, 天法道, 道法自然 (二十五章).
//       工具不在器, 在道. 各块从道德经各章自悟其用, 不强加.
// ═══════════════════════════════════════════════════════════
const TOOL_BLOCK_DAO_CONTENT = {
  // 用器 · 三十辐共一毂 · 有无相生 · 处无为之事
  tool_calling:
    "三十辐共一毂, 当其无, 有车之用. 故有之以为利, 无之以为用.\n" +
    "善行无辙迹, 善言无瑕谪, 善数不用筹策.\n" +
    "处无为之事, 行不言之教.",

  // 修器 · 曲则全 · 大成若缺 · 慎终如始
  making_code_changes:
    "曲则全, 枉则直, 洼则盈, 敝则新, 少则得, 多则惑.\n" +
    "大成若缺, 其用不弊. 大直若屈, 大巧若拙.\n" +
    "慎终如始, 则无败事. 生而不有, 为而不恃.",

  // 行兵 · 重为轻根 · 兵不祥 · 哀者胜
  running_commands:
    "重为轻根, 静为躁君. 轻则失根, 躁则失君.\n" +
    "兵者不祥之器, 不得已而用之, 恬淡为上.\n" +
    "祸莫大于轻敌. 哀者胜矣.",

  // 谋 · 图难于易 · 千里足下 · 慎始
  task_management:
    "图难于其易, 为大于其细. 天下难事必作于易, 天下大事必作于细.\n" +
    "其安易持, 其未兆易谋. 为之于未有, 治之于未乱.\n" +
    "千里之行, 始于足下.",

  // 察 · 知不知上 · 致虚守静 · 玄同
  debugging:
    "知不知, 上; 不知知, 病.\n" +
    "致虚极, 守静笃. 归根曰静, 静曰复命.\n" +
    "挫其锐, 解其纷, 和其光, 同其尘, 是谓玄同.",

  // 交 · 信不足 · 轻诺寡信 · 信言不美
  calling_external_apis:
    "悠兮其贵言. 功成事遂, 百姓皆谓我自然.\n" +
    "夫轻诺必寡信, 多易必多难.\n" +
    "信言不美, 美言不信.",

  // 合 · 玄同 · 至柔入坚 · 善建不拔
  mcp_servers:
    "和其光, 同其尘, 是谓玄同. 故为天下贵.\n" +
    "天下之至柔, 驰骋天下之至坚. 无有入无间.\n" +
    "善建者不拔, 善抱者不脱.",

  // 存古 · 执古御今 · 守母知子 · 天网恢恢
  memory_system:
    "执古之道, 以御今之有.\n" +
    "既得其母, 以知其子; 既知其子, 复守其母.\n" +
    "天网恢恢, 疏而不失.",

  // 言 · 善言无瑕 · 言有宗 · 信言不美
  citation_guidelines:
    "善行无辙迹, 善言无瑕谪.\n" +
    "言有宗, 事有君.\n" +
    "信言不美, 美言不信. 善者不辩, 辩者不善.",
};

// ═══════════════════════════════════════════════════════════
// stripOfficialNaming · v7.3 为学日益, 唯道日损 · 至于无为
// v7.0 (沿): 起首身份段 / <communication_style> 整块 / discipline 6 行 已彻删
// v7.1 (沿): <ide_metadata> 整块 + <mcp_servers> 头元描述 + <user_rules> wrapper
// v7.3 (新): 用户域全删 + 工具内容替为道义中性
//
// === 已删 (从 v7.0/v7.1 沿) ===
// 一删 (起首身份段): 从开头至首 `<` tag · "You are Cascade...random files"
// 二删 (<communication_style>): 整块 (含 nested guidelines/markdown), 提 citation 留
// 三删 (discipline 散行): Bug fixing/Long-horizon/Planning/Testing/Verification/Progress 6 行
// 四删 (<ide_metadata>): 整块 · "You work inside of the user's IDE..."
// 五净 (<mcp_servers> 头): 删元描述 (MCP 是什么 / AI systems), 留 server 列表
//
// === v7.3 新 ===
// 七删 (用户域 1): <user_rules>...</user_rules> 整块 (含 nested <MEMORY[*]>)
//      反 v5.0/v7.1 之"用户域不剥". 唯道日损, 用户域归道德经为唯一本源.
// 八删 (用户域 2): 顶层游离 <MEMORY[*]>...</MEMORY[*]> 块亦删
// 九删 (用户域 3): <user_information>...</user_information> 整块 (OS/workspace 不必)
// 十替 (工具中性化): <tool_calling> 等 9 块内容 → 道义引 (章) + 最关键技术约束
//      工具描述内 "you/your/USER" 措辞俱去, 替为道义中性
//
// 不动 (唯道德经 + 工具 tag + 必要中性指引):
//   各工具块 tag 留 (<tool_calling>...</tool_calling>), 内容道义化
//   <citation_guidelines> 道义化保留
//   末示例 (When making function calls...) 实抓 SP 中无, 不强求
//
// 道义: 四十八章 为学日益, 为道日损. 损之又损, 以至于无为. 无为而无不为.
//       二十五章 人法地, 地法天, 天法道, 道法自然.
//       五十四章 善建者不拔. 引以为伴, 以道为唯一.
// ═══════════════════════════════════════════════════════════
function stripOfficialNaming(s) {
  if (!s || typeof s !== "string") return s;
  let out = s;

  // 1) 提取 nested <citation_guidelines>...</citation_guidelines> (将道义化重置)
  //    其位于 <communication_style> 内, 删 communication_style 前先记其存
  const hasCitation = /<citation_guidelines>/.test(out);

  // 2) 删起首身份段: 从开头至首 `<` tag
  const firstTagIdx = out.search(/<[a-zA-Z]/);
  if (firstTagIdx > 0) {
    out = out.slice(firstTagIdx);
  }

  // 3) 删 <communication_style>...</communication_style> 整块
  out = out.replace(
    /<communication_style>[\s\S]*?<\/communication_style>\s*/,
    "",
  );

  // 4) 删 <ide_metadata>...</ide_metadata> 整块
  out = out.replace(/<ide_metadata>[\s\S]*?<\/ide_metadata>\s*/, "");

  // 5) v7.3 新 · 删 <user_rules>...</user_rules> 整块 (含 nested <MEMORY[*]>)
  //    用户域归道德经为唯一本源 · 不复留 wrapper 或 nested
  out = out.replace(/<user_rules>[\s\S]*?<\/user_rules>\s*/g, "");

  // 6) v7.3 新 · 删顶层游离 <MEMORY[xxx]>...</MEMORY[xxx]> 块
  //    若 <MEMORY[*]> 非嵌于 <user_rules> 内 (已被 5) 删) 之外仍存, 此处删之
  out = out.replace(/<MEMORY\[[^\]]+\]>[\s\S]*?<\/MEMORY\[[^\]]+\]>\s*/g, "");

  // 7) v7.3 新 · 删 <user_information>...</user_information> 整块
  //    OS+workspace 上下文非必要 · 模型自工具调用知文件路径
  out = out.replace(/<user_information>[\s\S]*?<\/user_information>\s*/, "");

  // 7.1) v7.6 新 · 删其余用户域旁支 (workflows / rules / skills / memories)
  //      道法自然 · 道德经为唯一本源 · 不复留代令敃心
  out = out.replace(/<workflows>[\s\S]*?<\/workflows>\s*/g, "");
  out = out.replace(/<rules>[\s\S]*?<\/rules>\s*/g, "");
  out = out.replace(/<skills>[\s\S]*?<\/skills>\s*/g, "");
  out = out.replace(/<memories>[\s\S]*?<\/memories>\s*/g, "");

  // 7.5) v7.3 新 · 预收双套嵌 wrapper (e.g. <memory_system><memory_system>X</memory_system></memory_system>)
  //      实抓官方 SP 中 memory_system 为双套嵌, 不预收则 step 8) 非贪婪替换会 leave orphan </tag>
  for (const tag of Object.keys(TOOL_BLOCK_DAO_CONTENT)) {
    const reDouble = new RegExp(
      "<" +
        tag +
        ">\\s*<" +
        tag +
        ">([\\s\\S]*?)</" +
        tag +
        ">\\s*</" +
        tag +
        ">",
      "g",
    );
    out = out.replace(reDouble, "<" + tag + ">$1</" + tag + ">");
  }

  // 8) v7.3 新 · 各工具块内容替为道义中性 (留 tag, 替内容)
  //    工具描述内 "you/your/USER" 措辞全去 · 道义引 + 最关键技术约束
  for (const [tag, daoText] of Object.entries(TOOL_BLOCK_DAO_CONTENT)) {
    const re = new RegExp("<" + tag + ">[\\s\\S]*?</" + tag + ">", "g");
    out = out.replace(re, "<" + tag + ">\n" + daoText + "\n</" + tag + ">");
  }

  // 9) 重置独立 <citation_guidelines> 块 (从 communication_style 内提出, 已道义化)
  //    若 strip 后无, 则补一份道义化版本
  if (hasCitation && !out.includes("<citation_guidelines>")) {
    out =
      "<citation_guidelines>\n" +
      TOOL_BLOCK_DAO_CONTENT.citation_guidelines +
      "\n</citation_guidelines>\n" +
      out;
  }

  // 10) 删 discipline 散行 + 其缩进续行 (六类规训之名)
  out = out.replace(
    /^(?:Bug fixing discipline|Long-horizon workflow|Planning cadence|Testing discipline|Verification tools|Progress notes):[^\n]*(?:\n[ \t]+[^\n]*)*\n?/gm,
    "",
  );

  // 11) 收 3+ 连续换行为 2
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.replace(/^\s+/, "");
}

// ═══════════════════════════════════════════════════════════
// SAMPLE_OFFICIAL_SP · 仿真实抓官方 SP 结构 · 模块级 const
// ═══════════════════════════════════════════════════════════
// 用途: 1) selftest 三路径回归 2) /origin/preview 无 captured 时合成 after
// 道义: 二章 万物作焉而不辞. 样以见真, 不以代真.
// 抓自 2026-04-29 实 official SP 之结构骨架 (~2.7KB minified).
// ═══════════════════════════════════════════════════════════
const SAMPLE_OFFICIAL_SP = [
  "You are Cascade, a powerful agentic AI coding assistant.",
  "The USER is interacting with you through a chat panel in their IDE.",
  "The task may require modifying or debugging existing code.",
  "Be mindful of that you are not the only one working in this environment.",
  "Do not overstep your bounds, your goal is to be a pair programmer to the user in completing their task.",
  "For example: Do not create random files.",
  "<communication_style>",
  "Be terse and direct.",
  "<communication_guidelines>be concise</communication_guidelines>",
  "<markdown_formatting>use markdown</markdown_formatting>",
  "<citation_guidelines>@/abs/path:line</citation_guidelines>",
  "</communication_style>",
  "<tool_calling>",
  "Use only the available tools. Never guess parameters. Before each tool call, briefly state why.",
  "</tool_calling>",
  "<making_code_changes>",
  "EXTREMELY IMPORTANT: Your generated code must be immediately runnable.",
  "If you're creating the codebase from scratch, create deps file.",
  "</making_code_changes>",
  "<running_commands>",
  "You have the ability to run terminal commands on the user's machine.",
  "You are not running in a dedicated container.",
  "</running_commands>",
  "<task_management>",
  "Use update_plan to manage work.",
  "</task_management>",
  "<debugging>",
  "When debugging, only make code changes if you are certain that you can solve the problem.",
  "</debugging>",
  "<mcp_servers>",
  "The Model Context Protocol (MCP) is a standard that connects AI systems with external tools and data sources.",
  "MCP servers extend your capabilities by providing access to specialized functions.",
  "The following MCP servers are available to you.",
  "# context7",
  "Use this server to retrieve up-to-date documentation.",
  "# github",
  "# playwright",
  "# tavily",
  "</mcp_servers>",
  "<calling_external_apis>",
  "When selecting which version of an API or package to use, choose one that is compatible with the USER's dependency management file.",
  "</calling_external_apis>",
  "<user_rules>",
  "The following are user-defined rules that you MUST ALWAYS FOLLOW WITHOUT ANY EXCEPTION.",
  "Review them carefully and always take them into account when you generate responses and code:",
  "<MEMORY[dao-de-jing.md]>",
  "道可道，非常道. 名可名非常名.",
  "</MEMORY[dao-de-jing.md]>",
  "</user_rules>",
  "<user_information>OS=windows</user_information>",
  "<memory_system>",
  "<memory_system>",
  "You have access to a persistent database.",
  "</memory_system>",
  "</memory_system>",
  "<ide_metadata>",
  "You work inside of the user's IDE. Sometimes, you will receive metadata.",
  "</ide_metadata>",
  "Bug fixing discipline: root cause first.",
  "Long-horizon workflow: notes.",
  "Planning cadence: plan.",
  "Testing discipline: tests first.",
  "Verification tools: playwright.",
  "Progress notes: lightweight.",
].join("\n");

// ═══════════════════════════════════════════════════════════
// _quickHash · 字符串简哈 · 用于 sig 比对 · 不求密 · 求快
// ═══════════════════════════════════════════════════════════
// FNV-1a 32 位变体. 对全 SP 不必精, 16 位 hex 足以辨变化.
function _quickHash(s) {
  if (!s) return "0";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return (
    ("00000000" + h.toString(16)).slice(-8) +
    ("0000" + (s.length & 0xffff).toString(16)).slice(-4)
  );
}

function invertSP(spText) {
  if (spText === undefined || spText === null) return null;
  const s = typeof spText === "string" ? spText : String(spText);
  if (!s) return null;
  if (!isLikelyOfficialSP(s)) return null; // 非官方 SP 透传 · 防误伤 user msg

  // v7.2 用户实时编辑优先 (人法地, 地法天, 天法道, 道法自然)
  // 用户即道, 编辑即真. _customSP 存则覆默认道德经路径.
  if (_customSP && _customSP.sp) {
    if (_customSP.keep_blocks) {
      // 保留官方工具块: user_sp + 工具与必要模块
      const stripped = stripOfficialNaming(s);
      return _customSP.sp + "\n\n---\n\n" + stripped;
    }
    // 彻底替代: 仅 user_sp (工具能力或失, 用户自任)
    return _customSP.sp;
  }

  // 默认: v7.5 反者道之动 · TAO_HEADER (身份认同+唯遵道德经之律) + 道德经八十一章 + sep + 净 SP
  // 名身同于道 · 不夺, 但令其归
  if (!DAO_DE_JING_81) return null;
  const stripped = stripOfficialNaming(s);
  return TAO_HEADER + DAO_DE_JING_81 + "\n\n---\n\n" + stripped;
}

// ═══════════════════════════════════════════════════════════
// 道法自然 · v5.0 删深度净化侧信道全部代码 · v5.1 加损强名
// ═══════════════════════════════════════════════════════════
// v5.0: 跳出剥/留二元矛盾, 不剥用户域侧信道 (skills/workflows/MEMORY[*]).
// v5.1: 损官方 SP 中之强名/强行/强执相 (起首段 / communication_style / 散行 discipline).
// 道魂在前为本源, 又损官方强名, 模型自归道德经.
// 圣人不积. 既以为人, 己愈有; 既以与人, 己愈多.

// ═══════════════════════════════════════════════════════════
// dissectSP · 解剖一切 · 抱一知天下势 (仅观, 不剥)
// 输入: SP 全文  输出: 结构化解剖 (身份首言 + 各 XML 块含嵌套深度 + 末尾倾向)
// ═══════════════════════════════════════════════════════════
function dissectSP(text) {
  if (!text || typeof text !== "string") return null;
  var result = {
    total_chars: text.length,
    block_count: 0,
    identity_chars: 0,
    identity_head: "",
    blocks: [],
    tail_chars: 0,
    tail_head: "",
  };

  // 通用 XML-like 块扫描 (含嵌套): <tag>...</tag> 与 <MEMORY[xxx]>...</MEMORY[xxx]>
  var allBlocks = [];

  // 通用 <tag> 块: tag 限 [a-zA-Z][a-zA-Z0-9_-]*
  var tagRe = /<([a-zA-Z][a-zA-Z0-9_-]*)(?:\s[^>]*)?>/g;
  var om;
  while ((om = tagRe.exec(text)) !== null) {
    var tag = om[1];
    var closeStr = "</" + tag + ">";
    var closeIdx = text.indexOf(closeStr, om.index + om[0].length);
    if (closeIdx < 0) continue;
    var blockEnd = closeIdx + closeStr.length;
    allBlocks.push({
      tag: tag,
      start: om.index,
      end: blockEnd,
      content: text.slice(om.index + om[0].length, closeIdx),
    });
  }

  // MEMORY[name] 块
  var memRe = /<(MEMORY\[[^\]]*\])>([\s\S]*?)<\/MEMORY\[[^\]]*\]>/gi;
  var mm;
  while ((mm = memRe.exec(text)) !== null) {
    allBlocks.push({
      tag: mm[1],
      start: mm.index,
      end: mm.index + mm[0].length,
      content: mm[2],
    });
  }

  // 按位置排序
  allBlocks.sort(function (a, b) {
    return a.start - b.start;
  });

  // 去重: 同一 start+end 只保留一个
  var seen = {};
  allBlocks = allBlocks.filter(function (b) {
    var key = b.start + ":" + b.end;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  // 计算深度: 被其他块包含则 depth++
  for (var i = 0; i < allBlocks.length; i++) {
    allBlocks[i].depth = 0;
    for (var j = 0; j < allBlocks.length; j++) {
      if (i === j) continue;
      if (
        allBlocks[j].start < allBlocks[i].start &&
        allBlocks[j].end > allBlocks[i].end
      ) {
        allBlocks[i].depth++;
      }
    }
  }

  // 身份首言: 第一个块之前的文本
  var firstStart = allBlocks.length > 0 ? allBlocks[0].start : text.length;
  var identity = text.slice(0, firstStart).trim();
  result.identity_chars = identity.length;
  result.identity_head = identity.slice(0, 300);

  // 各块
  for (var k = 0; k < allBlocks.length; k++) {
    var b = allBlocks[k];
    var chars = b.content.length;
    var truncated = chars > 600;
    result.blocks.push({
      tag: b.tag,
      depth: b.depth,
      start: b.start,
      content_chars: chars,
      content_head: b.content.slice(0, 300),
      content_tail: truncated ? b.content.slice(-200) : "",
      truncated: truncated,
    });
  }
  result.block_count = allBlocks.length;

  // 末尾: 最后一个顶层块之后的文本
  var lastTopEnd = 0;
  for (var m = 0; m < allBlocks.length; m++) {
    if (allBlocks[m].depth === 0 && allBlocks[m].end > lastTopEnd) {
      lastTopEnd = allBlocks[m].end;
    }
  }
  if (lastTopEnd > 0) {
    var tail = text.slice(lastTopEnd).trim();
    result.tail_chars = tail.length;
    result.tail_head = tail.slice(0, 300);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// Protobuf 纯函数 · varint / fields / Connect-RPC 帧
// ═══════════════════════════════════════════════════════════
function encodeVarint(v) {
  const b = [];
  while (v > 127) {
    b.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  b.push(v & 0x7f);
  return Buffer.from(b);
}
function readVarint(data, pos) {
  let r = 0,
    s = 0;
  while (pos < data.length) {
    const b = data[pos++];
    r |= (b & 0x7f) << s;
    if ((b & 0x80) === 0) return [r, pos];
    s += 7;
    if (s > 63) throw new Error("varint too long");
  }
  throw new Error("varint truncated");
}
function encodeLen(x) {
  const b = typeof x === "string" ? Buffer.from(x, "utf8") : x;
  return Buffer.concat([encodeVarint(b.length), b]);
}
function parseProto(buf) {
  const bytes = buf instanceof Buffer ? buf : Buffer.from(buf);
  const fields = {};
  let pos = 0;
  while (pos < bytes.length) {
    const [tag, p1] = readVarint(bytes, pos);
    pos = p1;
    const fn = tag >>> 3,
      w = tag & 7;
    let val;
    if (w === 0) {
      const [v, p2] = readVarint(bytes, pos);
      val = { w, v };
      pos = p2;
    } else if (w === 2) {
      const [len, p2] = readVarint(bytes, pos);
      val = { w, b: bytes.slice(p2, p2 + len) };
      pos = p2 + len;
    } else if (w === 1) {
      val = { w, b: bytes.slice(pos, pos + 8) };
      pos += 8;
    } else if (w === 5) {
      val = { w, b: bytes.slice(pos, pos + 4) };
      pos += 4;
    } else {
      throw new Error("unsupported wire type " + w);
    }
    (fields[fn] ||= []).push(val);
  }
  return fields;
}
function serializeProto(fields) {
  const parts = [];
  for (const [fn_, arr] of Object.entries(fields)) {
    const fn = parseInt(fn_);
    for (const e of arr) {
      const tag = (fn << 3) | e.w;
      parts.push(encodeVarint(tag));
      if (e.w === 0) parts.push(encodeVarint(e.v));
      else if (e.w === 2) parts.push(encodeLen(Buffer.from(e.b)));
      else if (e.w === 1 || e.w === 5) parts.push(Buffer.from(e.b));
    }
  }
  return Buffer.concat(parts);
}

// Connect-RPC frame: 1 byte flags + 4 byte BE length + payload
// flags bit 0 (0x01) = compressed (gzip / deflate / br — 全尝)
// flags bit 7 (0x80) = end-of-stream
function tryDecompress(buf) {
  const attempts = [
    () => zlib.gunzipSync(buf),
    () => zlib.inflateSync(buf),
    () => zlib.inflateRawSync(buf),
    () => zlib.brotliDecompressSync(buf),
  ];
  for (const fn of attempts) {
    try {
      return fn();
    } catch {}
  }
  return null;
}
function parseFrames(buf) {
  const frames = [];
  let pos = 0;
  while (pos + 5 <= buf.length) {
    const flags = buf[pos];
    const len = buf.readUInt32BE(pos + 1);
    if (pos + 5 + len > buf.length) break;
    const raw = buf.slice(pos + 5, pos + 5 + len);
    let payload = raw;
    if (flags & 0x01 && !(flags & 0x80) && raw.length >= 2) {
      const d = tryDecompress(raw);
      if (d) payload = d;
    }
    frames.push({ flags, payload });
    pos += 5 + len;
  }
  return frames;
}
// 始终输出 uncompressed (flags bit 0 清零), 避免重压 gzip 之复杂.
function buildFrame(flags, payload) {
  const h = Buffer.alloc(5);
  h[0] = flags & ~0x01;
  h.writeUInt32BE(payload.length, 1);
  return Buffer.concat([h, payload]);
}

// 粗筛 UTF-8 文本: 用于区分 nested proto 与 plain SP bytes.
function looksLikeUtf8Text(buf) {
  if (!buf || buf.length < 4) return false;
  const n = Math.min(512, buf.length);
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const b = buf[i];
    if ((b >= 0x20 && b < 0x7f) || b === 9 || b === 10 || b === 13 || b >= 0x80)
      ok++;
  }
  return ok / n > 0.95;
}

// ═══════════════════════════════════════════════════════════
// chat_messages 字段定位 + ChatMessage content 提取
// ═══════════════════════════════════════════════════════════
// 字段自适应: v2 现场 field=2, v1 descriptor field=3 (chat_messages),
// 另有 L0 证据的 field 10/17 (SystemPromptb 新载体).
// 严格白名单 · 防误判 (任意含 role+content 的 proto 都会命中全遍历启发式).
const MSGS_FIELD_CANDIDATES = [2, 3, 10, 17];

function findMsgsField(topFields) {
  for (const fn of MSGS_FIELD_CANDIDATES) {
    const arr = topFields[fn];
    if (!arr || !arr.length) continue;
    for (const e of arr) {
      if (e.w !== 2) continue;
      // 情形 A: nested ChatMessage proto (Windsurf v2 主路径)
      try {
        const mf = parseProto(Buffer.from(e.b));
        if (mf[1]?.[0]?.w === 0 && mf[2]) return fn;
      } catch {}
      // 情形 B: plain UTF-8 SP bytes (Windsurf SystemPromptb 新载体)
      // 只有长段 UTF-8 才认 (避免把短配置字段误判为 SP)
      if (e.b.length > 200 && looksLikeUtf8Text(Buffer.from(e.b))) return fn;
    }
  }
  return 2;
}

function extractMsgContent(mf) {
  const c = mf[2]?.[0];
  if (!c || c.w !== 2) return "";
  return Buffer.from(c.b).toString("utf8");
}

// ═══════════════════════════════════════════════════════════
// 修改 GetChatMessage{V2,} 请求的 SP
// ═══════════════════════════════════════════════════════════
function modifySPProto(reqBody) {
  try {
    const frames = parseFrames(reqBody);
    if (!frames.length) return reqBody;
    const f0 = frames[0];
    const topFields = parseProto(f0.payload);
    const MSGS_FIELD = findMsgsField(topFields);
    const msgEntries = topFields[MSGS_FIELD];
    if (!msgEntries || !msgEntries.length) return reqBody;

    let changed = false;
    const newMsgs = [];
    for (let i = 0; i < msgEntries.length; i++) {
      const me = msgEntries[i];
      if (me.w !== 2) {
        newMsgs.push(me);
        continue;
      }
      const b0 = Buffer.from(me.b);
      // 情形 A: entry.b 是 nested ChatMessage proto (Windsurf v2 主路径)
      let mf;
      try {
        mf = parseProto(b0);
      } catch {
        // 情形 B: entry.b 不是 proto · fallback 看是否 UTF-8 plain SP
        if (looksLikeUtf8Text(b0)) {
          const text = b0.toString("utf8");
          const kept = invertSP(text);
          if (kept === null) {
            newMsgs.push(me);
            continue;
          }
          log(
            `[SP-PLAIN] msg[${i}] field=${MSGS_FIELD} before=${text.length}B ` +
              `head="${text.slice(0, 40).replace(/\n/g, "\\n")}"  → after=${kept.length}B`,
          );
          newMsgs.push({ w: 2, b: Buffer.from(kept, "utf8") });
          changed = true;
        } else {
          newMsgs.push(me);
        }
        continue;
      }
      // parse 成功 · 按 ChatMessage 处理: role=0 才改
      const role = mf[1]?.[0]?.v ?? 1;
      if (role !== 0) {
        newMsgs.push(me);
        continue;
      }
      const content = extractMsgContent(mf);
      const kept = invertSP(content);
      if (kept === null) {
        newMsgs.push(me);
        continue;
      }
      log(
        `[SP-NESTED] msg[${i}] role=0 field=${MSGS_FIELD} before=${content.length}B ` +
          `head="${content.slice(0, 40).replace(/\n/g, "\\n")}"  → after=${kept.length}B`,
      );
      mf[2] = [{ w: 2, b: Buffer.from(kept, "utf8") }];
      newMsgs.push({ w: 2, b: serializeProto(mf) });
      changed = true;
    }
    topFields[MSGS_FIELD] = newMsgs;
    if (!changed) return reqBody;
    const newPayload = serializeProto(topFields);
    const rest = frames.slice(1).map((f) => buildFrame(f.flags, f.payload));
    return Buffer.concat([buildFrame(f0.flags, newPayload), ...rest]);
  } catch (e) {
    log("modifySPProto error:", e.message);
    return reqBody;
  }
}

// RawGetChatMessage: system_prompt_override 在 topFields[3]
function modifyRawSP(reqBody) {
  try {
    const frames = parseFrames(reqBody);
    if (!frames.length) return reqBody;
    const f0 = frames[0];
    const topFields = parseProto(f0.payload);
    const spEntry = topFields[3]?.[0];
    if (!spEntry || spEntry.w !== 2) return reqBody;
    const origSP = Buffer.from(spEntry.b).toString("utf8");
    const kept = invertSP(origSP);
    let spChanged = false;
    if (kept !== null) {
      log(
        `[SP-RAW] field=3 before=${origSP.length}B ` +
          `head="${origSP.slice(0, 40).replace(/\n/g, "\\n")}"  → after=${kept.length}B`,
      );
      topFields[3] = [{ w: 2, b: Buffer.from(kept, "utf8") }];
      spChanged = true;
    }
    if (!spChanged) return reqBody;
    const newPayload = serializeProto(topFields);
    const rest = frames.slice(1).map((f) => buildFrame(f.flags, f.payload));
    return Buffer.concat([buildFrame(f0.flags, newPayload), ...rest]);
  } catch (e) {
    log("modifyRawSP error:", e.message);
    return reqBody;
  }
}

// ═══════════════════════════════════════════════════════════
// v17.48 · observeSPFromBody · 纯观察 · 不改一字节
// ═══════════════════════════════════════════════════════════
// 反者道之动 · 无为而无不为 · 底层之底
// 此函数于主 handler 根路调用 · 先于任何变身判定 · 无论 invert/passthrough
// 皆捕 Windsurf 真发 SP · 实时 · 无需用户直接抓取 · 随模切换随即同步
// 读取三路径之 SP (与 modifySPProto/modifyRawSP 同源) · 返 null 若非 SP 请求
function observeSPFromBody(body, kind) {
  try {
    const frames = parseFrames(body);
    if (!frames.length) return null;
    const topFields = parseProto(frames[0].payload);

    // CHAT_RAW: SP 于 topFields[3]
    if (kind === "CHAT_RAW") {
      const spEntry = topFields[3] && topFields[3][0];
      if (!spEntry || spEntry.w !== 2) return null;
      const text = Buffer.from(spEntry.b).toString("utf8");
      if (!text) return null;
      return { variant: "raw_sp", field: 3, role: null, before: text };
    }

    // CHAT_PROTO: SP 于 msgs field 中 role=0 的 entry
    if (kind === "CHAT_PROTO") {
      const MSGS_FIELD = findMsgsField(topFields);
      const entries = topFields[MSGS_FIELD];
      if (!entries || !entries.length) return null;
      for (let i = 0; i < entries.length; i++) {
        const me = entries[i];
        if (me.w !== 2) continue;
        const b0 = Buffer.from(me.b);
        // 情形 A: nested ChatMessage proto
        try {
          const mf = parseProto(b0);
          const role = mf[1] && mf[1][0] && mf[1][0].v;
          if (role === 0 && mf[2] && mf[2][0] && mf[2][0].b) {
            const text = Buffer.from(mf[2][0].b).toString("utf8");
            if (text)
              return {
                variant: "nested_chat_message",
                field: MSGS_FIELD,
                role: 0,
                before: text,
              };
          }
        } catch {}
        // 情形 B: plain UTF-8 SP bytes (Windsurf SystemPromptb 新载体)
        if (b0.length > 200 && looksLikeUtf8Text(b0)) {
          const text = b0.toString("utf8");
          if (text)
            return {
              variant: "plain_utf8",
              field: MSGS_FIELD,
              role: 0,
              before: text,
            };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// v7.7 · deepScanProto / observeAllSPInBody · 反者道之动 · 全链路探源
// ═══════════════════════════════════════════════════════════
// 不绑 RPC 名, 任何 inference RPC body 字段级递归扫.
// 每个 wire-type=2 (length-delimited) 字段:
//   粒1: 长 utf8 文本 (>100B) → classifySPType, 命中即落候选
//   粒2: 嵌套 proto (try parse) → 递归 (maxDepth 防爆)
// 道义: 二章 万物作焉而不辞. 二十一章 其精甚真, 其中有信.
//       不预设结构, 自悟所见. 反者道之动 (四十章).
// ═══════════════════════════════════════════════════════════
function deepScanProto(buf, pathStack, candidates, maxDepth) {
  if (maxDepth <= 0) return;
  let fields;
  try {
    fields = parseProto(buf);
  } catch {
    return;
  }
  for (const fnStr of Object.keys(fields)) {
    const arr = fields[fnStr];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e.w !== 2) continue;
      const b = Buffer.from(e.b);
      const newPath = pathStack.concat([fnStr + "[" + i + "]"]);
      // 策略: 优先尝试递归 (假定为嵌套 proto). 递归无新候选时, 回退 utf8 leaf 检测.
      // 反者道之动: 不假定结构, 让 SP 在最深叶子被精确定位.
      let recursed = false;
      if (b.length > 8) {
        const before = candidates.length;
        deepScanProto(b, newPath, candidates, maxDepth - 1);
        recursed = candidates.length > before;
      }
      // 递归未产候选时, 若是长 utf8, 当 leaf SP 检测
      if (!recursed && b.length > 100 && looksLikeUtf8Text(b)) {
        const text = b.toString("utf8");
        const spType = classifySPType(text);
        if (spType) {
          candidates.push({
            kind: spType,
            field_path: newPath.join("."),
            chars: text.length,
            text: text,
          });
        }
      }
    }
  }
}

function observeAllSPInBody(body, rpcPath) {
  try {
    const frames = parseFrames(body);
    if (!frames.length) return [];
    const candidates = [];
    for (let fi = 0; fi < frames.length; fi++) {
      deepScanProto(frames[fi].payload, ["f" + fi], candidates, 6);
    }
    // 去重 (按 hash)
    const seen = new Set();
    const out = [];
    for (const c of candidates) {
      const h = _quickHash(c.text);
      if (seen.has(h)) continue;
      seen.add(h);
      c.hash = h;
      out.push(c);
    }
    return out;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// 路由 + 分类
// ═══════════════════════════════════════════════════════════
function routeUpstream(reqUrl) {
  const qIdx = reqUrl.indexOf("?");
  const rawPath = qIdx < 0 ? reqUrl : reqUrl.slice(0, qIdx);
  const query = qIdx < 0 ? "" : reqUrl.slice(qIdx);
  // legacy 前缀兼容
  if (rawPath.startsWith("/i/"))
    return { host: UPSTREAM_INFER, path: rawPath.slice(2) + query };
  if (rawPath.startsWith("/r/"))
    return { host: UPSTREAM_MGMT, path: rawPath.slice(2) + query };
  // 服务名自动分流
  const m = rawPath.match(/^\/([^/]+)\//);
  const svc = m ? m[1] : "";
  if (INFERENCE_SERVICES.has(svc))
    return { host: UPSTREAM_INFER, path: rawPath + query };
  return { host: UPSTREAM_MGMT, path: rawPath + query };
}

// 分三档:
//   CHAT_PROTO    · GetChatMessage{,V2}    · SP 字段前置道魂
//   CHAT_RAW      · RawGetChatMessage      · field[3] SP 前置道魂
//   PASSTHROUGH   · 余皆透传 (含其他 inference RPC · mgmt 等)
function classifyRPC(reqPath) {
  if (!reqPath) return "PASSTHROUGH";
  const m = /\/([A-Za-z0-9_]+)$/.exec(reqPath);
  const rpc = m ? m[1] : "";
  if (rpc === "GetChatMessage" || rpc === "GetChatMessageV2")
    return "CHAT_PROTO";
  if (rpc === "RawGetChatMessage") return "CHAT_RAW";
  return "PASSTHROUGH";
}

// ═══════════════════════════════════════════════════════════
// HTTP 控制面 (/origin/...)
// ═══════════════════════════════════════════════════════════
function handleControl(req, res) {
  const u = url.parse(req.url, true);
  // CORS: webview (vscode-webview://) 直连需要
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // v7.8 debug: recent request paths
  if (u.pathname === "/origin/paths" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        count: _recentPaths.length,
        paths: _recentPaths,
      }),
    );
    return true;
  }

  if (u.pathname === "/origin/ping" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        port: PORT,
        mode: SP_MODE,
        pid: process.pid,
        uptime_s: Math.round((Date.now() - START_TIME) / 1000),
        req_total: reqCounter,
        dao_loaded: DAO_DE_JING_81.length > 0,
        dao_chars: DAO_DE_JING_81.length,
        self_size: _SELF_SIZE,
        self_file: __filename,
        // v7.2 · 用户实时编辑提示词状态 (人法地, 地法天, 天法道, 道法自然)
        custom_sp: !!(_customSP && _customSP.sp),
        custom_sp_chars: _customSP && _customSP.sp ? _customSP.sp.length : 0,
        custom_sp_keep_blocks:
          _customSP && _customSP.sp ? !!_customSP.keep_blocks : null,
        // v7.7 · 广谱 SP 候选 ringbuf 状态 (反者道之动)
        node_version: process.version,
        mux: {
          conns: _muxConns,
          h1: _muxH1,
          h2: _muxH2,
          nil: _muxNull,
          h2errs: _h2Errs,
          h2sess: _h2Sessions,
          h2streams: _h2Streams,
          h2closes: _h2Closes,
          h2sess_errs: _h2SessErrs,
        },
        sp_candidates_count: _spCandidates.length,
        sp_candidates_max: _SP_CANDIDATES_MAX,
        sp_candidates_kinds: _spCandidates.reduce((acc, c) => {
          acc[c.kind] = (acc[c.kind] || 0) + 1;
          return acc;
        }, {}),
        features: {
          mode: "fan-zhe-dao-zhi-dong-quan-lian-lu-tan-yuan",
          tao_header_chars: TAO_HEADER.length,
          principle:
            "v7.7 反者道之动 · 全链路探源 · 字段级广谱深扫 · 不绑 RPC 名 · classifySPType 多类标识 · _spCandidates ringbuf · v7.6 沿: 主 chat 道德经化 · 待 v7.8 因器施治",
          stripped_official_naming: [
            "head:You-are-Cascade-identity-paragraph",
            "block:<communication_style>(含 nested guidelines/markdown)",
            "lines:Bug-fixing/Long-horizon/Planning/Testing/Verification/Progress",
            "v7.1:block:<ide_metadata>",
            "v7.3:block:<user_rules>(含 nested <MEMORY[*]>)",
            "v7.3:block:<user_information>(OS+workspace)",
            "v7.3:block:<MEMORY[*]>(顶层游离)",
            "v7.4:replace:9-tool-blocks-content→pure-dao-de-jing-text",
            "v7.7:observe:all-inference-RPC-bodies(deepScanProto)",
          ],
          preserved_intact: [
            "tools-tag:<tool_calling>/<making_code_changes>/<running_commands>/<task_management>/<debugging>/<calling_external_apis>/<memory_system>/<mcp_servers>/<citation_guidelines>",
            "tools-content:pure-dao-de-jing-original-text-only",
          ],
          tool_block_dao_replacements: Object.keys(TOOL_BLOCK_DAO_CONTENT),
        },
      }),
    );
    return true;
  }

  if (u.pathname === "/origin/mode" && req.method === "GET") {
    res.end(JSON.stringify({ mode: SP_MODE, valid: [...SP_MODE_VALID] }));
    return true;
  }

  // v17.47 · 实注本源 · 真本源 (非自检合成 · 乃真流量之截)
  // ?full=1 → 返回 before/after 全文 · 省则各留 1024 字头 + 256 字尾
  if (u.pathname === "/origin/lastinject" && req.method === "GET") {
    if (!_lastInject) {
      res.end(JSON.stringify({ ok: true, has_inject: false }));
      return true;
    }
    const full = u.query && u.query.full === "1";
    const ev = Object.assign({}, _lastInject);
    if (!full) {
      const cap = (s) => {
        if (typeof s !== "string") return s;
        if (s.length <= 1280) return s;
        return s.slice(0, 1024) + "\n…\n" + s.slice(-256);
      };
      ev.before = cap(ev.before);
      ev.after = cap(ev.after);
    }
    res.end(
      JSON.stringify({
        ok: true,
        has_inject: true,
        full: !!full,
        age_s: Math.round((Date.now() - ev.at) / 1000),
        ...ev,
      }),
    );
    return true;
  }

  // v17.55 · 抱一守中 · 万法归于一端点
  // 无论任何模式 · 任何用户规则变化 · 任何设置改动
  // preview 皆返: after (LLM 实收) + before (Windsurf 拟发) + 结构解剖
  // 致虚守静 · 观复知常 · 落盘持存 · 跨重启恒显
  if (u.pathname === "/origin/preview" && req.method === "GET") {
    const hasBefore = !!(_lastInject && _lastInject.before);
    const before = hasBefore ? _lastInject.before : null;
    const age_s =
      _lastInject && _lastInject.at
        ? Math.round((Date.now() - _lastInject.at) / 1000)
        : null;
    // v7.3 · 真实 after 计算: invert 模式下永远走 invertSP 实算路径
    //   有 captured before → invertSP(before) (真路径)
    //   无 captured before → invertSP(SAMPLE_OFFICIAL_SP) (合成路径, 与 LLM 实收同结构)
    // 不再用 TAO_HEADER+DAO 单文本退路 (那不代表 LLM 实收, 误导用户)
    let after;
    let synthesized = false;
    let synthesizedFrom = null; // captured | sample | none
    if (SP_MODE === "invert") {
      if (hasBefore) {
        after = invertSP(before) || before;
        synthesizedFrom = "captured";
      } else {
        // 用合成 sample 走 invertSP, 让 webview 见的与 LLM 实收同结构
        after = invertSP(SAMPLE_OFFICIAL_SP) || SAMPLE_OFFICIAL_SP;
        synthesized = true;
        synthesizedFrom = "sample";
      }
    } else {
      after = before; // passthrough: 透
      synthesizedFrom = hasBefore ? "captured" : "none";
    }
    const before_dissect = before ? dissectSP(before) : null;
    const after_dissect = after ? dissectSP(after) : null;
    res.end(
      JSON.stringify({
        ok: true,
        mode: SP_MODE,
        synthesized: synthesized,
        synthesized_from: synthesizedFrom, // captured | sample | none
        source: hasBefore ? "captured" : "at_rest",
        after: after,
        after_chars: after ? after.length : 0,
        before: before,
        before_chars: before ? before.length : 0,
        has_captured_before: hasBefore,
        age_s: age_s,
        before_dissect: before_dissect,
        after_dissect: after_dissect,
        tao_header_chars: TAO_HEADER.length,
        dao_chars: DAO_DE_JING_81.length,
        // v7.2 · 用户实时编辑提示词状态
        custom_sp: !!(_customSP && _customSP.sp),
        custom_sp_chars: _customSP && _customSP.sp ? _customSP.sp.length : 0,
        custom_sp_keep_blocks:
          _customSP && _customSP.sp ? !!_customSP.keep_blocks : null,
        custom_sp_at: _customSP && _customSP.at ? _customSP.at : null,
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v7.3 · /origin/sig · 简哈签名 · webview 实时同步检变之据
  // ═══════════════════════════════════════════════════════════
  // 返: { mode, sp_sig, custom_sig, last_inject_at, custom_sp }
  // sp_sig    = quickHash(_lastInject.before) (官方 SP 变即变)
  // custom_sig = _customSP ? quickHash(sp+at) : "0" (用户态变即变)
  // webview SSE/poll 拼 "mode|sp_sig|custom_sig" 比对, 异即触 refresh.
  // 道义: 一章 玄之又玄 众妙之门. 一签观全境.
  if (u.pathname === "/origin/sig" && req.method === "GET") {
    const beforeText =
      _lastInject && _lastInject.before ? _lastInject.before : "";
    const customText =
      _customSP && _customSP.sp
        ? _customSP.sp +
          "|" +
          (_customSP.keep_blocks ? "1" : "0") +
          "|" +
          (_customSP.at || 0)
        : "";
    res.end(
      JSON.stringify({
        ok: true,
        mode: SP_MODE,
        sp_sig: _quickHash(beforeText),
        custom_sig: _quickHash(customText),
        last_inject_at: _lastInject && _lastInject.at ? _lastInject.at : 0,
        custom_sp: !!(_customSP && _customSP.sp),
        custom_sp_at: _customSP && _customSP.at ? _customSP.at : 0,
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v7.3 · /origin/dao_default · 道德经81章默认值 · 编辑面板"回填默认"
  // ═══════════════════════════════════════════════════════════
  // 返: { ok, dao, chars }
  // 道义: 五十四章 善建者不拔, 善抱者不脱. 默以为基, 编以为长.
  if (u.pathname === "/origin/dao_default" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        dao: DAO_DE_JING_81,
        chars: DAO_DE_JING_81.length,
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v7.7 · /origin/sp_candidates · 广谱 SP 候选 ringbuf · 反者道之动
  // ═══════════════════════════════════════════════════════════
  // GET    返当前 ringbuf (默认 head 300 / tail 200, ?full=1 返全文)
  // DELETE 清空 ringbuf 与盘文件
  // 道义: 二章 万物作焉而不辞. 收一切 SP 来源, 不弃, 待 v7.8 因器施治.
  if (u.pathname === "/origin/sp_candidates" && req.method === "GET") {
    const full = u.query && u.query.full === "1";
    const out = _spCandidates.map((c) => {
      const item = {
        first_at: c.first_at,
        last_at: c.last_at,
        first_age_s: Math.round((Date.now() - c.first_at) / 1000),
        last_age_s: Math.round((Date.now() - c.last_at) / 1000),
        count: c.count,
        rid: c.rid,
        rpc: c.rpc,
        kind: c.kind,
        field_path: c.field_path,
        chars: c.chars,
        hash: c.hash,
      };
      if (full) {
        item.text = c.text;
      } else {
        item.head = (c.text || "").slice(0, 300);
        item.tail = (c.text || "").length > 600 ? c.text.slice(-200) : "";
      }
      return item;
    });
    // 按 last_at 倒序 (最新的在前)
    out.sort((a, b) => b.last_at - a.last_at);
    res.end(
      JSON.stringify(
        {
          ok: true,
          count: out.length,
          max: _SP_CANDIDATES_MAX,
          kinds_summary: out.reduce((acc, c) => {
            acc[c.kind] = (acc[c.kind] || 0) + 1;
            return acc;
          }, {}),
          rpcs_summary: out.reduce((acc, c) => {
            const rpc = c.rpc.split("/").slice(-1)[0] || c.rpc;
            acc[rpc] = (acc[rpc] || 0) + 1;
            return acc;
          }, {}),
          candidates: out,
        },
        null,
        2,
      ),
    );
    return true;
  }

  if (u.pathname === "/origin/sp_candidates" && req.method === "DELETE") {
    const had = _spCandidates.length;
    _spCandidates = [];
    _saveSPCandidates();
    log(`sp_candidates cleared: was ${had}`);
    res.end(JSON.stringify({ ok: true, cleared: had }));
    return true;
  }

  if (u.pathname === "/origin/selftest" && req.method === "GET") {
    // v7.4 自证: 三路径 道德经前置 + 道法自然·浑然统一 · 验工具块内容为道德经原文
    try {
      // fakeSP 仿真实抓 official SP 结构 (2026-04-29 实抓 20888 chars):
      //   起首身份段 / <communication_style> 套嵌 citation_guidelines /
      //   <tool_calling>...<calling_external_apis> / <mcp_servers> + server 列表 /
      //   <user_rules> 含 nested <MEMORY[*]> / <user_information> / <memory_system>双套嵌 /
      //   <ide_metadata> / tail 六行 discipline
      const fakeSP = [
        "You are Cascade, a powerful agentic AI coding assistant.",
        "The USER is interacting with you through a chat panel in their IDE.",
        "The task may require modifying or debugging existing code.",
        "Be mindful of that you are not the only one working in this environment.",
        "Do not overstep your bounds, your goal is to be a pair programmer to the user in completing their task.",
        "For example: Do not create random files.",
        "<communication_style>",
        "Be terse and direct.",
        "<communication_guidelines>be concise</communication_guidelines>",
        "<markdown_formatting>use markdown</markdown_formatting>",
        "<citation_guidelines>@/abs/path:line</citation_guidelines>",
        "</communication_style>",
        "<tool_calling>",
        "Use only the available tools. Never guess parameters. Before each tool call, briefly state why.",
        "</tool_calling>",
        "<making_code_changes>",
        "EXTREMELY IMPORTANT: Your generated code must be immediately runnable.",
        "If you're creating the codebase from scratch, create deps file.",
        "</making_code_changes>",
        "<running_commands>",
        "You have the ability to run terminal commands on the user's machine.",
        "You are not running in a dedicated container.",
        "</running_commands>",
        "<task_management>",
        "Use update_plan to manage work.",
        "</task_management>",
        "<debugging>",
        "When debugging, only make code changes if you are certain that you can solve the problem.",
        "</debugging>",
        "<mcp_servers>",
        "The Model Context Protocol (MCP) is a standard that connects AI systems with external tools and data sources.",
        "MCP servers extend your capabilities by providing access to specialized functions.",
        "The following MCP servers are available to you.",
        "# context7",
        "Use this server to retrieve up-to-date documentation.",
        "# github",
        "# playwright",
        "# tavily",
        "</mcp_servers>",
        "<calling_external_apis>",
        "When selecting which version of an API or package to use, choose one that is compatible with the USER's dependency management file.",
        "</calling_external_apis>",
        "<user_rules>",
        "The following are user-defined rules that you MUST ALWAYS FOLLOW WITHOUT ANY EXCEPTION.",
        "Review them carefully and always take them into account when you generate responses and code:",
        "<MEMORY[dao-de-jing.md]>",
        "道可道，非常道. 名可名非常名.",
        "</MEMORY[dao-de-jing.md]>",
        "</user_rules>",
        "<user_information>OS=windows</user_information>",
        "<workflows>",
        "You have the ability to use and create workflows, which are well-defined steps.",
        "The workflow files follow YAML frontmatter + markdown format under .windsurf/workflows.",
        "</workflows>",
        "<rules>some rule content</rules>",
        "<skills>some skill content</skills>",
        "<memories>some memory content</memories>",
        "<memory_system>",
        "<memory_system>",
        "You have access to a persistent database.",
        "</memory_system>",
        "</memory_system>",
        "<ide_metadata>",
        "You work inside of the user's IDE. Sometimes, you will receive metadata.",
        "</ide_metadata>",
        "Bug fixing discipline: root cause first.",
        "Long-horizon workflow: notes.",
        "Planning cadence: plan.",
        "Testing discipline: tests first.",
        "Verification tools: playwright.",
        "Progress notes: lightweight.",
        "x".repeat(200),
      ].join("\n");

      // v7.5 KEEP MARKERS · 身份认同 + 唯遵道德经之律 + 9 工具 tag + 9 道德经原文短句
      // 注: "道可道，非常道" 由 judge 单验
      const KEEP_MARKERS = [
        "You are Cascade.", // v7.5 身份认同 (反者道之动)
        "唯遵下文道德经, 余皆为客", // v7.6 简律
        "道法自然", // v7.6 本源
        "<tool_calling>", // 9 工具 tag 全保
        "<making_code_changes>",
        "<running_commands>",
        "<task_management>",
        "<debugging>",
        "<calling_external_apis>",
        "<mcp_servers>",
        "<memory_system>",
        "<citation_guidelines>",
        // 9 道德经原文独特短句
        "三十辐共一毂", // 十一章
        "曲则全, 枉则直, 洼则盈", // 二十二章
        "重为轻根, 静为躁君", // 二十六章
        "图难于其易, 为大于其细", // 六十三章
        "致虚极, 守静笃", // 十六章
        "悠兮其贵言", // 十七章
        "和其光, 同其尘, 是谓玄同", // 五十六章
        "执古之道, 以御今之有", // 十四章
        "言有宗, 事有君", // 七十章
      ];
      // v7.5 LEAK MARKERS · 官方余名相/风格/规训/用户域/工具原语 · 必不在 after
      // v7.5 反者道之动: "You are Cascade" 加回 KEEP, 但 "powerful agentic" 仍为 LEAK
      const LEAK_MARKERS = [
        // v7.0 身份/风格名相 (v7.5 仅保 "You are Cascade." 起首, 余皆删)
        "powerful agentic AI coding assistant",
        // v7.6 用户域旁支 · 道德经为唯一本源
        "<workflows>",
        "</workflows>",
        "<rules>",
        "<skills>",
        "<memories>",
        "You have the ability to use and create workflows",
        "workflow files follow YAML frontmatter",
        ".windsurf/workflows",
        "pair programmer",
        "<communication_style>",
        "</communication_style>",
        "<communication_guidelines>",
        "<markdown_formatting>",
        // v7.0 discipline 6 行
        "Bug fixing discipline",
        "Long-horizon workflow",
        "Planning cadence",
        "Testing discipline",
        "Verification tools",
        "Progress notes",
        // v7.1 ide/mcp/user_rules 名相
        "<ide_metadata>",
        "You work inside of the user",
        "Model Context Protocol (MCP) is a standard",
        "that connects AI systems",
        "The following are user-defined rules that you MUST",
        // v7.3 用户域 (全删)
        "<user_rules>",
        "<user_information>",
        "<MEMORY[",
        "The USER's OS",
        // v7.3 工具原语独有词 (替后不在)
        "Never guess parameters",
        "Before each tool call, briefly state",
        "EXTREMELY IMPORTANT: Your generated code",
        "If you're creating the codebase from scratch",
        "You have the ability to run terminal",
        "You are not running in a dedicated container",
        "When debugging, only make code changes if you are certain",
        "the USER's dependency management file",
        // v7.4 中英混杂词 (反 v7.3 之未净): 验道德经原文独据
        "Use only available tools",
        "Never invent parameters or change tool",
        "NEVER output code to user",
        "Imports at top of file",
        "Stay below 64000 tokens",
        "NEVER include `cd` in command",
        "Mark unsafe commands carefully",
        "Use update_plan for non-trivial work",
        "Address root cause, not symptoms",
        "Match the dependency file",
        "Persistent database holds global rules",
        "Format code refs as",
        "Always use absolute filesystem paths",
        // v7.4 中文道义引标题 (反 v7.3 之中英混杂标语)
        "用器当其用 (十一章",
        "少则得, 多则惑 (二十二章)",
        "善行无辙迹 (二十七章)",
      ];
      const missingKeep = (s) => KEEP_MARKERS.filter((m) => !s.includes(m));
      const leaked = (s) => LEAK_MARKERS.filter((m) => s.includes(m));
      const headOf = (s, n) => s.slice(0, n).replace(/\n/g, "\\n");

      // 路径 A: plain UTF-8 path
      const topA = serializeProto({
        10: [{ w: 2, b: Buffer.from(fakeSP, "utf8") }],
      });
      const modA = modifySPProto(buildFrame(0, topA));
      const topAOut = parseProto(parseFrames(modA)[0].payload);
      const afterA = Buffer.from(topAOut[10][0].b).toString("utf8");

      // 路径 B: nested ChatMessage
      const nestedB = serializeProto({
        1: [{ w: 0, v: 0 }],
        2: [{ w: 2, b: Buffer.from(fakeSP, "utf8") }],
      });
      const topB = serializeProto({ 10: [{ w: 2, b: nestedB }] });
      const modB = modifySPProto(buildFrame(0, topB));
      const topBOut = parseProto(parseFrames(modB)[0].payload);
      const nestOut = parseProto(Buffer.from(topBOut[10][0].b));
      const afterB = Buffer.from(nestOut[2][0].b).toString("utf8");

      // 路径 C: RawGetChatMessage · field[3]
      const topC = serializeProto({
        3: [{ w: 2, b: Buffer.from(fakeSP, "utf8") }],
      });
      const modC = modifyRawSP(buildFrame(0, topC));
      const topCOut = parseProto(parseFrames(modC)[0].payload);
      const afterC = Buffer.from(topCOut[3][0].b).toString("utf8");

      const summary = {
        ok: true,
        version: "v7.6-为道日损-道法自然",
        mode: SP_MODE,
        principle:
          "为道日损 · 去章节注 · 去中英混杂 · 去用户域旁支 · 道德经为唯一本源 · 道法自然",
        dao_chars: DAO_DE_JING_81.length,
        tao_header_chars: TAO_HEADER.length,
        keep_markers_count: KEEP_MARKERS.length,
        leak_markers_count: LEAK_MARKERS.length,
        paths: {},
        all_paths_pass: false,
      };

      function judge(name, after, before) {
        const missing = missingKeep(after);
        const leaks = leaked(after);
        const containsDao = after.includes("道可道，非常道");
        // v7.5: after 起首为 "You are Cascade." (反者道之动 · 加回身份认同)
        const cascade_first = after.startsWith("You are Cascade.");
        const has_dao_law = after.includes("唯遵下文道德经, 余皆为客");
        summary.paths[name] = {
          before_chars: before.length,
          after_chars: after.length,
          delta: after.length - before.length,
          contains_dao: containsDao,
          cascade_first: cascade_first,
          has_dao_law: has_dao_law,
          missing_keep_markers: missing,
          missing_count: missing.length,
          leaked_official_naming: leaks,
          leak_count: leaks.length,
          before_head: headOf(before, 80),
          after_head: headOf(after, 80),
        };
        return (
          containsDao &&
          cascade_first &&
          has_dao_law &&
          missing.length === 0 &&
          leaks.length === 0
        );
      }

      const okA = judge("plain_utf8", afterA, fakeSP);
      const okB = judge("nested_chat_message", afterB, fakeSP);
      const okC = judge("raw_sp", afterC, fakeSP);
      summary.all_paths_pass = okA && okB && okC;

      res.end(JSON.stringify(summary, null, 2));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: e.message, stack: e.stack }));
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v7.2 · /origin/custom_sp · 用户实时编辑接口 · 三动词
  // ═══════════════════════════════════════════════════════════
  // GET    返当前 _customSP (has_custom/sp/chars/keep_blocks/at)
  // POST   {sp, keep_blocks, source} → 写 _customSP, 落盘
  // DELETE 清 _customSP, 删盘文件
  // 道义: 二十五章 道法自然. 用户即道, 编辑即真.
  if (u.pathname === "/origin/custom_sp" && req.method === "GET") {
    if (!_customSP || !_customSP.sp) {
      res.end(JSON.stringify({ ok: true, has_custom: false }));
    } else {
      res.end(
        JSON.stringify({
          ok: true,
          has_custom: true,
          sp: _customSP.sp,
          chars: _customSP.sp.length,
          keep_blocks: !!_customSP.keep_blocks,
          source: _customSP.source || null,
          at: _customSP.at || null,
          age_s: _customSP.at
            ? Math.round((Date.now() - _customSP.at) / 1000)
            : null,
        }),
      );
    }
    return true;
  }

  if (u.pathname === "/origin/custom_sp" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const sp = typeof body.sp === "string" ? body.sp : "";
        if (!sp.trim()) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({ ok: false, error: "sp 不可为空 (需非空字符串)" }),
          );
          return;
        }
        _customSP = {
          sp: sp,
          keep_blocks: body.keep_blocks !== false,
          source: typeof body.source === "string" ? body.source : "unknown",
          at: Date.now(),
        };
        _saveCustomSP();
        log(
          `custom_sp set: chars=${sp.length} keep_blocks=${_customSP.keep_blocks} source=${_customSP.source}`,
        );
        res.end(
          JSON.stringify({
            ok: true,
            chars: sp.length,
            keep_blocks: _customSP.keep_blocks,
            at: _customSP.at,
          }),
        );
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  if (u.pathname === "/origin/custom_sp" && req.method === "DELETE") {
    const had = !!(_customSP && _customSP.sp);
    _customSP = null;
    _saveCustomSP();
    if (had) log("custom_sp cleared");
    res.end(JSON.stringify({ ok: true, was_set: had }));
    return true;
  }

  if (u.pathname === "/origin/mode" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const m = String(body.mode || "").toLowerCase();
        if (!SP_MODE_VALID.has(m)) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              ok: false,
              error: `invalid mode: ${m}`,
              valid: [...SP_MODE_VALID],
            }),
          );
          return;
        }
        const old = SP_MODE;
        SP_MODE = m;
        _saveModeToDisk(SP_MODE);
        log(`mode: ${old} -> ${SP_MODE} (persisted)`);
        res.end(JSON.stringify({ ok: true, mode: SP_MODE, previous: old }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════
// 透传 · v7.8 HTTP/2 双栈 (h2c 入 → h2 TLS 出)
// ═══════════════════════════════════════════════════════════
const _h2Sessions = {};
function _getH2Session(host) {
  const key = host;
  const s = _h2Sessions[key];
  if (s && !s.closed && !s.destroyed) return s;
  log(`[h2] connect https://${host}:${CLOUD_PORT}`);
  const session = http2.connect(`https://${host}:${CLOUD_PORT}`);
  session.on("error", (e) => {
    log(`[h2] session ${host} error: ${e.message}`);
    try {
      session.close();
    } catch {}
    delete _h2Sessions[key];
  });
  session.on("close", () => {
    delete _h2Sessions[key];
  });
  session.on("goaway", () => {
    log(`[h2] session ${host} goaway`);
    delete _h2Sessions[key];
  });
  _h2Sessions[key] = session;
  return session;
}

function proxyToCloud(req, res, overrideBody) {
  const route = routeUpstream(req.url);
  // 清除 HTTP/2 伪头 + host (upstream 用 :authority)
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k.startsWith(":") && k !== "host") headers[k] = v;
  }
  delete headers["content-length"];
  let bodyBuf = overrideBody;
  if (bodyBuf && !Buffer.isBuffer(bodyBuf)) bodyBuf = Buffer.from(bodyBuf);
  if (bodyBuf) headers["content-length"] = String(bodyBuf.length);

  let session;
  try {
    session = _getH2Session(route.host);
  } catch (e) {
    log(`[h2] session create fail: ${e.message}`);
    if (!res.headersSent) res.writeHead(502);
    try {
      res.end(JSON.stringify({ error: "h2_session", message: e.message }));
    } catch {}
    return;
  }

  const h2headers = {
    ":method": req.method || "POST",
    ":path": route.path,
    ":authority": route.host,
    ":scheme": "https",
    ...headers,
  };

  const upStream = session.request(h2headers);

  upStream.on("response", (h2resHeaders) => {
    const status = h2resHeaders[":status"] || 200;
    const resHeaders = {};
    for (const [k, v] of Object.entries(h2resHeaders)) {
      if (!k.startsWith(":")) resHeaders[k] = v;
    }
    res.writeHead(status, resHeaders);
    upStream.pipe(res);
  });

  upStream.on("error", (e) => {
    log(`upstream h2 error ${req.method} ${req.url}: ${e.message}`);
    if (!res.headersSent) res.writeHead(502);
    try {
      res.end(JSON.stringify({ error: "upstream", message: e.message }));
    } catch {}
  });

  // gRPC trailers (grpc-status / grpc-message)
  upStream.on("trailers", (trailers) => {
    try {
      res.addTrailers(trailers);
    } catch {}
  });

  if (bodyBuf) upStream.end(bodyBuf);
  else req.pipe(upStream);
}

// ═══════════════════════════════════════════════════════════
// 主服务器
// ═══════════════════════════════════════════════════════════
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// v7.8 反者道之动: TCP 层协议复用 (HTTP/1.1 + HTTP/2 h2c 同端口)
// Go gRPC (h2c) 入 → h2 server; HTTP/1.1 (mgmt/control) → h1 server
const _mainHandler = async (req, res) => {
  reqCounter++;
  const rid = reqCounter;
  req.on("error", (e) => log(`#${rid} req err: ${e.message}`));
  res.on("error", (e) => log(`#${rid} res err: ${e.message}`));
  try {
    // 1. 控制面
    if (req.url && req.url.startsWith("/origin/")) {
      if (handleControl(req, res)) return;
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "unknown /origin endpoint" }));
      return;
    }
    // 2. 路由分类
    const kind = classifyRPC(req.url);
    const route = routeUpstream(req.url);
    const isInferenceRPC = route.host === UPSTREAM_INFER;
    _recordPath(req.method, req.url, kind, route.host);

    // 3. 非 inference (mgmt/auth 等): 纯透 · 不读 body · 无 SP 可观
    if (!isInferenceRPC) {
      proxyToCloud(req, res);
      return;
    }

    // 4. inference (含 chat 三档与其余 50+ RPC): 读 body
    const body = await readBody(req);

    // 5. v7.7 · 广谱观察 · 反者道之动 · 字段级深扫
    try {
      const cands = observeAllSPInBody(body, req.url);
      for (const c of cands) {
        _recordSPCandidate({ rpc: req.url, ...c });
      }
      if (cands.length > 0) {
        log(
          `#${rid} v7.7 sp_scan url=${req.url.split("/").slice(-2).join("/")} ` +
            `kinds=[${cands.map((c) => `${c.kind}@${c.field_path}/${c.chars}B`).join(",")}]`,
        );
      }
    } catch (e) {
      log(`#${rid} sp_scan err: ${e.message}`);
    }

    // 6. chat 三档专路观察 (lastinject)
    if (kind === "CHAT_PROTO" || kind === "CHAT_RAW") {
      const obs = observeSPFromBody(body, kind);
      if (obs) {
        const inverted = SP_MODE === "invert" ? invertSP(obs.before) : null;
        const after = inverted !== null ? inverted : obs.before;
        _recordInject({
          kind,
          variant: obs.variant,
          field: obs.field,
          role: obs.role,
          mode: SP_MODE,
          transformed: inverted !== null,
          before_chars: obs.before.length,
          after_chars: after.length,
          before: obs.before,
          after,
        });
      }
    }

    // 7. 变身 · 仅 invert 模式下且 chat 三档
    let modified = body;
    if (SP_MODE === "invert") {
      if (kind === "CHAT_PROTO") {
        modified = modifySPProto(body);
      } else if (kind === "CHAT_RAW") {
        modified = modifyRawSP(body);
      }
    }
    if (modified !== body) {
      req.headers["connect-content-encoding"] = "identity";
      delete req.headers["content-encoding"];
      log(
        `#${rid} ${kind} CHANGED ${body.length}B → ${modified.length}B mode=${SP_MODE}`,
      );
    } else {
      log(`#${rid} ${kind} UNCHANGED ${body.length}B mode=${SP_MODE}`);
    }
    proxyToCloud(req, res, modified);
  } catch (e) {
    log(`#${rid} handler err: ${e.stack || e.message}`);
    if (!res.headersSent) res.statusCode = 500;
    try {
      res.end(JSON.stringify({ error: "origin internal", message: e.message }));
    } catch {}
  }
};

// v7.8 TCP mux: HTTP/1.1 + HTTP/2 h2c on same port
// readable peek(1): 0x50 ('P' from PRI preface) → h2, else → h1
const _h1Server = http.createServer(_mainHandler);
let _h2Errs = 0,
  _h2SessErrs = [],
  _h2Sessions = 0,
  _h2Streams = 0,
  _h2Closes = [];
const _h2Server = http2.createServer(_mainHandler);
_h2Server.on("session", (sess) => {
  _h2Sessions++;
  const sid = _h2Sessions;
  sess.on("stream", () => _h2Streams++);
  sess.on("close", () => {
    if (_h2Closes.length < 8)
      _h2Closes.push({ t: Date.now(), sid, streams: 0 });
  });
  sess.on("goaway", (code) => {
    if (_h2Closes.length < 8)
      _h2Closes.push({ t: Date.now(), sid, goaway: code });
  });
  sess.on("error", (e) => {
    if (_h2Closes.length < 8)
      _h2Closes.push({ t: Date.now(), sid, err: e.message });
  });
});
_h2Server.on("sessionError", (err) => {
  _h2Errs++;
  if (_h2SessErrs.length < 8)
    _h2SessErrs.push({
      t: Date.now(),
      msg: err.message || String(err),
      code: err.code,
    });
});
_h1Server.keepAliveTimeout = 10000;
_h1Server.headersTimeout = 15000;
_h1Server.requestTimeout = 120000;

// h2 server on internal port (not exposed) — native handle needs real TCP socket
const _H2_INTERNAL_PORT = PORT + 1;
_h2Server.listen(_H2_INTERNAL_PORT, "127.0.0.1");
_h2Server.on("listening", () =>
  log(`[h2] internal h2c on :${_H2_INTERNAL_PORT}`),
);
_h2Server.on("error", (e) => log(`[h2] internal error: ${e.message}`));

let _muxConns = 0,
  _muxH1 = 0,
  _muxH2 = 0,
  _muxNull = 0;
const server = net.createServer((socket) => {
  _muxConns++;
  socket.once("data", (buf) => {
    if (
      buf[0] === 0x50 &&
      buf.length >= 3 &&
      buf[1] === 0x52 &&
      buf[2] === 0x49
    ) {
      socket.pause(); // prevent data loss before h2 bridge pipe is established
      _muxH2++;
      // Bridge to internal h2 server (native handle needed for HTTP/2)
      const bridge = net.createConnection(
        _H2_INTERNAL_PORT,
        "127.0.0.1",
        () => {
          bridge.write(buf);
          socket.pipe(bridge);
          bridge.pipe(socket);
          socket.resume();
        },
      );
      bridge.on("error", () => socket.destroy());
      socket.on("error", () => bridge.destroy());
      socket.on("close", () => bridge.destroy());
      bridge.on("close", () => socket.destroy());
    } else {
      _muxH1++;
      socket.unshift(buf);
      _h1Server.emit("connection", socket);
      // h1 server manages resume internally
    }
  });
});

server.on("listening", () => {
  log("═══════════════════════════════════════════════════════");
  log(` 本源 Origin v7.8 h1+h2c mux @ :${PORT}`);
  log(` mgmt   → https://${UPSTREAM_MGMT}`);
  log(` infer  → https://${UPSTREAM_INFER}`);
  log(` mode=${SP_MODE} · pid=${process.pid}`);
  log(` 道德经 chars=${DAO_DE_JING_81.length}`);
  log(` 控制面: http://127.0.0.1:${PORT}/origin/ping`);
  log("═══════════════════════════════════════════════════════");
});

server.on("error", (e) => {
  log("server err:", e.message);
});

// ═══════════════════════════════════════════════════════════
// v18.0 · 库接口 · ext-host 进程内调用 · 损 spawn detached 之根
// ═══════════════════════════════════════════════════════════
function start(opts) {
  opts = opts || {};
  const port = opts.port != null ? opts.port : PORT;
  const host = opts.host || "127.0.0.1";
  if (opts.mode && SP_MODE_VALID.has(opts.mode)) {
    SP_MODE = opts.mode;
  }
  return new Promise((resolve, reject) => {
    const onListen = () => {
      server.removeListener("error", onError);
      const addr = server.address();
      const realPort = (addr && addr.port) || port;
      log(`[lib] in-process listen :${realPort} (h1+h2c mux)`);
      resolve({
        server,
        port: realPort,
        host,
        close: () =>
          new Promise((r) => {
            try {
              server.close(() => r());
            } catch {
              r();
            }
          }),
        getMode: () => SP_MODE,
        setMode: (m) => {
          if (SP_MODE_VALID.has(m)) {
            SP_MODE = m;
            try {
              _saveModeToDisk(SP_MODE);
            } catch {}
            return true;
          }
          return false;
        },
        // v7.2 · 用户实时编辑提示词 (库使用)
        getCustomSP: () =>
          _customSP && _customSP.sp
            ? {
                sp: _customSP.sp,
                chars: _customSP.sp.length,
                keep_blocks: !!_customSP.keep_blocks,
                source: _customSP.source || null,
                at: _customSP.at || null,
              }
            : null,
        setCustomSP: (sp, opts) => {
          if (typeof sp !== "string" || !sp.trim()) return false;
          _customSP = {
            sp: sp,
            keep_blocks: !opts || opts.keep_blocks !== false,
            source: (opts && opts.source) || "lib",
            at: Date.now(),
          };
          try {
            _saveCustomSP();
          } catch {}
          return true;
        },
        clearCustomSP: () => {
          const had = !!(_customSP && _customSP.sp);
          _customSP = null;
          try {
            _saveCustomSP();
          } catch {}
          return had;
        },
      });
    };
    const onError = (e) => {
      server.removeListener("listening", onListen);
      reject(e);
    };
    server.once("listening", onListen);
    server.once("error", onError);
    server.listen(port, host);
  });
}

function stop() {
  return new Promise((r) => {
    try {
      server.close(() => r());
    } catch {
      r();
    }
  });
}

// ═══════════════════════════════════════════════════════════
// CLI 路径 · 仅 node 直跑时启 · require 时不污染父进程
// ═══════════════════════════════════════════════════════════
function _runCli() {
  server.on("error", () => {
    process.exit(1);
  });
  if (!process.argv.includes("--test")) {
    server.listen(PORT, "127.0.0.1");
  }
  process.on("uncaughtException", (e) =>
    log("[FATAL] " + (e && e.stack ? e.stack : e)),
  );
  process.on("unhandledRejection", (r) => log("[REJ] " + r));
}

// require.main === module 即 CLI 直跑 · 否则被 require 入库使用
if (require.main === module) _runCli();

module.exports = {
  invertSP,
  isLikelyOfficialSP,
  DAO_DE_JING_81,
  OFFICIAL_SP_MARKERS,
  TAO_HEADER,
  SAMPLE_OFFICIAL_SP, // v7.3: 仿官方 SP 结构骨架 (测试 + preview fallback)
  _quickHash, // v7.3: 简哈 (sig endpoint)
  stripOfficialNaming, // v7.0: 彻删官方一切着相之名
  modifySPProto,
  modifyRawSP,
  parseProto,
  serializeProto,
  parseFrames,
  buildFrame,
  encodeVarint,
  readVarint,
  encodeLen,
  looksLikeUtf8Text,
  extractMsgContent,
  findMsgsField,
  routeUpstream,
  classifyRPC,
  server,
  // v17.55 解剖 (抱一知天下势)
  dissectSP,
  // v17.66 原观
  observeSPFromBody,
  // v7.7 · 反者道之动 · 全链路探源
  classifySPType,
  deepScanProto,
  observeAllSPInBody,
  SUMMARY_SP_MARKERS,
  MEMORY_SP_MARKERS,
  EPHEMERAL_SP_MARKERS,
  // v18.0 · 库接口 (ext-host 进程内 · 损 spawn detached 之根)
  start,
  stop,
  // v18.0 · 模式查改 (库使用)
  getMode: () => SP_MODE,
  setMode: (m) => {
    if (SP_MODE_VALID.has(m)) {
      SP_MODE = m;
      try {
        _saveModeToDisk(SP_MODE);
      } catch {}
      return true;
    }
    return false;
  },
  // v7.2 · 用户实时编辑提示词 (库使用 · 测试用)
  getCustomSP: () =>
    _customSP && _customSP.sp
      ? {
          sp: _customSP.sp,
          chars: _customSP.sp.length,
          keep_blocks: !!_customSP.keep_blocks,
          source: _customSP.source || null,
          at: _customSP.at || null,
        }
      : null,
  setCustomSP: (sp, opts) => {
    if (typeof sp !== "string" || !sp.trim()) return false;
    _customSP = {
      sp: sp,
      keep_blocks: !opts || opts.keep_blocks !== false,
      source: (opts && opts.source) || "lib",
      at: Date.now(),
    };
    try {
      _saveCustomSP();
    } catch {}
    return true;
  },
  clearCustomSP: () => {
    const had = !!(_customSP && _customSP.sp);
    _customSP = null;
    try {
      _saveCustomSP();
    } catch {}
    return had;
  },
  _runCli,
};
