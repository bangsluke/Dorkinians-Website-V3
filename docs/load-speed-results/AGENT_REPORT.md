# Agent load-speed report

Generated: 2026-10-10T17:31:10.994Z

Base URL: `https://dorkinians-website-v3.netlify.app`

Playwright project: `chromium`

Player: `Luke Bangs` (slug `Luke-Bangs`)

**Umami:** `featureFlags.umamiAnalytics` is **`false` in the repo**; layout gates the script. Production (this report) still shows `umamiRequests` &gt; 0 until you deploy. **Local pre-deploy proof that the flag works:** [LOCAL_UMAMI_FLAG_CHECK.md](./LOCAL_UMAMI_FLAG_CHECK.md) (`umami_in_html=False` with Umami env vars set; localhost cold-home `umamiRequests: 0`).

## Scenarios

| ID | Status | Duration (ms) | TTFB (ms) | FCP (ms) | LCP (ms) | `/api/*` count | Click→useful (ms) | Umami reqs |
|----|--------|---------------|-----------|----------|----------|----------------|-------------------|------------|
| cold-home | ok | 4254 | 2168 | 2700 | — | 4 | — | 1 |
| warm-home | ok | 2021 | 318 | 500 | — | 7 | — | 1 |
| spa-stats | ok | 2732 | 443 | 668 | — | 8 | 1195 | 2 |
| spa-totw | ok | 5894 | 532 | 1092 | — | 16 | 4377 | 2 |
| spa-club | ok | 2926 | 533 | 684 | — | 11 | 1408 | 3 |
| route-profile | ok | 3214 | 342 | 1060 | — | 1 | — | 2 |
| route-wrapped | ok | 4369 | 557 | 1056 | — | 2 | — | 2 |

## Slow APIs (>500ms) and notes

### cold-home (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/teams` | 983 |
| `/api/opposition` | 953 |

- Cache disabled via CDP Network.setCacheDisabled

### warm-home (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Cache enabled; soft reload

### spa-stats (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/captains/data?season=2026%2F27` | 1470 |
| `/api/opposition-clubs` | 644 |
| `/api/teams` | 643 |
| `/api/competitions` | 555 |

### spa-totw (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/player-data?playerName=Luke%20Bangs` | 2742 |
| `/api/players` | 2618 |
| `/api/totw/week-data?season=2026%2F27&week=40` | 1236 |
| `/api/totw/weeks?season=2026%2F27` | 1121 |
| `/api/totw/seasons` | 1007 |
| `/api/totw/week-data?season=2026%2F27&week=40` | 740 |
| `/api/totw/week-data?season=2026%2F27&week=40` | 725 |
| `/api/captains/data?season=2026%2F27` | 627 |

Duplicates:

- `/api/totw/weeks?season=2026%2F27`
- `/api/totw/week-data?season=2026%2F27&week=40`

### spa-club (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/club-badge-leaderboard` | 1201 |
| `/api/milestones` | 944 |
| `/api/opposition-clubs` | 739 |
| `/api/opposition` | 738 |
| `/api/teams` | 624 |
| `/api/captains/data?season=2026%2F27` | 572 |
| `/api/competitions` | 526 |

### route-profile (`ok`)

No `/api/*` resources over 500ms recorded in Resource Timing.

- Navigated to /profile/Luke-Bangs with cache disabled

### route-wrapped (`ok`)

| API | Duration (ms) |
|-----|---------------|
| `/api/wrapped/Luke-Bangs?stage=initial` | 1911 |

- Navigated to /wrapped/Luke-Bangs
- No wrapped:* performance marks observed yet

## How to merge with manual Track A

1. Fill Lighthouse medians in [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md) Tables B/D/E.
2. Compare against this table; flag >20% gaps and re-run `npm run test:e2e:load-speed`.

Raw JSON: [agent-baseline.json](./agent-baseline.json)
