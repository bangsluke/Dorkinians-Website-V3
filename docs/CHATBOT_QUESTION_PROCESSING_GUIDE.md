# Chatbot Question Processing Guide

## Table of Contents

- [Overview](#overview)
- [Question Flow Overview](#question-flow-overview)
- [Frontend to Backend Communication](#frontend-to-backend-communication)
- [Question Analysis Pipeline](#question-analysis-pipeline)
- [Entity Extraction Priority Order](#entity-extraction-priority-order)
- [Stat Type Extraction Priority](#stat-type-extraction-priority)
- [Question Type Determination Priority](#question-type-determination-priority)
- [Metric Extraction and Correction Priority](#metric-extraction-and-correction-priority)
- [Cypher Query Generation](#cypher-query-generation)
- [Query Building Priority Order](#query-building-priority-order)
- [Potential Efficiency Improvements](#potential-efficiency-improvements)
- [Conclusion](#conclusion)

> [Back to Table of Contents](#table-of-contents)

## Overview

This guide explains how a user question flows from the frontend through the chatbot system and gets converted into a Cypher query that retrieves data from the Neo4j database. It details the priority order of question breakdown steps and identifies potential efficiency improvements.

> [Back to Table of Contents](#table-of-contents)

## Question Flow Overview

The question processing follows this high-level flow:

```
Frontend (ChatbotInterface.tsx)
  ↓ POST /api/chatbot
API Route (route.ts)
  ↓ processQuestion()
ChatbotService (chatbotService.ts)
  ↓ analyzeQuestion()
EnhancedQuestionAnalyzer (enhancedQuestionAnalysis.ts)
  ↓ EntityExtractor.resolveEntitiesWithFuzzyMatching()
EntityExtractor (entityExtraction.ts)
  ↓ Returns EnhancedQuestionAnalysis
ChatbotService.queryRelevantData()
  ↓ buildPlayerQuery() / other query builders
Cypher Query Execution
  ↓ Neo4j Database
Results Returned to Frontend
```

> [Back to Table of Contents](#table-of-contents)

## Frontend to Backend Communication

**File**: `V3-Dorkinians-Website/components/ChatbotInterface.tsx`

1. User submits question via form
2. Question and optional `userContext` (selected player) sent to `/api/chatbot` endpoint
3. Response includes answer, sources, and debug information

**File**: `V3-Dorkinians-Website/app/api/chatbot/route.ts`

1. Validates question is a string
2. Calls `chatbotService.processQuestion()`
3. Retrieves processing details for debugging
4. Returns response with debug information

> [Back to Table of Contents](#table-of-contents)

## Question Analysis Pipeline

**File**: `V3-Dorkinians-Website/lib/services/chatbotService.ts` (processQuestion method)

The main processing steps:

1. **Connection Check**: Ensures Neo4j connection is available
2. **Question Analysis**: Calls `analyzeQuestion()` which uses `EnhancedQuestionAnalyzer`
3. **Clarification Check**: If clarification needed, returns early with message
4. **Query Building**: Calls `queryRelevantData()` with the analysis
5. **Response Generation**: Formats results into user-friendly answer

> [Back to Table of Contents](#table-of-contents)

## Entity Extraction Priority Order

**File**: `V3-Dorkinians-Website/lib/config/entityExtraction.ts` (extractEntityInfo method)

Entities are extracted in this priority order:

1. **"I" References** (Highest Priority)
   - Matches: `/\b(i|i've|me|my|myself)\b/gi`
   - Maps to user context if available

2. **Player Names** (Second Priority)
   - Uses NLP (compromise library) for better accuracy
   - Extracts proper nouns that match player name patterns
   - Deduplicates using normalized lowercase names

3. **Team References** (Third Priority)
   - Matches: `/\b(1s|2s|3s|4s|5s|6s|7s|8s|1st|2nd|3rd|4th|5th|6th|7th|8th|first|second|third|fourth|fifth|sixth|seventh|eighth)(?:\s+(team|teams))?\b/gi`
   - Removes trailing "team"/"teams" words

4. **League References** (Fourth Priority)
   - Matches: `/\b(league|premier|championship|conference|national|division|tier|level)\b/gi`
   - Attempts to extract full league name from context

5. **Opposition Team References** (Fifth Priority)
   - Matches capitalized words: `/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g`
   - Filters out common words and known player names
   - Skips if already identified as player entity

After extraction, entities go through fuzzy matching via `resolveEntitiesWithFuzzyMatching()` which:
- Resolves player names using `EntityNameResolver.getBestMatch()`
- Resolves team names using fuzzy matching
- Resolves opposition names using fuzzy matching
- Resolves league names using fuzzy matching

> [Back to Table of Contents](#table-of-contents)

## Stat Type Extraction Priority

**File**: `V3-Dorkinians-Website/lib/config/entityExtraction.ts` (extractStatTypes method)

1. **Goal Involvements** (Explicit First Check)
   - Checks for "goal involvements" or "goal involvement" before other stat types

2. **Other Stat Types** (Sorted by Pseudonym Length)
   - Pseudonyms sorted by length (longest first)
   - Ensures longer, more specific matches are found before shorter ones
   - Example: "penalties scored" matched before "penalties"

The extraction uses regex patterns with word boundaries for single words and literal matching for phrases. Regex patterns (containing `.*` or similar) are used as-is without escaping.

> [Back to Table of Contents](#table-of-contents)

## Question Type Determination Priority

**File**: `V3-Dorkinians-Website/lib/config/enhancedQuestionAnalysis.ts` (determineQuestionType method)

Question types are determined in this priority order:

1. **Player** (Highest Priority)
   - If `hasPlayerEntities` is true, immediately returns "player"
   - Also catches percentage queries

2. **Temporal**
   - Checks for time-related keywords: "since", "before", "between", "during", "in the", "from", "until", "after"
   - Or if `hasTimeFrames` is true

3. **Percentage**
   - Checks for "percentage", "percent", or "%"

4. **Streak**
   - Checks for "streak", "consecutive", or "in a row"

5. **Double Game**
   - Checks for "double game" or "double game week"

6. **Ranking**
   - Checks for ("which" OR "who") AND ("highest" OR "most" OR "best" OR "top")

7. **Comparison**
   - Checks for: "most", "least", "highest", "lowest", "best", "worst", "top", "who has", "penalty record", "conversion rate"

8. **Team**
   - If has team entities AND ("finish" OR "league position" OR "position" OR "table")

9. **Club**
   - Checks for "club", "captain", or "award"

10. **Fixture**
    - Checks for "fixture", "match", or "game"

11. **Player-Related Content** (Fallback)
    - Checks for player-related indicators: "scored", "goals", "assists", "appearances", etc.

12. **General** (Final Fallback)
    - Default if no other type matches

> [Back to Table of Contents](#table-of-contents)

## Metric Extraction and Correction Priority

**File**: `V3-Dorkinians-Website/lib/config/enhancedQuestionAnalysis.ts` (extractLegacyMetrics method)

Metrics are corrected in this specific priority order (each correction builds on the previous):

1. **Games Queries** → Maps to "Apps"
   - `correctGamesQueries()`

2. **Team-Specific Appearance Queries**
   - `correctTeamSpecificAppearanceQueries()`
   - Handles "1s apps", "2nd XI appearances", etc.

3. **Penalty Phrases**
   - `correctPenaltyPhrases()`
   - Fixes incorrectly broken down penalty phrases

4. **Most Prolific Season Queries**
   - `correctMostProlificSeasonQueries()`

5. **Season-Specific Queries**
   - `correctSeasonSpecificQueries()`
   - Handles "2017/18 Goals" patterns

6. **Season-Specific Appearance Queries**
   - `correctSeasonSpecificAppearanceQueries()`

7. **Open Play Goals Queries**
   - `correctOpenPlayGoalsQueries()`

8. **Team-Specific Goals Queries**
   - `correctTeamSpecificGoalsQueries()`
   - Handles "1s goals", "2nd XI goals", etc.

9. **Distance/Travel Queries**
   - `correctDistanceTravelQueries()`

10. **Percentage Queries**
    - `correctPercentageQueries()`

11. **Most Appearances for Team Queries**
    - `correctMostAppearancesForTeamQueries()`

12. **Most Scored for Team Queries**
    - `correctMostScoredForTeamQueries()`

**Note**: After all corrections, Home/Away metrics are filtered out if question asks for total games/appearances without location qualifier.

After corrections, metrics are prioritized using a priority order list that ensures more specific stat types take precedence:

- Season Count queries (most specific)
- Own Goals
- Per-appearance metrics (Goals Per Appearance, Assists Per Appearance, etc.)
- Distance Travelled
- Goals Conceded
- Open Play Goals
- Penalty-related stats
- Season-specific goals (2021/22 Goals, etc.)
- Team-specific appearances (1st XI Apps, etc.)
- Team-specific goals (1st XI Goals, etc.)
- Season-specific appearances
- Position-specific appearances (Goalkeeper, Defender, etc.)
- Most Common Position
- Most Scored For Team / Most Played For Team
- General stats (Goals, Assists, Apps, Minutes)

> [Back to Table of Contents](#table-of-contents)

## Cypher Query Generation

**File**: `V3-Dorkinians-Website/lib/services/chatbotService.ts` (queryRelevantData method)

Based on question type, different query methods are called:

- `player` → `queryPlayerData()`
- `team` → `queryTeamData()`
- `club` → `queryClubData()`
- `fixture` → `queryFixtureData()`
- `comparison` → `queryComparisonData()`
- `streak` → `queryStreakData()`
- `temporal` → `queryTemporalData()`
- `double_game` → `queryDoubleGameData()`
- `ranking` → `queryRankingData()`
- `general` → `queryGeneralData()`

> [Back to Table of Contents](#table-of-contents)

## Query Building Priority Order

**File**: `V3-Dorkinians-Website/lib/services/chatbotService.ts` (buildPlayerQuery method)

For player queries, the Cypher query is built in this order:

### 1. Query Structure Decision

- Check if metric needs MatchDetail join (`metricNeedsMatchDetail()`)
- Check if team-specific metric (1sApps, 2sGoals, etc.)
- Check if needs Fixture relationship (for filters like location, opposition, time range, etc.)

### 2. Base Query Pattern

- **No MatchDetail needed**: Direct Player node query
- **MatchDetail needed, no Fixture**: Simple MatchDetail join
- **MatchDetail needed, with Fixture**: MatchDetail + Fixture join
- **Team-specific metric**: OPTIONAL MATCH for MatchDetail (to return 0 if no matches)

### 3. WHERE Clause Conditions (Applied in Order)

1. **Team Filter** (if team entities exist AND not team-specific metric)
   - Uses `f.team` for non-team-specific metrics

2. **Team-Specific Appearance Filter** (if metric is like "1sApps")
   - Uses `md.team` directly

3. **Team-Specific Goals Filter** (if metric is like "1sGoals")
   - Uses `md.team` directly
   - For OPTIONAL MATCH, filtering happens in WITH clause after aggregation

4. **Location Filter** (if locations exist AND not HOME/AWAY metric AND not team-specific)
   - Maps to `f.homeOrAway = 'Home'` or `'Away'`

5. **Opposition Filter** (if opposition entities exist AND not team-specific)
   - Uses `f.opposition = '{name}'`

6. **Time Range Filter** (if timeRange exists AND not team-specific)
   - Converts date format and uses `f.date >= '{start}' AND f.date <= '{end}'`

7. **Competition Type Filter** (if competition types exist AND not team-specific)
   - Maps to `f.compType = 'League'/'Cup'/'Friendly'`

8. **Competition Filter** (if competitions exist AND not team-specific appearance/goals)
   - Uses `f.competition CONTAINS '{name}'`

9. **Result Filter** (if results exist AND not team-specific)
   - Maps to `f.result = 'W'/'D'/'L'`

10. **Opponent Own Goals Filter** (if opponentOwnGoals is true AND not team-specific)
    - Uses `f.oppoOwnGoals > 0`

11. **Special Metric Filters**
    - `HOME` → `f.homeOrAway = 'Home'`
    - `AWAY` → `f.homeOrAway = 'Away'`

12. **Position Filters**
    - `GK` → `md.class = 'GK'`
    - `DEF` → `md.class = 'DEF'`
    - `MID` → `md.class = 'MID'`
    - `FWD` → `md.class = 'FWD'`

13. **Seasonal Metric Filters**
    - For patterns like `2017/18GOALS` → `f.season = "2017/18"`

### 4. RETURN Clause

- For team-specific goals with OPTIONAL MATCH: Uses WITH clause aggregation
- Otherwise: Uses `getMatchDetailReturnClause()` or `getPlayerNodeReturnClause()`

### 5. Special Case Queries

After building the base query, special metrics override with custom queries:

- `MOSTCOMMONPOSITION`
- `MPERG` (Minutes Per Goal)
- `MPERCLS` (Minutes Per Clean Sheet)
- `FTPPERAPP` (Fantasy Points Per Appearance)
- `CPERAPP` (Conceded Per Appearance)
- `GPERAPP` (Goals Per Appearance)
- `MINPERAPP` (Minutes Per Appearance)
- `MOMPERAPP` (Man of the Match Per Appearance)
- `YPERAPP` (Yellow Cards Per Appearance)
- `RPERAPP` (Red Cards Per Appearance)
- `SAVESPERAPP` (Saves Per Appearance)
- And many more per-appearance metrics

> [Back to Table of Contents](#table-of-contents)

## Potential Efficiency Improvements

### 1. Entity Extraction Optimization

**Current**: Entities extracted sequentially with multiple regex passes

**Improvement**:
- Combine regex patterns where possible
- Use single pass with prioritized pattern matching
- Cache common entity patterns

### 2. Stat Type Matching

**Current**: Sorted by length, but still iterates through all pseudonyms

**Improvement**:
- Use trie data structure for faster prefix matching
- Early exit when exact match found
- Group similar stat types to reduce iterations

### 3. Question Type Determination

**Current**: Sequential if-else checks

**Improvement**:
- Use decision tree or rule engine
- Cache question type patterns
- Parallel evaluation of independent checks

### 4. Metric Correction Chain

**Current**: 12 sequential correction functions

**Improvement**:
- Combine related corrections (e.g., all team-specific corrections together)
- Use pattern matching instead of sequential function calls
- Early exit when no corrections needed

### 5. Query Building

**Current**: Builds WHERE conditions sequentially, then joins

**Improvement**:
- Pre-compute filter conditions in parallel
- Use query builder pattern for better optimization
- Cache common query patterns

### 6. Fuzzy Matching Performance

**Current**: Fuzzy matching happens for all entities

**Improvement**:
- Only fuzzy match when exact match fails
- Cache fuzzy match results
- Use more efficient string similarity algorithms for large datasets

### 7. Database Query Optimization

**Current**: Some queries use OPTIONAL MATCH unnecessarily

**Improvement**:
- Better detection of when OPTIONAL MATCH is needed
- Use indexes hints in Cypher queries
- Batch similar queries together

### 8. Early Exit Opportunities

**Current**: Processes full pipeline even when early exit possible

**Improvement**:
- Add early exit after entity extraction if no entities found
- Skip metric corrections if no stat types extracted
- Return cached results for identical questions

> [Back to Table of Contents](#table-of-contents)

## Conclusion

The question processing system uses a multi-stage pipeline with clear priority ordering at each stage. The priority order ensures that:

- More specific matches are found before general ones
- Player queries take precedence (most common use case)
- Complex queries are handled correctly with proper filter ordering
- Special cases are handled after general cases

Understanding this priority order helps identify where optimizations can be made and where potential issues might arise in question processing. The system's design prioritizes accuracy and correctness over speed, which is appropriate for a chatbot that needs to provide reliable answers to user questions.

> [Back to Table of Contents](#table-of-contents)

