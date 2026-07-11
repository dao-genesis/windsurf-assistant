"use strict";
/**
 * cascade_wire.js · Cascade ↔ Cloud 协议 wire 层 · 零依赖
 * ═══════════════════════════════════════════════════════════════
 *
 *   exa.api_server_pb.GetChatMessageRequest   (LSP → Cloud)
 *   exa.api_server_pb.GetChatMessageResponse  (Cloud → LSP, server-streaming)
 *
 *   字段表源: 020-逆向_Reverse/WINDSURF_TOOL_CALL_PROTO_SCHEMA.md
 *             020-逆向_Reverse/docs/WINDSURF_AGENT_INJECTION_ROOT_ANALYSIS.md
 *
 * 此模块是 070-外接api 自给自足的 wire 编解码器, 不依赖 010-反代_Proxy
 * 内部的 buildTextFrame / serializeProto, 因 010 当前 buildTextFrame 仍
 * 编到 field 1 (= message_id), 仅文字时 LS 宽容显示, 但工具调用无从透出.
 *
 * 070 接 010 时的两种姿态:
 *   1) 010 仅交 (req, res, modelUid, messages) 时: 070 用本模块自建帧
 *   2) 010 还交了 rawBody/isJSON 时: 070 用 parseGetChatMessageRequest 反推
 *      tools / 含 tool_calls 的消息 / tool_result · 完整透到上游 LLM
 *
 * 道法自然: 此文件不引用任何外部包, 所有协议常量来自反向已实证字段号.
 */

// ── 常量: GetChatMessageResponse 字段号 (从 LS 二进制 + extension.js 双重确认) ──
const RSP = Object.freeze({
  MESSAGE_ID: 1, // string
  TIMESTAMP: 2, // Timestamp
  DELTA_TEXT: 3, // string  ← 文本增量 (反 010 的 field 1 误)
  DELTA_TOKENS: 4, // uint32
  STOP_REASON: 5, // StopReason enum
  DELTA_TOOL_CALLS: 6, // repeated ChatToolCall
  USAGE: 7, // ModelUsageStats
  REDACT: 8, // bool
  DELTA_THINKING: 9, // string  ← 思考过程增量
  DELTA_SIGNATURE: 10, // string
  THINKING_REDACTED: 11, // bool
  CREDIT_COST: 14, // int32
  OUTPUT_ID: 15, // string
  THINKING_ID: 16, // string
  REQUEST_ID: 17, // string
  ACTUAL_MODEL_UID: 23, // string
});

// ── 常量: GetChatMessageRequest 字段号 ──────────────────────────
//   实证源 (2026-05-07 · 反者道之动 · 损之又损):
//     020-逆向_Reverse/data/_v1_proto_analysis/proto_field_numbers.txt @ 56316202
//       (LSP Go binary protobuf descriptor 直读 · api_server_pb 版)
//     020-逆向_Reverse/data/_v1_proto_analysis/ls_proto_strings.txt @ 43857888
//       (Go struct tag: bytes,3,rep,name=chat_message_prompts)
//
//   两版 GetChatMessageRequest 共存于 LSP:
//     · exa.chat_pb.GetChatMessageRequest          (LSP↔Extension 本地)
//     · exa.api_server_pb.GetChatMessageRequest    (LSP↔Cloud 远端 · 010 抓此层)
//
//   070 桥工作于 010↔070 之间, 收到的 reqBody 即 LSP→Cloud 的 api_server_pb 形态,
//   故此处 REQ.* 全以 api_server_pb wire 实证为准.
//   旧 070+010 约定 (CHAT_MESSAGES=2, CHAT_MODEL_UID=3) 已实证错位, 仅作 decode fallback 兼容.
const REQ = Object.freeze({
  METADATA: 1, // Metadata (含 api_key / ide_name / ide_version)
  PROMPT: 2, // string · 系统提示词 (完整 SP) ★ 实证: api_server_pb field 2
  CHAT_MESSAGES: 3, // repeated ChatMessagePrompt ★ 实证: field 3 (旧 070=2 错位)
  EXPERIMENT_CONFIG: 9, // ExperimentConfig
  TOOLS: 10, // repeated ChatToolDefinition ★ 实证 (旧 best-effort 命中)
  DISABLE_PARALLEL: 11, // bool ★ 实证 (旧 best-effort 命中)
  TOOL_CHOICE: 12, // ChatToolChoice ★ 实证 (旧 best-effort 命中)
  CHAT_MODEL_NAME: 14, // string · 模型显示名 (备用辅助路由)
  CASCADE_ID: 16, // string
  PROMPT_ID: 17, // string
  CHAT_MODEL_UID: 21, // string · 模型 UID ★ 实证: field 21 (旧 070=3 错位)
});

// 旧字段号兼容表 · 仅用于 decode fallback (encode 一律走真 wire)
// 使现存 010 反代 + 旧版 070 测试链路仍能解出关键字段.
const REQ_LEGACY = Object.freeze({
  CHAT_MESSAGES: 2, // 旧 070 + 010 universal_relay 当前约定
  CHAT_MODEL_UID: 3,
});

// ── 常量: ChatMessagePrompt 子字段号 ────────────────────────────
//   实证源: extension.js webpack typeName="exa.chat_pb.ChatMessagePrompt" newFieldList
//          (070 inject/_probe_proto_schema.js 一次性抽出, 见 _AGENTS.md 实证记)
//
//   旧 070+010 约定 (SOURCE=1, PROMPT=2) 与 wire 实证 (SOURCE=2, PROMPT=3) 错位.
//   原因: 旧约定误把 message_id (field 1) 当 source, 误把 source (field 2) 当 prompt.
//   解时双 fallback 兼容; 编时一律走 wire 实证.
const MSG = Object.freeze({
  MESSAGE_ID: 1, // string ★ 实证: field 1 (旧 070 误用为 SOURCE)
  SOURCE: 2, // varint enum: SYSTEM=0 / USER=1 / ASSISTANT=2 / TOOL=3 ★ 实证: field 2 (旧 070=1 错位)
  PROMPT: 3, // string · 文本 ★ 实证: field 3 (旧 070=2 错位)
  NUM_TOKENS: 4, // uint32
  SAFE_FOR_CODE_TELEMETRY: 5, // bool
  TOOL_CALLS: 6, // repeated ChatToolCall ★ 实证 (旧已对齐)
  TOOL_CALL_ID: 7, // string · tool 结果引用 ID ★ 实证 (旧已对齐)
  PROMPT_CACHE_OPTIONS: 8, // PromptCacheOptions
  TOOL_RESULT_IS_ERROR: 9, // bool ★ 实证 (旧已对齐)
  IMAGES: 10, // repeated ImageData ★ 实证 (旧已对齐) · 视感字段
  THINKING: 11, // string · 思考过程 ★ 实证 (旧已对齐)
  SIGNATURE: 12, // string
  THINKING_REDACTED: 13, // bool
  OUTPUT_ID: 15, // string
  THINKING_ID: 16, // string
});

// 旧 ChatMessagePrompt 字段号兼容表 · 仅 decode fallback
const MSG_LEGACY = Object.freeze({
  SOURCE: 1, // 旧 070+010 当前约定
  PROMPT: 2,
});

