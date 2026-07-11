# ACP 协议实证 · 印 80 · 2026-05-12

> **执今之道，以御今之有。** —— 帛书·十四章
>
> 探针 `_samples/_acp_probe.js` · spawn `devin.exe acp` · 三笔 JSON-RPC handshake · 落 `devin_acp_handshake.jsonl`

---

## 一 · 二进制真名（玄同之名）

ACP server 自报 `agentInfo`：

```json
{
  "name": "affogato",
  "title": "Affogato Agent",
  "version": "0.0.0-dev"
}
```

stderr log 揭：

```
2026-05-12T09:57:10.248902Z  INFO chisel_agent::acp_server::agent_impl: ACP: client capabilities — ...
```

—— **`chisel_agent` codename 之续**：印 79 之 chisel binary （Devin DRS sandbox-create CLI）→ 同源 Rust crate `chisel_agent` 之 `acp_server::agent_impl` 模块 → 对外名 `Affogato Agent`（意式甜品，espresso 浇冰淇淋——与 chisel codename 一脉）。

**断**：`devin.exe` = `chisel_agent` 二进制 + `acp` 子命令模式 = **同一程序，多模式分晋**。

## 二 · ACP 帧格式（line-delimited JSON-RPC 2.0）

| 项 | 值 |
|---|---|
| Transport | stdio |
| Encoding | line-delimited JSON-RPC 2.0（**非 LSP-style Content-Length**） |
| Direction | client → agent: stdin； agent → client: stdout； log: stderr |
| Schema crate | `agent_client_protocol_schema` |
| Protocol version | `1`（initialize result） |

—— `V179_ACP_本地适配_接入指南.md` 之骨架（line-delimited）**完全契合**。

## 三 · initialize 完整响应（agent capabilities）

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": 1,
    "agentCapabilities": {
      "loadSession": true,
      "promptCapabilities": {
        "image": true,
        "audio": false,
        "embeddedContext": true
      },
      "mcpCapabilities": {
        "http": false,
        "sse": false
      },
      "sessionCapabilities": {
        "list": {},
        "additionalDirectories": {}
      },
      "_meta": {
        "cognition.ai/multiRootWorkspace": true,
        "cognition.ai/sessionRename": true
      }
    },
    "authMethods": [
      {
        "id": "windsurf-api-key",
        "name": "API Key",
        "description": "Authenticate with your API key"
      }
    ],
    "agentInfo": {
      "name": "affogato",
      "title": "Affogato Agent",
      "version": "0.0.0-dev"
    },
    "_meta": {
      "mcpConfigPath": "C:\\Users\\Administrator\\AppData\\Roaming\\devin\\config.json"
    }
  }
}
```

### 3.1 关键洞见

| 维 | 值 | 何意 |
|---|---|---|
| `authMethods[0].id` | `windsurf-api-key` | **共 Windsurf 账号** —— authenticate 时传 `params.methodId="windsurf-api-key"` |
| `_meta.mcpConfigPath` | `%APPDATA%\devin\config.json` | MCP 配置门，与 Cascade 共享 MCP 池之底（Cognition 自家协议） |
| `cognition.ai/multiRootWorkspace` | true | 多 workspace（v110 元数据键之一）|
| `cognition.ai/sessionRename` | true | 会话重命名（v110 元数据键之一）|
| `promptCapabilities.image` | true | 多模态：image 入 prompt 已支持 |
| `promptCapabilities.audio` | false | audio 未启 |
| `mcpCapabilities.http/sse` | false | MCP 当前只支 stdio（不支 http/sse 远端 MCP） |

## 四 · authenticate 错误探（带出 schema 类型名）

发 `{ "method": "authenticate", "params": {} }`（缺 methodId）：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Invalid params",
    "data": {
      "error": "missing field `methodId`",
      "json": {},
      "phase": "deserialization"
    }
  }
}
```

—— **正解**：authenticate 必带 `params.methodId="windsurf-api-key"`（来自 §3 authMethods）+ token。

错误 stderr 内嵌 schema 类型名集合（已规整去重）：

```text
agent_client_protocol_schema::agent::SetSessionModeRequest
agent_client_protocol_schema::agent::SetSessionConfigOptionRequest
agent_client_protocol_schema::agent::ClientRequest
agent_client_protocol_schema::agent::CancelNotification
agent_client_protocol_schema::agent::ClientNotification
```

—— **断**：ACP 还有 `setSessionMode` / `setSessionConfigOption` 两个 session 控制 method，超出 v110 公开记载。

