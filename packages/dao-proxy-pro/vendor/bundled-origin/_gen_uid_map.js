// _gen_uid_map.js · 从 _full_model_catalog.json 生成 _model_uid_map.json
const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '_full_model_catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const mapping = {};
catalog.forEach(m => {
  if (m.label && m.modelUid) {
    mapping[m.label] = m.modelUid;
  }
});

const output = {
  "_说明": "v9.9.260+ · 前端label ↔ modelUid 完整映射 · 从_full_model_catalog.json自动生成",
  "_来源": "_full_model_catalog.json (108 models, disabled=false, displayOption=standard-picker)",
  "_生成时间": new Date().toISOString(),
  "mapping": mapping
};

const outPath = path.join(__dirname, '..', '外接api', 'core', '_model_uid_map.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`生成 ${Object.keys(mapping).length} 条映射 → ${outPath}`);
