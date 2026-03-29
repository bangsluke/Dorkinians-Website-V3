# Dorkinians FC - Feature Implementation Plan

> **Purpose:** This document is a set of implementation instructions for an AI coding assistant (Cursor). Each feature section contains the context, rationale, exact schema/code changes, where to place new files, and what tests to write. Implement features in phase order.

---

## Project context

**Two repositories:**

- `V3-dorkinians-website` - Next.js App Router frontend (`app/` directory). Uses TypeScript, Tailwind CSS, Recharts, @nivo/sankey, Framer Motion, Google Maps API, neo4j-driver, Zustand for state. Deployed on Netlify. Testing: Jest (unit/integration) + Playwright (e2e).
- `database-dorkinians` - Node.js seeding scripts that pull CSV data from Google Sheets and populate a Neo4j Aura database. Contains `config/schema.js` (provided below) defining all node types, relationships, CSV column mappings, and type converters.

**Database:** Neo4j Aura (cloud managed). The GDS (Graph Data Science) library is NOT currently installed - it requires the Graph Analytics plugin to be enabled on AuraDB Professional tier.

**Data flow:** Captains enter match data into Google Sheets → daily seeding script in `database-dorkinians` transforms CSV rows → creates/updates Neo4j nodes and relationships → frontend queries Neo4j via API routes in `V3-dorkinians-website/app/api/`.

**Existing schema (key node types and relationships):**

- `Player` - aggregate career stats (appearances, goals, assists, minutes, cards, saves, clean sheets, penalties, fantasy points, distance, position counts, per-team and per-season breakdowns)
- `MatchDetail` - per-player per-match stats (season, date, team, playerName, minutes, class [GK/DEF/MID/FWD], mom, goals, assists, cards, saves, ownGoals, conceded, cleanSheets, penalties, fantasyPoints, distance)
- `Fixture` - per-match metadata (season, date, team, opposition, homeOrAway, result [W/D/L], homeScore, awayScore, compType, competition)
- `WeeklyTOTW` / `SeasonTOTW` - team of the week selections with player positions and scores
- `PlayersOfTheMonth` - monthly top 5 players with scores
- `CaptainsAndAwards` - historical captains and award winners by season
- `OppositionDetails` - opposition team info with lat/long/distance
- `LeagueTable` - league standings per team per season
- `SiteDetail` - app metadata and version info

**Key relationships:** `PLAYED_IN` (Player→MatchDetail), `HAS_MATCH_DETAILS` (Fixture→MatchDetail), `PLAYED_WITH` (Player→Player), `PLAYED_AGAINST_OPPONENT` (Player→OppositionDetails), `IN_WEEKLY_TOTW`, `IN_SEASON_TOTW`, `IN_PLAYER_OF_THE_MONTH`, `HAS_CAPTAIN_AWARDS`

**Existing frontend pages (App Router):**

- Home page - chatbot interface with player selector
- Stats page with sub-pages: Player Stats, Team Stats, Club Stats, Player Comparison
- TOTW page with sub-pages: Team of the Week, Players of the Month
- Club Info page with sub-pages: Club Information, League Information, Club Captains, Club Awards, Useful Links
- Settings page

**Planned (Phase 6 — New Requests Round 2):** Dedicated **Player Profile** page; **Club Captains and Awards** (merged captains + awards pages); **Records** moved to Club Information above Milestones; fixtures **VEO LINK**; TOTW history strip + share; dev branding and CI gates — see Phase 6 below.

**Design system:** Dark olive-to-warm-gold gradient background. Semi-transparent card sections (`background: rgba(30,35,25,0.7)`) with subtle white borders (`border: 1px solid rgba(255,255,255,0.08)`). White bold section headers. Muted secondary text (`rgba(255,255,255,0.4-0.5)`). Yellow `#E8C547` as primary accent colour. Green `#5DCAA5` for positive indicators. The site is mobile-first.

**Existing stat calculations already in the system:** goals per appearance, conceded per appearance, minutes per goal, minutes per clean sheet, FTP per appearance, games % won, home/away win splits, most common position, most played for team, most prolific season.

---

## Phase 1: Data foundation (database-dorkinians repo)

These changes happen in the seeding script within `database-dorkinians`. They compute new derived fields from existing data and store them on Neo4j nodes. No new Google Sheets columns are required.

---

### Feature 1: Inferred starter status and formation

#### 1a. Infer starter vs substitute

**What:** The Google Sheets data lists players in order per match. The first 11 players listed for a fixture are starters; any players listed after the 11th are substitutes.

**Where to change (database-dorkinians):** In the seeding script that processes `TBL_MatchDetails` rows and creates `MatchDetail` nodes. During processing, group rows by fixture (using the `importedFixtureDetail` or matching on `date` + `team`), assign a row index per player within that fixture group, and set `started = true` for indices 1-11, `started = false` for indices 12+.

**Schema change in `config/schema.js`:**

```js
// In TBL_MatchDetails.properties, add:
started: { type: 'boolean', required: false },
playerOrder: { type: 'integer', required: false }  // 1-based position in the captain's list
```

**Edge cases to handle:**
- If a fixture has exactly 11 players, all are starters (no subs)
- If a fixture has fewer than 11 players, all listed players are starters
- The `playerOrder` field preserves the original ordering for debugging

**New properties to add to `Player` node (aggregate stats):**

```js
// In TBL_Players.properties, add:
starts: { type: 'integer', required: false },           // count of matches where started=true
subAppearances: { type: 'integer', required: false },   // count of matches where started=false
startRate: { type: 'number', required: false }           // starts / appearances
```

Compute these during the Player node aggregation step of the seeding script.

#### 1b. Infer formation from position classes

**What:** Count the position classes of the starting 11 players (those with `started=true`) per fixture. 1 GK + 4 DEF + 4 MID + 2 FWD = "4-4-2".

**Where to change (database-dorkinians):** After starter inference runs, add a post-processing step that groups starters by fixture, counts position classes, and writes the formation string to the Fixture node.

**Schema change in `config/schema.js`:**

```js
// In TBL_FixturesAndResults.properties, add:
inferredFormation: { type: 'string', required: false }
```

**Formation inference logic to implement:**

```js
function inferFormation(starterClasses) {
  // starterClasses is an array of 'class' values for the 11 starters
  const counts = { DEF: 0, MID: 0, FWD: 0 };
  starterClasses.forEach(cls => {
    if (cls !== 'GK' && counts[cls] !== undefined) counts[cls]++;
  });
  return `${counts.DEF}-${counts.MID}-${counts.FWD}`;
}
```

**Where to display (V3-dorkinians-website):**

| New stat | Display location | Section |
|---|---|---|
| Starts count, sub count, start rate | Player Stats page | Key Performance Stats cards (add "Starts: 187/235 (80%)" card) |
| Win rate when starting vs from bench | Player Stats page | New "Starting Impact" section after Match Results |
| Most starts (per team) | Team Stats page | Add as option in Top Players dropdown |
| Formation frequency + win rate per formation | Team Stats page | New "Tactical Overview" section after Key Performance Stats |
| Formation usage over seasons | Team Stats page | Add "Formation" as metric option in Seasonal Performance chart dropdown |
| started, startRate | Player Stats data table | New rows |
| "How many times have I started?" | Chatbot | New question pattern |

**Tests to write:**

- **Unit test (Jest):** `inferFormation(['GK','DEF','DEF','DEF','DEF','MID','MID','MID','MID','FWD','FWD'])` returns `"4-4-2"`. Test with 3-5-2, 4-3-3, 5-3-2. Test with fewer than 11 players (should handle gracefully). Test with no GK listed.
- **Unit test (Jest):** Starter inference assigns `started=true` to first 11 rows and `started=false` to rows 12+. Test with exactly 11 players (all starters). Test with 9 players (all starters).
- **Integration test (Jest):** After seeding a test fixture with 14 players, query Neo4j to confirm 11 MatchDetail nodes have `started=true` and 3 have `started=false`. Confirm the Fixture node has `inferredFormation` set.
- **E2E test (Playwright):** Navigate to Player Stats for a player with known starts. Verify the starts count displays correctly. Navigate to Team Stats and verify formation data appears in Tactical Overview.

---

### Feature 4: Automated match ratings

**What:** Generate a 1-10 match rating for every player in every match, computed from objective stats only (no subjective input). Starts at a baseline of 6.0, adjusted by position-weighted events.

**Where to change (database-dorkinians):** Add a post-processing step in the seeding script that runs after all MatchDetail nodes are created. For each MatchDetail node, compute the rating and write it as a property.

**Schema change in `config/schema.js`:**

```js
// In TBL_MatchDetails.properties, add:
matchRating: { type: 'number', required: false }
```

**Also add to Player aggregate stats:**

```js
// In TBL_Players.properties, add:
averageMatchRating: { type: 'number', required: false },
highestMatchRating: { type: 'number', required: false },
matchesRated8Plus: { type: 'integer', required: false }
```

**Rating calculation logic to implement:**

