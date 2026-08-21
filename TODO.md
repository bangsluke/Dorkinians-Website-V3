# V3 Dorkinians Website — TODO

**Who this is for:** You, working through remaining features without assuming prior knowledge of this codebase.

**Scope:** Only work described in [`docs/to-do-docs/`](docs/to-do-docs/). Do not invent tasks from other docs.

**Source docs (read these when a wave says “open …”):**

| Doc | Path |
| --- | ---- |
| Features master status | [docs/to-do-docs/FEATURES-MASTER-STATUS.md](docs/to-do-docs/FEATURES-MASTER-STATUS.md) |
| Player profile milestones | [docs/to-do-docs/PLAYER-PROFILE-MILESTONES.md](docs/to-do-docs/PLAYER-PROFILE-MILESTONES.md) |
| Streaks QA checklist | [docs/to-do-docs/STREAKS_TESTING.md](docs/to-do-docs/STREAKS_TESTING.md) |
| Architecture action plan | [docs/to-do-docs/ARCHITECTURAL_REVIEW_ACTION_PLAN.md](docs/to-do-docs/ARCHITECTURAL_REVIEW_ACTION_PLAN.md) |

---

## 0. How this project is organised (read once)

There are **two sibling repos** that work together:

| Folder (typical) | What it is | What you use it for |
| ---------------- | ---------- | ------------------- |
| `V3-Dorkinians-Website` (this repo) | Next.js website + APIs + UI | Run the site, change UI/API/tests |
| `database-dorkinians` (sibling folder) | Google Sheets → CSV → Neo4j seeder | Change derived stats, badges, graph algorithms, then **re-seed** the database |

**Data flow (simplified):**

1. Match stats live in Google Sheets.  
2. `database-dorkinians` reads them, writes to **Neo4j Aura**, and computes derived fields (ratings, streaks, badges, etc.).  
3. This website reads Neo4j via `app/api/*` and shows Stats / Profile / Wrapped / Club Info / Chatbot.

**Important rules while working:**

- Do **not** commit secrets or edit `.env` files in git. Put credentials only in local env / Netlify UI.  
- After **any** change to badge definitions, graph algorithms, or derived fields in `database-dorkinians`, you must run a **full re-seed** against the same Aura DB the site uses, or the UI will show old/empty data.  
- Prefer updating checkboxes in this file and the source docs as you finish each item.

### Feature flags (production vs local)

Flags live in `config/config.ts` (`featureFlagPresets.develop` vs `featureFlagPresets.production`). There are **no** per-feature env vars.

| Environment | What is on |
| ----------- | ---------- |
| Local `npm run dev`, Jest, Netlify deploy-preview, Netlify **`develop`** branch | **All** flags |
| Production **main** / primary domain | Profile, Wrapped, Achievement Badges, and Wrapped load opts. **Stats / Club / League extras are off** (list in Wave 5) |

Do Waves 0–3 on **local or develop**. Checking those extras on the live main URL will look like missing features. Wave 5 turns the rest on for production, then **deletes** leftover flag plumbing.

### Run the website locally (typical)

1. Open a terminal in `V3-Dorkinians-Website`.  
2. Install once if needed: `npm install`.  
3. Ensure Neo4j env vars are already configured for your machine (URI, user, password) — same Aura instance you use in production/dev.  
4. Start: `npm run dev`.  
5. Open the URL the terminal prints (usually `http://localhost:3000`).

### Useful navigation on the live/local site

| Goal | Where to go |
| ---- | ----------- |
| Home / chatbot | `/` (footer Home) |
| Player Stats | Footer **Stats** → Player Stats; pick a player |
| Team / Club Stats | Stats page → Team Stats or Club Stats |
| Club Information + Records | Footer **Club** (or Club Information) |
| TOTW | Footer TOTW |
| Settings | Footer Settings |
| Player Profile | From Player Stats, open the profile / milestone link, or `/profile/[playerSlug]` (e.g. luke-bangs style slug) |
| Season Wrapped | `/wrapped/[playerSlug]` from profile or Wrapped entry |

---

## Recommended order

1. **Wave 0** — Manual verification (local or develop; some of these UIs are off on production main)  
2. **Wave 2** — New milestone badges  
3. **Wave 3** — Chatbot partnerships / impact  
4. **Wave 4** — Architecture / eng hardening  
5. **Wave 5** — Turn remaining production flags **on**, then remove unused flag code  

