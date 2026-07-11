# WAM v3.16.0 · 路丁(Path Ding) · vscdb直写认证状态
# 从根本底层代替命令注入 · 无为而无不为
#
# 原理:
#   Electron secrets = v10 + AES-256-GCM · 密钥由 DPAPI 保护
#   WAM 作为同用户进程可用 DPAPI 解密密钥 → 加密新 session → 直写 vscdb
#
# v3.16.0 根治: 自适应 session key · 双写策略
#   旧版 Windsurf: windsurf_auth.sessions + windsurf_auth.apiServerUrl
#   新版 Devin Desktop: devin_auth1_token + devin_auth.apiServerUrl
#   双写: 同时写入新旧两种 key → 无论 IDE 版本都能生效
#
# 用法: python _vscdb_inject_helper.py inject <session_token> <api_server_url>
#       python _vscdb_inject_helper.py decrypt
#       python _vscdb_inject_helper.py detect

import sqlite3, json, base64, os, sys, struct, uuid

def dpapi_decrypt(encrypted):
    """Decrypt DPAPI-protected data using Windows CryptUnprotectData"""
    import ctypes
    import ctypes.wintypes
    class DATA_BLOB(ctypes.Structure):
        _fields_ = [('cbData', ctypes.wintypes.DWORD),
                     ('pbData', ctypes.POINTER(ctypes.c_char))]
    p = ctypes.create_string_buffer(encrypted, len(encrypted))
    blob_in = DATA_BLOB(len(encrypted), p)
    blob_out = DATA_BLOB()
    if ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)
    ):
        result = ctypes.string_at(blob_out.pbData, blob_out.cbData)
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)
        return result
    raise Exception("DPAPI decrypt failed")

