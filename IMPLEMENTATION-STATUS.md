# NEW-FEATURES implementation status

**Purpose:** Running log of what is implemented vs still to do for the plan in **`NEW-FEATURES.md`** (same folder). Use this when resuming work across sessions. The plan file remains the detailed spec; this file is the checklist.

**Last updated:** 2026-03-29

**Current milestone:** ✅ Feature 12 Records on Club Information (website first cut) — Records moved above Milestones on Club Information and removed from merged Club Captains and Awards page; focused E2E coverage updated

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
| **Website** | `GET /api/club-records`; `components/club-info/RecordsSection.tsx` (initially under awards, moved in Feature 12 to Club Information above Milestones). |
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

### Achievement badges (Feature 9)

| Area | Notes |
|------|--------|
| **Data layer (`../database-dorkinians/`)** | `config/schema.js` — `PlayerBadge`, `HAS_BADGE`, extra `Player` fields; `services/badgeDefinitions.js`, `badgeComputation.js`, `playerBadgesComputation.js`; `relationshipManager.applyPlayerBadges()`; `seedingOrchestrator` runs it after `applyGraphInsights()`. |
| **Tests (DB)** | `npm run test:badges` — `services/badgeComputation.test.js`. |
| **Website** | `GET /api/player-badges?playerName=` — earned badges + progress; `GET /api/club-badge-leaderboard` — most badges / diamond / gold; `lib/badges/catalog.ts` (keep in sync with DB catalogue), `evaluate.ts`, `neo4jProps.ts`; `PlayerStats` — badge bar (`data-testid="player-badge-bar"`); milestone grid now lives on Player Profile (Feature 10); `BadgeLeaderboardSection` on Club Captains and Awards. |
| **Tests (site)** | Jest: `__tests__/unit/badges/parseBadgeId.test.ts`; Playwright: `5.31` (club badge leaderboard), `3.26` (player milestones, skips until seed). |

### Player Profile + Captaincies link (Feature 10)

| Area | Notes |
|------|--------|
| **Routes / UI** | Added `app/profile/[playerSlug]/page.tsx` + `components/profile/PlayerProfileView.tsx`; profile shows player header + badge bar, **Season Wrapped** section first, **Milestone badges** section second, then headline stat cards. |
| **Linking / slug** | Added `lib/profile/slug.ts`; Player Stats Captaincies/Awards section now renders underlined link `data-testid="milestone-badges-profile-link"` for **Milestone badges earned** to the current player profile. |
| **Player Stats change** | Removed in-place milestone grid from Player Stats achievements section (moved to Player Profile per plan). |
| **Tests** | Jest unit: `__tests__/unit/profile/slug.test.ts`; Playwright `3.26` updated to verify link navigation + profile section order. |

### Club Captains and Awards (Feature 11)

| Area | Notes |
|------|--------|
| **Merged page** | Added `components/club-info/ClubCaptainsAndAwards.tsx` and switched Club Info subpage `club-awards` to render a single merged screen titled **Club Captains and Awards**. |
| **Content preservation** | `ClubCaptains` and `ClubAwards` now support `embedded` mode and are rendered together on the merged page, preserving captains table/history popup + awards/badge leaderboard content (Records moved in Feature 12). |
| **Navigation updates** | Removed separate Club Captains entry from sidebar + settings navigation trees (`app/settings` and in-app `components/pages/Settings`) and renamed the remaining entry to **Club Captains and Awards**. |
| **Compatibility mapping** | Added canonical mapping in `lib/stores/navigation.ts` and E2E helper aliasing so persisted/legacy `club-captains` state resolves to merged `club-awards` subpage. |
| **Tests** | Updated Club Info E2E expectations/helpers to target merged heading and new subpage indexing; no new route-level redirects needed because Club Info subpages are state-driven, not separate URLs. |

### Records on Club Information (Feature 12)

