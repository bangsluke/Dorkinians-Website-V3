# Agent load-speed report

Generated: 2026-10-10T20:26:25.354Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production only stops loading Umami after that change is deployed. See `umamiRequests` per scenario (expect `0` post-deploy).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 5483 | 3367 | 3972 | — | 3 | — | 0 |
| warm-home | ok | 2149 | 505 | 632 | — | 3 | — | 0 |
| spa-stats | ok | 2465 | 278 | 472 | — | 6 | 939 | 0 |
| spa-totw | ok | 2665 | 259 | 528 | — | 5 | 1137 | 0 |
| spa-club | ok | 2741 | 247 | 592 | — | 8 | 1215 | 0 |
| route-profile | ok | 3211 | 818 | 1244 | — | 0 | — | 0 |
| route-wrapped | ok | 4256 | 304 | 972 | — | 1 | — | 0 |

## Slow APIs (>500ms) and notes

### cold-home (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Cache disabled via CDP Network.setCacheDisabled

### warm-home (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Cache enabled; soft reload

### spa-stats (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/player-data?playerName=Luke%20Bangs` | 1610 |
| `/api/awards/player-history?playerName=Luke%20Bangs` | 1257 |
| `/api/captains/player-history?playerName=Luke%20Bangs` | 979 |
| `/api/captains/data?season=2026%2F27` | 955 |

### spa-totw (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/players` | 2219 |

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/players` | 2249 |
| `/api/player-data-filtered` | 2155 |
| `/api/club-badge-leaderboard` | 987 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/wrapped/Luke-Bangs?stage=initial` | 531 |

- Navigated to /wrapped/Luke-Bangs
- Marks: wrapped:first-slide-visible=1349ms, wrapped:logo-visible=1466ms

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
