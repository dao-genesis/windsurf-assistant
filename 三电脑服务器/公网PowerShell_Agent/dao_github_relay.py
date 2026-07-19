#!/usr/bin/env python3
"""
道法自然 · GitHub中转Agent — 反者道之动
通过GitHub仓库文件作为命令/结果中转通道

架构:
  Controller → GitHub API (创建/更新文件) → Agent 轮询 raw.githubusercontent.com → 执行 → GitHub API (回写结果)
  
  回退: GitHub不可达时 → 本地 ps-agent server (127.0.0.1:9910)

中转协议:
  命令文件: .dao-relay/commands/{agent_id}/cmd_{timestamp}_{random}.json
  结果文件: .dao-relay/results/{agent_id}/cmd_{id}.json
  心跳文件: .dao-relay/heartbeat/{agent_id}.json
  
  命令格式:
  {
    "cmd_id": "cmd_xxx",
    "type": "shell|sysinfo|process_list|...",
    "payload": {...},
    "queued_at": timestamp,
    "controller": "cascade-ai"
  }
  
  结果格式:
  {
    "cmd_id": "cmd_xxx",
    "status": "completed|failed",
    "result": {...},
    "completed_at": timestamp,
    "agent_id": "DESKTOP-MASTER"
  }
"""
import json, os, sys, time, subprocess, threading, secrets
from pathlib import Path
from datetime import datetime

# ── 配置 ──
GITHUB_REPO = os.environ.get('DAO_GH_REPO', 'zhouyoukang1234-spec/windsurf-assistant')
GITHUB_BRANCH = 'dao-relay'
GITHUB_PAT = os.environ.get('GITHUB_PAT', '')
if not GITHUB_PAT:
    # 尝试从git配置读取
    try:
        import subprocess as _sp
        _r = _sp.run(['git', 'config', '--global', 'dao.github-pat'], capture_output=True, text=True, timeout=3)
        if _r.returncode == 0 and _r.stdout.strip():
            GITHUB_PAT = _r.stdout.strip()
    except: pass
# 子PAT (fork仓库, 5000次/h rate limit)
GITHUB_SUB_PAT = os.environ.get('GITHUB_SUB_PAT', '')
if not GITHUB_SUB_PAT:
    try:
        import subprocess as _sp2
        _r2 = _sp2.run(['git', 'config', '--global', 'dao.github-sub-pat'], capture_output=True, text=True, timeout=3)
        if _r2.returncode == 0 and _r2.stdout.strip(): GITHUB_SUB_PAT = _r2.stdout.strip()
    except: pass
# 主仓库 (zhouyoukang, 60次/h rate limit)
GITHUB_MAIN_REPO = 'zhouyoukang/windsurf-assistant'
AGENT_ID = os.environ.get('COMPUTERNAME', 'DESKTOP-MASTER')
LOCAL_SERVER = os.environ.get('DAO_AGENT_SERVER', 'http://127.0.0.1:9910')
POLL_INTERVAL = int(os.environ.get('DAO_GH_POLL_INTERVAL', '10'))
MASTER_TOKEN = os.environ.get('PS_AGENT_MASTER_TOKEN', 'dao-ps-agent-2026')
RELAY_DIR = f'.dao-relay/commands/{AGENT_ID}'
RESULT_DIR = f'.dao-relay/results/{AGENT_ID}'
HEARTBEAT_DIR = f'.dao-relay/heartbeat'

# ── GitHub API ──
DAO_PROXY = os.environ.get('DAO_GH_PROXY', '127.0.0.1:7890')

def _gh_api(method, path, body=None, timeout=15, pat=None):
    """调用GitHub API — 自动选PAT + 三路尝试"""
    # 自动选择PAT: fork仓库用子PAT, 主仓库用主PAT
    if pat is None:
        pat = GITHUB_SUB_PAT if GITHUB_REPO != GITHUB_MAIN_REPO else GITHUB_PAT
    if not pat:
        return {'error': 'no PAT'}
    
    # 尝试1: 直连
    result = _gh_api_direct(method, path, body, timeout, pat)
    if 'error' not in result:
        return result
    
    # 尝试2: 手动CONNECT隧道 (绕过GFW)
    result = _gh_api_tunnel(method, path, body, timeout, pat)
    if 'error' not in result:
        return result
    
    # 尝试3: urllib ProxyHandler
    result = _gh_api_urllib_proxy(method, path, body, timeout, pat)
    return result

