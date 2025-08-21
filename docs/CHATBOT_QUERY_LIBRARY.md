# Dorkinians FC Chatbot Query Library

## 🎯 Overview

This document contains optimized Cypher queries for the chatbot to answer complex questions efficiently. All queries use the `graphLabel: 'dorkiniansWebsite'` for data isolation.

**Note**: This system uses a hybrid approach:

- **Graph Database**: For complex statistical queries, player performance, and relationships
- **Table Data**: For static reference data like CaptainAward (loaded directly from CSV)

## 📊 Query Categories

### 1. Player Performance Queries

#### Get Player Goals for Specific Team

```cypher
// Question: "How many goals have I scored for the 3rd team?"
MATCH (p:Player {name: $playerName})-[:PLAYS_FOR]->(t:Team {name: $teamName})
MATCH (p)-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
WHERE f.season = $season
RETURN p.name as player,
       t.name as team,
       sum(md.goals) as totalGoals,
       count(md) as appearances,
       toFloat(sum(md.goals)) / count(md) as goalsPerGame
```

#### Get Player Goals for All Teams

```cypher
// Question: "How many goals have I scored across all teams?"
MATCH (p:Player {name: $playerName})-[:PLAYS_FOR]->(t:Team)
MATCH (p)-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
RETURN t.name as team,
       f.season as season,
       sum(md.goals) as totalGoals,
       count(md) as appearances
ORDER BY f.season DESC, t.name
```

#### Get Player Assists

```cypher
// Question: "How many assists do I have?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
RETURN p.name as player,
       sum(md.assists) as totalAssists,
       count(md) as appearances,
       toFloat(sum(md.assists)) / count(md) as assistsPerGame
```

#### Get Player Clean Sheets

```cypher
// Question: "How many clean sheets have I had?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
WHERE md.cleanSheets > 0 OR (md.class IN ['GK', 'DEF'] AND f.conceded = 0)
RETURN p.name as player,
       count(md) as cleanSheets,
       sum(md.min) as totalMinutes
```

### 2. Team Performance Queries

#### Get Team League Position

```cypher
// Question: "Where did the 2s finish in the 2017/18 season?"
MATCH (t:Team {name: $teamName, season: $season})-[:PARTICIPATES_IN]->(s:Season {id: $season})
MATCH (f:Fixture)-[:BELONGS_TO]->(s)
WHERE f.homeTeam CONTAINS $teamName OR f.awayTeam CONTAINS $teamName
RETURN t.name as team,
       s.name as season,
       count(f) as matches,
       sum(CASE WHEN f.result = 'W' THEN 3 WHEN f.result = 'D' THEN 1 ELSE 0 END) as points,
       sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
       sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) as draws,
       sum(CASE WHEN f.result = 'L' THEN 1 ELSE 0 END) as losses,
       sum(f.dorkiniansGoals) as goalsFor,
       sum(f.conceded) as goalsAgainst,
       sum(f.dorkiniansGoals) - sum(f.conceded) as goalDifference
```

#### Get Team Goals Scored

```cypher
// Question: "How many goals did the 2nd team score during the 2017/18 season?"
MATCH (t:Team {name: $teamName, season: $season})-[:PARTICIPATES_IN]->(s:Season {id: $season})
MATCH (f:Fixture)-[:BELONGS_TO]->(s)
WHERE f.homeTeam CONTAINS $teamName OR f.awayTeam CONTAINS $teamName
RETURN t.name as team,
       s.name as season,
       sum(f.dorkiniansGoals) as totalGoals,
       count(f) as matches,
       toFloat(sum(f.dorkiniansGoals)) / count(f) as goalsPerGame
```

#### Get Team Conceded Goals

```cypher
// Question: "Which team has conceded the fewest goals in history?"
MATCH (t:Team)-[:PARTICIPATES_IN]->(s:Season)
MATCH (f:Fixture)-[:BELONGS_TO]->(s)
WHERE f.homeTeam CONTAINS t.name OR f.awayTeam CONTAINS t.name
RETURN t.name as team,
       s.name as season,
       sum(f.conceded) as totalConceded,
       count(f) as matches,
       toFloat(sum(f.conceded)) / count(f) as concededPerGame
ORDER BY totalConceded ASC
LIMIT 10
```

### 3. Historical Analysis Queries

#### Get Player Goal Scoring Trends

```cypher
// Question: "What's my goal scoring trend over the seasons?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
MATCH (f)-[:BELONGS_TO]->(s:Season)
RETURN s.name as season,
       s.startYear as startYear,
       sum(md.goals) as totalGoals,
       count(md) as appearances,
       toFloat(sum(md.goals)) / count(md) as goalsPerGame
ORDER BY s.startYear
```

#### Get Player Appearances Over Time