**Retired (do not implement):** Neo4j GDS / Squad Backbone (Feature 7c/7d). Partnerships + impact on Player Stats remain.

---

## Wave 0 — Verification (do this first)

Goal: Confirm shipped features still behave correctly. You are **checking local or develop**, not writing new features yet. Some Wave 0 UIs are off on production main until Wave 5. Tick boxes as you go. When all pass, update FEATURES-MASTER-STATUS §8 and set Feature 13 to Shipped if confirmed.

### 0A. Season Wrapped — pause / play / restart / share

**What you are checking:** Autoplay controls and share text on a player’s Wrapped experience.

**Steps:**

1. Start the site (`npm run dev`) or open your **develop** Netlify URL (not production main — see Feature flags above).  
2. Open a known player’s Wrapped page, e.g. pick yourself from Stats → Profile → Season Wrapped, or go to `/wrapped/<player-slug>`.  
3. Wait for slides to auto-advance.  
4. Find the **pause / resume** control (aria label like “Pause autoplay” / “Resume autoplay”).  
   - [x] Pause stops advancing.  
   - [x] Resume continues advancing.  
5. If there is a **restart** / go-to-start control, use it.  
   - [x] Playback returns to the first slide and continues sensibly.  
6. Open **Share**.  
   - [x]] Share image / modal appears without errors.  
   - [x] Copy-link / share text includes a sensible season line **and** the wrapped URL (clipboard should get something like season text + `…/wrapped/…`).  
7. Swipe or use next/prev if available.  
   - [x] Slides change without blanking the page.  

**If something fails:** Note the player slug, browser (desktop vs mobile), and which control failed. Fix is in `components/wrapped/WrappedExperience.tsx` and related share helpers — only after you finish the rest of Wave 0 checks.

### 0B. Achievement Badges on Player Profile

**What you are checking:** Naming, categories, and display order match the milestone catalogue.

**Steps:**

1. Open [PLAYER-PROFILE-MILESTONES.md](docs/to-do-docs/PLAYER-PROFILE-MILESTONES.md) in one window.  
2. Open a player profile: Stats → select player → open profile link (`/profile/<slug>`).  
3. Confirm section order on the page is roughly: **Season Wrapped** → **Headline Stats** → **Achievement Badges**.  
4. On **desktop**, hover badges; on **narrow/mobile**, tap a badge (should open a **centered modal**, not a clipped hover tooltip).  
5. Check:

   - [x] Section is called something like **Achievement Badges** (not an old name).  
   - [x] Badges are grouped in categories that match the doc (Appearances, Goals, Assists, Defence, Performance, Special / Keeping, etc.).  
   - [x] Tier presentation makes sense (highest earned tier shown; locked badges show progress).  
   - [x] Tooltip/modal shows roughly six lines of useful copy (name, description, earned/current, next tier, peers, club leader) when data exists.  
   - [x] Mobile shows a usable grid (e.g. ~3 across), not broken layout.  

**If wrong:** Compare UI to `lib/badges/catalog.ts` and profile components; fix copy/order only after documenting what is wrong.

### 0C. Club Information — headings and record rounding

**What you are checking:** Records on Club Information look correct and numbers are rounded sensibly.

**Steps:**

1. Open **Club Information** (Club footer area).  
2. Find **Records** (component `RecordsSection`; above Milestones). This section is **off on production main** until Wave 5 (`clubInfoRecords`).  
3. On **desktop** and **mobile** widths:

   - [x] Headings are clear and not duplicated oddly (Records vs Captains/Awards pages).  
   - [x] Highest single-match **FTP** (fantasy points) values look rounded for display (not huge floating garbage).  
   - [x] Scoreline-style records read as scores humans expect (e.g. `5-1`), not raw floats.  
   - [x] Empty/missing records do not crash the page.  

**If wrong:** Trace `GET /api/club-records` and `RecordsSection` display formatting.

### 0D. Feature 13 — Header profile icon

**What you are checking:** A profile icon appears in the header on main pages with sensible spacing.

**Steps:**

1. Visit each main area with the header visible: **Home**, **Stats**, **TOTW**, **Club Information**, **Settings**.  
2. For each page:

   - [x] Profile icon is visible (not only on Home).  
   - [x] Icon is tappable/clickable and goes to a sensible profile destination (or picker flow).  
   - [x] Icon does not collide with title / nav / badges (padding looks intentional).  