def _gh_api_direct(method, path, body=None, timeout=15, pat=None):
    """直连GitHub API"""
    if pat is None: pat = GITHUB_PAT
    import urllib.request
    url = f'https://api.github.com{path}'
    hdrs = {
        'Authorization': f'token {pat}',
        'User-Agent': 'dao-relay-agent',
        'Accept': 'application/vnd.github.v3+json',
    }
    data = json.dumps(body).encode() if body else None
    if data:
        hdrs['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        if r.status == 204:
            return {}
        return json.loads(r.read().decode())
    except Exception as e:
        return {'error': str(e)}

def _gh_api_tunnel(method, path, body=None, timeout=15, pat=None):
    """通过代理CONNECT隧道访问GitHub API — 绕过GFW SNI封锁"""
    if pat is None: pat = GITHUB_PAT
    import socket, ssl as _ssl
    ph, pp = DAO_PROXY.split(':')
    pp = int(pp)
    try:
        s = socket.create_connection((ph, pp), timeout=timeout)
        s.sendall(b'CONNECT api.github.com:443 HTTP/1.1\r\nHost: api.github.com:443\r\n\r\n')
        resp = b''
        while b'\r\n\r\n' not in resp:
            chunk = s.recv(4096)
            if not chunk: break
            resp += chunk
        if b'200' not in resp:
            s.close()
            return {'error': 'CONNECT tunnel failed'}
        ctx = _ssl.create_default_context()
        ss = ctx.wrap_socket(s, server_hostname='api.github.com')
        body_str = json.dumps(body) if body else ''
        http_req = (
            f'{method} {path} HTTP/1.1\r\n'
            f'Host: api.github.com\r\n'
            f'Authorization: token {pat}\r\n'
            f'User-Agent: dao-relay-agent\r\n'
            f'Accept: application/vnd.github.v3+json\r\n'
            f'Content-Type: application/json\r\n'
            f'Content-Length: {len(body_str)}\r\n'
            f'Connection: close\r\n'
            f'\r\n'
            f'{body_str}'
        )
        ss.sendall(http_req.encode())
        data = b''
        while True:
            try:
                chunk = ss.recv(8192)
                if not chunk: break
                data += chunk
            except: break
        ss.close()
        text = data.decode(errors='replace')
        parts = text.split('\r\n', 1)
        status_code = int(parts[0].split()[1]) if len(parts[0].split()) > 1 else 0
        body_start = text.find('\r\n\r\n')
        body_text = text[body_start+4:] if body_start >= 0 else ''
        # 处理chunked encoding
        if body_text and body_text[0] in '0123456789abcdef':
            chunks = []
            lines = body_text.split('\r\n')
            i = 0
            while i < len(lines) - 1:
                try:
                    size = int(lines[i], 16)
                    if size == 0: break
                    i += 1
                    chunks.append(lines[i])
                    i += 1
                except: break
            body_text = ''.join(chunks)
        try:
            parsed = json.loads(body_text)
            if isinstance(parsed, dict) and parsed.get('message', '').startswith('API rate limit'):
                return {'error': parsed['message']}
            if status_code >= 400:
                return {'error': f'HTTP {status_code}: {body_text[:200]}'}
            return parsed
        except:
            if status_code >= 400:
                return {'error': f'HTTP {status_code}'}
            return {'raw': body_text[:500]}
    except Exception as e:
        return {'error': str(e)}

def _gh_api_urllib_proxy(method, path, body=None, timeout=15, pat=None):
    """通过urllib ProxyHandler访问"""
    if pat is None: pat = GITHUB_PAT
    import urllib.request
    url = f'https://api.github.com{path}'
    hdrs = {
        'Authorization': f'token {pat}',
        'User-Agent': 'dao-relay-agent',
        'Accept': 'application/vnd.github.v3+json',
    }
    data = json.dumps(body).encode() if body else None
    if data:
        hdrs['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    proxy = urllib.request.ProxyHandler({
        'https': f'http://{DAO_PROXY}',
        'http': f'http://{DAO_PROXY}',
    })
    opener = urllib.request.build_opener(proxy)
    try:
        r = opener.open(req, timeout=timeout)
        if r.status == 204:
            return {}
        return json.loads(r.read().decode())
    except Exception as e:
        return {'error': str(e)}

