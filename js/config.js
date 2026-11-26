// ============================================================
// My landing page settings. Change things here, not in app.js.
// After editing, save to GitHub and refresh the page.
// ============================================================
window.CONFIG = {
  version: "1.0.0",
  name: "Atsushi",

  // Your own time zone (used for "tomorrow"/"yesterday" on the clocks)
  homeTimeZone: "America/Los_Angeles",

  // World clocks: label + time zone name
  clocks: [
    { label: "San Carlos (PST)", tz: "America/Los_Angeles" },
    { label: "New York", tz: "America/New_York" },
    { label: "London", tz: "Europe/London" },
    { label: "Tokyo", tz: "Asia/Tokyo" },
  ],

  // Starting weather cities. You can also add/remove cities on the page;
  // the page remembers your list in this browser.
  cities: [
    { name: "San Carlos", lat: 37.5072, lon: -122.2605 },
    { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
    { name: "Carlsbad", lat: 33.1581, lon: -117.3506 },
    { name: "Palm Desert", lat: 33.7222, lon: -116.3745 },
    { name: "New York", lat: 40.7128, lon: -74.006 },
  ],

  // "fahrenheit" or "celsius"
  temperatureUnit: "fahrenheit",

  // Show rain chance when it's at least this many percent
  rainChanceToShow: 30,

  // My GitHub projects
  projects: [
    { name: "agent", note: "my brain", url: "https://github.com/anishimori123/agent" },
    { name: "Myojin", note: "trading bots", url: "https://github.com/anishimori123/Myojin" },
    { name: "AtsuMail", note: "mail reader", url: "https://github.com/anishimori123/AtsuMail" },
    { name: "landing-page", note: "this page", url: "https://github.com/anishimori123/landing-page" },
  ],

  // Quick links
  links: [
    { name: "Gmail", url: "https://mail.google.com/" },
    { name: "Claude", url: "https://claude.ai/" },
    { name: "Alpaca", url: "https://app.alpaca.markets/" },
    { name: "AtsuMail", url: "https://anishimori123.github.io/AtsuMail/" },
  ],

  // To-dos shown the very first time (after that, your own list is kept)
  starterTodos: ["Watch movies"],
};