3. Optionally re-run Home Playwright tests `2.0` and `2.3a` if you change anything:  
   `npx playwright test` filtered to the Home suite (see `__tests__/e2e/`).  
4. When confirmed, edit FEATURES-MASTER-STATUS Feature **13** from “Shipped (verify UX)” to plain **Shipped**, and note the date in **Last updated**.

### 0E. Optional — stronger TOTW previous-weeks assertions

Only if you care about test hardening:

1. Open TOTW page; confirm `#totw-previous-weeks-strip` shows recent weeks.  
2. Strengthen Playwright test `4.14` so it asserts seeded week content, not only that the strip exists.  
3. Run that E2E test and tick when green.

### 0F. Streaks end-to-end QA (use STREAKS_TESTING.md as the master checklist)

**What you are checking:** Streak numbers agree across Player Stats, Team Stats, Wrapped, chatbot, and rankings. Player/Team/Club streak **UI** is **off on production main** until Wave 5 — use local or develop.

**Prep:**

1. Open [STREAKS_TESTING.md](docs/to-do-docs/STREAKS_TESTING.md).  
2. Pick **2–3 players** with long, multi-team / multi-season history (e.g. a well-known regular).  
3. Clear all Stats filters (full career) before baseline checks.  
4. Prefer data that was recently seeded so streak fields are current.

**Then work through the doc section by section and tick there *and* here:**

#### Player Stats → Streaks (`#streaks-section`)

1. Stats → Player Stats → choose player → scroll/nav to **Streaks**.  
2. For each scenario in STREAKS_TESTING §1:

   - [ ] Appearance streak increments **per match**, not per calendar week (two games in one week → +2).  
   - [ ] Cross-team appearances in consecutive weeks **continue** the appearance streak.  
   - [ ] If anchor team played and player did not play anywhere → appearance streak **breaks**.  
   - [ ] If anchor team had **no** fixture that week → appearance streak does **not** break (“protected week”).  
   - [ ] Goal/assist-type streaks can **skip** weeks where the player did not appear (scoring A → miss B → score C can still continue).  

#### Filters

- [ ] Record unfiltered current + all-time streaks.  
- [ ] Apply season / team / location / result filters.  
- [ ] Live streak cards **recompute** for the filtered scope (values should change when filters bite).  

#### Chatbot (Home chatbot panel)

Ask exactly (with the same player selected in context if the UI supports it):

- [ ] “What is my longest goal scoring streak?”  
- [ ] “What is my longest assisting run?”  
- [ ] “What is my longest consecutive goal involvement streak?”  
- [ ] “What is my longest consecutive clean sheet streak?”  
- [ ] “What is my longest consecutive weekends played streak?”  
- [ ] Numbers match Player Stats Streaks (not a different date-gap invention).  
- [ ] Answer area shows text and, when applicable, NumberCard / Table / Calendar viz.  

#### Rankings via chatbot

- [ ] “Who has the highest current scoring streak?”  
- [ ] “Who has the highest all-time appearance streak?”  
- [ ] “Who has the highest all-time clean sheet streak?”  
- [ ] Top values match what those players show on their own Streaks sections.  

#### Team Stats → Longest Active Streaks

1. Stats → **Team Stats** → select an XI/team.  
2. Find **Longest Active Streaks** (`#team-streak-leaders`).  

   - [ ] Section exists and shows leader cards (player + “in a row” value) per category.  

#### Wrapped → Streak slide

1. Open `/wrapped/<slug>` for a player with a notable streak.  
2. Advance to the **Streak** slide.  

   - [ ] Shows longest streak type, value, and a short context line.  

#### Harder scenarios (if you can change seed data)

- [ ] Void/un-void a fixture → re-seed/recompute → streaks update on Player Stats, chatbot, and rankings.  
- [ ] Player spanning two seasons: streak does **not** artificially reset at season boundary when weekly rules allow continuation.  

#### Pass rule

Only mark Wave 0 streaks done when **all three** agree for each scenario:

- [ ] Seeded / stored player streak properties  
- [ ] Live streak API/UI (filter-aware cards)  
- [ ] Chatbot answers  

**When Wave 0 is finished:** Update FEATURES-MASTER-STATUS §8 (“next focus”) to the next wave, and bump **Last updated**.

---

## Wave 2 — New milestone badges (implement next)

