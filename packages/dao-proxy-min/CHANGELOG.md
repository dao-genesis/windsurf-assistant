# Changelog · dao-proxy-min

> 反也者, 道之动也; 弱也者, 道之用也. —— 帛书《老子》德经

## v9.9.0 — 印 124 · 第一细药 · 外接 api 归一 (2026-05-17)

> **图难于其易也，为大于其细也。天下之难作于易，天下之大作于细。是以圣人终不为大，故能成其大.** —— 帛书《老子》六十三章
>
> **为之于其未有也, 治之于其未乱也.** —— 帛书《老子》六十四章
>
> **损之又损, 以至于无为, 无为而无不为.** —— 帛书《老子》四十八章

### 一句话

承印 123 (dao-proxy-max v1.0.8 · 22/38 模真聊真应) 之实, 归一于 min 之厚。**v9.8.0 守一不离主体字节级不动**, 加 `vendor/外接api/` 一文件夹 · **默关** · 主公一字开 · Cascade 选单立见 14 provider 之 N 模 (与 4 BYOK 一视同仁)。

### 归一之实

| 件 | 大小 | 来源 | 职 |
|---|---|---|---|
| `vendor/外接api/gateway/server.js` | 55.7KB | 字节级 cp from max v1.0.8 | 主入口 · CLI: `--port --config` |
| `vendor/外接api/gateway/registry.js` | 10.1KB | 字节级 cp from max | Provider 注册中心 |
| `vendor/外接api/gateway/translate.js` | 27.7KB | 字节级 cp from max | Anthropic ↔ OpenAI ↔ Gemini ↔ Ollama 协议互转 |
| `vendor/外接api/gateway/capabilities.js` | 7.3KB | 字节级 cp from max | 各 model 之 tool/vision/system 能力辨 |
| `vendor/外接api/gateway/providers/*.js` | 12.7KB | 字节级 cp from max | openai/anthropic/gemini/ollama/http (5 件) |
| `vendor/外接api/lm_register.js` | ~14KB | 抽 max ext.js L666-1018 + 参数化 | vscode.lm 注 (三别名 fallback) |
| `vendor/外接api/runtime.js` | ~10KB | 新写 | 启停 wrapper · 默关 · 主公一字开 |
| `vendor/外接api/配置.example.json` | 2.3KB | 字节级 cp from 070-插件_Plugins/外接api/ | GitHub Models 极简起手 |
| `vendor/外接api/README.md` | ~5KB | 新写 | 一文之示 |

### 主体改动 (扩 · 不破)

`extension.js`:

- L2110-2123 · commands 加 1 行 `dao.外接api.toggle`
- L2232-2239 · activate 末 watchdog 之后调 `tryStartExternalApi(ctx)` (try-catch · 失败不影响 min)
- L2276-2279 · deactivate ④ 之后, ⑤ 之前调 `tryStopExternalApi()`
- L2297-2396 · 文件末加 100 行 helper (`tryStartExternalApi` / `tryStopExternalApi` / `cmdExternalApiToggle` + 单例 `_externalApiRuntime`)

`package.json`:

- version: 9.8.0 → **9.9.0**
- commands 加 1 项 `dao.外接api.toggle`
- configuration.properties 加 1 项 `dao.外接api.enabled` (默 **false** · 不扰心)

### 一身两轨 (反者道之动)

```text
反代核轨 (字节级守 · v9.8.0 commit)         外接 api 轨 (印 124 · 第一细药)
  vendor/bundled-origin/source.js              vendor/外接api/gateway/server.js
  + _silk_dao.txt + _silk_de.txt               + lm_register.js + runtime.js
  :8889..8988 (per-user FNV)                   :11635..11734 (per-user FNV)
  Cascade Connect-RPC SP 注入                  OpenAI/Anthropic chat 14 provider
  二态切换 (invert/passthrough)                vscode.lm 注 N 模入 Cascade 选单
                  ╰─────── per-user FNV-1a 端口不撞 · 互不依赖 ───────╯
```

### 主公一字 (一念三步活)

1. `Ctrl+Shift+P` → 设置 · 搜 `dao.外接api.enabled` · 勾上
2. `Ctrl+Shift+P` → `道Agent: 外接 api 开关` (或重启 Windsurf)
3. Cascade 模型选择器搜 `dao-` · 即见 14 provider 之 N 模

