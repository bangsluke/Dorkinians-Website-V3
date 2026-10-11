# Post-fix Track B comparison

**URL:** `https://dorkinians-website-v3.netlify.app`  
**Latest Track B:** 2026-10-10T21:26:56Z (wave 7 — captains/badge cache + defer)  
**Handoff:** [NEXT_AGENT_HANDOFF.md](./NEXT_AGENT_HANDOFF.md)

## Smoke (wave 7) ✅

| Endpoint | Cold-ish → warm |
|----------|-----------------|
| captains/data | 757 → **56 ms** |
| club-badge-leaderboard | 1840 → **47 ms** |
| players | 395 → **82 ms** |
| filter-bootstrap | 1216 → **149 ms** |

## Track B highlights

| Scenario | Result |
|----------|--------|
| spa-stats | **964 ms** click→useful; no slow APIs |
| spa-club | badges/captains no longer the slow call; **milestones** ~943 ms remains |
| spa-totw | outlier **6.9s** this run (current-week cold); prior healthy ~1–2s |
| cold-home | site-details still ~1.1s |

## Next (for following agent)

1. Cache site-details  
2. Defer/cache milestones on club  
3. TOTW current-week cold variance  
4. Audit other Netlify API redirects  
