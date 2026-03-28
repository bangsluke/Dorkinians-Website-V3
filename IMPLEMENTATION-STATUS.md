# NEW-FEATURES implementation status

**Purpose:** Running log of what is implemented vs still to do for the plan in **`NEW-FEATURES.md`** (same folder). Use this when resuming work across sessions. The plan file remains the detailed spec; this file is the checklist.

**Last updated:** 2026-03-28

**Current milestone:** ✅ Feature 8 Season Wrapped (first cut) shipped — routes, JSON API, OG images, `html-to-image` share, homepage banner; set `NEXT_PUBLIC_SITE_URL` in production for correct `wrappedUrl`

**Database repo:** When this website repo sits next to the seeding service, paths below use **`../database-dorkinians/`**. If you only have the database clone, open the copy of this file from the website repo or maintain a short pointer there.

---

## How to use

1. Implement against **`NEW-FEATURES.md`** in rollout order.
2. After each session, update **this file** (Completed / Remaining / Notes).
3. When database seeding logic or schema changes: run a **full seed** against the target Neo4j instance before expecting the website to show new properties.
4. When only the Next.js app changes: **Netlify deploy** the website; seed only if the graph must change.

### Naming guardrail (persistent)

- Do **not** name implementation artifacts using rollout labels like `Phase 1`, `Phase 2`, `phase1`, `phase2`.
- Use stable, feature-oriented names instead (e.g. `foundation`, `starter`, `rating`, `formation`, `per90`, `form`, `streaks`, `records`, `wrapped`, `badges`).
- Applies to: file names, script names, function names, test titles, logs, and status notes.
- Exception: references inside **`NEW-FEATURES.md`** can keep original wording because that file is the spec source.

---

## Completed (as of last update)

### Foundation — Data layer (`../database-dorkinians/`)

| Area | Notes |
|------|--------|
| **`services/matchDerivedFields.js`** | `inferFormation`, `getMatchDetailFixtureGroupKey`, `assignMatchDetailStarterFields`, `calculateMatchRating` (baseline, position weights, clamp 1–10). |
| **`services/dataProcessor.js`** | Starter fields on grouped CSV rows; `matchRating` on MatchDetail create/bulk/MERGE paths. |
| **`services/relationshipManager.js`** | `applyFoundationDerivedAggregates()` — fixture `inferredFormation`; Player aggregates (starts, ratings, etc.) from the graph. |
| **`services/seedingOrchestrator.js`** | Calls `applyFoundationDerivedAggregates()` after relationships. |
| **`config/schema.js`** | `MatchDetail`: `started`, `playerOrder`, `matchRating`; `Fixture`: `inferredFormation`; `Player`: starter/rating aggregate fields per plan. |
| **Tests** | `services/matchDerivedFields.test.js` — `npm run test:match-derived`; Neo4j-backed integration: `scripts/test-foundation-derived-integration.js` — `npm run test:foundation-integration` |

### Foundation — Website (this repo)

| Area | Notes |
|------|--------|
| **APIs** | `player-data`, `player-data-filtered` — starts, bench/start win rates, match-rating aggregates; `team-data-filtered` — `formationBreakdown`; `fixture-lineup` — `matchRating`, `started`, `playerOrder`; `top-players-stats` — `starts`, `avgMatchRating`, `matchesRated8Plus`; `player-season-games` — per-row `matchRating`, minutes, starter fields for All Games. |
| **State / config** | `lib/stores/navigation.ts` — `PlayerData` / `TeamData` extensions; `config/config.ts` — stat objects + `statsToDisplay` for starter/rating rows. |
| **UI** | `PlayerStats` — Key Performance (Starts, Avg Rtg), **Starting impact**, data table rows; `TeamStats` — Top Players stat types, **Formations used** chart; `AllGamesModal` — rating badges, season avg, lineup Rtg column; `PlayerDetailModal` (TOTW) — match rating line when present. |
| **`types/index.ts`** | Optional `matchRating` on `MatchDetail`. |
| **Tests** | Jest: `__tests__/unit/matchDerivedFields.test.ts` (loads sibling DB module), `__tests__/integration/top-players-stats.integration.test.ts`; Playwright: `__tests__/e2e/03-stats/stats.spec.ts` — `#starting-impact` in section sweep, test **3.19** for Starting impact / optional formations. |

### Derived analytics — Per-90 (partial)

