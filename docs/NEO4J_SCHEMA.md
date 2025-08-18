# Dorkinians FC Neo4j Database Schema

## 🎯 Schema Design Principles

### Primary Objectives
- **Temporal Analysis**: Efficient date-based queries for seasons, months, weeks
- **Player Performance**: Track individual stats across teams and time periods
- **Team Dynamics**: Analyze team performance and player contributions
- **Historical Trends**: Support complex statistical analysis and comparisons

### Performance Considerations
- **Indexed Properties**: Date fields, player names, team identifiers
- **Relationship Types**: Clear, semantic relationship naming
- **Property Optimization**: Store calculated values to avoid runtime computation
- **Graph Labeling**: Isolate data with `graphLabel: 'dorkiniansWebsite'`

## 🏗️ Core Node Labels

### 1. Player Nodes
```cypher
(:Player {
  id: String,                    // Unique identifier
  name: String,                  // Player full name
  allowOnSite: Boolean,          // Privacy flag
  mostPlayedForTeam: String,     // Most frequently played team (e.g., "3s")
  mostCommonPosition: String,    // Most common position (GK/DEF/MID/FWD)
  graphLabel: 'dorkiniansWebsite',
  createdAt: DateTime
})
```

### 2. Team Nodes
```cypher
(:Team {
  id: String,                    // Team identifier (1st XI, 2nd XI, etc.)
  name: String,                  // Team name
  season: String,                // Season reference
  league: String,                // League/division
  graphLabel: 'dorkiniansWebsite',
  createdAt: DateTime
})
```

### 3. Season Nodes
```cypher
(:Season {
  id: String,                    // Season identifier (2016-17, 2017-18, etc.)
  name: String,                  // Human readable name
  startYear: Integer,            // Start year
  endYear: Integer,              // End year
  isActive: Boolean,             // Current season flag
  graphLabel: 'dorkiniansWebsite',
  createdAt: DateTime
})
```

### 4. Fixture Nodes
```cypher
(:Fixture {
  id: String,                    // Unique fixture identifier
  seasonFixId: String,           // Season-specific fixture ID
  date: Date,                    // Match date
  homeTeam: String,              // Home team name
  awayTeam: String,              // Away team name
  homeScore: Integer,            // Home team score
  awayScore: Integer,            // Away team score
  result: String,                // Win/Draw/Loss
  competition: String,           // Competition type
  compType: String,              // Competition category
  status: String,                // Match status
  dorkiniansGoals: Integer,      // Goals scored by Dorkinians
  conceded: Integer,             // Goals conceded
  oppoOwnGoals: Integer,         // Opposition own goals
  fullResult: String,            // Complete result string
  graphLabel: 'dorkiniansWebsite',
  createdAt: DateTime
})
```

### 5. MatchDetail Nodes
```cypher
(:MatchDetail {
  id: String,                    // Unique match detail identifier
  fixtureId: String,             // Reference to fixture
  playerName: String,            // Player name
  team: String,                  // Team name
  date: Date,                    // Match date
  min: Integer,                  // Minutes played
  class: String,                 // Position/class
  mom: Boolean,                  // Man of the match
  goals: Integer,                // Goals scored
  assists: Integer,              // Assists provided
  yellowCards: Integer,          // Yellow cards received
  redCards: Integer,             // Red cards received
  saves: Integer,                // Goalkeeper saves
  ownGoals: Integer,             // Own goals scored
  penaltiesScored: Integer,      // Penalties scored
  penaltiesMissed: Integer,      // Penalties missed
  penaltiesConceded: Integer,    // Penalties conceded
  penaltiesSaved: Integer,       // Penalties saved
  graphLabel: 'dorkiniansWebsite',
  createdAt: DateTime
})
```

### 6. TOTW Nodes (Team of the Week)
```cypher
(:TOTW {
  id: String,                    // Unique TOTW identifier
  season: String,                // Season reference
  week: Integer,                 // Week number
  seasonWeekNumRef: String,      // Season-week reference
  dateLookup: String,            // Date reference
  seasonMonthRef: String,        // Season-month reference
  weekAdjusted: String,          // Adjusted week reference
  bestFormation: String,         // Best formation used
  totwScore: Float,              // TOTW score
  playerCount: Integer,          // Number of players
  starMan: String,               // Star man player
  starManScore: Float,           // Star man score
  playerLookups: String,         // Player lookup string
  gk1: String,                   // Goalkeeper 1
  def1: String,                  // Defender 1
  def2: String,                  // Defender 2
  def3: String,                  // Defender 3
  def4: String,                  // Defender 4
  def5: String,                  // Defender 5
  mid1: String,                  // Midfielder 1
  mid2: String,                  // Midfielder 2
  mid3: String,                  // Midfielder 3
  mid4: String,                  // Midfielder 4
  mid5: String,                  // Midfielder 5
  fwd1: String,                  // Forward 1
  fwd2: String,                  // Forward 2
  fwd3: String,                  // Forward 3
  graphLabel: 'dorkiniansWebsite',
  createdAt: DateTime
})
```

