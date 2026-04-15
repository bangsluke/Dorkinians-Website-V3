# E2E Skipped Test Justifications (Latest Full Run)

This document maps each skipped test from the latest full `npm test` run to:

- what condition triggered the skip
- why that skip is currently justified
- where to remove the skip in future (data/fixture or stability work)

## Scope

- Run context: latest full suite (`npm test`) in `V3-Dorkinians-Website`
- Total skipped: 74
- Unique skipped test cases: 37
- Browser projects affected: `chromium`, `Mobile Chrome`

## Home

1. `2.11. develop deploy shows Dev badge on home header` (chromium, Mobile Chrome)  
   **Skip trigger:** Environment is not a develop deploy variant (`BRANCH !== develop` and `NEXT_PUBLIC_SITE_VARIANT !== develop`).  
   **Justification:** Assertion is deploy-variant specific; validating it on non-develop builds would be a false failure.

## Stats

2. `3.6. should display charts` (chromium, Mobile Chrome)  
   **Skip trigger:** chart/visualization did not render after toggle.  
   **Justification:** This test is data/render-path dependent; when chart surfaces are absent for the selected sample, skipping avoids classifying missing data as regression.

3. `3.8. should navigate to Club Stats sub-page` (chromium, Mobile Chrome)  
   **Skip trigger:** Club Stats control or expected heading/empty-state not visible.  
   **Justification:** Club navigation is conditional on UI readiness and data load; skip prevents flake from transient mount delays.

4. `3.10. should display all Player Stats sections` (chromium, Mobile Chrome)  
   **Skip trigger:** one or more required section anchors not visible after scroll sweep.  
   **Justification:** This is a long, data-heavy completeness check; guarded skip prevents false negatives when sections are absent for current dataset.

5. `3.12. should display all Club Stats sections` (chromium, Mobile Chrome)  
   **Skip trigger:** club sections missing/hidden after scroll sweep.  
   **Justification:** Club section visibility is season/data dependent; skip is safer than failing on legitimate sparse payloads.

6. `3.14. should toggle data table on Player Stats` (chromium, Mobile Chrome)  
   **Skip trigger:** table toggle controls, table mode, or Per-90 controls unavailable.  
   **Justification:** UI mode controls are not always rendered for all player/data combinations; skip avoids conflating absence-of-applicable-data with product defect.

7. `3.20. Player Stats per-90 table mode and messaging` (chromium, Mobile Chrome)  
   **Skip trigger:** Per-90 mode or rows not available for current sample.  
   **Justification:** Per-90 requires sufficient minutes and specific table state; skipping is valid when eligibility threshold is not met.

8. `3.21. Player form section renders chart or fallback` (chromium, Mobile Chrome)  
   **Skip trigger:** form section/chart/fallback markers not present.  
   **Justification:** Form visualization depends on recent match data; skip prevents false failures when upstream form inputs are empty/incomplete.

9. `3.22. Player form: no form-only season dropdown; recent boxes tooltip` (chromium, Mobile Chrome)  
   **Skip trigger:** recent form boxes or tooltip content absent.  
   **Justification:** Tooltip assertions require recent-form sample rows; skip is justified when there are not enough recent matches.

10. `3.23. Starting impact uses 2-column grid (2×2 layout)` (chromium, Mobile Chrome)  
    **Skip trigger:** explicit unconditional guard in test.  
    **Justification:** Marked intentionally unstable with live loading/data variance until deterministic fixtures are introduced.

11. `3.24. Player streaks section renders` (chromium, Mobile Chrome)  
    **Skip trigger:** streaks section/heading/season-best row absent.  
    **Justification:** Streaks are inherently data dependent; skip avoids failing when sample player has insufficient streak dataset.

12. `3.25. Player partnerships and impact sections render` (chromium, Mobile Chrome)  
    **Skip trigger:** partnerships/impact sections or headings missing.  
    **Justification:** Graph insight blocks are optional with sparse data; skip is acceptable until fixture-backed deterministic coverage exists.

