# Test coverage report

Canonical narrative and maintenance notes: [docs/Testing_Documentation.md](../../docs/Testing_Documentation.md).

## CI pipelines and emails

| Entry point | Command | Email template |
|-------------|---------|----------------|
| GitHub Actions ([`.github/workflows/full-test-suite-and-email.yml`](../../.github/workflows/full-test-suite-and-email.yml)) — `push` to `develop`, `pull_request` to `main`, weekly schedule, `workflow_dispatch` | `npm run test:weekly:email` ([test-weekly-consolidated-email.js](../scripts/test-weekly-consolidated-email.js)) | “Test summary” HTML — sections Unit, Integration, E2E sub-runs, Reports; subject includes run context when run in CI |
| Manual / optional E2E runner | `npm run test:e2e:email` ([test-e2e-email-report.js](../e2e/scripts/test-e2e-email-report.js)) | “E2E Test Results” — parsed list output grouped by Playwright `describe` title |

Configure **branch protection on `main`** to require the check **“Full test suite and email”** so merges are blocked when this workflow fails (GitHub setting; not in YAML).

Playwright reads `WEBSITE_URL` then `BASE_URL` for `baseURL` ([playwright.config.ts](../../playwright.config.ts)). The workflow sets `WEBSITE_URL` so remote E2E targets the deployed site.

## E2E matrix (spec files)

| Order | Spec | `describe` / area | npm shortcut |
|------|------|-------------------|--------------|
| 01 | [01-navigation/navigation.spec.ts](../e2e/01-navigation/navigation.spec.ts) | Navigation Tests | `npm run test:e2e:navigation` |
| 02 | [02-home/home.spec.ts](../e2e/02-home/home.spec.ts) | Home Page Tests | `npm run test:e2e:home` |
| 03 | [03-stats/stats.spec.ts](../e2e/03-stats/stats.spec.ts) | Stats Page Tests | `npm run test:e2e:stats` |
| 04 | [04-totw/totw.spec.ts](../e2e/04-totw/totw.spec.ts) | TOTW Page Tests | `npm run test:e2e:totw` |
| 05 | [05-club-info/club-info.spec.ts](../e2e/05-club-info/club-info.spec.ts) | Club Info Page Tests | `npm run test:e2e:club-info` |
| 06 | [06-settings/settings.spec.ts](../e2e/06-settings/settings.spec.ts) | Settings Page Tests | `npm run test:e2e:settings` |
| 07 | [07-admin/admin.spec.ts](../e2e/07-admin/admin.spec.ts) | Admin Page Tests | `npm run test:e2e:admin` |
| 08 | [08-api/api.spec.ts](../e2e/08-api/api.spec.ts) | API Endpoint Tests | `npm run test:e2e:api` |
| 09 | [09-cross-cutting/cross-cutting.spec.ts](../e2e/09-cross-cutting/cross-cutting.spec.ts) | Cross-Cutting Tests | `npm run test:e2e:cross-cutting` |

## Environment

- `E2E_PLAYER_NAME` — optional; defaults to `Luke Bangs` in Home/Stats tests that need a real roster name.
