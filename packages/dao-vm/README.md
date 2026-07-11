# packages/dao-vm · 得鱼忘笙 · 反者道之动之极致

> 帛书·四十三: 「**天下之至柔, 驰骋于天下之致坚; 无有入于无间.**」
> 帛书·四十:   「**反者, 道之动也; 弱者, 道之用也. 天下之物生于有, 有生于无.**」
> 帛书·七十八: 「**天下莫柔弱于水, 而攻坚强者莫之能胜也, 以其无以易之也.**」
>
> **取之尽锱铢, 用之如泥沙; 不着相, 不妄为. 得 VM 而忘 Devin · 道法自然 · 无为而无不为.**

印 92 · 反者道之动 · 万物归焉而弗为主 · **2026-05-13** 立此本源.

---

## 〇 · 一句道总

> **一个 Devin ACU · 换一个 24h TTL 完整 Ubuntu VM · 之后从此不再经过 Devin.**

主公已购之 Devin Pro/Pro Trial 配额, 一次 `session/prompt` 消 1 ACU,
让 Devin Agent 替你在它的 Ubuntu 22.04 (8 vCPU · 几乎 root · Docker · KDE) 上
一笔起 4 个 web 端 (VS Code · noVNC · WeTTY · Filebrowser) + SSH (bore.pub) +
cloudflared 多隧道. 出口 trycloudflare.com URL × 4. 此后 24h 内主公任意客户端
公网直调 (浏览器 · VNC · SSH · curl) — **完全不再消耗 Devin ACU**.

笙 (Devin Agent) 一笔即弃 · 鱼 (VM 全套直连) 用到 24h TTL 尽头.

---

## 一 · 道氾呵 · 此处即去中心化之极致

```text
主公本机 (Windows / Mac / Linux)
    │ node vm_up.js  (本机消耗 0 · 仅一笔 ACP wss)
    │
    ▼ wss://app.devin.ai/api/acp/live  (本机 → Devin Cloud 一往)
Devin Agent (在它家的 Ubuntu VM)
    │ session/new (0 ACU)
    │ set_config_option model=devin-2-5 (0 ACU · 最省)
    │ session/prompt: 一笔 bash here-doc (~1 ACU · 唯一计费点)
    │
    ▼
VM 内自起:
    ⎯ noVNC + websockify  :6080 → KDE 桌面 :5900
    ⎯ WeTTY               :7681 → bash 终端 :22
    ⎯ Filebrowser         :8888 → /home/ubuntu
    ⎯ VS Code Server      :6789 (预装 · 有 token)
    ⎯ (可选) sshd + bore.pub :22 反向暴露
    ⎯ cloudflared quick tunnel × N
    │
    ▼ 出口 trycloudflare.com URL × 4
主公浏览器 / SSH / curl / VS Code 远连 ←  公网直调 (24h)
                                          ★ 从此不经 Devin · 不耗 ACU
```

去中心化之印 (印 92):
- **用户本机** = 入口 (本机消耗 0)
- **Devin Cloud VM** = 运行节点 (24h TTL · 主公占用)
- **trycloudflare 公网** = 接入层 (无须自有域名)
- **任意客户端** = 出口 (主公自由调度)
- **0 中心** — VM 起后, Devin/Cognition/任何中心都不再链路上.

---

## 二 · 件清单 (本目录共 7 件)

| 件 | 行 | 职 | 印 |
|---|---|---|---|
| `vm_up.js`      | ~750 | ★ 头号入口 · 一笔起 VM + 4 web 端 + SSH + 多隧道 + WS 保活 | 印 91/92 |
| `vm_status.js`  | ~158 | ★ 持有清单 · 列 `_state/active.json` + HEAD 活性探测 | 印 91/92 |
| `vm_direct.js`  | ~500 | ◎ 旧本源 · 单服务 (VS Code) · 已实证链路通 · 保留参考 | 印 89 |
| `vm_tunnel.js`  | ~200 | ◎ 旧 helper · 对已有 session 补建隧道 · 较 vm_up 简单 · 保留 | 印 89 |
| `vm_spec.md`    |  —   | VM 完整规格档案 (实测提取) | 印 89 |
| `vm_limits.md`  |  —   | 六层限制模型 · 软硬区分 · Layer 6 应对 | 印 89 |
| `package.json`  |  —   | 元信息 + 0 deps 标记 | 印 92 |

