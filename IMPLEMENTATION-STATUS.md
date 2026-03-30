# NEW-FEATURES implementation status

**Purpose:** Running log of what is implemented vs still to do for the plan in **`NEW-FEATURES.md`** (same folder). Use this when resuming work across sessions. The plan file remains the detailed spec; this file is the checklist.

**Last updated:** 2026-03-30

**Current milestone:** ✅ Feature 19 League Latest Result + modal parity (website first cut) — League Information now shows per-team latest result with formation/rating details and Show Results modal now supports formation + Veo + full-details toggle parity

**Next focus:** Phase 6 UX follow-ups — **`NEW-FEATURES.md` Feature 20** and related amendments to Features 8 / 10 / 13 (see **Not started → Phase 6 UX polish** below); spec is canonical, implementation not started.

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

| Area                                  | Notes                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`services/matchDerivedFields.js`**  | `inferFormation`, `getMatchDetailFixtureGroupKey`, `assignMatchDetailStarterFields`, `calculateMatchRating` (baseline, position weights, clamp 1–10).                                    |
| **`services/dataProcessor.js`**       | Starter fields on grouped CSV rows; `matchRating` on MatchDetail create/bulk/MERGE paths.                                                                                                |
| **`services/relationshipManager.js`** | `applyFoundationDerivedAggregates()` — fixture `inferredFormation`; Player aggregates (starts, ratings, etc.) from the graph.                                                            |
| **`services/seedingOrchestrator.js`** | Calls `applyFoundationDerivedAggregates()` after relationships.                                                                                                                          |
| **`config/schema.js`**                | `MatchDetail`: `started`, `playerOrder`, `matchRating`; `Fixture`: `inferredFormation`; `Player`: starter/rating aggregate fields per plan.                                              |
| **Tests**                             | `services/matchDerivedFields.test.js` — `npm run test:match-derived`; Neo4j-backed integration: `scripts/test-foundation-derived-integration.js` — `npm run test:foundation-integration` |

### Foundation — Website (this repo)

| Area                 | Notes                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **APIs**             | `player-data`, `player-data-filtered` — starts, bench/start win rates, match-rating aggregates; `team-data-filtered` — `formationBreakdown`; `fixture-lineup` — `matchRating`, `started`, `playerOrder`; `top-players-stats` — `starts`, `avgMatchRating`, `matchesRated8Plus`; `player-season-games` — per-row `matchRating`, minutes, starter fields for All Games. |
| **State / config**   | `lib/stores/navigation.ts` — `PlayerData` / `TeamData` extensions; `config/config.ts` — stat objects + `statsToDisplay` for starter/rating rows.                                                                                                                                                                                                                      |
| **UI**               | `PlayerStats` — Key Performance (Starts, Avg Rtg), **Starting impact**, data table rows; `TeamStats` — Top Players stat types, **Formations used** chart; `AllGamesModal` — rating badges, season avg, lineup Rtg column; `PlayerDetailModal` (TOTW) — match rating line when present.                                                                                |
| **`types/index.ts`** | Optional `matchRating` on `MatchDetail`.                                                                                                                                                                                                                                                                                                                              |
| **Tests**            | Jest: `__tests__/unit/matchDerivedFields.test.ts` (loads sibling DB module), `__tests__/integration/top-players-stats.integration.test.ts`; Playwright: `__tests__/e2e/03-stats/stats.spec.ts` — `#starting-impact` in section sweep, test **3.19** for Starting impact / optional formations.                                                                        |

### Derived analytics — Per-90 (partial)

| Area                                                         | Notes                                                                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`../database-dorkinians/config/schema.js`**                | Added Player per-90 properties: `goalsPer90`, `assistsPer90`, `goalInvolvementsPer90`, `ftpPer90`, `cleanSheetsPer90`, `concededPer90`, `savesPer90`, `cardsPer90`, `momPer90`.             |
| **`../database-dorkinians/services/relationshipManager.js`** | `applyFoundationDerivedAggregates()` now writes per-90 aggregates using a **360-minute threshold** (`null` below threshold).                                                                |
| **APIs**                                                     | `player-data` / `player-data-filtered` now return per-90 values (thresholded); `top-players-stats` supports `goalsPer90`, `assistsPer90`, `goalInvolvementsPer90`, `ftpPer90`.              |
| **UI**                                                       | `PlayerStats` data table includes per-90 rows and shows `Min. 360 mins` when below threshold; `TeamStats` top-player selector includes per-90 leaderboards.                                 |
| **Tests**                                                    | Added integration coverage in `__tests__/integration/top-players-stats.integration.test.ts` for `goalsPer90`; existing foundation integration test remains green after aggregate extension. |

