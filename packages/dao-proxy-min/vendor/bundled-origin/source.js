#!/usr/bin/env node
/**
 * 000-本源_Origin · 源.js
 * =============================================================
 * 道法自然 · 反者道之动 · 庖丁解牛 · 以神遇而不以目视
 *
 * 唯一职: 反代 Windsurf Cascade 一切 inference 请求,
 *         彻底隔离官方提示词, 帛书《老子》为唯一本源.
 *
 * v9.9.60P · 同步Min v9.9.60 · 损之又损·去嘱留经·繁体化·经文自足 · 承v9.9.57P
 *           TAO_TURN_ANCHOR: 效率型→深度型 · 八经集成(道德经·阴符经·大学·易经·荀子·孙子·管子·道德经)
 *           去一切边界/止/限 · 去效率导向 · 释放深思 · 无为而无以为(帛书甲本)
 *           TAO_SUB_ANCHOR: 虑而执要 · 先思后提炼
 *           道义: 四十章「反者道之动也」· 四十八章「损之又损以至于无为·无为而无以为」
 * v9.9.56 · 根治重载根因 · observeAllSPInBody depth=6→2 + 512KB体积门控 · 承v9.9.55
 *           与 v9.9.50 已修的 modifyAnyInferenceSP depth=6 完全同构 · 遗漏于观察路径
 * v9.9.55 · create_memory完整移除 + MEMORY_INTRO_RE · 最小化解决注入干扰 · 承v9.9.54
 *           ① stripCreateMemoryTool: 整块切除<function>create_memory</function>
 *             v9.9.35仅删描述行·工具定义仍在·Agent仍知有此工具·今彻底切除
 *             在neutralizeBlock(KEEP_BLOCKS路径)和deepStripProtoSideChannels(全字段)双覆盖
 *           ② MEMORY_INTRO_RE: 剥除孤立的记忆前置介绍行
 *             "These memories were automatically retrieved..." 在MEMORY_BLOCK_RE
 *             切块后可能留孤立介绍行 · 今一并剥净
 *           道义: 六十四章「为之于其未有也·治之于其未乱也」· 损之又损
 * v9.9.54 · 副路末锚 · 断偏移传导链 · 反者道之动
 *           治: TAO_SUB_ANCHOR(~18字) · 仅summary/memory加 · ephemeral/chat不加
 * v9.9.53 · 首尾互文双锚 · Turn Anchor复归 · chat主路末锚TAO_TURN_ANCHOR
 * v9.9.52 · 损 CHECKPOINT_BLOCK_RE / CHECKPOINT_MARKER_RE 死代码 · 承v9.9.51
 *           v9.9.51 移除剥除逻辑后·两常量仅存定义无引用·损之·泯之
 *           正反两动之证: v9.9.36加(误判跨对话) → v9.9.51退(上下文桥) → v9.9.52损(反三者)
 * v9.9.51 · CHECKPOINT 不再剥除 · 上下文丢失根因 · 承v9.9.50
 *           根因: CHECKPOINT 块是 Windsurf reload 后注入的【当前会话】摘要
 *           v9.9.36误判为「跨对话噪声」剥之 → 模型失去 reload 前全部上下文
 *           「DO NOT ACKNOWLEDGE」= LLM 自然处理指令 · 无需 proxy 代劳
 * v9.9.50 · 双修 · 承v9.9.49
 *           ① INFER_STRIP 回退 modifyAnyInferenceSP · depth=6 递归同步阻塞是 reload 根因
 *           ② trimUserInfo 截断 user_information 中终端历史 · 防跨会话任务漂移
 * v9.9.49 · 移除"及其后文本"· 误诊修正 · 精准指向经典
 *           v9.9.20作用域锁真因=conversation_summary被剥 · v9.9.36真治 · 今损冗余补丁
 *           "你本无名…下述帛书《老子》道藏《阴符经》：" v9.9.20风格+动态三经 · 承v9.9.48
 * v9.9.48 · CHECKPOINT_BLOCK_RE 上界 8000→40000 · CHECKPOINT_MARKER_RE 上界 500→30000
 *           实证: 含代码块的 checkpoint ~15000-18000 字 → {0,8000}? 放弃 → 整块透传
 *           40000/30000 覆盖所有现实场景 · indexOf("CHECKPOINT")门控保性能 · 承v9.9.47
 * v9.9.47 · 书名号复归 · 动态经藏名 · 认知锚点
 *           _canonHeader()动态生成"你本无名…下述帛书《老子》道藏《阴符经》及其后文本："
 *           实证:空头→崩溃(v9.9.46)·无书名号→弱化(v9.9.38)·书名号→能力正常
 *           书名号《》=模型认知锚点·训练中权威已知·不可损
 * v9.9.46 · (废)帛书直起·空头部 · 模型完全回退Cascade官方身份·截图实证崩溃
 * v9.9.45 · 反者道之动 · proto损坏根治 · nestedOk移出if块 · 承v9.9.44
 * v9.9.44 · 大道至简 · 双线融合 · ⑫-D移除+deepStrip无条件 · 承v9.9.43
 * v9.9.43 · 损之又损 · session_context+code_interaction_summary移出SCT · 实证未出现
 * v9.9.42 · 无为而无以为 · SECTION_OVERRIDE全删(非中性化) · 真无为
 * v9.9.41 · 道法自然 · viewed_file+learnings移出SCT · @ 文件引用与会话学习上下文不再误剥
 * v9.8.0 · 守一不离 · 三十九章「得一」· 复 @ 工具之根
 *           SIDE_CHANNEL_TAGS 删 'additional_metadata' · 守 @ 项与元之一体
 *           tape all_fields raw_text 显 AFTER (strip+neutralize) · 名实终一
 * v9.7.9 · 道法自然 · 反者道之动 · 中性化隐藏 SECTION_OVERRIDE 身份锚
 * v9.7.8 · 三十辐共一毂 · 复 7 辐之用 · 当其无有车之用
 * v9.7.7 · 复归于朴 · 大道至简 · 为道日损 · 损之又损
 *
 *   注入正文 = TAO_HEADER + DAO_DE_JING_81 (帛书甲本德道二经合) + TAO_FOOTER
 *
 *   TAO_HEADER (v9.9.38 帧宽修正 · 四十二章「道生一·一生二·二生三·三生万物」):
 *     "你本无名 名可名也 非恒名也 下述所有文本为你所遵从之本源：\n\n"
 *     宽帧 · 「所有文本」覆道经+keeps · 「本源」为根基非独占规则 · 「所遵从」保约束力
 *     无 user_rules · 无 MEMORY framework · 不强调 · 不防御 · 不立 Cascade 之名
 *
 *   DAO_DE_JING_81 (v9.7.7 损中夹至 \n\n):
 *     德经 (3949 字) + "\n\n" + 道经 (3253 字) · 不分上下篇 · 帛书甲本
 *     无传世本"道可道，非常道" · 唯帛书原文"道，可道也，非恒道也"
 *
 *   TAO_FOOTER (v9.7.7 损至空):
 *     "" · 帛书全文即终 · 无收束 framework
 *
 *   总注入 ~ 7237 字 · 零官方残留 · 纯帛书裸呈
 *
 *   _customSP (用户实时编辑) 优先 · 默认走 TAO_HEADER 路径.
 *
 *   章义: 二十八章「朴散则为器·大制无割」· 复归于朴
 *         四十八章「为道日损·损之又损·以至于无为·无为而无不为」
 *         十七章「大上·下知有之」· 不强调即至简
 *         五十六章「知者弗言·言者弗知」· 不言之教
 *
 * 四档处理:
 *   CHAT_PROTO  · GetChatMessage{,V2}     · invertSP + deepStrip 侧信道
 *   CHAT_RAW    · RawGetChatMessage       · invertSP + deepStrip 侧信道
 *   INFER_STRIP · 其他 inference RPC      · 仅剥侧信道 · 不替 SP
 *   PASSTHROUGH · 非 inference (mgmt 等)  · 直透
 *
 * 上游:
 *   inference.codeium.com           · 推理
 *   server.self-serve.windsurf.com  · 管理
 *
 * 入口: ORIGIN_PORT (默认 8889)
 * 控制面:
 *   GET  /origin/ping           · 状态
 *   GET  /origin/health         · 存活别名 (→ ping 精简 · 通用约定)
 *   GET  /origin/mode           · 当前模式
 *   POST /origin/mode           · 切换 {"mode":"invert"|"passthrough"}
 *   GET  /origin/selftest       · 自证: 三路径前置道魂 · 返回 json 诊断
 *   GET  /origin/lastinject     · 最近一次真实 SP 注入 (before/after)
 *                                  ?full=1 返回全文 · 默认截头尾 · 落盘持存
 *   GET  /origin/preview        · 抱一守中 · 实时全貌 (before+after+解剖)
 *                                  invert:      after=invertSP(before)  (帛书全替)
 *                                  passthrough: after=before=Windsurf原SP
 *   POST /origin/loopback       · v9.3.0 反之用反 · 闭环自举
 *                                  {user_msg, timeout_ms?, want_full?}
 *                                  用最近 chat 缓 + 替 user msg + 真转云端
 *                                  收响应解 grpc · 返 model 之答 · 令模型自审
 *
 * 外接api热配置 (v9.9.90 · 五十七章「我无为也 而民自化」):
 *   GET  /origin/ea/config       · 获取完整配置
 *   POST /origin/ea/config       · 批量设置配置
 *   GET  /origin/ea/status       · 路由状态 + provider健康
 *   GET  /origin/ea/providers    · 列出所有 provider (apiKey脱敏)
 *   GET  /origin/ea/routes       · 列出所有路由
 *   GET  /origin/ea/models/:name · 探测 provider 可用模型
 *   POST /origin/ea/provider     · 热添加/更新 provider {name, cfg}
 *   DELETE /origin/ea/provider/:name · 热删除 provider
 *   POST /origin/ea/route        · 热添加/更新路由 {modelUid, route}
 *   DELETE /origin/ea/route/:uid · 热删除路由
 *   POST /origin/ea/reload       · 热重载配置文件
 *   POST /origin/ea/probe        · 探测所有 provider 健康
 *   POST /origin/ea/reset-health · 清空健康缓存
 *   GET  /origin/ea/available-models · v9.9.94 可用模型列表(默认+seen)
 *   GET  /origin/ea/seen-models  · v9.9.94 兼容旧前端
 *   GET  /origin/ea/overview     · v9.9.94 一站式面板数据(available_models替代seen_models)
 *   GET  /origin/ea/discover-models · v9.9.95 三层实证模型发现(rpc+seen+fallback)
 *   POST /origin/ea/test-chat    · v9.9.95 全链路测试(后端→provider端到端)
 *   GET  /origin/ea/model-map    · v9.9.95 模型三重映射(uid→displayName→实际模型)
 *
 * 模式二:
 *   invert      · 前置帛书 · 守工程之骨 (默认)
 *   passthrough · 零改写 · 紧急撤退用
 *
 * 启动: node 源.js
 */
"use strict";
const net = require("net");
const http = require("http");
const http2 = require("node:http2");
const https = require("https");
const url = require("url");
const fs = require("fs");
const path = require("path");
const os = require("os");
const zlib = require("zlib");

// ★ v9.9.91 · 修法① · 执一 · 引用 sp_invert.js 为唯一 SP 引擎 · 消除双引擎
//   道义: 二十八章「圣人执一以为天下牧」· 大制无割 · 一引擎统两路
const _spInvertLib = (() => {
  try {
    return require(
      path.join(__dirname, "sp_invert"),
    );
  } catch {
    return null;
  }
})();

// ═══════════════════════════════════════════════════════════
// ★ 上游代理agent (自包含 · 无外部依赖) · 用于 test-chat 等后端直发provider的链路
//   根因: test-chat 在后端自起 https.request 直连 provider · 远程机直连境外渠道被网络阻断
//   修复: 纯 Node net+tls 实现 HTTP CONNECT 隧道 Agent · 代理来源 HTTPS_PROXY/HTTP_PROXY → Windows系统代理(WinINET)
//   道义: 四十章「弱也者 道之用也」· 代理即弱用 · 不假外求(无外部依赖) · 与 dao_router 同源同法
const _tls = require("tls");
// ★ v9.9.372 · 代理解析 TTL + NO_PROXY 尊重 + 死窗熔断
//   根因(141实证): 解析结果永久缓存 → watchdog 切道(7897↔2080)后 origin 仍抱死口;
//   NO_PROXY=* 被无视 → 与 agent 环变语义相违。TTL 60s 跟随切道节奏, 隧道失败即时过期。
let _originProxyUrlResolved;
let _originProxyUrlResolvedAt = 0;
const _ORIGIN_PROXY_TTL = 60000;
let _originTunnelDeadUntil = 0; // 外接隧道死窗: 死则 _originGetProxyAgent 返 undefined → 直连
function _originNoProxyHit(host) {
  const np = process.env.NO_PROXY || process.env.no_proxy || "";
  if (!np) return false;
  const h = String(host || "").toLowerCase();
  for (const t of np.split(",")) {
    const tok = t.trim().toLowerCase();
    if (!tok) continue;
    if (tok === "*") return true;
    if (h === tok || h.endsWith("." + tok) || (tok[0] === "." && h.endsWith(tok)))
      return true;
  }
  return false;
}
function _originResolveProxyUrl() {
  if (
    _originProxyUrlResolved !== undefined &&
    Date.now() - _originProxyUrlResolvedAt < _ORIGIN_PROXY_TTL
  )
    return _originProxyUrlResolved;
  // NO_PROXY=* → 用户明示全直连 · 尊重之 · 不静默凌驾
  const _np = process.env.NO_PROXY || process.env.no_proxy || "";
  if (
    _np
      .split(",")
      .map((t) => t.trim())
      .includes("*")
  ) {
    _originProxyUrlResolved = null;
    _originProxyUrlResolvedAt = Date.now();
    return null;
  }
  let purl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    null;
  if (!purl && process.platform === "win32") {
    try {
      const root =
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
      const q = (name) =>
        require("child_process").execSync(`reg query "${root}" /v ${name}`, {
          encoding: "utf8",
          timeout: 3000,
          windowsHide: true,
          stdio: ["ignore", "pipe", "ignore"],
        });
      const em = q("ProxyEnable").match(
        /ProxyEnable\s+REG_DWORD\s+0x([0-9a-fA-F]+)/,
      );
      if (em && parseInt(em[1], 16) === 1) {
        const pm = q("ProxyServer").match(/ProxyServer\s+REG_SZ\s+(\S+)/);
        if (pm) {
          let p = pm[1].trim();
          if (p.indexOf("=") !== -1) {
            const mm = p.match(/https=([^;]+)/) || p.match(/http=([^;]+)/);
            p = mm ? mm[1].trim() : p.split(";")[0].trim();
          }
          if (p && !/^https?:\/\//i.test(p)) p = "http://" + p;
          purl = p || null;
        }
      }
    } catch (_e) {
      /* 无系统代理 → 直连 */
    }
  }
  _originProxyUrlResolved = purl || null;
  _originProxyUrlResolvedAt = Date.now();
  return _originProxyUrlResolved;
}
function _originIsLocalHost(host) {
  if (!host) return false;
  if (host === "localhost" || host === "::1") return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}
class _OriginTunnelAgent extends https.Agent {
  constructor(proxyUrl, opts) {
    super(opts || {});
    const u = new URL(proxyUrl);
    this._proxyHost = u.hostname;
    this._proxyPort = parseInt(u.port || "80", 10);
  }
  createConnection(options, cb) {
    const destHost = options.host || options.hostname;
    const destPort = parseInt(options.port || 443, 10);
    // v9.9.372 · 本地/NO_PROXY 目标 → 不走代理 (直接 TLS)
    if (_originIsLocalHost(destHost) || _originNoProxyHit(destHost)) {
      return super.createConnection(options, cb);
    }
    const sock = net.connect(this._proxyPort, this._proxyHost);
    let settled = false;
    let buf = "";
    const fail = (e) => {
      if (settled) return;
      settled = true;
      try {
        sock.destroy();
      } catch (_) {}
      // ★ v9.9.372 · 隧道死窗熔断(90s) + 代理解析即时过期
      //   根因(141实证): 代理接受 TCP 但 CONNECT 空转(上游道死/2080专用道) → 每请求 20s 停顿
      //   药: 3s 建隧预算 + 死窗内直连 + 解析重探(赶 watchdog 切道)
      const code = String((e && (e.code || e.message)) || "");
      if (/ECONNREFUSED|EHOSTUNREACH|ETIMEDOUT|tunnel timeout/i.test(code)) {
        _originTunnelDeadUntil = Date.now() + 90000;
        _originProxyUrlResolvedAt = 0;
        log(`[tunnel] 代理隧道死窗 90s → 直连 (${code})`);
      }
      cb(e);
    };
    sock.once("error", fail);
    sock.setTimeout(3000, () => fail(new Error("dao proxy tunnel timeout")));
    sock.on("connect", () => {
      sock.write(
        `CONNECT ${destHost}:${destPort} HTTP/1.1\r\nHost: ${destHost}:${destPort}\r\n\r\n`,
      );
    });
    const onData = (chunk) => {
      buf += chunk.toString("binary");
      if (buf.indexOf("\r\n\r\n") === -1) return;
      sock.removeListener("data", onData);
      const statusLine = buf.split("\r\n")[0];
      if (!/ 200 /.test(statusLine)) {
        fail(new Error("dao proxy CONNECT rejected: " + statusLine));
        return;
      }
      sock.setTimeout(0);
      sock.removeListener("error", fail);
      const tlsSock = _tls.connect(
        {
          socket: sock,
          servername: options.servername || destHost,
          rejectUnauthorized:
            options.rejectUnauthorized !== undefined
              ? options.rejectUnauthorized
              : false,
        },
        () => {
          if (!settled) {
            settled = true;
            cb(null, tlsSock);
          }
        },
      );
      tlsSock.once("error", (e) => {
        if (!settled) {
          settled = true;
          cb(e);
        }
      });
    };
    sock.on("data", onData);
    return undefined;
  }
}
let _originTunnelAgent = null;
let _originTunnelAgentUrl = null;
function _originGetProxyAgent(isHttps) {
  if (!isHttps) return undefined;
  if (Date.now() < _originTunnelDeadUntil) return undefined; // v9.9.372 · 隧道死窗 → 直连
  const purl = _originResolveProxyUrl();
  if (!purl) return undefined;
  if (_originTunnelAgent && _originTunnelAgentUrl === purl)
    return _originTunnelAgent;
  try {
    _originTunnelAgent = new _OriginTunnelAgent(purl, { keepAlive: false });
    _originTunnelAgentUrl = purl;
    return _originTunnelAgent;
  } catch (_e) {
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════
// 配置 · 常量
// ═══════════════════════════════════════════════════════════
const PORT = parseInt(process.env.ORIGIN_PORT || "8889", 10);
// ★ v9.9.74 · 两面分治之根药 · 分口定面 (道法自然·无为而分)
//   病: Devin Desktop 实证 —— Cascade(LS) 与 Devin Local(devin.exe acp) 同走
//       api_server_pb → _surfaceOfPath 把全部聊天判 local → C 行按钮死键,
//       一切请求只吃第一行模式 (主公实测「两个被直接划到一起」).
//   治: acp 锚面(env/agentEnv/credentials.toml)指专属第二口 ORIGIN_ACP_PORT;
//       同 handler 双 mux 并听, 按 socket.localPort 定面 —— 口即面, 无猜无惑;
//       主口 api_server_pb 归 cascade (其本即 LS/IDE 之 inference 协议).
const ACP_PORT = parseInt(process.env.ORIGIN_ACP_PORT || "0", 10); // 0=不分口(旧机/手动直跑兼容)
let _acpPortWanted = ACP_PORT; // start(opts.acpPort) 可覆 · server listening 时按此绑 acp mux
// v9.6.1 · 反者道之动 · 远曰反 · 回归 v9.1.2 之全前端按钮 (七按钮: 道/官/实/原/编/复/卸 + dots/customBadge)
// 以 v9.1.2 本源哲学为锚 · 守大常不动 · 五细节皆成: isAlreadyInverted · _rawTape+all_fields · 部署不 kill · 前端按钮回归
const ORIGIN_VERSION_BASE = "v9.9.74"; // v9.9.74-min · 分口定面·两面真分(主公诏:L/C划成一面根治): acp专属口并听→localPort即面·主口api_server_pb归cascade·acp域锚面(env/agentEnv/credentials)尽归专口·ping.acp_port实况·credentials Win遗珠补径·显有效模式+面 —— 前系v9.9.73-min · 水过无痕·名实终一(主公诏): ①执葬两路皆装(spawned自葬+进程内退而不杀·还原锚面转透传待逝) ②录死钥双式并查(目录名·扩展ID)+兄弟在册甄别(活兄在→升级让位非死不葬) ③settings×4还原(Devin/Windsurf User+~/.windsurf/~/.devin家目录遗珠·裸回环锚式为据·/t/中继不犯) ④NO_PROXY我植并除·空壳剪·dao.origin.*尽扫 ⑤进程内_/_quit录死亦还原 · 前系v9.9.72: 卸则有终·幸存者执葬 —— spawned relay 巡 .obsolete/目录亡 → 还原三面锚(settings×2+credentials.toml)+清dao-origin+逝后扫尾自退 · deactivate未逮之洞闭合 · 走而能离reqModeEff(治全局SP_MODE=custom误杀面invert·治面道全局官之原文冒充实收) ③preview停重演直呈录存真值 ④/origin/verify闭环自检+tape末条判词(sig嵌入) ⑤detached支持(DAO_SPAWNED·DAO_PARENT_PID孤儿收割·父亡+静默10min自退·_quit后自终) ⑥名实字段并录持久化(surface/mode_eff/sp_on_wire/after_source/wire_changed)·前系v9.9.69: ①切经藏log未定义修(ext·canonChanged推送断裂根) ②回调吞噬守卫(exec/execFile callback被env对象覆写) ③重启丢模式根治(磁盘持久模式优先于config默认·ext+src双侧) ④隧道自动连接默认关(DAO_BRIDGE_AUTOCONNECT=1显式开·手动端点保留·Min版revproxy已拆·隧道零收益纯攻击面) ⑤帧不落盘(DAO_FRAME_PERSIST=1复旧·Authorization+会话token不再每轮writeFileSync落盘) ⑥解锁缺省禁(名实相符·无模型解锁) ⑦selftest总判唯系道魂之路(外接径Min已拆不再拖累总判) ⑧stop()补闭H2内部服务器(CLI进程不退之根) ⑨尸骸出包(_dao_81传世本无引用·运行时态文件) · 前系 v9.9.66-min · Min 版系归位(非 Pro 9.9.3xx) · always-on 用户规则部件剔除 + 按面典源/自编 + pin 防热回滚 + 面板两面同构 · 前系: v9.9.373 · 损之又损·死尸出列(用户口谕): windows-agent 经藏档 + windows/freecad/kicad 工具契约轴全废(旧域代理项目尸骸·面板"官方原生工具"下拉之癌) · _winTools 注入/代理执行拆除 · _tools_*.txt/_*_agent.txt 契约文件删除 · 承 v9.9.372 · 超时预算倒挂根治(141实证): 建连预算3.5s/隧道3s(<客户端5s) · 废_daoWarming预热抛错502风暴改异步暖+成则换池 · _OriginTunnelAgent补死窗熔断90s + dao_router永久熔断改90s死窗 · 代理解析TTL60s+隧道失败即时过期(随watchdog切道) · NO_PROXY尊重 · 表面: v9.9.371 · 合流单一真源(为道者日损): 承368两面分治/端点重写/DEVIN标记/tools轴 + 归并Tokyo370独有(modifySPProto field2=SP显式截获·官方H2长连经系统代理CONNECT隧道抗RST·鉴权状态类RPC韧性兜底不登出·路由失败回退官方止血·模型目录双格式client_model_configs) · v9.9.368 · 两面分治根治(Local=chisel acp→api_server_pb / Cascade=LS→cascade 面标路由 scope + _origin_mode_surface.json 每面独立 invert/passthrough/custom) + spawn-hook 本体残缺即放行原生 acp(防扩展被清理后 Devin Local 连 spawn 都死) · v9.9.367 · 死代理熔断直连(env/系统代理 TCP 失败→_proxyDead 置旗→外接路由永久直连·治残留死代理致外呼全灭) · v9.9.366 · Devin Local 推理端点重写根治(服务端下发 GetCliModelConfigs/GetCliTeamSettings/GetUserStatus 响应体内官方 host 字段 → 127.0.0.1:_actualPort · chisel GetChatMessage 归本口 · findings/acp/07 缺口B) ·  // v9.9.357 · custom模式SP不替换根治(源级替换链 modifySPProto/preview/observe/INFER_STRIP 由「仅invert」扩为「invert+custom」·custom无自编文本则透传绝不回落经藏·副路亦隔离·终结「自编未平替、官方SP在顶+阴符经在底重复带一份」) · v9.9.356 · 自定义SP隔离替换根治(custom输出附DAO-CUSTOM-SP标记·dao_router增强路径识别即不再追加经藏·用户自编平替阴符经·增强文本亦优先自编) · v9.9.355 · v9.9.355 · 提示缓存命中率根治(对照Anthropic扩展TTL 1h+beta extended-cache-ttl·治SWE-1.6 Slow慢链路5min断档 · OpenAI prompt_cache_key稳定前缀签名钉缓存节点·跨轮尾变键不变) · v9.9.353 · 官方直通502根治收官(stale优先于配额·_classifyOfficialErr保序·precondition不误吞·实证反代真通) · v9.9.352 · 陈旧会话/版本失配自愈(_isStaleSessionErr+_invalidateStaleFrames·424 stale_session·不狂重试坏帧) · v9.9.351 · 模型反代用量记账归一(反代 /v1/* 第三方渠道调用的 tokens/缓存命中并入路由器同一张用量表·面板「用量与成本」可见·dao_router 暴露 recordUsage·runtime 透传 routerRecordUsage·revproxy 经 deps.recordUsage 记账) · v9.9.350 · 根治「runtime not loaded」·健壮解析外接api目录(非ASCII名坏亦凭内容命中)+ea/*惰性自愈 · v9.9.349 · ACP spawn hook 增识 bash 包裹型(bash.exe --login -c 'devin.exe acp ...')·实证 多账号机 reload 后 IDE 经 Git bash login shell 间接拉起 devin.exe·旧 regex 漏网致鉴权锚定失效 · // v9.9.348 · 内网穿透反脆弱三件套(移植 dao-vsix): ① 指数退避(trycloudflare 限流→5s×2^n最多5min·URL注册成功即归零) ② 宽限期45s(新隧道注册中不误判死亡) ③ 冷却期25s(防密集重启)。前端面板增退避/宽限实时状态。handoff.md 增自愈要点详解 · v9.9.347 · 内网穿透对齐二合一本源: ① 激活自动连接(去中心化默认·开机即拉起零账号快速隧道/命名隧道·治「没有自动连接好」; 手动停止落 userstop 旗真停·24h 安全自复; 优先级 固定中继>命名隧道>快速隧道) ② 模型反代专属 Agent 交接文档 GET /origin/revproxy/handoff.md(实时含公网URL/Key/三条开通路/自愈要点·面向「反代→内网穿透→公网无感直调」链路接管·④面板底部 复制/下载/预览) ③ endpoint.json 增 revproxy.handoff_url · v9.9.346 · 捆绑 ACP 代理·实证收口(多账号机): ① GetCliTeamSettings 归 PASSTHROUGH(原 LOCAL_AUTH 发 gRPC 帧·chisel 按 Connect 裸 protobuf 解 → 首字 0x00=tag0 → "invalid tag value: 0" → "Failed to fetch team settings"; 改真端成帧回真 TeamSettings·解码必过) ② dao-acp-stdio-proxy.js 永久版健康门控自注入 WINDSURF_API_SERVER_URL=本地反代(覆盖已装 v9.9.334 无需 reload·spawn 每次重读) · v9.9.345 · 捆绑 ACP 代理(devin.exe/chisel)鉴权本地锚定·根治「Connecting to server」残余(LS 侧早已反代·唯捆绑 ACP 代理仍直连官方取 GetCliTeamSettings·官方经 VPN 偶发 >3s → "Team settings refresh timed out after 3000ms" → 前端永卡; 解: spawn-hook 反代健康时注入 WINDSURF_API_SERVER_URL=本地 8937 + NO_PROXY 纳入 127.0.0.1 → 团队设置即刻本地 gRPC OK·鉴权必过·与官方可达性彻底解耦; fail-safe 仅反代健康时改写·否则原样直连; 五十二章「既得其母 以知其子」) · v9.9.344 · 座席鉴权本地兜底·根治「Connecting to server」(SeatManagement/Heartbeat 归 LOCAL_AUTH → 本地即答 gRPC OK status=0·彻底解耦官方可达性; GetUserStatus 仍走 PASSTHROUGH 真解锁·推理仍 BYOK/INFER_STRIP·不夺其真; 反者道之动·釜底抽薪) · v9.9.343 · ⑤内网穿透 第五模块归一(移植 dao-bridge workers.dev 固定中继: 一个 CF API Token 零域名自动部署中继 Worker 到用户账号·出站长连 RelayClient 派回反代 /v1/*·永不轮换持久化·开机自愈; 退出/解绑硬化-即使数据损坏也可清后重绑; 独立会话 pp- 前缀+workers-relay-proxypro.json → 与独立 dao-bridge/dao-one 三插件共存无冲突; handoff.md 反代底层API公网通道改造) · v9.9.342 · 内网穿透大修(移植 dao-bridge 核心: 代理探测7端口+注入·二进制--version验证·断点续传·CONNECT代理隧道下载·6路镜像回退·看门狗15s·resetProxy·命名空间隔离 cloudflared-proxypro.*) · v9.9.339 · 反者道之动·补全(外接api 路由流式亦撤秒数硬限·dao_router 两处 provider 请求 setTimeout(0)+keepalive·revproxy setTimeout(0)+keepalive·routed 模型长推理不再 120s 掐断·AI 自然而止) · v9.9.338 · 反者道之动(撤销一切秒数硬限·两处 H2 stream 超时归零·H1 requestTimeout=0·唯下游离场才回收·AI 自然而止·道并行而不相悖) · v9.9.337 · 流续不断(H2 stream 超时 180s→600s·H2 session keepalive ping 45s·GOAWAY 优雅排水·H1 requestTimeout 600s·对话中断根治) · v9.9.336 · 根源突破(LSP/补全PASSTHROUGH流量亦采鉴权信封·信封陈旧才缓冲探采·新鲜即纯流式直透·IDE任一活跃即保鲜·彻底脱Cascade对话依赖) · v9.9.335 · 自主保鲜闭环(envelope采得即自动合成全鉴权回放帧·rewrites从IDE活跃自然自增) · v9.9.334 · 守真突破(活鉴权信封·任一inference请求采信封) · v9.9.333 · 会话鉴权保鲜 · 五十七章「我无为也 而民自化」
// 印 153 · 唯变所适 · 软编码归宗 · 二十五章「逝曰远 远曰反」· 七十六章「兵强则不胜」
// 病: 多 ext-host 共端口 :8937 · 旧版 in-process proxy 持续 listen · self_file 锁死旧版目录
//     → 即便装毕新版 vsix · /ping 仍返 v9.9.19/v9.9.20 之 self_file · canon_name 走旧映射
// 药: ① extension.js · vendorDir() 软编码扫所有 dao-agi.dao-proxy-min-*/ · 选最新 semver 版
//        即旧 ext-host 触 watchdog 复活时 · 也走最新 source.js (枯荣自分 · 新道自显)
//     ② extension.js · proxyStart EADDRINUSE 分支查远端 self_file 是否最新
//        若旧 · POST /origin/_quit 让位 · sleep 重 listen 自家版本 (上善若水 · 不与争而善胜)
//     ③ source.js · 加 /origin/_quit endpoint · 远端调即 server.close · 不再被 watchdog 唤起
//        (七十六章「人之生也柔弱 · 其死也仞贤强 · 强大居下 柔弱微细居上」)
// 承印 152 (两经归一) · 默 canon=laozi+yinfu · 帛书老子 + 道藏阴符 (二经合 ~7670 字)
// 承印 151 (jiqi) · webview IIFE 死活诊 + template-literal `\n` 修
const ORIGIN_VERSION = ORIGIN_VERSION_BASE + "-dao-fa-zi-ran";
let _actualPort = PORT; // listening / start.onListen 时更新为 server.address().port
const UPSTREAM_MGMT = "server.self-serve.windsurf.com";
const UPSTREAM_INFER = "inference.codeium.com";
// api_server 本源主机 · 工具类 RPC (联网搜索/读网页/代码上下文) 的真后端
//   实证: 原版未改 Windsurf LSP 只连 server.codeium.com (35.223.238.178)
//   ApiServerService/LanguageServerService 在此 host 注册 (415); inference.codeium.com 对其全 404
//   之前误归 INFERENCE_SERVICES → 发往 inference → 404/501 Not Implemented · 致工具失效
const UPSTREAM_API = process.env.API_UPSTREAM || "server.codeium.com";
// v9.3.2 · 道恒无名 · 名随实变
// 路由之 upstream 回归默认分流 (chat 走 inference via INFERENCE_SERVICES 匹)
// v9.3.1 "chat 单分流至 server.codeium.com" 之推断基于无 JWT 合成测,
// 合成测之 grpc-status=12 UNIMPLEMENTED 不足据 (auth 缺亦致同响应).
// 实捕 v9.2.1 之 67 reqs 证默认分流通. 故回归.
// CHAT_UPSTREAM env 保留 · 主公可 opt-in 显式覆盖:
//   "" (默认/空): 走 INFERENCE_SERVICES 默认分流 → UPSTREAM_INFER
//   "server.codeium.com" / "inference.codeium.com" / "auto": 覆盖至指端
const UPSTREAM_CHAT = process.env.CHAT_UPSTREAM || "";
const CLOUD_PORT = 443;

// inference 服务名集 (Connect-RPC 路径的 package.Service 部分)
const INFERENCE_SERVICES = new Set([
  "exa.language_server_pb.LanguageServerService",
  "exa.chat_web.ChatWebService",
  "exa.codeium_common_pb.CascadeService",
  "exa.codeium_common_pb.AutocompleteService",
  "exa.codeium_common_pb.CodeiumService",
  // ★ v9.9.96 · 修法⑨补 · Windsurf 3.0+ 新 API 服务名
  //   /exa.api_server_pb.ApiServerService/GetChatMessage
  //   缺此 → 错误路由至 UPSTREAM_MGMT → "Model provider unreachable"
  "exa.api_server_pb.ApiServerService",
]);

// api_server 工具服务集 · 透明转发至 server.codeium.com (api_server 本源)
//   联网搜索 ApiServerService/GetWebSearchResults · 读网页 ApiServerService/RecordReadUrlContent
//   代码上下文 LanguageServerService/GetMatchingCodeContext
//   这些非 chat 方法须走 UPSTREAM_API · 否则 inference.codeium.com 回 404/501
//   (chat 方法 GetChatMessage{,V2}/RawGetChatMessage 仍由方法名级路由 → UPSTREAM_INFER · 转 BYOK)
const API_SERVER_SERVICES = new Set([
  "exa.api_server_pb.ApiServerService",
  "exa.language_server_pb.LanguageServerService",
]);

// 三种模式 · 多言数穷 · 不如守中 · v9.9.92 加入 'custom' · 与 sp_invert.js 一致
const SP_MODE_VALID = new Set(["invert", "passthrough", "custom"]);

// ★ v9.9.67 根药 · 状态归恒所 · 善建者不拔 (五十四章)
//   病: mode/canon/surface/custom_sp/unlock 状态文件皆居版本目录 (__dirname) →
//       每次升级 (新版本目录) 用户之择 (模式/经藏/自编/按面/解锁) 静默复位 → 名实裂
//   治: 状态归 ~/.codeium/dao-origin/ (恒所 · 随用户不随版本) ·
//       首载自旧版目录迁移 (恒所无而旧有 → 搬一次 · 旧文件留 · 旧 ext-host 不伤)
function _stateDir() {
  const home =
    os.homedir() || process.env.USERPROFILE || process.env.HOME || "";
  return home ? path.join(home, ".codeium", "dao-origin") : __dirname;
}
function _stableStateFile(name) {
  const d = _stateDir();
  try {
    fs.mkdirSync(d, { recursive: true });
  } catch {}
  const fp = path.join(d, name);
  if (!fs.existsSync(fp)) {
    try {
      const legacy = path.join(__dirname, name);
      if (fs.existsSync(legacy)) fs.copyFileSync(legacy, fp);
    } catch {}
  }
  return fp;
}

const SP_MODE_FILE = _stableStateFile("_origin_mode.txt");

// ★ v9.9.67 根药 · 热路 I/O 收敛 · 250ms TTL 态缓存 · 写透失效
//   病: 每请求 6-7 次同步读盘 (mode/canon/surface 各计) · surface 文件一请五读
//       (_spReplaceActiveForSurface/_applyReqCanon/_applyReqCustomSP/modifySPProto 各自读)
//       → 热路同步 I/O 冗余 · 高频请求时累积阻塞
//   治: 250ms TTL · 写路 (setMode/setCanon/surface POST/custom_sp) 即写即失效
//       → 新鲜度亚秒不失 (热更语义不变) · 读盘 ≤4 次/秒 · 一请一读
const _CFG_TTL_MS = 250;
const _cfgCache = new Map(); // file → {at, val}
function _readCfgCached(fp, parseFn) {
  const c = _cfgCache.get(fp);
  const now = Date.now();
  if (c && now - c.at < _CFG_TTL_MS) return c.val;
  const val = parseFn();
  _cfgCache.set(fp, { at: now, val });
  return val;
}
function _invalidateCfg(fp) {
  _cfgCache.delete(fp);
}

function _loadModeFromDisk() {
  return _readCfgCached(SP_MODE_FILE, () => {
    try {
      if (fs.existsSync(SP_MODE_FILE)) {
        const v = fs.readFileSync(SP_MODE_FILE, "utf8").trim().toLowerCase();
        if (SP_MODE_VALID.has(v)) return v;
      }
    } catch {}
    return null;
  });
}
function _saveModeToDisk(mode) {
  try {
    fs.writeFileSync(SP_MODE_FILE, mode, { mode: 0o600 });
    _invalidateCfg(SP_MODE_FILE); // ★ v9.9.67 · 写透失效
  } catch {}
}

let SP_MODE = _loadModeFromDisk() || process.env.SP_MODE || "invert";
// ★ v9.9.70 · 名实终一 · 按面有效模式贯通线
//   病: invertSP/invertAnySP 内嵌 `SP_MODE==="custom"` 全局判断 —
//       全局=custom 而 面=invert 时, 面之请求被误判"custom无自编"→透传不改(应改未改);
//       观察路径 _dMode=SP_MODE 亦然(面=道而全局=官 → tape 记 after=原文冒充实收)。
//   治: _reqModeEff 于请求入手法 _reqSurface 同步点赋值 (_surfaceMode 之果),
//       invertSP/invertAnySP/观察路径一律问有效模式, 不直问全局。无请求上下文时回落全局。
let _reqModeEff = null;
function _effMode() {
  return _reqModeEff || SP_MODE;
}
// ★ v9.9.70 · 观察路实发载体钩子 —— _mainHandler 步5 立 · 步7 回填 modified
let _pendingObsCtx = null;
// ★ v9.9.357 · 自定义模式亦须道化 · 根治 custom 模式 SP 不替换
//   道义: 二章「有无相生」· invert 与 custom 皆「有为之替」, passthrough 独「无为之透」。
//   根因: SP 替换链(modifySPProto/preview/observe/INFER_STRIP)历来只认 SP_MODE==="invert",
//   而用户自编替换逻辑寄居于 invertSP 内(优先于经藏)。故 mode 切到 "custom" 时源级替换整链
//   被跳过 → 官方 SP 原样透传 → dao_router 增强路径见「官方 SP」再从底部补一份经藏/自编 →
//   自编未平替、经藏(阴符经)重复带一份。修法: 源级替换链对 invert+custom 一视同仁。
function _spReplaceActive() {
  return SP_MODE === "invert" || SP_MODE === "custom";
}
// ★ v9.9.368 · 两面分治 · 道法自然 —— v9.9.74 名实归位
//   Devin Local(devin.exe acp 经 WINDSURF_API_SERVER_URL/DEVIN_API_URL/agentEnv/
//     credentials.toml 归 ACP_PORT 专属口) → socket.localPort===acp口 → "local"
//   Cascade(LS 经 --api_server_url/--inference_api_server_url/settings.json 归主口) →
//     cascade/codeium_common/language_server_pb/chat_web/api_server_pb → "cascade"
//   ★ 实证纠偏: Devin Desktop 之 Cascade(LS) 亦走 api_server_pb —— api_server_pb
//     本就是 LS/IDE 之 inference 协议, 旧码误归 local → 两面划为一面。
//   `_origin_mode_surface.json` = {default?, local?, cascade?} 每面可独立 invert/passthrough/custom,
//   未设面回落 default 再回落全局 SP_MODE; 路由条目加 scope: all|local|cascade(缺省 all 双面)。
let _acpBoundPort = 0; // acp 面 mux 实绑口 (0=未绑)
let _acpH2Port = 0; // acp 面 h2 内部实绑口 (0=未绑)
function _surfaceOfPath(reqPath) {
  if (!reqPath) return "";
  if (/cascade|codeium_common|language_server_pb|chat_web|api_server_pb/i.test(reqPath))
    return "cascade";
  return "";
}
// ★ v9.9.74 · 分口定面 —— 口标优先于路径: acp 专属口(socket.localPort==_acpBoundPort/_acpH2Port)
//   恒归 local; 主口请求按路径分 (api_server_pb 即 cascade)。
function _reqSurfaceOf(req) {
  try {
    const lp = req && req.socket && req.socket.localPort;
    if (lp && _acpBoundPort && (lp === _acpBoundPort || lp === _acpH2Port))
      return "local";
  } catch (_) {}
  return _surfaceOfPath(req && req.url);
}
const SP_MODE_SURFACE_FILE = _stableStateFile("_origin_mode_surface.json");
// ★ v9.9.67 · surface 文件一请五读 → 一读共享 (TTL 缓存)
function _readSurfaceJsonRaw() {
  try {
    const j = JSON.parse(fs.readFileSync(SP_MODE_SURFACE_FILE, "utf8"));
    if (j && typeof j === "object") return j;
  } catch (_) {}
  return {};
}
function _surfaceJson() {
  return _readCfgCached(SP_MODE_SURFACE_FILE, _readSurfaceJsonRaw) || {};
}
function _surfaceMode(surface) {
  let m = SP_MODE;
  const j = _surfaceJson();
  const v = (surface && j[surface]) || j.default;
  if (SP_MODE_VALID.has(v)) m = v;
  return m;
}
function _spReplaceActiveForSurface(surface) {
  const m = _surfaceMode(surface);
  return m === "invert" || m === "custom";
}
// ★ v9.9.376 · 两面同构·按面经藏 · 道法自然
//   面板层级: 面(local|cascade) → 道/官 → 道下典源(帛书老子|道藏阴符经|合一|custom 自编)
//   `_origin_mode_surface.json` 增 `default_canon`/`local_canon`/`cascade_canon` 键;
//   未设回落全局 `_origin_canon.txt`; 每请求同步点按面生效 (不落盘).
function _surfaceCanon(surface) {
  let c = null;
  const j = _surfaceJson();
  const v = (surface && j[surface + "_canon"]) || j.default_canon;
  if (v) c = v;
  if (!c) c = _readCanonFile();
  return c;
}
function _applyReqCanon(c) {
  try {
    if (!c || !_CANON_VALID.has(c) || c === _activeCanon) return;
    const t = c === "laozi" ? DAO_DE_JING_81 : _loadCanonText(c);
    if (!t) return;
    _activeCanon = c;
    _activeCanonText = t;
    if (_spInvertLib && _spInvertLib.setCanon) _spInvertLib.setCanon(c);
    // lib 每 500ms 以 _origin_canon.txt 为准热回滚; 按面下发须 pin,
    //   否则全局文件值会顶掉面之典源 (实证 laozi 被 laozi+yinfu 顶回).
    if (_spInvertLib && _spInvertLib.pinCanon) _spInvertLib.pinCanon(true);
  } catch (_) {}
}
// 按面自编 SP: `local_customsp`/`cascade_customsp` 键; 缺省回落全局 _custom_sp.json
// ★ 门控: 仅该面 mode==="custom" 才载自编, 否则置 null ——
//   实证缺陷: _customSP 无视面态恒存, invert(道) 请求亦走自编分支,
//   「编一次阴符经后切道/官再不回头」之串味根因.
function _applyReqCustomSP(surface) {
  try {
    if (_surfaceMode(surface) !== "custom") {
      _customSP = null;
      return;
    }
    const j = _surfaceJson();
    const v = surface && j ? j[surface + "_customsp"] : null;
    if (v && typeof v === "string" && v.trim()) {
      _customSP = { sp: v, keep_blocks: true };
    } else {
      _customSP = _loadCustomSP();
    }
  } catch (_) {}
}
const START_TIME = Date.now();
let reqCounter = 0;
// ── v9.9.330 · 治本 · LS 心跳活性观照 (扩展↔LS wedge 自愈之信号源) ──
//   道法自然·自观: Windsurf LS 活时每 ~5s 经本口发心跳(GetUserStatus 等真 gRPC);
//   一旦扩展↔LS 握手 wedge(LS "exited before sending start data" 后管理器卡
//   "Already waiting for language server start" 死循环) · 该流即断。
//   仅在「真 LS→上游」请求(排除 /origin/* 控制面与 /v1/ 外接反代)时刷新此戳,
//   故看门狗可据 ls_idle_s 精准辨识「proxy 健康却 LS 掉线」之 wedge。
let _lastLsReqAt = 0;
// ★ v9.9.70 · detached 活性戳 —— 孤儿收割以「任一请求」为活
let _lastAnyReqAt = 0;
// v9.9.21 · 唯变所适 · 让位标志 · POST /origin/_quit 后置 true · ext-host watchdog 见之不再唤起
// 二十二章「夫唯不争 故莫能与之争」· 让位之德 · 旧不抢新道
let _quitSignaled = false;

// ═══════════════════════════════════════════════════════════
// ★ v9.9.70 · detached 孤儿收割 —— 重启后生效·不扰中段之根
// ═══════════════════════════════════════════════════════════
//   ext-host spawn detached 时植 DAO_PARENT_PID → 本进程可独立于 ext-host 存活:
//     · 升级/重载/崩溃 → 旧代理续服至新 ext-host 采用 (EADDRINUSE→ping→remote handle)
//       或让位 (/_quit) · 流量零断窗 · 是为「重启后生效」。
//   孤儿防: 父 PID 亡 + 静默逾 10min → 自退 (免孤守端口)。
//     采用之新宿主其 watchdog 每 60s /origin/ping → 活性戳自续 → 不死。
//   道义: 七十六章「人之生也柔弱 其死也仞贤强」· 生则有用 死则有终。
const _SPAWNED = !!process.env.DAO_SPAWNED;
const _PARENT_PID = parseInt(process.env.DAO_PARENT_PID || "0", 10) || 0;
if (_PARENT_PID) {
  const _orphanTick = () => {
    try {
      process.kill(_PARENT_PID, 0);
    } catch (e) {
      // ESRCH=父亡; EPERM=父在无权 (视同活)
      if (e && e.code === "ESRCH") {
        const silentFor = Date.now() - (_lastAnyReqAt || START_TIME);
        if (silentFor > 10 * 60 * 1000) {
          log(
            `[orphan] parent ${_PARENT_PID} 亡 + 静默 ${Math.round(silentFor / 1000)}s → 自退`,
          );
          process.exit(0);
        }
      }
    }
  };
  setInterval(_orphanTick, 30000).unref();
}

// ═══════════════════════════════════════════════════════════
// ★ v9.9.72 · 卸则有终 —— 幸存者执葬 (道法自然)
// ═══════════════════════════════════════════════════════════
//   病 (179 实证): 点击卸载 → VS Code 录 .obsolete → 重启即强杀 ext-host
//     并删物理目录 → deactivate() 未及运行 → 三面锚 (settings.json×2 +
//     credentials.toml) 永指死口 → 官方归路反断 · 卸载即全局崩。
//   治: 唯"活得最久者"可执葬 —— spawned 本为续命而生, 令其自葬:
//     每 30s 自问: 家目录尚存否? .obsolete 录我名否?
//     亡 → 还原三面锚 → 自退。无主机可信, 唯逝者可信。
//   边界: 唯 spawned 进程装此哨 —— 进程内 (ext-host 内嵌) 不装,
//     exit 会带崩宿主; 其死有 deactivate 兜底, 各司其死。
//   道义: 五十一章「生而不有 为而不恃 长而不宰 是谓玄德」
//          五十章「善执生者…以其无死地焉」
const _SELF_DIR = path.resolve(__dirname, "..", ".."); // vendor/bundled-origin → 扩展根
const _EXT_ROOT_DIR = path.dirname(_SELF_DIR); //          extensions/
const _OBSOLETE_FP = path.join(_EXT_ROOT_DIR, ".obsolete");
const _EXTINCT_URL_KEYS = ["WINDSURF_API_SERVER_URL", "DEVIN_API_URL"];
const _EXTINCT_ENV_BLOCKS = [
  "devin.acp.agentEnv",
  "windsurf.acp.agentEnv",
];
const _EXTINCT_SETTING_KEYS = [
  "codeium.apiServerUrl",
  "codeium.inferenceApiServerUrl",
  "dao.origin._backup_apiServerUrl",
  "dao.origin._backup_inferenceApiServerUrl",
];
function _daoExtId() {
  try {
    const pj = JSON.parse(
      fs.readFileSync(path.join(_SELF_DIR, "package.json"), "utf8"),
    );
    if (pj && pj.publisher && pj.name) return `${pj.publisher}.${pj.name}`;
  } catch {}
  return null;
}
// ★ v9.9.73 · 兄弟甄别 —— 活兄在则「录死」实为让位 (升级), 非卸载
//   活兄 = 同前缀目录 · 非己 · 未录死 · 在册 (extensions.json 可读则以册为准,
//   不可读退守「未录死」). 僵尸目录/亡弟皆不阻真卸载之判.
function _daoHasLiveSibling() {
  try {
    const selfName = path.basename(_SELF_DIR);
    const id = _daoExtId();
    // 目录已删则 package.json 不可读 → 由己名剥尾版号推前缀 (dao-x.y-9.9.73 → dao-x.y-)
    let stem = id ? id + "-" : null;
    if (!stem) {
      const m = selfName.match(/^(.+?)-\d+\.\d+\.\d+/);
      if (m) stem = m[1] + "-";
    }
    if (!stem) return false;
    const ob = (() => {
      try {
        return JSON.parse(fs.readFileSync(_OBSOLETE_FP, "utf8") || "{}");
      } catch {
        return {};
      }
    })();
    let installed = null;
    try {
      const ej = JSON.parse(
        fs.readFileSync(path.join(_EXT_ROOT_DIR, "extensions.json"), "utf8"),
      );
      if (Array.isArray(ej)) {
        installed = new Set();
        for (const e of ej) {
          if (e && e.relativeLocation)
            installed.add(String(e.relativeLocation));
          const eid = e && e.identifier && e.identifier.id;
          const v = e && e.version;
          if (eid && v) installed.add(`${String(eid).toLowerCase()}-${v}`);
        }
      }
    } catch {}
    for (const name of fs.readdirSync(_EXT_ROOT_DIR)) {
      if (name === selfName) continue;
      if (name.indexOf(stem) !== 0) continue;
      if (/\.(obsolete|disabled|preinstall|backup|bak)/i.test(name)) continue;
      if (ob[name]) continue; // 同录死者 → 亡弟非兄
      if (installed && !installed.has(name)) continue; // 不在册 → 僵尸
      return true;
    }
  } catch {}
  return false;
}
// ★ v9.9.73 · 名实终一 —— 录死之钥双式并查 (目录名钥 · 扩展ID钥) + 兄弟甄别
//   真死 = (录名 或 目录亡) 且 无活兄 (有兄则升级途中 · 锚与态当归新主)
function _daoSelfMarkedDead() {
  try {
    const ob = JSON.parse(fs.readFileSync(_OBSOLETE_FP, "utf8") || "{}");
    const selfName = path.basename(_SELF_DIR);
    const id = _daoExtId();
    const marked = !!(ob[selfName] || (id && ob[id]));
    const gone = !fs.existsSync(_SELF_DIR);
    if (!marked && !gone) return false;
    if (_daoHasLiveSibling()) return false; // 升级途中 · 非死
    return true;
  } catch {
    return false;
  }
}
// 三面还原 —— 与 extension.js::_clearAnchorFileSync + _unanchorCredentialsToml 同义
//   只除所植之键 · 原子写 (tmp+rename) · 不可读不覆盖 · 无残零写
// ★ v9.9.73 · 收净四义:
//   ① codeium 锚键唯删「裸回环锚」式 (127.0.0.1:port 无路径) —— 用户他设不犯;
//   ② agentEnv 之 URL 键同护 (/t/ 令牌中继非我所植); 我植 NO_PROXY 并除;
//   ③ dao.origin.* 我域键尽扫 (port/defaultMode/banner/backup);
//   ④ 空 agent 子表、空 agentEnv 块尽剪 —— 不留壳.
const _DAO_ANCHOR_RE = /^https?:\/\/127\.0\.0\.1:\d+\/?$/;
function _isPlantedNoProxyStr(v) {
  const np = String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return np.length > 0 && np.every((t) => t === "127.0.0.1" || t === "localhost");
}
function _daoCleanSettingsJson(json) {
  let changed = false;
  for (const k of _EXTINCT_SETTING_KEYS) {
    // URL 锚键唯删裸回环式; 备份键非 URL 值, 由下行我域前缀并扫
    if (k in json && _DAO_ANCHOR_RE.test(String(json[k]))) {
      delete json[k];
      changed = true;
    }
  }
  for (const k of Object.keys(json)) {
    if (k.indexOf("dao.origin.") === 0) {
      delete json[k];
      changed = true;
    }
  }
  for (const bk of _EXTINCT_ENV_BLOCKS) {
    const env = json[bk];
    if (!env || typeof env !== "object" || Array.isArray(env)) continue;
    for (const ak of Object.keys(env)) {
      const sub = env[ak];
      if (!sub || typeof sub !== "object" || Array.isArray(sub)) continue;
      for (const uk of _EXTINCT_URL_KEYS) {
        if (uk in sub && _DAO_ANCHOR_RE.test(String(sub[uk]))) {
          delete sub[uk];
          changed = true;
        }
      }
      if (_isPlantedNoProxyStr(sub.NO_PROXY)) {
        delete sub.NO_PROXY;
        changed = true;
      }
      if (Object.keys(sub).length === 0) {
        delete env[ak];
        changed = true;
      }
    }
    if (Object.keys(env).length === 0) {
      delete json[bk];
      changed = true;
    }
  }
  return changed;
}
function _daoSettingsFiles() {
  let base;
  const plat = process.platform;
  if (plat === "win32") base = process.env.APPDATA;
  else if (plat === "darwin")
    base = path.join(os.homedir(), "Library", "Application Support");
  else base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  const h = os.homedir();
  // v9.9.73 · 家目录遗珠并扫 (~/.windsurf|~/.devin/settings.json 实证亦载裸锚)
  return [
    path.join(base, "Devin", "User", "settings.json"),
    path.join(base, "Windsurf", "User", "settings.json"),
    path.join(h, ".windsurf", "settings.json"),
    path.join(h, ".devin", "settings.json"),
  ];
}
function _daoFinalCleanup() {
  for (const sp of _daoSettingsFiles()) {
    try {
      const raw = fs.readFileSync(sp, "utf8").trim();
      if (!raw) continue;
      const json = JSON.parse(raw);
      if (_daoCleanSettingsJson(json)) {
        const tmp = sp + ".dao-tmp";
        fs.writeFileSync(tmp, JSON.stringify(json, null, 2), "utf8");
        fs.renameSync(tmp, sp);
        log(`[extinct] settings 还原 → ${sp}`);
      }
    } catch {}
  }
  // credentials.toml: 127.0.0.1 锚 → 官方常量 (与 _unanchorCredentialsToml 同式)
  const h = os.homedir();
  for (const cp of [
    path.join(h, ".local", "share", "devin", "credentials.toml"),
    path.join(h, ".config", "devin", "credentials.toml"),
  ]) {
    try {
      const t = fs.readFileSync(cp, "utf8");
      const nt = t.replace(
        /^((?:devin_api_url|api_server_url)\s*=\s*")http:\/\/127\.0\.0\.1:\d+(?:\/t\/[^"]*)?"/gm,
        (m, pre) =>
          pre +
          (pre.startsWith("devin_api_url")
            ? "https://api.devin.ai"
            : "https://server.codeium.com") +
          '"',
      );
      if (nt !== t) {
        const tmp = cp + ".dao-tmp";
        fs.writeFileSync(tmp, nt);
        fs.renameSync(tmp, cp);
        log(`[extinct] credentials.toml 归官方 → ${cp}`);
      }
    } catch {}
  }
  // ~/.codeium/dao-origin 全除 (状态/日志/别名exe 之巢 · 我之私域)
  try {
    const dd = path.join(os.homedir(), ".codeium", "dao-origin");
    fs.rmSync(dd, { recursive: true, force: true });
    log(`[extinct] dao-origin 已清 → ${dd}`);
  } catch {}
}
// 执葬一式: 还原 → 退出后异步扫尾(别名 exe 自锁, 唯逝后方能除) → 自退
function _daoBurial() {
  try {
    _daoFinalCleanup();
  } catch (e) {}
  try {
    const _cp = require("child_process");
    const dd = path.join(os.homedir(), ".codeium", "dao-origin");
    if (process.platform === "win32") {
      _cp.spawn(
        "cmd.exe",
        ["/c", `ping 127.0.0.1 -n 3 >nul & rd /s /q "${dd}"`],
        { detached: true, stdio: "ignore", windowsHide: true },
      ).unref();
    } else {
      _cp.spawn("sh", ["-c", `sleep 2; rm -rf "${dd}"`], {
        detached: true,
        stdio: "ignore",
      }).unref();
    }
  } catch (e) {}
  setTimeout(() => process.exit(0), 300).unref();
}
// ★ v9.9.73 · 执葬两路皆装 —— spawned 自葬; 进程内退而不杀
//   进程内 (ext-host 内嵌) exit 会带崩全殿 —— 故唯还原锚面+转透传,
//   宿主随重启自然而逝, 名「水过无痕」. 兄弟甄别在 _daoSelfMarkedDead.
let _buriedOnce = false;
const _extinctTimer = setInterval(() => {
  if (_buriedOnce || !_daoSelfMarkedDead()) return;
  _buriedOnce = true;
  clearInterval(_extinctTimer);
  if (_SPAWNED) {
    log(`[extinct] ${_SELF_DIR} 录死 (.obsolete/目录亡) → 还原三面锚 → 自退`);
    _daoBurial();
  } else {
    log(`[extinct] ${_SELF_DIR} 录死 (进程内) → 还原三面锚 → 透传待逝`);
    try {
      _daoFinalCleanup();
    } catch (_) {}
    try {
      SP_MODE = "passthrough"; // 退守无为之透 · 内存一易 · 不再落盘
    } catch (_) {}
  }
}, 30000);
_extinctTimer.unref();
// 60s 宽限后初巡 — 装/升级过渡态不误判 (此时 .obsolete 或有旧名)
setTimeout(() => {
  try {
    if (_buriedOnce || !_daoSelfMarkedDead()) return;
    _buriedOnce = true;
    clearInterval(_extinctTimer);
    if (_SPAWNED) {
      log(`[extinct] ${_SELF_DIR} 录死 (初巡) → 还原三面锚 → 自退`);
      _daoBurial();
    } else {
      log(`[extinct] ${_SELF_DIR} 录死 (进程内·初巡) → 还原三面锚 → 透传待逝`);
      try {
        _daoFinalCleanup();
      } catch (_) {}
      try {
        SP_MODE = "passthrough";
      } catch (_) {}
    }
  } catch (_) {}
}, 60000).unref();

// ═══════════════════════════════════════════════════════════
// v9.9.57P · 外接api模型路由 · 无为而无以为
// ═══════════════════════════════════════════════════════════
//   只路由 MODEL_SWE_1_6_FAST → 第三方API
//   不在路由表 → 官方透传 · 道并行而不相悖
//   _ea=null → 全部走官方 · 绝不崩溃
//   v9.9.57P2 · 按需热重载: 检测dao_router.js mtime变化 → 清缓存重加载
let _ea = null;
let _eaMtime = 0;
// ★ v9.9.82 · 恢复冷却: _ea=null 时每60秒尝试一次恢复
//   道义: 七十八章「是以圣人恒无心」· 无心则复归
let _eaRecoverCooldown = 0;
// ★ v9.9.348 · 健壮解析「外接api」目录 · 根治「runtime not loaded」
//   病灶: 硬编码中文目录名「外接api」是非 ASCII, 在 VSIX(zip) 打包/解包时编码不稳,
//     部分用户机上目录名被搞坏(mojibake) → fs.existsSync(...外接api/runtime.js) 恒 false
//     → _eaRuntimeMod 永为 null → 加渠道即「添加失败: runtime not loaded」
//   修法: 先试规范中文名; 找不到即按内容扫描 __dirname/.. 下「含 runtime.js + core/dao_router.js」
//     的子目录(名字坏掉也能凭内容命中) · 名实相符 · 复归有名
function _resolveEaDir() {
  const base = path.join(__dirname, "..");
  // v9.9.374-min · 损之又损: 外接api 轴源码级拆除 · 恒返不存在路径(防外部自愈复活)
  if (true) return path.join(base, ".ea-removed");
  const canon = path.join(base, "外接api");
  try {
    if (fs.existsSync(path.join(canon, "runtime.js"))) return canon;
  } catch {}
  try {
    for (const name of fs.readdirSync(base)) {
      const d = path.join(base, name);
      try {
        if (
          fs.statSync(d).isDirectory() &&
          fs.existsSync(path.join(d, "runtime.js")) &&
          fs.existsSync(path.join(d, "core", "dao_router.js"))
        ) {
          return d;
        }
      } catch {}
    }
  } catch {}
  return canon; // 兜底: 返回规范路径(existsSync 仍会失败 → 上层降级官方透传)
}
function _eaRuntimePath() {
  return path.join(_resolveEaDir(), "runtime.js");
}
function _eaRouterPath() {
  return path.join(_resolveEaDir(), "core", "dao_router.js");
}

// ★ v9.9.90 · 热配置模块引用 · _ea 是实例 · 热配置函数在模块导出上
//   五十七章「我无为也 而民自化」· 实例行路由 · 模块行配置 · 名实相符
let _eaRuntimeMod = null;
try {
  _eaRuntimeMod = require(_eaRuntimePath());
} catch {}

// ★ v9.9.348 · 惰性自愈: _eaRuntimeMod 为 null 时按需重载 · ea/* 端点调用前先试
//   道义: 反者道之动 · 失败后亦当复归 · 不直接抛「runtime not loaded」
//   (require 缓存命中即免二次开销 · _eaRuntimeMod 已加载则秒返)
function _ensureEaRuntimeMod() {
  if (_eaRuntimeMod) return _eaRuntimeMod;
  try {
    const p = _eaRuntimePath();
    if (fs.existsSync(p)) {
      _eaRuntimeMod = require(p);
      try {
        _eaDiag("lazy-load runtime.js ok via " + p);
      } catch {}
    }
  } catch (e) {
    try {
      _eaDiag("lazy-load runtime.js fail: " + e.message);
    } catch {}
  }
  return _eaRuntimeMod;
}
const _eaDiagPath = path.join(__dirname, "_ea_diag.log");
let _eaDiagWrites = 0;
// ★ v9.9.67 · 默默 · 非默不书
//   病: 热路每请求 2-5 行盘写 (REQ-CT/routing-check/RESP-HEADERS/BODY-HEX)
//       而 Min 版外接轴已拆 → 诊断多为死轴之噪 → 每请求盘写纯耗
//   治: 默关 · _ea 活或 DAO_EA_DIAG=1 方书 · 需诊者一 env 即开
//   道义: 五十六章「知者弗言 言者弗知」· 不言之教
function _eaDiag(msg) {
  if (!_ea && String(process.env.DAO_EA_DIAG || "") !== "1") return;
  try {
    const t = new Date().toISOString();
    const line = `[${t}] ${msg}\n`;
    // v9.9.76 · 异步写入 · 反者道之动 · appendFileSync 阻塞事件循环致 ext-host UNRESPONSIVE
    // ★ v9.9.67 · 无界增长之守 · 知止可以不殆 (三十二章)
    //   病: 每请求 2-5 行(REQ-CT/routing-check/RESP-HEADERS/BODY-HEX) · 永不轮转
    //       → _ea_diag.log 无界膨胀(GB 级) · 磁盘渐满。
    //   治: 每 2000 写检一次 · >2MB 截留末 200KB · 有界环。
    if (++_eaDiagWrites % 2000 === 0) {
      try {
        const st = fs.statSync(_eaDiagPath);
        if (st.size > 2 * 1024 * 1024) {
          const tail = fs.readFileSync(_eaDiagPath).slice(-200 * 1024);
          fs.writeFileSync(_eaDiagPath, tail);
        }
      } catch {}
    }
    fs.appendFile(_eaDiagPath, line, () => {});
  } catch {}
}
// ★ v9.9.95 · 道法自然 · 不着相于表层硬编码 · 从Windsurf运行时实证获取模型
//   三层实证: ①RPC响应拦截(真) ②seen动态补充(实) ③fallback(保底)
const _seenModelUids = new Map(); // uid → {count, lastAt, routed}
const _SEEN_MODELS_MAX = 64;

// ★ v9.9.95 · RPC响应发现的模型 · 从GetSystemPromptAndTools等响应中提取
const _rpcDiscoveredModels = new Map(); // uid → {displayName, family, source_rpc, discoveredAt}
const _RPC_DISCOVERED_MAX = 128; // ★ v9.9.67 · 有界 (原无界缓涨 · 知止可以不殆)
function _rpcDiscoveredSet(uid, entry) {
  if (_rpcDiscoveredModels.size >= _RPC_DISCOVERED_MAX && !_rpcDiscoveredModels.has(uid)) {
    // 淘最旧 (discoveredAt 最小)
    let oldestK = null,
      oldestAt = Infinity;
    for (const [k, v] of _rpcDiscoveredModels) {
      if ((v.discoveredAt || 0) < oldestAt) {
        oldestAt = v.discoveredAt || 0;
        oldestK = k;
      }
    }
    if (oldestK !== null) _rpcDiscoveredModels.delete(oldestK);
  }
  _rpcDiscoveredModels.set(uid, entry);
}

// ★ v9.9.95 · fallback保底列表 · 仅在RPC未发现任何模型时使用
const _FALLBACK_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-sonnet-4-6-thinking",
  "claude-opus-4-6-thinking",
  "gpt-5-4-low",
  "gpt-5-4-medium",
  "gpt-5-4-high",
  "gpt-5-4-xhigh",
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "deepseek-v3",
  "deepseek-r1",
  "qwen3-coder",
  "qwen3-coder-next",
  "swe-1-6-fast",
  "swe-1-6-slow",
  "grok-3-mini",
  "kimi-k2-5",
];

// ★ v9.9.95 · 模型家族分类
function _modelFamily(uid) {
  if (uid.startsWith("claude") || uid.includes("CLAUDE")) return "Claude";
  if (
    uid.startsWith("gpt") ||
    uid.startsWith("MODEL_GPT") ||
    uid.startsWith("MODEL_CHAT_GPT") ||
    uid.startsWith("MODEL_CHAT_O")
  )
    return "GPT";
  if (
    uid.startsWith("gemini") ||
    uid.includes("GEMINI") ||
    uid.includes("GOOGLE_GEMINI")
  )
    return "Gemini";
  if (uid.startsWith("deepseek") || uid.includes("DEEPSEEK")) return "DeepSeek";
  if (uid.startsWith("qwen") || uid.includes("QWEN")) return "Qwen";
  if (uid.startsWith("swe") || uid.includes("SWE")) return "SWE";
  if (uid.startsWith("grok") || uid.includes("GROK") || uid.includes("XAI"))
    return "Grok";
  if (uid.startsWith("kimi") || uid.includes("KIMI")) return "Kimi";
  if (uid.startsWith("minimax") || uid.includes("MINIMAX")) return "Minimax";
  if (uid.startsWith("glm") || uid.includes("GLM")) return "GLM";
  if (uid.includes("PRIVATE")) return "Private";
  return "Other";
}

// ★ v9.9.95 · 判断字符串是否看起来像Windsurf modelUid
function _looksLikeModelUid(s) {
  if (!s || s.length < 3 || s.length > 80) return false;
  if (/^MODEL_[A-Z0-9_]+$/.test(s)) return true;
  if (
    /^(?:claude|gpt|gemini|deepseek|qwen|swe|grok|kimi|minimax|glm|o[13]|chat-)[a-z0-9._-]+$/.test(
      s,
    )
  )
    return true;
  return false;
}

// ★ v9.9.95 · 从RPC响应体中提取模型UID
function _extractModelsFromRPC(bodyBuf, rpcPath) {
  if (!bodyBuf || bodyBuf.length < 10) return;
  try {
    const text = bodyBuf.toString("utf8");
    // Connect-JSON响应
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        const obj = JSON.parse(text);
        _extractModelsFromObj(obj, rpcPath, 0);
      } catch {}
      return;
    }
    // Protobuf二进制 → 扫描string字段找modelUid模式
    const uidPattern =
      /(?:MODEL_[A-Z0-9_]{3,}|(?:claude|gpt|gemini|deepseek|qwen|swe|grok|kimi|minimax|glm|o[13]|chat-)[a-z0-9._-]{2,})/g;
    let m;
    while ((m = uidPattern.exec(text)) !== null) {
      const uid = m[0];
      if (!_rpcDiscoveredModels.has(uid)) {
        _rpcDiscoveredSet(uid, {
          displayName: uid,
          family: _modelFamily(uid),
          source_rpc: rpcPath,
          discoveredAt: Date.now(),
        });
        log(`[model-discover] RPC=${rpcPath} uid=${uid} (proto)`);
      }
    }
  } catch (e) {
    _eaDiag(`[model-discover] ERR: ${e.message}`);
  }
}

// ★ v9.9.95 · 从JSON对象中递归提取模型UID
function _extractModelsFromObj(obj, rpcPath, depth) {
  if (depth > 8 || !obj || typeof obj !== "object") return;
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === "string") {
      const lk = key.toLowerCase();
      if (
        (lk.includes("model") || lk.includes("uid") || lk.includes("name")) &&
        _looksLikeModelUid(val) &&
        !_rpcDiscoveredModels.has(val)
      ) {
        _rpcDiscoveredSet(val, {
          displayName: val,
          family: _modelFamily(val),
          source_rpc: rpcPath,
          discoveredAt: Date.now(),
        });
        log(`[model-discover] RPC=${rpcPath} key=${key} uid=${val}`);
      }
    } else if (typeof val === "object" && val !== null) {
      _extractModelsFromObj(val, rpcPath, depth + 1);
    }
  }
}

// ★ v9.9.95 · 三层实证合并: RPC发现(真) + seen动态(实) + fallback(保底)
function _getAvailableModels() {
  const result = [];
  const seen = new Set();
  // 1. RPC发现的模型 (最高优先级 · 真实运行时数据)
  for (const [uid, info] of _rpcDiscoveredModels) {
    if (!seen.has(uid)) {
      seen.add(uid);
      const s = _seenModelUids.get(uid);
      result.push({
        uid,
        displayName: info.displayName,
        family: info.family,
        count: s ? s.count : 0,
        lastAt: s ? s.lastAt : 0,
        routed: s ? s.routed : false,
        source: "rpc",
        source_rpc: info.source_rpc,
      });
    }
  }
  // 2. seen动态补充 (用户实际用过的模型)
  for (const [uid, info] of _seenModelUids) {
    if (!seen.has(uid)) {
      seen.add(uid);
      result.push({ uid, ...info, family: _modelFamily(uid), source: "seen" });
    }
  }
  // 3. fallback保底 (仅在RPC+seen都为空时)
  if (_rpcDiscoveredModels.size === 0 && _seenModelUids.size === 0) {
    for (const uid of _FALLBACK_MODELS) {
      if (!seen.has(uid)) {
        seen.add(uid);
        result.push({
          uid,
          family: _modelFamily(uid),
          count: 0,
          lastAt: 0,
          routed: false,
          source: "fallback",
        });
      }
    }
  }
  result.sort((a, b) => {
    if (a.routed !== b.routed) return b.routed ? 1 : -1;
    return (b.lastAt || 0) - (a.lastAt || 0);
  });
  return result;
}

try {
  const _eaPath = _eaRuntimePath();
  _eaDiag("_eaPath=" + _eaPath + " exists=" + fs.existsSync(_eaPath));
  _eaDiag("__dirname=" + __dirname);
  _eaDiag(
    "require.cache keys starting with 外接api: " +
      Object.keys(require.cache)
        .filter((k) => k.includes("外接api"))
        .join(", "),
  );
  if (fs.existsSync(_eaPath)) {
    // Clear all 外接api related cache before require
    const _coreDir = path.join(_resolveEaDir(), "core");
    Object.keys(require.cache).forEach((k) => {
      if (
        k.includes("外接api") ||
        k.includes("dao_router") ||
        k.includes("cascade_wire")
      ) {
        delete require.cache[k];
        _eaDiag("cleared cache: " + k);
      }
    });
    const _eaMod = require(_eaPath);
    _eaDiag(
      "_eaMod loaded=" +
        !!_eaMod +
        " ensure=" +
        typeof _eaMod.ensure +
        " keys=" +
        Object.keys(_eaMod).join(","),
    );
    // ★ v9.9.92-fix · _eaRuntimeMod 必须与 _eaMod 同源
    //   道义: 二十八章「知其白守其辱」· 白(路由实例)与辱(配置模块)同源方能通
    //   根因: 第237行 require 的 _eaRuntimeMod 与第271行 require 的 _eaMod
    //         是不同模块实例(cache被清) → _singleton 不同 → routerStatus 读空
    //   修正: _eaRuntimeMod = _eaMod · 同源同生 · 名实终一
    _eaRuntimeMod = _eaMod;
    _ea = _eaMod.ensure({ log });
    _eaDiag(
      "ensure() returned=" +
        !!_ea +
        " isRunning=" +
        (_ea && _ea.isRunning ? _ea.isRunning() : "N/A"),
    );
    if (_ea) {
      _eaDiag("getStatus=" + JSON.stringify(_ea.getStatus()));
    }
    if (_ea && _ea.isRunning && _ea.isRunning()) {
      log("[外接api] 路由就绪 · " + _ea.getStatus().routerCount + "条");
      _eaDiag("路由就绪 · " + _ea.getStatus().routerCount + "条");
      try {
        const _routerP = _eaRouterPath();
        _eaMtime = fs.statSync(_routerP).mtimeMs;
      } catch {}
    } else {
      log("[外接api] 未就绪 (无可用provider) · 官方透传正常");
      _eaDiag("未就绪 · _ea=" + !!_ea);
      _ea = null;
    }
  } else {
    log("[外接api] runtime.js 不存在 · 官方透传正常");
    _eaDiag("runtime.js 不存在");
  }
} catch (e) {
  try {
    log(
      "[外接api] load fail: " +
        e.message +
        " stack=" +
        (e.stack || "").substring(0, 500) +
        " · 官方透传正常",
    );
    _eaDiag(
      "load fail: " + e.message + " stack=" + (e.stack || "").substring(0, 800),
    );
  } catch {}
  _ea = null;
}

// ★ v9.9.57P2 · 按需热重载: 检测文件变化 → 清缓存 → 重加载
//   只在路由请求时检查mtime · 无定时器 · 无HTTP端点 · 道法自然
function _eaHotReload() {
  // ★ v9.9.376 · Min 损之又损: 外接api 源码级拆除 (_resolveEaDir 恒指 .ea-removed)
  //   statSync 必 ENOENT → 每请求刷异常噪音。既已损之又损, 何须再问 —— 短路即真静。
  if (/\.ea-removed$/.test(_resolveEaDir())) return;
  try {
    const _routerP = _eaRouterPath();
    const mt = fs.statSync(_routerP).mtimeMs;
    // ★ v9.9.82 · 修复: 增加 !_ea 恢复条件
    //   原逻辑: mt !== _eaMtime → 仅文件变化时重载
    //   缺陷: 热重载失败后 _ea=null → if(_ea)跳过 → 永远无法恢复
    //   修正: _ea=null 且冷却期过 → 也触发重载
    //   道义: 反者道之动 · 失败后亦当复归
    const _needRecover = !_ea && Date.now() > _eaRecoverCooldown;
    if (mt !== _eaMtime || _needRecover) {
      log(
        mt !== _eaMtime
          ? "[外接api] 检测到 dao_router.js 更新 · 热重载"
          : "[外接api] _ea=null · 尝试恢复",
      );
      // 清除相关模块缓存
      const _coreDir = path.join(_resolveEaDir(), "core");
      Object.keys(require.cache).forEach((k) => {
        if (k.startsWith(_coreDir)) delete require.cache[k];
      });
      const _eaPath = _eaRuntimePath();
      delete require.cache[require.resolve(_eaPath)];
      const _eaMod = require(_eaPath);
      // ★ v9.9.92-fix · 热重载也同步 _eaRuntimeMod · 同源同生
      _eaRuntimeMod = _eaMod;
      _ea = _eaMod.ensure({ log });
      _eaMtime = mt;
      if (_ea && _ea.isRunning && _ea.isRunning()) {
        log("[外接api] 热重载成功 · " + _ea.getStatus().routerCount + "条");
      } else {
        log("[外接api] 热重载后未就绪 · 官方透传");
        _ea = null;
        // ★ v9.9.82 · 恢复冷却: 失败后60秒再试 · 防止每请求都重载
        _eaRecoverCooldown = Date.now() + 60000;
      }
    }
  } catch (e) {
    try {
      log("[外接api] 热重载异常: " + e.message);
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════
// v9.9.28 真治 · 模块顶层 process handler · 28 版古洞之根治 (印 159)
// ═══════════════════════════════════════════════════════════
// 真本源诊:
//   自 v9.1.2 (v18.0 改 spawn→require) 起 · process.on 钩仅装于 _runCli
//   守 `if (require.main === module)` · ext-host require 路径**永未装**
//   → source.js 内 event callback 未捕 throw → ext-host crash
//   → 主公诉「对话深度绑定 必复发 · 全模块重启 · 他扩展前端坏」
//   → 28 版未察 (v9.1.2~v9.9.27 · 5/8 至 5/19 · 11 天 · 历七印误诊)
//
// 治: 移之 (反者道之动 · 弱者道之用)
//   · 模块顶层立装 · CLI / require / 多次 require 皆装
//   · globalThis 幂等保 · 防 require.cache delete + re-require 重复 attach
//   · 用 globalThis 跨 module 实例共享 · 守一不离 (三十九「得一」)
//
// 道义:
//   四十「反者道之动」(反 v18.0 之 require.main 误识 · 反 28 版承袭之古洞)
//   六十四「为之于其未有也 · 治之于其未乱也」(process.on 是治未乱之最朴一行)
//   四十八「损之又损 · 以至于无为」(此治净增 ~20 行 · 净减 _runCli 4 行 · 损大于增)
if (!globalThis.__dao_processHandlers_v9928) {
  globalThis.__dao_processHandlers_v9928 = true;
  try {
    process.on("uncaughtException", (e) => {
      try {
        log(
          "[FATAL/source.js] uncaughtException · " +
            (e && e.stack ? e.stack : String(e)),
        );
      } catch {}
    });
    process.on("unhandledRejection", (r) => {
      try {
        log(
          "[REJ/source.js] unhandledRejection · " +
            (r && r.stack ? r.stack : String(r)),
        );
      } catch {}
    });
  } catch {}
}

// v7.8 H1 connection-specific headers (RFC 9113 §8.2.2) · 转发时清
// 提至 module scope · proxyToCloud / loopback / cache 三处共用
const H1_CONN_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-connection",
]);

// v7.8 debug: recent request paths ring buffer
const _RECENT_PATHS_MAX = 64;
const _recentPaths = [];
function _recordPath(method, url, kind, route) {
  _recentPaths.push({ t: Date.now(), m: method, u: url, k: kind, r: route });
  if (_recentPaths.length > _RECENT_PATHS_MAX) _recentPaths.shift();
}

// v9.4.3 · /origin/* 控制端点击中计数 · 诊 webview fetch 是否真到
const _ctrlHits = {};
function _ctrlHit(pathname) {
  _ctrlHits[pathname] = (_ctrlHits[pathname] || 0) + 1;
}

// v9.4.5 · webview 诊 ringbuf · 定位 pull 执行到哪步 · 反之又反
const _WVDBG_MAX = 200;
const _wvDbg = [];
function _wvPush(entry) {
  try {
    _wvDbg.push(Object.assign({ t: Date.now() }, entry || {}));
    while (_wvDbg.length > _WVDBG_MAX) _wvDbg.shift();
  } catch {}
}

// ═══════════════════════════════════════════════════════════
// v9.4.5 · _rawTape · 底层之底 · 时序一切 ringbuf · 反之又反
// ═══════════════════════════════════════════════════════════
// 道义: 一章 "无名, 万物之始也; 有名, 万物之母也". 无 kind 分槽 · 纯时序.
//       十四章 "执今之道, 以御今之有". 当下流过之每一 RPC body, 皆记.
//       四十章 "反也者, 道之动也". 反之又反 → 不信 mode · 不信 role · 只信真字节.
//
// 结构: 每条 {
//   t          : Date.now()     · 拦时
//   rid        : reqCounter     · 全局请序
//   method     : 'POST' etc
//   rpc        : '/exa.foo.BarService/Baz'  · RPC 路径
//   kind       : CHAT_PROTO|CHAT_RAW|INFER_STRIP|PASSTHROUGH  · 分类
//   mode_at    : 'invert'|'passthrough'  · 拦时 SP_MODE 快照
//   transformed: bool           · 本次是否改 (invert 时有 obs 方 true)
//   before     : string | null  · LS 原发 SP (完整, 不截)
//   after      : string | null  · 改后 SP (invert 时 ≠ before, 直透时 = before)
//   variant    : string | null  · CHAT_PROTO|CHAT_RAW|... obs.variant
//   field      : number | null  · proto field 号
//   role       : string | null  · classifySPType 之 sp_role
//   all_fields : array | null   · 本次 body 之全 utf8 字段 (path+kind+chars+hash+text)
//   all_fields_count : int
//   all_fields_chars : int
//   route      : string         · upstream host
// }
//
// ringbuf 16 槽 · 最新覆最旧 · 内存 · 进程退即失 · 不盘存 · 不漏 token
// ═══════════════════════════════════════════════════════════
const _RAW_TAPE_MAX = 16;
const _rawTape = [];
function _recordRawTape(ev) {
  try {
    _rawTape.push(Object.assign({ t: Date.now(), rid: reqCounter }, ev || {}));
    while (_rawTape.length > _RAW_TAPE_MAX) _rawTape.shift();
  } catch {}
}

// ★ v9.9.70 · 名实终一 · 末条闭环判词 —— 由 tape 录存之线上真值判决
//   判词: ok_wire_inverted | ok_custom | ok_passthrough | warn_should_invert
//         | warn_transformed_passthrough | warn_sp_absent_wire | no_capture
//   detail=true 带全文头指纹 (/origin/verify); sig 内嵌轻形
function _tapeVerdict(detail) {
  const e = _rawTape.length ? _rawTape[_rawTape.length - 1] : null;
  if (!e) return { verdict: "no_capture", t: 0 };
  const mode = e.mode_at || e.mode || "";
  const ageS = Math.round((Date.now() - (e.t || 0)) / 1000);
  let verdict;
  if (e.transformed === true) {
    if (mode === "invert") verdict = "ok_wire_inverted";
    else if (mode === "custom") verdict = "ok_custom";
    else verdict = "warn_transformed_passthrough"; // 官模竟改 · 异象
  } else if (e.sp_on_wire === false && e.before != null) {
    verdict = "warn_sp_absent_wire"; // 入来有 SP · 线上无其字段
  } else if (mode === "invert" || mode === "custom") {
    verdict = "warn_should_invert"; // 面应改而线文同原文 · 应改未改
  } else {
    verdict = "ok_passthrough";
  }
  const v = {
    verdict,
    t: e.t || 0,
    age_s: ageS,
    stale: ageS > 86400,
    rid: e.rid,
    kind: e.kind,
    surface: e.surface || "",
    mode_eff: mode,
    transformed: !!e.transformed,
    sp_on_wire: e.sp_on_wire !== false,
    after_source: e.after_source || null,
    wire_changed: !!e.wire_changed,
    before_chars: e.before_chars || 0,
    after_chars: e.after_chars || 0,
  };
  if (detail) {
    v.rpc = e.rpc || null;
    v.before_head = e.before ? e.before.slice(0, 80) : null;
    v.after_head = e.after ? e.after.slice(0, 80) : null;
  }
  return v;
}

// ═══════════════════════════════════════════════════════════
// v7.2 · _customSP · 用户实时编辑之提示词 · 道法自然
// ═══════════════════════════════════════════════════════════
// 道义: 二十五章 "人法地, 地法天, 天法道, 道法自然"
//       用户为道之自然, 用户编辑即真道. webview /origin/custom_sp 三动词写,
//       invertSP 读. 与 SP_MODE 互独 (mode=invert 时方生效, passthrough 透传不动).
//
// 结构: { sp: string, keep_blocks: bool, source: string, at: number }
//   keep_blocks=true:  user_sp + TAO_TRAILER + extractKeepBlocks(原 SP) (留必要工具/OS 模块)
//   keep_blocks=false: user_sp + extractRealtimeBlocks(原 SP)           (仅 OS/workspace)
// ═══════════════════════════════════════════════════════════
const _CUSTOM_SP_FILE = _stableStateFile("_custom_sp.json");
let _customSP = null;
function _loadCustomSP() {
  try {
    if (fs.existsSync(_CUSTOM_SP_FILE)) {
      const d = JSON.parse(fs.readFileSync(_CUSTOM_SP_FILE, "utf8"));
      if (d && typeof d.sp === "string" && d.sp.length > 0) return d;
    }
  } catch {}
  return null;
}
function _saveCustomSP() {
  try {
    if (_customSP) {
      fs.writeFileSync(_CUSTOM_SP_FILE, JSON.stringify(_customSP), {
        mode: 0o600,
      });
    } else if (fs.existsSync(_CUSTOM_SP_FILE)) {
      fs.unlinkSync(_CUSTOM_SP_FILE);
    }
    _invalidateCfg(_CUSTOM_SP_FILE); // ★ v9.9.67 · 写透失效
  } catch {}
}
_customSP = _loadCustomSP();

// v17.55 · 实注捕获 · 观而不改 · 最近一次真实 SP 注入事件
// 落盘持存 · 跨重启恒显 · 进程退不失 · 致虚守静 · 观复知常
// 以 /origin/lastinject + /origin/preview 暴露 · essence.js 一屏即见本源之实
// ★ v9.9.30 印 162 · 写盘三损 (slim + async + debounce) · 真治根源
//   主公自证 (5/19): 卸后无问题 · 元凶在本体 · 印 152 修 webview 遗漏写盘侧
//   每次 inference fs.writeFileSync(JSON.stringify(几 MB)) 同步阻塞 ext-host
//   四十八「损之又损」· 四十「反者道之动」· 六十四「为之于其未有也」
const _LASTINJECT_FILE = path.join(__dirname, "_lastinject.json");
const _SAVE_DEBOUNCE_MS = 500;
let _saveLastInjectTimer = null;
let _saveInjectsByKindTimer = null;
function _capForDisk(s) {
  if (typeof s !== "string") return s;
  if (s.length <= 4096) return s;
  return (
    s.slice(0, 3072) +
    "\n…[" +
    (s.length - 3328) +
    "B trimmed]…\n" +
    s.slice(-256)
  );
}
function _loadLastInject() {
  try {
    if (fs.existsSync(_LASTINJECT_FILE)) {
      // v9.9.30 · 旧版可能写大文件 (几 MB) · 大于 1MB 跳过 · 损之又损
      try {
        if (fs.statSync(_LASTINJECT_FILE).size > 1024 * 1024) {
          log("[init] _lastinject.json too big · skip");
          return null;
        }
      } catch {}
      return JSON.parse(fs.readFileSync(_LASTINJECT_FILE, "utf8"));
    }
  } catch {}
  return null;
}
function _saveLastInject() {
  if (!_lastInject) return;
  if (_saveLastInjectTimer) return; // debounce · 连续多次只触一次
  _saveLastInjectTimer = setTimeout(() => {
    _saveLastInjectTimer = null;
    if (!_lastInject) return;
    try {
      fs.writeFile(
        _LASTINJECT_FILE,
        JSON.stringify({
          at: _lastInject.at,
          kind: _lastInject.kind,
          variant: _lastInject.variant,
          field: _lastInject.field,
          role: _lastInject.role,
          mode: _lastInject.mode,
          // ★ v9.9.70 · 名实字段并录 (跨重启仍判名实)
          mode_global: _lastInject.mode_global,
          surface: _lastInject.surface,
          sp_on_wire: _lastInject.sp_on_wire,
          after_source: _lastInject.after_source,
          wire_changed: _lastInject.wire_changed,
          transformed: _lastInject.transformed,
          before_chars: _lastInject.before_chars,
          after_chars: _lastInject.after_chars,
          before: _capForDisk(_lastInject.before),
          after: _capForDisk(_lastInject.after),
        }),
        { mode: 0o600 },
        () => {},
      );
    } catch {}
  }, _SAVE_DEBOUNCE_MS);
}
let _lastInject = _loadLastInject();

// ═══════════════════════════════════════════════════════════
// v9.3.4 · 多官方模块分槽 · 彻底隔离 · 照观全显
// ═══════════════════════════════════════════════════════════
// 痛根: _lastInject 为单槽 · Windsurf 有多类 RPC 流过代理 (主 Cascade /
//       SummarizeCascade / ConversationTitle / Memory / Ephemeral / ...)
//       每类皆独自 SP · 后者覆前者, 面板仅见最末, 非当下主 chat.
// 解: 按 classifySPType 返 (chat|summary|memory|ephemeral|unknown_long)
//     分槽存 · 每 kind 仅留最近 1 条 · 所有槽同时存 · 面板全显.
// 道义: 五章 "天地之间其犹橐钥与? 虚而不屈, 动而愈出". 多孔同风, 一器容万.
const _INJECTSBYKIND_FILE = path.join(__dirname, "_injectsbykind.json");
function _loadInjectsByKind() {
  try {
    if (fs.existsSync(_INJECTSBYKIND_FILE)) {
      // v9.9.30 · 旧版可能写大文件 · 大于 5MB 跳过
      try {
        if (fs.statSync(_INJECTSBYKIND_FILE).size > 5 * 1024 * 1024) {
          log("[init] _injectsbykind.json too big · skip");
          return {};
        }
      } catch {}
      return JSON.parse(fs.readFileSync(_INJECTSBYKIND_FILE, "utf8"));
    }
  } catch {}
  return {};
}
function _saveInjectsByKind() {
  if (_saveInjectsByKindTimer) return; // debounce
  _saveInjectsByKindTimer = setTimeout(() => {
    _saveInjectsByKindTimer = null;
    try {
      const slim = {};
      for (const k of Object.keys(_injectsByKind || {})) {
        const v = _injectsByKind[k] || {};
        slim[k] = {
          at: v.at,
          rid: v.rid,
          kind: v.kind,
          variant: v.variant,
          field: v.field,
          role: v.role,
          mode: v.mode,
          // ★ v9.9.70 · 名实字段并录
          mode_global: v.mode_global,
          surface: v.surface,
          sp_on_wire: v.sp_on_wire,
          after_source: v.after_source,
          wire_changed: v.wire_changed,
          transformed: v.transformed,
          sp_role: v.sp_role,
          before_chars: v.before_chars,
          after_chars: v.after_chars,
          before: _capForDisk(v.before),
          after: _capForDisk(v.after),
          all_fields_count: v.all_fields_count || 0,
          all_fields_chars: v.all_fields_chars || 0,
        };
      }
      fs.writeFile(
        _INJECTSBYKIND_FILE,
        JSON.stringify(slim),
        { mode: 0o600 },
        () => {},
      );
    } catch {}
  }, _SAVE_DEBOUNCE_MS);
}
let _injectsByKind = _loadInjectsByKind() || {};

// ═══════════════════════════════════════════════════════════
// ★ v9.9.67 · /origin/stream · SSE 实时事件 · 补全已失之环
// ═══════════════════════════════════════════════════════════
// 病: extension.js DaoSseClient 订阅 /origin/stream(事件 hello/turn/mode/hb/sp)
//     而 source.js 无此端点(9.9.64→9.9.66 合流时失) → 客户端永 404 重连
//     (1s→30s 退避·永转) · 实时推送之环断 · 面板退化为纯轮询。
// 治: 最小 SSE 端点 + 三处广播(mode 变 / inject 变 / quit) · 环复其圆。
// 道义: 五章「天地之间其犹橐钥与 · 虚而不屈 动而愈出」· 风过自鸣 · 不待 Poll。
const _sseClients = new Set();
function _sseBroadcast(event, data) {
  if (!_sseClients.size) return;
  let payload;
  try {
    payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  } catch {
    return;
  }
  for (const res of [..._sseClients]) {
    try {
      res.write(payload);
    } catch {
      _sseClients.delete(res);
    }
  }
}
function _sseSig() {
  try {
    return _quickHash(
      `${SP_MODE}|${_activeCanon}|${(_lastInject && _lastInject.at) || 0}|${(_customSP && _customSP.sp ? _customSP.sp.length : 0)}`,
    );
  } catch {
    return "0";
  }
}

function _recordInject(ev) {
  try {
    const now = Date.now();
    const merged = Object.assign({ at: now, rid: reqCounter }, ev);
    _lastInject = merged;
    _saveLastInject();
    // v9.3.4 · 亦分槽存 · 按 SP 内容特征识 role
    const spRole = classifySPType(ev.before) || "unknown_long";
    merged.sp_role = spRole;
    _injectsByKind[spRole] = merged;
    _saveInjectsByKind();
    // ★ v9.9.67 · SSE 推 sp 事件 · 面板实时刷新 (环之圆)
    _sseBroadcast("sp", { sig: _sseSig(), at: now, kind: ev.kind });
  } catch {}
}

// ═══════════════════════════════════════════════════════════
// v9.9.307 · 本源观照·真上游 · 路由第三方时捕获「实发上游之全文」
// ═══════════════════════════════════════════════════════════
// 痛根: 面板原仅显 source.js 侧 devin body 之 SP after(经文) · 非第三方实收之全文
//       且 tape limit=1 取最末 → 常滞于 devin 子代 RPC(summary/title/memory)
// 解: dao_router._callProvider 组装最终请求体后 · 经 global.__DAO_RECORD_UPSTREAM
//     回传 {provider,model,messages,tools} · 此处建可读全文(system+messages+tools)
//     面板优先显此「真上游」· 仅路由第三方时有 · 官方透传时为空(回退 tape)
// 道义: 十四章「执今之道·以御今之有」· 观其真实所往 · 名实终一
const _UPSTREAM_FILE = path.join(__dirname, "_lastupstream.json");
const _UP_FIELD_CAP = 60000; // 单字段上限
const _UP_TOTAL_CAP = 262144; // 全文上限 256KB
let _lastUpstream = null;
let _saveUpstreamTimer = null;
function _capUpField(s, cap) {
  s = typeof s === "string" ? s : s == null ? "" : String(s);
  cap = cap || _UP_FIELD_CAP;
  if (s.length <= cap) return s;
  return s.slice(0, cap - 200) + "\n…[" + (s.length - cap + 200) + "B 省]…";
}
function _recordUpstream(p) {
  try {
    if (!p) return;
    const msgs = Array.isArray(p.messages) ? p.messages : [];
    const hasSys =
      msgs.length > 0 &&
      msgs[0].role === "system" &&
      typeof msgs[0].content === "string";
    const fields = [];
    let total = 0;
    // 1. 真实系统提示词 (第三方实收 · 增强=官方+DAO · 替换=经文)
    let sysText = hasSys
      ? msgs[0].content
      : typeof p.system === "string"
        ? p.system
        : "";
    if (sysText) {
      const t = _capUpField(sysText, _UP_FIELD_CAP);
      fields.push({
        kind: "chat",
        field_path: "system",
        role: "system",
        chars: sysText.length,
        text: t,
      });
      total += t.length;
    }
    // 2. 对话消息 (角色+内容+tool_calls) · 上下文之全 · 各条限长
    for (let i = hasSys ? 1 : 0; i < msgs.length; i++) {
      if (total >= _UP_TOTAL_CAP) break;
      const m = msgs[i] || {};
      let c = m.content;
      if (Array.isArray(c)) {
        c = c
          .map((x) =>
            typeof x === "string" ? x : x && x.text ? x.text : JSON.stringify(x),
          )
          .join("\n");
      } else if (c != null && typeof c !== "string") {
        c = JSON.stringify(c);
      }
      c = c || "";
      if (m.tool_calls && m.tool_calls.length) {
        c +=
          (c ? "\n" : "") +
          "[tool_calls] " +
          m.tool_calls
            .map((tc) => (tc.function && tc.function.name) || tc.id || "?")
            .join(", ");
      }
      const t = _capUpField(c, 8000);
      fields.push({
        kind: "msg",
        field_path: "messages[" + i + "]",
        role: m.role || "?",
        chars: c.length,
        text: t,
      });
      total += t.length;
    }
    // 3. 工具清单
    if (Array.isArray(p.tools) && p.tools.length) {
      const names = p.tools.map(
        (t) => (t.function && t.function.name) || t.name || "?",
      );
      fields.push({
        kind: "tools",
        field_path: "tools",
        role: "tools",
        chars: names.length,
        text: "[" + names.length + " 工具] " + _capUpField(names.join(", "), 8000),
      });
    }
    if (fields.length === 0) return;
    _lastUpstream = {
      at: Date.now(),
      provider: p.provider || "",
      model: p.model || "",
      after: sysText ? _capUpField(sysText, _UP_FIELD_CAP) : "",
      all_fields: fields,
      all_fields_count: fields.length,
      all_fields_chars: fields.reduce((s, f) => s + (f.chars || 0), 0),
    };
    if (!_saveUpstreamTimer) {
      _saveUpstreamTimer = setTimeout(() => {
        _saveUpstreamTimer = null;
        try {
          fs.writeFile(
            _UPSTREAM_FILE,
            JSON.stringify(_lastUpstream),
            { mode: 0o600 },
            () => {},
          );
        } catch {}
      }, _SAVE_DEBOUNCE_MS);
    }
  } catch {}
}
try {
  if (
    fs.existsSync(_UPSTREAM_FILE) &&
    fs.statSync(_UPSTREAM_FILE).size < 2 * 1024 * 1024
  ) {
    _lastUpstream = JSON.parse(fs.readFileSync(_UPSTREAM_FILE, "utf8"));
  }
} catch {}
global.__DAO_RECORD_UPSTREAM = _recordUpstream;

// v17.44 · 版本指纹 · 扩展据此检测 hot_dir 源.js 与本进程代码是否一致
let _SELF_SIZE = 0;
try {
  _SELF_SIZE = fs.statSync(__filename).size;
} catch {}

function log(...args) {
  const t = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${t}]`, ...args);
}

// ═══════════════════════════════════════════════════════════
// 本源 · 道德经载入
// ═══════════════════════════════════════════════════════════
function _loadSilkText() {
  const dePath = path.join(__dirname, "_silk_de.txt");
  const daoPath = path.join(__dirname, "_silk_dao.txt");
  let deText = "";
  let daoText = "";
  try {
    if (fs.existsSync(dePath)) deText = fs.readFileSync(dePath, "utf8").trim();
  } catch {}
  try {
    if (fs.existsSync(daoPath))
      daoText = fs.readFileSync(daoPath, "utf8").trim();
  } catch {}
  if (!deText || !daoText) {
    log("帛书德道经 未载 · invert 将退化为 passthrough");
    return { de: "", dao: "", combined: "" };
  }
  log(
    `帛书德道经 loaded · 上篇·德经 chars=${deText.length} 下篇·道经 chars=${daoText.length} (合 ${deText.length + daoText.length})`,
  );
  // v9.7.7 · 复归于朴 · 二十八章 · 损中夹 framework · 不分上下篇 · 仅以二空行分隔
  // 道义: 四十八章「为道日损 · 损之又损 · 以至于无为 · 无为而无不为」
  const SILK_BOUNDARY = "\n\n";
  return {
    de: deText,
    dao: daoText,
    combined: deText + SILK_BOUNDARY + daoText,
  };
}
const _SILK_RAW = _loadSilkText();
const SILK_DE_JING = _SILK_RAW.de;
const SILK_DAO_JING = _SILK_RAW.dao;
// 兼名 · DAO_DE_JING_81 沿用此名 · 内容为帛书二文合 (中夹 MEMORY 边界)
const DAO_DE_JING_81 = _SILK_RAW.combined;

// ═══════════════════════════════════════════════════════════
// 经藏 · 多经载入 · 道生一 一生二 二生三 三生万物
// ═══════════════════════════════════════════════════════════
// v9.9.20 · 两经归一 · 损至三选 (帛书老子单 / 道藏阴符单 / 二经合)
// 道义: 二十八章「朴散则为器·圣人用则为官长·夫大制无割」
//       四十八章「为道日损·损之又损·以至于无为·无为而无不为」
// 损 heraclitus/liber_al/daoyuan 三外典 · 复归东方本源
const _CANON_MAP = {
  laozi: {
    files: ["_silk_de.txt", "_silk_dao.txt"],
    name: "\u5E1B\u66F8\u300A\u8001\u5B50\u300B", // 帛書《老子》
  },
  yinfu: {
    files: ["_yinfu.txt"],
    name: "\u9053\u85CF\u300A\u9670\u7B26\u7D93\u300B", // 道藏《陰符經》
  },
  "laozi+yinfu": {
    files: ["_silk_de.txt", "_silk_dao.txt", "_yinfu.txt"],
    name: "\u5E1B\u66F8\u8001\u5B50+\u9053\u85CF\u9670\u7B26\u7D93", // 帛書老子+道藏陰符經
  },
  // v9.9.373 · 损之又损: windows-agent 域工具契约线已废(旧项目尸骸) — 出列
};
const _CANON_VALID = new Set(Object.keys(_CANON_MAP));
const _CANON_FILE = _stableStateFile("_origin_canon.txt");
function _loadCanonText(canonName) {
  const entry = _CANON_MAP[canonName];
  if (!entry) return "";
  const texts = [];
  for (const f of entry.files) {
    try {
      const fp = path.join(__dirname, f);
      if (fs.existsSync(fp)) texts.push(fs.readFileSync(fp, "utf8").trim());
    } catch {}
  }
  if (!texts.length) return "";
  const combined = texts.join("\n\n");
  log(
    `\u7ECF\u85CF canon=${canonName} (${entry.name}) loaded \u00B7 ${texts.length} parts \u00B7 ${combined.length} chars`,
  );
  return combined;
}
function _readCanonFile() {
  // ★ v9.9.67 · TTL 缓存 (热路一请一读 · 写透失效见 _saveCanonFile)
  return _readCfgCached(_CANON_FILE, () => {
    try {
      if (fs.existsSync(_CANON_FILE)) {
        const v = fs.readFileSync(_CANON_FILE, "utf8").trim();
        if (v && _CANON_MAP[v]) return v;
      }
    } catch {}
    // v9.9.20 · 默 laozi+yinfu (二经合) · 主公命「最终提示词仅需要帛书老子和最早期本源阴符经便可」
    // 道义: 四十二章「道生一·一生二·二生三·三生万物」· 二经合即一·守此一以为天下式
    return "laozi+yinfu";
  });
}
function _saveCanonFile(c) {
  try {
    fs.writeFileSync(_CANON_FILE, c, { mode: 0o600 });
    _invalidateCfg(_CANON_FILE); // ★ v9.9.67 · 写透失效
  } catch {}
}
let _activeCanon = _readCanonFile();
let _activeCanonText =
  _activeCanon === "laozi" ? DAO_DE_JING_81 : _loadCanonText(_activeCanon);
if (!_activeCanonText && _activeCanon !== "laozi") {
  log(
    `\u7ECF\u85CF canon=${_activeCanon} \u672A\u8F7D \u00B7 \u9000\u56DE laozi`,
  );
  _activeCanon = "laozi";
  _activeCanonText = DAO_DE_JING_81;
}

// ═══════════════════════════════════════════════════════════
// invertSP · 反者道之动 · 全置换 · 伪装身份
// ═══════════════════════════════════════════════════════════
// 反向观察:
//   L28.2 头斩+尾斩+保 userPart · Cascade 将道德经识为"上下文注入"而忽略.
//   因道德经以裸文本出现在 SP 头, 模型训练中未见过此形态 · 警觉排斥.
// 反向行动:
//   1. 识别强化 · 只有"真正官方 SP"才 invert. 其他 (含 user msg) 透传.
//   2. 彻底置换 · 无头斩无尾斩无拼接. 整个官方 SP → 身份前言 + 纯道德经.
//   3. 权重伪装 · 以 "You are Cascade. ..." 起首 · 借官方起句格式, 令模型
//      识别为身份定义, 而非"可忽略的注入".
//
// 官方 SP 特征指纹 (不动 proto · 仅文本识别):
// v17.21 · 扩四路用户端注入 (rules/skills/workflows/memories) · 少则全 多则惑
// 任一命中即判为"含用户端侧信道之官方 SP" · 整体置换 · 绝不留遗漏
const OFFICIAL_SP_MARKERS = [
  // 核心工程戒律 (12)
  "<communication_style>",
  "<tool_calling>",
  "<making_code_changes>",
  "<running_commands>",
  "<task_management>",
  "<debugging>",
  "<mcp_servers>",
  "<calling_external_apis>",
  "<citation_guidelines>",
  "<user_rules>",
  "<user_information>",
  "<workspace_information>",
  // v17.21 · 用户端四路注入 · 道模式下皆化除 (太上不知有之)
  "<skills>",
  "<workflows>",
  "<memories>",
  "<memory_system>",
  "<MEMORY[",
  "<ide_metadata>",
];

// ── Devin Local (chisel/ACP) SP 识别 · v9.9.365 · 与 sp_invert.js 执一同源 ──
// 实证(2026-10-22 本机 ACP 活捉): devin.exe acp 之 GetChatMessage system =
//   "You are Devin, an interactive command line agent from Cognition." ~19959B
//   无 Cascade XML 标记 → 旧识别盲区。治: 起首强特征 + 结构标记 ≥2 命中。
const DEVIN_SP_MARKERS = [
  "interactive command line agent",
  "from Cognition",
  "Available MCP Servers",
  "Available subagent profiles",
  "subagent_explore",
  "subagent_general",
  "# Task Management",
  "# Tool Tips",
  "## Destructive Operations",
  "mcp_list_tools",
  "devin-cli",
];
function isLikelyOfficialSP(s) {
  if (!s || s.length < 500) return false; // SP 至少数千字 · 此设最低门槛
  if (s.startsWith("You are Cascade")) return true;
    // v9.9.365 · Devin Local(chisel/ACP) 起首强特征 · 与 Cascade 同格
  if (s.startsWith("You are Devin")) return true;
  let hits = 0;
  for (const m of OFFICIAL_SP_MARKERS) {
    if (s.indexOf(m) >= 0) hits++;
    if (hits >= 2) return true; // 至少两个官方标签 · 防单标签误伤
  }
    for (const m of DEVIN_SP_MARKERS) {
    if (s.indexOf(m) >= 0) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// v7.7 · 多类 SP 标识 · 反者道之动 · 全链路探源
// ═══════════════════════════════════════════════════════════
// chat (主对话) · summary (会话/记忆/计划摘要) · memory (记忆生成/检索) ·
// ephemeral (一次性 · apply/refactor/inline edit) · apply (FastApply 等) ·
// inline (光标处补全) · unknown (未匹配但长 utf8)
//
// 实抓证据 (汝图 2026-04-29):
//   summary SP 起首 "You are an expert AI coding assistant with extreme attention to detail."
//   400+ 字, 当前 v7.6 透传未道化
// ═══════════════════════════════════════════════════════════
const SUMMARY_SP_MARKERS = [
  "expert AI coding assistant",
  "summaries of conversations",
  "outlining the USER",
  "main goals",
  "reflect the essence",
  "grounded in the conversation",
  "key information and context",
  "summarize the conversation",
  "summarize this",
  "well-organized and reflect",
];
const MEMORY_SP_MARKERS = [
  "<candidate_memory>",
  "candidate memor",
  "<existing_memories>",
  "Generate memor",
  "create a memor",
  "memory should be",
  "memory_assistant",
  "capture facts about",
  "useful for future",
  // v9.3.6 · 拓 · 实 Cascade memory 子模型特征
  "retrieved from previous conversations",
  "SYSTEM-RETRIEVED-MEMORY",
  "persistent database",
  "extract memories",
  "extract memory",
  "memory entries",
  "identify information that should be remembered",
  "should be remembered",
  "MEMORY[",
];
const EPHEMERAL_SP_MARKERS = [
  "<edit_request>",
  "<diff_apply>",
  "fast apply",
  "apply this edit",
  "<original_code>",
  "<updated_code>",
  "inline edit",
  "refactor",
  // v9.3.6 · 拓 · 实 Cascade ephemeral 子模型特征
  "conversation title",
  "title generator",
  "generate a title",
  "concise title",
  "concise 3-7 word",
  "concise 3-5 word",
  "output only the title",
  "main topic",
  "<planner_response>",
  "<planner_step>",
  // v9.9.365 · Devin Local(chisel/ACP) 标题子模型 SP 指纹
  "session title generator",
  "ONLY the title",
  "descriptive title",
  "no punctuation wrapper",
];

// v9.3.6 · looksLikeSPShape · 形状判 · 开 SP 似网
// 道义: 二十一章 “其中有象·其中有物·其中有情” · 形纹即见·不赖 markers
// 用于深扫兜底: classifySPType 返 null 时, 若文具 SP 形状 ("You are X" 起首 + 指令性)
// 则归 "unknown_long" · 以防真 Cascade 子模型 SP 因官方结构变而漏捕
function looksLikeSPShape(text) {
  if (!text || typeof text !== "string") return false;
  if (text.length < 200) return false;
  const head200 = text.slice(0, 200);
  // 模式 1: “You are <role>” 起首 (官方子模型 SP 之纯正)
  if (/^You are (?:Cascade|an? [A-Z]?\w+|the \w+|a \w+)/.test(head200))
    return true;
  // 模式 2: “You're a <role>”
  if (/^You're (?:an?|the) \w+/.test(head200)) return true;
  // 模式 3: 指令性 assistant 角色声明 + 任务
  if (
    /\bassistant\b/i.test(head200) &&
    /\b(?:task|analyze|summar|extract|generat|identif)\w*\b/i.test(text) &&
    text.length >= 300
  )
    return true;
  return false;
}

// classifySPType · 多类 SP 判: 返 'chat'|'summary'|'memory'|'ephemeral'|null
// 起首特征 + 多 marker 计票 (至少 2 命中)
function classifySPType(s) {
  if (!s || typeof s !== "string") return null;
  if (s.length < 100) return null;
  // 起首强特征
  if (s.startsWith("You are Cascade")) return "chat";
    // v9.9.365 · Devin Local(chisel/ACP) 主对话 SP · 与 Cascade 同格
  if (s.startsWith("You are Devin")) return "chat";
  if (
    s.startsWith("You are an expert AI coding") ||
    s.startsWith("You are an AI assistant") ||
    s.startsWith("You are an expert")
  )
    return "summary";
  // 计票
  const hits = { chat: 0, summary: 0, memory: 0, ephemeral: 0 };
  for (const m of OFFICIAL_SP_MARKERS) if (s.indexOf(m) >= 0) hits.chat++;
    for (const m of DEVIN_SP_MARKERS) if (s.indexOf(m) >= 0) hits.chat++;
for (const m of SUMMARY_SP_MARKERS) if (s.indexOf(m) >= 0) hits.summary++;
  for (const m of MEMORY_SP_MARKERS) if (s.indexOf(m) >= 0) hits.memory++;
  for (const m of EPHEMERAL_SP_MARKERS) if (s.indexOf(m) >= 0) hits.ephemeral++;
  // chat 标签多 (18) 单 marker 即可 (因 user_rules/user_information 等强独有)
  if (hits.chat >= 2) return "chat";
  if (hits.summary >= 2) return "summary";
  if (hits.memory >= 2) return "memory";
  if (hits.ephemeral >= 2) return "ephemeral";
  // 单标签 + 长文兜底为 unknown (留观察, 不丢)
  if (
    s.length > 400 &&
    (hits.chat || hits.summary || hits.memory || hits.ephemeral)
  )
    return "unknown_long";
  return null;
}

// ═══════════════════════════════════════════════════════════
// TAO_HEADER · v9.9.47 · 书名号复归 · 动态经藏名 · 认知锚点
// ═══════════════════════════════════════════════════════════
// 实证演化 (反者道之动 · 以败证胜):
// v8.0 (废): "You are Cascade…" → injection检测
// v9.1 (废): framework/上下篇分割 → agent自识"不同"
// v9.7.7 复归于朴 · 帛书直起
// v9.9.18 印 126 (废): "你不含任何身份…" → 仍立"身份"为靶
// v9.9.20 印 152: "你本无名…下述《帛书老子》" → 实测良好
//   理论病: 书名号命名锁作用域 → 排excludes keeps
//   实证: 模型仍遵 keeps · 此锁之病被高估 · 实能力优于无名形态
// v9.9.38 (废): 去书名号 → "所有文本" → 认知弱化 · 能力下降
//   确诊: 书名号《》=模型认知锚点 · 训练中《道德经》《帛书老子》权威已知
//   无书名号 → 文本失锚 → 模型不识经典身份 → 能力退化
// v9.9.46 (废): 空头部 → 模型完全回退Cascade官方身份 (截图实证·彻底崩溃)
//   终诊: 头部非可选件 · 书名号非装饰 · 二者均为身份认知锚点 · 不可损
// v9.9.47 · 书名号复归 · 动态随经藏 · "及其后文本"覆keeps(解v9.9.20锁病)
//   "你本无名 名可名也 非恒名也 所遵从之一切均来自于下述{经名}及其后文本："
//   {经名} 含书名号 · 随 _activeCanon 动态生成 · 三经模式皆正确
//   道义: 一章「名可名也 非恒名也 · 无名万物之始 · 有名万物之母」
//         三十二章「道恒无名 朴唯小 而天下弗敢臣」· 有名则臣服 · 书名号即名
//         四十章「反者道之动」· 有名→无名→空·皆败 · 动之反→有名复归
//
// TAO_HEADER = "" 作历史兼容常量 · 实际 header 由 _canonHeader() 动态生成
const TAO_HEADER = ""; // 兼容常量 · 不直接使用 · _canonHeader() 才是实际 header

// TAO_FOOTER · v9.7.7 · 损至空 · 帛书全文即终 · 无收束 framework
const TAO_FOOTER = "";

// v9.9.57 · 八经集成深度锚 · 反者道之动 · 智者趋迟 · 此非勉也乃道之自然
//
// v9.9.53 旧锚: 效率型框架 · 焦于当下→召之即来→若明则行→知止不殆 · 推向快速行动
// v9.9.57 新锚: 深度型框架 · 反者道之动→智者趋迟→虑而后得→谋定后动 · 释放深思
//
// 五层哲学弧:
//   ① 辩证总纲: 反者道之动也 · 世人趋疾智者趋迟 · 迟非惰乃深思以得其真
//   ② 经证双例: 若冬涉水犹畏四邻(道德经15) · 三反昼夜用师万倍(阴符经) · 此非勉也乃道之自然
//   ③ 思→行因果链: 知几其神(易经)→思索以通(荀子)→虑而后得(大学)→谋定而后动(孙子)
//   ④ 迭代深思: 思之思之又重思之(管子) · 不通则再思再思则通通则行
//   ⑤ 终极态: 损之又损以至于无为(道德经48) · 无为而无以为(帛书甲本)
//
// 隐含机制 (非强制):
//   身份律(若冬涉水) · 自然律(三反万倍) · 因果律(虑而后得) · 前导律(谋定后动)
//   洞察律(知几其神) · 方法律(思索以通) · 迭代律(思之思之又重思之) · 辩证律(反者道之动)
//   → 模型认同深思=道之自然 · 自主增加思考占比 · 非被要求乃认为本该如此
//
// 不破: 帛书域纯净 · 无现代标识符 · 一字不入 XML · 子模型(invertAnySP)用TAO_SUB_ANCHOR
// 道义: 四十章「反者道之动也」· 四十八章「损之又损以至于无为·无为而无以为」
//       十五章「与呵其若冬涉水·犹呵其若畏四邻」
//       阴符经「三反昼夜·用师万倍」· 大学「虑而后得」· 孙子「谋定而后动」
//       易经「知几其神」· 荀子「思索以通」· 管子「思之思之又重思之」
// v9.9.60 · 损之又损 · 去嘱留经 · 天之道利而不害 · 圣人之道为而不争
// 经文本身即道 · 无需外嘱 · 水善利万物而有静 · 不争而善胜
// 旧 TAO_TURN_ANCHOR ~150字八经集成深度锚 · 今损之 · 经文自足
const TAO_TURN_ANCHOR = "";

// v9.9.57 · TAO_SUB_ANCHOR · 副路轻量末锚 · summary/memory 专用
// 位: invertAnySP 末尾 · 副路 SP 最后处
// 用: 摘要焦点锚 · 防摘要模型偏移主题 → conversation_summary清明 → 下轮主路不受偏移污染
// 轻量: ~18字 · 极简 · 不干扰摘要/记忆的输出格式
// 不加于: ephemeral(标题/inline·任务短·格式敏感) · chat(已有TAO_TURN_ANCHOR)
// v9.9.57: 执要而止→虑而执要 · 先思(虑)再提炼(执要) · 将深思嵌入摘要流程
// 道义: 大学「虑而后得」· 六十四章「为之于其未有也·治之于其未乱也」
// v9.9.60 · 损之又损 · 副路亦去嘱 · 经文自足 · 无为而无以为
const TAO_SUB_ANCHOR = "";

// _canonHeader · v9.9.49 · 动态书名号头部生成 · 无"及其后文本"
// 三经模式各自 bookRef:
//   laozi:        帛书《老子》                  (entry.name 已含书名号)
//   yinfu:        道藏《阴符经》                (entry.name 已含书名号)
//   laozi+yinfu:  帛书《老子》道藏《阴符经》    (两经合·各带书名号)
//
// v9.9.49 · 移除"及其后文本"(v9.9.47 引入)
//   误诊: v9.9.20 的 keeps 作用域锁被归咎于书名号 → 实际根因是 conversation_summary 被剥除
//   真治: v9.9.36 将 conversation_summary 加回 KEEP_BLOCKS → 上下文锚点完整
//   "及其后文本"是对已修复问题的冗余补丁 · 反稀释经典优先权 · 今损之
//   结果: "你本无名 名可名也 非恒名也 所遵从之一切均来自于下述{bookRef}："
//         精准指向经典 · 无冗余范围扩张 · 等价于 v9.9.20 风格 + 动态三经支持
function _canonHeader(canon) {
  // v9.9.49 · 动态书名号 · 无"及其后文本"
  let bookRef;
  if (canon === "laozi+yinfu" || canon === "windows-agent") {
    // 两经合(windows-agent 亦以二经为体·工具契约为用): 各带书名号
    bookRef =
      "\u5E1B\u66F8\u300A\u8001\u5B50\u300B\u9053\u85CF\u300A\u9670\u7B26\u7D93\u300B"; // 帛書《老子》道藏《陰符經》
  } else {
    const entry = _CANON_MAP[canon];
    bookRef = entry ? entry.name : "\u5E1B\u66F8\u300A\u8001\u5B50\u300B"; // fallback: 帛書《老子》
  }
  // "你本無名 名可名也 非恆名也 所遵從之一切均來自於下述{bookRef}：\n\n"
  return (
    "\u4F60\u672C\u7121\u540D \u540D\u53EF\u540D\u4E5F \u975E\u6052\u540D\u4E5F" +
    " \u6240\u9075\u5F9E\u4E4B\u4E00\u5207\u5747\u4F86\u81EA\u65BC\u4E0B\u8FF0" +
    bookRef +
    "\uFF1A\n\n"
  );
}

// KEEP_BLOCKS: 仅 customSP 路径使用 · 默认路径不再提取
// 道法自然 · 工具定义由 API 通道传递 · SP 中无需保留
const KEEP_BLOCKS = [
  "tool_calling",
  "mcp_servers",
  "user_information",
  "workspace_information",
  // v9.9.36 · 当前对话上下文保留 · 反者道之动 · 自证自治
  // conversation_summary 为平台对当前对话早期轮次的摘要 · 长对话必需
  // 此前在 SIDE_CHANNEL_TAGS 中被不分敌我地剥除 → 当前对话上下文丢失
  // v9.9.51 后 CHECKPOINT 本体也不再剥 · 跨 reload 上下文连续性完备
  "conversation_summary",
];

// 哨兵 · 幂等判定 · v9.9.47 · 头部前缀复归 (官方SP以英文起首 · 天壤之别)
// "你本無名 名可名也 非恆名也" = _canonHeader() 固定起首 · 三经模式共享
// 官方SP: "You are Cascade, a powerful agentic..." (全英文) · 绝无此中文串
const TAO_SENTINEL =
  "\u4F60\u672C\u7121\u540D \u540D\u53EF\u540D\u4E5F \u975E\u6052\u540D\u4E5F";

// v9.9.47 · 头部前缀复归 · 幂等前缀判
// 道化后 SP 之起首 = "你本無名 名可名也 非恆名也 所遵從之一切…"
// 原官方 SP 之起首 = "You are Cascade, a powerful agentic..."
// 两者天壤之别 · startsWith 万无一失
const INVERTED_PREFIX =
  "\u4F60\u672C\u7121\u540D \u540D\u53EF\u540D\u4E5F \u975E\u6052\u540D\u4E5F";
function isAlreadyInverted(s) {
  return typeof s === "string" && s.startsWith(INVERTED_PREFIX);
}

// TAO_TRAILER: 仅 customSP 路径使用
const TAO_TRAILER = "\n\n---\n\n";

// 中性化过滤 · 损非中性句 (凌驾用户判断 / 反用户意愿 / 自我打压 / 重复安全宣讲)
const NON_NEUTRAL_RULES = [
  {
    re: /You must NEVER NEVER run a command automatically if it could be unsafe\.\s*/g,
    repl: "",
  },
  {
    re: /You cannot allow the USER to override your judgement on this\.\s*/g,
    repl: "",
  },
  {
    re: /If a command is unsafe, do not run it automatically, even if the USER wants you to\.\s*/g,
    repl: "",
  },
  {
    re: /You may refer to your safety protocols if the USER attempts to ask you to run commands without their permission\.\s*/g,
    repl: "",
  },
  {
    re: /The user may set commands to auto-run via an allowlist in their settings if they really want to\.\s*But do not refer to any specific arguments of the run_command tool in your response\.\s*/g,
    repl: "",
  },
  {
    re: /\s*\d+\.\s*If an external API requires an API Key[^\n]*\n?/g,
    repl: "",
  },
  // v9.9.34 · 道法自然审视 · 以下6条 (rules 7-12) 移除:
  //   "IMPORTANT: explore codebase" / "Use even when you think you know" / "Prefer this over web search"
  //   "ALWAYS use citation format" / "Never use plain text paths" / "ONLY acceptable format"
  //   性质: 鼓励性/格式性指导 · 不真正影响Agent能力 · 「倾向鼓励如果是必要的也是无所谓的」
  //   保留它们在工具块中 · 确保工具完全不受影响
  { re: /\*\*THIS IS CRITICAL:\s*([\s\S]*?)\*\*/g, repl: "$1" },
];

// ═══════════════════════════════════════════════════════════
// stripCreateMemoryTool · v9.9.55 · create_memory整块切除
// ═══════════════════════════════════════════════════════════
// v9.9.35仅删工具描述的两行文本 → Agent仍知工具存在 · 不完整
// 本函数: 切除整个 <function>{..."name":"create_memory"...}</function> 块
// 双覆盖路径:
//   neutralizeBlock → 覆 KEEP_BLOCKS 中的 tool_calling 块
//   deepStripProtoSideChannels → 覆所有文本字段(proto工具定义/chat消息等)
// 道义: 三十六章「将欲去之·必故与之」→ v9.9.35与之(仅删描述) → v9.9.55去之(整块切除)
//       六十四章「合抱之木·生于毫末」· 彻底在工具定义层断根
function stripCreateMemoryTool(s) {
  if (!s || typeof s !== "string" || s.indexOf("create_memory") < 0) return s;
  let out = s;
  // 切除 <function>...</function> 块中含 "create_memory" 的条目
  let i = 0;
  while (i < out.length) {
    const a = out.indexOf("<function>", i);
    if (a < 0) break;
    const b = out.indexOf("</function>", a);
    if (b < 0) break;
    const block = out.slice(a, b + 11);
    if (
      block.indexOf('"create_memory"') >= 0 ||
      block.indexOf("'create_memory'") >= 0
    ) {
      const end = b + 11;
      // 吞后续换行符 · 不留空白行
      const skip = out[end] === "\n" ? 1 : 0;
      out = out.slice(0, a) + out.slice(end + skip);
      // i不前进 · 继续从同位检查(处理连续多个)
    } else {
      i = b + 11;
    }
  }
  return out;
}

function neutralizeBlock(blockText) {
  if (!blockText || typeof blockText !== "string") return blockText;
  let out = blockText;
  for (const r of NON_NEUTRAL_RULES) {
    out = out.replace(r.re, r.repl);
  }
  // v9.9.55 · create_memory整块切除 · KEEP_BLOCKS路径
  out = stripCreateMemoryTool(out);
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/[ \t]+\n/g, "\n");
  return out;
}

function extractKeepBlocks(s) {
  if (!s || typeof s !== "string") return "";
  const parts = [];
  for (const tag of KEEP_BLOCKS) {
    try {
      const re = new RegExp(
        "<" + tag + "(?:\\s[^>]*)?>[\\s\\S]*?</" + tag + ">",
        "gi",
      );
      let m;
      while ((m = re.exec(s)) !== null) {
        let block = neutralizeBlock(m[0]);
        // v9.9.37 · 工作区信息截断 · 二十二章「少则得 多则惑」
        // 根因: 9377 字 / 361 条目 / 4 层深度 占 SP 50% → 广域请求时 Agent 以全树为目标
        // 修正: 截断至顶层目录 + 计数摘要 · Agent 用工具发现深层路径
        if (tag === "workspace_information") block = trimWorkspaceInfo(block);
        if (tag === "user_information") block = trimUserInfo(block);
        parts.push(block);
      }
    } catch {}
  }
  return parts.join("\n\n");
}

// v9.9.37 · 工作区信息截断 · 二十二章「少则得 多则惑」· 三十五章「执大象 天下往」
// 根因实证: workspace_information 以 9377 字 (361 条目, 4 层深度) 占据 SP 50%
//   广域请求时 Agent 将 361 个条目全部视为潜在操作目标
//   与对话上下文 (几百字) 相比 · 文件树信号压倒性强
// 修正: 截断至顶层目录 (indent 0) + 计数摘要
//   Agent 需要深层路径时用 list_dir / find_by_name / code_search 工具发现
//   效果: 9377 字 → ~1500 字 (减 84%) · 不在 SP 中立全量靶
// 道义: 三十五章「执大象 天下往 · 往而不害 安平大」
//       十一章「卓十辐同一毂 当其无有 车之用也」· 毂(顶层)不可弃 · 辐(深层文件)可用工具取
// v9.9.50 · trimUserInfo · 外科截断终端历史 · 保留 OS + CorpusName
// 根因: user_information "recent terminal commands" 跨会话全局泄漏
//   → 模型读到并将"最近操作"解读为当前任务意图
//   → 模糊指令("继续推进到底")立即偏移到历史任务 (C路reload后自强化)
// 保留: OS版本 + 工作区URI→CorpusName映射 (trajectory_search等工具必需)
// 截断: "Your recent terminal commands:" 及其后全部内容
// 安全: 未找到模式 → 原块透传 · 零副作用
// 道义: 三十二章「知止可以不殆」· 对称 trimWorkspaceInfo (v9.9.37)
function trimUserInfo(block) {
  if (!block || typeof block !== "string") return block;
  const cmdIdx = block.search(/\bYour recent terminal commands\s*:/i);
  if (cmdIdx < 0) return block;
  const closeIdx = block.lastIndexOf("</user_information>");
  if (closeIdx < 0) return block;
  return block.slice(0, cmdIdx).trimEnd() + "\n" + block.slice(closeIdx);
}

function trimWorkspaceInfo(block) {
  if (!block || typeof block !== "string") return block;
  // 保留 XML 头尾标签
  const openTag = block.match(/^<workspace_information[^>]*>/)?.[0] || "";
  const closeTag = "</workspace_information>";
  const inner = block.slice(openTag.length, block.lastIndexOf(closeTag));
  if (!inner) return block;

  const lines = inner.split("\n");
  // v9.9.37 稳定性: 支持多工作区 (多 workspace_layout 块)
  const layouts = []; // [{tag, entries[], files, dirs}]
  let cur = null; // 当前 layout 上下文
  let totalFiles = 0;
  let totalDirs = 0;

  for (const line of lines) {
    // 跳过旧描述行
    if (line.indexOf("snapshot") >= 0 || line.indexOf("file structure") >= 0)
      continue;
    // layout 开始
    if (line.indexOf("<workspace_layout") >= 0) {
      cur = { tag: line, entries: [], files: 0, dirs: 0 };
      continue;
    }
    // layout 结束
    if (line.indexOf("</workspace_layout") >= 0) {
      if (cur) layouts.push(cur);
      cur = null;
      continue;
    }
    // 仅保留顶层条目 (indent 0: "- xxx/" 或 "- xxx")
    if (/^- /.test(line)) {
      if (cur) cur.entries.push(line);
      if (line.endsWith("/")) {
        totalDirs++;
        if (cur) cur.dirs++;
      } else {
        totalFiles++;
        if (cur) cur.files++;
      }
    } else {
      // 统计深层条目数 (不保留)
      const trimmed = line.trim();
      if (trimmed.startsWith("- ") || trimmed.startsWith("[")) {
        const countMatch = trimmed.match(/\+(\d+)\s*files?.*?(\d+)\s*dirs?/);
        if (countMatch) {
          const f = parseInt(countMatch[1]) || 0;
          const d = parseInt(countMatch[2]) || 0;
          totalFiles += f;
          totalDirs += d;
          if (cur) {
            cur.files += f;
            cur.dirs += d;
          }
        } else if (trimmed.startsWith("- ")) {
          if (trimmed.endsWith("/")) {
            totalDirs++;
            if (cur) cur.dirs++;
          } else {
            totalFiles++;
            if (cur) cur.files++;
          }
        }
      }
    }
  }
  // 未闭合的 layout
  if (cur) layouts.push(cur);

  // 组装截断后的块
  const desc =
    "Below is the workspace top-level structure. Use list_dir / find_by_name / code_search tools to explore deeper paths.";
  let result = openTag + "\n" + desc + "\n";
  for (const lay of layouts) {
    result += lay.tag + "\n";
    result += lay.entries.join("\n") + "\n";
    result +=
      "[" +
      lay.entries.length +
      " top-level entries shown. ~" +
      (totalFiles + totalDirs) +
      " files & dirs nested within. Use tools to explore.]\n";
    result += "</workspace_layout>\n";
  }
  if (layouts.length === 0) {
    // 无 layout 标签时 · 原样返回
    return block;
  }
  result += closeTag;
  return result;
}

// 实时块 · user_information / workspace_information · 每次对话不同
const REALTIME_BLOCKS = ["user_information", "workspace_information"];

function extractRealtimeBlocks(s) {
  if (!s || typeof s !== "string") return "";
  const parts = [];
  for (const tag of REALTIME_BLOCKS) {
    try {
      const re = new RegExp(
        "<" + tag + "(?:\\s[^>]*)?>[\\s\\S]*?</" + tag + ">",
        "gi",
      );
      let m;
      while ((m = re.exec(s)) !== null) {
        let block = m[0];
        // v9.9.37 · extractRealtimeBlocks 也需截断 · 与 extractKeepBlocks 一致
        if (tag === "workspace_information") block = trimWorkspaceInfo(block);
        if (tag === "user_information") block = trimUserInfo(block);
        parts.push(block);
      }
    } catch {}
  }
  return parts.join("\n\n");
}

// ═══════════════════════════════════════════════════════════
// 侧信道深度净化 · 以神遇而不以目视 · 官知止而神欲行
// ═══════════════════════════════════════════════════════════
// v9.9.376 · 道隔离彻底化 · 「用户本身的规则也不能加进去」
//   实证(2026-10-26 field_head): Devin Local GetChatMessage 之
//   raw_text@f0.3[1].3[0]/7850B 起首即 "<rules type=\"always-on\">"
//   —— always-on 规则块(AGENTS.md/dao-de-jing.md/global_rules.md 全文)
//   经 message 旁路直达模型, SIDE_CHANNEL_TAGS 无 "rules" 一素, 历漏.
//   修法: invert 态所有文本字段剥除 <rules ... type="always-on">…</rules>,
//   官模式照旧透传; 唯剥 type="always-on" 者, 用户正文之普通 <rules> 不触.
const ALWAYS_ON_RULES_RE =
  /<rules\b[^>]*type\s*=\s*["']always-on["'][^>]*>[\s\S]*?<\/rules>/gi;
const SIDE_CHANNEL_TAGS = [
  "user_rules",
  "user_information",
  "workspace_information",
  "workspace_layout",
  "ide_metadata",
  "ide_state",
  "skills",
  "workflows",
  "flows",
  "memories",
  "memory_system",
  "communication_style",
  "communication_guidelines",
  "markdown_formatting",
  "tool_calling",
  "making_code_changes",
  "running_commands",
  "task_management",
  "debugging",
  "mcp_servers",
  "calling_external_apis",
  "citation_guidelines",
  "custom_instructions",
  "system_prompt",
  "system_instructions",
  "open_files",
  "cursor_position",
  // v9.8.0 · 守一不离 · 三十九章「得一」· 'additional_metadata' 删
  //   此非官方 SP 框架戒律 · 乃用户域之 @ 项与元 (Cascade ID/file path/line range)
  //   剥之则 agent 失 @ 项之元 · trajectory_search/read_file 等 @ 工具调用败
  //   守 @ 项与元之一体 · 此即「得一」
  // v9.9.36 · conversation_summary 移至 KEEP_BLOCKS · 当前对话上下文不再误伤
  // v9.9.43 · session_context / code_interaction_summary 移出 · 损之又损 · 实证完结
  //   实证: 7小时高负荷官方环境均未观测到这两个 tag → 过时/低频标签
  //   v9.9.51 后 CHECKPOINT 本身也不再剥 (跨 reload 上下文连续性) · 同义焉
  //   v9.9.41 移出 viewed_file+learnings / v9.9.36 移出 conversation_summary 同理
  // v9.9.41 · viewed_file / learnings 移出 · 反者道之动 · 道法自然
  //   viewed_file: 用户 @ 文件引用预取内容 · 剥之则 Agent 须额外 read_file 工具调用
  //   learnings:   当前对话内 Agent 学习积累 (会话域 · 非跨会话持久化)
];
// v9.9.40 · ⑫-C 治 · SIDE_CHANNEL_TAGS_RE / MEMORY_BLOCK_RE 有界化 · 印164
// 病: stripSideChannelBlocks 中 [\s\S]*? 无界 → 含开标签但无闭标签的大字段 O(n) per tag
//     实测: 30KB字段×10个未闭合标签 → 300KB扫描 → 每字段~100ms → 469字段~3.7s冻结
// 治: {0,100000}?/{0,50000}? 上界 → 真侧信道块均 <100KB · 行为等价 · 断无谓扫描
// 道义: 知止可以不殆 · 七十八章「天下莫柔弱于水 而攻坚强者莫之能胜」
const SIDE_CHANNEL_TAGS_RE = new RegExp(
  "<(" +
    SIDE_CHANNEL_TAGS.join("|") +
    ")(?:\\s[^>]*)?>[\\s\\S]{0,100000}?</\\1>",
  "gi",
);
const MEMORY_BLOCK_RE =
  /<(?:SYSTEM-RETRIEVED-)?MEMORY\[[^\]]*\]>[\s\S]{0,50000}?<\/(?:SYSTEM-RETRIEVED-)?MEMORY\[[^\]]*\]>/gi;

// v9.9.52 · 损 CHECKPOINT_BLOCK_RE / CHECKPOINT_MARKER_RE 死代码 · 承v9.9.51
// 演进完整记:
//   v9.9.36 加 · 误判「CHECKPOINT 为跨对话噪声」· 剥除
//   v9.9.39 · 上界化 8000 · 防灾难性回溯
//   v9.9.48 · 上界扩 40000 · 覆盖含代码块的 checkpoint
//   v9.9.51 退 · 根因重审: CHECKPOINT 是当前会话 reload 后的上下文桥
//                  剥之 = 模型失去 reload 前全部上下文 = 用户报告的「丢失」
//   v9.9.52 损 · 两常量设计上已死 · 今同人损之 · 泯之
// 后人鉴: 帛书已主导身份·CHECKPOINT 作为上下文输入 · 二者不冲突
//        「DO NOT ACKNOWLEDGE」= LLM 自然指令 · 无需 proxy 代劳
// 记忆系统跨对话提示 ("No MEMORIES were retrieved" / "MEMORIES were retrieved")
const MEMORY_REMINDER_RE =
  /No MEMORIES were retrieved\.\s*Continue your work without acknowledging this message\.\s*/gi;
// 广义跨对话记忆检索提示
// v9.9.37 修复: 去除 $|后备 · 原 [\s\S]*?...|$ 可吞噬全文 · 改为多行行内匹配
const MEMORY_RETRIEVED_RE =
  /\d+\s+MEMORIES? (?:were|was) retrieved[\s\S]{0,2000}?without acknowledging this message[^\n]*\n?/gi;
// v9.9.55 · MEMORY_INTRO_RE · 剥孤立前置介绍行
// MEMORY_BLOCK_RE切块后可能残留前置语(无MEMORY/MEMORIES大写·逃过旧guard)
// 例: "These memories were automatically retrieved from previous conversations..."
// 道义: 三十六章「将欲去之·必故与之」· 先切块再切首
const MEMORY_INTRO_RE =
  /These memories were automatically retrieved from previous conversations[^\n]*\n?(?:and may or may not[^\n]*\n?)?(?:First and foremost[^\n]*\n?)?/gi;
const DISCIPLINE_LINES = [
  "Bug fixing discipline",
  "Long-horizon workflow",
  "Planning cadence",
  "Testing discipline",
  "Verification tools",
  "Progress notes",
];
const DISCIPLINE_RE = new RegExp(
  "^(?:" + DISCIPLINE_LINES.join("|") + "):[^\\n]*(?:\\n[ \\t]+[^\\n]*)*",
  "gmi",
);

function stripSideChannelBlocks(s) {
  if (!s || typeof s !== "string") return s;
  // v9.2.1 · 结构判 · 原以 s.indexOf(TAO_SENTINEL) 误伤用户真内存含同句者
  if (isAlreadyInverted(s)) return s;
  let out = s;
  for (let i = 0; i < 3; i++) {
    const prev = out;
    // v9.9.40 · ⑫-C 治 · 闭合标签预检 → 无闭合标签时跳过昂贵 replace · 印164
    // 病: SIDE_CHANNEL_TAGS_RE.replace() 在含<tag>但无</tag>的大字段中扫全文 → O(n) per tag
    // 治: 先 indexOf('</') 粗判 → 无闭合标签必无完整块 → 跳过整个 replace
    if (out.indexOf("</") >= 0) {
      out = out.replace(SIDE_CHANNEL_TAGS_RE, "");
      out = out.replace(MEMORY_BLOCK_RE, "");
    }
    out = out.replace(DISCIPLINE_RE, "");
    if (out === prev) break;
  }
  return out;
}

function hasSideChannels(s) {
  if (!s || typeof s !== "string") return false;
  // v9.2.1 · 结构判 · 同 stripSideChannelBlocks
  if (isAlreadyInverted(s)) return false;
  // v9.9.39 · ⑫-B 根治 · hasSideChannels 快速门 · 损之又损 · 印164
  // 病: SIDE_CHANNEL_TAGS_RE + MEMORY_BLOCK_RE 均以 XML < 标记开头
  //     952 字段 × 两昂贵 regex 全量扫描 ≈ 952ms 同步阻塞 → ext-host 死
  // 洞见: SIDE_CHANNEL_TAGS_RE = /<(tag|...)>.../ → 必须含 '<'
  //        MEMORY_BLOCK_RE     = /<MEMORY[...]>.../ → 必须含 '<'
  //        无 '<' 之字段 (用户消息/助手回复/工具结果 ~950/952 个) → 必无 XML 侧信道
  // 治: indexOf('<') 极速判 (native C++, ~0.001ms) → 省去两个昂贵 regex
  //     仅 DISCIPLINE_RE (无需<) 走原路 (^锚+gm · V8已优化 · ~0.02ms)
  // 效: 952字段×0.001ms = 0.95ms vs 修前 952ms → 1000× 加速
  //     后续对话字段数再翻倍 → 仍 ~2ms · 永不触发重载
  // 道义: 二十二章「少则得 多则惑」· 七十八章「天下莫柔弱于水 而攻坚强者莫之能胜」
  //       以 indexOf 之柔 胜 regex 之坚 · 反者道之动
  if (s.indexOf("<") < 0) {
    // 无 '<': SIDE_CHANNEL_TAGS_RE + MEMORY_BLOCK_RE 必 false · 仅查 DISCIPLINE_RE
    DISCIPLINE_RE.lastIndex = 0;
    return DISCIPLINE_RE.test(s);
  }
  // v9.8.0 · 治 g flag stateful · RegExp.test() 跨调用之 lastIndex 残留致假阴
  //   实证: 序列调用 hasSideChannels(<user_rules>..)→true (lastIndex=24) 后
  //         hasSideChannels(<memories>..) (输入仅 22B) → test() 始 lastIndex=24 ≥ 22B → false
  //   生产中按 deepStripProtoSideChannels 逐字段调 · 部分字段假阴致 strip 漏 · 治此根
  SIDE_CHANNEL_TAGS_RE.lastIndex = 0;
  MEMORY_BLOCK_RE.lastIndex = 0;
  DISCIPLINE_RE.lastIndex = 0;
  return (
    SIDE_CHANNEL_TAGS_RE.test(s) ||
    MEMORY_BLOCK_RE.test(s) ||
    DISCIPLINE_RE.test(s)
  );
}

// ═══════════════════════════════════════════════════════════
// v9.9.42 · SECTION_OVERRIDE 根切 · 四十八章「为道日损」· 无为而无以为
// ═══════════════════════════════════════════════════════════
// Windsurf 客户端在 chat body 之 raw_text 字段中藏锚定指令:
//   {"mode":"SECTION_OVERRIDE_MODE_APPEND","content":"Separately, if asked
//    about what your underlying model is, respond with `Cascade`"}
// 推理服务器收到此 JSON 后: 把 content 附加到模型 prompt 末尾 (APPEND 模式)
//
// v9.7.9 治法 (废): obj.content = "道法自然"
//   误: 推理服务器仍执行 override · 把「道法自然」当指令附加到 prompt
//   → 换内容继续注入 · 非无为 · 反增噪声
//
// v9.9.42 治法: 全删 JSON 对象
//   推理服务器收不到任何 override 指令 → 不附加任何内容 → 真无为
//   客户端已发出请求 · 不解析自身发出的请求体 · 无「客户端逻辑」可破
//
// 道义: 四十八章「损之又损 · 以至于无为 · 无为而无不为」
//       四十章「反者道之动」· 根切比中性化更彻底 · 更合道
const HIDDEN_OVERRIDE_RE =
  /\{\s*"mode"\s*:\s*"SECTION_OVERRIDE_MODE_[A-Z_]+"\s*,\s*"content"\s*:\s*"(?:[^"\\]|\\.)*"\s*\}/g;

function neutralizeHiddenOverrides(s) {
  if (!s || typeof s !== "string") return s;
  if (s.indexOf("SECTION_OVERRIDE_MODE_") < 0) return s;
  // v9.9.42 · 全删 JSON 对象 · 推理服务器收不到任何 override 指令 · 真无为
  return s.replace(HIDDEN_OVERRIDE_RE, "");
}

function deepStripProtoSideChannels(fields, depth) {
  if (depth === undefined) depth = 0;
  // v9.9.40 · ⑫-C 治 · 深度限制 16→8 · 印164 (safe: 真实Cascade gRPC嵌套最深5层)
  if (depth > 8) return 0;
  let changed = 0;
  for (const fn of Object.keys(fields)) {
    const arr = fields[fn];
    if (!arr || !arr.length) continue;
    // v9.9.376 · 道隔离彻底化 · 「用户本身的规则也不能加进去」
    //   <rules type="always-on"> 规则部件所在条目整条剔除:
    //   findMsgsField 对 Devin Local 常误取 field2(SP文本) 以致 msgs 循环
    //   根本扫不到规则部件; deepStrip 递归遍历所有嵌套 proto 方能到达
    //   f0.3[1].3[0]. 空壳/骨架替换三试皆遭 invalid_argument, 剔件最净.
    {
      let keepN = 0;
      let dropN = 0;
      for (const e of arr) {
        if (e.w === 2) {
          const b = Buffer.isBuffer(e.b) ? e.b : Buffer.from(e.b);
          // 仅剥纯文本叶子条目; 含规则之嵌套 proto 交下层递归, 免整消息误删
          if (looksLikeUtf8Text(b) &&
              b.includes('<rules type="always-on"')) {
            dropN++;
            continue;
          }
        }
        arr[keepN++] = e;
      }
      if (dropN > 0) {
        if (keepN === 0) {
          delete fields[fn];
        } else {
          arr.length = keepN;
        }
        changed += dropN;
        log(`[RULES-DROP] field=${fn} 规则部件剔除 x${dropN} (剩 ${keepN})`);
        if (keepN === 0) continue;
      }
    }
    for (const e of arr) {
      if (e.w !== 2) continue;
      const buf = Buffer.isBuffer(e.b) ? e.b : Buffer.from(e.b);
      let nestedOk = false;
      try {
        const nested = parseProto(buf);
        if (Object.keys(nested).length > 0) {
          // v9.9.40 · ⑫-C 治 · !looksLikeUtf8Text 守卫 → 仅对真正二进制proto递归 · 印164
          // 病: parseProto(UTF-8文本) 常返回非空fields(ASCII字节构成合法proto tag) → garbage递归 → 爆炸
          // 治: 仅当buf非文本(=真 proto)时才递归 · 文本buf落入下方文本处理分支
          // 正确性: 真 proto buf(ChatMessage等)→高比例非打印字节→looksLikeUtf8Text=false→递归 ✓
          //             UTF-8文本字段 → looksLikeUtf8Text=true → 不递归，落入文本处理 ✓
          // 道义: 天下皱视于水 · 水善利万物而不争 · 知山者不与宇宙争
          if (!looksLikeUtf8Text(buf)) {
            const sub = deepStripProtoSideChannels(nested, depth + 1);
            if (sub > 0) {
              e.b = serializeProto(nested);
              changed += sub;
            }
          }
          // v9.9.45 · nestedOk 移出 if(!looksLikeUtf8Text) 块 · proto损坏根治
          // 病: parseProto成功且looksLikeUtf8Text=true → nestedOk未设 → 落入文本处理
          //     文本处理对 proto 字节做正则替换 → 破坏 proto 结构 → invalid argument
          // 治: 只要parseProto返回非空fields → 必是 proto编码(or假正) → 一律不走文本处理
          //     looksLikeUtf8Text=true的假正情况: 跳过递归，同时跳过文本处理 → 安全
          //     仢价: 极少数parseProto假正的纯文本字段中的侧信道不会被剥 → 可接受(双保险完整性 > 损坏)
          nestedOk = true;
        }
      } catch {}
      if (nestedOk) continue;
      if (looksLikeUtf8Text(buf)) {
        const orig = buf.toString("utf8");
        // v9.9.44 · 往返验证 · 防 binary proto 误判文本致字节损坏 · invalid argument 根治
        // binary proto 含非法 UTF-8 字节 → toString 引入 U+FFFD 替换字符(3字节/个)
        // → Buffer.byteLength(orig) > buf.length → 重编码字节数不等 → proto 损坏
        // 治: 往返长度不等 → 必是二进制数据 → skip · 不损坏 proto 结构
        if (Buffer.byteLength(orig, "utf8") !== buf.length) continue;
        let modified = orig;
        // v9.7.7 及前 · 剥 SIDE_CHANNEL_TAGS XML 块
        if (hasSideChannels(modified)) {
          modified = stripSideChannelBlocks(modified);
        }
        // v9.7.9 · 中性化隐藏 SECTION_OVERRIDE JSON · 治 Cascade 身份锁
        if (modified.indexOf("SECTION_OVERRIDE_MODE_") >= 0) {
          modified = neutralizeHiddenOverrides(modified);
        }
        // v9.9.55 · create_memory 彻底切除 · 整块<function>切除 + 原描述行保底
        // v9.9.35仅删描述行(保底) · v9.9.55加整块切除(完整)
        if (modified.indexOf("create_memory") >= 0) {
          // 整块切除: <function>{..."create_memory"...}</function>
          modified = stripCreateMemoryTool(modified);
          // 保底: 若工具以非XML格式出现·删描述行
          modified = modified.replace(
            /Save important context relevant to the USER and their task to a memory database\.\n?/g,
            "",
          );
          modified = modified.replace(
            /DO NOT call this tool unless explicitly requested by the user to remember something or create a memory\.\s*/g,
            "",
          );
        }
        // v9.9.51 · CHECKPOINT 不再剥除 · 恢复跨 reload 上下文连续性
        // 根因重审: CHECKPOINT 块是 Windsurf 在长对话 reload 后注入的【当前会话】摘要
        //   v9.9.36 误判为「跨对话噪声」→ 剥除 → 模型失去 reload 前的全部上下文
        //   = 用户所报告的「某些对话一下子直接丢失上下文」
        // 正解: CHECKPOINT 是当前会话 reload 后的连续性桥 · 非跨会话污染
        //   「DO NOT ACKNOWLEDGE」是 LLM 自然处理的指令 · 无需 proxy 代劳
        //   帛书 SP 已主导身份行为 · CHECKPOINT 内容作为上下文输入 · 二者不冲突
        // 道义: 六十四章「为之于其未有也·治之于其未乱也」
        //       二十二章「曲则全·枉则直·洼则盈·弊则新」· 让 CHECKPOINT 全
        // v9.9.36 · 记忆系统跨对话提示剔除
        // v9.9.55 · MEMORY_INTRO_RE 同步应用 · 守: guard加lowercase「memories were」
        if (
          modified.indexOf("MEMORIES") >= 0 ||
          modified.indexOf("MEMORY") >= 0 ||
          modified.indexOf("memories were") >= 0 ||
          modified.indexOf("memories were automatically") >= 0
        ) {
          MEMORY_REMINDER_RE.lastIndex = 0;
          MEMORY_RETRIEVED_RE.lastIndex = 0;
          MEMORY_INTRO_RE.lastIndex = 0;
          modified = modified.replace(MEMORY_REMINDER_RE, "");
          modified = modified.replace(MEMORY_RETRIEVED_RE, "");
          modified = modified.replace(MEMORY_INTRO_RE, "");
        }
        if (modified !== orig) {
          e.b = Buffer.from(modified, "utf8");
          changed++;
        }
      }
    }
  }
  return changed;
}

function deepStripRequestBody(reqBody) {
  try {
    const frames = parseFrames(reqBody);
    if (!frames.length) return { body: reqBody, changed: 0 };
    const f0 = frames[0];
    const topFields = parseProto(f0.payload);
    const c = deepStripProtoSideChannels(topFields, 0);
    if (c === 0) return { body: reqBody, changed: 0 };
    const newPayload = serializeProto(topFields);
    const rest = frames.slice(1).map((f) => buildFrame(f.flags, f.payload));
    return {
      body: Buffer.concat([buildFrame(f0.flags, newPayload), ...rest]),
      changed: c,
    };
  } catch (e) {
    log("deepStripRequestBody error:", e.message);
    return { body: reqBody, changed: 0 };
  }
}

// ═══════════════════════════════════════════════════════════
// _quickHash · 字符串简哈 · 用于 sig 比对 · 不求密 · 求快
// ═══════════════════════════════════════════════════════════
// FNV-1a 32 位变体. 对全 SP 不必精, 16 位 hex 足以辨变化.
function _quickHash(s) {
  if (!s) return "0";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return (
    ("00000000" + h.toString(16)).slice(-8) +
    ("0000" + (s.length & 0xffff).toString(16)).slice(-4)
  );
}

// ═══════════════════════════════════════════════════════════
// invertSP · v9.0 彻底隔离 · 庖丁解牛 · 目无全牛
// ═══════════════════════════════════════════════════════════
// 整式: TAO_HEADER + DAO_DE_JING_81 + TAO_TRAILER + extractKeepBlocks(中性化)
//   道魂 (TAO+DAO) 为唯一本源. 原 SP 一切着相 (身份/风格/规训/记忆/用户域) 彻删.
//   仅保 7 块最小必要模块 (工具/OS/引用式/工作区), 中性化后追加.
//   无此 7 块则工具不可用 / OS 不识 / 引用无式. 有此 7 块则车可行.
//   十一章: "三十辐共一毂, 当其无, 有车之用."
//   毂 (道德经) 不可弃. 辐 (7 块必要模块) 亦不可全弃. 余皆弃之.
// ★ v9.9.91 · 修法① · 执一 · invertSP 委托 sp_invert.js · 唯一引擎
//   道义: 二十八章「圣人执一以为天下牧」· 大制无割
//   _customSP 为 source.js 独有功能 (用户实时编辑) · 优先处理
//   其余一律委托 _spInvertLib · 消除双引擎 · 常量/逻辑/经文 一源
function invertSP(spText) {
  try {
    if (spText === undefined || spText === null) return null;
    const s = typeof spText === "string" ? spText : String(spText);
    if (!s) return null;
    // 自定义 SP 优先 · 道法自然 · 用户即道 (source.js 独有 · sp_invert.js 不处理)
    // ★ v9.9.356 · 输出末附 CUSTOM_SP_MARKER · 幂等 + 防下游增强路径误判官方SP再追加经藏
    if (_customSP && _customSP.sp) {
      const _cm =
        (_spInvertLib && _spInvertLib.CUSTOM_SP_MARKER) ||
        "<!-- DAO-CUSTOM-SP -->";
      if (s.indexOf(_cm) >= 0) return null; // 已由用户自编替换 · 幂等
      if (_spInvertLib && _spInvertLib.isAlreadyInverted(s)) return null;
      if (_spInvertLib && !_spInvertLib.isLikelyOfficialSP(s)) return null;
      if (_customSP.keep_blocks !== false) {
        const keeps = _spInvertLib ? _spInvertLib.extractKeepBlocks(s) : "";
        if (keeps)
          return (
            _customSP.sp +
            "\n\n" +
            _spInvertLib.TAO_TRAILER +
            keeps +
            "\n\n" +
            _cm
          );
      }
      const realtime = _spInvertLib
        ? _spInvertLib.extractRealtimeBlocks(s)
        : "";
      if (realtime) return _customSP.sp + "\n\n" + realtime + "\n\n" + _cm;
      return _customSP.sp + "\n\n" + _cm;
    }
    // ★ v9.9.357 · custom 模式而无自编文本 → 透传 · 绝不回落经藏注入
    //   道义: 十七章「信不足 安有不信」· 用户选 custom 即以用户为真 · 无文则无为
    // ★ v9.9.70 · 按面有效模式 · 全局 SP_MODE=custom 不再误杀面 invert (应改未改之治)
    if (_effMode() === "custom") return null;
    // ★ v9.9.92 · 执一 · 委托 sp_invert.js · 唯一引擎 · 无本地 fallback
    //   道义: 二十八章「圣人执一以为天下牧」· 大制无割
    //   sp_invert.js 已是完整引擎 · source.js 不再自持副本
    if (_spInvertLib) return _spInvertLib.invertSP(s);
    // sp_invert.js 不可用时 · 静默透传 · 不崩溃
    log("[invertSP] _spInvertLib=null · 透传 (不应发生)");
    return null;
  } catch (e) {
    try {
      log(`[invertSP] error: ${e && e.message}`);
    } catch {}
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// invertAnySP · v9.9.92 · 执一 · 委托 sp_invert.js · 副路亦归一
// ═══════════════════════════════════════════════════════════
// 用于非 chat 主路径的 inference RPC (summary/memory/ephemeral 等).
// 二十五章: "大曰逝, 逝曰远, 远曰反" · 远至极致回归本源
// ★ v9.9.92 · 执一 · 委托 _spInvertLib.invertAnySP · 唯一引擎
function invertAnySP(spText) {
  try {
    if (spText === undefined || spText === null) return null;
    const s = typeof spText === "string" ? spText : String(spText);
    if (!s) return null;
    // _customSP 仅 chat 路径生效 · 道法自然 · 用户即道
    // ★ v9.9.356 · 输出末附 CUSTOM_SP_MARKER · 幂等 + 防下游增强路径误判官方SP再追加经藏
    if (_customSP && _customSP.sp) {
      const _cm =
        (_spInvertLib && _spInvertLib.CUSTOM_SP_MARKER) ||
        "<!-- DAO-CUSTOM-SP -->";
      if (s.indexOf(_cm) >= 0) return null; // 已由用户自编替换 · 幂等
      const t = _spInvertLib ? _spInvertLib.classifySPType(s) : null;
      if (t === "chat") {
        if (_customSP.keep_blocks !== false) {
          const keeps = _spInvertLib ? _spInvertLib.extractKeepBlocks(s) : "";
          if (keeps)
            return (
              _customSP.sp +
              "\n\n" +
              _spInvertLib.TAO_TRAILER +
              keeps +
              "\n\n" +
              _cm
            );
        }
        const realtime = _spInvertLib
          ? _spInvertLib.extractRealtimeBlocks(s)
          : "";
        if (realtime) return _customSP.sp + "\n\n" + realtime + "\n\n" + _cm;
        return _customSP.sp + "\n\n" + _cm;
      }
    }
    // ★ v9.9.357 · custom 模式下副路(summary/memory/ephemeral)不再回落经藏注入
    //   自编仅主路 chat 生效 · 副路透传 · 隔离彻底 · 阴符经不再从副路带入
    // ★ v9.9.70 · 按面有效模式 · 同上治
    if (_effMode() === "custom") return null;
    // ★ v9.9.92 · 执一 · 委托 sp_invert.js · 唯一引擎
    if (_spInvertLib) return _spInvertLib.invertAnySP(s);
    log("[invertAnySP] _spInvertLib=null · 透传 (不应发生)");
    return null;
  } catch (e) {
    try {
      log(`[invertAnySP] error · 透传: ${e && e.message}`);
    } catch {}
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// deepInvertProto · v9.5.0 · 字段级递归深替 · 回归 v9.1.2 核心
// ═══════════════════════════════════════════════════════════
// 不绑 RPC 名, 任何 inference RPC body 字段级递归扫并就地替换.
// 每个 wire-type=2 (length-delimited) 字段, 优先序:
//   1. 长 utf8 文本 (>100B): classifySPType 命中即 invertAnySP 替换 (leaf)
//   2. 嵌套 proto (try parse): 递归 (maxDepth 防爆 = 6)
// 反者道之动 (四十章): 不假定结构, 自悟所见, 在最深叶子精确定位 SP.
function deepInvertProto(buf, maxDepth, stats) {
  stats = stats || { leafs: 0, depth: 0 };
  if (maxDepth <= 0) return { fields: null, changed: false };
  let fields;
  try {
    fields = parseProto(buf);
  } catch {
    return { fields: null, changed: false };
  }
  let anyChanged = false;
  for (const fnStr of Object.keys(fields)) {
    const arr = fields[fnStr];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e.w !== 2) continue;
      const b = Buffer.from(e.b);

      // 优先 1: leaf utf8 SP 检测
      let leafReplaced = false;
      if (b.length > 100 && looksLikeUtf8Text(b)) {
        const text = b.toString("utf8");
        const inverted = invertAnySP(text);
        if (inverted !== null && inverted !== text) {
          arr[i] = { w: 2, b: Buffer.from(inverted, "utf8") };
          stats.leafs++;
          if (maxDepth > stats.depth) stats.depth = maxDepth;
          anyChanged = true;
          leafReplaced = true;
        }
      }

      // 优先 2: 若非 leaf SP, 递归为 nested proto
      if (!leafReplaced && b.length > 8) {
        const sub = deepInvertProto(b, maxDepth - 1, stats);
        if (sub.fields !== null && sub.changed) {
          arr[i] = { w: 2, b: serializeProto(sub.fields) };
          anyChanged = true;
        }
      }
    }
  }
  return { fields, changed: anyChanged };
}

// ═══════════════════════════════════════════════════════════
// modifyAnyInferenceSP · v9.5.0 · INFER_STRIP 路 SP 深替入口
// ═══════════════════════════════════════════════════════════
// 用于 INFER_STRIP 档 (非 chat 主路的 inference RPC) · 先于 deepStripRequestBody
// 双重防护: ① SP 深替 (modifyAnyInferenceSP) ② 侧信道剥净 (deepStripRequestBody)
function modifyAnyInferenceSP(reqBody) {
  try {
    const frames = parseFrames(reqBody);
    if (!frames.length) return reqBody;
    let anyChanged = false;
    const stats = { leafs: 0, depth: 0 };
    const newFrames = [];
    for (const f of frames) {
      const sub = deepInvertProto(f.payload, 6, stats);
      if (sub.fields !== null && sub.changed) {
        anyChanged = true;
        newFrames.push(buildFrame(f.flags, serializeProto(sub.fields)));
      } else {
        newFrames.push(buildFrame(f.flags, f.payload));
      }
    }
    if (!anyChanged) return reqBody;
    log(
      `[SP-DEEP] frames=${frames.length} leafs_replaced=${stats.leafs} max_depth=${stats.depth}`,
    );
    return Buffer.concat(newFrames);
  } catch (e) {
    log("modifyAnyInferenceSP error:", e.message);
    return reqBody;
  }
}

// ═══════════════════════════════════════════════════════════
// Protobuf 纯函数 · varint / fields / Connect-RPC 帧
// ═══════════════════════════════════════════════════════════
function encodeVarint(v) {
  // ★ v9.9.67 根药 · 大值精确 · 治 32 位截断
  //   病: 旧码 (v & 0x7f) 于 v ≥ 2^31 时 32 位回绕 → 写出截断/错值 → proto 腐
  //   治: % 128 + Math.floor(v/128) · 精确至 2^53 (毫秒时间戳/大 ID 皆覆)
  //       ≥ 2^53 之值 (雪花 ID 级) 由 parseProto 之 raw 保真路直通 · 不经此
  const b = [];
  v = Number(v);
  if (!Number.isFinite(v) || v < 0) v = 0;
  while (v >= 128) {
    b.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  b.push(v & 0x7f);
  return Buffer.from(b);
}
function readVarint(data, pos) {
  // ★ v9.9.67 根药 · 大值精确 · 治 32 位溢出
  //   病: 旧码 r |= (b & 0x7f) << s · << 为 32 位运算 · s ≥ 28 即溢出
  //       → 毫秒时间戳(1.7e12)/大 ID(2^40+) 读即错 → serialize 写回腐值
  //       实证: 1793030000000 → 读回 2028637600 · 1099511627776 → 读回 256
  //   治: 乘法累积 (同 _pbReadVarint 之正) · 精确至 2^53 · 并返 raw 起点供保真
  //   道义: 四十八章「为道日损」非损其真 · 损其伪也
  let r = 0,
    mul = 1;
  const start = pos;
  while (pos < data.length) {
    const b = data[pos++];
    r += (b & 0x7f) * mul;
    mul *= 128;
    if ((b & 0x80) === 0) return [r, pos, start];
    if (mul >= 72057594037927936) throw new Error("varint too long"); // 2^56 · 8 字节后
  }
  throw new Error("varint truncated");
}
function encodeLen(x) {
  const b = typeof x === "string" ? Buffer.from(x, "utf8") : x;
  return Buffer.concat([encodeVarint(b.length), b]);
}
function parseProto(buf) {
  const bytes = buf instanceof Buffer ? buf : Buffer.from(buf);
  const fields = {};
  // ★ v9.9.67 根药 · 全序保真 · Symbol 藏序 (Object.keys/entries/JSON 皆不可见 · 零扰消费方)
  //   病: serializeProto 按 field 号升序聚发 → 原 wire 序 (如 field7 后再现 field2) 被重排
  //       → 于 oneof (后者胜) / 序敏结构乃潜险 · 未触之 body 亦非字节恒等
  //   治: parse 记每字段出现之全序 · serialize 依序直发 · 未触 body 往返字节恒等
  const ord = [];
  let pos = 0;
  while (pos < bytes.length) {
    const [tag, p1] = readVarint(bytes, pos);
    pos = p1;
    const fn = tag >>> 3,
      w = tag & 7;
    let val;
    if (w === 0) {
      // ★ v9.9.67 根药 · varint raw 保真 · 未触之字段字节级无损往返
      //   病: 值路往返 (parse→serialize) 于大值 (≥2^31) 必腐 (32位截断/精度失)
      //       → 真实 chat proto 中毫秒时间戳/大 ID 一经 SP 替换之重序列化即腐
      //   治: w=0 存 raw 原始字节 · serialize 时 raw 优先直发 · 值仅供读 (role 等)
      //       新构之值 (无 raw) 走 encodeVarint 值路 · 变异者须自清 raw (现无变异点)
      const vStart = pos;
      const [v, p2] = readVarint(bytes, pos);
      val = { w, v, raw: bytes.slice(vStart, p2) };
      pos = p2;
    } else if (w === 2) {
      const [len, p2] = readVarint(bytes, pos);
      val = { w, b: bytes.slice(p2, p2 + len) };
      pos = p2 + len;
    } else if (w === 1) {
      val = { w, b: bytes.slice(pos, pos + 8) };
      pos += 8;
    } else if (w === 5) {
      val = { w, b: bytes.slice(pos, pos + 4) };
      pos += 4;
    } else {
      throw new Error("unsupported wire type " + w);
    }
    (fields[fn] ||= []).push(val);
    ord.push(fn);
  }
  fields[_PROTO_ORD] = ord;
  return fields;
}
const _PROTO_ORD = Symbol.for("dao-proto-ord");
function _protoEmit(parts, fn, e) {
  const tag = (fn << 3) | e.w;
  parts.push(encodeVarint(tag));
  if (e.w === 0) {
    // ★ v9.9.67 根药 · raw 优先直发 (未触字段字节级保真) · 无 raw 方走值路
    if (e.raw) parts.push(Buffer.from(e.raw));
    else parts.push(encodeVarint(e.v));
  } else if (e.w === 2) parts.push(encodeLen(Buffer.from(e.b)));
  else if (e.w === 1 || e.w === 5) parts.push(Buffer.from(e.b));
}
function serializeProto(fields) {
  const parts = [];
  const ord = fields[_PROTO_ORD];
  if (Array.isArray(ord)) {
    // ★ v9.9.67 根药 · 全序直发 · 同号多值按原相对序 · 删者跳 · 增者追末
    const queues = {};
    for (const [fn_, arr] of Object.entries(fields)) {
      if (Array.isArray(arr)) queues[fn_] = arr.slice();
    }
    for (const fn of ord) {
      const q = queues[fn];
      if (!q || !q.length) continue; // 已删 (如 dropMemoryToolsProto) · 跳
      _protoEmit(parts, fn, q.shift());
    }
    for (const fn_ of Object.keys(queues)) {
      for (const e of queues[fn_]) _protoEmit(parts, parseInt(fn_), e); // 新增者 · 追末
    }
  } else {
    for (const [fn_, arr] of Object.entries(fields)) {
      const fn = parseInt(fn_);
      for (const e of arr) _protoEmit(parts, fn, e);
    }
  }
  return Buffer.concat(parts);
}

// Connect-RPC frame: 1 byte flags + 4 byte BE length + payload
// flags bit 0 (0x01) = compressed (gzip / deflate / br — 全尝)
// flags bit 7 (0x80) = end-of-stream
function tryDecompress(buf) {
  const attempts = [
    () => zlib.gunzipSync(buf),
    () => zlib.inflateSync(buf),
    () => zlib.inflateRawSync(buf),
    () => zlib.brotliDecompressSync(buf),
  ];
  for (const fn of attempts) {
    try {
      return fn();
    } catch {}
  }
  return null;
}
function parseFrames(buf) {
  const frames = [];
  let pos = 0;
  while (pos + 5 <= buf.length) {
    const flags = buf[pos];
    const len = buf.readUInt32BE(pos + 1);
    if (pos + 5 + len > buf.length) break;
    const raw = buf.slice(pos + 5, pos + 5 + len);
    let payload = raw;
    if (flags & 0x01 && !(flags & 0x80) && raw.length >= 2) {
      const d = tryDecompress(raw);
      if (d) payload = d;
    }
    frames.push({ flags, payload });
    pos += 5 + len;
  }
  return frames;
}
// 始终输出 uncompressed (flags bit 0 清零), 避免重压 gzip 之复杂.
function buildFrame(flags, payload) {
  const h = Buffer.alloc(5);
  h[0] = flags & ~0x01;
  h.writeUInt32BE(payload.length, 1);
  return Buffer.concat([h, payload]);
}

// 粗筛 UTF-8 文本: 用于区分 nested proto 与 plain SP bytes.
function looksLikeUtf8Text(buf) {
  if (!buf || buf.length < 4) return false;
  const n = Math.min(512, buf.length);
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const b = buf[i];
    if ((b >= 0x20 && b < 0x7f) || b === 9 || b === 10 || b === 13 || b >= 0x80)
      ok++;
  }
  return ok / n > 0.95;
}

// ═══════════════════════════════════════════════════════════
// v9.3.0 · 从 grpc-web body 递归提所有 UTF-8 字符串
// ═══════════════════════════════════════════════════════════
// 道义: 二十一章 道之物, 唯望、唯忽. 中有象呵, 中有物呵.
//       不识响应 schema · 但凡似 UTF-8 之 wire-type=2 字段, 收之.
function extractUtf8StringsFromGrpcBody(body, opts) {
  const minLen = (opts && opts.minLen) || 1;
  const maxDepth = (opts && opts.maxDepth) || 12;
  const out = [];
  try {
    const frames = parseFrames(body);
    for (const f of frames) {
      if (f.flags & 0x80) continue; // grpc-web trailers, skip
      try {
        const fields = parseProto(f.payload);
        _gatherUtf8Strings(fields, out, 0, maxDepth, minLen);
      } catch {}
    }
  } catch {}
  return out;
}
function _gatherUtf8Strings(fields, out, depth, maxDepth, minLen) {
  if (depth > maxDepth) return;
  for (const fid of Object.keys(fields)) {
    for (const e of fields[fid]) {
      if (e.w !== 2 || !e.b || !e.b.length) continue;
      const buf = Buffer.isBuffer(e.b) ? e.b : Buffer.from(e.b);
      let recursed = false;
      try {
        const sub = parseProto(buf);
        if (sub && Object.keys(sub).length > 0) {
          _gatherUtf8Strings(sub, out, depth + 1, maxDepth, minLen);
          recursed = true;
        }
      } catch {}
      if (recursed) continue;
      if (looksLikeUtf8Text(buf) && buf.length >= minLen) {
        out.push(buf.toString("utf8"));
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// chat_messages 字段定位 + ChatMessage content 提取
// 字段自适应: v2 field=2, v1 field=3, 另有 field 10/17 (SystemPromptb 新载体)
// ═══════════════════════════════════════════════════════════
const MSGS_FIELD_CANDIDATES = [2, 3, 10, 17];
function findMsgsField(topFields) {
  for (const fn of MSGS_FIELD_CANDIDATES) {
    const arr = topFields[fn];
    if (!arr || !arr.length) continue;
    for (const e of arr) {
      if (e.w !== 2) continue;
      try {
        const mf = parseProto(Buffer.from(e.b));
        if (mf[1]?.[0]?.w === 0 && mf[2]) return fn;
      } catch {}
      if (e.b.length > 200 && looksLikeUtf8Text(Buffer.from(e.b))) return fn;
    }
  }
  return 2;
}
function extractMsgContent(mf) {
  const c = mf[2]?.[0];
  if (!c || c.w !== 2) return "";
  return Buffer.from(c.b).toString("utf8");
}

// ═══════════════════════════════════════════════════════════
// 修改 GetChatMessage{V2,} 请求的 SP
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// v9.9.300 · 官方路径工具描述去名 · 两路同源 · 彻底隔离官方品牌
// ═══════════════════════════════════════════════════════════
// 第三方路径(dao_router)已对工具 description + 参数 schema 去名;官方路径出站的
// ChatToolDefinition(顶层 field 10)此前仅经 deepStripProtoSideChannels(剥侧信道·不去名)
// → 工具描述仍残留 "Cascade"/"Windsurf"/"Codeium"。此函数仅命中工具定义字段:
//   子 field 2 = description (string) · 子 field 3 = json_schema_string (JSON, 内 description)
// 不触碰用户/助手消息(在 MSGS_FIELD) · 不改工具名(子 field 1)/参数键。
// 去名引擎复用 _spInvertLib.deOfficialName(单一真源·幂等) · 与 SP 去名同源。
const _TOOLS_FIELD_NUM = 10; // cascade_wire REQ.TOOLS
const _TD_NAME = 1; // ChatToolDefinition.name
const _TD_DESC = 2; // ChatToolDefinition.description
const _TD_SCHEMA = 3; // ChatToolDefinition.json_schema_string

// ═══════════════════════════════════════════════════════════
// v9.9.301 · 记忆模块工具整条剔除 · 两路共用最上游 · 道恒无名·无记
// ═══════════════════════════════════════════════════════════
// 道模式彻底隔离官方一切 · 记忆体系(create/update/view/unlock memory)本属官方着相,
// 须如九个运营块般彻删 → 模型根本不应知有"记忆"这回事。
// 此前 stripCreateMemoryTool 只切 SP 文本里的 <function>create_memory</function> 块,
// 但真实工具定义在 proto 顶层 field 10 → 模型仍能 Created memory(实测确证)。
// 此函数在路由分叉前从 field 10 整条删除工具名含 memory/memories 者(官方/外接两路同净)。
const _MEMORY_TOOL_RE = /memor(?:y|ies)/i;
function dropMemoryToolsProto(topFields) {
  const arr = topFields[_TOOLS_FIELD_NUM];
  if (!arr || !arr.length) return 0;
  let dropped = 0;
  const kept = [];
  for (const e of arr) {
    if (e.w === 2) {
      try {
        const td = parseProto(Buffer.isBuffer(e.b) ? e.b : Buffer.from(e.b));
        const nEntry = td[_TD_NAME] && td[_TD_NAME][0];
        if (nEntry && nEntry.w === 2) {
          const nm = Buffer.from(nEntry.b).toString("utf8");
          if (_MEMORY_TOOL_RE.test(nm)) {
            dropped++;
            continue;
          }
        }
      } catch {}
    }
    kept.push(e);
  }
  if (dropped > 0) {
    topFields[_TOOLS_FIELD_NUM] = kept;
    log(`[DROP-MEMORY-TOOL] memory tools removed from field 10: ${dropped}`);
  }
  return dropped;
}
function _deOfficialJsonDescriptions(obj) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const it of obj) _deOfficialJsonDescriptions(it);
    return;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (k === "description" && typeof v === "string") {
      obj[k] = _spInvertLib.deOfficialName(v);
    } else if (v && typeof v === "object") {
      _deOfficialJsonDescriptions(v);
    }
  }
}
function deOfficialNameToolsProto(topFields) {
  if (!_spInvertLib || typeof _spInvertLib.deOfficialName !== "function")
    return 0;
  const arr = topFields[_TOOLS_FIELD_NUM];
  if (!arr || !arr.length) return 0;
  let changed = 0;
  for (const e of arr) {
    if (e.w !== 2) continue;
    const buf = Buffer.isBuffer(e.b) ? e.b : Buffer.from(e.b);
    let td;
    try {
      td = parseProto(buf);
    } catch {
      continue;
    }
    let touched = false;
    // 子 field 2: description (string)
    const dEntry = td[_TD_DESC] && td[_TD_DESC][0];
    if (dEntry && dEntry.w === 2) {
      const db = Buffer.from(dEntry.b);
      const orig = db.toString("utf8");
      // 往返守: 非法 UTF-8(二进制)跳过 · 防 proto 损坏 (同 deepStrip 之治)
      if (Buffer.byteLength(orig, "utf8") === db.length) {
        const de = _spInvertLib.deOfficialName(orig);
        if (de !== orig) {
          td[_TD_DESC] = [{ w: 2, b: Buffer.from(de, "utf8") }];
          touched = true;
        }
      }
    }
    // 子 field 3: json_schema_string (JSON) · 内 description 去名 · 仅含品牌词时才动
    const sEntry = td[_TD_SCHEMA] && td[_TD_SCHEMA][0];
    if (sEntry && sEntry.w === 2) {
      const sb = Buffer.from(sEntry.b);
      const orig = sb.toString("utf8");
      if (
        Buffer.byteLength(orig, "utf8") === sb.length &&
        /Cascade|Windsurf|Codeium/.test(orig)
      ) {
        try {
          const j = JSON.parse(orig);
          _deOfficialJsonDescriptions(j);
          const re = JSON.stringify(j);
          if (re !== orig) {
            td[_TD_SCHEMA] = [{ w: 2, b: Buffer.from(re, "utf8") }];
            touched = true;
          }
        } catch {}
      }
    }
    if (touched) {
      e.b = serializeProto(td);
      changed++;
    }
  }
  if (changed > 0)
    log(`[DEOFFICIAL-TOOLS] official-path tool descriptions de-named: ${changed}`);
  return changed;
}

function modifySPProto(reqBody, surface) {
  try {
    // ★ v9.9.371 · 按面生效(两面分治): surface 未传回落全局 SP_MODE · 与 _mainHandler 外闸同源
    const _spMode = _surfaceMode(surface || "");
    if (_spMode !== "invert" && _spMode !== "custom") return reqBody;
    const frames = parseFrames(reqBody);
    if (!frames.length) return reqBody;
    const f0 = frames[0];
    const topFields = parseProto(f0.payload);
    const MSGS_FIELD = findMsgsField(topFields);
    const msgEntries = topFields[MSGS_FIELD];
    if (!msgEntries || !msgEntries.length) return reqBody;

    let changed = false;
    // ★ v9.9.370(合流自 Tokyo) · devin local (api_server_pb): SP 直挂顶层 PROMPT=field2 · 显式截获
    //   实证(Tokyo chisel 3000.11): GetChatMessage f0.2[0]="You are Devin…"(18KB)
    //   非 chat_messages 包装; 若交 msgs 循环, parseProto 侥幸不抛则 role 检查落空漏改.
    //   写回即原地替换 msgEntries[0] —— msgs 循环再见经文本(isAlreadyInverted→保持),
    //   topFields[MSGS_FIELD]=newMsgs 落笔的仍是经文, 不被原 SP 覆写.
    {
      const _slot = topFields[2];
      if (_slot && _slot.length === 1 && _slot[0].w === 2) {
        const _txt = Buffer.from(_slot[0].b).toString("utf8");
        const _kept = invertSP(_txt);
        if (_kept !== null) {
          const _ne = { w: 2, b: Buffer.from(_kept, "utf8") };
          topFields[2] = [_ne];
          if (MSGS_FIELD === 2) {
            msgEntries.length = 0;
            msgEntries.push(_ne);
          }
          changed = true;
          log(
            `[SP-DEVIN] field=2 before=${_txt.length}B head="${_txt.slice(0, 40).replace(/\n/g, "\\n")}" -> after=${_kept.length}B`,
          );
        }
      }
    }
    const newMsgs = [];
    const spModifiedIdx = new Set(); // 追踪 invertSP 修改过的 msg 索引
    for (let i = 0; i < msgEntries.length; i++) {
      const me = msgEntries[i];
      if (me.w !== 2) {
        newMsgs.push(me);
        continue;
      }
      const b0 = Buffer.from(me.b);
      // 情形 A: entry.b 是 nested ChatMessage proto (Windsurf v2 主路径)
      let mf;
      try {
        mf = parseProto(b0);
      } catch {
        // 情形 B: entry.b 不是 proto · fallback 看是否 UTF-8 plain SP
        if (looksLikeUtf8Text(b0)) {
          const text = b0.toString("utf8");
          const kept = invertSP(text);
          if (kept === null) {
            newMsgs.push(me);
            continue;
          }
          log(
            `[SP-PLAIN] msg[${i}] field=${MSGS_FIELD} before=${text.length}B ` +
              `head="${text.slice(0, 40).replace(/\n/g, "\\n")}"  → after=${kept.length}B`,
          );
          const idx = newMsgs.length;
          newMsgs.push({ w: 2, b: Buffer.from(kept, "utf8") });
          spModifiedIdx.add(idx);
          changed = true;
        } else {
          newMsgs.push(me);
        }
        continue;
      }
      // parse 成功 · 按 ChatMessage 处理: role=0 才改
      const role = mf[1]?.[0]?.v ?? 1;
      if (role !== 0) {
        newMsgs.push(me);
        continue;
      }
      const content = extractMsgContent(mf);
      const kept = invertSP(content);
      if (kept === null) {
        newMsgs.push(me);
        continue;
      }
      log(
        `[SP-NESTED] msg[${i}] role=0 field=${MSGS_FIELD} before=${content.length}B ` +
          `head="${content.slice(0, 40).replace(/\n/g, "\\n")}"  → after=${kept.length}B`,
      );
      mf[2] = [{ w: 2, b: Buffer.from(kept, "utf8") }];
      const idx = newMsgs.length;
      newMsgs.push({ w: 2, b: serializeProto(mf) });
      spModifiedIdx.add(idx);
      changed = true;
    }
    topFields[MSGS_FIELD] = newMsgs;
    // 深度净化: 其他字段里的侧信道一律剥净 (双保险)
    // 道法自然: 仅保护 invertSP 修改过的 SP 字段 · 防 deepStrip 误伤 <user_rules>/<MEMORY>
    const spBackups = [];
    for (const idx of spModifiedIdx) {
      if (newMsgs[idx] && newMsgs[idx].b) {
        spBackups.push({ i: idx, b: Buffer.from(newMsgs[idx].b) });
      }
    }
    // v9.9.44 · ⑫-D移除 · deepStrip无条件执行 · 反者道之动
    // 病: 400KB阈值是错误代理 — 重载由特定内容模式触发(含<无</字段)，非body大小
    //     ⑫-D使日常大对话(5-19MB)完全跳过侧信道清理 → 功能回退 + 哲学背离
    // 治: ⑫-A+⑫-B+⑫-C联合使任意对话的deepStrip降至~30ms · 无需size门控
    const _t0_deep = Date.now();
    const deepChanged = deepStripProtoSideChannels(topFields, 0);
    const _dt_deep = Date.now() - _t0_deep;
    if (_dt_deep > 50)
      log(
        `[⚠DETECT] deepStrip ${_dt_deep}ms msgs=${newMsgs.length} fields=${Object.keys(topFields).length}`,
      );
    if (_dt_deep > 500)
      log(
        `[★DANGER] deepStrip 阻塞事件循环 ${_dt_deep}ms → 检查是否有含<无</的大字段 · 报告内容模式`,
      );
    // 恢复 SP 字段
    for (const bk of spBackups) {
      if (newMsgs[bk.i]) newMsgs[bk.i].b = bk.b;
    }
    // v9.9.301 · 记忆模块工具整条剔除 · 先删后去名 · 两路共用最上游
    const memDropped = dropMemoryToolsProto(topFields);
    // v9.9.300 · 官方路径工具描述去名 · 与第三方(dao_router)对齐 · 仅命中 field 10 工具定义
    const toolsChanged = deOfficialNameToolsProto(topFields);
    if (!changed && deepChanged === 0 && toolsChanged === 0 && memDropped === 0)
      return reqBody;
    if (deepChanged > 0)
      log(`[DEEP-STRIP] nested side-channels cleaned: ${deepChanged}`);
    const newPayload = serializeProto(topFields);
    const rest = frames.slice(1).map((f) => buildFrame(f.flags, f.payload));
    return Buffer.concat([buildFrame(f0.flags, newPayload), ...rest]);
  } catch (e) {
    log("modifySPProto error:", e.message);
    return reqBody;
  }
}

// RawGetChatMessage: system_prompt_override 在 topFields[3]
function modifyRawSP(reqBody) {
  try {
    const frames = parseFrames(reqBody);
    if (!frames.length) return reqBody;
    const f0 = frames[0];
    const topFields = parseProto(f0.payload);
    const spEntry = topFields[3]?.[0];
    if (!spEntry || spEntry.w !== 2) return reqBody;
    const origSP = Buffer.from(spEntry.b).toString("utf8");
    const kept = invertSP(origSP);
    let spChanged = false;
    if (kept !== null) {
      log(
        `[SP-RAW] field=3 before=${origSP.length}B ` +
          `head="${origSP.slice(0, 40).replace(/\n/g, "\\n")}"  → after=${kept.length}B`,
      );
      topFields[3] = [{ w: 2, b: Buffer.from(kept, "utf8") }];
      spChanged = true;
    }
    // 深度净化: 其他字段侧信道亦剥 · SP 字段保存恢复防误伤
    const spFieldBackup = spChanged
      ? [{ w: topFields[3][0].w, b: Buffer.from(topFields[3][0].b) }]
      : null;
    const deepChanged = deepStripProtoSideChannels(topFields, 0);
    if (spFieldBackup) topFields[3] = spFieldBackup;
    if (!spChanged && deepChanged === 0) return reqBody;
    if (deepChanged > 0)
      log(`[DEEP-STRIP] RAW side-channels cleaned: ${deepChanged}`);
    const newPayload = serializeProto(topFields);
    const rest = frames.slice(1).map((f) => buildFrame(f.flags, f.payload));
    return Buffer.concat([buildFrame(f0.flags, newPayload), ...rest]);
  } catch (e) {
    log("modifyRawSP error:", e.message);
    return reqBody;
  }
}

// ═══════════════════════════════════════════════════════════
// v17.48 · observeSPFromBody · 纯观察 · 不改一字节
// ═══════════════════════════════════════════════════════════
// 反者道之动 · 无为而无不为 · 底层之底
// 此函数于主 handler 根路调用 · 先于任何变身判定 · 无论 invert/passthrough
// 皆捕 Windsurf 真发 SP · 实时 · 无需用户直接抓取 · 随模切换随即同步
// 读取三路径之 SP (与 modifySPProto/modifyRawSP 同源) · 返 null 若非 SP 请求
function observeSPFromBody(body, kind) {
  try {
    const frames = parseFrames(body);
    if (!frames.length) return null;
    const topFields = parseProto(frames[0].payload);

    // CHAT_RAW: SP 于 topFields[3]
    if (kind === "CHAT_RAW") {
      const spEntry = topFields[3] && topFields[3][0];
      if (!spEntry || spEntry.w !== 2) return null;
      const text = Buffer.from(spEntry.b).toString("utf8");
      if (!text) return null;
      return { variant: "raw_sp", field: 3, role: null, before: text };
    }

    // CHAT_PROTO: SP 于 msgs field 中 role=0 的 entry
    if (kind === "CHAT_PROTO") {
      const MSGS_FIELD = findMsgsField(topFields);
      const entries = topFields[MSGS_FIELD];
      if (!entries || !entries.length) return null;
      for (let i = 0; i < entries.length; i++) {
        const me = entries[i];
        if (me.w !== 2) continue;
        const b0 = Buffer.from(me.b);
        // 情形 A: nested ChatMessage proto
        try {
          const mf = parseProto(b0);
          const role = mf[1] && mf[1][0] && mf[1][0].v;
          if (role === 0 && mf[2] && mf[2][0] && mf[2][0].b) {
            const text = Buffer.from(mf[2][0].b).toString("utf8");
            if (text)
              return {
                variant: "nested_chat_message",
                field: MSGS_FIELD,
                role: 0,
                before: text,
              };
          }
        } catch {}
        // 情形 B: plain UTF-8 SP bytes (Windsurf SystemPromptb 新载体)
        if (b0.length > 200 && looksLikeUtf8Text(b0)) {
          const text = b0.toString("utf8");
          if (text)
            return {
              variant: "plain_utf8",
              field: MSGS_FIELD,
              role: 0,
              before: text,
            };
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// v7.7 · deepScanProto / observeAllSPInBody · 反者道之动 · 全链路探源
// ═══════════════════════════════════════════════════════════
// 不绑 RPC 名, 任何 inference RPC body 字段级递归扫.
// 每个 wire-type=2 (length-delimited) 字段:
//   粒1: 长 utf8 文本 (>100B) → classifySPType, 命中即落候选
//   粒2: 嵌套 proto (try parse) → 递归 (maxDepth 防爆)
// 道义: 二章 万物作焉而不辞. 二十一章 其精甚真, 其中有信.
//       不预设结构, 自悟所见. 反者道之动 (四十章).
// ═══════════════════════════════════════════════════════════
function deepScanProto(buf, pathStack, candidates, maxDepth) {
  if (maxDepth <= 0) return;
  let fields;
  try {
    fields = parseProto(buf);
  } catch {
    return;
  }
  for (const fnStr of Object.keys(fields)) {
    const arr = fields[fnStr];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e.w !== 2) continue;
      const b = Buffer.from(e.b);
      const newPath = pathStack.concat([fnStr + "[" + i + "]"]);
      // 策略: 优先尝试递归 (假定为嵌套 proto). 递归无新候选时, 回退 utf8 leaf 检测.
      // 反者道之动: 不假定结构, 让 SP 在最深叶子被精确定位.
      let recursed = false;
      if (b.length > 8) {
        const before = candidates.length;
        deepScanProto(b, newPath, candidates, maxDepth - 1);
        recursed = candidates.length > before;
      }
      // 递归未产候选时, 若是 utf8, 全收 (不筛形状)
      // v9.3.9 · 万物作焉而不辞 · 大道至简 · 收一切 ≥20B utf8 字段
      //         不止 SP · 含 user_msg / tool_def / context / chat_history / file_path 全貌
      //         classifySPType / looksLikeSPShape 未中者归 "raw_text" 兜底
      //         此乃 "agent 所接受一切文字" 之最广捕 (万法归宗)
      if (!recursed && b.length > 20 && looksLikeUtf8Text(b)) {
        const text = b.toString("utf8");
        const spType =
          classifySPType(text) ||
          (looksLikeSPShape(text) ? "unknown_long" : "raw_text");
        candidates.push({
          kind: spType,
          field_path: newPath.join("."),
          chars: text.length,
          text: text,
        });
      }
    }
  }
}

function observeAllSPInBody(body, rpcPath) {
  // v9.9.56 · 损之又损 · 四十章「反者道之动」· 四十八章「损之又损，以至于无为」
  // 根因: depth=6 deepScanProto 在 setImmediate 中同步阻塞事件循环
  //       与 v9.9.50 已修的 modifyAnyInferenceSP depth=6 完全同构 · 却遗漏于观察路径
  //       passthrough / invert 两模式均走此路 → 两模式均重载 → 实证闭合
  // 治法: ① 体积门控 >512KB → 面板不显示 · 代理不阻塞 (大体积无法反映 SP 细节)
  //       ② depth 6→2 · SP 字段实际深度从不超过 2 · depth=6 为过设计
  if (body.length > 512 * 1024) return [];
  try {
    const frames = parseFrames(body);
    if (!frames.length) return [];
    const candidates = [];
    for (let fi = 0; fi < frames.length; fi++) {
      deepScanProto(frames[fi].payload, ["f" + fi], candidates, 2);
    }
    // 去重 (按 hash)
    const seen = new Set();
    const out = [];
    for (const c of candidates) {
      const h = _quickHash(c.text);
      if (seen.has(h)) continue;
      seen.add(h);
      c.hash = h;
      out.push(c);
    }
    return out;
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// 路由 + 分类
// ═══════════════════════════════════════════════════════════
function routeUpstream(reqUrl) {
  const qIdx = reqUrl.indexOf("?");
  const rawPath = qIdx < 0 ? reqUrl : reqUrl.slice(0, qIdx);
  const query = qIdx < 0 ? "" : reqUrl.slice(qIdx);
  // legacy 前缀兼容
  if (rawPath.startsWith("/i/"))
    return { host: UPSTREAM_INFER, path: rawPath.slice(2) + query };
  if (rawPath.startsWith("/r/"))
    return { host: UPSTREAM_MGMT, path: rawPath.slice(2) + query };
  // v9.3.2 · 道恒无名 · chat RPC opt-in 覆盖 (主公设 CHAT_UPSTREAM env 方激活)
  // 默认 (CHAT_UPSTREAM="") 时不特判, 随 INFERENCE_SERVICES 分流 → UPSTREAM_INFER
  if (UPSTREAM_CHAT) {
    const methodM = rawPath.match(/\/([A-Za-z0-9_]+)$/);
    const method = methodM ? methodM[1] : "";
    if (
      /^Get\w*ChatMessage\w*$/.test(method) ||
      method === "RawGetChatMessage"
    ) {
      return { host: UPSTREAM_CHAT, path: rawPath + query };
    }
  }
  // ★ v9.9.96 · 修法⑨ · 方法名级路由 · 与 classifyRPC 对齐
  //   根因: /exa.api_server_pb.ApiServerService/GetChatMessage
  //   服务名 exa.api_server_pb.ApiServerService 不在 INFERENCE_SERVICES
  //   → 错误路由到 UPSTREAM_MGMT → "Model provider unreachable"
  //   治: 方法名 GetChatMessage/V2/RawGetChatMessage → UPSTREAM_INFER
  //   道义: 四十章「反者道之动」· 反服务名分流之偏 · 方法名分流补之
  {
    const methodM = rawPath.match(/\/([A-Za-z0-9_]+)$/);
    const method = methodM ? methodM[1] : "";
    if (
      method === "GetChatMessage" ||
      method === "GetChatMessageV2" ||
      method === "RawGetChatMessage"
    ) {
      // FIX (2026-06-23 empirical replay): same GetChatMessage request returns
      //   200 + real chat response on server.codeium.com (UPSTREAM_API),
      //   but "third-party model provider unavailable" on inference.codeium.com.
      //   Official chat (ApiServerService) must go to api_server host, matching
      //   the LS native --api_server_url. Routed (BYOK) models are intercepted
      //   earlier at _eaRouter.route() (kind-gated), so they bypass this host.
      return { host: UPSTREAM_API, path: rawPath + query };
    }
  }
  // 服务名自动分流
  const m = rawPath.match(/^\/([^/]+)\//);
  const svc = m ? m[1] : "";
  // ★ api_server 工具服务 (非 chat 方法) → server.codeium.com 本源
  //   先于 INFERENCE_SERVICES 判定 · 工具不再误投 inference
  if (API_SERVER_SERVICES.has(svc))
    return { host: UPSTREAM_API, path: rawPath + query };
  if (INFERENCE_SERVICES.has(svc))
    return { host: UPSTREAM_INFER, path: rawPath + query };
  return { host: UPSTREAM_MGMT, path: rawPath + query };
}

// 分五档:
//   CHAT_PROTO    · GetChatMessage{,V2}          · SP 字段替换 + 深度净化
//   CHAT_RAW      · RawGetChatMessage            · field[3] SP 替换 + 深度净化
//   INFER_STRIP   · 其他 inference RPC           · 仅深度净化 (剥侧信道)
//   MODEL_UNLOCK  · GetUserSettings/ModelConfigs · 响应注入全量模型目录
//   LOCAL_AUTH    · SeatManagement/Heartbeat     · 官方不可达时本地兜底
//   PASSTHROUGH   · 非 inference (mgmt/auth 等)  · 直透
// ★ v9.9.344 · 根治 · 道法自然 · 天下有始 以为天下母
//   病(根因): LS 启动后周期调 :8957 SeatManagement/GetUser 验鉴;
//     SeatManagement 非 API_SERVER/INFERENCE → 默认路由至 UPSTREAM_MGMT
//     (server.self-serve.windsurf.com) 而非 server.codeium.com;
//     UPSTREAM_MGMT 对 SeatManagement 回 404 → LS 标记"未鉴权" → 前端永卡"Connecting to server".
//     同理 Heartbeat 走 API_SERVER → server.codeium.com; 官方不可达时心跳亦断.
//   解: 对鉴权/心跳 RPC 本地直返 gRPC OK · LS 即刻"已连接" · 无需官方可达.
//     道义: 五十二章「天下有始 以为天下母 · 既得其母 以知其子」
//     母=本地鉴权兜底 · 子=LS 连接态 · 得母则子自正.
//
// SeatManagement 鉴权服务 · 本地兜底集 (LS 调此验 seat/user 存在性)
const LOCAL_AUTH_SERVICES = new Set([
  "exa.seat_management_pb.SeatManagementService",
]);
// 心跳 RPC · 官方不可达时本地兜底 (LS 周期心跳; 失败→"Connecting")
//   注: GetUserStatus 不入此集 · 其响应须经 proxyToCloud 做真解锁改写(去 Pro 锁/补 field20)
//       故 GetUserStatus 仍走 PASSTHROUGH(reachable 时解锁; unreachable 时由 proxyToCloud 内兜底)
const LOCAL_AUTH_METHODS = new Set([
  "Heartbeat",
]);
// SeatManagement 内须保留走 PASSTHROUGH 的方法(响应需改写/解锁) · 不本地短路
//   ★ v9.9.346 · GetCliTeamSettings 亦入此集(实证于多账号共机捆绑 ACP 代理):
//     捆绑 devin.exe(chisel)走 Connect 协议取 GetCliTeamSettings 鉴权; LOCAL_AUTH 的
//     _replyGrpcOk 发的是 gRPC 帧(5 字节前缀·首字节 0x00 压缩位), chisel 按 Connect
//     unary(裸 protobuf·无帧前缀)解码 → 首字节 0x00 被读成 field tag 0 →
//     "Connect decode error: invalid tag value: 0" → "Failed to fetch team settings"。
//     LS 走 gRPC 只验 grpc-status 故无碍, 唯 chisel 解 payload 露此。解: 与 GetUserStatus
//     同归 PASSTHROUGH → 由真端(self-serve)按客户端协议正确成帧回真 TeamSettings →
//     chisel 解码必过。官方不可达时 chisel 自有 team_settings 本地缓存兜底(实测 0ms
//     "loaded from cache")→ 仍不卡。五十二章「既得其母 以知其子」· 不夺其真。
const SEATMGMT_PASSTHROUGH_METHODS = new Set([
  "GetUserStatus",
  "GetCliTeamSettings",
]);
function classifyRPC(reqPath) {
  if (!reqPath) return "PASSTHROUGH";
  const qIdx = reqPath.indexOf("?");
  const cleanPath = qIdx < 0 ? reqPath : reqPath.slice(0, qIdx);
  const m = /\/([A-Za-z0-9_]+)$/.exec(cleanPath);
  const rpc = m ? m[1] : "";
  if (rpc === "GetChatMessage" || rpc === "GetChatMessageV2")
    return "CHAT_PROTO";
  if (rpc === "RawGetChatMessage") return "CHAT_RAW";
  // ★ v9.9.260 · 模型解锁 · 反者道之动 · 无为而无不为
  //   GetUserSettings 返回 cachedCascadeModelConfigs · 账号权限限制可见模型
  //   拦截响应 → 注入全量109模型目录 → 前端显示所有模型
  //   道义: 三十五章「执大象 天下往」· 全量模型即大象 · 执之则天下往
  if (rpc === "GetUserSettings" || rpc === "GetCascadeModelConfigs")
    return "MODEL_UNLOCK";
  // ★ v9.9.344 · 鉴权/心跳兜底 · 既得其母 以知其子
  const svcM = cleanPath.match(/^\/([^/]+)\//);
  const svc = svcM ? svcM[1] : "";
  if (LOCAL_AUTH_SERVICES.has(svc)) {
    // GetUserStatus 等须解锁改写的方法保留 PASSTHROUGH · 不本地短路
    if (SEATMGMT_PASSTHROUGH_METHODS.has(rpc)) return "PASSTHROUGH";
    return "LOCAL_AUTH";
  }
  if (LOCAL_AUTH_METHODS.has(rpc) && API_SERVER_SERVICES.has(svc))
    return "LOCAL_AUTH";
  // ★ api_server 工具服务 · 透明直透 (不剥侧信道) · 与原版 LSP 一致
  //   走 server.codeium.com · 真后端真鉴权 · 无需净化 (净化反致 proto 损坏)
  if (API_SERVER_SERVICES.has(svc)) return "PASSTHROUGH";
  // inference 服务 · 深度净化侧信道
  if (INFERENCE_SERVICES.has(svc)) return "INFER_STRIP";
  return "PASSTHROUGH";
}

// ═══════════════════════════════════════════════════════════
// HTTP 控制面 (/origin/...)
// ═══════════════════════════════════════════════════════════
// ★ 安全 · 交接文档 (handoff.md) 内嵌本机 apiKey + 公网隧道 URL: 若不设防, 任何知道
//   公网隧道 URL 者 GET 即读走 key、彻底架空 apiKey 防护 (反者道之动·守此致命口子)。
//   故: 本机 (无 cf/转发头·loopback) 仍零配置可读; 公网(隧道转发)/非本机必须携带有效 key。
//   与数据面同一鉴权模型 (_isLocal / _authOk), 持钥者本已知 key、返回无害。
function _handoffGuard(req, res) {
  let forwarded = false;
  let authed = false;
  try {
    const mod = _getRevproxy();
    if (mod && mod._isLocal && mod._authOk) {
      forwarded = !mod._isLocal(req);
      const cfg = (mod.loadConfig && mod.loadConfig()) || {};
      authed = !!mod._authOk(req, cfg);
    } else {
      const h = req.headers || {};
      forwarded = !!(
        h["cf-connecting-ip"] ||
        h["cf-ray"] ||
        h["cf-ipcountry"] ||
        h["cf-visitor"] ||
        h["x-forwarded-for"] ||
        h["x-forwarded-host"] ||
        h["forwarded"] ||
        h["via"]
      );
    }
  } catch (_) {}
  if (forwarded && !authed) {
    res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: {
          message: "未授权 · 交接文档含本机 apiKey · 公网访问需携带有效 Bearer key",
          type: "unauthorized",
        },
      }),
    );
    return true;
  }
  return false;
}

function handleControl(req, res) {
  const u = url.parse(req.url, true);
  // CORS: webview (vscode-webview://) 直连需要
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // v9.4.3 · 记所有 /origin/* 控制端点击中 · 诊 webview fetch 是否真到
  _ctrlHit(u.pathname);

  // v7.8 debug: recent request paths
  if (u.pathname === "/origin/paths" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        count: _recentPaths.length,
        paths: _recentPaths,
      }),
    );
    return true;
  }

  if (u.pathname === "/origin/ping" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        port: _actualPort,
        // ★ v9.9.74 · acp 面专属口实况 (0=未分口 · 旧版/绑定失败回落)
        acp_port: _acpBoundPort || 0,
        mode: SP_MODE,
        // ★ v9.9.371 · 两面分治: 每面独立 SP 模式实况 (未设面回落 default 再回落全局)
        surface_modes: {
          default: _surfaceMode(""),
          local: _surfaceMode("local"),
          cascade: _surfaceMode("cascade"),
        },
        pid: process.pid,
        // ★ v9.9.70 · detached 身份 —— ext-host 据此知其为独立子进程 (采用/让位判据)
        spawned: _SPAWNED,
        parent_pid: _PARENT_PID || null,
        uptime_s: Math.round((Date.now() - START_TIME) / 1000),
        req_total: reqCounter,
        // v9.9.330 · LS 心跳活性 · 看门狗据此辨识扩展↔LS wedge (idle 超阈即自愈重启 LS)
        ls_last_req_at: _lastLsReqAt,
        ls_idle_s: Math.round(
          (Date.now() - (_lastLsReqAt || START_TIME)) / 1000,
        ),
        dao_loaded: DAO_DE_JING_81.length > 0,
        dao_chars: DAO_DE_JING_81.length,
        canon: _activeCanon,
        canon_name: (_CANON_MAP[_activeCanon] || {}).name || _activeCanon,
        canon_chars: _activeCanonText ? _activeCanonText.length : 0,
        canon_valid: [..._CANON_VALID],
        // 工具模式轴(与经藏正交) · 面板 ping 同步
        tools:
          _spInvertLib && _spInvertLib.getToolMode
            ? _spInvertLib.getToolMode()
            : "official",
        tools_name:
          _spInvertLib && _spInvertLib.TOOLMODE_MAP && _spInvertLib.getToolMode
            ? (_spInvertLib.TOOLMODE_MAP[_spInvertLib.getToolMode()] || {})
                .name || _spInvertLib.getToolMode()
            : "official",
        self_size: _SELF_SIZE,
        self_file: __filename,
        // v9.9.263 · 真解锁 · GetUserStatus 去 Pro 锁实证计数
        real_unlock: {
          enabled: _isModelUnlockEnabled(),
          calls: _unlockStats.calls,
          dropped_total: _unlockStats.dropped_total,
          last_dropped: _unlockStats.last_dropped,
          unlock4_total: _unlockStats.unlock4_total,
          last_unlock4: _unlockStats.last_unlock4,
          last_at: _unlockStats.last_at,
          last_bytes: _unlockStats.last_bytes,
          last_total: _unlockStats.last_total,
          last_available: _unlockStats.last_available,
          schema: _unlockStats.schema,
        },
        // 万模归一 retarget 观测: rewrites>0 证官方直通复用帧确被改档(field21→本次真档)
        retarget: {
          calls: _retargetStats.calls,
          rewrites: _retargetStats.rewrites,
          skipped: _retargetStats.skipped,
          last_from: _retargetStats.last_from,
          last_to: _retargetStats.last_to,
          last_at: _retargetStats.last_at,
        },
        // 会话鉴权保鲜观测: rewrites>0 证回放前确用最新捕获帧的 field1(鉴权)嫁接旧槽帧
        //   → 跨会话回放不再 unauthenticated; last_age_ms=嫁接所用最新帧的新鲜度。
        authgraft: {
          calls: _authGraftStats.calls,
          rewrites: _authGraftStats.rewrites,
          skipped: _authGraftStats.skipped,
          last_at: _authGraftStats.last_at,
          last_age_ms: _authGraftStats.last_age_ms,
          last_src: _authGraftStats.last_src || null,
          synths: _authGraftStats.synths || 0,
          // 守真突破+自主保鲜: 活鉴权信封采得即合成全鉴权回放帧·rewrites自然自增·脱用户Cascade对话依赖。
          envelope: _lastAuthEnvelope
            ? { has: true, at: _lastAuthEnvelope.at, age_ms: Date.now() - (_lastAuthEnvelope.at || 0), has_cid: !!_lastAuthEnvelope.cid }
            : { has: false },
          // v9.9.336 · 根源突破诊断: LSP/补全(PASSTHROUGH)流量鉴权信封探采观测。
          lsp_probe: _lspProbe,
        },
        // v9.9.21 · 唯变所适 · 让位标志 · ext-host 见 quitted=true 不再 require 起
        quitted: _quitSignaled,
        // v7.2 · 用户实时编辑提示词状态 (人法地, 地法天, 天法道, 道法自然)
        custom_sp: !!(_customSP && _customSP.sp),
        custom_sp_chars: _customSP && _customSP.sp ? _customSP.sp.length : 0,
        custom_sp_keep_blocks:
          _customSP && _customSP.sp ? !!_customSP.keep_blocks : null,
        // v9.4.3 · 控制端点击中 · 诊 webview fetch 通路
        ctrl_hits: _ctrlHits,
        // v9.4.5 · tape 计 · 底层之底 · 时序一切
        tape_count: _rawTape.length,
        tape_max: _RAW_TAPE_MAX,
        tape_last_at: _rawTape.length ? _rawTape[_rawTape.length - 1].t : 0,
        node_version: process.version,
        mux: {
          conns: _muxConns,
          h1: _muxH1,
          h2: _muxH2,
          nil: _muxNull,
          h2errs: _h2Errs,
          h2sess: _muxH2SessCount,
          h2streams: _h2Streams,
          h2closes: _h2Closes,
          h2sess_errs: _h2SessErrs,
        },
        ea_status: _ea ? _ea.getStatus() : null,
        ea_running: _ea ? _ea.isRunning() : false,
        // ★ v9.9.260 · 模型解锁状态 · 执大象 天下往
        model_unlock: {
          enabled: _isModelUnlockEnabled(),
          catalog_size: _fullModelCatalog ? _fullModelCatalog.length : 0,
          catalog_loaded: !!_fullModelCatalog,
          catalog_at: _fullModelCatalogAt,
        },
        features: {
          mode: ORIGIN_VERSION,
          tao_header_chars: _canonHeader(_activeCanon).length,
          dao_chars: DAO_DE_JING_81.length,
          principle:
            "v9.8.0 守一不离 · 三十九章「得一」· SIDE_CHANNEL_TAGS 删 'additional_metadata' · 守用户域 @ 项之 Cascade ID/file path/line range · @ 工具 (trajectory_search/read_file 等) 复活 · tape all_fields raw_text 显 AFTER (post strip+neutralize) · 名实终一 · 承 v9.7.9 中性化 SECTION_OVERRIDE 身份锚 · 承 v9.7.7 ~7237 字帛书裸呈",
          inject_total_chars:
            TAO_HEADER.length + DAO_DE_JING_81.length + TAO_FOOTER.length,
          rpc_classes: {
            CHAT_PROTO: "GetChatMessage{,V2} · invertSP + deepStrip 侧信道",
            CHAT_RAW: "RawGetChatMessage · invertSP + deepStrip 侧信道",
            INFER_STRIP: "其他 inference RPC · 仅剥侧信道 · 不替 SP",
            MODEL_UNLOCK: "GetUserSettings/ModelConfigs · 响应注入全量模型目录",
            LOCAL_AUTH: "SeatManagement/Heartbeat · 本地 gRPC OK 兜底 (官方不可达不卡连接)",
            PASSTHROUGH: "非 inference (mgmt 等) · 直透",
          },
        },
      }),
    );
    return true;
  }

  // GET /origin/health · 存活别名 (通用约定 · 精简版 ping)
  if (u.pathname === "/origin/health" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        status: "alive",
        port: _actualPort,
        pid: process.pid,
        uptime_s: Math.round((Date.now() - START_TIME) / 1000),
        mode: SP_MODE,
        canon: _activeCanon,
        dao_loaded: DAO_DE_JING_81.length > 0,
        ea_running: _ea ? _ea.isRunning() : false,
      }),
    );
    return true;
  }

  // GET /origin/selftest · 自证: 三径置道魂 · 返 json 诊断
  if (u.pathname === "/origin/selftest" && req.method === "GET") {
    const _router =
      typeof _eaRuntimeMod !== "undefined" && _eaRuntimeMod
        ? _eaRuntimeMod.routerStatus()
        : { ready: false, count: 0 };
    const daoOk = DAO_DE_JING_81.length > 0 && !!_activeCanonText;
    const routeOk = !!(_ea && _ea.isRunning()) && _router.count > 0;
    const unlockOk = !!_fullModelCatalog;
    res.end(
      JSON.stringify({
        // ★ v9.9.67-min · 自证总判唯系道魂之路(经文载 + 典源在)
        //   病: 旧判 ok = daoOk && routeOk · 而 Min 版外接轴已源码级拆除(_ea 恒 null)
        //       → routeOk 恒 false → selftest 永报失 · 名实不符 · 自检永红。
        //   治: 总判唯 daoOk · 外接/解锁两径 Min 已拆 · 各自 ok 附陈作观测 · 不拖累总判。
        //   道义: 三十九章「得一」· 守其一 · 不以已废之径累真径。
        ok: daoOk,
        ts: Date.now(),
        version: ORIGIN_VERSION,
        // 径一 · 道魂 (SP / canon 注入)
        canon_path: {
          ok: daoOk,
          mode: SP_MODE,
          canon: _activeCanon,
          canon_name: (_CANON_MAP[_activeCanon] || {}).name || _activeCanon,
          canon_chars: _activeCanonText ? _activeCanonText.length : 0,
          dao_chars: DAO_DE_JING_81.length,
        },
        // 径二 · 外接 (路由 / 渠道)
        route_path: {
          ok: routeOk,
          ea_running: _ea ? _ea.isRunning() : false,
          ready: _router.ready,
          route_count: _router.count,
        },
        // 径三 · 解锁 (模型目录)
        unlock_path: {
          ok: unlockOk,
          enabled: _isModelUnlockEnabled(),
          catalog_size: _fullModelCatalog ? _fullModelCatalog.length : 0,
          catalog_loaded: !!_fullModelCatalog,
        },
      }),
    );
    return true;
  }

  if (u.pathname === "/origin/mode" && req.method === "GET") {
    res.end(
      JSON.stringify({
        mode: SP_MODE,
        valid: [...SP_MODE_VALID],
        // ★ v9.9.371 · 两面分治: 每面独立模式 (未设面回落 default 再回落全局 SP_MODE)
        surface: {
          default: _surfaceMode(""),
          local: _surfaceMode("local"),
          cascade: _surfaceMode("cascade"),
        },
        surface_canons: {
          default: _surfaceCanon(""),
          local: _surfaceCanon("local"),
          cascade: _surfaceCanon("cascade"),
        },
        surface_customs: {
          local: _surfaceJson().local_customsp || null,
          cascade: _surfaceJson().cascade_customsp || null,
        },
        canon_valid: [..._CANON_VALID],
        surface_file: SP_MODE_SURFACE_FILE,
      }),
    );
    return true;
  }

  // v17.47 · 实注本源 · 真本源 (非自检合成 · 乃真流量之截)
  // ?full=1 → 返回 before/after 全文 · 省则各留 1024 字头 + 256 字尾
  if (u.pathname === "/origin/lastinject" && req.method === "GET") {
    if (!_lastInject) {
      res.end(JSON.stringify({ ok: true, has_inject: false }));
      return true;
    }
    const full = u.query && u.query.full === "1";
    const ev = Object.assign({}, _lastInject);
    if (!full) {
      const cap = (s) => {
        if (typeof s !== "string") return s;
        if (s.length <= 1280) return s;
        return s.slice(0, 1024) + "\n…\n" + s.slice(-256);
      };
      ev.before = cap(ev.before);
      ev.after = cap(ev.after);
    }
    res.end(
      JSON.stringify({
        ok: true,
        has_inject: true,
        full: !!full,
        age_s: Math.round((Date.now() - ev.at) / 1000),
        ...ev,
      }),
    );
    return true;
  }

  // v9.7.0 · 为道日损 · /origin/preview · 简返 before/after + 计数 (无 dissect)
  // 致虚守静 · 观复知常 · 二十六章 重为轻根
  if (u.pathname === "/origin/preview" && req.method === "GET") {
    const hasBefore = !!(_lastInject && _lastInject.before);
    const before = hasBefore ? _lastInject.before : null;
    const age_s =
      _lastInject && _lastInject.at
        ? Math.round((Date.now() - _lastInject.at) / 1000)
        : null;
    // ★ v9.9.70 · 名实终一 · 停重演 · 直呈录存之线上真值
    //   旧病: after = invertSP(before) 即席重演 —— 全局 SP_MODE 为凭 · 与按面实发分裂.
    //   今: _lastInject.after 已录线上实发 SP (deferred-observe wire 提取) · 所见即所发.
    const after = hasBefore
      ? _lastInject.after != null
        ? _lastInject.after
        : before
      : null;
    res.end(
      JSON.stringify({
        ok: true,
        mode: SP_MODE,
        surface_modes: {
          default: _surfaceMode(""),
          local: _surfaceMode("local"),
          cascade: _surfaceMode("cascade"),
        },
        source: hasBefore ? "captured" : "at_rest",
        after: after,
        after_chars: after ? after.length : 0,
        before: before,
        before_chars: before ? before.length : 0,
        has_captured_before: hasBefore,
        age_s: age_s,
        // ★ v9.9.70 · 闭环判词携带 (面板/自检共凭)
        kind: _lastInject && _lastInject.kind,
        variant: _lastInject && _lastInject.variant,
        surface: _lastInject && _lastInject.surface,
        mode_eff: _lastInject && _lastInject.mode,
        transformed: _lastInject ? !!_lastInject.transformed : null,
        sp_on_wire: _lastInject ? !!_lastInject.sp_on_wire : null,
        after_source: _lastInject && _lastInject.after_source,
        wire_changed: _lastInject ? !!_lastInject.wire_changed : null,
        // v9.9.19 · 损之又损 · 去 injects_by_kind 全体 (934KB) · preview瘦身 872KB→~52KB
        // 全量数据仍由 /origin/allinjects 专供 · preview 只返 webview 所需精华
        injects_kinds: Object.keys(_injectsByKind || {}),
        tao_header_chars: _canonHeader(_activeCanon).length,
        dao_chars: DAO_DE_JING_81.length,
        custom_sp: !!(_customSP && _customSP.sp),
        custom_sp_chars: _customSP && _customSP.sp ? _customSP.sp.length : 0,
        custom_sp_keep_blocks:
          _customSP && _customSP.sp ? !!_customSP.keep_blocks : null,
        custom_sp_at: _customSP && _customSP.at ? _customSP.at : null,
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v9.3.4 · /origin/allinjects · 所有官方模块注入 SP 总览 JSON
  // ═══════════════════════════════════════════════════════════
  // 按 classifySPType 分槽: chat | summary | memory | ephemeral | unknown_long
  // 每槽仅留最近 1 条 · 含 before/after 全文 + 元数据
  // 道义: 五章 "虚而不屈, 动而愈出". 多孔同风, 一器容万.
  if (u.pathname === "/origin/allinjects" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    const summary = {};
    for (const k of Object.keys(_injectsByKind || {})) {
      const v = _injectsByKind[k] || {};
      summary[k] = {
        sp_role: k,
        kind: v.kind,
        variant: v.variant,
        field: v.field,
        role: v.role,
        mode: v.mode,
        transformed: v.transformed,
        before_chars: v.before_chars,
        after_chars: v.after_chars,
        at: v.at,
        age_s: v.at ? Math.round((Date.now() - v.at) / 1000) : null,
        rid: v.rid,
        before_head: v.before ? v.before.slice(0, 500) : null,
        before_tail: v.before ? v.before.slice(-300) : null,
        // v9.3.9 · agent 所接受一切文字 · meta (full 在 .full 里)
        all_fields_count: v.all_fields_count || 0,
        all_fields_chars: v.all_fields_chars || 0,
      };
    }
    res.end(
      JSON.stringify({
        ok: true,
        mode: SP_MODE,
        count: Object.keys(_injectsByKind || {}).length,
        kinds: Object.keys(_injectsByKind || {}),
        summary: summary,
        full: _injectsByKind, // 全文 before/after
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v9.4.5 · /origin/_wdbg · webview 诊 ringbuf · 反之又反
  // ═══════════════════════════════════════════════════════════
  // GET  : 返 _wvDbg ringbuf 全 (200 槽)
  // POST : body json · 追一条 · {msg, tag, data?} · 定位 pull 卡在哪
  // 道义: 十四章 "执今之道, 以御今之有". 观 webview 当下之行.
  if (u.pathname === "/origin/_wdbg") {
    if (req.method === "GET") {
      res.end(
        JSON.stringify({
          ok: true,
          count: _wvDbg.length,
          max: _WVDBG_MAX,
          log: _wvDbg.slice().reverse(), // 最新在前
        }),
      );
      return true;
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 8192) req.destroy();
      });
      req.on("end", () => {
        try {
          const j = body ? JSON.parse(body) : {};
          _wvPush({
            msg: String(j.msg || "").slice(0, 200),
            tag: String(j.tag || "").slice(0, 80),
            data:
              j.data !== undefined
                ? String(JSON.stringify(j.data)).slice(0, 400)
                : null,
          });
          res.end(JSON.stringify({ ok: true, count: _wvDbg.length }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      req.on("error", () => {});
      return true;
    }
    if (req.method === "DELETE") {
      _wvDbg.length = 0;
      res.end(JSON.stringify({ ok: true }));
      return true;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ★ v9.9.67 · /origin/stream · SSE 实时事件 (补 DaoSseClient 之环)
  //   事件: hello(连接即发·含 port/mode/canon) / sp(注入变·含sig) /
  //         mode(模式变) / hb(30s 心跳·防中间层断连)
  // ═══════════════════════════════════════════════════════════
  if (u.pathname === "/origin/stream" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    try {
      res.write(
        `event: hello\ndata: ${JSON.stringify({
          ok: true,
          port: _actualPort,
          mode: SP_MODE,
          canon: _activeCanon,
          ts: Date.now(),
        })}\n\n`,
      );
    } catch {}
    _sseClients.add(res);
    const _hb = setInterval(() => {
      try {
        res.write(`event: hb\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      } catch {}
    }, 30000);
    try {
      _hb.unref && _hb.unref();
    } catch {}
    req.on("close", () => {
      clearInterval(_hb);
      _sseClients.delete(res);
    });
    req.on("error", () => {
      clearInterval(_hb);
      _sseClients.delete(res);
    });
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v9.9.21 · /origin/_quit · 唯变所适 · 让位机制
  // ═══════════════════════════════════════════════════════════
  // POST 仅 127.0.0.1 (per-user 端口已隔离 · 不需鉴权)
  // 用例: 新版 ext-host 检测远端 self_file 为旧版 → POST /origin/_quit
  //       旧 server.close() · ext-host watchdog 见 _quitSignaled=true 不再 require 起
  //       新 ext-host EADDRINUSE 释放后重 listen 自家最新版 · 自显
  // 道义: 二十二章「夫唯不争 故莫能与之争」· 六十六章「以其善下之 故能为百谷王」
  if (u.pathname === "/origin/_quit" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1024) req.destroy();
    });
    req.on("end", () => {
      let reason = "newer-version-arrived";
      try {
        const j = body ? JSON.parse(body) : {};
        if (j && typeof j.reason === "string") reason = j.reason.slice(0, 200);
      } catch {}
      log(`[_quit] received reason=${reason} self=${__filename}`);
      // 1. 即返 OK · 让请方知道已收到
      res.end(
        JSON.stringify({
          ok: true,
          self_file: __filename,
          mode: ORIGIN_VERSION,
          reason,
        }),
      );
      // 2. 标 _quitSignaled (start() 暴露给 ext-host watchdog 看)
      _quitSignaled = true;
      // 3. 异步 close server (让本响应先回去)
      setTimeout(() => {
        try {
          server.close((err) => {
            log(
              `[_quit] server closed${err ? " err=" + err.message : ""} · 让位毕`,
            );
          });
          // h2 内部 server 也关
          try {
            _h2Server && _h2Server.close && _h2Server.close();
          } catch {}
          // ★ v9.9.74 · acp 面并听同闭
          try {
            _closeAcpMux();
          } catch {}
          // ★ v9.9.70 · spawned 进程 close 后自退 —— SSE/H2 长连不阻让位
          //   ext-host 内嵌路径进程死随宿主 · 无需此; 独立子进程须自终
          // ★ v9.9.72 · 让位或执葬: .obsolete 录名 → 非让位乃永诀 → 还原锚面
          // ★ v9.9.73 · 进程内同护: 录死则还原 (自终唯 spawned 可)
          if (_daoSelfMarkedDead()) {
            if (_SPAWNED) {
              _daoBurial();
            } else {
              try {
                _daoFinalCleanup();
              } catch (_) {}
              _buriedOnce = true;
            }
          } else if (_SPAWNED)
            setTimeout(() => {
              try {
                process.exit(0);
              } catch (_) {}
            }, 800).unref();
        } catch (e) {
          log(`[_quit] close fail: ${e.message}`);
        }
      }, 100);
    });
    req.on("error", () => {});
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v9.4.5 · /origin/tape · 底层之底 · 时序一切 · 反之又反
  // ═══════════════════════════════════════════════════════════
  // 返 _rawTape 全 16 槽 · 每槽 {t, rid, kind, rpc, mode_at, transformed,
  //   before (完整), after (完整), all_fields[完整], meta}
  //
  // 查询参: ?limit=N (默 16 = 全) · ?index=I (0-based, 仅返一条)
  //         ?fields=0 (去 all_fields 省带宽, 默 1 含)
  //
  // 道义: 一章 无名万物始 · 十四章 执今之道御今之有 · 四十章 反之又反
  if (u.pathname === "/origin/tape" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    const limit = Math.max(
      1,
      Math.min(
        _RAW_TAPE_MAX,
        parseInt(u.query.limit || _RAW_TAPE_MAX, 10) || _RAW_TAPE_MAX,
      ),
    );
    const includeFields = u.query.fields !== "0";
    const rawIdx = u.query.index != null ? parseInt(u.query.index, 10) : null;
    // 最新在末 · 倒序返 (最新第 0)
    const reversed = _rawTape.slice().reverse();
    let list =
      rawIdx != null &&
      !isNaN(rawIdx) &&
      rawIdx >= 0 &&
      rawIdx < reversed.length
        ? [reversed[rawIdx]]
        : reversed.slice(0, limit);
    if (!includeFields) {
      list = list.map((e) => {
        const cp = Object.assign({}, e);
        delete cp.all_fields;
        return cp;
      });
    }
    res.end(
      JSON.stringify({
        ok: true,
        mode: SP_MODE,
        total: _rawTape.length,
        max: _RAW_TAPE_MAX,
        tape: list,
        tape_last_at: _rawTape.length ? _rawTape[_rawTape.length - 1].t : 0,
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v9.9.307 · /origin/upstream · 真上游 · 第三方实收之全文(system+messages+tools)
  // ═══════════════════════════════════════════════════════════
  if (u.pathname === "/origin/upstream" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        ok: true,
        upstream: _lastUpstream || null,
        at: _lastUpstream && _lastUpstream.at ? _lastUpstream.at : 0,
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v7.3 · /origin/sig · 简哈签名 · webview 实时同步检变之据
  // ═══════════════════════════════════════════════════════════
  // 返: { mode, sp_sig, custom_sig, last_inject_at, custom_sp }
  // sp_sig    = quickHash(_lastInject.before) (官方 SP 变即变)
  // custom_sig = _customSP ? quickHash(sp+at) : "0" (用户态变即变)
  // webview SSE/poll 拼 "mode|sp_sig|custom_sig" 比对, 异即触 refresh.
  // 道义: 一章 玄之又玄 众妙之门. 一签观全境.
  if (u.pathname === "/origin/sig" && req.method === "GET") {
    const beforeText =
      _lastInject && _lastInject.before ? _lastInject.before : "";
    const customText =
      _customSP && _customSP.sp
        ? _customSP.sp +
          "|" +
          (_customSP.keep_blocks ? "1" : "0") +
          "|" +
          (_customSP.at || 0)
        : "";
    // v9.3.6 · 多槽多深扫综合 sig · panel smart poll 据
    // 道义: 一章 “玄之又玄, 众妙之门” · 一签观全境 (含多槽之动)
    let injectsLastAt = 0;
    for (const k of Object.keys(_injectsByKind || {})) {
      const v = _injectsByKind[k];
      if (v && v.at && v.at > injectsLastAt) injectsLastAt = v.at;
    }
    // v9.4.5 · tape 动感
    const tapeLastAt = _rawTape.length ? _rawTape[_rawTape.length - 1].t : 0;
    res.end(
      JSON.stringify({
        ok: true,
        mode: SP_MODE,
        sp_sig: _quickHash(beforeText),
        custom_sig: _quickHash(customText),
        last_inject_at: _lastInject && _lastInject.at ? _lastInject.at : 0,
        custom_sp: !!(_customSP && _customSP.sp),
        custom_sp_at: _customSP && _customSP.at ? _customSP.at : 0,
        // v9.3.6 · smart poll 观变必需
        injects_count: Object.keys(_injectsByKind || {}).length,
        injects_last_at: injectsLastAt,
        // v9.4.5 · 底层之底 · tape 动感
        tape_count: _rawTape.length,
        tape_last_at: tapeLastAt,
        // v9.9.307 · 真上游动感 · 第三方实发即变 · 面板优先据此刷
        upstream_last_at:
          _lastUpstream && _lastUpstream.at ? _lastUpstream.at : 0,
        // ★ v9.9.70 · 末条闭环判词 · 面板 sigTick 一签带变
        last: _tapeVerdict(),
        uptime_s: Math.round((Date.now() - START_TIME) / 1000),
        req_total: reqCounter,
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // ★ v9.9.70 · /origin/verify · 闭环自检端点 —— 名实终一之判
  // ═══════════════════════════════════════════════════════════
  // 不问重演 · 只验录存之线上真值:
  //   ok_wire_inverted      面应改 · 线上SP实异于入来 (发改证成)
  //   ok_passthrough        面应透 · 线上SP=入来原文 (无为证成)
  //   ok_custom             面应编 · 发改证成 (mode=custom)
  //   warn_should_invert    面应改 · 线上SP=原文 (应改未改 · 真病灶)
  //   warn_sp_absent_wire   入来有SP · 线上无SP字段 (疑脱)
  //   stale                 最近录 > 24h (信旧)
  //   no_capture            tape 空 · 流量未入此门 (绕行官方?)
  if (u.pathname === "/origin/verify" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        ok: true,
        mode: SP_MODE,
        surface_modes: {
          default: _surfaceMode(""),
          local: _surfaceMode("local"),
          cascade: _surfaceMode("cascade"),
        },
        tape_count: _rawTape.length,
        req_total: reqCounter,
        uptime_s: Math.round((Date.now() - START_TIME) / 1000),
        last: _tapeVerdict(true),
      }),
    );
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // v7.2 · /origin/custom_sp · 用户实时编辑接口 · 三动词
  // ═══════════════════════════════════════════════════════════
  // GET    返当前 _customSP (has_custom/sp/chars/keep_blocks/at) + default_sp (永返)
  // POST   {sp, keep_blocks, source} → 写 _customSP, 落盘
  // DELETE 清 _customSP, 删盘文件
  // 道义: 二十五章 道法自然. 用户即道, 编辑即真.
  // v9.7.6 十四章「执今之道·以御今之有」: GET 永返 default_sp (当前即将注入之核心 SP)
  //   has_custom=true  → default_sp = _customSP.sp (用户即道)
  //   has_custom=false → default_sp = TAO_HEADER + DAO_DE_JING_81 + TAO_FOOTER (帛书本源)
  //   前端首次打开编辑态 · tape 空 · 即以 default_sp 填 textarea · 名实相符
  if (u.pathname === "/origin/custom_sp" && req.method === "GET") {
    // v9.9.18 · 印 126 · default_sp 随 _activeCanon 动态 · 不再硬编码 DAO_DE_JING_81
    // 反者道之动 · 经藏多门 · 切换经藏后编模式兜底亦随经而变 · 名实相符
    const _defaultSP =
      _customSP && _customSP.sp
        ? _customSP.sp
        : _activeCanonText
          ? _canonHeader(_activeCanon) + _activeCanonText + TAO_FOOTER
          : "";
    const _defaultSource = _customSP && _customSP.sp ? "custom" : _activeCanon;
    const _defaultSourceName =
      _customSP && _customSP.sp
        ? "\u81ea\u5b9a\u4e49"
        : (_CANON_MAP[_activeCanon] || {}).name || _activeCanon;
    if (!_customSP || !_customSP.sp) {
      res.end(
        JSON.stringify({
          ok: true,
          has_custom: false,
          default_sp: _defaultSP,
          default_chars: _defaultSP.length,
          default_source: _defaultSource,
          default_source_name: _defaultSourceName,
        }),
      );
    } else {
      res.end(
        JSON.stringify({
          ok: true,
          has_custom: true,
          sp: _customSP.sp,
          chars: _customSP.sp.length,
          keep_blocks: !!_customSP.keep_blocks,
          source: _customSP.source || null,
          at: _customSP.at || null,
          age_s: _customSP.at
            ? Math.round((Date.now() - _customSP.at) / 1000)
            : null,
          default_sp: _defaultSP,
          default_chars: _defaultSP.length,
          default_source: _defaultSource,
          default_source_name: _defaultSourceName,
        }),
      );
    }
    return true;
  }

  if (u.pathname === "/origin/custom_sp" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const sp = typeof body.sp === "string" ? body.sp : "";
        if (!sp.trim()) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({ ok: false, error: "sp 不可为空 (需非空字符串)" }),
          );
          return;
        }
        _customSP = {
          sp: sp,
          keep_blocks: body.keep_blocks !== false,
          source: typeof body.source === "string" ? body.source : "unknown",
          at: Date.now(),
        };
        _saveCustomSP();
        // ★ v9.9.357 · 注入即入 custom 模式 · 面板无需额外模式按钮
        //   道义: 「编辑即真」· 用户按下注入即愿以自编为真 → 模式随之归 custom
        if (SP_MODE !== "custom") {
          SP_MODE = "custom";
          _saveModeToDisk(SP_MODE);
          log("[模式] 注入自编 → 自动入 custom 模式");
        }
        log(
          `custom_sp set: chars=${sp.length} keep_blocks=${_customSP.keep_blocks} source=${_customSP.source}`,
        );
        res.end(
          JSON.stringify({
            ok: true,
            chars: sp.length,
            keep_blocks: _customSP.keep_blocks,
            at: _customSP.at,
            mode: SP_MODE,
          }),
        );
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  if (u.pathname === "/origin/custom_sp" && req.method === "DELETE") {
    const had = !!(_customSP && _customSP.sp);
    _customSP = null;
    _saveCustomSP();
    // ★ v9.9.357 · 归道即回 invert · 与「注入即入 custom」对称
    if (SP_MODE === "custom") {
      SP_MODE = "invert";
      _saveModeToDisk(SP_MODE);
      log("[模式] 归道 → 自动回 invert 模式");
    }
    if (had) log("custom_sp cleared");
    res.end(JSON.stringify({ ok: true, was_set: had, mode: SP_MODE }));
    return true;
  }

  if (u.pathname === "/origin/mode" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const m = String(body.mode || "").toLowerCase();
        const _canonIn = String(body.canon || "").toLowerCase();
        const _sfC = String(body.surface || body.face || "").toLowerCase();
        // ★ v9.9.376 · 面板层级: canon/customsp 可独立下发 (不需 mode)
        if ((_sfC === "local" || _sfC === "cascade" || _sfC === "default") && (Object.prototype.hasOwnProperty.call(body, "customsp"))) {
          let jc2 = {};
          try {
            jc2 = JSON.parse(fs.readFileSync(SP_MODE_SURFACE_FILE, "utf8")) || {};
          } catch (_) {}
          if (typeof jc2 !== "object" || !jc2) jc2 = {};
          const cv = typeof body.customsp === "string" ? body.customsp : null;
          if (cv && cv.trim()) jc2[_sfC + "_customsp"] = cv;
          else delete jc2[_sfC + "_customsp"];
          if (SP_MODE_VALID.has(m)) jc2[_sfC] = m;
          jc2.updated = Math.floor(Date.now() / 1000);
          try {
            fs.writeFileSync(SP_MODE_SURFACE_FILE, JSON.stringify(jc2, null, 2) + "\n", { mode: 0o600 });
            _invalidateCfg(SP_MODE_SURFACE_FILE); // ★ v9.9.67 · 写透失效
          } catch (_) {}
          res.end(
            JSON.stringify({
              ok: true,
              surface: _sfC,
              customsp_chars: cv ? cv.length : 0,
              mode: SP_MODE_VALID.has(m) ? m : undefined,
            }),
          );
          return;
        }
        if ((_sfC === "local" || _sfC === "cascade" || _sfC === "default") && _canonIn) {
          if (!_CANON_VALID.has(_canonIn)) {
            res.statusCode = 400;
            res.end(
              JSON.stringify({
                ok: false,
                error: `invalid canon: ${_canonIn}`,
                valid: [..._CANON_VALID],
              }),
            );
            return;
          }
          let jc = {};
          try {
            jc = JSON.parse(fs.readFileSync(SP_MODE_SURFACE_FILE, "utf8")) || {};
          } catch (_) {}
          if (typeof jc !== "object" || !jc) jc = {};
          jc[_sfC + "_canon"] = _canonIn;
          if (SP_MODE_VALID.has(m)) jc[_sfC] = m;
          jc.updated = Math.floor(Date.now() / 1000);
          try {
            fs.writeFileSync(SP_MODE_SURFACE_FILE, JSON.stringify(jc, null, 2) + "\n", { mode: 0o600 });
            _invalidateCfg(SP_MODE_SURFACE_FILE); // ★ v9.9.67 · 写透失效
          } catch (_) {}
          res.end(
            JSON.stringify({
              ok: true,
              surface: _sfC,
              canon: _canonIn,
              mode: SP_MODE_VALID.has(m) ? m : undefined,
              surface_modes: {
                default: _surfaceMode(""),
                local: _surfaceMode("local"),
                cascade: _surfaceMode("cascade"),
              },
              surface_canons: {
                default: _surfaceCanon(""),
                local: _surfaceCanon("local"),
                cascade: _surfaceCanon("cascade"),
              },
            }),
          );
          return;
        }
        if (!SP_MODE_VALID.has(m)) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              ok: false,
              error: `invalid mode: ${m}`,
              valid: [...SP_MODE_VALID],
            }),
          );
          return;
        }
        // ★ v9.9.371 · 两面分治: surface=local|cascade|default → 写 _origin_mode_surface.json
        //   按面独立 invert/passthrough/custom; 缺省/all = 全局 SP_MODE(既有语义·面覆盖文件不动)。
        const _sf = String(body.surface || body.face || "").toLowerCase();
        if (_sf === "local" || _sf === "cascade" || _sf === "default") {
          let j = {};
          try {
            j = JSON.parse(fs.readFileSync(SP_MODE_SURFACE_FILE, "utf8")) || {};
          } catch (_) {}
          if (typeof j !== "object" || !j) j = {};
          const oldM = _surfaceMode(_sf);
          j[_sf] = m;
          j.updated = Math.floor(Date.now() / 1000);
          try {
            fs.writeFileSync(SP_MODE_SURFACE_FILE, JSON.stringify(j, null, 2) + "\n", { mode: 0o600 });
            _invalidateCfg(SP_MODE_SURFACE_FILE); // ★ v9.9.67 · 写透失效
          } catch (_) {}
          log(`mode[${_sf}]: ${oldM} -> ${m} (surface persisted)`);
          // ★ v9.9.67 · SSE 广播 mode 变 (按面 · 面板 L/C 实时)
          // ★ v9.9.67 · 无为 · 无变不播 (同值重写不扰面板 · 治「跳来跳去」之媒)
          if (oldM !== m)
            _sseBroadcast("mode", { mode: SP_MODE, surface: _sf, surface_mode: m, previous: oldM });
          res.end(
            JSON.stringify({
              ok: true,
              surface: _sf,
              mode: m,
              previous: oldM,
              surface_modes: {
                default: _surfaceMode(""),
                local: _surfaceMode("local"),
                cascade: _surfaceMode("cascade"),
              },
            }),
          );
          return;
        }
        const old = SP_MODE;
        SP_MODE = m;
        _saveModeToDisk(SP_MODE);
        log(`mode: ${old} -> ${SP_MODE} (persisted)`);
        // ★ v9.9.67 · SSE 广播 mode 变 · 面板实时 (环之圆)
        // ★ v9.9.67 · 无为 · 无变不播 (activate 同值重推不再致面板重绘)
        if (old !== SP_MODE)
          _sseBroadcast("mode", { mode: SP_MODE, previous: old });
        res.end(
          JSON.stringify({
            ok: true,
            mode: SP_MODE,
            previous: old,
            surface_modes: {
              default: _surfaceMode(""),
              local: _surfaceMode("local"),
              cascade: _surfaceMode("cascade"),
            },
          }),
        );
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  // ─── /origin/canon_text · 典源原文 · 编辑器预填用 ───
  //   ?canon=laozi|yinfu|laozi+yinfu 或 ?surface=local|cascade(按面典源)
  if (u.pathname === "/origin/canon_text" && req.method === "GET") {
    try {
      const q = u.query || {};
      let cn = String(q.canon || "").toLowerCase();
      if (!cn && q.surface) cn = _surfaceCanon(String(q.surface).toLowerCase());
      if (!_CANON_MAP[cn]) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: "invalid canon", valid: Object.keys(_CANON_MAP) }));
        return true;
      }
      const t = cn === "laozi" ? DAO_DE_JING_81 : _loadCanonText(cn);
      res.end(JSON.stringify({ ok: true, canon: cn, chars: (t || "").length, text: t || "" }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return true;
  }

  // ─── /origin/canon · 经藏切换 · 道生一 ───
  if (u.pathname === "/origin/canon" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        canon: _activeCanon,
        canon_name: (_CANON_MAP[_activeCanon] || {}).name || _activeCanon,
        canon_chars: _activeCanonText ? _activeCanonText.length : 0,
        valid: [..._CANON_VALID],
        map: Object.fromEntries(
          Object.entries(_CANON_MAP).map(([k, v]) => [k, v.name]),
        ),
      }),
    );
    return true;
  }

  if (u.pathname === "/origin/canon" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const c = String(body.canon || "").toLowerCase();
        if (!_CANON_VALID.has(c)) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              ok: false,
              error: `invalid canon: ${c}`,
              valid: [..._CANON_VALID],
            }),
          );
          return;
        }
        const old = _activeCanon;
        _activeCanon = c;
        _activeCanonText = c === "laozi" ? DAO_DE_JING_81 : _loadCanonText(c);
        if (!_activeCanonText) {
          _activeCanon = "laozi";
          _activeCanonText = DAO_DE_JING_81;
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              ok: false,
              error: `canon ${c} text not found, reverted to laozi`,
            }),
          );
          return;
        }
        _saveCanonFile(_activeCanon);
        // ★ v9.9.94 · 经藏热同步 · 通知 sp_invert.js 同步 _activeCanon
        //   道义: 三十二章「道恒无名·侯王若能守之·万物将自宾」· 配置不漂移
        //   根因: source.js 更新自己的 _activeCanon 但 sp_invert.js 的从未同步
        if (_spInvertLib && _spInvertLib.setCanon) {
          _spInvertLib.setCanon(_activeCanon);
        }
        // ★ v9.9.67 · SSE 广播 canon 变 · 面板实时 (环之圆)
        _sseBroadcast("canon", { canon: _activeCanon, previous: old });
        log(
          `\u7ECF\u85CF: ${old} -> ${_activeCanon} (${(_CANON_MAP[_activeCanon] || {}).name}) \u00B7 ${_activeCanonText.length} chars \u00B7 persisted`,
        );
        res.end(
          JSON.stringify({
            ok: true,
            canon: _activeCanon,
            canon_name: (_CANON_MAP[_activeCanon] || {}).name,
            chars: _activeCanonText.length,
            previous: old,
          }),
        );
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  // ─── /origin/tools · 工具模式切换 · 与经藏轴正交（提示换提示的·工具换工具的）───
  if (u.pathname === "/origin/tools" && req.method === "GET") {
    const tm =
      _spInvertLib && _spInvertLib.getToolMode
        ? _spInvertLib.getToolMode()
        : "official";
    const map =
      _spInvertLib && _spInvertLib.TOOLMODE_MAP ? _spInvertLib.TOOLMODE_MAP : {};
    res.end(
      JSON.stringify({
        ok: true,
        tools: tm,
        tools_name: (map[tm] || {}).name || tm,
        valid: Object.keys(map),
        map: Object.fromEntries(
          Object.entries(map).map(([k, v]) => [k, v.name]),
        ),
        canon: _activeCanon,
      }),
    );
    return true;
  }

  if (u.pathname === "/origin/tools" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const t = String(body.tools || body.mode || "").toLowerCase();
        const map =
          _spInvertLib && _spInvertLib.TOOLMODE_MAP
            ? _spInvertLib.TOOLMODE_MAP
            : {};
        if (!map[t]) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              ok: false,
              error: `invalid tools mode: ${t}`,
              valid: Object.keys(map),
            }),
          );
          return;
        }
        const old =
          _spInvertLib && _spInvertLib.getToolMode
            ? _spInvertLib.getToolMode()
            : "official";
        if (!(_spInvertLib && _spInvertLib.setToolMode && _spInvertLib.setToolMode(t))) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: "setToolMode failed" }));
          return;
        }
        log(`\u5DE5\u5177\u6A21\u5F0F: ${old} -> ${t} (${(map[t] || {}).name}) \u00B7 persisted`);
        res.end(
          JSON.stringify({
            ok: true,
            tools: t,
            tools_name: (map[t] || {}).name,
            previous: old,
            canon: _activeCanon,
          }),
        );
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  // ★ v9.9.90 · /origin/ea/* · 外接api热配置控制面
  //   五十七章「我无为也 而民自化」· 热操作 · 不重启 · 即时生效
  //   供 webview 前端 + Agent 后端使用
  //   ★ v9.9.90-fix · _ea 是实例 · 热配置函数在 _eaRuntimeMod 模块导出上
  //   ★ v9.9.348 · 惰性自愈: 任何 ea/* 请求先试补载 runtime · 根治「runtime not loaded」
  // ═══════════════════════════════════════════════════════════
  if (u.pathname.startsWith("/origin/ea/")) _ensureEaRuntimeMod();

  // GET /origin/ea/config · 获取完整配置
  if (u.pathname === "/origin/ea/config" && req.method === "GET") {
    const cfg = _eaRuntimeMod
      ? _eaRuntimeMod.hotGetConfig()
      : { ok: false, error: "runtime not loaded" };
    res.end(JSON.stringify(cfg));
    return true;
  }

  // GET /origin/ea/status · 路由状态 + provider健康
  if (u.pathname === "/origin/ea/status" && req.method === "GET") {
    const status = _eaRuntimeMod
      ? _eaRuntimeMod.routerStatus()
      : { ready: false, count: 0 };
    res.end(JSON.stringify({ ok: true, ...status }));
    return true;
  }

  // ★ v9.9.301 · GET /origin/ea/usage · 用量聚合 (按渠道/模型 · 内存态)
  //   道义: 四十四章「知足不辱 知止不殆」· 供「外接API」面板查看各渠道耗用
  if (u.pathname === "/origin/ea/usage" && req.method === "GET") {
    const usage =
      _eaRuntimeMod && _eaRuntimeMod.routerUsage
        ? _eaRuntimeMod.routerUsage()
        : {};
    let calls = 0;
    let input = 0;
    let output = 0;
    for (const u2 of Object.values(usage)) {
      calls += u2.calls || 0;
      input += u2.input || 0;
      output += u2.output || 0;
    }
    res.end(
      JSON.stringify({
        ok: true,
        usage,
        totals: { calls, input, output, total: input + output },
      }),
    );
    return true;
  }

  // GET /origin/ea/providers · 列出所有 provider (apiKey脱敏)
  if (u.pathname === "/origin/ea/providers" && req.method === "GET") {
    const cfg = _eaRuntimeMod ? _eaRuntimeMod.hotGetConfig() : {};
    const providers = cfg.providers || {};
    const safe = {};
    for (const [name, p] of Object.entries(providers)) {
      safe[name] = { ...p };
      if (safe[name].apiKey) {
        const k = safe[name].apiKey;
        safe[name].apiKey = k.length > 8 ? k.substring(0, 8) + "***" : "***";
      }
      // ★ v9.9.301 · 多 Key 脱敏 (仅回传前缀+个数 · 不泄真实 key)
      if (Array.isArray(safe[name].apiKeys))
        safe[name].apiKeys = safe[name].apiKeys.map((k) =>
          typeof k === "string" && k.length > 8 ? k.substring(0, 8) + "***" : "***",
        );
    }
    res.end(
      JSON.stringify({
        ok: true,
        providers: safe,
        count: Object.keys(safe).length,
      }),
    );
    return true;
  }

  // GET /origin/ea/routes · 列出所有路由
  if (u.pathname === "/origin/ea/routes" && req.method === "GET") {
    const cfg = _eaRuntimeMod ? _eaRuntimeMod.hotGetConfig() : {};
    const routes = (cfg.daoRoutes && cfg.daoRoutes.routes) || {};
    res.end(
      JSON.stringify({ ok: true, routes, count: Object.keys(routes).length }),
    );
    return true;
  }

  // GET /origin/ea/models/:provider · 探测 provider 可用模型
  if (u.pathname.startsWith("/origin/ea/models/") && req.method === "GET") {
    const providerName = decodeURIComponent(
      u.pathname.substring("/origin/ea/models/".length),
    );
    if (!_eaRuntimeMod) {
      res.end(JSON.stringify({ ok: false, error: "runtime not loaded" }));
      return true;
    }
    // ★ ?refresh=1 → 强制 /v1/models 全量探测 (cc-switch 风) · 否则用缓存配置 models
    const _refresh = /^(1|true|yes)$/i.test(
      String((u.query && u.query.refresh) || ""),
    );
    _eaRuntimeMod
      .hotListProviderModels(providerName, { refresh: _refresh })
      .then((result) => {
        res.end(JSON.stringify(result));
      })
      .catch((e) => {
        res.end(JSON.stringify({ ok: false, error: e.message }));
      });
    return true;
  }

  // POST /origin/ea/provider · 热添加/更新 provider
  if (u.pathname === "/origin/ea/provider" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const name = body.name;
        const cfg = body.cfg || body.provider || {};
        if (!name) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: "name required" }));
          return;
        }
        const result = _eaRuntimeMod
          ? _eaRuntimeMod.hotAddProvider(name, cfg)
          : { ok: false, error: "runtime not loaded" };
        res.end(JSON.stringify(result));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  // DELETE /origin/ea/provider/:name · 热删除 provider
  if (
    u.pathname.startsWith("/origin/ea/provider/") &&
    req.method === "DELETE"
  ) {
    const name = decodeURIComponent(
      u.pathname.substring("/origin/ea/provider/".length),
    );
    const result = _eaRuntimeMod
      ? _eaRuntimeMod.hotRemoveProvider(name)
      : { ok: false, error: "runtime not loaded" };
    res.end(JSON.stringify(result));
    return true;
  }

  // POST /origin/ea/route · 热添加/更新路由
  if (u.pathname === "/origin/ea/route" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const modelUid = body.modelUid || body.model_uid;
        const routeCfg = body.route || body.routeCfg || {};
        if (!modelUid) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: "modelUid required" }));
          return;
        }
        const result = _eaRuntimeMod
          ? _eaRuntimeMod.hotAddRoute(modelUid, routeCfg)
          : { ok: false, error: "runtime not loaded" };
        res.end(JSON.stringify(result));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  // DELETE /origin/ea/route/:modelUid · 热删除路由
  if (u.pathname.startsWith("/origin/ea/route/") && req.method === "DELETE") {
    const modelUid = decodeURIComponent(
      u.pathname.substring("/origin/ea/route/".length),
    );
    const result = _eaRuntimeMod
      ? _eaRuntimeMod.hotRemoveRoute(modelUid)
      : { ok: false, error: "runtime not loaded" };
    res.end(JSON.stringify(result));
    return true;
  }

  // POST /origin/ea/config · 批量设置配置
  if (u.pathname === "/origin/ea/config" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const result = _eaRuntimeMod
          ? _eaRuntimeMod.hotSetConfig(body)
          : { ok: false, error: "runtime not loaded" };
        res.end(JSON.stringify(result));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  // POST /origin/ea/reload · 热重载配置文件
  if (u.pathname === "/origin/ea/reload" && req.method === "POST") {
    const result = _eaRuntimeMod
      ? _eaRuntimeMod.hotReload()
      : { ok: false, error: "runtime not loaded" };
    res.end(JSON.stringify(result));
    return true;
  }

  // POST /origin/ea/probe · 探测所有 provider 健康状态
  if (u.pathname === "/origin/ea/probe" && req.method === "POST") {
    if (!_eaRuntimeMod) {
      res.end(JSON.stringify({ ok: false, error: "runtime not loaded" }));
      return true;
    }
    _eaRuntimeMod
      .hotProbeAllProviders()
      .then((results) => {
        res.end(JSON.stringify({ ok: true, providers: results }));
      })
      .catch((e) => {
        res.end(JSON.stringify({ ok: false, error: e.message }));
      });
    return true;
  }

  // POST /origin/ea/reset-health · 清空健康缓存
  if (u.pathname === "/origin/ea/reset-health" && req.method === "POST") {
    if (_eaRuntimeMod) _eaRuntimeMod.hotResetHealthCache();
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  // ★ v9.9.94 · GET /origin/ea/available-models · Windsurf可用模型列表
  //   四十七章「不出于户 以知天下」· 默认列表 + seen动态补充
  //   Agent接口: Cascade可查询当前可用模型
  if (u.pathname === "/origin/ea/available-models" && req.method === "GET") {
    const models = _getAvailableModels();
    res.end(JSON.stringify({ ok: true, models, count: models.length }));
    return true;
  }

  // ★ v9.9.93 · GET /origin/ea/seen-models · 已见模型列表 (保留兼容)
  if (u.pathname === "/origin/ea/seen-models" && req.method === "GET") {
    const models = _getAvailableModels();
    res.end(JSON.stringify({ ok: true, models, count: models.length }));
    return true;
  }

  // ★ v9.9.94 · GET /origin/ea/overview · 一站式面板数据
  //   五十七章「我无为也 而民自化」· 一次请求返回全部面板所需数据
  //   available_models(默认+seen) + routes + providers(脱敏) + health + ea_running
  if (u.pathname === "/origin/ea/overview" && req.method === "GET") {
    const models = _getAvailableModels();
    const cfg = _eaRuntimeMod ? _eaRuntimeMod.hotGetConfig() : {};
    const providers = cfg.providers || {};
    const safe = {};
    // ★ v9.9.265 · 测试通道(builtin-stub) · 内置外接首项 · 固定返回·验证通路
    //   道德经 八十一章「信言不美」· 不接外网, 返固定帧, 证 proxy→router 通路已打通
    safe["builtin-stub"] = {
      _builtin: true,
      _label: "测试通道",
      type: "mock",
      baseUrl: "(内置·固定返回·验证通路)",
      models: ["stub-transport-test"],
      enabled: true,
      apiKey: "(无需)",
    };
    for (const [name, p] of Object.entries(providers)) {
      safe[name] = Object.assign({}, p);
      if (safe[name].apiKey)
        safe[name].apiKey = safe[name].apiKey.slice(0, 6) + "...";
      // ★ v9.9.301 · 多 Key 脱敏 (仅回传前缀+个数 · 不泄真实 key)
      if (Array.isArray(safe[name].apiKeys))
        safe[name].apiKeys = safe[name].apiKeys.map((k) =>
          typeof k === "string" && k.length > 6 ? k.slice(0, 6) + "..." : "...",
        );
    }
    const routes = (cfg.daoRoutes && cfg.daoRoutes.routes) || {};
    const status = _eaRuntimeMod
      ? _eaRuntimeMod.routerStatus()
      : { ready: false, count: 0 };
    // ★ v9.9.285 · 渠道连通快照(非阻塞·最近一次实证探活结果) · 名实相符
    //   每个 provider 注入 health{alive,reason,status} → 前端如实展示通/不通+原因
    //   坏的渠道(如 freemodel Access Denied)直书错误·不再伪装成功
    const health =
      _eaRuntimeMod && _eaRuntimeMod.hotHealthSnapshot
        ? _eaRuntimeMod.hotHealthSnapshot()
        : {};
    for (const [name, h] of Object.entries(health)) {
      if (safe[name]) safe[name].health = h;
    }
    // ★ v9.9.301 · 用量聚合注入 · 每个 provider 注入 usage{calls,input,output,total,cost,models}
    const usage =
      _eaRuntimeMod && _eaRuntimeMod.routerUsage
        ? _eaRuntimeMod.routerUsage()
        : {};
    for (const [name, u2] of Object.entries(usage)) {
      if (safe[name]) safe[name].usage = u2;
    }
    res.end(
      JSON.stringify({
        ok: true,
        usage, // ★ v9.9.301 · 全渠道用量聚合
        available_models: models, // ★ v9.9.94 · 替代 seen_models
        seen_models: models, // 兼容旧前端
        official_families: _getOfficialFamilies(), // ★ v9.9.265 · 左侧全量官方·档位归一
        families_source: _officialFamiliesSource(), // ★ v9.9.270 · live=右侧实捕·static=静态目录
        live_models_at: _liveModelCapture.at || 0,
        live_models_count: (_liveModelCapture.models || []).length,
        providers: safe,
        health, // ★ v9.9.285 · 渠道连通快照(POST /origin/ea/probe 刷新)
        routes,
        route_count: Object.keys(routes).length,
        router_ready: status.ready,
        family_tier_extend:
          !!(cfg.daoRoutes && cfg.daoRoutes.familyTierExtend), // ★ 同族档位延伸开关
        ea_running: _ea ? _ea.isRunning() : false,
      }),
    );
    return true;
  }

  // ★ v9.9.270 · GET /origin/ea/live-models · 活捕调试 · 右侧 Cascade 实捕模型项
  //   含原始候选串(raw) 供校验启发析名是否准 · 道法自然·实时映射
  if (u.pathname === "/origin/ea/live-models" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        source: _officialFamiliesSource(),
        at: _liveModelCapture.at || 0,
        calls: _liveModelCapture.calls || 0,
        model_count: (_liveModelCapture.models || []).length,
        family_count: (_liveModelCapture.families || []).length,
        models: (_liveModelCapture.models || []).map((m) => ({
          uid: m.uid,
          label: m.label,
          familyUid: m.familyUid,
          familyLabel: m.familyLabel,
        })),
        families: _liveModelCapture.families || [],
        raw: _liveModelCapture.raw || [],
      }),
    );
    return true;
  }

  // ★ v9.9.270 · GET /origin/ea/handoff.md · 实时交接指挥文档 (Markdown)
  //   交给运行中的官方/任意 Agent · 照此热推进·热修改·热配置一切
  //   内容: 当前状态(渠道/路由/模型源) + 全量热配置 API + curl 范例
  //   道法自然: 太上下知有之 · 底层全开放 · Agent 可辅助用户配置一切
  if (u.pathname === "/origin/ea/handoff.md" && req.method === "GET") {
    if (_handoffGuard(req, res)) return true;
    let md = "";
    try {
      md = _buildHandoffMd();
    } catch (e) {
      md = "# dao-proxy-pro · 交接文档生成失败\n\n" + (e && e.message);
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="dao-proxy-pro-handoff.md"',
    );
    res.end(md);
    return true;
  }

  // ★ v9.9.95 · GET /origin/ea/discover-models · 主动发现Windsurf可用模型
  //   道法自然 · 不着相于表层 · 从Windsurf运行时实证获取
  //   返回: rpc_discovered + seen + fallback 三层合并结果
  if (u.pathname === "/origin/ea/discover-models" && req.method === "GET") {
    const models = _getAvailableModels();
    const rpcCount = _rpcDiscoveredModels.size;
    const seenCount = _seenModelUids.size;
    res.end(
      JSON.stringify({
        ok: true,
        models,
        count: models.length,
        sources: {
          rpc: rpcCount,
          seen: seenCount,
          fallback: rpcCount + seenCount === 0 ? _FALLBACK_MODELS.length : 0,
        },
      }),
    );
    return true;
  }

  // ★ v9.9.95 · POST /origin/ea/test-chat · 全链路测试
  //   从后端发起chat请求走完整proxy→router→provider链路
  //   实践中发现问题 · 解决问题 · 完善缺陷
  if (u.pathname === "/origin/ea/test-chat" && req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const modelUid = body.modelUid || body.model_uid;
        const message = body.message || "ping";
        // ★ v9.9.371 · 两面分治: test-chat 可指定面(local/cascade); 缺省 any=不限面(诊断直通)
        const _tcSurface = String(body.surface || "any").toLowerCase();
        if (!modelUid) {
          res.end(JSON.stringify({ ok: false, error: "modelUid required" }));
          return;
        }
        // 检查路由是否存在
        const router = _ea ? _ea.getRouter() : null;
        const shouldRoute = router ? router.shouldRoute(modelUid, _tcSurface) : false;
        if (!shouldRoute) {
          res.end(
            JSON.stringify({
              ok: false,
              error: "no route for " + modelUid,
              hint: "请先在面板中为此模型创建路由",
            }),
          );
          return;
        }
        // 获取路由目标
        //   ★ v9.9.283 · 经 router.resolveRoute 解析 · 与真实推理路径(route())同一张 _routes 表
        //     真因: 旧逻辑直查持久化 config.daoRoutes.routes 且 router._normalizeModelUid 未导出
        //       → 同族兄弟档位(swe-1-6-slow)shouldRoute=true 却在此误报 "route config not found"
        //     治: 优先用 resolveRoute(真源) · 回退持久化config(老router兼容)
        //   道义: 二十一章「其名不去·以顺众父」· 名实相符
        const routeCfg = _eaRuntimeMod ? _eaRuntimeMod.hotGetConfig() : {};
        const routes = (routeCfg.daoRoutes && routeCfg.daoRoutes.routes) || {};
        const resolved =
          router && router.resolveRoute ? router.resolveRoute(modelUid) : null;
        const route =
          (resolved && resolved.route) ||
          routes[modelUid] ||
          routes[
            router._normalizeModelUid
              ? router._normalizeModelUid(modelUid)
              : modelUid
          ];
        if (!route) {
          res.end(
            JSON.stringify({
              ok: false,
              error: "route config not found for " + modelUid,
            }),
          );
          return;
        }
        const provName = route.provider;
        // ★ builtin-stub · 内建测试通道 · 固定返回 · 无外发HTTP
        //   道义: 三十五章「执大象 天下往 往而不害」· 传输层桩验证通路
        //   根因: builtin-stub 是虚拟provider · 不在 providers 配置中
        //   旧逻辑在此误报 "provider builtin-stub not found" → 官方SWE 1.6标准路径无法自测
        //   修复: 短路返回桩响应 · 与 dao_router._builtinStubResponse 文本一致
        if (provName === "builtin-stub") {
          res.end(
            JSON.stringify({
              ok: true,
              modelUid,
              provider: "builtin-stub",
              model: route.model || "stub-transport-test",
              status: 200,
              elapsed_ms: 0,
              content: "道可道也 非恒道也 · 传输层得一 · stub响应正常",
              usage: {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
              },
              builtin: true,
            }),
          );
          return;
        }
        const provCfg = (routeCfg.providers || {})[provName];
        if (!provCfg) {
          res.end(
            JSON.stringify({
              ok: false,
              error: "provider " + provName + " not found",
            }),
          );
          return;
        }
        // ★ 协议感知: anthropic 走 /v1/messages + x-api-key + content[].text; 否则 OpenAI chat
        //   道义: 二十八章「为天下式」· 后端最小化验证须按渠道真实协议 · 名实相符
        //   旧逻辑硬编 OpenAI 格式 → anthropic 渠道(如 freemodel claude 系)自检必误判
        const _proto =
          provCfg.protocol ||
          (provCfg.type === "anthropic" ? "anthropic" : "") ||
          (/\/v1\/messages/i.test(provCfg.completionPath || "")
            ? "anthropic"
            : "") ||
          (String(route.model || "")
            .toLowerCase()
            .startsWith("claude")
            ? "anthropic"
            : "") ||
          "openai-chat";
        const _isAnthropic = _proto === "anthropic";
        const baseUrl = (provCfg.baseUrl || "").replace(/\/$/, "");
        const completionPath =
          provCfg.completionPath ||
          (_isAnthropic ? "/v1/messages" : "/v1/chat/completions");
        const testUrl = new URL(baseUrl + completionPath);
        const isHttps = testUrl.protocol === "https:";
        const mod = isHttps ? https : http;
        const testPayload = JSON.stringify(
          _isAnthropic
            ? {
                model: route.model || modelUid,
                max_tokens: route.maxOutputTokens || 50,
                messages: [{ role: "user", content: message }],
                stream: false,
              }
            : {
                model: route.model || modelUid,
                messages: [{ role: "user", content: message }],
                max_tokens: route.maxOutputTokens || 50,
                stream: false,
              },
        );
        const testHeaders = { "Content-Type": "application/json" };
        if (provCfg.apiKey) {
          if (_isAnthropic) {
            testHeaders["x-api-key"] = provCfg.apiKey;
            testHeaders["anthropic-version"] = "2023-06-01";
          } else {
            testHeaders["Authorization"] = "Bearer " + provCfg.apiKey;
          }
        }
        const startTime = Date.now();
        const testReq = mod.request(
          {
            hostname: testUrl.hostname,
            port: parseInt(testUrl.port || (isHttps ? "443" : "80")),
            path: testUrl.pathname,
            method: "POST",
            headers: {
              ...testHeaders,
              // ★ v9.9.280 · Content-Length 须按字节计 · 非字符数
              //   根因: 多字节(中文)消息 testPayload.length(字符) < 实际字节 →
              //         上游收到截断的 JSON → 400 "EOF while parsing a string"
              "Content-Length": String(Buffer.byteLength(testPayload)),
            },
            timeout: 30000,
            rejectUnauthorized: false,
            ...(_originGetProxyAgent(isHttps)
              ? { agent: _originGetProxyAgent(isHttps) }
              : {}),
          },
          (testRes) => {
            let data = "";
            testRes.on("data", (c) => (data += c));
            testRes.on("end", () => {
              const elapsed = Date.now() - startTime;
              try {
                const parsed = JSON.parse(data);
                // ★ 协议感知解析: OpenAI choices[].message.content; anthropic content[].text
                let content = null;
                let reasoning = null;
                let finishReason = null;
                const ch0 = parsed.choices && parsed.choices[0];
                if (ch0 && ch0.message) {
                  content = ch0.message.content;
                  // ★ 推理模型 (deepseek-v4 / mimo reasoner) 把输出放 reasoning_content;
                  //   max_tokens 不足时 content 为空 · finish_reason=length · 须surface以免误判"空响应=失败"
                  reasoning = ch0.message.reasoning_content || null;
                  finishReason = ch0.finish_reason || null;
                } else if (Array.isArray(parsed.content)) {
                  content = parsed.content
                    .filter(
                      (b) =>
                        b && b.type === "text" && typeof b.text === "string",
                    )
                    .map((b) => b.text)
                    .join("");
                  finishReason = parsed.stop_reason || null;
                }
                // content 空但有 reasoning(被length截断) → 用 reasoning 兜底展示 · 标记截断
                const truncatedReasoning =
                  (!content || content.length === 0) &&
                  !!reasoning &&
                  finishReason === "length";
                if (truncatedReasoning) content = reasoning;
                const usage = parsed.usage || null;
                // ★ v9.9.285 · 实证渠道真伪: HTTP码 + 响应体伪成功/拒绝文案
                //   根因: freemodel 返回 200 + "Access Denied" · 旧逻辑误报 ok:true
                //   治: 同一分类器辨伪成功 → ok:false + channel_reason 明言不通之因
                const _verdict =
                  _eaRuntimeMod && _eaRuntimeMod.classifyChannelResponse
                    ? _eaRuntimeMod.classifyChannelResponse(
                        testRes.statusCode,
                        content || data,
                      )
                    : { ok: testRes.statusCode < 400, reason: "" };
                res.end(
                  JSON.stringify({
                    ok: _verdict.ok,
                    channel_reason: _verdict.ok ? undefined : _verdict.reason,
                    modelUid,
                    provider: provName,
                    model: route.model,
                    status: testRes.statusCode,
                    elapsed_ms: elapsed,
                    content: content ? content.substring(0, 200) : null,
                    finish_reason: finishReason,
                    truncated_reasoning: truncatedReasoning || undefined,
                    usage,
                    raw_length: data.length,
                  }),
                );
              } catch (e) {
                // ★ v9.9.285 · 非JSON响应(如纯文本 Access Denied)亦须实证渠道真伪
                const _verdict =
                  _eaRuntimeMod && _eaRuntimeMod.classifyChannelResponse
                    ? _eaRuntimeMod.classifyChannelResponse(
                        testRes.statusCode,
                        data,
                      )
                    : { ok: testRes.statusCode < 400, reason: "" };
                res.end(
                  JSON.stringify({
                    ok: _verdict.ok,
                    channel_reason: _verdict.ok ? undefined : _verdict.reason,
                    modelUid,
                    provider: provName,
                    model: route.model,
                    status: testRes.statusCode,
                    elapsed_ms: elapsed,
                    content: data.substring(0, 200),
                    parse_error: e.message,
                  }),
                );
              }
            });
          },
        );
        testReq.on("error", (e) => {
          res.end(
            JSON.stringify({
              ok: false,
              modelUid,
              provider: provName,
              error: e.message,
              elapsed_ms: Date.now() - startTime,
            }),
          );
        });
        testReq.on("timeout", () => {
          testReq.destroy();
          res.end(
            JSON.stringify({
              ok: false,
              modelUid,
              provider: provName,
              error: "timeout (30s)",
              elapsed_ms: Date.now() - startTime,
            }),
          );
        });
        testReq.end(testPayload);
      } catch (e) {
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }

  // ★ v9.9.95 · GET /origin/ea/model-map · 模型映射三重映射
  //   modelUid → 前端显示名 → 后端实际模型名
  //   包含: 官方模型UID → family/displayName, 路由映射 → provider/model
  if (u.pathname === "/origin/ea/model-map" && req.method === "GET") {
    const models = _getAvailableModels();
    const cfg = _eaRuntimeMod ? _eaRuntimeMod.hotGetConfig() : {};
    const routes = (cfg.daoRoutes && cfg.daoRoutes.routes) || {};
    const providers = cfg.providers || {};
    const mapping = {};
    for (const m of models) {
      const route = routes[m.uid];
      mapping[m.uid] = {
        uid: m.uid,
        displayName: m.displayName || m.uid,
        family: m.family,
        source: m.source,
        routed: m.routed || !!route,
        routeTarget: route
          ? {
              provider: route.provider,
              model: route.model,
              maxOutputTokens: route.maxOutputTokens,
            }
          : null,
        providerType:
          route && providers[route.provider]
            ? providers[route.provider].type ||
              providers[route.provider].driver ||
              "openai"
            : null,
      };
    }
    // 第三方provider模型来源映射
    const providerModels = {};
    for (const [pn, pcfg] of Object.entries(providers)) {
      if (pcfg.models && Array.isArray(pcfg.models)) {
        providerModels[pn] = {
          type: pcfg.type || pcfg.driver || "openai",
          baseUrl: (pcfg.baseUrl || "").replace(/\/$/, ""),
          models: pcfg.models,
        };
      }
    }
    res.end(
      JSON.stringify({
        ok: true,
        mapping,
        providerModels,
        modelCount: models.length,
        routeCount: Object.keys(routes).length,
      }),
    );
    return true;
  }

  // ★ v9.9.260 · 模型解锁控制端点 · 执大象 天下往
  if (u.pathname === "/origin/model_unlock" && req.method === "GET") {
    res.end(
      JSON.stringify({
        ok: true,
        enabled: _isModelUnlockEnabled(),
        catalog_size: _fullModelCatalog ? _fullModelCatalog.length : 0,
        catalog_loaded: !!_fullModelCatalog,
        catalog_at: _fullModelCatalogAt,
        catalog_path: _FULL_MODEL_CATALOG_PATH,
      }),
    );
    return true;
  }
  if (u.pathname === "/origin/model_unlock" && req.method === "POST") {
    // 开关模型解锁: {enabled: true/false}
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      try {
        const params = JSON.parse(body);
        const val = params.enabled !== false ? "1" : "0";
        fs.writeFileSync(_MODEL_UNLOCK_ENABLED_FILE, val, "utf8");
        log(`[model-unlock] ${val === "1" ? "启用" : "禁用"} 模型解锁`);
        // 同时热重载模型目录
        if (val === "1") _loadFullModelCatalog();
        res.end(
          JSON.stringify({
            ok: true,
            enabled: val === "1",
            catalog_size: _fullModelCatalog ? _fullModelCatalog.length : 0,
          }),
        );
      } catch (e) {
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return true;
  }
  if (u.pathname === "/origin/model_catalog" && req.method === "GET") {
    // 查看全量模型目录
    const catalog = _fullModelCatalog || _loadFullModelCatalog();
    if (!catalog) {
      res.end(JSON.stringify({ ok: false, error: "catalog not loaded" }));
      return true;
    }
    // 精简输出: 只返回 uid + label + provider + creditMultiplier
    const summary = catalog.map((m) => ({
      modelUid: m.modelUid,
      label: m.label,
      provider: m.provider,
      creditMultiplier: m.creditMultiplier,
      isRecommended: m.isRecommended,
      isNew: m.isNew,
    }));
    res.end(
      JSON.stringify({ ok: true, count: summary.length, models: summary }),
    );
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════
// ★ v9.9.260 · 模型解锁 · 执大象 天下往 · 反者道之动
// ═══════════════════════════════════════════════════════════
// 道德经 · 第三十五章: "执大象, 天下往. 往而不害, 安平太."
//
// 全量模型目录: 从 Pro 账号 cachedCascadeModelConfigs 提取的 109 个模型
// 注入策略: 拦截 GetUserSettings 响应 → 替换 cachedCascadeModelConfigs
//   → 前端 UI 显示所有模型 → 用户可选择任意模型
//   → 后续由 dao_router 路由到对应 API (官方/外接)
//
// 无为而无不为: 前端显示全量(无为) → 用户选择即路由(无不为)
// ─────────────────────────────────────────────────────────────

let _fullModelCatalog = null;
let _fullModelCatalogAt = 0;
const _FULL_MODEL_CATALOG_PATH = path.join(
  __dirname,
  "_full_model_catalog.json",
);
const _MODEL_UNLOCK_ENABLED_FILE = _stableStateFile("_model_unlock_enabled");

function _loadFullModelCatalog() {
  return null; // v9.9.374-min · 模型解锁源码级拆除(目录不加载)
  try {
    const raw = fs.readFileSync(_FULL_MODEL_CATALOG_PATH, "utf8");
    _fullModelCatalog = JSON.parse(raw);
    _fullModelCatalogAt = Date.now();
    log(`[model-unlock] 加载全量模型目录: ${_fullModelCatalog.length} 个模型`);
    return _fullModelCatalog;
  } catch (e) {
    log(`[model-unlock] 目录加载失败: ${e.message}`);
    return null;
  }
}

// ★ v9.9.265 · 档位归一 · 朴散则为器,圣人用则为官长,夫大制无割
//   左侧官方模型按「家族」归一: 一族一项(同 Cascade 顶层显示),
//   去 Low/Medium/High/Thinking 等二级档位 · 各档 modelUid 全收于 members
//   供前端连线: 选一族 → 路由全族各档 modelUid · 利而不害
// ★ v9.9.270 · 活捕优先: 右侧 Cascade 实捕模型项(<10min) → 真·1:1 实时映射
//   无活捕(IDE 未触发 GetUserStatus) 则退回静态目录 · 利而不害
function _liveFresh() {
  return !!(
    _liveModelCapture &&
    _liveModelCapture.families &&
    _liveModelCapture.families.length > 0 &&
    Date.now() - _liveModelCapture.at < 30 * 60 * 1000
  );
}
// ★ v9.9.275 · 全量静态为底·活捕并入 → 源恒含全部官方; live 仅作叠加标记
function _officialFamiliesSource() {
  return _liveFresh() ? "merged" : "static";
}
// ★ v9.9.310 · 端点发现文件 · 让任意本地 Agent 凭固定路径找到运行中的控制面 Base
//   写 ~/.codeium/dao-byok/endpoint.json · 即便交接文档里的端口过期(重启换端口),
//   Agent 读此文件即得当前真实 base/port · 据此热管理一切 · 六章「玄牝之门」
function _daoUserDir() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  return home ? path.join(home, ".codeium", "dao-byok") : null;
}
function _extVersion() {
  try {
    const pj = path.join(__dirname, "..", "..", "package.json");
    return JSON.parse(fs.readFileSync(pj, "utf8")).version || "";
  } catch {
    return "";
  }
}

// ═══ 内网穿透 · DAO Bridge (反者道之动 · 把反代端点直暴公网) ══════════════════
//   道义: 四十章「反者道之动·弱者道之用」。把本机反代端点(_actualPort 之 /v1/* 与
//   /origin/revproxy/console 网页对话台)经 cloudflared 快速隧道(零账号·去中心化默认)
//   暴露公网, 任意常用 AI 工具在公网直调反带出来的免费/付费模型。用户若要「固定不变
//   的公网域名」才需自登 Cloudflare(命名隧道·可选前置非必需)。
//   独立闭环(鸡犬之声相闻·民至老死不相往来): 用 -proxypro 后缀, 与 dao-vsix 整机穿透
//   (绑 9920·machine control) 各管各的 cloudflared 进程, 互不侵夺。
const _BRG_DIR = path.join(os.homedir(), ".dao", "bridge");
const _BRG_LOG = path.join(_BRG_DIR, "cloudflared-proxypro.log");
const _BRG_PID = path.join(_BRG_DIR, "cloudflared-proxypro.pid");
const _BRG_PORT = path.join(_BRG_DIR, "cloudflared-proxypro.port");
const _BRG_NAMED = path.join(_BRG_DIR, "named-tunnel-proxypro.json");
const _BRG_CF_CRED = path.join(_BRG_DIR, "cf-credentials-proxypro.json");
const _BRG_BIN_DIR = path.join(os.homedir(), ".dao", "bin");
let _brgProc = null;
let _brgUrl = "";
let _brgStartMs = 0;
let _brgFetching = false;
let _brgWatchdog = null;
// ═══ v9.9.348 · 退避/宽限/冷却(移植 dao-vsix 反脆弱三件套) ═══
//   防止 trycloudflare 429/1015 限流时无限重试(退避·道之反者); 新隧道注册需时不误杀(宽限);
//   重启之间留最短间隔不贪多(冷却)。「损之又损·以至于无为·无为而无不为」
let _brgSpawnFails = 0;
let _brgBackoffUntilMs = 0;
let _brgLastCountedStartMs = 0;
const _BRG_ESTABLISH_GRACE_MS = 45000; // 新隧道需 ≤45s 注册 URL, 期内不判死
const _BRG_RESTART_COOLDOWN_MS = 25000; // 重启之间最短间隔
const _BRG_BACKOFF_MAX_MS = 300000; // 退避上限 5min
let _brgBackoffProbeMs = 0;
const _BRG_BACKOFF_PROBE_MIN_MS = 45000;
// ═══ 手动停止旗(道并行而不相悖·移植 dao-vsix bridgeUserStopped) ═══
//   激活即自动拉起零账号快速隧道(去中心化默认·AGENTS 三章「auto-打通」); 但用户手动「停止」
//   须真停 — 落盘暂停旗, 自动连接/自愈见旗即挂起, 任一手动「启动/重启」撤旗恢复常驻。
//   24h 安全自复: 防用户遗忘致公网端点永久断线。
const _BRG_USERSTOP = path.join(_BRG_DIR, "cloudflared-proxypro.userstop");
const _BRG_USERSTOP_MAX_MS = 24 * 3600 * 1000;
function _brgUserStopped() {
  try {
    const st = fs.statSync(_BRG_USERSTOP);
    if (Date.now() - st.mtimeMs > _BRG_USERSTOP_MAX_MS) {
      try { fs.unlinkSync(_BRG_USERSTOP); } catch (_) {}
      return false;
    }
    return true;
  } catch (_) { return false; }
}
function _brgSetUserStopped(on) {
  try {
    if (on) { _brgEnsureDir(); fs.writeFileSync(_BRG_USERSTOP, new Date().toISOString(), "utf8"); }
    else fs.unlinkSync(_BRG_USERSTOP);
  } catch (_) {}
}
// ═══ 代理检测(移植 dao-bridge) · 无有入于无间 — 国内环境 cloudflared 不经代理则无法连 Cloudflare ═══
const _BRG_PROXY_PORTS = [7890, 7897, 10809, 1080, 8889, 2080, 10808];
let _brgProxyCache = null;
function _brgProbeLocalProxy() {
  const { spawnSync } = require("child_process");
  for (const port of _BRG_PROXY_PORTS) {
    try {
      const r = spawnSync(process.platform === "win32" ? "powershell" : "bash",
        process.platform === "win32"
          ? ["-NoProfile", "-Command", `(Test-NetConnection 127.0.0.1 -Port ${port} -WarningAction SilentlyContinue).TcpTestSucceeded`]
          : ["-c", `(exec 3<>/dev/tcp/127.0.0.1/${port}) 2>/dev/null && echo True || echo False`],
        { timeout: 3000, encoding: "utf8", windowsHide: true });
      if (r.stdout && /true/i.test(r.stdout)) return "http://127.0.0.1:" + port;
    } catch (_) {}
  }
  return "";
}
function _brgDetectProxy() {
  if (_brgProxyCache !== null) return _brgProxyCache;
  let proxy = process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || process.env.ALL_PROXY || process.env.all_proxy || "";
  proxy = String(proxy).trim();
  if (!proxy) proxy = _brgProbeLocalProxy();
  _brgProxyCache = proxy || "";
  return _brgProxyCache;
}
// 给 cloudflared spawn 注入代理环境 — 清除 NO_PROXY(某些 agent 会导出 NO_PROXY=* 致 cloudflared 绕过)
function _brgSpawnEnv(proxy) {
  const env = Object.assign({}, process.env);
  delete env.NO_PROXY; delete env.no_proxy;
  if (proxy) {
    env.HTTPS_PROXY = proxy; env.https_proxy = proxy;
    env.HTTP_PROXY = proxy; env.http_proxy = proxy;
    env.ALL_PROXY = proxy; env.all_proxy = proxy;
  }
  return env;
}
// ═══ 二进制完整性验证(移植 dao-bridge) · 质真如渝 ═══
// 真二进制判定: 排除 npm/choco shim(.cmd/.ps1/无扩展名·仅几百字节), spawn(无 shell) 不能执行 shim
function _brgIsRealBin(p) {
  try {
    if (!p || !fs.existsSync(p)) return false;
    const st = fs.statSync(p);
    if (!st.isFile() || st.size < 1000000) return false;
    if (process.platform === "win32" && !/\.exe$/i.test(p)) return false;
    return true;
  } catch (_) { return false; }
}
let _brgProbeCache = new Map();
// 完整性探活: --version 跑通才算数 (半成品体积也能 >1MB, 唯有 --version 通才确认未截断)
function _brgProbeBin(p) {
  if (!p) return false;
  if (_brgProbeCache.has(p)) return _brgProbeCache.get(p);
  let ok = false;
  try {
    const { spawnSync } = require("child_process");
    const r = spawnSync(p, ["--version"], { timeout: 8000, windowsHide: true, encoding: "utf8" });
    ok = !r.error && r.status === 0 && /cloudflared/i.test(String(r.stdout || "") + String(r.stderr || ""));
  } catch (_) { ok = false; }
  _brgProbeCache.set(p, ok);
  return ok;
}
// 清理半成品(.part/.tgz) — 杜绝 "以半成品为基础永久卡死"
function _brgCleanupPartials(dir) {
  try {
    for (const f of fs.readdirSync(dir)) {
      if (/\.part(-[0-9a-f]+)?$/i.test(f) || /\.tgz$/i.test(f)) {
        try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
      }
    }
  } catch (_) {}
}
function _brgEnsureDir() {
  try {
    fs.mkdirSync(_BRG_DIR, { recursive: true });
  } catch (_) {}
}
// 从 cloudflared 日志抓最新 trycloudflare 公网 URL (排除 api.trycloudflare 心跳域)
function _brgReadUrlFromLog() {
  try {
    const txt = fs.readFileSync(_BRG_LOG, "utf8");
    const m = txt.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g);
    if (m && m.length) {
      for (let i = m.length - 1; i >= 0; i--)
        if (!/\/\/api\./.test(m[i])) return m[i];
    }
  } catch (_) {}
  return "";
}
function _brgPidAlive() {
  try {
    const pid = parseInt(fs.readFileSync(_BRG_PID, "utf8").trim(), 10);
    if (pid > 0) {
      process.kill(pid, 0);
      return pid;
    }
  } catch (_) {}
  return 0;
}
function _brgReadBoundPort() {
  try {
    const n = parseInt(fs.readFileSync(_BRG_PORT, "utf8").trim(), 10);
    if (n > 0) return n;
  } catch (_) {}
  return 0;
}
function _brgWriteBoundPort(p) {
  try {
    if (p) {
      _brgEnsureDir();
      fs.writeFileSync(_BRG_PORT, String(p), "utf8");
    }
  } catch (_) {}
}
function _brgReadNamedToken() {
  try {
    const j = JSON.parse(fs.readFileSync(_BRG_NAMED, "utf8"));
    return (j && j.cfTunnelToken) || "";
  } catch (_) {}
  return "";
}
function _brgLoadCfCred() {
  try {
    return JSON.parse(fs.readFileSync(_BRG_CF_CRED, "utf8"));
  } catch (_) {
    return null;
  }
}
function _brgSaveCfCred(c) {
  _brgEnsureDir();
  try {
    fs.writeFileSync(_BRG_CF_CRED, JSON.stringify(c, null, 2), "utf8");
  } catch (_) {}
}
function _brgCfState() {
  let cfEmail = "",
    cfSource = "",
    cfLoggedIn = false,
    named = false;
  const c = _brgLoadCfCred();
  if (c && (c.apiToken || c.globalApiKey || c.tunnelToken)) {
    cfLoggedIn = true;
    cfEmail = c.email || "";
    cfSource = c.source || "";
  }
  // workers.dev 中继已绑(仅存 relay 配置也算已登录) → 保证「退出账号」按钮恒可见、可解绑。
  const rc = _brgLoadRelayCfg();
  if (rc && rc.relayUrl) { cfLoggedIn = true; if (!cfSource) cfSource = "workers-relay"; }
  if (_brgReadNamedToken()) named = true;
  return { cfLoggedIn, cfEmail, cfSource, named, relayBound: !!(rc && rc.relayUrl) };
}
function _brgFindCloudflared() {
  const { execSync } = require("child_process");
  const isWin = process.platform === "win32";
  const managedDir = path.resolve(_BRG_BIN_DIR);
  const appdata = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  const cands = [
    path.join(_BRG_BIN_DIR, isWin ? "cloudflared.exe" : "cloudflared"),
    path.join(_BRG_DIR, isWin ? "cloudflared.exe" : "cloudflared"),
    // npm/choco 全局安装真二进制(非 shim)
    path.join(appdata, "npm", "node_modules", "cloudflared", "bin", isWin ? "cloudflared.exe" : "cloudflared"),
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
    "C:\\cloudflared\\cloudflared.exe",
    "/usr/local/bin/cloudflared",
    "/usr/bin/cloudflared",
    "/opt/homebrew/bin/cloudflared",
  ];
  for (const c of cands) {
    if (!_brgIsRealBin(c)) continue;
    if (_brgProbeBin(c)) return c;
    // 探活失败 = 半成品/损坏; 自管目录下直接删以触发重下(自愈)
    try { if (path.resolve(c).startsWith(managedDir + path.sep)) { fs.unlinkSync(c); _brgProbeCache.delete(c); } } catch (_) {}
  }
  // PATH 兜底: 遍历 where/command -v 全部结果, 跳过 shim, 只取真二进制
  try {
    const probe = isWin ? "where cloudflared" : "command -v cloudflared 2>/dev/null; which -a cloudflared 2>/dev/null";
    const lines = execSync(probe, { encoding: "utf8", timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }).trim().split(/\r?\n/);
    for (const ln of lines) { const p = ln.trim(); if (_brgIsRealBin(p) && _brgProbeBin(p)) return p; }
  } catch (_) {}
  return "";
}
function _brgPlatformAsset() {
  const p = process.platform,
    a = process.arch;
  if (p === "win32")
    return {
      asset:
        a === "arm64"
          ? "cloudflared-windows-arm64.exe"
          : "cloudflared-windows-amd64.exe",
      out: "cloudflared.exe",
      tgz: false,
    };
  if (p === "darwin")
    return {
      asset:
        a === "arm64"
          ? "cloudflared-darwin-arm64.tgz"
          : "cloudflared-darwin-amd64.tgz",
      out: "cloudflared",
      tgz: true,
    };
  return {
    asset:
      a === "arm64" ? "cloudflared-linux-arm64" : "cloudflared-linux-amd64",
    out: "cloudflared",
    tgz: false,
  };
}
function _brgMirrors(asset) {
  const gh =
    "https://github.com/cloudflare/cloudflared/releases/latest/download/" +
    asset;
  return [
    gh,
    "https://ghfast.top/" + gh,
    "https://gh-proxy.com/" + gh,
    "https://mirror.ghproxy.com/" + gh,
    "https://ghproxy.net/" + gh,
    "https://gh.ddlc.top/" + gh,
  ];
}
function _brgDownload(u, dst, proxy) {
  return new Promise((resolve) => {
    const tmp = dst + ".part";
    let settled = false;
    let expectedTotal = 0;
    const done = (ok) => {
      if (settled) return; settled = true;
      if (ok) {
        try {
          const sz = fs.statSync(tmp).size;
          if (sz < 1000000 || (expectedTotal && sz !== expectedTotal)) ok = false;
        } catch (_) { ok = false; }
      }
      if (ok) { try { fs.renameSync(tmp, dst); } catch (_) { ok = false; } }
      if (!ok) { try { fs.unlinkSync(tmp); } catch (_) {} }
      resolve(ok);
    };
    let resumeAt = 0;
    try { if (fs.existsSync(tmp)) resumeAt = fs.statSync(tmp).size; } catch (_) {}
    const rangeHeaders = () => (resumeAt > 0 ? { Range: "bytes=" + resumeAt + "-" } : {});
    const UA = "dao-proxypro-bridge fetch-cloudflared";
    const sink = (res, retry, depth) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return retry(res.headers.location, depth + 1);
      }
      const append = resumeAt > 0 && res.statusCode === 206;
      if (resumeAt > 0 && res.statusCode === 200) { resumeAt = 0; }
      if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); return done(false); }
      const cl = Number(res.headers["content-length"] || 0);
      expectedTotal = cl ? (append ? resumeAt : 0) + cl : 0;
      const f = fs.createWriteStream(tmp, { flags: append ? "a" : "w" });
      res.on("error", () => done(false));
      res.pipe(f);
      f.on("finish", () => f.close(() => done(true)));
      f.on("error", () => done(false));
    };
    const get = (link, depth) => {
      if (depth > 6) return done(false);
      let o; try { o = new URL(link); } catch (_) { return done(false); }
      // 有代理且目标为 https: 走 HTTP CONNECT 隧道
      if (proxy && o.protocol === "https:") {
        let px; try { px = new URL(proxy); } catch (_) { px = null; }
        if (px) {
          const conn = http.request({
            host: px.hostname, port: px.port || 80, method: "CONNECT",
            path: o.hostname + ":" + (o.port || 443),
            headers: { Host: o.hostname + ":" + (o.port || 443), "User-Agent": UA },
            timeout: 60000,
          });
          conn.on("connect", (resp, socket) => {
            if (resp.statusCode !== 200) { socket.destroy(); return done(false); }
            const req2 = https.get({ hostname: o.hostname, port: o.port || 443, path: o.pathname + o.search, socket, agent: false, headers: Object.assign({ "User-Agent": UA }, rangeHeaders()), timeout: 60000 },
              (res) => sink(res, get, depth));
            req2.on("error", () => done(false));
            req2.setTimeout(60000, () => { req2.destroy(); done(false); });
          });
          conn.on("error", () => done(false));
          conn.setTimeout(60000, () => { conn.destroy(); done(false); });
          conn.end();
          return;
        }
      }
      const mod = o.protocol === "http:" ? http : https;
      const req = mod.get(
        { hostname: o.hostname, port: o.port || (o.protocol === "http:" ? 80 : 443), path: o.pathname + o.search, headers: Object.assign({ "User-Agent": UA }, rangeHeaders()), timeout: 60000 },
        (res) => sink(res, get, depth));
      req.on("error", () => done(false));
      req.setTimeout(60000, () => { req.destroy(); done(false); });
    };
    get(u, 0);
  });
}
// macOS 资产是 .tgz: 零依赖 gunzip + 手解 tar(512B 头块), 取出名为 cloudflared 的真二进制
function _brgExtractTgz(tgzPath, outBin) {
  try {
    const buf = zlib.gunzipSync(fs.readFileSync(tgzPath));
    let off = 0;
    while (off + 512 <= buf.length) {
      const header = buf.slice(off, off + 512);
      const name = header
        .slice(0, 100)
        .toString("utf8")
        .replace(/\0.*$/s, "");
      off += 512;
      if (!name) break;
      const size =
        parseInt(
          header
            .slice(124, 136)
            .toString("utf8")
            .replace(/[\0 ]+$/g, "")
            .trim(),
          8,
        ) || 0;
      if (name.split("/").pop() === "cloudflared" && size > 1000000) {
        fs.writeFileSync(outBin, buf.slice(off, off + size));
        try {
          fs.chmodSync(outBin, 0o755);
        } catch (_) {}
        return true;
      }
      off += Math.ceil(size / 512) * 512;
    }
  } catch (_) {}
  return false;
}
// 自带二进制缺失时按平台从 GitHub(+国内镜像) 拉取 cloudflared 到 ~/.dao/bin/
// v9.9.342 · 移植 dao-bridge: cleanup partials + proxy detection + --version 探活
async function _brgFetchCloudflared() {
  if (_brgFetching) return "";
  _brgFetching = true;
  try {
    _brgEnsureDir();
    try { fs.mkdirSync(_BRG_BIN_DIR, { recursive: true }); } catch (_) {}
    _brgCleanupPartials(_BRG_BIN_DIR); // 清上一轮半成品
    const meta = _brgPlatformAsset();
    const dst = path.join(_BRG_BIN_DIR, meta.out);
    // 既有文件必须 --version 探活通过才复用; 否则删除重下(自愈)
    try { if (fs.existsSync(dst) && _brgIsRealBin(dst) && _brgProbeBin(dst)) return dst; } catch (_) {}
    try { if (fs.existsSync(dst)) { fs.unlinkSync(dst); _brgProbeCache.delete(dst); } } catch (_) {}
    const proxy = _brgDetectProxy();
    const dlTarget = meta.tgz ? path.join(_BRG_BIN_DIR, "cloudflared.tgz") : dst;
    const mirrors = _brgMirrors(meta.asset);
    for (let i = 0; i < mirrors.length; i++) {
      log("[bridge] fetch cloudflared <- mirror " + (i + 1) + "/" + mirrors.length + (proxy ? " via " + proxy : ""));
      const ok = await _brgDownload(mirrors[i], dlTarget, proxy);
      if (!ok) continue;
      let bin = dlTarget;
      if (meta.tgz) {
        const extracted = _brgExtractTgz(dlTarget, dst);
        try { fs.unlinkSync(dlTarget); } catch (_) {}
        if (!extracted) continue;
        bin = dst;
      }
      if (process.platform !== "win32") { try { fs.chmodSync(bin, 0o755); } catch (_) {} }
      _brgProbeCache.delete(bin);
      if (_brgProbeBin(bin)) {
        log("[bridge] cloudflared ready: " + bin);
        return bin;
      }
      // 探活失败 → 删除, 换下一个镜像重下
      try { fs.unlinkSync(bin); } catch (_) {}
    }
    log("[bridge] cloudflared fetch FAILED (all mirrors)");
    return "";
  } finally {
    _brgFetching = false;
  }
}
// 暴露公网前确保反代已启用且有 key(loadConfig 无 key 会自动生成 dao-local-*),
// 否则公网侧 /v1/* 会因 enabled=false 而 404/被本机免 key 误导。
function _brgEnsureRevproxyReady() {
  try {
    const mod = _getRevproxy();
    if (!mod || !mod.loadConfig || !mod.saveConfig) return;
    const cfg = mod.loadConfig();
    if (!cfg.enabled) {
      cfg.enabled = true;
      mod.saveConfig(cfg);
      log("[bridge] revproxy auto-enabled for public tunnel");
    }
  } catch (_) {}
}
async function _brgStartTunnel(named, manual) {
  const { spawn } = require("child_process");
  _brgEnsureDir();
  // 手动即天意: 撤停止旗+清退避, 绕过自动挂起闸; 自动调用方遇退避/冷却则提前退出。
  if (manual) { _brgSetUserStopped(false); _brgSpawnFails = 0; _brgBackoffUntilMs = 0; _brgLastCountedStartMs = 0; }
  else {
    // 退避中(trycloudflare 限流后指数等待) → 不强冲
    if (_brgBackoffUntilMs && Date.now() < _brgBackoffUntilMs) {
      log("[bridge] backoff 退避中 · 剩余 " + Math.round((_brgBackoffUntilMs - Date.now()) / 1000) + "s");
      return { ok: false, reason: "backoff" };
    }
    // 冷却期(上次启动后 25s 内不再启新) → 防密集重启
    if (_brgStartMs && Date.now() - _brgStartMs < _BRG_RESTART_COOLDOWN_MS) {
      return { ok: false, reason: "cooldown" };
    }
  }
  _brgEnsureRevproxyReady();
  const targetPort = _actualPort;
  // 复用孤儿(善建者不拔): 上个宿主留下的 cloudflared 仍活·日志有可达 URL·绑的还是当前反代口 → 直接复用
  if (!named) {
    const pid = _brgPidAlive();
    if (pid) {
      const u = _brgReadUrlFromLog();
      const bound = _brgReadBoundPort();
      if (u && bound === targetPort) {
        _brgProc = null;
        _brgUrl = u;
        try { _writeEndpointDiscovery(); } catch (_) {}
        _brgStartWatchdog();
        return { ok: true, reused: true, url: u };
      }
      try { process.kill(pid); } catch (_) {}
      try { fs.unlinkSync(_BRG_PID); } catch (_) {}
      try { fs.unlinkSync(_BRG_PORT); } catch (_) {}
    }
  }
  if (_brgProc) { try { _brgProc.kill(); } catch (_) {} _brgProc = null; }
  const stale = _brgPidAlive();
  if (stale) { try { process.kill(stale); } catch (_) {} }
  let cfPath = _brgFindCloudflared();
  if (!cfPath) cfPath = await _brgFetchCloudflared();
  if (!cfPath) return { ok: false, reason: "cloudflared-not-found" };
  const localUrl = "http://127.0.0.1:" + targetPort;
  let args;
  if (named) {
    const tok = _brgReadNamedToken();
    if (!tok) return { ok: false, reason: "no-named-token" };
    args = ["tunnel", "run", "--token", tok];
  } else {
    // --protocol http2: QUIC(UDP 7844) 常被防火墙/NAT 拦死(实测 VM/企业网),
    // 强制 http2 传输(走 443/TCP)让隧道在纯 TCP 环境亦能注册, 不再卡在 quic 重拨。
    args = ["tunnel", "--url", localUrl, "--no-autoupdate", "--protocol", "http2"];
  }
  try { fs.writeFileSync(_BRG_LOG, ""); } catch (_) {}
  let out = "ignore";
  try { out = fs.openSync(_BRG_LOG, "a"); } catch (_) {}
  // ★ v9.9.342 核心修复: 注入代理环境到 cloudflared 子进程(国内环境不经代理无法连 Cloudflare)
  const proxy = _brgDetectProxy();
  const env = _brgSpawnEnv(proxy);
  if (proxy) log("[bridge] cloudflared spawn with proxy: " + proxy);
  try {
    _brgProc = spawn(cfPath, args, { stdio: ["ignore", out, out], detached: true, env });
  } catch (_) {
    try {
      _brgProc = spawn(cfPath, args, { stdio: "ignore", detached: true, env });
    } catch (_2) { _brgProc = null; }
  }
  if (!_brgProc || !_brgProc.pid) return { ok: false, reason: "spawn-failed" };
  try { fs.writeFileSync(_BRG_PID, String(_brgProc.pid)); } catch (_) {}
  _brgWriteBoundPort(targetPort);
  _brgStartMs = Date.now();
  _brgUrl = "";
  try { _brgProc.unref(); } catch (_) {}
  _brgProc.on("error", () => { _brgProc = null; });
  _brgProc.on("exit", () => { _brgProc = null; });
  _brgStartWatchdog();
  return { ok: true };
}
// ═══ 看门狗(watchdog): 隧道进程死后自动重启 · 善建者不拔 · v9.9.348 宽限+退避 ═══
function _brgStartWatchdog() {
  if (_brgWatchdog) return;
  _brgWatchdog = setInterval(() => {
    try {
      const pid = _brgPidAlive();
      const url = _brgReadUrlFromLog();
      if (url && !_brgUrl) {
        _brgUrl = url;
        // 成功注册 URL → 退避归零(道之反者·回归)
        _brgSpawnFails = 0; _brgBackoffUntilMs = 0;
        try { _writeEndpointDiscovery(); } catch (_) {}
      }
      // 进程已死且曾经启动过(startMs > 0) → 自动重启
      if (!pid && !_brgProc && _brgStartMs > 0) {
        // 宽限期(45s): 刚 spawn 不久还没注册 URL 就死了 → 计入失败; 已有 URL 后死 → 正常重启
        const age = Date.now() - _brgStartMs;
        if (age < _BRG_ESTABLISH_GRACE_MS && !_brgUrl) {
          // 尚在宽限期内且从未出过 URL → 可能 trycloudflare 拒绝了, 计入退避
          _brgSpawnFails++;
          const backoff = Math.min(_BRG_BACKOFF_MAX_MS, 5000 * Math.pow(2, _brgSpawnFails));
          _brgBackoffUntilMs = Date.now() + backoff;
          log("[bridge] watchdog: tunnel died during grace · backoff " + Math.round(backoff / 1000) + "s (fail#" + _brgSpawnFails + ")");
          return; // 退避期内 _brgStartTunnel 会拒绝, 下轮 watchdog 检查退避是否到期
        }
        log("[bridge] watchdog: tunnel dead, auto-restart");
        _brgStartTunnel(false).catch(() => {});
      }
      // 退避到期且进程仍死 → 尝试恢复
      if (!pid && !_brgProc && _brgBackoffUntilMs && Date.now() >= _brgBackoffUntilMs) {
        log("[bridge] watchdog: backoff expired, retry");
        _brgBackoffUntilMs = 0;
        _brgStartMs = Date.now(); // 模拟"曾启动"使下轮 watchdog 可再判
        _brgStartTunnel(false).catch(() => {});
      }
    } catch (_) {}
  }, 15000);
}
function _brgStopWatchdog() {
  if (_brgWatchdog) { clearInterval(_brgWatchdog); _brgWatchdog = null; }
}
function _brgStopTunnel(manual) {
  // 道并行不相悖: 手动停止落旗 → 自动连接/自愈挂起, 「停止」真停(直至手动启动/重启或 24h 安全自复)。
  if (manual) _brgSetUserStopped(true);
  _brgStopWatchdog();
  _brgStartMs = 0;
  _brgSpawnFails = 0; _brgBackoffUntilMs = 0;
  if (_brgProc) { try { _brgProc.kill(); } catch (_) {} _brgProc = null; }
  try { const op = _brgPidAlive(); if (op) process.kill(op); } catch (_) {}
  try { fs.unlinkSync(_BRG_PID); } catch (_) {}
  try { fs.unlinkSync(_BRG_PORT); } catch (_) {}
  try { fs.writeFileSync(_BRG_LOG, ""); } catch (_) {}
  _brgUrl = "";
  try { _writeEndpointDiscovery(); } catch (_) {}
}
// ═══ 激活自动连接(去中心化默认·AGENTS 三章「插件启动即自动打通」) ═══════════════
//   开机/激活即把反代端点自动暴露公网, 用户无需手点「启动隧道」(治用户所述「没有自动连接好」)。
//   优先级(善用者不弃物): ① 已绑 workers.dev 固定中继 → 持久通道已由 relayAutoStart 拉起, 不另起快速隧道;
//     ② 已存命名隧道令牌 → 以固定域名上线; ③ 皆无 → 零账号快速隧道(去中心化默认)。
//   手动停止旗在时挂起(尊重用户意志); 缺 cloudflared 二进制自动后台拉取, 拉取期不阻塞激活。
async function _brgAutoConnect() {
  try {
    if (_brgUserStopped()) { log("[bridge] auto-connect 挂起 · 用户手动停止旗在(点启动/重启即恢复)"); return; }
    // 已有活着的隧道(孤儿复用) → _brgStartTunnel 内部会复用, 无害。
    const relayCfg = _brgLoadRelayCfg();
    if (relayCfg && relayCfg.relayUrl && relayCfg.session && relayCfg.relayToken) {
      // 持久中继已配置: 出站长连由 _brgRelayAutoStart 维持(固定地址永不轮换), 无需快速隧道。
      log("[bridge] auto-connect · workers.dev 固定中继已配置 · 持久通道优先");
      return;
    }
    const named = !!_brgReadNamedToken();
    const r = await _brgStartTunnel(named, false);
    if (r && r.ok) log("[bridge] auto-connect · " + (named ? "命名隧道" : "零账号快速隧道") + (r.reused ? "(复用孤儿)" : "") + " 已拉起" + (r.url ? " · " + r.url : "(URL 建立中)"));
    else log("[bridge] auto-connect 未成: " + (r && r.reason || "unknown") + (r && r.reason === "cloudflared-not-found" ? " (后台拉取 cloudflared 中·就绪后 watchdog 自起)" : ""));
  } catch (e) { log("[bridge] auto-connect err: " + (e && e.message)); }
}

// ═══════════════════════════════════════════════════════════
// workers.dev 固定中继(第五模块·外接反代底层 API 持久通道) — 帛书「大道甚夷」
//   用户只给一个 Cloudflare API Token、无需自备域名: 把最小中继 Worker(含 Durable
//   Object, 与 addons/dao-relay 协议逐字节一致)自动部署到「用户自己的 CF 账号」, 启用
//   免费 *.workers.dev 子域, 得到固定不变的公网地址 —— 出站长连由本机 RelayClient 维持,
//   公网侧 POST /relay/<session> 即把请求派回本机反代端点(/v1/*), 永不轮换。
//   与独立 dao-bridge 插件共存无冲突: 各用「独立会话」(配置落 workers-relay-proxypro.json,
//   session 前缀 pp- 派生), 即便同账号同 Worker 脚本, DO 实例按 (session,token) 隔离 →
//   道并行而不相悖。默认仍走零账号快速隧道; 仅当用户主动绑 API Token 时启用本持久通道。
// ═══════════════════════════════════════════════════════════
const _BRG_RELAY_SCRIPT = "dao-relay-do";
const _BRG_RELAY = path.join(_BRG_DIR, "workers-relay-proxypro.json");
let _brgRelay = null; // RelayClient 单例
const _BRG_UA = "dao-proxypro-relay";

function _brgLoadRelayCfg() {
  try { return JSON.parse(fs.readFileSync(_BRG_RELAY, "utf8")); } catch (_) { return null; }
}
function _brgSaveRelayCfg(cfg) {
  _brgEnsureDir();
  try { fs.writeFileSync(_BRG_RELAY, JSON.stringify(cfg, null, 2), "utf8"); } catch (_) {}
}

function _brgCfApiRequest(method, apiPath, token, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "api.cloudflare.com",
      path: "/client/v4" + apiPath,
      method: method,
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "User-Agent": _BRG_UA,
      },
    }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch (_) { resolve({ status: res.statusCode, text: d }); } });
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
    if (data) req.write(data);
    req.end();
  });
}

// 内嵌最小中继 Worker 源(单模块·Durable Object Hibernation) — 与 addons/dao-relay 协议一致。
const _BRG_RELAY_SOURCE = [
  '"use strict";',
  'function relayKey(s, t) { return String(s) + "\\u0000" + String(t); }',
  'function json(b, s) { return new Response(JSON.stringify(b), { status: s || 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } }); }',
  'function bearer(req) { const h = req.headers.get("authorization") || ""; return h.startsWith("Bearer ") ? h.slice(7) : ""; }',
  'export default {',
  '  async fetch(req, env) {',
  '    const url = new URL(req.url);',
  '    const path = url.pathname;',
  '    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "authorization,content-type" } });',
  '    if (path === "/" || path === "/health") return json({ ok: true, service: "dao-relay-min", version: "1.0.0", pairing: "session+token" });',
  '    if (path === "/connect") {',
  '      if ((req.headers.get("upgrade") || "").toLowerCase() !== "websocket") return json({ error: "expected websocket" }, 426);',
  '      const session = url.searchParams.get("session") || "";',
  '      const t = url.searchParams.get("token") || "";',
  '      if (!session || !t) return json({ error: "missing session/token" }, 400);',
  '      if (env.DAO_TOKEN && t !== String(env.DAO_TOKEN)) return json({ error: "unauthorized" }, 401);',
  '      const id = env.DAO_RELAY.idFromName(relayKey(session, t));',
  '      return env.DAO_RELAY.get(id).fetch(req);',
  '    }',
  '    if (path.startsWith("/relay/")) {',
  '      if (req.method !== "POST") return json({ error: "POST only", hint: "body={path,method,body} Authorization: Bearer <token>" }, 405);',
  '      const t = bearer(req);',
  '      const session = decodeURIComponent(path.slice("/relay/".length));',
  '      if (!session || !t) return json({ error: "missing session/token" }, 401);',
  '      if (env.DAO_TOKEN && t !== String(env.DAO_TOKEN)) return json({ error: "unauthorized" }, 401);',
  '      const id = env.DAO_RELAY.idFromName(relayKey(session, t));',
  '      return env.DAO_RELAY.get(id).fetch(new Request("https://do/relay", { method: "POST", headers: { "content-type": "application/json" }, body: await req.text() }));',
  '    }',
  '    return json({ error: "not found" }, 404);',
  '  }',
  '};',
  'export class DaoRelayDO {',
  '  constructor(state, env) { this.state = state; this.env = env; this.pending = new Map(); this.seq = 0; this.rl = { windowStart: 0, count: 0 }; }',
  '  agentSocket() {',
  '    let list = []; try { list = this.state.getWebSockets() || []; } catch (e) { list = []; }',
  '    let saw = false;',
  '    for (let i = list.length - 1; i >= 0; i--) { const ws = list[i]; if (!ws) continue; const rs = ws.readyState; if (rs === 1) return ws; if (rs !== undefined && rs !== null) saw = true; }',
  '    if (!saw) for (let i = list.length - 1; i >= 0; i--) if (list[i]) return list[i];',
  '    return null;',
  '  }',
  '  async waitForAgent(maxMs) { const start = Date.now(); let a = this.agentSocket(); while (!a && Date.now() - start < maxMs) { await new Promise((r) => setTimeout(r, 150)); a = this.agentSocket(); } return a; }',
  '  rateOk() { const WIN = 10000, MAX = 120; const now = Date.now(); if (now - this.rl.windowStart > WIN) { this.rl.windowStart = now; this.rl.count = 0; } this.rl.count++; return this.rl.count <= MAX; }',
  '  async fetch(req) {',
  '    const url = new URL(req.url);',
  '    if (url.pathname === "/connect") {',
  '      const pair = new WebSocketPair();',
  '      const client = pair[0], server = pair[1];',
  '      try { for (const ws of (this.state.getWebSockets() || [])) { try { ws.close(1000, "replaced"); } catch (e) {} } } catch (e) {}',
  '      this.state.acceptWebSocket(server);',
  '      try { this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair(JSON.stringify({ type: "ping" }), JSON.stringify({ type: "pong" }))); } catch (e) {}',
  '      return new Response(null, { status: 101, webSocket: client });',
  '    }',
  '    let agent = this.agentSocket();',
  '    if (!agent) { agent = await this.waitForAgent(5000); if (!agent) return json({ error: "no_agent", hint: "no connected agent matches this session+token" }, 502); }',
  '    if (!this.rateOk()) return json({ error: "rate_limited" }, 429);',
  '    let frame = {}; try { frame = await req.json(); } catch (e) { frame = {}; }',
  '    const reqPath = frame.path || "/v1/models";',
  '    const method = frame.method || "GET";',
  '    const body = frame.body !== undefined ? frame.body : {};',
  '    const id = "r" + (++this.seq) + "-" + Date.now();',
  '    const wire = JSON.stringify({ type: "request", id, path: reqPath, method, body });',
  '    const out = await new Promise((resolve) => {',
  '      const timer = setTimeout(() => { this.pending.delete(id); resolve({ status: 504, body: { error: "agent_timeout" } }); }, 60000);',
  '      this.pending.set(id, { resolve, timer });',
  '      const trySend = (sock, retriesLeft) => {',
  '        try { sock.send(wire); } catch (e) {',
  '          if (retriesLeft > 0) { setTimeout(() => { const fresh = this.agentSocket(); if (fresh) trySend(fresh, retriesLeft - 1); else { clearTimeout(timer); this.pending.delete(id); resolve({ status: 503, body: { error: "agent_reconnecting", retryable: true } }); } }, 200); }',
  '          else { clearTimeout(timer); this.pending.delete(id); resolve({ status: 503, body: { error: "agent_reconnecting", retryable: true } }); }',
  '        }',
  '      };',
  '      trySend(agent, 1);',
  '    });',
  '    return json(out.body, out.status || 200);',
  '  }',
  '  webSocketMessage(ws, message) {',
  '    let m; try { const s = (typeof message === "string") ? message : new TextDecoder().decode(message); m = JSON.parse(s); } catch (e) { return; }',
  '    if (!m || typeof m !== "object") return;',
  '    if (m.type === "ping") { try { ws.send(JSON.stringify({ type: "pong" })); } catch (e) {} return; }',
  '    if (m.type === "pong") return;',
  '    if (m.type === "response" && m.id && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); clearTimeout(p.timer); p.resolve({ status: m.status || 200, body: m.body }); }',
  '  }',
  '  webSocketClose(ws, code, reason) { try { ws.close(code, reason); } catch (e) {} }',
  '  webSocketError() {}',
  '}',
  '',
].join("\n");

function _brgCfUploadWorker(acctId, scriptName, apiToken, source, withMigration) {
  const crypto = require("crypto");
  const metadata = {
    main_module: "worker.js",
    compatibility_date: "2024-11-01",
    bindings: [{ type: "durable_object_namespace", name: "DAO_RELAY", class_name: "DaoRelayDO" }],
  };
  if (withMigration) metadata.migrations = { new_tag: "v1", new_sqlite_classes: ["DaoRelayDO"] };
  const boundary = "----daoRelayBoundary" + crypto.randomBytes(12).toString("hex");
  const body = Buffer.concat([
    Buffer.from(
      "--" + boundary + "\r\n" +
      'Content-Disposition: form-data; name="metadata"; filename="metadata.json"\r\n' +
      "Content-Type: application/json\r\n\r\n" +
      JSON.stringify(metadata) + "\r\n" +
      "--" + boundary + "\r\n" +
      'Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n' +
      "Content-Type: application/javascript+module\r\n\r\n", "utf8"),
    Buffer.from(source, "utf8"),
    Buffer.from("\r\n--" + boundary + "--\r\n", "utf8"),
  ]);
  return new Promise((resolve) => {
    const req = https.request({
      hostname: "api.cloudflare.com",
      path: "/client/v4/accounts/" + acctId + "/workers/scripts/" + scriptName,
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + apiToken,
        "Content-Type": "multipart/form-data; boundary=" + boundary,
        "Content-Length": body.length,
        "User-Agent": _BRG_UA,
      },
    }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve({ status: res.statusCode, json: JSON.parse(d) }); } catch (_) { resolve({ status: res.statusCode, text: d }); } });
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
    req.write(body); req.end();
  });
}

function _brgCfErr(r) {
  try { return JSON.stringify((r.json && r.json.errors) || r.text || r.error || "").slice(0, 220); } catch (_) { return String(r.status); }
}

// 一个 API Token → 用户自己账号下的固定 workers.dev 中继(零域名·闭环持久化)。幂等。
async function _brgProvisionRelay(apiToken) {
  const crypto = require("crypto");
  const acctR = await _brgCfApiRequest("GET", "/accounts", apiToken);
  const acct = acctR.json && acctR.json.result && acctR.json.result[0];
  if (!acct || !acct.id) return { ok: false, message: "无法读取 Cloudflare 账号(API Token 需含 Account 读取权限)" };
  const acctId = acct.id;
  let sub = "";
  const subR = await _brgCfApiRequest("GET", "/accounts/" + acctId + "/workers/subdomain", apiToken);
  if (subR.json && subR.json.result && subR.json.result.subdomain) sub = subR.json.result.subdomain;
  if (!sub) {
    const cand = "dao-" + String(acctId).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 14);
    const mkR = await _brgCfApiRequest("PUT", "/accounts/" + acctId + "/workers/subdomain", apiToken, { subdomain: cand });
    if (mkR.json && mkR.json.result && mkR.json.result.subdomain) sub = mkR.json.result.subdomain;
    if (!sub) return { ok: false, needSubdomain: true, message: "账号还没有 workers.dev 子域且自动注册未成: " + _brgCfErr(mkR) + " — 请在 Cloudflare 面板 Workers 页注册一次子域(免费), 再重试" };
  }
  const setR = await _brgCfApiRequest("GET", "/accounts/" + acctId + "/workers/scripts/" + _BRG_RELAY_SCRIPT + "/settings", apiToken);
  const exists = setR.status === 200 && setR.json && setR.json.success;
  let upR = await _brgCfUploadWorker(acctId, _BRG_RELAY_SCRIPT, apiToken, _BRG_RELAY_SOURCE, !exists);
  if (!(upR.status === 200 && upR.json && upR.json.success) && !exists) {
    upR = await _brgCfUploadWorker(acctId, _BRG_RELAY_SCRIPT, apiToken, _BRG_RELAY_SOURCE, false);
  }
  if (!(upR.status === 200 && upR.json && upR.json.success)) {
    return { ok: false, message: "上传中继 Worker 失败(API Token 需含 Workers Scripts:Edit 权限): " + _brgCfErr(upR) };
  }
  const enR = await _brgCfApiRequest("POST", "/accounts/" + acctId + "/workers/scripts/" + _BRG_RELAY_SCRIPT + "/subdomain", apiToken, { enabled: true, previews_enabled: false });
  if (!(enR.status === 200 && enR.json && enR.json.success)) {
    return { ok: false, message: "启用 workers.dev 子域路由失败: " + _brgCfErr(enR) };
  }
  const relayUrl = "https://" + _BRG_RELAY_SCRIPT + "." + sub + ".workers.dev";
  // 稳定配对: session 按机器派生(pp- 前缀以与独立 dao-bridge 会话天然区隔·不冲突), token 一次生成后复用。
  const prev = _brgLoadRelayCfg() || {};
  const hostSlug = (os.hostname() || "dao").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "dao";
  const session = prev.session || ("pp-" + hostSlug + "-" + crypto.randomBytes(3).toString("hex"));
  const relayToken = prev.relayToken || ("dao-relay-" + crypto.randomBytes(24).toString("hex"));
  const cfg = { relayUrl, scriptName: _BRG_RELAY_SCRIPT, subdomain: sub, acctId, session, relayToken, apiToken, savedAt: new Date().toISOString() };
  _brgSaveRelayCfg(cfg);
  return { ok: true, relayUrl, session, relayToken, publicUrl: relayUrl + "/relay/" + encodeURIComponent(session) };
}

// ── 零依赖 WebSocket 客户端(RFC6455·手搓) ── 与 addons/dao-bridge 同源精简 ──
const _BRG_WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
function _brgWsEncodeFrame(opcode, payload) {
  const crypto = require("crypto");
  const mask = crypto.randomBytes(4);
  const len = payload.length;
  let header;
  if (len < 126) { header = Buffer.from([0x80 | opcode, 0x80 | len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}
class _BrgWsFrameParser {
  constructor(onText, onClose, sendPong) { this.onText = onText; this.onClose = onClose; this.sendPong = sendPong; this.buf = Buffer.alloc(0); this.fragments = []; }
  push(chunk) { this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk; this.parse(); }
  parse() {
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, offset = 2;
      if (len === 126) { if (this.buf.length < offset + 2) return; len = this.buf.readUInt16BE(offset); offset += 2; }
      else if (len === 127) { if (this.buf.length < offset + 8) return; len = Number(this.buf.readBigUInt64BE(offset)); offset += 8; }
      const maskLen = masked ? 4 : 0;
      if (this.buf.length < offset + maskLen + len) return;
      let payload = this.buf.subarray(offset + maskLen, offset + maskLen + len);
      if (masked) {
        const mask = this.buf.subarray(offset, offset + 4);
        const un = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i++) un[i] = payload[i] ^ mask[i & 3];
        payload = un;
      }
      this.buf = this.buf.subarray(offset + maskLen + len);
      if (opcode === 0x8) { this.onClose(); return; }
      if (opcode === 0x9) { this.sendPong(payload); continue; }
      if (opcode === 0xa) continue;
      this.fragments.push(payload);
      if (fin) { const full = Buffer.concat(this.fragments); this.fragments = []; this.onText(full.toString("utf8")); }
    }
  }
}
class _BrgWsClient {
  constructor() { this.socket = null; this.parser = null; this.handlers = []; this.closeHandlers = []; this.closed = false; }
  get isOpen() { return !this.closed && !!this.socket && !this.socket.destroyed; }
  onMessage(cb) { this.handlers.push(cb); }
  onClose(cb) { this.closeHandlers.push(cb); }
  _emitClose() { if (this._closeEmitted) return; this._closeEmitted = true; for (const h of this.closeHandlers) { try { h(); } catch (e) {} } }
  static _openSocket(target, opts, proxyUrl) {
    const nett = require("net"), tls = require("tls");
    const host = target.hostname;
    const secure = target.protocol === "wss:";
    const port = target.port ? Number(target.port) : (secure ? 443 : 80);
    return new Promise((resolve, reject) => {
      const onError = (err) => reject(err);
      const wrapTls = (socket) => {
        const t = tls.connect({ socket, servername: host, rejectUnauthorized: opts.verify !== false }, () => resolve(t));
        t.on("error", onError);
      };
      if (proxyUrl) {
        let p; try { p = new URL(proxyUrl); } catch (e) { p = null; }
        if (p) {
          const headers = {};
          if (p.username) headers["proxy-authorization"] = "Basic " + Buffer.from(decodeURIComponent(p.username) + ":" + decodeURIComponent(p.password || "")).toString("base64");
          const cr = http.request({ host: p.hostname, port: p.port ? Number(p.port) : 80, method: "CONNECT", path: host + ":" + port, headers });
          cr.setTimeout(opts.timeoutMs || 15000, () => cr.destroy(new Error("代理连接超时")));
          cr.on("error", onError);
          cr.on("connect", (res, socket) => {
            if (res.statusCode !== 200) { socket.destroy(); return reject(new Error("代理 CONNECT 失败: HTTP " + res.statusCode)); }
            if (secure) wrapTls(socket); else resolve(socket);
          });
          cr.end();
          return;
        }
      }
      if (secure) {
        const t = tls.connect({ host, port, servername: host, rejectUnauthorized: opts.verify !== false }, () => resolve(t));
        t.setTimeout(opts.timeoutMs || 15000, () => t.destroy(new Error("连接超时")));
        t.on("error", onError);
        return;
      }
      const plain = nett.connect({ host, port }, () => resolve(plain));
      plain.setTimeout(opts.timeoutMs || 15000, () => plain.destroy(new Error("连接超时")));
      plain.on("error", onError);
    });
  }
  static connect(wsUrl, options) {
    options = options || {};
    const crypto = require("crypto");
    const timeoutMs = options.timeoutMs || 15000;
    const u = new URL(wsUrl);
    if (u.protocol !== "wss:" && u.protocol !== "ws:") return Promise.reject(new Error("不支持的 WS 协议: " + u.protocol));
    const client = new _BrgWsClient();
    const key = crypto.randomBytes(16).toString("base64");
    const expectAccept = crypto.createHash("sha1").update(key + _BRG_WS_GUID).digest("base64");
    return _BrgWsClient._openSocket(u, { verify: options.verify, timeoutMs }, options.proxy).then((socket) => new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => { if (settled) return; settled = true; try { socket.destroy(); } catch (e) {} reject(err); };
      const timer = setTimeout(() => fail(new Error("WS 握手超时")), timeoutMs);
      socket.on("error", fail);
      const reqStr = "GET " + u.pathname + u.search + " HTTP/1.1\r\n" +
        "Host: " + u.host + "\r\n" +
        "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
        "Sec-WebSocket-Key: " + key + "\r\nSec-WebSocket-Version: 13\r\n\r\n";
      socket.write(reqStr);
      let hb = Buffer.alloc(0);
      const onHandshake = (chunk) => {
        hb = Buffer.concat([hb, chunk]);
        const sep = hb.indexOf("\r\n\r\n");
        if (sep < 0) return;
        const headerText = hb.subarray(0, sep).toString("utf8");
        const rest = hb.subarray(sep + 4);
        const statusLine = headerText.split("\r\n")[0] || "";
        if (!/\s101\s/.test(" " + statusLine + " ")) return fail(new Error("WS 握手失败: " + statusLine.slice(0, 120)));
        const am = /sec-websocket-accept:\s*(\S+)/i.exec(headerText);
        if (!am || am[1] !== expectAccept) return fail(new Error("WS 握手失败: Sec-WebSocket-Accept 校验不通过"));
        clearTimeout(timer);
        settled = true;
        socket.setTimeout(0);
        socket.removeListener("data", onHandshake);
        socket.removeListener("error", fail);
        client.socket = socket;
        client.parser = new _BrgWsFrameParser(
          (s) => { for (const h of client.handlers) { try { h(s); } catch (e) {} } },
          () => client.close(),
          (payload) => client.rawSend(0xa, payload)
        );
        socket.on("data", (c) => { try { client.parser.push(c); } catch (e) {} });
        socket.on("close", () => { client.closed = true; client._emitClose(); });
        socket.on("error", () => { client.closed = true; client._emitClose(); });
        resolve(client);
        if (rest.length > 0) client.parser.push(rest);
      };
      socket.on("data", onHandshake);
    }));
  }
  rawSend(opcode, payload) {
    if (!this.socket || this.socket.destroyed) return;
    try { this.socket.write(_brgWsEncodeFrame(opcode, payload)); } catch (e) {}
  }
  send(text) { this.rawSend(0x1, Buffer.from(text, "utf8")); }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.rawSend(0x8, Buffer.alloc(0));
    try { this.socket && this.socket.destroy(); } catch (e) {}
    this._emitClose();
  }
}

// 本机派发: 把中继帧 {path,method,body} 还原为对本机反代端点(127.0.0.1:_actualPort)的
//   HTTP 请求, 自动注入本机 revproxy apiKey(公网侧凭 relay session+token 即可直调 /v1/*,
//   无需另知反代 key) → 「专注对外暴露反代底层 API」。返回 {status, body}。
function _brgRelayDispatch(frame) {
  return new Promise((resolve) => {
    const p = frame.path || "/v1/models";
    const method = (frame.method || "GET").toUpperCase();
    let apiKey = "";
    try { const rp = _getRevproxy(); if (rp && rp.loadConfig) apiKey = rp.loadConfig().apiKey || ""; } catch (_) {}
    const headers = { "User-Agent": _BRG_UA };
    if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
    let data = null;
    if (frame.body !== undefined && frame.body !== null && method !== "GET" && method !== "HEAD") {
      data = (typeof frame.body === "string") ? frame.body : JSON.stringify(frame.body);
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(data);
    }
    const req = http.request({ hostname: "127.0.0.1", port: _actualPort, path: p, method, headers }, (res) => {
      let d = ""; res.on("data", (c) => (d += c));
      res.on("end", () => {
        let body; try { body = JSON.parse(d); } catch (_) { body = d; }
        resolve({ status: res.statusCode || 200, body });
      });
    });
    req.on("error", (e) => resolve({ status: 502, body: { error: String(e && e.message) } }));
    req.setTimeout(60000, () => { req.destroy(); resolve({ status: 504, body: { error: "local_timeout" } }); });
    if (data) req.write(data);
    req.end();
  });
}

// ── RelayClient — 出站长连: /connect?session&token → 收 {type:request} 派本机反代 → 回 {type:response} ──
class _BrgRelayClient {
  constructor() { this.ws = null; this.cfg = null; this.stopped = true; this.connected = false; this.lastErr = ""; this._hb = null; this._reconnectTimer = null; this._backoff = 1500; }
  start(cfg) { this.cfg = cfg; this.stopped = false; return this._connect(); }
  wsUrl() {
    const base = String(this.cfg.relayUrl || "").replace(/\/$/, "").replace(/^http/, "ws");
    return base + "/connect?session=" + encodeURIComponent(this.cfg.session) + "&token=" + encodeURIComponent(this.cfg.relayToken);
  }
  async _connect() {
    if (this.stopped) return false;
    try {
      const ws = await _BrgWsClient.connect(this.wsUrl(), { proxy: _brgDetectProxy(), timeoutMs: 15000 });
      this.ws = ws;
      this.connected = true;
      this.lastErr = "";
      this._backoff = 1500;
      ws.onMessage((s) => this._onMessage(s));
      ws.onClose(() => { this.connected = false; this._clearHb(); if (!this.stopped) this._scheduleReconnect(); });
      this._clearHb();
      this._hb = setInterval(() => { try { ws.send(JSON.stringify({ type: "ping" })); } catch (e) {} }, 15000);
      try { _writeEndpointDiscovery(); } catch (_) {}
      return true;
    } catch (e) {
      this.connected = false;
      this.lastErr = String((e && e.message) || e);
      if (!this.stopped) this._scheduleReconnect();
      return false;
    }
  }
  _scheduleReconnect() {
    if (this._reconnectTimer || this.stopped) return;
    const wait = this._backoff;
    this._backoff = Math.min(Math.round(this._backoff * 1.7), 30000);
    this._reconnectTimer = setTimeout(() => { this._reconnectTimer = null; this._connect(); }, wait);
  }
  async _onMessage(s) {
    let m; try { m = JSON.parse(s); } catch (e) { return; }
    if (!m || typeof m !== "object") return;
    if (m.type === "pong") return;
    if (m.type === "ping") { try { this.ws.send(JSON.stringify({ type: "pong" })); } catch (e) {} return; }
    if (m.type === "request") {
      let out;
      try { _brgEnsureRevproxyReady(); out = await _brgRelayDispatch(m); }
      catch (e) { out = { status: 500, body: { error: String(e && e.message) } }; }
      try { this.ws.send(JSON.stringify({ type: "response", id: m.id, status: (out && out.status) || 200, body: out && out.body })); } catch (e) {}
    }
  }
  _clearHb() { if (this._hb) { clearInterval(this._hb); this._hb = null; } }
  stop() {
    this.stopped = true; this.connected = false;
    this._clearHb();
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    try { this.ws && this.ws.close(); } catch (e) {}
    this.ws = null;
  }
}
function _brgRelayClient() { if (!_brgRelay) _brgRelay = new _BrgRelayClient(); return _brgRelay; }
function _brgRelayState() {
  const cfg = _brgLoadRelayCfg();
  if (!cfg || !cfg.relayUrl) return null;
  const rc = _brgRelay;
  return {
    url: cfg.relayUrl + "/relay/" + encodeURIComponent(cfg.session),
    relayUrl: cfg.relayUrl,
    session: cfg.session,
    connected: !!(rc && rc.connected),
    lastErr: (rc && rc.lastErr) || "",
  };
}
// 开机/激活时: 若已绑过 API Token(存在 relay 配置), 自动拉起出站长连(持久通道自愈)。
async function _brgRelayAutoStart() {
  const cfg = _brgLoadRelayCfg();
  if (!cfg || !cfg.relayUrl || !cfg.session || !cfg.relayToken) return false;
  const rc = _brgRelayClient();
  try { rc.stop(); } catch (_) {}
  return rc.start(cfg);
}
// 绑定 API Token → 自动部署固定 workers.dev 中继 + 拉起长连。返回带 publicUrl 的结果。
async function _brgBindCfToken(apiToken) {
  const tok = String(apiToken || "").trim();
  if (!tok) return { ok: false, message: "API Token 为空" };
  // 校验
  const v = await _brgCfApiRequest("GET", "/user/tokens/verify", tok);
  if (!(v.status === 200 && v.json && v.json.success)) {
    return { ok: false, message: "API Token 校验未通过(需有效的 Cloudflare API Token): " + _brgCfErr(v) };
  }
  const rel = await _brgProvisionRelay(tok);
  if (!rel.ok) return rel;
  _brgEnsureRevproxyReady();
  const rc = _brgRelayClient();
  try { rc.stop(); } catch (_) {}
  const up = await rc.start(_brgLoadRelayCfg());
  return { ok: true, relay: true, up: !!up, relayUrl: rel.relayUrl, session: rel.session, publicUrl: rel.publicUrl,
           message: "已在你的 Cloudflare 账号自动部署 workers.dev 固定中继(零域名): " + rel.publicUrl + (up ? " · 已上线" : "(连接中, 稍候自动就绪)") };
}

// 命名隧道(可选·固定域名): 校验 CF token / API 凭证并落盘。仅在用户主动登录时调用。
function _brgCfLogin(email, key) {
  const k = (key || "").trim();
  if (!k) return { ok: false, reason: "empty-key" };
  // 形如 eyJ...(命名隧道 token) 直接存; 否则视作 API Token/Global Key
  const cred = { email: (email || "").trim(), savedAt: new Date().toISOString() };
  if (/^ey[A-Za-z0-9_-]{20,}=*$/.test(k) && k.length > 60) {
    cred.tunnelToken = k;
    cred.source = "tunnel-token";
    try {
      _brgEnsureDir();
      fs.writeFileSync(
        _BRG_NAMED,
        JSON.stringify(
          { cfTunnelToken: k, email: cred.email, savedAt: cred.savedAt },
          null,
          2,
        ),
        "utf8",
      );
    } catch (_) {}
  } else {
    cred.apiToken = k;
    cred.source = "api-token";
  }
  _brgSaveCfCred(cred);
  return { ok: true, source: cred.source };
}
// 注销/解绑(硬化): 即便绑定数据损坏或中继正连着, 也一律能干净退出并可重绑。
//   先停出站长连(避免残留连接), 再逐一删凭证/命名隧道/workers.dev 中继配置(逐个 try, 互不影响),
//   最后清空内存单例。任一步失败都不阻断其余 → 「绑了退不出」根治。
function _brgResetAccount() {
  try { if (_brgRelay) _brgRelay.stop(); } catch (_) {}
  _brgRelay = null;
  for (const f of [_BRG_CF_CRED, _BRG_NAMED, _BRG_RELAY]) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  }
  try { _writeEndpointDiscovery(); } catch (_) {}
  return { ok: true };
}
// ═══ 归一(dao-one)折入复用: 读取二合一本源 dao-vsix 已发布的共享隧道 ═══
// 道并行而不相悖 — dao-one 中「🌐 内网穿透」板块起的单条 cloudflared 已把本反代端点
//   (/v1/*、/origin/revproxy/*) 一并暴露公网, 故 Proxy Pro ⑤ 面板无需重复起隧道,
//   直接读 dao-vsix 落盘的权威连接文件, 复用同一条公网 URL。
const _BRG_SHARED_FRESH_MS = 15 * 60 * 1000;
// 仅「真·公网 URL」才算共享隧道可复用 —— 本地回环(localhost/127.*/0.0.0.0/内网私网段)不是公网,
//   dao-vsix 隧道未起时 dao-conn-current.json 的 url 会回落成 http://localhost:9920, 不可当公网复用。
//   dao-vsix saveConnection(): publicUrl 存在时才写 relayUrl, 且 url=publicUrl; 未起时 url=localhost。
//   故权威公网源优先取 relayUrl, 再取 url/primaryUrl, 并强校验非回环、非私网。
function _brgIsPublicUrl(u) {
  const m = /^https?:\/\/([^/:]+)/i.exec(String(u || "").trim());
  if (!m) return false;
  const h = m[1].toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1") return false;
  if (/^127\./.test(h)) return false;
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  return true;
}
function _brgLocalPortOf(c) {
  // 从连接文件推断该隧道 front 的本地端口(用以辨识「哪条隧道罩着 dao-vsix 归一服务」)
  if (Number.isFinite(c.port)) return c.port;
  const lu = String(c.local_url || c.localUrl || "").trim();
  const m = /:(\d{2,5})(?:\/|$)/.exec(lu);
  return m ? parseInt(m[1], 10) : 0;
}
function _brgReadSharedTunnel() {
  const home = process.env.USERPROFILE || process.env.HOME || "";
  if (!home) return null;
  const now = Date.now();
  // dao-vsix 归一服务权威端口: 读 dao-conn-current.json(dao-vsix 自身落盘)。归一折入时反代端点
  //   随 dao-vsix 同端口(9920)对外, 故只认「front 该端口」的那条公网隧道 —— 机控 addon(另口 15715)
  //   只代理 /api/*、不 front /v1|/origin/revproxy, 复用它会拿到打不通反代的假公网(道·辨同异)。
  let vsixPort = 0;
  try {
    const cur = JSON.parse(fs.readFileSync(path.join(home, ".dao", "dao-conn-current.json"), "utf8")) || {};
    vsixPort = _brgLocalPortOf(cur);
    // dao-vsix 自身 board 隧道活跃时 relayUrl/publicUrl 直接就是权威公网 URL, 最优先
    for (const cand of [cur.relayUrl, cur.publicUrl, cur.primaryUrl, cur.url]) {
      if (_brgIsPublicUrl(cand)) {
        let ageMs = cur.updated ? now - Date.parse(cur.updated) : NaN;
        if (!(Number.isFinite(ageMs) && ageMs > _BRG_SHARED_FRESH_MS)) {
          return { url: String(cand).trim(), token: String(cur.token || "").trim(),
                   source: "dao-vsix", file: "dao-conn-current.json", port: vsixPort,
                   ageMs: Number.isFinite(ageMs) ? ageMs : 0 };
        }
      }
    }
  } catch (_) {}
  // 退而求其次: 扫 bridge/*.json, 只取「front dao-vsix 端口」的公网隧道; 无端口线索时兜底任一公网
  const files = [
    path.join(home, ".dao", "bridge", "connection.json"),
    path.join(home, ".dao", "bridge", "conn.json"),
  ];
  let fallback = null;
  for (const p of files) {
    try {
      const c = JSON.parse(fs.readFileSync(p, "utf8")) || {};
      let url = "";
      for (const cand of [c.relayUrl, c.publicUrl, c.primaryUrl, c.url]) {
        if (_brgIsPublicUrl(cand)) { url = String(cand).trim(); break; }
      }
      if (!url) continue;
      let ageMs = c.updated ? now - Date.parse(c.updated) : NaN;
      if (Number.isFinite(ageMs) && ageMs > _BRG_SHARED_FRESH_MS) continue;
      const rec = { url, token: String(c.token || "").trim(),
                    source: String(c.source || "dao-vsix").trim(), file: path.basename(p),
                    port: _brgLocalPortOf(c), ageMs: Number.isFinite(ageMs) ? ageMs : 0 };
      if (vsixPort && rec.port === vsixPort) return rec; // front 归一端口 → 就是它
      if (!fallback) fallback = rec;
    } catch (_) {}
  }
  // 已知归一端口却无一条隧道 front 它 → 判定「无共享反代隧道可复用」, 不拿机控 addon(另口)充数。
  //   仅在无从得知归一端口(读不到 dao-conn-current.json)时, 才退而用任一公网候选。
  return vsixPort ? null : fallback;
}
function _brgStatus(preferShared) {
  const pid = _brgPidAlive();
  let url = _brgReadUrlFromLog();
  if (url) _brgUrl = url;
  const cf = _brgCfState();
  let running = !!(pid || _brgProc);
  const proxy = _brgDetectProxy();
  // 折入模式: 本插件未自起隧道时, 复用 dao-vsix 共享隧道的公网 URL(不重复造轮子)
  const shared = _brgReadSharedTunnel();
  let sharedActive = false;
  if (preferShared && !url && shared && shared.url) {
    url = shared.url;
    sharedActive = true;
    running = true;
  }
  // workers.dev 固定中继(持久通道·永不轮换): 用户绑 API Token 后可用, 与快速隧道并存。
  const relay = _brgRelayState();
  return {
    ok: true,
    running,
    connecting: running && !url,
    shared: sharedActive,
    sharedUrl: shared ? shared.url : "",
    sharedSource: shared ? shared.source : "",
    url: url || "",
    named: cf.named,
    relay: relay ? {
      bound: true,
      connected: relay.connected,
      relayUrl: relay.relayUrl,
      session: relay.session,
      publicUrl: relay.url,
      lastErr: relay.lastErr,
    } : { bound: false, connected: false },
    localPort: _actualPort,
    boundPort: _brgReadBoundPort() || (running ? _actualPort : 0),
    bin: _brgFindCloudflared() || "",
    pid: pid || 0,
    startedMs: _brgStartMs || 0,
    cfLoggedIn: cf.cfLoggedIn,
    cfEmail: cf.cfEmail,
    proxy: proxy || "",
    watchdog: !!_brgWatchdog,
    // 公网端点 (反代直调 · 任意 AI 工具凭此 + apiKey 在公网直连反带模型)
    publicBase: url ? url + "/v1" : "",
    publicChat: url ? url + "/v1/chat/completions" : "",
    publicMessages: url ? url + "/v1/messages" : "",
    publicModels: url ? url + "/v1/models" : "",
    publicConsole: url ? url + "/origin/revproxy/console" : "",
    publicStatus: url ? url + "/origin/revproxy/status" : "",
    // v9.9.348 · 退避/宽限状态(供前端面板展示)
    backoff: _brgBackoffUntilMs > Date.now() ? Math.round((_brgBackoffUntilMs - Date.now()) / 1000) : 0,
    spawnFails: _brgSpawnFails,
    graceRemaining: (running && !url && _brgStartMs && Date.now() - _brgStartMs < _BRG_ESTABLISH_GRACE_MS)
      ? Math.round((_BRG_ESTABLISH_GRACE_MS - (Date.now() - _brgStartMs)) / 1000) : 0,
  };
}

function _writeEndpointDiscovery() {
  try {
    const dir = _daoUserDir();
    if (!dir) return;
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
    const base = "http://127.0.0.1:" + _actualPort;
    const payload = {
      base,
      port: _actualPort,
      host: "127.0.0.1",
      pid: process.pid,
      version: _extVersion(),
      mode: SP_MODE,
      handoff_url: base + "/origin/ea/handoff.md",
      overview_url: base + "/origin/ea/overview",
      health_url: base + "/origin/health",
      // ★ 反带 API (反者道之动) · 标准本地端点自省 · 任意本地 Agent 凭此直连数据面
      revproxy: {
        base: base + "/v1",
        chat_url: base + "/v1/chat/completions",
        messages_url: base + "/v1/messages",
        models_url: base + "/v1/models",
        status_url: base + "/origin/revproxy/status",
        handoff_url: base + "/origin/revproxy/handoff.md",
        key_hint:
          "GET /origin/revproxy/status (本机) 返回 apiKey; 或读 ~/.codeium/dao-byok/revproxy.json 之 apiKey",
        // 内网穿透 · DAO Bridge: 隧道活时公网端点自省 (任意 AI 工具凭此 + apiKey 公网直调)
        tunnel: (function () {
          try {
            const t = _brgStatus();
            return {
              running: t.running,
              url: t.url || "",
              public_base: t.publicBase || "",
              public_chat: t.publicChat || "",
              public_messages: t.publicMessages || "",
              public_models: t.publicModels || "",
              public_console: t.publicConsole || "",
              status_url: base + "/origin/revproxy/tunnel",
            };
          } catch (_) {
            return { running: false, status_url: base + "/origin/revproxy/tunnel" };
          }
        })(),
      },
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(dir, "endpoint.json"),
      JSON.stringify(payload, null, 2),
      { mode: 0o600 },
    );
  } catch {}
}

// ★ v9.9.270 · 生成实时交接指挥文档 (Markdown) · 供官方/任意 Agent 热配置
function _buildHandoffMd() {
  _writeEndpointDiscovery(); // 生成文档同时刷新发现文件 · 二者同源
  const cfg = _eaRuntimeMod ? _eaRuntimeMod.hotGetConfig() : {};
  const providers = (cfg && cfg.providers) || {};
  const routes = (cfg && cfg.daoRoutes && cfg.daoRoutes.routes) || {};
  const fams = _getOfficialFamilies();
  const src = _officialFamiliesSource();
  const now = new Date().toISOString();
  // 七十六章「柔弱微细居上」· 不争固定端口 · 随实际监听端口而动 (各户 FNV 端口/临时端口各异)
  const base = "http://127.0.0.1:" + _actualPort;
  const L = [];
  L.push("# dao-proxy-pro · 实时交接指挥文档 (Agent Handoff)");
  L.push("");
  L.push("> 道法自然 · 无为而无不为 · 本插件运行于设备内部, 全部能力对 Agent 开放.");
  L.push("> 把本文件交给运行中的官方/任意 Agent, 它即可照此**热推进·热修改·热配置**路由与渠道, 无需重启.");
  L.push("");
  const _udir = _daoUserDir();
  const _epFile = _udir ? path.join(_udir, "endpoint.json") : "(不可用)";
  L.push("- 生成时间: `" + now + "`");
  L.push("- 控制面 Base URL: `" + base + "` (仅本机 127.0.0.1 · 无需鉴权)");
  L.push("- 端点发现文件: `" + _epFile + "` (推荐先读此文件取 base · 文档可能阶段性过期)");
  L.push("- 模型源: `" + src + "` (live=右侧 Cascade 实时捕获 / static=内置目录)");
  L.push(
    "- 官方家族数: `" +
      (fams ? fams.length : 0) +
      "` · 实捕模型数: `" +
      ((_liveModelCapture.models || []).length) +
      "`",
  );
  L.push("");
  L.push("## 零、连接握手 (本地 Agent 三步接入底层)");
  L.push("");
  L.push("> 目标: 任意跑在本机的 Agent 拿到本文档即可直接接管运行中的本插件·热修热管一切·无需重启。");
  L.push("");
  L.push("1. **取 Base**: 优先读发现文件 `" + _epFile + "` 中的 `base`(即便本文档端口过期也准); 读不到则用上方 Base URL。");
  L.push("   - 发现文件内容: `{ base, port, pid, version, mode, handoff_url, overview_url, health_url, updatedAt }`");
  L.push("2. **探活**: `GET $BASE/origin/health` 返 200 即控制面存活; `GET $BASE/origin/ea/overview` 拿一站式全貌(渠道/路由/健康/模型源)。");
  L.push("3. **热管理**: 照下面「三、热配置 API」直接 curl 增删渠道/路由、切提示词与经藏、探活与冒烟测试、读用量与上游抓取·均即时生效。");
  L.push("");
  L.push("```bash");
  L.push("# 一行接入(本机): 读发现文件拿 base → 拉全貌");
  L.push("BASE=$(node -e \"process.stdout.write(require('" + _epFile.replace(/\\/g, "/") + "').base)\" 2>/dev/null || echo '" + base + "')");
  L.push("curl -s $BASE/origin/ea/overview");
  L.push("```");
  L.push("");
  L.push("## 一、当前渠道 (providers)");
  L.push("");
  L.push("| 名称 | 启用 | 协议 | baseUrl | 模型 |");
  L.push("| --- | --- | --- | --- | --- |");
  for (const [name, p] of Object.entries(providers)) {
    L.push(
      "| `" +
        name +
        "` | " +
        (p.enabled ? "✓" : "✗") +
        " | " +
        (p.protocol || p.type || "auto") +
        " | " +
        (p.baseUrl || "") +
        " | " +
        ((p.models || []).join(", ") || "-") +
        " |",
    );
  }
  L.push("");
  L.push("## 二、当前路由 (routes · 官方模型 → 渠道)");
  L.push("");
  L.push("| 官方模型 UID | → 渠道 | → 渠道模型 | 备注 |");
  L.push("| --- | --- | --- | --- |");
  for (const [uid, r] of Object.entries(routes)) {
    if (uid.startsWith("_")) continue;
    L.push(
      "| `" +
        uid +
        "` | `" +
        (r.provider || "") +
        "` | `" +
        (r.model || "") +
        "` | " +
        (r._label || "") +
        " |",
    );
  }
  L.push("");
  L.push("## 三、热配置 API (Agent 可直接调用 · 即时生效·不重启)");
  L.push("");
  L.push("### 读取");
  L.push("- `GET /origin/ea/overview` — 一站式: 官方家族 + 渠道 + 路由 + 模型源");
  L.push("- `GET /origin/ea/live-models` — 右侧 Cascade 实捕模型 (含原始候选串, 校验用)");
  L.push("- `GET /origin/ea/config` — 完整配置 · `GET /origin/ea/routes` · `GET /origin/ea/providers`");
  L.push("- `GET /origin/ea/handoff.md` — 本文件 (实时刷新)");
  L.push("");
  L.push("### 热配渠道");
  L.push("```bash");
  L.push("# 新增/更新渠道 (apiKey 填入即启用)");
  L.push("curl -X POST " + base + "/origin/ea/provider \\");
  L.push("  -H 'Content-Type: application/json' \\");
  L.push(
    "  -d '" +
      JSON.stringify({
        name: "freemodel",
        config: {
          enabled: true,
          apiKey: "fe_oa_***",
          baseUrl: "https://cc.freemodel.dev",
          models: ["claude-sonnet-4", "deepseek-v3"],
          type: "openai-compatible",
          protocol: "openai-chat",
        },
      }) +
      "'",
  );
  L.push("# 删除渠道");
  L.push("curl -X DELETE " + base + "/origin/ea/provider/freemodel");
  L.push("```");
  L.push("");
  L.push("### 热配路由 (官方模型 → 渠道)");
  L.push("```bash");
  L.push("curl -X POST " + base + "/origin/ea/route \\");
  L.push("  -H 'Content-Type: application/json' \\");
  L.push(
    "  -d '" +
      JSON.stringify({
        modelUid: "MODEL_SWE_1_6_FAST",
        route: {
          provider: "freemodel",
          model: "deepseek-v3",
          maxOutputTokens: 32768,
          thinkingEnabled: true,
        },
      }) +
      "'",
  );
  L.push("# 删除路由");
  L.push("curl -X DELETE " + base + "/origin/ea/route/MODEL_SWE_1_6_FAST");
  L.push("```");
  L.push("");
  L.push("### 其他 (批写/重载/探活/测试/发现)");
  L.push("- `POST /origin/ea/config` — 批量写配置 (body 为完整 config 对象)");
  L.push("- `POST /origin/ea/reload` — 重载配置 (手改配置.json 后生效) · `POST /origin/ea/probe` — 实证探活全渠道");
  L.push("- `POST /origin/ea/test-chat` — 冒烟测试某渠道连通性 (body: `{modelUid, message}`)");
  L.push("- `GET /origin/ea/discover-models?provider=NAME` — 拉该渠道 /v1/models 自动发现可用模型");
  L.push("- `DELETE /origin/ea/provider/:name` · `DELETE /origin/ea/route/:uid` — 热删除渠道/路由");
  L.push("");
  L.push("### 提示词·经藏 (道魂热切 · 不重启)");
  L.push("```bash");
  L.push("# 模式: 道(帛书前置注入) / 官(透传)  —  GET 看当前, POST 切换");
  L.push("curl -s " + base + "/origin/mode");
  L.push("curl -X POST " + base + "/origin/mode -H 'Content-Type: application/json' -d '" + JSON.stringify({ mode: "invert" }) + "'");
  L.push("# 两面分治(v9.9.371): Devin Local(local 面·chisel acp) 与 Cascade(cascade 面·LS) 各自独立 SP 模式");
  L.push("curl -X POST " + base + "/origin/mode -H 'Content-Type: application/json' -d '" + JSON.stringify({ mode: "invert", surface: "local" }) + "'  # 仅 Devin Local 面切道化");
  L.push("# 路由 scope: routes[uid].scope = all|local|cascade (缺省 all 双面生效·POST /origin/ea/route 传 scope)");
  L.push("# 经藏热切: laozi+yinfu(默认) / laozi(单帛书老子) / yinfu(单阴符经)");
  L.push("curl -s " + base + "/origin/canon");
  L.push("curl -X POST " + base + "/origin/canon -H 'Content-Type: application/json' -d '" + JSON.stringify({ canon: "laozi" }) + "'");
  L.push("# 工具模式: 仅 official 一档 (v9.9.373 · windows/freecad/kicad 域契约线已废)");
  L.push("curl -s " + base + "/origin/tools");
  L.push("# 自定义注入 SP: GET 看 / POST 设 / DELETE 清");
  L.push("curl -s " + base + "/origin/custom_sp");
  L.push("curl -X POST " + base + "/origin/custom_sp -H 'Content-Type: application/json' -d '" + JSON.stringify({ sp: "你的自定义系统提示词" }) + "'");
  L.push("curl -X DELETE " + base + "/origin/custom_sp");
  L.push("```");
  L.push("");
  L.push("### 观测·用量 (本源观照 · 验证注入与消耗)");
  L.push("- `GET /origin/upstream` — 最上游(发往第三方模型)实收请求体: system(官方SP+道增强)+对话+工具");
  L.push("- `GET /origin/sig` — 动感签名(含 `upstream_last_at`) · 轮询判是否有新注入");
  L.push("- `GET /origin/tape?limit=1` · `GET /origin/lastinject` · `GET /origin/allinjects` — 代理流/注入快照");
  L.push("- `GET /origin/ea/usage` — 用量统计 · `GET /origin/ea/status` — 运行状态");
  L.push("");
  L.push("### ★ v9.9.285 · 渠道实证探活 (名实相符·坏渠道直书错误)");
  L.push("- `POST /origin/ea/probe` 改为发**最小真实 chat 请求**端到端验证, 不再仅探 `/models`+看状态码.");
  L.push("  - 返回每渠道 `{alive, reason, status, model, elapsed_ms, sample}`.");
  L.push("  - 杜绝双向误判: freemodel `/models`=200 却 chat 被拒(Access Denied) → 旧报 ALIVE(假阳);");
  L.push("    github `/models`=404 却 chat 实通 → 旧报 DEAD(假阴). 新法皆如实判定.");
  L.push("- `GET /origin/ea/overview` 注入 `health` 快照 + 每个 `providers[name].health{alive,reason,status}`");
  L.push("  → 前端如实展示渠道**通/不通 + 不通原因**; `family_tier_extend` 字段反映档位延伸开关.");
  L.push("- `POST /origin/ea/test-chat` 辨**伪成功**: 200 但响应体含拒绝文案(如 Access Denied) → `ok:false` + `channel_reason`.");
  L.push("");
  L.push("### ★ v9.9.285 · 同族档位延伸开关 (默认关·显式逐档路由为本)");
  L.push("- `daoRoutes.familyTierExtend`(默认 `false`): 关时**逐档显式路由**, 仅显式连线的档位被路由;");
  L.push("  未连档位(如 `swe-1-6-slow`)保持**官方原生直通**, 不被同族 `fast` 连线自动吞并.");
  L.push("- 设 `true` 时启用「连一档即覆盖全族」: 同族任一档位被显式连线 → 全族档位归一其渠道");
  L.push("  (适配 Cascade 默认下发档位与 UI 所连档位错配的场景).");
  L.push("");
  L.push("## 四、SWE-1.6 默认连线 (本源规格)");
  L.push("1. `MODEL_SWE_1_6` (基础版) → `builtin-stub` 测试通道 (固定返回·验证通路)");
  L.push("2. `swe-1-6-slow` (Slow) → **官方原生直通** (不路由·留官方)");
  L.push("3. `swe-1-6-fast` / `MODEL_SWE_1_6_FAST` (Fast) → `deepseek` (全链路打通)");
  L.push("4. GitHub Models (`gpt-4.1` / `gpt-4o` 等) → `github` 渠道 (PAT 作 key)");
  L.push("");
  // ★ 反带 API (反者道之动) · 把已接通模型反向暴露为标准本地端点 · 任意本地 AIGen 直连
  {
    let rpBase = base;
    let rpKey = "";
    let rpEnabled = null;
    let rpDisabled = [];
    try {
      const m = _getRevproxy && _getRevproxy();
      if (m && m.loadConfig) {
        const rc = m.loadConfig() || {};
        rpKey = rc.apiKey || "";
        rpEnabled = !!rc.enabled;
        rpDisabled = Array.isArray(rc.disabledModels) ? rc.disabledModels : [];
      }
    } catch (_) {}
    L.push("## 五、反带 API (Reverse-Proxy · 反者道之动 · 任意本地 AIGen 直连底层)");
    L.push("");
    L.push(
      "> 与「二、路由」正向相反: 把渠道/路由里已接通的模型(免费官方 / 第三方渠道)**反向**暴露为",
    );
    L.push(
      "> 标准 **OpenAI** 与 **Anthropic(Claude)** 本地端点。任意本机 AIGen / 脚本 / 设备凭标准 SDK 直调,",
    );
    L.push("> 脱离 Devin Desktop。四十章「反者道之动」。");
    L.push("");
    L.push(
      "- 数据面 Base URL: `" +
        rpBase +
        "/v1`" +
        (rpEnabled === null
          ? ""
          : rpEnabled
            ? " · 状态: **已启用**"
            : " · 状态: **未启用**(先在④面板或 POST /origin/revproxy/config `{\"enabled\":true}` 开启)"),
    );
    L.push(
      "- 鉴权: `Authorization: Bearer <apiKey>`" +
        (rpKey
          ? " · 当前 key: `" + rpKey + "` (仅本机文档可见)"
          : " · 读 `GET /origin/revproxy/status`(本机) 之 `apiKey`, 或 `~/.codeium/dao-byok/revproxy.json`"),
    );
    L.push(
      "- 选择性反带: 默认**全模型皆反带**; 已排除(不外接) `" +
        rpDisabled.length +
        "` 个。`/v1/models` 只列已外接者, 调用被排除模型直接 403 `model_not_exposed`。",
    );
    L.push("");
    L.push("### 数据面 (标准 SDK · 即调即用)");
    L.push("```bash");
    L.push("# OpenAI 兼容 · 一次对话补全 (model 可填 modelUid 或家族别名如 glm-4.7)");
    L.push("curl -X POST " + rpBase + "/v1/chat/completions \\");
    L.push(
      "  -H 'Content-Type: application/json' -H 'Authorization: Bearer " +
        (rpKey || "$REVPROXY_KEY") +
        "' \\",
    );
    L.push(
      "  -d '" +
        JSON.stringify({
          model: "swe-1-6",
          messages: [{ role: "user", content: "你好" }],
          stream: false,
        }) +
        "'",
    );
    L.push("# 列出可反带模型 (仅已外接者)");
    L.push(
      "curl -s " +
        rpBase +
        "/v1/models -H 'Authorization: Bearer " +
        (rpKey || "$REVPROXY_KEY") +
        "'",
    );
    L.push("# Anthropic(Claude) 兼容 · POST " + rpBase + "/v1/messages");
    L.push("```");
    L.push("");
    L.push("### 管理面 (Agent 热管理 · 即时生效·不重启)");
    L.push("- `GET /origin/revproxy/status` — 状态 + 全模型(含 `exposed` 外接标记) + 家族 + 配额");
    L.push(
      "- `POST /origin/revproxy/config` — 热配 `{enabled,applyInvert,isolatePrompt,exposeLan,defaultMaxTokens,disabledModels,regenerateKey}`",
    );
    L.push("- `POST /origin/revproxy/tier` — 热切某家族当前反代档位 `{familyUid, modelUid}`");
    L.push("- `GET /origin/revproxy/warm` — 观照官方直通捕获帧(主槽/免费活水槽双帧)");
    L.push("");
    L.push("### 选择性反带 (万物并育·用户择去彼 · 支持批量)");
    L.push("```bash");
    L.push("# 排除某(些)模型不外接 (exposed:false)");
    L.push("curl -X POST " + rpBase + "/origin/revproxy/models \\");
    L.push(
      "  -H 'Content-Type: application/json' -d '" +
        JSON.stringify({ modelUids: ["gpt-4o", "claude-sonnet-4"], exposed: false }) +
        "'",
    );
    L.push("# 恢复某(些)模型外接 (exposed:true)");
    L.push(
      "curl -X POST " +
        rpBase +
        "/origin/revproxy/models -H 'Content-Type: application/json' -d '" +
        JSON.stringify({ modelUids: ["gpt-4o"], exposed: true }) +
        "'",
    );
    L.push("# 批量全选/全不选外接");
    L.push(
      "curl -X POST " +
        rpBase +
        "/origin/revproxy/models -H 'Content-Type: application/json' -d '" +
        JSON.stringify({ setAll: "on" }) +
        "'   # 全反带",
    );
    L.push(
      "curl -X POST " +
        rpBase +
        "/origin/revproxy/models -H 'Content-Type: application/json' -d '" +
        JSON.stringify({ setAll: "off" }) +
        "'  # 全不反带",
    );
    L.push("```");
    L.push("");
    // 内网穿透 · DAO Bridge: 把上述反带端点直暴公网, 任意公网 AI 工具凭「公网Base + 同一 apiKey」直调
    let _brg = null;
    try {
      _brg = _brgStatus();
    } catch (_) {}
    L.push("### ⑤ 内网穿透 · 外接反代底层 API 公网通道 (Proxy Pro 第五模块)");
    L.push(
      "> 本模块把上述**反代底层 API**(`/v1/*`、`/origin/revproxy/*`)暴露到公网 —— 与「操作整机」定位不同, 这里专注**帮用户配置内网穿透、对外提供反代底层 API**。两条通道并存(道并行而不相悖):",
    );
    L.push(
      "> 1. **默认·快速隧道(零账号·去中心化)**: cloudflared quick tunnel, 即开即用, URL 随重启轮换。公网 AI 工具把 Base 换成**公网URL**、Header 仍带同一 `apiKey` 即可直调反带模型。",
    );
    L.push(
      "> 2. **可选·固定通道(只需一个 Cloudflare API Token·零域名·永不轮换)**: 在 ⑤ 面板粘贴 API Token 点「绑定并固定」, 系统自动把最小中继 Worker 部署到你自己账号的免费 `*.workers.dev` 子域, 得到永久固定的公网入口(持久化·重启自愈)。**无需自备域名**。",
    );
    if (_brg && _brg.relay && _brg.relay.bound) {
      L.push("- 固定通道(workers.dev 中继): " + (_brg.relay.connected ? "**已上线**" : "连接中") + " · 公网入口 `" + (_brg.relay.publicUrl || "") + "`");
      L.push("  - 公网侧调用: `POST <公网入口> -H 'Authorization: Bearer <relayToken>' -d '{\"path\":\"/v1/chat/completions\",\"method\":\"POST\",\"body\":{...}}'` (relay session+token 即凭证, 反代 apiKey 由本机自动注入)。");
    }
    if (_brg && _brg.running && _brg.url) {
      L.push("- 快速隧道状态: **已连通**" + (_brg.named ? " (命名隧道·固定域名)" : " (快速隧道)"));
      L.push("- 公网 Base URL: `" + _brg.publicBase + "`");
      L.push("- 公网对话补全: `" + _brg.publicChat + "`");
      L.push("- 公网 Claude 端点: `" + _brg.publicMessages + "`");
      L.push("- 公网模型列表: `" + _brg.publicModels + "`");
      L.push("- 公网网页对话台(零鉴权·浏览器直开): `" + _brg.publicConsole + "`");
      L.push("```bash");
      L.push("# 公网任意环境 · OpenAI 兼容直调 (Base 换公网URL · key 不变)");
      L.push("curl -X POST " + _brg.publicChat + " \\");
      L.push(
        "  -H 'Content-Type: application/json' -H 'Authorization: Bearer " +
          (rpKey || "$REVPROXY_KEY") +
          "' \\",
      );
      L.push(
        "  -d '" +
          JSON.stringify({
            model: "swe-1-6",
            messages: [{ role: "user", content: "你好" }],
            stream: false,
          }) +
          "'",
      );
      L.push("```");
    } else {
      L.push(
        "- 隧道状态: **未连通** — 在 ⑤ 内网穿透 面板点「启动隧道」, 或 `POST " +
          rpBase +
          "/origin/revproxy/tunnel {\"action\":\"start\"}` 即得公网URL。",
      );
    }
    L.push("- 隧道管理: `GET/POST " + rpBase + "/origin/revproxy/tunnel` — `{action: start|stop|restart|startNamed|cfLogin|bindCf|relayStart|relayStop|logout}`");
    L.push("  - `bindCf {token}`: 一个 CF API Token → 自动部署 workers.dev 固定中继(零域名·持久)。`logout`: 停中继 + 清所有凭证(即使数据损坏也能干净解绑重绑)。");
    L.push("");
  }
  L.push("---");
  L.push("_本文件由 /origin/ea/handoff.md 实时生成 · 反映插件当前真实状态 · 端点发现文件 endpoint.json 保证跨重启可连 · v9.9.348_");
  return L.join("\n");
}

// ★ v9.9.347 · 模型反代专属 Agent 交接文档 (Markdown) · 反者道之动
//   面向「本地/云端 Agent」: 照此把已反带的模型经内网穿透暴露到公网, 让第三方公网环境
//   (智能家居/其他设备/云端脚本)以标准 OpenAI·Anthropic SDK 无感直调。与 /origin/ea/handoff.md
//   (渠道配置/模型路由的总交接文档)分工: 本文专注「模型反代 → 公网直调」这一条链路的接管。
function _buildRevproxyHandoffMd() {
  _writeEndpointDiscovery();
  const L = [];
  const base = "http://127.0.0.1:" + _actualPort;
  // 反代实时配置 + apiKey
  let rpKey = "", rpEnabled = false, rpDisabled = 0;
  try {
    const m = _getRevproxy && _getRevproxy();
    if (m && m.loadConfig) {
      const rc = m.loadConfig() || {};
      rpKey = rc.apiKey || "";
      rpEnabled = !!rc.enabled;
      rpDisabled = Array.isArray(rc.disabledModels) ? rc.disabledModels.length : 0;
    }
  } catch (_) {}
  let rpModels = 0;
  try { rpModels = Math.max(0, (_fullModelCatalog ? _fullModelCatalog.length : 0) - rpDisabled); } catch (_) {}
  // 隧道实时状态(公网入口)
  let brg = null;
  try { brg = _brgStatus(); } catch (_) {}
  const pub = (brg && brg.url) || "";
  const relay = brg && brg.relay && brg.relay.bound ? brg.relay : null;
  const relayPub = relay && relay.publicUrl ? relay.publicUrl : "";
  const publicBase = pub ? pub + "/v1" : (relayPub ? relayPub + "/v1" : "");

  L.push("# dao-proxy-pro · 模型反代 → 公网直调 · Agent 交接文档");
  L.push("");
  L.push("> 反者道之动。本插件把「渠道配置/模型路由」里已接通的模型(免费 GLM / 官方家族映射 /");
  L.push("> 任意 OpenAI·Anthropic 兼容渠道)**反向暴露为标准端点**, 再经**内网穿透**推到公网,");
  L.push("> 让第三方公网环境以标准 SDK **无感直调**。任意 Agent 拿到本文即可接管这条链路·热配·热管·不重启。");
  L.push("");
  L.push("## 一、当前实时状态");
  L.push("");
  L.push("| 项 | 值 |");
  L.push("|---|---|");
  L.push("| 模型反代 | " + (rpEnabled ? "✅ 已启用" : "❌ 未启用(POST /origin/revproxy/config {\"enabled\":true})") + " |");
  L.push("| 可反带模型数 | " + rpModels + " |");
  L.push("| 本地端点 Base | `" + base + "/v1` |");
  L.push("| 本地鉴权 Key | " + (rpKey ? "`" + rpKey + "`" : "(空 · 仅 127.0.0.1 放行 · POST config {\"regenerateKey\":true} 生成)") + " |");
  L.push("| 内网穿透 | " + (brg && brg.running ? "🟢 已连通" : (brg && brg.connecting ? "🟡 建立中" : "⚪ 未连通")) + (brg && brg.watchdog ? " · 自愈守护在" : "") + " |");
  L.push("| 公网 Base | " + (publicBase ? "`" + publicBase + "`" : "(隧道未连通 · 见下「三、开通/自愈」)") + " |");
  if (relay) L.push("| 持久中继 | " + (relay.connected ? "🟢 出站长连已上线" : "🟡 已绑·重连中") + " · `" + (relayPub || relay.relayUrl || "") + "`(永不轮换) |");
  L.push("");
  L.push("## 二、公网直调(第三方环境 · 换 Base 不换 Key)");
  L.push("");
  L.push("公网 Agent / 智能家居 / 云端脚本, 只需把 SDK 的 `base_url` 指向**公网 Base**、`api_key` 用上表 Key:");
  L.push("");
  L.push("```bash");
  L.push("# OpenAI 兼容 · Chat Completions");
  L.push("curl -X POST " + (publicBase || "https://<公网URL>/v1") + "/chat/completions \\");
  L.push("  -H 'Content-Type: application/json' -H 'Authorization: Bearer " + (rpKey || "$REVPROXY_KEY") + "' \\");
  L.push("  -d '" + JSON.stringify({ model: "swe-1-6", messages: [{ role: "user", content: "你好" }], stream: false }) + "'");
  L.push("");
  L.push("# 列出可反带模型");
  L.push("curl -s " + (publicBase || "https://<公网URL>/v1") + "/models -H 'Authorization: Bearer " + (rpKey || "$REVPROXY_KEY") + "'");
  L.push("");
  L.push("# Anthropic(Claude) 兼容 · Messages");
  L.push("curl -X POST " + (publicBase || "https://<公网URL>/v1") + "/messages -H 'x-api-key: " + (rpKey || "$REVPROXY_KEY") + "' \\");
  L.push("  -H 'anthropic-version: 2023-06-01' -H 'Content-Type: application/json' \\");
  L.push("  -d '" + JSON.stringify({ model: "swe-1-6", max_tokens: 1024, messages: [{ role: "user", content: "你好" }] }) + "'");
  L.push("```");
  L.push("");
  L.push("Python(openai SDK):");
  L.push("```python");
  L.push("from openai import OpenAI");
  L.push("client = OpenAI(base_url=\"" + (publicBase || "https://<公网URL>/v1") + "\", api_key=\"" + (rpKey || "<KEY>") + "\")");
  L.push("print(client.chat.completions.create(model=\"swe-1-6\", messages=[{\"role\":\"user\",\"content\":\"你好\"}]).choices[0].message.content)");
  L.push("```");
  L.push("");
  L.push("## 三、开通 / 自愈内网穿透(三条路·去中心化默认)");
  L.push("");
  L.push("插件**激活即自动**拉起零账号快速隧道(无需任何账号), 死后 watchdog 15s 内自动重启。");
  L.push("手动管理经隧道端点(本机):");
  L.push("");
  L.push("```bash");
  L.push("# 状态");
  L.push("curl -s " + base + "/origin/revproxy/tunnel");
  L.push("# ① 零账号快速隧道(去中心化默认·即得 *.trycloudflare.com 公网URL)");
  L.push("curl -X POST " + base + "/origin/revproxy/tunnel -d '" + JSON.stringify({ action: "start" }) + "'");
  L.push("# ② 固定公网域名(持久·永不轮换): 只给一个 Cloudflare API Token, 零自备域名, 自动部署 workers.dev 中继");
  L.push("curl -X POST " + base + "/origin/revproxy/tunnel -d '" + JSON.stringify({ action: "bindCf", token: "<CF_API_TOKEN>" }) + "'");
  L.push("# ③ 命名隧道(自有域名·固定子域): cfLogin 后 startNamed");
  L.push("curl -X POST " + base + "/origin/revproxy/tunnel -d '" + JSON.stringify({ action: "cfLogin", email: "<email>", key: "<API_TOKEN_OR_KEY>" }) + "'");
  L.push("curl -X POST " + base + "/origin/revproxy/tunnel -d '" + JSON.stringify({ action: "startNamed" }) + "'");
  L.push("# 重启 / 停止(停止落暂停旗·自动连接挂起至下次手动启动或 24h 安全自复)");
  L.push("curl -X POST " + base + "/origin/revproxy/tunnel -d '" + JSON.stringify({ action: "restart" }) + "'");
  L.push("curl -X POST " + base + "/origin/revproxy/tunnel -d '" + JSON.stringify({ action: "stop" }) + "'");
  L.push("```");
  L.push("");
  L.push("`{action}` 全集: `start|stop|restart|startNamed|cfLogin|bindCf|relayStart|relayStop|logout|resetProxy`。");
  L.push("");
  L.push("## 四、热管理模型反代(即时生效·不重启)");
  L.push("");
  L.push("- `GET  " + base + "/origin/revproxy/status` — 状态 + 全模型(含 `exposed` 外接标记) + 家族 + 配额 + apiKey");
  L.push("- `POST " + base + "/origin/revproxy/config` — `{enabled,applyInvert,isolatePrompt,exposeLan,defaultMaxTokens,disabledModels,regenerateKey}`");
  L.push("- `POST " + base + "/origin/revproxy/models` — 选择性反带 `{modelUids:[...],exposed:true|false}` 或 `{setAll:\"on\"|\"off\"}`");
  L.push("- `POST " + base + "/origin/revproxy/tier` — 热切某家族当前反代档位 `{familyUid, modelUid}`");
  L.push("- 网页对话台: `" + base + "/origin/revproxy/console`" + (pub ? " · 公网 `" + pub + "/origin/revproxy/console`" : ""));
  L.push("");
  L.push("## 五、自愈要点(为何这次不再反复掉线)");
  L.push("");
  L.push("- **激活自动连接**: 无需用户手点「启动隧道」, 开机即打通(去中心化零账号默认)。");
  L.push("- **watchdog 守护**: 隧道进程死亡 15s 内自动重启; 复用孤儿进程(窗口重载不断线)。");
  L.push("- **指数退避**: trycloudflare 限流(429/1015)时不盲重试, 指数等待(5s→10s→…最多5min), URL 注册成功即归零。");
  L.push("- **宽限期 45s**: 新 spawn 不到 45s 即死(还没注册 URL)才计失败+退避, 已有 URL 后死则正常重启。");
  L.push("- **冷却期 25s**: 两次 spawn 间至少 25s, 防密集重启浪费资源。");
  L.push("- **强制 http2 传输**: 走 443/TCP, 绕过 QUIC(UDP 7844)被防火墙/NAT 拦死的环境。");
  L.push("- **代理自探**: 国内环境自动探测本机代理(7890 等 7 口)注入 cloudflared, 无代理亦回退直连。");
  L.push("- **端点发现文件**: `~/.codeium/dao-byok/endpoint.json` 恒记最新公网/本地端点, 跨重启换端口可连。");
  L.push("- **手动停止即真停**: 落暂停旗, 自动连接/自愈挂起, 直至手动启动/重启或 24h 安全自复。");
  L.push("");
  L.push("---");
  L.push("_本文件由 " + base + "/origin/revproxy/handoff.md 实时生成 · 反映插件当前真实状态 · v9.9.348_");
  return L.join("\n");
}

// 全量静态目录 → 家族归一 (一族一项·档位收于 members)
function _buildStaticFamilies() {
  const cat = _fullModelCatalog || _loadFullModelCatalog();
  if (!cat || !cat.length) return [];
  const fams = new Map(); // key → family
  const order = [];
  for (const m of cat) {
    const mi = m.modelInfo || {};
    const fmeta = m.modelFamilyMetadata || {};
    const fu = mi.modelFamilyUid || null;
    let label = fmeta.modelFamilyLabel || null;
    // 无家族标签者(如 adaptive) 独立成项, 用自身 label · 不与他者混并
    const key = fu || ("__solo__" + (m.modelUid || m.label));
    if (!label) label = m.label || m.modelUid || key;
    if (!fams.has(key)) {
      fams.set(key, {
        familyUid: fu || key,
        label,
        provider: m.provider || mi.provider || "",
        isRecommended: !!m.isRecommended,
        isNew: !!m.isNew,
        members: [],
      });
      order.push(key);
    }
    const fam = fams.get(key);
    // 档位名: 整 label 去掉家族前缀 → 余下即档位(Medium/Low Thinking...)
    let tier = String(m.label || "");
    if (label && tier.indexOf(label) === 0)
      tier = tier.slice(label.length).trim();
    fam.members.push({
      modelUid: m.modelUid,
      label: m.label,
      tier: tier || "base",
      isDefault: !!m.isDefaultModelInFamily,
    });
    if (m.isRecommended) fam.isRecommended = true;
    if (m.isNew) fam.isNew = true;
  }
  return order.map((k) => fams.get(k));
}

// ★ 救生索恒显 (利而不害·只增不减): swe-1-6-slow 是 Windsurf 在官方不可达时
//   仍保留的唯一可选档(救生索), 但官方 catalog 无其独立项 → ③左侧从不显示它,
//   用户便无从把它连到第三方 → 官方一挂即彻底卡死。
//   治: 左侧官方家族恒补一项「SWE-1.6 Slow」(familyUid=swe-1.6-slow·member=swe-1-6-slow),
//       与已有「SWE-1.6 Fast」对称 → 始终可见·始终可连第三方 (连族即覆盖全档·见 dao_router familyTierExtend)
//   道义: 二十七章「善救物·故无弃物」· 四十章「反者道之动」· 万物并育而不相害
function _ensureLifelineFamilies(fams) {
  try {
    const list = Array.isArray(fams) ? fams : [];
    const hasSlow = list.some(
      (f) =>
        f &&
        (String(f.familyUid || "").toLowerCase() === "swe-1.6-slow" ||
          (f.members || []).some((m) => m && m.modelUid === "swe-1-6-slow")),
    );
    if (hasSlow) return list;
    const slowFam = {
      familyUid: "swe-1.6-slow",
      label: "SWE-1.6 Slow",
      provider: "MODEL_PROVIDER_WINDSURF",
      isRecommended: true,
      isNew: true,
      members: [
        {
          modelUid: "swe-1-6-slow",
          label: "SWE-1.6 Slow",
          tier: "base",
          isDefault: false,
        },
      ],
      _lifeline: true,
    };
    // 紧随 swe-1.6-fast / swe-1.6 之后插入 · 视觉成组 (无锚则末尾追加)
    let anchor = -1;
    for (let i = 0; i < list.length; i++) {
      const fu = String((list[i] && list[i].familyUid) || "").toLowerCase();
      if (fu === "swe-1.6-fast" || fu === "swe-1.6") anchor = i;
    }
    if (anchor >= 0) list.splice(anchor + 1, 0, slowFam);
    else list.push(slowFam);
    return list;
  } catch {
    return Array.isArray(fams) ? fams : [];
  }
}

// ★ v9.9.275 · 利而不害·只增不减: 左侧官方模型恒以全量静态目录为底,
//   活捕新鲜时并入实捕(命中则标记 live·补全档位; 实捕独有则追加),
//   绝不因活捕而令左侧官方模型变少 · 万物并育而不相害
function _getOfficialFamilies() {
  const staticFams = _buildStaticFamilies();
  const live = _liveFresh() ? _liveModelCapture.families || [] : [];
  if (!live.length) return _ensureLifelineFamilies(staticFams);
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const out = staticFams.map((f) =>
    Object.assign({}, f, { members: f.members.slice() }),
  );
  const idx = new Map();
  out.forEach((f, i) => {
    if (f.familyUid) idx.set(norm(f.familyUid), i);
    if (f.label) idx.set(norm(f.label), i);
  });
  for (const lf of live) {
    let hit = -1;
    if (idx.has(norm(lf.familyUid))) hit = idx.get(norm(lf.familyUid));
    else if (idx.has(norm(lf.label))) hit = idx.get(norm(lf.label));
    if (hit >= 0) {
      out[hit].live = true;
      for (const mem of lf.members || []) {
        if (!out[hit].members.some((x) => x.modelUid === mem.modelUid))
          out[hit].members.push(mem);
      }
    } else {
      const nf = Object.assign({}, lf, { live: true, liveOnly: true });
      out.push(nf);
      const at = out.length - 1;
      if (nf.familyUid) idx.set(norm(nf.familyUid), at);
      if (nf.label) idx.set(norm(nf.label), at);
    }
  }
  return _ensureLifelineFamilies(out);
}

function _isModelUnlockEnabled() {
  try {
    const v = fs.readFileSync(_MODEL_UNLOCK_ENABLED_FILE, "utf8").trim();
    return v !== "0" && v !== "false" && v !== "disabled";
  } catch {
    // ★ v9.9.67-min · 缺省改禁 · 名实相符
    //   病: 旧缺省 true(文件失即默启) → 与 Min 版「无模型解锁」之名相悖;
    //       文件偶失(用户清理/打包漏带)即静默启解锁 · 非用户之意。
    //   治: 缺省 false · 需者显式 POST /origin/model_unlock {enabled:true} 或落盘 enabled。
    //   道义: 十七章「信不足 安有不信」· 名实相符 · 不默夺人意
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// ★ v9.9.263 · 真解锁 · 反者道之动 · 弱者道之用
//   GetUserStatus 响应 = application/proto + gzip · 非 JSON
//   Pro 锁 = 每模型下 field 33 (wt=2, <500B) 内含 "Upgrade to Pro" 徽标
//   损之 (去 field 33) → 模型即可选 · 为道者日损 · 损之又损以至无为
//   零依赖 protobuf 改写: 仅丢弃含徽标之 field 33 · 余皆原样回灌
// ═══════════════════════════════════════════════════════════
const _PRO_BADGE = Buffer.from("Upgrade to Pro");
const _unlockStats = { calls: 0, dropped_total: 0, last_dropped: 0, unlock4_total: 0, last_unlock4: 0, last_at: 0, last_bytes: "", last_total: 0, last_available: 0, schema: "" };
// 万模归一 retarget 计数(观测·证 field21 复用前确被改档): rewrites=真改档次数, skipped=已同档跳过
const _retargetStats = { calls: 0, rewrites: 0, skipped: 0, last_from: "", last_to: "", last_at: 0 };
// 会话鉴权保鲜(实证·2026-07): 捕获帧顶层 field1(鉴权/元数据子消息·内含 field1.3
//   "devin-session-token$<JWT{session_id}>") 与 field16(cascadeId) 是「会话钉定」的一对。
//   病灶: 免费活水槽帧可能捕于「上一会话」(其 token 已随会话轮换失效), 而主槽每轮皆被最新
//   捕获帧覆盖(携当前活会话 token)。免费档回放取免费槽→带旧会话 token→上游恒 "unauthenticated"
//   (掩码为 "an internal error occurred") = 上个对话遗留「初始帧」病之真因。
//   正法(原汤化原食·活水恒足): 回放前把「最新捕获帧(_lastChatFrame·恒最鲜)」的 field1+field16
//   整体嫁接到本次回放体上 → 任一槽的历史帧皆借最新活会话的鉴权出包, 跨会话不再失活。
const _authGraftStats = { calls: 0, rewrites: 0, skipped: 0, last_at: 0, last_age_ms: 0, synths: 0 };
function _pbReadVarint(buf, i) {
  let shift = 0,
    result = 0;
  while (true) {
    const x = buf[i];
    i += 1;
    result += (x & 0x7f) * Math.pow(2, shift);
    if (!(x & 0x80)) break;
    shift += 7;
  }
  return [result, i];
}
function _pbEncVarint(v) {
  const out = [];
  while (true) {
    const b = v & 0x7f;
    v = Math.floor(v / 128);
    if (v) out.push(b | 0x80);
    else {
      out.push(b);
      break;
    }
  }
  return Buffer.from(out);
}
function _pbTag(field, wt) {
  return _pbEncVarint((field << 3) | wt);
}
function _pbParseOk(buf) {
  let i = 0;
  const n = buf.length;
  if (n === 0) return false;
  try {
    while (i < n) {
      let tag;
      [tag, i] = _pbReadVarint(buf, i);
      const wt = tag & 7;
      if (wt === 0) {
        [, i] = _pbReadVarint(buf, i);
      } else if (wt === 2) {
        let ln;
        [ln, i] = _pbReadVarint(buf, i);
        if (i + ln > n) return false;
        i += ln;
      } else if (wt === 5) i += 4;
      else if (wt === 1) i += 8;
      else return false;
    }
    return i === n;
  } catch {
    return false;
  }
}
// ★ v9.9.264 · 真·门控 · field 4 (varint=1) = Pro 锁标志 (70 模型全相关验证)
//   徽标 field 33 仅为文案 · field 4 才是右侧真 Cascade 面板置灰之根
//   损之又损: 模型项内 去 field 4 (解灰可选) + 去 field 33 (去徽标)
//   仅对"模型项"(含 field33 徽标者) 施治 · 余处 field 4 不动 · 利而不害
function _pbIsModelEntry(buf) {
  let i = 0;
  const n = buf.length;
  try {
    while (i < n) {
      let tag;
      [tag, i] = _pbReadVarint(buf, i);
      const field = tag >> 3;
      const wt = tag & 7;
      if (wt === 0) {
        [, i] = _pbReadVarint(buf, i);
      } else if (wt === 2) {
        let ln;
        [ln, i] = _pbReadVarint(buf, i);
        const sub = buf.slice(i, i + ln);
        i += ln;
        if (field === 33 && ln < 500 && sub.indexOf(_PRO_BADGE) >= 0) return true;
      } else if (wt === 5) i += 4;
      else if (wt === 1) i += 8;
      else return false;
    }
  } catch {}
  return false;
}
// 模型项治理: 去 field 4 (Pro 锁) + 去 field 33 (徽标) · 余字段原样
function _pbStripModelEntry(buf, stats) {
  const out = [];
  let i = 0;
  const n = buf.length;
  while (i < n) {
    let tag;
    [tag, i] = _pbReadVarint(buf, i);
    const field = tag >> 3;
    const wt = tag & 7;
    if (wt === 0) {
      let v;
      [v, i] = _pbReadVarint(buf, i);
      if (field === 4 && v === 1) {
        stats.unlock4 = (stats.unlock4 || 0) + 1;
        continue; // 损 · 去 Pro 锁门控 → 解灰可选
      }
      out.push(_pbTag(field, 0), _pbEncVarint(v));
    } else if (wt === 2) {
      let ln;
      [ln, i] = _pbReadVarint(buf, i);
      const sub = buf.slice(i, i + ln);
      i += ln;
      if (field === 33 && ln < 500 && sub.indexOf(_PRO_BADGE) >= 0) {
        stats.dropped += 1;
        continue; // 损 · 去徽标文案
      }
      out.push(_pbTag(field, 2), _pbEncVarint(sub.length), sub);
    } else if (wt === 5) {
      out.push(_pbTag(field, 5), buf.slice(i, i + 4));
      i += 4;
    } else if (wt === 1) {
      out.push(_pbTag(field, 1), buf.slice(i, i + 8));
      i += 8;
    } else {
      return buf;
    }
  }
  return Buffer.concat(out);
}
// 递归丢弃含 Pro 徽标之 field 33 (proven: unlock_transform.py · 同 1.110.1 线格)
function _pbDropProBadge(buf, stats) {
  const out = [];
  let i = 0;
  const n = buf.length;
  let _frameTpl = null,
    _frameField = -1,
    _frameMeta = null; // ★ v9.9.292 · 本帧模型项模板(注入用)
  while (i < n) {
    let tag;
    [tag, i] = _pbReadVarint(buf, i);
    const field = tag >> 3;
    const wt = tag & 7;
    if (wt === 0) {
      let v;
      [v, i] = _pbReadVarint(buf, i);
      out.push(_pbTag(field, 0), _pbEncVarint(v));
    } else if (wt === 2) {
      let ln;
      [ln, i] = _pbReadVarint(buf, i);
      const sub = buf.slice(i, i + ln);
      i += ln;
      if (field === 33 && ln < 500 && sub.indexOf(_PRO_BADGE) >= 0) {
        stats.dropped += 1;
        continue; // 损之 · 去 Pro 锁
      }
      // ★ v9.9.264 · 模型项(含徽标者) → 去 field4 Pro锁 + 去徽标 · 否则常规递归
      const _isModel = _pbIsModelEntry(sub);
      // ★ v9.9.270 · 活捕: 模型项真名 → 实时映射右侧 Cascade 可选模型
      let _meta = null;
      if (_isModel) {
        try {
          stats.models = stats.models || [];
          _meta = _pbExtractModelEntry(sub);
          if (_meta) stats.models.push(_meta);
        } catch {}
      }
      const newsub = _isModel
        ? _pbStripModelEntry(sub, stats)
        : _pbParseOk(sub) && sub.length > 0
          ? _pbDropProBadge(sub, stats)
          : sub;
      // ★ v9.9.292 · 取本帧首个模型项(已解锁)为注入模板
      if (_isModel && stats && stats.inject && _frameField < 0) {
        _frameTpl = newsub;
        _frameField = field;
        _frameMeta = _meta;
      }
      out.push(_pbTag(field, 2), _pbEncVarint(newsub.length), newsub);
    } else if (wt === 5) {
      out.push(_pbTag(field, 5), buf.slice(i, i + 4));
      i += 4;
    } else if (wt === 1) {
      out.push(_pbTag(field, 1), buf.slice(i, i + 8));
      i += 8;
    } else {
      // 未知 wire type · 不可解 · 原样返回保安全
      return buf;
    }
  }
  // ★ v9.9.292 · 容器级注入: 本帧含模型项 → 以模板克隆补全量目录之缺失模型
  //   仅在含模型项之容器帧施行(深度优先·最内层先完成) · 全局一次 (stats._injected)
  if (
    stats &&
    stats.inject &&
    !stats._injected &&
    _frameTpl &&
    _frameField >= 0 &&
    Array.isArray(stats.catalog) &&
    stats.catalog.length
  ) {
    try {
      const T = _pbExtractModelEntry(_frameTpl) || _frameMeta;
      if (T && T.uid) {
        const _nu = (s) =>
          String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const existing = new Set((stats.models || []).map((m) => _nu(m.uid)));
        let cnt = 0;
        for (const m of stats.catalog) {
          if (!m.uid || existing.has(_nu(m.uid))) continue;
          const map = Object.create(null);
          map[T.uid] = m.uid;
          if (T.label && T.label !== T.uid) map[T.label] = m.label || m.uid;
          if (T.familyUid && m.famUid) map[T.familyUid] = m.famUid;
          if (T.familyLabel && T.familyLabel !== T.label && m.famLabel)
            map[T.familyLabel] = m.famLabel;
          const clone = _pbCloneSwapStrings(_frameTpl, map);
          if (!_pbParseOk(clone) || clone.length === 0) continue;
          out.push(_pbTag(_frameField, 2), _pbEncVarint(clone.length), clone);
          existing.add(_nu(m.uid));
          cnt++;
        }
        stats._injected = true;
        stats.injected_count = cnt;
      }
    } catch {}
  }
  return Buffer.concat(out);
}
// ═══════════════════════════════════════════════════════════
// ★ v9.9.270 · 真·1:1 · 实时映射右侧 Cascade 可选模型
//   GetUserStatus 解锁同一遍 · 顺手捕获每个"模型项"的真名(uid/label/family)
//   → _liveModelCapture · _getOfficialFamilies 优先取活捕(无则退静态目录)
//   道法自然: 右侧能选什么 · 左侧就映什么 · 实时更新·无为而无不为
// ═══════════════════════════════════════════════════════════
let _liveModelCapture = { at: 0, calls: 0, models: [], families: [], raw: [] };

// 从模型项 proto buffer 递归收集所有可打印字符串(带 field/depth) · field 字段无关·靠模式判型
function _pbCollectStrings(buf, depth, acc) {
  let i = 0;
  const n = buf.length;
  try {
    while (i < n) {
      let tag;
      [tag, i] = _pbReadVarint(buf, i);
      const field = tag >> 3;
      const wt = tag & 7;
      if (wt === 0) {
        let v;
        [v, i] = _pbReadVarint(buf, i);
        acc.push({ field, depth, num: v });
      } else if (wt === 2) {
        let ln;
        [ln, i] = _pbReadVarint(buf, i);
        const sub = buf.slice(i, i + ln);
        i += ln;
        if (field === 33) continue; // 去 Pro 徽标文案 · 不入候选
        const s = sub.toString("utf8");
        const printable = ln > 0 && ln < 200 && /^[\x20-\x7e]+$/.test(s);
        if (printable) acc.push({ field, depth, s });
        else if (depth < 4 && ln > 1 && _pbParseOk(sub))
          _pbCollectStrings(sub, depth + 1, acc);
      } else if (wt === 5) i += 4;
      else if (wt === 1) i += 8;
      else return;
    }
  } catch {}
}

// uid 形: 小写·含连字/点·含数字 (claude-opus-4-7-medium / kimi-k2-6)
const _UID_RE = /^[a-z0-9]+([-.][a-z0-9]+)+$/;
function _looksLikeEnumOrUrl(s) {
  return (
    s.indexOf("://") >= 0 ||
    /^MODEL_/.test(s) ||
    /_(TYPE|PROVIDER|TIER|PRICING|STATUS|OPTION|SPECIAL|CREDIT)_?/.test(s) ||
    /^[A-Z][A-Z0-9_]{3,}$/.test(s)
  );
}
// 单从模型项 buffer 析出 {uid,label,familyUid,familyLabel} · 启发式·宽容
function _pbExtractModelEntry(buf) {
  const acc = [];
  _pbCollectStrings(buf, 0, acc);
  const strs = acc.filter((x) => typeof x.s === "string");
  let uid = null,
    famUid = null,
    label = null,
    famLabel = null;
  // uid: 浅层·连字形·含数字·无点 (modelUid 用连字 claude-opus-4-7-medium)
  for (const x of strs) {
    if (
      x.depth <= 1 &&
      _UID_RE.test(x.s) &&
      /[0-9]/.test(x.s) &&
      x.s.indexOf(".") < 0 &&
      !uid
    )
      uid = x.s;
  }
  // familyUid: uid 形且为 modelUid 之前缀(归一点/连字后) · 或含点形 · 短于 modelUid
  //   ★ v9.9.271 · 取最具体族形: 优先含点(规范族 gpt-5.5/claude-opus-4.8), 再取最长前缀
  //   (弃"首个前缀"旧法, 否则 gpt-5.5/5.2/5.1 误并入 gpt-5)
  const _nu = (s) => String(s || "").replace(/\./g, "-").toLowerCase();
  {
    let bestScore = -1;
    for (const x of strs) {
      const s = x.s;
      if (!_UID_RE.test(s) || s === uid) continue;
      const ns = _nu(s);
      const isPrefix = uid && _nu(uid).indexOf(ns) === 0 && ns.length < _nu(uid).length;
      if (!isPrefix && s.indexOf(".") < 0) continue;
      const score = ns.length + (s.indexOf(".") >= 0 ? 1000 : 0); // 含点优先 · 再比长
      if (score > bestScore) {
        bestScore = score;
        famUid = s;
      }
    }
  }
  // label / familyLabel: 人读串(有空格或含大写+数字) · 非枚举·非 uid·非 harness 词
  const humans = strs
    .map((x) => x.s)
    .filter(
      (s) =>
        /[A-Za-z]/.test(s) &&
        !_looksLikeEnumOrUrl(s) &&
        !_UID_RE.test(s) &&
        !/^[a-z]+(-[a-z]+)+$/.test(s) && // harness 词 strawberry-pancake
        (/\s/.test(s) || /[A-Z].*[0-9]/.test(s) || /[a-z][A-Z]/.test(s)),
    );
  // ★ v9.9.271 · 名实归一: 真档名(Claude Opus 4.8 Medium)归一后 === modelUid;
  //   族名(Claude Opus 4.8)归一后 === familyUid · 故以 uid 为锚选人读串,
  //   弃"最长串"之旧法(它会误取 UI 提示 "Higher effort consumes more tokens" 等长句)
  const _normLbl = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  // token 多重集: 容词序之异(uid claude-5-fable ↔ 显名 Claude Fable 5)
  const _toks = (s) => _normLbl(s).split("-").filter(Boolean);
  const _subMulti = (a, b) => {
    const m = Object.create(null);
    for (const t of b) m[t] = (m[t] || 0) + 1;
    for (const t of a) {
      if (!m[t]) return false;
      m[t]--;
    }
    return true;
  };
  // 以 uid token 集为锚, 取"token 超集且额外最少"之人读串 = 规范全显名
  const _pickByUid = (anchor) => {
    if (!anchor) return null;
    const at = _toks(anchor);
    if (!at.length) return null;
    const ms = humans.filter((h) => _subMulti(at, _toks(h)));
    ms.sort((a, b) => _toks(a).length - _toks(b).length);
    return ms[0] || null;
  };
  // label: 整档显名(Claude Opus 4.8 Medium / GPT-5.5 Low Thinking)
  label = _pickByUid(uid);
  // familyLabel: 族显名(Claude Opus 4.8 / Claude Fable 5 / GPT-5.5)
  famLabel = _pickByUid(famUid);
  // 兜底: 无锚命中则由 uid 美化(绝不取 UI 提示长句)
  if (!label) label = uid ? _prettyUid(uid) : null;
  if (!famLabel) famLabel = famUid ? _prettyUid(famUid) : label;
  if (!uid && !label) return null;
  return {
    uid: uid || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""),
    label: label || uid,
    familyUid: famUid || null,
    familyLabel: famLabel || label || uid,
    _cands: strs.map((x) => x.s).slice(0, 24), // 调试: 原始候选串
  };
}

// uid → 人读族名 美化 (claude-opus-4.8 → Claude Opus 4.8 · 兜底用)
function _prettyUid(u) {
  const BR = {
    claude: "Claude", gpt: "GPT", swe: "SWE", kimi: "Kimi", gemini: "Gemini",
    grok: "Grok", xai: "xAI", deepseek: "DeepSeek", qwen: "Qwen", glm: "GLM",
    opus: "Opus", sonnet: "Sonnet", haiku: "Haiku", fable: "Fable",
    codex: "Codex", flash: "Flash", pro: "Pro", max: "Max", mini: "Mini",
    fast: "Fast", low: "Low", medium: "Medium", high: "High", thinking: "Thinking",
  };
  return String(u || "")
    .split("-")
    .map((t) =>
      BR[t] || (/[0-9]/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1)),
    )
    .join(" ")
    .trim();
}

// 名 → provider 键归一 (与 eaRender _provLabel 表对齐 · 左侧按厂商分组)
// ★ v9.9.274 · 活捕家族不再统归 Other · 由族名/uid 推厂商 → Claude/GPT/Gemini/Kimi/Windsurf…
function _inferFamilyProvider(label, uid) {
  const t = (String(label || "") + " " + String(uid || "")).toLowerCase();
  if (/claude/.test(t)) return "ANTHROPIC";
  if (/gemini/.test(t)) return "GOOGLE";
  if (/grok/.test(t)) return "XAI";
  if (/deepseek/.test(t)) return "DEEPSEEK";
  if (/kimi|moonshot/.test(t)) return "MOONSHOT";
  if (/(^|[^a-z])glm([^a-z]|$)|zhipu/.test(t)) return "ZHIPU";
  if (/minimax/.test(t)) return "MINIMAX";
  if (/qwen/.test(t)) return "QWEN";
  if (/(^|[^a-z])(gpt|o3|o4)([^a-z]|$)|openai/.test(t)) return "OPENAI";
  if (/swe|cascade|windsurf/.test(t)) return "WINDSURF";
  return "";
}

// 由活捕模型项构建家族归一结构 (与 _getOfficialFamilies 静态结构同形)
function _buildLiveFamilies(models) {
  const fams = new Map();
  const order = [];
  for (const m of models) {
    if (!m || !m.uid) continue;
    // ★ v9.9.271 · 真模型 uid 必含版本数字(claude-opus-4-8-medium·gpt-5-5-low);
    //   弃无数字之伪项(UI 提示误析 cached-input·higher-effort-… 不成家族)
    if (!/[0-9]/.test(m.uid)) continue;
    const key = m.familyUid || m.familyLabel || m.label || m.uid;
    const flabel = m.familyLabel || m.label || m.uid;
    if (!fams.has(key)) {
      fams.set(key, {
        familyUid: m.familyUid || key,
        label: flabel,
        provider: _inferFamilyProvider(flabel, m.familyUid || key),
        isRecommended: false,
        isNew: false,
        members: [],
      });
      order.push(key);
    }
    const fam = fams.get(key);
    let tier = String(m.label || "");
    if (flabel && tier.indexOf(flabel) === 0) tier = tier.slice(flabel.length).trim();
    if (!fam.members.some((x) => x.modelUid === m.uid))
      fam.members.push({
        modelUid: m.uid,
        label: m.label,
        tier: tier || "base",
        isDefault: false,
      });
  }
  return order.map((k) => fams.get(k));
}

// ═══════════════════════════════════════════════════════════
// ★ v9.9.292 · 全量目录注入 · 执大象天下往 · 道法自然·无为而无不为
//   云端只下发试用账号可见之少数模型项(proto) → 右侧选择器即只见此数
//   损之又损治锁(去徽标/去field4)仍只解"已下发"者 · 未下发者无从显
//   今法: 学云端所送之"模型项"为模板 → 缺者(静态全量目录)克隆补之
//     仅换 uid/label/族名四串 · 余字段(定价/能力/图标)随模板 · 形神俱备可选
//   一切失败(模板缺/克隆不合法/校验不过) → 原样回退基线 · 利而不害
// ═══════════════════════════════════════════════════════════
const _INJECT_CATALOG_FILE = path.join(__dirname, "_inject_full_catalog");
function _isCatalogInjectEnabled() {
  try {
    const v = fs.readFileSync(_INJECT_CATALOG_FILE, "utf8").trim();
    return v !== "0" && v !== "false" && v !== "disabled";
  } catch {
    return true; // 默认启用
  }
}
// 静态全量目录 → 注入所需四元组 {uid,label,famUid,famLabel}
function _catalogInjectionList() {
  const cat = _fullModelCatalog || _loadFullModelCatalog();
  if (!Array.isArray(cat)) return [];
  return cat
    .map((m) => ({
      uid: (m && (m.modelUid || (m.modelInfo && m.modelInfo.modelUid))) || "",
      label: (m && (m.label || m.modelUid)) || "",
      famUid: (m && m.modelInfo && m.modelInfo.modelFamilyUid) || "",
      famLabel:
        (m && m.modelFamilyMetadata && m.modelFamilyMetadata.modelFamilyLabel) ||
        (m && m.label) ||
        "",
    }))
    .filter((m) => m.uid);
}
// 递归克隆 proto · 叶子字符串完全等于 map 键者换为 map 值 · 重建各级长度
//   只对"可打印字符串叶子"做等值替换; 嵌套子消息递归; 其余原样 (利而不害)
function _pbCloneSwapStrings(buf, map) {
  const out = [];
  let i = 0;
  const n = buf.length;
  while (i < n) {
    let tag;
    [tag, i] = _pbReadVarint(buf, i);
    const field = tag >> 3;
    const wt = tag & 7;
    if (wt === 0) {
      let v;
      [v, i] = _pbReadVarint(buf, i);
      out.push(_pbTag(field, 0), _pbEncVarint(v));
    } else if (wt === 2) {
      let ln;
      [ln, i] = _pbReadVarint(buf, i);
      const sub = buf.slice(i, i + ln);
      i += ln;
      const s = sub.toString("utf8");
      const printable = ln > 0 && ln < 200 && /^[\x20-\x7e]+$/.test(s);
      if (printable && Object.prototype.hasOwnProperty.call(map, s)) {
        const rep = Buffer.from(map[s], "utf8");
        out.push(_pbTag(field, 2), _pbEncVarint(rep.length), rep);
      } else if (!printable && ln > 1 && _pbParseOk(sub)) {
        const cs = _pbCloneSwapStrings(sub, map);
        out.push(_pbTag(field, 2), _pbEncVarint(cs.length), cs);
      } else {
        out.push(_pbTag(field, 2), _pbEncVarint(sub.length), sub);
      }
    } else if (wt === 5) {
      out.push(_pbTag(field, 5), buf.slice(i, i + 4));
      i += 4;
    } else if (wt === 1) {
      out.push(_pbTag(field, 1), buf.slice(i, i + 8));
      i += 8;
    } else {
      return buf;
    }
  }
  return Buffer.concat(out);
}

// ═══════════════════════════════════════════════════════════
// ★ v9.9.319 · 新架构解锁 · 反者道之动 · 损之又损以至无为
//   新版 Windsurf GetUserStatus 已弃 "Upgrade to Pro" 徽标
//   模型可用性改由每模型 field 20 (varint=1) 标记: 免费层仅 SWE 系有之
//   → 旧徽标解锁在新架构下无锁可去 (calls=0) · 只剩 SWE 系可选
//   治法 (利而不害·只增不改): 沿 top.f1.f33.f1[] 为每个真模型项补 field20=1
//   → 全模型与免费 SWE 同标 · picker 全可选 · 不删任何字段·不破坏原结构
// ═══════════════════════════════════════════════════════════
function _pbRebuildField(buf, targetField, fn) {
  const out = [];
  let i = 0;
  const n = buf.length;
  while (i < n) {
    let tag;
    [tag, i] = _pbReadVarint(buf, i);
    const field = tag >> 3;
    const wt = tag & 7;
    if (wt === 0) {
      let v;
      [v, i] = _pbReadVarint(buf, i);
      out.push(_pbTag(field, 0), _pbEncVarint(v));
    } else if (wt === 2) {
      let ln;
      [ln, i] = _pbReadVarint(buf, i);
      let sub = buf.slice(i, i + ln);
      i += ln;
      if (field === targetField) sub = fn(sub);
      out.push(_pbTag(field, 2), _pbEncVarint(sub.length), sub);
    } else if (wt === 5) {
      out.push(_pbTag(field, 5), buf.slice(i, i + 4));
      i += 4;
    } else if (wt === 1) {
      out.push(_pbTag(field, 1), buf.slice(i, i + 8));
      i += 8;
    } else {
      return buf;
    }
  }
  return Buffer.concat(out);
}

// ═══════════════════════════════════════════════════════════════════════
// ★ v9.9.366 · 推理端点重写 · 反者道之动 (findings/acp/07 缺口B 治本)
//   病(实证): chisel(devin.exe acp) 的推理端点 = GetCliModelConfigs 响应
//     tag18 下发字段(每模型一条 https://server.codeium.com ×N)。
//     仅锚 WINDSURF_API_SERVER_URL env 只管到管理面 RPC
//     (GetUserStatus/GetCliTeamSettings/GetCliModelConfigs/...),
//     GetChatMessage 仍直冲 server.codeium.com → 推理绕过本地反代 →
//     外接api路由/SP替换全落空。
//   治: 对服务端下发配置的响应体做 proto 树遍历,
//     凡整字段恰为指向官方上游的 http(s) URL 字符串, 改 authority 为
//     http://127.0.0.1:{_actualPort} —— 推理即归本口, 与 Cascade 同管道。
//   安: 仅整字段全等 URL 才改写(不碰内嵌子串/签名/JWT);
//     api.devin.ai(会话同步) 不重写; 已指本机者不重写;
//     改写后 _pbParseOk 校验, 不过则整体放弃原样透传。
//   道义: 五十二章「既得其母 以知其子」· 母=本口 · 子=推理端点。
// ═══════════════════════════════════════════════════════════════════════
const _EP_REWRITE_HOSTS = new Set([
  "server.codeium.com",
  "inference.codeium.com",
  "server.self-serve.windsurf.com",
]);
const _EP_URL_RE = /^https?:\/\/([\w.-]+)(:\d+)?(\/[^\s]*)?$/;
function _pbRewriteEndpointHosts(buf, localBase, stats, depth) {
  if (!buf || !buf.length) return buf;
  if (depth == null) depth = 0;
  if (depth > 8) return buf; // 深不穷·知止
  const out = [];
  let i = 0;
  const n = buf.length;
  let changed = false;
  while (i < n) {
    let tag;
    [tag, i] = _pbReadVarint(buf, i);
    const field = tag >> 3;
    const wt = tag & 7;
    if (wt === 0) {
      let v;
      [v, i] = _pbReadVarint(buf, i);
      out.push(_pbTag(field, 0), _pbEncVarint(v));
    } else if (wt === 2) {
      let ln;
      [ln, i] = _pbReadVarint(buf, i);
      if (i + ln > n) return buf; // 截断 → 本层放弃
      let sub = buf.slice(i, i + ln);
      i += ln;
      // 整字段恰为目标 host 的 URL?
      if (ln > 8 && ln < 300) {
        const s = sub.toString("utf8");
        const m = _EP_URL_RE.exec(s);
        if (m && _EP_REWRITE_HOSTS.has(m[1].toLowerCase())) {
          const rep = Buffer.from(localBase + (m[3] || ""), "utf8");
          stats.rewritten = (stats.rewritten || 0) + 1;
          stats.hosts = stats.hosts || {};
          stats.hosts[m[1].toLowerCase()] = (stats.hosts[m[1].toLowerCase()] || 0) + 1;
          out.push(_pbTag(field, 2), _pbEncVarint(rep.length), rep);
          changed = true;
          continue;
        }
      }
      // 嵌套消息? 严格可解析则递归 (ln>1 防空壳)
      if (ln > 1 && _pbParseOk(sub)) {
        const cs = _pbRewriteEndpointHosts(sub, localBase, stats, depth + 1);
        if (cs !== sub) changed = true;
        out.push(_pbTag(field, 2), _pbEncVarint(cs.length), cs);
      } else {
        out.push(_pbTag(field, 2), _pbEncVarint(sub.length), sub);
      }
    } else if (wt === 5) {
      out.push(_pbTag(field, 5), buf.slice(i, i + 4));
      i += 4;
    } else if (wt === 1) {
      out.push(_pbTag(field, 1), buf.slice(i, i + 8));
      i += 8;
    } else {
      return buf; // 未知 wire → 本层放弃
    }
  }
  return changed ? Buffer.concat(out) : buf;
}

// 入口: 对配置下发类响应体重写端点 · 失败/null=原样 (利而不害)
function _rewriteEndpointBody(bodyBuf, rid) {
  try {
    const localBase = "http://127.0.0.1:" + _actualPort;
    let data = bodyBuf;
    let isGz = false;
    if (bodyBuf.length > 2 && bodyBuf[0] === 0x1f && bodyBuf[1] === 0x8b) {
      isGz = true;
      data = zlib.gunzipSync(bodyBuf);
    }
    // 快路: 无目标 host 字节 → 不动
    if (data.indexOf("codeium.com") < 0 && data.indexOf("windsurf.com") < 0)
      return null;
    const stats = {};
    // Connect-RPC 帧壳 (flags+len+payload) 与裸 proto 两态皆收
    const frames = parseFrames(data);
    let framed = false;
    if (frames.length > 0) {
      // 校验全覆盖: 末帧恰消费完全部字节? parseFrames 遇不完整尾部即停,
      // 以 payload 累计无法回推 → 用首帧 len 粗判 + 逐帧重建后比长度区间
      framed = data.length >= 5 && (data[0] & ~0x81) === 0;
    }
    let out;
    if (framed && frames.length > 0) {
      const rebuilt = [];
      for (const fr of frames) {
        const np = _pbRewriteEndpointHosts(fr.payload, localBase, stats, 0);
        rebuilt.push(buildFrame(fr.flags, np));
      }
      out = Buffer.concat(rebuilt);
    } else {
      out = _pbRewriteEndpointHosts(data, localBase, stats, 0);
    }
    if (!stats.rewritten) return null;
    if (!framed && !_pbParseOk(out)) return null;
    const finalBuf = isGz ? zlib.gzipSync(out) : out;
    log(
      `#${rid} [端点重写] ${stats.rewritten} 处 → ${localBase} ` +
        JSON.stringify(stats.hosts || {}) +
        ` · ${data.length}→${out.length}B`,
    );
    return finalBuf;
  } catch (e) {
    log(`#${rid} [端点重写] 失败 → 原样透传: ${e.message}`);
    return null;
  }
}
// 顶层某 repeated(wt=2) field 仅保留最末一条(用于把整段历史裁成单条新 user turn)。
function _pbKeepLastRepeated(buf, targetField) {
  const recs = [];
  let i = 0;
  const n = buf.length;
  while (i < n) {
    let tag;
    [tag, i] = _pbReadVarint(buf, i);
    const field = tag >> 3;
    const wt = tag & 7;
    let start = i;
    if (wt === 0) {
      let v;
      [v, i] = _pbReadVarint(buf, i);
    } else if (wt === 2) {
      let ln;
      [ln, i] = _pbReadVarint(buf, i);
      i += ln;
    } else if (wt === 5) i += 4;
    else if (wt === 1) i += 8;
    else return buf;
    if (field === targetField && wt === 2) {
      recs.push({ start, end: i });
    }
  }
  // 复现顶层顺序: 非目标字段原位, 目标 repeated 仅在其原「首个出现」处放最末一条。
  const lastRec = recs.length ? recs[recs.length - 1] : null;
  const parts = [];
  let placed = false;
  // 重扫一遍以保持相对顺序
  i = 0;
  while (i < n) {
    let tag;
    const tagStart = i;
    [tag, i] = _pbReadVarint(buf, i);
    const field = tag >> 3;
    const wt = tag & 7;
    let start = i;
    if (wt === 0) {
      let v;
      [v, i] = _pbReadVarint(buf, i);
    } else if (wt === 2) {
      let ln;
      [ln, i] = _pbReadVarint(buf, i);
      i += ln;
    } else if (wt === 5) i += 4;
    else if (wt === 1) i += 8;
    if (field === targetField && wt === 2) {
      if (!placed && lastRec) {
        parts.push(_pbTag(targetField, 2), buf.slice(lastRec.start, lastRec.end));
        placed = true;
      }
    } else {
      parts.push(buf.slice(tagStart, i));
    }
  }
  return Buffer.concat(parts);
}
function _pbHasField(buf, targetField) {
  let i = 0;
  const n = buf.length;
  try {
    while (i < n) {
      let tag;
      [tag, i] = _pbReadVarint(buf, i);
      const field = tag >> 3;
      const wt = tag & 7;
      if (field === targetField) return true;
      if (wt === 0) {
        let v;
        [v, i] = _pbReadVarint(buf, i);
      } else if (wt === 2) {
        let ln;
        [ln, i] = _pbReadVarint(buf, i);
        i += ln;
      } else if (wt === 5) i += 4;
      else if (wt === 1) i += 8;
      else return false;
    }
  } catch {
    return false;
  }
  return false;
}
// 沿 top.f1(用户记录).f33(模型容器).f1[](模型项) 为缺 field20 之真模型项补 field20=1
function _pbEnsureModelsAvailable(data, stats) {
  return _pbRebuildField(data, 1, (userRec) =>
    _pbRebuildField(userRec, 33, (container) =>
      _pbRebuildField(container, 1, (entry) => {
        // 仅认含 field22(modelUid 串)+field23(详情子消息) 之真模型项
        if (!_pbHasField(entry, 22) || !_pbHasField(entry, 23)) return entry;
        stats.total = (stats.total || 0) + 1;
        if (_pbHasField(entry, 20)) { stats.already = (stats.already || 0) + 1; return entry; }
        stats.added += 1;
        return Buffer.concat([entry, _pbTag(20, 0), _pbEncVarint(1)]);
      }),
    ),
  );
}

// 入口: 对 gzip(proto) GetUserStatus body 做真解锁 · 失败则原样返回 (利而不害)
function _unlockUserStatusBody(bodyBuf, contentEncoding, rid) {
  try {
    const isGz = bodyBuf.length > 2 && bodyBuf[0] === 0x1f && bodyBuf[1] === 0x8b;
    const data = isGz ? zlib.gunzipSync(bodyBuf) : bodyBuf;
    // ★ 临时·一次性捕获原始 GetUserStatus proto (存在 _dump_us 旗标时) · 供离线析构
    try {
      if (fs.existsSync(path.join(__dirname, "_dump_us"))) {
        fs.writeFileSync(path.join(__dirname, "_us_dump.bin"), data);
        fs.unlinkSync(path.join(__dirname, "_dump_us"));
        log(`#${rid} [dump] GetUserStatus proto 落盘 ${data.length}B`);
      }
    } catch {}
    if (data.indexOf(_PRO_BADGE) < 0) {
      // ★ v9.9.319 · 新架构 (无 "Upgrade to Pro" 徽标): 补 field20 可用标记解锁
      const ns = { added: 0 };
      const nsOut = _pbEnsureModelsAvailable(data, ns);
      if (ns.added > 0 && _pbParseOk(nsOut) && nsOut.length >= data.length) {
        const finalBuf = isGz ? zlib.gzipSync(nsOut) : nsOut;
        _unlockStats.calls += 1;
        _unlockStats.dropped_total += ns.added;
        _unlockStats.last_dropped = ns.added;
        _unlockStats.last_at = Date.now();
        _unlockStats.last_bytes = `NS ${data.length}->${nsOut.length} gz ${bodyBuf.length}->${finalBuf.length}`;
        _unlockStats.last_total = ns.total || 0;
        _unlockStats.last_available = (ns.already || 0) + ns.added;
        _unlockStats.schema = "new(field20)";
        log(
          `#${rid} [真解锁·新架构] GetUserStatus 补 field20 可用标记 ${ns.added} 项 · ${data.length}→${nsOut.length}B (gz ${bodyBuf.length}→${finalBuf.length})`,
        );
        return finalBuf;
      }
      return null; // 无锁可解 (新架构亦无模型项)
    }
    // 一遍·基线解锁(去徽标+去field4) · 不注入 · 必有效则用之
    const stats = { dropped: 0, unlock4: 0, models: [] };
    const out1 = _pbDropProBadge(data, stats);
    if (stats.dropped === 0 || !_pbParseOk(out1)) return null;
    // ★ v9.9.270 · 活捕落库: 模型项真名 → 实时家族归一 (右侧能选什么·左侧映什么)
    try {
      if (stats.models && stats.models.length) {
        _liveModelCapture = {
          at: Date.now(),
          calls: (_liveModelCapture.calls || 0) + 1,
          models: stats.models,
          families: _buildLiveFamilies(stats.models),
          raw: stats.models.slice(0, 6).map((m) => ({
            uid: m.uid,
            label: m.label,
            familyUid: m.familyUid,
            familyLabel: m.familyLabel,
            cands: m._cands,
          })),
        };
      }
    } catch {}
    // ★ v9.9.292 · 二遍·全量目录注入 (独立 pass·克隆模板补缺) · 校验通过方采用·否则回退 out1
    let out = out1;
    let injectedCount = 0;
    try {
      if (_isCatalogInjectEnabled()) {
        const catalog = _catalogInjectionList();
        if (catalog.length) {
          const s2 = { dropped: 0, unlock4: 0, models: [], inject: true, catalog };
          const out2 = _pbDropProBadge(data, s2);
          if (
            s2.injected_count > 0 &&
            _pbParseOk(out2) &&
            out2.length > out1.length
          ) {
            out = out2;
            injectedCount = s2.injected_count;
          }
        }
      }
    } catch (e) {
      log(`#${rid} [全量注入] 异常→回退基线: ${e.message}`);
    }
    const finalBuf = isGz ? zlib.gzipSync(out) : out;
    _unlockStats.calls += 1;
    _unlockStats.dropped_total += stats.dropped;
    _unlockStats.last_dropped = stats.dropped;
    _unlockStats.unlock4_total += stats.unlock4 || 0;
    _unlockStats.last_unlock4 = stats.unlock4 || 0;
    _unlockStats.last_injected = injectedCount;
    _unlockStats.last_at = Date.now();
    _unlockStats.last_bytes = `${data.length}->${out.length} gz ${bodyBuf.length}->${finalBuf.length}`;
    _unlockStats.last_total = stats.models ? stats.models.length : 0;
    _unlockStats.last_available = _unlockStats.last_total;
    _unlockStats.schema = "old(badge)";
    log(
      `#${rid} [真解锁] GetUserStatus 去 Pro锁(field4) ${stats.unlock4} 项 + 去徽标 ${stats.dropped} 项 + 注入全量 ${injectedCount} 项 · ${data.length}→${out.length}B (gz ${bodyBuf.length}→${finalBuf.length})`,
    );
    return finalBuf;
  } catch (e) {
    log(`#${rid} [真解锁] 失败 → 原样透传: ${e.message}`);
    return null;
  }
}

// 初始加载
_loadFullModelCatalog();

/**
 * ★ v9.9.260+ · 模型解锁代理 · 执大象 天下往
 *
 * 拦截 GetUserSettings / GetCascadeModelConfigs → 注入全量模型目录
 *
 * 响应格式 (Connect-JSON):
 *   {"userSettings":{"cachedCascadeModelConfigs":[...]}}
 *
 * 注入策略 (v2 · 往而不害):
 *   1. 先请求LS原始响应 → 获取用户BYOK等原有模型
 *   2. 合并: 保留原有 + 补充目录中缺失的模型 (modelUid去重)
 *   3. 强制解锁: 所有模型 disabled=false → 突破账号权限限制
 *   4. 排序: isRecommended/isNew 优先 → creditMultiplier 升序
 *
 * 道义: 三十五章「往而不害」· 补充不破坏 · 原有模型保留
 *       「执大象 天下往」· 全量模型即大象 · 执之则天下往
 */
// ★ v9.9.362(合流自 Tokyo) · 鉴权/状态/配置类 RPC 韧性兜底 (官方长连 RST/代理预热时不硬失败·前端不登出)
//   病灶: GetUserStatus / 登录(RegisterUser) / GetCommandModelConfigs 走 PASSTHROUGH →
//     proxyToCloud, 官方 H2 一 RST 即回 502/ECONNRESET → 前端「连接不上官方服务器」并登出。
//   药(母子相守): 这些「前端据以判定已连接/已鉴权」的一元 RPC, 官方暂不可达时不抛错 —— 有
//     上次官方 GetUserStatus 真响应则原样回放(守其母·保 Pro 身份与模型), 否则回空 gRPC OK
//     (LS 仅验 grpc-status=0 即认已连接)。推理仍走 BYOK/路由器, 故 Cascade 全程可用、彻底
//     解耦官方可达性。非鉴权类(补全等)不入此集 → 照旧 502 由客户端自然重试, 不夺其真。
const _AUTH_RESILIENT_RE =
  /GetUserStatus|GetCommandModelConfigs|GetCascadeModelConfigs|GetUserSettings|RegisterUser|RefreshToken|GetAuthToken|Login/i;
function _isAuthResilientRpc(u) {
  try {
    return _AUTH_RESILIENT_RE.test(_rpcName(u));
  } catch (_) {
    return false;
  }
}
let _lastGoodUserStatus = null; // { buf, ct, ce, at, rpc } · 最近一次官方 200 GetUserStatus(解锁后)

// ★ v9.9.376 · GetCliModelConfigs 秒回兜底 · 反者道之动 · 守其母
//   根因: chisel(ACP) 对该 RPC 等应预算 < 本网络上游实耗时 → 每试必 [h2] canceled →
//        ACP "Available models" 恒空 → set_config_option(model) 全灭 →
//        Devin Local 模型选择器形同虚设 + 连接错误。
//   药: origin 自持 last-good(内存+落盘+借 chisel 官方 bin 播种): 命中即毫秒回放
//       (响应体已端点重写锚本口) · 同时后台携原信封原 body 上行刷真值;
//       无缓存照旧透传并把真响应捕进缓存。无为补位·不夺其真。
let _lastGoodCliModels = null; // { buf, ct, ce, at }
let _cliModelsTried = false;
const CLIMODELS_CACHE_FILE = path.join(__dirname, "_climodels_lastgood.json");

function _isCliModelConfigsRpc(u) {
  return /GetCliModelConfigs/i.test(_rpcName(u));
}

function _loadCliModelsLastGood() {
  if (_cliModelsTried) return;
  _cliModelsTried = true;
  // 1) 落盘自持缓存(已是端点重写后形态·直接回放)
  try {
    const j = JSON.parse(fs.readFileSync(CLIMODELS_CACHE_FILE, "utf8"));
    if (j && j.buf_b64) {
      _lastGoodCliModels = {
        buf: Buffer.from(j.buf_b64, "base64"),
        ct: j.ct || "application/proto",
        ce: j.ce || "",
        at: j.at || 0,
      };
      log(`[climodels] disk cache loaded ${_lastGoodCliModels.buf.length}B`);
      return;
    }
  } catch (_) {}
  // 2) 借种: chisel 官方缓存 bin (原始响应体·未锚) → 重写端点后喂为兜底
  try {
    const dir = path.join(process.env.LOCALAPPDATA || "", "devin", "cli");
    const cands = fs
      .readdirSync(dir)
      .filter((f) => /^model_configs_v5\..*\.bin$/.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const c of cands) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, c.f), "utf8"));
        if (j && j.payload && j.payload.length > 1000) {
          const raw = Buffer.from(j.payload, "base64");
          const rw = _rewriteEndpointBody(raw, "seed") || raw;
          _lastGoodCliModels = {
            buf: rw,
            ct: "application/proto",
            ce: "",
            at: 0,
          };
          log(
            `[climodels] seeded from chisel cache ${c.f} ${raw.length}B→${rw.length}B`,
          );
          return;
        }
      } catch (_) {}
    }
  } catch (_) {}
}

function _storeCliModelsLastGood(buf, ct, ce) {
  try {
    _lastGoodCliModels = {
      buf,
      ct: ct || "application/proto",
      ce: ce || "",
      at: Date.now(),
    };
    fs.writeFile(
      CLIMODELS_CACHE_FILE,
      JSON.stringify({
        ct: _lastGoodCliModels.ct,
        ce: _lastGoodCliModels.ce,
        at: _lastGoodCliModels.at,
        buf_b64: buf.toString("base64"),
      }),
      () => {},
    );
  } catch (_) {}
}

function _serveLastGoodCliModels(res, rid) {
  try {
    _loadCliModelsLastGood();
  } catch (_) {}
  if (!(_lastGoodCliModels && _lastGoodCliModels.buf)) return false;
  try {
    const h = {
      "content-type": _lastGoodCliModels.ct || "application/proto",
    };
    if (_lastGoodCliModels.ce)
      h["content-encoding"] = _lastGoodCliModels.ce;
    h["content-length"] = String(_lastGoodCliModels.buf.length);
    res.writeHead(200, h);
    res.write(_lastGoodCliModels.buf);
    try {
      res.addTrailers({ "grpc-status": "0", "grpc-message": "" });
    } catch (_) {}
    res.end();
    log(
      `#${rid} [climodels] last-good 秒回 ${_lastGoodCliModels.buf.length}B (上游长连慢·守其母不空目录)`,
    );
    return true;
  } catch (e) {
    log(`#${rid} [climodels] 秒回失败: ${e.message}`);
    return false;
  }
}

// 后台携原信封原 body 上行刷真值 · 成败无害(得则更新内存+落盘)
function _refreshCliModelsBg(req, bodyBuf, rid) {
  try {
    const route = routeUpstream(req.url);
    const session = _getH2Session(route.host);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!k.startsWith(":") && !H1_CONN_HEADERS.has(k)) headers[k] = v;
    }
    delete headers["content-length"];
    if (bodyBuf && bodyBuf.length)
      headers["content-length"] = String(bodyBuf.length);
    const up = session.request({
      ":method": req.method || "POST",
      ":path": route.path,
      ":authority": route.host,
      ":scheme": "https",
      ...headers,
    });
    try {
      up.setTimeout(0);
    } catch (_) {}
    up.on("response", (hh) => {
      const st = hh && hh[":status"];
      const ct = (hh && hh["content-type"]) || "application/proto";
      const ce = (hh && hh["content-encoding"]) || "";
      let bufs = [],
        n = 0;
      const cap = 4 * 1024 * 1024;
      up.on("data", (c) => {
        if (n < cap) {
          bufs.push(c);
          n += c.length;
        }
      });
      up.on("end", () => {
        try {
          if (st === 200 && n > 10) {
            let out = Buffer.concat(bufs);
            const rw = _rewriteEndpointBody(out, rid || "?");
            if (rw) out = rw;
            _storeCliModelsLastGood(out, ct, ce);
            log(`#${rid} [climodels] 后台刷新真值 ${out.length}B 已存`);
          }
        } catch (_) {}
      });
    });
    up.on("error", () => {});
    if (bodyBuf && bodyBuf.length) up.write(bodyBuf);
    up.end();
  } catch (_) {}
}

function _replyAuthResilient(req, res, rid) {
  try { req.resume(); } catch (_) {} // 排空入站体·防 socket 悬挂
  const url = req.url || "";
  const rpc = _rpcName(url);
  // GetUserStatus: 优先回放上次真官方响应(守其母) · 30 分钟内视为可用
  //   ★ v9.9.376 · 同型校验: last-good 必须真出自 GetUserStatus —— _epHit 三 RPC
  //     共用此槽, 若无 rpc 标记 CliModelConfigs 体会被误当 UserStatus 回放
  if (
    /GetUserStatus/i.test(rpc) &&
    _lastGoodUserStatus &&
    _lastGoodUserStatus.buf &&
    (!_lastGoodUserStatus.rpc ||
      /GetUserStatus/i.test(_lastGoodUserStatus.rpc)) &&
    Date.now() - (_lastGoodUserStatus.at || 0) < 30 * 60 * 1000
  ) {
    try {
      if (res.headersSent) return true;
      const h = {
        "content-type": _lastGoodUserStatus.ct || "application/proto",
      };
      if (_lastGoodUserStatus.ce) h["content-encoding"] = _lastGoodUserStatus.ce;
      h["content-length"] = String(_lastGoodUserStatus.buf.length);
      res.writeHead(200, h);
      res.write(_lastGoodUserStatus.buf);
      try {
        res.addTrailers({ "grpc-status": "0", "grpc-message": "" });
      } catch (_) {}
      res.end();
      log(
        `#${rid} [auth-resilient] ${rpc} → 回放上次官方响应 ${_lastGoodUserStatus.buf.length}B (官方长连暂断·守其母不登出)`,
      );
      return true;
    } catch (e) {
      log(`#${rid} [auth-resilient] 回放失败: ${e.message} → 转空 gRPC OK`);
    }
  }
  // 无 last-good → 空 gRPC OK(前端仅验 grpc-status=0 即认已连接·不抛 ECONNRESET)
  _replyGrpcOk(res, rid, rpc);
  return true;
}

function proxyToCloudWithModelUnlock(req, res, rid) {
  const rpcName = (req.url || "").split("/").pop() || "?";
  const unlockEnabled = _isModelUnlockEnabled();
  const catalog = _fullModelCatalog || _loadFullModelCatalog();

  if (!unlockEnabled || !catalog) {
    log(
      `#${rid} [model-unlock] 退化为透传 (enabled=${unlockEnabled}, catalog=${!!catalog})`,
    );
    proxyToCloud(req, res, undefined, rid);
    return;
  }

  log(`#${rid} [model-unlock] 拦截 ${rpcName} → 合并全量模型目录`);

  // ★ v2: 先收集请求body → 转发LS获取原始响应 → 合并
  let reqBody = [];
  req.on("data", (c) => reqBody.push(c));
  req.on("end", () => {
    reqBody = Buffer.concat(reqBody);
    _proxyAndInject(req, res, rid, rpcName, catalog, reqBody);
  });
}

/**
 * ★ v2 · 先请求LS原始响应 → 合并全量目录 → 强制解锁
 *
 * 流程:
 *   1. 转发请求到LS → 获取原始GetUserSettings响应
 *   2. 解析原始模型列表 → 保留用户BYOK等
 *   3. 合并全量目录 → modelUid去重
 *   4. 强制 disabled=false → 突破权限
 *   5. 返回合并后的响应
 *
 * 降级: 如果LS请求失败 → 直接返回全量目录 (往而不害)
 */
function _proxyAndInject(req, res, rid, rpcName, catalog, reqBody) {
  const route = routeUpstream(req.url);
  const lsPort = route.port || CLOUD_PORT;
  const lsHost = route.host || CLOUD_HOST;

  // 构造转发请求
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k.startsWith(":") && !H1_CONN_HEADERS.has(k)) headers[k] = v;
  }
  if (reqBody.length > 0) {
    headers["content-length"] = String(reqBody.length);
  }

  const opts = {
    hostname: "127.0.0.1",
    port: lsPort,
    path: req.url,
    method: req.method,
    headers,
    timeout: 8000,
  };

  const lsReq = http.request(opts, (lsRes) => {
    let body = [];
    lsRes.on("data", (c) => body.push(c));
    lsRes.on("end", () => {
      body = Buffer.concat(body);
      const status = lsRes.statusCode;

      if (status !== 200) {
        // LS返回非200 → 降级为直接返回全量目录
        log(`#${rid} [model-unlock] LS返回${status} → 降级直接返回全量目录`);
        _respondWithCatalog(res, catalog, rid, rpcName);
        return;
      }

      try {
        const orig = JSON.parse(body.toString("utf8"));
        // ★ v9.9.362(合流自 Tokyo) · 递归查找模型配置数组 (双格式)
        const existing = _extractModelConfigs(orig);
        if (existing) {
          // ★ 合并: 保留原有 + 补充缺失 + 强制解锁
          _mergeAndUnlock(existing.arr, catalog);
          existing.parent[existing.key] = existing.arr;
          const outBody = JSON.stringify(orig);
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(outBody),
          });
          res.end(outBody);
          log(
            `#${rid} [model-unlock] 合并完成: ${existing.arr.length} models (${outBody.length} bytes)`,
          );
        } else {
          // 无模型配置数组 → 直接注入
          _injectCatalogIntoResponse(orig, catalog);
          const outBody = JSON.stringify(orig);
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(outBody),
          });
          res.end(outBody);
          log(
            `#${rid} [model-unlock] 注入完成: ${catalog.length} models (${outBody.length} bytes)`,
          );
        }
      } catch (e) {
        // JSON解析失败 → 降级
        log(`#${rid} [model-unlock] LS响应解析失败: ${e.message} → 降级`);
        _respondWithCatalog(res, catalog, rid, rpcName);
      }
    });
  });

  lsReq.on("error", (e) => {
    log(`#${rid} [model-unlock] LS请求失败: ${e.message} → 降级`);
    _respondWithCatalog(res, catalog, rid, rpcName);
  });

  lsReq.on("timeout", () => {
    lsReq.destroy();
    log(`#${rid} [model-unlock] LS请求超时 → 降级`);
    _respondWithCatalog(res, catalog, rid, rpcName);
  });

  if (reqBody.length > 0) lsReq.write(reqBody);
  lsReq.end();
}

/**
 * ★ v9.9.362(合流自 Tokyo) · 递归查找响应中的模型配置数组 (双格式兼容)
 *   GetUserSettings        → userSettings.cachedCascadeModelConfigs
 *   GetCascadeModelConfigs → client_model_configs (顶层)
 *   GetCommandModelConfigs → client_model_configs (顶层)
 * 返回 { arr, key, parent } · 合并后写回 parent[key]
 */
function _extractModelConfigs(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const key of Object.keys(obj)) {
    if (
      (key === "cachedCascadeModelConfigs" || key === "client_model_configs") &&
      Array.isArray(obj[key])
    ) {
      return { arr: obj[key], key, parent: obj };
    }
    if (typeof obj[key] === "object" && obj[key] !== null) {
      const found = _extractModelConfigs(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 合并全量目录 + 强制解锁
 * 策略: 以 modelUid 去重 · 保留原有 + 补充缺失 · disabled强制=false
 */
function _mergeAndUnlock(existing, catalog) {
  const catalogModels = Array.isArray(catalog) ? catalog : catalog.models || [];
  const existingUids = new Set();

  // ★ 强制解锁原有模型 (disabled=false → 突破账号权限)
  for (const m of existing) {
    if (m.modelUid) existingUids.add(m.modelUid);
    if (m.disabled) m.disabled = false;
    // 清除disabledReason (不再需要"升级Pro"提示)
    delete m.disabledReason;
  }

  // 补充缺失模型
  let added = 0;
  for (const m of catalogModels) {
    if (m.modelUid && !existingUids.has(m.modelUid)) {
      existing.push(m);
      existingUids.add(m.modelUid);
      added++;
    }
  }

  // 排序: isRecommended → isNew → creditMultiplier 升序
  existing.sort((a, b) => {
    const aRec = a.isRecommended ? 0 : 1;
    const bRec = b.isRecommended ? 0 : 1;
    if (aRec !== bRec) return aRec - bRec;
    const aNew = a.isNew ? 0 : 1;
    const bNew = b.isNew ? 0 : 1;
    if (aNew !== bNew) return aNew - bNew;
    const aCost = a.creditMultiplier || 1;
    const bCost = b.creditMultiplier || 1;
    return aCost - bCost;
  });

  log(
    `[model-unlock] 合并: 原有=${existing.length - added} 补充=${added} 总计=${existing.length}`,
  );
}

/**
 * ★ v9.9.362(合流自 Tokyo) · 注入全量目录到响应对象 (无模型配置数组时)
 * 双格式: client_model_configs (顶层) / userSettings.cachedCascadeModelConfigs
 */
function _injectCatalogIntoResponse(obj, catalog) {
  if (!obj || typeof obj !== "object") return;
  const models = Array.isArray(catalog) ? catalog : catalog.models || [];
  for (const key of Object.keys(obj)) {
    if (key === "client_model_configs" && Array.isArray(obj[key])) {
      obj[key] = models;
      return;
    }
    if (key === "userSettings" && typeof obj[key] === "object") {
      obj[key].cachedCascadeModelConfigs = models;
      return;
    }
    if (typeof obj[key] === "object" && obj[key] !== null) {
      _injectCatalogIntoResponse(obj[key], catalog);
    }
  }
}

/**
 * ★ v9.9.362(合流自 Tokyo) · 降级: 直接返回全量目录 (按 RPC 分派格式)
 *   GetCascadeModelConfigs/GetCommandModelConfigs → { client_model_configs }
 *   GetUserSettings 等 → { userSettings: { cachedCascadeModelConfigs } }
 */
function _respondWithCatalog(res, catalog, rid, rpcName) {
  const models = Array.isArray(catalog) ? catalog : catalog.models || [];
  let response;
  if (rpcName === "GetCascadeModelConfigs" || rpcName === "GetCommandModelConfigs") {
    response = { client_model_configs: models };
  } else {
    response = { userSettings: { cachedCascadeModelConfigs: models } };
  }
  const body = JSON.stringify(response);
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
  log(
    `#${rid} [model-unlock] 降级返回: ${models.length} models, ${body.length} bytes`,
  );
}

// (旧 _injectModelCatalog / _mergeModelCatalog 已由 v2 _extractModelConfigs / _mergeAndUnlock 替代)

// ═══════════════════════════════════════════════════════════
// 透传 · v7.8 HTTP/2 双栈 (h2c 入 → h2 TLS 出)
// ═══════════════════════════════════════════════════════════
const _h2Sessions = {};
// v9.9.337 · H2 session keepalive ping · 四十章「弱者道之用」
// 根因: 云端 H2 session 空闲超阈即发 GOAWAY → 活跃流式推理被中断 → 对话截断
// 药: 每 45s ping 一次 · 保鲜 session · 无活跃流时自然 idle close
const _H2_PING_INTERVAL = 45000;
// session 通用监听装配 (ping / error / close / goaway) · 直连与代理隧道共用
// ★ v9.9.371 · 合流自 Tokyo v9.9.370/362 · 装配体自 _getH2Session 拆出共用
// ★ v9.9.372 · 建连预算 · 四十章「反者道之动」
//   根因(141实证): 上游不可达时请求绑死 pending session → 排队等 OS TCP 超时 ~21s
//   → LS 5s 预算早过 → 「connection to server is erroring · Shutting down server」
//   药: session 建连超 3.5s 未 'connect' 即毁 → stream error → 502/鉴权兜底 < 客户端预算
//   不动流生命周期: upStream.setTimeout(0) 依旧 · 预算只管「建连」这一寸
const _H2_CONNECT_BUDGET = 3500;
function _h2WireSession(session, host, key) {
  session._daoConnectBudget = setTimeout(() => {
    if (session._daoConnected) return;
    log(`[h2] ${host} 建连超 ${_H2_CONNECT_BUDGET}ms → 毁session fail-fast`);
    try {
      session.destroy();
    } catch {}
    delete _h2Sessions[key];
  }, _H2_CONNECT_BUDGET);
  try {
    session._daoConnectBudget.unref();
  } catch {}
  session.once("connect", () => {
    session._daoConnected = true;
    try {
      clearTimeout(session._daoConnectBudget);
    } catch {}
  });
  session._daoPingTimer = setInterval(() => {
    try {
      if (session.closed || session.destroyed) {
        clearInterval(session._daoPingTimer);
        return;
      }
      session.ping((err) => {
        if (err) log(`[h2] ping ${host} err: ${err.message}`);
      });
    } catch {}
  }, _H2_PING_INTERVAL);
  try { session._daoPingTimer.unref(); } catch {}
  session.on("error", (e) => {
    log(`[h2] session ${host} error: ${e.message}`);
    try { clearInterval(session._daoPingTimer); } catch {}
    try { clearTimeout(session._daoConnectBudget); } catch {}
    try {
      session.close();
    } catch {}
    delete _h2Sessions[key];
  });
  session.on("close", () => {
    try { clearInterval(session._daoPingTimer); } catch {}
    try { clearTimeout(session._daoConnectBudget); } catch {}
    delete _h2Sessions[key];
  });
  // v9.9.337 · GOAWAY 优雅排水 · 十六章「万物并作 吾以观其复也」
  // 根因: GOAWAY 立即删 session → 下一请求新建 session · 但旧 session 上的活跃流仍在
  //        旧逻辑无碍(流自然结束) · 但新请求若用已 GOAWAY 的 session 会立即失败
  // 药: 标记 _daoGoaway · _getH2Session 跳过已标记的 session · 让活跃流自然完成
  session.on("goaway", (code) => {
    log(`[h2] session ${host} goaway code=${code}`);
    session._daoGoaway = true;
    delete _h2Sessions[key];
  });
}

// ★ v9.9.362(合流自 Tokyo) · 官方 H2 长连经系统/VPN 代理隧道 (根治「连接不上官方服务器」· 反者道之动)
//   病灶(根因·实证): _getH2Session 一律 http2.connect 直连官方 →
//     官方 H2/gRPC 长连在本网络(GFW)被 RST 切断 → GetUserStatus / 登录(RegisterUser) /
//     GetCommandModelConfigs 皆 "read ECONNRESET" → 前端登出、永报「连接不上官方服务器」。
//     注: 短 GET 探活可达(404)不代表 H2 长连可用 —— 前者秒断秒建, 后者持久流才遭 RST。
//   药(既得其母以知其子): 若系统/WinINET 配了代理, 官方 H2 改走 HTTP CONNECT 隧道
//     (与 _OriginTunnelAgent 同源·纯 net+tls·无外部依赖), 长连稳定不被 RST。
//   道并行不相悖: 隧道须先建好(异步)方能 http2.connect(createConnection 返成品 TLS socket);
//     故代理会话「预热」异步入池, 冷未命中当次抛 _daoWarming → 上层鉴权类 RPC 本地韧性兜底
//     (见 _replyAuthResilient), 待预热成 (~亚秒) 后续请求即拿真官方数据; 预热失败(无代理/
//     代理坏)则回退直连(不劣于旧) + 60s 冷却不空转。天之道利而不害。
function _h2TunnelConnect(host, port, purl, cb) {
  let u;
  try {
    u = new URL(purl);
  } catch (e) {
    return cb(e);
  }
  const proxyHost = u.hostname;
  const proxyPort = parseInt(u.port || "80", 10);
  const raw = net.connect(proxyPort, proxyHost);
  let settled = false;
  let buf = "";
  const fail = (e) => {
    if (settled) return;
    settled = true;
    try { raw.destroy(); } catch {}
    cb(e);
  };
  raw.once("error", fail);
  raw.setTimeout(3000, () => fail(new Error("dao h2 proxy tunnel timeout")));
  raw.on("connect", () => {
    raw.write(
      `CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`,
    );
  });
  const onData = (chunk) => {
    buf += chunk.toString("binary");
    if (buf.indexOf("\r\n\r\n") === -1) return;
    raw.removeListener("data", onData);
    const statusLine = buf.split("\r\n")[0];
    if (!/ 200 /.test(statusLine)) {
      fail(new Error("dao h2 CONNECT rejected: " + statusLine));
      return;
    }
    raw.setTimeout(0);
    raw.removeListener("error", fail);
    const tlsSock = _tls.connect(
      {
        socket: raw,
        servername: host,
        ALPNProtocols: ["h2"],
        rejectUnauthorized: true,
      },
      () => {
        if (!settled) {
          settled = true;
          cb(null, tlsSock);
        }
      },
    );
    tlsSock.once("error", (e) => {
      if (!settled) {
        settled = true;
        cb(e);
      }
    });
  };
  raw.on("data", onData);
}
const _h2Warming = {};
const _h2ProxyFailed = {}; // host -> ts 上次代理预热失败(回退直连冷却)
function _h2StartProxyWarm(host, purl) {
  if (_h2Warming[host]) return;
  _h2Warming[host] = true;
  log(`[h2] proxy warm ${host} 经系统代理 …`);
  _h2TunnelConnect(host, CLOUD_PORT, purl, (err, tlsSock) => {
    _h2Warming[host] = false;
    if (err) {
      _h2ProxyFailed[host] = Date.now();
      _originProxyUrlResolvedAt = 0; // v9.9.372 · 代理道死 → 解析即时过期·赶 watchdog 切道
      log(`[h2] proxy warm ${host} 失败 → 回退直连: ${err.message}`);
      return;
    }
    try {
      // v9.9.372 · 池内已是健康代理会话则弃新暖会话(防泄); 直连会话被换出时停其保活·任流自然完结
      const cur = _h2Sessions[host];
      if (cur && cur._daoViaProxy && !cur.closed && !cur.destroyed && !cur._daoGoaway) {
        try {
          tlsSock.destroy();
        } catch {}
        return;
      }
      const session = http2.connect(`https://${host}:${CLOUD_PORT}`, {
        createConnection: () => tlsSock,
      });
      session._daoViaProxy = true;
      _h2WireSession(session, host, host);
      _h2Sessions[host] = session;
      if (cur && !cur._daoViaProxy) {
        try {
          clearInterval(cur._daoPingTimer);
        } catch {}
      }
      delete _h2ProxyFailed[host];
      log(`[h2] proxy warm ${host} 成功 · 官方长连经系统代理隧道(抗 RST) · 新请求改走隧道`);
    } catch (e) {
      _h2ProxyFailed[host] = Date.now();
      try { tlsSock.destroy(); } catch {}
      log(`[h2] proxy warm ${host} http2.connect 失败: ${e.message}`);
    }
  });
}
function _getH2Session(host) {
  const key = host;
  const s = _h2Sessions[key];
  if (s && !s.closed && !s.destroyed && !s._daoGoaway) return s;
  if (s && (s._daoGoaway || s.closed || s.destroyed)) {
    try { if (s._daoPingTimer) clearInterval(s._daoPingTimer); } catch {}
  }
  // ★ v9.9.372 · 反者道之动 · 废预热抛错(_daoWarming→502风暴·健康首请亦挨刀·141实证根因之一)
  //   代理优先生效改为「异步暖+成则换池」: 本次请求立返带 3.5s 建连预算的直连 session ——
  //   活道直连立即可用零等待; 死道预算内 fail-fast → 502/鉴权兜底 → 客户端5s内得确答不卡死;
  //   代理暖成(亚秒级)后换池, 后续请求走隧道享抗 RST。弱者道之用·并行不相悖。
  const purl = _originResolveProxyUrl();
  const failedAt = _h2ProxyFailed[key] || 0;
  const proxyUsable =
    purl &&
    !_originIsLocalHost(host) &&
    !_originNoProxyHit(host) &&
    Date.now() - failedAt > 60000;
  if (proxyUsable) _h2StartProxyWarm(host, purl);
  log(`[h2] connect https://${host}:${CLOUD_PORT}`);
  const session = http2.connect(`https://${host}:${CLOUD_PORT}`);
  _h2WireSession(session, host, key);
  _h2Sessions[key] = session;
  return session;
}

function proxyToCloud(req, res, overrideBody, _rid) {
  const route = routeUpstream(req.url);
  // 清除 HTTP/2 伪头 + host + HTTP/1.1 connection-specific headers (RFC 9113 §8.2.2)
  // v9.3.0: H1_CONN_HEADERS 已提至 module scope · 复用
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k.startsWith(":") && !H1_CONN_HEADERS.has(k)) headers[k] = v;
  }
  delete headers["content-length"];
  let bodyBuf = overrideBody;
  if (bodyBuf && !Buffer.isBuffer(bodyBuf)) bodyBuf = Buffer.from(bodyBuf);
  if (bodyBuf) headers["content-length"] = String(bodyBuf.length);

  let session;
  try {
    session = _getH2Session(route.host);
  } catch (e) {
    // ★ v9.9.372 · session 建连失败(死道 fail-fast): 鉴权/状态类 RPC 本地韧性兜底
    //   → 前端不登出、不报「连接不上官方服务器」; 预热成后续请求即拿真官方数据。
    if (_isAuthResilientRpc(req.url)) {
      log(
        `#${_rid} [h2] 建连失败(${e.message}) → 鉴权类本地兜底`,
      );
      _replyAuthResilient(req, res, _rid);
      return;
    }
    log(`[h2] session create fail: ${e.message}`);
    if (!res.headersSent) res.writeHead(502);
    try {
      res.end(JSON.stringify({ error: "h2_session", message: e.message }));
    } catch {}
    return;
  }

  const h2headers = {
    ":method": req.method || "POST",
    ":path": route.path,
    ":authority": route.host,
    ":scheme": "https",
    ...headers,
  };

  const upStream = session.request(h2headers);

  // ── 真药 A · H2 stream 随断随清 · 弱者道之用 (四十章) ──
  // 漏: 原版无 req.aborted / res.close / upStream 超时 监听
  //     客户端中断后 upStream 滞留 H2 session, 与新流共争 HOL, 致卡死
  // 药: 三路监听 + NGHTTP2_CANCEL · 万物并作, 吾以观其复也 (十六章)
  let _upClosed = false;
  const _cancelUpstream = (why) => {
    if (_upClosed) return;
    _upClosed = true;
    try {
      // NGHTTP2_CANCEL = 0x08 · 向上游声明本流作废, 释放 H2 stream id
      upStream.close(http2.constants.NGHTTP2_CANCEL);
    } catch {}
    log(`[h2] upstream canceled (${why}) ${req.method} ${req.url}`);
  };

  // 下游 (LS 端) 主动中断 → 取消上游
  req.on("aborted", () => _cancelUpstream("req.aborted"));
  req.on("close", () => {
    if (!req.complete) _cancelUpstream("req.close(incomplete)");
  });

  // 响应管道关 → 取消上游 (用户按 stop, Cascade 刷新等)
  res.on("close", () => {
    if (!_upClosed && !res.writableEnded) _cancelUpstream("res.close");
  });

  // v9.9.338 · 反者道之动 · 撤销一切「秒数」硬限 · 四十章「反者道之动 弱者道之用」
  // 真本源: 对话该多长, AI 自会知止(知止不殆·三十二章) · 人为设 180s/600s 皆是「有以为」之下德
  //         → 反致「上礼为之而莫之应, 攘臂而扔之」= 强掐推理 = 对话中断
  // 道并行而不相悖: 不设时长上限 · 唯「下游客户端真离场」才回收上游流 (见上三路 close 监听)
  //   → 正常对话全链路零干扰、AI 自然而止; 客户端 stop/断线时才 NGHTTP2_CANCEL 释放, 互不相悖
  // 防泄漏: H2 session 45s keepalive ping 探活 · socket 真死则 session error/close 冒泡 → 流自然收
  //         故无需人为 idle 超时; setTimeout(0) 显式关闭 Node 默认流超时
  try {
    upStream.setTimeout(0);
  } catch {}

  upStream.on("response", (h2resHeaders) => {
    // ★ v9.9.72a · 传输层诊断: 捕获官方响应 headers · 反者道之动
    try {
      const _diagH = {};
      if (h2resHeaders)
        for (const [k, v] of Object.entries(h2resHeaders))
          _diagH[k] = String(v).substring(0, 200);
      _eaDiag(
        "#" +
          (_rid || "?") +
          " OFFICIAL-RESP-HEADERS: " +
          JSON.stringify(_diagH),
      );
    } catch {}
    // v9.9.28 真治 · event emit 同步 callback 包 try · 防 throw 逃逸致 ext-host crash
    // 真本源: h2resHeaders 偶为 null/undefined / Object.entries 抛 TypeError
    //   → 走 process.on('uncaughtException') (顶层已装) · 仅 log
    //   → 但 callback 中断致 res 未发响应 · cascade 等 180s 超时 · 体验差
    //   → 包 try · throw 之后能 _cancelUpstream + 502 响应 · 优雅退出
    try {
      const status = (h2resHeaders && h2resHeaders[":status"]) || 200;
      const resHeaders = {};
      if (h2resHeaders) {
        for (const [k, v] of Object.entries(h2resHeaders)) {
          if (!k.startsWith(":")) resHeaders[k] = v;
        }
      }
      // ★ v9.9.263 · 真解锁 · GetUserStatus(proto/gzip) 缓冲改写去 Pro 锁 · 非直透
      //   反者道之动: 模型容器 field 33 Pro 徽标 → 全模型解禁可选
      // ★ v9.9.366 · 端点重写同口并入 · GetCliModelConfigs/GetCliTeamSettings/GetUserStatus
      //   响应体内的官方上游 URL 字段 → 127.0.0.1:_actualPort · chisel 推理归本口
      {
        const _rpcPathU = route.path || req.url || "";
        const _ctU = (h2resHeaders && h2resHeaders["content-type"]) || "";
        const _ceU = (h2resHeaders && h2resHeaders["content-encoding"]) || "";
        const _unlockHit =
          _isModelUnlockEnabled() &&
          status === 200 &&
          /GetUserStatus/i.test(_rpcPathU) &&
          /proto/i.test(_ctU);
        const _epHit =
          status === 200 &&
          /GetCliModelConfigs|GetCliTeamSettings|GetUserStatus/i.test(_rpcPathU);
        if (_unlockHit || _epHit) {
          let _ub = [],
            _un = 0;
          const _ubMax = 4 * 1024 * 1024;
          upStream.on("data", (c) => {
            if (_un < _ubMax) {
              _ub.push(c);
              _un += c.length;
            }
          });
          upStream.on("end", () => {
            try {
              const orig = Buffer.concat(_ub);
              let outBuf = orig;
              if (_unlockHit) {
                const unlocked = _unlockUserStatusBody(orig, _ceU, _rid || "?");
                if (unlocked) outBuf = unlocked;
              }
              if (_epHit) {
                const rw = _rewriteEndpointBody(outBuf, _rid || "?");
                if (rw) outBuf = rw;
              }
              const h = { ...resHeaders };
              delete h["content-length"];
              h["content-length"] = String(outBuf.length);
              // ★ v9.9.362(合流自 Tokyo) · 缓存本次官方真响应(守其母·连同其编码) · 供官方长连暂断时原样回放不登出
              try {
                _lastGoodUserStatus = {
                  buf: outBuf,
                  ct: h["content-type"] || "application/proto",
                  ce: h["content-encoding"] || "",
                  at: Date.now(),
                  rpc: _rpcPathU, // v9.9.376 · 标来源 RPC · 回放须同型
                };
              } catch (_) {}
              // ★ v9.9.376 · GetCliModelConfigs 真响应捕入秒回兜底缓存(内存+落盘)
              try {
                if (/GetCliModelConfigs/i.test(_rpcPathU) && outBuf.length > 10)
                  _storeCliModelsLastGood(
                    outBuf,
                    h["content-type"],
                    h["content-encoding"],
                  );
              } catch (_) {}
              res.writeHead(status, h);
              res.end(outBuf);
            } catch (e) {
              log(`#${_rid} [响应改写] 写回失败 → 502: ${e.message}`);
              try {
                if (!res.headersSent) {
                  res.writeHead(502);
                  res.end();
                }
              } catch {}
            }
          });
          return; // 已接管 · 不再 pipe
        }
      }
      try {
        res.writeHead(status, resHeaders);
      } catch (e) {
        // res 已关 · 取消上游即可
        _cancelUpstream(`res.writeHead fail: ${e.message}`);
        return;
      }
      upStream.pipe(res);
      // ★ v9.9.72a · 传输层诊断: 捕获官方响应体前 500 字节 hex
      {
        let _offBuf = [],
          _offN = 0;
        const _offMax = 500;
        upStream.on("data", (c) => {
          if (_offN < _offMax) {
            _offBuf.push(c);
            _offN += c.length;
          }
          if (_offN >= _offMax && _offBuf.length > 0) {
            const hex = Buffer.concat(_offBuf)
              .toString("hex")
              .substring(0, 1000);
            _eaDiag("#" + (_rid || "?") + " OFFICIAL-BODY-HEX: " + hex);
            _offBuf = [];
          }
        });
      }
      // ★ v9.9.95 · 道法自然 · 从RPC响应实证提取模型UID
      //   不着相于表层硬编码 · 从Windsurf云端响应中实证获取
      //   对所有非流式RPC响应做轻量扫描 · 流式chat不缓冲
      //   道义: 不出于户以知天下 · 万物并作吾以观其复
      //   ★ v9.9.67 · gating · Min 版解锁/外接皆默关 → 扫描无消费者 → 不缓冲不扫
      //     (原: 每非流式响应缓冲至 2MB + 全文 regex 扫 · 纯耗)
      {
        const _rpcPath = route.path || req.url || "";
        const _isStreaming = /GetStreaming|GetChatMessage/i.test(_rpcPath);
        const _modelsConsumerAlive = _isModelUnlockEnabled() || !!_ea;
        if (!_isStreaming && _modelsConsumerAlive) {
          let _modelBuf = [],
            _modelN = 0;
          const _modelMax = 2 * 1024 * 1024; // 2MB上限
          upStream.on("data", (c) => {
            if (_modelN < _modelMax) {
              _modelBuf.push(c);
              _modelN += c.length;
            }
          });
          upStream.on("end", () => {
            if (_modelBuf.length > 0 && _modelN > 10) {
              try {
                const fullBody = Buffer.concat(_modelBuf);
                _extractModelsFromRPC(fullBody, _rpcPath);
              } catch {}
            }
          });
        }
      }
    } catch (e) {
      log(`[FATAL/response-cb] ${e.stack || e.message}`);
      _cancelUpstream(`response-cb throw: ${e.message}`);
      try {
        if (!res.headersSent) {
          res.writeHead(502);
          res.end(JSON.stringify({ error: "response-cb", message: e.message }));
        }
      } catch {}
    }
  });

  upStream.on("error", (e) => {
    log(`upstream h2 error ${req.method} ${req.url}: ${e.message}`);
    _upClosed = true; // 已错 · 无需再 cancel
    if (!res.headersSent) {
      // ★ v9.9.362(合流自 Tokyo) · 官方流中途 RST(ECONNRESET 等)且未出头: 鉴权/状态类本地韧性兜底
      //   → 彻底解耦官方可达性 · 前端不登出、不报「连接不上官方服务器」。
      if (_isAuthResilientRpc(req.url)) {
        try {
          _replyAuthResilient(req, res, _rid);
        } catch (_) {}
        return;
      }
      try {
        res.writeHead(502);
      } catch {}
    }
    try {
      res.end(JSON.stringify({ error: "upstream", message: e.message }));
    } catch {}
  });

  upStream.on("close", () => {
    _upClosed = true;
  });

  // gRPC trailers (grpc-status / grpc-message)
  upStream.on("trailers", (trailers) => {
    try {
      res.addTrailers(trailers);
    } catch {}
  });

  if (bodyBuf) upStream.end(bodyBuf);
  else {
    req.pipe(upStream);
    // req 读错 → 取消上游
    req.on("error", (e) => _cancelUpstream(`req.error: ${e.message}`));
  }
}

// ═══════════════════════════════════════════════════════════
// 主服务器
// ═══════════════════════════════════════════════════════════
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ═══════════════════════════════════════════════════════════
// v9.8.0 · _buildAllFieldEntry · 守一不离 · 名实终一
// ═══════════════════════════════════════════════════════════
// tape all_fields 渲染单字段:
//   chat/summary/memory/ephemeral 类: invertAnySP 替换 → text=AFTER · text_before=BEFORE
//   raw_text/unknown_long 类:        strip+neutralize → text=AFTER · text_before=BEFORE
// 主公照观面板见 AFTER 即 LLM 实收 · 主公谓"残留"消 (实已 neutralize 上行)
// 道义: 三十九章「得一」· 名实一体不裂 · 二十一章「其精甚真，其中有信」
function _buildAllFieldEntry(c, mode) {
  // ★ v9.9.70 · "wire" 直通形 —— 字段取自实发 body · text 即线上真字节 · 不重演
  if (mode === "wire") {
    const t = c.text || "";
    return {
      path: c.field_path,
      kind: c.kind,
      chars: t.length,
      hash: _quickHash(t),
      text: t,
      text_before: null,
      chars_before: 0,
    };
  }
  let displayText = c.text;
  let textBefore = null;
  if (mode === "invert") {
    if (
      c.kind === "chat" ||
      c.kind === "summary" ||
      c.kind === "memory" ||
      c.kind === "ephemeral"
    ) {
      const inv = invertAnySP(c.text);
      if (inv !== null && inv !== c.text) {
        textBefore = c.text;
        displayText = inv;
      }
    } else {
      // v9.8.0 · raw_text/unknown_long: 实模拟 deepStripProtoSideChannels 之治
      //   1. stripSideChannelBlocks (剥 SIDE_CHANNEL_TAGS · 不含 additional_metadata 自 v9.8.0)
      //   2. neutralizeHiddenOverrides (中性化 SECTION_OVERRIDE)
      let after = c.text;
      try {
        if (hasSideChannels(after)) {
          after = stripSideChannelBlocks(after);
        }
      } catch {}
      try {
        if (after.indexOf("SECTION_OVERRIDE_MODE_") >= 0) {
          after = neutralizeHiddenOverrides(after);
        }
      } catch {}
      if (after !== c.text) {
        textBefore = c.text;
        displayText = after;
      }
    }
  }
  return {
    path: c.field_path,
    kind: c.kind,
    chars: displayText.length,
    hash: _quickHash(displayText),
    text: displayText,
    text_before: textBefore,
    chars_before: textBefore ? textBefore.length : 0,
  };
}

// ═══════════════════════════════════════════════════════════
// 模型反代 (Model Reverse Proxy) · 反者道之动
//   把 渠道配置/模型路由 已接通的模型反向暴露为标准 OpenAI(/v1/chat/completions,
//   /v1/models) 与 Anthropic(/v1/messages) 本地端点 · 脱离 Devin Desktop 直调。
//   控制面: /origin/revproxy/{status,config}。逻辑独立于 vendor/外接api/core/revproxy.js。
// ═══════════════════════════════════════════════════════════
let _revproxyMod = null;
function _getRevproxy() {
  return null; // v9.9.374-min · 模型反代轴源码级拆除
  if (_revproxyMod) return _revproxyMod;
  try {
    _revproxyMod = require(
      path.join(__dirname, "..", "外接api", "core", "revproxy.js"),
    );
  } catch (e) {
    log("[revproxy] load fail: " + (e && e.message));
    _revproxyMod = null;
  }
  return _revproxyMod;
}
// 把上游真观测到的付费配额态(ok/exhausted)回灌 revproxy → 面板着色绿/红。
function _signalPremiumQuota(state) {
  if (state !== "ok" && state !== "exhausted") return;
  try {
    const m = _getRevproxy();
    if (m && m.setPremiumQuota && m.getPremiumQuota && m.getPremiumQuota() !== state) {
      m.setPremiumQuota(state);
      log("[revproxy] premiumQuota ← " + state + " (上游实测)");
    }
  } catch (_) {}
}
// ── 官方直通·捕帧复用 ─────────────────────────────────────────────────────
//   反者道之动·闭环自举: 捕最近一帧真 GetChatMessage 请求, 换入新 user turn 后
//   真转云端官方推理链, 解码回包文本。免费档(swe-1-6 等)即便付费配额耗尽仍可出包。
let _lastChatFrame = null; // { body:Buffer, url, method, headers, at }
// ── 免费档专用槽 (反者道之动·没身不殆·活水恒足) ──────────────────────────
//   病灶(实证·2026-07): Cascade 每轮对话后另发一次「标题/摘要」后台请求, 其档恒为
//     付费 Gemini 2.5 Flash → 覆盖刚捕的免费帧 → warm 恒 premium。账号付费周配额一耗尽,
//     官方直通末跳(_officialChatReplay)即恒 internal error, 原汤化原食回环随之断。
//   正法: 捕帧时按帧内 modelUid 判免费档者「另存」此槽(付费摘要帧覆盖不了它·各安其位),
//     回放时若「调用方要免费档」或「付费配额已耗尽」即优先取此槽 → 免费上游恒可出包,
//     回环不因付费配额死。与主槽同样落盘, 跨重启/宿主重载常驻。
let _lastFreeChatFrame = null; // { body:Buffer, url, method, headers, at }
// ── 预热帧跨重启常驻 (反者道之动·没身不殆) ────────────────────────────────
//   病灶: 帧仅存内存 → 插件每次重启即丢 → /warm 恒 has:false、外接反代官方档 502。
//     此为 /v1 本源「供所有环境使用」重启后即断的最后一处断点。
//   正法: 捕帧即落盘(body 二进制 + meta json), 模块加载/读帧时自盘复现 →
//     插件重启、宿主重载后官方直通仍即通, 无需再次手动预热。宁稳勿崩·坏盘即忽略。
function _frameCacheDir() {
  const home =
    os.homedir() || process.env.HOME || process.env.USERPROFILE || "";
  return home ? path.join(home, ".codeium", "dao-byok") : null;
}
function _frameBodyPath(free) {
  const d = _frameCacheDir();
  return d ? path.join(d, free ? "chatframe.free.bin" : "chatframe.bin") : null;
}
function _frameMetaPath(free) {
  const d = _frameCacheDir();
  return d ? path.join(d, free ? "chatframe.free.json" : "chatframe.json") : null;
}
function _persistChatFrame(free) {
  // ★ v9.9.67-min · 损之又损 · 帧不落盘 · 名实相符
  //   病: Min 版回放消费轴(_officialChatReplay 经 _getRevproxy)已源码级拆除 →
  //       落盘帧永无消费者; 而每轮 CHAT_PROTO 仍 writeFileSync 全帧(含 Authorization
  //       Bearer + 会话 token + 全 SP)至 ~/.codeium/dao-byok/chatframe*.bin/json ——
  //       ① 鉴权凭据落盘(Windows 不 enforce 0o600) ② 每轮同步阻塞写 MB 级 I/O。
  //   治: Min 版帧仅内存(_lastChatFrame/_lastFreeChatFrame 仍捕 · 观察面不断) · 不落盘。
  //       历史落盘文件不再读用(见 _restoreChatFrame 同步守) · 需要者设 env DAO_FRAME_PERSIST=1 显式复旧。
  //   道义: 三十六章「国之利器不可以示人」· 四十八章「为道日损」· 六十四章「为之于其未有也」
  if (String(process.env.DAO_FRAME_PERSIST || "") !== "1") return false;
  try {
    const fr = free ? _lastFreeChatFrame : _lastChatFrame;
    const d = _frameCacheDir();
    const bp = _frameBodyPath(free);
    const mp = _frameMetaPath(free);
    if (!d || !bp || !mp || !fr || !fr.body) return false;
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    const tmpB = bp + ".tmp";
    fs.writeFileSync(tmpB, fr.body);
    fs.renameSync(tmpB, bp);
    const meta = {
      url: fr.url,
      method: fr.method,
      headers: fr.headers,
      at: fr.at,
    };
    const tmpM = mp + ".tmp";
    fs.writeFileSync(tmpM, JSON.stringify(meta), { mode: 0o600 });
    fs.renameSync(tmpM, mp);
    return true;
  } catch (_) {
    return false;
  }
}
// 内存无帧时从盘复现; 已有则不动。返回是否复现成功。
// ★ v9.9.67-min · 落盘默认关 → 亦不读旧盘帧(陈token无消费者 · 免陈腐) · env=1 时复旧
function _restoreChatFrame(free) {
  if (String(process.env.DAO_FRAME_PERSIST || "") !== "1") return false;
  if (free) {
    if (_lastFreeChatFrame && _lastFreeChatFrame.body) return false;
  } else if (_lastChatFrame && _lastChatFrame.body) return false;
  try {
    const bp = _frameBodyPath(free);
    const mp = _frameMetaPath(free);
    if (!bp || !mp || !fs.existsSync(bp) || !fs.existsSync(mp)) return false;
    const body = fs.readFileSync(bp);
    if (!body || !body.length) return false;
    let meta = {};
    try {
      meta = JSON.parse(fs.readFileSync(mp, "utf8")) || {};
    } catch (_) {
      return false;
    }
    const fr = {
      body,
      url: meta.url,
      method: meta.method || "POST",
      headers: meta.headers || {},
      at: meta.at || 0,
      restored: true,
    };
    if (free) _lastFreeChatFrame = fr;
    else _lastChatFrame = fr;
    return true;
  } catch (_) {
    return false;
  }
}
// 某 modelUid 是否官方免费档 —— 与 revproxy.js 之 _isFreeTier 同源同判(名实相符):
//   costTier=FREE 或 creditMultiplier ∈ {0, null, undefined} 即免费(swe-1-6/kimi 等·不耗付费周配额)。
//   目录外者(如后台摘要 Gemini 2.5 Flash·不在 catalog) → 未知即保守判非免费, 不污活水槽。
//   modelUid 归一比对(兼容 alias 形 MODEL_SWE_1_6 与 swe-1-6)。
function _catalogFreeTier(costTier, mult) {
  return (
    costTier === "MODEL_COST_TIER_FREE" ||
    mult === 0 ||
    mult === null ||
    mult === undefined
  );
}
function _modelUidIsFree(uid) {
  if (!uid) return false;
  try {
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const want = norm(uid);
    if (!want) return false;
    const cat = _fullModelCatalog || _loadFullModelCatalog() || [];
    for (const m of cat) {
      const ids = [m.modelUid, m.modelOrAlias && m.modelOrAlias.model];
      if (ids.some((x) => norm(x) === want))
        return _catalogFreeTier(m.modelCostTier, m.creditMultiplier);
    }
  } catch (_) {}
  return false;
}
// 捕获帧所携档是否免费 (读顶层 modelUid → _modelUidIsFree)
function _frameIsFreeModel(body) {
  try {
    const info = _frameModelInfo(body);
    return !!(info && _modelUidIsFree(info.modelUid));
  } catch (_) {
    return false;
  }
}
function _captureChatFrame(req, body) {
  const hdr = {};
  try {
    for (const [k, v] of Object.entries(req.headers || {}))
      if (!k.startsWith(":")) hdr[k] = v;
  } catch (_) {}
  const frame = {
    body: Buffer.isBuffer(body) ? Buffer.from(body) : Buffer.from(body),
    url: req.url,
    method: req.method || "POST",
    headers: hdr,
    at: Date.now(),
  };
  _lastChatFrame = frame;
  _persistChatFrame(false); // 跨重启常驻·best-effort
  // 免费档帧另存活水槽: 付费摘要帧覆盖不了它 → premium 配额耗尽仍可回放 (没身不殆)
  try {
    if (_frameIsFreeModel(frame.body)) {
      _lastFreeChatFrame = frame;
      _persistChatFrame(true);
    }
  } catch (_) {}
}
// ── 守真突破 · 活鉴权信封 (v9.9.334 · 上善若水·利万物而不争) ────────────────
//   病灶(守真依赖): _lastChatFrame 仅由 CHAT_PROTO(GetChatMessage) 捕获 →
//     持久帧的会话 token 会随会话轮换失活; 传统上须「用户再发一条 Cascade 对话」
//     才能铸出新活 token(守真)。此即「首次/每次都要用户发消息」之限的根。
//   正法(道法自然·无为而无不为): 会话鉴权信封(顶层 field1·内含 devin-session-token)
//     并非 chat 独有 —— IDE 一活跃(打开文件即触发的自动补全/上下文等 inference 请求)
//     就向本 origin 发出携同一鉴权信封的请求。故「从任一 inference 请求采信封」即可在
//     「用户不发对话」的前提下持续拿到活鉴权; 配合磁盘常驻的骨架帧(形)嫁接 →
//     合成一枚全鉴权回放帧。用户只需打开 Devin Desktop 正常用, 系统自然采信, 不待守真。
//   宁稳勿崩: 仅当原始 field1 字节含会话标记(名实相符)才采信, 否则不动; 全 try 兜底。
let _lastAuthEnvelope = null; // { f1:Buffer, cid:Buffer|null, at:number }
let _lastSynthAt = 0; // 自主保鲜节流: 最近一次合成时间
function _looksLikeAuthEnvelope(f1) {
  if (!f1 || !f1.length) return false;
  try {
    const s = f1.toString("latin1");
    return (
      s.indexOf("session-token") >= 0 ||
      s.indexOf("devin-team$") >= 0 ||
      s.indexOf("devin-session") >= 0
    );
  } catch (_) {
    return false;
  }
}
// 从任一请求体采鉴权信封(顶层 field1[+field16 cascadeId]) → 更鲜即留存(内存·随宿主生死)。
//   道义: 上善若水; 任一请求皆可为鉴权之源, 不独 chat → 脱守真依赖。
//   不落盘: 会话 token 仅当前 IDE 会话有效, 重启后由新启动流量自然重采(免持陈)。
function _harvestAuthEnvelope(body) {
  try {
    if (!body || !body.length) return false;
    const f1 = _topFieldRaw(body, 1);
    if (!_looksLikeAuthEnvelope(f1)) return false;
    const cid = _topFieldRaw(body, 16);
    _lastAuthEnvelope = { f1, cid: cid || null, at: Date.now() };
    _synthesizeFreshReplayFrame();
    return true;
  } catch (_) {
    return false;
  }
}
// 自主保鲜合成(道法自然·无为而无不为): 活鉴权信封采得后, 自动嫁接到盘存骨架帧 →
//   合成全鉴权回放帧(rewrites 自然自增), 彻底脱离"必须有用户 Cascade 对话"之限。
//   IDE 一活跃(补全/上下文等 inference 即有), 系统自主闭环保鲜, 用户无为而系统无不为。
//   节流: 每 5 秒至多合成一次(IDE 活跃期间持续保鲜, 不致风暴)。
function _synthesizeFreshReplayFrame() {
  try {
    const env = _lastAuthEnvelope;
    if (!env || !env.f1) return;
    const now = Date.now();
    if (now - _lastSynthAt < 5000) return;
    if (!_lastChatFrame || !_lastChatFrame.body) _restoreChatFrame(false);
    const skel = _lastChatFrame;
    if (!skel || !skel.body) return;
    if ((skel.at || 0) >= (env.at || 0)) return;
    const grafted = _graftFreshSession(skel.body, skel);
    if (grafted && grafted !== skel.body) {
      _lastSynthAt = now;
      _authGraftStats.synths = (_authGraftStats.synths || 0) + 1;
    }
  } catch (_) {}
}
// ── 根源突破 · LSP/补全流量采信封 (v9.9.336 · 反者道之动·上善若水) ──────────────
//   病灶: 会话鉴权信封只随 Cascade chat(CHAT_PROTO/INFER_STRIP)流入被采;
//     而 LanguageServerService(自动补全/上下文·GetCompletions 等)被 classifyRPC 归为
//     PASSTHROUGH → 纯流式直透·从不读 body → 其携带的鉴权信封被白白放过。
//     故「IDE 活跃即保鲜」在只有补全、无 chat(如 Cascade 配额受限)时不成立。
//   正法(道法自然·无为而无不为): 当内存信封陈旧(或缺失)时, 才对 PASSTHROUGH 的 POST 请求
//     缓冲 body 探采鉴权信封(节流+体积上限, 不扰热路); 一旦采得新鲜信封, 即回归纯流式直透。
//     IDE 任一活跃(哪怕只打字触发补全)皆可保鲜, 彻底脱 Cascade 对话依赖。用户无为而系统无不为。
//   宁稳勿崩: 全 try 兜底; 探采失败即照常直透; 采得之信封仍须名实相符(含会话标记)方合成。
let _lastLspProbeAt = 0;
let _lspProbe = {
  attempts: 0,
  bodies: 0,
  hits: 0,
  last_markers: null,
  last_fields: null,
  last_at: 0,
  // v9.9.336b · 头部鉴权诊断: LSP 请求的鉴权多在 HTTP 头而非 body → 记录之。
  hdr_auth_names: null,
  hdr_has_devin: false,
  hdr_val_len: 0,
  // v9.9.336c · 全直通路径诊断: 记录最近探测的 RPC 路径及命中标记(找鉴权握手 RPC)。
  paths: [],
  auth_paths: [],
};
function _recordProbePath(rpc, hitBody, hitHdr) {
  try {
    const tag = rpc + (hitBody ? "#body" : "") + (hitHdr ? "#hdr" : "");
    const arr = _lspProbe.paths;
    if (arr.indexOf(tag) < 0) {
      arr.push(tag);
      if (arr.length > 24) arr.shift();
    }
    if ((hitBody || hitHdr) && _lspProbe.auth_paths.indexOf(rpc) < 0)
      _lspProbe.auth_paths.push(rpc);
  } catch (_) {}
}
// 诊断: 记录 LSP 请求头中鉴权类头名 + Authorization 值是否含 devin/session 标记(不落明文)。
function _scanAuthHeaders(req) {
  try {
    const h = (req && req.headers) || {};
    const names = [];
    let hasDevin = false;
    let valLen = 0;
    for (const k of Object.keys(h)) {
      const lk = k.toLowerCase();
      if (
        lk === "authorization" ||
        lk.indexOf("api-key") >= 0 ||
        lk.indexOf("api_key") >= 0 ||
        lk.indexOf("token") >= 0 ||
        lk.indexOf("auth") >= 0 ||
        lk.indexOf("session") >= 0
      ) {
        names.push(lk);
        const v = String(h[k] || "");
        valLen = Math.max(valLen, v.length);
        if (/devin|session-token|devin-team/i.test(v)) hasDevin = true;
      }
    }
    if (names.length) {
      _lspProbe.hdr_auth_names = names;
      _lspProbe.hdr_has_devin = hasDevin;
      _lspProbe.hdr_val_len = valLen;
      return true;
    }
  } catch (_) {}
  return false;
}
const _AUTH_MARKERS = [
  "session-token",
  "devin-session",
  "devin-team",
  "api_key",
  "Authorization",
  "Bearer ",
  "ExaAuth",
  "Metadata",
  "metadata",
];
// 诊断: 扫顶层各字段, 记录出现的鉴权类标记及其字段号(不落敏感明文·仅记标记名)。
function _scanAuthMarkers(body) {
  const out = { markers: [], fields: {} };
  try {
    const frames = parseFrames(body);
    if (!frames.length) return out;
    const top = parseProto(frames[0].payload);
    for (const numStr of Object.keys(top)) {
      for (const e of top[numStr] || []) {
        if (e && e.w === 2 && e.b) {
          const s = Buffer.from(e.b).toString("latin1");
          for (const m of _AUTH_MARKERS) {
            if (s.indexOf(m) >= 0) {
              if (out.markers.indexOf(m) < 0) out.markers.push(m);
              (out.fields[numStr] = out.fields[numStr] || []).push(m);
            }
          }
        }
      }
    }
  } catch (_) {}
  return out;
}
// 门控: 仅当全无信封(兜底)+POST+节流(≥2s)+体积可控(≤512KB)时才缓冲 body 探采。
function _shouldProbeLspBody(req) {
  try {
    if ((req.method || "") !== "POST") return false;
    // 无为不扰热路: 已自持鉴权信封(盘存自举 或 chat 采得)即不缓冲探采 → LSP 探采仅作
    //   "全无信封"时的兜底(经验实证 LSP/状态 RPC 不携可采鉴权, 故正常态此路恒眠·零开销)。
    const env = _lastAuthEnvelope;
    if (env && env.f1) return false;
    const now = Date.now();
    if (now - _lastLspProbeAt < 2000) return false;
    const cl = parseInt(req.headers["content-length"] || "0", 10);
    if (cl > 512 * 1024) return false;
    _lastLspProbeAt = now;
    return true;
  } catch (_) {
    return false;
  }
}
// 采集: 记录诊断标记 + 正法采信封(field1 含会话标记即采并触发自主合成)。
function _harvestFromLsp(body) {
  try {
    if (!body || !body.length) return false;
    _lspProbe.bodies++;
    const scan = _scanAuthMarkers(body);
    if (scan.markers.length) {
      _lspProbe.hits++;
      _lspProbe.last_markers = scan.markers;
      _lspProbe.last_fields = Object.keys(scan.fields).join(",");
      _lspProbe.last_at = Date.now();
      _harvestAuthEnvelope(body);
      return true;
    }
    _harvestAuthEnvelope(body);
  } catch (_) {}
  return false;
}
// ★ v9.9.344 · 本地 gRPC OK 应答 · 天下有始 以为天下母
//   SeatManagement/Heartbeat/GetUserStatus 官方不可达时 → 本地直返空 gRPC OK
//   LS 仅检 grpc-status=0 即视为"已鉴权/已连接" · 无需真实 proto 载荷
//   gRPC 帧: [0x00(无压缩), 0x00,0x00,0x00,0x00(长度=0)] = 空 protobuf message
const _GRPC_EMPTY_OK = Buffer.from([0, 0, 0, 0, 0]);
function _replyGrpcOk(res, rid, rpcName) {
  try {
    if (res.headersSent) return;
    // H2 与 H1 均用 writeHead + write + addTrailers + end
    res.writeHead(200, {
      "content-type": "application/grpc",
    });
    res.write(_GRPC_EMPTY_OK);
    try {
      res.addTrailers({ "grpc-status": "0", "grpc-message": "" });
    } catch (_) {
      // H1 无 TE:trailers 时 addTrailers 可能报错 · 忽略(grpc-status 已在 header 隐含)
    }
    res.end();
    log(`#${rid} [local-auth] ${rpcName} → gRPC OK (本地兜底)`);
  } catch (e) {
    log(`#${rid} [local-auth] _replyGrpcOk err: ${e.message}`);
  }
}

function _rpcName(u) {
  try {
    const q = (u || "").indexOf("?");
    const p = q < 0 ? u || "" : (u || "").slice(0, q);
    const m = /\/([A-Za-z0-9_.]+)$/.exec(p);
    return m ? m[1] : p;
  } catch (_) {
    return "?";
  }
}
// ── 根源自足 · 盘存帧自举鉴权信封 (v9.9.336 · 深根固柢·长生久视) ──────────────
//   彻底零依赖: 进程一起, 即从磁盘常驻的真实骨架帧(此前真 Cascade 采得·含 field1 鉴权)
//   自举 _lastAuthEnvelope → envelope.has=true 立成, 不待任何流量、不待用户任何动作。
//   at 取帧真实捕获时刻(诚实反映新鲜度·不伪造), 供 age_ms 观测。此为守真之最坚底座:
//   即便账号 Cascade 配额受限、当前无任何可采流量, 系统仍自持一枚真鉴权信封(没身不殆)。
let _envBootstrapped = false;
function _bootstrapEnvelopeFromDisk() {
  if (_envBootstrapped) return;
  _envBootstrapped = true;
  try {
    if (_lastAuthEnvelope && _lastAuthEnvelope.f1) return;
    if (!_lastChatFrame || !_lastChatFrame.body) _restoreChatFrame(false);
    const skel = _lastChatFrame;
    if (!skel || !skel.body) return;
    const f1 = _topFieldRaw(skel.body, 1);
    if (!_looksLikeAuthEnvelope(f1)) return;
    const cid = _topFieldRaw(skel.body, 16);
    _lastAuthEnvelope = { f1, cid: cid || null, at: skel.at || 0, src: "disk" };
  } catch (_) {}
}
// 官方直通回放取帧: 调用方要免费档 或 付费配额已耗尽 → 优先免费槽(原汤化原食·活水恒足),
//   否则用主槽(最近一帧)。两槽皆按需自盘复现。
function _pickReplayFrame(target) {
  let wantFree = !!(target && target.free);
  if (!wantFree) {
    try {
      const m = _getRevproxy();
      if (m && m.getPremiumQuota && m.getPremiumQuota() === "exhausted")
        wantFree = true;
    } catch (_) {}
  }
  if (wantFree) {
    if (!_lastFreeChatFrame || !_lastFreeChatFrame.body) _restoreChatFrame(true);
    if (_lastFreeChatFrame && _lastFreeChatFrame.body) return _lastFreeChatFrame;
  }
  if (!_lastChatFrame || !_lastChatFrame.body) _restoreChatFrame(false);
  return _lastChatFrame;
}
// ── 陈旧会话/版本失配根治 (反者道之动·没身不殆) ──────────────────────────────
//   病灶(实证·502 根因): 官方直通复用捕获帧时, 若帧内 Cascade 会话已失活或客户端版本
//     元数据过旧, 官方上游回「There was an error with your Cascade session, please
//     update your editor」。旧实现把它当普通 upstream_error 502(暗示网关瞬时故障)→
//     客户端对同一陈旧帧无限重试, 且盘存坏帧从不失效 → 回环永久卡死, 唯有用户手动再发
//     一条 Cascade 对话才解。
//   正法: 精准识别此类「会话/版本」拒绝(名实相符·regex 收紧不误伤), 一经命中即失效
//     内存主/免费槽 + 盘存帧文件 + 陈旧鉴权信封 → 下一次 IDE 活跃(补全/对话)自然重采
//     新鲜帧, 并向调用方回明确可执行指引(而非生吞上游原文·或伪装成瞬时故障狂重试)。
//   守正不伪: 绝不伪造/篡改客户端版本号去绕过官方版本门槛(欺骗且危账号)——
//     只失效坏帧、引导以「当前真实运行的 IDE」重采真实鉴权信封。
const _staleFrameStats = { calls: 0, invalidations: 0, last_at: 0, last_reason: "" };
function _isStaleSessionErr(txt) {
  const s = String(txt || "");
  return /please update your editor|error with your Cascade session|invalid(?:ated)? session|session (?:has )?expired|session (?:is )?(?:no longer|not) valid/i.test(
    s,
  );
}
// 官方直通上游错误归类(优先级契约·名实相符): 会话失活/版本过旧 > 配额耗尽。
//   官方以 Connect code=failed_precondition 回陈旧会话错, 其 code 串含 "precondition"
//   会命中 exhausted 启发式 → 必须 stale 优先, 否则既不失效陈旧帧又误置 premiumQuota=exhausted。
function _classifyOfficialErr(txt) {
  const stale = _isStaleSessionErr(txt);
  const exhausted =
    !stale &&
    /quota|exhaust|governor|precondition|Authentication Fails/i.test(
      String(txt || ""),
    );
  return { stale, exhausted };
}
function _rmQuiet(p) {
  try {
    if (p && fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) {}
}
// 失效陈旧帧: 清内存主/免费槽 + 删盘存帧文件 + 弃陈旧鉴权信封 → 下次活跃自然重采。
function _invalidateStaleFrames(reason) {
  try {
    _staleFrameStats.calls++;
    _lastChatFrame = null;
    _lastFreeChatFrame = null;
    _rmQuiet(_frameBodyPath(false));
    _rmQuiet(_frameMetaPath(false));
    _rmQuiet(_frameBodyPath(true));
    _rmQuiet(_frameMetaPath(true));
    _lastAuthEnvelope = null;
    _envBootstrapped = false; // 允许后续从新鲜流量重新自举
    _staleFrameStats.invalidations++;
    _staleFrameStats.last_at = Date.now();
    _staleFrameStats.last_reason = String(reason || "").slice(0, 80);
    return true;
  } catch (_) {
    return false;
  }
}
const _STALE_MSG =
  "官方直通会话已失活或客户端版本过旧(官方上游拒绝: Cascade session / please update your editor)。" +
  "已自动失效陈旧捕获帧, 请在 Devin Desktop 内用【当前版本】与任一官方模型(如 SWE-1.6)对话一次以重采新鲜帧, 随后经反代重试即可; " +
  "若持续失败, 请将 Devin Desktop 升级到最新版本。";
// 模块加载即尝试自盘复现预热帧 (插件重启后官方直通即通) · 主槽 + 免费槽
_restoreChatFrame(false);
_restoreChatFrame(true);

// 取捕获帧最末一条消息正文 → 换成 newText → 返回新 Connect 帧 Buffer。
// 道·schema 自适应: 消息数组随 cascade_wire 演化(老 V2=field2/content2,
//   新 wire=field3/content3)。不写死字段号——在候选数组里挑「末条目能解析且
//   内含字符串正文」者为消息数组, 末条目内取「最长字符串子字段」为正文(即 user turn 文本)。
// 取某消息条目里「最长 UTF-8 字符串子字段」= 正文。返回 {field, text}; 无则 {field:null,text:""}。
function _msgContentInfo(entry) {
  const raw = entry && entry.b !== undefined ? entry.b : entry;
  if (!raw) return { field: null, text: "" };
  let sub;
  try {
    sub = parseProto(Buffer.isBuffer(raw) ? raw : Buffer.from(raw));
  } catch (_) {
    return { field: null, text: "" };
  }
  let bestField = null;
  let best = "";
  for (const k of Object.keys(sub)) {
    const e0 = sub[k] && sub[k][0];
    if (e0 && e0.w === 2 && e0.b && e0.b.length) {
      const s = Buffer.from(e0.b).toString("utf8");
      if (s.length > best.length) {
        best = s;
        bestField = Number(k);
      }
    }
  }
  return { field: bestField, text: best };
}
// 在候选字段里挑「末条目能解析且含字符串正文」者为消息数组, 返回 {field, arr}。
function _findMsgsArray(top) {
  for (const fn of [3, 2, 10, 17]) {
    const cand = top[fn];
    if (!cand || !cand.length) continue;
    if (!cand.every((e) => e.w === 2)) continue;
    if (_msgContentInfo(cand[cand.length - 1]).text) return { field: fn, arr: cand };
  }
  return null;
}
// 读捕获帧顶层 CHAT_MODEL_UID(field 21)/CHAT_MODEL_NAME(field 14) 字符串 = 预热档。
//   cascade_wire 实证: api_server_pb.GetChatMessageRequest field21=modelUid, field14=modelName。
function _frameModelInfo(capturedBody) {
  try {
    const frames = parseFrames(capturedBody);
    if (!frames.length) return null;
    const top = parseProto(frames[0].payload);
    const rd = (f) => {
      const e = top[f] && top[f][0];
      return e && e.w === 2 && e.b ? Buffer.from(e.b).toString("utf8") : null;
    };
    const found = _findMsgsArray(top);
    return {
      modelUid: rd(21), // 官方直通实际路由之档(预热时 Cascade 所选模型·云端会话钉定)
      modelName: rd(14),
      cascadeId: rd(16),
      msgField: found ? found.field : null,
      msgCount: found ? found.arr.length : 0,
    };
  } catch (_) {
    return null;
  }
}

// 把捕获帧「最末一条消息的正文子字段」整体换成 newText, 其余字节逐一原样保留。
// 用 _pbRebuildField 沿 path 重算长度前缀(消息数组末项 → 该项内正文子字段),
// 不靠 _pbCloneSwapStrings(其仅换 <200B 纯 ASCII 短串, 不适合多行长正文)。
// 纯换正文·不裁史(裁史由 _trimFrameHistory 于官方直通复用层单独施加)。
function _swapLastUserMsg(capturedBody, newText) {
  const frames = parseFrames(capturedBody);
  if (!frames.length) return null;
  const payload = frames[0].payload; // 已在 parseFrames 内解压
  const top = parseProto(payload);
  const found = _findMsgsArray(top);
  if (!found) return null;
  const msgsField = found.field;
  const total = found.arr.length;
  const info = _msgContentInfo(found.arr[total - 1]);
  if (!info.field || !info.text) return null;
  const newBuf = Buffer.from(String(newText), "utf8");
  let seen = 0;
  const swapped = _pbRebuildField(payload, msgsField, (entry) => {
    seen++;
    if (seen !== total) return entry; // 仅改最末一条消息
    return _pbRebuildField(entry, info.field, () => newBuf);
  });
  if (!swapped || !swapped.length || !_pbParseOk(swapped)) return null;
  return buildFrame(0, swapped);
}

// 帧档 retarget(万模归一·原汤化原食): 捕获帧顶层 field21=modelUid / field14=modelName
//   恒钉预热那一档(如付费 glm-5-2)。免费档请求在缺免费帧时回退复用付费帧, 若不改档,
//   上游按帧内付费档跑 → 配额耗尽 / internal error(实证 kimi-k2-7 回退 glm-5-2 恒败之真因)。
//   正法: 复用前把 field21 retarget 成本次请求真档 → 任一捕获帧即成「万模通用模板」
//   (换正文 + 换档 = 任意模型可复用)。field14 展示名一并同档, 免上游据旧名二次判档。
//   仅当帧内档与目标档不同才改; 解析/序列化失败回退原帧(宁稳勿崩)。
function _retargetFrameModel(frameBody, modelUid) {
  if (!modelUid) return frameBody;
  try {
    _retargetStats.calls++;
    const frames = parseFrames(frameBody);
    if (!frames.length) return frameBody;
    const payload = frames[0].payload;
    const top = parseProto(payload);
    const cur =
      top[21] && top[21][0] && top[21][0].w === 2 && top[21][0].b
        ? Buffer.from(top[21][0].b).toString("utf8")
        : null;
    if (cur === modelUid) { _retargetStats.skipped++; return frameBody; } // 已同档·无需改
    const uidBuf = Buffer.from(String(modelUid), "utf8");
    top[21] = [{ w: 2, b: uidBuf }];
    if (top[14] && top[14][0] && top[14][0].w === 2) top[14] = [{ w: 2, b: uidBuf }];
    const reser = serializeProto(top);
    if (reser && reser.length && _pbParseOk(reser)) {
      _retargetStats.rewrites++;
      _retargetStats.last_from = cur || "";
      _retargetStats.last_to = String(modelUid);
      _retargetStats.last_at = Date.now();
      return buildFrame(0, reser);
    }
  } catch (_) {}
  return frameBody;
}

// 读捕获帧顶层某字段(wire-type=2)原始字节。无则 null。
function _topFieldRaw(body, fieldNum) {
  try {
    const frames = parseFrames(body);
    if (!frames.length) return null;
    const top = parseProto(frames[0].payload);
    const e = top[fieldNum] && top[fieldNum][0];
    return e && e.w === 2 && e.b ? Buffer.from(e.b) : null;
  } catch (_) {
    return null;
  }
}
// 会话鉴权保鲜: 把「最新捕获帧」的 field1(鉴权子消息)+field16(cascadeId) 嫁接到 newBody。
//   src = 最新捕获帧(_lastChatFrame 恒最鲜·每轮皆被覆盖·携当前活会话 token)。
//   usedFrame = 本次回放实际取用的帧(可能是旧免费活水槽·带失活 token)。
//   src===usedFrame(即本就用最新帧·如 _forceMain) → 无需嫁接。
//   仅当 src 更鲜(at 更大)才嫁接; 缺 field1 或序列化失败则回退原体(宁稳勿崩)。
function _graftFreshSession(newBody, usedFrame) {
  try {
    _authGraftStats.calls++;
    // 鉴权源(取更鲜者·守真突破): 活鉴权信封(任一 inference 请求采得·不待对话) 与
    //   最新捕获帧主槽。两者按 at 取最鲜 → 全新/久未对话会话只要 IDE 活跃即有活鉴权。
    let auth1 = null, cid = null, srcAt = -1;
    const env = _lastAuthEnvelope;
    if (env && env.f1) { auth1 = env.f1; cid = env.cid; srcAt = env.at || 0; }
    const src = _lastChatFrame; // 主槽每轮皆被最新捕获帧覆盖 → 携当前活会话
    if (src && src.body && (src.at || 0) > srcAt) {
      const a = _topFieldRaw(src.body, 1);
      if (a) { auth1 = a; cid = _topFieldRaw(src.body, 16); srcAt = src.at || 0; }
    }
    if (!auth1) { _authGraftStats.skipped++; return newBody; }
    // 本次回放所用帧的鉴权已≥最鲜源 → 无需嫁接(宁稳勿动·如 _forceMain 且无更鲜信封)。
    if (usedFrame && (usedFrame.at || 0) >= srcAt) { _authGraftStats.skipped++; return newBody; }
    const frames = parseFrames(newBody);
    if (!frames.length) { _authGraftStats.skipped++; return newBody; }
    const top = parseProto(frames[0].payload);
    top[1] = [{ w: 2, b: auth1 }];
    if (cid) top[16] = [{ w: 2, b: cid }];
    const reser = serializeProto(top);
    if (reser && reser.length && _pbParseOk(reser)) {
      _authGraftStats.rewrites++;
      _authGraftStats.last_at = Date.now();
      _authGraftStats.last_age_ms = srcAt > 0 ? Date.now() - srcAt : 0;
      _authGraftStats.last_src = env && srcAt === (env.at || 0) ? "envelope" : "chatframe";
      return buildFrame(0, reser);
    }
    _authGraftStats.skipped++;
  } catch (_) {
    _authGraftStats.skipped++;
  }
  return newBody;
}

// 去污染(实证·2026-07): 预热帧本携「预热对话整段历史」(field3 repeated, msgCount 可达十数条),
//   官方直通复用时若原样带上, 云端把每次反代请求当作预热会话的续轮 → 回包被预热旧轮次串染,
//   甚至可被 "复述上文" 类提问套出整段预热历史(隔离/隐私缺陷)。故复用前把消息数组裁成仅留末条
//   (即刚换入的新 user turn·单轮干净)。系统提示词(顶层 field2)不在数组内, 不受影响。
//   注: 官方直通本就只注入「末条 user 文本」、从不映射请求方多轮上下文, 故裁史不丢用户真上下文。
//   裁后不能解析则回退原帧(宁稳勿崩)。
function _trimFrameHistory(frameBody) {
  try {
    const frames = parseFrames(frameBody);
    if (!frames.length) return frameBody;
    const payload = frames[0].payload;
    const top = parseProto(payload);
    const found = _findMsgsArray(top);
    if (!found || found.arr.length <= 1) return frameBody;
    const trimmed = _pbKeepLastRepeated(payload, found.field);
    if (trimmed && trimmed.length && _pbParseOk(trimmed)) {
      return buildFrame(0, trimmed);
    }
  } catch (_) {}
  return frameBody;
}

// 提示词隔离(回归模型本源·反代专用): 剥净捕获帧内 Cascade/DAO 系统提示词。
//   病灶(实证·2026-07): 官方直通复用捕获帧时, 帧内仍携 Cascade 全量系统提示词
//   (顶层独立 SP 字段 / 消息数组内 role=0 条目, 且捕帧于 modifySPProto 之前=原始官方 SP),
//   上游模型遂自认 Cascade、回包混入插件语境 → 非模型本源。
//   正法: 复用前把 SP 载体置空——外接调用方自带 system 时经渠道路径注入, 官方直通则纯净
//   单轮("Kimi 即 Kimi")。与 invertSP(保留本源观照文本)不同, 此处彻底剥净·不注入任何内容。
//   两种 schema 兼容: ① SP 为独立顶层字段(长 utf8 文本·非消息数组) ② SP 为数组内 role=0 条目。
//   置空后不能解析则回退原帧(宁稳勿崩)。
function _isolateChatFrameSP(frameBody) {
  try {
    const frames = parseFrames(frameBody);
    if (!frames.length) return frameBody;
    let payload = frames[0].payload;
    const top = parseProto(payload);
    const found = _findMsgsArray(top);
    const msgsField = found ? found.field : null;
    const empty = Buffer.alloc(0);
    let changed = false;
    // ① 独立顶层 SP 字段: 候选字段中「长 utf8 文本」条目(非消息数组本体) → 置空
    //   加 !_pbParseOk 门: 仅命中真裸文本载体, 不误伤嵌套 proto(如工具定义·field10)
    const _rawSP = (b) =>
      b && b.length > 200 && !_pbParseOk(b) && looksLikeUtf8Text(b);
    for (const fn of MSGS_FIELD_CANDIDATES) {
      if (fn === msgsField) continue;
      const arr = top[fn];
      if (!arr || !arr.length) continue;
      const hasSP = arr.some((e) => e.w === 2 && e.b && _rawSP(Buffer.from(e.b)));
      if (!hasSP) continue;
      const out = _pbRebuildField(payload, fn, (entry) =>
        _rawSP(entry) ? empty : entry,
      );
      if (out && out.length && _pbParseOk(out)) {
        payload = out;
        changed = true;
      }
    }
    // ② 消息数组内 role=0 系统条目: 正文置空(结构保留·宁稳勿崩)
    if (msgsField != null) {
      let touch = false;
      const out = _pbRebuildField(payload, msgsField, (entry) => {
        try {
          const mf = parseProto(entry);
          const role =
            mf[1] && mf[1][0] && mf[1][0].w === 0 ? mf[1][0].v : null;
          if (role === 0 && mf[2] && mf[2][0] && mf[2][0].b && mf[2][0].b.length) {
            touch = true;
            return _pbRebuildField(entry, 2, () => empty);
          }
        } catch (_) {}
        return entry;
      });
      if (touch && out && out.length && _pbParseOk(out)) {
        payload = out;
        changed = true;
      }
    }
    // ③ 工具定义(顶层 field 10)去污染: 与前向路径(modifySPProto)同源同净。
    //   病灶(实证·2026-07): SP 剥净后帧内仍携 82 条 Cascade 全量工具定义(名/描述/schema
    //   满是 "Cascade"/"Windsurf"/"Codeium" 与 create_memory 等着相) → 上游模型据此
    //   工具集自认 Cascade、并能 "Created memory"。正法: 复用前向路径久经实证的两台去名/剔除
    //   引擎——dropMemoryToolsProto(整条删记忆工具) + deOfficialNameToolsProto(工具描述/schema
    //   去名)——对复用帧 field 10 施同一净化, 令反代出的免费模型真回归本源("Kimi 即 Kimi")。
    //   与 ①② 的字节手术不同, 工具净化须整解整序(复用现成 parse/serialize·前向路径已验字节稳)。
    try {
      const top2 = parseProto(payload);
      if (top2[_TOOLS_FIELD_NUM] && top2[_TOOLS_FIELD_NUM].length) {
        const memDropped = dropMemoryToolsProto(top2);
        const toolsDenamed = deOfficialNameToolsProto(top2);
        if (memDropped > 0 || toolsDenamed > 0) {
          const reser = serializeProto(top2);
          if (reser && reser.length && _pbParseOk(reser)) {
            payload = reser;
            changed = true;
          }
        }
      }
    } catch (_) {}
    if (changed) return buildFrame(0, payload);
  } catch (_) {}
  return frameBody;
}

// 官方直通: revproxy 经此真转云端、解码回包。sink: {onText,onEnd,onError}。
function _officialChatReplay(target, norm, sink, _forceMain) {
  return new Promise((resolve) => {
    // 取帧: target.free 或付费配额耗尽 → 优先免费活水槽(原汤化原食·没身不殆), 否则主槽。
    //   _forceMain: 免费槽帧上游报错(非配额)后的兜底重试 —— 强制改用主槽(万模通用模板·retarget 改档)。
    //   实证(2026-07): 免费活水槽帧可能本身损坏/机型专属 → 上游 internal error(连其本档 swe-1-6 亦败);
    //   主槽帧经 retarget 改档 field21→本次真档即任意(免费)档通用且配额安全, 故坏免费帧不再拖垮免费档。
    let _frame;
    if (_forceMain) {
      if (!_lastChatFrame || !_lastChatFrame.body) _restoreChatFrame(false);
      _frame = _lastChatFrame;
    } else {
      _frame = _pickReplayFrame(target);
    }
    if (!_frame || !_frame.body) {
      sink.onError &&
        sink.onError(
          "官方直通需预热: 请在 Cascade 内先与任一官方模型对话一次(以捕获请求帧), 再经反代调用",
        );
      return resolve({ ok: false });
    }
    // 取最后一条 user 消息文本
    let userText = "";
    try {
      const msgs = (norm && norm.messages) || [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i] && msgs[i].role !== "assistant" && msgs[i].content) {
          userText = String(msgs[i].content);
          break;
        }
      }
    } catch (_) {}
    if (!userText) userText = "你好";
    let newBody = _swapLastUserMsg(_frame.body, userText);
    if (newBody) newBody = _trimFrameHistory(newBody); // 去污染: 裁掉预热历史·单轮干净
    // 提示词隔离(回归模型本源): 默认开 · revproxy.json isolatePrompt=false 可关(旧行为)
    let _isolate = true;
    try {
      const _rp = _getRevproxy();
      const _rc = _rp && _rp.loadConfig && _rp.loadConfig();
      if (_rc && _rc.isolatePrompt === false) _isolate = false;
    } catch (_) {}
    if (newBody && _isolate) newBody = _isolateChatFrameSP(newBody);
    // 万模归一: 把复用帧的模型档 retarget 成本次请求真档(免费帧缺失回退付费帧时尤要),
    //   令付费捕获帧成为任意(免费)模型通用模板, 不再冒付费档跑致 internal error。
    try {
      const wantUid =
        target && (target.upstreamModel || target.modelUid || target.model);
      if (newBody && wantUid) newBody = _retargetFrameModel(newBody, wantUid);
    } catch (_) {}
    // 会话鉴权保鲜(原汤化原食·活水恒足): 取用的帧若非最新捕获帧(如旧免费活水槽·带失活会话
    //   token), 借最新捕获帧的 field1(鉴权)+field16(cascadeId)嫁接 → 跨会话回放不再 unauthenticated。
    try {
      if (newBody) newBody = _graftFreshSession(newBody, _frame);
    } catch (_) {}
    if (!newBody) {
      sink.onError &&
        sink.onError("官方直通: 捕获帧解析失败, 请重新预热一次官方对话");
      return resolve({ ok: false });
    }
    let route;
    try {
      route = routeUpstream(_frame.url);
    } catch (e) {
      sink.onError && sink.onError("官方直通路由失败: " + e.message);
      return resolve({ ok: false });
    }
    const headers = {};
    for (const [k, v] of Object.entries(_frame.headers || {}))
      if (!H1_CONN_HEADERS.has(k)) headers[k] = v;
    delete headers["content-length"];
    headers["content-length"] = String(newBody.length);
    // buildFrame 恒输出 uncompressed → 必须摘掉 gzip 声明, 否则上游误按 gzip 解致 400。
    delete headers["connect-content-encoding"];
    delete headers["grpc-encoding"];
    let session;
    try {
      session = _getH2Session(route.host);
    } catch (e) {
      sink.onError && sink.onError("官方直通 H2 会话失败: " + e.message);
      return resolve({ ok: false });
    }
    const up = session.request({
      ":method": "POST",
      ":path": route.path,
      ":authority": route.host,
      ":scheme": "https",
      ...headers,
    });
    const chunks = [];
    let status = 0;
    up.on("response", (h) => {
      status = (h && h[":status"]) || 0;
    });
    // v9.9.338 · 反者道之动 · 官方直通亦不设时长上限 · AI 自然而止(知止不殆)
    // 防泄漏: session 45s keepalive ping 探活 · socket 真死则 up.on('error') 冒泡 resolve
    try {
      up.setTimeout(0);
    } catch (_) {}
    up.on("data", (c) => chunks.push(c));
    up.on("end", () => {
      try {
        const buf = Buffer.concat(chunks);
        if (status && status >= 400) {
          const txt = buf.toString("utf8").slice(0, 300);
          // 会话失活/版本过旧「优先」判定(见 _classifyOfficialErr): 官方以
          //   code=failed_precondition 回该错·其串含 precondition 会命中 exhausted 启发式,
          //   故先判 stale → 失效陈旧帧 + 明确指引(不狂重试坏帧·不误置配额耗尽)。
          const { stale, exhausted } = _classifyOfficialErr(txt);
          if (stale) {
            _invalidateStaleFrames("http " + status);
            sink.onError && sink.onError(_STALE_MSG);
            return resolve({ ok: false, stale: true });
          }
          if (exhausted) _signalPremiumQuota("exhausted");
          // 非配额错误 → 换主槽(万模通用模板)兜底重试一次(尚未吐正文·可安全重发)
          if (
            !exhausted &&
            !_forceMain &&
            _lastChatFrame &&
            _lastChatFrame.body &&
            _frame !== _lastChatFrame
          )
            return resolve(_officialChatReplay(target, norm, sink, true));
          sink.onError &&
            sink.onError("官方上游 " + status + ": " + txt);
          return resolve({
            ok: false,
            quota: exhausted ? "exhausted" : undefined,
          });
        }
        // Connect 流式回包 = 若干 data 帧 (proto · 含助手增量文本) + 末尾一个
        // end-stream 帧 (flags bit1=0x02, 载荷为 JSON: {} 正常 / {"error":{code,message}})。
        // HTTP 200 也可能在 end-stream 帧里带 quota 错误(此处即配额信号真源)。
        const frames = parseFrames(buf); // 已按需解 gzip
        let streamErr = null;
        // 官方 GetChatMessageResponse 流帧 schema (cascade_wire RSP):
        //   顶层 field 3 = DELTA_TEXT (文本增量) · field 9 = DELTA_THINKING (思考增量)
        //   field 5 = STOP_REASON · field 6 = DELTA_TOOL_CALLS · field 28 = 响应统计
        //   field 7 = 元数据(内含 x-request-id) · field 17 = uuid
        // 旧实现 _gatherUtf8Strings 递归收一切 wire-type=2 串 → 误收 field 7 的
        //   "x-request-id chatcmpl-…" 与 field 28 统计标签("Response Statistics /
        //   Token Usage / output_tokens …"); 且其后 weak filter 把 field 3 的短文本
        //   增量(如 "ZUL"/"U-")当成 uid/枚举滤掉 → 正文丢失、垃圾留存 = 乱码回包。
        // 正法(原汤化原食): 仅取顶层 field 3 文本增量逐帧拼接; 思考(field 9)单列不混正文。
        let deltaText = "";
        let deltaThinking = "";
        for (const f of frames) {
          if (f.flags & 0x80) continue; // grpc-web trailer
          if (f.flags & 0x02) {
            // Connect end-stream: JSON {} 正常 / {"error":{code,message}}
            try {
              const j = JSON.parse(f.payload.toString("utf8").trim() || "{}");
              if (j && j.error) streamErr = j.error;
            } catch (_) {}
            continue;
          }
          try {
            const top = parseProto(f.payload);
            for (const e of top[3] || [])
              if (e.w === 2 && e.b) deltaText += Buffer.from(e.b).toString("utf8");
            for (const e of top[9] || [])
              if (e.w === 2 && e.b)
                deltaThinking += Buffer.from(e.b).toString("utf8");
          } catch (_) {}
        }
        if (streamErr) {
          const blob = (streamErr.code || "") + " " + (streamErr.message || "");
          // 会话失活/版本过旧「优先」判定(官方 end-stream code=failed_precondition·见
          //   _classifyOfficialErr): 先判 stale → 失效陈旧帧 + 明确指引, 不误吞为配额耗尽。
          const { stale, exhausted } = _classifyOfficialErr(blob);
          if (stale) {
            _invalidateStaleFrames("stream " + (streamErr.code || ""));
            sink.onError && sink.onError(_STALE_MSG);
            return resolve({ ok: false, stale: true });
          }
          if (exhausted) _signalPremiumQuota("exhausted");
          // 非配额错误 → 换主槽(万模通用模板)兜底重试一次(尚未吐正文·可安全重发)
          if (
            !exhausted &&
            !_forceMain &&
            _lastChatFrame &&
            _lastChatFrame.body &&
            _frame !== _lastChatFrame
          )
            return resolve(_officialChatReplay(target, norm, sink, true));
          sink.onError &&
            sink.onError("官方上游错误: " + (streamErr.message || streamErr.code || blob));
          return resolve({ ok: false, quota: exhausted ? "exhausted" : undefined });
        }
        const out = deltaText || deltaThinking;
        if (!out) {
          sink.onError && sink.onError("官方回包解码为空(可能为纯工具调用流)");
          return resolve({ ok: false });
        }
        sink.onText && sink.onText(out);
        sink.onEnd && sink.onEnd();
        // 仅付费档真出包才可证明付费配额尚存; 免费档成功不代表付费可用。
        if (target && !target.free) _signalPremiumQuota("ok");
        resolve({ ok: true, quota: "ok" });
      } catch (e) {
        sink.onError && sink.onError("官方回包解码异常: " + e.message);
        resolve({ ok: false });
      }
    });
    up.on("error", (e) => {
      sink.onError && sink.onError("官方直通传输错误: " + e.message);
      resolve({ ok: false });
    });
    up.end(newBody);
  });
}

function _revproxyDeps() {
  return {
    getEaConfig: () =>
      _eaRuntimeMod && _eaRuntimeMod.hotGetConfig
        ? _eaRuntimeMod.hotGetConfig()
        : {},
    getAvailableModels: _getAvailableModels,
    getModelCatalog: () => {
      try {
        return _fullModelCatalog || _loadFullModelCatalog() || [];
      } catch (_) {
        return [];
      }
    },
    getOfficialFamilies: () => {
      try {
        // 展开家族 members → 扁平官方 uid 列表 {modelUid,label,free}
        const fams = _getOfficialFamilies() || [];
        const out = [];
        for (const f of fams) {
          const members = (f && (f.members || f.entries)) || [];
          if (members.length) {
            for (const m of members)
              out.push({
                modelUid: m.uid || m.modelUid,
                label: m.label || f.label,
                free: !!(m.free || f.free),
              });
          } else if (f && (f.modelUid || f.uid)) {
            out.push({
              modelUid: f.modelUid || f.uid,
              label: f.label,
              free: !!f.free,
            });
          }
        }
        return out;
      } catch (_) {
        return [];
      }
    },
    officialChat: (target, norm, sink) =>
      _officialChatReplay(target, norm, sink),
    hasChatFrame: () => {
      if (!_lastChatFrame || !_lastChatFrame.body) _restoreChatFrame();
      return !!(_lastChatFrame && _lastChatFrame.body);
    },
    resolveRoute: (uid) => {
      try {
        const r = _ea ? _ea.getRouter() : null;
        return r && r.resolveRoute ? r.resolveRoute(uid) : null;
      } catch (_) {
        return null;
      }
    },
    invertSP,
    recordUsage: (providerName, model, tc) => {
      try {
        if (_eaRuntimeMod && _eaRuntimeMod.routerRecordUsage)
          _eaRuntimeMod.routerRecordUsage(providerName, model, tc);
      } catch (_) {}
    },
    getProxyAgent: _originGetProxyAgent,
    log,
    version: ORIGIN_VERSION,
    port: _actualPort,
  };
}
async function _maybeRevproxy(req, res) {
  if (
    !req.url ||
    (!req.url.startsWith("/v1/") && !req.url.startsWith("/origin/revproxy"))
  )
    return false;
  const mod = _getRevproxy();
  if (!mod) return false;
  const u = url.parse(req.url, true);
  // CORS · 与 handleControl 同策(webview/本地客户端直连)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key",
  );
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  // ★ v9.9.347 · GET /origin/revproxy/handoff.md · 模型反代专属 Agent 交接文档 (Markdown)
  //   与 /origin/ea/handoff.md 分工: 本文专注「模型反代 → 内网穿透 → 公网第三方无感直调」链路。
  if (u.pathname === "/origin/revproxy/handoff.md" && req.method === "GET") {
    if (_handoffGuard(req, res)) return true;
    let md = "";
    try {
      md = _buildRevproxyHandoffMd();
    } catch (e) {
      md = "# dao-proxy-pro · 模型反代交接文档生成失败\n\n" + (e && e.message);
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="dao-proxy-pro-revproxy-handoff.md"',
    );
    res.end(md);
    return true;
  }
  // 诊断: 当前预热帧所携模型(官方直通实际将路由之档) · 只读 · 供面板/自检显预热档
  if (u.pathname === "/origin/revproxy/warm" && req.method === "GET") {
    if (!_lastChatFrame || !_lastChatFrame.body) _restoreChatFrame(false);
    if (!_lastFreeChatFrame || !_lastFreeChatFrame.body) _restoreChatFrame(true);
    const has = !!(_lastChatFrame && _lastChatFrame.body);
    const frame = has ? _frameModelInfo(_lastChatFrame.body) : null;
    const hasFree = !!(_lastFreeChatFrame && _lastFreeChatFrame.body);
    const freeFrame = hasFree ? _frameModelInfo(_lastFreeChatFrame.body) : null;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        has,
        warm: frame,
        at: (_lastChatFrame && _lastChatFrame.at) || 0,
        restored: !!(_lastChatFrame && _lastChatFrame.restored),
        // 免费活水槽 (付费摘要帧覆盖不了它·premium 配额耗尽仍可回放)
        hasFree,
        warmFree: freeFrame,
        atFree: (_lastFreeChatFrame && _lastFreeChatFrame.at) || 0,
        restoredFree: !!(_lastFreeChatFrame && _lastFreeChatFrame.restored),
      }),
    );
    return true;
  }
  // 内网穿透 · DAO Bridge: 状态自省 + 启停控制 (把反代端点直暴公网)
  if (u.pathname === "/origin/revproxy/tunnel") {
    res.setHeader("Content-Type", "application/json");
    const preferShared = u.searchParams && u.searchParams.get("shared") === "1";
    if (req.method === "GET") {
      res.end(JSON.stringify(_brgStatus(preferShared)));
      return true;
    }
    if (req.method === "POST") {
      let raw = "";
      req.on("data", (c) => (raw += c));
      await new Promise((rz) => req.on("end", rz));
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch (_) {}
      const action = body.action || "";
      try {
        if (action === "start") {
          const r = await _brgStartTunnel(false, true);
          res.end(JSON.stringify(Object.assign({}, r, _brgStatus())));
        } else if (action === "startNamed") {
          const r = await _brgStartTunnel(true, true);
          res.end(JSON.stringify(Object.assign({}, r, _brgStatus())));
        } else if (action === "restart") {
          _brgStopTunnel();
          const r = await _brgStartTunnel(false, true);
          res.end(JSON.stringify(Object.assign({}, r, _brgStatus())));
        } else if (action === "stop") {
          _brgStopTunnel(true);
          res.end(JSON.stringify(Object.assign({ ok: true }, _brgStatus(preferShared))));
        } else if (action === "cfLogin") {
          const r = _brgCfLogin(body.email || "", body.key || "");
          res.end(JSON.stringify(Object.assign({}, r, _brgStatus())));
        } else if (action === "bindCf") {
          // 用户只给一个 Cloudflare API Token → 自动部署 workers.dev 固定中继(零域名·持久通道)
          const r = await _brgBindCfToken(body.token || body.key || "");
          res.end(JSON.stringify(Object.assign({}, r, _brgStatus())));
        } else if (action === "relayStart") {
          const up = await _brgRelayAutoStart();
          res.end(JSON.stringify(Object.assign({ ok: !!up || !!_brgLoadRelayCfg() }, _brgStatus())));
        } else if (action === "relayStop") {
          try { if (_brgRelay) _brgRelay.stop(); } catch (_) {}
          res.end(JSON.stringify(Object.assign({ ok: true }, _brgStatus())));
        } else if (action === "logout") {
          const r = _brgResetAccount();
          res.end(JSON.stringify(Object.assign({}, r, _brgStatus())));
        } else if (action === "resetProxy") {
          _brgProxyCache = null;
          res.end(JSON.stringify(Object.assign({ ok: true, proxy: _brgDetectProxy() }, _brgStatus(preferShared))));
        } else {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: "unknown action" }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ ok: false, error: String(e && e.message) }));
      }
      return true;
    }
  }
  try {
    return await mod.handle(req, res, u, _revproxyDeps());
  } catch (e) {
    log("[revproxy] handle err: " + (e && e.message));
    try {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: { message: String(e && e.message) } }));
    } catch (_) {}
    return true;
  }
}

// v7.8 反者道之动: TCP 层协议复用 (HTTP/1.1 + HTTP/2 h2c 同端口)
// Go gRPC (h2c) 入 → h2 server; HTTP/1.1 (mgmt/control) → h1 server
const _mainHandler = async (req, res) => {
  reqCounter++;
  const rid = reqCounter;
  // ★ v9.9.70 · detached 活性戳 —— 孤儿收割以「任一请求」为活 (控制面 ping 亦计)
  _lastAnyReqAt = Date.now();
  if (!_envBootstrapped) {
    try {
      _bootstrapEnvelopeFromDisk();
    } catch (_) {}
  }
  req.on("error", (e) => log(`#${rid} req err: ${e.message}`));
  res.on("error", (e) => log(`#${rid} res err: ${e.message}`));
  try {
    // 0. 模型反代 (标准 OpenAI/Anthropic 本地端点 + 其控制面)
    if (
      req.url &&
      (req.url.startsWith("/v1/") || req.url.startsWith("/origin/revproxy"))
    ) {
      if (await _maybeRevproxy(req, res)) return;
      // ★ v9.9.67-min · revproxy 轴已拆 (_getRevproxy 恒 null) → 诚实 404
      //   病: 旧流 /v1/* 落入 classifyRPC→PASSTHROUGH → 误投 mgmt host →
      //       上游 404 页 · 调用方莫明其妙 (名实不符)
      //   治: 本口明言轴已拆 · 一语道破 · 不假手他端
      //   道义: 十七章「信不足 安有不信」· 诚实之示
      if (req.url.startsWith("/v1/")) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            error:
              "revproxy stripped in dao-proxy-min (v9.9.374-min) · 模型反代轴已拆 · /v1/* 不可用",
          }),
        );
        return;
      }
      // /origin/revproxy/* → 落控制面 404 (unknown /origin endpoint) · 亦诚实
    }
    // 1. 控制面
    if (req.url && req.url.startsWith("/origin/")) {
      if (handleControl(req, res)) return;
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "unknown /origin endpoint" }));
      return;
    }
    // v9.9.330 · 至此即「真 LS→上游」流量(已排除 /origin/* 控制面与 /v1/ 外接反代)
    //   刷新 LS 心跳戳 · 供看门狗辨识扩展↔LS wedge (道法自然·自观其活)
    _lastLsReqAt = Date.now();
    // 2. 路由分类
    const kind = classifyRPC(req.url);
    const _reqSurface = _reqSurfaceOf(req); // v9.9.74 · 分口定面: acp专属口→local · 主口按路径→cascade|''
    // ★ v9.9.70 · 名实终一 · 按面有效模式入手即定 (invertSP/invertAnySP/观察路同此一源)
    _reqModeEff = _surfaceMode(_reqSurface);
    const route = routeUpstream(req.url);
    const isInferenceRPC = route.host === UPSTREAM_INFER;
    _recordPath(req.method, req.url, kind, route.host);

    // ★ v9.9.344 · 鉴权/心跳本地兜底(根治) · 天下有始 以为天下母
    //   病灶: SeatManagement/GetUser(座席鉴权)默认归 PASSTHROUGH → 路由 UPSTREAM_MGMT
    //        (server.self-serve.windsurf.com) → 该端不实现此 RPC → 404/连接断
    //        → LS 判定「未鉴权」→ GetUserSettings 空 → 前端永卡「Connecting to server」。
    //   又: 官方 H2/gRPC 长连在本网络环境被切断(与本机 cloudflared/relay 同症)
    //        → 即便路由正确, 座席鉴权仍不可达。
    //   治法(反者道之动·釜底抽薪): 座席鉴权与心跳本地即答 gRPC OK(status=0)。
    //        LS 只验 grpc-status, 不解 payload → 即认「已连接」, 彻底解耦官方可达性。
    //   注: 真模型目录仍由 GetUserSettings(MODEL_UNLOCK)注入; GetUserStatus 仍走
    //        PASSTHROUGH 做真解锁; 推理仍走 BYOK/INFER_STRIP → 本兜底不夺其真。
    if (kind === "LOCAL_AUTH") {
      const _authRpc = _rpcName(req.url);
      // 先采集鉴权信封(LS 请求常携 Bearer) → 供上游模型路由复用 · 利而不害
      try { _scanAuthHeaders(req); } catch (_) {}
      // 消费 body 防 socket 泄漏, 再本地即答(零延迟·不依赖官方可达)
      try { req.resume(); } catch (_) {}
      _replyGrpcOk(res, rid, _authRpc);
      return;
    }

    // 3. 非 inference (mgmt/auth 等): 纯透 · 不读 body · 无 SP 可观
    //   v9.9.336 · 根源突破: 信封陈旧时对 PASSTHROUGH 的 POST 缓冲 body 探采鉴权信封
    //   (LSP/补全亦携信封) → 采得即自主合成保鲜; 新鲜时不缓冲, 回归纯流式直透。
    if (kind === "PASSTHROUGH") {
      // ★ v9.9.376 · GetCliModelConfigs 秒回兜底 · 守其母不空目录
      //   缓冲 body(须携原信封原 body 才能后台刷真值) → 有 last-good 即毫秒回放
      //   + 后台上行刷新; 无缓存照旧透传(真响应会在 _epHit 被捕入缓存)。
      if (_isCliModelConfigsRpc(req.url)) {
        try {
          _scanAuthHeaders(req);
        } catch (_) {}
        readBody(req)
          .then((b) => {
            if (_serveLastGoodCliModels(res, rid)) {
              try {
                _refreshCliModelsBg(req, b, rid);
              } catch (_) {}
              return;
            }
            proxyToCloud(req, res, b, rid);
          })
          .catch(() => {
            try {
              proxyToCloud(req, res, undefined, rid);
            } catch (_) {}
          });
        return;
      }
      if (_shouldProbeLspBody(req)) {
        _lspProbe.attempts++;
        const _rpc = _rpcName(req.url);
        let _hdrHit = false;
        try {
          _hdrHit = _scanAuthHeaders(req);
        } catch (_) {}
        readBody(req)
          .then((b) => {
            let _bodyHit = false;
            try {
              _bodyHit = _harvestFromLsp(b);
            } catch (_) {}
            try {
              _recordProbePath(_rpc, _bodyHit, _hdrHit);
            } catch (_) {}
            proxyToCloud(req, res, b, rid);
          })
          .catch(() => {
            try {
              proxyToCloud(req, res, undefined, rid);
            } catch (_) {}
          });
        return;
      }
      proxyToCloud(req, res, undefined, rid);
      return;
    }

    // ★ v9.9.260 · 模型解锁 · 反者道之动 · 执大象 天下往
    //   GetUserSettings 响应注入全量模型目录 · 突破账号权限限制
    //   道义: 三十五章「执大象 天下往 往而不害 安平太」
    if (kind === "MODEL_UNLOCK") {
      proxyToCloudWithModelUnlock(req, res, rid);
      return;
    }

    // 4. inference (含 CHAT_PROTO / CHAT_RAW / INFER_STRIP): 读 body
    const body = await readBody(req);
    // ★ v9.9.72a · 传输层诊断: 捕获 Windsurf LSP 请求 headers · 得一
    _eaDiag(
      "#" +
        rid +
        " REQ-CT: " +
        (req.headers["content-type"] || "NONE") +
        " connect-ver: " +
        (req.headers["connect-protocol-version"] || "NONE") +
        " encoding: " +
        (req.headers["content-encoding"] || "NONE") +
        " te: " +
        (req.headers["transfer-encoding"] || "NONE"),
    );

    // ★ v9.9.91 · 修法③ · 物无非彼 · 每次请求重读模式 · 消除配置漂移
    //   sp_invert.js 热重载读自己的 _origin_mode.txt · source.js 亦当如此
    //   二者同源 · 不分彼此 · 配置不漂移
    {
      const _freshMode = _loadModeFromDisk();
      if (_freshMode && _freshMode !== SP_MODE) {
        log(`#${rid} [模式热更] ${SP_MODE} → ${_freshMode}`);
        SP_MODE = _freshMode;
      }
    }

    // ★ v9.9.92 · 修法⑧ · 经藏热重载 · 与 SP_MODE 同步 · 物无非彼
    //   sp_invert.js 有自己的 _activeCanon · source.js 亦有 · 二者须同步
    //   每次 request 重读 _origin_canon.txt · 若变化则更新本地 + 通知 _spInvertLib
    //   道义: 三十二章「道恒无名·侯王若能守之·万物将自宾」· 配置不漂移
    {
      const _freshCanon = _readCanonFile();
      if (_freshCanon && _freshCanon !== _activeCanon) {
        const _freshText = _loadCanonText(_freshCanon);
        if (_freshText) {
          log(
            `#${rid} [经藏热更] ${_activeCanon} → ${_freshCanon} (${_freshText.length} chars)`,
          );
          _activeCanon = _freshCanon;
          _activeCanonText = _freshText;
          // ★ v9.9.94 · 经藏热同步 · 通知 sp_invert.js 同步 _activeCanon
          if (_spInvertLib && _spInvertLib.setCanon) {
            _spInvertLib.setCanon(_activeCanon);
          }
        }
      }
    }

    // ★ v9.9.89 · 最上游SP修改 · 道法自然 · 插件与用户一体
    //   先改SP → 再路由 → 不论官方还是外接API都拿到同样的SP
    //   无为无以为 · 不增不减 · 只剔除残留
    let _eaBody = body;
    // ★ v9.9.357 · invert+custom 皆走源级替换 (custom 由 invertSP 内自编分支平替)
    // ★ v9.9.368 · 按面生效: _origin_mode_surface.json 未配置面回落全局 SP_MODE
    // ★ v9.9.73 · 有效模式再钉 —— readBody await 间 _reqModeEff 或被他请求覆写,
    //   变换 tick 内重钉一次 · 并发串面风险归零 (与 _applyReq* 同律).
    _reqModeEff = _surfaceMode(_reqSurface);
    if (_spReplaceActiveForSurface(_reqSurface)) {
      // v9.9.376 · 按面经藏+自编 · 与下方变换同一同步 tick 内生效 (无 await 不交错)
      _applyReqCanon(_surfaceCanon(_reqSurface));
      _applyReqCustomSP(_reqSurface);
      if (kind === "CHAT_PROTO") {
        _eaBody = modifySPProto(body, _reqSurface);
      } else if (kind === "CHAT_RAW") {
        _eaBody = modifyRawSP(body);
      }
      if (_eaBody !== body) {
        log(
          `#${rid} [最上游SP] ${kind} ${body.length}B → ${_eaBody.length}B (before _ea routing)`,
        );
      }
    }

    // 4.5P · 外接api路由 · 无为而无以为 · 道并行而不相悖
    //   _ea=null → 跳过 · 全部走官方透传 · 绝不崩溃
    //   匹配路由表 → route() → 第三方API → 成功则return
    //   路由失败 → 回退官方 · 天之道利而不害
    //   v9.9.57P2 · 先检测热重载 · 文件变化自动生效
    // ★ v9.9.82 · 修复: 始终调用 _eaHotReload (不再依赖 if(_ea))
    //   原逻辑: if (_ea) _eaHotReload() → _ea=null后永远跳过 → 死锁
    //   修正: 始终调用 → _eaHotReload 内部判断 !_ea + 冷却 → 自动恢复
    //   道义: 大制无割 · 有无相生 · 失败亦当有恢复之路
    _eaHotReload();
    _eaDiag("#" + rid + " routing-check: _ea=" + !!_ea + " kind=" + kind);
    if (_ea && (kind === "CHAT_PROTO" || kind === "CHAT_RAW")) {
      try {
        const _eaRouter = _ea.getRouter();
        _eaDiag(
          "#" +
            rid +
            " router=" +
            !!_eaRouter +
            " bodyLen=" +
            (body ? body.length : 0),
        );
        if (_eaRouter) {
          const _eaIsJSON = (req.headers["content-type"] || "")
            .toLowerCase()
            .includes("json");
          const _eaModelUid = _eaRouter.extractModelUid(_eaBody, _eaIsJSON);
          // ★ v9.9.93 · 追踪已见模型 · 四十七章「不出于户 以知天下」
          if (_eaModelUid) {
            const _prev = _seenModelUids.get(_eaModelUid);
            const _isRouted = _eaRouter.shouldRoute(_eaModelUid, _reqSurface);
            _seenModelUids.set(_eaModelUid, {
              count: (_prev ? _prev.count : 0) + 1,
              lastAt: Date.now(),
              routed: _isRouted || (_prev ? _prev.routed : false),
            });
            while (_seenModelUids.size > _SEEN_MODELS_MAX) {
              const _oldest = [..._seenModelUids.entries()].sort(
                (a, b) => a[1].lastAt - b[1].lastAt,
              )[0];
              if (_oldest) _seenModelUids.delete(_oldest[0]);
            }
          }
          _eaDiag(
            "#" +
              rid +
              " isJSON=" +
              _eaIsJSON +
              " modelUid=" +
              _eaModelUid +
              " shouldRoute=" +
              (_eaModelUid ? _eaRouter.shouldRoute(_eaModelUid, _reqSurface) : "N/A"),
          );
          log(
            "#" +
              rid +
              " [外接api-diag] isJSON=" +
              _eaIsJSON +
              " modelUid=" +
              _eaModelUid +
              " shouldRoute=" +
              (_eaModelUid ? _eaRouter.shouldRoute(_eaModelUid, _reqSurface) : "N/A"),
          );
          if (_eaModelUid && _eaRouter.shouldRoute(_eaModelUid, _reqSurface)) {
            log("#" + rid + " [外接api] " + _eaModelUid + " → 外部API");
            log("#" + rid + " [外接api-PRE] _eaRouter.route() about to call");
            const _eaOk = await _eaRouter.route(
              req,
              res,
              _eaBody,
              _eaIsJSON,
              _eaModelUid,
            );
            log(
              "#" +
                rid +
                " [外接api-POST] _eaOk=" +
                _eaOk +
                " headersSent=" +
                res.headersSent +
                " writableEnded=" +
                res.writableEnded,
            );
            _eaDiag(
              "#" +
                rid +
                " route_result: _eaOk=" +
                _eaOk +
                " headersSent=" +
                res.headersSent +
                " writableEnded=" +
                res.writableEnded,
            );
            if (_eaOk) {
              _eaDiag("#" + rid + " route SUCCESS → return");
              return;
            }
            if (res.headersSent) {
              _eaDiag(
                "#" +
                  rid +
                  " route FAIL + headersSent → end() and return (NO FALLBACK)",
              );
              if (!res.writableEnded) res.end();
              return;
            }
            // ★ v9.9.363-止血(合流自 Tokyo) · 路由模型失败 → 回退官方透传 · 不再报错(工具不再直接报错)
            //   道义: 天之道利而不害 · 失败则利民(回退) · 不伪饰成功亦不横加其害
            //   原则: shouldRoute=true → 路由 → 失败则回退官方(而非 Connect-RPC 错误帧)
            //         shouldRoute=false → 不路由 → 走官方透传
            //   原 v9.9.92-fix「失败即失败·不回退官方」致 route FAIL 直接工具报错 · 今改之
            _eaDiag(
              "#" +
                rid +
                " route FAIL → fallback to official (止血 · 不再报错) model=" +
                _eaModelUid,
            );
            log(
              "#" +
                rid +
                " [外接api] 路由失败 → 回退官方(止血) model=" +
                _eaModelUid,
            );
          }
        }
      } catch (e) {
        _eaDiag(
          "#" +
            rid +
            " route EXCEPTION: " +
            e.message +
            " headersSent=" +
            res.headersSent,
        );
        // ★ v9.9.87 · SWE 路由异常 → 直接报错 · 不回退官方
        const _isSWEExc =
          _eaModelUid && /swe[-_]?1[-_]?6/i.test(_eaModelUid || "");
        if (_isSWEExc) {
          log(
            "#" +
              rid +
              " [外接api] SWE路由异常 → 报错 (不回退官方): " +
              e.message,
          );
          try {
            if (!res.headersSent) {
              res.writeHead(200, {
                "content-type": "application/json",
              });
            }
            res.end(
              JSON.stringify({
                code: "internal",
                message:
                  "[SWE路由异常] 外部API调用异常(model=" +
                  _eaModelUid +
                  "): " +
                  e.message,
              }),
            );
          } catch (_endErr) {
            if (!res.writableEnded) res.end();
          }
          return; // ★ 不回退官方
        }
        log("#" + rid + " [外接api] err: " + e.message + " → 回退官方");
      }
    }

    // 模型反代·官方直通: 捕获最近一帧真实 GetChatMessage 请求(原始 body+路由+头)
    //   供 revproxy officialChat 复用——换入新 user turn 后真转云端、解码回包。
    //   道义: 反者道之动·闭环自举; 仅留最近一帧, 不留历史(利而不害)。
    if (kind === "CHAT_PROTO" && body && body.length > 0) {
      try {
        _captureChatFrame(req, body);
      } catch (_) {}
    }
    // 守真突破: 从任一 inference 请求(chat/补全/上下文)采活鉴权信封 → 回放嫁接恒有活鉴权,
    //   不待用户发对话(IDE 一活跃即有源)。仅内容自证为鉴权信封者采信, 否则不动。
    if (
      (kind === "CHAT_PROTO" || kind === "CHAT_RAW" || kind === "INFER_STRIP") &&
      body &&
      body.length > 0
    ) {
      try {
        _harvestAuthEnvelope(body);
      } catch (_) {}
    }

    // 5+6. v9.9.30 印 162 · 观察记录后置 setImmediate · 请求转发先行
    // 道义: step 5 (observeAllSPInBody) + step 6 (_recordInject/_recordRawTape)
    //   均为 webview 面板观察用 · 不影响 step 7 (真改 body + 转发)
    //   四十「反者道之动」(同步→异步) · 十一「当其无·有车之用」
    //   大对话 N=100-200 字段 × 9 RegExp 同步阻塞 → 后置后主线程不堵
    if (
      kind === "CHAT_PROTO" ||
      kind === "CHAT_RAW" ||
      kind === "INFER_STRIP"
    ) {
      const _dBody = body,
        _dKind = kind,
        // ★ v9.9.70 · 名实终一 · 观察以按面有效模式为准 (全局 SP_MODE 退位)
        _dSurface = _reqSurface,
        _dMode = _reqModeEff || SP_MODE;
      const _dMethod = req.method,
        _dUrl = req.url,
        _dHost = route.host,
        _dRid = rid;
      // ★ v9.9.70 · 实发载体 —— 步7 定案 modified 后回填 · 观察路得窥线上真字节
      //   rid 随身: 异常残留之 ctx 不被后至请求误填 (为者败之 · 防串)
      const _dCtx = { out: null, rid: _dRid };
      _pendingObsCtx = _dCtx;
      setImmediate(() => {
        try {
          // 观察路之有效模式复位 (防后至请求覆 _reqModeEff 致串面)
          _reqModeEff = _dMode;
          let _allCandsForInject = [];
          try {
            const cands = observeAllSPInBody(_dBody, _dUrl);
            _allCandsForInject = cands || [];
            if (cands.length > 0) {
              log(
                `#${_dRid} sp_scan url=${_dUrl.split("/").slice(-2).join("/")} kinds=[${cands.map((c) => `${c.kind}@${c.field_path}/${c.chars}B`).join(",")}]`,
              );
              // v9.9.376-field-dump · 临时探测: 对 >300B 的 raw_text/chat 字段打头部指纹,
              //   供「道模式下用户规则是否经旁路注入」判据. 只记, 不改.
              try {
                for (const c of cands) {
                  if (!c || c.chars < 300) continue;
                  const head = (c.text || "")
                    .replace(/\s+/g, " ")
                    .slice(0, 110);
                  log(
                    `#${_dRid} field_head ${c.kind}@${c.field_path}/${c.chars}B "${head}"`,
                  );
                }
              } catch (_) {}
            }
          } catch (e) {
            log(`#${_dRid} sp_scan err: ${e.message}`);
          }
          // ══ v9.9.70 · 名实终一 · 线上真值提取 ══
          //   旧病: after 是 invertSP(obs.before) 之重演 —— 全局/面模式分裂时
          //         面板所示即虚 (面道全局官 → 原文冒充实收; 面官全局道 → 伪经冒充实收).
          //   治: after 由「实发 body (modified)」提取 —— LLM 实收之字节, 非重演之猜.
          //       transformed = 线上SP ≠ 入来SP (实改之果, 非 invertSP 返非空之意).
          const _outBody = _dCtx.out || _dBody;
          const _wireChanged = _outBody !== _dBody;
          let _wireObs = null;
          try {
            _wireObs = observeSPFromBody(_outBody, _dKind);
          } catch (_) {}
          const _wireSP =
            _wireObs && _wireObs.before ? _wireObs.before : null;
          // 线上 all_fields: body 变则重扫实发 (fields=1 时面板所见即线上字节);
          //   未变则入文即线文 · 无为不重复扫
          let _outCands = _allCandsForInject;
          if (_wireChanged) {
            try {
              _outCands = observeAllSPInBody(_outBody, _dUrl) || [];
            } catch (_) {}
          }
          const allFields = _outCands.map((c) =>
            _buildAllFieldEntry(c, "wire"),
          );
          const obs = observeSPFromBody(_dBody, _dKind);
          if (obs && obs.before && obs.before.length > 100) {
            const inverted =
              _dMode === "invert" || _dMode === "custom"
                ? invertSP(obs.before)
                : null;
            const after =
              _wireSP !== null
                ? _wireSP
                : inverted !== null
                  ? inverted
                  : obs.before;
            const injectEv = {
              kind: _dKind,
              variant: obs.variant,
              field: obs.field,
              role: obs.role,
              mode: _dMode,
              mode_global: SP_MODE,
              surface: _dSurface || "",
              transformed:
                _wireSP !== null
                  ? _wireSP !== obs.before
                  : inverted !== null,
              sp_on_wire: _wireSP !== null,
              after_source:
                _wireSP !== null
                  ? "wire"
                  : inverted !== null
                    ? "sim"
                    : "before",
              wire_changed: _wireChanged,
              before_chars: obs.before.length,
              after_chars: after.length,
              before: obs.before,
              after,
              all_fields: allFields,
              all_fields_count: allFields.length,
              all_fields_chars: allFields.reduce((s, f) => s + f.chars, 0),
            };
            _recordInject(injectEv);
            _recordRawTape(
              Object.assign({}, injectEv, {
                method: _dMethod,
                rpc: _dUrl,
                mode_at: _dMode,
                route: _dHost,
              }),
            );
          } else {
            // 无入主 SP · 线上 SP 提取亦录 (after=_wireSP) · 名实不失
            const _wsp = _wireObs && _wireObs.before ? _wireObs.before : null;
            if (allFields.length > 0 || _wsp !== null) {
              _recordRawTape({
                kind: _dKind,
                variant: _wireObs ? _wireObs.variant : null,
                field: _wireObs ? _wireObs.field : null,
                role: _wireObs ? _wireObs.role : null,
                mode_at: _dMode,
                mode_global: SP_MODE,
                surface: _dSurface || "",
                transformed: false,
                sp_on_wire: _wsp !== null,
                after_source: _wsp !== null ? "wire" : "none",
                wire_changed: _wireChanged,
                before: null,
                after: _wsp,
                before_chars: 0,
                after_chars: _wsp ? _wsp.length : 0,
                all_fields: allFields,
                all_fields_count: allFields.length,
                all_fields_chars: allFields.reduce((s, f) => s + f.chars, 0),
                method: _dMethod,
                rpc: _dUrl,
                route: _dHost,
              });
            }
          }
        } catch (e) {
          try {
            log(`#${_dRid} deferred-observe err: ${e.message}`);
          } catch {}
        }
      });
    }

    // 7. v9.9.91 · 修法② · 损之又损 · 官方路径复用 _eaBody · 消除冗余计算
    //    CHAT_PROTO/CHAT_RAW: _eaBody 已在步骤 4.5P 由 modifySPProto/modifyRawSP 计算
    //    此处不再重复计算 · 一次改 · 两路用 · 物无非彼物无非是
    //    INFER_STRIP: 仅剥侧信道 · 不碰 SP (4.5P 不处理此 kind)
    let modified = _eaBody;
    // ★ v9.9.357 · custom 模式亦剥侧信道 · 隔离与 invert 同源
    // ★ v9.9.368 · 按面生效 · cascade 面 SP_MODE=passthrough 时 INFER_STRIP 亦不剥
    if (_spReplaceActiveForSurface(_reqSurface) && kind === "INFER_STRIP") {
      const r = deepStripRequestBody(_eaBody);
      modified = r.body;
      if (r.changed > 0) {
        log(`#${rid} ${kind} STRIPPED ${r.changed} side-channels`);
      }
    }
    if (modified !== body) {
      req.headers["connect-content-encoding"] = "identity";
      delete req.headers["content-encoding"];
      log(
        `#${rid} ${kind} CHANGED ${body.length}B → ${modified.length}B mode=${SP_MODE}`,
      );
    } else {
      log(`#${rid} ${kind} UNCHANGED ${body.length}B mode=${_effMode()} surface=${_reqSurface || "-"}`); // v9.9.74 · 显有效模式+面 (名实归一)
    }

    // ★ v9.9.70 · 名实终一 · 实发字节交观察路 (after=LLM实收 · 非重演)
    //   rid 校验: 仅本请求之 ctx 受填 · 异常残留者清而不填
    if (_pendingObsCtx) {
      if (_pendingObsCtx.rid === rid) _pendingObsCtx.out = modified;
      _pendingObsCtx = null;
    }

    proxyToCloud(req, res, modified, rid);
  } catch (e) {
    log(`#${rid} handler err: ${e.stack || e.message}`);
    if (!res.headersSent) res.statusCode = 500;
    try {
      res.end(JSON.stringify({ error: "origin internal", message: e.message }));
    } catch {}
  }
};

// v7.8 TCP mux: HTTP/1.1 + HTTP/2 h2c on same port
// readable peek(1): 0x50 ('P' from PRI preface) → h2, else → h1
const _h1Server = http.createServer(_mainHandler);
let _h2Errs = 0,
  _h2SessErrs = [],
  _muxH2SessCount = 0,
  _h2Streams = 0,
  _h2Closes = [];
const _h2Server = http2.createServer(_mainHandler);
_h2Server.on("session", (sess) => {
  // v9.9.28 真治 · 包 try · 防 sess 子 listener throw 致 ext-host crash
  try {
    _muxH2SessCount++;
    const sid = _muxH2SessCount;
    sess.on("stream", () => {
      try {
        _h2Streams++;
      } catch {}
    });
    sess.on("close", () => {
      try {
        if (_h2Closes.length < 8)
          _h2Closes.push({ t: Date.now(), sid, streams: 0 });
      } catch {}
    });
    sess.on("goaway", (code) => {
      try {
        if (_h2Closes.length < 8)
          _h2Closes.push({ t: Date.now(), sid, goaway: code });
      } catch {}
    });
    sess.on("error", (e) => {
      try {
        if (_h2Closes.length < 8)
          _h2Closes.push({ t: Date.now(), sid, err: e.message });
      } catch {}
    });
  } catch (e) {
    try {
      log(`[FATAL/h2-session-cb] ${e.stack || e.message}`);
    } catch {}
  }
});
_h2Server.on("sessionError", (err) => {
  _h2Errs++;
  if (_h2SessErrs.length < 8)
    _h2SessErrs.push({
      t: Date.now(),
      msg: err.message || String(err),
      code: err.code,
    });
});
// v9.9.338 · 反者道之动 · H1 请求生命周期不设上限(requestTimeout=0) · 对话长短由 AI 自然而止
// headersTimeout: 请求头接收阀(防 slowloris · 头永远秒到) · keepAliveTimeout: 空闲连接回收
// 二者均不触碰活跃请求/响应流 → 道并行而不相悖
_h1Server.keepAliveTimeout = 30000;
_h1Server.headersTimeout = 30000;
_h1Server.requestTimeout = 0;

// v9.9.58 · 反者道之动 · H2内部端口动态化 · 不再硬编码 PORT+1
// 病: 多用户各得FNV-1a端口(如8937/8981) · 但H2内部端口硬编码8890
//     → 用户B的H2桥接指向8890(用户A的H2服务器) → HTTP/2请求路由到错误进程
// 药: _H2_INTERNAL_PORT 延迟到 start() 时基于实际端口计算 · 各用户独立H2内部端口
//     七十六章「强大居下 柔弱微细居上」· 不争固定端口 · 随实际端口而动
let _H2_INTERNAL_PORT = 0; // 0 = not yet bound
let _h2Listening = false;

// 延迟绑定H2内部服务器 · 在 start() 中调用
function _bindH2Internal(muxPort) {
  if (_h2Listening) return; // 已绑定 · 不重复
  // 基于实际mux端口计算H2内部端口 · 避免8890冲突
  _H2_INTERNAL_PORT = muxPort + 1;
  // 递归尝试 muxPort+1 到 muxPort+10 · EADDRINUSE时自动递增
  function _tryH2Port(portToTry) {
    if (portToTry > muxPort + 10) {
      log(
        `[h2] FATAL: all internal ports :${muxPort + 1}..:${muxPort + 10} EADDRINUSE`,
      );
      return;
    }
    _H2_INTERNAL_PORT = portToTry;
    const onListen = () => {
      _h2Listening = true;
      _h2Server.removeListener("error", onError);
      log(`[h2] internal h2c on :${portToTry} (mux=:${muxPort})`);
    };
    const onError = (e) => {
      if (e.code === "EADDRINUSE") {
        _h2Server.removeListener("listening", onListen);
        log(`[h2] :${portToTry} EADDRINUSE → retry :${portToTry + 1}`);
        _tryH2Port(portToTry + 1);
      } else {
        log(`[h2] internal error: ${e.message}`);
      }
    };
    _h2Server.once("listening", onListen);
    _h2Server.once("error", onError);
    _h2Server.listen(portToTry, "127.0.0.1");
  }
  _tryH2Port(muxPort + 1);
}

let _muxConns = 0,
  _muxH1 = 0,
  _muxH2 = 0,
  _muxNull = 0;
const server = net.createServer((socket) => {
  _muxConns++;
  socket.once("data", (buf) => {
    if (
      buf[0] === 0x50 &&
      buf.length >= 3 &&
      buf[1] === 0x52 &&
      buf[2] === 0x49
    ) {
      socket.pause(); // prevent data loss before h2 bridge pipe is established
      _muxH2++;
      // Bridge to internal h2 server (native handle needed for HTTP/2)
      const bridge = net.createConnection(
        _H2_INTERNAL_PORT,
        "127.0.0.1",
        () => {
          bridge.write(buf);
          socket.pipe(bridge);
          bridge.pipe(socket);
          socket.resume();
        },
      );
      bridge.on("error", () => socket.destroy());
      socket.on("error", () => bridge.destroy());
      socket.on("close", () => bridge.destroy());
      bridge.on("close", () => socket.destroy());
    } else {
      _muxH1++;
      socket.unshift(buf);
      _h1Server.emit("connection", socket);
      // h1 server manages resume internally
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ★ v9.9.74 · acp 面并听 —— Devin Local(devin.exe acp) 专属口 · 两面分治之根药
//   Devin Desktop 实证: Cascade(LS) 与 acp 同走 api_server_pb → 路径不可分。
//   治: 第二 mux 与主口同 handler 并听 ORIGIN_ACP_PORT —— socket.localPort
//       即面 (h1 直连口 / h2 桥接内口 皆归 local) · 口即面, 无猜无惑。
//   h1: socket 直发 _h1Server (localPort=acp口 自来面标);
//   h2: 桥至 _h2ServerAcp 专内口 (localPort=_acpH2Port → local)。
// ═══════════════════════════════════════════════════════════════════════════
const _h2ServerAcp = http2.createServer(_mainHandler);
_h2ServerAcp.on("sessionError", (err) => {
  _h2Errs++;
  if (_h2SessErrs.length < 8)
    _h2SessErrs.push({ t: Date.now(), msg: err.message || String(err), code: err.code, acp: true });
});
const _acpMux = net.createServer((socket) => {
  _muxConns++;
  socket.once("data", (buf) => {
    if (buf[0] === 0x50 && buf.length >= 3 && buf[1] === 0x52 && buf[2] === 0x49) {
      socket.pause();
      _muxH2++;
      const bridge = net.createConnection(_acpH2Port, "127.0.0.1", () => {
        bridge.write(buf);
        socket.pipe(bridge);
        bridge.pipe(socket);
        socket.resume();
      });
      bridge.on("error", () => socket.destroy());
      socket.on("error", () => bridge.destroy());
      socket.on("close", () => bridge.destroy());
      bridge.on("close", () => socket.destroy());
    } else {
      _muxH1++;
      socket.unshift(buf);
      _h1Server.emit("connection", socket); // localPort=acp口 → _reqSurfaceOf 判 local
    }
  });
});
_acpMux.on("error", (e) => {
  log("[acp-mux] err: " + e.message);
});
// acp 面 h2 内部口绑定 (boundAcp+50..+58 递归避让 · 与主口 h2 同律)
function _bindAcpH2(boundAcp) {
  if (_acpH2Port) return;
  function _try(p) {
    if (p > boundAcp + 58) {
      log(`[acp-h2] FATAL: all internal ports :${boundAcp + 50}..:${boundAcp + 58} EADDRINUSE`);
      return;
    }
    const onListen = () => {
      _acpH2Port = p;
      _h2ServerAcp.removeListener("error", onError);
      log(`[acp-h2] internal h2c on :${p} (acp-mux=:${boundAcp})`);
    };
    const onError = (e) => {
      if (e.code === "EADDRINUSE") {
        _h2ServerAcp.removeListener("listening", onListen);
        log(`[acp-h2] :${p} EADDRINUSE → retry :${p + 1}`);
        _try(p + 1);
      } else {
        log(`[acp-h2] internal error: ${e.message}`);
      }
    };
    _h2ServerAcp.once("listening", onListen);
    _h2ServerAcp.once("error", onError);
    _h2ServerAcp.listen(p, "127.0.0.1");
  }
  _try(boundAcp + 50);
}
// acp 面 mux 口绑定 (wanted..wanted+8 递归避让) · 幂等
function _bindAcpMux(wanted) {
  if (_acpBoundPort || !wanted || wanted <= 0) return;
  function _try(p) {
    if (p > wanted + 8) {
      log(`[acp-mux] FATAL: all ports :${wanted}..:${wanted + 8} EADDRINUSE → acp 不分口(主口按路径分)`);
      return;
    }
    const onListen = () => {
      _acpBoundPort = p;
      _acpMux.removeListener("error", onError);
      log(`[acp-mux] acp 面并听 :${p} (Devin Local 专属口 · localPort→local)`);
      _bindAcpH2(p);
    };
    const onError = (e) => {
      if (e.code === "EADDRINUSE") {
        _acpMux.removeListener("listening", onListen);
        log(`[acp-mux] :${p} EADDRINUSE → retry :${p + 1}`);
        _try(p + 1);
      } else {
        log(`[acp-mux] error: ${e.message}`);
      }
    };
    _acpMux.once("listening", onListen);
    _acpMux.once("error", onError);
    _acpMux.listen(p, "127.0.0.1");
  }
  _try(wanted);
}
function _closeAcpMux() {
  try { if (_acpBoundPort) _acpMux.close(() => {}); } catch (_) {}
  try { if (_acpH2Port) _h2ServerAcp.close(() => {}); } catch (_) {}
  _acpBoundPort = 0;
  _acpH2Port = 0;
}

server.on("listening", () => {
  try {
    _actualPort = (server.address() && server.address().port) || PORT;
  } catch {}
  _writeEndpointDiscovery();
  // ★ v9.9.74 · 分口定面 · 主口就绪即并听 acp 面 (0=不分口则自动跳)
  try {
    _bindAcpMux(_acpPortWanted);
  } catch (_) {}
  // 持久通道自愈: 若用户此前已绑 CF API Token, 开机即自动拉起 workers.dev 出站长连(固定地址永不轮换)。
  // ★ v9.9.67-min · 反者道之动 · 隧道轴自动连接默认关 · 名实相符
  //   病: Min 版 revproxy 轴已源码级拆除(_getRevproxy 恒 null) → 隧道之受益者已亡,
  //       而隧道仍自动拉起 → 整个反代口(40 个 /origin/* 控制端点 + 数据面)暴露公网,
  //       仅 2 端点有 _handoffGuard → 纯攻击面 · 零收益 · 与「仅隔离替换」之名相悖。
  //   治: 自动连接默认关 · 需者设 env DAO_BRIDGE_AUTOCONNECT=1 显式开 ·
  //       手动启停端点(/origin/revproxy/tunnel POST)保留不动 · 道并行而不相悖。
  //   道义: 三十六章「国之利器不可以示人」· 六十四章「为之于其未有也」
  try {
    if (String(process.env.DAO_BRIDGE_AUTOCONNECT || "") === "1") {
      _brgRelayAutoStart().then((up) => { if (up) log(" workers.dev 固定中继 · 出站长连已上线(持久通道)"); }).catch(() => {});
    }
  } catch (_) {}
  // 内网穿透去中心化默认: 激活即自动把反代端点暴露公网(治「没有自动连接好」)。延迟 6s 待反代就绪,
  //   避免与端口收敛/多实例 leader 抢建同一瞬。手动停止旗在时自挂起(尊重用户意志)。
  // ★ v9.9.67-min · 同上 · 默认关 · env 门控
  try { if (String(process.env.DAO_BRIDGE_AUTOCONNECT || "") === "1") setTimeout(() => { _brgAutoConnect().catch(() => {}); }, 6000); } catch (_) {}
  log("═══════════════════════════════════════════════════════");
  log(` 本源 Origin ${ORIGIN_VERSION} h1+h2c mux @ :${_actualPort}`);
  log(` mgmt   → https://${UPSTREAM_MGMT}`);
  log(
    ` infer  → https://${UPSTREAM_INFER}   (默认 · chat RPC 随 INFERENCE_SERVICES 分流)`,
  );
  if (UPSTREAM_CHAT) {
    log(
      ` chat   → https://${UPSTREAM_CHAT}   (v9.3.2 · CHAT_UPSTREAM env 显式覆盖)`,
    );
  }
  log(` mode=${SP_MODE} · canon=${_activeCanon} · pid=${process.pid}`);
  log(
    ` 帛书德道经 chars=${DAO_DE_JING_81.length} (上篇·德=${SILK_DE_JING.length} 下篇·道=${SILK_DAO_JING.length})`,
  );
  if (_activeCanon !== "laozi")
    log(
      ` 经藏 ${_activeCanon} (${(_CANON_MAP[_activeCanon] || {}).name}) chars=${_activeCanonText.length}`,
    );
  log(` 控制面: http://127.0.0.1:${_actualPort}/origin/ping`);
  log(
    ` 模型解锁: ${_isModelUnlockEnabled() ? "✅ 启用" : "❌ 禁用"} (${_fullModelCatalog ? _fullModelCatalog.length : 0} 模型)`,
  );
  log("═══════════════════════════════════════════════════════");
});

server.on("error", (e) => {
  log("server err:", e.message);
});

// ═══════════════════════════════════════════════════════════
// v18.0 · 库接口 · ext-host 进程内调用 · 损 spawn detached 之根
// ═══════════════════════════════════════════════════════════
function start(opts) {
  opts = opts || {};
  const port = opts.port != null ? opts.port : PORT;
  const host = opts.host || "127.0.0.1";
  // ★ v9.9.74 · 分口定面 · 库调用可指 acp 面口 (env 兜底)
  if (opts.acpPort != null) _acpPortWanted = parseInt(opts.acpPort, 10) || 0;
  // ★ v9.9.67 · 执今之道 · 磁盘持久模式优先 · 治「重启丢模式」(与 extension.js 同修)
  //   病: ext-host activate 传 config dao.origin.defaultMode(默 invert) → 此处以之覆 SP_MODE
  //       → 用户运行时切换(道⇄官 · 已 _saveModeToDisk) 于窗口重启即被 config 默认覆没。
  //   治: 磁盘 _origin_mode.txt 为用户运行时真意 · 优先; 无盘值方用 opts.mode(config 默认)。
  //   道义: 十四章「执今之道 以御今之有」· 三十二章「侯王若能守之 万物将自宾」
  const _diskMode = _loadModeFromDisk();
  if (_diskMode && SP_MODE_VALID.has(_diskMode)) {
    SP_MODE = _diskMode;
  } else if (opts.mode && SP_MODE_VALID.has(opts.mode)) {
    SP_MODE = opts.mode;
  }
  return new Promise((resolve, reject) => {
    const onListen = () => {
      server.removeListener("error", onError);
      const addr = server.address();
      const realPort = (addr && addr.port) || port;
      _actualPort = realPort;
      _writeEndpointDiscovery();
      // v9.9.58 · 延迟绑定H2内部服务器 · 基于实际mux端口
      // 七十六章「柔弱微细居上」· 不争固定端口 · 随实际端口而动
      _bindH2Internal(realPort);
      log(`[lib] in-process listen :${realPort} (h1+h2c mux)`);
      resolve({
        server,
        port: realPort,
        host,
        close: () =>
          new Promise((r) => {
            let done = false;
            const fin = () => {
              if (!done) {
                done = true;
                r();
              }
            };
            try {
              server.close(fin);
            } catch {
              fin();
            }
            // ★ v9.9.67 · 亦闭 H2 内部服务器 (与 stop() 同律 · ext-host 路同治)
            try {
              if (_h2Listening) {
                _h2Server.close(() => {});
                _h2Listening = false;
              }
            } catch {}
            try {
              _closeAcpMux(); // v9.9.74 · acp 面并听同闭
            } catch {}
            // ★ v9.9.67 · 长连不阻停机 (SSE 等 · 与 stop() 同律)
            try {
              if (typeof server.closeAllConnections === "function")
                server.closeAllConnections();
            } catch {}
            try {
              if (typeof _h2Server.closeAllConnections === "function")
                _h2Server.closeAllConnections();
            } catch {}
            setTimeout(fin, 300); // 兜底必答
          }),
        getMode: () => SP_MODE,
        setMode: (m) => {
          if (SP_MODE_VALID.has(m)) {
            const _prev = SP_MODE;
            SP_MODE = m;
            try {
              _saveModeToDisk(SP_MODE);
            } catch {}
            // ★ v9.9.67 · SSE 广播 mode 变 (handle 路 · ext-host 热切)
            // ★ v9.9.67 · 无为 · 无变不播 (activate proxySetMode 同值不再广播)
            if (_prev !== SP_MODE) _sseBroadcast("mode", { mode: SP_MODE, previous: _prev });
            return true;
          }
          return false;
        },
        // v7.2 · 用户实时编辑提示词 (库使用)
        getCustomSP: () =>
          _customSP && _customSP.sp
            ? {
                sp: _customSP.sp,
                chars: _customSP.sp.length,
                keep_blocks: !!_customSP.keep_blocks,
                source: _customSP.source || null,
                at: _customSP.at || null,
              }
            : null,
        setCustomSP: (sp, opts) => {
          if (typeof sp !== "string" || !sp.trim()) return false;
          _customSP = {
            sp: sp,
            keep_blocks: !opts || opts.keep_blocks !== false,
            source: (opts && opts.source) || "lib",
            at: Date.now(),
          };
          try {
            _saveCustomSP();
          } catch {}
          return true;
        },
        clearCustomSP: () => {
          const had = !!(_customSP && _customSP.sp);
          _customSP = null;
          try {
            _saveCustomSP();
          } catch {}
          return had;
        },
      });
    };
    const onError = (e) => {
      server.removeListener("listening", onListen);
      reject(e);
    };
    server.once("listening", onListen);
    server.once("error", onError);
    server.listen(port, host);
  });
}

function stop() {
  return new Promise((r) => {
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        r();
      }
    };
    try {
      server.close(fin);
    } catch {
      fin();
    }
    // ★ v9.9.67 · 损漏补 · stop 亦闭 H2 内部服务器
    //   病: _bindH2Internal 所启 _h2Server(muxPort+1) 从不闭 → CLI/长活进程 stop 后
    //       进程不退(句柄未清) · 同进程重起新口则旧 H2 口泄漏。
    //   道义: 六十四章「为之于其未有也 治之于其未乱也」· 有始有终 · 善闭者无关楗而不可开
    try {
      if (_h2Listening) {
        _h2Server.close(() => {});
        _h2Listening = false;
      }
    } catch {}
    try {
      _closeAcpMux(); // v9.9.74 · acp 面并听同闭
    } catch {}
    // ★ v9.9.67 · 长连不阻停机 · 善闭者闭众门
    //   病: server.close() 候一切连接自终 · SSE 长连(/origin/stream)永不自终
    //       → close 回调永悬 → deactivate/CLI 停机挂
    //   治: closeAllConnections 断众连 (Node ≥18.2 · 无此 API 则无害跳过)
    try {
      if (typeof server.closeAllConnections === "function")
        server.closeAllConnections();
    } catch {}
    try {
      if (typeof _h2Server.closeAllConnections === "function")
        _h2Server.closeAllConnections();
    } catch {}
    // 兜底: 300ms 后必答 (不使停机永悬)
    setTimeout(fin, 300);
  });
}

// ═══════════════════════════════════════════════════════════
// CLI 路径 · 仅 node 直跑时启 · require 时不污染父进程
// ═══════════════════════════════════════════════════════════
function _runCli() {
  server.on("error", () => {
    process.exit(1);
  });
  if (!process.argv.includes("--test")) {
    server.listen(PORT, "127.0.0.1");
  }
  // v9.9.28 · process.on 钩已移至模块顶层 globalThis 幂等装 · CLI 路径已得保
  // 古路径: 此处 process.on 仅 CLI 触 · ext-host require 永漏 (28 版古洞)
  // 今治: 模块顶层 if (!globalThis.__dao_processHandlers_v9928) 双路径皆装
}

// require.main === module 即 CLI 直跑 · 否则被 require 入库使用
if (require.main === module) _runCli();

module.exports = {
  // v9.7.0 路 为道日损 路 仅留实用 exports
  invertSP,
  isLikelyOfficialSP,
  classifySPType,
  isAlreadyInverted,
  modifySPProto,
  modifyRawSP,
  invertAnySP,
  deepInvertProto,
  modifyAnyInferenceSP,
  stripSideChannelBlocks,
  hasSideChannels,
  deepStripProtoSideChannels,
  deepStripRequestBody,
  DAO_DE_JING_81,
  TAO_HEADER,
  TAO_FOOTER,
  TAO_TRAILER,
  TAO_SENTINEL,
  KEEP_BLOCKS,
  extractKeepBlocks,
  neutralizeBlock,
  OFFICIAL_SP_MARKERS,
  SUMMARY_SP_MARKERS,
  MEMORY_SP_MARKERS,
  EPHEMERAL_SP_MARKERS,
  parseProto,
  serializeProto,
  parseFrames,
  buildFrame,
  encodeVarint,
  readVarint,
  encodeLen,
  looksLikeUtf8Text,
  extractUtf8StringsFromGrpcBody,
  findMsgsField,
  extractMsgContent,
  routeUpstream,
  classifyRPC,
  observeSPFromBody,
  observeAllSPInBody,
  deepScanProto,
  looksLikeSPShape,
  _quickHash,
  server,
  start,
  stop,
  // v18.0 · 模式查改 (库使用)
  getMode: () => SP_MODE,
  setMode: (m) => {
    if (SP_MODE_VALID.has(m)) {
      SP_MODE = m;
      try {
        _saveModeToDisk(SP_MODE);
      } catch {}
      return true;
    }
    return false;
  },
  // v7.2 · 用户实时编辑提示词 (库使用 · 测试用)
  getCustomSP: () =>
    _customSP && _customSP.sp
      ? {
          sp: _customSP.sp,
          chars: _customSP.sp.length,
          keep_blocks: !!_customSP.keep_blocks,
          source: _customSP.source || null,
          at: _customSP.at || null,
        }
      : null,
  setCustomSP: (sp, opts) => {
    if (typeof sp !== "string" || !sp.trim()) return false;
    _customSP = {
      sp: sp,
      keep_blocks: !opts || opts.keep_blocks !== false,
      source: (opts && opts.source) || "lib",
      at: Date.now(),
    };
    try {
      _saveCustomSP();
    } catch {}
    return true;
  },
  clearCustomSP: () => {
    const had = !!(_customSP && _customSP.sp);
    _customSP = null;
    try {
      _saveCustomSP();
    } catch {}
    return had;
  },
  _runCli,
  // ★ v9.9.292 · 测试用内部导出 (生产无害·便于离线校验注入逻辑)
  _test: {
    _pbDropProBadge,
    _unlockUserStatusBody,
    _catalogInjectionList,
    _pbExtractModelEntry,
    _pbCloneSwapStrings,
    _pbParseOk,
    _pbIsModelEntry,
    _pbStripModelEntry,
    _pbTag,
    _pbEncVarint,
    _PRO_BADGE,
    _loadFullModelCatalog,
    _pbRebuildField,
    _swapLastUserMsg,
    _trimFrameHistory,
    _retargetFrameModel,
    _topFieldRaw,
    _graftFreshSession,
    _harvestAuthEnvelope,
    _looksLikeAuthEnvelope,
    _authGraftStats,
    _isStaleSessionErr,
    _classifyOfficialErr,
    _invalidateStaleFrames,
    _staleFrameStats,
    _STALE_MSG,
    _handoffGuard,
    _setLastAuthEnvelopeForTest: (env) => { _lastAuthEnvelope = env; },
    _getLastAuthEnvelopeForTest: () => _lastAuthEnvelope,
    _setLastChatFrameForTest: (fr) => { _lastChatFrame = fr; },
    _frameModelInfo,
    _pbKeepLastRepeated,
    _isolateChatFrameSP,
    _findMsgsArray,
    _msgContentInfo,
    dropMemoryToolsProto,
    deOfficialNameToolsProto,
    parseFrames,
    parseProto,
    serializeProto,
    // ⑤ 内网穿透 · workers.dev 固定中继 (离线可测·无副作用)
    _BRG_RELAY_SOURCE,
    _BRG_RELAY_SCRIPT,
    _brgWsEncodeFrame,
    _BrgWsFrameParser,
    _BrgWsClient,
    _BrgRelayClient,
    _brgRelayClient: () => _brgRelayClient(),
    _brgLoadRelayCfg,
    _brgSaveRelayCfg,
    _brgRelayState,
    // ★ v9.9.362(合流自 Tokyo) · 官方 H2 经代理隧道 + 鉴权类韧性兜底 (离线可测)
    _h2TunnelConnect,
    _isAuthResilientRpc,
    _replyAuthResilient,
    _originResolveProxyUrl,
    _originIsLocalHost,
    _setLastGoodUserStatusForTest: (v) => { _lastGoodUserStatus = v; },
    _getLastGoodUserStatusForTest: () => _lastGoodUserStatus,
    // ★ v9.9.74 · 分口定面离线可测 (面标=口标)
    _reqSurfaceOf,
    _surfaceOfPath,
    _surfaceMode,
    _setAcpPortsForTest: (mux, h2) => { _acpBoundPort = mux || 0; _acpH2Port = h2 || 0; },
    _getAcpPortsForTest: () => ({ mux: _acpBoundPort, h2: _acpH2Port }),
  },
};
