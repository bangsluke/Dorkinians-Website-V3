# Profile and Wrapped Load Measurements

This project now emits browser performance marks to help compare baseline vs optimized route load behavior.

## Marks to capture

- `wrapped:logo-visible`
- `wrapped:first-slide-visible`
- `wrapped:deferred-slides-ready`

## Suggested compare workflow

1. In Chrome DevTools, open Performance panel and record a navigation to:
   - `/profile/[playerSlug]`
   - `/wrapped/[playerSlug]`
2. Run with cache disabled and then with warm cache.
3. For wrapped staged load, compare:
   - time to first logo paint
   - time to slide 1 visibility
   - time to deferred slides ready
4. Capture network payload deltas:
   - `/api/wrapped/[playerSlug]?stage=initial`
   - `/api/wrapped/[playerSlug]?stage=deferred`
   - `/api/wrapped/[playerSlug]` (legacy full payload path)

## Feature flags for A/B and rollback

- `profileServerHeadline`
- `wrappedStagedLoad`
- `wrappedPriorityLogos`

Use these flags in `config/config.ts` to compare old/new behavior and to instantly fall back if needed.
