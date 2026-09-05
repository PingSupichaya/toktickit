# TokTickIT

IT Service Desk app with a React client and an Express + PostgreSQL (Prisma) server.

## Project structure

- `client/` — React + Vite frontend
- `server/` — Express API + Prisma/PostgreSQL

## Prerequisites

- Node.js 18+
- PostgreSQL (only needed for server database features)

## Project Setup

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

The E2E suite runs the full user workflow in a real (headless) Chromium browser and saves screenshots to `artifacts/lab-02/screenshots/` as evidence. The Playwright config lives at the repository root.

**Prerequisites**
- Docker Desktop is running and the `toktickit-postgres` container is up (see "PostgreSQL via Docker" above).
- The API server is reachable on port 3000. `playwright.config.ts` starts the client automatically; it will reuse an already-running API if present, otherwise you must start one:
  ```bash
  cd server
  npm run dev
  ```

**Run the E2E tests** (from the repository root):

```bash
# First time only: install Playwright + the Chromium browser
npm install
npx playwright install chromium

# Run the Lab 2 E2E suite (testDir is already e2e/lab-02, so no path argument needed)
npx playwright test
```

Useful options:

```bash
npx playwright test --headed      # Watch the browser while it runs
npx playwright test --reporter=html   # Open an HTML report after running
```

**What it verifies** — `e2e/lab-02/requester-ticket-flow.spec.ts` (5 tests, serial):
1. Select a requester → create a ticket (validation, submitting, success states) at desktop/tablet/mobile.
2. My Tickets: responsive layout, search results, and empty/no-results states.
3. Ticket detail + attachment lifecycle: upload, remove-confirmation modal, muted removed row.
4. Ownership block: another requester gets a 403 error screen.
5. Visual checks: Zen Green theme, focus rings, hamburger menu, 2→1 column grid collapse.

After running, confirm the screenshots were written to `artifacts/lab-02/screenshots/`.

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

   Expect the console to log that 4 categories were seeded. To inspect the rows directly, query the database in the Docker container:

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

   Expect: a JSON array of 4 objects with `id` and `name`, in this order — Account and Access, Hardware, Software, Network.

   **If this fails but health check succeeded:** the server can't reach the database. Check the checklist above (Docker container running?), then check the server terminal for a `PrismaClientInitializationError` or `Can't reach database server` message.

#### 3. Frontend status display

With both the server (`npm run dev` in `server/`) and client (`npm run dev` in `client/`) running:

1. Open the client URL in a browser (Vite prints it, usually `http://localhost:5173`).
2. Click **Check System**.
3. **Backend online** — you should see "Online", a count of fetched categories, and the 4 category names listed.
4. **Backend offline** — stop the server (`Ctrl+C` in its terminal) and click **Check System** again. You should see an error message instead of the category list, with no app crash.

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