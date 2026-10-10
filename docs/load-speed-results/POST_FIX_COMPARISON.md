# Post-fix Track B comparison

**URL:** `https://dorkinians-website-v3.netlify.app`  
**Latest Track B:** 2026-10-10T20:26:25Z (wave 2 — Upstash L2 + league batch + stats staging)  
**Prior Track B:** 20:09Z (wave 1 — bootstrap / TOTW / client cache)  
**Original baseline:** 19:17Z ([POST_DEPLOY_SUMMARY.md](./POST_DEPLOY_SUMMARY.md))

## Smoke (wave 2)

| Endpoint | Cold | Warm (repeat) | Cache-Control |
|----------|------|---------------|---------------|
| `/api/filter-bootstrap` | ~615 ms | **~82–93 ms** | `public,max-age=300` |
| `/api/totw/current-week` | ~188 ms | — | `public,max-age=3600` |
| `/api/league-latest-results` (8 teams) | ~2.5 s | **~136–193 ms** | `public,max-age=300` |

Warm repeats show shared/instance cache working (Upstash L2 and/or in-process).

## Track B three-way

| Scenario | Metric | Baseline | Wave 1 | Wave 2 | vs baseline |
|----------|--------|----------|--------|--------|-------------|
| cold-home | TTFB / FCP | 9139 / 9528 | 6104 / 6504 | **3367 / 3972** | ~2.7× / ~2.4× faster |
| warm-home | TTFB / FCP | 2915 / 3040 | 437 / 568 | 505 / 632 | ~held (warm) |
| spa-stats | click→useful | 1236 | 1116 | **939** | ~24% faster |
| spa-totw | click→useful | **14972** | 1179 | **1137** | **~13× faster** |
| spa-club | click→useful | 1415 | 1251 | 1215 | modest |
| route-profile | FCP | 1252 | 1252 | 1244 | flat |
| route-wrapped | FCP | 3600 | 668 | 972 | much faster vs baseline |
| route-wrapped | `stage=initial` | ~30s fail | 3424 | **531** | strong |
| route-wrapped | marks | none | none | first-slide **1349 ms** | useful paint observed |

Umami: all scenarios `umamiRequests: 0`.

## Interpretation

**Wins this deploy**
- Cold home improved again (TTFB/FCP ~half of wave 1) — consistent with Redis/shared cache + warmer platform.
- Wrapped `stage=initial` ~3.4s → **0.5s**; first-slide marks now fire (~1.3s).
- Stats click→useful edged down (~1.1s → **0.94s**) with staged fetches.
- League batch endpoint live; warm hits &lt;200 ms.

**Still hot**
- `/api/players` ~2.2s on TOTW/club SPA (cache miss path still expensive).
- Stats still blocked by `player-data` / awards / captains (~1–1.6s).
- Club SPA still loads players + `player-data-filtered` + badges in parallel.

**Not moved much by this wave (expected)**
- SPA club/TOTW “click→useful” already ~1.1–1.2s after wave 1 (heading-level metric); deeper club league batch helps after first paint.

## Next levers

1. Cache/warm `/api/players` harder (or include in filter-bootstrap payload already cached).
2. Stage club-info secondary APIs (badges / player-data-filtered) like club-stats comparison.
3. Home RSC for Lighthouse LCP.
4. Optional: batch `team-data-filtered` server-side.
