# 官方 RPC 差距矩阵（反者道之动 · 自动生成）

来源: `tools/extract-official.js` 反提官方前端 bundle。

- 官方 LanguageServerService 方法总数: **169**
- 插件已接入: **81**
- 未接入: **88**

> 探测实录(2026-07-11): 以下方法服务端已废弃/不可用, 不再接入 ——
> GetBrainStatus(unimplemented: no longer supported) · GetConversationTags(feature removed)
> · GetExternalModel(deprecated) · GetKnowledgeBaseItemsForTeam(deprecated)
> · GetMatchingIndexedRepos(index service deprecated) · GetMatchingCodeContext(not implemented)
> · GetProfileData(需 token 认证, apiKey 不可用) · GetAuthToken(超时无回)。

## 未接入方法（按域分类）

### 面板状态通道 (1)
- UpdatePanelStateWithUserStatus

### 模型/状态 (2)
- GetCascadeModelConfigs
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

### CodeMap 扩展 (7)
- ShareCodeMap
- GetSharedCodeMap
- GetCodeMapsForFile
- SaveCodeMapFromJson
- UpdateCodeMapMetadata
- DismissCodeMapSuggestion
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

### 遥测/记录(低价值) (15)
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
- RecordChatPanelSession

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

## 已接入 (81)
AcknowledgeCascadeCodeEdit, ArchiveCascadeTrajectory, BranchCascade, CancelCascadeInvocation, CancelCascadeInvocationAndWait, CancelCascadeSteps, CheckChatCapacity, CheckUserMessageRateLimit, ConvergeArenaCascades, CopyBuiltinWorkflowToWorkspace, CreateCustomizationFile, CreateWorktree, DeleteCascadeMemory, DeleteCascadeTrajectory, GenerateCodeMap, GetAllAcpRegistries, GetAllCascadeTrajectories, GetAllPlans, GetAllRules, GetAllSkills, GetAllWorkflows, GetAvailableCascadePlugins, GetCascadeMemories, GetCascadeTrajectory, GetCascadeTrajectoryGeneratorMetadata, GetCascadeTrajectorySteps, GetCascadeTranscriptForTrajectoryId, GetClassInfos, GetCodeMapSuggestions, GetCodeMapsForRepos, GetCommandModelConfigs, GetDebugDiagnostics, GetDeepWiki, GetDefaultWebOrigins, GetFunctions, GenerateCommitMessage, GetLifeguardConfig, GetMatchingContextScopeItems, GetModelStatuses, GetTeamOrganizationalControls, GetUserMemories, Heartbeat, GetMcpPrompt, GetMcpRegistryServers, GetMcpServerStates, GetMessageTokenCount, GetProcesses, GetRepoInfos, GetRevertPreview, GetUserSettings, GetUserStatus, GetUserTrajectory, GetUserTrajectoryDescriptions, GetWebDocsOptions, GetWorkspaceEditState, GetWorkspaceInfos, HandleCascadeUserInteraction, ImportFromCursor, InitializeCascadePanelState, InterruptWithQueuedMessage, MoveQueuedMessage, QueueCascadeMessage, RefreshCustomization, RefreshMcpServers, RemoveFromQueue, RenameCascadeTrajectory, ResolveWorktreeChanges, RevertToCascadeStep, SaveMcpServerToConfigFile, SendUserCascadeMessage, SetUserSettings, SpawnArenaModeMidConversation, StartCascade, StreamCascadePanelReactiveUpdates, StreamCascadeReactiveUpdates, StreamCascadeSummariesReactiveUpdates, StreamUserTrajectoryReactiveUpdates, ToggleMcpTool, UndoWorktreeMerge, UpdateCascadeMemory, UpdateMcpServerInConfigFile