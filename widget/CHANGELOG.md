# CHANGELOG — widget

The widget has its own version numbers, separate from the full landing page.
Newest first. Never delete or rewrite old entries.

| Version | Date | Time | Summary |
|---|---|---|---|
| **v1.0.0** | 2026-11-27 | 40 min | 📱 First version: time, 3 clocks, 2-city weather with comparison, today's events |

## v1.0.0 — 2026-11-27 (time spent: ~40 min)
- **What changed:** New `widget/` folder with a small glance-only page for my Pixel 10 home screen: date and big local time; three small clocks (San Carlos with PST/PDT, New York, Tokyo); weather for San Carlos and Palm Desert side by side with one comparison line; today's calendar events (up to 5). Tapping it opens the full landing page. It is sized to fit about half the phone screen without scrolling.
- **Why:** I want to see the essentials on my phone's home screen without opening the full page, and without the news box.
- **Kept separate:** own files, own settings (`widget/config.js`), own version. The full page's files were not changed. The widget only *reads* the Google sign-in the full page saved, to show events.
- **Battery:** nothing runs while it is off screen, the clock wakes once a minute, weather is reused for 30 minutes and events for 15.
- **Tested:** 3 automatic checks with pretend weather and calendar data (signed out, signed in, weather down), and a picture taken in Chrome at Pixel width. **Not tested yet on my real Pixel or inside a widget app**; that is my next step.
