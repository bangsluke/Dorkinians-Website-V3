# Dorkinians FC website - feature implementation report

**Generated from:** `IMPLEMENTATION-STATUS.md` and `NEW-FEATURES.md` (as of last documented update: **2026-03-31**).  
**Purpose:** Single readable summary of what has shipped, what is deferred, how major Player Stats sections work, and what you can ask the home chatbot today.

---

## 1. Executive summary

The site has moved well beyond “basic stats”: there is a full **foundation** layer (starters, match ratings, formations), **per-90** analytics, **form** (EWMA curves), **streaks** (DB-backed + **live filter-scoped** API on Player Stats), **club records**, **graph insights** (partnerships, impact, squad backbone), **Season Wrapped**, **achievement badges**, **Player Profile**, **Veo** on fixtures and recordings, **TOTW** enhancements (previous weeks, share), and several **UX polish** rounds (Phases 6–8).

**Documentation state:** Phase 7 (A–J) and Phase 8 checklist items are marked **shipped** in `IMPLEMENTATION-STATUS.md`. `NEW-FEATURES.md` still labels Phase 7 as “in progress” in one heading-treat the **status file** as the source of truth for completion unless you reconcile that wording.

**Immediate operational next step (from status file):** run Playwright stats/TOTW smoke on a **seeded** environment; optionally harden E2E for club recordings **See all** (`club-recording-see-all`).

---

## 2. Newly added features (high level)

Grouped by theme; details and “what’s left” follow in later sections.

| Theme | What shipped (examples) |
| ----- | ------------------------ |
| **Foundation** | Starter vs bench, `matchRating` on matches, inferred formation on fixtures, aggregates on `Player`; APIs and UI for **Starting impact**, formations chart, lineup ratings. |
| **Per 90** | Player per-90 stats (360-minute gate), table tabs Totals / Per App / Per 90, comparison radar category, team top-player per-90 options. |
| **Form** | `player-form` API, Player Stats **Form** block (recent rating chips + composed chart + summary cards), EWMA on `MatchDetail` / summary fields on `Player`; Team Top Players **best current form**. |
| **Streaks** | DB streak detection, Player streak fields, **Streaks** on Player Stats, **Streaks at risk** on home, **team streak leaders** on Team Stats; chatbot routing for many streak wordings. |
| **Records** | `ClubRecord` in DB, `/api/club-records`, **Records** on Club Information (honours-board style per later polish). |
| **Graph insights** | Partnership win rates, impact vs most-played XI, optional GDS (PageRank / Louvain); Player Stats **Partnerships**, **Impact**; Club Stats **Squad Backbone** (empty without GDS). **Most Connected** was removed (2026-03-31) in favour of partnerships-only UX. |
| **Wrapped** | `/wrapped/[playerSlug]`, API + OG images, share; profile entry and season-aware URLs. |
| **Badges** | DB + API + catalogue; badge bar on Player Stats; **milestone grid** on Player Profile with tooltips / formatting polish (Phase 8). |
| **Profile & nav** | Profile route, slug, header/sidebar profile icon, onboarding tooltips, Phase 8 one-time yellow ring + recordings counts, etc. |
| **Club / league / captains** | Merged Captains & Awards, Records placement, League latest result + shared fixture UI, Veo links, TOTW strip + share, dev/CI gates. |

---

## 3. Player Stats - section guide

These blocks appear on **Player Stats** (exact order has been adjusted in Phase 7-use the live page + `StatsNavigationMenu` as the final order). Stable **section ids** matter for in-page nav and tests (`#streaks-section`, `#partnerships-section`, etc.).

### 3.1 Form (`#form-section` and related)

**What it shows**

- **Recent match scores:** Last 10 match ratings (styled by band), respecting current filters.
- **Chart:** Grey scatter points = per-match **Rating**; **yellow** line = **Current form (5-match)** EWMA; **green** line = **Baseline (15-match)** EWMA.
- **Summary cards:** Current form, season average, peak form-with rating-band styling (polished in Phase 7/8).

**Data source**

- Match-level: `ewmaReactive`, `ewmaBaseline` on `MatchDetail` (from seeding / aggregates).
- Summary: `formCurrent`, `formBaseline`, `formTrend`, `formPeak`, `formPeakWeek` on `Player`.
- Chart fetch: `app/api/player-form/route.ts`.

**User-facing nuance**

- Golden-cross explanatory copy was removed from the section and info tooltip per UX polish; the chart still encodes crossovers visually where implemented.

---

### 3.2 Streaks (`#streaks-section`)

**What it shows**

