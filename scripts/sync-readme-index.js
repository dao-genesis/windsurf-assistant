#!/usr/bin/env node
'use strict';

// 道法自然 · README 主页模块索引(DAO-MODULE-INDEX)自动同步
//
// 让「主页表格的版本 / Release / 下载链接」永远跟随真实发布,不再停在初始版本。
//   - 说明列(第 4 列)保留 README 里的人工文案:按 extId 定位每一行,只重写版本列与链接列。
//   - 版本来源优先级: 环境变量 DAO_INDEX_VERSIONS(JSON: {key:version},由工作流按真实 Release 注入)
//     > 该 key 的 package.json version(兜底)。确保写入 README 的 tag 一定存在,链接不 404。
//
// 用法:
//   node scripts/sync-readme-index.js            # 就地重写 README.md
//   node scripts/sync-readme-index.js --check     # 仅校验:若会变更则退出码 1(CI 护栏)
//
// 单一事实源: .github/release/readme-index.json

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, '.github/release/readme-index.json'), 'utf8'));
const README = path.join(ROOT, 'README.md');

function pkgVersion(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')).version;
  } catch (e) {
    return null;
  }
}

function versionOverrides() {
  const raw = process.env.DAO_INDEX_VERSIONS;
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (e) {
    console.warn('DAO_INDEX_VERSIONS 非合法 JSON,忽略:', e.message);
    return {};
  }
}

function resolveVersion(mod, overrides) {
  const ov = overrides[mod.key];
  if (ov && String(ov).trim()) return String(ov).trim();
  return pkgVersion(mod.versionFile);
}

function linksFor(mod, version) {
  const repo = CFG.repo;
  const tag = `${mod.key}-v${version}`;
  const vsixName = mod.vsix.replace('{v}', version);
  const rel = `https://github.com/${repo}/releases/tag/${tag}`;
  const dl = `https://github.com/${repo}/releases/download/${tag}/${vsixName}`;
  return `[Release](${rel}) · [⬇ VSIX](${dl})`;
}

// 解析表格行 -> 单元格数组(去首尾空管道)
function cells(line) {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

function extIdOf(cell) {
  const m = cell.match(/`([^`]+)`/);
  return m ? m[1] : null;
}

function rebuild() {
  const src = fs.readFileSync(README, 'utf8');
  const { start, end } = CFG.markers;
  const si = src.indexOf(start);
  const ei = src.indexOf(end);
  if (si === -1 || ei === -1 || ei < si) {
    throw new Error(`README 未找到索引标记 ${start} / ${end}`);
  }
  const block = src.slice(si + start.length, ei);
  const overrides = versionOverrides();
  const byExt = new Map(CFG.modules.map((m) => [m.extId, m]));

  const lines = block.split('\n');
  const updated = [];
  const seen = new Set();
  for (const line of lines) {
    // 非表格行(空行等)原样保留
    if (!/^\s*\|/.test(line)) { updated.push(line); continue; }
    const c = cells(line);
    // 分隔行(全是 --- / :--: )与表头行(含"版本"或"扩展 id")原样保留
    const isSep = c.every((x) => /^:?-{2,}:?$/.test(x));
    if (isSep || c.includes('版本') || c.some((x) => /扩展\s*id/i.test(x))) {
      updated.push(line);
      continue;
    }
    const ext = extIdOf(c[2] || '');
    const mod = ext && byExt.get(ext);
    if (!mod || c.length < 5) { updated.push(line); continue; }
    const version = resolveVersion(mod, overrides);
    if (!version) { updated.push(line); continue; }
    seen.add(mod.key);
    c[1] = '`' + version + '`';
    c[4] = linksFor(mod, version);
    updated.push('| ' + c.join(' | ') + ' |');
  }

  const missing = CFG.modules.filter((m) => !seen.has(m.key)).map((m) => m.extId);
  if (missing.length) {
    console.warn('警告: 以下模块在 README 表内未匹配到行(extId):', missing.join(', '));
  }

  const newBlock = updated.join('\n');
  return src.slice(0, si + start.length) + newBlock + src.slice(ei);
}

function main() {
  const check = process.argv.includes('--check');
  const next = rebuild();
  const cur = fs.readFileSync(README, 'utf8');
  if (next === cur) {
    console.log('README 模块索引已是最新,无需变更。');
    process.exit(0);
  }
  if (check) {
    console.error('README 模块索引与真实版本不一致。请运行: node scripts/sync-readme-index.js');
    process.exit(1);
  }
  fs.writeFileSync(README, next);
  console.log('已更新 README 模块索引。');
}

main();
