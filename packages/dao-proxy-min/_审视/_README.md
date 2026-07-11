# 万法归宗 · 配脚本之极简

## 道义

- 二十五章「人法地·地法天·天法道·道法自然」 — 配从用户·从环境·从默
- 四十八章「为道日损·损之又损·以至于无为」 — 一处之配·万脚本之用
- 八十一章「人之道·为而弗争」 — 不写死·不强求

## 五件 (此目下)

| 件 | 用 |
|----|----|
| `_dao.config.ps1`     | 万法配加载器 (ENV → JSON → prompt → 默) |
| `_dao.env.example.json` | 配之取 (复 → `_dao.env.json` 后改) |
| `_deploy.ps1`         | 万法部署 · 版本驱动 (代 `_deploy_179_v9XX.ps1`) |
| `_smoke.ps1`          | 万法烟测 · 静+活+strip-test |
| `_verify_remote.ps1`  | 万法远验 · 实物之真 |

## 三句之示

### 一句 · 烟测 (无远端 · 无凭证)

```powershell
pwsh -File _审视\_smoke.ps1                    # 默 · 自 package.json 派版
pwsh -File _审视\_smoke.ps1 -SkipLive          # 仅静检
pwsh -File _审视\_smoke.ps1 -ExpectVersion 9.8.0
```

### 二句 · 部署 (需远端 · 需凭证)

凭证三取一 (前胜后)：

1. **ENV** (临时 shell / CI):

   ```powershell
   $env:DAO_REMOTE_HOST = '192.168.31.179'
   $env:DAO_REMOTE_USER = 'zhouyoukang'
   $env:DAO_REMOTE_PASS = '<plaintext · 仅 ephemeral>'
   pwsh -File _审视\_deploy.ps1
   ```

2. **JSON + DPAPI 加密文件** (推荐):

   ```powershell
   # 一次性 · 生 DPAPI 加密凭证文件 (绑当前用户 · 当前机)
   Get-Credential | Export-Clixml -Path C:\secure\dao-cred.xml

   # _审视\_dao.env.json (从 _dao.env.example.json 复改)
   # {
   #   "Computer": "192.168.31.179",
   #   "User": "zhouyoukang",
   #   "PasswordFile": "C:\\secure\\dao-cred.xml"
   # }

   pwsh -File _审视\_deploy.ps1
   ```

3. **交互 prompt** (无 ENV 无 JSON 时自动):

   ```powershell
   pwsh -File _审视\_deploy.ps1 -Computer 192.168.31.179 -User zhouyoukang
   # ↓ 弹 SecureString 输入
   ```

### 三句 · 远验

```powershell
pwsh -File _审视\_verify_remote.ps1                # 静检远端文件
pwsh -File _审视\_verify_remote.ps1 -RunStripTest  # 加 · 在远端 node 跑 strip-test
```

## 配键之全

| 键 | ENV | JSON | 说 |
|----|-----|------|----|
| Computer     | `DAO_REMOTE_HOST`    | `Computer`     | 远端 IP/主机名 |
| User         | `DAO_REMOTE_USER`    | `User`         | 远端账户 |
| Password     | `DAO_REMOTE_PASS`    | (不读)         | plaintext · 仅 ENV · 永不入 JSON |
| PasswordFile | -                    | `PasswordFile` | DPAPI clixml 路径 (推荐) |
| ProjectRoot  | `DAO_PROJECT_ROOT`   | -              | 默自 `_审视/` 之父 |
| RemoteExtDir | `DAO_REMOTE_EXT_DIR` | `RemoteExtDir` | 默 `%USERPROFILE%\.windsurf\extensions` |
| ProxyPort    | `DAO_PROXY_PORT`     | `ProxyPort`    | 默 8889 (本地 smoke 用) |
| Version      | -                    | -              | 自 `package.json.version` 派 |

## 守

- `_dao.env.json` 不入 VSIX (`.vscodeignore` 之 `_*` 规则)
- 永勿在 JSON 写 plaintext password (loader 见即警告并忽略)
- DPAPI clixml 文件仅当前用户·当前机可解 · 不可拷贝
- 远端连接走 PSSession Negotiate (Kerberos/NTLM) · 不入 SSH 私钥困
