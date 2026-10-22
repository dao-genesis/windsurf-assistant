#!/usr/bin/env python3
# _acp_sessions_helper.py — WAM 全会话清单助手 · v3.18.4
# cascade + devin-local 同源合一 · 道法自然: 一处真源·一调全得
#
# 源1: %APPDATA%/<IDE>/User/globalStorage/state.vscdb
#       windsurf.acp.sessioninfo.session.* → providerId + title + updatedAt + cwd
#       (cascade 与 devin-cli 皆有 cwd — 工作区现成字段·无需启发式)
# 源2: %APPDATA%/devin/cli/sessions.db   (Devin CLI 权威库·明文sqlite)
#       sessions(id=slug, title, working_directory, workspace_dirs,
#                created_at, last_activity_at, hidden, model, agent_mode)
#
# 输出: {"sessions":[{id,provider,title,cwd,updatedAt,createdAt,msgCount,
#                     hidden,model,lastActivityAt}], "instance":"devin"}
import sqlite3, json, os, sys, glob, re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# --recent-local=N: 轻量模式 · 仅 sessions.db 最近N条 devin-local (侧栏心跳用·不扫vscdb)
# --msgs=<instance>:<slug>: 对话正文模式 · 倒 message_nodes 明文 (库面板阅读器用)
RECENT_ONLY = 0
MSGS = None
for a in sys.argv[1:]:
    if a.startswith('--recent-local='):
        try:
            RECENT_ONLY = int(a.split('=', 1)[1])
        except Exception:
            pass
    elif a.startswith('--msgs='):
        MSGS = a.split('=', 1)[1] or None

# v3.18.6 · IDE 用户数据根 — 平台分流 (win32=APPDATA·darwin=Application Support·linux=.config)
if sys.platform == 'win32':
    APPDATA = os.environ.get('APPDATA', os.path.join(os.path.expanduser('~'), 'AppData', 'Roaming'))
elif sys.platform == 'darwin':
    APPDATA = os.path.join(os.path.expanduser('~'), 'Library', 'Application Support')
else:
    APPDATA = os.environ.get('XDG_CONFIG_HOME', os.path.join(os.path.expanduser('~'), '.config'))
HOME = os.path.expanduser('~')

# ── 对话正文模式: --msgs=<instance>:<slug> → {messages:[{role,text,ts}], meta:{...}} ──
# devin-local 权威源: message_nodes.chat_message = {role,content} JSON 明文
# 过滤: system 提示不入 (噪音·含系统规则) · tool 截断 · 总量封顶 ~1.5MB
if MSGS:
    _mi, _sep, _slug = MSGS.partition(':')
    _db = os.path.join(APPDATA, _mi, 'cli', 'sessions.db')
    _res = {'messages': [], 'meta': {}, 'errors': []}
    try:
        if not os.path.isfile(_db):
            raise RuntimeError('no-db:' + _db)
        _c = sqlite3.connect('file:///' + _db.replace('\\', '/') + '?mode=ro',
                             uri=True, check_same_thread=False, timeout=5)
        try:
            _srow = _c.execute(
                "SELECT title,working_directory,created_at,last_activity_at,model,agent_mode "
                "FROM sessions WHERE id=?", (_slug,)).fetchone()
            if _srow:
                _res['meta'] = {'title': _srow[0] or '', 'cwd': _srow[1] or '',
                                'createdAt': int((_srow[2] or 0) * 1000),
                                'updatedAt': int((_srow[3] or 0) * 1000),
                                'model': _srow[4] or '', 'agentMode': _srow[5] or ''}
            _rows = _c.execute(
                "SELECT chat_message,created_at FROM message_nodes "
                "WHERE session_id=? ORDER BY row_id", (_slug,)).fetchall()
        finally:
            _c.close()
        _total = 0
        for _cm, _ts in _rows:
            try:
                _m = json.loads(_cm)
            except Exception:
                continue
            _role = _m.get('role') or ''
            if _role == 'system':
                continue  # 系统提示/规则注入 · 非对话内容
            _txt = _m.get('content')
            if not isinstance(_txt, str):
                try:
                    _txt = json.dumps(_txt, ensure_ascii=False)
                except Exception:
                    _txt = str(_txt or '')
            _txt = _txt.strip()
            if not _txt:
                continue
            _cap = 2000 if _role == 'tool' else 20000
            if len(_txt) > _cap:
                _txt = _txt[:_cap] + '\n…[截断 ' + str(len(_txt) - _cap) + ' 字符]'
            _res['messages'].append({'role': _role,
                                     'text': _txt,
                                     'ts': int((_ts or 0) * 1000)})
            _total += len(_txt)
            if _total > 1500000 or len(_res['messages']) >= 800:
                _res['meta']['truncated'] = True
                break
    except Exception as _e:
        _res['errors'].append(str(_e))
    sys.stdout.write(json.dumps(_res, ensure_ascii=False))
    sys.exit(0)

