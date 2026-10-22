#!/usr/bin/env node
/* 交互与结构自检：node tools/qa.mjs <debugPort> <url>
 * 不依赖测试框架，直接通过 CDP 在页面上跑断言。
 */
const [port, url] = process.argv.slice(2);
if (!port || !url) {
  console.error("usage: qa.mjs <debugPort> <url>");
  process.exit(1);
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let seq = 0;

await new Promise((res, rej) => {
  ws.addEventListener("open", res);
  ws.addEventListener("error", () => rej(new Error("ws error")));
});

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text);
  return result.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await wait(1000);
await send("Page.bringToFront");
await wait(400);

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures.push(name);
};

const base = await evaluate(`(() => ({
  cells: document.querySelectorAll(".cell").length,
  days: document.querySelectorAll(".day").length,
  pending: document.querySelectorAll(".day--pending").length,
  future: document.querySelectorAll("#futureList li").length,
  heroDay: document.querySelector('[data-bind="dayNow"]').textContent.trim(),
  status: document.querySelector('[data-bind="statusText"]').textContent.trim(),
  rate: document.querySelector('[data-bind="statRate"]').textContent.trim(),
  counts: Array.from(document.querySelectorAll("[data-count]")).map(e => e.dataset.count + "=" + e.textContent.trim()).join(" "),
  xLinks: document.querySelectorAll('a[href^="https://x.com/"]').length,
  unsafeLinks: document.querySelectorAll('a[target="_blank"]:not([rel*="noopener"])').length,
  emptyChips: document.querySelectorAll(".chip:empty").length,
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
}))()`);

check("账本 28 格", base.cells === 28, `cells=${base.cells}`);
check("时间线 17 张（16 历史 + 今日待定）", base.days === 17 && base.pending === 1, `days=${base.days} pending=${base.pending}`);
check("未来列表 11 天", base.future === 11, `future=${base.future}`);
check("今日 = 第 17 天", base.heroDay === "17", `heroDay=${base.heroDay}`);
check("状态 = 等待今日判定", base.status === "等待今日判定", base.status);
check("兑现 = 16 / 16", base.rate === "16 / 16", base.rate);
check("筛选计数", base.counts === "all=16 ship=12 reset=6 banked=1", base.counts);
check("原帖链接已渲染", base.xLinks >= 15, `xLinks=${base.xLinks}`);
check("外链都有 noopener", base.unsafeLinks === 0, `unsafe=${base.unsafeLinks}`);
check("无空 chip", base.emptyChips === 0, `empty=${base.emptyChips}`);
check("1440 无横向溢出", base.overflow === false);

// 筛选
await evaluate(`document.querySelector('[data-filter="reset"]').click()`);
await wait(120);
const f = await evaluate(`({
  dim: document.querySelectorAll(".day.is-dim").length,
  total: document.querySelectorAll(".day").length,
  active: document.querySelector(".filter.is-on").dataset.filter
})`);
check("筛选「重置」高亮 11 张", f.dim === 11 && f.active === "reset", `dim=${f.dim}/${f.total}`);
await evaluate(`document.querySelector('[data-filter="all"]').click()`);
await wait(120);
check("筛选复位", (await evaluate(`document.querySelectorAll(".day.is-dim").length`)) === 0);

// 账本点击
await send("Page.bringToFront");
await wait(200);
await evaluate(`document.querySelector('.cell[data-day="6"]').click()`);
await wait(1700);
const pos = await evaluate(`Math.round(document.getElementById("day-6").getBoundingClientRect().top)`);
check("点账本第 6 格跳到第 6 天", pos >= 0 && pos < 300, `top=${pos}`);

// 悬浮提示
await evaluate(`window.scrollTo(0,0)`);
await wait(600);
await evaluate(`document.querySelector('.cell[data-day="16"]').dispatchEvent(new PointerEvent("pointerover", { bubbles: true }))`);
await wait(200);
const tip = await evaluate(`(() => { const t = document.querySelector(".tip"); return t ? { on: t.classList.contains("is-on"), text: t.textContent } : null; })()`);
check("格子上有悬浮提示", !!tip && tip.on && tip.text.includes("16"), tip ? tip.text.slice(0, 40) : "no tip");

// 键盘 j
const before = await evaluate("window.scrollY");
await evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }))`);
await wait(900);
const after = await evaluate("window.scrollY");
check("按 j 向下翻一天", after > before, `${before} → ${after}`);

const overflowMobile = await (async () => {
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await wait(400);
  return evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth");
})();
check("390 无横向溢出", overflowMobile === false);

console.log(failures.length ? `\n✗ ${failures.length} 项失败` : "\n✓ 全部通过");
ws.close();
process.exit(failures.length ? 1 : 0);
