# 07 · Devin Local ACP 推理拦截全链实证 (2026-10-22)

> 核心结论：Devin Local (devin.exe acp / chisel) 的**推理流量可经服务端下发配置的端点字段重定向进本地 origin**，与 Cascade 共用同一条 `GetChatMessage → CHAT_PROTO → SP改写 → dao_router` 管道。**已实测端到端成环**。

## 实证链 (live evidence)

### 1. chisel api-server 通道 = WINDSURF_API_SERVER_URL 锚定 ✓
- `WINDSURF_API_SERVER_URL=http://127.0.0.1:18958`(tee) 时,chisel 全部 Connect-RPC 经 tee → :8957:
  `GetUserStatus / GetCliTeamSettings / GetCliModelConfigs / GetAccountManagedPlugins / RecordCortexTrajectoryStep / GetUserJwt` 全命中。
- devin CLI 自身亦报告 override 生效。

### 2. 推理端点来自服务端下发配置 ✓
- `GetCliModelConfigs` 响应 (application/proto, ~120KB): **tag18 字段 = `https://server.codeium.com` ×249**（每模型一个端点）。
- `GetUserStatus` 响应 (~132KB): tag7=`https://api.devin.ai`, tag18=server.codeium.com ×240。
- 重写 `server.codeium.com` → `http://127.0.0.1:18958` 后,chisel 的 `GetChatMessage` 即刻出现于 tee——**推理端点即由此字段驱动**。
- `api.devin.ai` 直连仍存在（35.81.204.66:443, prompt 时刻出现）= Devin 云会话同步通道,**非推理**——不需重写,留着无害。

### 3. 端到端真通 ✓
- `session/prompt "say DAO"` → `agent_message_chunk: "DAO"` → `stopReason=end_turn` · usage 17832in/52out。
- 同一链路早前返回过真实 `quota_exhausted`(官方后端鉴权+计费路径全通)。
- chisel GetChatMessage 经 tee 时为 `application/connect+proto` (Connect 帧壳) → :8957 分类 CHAT_PROTO。

### 4. 请求体布局 = Cascade 同构 ✓ (决定性)
- 解码 `_req_…GetChatMessage.bin` (74KB):
  - f1: clientMeta (`dao-probe`, ver `3000.4.25`, session JWT, `windows`, product=`chisel`)
  - f3: 消息数组 (system_info / available_skills / 28KB SP / "say DAO")
  - f8: 采样参数 (128000 ctx, temp≈1.0, top-p≈0.95)
  - **f21 str = `swe-2-high`** ← 模型 UID 与 Cascade `CHAT_MODEL_UID:21` **同字段同格式**
  - f10: 工具定义
- 推论: `dao_router.extractModelUid` / `shouldRoute` / `route()` **零适配直接可用**;`invertSP/modifySPProto` 的 msgs-field 探测(findMsgsField)亦兼容。

## 缺口 (实现清单)
线上 `dao-proxy-min 9.9.64` 距打通差三块:

| 缺口 | 现状 | 处方 |
|---|---|---|
| A. ACP env 锚定 | extension.js spawn-hook 仅改写 `language_server --api_server_url`,不碰 devin.exe acp | spawn hook 对 `devin.exe … acp` 注入 `env.WINDSURF_API_SERVER_URL=proxyUrl` (pro 已有 _fixAcpOpts 范式) |
| B. 配置端点重写 | source.js `proxyToCloud` 响应仅 pipe 直透 | 对 `GetUserStatus|GetCliTeamSettings|GetCliModelConfigs` 缓冲响应→proto 树重写 `https://server.codeium.com`→`http://127.0.0.1:{port}`(gzip 需先解再压) |
| C. dao_router | min 无 `外接api\core\dao_router.js`(vendor 是旧 gateway 架构) | 拷 pro `vendor\外接api\core\` + `_mainHandler` CHAT_PROTO 支路接 extractModelUid→shouldRoute→route();`配置.json` 补 `swe-2-*` 路由 |

## 取证工件 (_dao_diag)
- `_acp_tee.cjs` · 18958→8957 proto 级端点重写转发器 (json/帧壳/unary 三模)
- `_proto_dump.cjs` · 离线 proto 字段树+字符串解码器
- `_acp_drive.cjs` · ACP 会话驱动 (init→auth→session/new→prompt)
- `_bg_tee_test.ps1` · 后台全流程采集 (conn/paths/tee scan)
- `_req_*.bin` · chisel GetChatMessage 请求体原件

## 未决/注意
- `34.160.81.0:443` 长连(独立于重写)——疑似 Devin 会话同步/eventstream,非推理,未深追。
- quota_exhausted 表明官方额度见底;BYOK 路由上线后 Devin-local 推理可落 deepseek 等,既绕额度也达「共用链路」目标。
- 部署 min 新版会重启 ext-host origin——短暂断 :8957(影响进行中的 Cascade 会话,含本驱动会话)。选闲时装。
- 凭据卫生:`_acp_drive*.txt` 含 token 串——清理后再留档。
