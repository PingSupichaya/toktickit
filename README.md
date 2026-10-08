# TokTickIT

IT Service Desk app with a React client and an Express + PostgreSQL (Prisma) server.

## Project structure

- `client/` — React + Vite frontend (unit/component tests in `client/tests/`)
- `server/` — Express API + Prisma/PostgreSQL (API tests in `server/tests/`)
- `e2e/` — Playwright end-to-end tests, organized by lab (`e2e/lab-02/` legacy, `e2e/lab-03/` and `e2e/lab-04/` current)
- `docs/` — lab documentation (specifications, API/UI specs, evidence reviews)
- `artifacts/` — test evidence, e.g. E2E screenshots
- `playwright.config.ts` — root Playwright config (starts API on :3000 + client on :5174, `testDir: e2e/`)

## Prerequisites

- Node.js 18+
- PostgreSQL (only needed for server database features)

## Project Setup

### Repo root

Install the root dev dependencies (Playwright, used by the E2E suite):

```bash
npm install
```

### Client

```bash
cd client
npm install
```

### Server

```bash
cd server
npm install
```

### Environment files

Both apps read their config from a git-ignored `.env` file. Copy the provided examples once:

- `server/.env.example` → `server/.env` — sets `DATABASE_URL` (already matches the Docker command below) and `PORT=3000`.
- `client/.env.example` → `client/.env` — sets `VITE_API_URL=http://localhost:3000`, the base URL of the TokTickIT API.

### PostgreSQL via Docker

Prisma needs a running PostgreSQL instance to connect to. Run it in Docker with:

```bash
docker run --name toktickit-postgres -e POSTGRES_USER=toktickit -e POSTGRES_PASSWORD=toktickit -e POSTGRES_DB=toktickit -p 5433:5432 -d postgres
```

The container's port 5432 is mapped to host port **5433** so it won't conflict with a PostgreSQL instance you may already have running locally on the default port. This matches `DATABASE_URL` in `server/.env.example`, so no further changes are needed. Make sure Docker Desktop is running before this command, and confirm the container is up with:

```bash
docker ps
```

You should see `toktickit-postgres` listed with status `Up`. If you restart your machine, the container stops — start it again with:

```bash
docker start toktickit-postgres
```

Only after the container is running should you proceed with `npx prisma migrate dev` or `npm run prisma:seed`, otherwise Prisma will fail to connect.

## Testing

### Automated tests

```bash
cd server
npm test
```

```bash
cd client
npm test
```

### End-to-end tests (Playwright)

The Lab 3 and Lab 4 E2E suites drive the full multi-role workflow in a real (headless) Chromium browser and save screenshots to `artifacts/lab-03/screenshots/` and `artifacts/lab-04/screenshots/` as evidence (exact file paths in `docs/lab-03/ui-spec.md` §12 and `docs/lab-04/ui-spec.md` §12). The Playwright config lives at the repository root (`testDir: e2e/`).

**Prerequisites**
- Docker Desktop is running and the `toktickit-postgres` container is up (see "PostgreSQL via Docker" above). Playwright starts only the Node processes — never the database — so every E2E test fails if Postgres is down.
- Database migrated and seeded (each spec resets its own fixtures on top, but the base seed must exist):
  ```bash
  cd server
  npx prisma migrate dev
  npm run prisma:seed
  npm run prisma:seed:e2e
  ```
- Ports **3000** (API) and **5174** (E2E client) are free. `playwright.config.ts` starts both servers automatically and silently reuses already-running ones — stop any stale dev server from another session first.
- First time only (from the repository root): `npm install` plus `npx playwright install chromium`.

**Run the E2E tests** (from the repository root):

```bash
# Full suite, all labs (serial, one worker)
npx playwright test

# Lab 4 only
npx playwright test e2e/lab-04
```

Useful options:

```bash
npx playwright test e2e/lab-03/authentication.spec.ts   # one spec file
npx playwright test --headed      # Watch the browser while it runs
npx playwright test --reporter=html   # Open an HTML report after running
```

The same commands are also available as npm scripts from the repo root: `npm run test:e2e`, `npm run test:e2e:headed`, and `npm run test:e2e:report`.

**What it verifies** (serial, one worker):
- `e2e/lab-03/authentication.spec.ts` — E2E-01/02/03/08: valid/invalid login → shell, safe error banner, logout; first-login password change gate; inactive account; role-based navigation.
- `e2e/lab-03/staff-ticket-flow.spec.ts` — E2E-04/05/06/07: queue search/filter → claim → IT Priority → status change → Public Comment → Internal Note; comment/note visibility + resolution indicator; responsive queue/detail; authorization from the browser.
- `e2e/lab-03/user-administration.spec.ts` — E2E-09/10: admin creates a user → first login forces change; edit/deactivate/reset-password; list search/filter; panel + mobile screenshots.
- `e2e/lab-03/requester-regression.spec.ts` — E2E-11: authenticated requester creates a ticket, manages an attachment, posts a comment (Lab 2 selector is gone).
- `e2e/lab-04/actions-taken-flow.spec.ts` — E2E-01: staff adds + edits an Action Taken (backdated/picker/future-blocked), list in `actionAt` order; E2E-05: requester sees the read-only list with zero write controls.
- `e2e/lab-04/ticket-resolution.spec.ts` — E2E-02: resolution gate blocks, then resolves once qualified; E2E-03: concurrent edit shows the conflict banner without overwriting.
- `e2e/lab-04/dashboards.spec.ts` — E2E-04/06 skeleton (dashboard drill-down + responsive evidence land with the dashboard UI issues, not this task).

