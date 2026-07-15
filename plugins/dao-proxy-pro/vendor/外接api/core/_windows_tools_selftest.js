"use strict";
/**
 * _windows_tools_selftest.js · Windows Agent 原生工具层自测 · 零依赖
 * 用法: node vendor/外接api/core/_windows_tools_selftest.js
 */
const http = require("http");
const wt = require("./windows_tools");

let pass = 0,
  fail = 0;
function t(name, cond) {
  if (cond) {
    pass++;
    console.log("  ✓ " + name);
  } else {
    fail++;
    console.log("  ✗ " + name);
  }
}

async function main() {
  // 1. 工具定义与官方同格
  const defs = wt.defs();
  t("defs: 18 个工具", defs.length === 18);
  t(
    "defs: 全部 windows_ 前缀",
    defs.every((d) => d.name.startsWith("windows_")),
  );
  t(
    "defs: JSON Schema 2020-12 同格",
    defs.every(
      (d) =>
        d.parameters &&
        d.parameters.$schema === "https://json-schema.org/draft/2020-12/schema" &&
        d.parameters.type === "object",
    ),
  );
  t("has: windows_clone_plan", wt.has("windows_clone_plan"));
  t("has: 非本层工具为否", !wt.has("read_file") && !wt.has("clone_plan"));

  // 2. 启用之门(env)
  process.env.DAO_WINDOWS_TOOLS = "1";
  t("gate: env DAO_WINDOWS_TOOLS=1 → enabled", wt.enabled());

  // 3. mock 桥 → 执行回环
  const srv = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/health") return res.end(JSON.stringify({ ok: true }));
      if (req.url === "/api/apps")
        return res.end(JSON.stringify({ apps: ["freecad", "kicad"] }));
      if (req.url === "/api/session.list")
        return res.end(JSON.stringify({ sessions: [{ session_id: "vm_1", apps: ["freecad"] }] }));
      if (req.url === "/api/capabilities")
        return res.end(JSON.stringify({ universal: [], domain: [], mode: "primary" }));
      if (req.url === "/api/mode.list")
        return res.end(JSON.stringify({ modes: [{ mode_id: "primary" }, { mode_id: "coding" }], current: "primary" }));
      if (req.url === "/api/mode.set") {
        const b = JSON.parse(body || "{}");
        return res.end(JSON.stringify({ current: { mode_id: b.mode }, allowed_apps: [] }));
      }
      if (req.url === "/api/route") {
        const b = JSON.parse(body || "{}");
        return res.end(JSON.stringify({ targets: ["freecad"], layer: "domain", clean_text: b.text }));
      }
      if (req.url === "/api/account.list")
        return res.end(JSON.stringify({ ok: true, accounts: [{ name: "dao" }] }));
      if (req.url === "/api/account.sessions")
        return res.end(JSON.stringify({ ok: true, sessions: [] }));
      if (req.url === "/api/clone.plan") {
        const b = JSON.parse(body || "{}");
        return res.end(
          JSON.stringify({ app_id: b.app_id, clone_id: b.clone_id, tier: "session" }),
        );
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "nf" }));
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  process.env.DAO_WIN_BRIDGE_URL = "http://127.0.0.1:" + srv.address().port;

  const apps = JSON.parse(await wt.execute("windows_list_apps", "{}"));
  t("execute: list_apps 经桥返回", Array.isArray(apps.apps) && apps.apps.length === 2);

  const plan = JSON.parse(
    await wt.execute(
      "windows_clone_plan",
      JSON.stringify({ app_id: "kicad", clone_id: "c1" }),
    ),
  );
  t("execute: clone_plan 透传参数", plan.app_id === "kicad" && plan.clone_id === "c1");

  const sl = JSON.parse(await wt.execute("windows_session_list", "{}"));
  t("execute: session_list 列会话", Array.isArray(sl.sessions) && sl.sessions[0].session_id === "vm_1");

  const cap = JSON.parse(await wt.execute("windows_capabilities", "{}"));
  t("execute: capabilities 返回清单", cap.mode === "primary");

  const ml = JSON.parse(await wt.execute("windows_mode_list", "{}"));
  t("execute: mode_list 列模式", ml.current === "primary" && ml.modes.length === 2);

  const ms = JSON.parse(await wt.execute("windows_mode_set", '{"mode":"coding"}'));
  t("execute: mode_set 切模式", ms.current.mode_id === "coding");

  const rt = JSON.parse(await wt.execute("windows_route", '{"text":"@freecad 建模"}'));
  t("execute: route @调度", rt.targets[0] === "freecad" && rt.layer === "domain");

  const al = JSON.parse(await wt.execute("windows_account_list", "{}"));
  t("execute: account_list 列账号", al.ok === true && al.accounts[0].name === "dao");

  const as = JSON.parse(await wt.execute("windows_account_sessions", "{}"));
  t("execute: account_sessions 列会话", as.ok === true && Array.isArray(as.sessions));

  const unk = JSON.parse(await wt.execute("windows_nope", "{}"));
  t("execute: 未知工具返回 error", unk.status === "error");

  const nf = JSON.parse(await wt.execute("windows_search_verbs", '{"query":"x"}'));
  t("execute: 桥 4xx → error 不抛", nf.status === "error");

  // 4. mock 隧道 → 输入租约(人先于 Agent · 动手即抢占)
  const arb = { holder: null };
  const tun = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    res.setHeader("content-type", "application/json");
    if (u.pathname !== "/input") { res.statusCode = 404; return res.end("{}"); }
    const op = u.searchParams.get("op");
    const owner = u.searchParams.get("owner");
    const kind = u.searchParams.get("kind") || "agent";
    if (op === "acquire") {
      if (arb.holder && arb.holder.owner !== owner && arb.holder.kind === "human" && kind === "agent")
        return res.end(JSON.stringify({ ok: true, granted: false, holder: arb.holder }));
      arb.holder = { owner, kind };
      return res.end(JSON.stringify({ ok: true, granted: true, holder: arb.holder }));
    }
    if (op === "release") {
      if (arb.holder && arb.holder.owner === owner) arb.holder = null;
      return res.end(JSON.stringify({ ok: true, released: true }));
    }
    res.end("{}");
  });
  await new Promise((r) => tun.listen(0, "127.0.0.1", r));
  process.env.DAO_WIN_TUNNEL_URL = "http://127.0.0.1:" + tun.address().port;

  const g1 = JSON.parse(
    await wt.execute("windows_input_acquire", JSON.stringify({ clone_key: "account:dao#1", owner: "agent:cascade" })),
  );
  t("input: agent 取得租约", g1.granted === true);
  arb.holder = { owner: "human:u", kind: "human" };
  const g2 = JSON.parse(
    await wt.execute("windows_input_acquire", JSON.stringify({ clone_key: "account:dao#1", owner: "agent:cascade" })),
  );
  t("input: 人手持有时 agent 不得(让位)", g2.granted === false && g2.holder.kind === "human");
  arb.holder = { owner: "agent:cascade", kind: "agent" };
  const rl = JSON.parse(
    await wt.execute("windows_input_release", JSON.stringify({ clone_key: "account:dao#1", owner: "agent:cascade" })),
  );
  t("input: 释放归还", rl.released === true && arb.holder === null);

  const miss = JSON.parse(await wt.execute("windows_input_acquire", "{}"));
  t("input: 缺 clone_key/owner 即客户端明确报错(不打空参到隧道)", miss.status === "error" && /clone_key/.test(miss.error));
  tun.close();

  srv.close();
  console.log(`\n  通过 ${pass} · 失败 ${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("致命错误: " + e.message);
  process.exit(2);
});