// ── 常量: ImageData 子字段号 ────────────────────────────────────
//   实证: exa.codeium_common_pb.ImageData
//     field 1 · base64_data (string · base64 编码后的图像数据)
//     field 2 · mime_type   (string · "image/png" / "image/jpeg" / ...)
//     field 3 · caption     (string · 图像说明)
//
//   ★ 真 wire 无 url 字段! 旧 070 写的 URL/FORMAT/DETAIL 全是臆测, 已损去.
//   070 透出 OpenAI image_url 形态时, 用 data:<mime>;base64,<base64> 自构 data URL.
const IMG = Object.freeze({
  BASE64_DATA: 1, // string ★ 实证 · base64 编码的图像 (旧 070 写 MEDIA_TYPE=1 错位)
  MIME_TYPE: 2, // string ★ 实证 · "image/png" 等 (旧 070 写 URL=2 错位)
  CAPTION: 3, // string ★ 实证 · 图像说明 (旧 070 写 DATA=3 错位)
});

// ── 常量: ChatToolCall 子字段号 ──
const TC = Object.freeze({
  ID: 1, // string  · 如 "toolu_xxx" / OpenAI tc.id
  NAME: 2, // string  · 工具名
  ARGUMENTS_JSON: 3, // string  · JSON 序列化的 input 对象
  INVALID_JSON_STR: 4,
  INVALID_JSON_ERR: 5,
  IS_CUSTOM_TOOL: 6,
});

// ── 常量: ChatToolDefinition 子字段号 ──
const TD = Object.freeze({
  NAME: 1, // string
  DESCRIPTION: 2, // string
  JSON_SCHEMA_STRING: 3, // string · JSON Schema for parameters
  STRICT: 4, // bool
  SERVER_NAME: 6, // string
  READ_ONLY_HINT: 7, // bool
});

// ── 常量: ChatToolChoice 字段号 (oneof) ──
const TCH = Object.freeze({
  OPTION_NAME: 1, // "auto" / "none" / "required"
  TOOL_NAME: 2, // 指定工具名
});

// ── 常量: ChatMessageSource enum (ChatMessagePrompt.source) ──
const SOURCE_SYSTEM = 0;
const SOURCE_USER = 1;
const SOURCE_ASSISTANT = 2;
const SOURCE_TOOL = 3;

// ── 常量: StopReason enum (源 020 反向 + Cloud 流末标志) ──
//   ★ v9.9.72a 修正: 实证 LSP Go binary protobuf descriptor 直读
//   旧值 STOP_END=1 是错误的 → 1 = INCOMPLETE (未完成) → LSP 永远等待更多帧
//   正确映射:
//     0 = UNSPECIFIED
//     1 = INCOMPLETE    ← 旧 STOP_END 错误地用了这个值!
//     2 = STOP_PATTERN  ← 正常结束 (模型自然停止)
//     3 = MAX_TOKENS
//     4 = MIN_LOG_PROB
//     5 = MAX_NEWLINES
//     6 = EXIT_SCOPE
//     7 = NONFINITE_LOGIT_OR_PROB
//     8 = FIRST_NON_WHITESPACE_LINE
//     9 = PARTIAL
//    10 = FUNCTION_CALL
//    11 = CONTENT_FILTER
//    12 = NON_INSERTION
//    13 = ERROR
//   道义: 三十九章「得一」· 得其正位方能宁
const STOP_END = 2; // ★ 修正: 1→2 · STOP_PATTERN = 正常结束
const STOP_MAX_TOKENS = 3; // ★ 修正: 2→3
const STOP_TOOL_CALLS = 10; // ★ 修正: 3→10 · FUNCTION_CALL
const STOP_CONTENT_FILTER = 11; // ★ 修正: 4→11
const STOP_ERROR = 13; // ★ 修正: 5→13

// ════════════════════════════════════════════════════════════════
// 1) 零依赖 protobuf 编解码
// ════════════════════════════════════════════════════════════════

function encodeVarint(v) {
  const b = [];
  while (v > 127) {
    b.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  b.push(v & 0x7f);
  return Buffer.from(b);
}

function decodeVarint(buf, pos) {
  // ★ v9.9.88 · 修正: Math.pow(2,shift) → 位运算 · 防大数精度丢失
  //   旧版 result += (b & 0x7f) * Math.pow(2, shift) → shift>=53 时精度丢失
  //   新版 result |= (b & 0x7f) << shift → 位运算精确 · 但 JS 位运算仅 32 位
  //   故 shift>=28 时改用乘法 (2^28=268435456 · 乘法在此范围仍精确)
  //   道义: 三十九章「得一以宁」· 得其精确方能宁
  let result = 0;
  let shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    if (shift < 28) {
      result |= (b & 0x7f) << shift;
    } else {
      result += (b & 0x7f) * Math.pow(2, shift);
    }
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result, pos };
}

/** field N · wire type 2 (LEN) · 写入 string */
function encodeString(fieldNum, str) {
  if (str === undefined || str === null) return Buffer.alloc(0);
  const s = Buffer.from(String(str), "utf8");
  return Buffer.concat([
    encodeVarint((fieldNum << 3) | 2),
    encodeVarint(s.length),
    s,
  ]);
}

/** field N · wire type 0 (VARINT) · 写入 uint64-ish */
function encodeUint(fieldNum, value) {
  return Buffer.concat([
    encodeVarint((fieldNum << 3) | 0),
    encodeVarint(value),
  ]);
}

/** field N · wire type 2 (LEN) · 写入嵌套 message bytes */
function encodeMessage(fieldNum, msgBytes) {
  return Buffer.concat([
    encodeVarint((fieldNum << 3) | 2),
    encodeVarint(msgBytes.length),
    msgBytes,
  ]);
}

/**
 * parseProto · 通用反解
 * 返回 { [fieldNum]: [{w, v?, b?}...] }
 *   w=0 varint  (v: number)
 *   w=2 LEN     (b: Buffer)
 *   w=1 fixed64 (b: Buffer 8 bytes)
 *   w=5 fixed32 (b: Buffer 4 bytes)
 */
function parseProto(buf) {
  // ★ v9.9.88 · 畸形输入防护
  //   道义: 五十八章「方而不割 兼而不剌」· 容其不全而不伤
  const fields = {};
  let pos = 0;
  // ★ 安全上限: 防止畸形输入导致无限循环
  const maxPos = buf.length;
  const maxFieldNum = 536870911; // protobuf 最大合法 field number (2^29-1)
  const maxLenPerField = 104857600; // 100MB 单字段上限
  while (pos < maxPos) {
    const t = decodeVarint(buf, pos);
    pos = t.pos;
    const fn = t.value >> 3;
    const wt = t.value & 7;
    // ★ 防护: field number 不合法 → 跳过剩余
    if (fn <= 0 || fn > maxFieldNum) break;
    if (!fields[fn]) fields[fn] = [];
    if (wt === 0) {
      const v = decodeVarint(buf, pos);
      fields[fn].push({ w: 0, v: v.value });
      pos = v.pos;
    } else if (wt === 2) {
      const len = decodeVarint(buf, pos);
      pos = len.pos;
      // ★ 防护: LEN 超限 → 跳过
      if (len.value < 0 || len.value > maxLenPerField) break;
      if (pos + len.value > buf.length) break;
      fields[fn].push({ w: 2, b: buf.slice(pos, pos + len.value) });
      pos += len.value;
    } else if (wt === 1) {
      if (pos + 8 > buf.length) break;
      fields[fn].push({ w: 1, b: buf.slice(pos, pos + 8) });
      pos += 8;
    } else if (wt === 5) {
      if (pos + 4 > buf.length) break;
      fields[fn].push({ w: 5, b: buf.slice(pos, pos + 4) });
      pos += 4;
    } else {
      // wt 3/4 (group, deprecated) 或未知 · 中止
      break;
    }
  }
  return fields;
}

