# PARITY-PLAN · 官方 1:1 对照全量差距审计与路线图

> 反者道之动: 以官方 Devin Desktop 3.4.27 bundle(workbench.desktop.main.js 34MB +
> extensions/windsurf/dist/extension.js)为唯一真源, 逐面反提对账。
> 基线: v1.5.69 · 142/142 测试 · R1–R234 已合入。本文为活文档, 每轮消化后更新。

## 〇 · 审计方法

- RPC 面: 反提 `exa.language_server_pb.LanguageServerService` 全量方法 ↔ 插件 ls-bridge 实调(scripts/sync-official.js)。
- 步卡面: 反提 `CORTEX_STEP_TYPE_*` 全集 ↔ `_cxStepCard` 结构化渲染(st.<field> 判据)。
- 字符串面: official-corpus/strings-coverage.tsv(1800+ 条, children/tooltip/placeholder 三类)全量重扫。
- 图标面: official-corpus/icons-missing.txt(115 枚官方库已入 official-icons.js, 余缺口)。
- 设置/面板面: 官方 Settings 分区与 workbench 面板结构逐区对照。

## 一 · RPC 面(169 官方 · 96 已接 · 73 未接)

未接 73 方法分层(按与 Cascade 面板域的相关性):

**A. 核心候选(高优, 建议逐轮接入)**
- `GetCascadeModelConfigs` — 模型配置真源(倍率/门控), 现用 config-options 侧渠
- `ResolveOutstandingSteps` — 批量清算待审步(官方 Accept all / Reject all 底层)
- `CancelRequest` — 请求级取消(与 CancelCascadeSteps 互补)
- `GetConversationTags` / `UpdateConversationTags` — 会话标签(官方 Tags UI)
- `SetPinnedContext` / `SetPinnedGuideline` — 固定上下文/准则(官方 Pin)
- `GetSuggestedContextScopeItems` — @ 菜单建议项官方源
- `GetBrainStatus` — Brain 状态(官方 brain 目录已同步, 状态未挖)
- `GetCodeMapsForFile` / `BranchCascadeAndGenerateCodeMap` — Codemap 全链路
- `StreamTerminalShellCommand` / `HandleStreamingTerminalCommand` — 终端流式
- `MountCascadeFilesystem` / `UnmountCascadeFilesystem` — Cascade 文件系统挂载
- `GetPatchAndCodeChange` — 补丁/变更明细(diff 卡增强)
- `GetKnowledgeBaseItemsForTeam` — 团队知识库(官方 Knowledge UI)

**B. 遥测/记录类(低优, 官方为埋点, 可选接入)**
Record*(Event/Lints/ChatFeedback/ChatPanelSession/CommitMessageSave/SearchDocOpen/
SearchResultsView/SystemMetrics/UserGrep/UserStepSnapshot/UploadRecentCommands)、
LogCascadeSession、ProvideCompletionFeedback、ProgressBars。

**C. 补全/Tab 域(非 Cascade 面板域, 与本插件定位正交)**
AcceptCompletion、HandleStreamingTab、HandleStreamingCommand、OnEdit、
Supercomplete 系、GenerateVibeAndReplaceStreaming、RefreshContextForIdeAction。

**D. 平台/实验/引导类(按需)**
Get/SetUnleash·Experiments 系、Onboarding 系(Reset/Skip)、SetupUniversitySandbox、
MigrateApiKey、GetAuthToken、GetPrimaryApiKeyForDevsOnly、Exit、GetStatus、
WellSupportedLanguages、StatUri、CaptureCode/CaptureFile、CheckBugs、
GetWindsurfJSAppDeployment 系(Deploy 链路, 见模块面)。

## 二 · 步卡面(86 官方步型 · 14 结构化渲染 · 72 走通用 tool-call 卡)

已结构化: codeAction / runCommand / listDirectory / grepSearch / viewFile /
exitPlanMode / plannerResponse / userInput / askUserQuestion / arenaTrajectoryConverge /
readUrlContent(审批) 等 14 型。

**高频未渲染(P0, 官方有专卡语义)**
- `SEARCH_WEB` / `READ_URL_CONTENT`(内容态) — web 步卡(globe 图标 + 查询/URL + 结果数)
- `MCP_TOOL` — MCP 工具卡(服务器名 + 工具名 + 参数/结果)
- `TODO_LIST` — 官方待办清单卡(勾选态)
- `MEMORY` / `RETRIEVE_MEMORY` / `LIST_MEMORIES` — 记忆卡("Created a memory" 等)
- `GIT_COMMIT` — 提交卡(消息 + hash)
- `WRITE_TO_FILE` / `PROPOSE_CODE` — 写文件/提案卡(现走 codeAction 路径的补集)
- `ERROR_MESSAGE` / `FINISH` / `INFORM` / `BLOCKING` — 终态/信息步语义
- `READ_TERMINAL` / `COMMAND_STATUS` — 终端读取/状态卡
- `SUGGESTED_RESPONSES` — 建议回复 chips(官方点击即发)
- `CHECKPOINT` — 快照卡(配 "Revert to this snapshot" tooltip)