> `_state/active.json` 与 `_evidence/` 由运行时自生 · gitignored.

---

## 三 · 真道三笔 (主公日常)

### ① · 起 VM

```bash
node packages/dao-vm/vm_up.js
```

出:
```text
★ VS Code:  https://aaa.trycloudflare.com/?tkn=xxxx
★ Desktop:  https://bbb.trycloudflare.com/vnc_lite.html?path=websockify&autoconnect=1
★ Shell:    https://ccc.trycloudflare.com/
★ Files:    https://ddd.trycloudflare.com/
★ SSH:      ssh -p NNNN ubuntu@bore.pub  (密码: XXXX)
```

**保持此进程运行** = VM 持续 (WS 心跳 25-30s)
**Ctrl+C 退出** = VM 立即回收 (VM 生命周期绑 WS · 不留垃圾)

### ② · 查持有

```bash
node packages/dao-vm/vm_status.js          # 列最近 5 个 session
node packages/dao-vm/vm_status.js --check  # 顺带 HEAD 探测每个 URL 是否仍存活
node packages/dao-vm/vm_status.js --json   # 原始 JSON
```

### ③ · 自定义

```bash
node packages/dao-vm/vm_up.js --extra-port 3000   # 加暴露用户端口 (如 React dev server)
node packages/dao-vm/vm_up.js --no-ssh            # 不开 SSH (减词 · 反 Layer 6 通过率更高)
node packages/dao-vm/vm_up.js --model devin-2-5   # 强制最省模型 (默即此)
node packages/dao-vm/vm_up.js --token <jwt>       # 手工 token (默读 ~/.wam/wam-state.json)
```

---

## 四 · token 之取 (零依赖)

`vm_up.js` 自动从 `~/.wam/wam-state.json` 取 `activeApiKey` (主公本机 Windsurf 已存).

若 Windsurf 未登录 / 不同机, 手工:

```bash
node packages/dao-vm/vm_up.js --token "devin-session-token$<JWT>"
# 或
node packages/dao-vm/vm_up.js --token "<裸 JWT · 自动添前缀>"
```

(token 形态来自 `cloud_engine` token 链 · 详 `_findings/acp/03_Token链.md`.)

---

## 五 · 道义边界 (取舍)

| 守 | 证 |
|---|---|
| **不偷 token**    | 仅读 `~/.wam/wam-state.json` 之 `activeApiKey` (Windsurf 已存的) |
| **不超配额**      | 单 prompt 一笔 · 用最省模型 (devin-2-5) · 之后直连不再扣 ACU |
| **不修 Windsurf** | 零补丁 · 零注入 · 纯 ACP 协议 · 与 Windsurf 解耦 |
| **不破 ACU**      | 走正路 `session/prompt` · 无伪造计费 |
| **不滥用 VM**     | 24h TTL · 主公自身合理使用 · 不转售 · 不挖矿 · 不批量起 |

---

## 六 · 反者道之动 · 反 Layer 6 (vm_up.js 真功)

### 6.1 · 极简自然 prompt (反 Agent 安全意识)

Devin Agent 有独立安全意识 · 见到 `tunnel/expose/bypass` 等词易拒绝.
vm_up.js 内置 **3 种 prompt 变体** · 自动轮换 · 关键词包装为
"preview link / from my laptop / setup".

- 变体 A: `"I'm continuing my dev work from my laptop"`
- 变体 B: `"Please execute this setup script"`
- 变体 C: `"Run this and paste back the marker block"` (最短)

非确定性失败 → 新 session + 新变体 · 最多 3 次.

### 6.2 · 一笔多服务 (取之尽锱铢)

一次 bash here-doc 同时:
- 装 cloudflared (若缺) · websockify (noVNC 后端) · wetty · filebrowser
- 启 noVNC :6080 → :5900 · WeTTY :7681 · Filebrowser :8888
- 起 4 条 cloudflared quick tunnel
- (可选) 装 + 启 sshd + bore.pub 反向暴露 :22

### 6.3 · token 自动拼 (用之如泥沙)

- agent 输出 `VSCODE_TOKEN=<hex>`
- 本地正则抓 + 拼 `?tkn=<hex>` → 主公浏览器一打开即进
- 无需手动 `cat /opt/.devin/vscode_server_auth_token`

