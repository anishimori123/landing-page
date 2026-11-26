// "My calendar": a month view of my Google Calendar, like a phone calendar widget.
// Each day shows small event boxes; click a day for details, click an event to
// change or delete it. Sign-in uses Google's own window. Events go straight from
// Google to this browser; nothing is saved in the repo. Settings: config.js.
(() => {
  "use strict";
  const C = window.CONFIG;
  const el = window.LP.el;
  const $ = (sel) => document.querySelector(sel);

  const API = "https://www.googleapis.com/calendar/v3";
  const SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly", // see all my calendars
    "https://www.googleapis.com/auth/calendar.events",   // add, change, delete events
  ];
  const MAX_BOXES = 3; // event boxes per day before "+N more"
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let token = null;        // { access_token, expires_at }
  let tokenClient = null;
  let calendars = [];      // { id, name, color, primary, writable }
  let events = [];         // normalized events
  let fetched = null;      // { from, to } range already loaded
  let shown = { y: new Date().getFullYear(), m: new Date().getMonth() }; // month on screen
  let selectedDay = null;  // "YYYY-MM-DD" clicked, else today
  let editing = null;      // event being edited, or a new draft
  let busy = false;
  let todayKeyNow = "";

  // ---------- small helpers ----------
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "#7aa2f7");
  const activeDay = () => selectedDay || dayKey(today0());

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };

  function body() { return $("#gcal-body"); }
  function show(...kids) { body().replaceChildren(...kids.flat().filter(Boolean)); }
  function note(text, ...extra) { show(el("p", { class: "muted" }, text), ...extra); }

  function setTools(signedIn) {
    $("#gcal-add").hidden = !signedIn;
    $("#gcal-refresh").hidden = !signedIn;
    $("#gcal-signout").hidden = !signedIn;
  }

  // ---------- month grid ----------
  function gridRange() {
    const first = new Date(shown.y, shown.m, 1);
    const from = addDays(first, -first.getDay()); // Sunday before the 1st
    const last = new Date(shown.y, shown.m + 1, 0);
    const to = addDays(last, 7 - last.getDay());   // day after the Saturday after the last day
    return { from, to };
  }

  // White or dark text, whichever reads better on the event color
  function textOn(hex) {
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.62 ? "#10131a" : "#ffffff";
  }

  function eventBox(e) {
    return el("button", {
      type: "button",
      class: "ev-box",
      style: `background:${e.color};color:${textOn(e.color)}`,
      title: `${e.allDay ? "All day" : fmtTime(e.start) + " – " + fmtTime(e.end)} · ${e.title}${e.location ? " · " + e.location : ""}`,
      onclick: (ev) => { ev.stopPropagation(); openForm(e); },
    }, e.title);
  }

  function renderGrid() {
    const first = new Date(shown.y, shown.m, 1);
    $("#cal-title").textContent = first.toLocaleDateString("en-US",
      first.getFullYear() === new Date().getFullYear() ? { month: "long" } : { month: "long", year: "numeric" });
    const { from, to } = gridRange();
    const tKey = dayKey(today0());
    const cells = ["S", "M", "T", "W", "T", "F", "S"].map((d) => el("div", { class: "mg-dow" }, d));
    for (let d = from; d < to; d = addDays(d, 1)) {
      const key = dayKey(d);
      const list = token ? eventsOn(d) : [];
      const inMonth = d.getMonth() === shown.m;
      const boxes = list.slice(0, MAX_BOXES).map(eventBox);
      const more = list.length > MAX_BOXES ? el("div", { class: "ev-more" }, `+${list.length - MAX_BOXES} more`) : null;
      cells.push(el("div", {
        class: "mg-day" + (inMonth ? "" : " other") + (key === tKey ? " today" : "") +
          (token && key === activeDay() ? " selected" : "") + (d.getDay() === 0 || d.getDay() === 6 ? " weekend" : ""),
        role: "button", tabindex: "0",
        "aria-label": d.toDateString() + (list.length ? `, ${list.length} event${list.length > 1 ? "s" : ""}` : ""),
        onclick: () => pickDay(key),
        onkeydown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pickDay(key); } },
      },
        el("div", { class: "mg-num" }, el("span", {}, d.getDate())),
        boxes, more));
    }
    $("#month-grid").replaceChildren(...cells);
  }

  function pickDay(key) {
    if (!token) {
      const d = parseDay(key);
      window.open(`https://calendar.google.com/calendar/u/0/r/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`, "_blank", "noopener");
      return;
    }
    selectedDay = key;
    editing = null;
    renderGrid();
    render();
  }

  function moveMonth(step) {
    const d = new Date(shown.y, shown.m + step, 1);
    shown = { y: d.getFullYear(), m: d.getMonth() };
    renderGrid();
    if (token) refresh();
  }

  // ---------- sign-in ----------
  function loadToken() {
    const t = store.get("lp.gcal.token");
    return t && t.access_token && t.expires_at > Date.now() + 60e3 ? t : null;
  }

  function initClient() {
    if (tokenClient) return true;
    const oauth = window.google && window.google.accounts && window.google.accounts.oauth2;
    if (!oauth) return false;
    tokenClient = oauth.initTokenClient({
      client_id: C.googleClientId,
      scope: SCOPES.join(" "),
      callback: (resp) => {
        if (resp.error) { signedOutView(`Sign-in didn't finish (${resp.error}).`); return; }
        if (!oauth.hasGrantedAllScopes(resp, ...SCOPES)) {
          signedOutView("Please tick both calendar boxes on Google's screen, so the page can show and edit your events.");
          return;
        }
        token = { access_token: resp.access_token, expires_at: Date.now() + (Number(resp.expires_in) || 3600) * 1000 };
        store.set("lp.gcal.token", token);
        store.set("lp.gcal.connected", true);
        refresh(true);
      },
      error_callback: (err) => {
        signedOutView(err && err.type === "popup_closed"
          ? "The Google window was closed before sign-in finished."
          : "Couldn't open Google's sign-in window. Allow pop-ups for this page, then try again.");
      },
    });
    return true;
  }

  function signIn() {
    if (!initClient()) { signedOutView("Google sign-in is still loading. Try again in a few seconds."); return; }
    tokenClient.requestAccessToken({ prompt: "" });
  }

  function signOut() {
    token = null;
    store.set("lp.gcal.token", null);
    store.set("lp.gcal.connected", null);
    calendars = []; events = []; fetched = null; editing = null; selectedDay = null;
    signedOutView();
  }

  function signedOutView(message) {
    setTools(false);
    renderGrid();
    const again = store.get("lp.gcal.connected");
    note(message || (again
      ? "Your Google sign-in timed out (Google allows about 1 hour). One click to reconnect."
      : "Sign in with Google to see and edit your events in this calendar. (Until then, clicking a day opens Google Calendar.)"),
      el("button", { type: "button", class: "google-btn", onclick: signIn }, again ? "🔄 Reconnect Google Calendar" : "🔐 Sign in with Google"));
  }

  // ---------- talking to Google Calendar ----------
  async function api(path, { method = "GET", data } = {}) {
    if (!token || token.expires_at < Date.now()) throw Object.assign(new Error("Signed out"), { auth: true });
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: "Bearer " + token.access_token, ...(data ? { "Content-Type": "application/json" } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (res.status === 401) {
      token = null;
      store.set("lp.gcal.token", null);
      throw Object.assign(new Error("Sign-in expired"), { auth: true });
    }
    if (!res.ok) {
      let msg = "Google answered " + res.status;
      try { msg = (await res.json()).error.message || msg; } catch { /* keep status */ }
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }

  function wantedRange() {
    const r = gridRange();
    const t = today0();
    if (t < r.from) r.from = t;
    if (addDays(t, 1) > r.to) r.to = addDays(t, 1);
    if (selectedDay) {
      const d = parseDay(selectedDay);
      if (d < r.from) r.from = d;
      if (addDays(d, 1) > r.to) r.to = addDays(d, 1);
    }
    return r;
  }
  const haveRange = (r) => fetched && fetched.from <= r.from && fetched.to >= r.to;

  function normalize(e, cal) {
    const allDay = Boolean(e.start && e.start.date);
    return {
      id: e.id,
      calId: cal.id,
      calName: cal.name,
      color: cal.color,
      writable: cal.writable && !e.locked,
      title: e.summary || "(no title)",
      location: e.location || "",
      allDay,
      start: allDay ? parseDay(e.start.date) : new Date(e.start.dateTime),
      end: allDay ? parseDay(e.end.date) : new Date(e.end.dateTime), // all-day end is the day AFTER
      recurring: Boolean(e.recurringEventId),
      link: e.htmlLink || "",
    };
  }

  async function refresh(force = false) {
    if (!token) { signedOutView(); return; }
    setTools(true);
    const range = wantedRange();
    if (!force && haveRange(range)) { renderGrid(); render(); return; }
    if (!events.length) note("Loading your calendar…");
    try {
      if (!calendars.length || force) {
        const list = await api("/users/me/calendarList?maxResults=250");
        calendars = (list.items || []).filter((c) => !c.hidden).map((c) => ({
          id: c.id,
          name: c.summaryOverride || c.summary || "Calendar",
          color: safeColor(c.backgroundColor),
          primary: Boolean(c.primary),
          writable: c.accessRole === "owner" || c.accessRole === "writer",
        }));
      }
      const q = new URLSearchParams({
        timeMin: range.from.toISOString(), timeMax: range.to.toISOString(),
        singleEvents: "true", orderBy: "startTime", maxResults: "250",
      });
      const lists = await Promise.all(calendars.map((cal) =>
        api(`/calendars/${encodeURIComponent(cal.id)}/events?${q}`)
          .then((r) => (r.items || []).filter((e) => e.status !== "cancelled" && e.start).map((e) => normalize(e, cal)))
          .catch((err) => { if (err.auth) throw err; console.warn("Calendar skipped:", cal.name, err.message); return []; })));
      events = lists.flat().sort((a, b) => (a.allDay === b.allDay ? a.start - b.start : a.allDay ? -1 : 1));
      fetched = range;
      renderGrid();
      render();
    } catch (err) {
      if (err.auth) { signedOutView(); return; }
      console.error(err);
      note("Couldn't load your calendar: " + err.message,
        el("button", { type: "button", onclick: () => refresh(true) }, "Try again"));
    }
  }

  function eventsOn(day) {
    const from = day, to = addDays(day, 1);
    return events.filter((e) => e.start < to && (e.end > from || (e.end.getTime() === e.start.getTime() && e.start >= from)));
  }

  // ---------- day details (below the grid) ----------
  function dayTitle(d) {
    const t = today0();
    const label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    if (dayKey(d) === dayKey(t)) return "Today · " + label;
    if (dayKey(d) === dayKey(addDays(t, 1))) return "Tomorrow · " + label;
    return label;
  }

  function eventRow(e) {
    const when = e.allDay ? "All day" : `${fmtTime(e.start)} – ${fmtTime(e.end)}`;
    return el("button", {
      type: "button", class: "gcal-event",
      title: e.writable ? "Click to change or delete" : `${e.calName} (view only)`,
      onclick: () => openForm(e),
    },
      el("span", { class: "gcal-dot", style: `background:${e.color}` }),
      el("span", { class: "gcal-time" }, when),
      el("span", { class: "gcal-title" }, e.title, e.location ? el("small", {}, " · " + e.location) : null));
  }

  function render() {
    if (!token) { signedOutView(); return; }
    if (editing) { show(formView()); return; }
    const d = parseDay(activeDay());
    const list = eventsOn(d);
    show(el("div", { class: "gcal-day" },
      el("div", { class: "gcal-day-head" },
        el("span", { class: "gcal-date" + (dayKey(d) === dayKey(today0()) ? " is-today" : "") }, dayTitle(d)),
        el("button", { type: "button", class: "link-btn", onclick: () => openForm(null, d) }, "＋ Add on this day")),
      list.length ? list.map(eventRow) : el("div", { class: "gcal-none" }, "No events")));
  }

  // ---------- add / change / delete ----------
  function openForm(e, day) {
    if (e) {
      editing = { ...e };
    } else {
      const base = day || parseDay(activeDay());
      const now = new Date();
      let start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), now.getHours() + 1, 0);
      if (dayKey(base) !== dayKey(now)) start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0);
      const primary = calendars.find((c) => c.primary && c.writable) || calendars.find((c) => c.writable);
      editing = { isNew: true, allDay: false, title: "", location: "", start, end: new Date(start.getTime() + 3600e3), calId: primary ? primary.id : "primary", writable: true };
    }
    render();
    const first = body().querySelector("input:not([disabled])");
    if (first) first.focus();
    if (body().scrollIntoView) body().scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function formView() {
    const e = editing;
    const readOnly = !e.isNew && !e.writable;
    const endDay = e.allDay ? addDays(e.end, -1) : e.end;
    const f = el("form", { class: "gcal-form", onsubmit: (ev) => { ev.preventDefault(); save(f); } },
      el("div", { class: "gcal-form-title" }, e.isNew ? "＋ New event" : readOnly ? "Event (view only)" : "✏️ Change event"),
      el("label", {}, "Title", el("input", { name: "title", value: e.title === "(no title)" ? "" : e.title, placeholder: "Watch a movie", disabled: readOnly })),
      el("label", { class: "check" }, el("input", { type: "checkbox", name: "allDay", checked: e.allDay, disabled: readOnly,
        onchange: (ev) => { f.classList.toggle("all-day", ev.target.checked); } }), "All day"),
      el("div", { class: "row" },
        el("label", {}, "Starts", el("input", { type: "date", name: "startDate", value: dayKey(e.start), disabled: readOnly })),
        el("label", { class: "time-field" }, "Time", el("input", { type: "time", name: "startTime", value: timeOf(e.start), disabled: readOnly }))),
      el("div", { class: "row" },
        el("label", {}, "Ends", el("input", { type: "date", name: "endDate", value: dayKey(endDay), disabled: readOnly })),
        el("label", { class: "time-field" }, "Time", el("input", { type: "time", name: "endTime", value: timeOf(e.end), disabled: readOnly }))),
      el("label", {}, "Place (optional)", el("input", { name: "location", value: e.location, placeholder: "AMC Metreon", disabled: readOnly })),
      e.isNew && calendars.filter((c) => c.writable).length > 1
        ? el("label", {}, "Calendar", el("select", { name: "calId" },
            calendars.filter((c) => c.writable).map((c) => el("option", { value: c.id, selected: c.id === e.calId }, c.name))))
        : el("div", { class: "muted tiny" }, "Calendar: " + ((calendars.find((c) => c.id === e.calId) || {}).name || "My calendar")),
      e.recurring && !readOnly ? el("div", { class: "muted tiny" }, "🔁 This is a repeating event. Changes apply to this day only.") : null,
      el("div", { class: "gcal-error", role: "alert" }),
      el("div", { class: "gcal-actions" },
        readOnly ? null : el("button", { type: "submit", class: "primary" }, e.isNew ? "Add event" : "Save"),
        el("button", { type: "button", onclick: () => { editing = null; render(); } }, readOnly ? "Close" : "Cancel"),
        !e.isNew && !readOnly ? el("button", { type: "button", class: "danger", onclick: () => askDelete(f) }, "Delete") : null,
        e.link ? el("a", { href: e.link, target: "_blank", rel: "noopener", class: "tiny" }, "Open in Google Calendar ↗") : null),
      el("div", { class: "gcal-confirm", hidden: true }));
    if (e.allDay) f.classList.add("all-day");
    return f;
  }

  function formError(f, msg) { f.querySelector(".gcal-error").textContent = msg; }

  function readForm(f) {
    const v = (n) => (f.elements[n] ? f.elements[n].value.trim() : "");
    const allDay = f.elements.allDay.checked;
    const title = v("title");
    const sd = v("startDate"), ed = v("endDate") || sd;
    if (!title) return { error: "Type a title first." };
    if (!sd) return { error: "Pick a start date." };
    const data = { summary: title, location: v("location") };
    if (allDay) {
      if (ed < sd) return { error: "The end date is before the start date." };
      data.start = { date: sd };
      data.end = { date: dayKey(addDays(parseDay(ed), 1)) }; // Google wants the day after
    } else {
      const st = v("startTime"), et = v("endTime");
      if (!st || !et) return { error: "Pick a start and end time, or tick All day." };
      const start = new Date(`${sd}T${st}`), end = new Date(`${ed}T${et}`);
      if (!(end > start)) return { error: "The end must be after the start." };
      data.start = { dateTime: start.toISOString(), timeZone: TZ };
      data.end = { dateTime: end.toISOString(), timeZone: TZ };
    }
    const calId = f.elements.calId ? f.elements.calId.value : editing.calId;
    return { data, calId, day: sd };
  }

  async function save(f) {
    if (busy) return;
    const r = readForm(f);
    if (r.error) { formError(f, r.error); return; }
    busy = true;
    const btn = f.querySelector("button.primary");
    const old = btn.textContent;
    btn.textContent = "Saving…";
    try {
      const cal = encodeURIComponent(r.calId);
      if (editing.isNew) await api(`/calendars/${cal}/events`, { method: "POST", data: r.data });
      else {
        // Turning a timed event into all-day (or back) needs the other field cleared
        if (r.data.start.date) { r.data.start.dateTime = null; r.data.end.dateTime = null; r.data.start.timeZone = null; r.data.end.timeZone = null; }
        else { r.data.start.date = null; r.data.end.date = null; }
        await api(`/calendars/${cal}/events/${encodeURIComponent(editing.id)}`, { method: "PATCH", data: r.data });
      }
      editing = null;
      selectedDay = r.day; // show the day the event is on
      const d = parseDay(r.day);
      shown = { y: d.getFullYear(), m: d.getMonth() };
      await refresh(true);
    } catch (err) {
      if (err.auth) { editing = null; signedOutView(); return; }
      formError(f, "Couldn't save: " + err.message);
      btn.textContent = old;
    } finally {
      busy = false;
    }
  }

  function askDelete(f) {
    const box = f.querySelector(".gcal-confirm");
    box.hidden = false;
    box.replaceChildren(
      el("span", {}, `Delete "${editing.title}"? This can't be undone here.`),
      el("button", { type: "button", class: "danger", onclick: () => doDelete(f) }, "Yes, delete"),
      el("button", { type: "button", onclick: () => { box.hidden = true; } }, "No"));
  }

  async function doDelete(f) {
    if (busy) return;
    busy = true;
    try {
      await api(`/calendars/${encodeURIComponent(editing.calId)}/events/${encodeURIComponent(editing.id)}`, { method: "DELETE" });
      editing = null;
      await refresh(true);
    } catch (err) {
      if (err.auth) { editing = null; signedOutView(); return; }
      formError(f, "Couldn't delete: " + err.message);
    } finally {
      busy = false;
    }
  }

  // ---------- wire up ----------
  function start() {
    todayKeyNow = dayKey(today0());
    $("#cal-prev").addEventListener("click", () => moveMonth(-1));
    $("#cal-next").addEventListener("click", () => moveMonth(1));
    $("#cal-title").addEventListener("click", () => {
      const n = new Date();
      shown = { y: n.getFullYear(), m: n.getMonth() };
      selectedDay = null;
      renderGrid();
      if (token) refresh(); else signedOutView();
    });
    if (!C.googleClientId) { renderGrid(); note("Google Calendar isn't set up (googleClientId is empty in config.js)."); return; }
    $("#gcal-add").addEventListener("click", () => openForm(null));
    $("#gcal-refresh").addEventListener("click", () => refresh(true));
    $("#gcal-signout").addEventListener("click", signOut);

    token = loadToken();
    if (token) { renderGrid(); refresh(true); }
    else signedOutView();

    // Keep it fresh: every 5 minutes; move "today" at midnight
    setInterval(() => {
      const k = dayKey(today0());
      if (k !== todayKeyNow) { todayKeyNow = k; renderGrid(); if (token && !editing) render(); }
      if (token && !editing && document.visibilityState === "visible") refresh(true);
    }, 5 * 60e3);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (token && token.expires_at < Date.now()) { token = null; signedOutView(); }
    });
  }

  start();
})();