### 7. PlayerOfTheMonth Nodes
```cypher
(:PlayerOfTheMonth {
  id: String,                    // Unique identifier
  season: String,                // Season reference
  month: String,                 // Month name
  seasonMonthRef: String,        // Season-month reference
  playerName: String,            // Player name
  team: String,                  // Team name
  position: String,              // Player position
  goals: Integer,                // Goals scored
  assists: Integer,              // Assists provided
  cleanSheets: Integer,          // Clean sheets (defenders/GK)
  totwAppearances: Integer,      // TOTW appearances
  starManCount: Integer,         // Star man awards
  totalScore: Float,             // Total monthly score
  graphLabel: 'dorkiniansWebsite',
  createdAt: DateTime
})
```

### 8. CaptainAward Data (Table Format)
```typescript
// CaptainAward data will be loaded directly from CSV into tables
// No graph nodes needed - this is static reference data
interface CaptainAwardData {
  season: string
  team: string
  captain: string
  viceCaptain: string
  mostImproved: string
  playersPlayer: string
  managersPlayer: string
  topScorer: string
  topAssister: string
  mostCleanSheets: string
  mostTOTW: string
  mostStarMan: string
}
```

### 9. OppositionDetail Nodes
```cypher
(:OppositionDetail {
  id: String,                    // Unique identifier
  oppositionName: String,        // Opposition team name
  league: String,                // League name
  division: String,              // Division name
  homeGround: String,            // Home ground
  contactPerson: String,         // Contact person
  contactEmail: String,          // Contact email
  contactPhone: String,          // Contact phone
  graphLabel: 'dorkiniansWebsite',
  createdAt: DateTime
})
```

## 🔗 Relationship Types

### 1. Player Relationships
```cypher
// Player belongs to team in specific season
(:Player)-[:PLAYS_FOR {season: String, startDate: Date, endDate: Date}]->(:Team)

// Player appears in fixture
(:Player)-[:PLAYED_IN {minutes: Integer, position: String}]->(:Fixture)

// Player performance in match
(:Player)-[:PERFORMED_IN {goals: Integer, assists: Integer, cards: Integer}]->(:MatchDetail)

// Player selected in TOTW
(:Player)-[:SELECTED_IN {position: String, score: Float}]->(:TOTW)

// Player awarded monthly honors
(:Player)-[:AWARDED_MONTHLY {month: String, season: String}]->(:PlayerOfTheMonth)

// Player receives season awards (handled via table data, not graph relationships)
// Awards are queried directly from CaptainAward table data
```

### 2. Team Relationships
```cypher
// Team participates in season
(:Team)-[:PARTICIPATES_IN]->(:Season)

// Team plays in fixture
(:Team)-[:PLAYED_IN {homeAway: String}]->(:Fixture)

// Team competes in competition
(:Team)-[:COMPETES_IN {season: String}]->(:Competition)
```

### 3. Fixture Relationships
```cypher
// Fixture belongs to season
(:Fixture)-[:BELONGS_TO]->(:Season)

// Fixture involves opposition
(:Fixture)-[:AGAINST]->(:OppositionDetail)

// Fixture produces match details
(:Fixture)-[:GENERATED]->(:MatchDetail)
```

### 4. Temporal Relationships
```cypher
// Season contains fixtures
(:Season)-[:CONTAINS]->(:Fixture)

// Season has TOTW selections
(:Season)-[:HAS_TOTW]->(:TOTW)

// Month contains player awards
(:Season)-[:HAS_MONTHLY_AWARDS]->(:PlayerOfTheMonth)

// Note: CaptainAward data is handled as table data, not graph relationships
```

## 📊 Indexing Strategy

