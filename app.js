/* 28/28 — 渲染逻辑
 * 数据来自 data/days.js（window.CHALLENGE / window.DAYS）。
 * 页面会按日期自动推进，不需要每天改代码；新增一天只需往 DAYS 里追加。
 */
(() => {
  "use strict";

  const C = window.CHALLENGE || {};
  const CURATED = (Array.isArray(window.DAYS) ? window.DAYS : []).slice();
  const AUTO = (Array.isArray(window.AUTO_DAYS) ? window.AUTO_DAYS : []).slice();
  const curatedDays = new Set(CURATED.map((d) => d.day));
  const DAYS = [...CURATED, ...AUTO.filter((d) => !curatedDays.has(d.day))].sort((a, b) => a.day - b.day);

  const TOTAL = C.totalDays || 28;
  const TZ = C.timezone || "America/Los_Angeles";
  const START = C.startDate || "2026-10-05";
  const END = C.endDate || "2026-11-01";

  const KIND = {
    ship: "发布",
    reset: "重置",
    banked: "储备重置"
  };
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  const pad = (n) => String(n).padStart(2, "0");
  const parseISO = (iso) => {
    const [y, m, d] = String(iso).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const addDays = (iso, n) => {
    const dt = new Date(parseISO(iso) + n * 86400000);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  };
  const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const todayISO = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  const clockPT = () =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
  const fmtNum = (n) => Number(n).toLocaleString("en-US");
  const md = (iso) => {
    const [, m, d] = iso.split("-");
    return `${Number(m)}.${pad(d)}`;
  };
  const weekday = (iso) => WEEKDAYS[new Date(parseISO(iso)).getUTCDay()];

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));

  const setText = (key, value) => {
    document.querySelectorAll(`[data-bind="${key}"]`).forEach((el) => {
      el.textContent = value;
    });
  };

  // ── 模型 ──────────────────────────────────────────────
  const today = todayISO();
  const rawDay = diffDays(START, today) + 1;
  const currentDay = Math.min(Math.max(rawDay, 1), TOTAL);
  const notStarted = rawDay < 1;
  const ended = today > END;

  const byDay = new Map(DAYS.map((d) => [d.day, d]));
  const noted = DAYS.length;
  const counts = { ship: 0, reset: 0, banked: 0 };
  DAYS.forEach((d) =>
    (d.kinds || []).forEach((k) => {
      if (k in counts) counts[k] += 1;
    })
  );
  const passedDays = Math.max(0, Math.min(diffDays(START, today), TOTAL));
  const isTodayPending = !ended && !notStarted && !byDay.has(currentDay);
  const lastDate = DAYS.reduce((acc, d) => (d.date > acc ? d.date : acc), START);

  // ── Hero ──────────────────────────────────────────────
  function renderHero() {
    setText("dayNow", notStarted ? "--" : ended ? TOTAL : currentDay);
    setText("navDay", notStarted ? "--" : ended ? TOTAL : currentDay);
    setText("recorded", noted);
    setText("remaining", Math.max(0, TOTAL - (ended ? TOTAL : currentDay)));
    setText("statShip", counts.ship);
    setText("statReset", counts.reset);
    setText("statBanked", counts.banked);
    setText("statRate", `${noted} / ${ended ? TOTAL : passedDays}`);

    const status = notStarted
      ? "尚未开始"
      : ended
        ? "挑战已收官"
        : isTodayPending
          ? "等待今日判定"
          : "今日已判定";
    setText("statusText", status);
    setText("navStatus", status);
    setText("todayNote", ended ? "挑战已结束" : isTodayPending ? "今日尚无记录" : "今日已记录");

    const bar = document.querySelector('[data-bind="progressBar"]');
    const wrap = bar ? bar.parentElement : null;
    const ratio = (notStarted ? 0 : ended ? TOTAL : currentDay) / TOTAL;
    if (wrap) wrap.setAttribute("aria-valuenow", String(Math.round(ratio * TOTAL)));
    if (bar) requestAnimationFrame(() => { bar.style.width = `${ratio * 100}%`; });

    setText("ptClock", clockPT());
    const ruleLink = document.querySelector('[data-bind="ruleLink"]');
    if (ruleLink && C.ruleUrl) ruleLink.href = C.ruleUrl;
    setText("ruleZh", C.ruleZh || "");

    const through = document.querySelector('[data-bind="dataThrough"]');
    if (through) {
      through.textContent = lastDate.replace(/-/g, ".");
      through.setAttribute("datetime", lastDate);
    }
  }

  // ── 账本 ──────────────────────────────────────────────
  function cellState(dayNum, iso) {
    const rec = byDay.get(dayNum);
    if (rec) return { kinds: rec.kinds || [], state: "done" };
    if (iso > today) return { kinds: [], state: "upcoming" };
    return { kinds: [], state: "pending" };
  }

  function renderLedger() {
    const grid = document.getElementById("ledgerGrid");
    if (!grid) return;
    let html = "";
    const SHORT = { ship: "发布", reset: "重置", banked: "储备" };
    for (let i = 1; i <= TOTAL; i++) {
      const iso = addDays(START, i - 1);
      const { kinds, state } = cellState(i, iso);
      const primary = state === "done" ? kinds[0] : state;
      const label =
        state === "done"
          ? kinds.map((k) => KIND[k]).join(" + ")
          : state === "pending"
            ? "等待中"
            : "未开始";
      const tag =
        state === "done"
          ? SHORT[kinds[0]] + (kinds.length > 1 ? "+" : "")
          : state === "pending"
            ? "等待"
            : "—";
      const title = byDay.get(i) ? byDay.get(i).title : label;
      const bars =
        state === "done"
          ? kinds.map((k) => `<i class="b-${k}"></i>`).join("")
          : `<i class="b-${state}"></i>`;
      const tip = `${i}. ${md(iso)} · ${label}${byDay.get(i) ? " · " + title : ""}`;

      html += `
        <button class="cell cell--${primary}" type="button" role="listitem"
          data-day="${i}" data-tip="${esc(tip)}" data-kinds="${kinds.join(" ") || state}"
          aria-label="第 ${i} 天，${md(iso)}，${label}${byDay.get(i) ? "：" + esc(title) : ""}">
          <span class="cell__num">${pad(i)}</span>
          <span class="cell__tag">${tag}</span>
          <span class="cell__bar">${bars}</span>
        </button>`;
    }
    grid.innerHTML = html;
  }

  // ── 逐日卡片 ──────────────────────────────────────────
  function reactionHTML(r) {
    if (!r || !(r.praise || r.meh)) return "";
    const total = r.praise + r.meh;
    const pct = Math.round((r.praise / total) * 100);
    return `
      <span class="reactions" title="X 互动：鼓掌 ${fmtNum(r.praise)} · 无感 ${fmtNum(r.meh)}">
        <span class="reactions__bar"><i style="width:${pct}%"></i></span>
        <span><b>${pct}%</b> 鼓掌 · ${fmtNum(r.praise)} 对 ${fmtNum(r.meh)}</span>
      </span>`;
  }

  function itemHTML(item) {
    const title = item.url
      ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>`
      : esc(item.title);
    return `
      <li>
        <div class="item__head">
          <h4 class="item__title">${title}</h4>
          ${reactionHTML(item)}
        </div>
        ${item.summary ? `<p class="item__summary">${esc(item.summary)}</p>` : ""}
      </li>`;
  }

  function dayCard(d) {
    const iso = d.date || addDays(START, d.day - 1);
    const isAuto = d.source === "auto";
    const chips =
      (d.kinds || [])
        .map((k) => `<span class="chip chip--${k}">${KIND[k] || k}</span>`)
        .join("") + (isAuto ? `<span class="chip chip--auto" title="由 tools/sync.mjs 自动收录">自动</span>` : "");
    const title = d.url
      ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)}</a>`
      : esc(d.title);

    let body = d.summary
      ? `<p class="day__summary">${esc(d.summary)}</p>`
      : `<p class="day__summary day__summary--todo">自动收录，中文摘要待补。原文在下面，点标题可跳转。</p>`;

    if (d.quote) {
      body += `
        <blockquote class="quote">
          <p>${esc(d.quote)}</p>
          ${d.quoteZh ? `<p class="zh">${esc(d.quoteZh)}</p>` : ""}
        </blockquote>`;
    }

    if (d.postText) {
      body += `
        <blockquote class="quote quote--post">
          <p>${esc(d.postText)}</p>
        </blockquote>`;
    }

    if (d.items && d.items.length) {
      body += `<ul class="items">${d.items.map(itemHTML).join("")}</ul>`;
    }

    const tags = (d.tags || []).map((t) => `<li>${esc(t)}</li>`).join("");
    const src = d.url
      ? `<a class="day__src" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">原帖 ↗</a>`
      : "";
    const note =
      d.note ||
      (isAuto
        ? d.summarySource === "llm"
          ? "自动同步 · 摘要由模型整理，可校订"
          : "自动同步 · 标题与正文取自 X 原帖"
        : null);

    return `
      <article class="day${isAuto ? " day--auto" : ""}" id="day-${d.day}" data-kinds="${(d.kinds || []).join(" ")}">
        <div class="day__marker">
          <span class="day__num">${pad(d.day)}</span>
          <span class="day__date">${md(iso)}</span>
          <span class="day__wd">${weekday(iso)}</span>
        </div>
        <div class="day__body">
          <div class="day__top">${chips}</div>
          <h3 class="day__title">${title}</h3>
          ${body}
          <div class="day__foot">
            ${tags ? `<ul class="tags">${tags}</ul>` : ""}
            ${reactionHTML(d.reactions)}
            ${src}
          </div>
          ${note ? `<p class="day__note">${esc(note)}</p>` : ""}
        </div>
      </article>`;
  }

  function pendingCard() {
    const iso = addDays(START, currentDay - 1);
    return `
      <article class="day day--pending" id="day-${currentDay}" data-kinds="pending">
        <div class="day__marker">
          <span class="day__num">${pad(currentDay)}</span>
          <span class="day__date">${md(iso)}</span>
          <span class="day__wd">${weekday(iso)}</span>
        </div>
        <div class="day__body">
          <div class="day__top">
            <span class="chip chip--pending"><span class="pulse" aria-hidden="true"></span>等待判定</span>
          </div>
          <h3 class="day__title">今天还没有结论</h3>
          <p class="day__summary">第 ${currentDay} 天正在进行。Tibo 还没发今天的改进或重置，账本先留一个空位；过了今晚，这里会自动变成下一天。</p>
          <p class="day__note">数据截至 ${lastDate}（PT）· 美西时间 ${clockPT()}</p>
        </div>
      </article>`;
  }

  function renderDays() {
    const wrap = document.getElementById("days");
    if (!wrap) return;
    let html = "";
    if (isTodayPending) html += pendingCard();
    DAYS.slice()
      .sort((a, b) => b.day - a.day)
      .forEach((d) => { html += dayCard(d); });
    wrap.innerHTML = html;
  }

  // ── 未来列表 ──────────────────────────────────────────
  function renderFuture() {
    const wrap = document.getElementById("futureList");
    if (!wrap) return;
    const from = (ended ? TOTAL : currentDay) + 1;
    const days = [];
    for (let i = from; i <= TOTAL; i++) {
      const iso = addDays(START, i - 1);
      days.push(
        `<li class="${i === TOTAL ? "is-last" : ""}">
          <span class="f-day">DAY ${pad(i)}</span>
          <span class="f-date">${md(iso)}</span>
        </li>`
      );
    }
    wrap.innerHTML = days.join("");
    const section = document.getElementById("future");
    if (section && !days.length) section.hidden = true;
  }

  // ── 筛选 ──────────────────────────────────────────────
  function renderCounts() {
    const all = document.querySelector('[data-count="all"]');
    if (all) all.textContent = String(noted);
    ["ship", "reset", "banked"].forEach((k) => {
      const el = document.querySelector(`[data-count="${k}"]`);
      if (el) el.textContent = String(counts[k]);
    });
  }

  function bindFilters() {
    const group = document.querySelector(".filters");
    if (!group) return;
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter");
      if (!btn) return;
      const filter = btn.dataset.filter;
      group.querySelectorAll(".filter").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      document.querySelectorAll(".day").forEach((el) => {
        const kinds = (el.dataset.kinds || "").split(" ").filter(Boolean);
        const match = filter === "all" || kinds.includes(filter);
        el.classList.toggle("is-dim", !match);
      });
    });
  }

  // ── 账本交互 ──────────────────────────────────────────
  function bindLedger() {
    const grid = document.getElementById("ledgerGrid");
    if (!grid) return;

    grid.addEventListener("click", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell) return;
      const target = document.getElementById(`day-${cell.dataset.day}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.remove("is-flash");
      void target.offsetWidth;
      target.classList.add("is-flash");
    });

    const tip = document.createElement("div");
    tip.className = "tip";
    tip.setAttribute("role", "status");
    document.body.appendChild(tip);

    const show = (cell) => {
      if (!cell.dataset.tip) return;
      tip.textContent = cell.dataset.tip;
      tip.classList.add("is-on");
      const r = cell.getBoundingClientRect();
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      let left = r.left + r.width / 2 - w / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      let top = r.top - h - 8;
      if (top < 8) top = r.bottom + 8;
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    };
    const hide = () => tip.classList.remove("is-on");

    grid.addEventListener("pointerover", (e) => {
      const cell = e.target.closest(".cell");
      if (cell) show(cell);
    });
    grid.addEventListener("pointerout", (e) => {
      const cell = e.target.closest(".cell");
      if (cell && !cell.contains(e.relatedTarget)) hide();
    });
    grid.addEventListener("focusin", (e) => {
      const cell = e.target.closest(".cell");
      if (cell) show(cell);
    });
    grid.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, { passive: true });
  }

  // ── 键盘 j / k ────────────────────────────────────────
  function bindKeys() {
    let index = 0;
    document.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== "j" && key !== "k" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;

      const items = Array.from(document.querySelectorAll(".day"));
      if (!items.length) return;

      // 以视口上沿为基准，找到当前所在的那一天
      let current = items.findIndex((el) => el.getBoundingClientRect().top > 90);
      current = current === -1 ? items.length - 1 : Math.max(0, current - 1);

      const dir = key === "j" || e.key === "ArrowDown" ? 1 : -1;
      index = Math.min(items.length - 1, Math.max(0, current + dir));
      e.preventDefault();
      items[index].scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // ── 时钟 ──────────────────────────────────────────────
  function startClock() {
    const tick = () => setText("ptClock", clockPT());
    tick();
    setInterval(tick, 30000);
  }

  // ── 启动 ──────────────────────────────────────────────
  function init() {
    renderHero();
    renderLedger();
    renderDays();
    renderFuture();
    renderCounts();
    bindFilters();
    bindLedger();
    bindKeys();
    startClock();
    document.body.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
