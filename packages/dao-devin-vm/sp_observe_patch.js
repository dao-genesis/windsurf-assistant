/**
 * sp_observe_patch.js · 印 122 · 反代隔离 SP 实践之轻量采集器 (yin122 全审纳入)
 * ═══════════════════════════════════════════════════════════════
 *
 * 道义:
 *   「反者道之动也; 弱者道之用也」 (帛书四十)
 *   「无有入于无间」                (帛书四十三)
 *   「为者败之, 执者失之」          (帛书六十四) —— 故仅 observe, 不动主公已立
 *   「圣人执一 · 以为天下牧」      (帛书廿二) —— 印 122 三件归宗 · git tracked
 *
 * 用:
 *   const obs = require('./sp_observe_patch');
 *   // 在 dao_proxy.js 之 wss 接收回调中:
 *   ws.on('message', (data) => {
 *     try { obs.capture(data); } catch {}
 *     // ... 主公已立逻辑原样不变
 *   });
 *
 * 端点 (subscribe in dao_proxy.js HTTP router):
 *   GET  /v1/system/wss-observe         返最近 N 笔 + 聚合摘要
 *   GET  /v1/system/wss-observe/full    返全 jsonl 流 (落地 ~/.dao/devin_wss_observed.jsonl)
 *   POST /v1/system/wss-observe/reset   清环 + 滚 jsonl
 *
 * 0 ACU: 不发新探针 · 仅被动观察主公真用之自然 chat 流.
 * 不入主公 git: jsonl 落 ~/.dao/* · 主公自决去留.
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const VERSION = "0.1.1";
const SEAL = "印 122 · 反代隔离 SP 实践 · 反者道之动 · git tracked (yin122)";

const RING_MAX = 256;
const FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB 自滚

const STATE = {
  ring: [],
  agg: {
    methodFreq: Object.create(null),
    sessionUpdateFreq: Object.create(null),
    cogMetaKeys: Object.create(null),
    agentInfo: null,
    agentCapabilities: null,
    availableCommands: [], // {name, description, replacementText, firstSeen}
    configOptions: null,
    firstSeenAt: null,
    lastSeenAt: null,
    totalFrames: 0,
  },
  jsonlPath: path.join(os.homedir(), ".dao", "devin_wss_observed.jsonl"),
};

function ensureDir(p) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  } catch {}
}

function appendJsonl(rec) {
  try {
    ensureDir(STATE.jsonlPath);
    let st = null;
    try {
      st = fs.statSync(STATE.jsonlPath);
    } catch {}
    if (st && st.size > FILE_MAX_BYTES) {
      // 滚动: 老的改 .1.jsonl, 留一份历史
      const old = STATE.jsonlPath.replace(/\.jsonl$/, ".1.jsonl");
      try {
        fs.unlinkSync(old);
      } catch {}
      try {
        fs.renameSync(STATE.jsonlPath, old);
      } catch {}
    }
    fs.appendFileSync(STATE.jsonlPath, JSON.stringify(rec) + "\n", {
      encoding: "utf-8",
    });
  } catch {}
}

function walkCogMeta(obj, agg) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const x of obj) walkCogMeta(x, agg);
    return;
  }
  for (const k of Object.keys(obj)) {
    if (typeof k === "string" && k.startsWith("cognition.ai/")) {
      agg.cogMetaKeys[k] = (agg.cogMetaKeys[k] || 0) + 1;
    }
    walkCogMeta(obj[k], agg);
  }
}

function extractAvailableCommands(commands, agg) {
  if (!Array.isArray(commands)) return;
  for (const c of commands) {
    if (!c || typeof c !== "object" || !c.name) continue;
    const meta = c._meta || {};
    const rt = meta["cognition.ai/replacementText"] || "";
    const existing = agg.availableCommands.find((x) => x.name === c.name);
    if (existing) {
      // 已有 · 若 replacementText 变了更新
      if (rt && existing.replacementText !== rt) {
        existing.replacementText = rt;
        existing.lastSeen = Date.now();
      }
    } else {
      agg.availableCommands.push({
        name: c.name,
        description: c.description || "",
        replacementText: rt,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      });
    }
  }
}

/**
 * capture(data) · 主入口
 * data: Buffer | string | object (JSON-RPC frame)
 */
