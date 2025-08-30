/**
 * Unified Schema Configuration for Dorkinians Website
 * 
 * ⚠️  DO NOT MODIFY THIS FILE DIRECTLY ⚠️
 * This file is automatically copied from database-dorkinians/config/schema.js
 * 
 * To update the schema:
 * 1. Edit the file in database-dorkinians/config/schema.js
 * 2. Run: npm run sync-config
 * 3. This file will be automatically updated
 * 
 * Auto-synced on 2025-08-30T20:58:32.327Z
 */
/**
 * Master
 * Unified Schema Configuration for Dorkinians Database
 * 
 * This file defines:
 * 1. CSV column mappings for each data source
 * 2. Neo4j node types and properties
 * 3. Required fields for validation
 * 4. Relationship definitions
 * 5. Data type mappings
 * 
 * TEST: Git hook should now work with batch file (enhanced debugging)
 */

const schema = {
  // ============================================================================
  // TBL_SiteDetails - Site configuration and metadata
  // ============================================================================
  TBL_SiteDetails: {
    csvColumns: {
      'Version Number': 'versionNumber',
      'Version Release Details': 'versionReleaseDetails',
      'Updates To Come': 'updatesToCome',
      'Last Updated Stats': 'lastUpdatedStats',
      'Page Details Last Refreshed': 'pageDetailsLastRefreshed',
      'Current Season': 'currentSeason',
      'Stat Limitations': 'statLimitations',
      'Stat Details': 'statDetails',
      'Games Counted': 'gamesCounted',
      'Games without all goals accounted': 'gamesWithoutAllGoalsAccounted',
      'Game rate with all goals accounted': 'gameRateWithAllGoalsAccounted',
      "Games without a MoM provided": 'gamesWithoutMoMProvided',
      "Game rate with a MoM accounted": 'gameRateWithMoMAccounted',
      "Dorkinians Goals Scored": 'dorkiniansGoalsScored',
      "Dorkinians Goals Conceded": 'dorkiniansGoalsConceded',
    },
    requiredColumns: ['Version Number', 'Current Season'],
    nodeType: 'SiteDetail',
    properties: {
      versionNumber: { type: 'string', required: true },
      currentSeason: { type: 'string', required: true },
      versionReleaseDetails: { type: 'string', required: false },
      updatesToCome: { type: 'string', required: false },
      lastUpdatedStats: { type: 'string', required: false },
      pageDetailsLastRefreshed: { type: 'string', required: false },
      statLimitations: { type: 'string', required: false },
      statDetails: { type: 'string', required: false },
      gamesCounted: { type: 'integer', required: false },
      gamesWithoutAllGoalsAccounted: { type: 'integer', required: false },
      gameRateWithAllGoalsAccounted: { type: 'string', required: false },
      gamesWithoutMoMProvided: { type: 'integer', required: false },
      gameRateWithMoMAccounted: { type: 'string', required: false },
      dorkiniansGoalsScored: { type: 'integer', required: false },
      dorkiniansGoalsConceded: { type: 'integer', required: false }
    },
    idPattern: 'site_{versionNumber}',
    constraints: ['CREATE CONSTRAINT site_detail_id IF NOT EXISTS FOR (sd:SiteDetail) REQUIRE sd.id IS UNIQUE']
  },

  // ============================================================================
  // TBL_Players - Player information and metadata
  // ============================================================================
  TBL_Players: {
    csvColumns: {
      'ID': 'id',
      'PLAYER NAME': 'playerName',
      'ALLOW ON SITE': 'allowOnSite',
      'APPEARANCES': 'appearances',
      'MIN': 'minutes',
      'MOM': 'mom',
      'G': 'goals',
      'A': 'assists',
      'Y': 'yellowCard',
      'R': 'redCard',
      'SAVES': 'saves',
      'OG': 'ownGoals',
      'C': 'conceded',
      'CLS': 'cleanSheets',
      'PSC': 'penaltiesScored',
      'PM': 'penaltiesMissed',
      'PCO': 'penaltiesConceded',
      'PSV': 'penaltiesSaved',
      'FTP': 'fantasyPoints',
      'AllGSC': 'allGoalsScored',
      'GperAPP': 'goalsPerApp',
      'CperAPP': 'concededPerApp',
      'MperG': 'minutesPerGoal',
      'MperCLS': 'minutesPerCleanSheet',
      'FTPperAPP': 'fantasyPointsPerApp',
      'DIST': 'distance',
      'HomeGames': 'homeGames',
      'HomeWins': 'homeWins',
      'HomeGames%Won': 'homeGamesWon',
      'AwayGames': 'awayGames',
      'AwayWins': 'awayWins',
      'AwayGames%Won': 'awayGamesWon',
      'Games%Won': 'gamesWon',
      '1sApps': 'apps1s',
      '2sApps': 'apps2s',
      '3sApps': 'apps3s',
      '4sApps': 'apps4s',
      '5sApps': 'apps5s',
      '6sApps': 'apps6s',
      '7sApps': 'apps7s',
      '8sApps': 'apps8s',
      'MostPlayedForTeam': 'mostPlayedForTeam',
      'NumberTeamsPlayedFor': 'numberTeamsPlayedFor',
      '1sGoals': 'goals1s',
      '2sGoals': 'goals2s',
      '3sGoals': 'goals3s',
      '4sGoals': 'goals4s',
      '5sGoals': 'goals5s',
      '6sGoals': 'goals6s',
      '7sGoals': 'goals7s',
      '8sGoals': 'goals8s',
      'MostScoredForTeam': 'mostScoredForTeam',
      '2016/17Apps': 'apps201617',
      '2017/18Apps': 'apps201718',
      '2018/19Apps': 'apps201819',
      '2019/20Apps': 'apps201920',
      '2020/21Apps': 'apps202021',
      '2021/22Apps': 'apps202122',
      'NumberSeasonsPlayedFor': 'numberSeasonsPlayedFor',
      '2016/17Goals': 'goals201617',
      '2017/18Goals': 'goals201718',
      '2018/19Goals': 'goals201819',
      '2019/20Goals': 'goals201920',
      '2020/21Goals': 'goals202021',
      '2021/22Goals': 'goals202122',
      'MostProlificSeason': 'mostProlificSeason',
      'GK': 'gk',
      'DEF': 'def',
      'MID': 'mid',
      'FWD': 'fwd',
      'MostCommonPosition': 'mostCommonPosition',
    },
    requiredColumns: ['ID', 'PLAYER NAME', 'ALLOW ON SITE'],
    nodeType: 'Player',
    properties: {
      id: { type: 'string', required: true },
      playerName: { type: 'string', required: true },
      allowOnSite: { type: 'boolean', required: true },
      appearances: { type: 'integer', required: false },
      minutes: { type: 'integer', required: false },
      mom: { type: 'integer', required: false },
      goals: { type: 'integer', required: false },
      assists: { type: 'integer', required: false },
      yellowCard: { type: 'integer', required: false },
      redCard: { type: 'integer', required: false },
      saves: { type: 'integer', required: false },
      ownGoals: { type: 'integer', required: false },
      penaltiesScored: { type: 'integer', required: false },
      penaltiesMissed: { type: 'integer', required: false },
      penaltiesConceded: { type: 'integer', required: false },
      penaltiesSaved: { type: 'integer', required: false },
      fantasyPoints: { type: 'number', required: false },
      allGoalsScored: { type: 'integer', required: false },
      goalsPerApp: { type: 'number', required: false },
      concededPerApp: { type: 'number', required: false },
      minutesPerGoal: { type: 'number', required: false },
      minutesPerCleanSheet: { type: 'number', required: false },
      fantasyPointsPerApp: { type: 'number', required: false },
      distance: { type: 'number', required: false },
      homeGames: { type: 'integer', required: false },
      homeWins: { type: 'integer', required: false },
      homeGamesWon: { type: 'string', required: false },
      awayGames: { type: 'integer', required: false },
      awayWins: { type: 'integer', required: false },
      awayGamesWon: { type: 'string', required: false },
      gamesWon: { type: 'string', required: false },
      apps1s: { type: 'integer', required: false },
      apps2s: { type: 'integer', required: false },
      apps3s: { type: 'integer', required: false },
      apps4s: { type: 'integer', required: false },
      apps5s: { type: 'integer', required: false },
      apps6s: { type: 'integer', required: false },
      apps7s: { type: 'integer', required: false },
      apps8s: { type: 'integer', required: false },
      mostPlayedForTeam: { type: 'string', required: false },
      numberTeamsPlayedFor: { type: 'integer', required: false },
      goals1s: { type: 'integer', required: false },
      goals2s: { type: 'integer', required: false },
      goals3s: { type: 'integer', required: false },
      goals4s: { type: 'integer', required: false },
      goals5s: { type: 'integer', required: false },
      goals6s: { type: 'integer', required: false },
      goals7s: { type: 'integer', required: false },
      goals8s: { type: 'integer', required: false },
      mostScoredForTeam: { type: 'string', required: false },
      apps201617: { type: 'integer', required: false },
      apps201718: { type: 'integer', required: false },
      apps201819: { type: 'integer', required: false },
      apps201920: { type: 'integer', required: false },
      apps202021: { type: 'integer', required: false },
      apps202122: { type: 'integer', required: false },
      numberSeasonsPlayedFor: { type: 'integer', required: false },
      goals201617: { type: 'integer', required: false },
      goals201718: { type: 'integer', required: false },
      goals201819: { type: 'integer', required: false },
      goals201920: { type: 'integer', required: false },
      goals202021: { type: 'integer', required: false },
      goals202122: { type: 'integer', required: false },
      mostProlificSeason: { type: 'string', required: false },
      gk: { type: 'integer', required: false },
      def: { type: 'integer', required: false },
      mid: { type: 'integer', required: false },
      fwd: { type: 'integer', required: false },
      mostCommonPosition: { type: 'string', required: false },
    },
    idPattern: 'player_{playerName}',
    constraints: ['CREATE CONSTRAINT player_id IF NOT EXISTS FOR (p:Player) REQUIRE p.id IS UNIQUE'],
    filters: {
      allowOnSite: (value) => value.toLowerCase() === 'true'
    }
  },

  // ============================================================================
  // TBL_FixturesAndResults - Match fixtures and results
  // ============================================================================
  TBL_FixturesAndResults: {
    csvColumns: {
      'ID': 'id',
      'SEASON': 'season',
      'DATE': 'date',
      'TEAM': 'team',
      'COMP TYPE': 'compType',
      'COMPETITION': 'competition',
      'OPPOSITION': 'opposition',
      'HOME/AWAY': 'homeOrAway',
      'RESULT': 'result',     
      'HOME SCORE': 'homeScore',
      'AWAY SCORE': 'awayScore',
      'STATUS': 'status',
      'OPPO OWN GOALS': 'oppoOwnGoals',
      'FULL RESULT': 'fullResult',
      'DORKINIAN GOALS': 'dorkiniansGoals',
      'CONCEDED': 'conceded',
      'EXTRACTED PICKED': 'extractedPicked',
    },
    requiredColumns: ['ID', 'SEASON', 'DATE', 'TEAM', 'COMP TYPE', 'COMPETITION', 'OPPOSITION', 'HOME/AWAY', 'RESULT', 'HOME SCORE', 'AWAY SCORE'],
    nodeType: 'Fixture',
    properties: {
      id: { type: 'string', required: true },
      season: { type: 'string', required: true },
      date: { type: 'string', required: true },
      team: { type: 'string', required: true },
      compType: { type: 'string', required: true },
      competition: { type: 'string', required: true },
      opposition: { type: 'string', required: true },
      homeOrAway: { type: 'string', required: true },
      result: { type: 'string', required: true },
      homeScore: { type: 'integer', required: false },
      awayScore: { type: 'integer', required: false },
      status: { type: 'string', required: false },
      oppoOwnGoals: { type: 'integer', required: false },
      fullResult: { type: 'string', required: false },
      dorkiniansGoals: { type: 'integer', required: false },
      conceded: { type: 'integer', required: false },
      extractedPicked: { type: 'string', required: false }
    },
    idPattern: 'fixture_{homeTeam}_{awayTeam}_{date}',
    constraints: ['CREATE CONSTRAINT fixture_id IF NOT EXISTS FOR (f:Fixture) REQUIRE f.id IS UNIQUE'],
    filters: {
      status: (value) => !['Void', 'Postponed', 'Abandoned'].includes(value)
    }
  },

  // ============================================================================
  // TBL_MatchDetails - Individual match performance data
  // ============================================================================
  TBL_MatchDetails: {
    csvColumns: {
      'ID': 'id',
      'SEASON': 'season',
      'DATE': 'date',
      'TEAM': 'team',
      'PLAYER NAME': 'playerName',
      'MIN': 'minutes',
      'CLASS': 'class',
      'MOM': 'mom',
      'G': 'goals',
      'A': 'assists',
      'Y': 'yellowCard',
      'R': 'redCard',
      'SAVES': 'saves',
      'OG': 'ownGoals',
      'PSC': 'penaltiesScored',
      'PM': 'penaltiesMissed',
      'PCO': 'penaltiesConceded',
      'PSV': 'penaltiesSaved',
      'IMPORTED_FIXTURE_DETAILS': 'importedFixtureDetails'
    },
    requiredColumns: ['ID', 'SEASON', 'DATE', 'TEAM', 'PLAYER NAME', 'MIN', 'CLASS'],
    nodeType: 'MatchDetail',
    properties: {
      id: { type: 'string', required: true },
      season: { type: 'string', required: true },
      date: { type: 'string', required: true },
      team: { type: 'string', required: true },
      playerName: { type: 'string', required: true },
      minutes: { type: 'integer', required: false },
      class: { type: 'string', required: false },
      mom: { type: 'integer', required: false },
      goals: { type: 'integer', required: false },
      assists: { type: 'integer', required: false },
      yellowCard: { type: 'integer', required: false },
      redCard: { type: 'integer', required: false },
      saves: { type: 'integer', required: false },
      ownGoals: { type: 'integer', required: false },
      penaltiesScored: { type: 'integer', required: false },
      penaltiesMissed: { type: 'integer', required: false },
      penaltiesConceded: { type: 'integer', required: false },
      penaltiesSaved: { type: 'integer', required: false },
      importedFixtureDetails: { type: 'string', required: false }
    },
    idPattern: 'match_{playerName}_{matchDate}',
    constraints: ['CREATE CONSTRAINT matchdetail_id IF NOT EXISTS FOR (md:MatchDetail) REQUIRE md.id IS UNIQUE']
  },

  // ============================================================================
  // TBL_WeeklyTOTW - Weekly Team of the Week awards
  // ============================================================================
  TBL_WeeklyTOTW: {
    csvColumns: {
      'ID': 'id',
      'SEASON': 'season',
      'WEEK': 'week',
      'TOTW SCORE': 'totwScore',
      'PLAYER COUNT': 'playerCount',
      'STAR MAN': 'starMan',
      'STAR MAN SCORE': 'starManScore',
      'GK1': 'gk1',
      'DEF1': 'def1',
      'DEF2': 'def2',
      'DEF3': 'def3',
      'DEF4': 'def4',
      'DEF5': 'def5',
      'MID1': 'mid1',
      'MID2': 'mid2',
      'MID3': 'mid3',
      'MID4': 'mid4',
      'MID5': 'mid5',
      'FWD1': 'fwd1',
      'FWD2': 'fwd2',
      'FWD3': 'fwd3',
    },
    requiredColumns: ['ID', 'SEASON', 'WEEK'],
    nodeType: 'WeeklyTOTW',
    properties: {
      id: { type: 'string', required: true },
      season: { type: 'string', required: true },
      week: { type: 'string', required: true },
      totwScore: { type: 'integer', required: false },
      playerCount: { type: 'integer', required: false },
      starMan: { type: 'string', required: false },
      starManScore: { type: 'integer', required: false },
      gk1: { type: 'string', required: false },
      def1: { type: 'string', required: false },
      def2: { type: 'string', required: false },
      def3: { type: 'string', required: false },
      def4: { type: 'string', required: false },
      def5: { type: 'string', required: false },
      mid1: { type: 'string', required: false },
      mid2: { type: 'string', required: false },
      mid3: { type: 'string', required: false },
      mid4: { type: 'string', required: false },
      mid5: { type: 'string', required: false },
      fwd1: { type: 'string', required: false },
      fwd2: { type: 'string', required: false },
      fwd3: { type: 'string', required: false }
    },
    idPattern: 'weeklytotw_{playerName}_{week}',
    constraints: ['CREATE CONSTRAINT weeklytotw_id IF NOT EXISTS FOR (wt:WeeklyTOTW) REQUIRE wt.id IS UNIQUE'],
    filters: {
      'TOTW SCORE': (value) => value && value.toString().trim() !== '' && value.toString().toLowerCase() !== 'n/a'
    }
  },

  // ============================================================================
  // TBL_SeasonTOTW - Season Team of the Week awards
  // ============================================================================
  TBL_SeasonTOTW: {
    csvColumns: {
      'ID': 'id',
      'SEASON': 'season',
      'TOTW SCORE': 'totwScore',
      'STAR MAN': 'starMan',
      'STAR MAN SCORE': 'starManScore',
      'GK1': 'gk1',
      'DEF1': 'def1',
      'DEF2': 'def2',
      'DEF3': 'def3',
      'DEF4': 'def4',
      'DEF5': 'def5',
      'MID1': 'mid1',
      'MID2': 'mid2',
      'MID3': 'mid3',
      'MID4': 'mid4',
      'MID5': 'mid5',
      'FWD1': 'fwd1',
      'FWD2': 'fwd2',
      'FWD3': 'fwd3',
    },
    requiredColumns: ['ID', 'SEASON'],
    nodeType: 'SeasonTOTW',
    properties: {
      id: { type: 'string', required: true },
      season: { type: 'string', required: true },
      totwScore: { type: 'integer', required: false },
      starMan: { type: 'string', required: false },
      starManScore: { type: 'integer', required: false },
      gk1: { type: 'string', required: false },
      def1: { type: 'string', required: false },
      def2: { type: 'string', required: false },
      def3: { type: 'string', required: false },
      def4: { type: 'string', required: false },
      def5: { type: 'string', required: false },
      mid1: { type: 'string', required: false },
      mid2: { type: 'string', required: false },
      mid3: { type: 'string', required: false },
      mid4: { type: 'string', required: false },
      mid5: { type: 'string', required: false },
      fwd1: { type: 'string', required: false },
      fwd2: { type: 'string', required: false },
      fwd3: { type: 'string', required: false }
    },
    idPattern: 'seasontotw_{playerName}_{season}',
    constraints: ['CREATE CONSTRAINT seasontotw_id IF NOT EXISTS FOR (st:SeasonTOTW) REQUIRE st.id IS UNIQUE'],
    filters: {
      'TOTW SCORE': (value) => value && value.toString().trim() !== '' && value.toString().toLowerCase() !== 'n/a'
    }
  },

  // ============================================================================
  // TBL_PlayersOfTheMonth - Monthly player awards
  // ============================================================================
  TBL_PlayersOfTheMonth: {
    csvColumns: {
      'ID': 'id',
      'SEASON': 'season',
      'DATE': 'date',
      '#1 Name': 'player1Name',
      '#1 Score': 'player1Score',
      '#2 Name': 'player2Name',
      '#2 Score': 'player2Score',
      '#3 Name': 'player3Name',
      '#3 Score': 'player3Score',
      '#4 Name': 'player4Name',
      '#4 Score': 'player4Score',
      '#5 Name': 'player5Name',
      '#5 Score': 'player5Score',
    },
    requiredColumns: ['ID', 'SEASON', 'DATE', '#1 Name', '#2 Name', '#3 Name', '#4 Name', '#5 Name'],
    nodeType: 'PlayerOfTheMonth',
    properties: {
      id: { type: 'string', required: true },
      season: { type: 'string', required: true },
      date: { type: 'string', required: true },
      player1Name: { type: 'string', required: false },
      player1Score: { type: 'integer', required: false },
      player2Name: { type: 'string', required: false },
      player2Score: { type: 'integer', required: false },
      player3Name: { type: 'string', required: false },
      player3Score: { type: 'integer', required: false },
      player4Name: { type: 'string', required: false },
      player4Score: { type: 'integer', required: false },
      player5Name: { type: 'string', required: false },
      player5Score: { type: 'integer', required: false }
    },
    idPattern: 'potm_{playerName}_{month}_{year}',
    constraints: ['CREATE CONSTRAINT playerofmonth_id IF NOT EXISTS FOR (pm:PlayerOfTheMonth) REQUIRE pm.id IS UNIQUE']
  },

  // ============================================================================
  // TBL_CaptainsAndAwards - Captain appointments and awards
  // ============================================================================
  TBL_CaptainsAndAwards: {
    csvColumns: {
      'Item': 'item',
      '2016/17': 'award201617',
      '2017/18': 'award201718',
      '2018/19': 'award201819',
      '2019/20': 'award201920',
      '2020/21': 'award202021',
      '2021/22': 'award202122',
      '2022/23': 'award202223',
      '2023/24': 'award202324',
      '2024/25': 'award202425',
      '2025/26': 'award202526',
      '2026/27': 'award202627',
    },
    requiredColumns: ['Item', '2016/17', '2017/18', '2018/19', '2019/20', '2020/21', '2021/22', '2022/23', '2023/24', '2024/25', '2025/26', '2026/27'],
    nodeType: 'CaptainAndAward',
    properties: {
      item: { type: 'string', required: true },
      award201617: { type: 'string', required: false },
      award201718: { type: 'string', required: false },
      award201819: { type: 'string', required: false },
      award201920: { type: 'string', required: false },
      award202021: { type: 'string', required: false },
      award202122: { type: 'string', required: false },
      award202223: { type: 'string', required: false },
      award202324: { type: 'string', required: false },
      award202425: { type: 'string', required: false },
      award202526: { type: 'string', required: false },
      award202627: { type: 'string', required: false }
    },
    idPattern: 'captainaward_{playerName}_{season}',
    constraints: ['CREATE CONSTRAINT captainaward_id IF NOT EXISTS FOR (ca:CaptainAndAward) REQUIRE ca.id IS UNIQUE']
  },

  // ============================================================================
  // TBL_OppositionDetails - Opposition team information
  // ============================================================================
  TBL_OppositionDetails: {
    csvColumns: {
      'ID': 'id',
      'OPPOSITION': 'opposition',
      'SHORT TEAM NAME': 'shortTeamName',
      'ADDRESS': 'address',
      'DISTANCE (MILES)': 'distanceMiles',
    },
    requiredColumns: ['ID', 'OPPOSITION'],
    nodeType: 'OppositionDetail',
    properties: {
      id: { type: 'string', required: true },
      opposition: { type: 'string', required: true },
      shortTeamName: { type: 'string', required: false },
      address: { type: 'string', required: false },
      distanceMiles: { type: 'number', required: false }
    },
    idPattern: 'opposition_{opposition}',
    constraints: ['CREATE CONSTRAINT oppositiondetail_id IF NOT EXISTS FOR (od:OppositionDetail) REQUIRE od.id IS UNIQUE']
  },

  // ============================================================================
  // TBL_TestData - Test data for development
  // ============================================================================
  TBL_TestData: {
    csvColumns: {
      'PLAYER NAME': 'playerName',
      'ALLOW ON SITE': 'allowOnSite',
      'APPEARANCES': 'appearances',
      'MIN': 'minutes',
      'MOM': 'mom',
      'G': 'goals',
      'A': 'assists',
      'Y': 'yellowCard',
      'R': 'redCard',
      'SAVES': 'saves',
      'OG': 'ownGoals',
      'C': 'conceded',
      'CLS': 'cleanSheets',
      'PSC': 'penaltiesScored',
      'PM': 'penaltiesMissed',
      'PCO': 'penaltiesConceded',
      'PSV': 'penaltiesSaved',
      'FTP': 'fantasyPoints',
      'AllGSC': 'allGoalsScored',
      'GperAPP': 'goalsPerApp',
      'CperAPP': 'concededPerApp',
      'MperG': 'minutesPerGoal',
      'MperCLS': 'minutesPerCleanSheet',
      'FTPperAPP': 'fantasyPointsPerApp',
      'DIST': 'distance',
      'HomeGames': 'homeGames',
      'HomeWins': 'homeWins',
      'HomeGames%Won': 'homeGamesWon',
      'AwayGames': 'awayGames',
      'AwayWins': 'awayWins',
      'AwayGames%Won': 'awayGamesWon',
      'Games%Won': 'gamesWon',
      '1sApps': 'apps1s',
      '2sApps': 'apps2s',
      '3sApps': 'apps3s',
      '4sApps': 'apps4s',
      '5sApps': 'apps5s',
      '6sApps': 'apps6s',
      '7sApps': 'apps7s',
      '8sApps': 'apps8s',
      'MostPlayedForTeam': 'mostPlayedForTeam',
      'NumberTeamsPlayedFor': 'numberTeamsPlayedFor',
      '1sGoals': 'goals1s',
      '2sGoals': 'goals2s',
      '3sGoals': 'goals3s',
      '4sGoals': 'goals4s',
      '5sGoals': 'goals5s',
      '6sGoals': 'goals6s',
      '7sGoals': 'goals7s',
      '8sGoals': 'goals8s',
      'MostScoredForTeam': 'mostScoredForTeam',
      '2016/17Apps': 'apps201617',
      '2017/18Apps': 'apps201718',
      '2018/19Apps': 'apps201819',
      '2019/20Apps': 'apps201920',
      '2020/21Apps': 'apps202021',
      '2021/22Apps': 'apps202122',
      'NumberSeasonsPlayedFor': 'numberSeasonsPlayedFor',
      '2016/17Goals': 'goals201617',
      '2017/18Goals': 'goals201718',
      '2018/19Goals': 'goals201819',
      '2019/20Goals': 'goals201920',
      '2020/21Goals': 'goals202021',
      '2021/22Goals': 'goals202122',
      'MostProlificSeason': 'mostProlificSeason',
      'GK': 'gk',
      'DEF': 'def',
      'MID': 'mid',
      'FWD': 'fwd',
      'MostCommonPosition': 'mostCommonPosition',
      'ALLTIMEFTPPOSRANK': 'allTimeFantasyPointsPositionRank',
    },
    requiredColumns: ['PLAYER NAME', 'ALLOW ON SITE', 'APP'],
    nodeType: 'TestData',
    properties: {
      playerName: { type: 'string', required: true },
      allowOnSite: { type: 'boolean', required: false },
      appearances: { type: 'integer', required: false },
      minutes: { type: 'integer', required: false },
      mom: { type: 'integer', required: false },
      goals: { type: 'integer', required: false },
      assists: { type: 'integer', required: false },
      yellowCard: { type: 'integer', required: false },
      redCard: { type: 'integer', required: false },
      saves: { type: 'integer', required: false },
      ownGoals: { type: 'integer', required: false },
      penaltiesScored: { type: 'integer', required: false },
      penaltiesMissed: { type: 'integer', required: false },
      penaltiesConceded: { type: 'integer', required: false },
      penaltiesSaved: { type: 'integer', required: false },
      fantasyPoints: { type: 'number', required: false },
      allGoalsScored: { type: 'integer', required: false },
      goalsPerApp: { type: 'number', required: false },
      concededPerApp: { type: 'number', required: false },
      minutesPerGoal: { type: 'number', required: false },
      minutesPerCleanSheet: { type: 'number', required: false },
      fantasyPointsPerApp: { type: 'number', required: false },
      distance: { type: 'number', required: false },
      homeGames: { type: 'integer', required: false },
      homeWins: { type: 'integer', required: false },
      homeGamesWon: { type: 'string', required: false },
      awayGames: { type: 'integer', required: false },
      awayWins: { type: 'integer', required: false },
      awayGamesWon: { type: 'string', required: false },
      gamesWon: { type: 'string', required: false },
      apps1s: { type: 'integer', required: false },
      apps2s: { type: 'integer', required: false },
      apps3s: { type: 'integer', required: false },
      apps4s: { type: 'integer', required: false },
      apps5s: { type: 'integer', required: false },
      apps6s: { type: 'integer', required: false },
      apps7s: { type: 'integer', required: false },
      apps8s: { type: 'integer', required: false },
      mostPlayedForTeam: { type: 'string', required: false },
      numberTeamsPlayedFor: { type: 'integer', required: false },
      goals1s: { type: 'integer', required: false },
      goals2s: { type: 'integer', required: false },
      goals3s: { type: 'integer', required: false },
      goals4s: { type: 'integer', required: false },
      goals5s: { type: 'integer', required: false },
      goals6s: { type: 'integer', required: false },
      goals7s: { type: 'integer', required: false },
      goals8s: { type: 'integer', required: false },
      mostScoredForTeam: { type: 'string', required: false },
      apps201617: { type: 'integer', required: false },
      apps201718: { type: 'integer', required: false },
      apps201819: { type: 'integer', required: false },
      apps201920: { type: 'integer', required: false },
      apps202021: { type: 'integer', required: false },
      apps202122: { type: 'integer', required: false },
      numberSeasonsPlayedFor: { type: 'integer', required: false },
      goals201617: { type: 'integer', required: false },
      goals201718: { type: 'integer', required: false },
      goals201819: { type: 'integer', required: false },
      goals201920: { type: 'integer', required: false },
      goals202021: { type: 'integer', required: false },
      goals202122: { type: 'integer', required: false },
      mostProlificSeason: { type: 'string', required: false },
      gk: { type: 'integer', required: false },
      def: { type: 'integer', required: false },
      mid: { type: 'integer', required: false },
      fwd: { type: 'integer', required: false },
      mostCommonPosition: { type: 'string', required: false },
      allTimeFantasyPointsPositionRank: { type: 'integer', required: false },
    },
    idPattern: 'test_{testField}',
    constraints: ['CREATE CONSTRAINT testdata_id IF NOT EXISTS FOR (td:TestData) REQUIRE td.id IS UNIQUE']
  },

  // ============================================================================
  // Team - Derived from Fixture data
  // ============================================================================
  Team: {
    csvColumns: {}, // Will be derived from Fixture data
    requiredColumns: [],
    nodeType: 'Team',
    properties: {
      name: { type: 'string', required: true }
    },
    idPattern: 'team_{name}',
    constraints: ['CREATE CONSTRAINT team_name IF NOT EXISTS FOR (t:Team) REQUIRE t.name IS UNIQUE']
  },

  // ============================================================================
  // Season - Derived from Fixture data
  // ============================================================================
  Season: {
    csvColumns: {}, // Will be derived from Fixture data
    requiredColumns: [],
    nodeType: 'Season',
    properties: {
      season: { type: 'string', required: true }
    },
    idPattern: 'season_{season}',
    constraints: ['CREATE CONSTRAINT season_name IF NOT EXISTS FOR (s:Season) REQUIRE s.season IS UNIQUE']
  }
};