def _gh_raw_read(path, branch=GITHUB_BRANCH, timeout=10):
    """通过 GitHub API 读取文件内容 (raw.githubusercontent.com被GFW封锁)"""
    # 直接用API的contents端点 — 走代理隧道
    r = _gh_api('GET', f'/repos/{GITHUB_REPO}/contents/{path}?ref={branch}', timeout=timeout)
    if isinstance(r, dict) and 'content' in r:
        import base64
        return json.loads(base64.b64decode(r['content']).decode())
    if isinstance(r, dict) and 'error' in r:
        return r
    # 回退: 尝试raw.githubusercontent.com (可能直连可达)
    try:
        import urllib.request
        url = f'https://raw.githubusercontent.com/{GITHUB_REPO}/{branch}/{path}'
        req = urllib.request.Request(url, headers={'User-Agent': 'dao-relay-agent'})
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read().decode())
    except Exception as e:
        return {'error': str(e)}

def _gh_tree(branch=GITHUB_BRANCH, timeout=15):
    """获取仓库目录树 (通过API)"""
    return _gh_api('GET', f'/repos/{GITHUB_REPO}/git/trees/{branch}?recursive=1', timeout=timeout)

# ── 本地Server回退 ──
def _local_api(method, path, body=None, timeout=35):
    """本地 ps-agent server API"""
    import urllib.request
    url = LOCAL_SERVER + path
    hdrs = {'Content-Type': 'application/json'}
    if method == 'POST' and path in ('/api/exec', '/api/exec-sync', '/api/broadcast'):
        hdrs['Authorization'] = f'Bearer {MASTER_TOKEN}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(r.read().decode())
    except Exception as e:
        return {'error': str(e)}

# ── 命令执行 ──
def exec_shell(cmd, timeout_sec=60):
    try:
        p = subprocess.run(
            cmd, shell=True, capture_output=True, text=True,
            timeout=timeout_sec, encoding='utf-8', errors='replace'
        )
        return {
            'stdout': p.stdout[:500000] if p.stdout else '',
            'stderr': p.stderr[:100000] if p.stderr else '',
            'exit_code': p.returncode
        }
    except subprocess.TimeoutExpired:
        return {'error': f'Command timed out ({timeout_sec}s)', 'exit_code': -1, 'stdout': ''}
    except Exception as e:
        return {'error': str(e), 'exit_code': -1, 'stdout': ''}

def handle_command(cmd):
    """处理单条命令"""
    cmd_type = cmd.get('type', 'shell')
    cmd_id = cmd.get('cmd_id', '?')
    payload = cmd.get('payload', {})

    print(f"  [>] 执行: type={cmd_type} id={cmd_id[:20]}...")

    if cmd_type == 'shell':
        command = payload.get('command') or payload.get('cmd', '')
        result = exec_shell(command)
    elif cmd_type == 'sysinfo':
        result = exec_shell('systeminfo')
        result['type'] = 'sysinfo'
    elif cmd_type == 'process_list':
        result = exec_shell('tasklist /FO CSV /NH')
    elif cmd_type == 'network_info':
        result = exec_shell('ipconfig /all')
    elif cmd_type == 'env_vars':
        result = exec_shell('set')
    elif cmd_type == 'file_read':
        fp = payload.get('path', '')
        result = exec_shell(f'type "{fp}"')
    elif cmd_type == 'file_list':
        dp = payload.get('path', '.')
        result = exec_shell(f'dir /b "{dp}"')
    elif cmd_type == 'disk_info':
        result = exec_shell('wmic logicaldisk get size,freespace,caption')
    else:
        result = {'error': f'Unknown command type: {cmd_type}', 'exit_code': -1}

    result_data = {
        'cmd_id': cmd_id,
        'status': 'completed' if result.get('exit_code', -1) >= 0 else 'failed',
        'result': result,
        'completed_at': time.time(),
        'agent_id': AGENT_ID,
    }
    return result_data