| Area | Notes |
|------|--------|
| **UI placement** | Moved `RecordsSection` from the awards section component (renamed to `components/club-info/ClubAwardsSection.tsx`) into `components/club-info/ClubInformation.tsx`, inserted directly above the Milestones block. |
| **Merged page cleanup** | Club Captains and Awards no longer renders the Records block; awards + badge leaderboard remain in place. |
| **Tests** | Updated Club Info E2E: `5.29` now verifies Records on Club Information and checks Records appears above Milestones; `5.31` asserts Records is absent from Club Captains and Awards. Also tightened Club Captains heading selectors (`^Club Captains$`) to avoid strict-mode ambiguity after merged-page heading changes. |
| **Verification run** | Focused Chromium Playwright run for `5.16`, `5.20`, `5.21`, `5.29`, `5.30`, `5.31`: 4 passed, 2 skipped (data-dependent skips retained in test logic). |

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

- ✅ Feature 9 initial delivery (see **Completed → Achievement badges**). Optional later: chatbot badge phrasing, “recently unlocked” spotlight, richer badge icons.

### New Requests Round 2 (in progress)

Spec source: **`NEW-FEATURES.md` Phase 6 (Features 10-19)** (migrated from `New-Features-2.md`). Implement in order there; each item below lists **required tests** to add or extend when building.

**CI / merge policy (Feature 17):** Gate merges to **`main`** on **≥ 90% automated test pass rate** in CI (`passed / (passed + failed)`, excluding skipped — align with workflow definition in repo). Dev pipeline: run **E2E on push to Dev** as specified in Phase 6.

| Feature | Summary | Tests to add or update |
|--------|---------|-------------------------|
| **10** — Player Profile + Captaincies link | ✅ Website first cut done: profile route + section order + stats link migration | Follow-up: add/confirm integration coverage if dedicated profile API is introduced later |
| **11** — Club Captains and Awards | ✅ Website first cut done: merged page + single nav entry + legacy subpage-state mapping | Follow-up: run full Club Info Playwright flow against seeded env and decide if route-level redirects are required in any future URL-based routing |
| **12** — Records on Club Information | ✅ Website first cut done: Records moved to Club Information above Milestones; removed from merged captains/awards page | Follow-up: run full Club Info Playwright suite on seeded env to convert remaining data-dependent skips into hard assertions where possible |
| **13** — Home header profile icon | Profile icon left of settings when player selected on home → Player Profile | Playwright: icon visibility + navigation |
| **14** — Most Connected | Player Stats: top 5 connections to selected player | Jest: sort/limit; integration: API; Playwright: section + data when seeded |
| **15** — TOTW previous 10 weeks | 10 score boxes + week labels; click → that week’s TOTW | Playwright: strip + navigation |
| **16** — TOTW Share | Share/download WhatsApp-friendly image of current TOTW | Playwright: control present, no crash; Jest: constants if extracted |
| **17** — Dev branding + CI | `dev-icon-192x192`, “Dev” in homepage header on dev deploy; E2E on Dev push; **≥90% pass rate** for `main` | Playwright (dev env smoke): Dev label + icon; document/verify workflow YAML |
| **18** — VEO LINK on fixtures | Sheets column **VEO LINK** → DB `Fixture` (or agreed) → website APIs | DB: import/integration test; website: API integration test for `veoLink` |
| **19** — League Latest Result + modal parity | Per-team Latest Result card, formation dots + rating tooltips, Veo button, full player table; same expansion in Show Results modal | Jest: formatters; integration: combined fixture API; Playwright: league + modal flows |

---

## Repo map (quick reference)

| Repo | Role |
|------|------|
| `database-dorkinians` (sibling of this repo) | Google Sheets → CSV → Neo4j; schema; `matchDerivedFields`; seeding orchestration; `npm run test:match-derived` |
| `V3-Dorkinians-Website` (this repo) | Next.js app, `app/api/*`, stats UI, `NEW-FEATURES.md`, Jest/Playwright |

---

## Changing derived match rating scores

Edit **`../database-dorkinians/services/matchDerivedFields.js`** → `calculateMatchRating`. Run **`npm run test:match-derived`** in `database-dorkinians`, then **re-seed** so stored `matchRating` values refresh. UI badge colours (e.g. All Games modal) are separate display thresholds in this website.
