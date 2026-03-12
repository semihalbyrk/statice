# Statice MRF Dashboard

E-waste Material Recovery Facility management system for Statice B.V.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 16
- npm

### Database Setup

```bash
# Option 1: Use Docker
docker-compose up -d

# Option 2: Use local PostgreSQL
createdb statice_mrf
```

### Server

```bash
cd server
npm install
cp .env.example .env  # Edit DATABASE_URL and JWT secrets
npx prisma migrate dev
npx prisma db seed
npm run dev            # Starts on port 3001
```

### Client

```bash
cd client
npm install
npm run dev            # Starts on port 3000
```

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@statice.nl | Admin1234! |
| Gate Operator | gate@statice.nl | Gate1234! |
| Logistics Planner | planner@statice.nl | Planner123! |
| Reporting Manager | reporting@statice.nl | Report123! |

## Architecture

- **Frontend**: React 18, React Router v6, Tailwind CSS, Zustand
- **Backend**: Node.js, Express.js, Prisma ORM
- **Database**: PostgreSQL
- **Auth**: JWT (access token in memory, refresh token as HttpOnly cookie)
- **Reports**: PDFKit (PDF), ExcelJS (XLSX), node-cron (scheduling)

## Modules

1. **Orders** — Inbound cargo registration and lifecycle management
2. **Arrival** — Vehicle arrival matching via license plate
3. **Weighing** — Pfister weighbridge integration (simulated)
4. **Sorting** — Material breakdown recording per skip
5. **Reports** — 6 report types (RPT-01 to RPT-06) with PDF/XLSX generation
6. **Admin** — User management, audit log, system settings

## Pfister Integration

The system runs in **simulation mode**. The Pfister weighbridge simulator generates
realistic weight data for development and testing. All generated PDFs include a
"SIMULATED WEIGHING DATA" watermark.

To connect a real Pfister weighbridge, replace the simulator service at
`server/src/services/pfisterSimulator.js` with a real integration following the
same interface contract (see PRD Section 6.2).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Access token signing secret | — |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | — |
| `PORT` | Server port | 3001 |
| `SMTP_HOST` | SMTP server for report emails | (optional) |
| `SMTP_PORT` | SMTP port | 587 |
| `SMTP_USER` | SMTP username | (optional) |
| `SMTP_PASS` | SMTP password | (optional) |
| `SMTP_FROM` | Sender email address | (optional) |
