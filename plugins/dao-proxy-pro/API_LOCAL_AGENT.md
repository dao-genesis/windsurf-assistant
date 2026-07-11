# dao-proxy-pro · 本地 Agent 接管 API 全集（道法自然 · 无为而无不为）

> 把本文件交给运行在用户机器上的「本地 Agent」，它即可**热接管**本插件：配渠道、改路由、切系统提示词（SP）、自检、排障 —— 全程**热生效、零窗口重载**（不打断 UI、不杀 Bridge 隧道）。
>
> 本文档由云端 Agent 在 **141（DESKTOP-MASTER · Devin Desktop · dao-proxy-pro v9.9.299）实机**逐端点实测后编写。每个端点标注核验状态：✅=实测 / 📖=源码核对。
>
> **双 origin（一机多 IDE）**：同一台机上可同时跑两个控制面后端——`http://127.0.0.1:8937`（VS Code 侧）与 `http://127.0.0.1:37808`（Devin Desktop 侧）。两者**接口完全一致**，本文以 8937 为例；驱 Devin Desktop 实例时把端口换成 37808 即可。用 `GET /origin/health` 的 `port` 字段确认当前打的是哪个。
>
> 配套：插件内置 `GET /origin/ea/handoff.md` 会按**实时状态**自动生成一份精简交接文档；本文件是其**完整超集**（含 SP/canon 控制面、设计哲学与排障）。

---

## 0. 总览：插件在做什么

dao-proxy-pro 是 Devin/Cascade IDE 的一个本地代理扩展，启动一个**控制面 HTTP 后端**（origin backend），默认监听 `http://127.0.0.1:8937`。它做三件事：

1. **改写系统提示词（SP / canon）**：把官方 SP 替换/叠加为帛书《老子》《阴符经》文本（`invert` 模式），并对工具描述做**去名**（Cascade→you、Windsurf→editor 等）。
2. **路由模型请求**：把官方模型 UID（`swe-1-6-fast` / `swe-1-6-slow` / `gpt-4.1` …）按「路由表」转发到自配渠道（DeepSeek / 小米 MiMo / GitHub Models / 任意 OpenAI-兼容或 Anthropic 渠道）。
3. **优雅兜底**：上游 413/超限时回传**可读错误帧**给 Cascade（而非挂死或静默裁剪）。

> **数据流**：Cascade → 本插件 origin(:8937) → BYOK 网关(`127.0.0.1:11435`) → 本地代理(`127.0.0.1:7890`，翻墙节点) → 各上游 API。

---

## 1. 接入与鉴权

- **控制面 Base URL**：`http://127.0.0.1:8937`（本机回环，**仅本地可达**）。
- **鉴权**：origin 控制面本身**无需 token**（仅监听 127.0.0.1）。
- **远程接管（可选）**：若云端 Agent 需要驱动，经 DAO Bridge 隧道转发，Bridge 侧才需 `Authorization: Bearer <BridgeToken>`。本地 Agent 直接打 `127.0.0.1:8937` 即可。
- **配置落盘**：`~/.codeium/dao-byok/配.json`（注意文件名是 **`配.json`** 不是 `配置.json`）。热改 API 会自动 `_hotSaveConfig()` 持久化到此文件。
- **canon 落盘**：`<ext>/vendor/bundled-origin/_origin_canon.txt`；`mode` 落盘：`_origin_mode.txt`。

---

## 2. 系统提示词 / Canon 控制面（`/origin/*`）

