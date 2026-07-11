# 官方功能全景对照（docs.devin.ai/desktop · 文档级 → 插件覆盖）

> 来源: `https://docs.devin.ai/llms.txt` 全量 desktop 文档页清单(2026-07-11 抓取)。
> 与 `GAP.md`(RPC 级对账) 互补: 本文按**用户可感知功能**对照; RPC 细账见 GAP。
> 官方文档更新后复核法: `curl -s https://docs.devin.ai/llms.txt | grep -o 'desktop/[a-z0-9/_.-]*'`
> 对比本文清单, 新增页即新功能候选。

图例: ✅ 已覆盖(经官方 LS 真实后端) · 🟡 部分覆盖 · ⬜ 未覆盖(候选) · 🏠 IDE 宿主原生(插件形态下由宿主 IDE 承担, 非插件职责) · 🚫 服务端不可用/已废弃(实测见 GAP)

## Cascade 核心 (cascade/cascade)

| 功能 | 状态 | 备注 |
|---|---|---|
| Cascade Code/Chat 双模 | ✅ | plannerConfig 模式切换 |
| 模型选择 + 状态/价格 | ✅ | listModels + GetModelStatuses 合并 |
| Plans / Todo List | ✅ | GetAllPlans |
| Queued Messages(排队/插队/删除) | ✅ | QueueCascadeMessage/InterruptWithQueuedMessage/MoveQueuedMessage/RemoveFromQueue |
| 工具调用(Search/Analyze/Terminal) | ✅ | 轨迹步卡渲染 + HandleCascadeUserInteraction 确认 |
| 发送前配额闸 | ✅ | CheckChatCapacity + CheckUserMessageRateLimit |
| 命名检查点与回滚 | ✅ | RevertToCascadeStep + GetRevertPreview |
| 实时感知(Real-time awareness) | 🟡 | StreamCascadeReactiveUpdates 反应式回放已接; 编辑器动作上报未接 |
| Send problems to Cascade | ✅ | 命令 `dao.cascade.sendProblems`: 诊断(当前文件优先) → @mention 塗入 composer |
| Explain and Fix | ✅ | 命令 `dao.cascade.explainFix`(含编辑器右键菜单): 选区+该处诊断 → composer |
| 语音输入 | 🚫 | GetTranscription 实测返回 {}(需官方录音通道) |
| .codeiumignore | 🏠 | LS 层生效, 插件无需实现 |
| Auto-Continue | ⬜ | 候选: 步数上限帧检测 + 自动续发 |

## 定制体系 (memories / agents-md / workflows / skills / hooks)

| 功能 | 状态 | 备注 |
|---|---|---|
| Memories(自动记忆) | ✅ | GetCascadeMemories + GetUserMemories 双源合并, 增删改 |
| Rules(全局/工作区) | ✅ | GetAllRules + CreateCustomizationFile |
| AGENTS.md | 🏠 | LS 自动装载 |
| Workflows(/斜杠命令) | ✅ | GetAllWorkflows + CopyBuiltinWorkflowToWorkspace |
| Skills | ✅ | GetAllSkills |
| Hooks | ⬜ | 候选: 文档 cascade/hooks; 需探明 LS 契约 |

## 扩展生态 (mcp / acp)

| 功能 | 状态 | 备注 |
|---|---|---|
| MCP 市场/安装/工具开关 | ✅ | GetMcpRegistryServers/SaveMcpServerToConfigFile/ToggleMcpTool/RefreshMcpServers 等 8 RPC |
| MCP OAuth / 三种传输 | 🏠 | mcp_config.json 层由 LS 处理 |
| ACP(Agent Client Protocol) | 🟡 | GetAllAcpRegistries 已接; 自定义 ACP 接线未接 |

## 高级会话 (arena / worktrees / spaces / agent-command-center)

| 功能 | 状态 | 备注 |
|---|---|---|
| Arena 双模型对战 + 收敛 | ✅ | SpawnArenaModeMidConversation/ConvergeArenaCascades + 可用性感知 |
| Worktrees | ✅ | CreateWorktree/ResolveWorktreeChanges/UndoWorktreeMerge |
| Spaces | ⬜ | 文档 desktop/spaces; 需探明 LS 契约 |
| Agent Command Center | ⬜ | 多会话指挥台; 插件以 Recent 列表 + 反应式摘要流部分等效 |

## 代码理解 (codemaps / deepwiki / context-awareness)

| 功能 | 状态 | 备注 |
|---|---|---|
| Codemaps 生成/分享/元数据 | ✅ | GenerateCodeMap + 5 项 CodeMap RPC |
| DeepWiki | ✅ | GetDeepWiki |
| Fast Context / 本地索引 | 🏠 | LS 内建 |
| Remote Indexing | 🚫 | GetMatchingIndexedRepos 实测 index service deprecated |

## 编辑器内功能（插件形态下 🏠 = 宿主 IDE 原生承担）

| 功能 | 状态 | 备注 |
|---|---|---|
| Tab 补全 / Supercomplete | 🏠 | 官方扩展本体提供; 本插件与其共存不重复 |
| Command(内联指令) | 🏠 | 同上 |
| Terminal 升级体验 | 🏠 | 宿主 IDE |
| Previews / App Deploys | ⬜ | 候选: 文档 previews / cascade/app-deploys |
| Quick Review | ⬜ | 候选 |
| Vibe & Replace | ⬜ | 候选 |
| AI Commit Message | 🟡 | GenerateCommitMessage 已接线(契约确认); 服务端 LLM 流当前报 stream error(见 GAP) |

## 账号/组织 (accounts/*)

| 功能 | 状态 | 备注 |
|---|---|---|
| 账号/配额/额度展示 | ✅ | GetUserStatus(套餐/日周配额/Flex) |
| 团队组织管控(模型标签) | ✅ | GetTeamOrganizationalControls·首帧即带 |
| Analytics API | 🏠 | 服务端 REST, 非 LS 范畴 |
| SSO/SCIM/RBAC | 🏠 | 企业服务端 |

## 未覆盖候选优先级（下一波接入顺序建议）

1. **Auto-Continue**（反应式帧已有, 检测步数上限帧即续发）
2. **Hooks / Spaces / Previews / Quick Review / Vibe & Replace**（需先探明 LS 契约, 探测先行）
