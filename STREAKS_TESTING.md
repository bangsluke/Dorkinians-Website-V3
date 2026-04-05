# Streak Testing Instructions (End-to-End)

Use this as a full QA pass for streak logic across seeded data, live API/UI, and chatbot.

## Pre-check

- Pick 2-3 players with known match history across multiple teams/seasons.
- Ensure data is freshly seeded/recomputed so player streak properties are current.
- In the website, clear filters first and test with full-career scope.

### 1. Player Stats Page (Core Logic)

For each test, open a player profile and verify streak values in the streak section.

- [ ] Appearance streak increments per match, not per week
  - [ ] Find a week where player played 2 fixtures.
  - [ ] Expected: appearance streak increases by 2 for that week.
- [ ] Cross-team appearance in same streak
  - [ ] Find sequence where player appears for different XIs in consecutive weeks.
  - [ ] Expected: streak continues (does not break due to XI change).
- [ ] Anchor-team break rule
  - [ ] Find a week where player’s season anchor team had a fixture but player did not play anywhere.
  - [ ] Expected: appearance streak breaks at that point.
- [ ] Protected week rule
  - [ ] Find a gap week where anchor team had no fixture.
  - [ ] Expected: appearance streak does not break because of that week.
- [ ] Non-appearance streak skip
  - [ ] Example target: goals/assists.
  - [ ] If player scored in week A, missed week B entirely, scored in week C:
  - [ ] Expected: scoring streak continues (A -> C), appearance streak may break depending on anchor-team fixture in week B.

### 2. Filters vs Unfiltered Consistency

On the same player:

- [ ] Unfiltered baseline
  - [ ] Record key streaks (current + all-time best).
- [ ] Apply filters (season/team/location/result)
  - [ ] Expected: live streak cards recompute for filtered scope.
  - [ ] Confirm filtered streak behavior still respects:
    - [ ] per-match increments
    - [ ] non-appearance skip behavior
    - [ ] week-based ordering

### 3. Chatbot Consistency Checks

Ask streak questions for the same player and compare with player page values.

- [ ] “What is my longest goal scoring streak?”
- [ ] “What is my longest assisting run?”
- [ ] “What is my longest consecutive goal involvement streak?”
- [ ] “What is my longest consecutive clean sheet streak?”
- [ ] “What is my longest consecutive weekends played streak?”

- [ ] Expected: chatbot streak counts match canonical streak outcomes (not ad-hoc date-gap logic).

### 4. Ranking Consistency Checks

Ask leaderboard questions and compare top player streak values with player pages:

- [ ] “Who has the highest current scoring streak?”
- [ ] “Who has the highest all-time appearance streak?”
- [ ] “Who has the highest all-time clean sheet streak?”

- [ ] Expected: ranking values match stored player streak properties.

### 5. Fixture Status Recalculation Test

- [ ] Change a fixture status (e.g., from valid to Void or reverse).
- [ ] Re-run recomputation/seed process.
- [ ] Re-check affected player streaks in:
  - [ ] Player Stats page
  - [ ] Chatbot answers
  - [ ] Streak rankings

- [ ] Expected: streaks update consistently after status change.

### 6. Cross-Season Continuity Test

Pick a player active over season boundary:

- [ ] Verify streak continues across season change where weekly conditions allow.
- [ ] For tie seasons, validate anchor-team tie-break uses most recently played team behavior.

- [ ] Expected: no artificial reset at season boundary.

### 7. Pass/Fail Criteria

Pass only if all three surfaces agree for each scenario:

- [ ] Seeded properties (ranking/player data)
- [ ] Live streak API/UI (player streak cards with filters)
- [ ] Chatbot responses

## Places To Check Streak Data

### 1. Home / Stats Experience (/)

#### Player Stats page -> Streaks section

- [ ] Section label: Streaks
- [ ] Anchor id: streaks-section
- [ ] Component: components/stats/PlayerStats.tsx
- [ ] Shows:
  - [ ] Current, season best, all-time best for:
    - [ ] Scoring
    - [ ] Assists
    - [ ] Goal Involvement
    - [ ] Clean Sheets
    - [ ] Appearances
    - [ ] Starts
    - [ ] Full Matches
    - [ ] MoM
    - [ ] Discipline
    - [ ] Wins

#### Team Stats page -> Longest active streaks (this XI)

- [ ] Section label: Longest active streaks (this XI)
- [ ] Anchor id: team-streak-leaders
- [ ] Component: components/stats/TeamStats.tsx
- [ ] Shows streak leader cards (player + value “in a row”) per streak category for the selected XI/team context.

### 2. Wrapped page (/wrapped/[playerSlug])

#### Wrapped slide -> Streak

- [ ] Slide content title: Streak
- [ ] Component: components/wrapped/WrappedExperience.tsx (slide case 7)
- [ ] Shows:
  - [ ] longestStreakType
  - [ ] longestStreakValue
  - [ ] Context line (e.g., season totals relevant to that streak type)

### 3. Chatbot panel (on home page when chatbot is shown)

- [ ] Chatbot answer + visualization area
- [ ] Component: components/chatbot/ChatbotInterface.tsx
- [ ] Streaks appear in:
  - [ ] Answer text (“your longest ... streak is ...”)
  - [ ] NumberCard / Table / Calendar visualizations depending on streak question
  - [ ] Calendar streak rendering is in components/chatbot/Calendar.tsx.