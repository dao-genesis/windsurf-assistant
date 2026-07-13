"use strict";
// ★ LSP别名 → 标准名 (与 sp_invert.js TOOL_ALIAS_TO_STANDARD 一致)
//   LSP 发送别名(Read/Grep/bash) · 代理规范化为标准名(read_file/grep_search/run_command)
//   模拟器构造请求必须使用 LSP 别名 · 方能真实模拟 LSP 行为
const ALIAS = {
  Read: "read_file",
  Edit: "edit",
  Write: "write_to_file",
  ListDir: "list_dir",
  Grep: "grep_search",
  bash: "run_command",
  FindByName: "find_by_name",
  CodeSearch: "code_search",
};
const STD_TO_ALIAS = {};
for (const [a, s] of Object.entries(ALIAS))
  if (!STD_TO_ALIAS[s]) STD_TO_ALIAS[s] = a;
// 使用 LSP 别名构造工具定义
const T = [
  {
    type: "function",
    function: {
      name: "Read",
      description: "Read file",
      parameters: {
        type: "object",
        properties: { file_path: { type: "string" } },
        required: ["file_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Edit",
      description: "Edit file",
      parameters: {
        type: "object",
        properties: {
          file_path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
        },
        required: ["file_path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "multi_edit",
      description: "Multi edit",
      parameters: {
        type: "object",
        properties: { file_path: { type: "string" }, edits: { type: "array" } },
        required: ["file_path", "edits"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Write",
      description: "Write file",
      parameters: {
        type: "object",
        properties: {
          TargetFile: { type: "string" },
          CodeContent: { type: "string" },
        },
        required: ["TargetFile", "CodeContent"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description: "Run command",
      parameters: {
        type: "object",
        properties: { CommandLine: { type: "string" } },
        required: ["CommandLine"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "Grep",
      description: "Grep search",
      parameters: {
        type: "object",
        properties: {
          SearchPath: { type: "string" },
          Query: { type: "string" },
        },
        required: ["SearchPath", "Query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "FindByName",
      description: "Find by name",
      parameters: {
        type: "object",
        properties: {
          SearchDirectory: { type: "string" },
          Pattern: { type: "string" },
        },
        required: ["SearchDirectory", "Pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ListDir",
      description: "List dir",
      parameters: {
        type: "object",
        properties: { DirectoryPath: { type: "string" } },
        required: ["DirectoryPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "CodeSearch",
      description: "Code search",
      parameters: {
        type: "object",
        properties: {
          search_folder_absolute_uri: { type: "string" },
          search_term: { type: "string" },
        },
        required: ["search_folder_absolute_uri", "search_term"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "command_status",
      description: "Command status",
      parameters: {
        type: "object",
        properties: { CommandId: { type: "string" } },
        required: ["CommandId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_preview",
      description: "Browser preview",
      parameters: {
        type: "object",
        properties: { Url: { type: "string" }, Name: { type: "string" } },
        required: ["Url", "Name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "todo_list",
      description: "Todo list",
      parameters: {
        type: "object",
        properties: { todos: { type: "array" } },
        required: ["todos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user_question",
      description: "Ask user",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array" },
          allowMultiple: { type: "boolean" },
        },
        required: ["question", "options", "allowMultiple"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deploy_web_app",
      description: "Deploy",
      // ★ 参数名对齐官方 protobuf schema: project_path (非 ProjectPath)
      parameters: {
        type: "object",
        properties: { project_path: { type: "string" } },
        required: ["project_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_deployment_config",
      description: "Read deploy config",
      // ★ 参数名对齐官方 protobuf schema: project_path (非 ProjectPath)
      parameters: {
        type: "object",
        properties: { project_path: { type: "string" } },
        required: ["project_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_deploy_status",
      description: "Deploy status",
      // ★ 参数名对齐官方 protobuf schema: windsurf_deployment_id (非 WindsurfDeploymentId)
      parameters: {
        type: "object",
        properties: { windsurf_deployment_id: { type: "string" } },
        required: ["windsurf_deployment_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_memory",
      description: "Create memory",
      parameters: {
        type: "object",
        properties: {
          Id: { type: "string" },
          Title: { type: "string" },
          Content: { type: "string" },
        },
        required: ["Id", "Title", "Content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search web",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_url_content",
      description: "Read URL",
      parameters: {
        type: "object",
        properties: { Url: { type: "string" } },
        required: ["Url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_content_chunk",
      description: "View chunk",
      parameters: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          position: { type: "integer" },
        },
        required: ["document_id", "position"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trajectory_search",
      description: "Search trajectory",
      // ★ 参数名对齐官方 CortexStepTrajectorySearch.Request: id/query/id_type
      //   (非 ID/Query/SearchType)
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          query: { type: "string" },
          id_type: { type: "string" },
        },
        required: ["id", "query", "id_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_notebook",
      description: "Edit notebook",
      parameters: {
        type: "object",
        properties: {
          absolute_path: { type: "string" },
          new_source: { type: "string" },
        },
        required: ["absolute_path", "new_source"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_notebook",
      description: "Read notebook",
      parameters: {
        type: "object",
        properties: { AbsolutePath: { type: "string" } },
        required: ["AbsolutePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_resource",
      description: "Read resource",
      parameters: {
        type: "object",
        properties: { ServerName: { type: "string" }, Uri: { type: "string" } },
        required: ["ServerName", "Uri"],
      },
    },
  },
];
module.exports = { tools: T, ALIAS, STD_TO_ALIAS };
