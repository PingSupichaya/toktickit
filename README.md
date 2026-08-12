# TokTickIT

IT Service Desk app with a React client and an Express + PostgreSQL (Prisma) server.

## Project structure

- `client/` — React + Vite frontend
- `server/` — Express API + Prisma/PostgreSQL

## Prerequisites

- Node.js 18+
- PostgreSQL (only needed for server database features)

## Setup

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