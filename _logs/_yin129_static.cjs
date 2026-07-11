#!/usr/bin/env node
// _yin129_static.cjs · 印 129 全链路实证 · 简最 web 静服 (零依赖)
// 起 :18080 服 ../web/ · 用 playwright 加载验三栏 UI
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "web");
const PORT = 18080;
const BIND = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) {
    res.statusCode = 403;
    return res.end("forbidden");
  }
  fs.readFile(fp, (err, data) => {
    if (err) {
      res.statusCode = 404;
      return res.end("not found: " + p);
    }
    const ext = path.extname(fp).toLowerCase();
    res.setHeader(
      "Content-Type",
      MIME[ext] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-store");
    res.end(data);
  });
});

srv.listen(PORT, BIND, () => {
  console.log(`yin129 static · http://${BIND}:${PORT}/ · root=${ROOT}`);
});