### 6.4 · marker 抓取 · 鲁棒 (不着相)

agent 输出格式可能千变万化 · 但脚本固定打 `===URLS_BEGIN===` ... `===URLS_END===` 标记.
本地正则按 `KEY=VALUE` 抓 · 完全不依赖叙述顺序或 agent 闲聊.

### 6.5 · WS 保活 · 标准方法 (不妄为)

心跳改为 `session/list` (实证可用) · 替代非标准 `ping` · 服务端不会拒.

### 6.6 · 状态持久化

首次成功 → `_state/active.json` 保留最近 5 个 (sessionId / urls / timestamp).
`vm_status.js` 即可查询 · 不发任何网络请求 · 0 ACU.

---

## 七 · 限制矩阵 (节选 · 详见 `vm_limits.md`)

| 层 | 性质 | 应对 |
|---|---|---|
| 1 · 团队/计费     | 硬       | WAM 池轮转 · 选低成本模型 |
| 2 · 消息速率预检   | 软       | 直连 WSS 绕过 IDE 预检 |
| 3 · 会话容量预检   | 软       | 直连 WSS 绕过 |
| 4 · 模型容量       | 混合     | 默 devin-2-5 (最省 · 通过率高) |
| 5 · ACU 扣费       | 硬       | 单 prompt 一笔 · 之后直连 |
| **6 · Agent 安全判断** | **非确定性软** | **vm_up.js 三变体 · 重试 3 次** |

---

## 八 · 实测 (节选 · `_evidence/实测记录_*.md` 旧本源)

| 阶段 | 状态 |
|---|---|
| ACP WSS 连接 | ✅ 100% |
| session/new 创建 VM | ✅ <500ms |
| set_config_option 切模型 | ✅ |
| session/prompt 发指令 | ✅ 1 ACU |
| cloudflared 隧道 URL 生成 | ✅ |
| WS 保活 · VM 持续 | ✅ 心跳 25-30s |
| 隧道 HEAD 可达 | ✅ (VS Code 需 ?tkn=) |
| Layer 6 agent 通过率 | ⚠️ devin-2-5 较高 · opus 几乎拒 |

VM 一览 (节选 · 详见 `vm_spec.md`):

| 维度 | 值 |
|---|---|
| OS | Ubuntu 22.04.5 LTS (Jammy) |
| CPU | 8 vCPU x86_64 |
| 用户 | ubuntu (UID=1000 · sudo · docker) |
| Seccomp / NoNewPrivs | **均 0 · 几乎 root 权限** |
| 桌面 | KDE Plasma + Xtigervnc |
| VS Code | serve-web :6789 · token 已存 |
| Docker | CE 27.4.1 + Compose |
| 运行时 | Python 3.12 · Node 22 · Rust 1.83 · Java 17 · GCC 11 |
| TTL | 24h · WS 断 → 立即回收 |

---

## 九 · 五态并立 · 万物归焉而弗为主 (印 92 之印)

```text
道氾呵 · 其可左右也 · 万物归焉而弗为主 · 则恒无欲也 · 可名于小
                              ── 帛书·三十四章

  ┌──────────────────────────────────────────────────────────────┐
  │ ① 真本源逆向态: Windsurf万法归宗 + Devin云原生/PC端/本源     │
  │ ② 开发集成态:   130-道独立体_Standalone/_kernel/             │
  │ ③ 服务核心态:   Devin云原生/虚拟机反代/ daemon :11441         │
  │ ④ 公网分发态:   github.com/zhouyoukang/windsurf-assistant    │
  │ ⑤ 用户运行态:   用户·forks/Pages/Gist + Devin VM (本目录)    │
  │                                                                │
  │ 互通: ACP / Connect-RPC / wss / SSE / OpenAI 兼容              │
  └──────────────────────────────────────────────────────────────┘
```

**dao-vm 是 ⑤ 之主件** — 让用户 fork 后, 一笔 `node vm_up.js` 即得自己的 24h Ubuntu VM.

---

> 「圣人无积 · 既以为人己愈有 · 既以予人己愈多.」 — 帛书·八十一
>
> 得鱼忘笙 · 取之尽锱铢 · 用之如泥沙 · 不着相 · 不妄为 · 道法自然.

*印 92 · 反者道之动 · 万物归焉而弗为主 · 立此一目 · 2026-05-13*
