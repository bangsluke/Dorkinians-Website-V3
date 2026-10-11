# Load-speed handoff for next agent

**Updated:** 2026-10-10 (wave 7 verified)  
**Canonical copy also in agent store:** `LOAD_SPEED_HANDOFF.md`

## Latest verify (post badge/captains/players cleanup deploy)

**Smoke — caches working**

| Endpoint | 1st | 2nd | Cache-Control |
|----------|-----|-----|---------------|
| `/api/captains/data?season=2026/27` | 757ms | **56ms** | public,max-age=300 |
| `/api/club-badge-leaderboard` | 1840ms | **47ms** | public,max-age=300 |
| `/api/players` | 395ms | **82ms** | public,max-age=3600 |
| `/api/filter-bootstrap` | 1216ms | **149ms** | public,max-age=300 |

**Track B (21:26Z)** — see [AGENT_REPORT.md](./AGENT_REPORT.md)

| Scenario | click→useful / note |
|----------|---------------------|
| spa-stats | **964ms**; no APIs &gt;500ms |
| spa-club | 1349ms; slow: **milestones** (~943ms) — badges/captains off hot path |
| spa-totw | **6894ms** outlier this run (`current-week` 2748ms) — treat as cold Neo4j variance; prior runs ~1.1–1.8s |
| warm-home | FCP 524ms |
| cold-home | still dominated by TTFB + **site-details** ~1.1s |

`netlify/functions/players.js` — **deleted**. Do not restore `/api/players` Netlify redirect.

## Next steps (do these)

1. **Cache `/api/site-details`** (apiCache + Cache-Control) — cold-home still shows it ~1s.
2. **Idle-defer or cache `/api/milestones`** on Club Info (now the spa-club slow call).
3. **Harden TOTW cold path** — investigate why `current-week` sometimes ~2.7s (Redis miss / Neo4j); ensure write-through after first build.
4. Scan `netlify.toml` for other `/api/*` → functions redirects that bypass Next cache.
5. Optional docs cleanup: remove stale `functions/players` mentions in `.cursor/rules/netlify-functions.mdc` / architectural plan.

## Parked (Luke said not now)

- Home RSC / SSR useful shell  
- Flip `images.unoptimized` on Netlify  
- Cypher-level merge inside `player-stats-bootstrap` (handler fan-out OK for now)

## Re-run command

```powershell
$env:WEBSITE_URL="https://dorkinians-website-v3.netlify.app"
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npm run test:e2e:load-speed
```

Background: [FIXES_IMPLEMENTED.md](./FIXES_IMPLEMENTED.md), [POST_FIX_COMPARISON.md](./POST_FIX_COMPARISON.md), [LOAD_SPEED_CHECKLIST.md](../LOAD_SPEED_CHECKLIST.md).
