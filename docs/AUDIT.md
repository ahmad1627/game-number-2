# Audit of the uploaded project and scope of v2

## Root causes found in the active code

| Original file/area | Problem | v2 response |
|---|---|---|
| backend/routes/userTeamRoutes.js | Passed custom text IDs such as `user_team_...` into MongoDB's ObjectId `_id`; swallowed insert errors | MongoDB generates IDs; no successful response on DB failure |
| Team and auth routes | In-memory fallback lost data on restart; auth fallback stored plaintext passwords | MongoDB required; bcrypt password hashes only |
| frontend AuthModal | Created local/demo sessions after API failure; fake Google tokens | Real registration/login only; errors remain visible |
| Google endpoint | Trusted supplied email/Google ID without verifying a Google identity token | Removed; proper OAuth remains a separate integration |
| Team POST | Public endpoint trusted submitted user identity, credits and player records | Bearer auth supplies owner; canonical server roster validates players/credits |
| CaptainSelectorModal and backend team route | Random “realistic” fantasy points | No points until verified scoring; deterministic engine |
| Team save route | Creation instead of a durable edit/upsert flow; no own-team reload | Account-linked season squad, GET `/api/squad`, atomic revisioned PUT |
| Frontend store | Did not load a saved XI after login | Fetch authenticated squad after login and before opening editor |
| Admin routes | No authentication/authorization despite “Admin” comments; missing Match import | Protected organiser API with reserved account creation |
| Live score service | Automatically used simulation when API key absent | No simulation in live results; explicit scorecard publication |
| Match/player data | Hard-coded demo squads, sample fixtures and claimed Playing XI | All seed data explicitly unverified practice data |
| Server startup | Called offline in-memory mode “healthy”, swallowed fatal process errors | Database-first startup, honest 503, normal failure/restart semantics |
| Leaderboard | Published whole records including email/squad details | Public projection only of team name, user ID and points |
| Server CORS/JWT | Reflected any origin and included hard-coded fallback secret | Explicit origin allowlist, required random secret |
| Deadline/transfer flow | Client-only checks, no coherent season transfer ledger | Server phases, transfer counts, revision history and cutoff reconstruction |
| Scoring | Divided conceded runs by decimal cricket overs | Accept legal balls as integers; divide by six |

The source archive contained bundled node_modules and environment files. They are not included in this release. If real credentials were previously published anywhere, replace those credentials before deploying. Existing passwords from genuine MongoDB accounts require careful migration; fake/local sessions and RAM-only teams are not recoverable from this archive.

## Transfer research

ICC's 2023 official game described 135 group-stage transfers and 10 knockout transfers, unlimited changes before the event and in the transition to knockouts, and free captain changes. Its 2019 classic game used a different round-based system. There is therefore no single timeless “ICC standard”.

This release exposes a configurable 135 + 10 preset, separate knockout-reset window, and server-side counts. It does not claim exact 2027 official rules or include ICC's 2023 boosters. The preset should be reconsidered for the actual 2027 format and match count before play begins.

Sources:
- https://www.icc-cricket.com/tournaments/cricketworldcup/news/the-icc-mens-cricket-world-cup-2023-fantasy-game-play-and-win-exciting-prizes
- https://www.icc-cricket.com/news/handbook-for-classic-mode
- https://www.dream11.com/manager-mode/how-to-play
- https://login.dream11.com/games/fantasy-cricket/how-to-play

I reviewed public game rules and selection flows. Commercial platforms' private source code was not available, and I did not copy their backend code.

## What is implemented versus still needed

Implemented in source: registration/login, password change, session revocation, durable squad model, team reload, player/captain editor, local draft recovery, server validation, preseason/phase transfers, immutable team history, per-match cutoff team, private league join/create, paginated standings, admin roster/settings/fixtures/score publishing, responsive UI, same-origin hosting package, tests.

Still needed before a serious public launch:

1. Run the real MongoDB integration suite and staging acceptance tests; they were blocked by this environment.
2. Publish verified 2027 players, actual fixtures and tournament phase deadlines. Seed data is not a confirmed squad list.
3. Connect a licensed score provider if automatic live coverage is wanted. Current results require manually published scorecards. There is no ball-by-ball push/socket feed.
4. Configure and implement verified email recovery/delivery before offering self-service password reset. Password change currently requires knowing the old password.
5. Perform security and load tests with realistic traffic; add monitoring, backup recovery and shared rate limiting for multiple server replicas.
6. Add organiser contact details, final operator-specific privacy/terms and support process. The included public rules are functional explanatory text, not legal advice.
7. Integrate advertising, sponsorship placements or a billing provider if monetisation is desired. No payments are enabled.
8. Add any desired extras: boosters, multiple squads per user, push notifications, player form analytics, fixture rescheduling UI, league owner moderation, account export/delete self-service, or localisation. These are not silently represented as working.

## Important operational boundaries

- One season team per account; users do not need to submit an entirely new XI every match.
- The last version strictly BEFORE startTime applies. A save at/after the deadline applies to later matches. Captain changes follow the same cutoff.
- Every successful replacement save during a limited phase consumes transfers, even if later reversed. Rejected saves consume none.
- First team creation is free even for late entrants, but scores only future fixtures.
- Player roles/prices cannot be imported after tournament starts. Availability can change. Old snapshots keep old player IDs.
- Settings are locked after tournament starts. Schedule corrections after deadlines need a deliberate supported migration; changing historical cutoff times casually would be unsafe.
- No confirmed XI indicator is fabricated. Seed `isPlayingXI` values from the old app are intentionally not treated as true.
- Leaderboards have no invented starter participants, points or prize winners.
- Score publication writes all entries before switching the active published version. An interrupted write leaves the previous published result in place; retries do not add duplicate points. Old unpublished score entries need a future maintenance policy at larger scale.
- Team history lives in one document for atomic transfers; a 5,000-save cap prevents unlimited growth. Scale beyond this design needs a separate transaction-backed history store.
- No money contests, wallets, payouts or prize automation exist in this release.
