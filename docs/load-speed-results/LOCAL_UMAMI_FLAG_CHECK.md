# Local Umami flag verification (pre-deploy)

Ran without waiting for a production deploy. Proves `featureFlags.umamiAnalytics === false` prevents script injection even when Umami env vars are present.

## Setup

- `npm run dev -- --port 3010`
- Env forced on:
  - `NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js`
  - `NEXT_PUBLIC_UMAMI_WEBSITE_ID=local-flag-test`

## Results

| Check | Result |
|-------|--------|
| Unit: `featureFlags.umamiAnalytics` | `false` (Jest `__tests__/unit/config/umamiAnalyticsFlag.test.ts`) |
| Unit: develop + production presets | both `false` |
| HTML from `GET http://localhost:3010/` | **no** `umami.is` substring |
| Playwright cold-home on localhost | `umamiRequests: 0` |

## Conclusion

After you deploy this branch, production should match: zero `umami.is` requests on Track B. Until then, production baselines may still show Umami traffic from the old build.

Date: 2026-10-10
