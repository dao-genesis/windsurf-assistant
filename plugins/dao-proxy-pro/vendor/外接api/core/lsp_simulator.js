"use strict";
const http = require("http"),
  path = require("path"),
  fs = require("fs");
const W = require(path.join(__dirname, "cascade_wire.js"));
const Router = require(path.join(__dirname, "dao_router.js"));

function encodeMsg(m) {
  const p = [];
  if (m.messageId) p.push(W.encodeString(W.MSG.MESSAGE_ID, m.messageId));
  if (m.source !== undefined) p.push(W.encodeUint(W.MSG.SOURCE, m.source));
  if (m.prompt) p.push(W.encodeString(W.MSG.PROMPT, m.prompt));
  if (m.tool_calls)
    for (const tc of m.tool_calls) {
      const b = [];
      if (tc.id) b.push(W.encodeString(W.TC.ID, tc.id));
      if (tc.name) b.push(W.encodeString(W.TC.NAME, tc.name));
      if (tc.argumentsJson)
        b.push(W.encodeString(W.TC.ARGUMENTS_JSON, tc.argumentsJson));
      p.push(W.encodeMessage(W.MSG.TOOL_CALLS, Buffer.concat(b)));
    }
  if (m.tool_call_id)
    p.push(W.encodeString(W.MSG.TOOL_CALL_ID, m.tool_call_id));
  if (m.tool_result_is_error)
    p.push(W.encodeUint(W.MSG.TOOL_RESULT_IS_ERROR, 1));
  if (m.thinking) p.push(W.encodeString(W.MSG.THINKING, m.thinking));
  return Buffer.concat(p);
}

function buildReq(o) {
  const i = [];
  if (o.system) i.push(W.encodeString(W.REQ.PROMPT, o.system));
  const sm = {
    system: W.SOURCE_SYSTEM,
    user: W.SOURCE_USER,
    assistant: W.SOURCE_ASSISTANT,
    tool: W.SOURCE_TOOL,
  };
  for (const m of o.messages || []) {
    i.push(
      W.encodeMessage(
        W.REQ.CHAT_MESSAGES,
        encodeMsg({
          messageId:
            m._mid || `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
          source: sm[m.role] !== undefined ? sm[m.role] : W.SOURCE_USER,
          prompt: typeof m.content === "string" ? m.content : "",
          tool_calls: m.tool_calls?.map((tc) => ({
            id: tc.id || "",
            name: tc.function?.name || tc.name || "",
            argumentsJson: tc.function?.arguments || tc.argumentsJson || "{}",
          })),
          tool_call_id: m.tool_call_id,
          tool_result_is_error: m.tool_result_is_error,
          thinking: m.reasoning_content || m.thinking,
        }),
      ),
    );
  }
  for (const t of o.tools || []) {
    const fn = t.function || t,
      b = [];
    if (fn.name) b.push(W.encodeString(W.TD.NAME, fn.name));
    if (fn.description)
      b.push(W.encodeString(W.TD.DESCRIPTION, fn.description));
    const sc = fn.parameters || t.parameters;
    if (sc) b.push(W.encodeString(W.TD.JSON_SCHEMA_STRING, JSON.stringify(sc)));
    i.push(W.encodeMessage(W.REQ.TOOLS, Buffer.concat(b)));
  }
  if (o.toolChoice) {
    const b =
      typeof o.toolChoice === "string"
        ? W.encodeString(W.TCH.OPTION_NAME, o.toolChoice)
        : Buffer.alloc(0);
    if (b.length) i.push(W.encodeMessage(W.REQ.TOOL_CHOICE, b));
  }
  if (o.modelUid) i.push(W.encodeString(W.REQ.CHAT_MODEL_UID, o.modelUid));
  return W.buildFrame(0, Buffer.concat(i));
}

function parseResp(data) {
  const frames = W.parseFrames(data);
  const r = {
    text: "",
    thinking: "",
    toolCalls: [],
    stopReason: null,
    messageId: "",
    outputId: "",
    actualModelUid: "",
    frameCount: frames.length,
    trailer: null,
  };
  for (const fr of frames) {
    if (fr.flags === 2) {
      try {
        r.trailer = JSON.parse(fr.payload.toString("utf8"));
      } catch {}
      continue;
    }
    const f = W.parseProto(fr.payload);
    const g2 = (n) =>
      f[n]?.[0]?.w === 2 ? Buffer.from(f[n][0].b).toString("utf8") : "";
    if (f[W.RSP.MESSAGE_ID]?.[0]) r.messageId = g2(W.RSP.MESSAGE_ID);
    if (f[W.RSP.DELTA_TEXT]?.[0]) r.text += g2(W.RSP.DELTA_TEXT);
    if (f[W.RSP.DELTA_THINKING]?.[0]) r.thinking += g2(W.RSP.DELTA_THINKING);
    if (f[W.RSP.STOP_REASON]?.[0]?.w === 0)
      r.stopReason = f[W.RSP.STOP_REASON][0].v;
    if (f[W.RSP.OUTPUT_ID]?.[0]) r.outputId = g2(W.RSP.OUTPUT_ID);
    if (f[W.RSP.ACTUAL_MODEL_UID]?.[0])
      r.actualModelUid = g2(W.RSP.ACTUAL_MODEL_UID);
    for (const e of f[W.RSP.DELTA_TOOL_CALLS] || []) {
      if (e.w !== 2) continue;
      const tf = W.parseProto(Buffer.from(e.b)),
        tc = {};
      if (tf[W.TC.ID]?.[0]?.w === 2)
        tc.id = Buffer.from(tf[W.TC.ID][0].b).toString("utf8");
      if (tf[W.TC.NAME]?.[0]?.w === 2)
        tc.name = Buffer.from(tf[W.TC.NAME][0].b).toString("utf8");
      if (tf[W.TC.ARGUMENTS_JSON]?.[0]?.w === 2)
        tc.argumentsJson = Buffer.from(tf[W.TC.ARGUMENTS_JSON][0].b).toString(
          "utf8",
        );
      if (tf[W.TC.IS_CUSTOM_TOOL]?.[0]?.w === 0)
        tc.isCustomToolCall = tf[W.TC.IS_CUSTOM_TOOL][0].v === 1;
      r.toolCalls.push(tc);
    }
  }
  return r;
}

module.exports = { buildReq, parseResp, encodeMsg, W, Router };