// ============================================================================
// Relationship Definitions
// ============================================================================
const relationships = {
  PLAYED_IN: {
    from: 'Player',
    to: 'MatchDetail',
    type: 'PLAYED_IN',
    properties: {
      goals: { type: 'integer', default: 0 },
      assists: { type: 'integer', default: 0 },
      fantasyPoints: { type: 'integer', default: 0 },
      minutes: { type: 'integer', default: 0 },
      yellowCard: { type: 'boolean', default: false },
      redCard: { type: 'boolean', default: false },
      cleanSheet: { type: 'boolean', default: false },
      manOfMatch: { type: 'boolean', default: false }
    },
    conditions: 'p.playerName = md.playerName'
  },
  IN_WEEKLY_TOTW: {
    from: 'Player',
    to: 'WeeklyTOTW',
    type: 'IN_WEEKLY_TOTW',
    properties: {
      isStarMan: { type: 'boolean', default: false },
      ftpScore: { type: 'integer', default: 0 },
      position: { type: 'string', default: 'UNKNOWN' }
    },
    conditions: 'p.playerName IN [wt.gk1, wt.def1, wt.def2, wt.def3, wt.def4, wt.def5, wt.mid1, wt.mid2, wt.mid3, wt.mid4, wt.mid5, wt.fwd1, wt.fwd2, wt.fwd3]'
  },
  IN_SEASON_TOTW: {
    from: 'Player',
    to: 'SeasonTOTW',
    type: 'IN_SEASON_TOTW',
    properties: {
      isStarMan: { type: 'boolean', default: false },
      ftpScore: { type: 'integer', default: 0 },
      position: { type: 'string', default: 'UNKNOWN' }
    },
    conditions: 'p.playerName IN [st.gk1, st.def1, st.def2, st.def3, st.def4, st.def5, st.mid1, st.mid2, st.mid3, st.mid4, st.mid5, st.fwd1, st.fwd2, st.fwd3]'
  },
  IN_PLAYER_OF_THE_MONTH: {
    from: 'Player',
    to: 'PlayerOfTheMonth',
    type: 'IN_PLAYER_OF_THE_MONTH',
    properties: {
      position: { type: 'string', default: 'UNKNOWN' },
      monthlyPoints: { type: 'integer', default: 0 }
    },
    conditions: 'p.playerName IN [pm.player1Name, pm.player2Name, pm.player3Name, pm.player4Name, pm.player5Name]'
  },
  HAS_CAPTAIN_AWARDS: {
    from: 'Player',
    to: 'CaptainAndAward',
    type: 'HAS_CAPTAIN_AWARDS',
    properties: {
      season: { type: 'string', required: true }
    },
    conditions: 'p.playerName IN [ca.award201617, ca.award201718, ca.award201819, ca.award202021, ca.award202122, ca.award202223, ca.award202324, ca.award202425, ca.award202526, ca.award202627]'
  },
  HAS_MATCH_DETAILS: {
    from: 'Fixture',
    to: 'MatchDetail',
    type: 'HAS_MATCH_DETAILS',
    properties: {},
    conditions: 'f.date = md.date'
  },
  PLAYED_AGAINST: {
    from: 'Player',
    to: 'OppositionDetail',
    type: 'PLAYED_AGAINST',
    properties: {
      timesPlayedAgainst: { type: 'integer', default: 1 },
      lastPlayedAgainst: { type: 'string', default: null }
    },
    conditions: 'EXISTS { MATCH (md:MatchDetail {playerName: p.playerName}) MATCH (f:Fixture {opposition: od.opposition, date: md.date}) }'
  },
  // New relationships for improved chatbot capabilities
  PLAYED_WITH: {
    from: 'Player',
    to: 'Player',
    type: 'PLAYED_WITH',
    properties: {
      timesPlayedWith: { type: 'integer', default: 1 },
      lastPlayedWith: { type: 'string', default: null }
    },
    conditions: 'p1.playerName < p2.playerName'
  }
};