// ════════════════════════════════════════════════════════════════
// 2) Connect-RPC 帧 (1B flags + 4B BE length + payload)
// ════════════════════════════════════════════════════════════════

function buildFrame(flags, payload) {
  const h = Buffer.alloc(5);
  h[0] = flags;
  h.writeUInt32BE(payload.length, 1);
  return Buffer.concat([h, payload]);
}

function parseFrames(buf) {
  const frames = [];
  let pos = 0;
  while (pos + 5 <= buf.length) {
    const flags = buf[pos];
    const len = buf.readUInt32BE(pos + 1);
    if (pos + 5 + len > buf.length) break;
    frames.push({ flags, payload: buf.slice(pos + 5, pos + 5 + len) });
    pos += 5 + len;
  }
  return frames;
}

// ════════════════════════════════════════════════════════════════
// 3) 高阶帧构造器 · GetChatMessageResponse 各域
// ════════════════════════════════════════════════════════════════

/** 文本增量帧 · field 3 delta_text (规范字段, 不再用 010 的 field 1 旧式) */
function buildTextFrame(delta) {
  if (!delta) return Buffer.alloc(0);
  return buildFrame(0, encodeString(RSP.DELTA_TEXT, delta));
}

/** 思考过程增量帧 · field 9 delta_thinking */
function buildThinkingFrame(delta) {
  if (!delta) return Buffer.alloc(0);
  return buildFrame(0, encodeString(RSP.DELTA_THINKING, delta));
}

/**
 * 单个 ChatToolCall 子消息字节 · 不带 GetChatMessageResponse 外壳
 * 用于把 OpenAI 增量式 tool_calls 累成完整 ChatToolCall 后透出
 */
function encodeChatToolCall({ id, name, argumentsJson, isCustomToolCall }) {
  const parts = [];
  if (id) parts.push(encodeString(TC.ID, id));
  if (name) parts.push(encodeString(TC.NAME, name));
  if (argumentsJson !== undefined && argumentsJson !== null) {
    parts.push(encodeString(TC.ARGUMENTS_JSON, String(argumentsJson)));
  }
  if (isCustomToolCall) parts.push(encodeUint(TC.IS_CUSTOM_TOOL, 1));
  return Buffer.concat(parts);
}

/**
 * 工具调用增量帧 · field 6 delta_tool_calls (repeated)
 * 单帧可承载多个 ChatToolCall · 070 通常一帧一个 (与 OpenAI 累进式同节奏)
 *
 * @param {Array<{id, name, argumentsJson, isCustomToolCall?}>} toolCalls
 */
function buildToolCallsFrame(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0)
    return Buffer.alloc(0);
  const inner = Buffer.concat(
    toolCalls.map((tc) =>
      encodeMessage(RSP.DELTA_TOOL_CALLS, encodeChatToolCall(tc)),
    ),
  );
  return buildFrame(0, inner);
}

/** field N · wire type 0 (VARINT) · 写入 bool (0=false, 1=true) */
function encodeBool(fieldNum, value) {
  return encodeUint(fieldNum, value ? 1 : 0);
}

/**
 * ★ v9.9.88 · Usage Stats 子消息编码 · RSP.USAGE (field 7)
 *   ModelUsageStats proto (从 EXE 逆向确认):
 *     field 1: prompt_tokens     (int32)
 *     field 2: completion_tokens  (int32)
 *     field 3: total_tokens      (int32)
 *   道义: 三十三章「知人者知也 自知者明也」· 知其用量方能明
 *
 * @param {{prompt_tokens?: number, completion_tokens?: number, total_tokens?: number}} usage
 * @returns {Buffer} 编码后的 RSP.USAGE 子消息
 */
function encodeUsageStats(usage) {
  if (!usage || typeof usage !== "object") return Buffer.alloc(0);
  const parts = [];
  if (usage.prompt_tokens) parts.push(encodeUint(1, usage.prompt_tokens));
  if (usage.completion_tokens)
    parts.push(encodeUint(2, usage.completion_tokens));
  if (usage.total_tokens) parts.push(encodeUint(3, usage.total_tokens));
  if (parts.length === 0) return Buffer.alloc(0);
  return encodeMessage(RSP.USAGE, Buffer.concat(parts));
}

/**
 * ★ v9.9.88 · Credit Cost 帧编码 · RSP.CREDIT_COST (field 14)
 *   道义: 四十四章「知足不辱 知止不殆」· 知其费方能止
 */
function buildCreditCostFrame(creditCost) {
  if (typeof creditCost !== "number" || creditCost === 0)
    return Buffer.alloc(0);
  return buildFrame(0, encodeUint(RSP.CREDIT_COST, creditCost));
}

/** 停止原因帧 · field 5 stop_reason · varint */
function buildStopReasonFrame(reason) {
  const v = typeof reason === "number" ? reason : STOP_END;
  return buildFrame(0, encodeUint(RSP.STOP_REASON, v));
}

/**
 * Connect-RPC 流末帧 · flags=2 · payload 是 JSON (trailers)
 * - 正常结束: {"grpc-status":"0"}
 * - 异常: {"grpc-status":"13","grpc-message":"..."}  (13=INTERNAL)
 */
function buildEndFrame(errMsg) {
  // ★ v9.9.72b · Connect-RPC 规范: EOS 帧 payload 必须含 grpc-status
  //   成功: {"grpc-status":"0"}  ← 旧版只发 {} 缺 grpc-status → 客户端判失败!
  //   异常: {"grpc-status":"13","grpc-message":"..."}  ← 13=INTERNAL
  //   道义: 三十九章得一以宁 · 得 grpc-status 方能宁
  const json = errMsg
    ? JSON.stringify({ "grpc-status": "13", "grpc-message": errMsg })
    : JSON.stringify({ "grpc-status": "0" });
  return buildFrame(2, Buffer.from(json, "utf8"));
}

/**
 * ★ v9.9.78 · Timestamp 字段编码 · google.protobuf.Timestamp
 *   官方后端每帧必含 message_id(1) + timestamp(2)
 *   道义: 三十九章「得一」· 得 message_id + timestamp 方能宁
 *   无 message_id → LSP 无法关联帧 → "Encountered unexpected error"
 *
 * @param {number} ms - JavaScript Date.now() 毫秒
 * @returns {Buffer} 编码后的 RSP.TIMESTAMP (field 2) 子消息
 */
