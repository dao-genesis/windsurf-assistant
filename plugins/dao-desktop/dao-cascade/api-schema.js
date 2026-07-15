// 道 · 协议自描述 —— 任意 AI/Agent 经 GET /api/openapi 自发现全部端点(机器可读, 免查 MD)。
// 单一真源: local-api.js 的每条路由在此登记; 护栏测试对账源码路由字面量 ≡ 本清单, 漏登即红。
"use strict";

// q = query 参数, b = body 字段; req=true 必填。
const ROUTES = [
  { path: "/api/health", method: "get", auth: false, summary: "存活探针(免鉴权)" },
  { path: "/api/openapi", method: "get", summary: "协议自描述(本文档)" },
  { path: "/api/env", method: "get", summary: "共享环境 30 源清点(官方 IDE/配置真源/安装轨)" },
  { path: "/api/config", method: "get", summary: "官方 configuration 生效视图(默认+settings.json 覆写归一)" },
  { path: "/api/status", method: "get", summary: "登录账号(name/email/plan, LS 真源)" },
  { path: "/api/auth", method: "get", summary: "登录态 + 进行中登录流", q: [{ name: "force", desc: "1=绕过缓存" }] },
  { path: "/api/auth/login", method: "post", summary: "发起登录(manual-token 流), 返 {url} 供浏览器完成" },
  { path: "/api/auth/code", method: "post", summary: "提交一次性登录 code", b: [{ name: "code", req: true }] },
  { path: "/api/auth/cancel", method: "post", summary: "取消进行中登录" },
  { path: "/api/auth/logout", method: "post", summary: "登出(如实反映 CLI 退出码)" },
  { path: "/api/account", method: "get", summary: "账号视图(脱敏, 配额/积分)" },
  { path: "/api/host", method: "get", summary: "宿主 LS 就绪状态" },
  { path: "/api/overview", method: "get", summary: "总览(账号+宿主+MCP+Cascade+备份)" },
  { path: "/api/models", method: "get", summary: "可用模型清单" },
  { path: "/api/models/statuses", method: "get", summary: "模型可用状态" },
  { path: "/api/settings", method: "get", summary: "官方用户设置(GetUserSettings)" },
  { path: "/api/settings", method: "post", summary: "写官方用户设置(局部合并)", b: [{ name: "patch", req: true, desc: "UserSettings 局部对象" }] },
  { path: "/api/rules", method: "get", summary: "规则清单(工作区+全局)" },
  { path: "/api/workflows", method: "get", summary: "工作流清单" },
  { path: "/api/skills", method: "get", summary: "技能清单" },
  { path: "/api/memories", method: "get", summary: "Cascade 记忆" },
  { path: "/api/memory/update", method: "post", summary: "写/改记忆", b: [{ name: "memoryId", req: true }, { name: "content", req: true }, { name: "title" }, { name: "tags" }] },
  { path: "/api/memory/delete", method: "post", summary: "删记忆", b: [{ name: "memoryId", req: true }] },
  { path: "/api/mcp", method: "get", summary: "MCP 服务器(插件 host state 视图)" },
  { path: "/api/mcp/states", method: "get", summary: "MCP 服务器运行状态(LS 真源)" },
  { path: "/api/workspaces", method: "get", summary: "已纳管工作区" },
  { path: "/api/workspaces/add", method: "post", summary: "动态纳管工作区(官方 AddTrackedWorkspace)", b: [{ name: "workspace", req: true, desc: "路径或 file:// URI" }] },
  { path: "/api/workspaces/remove", method: "post", summary: "移除纳管工作区(官方 RemoveTrackedWorkspace)", b: [{ name: "workspace", req: true, desc: "路径或 file:// URI" }] },
  { path: "/api/workspace/edit-state", method: "get", summary: "工作区编辑状态" },
  { path: "/api/config/edit", method: "post", summary: "写回补全配置(官方 EditConfiguration)", b: [{ name: "completionConfiguration", req: true, desc: "CompletionConfiguration 对象" }] },
  { path: "/api/completions", method: "post", summary: "取代码补全(官方 GetCompletions, 非 Cascade 对话)", b: [{ name: "document", req: true, desc: "含 text/editorLanguage/cursorOffset" }, { name: "editorOptions" }, { name: "modelName" }] },
  { path: "/api/processes", method: "get", summary: "官方后台进程" },
  { path: "/api/tasks", method: "get", summary: "统一任务视图(本地轨迹+Cloud 会话同构归一)" },
  { path: "/api/cascade", method: "get", summary: "本机 Cascade 水位(会话/记忆计数)" },
  { path: "/api/cascade/trajectories", method: "get", summary: "全部 Cascade 轨迹摘要" },
  { path: "/api/cascade/steps", method: "get", summary: "轨迹步", q: [{ name: "cascadeId", req: true }] },
  { path: "/api/cascade/transcript", method: "get", summary: "轨迹全文对话", q: [{ name: "cascadeId", req: true }] },
  { path: "/api/cascade/send", method: "post", summary: "本机 Cascade 发消息(可等回复)", b: [{ name: "text", req: true }, { name: "cascadeId" }, { name: "modelUid" }, { name: "wait", desc: "true=等回复" }] },
  { path: "/api/cascade/queue", method: "post", summary: "排队消息", b: [{ name: "cascadeId", req: true }, { name: "text", req: true }] },
  { path: "/api/cascade/branch", method: "post", summary: "从某步分叉新轨迹", b: [{ name: "cascadeId", req: true }, { name: "stepIndex" }] },
  { path: "/api/cascade/revert", method: "post", summary: "回滚到某步", b: [{ name: "cascadeId", req: true }, { name: "stepIndex", req: true }] },
  { path: "/api/cascade/rename", method: "post", summary: "改轨迹名", b: [{ name: "cascadeId", req: true }, { name: "name", req: true }] },
  { path: "/api/cascade/archive", method: "post", summary: "归档轨迹", b: [{ name: "cascadeId", req: true }] },
  { path: "/api/cascade/delete", method: "post", summary: "删轨迹", b: [{ name: "cascadeId", req: true }] },
  { path: "/api/cascade/cancel", method: "post", summary: "取消运行中轨迹", b: [{ name: "cascadeId", req: true }] },
  { path: "/api/cloud/live", method: "get", summary: "Cloud 常驻连接状态" },
  { path: "/api/cloud/live", method: "post", summary: "开/关 Cloud 常驻长连接", b: [{ name: "on", desc: "false=断开" }] },
  { path: "/api/cloud/updates", method: "get", summary: "Cloud 实时更新增量(环形缓冲)", q: [{ name: "since", desc: "上次 next 序号" }] },
  { path: "/api/cloud/sessions", method: "get", summary: "Devin Cloud 会话清单" },
  { path: "/api/cloud/send", method: "post", summary: "Cloud 会话发消息(复用常驻连接)", b: [{ name: "text", req: true }, { name: "sessionId" }, { name: "wait" }] },
  { path: "/api/cloud/cancel", method: "post", summary: "取消 Cloud 会话", b: [{ name: "sessionId", req: true }] },
  { path: "/api/backups", method: "get", summary: "对话备份清单(按账号)" },
  { path: "/api/backup/run", method: "post", summary: "执行对话备份" },
];

