# 道Agent · dao-proxy-min · **v9.8.0** · 守一不离

> **一气化三清 · Three Pure · 道并行而不悖**
> [I · 反代 API · `dao-core`](../dao-core/README.md) &middot; [II · 切号 WAM · `wam`](../wam/README.md) &middot; **[III · 提示词反代 · 本](README.md)**
>
> dao-proxy-min 服 Cascade 提示词替换；dao-core 服任意 OpenAI 客户端；wam 服 Windsurf IDE 多账号轮转。三者正交，**道并行而不悖**。

> **昔之得一者：天得一以清 · 地得一以宁 · 神得一以灵 · 侯王得一以为天下正.** —— 帛书《老子》三十九章
>
> **道法自然 · 无为而无不为.** —— 帛书《老子》

## 一句话

反代 Windsurf Cascade 之 Connect-RPC，以 `<user_rules><MEMORY[dao-de-jing.md]>` 可信格式注入帛书《老子》上下篇 (汉墓帛书甲本) 为 SP 起首，**守 @ 工具之根 (additional_metadata 不剥)**，中性化身份锚 (SECTION_OVERRIDE)，三档 RPC 全覆盖。per-user 端口自然隔离，二态零代价热切，SSE 实时推送，一键净卸归本源。

## v9.8.0 守一不离 (2026-05-06)

> **三十九章「侯王得一以为天下正」**：v9.8.0 三十九章「得一」治二根·名实终一·@ 工具复活

### 二根之治 (v9.7.9 → v9.8.0)

| 根 | 漏 | 药 | 道义 |
|---|---|---|---|
| **@ 工具失** | `SIDE_CHANNEL_TAGS` 含 `additional_metadata` · 客户端以此 block 传 @项之元 (Cascade ID/file path/line range) · 剥之则 `trajectory_search/read_file/view_content_chunk` 等 @ 工具必败 | 删 `additional_metadata` from `SIDE_CHANNEL_TAGS` · 守 @项与元一体 | 三十九章·**得一** |
| **名实不一** | `tape.all_fields[].raw_text` 显 BEFORE 态 · 主公见 OVERRIDE 残影 · 实则 upstream 已 neutralize · 视听皆误 | `_buildAllFieldEntry(content, mode)` 助函数 · 内部先 strip 再 neutralize · `raw_text = after` | 二十一章·**其精甚真，其中有信** |
| (兼治) | `hasSideChannels` `g` flag stateful · `lastIndex` 跨调用残留 · 部分字段假阴致 strip 漏 | `SIDE_CHANNEL_TAGS_RE.lastIndex = 0` 等三处显重置 | 六十四章·**慎终若始** |

### 验

```powershell
node _审视/_v980_strip_test.js
# [V980-OK] stripSideChannelBlocks KEEPS <additional_metadata> tag
# [V980-OK] stripSideChannelBlocks KEEPS Cascade ID line
# [V980-OK] hasSideChannels FALSE for <additional_metadata>
# [V980-OK] hasSideChannels TRUE for <user_rules>
# [V980-OK] hasSideChannels TRUE for <memories>
# [V980-OK] strip leaves SECTION_OVERRIDE alone
# === v9.8.0 strip-test pass=6 fail=0 ===
```

详见 [`CHANGELOG.md`](./CHANGELOG.md) 之 v9.5/v9.6/v9.7.x/v9.8.0 沿革。

## 万法配 · `_审视/`

> 二十五章「人法地·地法天·天法道·道法自然」 — 配从用户·从环境·非从脚本

七件极简：

| 件 | 用 |
|---|---|
| `_审视/_dao.config.ps1` | 万法配加载器 (ENV → JSON → prompt → 默) |
| `_审视/_dao.env.example.json` | 配之取 (复 → `_dao.env.json` 后改) |
| `_审视/_deploy.ps1` | 万法部署 · 版本驱动 (取代 N 个 `_deploy_v9XX.ps1`) |
| `_审视/_smoke.ps1` | 万法烟测 · 静检 + 活探 + strip 校 |
| `_审视/_verify_remote.ps1` | 万法远验 · 实物之真 |
| `_审视/_v980_strip_test.js` | v9.8.0 守一不离 · 6 项 strip 校 |
| `_审视/_README.md` | 三句之示 (烟测·部署·远验) |

### 三句之示

```powershell
# 一 · 烟测 (无远端·无凭)
pwsh _审视/_smoke.ps1

# 二 · 部署 (需远端·需凭)
$env:DAO_REMOTE_HOST = '192.168.x.y'
$env:DAO_REMOTE_USER = 'username'
$env:DAO_REMOTE_PASS = '...'        # 或 PasswordFile DPAPI clixml
pwsh _审视/_deploy.ps1

# 三 · 远验
pwsh _审视/_verify_remote.ps1 -RunStripTest
```

详见 [`_审视/_README.md`](./_审视/_README.md).

## 装

```powershell
# 构建 vsix
.\_build_vsix.ps1                  # 仅打包
.\_build_vsix.ps1 -Smoke           # 打包前先跑 _审视/_smoke.ps1
.\_build_vsix.ps1 -InstallLocal    # 打包 + 装本机
```

或:

```powershell
windsurf --install-extension dao-proxy-min-9.8.0.vsix --force
```

