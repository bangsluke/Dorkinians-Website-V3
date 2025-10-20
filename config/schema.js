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
      'APP': 'appearances',
      'MIN': 'minutes',
      'MOM': 'mom',
      'G': 'goals',
      'A': 'assists',
      'Y': 'yellowCards',
      'R': 'redCards',
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
      'HomeGames%Won': 'homeGamesPercentWon',
      'AwayGames': 'awayGames',
      'AwayWins': 'awayWins',
      'AwayGames%Won': 'awayGamesPercentWon',
      'Games%Won': 'gamesPercentWon',
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
      yellowCards: { type: 'integer', required: false },
      redCards: { type: 'integer', required: false },
      saves: { type: 'integer', required: false },
      ownGoals: { type: 'integer', required: false },
      conceded: { type: 'integer', required: false },
      cleanSheets: { type: 'integer', required: false },
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
      homeGamesPercentWon: { type: 'string', required: false },
      awayGames: { type: 'integer', required: false },
      awayWins: { type: 'integer', required: false },
      awayGamesPercentWon: { type: 'string', required: false },
      gamesPercentWon: { type: 'string', required: false },
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
      'SEASON WEEK NUM REF': 'seasonWeek',
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
      'DORKINIANS GOALS': 'dorkiniansGoals',
      'CONCEDED': 'conceded',
      'EXTRACTED PICKER': 'extractedPicker',
    },
    requiredColumns: ['ID', 'SEASON', 'SEASON WEEK NUM REF', 'DATE', 'TEAM', 'COMP TYPE', 'COMPETITION', 'OPPOSITION', 'HOME/AWAY', 'RESULT', 'HOME SCORE', 'AWAY SCORE'],
    nodeType: 'Fixture',
    properties: {
      id: { type: 'string', required: true },
      season: { type: 'string', required: true },
      seasonWeek: { type: 'string', required: true },
      date: { type: 'date', required: true },
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
      extractedPicker: { type: 'string', required: false }
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
      'SEASON WEEK': 'seasonWeek',
      'DATE': 'date',
      'TEAM': 'team',
      'PLAYER NAME': 'playerName',
      'MIN': 'minutes',
      'CLASS': 'class',
      'MOM': 'mom',
      'G': 'goals',
      'A': 'assists',
      'Y': 'yellowCards',
      'R': 'redCards',
      'SAVES': 'saves',
      'OG': 'ownGoals',
      'C': 'conceded',
      'CLS': 'cleanSheets',
      'PSC': 'penaltiesScored',
      'PM': 'penaltiesMissed',
      'PCO': 'penaltiesConceded',
      'PSV': 'penaltiesSaved',
      'IMPORTED_FIXTURE_DETAIL': 'importedFixtureDetail',
      'FTP': 'fantasyPoints'
    },
    requiredColumns: ['ID', 'SEASON', 'SEASON WEEK', 'DATE', 'TEAM', 'PLAYER NAME', 'MIN', 'CLASS'],
    nodeType: 'MatchDetail',
    properties: {
      id: { type: 'string', required: true },
      season: { type: 'string', required: true },
      seasonWeek: { type: 'string', required: true },
      date: { type: 'date', required: true },
      team: { type: 'string', required: true },
      playerName: { type: 'string', required: true },
      minutes: { type: 'integer', required: false },
      class: { type: 'string', required: false },
      mom: { type: 'integer', required: false },
      goals: { type: 'integer', required: false },
      assists: { type: 'integer', required: false },
      yellowCards: { type: 'integer', required: false },
      redCards: { type: 'integer', required: false },
      saves: { type: 'integer', required: false },
      ownGoals: { type: 'integer', required: false },
      conceded: { type: 'integer', required: false },
      cleanSheets: { type: 'integer', required: false },
      penaltiesScored: { type: 'integer', required: false },
      penaltiesMissed: { type: 'integer', required: false },
      penaltiesConceded: { type: 'integer', required: false },
      penaltiesSaved: { type: 'integer', required: false },
      importedFixtureDetail: { type: 'string', required: false },
      fantasyPoints: { type: 'number', required: false }
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
      'BEST FORMATION': 'bestFormation',  
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
      bestFormation: { type: 'string', required: false },
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
      'BEST FORMATION': 'bestFormation',
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
      bestFormation: { type: 'string', required: false },
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
    nodeType: 'PlayersOfTheMonth',
    properties: {
      id: { type: 'string', required: true },
      season: { type: 'string', required: true },
      date: { type: 'date', required: true },
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
    constraints: ['CREATE CONSTRAINT playerofmonth_id IF NOT EXISTS FOR (pm:PlayersOfTheMonth) REQUIRE pm.id IS UNIQUE']
  },

  // ============================================================================
  // TBL_CaptainsAndAwards - Captain appointments and awards (one node per season)
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
    requiredColumns: ['Item'],
    nodeType: 'CaptainsAndAwards',
    properties: {
      season: { type: 'string', required: true },
      clubCaptain: { type: 'string', required: false },
      firstXICaptains: { type: 'string', required: false },
      secondXICaptains: { type: 'string', required: false },
      thirdXICaptains: { type: 'string', required: false },
      fourthXICaptains: { type: 'string', required: false },
      fifthXICaptains: { type: 'string', required: false },
      sixthXICaptains: { type: 'string', required: false },
      seventhXICaptains: { type: 'string', required: false },
      eighthXICaptains: { type: 'string', required: false },
      vetsCaptain: { type: 'string', required: false },
      playerOfTheSeason: { type: 'string', required: false },
      youngPlayerOfTheSeason: { type: 'string', required: false },
      goldenBoot: { type: 'string', required: false },
      mostImprovedPlayer: { type: 'string', required: false },
      newcomerOfTheYear: { type: 'string', required: false },
      alanLambertSportsmanship: { type: 'string', required: false },
      chairmansCup: { type: 'string', required: false },
      peterMillsVolunteers: { type: 'string', required: false },
      goalkeeperOfTheYear: { type: 'string', required: false },
      firstXISquadPlayer: { type: 'string', required: false },
      secondXISquadPlayer: { type: 'string', required: false },
      thirdXISquadPlayer: { type: 'string', required: false },
      fourthXISquadPlayer: { type: 'string', required: false },
      fifthXISquadPlayer: { type: 'string', required: false },
      sixthXISquadPlayer: { type: 'string', required: false },
      seventhXISquadPlayer: { type: 'string', required: false },
      eighthXISquadPlayer: { type: 'string', required: false },
      vetsSquadPlayer: { type: 'string', required: false }
    },
    idPattern: 'captainaward_{season}',
    constraints: ['CREATE CONSTRAINT captainaward_id IF NOT EXISTS FOR (ca:CaptainsAndAwards) REQUIRE ca.id IS UNIQUE'],
    // Custom node creation logic - one node per season
    customNodeCreation: true
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
    nodeType: 'OppositionDetails',
    properties: {
      id: { type: 'string', required: true },
      opposition: { type: 'string', required: true },
      shortTeamName: { type: 'string', required: false },
      address: { type: 'string', required: false },
      distanceMiles: { type: 'number', required: false }
    },
    idPattern: 'opposition_{opposition}',
    constraints: ['CREATE CONSTRAINT OppositionDetails_id IF NOT EXISTS FOR (od:OppositionDetails) REQUIRE od.id IS UNIQUE']
  },

  // ============================================================================
  // TBL_TestData - Test data for development
  // ============================================================================
  TBL_TestData: {
    csvColumns: {
      'PLAYER NAME': 'playerName',
      'ALLOW ON SITE': 'allowOnSite',
      'APP': 'appearances',
      'MIN': 'minutes',
      'MOM': 'mom',
      'G': 'goals',
      'A': 'assists',
      'Y': 'yellowCards',
      'R': 'redCards',
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
      'HomeGames%Won': 'homeGamesPercentWon',
      'AwayGames': 'awayGames',
      'AwayWins': 'awayWins',
      'AwayGames%Won': 'awayGamesPercentWon',
      'Games%Won': 'gamesPercentWon',
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
      yellowCards: { type: 'integer', required: false },
      redCards: { type: 'integer', required: false },
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
      homeGamesPercentWon: { type: 'string', required: false },
      awayGames: { type: 'integer', required: false },
      awayWins: { type: 'integer', required: false },
      awayGamesPercentWon: { type: 'string', required: false },
      gamesPercentWon: { type: 'string', required: false },
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
    idPattern: 'test_{playerName}',
    constraints: ['CREATE CONSTRAINT testdata_id IF NOT EXISTS FOR (td:TestData) REQUIRE td.id IS UNIQUE']
  },



  // ============================================================================
  // TBL_LeagueTables - SKIPPED for memory optimization (web scraping disabled)
  // ============================================================================
  // TBL_LeagueTables: {
  //   csvColumns: {
  //     'Team': 'team',
  //     'Season': 'season',
  //     'URL_Type': 'urlType',
  //     'League_Name': 'leagueName',
  //     'HTML_Table_Number': 'htmlTableNumber',
  //     'URL': 'url'
  //   },
  //   requiredColumns: ['Team', 'Season', 'URL_Type', 'League_Name', 'HTML_Table_Number', 'URL'],
  //   nodeType: 'LeagueTable',
  //   properties: {
  //     id: { type: 'string', required: true },
  //     team: { type: 'string', required: true },
  //     season: { type: 'string', required: true },
  //     urlType: { type: 'string', required: true },
  //     leagueName: { type: 'string', required: true },
  //     htmlTableNumber: { type: 'integer', required: true },
  //     url: { type: 'string', required: true },
  //     lastUpdated: { type: 'datetime', required: false },
  //     standings: { type: 'string', required: false },
  //     totalTeams: { type: 'integer', required: false },
  //     htmlContent: { type: 'string', required: false },
  //     dataSource: { type: 'string', required: false },
  //     dataSourceUrl: { type: 'string', required: false }
  //   },
  //   idPattern: 'leaguetable_{season}_{team}',
  //   constraints: ['CREATE CONSTRAINT leaguetable_id IF NOT EXISTS FOR (lt:LeagueTable) REQUIRE lt.id IS UNIQUE']
  // },

  // ============================================================================
  // TBL_ExternalFixtures - SKIPPED for memory optimization (web scraping disabled)
  // ============================================================================
  // TBL_ExternalFixtures: {
  //   csvColumns: {
  //     'Team': 'team',
  //     'Season': 'season',
  //     'URL_Type': 'urlType',
  //     'League_Name': 'leagueName',
  //     'HTML_Table_Number': 'htmlTableNumber',
  //     'URL': 'url'
  //   },
  //   requiredColumns: ['Team', 'Season', 'URL_Type', 'League_Name', 'HTML_Table_Number', 'URL'],
  //   nodeType: 'ExternalFixture',
  //   properties: {
  //     id: { type: 'string', required: true },
  //     team: { type: 'string', required: true },
  //     season: { type: 'string', required: true },
  //     urlType: { type: 'string', required: true },
  //     leagueName: { type: 'string', required: true },
  //     htmlTableNumber: { type: 'integer', required: true },
  //     url: { type: 'string', required: true },
  //     lastUpdated: { type: 'datetime', required: false },
  //     fixtures: { type: 'string', required: false },
  //     totalTeams: { type: 'integer', required: false },
  //     htmlContent: { type: 'string', required: false },
  //     dataSource: { type: 'string', required: false },
  //     dataSourceUrl: { type: 'string', required: false }
  //   },
  //   idPattern: 'externalfixture_{season}_{team}',
  //   constraints: ['CREATE CONSTRAINT externalfixture_id IF NOT EXISTS FOR (ef:ExternalFixture) REQUIRE ef.id IS UNIQUE']
  // },

  // ============================================================================
  // TBL_ExternalResults - SKIPPED for memory optimization (web scraping disabled)
  // ============================================================================
  // TBL_ExternalResults: {
  //   csvColumns: {
  //     'Team': 'team',
  //     'Season': 'season',
  //     'URL_Type': 'urlType',
  //     'League_Name': 'leagueName',
  //     'HTML_Table_Number': 'htmlTableNumber',
  //     'URL': 'url'
  //   },
  //   requiredColumns: ['Team', 'Season', 'URL_Type', 'League_Name', 'HTML_Table_Number', 'URL'],
  //   nodeType: 'ExternalResult',
  //   properties: {
  //     id: { type: 'string', required: true },
  //     team: { type: 'string', required: true },
  //     season: { type: 'string', required: true },
  //     urlType: { type: 'string', required: true },
  //     leagueName: { type: 'string', required: true },
  //     htmlTableNumber: { type: 'integer', required: true },
  //     url: { type: 'string', required: true },
  //     lastUpdated: { type: 'datetime', required: false },
  //     results: { type: 'string', required: false },
  //     totalTeams: { type: 'integer', required: false },
  //     htmlContent: { type: 'string', required: false },
  //     dataSource: { type: 'string', required: false },
  //     dataSourceUrl: { type: 'string', required: false }
  //   },
  //   idPattern: 'externalresult_{season}_{team}',
  //   constraints: ['CREATE CONSTRAINT externalresult_id IF NOT EXISTS FOR (er:ExternalResult) REQUIRE er.id IS UNIQUE']
  // },

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
      // No properties on relationships - all data stored on MatchDetail nodes
      // This eliminates data duplication and simplifies queries
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
    conditions: 'p.playerName IN [wt.gk1, wt.def1, wt.def2, wt.def3, wt.def4, wt.def5, wt.mid1, wt.mid2, wt.mid3, wt.mid4, wt.mid5, wt.fwd1, wt.fwd2, wt.fwd3] AND wt.gk1 IS NOT NULL'
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
    to: 'PlayersOfTheMonth',
    type: 'IN_PLAYER_OF_THE_MONTH',
    properties: {
      position: { type: 'string', default: 'UNKNOWN' },
      monthlyPoints: { type: 'integer', default: 0 }
    },
    conditions: 'p.playerName IN [pm.player1Name, pm.player2Name, pm.player3Name, pm.player4Name, pm.player5Name]'
  },
  HAS_CAPTAIN_AWARDS: {
    from: 'Player',
    to: 'CaptainsAndAwards',
    type: 'HAS_CAPTAIN_AWARDS',
    properties: {
      season: { type: 'string', required: true },
      awardType: { type: 'string', required: true }
    },
    conditions: 'p.playerName IN [ca.clubCaptain, ca.firstXICaptains, ca.secondXICaptains, ca.thirdXICaptains, ca.fourthXICaptains, ca.fifthXICaptains, ca.sixthXICaptains, ca.seventhXICaptains, ca.eighthXICaptains, ca.vetsCaptain, ca.playerOfTheSeason, ca.youngPlayerOfTheSeason, ca.goldenBoot, ca.mostImprovedPlayer, ca.newcomerOfTheYear, ca.alanLambertSportsmanship, ca.chairmansCup, ca.peterMillsVolunteers, ca.goalkeeperOfTheYear, ca.firstXISquadPlayer, ca.secondXISquadPlayer, ca.thirdXISquadPlayer, ca.fourthXISquadPlayer, ca.fifthXISquadPlayer, ca.sixthXISquadPlayer, ca.seventhXISquadPlayer, ca.eighthXISquadPlayer, ca.vetsSquadPlayer]'
  },
  HAS_MATCH_DETAILS: {
    from: 'Fixture',
    to: 'MatchDetail',
    type: 'HAS_MATCH_DETAILS',
    properties: {},
    conditions: 'f.date = md.date AND md.id CONTAINS f.id'
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
  },
  // Opposition-specific relationships for "played against" queries
  PLAYED_AGAINST_OPPONENT: {
    from: 'Player',
    to: 'OppositionDetails',
    type: 'PLAYED_AGAINST_OPPONENT',
    properties: {
      timesPlayed: { type: 'integer', default: 1 },
      goalsScored: { type: 'integer', default: 0 },
      assists: { type: 'integer', default: 0 },
      lastPlayed: { type: 'date', required: false }
    },
    conditions: 'EXISTS { MATCH (p)-[:PLAYED_IN]->(md:MatchDetail)<-[:HAS_MATCH_DETAILS]-(f:Fixture) WHERE toLower(trim(f.opposition)) = toLower(trim(od.opposition)) }'
  },
  // TOTW to MatchDetail relationship for frontend data loading
  TOTW_HAS_DETAILS: {
    from: 'WeeklyTOTW',
    to: 'MatchDetail',
    type: 'TOTW_HAS_DETAILS',
    properties: {
      seasonWeek: { type: 'string', required: true }
    },
    conditions: 'wt.season + "-" + wt.week = md.seasonWeek'
  },
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
  },
  date: (value) => {
    if (value === null || value === undefined || value === '') return null;
    
    // Convert various date formats to YYYY-MM-DD
    const dateStr = value.toString().trim();
    
    // Handle "Sat, 10 Sep 2016" format (Fixture and PlayersOfTheMonth)
    if (dateStr.includes(',') && dateStr.includes(' ')) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
        }
      } catch (error) {
        console.warn(`Failed to parse date "${dateStr}": ${error.message}`);
      }
    }
    
    // Handle "2016/09/10" format (MatchDetail)
    if (dateStr.includes('/')) {
      try {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const year = parts[0];
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      } catch (error) {
        console.warn(`Failed to parse date "${dateStr}": ${error.message}`);
      }
    }
    
    // Handle "2016-09-10" format (already normalized)
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // Try to parse as a general date
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
      }
    } catch (error) {
      console.warn(`Failed to parse date "${dateStr}": ${error.message}`);
    }
    
    // If all else fails, return the original value
    console.warn(`Could not normalize date format: "${dateStr}"`);
    return dateStr;
  },
  datetime: (value) => {
    if (value === null || value === undefined || value === '') return null;
    
    // Handle ISO date strings
    if (typeof value === 'string' && value.includes('T')) {
      return new Date(value).toISOString();
    }
    
    // Try to parse other formats
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    return null;
  },
  json: (value) => {
    if (value === null || value === undefined || value === '') return null;
    
    // If already an object/array, return as is
    if (typeof value === 'object') {
      return value;
    }
    
    // If string, try to parse as JSON
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        console.warn(`Failed to parse JSON: ${error.message}`);
        return null;
      }
    }
    
    return null;
  }
};

// ============================================================================
// Validation Functions
// ============================================================================
const validators = {
  validateRequiredFields: (data, requiredColumns) => {
    const missing = requiredColumns.filter(col => {
      const value = data[col];
      if (value === null || value === undefined) return true;
      if (typeof value === 'string') return value.trim() === '';
      return false;
    });
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
