---
slug: /projects/dorkinians-website/stats-page
---

# Stats

> [< Back to Dorkinians Website](1DorkiniansWebsite.md)

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Navigation](#navigation)
  - [Stats Navigation Menu](#stats-navigation-menu)
- [Filters](#filters)
- [Player Stats](#player-stats)
  - [Player Stats Sections](#player-stats-sections)
  - [Player Stats Data Table](#player-stats-data-table)
- [Team Stats](#team-stats)
  - [Team Stats Sections](#team-stats-sections)
  - [Team Stats Data Table](#team-stats-data-table)
- [Club Stats](#club-stats)
  - [Club Stats Sections](#club-stats-sections)
  - [Club Stats Data Table](#club-stats-data-table)
- [Comparison](#comparison)
  - [Selecting Players](#selecting-players)
  - [Radar Charts](#radar-charts)
  - [Full Comparison](#full-comparison)

## Overview

The Stats section provides comprehensive statistics for players, teams, and the entire club, plus a player comparison section.

:::info
All statistics can be filtered by time range, team, location, opposition, competition, result, and position (where each is applicable).

To do this, tap the filter icon in the header to open the [filter sidebar](#filters).
:::

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/593s5JGk/Player_Stats_Mobile.png"
    alt="Player Stats Mobile Screenshot"
  />
  <img
    src="https://i.postimg.cc/zXG00MYX/Player_Stats_Desktop.png"
    alt="Player Stats Desktop Screenshot"
  />
</div>

> [Back to Table of Contents](#table-of-contents)

## Navigation

The Stats section has four main sub-pages accessible via swiping left or right on mobile devices or using the navigation menu on desktop devices:

- **[Player Stats](3StatsPage.md#player-stats)**: Individual player performance metrics
- **[Team Stats](3StatsPage.md#team-stats)**: Team-level statistics and analysis
- **[Club Stats](3StatsPage.md#club-stats)**: Club-wide statistics and analysis
- **[Comparison](3StatsPage.md#comparison)**: Side-by-side player comparison

:::info
Swipe left or right on mobile devices to quickly switch between Stats sub-pages.
:::

:::tip
You can also access the [navigation menu](#stats-navigation-menu) by tapping the burger menu icon in the header (that's the three horizontal lines) to see all available sections and jump directly to any one.
:::

### Stats Navigation Menu

The Stats Navigation Menu provides quick access to all sections within the Stats pages. 

- Access it by tapping the menu icon (three horizontal lines) in the header when viewing any Stats page.
- Expand the stats page you want to navigate to.
- Tap on any section to jump directly to it.

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/W1XXkqpq/Stats-Navigation-Mobile.png"
    alt="Stats Navigation Mobile Screenshot"
  />
</div>

:::tip
Use the Stats Navigation Menu to quickly jump to specific sections without scrolling through the entire page.
:::

> [Back to Table of Contents](#table-of-contents)

## Filters

Filters allow you to narrow down statistics to specific criteria. Available filter types include:

- Quick Filters: Filter statistics by quick time periods
- Time Range Filter: Filter statistics by specific seasons or date ranges
- Home vs Away Filter: Filter statistics by home or away matches
- Opposition Filter: Filter statistics by specific opposition teams
- Competition Filter: Filter statistics by specific competitions
- Result Filter: Filter statistics by match results

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/W3MZ0x6L/Stats_Filter_Mobile.png"
    alt="Stats Filter Mobile Screenshot"
  />
  <img
    src="https://i.postimg.cc/RZ6Ncj4t/Stats-Filter-Desktop.png"
    alt="Stats Filter Desktop Screenshot"
  />
</div>


**Using Filters:**
1. Tap the filter icon to open the filter sidebar
2. Select your desired filter criteria for each filter type
3. Click "Apply Filters" to apply your selections
4. Active filters appear as white pills below the header once back on the Stats page so you can see what filters are currently applied
5. Tap on a filter pill to quickly remove that specific filter
6. Tap "Clear All Filters" in the filter sidebar to remove all active filters

**Filter Persistence:**
- Filters persist when navigating between Stats sub-pages (Player Stats, Team Stats, Club Stats, Comparison)
- Filters are cleared when you change the selected player or team

:::tip
Combine multiple filters to create very specific queries. For example, filter by "This Season", "Home", and "Wins" to see how a player performs in home wins this season.
:::

:::warning
Filters persist when navigating between Stats sub-pages, so remember to clear filters if you want to see unfiltered data in a different section.
:::

> [Back to Table of Contents](#table-of-contents)

## Player Stats

The Player Stats section provides comprehensive statistics for individual players. Select a player using the player selector at the top of the page, then explore their performance across multiple categories.

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/593s5JGk/Player_Stats_Mobile.png"
    alt="Player Stats Mobile Screenshot"
  />
  <img
    src="https://i.postimg.cc/zXG00MYX/Player_Stats_Desktop.png"
    alt="Player Stats Desktop Screenshot"
  />
</div>

### Player Stats Sections

1. **Key Performance Stats** - displays some of the most important metrics for the selected player, including Appearances, Minutes played, Seasons count, Man of the Match awards, Goals scored, and Assists
2. **Seasonal Performance** - shows how the player's statistics have changed across different seasons displayed in a column chart to show trends over time - with the ability to change which metric is displayed in the chart
3. **Team Performance** - shows how the player performs for different teams within the club displayed in a column chart to show trends over time - with the ability to change which metric is displayed in the chart
4. **Positional Stats** - displays statistics broken down by the position the player played in (Goalkeeper, Defender, Midfielder, Forward), including appearances and minutes played in each position

:::info
Position is determined by the captain's assessment of where the player played the majority of each match.
:::

5. **Match Results** - shows the player's record in matches, such as games won, drawn, and lost, and average points per game
6. **Game Details** - provides a summary of how many games were played in League, Cup, and Friendly matches, how many home and away games the player has played, and some other stats such as how many teammates they have played with
7. **Monthly Performance** - shows statistics broken down by month, helping identify best performing months - with the ability to change which metric is displayed in the chart
8. **Defensive Record** - focuses on defensive statistics, including clean sheets, goals conceded and goals conceded per appearance

:::info
If the player selected has ever played as a goalkeeper, the Defensive Record section will also include goalkeeper specific statistics such as saves
:::

9. **Distance Travelled** - shows the total distance round trip the player has traveled to away matches, calculated from the club's home ground (Pixham Sports Ground) to each opposition ground
10. **Opposition Locations** - displays a map showing all the locations where the player has played away matches, providing a visual representation of their travel history
11. **Opposition Performance** - shows how the player performs against different opposition teams, rated by Goals and Assists per appearance against each opposition
12. **Fantasy Points** - displays the player's fantasy football points total and breakdown, as well as the player's highest scoring week and month

:::info
Fantasy points are calculated using the standard Premier League fantasy football scoring system - see the [Points System](4TOTWPage.md#points-system) section for more details.
:::

13. **Card Stats** - displays the player's yellow and red card statistics and how much it has cost them
14. **Penalty Stats** - displays the player's penalty statistics, including penalties scored, penalties missed, penalties conceded, and penalties saved - in and out of penalty shootouts
15. **Minutes per Stats** - displays efficiency metrics, displaying how many minutes of play are required for various statistics including minutes per goal, minutes per assist and minutes per clean sheet
16. **Captaincies, Awards and Achievements** - displays the player's captaincies, awards and achievements, including Team of the Week appearances, Player of the Month awards, and Milestone achievements

> [Back to Table of Contents](#table-of-contents)

### Player Stats Data Table

The Data Table section provides a comprehensive table of all player statistics. To access this, click the "Switch to Data Table" button in the page header.

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/76xYbL9x/Player-Stats-Table-Mobile.png"
    alt="Player Stats Data Table Mobile Screenshot"
  />
</div>

:::tip
You can click on any stat row in the data table to see a tooltip to help explain the stat.
:::

> [Back to Table of Contents](#table-of-contents)

<!-- TODO: Re-add the below section once the sharing functionality is implemented -->

<!-- ### Sharing Statistics

The Player Stats section includes functionality to share player statistics as images. This feature allows you to create and share visual representations of player performance data.

**Accessing Share Functionality:**

1. **Share Button**: Look for the share button in the Player Stats section (typically located near the player selector or in the header)
2. **Select Visualization**: Choose which visualization you want to share from the available options
3. **Customize Appearance**: Select a background color (yellow or green) for your shared image
4. **Generate and Share**: The app will generate an image that you can share via your device's sharing options

**Available Visualizations for Sharing:**

- **Seasonal Performance**: Bar chart showing performance across seasons
- **Team Performance**: Bar chart showing performance by team
- **Positional Stats**: Visualization of appearances by position
- **Match Results**: Pie chart of wins, draws, and losses
- **Game Details**: Summary of game statistics
- **Defensive Record**: Defensive statistics visualization
- **Card Stats**: Yellow and red card statistics
- **Penalty Stats**: Penalty-related statistics
- **Fantasy Points**: Fantasy points breakdown
- **Distance Travelled**: Distance traveled visualization
- **Minutes per Stats**: Efficiency metrics visualization
- **Monthly Performance**: Monthly performance chart
- **Awards and Achievements**: Awards and achievements display

**Sharing Options:**

- **Web Share API**: On supported devices, you can share directly to social media, messaging apps, or other installed apps
- **Download**: On devices without Web Share API support, the image is automatically downloaded to your device
- **iOS Preview**: On iOS devices, a preview is shown before sharing
- **Image Format**: Shared images are saved as PNG files with the player's name in the filename

**Customization:**

- **Background Colors**: Choose between yellow (Dorkinians yellow) or green background colors
- **Filter Inclusion**: The shared image includes information about any active filters applied to the statistics
- **Player Information**: The shared image includes the player's name and key statistics

:::info
The share functionality generates a high-quality 1080x1080 pixel image optimized for social media sharing.
:::

:::tip
Use the share functionality to create personalized statistics cards for social media posts, team communications, or personal records.
:::

:::warning
Share functionality may not be available on all devices or browsers. If the share button is not visible, the feature may be temporarily disabled or not supported on your device.
:::

> [Back to Table of Contents](#table-of-contents) -->

## Team Stats

The Team Stats section provides statistics and analysis for individual teams within the club. Select a team using the team selector, then explore their performance across multiple categories.

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/jqXM6T9c/Team_Stats_Mobile.png"
    alt="Team Stats Mobile Screenshot"
  />
  <img
    src="https://i.postimg.cc/CLxmmtpM/Team_Stats_Desktop.png"
    alt="Team Stats Desktop Screenshot"
  />
</div>

### Team Stats Sections

1. **Key Performance Stats** - displays the most important metrics for the selected team, including player count, games, wins and goals
2. **Recent Form** - shows the team's performance in their most recent matches, displaying a form guide (W/D/L indicators) and goals scored and conceded in recent matches

:::tip
Click on a box to see the details of that fixture or use the "Show detail boxes" to see details such as home and away, league, cup and friendly
:::

3. **Top Players** - displays the best performing players for the selected team across various metrics, including top goal scorers, top assist providers, most appearances, highest fantasy points, and other key statistics
4. **Seasonal Performance** - shows how the team's statistics have changed across different seasons, including games, goals and other key metrics over time
5. **Match Results** - shows the team's record in matches, such as games won, drawn, and lost, and average points per game
6. **Goals Scored vs Conceded** - displays a comparison chart showing the relationship between goals scored and goals conceded, and the average goals scored and conceded per game
7. **Home vs Away Performance** - compares the team's performance at home versus away matches, showing home win percentage vs away win percentage to establish the home advantage gained by the team
8. **Key Team Stats** - displays important team-level statistics, including average points, goals and conceded per game, and other team metrics
9. **Unique Player Stats** - shows statistics about the unique counts of players who have represented the team, including number of unique players, number of unique goals scored, and other unique player-related metrics
10. **Best Season Finish** - displays the team's best league finish across all seasons

> [Back to Table of Contents](#table-of-contents)

### Team Stats Data Table

The Data Table section provides a comprehensive table of all player statistics. To access this, click the "Switch to Data Table" button in the page header.

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/26zhmrBF/Team-Stats-Table-Mobile.png"
    alt="Team Stats Data Table Mobile Screenshot"
  />
</div>

:::tip
You can click on any stat row in the data table to see a tooltip to help explain the stat.
:::

> [Back to Table of Contents](#table-of-contents)

## Club Stats

The Club Stats section provides club-wide statistics and comparisons across all teams. This section gives a comprehensive view of the entire club's performance.

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/bYTm0PMT/Club_Stats_Mobile.png"
    alt="Club Stats Mobile Screenshot"
  />
  <img
    src="https://i.postimg.cc/yY8vv5C7/Club_Stats_Desktop.png"
    alt="Club Stats Desktop Screenshot"
  />
</div>

### Club Stats Sections

1. **Key Performance Stats** - displays the most important club-wide metrics, including total games played across all teams, total wins, draws, and losses, total goals scored and conceded, overall win percentage and other club-level statistics
2. **Team Comparison** - allows you to compare statistics across different teams within the club, showing an overlaid radar chart across various metrics
3. **Top Players** - displays the best performing players across the entire club, including top goal scorers, top assist providers, most appearances, highest fantasy points, and other club-wide player rankings
4. **Seasonal Performance** - shows how the club's overall statistics have changed across different seasons, displayed in a column chart to show trends over time - with the ability to change which metric is displayed in the chart
5. **Player Distribution** - shows how players are distributed across teams, including the number of players that have represented each team
6. **Player Tenure** - displays statistics about how long players have been with the club, by years of service
7. **Stats Distribution** - shows how various statistics are distributed across the club by position - with the ability to change which metric is displayed in the chart
8. **Match Results** - shows the club's record in matches, such as games won, drawn, and lost, and average points per game
9. **Game Details** - provides a summary of how many games were played in League, Cup, and Friendly matches, how many home and away games the club has played, and some other stats such as how many opposition teams the club has played against
10. **Big Club Numbers** - displays three impressive club-wide records
11. **Goals Scored vs Conceded** - displays a comparison chart showing the relationship between goals scored and goals conceded, and the average goals scored and conceded per game
12. **Home vs Away Performance** - compares the club's performance at home versus away matches, showing home win percentage vs away win percentage to establish the home advantage gained by the club
13. **Other Club Stats** - displays important club-level statistics, including average points, goals and conceded per game, and other club metrics
14. **Unique Player Stats** - shows statistics about the unique counts of players who have represented the club, including number of unique players, number of unique goalscorers and other unique player-related metrics

> [Back to Table of Contents](#table-of-contents)

### Club Stats Data Table

The Data Table section provides a comprehensive table of all club statistics. To access this, click the "Switch to Data Table" button in the page header.

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/bNszMWdD/Club-Stats-Table-Mobile.png"
    alt="Club Stats Data Table Mobile Screenshot"
  />
</div>

> [Back to Table of Contents](#table-of-contents)

## Comparison

The Comparison section allows you to compare multiple players side-by-side using interactive radar charts and detailed statistics.

<div className="sideBySide">
  <img
    src="https://i.postimg.cc/J7qp38gP/Player_Comparison_Mobile.png"
    alt="Player Comparison Mobile Screenshot"
  />
  <img
    src="https://i.postimg.cc/NfjppVvY/Player_Comparison_Desktop.png"
    alt="Player Comparison Desktop Screenshot"
  />
</div>

### Selecting Players

To compare players:

1. The first player is selected from the homepage. It can be changed using the pencil edit icon
2. Select the second player by clicking and searching for their name in the player selector

:::tip
The comparison page still works with filters (see the [Filters](#filters) section for more details).
:::

> [Back to Table of Contents](#table-of-contents)

### Radar Charts

A radar chart provides a visual comparison of the two selected players across various statistics. Each axis represents a different statistic, and each player is represented by a different colored area.

You can change the statistic being displayed in the chart using the dropdown above the chart.

:::tip
Click or touch on the radar to see a tooltip showing both player's values for that statistic.
:::

> [Back to Table of Contents](#table-of-contents)

### Full Comparison

Below the radar chart, you can see a full comparison table of the two players across all statistics. This is useful for seeing how the two players compare across all metrics.

:::tip
Click on a stat to see a tooltip to help explain the stat.
:::

> [Back to Table of Contents](#table-of-contents)