# ── GitHub中转轮询 ──
_gh_available_cache = {'ok': False, 'ts': 0}

def _check_github_available():
    """检查GitHub API是否可达 (30s缓存)"""
    now = time.time()
    if now - _gh_available_cache['ts'] < 30:
        return _gh_available_cache['ok']
    if not GITHUB_PAT:
        _gh_available_cache['ok'] = False
        _gh_available_cache['ts'] = now
        return False
    r = _gh_api('GET', f'/repos/{GITHUB_REPO}', timeout=10)
    ok = 'error' not in r
    _gh_available_cache['ok'] = ok
    _gh_available_cache['ts'] = now
    return ok

def _check_local_available():
    """检查本地server是否可达"""
    try:
        import urllib.request
        r = urllib.request.urlopen(f'{LOCAL_SERVER}/api/health', timeout=3)
        d = json.loads(r.read().decode())
        return d.get('status') == 'ok'
    except:
        return False

def _poll_github_commands():
    """从GitHub仓库轮询命令文件"""
    tree = _gh_tree()
    if 'error' in tree:
        return []
    
    commands = []
    for item in tree.get('tree', []):
        if item['type'] == 'blob' and item['path'].startswith(RELAY_DIR) and item['path'].endswith('.json'):
            cmd_data = _gh_raw_read(item['path'])
            if 'error' not in cmd_data and not cmd_data.get('_processed'):
                commands.append(cmd_data)
    return commands

def _submit_github_result(result_data):
    """通过GitHub API回写结果文件"""
    cmd_id = result_data['cmd_id']
    path = f'{RESULT_DIR}/{cmd_id}.json'
    content = json.dumps(result_data, ensure_ascii=False, default=str)
    
    # 创建文件到dao-relay分支
    body = {
        'message': f'dao-relay: result for {cmd_id}',
        'content': __import__('base64').b64encode(content.encode()).decode(),
        'branch': GITHUB_BRANCH,
    }
    return _gh_api('PUT', f'/repos/{GITHUB_REPO}/contents/{path}', body)

def _mark_github_command_processed(cmd):
    """标记命令已处理（删除命令文件）"""
    path = f'{RELAY_DIR}/{cmd["cmd_id"]}.json'
    # 先获取sha
    file_info = _gh_api('GET', f'/repos/{GITHUB_REPO}/contents/{path}?ref={GITHUB_BRANCH}')
    if 'error' in file_info:
        return file_info
    sha = file_info.get('sha')
    body = {
        'message': f'dao-relay: processed {cmd["cmd_id"]}',
        'sha': sha,
        'branch': GITHUB_BRANCH,
    }
    return _gh_api('DELETE', f'/repos/{GITHUB_REPO}/contents/{path}', body)

def _submit_heartbeat_github():
    """通过GitHub API写心跳文件"""
    path = f'{HEARTBEAT_DIR}/{AGENT_ID}.json'
    content = json.dumps({
        'agent_id': AGENT_ID,
        'status': 'online',
        'ts': datetime.now().isoformat(),
        'hostname': AGENT_ID,
    }, ensure_ascii=False)
    
    # 先检查文件是否存在
    file_info = _gh_api('GET', f'/repos/{GITHUB_REPO}/contents/{path}?ref={GITHUB_BRANCH}')
    sha = file_info.get('sha') if 'error' not in file_info else None
    
    body = {
        'message': f'dao-relay: heartbeat {AGENT_ID}',
        'content': __import__('base64').b64encode(content.encode()).decode(),
        'branch': GITHUB_BRANCH,
    }
    if sha:
        body['sha'] = sha
    return _gh_api('PUT', f'/repos/{GITHUB_REPO}/contents/{path}', body)