function buildTimestampField(ms) {
  const seconds = Math.floor(ms / 1000);
  const nanos = (ms % 1000) * 1000000;
  const tsInner = Buffer.concat([
    encodeUint(1, seconds), // field 1: seconds (int64)
    encodeUint(2, nanos), // field 2: nanos (int32)
  ]);
  return encodeMessage(RSP.TIMESTAMP, tsInner);
}

/**
 * ★ v9.9.78 · 每帧必含的 message_id + timestamp 前缀
 *   官方后端实证: 每帧 payload 均含 field 1 (message_id) + field 2 (timestamp)
 *   ★ v9.9.88 · 增强: 含 output_id + request_id + actual_model_uid
 *   官方后端首帧含这些字段 → LSP 用 output_id 关联工具调用
 *   道义: 三十九章「侯王得一以为天下正」· LSP 得此五字段方能归位
 *
 * @param {string} messageId - 唯一消息 ID (如 "bot-xxx-xxx")
 * @param {number} tsMs - JavaScript Date.now() 毫秒
 * @param {object} [opts] - 可选字段
 * @param {string} [opts.outputId] - 输出 ID (关联工具调用)
 * @param {string} [opts.requestId] - 请求 ID
 * @param {string} [opts.actualModelUid] - 实际模型 UID
 * @returns {Buffer} 编码后的帧头字节
 */
function buildFrameHeader(messageId, tsMs, opts) {
  const parts = [
    encodeString(RSP.MESSAGE_ID, messageId),
    buildTimestampField(tsMs),
  ];
  if (opts) {
    if (opts.outputId) parts.push(encodeString(RSP.OUTPUT_ID, opts.outputId));
    if (opts.requestId)
      parts.push(encodeString(RSP.REQUEST_ID, opts.requestId));
    if (opts.actualModelUid)
      parts.push(encodeString(RSP.ACTUAL_MODEL_UID, opts.actualModelUid));
  }
  return Buffer.concat(parts);
}

/**
 * 复合帧 · 一帧一次性写多个 GetChatMessageResponse 字段
 * 适合"text + stop_reason 同帧"等场景
 *
 * @param {object} args
 * @param {string} [args.messageId]
 * @param {string} [args.deltaText]
 * @param {string} [args.deltaThinking]
 * @param {Array}  [args.toolCalls]   · 每项: {id, name, argumentsJson}
 * @param {number} [args.stopReason]  · 见 STOP_* 常量
 */
function buildResponseFrame(args) {
  const parts = [];
  if (args.messageId) parts.push(encodeString(RSP.MESSAGE_ID, args.messageId));
  if (args.deltaText) parts.push(encodeString(RSP.DELTA_TEXT, args.deltaText));
  if (args.deltaThinking)
    parts.push(encodeString(RSP.DELTA_THINKING, args.deltaThinking));
  if (typeof args.stopReason === "number") {
    parts.push(encodeUint(RSP.STOP_REASON, args.stopReason));
  }
  if (Array.isArray(args.toolCalls) && args.toolCalls.length) {
    for (const tc of args.toolCalls) {
      parts.push(encodeMessage(RSP.DELTA_TOOL_CALLS, encodeChatToolCall(tc)));
    }
  }
  if (parts.length === 0) return Buffer.alloc(0);
  return buildFrame(0, Buffer.concat(parts));
}

// ════════════════════════════════════════════════════════════════
// 4) 完整请求反解 · GetChatMessageRequest → 070 网关可吃的形态
// ════════════════════════════════════════════════════════════════

/** 单个 ChatMessagePrompt → 中性形态 (后由 070 网关再转 OpenAI/Anthropic)
 *
 *  双 fallback (利而不害):
 *    · source 优先 field 2 (wire 实证), fallback field 1 (旧 070+010 约定)
 *    · prompt 优先 field 3 (wire 实证), fallback field 2 (旧 070+010 约定)
 *  这样无论 reqBody 来自正路 (api_server_pb 真 wire) 或旧路 (070 mock self-test),
 *  都能正确抽出 role + content. 若双路皆空, 字段缺即返回空消息 (不抛).
 */
function decodeChatMessagePrompt(buf) {
  const f = parseProto(buf);

  // ── source: 真 wire field 2 优先, 旧约定 field 1 fallback ──
  const sourceField =
    f[MSG.SOURCE]?.[0] !== undefined
      ? f[MSG.SOURCE][0]
      : f[MSG_LEGACY.SOURCE]?.[0];
  const sourceVal = sourceField?.v ?? SOURCE_USER;
  const role =
    sourceVal === SOURCE_SYSTEM
      ? "system"
      : sourceVal === SOURCE_ASSISTANT
        ? "assistant"
        : sourceVal === SOURCE_TOOL
          ? "tool"
          : "user";

  // ── content: 真 wire field 3 优先, 旧约定 field 2 fallback ──
  // wire 上既有"裸 utf8 字符串"也有"嵌套 ContentBlock proto" 两形态.
  // 走双尝试: 先按裸字符串读, 若首字节是控制字符 (非 \t\n\r) 则当嵌套 parseProto.
  let prompt = "";
  const cf = f[MSG.PROMPT]?.[0] || f[MSG_LEGACY.PROMPT]?.[0];
  if (cf?.w === 2) {
    const raw = Buffer.from(cf.b);
    const tryStr = raw.toString("utf8");
    const looksBinary =
      raw.length > 0 &&
      raw[0] <= 31 &&
      raw[0] !== 0x09 &&
      raw[0] !== 0x0a &&
      raw[0] !== 0x0d;
    if (looksBinary) {
      try {
        const inner = parseProto(raw);
        const tf = inner[3]?.[0] || inner[2]?.[0] || inner[1]?.[0];
        if (tf?.w === 2) prompt = Buffer.from(tf.b).toString("utf8");
      } catch {}
    }
    if (!prompt) prompt = tryStr;
  }

  // tool_calls (field 6, repeated)
  const toolCalls = [];
  for (const e of f[MSG.TOOL_CALLS] || []) {
    if (e.w !== 2) continue;
    const tcF = parseProto(Buffer.from(e.b));
    toolCalls.push({
      id: tcF[TC.ID]?.[0]?.b
        ? Buffer.from(tcF[TC.ID][0].b).toString("utf8")
        : "",
      name: tcF[TC.NAME]?.[0]?.b
        ? Buffer.from(tcF[TC.NAME][0].b).toString("utf8")
        : "",
      argumentsJson: tcF[TC.ARGUMENTS_JSON]?.[0]?.b
        ? Buffer.from(tcF[TC.ARGUMENTS_JSON][0].b).toString("utf8")
        : "",
    });
  }

  // tool_call_id (field 7) · 仅 role=tool 时有
  let toolCallId = "";
  const tciF = f[MSG.TOOL_CALL_ID]?.[0];
  if (tciF?.w === 2) toolCallId = Buffer.from(tciF.b).toString("utf8");

  // tool_result_is_error (field 9)
  const isError = f[MSG.TOOL_RESULT_IS_ERROR]?.[0]?.v === 1;

  // ★ 视感 · images (field 10, repeated ImageData)
  //   wire 实证: ImageData = { base64_data:1, mime_type:2, caption:3 } · 仅 base64 内嵌, 无 url 字段
  //   070 透出 OpenAI image_url 形态: { type: 'image_url', image_url: { url: 'data:<mime>;base64,<...>' } }
  //   兼容 fallback: 旧 070 测试可能在 field 2 (MIME_TYPE 位置) 写了 url, field 1 写了 mime,
  //     此时若 field 2 文本以 http(s)://data: 起头, 则当 url 透出 (利而不害, 渐式归正).
  const images = [];
  for (const e of f[MSG.IMAGES] || []) {
    if (e.w !== 2) continue;
    try {
      const imgF = parseProto(Buffer.from(e.b));
      const get2 = (n) =>
        imgF[n]?.[0]?.w === 2 ? Buffer.from(imgF[n][0].b).toString("utf8") : "";
      const f1 = get2(IMG.BASE64_DATA); // 实证: base64 字符串
      const f2 = get2(IMG.MIME_TYPE); // 实证: "image/png" 等
      const caption = get2(IMG.CAPTION);

      let imageUrl = "";
      let mime = "image/png";

      // 兼容路径 (旧 070 mock): 若 f2 像 url 则当 url 用, f1 当 mime
      if (
        f2 &&
        (f2.startsWith("http://") ||
          f2.startsWith("https://") ||
          f2.startsWith("data:"))
      ) {
        imageUrl = f2;
        if (f1 && f1.startsWith("image/")) mime = f1;
      }
      // 真 wire 路: f1 是 base64_data, f2 是 mime_type
      else if (f1) {
        if (f2 && f2.startsWith("image/")) mime = f2;
        // f1 是裸 base64 字符串 (无 data: 前缀), 070 自构 data URL
        if (
          f1.startsWith("http://") ||
          f1.startsWith("https://") ||
          f1.startsWith("data:")
        ) {
          imageUrl = f1; // 兼容: f1 偶尔含完整 url
        } else {
          imageUrl = `data:${mime};base64,${f1}`;
        }
      }

      if (imageUrl) {
        const out = { type: "image_url", image_url: { url: imageUrl } };
        if (caption) out.image_url.detail = caption; // caption 借用 detail 透到上游
        images.push(out);
      }
    } catch {
      // ImageData layout 不符 · 静默跳过 (利而不害)
    }
  }

  // thinking (field 11)
  let thinking = "";
  const thF = f[MSG.THINKING]?.[0];
  if (thF?.w === 2) thinking = Buffer.from(thF.b).toString("utf8");

  return {
    role,
    content: prompt,
    ...(images.length ? { images } : {}),
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    ...(toolCallId ? { tool_call_id: toolCallId } : {}),
    ...(isError ? { tool_result_is_error: true } : {}),
    ...(thinking ? { thinking } : {}),
  };
}

