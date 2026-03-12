# Local Development Setup

## Quick Start (3 steps)

> PostgreSQL must be running on port 5432 before you begin.

```bash
# 1. Start the backend
cd server
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed        # only needed once, creates test users
node src/index.js         # or: npm run dev (with auto-reload)

# 2. Start the frontend (new terminal)
cd client
npm install
npm run dev

# 3. Open http://localhost:3000 and login with:
#    Email:    admin@statice.nl
#    Password: Admin1234!
```

That's it. Frontend runs on **:3000**, backend on **:3001**.

---

## Test Users

| Email | Password | Role | What they can do |
|---|---|---|---|
| admin@statice.nl | Admin1234! | ADMIN | Everything |
| gate@statice.nl | Gate1234! | GATE_OPERATOR | Arrival, Weighing, Sorting |
| planner@statice.nl | Planner123! | LOGISTICS_PLANNER | Orders, Dashboard |
| reporting@statice.nl | Report123! | REPORTING_MANAGER | Reports, Dashboard |

---

## Prerequisites

- **Node.js 18+**
- **PostgreSQL** running on localhost:5432

### Database Setup (one-time)

If you have Homebrew PostgreSQL:

```bash
psql -U postgres -c "CREATE USER statice WITH PASSWORD 'statice123' SUPERUSER;"
psql -U postgres -c "CREATE DATABASE statice_mrf OWNER statice;"
```

Or with Docker:

```bash
docker-compose up -d
```

### Environment File

`server/.env` is already configured with defaults. If you need to recreate it:

```env
DATABASE_URL=postgresql://statice:statice123@localhost:5432/statice_mrf
JWT_SECRET=statice-jwt-secret-dev-2026
JWT_REFRESH_SECRET=statice-refresh-secret-dev-2026
PORT=3001
NODE_ENV=development
```

---

## Common Issues

### "Port 3000 is already in use"

Another Vite process is already running. Kill it and restart:

```bash
kill $(lsof -ti :3000) && npm run dev
```

### "Port 3001 is already in use"

Same for the backend:

```bash
kill $(lsof -ti :3001) && node src/index.js
```

### Login fails with 404

Make sure the backend is running on port 3001 (not another Vite instance). Check with:

```bash
curl http://localhost:3001/api/health
# Should return: {"status":"ok", ...}
# If you see HTML → wrong process is on 3001, kill it
```

### Prisma errors after schema changes

```bash
cd server && npx prisma generate && npx prisma migrate dev
```

---

## Seeded Data

- **3 Waste Streams:** WEEE, PLASTIC, METAL
- **20 Product Categories:** WEEE-01 through WEEE-20
- **2 Carriers:** Van Happen Recycling, Direct Drop-off
- **3 Suppliers:** Stichting Open (PRO), Private Individual, Third Party Supplier

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Refresh token |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user |
| GET | /api/orders | List orders |
| POST | /api/orders | Create order |
| GET | /api/orders/:id | Order detail |
| PUT | /api/orders/:id | Update order |
| POST | /api/orders/:id/arrive | Confirm arrival |
| POST | /api/orders/adhoc-arrival | Ad-hoc arrival |
| GET | /api/orders/match-plate?plate=XX | Plate matching |
| GET | /api/weighing-events/:id | Weighing event detail |
| POST | /api/weighing-events | Create weighing event |
| POST | /api/weighing-events/:id/trigger-gross | Trigger gross weighing |
| POST | /api/weighing-events/:id/trigger-tare | Trigger tare weighing |
| POST | /api/weighing-events/:id/confirm | Confirm weighing |
| POST | /api/weighing-events/:id/manual-weighing | Manual weight entry |
| GET | /api/weighing-events/asset-lookup?label=X | Asset lookup |
| GET | /api/carriers | List carriers |
| GET | /api/suppliers | List suppliers |
| GET | /api/admin/waste-streams | List waste streams |
| GET | /api/dashboard/stats | Dashboard stats |
| GET | /api/notifications | User notifications |
| GET | /api/reports | List reports |