### Derived analytics — Per-90 (complete)

| Area                       | Notes                                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| **Player Stats table UX**  | Added tabs: \*\*Totals                                                                                                                                                                                | Per App | Per 90\*\* with per-90 minutes context and threshold message (`Min. 360 minutes required`) for ineligible rows. |
| **Player Stats key cards** | Added card toggle beneath Key Performance Stats to flip between totals and per-90 cards.                                                                                                              |
| **Comparison radar**       | Added **Per 90 Stats** radar category option with all per-90 metrics.                                                                                                                                 |
| **Team Top Players**       | Added additional per-90 leaderboard options and formatting (goals/assists/GI/FTP/clean sheets/conceded/saves/cards/MoM per 90).                                                                       |
| **Tests**                  | Added per-90 helper unit tests in `../database-dorkinians/services/matchDerivedFields.test.js`, integration checks for `goalsPer90` and `cleanSheetsPer90`, and a Playwright stats per-90 mode check. |

### Derived analytics — Form curves

| Area                                       | Notes                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data layer (`../database-dorkinians/`)** | Added EWMA helper functions (`computeEWMA`, `determineTrend`) and tests; `applyFoundationDerivedAggregates()` now writes `MatchDetail.ewmaReactive` / `ewmaBaseline` and Player form summary fields (`formCurrent`, `formBaseline`, `formTrend`, `formPeak`, `formPeakWeek`). |
| **Schema**                                 | Added `ewmaReactive`, `ewmaBaseline` to `MatchDetail` and form summary properties to `Player`.                                                                                                                                                                                |
| **Website API/UI**                         | Added `app/api/player-form/route.ts` and new Player Stats **Form** section (chart + summary cards) directly under Key Performance Stats; added key card indicator (`Form: value + trend arrow`); golden cross caption + tooltip on the form chart.                            |
| **Chatbot**                                | `FORM_CURRENT` for single-player and rankings (best/worst / poor / lowest form phrasing); formatting one decimal.                                                                                                                                                             |
| **Team Top Players**                       | Added `bestCurrentForm` stat option backed by `currentFormEwma`.                                                                                                                                                                                                              |
| **Tests**                                  | Added targeted E2E check for Form section (`3.21`) and integration coverage for top players `bestCurrentForm`.                                                                                                                                                                |

### Derived analytics — Streaks (Feature 5)

| Area                                       | Notes                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data layer (`../database-dorkinians/`)** | `services/streakDetection.js` — `detectStreaks`, appearance streak vs primary-team fixtures, season-best (latest season in data) + all-time bests; `applyFoundationDerivedAggregates()` writes all `current*` / `seasonBest*` / `allTimeBest*` Player fields after form EWMA. |
| **Schema**                                 | `TBL_Players.properties` extended per `NEW-FEATURES.md` Feature 5.                                                                                                                                                                                                            |
| **Tests (DB)**                             | `npm run test:streak-detection` — unit tests on streak helpers; `scripts/test-foundation-derived-integration.js` asserts streak keys on Player after aggregates.                                                                                                              |
| **Website API**                            | `player-data` / `player-data-filtered` RETURN + map streak fields from `p`; `GET /api/club-streaks-preview` — next fixture + squad streak highlights; `team-data-filtered` adds `streakLeaders` (single-XI) when `teamName !== "Whole Club"`.                                 |
| **UI**                                     | `PlayerStats` — **Streaks** section after Form (`#streaks-section`); homepage `StreaksAtRiskBanner`; Team Stats `#team-streak-leaders` (longest active streaks for selected XI).                                                                                              |
| **Chatbot**                                | Streak metrics in `chatbotMetrics` / entity extraction / `mapStatTypeToKey`; `playerQueryBuilder` + `rankingQueryHandler` Player-node streak queries; single-value + ranking answers in `chatbotService`; integer formatting in `formattingUtils`.                            |
| **Tests (site)**                           | Playwright `3.24` — streaks section visible; section id in desktop sweep list.                                                                                                                                                                                                |

### Records wall (Feature 6)

