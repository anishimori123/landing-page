// Atsushi's widget: a small, glance-only page for the Pixel home screen.
// Date + local time, 3 clocks, weather for 2 cities. No sign-in, nothing private.
// (My calendar is Google's own Calendar widget, placed under this one.)
// SEPARATE from the full landing page: own files, own settings (config.js),
// and it shares nothing with it.
// Built to be easy on the battery: nothing runs while the widget is not on
// screen, the clock moves once a minute, saved weather is reused.
(() => {
  "use strict";
  const W = window.WIDGET;
  const $ = (sel) => document.querySelector(sel);
  const MIN = 60e3;

  // Own storage keys ("lpw."), so the full page's saved things are never touched
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: ignore */ } },
  };

  function el(tag, cls, ...kids) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      e.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return e;
  }
  const clock12 = (d, tz) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return { hm: `${p.hour}:${p.minute}`, ampm: p.dayPeriod || "" };
  };
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // ---------- 1 + 2. date, big local time, small clocks ----------
  function zoneName(tz, now) {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(now).find((p) => p.type === "timeZoneName");
    return part ? part.value : "";
  }

  function renderTime() {
    const now = new Date();
    $("#date").textContent = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const t = clock12(now);
    $("#time").replaceChildren(t.hm, el("small", "", t.ampm));

    const homeDay = dayKey(now);
    $("#clocks").replaceChildren(...W.clocks.map((c) => {
      const there = clock12(now, c.tz);
      const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: c.tz, hour: "numeric", hourCycle: "h23" }).format(now)) % 24;
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: c.tz }).format(now); // YYYY-MM-DD
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: c.tz, weekday: "short" }).format(now);
      const isDay = hour >= 6 && hour < 18;
      const when = date > homeDay ? "tomorrow" : date < homeDay ? "yesterday" : weekday;
      return el("div", "clock" + (isDay ? "" : " night"),
        el("div", "label", c.label),
        el("div", "t", there.hm, el("small", "", there.ampm)),
        el("div", "sub", `${isDay ? "☀️" : "🌙"} ${c.zone ? zoneName(c.tz, now) + " · " : ""}${when}`));
    }));
    $("#foot").textContent = `Drawn ${t.hm} ${t.ampm} · widget v${W.version}`;
  }

  // ---------- 3. weather ----------
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
  const f = (n) => `${Math.round(n)}°`;
  const c = (n) => `${Math.round((n - 32) * 5 / 9)}°C`;
  const weatherKey = () => W.cities.map((x) => `${x.lat},${x.lon}`).join("|");

  function renderWeather(data, at, stale) {
    $("#weather").replaceChildren(...W.cities.map((city, i) => {
      const w = data[i];
      let [icon, words] = WEATHER[w.current.weather_code] || ["🌡️", "—"];
      if (!w.current.is_day && w.current.weather_code <= 1) icon = "🌙";
      const rain = w.daily.precipitation_probability_max[0];
      return el("div", "city",
        el("div", "name", city.name),
        el("div", "temp", el("span", "icon", icon), f(w.current.temperature_2m) + "F", el("small", "", c(w.current.temperature_2m))),
        el("div", "line", words),
        el("div", "line", `H ${f(w.daily.temperature_2m_max[0])}  L ${f(w.daily.temperature_2m_min[0])}`,
          rain >= 30 ? el("span", "rain", `  💧 ${rain}%`) : null));
    }));
    // Comparison: second city against the first ("home")
    const [home, other] = W.cities;
    const diff = Math.round(data[1].current.temperature_2m) - Math.round(data[0].current.temperature_2m);
    const hiDiff = Math.round(data[1].daily.temperature_2m_max[0]) - Math.round(data[0].daily.temperature_2m_max[0]);
    const words = (d) => (d === 0 ? "the same" : `${Math.abs(d)}° ${d > 0 ? "warmer" : "cooler"}`);
    $("#compare").textContent = `${other.name} vs ${home.name}: ${words(diff)} now, high ${words(hiDiff)}` +
      (stale ? ` · weather from ${new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "");
  }

  async function loadWeather() {
    const saved = store.get("lpw.weather");
    const fits = saved && saved.key === weatherKey();
    if (fits) renderWeather(saved.data, saved.at, false);
    if (fits && Date.now() - saved.at < W.weatherMinutes * MIN) return; // fresh enough: no internet used
    try {
      const q = new URLSearchParams({
        latitude: W.cities.map((x) => x.lat).join(","),
        longitude: W.cities.map((x) => x.lon).join(","),
        current: "temperature_2m,weather_code,is_day",
        daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        temperature_unit: "fahrenheit",
        timezone: "auto",
        forecast_days: "1",
      });
      const stop = new AbortController();
      const timer = setTimeout(() => stop.abort(), 10e3);
      const res = await fetch("https://api.open-meteo.com/v1/forecast?" + q, { signal: stop.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error("Weather service answered " + res.status);
      const data = await res.json();
      store.set("lpw.weather", { key: weatherKey(), at: Date.now(), data });
      renderWeather(data, Date.now(), false);
    } catch (err) {
      console.warn("Widget weather:", err.message);
      if (fits) renderWeather(saved.data, saved.at, true); // old weather is better than none
      else $("#weather").replaceChildren(el("p", "muted", "Weather isn't reachable right now."));
    }
  }

  // ---------- run only while on screen (battery) ----------
  let timer = null;
  function wake() {
    renderTime();
    loadWeather();
    clearTimeout(timer);
    // Wake up again exactly when the minute changes: enough for a clock without seconds.
    // Saved weather is only fetched again when it is older than the minutes in config.js.
    timer = setTimeout(wake, MIN - (Date.now() % MIN) + 50);
  }
  function sleep() { clearTimeout(timer); timer = null; }

  $("#open").setAttribute("href", W.fullPage);
  document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? wake() : sleep()));
  if (document.visibilityState === "visible") wake(); else renderTime();
})();