/** 单个 ImageData 编码 · 用于 070 自检 + mock 拼真请求 · 走 wire 实证字段
 *
 *  接受 (兼容旧 API):
 *    base64Data : string · base64 字符串 (新 API · 优先)
 *    mediaType  : string · "image/png" 等 (旧 API · 透为 mime_type)
 *    mimeType   : string · "image/png" 等 (新 API)
 *    data       : Buffer · 二进制 → 070 自动 base64 编 (旧 API 兼容)
 *    url        : string · ★ 真 wire 无此字段, 070 把它写到 BASE64_DATA 位置作兼容
 *                          (decode 端识 http/data: 前缀回收为 url)
 *    caption    : string · 图像说明 (新 API · 真 wire 字段 3)
 *    detail     : string · 旧 API · 070 把它当 caption 透
 */
function encodeImageData({
  mediaType,
  mimeType,
  url,
  data,
  base64Data,
  caption,
  detail,
}) {
  const parts = [];
  // ── field 1: base64_data (string) ──
  let b64 = base64Data || "";
  if (!b64 && data && Buffer.isBuffer(data)) {
    b64 = data.toString("base64");
  }
  // 兼容: 若调用方仅给 url, 070 把 url 写到 field 1 (decode 端识 http/data: 收回)
  // 真 wire 不会出现 url 形态, 此路仅服务 070 mock self-test 与渐式迁移.
  if (!b64 && url) b64 = url;
  if (b64) parts.push(encodeString(IMG.BASE64_DATA, b64));

  // ── field 2: mime_type (string) ──
  const mt = mimeType || mediaType || "";
  if (mt) parts.push(encodeString(IMG.MIME_TYPE, mt));

  // ── field 3: caption (string) ──
  const cap = caption || detail || "";
  if (cap) parts.push(encodeString(IMG.CAPTION, cap));

  return Buffer.concat(parts);
}

/** 单个 ChatToolDefinition → OpenAI tools 形态 */
function decodeChatToolDefinition(buf) {
  const f = parseProto(buf);
  const get = (n) =>
    f[n]?.[0]?.w === 2 ? Buffer.from(f[n][0].b).toString("utf8") : "";
  const name = get(TD.NAME);
  if (!name) return null;
  const description = get(TD.DESCRIPTION);
  const schemaStr = get(TD.JSON_SCHEMA_STRING);
  let parameters = { type: "object", properties: {} };
  if (schemaStr) {
    try {
      parameters = JSON.parse(schemaStr);
    } catch {}
  }
  return {
    type: "function",
    function: { name, description, parameters },
  };
}

/** ChatToolChoice (oneof) → OpenAI tool_choice 形态 */
function decodeChatToolChoice(buf) {
  const f = parseProto(buf);
  const opt = f[TCH.OPTION_NAME]?.[0];
  if (opt?.w === 2) {
    const s = Buffer.from(opt.b).toString("utf8");
    if (s === "required") return "required";
    if (s === "none") return "none";
    return "auto";
  }
  const name = f[TCH.TOOL_NAME]?.[0];
  if (name?.w === 2) {
    return {
      type: "function",
      function: { name: Buffer.from(name.b).toString("utf8") },
    };
  }
  return undefined;
}

/**
 * 完整请求反解 · 不依赖 010
 *
 * @param {Buffer} reqBody  · 010 收到的原始 body (Connect frames)
 * @param {boolean} isJSON  · content-type 含 'json' 即真
 * @returns {{
 *   modelUid: string,
 *   system: string,
 *   messages: Array,
 *   tools: Array,
 *   toolChoice: any,
 *   disableParallelToolCalls: boolean,
 *   cascadeId: string,
 *   promptId: string,
 * }}
 */
