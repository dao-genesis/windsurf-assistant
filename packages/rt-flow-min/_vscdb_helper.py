#!/usr/bin/env python3
# _vscdb_helper.py — WAM vscdb 标题读取助手 · v3.16.1 自适应 Devin/Windsurf
# 由 dao_stuck.js / extension.js 调用 · 输出 sessions JSON 到 stdout
# 无外部依赖 · Python 3 内置 sqlite3 · 支持 WAL 模式并发读
# v3.16.0: 自适应 Devin Desktop / Windsurf 路径 + metadataCache key
# v3.16.1: 根治 metadataCache 缺失 → 扫描 sessioninfo.session.* 独立 key
#   根因: 新版 Windsurf/Devin 不再写 metadataCache JSON blob · 每会话独立 key
#         windsurf.acp.sessioninfo.session.<uuid> / devin.acp.sessioninfo.session.<uuid>
#         旧 helper 只读 metadataCache → 返回 [] → 标题全失明 → UI 显示「对话 #短UUID」
#   治法: metadataCache 空/缺失时 → LIKE 扫描独立 key → 提取 info 对象
#         输出格式与旧 sessions 数组完全一致 → 调用方 (dao_stuck.js/extension.js) 零改动
import sqlite3, json, os, sys

# v3.12.0 · 编码三重保险 · 道法自然
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
elif sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# v3.18.6 · IDE 用户数据根 — 平台分流 (win32=APPDATA·darwin=Application Support·linux=.config)
if sys.platform == 'win32':
    APPDATA = os.environ.get('APPDATA', os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming'))
elif sys.platform == 'darwin':
    APPDATA = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support')
else:
    APPDATA = os.environ.get('XDG_CONFIG_HOME', os.path.join(os.path.expanduser('~'), '.config'))

# v3.18.7 · 全 vscdb 枚举: APPDATA/*/User/globalStorage/state.vscdb (多 IDE 实例合流)
def _all_vscdbs():
    out = []
    try:
        for d in os.listdir(APPDATA):
            v = os.path.join(APPDATA, d, 'User', 'globalStorage', 'state.vscdb')
            if os.path.isfile(v) and v not in out:
                out.append(v)
    except Exception:
        pass
    if not out:
        out.append(os.path.join(APPDATA, 'Windsurf', 'User', 'globalStorage', 'state.vscdb'))
    return out

# v3.16.0 · 自适应 metadataCache key: Devin Desktop 用 devin.* → 回退 windsurf.*
def _find_metadata_key(con):
    keys = ['devin.acp.metadataCache', 'windsurf.acp.metadataCache']
    for k in keys:
        row = con.execute("SELECT 1 FROM ItemTable WHERE key=?", (k,)).fetchone()
        if row:
            return k
    return keys[-1]

# v3.16.1 · 独立 sessioninfo key 扫描 (metadataCache 缺失时的根治路径)
#   新版 Windsurf/Devin: 每会话一个 key: <prefix>.acp.sessioninfo.session.<uuid>
#   value = {"providerId": "...", "info": {"sessionId": "...", "title": "...", "updatedAt": "..."}}
#   输出与 metadataCache sessions 数组同构: [{sessionId, title, updatedAt, providerId}]
def _scan_sessioninfo_keys(con):
    sessions = []
    seen = set()
    for prefix in ('windsurf', 'devin'):
        pattern = prefix + '.acp.sessioninfo.session.%'
        try:
            rows = con.execute(
                "SELECT key, value FROM ItemTable WHERE key LIKE ?", (pattern,)
            ).fetchall()
        except Exception:
            continue
        for key, value in rows:
            try:
                d = json.loads(value)
                info = d.get('info') if isinstance(d, dict) else None
                if not isinstance(info, dict):
                    continue
                sid = info.get('sessionId') or key.rsplit('.', 1)[-1]
                if not sid or sid in seen:
                    continue
                seen.add(sid)
                sessions.append({
                    'sessionId': sid,
                    'title': info.get('title'),
                    'updatedAt': info.get('updatedAt'),
                    'providerId': d.get('providerId'),
                })
            except Exception:
                continue
    return sessions

sessions = []
seen = set()
for VSCDB in _all_vscdbs():
    try:
        uri = 'file:///' + VSCDB.replace('\\', '/') + '?mode=ro'
        con = sqlite3.connect(uri, uri=True, check_same_thread=False, timeout=5)
        key = _find_metadata_key(con)
        row = con.execute("SELECT value FROM ItemTable WHERE key=?", (key,)).fetchone()
        ss = []
        if row:
            try:
                data = json.loads(row[0])
                ss = data.get('sessions', []) if isinstance(data, dict) else []
            except Exception:
                ss = []
        # v3.16.1 · metadataCache 空/缺失 → 独立 key 扫描兜底 (根治标题失明)
        if not ss:
            ss = _scan_sessioninfo_keys(con)
        con.close()
        for s in ss:
            sid = s.get('sessionId') or s.get('id')
            if not sid or sid in seen:
                continue
            seen.add(sid)
            sessions.append(s)
    except Exception:
        continue
sys.stdout.write(json.dumps(sessions, ensure_ascii=True))
