# Post-fix Track B comparison

**URL:** `https://dorkinians-website-v3.netlify.app`  
**Latest Track B:** 2026-10-10T20:53:03Z (wave 4 — player-stats-bootstrap)  
**Prior:** Wave 3 20:38Z · Wave 2 20:26Z · Wave 1 20:09Z · Baseline 19:17Z

## Smoke (wave 4)

| Check | Result |
|-------|--------|
| `/api/player-stats-bootstrap?playerName=Luke%20Bangs` | **200**; seasonal=10, team=6, captains=2, awards=3, playerData ok |
| Bootstrap cold → warm | **5101 ms → 91 ms** (shared cache working) |

## Track B key metrics

| Scenario | Metric | Baseline | Wave 2 best | Wave 3 | **Wave 4** |
|----------|--------|----------|-------------|--------|------------|
| cold-home | TTFB / FCP | 9139 / 9528 | 3367 / 3972 | 4768 / 5308 | 3841 / 4420 |
| warm-home | TTFB / FCP | 2915 / 3040 | 505 / 632 | **288 / 432** | 259 / 432 |
| spa-stats | click→useful | 1236 | **939** | 1134 | 1098 |
| spa-totw | click→useful | 14972 | **1137** | 1829 | 1756 |
| spa-club | click→useful | 1415 | 1215 | 1409 | **896** |
| route-wrapped | `stage=initial` | ~30s fail | **531** | 1496 | 1528 |

## Wave 4 interpretation

**Bootstrap succeeded (API shape)**  
spa-stats slow list is now **below-fold only**: `player-monthly-stats`, `player-fantasy-breakdown`, `player-game-details`.  
Gone from the hot path: `player-data`, awards/captains histories, seasonal/team as separate SPA calls (bundled into bootstrap earlier via `selectPlayer`).

**Click→useful barely moved (~1.1s)**  
Audit waits on the Stats **heading**, not chart data — so bootstrap improves data readiness / network contention more than that metric.

**Club best run yet** (~0.9s); badge leaderboard still ~1.1s when near fold.  
**TOTW** no APIs &gt;500ms this run; click→useful variance remains.  
**Wrapped** still ~1.5s initial (healthy vs old 30s fail).

## Remaining hotspots (evidence-ranked)

1. PlayerStats **below-fold** trio (monthly / fantasy / game-details) — fire on mount; idle/LazyWhenVisible them  
2. Cold bootstrap **~5s** — still N parallel Neo4j handlers under one HTTP; real Cypher merge is the next big Stats win  
3. `/api/players` direct still slow when not seeded (write-through bug)  
4. Club badge leaderboard  
5. Cold-home `/api/site-details`  
6. **Not now (per Luke):** home RSC, Netlify image optimization  
