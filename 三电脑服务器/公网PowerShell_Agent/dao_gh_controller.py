#!/usr/bin/env python3
"""
道法自然 · GitHub中转Controller — 反者道之动
通过GitHub仓库文件下发命令、读取结果

用法:
  python dao_gh_controller.py exec DESKTOP-MASTER "echo hello"
  python dao_gh_controller.py exec-sync DESKTOP-MASTER "hostname"
  python dao_gh_controller.py agents
  python dao_gh_controller.py result <cmd_id>
  python dao_gh_controller.py heartbeat
  
回退: GitHub不可达时 → 本地 ps-agent server
"""
import json, os, sys, time, secrets
from datetime import datetime

GITHUB_REPO = os.environ.get('DAO_GH_REPO', 'zhouyoukang1234-spec/windsurf-assistant')
GITHUB_BRANCH = 'dao-relay'
GITHUB_PAT = os.environ.get('GITHUB_PAT', '')
if not GITHUB_PAT:
    try:
        import subprocess as _sp
        _r = _sp.run(['git', 'config', '--global', 'dao.github-pat'], capture_output=True, text=True, timeout=3)
        if _r.returncode == 0 and _r.stdout.strip():
            GITHUB_PAT = _r.stdout.strip()
    except: pass
LOCAL_SERVER = os.environ.get('DAO_AGENT_SERVER', 'http://127.0.0.1:9910')
MASTER_TOKEN = os.environ.get('PS_AGENT_MASTER_TOKEN', 'dao-ps-agent-2026')
GITHUB_SUB_PAT = os.environ.get('GITHUB_SUB_PAT', '')
if not GITHUB_SUB_PAT:
    try:
        import subprocess as _sp2
        _r2 = _sp2.run(['git', 'config', '--global', 'dao.github-sub-pat'], capture_output=True, text=True, timeout=3)
        if _r2.returncode == 0 and _r2.stdout.strip(): GITHUB_SUB_PAT = _r2.stdout.strip()
    except: pass
GITHUB_MAIN_REPO = 'zhouyoukang/windsurf-assistant'
DAO_PROXY = os.environ.get('DAO_GH_PROXY', '127.0.0.1:7890')

def _gh_api(method, path, body=None, timeout=15, pat=None):
    """三路尝试: 直连 → 代理隧道 → urllib代理"""
    if pat is None:
        pat = GITHUB_SUB_PAT if GITHUB_REPO != GITHUB_MAIN_REPO else GITHUB_PAT
    if not pat:
        return {'error': 'no PAT'}
    r = _gh_api_direct(method, path, body, timeout, pat)
    if 'error' not in r: return r
    r = _gh_api_tunnel(method, path, body, timeout, pat)
    if 'error' not in r: return r
    r = _gh_api_urllib_proxy(method, path, body, timeout, pat)
    return r

