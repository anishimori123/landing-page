# landing-page

My own browser start page, the way I want it. Dark theme, like AtsuMail.

**Live page:** https://anishimori123.github.io/landing-page/

## What's on it
- 🔍 **Google search box**
- 🕐 **World clocks:** San Carlos (PST), New York, London, Tokyo by default. Live, with day/night and "tomorrow" when it's already the next day there. Click a clock's city name to pick another city (remembered in this browser)
- 🌤️ **Weather in one shot:** San Carlos, Los Angeles, Carlsbad, Palm Desert, New York
  - **Today** view: now, high/low, rain chance (when 30% or more)
  - **7 days** view: a table comparing every city for the week
  - ＋ add any city, ✕ remove one (remembered in this browser)
- ✅ **To-do list:** type and press Enter, tick, delete, "Clear done"
- 🗂️ **My projects** and 🔗 **quick links**

## Privacy
This repo is **public**, so nothing private goes in it.
To-dos and my city list are saved **only in my browser** (localStorage), never uploaded.
They don't sync between my PC and phone.

## Free services used
- Weather and city search: [Open-Meteo](https://open-meteo.com/). Free, no account, no key.
- Hosting: GitHub Pages (free for public repos).

## Files
| File | What it does |
|---|---|
| `index.html` | The page layout |
| `css/style.css` | Colors and layout (dark theme, phone layout) |
| `js/config.js` | **My settings:** clocks, starting cities, projects, quick links. Edit this one |
| `js/app.js` | How everything works |
| `scripts/changelog_stats.py` + `.github/workflows/changelog-stats.yml` | GitHub robot that redraws the growth charts in `CHANGELOG.md` |
| `stats/code-lines.json` | Lines of code per version (for the chart) |

## If the weather doesn't load
The page tries 3 times, then again every minute, and shows the last saved weather meanwhile.
If it never loads, open https://api.open-meteo.com/v1/forecast?latitude=37.5&longitude=-122.26&current=temperature_2m in a new tab.
If that page doesn't open either, something on the network (Wi-Fi, VPN, ad blocker, antivirus) is blocking Open-Meteo. Try another network or pause the blocker.

## How to change things
Open `js/config.js` on GitHub → click the ✏️ pencil → edit → **Commit changes**.
The live page updates in about 1 minute (refresh the page).

## Set it as my start page

### Chrome (Windows)
1. Click the **⋮** menu (top right) → **Settings** → **On startup**.
2. Choose **Open a specific page or set of pages** → **Add a new page** → paste the live page link → **Add**.
3. Optional home button: **Settings** → **Appearance** → turn on **Show home button** → choose the custom address and paste the link.

### Edge (Windows)
1. Click **…** (top right) → **Settings** → **Start, home, and new tabs**.
2. Under **When Edge starts**, choose **Open these pages** → **Add a new page** → paste the link → **Add**.
3. Optional: turn on **Show home button** and paste the link there too.

### Every new tab (optional, free extension)
Chrome and Edge don't let a normal setting change the new tab page.
A free "new tab redirect" style extension from the Chrome Web Store or Edge Add-ons can open this page on every new tab.

### Pixel phone
1. Open the live page in Chrome.
2. Tap **⋮** → **Add to home screen** → **Add**.
3. An icon appears on the home screen and opens the page like an app.
