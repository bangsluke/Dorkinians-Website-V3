-- Dorkinians FC Neo4j Database Schema
-- This file contains all constraints, indexes, and initial setup

-- =====================================================
-- GRAPH LABEL CONSTANT
-- =====================================================
:param graphLabel => 'dorkiniansWebsite';

-- =====================================================
-- UNIQUE CONSTRAINTS
-- =====================================================

-- Player constraints
CREATE CONSTRAINT player_id_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT player_name_unique IF NOT EXISTS FOR (p:Player) REQUIRE p.name IS UNIQUE;

-- Team constraints
CREATE CONSTRAINT team_id_unique IF NOT EXISTS FOR (t:Team) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT team_season_name_unique IF NOT EXISTS FOR (t:Team) REQUIRE (t.season, t.name) IS UNIQUE;

-- Season constraints
CREATE CONSTRAINT season_id_unique IF NOT EXISTS FOR (s:Season) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT season_years_unique IF NOT EXISTS FOR (s:Season) REQUIRE (s.startYear, s.endYear) IS UNIQUE;

-- Fixture constraints
CREATE CONSTRAINT fixture_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT fixture_season_id_unique IF NOT EXISTS FOR (f:Fixture) REQUIRE (f.season, f.seasonFixId) IS UNIQUE;

-- MatchDetail constraints
CREATE CONSTRAINT matchdetail_id_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE md.id IS UNIQUE;
CREATE CONSTRAINT matchdetail_fixture_player_unique IF NOT EXISTS FOR (md:MatchDetail) REQUIRE (md.fixtureId, md.playerName) IS UNIQUE;

-- TOTW constraints
CREATE CONSTRAINT totw_id_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT totw_season_week_unique IF NOT EXISTS FOR (t:TOTW) REQUIRE (t.season, t.week) IS UNIQUE;

-- PlayersOfTheMonth constraints
CREATE CONSTRAINT playerofmonth_id_unique IF NOT EXISTS FOR (pom:PlayersOfTheMonth) REQUIRE pom.id IS UNIQUE;
CREATE CONSTRAINT playerofmonth_season_month_player_unique IF NOT EXISTS FOR (pom:PlayersOfTheMonth) REQUIRE (pom.season, pom.month, pom.playerName) IS UNIQUE;

-- CaptainAward constraints (REMOVED - handled as table data)
-- No constraints needed for table-based award data

-- OppositionDetail constraints
CREATE CONSTRAINT opposition_id_unique IF NOT EXISTS FOR (o:OppositionDetail) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT opposition_name_unique IF NOT EXISTS FOR (o:OppositionDetail) REQUIRE o.oppositionName IS UNIQUE;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Player indexes
CREATE INDEX player_name_index IF NOT EXISTS FOR (p:Player) ON (p.name);
CREATE INDEX player_allowonsite_index IF NOT EXISTS FOR (p:Player) ON (p.allowOnSite);

-- Team indexes
CREATE INDEX team_name_index IF NOT EXISTS FOR (t:Team) ON (t.name);
CREATE INDEX team_season_index IF NOT EXISTS FOR (t:Team) ON (t.season);
CREATE INDEX team_league_index IF NOT EXISTS FOR (t:Team) ON (t.league);

-- Season indexes
CREATE INDEX season_startyear_index IF NOT EXISTS FOR (s:Season) ON (s.startYear);
CREATE INDEX season_endyear_index IF NOT EXISTS FOR (s:Season) ON (s.endYear);
CREATE INDEX season_active_index IF NOT EXISTS FOR (s:Season) ON (s.isActive);

-- Fixture indexes
CREATE INDEX fixture_date_index IF NOT EXISTS FOR (f:Fixture) ON (f.date);
CREATE INDEX fixture_season_index IF NOT EXISTS FOR (f:Fixture) ON (f.season);
CREATE INDEX fixture_hometeam_index IF NOT EXISTS FOR (f:Fixture) ON (f.homeTeam);
CREATE INDEX fixture_awayteam_index IF NOT EXISTS FOR (f:Fixture) ON (f.awayTeam);
CREATE INDEX fixture_result_index IF NOT EXISTS FOR (f:Fixture) ON (f.result);
CREATE INDEX fixture_competition_index IF NOT EXISTS FOR (f:Fixture) ON (f.competition);

-- MatchDetail indexes
CREATE INDEX matchdetail_player_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.playerName);
CREATE INDEX matchdetail_team_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.team);
CREATE INDEX matchdetail_date_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.date);
CREATE INDEX matchdetail_fixtureid_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.fixtureId);
CREATE INDEX matchdetail_class_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.class);

