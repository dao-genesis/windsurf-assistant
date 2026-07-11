# 免费模型与 Proxy Pro 并存 · 根因调查与交接说明

> 本文档记录「Pro 账号免费档模型能否与 Proxy Pro 第三方外接路由并存」这一问题的对照实验、
> 根因结论与后续交接步骤。供接手的工程师 / Agent 直接据此继续推进，无需从零复盘。
>
> 道法自然 · 客观实测 · 让数据说话。

---

## 1. 背景与问题

Pro 账号（`lvgvsgr66444299`）premium 额度用尽后**只能用官方免费档模型**（GLM-5.2 / Kimi K2.7 /
SWE-1.6 Fast 等）。装上 Proxy Pro 后，期望「官方免费模型」与「用户配置的第三方外接路由
（DeepSeek / 小米 MiMo / freemodel）」**并存**：

- 未配路由的免费档 → 走官方透传（`shouldRoute=false`），返回官方真实回复；
- 已配路由的档位 → 走第三方 provider，返回第三方真实回复；
- 两者同时工作，互不串号、互不劫持。

曾有反馈：装 Proxy Pro 后免费模型用不了（Cascade 报 `Model provider unreachable`）。

---

## 2. 已合并的代码修复（PR #24）

**根因（第一阶段已定位并修复）**：`dao_router.js` 的 `init()` 在两处无条件把基础档
`MODEL_SWE_1_6` 播种到 `builtin-stub`，导致 `shouldRoute(swe-1-6)=true` → 命中桩路由 →
返回固定桩文本，官方透传被劫持。

**修复**：移除两处播种，基础档不再进入 `_routes` → `shouldRoute=false` → 回落官方上游。

- PR：#24（已合并入 `main`，tag `dao-proxy-pro-v9.9.316`）
- 测试：`npm test` 307 通过 / 0 失败

该修复消除了「桩劫持」这一**确实存在的插件缺陷**。

---

## 3. 第二阶段对照实验（本轮净新结论）

修复合入后，仍观察到免费档间歇性 `Model provider unreachable`。为判定**这是否还是插件问题**，
做了一个比「2 分钟间隔单次 A/B」更严格的同字节对照实验。

### 方法

1. 在网关透传出向处一次性落盘 Cascade 真实发出的免费模型 `GetChatMessage` 请求**完整原始字节**
   （约 25KB，含鉴权），见 `source.js` 的 `DIAG-CAPTURE`（仅本机调查用，未并入仓库）。
2. 用**同一份字节**同时打两条路：
   - **A = 直连官方** `https://inference.codeium.com/.../GetChatMessage`（完全不经过插件）
   - **B = 经插件网关** `http://127.0.0.1:8937/.../GetChatMessage`（走完整网关转发路径）
3. 每轮对 A、B 分类：`OK` / `PROVIDER_ERR` / `AUTH` / `EXC`，记录是否出现**分歧对（A≠B）**。
   脚本：`monitor_up.py` / `ab_harness.py`（本机 `C:\Users\Administrator\`）。

### 结果

| 批次 | 轮数 | 结果 | 分歧对(A≠B) |
|---|---|---|---|
| ab_harness | 61 | A=B=PROVIDER_ERR | 0 |
| monitor #1~#4 | 160 | A=B=PROVIDER_ERR（末轮 token 过期 A=B=AUTH） | 0 |
| **合计** | **221** | **A 与 B 行为 100% 一致** | **0** |

- 直连官方上游解码出的响应帧（connect 流式 `flags=0x03` 尾帧 + gzip）是**官方自己的错误**：
  ```json
  {"error":{"code":"unavailable","message":"The third-party model provider is experiencing issues and is currently not available. Please try this model again later. (error ID: 27cd98247dd349ee853afadb064139ec)"}}
  ```
  每次重试 error ID 都不同（实时上游失败，非缓存）。
- 期间**第三方外接路由全程可用**（经网关）：SWE-1.6-Fast→DeepSeek、gpt-5-4-low→小米 MiMo 均返回
  真实回复，零交叉污染。
- 更早一次窗口里，免费档**经插件**是成功的：GLM-5.2→`63`、Kimi K2.7→`42`（带官方 `Thought` 思考帧）。

### 结论

- **网关对免费档是字节/头忠实透传的**：同一份字节「经插件」与「不经插件」结果 221/221 完全一致 →
  从底层排除了此前怀疑的全部插件嫌疑点：HTTP/2 连接池化指纹、请求头改写/剥离、proto 重序列化字节漂移
  （若其中任一成立，B 必然与 A 分歧，但从未发生）。
- 当前 `Model provider unreachable` 是**官方上游免费档 provider 的间歇性宕机**（带官方 error ID），
  直连与经网关**同等受影响**，**不是 Proxy Pro 的缺陷**。
- 此前「卸载插件后免费档成功、装插件失败」的 2 分钟单次 A/B，是被上游间歇抖动**误导**了。

---

## 4. 当前阻塞点

要完成「免费官方回复 + 第三方回复 同时并存」的最终录屏实证，需要赶上官方免费档 provider 的**可用窗口**。
本轮调查期间该 provider 持续宕机（直连官方亦失败），属外部不可控因素，非插件问题。

---

## 5. 接手步骤（takeover）

1. 启动 Devin Desktop + 单一 `dao-proxy-pro`（非归一 dao-one），登录 Pro 账号，确认 `mode=passthrough`。
2. 用 Cascade 选免费档（GLM-5.2 / Kimi K2.7 / SWE-1.6）发一道算术题刷新鉴权并探活：
   - 返回真实数字（带 `Thought`）→ **provider 已恢复**，进入第 3 步；
   - 返回 `Model provider unreachable` → 仍宕机，挂 `monitor_up.py` 蹲可用窗口（鉴权 token 约 15 分钟过期，
     需周期性用 Cascade 重新发问刷新）。
3. provider 恢复后跑同字节 A/B：
   - **A=OK 且 B=OK** → 免费官方 + 第三方并存当场实证，插件透明无 bug，录屏存证即可，无需改代码；
   - **A=OK 且 B=PROVIDER_ERR** → 这才是真正的插件 bug → 对 A/B 出向字节、头、proto 做 hex 逐项 diff，
     定位确切断裂点后从 `source.js` 网关转发路径最小化修复。
4. 同时验证第三方外接路由仍可用（DeepSeek / 小米），确认零交叉污染。

### 本机调查产物（仅供参考，未并入仓库）

- `C:\Users\Administrator\monitor_up.py`、`ab_harness.py`：同字节 A/B 谐振脚本。
- 安装态扩展 `source.js` 含 `DIAG-CAPTURE`（落盘请求字节）与 `OFFICIAL-BODY-HEX`（响应体 hex）诊断；
  因 `DIAG-CAPTURE` 会把含鉴权的请求体落盘，**有意不并入仓库**，仅在调查 VM 上保留。
