# Agent load-speed report

Generated: 2026-10-10T21:01:09.839Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production only stops loading Umami after that change is deployed. See `umamiRequests` per scenario (expect `0` post-deploy).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 7618 | 5735 | 6128 | — | 2 | — | 0 |
| warm-home | ok | 1976 | 324 | 492 | — | 3 | — | 0 |
| spa-stats | ok | 2508 | 259 | 496 | — | 6 | 987 | 0 |
| spa-totw | ok | 3263 | 244 | 452 | — | 4 | 1740 | 0 |
| spa-club | ok | 2428 | 271 | 404 | — | 4 | 911 | 0 |
| route-profile | ok | 3913 | 1357 | 1720 | — | 0 | — | 0 |
| route-wrapped | ok | 3857 | 290 | 524 | — | 1 | — | 0 |

## Slow APIs (>500ms) and notes

### cold-home (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/site-details` | 1138 |

- Cache disabled via CDP Network.setCacheDisabled

### warm-home (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Cache enabled; soft reload

### spa-stats (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/player-opposition-performance?playerName=Luke%20Bangs` | 1009 |

### spa-totw (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/captains/data?season=2026%2F27` | 1243 |
| `/api/club-badge-leaderboard` | 1233 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/wrapped/Luke-Bangs?stage=initial` | 805 |

- Navigated to /wrapped/Luke-Bangs
- Marks: wrapped:first-slide-visible=1173ms, wrapped:logo-visible=1212ms

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