| 方法 | 路径 | Body | 说明 | 核验 |
|---|---|---|---|---|
| GET | `/origin/ping` | - | **健康检查（详版）**：返回 `mode/pid/uptime_s/req_total/dao_loaded/dao_chars/canon/canon_chars` 等。 | ✅ |
| GET | `/origin/health` | - | 存活别名（精简）：`{ok,status,port,pid,uptime_s,mode,canon,dao_loaded,ea_running}`。**`port` 可用来区分 8937/37808**。 | ✅ |
| GET | `/origin/selftest` | - | **三径自检**：`canon_path`/`route_path`/`unlock_path` 三路径诊断 + 顶层 `ok`。 | ✅ |
| GET | `/origin/mode` | - | 当前 SP 模式：`invert`/`passthrough`/`custom` | ✅ |
| POST | `/origin/mode` | `{"mode":"invert"}` | 切 SP 模式 | 📖 |
| GET | `/origin/canon` | - | 当前经文 + `valid:["laozi","yinfu","laozi+yinfu"]` + `map` | ✅ |
| POST | `/origin/canon` | `{"canon":"yinfu"}` | 切经文，热生效并落盘 | ✅ |
| GET | `/origin/preview` | - | 预览注入后的 SP（`after`） | ✅ |
| GET | `/origin/lastinject` | - | 最近一次注入的诊断（前后字数、kind、role） | ✅ |
| GET | `/origin/sig` | - | SP 指纹、注入计数、tape 计数 | ✅ |
| GET | `/origin/tape` | - | 最近若干次改写记录（环形，max 16） | ✅ |
| GET | `/origin/paths` | - | 最近路由轨迹（捕获到的上游路径） | ✅ |
| GET | `/origin/allinjects` | - | 按 kind 分类的注入快照 | 📖 |
| GET/POST/DELETE | `/origin/custom_sp` | `{...}` | 读/设/清自定义 SP（`custom` 模式用） | 📖 |
| GET | `/origin/model_catalog` | - | 内置模型目录（实测 **108** 个） | ✅ |
| GET | `/origin/model_unlock` | - | 模型解锁开关 + 目录加载状态 | ✅ |

### Canon 三模式（实测字数）
| canon | 内容 | 字数 | 何时用 |
|---|---|---|---|
| `laozi` | 帛书《老子》 | ~7126 | 默认全注入主体之一 |
| `yinfu` | 《阴符经》 | **~597** | **对话过长时由用户手动选**（最省 token，无需提示） |
| `laozi+yinfu` | 帛《老》+《阴符经》 | ~7715 | 最全注入（当前 141 默认） |

> **「编」（本源观照·编辑注入 SP）读哪来的文本**：UI 点「编」打开编辑态时走 `GET /origin/custom_sp`，该端点**永返 `default_sp`**：`has_custom=false` 时为 `_canonHeader(canon)+当前经文+TAO_FOOTER`（**随当前 canon 动态**，帛书老子/阴符经名实相符）；`has_custom=true` 时返 `sp`（用户自定义）。**v9.9.299 修复**：三模块面板①的「编」不再回退 `/origin/preview`（那依赖实时捕获流量·无对话时为空→「跳有跳没」），改为永以 `default_sp` 填充，与侧栏 EssenceProvider 同源稳态。Agent 要读“当前将注入的核心经文”请用 `/origin/custom_sp.default_sp`（确定性）而非 `/origin/preview`（依赖捕获）。

> 切换示例：`curl -X POST http://127.0.0.1:8937/origin/canon -H 'Content-Type: application/json' -d '{"canon":"yinfu"}'`

---

## 3. 路由 / 渠道控制面（`/origin/ea/*`）

### 3.1 只读
| 方法 | 路径 | 说明 | 核验 |
|---|---|---|---|
| GET | `/origin/ea/overview` | 一站式：渠道+路由+模型源+健康快照 | ✅ |
| GET | `/origin/ea/status` | `ready` + 路由 uid 数与列表 + gateway | ✅ |
| GET | `/origin/ea/config` | 完整配置（含 gateway.proxy） | ✅ |
| GET | `/origin/ea/providers` | 渠道列表（**apiKey 已脱敏** `ghp_qyvd***`） | ✅ |
| GET | `/origin/ea/routes` | 路由表（官方模型 UID → 渠道/模型） | ✅ |
| GET | `/origin/ea/models/:name` | 单模型详情 | 📖 |
| GET | `/origin/ea/available-models` `/seen-models` `/discover-models` | Cascade 实际请求过的模型 | ✅ |
| GET | `/origin/ea/live-models` `/model-map` | 实时模型 + 路由映射 | ✅ |
| GET | `/origin/ea/handoff.md` | **按实时状态自动生成的交接 MD**（可直接喂给本地 Agent） | ✅ |