def _gh_api_direct(method, path, body=None, timeout=15, pat=None):
    if pat is None: pat = GITHUB_PAT
    import urllib.request
    url = f'https://api.github.com{path}'
    hdrs = {'Authorization': f'token {pat}', 'User-Agent': 'dao-relay-ctrl', 'Accept': 'application/vnd.github.v3+json'}
    data = json.dumps(body).encode() if body else None
    if data: hdrs['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        if r.status == 204: return {}
        return json.loads(r.read().decode())
    except Exception as e:
        return {'error': str(e)}

def _gh_api_tunnel(method, path, body=None, timeout=15, pat=None):
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
            s.close(); return {'error': 'CONNECT failed'}
        ctx = _ssl.create_default_context()
        ss = ctx.wrap_socket(s, server_hostname='api.github.com')
        body_str = json.dumps(body) if body else ''
        http_req = (f'{method} {path} HTTP/1.1\r\nHost: api.github.com\r\nAuthorization: token {pat}\r\nUser-Agent: dao-relay-ctrl\r\nAccept: application/vnd.github.v3+json\r\nContent-Type: application/json\r\nContent-Length: {len(body_str)}\r\nConnection: close\r\n\r\n{body_str}')
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
        status_code = int(text.split('\r\n')[0].split()[1]) if text.split('\r\n')[0].split()[1:] else 0
        body_start = text.find('\r\n\r\n')
        body_text = text[body_start+4:] if body_start >= 0 else ''
        if body_text and body_text[0] in '0123456789abcdef':
            chunks, lines, i = [], body_text.split('\r\n'), 0
            while i < len(lines) - 1:
                try:
                    size = int(lines[i], 16)
                    if size == 0: break
                    i += 1; chunks.append(lines[i]); i += 1
                except: break
            body_text = ''.join(chunks)
        try:
            parsed = json.loads(body_text)
            if isinstance(parsed, dict) and parsed.get('message', '').startswith('API rate limit'):
                return {'error': parsed['message']}
            if status_code >= 400: return {'error': f'HTTP {status_code}: {body_text[:200]}'}
            return parsed
        except:
            if status_code >= 400: return {'error': f'HTTP {status_code}'}
            return {'raw': body_text[:500]}
    except Exception as e:
        return {'error': str(e)}

def _gh_api_urllib_proxy(method, path, body=None, timeout=15, pat=None):
    if pat is None: pat = GITHUB_PAT
    import urllib.request
    url = f'https://api.github.com{path}'
    hdrs = {'Authorization': f'token {pat}', 'User-Agent': 'dao-relay-ctrl', 'Accept': 'application/vnd.github.v3+json'}
    data = json.dumps(body).encode() if body else None
    if data: hdrs['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    proxy = urllib.request.ProxyHandler({'https': f'http://{DAO_PROXY}', 'http': f'http://{DAO_PROXY}'})
    opener = urllib.request.build_opener(proxy)
    try:
        r = opener.open(req, timeout=timeout)
        if r.status == 204: return {}
        return json.loads(r.read().decode())
    except Exception as e:
        return {'error': str(e)}

def _gh_raw_read(path, branch=GITHUB_BRANCH, timeout=10):
    """通过 GitHub API 读取文件内容 (raw.githubusercontent.com被GFW封锁)"""
    r = _gh_api('GET', f'/repos/{GITHUB_REPO}/contents/{path}?ref={branch}', timeout=timeout)
    if isinstance(r, dict) and 'content' in r:
        import base64
        return json.loads(base64.b64decode(r['content']).decode())
    if isinstance(r, dict) and 'error' in r:
        return r
    try:
        import urllib.request
        url = f'https://raw.githubusercontent.com/{GITHUB_REPO}/{branch}/{path}'
        req = urllib.request.Request(url, headers={'User-Agent': 'dao-relay-ctrl'})
        resp = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(resp.read().decode())
    except Exception as e:
        return {'error': str(e)}

def _local_api(method, path, body=None, timeout=35):
    import urllib.request
    url = LOCAL_SERVER + path
    hdrs = {'Content-Type': 'application/json', 'Authorization': f'Bearer {MASTER_TOKEN}'}
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(r.read().decode())
    except Exception as e:
        return {'error': str(e)}

_gh_available_cache = {'ok': False, 'ts': 0}

def _check_github_available():
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

def _ensure_branch():
    """确保dao-relay分支存在"""
    # 检查分支
    r = _gh_api('GET', f'/repos/{GITHUB_REPO}/branches/{GITHUB_BRANCH}')
    if 'error' not in r:
        return True
    # 创建分支（从main）
    main_sha = _gh_api('GET', f'/repos/{GITHUB_REPO}/git/refs/heads/main')
    if 'error' in main_sha:
        return False
    sha = main_sha['object']['sha']
    r = _gh_api('POST', f'/repos/{GITHUB_REPO}/git/refs', {
        'ref': f'refs/heads/{GITHUB_BRANCH}',
        'sha': sha,
    })
    return 'error' not in r

def _queue_command_gh(agent_id, cmd_type, payload):
    """通过GitHub下发命令"""
    cmd_id = f"cmd_{int(time.time()*1000)}_{secrets.token_hex(3)}"
    path = f'.dao-relay/commands/{agent_id}/{cmd_id}.json'
    content = json.dumps({
        'cmd_id': cmd_id,
        'type': cmd_type,
        'payload': payload,
        'queued_at': time.time(),
        'controller': 'dao-gh-ctrl',
    }, ensure_ascii=False, default=str)
    
    body = {
        'message': f'dao-relay: command {cmd_id} for {agent_id}',
        'content': __import__('base64').b64encode(content.encode()).decode(),
        'branch': GITHUB_BRANCH,
    }
    r = _gh_api('PUT', f'/repos/{GITHUB_REPO}/contents/{path}', body)
    if 'error' in r:
        return None, r['error']
    return cmd_id, None

def _get_result_gh(agent_id, cmd_id, timeout=60):
    """从GitHub读取结果"""
    path = f'.dao-relay/results/{agent_id}/{cmd_id}.json'
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = _gh_raw_read(path)
        if 'error' not in r:
            return r
        time.sleep(3)
    return {'status': 'timeout', 'cmd_id': cmd_id}

def _list_heartbeats_gh():
    """列出所有Agent心跳"""
    tree = _gh_api('GET', f'/repos/{GITHUB_REPO}/git/trees/{GITHUB_BRANCH}?recursive=1')
    if 'error' in tree:
        return []
    agents = []
    for item in tree.get('tree', []):
        if item['type'] == 'blob' and item['path'].startswith('.dao-relay/heartbeat/') and item['path'].endswith('.json'):
            hb = _gh_raw_read(item['path'])
            if 'error' not in hb:
                agents.append(hb)
    return agents

def cmd_exec(agent_id, command, sync=False, timeout=30):
    """执行命令"""
    gh_ok = _check_github_available()
    
    if gh_ok:
        _ensure_branch()
        cmd_id, err = _queue_command_gh(agent_id, 'shell', {'command': command})
        if err:
            print(f"[!] GitHub下发失败: {err}, 回退本地")
            gh_ok = False
        else:
            print(f"[+] GitHub命令已下发: cmd_id={cmd_id}")
            if sync:
                result = _get_result_gh(agent_id, cmd_id, timeout=timeout)
                return result
            return {'cmd_id': cmd_id, 'agent_id': agent_id, 'mode': 'github'}
    
    if not gh_ok:
        # 回退本地server
        if sync:
            r = _local_api('POST', '/api/exec-sync', {
                'agent_id': agent_id, 'type': 'shell', 'cmd': command, 'timeout': timeout
            })
        else:
            r = _local_api('POST', '/api/exec', {
                'agent_id': agent_id, 'type': 'shell', 'cmd': command
            })
        r['mode'] = 'local'
        return r

def cmd_agents():
    """列出在线Agent"""
    gh_ok = _check_github_available()
    if gh_ok:
        agents = _list_heartbeats_gh()
        if agents:
            print(f"[+] GitHub中转: {len(agents)} 个Agent在线")
            for a in agents:
                print(f"  - {a.get('agent_id','?')} status={a.get('status','?')} ts={a.get('ts','?')}")
            return agents
    
    # 回退本地
    r = _local_api('GET', '/api/agents')
    agents = r.get('agents', [])
    print(f"[+] 本地Server: {r.get('count', 0)} 个Agent")
    for a in agents:
        print(f"  - {a.get('id','?')} status={a.get('status','?')}")
    return agents

def cmd_result(agent_id, cmd_id):
    """读取命令结果"""
    gh_ok = _check_github_available()
    if gh_ok:
        r = _gh_raw_read(f'.dao-relay/results/{agent_id}/{cmd_id}.json')
        if 'error' not in r:
            return r
    
    # 回退本地
    return _local_api('GET', f'/api/agent/{agent_id}/output/{cmd_id}')

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == 'exec':
        if len(sys.argv) < 4:
            print("用法: dao_gh_controller.py exec <agent_id> <command>")
            sys.exit(1)
        r = cmd_exec(sys.argv[2], ' '.join(sys.argv[3:]))
        print(json.dumps(r, indent=2, ensure_ascii=False, default=str))
    
    elif action == 'exec-sync':
        if len(sys.argv) < 4:
            print("用法: dao_gh_controller.py exec-sync <agent_id> <command>")
            sys.exit(1)
        r = cmd_exec(sys.argv[2], ' '.join(sys.argv[3:]), sync=True, timeout=60)
        if r.get('status') == 'completed':
            stdout = r.get('result', {}).get('stdout', '')
            print(stdout.rstrip() if stdout else json.dumps(r, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(r, indent=2, ensure_ascii=False, default=str))
    
    elif action == 'agents':
        cmd_agents()
    
    elif action == 'result':
        if len(sys.argv) < 4:
            print("用法: dao_gh_controller.py result <agent_id> <cmd_id>")
            sys.exit(1)
        r = cmd_result(sys.argv[2], sys.argv[3])
        print(json.dumps(r, indent=2, ensure_ascii=False, default=str))
    
    elif action == 'heartbeat':
        # 手动触发心跳检查
        gh_ok = _check_github_available()
        print(f"GitHub: {'✅' if gh_ok else '❌'}")
        local_ok = 'error' not in _local_api('GET', '/api/health')
        print(f"Local: {'✅' if local_ok else '❌'}")
    
    else:
        print(f"未知操作: {action}")
        print(__doc__)

if __name__ == '__main__':
    main()
