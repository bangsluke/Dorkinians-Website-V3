
# Player Profile Milestones

This document summarizes every milestone badge currently used on the Player Profile page (`Milestone Badges`), including the newer badges recently added.

## How milestones work

- Source of truth: `lib/badges/catalog.ts`
- Progress engine: `lib/badges/evaluate.ts`
- Tooltip copy: `lib/badges/badgeTooltip.ts` (`buildMilestoneTooltipLines` - six-line layout: name, description, earned/current, next tier, peers at tier, club leader)
- On narrow viewports, milestone cells open a **centered modal** instead of a hover tooltip (avoids scroll clipping).
- API `player-badges` supplies `tierCountsByBadgeKey`, `milestoneValuesByBadgeKey`, and `milestoneLeadersByBadgeKey` for tooltip lines 5–6.

---

## Appearances milestones

- `club_stalwart` (Club Stalwart) - **Stat:** `appearances` - **Tiers:** B50 / S100 / G200 / D300
- `season_regular` (Season Regular) - **Stat:** `maxAppsInSeason` - **Tiers:** B15 / S20 / G25 / D30
- `ever_present` (Ever Present) - **Stat:** `allTimeBestAppearanceStreak` - **Tiers:** B5 / S15 / G25 / D40
- `multi_team` (Multi-Team Player) - **Stat:** `numberTeamsPlayedFor` - **Tiers:** B2 / S3 / G5 / D7
- `veteran` (Veteran) - **Stat:** `numberSeasonsPlayedFor` - **Tiers:** B3 / S5 / G7 / D10

## Goals milestones

- `goalscorer` (Goalscorer) - **Stat:** `goals` - **Tiers:** B5 / S25 / G50 / D100
- `season_scorer` (Season Scorer) - **Stat:** `maxGoalsInSeason` - **Tiers:** B5 / S10 / G15 / D20
- `double_hattrick` (Double Hattrick) - **Stat:** `doubleHattrickCount` - **Tier:** G1 (6+ goals in a game)
- `penalty_machine` (Penalty Machine) - **Stat:** `maxPenaltiesInGame` - **Tiers:** B1 / G2 / D3
- `hat_trick_hero` (Hat-Trick Hero) - **Stat:** `hatTrickCount` - **Tiers:** B1 / S3 / G5 / D10
- `hot_streak` (Hot Streak) - **Stat:** `allTimeBestScoringStreak` - **Tiers:** B3 / S5 / G7 / D10
- `poacher` (Poacher) - **Stat:** `goalsPer90` - **Tiers:** B0.3 / S0.5 / G0.7 / D1.0
  - **Condition:** only evaluated if `minutes >= 360`

## Assists milestones

- `provider` (Provider) - **Stat:** `assists` - **Tiers:** B5 / S15 / G30 / D50
- `double_provider` (Double Provider) - **Stat:** `maxAssistsInGame` - **Tiers:** B2 / S3 / G4 / D5
- `creator_streak` (Creator Streak) - **Stat:** `currentAssistStreak` - **Tiers:** B2 / S3 / G5 / D7
- `assist_goal_combo` (Assist+Goal Combo) - **Stat:** `assistGoalComboCount` - **Tiers:** B1 / S3 / G5 / D10
- `playmaker` (Playmaker) - **Stat:** `assistsPer90` - **Tiers:** B0.2 / S0.3 / G0.5 / D0.7
  - **Condition:** only evaluated if `minutes >= 360`

## Defence milestones

- `clean_sheet_king` (Clean Sheet King) - **Stat:** `cleanSheets` - **Tiers:** B5 / S15 / G30 / D50
- `brick_wall` (Brick Wall) - **Stat:** `allTimeBestCleanSheetStreak` - **Tiers:** B3 / S5 / G7 / D10
- `shot_stopper` (Shot Stopper) - **Stat:** `saves` - **Tiers:** B20 / S50 / G100 / D200
- `penalty_saver` (Penalty Saver) - **Stat:** `penaltiesSaved` - **Tiers:** B1 / S3 / G5 / D10

## Performance milestones

- `man_of_the_match` (Man of the Match) - **Stat:** `mom` - **Tiers:** B3 / S8 / G15 / D25
- `century_starter` (Century Starter) - **Stat:** `starts` - **Tiers:** B50 / S100 / G150 / D200
- `star_man` (Star Man) - **Stat:** `totwStarManCount` - **Tiers:** B2 / S5 / G10 / D20
- `totw_regular` (TOTW Regular) - **Stat:** `totwAppearanceCount` - **Tiers:** B5 / S15 / G30 / D50
- `potm_winner` (Player of the Month) - **Stat:** `potmCount` - **Tiers:** B1 / S3 / G6 / D10
- `peak_performer` (Peak Performer) - **Stat:** `matchesRated8Plus` - **Tiers:** B1 / S5 / G15 / D30
- `on_fire` (On Fire) - **Stat:** `formCurrent` - **Tiers:** B7.5 / S8.0 / G8.5 / D9.0
- `consistent_8s` (Consistent 8s) - **Stat:** `allTimeBestHighRatingStreak` - **Tiers:** B3 / S5 / G8 / D12
- `highly_rated` (Highly Rated) - **Stat:** `highestMatchRating` - **Tiers:** B8.5 / S9.0 / G9.5 / D10.0
- `fantasy_centurion` (Fantasy Centurion) - **Stat:** `maxFantasyPointsInSeason` - **Tiers:** B100 / S200 / G300 / D400
- `back_to_back_mom` (Back-to-Back MoM) - **Stat:** `currentMomStreak` - **Tiers:** B2 / S3 / G5 / D8
- `season_20_gi` (20 GI Season) - **Stat:** `seasons20GI` - **Tiers:** B1 / S2 / G3 / D5
- `justified_starter` (Justified Starter) - **Stat:** `winsWhenStarting` - **Tiers:** B5 / S15 / G30 / D50
- `impact_sub` (Impact Sub) - **Stat:** `winsFromBench` - **Tiers:** B3 / S8 / G15 / D25