**Goal:** Add new achievement badges that use stats **already** on Player nodes — no new external data source.

**Skip these “More ideas” (already shipped in catalogue):**

- Century Starter → already `century_starter`  
- GK Clean Sheet Specialist → already `gk_clean_sheet_specilaist`  

### Mental model: how a badge ships

You always do **both** repos:

1. **`database-dorkinians`** — define the badge key, tiers, and how the number is computed; run unit tests; **full re-seed**.  
2. **`V3-Dorkinians-Website`** — mirror the badge in `lib/badges/catalog.ts` (must stay in sync); profile grid picks it up via `player-badges` API.  
3. Verify on `/profile/<slug>` and club badge leaderboard if applicable.  
4. Strike the idea from PLAYER-PROFILE-MILESTONES “More ideas”.

### Recipe for each badge (repeat)

1. Open PLAYER-PROFILE-MILESTONES and pick one unchecked badge below.  
2. In `database-dorkinians`, find existing patterns in `badgeDefinitions.js`, `badgeComputation.js`, `playerBadgesComputation.js`.  
3. Add definition (key, tiers bronze/silver/gold/diamond as appropriate, which Player field(s), min-minutes rules if needed).  
4. Implement computation; add/extend tests; run `npm run test:badges`.  
5. Full re-seed Aura.  
6. In this website, add the same key + labels + tier thresholds to `lib/badges/catalog.ts` (and tooltip helpers if required).  
7. Confirm `GET /api/player-badges` returns the new key for a player who should earn it.  
8. Open that player’s profile Achievement Badges grid — locked/earned/progress looks right.  
9. Tick the box here and remove the idea from the milestones doc.

### Checklist of badges to build

#### Appearances

- [ ] **Ever Ready** — consistency: `appearances / numberSeasonsPlayedFor` above tier thresholds.  
- [ ] **Bench Utility** — `subAppearances` tiers e.g. 10 / 25 / 50 / 100.  

#### Goals

- [ ] **Open Play Sniper** — open-play goals only (exclude pens/other if your schema separates them; follow existing goal field conventions in DB).  
- [ ] **Goals Per App Elite** — `goalsPerApp` tiers.  
- [ ] **Minutes-per-Goal Master** — `minutesPerGoal` where **lower is better** (implement as “must be ≤ threshold” bands).  

#### Assists

- [ ] **Assist Per App Elite** — `assistsPerApp`.  
- [ ] **GI Conductor** — `goalInvolvementsPerApp`.  
- [ ] **Dual Threat** — **both** `goalsPer90` and `assistsPer90` must clear cutoffs (and usually min minutes ≥ 360 like other per-90 badges).  

#### Defence

- [ ] **Card-Free Career** — low `(yellowCards + redCards)` relative to appearances.  
- [ ] **Save Rate Hero** — `savesPer90` with a minimum-minutes gate.  

#### Performance

- [ ] **Form Floor** — sustained high `formBaseline` (example bands 7.0 / 7.5 / 8.0 / 8.5).  
- [ ] **Points Engine** — `fantasyPointsPerApp`.  
- [ ] **Big Match Winner** — combine `wins` and `gamesPercentWon` thresholds.  

#### Special

- [ ] **Team Loyalist** — high `mostPlayedForTeamAppearances`.  
- [ ] **Road Warrior** — high `awayGames` **and** strong `awayGamesPercentWon`.  
- [ ] **Starter Impact** — high `winRateWhenStarting` with a minimum `starts` count.  

**Suggested first three to implement (simple fields, clear UX):** Ever Ready → Bench Utility → Form Floor.

---

## Wave 3 — Chatbot: partnerships, impact, badges

**What already works:** Form (`FORM_CURRENT`), many streak phrasings, core stats including starts.

**What you still need to build:** The chatbot answering graph-style questions that the **Stats UI already shows** on local/develop (`#partnerships-section`, `#impact-section`). Those sections are **off on production main** until Wave 5.

### 3A. Partnerships / impact / “best partner”

**What success looks like:**

- User asks e.g. “Who is my best partner?”, “What’s my impact on the team?”, “Who do I win more with?”  
- Chatbot returns answers consistent with Player Stats **Partnerships** (`#partnerships-section`) and **Impact** (`#impact-section`) for the same filters/player.

**Step-by-step approach:**