### 3.2 热写（即时生效，**不重启窗口**）
| 方法 | 路径 | Body | 说明 | 核验 |
|---|---|---|---|---|
| POST | `/origin/ea/provider` | `{"name":"...","cfg":{...}}` | 新增/更新渠道 | ✅ |
| DELETE | `/origin/ea/provider/:name` | - | 删渠道（**级联删除引用它的路由**，返回 `{ok:true,removedRoutes:N}`） | ✅ |
| POST | `/origin/ea/route` | `{"modelUid":"...","route":{...}}` | 新增/更新路由 | ✅ |
| DELETE | `/origin/ea/route/:uid` | - | 删路由（自动清规整化的别名 key） | ✅ |
| POST | `/origin/ea/config` | 整个 config 对象 | 批量写配置 | 📖 |
| POST | `/origin/ea/reload` | `{}` | 从盘重载配置，返回 `{ok,count}` | ✅ |
| POST | `/origin/ea/reset-health` | `{}` | 清健康缓存 | ✅ |
| POST | `/origin/ea/probe` | `{}` | **真·端到端探活**：对每渠道发最小 chat，返回 `{alive,reason,status,model,elapsed_ms,sample}` | ✅ |
| POST | `/origin/ea/test-chat` | `{"modelUid":"...","message":"..."}` | 冒烟测某档是否打通（返回真实 content） | ✅ |

### 3.3 三主力渠道的可用配置（实测打通）
```jsonc
// providers（写入 配.json，或 POST /origin/ea/provider）
"deepseek": { "baseUrl":"https://api.deepseek.com/v1", "driver":"openai",
              "apiKey":"sk-***", "models":["deepseek-chat","deepseek-reasoner"], "enabled":true },
"xiaomi":   { "baseUrl":"https://api.xiaomimimo.com/v1", "driver":"openai",
              "apiKey":"sk-***", "models":["mimo-v2.5-pro"], "enabled":true },
"github":   { "baseUrl":"https://models.github.ai/inference", "driver":"openai",
              "apiKey":"ghp_***", "models":["openai/gpt-4.1","openai/gpt-4.1-mini","openai/gpt-4o"], "enabled":true }

// routes（官方模型 UID → 渠道）
"swe-1-6-fast":      { "provider":"deepseek", "model":"deepseek-reasoner" }   // Fast 档 → DeepSeek
"swe-1-6-slow":      { "provider":"xiaomi",   "model":"mimo-v2.5-pro", "maxOutputTokens":16384 } // Slow 档 → 小米 MiMo
"gpt-4.1":           { "provider":"github",   "model":"openai/gpt-4.1" }      // → GitHub Models
```
> 实测：`POST /origin/ea/test-chat {modelUid:"swe-1-6-fast"}`→`DAO-OK-DEEPSEEK`(200)；`swe-1-6-slow`→`DAO-OK-XIAOMI`(200)。GitHub 档依赖国际代理节点（见 §6）。

### 3.4 智谱清言 GLM（zhipu）渠道 · 实测打通
```jsonc
// provider（写入 配.json，或 POST /origin/ea/provider）
"zhipu": { "baseUrl":"https://open.bigmodel.cn/api/paas/v4", "driver":"openai",
           "apiKey":"<智谱 APIKey · open.bigmodel.cn/usercenter/apikeys>",
           "models":["glm-4-flash","glm-4.5-flash","glm-4.6","glm-4.5","glm-4.5-air"],
           "noProviderPrefix":true, "enabled":true, "label":"智谱清言 GLM" }
```
- 实测（141 · v9.9.299）：给一个**非保护的**官方 modelUid 加路由 `→ zhipu/glm-4-flash`，`POST /origin/ea/test-chat` 返 `200 · content:"DAO-OK-GLM" · finish_reason:stop · ~1.9s`。✅
- ⚠ **GLM/DeepSeek/Qwen 是受保护家族**（`dao_router._PROTECTED_FAMILIES`）：`shouldRoute("glm-4-flash")` **永返 false**（被 `isModelProtected` 拦）。所以**不要把 `glm-*` 本身当作要路由的官方 modelUid**；正确用法是在 ③模型路由把某个官方 Cascade 档（如 `swe-1-6-fast` / `gpt-4o-mini`）连到 `zhipu` 渠道。
- ⚠ **免费/付费档**：`glm-4-flash`/`glm-4.5-flash` 免费可用；`glm-4.6`/`glm-4.5`/`glm-4.5-air` 等付费档需账户余额，余额不足返 **429**。默认先用免费档验证连通性。

---

## 4. 设计哲学：413 / token 预算 = 兵者藏而不用

**默认行为 = 原生全注入，不裁剪**。这一点对本地 Agent 很重要，请勿误改：

