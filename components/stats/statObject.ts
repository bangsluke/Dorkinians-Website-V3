// Globally define an object containing stat objects that can be referenced in other functions.
const statObject = {
    APP: {
      statName: "Appearances",
      displayText: "Appearances:", // The text displayed at all times on the page.
      shortText: "Apps", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of appearances made by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Appearance Stat",
      iconName: "Appearance-Icon",
    },
    MIN: {
      statName: "Minutes",
      displayText: "Minutes played:", // The text displayed at all times on the page.
      shortText: "Mins", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of minutes played by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Appearance Stat",
      iconName: "Minutes-Icon",
    },
    MOM: {
      statName: "Man of the Matches",
      displayText: "Man of the Matches:", // The text displayed at all times on the page.
      shortText: "MoMs", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description:
        "The number of man of the match performances achieved by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "MoM-Icon",
    },
    AllGSC: {
      statName: "Goals Scored",
      displayText: "Goals scored:", // The text displayed at all times on the page.
      shortText: "Goals", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description:
        "The total number of goals scored by the player, including open play goals and penalties.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "Goals-Icon",
    },
    G: {
      statName: "Open Play Goals Scored",
      displayText: "Open Play Goals scored:", // The text displayed at all times on the page.
      shortText: "OP Goals", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description:
        "The number of goals scored by the player in open play (not including penalties).",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "Goals-Icon",
    },
    A: {
      statName: "Assists",
      displayText: "Assists provided:", // The text displayed at all times on the page.
      shortText: "Assists", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of assists provided by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "Assists-Icon",
    },
    Y: {
      statName: "Yellow Cards",
      displayText: "Yellow cards received:", // The text displayed at all times on the page.
      shortText: "Yel", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of yellow cards received by the player.",
      statHigherBetterBooleanArray: false,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "YellowCard-Icon",
    },
    R: {
      statName: "Red Cards",
      displayText: "Red cards received:", // The text displayed at all times on the page.
      shortText: "Red", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of red cards received by the player.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "RedCard-Icon",
    },
    SAVES: {
      statName: "Saves",
      displayText: "Saves produced:", // The text displayed at all times on the page.
      shortText: "SAVEs", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of saves made whilst playing as a Keeper.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "PenaltiesSaved-Icon",
    },
    OG: {
      statName: "Own Goals",
      displayText: "Own goals scored:", // The text displayed at all times on the page.
      shortText: "OGs", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of own goals scored by the player.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "OwnGoal-Icon",
    },
    C: {
      statName: "Conceded",
      displayText: "Goals conceded:", // The text displayed at all times on the page.
      shortText: "Con", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description:
        "The number of goals conceded whilst the player has been playing.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "Conceded-Icon",
    },
    CLS: {
      statName: "Clean Sheets",
      displayText: "Clean sheets achieved:", // The text displayed at all times on the page.
      shortText: "CLS", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of clean sheets achieved by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "CleanSheet-Icon",
    },
    PSC: {
      statName: "Penalties Scored",
      displayText: "Penalties scored:", // The text displayed at all times on the page.
      shortText: "Pens", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of penalties scored by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Penalty Stat",
      iconName: "PenaltiesScored-Icon",
    },
    PM: {
      statName: "Penalties Missed",
      displayText: "Penalties missed:", // The text displayed at all times on the page.
      shortText: "Pens Mis", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of penalties missed by the player.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Penalty Stat",
      iconName: "PenaltiesMissed-Icon",
    },
    PCO: {
      statName: "Penalties Conceded",
      displayText: "Penalties conceded:", // The text displayed at all times on the page.
      shortText: "Pens Con", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of penalties conceded by the player.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Penalty Stat",
      iconName: "PenaltiesConceded-Icon",
    },
    PSV: {
      statName: "Penalties Saved",
      displayText: "Penalties saved:", // The text displayed at all times on the page.
      shortText: "Pens Save", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of penalties saved by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Penalty Stat",
      iconName: "PenaltiesSaved-Icon",
    },
    FTP: {
      statName: "Fantasy Points",
      displayText: "Fantasy points achieved:", // The text displayed at all times on the page.
      shortText: "FTP", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of fantasy points achieved by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Performance Stat",
      iconName: "FantasyPoints-Icon",
    },
    GperAPP: {
      statName: "Goals Per Appearance",
      displayText: "Goals per app:", // The text displayed at all times on the page.
      shortText: "GperApp", // Used for short displays such as on the Comparison tab.
      statFormat: "Decimal2",
      description:
        "The average number of goals scored per appearance by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 1,
      statCategory: "Per App/Minute Stat",
      iconName: "GoalsPerAppearance-Icon",
    },
    CperAPP: {
      statName: "Conceded Per Appearance",
      displayText: "Goals conceded per app:", // The text displayed at all times on the page.
      shortText: "CperApp", // Used for short displays such as on the Comparison tab.
      statFormat: "Decimal2",
      description:
        "The average number of goals conceded per appearance by the player.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 1,
      statCategory: "Per App/Minute Stat",
      iconName: "ConcededPerAppearance-Icon",
    },
    MperG: {
      statName: "Minutes Per Goal",
      displayText: "Minutes per goal scored:", // The text displayed at all times on the page.
      shortText: "MperG", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description:
        "The average number of minutes needed by the player to score a goal.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Per App/Minute Stat",
      iconName: "MinutesPerGoal-Icon",
    },
    MperCLS: {
      statName: "Minutes Per Clean Sheet",
      displayText: "Minutes per clean sheet:", // The text displayed at all times on the page.
      shortText: "MperCLS", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description:
        "The average number of minutes needed by the player to achieve a clean sheet.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Per App/Minute Stat",
      iconName: "MinutesPerCleanSheet-Icon",
    },
    FTPperAPP: {
      statName: "Fantasy Points Per Appearance",
      displayText: "Fantasy points per app:", // The text displayed at all times on the page.
      shortText: "FTPperApp", // Used for short displays such as on the Comparison tab.
      statFormat: "Decimal2",
      description:
        "The average number of fantasy points scored per appearance by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 1,
      statCategory: "Per App/Minute Stat",
      iconName: "FantasyPointsPerAppearance-Icon",
    },
    DIST: {
      statName: "Distance Travelled",
      displayText: "Distance travelled:", // The text displayed at all times on the page.
      shortText: "Dist", // Used for short displays such as on the Comparison tab.
      statFormat: "Decimal1",
      description:
        "The distance travelled in miles by the player getting to away games.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 1,
      statCategory: "Appearance Stat",
      iconName: "DistanceTravelled-Icon",
    },
    "Games%Won": {
      statName: "Percentage Games Won",
      displayText: "% games won:", // The text displayed at all times on the page.
      shortText: "% Won", // Used for short displays such as on the Comparison tab.
      statFormat: "Percentage",
      description: "The percentage of games won by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Results Stat",
      iconName: "PercentageGamesWon-Icon",
    },
    HomeGames: {
      statName: "Home Games",
      displayText: "Home games:", // The text displayed at all times on the page.
      shortText: "H Apps", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of home games played by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Results Stat",
      iconName: "HomeGames-Icon",
    },
    HomeWins: {
      statName: "Home Wins",
      displayText: "Home wins:", // The text displayed at all times on the page.
      shortText: "H Wins", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of home games won by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Results Stat",
      iconName: "HomeWins-Icon",
    },
    "HomeGames%Won": {
      statName: "Percentage Home Games Won",
      displayText: "% home games won:", // The text displayed at all times on the page.
      shortText: "% H Won", // Used for short displays such as on the Comparison tab.
      statFormat: "Percentage",
      description: "The percentage of home games won by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Results Stat",
      iconName: "PercentageHomeGamesWon-Icon",
    },
    AwayGames: {
      statName: "Away Games",
      displayText: "Away games:", // The text displayed at all times on the page.
      shortText: "A Apps", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of away games played by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Results Stat",
      iconName: "AwayGames-Icon",
    },
    AwayWins: {
      statName: "Away Wins",
      displayText: "Away wins:", // The text displayed at all times on the page.
      shortText: "A Wins", // Used for short displays such as on the Comparison tab.
      statFormat: "Integer",
      description: "The number of away games won by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Results Stat",
      iconName: "AwayWins-Icon",
    },
    "AwayGames%Won": {
      statName: "Percentage Away Games Won",
      displayText: "% away games won:", // The text displayed at all times on the page.
      shortText: "% A Won", // Used for short displays such as on the Comparison tab.
      statFormat: "Percentage",
      description: "The percentage of away games won by the player.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Results Stat",
      iconName: "PercentageAwayGamesWon-Icon",
    },
    MostPlayedForTeam: {
      statName: "Most Played for Team",
      displayText: "Most played for team:", // The text displayed at all times on the page.
      shortText: "Most Play", // Used for short displays such as on the Comparison tab.
      statFormat: "String",
      description: "The Dorkinians team that the player has appeared for most.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Appearance Stat",
      iconName: "MostPlayedForTeam-Icon",
    },
    NumberTeamsPlayedFor: {
      statName: "Number of Teams Played for",
      displayText: "Number teams played for:", // The text displayed at all times on the page.
      shortText: "# Teams", // Used for short displays such as on the Comparison tab.
      statFormat: "String",
      description:
        "The number of Dorkinians teams that the player has appeared for.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Appearance Stat",
      iconName: "NumberTeamsPlayedFor-Icon",
    },
    NumberSeasonsPlayedFor: {
      statName: "Number of Seasons Played for",
      displayText: "Number seasons played for:", // The text displayed at all times on the page.
      shortText: "# Seasons", // Used for short displays such as on the Comparison tab.
      statFormat: "String",
      description:
        "The number of seasons that the player has played for Dorkinians since stats records began.",
      statHigherBetterBoolean: true,
      numberDecimalPlaces: 0,
      statCategory: "Appearance Stat",
      iconName: "NumberSeasonsPlayedFor-Icon",
    },
    MostScoredForTeam: {
      statName: "Most Scored for Team",
      displayText: "Most scored for team:", // The text displayed at all times on the page.
      shortText: "Most G", // Used for short displays such as on the Comparison tab.
      statFormat: "String",
      description: "The Dorkinians team that the player has scored the most for.",
      statHigherBetterBoolean: false,
      numberDecimalPlaces: 0,
      statCategory: "Appearance Stat",
      iconName: "MostScoredForTeam-Icon",
    },
  };