# @windsurf-assistant/dao-devin-vm · 印 115 · 反者道之动

> _「天下莫柔弱于水 · 而攻坚强者莫之能胜也 · 以其无以易之也」_ ── 帛书《老子》四十三
>
> _「邻邦相望 · 鸡狗之声相闻 · 民至老死不相往来」_ ── 帛书《老子》八十
>
> _「为之于其未有也 · 治之于其未乱也 · 合抱之木 · 生于毫末」_ ── 帛书《老子》六十四

---

## 〇 · 此包之意 (反者道之动)

承印 89→112 · LLM 反代 daemon 原跑于 **GH Actions runner** (`fleet_vm_unit.js :7862` + cf tunnel) · 此为临时 6h 节点 · 不稳 · 且**并非"虚拟机反代"之真意**.

印 115 · **反者道之动**:

```
旧: client → GH Pages → GH Actions runner(fleet_vm_unit + cf tunnel) → wss
新: client → GH Pages → Devin Cloud VM(dao_proxy /v1/* · 自带公网) → wss

         GH Actions runner 仅"接生婆": spawn Devin VM + deploy dao_proxy + 报 Gist + 退
         (鸡犬相闻 · 民至老死不相往来)
```

---

## 一 · 四件 (deployer + payload + spawner + installer)