def _ro(db):
    return sqlite3.connect('file:///' + db.replace('\\', '/') + '?mode=ro',
                           uri=True, check_same_thread=False, timeout=5)

_IS_WIN = sys.platform == 'win32'

def _ws_name(cwd):
    if not cwd:
        return ''
    c = re.sub(r'^file:///', '', str(cwd))
    try:
        from urllib.parse import unquote
        c = unquote(c)
    except Exception:
        pass
    c = c.rstrip('/\\')
    if _IS_WIN:
        c = c.replace('/', '\\')
    return c.rsplit('/' if not _IS_WIN else '\\', 1)[-1] or c

def _norm_cwd(cwd):
    if not cwd:
        return ''
    c = re.sub(r'^file:///', '', str(cwd))
    try:
        from urllib.parse import unquote
        c = unquote(c)
    except Exception:
        pass
    # file:///c:/x → C:\x (windows 盘符首字母大写)
    if _IS_WIN and re.match(r'^[a-z]:/', c):
        c = c[0].upper() + c[1:]
    if _IS_WIN:
        c = c.replace('/', '\\')
    return c

def _ms(ts):
    """last_activity_at 是 epoch 秒(int)·updatedAt 是 ISO 串 → 统一 ms"""
    if isinstance(ts, (int, float)):
        return int(ts * 1000) if ts < 1e13 else int(ts)
    if isinstance(ts, str) and ts:
        try:
            from datetime import datetime
            s = ts.replace('Z', '+00:00')
            return int(datetime.fromisoformat(s).timestamp() * 1000)
        except Exception:
            m = re.match(r'(\d{4}-\d{2}-\d{2}T[\d:.]+)', ts)
            if m:
                try:
                    from datetime import datetime
                    return int(datetime.fromisoformat(m.group(1)).timestamp() * 1000)
                except Exception:
                    return 0
    return 0

out = {'sessions': [], 'errors': []}
by_id = {}

# ── 源2 先行: devin cli sessions.db (权威·字段最全) ──
cli_dbs = glob.glob(os.path.join(APPDATA, 'devin*', 'cli', 'sessions.db')) + \
          glob.glob(os.path.join(APPDATA, 'Devin*', 'cli', 'sessions.db'))
seen_db = set()
for sdb in cli_dbs:
    rp = os.path.realpath(sdb)
    if rp in seen_db or not os.path.isfile(sdb):
        continue
    seen_db.add(rp)
    inst = os.path.basename(os.path.dirname(os.path.dirname(sdb)))
    try:
        c = _ro(sdb)
        rows = c.execute(
            "SELECT id,title,working_directory,workspace_dirs,created_at,"
            "last_activity_at,hidden,model,agent_mode FROM sessions"
        ).fetchall()
        msgc = {}
        if not RECENT_ONLY:
            # v3.18.6 · 轻量模式免全表聚合 (60s心跳只取topN·updatedAt已驱动变化检测)
            try:
                for sid, n in c.execute(
                    "SELECT session_id,COUNT(*) FROM message_nodes GROUP BY session_id"):
                    msgc[sid] = n
            except Exception:
                pass
        c.close()
        for sid, title, wd, wdirs, cat, lat, hid, model, amode in rows:
            cwd = wd or ''
            if not cwd and wdirs:
                try:
                    wd2 = json.loads(wdirs)
                    cwd = (wd2[0] if isinstance(wd2, list) and wd2 else '')
                except Exception:
                    pass
            key = 'local:' + str(sid)
            by_id[key] = {
                'id': 'acp/devin-cli/' + str(sid),
                'slug': str(sid),
                'provider': 'devin-local',
                'instance': inst,
                'title': title or '(untitled)',
                'cwd': _norm_cwd(cwd),
                'workspace': _ws_name(cwd),
                'updatedAt': _ms(lat),
                'createdAt': _ms(cat),
                'msgCount': msgc.get(sid, 0),
                'hidden': bool(hid),
                'model': model or '',
                'agentMode': amode or '',
            }
    except Exception as e:
        out['errors'].append('sessions.db:' + str(e))

