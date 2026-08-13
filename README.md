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

### Server tests (includes the API health check)

```bash
cd server
npm test
```

### Client tests

```bash
cd client
npm test
```

### Issue3 Verifying the Category table and seed

These steps confirm the `Category` model, migration, and seed all work as expected.

1. **Model fields** — open `server/prisma/schema.prisma` and confirm the `category` model has `id` (auto-increment PK), `name` (`@unique`), and `createdAt` (`@default(now())`).

2. **Migration creates the table**

   ```bash
   cd server
   npx prisma migrate dev
   ```

   Confirm a folder appears under `server/prisma/migrations/` whose `migration.sql` contains `CREATE TABLE "category"` and a unique index on `name`.

3. **Seed inserts the four categories**

   ```bash
   npm run prisma:seed
   ```

   Expect the console to log that 4 categories were seeded. To inspect the rows directly, query the database in the Docker container:

   ```bash
   docker exec -it toktickit-postgres psql -U toktickit -d toktickit -c "SELECT * FROM category ORDER BY id;"
   ```

   You should see exactly 4 rows: Account and Access, Hardware, Software, Network.

4. **Seed is safe to re-run (no duplicates)**

   Run the seed command a second time:

   ```bash
   npm run prisma:seed
   ```

   It should complete without errors. Re-run the same query:

   ```bash
   docker exec -it toktickit-postgres psql -U toktickit -d toktickit -c "SELECT * FROM category ORDER BY id;"
   ```

   The `category` table must still have exactly 4 rows with the same 4 names, not 8.

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