```js
function calculateMatchRating(matchDetail) {
  const { minutes, goals, assists, mom, cleanSheets, saves, yellowCards, redCards, ownGoals, conceded, penaltiesScored, penaltiesMissed, penaltiesSaved } = matchDetail;
  const pos = matchDetail.class; // 'GK', 'DEF', 'MID', 'FWD'
  
  let rating = 6.0;
  
  // Minutes bonus
  if (minutes >= 60) rating += 0.5;
  else if (minutes > 0) rating += 0.2;
  
  // Goals (position-weighted - rarer positions get higher bonus)
  const goalBonus = { GK: 1.5, DEF: 1.8, MID: 1.5, FWD: 1.2 };
  rating += (goals || 0) * (goalBonus[pos] || 1.2);
  
  // Assists
  rating += (assists || 0) * 1.0;
  
  // Man of the Match
  rating += (mom || 0) * 1.0;
  
  // Clean sheet (only GK and DEF get significant bonus)
  const csBonus = { GK: 1.5, DEF: 1.2, MID: 0.3, FWD: 0 };
  rating += (cleanSheets || 0) * (csBonus[pos] || 0);
  
  // Saves (GK only)
  if (pos === 'GK') rating += (saves || 0) * 0.3;
  
  // Penalty saved (GK only)
  if (pos === 'GK') rating += (penaltiesSaved || 0) * 2.0;
  
  // Negative events
  rating -= (yellowCards || 0) * 0.5;
  rating -= (redCards || 0) * 1.5;
  rating -= (ownGoals || 0) * 1.0;
  rating -= (penaltiesMissed || 0) * 0.8;
  
  // Goals conceded penalty (GK and DEF only, per 2 conceded)
  if (pos === 'GK' || pos === 'DEF') {
    rating -= Math.floor((conceded || 0) / 2) * 0.5;
  }
  
  // Clamp to [1.0, 10.0]
  return Math.round(Math.max(1.0, Math.min(10.0, rating)) * 10) / 10;
}
```

**Where to display (V3-dorkinians-website):**

