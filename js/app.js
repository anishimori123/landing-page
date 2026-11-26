// My landing page: clocks, weather (today + 7 days), to-do, links.
// Settings live in js/config.js.
(() => {
  "use strict";
  const C = window.CONFIG;
  const $ = (sel) => document.querySelector(sel);

  // ---------- small helpers ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: ignore */ }
    },
  };

  // Build an element: el("div", {class: "x"}, "text", child)
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      e.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return e;
  }

  // ---------- greeting ----------
  function renderGreeting() {
    const now = new Date();
    const h = now.getHours();
    const hello = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    $("#greeting").replaceChildren(`${hello}, `, el("span", { class: "nick" }, C.name));
    $("#today").textContent = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  // Small shared toolbox for calendar.js
  window.LP = { el };

  // ---------- clocks ----------
  function partsIn(tz, now) {
    const t = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", second: "2-digit" })
      .formatToParts(now).map((p) => [p.type, p.value]));
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now)) % 24;
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now); // YYYY-MM-DD
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
    return { hm: `${t.hour}:${t.minute}`, sec: t.second, ampm: t.dayPeriod || "", hour, date, weekday };
  }

  // Each clock slot remembers which time zone was picked in its drop-down
  const validTz = (tz) => C.clockChoices.some((c) => c.tz === tz);
  let clockZones = C.clocks.map((c, i) => {
    const saved = store.get("lp.clockZones", [])[i];
    return saved && validTz(saved) ? saved : c.tz;
  });
  const clockSlots = [];

  // Build the 4 clock cards once (so the drop-downs don't reset every second)
  function buildClocks() {
    $("#clocks").replaceChildren(...C.clocks.map((def, i) => {
      const choices = C.clockChoices.some((c) => c.tz === def.tz) ? C.clockChoices : [def, ...C.clockChoices];
      const select = el("select", { class: "clock-pick", "aria-label": `Clock ${i + 1} city`,
        onchange: (e) => {
          clockZones[i] = e.target.value;
          store.set("lp.clockZones", clockZones);
          tickClocks();
        } },
        choices.map((c) => el("option", { value: c.tz, selected: c.tz === clockZones[i] }, c.label)));
      const time = el("div", { class: "time" });
      const sub = el("div", { class: "sub" });
      const card = el("div", { class: "clock" }, select, time, sub);
      clockSlots[i] = { card, time, sub };
      return card;
    }));
    tickClocks();
  }

  // Update only the times every second
  function tickClocks() {
    const now = new Date();
    const home = partsIn(C.homeTimeZone, now).date;
    clockSlots.forEach((slot, i) => {
      const p = partsIn(clockZones[i], now);
      const isDay = p.hour >= 6 && p.hour < 18;
      const when = p.date > home ? `${p.weekday} · tomorrow` : p.date < home ? `${p.weekday} · yesterday` : p.weekday;
      slot.card.classList.toggle("night", !isDay);
      slot.time.replaceChildren(p.hm, el("span", { class: "sec" }, ":" + p.sec), " " + p.ampm);
      slot.sub.textContent = `${isDay ? "☀️ day" : "🌙 night"} · ${when}`;
    });
  }

  // ---------- weather ----------
  // WMO weather codes -> icon + words
  const WEATHER = {
    0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Cloudy"],
    45: ["🌫️", "Fog"], 48: ["🌫️", "Icy fog"],
    51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
    56: ["🌧️", "Freezing drizzle"], 57: ["🌧️", "Freezing drizzle"],
    61: ["🌦️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"],
    66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"],
    71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"], 77: ["🌨️", "Snow grains"],
    80: ["🌦️", "Showers"], 81: ["🌧️", "Showers"], 82: ["⛈️", "Heavy showers"],
    85: ["🌨️", "Snow showers"], 86: ["❄️", "Snow showers"],
    95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Storm with hail"], 99: ["⛈️", "Storm with hail"],
  };
  function look(code, isDay = 1) {
    const [icon, words] = WEATHER[code] || ["🌡️", "—"];
    if (!isDay && (code === 0 || code === 1)) return ["🌙", words];
    return [icon, words];
  }
  const deg = (n) => (n === null || n === undefined || Number.isNaN(n) ? "–" : `${Math.round(n)}°`);
  // Show both °F and °C (weather comes in the unit set in config.js)
  const isF = C.temperatureUnit === "fahrenheit";
  const toF = (n) => (n === null || n === undefined ? n : isF ? n : n * 9 / 5 + 32);
  const toC = (n) => (n === null || n === undefined ? n : isF ? (n - 32) * 5 / 9 : n);
  const degF = (n) => deg(toF(n)) + "F";
  const degC = (n) => deg(toC(n)) + "C";

  const CACHE_MINUTES = 30;
  let cities = store.get("lp.cities", C.cities);
  let mode = store.get("lp.weatherMode", "today");
  let weatherData = null;

  const cityKey = (c) => `${c.lat.toFixed(2)},${c.lon.toFixed(2)}`;
  const cacheKey = () => cities.map(cityKey).join("|") + "|" + C.temperatureUnit;

  async function fetchWeather() {
    const params = new URLSearchParams({
      latitude: cities.map((c) => c.lat).join(","),
      longitude: cities.map((c) => c.lon).join(","),
      current: "temperature_2m,weather_code,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: C.temperatureUnit,
      timezone: "auto",
      forecast_days: "7",
    });
    const url = "https://api.open-meteo.com/v1/forecast?" + params;
    // Try up to 3 times: the connection sometimes drops for a moment
    const waits = [0, 1500, 4000];
    let lastErr;
    for (let attempt = 0; attempt < waits.length; attempt++) {
      if (waits[attempt]) await new Promise((r) => setTimeout(r, waits[attempt]));
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), 10e3);
      try {
        const res = await fetch(url, { signal: stop.signal });
        if (!res.ok) throw new Error("Weather service answered " + res.status);
        const json = await res.json();
        return Array.isArray(json) ? json : [json]; // one city = object, many = list
      } catch (err) {
        lastErr = err;
        console.warn(`Weather try ${attempt + 1} failed:`, err.message);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  }

  let retryTimer = null;
  async function loadWeather(force = false) {
    const box = $("#weather");
    clearTimeout(retryTimer);
    if (!cities.length) {
      weatherData = [];
      renderWeather();
      return;
    }
    const cached = store.get("lp.weatherCache", null);
    const cacheFits = cached && cached.key === cacheKey();
    if (!force && cacheFits && Date.now() - cached.at < CACHE_MINUTES * 60e3) {
      weatherData = cached.data;
      renderWeather(cached.at);
      return;
    }
    if (!weatherData) box.replaceChildren(el("p", { class: "muted" }, "Loading weather…"));
    try {
      const data = await fetchWeather();
      weatherData = data;
      store.set("lp.weatherCache", { key: cacheKey(), at: Date.now(), data });
      renderWeather(Date.now());
    } catch (err) {
      console.error(err);
      // Try again by itself in 1 minute
      retryTimer = setTimeout(() => loadWeather(true), 60e3);
      if (!weatherData && cacheFits) weatherData = cached.data; // older saved weather is better than nothing
      if (weatherData) {
        renderWeather();
        $("#weather-updated").textContent = "Couldn't refresh. Showing saved weather" +
          (cacheFits ? " from " + new Date(cached.at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "") +
          ". Trying again in 1 minute.";
      } else {
        box.replaceChildren(el("p", { class: "muted" }, "Couldn't reach the weather service. Trying again in 1 minute (or tap ↻)."));
      }
    }
  }

  function removeCity(i) {
    cities = cities.filter((_, j) => j !== i);
    store.set("lp.cities", cities);
    if (weatherData) weatherData = weatherData.filter((_, j) => j !== i);
    renderWeather();
    store.set("lp.weatherCache", null);
  }

  function rainBadge(p) {
    return p !== null && p !== undefined && p >= C.rainChanceToShow ? el("div", { class: "rain" }, `💧 ${p}%`) : null;
  }

  function dayLabel(iso, i) {
    if (i === 0) return "Today";
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
  }

  function renderWeather(updatedAt) {
    document.querySelectorAll(".switch button").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
    const box = $("#weather");
    if (!cities.length) {
      box.replaceChildren(el("p", { class: "muted" }, "No cities yet. Tap ＋ to add one."));
      return;
    }
    if (!weatherData || weatherData.length !== cities.length) return;

    if (mode === "today") {
      box.replaceChildren(el("div", { class: "weather-today" }, cities.map((c, i) => {
        const w = weatherData[i];
        const [icon, words] = look(w.current.weather_code, w.current.is_day);
        return el("div", { class: "city" },
          el("button", { class: "remove", type: "button", title: `Remove ${c.name}`, "aria-label": `Remove ${c.name}`, onclick: () => removeCity(i) }, "✕"),
          el("div", { class: "name" }, c.name),
          el("div", { class: "now" }, el("span", { class: "icon" }, icon), degF(w.current.temperature_2m),
            el("span", { class: "c" }, degC(w.current.temperature_2m))),
          el("div", { class: "desc" }, words),
          el("div", { class: "hl" }, `H ${degF(w.daily.temperature_2m_max[0])}  L ${degF(w.daily.temperature_2m_min[0])}`),
          el("div", { class: "hl c-line" }, `H ${degC(w.daily.temperature_2m_max[0])}  L ${degC(w.daily.temperature_2m_min[0])}`),
          rainBadge(w.daily.precipitation_probability_max[0]));
      })));
    } else {
      const days = weatherData[0].daily.time;
      const head = el("tr", {}, el("th", {}, "City"), days.map((d, i) => el("th", {}, dayLabel(d, i))));
      const rows = cities.map((c, i) => {
        const d = weatherData[i].daily;
        return el("tr", {},
          el("td", {}, c.name),
          d.time.map((_, k) => {
            const [icon, words] = look(d.weather_code[k]);
            return el("td", { title: words },
              el("span", { class: "icon" }, icon),
              el("span", { class: "hl" }, deg(toF(d.temperature_2m_max[k])), " ", el("span", { class: "lo" }, deg(toF(d.temperature_2m_min[k]))), el("span", { class: "unit" }, "F")),
              el("span", { class: "hl c-line" }, deg(toC(d.temperature_2m_max[k])), " ", deg(toC(d.temperature_2m_min[k])), el("span", { class: "unit" }, "C")),
              rainBadge(d.precipitation_probability_max[k]));
          }));
      });
      box.replaceChildren(el("div", { class: "table-wrap" }, el("table", { class: "week" }, el("thead", {}, head), el("tbody", {}, rows))));
    }
    if (updatedAt) {
      $("#weather-updated").textContent = "Updated " + new Date(updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
  }

  // Add a city using Open-Meteo's free place search
  async function findCity(name) {
    const out = $("#city-results");
    out.replaceChildren(el("span", { class: "muted tiny" }, "Searching…"));
    try {
      const url = "https://geocoding-api.open-meteo.com/v1/search?" + new URLSearchParams({ name, count: "5", language: "en", format: "json" });
      const res = await fetch(url);
      const json = await res.json();
      const results = json.results || [];
      if (!results.length) { out.replaceChildren(el("span", { class: "muted tiny" }, "No place found. Try another spelling.")); return; }
      out.replaceChildren(...results.map((r) => {
        const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
        return el("button", { type: "button", onclick: () => addCity({ name: r.name, lat: r.latitude, lon: r.longitude }) }, "＋ " + label);
      }));
    } catch (err) {
      console.error(err);
      out.replaceChildren(el("span", { class: "muted tiny" }, "Couldn't search right now. Check your internet."));
    }
  }

  function addCity(city) {
    if (cities.some((c) => cityKey(c) === cityKey(city))) {
      $("#city-results").replaceChildren(el("span", { class: "muted tiny" }, `${city.name} is already on the list.`));
      return;
    }
    cities = [...cities, city];
    store.set("lp.cities", cities);
    $("#city-input").value = "";
    $("#city-results").replaceChildren();
    $("#city-form").hidden = true;
    weatherData = null;
    loadWeather(true);
  }

  // ---------- to-do ----------
  let todos = store.get("lp.todos", null) || C.starterTodos.map((text, i) => ({ id: Date.now() + i, text, done: false }));
  const saveTodos = () => store.set("lp.todos", todos);

  function renderTodos() {
    const list = $("#todo-list");
    if (!todos.length) { list.replaceChildren(el("li", { class: "empty" }, "Nothing to do. Nice!")); return; }
    list.replaceChildren(...todos.map((t) => el("li", { class: t.done ? "done" : "" },
      el("input", { type: "checkbox", checked: t.done, "aria-label": `Done: ${t.text}`, onchange: () => { t.done = !t.done; saveTodos(); renderTodos(); } }),
      el("span", { class: "text" }, t.text),
      el("button", { type: "button", class: "del", title: "Delete", "aria-label": `Delete ${t.text}`, onclick: () => { todos = todos.filter((x) => x.id !== t.id); saveTodos(); renderTodos(); } }, "✕"))));
  }

  // ---------- projects + links ----------
  function renderLinks() {
    $("#projects").replaceChildren(...C.projects.map((p) => el("a", { class: "chip", href: p.url }, p.name, el("small", {}, p.note))));
    $("#links").replaceChildren(...C.links.map((l) => el("a", { class: "chip", href: l.url }, l.name)));
  }

  // ---------- wire up ----------
  function start() {
    renderGreeting();
    buildClocks();
    renderLinks();
    renderTodos();
    $("#version").textContent = "v" + C.version;

    document.querySelectorAll(".switch button").forEach((b) => b.addEventListener("click", () => {
      mode = b.dataset.mode;
      store.set("lp.weatherMode", mode);
      renderWeather();
    }));
    $("#weather-refresh").addEventListener("click", () => loadWeather(true));
    $("#city-add-toggle").addEventListener("click", () => {
      const f = $("#city-form");
      f.hidden = !f.hidden;
      if (!f.hidden) $("#city-input").focus();
    });
    $("#city-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#city-input").value.trim();
      if (name.length < 2) { $("#city-results").replaceChildren(el("span", { class: "muted tiny" }, "Type at least 2 letters.")); return; }
      findCity(name);
    });
    $("#todo-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("#todo-input");
      const text = input.value.trim();
      if (!text) return;
      todos = [...todos, { id: Date.now(), text, done: false }];
      saveTodos();
      renderTodos();
      input.value = "";
    });
    $("#todo-clear").addEventListener("click", () => { todos = todos.filter((t) => !t.done); saveTodos(); renderTodos(); });

    // Focus search on computers only (on phones it would pop up the keyboard)
    if (window.matchMedia && window.matchMedia("(min-width: 720px)").matches) $("#search").focus();

    loadWeather();
    setInterval(tickClocks, 1000);
    setInterval(renderGreeting, 60e3);
    setInterval(() => loadWeather(), CACHE_MINUTES * 60e3);
  }

  start();
})();
