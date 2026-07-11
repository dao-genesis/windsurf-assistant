# 官方 RPC 差距矩阵（反者道之动 · 自动生成）

来源: `plugins/dao-desktop/scripts/sync-official.js` 反提官方 bundle(服务定义锚点提取)——
官方每次版本升级后重跑该器即自动: 提取全量方法 → 与插件源对账 → 打印官方新增/移除差异
→ 重写本文件计数与已接入清单 → 更新基线快照 `official/rpcs.json`。

- 官方 LanguageServerService 方法总数: **169**
- 插件已接入: **86**
- 未接入: **83**

> 探测实录(2026-07-11): 以下方法服务端已废弃/不可用, 不再接入 ——
> GetBrainStatus(unimplemented: no longer supported) · GetConversationTags(feature removed)
> · GetExternalModel(deprecated) · GetKnowledgeBaseItemsForTeam(deprecated)
> · GetMatchingIndexedRepos(index service deprecated) · GetMatchingCodeContext(not implemented)
> · GetProfileData(需 token 认证, apiKey 不可用) · GetAuthToken(超时无回)。
>
> 第四轮探测(2026-07-11): GetCascadeModelConfigs(unimplemented·官方指向 GetUserStatus)
> · GetCodeMapsForFile(deprecated·改用 GetCodeMapsForRepos——已接) · SetPinnedContext(not implemented)
> · GetPatchAndCodeChange(仅 eval mode) · CheckBugs(api server wire error)
> · CreateTrajectoryShare(契约确认 cascade_id 必填, 但真实 id 下服务端 internal error, 暂不接)
> · UpdatePanelStateWithUserStatus(契约确认 user_status 必填·推送式, 面板已用 StreamCascadePanelReactiveUpdates 拉取式等效)
> · GetStatus 实测返回 {"status":{}}(无增量信息, 不单独接入)。

## 未接入方法（按域分类）

### 面板状态通道 (1)
- UpdatePanelStateWithUserStatus

### 模型/状态 (2)
- GetCascadeModelConfigs(官方已指向 GetUserStatus)
- GetExternalModel(已废弃)

### 会话协作/分享 (3)
- CreateTrajectoryShare
- GetConversationTags(已移除)
- UpdateConversationTags

### 代码编辑确认 (3)
- GetCodeValidationStates
- ResolveOutstandingSteps
- GetPatchAndCodeChange

### 上下文检索 (6)
- GetSuggestedContextScopeItems
- GetMatchingCodeContext
- GetMatchingIndexedRepos
- SetPinnedContext
- SetPinnedGuideline
- RefreshContextForIdeAction

### CodeMap 扩展 (2)
- GetCodeMapsForFile(已废弃·改用 GetCodeMapsForRepos)
- BranchCascadeAndGenerateCodeMap

### 辅助生成 (3)
- CheckBugs
- GetTranscription
- GenerateVibeAndReplaceStreaming

### 工作区/系统 (10)
- AddTrackedWorkspace
- RemoveTrackedWorkspace
- GetStatus
- GetBrainStatus(已废弃)
- GetChangelog
- GetProfileData(需 token 认证)
- StatUri
- MountCascadeFilesystem
- UnmountCascadeFilesystem

### 实验/配置 (8)
- GetUnleashData
- ShouldEnableUnleash
- SetBaseExperiments
- UpdateDevExperiments
- UpdateEnterpriseExperimentsFromUrl
- EditConfiguration
- GetKnowledgeBaseItemsForTeam(已废弃)

### 补全(非Cascade) (7)
- GetCompletions
- AcceptCompletion
- ProvideCompletionFeedback
- HandleStreamingTab
- OnEdit
- WellSupportedLanguages
- GetSystemPromptAndTools

### 遥测/记录(低价值) (14)
- RecordEvent
- RecordSystemMetrics
- RecordSearchDocOpen
- RecordSearchResultsView
- RecordChatFeedback
- RecordChatPanelSession
- RecordCommitMessageSave
- RecordUserStepSnapshot
- RecordUserGrep
- RecordLints
- LogCascadeSession
- SubmitBugReport
- UploadRecentCommands
- ProgressBars

