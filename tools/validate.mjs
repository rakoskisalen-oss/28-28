#!/usr/bin/env node
/* 数据校验：node tools/validate.mjs
 * 检查 28 天是否连续、日期是否对得上、链接与字段是否完整。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(root, "data/days.js"), "utf8");

const errors = [];
const warn = [];
const fail = (msg) => errors.push(msg);

// 用浏览器相同的方式求值，允许注释、尾逗号与 js 语法
const sandbox = { window: {} };
let days;
try {
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "data/days.js", timeout: 2000 });
  days = sandbox.window.DAYS;
  if (!Array.isArray(days)) throw new Error("window.DAYS 不是数组");
} catch (err) {
  console.error(`✗ 数据文件执行失败：${err.message}`);
  process.exit(1);
}

const num = (re, name, dflt) => {
  const m = src.match(re);
  return m ? Number(m[1]) : dflt;
};
const TOTAL = num(/totalDays:\s*(\d+)/, "totalDays", 28);
const startMatch = src.match(/startDate:\s*"([\d-]+)"/);
const START = startMatch ? startMatch[1] : "2026-10-05";

// 自动同步的天（data/auto.js），手写记录优先
let autoDays = [];
try {
  const autoSrc = readFileSync(path.join(root, "data/auto.js"), "utf8");
  const sandboxAuto = { window: {} };
  vm.createContext(sandboxAuto);
  vm.runInContext(autoSrc, sandboxAuto, { filename: "data/auto.js", timeout: 2000 });
  autoDays = Array.isArray(sandboxAuto.window.AUTO_DAYS) ? sandboxAuto.window.AUTO_DAYS : [];
} catch (err) {
  fail(`data/auto.js 读取失败：${err.message}`);
}

const curatedIds = new Set(days.map((d) => d.day));
const shadowed = autoDays.filter((d) => curatedIds.has(d.day));
if (shadowed.length) {
  warn.push(`auto.js 里有 ${shadowed.length} 天已被手写记录覆盖（${shadowed.map((d) => "D" + d.day).join(", ")}），可删`);
}
const merged = [...days, ...autoDays.filter((d) => !curatedIds.has(d.day))].sort((a, b) => a.day - b.day);

const KINDS = new Set(["ship", "reset", "banked"]);
const pad = (n) => String(n).padStart(2, "0");
const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};

if (merged.length > TOTAL) fail(`记录数 ${merged.length} 超过总天数 ${TOTAL}`);

const seen = new Set();
merged.forEach((d, i) => {
  const where = `第 ${d.day ?? "?"} 条`;
  if (!Number.isInteger(d.day) || d.day < 1 || d.day > TOTAL) fail(`${where}：day 必须是 1–${TOTAL} 的整数`);
  if (seen.has(d.day)) fail(`${where}：day 重复`);
  seen.add(d.day);

  const expected = addDays(START, d.day - 1);
  if (d.date !== expected) fail(`${where}：date ${d.date} 应为 ${expected}`);

  if (!Array.isArray(d.kinds) || d.kinds.length === 0) fail(`${where}：kinds 不能为空`);
  else d.kinds.forEach((k) => { if (!KINDS.has(k)) fail(`${where}：未知 kinds "${k}"`); });

  if (!d.title || d.title.length < 4) fail(`${where}：缺少 title`);
  if (d.source === "auto") {
    if (!d.url) fail(`${where}：自动记录必须有原帖链接`);
    if (!d.summary && !d.postText) fail(`${where}：自动记录至少要有摘要或原帖正文`);
    if (d.summarySource === "llm" && (!d.summary || d.summary.length < 10)) {
      fail(`${where}：标了 llm 摘要但内容太短`);
    }
  } else if (!d.summary || d.summary.length < 10) {
    fail(`${where}：summary 太短`);
  }

  if (d.url && !/^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(d.url)) {
    fail(`${where}：url 不是 thsottiaux 的帖子链接 → ${d.url}`);
  }

  (d.items || []).forEach((it, j) => {
    if (!it.title) fail(`${where} items[${j}]：缺少 title`);
    if (it.url && !/^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(it.url)) {
      fail(`${where} items[${j}]：url 非法 → ${it.url}`);
    }
    if (it.praise != null && typeof it.praise !== "number") fail(`${where} items[${j}]：praise 必须是数字`);
  });

  if (d.reactions) {
    const { praise, meh } = d.reactions;
    if (typeof praise !== "number" || typeof meh !== "number") fail(`${where}：reactions 必须是数字`);
  }
});

for (let i = 1; i <= merged.length; i++) {
  if (!seen.has(i)) fail(`缺少第 ${i} 天（day 必须从 1 开始连续）`);
}

if (merged.length && merged.length < TOTAL) {
  warn.push(`尚有 ${TOTAL - merged.length} 天未记录，页面会显示为「等待中 / 未开始」`);
}

const count = (k) => merged.filter((d) => (d.kinds || []).includes(k)).length;
const itemCount = merged.reduce((n, d) => n + (d.items || []).length, 0);
const noLink = merged.filter((d) => !d.url);
const orphan = merged.filter((d) => !d.url && !(d.items || []).length);
const pendingWrite = merged.filter((d) => d.source === "auto" && !d.summary);

console.log(`\n28/28 数据检查 · data/days.js${autoDays.length ? " + data/auto.js" : ""}`);
console.log("─".repeat(52));
console.log(`已记录     ${merged.length} / ${TOTAL} 天（手写 ${days.length} · 自动 ${merged.length - days.length}）`);
console.log(`最后一条   ${merged.length ? merged[merged.length - 1].date : "—"}`);
console.log(`有发布     ${count("ship")} 天`);
console.log(`全量重置   ${count("reset")} 天`);
console.log(`储备重置   ${count("banked")} 天`);
console.log(`明细条目   ${itemCount} 条（其余为单条发布）`);
console.log(`无主链接   ${noLink.length} 天${orphan.length ? `（其中 ${orphan.length} 天无任何链接）` : ""}`);
console.log("─".repeat(52));

if (pendingWrite.length) {
  warn.push(`${pendingWrite.length} 天是自动收录、还没中文摘要：${pendingWrite.map((d) => "D" + d.day).join(", ")}`);
}

warn.forEach((w) => console.log(`· ${w}`));

if (errors.length) {
  console.error(`\n✗ ${errors.length} 个问题：`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log("✓ 数据通过校验\n");
