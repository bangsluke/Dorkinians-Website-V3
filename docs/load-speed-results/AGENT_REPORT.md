# Agent load-speed report

Generated: 2026-10-10T21:14:10.308Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production only stops loading Umami after that change is deployed. See `umamiRequests` per scenario (expect `0` post-deploy).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 7352 | 4900 | 5728 | — | 3 | — | 0 |
| warm-home | ok | 1897 | 247 | 392 | — | 3 | — | 0 |
| spa-stats | ok | 2421 | 279 | 412 | — | 3 | 899 | 0 |
| spa-totw | ok | 3184 | 229 | 424 | — | 5 | 1662 | 0 |
| spa-club | ok | 2565 | 431 | 540 | — | 5 | 1042 | 0 |
| route-profile | ok | 3696 | 721 | 1908 | — | 0 | — | 0 |
| route-wrapped | ok | 4042 | 319 | 648 | — | 1 | — | 0 |

## Slow APIs (>500ms) and notes

### cold-home (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/site-details` | 1104 |

- Cache disabled via CDP Network.setCacheDisabled

### warm-home (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Cache enabled; soft reload

### spa-stats (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/captains/data?season=2026%2F27` | 1046 |

### spa-totw (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/club-badge-leaderboard` | 989 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/wrapped/Luke-Bangs?stage=initial` | 1454 |

- Navigated to /wrapped/Luke-Bangs
- Marks: wrapped:first-slide-visible=2161ms, wrapped:logo-visible=2192ms

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
