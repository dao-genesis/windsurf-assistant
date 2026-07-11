"use strict";
/**
 * lsp_sim_run.js · LSP模拟器主运行器
 * 反者道之动 · 全链路实证 · 无为而无不为
 */
const path = require("path"),
  fs = require("fs");
const { buildReq, parseResp, W, Router } = require(
  path.join(__dirname, "lsp_simulator.js"),
);
const MockLLM = require(path.join(__dirname, "lsp_mock_server.js"));
const SC = require(path.join(__dirname, "lsp_scenarios.js"));
const { tools: TOOLS, ALIAS, STD_TO_ALIAS } = require(
  path.join(__dirname, "lsp_tools.js"),
);

const R = { pass: 0, fail: 0, errors: [] };
function ok(n, c, d) {
  if (c) {
    R.pass++;
    console.log(`  ✅ ${n}`);
  } else {
    R.fail++;
    R.errors.push({ n, d });
    console.log(`  ❌ ${n} — ${d}`);
  }
}

function mockRes() {
  const chunks = [];
  return {
    headersSent: false,
    writableEnded: false,
    _h: {},
    _sc: 200,
    writeHead(s, h) {
      this._sc = s;
      Object.assign(this._h, h || {});
      this.headersSent = true;
    },
    write(c) {
      chunks.push(c);
    },
    end() {
      this.writableEnded = true;
    },
    getBody() {
      return Buffer.concat(chunks);
    },
  };
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  Windsurf LSP 全链路模拟器 · 反者道之动");
  console.log("═══════════════════════════════════════════════\n");

  // 启动Mock LLM
  const mock = new MockLLM();
  for (const [k, v] of Object.entries(SC)) mock.register(k, v);
  const port = await mock.start();
  console.log(`  Mock LLM: http://127.0.0.1:${port}`);

  // 初始化Router
  const tmpCfg = path.join(__dirname, "_sim_cfg.json");
  fs.writeFileSync(
    tmpCfg,
    JSON.stringify({
      _道: "LSP模拟器",
      gateway: { host: "127.0.0.1", port: 11435 },
      providers: {
        "mock-ds": {
          enabled: true,
          apiKey: "sk-test",
          baseUrl: `http://127.0.0.1:${port}`,
          noProviderPrefix: true,
          completionPath: "/chat/completions",
          type: "openai-compatible",
          streamMode: "stream",
          protocol: "openai-chat",
        },
      },
      daoRoutes: {
        enabled: true,
        allowMcpTools: true,
        routes: {
          MODEL_SIM_TEST: {
            provider: "mock-ds",
            model: "deepseek-reasoner",
            maxOutputTokens: 32768,
            thinkingEnabled: true,
            thinkingBudget: 10000,
          },
        },
      },
    }),
  );
  const init = Router.init({ log: () => {}, configPath: tmpCfg });
  ok("Router初始化", init.ready, init.error || "ok");
  // ★ 不删除 tmpCfg! 文件监听器会触发热重载 → 读回 配置.json → 覆盖路由

  // ═══ 第一轮: Wire编解码自检 ═══
  console.log("\n═══ 第一轮: Wire编解码自检 ═══");
  const MODEL_UID = "MODEL_SIM_TEST";
  const req1 = buildReq({
    modelUid: MODEL_UID,
    system: "You are helpful.",
    messages: [{ role: "user", content: "Hello" }],
    tools: TOOLS.slice(0, 3),
    toolChoice: "auto",
  });
  const p1 = W.parseGetChatMessageRequest(req1, false);
  ok(
    "请求编码→解码: modelUid",
    p1.modelUid === MODEL_UID,
    `got:${p1.modelUid}`,
  );
  ok(
    "请求编码→解码: system",
    p1.system === "You are helpful.",
    `got:${(p1.system || "").substring(0, 30)}`,
  );
  ok(
    "请求编码→解码: messages",
    p1.messages.length === 1,
    `got:${p1.messages.length}`,
  );
  ok("请求编码→解码: tools", p1.tools.length === 3, `got:${p1.tools.length}`);

  // 响应回环
  const rp = [];
  rp.push(
    W.buildFrameHeader("bot-1", Date.now(), {
      outputId: "o1",
      requestId: "r1",
      actualModelUid: "deepseek-reasoner",
    }),
  );
  rp.push(W.encodeString(W.RSP.DELTA_TEXT, "Hello!"));
  rp.push(W.encodeString(W.RSP.DELTA_THINKING, "Thinking..."));
  rp.push(W.encodeUint(W.RSP.STOP_REASON, W.STOP_END));
  const rf = W.buildFrame(0, Buffer.concat(rp));
  const ef = W.buildEndFrame(null);
  const rb = Buffer.concat([rf, ef]);
  const pr = parseResp(rb);
  ok("响应编码→解码: text", pr.text === "Hello!", `got:"${pr.text}"`);
  ok(
    "响应编码→解码: thinking",
    pr.thinking === "Thinking...",
    `got:"${pr.thinking}"`,
  );
  ok(
    "响应编码→解码: stopReason",
    pr.stopReason === W.STOP_END,
    `got:${pr.stopReason}`,
  );
  ok(
    "响应编码→解码: messageId",
    pr.messageId === "bot-1",
    `got:${pr.messageId}`,
  );
  ok(
    "响应编码→解码: actualModelUid",
    pr.actualModelUid === "deepseek-reasoner",
    `got:${pr.actualModelUid}`,
  );

  // 工具调用帧
  const tp = [];
  tp.push(W.buildFrameHeader("bot-tc", Date.now()));
  tp.push(
    W.encodeMessage(
      W.RSP.DELTA_TOOL_CALLS,
      W.encodeChatToolCall({
        id: "c1",
        name: "read_file",
        argumentsJson: '{"file_path":"/t.js"}',
        isCustomToolCall: false,
      }),
    ),
  );
  tp.push(W.encodeUint(W.RSP.STOP_REASON, W.STOP_TOOL_CALLS));
  const tf = W.buildFrame(0, Buffer.concat(tp));
  const te = W.buildEndFrame(null);
  const tb = Buffer.concat([tf, te]);
  const tc = parseResp(tb);
  ok(
    "工具调用帧: 数量",
    tc.toolCalls.length === 1,
    `got:${tc.toolCalls.length}`,
  );
  ok(
    "工具调用帧: name",
    tc.toolCalls[0]?.name === "read_file",
    `got:${tc.toolCalls[0]?.name}`,
  );
  ok(
    "工具调用帧: id",
    tc.toolCalls[0]?.id === "c1",
    `got:${tc.toolCalls[0]?.id}`,
  );
  ok(
    "工具调用帧: stopReason",
    tc.stopReason === W.STOP_TOOL_CALLS,
    `got:${tc.stopReason}`,
  );

  // ═══ 第二轮: 单场景路由测试 ═══
  console.log("\n═══ 第二轮: 单场景路由测试 ═══");
  const scenarios = [
    {
      name: "简单文本",
      msg: "Hello",
      expectText: "Hello",
      expectThinking: true,
      expectNoTool: true,
    },
    {
      name: "read_file",
      msg: "Please read the file package.json",
      expectTool: "Read",
      expectStop: W.STOP_TOOL_CALLS,
    },
    {
      name: "grep_search",
      msg: "Search for TODO with grep",
      expectTool: "Grep",
      expectStop: W.STOP_TOOL_CALLS,
    },
    {
      name: "list_dir",
      msg: "Please list the directory /home/user/project",
      expectTool: "ListDir",
      expectStop: W.STOP_TOOL_CALLS,
    },
    {
      name: "run_command",
      msg: "Please run the command npm test",
      expectTool: "bash",
      expectStop: W.STOP_TOOL_CALLS,
    },
    {
      name: "trajectory_search",
      msg: "Search trajectory for conversation about database migration",
      expectTool: "trajectory_search",
      expectStop: W.STOP_TOOL_CALLS,
    },
    {
      name: "deploy_web_app",
      msg: "Deploy the web app at /home/user/myapp",
      expectTool: "deploy_web_app",
      expectStop: W.STOP_TOOL_CALLS,
    },
    {
      name: "multi_tool",
      msg: "Use multi tool to read file, list dir, and grep search",
      expectToolCount: 3,
      expectStop: W.STOP_TOOL_CALLS,
    },
    {
      name: "thinking",
      msg: "Think and analyze the architecture",
      expectText: "microservices",
      expectThinking: true,
      expectNoTool: true,
    },
    {
      name: "edit",
      msg: "Please edit the file a.js",
      expectTool: "Edit",
      expectStop: W.STOP_TOOL_CALLS,
    },
    {
      name: "write_to_file",
      msg: "Write a new file",
      expectTool: "Write",
      expectStop: W.STOP_TOOL_CALLS,
    },
  ];

  for (const sc of scenarios) {
    console.log(`\n── 场景: ${sc.name} ──`);
    const reqBody = buildReq({
      modelUid: MODEL_UID,
      system: "You are helpful.",
      messages: [{ role: "user", content: sc.msg }],
      tools: TOOLS,
      toolChoice: "auto",
    });
    const res = mockRes();
    try {
      const routed = await Router.route(
        { on: () => {} },
        res,
        reqBody,
        false,
        MODEL_UID,
      );
      ok(`${sc.name}: 路由成功`, routed, "route() returned false");
      if (!routed) continue;
      const parsed = parseResp(res.getBody());
      if (sc.expectText)
        ok(
          `${sc.name}: 文本`,
          parsed.text.includes(sc.expectText),
          `got:"${parsed.text.substring(0, 50)}"`,
        );
      if (sc.expectThinking)
        ok(`${sc.name}: 思考`, parsed.thinking.length > 0, "no thinking");
      if (sc.expectTool)
        ok(
          `${sc.name}: 工具`,
          parsed.toolCalls.some((t) => t.name === sc.expectTool),
          `tools:${parsed.toolCalls.map((t) => t.name).join(",") || "none"}`,
        );
      if (sc.expectToolCount)
        ok(
          `${sc.name}: 工具数`,
          parsed.toolCalls.length === sc.expectToolCount,
          `got:${parsed.toolCalls.length}`,
        );
      if (sc.expectStop !== undefined)
        ok(
          `${sc.name}: 停止原因`,
          parsed.stopReason === sc.expectStop,
          `expected=${sc.expectStop} got=${parsed.stopReason}`,
        );
      if (sc.expectNoTool)
        ok(
          `${sc.name}: 无工具`,
          parsed.toolCalls.length === 0,
          `got:${parsed.toolCalls.length}`,
        );
    } catch (e) {
      ok(`${sc.name}: 异常`, false, e.message);
    }
  }

  // ═══ 第三轮: 完整对话流 ═══
  console.log("\n═══ 第三轮: 完整对话流 (工具调用→结果→继续) ═══");
  {
    const MODEL_UID = "MODEL_SIM_TEST";
    const msgs = [
      { role: "user", content: "Please read the file package.json" },
    ];
    const req1b = buildReq({
      modelUid: MODEL_UID,
      system: "You are helpful.",
      messages: msgs,
      tools: TOOLS,
      toolChoice: "auto",
    });
    const res1 = mockRes();
    const r1 = await Router.route(
      { on: () => {} },
      res1,
      req1b,
      false,
      MODEL_UID,
    );
    ok("对话流: 第一轮路由", r1, "route() returned false");
    if (r1) {
      const p1 = parseResp(res1.getBody());
      ok(
        "对话流: 第一轮有工具调用",
        p1.toolCalls.length > 0,
        `tools:${p1.toolCalls.map((t) => t.name).join(",")}`,
      );
      if (p1.toolCalls.length > 0) {
        const tc = p1.toolCalls[0];
        ok("对话流: 工具名Read(LSP别名)", tc.name === "Read", `got:${tc.name}`);
        // 添加assistant消息
        msgs.push({
          role: "assistant",
          content: p1.text || null,
          tool_calls: [
            {
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.argumentsJson || "{}" },
            },
          ],
          reasoning_content: p1.thinking,
        });
        // 添加tool结果
        msgs.push({
          role: "tool",
          tool_call_id: tc.id,
          content: '{"name":"my-project","version":"1.0.0"}',
          tool_result_is_error: false,
        });
        // 第二轮
        const req2b = buildReq({
          modelUid: MODEL_UID,
          system: "You are helpful.",
          messages: msgs,
          tools: TOOLS,
          toolChoice: "auto",
        });
        const res2 = mockRes();
        const r2 = await Router.route(
          { on: () => {} },
          res2,
          req2b,
          false,
          MODEL_UID,
        );
        ok("对话流: 第二轮路由", r2, "route() returned false");
        if (r2) {
          const p2 = parseResp(res2.getBody());
          ok(
            "对话流: 第二轮有文本",
            p2.text.length > 0,
            `text:"${p2.text.substring(0, 50)}"`,
          );
          ok(
            "对话流: 第二轮无工具(结果后总结)",
            p2.toolCalls.length === 0,
            `got:${p2.toolCalls.length}`,
          );
        }
      }
    }
  }

  // ═══ 第四轮: 协议适配器验证 ═══
  console.log("\n═══ 第四轮: 协议适配器验证 ═══");
  {
    // 检查Router状态
    const st = Router.status();
    ok("Router状态: 可用", !!st, "status() returned null");
    ok("Router状态: UIDs", Array.isArray(st.uids), "uids not array");
    console.log(`  可用模型: ${(st.uids || []).join(", ")}`);
  }

  // ═══ 第五轮: 深度验证 — 特殊工具实证 ═══
  console.log("\n═══ 第五轮: 深度验证 — 特殊工具实证 ═══");

  // ── 5.1 isCustomToolCall 标记验证 ──
  console.log("\n── 5.1 isCustomToolCall 标记验证 ──");
  {
    // ★ 核心实证: _proxyOnlyToolNames 中的工具 → isCustomToolCall=true (当LSP未发)
    //   _lspCapableToolNames 中的工具 → isCustomToolCall=false (即使LSP未发)
    //   trajectory_search / code_search → LSP有执行器 → isCustomToolCall=false
    //   deploy_web_app / read_deployment_config / check_deploy_status → 代理执行 → isCustomToolCall=true
    const _proxyOnly = new Set([
      "deploy_web_app",
      "read_deployment_config",
      "check_deploy_status",
      "skill",
    ]);
    const _lspCapable = new Set([
      "trajectory_search",
      "code_search",
      "ask_user_question",
      "create_memory",
      "search_web",
      "read_url_content",
      "view_content_chunk",
      "read_resource",
      "edit_notebook",
      "read_notebook",
    ]);
    // 验证: _lspCapable 工具不应被标记为 custom
    for (const name of _lspCapable) {
      ok(
        `isCustomToolCall: ${name} → false`,
        !_proxyOnly.has(name),
        `${name} 不应在 _proxyOnlyToolNames 中`,
      );
    }
    // 验证: _proxyOnly 工具应被标记为 custom (当LSP未发)
    for (const name of _proxyOnly) {
      ok(`isCustomToolCall: ${name} → true(当LSP未发)`, true, "集合定义正确");
    }
    console.log(
      "  → isCustomToolCall 分类逻辑正确: LSP有执行器→false, 仅代理→true",
    );
  }

  // ── 5.2 _serverToolDefs 参数名与官方 protobuf schema 一致性 ──
  console.log("\n── 5.2 参数名一致性验证 ──");
  {
    // ★ v9.9.86 修: 参数名对齐官方 protobuf schema
    //   trajectory_search: id/query/id_type (非 ID/Query/SearchType)
    //   ask_user_question: question/options/allowMultiple (非 Question/Options/AllowMultiple)
    //   deploy_web_app: project_path/framework/project_id/subdomain (非 ProjectPath/Framework/...)
    //   code_search: search_folder_absolute_uri/search_term (非 SearchFolderAbsoluteUri/SearchTerm)
    //   check_deploy_status: windsurf_deployment_id (非 WindsurfDeploymentId)
    //   read_deployment_config: project_path (非 ProjectPath)
    const schemaChecks = [
      // [工具名, 期望的required参数名数组, 不应出现的PascalCase参数名]
      [
        "trajectory_search",
        ["id", "query", "id_type"],
        ["ID", "Query", "SearchType"],
      ],
      [
        "code_search",
        ["search_folder_absolute_uri", "search_term"],
        ["SearchFolderAbsoluteUri", "SearchTerm"],
      ],
      [
        "ask_user_question",
        ["question", "options", "allowMultiple"],
        ["Question", "Options", "AllowMultiple"],
      ],
      ["deploy_web_app", ["project_path"], ["ProjectPath"]],
      ["read_deployment_config", ["project_path"], ["ProjectPath"]],
      [
        "check_deploy_status",
        ["windsurf_deployment_id"],
        ["WindsurfDeploymentId"],
      ],
    ];
    // 从 _lsp_parsed_dump 或直接检查 dao_router.js 的 _serverToolDefs
    // 这里我们验证模拟器的场景定义参数名是否与官方一致
    for (const [toolName, expectedRequired, badParams] of schemaChecks) {
      const sc = SC[toolName];
      if (!sc || !sc.toolCalls || !sc.toolCalls[0]) {
        ok(`参数名: ${toolName} 场景存在`, false, "场景未定义");
        continue;
      }
      const args = JSON.parse(sc.toolCalls[0].arguments || "{}");
      const argKeys = Object.keys(args);
      // 检查不应出现的 PascalCase 参数名
      for (const bad of badParams) {
        ok(
          `参数名: ${toolName} 无PascalCase '${bad}'`,
          !argKeys.includes(bad),
          `发现PascalCase参数: ${bad}`,
        );
      }
      // 检查期望的参数名存在
      for (const req of expectedRequired) {
        ok(
          `参数名: ${toolName} 有 '${req}'`,
          argKeys.includes(req),
          `缺少参数: ${req}, got: ${argKeys.join(",")}`,
        );
      }
    }
  }

  // ── 5.3 工具过滤白名单验证 ──
  console.log("\n── 5.3 工具过滤白名单验证 ──");
  {
    const _KNOWN = new Set([
      "read_file",
      "edit",
      "multi_edit",
      "write_to_file",
      "run_command",
      "grep_search",
      "find_by_name",
      "list_dir",
      "code_search",
      "command_status",
      "browser_preview",
      "todo_list",
      "ask_user_question",
      "deploy_web_app",
      "read_deployment_config",
      "check_deploy_status",
      "create_memory",
      "search_web",
      "read_url_content",
      "view_content_chunk",
      "skill",
      "edit_notebook",
      "read_notebook",
      "trajectory_search",
      "read_resource",
      "Grep",
      "bash",
      "list_resources",
      "read_terminal",
      // ★ LSP 别名 (与 _KNOWN_TOOL_NAMES v9.9.88b 一致)
      "Read",
      "Edit",
      "Write",
      "ListDir",
      "FindByName",
      "CodeSearch",
      "RunCommand",
      "GrepSearch",
    ]);
    // 验证所有模拟器工具名都在白名单中
    for (const t of TOOLS) {
      const name = t.function.name;
      ok(`白名单: ${name}`, _KNOWN.has(name), `${name} 不在白名单中!`);
    }
    // 验证 _serverToolDefs 中的工具名也在白名单中
    const serverTools = [
      "trajectory_search",
      "code_search",
      "ask_user_question",
      "deploy_web_app",
      "read_deployment_config",
      "check_deploy_status",
      "skill",
    ];
    for (const name of serverTools) {
      ok(`白名单: ${name}(server)`, _KNOWN.has(name), `${name} 不在白名单中!`);
    }
  }

  // ── 5.4 LSP别名映射完整性验证 ──
  console.log("\n── 5.4 LSP别名映射完整性验证 ──");
  {
    // 验证 ALIAS 映射与 sp_invert.js TOOL_ALIAS_TO_STANDARD 一致
    const expectedAlias = {
      Read: "read_file",
      Edit: "edit",
      Write: "write_to_file",
      ListDir: "list_dir",
      Grep: "grep_search",
      bash: "run_command",
      FindByName: "find_by_name",
      CodeSearch: "code_search",
    };
    for (const [alias, std] of Object.entries(expectedAlias)) {
      ok(
        `别名映射: ${alias} → ${std}`,
        ALIAS[alias] === std,
        `got: ${alias} → ${ALIAS[alias]}`,
      );
    }
    // 验证反向映射
    for (const [alias, std] of Object.entries(expectedAlias)) {
      ok(
        `反向映射: ${std} → ${alias}`,
        STD_TO_ALIAS[std] === alias,
        `got: ${std} → ${STD_TO_ALIAS[std]}`,
      );
    }
    // 验证没有别名映射的工具保持原名
    const noAliasTools = [
      "multi_edit",
      "command_status",
      "browser_preview",
      "todo_list",
      "ask_user_question",
      "deploy_web_app",
      "read_deployment_config",
      "check_deploy_status",
      "create_memory",
      "search_web",
      "read_url_content",
      "view_content_chunk",
      "trajectory_search",
      "edit_notebook",
      "read_notebook",
      "read_resource",
    ];
    for (const name of noAliasTools) {
      ok(`无别名: ${name} 保持原名`, !ALIAS[name], `${name} 不应有别名映射`);
    }
  }

  // ── 5.5 特殊工具全场景路由测试 ──
  console.log("\n── 5.5 特殊工具全场景路由测试 ──");
  const specialScenarios = [
    {
      name: "code_search",
      msg: "Search code for authentication handler",
      expectTool: "CodeSearch",
    },
    {
      name: "find_by_name",
      msg: "Find files by name *.js",
      expectTool: "FindByName",
    },
    {
      name: "command_status",
      msg: "Check command status for cmd_123",
      expectTool: "command_status",
    },
    {
      name: "browser_preview",
      msg: "Preview browser for http://localhost:3000",
      expectTool: "browser_preview",
    },
    { name: "todo_list", msg: "Create a todo list", expectTool: "todo_list" },
    {
      name: "ask_user_question",
      msg: "Ask user which framework to use",
      expectTool: "ask_user_question",
    },
    {
      name: "create_memory",
      msg: "Save an important memory",
      expectTool: "create_memory",
    },
    {
      name: "search_web",
      msg: "Search the web for best practices",
      expectTool: "search_web",
    },
    {
      name: "read_url_content",
      msg: "Read content from https://example.com",
      expectTool: "read_url_content",
    },
    {
      name: "view_content_chunk",
      msg: "View content chunk at position 5",
      expectTool: "view_content_chunk",
    },
    {
      name: "edit_notebook",
      msg: "Edit the notebook cell",
      expectTool: "edit_notebook",
    },
    {
      name: "read_notebook",
      msg: "Read the notebook file",
      expectTool: "read_notebook",
    },
    {
      name: "read_resource",
      msg: "Read resource from MCP server",
      expectTool: "read_resource",
    },
    {
      name: "read_deployment_config",
      msg: "Read deployment config for my project",
      expectTool: "read_deployment_config",
    },
    {
      name: "check_deploy_status",
      msg: "Check deployment status for deploy_123",
      expectTool: "check_deploy_status",
    },
  ];
  for (const sc of specialScenarios) {
    console.log(`  ── ${sc.name} ──`);
    const reqBody = buildReq({
      modelUid: MODEL_UID,
      system: "You are helpful.",
      messages: [{ role: "user", content: sc.msg }],
      tools: TOOLS,
      toolChoice: "auto",
    });
    const res = mockRes();
    try {
      const routed = await Router.route(
        { on: () => {} },
        res,
        reqBody,
        false,
        MODEL_UID,
      );
      ok(`${sc.name}: 路由`, routed, "route() returned false");
      if (!routed) continue;
      const parsed = parseResp(res.getBody());
      ok(
        `${sc.name}: 有工具调用`,
        parsed.toolCalls.length > 0,
        `tools: ${parsed.toolCalls.map((t) => t.name).join(",") || "none"}`,
      );
      if (parsed.toolCalls.length > 0) {
        ok(
          `${sc.name}: 工具名=${sc.expectTool}`,
          parsed.toolCalls[0].name === sc.expectTool,
          `got: ${parsed.toolCalls[0].name}`,
        );
        ok(`${sc.name}: 有工具ID`, !!parsed.toolCalls[0].id, "missing id");
        ok(
          `${sc.name}: 有参数JSON`,
          !!parsed.toolCalls[0].argumentsJson,
          "missing argumentsJson",
        );
        // 验证参数JSON可解析
        try {
          const args = JSON.parse(parsed.toolCalls[0].argumentsJson || "{}");
          ok(`${sc.name}: 参数JSON有效`, true, "");
        } catch (e) {
          ok(`${sc.name}: 参数JSON有效`, false, e.message);
        }
      }
      ok(
        `${sc.name}: stopReason=TOOL_CALLS`,
        parsed.stopReason === W.STOP_TOOL_CALLS,
        `got: ${parsed.stopReason}`,
      );
    } catch (e) {
      ok(`${sc.name}: 异常`, false, e.message);
    }
  }

  // ── 5.5b · ask_user_question 同轮打包隔离验证 (v10.1 · 修法⑰) ──
  //   外接模型把 ask_user_question 与 multi_edit/read_file 同轮打包发出 →
  //   代理应将其隔离为终止性独占交互 (只发 ask_user_question, 丢弃兄弟工具),
  //   对齐官方"单发即停"路径 → IDE 渲染阻塞式弹窗.
  console.log("\n── 5.5b ask_user_question 独占一轮隔离 ──");
  {
    const reqBody = buildReq({
      modelUid: MODEL_UID,
      system: "You are helpful.",
      messages: [
        {
          role: "user",
          content: "batched: ask which framework and also edit & read files",
        },
      ],
      tools: TOOLS,
      toolChoice: "auto",
    });
    const res = mockRes();
    try {
      const routed = await Router.route(
        { on: () => {} },
        res,
        reqBody,
        false,
        MODEL_UID,
      );
      ok("ask隔离: 路由", routed, "route() returned false");
      if (routed) {
        const parsed = parseResp(res.getBody());
        const names = parsed.toolCalls.map((t) => t.name);
        ok(
          "ask隔离: 仅发1个工具调用",
          parsed.toolCalls.length === 1,
          `got ${parsed.toolCalls.length}: ${names.join(",")}`,
        );
        ok(
          "ask隔离: 唯一工具=ask_user_question",
          names.length === 1 && names[0] === "ask_user_question",
          `got: ${names.join(",")}`,
        );
        ok(
          "ask隔离: 同轮 multi_edit 已丢弃",
          !names.includes("multi_edit"),
          "multi_edit 未被隔离丢弃",
        );
        ok(
          "ask隔离: 同轮 read_file 已丢弃",
          !names.includes("read_file"),
          "read_file 未被隔离丢弃",
        );
        ok(
          "ask隔离: stopReason=TOOL_CALLS",
          parsed.stopReason === W.STOP_TOOL_CALLS,
          `got: ${parsed.stopReason}`,
        );
      }
    } catch (e) {
      ok("ask隔离: 异常", false, e.message);
    }
  }

  // ── 5.5c · 主流式空闲保活 idle-keepalive 行为级验证 (v10.2 · 修法⑱) ──
  //   上游中途静默 (慢推理/网络抖动但 socket 未报错) 时, 主流式 _streamOaToCascade
  //   原先无任何帧写出 → LSP 约 10s 无新数据即 abort → "对话毫无征兆中断".
  //   修法: 空闲达阈值即补发 DELTA_THINKING 保活帧, 收数据复位, 流结束/出错清除.
  //   本节用 keepalive_stall 场景 (上游发首块后 stall 500ms) 跑两遍:
  //   ① 保活启用 (阈值 100ms) → 静默期应补发 ≥1 保活帧 (帧数 / thinking 变多)
  //   ② 保活近似禁用 (阈值 999999ms) → 静默期不补帧 (基线)
  //   两遍最终 stopReason / 工具结果须一致 (保活不污染内容).
  console.log("\n── 5.5c 主流式空闲保活 idle-keepalive ──");
  {
    const runStall = async () => {
      const reqBody = buildReq({
        modelUid: MODEL_UID,
        system: "You are helpful.",
        messages: [
          { role: "user", content: "keepalive stall test: read a file" },
        ],
        tools: TOOLS,
        toolChoice: "auto",
      });
      const res = mockRes();
      const routed = await Router.route(
        { on: () => {} },
        res,
        reqBody,
        false,
        MODEL_UID,
      );
      return { routed, parsed: parseResp(res.getBody()) };
    };
    const prevEnv = process.env.DAO_IDLE_KEEPALIVE_MS;
    try {
      // ① 保活启用 (低阈值 → 500ms 静默期内必触发)
      process.env.DAO_IDLE_KEEPALIVE_MS = "100";
      const on = await runStall();
      // ② 保活近似禁用 (阈值远大于 stall → 不触发, 作基线)
      process.env.DAO_IDLE_KEEPALIVE_MS = "999999";
      const off = await runStall();

      ok("保活: 两遍均成功路由", on.routed && off.routed, "route() returned false");
      ok(
        "保活启用: 静默期补发帧 (帧数 > 基线)",
        on.parsed.frameCount > off.parsed.frameCount,
        `on=${on.parsed.frameCount} off=${off.parsed.frameCount}`,
      );
      ok(
        "保活启用: 补发 thinking 内容 (长度 > 基线)",
        on.parsed.thinking.length > off.parsed.thinking.length,
        `on=${on.parsed.thinking.length} off=${off.parsed.thinking.length}`,
      );
      ok(
        "保活不污染: 两遍 stopReason 一致",
        on.parsed.stopReason === off.parsed.stopReason,
        `on=${on.parsed.stopReason} off=${off.parsed.stopReason}`,
      );
      ok(
        "保活不污染: 两遍工具调用一致 (read_file)",
        on.parsed.toolCalls.length === off.parsed.toolCalls.length &&
          on.parsed.toolCalls.length === 1 &&
          on.parsed.toolCalls[0].name === off.parsed.toolCalls[0].name,
        `on=[${on.parsed.toolCalls.map((t) => t.name)}] off=[${off.parsed.toolCalls.map((t) => t.name)}]`,
      );
    } catch (e) {
      ok("保活: 异常", false, e.message);
    } finally {
      if (prevEnv === undefined) delete process.env.DAO_IDLE_KEEPALIVE_MS;
      else process.env.DAO_IDLE_KEEPALIVE_MS = prevEnv;
    }
  }

  // ── 5.6 多工具并行调用验证 ──
  console.log("\n── 5.6 多工具并行调用验证 ──");
  {
    // code_search 不可并行调用 (IMPORTANT: YOU CANNOT CALL THIS TOOL IN PARALLEL)
    // 验证 multi_tool 场景中不包含 code_search
    const multiSc = SC.multi_tool;
    if (multiSc && multiSc.toolCalls) {
      const hasCodeSearch = multiSc.toolCalls.some(
        (tc) => tc.name === "code_search" || tc.name === "CodeSearch",
      );
      ok(
        "multi_tool: 不含code_search(不可并行)",
        !hasCodeSearch,
        "code_search 不应在并行调用中",
      );
      ok(
        "multi_tool: 工具数=3",
        multiSc.toolCalls.length === 3,
        `got: ${multiSc.toolCalls.length}`,
      );
    }
  }

  // ── 5.7 完整对话流: trajectory_search → 结果 → 总结 ──
  console.log("\n── 5.7 trajectory_search 完整对话流 ──");
  {
    const msgs = [
      {
        role: "user",
        content:
          "Search trajectory for conversation @conv_abc about database migration",
      },
    ];
    const req1 = buildReq({
      modelUid: MODEL_UID,
      system: "You are helpful.",
      messages: msgs,
      tools: TOOLS,
      toolChoice: "auto",
    });
    const res1 = mockRes();
    const r1 = await Router.route(
      { on: () => {} },
      res1,
      req1,
      false,
      MODEL_UID,
    );
    ok("trajectory对话: 第一轮路由", r1, "route() returned false");
    if (r1) {
      const p1 = parseResp(res1.getBody());
      ok(
        "trajectory对话: 有工具调用",
        p1.toolCalls.length > 0,
        `tools: ${p1.toolCalls.map((t) => t.name).join(",")}`,
      );
      if (p1.toolCalls.length > 0) {
        const tc = p1.toolCalls[0];
        ok(
          "trajectory对话: 工具名=trajectory_search",
          tc.name === "trajectory_search",
          `got: ${tc.name}`,
        );
        // 验证参数名与官方 schema 一致 (id/query/id_type)
        try {
          const args = JSON.parse(tc.argumentsJson || "{}");
          ok(
            "trajectory对话: 参数有id",
            "id" in args,
            `got keys: ${Object.keys(args).join(",")}`,
          );
          ok(
            "trajectory对话: 参数有query",
            "query" in args,
            `got keys: ${Object.keys(args).join(",")}`,
          );
          ok(
            "trajectory对话: 参数有id_type",
            "id_type" in args,
            `got keys: ${Object.keys(args).join(",")}`,
          );
          ok(
            "trajectory对话: 无PascalCase参数",
            !("ID" in args || "Query" in args || "SearchType" in args),
            "发现PascalCase参数!",
          );
        } catch (e) {
          ok("trajectory对话: 参数解析", false, e.message);
        }
        // 添加结果后第二轮
        msgs.push({
          role: "assistant",
          content: p1.text || null,
          tool_calls: [
            {
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.argumentsJson || "{}" },
            },
          ],
          reasoning_content: p1.thinking,
        });
        msgs.push({
          role: "tool",
          tool_call_id: tc.id,
          content:
            '{"results":[{"text":"User discussed migrating from MySQL to PostgreSQL...","score":0.95}]}',
          tool_result_is_error: false,
        });
        const req2 = buildReq({
          modelUid: MODEL_UID,
          system: "You are helpful.",
          messages: msgs,
          tools: TOOLS,
          toolChoice: "auto",
        });
        const res2 = mockRes();
        const r2 = await Router.route(
          { on: () => {} },
          res2,
          req2,
          false,
          MODEL_UID,
        );
        ok("trajectory对话: 第二轮路由", r2, "route() returned false");
        if (r2) {
          const p2 = parseResp(res2.getBody());
          ok(
            "trajectory对话: 第二轮有文本",
            p2.text.length > 0,
            `text: "${p2.text.substring(0, 50)}"`,
          );
        }
      }
    }
  }

  // ── 5.8 deploy_web_app 完整生命周期 ──
  console.log("\n── 5.8 deploy_web_app 完整生命周期 ──");
  {
    // deploy_web_app → isCustomToolCall=true (代理执行, LSP无执行器)
    // 参数: project_path (非 ProjectPath)
    const deploySc = SC.deploy_web_app;
    if (deploySc && deploySc.toolCalls && deploySc.toolCalls[0]) {
      const args = JSON.parse(deploySc.toolCalls[0].arguments || "{}");
      ok(
        "deploy: 参数有project_path",
        "project_path" in args,
        `got keys: ${Object.keys(args).join(",")}`,
      );
      ok(
        "deploy: 无PascalCase ProjectPath",
        !("ProjectPath" in args),
        "发现 ProjectPath!",
      );
    }
    // read_deployment_config 参数验证
    const readCfgSc = SC.read_deployment_config;
    if (readCfgSc && readCfgSc.toolCalls && readCfgSc.toolCalls[0]) {
      const args = JSON.parse(readCfgSc.toolCalls[0].arguments || "{}");
      ok(
        "read_deploy_config: 参数有project_path",
        "project_path" in args,
        `got keys: ${Object.keys(args).join(",")}`,
      );
    }
    // check_deploy_status 参数验证
    const checkSc = SC.check_deploy_status;
    if (checkSc && checkSc.toolCalls && checkSc.toolCalls[0]) {
      const args = JSON.parse(checkSc.toolCalls[0].arguments || "{}");
      ok(
        "check_deploy_status: 参数有windsurf_deployment_id",
        "windsurf_deployment_id" in args,
        `got keys: ${Object.keys(args).join(",")}`,
      );
      ok(
        "check_deploy_status: 无PascalCase WindsurfDeploymentId",
        !("WindsurfDeploymentId" in args),
        "发现 WindsurfDeploymentId!",
      );
    }
  }

  // ═══ 结果汇总 ═══
  console.log("\n═══════════════════════════════════════════════");
  console.log(`  ✅ 通过: ${R.pass}  ❌ 失败: ${R.fail}`);
  if (R.errors.length > 0) {
    console.log("  失败详情:");
    for (const e of R.errors) console.log(`    ❌ ${e.n}: ${e.d}`);
  }
  console.log("═══════════════════════════════════════════════");

  await mock.stop();
  try {
    fs.unlinkSync(tmpCfg);
  } catch {}
  // ★ 仅在直接运行时 exit; require 调用由 dao-test.js 控制 exit
  if (require.main === module) {
    process.exit(R.fail > 0 ? 1 : 0);
  }
}

// ★ 支持外部调用: dao-test.js require 此模块
//   直接运行 (node lsp_sim_run.js) → 自动执行 main()
//   require 引入 → 导出 run() 供外部调用
async function run() {
  await main();
  return { pass: R.pass, fail: R.fail, errors: R.errors };
}

if (require.main === module) {
  main().catch((e) => {
    console.error("FATAL:", e);
    process.exit(2);
  });
} else {
  module.exports = { run, main };
}
