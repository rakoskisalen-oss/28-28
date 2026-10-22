#!/usr/bin/env node
/* 截图工具（走 CDP，整页留档）
 * 用法：node tools/shot.mjs <debugPort> <url> <out.png> <width> [height]
 * 例：  node tools/shot.mjs 55088 http://127.0.0.1:8756/ shots/desktop.png 1440
 */
import { writeFileSync } from "node:fs";

const [port, url, out, widthArg, heightArg] = process.argv.slice(2);
if (!port || !url || !out) {
  console.error("usage: shot.mjs <debugPort> <url> <out.png> <width> [height]");
  process.exit(1);
}
const WIDTH = Number(widthArg || 1440);
const HEIGHT = Number(heightArg || 900);

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("没有可用的 page target");

const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let seq = 0;
const logs = [];

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(`${msg.error.message} (${msg.error.code})`)) : resolve(msg.result);
    return;
  }
  if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
    logs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  }
  if (msg.method === "Runtime.exceptionThrown") {
    logs.push(`exception: ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`);
  }
});

const open = new Promise((res, rej) => {
  ws.addEventListener("open", res);
  ws.addEventListener("error", () => rej(new Error("WebSocket 连接失败")));
});
await open;

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const { result } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 1,
  mobile: WIDTH < 700
});

await send("Page.navigate", { url });

const deadline = Date.now() + 15000;
let ready = false;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 150));
  try {
    ready = await evaluate("document.readyState === 'complete' && document.body.classList.contains('is-ready')");
    if (ready) break;
  } catch { /* 导航中 */ }
}
if (!ready) console.warn("! 页面在 15s 内没有进入 ready 状态，仍然截图");

// 触发一次滚动，让可能的入场动画跑完，再回到顶部
await evaluate("window.scrollTo(0, document.body.scrollHeight); 1");
await new Promise((r) => setTimeout(r, 400));
await evaluate("window.scrollTo(0, 0); 1");
await new Promise((r) => setTimeout(r, 500));

const height = Math.max(HEIGHT, Math.ceil(await evaluate("Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)")));
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height,
  deviceScaleFactor: 1,
  mobile: WIDTH < 700
});
await new Promise((r) => setTimeout(r, 400));

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
writeFileSync(out, Buffer.from(shot.data, "base64"));

const stats = await evaluate(`(() => {
  const days = document.querySelectorAll(".day").length;
  const cells = document.querySelectorAll(".cell").length;
  const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  return { days, cells, overflow, h: document.documentElement.scrollHeight };
})()`);

console.log(`${out}  ${WIDTH}×${height}  days=${stats.days} cells=${stats.cells} 横向溢出=${stats.overflow}`);
if (logs.length) {
  console.log("控制台：");
  logs.forEach((l) => console.log("  " + l));
}
ws.close();
process.exit(0);