function parseGetChatMessageRequest(reqBody, isJSON) {
  if (isJSON) {
    // JSON 形态 (Connect+JSON): 单帧 length-prefixed 或裸 JSON
    let raw = reqBody;
    try {
      const frames = parseFrames(reqBody);
      if (frames.length > 0) raw = frames[0].payload;
    } catch {}
    let body;
    try {
      body = JSON.parse(raw.toString("utf8"));
    } catch {
      return _emptyParsedReq();
    }
    return _normalizeJsonReq(body);
  }

  // proto 形态
  const frames = parseFrames(reqBody);
  if (!frames.length) return _emptyParsedReq();

  // Handle gzip compression (Connect-RPC frame flags bit 0 = compressed)
  let _payload = frames[0].payload;
  if (frames[0].flags & 1) {
    try {
      _payload = require("zlib").gunzipSync(_payload);
    } catch (gzErr) {
      // ★ v9.9.59 · 诊断: gzip 解压失败时记录 (DEFECT10)
      try {
        console.error(
          "[cascade_wire] gunzip fail: " +
            gzErr.message +
            " payloadLen=" +
            _payload.length,
        );
      } catch {}
      return _emptyParsedReq();
    }
  }
  const top = parseProto(_payload);

  const get2 = (n) =>
    top[n]?.[0]?.w === 2 ? Buffer.from(top[n][0].b).toString("utf8") : "";

  // ── modelUid: 真 wire field 21 优先, 旧 070+010 约定 field 3 fallback ──
  // 真 wire field 3 是 chat_message_prompts (LEN nested), 不是 string;
  // 故 fallback 时只采纳"看起来像 modelUid 的纯文本" (避免误读嵌套 message bytes).
  let modelUid = get2(REQ.CHAT_MODEL_UID);
  if (!modelUid) {
    const fallback = get2(REQ_LEGACY.CHAT_MODEL_UID);
    if (fallback && /^[\x20-\x7e]+$/.test(fallback) && fallback.length < 80) {
      modelUid = fallback;
    }
  }
  // 兜底: chat_model_name (field 14) 也作辅助路由
  if (!modelUid) modelUid = get2(REQ.CHAT_MODEL_NAME);

  // ── messages: 真 wire field 3 优先, 旧约定 field 2 fallback ──
  let msgEntries = top[REQ.CHAT_MESSAGES] || [];
  if (!msgEntries.length) msgEntries = top[REQ_LEGACY.CHAT_MESSAGES] || [];
  const allMsgs = msgEntries
    .filter((e) => e.w === 2)
    .map((e) => decodeChatMessagePrompt(Buffer.from(e.b)))
    .filter(
      (m) =>
        m.content || (m.tool_calls && m.tool_calls.length) || m.tool_call_id,
    );

  // ── system: 真 wire field 2 (api_server_pb prompt) 优先 ──
  // 兼容: 若 field 2 空, 则按旧约定从 messages[0].role=system 抽 (010 历史路径).
  let system = get2(REQ.PROMPT);
  const messages = [];
  for (let i = 0; i < allMsgs.length; i++) {
    const m = allMsgs[i];
    if (i === 0 && m.role === "system" && m.content && !system) {
      system = m.content;
      continue; // system 独立成 system 字段, 不再压入 messages
    }
    messages.push(m);
  }

  // ── tools / tool_choice / disable_parallel: 真 wire field 10/12/11 (070 旧版已对齐) ──
  const tools = (top[REQ.TOOLS] || [])
    .filter((e) => e.w === 2)
    .map((e) => decodeChatToolDefinition(Buffer.from(e.b)))
    .filter(Boolean);

  let toolChoice;
  const tcBuf = top[REQ.TOOL_CHOICE]?.[0];
  if (tcBuf?.w === 2) toolChoice = decodeChatToolChoice(Buffer.from(tcBuf.b));

  const disableParallelToolCalls = top[REQ.DISABLE_PARALLEL]?.[0]?.v === 1;

  // ── cascadeId / promptId · 反者道之动 · 实证已在 wire 中 ──
  const cascadeId = get2(REQ.CASCADE_ID);
  const promptId = get2(REQ.PROMPT_ID);

  return {
    modelUid,
    system,
    messages,
    tools,
    toolChoice,
    disableParallelToolCalls,
    cascadeId,
    promptId,
  };
}

function _emptyParsedReq() {
  return {
    modelUid: "",
    system: "",
    messages: [],
    tools: [],
    toolChoice: undefined,
    disableParallelToolCalls: false,
    cascadeId: "",
    promptId: "",
  };
}

function _normalizeJsonReq(b) {
  // 010 上游 Cloud 偶有 JSON 形态; 字段名同 proto camelCase
  const allMsgs = Array.isArray(b.chatMessagePrompts || b.messages)
    ? (b.chatMessagePrompts || b.messages).map((m) => {
        const sourceMap = { 0: "system", 1: "user", 2: "assistant", 3: "tool" };
        const role =
          typeof m.source === "number"
            ? sourceMap[m.source] || "user"
            : m.role || sourceMap[m.source] || "user";
        return {
          role,
          content: m.prompt || m.content || "",
          ...(Array.isArray(m.tool_calls || m.toolCalls)
            ? { tool_calls: m.tool_calls || m.toolCalls }
            : {}),
          ...(m.tool_call_id || m.toolCallId
            ? { tool_call_id: m.tool_call_id || m.toolCallId }
            : {}),
        };
      })
    : [];

  // 抽 system: messages[0].role=system → 独立 system 字段 (与 proto 路径同语义)
  let extractedSys = "";
  const messages = [];
  for (let i = 0; i < allMsgs.length; i++) {
    const m = allMsgs[i];
    if (i === 0 && m.role === "system" && m.content && !extractedSys) {
      extractedSys = m.content;
      continue;
    }
    messages.push(m);
  }

  const tools = Array.isArray(b.tools)
    ? b.tools
        .map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description || "",
            parameters:
              typeof t.json_schema_string === "string"
                ? safeJSONParse(t.json_schema_string, {
                    type: "object",
                    properties: {},
                  })
                : t.parameters || { type: "object", properties: {} },
          },
        }))
        .filter((t) => t.function && t.function.name)
    : [];

  return {
    modelUid:
      b.chatModelUid ||
      b.chat_model_uid ||
      b.modelUid ||
      b.model_uid ||
      b.model ||
      "",
    system: b.prompt || b.system || extractedSys,
    messages,
    tools,
    toolChoice: b.toolChoice || b.tool_choice,
    disableParallelToolCalls: !!(
      b.disableParallelToolCalls || b.disable_parallel_tool_calls
    ),
    cascadeId: b.cascadeId || b.cascade_id || "",
    promptId: b.promptId || b.prompt_id || "",
  };
}

function safeJSONParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

// ════════════════════════════════════════════════════════════════
// 5) 自检 · 反解自身输出, 不依赖任何外部
// ════════════════════════════════════════════════════════════════

