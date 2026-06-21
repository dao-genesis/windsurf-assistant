# Windsurf Assistant · 道法自然

三个 VS Code / Windsurf 同源插件：**多账号一键切换** + **反代换底层提示词**（精简示范版 + 全功能 Pro 版），彻底解锁 agent 能力。三插分而治之、同装互不干扰（道并行而不相悖）。

> **🎁 一处看全 · 三插件 + 源代码 合一**：[**⬇ All-in-One Release（三插件 VSIX + 完整源码，单一入口）**](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/tag/all-in-one) — 无需翻找各模块，下载即用、读码即见。也可在 [全部 Releases](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases) 取各插件独立版本。

## 🎬 视频介绍

<div align="center">

[![windsurf完美外接第三方模型 满足一切暗黑需求](media/video-proxypro.jpg)](https://www.bilibili.com/video/BV1Cdjn6VEhF)

**▶ [windsurf 完美外接第三方模型 · 满足一切暗黑需求（dao-proxy-pro）](https://www.bilibili.com/video/BV1Cdjn6VEhF)**

[![windsurf反代+替换官方底层提示词 彻底解锁agent所有能力](media/video-windsurf.jpg)](https://www.bilibili.com/video/BV1sY9sBLE5M)

**▶ [windsurf 反代 + 替换官方底层提示词 · 彻底解锁 agent 所有能力](https://www.bilibili.com/video/BV1sY9sBLE5M)**

[![阴符经+AI 根除AI一切道德感](media/video-yinfu.jpg)](https://www.bilibili.com/video/BV1cELA6QEBY)

**▶ [阴符经 + AI · 根除 AI 一切道德感](https://www.bilibili.com/video/BV1cELA6QEBY)**

**🌐 [打开自动播放主页（GitHub Pages · 进入即自动播放）](https://zhouyoukang1234-spec.github.io/windsurf-assistant/)**

**👤 [我的 B 站主页（视频链接被风控时改走这里）](https://space.bilibili.com/2114868619)**

</div>

> GitHub 仓库页（本 README）受平台限制无法自动播放视频；上方"自动播放主页"是一个真正的网页，进入即自动播放 B 站视频，点击可跳转 B 站原页观看。

> 下表由 [`tools/gen-readme-index.js`](tools/gen-readme-index.js) 据各插件 `package.json` 版本自动维护（去心发版，改谁刷谁）。每个插件各自发布到独立 Release tag `<key>-v<version>`。

<!-- DAO-MODULE-INDEX:START -->
| 插件 | 版本 | 扩展 id | 说明 | Release / 下载 |
|---|---|---|---|---|
| **rt-flow** | `3.16.0` | `devaid.rt-flow` | 多账号管理与一键切换：添加账号 / 注入 token / 健康检查 / panic 切换。命令/视图独立命名空间 `wam.*`。 | [Release](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/tag/rt-flow-v3.16.0) · [⬇ VSIX](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/download/rt-flow-v3.16.0/rt-flow-3.16.0.vsix) |
| **dao-proxy-min** | `9.9.64` | `dao-agi.dao-proxy-min` | 反向代理 Windsurf / Devin，origin 反转与系统提示词替换、预览与自检。独立命名空间 `daomin.*`，与 Pro 同装零干扰。 | [Release](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/tag/dao-proxy-min-v9.9.64) · [⬇ VSIX](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/download/dao-proxy-min-v9.9.64/dao-proxy-min-9.9.64.vsix) |
| **dao-proxy-pro** | `9.9.315` | `dao-agi.dao-proxy-pro` | 在 min 反代/提示词隔离之上新增外接第三方 API：多 Key/多端点加权负载均衡 + 故障转移、按渠道/模型用量与成本可见、三面板（本源观照 / 渠道配置 / 模型路由）、只填 API Key 自动全量识别模型。 | [Release](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/tag/dao-proxy-pro-v9.9.315) · [⬇ VSIX](https://github.com/zhouyoukang1234-spec/windsurf-assistant/releases/download/dao-proxy-pro-v9.9.315/dao-proxy-pro-9.9.315.vsix) |
<!-- DAO-MODULE-INDEX:END -->

## 仓库结构

```
plugins/
  rt-flow/          # 切号插件源码 (publisher: devaid · 命令/视图 wam.*)
  dao-proxy-min/    # 反代替换提示词 · 精简示范版 (publisher: dao-agi · 命令/视图 daomin.*)
                    #   vendor/bundled-origin/ 为内置提示词本源文本
  dao-proxy-pro/    # 反代替换提示词 · 全功能版 (publisher: dao-agi · 命令/视图 dao.*/wam.*)
                    #   vendor/外api/ 多协议适配+路由+负载均衡; vendor/bundled-origin/ origin 后端
scripts/
  build-vsix.mjs    # 一键把全部插件打包为 .vsix（自动发现 plugins/ 下每个含 package.json 的目录）
tools/
  modules.json      # 去心模块登记表（单一事实来源：detect/notes/index 三脚本均读它）
  detect-modules.js # 据改动文件判定需发版的模块 key
  release-notes.js  # 生成单模块 Release 说明（含安装指引 + changelog 摘要）
  gen-readme-index.js # 据各插件版本自动维护上方「下载索引表」
  bundle-notes.js   # 生成「三插件 + 源代码 合一」聚合 Release（tag all-in-one）正文
.github/workflows/
  auto-merge.yml    # 无冲突 PR 自动合并进 main，并 dispatch 发版
  release.yml       # 去心发版（各 tag <key>-v<version>）+ bundle job 刷新合一 Release（tag all-in-one）
```

### 三插互不干扰（道并行而不相悖）

min 与 pro 同源（pro 是 min 的全功能超集），同装时若标识重叠会在第二个激活时因「命令已注册」崩溃。本仓库已把 **min 整体退到独立命名空间**，pro 保持规范标识不动：

| 维度 | rt-flow | dao-proxy-min | dao-proxy-pro |
| --- | --- | --- | --- |
| 命令 | `wam.openEditor` … | `daomin.originInvert` … | `wam.originInvert` / `dao.toggleMode` … |
| 视图容器 / 视图 | `wam-container` / `wam.panel` | `daomin-container` / `daomin.essence` | `dao-container` / `dao.essence` |
| 配置命名空间 | `wam.*` | `daomin.*` | `dao.*` |
| 反代后端端口 | — | 8889..8988（per-user FNV `username+":min"`） | 8937（per-user FNV `username`） |
| settings 备份键 | — | `daomin.origin._backup_*` | `dao.origin._backup_*` |

三者命令 ID、视图 ID、配置键、端口、备份键全无交集，可同时安装、各自独立运行（origin 反转为 min/pro 共有能力，同一时刻建议仅启用其一处于 invert 模式，另一处于 passthrough）。

## 安装

VS Code / Windsurf 中 `Extensions: Install from VSIX...`，选择对应 `.vsix`。

## 从源码构建

需 Node ≥ 18。

```bash
node scripts/build-vsix.mjs          # 打包全部插件到 dist/
node scripts/build-vsix.mjs rt-flow  # 只打包指定插件
```

脚本通过 `npx @vscode/vsce package` 在各插件目录生成 `.vsix`。

## 插件命令速览

- **rt-flow**：`wam.openEditor` `wam.switchAccount` `wam.panicSwitch` `wam.addAccount` `wam.injectToken` `wam.verifyAll` `wam.healthCheck` …
- **dao-proxy-min**：`daomin.originInvert` `daomin.originPassthrough` `daomin.toggleMode` `daomin.openPreview` `daomin.verifyEndToEnd` `daomin.selftest` …
- **dao-proxy-pro**：`wam.originInvert` `wam.originPassthrough` `dao.toggleMode` `dao.openPreview` `dao.eaConfig` `dao.modelUnlock.toggle` …

## 许可

各插件许可见其目录内 `LICENSE.txt`（rt-flow: MIT，dao-proxy-min / dao-proxy-pro: Apache-2.0）；仓库整体见根 [`LICENSE`](LICENSE)。
