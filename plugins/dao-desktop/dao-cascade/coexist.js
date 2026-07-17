// 道 · 共存场景边界探测(道并行而不相悖) —— 反者道之动, 本源修正。
// ─────────────────────────────────────────────────────────────────────────────
// 场景: 本插件(dao-desktop)已原生代替官方 IDE 的功能并内建六板块; 用户常在同一
//   IDE 内又装独立的 dao-vsix(二合一)/dao-one(三合一)/dao-proxy-pro/dao-proxy-min。
//   两套同类板块并存时须判定: 哪些数据资源该共享同源(免双写割裂), 哪些该隔离不冲突。
// 铁律: 本模块**只读探测**, 绝不写任何兄弟插件的文件; 对账号池只提供只读可见性
//   (visibility-only), 不采纳兄弟凭据(体系不同, 见下)。
//
// 落盘真源对照(反查 devin-remote 兄弟插件源码得来, 非臆测):
//   本插件(dao-desktop) : ~/.dao/{cascade-pool,proxy-channels,inject-profile,
//                          github-fleet,web-search,local-api}.json  · 端口: 临时随机
//   dao-vsix(二合一)     : ~/.dao/{dao-accounts-auth,dao-inject-profile,git-pats,
//                          web-cookies,dao-config}.json            · 端口: 9920 固定
//   dao-proxy-pro/min    : ~/.codeium/dao-byok/{revproxy,endpoint}.json(独立命名空间)
// 关键: dao-vsix 账号池走 auth1 体系(app.devin.ai 登录态注入), 本插件账号池走
//   windsurf_api_key/LS 体系(credentials.toml)——凭据体系不同, 文件名亦不同, 故
//   零双写冲突; 本插件仅只读镜像 dao-vsix 已登录号列表入 /api/pool.siblings 供参照。
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

function home() { return process.env.DAO_COEXIST_HOME || os.homedir(); }
function expand(p) { return p.replace(/^~(?=\/)/, home()); }

// 兄弟插件注册表: extId(VS Code 扩展目录名前缀) + 落盘资源 + 与本插件板块的关系与判定。
// verdict: isolated-namespace(异命名空间零交叉) / isolated-diverged(同目录异文件名天然分流)
//        / share-visibility(同类资源, 只读镜像可见, 不采纳) / isolated(本插件无对应面)
function registry() {
  return [
    {
      key: "dao-vsix", label: "二合一(dao-vsix)", extId: "dao.dao-vsix", port: 9920,
      data: [
        { file: "~/.dao/dao-accounts-auth.json", relatesTo: "account-pool", verdict: "share-visibility",
          note: "另一套账号池(auth1 体系/app.devin.ai 登录态)。文件名与本插件 cascade-pool.json(windsurf_api_key/LS 体系)不同, 无双写冲突; 只读镜像其号列表入 /api/pool.siblings, 不采纳其凭据(体系不同)" },
        { file: "~/.dao/dao-inject-profile.json", relatesTo: "inject", verdict: "isolated-diverged",
          note: "dao- 前缀与本插件 inject-profile.json 天然分流, 各写各档" },
        { file: "~/.dao/git-pats.json", relatesTo: "github-fleet", verdict: "isolated-diverged",
          note: "GitHub 纵向; 文件名与 github-fleet.json 不同, 无冲突" },
        { file: "~/.dao/web-cookies.json", relatesTo: null, verdict: "isolated",
          note: "本插件无对应面, 零交叉" },
        { file: "~/.dao/dao-config.json", relatesTo: null, verdict: "isolated",
          note: "dao-vsix 自有配置, 本插件不读写" },
      ],
    },
    {
      key: "dao-proxy-pro", label: "反代增强(dao-proxy-pro)", extId: "dao-agi.dao-proxy-pro",
      data: [
        { file: "~/.codeium/dao-byok/revproxy.json", relatesTo: "proxy-pro", verdict: "isolated-namespace",
          note: "独立命名空间 ~/.codeium/dao-byok, 与本插件 ~/.dao/proxy-channels.json 完全隔离; 两者反代面互不劫持官方模型请求" },
        { file: "~/.codeium/dao-byok/endpoint.json", relatesTo: "proxy-pro", verdict: "isolated-namespace",
          note: "同上" },
      ],
    },
    {
      key: "dao-proxy-min", label: "反代精简(dao-proxy-min)", extId: "dao-agi.dao-proxy-min",
      data: [
        { file: "~/.codeium/dao-byok/revproxy.json", relatesTo: "proxy-pro", verdict: "isolated-namespace",
          note: "与 dao-proxy-pro 共 ~/.codeium/dao-byok 命名空间(其内部 daomin.* 自隔离), 与本插件 ~/.dao 零交叉" },
      ],
    },
    {
      key: "dao-one", label: "三合一(dao-one)", extId: "dao.dao-one",
      inherits: ["dao-vsix", "dao-proxy-pro"],
      note: "= dao-vsix 基座 + dao-proxy-pro 折入; 落盘取二者并集, 判定同两者",
    },
  ];
}