function _selfTest() {
  let pass = 0,
    fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) {
      pass++;
      console.log(`  [PASS] ${name}${detail ? " · " + detail : ""}`);
    } else {
      fail++;
      console.log(`  [FAIL] ${name}${detail ? " · " + detail : ""}`);
    }
  };

  // ── decodeVarint 精度 ──
  // ★ v9.9.88 · 测试大数 varint 解码精度
  //   268435456 = 2^28 · 7位分组: 0,0,0,0,1 → varint: [0x80, 0x80, 0x80, 0x80, 0x01]
  const bigVarintBuf = Buffer.from([0x80, 0x80, 0x80, 0x80, 0x01]);
  const bigV = decodeVarint(bigVarintBuf, 0);
  t("decodeVarint: 大数精度 (2^28=268435456)", bigV.value === 268435456);

  // ── parseProto 畸形防护 ──
  // ★ v9.9.88 · 测试畸形输入不崩溃
  //   field 1 varint = 4294967295 (max uint32) · varint: [0xFF, 0xFF, 0xFF, 0xFF, 0x0F]
  const malformedBuf = Buffer.from([0x08, 0xff, 0xff, 0xff, 0xff, 0x0f]);
  const malParsed = parseProto(malformedBuf);
  t("parseProto: 畸形输入不崩溃", malParsed[1]?.[0]?.v === 4294967295);

  // ── 帧基础 ──
  const f1 = buildTextFrame("道");
  t("buildTextFrame: flags=0", f1[0] === 0);
  t("buildTextFrame: length 头有效", f1.readUInt32BE(1) === f1.length - 5);
  const fp1 = parseProto(f1.slice(5));
  t("buildTextFrame: 编到 field 3 (delta_text)", !!fp1[RSP.DELTA_TEXT]);
  t(
    "buildTextFrame: 文本可还原",
    Buffer.from(fp1[RSP.DELTA_TEXT][0].b).toString("utf8") === "道",
  );

  const fThink = buildThinkingFrame("思");
  const fpThink = parseProto(fThink.slice(5));
  t("buildThinkingFrame: field 9", !!fpThink[RSP.DELTA_THINKING]);
  t(
    "buildThinkingFrame: 文本可还原",
    Buffer.from(fpThink[RSP.DELTA_THINKING][0].b).toString("utf8") === "思",
  );

  const fStop = buildStopReasonFrame(STOP_END);
  const fpStop = parseProto(fStop.slice(5));
  t(
    "buildStopReasonFrame: field 5 varint",
    fpStop[RSP.STOP_REASON]?.[0]?.w === 0,
  );
  t(
    "buildStopReasonFrame: 值=2 (STOP_PATTERN)",
    fpStop[RSP.STOP_REASON]?.[0]?.v === 2,
  );

  const fTool = buildToolCallsFrame([
    { id: "tc_1", name: "read_file", argumentsJson: '{"path":"a.txt"}' },
  ]);
  const fpTool = parseProto(fTool.slice(5));
  t(
    "buildToolCallsFrame: field 6 含 1 项",
    (fpTool[RSP.DELTA_TOOL_CALLS] || []).length === 1,
  );
  const tcInner = parseProto(Buffer.from(fpTool[RSP.DELTA_TOOL_CALLS][0].b));
  t(
    "ChatToolCall.id",
    Buffer.from(tcInner[TC.ID][0].b).toString("utf8") === "tc_1",
  );
  t(
    "ChatToolCall.name",
    Buffer.from(tcInner[TC.NAME][0].b).toString("utf8") === "read_file",
  );
  t(
    "ChatToolCall.arguments_json",
    Buffer.from(tcInner[TC.ARGUMENTS_JSON][0].b).toString("utf8") ===
      '{"path":"a.txt"}',
  );

  const fEnd = buildEndFrame(null);
  t("buildEndFrame: flags=2", fEnd[0] === 2);
  // ★ v9.9.72b · EOS 帧 payload 含 grpc-status
  const endJson = JSON.parse(fEnd.slice(5).toString("utf8"));
  t('buildEndFrame: grpc-status="0"', endJson["grpc-status"] === "0");

  const fEndErr = buildEndFrame("boom");
  const errJson = JSON.parse(fEndErr.slice(5).toString("utf8"));
  t("buildEndFrame(err): grpc-status=13", errJson["grpc-status"] === "13");
  t("buildEndFrame(err): grpc-message", errJson["grpc-message"] === "boom");

  // ── 复合帧 ──
  const fCombo = buildResponseFrame({
    deltaText: "A",
    toolCalls: [{ id: "x", name: "edit", argumentsJson: "{}" }],
    stopReason: STOP_END,
  });
  const fpCombo = parseProto(fCombo.slice(5));
  t("combo: 同帧含 delta_text", !!fpCombo[RSP.DELTA_TEXT]);
  t("combo: 同帧含 delta_tool_calls", !!fpCombo[RSP.DELTA_TOOL_CALLS]);
  t("combo: 同帧含 stop_reason", !!fpCombo[RSP.STOP_REASON]);

  // ── 请求反解: 用 070 自家编码器拼一个 mock GetChatMessageRequest ──
  // 当前 wire (010 v2.0.44 实证): field 2=chat_messages, field 3=model_uid
  // system 作为 messages[0] 携 role=0 (无独立字段) · 070 解析时自动抽到 system
  const mockSysMsg = encodeMessage(
    REQ.CHAT_MESSAGES,
    Buffer.concat([
      encodeUint(MSG.SOURCE, SOURCE_SYSTEM),
      encodeString(MSG.PROMPT, "You are helpful"),
    ]),
  );
  const mockMsgUser = encodeMessage(
    REQ.CHAT_MESSAGES,
    Buffer.concat([
      encodeUint(MSG.SOURCE, SOURCE_USER),
      encodeString(MSG.PROMPT, "hi"),
    ]),
  );
  const mockMsgAsst = encodeMessage(
    REQ.CHAT_MESSAGES,
    Buffer.concat([
      encodeUint(MSG.SOURCE, SOURCE_ASSISTANT),
      encodeString(MSG.PROMPT, ""),
      encodeMessage(
        MSG.TOOL_CALLS,
        encodeChatToolCall({
          id: "tc_1",
          name: "read_file",
          argumentsJson: '{"path":"a"}',
        }),
      ),
    ]),
  );
  const mockMsgTool = encodeMessage(
    REQ.CHAT_MESSAGES,
    Buffer.concat([
      encodeUint(MSG.SOURCE, SOURCE_TOOL),
      encodeString(MSG.PROMPT, "file content"),
      encodeString(MSG.TOOL_CALL_ID, "tc_1"),
    ]),
  );
  const mockTool = encodeMessage(
    REQ.TOOLS,
    Buffer.concat([
      encodeString(TD.NAME, "read_file"),
      encodeString(TD.DESCRIPTION, "读文件"),
      encodeString(
        TD.JSON_SCHEMA_STRING,
        '{"type":"object","properties":{"path":{"type":"string"}}}',
      ),
    ]),
  );
  const mockChoice = encodeMessage(
    REQ.TOOL_CHOICE,
    encodeString(TCH.OPTION_NAME, "auto"),
  );
  const mockUid = encodeString(REQ.CHAT_MODEL_UID, "dao-byok-foo");

  const reqPayload = Buffer.concat([
    mockSysMsg,
    mockMsgUser,
    mockMsgAsst,
    mockMsgTool,
    mockTool,
    mockChoice,
    mockUid,
  ]);
  const reqFrame = buildFrame(0, reqPayload);
  const parsed = parseGetChatMessageRequest(reqFrame, false);
  t("parseReq: modelUid", parsed.modelUid === "dao-byok-foo");
  t(
    "parseReq: system 自动抽 (messages[0] role=0)",
    parsed.system === "You are helpful",
  );
  t("parseReq: messages.length=3 (system 已剥)", parsed.messages.length === 3);
  t("parseReq: msg[0].role=user", parsed.messages[0].role === "user");
  t("parseReq: msg[0].content=hi", parsed.messages[0].content === "hi");
  t("parseReq: msg[1].role=assistant", parsed.messages[1].role === "assistant");
  t(
    "parseReq: msg[1].tool_calls.length=1",
    parsed.messages[1].tool_calls?.length === 1,
  );
  t(
    "parseReq: msg[1].tool_calls[0].name",
    parsed.messages[1].tool_calls?.[0]?.name === "read_file",
  );
  t("parseReq: msg[2].role=tool", parsed.messages[2].role === "tool");
  t(
    "parseReq: msg[2].tool_call_id=tc_1",
    parsed.messages[2].tool_call_id === "tc_1",
  );
  t("parseReq: tools.length=1", parsed.tools.length === 1);
  t(
    "parseReq: tools[0].function.name",
    parsed.tools[0].function.name === "read_file",
  );
  t(
    "parseReq: tools[0].function.parameters.type",
    parsed.tools[0].function.parameters.type === "object",
  );
  t("parseReq: toolChoice=auto", parsed.toolChoice === "auto");

  // JSON 形态 (Connect+JSON 上游)
  const jsonReq = Buffer.from(
    JSON.stringify({
      chatModelUid: "dao-byok-bar",
      chatMessagePrompts: [
        { source: SOURCE_SYSTEM, prompt: "sys" },
        { source: SOURCE_USER, prompt: "q" },
      ],
      tools: [
        {
          name: "edit",
          description: "e",
          json_schema_string: '{"type":"object"}',
        },
      ],
    }),
    "utf8",
  );
  const parsedJ = parseGetChatMessageRequest(jsonReq, true);
  t("parseReq(json): modelUid", parsedJ.modelUid === "dao-byok-bar");
  t("parseReq(json): tools.length=1", parsedJ.tools.length === 1);

  // ── 视感 (image) 自反解 ★★★ ──
  // 测 1: URL 形态
  const imgUrl = encodeImageData({
    mediaType: "image/png",
    url: "https://example.com/foo.png",
    detail: "high",
  });
  const userWithImage = encodeMessage(
    REQ.CHAT_MESSAGES,
    Buffer.concat([
      encodeUint(MSG.SOURCE, SOURCE_USER),
      encodeString(MSG.PROMPT, "What is in this image?"),
      encodeMessage(MSG.IMAGES, imgUrl),
    ]),
  );
  const reqImg = buildFrame(
    0,
    Buffer.concat([
      userWithImage,
      encodeString(REQ.CHAT_MODEL_UID, "dao-byok-vision"),
    ]),
  );
  const parsedImg = parseGetChatMessageRequest(reqImg, false);
  t(
    "parseReq: 视感 · image url 解出",
    parsedImg.messages[0].images?.length === 1,
  );
  t(
    "parseReq: 视感 · image_url.url 正确",
    parsedImg.messages[0].images?.[0]?.image_url?.url ===
      "https://example.com/foo.png",
  );
  t(
    "parseReq: 视感 · image type=image_url",
    parsedImg.messages[0].images?.[0]?.type === "image_url",
  );
  t(
    "parseReq: 视感 · detail 透出",
    parsedImg.messages[0].images?.[0]?.image_url?.detail === "high",
  );

  // 测 2: base64 data 形态 (无 url, 用 raw bytes 自构 data URL)
  const imgB64 = encodeImageData({
    mediaType: "image/jpeg",
    data: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), // JPEG 文件魔数前 4 字节
  });
  const userImgB64 = encodeMessage(
    REQ.CHAT_MESSAGES,
    Buffer.concat([
      encodeUint(MSG.SOURCE, SOURCE_USER),
      encodeString(MSG.PROMPT, "x"),
      encodeMessage(MSG.IMAGES, imgB64),
    ]),
  );
  const reqImgB64 = buildFrame(
    0,
    Buffer.concat([
      userImgB64,
      encodeString(REQ.CHAT_MODEL_UID, "dao-byok-v2"),
    ]),
  );
  const parsedImgB64 = parseGetChatMessageRequest(reqImgB64, false);
  const dataUrl = parsedImgB64.messages[0].images?.[0]?.image_url?.url || "";
  t(
    "parseReq: 视感 · base64 data 自构 data URL",
    dataUrl.startsWith("data:image/jpeg;base64,"),
  );
  t(
    "parseReq: 视感 · data URL base64 解码可还原原字节",
    Buffer.from(dataUrl.split(",")[1], "base64").equals(
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    ),
  );

  // 测 3: 多图 (repeated)
  const userMulti = encodeMessage(
    REQ.CHAT_MESSAGES,
    Buffer.concat([
      encodeUint(MSG.SOURCE, SOURCE_USER),
      encodeString(MSG.PROMPT, "Compare these images"),
      encodeMessage(
        MSG.IMAGES,
        encodeImageData({ url: "https://a.com/1.png", mediaType: "image/png" }),
      ),
      encodeMessage(
        MSG.IMAGES,
        encodeImageData({ url: "https://a.com/2.png", mediaType: "image/png" }),
      ),
    ]),
  );
  const reqMulti = buildFrame(
    0,
    Buffer.concat([userMulti, encodeString(REQ.CHAT_MODEL_UID, "v")]),
  );
  const parsedMulti = parseGetChatMessageRequest(reqMulti, false);
  t(
    "parseReq: 视感 · 多图 (repeated) 全保",
    parsedMulti.messages[0].images?.length === 2,
  );

  console.log(`\n  cascade_wire 自检: ${pass} passed · ${fail} failed`);
  return { pass, fail };
}

