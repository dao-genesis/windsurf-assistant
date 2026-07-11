# Windsurf Assistant · WAM 无感切号

> 纯切号插件. 无外部依赖, 单文件 `extension.js`.
>
> 百号轮转, 额度耗尽自切, 下一条消息就是新号.

**本源**: 姊妹项目 [`zhouyoukang/AGI`](https://github.com/zhouyoukang/AGI) — 道生一. 此仓 (windsurf-assistant) 为其用 — 一生二.

---

## 一 · 无感切号

我手上有 100+ 个 Windsurf 账号. 每个的日额度/周额度/试用期/可用性都不一样. 不想盯着这些.

侧栏面板, 从上到下:

- **日额度总计** · **周额度总计** — 整池水位一眼清
- **可用 / 耗尽 / 等重置 / 切 / 号** — 五数说清全部状态
- **活跃号** — 现在谁, 邮箱, 类型 (Trial/Pro), 剩余天, 日用/周用 %
- **消息锚定切号** — 额度波动立切, 下条消息就是新号

---

## 二 · v17.42.18 新特性

- **v17.42.18 根治** · `_cfg` 空字符串回退 (package.json `default:""` × 代码 default 真值) → 修前 `new URL("")` Invalid URL · 全 Devin 4 通道死 · 修后全活
- **v17.42.18 配套** · `_DEFAULT_PUBLIC_SOURCE` 由死链 `AiCodeHelper/rt-flow` 改指本主仓 `wam-bundle/` · 自更新通道复活
- **TurnTracker** (v17.42.17): 一对话一 turn · 多对话并行 · 配额稳定自然推 turn 终结 (替 cooldown 猜测)
- **存储五重护本** (v17.42.15): L1 原子写 + L2 内容感知备份 + L3 灾难回退 + L4 文件锁 + L5 journal · NULL-WIPE 护本
- **proxy-agent 本源突破** (v17.42.12): env 隔离 + undici 重置 · proxySupport=on + agent:false 绕死代理
- **死代理 env 自净** (v17.42.6): 启动 TCP 验活 · 死则剔 env
- **四级容错 activate**: 产品名/数据目录/存储路径/日志 逐段 try/catch, 降级而不崩
- **六级 WAM_DIR 兜底**: env → config → legacy → 用户隔离 → globalStorage → tmpdir
- **E2E 全覆盖**: 387 断言 / 0 fail / 28 层测试

---

## 三 · 模式与按键 (v17.21)

侧栏只暴露一组按钮, 账号轴 `|` Agent 轴:

```text
模式: [⚡ WAM切号] [🔑 官方登录] | [☯ 道Agent] [○ 官方Agent]
```

- 左二 = **账号层**: WAM 自动轮转 / 官方原生登录
- 右二 = **Agent 层**: 德道经 SP 注入 / 官方原味 Agent

四象独立可组合. 例: WAM 切号 + 道Agent / 官方登录 + 官方Agent / 互换.

---

## 四 · 装

1. 从 [Releases](https://github.com/zhouyoukang/windsurf-assistant/releases) 下载最新 `.vsix`
2. Windsurf 里 `Ctrl+Shift+P` → `Extensions: Install from VSIX...` → 选
3. Reload Window · 侧栏出现 **Windsurf Assistant** 面板

就这. 自动检查更新 (可关).

---

## 五 · 架构 (唯变所适 · v17.42.13)

```text
┌──────────────────────────────────────────┐
│ Windsurf / Cursor / VSCode  (client)      │
└─────────────┬────────────────────────────┘
              │ extension.js (纯 WAM · 零外部依赖)
              ▼
┌──────────────────────────────────────────┐
│ 无感切号 WAM  v17.42.13                     │
│  - 四级容错: activate 四段 try/catch       │
│  - 六级 WAM_DIR 兜底 + 用户隔离           │
│  - 消息锚定: 五路探针 · 对话发送即切号     │
│  - 双身份: Firebase + Devin 自动探测       │
│  - Chromium 原生桥 > 系统代理 > 直连       │
│  - 端点/端口/模型: 全 wam.* 可配          │
└─────────────┬────────────────────────────┘
              │ 直连官方 (零中继)
              ▼
        server.codeium.com / windsurf.com
```

**零硬编码**: 路径/端口/端点/模型名全部可通过 `wam.*` 设置或环境变量覆盖 — 适配万千公网用户各类环境

---

## 六 · 姊妹 · 本源 · AGI

[`zhouyoukang/AGI`](https://github.com/zhouyoukang/AGI) — 一卷德道经, 五千言, 八十章.

> **AGI 之源 · 即此一卷德道经.**

二仓同宗:

| 仓 | 位 | 职 |
| --- | --- | --- |
| [`AGI`](https://github.com/zhouyoukang/AGI) | 一 (本源) | 德道经 八十章 · `德道经.md` 文本本体 |
| [`windsurf-assistant`](https://github.com/zhouyoukang/windsurf-assistant) | 二 (用) | 道Agent 将其注入 Cascade SP · 绝侧信道 · 热切 |

道生一, 一生二, 二生三, 三生万物.

---

## 七 · 许可

MIT.

---

> 道冲, 而用之或不盈. 渊兮, 似万物之宗.
>
> 挫其锐, 解其纷, 和其光, 同其尘.
>
> 湛兮, 似或存.
>
> 吾不知谁之子, 象帝之先.