## 五 · 扩展方法探（cognition.ai/* RPC）

发不存在 method `_meta/list`：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": { "code": -32601, "message": "Method not found" }
}
```

stderr 揭：

```
INFO chisel_agent::acp_server::agent_impl: Received extension method: method=meta/list, params=RawValue({})
```

—— **断**：ACP server 把 `_meta/*` 当 "extension method" 路由（即 `_cognition.ai/*` 之类），与 v110 解构 §5.1 揭示的 `_cognition.ai/mcp/listServers`、`_cognition.ai/revert/preview` 等 RPC 命名约定**完全对齐**。

## 六 · 完整 ACP method 集（推断 + 实证）

| Method | 状 | 源 |
|---|---|---|
| `initialize` | ✓ 实证 | probe id=1 成功 |
| `authenticate` | ✓ 实证（缺 methodId） | probe id=2，error 揭参数结构 |
| `session/new` | 推 | ACP 标准 |
| `session/load` | 推 + agentCapabilities.loadSession=true 暗示 | probe |
| `session/list` | 推 + sessionCapabilities.list 暗示 | probe |
| `session/prompt` | 推 | ACP 标准 |
| `session/cancel` | 推 | ACP 标准 |
| `agent/setSessionMode` | 实证 | error 内嵌 schema |
| `agent/setSessionConfigOption` | 实证 | error 内嵌 schema |
| `agent/cancelNotification` | 实证（notification） | error 内嵌 schema |
| `_cognition.ai/mcp/listServers` | 推（v110 解构）| ext method |
| `_cognition.ai/mcp/toggleServer` | 推 | ext method |
| `_cognition.ai/mcp/toggleTool` | 推 | ext method |
| `_cognition.ai/revert/listSteps` | 推 | ext method |
| `_cognition.ai/revert/preview` | 推 | ext method |
| `_cognition.ai/revert/execute` | 推 | ext method |
| `_cognition.ai/revert/forkFromStep` | 推 | ext method |
| `_cognition.ai/session/rename` | 推 + agentCapabilities._meta.sessionRename=true | probe + v110 |

## 七 · 道义 PoC（不偷 token · 仅 protocol 探）

probe 仅做：

1. spawn `devin.exe acp` (stdio)
2. send `initialize` (空 capabilities)
3. send `authenticate` (空 params · 不传 token)
4. send `_meta/list` (探 ext method 路由)
5. 1.6s 后 EOF · kill

**全程 0 网络请求 · 0 token 注入 · 0 副作用**。

## 八 · 反向逆流之 ACP 路径（更新 V179 接入指南）

```javascript
// dao_local_adapter.js · 更新骨架（基于实证）

async function dispatch(req) {
  switch (req.method) {

    case "initialize":
      return {
        jsonrpc: "2.0", id: req.id,
        result: {
          protocolVersion: 1,
          agentCapabilities: {
            loadSession: true,
            promptCapabilities: { image: false, audio: false, embeddedContext: true },
            mcpCapabilities: { http: false, sse: false },
            sessionCapabilities: { list: {}, additionalDirectories: {} },
            _meta: { "cognition.ai/sessionRename": true }
          },
          authMethods: [
            { id: "dao-api-key", name: "Dao API Key",
              description: "本机 :7860 三协议网关复用" }
          ],
          agentInfo: {
            name: "dao-standalone-7860",
            title: "道独立体 · 130 · 109模型",
            version: "1.2.0"
          }
        }
      };

    case "authenticate":
      // params.methodId="dao-api-key" + 可选 token
      return { jsonrpc: "2.0", id: req.id, result: {} };

    case "session/new":
      // 创会话, 返 sessionId
      return { jsonrpc: "2.0", id: req.id,
               result: { sessionId: crypto.randomUUID() } };

    case "session/prompt":
      // params.sessionId, params.prompt[*]
      // 转 130 :7860 /v1/chat/completions
      return await forwardToDao(req);

    // ... 其他 method 待 IDE 实测要 ...
  }
}
```

—— 即可成"道·Devin Cloud Shim"，从 Windsurf IDE 内的 ACP agent 选择器即得。

---

*印 80 · ACP 章 · 实证毕 · 2026-05-12*
*活水：`_findings/devin_acp_handshake.jsonl` · 全 frames 已落*
*下一笔：authenticate(methodId="windsurf-api-key", token="<sk-ws-* | devin-session-token$*>") + session/new + session/prompt 完整链路*
