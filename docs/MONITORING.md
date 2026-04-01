# Production uptime monitoring

Use an external uptime service to confirm the Netlify site and Heroku database API respond on a schedule. This complements deploy logs and does not replace error tracking.

## 1. Choose a monitor (primary)

**Recommended primary:** [UptimeRobot](https://uptimerobot.com/) - free tier includes many HTTP monitors, email alerts, and an optional public status page.

**Alternatives:** [Better Stack Uptime](https://betterstack.com/uptime) (free tier), or [Healthchecks.io](https://healthchecks.io/) plus a scheduled job if you prefer “expected ping” style checks.

Create an account on your chosen service before adding monitors.

## 2. URLs to monitor

Replace placeholders with your real hosts.

| Monitor | URL | Expect | Notes |
|--------|-----|--------|--------|
| Homepage | `https://<your-netlify-domain>/` | HTTP **200** | Confirms the app is served. |
| Neo4j (via site) | `https://<your-netlify-domain>/api/health` | HTTP **200**, body contains `"status":"healthy"` | Lightweight `RETURN 1` against Neo4j ([`app/api/health/route.ts`](../app/api/health/route.ts)). Prefer this over `/api/site-details` for less load. |
| Database API (Heroku) | `https://<your-heroku-app>.herokuapp.com/health` | HTTP **200**, keyword **`healthy`** | Confirms the seeder API process is up ([`database-dorkinians/index.js`](../../database-dorkinians/index.js)). This does not prove Neo4j from Heroku’s side; the `/api/health` monitor covers Neo4j from the website. |

Optional deeper check: `GET /api/site-details` (full `SiteDetail` read) if you want redundancy.

**Privacy:** Heroku `/health` JSON may include in-memory job IDs. If you want to avoid exposing that to a monitor’s logs, use a keyword rule on `"status":"healthy"` only and avoid storing full response bodies in the tool if it offers that option.

## 3. Monitor settings (typical)

- **Interval:** 5 minutes (common free-tier minimum).
- **Timeout:** 30–60 seconds for `/api/health` (cold starts + database).
- **Retries:** Require **2–3 consecutive failures** before alerting, if the product supports it.
- **SSL:** Enable certificate expiry warnings if available.

## 4. Alerts

- Add at least **email**; add push/SMS/Slack if the plan supports it.
- After saving monitors, use the dashboard “test notification” feature if offered.

## 5. Verify end-to-end

1. **Homepage:** Temporarily point the monitor at a bogus path (e.g. `/__monitor_test_404__`), confirm an alert fires, then restore the correct URL.
2. **`/api/health`:** Same approach, or deploy a branch preview and break Neo4j env vars only on that preview (if you use preview envs).
3. **Heroku `/health`:** In a controlled window, scale web dyno to 0 or use a wrong URL, confirm alert, then restore.

Local smoke check (no secrets in repo; set env in your shell).

PowerShell:

```powershell
$env:SITE_BASE_URL = "https://your-site.netlify.app"
$env:DATABASE_API_BASE_URL = "https://your-app.herokuapp.com"
npm run health:check
```

cmd.exe:

```bat
set SITE_BASE_URL=https://your-site.netlify.app
set DATABASE_API_BASE_URL=https://your-app.herokuapp.com
npm run health:check
```

Exit code **0** means all three checks passed.

## 6. Rollback

Disable or delete monitors in the provider’s dashboard. No code rollback is required.
