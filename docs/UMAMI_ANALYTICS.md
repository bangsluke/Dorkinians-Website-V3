# Umami analytics — Dorkinians V3

Central reference for **custom events**, **client helper usage**, and the **Netlify weekly email report**.

## Client instrumentation

- **Event names & sections:** `lib/analytics/events.ts` (`UmamiEvents`, `AnalyticsSections`).
- **Stats leaderboard keys:** `lib/analytics/statsTracking.ts` — `trackStatsStatSelected`, `trackTeamStatsTeamSelected` (must stay aligned with `STAT_LEADER_PREFIXES` in `umami-weekly-report.mjs`).
- **Safe tracking helper:** `lib/utils/trackEvent.ts` — no-ops on the server and when `window.umami` is missing.
- **High-leverage navigation:** `lib/stores/navigation.ts` (page changes, subpages, filters, player selection, etc.).
- **Public script:** `NEXT_PUBLIC_UMAMI_SCRIPT_URL` + `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (see `.env.example`).

### Property conventions

- Prefer **low-cardinality** fields: `section`, `subSection`, `source`, `status`, `method`, `type`.
- **`playerName`** — sent on **`Player Selected`** (home player picker / recent) for internal weekly rankings; appears in Umami and the email. For stricter minimization later, switch to an opaque id at the data layer.
- **`statsLeaderKey`** — single string for dashboards and the weekly email: `statsSubPage/blockId/statKey` with `/` in `statKey` replaced by `_` (see `statsTracking.ts`). Example: `player-stats/seasonal-performance/Apps`.
- **`questionId`** — stable id for **`Example Question Selected`** (`homepage-{id}` or `modal-{index}`).
- Use **`result` / `status`** for outcomes (`success`, `cancelled`, `error`).

### Event inventory (stable names)

| Group | Event name |
| --- | --- |
| Baseline | `App Version`, `Web Vital` |
| Navigation | `Page Viewed`, `Subpage Viewed`, `Settings Opened`, `Filter Opened`, `Stats Menu Opened` |
| Player | `Player Selected` (see `playerName`, `source`), `Player Edit Started`, `Recent Player Selected` |
| Chatbot | `Chatbot Question Submitted`, `Chatbot Response Rendered`, `Chatbot Error`, `Example Questions Opened`, `Example Question Selected` (`questionId`, `source`), `Chatbot CTA Clicked` |
| Stats / filters | `Stats Subpage Switched`, `Stats Stat Selected`, `Team Stats Team Selected`, `Stats Section Navigated`, `Filters Applied`, `Filters Reset`, `Filter Preset Applied`, `All Games Modal Opened` (`statsSubPage` when applicable), `Data Table Toggled`, `Stats Shared` |
| TOTW / POM | `TOTW Week Changed`, `TOTW Player Opened`, `TOTW Player Modal Closed`, `PlayersOfMonth Month Changed`, `PlayersOfMonth Row Expanded` |
| Club info | `ClubInfo Subpage Viewed`, `League Team Focused`, `League Results Opened`, `Captain History Opened`, `Award History Opened`, `Useful Link Clicked` |
| Settings / trust | `Share Site Triggered`, `Feedback Modal Opened`, `Feedback Submitted`, `Data Privacy Modal Opened`, `Data Removal Submitted` |

### Weekly report: property breakdowns (Umami `event-data/values`)

The job queries **`event-data/values`** for current and prior windows on properties including:

| Area | Event | Property |
| --- | --- | --- |
| Stats | `Subpage Viewed` | `subSection` (via section-scoped subpage maps) |
| Stats | `Filters Applied` | `statsSubPage`, `timeRangeType` |
| Stats | `Stats Shared` | `method` |
| Stats | `Stats Stat Selected` | `statsLeaderKey` (grouped by prefix in email) |
| Stats | `Team Stats Team Selected` | `teamLabel` |
| Home | `Chatbot Question Submitted` | `questionLengthBucket` |
| Home | `Example Question Selected` | `questionId` |
| Home | `Player Selected` | `playerName` (top 10 table) |
| TOTW | `TOTW Player Opened` | `mode` |
| Club | `Useful Link Clicked` | `linkCategory` |
| Club / league | `League Team Focused` + `League Results Opened` | `teamKey` (merged in email) |
| Global | `Web Vital` | `name` |

## Weekly report (`umami-weekly-report`)

**File:** `netlify/functions/umami-weekly-report.mjs`  
**Schedule:** Friday **00:00 UTC** — `0 0 * * 5` (via `export const config` in the function).  
**Timeout:** `netlify.toml` → `[functions."umami-weekly-report"]` = 60s.

### What the email contains

- **Time windows:** **Completed UTC weeks** — Sunday **00:00** → next Sunday **00:00** (7 days). If the current week is incomplete, the report uses the **previous** full week. The **prior week** column uses the 7 days before that. Subject and body use **en-GB**-style date strings (weekday + day + month + year, UTC).
- **Headline metrics:** site pageviews, visits, visitors, plus `Chatbot Question Submitted` and `Filters Applied` week-over-week.
- **Top path (raw):** from Umami `metrics?type=path`.
- **Recommendations:**
  - **Invest further:** top 3 product sections by score.
  - **Improve / retire:** bottom 3 sections **disjoint** from the top 3 (ties cannot duplicate a section). Tie-break for bottom pool: lowest score first, then stable `home → stats → totw → club-info → settings` order (see `disjointBottomThree` + `scoreHelp` in the function).
- **Detail & breakdowns:** secondary tables for stat leaderboards (`statsLeaderKey` prefixes), top 10 `playerName`, team XI `teamLabel`, merged league `teamKey`, filters, share methods, chatbot buckets, TOTW modes, useful link categories, web vitals, example `questionId`.
- **Branding / layout:** Dorkinians colours, logo (`bangsluke-assets`), nav links built from **`UMAMI_APP_BASE_URL`** (Overview, Events, Goals).
- **Section score (default weights 0.5 / 0.5):**
  - **Page side:** normalized totals from **`Page Viewed`** by **`section`**.
  - **Engagement side:** normalized **`Subpage Viewed`** by `section` **plus** `metrics?type=event` rows mapped via `EVENT_TO_SECTION` (includes new stats events).

### Required Netlify environment variables

**Umami API**

- `UMAMI_API_KEY` — API key from Umami (Cloud: site settings → API, or self-hosted equivalent).
- `UMAMI_WEBSITE_ID` — Same UUID as `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in almost all setups.
- `UMAMI_BASE_URL` (optional) — Default `https://api.umami.is/v1`. Set if self-hosted (e.g. `https://analytics.example.com/api` — verify your instance’s API prefix).
- `UMAMI_APP_BASE_URL` (optional) — Web UI base URL for **this website** in Umami (used for email nav). Default: `https://cloud.umami.is/analytics/eu/websites/${UMAMI_WEBSITE_ID}`. Adjust for other regions or self-hosted paths.

