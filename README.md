# Fantasy XI — World Cup 2027, v2

A rebuilt React + Express + MongoDB season-fantasy starter based on your uploaded project.

**Start here:** [Deployment guide](docs/DEPLOYMENT.md) · [Audit and limitations](docs/AUDIT.md) · [Earning plan](docs/EARNING-PLAN.md) · [Test report](docs/TEST-REPORT.md)

## What changed

- Comfortable phone layout, bottom navigation, search, country filters, role tabs, credit sorting, selected-player filter, 44px selection buttons, pitch preview and a captain step.
- Account-linked season team loaded from MongoDB after login. Local drafts are labelled as drafts, never reported as server saves.
- One atomic update saves the XI, transfer debit, revision and history. Stale concurrent edits are rejected.
- Exactly 11 unique active players, 100 credits, role ranges, country limits and C/VC membership checked on the server.
- Unlimited preseason transfers. Configurable default: 135 group + 10 knockout, plus an explicit unlimited knockout reset window. Historical 2023-inspired site preset, NOT official 2027 fantasy rules.
- The last saved team strictly before each match deadline determines that match's players and captains. Future changes cannot retroactively change those teams.
- Real accounts, hashed passwords, signed expiring tokens, revocation on logout/password change, protected organiser routes and rate limits. No fake Google login.
- Private leagues with invite codes; privacy-filtered paginated season standings.
- Protected organiser screen for tournament settings, verified player imports, player availability, fixtures, match status and cumulative scorecard publishing.
- Score corrections replace a published match version instead of adding points twice. Abandoned matches contribute zero to standings.
- Node serves the built React app and API together. Render blueprint and Dockerfile included.

## Run on your computer

Install Node.js 22+ and use MongoDB Atlas or a local MongoDB server.

```sh
npm ci
```

Copy `.env.example` to `.env` in this root folder. Set a real MongoDB connection string and a random JWT secret. Then:

```sh
npm run seed
npm run build
npm start
```

Open http://localhost:5000. The seed creates **unverified practice** players/fixtures from the uploaded dataset; it does not assert current eligibility or announced 2027 squads. It never overwrites existing players or resets accounts.

For development, use two terminals:

```sh
npm run dev:server
```

```sh
npm run dev
```

Open the Vite address (usually http://localhost:5173).

## Tests

```sh
npm test
npm run build
npx playwright install chromium
npm run test:ui
npm run test:integration
```

`npm test` covers deterministic rule/scoring checks. UI tests use mocked API responses. Integration tests start a temporary actual MongoDB, or use a supplied `TEST_MONGODB_URI` with a randomly named test database that is removed afterward. Never provide a production-only database user for tests.

## Honest release status

This is a functional source-code starter, not an assurance that every feature of every fantasy platform exists. Production build, unit checks and browser contract checks passed here. The real MongoDB integration suite could not run in this environment because mongod failed with `open: Operation not permitted`. Run it on staging before inviting public users.

Not connected: a live cricket data provider, Google OAuth, email verification/password-reset delivery, payments, withdrawals, automated prizes, push notifications, or advertising accounts. No live website was deployed during this work. Your hosting/database accounts are required for that.

The original app's RAM-only teams and fake sessions cannot be recovered from source code. Existing genuine database records need a backed-up migration before switching an already-live installation. Use a separate v2 database first.

## File map

- `frontend/src/main.jsx` — account, home, team picker, pitch, matches, leagues, rules.
- `frontend/src/Admin.jsx` — lazy-loaded organiser tools.
- `frontend/src/style.css` — responsive design, no image/font downloads needed.
- `backend/app.js` — validated API and static frontend serving.
- `backend/models.js` — indexed MongoDB schemas.
- `backend/rules.js` — role, credit, transfer and phase checks.
- `backend/scoring.cjs` — deterministic independent ODI scoring preset.
- `backend/server.js` — database-first startup and graceful shutdown.
- `backend/seed.js` — safe practice import.
- `backend/create-admin.js` — reserved administrator account bootstrap.
- `tests/` — unit, browser-contract and real-database integration suites.

No `.env`, credentials, `node_modules`, or simulated financial balances are included.
