# Post-fix Track B comparison

**URL:** `https://dorkinians-website-v3.netlify.app`  
**Latest Track B:** 2026-10-10T21:01:09Z (wave 5 — below-fold defer + Redis harden)  
**Prior:** Wave 4 20:53Z

## Smoke (wave 5)

| Check | Result |
|-------|--------|
| `filter-bootstrap` | ~859 ms, 651 players |
| `GET /api/players` after bootstrap | Still **~2.2–3.3 s** every hit; `Cache-Control: no-cache` |
| `GET /api/teams` (control) | 1214 ms → **58 ms** (`public,max-age=3600`) |
| `player-stats-bootstrap` warm | **101 ms** |

**Root cause for players:** `netlify.toml` redirected `/api/players` → `/.netlify/functions/players` (uncached Neo4j function). Redirect **removed in repo** — needs redeploy to take effect.

## Track B (wave 5)

| Scenario | click→useful / key | Slow APIs |
|----------|-------------------|-----------|
| spa-stats | **987 ms** | Only `player-opposition-performance` (~1s) — **monthly/fantasy/game-details gone** |
| spa-club | **911 ms** | badges + captains/data |
| spa-totw | 1740 ms | none &gt;500 ms |
| warm-home | FCP 492 | none &gt;500 ms |
| wrapped | stage-initial 805 ms; first-slide ~1.2 s | |

## Verdict

| Item | Status |
|------|--------|
| #1 Below-fold Stats defer | **Success** |
| #2 `/api/players` Redis/HTTP cache | **Blocked by Netlify redirect** — fix staged (remove redirect); redeploy required |
