# Dorkinians FC – Features master status (canonical)

**Purpose:** Single source of truth for what shipped, what remains, how major areas work, and setup outside the codebase. Use this file (not legacy split docs) when briefing an AI or resuming implementation.

**Last updated:** 2026-04-02 (consolidated from former `NEW-FEATURES.md`, `IMPLEMENTATION-STATUS.md`, `FEATURE-IMPLEMENTATION-REPORT.md`).

**Repos:**

| Repo | Role |
| ---- | ---- |
| `database-dorkinians` (sibling of website repo) | Google Sheets → CSV → Neo4j; schema; derived fields; seeding orchestration |
| `V3-Dorkinians-Website` (this repo) | Next.js App Router, `app/api/*`, stats UI, Jest + Playwright |

---

## 1. Executive feature summary

The site includes a **foundation** layer (starters, `playerOrder`, `matchRating`, `inferredFormation` on fixtures, aggregates on `Player`), **per-90** stats (360-minute threshold), **Form** (EWMA on `MatchDetail` + summary on `Player`, chart + chatbot `FORM_CURRENT`), **Streaks** (DB-backed fields + **live filter-scoped** `POST /api/player-streaks`, home banner, team streak leaders), **Club records** (`ClubRecord`, `/api/club-records`, Records on Club Information), **graph insights** (partnerships ≥5 games, impact delta; optional GDS PageRank/Louvain for Squad Backbone), **Season Wrapped** (`/wrapped/[playerSlug]`, APIs, OG, share modal / autoplay per Phase 9), **achievement badges** (DB + APIs + catalogue + profile grid + club leaderboard), **Player Profile** (shell parity, Season Wrapped → Headline Stats → Achievement Badges), merged **Club Captains and Awards**, **Veo** on fixtures and latest-result UI, **TOTW** previous-week strip + share, **dev branding + CI** (develop E2E on push, main PR pass-rate gate ≥90%). **Most Connected** was **retired** (2026-03-31); use Partnerships for co-appearance context.

**Naming guardrail (persistent):** Do not name new implementation artifacts using rollout labels like `Phase 1` / `phase2`. Use stable feature names (`foundation`, `per90`, `form`, `streaks`, `records`, `wrapped`, `badges`, etc.) in filenames, functions, tests, and logs. Original “Phase N” wording in historical notes below is documentation-only.

---

## 2. Implementation matrix (feature-level)

Status values: **Shipped** | **Partial** | **Deferred** | **Retired** | **Verify**

