# Post-fix Track B comparison

**URL:** `https://dorkinians-website-v3.netlify.app`  
**Latest Track B:** 2026-10-10T21:14:10Z (wave 6 — players via Next.js)  
**Original baseline:** 19:17Z

## Smoke — players cache fixed ✅

| Check | Before redirect fix | Wave 6 |
|-------|---------------------|--------|
| `/api/players` Cache-Control | `no-cache` (Netlify fn) | **`public,max-age=3600`** |
| `/api/players` after bootstrap | ~2.2–3.3 s every hit | **291 → ~100 ms** |
| `/api/teams` control | — | 355 → 74 ms |

## Track B wave 6 vs baseline

| Scenario | Metric | Baseline | Wave 6 |
|----------|--------|----------|--------|
| warm-home | FCP | 3040 | **392** |
| spa-stats | click→useful | 1236 | **899** |
| spa-totw | click→useful | 14972 | **1662** |
| spa-club | click→useful | 1415 | **1042** |
| wrapped | stage=initial | ~30s fail | **1454** (marks ~2.2s) |
| cold-home | FCP | 9528 | 5728 (cold-start variance) |

spa-stats/totw: no `/api/players` in slow lists. Club badge still ~1s.

## Remaining hotspots (for next steps)

1. Club badge leaderboard (~1s on spa-club)
2. `captains/data` on stats (~1s) — season-wide, not player bootstrap
3. Cold-home `site-details` (~1.1s) + cold TTFB variance
4. Wrapped cold ~1.5s (acceptable vs old failure)
5. Parked: home RSC, image optimization, deep Cypher merge of stats bootstrap