1. On the site, open Player Stats for a player with partnerships; note a known partner name and win-rate delta so you have a **ground-truth** answer.  
2. Ask the chatbot the same question today; note the failure mode (unsupported / wrong / generic).  
3. In code (website repo):  
   - Add metrics / intents in `lib/config/chatbotMetrics.ts` (and entity extraction / question analysis as needed).  
   - Route those intents through handlers that reuse **existing** partnership/impact computation or APIs used by Player Stats — do **not** invent a second Cypher truth source.  
   - Add response templates that state partner name, shared games (≥5 rule), and signed % delta vs baseline where applicable.  
4. Add automated tests for the new phrasings.  
5. Manually re-ask the ground-truth questions; values must match the UI.  

- [ ] Partnerships NL works  
- [ ] Impact / with-vs-without NL works  
- [ ] “Best partner” style ranking works  
- [ ] FEATURES-MASTER-STATUS §5 updated to say these are supported  

### 3B. Optional — badges in chatbot

- [ ] Questions like “What badges do I have?” / “Am I close to Club Stalwart gold?” answered from `player-badges` + `lib/badges/catalog.ts`.  

Do this **after** 3A unless badges Q&A is a higher product priority.

---

## Wave 4 — Architecture / engineering (from ARCHITECTURAL_REVIEW_ACTION_PLAN)

**What this is:** Hardening and cleanup, not new football features. Use the action plan file as the detailed checkbox source; this section tells you **what to do** in plain language.

Open [ARCHITECTURAL_REVIEW_ACTION_PLAN.md](docs/to-do-docs/ARCHITECTURAL_REVIEW_ACTION_PLAN.md) and tick items there as you complete them.

### Priority 1 residual — CORS in production

- [ ] In **Netlify** site env, set `ALLOWED_ORIGIN` to your real site origin(s) as the code expects.  
- [ ] Deploy; from a browser on the production site, exercise the chatbot POST and confirm no CORS failures in DevTools → Network.  
- [ ] Do not commit secrets.

### Priority 2 — TypeScript

- [ ] Run the project type-check (`npm run type-check` if defined; otherwise `tsc --noEmit`).  
- [ ] Fix implicit `any` in `lib/services/chatbotService.ts` (methods listed in the action plan).  
- [ ] Fix query handlers under `lib/services/queryHandlers/`.  
- [ ] Only then tighten `tsconfig` (`strict`, `noImplicitAny`, `strictNullChecks`) and add type-check to CI.  

Work in small PRs; chatbot files are huge.

### Priority 3 — Security residuals

- [ ] In `app/api/chatbot/route.ts`, validate body with **Zod**: `question` required string, **max 500** chars; return 400 on failure.  
- [ ] Write a short user-facing note (README or Settings/docs) explaining chatbot **rate limits**.  
- [ ] Audit required env vars documentation; confirm `.env` is gitignored; never commit credentials.  

### Priority 4 — Architecture splits

Do these when chatbot behaviour is stable (ideally after Wave 3):

- [ ] Split `chatbotService.ts` into smaller services (entity / query / response / orchestrator), each under ~500 lines.  
- [ ] Decide one API style (prefer Next.js `app/api` vs leftover Netlify functions) and unify error JSON shape.  
- [ ] Split `lib/stores/navigation.ts` into focused Zustand stores (navigation, filters, cache, player) + selectors; update components gradually.  
- [ ] Add Neo4j health check / retry / pool metrics / recovery docs (pooling already exists in `lib/neo4j.ts`).  

### Priority 5 — Performance

- [ ] Verify images/Lighthouse after any `unoptimized` image config changes.  
- [ ] Add request deduplication for identical in-flight API calls; use it from chatbot where duplicate asks happen.  
- [ ] Improve caching story (document TTL; consider Redis/KV if in-memory is insufficient).  
- [ ] Extend service worker to cache safe API GETs; test offline/stats behaviour.  
- [ ] Analyze bundle; remove unused deps; code-split heavy charts; aim for a sensible JS budget.  
- [ ] Prefetch / optimistic UI where Stats navigation is slow.  
- [ ] Enable response compression if not already (`compress` in Next config where applicable).  

### Priority 6 — Developer experience

- [ ] One logging helper used consistently.  
- [ ] Error tracking (e.g. Sentry) on production.  
- [ ] Web Vitals + timing logs for chatbot/DB/API; alerts if you have monitoring.  
- [ ] Light architecture / API notes for future you.  