- **Active** streaks (scoring, assists, goal involvement, clean sheet, appearances, starts, 85+ mins, MoM, discipline, wins-see live UI).
- **Season best** and **all-time best** on **every** tile; season best uses the **season of the chronologically last match** in the **current filter set**.
- Section + tile **info tooltips** use the same dark overlay pattern as other stats tooltips (no native `title` on tiles).

**Data rules (conceptual)**

- Same as foundation `database-dorkinians/services/streakDetection.js` (consecutive matches by date; dedupe by fixture+season).
- **Appearance streak** uses **most-played XI** fixtures: minutes `null` = not in squad breaks the run.

**Data source**

- **Live (filter-scoped):** `POST /api/player-streaks` + `lib/stats/playerStreaksComputation.ts` (client merge in `PlayerStats`).
- **Fallback:** `player-data` / `player-data-filtered` still return seeded `p.*` streak fields until the live request succeeds.

---

### 3.3 Partnerships (`#partnerships-section`)

**What it shows**

- Up to **10** partners (API returns more; UI caps display) with **≥5** shared games in the filtered fixture set.
- **Win rate** in those co-appearance games vs **your baseline win rate when you play**, with delta as **signed percent**: `+4.3% vs your win rate` (negatives in red).

**Data source**

- Filtered Cypher in `buildFilteredPartnershipsQuery` (`app/api/player-data/route.ts`) with `matches >= 5`; precomputed `partnershipsTopJson` on `Player` for unfiltered loads.

**Filter dependence**

- Uses the same dimensions as `player-data-filtered` (team, season, location, etc.).

---

### 3.4 Impact (`#impact-section`)

**What it shows**

- Compares team **win rate when the player plays** vs when they do not, for the player’s **most played XI** (or equivalent framing in UI).
- Copy was updated (Phase 8) to natural language, e.g. **“The 3rd XI wins 1.5% more often when you play.”** (using XI-style labels), with sane handling of negative deltas.

**Data source**

- Graph insights computation (impact delta on `mostPlayedForTeam`); surfaced on player payloads and in the Impact card.

**Caveats**

- Small sample sizes on “without player” minutes may produce noisy or suppressed messaging-see spec for thresholds.

---

### 3.5 Squad Backbone (Club Stats, not Player Stats)

**Label:** **Squad Backbone** (title casing per polish).

**What it shows**

- Top players by **PageRank**-style influence on `PLAYED_WITH`-**only when Neo4j GDS** is available on the Aura instance.

**If the list is empty**

- **GDS / Graph Analytics** is not enabled or not licensed on your Aura tier; the UI explains that. Enabling GDS and re-seeding unlocks `squadInfluence`, ranks, and optional community fields (Feature 7c/7d). Operator guide: **`docs/Neo4j_Aura_GDS_Setup_Guide.md`**.

---

## 4. Chatbot - what you can ask today

The home chatbot uses `lib/config/chatbotMetrics.ts` plus dedicated handlers in `lib/services/chatbotService.ts` (including extensive **streak** routing).

### 4.1 Implemented / well supported

| Area | Example questions / phrasing (illustrative) |
| ---- | -------------------------------------------- |
| **Form** | “What’s my current form?”, “Who’s in the best form?” - **`FORM_CURRENT`** metric; rankings for best/worst / low form style questions (see implementation notes in status: Feature 3 chatbot). |
| **Streaks** | “What’s my longest scoring streak?”, “Longest appearance streak”, “Current win streak”, goal involvement / clean sheet / assist streaks, many “longest run” variants - wired via `chatbotMetrics` streak keys and `chatbotService` streak paths. |
| **Core stats** | Goals, assists, minutes, cards, clean sheets, MoM, **starts** (`STARTS` / “how many times have I started?”), etc. - standard `metricConfigs` aliases. |

### 4.2 Spec’d in NEW-FEATURES but **not** documented as chatbot-complete

`IMPLEMENTATION-STATUS.md` explicitly notes:

- **Partnerships / impact / connectivity style questions** in natural language are **not** marked done for the chatbot (e.g. “Who’s my best partner?”, “What’s my impact on the team?”).
- **Badges:** optional future chatbot phrasing.
- ~~**Starters:** “How many times have I started?”~~ - **shipped (2026-03-31)** via `STARTS`.

Treat graph-insight **questions** (other than starts) as **UI-first** today; extending `chatbotService` + entity extraction would be a discrete follow-up task.

---

## 5. What is left to set up, implement, or verify

### 5.1 Infrastructure / database

