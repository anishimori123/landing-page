// News box: tabs per news source, buttons per genre, latest headlines.
// Browsers can't read most news feeds directly (the publisher blocks it), so the
// feed is fetched through rss2json.com (free, no account). Only headlines and
// links are shown; clicking opens the article on the publisher's site.
(() => {
  "use strict";
  const C = window.CONFIG;
  const el = window.LP.el;
  const $ = (sel) => document.querySelector(sel);
  const SOURCES = C.news || [];
  const PER = C.newsPerGenre || 10;
  const CACHE_MINUTES = 15;
  const READER = "https://api.rss2json.com/v1/api.json?rss_url=";

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };

  let pick = store.get("lp.news.pick", { s: 0, g: 0 });
  if (!SOURCES[pick.s]) pick = { s: 0, g: 0 };
  if (SOURCES[pick.s] && SOURCES[pick.s].genres && !SOURCES[pick.s].genres[pick.g]) pick.g = 0;
  let loadId = 0;

  const genre = () => SOURCES[pick.s].genres[pick.g];

  // "2026-11-25 22:10:00" (UTC) -> Date
  function parseDate(s) {
    if (!s) return null;
    const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? s.replace(" ", "T") + "Z" : s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function ago(d) {
    if (!d) return "";
    const min = Math.round((Date.now() - d.getTime()) / 60e3);
    if (min < 1) return "just now";
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const safeLink = (u) => (/^https?:\/\//i.test(u || "") ? u : null);

  // A "links" source (like 日経): big buttons to the real site + its search box
  function renderLinks(src) {
    $("#news-genres").replaceChildren();
    $("#news-updated").textContent = "Opens the real pages in a new tab (you stay logged in there).";
    const form = src.search ? el("form", { class: "news-search", role: "search",
      onsubmit: (ev) => {
        ev.preventDefault();
        const q = form.elements.q.value.trim();
        if (q) window.open(src.search + encodeURIComponent(q), "_blank", "noopener");
      } },
      el("input", { name: "q", type: "search", placeholder: `${src.source}で検索`, "aria-label": `Search ${src.source}` }),
      el("button", { type: "submit" }, "検索")) : null;
    $("#news-list").replaceChildren(
      el("div", { class: "news-links" }, src.links.map((l) =>
        el("a", { class: "news-link", href: l.url, target: "_blank", rel: "noopener" }, l.name))),
      form);
  }

  function renderTabs() {
    $("#news-sources").replaceChildren(...SOURCES.map((src, i) => el("button", {
      type: "button", role: "tab", class: i === pick.s ? "on" : "", "aria-selected": String(i === pick.s),
      onclick: () => { pick = { s: i, g: 0 }; store.set("lp.news.pick", pick); renderTabs(); load(); },
    }, src.source)));
    if (SOURCES[pick.s].links) return;
    $("#news-genres").replaceChildren(...SOURCES[pick.s].genres.map((g, i) => el("button", {
      type: "button", role: "tab", class: "pill" + (i === pick.g ? " on" : ""), "aria-selected": String(i === pick.g),
      onclick: () => { pick.g = i; store.set("lp.news.pick", pick); renderTabs(); load(); },
    }, g.name)));
  }

  function renderItems(items, at, stale) {
    const list = items.slice(0, PER).map((it) => {
      const link = safeLink(it.link);
      const d = parseDate(it.pubDate);
      return el("li", {},
        link ? el("a", { href: link, target: "_blank", rel: "noopener" }, it.title || "(no title)") : el("span", {}, it.title || "(no title)"),
        el("span", { class: "news-time", title: d ? d.toLocaleString() : "" }, ago(d)));
    });
    $("#news-list").replaceChildren(list.length ? el("ol", {}, list) : el("p", { class: "muted" }, "No headlines right now."));
    $("#news-updated").textContent = (stale ? "Couldn't refresh. Showing headlines from " : "Updated ") +
      new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + " · via rss2json.com";
  }

  async function load(force = false) {
    if (!SOURCES.length) { $("#news-list").replaceChildren(el("p", { class: "muted" }, "No news sources in config.js.")); return; }
    if (SOURCES[pick.s].links) { renderLinks(SOURCES[pick.s]); return; }
    const g = genre();
    const key = "lp.news.cache." + g.url;
    const cached = store.get(key, null);
    if (!force && cached && Date.now() - cached.at < CACHE_MINUTES * 60e3) { renderItems(cached.items, cached.at); return; }
    const myId = ++loadId;
    if (!cached) $("#news-list").replaceChildren(el("p", { class: "muted" }, "Loading headlines…"));
    try {
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), 12e3);
      const res = await fetch(READER + encodeURIComponent(g.url), { signal: stop.signal });
      clearTimeout(timer);
      const json = await res.json();
      if (myId !== loadId) return; // user clicked another genre meanwhile
      if (json.status !== "ok") throw new Error(json.message || "Feed reader said no");
      const items = (json.items || []).map((it) => ({ title: it.title, link: it.link, pubDate: it.pubDate }));
      store.set(key, { at: Date.now(), items });
      renderItems(items, Date.now());
    } catch (err) {
      if (myId !== loadId) return;
      console.warn("News:", err.message);
      if (cached) renderItems(cached.items, cached.at, true);
      else $("#news-list").replaceChildren(el("p", { class: "muted" }, "Couldn't load headlines right now. Tap ↻ to try again."));
    }
  }

  renderTabs();
  load();
  $("#news-refresh").addEventListener("click", () => load(true));
  setInterval(() => { if (document.visibilityState === "visible") load(); }, CACHE_MINUTES * 60e3);
})();