### Priority 7 — Testing quality

- [ ] Grow component and API route tests toward the action plan’s coverage goals.  
- [ ] Add perf regression / load checks if you need confidence under traffic.  

---

## Wave 5 — Turn production flags on, then delete leftover flags

**Goal:** By the end of this wave, production main shows the **same** gated UI as local/develop, and the feature-flag system is **gone**. Keep the “on” code paths; delete the “off” branches.

**When to do this:** After Wave 0 (and Wave 3 if you want Partnerships/Impact chatbot live on main in the same release). Wave 2 badges and Wave 4 eng work do not block enabling these flags.

**Source of truth:** `config/config.ts` → `featureFlagsProductionDefault`. Flip flags **there** only (no env vars).

**Do not remove** `isDevelopBranchDeploy()` — that still drives the develop badge / manifest / layout branding, independent of flags.

### 5A. Verify remaining gated UI on local or develop

Wave 0 already covers Records (`clubInfoRecords`) and Player/Team streak cards. Confirm the rest **before** flipping production. Use `npm run dev` or the develop Netlify URL.

#### Player Stats

- [ ] **Key Performance** (`playerStatsKeyPerformance`) — Key Performance Stats section; per-90 toggle on the key cards works.  
- [ ] **Form** (`playerStatsForm`) — `#form-section` chart loads for a player with matches.  
- [ ] **Starting Impact** (`playerStatsStartingImpact`) — `#starting-impact` shows when the player has appearances.  
- [ ] **Partnerships** (`playerStatsPartnerships`) — `#partnerships-section` (also Wave 3 ground truth).  
- [ ] **Impact** (`playerStatsImpact`) — `#impact-section`.  
- [ ] **Player Recordings** (`playerStatsPlayerRecordings`) — `#player-recordings` (empty is OK if the player has none; section must not crash).  
- [ ] **Per 90 table tab** (`playerStatsDataTablePer90`) — Data table has Totals / Per App / **Per 90**.  
- [ ] **Streaks** (`playerStatsStreaks`) — already in Wave 0F; re-tick if you re-checked.

#### Team Stats

- [ ] **Formations Used** (`teamStatsFormationsUsed`) — `#team-formation-breakdown`.  
- [ ] **Team Recordings** (`teamStatsTeamRecordings`) — `#team-recordings`.  
- [ ] **XI streak cards** (`teamStatsXiStreakCards`) — `#team-streaks-section`.  
- [ ] **Streak leaders + best current form** (`teamStatsStreakAndForm`) — `#team-streak-leaders` (Wave 0F) and Top Players option `bestCurrentForm`.

#### Club Stats / Club Information / League

- [ ] **Club longest active streaks** (`clubStatsLongestActiveStreaks`) — Club Stats `#club-streak-leaders`.  
- [ ] **Club Recordings** (`clubStatsClubRecordings`) — `#club-recordings`.  
- [ ] **Club Information Records** (`clubInfoRecords`) — Wave 0C; Records above Milestones.  
- [ ] **League latest result** (`leagueInfoLatestResult`) — Club → League Information; latest-result card / modal.

**If something is broken on develop:** fix that first. Do not enable a broken surface on production.

### 5B. Enable everything on the production preset

In `config/config.ts`, set **every** key in `featureFlagsProductionDefault` to `true` so it matches `featureFlagsAllEnabled` (including the 16 that are currently `false`).

Those 16 currently off on main:

`playerStatsKeyPerformance`, `playerStatsForm`, `playerStatsStreaks`, `playerStatsStartingImpact`, `playerStatsPartnerships`, `playerStatsImpact`, `playerStatsPlayerRecordings`, `playerStatsDataTablePer90`, `teamStatsFormationsUsed`, `teamStatsTeamRecordings`, `teamStatsStreakAndForm`, `teamStatsXiStreakCards`, `clubStatsLongestActiveStreaks`, `clubStatsClubRecordings`, `clubInfoRecords`, `leagueInfoLatestResult`.

Already `true` on main (leave them true): `playerProfile`, `achievementBadges`, `seasonWrapped`, `profileServerHeadline`, `wrappedStagedLoad`, `wrappedPriorityLogos`.

