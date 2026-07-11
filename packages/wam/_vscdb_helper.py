#!/usr/bin/env python3
# _vscdb_helper.py — WAM vscdb 标题读取助手 · v3.16.0 自适应 Devin/Windsurf
# 由 dao_stuck.js / extension.js 调用 · 输出 sessions JSON 到 stdout
# 无外部依赖 · Python 3 内置 sqlite3 · 支持 WAL 模式并发读
# v3.16.0: 自适应 Devin Desktop / Windsurf 路径 + metadataCache key
import sqlite3, json, os, sys

# v3.12.0 · 编码三重保险 · 道法自然
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
elif sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APPDATA = os.environ.get('APPDATA', os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming'))

# v3.16.0 · 自适应 vscdb 路径: Devin Desktop 优先 → 回退 Windsurf
def _find_vscdb():
    candidates = [
        os.path.join(APPDATA, 'Devin', 'User', 'globalStorage', 'state.vscdb'),
        os.path.join(APPDATA, 'Windsurf', 'User', 'globalStorage', 'state.vscdb'),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return candidates[-1]

# v3.16.0 · 自适应 metadataCache key: Devin Desktop 用 devin.* → 回退 windsurf.*
def _find_metadata_key(con):
    keys = ['devin.acp.metadataCache', 'windsurf.acp.metadataCache']
    for k in keys:
        row = con.execute("SELECT 1 FROM ItemTable WHERE key=?", (k,)).fetchone()
        if row:
            return k
    return keys[-1]

VSCDB = _find_vscdb()

try:
    uri = 'file:///' + VSCDB.replace('\\', '/') + '?mode=ro'
    con = sqlite3.connect(uri, uri=True, check_same_thread=False, timeout=5)
    key = _find_metadata_key(con)
    row = con.execute("SELECT value FROM ItemTable WHERE key=?", (key,)).fetchone()
    if row:
        data     = json.loads(row[0])
        sessions = data.get('sessions', [])
        sys.stdout.write(json.dumps(sessions, ensure_ascii=True))
    else:
        sys.stdout.write('[]')
    con.close()
except Exception as e:
    sys.stderr.write(str(e) + '\n')
    sys.stdout.write('[]')