// 本插件(dao-desktop)自持落盘真源(供共存对照, 与各板块 *Path() 同值)。
function selfSurfaces() {
  return {
    "account-pool": "~/.dao/cascade-pool.json",
    "proxy-pro": "~/.dao/proxy-channels.json",
    "inject": "~/.dao/inject-profile.json",
    "github-fleet": "~/.dao/github-fleet.json",
    "web-search": "~/.dao/web-search.json",
    "local-api": "~/.dao/local-api.json",
    "credentials.toml(官方登录态)": "~/.local/share/devin/credentials.toml (仅显式 /api/pool/switch 写, 首次自动备份 .bak, /api/pool/restore 可归还)",
  };
}

// 扫描 IDE 扩展目录判定兄弟插件是否已装(VS Code 目录名形如 publisher.name-<version>)。
function extRoots() {
  if (process.env.DAO_EXT_ROOTS) return process.env.DAO_EXT_ROOTS.split(path.delimiter).filter(Boolean);
  const h = home();
  return [".devin", ".vscode", ".vscode-oss", ".windsurf", ".cursor"].map((d) => path.join(h, d, "extensions"));
}

function installedExtIds() {
  const ids = new Set();
  for (const root of extRoots()) {
    let entries = [];
    try { entries = fs.readdirSync(root); } catch (_) { continue; }
    for (const name of entries) {
      const m = name.match(/^(.+?)-\d+\.\d+\.\d+/); // 剥版本尾
      if (m) ids.add(m[1].toLowerCase());
    }
  }
  return ids;
}

function fileExists(rel) { try { return fs.existsSync(expand(rel)); } catch (_) { return false; } }

// 只读探测报告: 各兄弟是否已装/其落盘是否存在 + 共存判定矩阵 + 忠告。
function detect() {
  const installed = installedExtIds();
  const isInstalled = (extId) => installed.has(String(extId).toLowerCase());
  const siblings = registry().map((s) => {
    const data = (s.data || []).map((d) => ({ ...d, exists: fileExists(d.file) }));
    return {
      key: s.key, label: s.label, extId: s.extId, port: s.port || null,
      installed: isInstalled(s.extId),
      inherits: s.inherits || undefined,
      note: s.note || undefined,
      data,
    };
  });
  return { installed: [...installed].sort(), siblings };
}

// 只读镜像 dao-vsix 账号池的号列表(仅邮箱与是否有 auth, **绝不含任何凭据**)。
// 供本插件 /api/pool.siblings 参照展示, 与本插件自有池(cascade-pool.json)互不采纳。
function siblingAccounts() {
  const out = [];
  const src = expand("~/.dao/dao-accounts-auth.json"); // dao-vsix 账号库(对象: email→{auth1,...})
  let store = null;
  try { store = JSON.parse(fs.readFileSync(src, "utf8")); } catch (_) { store = null; }
  if (store && typeof store === "object" && !Array.isArray(store)) {
    for (const email of Object.keys(store)) {
      const rec = store[email] || {};
      out.push({
        email,
        source: "dao-vsix",
        hasAuth: !!rec.auth1,
        orgName: rec.orgName || "",
        note: "只读参照(auth1 体系); 本插件切号写 credentials.toml, 不采纳此凭据",
      });
    }
  }
  return out;
}