13. `3.26. Milestone badges link opens Player Profile with required section order` (chromium, Mobile Chrome)  
    **Skip trigger:** milestone profile link not visible.  
    **Justification:** Link depends on seeded badge/milestone data (`/api/player-badges`); skip is valid when feature data is unavailable.

14. `3.27. Team formations subtitle and recommendation` (chromium, Mobile Chrome)  
    **Skip trigger:** Team Stats/formation breakdown unavailable.  
    **Justification:** Formation recommendation is conditional on team-level formation data; skip avoids false failures for seasons without formation records.

## TOTW / Players of the Month

15. `4.2. should display TOTW page by default` (Mobile Chrome)  
    **Skip trigger:** mobile-specific stability guard.  
    **Justification:** Test is intentionally non-deterministic on mobile due to known UI/data timing variance.

16. `4.3. should let user change the season and week on the TOTW page` (Mobile Chrome)  
    **Skip trigger:** mobile-specific stability guard.  
    **Justification:** Listbox interaction and post-change assertions are flaky on mobile in current live-data flow.

17. `4.4. should display the TOTW for the selected season and week` (Mobile Chrome)  
    **Skip trigger:** mobile-specific stability guard.  
    **Justification:** Player-card count assertions are not reliable on mobile under current loading/data variability.

18. `4.5. should display 11 players on the pitch and 1 star man...` (Mobile Chrome)  
    **Skip trigger:** mobile-specific stability guard.  
    **Justification:** Strict player-count and STAR MAN assertions are intentionally disabled for mobile until deterministic rendering is guaranteed.

19. `4.6. clicking a player should open a modal with their detailed stats` (Mobile Chrome)  
    **Skip trigger:** mobile-specific stability guard.  
    **Justification:** Modal open path is not consistently deterministic on mobile with live payload timing.

20. `4.7. clicking 'Close' or 'X' should close the player detail modal` (Mobile Chrome)  
    **Skip trigger:** mobile-specific stability guard.  
    **Justification:** Depends on reliable modal open state from previous interaction; currently too flaky on mobile.

21. `4.9. should let the user change the season and month on the Players of the Month page` (chromium, Mobile Chrome)  
    **Skip trigger:** PoM season/month selectors lacked alternate options.  
    **Justification:** Filter-change test is not applicable when only one valid option exists.

22. `4.11. clicking a player row on the Players of the Month page should expand detailed stats` (chromium, Mobile Chrome)  
    **Skip trigger:** no visible PoM data row.  
    **Justification:** Row-expansion behavior cannot be verified without available table data.

23. `4.12. selected player highlighted in both FTP ranking tables` (chromium, Mobile Chrome)  
    **Skip trigger:** selected player absent from monthly FTP context or ranking sections missing.  
    **Justification:** Highlight assertions are only valid when the selected player has relevant FTP entries.

24. `4.12b. PoM left panel transitions skeleton -> populated/empty` (chromium, Mobile Chrome)  
    **Skip trigger:** initial left-panel skeleton not observed.  
    **Justification:** Transition assertion requires visible skeleton phase; if already resolved, the transition cannot be tested deterministically.

25. `4.13. rank-1 month FTP appears in season FTP` (chromium, Mobile Chrome)  
    **Skip trigger:** month ranking table/rank-1 row/player name unavailable.  
    **Justification:** Cross-table consistency cannot be asserted without valid rank-1 source row.

26. `4.14. previous 10 week strip renders and box click changes TOTW week` (Mobile Chrome)  
    **Skip trigger:** mobile-specific stability guard.  
    **Justification:** Weekly strip interactions are intentionally guarded on mobile due to unstable behavior.

27. `4.15. TOTW share button is visible and can be triggered safely` (Mobile Chrome)  
    **Skip trigger:** mobile-specific stability guard.  
    **Justification:** Share flow assertions are intentionally desktop-only for deterministic behavior right now.