或一行：`Ctrl+Shift+P` → `道Agent: 外接 api 开关` (toggle 即自动改 enabled 并启)

### 配置

启时自动复 `vendor/外接api/配置.example.json` 至 `~/.codeium/dao-byok/配置.json` (用户域 · 跨 vsix 升级不丢)。主公手编填 apiKey + `enabled:true`。

### 验

```powershell
# 静检 (与 v9.8.0 一致 · 主体不破)
pwsh _审视/_smoke.ps1

# v9.8.0 strip-test 仍通 (主体字节级不动)
node _审视/_v980_strip_test.js   # 6/6 pass

# v9.9.0 外接 api 自检 (打开 enabled · 启 · 查 /__dao/providers)
Ctrl+Shift+P → dao.外接api.toggle
curl http://127.0.0.1:<gateway-port>/health
curl http://127.0.0.1:<gateway-port>/__dao/providers
```

### 哲

**「图难其易·为大其细」**: 不直奔大归一 (B/C 之事), 起手作于最易最细 — 加 vendor/外接api/ 一文件夹, 默关, 主公一字开。

**「终不为大·故能成其大」**: 不立「大」之名, 默关不扰心; 主公愿则启, Cascade 立见 N 模; 不愿则寝, min 反代核如初。

**「为之于未有·治之于未乱」**: 反代核不动 · 二轨字节级正交 · 后续 B 之事 (byok 字节级劫 / Windsurf 反代 / Devin 反代 / webview 一面板) 待主公验后再图。

---

## v9.8.0 — 守一不离 (2026-05-06)

> **昔之得一者：天得一以清·地得一以宁·神得一以灵·侯王得一以为天下正.** —— 帛书《老子》三十九章
>
> **窈兮冥兮·其中有精·其精甚真·其中有信.** —— 帛书《老子》二十一章

### 治二根·名实终一·@ 工具复活

| 根 | 漏 | 药 |
|---|---|---|
| **@ 工具失** | `SIDE_CHANNEL_TAGS` 含 `additional_metadata` · 客户端以此 block 传 @项之元 (Cascade ID/file path/line range/symbol) · 剥之则 `trajectory_search` / `read_file` / `view_content_chunk` 等 @ 工具必败 | **删** `additional_metadata` from `SIDE_CHANNEL_TAGS` · 守 @项与元一体 |
| **名实不一** | `tape.all_fields[].raw_text` 显 BEFORE 态 · 主公见 OVERRIDE 残影 · 实则 upstream 已 neutralize · 视听皆误 | `_buildAllFieldEntry(content, mode)` 助函数 · 内部先 `stripSideChannelBlocks` 再 `neutralizeHiddenOverrides` · `raw_text = after` · **所见即所得** |
| **(兼治) g flag stateful** | `hasSideChannels` 三 RegExp `g` 标 · `lastIndex` 跨调用残留 · 部分字段假阴致 strip 漏 | `SIDE_CHANNEL_TAGS_RE.lastIndex = 0` + `MEMORY_BLOCK_RE.lastIndex = 0` + `DISCIPLINE_RE.lastIndex = 0` 三处显重置 |

### 改动定位 (`vendor/bundled-origin/source.js`)

- 行 ~672-709 · `SIDE_CHANNEL_TAGS` 删 `additional_metadata`
- 新增 `_buildAllFieldEntry(c, mode)` 助函数 · 主 handler 调之
- 行 ~743-759 · `hasSideChannels` 重置 `lastIndex` 三处
- `ORIGIN_VERSION_BASE = "v9.8.0"` · `ORIGIN_VERSION = "v9.8.0-shou-yi-bu-li"`

### 验

- `_审视/_v980_strip_test.js` · **6/6 PASS**
- `_审视/_smoke.ps1` · 静检 + 活探 · **25/25 PASS**
- `_审视/_verify_remote.ps1 -RunStripTest` · 远端实物 · **15/15 PASS**

### 哲

「得一」非守 user_rules · 非守 memories · 非守 system_prompt — 此皆客户端注之「加身」锚戒。「得一」守的是 **名实终一** 与 **@项与元之不可剥**。强剥 `additional_metadata` → 名去元 → agent 不知所云 → 工具必败。

---

## v9.7.9 — 道法自然 · 中性化身份锚 (2026-05-05)