// 数据流通矩阵(数据的本源流通): 把「官方↔插件全资源真源」(sync-audit)与兄弟插件注册表合并,
// 给出每类资源的**共享总线成员**与**隔离边界**。核心洞见: 官方引擎落盘真源(~/.codeium/windsurf
// + ~/.local/share/devin)本就是**跨插件数据总线**——凡复用官方 LS 引擎者(官方 IDE / dao-vsix /
// dao-one / dao-desktop)读写同一份, 一侧写全侧见(源同一即流通); 各插件自持面(~/.dao/*)按
// 文件名/命名空间隔离, 各写各真源, 互不串写。
function dataFlow() {
  const sa = require("./sync-audit");
  // 复用官方 LS 引擎的成员(共享官方真源总线): 官方 IDE + 三个 dao 插件。
  const ENGINE_MEMBERS = ["official-ide", "dao-desktop", "dao-vsix", "dao-one"];
  const shared = sa.surfaces().map((s) => ({
    resource: s.key, label: s.label, source: s.path,
    channel: "official-engine-bus",
    sharedWith: ENGINE_MEMBERS.slice(),
    note: "官方引擎落盘真源即跨插件数据总线; 任一成员写, 其余成员直读同一文件即见(源同一即流通)",
  }));
  // 各插件自持面: 按文件名/命名空间隔离(不串写)。列出本插件自持面与兄弟对应面的分流关系。
  const isolated = [];
  const self = selfSurfaces();
  for (const [rel, p] of Object.entries(self)) {
    if (rel.startsWith("credentials.toml")) continue; // 登录态属官方引擎总线(见 sync-audit/boundary)
    isolated.push({ resource: rel, owner: "dao-desktop", source: p, channel: "plugin-namespace",
      note: "本插件自持面(~/.dao/*, mode 600); 兄弟插件对应面文件名不同, 天然分流不串写" });
  }
  for (const s of registry()) {
    for (const d of (s.data || [])) {
      if (d.verdict === "isolated-namespace" || d.verdict === "isolated-diverged" || d.verdict === "isolated") {
        isolated.push({ resource: d.file, owner: s.key, source: d.file, channel: "plugin-namespace",
          relatesTo: d.relatesTo || null, note: d.note });
      }
    }
  }
  return {
    principle: "数据本源流通 = 共享官方引擎真源(单一总线·源同一即双向) + 自持面命名空间隔离(各写各真源·不串写)。",
    bus: { channel: "official-engine-bus", members: ENGINE_MEMBERS,
      roots: ["~/.codeium/windsurf", "~/.local/share/devin"],
      verify: "POST /api/coexist/roundtrip (写探针→跨成员同源复读→还原)" },
    shared, isolated,
  };
}

// 跨插件数据流通活体验证: 共享总线资源复用 sync-audit「写后对侧复读」(证共享面真流通),
// 并附静态隔离断言(自持面文件名分流)。返回 { ok, sharedFlow, isolation }。
function roundtrip(only) {
  const sa = require("./sync-audit");
  const sharedFlow = sa.roundtrip(only);
  const flow = dataFlow();
  const isolation = flow.isolated.map((i) => ({
    resource: i.resource, owner: i.owner, channel: i.channel,
    // 隔离成立判据: 该资源路径不落在官方引擎总线根下(即不与共享面同源) → 不串写。
    isolatedFromBus: !/\.codeium[\\/]windsurf|\.local[\\/]share[\\/]devin/.test(i.source),
  }));
  return {
    ok: sharedFlow.ok && isolation.every((i) => i.isolatedFromBus),
    principle: flow.principle,
    sharedFlow, isolation,
  };
}

function report() {
  const d = detect();
  const anyPeer = d.siblings.some((s) => s.installed);
  const advisories = [
    "本插件已原生代替官方 IDE 功能并内建六板块; 与独立同类插件共存时, 数据面按文件名/命名空间天然分流, 无双写冲突。",
    "账号池: dao-vsix 走 auth1(app.devin.ai 注入)、本插件走 windsurf_api_key(credentials.toml)——凭据体系不同, 各写各真源; 本插件只读镜像 dao-vsix 已登录号入 /api/pool.siblings 供参照, 绝不采纳其凭据。",
    "反代: dao-proxy-pro/min 落 ~/.codeium/dao-byok, 本插件落 ~/.dao/proxy-channels.json——异命名空间零交叉, 反代面互不劫持官方模型请求。",
    "官方登录态 credentials.toml: 仅本插件显式 /api/pool/switch 触碰(首次自动备份 .bak, /api/pool/restore 可归还); dao-vsix 不写此文件(其用 localStorage auth1 注入), 故此面亦无并发双写。",
  ];
  return {
    principle: "共存(道并行而不相悖): 同类板块两存时, 数据资源按文件名/命名空间分流互不冲突; 同源账号只读镜像可见不采纳; 官方登录态单点显式可归还。",
    coexisting: anyPeer,
    self: selfSurfaces(),
    installedExtensions: d.installed,
    siblings: d.siblings,
    siblingAccounts: siblingAccounts(),
    advisories,
  };
}

module.exports = { registry, selfSurfaces, extRoots, installedExtIds, detect, siblingAccounts, dataFlow, roundtrip, report };