**SMTP (existing site pattern)**

- `SMTP_SERVER`, `SMTP_PORT`, `SMTP_EMAIL_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_TO_EMAIL`

### Manual test (Netlify)

1. Set the env vars above on the site.
2. Deploy.
3. **Netlify UI:** Functions → `umami-weekly-report` → **Trigger deploy** or use **Test function** / invoke from the dashboard (depending on UI version).
4. Confirm **function log** shows `umami-weekly-report: email sent` and check the inbox for `SMTP_TO_EMAIL`.
5. In **Umami**, spot-check **Events** and **event properties** after smoke-testing major journeys on production.

### Rollback

- Remove or comment `export const config` schedule in `umami-weekly-report.mjs` and redeploy, or disable scheduled functions on the Netlify plan if needed.
- Client tracking can be left in place; it fails safe when Umami is unavailable.

## Verification checklist (manual)

- [ ] `Page Viewed` / `section` updates when switching main tabs.
- [ ] `Subpage Viewed` when changing stats / TOTW / club subpages.
- [ ] Chatbot: submit question → `Chatbot Question Submitted` + response / error events.
- [ ] Example question from homepage or modal → `Example Question Selected` includes `questionId`.
- [ ] Player picker → `Player Selected` includes `playerName` where intended.
- [ ] Stats: Listbox changes → `Stats Stat Selected` with `statsLeaderKey`; team dropdown → `Team Stats Team Selected`.
- [ ] TOTW: change week → `TOTW Week Changed`; open/close player modal → open/close events.
- [ ] League: team nav + **Show Results** → `League Team Focused` / `League Results Opened`.
- [ ] Settings: share site (web + clipboard paths), open feedback / privacy modals, submit forms.
- [ ] Weekly email received with plausible numbers vs Umami dashboard for the same Sun–Sun UTC windows.

## Related docs

- Broader setup: `docs/Additional_Details.md` → **Umami Analytics Setup**.
- Env template: `.env.example`.

## Deferred / optional product events

- **Club Stats “team comparison” visibility** — no dedicated event yet; add (e.g. toggle with `visible`) only if subsection-level questions remain unanswered after the richer email ships.
