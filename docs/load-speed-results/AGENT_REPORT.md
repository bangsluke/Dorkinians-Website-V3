# Agent load-speed report

Generated: 2026-10-10T21:26:56.985Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production only stops loading Umami after that change is deployed. See `umamiRequests` per scenario (expect `0` post-deploy).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 7195 | 4914 | 5692 | — | 2 | — | 0 |
| warm-home | ok | 2049 | 385 | 524 | — | 3 | — | 0 |
| spa-stats | ok | 2492 | 336 | 484 | — | 3 | 964 | 0 |
| spa-totw | ok | 8414 | 3253 | 3512 | — | 4 | 6894 | 0 |
| spa-club | ok | 2868 | 675 | 776 | — | 6 | 1349 | 0 |
| route-profile | ok | 3161 | 582 | 1408 | — | 0 | — | 0 |
| route-wrapped | ok | 3916 | 309 | 492 | — | 1 | — | 0 |

## Slow APIs (>500ms) and notes

### cold-home (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/site-details` | 1074 |

- Cache disabled via CDP Network.setCacheDisabled

### warm-home (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Cache enabled; soft reload

### spa-stats (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

### spa-totw (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/totw/current-week` | 2748 |

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/milestones` | 943 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/wrapped/Luke-Bangs?stage=initial` | 1964 |

- Navigated to /wrapped/Luke-Bangs
- Marks: wrapped:first-slide-visible=2349ms, wrapped:logo-visible=2382ms

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
