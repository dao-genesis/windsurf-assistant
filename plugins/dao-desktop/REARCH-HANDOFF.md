# ☯ dao-desktop 架构归正 · 交接文档 (三思而后行)

> 本文档是一次**反向审视**的产物: 当前 dao-desktop 的前端整合逻辑偏离了本源目标, 本轮只做剖析与思路明晰, **不做实现**。具体行动交给下一个 agent。

## 一 · 本源目标(不可动摇的基准)

用户的本源需求只有一句话:

> dao-desktop = **官方 Devin Desktop IDE 的全部功能(原样)** + **devin-remote 二合一插件(dao-vsix)+ Proxy Pro 的全部模块(原样)**, 只在底层做"IDE 宿主 → 插件宿主"的适配。前端操作逻辑、用户交互逻辑、使用模式**零变化** —— 太上, 下知有之; 用户感受不到任何区别。

对照基准是**实际可观测的两个真实形态**:

1. 官方 Devin Desktop 3.4.27 的原生 Cascade 面板(对话就是对话, 空态只有标题/composer/Recent sessions + View all)。
2. dao-vsix 3.54.3 + dao-proxy-pro 装进官方 IDE 后的形态: **一张单网页(/shell)管理一切**——左侧图标栏切板块(overview 🏠 / switch 切号 🔀 / bridge 穿透 🌐 / backups 对话备份 💬 / inject 反向注入 💉 / mcp 🧩 / github 🐙), 与对话完全分离; Proxy Pro 是自己独立的面板。

## 二 · 当前的偏离(实机剖析结论)

### 2.1 对话面板被污染(核心错误)

`dao-cascade/panel.js`(3670 行)的 Cascade 对话面板里塞进了 9 个管理入口
(`.xrow`: Agents/Maps/Rules/MCP/Memories/Outline/Plans/Status/Timeline, 见 panel.js ~2439 行),
点击后在**对话流里**渲染列表卡片(openHomeList → mcp-list/agents-registry/codemaps-list …)。

官方 Cascade 的对话面板**没有任何这类入口** —— 这些能力在官方是命令面板/设置/独立入口, 不在对话框里。
把管理模块塞进对话框 = 对话不再纯粹、管理也不成体系, 两边都不像官方, 双输。

### 2.2 归一面板方向对但形态不对

`dao-cascade/unified-panel.js`(1424 行, 视图 `dao.unified`)已经把 dao-one/dao-vsix 的板块能力
(切号/桥接/备份/注入/MCP/GitHub/Proxy Pro/搜索/设置/Windows 分身)搬进插件本体并换源为插件自持真源 ——
**后端换源这部分是对的, 应保留**。
但它的前端是自创的侧栏卡片流, 不是 dao-vsix `/shell` 那张"左侧图标栏 + 板块页"的单网页 1:1 形态。
用户在官方 IDE 装 dao-vsix 看到的是什么样, 在 dao-desktop 里就必须是什么样。

### 2.3 判定表(逐项)

| 模块 | 正确归属(基准) | 当前状态 | 判定 |
|---|---|---|---|
| Cascade 对话(会话/模式/模型/composer) | 对话面板, 官方 1:1 | 基本对齐(R143/R144) | ✅ 保留 |
| Recent sessions + View all | 对话面板空态 | 已对齐 | ✅ 保留 |
| Agents/Maps/Rules/MCP/Memories/Outline/Plans/Status/Timeline 九入口 | **不属于对话面板** | 塞在对话空态 `.xrow` + 对话内卡片 | ❌ 移出 |
| 切号(账号池) | 归一单网页 switch 板块(dao-vsix WAM 面板 1:1) | 归一面板卡片流 | ⚠️ 形态重构 |
| DAO Bridge 穿透 | 归一单网页 bridge 板块 | 归一面板卡片流 | ⚠️ 形态重构 |
| 对话备份/会话/记忆管理 | 归一单网页 backups 板块 | 归一面板卡片流 | ⚠️ 形态重构 |
| 反向注入 | 归一单网页 inject 板块 | 归一面板卡片流 | ⚠️ 形态重构 |
| MCP 管理 | 归一单网页 mcp 板块 | 对话框入口 + 归一卡片(两处, 混乱) | ❌ 收敛到归一 |
| GitHub 舰队 | 归一单网页 github 板块 | 归一面板卡片流 | ⚠️ 形态重构 |
| Proxy Pro(模型渠道/路由) | **独立面板**(与 dao-proxy-pro 插件一致) | 混在归一面板里 | ⚠️ 拆出独立 |
| 本地 local API/openapi | 纯后端, 无 UI 诉求 | 归一面板有启停卡片 | ✅ 可留在 overview |

