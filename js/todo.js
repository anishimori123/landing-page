// To-do box. The list is always saved in this browser, so it works signed out.
// When I'm signed in to Google (the calendar's sign-in) it also syncs with my
// Google Tasks list "My Tasks", so my PC and my phone show the same to-dos.
// Sign-in lives in calendar.js (window.LP.auth). Settings: config.js (googleTasks).
(() => {
  "use strict";
  const C = window.CONFIG;
  const { el, auth } = window.LP;
  const $ = (sel) => document.querySelector(sel);
  const API = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";
  const SYNC_ON = C.googleTasks !== false && Boolean(auth);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: ignore */ } },
  };

  // One to-do: { id, text, done, gid?, dirty?, pos? }
  //   gid   = its id at Google (missing until it has been uploaded)
  //   dirty = I ticked/unticked it here and Google doesn't know yet
  //   pos   = Google's sort order
  let todos = store.get("lp.todos", null) || C.starterTodos.map((text, i) => ({ id: Date.now() + i, text, done: false }));
  let dead = store.get("lp.todos.deleted", []); // Google ids I deleted here that Google still has
  const save = () => { store.set("lp.todos", todos); store.set("lp.todos.deleted", dead); };

  let running = false; // a sync is going on
  let again = false;   // something changed meanwhile: sync once more
  let lastSync = 0;
  let lastError = null;

  // ---------- screen ----------
  function render() {
    const list = $("#todo-list");
    if (!todos.length) list.replaceChildren(el("li", { class: "empty" }, "Nothing to do. Nice!"));
    else list.replaceChildren(...todos.map((t) => el("li", { class: t.done ? "done" : "" },
      el("input", { type: "checkbox", checked: t.done, "aria-label": `Done: ${t.text}`, onchange: () => toggle(t) }),
      el("span", { class: "text" }, t.text),
      el("button", { type: "button", class: "del", title: "Delete", "aria-label": `Delete ${t.text}`, onclick: () => remove([t]) }, "✕"))));
    renderStatus();
  }

  function renderStatus() {
    const box = $("#todo-status");
    if (!box) return;
    let text = "", warn = false;
    const waiting = todos.filter((t) => !t.gid || t.dirty).length + dead.length;
    if (!SYNC_ON) text = "Saved only in this browser.";
    else if (!auth.token()) {
      text = auth.connectedBefore()
        ? "Saved in this browser. Reconnect Google (in the calendar) to sync" + (waiting ? ` ${waiting} change${waiting > 1 ? "s" : ""}.` : ".")
        : "Saved only in this browser. Sign in with Google (in the calendar) to share this list with your phone.";
    } else if (!auth.canTasks()) {
      text = "Not syncing: the Google Tasks box wasn't ticked at sign-in. Sign out, sign in again and tick it.";
      warn = true;
    } else if (lastError) {
      warn = true;
      text = lastError.notOn
        ? "Not syncing yet: Google Tasks isn't switched on for this page (one-time step, see the README). To-dos stay saved in this browser."
        : `Couldn't sync with Google Tasks (${lastError.message}). To-dos stay saved in this browser; trying again in a few minutes.`;
    } else if (running) text = "Syncing with Google Tasks…";
    else if (lastSync) text = "Synced with Google Tasks at " + new Date(lastSync).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    box.textContent = text;
    box.classList.toggle("warn", warn);
  }

  // ---------- what I can do ----------
  function add(text) {
    todos = [...todos, { id: Date.now(), text, done: false }];
    changed();
  }
  function toggle(t) {
    t.done = !t.done;
    if (t.gid) t.dirty = true;
    changed();
  }
  function remove(items) {
    todos = todos.filter((t) => !items.includes(t));
    dead = [...dead, ...items.filter((t) => t.gid).map((t) => t.gid)];
    changed();
  }
  function changed() {
    save();
    render();
    sync();
  }

  // ---------- talking to Google Tasks ----------
  async function api(path, { method = "GET", data } = {}) {
    const token = auth.token();
    if (!token) throw new Error("signed out");
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: "Bearer " + token, ...(data ? { "Content-Type": "application/json" } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (method === "DELETE" && (res.status === 404 || res.status === 410)) return null; // already gone: fine
    if (!res.ok) {
      let msg = "Google answered " + res.status, reason = "";
      try {
        const e = (await res.json()).error;
        msg = e.message || msg;
        reason = JSON.stringify(e.errors || e.details || "");
      } catch { /* keep the status */ }
      const err = new Error(msg);
      err.notOn = res.status === 403 && /accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(msg + reason);
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  async function listAll() {
    const all = [];
    let page = "";
    for (let i = 0; i < 10; i++) { // 10 pages of 100 is plenty
      const q = new URLSearchParams({ maxResults: "100", showCompleted: "true", showHidden: "false" });
      if (page) q.set("pageToken", page);
      const r = await api("?" + q);
      all.push(...(r.items || []));
      page = r.nextPageToken || "";
      if (!page) break;
    }
    return all.filter((r) => !r.deleted && !r.hidden && (r.title || "").trim());
  }

  const isDone = (r) => r.status === "completed";
  const pushDone = (gid, done) => api("/" + encodeURIComponent(gid), {
    method: "PATCH",
    data: done ? { status: "completed" } : { status: "needsAction", completed: null },
  });

  // One round of syncing. Rules:
  //  - something I changed here wins over Google (it is the newer change)
  //  - a to-do that is gone at Google (deleted, or ticked in Google's own app) goes away here
  //  - a to-do that only exists at Google appears here; one that only exists here is uploaded
  async function syncOnce() {
    const remote = await listAll();
    const byId = new Map(remote.map((r) => [r.id, r]));

    // 1. Things I deleted here
    for (const gid of [...dead]) {
      if (byId.has(gid)) { await api("/" + encodeURIComponent(gid), { method: "DELETE" }); byId.delete(gid); }
      dead = dead.filter((x) => x !== gid);
      save();
    }

    // 2. Every to-do I have here
    const claimed = new Set(todos.filter((t) => t.gid).map((t) => t.gid));
    const tops = [...byId.values()].filter((r) => !r.parent).sort((a, b) => (a.position < b.position ? -1 : 1));
    let last = tops.length ? tops[tops.length - 1].id : ""; // new to-dos go under this one (bottom of the list)
    for (const t of [...todos]) {
      if (!todos.includes(t)) continue; // I deleted it while the sync was running
      if (t.gid) {
        const r = byId.get(t.gid);
        if (!r) { todos = todos.filter((x) => x !== t); continue; }
        if (t.dirty) {
          const sent = t.done;
          await pushDone(t.gid, sent);
          if (t.done === sent) delete t.dirty; else again = true; // ticked again meanwhile
        } else {
          t.done = isDone(r);
          t.text = r.title.trim();
        }
        t.pos = r.position;
      } else {
        // Same words already at Google (for example added on my other device)? Then it's the same to-do.
        const twin = [...byId.values()].find((r) => !claimed.has(r.id) && r.title.trim() === t.text);
        if (twin) {
          claimed.add(twin.id);
          if (t.done && !isDone(twin)) await pushDone(twin.id, true);
          else t.done = isDone(twin);
          t.gid = twin.id;
          t.pos = twin.position;
        } else {
          const sent = t.done;
          const made = await api(last ? "?previous=" + encodeURIComponent(last) : "", {
            method: "POST",
            data: { title: t.text, status: sent ? "completed" : "needsAction" },
          });
          claimed.add(made.id);
          last = made.id;
          if (!todos.includes(t)) { dead = [...dead, made.id]; again = true; } // deleted while uploading
          else {
            t.gid = made.id;
            t.pos = made.position || "~"; // "~" sorts after every number: bottom of the list
            if (t.done !== sent) { t.dirty = true; again = true; }
          }
        }
      }
      save();
    }

    // 3. To-dos that only Google has (added on my phone, or in Google Tasks itself)
    for (const r of byId.values()) {
      if (claimed.has(r.id) || dead.includes(r.id) || todos.some((t) => t.gid === r.id)) continue;
      todos.push({ id: r.id, text: r.title.trim(), done: isDone(r), gid: r.id, pos: r.position });
    }

    // 4. Same order as Google; to-dos not uploaded yet stay at the bottom
    todos = todos.map((t, i) => [t, i]).sort(([a, i], [b, j]) => {
      const pa = a.pos || "~", pb = b.pos || "~";
      return pa < pb ? -1 : pa > pb ? 1 : i - j;
    }).map(([t]) => t);
  }

  async function sync() {
    if (!SYNC_ON || !auth.token() || !auth.canTasks()) { renderStatus(); return; }
    if (running) { again = true; return; }
    running = true;
    renderStatus();
    try {
      do { again = false; await syncOnce(); } while (again);
      lastError = null;
      lastSync = Date.now();
    } catch (err) {
      console.warn("To-do sync:", err.message);
      lastError = err;
    } finally {
      running = false;
      save();
      render();
    }
  }

  // ---------- wire up ----------
  $("#todo-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#todo-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    add(text);
  });
  $("#todo-clear").addEventListener("click", () => remove(todos.filter((t) => t.done)));

  render();
  if (SYNC_ON) {
    auth.onChange(() => { if (auth.token()) sync(); else renderStatus(); });
    sync();
    // Pick up changes from my other device: every 5 minutes, and when I come back to the tab
    setInterval(() => { if (document.visibilityState === "visible") sync(); }, 5 * 60e3);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Date.now() - lastSync > 60e3) sync();
    });
  }
})();