| Area | Notes |
|------|--------|
| **`../database-dorkinians/config/schema.js`** | Added Player per-90 properties: `goalsPer90`, `assistsPer90`, `goalInvolvementsPer90`, `ftpPer90`, `cleanSheetsPer90`, `concededPer90`, `savesPer90`, `cardsPer90`, `momPer90`. |
| **`../database-dorkinians/services/relationshipManager.js`** | `applyFoundationDerivedAggregates()` now writes per-90 aggregates using a **360-minute threshold** (`null` below threshold). |
| **APIs** | `player-data` / `player-data-filtered` now return per-90 values (thresholded); `top-players-stats` supports `goalsPer90`, `assistsPer90`, `goalInvolvementsPer90`, `ftpPer90`. |
| **UI** | `PlayerStats` data table includes per-90 rows and shows `Min. 360 mins` when below threshold; `TeamStats` top-player selector includes per-90 leaderboards. |
| **Tests** | Added integration coverage in `__tests__/integration/top-players-stats.integration.test.ts` for `goalsPer90`; existing foundation integration test remains green after aggregate extension. |

### Derived analytics — Per-90 (complete)

| Area | Notes |
|------|--------|
| **Player Stats table UX** | Added tabs: **Totals | Per App | Per 90** with per-90 minutes context and threshold message (`Min. 360 minutes required`) for ineligible rows. |
| **Player Stats key cards** | Added card toggle beneath Key Performance Stats to flip between totals and per-90 cards. |
| **Comparison radar** | Added **Per 90 Stats** radar category option with all per-90 metrics. |
| **Team Top Players** | Added additional per-90 leaderboard options and formatting (goals/assists/GI/FTP/clean sheets/conceded/saves/cards/MoM per 90). |
| **Tests** | Added per-90 helper unit tests in `../database-dorkinians/services/matchDerivedFields.test.js`, integration checks for `goalsPer90` and `cleanSheetsPer90`, and a Playwright stats per-90 mode check. |

### Derived analytics — Form curves

| Area | Notes |
|------|--------|
| **Data layer (`../database-dorkinians/`)** | Added EWMA helper functions (`computeEWMA`, `determineTrend`) and tests; `applyFoundationDerivedAggregates()` now writes `MatchDetail.ewmaReactive` / `ewmaBaseline` and Player form summary fields (`formCurrent`, `formBaseline`, `formTrend`, `formPeak`, `formPeakWeek`). |
| **Schema** | Added `ewmaReactive`, `ewmaBaseline` to `MatchDetail` and form summary properties to `Player`. |
| **Website API/UI** | Added `app/api/player-form/route.ts` and new Player Stats **Form** section (chart + summary cards) directly under Key Performance Stats; added key card indicator (`Form: value + trend arrow`); golden cross caption + tooltip on the form chart. |
| **Chatbot** | `FORM_CURRENT` for single-player and rankings (best/worst / poor / lowest form phrasing); formatting one decimal. |
| **Team Top Players** | Added `bestCurrentForm` stat option backed by `currentFormEwma`. |
| **Tests** | Added targeted E2E check for Form section (`3.21`) and integration coverage for top players `bestCurrentForm`. |

### Derived analytics — Streaks (Feature 5)

| Area | Notes |
|------|--------|
| **Data layer (`../database-dorkinians/`)** | `services/streakDetection.js` — `detectStreaks`, appearance streak vs primary-team fixtures, season-best (latest season in data) + all-time bests; `applyFoundationDerivedAggregates()` writes all `current*` / `seasonBest*` / `allTimeBest*` Player fields after form EWMA. |
| **Schema** | `TBL_Players.properties` extended per `NEW-FEATURES.md` Feature 5. |
| **Tests (DB)** | `npm run test:streak-detection` — unit tests on streak helpers; `scripts/test-foundation-derived-integration.js` asserts streak keys on Player after aggregates. |
| **Website API** | `player-data` / `player-data-filtered` RETURN + map streak fields from `p`; `GET /api/club-streaks-preview` — next fixture + squad streak highlights; `team-data-filtered` adds `streakLeaders` (single-XI) when `teamName !== "Whole Club"`. |
| **UI** | `PlayerStats` — **Streaks** section after Form (`#streaks-section`); homepage `StreaksAtRiskBanner`; Team Stats `#team-streak-leaders` (longest active streaks for selected XI). |
| **Chatbot** | Streak metrics in `chatbotMetrics` / entity extraction / `mapStatTypeToKey`; `playerQueryBuilder` + `rankingQueryHandler` Player-node streak queries; single-value + ranking answers in `chatbotService`; integer formatting in `formattingUtils`. |
| **Tests (site)** | Playwright `3.24` — streaks section visible; section id in desktop sweep list. |

### Records wall (Feature 6)

| Area | Notes |
|------|--------|
| **Data layer (`../database-dorkinians/`)** | `config/schema.js` — `ClubRecord` node + constraint; `services/clubRecordsComputation.js` — individual + team records, 80% challenger flags (appearances, career goals, active scoring/appearance streaks); `relationshipManager.applyClubRecords()`; `seedingOrchestrator` runs it after `applyFoundationDerivedAggregates()`. |
| **Tests (DB)** | `npm run test:club-records` — unit tests for slugify / team streak helper. |
| **Website** | `GET /api/club-records`; `components/club-info/RecordsSection.tsx` under awards; page title **Club Awards and Records** (sidebar, settings, `ClubAwards` h2). |
| **Tests (site)** | Playwright `5.29`–`5.30` — Records section + optional holder → Player Stats navigation when data exists. |

