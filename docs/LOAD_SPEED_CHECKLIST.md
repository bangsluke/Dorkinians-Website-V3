# Load Speed Analysis Checklist

Step-by-step checklist to measure first-page and subsequent-page load speed on the Dorkinians website, map slowdowns to code owners, and prioritise fixes. Follow the sections in order. Tick checkboxes as you complete each step. Fill in the baseline and re-measure tables with your own numbers.

**Production URL:** `https://dorkinians-website-v3.netlify.app`

**Related docs:** [PROFILE_WRAPPED_PERFORMANCE.md](./PROFILE_WRAPPED_PERFORMANCE.md), [load-speed-results/AGENT_REPORT.md](./load-speed-results/AGENT_REPORT.md), [load-speed-results/LOCAL_UMAMI_FLAG_CHECK.md](./load-speed-results/LOCAL_UMAMI_FLAG_CHECK.md), [MONITORING.md](./MONITORING.md)

**Umami:** Retired for this workflow. `featureFlags.umamiAnalytics` is `false` in [`config/config.ts`](../config/config.ts), so the third-party script is not injected. Do not use Umami for baselines.

---

## Table of Contents

1. [How this site loads (read first)](#1-how-this-site-loads-read-first)
2. [Dual-track workflow](#2-dual-track-workflow)
3. [What to measure (and when to share a HAR)](#3-what-to-measure-and-when-to-share-a-har)
4. [Lab targets](#4-lab-targets)
5. [Step A — Align with agent report](#5-step-a--align-with-agent-report)
6. [Step B — Lab: cold homepage](#6-step-b--lab-cold-homepage)
7. [Step C — Lab: warm homepage](#7-step-c--lab-warm-homepage)
8. [Step D — Lab: subsequent in-app pages](#8-step-d--lab-subsequent-in-app-pages)
9. [Step E — Real App Router routes](#9-step-e--real-app-router-routes)
10. [Step F — Bundle analysis](#10-step-f--bundle-analysis)
11. [Step G — Read each waterfall](#11-step-g--read-each-waterfall)
12. [Step H — Map findings to code](#12-step-h--map-findings-to-code)
13. [Step I — Ranked fixes (do after measuring)](#13-step-i--ranked-fixes-do-after-measuring)
14. [Step J — Re-measure](#14-step-j--re-measure)
15. [Results tables (fill these in)](#15-results-tables-fill-these-in)
16. [When to share traces or HAR files](#16-when-to-share-traces-or-har-files)
17. [Modern loading pattern vs this codebase](#17-modern-loading-pattern-vs-this-codebase)

---

## 1. How this site loads (read first)

Almost every “page” the user opens (Stats, Team of the Week, Club Info) is a **tab on `/`**, not a separate Next.js route. Footer and sidebar call `setMainPage(...)` and stay on `/` ([`components/layout/FooterNavigation.tsx`](../components/layout/FooterNavigation.tsx)).

| Kind | Routes / behaviour |
|------|--------------------|
| SPA shell | `/` — client page ([`app/page.tsx`](../app/page.tsx)), data after hydration |
| Real App Router | `/profile/[playerSlug]`, `/wrapped/[playerSlug]`, `/settings`, `/admin/*` |
| `loading.tsx` today | Only [`app/profile/[playerSlug]/loading.tsx`](../app/profile/[playerSlug]/loading.tsx) |

### Cold visit to `/` (expected sequence)

```text
HTML shell (layout + empty client page)
  → hydrate
  → parallel: /api/seasons, /api/teams, /api/opposition, /api/opposition-clubs, /api/competitions
  → also: /api/players (PlayerSelection), /api/site-details
  → then: /api/captains/data for current season
  → user opens Stats / TOTW / Club Info → more API waterfalls
```

A single long HAR that covers document + filters + later tabs will mix scenarios and is hard to interpret. Prefer **one recording per scenario** (see [Section 3](#3-what-to-measure-and-when-to-share-a-har)).

[Back to Table of Contents](#table-of-contents)

---

## 2. Dual-track workflow

Two independent tracks, then merge. Neither track needs Umami.

| Track | Who | How | Output |
|-------|-----|-----|--------|
| **A — Manual** | You | Chrome Lighthouse (Mobile ×3 median) + Network/Performance; optional [PageSpeed Insights](https://pagespeed.web.dev/) on production `/` | Tables B / D / E / J below |
| **B — Agent** | Unattended Playwright | `npm run test:e2e:load-speed` with `WEBSITE_URL=https://dorkinians-website-v3.netlify.app` | [load-speed-results/AGENT_REPORT.md](./load-speed-results/AGENT_REPORT.md) + `agent-baseline.json` |

**Merge rule**

- Treat your Lighthouse **medians** as the decision baseline.
- Treat agent numbers as a single lab run (repeatable, machine-written).
- If any shared metric differs by more than **20%**, re-run `npm run test:e2e:load-speed` once and note both agent runs before changing code.

**Agent scenarios (fixed):** `cold-home`, `warm-home`, `spa-stats`, `spa-totw`, `spa-club`, `route-profile`, `route-wrapped`.

[Back to Table of Contents](#table-of-contents)

---

## 3. What to measure (and when to share a HAR)

Use this order. Do **not** start with a single mega-HAR.

| Priority | Method | Why |
|----------|--------|-----|
| 1 | **Track B agent report** | Unattended, same scenarios every time |
| 2 | **Track A: Lighthouse + DevTools** on production, cold vs warm, separate tab sessions | Your decision baseline |
| 3 | **PageSpeed Insights** (optional) on production homepage | Lab + CrUX field without Umami |
| 4 | **Bundle analyze** (`npm run analyze`) | JS weight and chunk owners |
| 5 | **Chrome Performance trace (JSON)** per unclear scenario | Best for main-thread + network together |
| 6 | **HAR** (backup) | Network waterfall only; one file per scenario |

### HAR rules (if you use them)

- [ ] One HAR **per scenario** (cold `/`, warm `/`, Stats, TOTW, Club Info, profile, wrapped)
- [ ] Chrome DevTools → Network → right-click → **Save all as HAR with content**
- [ ] **Preserve log** off (so previous navigations are not mixed in)
- [ ] Name files clearly, e.g. `cold-home.har`, `totw-tab.har`
- [ ] Do **not** send one long session covering everything

You do **not** need to share a HAR to start this checklist. Share a Performance trace or HAR only if a waterfall does not match [Section 12](#12-step-h--map-findings-to-code) — see [Section 16](#16-when-to-share-traces-or-har-files).

[Back to Table of Contents](#table-of-contents)

---

## 4. Lab targets

Record against **mobile throttling** in Lighthouse / DevTools (Slow 4G or Lighthouse mobile preset) unless you note otherwise. The agent Playwright run uses Chromium desktop by default (see AGENT_REPORT for project name).

| Metric | Target (lab) | Notes |
|--------|--------------|-------|
| LCP | &lt; 2.5 s | Largest Contentful Paint |
| INP | &lt; 200 ms | Interaction to Next Paint |
| CLS | &lt; 0.1 | Cumulative Layout Shift |
| Document TTFB | &lt; 0.8 s | Time to First Byte for the HTML document |
| Time to first useful content | Write your own number | e.g. player list populated, or welcome/stats content visible |
| `/api/*` count before first useful content | Write your own number | Count unique requests before that moment |

**Wrapped-specific marks** (DevTools Performance → Timings): see [PROFILE_WRAPPED_PERFORMANCE.md](./PROFILE_WRAPPED_PERFORMANCE.md)

- `wrapped:logo-visible`
- `wrapped:first-slide-visible`
- `wrapped:deferred-slides-ready`

[Back to Table of Contents](#table-of-contents)

---

## 5. Step A — Align with agent report

Do this **before** trusting either track’s numbers for a fix decision.

- [x] Open [load-speed-results/AGENT_REPORT.md](./load-speed-results/AGENT_REPORT.md) (or run Track B: `WEBSITE_URL=https://dorkinians-website-v3.netlify.app npm run test:e2e:load-speed`)
- [x] Note agent date, base URL, and per-scenario status
- [x] Confirm agent reported `umamiRequests: 0` after a deploy that includes `umamiAnalytics: false` (pre-deploy production may still load Umami from old HTML)
- [x] Optional: PageSpeed Insights on `https://dorkinians-website-v3.netlify.app/` — paste scores into Table A notes (API 429; used Lighthouse instead)
- [x] Table A is for optional PSI / notes only (Umami field vitals retired) — filled 2026-10-10

[Back to Table of Contents](#table-of-contents)

---

## 6. Step B — Lab: cold homepage

**URL:** `https://dorkinians-website-v3.netlify.app/`

- [ ] Chrome: open an Incognito window (or clear site data)
- [ ] DevTools → Network → **Disable cache** checked
- [ ] Throttling: Lighthouse mobile or Slow 4G
- [ ] Run **Lighthouse** (Mobile) **3 times**; keep the **median** → [Table B](#table-b--lab-homepage)
- [ ] Hard reload once while recording **Network**
- [ ] Hard reload once while recording **Performance**
- [ ] Note time until player list / filters look usable
- [ ] Count `/api/*` requests before that moment
- [ ] List the slowest 5 `/api/*` calls (name + duration)
- [ ] Optional: save `cold-home` Performance trace or HAR (only if you will share later)

[Back to Table of Contents](#table-of-contents)

---

## 7. Step C — Lab: warm homepage

Same URL as Step B.

- [ ] DevTools → Network → **Disable cache** unchecked
- [ ] Soft reload (normal F5) after a successful cold load
- [ ] Lighthouse median (optional; note “warm”) → [Table B](#table-b--lab-homepage)
- [ ] Record Network: which responses are `(disk cache)` / `(memory cache)` vs fresh Neo4j-backed calls
- [ ] Note: client Zustand `pageCache` is **in-memory only** and resets on full refresh — warm browser HTTP cache is a different layer from the in-app 10-minute cache ([`lib/utils/pageCache.ts`](../lib/utils/pageCache.ts))

[Back to Table of Contents](#table-of-contents)

---

## 8. Step D — Lab: subsequent in-app pages

Stay on `/`. Use **cache on**. Start a **fresh Network recording for each tab** (clear the Network panel between tabs).

| # | Action | What to watch |
|---|--------|----------------|
| D1 | Select a player → open **Stats** | Wave of player-stat APIs; charts/maps JS |
| D2 | Open **Team of the Week** | Chain: seasons → weeks → week-data |
| D3 | Open **Club Info** (and league tables / comparison if you use them) | League N+1 latest-result calls; ~8× team-data-filtered on club comparison |

For each of D1–D3:

- [ ] Clear Network log, then click the tab
- [ ] Time from click → first useful content for that tab
- [ ] List `/api/*` waterfall (especially sequential chains)
- [ ] Flag duplicates (same URL twice)
- [ ] Fill [Table D](#table-d--subsequent-spa-tabs)

[Back to Table of Contents](#table-of-contents)

---

## 9. Step E — Real App Router routes

Pick a known player slug.

- [ ] Navigate to `/profile/[playerSlug]` (cold: disable cache; warm: cache on)
- [ ] Capture Network + Performance; note SSR vs client re-fetches
- [ ] Navigate to `/wrapped/[playerSlug]`; capture marks from [PROFILE_WRAPPED_PERFORMANCE.md](./PROFILE_WRAPPED_PERFORMANCE.md)
- [ ] Optional: `/settings`, `/admin` for completeness
- [ ] Fill [Table E](#table-e--app-router-routes)

[Back to Table of Contents](#table-of-contents)

---

## 10. Step F — Bundle analysis

- [ ] From the repo root: `npm run analyze` (sets `ANALYZE=true` and builds with webpack; see [`next.config.mjs`](../next.config.mjs))
- [ ] Note the largest client chunks (Stats, TOTW, Club Info, Chatbot, charts)
- [ ] Note whether idle prefetch ([`components/perf/DynamicChunksPrefetch.tsx`](../components/perf/DynamicChunksPrefetch.tsx)) downloads heavy chunks during first paint on a slow connection
- [ ] Write top 5 chunk names + sizes into [Table F](#table-f--bundle)

[Back to Table of Contents](#table-of-contents)

---

## 11. Step G — Read each waterfall

For every recording from Steps B–E:

- [ ] Group requests: **document**, **JS/CSS**, **images/fonts**, **`/api/*`**
- [ ] Flag any request **&gt; 500 ms**
- [ ] Flag **duplicates** (same path twice in one scenario)
- [ ] Flag **chains** where call B waits for call A (waterfall, not parallel)
- [ ] Note response sizes for large JSON payloads
- [ ] Check response headers on slow APIs: is `Cache-Control` present?

[Back to Table of Contents](#table-of-contents)

---

## 12. Step H — Map findings to code

Use this map so each slow bar has an owner. Tick when you have confirmed the match in your recording.

### Homepage cold load

| Symptom in DevTools | Likely owner | Notes |
|---------------------|--------------|--------|
| Empty HTML / late first useful content | [`app/page.tsx`](../app/page.tsx) | `"use client"`; no SSR domain data |
| Burst of filter APIs after hydrate | Navigation store `loadFilterData` | seasons, teams, opposition, opposition-clubs, competitions |
| `/api/site-details` then captains | `initializeCurrentSeason` → captains preload | Sequential by design today |
| `/api/players` | [`components/PlayerSelection.tsx`](../components/PlayerSelection.tsx) + possible chatbot prewarm | Duplicate risk with Neo4j prewarm |
| Heavy JS after idle | [`DynamicChunksPrefetch.tsx`](../components/perf/DynamicChunksPrefetch.tsx) | Helps next tab; can compete with LCP |

### Caching layers (why warm ≠ “instant”)

| Layer | Where | Behaviour |
|-------|--------|-----------|
| Client page cache | [`lib/utils/pageCache.ts`](../lib/utils/pageCache.ts) + Zustand | **10 min** TTL, **memory only**; lost on refresh; no stale-while-revalidate |
| Server `apiCache` | [`lib/utils/apiCache.ts`](../lib/utils/apiCache.ts) | In-process Map; wired mainly for club-achievements / milestones; other TTLs declared but unused |
| Upstash Redis | [`lib/middleware/rateLimiter.ts`](../lib/middleware/rateLimiter.ts) | **Rate limiting only**, not response cache |
| HTTP `Cache-Control` | Sparse on ~7 of ~71 API routes | Present on e.g. `players`, `seasons`, `site-details`; **missing** on `teams`, `league-tables`, `league-fixtures`, `league-latest-result` |
| Service worker | [`app/sw.ts`](../app/sw.ts) | Fonts/images; Serwist defaults; disabled in development |

### Known fan-outs / waterfalls

| Area | Pattern | Files / APIs |
|------|---------|--------------|
| Club comparison | ~8× parallel `POST /api/team-data-filtered` | Club stats comparison UI |
| League tables | 1× season list → table → **N×** `/api/league-latest-result` | League information components |
| TOTW | seasons → weeks → week-data | TOTW container / season-data routes |
| Profile SSR | player-data headline **then** wrapped meta (HTTP to self) | [`app/profile/[playerSlug]/page.tsx`](../app/profile/[playerSlug]/page.tsx) |
| Player badges | Multiple sequential Neo4j queries | [`app/api/player-badges/route.ts`](../app/api/player-badges/route.ts) |
| Neo4j | Pool configured; **no per-query timeout** on `session.run` | [`lib/neo4j.ts`](../lib/neo4j.ts) |

### Images

- [ ] Confirm production uses `images.unoptimized` when `NETLIFY` is set ([`next.config.mjs`](../next.config.mjs)) — Next image optimization is off on Netlify deploys unless that flag is changed

[Back to Table of Contents](#table-of-contents)

---

## 13. Step I — Ranked fixes (do after measuring)

Implement **after** baseline numbers exist. Re-measure after each change (or small batch). This section is a decision checklist, not a commit plan.

### Quick wins

- [ ] Add `Cache-Control: public, max-age=…, stale-while-revalidate=…` on stable GETs: `teams`, opposition, competitions, league season list, TOTW seasons (match patterns already used on `players` / `seasons` / `site-details`)
- [ ] Dedupe `/api/players` (PlayerSelection + Neo4j prewarm + Comparison) — single store/cache owner
- [ ] Profile SSR: `Promise.all` for player headline + wrapped meta
- [ ] Gate [`DynamicChunksPrefetch`](../components/perf/DynamicChunksPrefetch.tsx) on `navigator.connection.saveData` / slow-2g so idle prefetch does not fight first paint
- [ ] Add `loading.tsx` for `/wrapped`, `/settings`, `/admin` (profile already has one)

### Medium

- [ ] One **bootstrap** endpoint (or server-fetched filter payload) for home: seasons + teams + opposition + competitions + site-details in one round-trip
- [ ] Batch **league latest-results** (one endpoint for all teams in a table)
- [ ] Batch **club comparison** (one endpoint instead of ~8× `team-data-filtered`)
- [ ] One **TOTW current-week** payload (seasons + weeks + week-data)
- [ ] Client **stale-while-revalidate** for `cachedFetch` (pattern already used for club achievements / milestones in Club Information)
- [ ] Profile server page: call Neo4j helpers directly instead of `fetch(proto://host/api/...)`

### Larger (aligns with modern Next.js practice)

- [ ] Keep charts/maps as client islands; **server-render** the home shell and above-the-fold data with Suspense so first HTML includes useful content
- [ ] Use **Upstash Redis** (already in the project) as a shared cache in front of hot Neo4j reads so cold Netlify instances do not miss an in-memory `Map`
- [ ] Add a **query timeout** around `session.run` in [`lib/neo4j.ts`](../lib/neo4j.ts)
- [ ] Revisit Netlify `images.unoptimized` if image weight shows up in LCP

[Back to Table of Contents](#table-of-contents)

---

## 14. Step J — Re-measure

After each fix batch:

- [ ] Repeat Steps B–E with the **same** throttling and player slug
- [ ] Re-run Track B: `WEBSITE_URL=https://dorkinians-website-v3.netlify.app npm run test:e2e:load-speed`
- [ ] Fill the “After” columns in [Section 15](#15-results-tables-fill-these-in)
- [ ] Optional: re-check PageSpeed Insights on production `/` (no Umami field pipeline)

[Back to Table of Contents](#table-of-contents)

---

## 15. Results tables (fill these in)

### Table A — Optional PageSpeed / notes (Umami retired)

| Source | Score / metric | Value | Notes |
|--------|----------------|-------|-------|
| PageSpeed Insights (mobile) | Performance | N/A | API quota exceeded (429) |
| Agent Lighthouse (mobile median) | Performance / LCP / TTFB | 67 / 3268 ms / 638 ms | See [lighthouse-summary.json](./load-speed-results/lighthouse-summary.json) |
| Agent report date | — | 2026-10-10T19:17:02Z | [AGENT_REPORT.md](./load-speed-results/AGENT_REPORT.md) |
| Umami on production | Requests | **0** | Post-deploy confirmed (Playwright + CDP) |

Date recorded: 2026-10-10 (agent-led)

### Table B — Lab homepage

Lighthouse mobile ×3 on `/` (agent). Track B Playwright cold/warm in parentheses where noted.

| Run | Cold LCP | Cold TTFB | Cold first useful (s) | Cold `/api/*` count | Warm LCP | Warm first useful (s) |
|-----|----------|-----------|------------------------|---------------------|----------|------------------------|
| 1 | 3268 ms | 291 ms | — | — | — | — |
| 2 | 3267 ms | 638 ms | — | — | — | — |
| 3 | 3805 ms | 3377 ms | — | — | — | — |
| **Median** | **3268 ms** | **638 ms** | Track B cold FCP ~9.5s (desktop Chromium, unthrottled API-heavy) | Track B cold: 2 (Resource Timing undercount) / CDP home: 8 | Track B warm FCP ~3.0s | Track B warm duration ~4.6s |

Slowest cold `/api/*` (CDP home spot-check, name + ms):

1. `/api/opposition-clubs` — 4680
2. `/api/players` — 4202
3. `/api/opposition` — 4127
4. `/api/teams` — 3067
5. `/api/competitions` — 2475

### Table D — Subsequent SPA tabs

| Tab | Click → useful (s) | `/api/*` count | Longest API (name + ms) | Chains / duplicates noted |
|-----|--------------------|----------------|-------------------------|---------------------------|
| Stats (player) | Track B 1.2s (with player); CDP ~15s (no player / empty state) | Track B 5 | captains/player-history 976 (Track B) | Depends on player selection |
| TOTW | Track B **14.97s**; CDP ~instant (warm) | Track B 12 | `/api/totw/weeks` **8318** | Duplicate `/api/totw/weeks` |
| Club Info / leagues | Track B 1.4s; CDP ~instant (warm) | Track B 3 | `/api/competitions` 1230 | — |

### Table E — App Router routes

| Route | Cold LCP / useful | Warm | Marks / notes |
|-------|-------------------|------|---------------|
| `/profile/Luke-Bangs` | Lighthouse LCP 2934 ms (score 54); Track B FCP 1252 ms | CDP TTFB 573 / FCP 664 | CLS 0.272 on Lighthouse (above 0.1 target) |
| `/wrapped/Luke-Bangs` | Lighthouse LCP 2615 ms (score 75) | Track B FCP 3600 ms | Flaky: CDP saw **Could not load wrapped** + ~30s `stage=initial`; Lighthouse run succeeded later |

### Table F — Bundle

| Chunk / route group | Approx size | Notes |
|---------------------|-------------|-------|
| — | — | Skipped this pass (`npm run analyze` not run) |
| | | |
| | | |
| | | |
| | | |

### Table J — After fixes

| Scenario | Metric | Before | After | Change |
|----------|--------|--------|-------|--------|
| Cold `/` | LCP | | | |
| Cold `/` | First useful | | | |
| Cold `/` | `/api/*` count | | | |
| Stats tab | Click → useful | | | |
| TOTW | Click → useful | | | |
| Profile | LCP / useful | | | |
| Wrapped | first-slide mark | | | |

[Back to Table of Contents](#table-of-contents)

---

## 16. When to share traces or HAR files

Share with the coding agent **only if** something in your recording does not match [Section 12](#12-step-h--map-findings-to-code), or you want help prioritising the next fix.

**Preferred**

1. Chrome DevTools → Performance → stop recording → **Save profile…** (JSON)
2. One file per scenario, named like `cold-home.perf.json`

**Acceptable backup**

1. Network → **Save all as HAR with content**
2. One HAR per scenario; Preserve log off

**Also include**

- Scenario name (cold home, TOTW tab, etc.)
- Throttling setting
- Whether cache was disabled
- Your filled median numbers from Tables B/D/E

[Back to Table of Contents](#table-of-contents)

---

## 17. Modern loading pattern vs this codebase

| Modern practice | This codebase today |
|-----------------|---------------------|
| Stream useful HTML on first response (RSC + Suspense) | Client shell on `/`; domain data after `useEffect` |
| Cache read-mostly JSON at CDN (`Cache-Control` + SWR) | Only a handful of API routes set cache headers |
| Shared server cache across instances (e.g. Redis) | Upstash used for rate limits; `apiCache` is per-process memory |
| Batch DB work; avoid N+1 HTTP | League latest-result and club comparison fan-out |
| Client cache with stale-while-revalidate | 10 min memory hit-or-miss; Club Info achievements already show the better pattern |
| Islands for heavy charts | Dynamic imports used well; home still waits on client fetch before useful content |

**Goal of this checklist:** prove where time goes (field + lab), then apply Quick → Medium → Larger fixes with before/after numbers in the tables above.

[Back to Table of Contents](#table-of-contents)
