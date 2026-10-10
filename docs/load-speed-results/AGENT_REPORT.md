# Agent load-speed report

Generated: 2026-10-10T20:53:03.732Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production only stops loading Umami after that change is deployed. See `umamiRequests` per scenario (expect `0` post-deploy).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 5939 | 3841 | 4420 | — | 1 | — | 0 |
| warm-home | ok | 1915 | 259 | 432 | — | 3 | — | 0 |
| spa-stats | ok | 2618 | 276 | 444 | — | 7 | 1098 | 0 |
| spa-totw | ok | 3301 | 232 | 540 | — | 4 | 1756 | 0 |
| spa-club | ok | 2418 | 291 | 492 | — | 6 | 896 | 0 |
| route-profile | ok | 2818 | 277 | 456 | — | 0 | — | 0 |
| route-wrapped | ok | 3858 | 264 | 552 | — | 1 | — | 0 |

## Slow APIs (>500ms) and notes

### cold-home (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/site-details` | 1108 |

- Cache disabled via CDP Network.setCacheDisabled

### warm-home (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/captains/data?season=2026%2F27` | 929 |
| `/api/filter-bootstrap` | 686 |

- Cache enabled; soft reload

### spa-stats (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/player-monthly-stats` | 1529 |
| `/api/player-fantasy-breakdown` | 1491 |
| `/api/player-game-details` | 872 |

### spa-totw (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/club-badge-leaderboard` | 1107 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/wrapped/Luke-Bangs?stage=initial` | 1528 |

- Navigated to /wrapped/Luke-Bangs
- Marks: wrapped:first-slide-visible=1890ms, wrapped:logo-visible=1936ms

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
