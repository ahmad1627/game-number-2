# How to put the WHOLE website online

Your website has three parts:

| Part | Purpose | Where it runs |
|---|---|---|
| React frontend | Screens and player selection | User's browser; files served by Node |
| Express backend | Login, rules, transfers, saved teams | A continuously running Node web service |
| MongoDB database | Permanent accounts and squad history | MongoDB Atlas or your MongoDB server |

Dragging `frontend/dist` onto static hosting only publishes the screens. It does not run `backend/server.js` or create a database. The Vite localhost proxy works only during development.

## Recommended first setup: Render Web Service + MongoDB Atlas

1. Unzip this project into a new folder and open it in VS Code. Do not copy the old `.env` or `node_modules` into it.
2. Create a private GitHub repository. Upload the root files and `backend`, `frontend`, `tests`, `docs` folders. Include `package-lock.json` and `render.yaml`. Exclude `.env` and `node_modules`.
3. Create a MongoDB Atlas project and a free cluster. Create a dedicated database user with a unique password. Add your own IP for local setup and the hosting service's outbound addresses to Atlas Network Access. Prefer these specific addresses to unrestricted access.
4. In Atlas, choose Connect → Drivers and copy the connection URI. Replace the password placeholder and set the database name, for example `fantasy_xi_v2`. URL-encode special password characters. Never place this URI in React code or share it publicly.
5. On Render choose **New → Web Service**, connect the repository, and use the project root (the folder with `package.json`). A Static Site is the wrong service type for this full-stack deployment.
6. Set these service values:

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22.16.0` or supported newer Node 22+ |
| `MONGODB_URI` | Your Atlas URI |
| `JWT_SECRET` | A random secret, at least 32 characters |
| `CLIENT_URL` | Your full `https://your-service.onrender.com` URL |
| `TRUST_PROXY` | `1` for this single-proxy setup |
| `ADMIN_EMAILS` | Your real administrator email, lowercase |

Generate a JWT secret locally:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The included `render.yaml` can also configure a Blueprint deployment. Fill its prompted values; update CLIENT_URL if necessary after you know the assigned address.

7. Deploy. Node starts only after connecting to MongoDB. Open `/api/health`; it must report `database: connected`. A startup failure means the setup needs fixing; the app will not invent an in-memory success.
8. Locally create `.env` with the same Atlas database and run `npm ci`, then `npm run seed`. This loads practice data into the persistent database, so it appears on the live website too. It is a one-time sample import, not an automatic production seeder.
9. To create the organiser account, add temporary `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` to the local `.env`, then run `npm run admin:create`. The email must match `ADMIN_EMAILS`. Use a unique 12–72-byte password. Remove the bootstrap password afterward. Public registration deliberately cannot claim reserved administrator emails.
10. Sign in with that account, then open **Organiser** in the footer. Publish verified roster data, fixtures, tournament start/reset/end dates, and clear site rules before launch. The bundled schedule/roster is practice data.
11. Test on your real phone: register, choose 11, save, log out, log in, verify players/captains, then sign in on another browser. Restart the web service and confirm the team still loads. Run the integration suite against a separate staging/test database.

### What “free” means

Render's free web services sleep after 15 minutes without inbound traffic and can take about a minute to wake. This can feel slow even with efficient frontend code. Use free hosting for a pilot, then an always-on service for a public match-day launch. Atlas describes its free cluster as a small-scale development environment. No free tier is a promise of uninterrupted capacity.

Sources checked 15 October 2026:
- https://render.com/docs/web-services
- https://render.com/docs/free
- https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/

## Alternative: separate frontend and backend

- Deploy Node backend to a Node-capable host and connect Atlas as above.
- Build React with `VITE_API_URL=https://your-backend-address` set at build time.
- Build command: `npm ci --include=dev && npm run build`; output folder: `dist`.
- Deploy `dist` to your chosen static host.
- Set backend `CLIENT_URL` to the frontend's exact HTTPS origin. For more than one allowed origin use a comma-separated list.
- Never put MONGODB_URI, JWT_SECRET or score-provider keys in a `VITE_` variable.
- Changing VITE_API_URL requires rebuilding React. Keep API paths `/api/...` available at the backend.

## Backups and operations

- Keep a database backup before migrations and regularly after launch; test restoring it.
- Monitor `/api/health`, API errors, latency and failed saves.
- A single service instance is the initial supported deployment. In-process rate limiting is not shared across replicas; add a shared limiter before scaling horizontally.
- Protect organiser credentials. The admin whitelist uses account email plus normal password authentication; changing the whitelist is a server configuration task.
- Score publishing is manual and versioned. Keep a record of each source and review corrections. Feed automation needs a licensed provider adapter and reliable player-ID mapping.
- No claim of zero crashes is possible. Use health checks, restart policies, backups, staging checks and load testing before high-traffic events.

## Urdu mein seedha tareeqa

Sirf frontend folder upload karne se poori website live nahi hoti. **Render par Web Service** banayein; poora project GitHub se connect karein. **MongoDB Atlas** ka connection Render ki environment settings mein lagayein. Build `npm ci --include=dev && npm run build`, Start `npm start`. Is tarah frontend aur backend aik hi link se chalenge, aur teams Atlas mein save hongi. Free server sleep ho sakta hai; match-day users ke liye always-on hosting chahiye.
