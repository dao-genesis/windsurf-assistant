# 网络足迹实证 · 印 80 · 2026-05-12

> *视之而弗见，名之曰微。听之而弗闻，名之曰希。捪之而弗得，名之曰夷。* —— 帛书·十四章

## 一 · 现场抓取（Get-NetTCPConnection · Established · Windsurf PIDs）

```
==Windsurf 主进程 established TCP 连接 == (58 条)

外部连接（去除 127.0.0.1 与 192.168.* 内网）:

OwningProcess  RemoteAddress    RemotePort  Count  反查
-------------  ---------------  ----------  -----  ----
        27060  35.223.238.178   443         3      178.238.223.35.bc.googleusercontent.com
        28984  34.49.14.144     443         7      144.14.49.34.bc.googleusercontent.com
        28984  13.33.183.67     443         1      server-13-33-183-67.hkg1.r.cloudfront.net
```

## 二 · 正向 DNS（同时刻 8.8.8.8 解析）

```
server.codeium.com               -> 35.223.238.178                                  ✓ 实连 PID 27060 × 3
server.self-serve.windsurf.com   -> 34.49.14.144                                    ✓ 实连 PID 28984 × 7
app.devin.ai                     -> 13.33.183.67, 13.33.183.69, .113, .115          ✓ 实连 PID 28984 × 1
inference.codeium.com            -> 192.34.20.166                                   备用，未实连
web-backend.windsurf.com         -> 34.8.63.254                                     未实连
register.windsurf.com            -> 34.149.234.98                                   未实连
api.devin.ai                     -> 16.144.93.149, 184.33.108.168, 100.22.222.134   未实连
```

## 三 · 断（不出户而知）

| 域 | 用 | 实连状 | 备 |
|----|----|------|----|
| `server.codeium.com` | **Cascade & Devin Cloud 模型推理后端**（ConnectRPC `/exa.language_server_pb.LanguageServerService/GetChatMessage`）| ✓ 主推理 | model_configs_v2.bin 中 30+ 模型均指此 |
| `server.self-serve.windsurf.com` | SeatManagement / Plan / Quota / RegisterUser / GetPlanStatus / **疑 GetSelfDevinSessionToken** | ✓ 心跳/状态 | 7 条并发，疑 keep-alive + LSP 控制信道 |
| `app.devin.ai` | **Devin Cloud wss UI / live session**（CloudFront HK）| ✓ 1 条 | 当前空闲心跳；切到 Devin Cloud 模式时此处会爆发 wss frames |
| `inference.codeium.com` | Cascade 备用推理 | — | cloud_engine.js 列在 INFERENCE_HOSTS 第一位 |

## 四 · 与 cloud_engine.js 三常量对照

```javascript
// e:\道\道生一\一生二\Windsurf万法归宗\010-反代_Proxy\core\cloud_engine.js · line 30-48

const API_HOSTS = [
  "server.codeium.com",                    // ← 35.223.238.178 (实证)
  "server.self-serve.windsurf.com",        // ← 34.49.14.144 (实证)
  "web-backend.windsurf.com",              // ← 34.8.63.254
];

const INFERENCE_HOSTS = [
  "inference.codeium.com",                 // ← 192.34.20.166
  "server.codeium.com",                    // ← 35.223.238.178 (主)
  "server.self-serve.windsurf.com",        // ← 34.49.14.144 (备)
];

const REGISTER_HOSTS = [
  "register.windsurf.com",                 // ← 34.149.234.98
  "server.self-serve.windsurf.com",        // ← 34.49.14.144
  "server.codeium.com",                    // ← 35.223.238.178
];
```

—— **反代核心 host 池与 Windsurf 主进程实连完全对齐**。

## 五 · Devin Local 子进程（devin.exe acp）网络足迹 = 0

```
$ Get-NetTCPConnection | Where-Object { (Get-CimInstance Win32_Process | ?{$_.Name -eq 'devin.exe'}).ProcessId -contains $_.OwningProcess -and $_.State -eq 'Established' }
(空)
```

—— **devin.exe acp 子进程不连云**：印证 ACP 是 stdio JSON-RPC，主进程（Windsurf Electron）持有云端连接。

## 六 · 道纪

> *执今之道，以御今之有。以知古始，是谓道纪。* —— 帛书·十四章

```
                ┌────────────────────────────────────────────┐
                │            Windsurf IDE  (Electron)         │
                │    PID 27060 / 28984                        │
                └─┬──────────┬───────────────────┬────────────┘
                  │          │                    │
                stdio       wss                  HTTPS
                  │          │                    │
                  ▼          ▼                    ▼
          ┌──────────┐  ┌────────────┐  ┌─────────────────────┐
          │ devin.exe │  │ app.devin │  │ server.codeium.com  │ ← Cascade 与
          │ acp ×4    │  │ .ai (CF)  │  │ + self-serve        │   Devin 共域
          │ (stdio    │  │ (wss UI/  │  │ (ConnectRPC over    │
          │  ACP      │  │  live)    │  │  HTTPS, protobuf)   │
          │  agent)   │  │           │  │                     │
          └───────────┘  └───────────┘  └─────────────────────┘
              │              │                  │
              │              │                  ▼
              │              │           [GetChatMessage]
              │              │           [GetSelfDevinSessionToken]
              │              │           [RegisterUser]
              │              │           [GetPlanStatus]
              │              │           [CheckUserMessageRateLimit]
              │              │
              │              └─→ Devin Cloud 实时 UI / sessions
              └─→ 本地 Devin Agent (借 Windsurf IDE 上下文)
```

---

*印 80 · 网络章 · 实证 · 2026-05-12*
