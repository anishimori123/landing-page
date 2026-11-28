# landing-page

My own browser start page, the way I want it. Dark theme, like AtsuMail.

**Live page:** https://anishimori123.github.io/landing-page/

## What's on it
- 🔍 **Google search box** (on a computer, press `/` to jump to it)
- 🗓️ **Month view** of my Google Calendar with event boxes in each day (like my phone widget). Click a day or an event
- 📅 **My calendar:** all my Google calendars. Add, change and delete events. Sign in with Google once
- 🕐 **World clocks** with seconds: San Carlos (shows PST in winter and PDT in summer by itself), New York, London, Tokyo by default. Live, with day/night and "tomorrow" when it's already the next day there. Click a clock's city name to pick another city (remembered in this browser)
- 🌤️ **Weather in one shot** (°F and °C): San Carlos, Los Angeles, Carlsbad, Palm Desert, New York
  - **Today** view: now, high/low, rain chance (when 30% or more)
  - **7 days** view: a table comparing every city for the week
  - ＋ add any city, ✕ remove one (remembered in this browser)
- 📰 **News:** Bloomberg headlines by genre (official RSS feeds via rss2json.com), and a 日経 tab with buttons to Nikkei sections + Nikkei search
- ✅ **To-do list:** type and press Enter, tick, delete, "Clear done". Signed in to Google, it syncs with **Google Tasks**, so my PC and my Pixel show the same list
- 🗂️ **My projects** and 🔗 **quick links** (each opens in a new tab, so the start page stays open)

## Privacy
This repo is **public**, so nothing private goes in it.
My city list and clock choices are saved **only in my browser** (localStorage), never uploaded.
To-dos are saved in my browser too. Only when I sign in to Google do they also go to **my own Google Tasks** (nowhere else, and never into this repo).

## Google Calendar
- Sign-in is Google's own window. The page gets a pass that lasts about 1 hour, then shows a one-click **Reconnect** button.
- The Google Cloud project `landing-page` is in **Testing** mode with only me as a test user. Google shows "Google hasn't verified this app" at sign-in, which is normal for a personal app; click **Continue**.
- The app ID in `js/config.js` is not a secret. It only works on `https://anishimori123.github.io`.
- Events are never saved in this repo; they go straight from Google to my browser.

## To-do sync (Google Tasks)
The to-do box uses the same Google sign-in as the calendar.

**One-time setup (free, about 1 minute):**
1. Open https://console.cloud.google.com/apis/library/tasks.googleapis.com
2. At the top of the page, check that the project name says **landing-page**. If not, click the name and pick it.
3. Click the blue **Enable** button. Success looks like: the button changes to **Manage**.
4. Open the landing page and click **Reconnect Google Calendar** (or **Sign in with Google**).
5. On Google's screen, tick the new box about **Google Tasks**, then **Continue**.
6. Success looks like: under the to-do box it says **Synced with Google Tasks at …**. Do steps 4 to 6 once on the phone too.

**How it behaves:**
- It uses the Google Tasks list called **My Tasks**. The same to-dos show in Google's own Tasks app, Gmail and Google Calendar.
- Signed out (Google's pass lasts about 1 hour), the list still works. Changes wait in the browser and are sent at the next **Reconnect**. The line under the box says how many are waiting.
- The other device catches up within 5 minutes, or right away when I come back to the tab.
- **✕** and **Clear done** delete the to-do in Google Tasks too.
- A to-do ticked inside Google's own Tasks app disappears from this page (Google hides its finished tasks).
- If the same to-do was typed on both devices before syncing, it is joined into one, not doubled.
- To turn syncing off: set `googleTasks: false` in `js/config.js`.

## Free services used
- To-do sync: Google Tasks API (free for personal use).
- Calendar: Google Calendar API (free for personal use).
- Weather and city search: [Open-Meteo](https://open-meteo.com/). Free, no account, no key.
- Hosting: GitHub Pages (free for public repos).

## Files
| File | What it does |
|---|---|
| `index.html` | The page layout |
| `css/style.css` | Colors and layout (dark theme, phone layout) |
| `js/config.js` | **My settings:** clocks, starting cities, projects, quick links. Edit this one |
| `js/app.js` | How everything works |
| `js/calendar.js` | My Google Calendar card (Google sign-in, events, add/change/delete) |
| `js/todo.js` | To-do box (saved in the browser, synced with Google Tasks when signed in) |
| `js/news.js` | News box (sources, genres, headlines) |
| `scripts/changelog_stats.py` + `.github/workflows/changelog-stats.yml` | GitHub robot that redraws the growth charts in `CHANGELOG.md` |
| `manifest.webmanifest` + `icons/` | Tell a phone the app's name, colors and icon (yellow house), so it installs like an app |
| `scripts/make_icons.py` | Draws the icons again (only needed to change the icon) |
| `scripts/stamp_version.py` | Copies the version number from `js/config.js` into `index.html` (the same robot runs it) |
| `stats/code-lines.json` | Lines of code per version (for the chart) |

## If the weather doesn't load
The page tries 3 times, then again every minute, and shows the last saved weather meanwhile.
If it never loads, open https://api.open-meteo.com/v1/forecast?latitude=37.5&longitude=-122.26&current=temperature_2m in a new tab.
If that page doesn't open either, something on the network (Wi-Fi, VPN, ad blocker, antivirus) is blocking Open-Meteo. Try another network or pause the blocker.

## How to change things
Open `js/config.js` on GitHub → click the ✏️ pencil → edit → **Commit changes**.
The live page updates in about 1 minute (refresh the page).
When releasing a new version, change the `version` number in `js/config.js` **only**.
The GitHub robot copies it into the `?v=…` numbers in `index.html` about a minute later, so browsers load the new files instead of an old saved copy.

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
2. Tap **⋮** → **Add to home screen** → **Install** (if it only says **Add**, tap that).
3. A yellow house icon named **Home** appears on the home screen. It opens the page full screen, without Chrome's address bar.

If an older icon is already there: long-press it → **Remove**, then do the 3 steps again to get the new icon.