# 轻量模式: sessions.db 出齐即返回 (免 vscdb 扫描)
if RECENT_ONLY > 0:
    sessions = sorted(by_id.values(), key=lambda s: s.get('updatedAt') or 0, reverse=True)[:RECENT_ONLY]
    out['sessions'] = sessions
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.exit(0)

# ── 源1: state.vscdb sessioninfo (cascade + 兜底 devin-cli 元数据) ──
vscdbs = sorted(set(
    glob.glob(os.path.join(APPDATA, '*', 'User', 'globalStorage', 'state.vscdb'))))
for vdb in vscdbs:
    inst = os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(vdb))))
    try:
        c = _ro(vdb)
        rows = c.execute(
            "SELECT key,value FROM ItemTable WHERE key LIKE '%acp.sessioninfo.session.%'"
        ).fetchall()
        c.close()
    except Exception as e:
        out['errors'].append('vscdb:' + str(e))
        continue
    for k, v in rows:
        try:
            d = json.loads(v)
            info = d.get('info') or {}
            sid = info.get('sessionId') or k.rsplit('.', 1)[-1]
            prov = d.get('providerId') or ''
            meta = info.get('_meta') or {}
            if prov == 'cascade':
                key = 'cas:' + str(sid)
                if key not in by_id:
                    by_id[key] = {
                        'id': str(sid), 'provider': 'cascade',
                        'instance': inst,
                        'title': info.get('title') or '(untitled)',
                        'cwd': _norm_cwd(info.get('cwd')),
                        'workspace': _ws_name(info.get('cwd')),
                        'updatedAt': _ms(info.get('updatedAt')),
                        'createdAt': _ms(meta.get('cognition.ai/createdAt')),
                        'msgCount': meta.get('cognition.ai/userMessageCount') or 0,
                        'unread': bool(meta.get('cognition.ai/isUnread')),
                        'hidden': False, 'model': '', 'agentMode': '',
                    }
            elif sid.startswith('acp/'):
                slug = sid.rsplit('/', 1)[-1]
                key = 'local:' + slug
                # sessions.db 有则并 enrich(unread 等), 无则登记(IDE侧会话·cli库外)
                if key in by_id:
                    by_id[key]['unread'] = bool(meta.get('cognition.ai/isUnread'))
                    if not by_id[key].get('updatedAt'):
                        by_id[key]['updatedAt'] = _ms(info.get('updatedAt'))
                else:
                    by_id[key] = {
                        'id': sid, 'slug': slug,
                        'provider': 'devin-local', 'instance': inst,
                        'title': info.get('title') or '(untitled)',
                        'cwd': _norm_cwd(info.get('cwd')),
                        'workspace': _ws_name(info.get('cwd')),
                        'updatedAt': _ms(info.get('updatedAt')),
                        'createdAt': _ms(meta.get('cognition.ai/createdAt')),
                        'msgCount': meta.get('cognition.ai/userMessageCount') or 0,
                        'unread': bool(meta.get('cognition.ai/isUnread')),
                        'hidden': False, 'model': '', 'agentMode': '',
                    }
        except Exception:
            continue

sessions = sorted(by_id.values(), key=lambda s: s.get('updatedAt') or 0, reverse=True)
out['sessions'] = sessions
sys.stdout.write(json.dumps(out, ensure_ascii=False))
