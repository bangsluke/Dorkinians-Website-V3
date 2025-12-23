# Dorkinians Stats

> [Back to Documentation Intro Contents](../../DocumentationIntro.md)

![Dorkinians Logo](https://i.imgur.com/6er1G1n.png)

## Table of Contents

- [Table of Contents](#table-of-contents)
- [To Do List](#to-do-list)
  - [Thursday](#thursday)
  - [Saturday](#saturday)
  - [Sunday/Monday](#sundaymonday)
  - [Monthly](#monthly)
- [Sheet Links](#sheet-links)
  - [Main Stats Sheets](#main-stats-sheets)
  - [Team Stats Sheets](#team-stats-sheets)
- [Details](#details)
  - [Sheets to maintain](#sheets-to-maintain)
  - [Control Panel](#control-panel)
  - [Stats Abbreviations](#stats-abbreviations)
- [How the stats site works](#how-the-stats-site-works)
- [Debugging Stats Problems](#debugging-stats-problems)
  - [Common Problems](#common-problems)
  - [Stat Errors](#stat-errors)
  - [Website Errors](#website-errors)
  - [Adding a Player](#adding-a-player)
  - [Adding an Opposition Team](#adding-an-opposition-team)
- [Useful Links](#useful-links)

## To Do List

### Thursday

- Look up the <a href="https://fulltime.thefa.com/fixtures.html?league=9031785&selectedSeason=495559713&selectedDivision=921408008&selectedCompetition=0&selectedFixtureGroupKey=1_313360010" target="_blank">fixtures from the FA Site</a> for each team and add them to the <a href="https://docs.google.com/spreadsheets/d/1yRYxEP4KtL1TZ7m9uFVw4CWJfyviNLwqXAmoqLtTVlc/edit?pli=1#gid=1820717347&range=A1" target="_blank">main sheet `Fixtures List` tab</a>

### Saturday

- Add results from the Dorkinians group chat or <a href="https://fulltime.thefa.com/results.html?league=9031785&selectedSeason=495559713&selectedDivision=921408008&selectedCompetition=0&selectedFixtureGroupKey=1_313360010" target="_blank">results from the FA Site</a> to the sheet so that when captains add stats, they have the right number of goals to allocate (can also be Sunday)

### Sunday/Monday

- Chase the captains to complete their [stats](#control-panel) and fix any problems they have
- ⁠Once all captains have done their stats, load the <a href="https://www.dorkiniansfcstats.co.uk/#team-of-the-week" target="_blank">website</a>, screenshot TOTW and post

### Monthly

- Post the Fantasy Player of the Month - by screenshotting the player below the TOTW

> [Back to top](#table-of-contents)

## Sheet Links

:::info
All sheets can only be opened by people with added access
:::

### Main Stats Sheets

- <a href="https://docs.google.com/spreadsheets/d/1yRYxEP4KtL1TZ7m9uFVw4CWJfyviNLwqXAmoqLtTVlc/edit?usp=sharing" target="_blank">Dorkinians Stats 2016-25</a> - The easy read stats sheet that collates all captains stats
- <a href="https://docs.google.com/spreadsheets/d/1dikd8bRgeiNYzinSN7VHCvh6brclC8T5s6l9yfnxU4g/edit?usp=sharing" target="_blank">Dorkinians Online Stats</a> - The data that the website parses for display.

:::tip
There is no need to view the second link - Online Stats, unless something has gone really wrong
:::

> [Back to top](#table-of-contents)

### Team Stats Sheets

- <a href="https://docs.google.com/spreadsheets/d/1c-Z38ZU6LzuGZkIAR1OWSfM285tZQpIYZXYlKWRBMCk/edit?usp=sharing" target="_blank">Dorkinians 1s Stats</a>
- <a href="https://docs.google.com/spreadsheets/d/1VAfBTMGzrubx1KjkcE0teqGsKaxhY05E9tVLW0pp4Js/edit?usp=sharing" target="_blank">Dorkinians 2s Stats</a>
- <a href="https://docs.google.com/spreadsheets/d/1_jZwz0DVFP12lCV0hPt8vPYKB08I3Hpq7yv_187MjpI/edit?usp=sharing" target="_blank">Dorkinians 3s Stats</a>
- <a href="https://docs.google.com/spreadsheets/d/1Q41WLJWITudG-3_kPjgtkYUS6K1eQiLcHkvreRZHyTg/edit?usp=sharing" target="_blank">Dorkinians 4s Stats</a>
- <a href="https://docs.google.com/spreadsheets/d/1Z1L_mfnhKPPwPtSeIvwNXVzvgCEu814KtyAl9OLRE-k/edit?usp=sharing" target="_blank">Dorkinians 5s Stats</a>
- <a href="https://docs.google.com/spreadsheets/d/1DaFADa8I-y_bmjJYS4mcJg61abTWaydgQbNWMMyzMEI/edit?usp=sharing" target="_blank">Dorkinians 6s Stats</a>
- <a href="https://docs.google.com/spreadsheets/d/1vqQmddiYzm46qShnAob1x8daIVFU9GXiAlb5MXJNeL0/edit?usp=sharing" target="_blank">Dorkinians 7s Stats</a>
- <a href="https://docs.google.com/spreadsheets/d/1khDoDviBavkijIRtl08W273SH5-UuPt-8lObsi8_LXk/edit?usp=sharing" target="_blank">Dorkinians 8s Stats</a>
- <a href="https://docs.google.com/spreadsheets/d/1WvIBfMRF_hSTGeoNzOz_MqMn3UaTGeyZAyooMC8DxtI/edit?usp=sharing" target="_blank">Dorkinians Vets Stats</a>

> [Back to top](#table-of-contents)

## Details

### Sheets to maintain

There are only a few sheets that should ever need to be maintained, listed below.

| Google Sheet | Sheet Name | Maintenance Needed |
| --- | --- | --- |
| Dorkinians Stats 2016-25 | Control Panel | [Read regularly to check stat completion](#control-panel) |
| Dorkinians Stats 2016-25 | Fixtures List | Update weekly with fixtures and results |
| Dorkinians Stats 2016-25 | Players List | [Update infrequently when a new player is to be added](#adding-a-player) |
| Dorkinians Stats 2016-25 | Lookup | [Update infrequently when a new opposition team is to be added](#adding-an-opposition-team) |

All other documents and sheets should work without needing updates, or will need Luke's help to fix.

### Control Panel

The control panel can be used to monitor that status of each team's stats. If there are any errors on a teams sheet, they will be flagged here.

Each column provides a specific error type to help debug where to look.

<a href="https://docs.google.com/spreadsheets/d/1yRYxEP4KtL1TZ7m9uFVw4CWJfyviNLwqXAmoqLtTVlc/edit?pli=1#gid=1246584563&range=B2" target="_blank" rel="noopener noreferrer">
	<img src="/img/Dorkinians/Control Panel.png" alt="Stats Control Panel" width="800"></img>
</a>

### Stats Abbreviations

:::info
Each team stat sheet has this detail on the first tab of their document
:::

| Abbreviation | Full Name | Explanation |
|---|---|---|
|MIN|Appearance Minutes|The number of minutes that the player played. Go up to 120 minutes if extra time played.|
|CLASS|Position Class|The position that the player played the majority of the game in. Can either be "GK", "DEF", "MID" or "FWD". Up to the captains to decide what position they feel their players played in.|
|MOM|Man of the Match|The player who won man of the match. You are allowed more than 1 if required but we prefer 1.|
|G|Goals|The number of goals scored by the player. Please don't include penalties in this as there is a separate stat for that.|
|A|Assists|The number of assists that the player achieved.|
|Y|Yellows|The number of yellow cards that a player can get. Can only be 1 or 0. If two yellows, please select 0 and add 1 red. Sin bins count as yellows.|
|R|Reds|The number of red cards that a player can get. Can only be 1 or 0.|
|SAVES|Saves|The number of clear big saves by the keeper. Please add for memorable big saves in the game.|
|OG|Own Goals|The number of own goals scored by the player.|
|PSC|Penalties Scored|The number of penalties scored by the player.|
|PM|Penalties Missed|The number of penalties missed by the player.|
|PCO|Penalties Conceded|The number of penalties conceded by the player.|
|PSV|Penalties Saved|The number of penalties saved by the player.|
|OPPO OG|Opposition Own Goals|For opposition own goals, please contact Luke Bangs or Oli Goddard to have them logged correctly.|

> [Back to top](#table-of-contents)

## How the stats site works

The stats are created from several interconnected Google Sheet files, where captains enter data and then the data is collated up into a single readable file, before being read into a machine readable file.

The website then reads in this data every time it loads, which is why the loading is so slow and you can see it loading section by section, as it loads in different required data tables.

<img src="/img/Dorkinians/Sheets and Website Explained.png" alt="Stats Sheets and Website Explained" width="800"></img>

- The site is hosted on Netlify (<a href="https://app.netlify.com/sites/dorkinians-stats-site/overview" target="_blank">https://app.netlify.com/sites/dorkinians-stats-site/overview</a>) - a website hosting site
- The code is hosted on GitHub (<a href="https://github.com/bangsluke/Dorkinians-Dev-Site" target="_blank">https://github.com/bangsluke/Dorkinians-Dev-Site</a>)
- The domain name "https://www.dorkiniansfcstats.co.uk/" is bought and owned for the next three years, expiring on 14/11/2026.

## Debugging Stats Problems

The first place to start with debugging the errors is to review the [Control Panel](#control-panel) as this is designed to catch as many errors as possible. If this doesn't help, read the next steps below.

### Common Problems

Common problems that I've encountered are;

- Captains accidentally adding columns to their stats sheet. Check other teams sheets to see if the layout and order of columns has changed. Delete any accidentally added columns
- Captains assigning one player in the team to the wrong match. If one player is assigned to the wrong match, its likely the match will show the wrong number of goals scored etc so check over their players and matches
- The opposition scored an OG so our stats flag an incorrect number of goals. To fix this, you can added that an opposition scored an OG on the `Fixtures List` on Dorkinians Stats 2016-25

### Stat Errors

The below section explains what each error means. These errors will be displayed on each line of the Captain's documents.

:::info
Each team stat sheet has this detail on the first tab of their document
:::

|Error|Explanation|
|---|---|
|BLANK ERROR|A blank error means that one of the key bits of information for a player is missing (either name, date - match, APP or CLASS). Add the missing detail to clear the error.|
|NAME ERROR|A name error means that the entered player name doesn't exist in the Dorkinians list of players. Try alternative names/spellings if you think this player should exist. If you think this is a new player, please contact your Stats Master to add the name.|
|MOM ERROR|An MoM error means that the current match doesn't have a MoM assigned to it. We prefer to have one. If you definitely don't have one, you can overrule the flagged error on the Games Checker tab.|
|GOALS ERROR|A goals error means that the number of goals listed as being scored by the Dorkinians team on the Games Checker tab doesn't align with the number of goals awarded on the stats. Check the number of goals are correct. If the Games Checker tab is an incorrect scoreline, contact your stats master. If one of the goals Dorkinians scored was an opposition own goal, record that on the Games Checker tab.|
|DUPLICATE NAME ERROR|A duplicate name error means that you have the same player listed twice against a fixture. Check this. If there is definitely not a mistake, you can overrule the flagged error on the Games Checker tab.|

:::tip
If after all, you're sure that the stats are right on a sheet, either for a line on one of the year tabs, or for a full match on the `Games Checker` tab, you can change the `Overrule Checker` to be "Mark As Ok". This will clear the errors but should be used as a last resort
:::

### Website Errors

If the <a href="https://www.dorkiniansfcstats.co.uk/" target="_blank">website</a> isn't loading for any reason, another check that can be done is to right click on the website (on a computer) and click "Inspect". Each browser has a "Debug Console" (or something named similar) that can viewed.

As the website loads, I log some statements such as "getPlayerStats" etc. which give some indication of what is happening on the site.

If there is an error, have a look at what the site was trying to do before it failed, as this may give some indication of what went wrong.

<img src="/img/Dorkinians/Debug Console.png" alt="Debug Console" width="500"></img>

> [Back to top](#table-of-contents)

### Adding a Player

To add a player to the Dorkinians database, do the following steps;

- Navigate to the `Players List` tab on the main stats sheet
- Scroll to where to add the player (alphabetical is preferred for long term maintenance) and right click on the row numbers to add a row above or below the current row
- Add the players name
- Add a `TRUE` or `FALSE` value for if they should be shown on the website (can say false to hide players who don't want to be shown)
- Optionally you can add a team (historically I've added the first team the player played for)
- Add a Class
- You can ignore the remaining details - we no longer use them

<a href="https://docs.google.com/spreadsheets/d/1yRYxEP4KtL1TZ7m9uFVw4CWJfyviNLwqXAmoqLtTVlc/edit?pli=1#gid=2110221697&range=A1" target="_blank" rel="noopener noreferrer">
	<img src="/img/Dorkinians/Players List.png" alt="Stats Players List" width="400"></img>
</a>

> [Back to top](#table-of-contents)

### Adding an Opposition Team

Sometimes one of our teams will play a new team that isn't listed on the sheet. To add a team, do the following;

- Navigate to the `Lookup` tab on the main stats sheet
- In column H, add the new team name in alphabetical order
- Find out their playing field address and add to column J
- Use Google Maps to lookup the distance in miles from the opposition ground to Pixham Sports Ground - and use the lowest distance in miles by car x 2 for each way

:::info
This is how I calculate distance travelled for players
:::

<a href="https://docs.google.com/spreadsheets/d/1yRYxEP4KtL1TZ7m9uFVw4CWJfyviNLwqXAmoqLtTVlc/edit?pli=1#gid=1731773426&range=H1" target="_blank" rel="noopener noreferrer">
	<img src="/img/Dorkinians/Teams List.png" alt="Stats Teams List" width="400"></img>
</a>

> [Back to top](#table-of-contents)

## Useful Links

- <a href="https://www.dorkiniansfcstats.co.uk/" target="_blank">Dorkinians Stats Site</a>
- <a href="https://fulltime.thefa.com/fixtures.html?league=9031785&selectedSeason=495559713&selectedDivision=921408008&selectedCompetition=0&selectedFixtureGroupKey=1_313360010" target="_blank">FA Full Time Fixtures</a>
- <a href="https://fulltime.thefa.com/results.html?league=9031785&selectedSeason=495559713&selectedDivision=921408008&selectedCompetition=0&selectedFixtureGroupKey=1_313360010" target="_blank">FA Full Time Results</a>
- <a href="https://github.com/bangsluke/Dorkinians-Dev-Site" target="_blank">GitHub Repository</a>
- <a href="https://app.netlify.com/sites/dorkinians-stats-site/overview" target="_blank">Netlify Deployment</a>

> [Back to top](#table-of-contents)