| Display location | What to show |
|---|---|
| Player Stats → All Games expanded view | Colour-coded rating badge (1.0-10.0) next to each match row. Colours: 8.5-10 gold (#C9A42A), 7.0-8.4 green (#5DCAA5), 6.0-6.9 muted green, 4.0-5.9 amber, 1.0-3.9 red |
| Player Stats → Key Performance Stats | New "Avg Rating" card showing average match rating |
| Player Stats → data table | New rows: "Average match rating", "Highest match rating", "Matches rated 8+" |
| Team Stats → Top Players dropdown | Add "Highest avg rating" and "Most 8+ rated matches" options |
| TOTW → player detail modal | Show match rating alongside FTP score |

**Tests to write:**

- **Unit tests (Jest):** Test rating calculations for known scenarios:
  - Forward: 2 goals in 90 mins → expect 8.9
  - Midfielder: 1 goal, 1 assist, MoM in 90 mins → expect 10.0
  - Defender: clean sheet, 90 mins → expect 7.7
  - GK: 5 saves, clean sheet, 90 mins → expect 9.5
  - Forward: 30 mins, yellow card, no contributions → expect 5.7
  - Defender: own goal, red card, 4 conceded → expect 2.5 (clamped from 1.0)
  - Verify clamping: score that exceeds 10.0 returns 10.0, score below 1.0 returns 1.0
- **Integration test (Jest):** Seed a test match, run rating calculation, query Neo4j to confirm `matchRating` property is set on the MatchDetail node.

---

## Phase 2: Derived analytics (database-dorkinians repo - seeding script)

These features compute new derived stats from existing and Phase 1 data, stored as properties on Player nodes.

---

### Feature 2: Per-90 normalised stats

**What:** For each player, calculate `(stat / minutes) * 90` for key counting stats. Only display when a player has >= 360 minutes (approximately 4 full matches).

**Where to change (database-dorkinians):** In the Player node aggregation step of the seeding script, after computing the existing aggregate stats.

**Schema change in `config/schema.js` - add to `TBL_Players.properties`:**

```js
goalsPer90: { type: 'number', required: false },
assistsPer90: { type: 'number', required: false },
goalInvolvementsPer90: { type: 'number', required: false },
ftpPer90: { type: 'number', required: false },
cleanSheetsPer90: { type: 'number', required: false },
concededPer90: { type: 'number', required: false },
savesPer90: { type: 'number', required: false },
cardsPer90: { type: 'number', required: false },
momPer90: { type: 'number', required: false }
```

**Calculation logic:**

```js
function calculatePer90(stat, minutes) {
  if (!minutes || minutes < 360) return null;  // minimum threshold
  return Math.round(((stat || 0) / minutes) * 90 * 100) / 100;  // 2 decimal places
}
```

Apply to: goals, assists, (goals+assists), fantasyPoints, cleanSheets, conceded, saves, (yellowCards+redCards), mom.

**Where to display (V3-dorkinians-website):**

| Display location | Implementation |
|---|---|
| Player Stats → data table | Add toggle/tabs: "Totals \| Per App \| Per 90". Per-90 view shows per-90 values with minutes context. Grey out stats where minutes < 360 with tooltip "Min. 360 minutes required" |
| Player Stats → Key Performance Stats | Add small toggle beneath cards to flip between totals and per-90 |
| Player Comparison → radar chart | Add "Per 90" as a stat category option in the dropdown |
| Team Stats → Top Players | Add per-90 metrics as dropdown options |

**Tests to write:**

- **Unit tests (Jest):** 
  - `calculatePer90(10, 900)` → `1.0` (10 goals in 900 mins = 1.0 per 90)
  - `calculatePer90(5, 450)` → `1.0`
  - `calculatePer90(3, 200)` → `null` (below 360 min threshold)
  - `calculatePer90(0, 500)` → `0`
  - `calculatePer90(null, 900)` → `0`
  - `calculatePer90(10, 0)` → `null`
- **E2E test (Playwright):** Navigate to Player Stats data table for a player with 1000+ minutes. Toggle to "Per 90" view. Verify per-90 values display. Navigate to a player with < 360 minutes and verify per-90 stats are greyed out or show the threshold message.

---

### Feature 3: EWMA form curves

**What:** Compute an Exponentially Weighted Moving Average of match-by-match fantasy points (or match ratings from Feature 4) for each player. Store two EWMA values: a reactive (5-match equivalent) and a baseline (15-match equivalent) curve.

**Where to change (database-dorkinians):** Add a post-processing step in the seeding script that runs after match ratings are computed. For each player, fetch their MatchDetail nodes ordered by date, compute EWMA values, and store results on the Player node.

**Schema change in `config/schema.js` - add to `TBL_Players.properties`:**

```js
formCurrent: { type: 'number', required: false },         // reactive EWMA (alpha=0.30)
formBaseline: { type: 'number', required: false },         // stable EWMA (alpha=0.12)
formTrend: { type: 'string', required: false },            // 'rising', 'stable', 'declining'
formPeak: { type: 'number', required: false },             // highest reactive EWMA this season
formPeakWeek: { type: 'string', required: false }          // week when peak occurred
```

**Also create a new array property or separate nodes for the full time series (needed for the chart):**

```js
// Option A: Store as JSON string on Player node
formHistory: { type: 'string', required: false }  // JSON array of {week, rawFtp, ewmaReactive, ewmaBaseline}

// Option B: Add ewmaReactive and ewmaBaseline to each MatchDetail node
// In TBL_MatchDetails.properties, add:
ewmaReactive: { type: 'number', required: false },
ewmaBaseline: { type: 'number', required: false }
```

Option B is preferred as it keeps data on the individual match nodes and avoids large JSON blobs.

**EWMA calculation logic:**

```js
const ALPHA_REACTIVE = 0.30;   // ~5-match window
const ALPHA_BASELINE = 0.12;   // ~15-match window
const SQUAD_AVG_FTP = 5.5;     // initialisation value - adjust to actual squad average

function computeEWMA(matchesOrderedByDate) {
  let ewmaReactive = SQUAD_AVG_FTP;
  let ewmaBaseline = SQUAD_AVG_FTP;
  
  return matchesOrderedByDate.map(match => {
    const score = match.matchRating || match.fantasyPoints || SQUAD_AVG_FTP;
    ewmaReactive = ALPHA_REACTIVE * score + (1 - ALPHA_REACTIVE) * ewmaReactive;
    ewmaBaseline = ALPHA_BASELINE * score + (1 - ALPHA_BASELINE) * ewmaBaseline;
    return {
      matchId: match.id,
      rawScore: score,
      ewmaReactive: Math.round(ewmaReactive * 10) / 10,
      ewmaBaseline: Math.round(ewmaBaseline * 10) / 10
    };
  });
}

function determineTrend(formHistory) {
  if (formHistory.length < 4) return 'stable';
  const current = formHistory[formHistory.length - 1].ewmaReactive;
  const threeAgo = formHistory[formHistory.length - 4].ewmaReactive;
  const diff = current - threeAgo;
  if (diff > 0.3) return 'rising';
  if (diff < -0.3) return 'declining';
  return 'stable';
}
```

**Where to display (V3-dorkinians-website):**

| Display location | Implementation |
|---|---|
| Player Stats → new "Form" section | Place immediately after Key Performance Stats. Contains: (1) dual-line Recharts `ComposedChart` with reactive line (yellow #E8C547), baseline line (green #5DCAA5), and raw score scatter dots (grey). (2) Three summary cards below: "Current form" (reactive EWMA value + trend arrow), "Season avg" (mean FTP), "Peak form" (highest reactive + week). Annotate "golden cross" where reactive crosses above baseline. |
| Player Stats → Key Performance Stats | Add compact "Form: 7.8 ↑" indicator card alongside existing App/Mins/Goals cards |
| Team Stats → Top Players | Add "Best current form" as dropdown option |
| Chatbot | Support "Who's in the best form?" and "What's my current form?" |

**Recharts implementation pattern for the form curve chart:**

```tsx
'use client';
import { ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// data shape: { week: string, rawScore: number, ewmaReactive: number, ewmaBaseline: number }
// Find golden cross points: where ewmaReactive crosses above ewmaBaseline

<ResponsiveContainer width="100%" height={220}>
  <ComposedChart data={formData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
    <XAxis dataKey="week" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
    <YAxis domain={[2, 10]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
    <Tooltip />
    <Scatter dataKey="rawScore" fill="rgba(255,255,255,0.2)" r={3} />
    <Line type="monotone" dataKey="ewmaBaseline" stroke="#5DCAA5" strokeWidth={1.5} dot={false} opacity={0.5} />
    <Line type="monotone" dataKey="ewmaReactive" stroke="#E8C547" strokeWidth={2.5} dot={false} />
  </ComposedChart>
</ResponsiveContainer>
```

**Tests to write:**

- **Unit tests (Jest):**
  - `computeEWMA([{fantasyPoints: 6}, {fantasyPoints: 8}, {fantasyPoints: 4}])` - verify reactive responds more strongly to recent values than baseline
  - Verify initialisation: first EWMA value is pulled toward SQUAD_AVG_FTP
  - `determineTrend` returns 'rising' when latest 3 matches show upward movement > 0.3
  - `determineTrend` returns 'declining' for downward movement > 0.3
  - `determineTrend` returns 'stable' for movement within ±0.3
  - `determineTrend` returns 'stable' when fewer than 4 matches
- **E2E test (Playwright):** Navigate to Player Stats for a player with 10+ matches. Verify the Form section renders with a chart containing lines. Verify the summary cards show numeric values and a trend indicator.

---

### Feature 5: Streak detection

**What:** Detect consecutive-match streaks for each player across multiple categories. Track current active streak and season-best streak.

**Where to change (database-dorkinians):** Add a post-processing step in the seeding script. For each player, fetch MatchDetail nodes ordered by date, then compute streaks.

**Schema change in `config/schema.js` - add to `TBL_Players.properties`:**

```js
// Current active streaks
currentScoringStreak: { type: 'integer', required: false },
currentAssistStreak: { type: 'integer', required: false },
currentGoalInvolvementStreak: { type: 'integer', required: false },
currentCleanSheetStreak: { type: 'integer', required: false },
currentAppearanceStreak: { type: 'integer', required: false },
currentStartStreak: { type: 'integer', required: false },
currentFullMatchStreak: { type: 'integer', required: false },
currentMomStreak: { type: 'integer', required: false },
currentDisciplineStreak: { type: 'integer', required: false },  // no cards
currentWinStreak: { type: 'integer', required: false },

// Season-best streaks
seasonBestScoringStreak: { type: 'integer', required: false },
seasonBestAssistStreak: { type: 'integer', required: false },
seasonBestCleanSheetStreak: { type: 'integer', required: false },
seasonBestAppearanceStreak: { type: 'integer', required: false },
seasonBestDisciplineStreak: { type: 'integer', required: false },
seasonBestWinStreak: { type: 'integer', required: false },

// All-time best streaks
allTimeBestScoringStreak: { type: 'integer', required: false },
allTimeBestAppearanceStreak: { type: 'integer', required: false },
allTimeBestCleanSheetStreak: { type: 'integer', required: false },
allTimeBestWinStreak: { type: 'integer', required: false }
```

**Streak detection logic:**

```js
function detectStreaks(matchesOrderedByDate, conditionFn) {
  let currentStreak = 0;
  let longestStreak = 0;
  
  for (const match of matchesOrderedByDate) {
    if (conditionFn(match)) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  return { current: currentStreak, longest: longestStreak };
}

// Streak conditions:
const streakConditions = {
  scoring:         (m) => (m.goals || 0) >= 1,
  assists:         (m) => (m.assists || 0) >= 1,
  goalInvolvement: (m) => ((m.goals || 0) + (m.assists || 0)) >= 1,
  cleanSheet:      (m) => (m.cleanSheets || 0) >= 1 && (m.class === 'GK' || m.class === 'DEF'),
  appearance:      (m) => (m.minutes || 0) > 0,  // for this one, iterate ALL fixture dates and check if player was present
  start:           (m) => m.started === true,
  fullMatch:       (m) => (m.minutes || 0) >= 85,
  mom:             (m) => (m.mom || 0) >= 1,
  discipline:      (m) => (m.yellowCards || 0) === 0 && (m.redCards || 0) === 0,
  win:             (m) => m.fixtureResult === 'W'  // need to join with Fixture node to get result
};
```

**Note on appearance streaks:** Unlike other streaks which only consider matches the player appeared in, the appearance streak must check against ALL fixtures for the player's primary team to detect absences. If the player's team played on a date and the player was not in the squad, the appearance streak breaks.

**Where to display (V3-dorkinians-website):**

| Display location | Implementation |
|---|---|
| Player Stats → new "Streaks" section | Place after Form section. Show active streaks as prominent cards with streak count in a coloured circle. When a streak is approaching a club/personal record, show a progress bar and "X more to beat the record" text. Show inactive streaks (count=0) greyed out with personal best. Below, show a 2x2 grid of season-best streaks with "Active now" indicator for ongoing ones. |
| Homepage | Pre-matchday "Streaks at risk" banner showing active streaks that could be extended |
| Team Stats | "Longest current streak" per category per team |
| Chatbot | Support "What's my longest scoring streak?" and "Who has the longest appearance streak?" |

**Tests to write:**

- **Unit tests (Jest):**
  - `detectStreaks([{goals:1},{goals:0},{goals:1},{goals:1},{goals:1}], conditions.scoring)` → `{ current: 3, longest: 3 }`
  - `detectStreaks([{goals:1},{goals:1},{goals:1},{goals:0}], conditions.scoring)` → `{ current: 0, longest: 3 }`
  - Empty array returns `{ current: 0, longest: 0 }`
  - Clean sheet streak only counts GK/DEF matches
  - Discipline streak counts consecutive matches without any card
- **Integration test (Jest):** Seed 10 test matches for a player. Run streak detection. Query Neo4j to verify streak properties are stored correctly on the Player node.
- **E2E test (Playwright):** Navigate to Player Stats for a player with known active streaks. Verify the Streaks section renders with correct counts. Verify the progress bar appears for streaks near records.

---

## Phase 3: Records wall and graph insights

---

### Feature 6: Records wall

**What:** A records page documenting all-time club records across measurable categories. Only include records where we have data. Display beneath Club Awards on the same page, renamed to "Club Awards and Records".

**Where to change (V3-dorkinians-website):**

1. Rename the Club Awards sub-page to "Club Awards and Records"
2. Update navigation labels in the Club Info section (both the tab/swipe navigation and the Settings page navigation tree)
3. Add a "Records" section below the existing Club Awards content

**Where to change (database-dorkinians):** Add a post-processing step that computes records and stores them. Create a new `ClubRecord` node type or store as properties on `SiteDetail`.

**Schema change in `config/schema.js`:**

```js
// New node type
ClubRecord: {
  nodeType: 'ClubRecord',
  properties: {
    id: { type: 'string', required: true },
    category: { type: 'string', required: true },        // 'individual', 'team', 'club'
    recordName: { type: 'string', required: true },       // 'Most appearances'
    recordValue: { type: 'number', required: true },
    recordValueDisplay: { type: 'string', required: false }, // '203' or '9-0' for display
    holderName: { type: 'string', required: false },       // 'Sam Slade'
    holderTeam: { type: 'string', required: false },       // '1st XI'
    season: { type: 'string', required: false },           // '2023/24'
    additionalContext: { type: 'string', required: false }, // 'vs Old Tiffinians'
    currentChallenger: { type: 'string', required: false }, // player name approaching record
    challengerValue: { type: 'number', required: false }
  },
  idPattern: 'record_{category}_{recordNameSlug}',
  constraints: ['CREATE CONSTRAINT clubrecord_id IF NOT EXISTS FOR (cr:ClubRecord) REQUIRE cr.id IS UNIQUE']
}
```

**Records to compute (individual - data available from Player and MatchDetail nodes):**

```js
const individualRecords = [
  { name: 'Most appearances', query: 'ORDER BY p.appearances DESC LIMIT 1' },
  { name: 'Most career goals', query: 'ORDER BY p.goals DESC LIMIT 1' },
  { name: 'Most career assists', query: 'ORDER BY p.assists DESC LIMIT 1' },
  { name: 'Most MoM awards', query: 'ORDER BY p.mom DESC LIMIT 1' },
  { name: 'Most clean sheets', query: 'WHERE p.mostCommonPosition IN ["GK","DEF"] ORDER BY p.cleanSheets DESC LIMIT 1' },
  { name: 'Most seasons played', query: 'ORDER BY p.numberSeasonsPlayedFor DESC LIMIT 1' },
  { name: 'Most teams played for', query: 'ORDER BY p.numberTeamsPlayedFor DESC LIMIT 1' },
  { name: 'Highest single-match FTP', source: 'MatchDetail', query: 'ORDER BY md.fantasyPoints DESC LIMIT 1' },
  { name: 'Most goals in a single match', source: 'MatchDetail', query: 'ORDER BY md.goals DESC LIMIT 1' },
  // Season records require grouping MatchDetails by season per player:
  { name: 'Most goals in a season', computed: true },
  { name: 'Most assists in a season', computed: true },
  { name: 'Most appearances in a season', computed: true },
  // Streak records (from Phase 2):
  { name: 'Longest scoring streak', source: 'Player', query: 'ORDER BY p.allTimeBestScoringStreak DESC LIMIT 1' },
  { name: 'Longest appearance streak', source: 'Player', query: 'ORDER BY p.allTimeBestAppearanceStreak DESC LIMIT 1' },
  { name: 'Longest clean sheet streak', source: 'Player', query: 'ORDER BY p.allTimeBestCleanSheetStreak DESC LIMIT 1' },
];
```

**Records to compute (team - from Fixture nodes):**

```js
const teamRecords = [
  { name: 'Biggest win', computed: true },                // highest goal difference in a single fixture
  { name: 'Most goals in a match', computed: true },      // highest dorkiniansGoals
  { name: 'Longest winning streak', computed: true },     // consecutive W results per team
  { name: 'Longest unbeaten run', computed: true },       // consecutive W or D per team
  { name: 'Most goals in a season (team)', computed: true },
  { name: 'Best defensive season', computed: true },      // fewest conceded
];
```

**Records "under threat" detection:** After computing all records, scan current active streaks and current season totals. If a player's current value is within 80% of a record, flag the `currentChallenger` and `challengerValue` fields.

**Frontend implementation (V3-dorkinians-website):**

Create a `RecordsSection` component that renders below the existing Club Awards content. Structure:
- Section header: "Records" (white bold, matching existing section header style)
- Two card groups: "Individual Records" and "Team Records"
- Each record is a row with: record name (white), holder name (yellow #E8C547, clickable → navigates to player stats), value (white bold, right-aligned)
- Records "under threat" get a highlighted border (rgba(232,197,71,0.2)) with a "⚠ Under threat - [Challenger] on [Value]" line below

**Tests to write:**

- **Unit test (Jest):** Record computation correctly identifies the holder for "Most appearances" from a test dataset. "Biggest win" correctly calculates from goal difference. "Under threat" detection flags when current value >= 80% of record.
- **Integration test (Jest):** After seeding test data, query ClubRecord nodes and verify correct values.
- **E2E test (Playwright):** Navigate to Club Info → Club Awards and Records. Verify the page title has changed from "Club Awards". Scroll to Records section and verify records display with correct formatting. Click a player name and verify navigation to their Player Stats page.

---

### Feature 7: Neo4j graph algorithm insights

**Important prerequisite:** Neo4j Aura GDS requires the **Graph Analytics plugin** enabled on an AuraDB Professional instance. GDS is NOT available on the AuraDB Free tier. Check current tier before implementing. If on Free tier, this feature should be deferred until an upgrade.

**What:** Run graph algorithms on the existing PLAYED_WITH relationship network to surface insights as numbers and narrative text (NOT as graph visualisations). Four types of insight: partnership win rates, player impact deltas, PageRank influence scores, and Louvain community detection.

**Where to change (database-dorkinians):** Add a new script file (e.g. `scripts/compute-graph-insights.js`) that runs after the main seeding completes. This script projects the PLAYED_WITH graph, runs algorithms, and writes results back to Player nodes.

#### 7a. Partnership win rates (pure Cypher, no GDS required)

This can be implemented immediately regardless of Aura tier.

**Cypher query to compute partnership stats:**

```cypher
// For each pair of players who played together, compute win rate
MATCH (p1:Player)-[:PLAYED_IN]->(md1:MatchDetail)<-[:HAS_MATCH_DETAILS]-(f:Fixture)-[:HAS_MATCH_DETAILS]->(md2:MatchDetail)<-[:PLAYED_IN]-(p2:Player)
WHERE p1.id < p2.id  // avoid duplicate pairs
  AND f.result IS NOT NULL
WITH p1, p2,
     count(f) AS matchesTogether,
     sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) AS winsTogether,
     sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) AS drawsTogether
WHERE matchesTogether >= 5  // minimum threshold
RETURN p1.playerName AS player1, p2.playerName AS player2,
       matchesTogether,
       winsTogether,
       round(toFloat(winsTogether) / matchesTogether * 100, 1) AS winRate
ORDER BY winRate DESC
```

Store the top partnerships per player on the Player node or create `BEST_PARTNERSHIP` relationships.

#### 7b. Player impact delta (pure Cypher, no GDS required)

```cypher
// Team win rate WITH a player vs WITHOUT
MATCH (p:Player)-[:PLAYED_IN]->(md:MatchDetail)<-[:HAS_MATCH_DETAILS]-(f:Fixture)
WHERE f.team = p.mostPlayedForTeam  // filter to their primary team
WITH p, f.team AS team,
     count(f) AS gamesPlayed,
     sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) AS winsWithPlayer
WITH p, team, gamesPlayed, winsWithPlayer,
     round(toFloat(winsWithPlayer) / gamesPlayed * 100, 1) AS winRateWith

// Get total team stats
MATCH (f2:Fixture)
WHERE f2.team = team AND f2.result IS NOT NULL
WITH p, team, gamesPlayed, winRateWith,
     count(f2) AS totalTeamGames,
     sum(CASE WHEN f2.result = 'W' THEN 1 ELSE 0 END) AS totalTeamWins

WITH p, team, gamesPlayed, winRateWith, totalTeamGames, totalTeamWins,
     totalTeamGames - gamesPlayed AS gamesWithout,
     totalTeamWins - (winRateWith * gamesPlayed / 100) AS winsWithout

WHERE gamesWithout > 3  // minimum sample without player
RETURN p.playerName,
       winRateWith,
       round(toFloat(winsWithout) / gamesWithout * 100, 1) AS winRateWithout,
       winRateWith - round(toFloat(winsWithout) / gamesWithout * 100, 1) AS impactDelta
ORDER BY impactDelta DESC
```

**Schema change - add to `TBL_Players.properties`:**

```js
// Partnership insights
bestPartnerName: { type: 'string', required: false },
bestPartnerWinRate: { type: 'number', required: false },
bestPartnerMatches: { type: 'integer', required: false },

// Impact delta
impactDelta: { type: 'number', required: false },        // percentage points
impactWinRateWith: { type: 'number', required: false },
impactWinRateWithout: { type: 'number', required: false },
impactSampleWith: { type: 'integer', required: false },
impactSampleWithout: { type: 'integer', required: false }
```

#### 7c. GDS algorithms (requires Graph Analytics plugin)

**Only implement if GDS is available.** First check with:

```cypher
RETURN gds.version()
```

If this errors, skip 7c and 7d. The partnership and impact features (7a, 7b) work without GDS.

**PageRank for squad influence:**

```js
// In compute-graph-insights.js
async function computePageRank(session) {
  // Project the graph
  await session.run(`
    MATCH (p1:Player)-[r:PLAYED_WITH]->(p2:Player)
    WHERE r.timesPlayed IS NOT NULL
    WITH gds.graph.project('squad-network', p1, p2, {
      relationshipProperties: r { .timesPlayed }
    }) AS g
    RETURN g.graphName, g.nodeCount, g.relationshipCount
  `);

  // Run PageRank and write back
  await session.run(`
    CALL gds.pageRank.write('squad-network', {
      writeProperty: 'squadInfluence',
      relationshipWeightProperty: 'timesPlayed',
      maxIterations: 20,
      dampingFactor: 0.85
    })
  `);

  // Clean up
  await session.run(`CALL gds.graph.drop('squad-network')`);
}
```

**Louvain community detection:**

```js
async function computeCommunities(session) {
  await session.run(`
    MATCH (p1:Player)-[r:PLAYED_WITH]->(p2:Player)
    WITH gds.graph.project('squad-communities', p1, p2, {
      relationshipProperties: r { .timesPlayed }
    }) AS g
    RETURN g.graphName
  `);

  await session.run(`
    CALL gds.louvain.write('squad-communities', {
      writeProperty: 'communityId',
      relationshipWeightProperty: 'timesPlayed'
    })
  `);

  await session.run(`CALL gds.graph.drop('squad-communities')`);
}
```

**Schema change - add to `TBL_Players.properties` (only if GDS available):**

```js
squadInfluence: { type: 'number', required: false },       // PageRank score
squadInfluenceRank: { type: 'integer', required: false },   // rank among all players
communityId: { type: 'integer', required: false }            // Louvain community ID
```

**Where to display (V3-dorkinians-website):**

| Display location | What to show |
|---|---|
| Player Stats → new "Partnerships" section (after Streaks) | Top 5 partners by win rate. "With [Name]: X% win rate in Y matches". Show chemistry delta if positive. |
| Player Stats → new "Impact" section (after Partnerships) | Hero stat: "The [Team] win X% more when [Player] plays". Show with/without comparison. Display sample sizes. Add caveat text when "without" sample < 10. |
| Player Stats → data table | Add rows: "Best partner", "Impact delta", "Squad influence rank" (if GDS available) |
| Club Stats → new "Squad Backbone" section | Top 10 most connected players by PageRank (if GDS available) |
| Chatbot | "Who's my best partner?", "What's my impact on the team?", "Who's the most connected player?" |

**Tests to write:**

- **Unit test (Jest):** Partnership win rate calculation correctly computes from test fixture data. Impact delta correctly handles cases where "without" sample is very small (< 3, should return null).
- **Integration test (Jest):** Seed test data with known partnerships. Run partnership computation. Verify stored values match expected calculations.
- **E2E test (Playwright):** Navigate to Player Stats. Verify Partnerships section shows partner names and win rates. Verify Impact section shows the delta value with sample sizes.

---

## Phase 4: Season Wrapped

---

### Feature 8: Season Wrapped

**What:** An end-of-season feature generating personalised shareable summary cards for each player. Primary sharing target is WhatsApp. Each card includes a URL back to the full site.

**Where to change (V3-dorkinians-website):**

1. Create a new route: `app/wrapped/[playerSlug]/page.tsx` - the full interactive wrapped experience with slide transitions
2. Create API route: `app/api/wrapped/[playerSlug]/route.ts` - returns computed wrapped data as JSON
3. Create OG image route: `app/api/wrapped/[playerSlug]/og/[slideNumber]/route.ts` - returns PNG images for sharing
4. Add `html-to-image` package: `npm install html-to-image`

**Wrapped data structure (computed server-side):**

```ts
interface WrappedData {
  playerName: string;
  season: string;
  // Slide 1: Season overview
  totalMatches: number;
  totalGoals: number;
  totalAssists: number;
  totalMom: number;
  // Slide 2: Percentile
  matchesPercentile: number;  // "more matches than X% of the club"
  // Slide 3: Best month
  bestMonth: string;
  bestMonthGoals: number;
  bestMonthAssists: number;
  // Slide 4: Teammate
  topPartnerName: string;
  topPartnerMatches: number;
  topPartnerWinRate: number;
  // Slide 5: Player type
  playerType: string;  // e.g. "The Creator", "The Ironman"
  playerTypeReason: string;
  // Slide 6: Peak match
  peakMatchRating: number;
  peakMatchOpposition: string;
  peakMatchGoals: number;
  peakMatchAssists: number;
  // Slide 7: Streak (conditional - only if longestStreak >= 3)
  longestStreakType: string | null;
  longestStreakValue: number | null;
  // Slide 8: Distance
  totalDistance: number;
  distanceEquivalent: string;  // "that's London to Edinburgh"
  // Slide 9: Summary card (always last)
  wrappedUrl: string;
}
```

**Player type classification logic:**

```ts
function classifyPlayerType(player: WrappedData, percentiles: Record<string, number>): { type: string; reason: string } {
  // Check in priority order
  if (percentiles.goalsPer90 >= 80) return { type: 'The Sharpshooter', reason: `Top ${100 - percentiles.goalsPer90}% for goals per 90` };
  if (percentiles.assistsPer90 >= 80) return { type: 'The Creator', reason: `Top ${100 - percentiles.assistsPer90}% for assists per 90` };
  if (percentiles.appearances >= 90 && percentiles.minutes >= 90) return { type: 'The Ironman', reason: 'Top 10% for both appearances and minutes' };
  if (percentiles.cleanSheetsPer90 >= 80) return { type: 'The Brick Wall', reason: `Top ${100 - percentiles.cleanSheetsPer90}% for clean sheets per 90` };
  if (percentiles.goalsPer90 >= 70 && percentiles.assistsPer90 >= 70) return { type: 'The All-Rounder', reason: 'Top 30% for both goals and assists per 90' };
  if (player.numberTeamsPlayedFor >= 4) return { type: 'The Journeyman', reason: `Played for ${player.numberTeamsPlayedFor} different teams` };
  // Default
  return { type: 'The Squad Player', reason: 'A reliable member of the squad' };
}
```

**Interactive wrapped page (`app/wrapped/[playerSlug]/page.tsx`):**

- Use Framer Motion `AnimatePresence` for horizontal slide transitions (already in the stack)
- Progress dots at top (like Instagram Stories)
- Swipe/tap navigation on mobile
- Each slide is a full-viewport-height component receiving the relevant WrappedData fields
- "Share this slide" button on each slide
- Design: use the Dorkinians gradient background, yellow accents, same card style as the main app
- Every slide has `dorkiniansfcstats.co.uk/wrapped/[player-slug]` URL at the bottom

**Sharing implementation:**

```ts
import { toBlob } from 'html-to-image';

async function shareSlide(slideRef: HTMLDivElement, playerName: string, slideNumber: number) {
  const blob = await toBlob(slideRef, { pixelRatio: 2, backgroundColor: '#1c2418' });
  if (!blob) return;
  
  const file = new File([blob], `${playerName}-wrapped-${slideNumber}.png`, { type: 'image/png' });
  
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: `${playerName} - Dorkinians Wrapped`,
      text: `Check out my season stats! dorkiniansfcstats.co.uk/wrapped/${playerSlug}`
    });
  } else {
    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

**Homepage integration:**

- At the end of the season, add a banner on the homepage: "Season Wrapped 2025/26 is live! See your season story →" linking to `/wrapped/[current-player-slug]`
- Generate a WhatsApp-friendly text block on the wrapped page for easy copy-paste sharing

**Tests to write:**

- **Unit tests (Jest):** `classifyPlayerType` returns correct types for edge cases (high goals = Sharpshooter, high assists = Creator, both high = All-Rounder). Percentile calculations are correct. WrappedData computation handles players with minimal data gracefully (e.g. only 2 appearances).
- **Integration test (Jest):** API route `/api/wrapped/[playerSlug]` returns valid JSON with all required fields for a known test player.
- **E2E tests (Playwright):**
  - Navigate to `/wrapped/[test-player]`. Verify slides render and transitions work.
  - Tap through all slides. Verify progress dots update.
  - Verify the URL appears on every slide.
  - Verify the "Share" button is present (do not test native share dialog).
  - Navigate to the wrapped page for a player with very few appearances. Verify it handles gracefully without errors.

---

## Phase 5: Achievement badges

---

### Feature 9: Achievement badges

**What:** A persistent badge system earned automatically from stats data. Displayed on player profiles. No hidden badges - all badges are visible with progress tracking.

**Where to change (database-dorkinians):** Add a badge computation step to the seeding script. For each player, evaluate all badge conditions and store earned badges.

**Where to change (V3-dorkinians-website):**

1. Player Stats page - extend the existing "Captaincies, Awards and Achievements" section (last section) with a "Badges" sub-section
2. Player Stats page - add a compact badge bar near the player name showing 3-5 most prestigious earned badges
3. Club Info → Club Awards and Records page - add a "Badge Leaderboard" section showing players with most badges

**Badge storage schema - add to `config/schema.js`:**

```js
// New node type
PlayerBadge: {
  nodeType: 'PlayerBadge',
  properties: {
    id: { type: 'string', required: true },          // 'badge_{playerSlug}_{badgeId}'
    playerName: { type: 'string', required: true },
    badgeId: { type: 'string', required: true },      // 'goalscorer_gold'
    badgeName: { type: 'string', required: true },    // 'Goalscorer'
    badgeCategory: { type: 'string', required: true }, // 'goals', 'appearances', 'assists', 'defence', 'performance', 'special'
    tier: { type: 'string', required: true },          // 'bronze', 'silver', 'gold', 'diamond'
    earnedDate: { type: 'string', required: false },
    description: { type: 'string', required: false }
  },
  idPattern: 'badge_{playerSlug}_{badgeId}',
  constraints: ['CREATE CONSTRAINT playerbadge_id IF NOT EXISTS FOR (pb:PlayerBadge) REQUIRE pb.id IS UNIQUE']
}

// Also add to Player node:
// totalBadges: { type: 'integer', required: false },
// highestBadgeTier: { type: 'string', required: false }  // highest tier achieved
```

**Relationship:**
```js
HAS_BADGE: {
  from: 'Player',
  to: 'PlayerBadge',
  type: 'HAS_BADGE',
  properties: {}
}
```

**Complete badge catalogue with conditions:**

```js
const BADGE_DEFINITIONS = {
  // ==================== APPEARANCE BADGES ====================
  club_stalwart: {
    name: 'Club Stalwart',
    category: 'appearances',
    tiers: {
      bronze:  { threshold: 25,  description: 'Make 25 appearances' },
      silver:  { threshold: 50,  description: 'Make 50 appearances' },
      gold:    { threshold: 100, description: 'Make 100 appearances' },
      diamond: { threshold: 200, description: 'Make 200 appearances' },
    },
    evaluate: (player) => player.appearances || 0
  },
  season_regular: {
    name: 'Season Regular',
    category: 'appearances',
    tiers: {
      bronze:  { threshold: 15, description: 'Play 15 matches in a season' },
      silver:  { threshold: 20, description: 'Play 20 matches in a season' },
      gold:    { threshold: 25, description: 'Play 25 matches in a season' },
      diamond: { threshold: 30, description: 'Play 30+ matches in a season' },
    },
    evaluate: (player) => player.maxAppsInSeason || 0  // compute from per-season data
  },
  ever_present: {
    name: 'Ever Present',
    category: 'appearances',
    tiers: {
      bronze:  { threshold: 5,  description: '5 consecutive appearances' },
      silver:  { threshold: 15, description: '15 consecutive appearances' },
      gold:    { threshold: 25, description: '25 consecutive appearances' },
      diamond: { threshold: 40, description: '40+ consecutive appearances' },
    },
    evaluate: (player) => player.allTimeBestAppearanceStreak || 0
  },
  multi_team: {
    name: 'Multi-Team Player',
    category: 'appearances',
    tiers: {
      bronze:  { threshold: 2, description: 'Play for 2 different XIs' },
      silver:  { threshold: 3, description: 'Play for 3 different XIs' },
      gold:    { threshold: 5, description: 'Play for 5 different XIs' },
      diamond: { threshold: 7, description: 'Play for all 7 XIs' },
    },
    evaluate: (player) => player.numberTeamsPlayedFor || 0
  },
  veteran: {
    name: 'Veteran',
    category: 'appearances',
    tiers: {
      bronze:  { threshold: 3, description: 'Play for 3 seasons' },
      silver:  { threshold: 5, description: 'Play for 5 seasons' },
      gold:    { threshold: 7, description: 'Play for 7 seasons' },
      diamond: { threshold: 10, description: 'Play for 10 seasons' },
    },
    evaluate: (player) => player.numberSeasonsPlayedFor || 0
  },

  // ==================== GOAL-SCORING BADGES ====================
  goalscorer: {
    name: 'Goalscorer',
    category: 'goals',
    tiers: {
      bronze:  { threshold: 5,   description: 'Score 5 goals' },
      silver:  { threshold: 25,  description: 'Score 25 goals' },
      gold:    { threshold: 50,  description: 'Score 50 goals' },
      diamond: { threshold: 100, description: 'Score 100 goals' },
    },
    evaluate: (player) => player.goals || 0
  },
  season_scorer: {
    name: 'Season Scorer',
    category: 'goals',
    tiers: {
      bronze:  { threshold: 5,  description: 'Score 5 goals in a season' },
      silver:  { threshold: 10, description: 'Score 10 goals in a season' },
      gold:    { threshold: 15, description: 'Score 15 goals in a season' },
      diamond: { threshold: 20, description: 'Score 20+ goals in a season' },
    },
    evaluate: (player) => player.maxGoalsInSeason || 0
  },
  hat_trick_hero: {
    name: 'Hat-Trick Hero',
    category: 'goals',
    tiers: {
      bronze:  { threshold: 1,  description: 'Score a hat-trick' },
      silver:  { threshold: 3,  description: 'Score 3 hat-tricks' },
      gold:    { threshold: 5,  description: 'Score 5 hat-tricks' },
      diamond: { threshold: 10, description: 'Score 10 hat-tricks' },
    },
    evaluate: (player) => player.hatTrickCount || 0  // count MatchDetails where goals >= 3
  },
  hot_streak: {
    name: 'Hot Streak',
    category: 'goals',
    tiers: {
      bronze:  { threshold: 3,  description: 'Score in 3 consecutive matches' },
      silver:  { threshold: 5,  description: 'Score in 5 consecutive matches' },
      gold:    { threshold: 7,  description: 'Score in 7 consecutive matches' },
      diamond: { threshold: 10, description: 'Score in 10 consecutive matches' },
    },
    evaluate: (player) => player.allTimeBestScoringStreak || 0
  },
  poacher: {
    name: 'Poacher',
    category: 'goals',
    tiers: {
      bronze:  { threshold: 0.3, description: '0.3+ goals per 90 (min 360 mins)' },
      silver:  { threshold: 0.5, description: '0.5+ goals per 90' },
      gold:    { threshold: 0.7, description: '0.7+ goals per 90' },
      diamond: { threshold: 1.0, description: '1.0+ goals per 90' },
    },
    evaluate: (player) => (player.minutes >= 360) ? player.goalsPer90 : 0
  },

  // ==================== ASSIST BADGES ====================
  provider: {
    name: 'Provider',
    category: 'assists',
    tiers: {
      bronze:  { threshold: 5,  description: 'Provide 5 assists' },
      silver:  { threshold: 15, description: 'Provide 15 assists' },
      gold:    { threshold: 30, description: 'Provide 30 assists' },
      diamond: { threshold: 50, description: 'Provide 50 assists' },
    },
    evaluate: (player) => player.assists || 0
  },
  playmaker: {
    name: 'Playmaker',
    category: 'assists',
    tiers: {
      bronze:  { threshold: 0.2, description: '0.2+ assists per 90 (min 360 mins)' },
      silver:  { threshold: 0.3, description: '0.3+ assists per 90' },
      gold:    { threshold: 0.5, description: '0.5+ assists per 90' },
      diamond: { threshold: 0.7, description: '0.7+ assists per 90' },
    },
    evaluate: (player) => (player.minutes >= 360) ? player.assistsPer90 : 0
  },

  // ==================== DEFENSIVE BADGES ====================
  clean_sheet_king: {
    name: 'Clean Sheet King',
    category: 'defence',
    tiers: {
      bronze:  { threshold: 5,  description: 'Keep 5 clean sheets' },
      silver:  { threshold: 15, description: 'Keep 15 clean sheets' },
      gold:    { threshold: 30, description: 'Keep 30 clean sheets' },
      diamond: { threshold: 50, description: 'Keep 50 clean sheets' },
    },
    evaluate: (player) => player.cleanSheets || 0
  },
  brick_wall: {
    name: 'Brick Wall',
    category: 'defence',
    tiers: {
      bronze:  { threshold: 3,  description: '3 consecutive clean sheets' },
      silver:  { threshold: 5,  description: '5 consecutive clean sheets' },
      gold:    { threshold: 7,  description: '7 consecutive clean sheets' },
      diamond: { threshold: 10, description: '10 consecutive clean sheets' },
    },
    evaluate: (player) => player.allTimeBestCleanSheetStreak || 0
  },
  shot_stopper: {
    name: 'Shot Stopper',
    category: 'defence',
    tiers: {
      bronze:  { threshold: 20,  description: 'Make 20 saves' },
      silver:  { threshold: 50,  description: 'Make 50 saves' },
      gold:    { threshold: 100, description: 'Make 100 saves' },
      diamond: { threshold: 200, description: 'Make 200 saves' },
    },
    evaluate: (player) => player.saves || 0
  },
  penalty_saver: {
    name: 'Penalty Saver',
    category: 'defence',
    tiers: {
      bronze:  { threshold: 1,  description: 'Save 1 penalty' },
      silver:  { threshold: 3,  description: 'Save 3 penalties' },
      gold:    { threshold: 5,  description: 'Save 5 penalties' },
      diamond: { threshold: 10, description: 'Save 10 penalties' },
    },
    evaluate: (player) => player.penaltiesSaved || 0
  },

  // ==================== PERFORMANCE BADGES ====================
  man_of_the_match: {
    name: 'Man of the Match',
    category: 'performance',
    tiers: {
      bronze:  { threshold: 3,  description: 'Win 3 MoM awards' },
      silver:  { threshold: 8,  description: 'Win 8 MoM awards' },
      gold:    { threshold: 15, description: 'Win 15 MoM awards' },
      diamond: { threshold: 25, description: 'Win 25 MoM awards' },
    },
    evaluate: (player) => player.mom || 0
  },
  star_man: {
    name: 'Star Man',
    category: 'performance',
    tiers: {
      bronze:  { threshold: 2,  description: 'Earn 2 TOTW Star Man awards' },
      silver:  { threshold: 5,  description: 'Earn 5 Star Man awards' },
      gold:    { threshold: 10, description: 'Earn 10 Star Man awards' },
      diamond: { threshold: 20, description: 'Earn 20 Star Man awards' },
    },
    evaluate: (player) => player.totwStarManCount || 0  // count from IN_WEEKLY_TOTW where isStarMan=true
  },
  totw_regular: {
    name: 'TOTW Regular',
    category: 'performance',
    tiers: {
      bronze:  { threshold: 5,  description: 'Appear in 5 TOTWs' },
      silver:  { threshold: 15, description: 'Appear in 15 TOTWs' },
      gold:    { threshold: 30, description: 'Appear in 30 TOTWs' },
      diamond: { threshold: 50, description: 'Appear in 50 TOTWs' },
    },
    evaluate: (player) => player.totwAppearanceCount || 0  // count from IN_WEEKLY_TOTW
  },
  potm_winner: {
    name: 'Player of the Month',
    category: 'performance',
    tiers: {
      bronze:  { threshold: 1,  description: 'Win 1 Player of the Month' },
      silver:  { threshold: 3,  description: 'Win 3 Player of the Month' },
      gold:    { threshold: 6,  description: 'Win 6 Player of the Month' },
      diamond: { threshold: 10, description: 'Win 10 Player of the Month' },
    },
    evaluate: (player) => player.potmCount || 0  // count from IN_PLAYER_OF_THE_MONTH
  },
  peak_performer: {
    name: 'Peak Performer',
    category: 'performance',
    tiers: {
      bronze:  { threshold: 1,  description: '1 match rated 8.5+' },
      silver:  { threshold: 5,  description: '5 matches rated 8.5+' },
      gold:    { threshold: 15, description: '15 matches rated 8.5+' },
      diamond: { threshold: 30, description: '30 matches rated 8.5+' },
    },
    evaluate: (player) => player.matchesRated8Plus || 0
  },

  // ==================== SPECIAL BADGES ====================
  debut_scorer: {
    name: 'Debut Scorer',
    category: 'special',
    tiers: {
      gold: { threshold: 1, description: 'Score on your first ever appearance' },
    },
    evaluate: (player) => player.scoredOnDebut ? 1 : 0  // check first MatchDetail by date
  },
  the_traveller: {
    name: 'The Traveller',
    category: 'special',
    tiers: {
      bronze:  { threshold: 10, description: 'Play at 10 different away grounds' },
      silver:  { threshold: 15, description: 'Play at 15 different away grounds' },
      gold:    { threshold: 20, description: 'Play at 20 different away grounds' },
      diamond: { threshold: 30, description: 'Play at 30 different away grounds' },
    },
    evaluate: (player) => player.uniqueAwayGrounds || 0
  },
  globe_trotter: {
    name: 'Globe Trotter',
    category: 'special',
    tiers: {
      bronze:  { threshold: 200, description: 'Travel 200 miles to away matches' },
      silver:  { threshold: 500, description: 'Travel 500 miles' },
      gold:    { threshold: 1000, description: 'Travel 1,000 miles' },
      diamond: { threshold: 2000, description: 'Travel 2,000 miles' },
    },
    evaluate: (player) => player.distance || 0
  },
  penalty_perfect: {
    name: 'Penalty Perfect',
    category: 'special',
    tiers: {
      gold: { threshold: 1, description: 'Score 5+ penalties with 100% conversion' },
    },
    evaluate: (player) => (player.penaltiesScored >= 5 && player.penaltiesMissed === 0) ? 1 : 0
  },
  swiss_army_knife: {
    name: 'Swiss Army Knife',
    category: 'special',
    tiers: {
      gold: { threshold: 1, description: 'Play all 4 positions across your career' },
    },
    evaluate: (player) => {
      const positions = [player.gk, player.def, player.mid, player.fwd].filter(v => v && v > 0);
      return positions.length >= 4 ? 1 : 0;
    }
  },
  award_winner: {
    name: 'Award Winner',
    category: 'special',
    tiers: {
      bronze:  { threshold: 1, description: 'Win a club award' },
      silver:  { threshold: 3, description: 'Win 3 club awards' },
      gold:    { threshold: 5, description: 'Win 5 club awards' },
      diamond: { threshold: 10, description: 'Win 10 club awards' },
    },
    evaluate: (player) => player.clubAwardCount || 0  // count from HAS_CAPTAIN_AWARDS
  },
  weekend_warrior: {
    name: 'Weekend Warrior',
    category: 'special',
    tiers: {
      gold: { threshold: 1, description: 'Play 10+ matches across 2+ different XIs in a single season' },
    },
    evaluate: (player) => player.multiTeamSeasons || 0  // compute: seasons where player appeared for 2+ teams with 10+ total apps
  },
};
```

**Badge evaluation engine:**

```js
function evaluateAllBadges(player) {
  const earnedBadges = [];
  
  for (const [badgeId, definition] of Object.entries(BADGE_DEFINITIONS)) {
    const playerValue = definition.evaluate(player);
    
    // Find highest tier achieved
    const tierOrder = ['diamond', 'gold', 'silver', 'bronze'];
    for (const tier of tierOrder) {
      if (definition.tiers[tier] && playerValue >= definition.tiers[tier].threshold) {
        earnedBadges.push({
          badgeId: `${badgeId}_${tier}`,
          badgeName: definition.name,
          badgeCategory: definition.category,
          tier: tier,
          description: definition.tiers[tier].description
        });
        break;  // only award highest tier per badge
      }
    }
  }
  
  return earnedBadges;
}
```

**Badge progress tracking:** For badges not yet earned, calculate the next tier and progress percentage:

```js
function getBadgeProgress(player) {
  const progress = [];
  
  for (const [badgeId, definition] of Object.entries(BADGE_DEFINITIONS)) {
    const playerValue = definition.evaluate(player);
    const tierOrder = ['bronze', 'silver', 'gold', 'diamond'];
    
    // Find the next unachieved tier
    for (const tier of tierOrder) {
      if (definition.tiers[tier] && playerValue < definition.tiers[tier].threshold) {
        progress.push({
          badgeId: badgeId,
          badgeName: definition.name,
          nextTier: tier,
          currentValue: playerValue,
          targetValue: definition.tiers[tier].threshold,
          progressPercent: Math.round((playerValue / definition.tiers[tier].threshold) * 100),
          remaining: definition.tiers[tier].threshold - playerValue
        });
        break;
      }
    }
  }
  
  return progress;
}
```

**Frontend implementation (V3-dorkinians-website):**

**Badge display component:** Create a reusable `BadgeIcon` component that renders a circular badge with tier-specific colours:
- Bronze: background gradient `#D88A63 → #99603A`
- Silver: background gradient `#B4B2A9 → #73726c`
- Gold: background gradient `#C9A42A → #8B7020`
- Diamond: background gradient `#E8E6DE → #B4B2A9` with a subtle glow

**Layout on Player Stats "Captaincies, Awards and Achievements" section:**
1. "Badges" sub-header
2. "X of Y unlocked" progress bar
3. If recently earned badges exist, show "Recently unlocked" with the badge detail card (badge icon, name, description, date, tier label)
4. Badge grid grouped by category (Appearances, Goals, Assists, Defence, Performance, Special). Each badge is a circle. Earned badges show with tier colour. Unearned badges show as dashed outline with "[N] to go" or progress percentage.

**Badge bar near player name:** Show the 3-5 highest-tier earned badges as small (24px) coloured circles in a row next to the player name at the top of Player Stats. Gold/Diamond badges take priority.

**Club Awards and Records - Badge Leaderboard:**
- "Most badges earned" - top 10 players by total badge count
- "Most diamond badges" - top 5 players
- "Most gold badges" - top 5 players

**Tests to write:**

- **Unit tests (Jest):**
  - `evaluateAllBadges` for a player with 150 appearances → earns club_stalwart gold (not diamond)
  - `evaluateAllBadges` for a player with 0 goals → earns no goal badges
  - `evaluateAllBadges` for a player with 100 goals → earns goalscorer diamond
  - `getBadgeProgress` correctly calculates remaining for next tier
  - Hat-trick hero counts matches with goals >= 3 correctly
  - `poacher` badge requires minimum 360 minutes (player with 2 goals in 100 mins gets no badge)
  - `swiss_army_knife` requires all 4 positions with count > 0
  - `penalty_perfect` requires both 5+ scored AND 0 missed
- **Integration test (Jest):** Seed test player data. Run badge evaluation. Query PlayerBadge nodes. Verify correct badges and tiers are created.
- **E2E tests (Playwright):**
  - Navigate to Player Stats → scroll to Achievements section. Verify badges display in a grid. Verify earned badges have coloured backgrounds. Verify unearned badges show as dashed outlines with progress.
  - Navigate to Club Awards and Records page. Verify Badge Leaderboard section exists below Records.
  - Verify badge bar appears near the player name at the top of Player Stats.

---

## Additional data requirements for badges

Some badge evaluations require data that may not currently be aggregated on the Player node. The seeding script needs to compute these additional aggregates:

```js
// Add to Player node computation in seeding script:
maxAppsInSeason: // max of apps201617, apps201718, ..., apps202526
maxGoalsInSeason: // max of goals201617, goals201718, ..., goals202526
hatTrickCount: // COUNT of MatchDetail nodes where goals >= 3
scoredOnDebut: // check if first MatchDetail (by date) has goals >= 1
uniqueAwayGrounds: // COUNT DISTINCT opposition from MatchDetail joined with Fixture where homeOrAway = 'Away'
totwStarManCount: // COUNT of IN_WEEKLY_TOTW relationships where isStarMan = true
totwAppearanceCount: // COUNT of IN_WEEKLY_TOTW relationships
potmCount: // COUNT of IN_PLAYER_OF_THE_MONTH relationships
clubAwardCount: // COUNT of HAS_CAPTAIN_AWARDS relationships
multiTeamSeasons: // COUNT of seasons where player appeared for 2+ teams with 10+ total apps
```

---

## Phase 6: New Requests Round 2

These items come from `New-Features-2.md`. Implement after Phase 5 (Feature 9) unless a dependency note says otherwise. Run the full test suite after each feature.

---

### Feature 10: Player Profile page and Captaincies link

**What:**

1. New **Player Profile** route (dedicated page, not only Player Stats) showing a career summary: achievement badges, all-time headline stats (goals, assists, cards, appearances, and other relevant aggregates already on `Player` or easy to derive).
2. **Section order on Player Profile:** (1) **Season Wrapped** entry point / banner first; (2) **Milestone badges** second (content moved from Player Stats — see below).
3. On **Player Stats** → Captaincies, Awards and Achievements: **remove** the milestone badges block from that section. Keep the text **“Milestone badges earned”** in place, **underlined**, as a **link** to the Player Profile page for the current player (same player context as stats).

**Where to change (V3-dorkinians-website):** New `app/...` route for profile (align URL pattern with existing player slug/name usage, e.g. mirror `/wrapped/[playerSlug]` or stats deep links). Reuse badge APIs/components (`player-badges`, badge bar/grid patterns). Move or extract milestone UI so it lives on the profile page first.

**Dependencies:** Feature 9 (badges data). Season Wrapped route/banner component from Feature 8.

**Tests to write:**

- **Unit tests (Jest):** URL/slug helper for profile link matches player selected on Stats (if shared util).
- **Integration test (Jest):** Profile page data fetch returns expected shape for a known player (if using a dedicated API route).
- **E2E (Playwright):** Open Player Stats → click “Milestone badges earned” → lands on Player Profile with milestones visible. On Player Profile, Season Wrapped appears above milestone section. Player Profile shows badges + headline stats.

---

### Feature 11: Merge Club Captains and Club Awards into “Club Captains and Awards”

**What:** Combine the **Club Captains** and **Club Awards and Records** sub-pages into one page titled **Club Captains and Awards**. Single nav entry; preserve existing content sections (captains + awards) in a sensible order (e.g. captains then awards, or as designed).

**Where to change (V3-dorkinians-website):** Club Info routing, sidebar/tabs, Settings navigation tree, any deep links to old paths (redirects from old URLs if bookmarked).

**Dependencies:** Feature 6/9 UI that lived under Club Awards (records leaderboard, etc.) — ensure merged page still hosts awards + badge leaderboard until Feature 12 moves Records.

**Tests to write:**

- **E2E (Playwright):** Navigate Club Info → single “Club Captains and Awards” entry; both captains and awards content reachable; old routes redirect or 404 as agreed.

---

### Feature 12: Move Records to Club Information (above Milestones)

**What:** Remove the **Records** section from the merged Club Captains and Awards page (after Feature 11). Add **Records** on **Club Information** **above** the **Milestones** section.

**Where to change (V3-dorkinians-website):** `RecordsSection` (or equivalent) placement; Club Information page layout order.

**Dependencies:** Feature 11 (merged captains/awards page must no longer be the sole home for records).

**Tests to write:**

- **E2E (Playwright):** Club Information shows Records above Milestones; Club Captains and Awards page has no Records block (awards/badge leaderboard remain as specified).

---

### Feature 13: Home header profile icon → Player Profile

**What:** When a player is selected on the **home** page, show a **profile icon** in the header **to the left of** the settings icon. Clicking it navigates to the **Player Profile** page for that player.

**Where to change (V3-dorkinians-website):** Header/layout component used on home; home player selection state (Zustand or existing store).

**Dependencies:** Feature 10 (Player Profile route).

**Tests to write:**

- **E2E (Playwright):** Select player on home → icon visible → click → Player Profile for that player. No selection → icon hidden or disabled per UX decision (document in implementation).

---

### Feature 14: Player Stats — “Most Connected” (top 5)

**What:** New **Most Connected** section on **Player Stats**: top **5** players with the strongest connection to the selected player (use existing `PLAYED_WITH` / `timesPlayed` or graph fields from Feature 7; define sort: e.g. by `timesPlayed` descending).

**Where to change (V3-dorkinians-website):** Extend `player-data` / `player-data-filtered` or add a small API if query is heavy; `PlayerStats` UI section with stable section id for E2E.

**Dependencies:** Feature 7 partnership data (or equivalent Cypher) available for the selected player.

**Tests to write:**

- **Unit tests (Jest):** Sort/limit helper returns at most 5, stable ordering tie-break.
- **Integration test (Jest):** API returns 5 or fewer names with connection counts for a fixture player.
- **E2E (Playwright):** Most Connected section visible; names/counts match seeded scenario if test DB available.

---

### Feature 15: Team of the Week — previous 10 weeks score strip

**What:** Below the current TOTW graphic, render **10** boxes: **previous 10** teams-of-the-week **total scores**, **week number** under each. Clicking a box navigates to the TOTW view for **that week**.

**Where to change (V3-dorkinians-website):** TOTW page/components; API or query for weekly totals and week identifiers (align with `WeeklyTOTW` / existing week routing).

**Tests to write:**

- **E2E (Playwright):** 10 boxes render; click week N → URL or content reflects week N; current week excluded from “previous 10” as specified.

---

### Feature 16: Team of the Week — Share (WhatsApp-friendly image)

**What:** **Share** control at the **bottom** of the TOTW page: generate a **graphic** of the **current** team of the week and share via **Web Share API** where available; optimise for **WhatsApp** (PNG dimensions/compression, readable text). Fallback: download image (same pattern as Season Wrapped `html-to-image`).

**Where to change (V3-dorkinians-website):** TOTW page; optional shared util with wrapped share.

**Tests to write:**

- **Unit tests (Jest):** Filename / MIME / dimensions constants if extracted.
- **E2E (Playwright):** Share button present; triggering does not error (do not assert native share dialog); optional: verify download attribute in fallback path.

---

### Feature 17: Dev deploy branding and CI gates

**What:**

1. **Dev** deployment uses a distinct **iOS / PWA icon** — asset **`dev-icon-192x192`** (path under `public/` as implemented).
2. **Dev** build shows **“Dev”** in the **homepage header** bar (environment-based, e.g. `NEXT_PUBLIC_*` or Netlify `CONTEXT`).
3. **E2E tests run on push** to the **Dev** branch/deploy pipeline (same suite as main or Dev subset — document which).
4. **Merge/push to `main` gated:** CI must report **≥ 90% automated test pass rate** before merge is allowed (pass-rate gate, not coverage threshold).

**Where to change:** `V3-dorkinians-website` — `next.config`, `app/manifest` or metadata icons, header component, GitHub Actions / Netlify config (whichever applies in repo). Document exact job names and pass-rate calculation (e.g. `passed / (passed + failed)` excluding skipped).

**Tests to write:**

- **E2E (Playwright):** On Dev-like env, header contains “Dev” and favicon/manifest link includes dev icon (smoke). CI: workflow YAML validated by dry-run or documented checklist.

---

### Feature 18: Fixtures — “VEO LINK” from Google Sheets

**What:** New Google Sheets column **VEO LINK** on fixtures data: ingest in **`database-dorkinians`** (schema + CSV mapping), persist on **`Fixture`** (or equivalent), expose via website API for any consumer (League Info, Show Results, etc.).

**Where to change:** `database-dorkinians/config/schema.js`, fixture import pipeline; website fixture APIs and types.

**Dependencies:** None for schema; required before Feature 19 Veo button.

**Tests to write:**

- **Unit/integration (DB repo):** Import row with `VEO LINK` → property stored after seed.
- **Integration (Jest, website):** Fixture API returns `veoLink` (or agreed field name) when present.

---

### Feature 19: League Information — Latest Result + formation + Show Results parity

**What:**

1. **League Information:** Below **each** team’s **league table**, add subheading **Latest Result**. Under it: a **card** with match details — **date, score, goalscorers, MoM** (match collapsed-card style from **Show Results** modal).
2. Below the card: **formation** as **dots** with **player names** and **match ratings**; **click dot** → **tooltip** with **match rating** and **rating breakdown** (reuse match-rating decomposition rules from foundation).
3. If **VEO LINK** exists: **“Watch on Veo”** opens link in **new tab**.
4. **“Show full player details”** expands to the **per-player match table** (same as Show Results modal).
5. **Show Results modal:** Same behaviour — expandable cards with formation, optional Veo link, and **“Show full player details”** toggling full table.

**Where to change (V3-dorkinians-website):** League Information components, Show Results modal + shared subcomponents; may need `fixture-lineup` or new API combining `Fixture`, `MatchDetail`, `veoLink`.

**Dependencies:** Feature 18 (`veoLink`); Phase 1 match ratings / formation inference on fixtures.

**Tests to write:**

- **Unit tests (Jest):** Tooltip payload shape; breakdown text formatter.
- **Integration test (Jest):** API returns lineup + ratings + veoLink for latest fixture per team.
- **E2E (Playwright):** League page shows Latest Result + formation; Veo button when link present; expand full details; modal parity smoke.

---

## Implementation order summary

| Phase | Features | Repo | Depends on |
|---|---|---|---|
| 1 | Feature 1 (inferred data), Feature 4 (match ratings) | database-dorkinians | Nothing |
| 2 | Feature 2 (per-90), Feature 3 (EWMA), Feature 5 (streaks) | database-dorkinians | Phase 1 (match ratings feed into EWMA; started feeds into streaks) |
| 3 | Feature 6 (records wall), Feature 7 (graph insights) | Both repos | Phase 2 (streak records feed into records wall) |
| 4 | Feature 8 (Season Wrapped) | V3-dorkinians-website | Phases 1-3 (uses per-90, streaks, partnerships, match ratings) |
| 5 | Feature 9 (achievement badges) | Both repos | Phases 1-3 (uses streaks, per-90, match ratings) |
| 6 | Features 10-19 (New Requests Round 2) | Both repos (18 + seeding) | Phase 5 for 10; Phase 7 data for 14; Phase 1 + 18 for 19 |

Within each phase, implement features in the order listed. Run the full test suite after each feature before moving to the next.