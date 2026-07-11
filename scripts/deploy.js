#!/usr/bin/env node
// Monorepo deploy script · packages/* → target extensions dir
// Usage: node scripts/deploy.js [package] [target]
//   package: wam | dao-proxy-min (default: wam)
//   target:  141 | 179 | both (default: 141)
// 注: dao-proxy-min 之远端部署推荐使用其专属 PSSession 脚本:
//   pwsh packages/dao-proxy-min/_审视/_deploy.ps1
//   (走 Negotiate auth · 不依赖 SMB share · 凭证 ENV/DPAPI/prompt 三轨)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const pkg = process.argv[2] || "wam";
const target = process.argv[3] || "141";
const ROOT = path.resolve(__dirname, "..");
const PKG_DIR = path.join(ROOT, "packages", pkg);

if (!fs.existsSync(PKG_DIR)) {
  console.error(`Package not found: ${PKG_DIR}`);
  process.exit(1);
}

const pkgJson = JSON.parse(
  fs.readFileSync(path.join(PKG_DIR, "package.json"), "utf8"),
);
const extId = `${pkgJson.publisher}.${pkgJson.name}`;
const version = pkgJson.version;
const dirName = `${extId}-${version}`;

const h = (p) => {
  try {
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(p))
      .digest("hex")
      .substring(0, 16);
  } catch {
    return "ERR";
  }
};

const TARGETS = {
  141: {
    label: "141 本机",
    extRoot: path.join(
      process.env.USERPROFILE || "",
      ".windsurf",
      "extensions",
    ),
  },
  179: {
    label: "179 远程",
    extRoot: "//192.168.31.179/C$/Users/zhouyoukang/.windsurf/extensions",
  },
};

function deployOne(label, extRoot) {
  console.log(`\n═══ ${label}: ${extRoot} ═══`);
  if (!fs.existsSync(extRoot)) {
    console.log("  ❌ extRoot not found, skip");
    return false;
  }

  // Clean old versions of this extension
  const oldDirs = fs
    .readdirSync(extRoot)
    .filter((d) => d.startsWith(extId + "-") && d !== dirName);
  for (const old of oldDirs) {
    const full = path.join(extRoot, old);
    try {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`  🗑️ removed ${old}`);
    } catch (e) {
      console.log(`  ⚠️ remove failed ${old}: ${e.message}`);
    }
  }

  // Copy files
  const dst = path.join(extRoot, dirName);
  fs.mkdirSync(path.join(dst, "media"), { recursive: true });
  const files = [
    "extension.js",
    "package.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "media/icon.png",
    "media/icon.svg",
  ];
  for (const f of files) {
    const src = path.join(PKG_DIR, f);
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(dst, f));
    }
  }
  console.log(
    `  ✅ deployed ${dirName}: ext.js=${h(path.join(dst, "extension.js"))} pkg=${h(path.join(dst, "package.json"))}`,
  );

  // Update extensions.json
  const ejf = path.join(extRoot, "extensions.json");
  let data = [];
  try {
    let raw = fs.readFileSync(ejf, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    data = JSON.parse(raw);
    if (!Array.isArray(data)) data = [];
  } catch {
    data = [];
  }
  const before = data.length;
  data = data.filter((e) => !(e.identifier && e.identifier.id === extId));
  console.log(`  extensions.json: removed ${before - data.length} old`);
  data.push({
    identifier: { id: extId, uuid: extId },
    version,
    location: {
      $mid: 1,
      path: extRoot.replace(/\\/g, "/") + "/" + dirName,
      scheme: "file",
    },
    relativeLocation: dirName,
    metadata: {
      id: extId,
      publisherId: pkgJson.publisher,
      publisherDisplayName: pkgJson.publisher,
      targetPlatform: "undefined",
      isApplicationScoped: false,
      isBuiltin: false,
      installedTimestamp: Date.now(),
    },
  });
  fs.writeFileSync(ejf, JSON.stringify(data, null, "\t"), "utf8");
  console.log(`  extensions.json: total ${data.length}`);

  // Clean .obsolete
  const obf = path.join(extRoot, ".obsolete");
  if (fs.existsSync(obf)) {
    try {
      const c = JSON.parse(fs.readFileSync(obf, "utf8"));
      let changed = false;
      for (const k of Object.keys(c)) {
        if (k.startsWith(extId)) {
          delete c[k];
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(obf, JSON.stringify(c), "utf8");
        console.log("  .obsolete cleaned");
      }
    } catch {}
  }
  return true;
}

console.log(`deploy: ${pkg}@${version} → ${target}`);
const targets = target === "both" ? ["141", "179"] : [target];
for (const t of targets) {
  const cfg = TARGETS[t];
  if (cfg) deployOne(cfg.label, cfg.extRoot);
  else console.log(`Unknown target: ${t}`);
}
console.log("\n═══ DONE ═══");
