#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// v9.9.330 · 扩展↔LS wedge 自愈 · 本源信号自检
//   验证 source.js 的 LS 心跳观照:控制面 /origin/ping 不算 LS 流量(ls_idle_s
//   持续增长);真 LS→上游 请求刷新 _lastLsReqAt(ls_idle_s 归零)。看门狗据此
//   辨识「proxy 健康却 LS 掉线」的 wedge → 自愈重启 LS,从根解「连不上官方服务」。
// ═══════════════════════════════════════════════════════════════════════════
"use strict";
const http = require("http");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "bundled-origin", "source.js");

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log("  \u2713 " + msg);
  } else {
    failed++;
    console.log("  \u2717 " + msg);
  }
}

function get(port, p) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: p, method: "GET", timeout: 4000 },
      (res) => {
        let b = "";
        res.on("data", (d) => (b += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(new Error("bad json: " + b.slice(0, 120)));
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}

// 发一个「真 LS→上游」请求(非 /origin/、非 /v1/):不等回包,只为触发 handler
// 顶部同步 _lastLsReqAt = Date.now()。上游可达与否无关(戳在读 body/转发前即置)。
function fireLsTraffic(port) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/exa.codeium_common_pb.CodeiumService/Heartbeat",
        method: "POST",
        timeout: 600,
        headers: { "content-type": "application/proto" },
      },
      (res) => {
        res.on("data", () => {});
        res.on("end", () => resolve());
      },
    );
    req.on("error", () => resolve());
    req.on("timeout", () => {
      req.destroy();
      resolve();
    });
    req.end(Buffer.from([0, 0, 0, 0, 0]));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("\n\u2550\u2550\u2550 v9.9.330 LS 心跳观照自检 \u2550\u2550\u2550\n");
  const mod = require(SRC);
  const handle = await mod.start({ port: 0, host: "127.0.0.1", mode: "passthrough" });
  const port = handle.port;
  try {
    // [1] 初始 ping:LS 从未发流 → ls_last_req_at===0 · ls_idle_s 为有限数(≈uptime)
    const p1 = await get(port, "/origin/ping");
    ok(p1 && p1.ok === true, "ping.ok=true");
    ok(p1.ls_last_req_at === 0, "初始 ls_last_req_at===0 (LS 尚未发流)");
    ok(
      typeof p1.ls_idle_s === "number" && Number.isFinite(p1.ls_idle_s),
      "ls_idle_s 为有限数字 (看门狗可读)",
    );

    // [2] 控制面再 ping 一次(隔 ~1.1s):/origin/ping 不算 LS 流量 → idle 继续增长
    await sleep(1100);
    const p2 = await get(port, "/origin/ping");
    ok(
      p2.ls_last_req_at === 0,
      "两次 /origin/ping 后 ls_last_req_at 仍为 0 (控制面不算 LS 心跳)",
    );
    ok(
      p2.ls_idle_s >= p1.ls_idle_s,
      `ls_idle_s 随时间增长 (${p1.ls_idle_s}\u2192${p2.ls_idle_s}) · wedge 判据成立`,
    );

    // [3] 真 LS→上游 请求 → 刷新心跳戳 → idle 归零
    await fireLsTraffic(port);
    await sleep(150);
    const p3 = await get(port, "/origin/ping");
    ok(p3.ls_last_req_at > 0, "真 LS 流量后 ls_last_req_at>0 (心跳戳已刷新)");
    ok(
      p3.ls_idle_s <= 2,
      `真 LS 流量后 ls_idle_s 归零 (=${p3.ls_idle_s}) · 心跳恢复`,
    );
  } finally {
    try {
      await handle.close();
    } catch {}
  }

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILED"} · pass=${passed} fail=${failed}\n`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error("SELFTEST ERROR:", e && e.stack ? e.stack : e);
  process.exit(1);
});
