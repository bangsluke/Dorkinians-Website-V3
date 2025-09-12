-- Dorkinians FC Sample Data Queries
-- These queries demonstrate how to load and query data using the schema

-- =====================================================
-- SAMPLE DATA INSERTION
-- =====================================================

-- 1. Create Seasons
CREATE (s1:Season {
  id: '2016-17',
  name: '2016-17 Season',
  startYear: 2016,
  endYear: 2017,
  isActive: false,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (s2:Season {
  id: '2017-18',
  name: '2017-18 Season',
  startYear: 2017,
  endYear: 2018,
  isActive: false,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (s3:Season {
  id: '2023-24',
  name: '2023-24 Season',
  startYear: 2023,
  endYear: 2024,
  isActive: true,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
});

-- 2. Create Teams
CREATE (t1:Team {
  id: '1st-XI-2016-17',
  name: '1st XI',
  season: '2016-17',
  league: 'Premier Division',
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (t2:Team {
  id: '2nd-XI-2016-17',
  name: '2nd XI',
  season: '2016-17',
  league: 'Division 1',
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (t3:Team {
  id: '1st-XI-2023-24',
  name: '1st XI',
  season: '2023-24',
  league: 'Premier Division',
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
});

-- 3. Create Players
CREATE (p1:Player {
  id: 'player-james-tain',
  name: 'James Tain',
  allowOnSite: true,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (p2:Player {
  id: 'player-john-smith',
  name: 'John Smith',
  allowOnSite: true,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (p3:Player {
  id: 'player-mike-jones',
  name: 'Mike Jones',
  allowOnSite: false,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
});

-- 4. Create Fixtures
CREATE (f1:Fixture {
  id: 'fixture-001',
  seasonFixId: '2016-17-001',
  date: date('2016-09-03'),
  homeTeam: 'Dorkinians 1st XI',
  awayTeam: 'Opposition FC',
  homeScore: 3,
  awayScore: 1,
  result: 'W',
  competition: 'League',
  compType: 'Premier Division',
  status: 'FT',
  dorkiniansGoals: 3,
  conceded: 1,
  oppoOwnGoals: 0,
  fullResult: '3-1',
  season: '2016-17',
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (f2:Fixture {
  id: 'fixture-002',
  seasonFixId: '2016-17-002',
  date: date('2016-09-10'),
  homeTeam: 'Away Team FC',
  awayTeam: 'Dorkinians 1st XI',
  homeScore: 0,
  awayScore: 2,
  result: 'W',
  competition: 'League',
  compType: 'Premier Division',
  status: 'FT',
  dorkiniansGoals: 2,
  conceded: 0,
  oppoOwnGoals: 0,
  fullResult: '0-2',
  season: '2016-17',
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
});

-- 5. Create Match Details
CREATE (md1:MatchDetail {
  id: 'matchdetail-001',
  fixtureId: 'fixture-001',
  playerName: 'James Tain',
  team: '1st XI',
  date: date('2016-09-03'),
  min: 90,
  class: 'MID',
  mom: true,
  goals: 2,
  assists: 1,
  yellowCards: 0,
  redCards: 0,
  saves: 0,
  ownGoals: 0,
  penaltiesScored: 0,
  penaltiesMissed: 0,
  penaltiesConceded: 0,
  penaltiesSaved: 0,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (md2:MatchDetail {
  id: 'matchdetail-002',
  fixtureId: 'fixture-001',
  playerName: 'John Smith',
  team: '1st XI',
  date: date('2016-09-03'),
  min: 90,
  class: 'DEF',
  mom: false,
  goals: 0,
  assists: 0,
  yellowCards: 1,
  redCards: 0,
  saves: 0,
  ownGoals: 0,
  penaltiesScored: 0,
  penaltiesMissed: 0,
  penaltiesConceded: 0,
  penaltiesSaved: 0,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
})
CREATE (md3:MatchDetail {
  id: 'matchdetail-003',
  fixtureId: 'fixture-002',
  playerName: 'James Tain',
  team: '1st XI',
  date: date('2016-09-10'),
  min: 90,
  class: 'MID',
  mom: false,
  goals: 1,
  assists: 1,
  yellowCards: 0,
  redCards: 0,
  saves: 0,
  ownGoals: 0,
  penaltiesScored: 0,
  penaltiesMissed: 0,
  penaltiesConceded: 0,
  penaltiesSaved: 0,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
});

-- 6. Create TOTW
CREATE (totw1:TOTW {
  id: 'totw-2016-17-w1',
  season: '2016-17',
  week: 1,
  seasonWeekNumRef: '2016-17-1',
  dateLookup: '2016-09-03',
  seasonMonthRef: '2016-17-Sep',
  weekAdjusted: '1',
  bestFormation: '4-4-2',
  totwScore: 85.5,
  playerCount: 11,
  starMan: 'James Tain',
  starManScore: 9.2,
  playerLookups: 'James Tain,John Smith',
  gk1: 'Goalkeeper Name',
  def1: 'John Smith',
  def2: 'Defender 2',
  def3: 'Defender 3',
  def4: 'Defender 4',
  def5: '',
  mid1: 'James Tain',
  mid2: 'Midfielder 2',
  mid3: 'Midfielder 3',
  mid4: 'Midfielder 4',
  mid5: '',
  fwd1: 'Forward 1',
  fwd2: 'Forward 2',
  fwd3: '',
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
});

-- 7. Create Player of the Month
CREATE (pom1:PlayersOfTheMonth {
  id: 'pom-2016-17-sep',
  season: '2016-17',
  month: 'September',
  seasonMonthRef: '2016-17-Sep',
  playerName: 'James Tain',
  team: '1st XI',
  position: 'MID',
  goals: 3,
  assists: 2,
  cleanSheets: 0,
  totwAppearances: 1,
  starManCount: 1,
  totalScore: 28.5,
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
});

-- 8. Create Captain Award (REMOVED - handled as table data)
-- CaptainAward data will be loaded directly from CSV into tables
-- No graph nodes needed for this static reference data

-- 9. Create Opposition Detail
CREATE (od1:OppositionDetails {
  id: 'opposition-opposition-fc',
  oppositionName: 'Opposition FC',
  league: 'Premier Division',
  division: 'Premier',
  homeGround: 'Opposition Ground',
  contactPerson: 'Contact Person',
  contactEmail: 'contact@oppositionfc.com',
  contactPhone: '01234 567890',
  graphLabel: 'dorkiniansWebsite',
  createdAt: datetime()
});

-- =====================================================
-- RELATIONSHIP CREATION
-- =====================================================

-- Player-Team relationships
MATCH (p:Player {name: 'James Tain'})
MATCH (t:Team {name: '1st XI', season: '2016-17'})
CREATE (p)-[:PLAYS_FOR {season: '2016-17', startDate: date('2016-09-01'), endDate: date('2017-05-31')}]->(t);

MATCH (p:Player {name: 'John Smith'})
MATCH (t:Team {name: '1st XI', season: '2016-17'})
CREATE (p)-[:PLAYS_FOR {season: '2016-17', startDate: date('2016-09-01'), endDate: date('2017-05-31')}]->(t);

-- Team-Season relationships
MATCH (t:Team {name: '1st XI', season: '2016-17'})
MATCH (s:Season {id: '2016-17'})
CREATE (t)-[:PARTICIPATES_IN]->(s);

MATCH (t:Team {name: '2nd XI', season: '2016-17'})
MATCH (s:Season {id: '2016-17'})
CREATE (t)-[:PARTICIPATES_IN]->(s);

-- Fixture-Season relationships
MATCH (f:Fixture {id: 'fixture-001'})
MATCH (s:Season {id: '2016-17'})
CREATE (f)-[:BELONGS_TO]->(s);

MATCH (f:Fixture {id: 'fixture-002'})
MATCH (s:Season {id: '2016-17'})
CREATE (f)-[:BELONGS_TO]->(s);

-- Fixture-Opposition relationships
MATCH (f:Fixture {id: 'fixture-001'})
MATCH (o:OppositionDetails {oppositionName: 'Opposition FC'})
CREATE (f)-[:AGAINST]->(o);

-- MatchDetail-Fixture relationships
MATCH (md:MatchDetail {id: 'matchdetail-001'})
MATCH (f:Fixture {id: 'fixture-001'})
CREATE (md)-[:GENERATED_FROM]->(f);

MATCH (md:MatchDetail {id: 'matchdetail-002'})
MATCH (f:Fixture {id: 'fixture-001'})
CREATE (md)-[:GENERATED_FROM]->(f);

MATCH (md:MatchDetail {id: 'matchdetail-003'})
MATCH (f:Fixture {id: 'fixture-002'})
CREATE (md)-[:GENERATED_FROM]->(f);

-- Player-MatchDetail relationships
MATCH (p:Player {name: 'James Tain'})
MATCH (md:MatchDetail {id: 'matchdetail-001'})
CREATE (p)-[:PERFORMED_IN {goals: 2, assists: 1, cards: 0}]->(md);

MATCH (p:Player {name: 'John Smith'})
MATCH (md:MatchDetail {id: 'matchdetail-002'})
CREATE (p)-[:PERFORMED_IN {goals: 0, assists: 0, cards: 1}]->(md);

MATCH (p:Player {name: 'James Tain'})
MATCH (md:MatchDetail {id: 'matchdetail-003'})
CREATE (p)-[:PERFORMED_IN {goals: 1, assists: 1, cards: 0}]->(md);

-- TOTW-Season relationships
MATCH (t:TOTW {id: 'totw-2016-17-w1'})
MATCH (s:Season {id: '2016-17'})
CREATE (s)-[:HAS_TOTW]->(t);

-- Player-TOTW relationships
MATCH (p:Player {name: 'James Tain'})
MATCH (t:TOTW {id: 'totw-2016-17-w1'})
CREATE (p)-[:SELECTED_IN {position: 'MID', score: 9.2}]->(t);

MATCH (p:Player {name: 'John Smith'})
MATCH (t:TOTW {id: 'totw-2016-17-w1'})
CREATE (p)-[:SELECTED_IN {position: 'DEF', score: 7.8}]->(t);

-- Player-Monthly Award relationships
MATCH (p:Player {name: 'James Tain'})
MATCH (pom:PlayersOfTheMonth {id: 'pom-2016-17-sep'})
CREATE (p)-[:AWARDED_MONTHLY {month: 'September', season: '2016-17'}]->(pom);

-- Season-Monthly Awards relationships
MATCH (s:Season {id: '2016-17'})
MATCH (pom:PlayersOfTheMonth {id: 'pom-2016-17-sep'})
CREATE (s)-[:HAS_MONTHLY_AWARDS]->(pom);

-- Player-Season Award relationships (REMOVED - handled as table data)
-- CaptainAward relationships are not needed since awards are table data
-- Awards can be queried directly: "How many awards has James Tain won?"

-- =====================================================
-- SAMPLE QUERIES FOR TESTING
-- =====================================================

-- 1. Get all players for a specific team and season
MATCH (p:Player)-[:PLAYS_FOR]->(t:Team {name: '1st XI', season: '2016-17'})
RETURN p.name, t.name as team, t.season;

-- 2. Get player performance for a specific season
MATCH (p:Player {name: 'James Tain'})-[:PLAYS_FOR]->(t:Team {season: '2016-17'})
MATCH (p)-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture {season: '2016-17'})
RETURN p.name, 
       sum(md.goals) as totalGoals,
       sum(md.assists) as totalAssists,
       count(md) as appearances;

-- 3. Get team fixtures for a season
MATCH (t:Team {name: '1st XI', season: '2016-17'})-[:PARTICIPATES_IN]->(s:Season {id: '2016-17'})
MATCH (f:Fixture)-[:BELONGS_TO]->(s)
WHERE f.homeTeam CONTAINS '1st XI' OR f.awayTeam CONTAINS '1st XI'
RETURN f.date, f.homeTeam, f.awayTeam, f.homeScore, f.awayScore, f.result
ORDER BY f.date;

-- 4. Get TOTW selections for a player
MATCH (p:Player {name: 'James Tain'})-[:SELECTED_IN]->(t:TOTW)
RETURN t.season, t.week, t.starMan, t.starManScore
ORDER BY t.season, t.week;

-- 5. Get monthly awards for a season
MATCH (s:Season {id: '2016-17'})-[:HAS_MONTHLY_AWARDS]->(pom:PlayersOfTheMonth)
RETURN pom.month, pom.playerName, pom.totalScore
ORDER BY pom.month;

-- 6. Get season awards for a team (handled as table data)
-- CaptainAward data is loaded directly from CSV into tables
-- Query: SELECT * FROM captainAwards WHERE season = '2016-17' AND team = '1st XI'

-- 7. Get player goal scoring trends
MATCH (p:Player {name: 'James Tain'})-[:PERFORMED_IN]->(md:MatchDetail)
MATCH (md)-[:GENERATED_FROM]->(f:Fixture)
MATCH (f)-[:BELONGS_TO]->(s:Season)
RETURN s.name as season,
       sum(md.goals) as goals,
       count(md) as appearances,
       toFloat(sum(md.goals)) / count(md) as goalsPerGame
ORDER BY s.startYear;

-- 8. Get team performance summary
MATCH (t:Team {name: '1st XI', season: '2016-17'})-[:PARTICIPATES_IN]->(s:Season {id: '2016-17'})
MATCH (f:Fixture)-[:BELONGS_TO]->(s)
WHERE f.homeTeam CONTAINS '1st XI' OR f.awayTeam CONTAINS '1st XI'
RETURN t.name as team,
       s.name as season,
       count(f) as matches,
       sum(CASE WHEN f.result = 'W' THEN 1 ELSE 0 END) as wins,
       sum(CASE WHEN f.result = 'D' THEN 1 ELSE 0 END) as draws,
       sum(CASE WHEN f.result = 'L' THEN 1 ELSE 0 END) as losses,
       sum(f.dorkiniansGoals) as goalsFor,
       sum(f.conceded) as goalsAgainst;

-- 9. Get opposition teams
MATCH (f:Fixture)-[:AGAINST]->(o:OppositionDetails)
RETURN DISTINCT o.oppositionName, o.league, o.division
ORDER BY o.league, o.oppositionName;

-- 10. Get database statistics
MATCH (n {graphLabel: 'dorkiniansWebsite'})
RETURN labels(n) as nodeType,
       count(n) as count
ORDER BY count DESC;
