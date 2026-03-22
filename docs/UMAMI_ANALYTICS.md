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
- **`submissionSource`** — on **`Chatbot Question Submitted`**: `custom` (typed question + Search / Enter / suggestions) vs `example` (example question or modal pick). Used by the weekly report to split headline metrics.
- **`totwSubPage`** — on TOTW / POM events: `totw` vs `players-of-month` so the weekly report can attribute engagement to the correct subsection.
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
| Stats | `All Games Modal Opened` | `statsSubPage` |
| Stats | `Data Table Toggled` | `statsSubPage` |
| Stats | `Stats Section Navigated` | `statsSubPage`, `sectionId` |
| Stats | `Filters Reset` | `statsSubPage` |
| Stats | `Filter Preset Applied` | `statsSubPage` |
| Home | `Chatbot Question Submitted` | `questionLengthBucket`, **`submissionSource`** (`custom` / `example`) |
| Home | `Example Question Selected` | `questionId`, `source` |
| Home | `Player Selected` | `playerName` (top 10 table) |
| TOTW | `TOTW Player Opened` | `mode`, **`totwSubPage`** |
| TOTW | `TOTW Week Changed`, `TOTW Player Modal Closed` | **`totwSubPage`** |
| POM | `PlayersOfMonth Row Expanded`, `PlayersOfMonth Month Changed` | **`totwSubPage`** |
| Club | `Useful Link Clicked` | `linkCategory` |
| Club / league | `League Team Focused` + `League Results Opened` | `teamKey` (merged in email) |
| Global | `Web Vital` | `name` (email shows acronym + full name, e.g. LCP (Largest Contentful Paint)) |

## Weekly report (`umami-weekly-report`)

**File:** `netlify/functions/umami-weekly-report.mjs`  
**Schedule:** Friday **00:00 UTC** — `0 0 * * 5` (via `export const config` in the function).  
**Timeout:** `netlify.toml` → `[functions."umami-weekly-report"]` = 60s.

### What the email contains

- **Time windows:** **Completed UTC weeks** — Sunday **00:00** → next Sunday **00:00** (7 days). If the current week is incomplete, the report uses the **previous** full week. The **prior week** column uses the 7 days before that. Subject and body use **en-GB**-style date strings (weekday + day + month + year, UTC).
- **Headline metrics:** site pageviews, visits, visitors; **custom** vs **example** chatbot submissions (from `submissionSource` on `Chatbot Question Submitted`); `Filters Applied` week-over-week.
- **Top path (raw):** from Umami `metrics?type=path`.
- **Recommendations:**
  - **Invest further:** top 3 **subsections** by score (e.g. Player Stats, League Information), not main tabs only.
  - **Improve / retire:** bottom 3 subsections **disjoint** from the top 3. Tie-break: lowest score first, then stable `REPORT_SUBSECTION_ORDER` in `umami-weekly-report.mjs` (see `disjointBottomThreeSubsections` + `scoreHelp`).
- **Detail & breakdowns:** subpage view table (subsections sorted by views; **Settings** row last); stat leaderboards; top 10 `playerName`; team `teamLabel`; merged league `teamKey`; **stats interaction** tables (`All Games Modal`, `Data Table Toggled`, `Stats Section Navigated` × `statsSubPage` / `sectionId`, `Filters Reset`, `Filter Preset Applied`); filters/share/chat/TOTW/useful links; **Web Vitals** table = **sample counts per metric name**, not seconds (see client `WebVitals.tsx` — actual timings are on each event in Umami, not aggregated in this email); example `questionId`; example clicks by `source`.
- **Property breakdowns & zeros:** The job unwraps Umami responses shaped as `{ data: [...] }` and merges **`Page Viewed`** `section` with **`page`** when `section` is empty. If tables stay at zero while site totals look healthy, confirm event names/properties in Umami match the function and the date window.
- **Branding / layout:** Outer email background **white**; Dorkinians header colours; logo defaults to the colour crest **with CSS filter** (unreliable in Outlook/Gmail). Set **`UMAMI_EMAIL_LOGO_URL`** (Netlify env for the function) to a **white-on-transparent PNG** for a reliable white mark. Nav links from **`UMAMI_APP_BASE_URL`** (Overview, Events, Goals).
- **Subsection score (default weights 0.5 / 0.5):**
  - **Views:** `Subpage Viewed` · `subSection` per slug; **home** / **settings** use **`Page Viewed`** · `section`.
  - **Engagement:** property breakdowns and event totals **rolled up** to each subsection (see `buildSubsectionEngagement` in the function), including stats filters/leaders/modals, league/useful links, chatbot home events, TOTW/POM via `totwSubPage`, etc.

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
- [ ] Chatbot: submit question → `Chatbot Question Submitted` includes `submissionSource` (`custom` / `example`) + response / error events.
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