| Area                                       | Notes                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data layer (`../database-dorkinians/`)** | `config/schema.js` — `ClubRecord` node + constraint; `services/clubRecordsComputation.js` — individual + team records, 80% challenger flags (appearances, career goals, active scoring/appearance streaks); `relationshipManager.applyClubRecords()`; `seedingOrchestrator` runs it after `applyFoundationDerivedAggregates()`. |
| **Tests (DB)**                             | `npm run test:club-records` — unit tests for slugify / team streak helper.                                                                                                                                                                                                                                                      |
| **Website**                                | `GET /api/club-records`; `components/club-info/RecordsSection.tsx` (initially under awards, moved in Feature 12 to Club Information above Milestones).                                                                                                                                                                          |
| **Tests (site)**                           | Playwright `5.29`–`5.30` — Records section + optional holder → Player Stats navigation when data exists.                                                                                                                                                                                                                        |

### Graph insights (Feature 7)

| Area                                       | Notes                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data layer (`../database-dorkinians/`)** | `services/graphInsightsComputation.js` — partnership win rates (≥5 shared games), impact delta on `mostPlayedForTeam`; optional `gds.pageRank` + `gds.louvain` when `RETURN gds.version()` succeeds; `relationshipManager.applyGraphInsights()` after `applyClubRecords()`; `Player` schema fields per `NEW-FEATURES.md`. |
| **Tests (DB)**                             | `npm run test:graph-insights` — adjacency / top-partner sorting helpers.                                                                                                                                                                                                                                                  |
| **Website**                                | `player-data` + `player-data-filtered` return graph fields; Player Stats **Partnerships** + **Impact** after Streaks; data table rows (`PlayerGraph*` stats in `config.ts`); `GET /api/club-squad-backbone`; Club Stats **Squad backbone** (PageRank top 10, empty without GDS).                                          |
| **Tests (site)**                           | Playwright `3.25` — headings for Partnerships / Impact; section ids in desktop sweep lists.                                                                                                                                                                                                                               |
| **GDS**                                    | PageRank / Louvain / squad rank skipped when `gds.version()` fails (e.g. Free tier or plugin off); logs `ℹ️ GRAPH_INSIGHTS: GDS not available`.                                                                                                                                                                           |

**Deferred for later (owner):** **GDS is not set up yet** on your Neo4j Aura instance (Graph Analytics / Professional tier as per `NEW-FEATURES.md`). No action required for **7a/7b** (partnerships + impact). **Save for when you want 7c/7d:** enable GDS on Aura, then run a **full re-seed** so `squadInfluence`, `squadInfluenceRank`, `communityId`, and Club Stats **Squad backbone** populate.

### Season Wrapped (Feature 8)

| Area       | Notes                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Routes** | `app/wrapped/[playerSlug]/page.tsx` — Framer Motion slides, dots, share via `html-to-image`, WhatsApp copy block.                                                                    |
| **API**    | `GET /api/wrapped/[playerSlug]` — optional `?season=`; slug = base64url of `playerName` (`lib/wrapped/slug.ts`).                                                                     |
| **OG**     | `GET /api/wrapped/[playerSlug]/og/[slideNumber]` — `next/og` ImageResponse (slides 1–9).                                                                                             |
| **Data**   | `lib/wrapped/computeWrappedData.ts` — season-scoped stats, club percentiles, best month, peak match, streaks (season-best fields on `Player`), partner fields, `classifyPlayerType`. |
| **Home**   | `SeasonWrappedBanner` after streaks banner; hide with `NEXT_PUBLIC_SEASON_WRAPPED_ACTIVE=false`.                                                                                     |
| **Tests**  | Jest: `__tests__/unit/wrapped/*`, `wrapped-api.integration.test.ts`; Playwright: `__tests__/e2e/10-wrapped/wrapped.spec.ts`.                                                         |

**Follow-up (spec supersession, not implemented):** Remove homepage Season Wrapped banner; primary entry becomes **Player Profile** (and direct `/wrapped/...`). See **`NEW-FEATURES.md` Feature 8** (homepage integration) and **Feature 20** item 1.

### Achievement badges (Feature 9)