- [ ] Production preset is all-`true`.  
- [ ] Deploy **main**.  
- [ ] Smoke the 5A list on the **production** URL (not develop).  
- [ ] Chatbot Partnerships/Impact (Wave 3) still matches Player Stats if you shipped 3A.  
- [ ] Update FEATURES-MASTER-STATUS §3 Feature flags row: production no longer hides Stats/Club/League extras.

Optional safer split: enable Player Stats flags first, deploy, then Team/Club/League. Same end state.

### 5C. Remove leftover feature-flag code

Only after 5B is live and the production smoke pass is green. Flags that are always true are dead weight.

**Keep the “on” behaviour** (including Wrapped staged load / priority logos / profile server headline). Delete `if (featureFlags.*)` / ternary off-branches.

1. Remove from `config/config.ts`: `FeatureFlags` type, `featureFlagsAllEnabled`, `featureFlagsProductionDefault`, `featureFlagPresets`, `resolveFeatureFlags`, `featureFlags` export, and the `isDevelopBranchDeploy` import **if it is unused after that**.  
2. Unwrap call sites (import + conditionals). Grep for `featureFlags` and fix every hit:

   | Area | Files |
   | ---- | ----- |
   | Stats | `PlayerStats.tsx`, `TeamStats.tsx`, `ClubStats.tsx`, `StatsNavigationMenu.tsx` |
   | Club / League | `ClubInformation.tsx`, `LeagueInformation.tsx` |
   | Profile / Wrapped | `PlayerProfileView.tsx`, `WrappedExperience.tsx`, `app/profile/[playerSlug]/page.tsx`, `app/wrapped/[playerSlug]/page.tsx`, `app/api/wrapped/[playerSlug]/route.ts`, `SeasonWrappedBanner.tsx` |
   | Layout | `Header.tsx`, `SidebarNavigation.tsx` |
   | APIs | `app/api/team-data-filtered/route.ts` (always compute streak cards / leaders when the team scope matches) |

3. Docs / tests: `FEATURES-MASTER-STATUS.md` §3; `docs/PROFILE_WRAPPED_PERFORMANCE.md` (say load opts are always on, not A/B flags); `jest.setup.js` flag comment. Playwright `WEBSITE_URL` may point at production main again because the UI is no longer hidden.  
4. **Keep** `lib/utils/isDevelopBranchDeploy.ts` and its uses in layout / manifest / Header / Sidebar (dev branding).

- [ ] `rg featureFlags` (or IDE search) returns **no** remaining code references (docs history in FEATURES-MASTER-STATUS is OK to rewrite, not leave as if flags still exist).  
- [ ] `rg featureFlagPresets` / `FeatureFlags` / `resolveFeatureFlags` are gone.  
- [ ] `npm run test` (or targeted unit + Playwright stats/club/league/profile/wrapped) passes.  
- [ ] Production smoke of 5A still passes after the deletion (off-branches did not hide a required fallback).

**If a flag still has a real rollback need:** do not delete that one key; document why in FEATURES-MASTER-STATUS. Default is **delete them all** once production matches develop.

---

## After every wave (mandatory)

1. Update [FEATURES-MASTER-STATUS.md](docs/to-do-docs/FEATURES-MASTER-STATUS.md): §2 status rows, §5 chatbot notes, §8 handoff, **Last updated**.  
2. Update [PLAYER-PROFILE-MILESTONES.md](docs/to-do-docs/PLAYER-PROFILE-MILESTONES.md) when badges ship (move ideas out of “More ideas”).  
3. Tick boxes in [STREAKS_TESTING.md](docs/to-do-docs/STREAKS_TESTING.md) / [ARCHITECTURAL_REVIEW_ACTION_PLAN.md](docs/to-do-docs/ARCHITECTURAL_REVIEW_ACTION_PLAN.md).  
4. Run relevant tests before calling a wave done:
   - Website: `npm run test` and/or targeted Playwright  
   - DB: `npm run test:badges`, `test:streak-detection`, `test:graph-insights` as applicable  
5. Do **not** push to git unless you explicitly decide to; do **not** commit `.env`.

---

## Quick “what should I do this week?”

1. Complete **Wave 0** checks with a notebook of pass/fail (local or develop).  
2. Implement **Ever Ready**, **Bench Utility**, and **Form Floor** badges (Wave 2).  
3. If energy remains, start Wave 3 partnerships chatbot with one ground-truth player.  
4. Leave **Wave 5** (production flags on + delete flag code) until Waves 0–3 are done.
