# Post-deploy load-speed summary

**Date:** 2026-10-10  
**URL:** `https://dorkinians-website-v3.netlify.app`  
**Tooling used:** repo Playwright Track B, local Lighthouse CLI (after `npm install lighthouse --no-save`), `cursor-ide-browser` CDP  
**Tooling skipped:** `user-playwright` MCP + Chrome DevTools MCP (Authenticate hangs → “Skipped authentication”); PageSpeed Insights API (429 quota)

## Umami

**Pass.** Track B: `umamiRequests: 0` on all 7 scenarios. CDP: no `umami.is` scripts or resources.

## Lighthouse mobile (homepage median of 3)

Authoritative on-disk values after the Lighthouse subagent finished (reparsed into [lighthouse-summary.json](./lighthouse-summary.json)).

| Metric | Median | Target | Pass? |
|--------|--------|--------|-------|
| Performance score | 67 | — | — |
| LCP | 3268 ms | &lt; 2500 ms | No |
| FCP | 1245 ms | — | — |
| TBT | 1222 ms | — | — |
| CLS | 0 | &lt; 0.1 | Yes |
| TTFB (server-response-time) | 638 ms | &lt; 800 ms | Yes |

| Route | Score | LCP | Notes |
|-------|-------|-----|-------|
| Profile | 54 | 2934 ms | CLS **0.272** |
| Wrapped | 75 | 2615 ms | Better than CDP failure run; still treat wrapped as flaky (CDP saw ~30s API fail) |

## Track B (Playwright) highlights

| Scenario | Key number | Notes |
|----------|------------|-------|
| cold-home | TTFB 9139 / FCP 9528 ms | Unthrottled desktop; cold Netlify/Neo4j variance vs Lighthouse TTFB |
| spa-totw | click→useful **14972 ms** | `/api/totw/weeks` 8318 ms; duplicate weeks fetch |
| spa-stats | click→useful 1236 ms | With Luke Bangs selected |
| spa-club | click→useful 1415 ms | |
| route-wrapped | FCP 3600 ms | No wrapped:* marks in this run |

Full table: [AGENT_REPORT.md](./AGENT_REPORT.md)

## CDP spot-checks (aligned with Umami off)

- Home APIs: opposition-clubs / players / opposition / teams / competitions all multi-second
- Stats soft-nav ~15s without player (empty state path)
- TOTW / Club Info near-instant once home warm
- **Wrapped:** UI “Could not load wrapped” after `/api/wrapped/Luke-Bangs?stage=initial` ~**30s**

## Merge vs checklist targets

- Document TTFB (Lighthouse): OK  
- LCP home: **miss** (~3.3s median)  
- CLS profile: **miss**  
- Data load: TOTW and filter bootstrap APIs dominate; wrapped stage=initial reliability issue

## Ranked next code actions (Step I — not done this pass)

1. Batch / cache TOTW seasons+weeks+week-data; remove duplicate `/api/totw/weeks`
2. Home filter bootstrap (or Cache-Control + shared cache) for teams/opposition/competitions/players
3. Investigate wrapped `stage=initial` timeout/failure (~30s)
4. Profile CLS (layout shift on headline/SSR hydrate)
5. Dedupe `/api/players` callers

## Cannot do (needs you)

- Desktop Chrome DevTools “feel” / Slow-4G manual INP
- Working `user-playwright` / Chrome DevTools MCP (auth skip)
- PageSpeed Insights until quota resets or you use an API key
- Approving Step I code changes (say the word to start a fix plan)

## Rollback / noise

Local `npm install lighthouse --no-save` may have touched `node_modules` / lockfile; not required for production. Safe to discard those install artifacts if undesired.
