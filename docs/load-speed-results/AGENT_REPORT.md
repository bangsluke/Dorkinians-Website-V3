# Agent load-speed report

Generated: 2026-10-10T19:17:02.586Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** Post-deploy check **passed** — every scenario `umamiRequests: 0`. See also [POST_DEPLOY_SUMMARY.md](./POST_DEPLOY_SUMMARY.md).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 11088 | 9139 | 9528 | — | 2 | — | 0 |
| warm-home | ok | 4593 | 2915 | 3040 | — | 5 | — | 0 |
| spa-stats | ok | 2761 | 518 | 764 | — | 5 | 1236 | 0 |
| spa-totw | ok | 16500 | 622 | 880 | — | 12 | 14972 | 0 |
| spa-club | ok | 2951 | 439 | 808 | — | 3 | 1415 | 0 |
| route-profile | ok | 2781 | 702 | 1252 | — | 0 | — | 0 |
| route-wrapped | ok | 6682 | 3052 | 3600 | — | 0 | — | 0 |

## Slow APIs (>500ms) and notes

### cold-home (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Cache disabled via CDP Network.setCacheDisabled

### warm-home (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/teams` | 1349 |
| `/api/opposition` | 1200 |
| `/api/opposition-clubs` | 1178 |

- Cache enabled; soft reload

### spa-stats (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/captains/player-history?playerName=Luke%20Bangs` | 976 |
| `/api/captains/data?season=2026%2F27` | 686 |
| `/api/opposition` | 647 |

### spa-totw (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/totw/weeks?season=2026%2F27` | 8318 |
| `/api/players` | 6645 |
| `/api/teams` | 5260 |
| `/api/totw/seasons` | 5053 |
| `/api/totw/weeks?season=2026%2F27` | 5012 |
| `/api/opposition-clubs` | 4529 |
| `/api/competitions` | 3546 |
| `/api/totw/week-data?season=2026%2F27&week=40` | 2825 |

Duplicates:

- `/api/totw/weeks?season=2026%2F27`

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/competitions` | 1230 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /wrapped/Luke-Bangs
- No wrapped:* performance marks observed yet

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