```cypher
// Question: "How many games have I played each season?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
MATCH (f)-[:BELONGS_TO]->(s:Season)
RETURN s.name as season,
       s.startYear as startYear,
       count(md) as appearances,
       sum(md.min) as totalMinutes,
       toFloat(sum(md.min)) / count(md) as averageMinutes
ORDER BY s.startYear
```

#### Get Player Performance by Month

```cypher
// Question: "What's my best month for goals?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
RETURN datetime(f.date).month as month,
       sum(md.goals) as totalGoals,
       sum(md.assists) as totalAssists,
       count(md) as appearances
ORDER BY totalGoals DESC
```

### 4. TOTW and Awards Queries

#### Get Player TOTW Appearances

```cypher
// Question: "How many times have I been in Team of the Week?"
MATCH (p:Player {name: $playerName})-[:SELECTED_IN]->(t:TOTW)
RETURN p.name as player,
       count(t) as totwAppearances,
       sum(CASE WHEN t.starMan = p.name THEN 1 ELSE 0 END) as starManCount,
       sum(t.starManScore) as totalStarManScore
```

#### Get Player Monthly Awards

```cypher
// Question: "Have I won any monthly awards?"
MATCH (p:Player {name: $playerName})-[:AWARDED_MONTHLY]->(pom:PlayerOfTheMonth)
RETURN p.name as player,
       pom.season as season,
       pom.month as month,
       pom.totalScore as score,
       pom.goals as goals,
       pom.assists as assists
ORDER BY pom.season DESC, pom.month
```

#### Get Player Season Awards

```typescript
// Question: "What awards did I win last season?"
// CaptainAward data is handled as table data, not graph relationships
// Query the award table directly for better performance
const playerAwards = captainAwardData.filter(
	(award) =>
		award.topScorer === playerName ||
		award.topAssister === playerName ||
		award.mostCleanSheets === playerName ||
		award.mostTOTW === playerName ||
		award.mostStarMan === playerName,
);
return playerAwards;
```

### 5. Comparative Analysis Queries

#### Compare Player Performance

```cypher
// Question: "How do I compare to James Tain?"
MATCH (p1:Player {name: $player1Name})-[:PERFORMED_IN]->(md1:MatchDetail)
MATCH (p2:Player {name: $player2Name})-[:PERFORMED_IN]->(md2:MatchDetail)
MATCH (md1)-[:GENERATED_FROM]->(f1:Fixture)
MATCH (md2)-[:GENERATED_FROM]->(f2:Fixture)
WHERE f1.season = f2.season
RETURN p1.name as player1,
       p2.name as player2,
       f1.season as season,
       sum(md1.goals) as player1Goals,
       sum(md2.goals) as player2Goals,
       sum(md1.assists) as player1Assists,
       sum(md2.assists) as player2Assists,
       count(md1) as player1Appearances,
       count(md2) as player2Appearances
```

#### Get Top Performers by Category

```cypher
// Question: "Who are the top scorers this season?"
MATCH (p:Player)-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture {season: $season})
RETURN p.name as player,
       sum(md.goals) as totalGoals,
       sum(md.assists) as totalAssists,
       count(md) as appearances,
       toFloat(sum(md.goals)) / count(md) as goalsPerGame
ORDER BY totalGoals DESC
LIMIT 10
```

### 6. Temporal Analysis Queries

#### Get Consecutive Appearances

```cypher
// Question: "What's the longest consecutive streak of weekends I've played?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
WITH p, f.date as matchDate
ORDER BY f.date
WITH p, collect(matchDate) as dates
UNWIND range(0, size(dates)-1) as idx
WITH p, dates[idx] as currentDate, dates[idx+1] as nextDate
WHERE nextDate IS NOT NULL
WITH p, currentDate, nextDate,
     duration.between(currentDate, nextDate).days as daysBetween
WHERE daysBetween <= 7
RETURN p.name as player,
       count(*) as consecutiveWeeks
```

#### Get Double Game Weeks

```cypher
// Question: "How many double game weeks have I played?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
WITH p, f.date as matchDate
ORDER BY f.date
WITH p, collect(matchDate) as dates
UNWIND range(0, size(dates)-1) as idx
WITH p, dates[idx] as currentDate, dates[idx+1] as nextDate
WHERE nextDate IS NOT NULL
WITH p, currentDate, nextDate,
     duration.between(currentDate, nextDate).days as daysBetween
WHERE daysBetween <= 3
RETURN p.name as player,
       count(*) as doubleGameWeeks
```

#### Get Clean Sheet Streaks

```cypher
// Question: "How many clean sheets have I had in a row?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
WHERE md.cleanSheets > 0 OR (md.class IN ['GK', 'DEF'] AND f.conceded = 0)
WITH p, f.date as matchDate
ORDER BY f.date
WITH p, collect(matchDate) as dates
UNWIND range(0, size(dates)-1) as idx
WITH p, dates[idx] as currentDate, dates[idx+1] as nextDate
WHERE nextDate IS NOT NULL
WITH p, currentDate, nextDate,
     duration.between(currentDate, nextDate).days as daysBetween
WHERE daysBetween <= 7
RETURN p.name as player,
       count(*) as consecutiveCleanSheets
```

