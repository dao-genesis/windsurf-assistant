"use strict";
// ★ 参数名对齐官方 protobuf schema (v9.9.86)
//   trajectory_search: id/query/id_type (非 ID/Query/SearchType)
//   ask_user_question: question/options/allowMultiple (非 Question/Options/AllowMultiple)
//   deploy_web_app: project_path/framework/project_id/subdomain (非 ProjectPath/...)
//   code_search: search_folder_absolute_uri/search_term
//   check_deploy_status: windsurf_deployment_id (非 WindsurfDeploymentId)
//   read_deployment_config: project_path (非 ProjectPath)
const SC = {
  default: {
    text: "Hello! I'm ready to help.",
    thinking: "User greeted me.",
    finishReason: "stop",
  },
  read_file: {
    thinking: "User wants to read a file.",
    toolCalls: [
      {
        id: "c_r1",
        name: "read_file",
        arguments: JSON.stringify({
          file_path: "/home/user/project/package.json",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  grep_search: {
    thinking: "User wants to search.",
    toolCalls: [
      {
        id: "c_g1",
        name: "grep_search",
        arguments: JSON.stringify({
          SearchPath: "/home/user/project",
          Query: "TODO",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  list_dir: {
    thinking: "User wants to list dir.",
    toolCalls: [
      {
        id: "c_l1",
        name: "list_dir",
        arguments: JSON.stringify({ DirectoryPath: "/home/user/project" }),
      },
    ],
    finishReason: "tool_calls",
  },
  run_command: {
    thinking: "User wants to run a command.",
    toolCalls: [
      {
        id: "c_cmd1",
        name: "run_command",
        arguments: JSON.stringify({ CommandLine: "npm test" }),
      },
    ],
    finishReason: "tool_calls",
  },
  // ★ trajectory_search: 参数名对齐官方 CortexStepTrajectorySearch.Request
  //   id/query/id_type (非 ID/Query/SearchType)
  trajectory_search: {
    thinking: "User wants to search conversations.",
    toolCalls: [
      {
        id: "c_t1",
        name: "trajectory_search",
        arguments: JSON.stringify({
          id: "conv_abc",
          query: "database migration",
          id_type: "cascade_id",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  // ★ deploy_web_app: 参数名对齐官方 protobuf schema
  //   project_path (非 ProjectPath)
  deploy_web_app: {
    thinking: "User wants to deploy.",
    toolCalls: [
      {
        id: "c_d1",
        name: "deploy_web_app",
        arguments: JSON.stringify({ project_path: "/home/user/myapp" }),
      },
    ],
    finishReason: "tool_calls",
  },
  // ★ read_deployment_config: project_path (非 ProjectPath)
  read_deployment_config: {
    thinking: "User wants to read deployment config.",
    toolCalls: [
      {
        id: "c_rd1",
        name: "read_deployment_config",
        arguments: JSON.stringify({ project_path: "/home/user/myapp" }),
      },
    ],
    finishReason: "tool_calls",
  },
  // ★ check_deploy_status: windsurf_deployment_id (非 WindsurfDeploymentId)
  check_deploy_status: {
    thinking: "User wants to check deploy status.",
    toolCalls: [
      {
        id: "c_cs1",
        name: "check_deploy_status",
        arguments: JSON.stringify({ windsurf_deployment_id: "deploy_abc123" }),
      },
    ],
    finishReason: "tool_calls",
  },
  // ★ code_search: search_folder_absolute_uri/search_term
  code_search: {
    thinking: "User wants code search.",
    toolCalls: [
      {
        id: "c_csearch1",
        name: "code_search",
        arguments: JSON.stringify({
          search_folder_absolute_uri: "/home/user/project",
          search_term: "authentication handler",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  multi_tool: {
    thinking: "User needs multiple tools.",
    toolCalls: [
      {
        id: "c_m1",
        name: "read_file",
        arguments: JSON.stringify({ file_path: "/home/user/a.js" }),
      },
      {
        id: "c_m2",
        name: "list_dir",
        arguments: JSON.stringify({ DirectoryPath: "/home/user" }),
      },
      {
        id: "c_m3",
        name: "grep_search",
        arguments: JSON.stringify({
          SearchPath: "/home/user",
          Query: "import",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  thinking: {
    thinking:
      "Complex question. Let me analyze step by step. First, understand the architecture. Then, consider trade-offs. Finally, recommend.",
    text: "Based on my analysis, I recommend microservices.",
    finishReason: "stop",
  },
  edit: {
    thinking: "User wants to edit.",
    toolCalls: [
      {
        id: "c_e1",
        name: "edit",
        arguments: JSON.stringify({
          file_path: "/home/user/a.js",
          old_string: "hello",
          new_string: "world",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  write_to_file: {
    thinking: "User wants to write a file.",
    toolCalls: [
      {
        id: "c_w1",
        name: "write_to_file",
        arguments: JSON.stringify({
          TargetFile: "/home/user/new.js",
          CodeContent: "console.log('hello');",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  find_by_name: {
    thinking: "User wants to find files.",
    toolCalls: [
      {
        id: "c_f1",
        name: "find_by_name",
        arguments: JSON.stringify({
          SearchDirectory: "/home/user",
          Pattern: "*.js",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  // ★ ask_user_question: question/options/allowMultiple (非 Question/Options/AllowMultiple)
  ask_user_question: {
    thinking: "I need to ask the user.",
    toolCalls: [
      {
        id: "c_aq1",
        name: "ask_user_question",
        arguments: JSON.stringify({
          question: "Which framework?",
          options: [
            { label: "React", description: "React framework" },
            { label: "Vue", description: "Vue framework" },
          ],
          allowMultiple: false,
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  todo_list: {
    thinking: "User wants to manage tasks.",
    toolCalls: [
      {
        id: "c_td1",
        name: "todo_list",
        arguments: JSON.stringify({
          todos: [
            {
              id: "1",
              content: "Fix bug",
              status: "pending",
              priority: "high",
            },
          ],
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  create_memory: {
    thinking: "User wants to save memory.",
    toolCalls: [
      {
        id: "c_cm1",
        name: "create_memory",
        arguments: JSON.stringify({
          Id: "",
          Title: "Test",
          Content: "Test content",
          CorpusNames: [],
          Tags: ["test"],
          Action: "create",
          UserTriggered: true,
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  search_web: {
    thinking: "User wants web search.",
    toolCalls: [
      {
        id: "c_sw1",
        name: "search_web",
        arguments: JSON.stringify({ query: "Node.js best practices 2026" }),
      },
    ],
    finishReason: "tool_calls",
  },
  read_url_content: {
    thinking: "User wants to read a URL.",
    toolCalls: [
      {
        id: "c_ru1",
        name: "read_url_content",
        arguments: JSON.stringify({ Url: "https://example.com/docs" }),
      },
    ],
    finishReason: "tool_calls",
  },
  view_content_chunk: {
    thinking: "User wants to view a chunk.",
    toolCalls: [
      {
        id: "c_vc1",
        name: "view_content_chunk",
        arguments: JSON.stringify({ document_id: "doc_abc", position: 5 }),
      },
    ],
    finishReason: "tool_calls",
  },
  edit_notebook: {
    thinking: "User wants to edit a notebook.",
    toolCalls: [
      {
        id: "c_en1",
        name: "edit_notebook",
        arguments: JSON.stringify({
          absolute_path: "/home/user/analysis.ipynb",
          new_source: "import pandas as pd",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  read_notebook: {
    thinking: "User wants to read a notebook.",
    toolCalls: [
      {
        id: "c_rn1",
        name: "read_notebook",
        arguments: JSON.stringify({
          AbsolutePath: "/home/user/analysis.ipynb",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  read_resource: {
    thinking: "User wants to read a resource.",
    toolCalls: [
      {
        id: "c_rr1",
        name: "read_resource",
        arguments: JSON.stringify({
          ServerName: "context7",
          Uri: "/docs/react",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  command_status: {
    thinking: "User wants to check command status.",
    toolCalls: [
      {
        id: "c_cst1",
        name: "command_status",
        arguments: JSON.stringify({ CommandId: "cmd_123" }),
      },
    ],
    finishReason: "tool_calls",
  },
  browser_preview: {
    thinking: "User wants to preview browser.",
    toolCalls: [
      {
        id: "c_bp1",
        name: "browser_preview",
        arguments: JSON.stringify({
          Url: "http://localhost:3000",
          Name: "My App",
        }),
      },
    ],
    finishReason: "tool_calls",
  },
  after_tool_result: {
    thinking: "I have tool results. Let me analyze.",
    text: "Based on the results, the project has a standard Node.js structure.",
    finishReason: "stop",
  },
};
module.exports = SC;