| Area                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data layer (`../database-dorkinians/`)** | `config/schema.js` — `PlayerBadge`, `HAS_BADGE`, extra `Player` fields; `services/badgeDefinitions.js`, `badgeComputation.js`, `playerBadgesComputation.js`; `relationshipManager.applyPlayerBadges()`; `seedingOrchestrator` runs it after `applyGraphInsights()`.                                                                                                                                        |
| **Tests (DB)**                             | `npm run test:badges` — `services/badgeComputation.test.js`.                                                                                                                                                                                                                                                                                                                                               |
| **Website**                                | `GET /api/player-badges?playerName=` — earned badges + progress; `GET /api/club-badge-leaderboard` — most badges / diamond / gold; `lib/badges/catalog.ts` (keep in sync with DB catalogue), `evaluate.ts`, `neo4jProps.ts`; `PlayerStats` — badge bar (`data-testid="player-badge-bar"`); milestone grid now lives on Player Profile (Feature 10); `BadgeLeaderboardSection` on Club Captains and Awards. |
| **Tests (site)**                           | Jest: `__tests__/unit/badges/parseBadgeId.test.ts`; Playwright: `5.31` (club badge leaderboard), `3.26` (player milestones, skips until seed).                                                                                                                                                                                                                                                             |

### Player Profile + Captaincies link (Feature 10)

| Area                    | Notes                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Routes / UI**         | Added `app/profile/[playerSlug]/page.tsx` + `components/profile/PlayerProfileView.tsx`; profile shows player header + badge bar, **Season Wrapped** section first, **Milestone badges** section second, then headline stat cards (standalone route, no main app sidebar). |
| **Linking / slug**      | Added `lib/profile/slug.ts`; Player Stats Captaincies/Awards section now renders underlined link `data-testid="milestone-badges-profile-link"` for **Milestone badges earned** to the current player profile.                     |
| **Player Stats change** | Removed in-place milestone grid from Player Stats achievements section (moved to Player Profile per plan).                                                                                                                        |
| **Tests**               | Jest unit: `__tests__/unit/profile/slug.test.ts`; Playwright `3.26` updated to verify link navigation + profile section order.                                                                                                    |

**Follow-up (spec change, not implemented):** Section order **Headline Stats → Milestone Badges → Season Wrapped** (title case headings); Season Wrapped block centred with logo + yellow emphasis; **Back to home** at bottom (dialog-style); profile must use **same app chrome as Settings** (sidebar/header). See **`NEW-FEATURES.md` Feature 10**.

### Club Captains and Awards (Feature 11)

| Area                      | Notes                                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merged page**           | Added `components/club-info/ClubCaptainsAndAwards.tsx` and switched Club Info subpage `club-awards` to render a single merged screen titled **Club Captains and Awards**.                                                     |
| **Content preservation**  | `ClubCaptainsSection` and `ClubAwardsSection` support `embedded` mode and are rendered together on the merged page, preserving captains table/history popup + awards/badge leaderboard content (Records moved in Feature 12). |
| **Navigation updates**    | Removed separate Club Captains entry from sidebar + settings navigation trees (`app/settings` and in-app `components/pages/Settings`) and renamed the remaining entry to **Club Captains and Awards**.                        |
| **Compatibility mapping** | Added canonical mapping in `lib/stores/navigation.ts` and E2E helper aliasing so persisted/legacy `club-captains` state resolves to merged `club-awards` subpage.                                                             |
| **Tests**                 | Updated Club Info E2E expectations/helpers to target merged heading and new subpage indexing; no new route-level redirects needed because Club Info subpages are state-driven, not separate URLs.                             |

### Records on Club Information (Feature 12)

| Area                    | Notes                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **UI placement**        | Moved `RecordsSection` from the awards section component (renamed to `components/club-info/ClubAwardsSection.tsx`) into `components/club-info/ClubInformation.tsx`, inserted directly above the Milestones block.                                                                                                        |
| **Merged page cleanup** | Club Captains and Awards no longer renders the Records block; awards + badge leaderboard remain in place.                                                                                                                                                                                                                |
| **Tests**               | Updated Club Info E2E: `5.29` now verifies Records on Club Information and checks Records appears above Milestones; `5.31` asserts Records is absent from Club Captains and Awards. Also tightened Club Captains heading selectors (`^Club Captains$`) to avoid strict-mode ambiguity after merged-page heading changes. |
| **Verification run**    | Focused Chromium Playwright run for `5.16`, `5.20`, `5.21`, `5.29`, `5.30`, `5.31`: 4 passed, 2 skipped (data-dependent skips retained in test logic).                                                                                                                                                                   |

### Home header profile icon (Feature 13)

