# Devin Cloud VM 完整规格

> 去芜存菁 · 一切由实测提取 · 非文档推断

---

## 硬件 & 操作系统

| 维度 | 值 | 实证 |
| --- | --- | --- |
| OS | Ubuntu 22.04.5 LTS (Jammy Jellyfish) | `/etc/os-release` |
| 内核 | Linux 5.15.200 SMP x86_64 | `uname -a` |
| 主机名 | `devin-box` | `hostname` |
| CPU | 8 vCPU · x86_64 · GenuineIntel | `lscpu` |
| 地址空间 | 46-bit 物理 / 57-bit 虚拟 | `lscpu` |
| 服务管理 | systemd · cgroup v2 | `/proc/self/cgroup` |
| 服务单元 | `devin-remote.service` | cgroup 路径 |

## 用户 & 权限

| 维度 | 值 |
| --- | --- |
| 用户名 | `ubuntu` |
| UID/GID | 1000/1000 |
| 组 | ubuntu, **sudo**, **docker** |
| Home | `/home/ubuntu` |
| Shell | `/bin/bash` |
| Seccomp | **0 (禁用)** |
| NoNewPrivs | **0 (可提权)** |
| CapBnd | `000001ffffffffff` (近满) |
| 关键 capabilities | sys_admin · sys_module · net_admin · sys_rawio · sys_ptrace |

**结论**: 几乎是 root 等效权限 · 可 `sudo` · 可 `docker run --privileged`

## 网络

| 接口 | IP | 状态 |
| --- | --- | --- |
| eth0 | 172.16.5.2/30 | UP |
| docker0 | 172.17.0.1/16 | DOWN (待启) |
| lo | 127.0.0.1/8 | UP |

| 路由 | 值 |
| --- | --- |
| 默认网关 | 172.16.5.1 via eth0 |
| DNS | systemd-resolved (stub) |
| 公网出口 | **可达** (apt/pip/curl/wget 均通) |

## 桌面环境

| 组件 | 版本/PID | 端口 |
| --- | --- | --- |
| Xtigervnc | PID 3071 | `:0` (VNC :5900) |
| KDE Plasma | kwin_x11 + plasmashell | — |
| startplasma-x11 | PID 3074 | — |
| ksmserver / kded5 / kglobalaccel5 / klauncher | 全套 | — |

**VNC 直连**: 本地 `DISPLAY=:0` · 端口 5900 · 无需额外认证

## 浏览器

| 维度 | 值 |
| --- | --- |
| Chrome 版本 | 133.0.6943.126 (bundled) |
| 安装路径 | `/opt/.devin/chrome/chrome/linux-133.0.6943.126/chrome-linux64/chrome` |
| User-Agent | `Chrome/137.0.0.0 Safari/537.36; Devin/1.0; +devin.ai` |
| 用户数据 | `/home/ubuntu/.browser_data_dir` |
| 启动脚本 | `/opt/.devin/browser.sh` |

## VS Code Server

| 维度 | 值 |
| --- | --- |
| 二进制 | `/opt/.devin/binaries/code` |
| 模式 | `serve-web` |
| 端口 | **6789** (绑 0.0.0.0) |
| Token 文件 | `/opt/.devin/vscode_server_auth_token` |
| 用户数据 | `/opt/.devin/vscode-serve-web-data/user_data/` |
| 服务数据 | `/opt/.devin/vscode-serve-web-data/server_data/` |
| 扩展目录 | `/opt/.devin/package/vscode-installed-extensions/` |

**直连**: `http://localhost:6789/?tkn=$(cat /opt/.devin/vscode_server_auth_token)`

## Docker

| 组件 | 版本 |
| --- | --- |
| Docker CE | 27.4.1 |
| containerd | 1.7.24 |
| Docker Compose | 2.32.1 |
| Docker Buildx | 0.19.3 |

dockerd (PID 1347) + containerd (PID 1260) 均已运行

## 软件版本矩阵