## 7 命令 (`Ctrl+Shift+P`)

| 命令 | 道义 |
|---|---|
| **道Agent: 启** (`wam.originInvert`) | 反者道之动 · 启代理 + 锚 settings + LS 重启 |
| **官方Agent: 启** (`wam.originPassthrough`) | 上善如水 · 透传观照 · SP 不改 |
| **道Agent: 切换模式** (`dao.toggleMode`) | 二态热切 · 零代价翻转 · 下次对话生效 |
| **道Agent: 浏览器观真 SP** (`dao.openPreview`) | 打开 `/origin/preview` · 全貌解剖 |
| **全链路自检** (`wam.verifyEndToEnd`) | 致虚守静 · L1+L2 报告 |
| **闭环自检** (`wam.selftest`) | 同上 |
| **了事拂衣去** (`dao.purge`) | 净卸 · 停反代 · 清设置 · 卸插件 · 归本源 |

## 控制面端点

```http
GET    /origin/ping           # 状态 (mode/uptime/req_total/dao_chars)
GET    /origin/mode           # 当前模式
POST   /origin/mode           # 切模式 {"mode":"invert"|"passthrough"}
GET    /origin/sig            # 变更签名 (轻量 · webview 用)
GET    /origin/preview        # 实时全貌 (before+after+结构解剖)
GET    /origin/last           # 最近一次 SP 注入 (?full=1)
GET    /origin/realprompt     # 捕获轨实 SP
GET    /origin/selftest       # 三路径闭环自检
GET    /origin/paths          # 路径直方图
GET    /origin/stream         # SSE 推式 (sp/mode/hb)
GET    /origin/custom_sp      # 读自定义 SP
POST   /origin/custom_sp      # 写自定义 SP
DELETE /origin/custom_sp      # 清自定义 SP
```

## 配置

| key | 默认 | 说明 |
|---|---|---|
| `dao.origin.port` | `0` (自动) | 反代端口 · 0=per-user FNV-1a hash (8889..8988) · 非0覆盖 |
| `dao.origin.defaultMode` | `invert` | 首激默模 · `invert`/`passthrough` |
| `dao.origin.banner` | `false` | 启动时显帛书横幅 (默认 false · 不言之教) |

运行时自动锚定 (无需手动设):

| key | 说明 |
|---|---|
| `codeium.apiServerUrl` | 道Agent 启时设 `http://127.0.0.1:{port}` · 净卸时清 |
| `codeium.inferenceApiServerUrl` | 同上 |

## 文件

```text
packages/dao-proxy-min/
├─ extension.js                              # ~2120 行 · VSCode 壳 + 锚定 + webview
├─ package.json                              # version=9.8.0 · 7 命令 · 3 配置
├─ vendor/bundled-origin/
│  ├─ source.js (源.js)                      # 反代核 · 字段级 proto · v9.8.0 守一不离
│  ├─ _silk_de.txt                           # 帛书《老子》上篇·德经 (汉墓帛书甲本)
│  └─ _silk_dao.txt                          # 帛书《老子》下篇·道经 (汉墓帛书甲本)
├─ media/
│  ├─ icon.png
│  └─ icon.svg
├─ _审视/                                    # 万法配 (开发期 · 不入 vsix)
│  ├─ _README.md                             # 三句之示
│  ├─ _dao.config.ps1                        # 配加载器
│  ├─ _dao.env.example.json                  # 配之取
│  ├─ _deploy.ps1                            # 万法部署
│  ├─ _smoke.ps1                             # 万法烟测
│  ├─ _verify_remote.ps1                     # 万法远验
│  └─ _v980_strip_test.js                    # 守一不离 strip 校
├─ _build_vsix.ps1                           # 极简构建 · -Smoke / -InstallLocal
├─ README.md
├─ CHANGELOG.md
├─ LICENSE
└─ .vscodeignore
```

## per-user 端口隔离

多账号同机时，每用户自动分配唯一端口 (FNV-1a hash of username → 8889..8988)。无需配置，无需协调，自然隔离。可通过 `dao.origin.port` 显式覆盖。

## 道义

> 卅辐同一毂, 当其无有, 车之用也. —— 帛书《老子》道经
>
> 反也者, 道之动也; 弱也者, 道之用也. —— 帛书《老子》德经
>
> 大成若缺, 其用不敝; 大盈若盅, 其用不窘. —— 帛书《老子》德经

v9.8.0 之路:

- **三十九章「得一」** · @项与元一体 · @ 工具复活
- **二十一章「其精甚真·其中有信」** · raw_text 显 AFTER · 名实终一
- **二十五章「道法自然」** · 万法配 · 配从环境·非从脚本
- **四十八章「为道日损」** · 七版迭代 · 损之又损 · 至于 _审视/ 七件极简
- **六十四章「慎终若始」** · g flag stateful 兼治 · 治根至极

承 v9.7.9 中性化 SECTION_OVERRIDE 身份锚 + v9.7.7 复归于朴之极简。守大常: `invertSP` / `modifySPProto` / `modifyRawSP` / `modifyAnyInferenceSP` / `deepInvertProto` / 照观体系 字符级不变。

> 道法自然 · 无为而无不为 · 损之又损 · 以至于无为
