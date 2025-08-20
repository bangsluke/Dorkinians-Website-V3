# Schema Implementation Summary

## Overview
This document summarizes the current Neo4j schema implementation for the Dorkinians website, including node types, relationships, and data flow.

## Table Structure

### 1. TBL_Players
**Headers:** `ID, PLAYER NAME, ALLOW ON SITE, MOST PLAYED FOR TEAM, MOST COMMON POSITION`
**ID Format:** `player-{firstName}-{lastName}`
**Node Type:** `Player`
**Properties:**
- `id`: Explicit ID from CSV
- `name`: Player's full name
- `allowOnSite`: Boolean indicating if player can access site
- `mostPlayedForTeam`: Team the player most frequently represents
- `mostCommonPosition`: Player's primary position (GK, DEF, MID, FWD)

### 2. TBL_FixturesAndResults
**Headers:** `ID, SEASON, DATE, TEAM, COMP TYPE, COMPETITION, OPPOSITION, HOME/AWAY, RESULT, HOME SCORE, AWAY SCORE, STATUS, OPPO OWN GOALS, FULL RESULT, DORKINIANS GOALS, CONCEDED, EXTRACTED PICKER`
**ID Format:** `fixture-{season}-{date}-{team}-vs-{opposition}-{homeAway}`
**Node Type:** `Fixture`
**Properties:**
- `id`: Explicit ID from CSV
- `season`: Season identifier (e.g., "2016/17")
- `date`: Match date
- `team`: Dorkinians team (1st XI, 2nd XI, etc.)
- `compType`: Competition type (League, Friendly, etc.)
- `competition`: Competition name
- `opposition`: Opposing team name
- `homeAway`: Home or Away
- `result`: Match result (W, L, D)
- `homeScore`: Home team score
- `awayScore`: Away team score
- `conceded`: Goals conceded by Dorkinians

### 3. TBL_MatchDetails
**Headers:** `ID, SEASON, DATE, TEAM, PLAYER NAME, MIN, CLASS, MOM, G, A, Y, R, SAVES, OG, PSC, PM, PCO, PSV, IMPORTED_FIXTURE_DETAIL`
**ID Format:** `matchdetail-{fixtureID}-{playerName}`
**Node Type:** `MatchDetail`
**Properties:**
- `id`: Explicit ID from CSV
- `fixtureId`: Reference to fixture (extracted from ID)
- `playerName`: Player's name
- `team`: Team the player represented
- `season`: Season identifier
- `date`: Match date
- `class`: Player position (GK, DEF, MID, FWD)
- `minutes`: Minutes played
- `goals`: Goals scored
- `assists`: Assists provided
- `manOfMatch`: Man of the match (1 or 0)
- `yellowCards`: Yellow cards received
- `redCards`: Red cards received
- `saves`: Saves made (for goalkeepers)
- `ownGoals`: Own goals scored
- `penaltiesScored`: Penalties scored
- `penaltiesMissed`: Penalties missed
- `penaltiesConceded`: Penalties conceded
- `penaltiesSaved`: Penalties saved

### 4. TBL_WeeklyTOTW
**Headers:** `ID, SEASON, WEEK, TOTW SCORE, PLAYER COUNT, STAR MAN, STAR MAN SCORE, GK1, DEF1, DEF2, DEF3, DEF4, DEF5, MID1, MID2, MID3, MID4, MID5, FWD1, FWD2, FWD3`
**ID Format:** `totw-{season}-week-{weekNumber}`
**Node Type:** `TOTW`
**Properties:**
- `id`: Explicit ID from CSV
- `season`: Season identifier
- `week`: Week number
- `totwScore`: Total TOTW score
- `playerCount`: Number of players in TOTW
- `starMan`: Star man player name
- `starManScore`: Star man score
- `gk1`, `def1`, `def2`, etc.: Player names for each position

### 5. TBL_SeasonTOTW
**Headers:** `ID, SEASON, TOTW SCORE, STAR MAN, STAR MAN SCORE, GK1, DEF1, DEF2, DEF3, DEF4, DEF5, MID1, MID2, MID3, MID4, MID5, FWD1, FWD2, FWD3`
**ID Format:** `totw-{season}-season`
**Node Type:** `TOTW`
**Properties:**
- `id`: Explicit ID from CSV
- `season`: Season identifier
- `totwScore`: Total TOTW score
- `starMan`: Star man player name
- `starManScore`: Star man score
- `gk1`, `def1`, `def2`, etc.: Player names for each position

### 6. TBL_PlayersOfTheMonth
**Headers:** `ID, SEASON, DATE, #1 Name, #1 Points, #2 Name, #2 Points, #3 Name, #3 Points, #4 Name, #4 Points, #5 Name, #5 Points`
**ID Format:** `pom-{season}-{month}`
**Node Type:** `PlayerOfMonth`
**Properties:**
- `id`: Explicit ID from CSV
- `season`: Season identifier
- `date`: Month/date
- `player1Name` through `player5Name`: Top 5 player names
- `player1Points` through `player5Points`: Corresponding points

### 7. TBL_OppositionDetails
**Headers:** `ID, OPPOSITION, SHORT TEAM NAME, ADDRESS, DISTANCE (MILES)`
**ID Format:** `opposition-{opposition}`
**Node Type:** `OppositionDetail`
**Properties:**
- `id`: Explicit ID from CSV
- `oppositionName`: Full opposition team name
- `shortTeamName`: Abbreviated team name
- `address`: Team address
- `distance`: Distance from Dorkinians in miles

## Key Relationships

### MatchDetail Relationships
- `MatchDetail` → `Fixture` (GENERATED_FROM)
- `Player` → `MatchDetail` (PERFORMED_IN) - with statistical properties
- `MatchDetail` → `Team` (PLAYED_FOR)
- `Player` → `Team` (PLAYS_FOR) - with season context
- `Player` → `Season` (PARTICIPATES_IN)

### TOTW Relationships
- `TOTW` → `Season` (REPRESENTS)
- `Player` → `TOTW` (SELECTED_IN) - with position
- `Player` → `TOTW` (STAR_MAN) - for star man

### PlayerOfMonth Relationships
- `PlayerOfMonth` → `Season` (REPRESENTS)
- `Player` → `PlayerOfMonth` (RANKED_IN) - with rank and points

## Data Flow

1. **CSV Ingestion**: All tables now use explicit ID columns for consistent referencing
2. **Node Creation**: Nodes are created using the explicit IDs from CSV
3. **Relationship Creation**: Relationships are established using the explicit IDs, ensuring referential integrity
4. **Validation**: CSV headers are validated against expected structure before processing

## Benefits of New Structure

1. **Explicit IDs**: Eliminates ID generation complexity and ensures consistency
2. **Direct References**: MatchDetail nodes directly reference Fixture nodes using fixture IDs
3. **Predictable Format**: ID format is consistent and human-readable
4. **Reduced Errors**: Eliminates ID mismatch issues that were causing relationship creation failures
5. **Easier Debugging**: Clear ID format makes troubleshooting simpler

## Implementation Notes

- All CSV files now have ID as the first column
- Relationship creation uses explicit IDs instead of generated ones
- Node existence is verified before creating relationships
- Error handling is improved with detailed logging
- Reduced seeding mode available for testing (max 50 rows per source)