| Area                 | Notes                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home header CTA**  | Added profile icon button left of settings on **Home** when a player is selected; hidden when no selected player. Implemented on mobile header and desktop sidebar header (`header-profile`, `nav-sidebar-profile`). |
| **Navigation**       | Profile icon click navigates to current player route via `getPlayerProfileHref(...)` in `lib/profile/slug.ts`.                                                                                                   |
| **Tests**            | Added Playwright coverage in Home suite: hidden state without selection (`2.0`) and click-through navigation with selection (`2.3a`).                                                                            |
| **Verification run** | Focused Playwright run (`__tests__/e2e/02-home/home.spec.ts`, grep `2.0` or `2.3a`) passed on Chromium + Mobile Chrome (4 passed).                                                                                 |

**Follow-up (spec change, not implemented):** Show profile icon on **all** main app pages when a player is selected (not only `currentMainPage === "home"`); slightly reduce spacing between header/sidebar header icons. See **`NEW-FEATURES.md` Feature 13** amendment.

### Most Connected (Feature 14)

| Area                 | Notes                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **API/data shaping** | Added `lib/stats/mostConnected.ts` helper to normalize/sort/limit top connections from `partnershipsTopJson` with deterministic tie-breaks; `app/api/player-data/route.ts` now returns `playerData.mostConnected` via `mapPlayerGraphInsightFieldsFromRecord(...)`.                                                                                    |
| **State/UI**         | Extended `PlayerData` in `lib/stores/navigation.ts` with `mostConnected`; added `#most-connected-section` to `components/stats/PlayerStats.tsx` showing top 5 linked players with shared-game counts and player-link navigation behavior.                                                                                                              |
| **Tests**            | Unit: `__tests__/unit/stats/mostConnected.test.ts` (sort/limit + malformed input). Integration: `__tests__/integration/player-data-most-connected.integration.test.ts` (API returns <=5 with counts). E2E: `__tests__/e2e/03-stats/stats.spec.ts` added section visibility/data fallback check (`3.28`) and included section id in desktop sweep list. |

### TOTW previous 10 weeks strip (Feature 15)

| Area      | Notes                                                                                                                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API**   | Extended `app/api/totw/weeks/route.ts` to include `totwScore` per returned week so UI can render score boxes without additional per-week API calls.                                                                                             |
| **UI**    | Added previous-weeks strip under TOTW pitch in `components/totw/TeamOfTheWeek.tsx` (`#totw-previous-weeks-strip`, `totw-previous-week-box`), showing up to 10 prior weeks (week label + score + date) and clicking a box updates selected week. |
| **Tests** | Added Playwright test `4.14` in `__tests__/e2e/04-totw/totw.spec.ts` to verify strip visibility, box count (<=10), and click-driven week change in selector.                                                                                    |

### TOTW Share (Feature 16)

| Area                        | Notes                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **UI share control**        | Added bottom-page share CTA in `components/totw/TeamOfTheWeek.tsx` (`totw-share-button`) that captures the current TOTW graphic region (`totw-share-capture`) into PNG.              |
| **Share/fallback behavior** | Uses `html-to-image` `toBlob(...)`; attempts native `navigator.share` with file when supported, otherwise falls back to downloaded PNG file (`dorkinians-totw-<season>-<mode>.png`). |
| **Tests**                   | Added Playwright test `4.15` in `__tests__/e2e/04-totw/totw.spec.ts` to verify button presence and safe trigger behavior (no crash/regression after click).                          |

### Dev branding + CI gate (Feature 17)

| Area                    | Notes                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Dev icon wiring**     | `app/manifest.ts` and `app/layout.tsx` now switch 192x192 PWA/iOS icon to `public/icons/dev-icon-192x192.png` when `isDevelopBranchDeploy()` is true (`BRANCH=develop` or `NEXT_PUBLIC_SITE_VARIANT=develop`).                                                           |
| **Homepage Dev label**  | Home header now shows a `Dev` badge on develop variants in both mobile top bar and desktop sidebar logo area (`home-dev-badge`, `home-dev-badge-sidebar`).                                                                                                               |
| **CI workflow updates** | `.github/workflows/full-test-suite-and-email.yml` now runs E2E automatically on `push` to `develop`; for PRs into `main` it runs `test:all` and enforces a numeric pass-rate gate via `scripts/ci-check-pass-rate.cjs` (`>= 90%`, formula `passed / (passed + failed)`). |
| **Tests**               | Unit: existing `__tests__/unit/is-develop-branch-deploy.test.ts` validated branch detection; Playwright: added `2.11` in Home suite to smoke-test Dev badge rendering under develop variant env.                                                                         |

