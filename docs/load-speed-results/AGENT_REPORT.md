# Agent load-speed report

Generated: 2026-10-10T20:38:25.194Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production only stops loading Umami after that change is deployed. See `umamiRequests` per scenario (expect `0` post-deploy).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 6821 | 4768 | 5308 | — | 2 | — | 0 |
| warm-home | ok | 1933 | 288 | 432 | — | 3 | — | 0 |
| spa-stats | ok | 2650 | 465 | 608 | — | 3 | 1134 | 0 |
| spa-totw | ok | 3342 | 251 | 660 | — | 5 | 1829 | 0 |
| spa-club | ok | 2924 | 674 | 852 | — | 6 | 1409 | 0 |
| route-profile | ok | 3253 | 550 | 800 | — | 0 | — | 0 |
| route-wrapped | ok | 3832 | 262 | 480 | — | 1 | — | 0 |

## Slow APIs (>500ms) and notes

### cold-home (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/site-details` | 1055 |

- Cache disabled via CDP Network.setCacheDisabled

### warm-home (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Cache enabled; soft reload

### spa-stats (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/captains/data?season=2026%2F27` | 970 |

### spa-totw (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/player-data-filtered` | 2637 |

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/club-badge-leaderboard` | 1290 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/wrapped/Luke-Bangs?stage=initial` | 1496 |

- Navigated to /wrapped/Luke-Bangs
- Marks: wrapped:first-slide-visible=1819ms, wrapped:logo-visible=1849ms

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
