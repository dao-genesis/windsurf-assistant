// _add_glm52_k27.js · 道法自然 · 把 GLM-5.2 / Kimi K2.7 并入全量源目录
//   逆流到底·解构一切: 这两枚 uid (glm-5-2 / kimi-k2-7) 是账号实见过的官方真模型
//   (IDE 本地缓存 leveldb 留有其 uid), 但 v2 静态快照最新只到 GLM-5.1 / Kimi K2.6。
//   故以同族最近版本 (glm-5-1 / kimi-k2-6) 为母本克隆, 仅升版本号 (label/uid/familyUid),
//   令反代 /v1/models 与网页对话台能列出并路由调用 — 计费档随官方上游为准 (本表仅供发现/路由)。
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '_full_model_catalog.json');
const cat = JSON.parse(fs.readFileSync(p, 'utf8'));

function cloneBump(srcUid, dstUid, dstLabel, dstFamilyUid, dstFamilyLabel) {
  const src = cat.find(m => m.modelUid === srcUid);
  if (!src) { console.log(`! 母本缺失: ${srcUid}`); return false; }
  if (cat.find(m => m.modelUid === dstUid)) { console.log(`= 已存在: ${dstUid}`); return false; }
  const m = JSON.parse(JSON.stringify(src));
  m.label = dstLabel;
  m.modelUid = dstUid;
  m.isNew = true;
  m.isRecommended = true;
  delete m.promoStatus; // 旧促销窗口不继承
  if (m.modelInfo) {
    m.modelInfo.modelUid = dstUid;
    m.modelInfo.modelFamilyUid = dstFamilyUid;
  }
  if (m.modelFamilyMetadata) m.modelFamilyMetadata.modelFamilyLabel = dstFamilyLabel;
  // 紧邻母本之后插入 (同族相邻)
  const i = cat.indexOf(src);
  cat.splice(i, 0, m);
  console.log(`+ 并入: ${dstLabel} (${dstUid}) ← 克隆自 ${srcUid} · tier=${m.modelCostTier}`);
  return true;
}

cloneBump('glm-5-1', 'glm-5-2', 'GLM-5.2', 'glm-5.2', 'GLM-5.2');
cloneBump('kimi-k2-6', 'kimi-k2-7', 'Kimi K2.7', 'kimi-k2.7', 'Kimi K2.7');

fs.writeFileSync(p, JSON.stringify(cat, null, 2), 'utf8');
console.log(`写入源目录: ${cat.length} 个模型`);