After running, confirm the screenshots were written to `artifacts/lab-03/screenshots/` (`authentication/`, `staff-queue/`, `staff-ticket-detail/`, `user-management/`) and `artifacts/lab-04/screenshots/actions-taken/`.

> Note: `e2e/lab-02/` is the legacy Lab 2 suite (localStorage requester selector, 403 ownership block). It is not run by `npx playwright test` and does not pass against the current app (authenticated identity, 404 cross-owner rule); requester regression now lives in E2E-11.

### Manual verification

Use these steps to confirm each feature end to end. Do them in order — each one builds on the last.

#### Before you start: checklist

- Docker Desktop is open and running.
- The database container is up: run `docker ps` and confirm `toktickit-postgres` is listed with status `Up`. If it's not there at all, create it (see "PostgreSQL via Docker" above). If it exists but is stopped, run `docker start toktickit-postgres`.
- Nothing else is already using port 3000. If `npm run dev` in `server/` fails with `EADDRINUSE`, another process (maybe a server you left running from a previous session) is holding that port — stop it first.

#### 1. Category table and seed

1. **Migration creates the table**

   ```bash
   cd server
   npx prisma migrate dev
   ```

   Confirm a folder appears under `server/prisma/migrations/` whose `migration.sql` contains `CREATE TABLE "category"` and a unique index on `name`.

2. **Seed inserts the four categories**

   ```bash
   npm run prisma:seed
   ```

    Expect the console to log the seeded counts (4 categories, related systems, users, 16 tickets, public comments, internal notes, and Actions Taken). To inspect the rows directly, query the database in the Docker container:

   ```bash
   docker exec -it toktickit-postgres psql -U toktickit -d toktickit -c "SELECT * FROM category ORDER BY id;"
   ```

   You should see exactly 4 rows: Account and Access, Hardware, Software, Network.

3. **Seed is safe to re-run (no duplicates)**

   Run the seed command a second time:

   ```bash
   npm run prisma:seed
   ```

   It should complete without errors. Re-run the same query — the `category` table must still have exactly 4 rows with the same 4 names, not 8.

#### 2. API endpoints

1. Start the server and leave it running in its own terminal:

   ```bash
   cd server
   npm run dev
   ```

   Wait for it to print `TokTickIT API listening on http://localhost:3000`. If instead you see `Error: listen EADDRINUSE`, see the checklist above.

2. Open a **second** terminal (keep the server running in the first one) and check the health endpoint:

   | Shell | Command |
   |---|---|
   | PowerShell | `Invoke-RestMethod http://localhost:3000/api/health` |
   | Command Prompt / bash | `curl http://localhost:3000/api/health` |

   Expect: `{"status":"ok","service":"TokTickIT API"}`

3. Check the categories endpoint the same way:

   | Shell | Command |
   |---|---|
   | PowerShell | `Invoke-RestMethod http://localhost:3000/api/categories` |
   | Command Prompt / bash | `curl http://localhost:3000/api/categories` |

    Expect: `401` with an error body — since Lab 3, reference endpoints require
    a session (API-11), so this unauthenticated call is rejected. (With a valid
    session cookie, the same endpoint returns `{ "data": [ { "id": 1, "name":
    "Account and Access" }, ... ] }` — 4 objects in id order.)

   **If this fails but health check succeeded:** the server can't reach the database. Check the checklist above (Docker container running?), then check the server terminal for a `PrismaClientInitializationError` or `Can't reach database server` message.

#### 3. Frontend demo walkthrough (Lab 4)

With both the server (`npm run dev` in `server/`) and client (`npm run dev` in `client/`) running, open the client URL in a browser (Vite prints it, usually `http://localhost:5173`). Ready-to-use demo accounts (no password change required):

| Role | Email | Password |
|---|---|---|
| Requester | `alice.john@mail.kmutt.ac.th` | `Password123!` |
| IT Staff | `frank.ngu@mail.kmutt.ac.th` | `Password123!` |
| Admin | `omar.far@mail.kmutt.ac.th` | `Password123!` |

All other seeded accounts use the initial password `ChangeMe123!` and must change it at first login.

**As the Requester (Alice):** after login you land on the **Dashboard** — own-ticket counts, recent tickets, and quick actions. Open **My Tickets**, then a ticket to see its **Actions Taken** card (read-only: no Add/Edit buttons anywhere).

**As IT Staff (Frank):** after login you land on the **Staff Dashboard** — queue metrics, priority breakdown, and your recent tickets. Every metric drills into the pre-filtered Ticket Queue. Open a ticket, switch to the **Actions Taken** tab, add an action (try the follow-up toggle and a future date to see validation), then change the ticket status — resolving is blocked with an inline reason until a qualifying Action Taken exists.

## Running the app

### Server

```bash
cd server
npm run dev
```

Starts the API at `http://localhost:3000` (or the `PORT` set in `.env`).

### Client

```bash
cd client
npm run dev
```

Starts the frontend dev server (Vite prints the local URL, usually `http://localhost:5173`).