// ============================================================
// My landing page settings. Change things here, not in app.js.
// After editing, save to GitHub and refresh the page.
// ============================================================
window.CONFIG = {
  version: "1.3.1",
  name: "Atsuwwatti Escobar Nishiburton",

  // Your own time zone (used for "tomorrow"/"yesterday" on the clocks)
  homeTimeZone: "America/Los_Angeles",

  // World clocks: the 4 default cities (each clock also has a drop-down
  // on the page to pick another city; the page remembers your choice)
  clocks: [
    { label: "San Carlos (PST)", tz: "America/Los_Angeles" },
    { label: "New York", tz: "America/New_York" },
    { label: "London", tz: "Europe/London" },
    { label: "Tokyo", tz: "Asia/Tokyo" },
  ],

  // Cities you can pick in each clock's drop-down
  clockChoices: [
    { label: "San Carlos (PST)", tz: "America/Los_Angeles" },
    { label: "Honolulu", tz: "Pacific/Honolulu" },
    { label: "Anchorage", tz: "America/Anchorage" },
    { label: "Denver", tz: "America/Denver" },
    { label: "Chicago", tz: "America/Chicago" },
    { label: "New York", tz: "America/New_York" },
    { label: "Toronto", tz: "America/Toronto" },
    { label: "Mexico City", tz: "America/Mexico_City" },
    { label: "São Paulo", tz: "America/Sao_Paulo" },
    { label: "London", tz: "Europe/London" },
    { label: "Paris", tz: "Europe/Paris" },
    { label: "Berlin", tz: "Europe/Berlin" },
    { label: "Dubai", tz: "Asia/Dubai" },
    { label: "Mumbai", tz: "Asia/Kolkata" },
    { label: "Singapore", tz: "Asia/Singapore" },
    { label: "Hong Kong", tz: "Asia/Hong_Kong" },
    { label: "Shanghai", tz: "Asia/Shanghai" },
    { label: "Seoul", tz: "Asia/Seoul" },
    { label: "Tokyo", tz: "Asia/Tokyo" },
    { label: "Sydney", tz: "Australia/Sydney" },
    { label: "Auckland", tz: "Pacific/Auckland" },
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

  // Google Calendar: the app ID from Google Cloud (not a secret; it only works
  // on https://anishimori123.github.io). Events never get saved in this repo.
  googleClientId: "986348569746-k5qamhfpv3jblem4qsavmc86vbsg44ak.apps.googleusercontent.com",
  calendarDaysAhead: 7,

  // "fahrenheit" or "celsius"
  temperatureUnit: "fahrenheit",

  // Show rain chance when it's at least this many percent
  rainChanceToShow: 30,

  // My GitHub projects
  projects: [
    { name: "agent", note: "my brain", url: "https://github.com/anishimori123/agent" },
    { name: "Myojin", note: "trading bots", url: "https://github.com/anishimori123/Myojin" },
    { name: "Myojin sheet", note: "test spreadsheet", url: "https://docs.google.com/spreadsheets/d/1tOl09Ill4jKm9hig-9r-oT2gvQVX_Dwg7Z9WKoGEglM/edit?gid=0#gid=0" },
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