| ID | Feature | Status | Notes / primary locations |
| -- | ------- | ------ | ------------------------- |
| **1** | Inferred starter + formation | **Shipped** | DB: `matchDerivedFields.js`, `dataProcessor.js`, `relationshipManager.applyFoundationDerivedAggregates()`, schema. Site: APIs (`player-data`, `fixture-lineup`, etc.), Player/Team Stats UI, Starting impact. Tests: `matchDerivedFields` (DB + site), foundation integration, Playwright stats. |
| **4** | Automated match ratings | **Shipped** | Same foundation pipeline; `matchRating` on `MatchDetail`; aggregates on `Player`. UI: All Games badges, TOTW modal, etc. Change formula: edit DB `calculateMatchRating` → `npm run test:match-derived` → **full re-seed**. |
| **2** | Per-90 normalised stats | **Shipped** | DB: per-90 props on `Player`, 360-min threshold. Site: table tabs Totals / Per App / Per 90, key card toggle, comparison radar “Per 90”, Team Top Players options. |
| **3** | EWMA form curves | **Shipped** | DB: `ewmaReactive` / `ewmaBaseline` on `MatchDetail`, form summary on `Player`. Site: `app/api/player-form/route.ts`, Form section, Team `bestCurrentForm`. Chatbot: `FORM_CURRENT` + rankings. |
| **5** | Streak detection | **Shipped** | DB: `streakDetection.js`, Player streak fields. Site: `POST /api/player-streaks`, `team-data-filtered` `streakLeaders`, Player Stats `#streaks-section`, Team streak leaders. Tests: `test:streak-detection`, Playwright `3.24`. |
| **6** | Records wall | **Shipped** | DB: `ClubRecord`, `clubRecordsComputation.js`, orchestrator after aggregates. Site: `GET /api/club-records`, `RecordsSection` on **Club Information** (above Milestones; Feature 12). Playwright `5.29`–`5.30`. |
| **7** | Graph insights | **Partial** | **7a/7b Shipped** (partnerships, impact; filter-scoped APIs + copy). **7c/7d Deferred** until Aura **GDS** enabled: PageRank / Louvain / Squad Backbone population. Code skips GDS when `gds.version()` fails. Guide: `docs/Neo4j_Aura_GDS_Setup_Guide.md`. |
| **8** | Season Wrapped | **Shipped** | `app/wrapped/[playerSlug]/page.tsx`, `GET /api/wrapped/[playerSlug]`, OG routes, `lib/wrapped/*`. Homepage banner uses `featureFlags.seasonWrapped` from `config/config.ts` (branch presets). **Phase 9** (2026-04-01): autoplay, share modal, swipe, data/copy updates, tests. |
| **9** | Achievement badges | **Shipped** | DB: `badgeDefinitions.js`, `badgeComputation.js`, `playerBadgesComputation.js`, `applyPlayerBadges()`. Site: `GET /api/player-badges`, `GET /api/club-badge-leaderboard`, `lib/badges/catalog.ts` (**keep in sync with DB**), Player Stats badge bar, profile milestone grid. **2026-04-01 polish:** “Achievement Badges” naming, categories, Keeping Achievements, mobile 3-across, tier ordering, `config/config.ts` card-fine constants. |
| **10** | Player Profile + captaincies link | **Shipped** | `app/profile/[playerSlug]/page.tsx`, `PlayerProfileView.tsx`, `lib/profile/slug.ts`, link from Player Stats (`data-testid="milestone-badges-profile-link"`). Order: Season Wrapped → Headline Stats → Achievement Badges. |
| **11** | Club Captains and Awards merge | **Shipped** | `ClubCaptainsAndAwards.tsx`, nav + `navigation.ts` legacy mapping to `club-awards` subpage state. |
| **12** | Records on Club Information | **Shipped** | `ClubInformation.tsx` placement; Records absent from merged captains/awards page. |
| **13** | Header profile icon | **Shipped** (verify UX) | Home-first cut; **Phase 7 A** marked complete for broader nav/profile parity—confirm “all main pages + spacing” vs spec in live build. Tests: Home `2.0`, `2.3a`. |
| **14** | Most Connected | **Retired** | Removed from UI/API/tests; Partnerships only. |
| **15** | TOTW previous 10 weeks | **Shipped** | `app/api/totw/weeks/route.ts` `totwScore`; UI `#totw-previous-weeks-strip`. Playwright `4.14`. Optional: stronger seeded assertions. |
| **16** | TOTW share | **Shipped** | `html-to-image`, `totw-share-button`. Playwright `4.15`. |
| **17** | Dev branding + CI | **Shipped** | `manifest.ts`, `layout.tsx`, dev icon, `home-dev-badge`; workflow `.github/workflows/full-test-suite-and-email.yml`, `scripts/ci-check-pass-rate.cjs` (≥90% `passed/(passed+failed)` on PRs to `main`). |
| **18** | VEO LINK on fixtures | **Shipped** | DB: schema `Fixture.veoLink`, `test:fixture-veo-link-integration`. Site: `league-fixtures`, `team-recent-fixtures`, types. |
| **19** | League Latest Result + modal parity | **Shipped** | `GET /api/league-latest-result`, `FixtureExpandedDetails.tsx`, `LeagueInformation.tsx`, `LeagueResultsModal.tsx`. Integration + Playwright `5.14a`. |
| **20** | Navigation + Player Stats polish | **Shipped** | Items 1–7 addressed via Phase 6/7 rows (Settings→Home, Form axis, table toggle alignment, profile/wrapped items). |

### UX rounds (historical checklists – all rows shipped per last status)