-- TOTW indexes
CREATE INDEX totw_season_index IF NOT EXISTS FOR (t:TOTW) ON (t.season);
CREATE INDEX totw_week_index IF NOT EXISTS FOR (t:TOTW) ON (t.week);
CREATE INDEX totw_seasonweek_index IF NOT EXISTS FOR (t:TOTW) ON (t.seasonWeekNumRef);
CREATE INDEX totw_starman_index IF NOT EXISTS FOR (t:TOTW) ON (t.starMan);

-- PlayersOfTheMonth indexes
CREATE INDEX playerofmonth_season_index IF NOT EXISTS FOR (pom:PlayersOfTheMonth) ON (pom.season);
CREATE INDEX playerofmonth_month_index IF NOT EXISTS FOR (pom:PlayersOfTheMonth) ON (pom.month);
CREATE INDEX playerofmonth_player_index IF NOT EXISTS FOR (pom:PlayersOfTheMonth) ON (pom.playerName);
CREATE INDEX playerofmonth_team_index IF NOT EXISTS FOR (pom:PlayersOfTheMonth) ON (pom.team);

-- CaptainAward indexes (REMOVED - handled as table data)
-- No indexes needed for table-based award data

-- OppositionDetail indexes
CREATE INDEX opposition_league_index IF NOT EXISTS FOR (o:OppositionDetail) ON (o.league);
CREATE INDEX opposition_division_index IF NOT EXISTS FOR (o:OppositionDetail) ON (o.division);

-- =====================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- =====================================================

-- Player performance by season
CREATE INDEX player_season_performance_index IF NOT EXISTS FOR (p:Player)-[:PLAYS_FOR]->(t:Team) ON (p.name, t.season);

-- Fixture lookup by season and date
CREATE INDEX fixture_season_date_index IF NOT EXISTS FOR (f:Fixture) ON (f.season, f.date);

-- Match details by fixture and player
CREATE INDEX matchdetail_fixture_player_index IF NOT EXISTS FOR (md:MatchDetail) ON (md.fixtureId, md.playerName);

-- TOTW by season and week
CREATE INDEX totw_season_week_index IF NOT EXISTS FOR (t:TOTW) ON (t.season, t.week);

-- Player awards by season and month
CREATE INDEX playerofmonth_season_month_index IF NOT EXISTS FOR (pom:PlayersOfTheMonth) ON (pom.season, pom.month);

-- =====================================================
-- GRAPH LABEL INDEXES
-- =====================================================

-- Global graph label index for isolation
CREATE INDEX graph_label_index IF NOT EXISTS FOR (n) ON (n.graphLabel);

-- =====================================================
-- RELATIONSHIP INDEXES
-- =====================================================

-- Player relationships
CREATE INDEX relationship_plays_for_index IF NOT EXISTS FOR ()-[r:PLAYS_FOR]-() ON (r.season, r.startDate);

-- Fixture relationships
CREATE INDEX relationship_played_in_index IF NOT EXISTS FOR ()-[r:PLAYED_IN]-() ON (r.homeAway);

-- Match performance relationships
CREATE INDEX relationship_performed_in_index IF NOT EXISTS FOR ()-[r:PERFORMED_IN]-() ON (r.goals, r.assists);

-- TOTW selection relationships
CREATE INDEX relationship_selected_in_index IF NOT EXISTS FOR ()-[r:SELECTED_IN]-() ON (r.position, r.score);

-- =====================================================
-- TEXT INDEXES FOR SEARCH
-- =====================================================

-- Player name search
CREATE TEXT INDEX player_name_text_index IF NOT EXISTS FOR (p:Player) ON (p.name);

-- Team name search
CREATE TEXT INDEX team_name_text_index IF NOT EXISTS FOR (t:Team) ON (t.name);

-- Competition search
CREATE TEXT INDEX fixture_competition_text_index IF NOT EXISTS FOR (f:Fixture) ON (f.competition);

-- =====================================================
-- SCHEMA VALIDATION QUERIES
-- =====================================================

-- Verify all constraints are created
SHOW CONSTRAINTS;

-- Verify all indexes are created
SHOW INDEXES;

-- Check database statistics
CALL db.schema.visualization();

-- =====================================================
-- PERFORMANCE MONITORING QUERIES
-- =====================================================

-- Get index usage statistics
CALL db.indexes();

-- Get constraint information
CALL db.constraints();

-- Get database size information
CALL dbms.database.size();

-- =====================================================
-- CLEANUP COMMANDS (USE WITH CAUTION)
-- =====================================================

-- To drop all indexes (development only)
-- CALL db.indexes() YIELD name WITH name CALL db.dropIndex(name) RETURN count(*);

-- To drop all constraints (development only)
-- CALL db.constraints() YIELD name WITH name CALL db.dropConstraint(name) RETURN count(*);

-- To clear all data (development only)
-- MATCH (n {graphLabel: $graphLabel}) DETACH DELETE n;
