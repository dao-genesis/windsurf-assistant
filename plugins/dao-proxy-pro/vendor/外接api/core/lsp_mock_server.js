"use strict";
const http = require("http");
function readAll(s) {
  return new Promise((r, j) => {
    const c = [];
    s.on("data", (d) => c.push(d));
    s.on("end", () => r(Buffer.concat(c)));
    s.on("error", j);
  });
}
class MockLLM {
  constructor() {
    this.server = null;
    this.port = 0;
    this.sc = new Map();
    this._tc = 0;
  }
  register(n, r) {
    this.sc.set(n, r);
  }
  async start() {
    return new Promise((r, j) => {
      this.server = http.createServer((q, s) => this._h(q, s));
      this.server.listen(0, "127.0.0.1", () => {
        this.port = this.server.address().port;
        r(this.port);
      });
      this.server.on("error", j);
    });
  }
  async stop() {
    if (this.server) return new Promise((r) => this.server.close(() => r()));
  }
  async _h(q, s) {
    const b = await readAll(q);
    let o;
    try {
      o = JSON.parse(b);
    } catch {
      o = {};
    }
    const tools = this._extractTools(o);
    const msg = this._lu(o);
    const hasToolResult = (o.messages || []).some((x) => x.role === "tool");
    const sc = hasToolResult
      ? this.sc.get("after_tool_result") || this.sc.get("default")
      : this._m(msg, tools);
    if (q.url?.includes("/v1/messages")) this._ant(s, sc, tools);
    else this._oai(s, sc, tools);
  }
  _extractTools(o) {
    return (o.tools || [])
      .map((t) => {
        const fn = t.function || t;
        return fn.name || t.name || "";
      })
      .filter(Boolean);
  }
  _lu(o) {
    const m = o.messages || [];
    for (let i = m.length - 1; i >= 0; i--)
      if (m[i].role === "user")
        return typeof m[i].content === "string" ? m[i].content : "";
    return "";
  }
  _m(msg, tools) {
    const sc = this.sc;
    // ★ 匹配优先级: 更具体的模式在前 · 通用模式在后
    //   1. trajectory → 在 search 之前
    //   2. code_search → 在 search 之前
    //   3. search_web → 在通用 grep/search 之前
    //   4. read_url/read_notebook/read_resource → 在 read_file 之前
    //   5. deploy_web/deploy_config/deploy_status → 在通用之前
    //   6. grep/search 通用 → 在所有具体 search 模式之后
    if (/trajectory/i.test(msg) && sc.has("trajectory_search"))
      return sc.get("trajectory_search");
    if (/code.*search|search.*code/i.test(msg) && sc.has("code_search"))
      return sc.get("code_search");
    if (/search.*web|web.*search/i.test(msg) && sc.has("search_web"))
      return sc.get("search_web");
    if (/deploy.*web|web.*app.*deploy/i.test(msg) && sc.has("deploy_web_app"))
      return sc.get("deploy_web_app");
    if (
      /deployment.*config|read.*deployment/i.test(msg) &&
      sc.has("read_deployment_config")
    )
      return sc.get("read_deployment_config");
    if (
      /deploy.*status|check.*deploy/i.test(msg) &&
      sc.has("check_deploy_status")
    )
      return sc.get("check_deploy_status");
    if (/multi.*tool/i.test(msg) && sc.has("multi_tool"))
      return sc.get("multi_tool");
    if (/think|analyze/i.test(msg) && sc.has("thinking"))
      return sc.get("thinking");
    if (/ask.*user|which.*framework/i.test(msg) && sc.has("ask_user_question"))
      return sc.get("ask_user_question");
    if (/save.*memory|create.*memory/i.test(msg) && sc.has("create_memory"))
      return sc.get("create_memory");
    if (/view.*chunk|content.*chunk/i.test(msg) && sc.has("view_content_chunk"))
      return sc.get("view_content_chunk");
    if (/edit.*notebook|notebook.*cell/i.test(msg) && sc.has("edit_notebook"))
      return sc.get("edit_notebook");
    // ★ read_url/read_notebook/read_resource 在 read_file 之前
    if (
      /read.*url|url.*content|read.*content.*from.*http/i.test(msg) &&
      sc.has("read_url_content")
    )
      return sc.get("read_url_content");
    if (/read.*notebook/i.test(msg) && sc.has("read_notebook"))
      return sc.get("read_notebook");
    if (/read.*resource|mcp.*resource/i.test(msg) && sc.has("read_resource"))
      return sc.get("read_resource");
    if (/command.*status|check.*command/i.test(msg) && sc.has("command_status"))
      return sc.get("command_status");
    if (
      /browser.*preview|preview.*browser/i.test(msg) &&
      sc.has("browser_preview")
    )
      return sc.get("browser_preview");
    // ★ grep/search 通用匹配 · 在所有具体 search 模式之后
    if (/grep|search/i.test(msg) && sc.has("grep_search"))
      return sc.get("grep_search");
    if (/todo|task.*list/i.test(msg) && sc.has("todo_list"))
      return sc.get("todo_list");
    if (/read.*file/i.test(msg) && sc.has("read_file"))
      return sc.get("read_file");
    if (/edit.*file/i.test(msg) && sc.has("edit")) return sc.get("edit");
    if (/write.*file/i.test(msg) && sc.has("write_to_file"))
      return sc.get("write_to_file");
    if (/find.*file|find.*name/i.test(msg) && sc.has("find_by_name"))
      return sc.get("find_by_name");
    if (/list.*dir/i.test(msg) && sc.has("list_dir")) return sc.get("list_dir");
    if (/run.*command/i.test(msg) && sc.has("run_command"))
      return sc.get("run_command");
    return sc.get("default");
  }
  _makeToolCalls(sc, tools) {
    if (!sc.toolCalls) return [];
    return sc.toolCalls.map((tc) => {
      // 场景中的工具名如果在可用工具列表中，直接使用
      if (tools.includes(tc.name)) return tc;
      // 否则尝试标准名→别名映射
      const _STD_TO_ALIAS = {
        read_file: "Read",
        edit: "Edit",
        write_to_file: "Write",
        list_dir: "ListDir",
        grep_search: "Grep",
        run_command: "bash",
        find_by_name: "FindByName",
        code_search: "CodeSearch",
      };
      const alias = _STD_TO_ALIAS[tc.name];
      if (alias && tools.includes(alias))
        return {
          id: tc.id || `tc_${++this._tc}`,
          name: alias,
          arguments: tc.arguments || "{}",
        };
      // 兜底: 使用第一个匹配的工具
      return tc;
    });
  }
  _oai(res, sc, tools) {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    const id = `s${Date.now()}`,
      mo = sc.model || "deepseek-reasoner";
    const tcs = this._makeToolCalls(sc, tools);
    if (sc.thinking)
      res.write(
        `data:${JSON.stringify({ id, model: mo, choices: [{ delta: { reasoning_content: sc.thinking } }] })}\n\n`,
      );
    if (sc.text)
      res.write(
        `data:${JSON.stringify({ id, model: mo, choices: [{ delta: { role: "assistant", content: sc.text } }] })}\n\n`,
      );
    if (tcs.length)
      for (let i = 0; i < tcs.length; i++) {
        const t = tcs[i];
        res.write(
          `data:${JSON.stringify({ id, model: mo, choices: [{ delta: { tool_calls: [{ index: i, id: t.id, type: "function", function: { name: t.name, arguments: t.arguments || "{}" } }] } }] })}\n\n`,
        );
      }
    res.write(
      `data:${JSON.stringify({ id, model: mo, choices: [{ delta: {}, finish_reason: tcs.length ? "tool_calls" : "stop" }] })}\n\n`,
    );
    res.write("data:[DONE]\n\n");
    res.end();
  }
  _ant(res, sc, tools) {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(
      `event:message_start\ndata:${JSON.stringify({ type: "message_start", message: { id: `m${Date.now()}`, role: "assistant", content: [], model: sc.model || "claude-sonnet-4-20250514", stop_reason: null, usage: { input_tokens: 100 } } })}\n\n`,
    );
    let i = 0;
    if (sc.thinking) {
      res.write(
        `event:content_block_start\ndata:${JSON.stringify({ type: "content_block_start", index: i, content_block: { type: "thinking", thinking: sc.thinking } })}\n\n`,
      );
      res.write(
        `event:content_block_stop\ndata:${JSON.stringify({ type: "content_block_stop", index: i })}\n\n`,
      );
      i++;
    }
    if (sc.text) {
      res.write(
        `event:content_block_start\ndata:${JSON.stringify({ type: "content_block_start", index: i, content_block: { type: "text", text: sc.text } })}\n\n`,
      );
      res.write(
        `event:content_block_stop\ndata:${JSON.stringify({ type: "content_block_stop", index: i })}\n\n`,
      );
      i++;
    }
    const tcs = this._makeToolCalls(sc, tools);
    if (tcs.length)
      for (const t of tcs) {
        const inp = JSON.parse(t.arguments || "{}");
        res.write(
          `event:content_block_start\ndata:${JSON.stringify({ type: "content_block_start", index: i, content_block: { type: "tool_use", id: t.id, name: t.name, input: inp } })}\n\n`,
        );
        res.write(
          `event:content_block_stop\ndata:${JSON.stringify({ type: "content_block_stop", index: i })}\n\n`,
        );
        i++;
      }
    res.write(
      `event:message_delta\ndata:${JSON.stringify({ type: "message_delta", delta: { stop_reason: tcs.length ? "tool_use" : "end_turn" }, usage: { output_tokens: 50 } })}\n\n`,
    );
    res.write(
      `event:message_stop\ndata:${JSON.stringify({ type: "message_stop" })}\n\n`,
    );
    res.end();
  }
}
module.exports = MockLLM;
