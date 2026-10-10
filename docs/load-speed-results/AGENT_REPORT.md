# Agent load-speed report

Generated: 2026-10-10T20:09:03.038Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production only stops loading Umami after that change is deployed. See `umamiRequests` per scenario (expect `0` post-deploy).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 8010 | 6104 | 6504 | — | 2 | — | 0 |
| warm-home | ok | 2082 | 437 | 568 | — | 3 | — | 0 |
| spa-stats | ok | 2662 | 248 | 456 | — | 10 | 1116 | 0 |
| spa-totw | ok | 2699 | 248 | 568 | — | 4 | 1179 | 0 |
| spa-club | ok | 2763 | 477 | 656 | — | 5 | 1251 | 0 |
| route-profile | ok | 2675 | 933 | 1252 | — | 0 | — | 0 |
| route-wrapped | ok | 4060 | 489 | 668 | — | 1 | — | 0 |

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
| `/api/player-seasonal-stats` | 1614 |
| `/api/player-fantasy-breakdown` | 1361 |
| `/api/awards/player-history?playerName=Luke%20Bangs` | 661 |
| `/api/player-data?playerName=Luke%20Bangs` | 568 |
| `/api/player-oppositions-map?playerName=Luke%20Bangs` | 568 |
| `/api/player-opposition-performance?playerName=Luke%20Bangs` | 568 |

### spa-totw (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/captains/data?season=2026%2F27` | 1133 |

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/club-badge-leaderboard` | 1504 |
| `/api/club-achievements` | 692 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/wrapped/Luke-Bangs?stage=initial` | 3424 |

- Navigated to /wrapped/Luke-Bangs
- No wrapped:* performance marks observed yet

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