| 工具 | 版本 | 来源 |
| --- | --- | --- |
| Python | 3.12.8 | pyenv |
| Node.js | v22.12.0 | 二进制 |
| Node.js (apt) | v20.18.1 | apt |
| npm | 10.8.3 | npm |
| pnpm | 9.15.1 | — |
| yarn | 1.22.22 | — |
| Rust | 1.83.0 | rustup |
| Cargo | 1.83.0 | — |
| Java | OpenJDK 17.0.13 | apt |
| Git | 2.34.1 | apt |
| GCC/G++ | 11.4.0 | apt |
| Make | 4.3 | apt |
| pip | 24.3.1 | pyenv |
| gh (GitHub CLI) | 2.72.0 | apt |

## 预装 Python 包

```
pandas · streamlit · numpy · matplotlib · seaborn · scipy · scikit-learn
folium · flake8 · watchdog · websockets · nbformat · nbconvert · psutil
aiohttp · Pillow
venv 额外: websockets · aiohttp · PyQt5==5.15.10
```

## Devin 基础设施 (/opt/.devin/)

```
/opt/.devin/
├── binaries/code              VS Code Server 二进制
├── chrome/                    Chrome 133 完整安装
├── browser.sh                 浏览器启动脚本
├── custom_remote_config.json  远程配置
├── devin_bashrc               自定义 bash profile
├── devin_git_hook.sh          Git hooks
├── devin_id                   身份文件 (38B)
├── .devin-integration-git-credentials  → git-manager.devin.ai
├── .devin_secrets.sh          密钥文件
├── authorized_keys            SSH 公钥 (733B)
├── installed_pip_packages.txt 预装 pip 包列表
├── package/
│   ├── custom_binaries/devin_editor
│   └── vscode-installed-extensions/
└── vscode-serve-web-data/
    ├── server_data/
    ├── cli_data/
    └── user_data/
```

## 关键环境变量

| 变量 | 值 |
| --- | --- |
| BROWSER | `/opt/.devin/browser.sh` |
| DISPLAY | `:0` (X11 桌面) |
| EDITOR | `/opt/.devin/package/custom_binaries/devin_editor` |
| GIT_EDITOR | `/mnt/host_share/devin-remote editor` |
| HOMEBREW_PREFIX | `/home/linuxbrew/.linuxbrew` |
| DEBIAN_FRONTEND | `noninteractive` |
| LANG | `C.UTF-8` |

## MCP 工具 (devin_mcp)

| 工具 | 功能 |
| --- | --- |
| read_wiki_structure | GitHub 仓库文档结构 |
| read_wiki_contents | GitHub 仓库文档内容 |
| ask_question | AI 驱动的仓库问答 |
| list_available_repos | 列可用仓库 |
| generate_wiki | 生成代码库 wiki |

## 挂载点

| 路径 | 用途 |
| --- | --- |
| `/mnt/host_share/` | 宿主机共享 (devin-remote 二进制等) |
| `/opt/.devin/` | Devin 基础设施 |
| `/tmp/devin-remote-overflows-1000/` | 溢出存储 |
| `/sys/fs/cgroup` | cgroup2 (rw) |

## API 端点

| 端点 | 用途 |
| --- | --- |
| `https://api.devin.ai/v3/organizations/{org_id}/attachments` | 文件上传 (75 MB max) |
| `https://app.devin.ai/org/{slug}/settings/integrations` | 集成管理 |
| `git-manager.devin.ai` | Git 凭证管理 |

## 可暴露的直连端口

| 端口 | 服务 | 协议 | 直连方式 |
| --- | --- | --- | --- |
| 5900 | Xtigervnc (VNC) | VNC/RFB | VNC 客户端 (RealVNC, TigerVNC) |
| 6789 | VS Code Server | HTTP/WS | 浏览器 |
| 22 | SSH (需安装 openssh-server) | SSH | ssh 客户端 |
| 任意 | 用户自定义服务 | TCP/HTTP | 隧道暴露 |

---

*全实测提取 · 去芜存菁 · 得鱼忘笙*
