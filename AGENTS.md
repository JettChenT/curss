# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Curss is a social link/reading feed aggregator built on Curius.app data. It has three sub-projects:

| Directory | Stack | Role |
|---|---|---|
| `platform/` | Next.js 16 + Bun + Drizzle ORM + PostgreSQL (pgvector) + Effect | Primary web app (UI + API) |
| `frontend/` | Vite + React 19 + Bun | Legacy/alternative SPA frontend |
| `viz/` | Python 3.13 + uv + Modal | Optional visualization pipeline |

### Prerequisites

- **Bun** (`~/.bun/bin/bun`) — used as package manager and runtime for both `platform/` and `frontend/`
- **PostgreSQL 16** with `pgvector` extension — must be running before starting the platform
- **Node.js 22** — required by Next.js

### Starting PostgreSQL

```bash
sudo pg_ctlcluster 16 main start
```

### Database setup (one-time)

Create user/database and push schema:

```bash
sudo -u postgres psql -c "CREATE USER curss WITH PASSWORD 'curss' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE curss OWNER curss;"
sudo -u postgres psql -d curss -c "CREATE EXTENSION IF NOT EXISTS vector;"
cd /workspace/platform
echo 'DATABASE_URL=postgresql://curss:curss@localhost:5432/curss' > .env
bunx drizzle-kit push
```

### Running services

- **platform/** (port 3000): `cd /workspace/platform && bun run dev` (or `bunx next dev` to skip the claude-code step)
- **frontend/** (port 5173): `cd /workspace/frontend && bun run dev`

### Lint / Build

- **platform lint**: `cd /workspace/platform && bun run lint` (Biome)
- **frontend lint**: `cd /workspace/frontend && bun run lint` (ESLint)
- **frontend build**: `cd /workspace/frontend && bun run build`

### Gotchas

- `platform/package.json` dev script runs `bunx @react-grab/claude-code@latest` before `next dev`. To skip this, run `bunx next dev` directly.
- The initial Drizzle migration (`drizzle/0000_thick_scrambler.sql`) only creates the `vector` extension. Use `bunx drizzle-kit push` (not `drizzle-kit migrate`) for a fresh DB setup to create all tables from schema.
- The `fill-db.ts` script fetches all users from the external Curius API and is slow. For local testing, insert sample data directly into PostgreSQL instead.
- No `.env` file is committed. You must create `platform/.env` with `DATABASE_URL=postgresql://curss:curss@localhost:5432/curss` before running the platform.