| 件 | 用 | 角 |
|----|----|-----|
| `deployer.js` (10 KB) | GH Actions orchestrator · spawn N VM + deploy + 报 Gist | runner 内主入口 |
| `dao_proxy.js` (94 KB) | LLM 反代主体 (OpenAI + Anthropic compat · 1NUC · /v1/* + /health) | **跑在 Devin VM 内** |
| `vm_omni.js` (42 KB) | spawn 1 件 Devin VM · 拉公网 URL (`*.devinapps.com`) | runner 内调 (印 104) |
| `vm_proxy_deploy.js` (18 KB) | 装 dao_proxy 至 VM (omni file API + start.sh + keeper.sh) | runner 内调 (印 106) |

附 (workflow + tests · 不在本包):

- `.github/workflows/dao-fleet-devin-cloud.yml` (5 KB) — cron 5h + 5min poll keepalive
- `tests/_seal115_smoke.cjs` (1 KB) — 件齐守门

---

## 二 · 用 (三态)

### 2.1 GH Actions runner (主用途 · 公网无人值守)

repo secrets 设:

- `DAO_POOL_GIST_ID` — 印 95 · Gist id (含 dao-pool.json)
- `DAO_POOL_PAT` — PAT (scope: gist)

workflow trigger:

- `workflow_dispatch` (主公手动 / Web UI 一键)
- `cron 0 */5 * * *` (5h 自续 · 主公关机时仍真活)

runner 内 step 4 跑:

```bash
cd packages/dao-devin-vm
node deployer.js \
  --gist-id "$DAO_POOL_GIST_ID" \
  --pat "$DAO_POOL_PAT" \
  --n "$N_VMS"
```

step 5 跑 keepalive (350 min · 5 min poll · 替死者):

```bash
while true; do
  sleep 300
  timeout 200 node deployer.js \
    --gist-id "$DAO_POOL_GIST_ID" --pat "$DAO_POOL_PAT" \
    --n "$N_VMS"
done
```

### 2.2 本机仿测 (dry-gist · 不写 Gist)

```bash
cd packages/dao-devin-vm
node deployer.js --n 2 --dry-gist
# 起 2 件 Devin VM · deploy · 不报 Gist · 仅 evidence 立本地
```

### 2.3 reuse-pool (用现池 alive · 不耗 ACU)

```bash
cd packages/dao-devin-vm
node deployer.js --n 1 --reuse-pool --dry-gist
# 不 spawn 新 · 用 _state/vm_pool.json 中 status=alive · 仅 deploy dao_proxy
```

---

## 三 · 路径同包 fallback (反者道之动 · 不依本机外资)

`deployer.js` 之路径全用环境变量 + 同包 fallback (无 hardcode 外部路径):

| env | 默 (同包) | 用 |
|-----|----------|-----|
| `DAO_OMNI_JS` | `__dirname/vm_omni.js` | spawn VM 子脚本 |
| `DAO_DEPLOY_JS` | `__dirname/vm_proxy_deploy.js` | install dao_proxy 子脚本 |
| `DAO_POOL_JSON` | `__dirname/_state/vm_pool.json` | VM 池状态 (vm_omni 写 · vm_proxy_deploy / deployer 读) |
| `DAO_AUTH_FILE` | `__dirname/.dao_auth_token` | per-deploy 之 sk-* token (32B random hex) |
| `DAO_PROXY_FILE` | `__dirname/dao_proxy.js` | LLM 主体 (vm_proxy_deploy 上传至 VM 之 /home/ubuntu/dao_proxy/dao_proxy.js) |

★ 同包内 `_state/` 目录自动 mkdir (deployer.js 启时); `vm_pool.json` 自动空 `[]` 起头.

---

## 四 · 链路全图 (印 115 · 反者道之动)

```text
                    ┌──────────────────────────────────┐
                    │ 用户 (任公网账号 · 任设备)        │
                    │  · 浏 GitHub Pages               │
                    │  · 用 OpenAI SDK 调反代          │
                    └──────────────┬───────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
      ┌────────────┐       ┌──────────────┐    ┌──────────────────┐
      │ GH Pages   │       │ GH Actions   │    │ Devin Cloud VM   │
      │ (前 · 管)  │       │ (中 · 起)    │    │ (后 · 反代)       │
      ├────────────┤       ├──────────────┤    ├──────────────────┤
      │ index.html │       │ deployer.js  │    │ dao_proxy.js     │
      │ dao_app    │ 触发  │ · 调 Devin   │ 起  │ /v1/chat         │
      │ dao_bootst │ ───→ │ · spawn N VM │───→│ /v1/models       │
      │ Gist 读   │       │ · deploy     │    │ /health          │
      │            │ 显    │ · 报 Gist    │    │ omni router      │
      │            │ ←── │ · 退         │    │ /port/7780       │
      └─────┬──────┘       └──────┬───────┘    └────────┬─────────┘
            │                     │                     │
            │                     ▼                     │
            │             ┌──────────────┐               │
            └────读────→ │ Gist (主公)  │ ←── 写 ──────┘
                          │ dao-pool.json│
                          │ daemons[]    │
                          └──────────────┘

★ 隔离 (帛书 80):
  · GH Pages 直调 Devin VM URL  (不通过 GH Actions)
  · GH Actions 仅写 Gist URL    (不参与 LLM 链)
  · Devin VM 不知 GH 存在        (自管 token 池)
  · 三方通 Gist 间接交流        (鸡犬相闻 · 民至老死不相往来)
```

---

## 五 · 与 `packages/dao-vm/` 之关系 (并立不悖)

- `dao-vm/vm_up.js` (印 100): 人工一笔起 1 件 24h Devin VM · 跑 omni router
- **`dao-devin-vm/deployer.js` (印 115)**: GH Actions cron 自动起 N 件 + deploy dao_proxy + 替死者

两者**并行而不相悖** (《老子》六十):
- `dao-vm` = 单器手动 (1 ACU 换 24h · 个人开发)
- `dao-devin-vm` = 集器自动 (N × 5min poll · 公网服务)

---

## 六 · 帛书道义本

> _「上善若水 · 水善利万物而不争 · 处众人之所恶 · 故几于道矣」_(八)
>
> _「弱之胜强 · 柔之胜刚 · 天下莫不知 · 莫能行也」_(四十三)
>
> _「邻邦相望 · 鸡狗之声相闻 · 民至老死不相往来」_(八十)

水之性 · 不争 · 处下 · 自然.

反代 VM (后) · 不强求集中, 散于 N 节点.
GitHub VM (前) · 不强求 daemon, 仅做接生婆.
两者鸡犬相闻 · 各自然 · **民莫之令而自均焉** (三十二).

---

## 七 · 印传承

| 印 | 立 |
|----|----|
| 印 100 · 太极笙万物 | 一 PAT 即一切 · 9 步自举 · 民莫之令而自均 |
| 印 101 · 用 + 管 | 主面 80% + 抽屉 4 节 · 大道至简 |
| 印 112 · 反者道之动 mesh | 4 VM × 12 mesh edge = 100% 真通 |
| **印 115** · **GH 面板综合管 · Devin VM 反代** | **彻底反者 · daemon 移 Devin · 三方鸡犬相闻** |
| 印 116 · 池真态揭示 | 5min poll keepalive 必要性正证 (印 115 真之实) |

---

_「道恒无名 · 侯王若能守之 · 万物将自宾」── 三十二_