### VEO LINK on fixtures (Feature 18)

| Area                    | Notes                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Fixture API mapping** | `app/api/league-fixtures/route.ts` now returns `f.veoLink as veoLink` and normalizes blank values to `null`, so Show Results consumers can consistently read the property when present.                                                    |
| **Secondary fixtures**  | `app/api/team-recent-fixtures/route.ts` also surfaces `veoLink` with the same null-safe normalization, keeping fixture API payloads aligned where recent fixture cards consume fixture objects.                                            |
| **Types**               | Shared `Fixture` type in `types/index.ts` now includes optional `veoLink`; League Results modal fixture interface was aligned to accept the field for downstream Feature 19 UI work.                                                       |
| **DB ingestion path**   | In `database-dorkinians`, `config/schema.js` now maps fixture CSV column `VEO LINK` to `Fixture.veoLink`; added DB integration script `scripts/test-fixture-veo-link-integration.js` and npm script `test:fixture-veo-link-integration`.   |
| **Tests**               | Website: `__tests__/integration/fixtures-veo-link.integration.test.ts` validates `league-fixtures` and `team-recent-fixtures`; DB: `npm run test:fixture-veo-link-integration` passed and confirmed seeded fixture rows persist `veoLink`. |

### League Latest Result + modal parity (Feature 19)

| Area                    | Notes                                                                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Combined latest API** | Added `app/api/league-latest-result/route.ts` to return the latest fixture for a team/season with goalscorers, MoM, `veoLink`, plus full lineup rows including `matchRating`/starter fields.                                                                                     |
| **Shared fixture UI**   | Added `components/club-info/FixtureExpandedDetails.tsx` (formation rows, clickable player dots with rating breakdown tooltip, optional **Watch on Veo** link, and **Show full player details** table toggle) for reuse across League Information and Show Results modal.         |
| **League Information**  | `components/club-info/LeagueInformation.tsx` now fetches latest result payload per team and renders a **Latest Result** block below each league table, including fixture summary card + shared formation/details widget.                                                         |
| **Show Results parity** | `components/club-info/LeagueResultsModal.tsx` expanded fixture cards now use the shared details component, giving parity for formation display, Veo link visibility, and explicit full-details toggling behavior.                                                                |
| **Tests**               | Added integration `__tests__/integration/league-latest-result.integration.test.ts` (fixture + lineup + `veoLink` shape) and Playwright club-info coverage `5.14a` for Latest Result panel behavior (formation/full details and optional Veo link attribute checks when present). |

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

Spec source: **`NEW-FEATURES.md` Phase 6 (Features 10-19, plus Feature 20 UX polish)** (migrated from `New-Features-2.md`). Implement in order there; each item below lists **required tests** to add or extend when building.

**CI / merge policy (Feature 17):** Gate merges to **`main`** on **≥ 90% automated test pass rate** in CI (`passed / (passed + failed)`, excluding skipped — align with workflow definition in repo). Dev pipeline: run **E2E on push to Dev** as specified in Phase 6.

