# League Tables Data

This directory contains historical league table data for all Dorkinians teams across past seasons.

## Data Format

Each season is stored as a JSON file named `[season].json` (e.g., `2019-20.json`, `2020-21.json`).

### File Structure

```json
{
  "season": "2019/20",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "teams": {
    "1s": {
      "division": "Premier",
      "url": "https://fulltime.thefa.com/table.html?...",
      "table": [
        {
          "position": 1,
          "team": "Team Name",
          "played": 20,
          "won": 15,
          "drawn": 3,
          "lost": 2,
          "goalsFor": 45,
          "goalsAgainst": 20,
          "goalDifference": 25,
          "points": 48
        }
      ]
    },
    "2s": {
      "division": "Senior 2 South",
      "url": "https://fulltime.thefa.com/table.html?...",
      "table": [...]
    },
    "3s": {...},
    "4s": {...},
    "5s": {...},
    "6s": {...},
    "7s": {...},
    "8s": {...}
  }
}
```

### Field Descriptions

- **season**: Season identifier in format "YYYY/YY" (e.g., "2019/20")
- **lastUpdated**: ISO 8601 timestamp of when the data was last updated
- **teams**: Object containing league tables for each team (1s through 8s)
  - Each team entry is an object with:
    - **division**: Name of the division/league for that team
    - **url**: URL to the original league table on The FA Full Time website for that team
    - **table**: Array of league table entries for all teams in that league
      - **position**: Final league position (integer)
      - **team**: Team name (string)
      - **played**: Games played (integer)
      - **won**: Games won (integer)
      - **drawn**: Games drawn (integer)
      - **lost**: Games lost (integer)
      - **goalsFor**: Goals scored (integer)
      - **goalsAgainst**: Goals conceded (integer)
      - **goalDifference**: Goal difference (integer)
      - **points**: League points (integer)

### Notes

- Some seasons may have 8 teams, others fewer
- Not all teams may have league tables for every season
- Current season data is stored in Neo4j and fetched from Google Sheets