- 存在一个 token 预算模块（`vendor/外api/core/budget.js`，`DEFAULT_BUDGET.maxContextTokens=128000`），但在主路由路径里 **`budget.apply` 只做统计、不改写 messages/tools**（源码 `dao_router.js` 注释原文：`不换messages/tools → 仅录计 · 知而不动 · 超时才裁`）。
- 因此**出站请求保留完整原生工具板块**（工具名/参数名是契约，原样保留；仅描述去名），加上完整经文注入。
- 上游真 413 时：回传**可读人话错误帧**（建议「换额度更大的道 / 精简上下文 / 新建对话」），**不静默裁剪**。
- 对话过长的处理顺序：① 用户自选 `canon=yinfu`（597 字，最省，无需提示）→ ② 仅当「阴符经 + 工具」仍超时，才考虑启用预算裁剪这个**默认关闭**的小功能（按 route 设 `budget`/全局 `setBudgetConfig` 开启）。

> 一句话：**优化是兵器，藏而不用**。本地 Agent 不要默认开启任何裁剪/压缩；保持原生。

---

## 5. 去名（de-naming）设计

- 工具**描述**里的产品标识被递归替换（Cascade→you、Windsurf→editor、Codeium/CascadeProjects/Cognition 去除）。
- 工具**名与参数名保持不变**（它们是工具调用契约，改了会破坏 tool calling）。例如 `check_deploy_status` 的参数 `windsurf_deployment_id` **故意保留**——这是契约，不是泄漏。
- 实测：抓真实出站载荷（123KB，80+ 工具），大写身份标记 `Cascade/CascadeProjects/Windsurf/Codeium/Cognition` **泄漏 = 0**。

---

## 6. 运行期排障（本地 Agent 自救手册）

| 症状 | 真相 / 处理 |
|---|---|
| `GET /origin/health` 返回 404 | 旧实例无此口；**当前 141 运行实例（origin build `v9.9.93-dao-fa-zi-ran`）已实装并实测 ✅**。注意 `/api/health` 是 Bridge 的，不是 origin 的。 |
| `GET /origin/selftest` 404 | 旧实例未实装；**当前 141 运行实例已实装并实测 ✅**（三径自检：道魂/外接/解锁）。 |
| DELETE 渠道/路由「无响应、没删掉」 | 多半是客户端问题：**PowerShell `Invoke-WebRequest -Method Delete` 不可靠**。改用 `curl.exe -X DELETE ...` 即正常（实测 `{ok:true}`）。 |
| `test-chat` 报 `Expected property name ... position 1` | JSON body 被 shell 引号吞了。Windows 上别用 `curl --data '{...}'`；用 `Invoke-WebRequest -Body $json`（预拼字符串）或 `curl --data "@file.json"`。 |
| `github` 档 `ETIMEDOUT 199.59.148.9:443` | `models.github.ai` 经本地代理(`7890`)当前不可达（GFW/节点问题）。DeepSeek/小米走同一代理正常 → 换代理节点即可。GitHub 免费层 8000-token 硬限，**几乎无人用**，低优先。 |
| `freemodel-test` 探活 `Access Denied` | 该渠道是**占位 key**（`fe_oa_TESTKEY`），非 bug。填真 key 或忽略。 |
| 改配置后想生效又怕断隧道 | 用**热端点**（`/origin/ea/provider|route|reload`、`/origin/canon`）——全部热生效，**绝不要**调 `/api/self/reload`（窗口重载会杀 quick 隧道）。 |

### 本地 Agent 标准自检三连
```bash
curl -s http://127.0.0.1:8937/origin/ping            # 后端活着？canon/mode 对不对？
curl -s -X POST http://127.0.0.1:8937/origin/ea/probe # 各渠道端到端通不通？
curl -s http://127.0.0.1:8937/origin/ea/overview      # 渠道+路由+健康一览
```

---

## 7. 已知缺口 / 待完善（如实记录）

- `/origin/selftest` + `/origin/health`：**已实装并在 141 运行实例实测通过 ✅** —— `health`=ping 精简别名（含 `port` 可分辨 8937/37808），`selftest`=三径（道魂/外接/解锁）自检。
- 「对话过长」时的预算裁剪：machinery 已在 `budget.js`，但主路径只统计不施加；若将来确需「阴符经+工具仍超」的兜底裁剪，需把 `budget.apply` 的结果在发送路径按 route 开关施加（默认仍关）。

---

_道法自然 · 无为而无不为 · 损之又损以至于无为。本文档基于 141 实机（origin build v9.9.93-dao-fa-zi-ran · 扩展 v9.9.299）逐端点实测编写。_
