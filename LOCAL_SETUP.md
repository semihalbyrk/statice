# Local Development Setup

## Prerequisites

- Node.js 18+
- PostgreSQL (local or Docker)
- npm

## 1. Database

### Option A: Docker (recommended)

```bash
docker-compose up -d
```

This starts PostgreSQL 15 on port 5432.

### Option B: Local PostgreSQL

If you have a local PostgreSQL running on port 5432 (e.g. Homebrew), create the user and database manually:

```bash
psql -U postgres
CREATE USER statice WITH PASSWORD 'statice123' SUPERUSER;
CREATE DATABASE statice_mrf OWNER statice;
\q
```

### Connection String

```
postgresql://statice:statice123@localhost:5432/statice_mrf
```

## 2. Server Setup

```bash
cd server
npm install
cp .env.example .env      # already has correct defaults
npx prisma generate
npx prisma migrate dev
npx prisma db seed
node src/index.js
```

Server runs on **http://localhost:3001**.

Health check: `GET http://localhost:3001/api/health`

## 3. Client Setup

```bash
cd client
npm install
npm run dev
```

Client runs on **http://localhost:3000**.

## 4. Test Credentials

| Email                  | Password      | Role               |
|------------------------|---------------|--------------------|
| admin@statice.nl       | Admin1234!    | ADMIN              |
| planner@statice.nl     | Planner123!   | LOGISTICS_PLANNER  |
| gate@statice.nl        | Gate1234!     | GATE_OPERATOR      |
| reporting@statice.nl   | Report123!    | REPORTING_MANAGER  |

## 5. Environment Variables (server/.env)

| Variable            | Default Value                                                  |
|---------------------|----------------------------------------------------------------|
| DATABASE_URL        | postgresql://statice:statice123@localhost:5432/statice_mrf     |
| JWT_SECRET          | statice-jwt-secret-dev-2026                                    |
| JWT_REFRESH_SECRET  | statice-refresh-secret-dev-2026                                |
| PORT                | 3001                                                           |
| NODE_ENV            | development                                                    |

## 6. Role Permissions

| Feature                | ADMIN | LOGISTICS_PLANNER | GATE_OPERATOR | REPORTING_MANAGER |
|------------------------|-------|--------------------|---------------|-------------------|
| Dashboard              | Yes   | Yes                | Yes           | Yes               |
| View Orders            | Yes   | Yes                | Yes           | Yes               |
| Create/Edit Orders     | Yes   | Yes                | No            | No                |
| Cancel Orders          | Yes   | No                 | No            | No                |
| Arrival Registration   | Yes   | No                 | Yes           | No                |
| Admin (Carriers, etc.) | Yes   | No                 | No            | No                |

## 7. API Routes

### Auth
- `POST /api/auth/login` — Login (returns access token + sets refresh cookie)
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/logout` — Logout (clears cookie)
- `GET  /api/auth/me` — Current user info

### Orders
- `GET    /api/orders` — List (query: status, search, page, limit)
- `GET    /api/orders/:id` — Detail with relations
- `POST   /api/orders` — Create new order
- `PUT    /api/orders/:id` — Update order / change status
- `DELETE /api/orders/:id` — Cancel order
- `GET    /api/orders/match-plate?plate=XX` — Match plate to planned orders
- `POST   /api/orders/:id/arrive` — Confirm arrival
- `POST   /api/orders/adhoc-arrival` — Create ad-hoc arrival

### Carriers
- `GET    /api/carriers` — List (query: search, page, limit, active)
- `GET    /api/carriers/:id` — Detail
- `POST   /api/carriers` — Create
- `PUT    /api/carriers/:id` — Update
- `DELETE /api/carriers/:id` — Deactivate

### Suppliers
- `GET    /api/suppliers` — List (query: search, supplier_type, page, limit, active)
- `GET    /api/suppliers/:id` — Detail
- `POST   /api/suppliers` — Create
- `PUT    /api/suppliers/:id` — Update
- `DELETE /api/suppliers/:id` — Deactivate

### Admin
- `GET    /api/admin/waste-streams` — List with categories
- `POST   /api/admin/waste-streams` — Create
- `PUT    /api/admin/waste-streams/:id` — Update
- `GET    /api/admin/product-categories` — List (query: waste_stream_id)
- `POST   /api/admin/product-categories` — Create
- `PUT    /api/admin/product-categories/:id` — Update

### Dashboard
- `GET /api/dashboard/stats` — Aggregated stats (today arrivals, planned, in-progress, completed, recent orders)

## 8. Seeded Data

- **3 Waste Streams:** WEEE, PLASTIC, METAL
- **20 Product Categories:** WEEE-01 through WEEE-20
- **2 Carriers:** Van Happen Recycling, Direct Drop-off
- **3 Suppliers:** Stichting Open (PRO), Private Individual, Third Party Supplier

## 9. Common Issues

**Port 5432 conflict:** If both Docker and local PostgreSQL are running on 5432, the app connects to whichever is listening. Stop one or change the port in docker-compose.yml.

**Port 3001 in use:** Kill the existing process:
```bash
lsof -ti:3001 | xargs kill -9
```

**Prisma client outdated:** After schema changes:
```bash
cd server && npx prisma generate
```