# ── 本地server轮询 ──
def _poll_local_commands():
    """从本地server轮询命令"""
    r = _local_api('GET', f'/api/poll?id={AGENT_ID}&token={_local_token}', timeout=35)
    if 'error' in r:
        return []
    return r if isinstance(r, list) else r.get('commands', [])

_local_token = None

def _register_local():
    """注册到本地server"""
    global _local_token
    info = {
        'hostname': AGENT_ID,
        'username': os.environ.get('USERNAME', 'zhouyoukang'),
        'os': 'Windows 11',
        'ps_version': '7.5',
        'agent_version': '3.2-dao-github-relay',
    }
    r = _local_api('POST', '/api/connect', {'sysinfo': info})
    if 'error' not in r:
        _local_token = r.get('token')
        print(f"[+] 本地注册成功: token={_local_token[:12]}...")
    return r

def _submit_local_result(result_data):
    """提交结果到本地server"""
    r = _local_api('POST', '/api/result', {
        'agent_id': AGENT_ID,
        'token': _local_token,
        'cmd_id': result_data['cmd_id'],
        'result': result_data['result'],
    })
    return r

def _heartbeat_local():
    """本地server心跳"""
    if not _local_token:
        return
    _local_api('POST', '/api/heartbeat', {
        'agent_id': AGENT_ID,
        'token': _local_token,
        'sysinfo': {'status': 'github-relay-polling'}
    }, timeout=5)

# ── 主循环 ──
def main():
    print("=" * 60)
    print("道法自然 · GitHub中转Agent v1.0")
    print("反者道之动 · 无为而无不为")
    print("=" * 60)
    
    # 检测通道可用性
    gh_ok = _check_github_available()
    local_ok = _check_local_available()
    
    mode = 'github' if gh_ok else ('local' if local_ok else 'none')
    print(f"[+] GitHub API: {'✅ 可达' if gh_ok else '❌ 不可达'}")
    print(f"[+] 本地Server: {'✅ 可达' if local_ok else '❌ 不可达'}")
    print(f"[+] 中转模式: {mode}")
    
    if mode == 'none':
        print("[!] 无可用中转通道，等待...")
        # 等待任一通道可用
        while mode == 'none':
            time.sleep(10)
            gh_ok = _check_github_available()
            local_ok = _check_local_available()
            mode = 'github' if gh_ok else ('local' if local_ok else 'none')
            print(f"[.] 检测: GitHub={'✅' if gh_ok else '❌'} Local={'✅' if local_ok else '❌'}")
    
    if mode == 'local':
        _register_local()
    
    print(f"[*] 开始轮询 (mode={mode}, interval={POLL_INTERVAL}s)")
    
    heartbeat_counter = 0
    while True:
        try:
            # 动态切换通道
            if mode == 'github':
                cmds = _poll_github_commands()
                for cmd in cmds:
                    result = handle_command(cmd)
                    _submit_github_result(result)
                    _mark_github_command_processed(cmd)
                
                heartbeat_counter += 1
                if heartbeat_counter % 6 == 0:  # 每60s心跳
                    _submit_heartbeat_github()
                    
            elif mode == 'local':
                cmds = _poll_local_commands()
                for cmd in cmds:
                    t = threading.Thread(target=lambda c: _submit_local_result(handle_command(c)), args=(cmd,), daemon=True)
                    t.start()
                
                heartbeat_counter += 1
                if heartbeat_counter % 2 == 0:  # 每20s心跳
                    _heartbeat_local()
            
            # 定期重新检测GitHub可达性
            if heartbeat_counter % 30 == 0:  # 每5分钟
                new_gh = _check_github_available()
                if new_gh and mode != 'github':
                    print(f"[+] GitHub恢复可达！切换到GitHub中转")
                    mode = 'github'
                elif not new_gh and mode == 'github':
                    print(f"[!] GitHub不可达，回退到本地server")
                    mode = 'local'
                    if not _local_token:
                        _register_local()
            
        except Exception as e:
            print(f"[!] 轮询异常: {e}")
        
        time.sleep(POLL_INTERVAL if mode == 'github' else 1)

if __name__ == '__main__':
    main()