### 7. Opposition Analysis Queries

#### Get Opposition Performance

```cypher
// Question: "How do we perform against specific opposition?"
MATCH (f:Fixture)-[:AGAINST]->(o:OppositionDetail {oppositionName: $oppositionName})
RETURN o.oppositionName as opposition,
       count(f) as totalMatches,
       sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
       sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) as draws,
       sum(CASE WHEN f.result = 'L' THEN 1 ELSE 0 END) as losses,
       sum(f.dorkiniansGoals) as goalsFor,
       sum(f.conceded) as goalsAgainst
```

#### Get Opposition Grounds

```cypher
// Question: "Where do we play our away games?"
MATCH (f:Fixture)-[:AGAINST]->(o:OppositionDetail)
WHERE f.awayTeam CONTAINS 'Dorkinians'
RETURN DISTINCT o.oppositionName as opposition,
       o.homeGround as ground,
       o.league as league,
       o.division as division
ORDER BY o.league, o.oppositionName
```

### 8. Milestone Queries

#### Get Next Milestone

```cypher
// Question: "Who will reach the next 100 goal milestone?"
MATCH (p:Player)-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
WITH p, sum(md.goals) as totalGoals
WHERE totalGoals >= 90
RETURN p.name as player,
       totalGoals as currentGoals,
       100 - totalGoals as goalsToMilestone
ORDER BY goalsToMilestone ASC
LIMIT 5
```

#### Get Player Milestones

```cypher
// Question: "What milestones have I reached?"
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
WITH p,
     sum(md.goals) as totalGoals,
     sum(md.assists) as totalAssists,
     count(md) as totalAppearances
RETURN p.name as player,
       totalGoals as goals,
       totalAssists as assists,
       totalAppearances as appearances,
       CASE
         WHEN totalGoals >= 100 THEN 'Century Scorer'
         WHEN totalGoals >= 50 THEN 'Half Century'
         WHEN totalGoals >= 25 THEN 'Quarter Century'
         ELSE 'Building Up'
       END as goalMilestone,
       CASE
         WHEN totalAppearances >= 100 THEN 'Century Appearances'
         WHEN totalAppearances >= 50 THEN 'Half Century'
         WHEN totalAppearances >= 25 THEN 'Quarter Century'
         ELSE 'Building Up'
       END as appearanceMilestone
```

## 🚀 Performance Optimization Tips

### 1. Use Indexes

- Always query on indexed properties first
- Use composite indexes for multi-property queries
- Leverage relationship indexes for path queries

### 2. Limit Results

- Use `LIMIT` clauses for large result sets
- Implement pagination for long lists
- Cache frequently requested data

### 3. Optimize Patterns

- Start queries from the most selective node
- Use `OPTIONAL MATCH` sparingly
- Prefer `MATCH` over `OPTIONAL MATCH` when possible

### 4. Data Aggregation

- Use `WITH` clauses to break complex queries
- Aggregate data at the database level
- Avoid client-side data processing

## 🔧 Query Parameters

### Common Parameters

- `$playerName`: Player's full name
- `$teamName`: Team name (1st XI, 2nd XI, etc.)
- `$season`: Season identifier (2016-17, 2017-18, etc.)
- `$oppositionName`: Opposition team name
- `$startDate`: Start date for date ranges
- `$endDate`: End date for date ranges

### Parameter Examples

```cypher
:param playerName => 'James Tain';
:param teamName => '1st XI';
:param season => '2016-17';
:param oppositionName => 'Opposition FC';
:param startDate => date('2016-09-01');
:param endDate => date('2017-05-31');
```

## 📈 Expected Performance

### Simple Queries (< 10ms)

- Player name lookups
- Basic team information
- Single fixture details

### Medium Queries (10-100ms)

- Player season totals
- Team performance summaries
- Basic statistical aggregations

### Complex Queries (100-500ms)

- Historical trends
- Comparative analysis
- Multi-season statistics

### Advanced Queries (500ms+)

- Complex player comparisons
- Multi-dimensional analysis
- Predictive modeling queries

## 🧪 Testing Queries

### Test Data Setup

Use the `scripts/sample-data-queries.cypher` file to populate test data.

### Query Validation

```cypher
-- Test query performance
PROFILE MATCH (p:Player {name: 'James Tain'})-[:PERFORMED_IN]->(md:MatchDetail)
RETURN p.name, sum(md.goals) as totalGoals;

-- Check query plan
EXPLAIN MATCH (p:Player {name: 'James Tain'})-[:PERFORMED_IN]->(md:MatchDetail)
RETURN p.name, sum(md.goals) as totalGoals;
```

### Performance Monitoring

```cypher
-- Check index usage
CALL db.indexes();

-- Monitor query performance
CALL dbms.listTransactions();
```