### Graph insights (Feature 7)

| Area | Notes |
|------|--------|
| **Data layer (`../database-dorkinians/`)** | `services/graphInsightsComputation.js` — partnership win rates (≥5 shared games), impact delta on `mostPlayedForTeam`; optional `gds.pageRank` + `gds.louvain` when `RETURN gds.version()` succeeds; `relationshipManager.applyGraphInsights()` after `applyClubRecords()`; `Player` schema fields per `NEW-FEATURES.md`. |
| **Tests (DB)** | `npm run test:graph-insights` — adjacency / top-partner sorting helpers. |
| **Website** | `player-data` + `player-data-filtered` return graph fields; Player Stats **Partnerships** + **Impact** after Streaks; data table rows (`PlayerGraph*` stats in `config.ts`); `GET /api/club-squad-backbone`; Club Stats **Squad backbone** (PageRank top 10, empty without GDS). |
| **Tests (site)** | Playwright `3.25` — headings for Partnerships / Impact; section ids in desktop sweep lists. |
| **GDS** | PageRank / Louvain / squad rank skipped when `gds.version()` fails (e.g. Free tier or plugin off); logs `ℹ️ GRAPH_INSIGHTS: GDS not available`. |

**Deferred for later (owner):** **GDS is not set up yet** on your Neo4j Aura instance (Graph Analytics / Professional tier as per `NEW-FEATURES.md`). No action required for **7a/7b** (partnerships + impact). **Save for when you want 7c/7d:** enable GDS on Aura, then run a **full re-seed** so `squadInfluence`, `squadInfluenceRank`, `communityId`, and Club Stats **Squad backbone** populate.

### Season Wrapped (Feature 8)

| Area | Notes |
|------|--------|
| **Routes** | `app/wrapped/[playerSlug]/page.tsx` — Framer Motion slides, dots, share via `html-to-image`, WhatsApp copy block. |
| **API** | `GET /api/wrapped/[playerSlug]` — optional `?season=`; slug = base64url of `playerName` (`lib/wrapped/slug.ts`). |
| **OG** | `GET /api/wrapped/[playerSlug]/og/[slideNumber]` — `next/og` ImageResponse (slides 1–9). |
| **Data** | `lib/wrapped/computeWrappedData.ts` — season-scoped stats, club percentiles, best month, peak match, streaks (season-best fields on `Player`), partner fields, `classifyPlayerType`. |
| **Home** | `SeasonWrappedBanner` after streaks banner; hide with `NEXT_PUBLIC_SEASON_WRAPPED_ACTIVE=false`. |
| **Tests** | Jest: `__tests__/unit/wrapped/*`, `wrapped-api.integration.test.ts`; Playwright: `__tests__/e2e/10-wrapped/wrapped.spec.ts`. |

### Optional foundation gap (non-blocking)

- **Chatbot** patterns for “how many times have I started?” (listed in plan; not necessarily done).

---

## Not started or incomplete (next sessions)

### Derived analytics

- **Feature 2:** ✅ Completed.
- **Feature 3:** ✅ Chatbot: `FORM_CURRENT` metric, ranking (best/worst form), single-player current form + baseline/trend; Player Stats form chart: golden cross caption + info tooltip.
- **Feature 4 (automated match ratings):** ✅ Done in foundation — `calculateMatchRating` / `matchRating` on MatchDetail and aggregates surfaced on the site (see Completed sections above).

### Records & graph

- **Feature 7:** ✅ Initial delivery (7a/7b in use after re-seed). **7c/7d (GDS):** code paths exist; **Aura GDS not configured yet** — treat as a later infra task (see Completed → Graph insights). **Chatbot** questions for partners / impact / connectivity not done yet (spec lists them).

### Badges

- `PlayerBadge` model, badge engine, player UI, club badge leaderboard, tests.

---

## Repo map (quick reference)

| Repo | Role |
|------|------|
| `database-dorkinians` (sibling of this repo) | Google Sheets → CSV → Neo4j; schema; `matchDerivedFields`; seeding orchestration; `npm run test:match-derived` |
| `V3-Dorkinians-Website` (this repo) | Next.js app, `app/api/*`, stats UI, `NEW-FEATURES.md`, Jest/Playwright |

---

## Changing derived match rating scores

Edit **`../database-dorkinians/services/matchDerivedFields.js`** → `calculateMatchRating`. Run **`npm run test:match-derived`** in `database-dorkinians`, then **re-seed** so stored `matchRating` values refresh. UI badge colours (e.g. All Games modal) are separate display thresholds in this website.