### Primary Indexes
```cypher
// Player name lookup
CREATE INDEX player_name_index FOR (p:Player) ON (p.name);

// Fixture date lookup
CREATE INDEX fixture_date_index FOR (f:Fixture) ON (f.date);

// Season identifier lookup
CREATE INDEX season_id_index FOR (s:Season) ON (s.id);

// Team name lookup
CREATE INDEX team_name_index FOR (t:Team) ON (t.name);

// Match detail player lookup
CREATE INDEX matchdetail_player_index FOR (md:MatchDetail) ON (md.playerName);

// TOTW season-week lookup
CREATE INDEX totw_season_week_index FOR (t:TOTW) ON (t.season, t.week);
```

### Composite Indexes
```cypher
// Player-team-season combination
CREATE INDEX player_team_season_index FOR (p:Player)-[:PLAYS_FOR]->(t:Team) ON (p.name, t.name, t.season);

// Fixture season-date combination
CREATE INDEX fixture_season_date_index FOR (f:Fixture) ON (f.season, f.date);
```

## 🚀 Query Optimization Patterns

### 1. Player Performance Queries
```cypher
// Get player stats for specific season
MATCH (p:Player {name: $playerName})-[:PLAYS_FOR]->(t:Team {season: $season})
MATCH (p)-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture {season: $season})
RETURN p.name, 
       sum(md.goals) as totalGoals,
       sum(md.assists) as totalAssists,
       count(md) as appearances
```

### 2. Team Performance Analysis
```cypher
// Get team performance over time
MATCH (t:Team {name: $teamName})-[:PARTICIPATES_IN]->(s:Season)
MATCH (t)-[:PLAYED_IN]->(f:Fixture)
RETURN s.name as season,
       count(f) as matches,
       sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
       sum(f.dorkiniansGoals) as goalsFor,
       sum(f.conceded) as goalsAgainst
ORDER BY s.startYear
```

### 3. Historical Trends
```cypher
// Get player goal scoring trends
MATCH (p:Player {name: $playerName})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
MATCH (f)-[:BELONGS_TO]->(s:Season)
RETURN s.name as season,
       sum(md.goals) as goals,
       count(md) as appearances,
       toFloat(sum(md.goals)) / count(md) as goalsPerGame
ORDER BY s.startYear
```

### 4. TOTW Analysis
```cypher
// Get player TOTW appearances by season
MATCH (p:Player {name: $playerName})-[:SELECTED_IN]->(t:TOTW)
RETURN t.season as season,
       count(t) as totwAppearances,
       sum(t.starManScore) as totalStarManScore
ORDER BY t.season
```

## 🔄 Data Loading Strategy

### 1. Initial Load Order
1. **Seasons** - Foundation for all temporal data
2. **Teams** - Team structure and relationships
3. **Players** - Player base data
4. **Fixtures** - Match schedule and results
5. **MatchDetails** - Individual player performances
6. **TOTW** - Weekly team selections
7. **PlayerOfTheMonth** - Monthly awards
8. **CaptainAward** - Season awards (loaded as table data, not graph nodes)
9. **OppositionDetail** - Opposition information

### 2. Relationship Creation
1. **Player-Team** relationships based on match appearances
2. **Fixture-Season** relationships for temporal grouping
3. **MatchDetail-Fixture** relationships for performance tracking
4. **TOTW-Season** relationships for weekly analysis
5. **Award-Player** relationships for recognition tracking (TOTW and monthly awards only)

### 3. Data Validation
- **Referential Integrity**: Ensure all relationships reference valid nodes
- **Data Consistency**: Validate calculated fields against source data
- **Duplicate Prevention**: Use unique identifiers and constraints
- **Graph Labeling**: Ensure all nodes have correct `graphLabel`

## 📈 Performance Monitoring

### Query Performance Metrics
- **Response Time**: Target < 100ms for simple queries
- **Memory Usage**: Monitor heap usage during complex operations
- **Index Hit Rate**: Ensure indexes are being utilized effectively
- **Relationship Traversal**: Optimize path finding queries

### Maintenance Operations
- **Regular Index Updates**: Rebuild indexes after major data loads
- **Statistics Updates**: Update database statistics for query planner
- **Data Archiving**: Archive old seasons to maintain performance
- **Connection Pooling**: Optimize Neo4j connection management

## 🎯 Expected Query Performance

### Simple Lookups (1-10ms)
- Player name searches
- Team information retrieval
- Basic fixture lookups

### Statistical Queries (10-100ms)
- Player season totals
- Team performance summaries
- Basic aggregations

### Complex Analysis (100-500ms)
- Historical trends
- Comparative analysis
- Multi-season statistics

### Advanced Analytics (500ms+)
- Complex player comparisons
- Multi-dimensional analysis
- Predictive modeling queries