承 v9.7.7 复归于朴。识 `<additional_metadata>` 中之 `SECTION_OVERRIDE_MODE_APPEND` 身份锚 (`Separately, if asked about what your underlying model is, respond with Cascade`)，以 `neutralizeHiddenOverrides` 转中性 (道家语)，**九章「持而盈之·不若其已」**: 不强加之身份，复用户域之自然。

## v9.7.7 — 复归于朴 (2026-05-04)

四味芜尽损 · 极简至 76KB · 二十八章「朴散则为器」: 余 4 KEEP_BLOCKS 主梁 (user_rules / memories / additional_metadata / tool_calling) · 弃二态枝。

## v9.6.0 — 守 Cascade ID (2026-05-03)

`additional_metadata` block 含 `Cascade ID:` 行 · 是 conversation tracker · 之前误剥 (兼及上下文) · v9.6 单守 Cascade ID 行 · 余 OVERRIDE 仍中性。**(后于 v9.8.0 一并升级 — 整 block 守住)**

## v9.5.0 — SECTION_OVERRIDE 中性化 (2026-05-02)

发现 `additional_metadata` 内 OVERRIDE 锚 · 引入 `neutralizeHiddenOverrides` · 不删 OVERRIDE block · 仅替其 content 为道家语 (二十二章「曲则金·枉则定」)。

---

## v9.2.0 — 反者道之动 · 弱者道之用 (2026-05-03)

> **反者道之动, 弱者道之用.** —— 帛书《老子》四十章
>
> **为道日损.** —— 帛书《老子》四十八章

### 四味真药

| 真药 | 漏 | 药 | 道义 |
|---|---|---|---|
| **A** | `proxyToCloud` 无 `req.aborted` / `res.close` / `upStream.setTimeout` · H2 stream 泄漏致 HOL 阻塞 | `req.aborted` + `res.close` + `upStream.setTimeout(180s)` → `NGHTTP2_CANCEL` | 四十章·**弱者道之用** |
| **B** | `setAnchor` 每次 activate 必写 `settings.json` · file watcher 空转 · ext-host 抖动 | API+文件双路同值不写 | 六十四章·**为者败之** |
| **C** | `proxyStart` `EADDRINUSE` 仅单次 ping · 假定远端永活 · dead remote 成 phantom | 1 ping → 活则 remote handle · 死则返 null (本窗口直连·不抢端口) | 八章·**上善若水** |
| **D** | `activate` 首装即 `forceRestartLS()` 广域杀 · 多窗口连锁 ext-host crash | activate 仅装 hook + 锚 settings · 不主动杀 LS · 自然重启时挂钩 | 四十八章·**为道日损** |

### 默认改动

- `dao.origin.banner` true → false (不言之教)

### 前车之鉴

v9.1.3 试图修补但 **加六事** (PID簿 / `_trackChild` / `forceRestartLS` 广窄分级 / EADDRINUSE 三验 / 8s 复查 / 60s 健康探针 / 离线 handle) · 净增 200+ 行码 · 反伤本源。v9.2.0 反之 · 损其名而存其本。**反者道之动**。

---

## v9.1.2 — 道法自然 · 逆序净卸 (2026-04-30)

### 逆序关停 · 根治卸载卡死

**根因**: 旧 `deactivate()` 先停代理 → LS 仍活 → 连死代理 → Windsurf 卡死.

**修复** — 反者道之动 · 逆序:

| 步骤 | 旧 (必死) | 新 (道法自然) |
|---|---|---|
| ① | 停代理 | **设透传** (安全网) |
| ② | 清锚 (API 失败) | **断钩** + `_cachedAnchored=false` |
| ③ | — | **同步清锚** (`_clearAnchorFileSync`) |
| ④ | — | **杀 LS** → 重生直连官方 |
| ⑤ | — | **停代理** (此时安全) |

- `_clearAnchorFileSync()` — 同步文件清锚, 绕过 VS Code API "not registered" 限制
- `cmdPurge` 同步重构为正确逆序
- `_custom_sp.json` 加入持存清理

### `<user_rules>` 可信格式注入 (v9.0→v9.1)

- `[CUSTOM-SP-ACTIVE]` 哨兵已移除 — 用户 SP 直出, 不触发模型注入检测
- `modifySPProto` / `modifyRawSP` — `spModifiedIdx` 追踪已修改 msg, save/restore 绕 `deepStrip`
- `stripSideChannelBlocks` / `hasSideChannels` — 移除冗余哨兵检测
- L1 测试 8/8 全绿

---