function paramSchema(list) {
  return (list || []).map((p) => ({
    name: p.name, in: "query", required: !!p.req, schema: { type: "string" },
    description: p.desc || "",
  }));
}

function bodySchema(list) {
  if (!list || !list.length) return undefined;
  const props = {}; const required = [];
  for (const p of list) { props[p.name] = { description: p.desc || "" }; if (p.req) required.push(p.name); }
  return { required: true, content: { "application/json": { schema: { type: "object", properties: props, ...(required.length ? { required } : {}) } } } };
}

// OpenAPI 3.1 文档(自身即经 /api/openapi 下发): bearer 鉴权, /api/health 除外。
function openapi(opts) {
  const paths = {};
  for (const r of ROUTES) {
    paths[r.path] = paths[r.path] || {};
    paths[r.path][r.method] = {
      summary: r.summary,
      ...(r.q ? { parameters: paramSchema(r.q) } : {}),
      ...(r.b ? { requestBody: bodySchema(r.b) } : {}),
      ...(r.auth === false ? { security: [] } : {}),
      responses: { 200: { description: "JSON 结果; 失败 {error}" } },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "dao-desktop local API",
      version: require("../package.json").version,
      description: "统一插件后端协议(自描述): 账号/Cascade/Cloud/配置/记忆/MCP/工作区/备份 全模块零 GUI 调度。除 /api/health 与本文档外均需 Authorization: Bearer <token>(~/.dao/local-api.json)。",
    },
    servers: [{ url: "http://127.0.0.1:" + ((opts || {}).port || 0) }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
    security: [{ bearer: [] }],
    paths,
  };
}

module.exports = { ROUTES, openapi };
