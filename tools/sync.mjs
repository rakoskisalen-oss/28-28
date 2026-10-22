#!/usr/bin/env node
/* 每日同步：node tools/sync.mjs [--dry-run] [--since 16] [--out data/auto.js]
 *
 * 做三件事：
 *   1. 从公开追踪页读「第 N 天 = 改进 / 重置 / 储备重置」，以及当天帖子的链接与互动数；
 *   2. 用 X 的公开 syndication 端点取回帖正文（不需要登录、不需要 API key）；
 *   3. 把本地还没有的天追加进 data/auto.js（人工校订过的 data/days.js 优先）。
 *
 * 只做机械部分：中文摘要留空，页面上会标记「自动 · 摘要待补」。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const DRY = flag("--dry-run");
const SINCE = Number(option("--since", "0")) || 0;
const AUTO_FILE = path.resolve(ROOT, option("--out", "data/auto.js"));
const TRACKER = option("--url", "https://codex-resets.com/tibo-28?lang=en");
const UA = "28-28-tracker/1.0 (personal fan site; low rate)";
const TIMEOUT = 20000;

const NO_LLM = flag("--no-llm");
const FILL = flag("--fill");

// 把输出同时追加到 logs/sync.log，计划任务跑过什么有据可查
if (!DRY) {
  const logDir = path.join(ROOT, "logs");
  const logFile = path.join(logDir, "sync.log");
  const rawLog = console.log.bind(console);
  console.log = (...args) => {
    const line = args.join(" ");
    rawLog(line);
    try {
      mkdirSync(logDir, { recursive: true });
      appendFileSync(logFile, `[${new Date().toISOString()}] ${line}\n`, "utf8");
    } catch { /* 日志失败不影响主流程 */ }
  };
}

// 读取本地配置（不覆盖已有的真实环境变量）
// 顺序：~/.28-28.env → 项目 .env
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(path.join(os.homedir(), ".28-28.env"));
loadEnvFile(path.join(ROOT, ".env"));

// ── 工具 ────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");
const decode = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const addDays = (iso, n) => {
  const dt = new Date(parseISO(iso) + n * 86400000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};

async function fetchText(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, "accept-language": "en" },
        signal: AbortSignal.timeout(TIMEOUT)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

// ── 读取现有数据 ────────────────────────────────────────
function loadDaysJs() {
  const file = path.join(ROOT, "data/days.js");
  const src = readFileSync(file, "utf8");
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "data/days.js", timeout: 3000 });
  return { curated: ctx.window.DAYS || [], challenge: ctx.window.CHALLENGE || {} };
}

function loadAutoDays() {
  if (!existsSync(AUTO_FILE)) return [];
  const ctx = { window: {} };
  try {
    vm.createContext(ctx);
    vm.runInContext(readFileSync(AUTO_FILE, "utf8"), ctx, { timeout: 3000 });
    return Array.isArray(ctx.window.AUTO_DAYS) ? ctx.window.AUTO_DAYS : [];
  } catch {
    return [];
  }
}

// ── 解析追踪页 ──────────────────────────────────────────
const KIND_BY_LABEL = [
  [/banked/i, "banked"],
  [/reset/i, "reset"],
  [/improvement/i, "ship"]
];