### 其他 (26)
- GetAuthToken
- CancelRequest
- MigrateApiKey
- GetPrimaryApiKeyForDevsOnly
- HandleStreamingCommand
- HandleStreamingTerminalCommand
- ValidateWindsurfJSAppProjectName
- SaveWindsurfJSAppProjectName
- GetChatMessage
- RawGetChatMessage
- SendActionToChatPanel
- CaptureCode
- CaptureFile
- SetupUniversitySandbox
- Exit
- ResetOnboarding
- SkipOnboarding
- GetUserTrajectoryDebug
- SyncExploreAgentRun
- ForceBackgroundResearchRefresh
- StreamTerminalShellCommand
- GetActiveAppDeploymentForWorkspace
- GetWindsurfJSAppDeployment
- UpdateAutoCascadeGithubCredentials
- GetGithubPullRequestSearchInfo
- ReplayGroundTruthTrajectory

> 探测补记(2026-07-11): `GenerateCommitMessage` 契约已确认(`repoRootUri` 必填·无 diff 报
> `no git diffs found`), 但有真实 diff 时服务端 LLM 侧稳定报
> `error grabbing LLM response: stream error`(免费档账号实测 3 连)——命令保持安全降级
> (showWarningMessage), 待付费档/服务端恢复后复测成功 schema。

## 已接入 (86)
AcknowledgeCascadeCodeEdit, ArchiveCascadeTrajectory, BranchCascade, CancelCascadeInvocation, CancelCascadeInvocationAndWait, CancelCascadeSteps, CheckChatCapacity, CheckUserMessageRateLimit, ConvergeArenaCascades, CopyBuiltinWorkflowToWorkspace, CreateCustomizationFile, CreateWorktree, DeleteCascadeMemory, DeleteCascadeTrajectory, DismissCodeMapSuggestion, GenerateCodeMap, GenerateCommitMessage, GetAllAcpRegistries, GetAllCascadeTrajectories, GetAllPlans, GetAllRules, GetAllSkills, GetAllWorkflows, GetAvailableCascadePlugins, GetCascadeMemories, GetCascadeTrajectory, GetCascadeTrajectoryGeneratorMetadata, GetCascadeTrajectorySteps, GetCascadeTranscriptForTrajectoryId, GetClassInfos, GetCodeMapSuggestions, GetCodeMapsForRepos, GetCommandModelConfigs, GetDebugDiagnostics, GetDeepWiki, GetDefaultWebOrigins, GetFunctions, GetLifeguardConfig, GetMatchingContextScopeItems, GetMcpPrompt, GetMcpRegistryServers, GetMcpServerStates, GetMessageTokenCount, GetModelStatuses, GetProcesses, GetRepoInfos, GetRevertPreview, GetSharedCodeMap, GetTeamOrganizationalControls, GetUserMemories, GetUserSettings, GetUserStatus, GetUserTrajectory, GetUserTrajectoryDescriptions, GetWebDocsOptions, GetWorkspaceEditState, GetWorkspaceInfos, HandleCascadeUserInteraction, Heartbeat, ImportFromCursor, InitializeCascadePanelState, InterruptWithQueuedMessage, MoveQueuedMessage, QueueCascadeMessage, RefreshCustomization, RefreshMcpServers, RemoveFromQueue, RenameCascadeTrajectory, ResolveWorktreeChanges, RevertToCascadeStep, SaveCodeMapFromJson, SaveMcpServerToConfigFile, SendUserCascadeMessage, SetUserSettings, ShareCodeMap, SpawnArenaModeMidConversation, StartCascade, StreamCascadePanelReactiveUpdates, StreamCascadeReactiveUpdates, StreamCascadeSummariesReactiveUpdates, StreamUserTrajectoryReactiveUpdates, ToggleMcpTool, UndoWorktreeMerge, UpdateCascadeMemory, UpdateCodeMapMetadata, UpdateMcpServerInConfigFile
