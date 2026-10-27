// 验 SSE 端点 · /origin/stream · hello + mode 广播 + hb
const path = require("path");
const http = require("http");
const fs = require("fs");

const DIR = path.join(__dirname, "..", "vendor", "bundled-origin");
const srcPath = path.join(DIR, "source.js");
const modeFile = path.join(DIR, "_origin_mode.txt");
const modeBak = fs.existsSync(modeFile) ? fs.readFileSync(modeFile, "utf8") : null;

(async () => {
  delete require.cache[require.resolve(srcPath)];
  const src = require(srcPath);
  const PORT = 18998;
  const handle = await src.start({ port: PORT, host: "127.0.0.1", mode: "invert" });

  // 连 SSE
  const events = [];
  let sseReq = null;
  await new Promise((resolve) => {
    sseReq = http.get(
      `http://127.0.0.1:${PORT}/origin/stream`,
      { headers: { accept: "text/event-stream" }, agent: false },
      (res) => {
        console.log("SSE status:", res.statusCode, res.headers["content-type"]);
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (c) => {
          buf += c;
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = { type: "?", data: "" };
            for (const line of raw.split("\n")) {
              if (line.startsWith("event:")) ev.type = line.slice(6).trim();
              else if (line.startsWith("data:")) ev.data = line.slice(5).trim();
            }
            events.push(ev);
            console.log("  ← event:", ev.type, ev.data.slice(0, 80));
            if (ev.type === "mode") resolve();
          }
        });
        res.on("error", () => resolve());
      },
    );
    sseReq.on("error", (e) => {
      console.log("SSE connect err:", e.message);
      resolve();
    });
    // 5s 超时兜底
    setTimeout(resolve, 5000);
  });

  // 触发一次 mode 变 → 应广播
  await new Promise((r) => setTimeout(r, 300));
  handle.setMode("passthrough");
  await new Promise((r) => setTimeout(r, 500));
  handle.setMode("invert");
  await new Promise((r) => setTimeout(r, 500));

  const modeEvents = events.filter((e) => e.type === "mode");
  console.log(
    modeEvents.length >= 2
      ? "✓ mode 广播达 (" + modeEvents.length + " 次)"
      : "✗ mode 广播未达",
  );
  const hello = events.find((e) => e.type === "hello");
  console.log(hello ? "✓ hello 达" : "✗ hello 未达");

  // ★ v9.9.67 · 验器自身之洁: 先断 SSE 连接方不阻 server.close
  try {
    sseReq.destroy();
  } catch (_) {}

  handle.close();
  await src.stop();
  if (modeBak !== null) fs.writeFileSync(modeFile, modeBak, "utf8");
  else {
    try {
      fs.unlinkSync(modeFile);
    } catch {}
  }
  process.exit(modeEvents.length >= 2 && hello ? 0 : 1);
})();
