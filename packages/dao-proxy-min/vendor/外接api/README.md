# vendor/外接api/ · 道Agent · 印 124 · 第一细药

> **图难于其易也，为大于其细也。天下之难作于易，天下之大作于细。是以圣人终不为大，故能成其大。** —— 帛书《老子》六十三章

## 一句话

第三方 LLM (GitHub Models / DeepSeek / Anthropic / Mistral / Cohere / Ollama / OpenAI / Gemini / LG-Code 等 14 provider) **无感入 Cascade 选单**，与官方 4 BYOK 一视同仁。**主公一字开**，**默不扰心**。

## 与 min 主体之关系

```text
┌─────────────────────────────────────────────────────────────────────┐
│  dao-proxy-min v9.9.0  (印 124 · 一身两轨 · 反者道之动)              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ① 反代核轨 (字节级守 · 主公 9.8.0 已 commit · 不动一字)            │
│     vendor/bundled-origin/source.js          ← Cascade Connect-RPC  │
│         + _silk_dao.txt / _silk_de.txt        ← 帛书 SP 注入起首    │
│     codeium.apiServerUrl :8889..8988 (per-user FNV-1a)              │
│     职: 守 SP 注入之心 · 二态切换 · 三档 RPC 全覆盖                  │
│                                                                     │
│  ② 外接 api 轨 (印 124 · 第一细药 · 本文件夹 · 默关)                │
│     vendor/外接api/gateway/server.js          ← 14 provider 路由    │
│     vendor/外接api/lm_register.js             ← vscode.lm 注 N 模   │
│     vendor/外接api/runtime.js                 ← 启停 wrapper        │
│     独立端口 :11635..11734 (per-user FNV-1a · 与反代核不撞)         │
│     职: 展 N 模选用之能 · 与 4 BYOK 一视同仁                         │
│                                                                     │
│  二轨字节级正交 · 互不依赖 · 道并行而不相悖                          │
└─────────────────────────────────────────────────────────────────────┘
```

## 开通 (主公一字)

```text
1. Ctrl+Shift+P → 设置 · 搜 "dao.外接api.enabled" · 勾上
2. 重启 Windsurf (或调 dao.外接api.toggle 命令)
3. 编 ~/.codeium/dao-byok/配置.json · 填 provider 之 apiKey + enabled:true
4. Cascade 模型选择器搜 "dao-" 即见 14 provider 之 N 模
```

或一行命令：
```text
Ctrl+Shift+P → 道Agent: 外接 API 开关 (dao.外接api.toggle)
```

## 配置

启动时 (若 `~/.codeium/dao-byok/配置.json` 不存)，自动复 `vendor/外接api/配置.example.json` 至此处。主公可手编。

配置查找顺序 (前者优先)：
1. `$DAO_BYOK_CONFIG` 环境变量
2. `~/.codeium/dao-byok/配置.json`
3. `~/.codeium/dao-byok/config.json`
4. `vendor/外接api/配置.json`
5. `vendor/外接api/配置.example.json` (兜底)

跨 vsix 升级**不丢主公配置** (在用户域)。

## 端点 (gateway 子进程 · 独立端口)

```text
POST /v1/messages              — Anthropic 原生格式
POST /v1/chat/completions      — OpenAI 格式
GET  /v1/models                — 模型目录
GET  /health                   — 健康
GET  /__dao/providers          — provider 列表 (lm_register 用)
GET  /__dao/config             — 配置 (apiKey masked)
GET  /__dao/diag               — 诊断
POST /__dao/config             — 写配置
POST /__dao/config/reload      — 热重载
```

## 件 (字节级移自 dao-proxy-max v1.0.8 · 印 123 实证 22 模真活)

```text
vendor/外接api/
├─ runtime.js                 (~250 行 · 启停 wrapper · 本文)
├─ lm_register.js             (~400 行 · vscode.lm 注 · 抽 max ext L666-1018)
├─ 配置.example.json          (2.3KB · GitHub Models 极简 · 14 provider 全字段见 max README)
├─ README.md                   (本文)
└─ gateway/                   (字节级 cp from max/vendor/gateway/ · zero-dep)
   ├─ server.js               (55.7KB · 主入口 · CLI: --port --config)
   ├─ registry.js             (10.1KB · Provider 注册中心)
   ├─ capabilities.js         (7.3KB · 各 model 之 tool/vision/system 能力辨)
   ├─ translate.js            (27.7KB · Anthropic ↔ OpenAI ↔ Gemini ↔ Ollama 协议互转)
   ├─ package.json            (0.5KB)
   └─ providers/
      ├─ openai.js            (4KB · GitHub Models / DeepSeek / OpenAI / Moonshot / ...)
      ├─ anthropic.js         (1.1KB · Anthropic 原生)
      ├─ gemini.js            (1.5KB · Google Gemini)
      ├─ ollama.js            (1KB · 本地 Ollama)
      └─ http.js              (5.1KB · 通用 HTTP helper)
```

## 道义

> *道并行而不相悖.* —— 《老子》
>
> *为之于其未有也, 治之于其未乱也.* —— 六十四章
>
> *合抱之木, 生于毫末.* —— 六十四章

**第一细药 (印 124)** = min 反代核之外，加 vendor/外接api/ 一文件夹。**作于易，作于细**。

后续第二细药 (B 之事) 待主公验后再图：
- byok 字节级劫 (GetCascadeModelConfigs 注入) · 让外接模型与 4 BYOK 共槽
- Windsurf 自模反代
- Devin Cloud 模反代
- 1 webview 面板 (SP/外接/Windsurf反代/Devin反代/诊断 五区)

> *圣人终不为大, 故能成其大.* —— 六十三章

---

**印 124 · 承印 123 之实 (max 22/38 模真活) · 归一于 min · 居其厚不居其薄**