module.exports = {
  // 常量
  RSP,
  REQ,
  MSG,
  IMG, // ★ 视感 · ImageData 字段号
  TC,
  TD,
  TCH,
  SOURCE_SYSTEM,
  SOURCE_USER,
  SOURCE_ASSISTANT,
  SOURCE_TOOL,
  STOP_END,
  STOP_MAX_TOKENS,
  STOP_TOOL_CALLS,
  STOP_CONTENT_FILTER,
  STOP_ERROR,
  // 低阶 (供测试 / 第三方拼装)
  encodeVarint,
  decodeVarint,
  encodeString,
  encodeUint,
  encodeMessage,
  encodeImageData, // ★ 视感 · 给 070 mock 拼真 wire 用
  parseProto,
  buildFrame,
  parseFrames,
  // 高阶帧
  buildTextFrame,
  buildThinkingFrame,
  buildToolCallsFrame,
  buildStopReasonFrame,
  buildEndFrame,
  buildResponseFrame,
  buildTimestampField, // ★ v9.9.78 · Timestamp 子消息编码
  buildFrameHeader, // ★ v9.9.78 · 每帧必含 message_id + timestamp
  encodeChatToolCall,
  encodeBool, // ★ v9.9.88 · bool 编码
  encodeUsageStats, // ★ v9.9.88 · Usage Stats 子消息
  buildCreditCostFrame, // ★ v9.9.88 · Credit Cost 帧
  // 请求反解
  parseGetChatMessageRequest,
  decodeChatMessagePrompt,
  decodeChatToolDefinition,
  decodeChatToolChoice,
  // 自检
  _selfTest,
};

if (require.main === module) {
  const { pass, fail } = _selfTest();
  process.exit(fail === 0 ? 0 : 1);
}
