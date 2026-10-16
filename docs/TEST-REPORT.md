# Verification report — 15 October 2026

## Passed

- `npm run build`: Vite production build successful.
- Main frontend JavaScript approximately **80 KB gzip**; CSS approximately **5 KB gzip**. Organiser screen is a separate lazy-loaded bundle. These are build sizes, not measured network speed or a load-test result.
- `npm test`: three rule/scoring test groups passed, covering duplicate/invalid/inactive players, credit budgets, country/role limits, captain membership, transfer phases and costs, cricket-ball economy calculation, bowler strike-rate exception and negative captain-weighted scores.
- `npm run test:ui`: Chromium browser contract checks passed with **mocked API responses**:
  - Home has no horizontal overflow at 320, 390, 768 and 1440 px.
  - Team builder has no horizontal overflow at 320 and 390 px.
  - Login flow, 11-player selection, captain/vice-captain selection, save and reloading from a returned saved squad.
  - Failed save displays an error and keeps captain choices/draft rather than reporting success.
  - No uncaught browser errors in the tested flow.
- Phone home, phone team picker and desktop home screenshots visually inspected internally.
- `npm audit --omit=dev --audit-level=high`: reported **0 production dependency vulnerabilities** at check time. This is not a penetration-test certification.
- Backend syntax checks passed.

## Blocked, not passed

`npm run test:integration` needs an actual MongoDB instance. The temporary mongod process failed in this environment with `open: Operation not permitted` (exit code 100). This is an environment limitation; it is not evidence that the application's database operations passed.

The included integration suite is designed to check:

- Reserved admin account registration denied and API authorization.
- Save → logout → login → exact XI recovery.
- Concurrent edit conflicts and atomic revision/history updates.
- Transfer limits and free captain changes.
- Private-league membership access.
- Deadline snapshots, authenticated scoring, corrections without double counting, abandoned matches and leaderboard privacy.
- Database outage returns 503 and data survives application restart.

Run it on a normal development machine or staging:

```sh
npm run test:integration
```

Or set `TEST_MONGODB_URI` to a **dedicated test MongoDB** service. The suite creates a randomly named database and drops that test database afterward. It must have the required database permissions. It does not use MONGODB_URI as a silent fallback.

## Not performed

- Public deployment or testing with your actual Atlas/hosting accounts.
- Real score-feed integration, verified official 2027 roster import or match-day result verification.
- Traffic load/stress tests, penetration testing or backup restore drills.
- Payment, advertising-account or cash-prize tests; none are connected.

Do not invite a large audience until staging persistence checks and a realistic traffic test pass. No software or hosting setup can honestly promise never to crash.