| Round | Status | Summary |
| ----- | ------ | ------- |
| **Phase 6 UX polish** | **Shipped** | Wrapped homepage removal, profile shell, Settings→Home, profile section order, Form Y-axis, table toggle right-align, profile icon follow-ups rolled to Phase 7. |
| **Phase 7 (A–J)** | **Shipped** | Nav parity, profile/tooltips, section reorder, filter-scoped graph copy/APIs, formations/Sankey/squad backbone titles, club/league/captains/TOTW polish. |
| **Phase 8** | **Shipped** | Profile ring, sidebar chrome, achievements tooltips, Form/Streaks/Impact copy, recordings count, TOTW skeleton, etc. |
| **Phase 9** | **Shipped** | Wrapped autoplay/timer, share modal, swipe, expanded wrapped data/player types, profile milestone tooltip behaviour, test updates. |

---

## 3. Operational setup (outside codebase)

| Item | Action |
| ---- | ------ |
| **Neo4j Aura** | App and seeding target the configured Aura instance (URI, auth via env—do not commit secrets). |
| **Full re-seed** | After **any** DB schema or derived-field logic change (e.g. `matchDerivedFields.js`, aggregates, records, badges, graph insights), run a **full seed** on the target graph before expecting UI/APIs to match. |
| **GDS / Graph Analytics** | Optional for **7c/7d**: enable on Aura **Professional** (not Free). Then re-seed so `squadInfluence`, `squadInfluenceRank`, `communityId` and Club Stats **Squad Backbone** populate. Procedure: `docs/Neo4j_Aura_GDS_Setup_Guide.md`. |
| **Google Sheets** | Source data for `database-dorkinians`; **VEO LINK** column on fixtures for Feature 18. |
| **Netlify / deploy** | Website deploy when only Next.js changes; seed when graph data must change. |
| **CI** | `develop`: E2E on push. PRs to `main`: `test:all` + pass-rate gate script. GitHub Actions secrets for email workflows per `README.md`. |
| **Feature flags** | `config/config.ts`: `featureFlagPresets.develop` vs `featureFlagPresets.production`; resolver uses `NODE_ENV` (test → all on, development → develop preset) and `isDevelopBranchDeploy()` (`BRANCH` / `NEXT_PUBLIC_SITE_VARIANT` from Netlify). No per-feature env vars. **E2E / Playwright:** if the production preset turns features off on the primary domain, point `WEBSITE_URL` (GitHub secret) at the **develop** branch Netlify URL (e.g. `https://develop--<site>.netlify.app`) so remote suites exercise the full UI. |

---

## 4. Player Stats – section guide (stable IDs)

Order may shift slightly with nav menu; use live `StatsNavigationMenu` + tests as truth.

| Section | ID / anchor | Data / API notes |
| ------- | ----------- | ---------------- |
| Form | `#form-section` | `player-form` API; `ewmaReactive` / `ewmaBaseline` on `MatchDetail`; summary on `Player`. |
| Streaks | `#streaks-section` | Live: `POST /api/player-streaks`; fallback seeded `p.*` streak fields. Appearance streak uses primary-team fixture cadence. |
| Partnerships | `#partnerships-section` | ≥5 shared games; signed % delta vs baseline win rate; filter-scoped with `player-data-filtered`. |
| Impact | `#impact-section` | Win rate with vs without player on most-played XI; Phase 8 copy style. |
| Squad Backbone | Club Stats (not Player Stats) | PageRank-style list only when GDS available; empty state explains missing GDS. |

---

## 5. Chatbot – supported vs not

**Well supported:** Form (`FORM_CURRENT` + rankings), streaks (many phrasings), core stats including **starts** (`STARTS` / “how many times have I started?”).

**Not documented as complete:** Natural-language **partnerships / impact / “best partner”** style questions; **badges** in chatbot (optional future). Treat graph insight **Q&A** as UI-first unless extended in `chatbotService` + entity extraction.

---

## 6. Quick reference – where logic lives