// ============================================================================
// Data Type Converters
// ============================================================================
const typeConverters = {
  string: (value) => value || '',
  integer: (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
  },
  number: (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  },
  float: (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  },
  boolean: (value) => {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  }
};

// ============================================================================
// Validation Functions
// ============================================================================
const validators = {
  validateRequiredFields: (data, requiredColumns) => {
    const missing = requiredColumns.filter(col => !data[col] || data[col].trim() === '');
    return {
      isValid: missing.length === 0,
      missingColumns: missing
    };
  },

  validateDataTypes: (data, schema) => {
    const errors = [];
    for (const [key, config] of Object.entries(schema.properties)) {
      if (data[key] !== undefined && config.type) {
        try {
          typeConverters[config.type](data[key]);
        } catch (error) {
          errors.push(`Invalid ${config.type} for ${key}: ${data[key]}`);
        }
      }
    }
    return errors;
  }
};

// ============================================================================
// Utility Functions
// ============================================================================
const utils = {
  generateId: (pattern, data) => {
    return pattern.replace(/\{(\w+)\}/g, (match, key) => {
      const value = data[key] || '';
      return value.toString().replace(/\s+/g, '_');
    });
  },

  mapCSVToProperties: (csvRow, tableSchema) => {
    const properties = {};
    for (const [csvCol, propName] of Object.entries(tableSchema.csvColumns)) {
      if (csvRow[csvCol] !== undefined) {
        properties[propName] = csvRow[csvCol];
      }
    }
    return properties;
  },

  getNeo4jConstraints: () => {
    const allConstraints = [];
    for (const tableSchema of Object.values(schema)) {
      if (tableSchema.constraints) {
        allConstraints.push(...tableSchema.constraints);
      }
    }
    return allConstraints;
  }
};

module.exports = {
  schema,
  relationships,
  typeConverters,
  validators,
  utils
};
