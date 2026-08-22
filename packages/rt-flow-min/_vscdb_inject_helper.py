# -*- coding: utf-8 -*-
# _vscdb_inject_helper.py — WAM vscdb 注入助手 (承 devaid.rt-flow v3.16.2)
# 由 extension.js 调用 · 注入/读取 vscdb 会话状态
import sqlite3, json, os, sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

APPDATA = os.environ.get('APPDATA', os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming'))

def _find_vscdb():
    candidates = [
        os.path.join(APPDATA, 'Devin', 'User', 'globalStorage', 'state.vscdb'),
        os.path.join(APPDATA, 'Windsurf', 'User', 'globalStorage', 'state.vscdb'),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return candidates[-1]

VSCDB = _find_vscdb()

try:
    uri = 'file:///' + VSCDB.replace('\\', '/') + '?mode=ro'
    con = sqlite3.connect(uri, uri=True, check_same_thread=False, timeout=5)
    rows = con.execute("SELECT key, value FROM ItemTable WHERE key LIKE '%.acp.sessioninfo.session.%'").fetchall()
    out = []
    for k, v in rows:
        try:
            d = json.loads(v)
            info = d.get('info', {})
            out.append({'key': k, 'sessionId': info.get('sessionId'), 'title': info.get('title'), 'updatedAt': info.get('updatedAt')})
        except Exception:
            pass
    sys.stdout.write(json.dumps(out, ensure_ascii=True))
    con.close()
except Exception as e:
    sys.stderr.write(str(e) + '\n')
    sys.stdout.write('[]')