## Special milestones

- `debut_scorer` (Debut Scorer) - **Stat:** `scoredOnDebut` - **Tier:** G1
- `the_traveller` (The Traveller) - **Stat:** `uniqueAwayGrounds` - **Tiers:** B10 / S15 / G20 / D30
- `globe_trotter` (Globe Trotter) - **Stat:** `distance` (rounded) - **Tiers:** B200 / S500 / G1000 / D2000
- `penalty_perfect` (Penalty Perfect) - **Stat:** `penaltiesScored` + `penaltiesMissed` - **Tier:** G1
  - **Condition:** `penaltiesScored >= 5` and `penaltiesMissed === 0`
- `swiss_army_knife` (Swiss Army Knife) - **Stat:** positional usage `gk/def/mid/fwd` - **Tier:** G1
- `award_winner` (Award Winner) - **Stat:** `clubAwardCount` - **Tiers:** B1 / S3 / G5 / D10
- `weekend_warrior` (Weekend Warrior) - **Stat:** `multiTeamSeasons` - **Tier:** G1
- `full_90_engine` (Full-90 Engine) - **Stat:** `currentFullMatchStreak` - **Tiers:** B3 / S5 / G8 / D12
- `clutch_scorer` (Clutch Scorer) - **Stat:** `winsWhenScoring` - **Tiers:** B5 / S15 / G30 / D50
- `mr_versitile` (Mr Versitile) - **Stat:** count of played position groups (`gk/def/mid/fwd`) - **Tiers:** B1 / S2 / G3 / D4
- `derby_specialist` (Derby Specialist) - **Stat:** `derbyWinsReigations` - **Tiers:** B1 / S3 / G5 / D10
- `betrayal` (Betrayal) - **Stat:** `betrayalWinsDorkinians` - **Tiers:** B1 / S2 / G3 / D5
- `league_winner` (League Winner) - **Stat:** `leagueTitles` - **Tiers:** B1 / S2 / G3 / D5
- `cup_winner` (Cup Winner) - **Stat:** `cupTitles` - **Tiers:** B1 / S2 / G3 / D5
- `gk_clean_sheet_specilaist` (GK Clean Sheet Specilaist) - **Stat:** `gkCleanSheets` - **Tiers:** B5 / S15 / G30 / D50
- `golden_gloves` (Golden Gloves) - **Stat:** `saves` - **Tiers:** B25 / S75 / G150 / D300
- `ftp_points_scored` (FTP Points Scored) - **Stat:** `fantasyPoints` - **Tiers:** B250 / S500 / G1000 / D2000
- `clean_season` (Clean Season) - **Stat:** `seasonBestDisciplineStreak` vs `maxAppsInSeason` - **Tier:** G1
  - **Condition:** no-card streak in a season must be at least peak season appearances

---

## More ideas (no extra data required)

These ideas can be built using fields already in Player/Match aggregates, without introducing a new data source.

### Appearances
- **Century Starter:** total starts milestones from `starts` (e.g., 50/100/150/200).
- **Ever Ready:** appearances-to-season consistency (`appearances / numberSeasonsPlayedFor` thresholds).
- **Bench Utility:** high `subAppearances` milestones (10/25/50/100).

### Goals
- **Open Play Sniper:** milestones on open-play goals (`goals` only, separate from all-goals).
- **Goals Per App Elite:** milestones on `goalsPerApp`.
- **Minutes-per-Goal Master:** inverse-efficiency badge using `minutesPerGoal` (lower is better; can be implemented as threshold bands).

### Assists
- **Assist Per App Elite:** milestones on `assistsPerApp`.
- **GI Conductor:** milestones on `goalInvolvementsPerApp`.
- **Dual Threat:** combined thresholds where both `goalsPer90` and `assistsPer90` must be above cutoffs.

### Defence
- **Card-Free Career:** milestones for low discipline burden using `yellowCards + redCards` against appearances.
- **GK Clean Sheet Specialist:** milestones on `gkCleanSheets`.
- **Save Rate Hero:** milestones on `savesPer90` with minimum minutes.

### Performance
- **Form Floor:** badges for keeping `formBaseline` high (e.g., 7.0/7.5/8.0/8.5).
- **Points Engine:** milestones on `fantasyPointsPerApp`.
- **Big Match Winner:** milestones on `wins` and `gamesPercentWon`.

### Special
- **Team Loyalist:** high `mostPlayedForTeamAppearances`.
- **Road Warrior:** high `awayGames` plus strong `awayGamesPercentWon`.
- **Starter Impact:** high `winRateWhenStarting` with minimum `starts`.

---

## Tier/progress behavior notes

- Tiers evaluate highest-first (`diamond -> gold -> silver -> bronze`).
- The profile displays the highest earned tier per badge.
- Locked badges show progress to the next tier target.
- Hover copy now also includes how many club players have achieved the milestone.