| Area | Primary paths |
| ---- | ------------- |
| Match rating / formation / per-90 / EWMA (DB) | `database-dorkinians/services/matchDerivedFields.js`, `relationshipManager.js` |
| Streaks (DB) | `database-dorkinians/services/streakDetection.js` |
| Streaks (live site) | `app/api/player-streaks/route.ts`, `lib/stats/playerStreaksComputation.ts` |
| Graph insights (DB) | `database-dorkinians/services/graphInsightsComputation.js` |
| Badges (DB) | `badgeDefinitions.js`, `badgeComputation.js`, `playerBadgesComputation.js` |
| Badges (site catalogue) | `lib/badges/catalog.ts` (**sync with DB**) |
| Player Stats UI | `components/stats/PlayerStats.tsx` |
| Form chart | `components/stats/player-stats/FormComposedChart.tsx`, related components |
| Chatbot | `lib/config/chatbotMetrics.ts`, `lib/services/chatbotService.ts` |
| Wrapped | `app/wrapped/...`, `lib/wrapped/*`, `app/api/wrapped/...` |
| Club milestones API | `app/api/milestones/route.ts` (thresholds + Cypher in route; `apiCache` TTL) |

**Adding a club milestone:** extend aggregations in `milestones/route.ts`, threshold bands, UI labels; add tests if JSON contract changes.

**Adding a badge:** implement computation in DB → mirror `lib/badges/catalog.ts` → re-seed → verify APIs → UI.

---

## 7. Implementation order (rollout reference)

| Step | Features | Repo | Depends on |
| ---- | -------- | ---- | ---------- |
| 1 | 1, 4 | database-dorkinians | — |
| 2 | 2, 3, 5 | database-dorkinians | 1 (ratings → EWMA; starters → streaks) |
| 3 | 6, 7 | Both | 2 (streaks → records) |
| 4 | 8 | Website | 1–3 |
| 5 | 9 | Both | 1–3 |
| 6 | 10–20 | Both (18 + DB) | 5 for 10; 1 + 18 for 19 |
| 7+ | UX rounds 7–9 | Website (+ optional DB for badges) | After 6 |

Within each step, implement in listed order; run the test suite after material changes.

---

## 8. AI handoff – next focus (from last integration milestone)

**Current theme:** Post–Phase 9 polish verification.

1. Verify Wrapped **pause/play/restart** and **share** text behaviour end-to-end.
2. Validate **achievement** section renames, categories, order on profile (desktop + mobile).
3. Confirm **Club Information** headings and **record display rounding** (e.g. highest single-match FTP, scoreline) on mobile and desktop.

**Suggested prompt pattern:**

> Continue from **`FEATURES-MASTER-STATUS.md`** → **§8 AI handoff**. Implement [item]. Constraints: do not edit `.env`, do not push git. Tests: [list suites].

**When starting new work:** add a row to **§2 matrix** (or a new subsection) and update **Last updated** + **§8** so scope stays unambiguous.

---

## 9. Tests – recurring commands

| Scope | Command / location |
| ----- | ------------------ |
| DB match derived | `database-dorkinians`: `npm run test:match-derived` |
| DB foundation integration | `npm run test:foundation-integration` |
| DB streaks | `npm run test:streak-detection` |
| DB club records | `npm run test:club-records` |
| DB graph insights helpers | `npm run test:graph-insights` |
| DB badges | `npm run test:badges` |
| DB Veo link | `npm run test:fixture-veo-link-integration` |
| Website | `npm run test`, `npm run test:all`, Playwright suites under `__tests__/e2e/` |

---

## 10. Migration notes (from legacy docs)

- **Single file:** This document replaces `NEW-FEATURES.md`, `IMPLEMENTATION-STATUS.md`, and `FEATURE-IMPLEMENTATION-REPORT.md`. All cross-links in-repo should point here.
- **Conflicts resolved:** Where `NEW-FEATURES.md` said “Phase 7 in progress” but `IMPLEMENTATION-STATUS.md` marked A–J shipped, **status file wins** → all Phase 7 rows treated as **Shipped**.
- **Feature 13:** Legacy spec listed “icon on all pages” as incomplete; implementation status rolled that into **Phase 7 A** (✅)—keep **Verify** until product confirms.
- **Feature 8 homepage:** Follow-up about removing homepage banner is **done** (Phase 6 item 1); entry via profile + `/wrapped/...`.
- **Deep spec detail:** The old plan file contained full code snippets, schema blocks, and exhaustive test lists for each feature. For that level of detail, use **git history** of removed files or reconstruct from `database-dorkinians` + website source; this master file is optimized for **status + handoff + ops**.

---

*End of canonical features document.*
