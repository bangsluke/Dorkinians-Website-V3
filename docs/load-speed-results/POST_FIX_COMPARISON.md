# Post-fix Track B comparison

**Date:** 2026-10-10  
**URL:** `https://dorkinians-website-v3.netlify.app`  
**App version on branch:** `3.5.0` (pushed to `speed-updates`; production HTML may still show prior version until merge/deploy)  
**Before:** [POST_DEPLOY_SUMMARY.md](./POST_DEPLOY_SUMMARY.md) / prior [AGENT_REPORT](./AGENT_REPORT.md) at 19:17Z  
**After:** Track B re-run 20:09Z (this folder’s current `AGENT_REPORT.md` / `agent-baseline.json`)

## Smoke (production)

| Endpoint | Status | Cache-Control |
|----------|--------|---------------|
| `/api/filter-bootstrap` | 200 | `public,max-age=300` |
| `/api/totw/current-week` | 200 | `public,max-age=3600` |
| `/api/health` | 200 | no-store |

## Track B before → after

| Scenario | Metric | Before | After | Change |
|----------|--------|--------|-------|--------|
| cold-home | TTFB / FCP | 9139 / 9528 | 6104 / 6504 | faster |
| warm-home | TTFB / FCP | 2915 / 3040 | 437 / 568 | much faster |
| spa-stats | click→useful | 1236 | 1116 | ~same |
| spa-totw | click→useful | **14972** | **1179** | **~12.7× faster** |
| spa-club | click→useful | 1415 | 1251 | modest |
| route-profile | FCP | 1252 | 1252 | same |
| route-wrapped | FCP | 3600 | 668 | much faster |
| route-wrapped | `/api/wrapped?...stage=initial` | ~30s fail (CDP) | **3424 ms** ok | reliability win |

Umami: all scenarios `umamiRequests: 0`.

## Interpretation

- **TOTW** is the clearest win: seasons→weeks→week-data waterfall gone; `current-week` + caches.
- **Warm home / filter fan-out** improved (no multi-second teams/opposition/clubs on warm reload).
- **Wrapped** `stage=initial` completes in ~3.4s instead of timing out.
- Cold-home TTFB still Netlify/cold-start heavy; not the main target of these API fixes.

## Remaining larger items

Full RSC homepage, Upstash API cache, league N+1 / team fan-out batching, image optimization flip.
