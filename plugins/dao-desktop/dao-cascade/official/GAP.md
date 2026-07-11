# 官方 RPC 差距矩阵（反者道之动 · 自动生成）

来源: `tools/extract-official.js` 反提官方前端 bundle。

- 官方 LanguageServerService 方法总数: **169**
- 插件已接入: **73**
- 未接入: **96**

## 未接入方法（按域分类）

### 面板状态通道 (3)
- InitializeCascadePanelState
- UpdatePanelStateWithUserStatus
- StreamCascadePanelReactiveUpdates

### 模型/状态 (4)
- GetCascadeModelConfigs
- GetModelStatuses
- GetExternalModel
- CheckChatCapacity

### 会话协作/分享 (4)
- CreateTrajectoryShare
- GetConversationTags
- UpdateConversationTags
- GetUserMemories

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

### 辅助生成 (4)
- GenerateCommitMessage
- CheckBugs
- GetTranscription
- GenerateVibeAndReplaceStreaming

### 工作区/系统 (10)
- AddTrackedWorkspace
- RemoveTrackedWorkspace
- GetStatus
- GetBrainStatus
- GetChangelog
- GetProfileData
- Heartbeat
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
- GetTeamOrganizationalControls
- GetKnowledgeBaseItemsForTeam

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

## 已接入 (73)
AcknowledgeCascadeCodeEdit, ArchiveCascadeTrajectory, BranchCascade, CancelCascadeInvocation, CancelCascadeInvocationAndWait, CancelCascadeSteps, CheckUserMessageRateLimit, ConvergeArenaCascades, CopyBuiltinWorkflowToWorkspace, CreateCustomizationFile, CreateWorktree, DeleteCascadeMemory, DeleteCascadeTrajectory, GenerateCodeMap, GetAllAcpRegistries, GetAllCascadeTrajectories, GetAllPlans, GetAllRules, GetAllSkills, GetAllWorkflows, GetAvailableCascadePlugins, GetCascadeMemories, GetCascadeTrajectory, GetCascadeTrajectoryGeneratorMetadata, GetCascadeTrajectorySteps, GetCascadeTranscriptForTrajectoryId, GetClassInfos, GetCodeMapSuggestions, GetCodeMapsForRepos, GetCommandModelConfigs, GetDebugDiagnostics, GetDeepWiki, GetDefaultWebOrigins, GetFunctions, GetLifeguardConfig, GetMatchingContextScopeItems, GetMcpPrompt, GetMcpRegistryServers, GetMcpServerStates, GetMessageTokenCount, GetProcesses, GetRepoInfos, GetRevertPreview, GetUserSettings, GetUserStatus, GetUserTrajectory, GetUserTrajectoryDescriptions, GetWebDocsOptions, GetWorkspaceEditState, GetWorkspaceInfos, HandleCascadeUserInteraction, ImportFromCursor, InterruptWithQueuedMessage, MoveQueuedMessage, QueueCascadeMessage, RefreshCustomization, RefreshMcpServers, RemoveFromQueue, RenameCascadeTrajectory, ResolveWorktreeChanges, RevertToCascadeStep, SaveMcpServerToConfigFile, SendUserCascadeMessage, SetUserSettings, SpawnArenaModeMidConversation, StartCascade, StreamCascadeReactiveUpdates, StreamCascadeSummariesReactiveUpdates, StreamUserTrajectoryReactiveUpdates, ToggleMcpTool, UndoWorktreeMerge, UpdateCascadeMemory, UpdateMcpServerInConfigFile