// ============================================================
// Widget settings. The widget is SEPARATE from the full landing page:
// changing things here never changes the full page, and the other way round.
// ============================================================
window.WIDGET = {
  version: "1.0.0",

  // Tapping the widget opens this (the full landing page)
  fullPage: "../",

  // The 3 small clocks. zone: true adds the zone's short name by itself (PST in winter, PDT in summer).
  clocks: [
    { label: "San Carlos", tz: "America/Los_Angeles", zone: true },
    { label: "New York", tz: "America/New_York" },
    { label: "Tokyo", tz: "Asia/Tokyo" },
  ],

  // Weather: exactly 2 cities, shown side by side and compared (first one is "home")
  cities: [
    { name: "San Carlos", lat: 37.5072, lon: -122.2605 },
    { name: "Palm Desert", lat: 33.7222, lon: -116.3745 },
  ],

  // Today's calendar events: how many lines to show before "+N more"
  maxEvents: 5,

  // Battery savers: how long saved weather / events are reused before asking again (minutes)
  weatherMinutes: 30,
  eventsMinutes: 15,
};
