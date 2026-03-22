# Umami analytics — Dorkinians V3

Central reference for **custom events**, **client helper usage**, and the **Netlify weekly email report**.

## Client instrumentation

- **Event names & sections:** `lib/analytics/events.ts` (`UmamiEvents`, `AnalyticsSections`).
- **Safe tracking helper:** `lib/utils/trackEvent.ts` — no-ops on the server and when `window.umami` is missing.
- **High-leverage navigation:** `lib/stores/navigation.ts` (page changes, subpages, filters, player selection, etc.).
- **Public script:** `NEXT_PUBLIC_UMAMI_SCRIPT_URL` + `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (see `.env.example`).

### Property conventions

- Prefer **low-cardinality** fields: `section`, `subSection`, `source`, `status`, `method`, `type`.
- Use **`playerName` only** for intentional product moments (e.g. TOTW player modal, POM row expand, captain/award history) — not for free-text chat content.
- Use **`result` / `status`** for outcomes (`success`, `cancelled`, `error`).

### Event inventory (stable names)

| Group | Event name |
| --- | --- |
| Baseline | `App Version`, `Web Vital` |
| Navigation | `Page Viewed`, `Subpage Viewed`, `Settings Opened`, `Filter Opened`, `Stats Menu Opened` |
| Player | `Player Selected`, `Player Edit Started`, `Recent Player Selected` |
| Chatbot | `Chatbot Question Submitted`, `Chatbot Response Rendered`, `Chatbot Error`, `Example Questions Opened`, `Example Question Selected`, `Chatbot CTA Clicked` |
| Stats / filters | `Stats Subpage Switched`, `Filters Applied`, `Filters Reset`, `Filter Preset Applied`, `All Games Modal Opened`, `Data Table Toggled`, `Stats Shared` |
| TOTW / POM | `TOTW Week Changed`, `TOTW Player Opened`, `TOTW Player Modal Closed`, `PlayersOfMonth Month Changed`, `PlayersOfMonth Row Expanded` |
| Club info | `ClubInfo Subpage Viewed`, `League Team Focused`, `League Results Opened`, `Captain History Opened`, `Award History Opened`, `Useful Link Clicked` |
| Settings / trust | `Share Site Triggered`, `Feedback Modal Opened`, `Feedback Submitted`, `Data Privacy Modal Opened`, `Data Removal Submitted` |

## Weekly report (`umami-weekly-report`)

**File:** `netlify/functions/umami-weekly-report.mjs`  
**Schedule:** Friday **00:00 UTC** — `0 0 * * 5` (via `export const config` in the function).  
**Timeout:** `netlify.toml` → `[functions."umami-weekly-report"]` = 60s.

### What the email contains

- **Rolling windows:** last 7 days vs previous 7 days (not calendar weeks).
- **Headline metrics:** site pageviews, visits, visitors, plus `Chatbot Question Submitted` and `Filters Applied` week-over-week.
- **Top path (raw):** from Umami `metrics?type=path` (useful for non-SPA hits such as `/settings`).
- **Recommendations:**
  - **Invest further:** top 3 product sections by score.
  - **Improve / retire:** bottom 3 product sections by score.
- **Section score (default weights 0.5 / 0.5):**
  - **Page side:** normalized totals from event-data **`Page Viewed`** breakdown by property **`section`** (`home`, `stats`, `totw`, `club-info`, `settings`).
  - **Engagement side:** normalized sum of **`Subpage Viewed`** by `section` **plus** all `metrics?type=event` rows mapped per `EVENT_TO_SECTION` in the function file.

### Required Netlify environment variables

**Umami API**

- `UMAMI_API_KEY` — API key from Umami (Cloud: site settings → API, or self-hosted equivalent).
- `UMAMI_WEBSITE_ID` — Same UUID as `NEXT_PUBLIC_UMAMI_WEBSITE_ID` in almost all setups.
- `UMAMI_BASE_URL` (optional) — Default `https://api.umami.is/v1`. Set if self-hosted (e.g. `https://analytics.example.com/api` — verify your instance’s API prefix).

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
- [ ] TOTW: change week → `TOTW Week Changed`; open/close player modal → open/close events.
- [ ] League: team nav + **Show Results** → `League Team Focused` / `League Results Opened`.
- [ ] Settings: share site (web + clipboard paths), open feedback / privacy modals, submit forms.
- [ ] Weekly email received with plausible numbers vs Umami dashboard for the same date range.

## Related docs

- Broader setup: `docs/Additional_Details.md` → **Umami Analytics Setup**.
- Env template: `.env.example`.