| Item | Notes |
| ---- | ----- |
| **Neo4j GDS** | Required for **Squad Backbone** population and advanced graph fields (7c/7d). Code paths exist; Aura must have Graph Analytics / appropriate tier + **full re-seed**. Step-by-step: **`docs/Neo4j_Aura_GDS_Setup_Guide.md`**. |
| **Re-seed after formula changes** | Any change to `matchDerivedFields.js` (e.g. match rating) requires re-seed for stored values to refresh. |

### 5.2 Product / spec follow-ups (from status file)

| Item | Notes |
| ---- | ----- |
| **Profile icon everywhere** | Feature 13 follow-up: show profile icon on **all** main pages when a player is selected (not only Home)-verify against `NEW-FEATURES.md` amendment. |
| **Season Wrapped on home** | Spec supersession: banner removal; entry via profile + direct `/wrapped/...` (check if fully aligned with your product preference). |
| **Playwright / E2E** | Run full suites on seeded data; harden recordings **See all**, deterministic TOTW strip assertions. |
| **Chatbot graph + badges** | See §4.2. |

### 5.3 Documentation hygiene

- Align **Phase 7** heading in `NEW-FEATURES.md` (“in progress” vs completed) with `IMPLEMENTATION-STATUS.md`.
- Define **Phase 9** (or next backlog) when you have the next batch of features, and add **Next focus** in the status file.

---

## 6. Quick reference - where logic lives

| Feature | Primary locations |
| ------- | ------------------- |
| Streaks (DB) | `database-dorkinians/services/streakDetection.js` |
| Streaks (live / site) | `lib/stats/playerStreaksComputation.ts`, `app/api/player-streaks/route.ts`, `buildStreakMatchesCollectQuery` / `buildStreakAppearanceSlotsCollectQuery` in `app/api/player-data/route.ts` |
| Form EWMA (DB) | `database-dorkinians` match derived + aggregates |
| Graph insights (DB) | `database-dorkinians/services/graphInsightsComputation.js` |
| Badges (DB) | `badgeDefinitions.js`, `badgeComputation.js`, `playerBadgesComputation.js` |
| Badges (site catalogue) | `lib/badges/catalog.ts` (keep in sync with DB) |
| Player Stats UI | `components/stats/PlayerStats.tsx` |
| Form chart | `components/stats/player-stats/FormComposedChart.tsx`, `PlayerRecentFormBoxes.tsx` |
| Chatbot metrics | `lib/config/chatbotMetrics.ts`, `lib/services/chatbotService.ts` |
| Wrapped | `app/wrapped/...`, `lib/wrapped/*`, `GET /api/wrapped/...` |
| Aura GDS ops | `docs/Neo4j_Aura_GDS_Setup_Guide.md` |

---

## 7. Club milestones & badges - storage and extensions

### 7.1 Club milestones API (`GET /api/milestones`)

- **File:** `app/api/milestones/route.ts`.
- **Role:** Club-wide approaching/achieved milestones from aggregated `MatchDetail` / fixture data; thresholds live **in the route** alongside Cypher aggregations (rolling windows for apps, goals, assists, MoM, etc.).
- **Cache:** `apiCache` - invalidate or adjust TTL when milestone rules change.

**Adding a new milestone**

1. Add/extend the aggregating Cypher in `route.ts` to compute `currentValue` for the stat.
2. Register threshold bands used by `achieved` / `nearing` / `closestToMilestone` lists.
3. Map `statType` strings to labels (and icons if needed) in the Club Information UI.
4. Add tests if the JSON contract changes.

### 7.2 Player badge milestones

- **Site catalogue:** `lib/badges/catalog.ts` (ids, copy, tiers).
- **DB:** `database-dorkinians` badge definitions + `playerBadgesComputation` pipeline (see `IMPLEMENTATION-STATUS.md` Achievement badges).
- **UI:** `PlayerBadgeMilestoneGrid`, profile surfaces consuming badge APIs.

**Adding a badge**

1. Implement computation in the DB layer so stored progress is canonical.
2. Mirror catalogue metadata in `lib/badges/catalog.ts`.
3. Re-seed and verify API payloads before shipping UI.

---

## 8. How to brief the next AI session

Suggested prompt pattern:

> Continue from **`IMPLEMENTATION-STATUS.md`** → **Next focus**. Implement [specific item]. Constraints: do not edit `.env`, do not push git. Tests: [Playwright suite / file].

For new work not yet in the status file, add a short **Phase 9** (or feature name) block to **`NEW-FEATURES.md`** and a matching checklist row + **Next focus** line in **`IMPLEMENTATION-STATUS.md`** so scope is unambiguous.

---

*This file is a synthesis for humans and assistants; the authoritative checklists remain `IMPLEMENTATION-STATUS.md` and `NEW-FEATURES.md`.*