def get_electron_key(local_state_path):
    with open(local_state_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    encrypted_key = base64.b64decode(data['os_crypt']['encrypted_key'])
    if encrypted_key[:5] != b'DPAPI':
        raise Exception("Expected DPAPI prefix")
    return dpapi_decrypt(encrypted_key[5:])

def encrypt_electron_value(key, plaintext):
    """v10 + nonce(12) + AES-256-GCM(ciphertext + tag)"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ct = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    return b'v10' + nonce + ct

def decrypt_electron_value(key, encrypted):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if encrypted[:3] != b'v10':
        raise Exception("Expected v10 prefix")
    nonce = encrypted[3:15]
    ct = encrypted[15:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ct, None).decode('utf-8')

def get_paths():
    appdata = os.environ.get('APPDATA', os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming'))
    devin_db = os.path.join(appdata, 'Devin', 'User', 'globalStorage', 'state.vscdb')
    devin_ls = os.path.join(appdata, 'Devin', 'Local State')
    if os.path.exists(devin_db) and os.path.exists(devin_ls):
        return devin_db, devin_ls
    ws_db = os.path.join(appdata, 'Windsurf', 'User', 'globalStorage', 'state.vscdb')
    ws_ls = os.path.join(appdata, 'Windsurf', 'Local State')
    return ws_db, ws_ls

# v3.16.0 · Session key 常量 · 旧版 + 新版双写
SK_OLD_SESSIONS = 'secret://{"extensionId":"codeium.windsurf","key":"windsurf_auth.sessions"}'
SK_OLD_APISERVER = 'secret://{"extensionId":"codeium.windsurf","key":"windsurf_auth.apiServerUrl"}'
SK_NEW_SESSIONS = 'secret://{"extensionId":"codeium.windsurf","key":"devin_auth1_token"}'
SK_NEW_APISERVER = 'secret://{"extensionId":"codeium.windsurf","key":"devin_auth.apiServerUrl"}'

# v3.16.0 · 探测 vscdb 中已有的 session key · 判断 IDE 版本
def detect_session_keys(vscdb_path):
    """探测 vscdb 中已存在哪些 session key · 返回 {old: bool, new: bool, keys: []}"""
    conn = sqlite3.connect(vscdb_path)
    c = conn.cursor()
    c.execute("SELECT key FROM ItemTable WHERE key LIKE '%secret://%windsurf_auth%' OR key LIKE '%secret://%devin_auth%' OR key LIKE '%windsurfAuthStatus%'")
    found = [row[0] for row in c.fetchall()]
    conn.close()
    has_old = any('windsurf_auth.sessions' in k for k in found)
    has_new = any('devin_auth1_token' in k for k in found)
    return {"old": has_old, "new": has_new, "keys": found}

def do_inject(session_token, api_server_url):
    vscdb_path, local_state_path = get_paths()
    key = get_electron_key(local_state_path)
    # Build session object
    session = {
        "id": str(uuid.uuid4()),
        "accessToken": session_token,
        "account": {"label": "WAM", "id": "wam-injected"},
        "scopes": []
    }
    sessions_json = json.dumps([session])
    sessions_enc = encrypt_electron_value(key, sessions_json)
    sessions_buf = json.dumps({"type": "Buffer", "data": list(sessions_enc)})
    apiserver_enc = encrypt_electron_value(key, api_server_url)
    apiserver_buf = json.dumps({"type": "Buffer", "data": list(apiserver_enc)})
    # Write to vscdb · v3.16.0 双写策略: 新旧 key 同时写入
    conn = sqlite3.connect(vscdb_path)
    c = conn.cursor()
    # 旧版 key (Windsurf)
    c.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (SK_OLD_SESSIONS, sessions_buf))
    c.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (SK_OLD_APISERVER, apiserver_buf))
    # 新版 key (Devin Desktop) · v3.16.0 根治
    c.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (SK_NEW_SESSIONS, sessions_buf))
    c.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (SK_NEW_APISERVER, apiserver_buf))
    # Update windsurfAuthStatus (non-encrypted)
    auth_status = json.dumps({"apiKey": session_token, "allowedCommandModelConfigsProtoBinaryBase64": [], "userStatusProtoBinaryBase64": ""})
    c.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", ("windsurfAuthStatus", auth_status))
    conn.commit()
    conn.close()
    # Output result as JSON for WAM to parse
    result = {"ok": True, "detail": "vscdb-injected-dual", "vscdb": vscdb_path}
    print(json.dumps(result))

def do_decrypt():
    vscdb_path, local_state_path = get_paths()
    key = get_electron_key(local_state_path)
    conn = sqlite3.connect(vscdb_path)
    c = conn.cursor()
    # v3.16.0 · 双读: 优先新版 key → 回退旧版 key
    for sk in [SK_NEW_SESSIONS, SK_OLD_SESSIONS]:
        c.execute("SELECT value FROM ItemTable WHERE key = ?", (sk,))
        row = c.fetchone()
        if row:
            try:
                d = json.loads(row[0])
                enc = bytes(d["data"])
                plain = decrypt_electron_value(key, enc)
                sessions = json.loads(plain)
                source = 'devin_auth1_token' if 'devin_auth1_token' in sk else 'windsurf_auth.sessions'
                print(json.dumps({"ok": True, "sessions": sessions, "source": source}, indent=2))
                conn.close()
                return
            except Exception as e:
                print(json.dumps({"ok": False, "error": "decrypt-fail:" + str(e), "key": sk}))
                continue
    print(json.dumps({"ok": False, "error": "no sessions found in any key"}))
    conn.close()

def do_detect():
    vscdb_path, local_state_path = get_paths()
    info = detect_session_keys(vscdb_path)
    info["vscdb"] = vscdb_path
    print(json.dumps(info, indent=2))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "no command"}))
        sys.exit(1)
    cmd = sys.argv[1]
    try:
        if cmd == "inject":
            st = sys.argv[2] if len(sys.argv) > 2 else ""
            asu = sys.argv[3] if len(sys.argv) > 3 else "https://server.self-serve.windsurf.com"
            if not st:
                print(json.dumps({"ok": False, "error": "no session_token"}))
                sys.exit(1)
            do_inject(st, asu)
        elif cmd == "decrypt":
            do_decrypt()
        elif cmd == "detect":
            do_detect()
        else:
            print(json.dumps({"ok": False, "error": "unknown command: " + cmd}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)
