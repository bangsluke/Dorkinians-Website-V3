# Post-fix Track B comparison

**URL:** `https://dorkinians-website-v3.netlify.app`  
**Latest Track B:** 2026-10-10T20:38:25Z (wave 3 — players in bootstrap + club staging)  
**Wave 2:** 20:26Z · **Wave 1:** 20:09Z · **Baseline:** 19:17Z

## Smoke (wave 3)

| Check | Result |
|-------|--------|
| `filter-bootstrap` includes `players` | **Yes** (651 players); cold ~852 ms, warm ~143 ms |
| Direct `GET /api/players` | Still ~2.2–2.7 s each hit (server write-through may not be sticking across instances; client seed still helps SPA) |

## Track B four-way (key metrics)

| Scenario | Metric | Baseline | Wave 1 | Wave 2 | Wave 3 |
|----------|--------|----------|--------|--------|--------|
| cold-home | TTFB / FCP | 9139 / 9528 | 6104 / 6504 | **3367 / 3972** | 4768 / 5308 |
| warm-home | TTFB / FCP | 2915 / 3040 | 437 / 568 | 505 / 632 | **288 / 432** |
| spa-stats | click→useful | 1236 | 1116 | **939** | 1134 |
| spa-totw | click→useful | 14972 | 1179 | **1137** | 1829 |
| spa-club | click→useful | 1415 | 1251 | **1215** | 1409 |
| route-wrapped | `stage=initial` | ~30s fail | 3424 | **531** | 1496 |
| route-wrapped | first-slide mark | — | — | 1349 | 1819 |

## Wave 3 interpretation

- **Players seed worked for SPA:** `/api/players` is **gone** from TOTW/club slow-API lists (was ~2.2s).
- TOTW click→useful slower this run because **`/api/player-data-filtered` ~2.6s** (selected-player path from prior stats step), not players list.
- Club still loads badge leaderboard (~1.3s) — LazyWhenVisible may still fire when the section is near the fold.
- Cold-home / wrapped / SPA timings show **normal Netlify+Neo4j variance**; wave 2 remains the best single snapshot for cold/TOTW/wrapped.
- Overall vs original baseline: still a large win on TOTW (~15s → ~1–2s) and wrapped reliability.
