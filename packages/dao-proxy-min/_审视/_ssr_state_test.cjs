// SSR 真态首绘之证 · getEssenceHtml 虚境演算 · v9.9.67
// 验: 顶层道/官钮已除 · _INIT 嵌入 · 双面钮 active 预渲 · 三处 canon selected · 默认回退
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(
  path.join(__dirname, "..", "extension.js"),
  "utf8",
);
const i0 = src.indexOf("function getEssenceHtml");
const i1 = src.indexOf("</html>`;", i0);
const fnText = src.slice(i0, i1) + "</html>`;\n}";
const PKG_VERSION = "9.9.67";
const _genNonce = () => "n0n0";
const _escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
eval(fnText);

let pass = 0,
  fail = 0;
const t = (n, c) => {
  if (c) {
    pass++;
    console.log("  ✓ " + n);
  } else {
    fail++;
    console.log("  ✗ " + n);
  }
};

const html = getEssenceHtml(0, null, "<p>SSRSP</p>", {
  mode: "passthrough",
  canon: "yinfu",
  surf: {
    local: { mode: "custom", canon: "laozi" },
    cascade: { mode: "invert", canon: "yinfu" },
  },
});

t("无 btnDao 钮", !/id="btnDao"/.test(html));
t("无 btnOff 钮", !/id="btnOff"/.test(html));
t("_INIT 嵌入", /var _INIT = \{"mode":"passthrough","canon":"yinfu"/.test(html));
t(
  "canonSelect yinfu selected",
  /<option value="yinfu" selected>/.test(html),
);
t(
  "canonL laozi selected",
  /id="canonL"[\s\S]{0,400}<option value="laozi" selected>/.test(html),
);
t(
  "canonC yinfu selected",
  /id="canonC"[\s\S]{0,400}<option value="yinfu" selected>/.test(html),
);
t(
  "L编 active-custom",
  /class="mb sf active active-custom" id="btnLCustom"/.test(html),
);
t("C道 active-dao", /class="mb sf active active-dao" id="btnCDao"/.test(html));
t("L道无active", /class="mb sf" id="btnLDao"/.test(html));
t("C官无active", /class="mb sf" id="btnCOff"/.test(html));
t("SSR SP 嵌入", html.includes("&lt;p&gt;SSRSP&lt;/p&gt;"));

// 默认回退: initState 缺 → invert + laozi+yinfu · 双面皆道
const h2 = getEssenceHtml(0, null, null, null);
t(
  "默认 _INIT invert+laozi+yinfu",
  /var _INIT = \{"mode":"invert","canon":"laozi\+yinfu"/.test(h2),
);
t("默认 L道 active", /class="mb sf active active-dao" id="btnLDao"/.test(h2));
t("默认 C道 active", /class="mb sf active active-dao" id="btnCDao"/.test(h2));
t(
  "默认 canonSelect 合一",
  /<option value="laozi\+yinfu" selected>帛书老子/.test(h2),
);

// 边缘: local passthrough + cascade custom
const h3 = getEssenceHtml(0, null, "", {
  mode: "invert",
  canon: "laozi",
  surf: { local: { mode: "passthrough", canon: "yinfu" }, cascade: { mode: "custom", canon: "laozi+yinfu" } },
});
t("L官 active(无-dao缀)", /class="mb sf active" id="btnLOff"/.test(h3));
t("C编 active-custom", /class="mb sf active active-custom" id="btnCCustom"/.test(h3));

console.log("═══ " + pass + " pass · " + fail + " fail ═══");
process.exit(fail > 0 ? 1 : 0);
