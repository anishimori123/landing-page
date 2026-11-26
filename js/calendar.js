// "My calendar": shows and edits my Google Calendar events.
// Sign-in uses Google's own window. Events go straight from Google to this
// browser; nothing is saved in the repo. Settings: googleClientId in config.js.
(() => {
  "use strict";
  const C = window.CONFIG;
  const LP = window.LP;
  const el = LP.el;
  const $ = (sel) => document.querySelector(sel);

  const API = "https://www.googleapis.com/calendar/v3";
  const SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly", // see all my calendars
    "https://www.googleapis.com/auth/calendar.events",   // add, change, delete events
  ];
  const DAYS_AHEAD = C.calendarDaysAhead || 7;
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let token = null;        // { access_token, expires_at }
  let tokenClient = null;
  let calendars = [];      // { id, name, color, primary, writable }
  let events = [];         // normalized events
  let fetched = null;      // { from, to } range already loaded
  let selectedDay = null;  // "YYYY-MM-DD" when a day is clicked, else null = next 7 days
  let editing = null;      // event being edited, or a new draft
  let busy = false;

  // ---------- small helpers ----------
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const timeOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || "") ? c : "#7aa2f7");

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
    calendars = []; events = []; fetched = null; editing = null;
    LP.setEventDays(new Set());
    signedOutView();
  }

  function signedOutView(message) {
    setTools(false);
    const again = store.get("lp.gcal.connected");
    note(message || (again
      ? "Your Google sign-in timed out (Google allows about 1 hour). One click to reconnect."
      : "Sign in with Google to see and edit your calendar here."),
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
    const t = today0();
    const { y, m } = LP.getShownMonth();
    let from = new Date(y, m, 1);
    let to = new Date(y, m + 1, 1);
    if (t < from) from = t;
    if (addDays(t, DAYS_AHEAD) > to) to = addDays(t, DAYS_AHEAD);
    if (selectedDay) {
      const d = parseDay(selectedDay);
      if (d < from) from = d;
      if (addDays(d, 1) > to) to = addDays(d, 1);
    }
    return { from, to };
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
    if (!force && haveRange(range)) { render(); return; }
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
      LP.setEventDays(eventDays());
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

  function eventDays() {
    const days = new Set();
    for (const e of events) {
      let d = new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate());
      const last = e.allDay ? addDays(e.end, -1) : e.end;
      for (let i = 0; d <= last && i < 62; i++, d = addDays(d, 1)) {
        if (eventsOn(d).includes(e)) days.add(dayKey(d));
      }
    }
    return days;
  }

  // ---------- list view ----------
  function dayTitle(d) {
    const t = today0();
    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (dayKey(d) === dayKey(t)) return "Today · " + label;
    if (dayKey(d) === dayKey(addDays(t, 1))) return "Tomorrow · " + label;
    return label;
  }

  function eventRow(e) {
    let when = "All day";
    if (!e.allDay) when = `${fmtTime(e.start)} – ${fmtTime(e.end)}`;
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
    const t = today0();
    const days = selectedDay ? [parseDay(selectedDay)] : [...Array(DAYS_AHEAD)].map((_, i) => addDays(t, i));
    const groups = [];
    for (const d of days) {
      const list = eventsOn(d);
      if (!list.length && !selectedDay && dayKey(d) !== dayKey(t)) continue; // skip empty days, but always show Today
      groups.push(el("div", { class: "gcal-day" },
        el("div", { class: "gcal-date" + (dayKey(d) === dayKey(t) ? " is-today" : "") }, dayTitle(d)),
        list.length ? list.map(eventRow) : el("div", { class: "gcal-none" }, "No events")));
    }
    const head = selectedDay
      ? el("div", { class: "gcal-note" }, "Showing one day. ",
          el("button", { type: "button", class: "link-btn", onclick: () => { selectedDay = null; LP.selectDay(null); render(); } }, `Show next ${DAYS_AHEAD} days`),
          " · ",
          el("button", { type: "button", class: "link-btn", onclick: () => openForm(null, parseDay(selectedDay)) }, "＋ Add on this day"))
      : null;
    if (!selectedDay && groups.length === 1 && !eventsOn(t).length) {
      groups.push(el("p", { class: "muted tiny" }, `Nothing else in the next ${DAYS_AHEAD} days.`));
    }
    show(head, groups);
  }

  // ---------- add / change / delete ----------
  function openForm(e, day) {
    if (e) {
      editing = { ...e };
    } else {
      const base = day || today0();
      const now = new Date();
      let start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), now.getHours() + 1, 0);
      if (dayKey(base) !== dayKey(now)) start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0);
      const primary = calendars.find((c) => c.primary && c.writable) || calendars.find((c) => c.writable);
      editing = { isNew: true, allDay: false, title: "", location: "", start, end: new Date(start.getTime() + 3600e3), calId: primary ? primary.id : "primary", writable: true };
    }
    render();
    const first = body().querySelector("input");
    if (first) first.focus();
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
    return { data, calId };
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
    if (!C.googleClientId) { note("Google Calendar isn't set up (googleClientId is empty in config.js)."); return; }
    $("#gcal-add").addEventListener("click", () => openForm(null, selectedDay ? parseDay(selectedDay) : null));
    $("#gcal-refresh").addEventListener("click", () => refresh(true));
    $("#gcal-signout").addEventListener("click", signOut);

    // Mini calendar: click a day = show that day (or open Google Calendar when signed out)
    window.addEventListener("lp:day", (ev) => {
      const key = ev.detail;
      if (!token) {
        const d = parseDay(key);
        window.open(`https://calendar.google.com/calendar/u/0/r/day/${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`, "_blank", "noopener");
        return;
      }
      selectedDay = selectedDay === key ? null : key;
      LP.selectDay(selectedDay);
      editing = null;
      refresh();
    });
    window.addEventListener("lp:month", () => { if (token) refresh(); });

    token = loadToken();
    if (token) refresh(true);
    else signedOutView();

    // Keep it fresh: every 5 minutes, and when coming back to the tab
    setInterval(() => { if (token && !editing && document.visibilityState === "visible") refresh(true); }, 5 * 60e3);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (token && token.expires_at < Date.now()) { token = null; signedOutView(); }
    });
  }

  start();
})();