## 三 · 归正后的目标架构

```text
dao-desktop (单一 VSIX)
├── 视图1 dao.cascade   「Cascade」对话面板
│     = 官方 Cascade 1:1, 只有对话。零管理入口。
│     (panel.js 删掉 .xrow 九入口与对应对话内列表卡片逻辑)
├── 视图2 dao.unified   「归一」单网页管理台
│     = dao-vsix /shell 网页 1:1: 左侧图标栏 + 板块页
│       🏠 overview / 🔀 switch / 🌐 bridge / 💬 backups / 💉 inject / 🧩 mcp / 🐙 github
│     前端结构/交互/文案照抄 dao-vsix extension.ts ~7754 行起的网页骨架,
│     消息协议(cmd/loadTabData/tabData)保持同构, 后端接到 unified-panel.js 已换源的插件自持真源。
└── 视图3 dao.proxyPro  「Proxy Pro」独立面板
      = dao-proxy-pro 插件面板 1:1(渠道/路由/BYOK), 数据仍走 ~/.dao/proxy-channels.json,
        与 dao-vsix 的 ~/.codeium/dao-byok 命名空间继续隔离。
```

底层适配原则(唯一允许的差异层): IDE 宿主能力(官方 language server 发现、credentials.toml、
扩展目录探测)通过 host-discover/ls-bridge/coexist 适配, **前端一行都不因此变**。

## 四 · 给下一个 agent 的执行路径(建议顺序)

1. **净化对话面板**: panel.js 删 `.xrow` 九入口 + openHomeList 相关对话内管理卡片; 与官方空态逐像素核对。
   (保留 R143/R144 已对齐的 composer/模式/Recent sessions。)
2. **归一面板换壳**: 以 devin-remote `core/dao-vsix/src/extension.ts` 的 /shell 网页(≈7754 行起的
   HTML/CSS/JS 骨架与 sw()/cmd() 协议)为蓝本, 重写 unified-panel 的 webview HTML;
   后端 handler 复用现有 unified-panel.js 的插件自持实现(消息名对齐 dao-vsix)。
3. **Proxy Pro 拆独立视图**: 从归一面板拆出, 前端照抄 dao-proxy-pro 面板。
4. **回归护栏**: 新增测试断言 (a) panel.js 不含管理入口 id; (b) unified webview 含七板块图标栏;
   (c) 消息协议与 dao-vsix 同构(loadTabData/tabData)。版本号递增, 重打 VSIX 双轨(VS Code + Devin Desktop)实装,
   与官方 IDE + dao-vsix + Proxy Pro 并排截图对照验收。
5. **验收标准**: 用户并排打开两套环境, 除"IDE 本体 vs 插件"外**看不出任何区别**。

## 五 · 边界红线(继续有效)

- 账号体系不混: dao-desktop=windsurf_api_key/credentials.toml; dao-vsix=auth1。互相只读脱敏, 永不交叉写。
- Proxy Pro 双命名空间隔离: ~/.dao/proxy-channels.json vs ~/.codeium/dao-byok。
- 单一真源: 不复制第二份配置模型; 官方 LS 只复用不再起第二份。
- 模块源代码变更必须递增版本; package.json 字节级安全写入。
