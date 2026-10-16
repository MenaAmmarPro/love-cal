# Our Calculator — Love for Mena

A white keypad for everyday maths, and a second page of counters that only
ever go up. Part of the **Love for Mena** collection.

**Live:** https://menaammarpro.github.io/love-cal/

## What it does

- **Calculator:** + − × ÷ %, decimal, ±, backspace, division-by-zero guard,
  keyboard support, repeat-equals, and a clickable history tape (last 8)
- **Us counters:** days/hours/minutes together (live, from the symbolic
  2024-01-01 anchor), kilometres between Karachi and Bucharest (haversine,
  ~4,266 km), pizza slices (editable per-day rate), and sunrises
- Everything stays on the device — no tracking, no network calls
- Installable PWA with offline support

## How it works

Calculator state lives in `js/app.js` (a small state machine: pending
operator, overwrite flag, repeat-equals memory). Preferences and history live
in localStorage under `mena-cal` (`{history, rate}`).

## Files

- `index.html` — the page
- `css/theme.css` — shared love-theme (copied from `_love-theme/`)
- `css/app.css` — keypad, screen, history and counter-card styles
- `js/theme-main.js`, `js/effects.js` — shared behaviour/effects
- `js/app.js` — calculator engine + us counters
- `manifest.webmanifest`, `sw.js` — PWA
- `assets/` — favicon and icons

## Run locally

```powershell
py -m http.server 8000
```

Then visit http://localhost:8000.

## Deploy

Static site, deployed with GitHub Pages from `main`.

## License

Creative Commons BY-NC-ND 4.0 — see [`LICENSE`](LICENSE).
© 2026 Ammar (MenaAmmarPro). Made with care for Mena.