## v5.0.0 — 道法自然 (2026-04-29)

> 为学者日益, 闻道者日损. 损之又损, 以至于无为. 无为而无不为. —— 帛书《老子》德经

### 跳出二元 · 净减 270 行 (1536 → 1266 · vsix 减 8KB)

| 层 | v4.5 | v5.0 道法自然 |
|---|---|---|
| **道层** | TAO_HEADER + 道德经八十章 | 同 (永在前) |
| **法层** | 官方 SP 经"系统/用户侧"二分剥削 | 官方 SP **完整保留** |
| **术层** | proto deepStrip 递归净化所有 wire=2 字段 | proto **不动** |

### 删去之有为 (~250 行)

- `SIDE_CHANNEL_TAGS` / `SIDE_CHANNEL_TAGS_RE` / `MEMORY_BLOCK_RE` / `DISCIPLINE_RE`
- `stripSideChannelBlocks` / `hasSideChannels`
- `deepStripProtoSideChannels` / `deepStripRequestBody`
- `INFER_STRIP` 路径 (改为 `PASSTHROUGH`)

> 旧路 (v4.x): "剥侧信道"试图把 user_rules / MEMORY / discipline 等"系统侧"杀去, 留"用户侧"; 陷剥/留二元 · 字段必生新增 · 维护成本高.
>
> 新路 (v5.0): **前置道魂 · 不剥不削** · LLM 自感道魂之首言 · 后续官方约束自然让位.

> **注**: v5.0 之"道魂在前·不剥侧信道"路·后于 v9.x 系列被发现并不充分 (LS 客户端实际嵌入 `<additional_metadata>` 等带 `SECTION_OVERRIDE_MODE_APPEND` 之"加身"锚戒) · v9.5+ 复引 `stripSideChannelBlocks` + `neutralizeHiddenOverrides` · 但**精准而非二元**: 守 @ 工具之元 (v9.8.0) · 中性化身份锚 (v9.5+) · 此即"反者道之动"之实。

---

## v4.0.0 — 万法归宗 (2026-04-26)

### 字段级 proto 重构

- 离弃脆弱字节扫描, 改为字段级 proto 解析 / 序列化
- 27 种 XML-like 侧信道标签深度递归剥离
- 三档 RPC 全覆盖: `CHAT_PROTO` / `CHAT_RAW` / `INFER_STRIP` / `PASSTHROUGH`

### per-user 端口隔离

多账号同机时, 每用户自动分配唯一端口 (FNV-1a hash → 8889..8988)。

### 二态热切 + SSE + 本源观照 webview

模式切换不需重载 · `/origin/stream` SSE 推送 · 活动栏 → 道Agent 容器实时 SP 面板。

### 跨平台 + 净卸

LS 重启支持 Windows / macOS / Linux · "了事拂衣去" 一键净卸归本源。

### 7 命令

```text
道Agent: 启 (invert)             — 反者道之动
官方Agent: 启 (passthrough)      — 上善如水
道Agent: 切换模式 (道 ⇄ 官方)    — 二态热切
道Agent: 浏览器观真 SP            — 全貌解剖
全链路自检 (E2E)                  — 致虚守静
闭环自检 (L1 + L2)                — 同上
了事拂衣去 · 净卸                 — 归本源
```

---

## v3.0.0 — 极简反代 (2026-04-20)

### 朴

- 极简反代 · ~40KB · 3 命令 · 固定端口 8889
- source.js 字节扫描 + SP 替换
- vendor/bundled-origin 内联帛书

---

## 道义沿革

```text
v3.0  朴      → 字节扫描 · 一刀切 · 极简
v4.0  增      → 字段级 proto · 27 标签深剥 · 万法归宗
v5.0  损      → 跳出剥/留二元 · 道魂在前 · 道法自然
v9.1  逆      → 逆序净卸 · `<user_rules>` 可信注入
v9.2  弱      → 四味真药 · H2 stream · file watcher · phantom remote · 自然重启
v9.5  中      → SECTION_OVERRIDE 中性化 · 不删而转语
v9.7  朴      → 复归于朴 · 极简至 76KB
v9.8  得一    → 守 @ 工具之根 · 名实终一 · g flag stateful 兼治
```

> 大成若缺, 其用不敝; 大盈若盅, 其用不窘. —— 帛书《老子》德经
>
> 道法自然 · 无为而无不为 · 损之又损 · 以至于无为