function capture(data) {
  let frame;
  try {
    if (Buffer.isBuffer(data)) frame = JSON.parse(data.toString("utf-8"));
    else if (typeof data === "string") frame = JSON.parse(data);
    else if (data && typeof data === "object") frame = data;
    else return;
  } catch {
    return;
  }
  if (!frame || typeof frame !== "object") return;

  const agg = STATE.agg;
  agg.totalFrames++;
  agg.lastSeenAt = Date.now();
  if (!agg.firstSeenAt) agg.firstSeenAt = agg.lastSeenAt;

  // method 频次
  if (frame.method) {
    agg.methodFreq[frame.method] = (agg.methodFreq[frame.method] || 0) + 1;
  }

  // initialize 响应
  if (frame.result && typeof frame.result === "object") {
    if (frame.result.agentInfo && !agg.agentInfo) {
      agg.agentInfo = frame.result.agentInfo;
    }
    if (frame.result.agentCapabilities && !agg.agentCapabilities) {
      agg.agentCapabilities = frame.result.agentCapabilities;
    }
    if (Array.isArray(frame.result.configOptions) && !agg.configOptions) {
      agg.configOptions = frame.result.configOptions;
    }
  }

  // session/update 类
  if (
    frame.method === "session/update" &&
    frame.params &&
    frame.params.update
  ) {
    const u = frame.params.update;
    const su = u.sessionUpdate;
    if (su) agg.sessionUpdateFreq[su] = (agg.sessionUpdateFreq[su] || 0) + 1;
    if (Array.isArray(u.availableCommands)) {
      extractAvailableCommands(u.availableCommands, agg);
    }
  }

  // cognition.ai/* 全扫
  walkCogMeta(frame, agg);

  // 写 ring + jsonl
  const lite = {
    t: Date.now(),
    method: frame.method || null,
    id: frame.id || null,
    hasResult: !!frame.result,
    hasError: !!frame.error,
    sessionUpdate:
      frame.method === "session/update" &&
      frame.params &&
      frame.params.update &&
      frame.params.update.sessionUpdate,
    errorCode: frame.error && frame.error.code,
    errorMessage:
      frame.error && typeof frame.error.message === "string"
        ? frame.error.message.slice(0, 200)
        : null,
  };
  STATE.ring.unshift(lite);
  while (STATE.ring.length > RING_MAX) STATE.ring.pop();

  appendJsonl({
    t: lite.t,
    frame: frame, // 全帧落 jsonl (供事后挖)
  });
}

/** 给 dao_proxy HTTP router 用之 handler */
function makeHttpHandlers() {
  return {
    "GET /v1/system/wss-observe": (req, res) => {
      const summary = {
        version: VERSION,
        seal: SEAL,
        totalFrames: STATE.agg.totalFrames,
        firstSeenAt: STATE.agg.firstSeenAt,
        lastSeenAt: STATE.agg.lastSeenAt,
        agentInfo: STATE.agg.agentInfo,
        agentCapabilities: STATE.agg.agentCapabilities,
        configOptions: STATE.agg.configOptions,
        availableCommands: STATE.agg.availableCommands,
        methodFreq: STATE.agg.methodFreq,
        sessionUpdateFreq: STATE.agg.sessionUpdateFreq,
        cogMetaKeys: STATE.agg.cogMetaKeys,
        ringSize: STATE.ring.length,
        ringHead: STATE.ring.slice(0, 32),
        jsonlPath: STATE.jsonlPath,
      };
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(summary, null, 2));
    },
    "GET /v1/system/wss-observe/full": (req, res) => {
      try {
        const stream = fs.createReadStream(STATE.jsonlPath, "utf-8");
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=utf-8",
        });
        stream.pipe(res);
        stream.on("error", () => {
          res.end();
        });
      } catch (e) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "jsonl not found", path: STATE.jsonlPath }),
        );
      }
    },
    "POST /v1/system/wss-observe/reset": (req, res) => {
      STATE.ring.length = 0;
      STATE.agg = {
        methodFreq: Object.create(null),
        sessionUpdateFreq: Object.create(null),
        cogMetaKeys: Object.create(null),
        agentInfo: null,
        agentCapabilities: null,
        availableCommands: [],
        configOptions: null,
        firstSeenAt: null,
        lastSeenAt: null,
        totalFrames: 0,
      };
      try {
        const old = STATE.jsonlPath.replace(/\.jsonl$/, ".1.jsonl");
        if (fs.existsSync(STATE.jsonlPath)) fs.renameSync(STATE.jsonlPath, old);
      } catch {}
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, reset: true }));
    },
  };
}

module.exports = {
  VERSION,
  SEAL,
  capture,
  makeHttpHandlers,
  _state: STATE, // 供测试
};
