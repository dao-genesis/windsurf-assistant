# dao-desktop — Devin Desktop 插件版（真源）

把官方 Devin Desktop 本体做成单一 VSIX 插件：官方 `codeium.windsurf`（displayName "Devin"）
扩展本体 + Cascade 三模式面板（Cascade / Devin Local / Devin Cloud），装进任意 VS Code 系
IDE 即得与官方一致的体感。与官方唯一差别：从 IDE 本体降为一个插件。

## 布局

```
plugins/dao-desktop/            ← 本插件真源
├── extension.js                入口: 垫片 → 面板 → 官方本体折入/共生
├── package.json                manifest(手工维护, 勿用生成器覆盖)
├── build.js                    构建: [--core <官方vsix>] 折入 engines/ + vsce 打包
├── windsurf-shim.js            Windsurf fork 私有 proposed API 垫片
├── dao-cascade/                Cascade 三模式面板核心
│   ├── panel.js                面板本体(含领域提示词塑形器钩子 setPromptShaper)
│   ├── acp-client.js acp-wss.js  Devin Local ACP 通道
│   ├── devin-provision.js      Devin Cloud 供给
│   ├── host-discover.js        宿主 LS 发现(共生模式)
│   └── ls-bridge.js            官方 LS 桥
└── media/icon.png              图标(构建期缺则生成占位)

plugins/dao-ai-base/            ← 可复用「AI 交互基底」(供领域插件 vendor)
├── index.js                    单一入口 activateDaoAiBase / genContributes / setPromptShaper
└── sync.js                     再 vendor 工具: 把真源同步进各领域插件 dao-ai-base/
```

## 构建

```bash
node build.js                    # 共生模式 VSIX(装在带官方本体的 IDE 里即全功能)
node build.js --core <官方vsix>  # 全量单一 VSIX(官方本体折入 engines/windsurf/)
```

官方本体不入库（体积大且随官方更新）；从已装 IDE 扩展目录或官方渠道取 VSIX。

## 领域插件同步（KiCad / LCEDA / FreeCAD / Windows-Agent）

各领域插件内的 `dao-ai-base/` 均为本目录的 vendored 副本，改核心一律改真源后再同步：

```bash
node ../dao-ai-base/sync.js <领域插件目录>...
```

## 溯源

原真源随旧账号仓库封禁一并丢失（2026-07）。本目录为重建版：
- `dao-cascade/`、`windsurf-shim.js`、`dao-ai-base/index.js` — 取自最新干净 vendored 基线
  （Dao-PCB-Design-Agent/vscode-dao-kicad，含通用 promptShaper 钩子，无领域内容，逐文件核验）；
- `package.json` — 依据原建仓会话记录（devin-68dcb…）恢复；
- `extension.js`、`build.js`、`sync.js` — 依据会话记录与 vendored 副本行为重建，语义与原版一致
  （装配顺序 / 共生判定 / 子目录隔离 context 与 dao-ai-base/index.js 同源）。