**中低频(P1/P2)**
VIEW_CODE_ITEM / VIEW_CONTENT_CHUNK / VIEW_FILE_OUTLINE / GREP_SEARCH_V2 /
FIND_ALL_REFERENCES / RELATED_FILES / FIND_CODE_CONTEXT(检索族, 可并入 browse-card);
DEPLOY_WEB_APP / CHECK_DEPLOY_STATUS / READ_DEPLOYMENT_CONFIG(Deploy 族);
knowledge 族(SEARCH/LOOKUP/READ_KNOWLEDGE_BASE*); notebook 族(READ/EDIT_NOTEBOOK);
codemap 族(SUGGEST/UPSERT_CODEMAP); cluster 族; TASK_SUBAGENT("Has child sessions");
其余(clipboard/compile/lint 系/dummy/unspecified 等)保持通用卡即可。

## 三 · 字符串面(337 MISS: children 275 · tooltip 47 · placeholder 15)

主题聚类(按官方功能域):
1. **Devin Cloud 会话板(Agent 看板)**: Search agents/organizations/users、Has child
   sessions、Scheduled session、Triggered by automation、Respond in Devin webapp 等
   — 需 agent-board.js 扩展列/徽标/筛选。
2. **Deploy/Netlify 链路**: Deploy failed、Deployment is live.、Creating PR...、
   Connect your Netlify account... — 依赖 Deploy 模块(未建)。
3. **Codemap**: Describe the codemap you want、Create a Codemap、Codemap from this
   Cascade — 依赖 Codemap 链路。
4. **Auto Web Requests 设置档**: Allow web request?(已入 R234)、Auto Web Requests
   设置行(类 Auto-Run 四档) — settings-page + 审批自动化。
5. **审批/批量**: Accept all、Reject all、Configure Auto-Run、Auto Execution。
6. **续写/截断**: Continue response(+ 两种 tooltip)、Auto-continued。
7. **组织/成员管理、Onboarding、错误态**(children 大宗) — 官方 webapp 域, 面板内
   仅少量适用, 逐条甄别不盲铺。

## 四 · 图标面(115 已入库 · 100 缺口)

高频候选先行: globe(web 卡)、exclamation-triangle/circle(错误/警示)、
loading-circle(运行态)、check-circle-2(成功)、git/commits/pull-request(git 族卡)、
arrow-down/chevron-down-medium(展开)、eye-open(显隐)、key-1(secrets)。
原则: 只随对应模块/卡片落地时同步入库, 不空铺。

## 五 · 设置页面(官方分区对照)

官方 Settings 分区: General / Cascade / Tab / Terminal / Editor / Advanced /
Memories / Plugins / Account。插件 settings-page.js 已覆盖 General(Auto-Run 行等)
+ 账户/配额; 缺: **Cascade 区**(Auto Web Requests、Memories 开关族)、**Tab 区**
(补全域, 可只读展示)、**Terminal 区**、**Advanced 区**。建议每轮一个分区, 行级对照
官方 children 文案。

## 六 · 模块/前后端面(功能级缺口)

- **Continue response**: 截断续写钮(officially: "Cascade's response was cut short
  due to length limits...") — 检测 PLANNER_RESPONSE 截断态 + 续写回传。P0。
- **Accept all / Reject all**: 多待审步批量清算(ResolveOutstandingSteps)。P0。
- **Background Commands**: 后台命令(Send to background · "Background command
  running" 点标 + 面板)。P1。
- **Queued messages 强化**: Remove from queue tooltip 等(队列已有, 补官方同文)。P1。
- **Tags**: 会话标签(Get/UpdateConversationTags + Tags UI)。P1。
- **Pinned context**: SetPinnedContext + @ 菜单 pin。P1。
- **Codemap 链路**: 生成/列出/打开(Create a Codemap 全文案族)。P2。
- **Deploy 链路**: DEPLOY_WEB_APP 步卡 + 部署状态(Deployment is live. 等)。P2。
- **Snapshot/Checkpoint**: CHECKPOINT 步卡 + Revert to this snapshot。P2。
- **拖拽上下文**: Drop to add to agent(文件拖入 composer)。P2。

## 七 · 路线图

- **P0(下一批)**: Continue response · Accept/Reject all(ResolveOutstandingSteps) ·
  web 步卡(SEARCH_WEB/READ_URL 内容态) · MCP_TOOL 卡 · SUGGESTED_RESPONSES chips ·
  TODO_LIST 卡 · Auto Web Requests 设置档。
- **P1**: 记忆卡族 · GIT_COMMIT 卡 · Tags · Pinned context · Background Commands ·
  Settings Cascade/Terminal 区 · agent-board 徽标/筛选批。
- **P2**: Codemap · Deploy · Checkpoint/Snapshot · 检索族卡合并 · notebook 族 ·
  拖拽上下文 · 图标随卡入库 · 遥测类 RPC 甄别。
- **不做(定位正交)**: Tab/Supercomplete 补全域、University Sandbox、组织管理后台大宗。

*道法自然 · 无为而无不为*