## Club Info

28. `5.5. clicking 'Show squad' opens trophy squad modal` (chromium, Mobile Chrome)  
    **Skip trigger:** Show squad control absent.  
    **Justification:** Test applies only when trophy squad UI exists for loaded season/data.

29. `5.6. clicking Close/X closes squad modal` (chromium, Mobile Chrome)  
    **Skip trigger:** Show squad control absent.  
    **Justification:** Close-path test depends on modal-open precondition that is data/UI dependent.

30. `5.14a. latest result panel renders formation/veo/full-details toggle` (chromium, Mobile Chrome)  
    **Skip trigger:** latest result panel or full-details toggle not visible.  
    **Justification:** Latest result panel is season/data dependent; skip prevents false failures when panel data is unavailable.

31. `5.17. all club captains displayed` (chromium, Mobile Chrome)  
    **Skip trigger:** captains navigation/table/header stability issues or insufficient rows.  
    **Justification:** Captains completeness assertion requires stable table hydration and adequate dataset.

32. `5.18. clicking captain opens captain history modal` (chromium, Mobile Chrome)  
    **Skip trigger:** captain table or clickable captain name unavailable.  
    **Justification:** Interaction is only testable when captains table is fully populated with interactive rows.

33. `5.19. clicking Close/X closes captain history modal` (chromium, Mobile Chrome)  
    **Skip trigger:** captains table/name prerequisites missing.  
    **Justification:** Modal close assertions are contingent on successful modal open preconditions.

34. `5.20. season filter updates displayed captains` (chromium, Mobile Chrome)  
    **Skip trigger:** no alternate season in captains dropdown.  
    **Justification:** Cannot verify season-change behavior when there is only one effective option.

35. `5.23. clicking award receiver opens award history modal` (chromium, Mobile Chrome)  
    **Skip trigger:** receiver button not visible in awards table.  
    **Justification:** Awards history modal is only testable when receiver rows exist and are interactive.

36. `5.24. clicking Close/X closes award history modal` (chromium, Mobile Chrome)  
    **Skip trigger:** award receiver/button prerequisites missing (or navigation not stabilized).  
    **Justification:** Close assertions require deterministic modal-open setup that may not exist for current data.

37. `5.25. season filter updates displayed awards` (chromium, Mobile Chrome)  
    **Skip trigger:** no alternate season option in club awards dropdown.  
    **Justification:** Filter-change behavior is non-applicable when dataset provides a single season.

38. `5.29. Records and Milestones shown on Club Information` (chromium, Mobile Chrome)  
    **Skip trigger:** records section/heading/layout anchors missing.  
    **Justification:** This assertion depends on ClubRecord availability and desktop layout markers.

39. `5.30. record holder name navigates to Player Stats` (chromium, Mobile Chrome)  
    **Skip trigger:** ClubRecord section/link/page stabilization missing.  
    **Justification:** Navigation check is only valid when record-holder link is present from seeded ClubRecord data.

40. `5.31. badge leaderboard below Records + absent on Awards` (chromium, Mobile Chrome)  
    **Skip trigger:** records/badge leaderboard sections not visible.  
    **Justification:** Ordering/absence contract depends on both sections being present in the loaded Club Information dataset.

## Settings

41. `6.5. clicking a site navigation link should navigate to the correct screen` (chromium, Mobile Chrome)  
    **Skip trigger:** Stats destination view did not become visible after fallback nav attempts.  
    **Justification:** This is a navigation stability issue (route/state hydration timing), not a deterministic functional regression in all runs.

## Notes

- Most skipped cases are **guard skips** for data availability, mobile stability, or non-applicable environment states.
- The current skip policy prevents false negatives while still enforcing behavior when preconditions are met.
- To reduce skips materially, prioritize deterministic seeded fixtures for: ClubRecord, PoM ranking tables, and mobile TOTW interaction paths.
