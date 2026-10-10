# Performance fixes implemented (local — deploy to measure on production)

Date: 2026-10-10

## Shipped in this change set

| Area | Change |
|------|--------|
| HTTP cache | `Cache-Control` + in-process `apiCache` on teams, opposition, opposition-clubs, competitions, players, totw seasons/weeks/week-data, league-tables |
| Home filters | New [`/api/filter-bootstrap`](../../app/api/filter-bootstrap/route.ts); [`loadFilterData`](../../lib/stores/navigation.ts) uses one round-trip |
| TOTW | New [`/api/totw/current-week`](../../app/api/totw/current-week/route.ts); TeamOfTheWeek first paint uses it (removes seasons→weeks→week-data client waterfall) |
| Players dedupe | [`playersListCache`](../../lib/utils/playersListCache.ts); PlayerSelection + Comparison share in-flight request; Neo4jPreWarm uses `/api/health` |
| Profile SSR | Parallel headline + wrapped meta fetches; `min-h-[70vh]` to reduce CLS |
| Prefetch | Skip heavy chunk prefetch on save-data / 2g; delay idle fallback to 2s |
| Route UX | `loading.tsx` for wrapped, settings, admin |
| Client cache | `cachedFetch` stale-while-revalidate; store returns stale entries |
| Wrapped | Parallel Neo4j queries for stage=initial; client retry + 45s abort; `maxDuration = 60` |
| Neo4j | 25s query timeout on `runQuery` / `executeQuery` (`NEO4J_QUERY_TIMEOUT_MS` override) |

## Validation (pre-deploy)

- Unit: `playersListCache` dedupe test passed; `umamiAnalytics` flag tests passed
- Production Track B **cannot** prove these endpoints until Netlify deploy (new routes 404 on live until then)
- After deploy: `WEBSITE_URL=https://dorkinians-website-v3.netlify.app npm run test:e2e:load-speed` and compare to [POST_DEPLOY_SUMMARY.md](./POST_DEPLOY_SUMMARY.md)

## Intentionally not done (larger / risk)

- Full RSC homepage with SSR domain data
- Upstash Redis as shared API cache (still rate-limit only)
- Batch league-latest-result / 8× team-data-filtered endpoints (separate API design)
- Netlify `images.unoptimized` flip (needs image pipeline check)
