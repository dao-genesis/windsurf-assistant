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
  // ── Proxy Pro(第三方渠道/模型路由; Key 只入私有存储, 视图恒脱敏) ──
  { path: "/api/proxy", method: "get", summary: "Proxy Pro 渠道+路由视图(脱敏: 仅回 hasKey/keyTail)" },
  { path: "/api/proxy/channel/add", method: "post", summary: "加/改第三方渠道", b: [{ name: "name", req: true }, { name: "type", desc: "openai|anthropic|..." }, { name: "baseURL" }, { name: "apiKey" }] },
  { path: "/api/proxy/channel/remove", method: "post", summary: "删渠道", b: [{ name: "name", req: true }] },
  { path: "/api/proxy/channel/refresh", method: "post", summary: "识别渠道模型清单", b: [{ name: "name", req: true }] },
  { path: "/api/proxy/route", method: "post", summary: "设/解模型路由(官方 UID → 渠道/模型)", b: [{ name: "uid", req: true }, { name: "channel", desc: "留空=解除" }, { name: "model" }] },
  { path: "/api/proxy/routes", method: "get", summary: "路由生效视图(每条路由能否真正投递: 渠道/Key/模型齐备)" },
  { path: "/api/proxy/chat", method: "post", summary: "路由生效层: 按官方 UID 真正投递到第三方渠道/模型(消费路由, 不伪造)", b: [{ name: "uid", req: true }, { name: "messages", desc: "[{role,content}]; 或用 text" }, { name: "text" }, { name: "temperature" }, { name: "maxTokens" }] },
  // ── 账号池切号(Devin; 严禁回退, 无 key 报错) ──
  { path: "/api/pool", method: "get", summary: "Cascade 账号池视图(脱敏: hasKey/keyTail/active)" },
  { path: "/api/boundary", method: "get", summary: "同步/隔离边界自描述: 插件自持面(~/.dao/*)与官方共享面(IDE 数据 1:1)的机器可读矩阵" },
  { path: "/api/coexist", method: "get", summary: "共存场景边界探测: 同装独立插件(dao-vsix/dao-one/proxy-pro/min)时的共享/隔离判定矩阵 + 只读兄弟账号可见性" },
  { path: "/api/sync/audit", method: "get", summary: "官方↔插件全资源真源归一审计: 每类资源(MCP/Rules/global_rules.md/Workflows/Skills/记忆)读写同一份官方真源即双向同源" },
  { path: "/api/sync/roundtrip", method: "post", summary: "写后对侧复读活体探测: 向官方真源写唯一标记探针→经另一侧读路径复读确认→原样还原(不留痕)", b: [{ name: "only", desc: "限定资源 key 数组, 缺省全测" }] },
  { path: "/api/coexist/flow", method: "get", summary: "跨插件数据流通矩阵: 官方引擎真源=跨插件数据总线(官方IDE/dao-vsix/dao-one/dao-desktop 源同一即流通) + 自持面命名空间隔离" },
  { path: "/api/coexist/roundtrip", method: "post", summary: "跨插件数据流通活体验证: 共享总线写后对侧复读 + 自持面隔离断言", b: [{ name: "only", desc: "限定共享资源 key 数组, 缺省全测" }] },
  { path: "/api/pool/capture", method: "post", summary: "收录当前登录号入池", b: [{ name: "account", desc: "缺省取 /api/account 视图" }] },
  { path: "/api/pool/switch", method: "post", summary: "切换到池内账号(写 credentials.toml, 首次自动备份官方原态)", b: [{ name: "email", req: true }] },
  { path: "/api/pool/restore", method: "post", summary: "归还官方原登录态(以首次切号前备份的 credentials.toml.bak 覆写回)" },
  { path: "/api/pool/remove", method: "post", summary: "移除池内账号", b: [{ name: "email", req: true }] },
  // ── 反向注入(全账号; secret 值绝不出后端) ──
  { path: "/api/inject", method: "get", summary: "注入档视图(脱敏: secret 仅回 hasValue/valueTail)" },
  { path: "/api/inject/plan", method: "get", summary: "注入计划(账号池 × 注入档 交叉清单)" },
  { path: "/api/inject/add", method: "post", summary: "加/改注入档(mcp|secret|knowledge)", b: [{ name: "kind", req: true }, { name: "name", req: true }, { name: "spec", req: true }] },
  { path: "/api/inject/remove", method: "post", summary: "删注入档", b: [{ name: "kind", req: true }, { name: "name", req: true }] },
  { path: "/api/inject/apply-mcp", method: "post", summary: "MCP 注入档即刻本机落地(写 mcp_config.json)" },
  // ── GitHub 舰队(纯 GitHub 纵向, 与 Devin 账号池分离; PAT 只出尾 4 位) ──
  { path: "/api/github", method: "get", summary: "GitHub 舰队视图(脱敏: hasPat/patTail)" },
  { path: "/api/github/add", method: "post", summary: "加/改 GitHub 号(PAT 反查 login)", b: [{ name: "pat", req: true }, { name: "login", desc: "断网入队需带" }, { name: "role", desc: "admin|member" }] },
  { path: "/api/github/remove", method: "post", summary: "移除 GitHub 号", b: [{ name: "login", req: true }] },
  { path: "/api/github/role", method: "post", summary: "定角色", b: [{ name: "login", req: true }, { name: "role", desc: "admin|member" }] },
  { path: "/api/github/verify", method: "post", summary: "在线核对全队(PAT 活性+仓库探针)" },
  // ── Web 搜索(站内直出, 不弹外部浏览器) ──
  { path: "/api/search", method: "get", summary: "站内网页搜索(无 q 则回引擎+历史)", q: [{ name: "q", desc: "查询串" }, { name: "engine", desc: "duckduckgo|bing" }] },
  { path: "/api/search", method: "post", summary: "站内网页搜索", b: [{ name: "query", req: true }, { name: "engine" }] },
  { path: "/api/search/history", method: "get", summary: "搜索历史(仅查询串, 无凭据)" },
  { path: "/api/search/clear", method: "post", summary: "清空搜索历史" },
  // ── Windows Agent(接入官方 MCP 工具层; headers 只报有无) ──
  { path: "/api/winagent", method: "get", summary: "Windows Agent 注册状态(脱敏)" },
  { path: "/api/winagent/local", method: "post", summary: "注册 local 通道(stdio 起 bridge.mcp)", b: [{ name: "dir" }, { name: "bridgeUrl" }, { name: "token" }, { name: "disabled" }] },
  { path: "/api/winagent/remote", method: "post", summary: "注册 remote 通道(DAO Bridge 穿透 /mcp)", b: [{ name: "url", req: true }, { name: "token" }, { name: "disabled" }] },
  { path: "/api/winagent/unregister", method: "post", summary: "注销 Windows Agent" },
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