| Feature                                      | Summary                                                                                                                                                 | Tests to add or update                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **10** — Player Profile + Captaincies link   | ✅ Website first cut done: profile route + section order + stats link migration                                                                         | **Superseded UX backlog:** see **Phase 6 UX polish** rows 2 and 4; add/confirm integration coverage if dedicated profile API is introduced later   |
| **11** — Club Captains and Awards            | ✅ Website first cut done: merged page + single nav entry + legacy subpage-state mapping                                                                | Follow-up: run full Club Info Playwright flow against seeded env and decide if route-level redirects are required in any future URL-based routing    |
| **12** — Records on Club Information         | ✅ Website first cut done: Records moved to Club Information above Milestones; removed from merged captains/awards page                                 | Follow-up: run full Club Info Playwright suite on seeded env to convert remaining data-dependent skips into hard assertions where possible           |
| **13** — Home header profile icon            | ✅ Website first cut done: profile icon shown on Home when player selected, left of settings, routes to selected player profile                         | **Superseded UX backlog:** see **Phase 6 UX polish** row 7; optional polish for icon treatment consistency between mobile header and desktop sidebar   |
| **14** — Most Connected                      | ✅ Website first cut done: Player Stats now has `#most-connected-section` top-5 list from graph insight partnership data                                | Follow-up: run full seeded Stats Playwright suite and harden `3.28` into strict name/count assertions for deterministic fixture data                 |
| **15** — TOTW previous 10 weeks              | ✅ Website first cut done: previous-week score strip under TOTW pitch with week-label boxes and click navigation to that week                           | Follow-up: add seeded-env assertion for exact 10 boxes + exact score values for deterministic regression checks                                      |
| **16** — TOTW Share                          | ✅ Website first cut done: TOTW share button added with native share (when supported) and download fallback PNG                                         | Follow-up: optional utility extraction + unit tests for TOTW share filename/metadata constants if/when shared across views                           |
| **17** — Dev branding + CI                   | ✅ Website/devops first cut done: dev icon + homepage Dev badge + develop push E2E + main PR pass-rate gate script/workflow                             | Follow-up: optionally tighten gate to parse test-level pass metrics (not suite-level summary) once unified machine-readable reports are standardized |
| **18** — VEO LINK on fixtures                | ✅ Website + DB first cut done: schema/import path persists `Fixture.veoLink`, and website fixture APIs return normalized `veoLink`                     | Follow-up: run full production seeding job and spot-check real fixture pages with populated Veo links across multiple teams/seasons                  |
| **19** — League Latest Result + modal parity | ✅ Website first cut done: per-team Latest Result cards + shared formation/rating details + modal parity with full-details toggle and optional Veo link | Follow-up: add deterministic seeded assertions for tooltip line content and exact formation/player ordering across desktop/mobile snapshots          |

### Phase 6 UX polish (not started)

Spec source: **`NEW-FEATURES.md`** — amended Feature 8 / 10 / 13 plus **Feature 20: Navigation and Player Stats polish**. None of the rows below are implemented yet; use this checklist when building.

| # | Item | Status | Tests to add or update |
|---|------|--------|-------------------------|
| 1 | Remove **Season Wrapped** from **Homepage** (`SeasonWrappedBanner` / `app/page.tsx`); discovery via **Player Profile** and `/wrapped/...` only | Not started | Playwright: home has no wrapped banner (when feature flag would otherwise show it); existing wrapped E2E still passes |
| 2 | **Player Profile** uses same **app chrome** as Settings/main SPA (sidebar + header/footer), not a bare full-page view | Not started | E2E: open profile from stats link → sidebar/header visible; navigation matches other pages |
| 3 | **Settings** → **Home** in “Available Screens” navigates like other destinations (e.g. `window.location.href = "/"` / `router.push` + store sync if on `/settings` route) | Not started | E2E: from `/settings`, click Home → lands on main app home |
| 4 | **Player Profile** content/layout: order **Headline Stats → Milestone Badges → Season Wrapped**; title-case headings; Season Wrapped centred + club logo + yellow-forward styling; **Back to home** at bottom, dialog-style back button; remove top-right back link | Not started | Update Playwright `3.26` for new order, styling hooks, bottom back control |
| 5 | **Player Stats** Form chart: **Y-axis** shows rating scale values (margins / `YAxis` width in `FormComposedChart` or parent) | Not started | Playwright visual or assertion on axis ticks in `3.21` / Form section |
| 6 | **Player Stats** data table: **Totals \| Per App \| Per 90** toggle group **right-aligned** in the control row | Not started | Playwright: layout/selector check in data table mode |
| 7 | **Header** (and desktop sidebar header if mirrored): profile icon when player selected on **all** main pages; slightly **tighter** icon spacing | Not started | Extend Home suite or Stats: select player on home → navigate to Stats → icon visible; spacing regression snapshot optional |

---

## Repo map (quick reference)

| Repo                                         | Role                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `database-dorkinians` (sibling of this repo) | Google Sheets → CSV → Neo4j; schema; `matchDerivedFields`; seeding orchestration; `npm run test:match-derived` |
| `V3-Dorkinians-Website` (this repo)          | Next.js app, `app/api/*`, stats UI, `NEW-FEATURES.md`, Jest/Playwright                                         |

---

## Changing derived match rating scores

Edit **`../database-dorkinians/services/matchDerivedFields.js`** → `calculateMatchRating`. Run **`npm run test:match-derived`** in `database-dorkinians`, then **re-seed** so stored `matchRating` values refresh. UI badge colours (e.g. All Games modal) are separate display thresholds in this website.