function parseTracker(html) {
  const starts = [...html.matchAll(/<li[^>]*id="day-(\d+)"[^>]*>/g)];
  const rows = [];

  for (let i = 0; i < starts.length; i++) {
    const m = starts[i];
    const from = m.index;
    const to = i + 1 < starts.length ? starts[i + 1].index : html.length;
    const block = html.slice(from, to);
    const day = Number(m[1]);
    const date = (block.match(/<time datetime="([\d-]{10})"/) || [])[1];
    if (!date) continue;

    // 每一天可能由多个「组」构成：Banked reset / Improvement / Reset …
    const badges = [...block.matchAll(/<span class="challenge-badge[^"]*">([^<]*)<\/span>/g)];
    const kinds = [];
    const entries = [];

    for (let b = 0; b < badges.length; b++) {
      const label = decode(badges[b][1]);
      const segFrom = badges[b].index;
      const segTo = b + 1 < badges.length ? badges[b + 1].index : block.length;
      const seg = block.slice(segFrom, segTo);

      const kind = KIND_BY_LABEL.find(([re]) => re.test(label));
      if (!kind) continue; // Waiting for Tibo / Ahead
      if (!kinds.includes(kind[1])) kinds.push(kind[1]);

      for (const art of seg.matchAll(/<article[^>]*class="challenge-entry[^"]*"[^>]*>([\s\S]*?)<\/article>/g)) {
        const body = art[1];
        const link = body.match(/<a href="(https:\/\/x\.com\/thsottiaux\/status\/\d+)"[^>]*>([\s\S]*?)<\/a>/);
        if (!link) continue;
        const counts = [...body.matchAll(/challenge-vote-tally-count">([\d,]+)</g)].map((c) =>
          Number(c[1].replace(/,/g, ""))
        );
        const para = body.match(/<p>([\s\S]*?)<\/p>/);
        entries.push({
          title: decode(link[2]),
          url: link[1],
          praise: counts[0] ?? null,
          meh: counts[1] ?? null,
          summary: para ? decode(para[1]) : ""
        });
      }
    }

    if (!kinds.length || !entries.length) continue;
    rows.push({ day, date, kinds, entries });
  }
  return rows.sort((a, b) => a.day - b.day);
}

// ── 取帖子正文（X 公开 syndication 端点）─────────────────
async function fetchPost(url) {
  const id = (url.match(/status\/(\d+)/) || [])[1];
  if (!id) return null;
  try {
    const data = await fetchJson(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=a`);
    if (!data || !data.text) return null;
    return {
      text: decode(data.text),
      createdAt: data.created_at || null,
      favorites: data.favorite_count ?? null,
      id
    };
  } catch {
    return null;
  }
}

// ── 中文摘要（可选，需 LLM_API_KEY）────────────────────
const LLM_SYSTEM = [
  "你是一名中文科技编辑，为「28/28」项目写每日记录。读者关心 Codex / ChatGPT 的实际变化。",
  "根据给定的 X 帖子，写 1–2 句简体中文摘要：",
  "- 只写帖子里有的事实：改了什么、对谁有用、怎么生效；不推断影响，不写「重磅」「颠覆」这类词；",
  "- 40–80 字；第一句说清是什么，必要时第二句补范围或限制；",
  "- 不要以「Tibo 宣布」开头，不要重复标题；",
  "- 保留产品名、数字和单位（如 500k、60%、12 小时）。",
  "再给 1–3 个中文标签，每个 2–5 个字（如「缓存」「桌面端」「API」）。",
  '只输出 JSON，不要代码块：{"summary": "...", "tags": ["..."]}'
].join("\n");

function parseJsonLoose(raw) {
  const text = String(raw || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

const cleanText = (s) =>
  String(s || "")
    .replace(/\s+/g, " ")
    .replace(/^["“”'「」]+|["“”'「」]+$/g, "")
    .trim();

async function summarizeDay(rec) {
  const key = process.env.LLM_API_KEY;
  if (!key || NO_LLM) return null;
  const base = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const text = rec.postText || rec.summary || "";
  if (!text) return null;

  const body = JSON.stringify({
    model,
    temperature: 0.2,
    max_tokens: 320,
    messages: [
      { role: "system", content: LLM_SYSTEM },
      { role: "user", content: `标题：${rec.title}\n日期：${rec.date}\n\n帖子正文：\n${text}` }
    ]
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body,
        signal: AbortSignal.timeout(45000)
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 160).replace(/\s+/g, " ");
        throw new Error(`HTTP ${res.status} ${detail}`);
      }
      const data = await res.json();
      const parsed = parseJsonLoose(data?.choices?.[0]?.message?.content);
      if (!parsed || !parsed.summary) throw new Error("返回里没有 summary");
      return {
        summary: cleanText(parsed.summary),
        tags: (Array.isArray(parsed.tags) ? parsed.tags : []).map((t) => cleanText(t)).filter(Boolean).slice(0, 3)
      };
    } catch (err) {
      if (attempt === 1) {
        console.warn(`  ! D${pad(rec.day)} 摘要失败：${err.message}（保留「待补」）`);
        return null;
      }
      await sleep(1200);
    }
  }
  return null;
}

// ── 主流程 ──────────────────────────────────────────────
const { curated, challenge } = loadDaysJs();
const START = challenge.startDate || "2026-10-05";
const TOTAL = challenge.totalDays || 28;
const autoDays = loadAutoDays();

const known = new Set([...curated, ...autoDays].map((d) => d.day));
console.log(`本地已有 ${known.size} 天（手写 ${curated.length} / 自动 ${autoDays.length}）`);

let html;
try {
  html = await fetchText(TRACKER);
} catch (err) {
  console.error(`✗ 追踪页抓取失败：${err.message}。本次不做任何修改。`);
  process.exit(1);
}

const rows = parseTracker(html).map((r) => ({
  ...r,
  expected: addDays(START, r.day - 1)
}));

if (flag("--dump")) {
  rows.forEach((r) =>
    console.log(
      `D${pad(r.day)} ${r.date} [${r.kinds.join("+")}] ${r.entries.length} 条 · ${r.entries
        .map((e) => `${e.title} (${e.praise ?? "-"}/${e.meh ?? "-"}) ${e.url}`)
        .join("\n    | ")}`
    )
  );
  process.exit(0);
}

const bad = rows.filter((r) => r.date !== r.expected);
if (bad.length) {
  console.warn(`! ${bad.length} 天的日期与 startDate 对不上：${bad.map((b) => `D${b.day} ${b.date}≠${b.expected}`).join(", ")}`);
}

const missing = rows.filter(
  (r) =>
    r.day <= TOTAL &&
    r.date === r.expected &&
    ((SINCE > 0 && r.day >= SINCE) || !known.has(r.day))
);

console.log(`追踪页解析到 ${rows.length} 天有结论；本地缺 ${missing.length} 天`);

if (!missing.length && !FILL) {
  console.log("✓ 没有新的天，数据已是最新");
  process.exit(0);
}

if (missing.length && !NO_LLM && !process.env.LLM_API_KEY) {
  console.log("· 没有配置 LLM_API_KEY，摘要会留空并标记「待补」（见 .env.example）");
}

const added = [];
for (const row of missing) {
  const main = row.entries[0];
  const post = await fetchPost(main.url);
  await sleep(350);

  const items = [];
  for (const entry of row.entries.slice(1)) {
    const p = await fetchPost(entry.url);
    await sleep(350);
    items.push({
      title: entry.title,
      url: entry.url,
      summary: p ? p.text : entry.summary,
      praise: entry.praise,
      meh: entry.meh
    });
  }

  const record = {
    day: row.day,
    date: row.date,
    kinds: row.kinds,
    title: main.title,
    url: main.url,
    summary: "",
    quote: null,
    quoteZh: null,
    postText: post ? post.text : main.summary,
    postedAt: post ? post.createdAt : null,
    items,
    reactions: main.praise != null ? { praise: main.praise, meh: main.meh } : null,
    tags: [],
    source: "auto",
    note: null
  };

  if (record.postText) {
    const made = await summarizeDay(record);
    if (made) {
      record.summary = made.summary;
      record.tags = made.tags;
      record.summarySource = "llm";
    }
  }

  added.push(record);
  console.log(
    `+ D${pad(row.day)} ${row.date} [${row.kinds.join("+")}] ${main.title}` +
      (post ? " （已取到正文）" : " （仅标题）") +
      (record.summarySource === "llm" ? " （摘要 ✓）" : record.summary ? "" : " （摘要待补）")
  );
}

if (DRY) {
  console.log("\n--dry-run：以下记录不会写入。\n");
  console.log(JSON.stringify(added, null, 2));
  process.exit(0);
}

// 给历史自动记录补摘要（最多 5 条/次，避免一次跑太多）
let filled = 0;
if (FILL && !NO_LLM && process.env.LLM_API_KEY) {
  for (const d of autoDays) {
    if (filled >= 5) break;
    if (d.summary || !d.postText) continue;
    const made = await summarizeDay(d);
    if (made) {
      d.summary = made.summary;
      d.tags = made.tags;
      d.summarySource = "llm";
      filled++;
      console.log(`~ D${pad(d.day)} 补摘要 ✓ ${made.summary}`);
    }
    await sleep(400);
  }
  if (!filled) console.log("· 没有需要补摘要的自动记录");
}

const merged = [...autoDays, ...added]
  .filter((d, i, arr) => arr.findIndex((x) => x.day === d.day) === i)
  .sort((a, b) => a.day - b.day);

const header =
  "/* 自动生成：node tools/sync.mjs —— 不要手改。\n" +
  " * 校订过的记录请放进 data/days.js（同一天以 days.js 为准）。\n" +
  " * 上次同步：" + new Date().toISOString() + "\n" +
  " */\n";

writeFileSync(AUTO_FILE, `${header}window.AUTO_DAYS = ${JSON.stringify(merged, null, 2)};\n`, "utf8");
console.log(
  `\n✓ 写入 ${path.relative(ROOT, AUTO_FILE)}：新增 ${added.length} 天` +
    (filled ? `，补摘要 ${filled} 天` : "") +
    `，共 ${merged.length} 天`
);
const pending = merged.filter((d) => !d.summary);
if (pending.length) console.log(`  还有 ${pending.length} 天没有摘要：${pending.map((d) => "D" + d.day).join(", ")}`);
else console.log("  所有自动记录都有摘要了。");
