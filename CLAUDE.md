# Statice MRF Dashboard

Read CLAUDE.md and docs/PRD.md fully before writing any code.

## Project Overview

E-waste MRF management system for Statice facility. 
Full PRD is in /docs/PRD.md — read it before making any decisions.

## Stack
- Frontend: React 18, React Router v6, Tailwind CSS, shadcn/ui, Zustand
- Backend: Node.js, Express.js
- Database: PostgreSQL + Prisma ORM
- Auth: JWT (access token in memory, refresh token HttpOnly cookie)

## Key Conventions

- All API routes prefixed with /api
- Controllers stay thin — business logic goes in /services
- Every DB mutation goes through a Prisma transaction
- Every mutation writes to AuditLog — no exceptions
- Pfister integration lives ONLY in server/src/services/pfisterSimulator.js
  The interface contract must match Section 6.2 of the PRD exactly.

## What NOT to Build
- No DIWASS integration
- No outbound logistics
- No mobile app
- No client portal
- No invoicing

## Folder Structure

```text
/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── admin/
│   │   │   ├── orders/
│   │   │   ├── arrival/
│   │   │   ├── inbounds/
│   │   │   ├── weighing/
│   │   │   ├── sorting/
│   │   │   ├── reports/
│   │   │   └── errors/
│   │   ├── store/
│   │   ├── api/
│   │   └── utils/
│   └── public/
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/
│   │   │   ├── pfisterSimulator.js
│   │   │   ├── pdfReportGenerator.js
│   │   │   ├── xlsxReportGenerator.js
│   │   │   ├── reportDataService.js
│   │   │   └── ... (18 services total)
│   │   └── utils/
│   ├── prisma/
│   │   └── schema.prisma
│   └── ... (entry: src/index.js)
└── docker-compose.yml
```


## Design System

All UI work must reference the @evreka-design skill.

Rules:
- Never hardcode color hex values — always use the CSS variables or Tailwind classes
  generated from design-tokens.json
- Typography (font family, size scale, weight) must come from the tokens
- Spacing and border-radius values must come from the tokens
- When in doubt about any visual decision, check docs/design-tokens.json first
- Generated CSS: client/src/styles/tokens.css

## Automated Agents

### code-reviewer (`.claude/agents/code-reviewer.md`)
**When to dispatch**: Automatically after completing any server-side code change that modifies
controllers, services, routes, or Prisma schema. Run as a background agent.
Do NOT ask the user — just dispatch it after the implementation is done.

### test-writer (`.claude/agents/test-writer.md`)
**When to dispatch**: Automatically after creating or modifying any API endpoint or React
component/page. Generate or update the corresponding test file. Run as a background agent.
Do NOT ask the user — just dispatch it after the implementation is done.

## Commands

```bash
# Development
cd server && npm run dev          # Express on port 3001 (nodemon)
cd client && npm run dev          # React on port 3000 (Vite)

# Database
cd server && npx prisma migrate dev   # Run migrations
cd server && node prisma/seed.js      # Seed data
cd server && npx prisma studio        # Visual DB browser

# Build
cd client && npm run build
```

## Testing

- Server: Vitest + Supertest — `cd server && npm test`
- Client: Vitest + React Testing Library — `cd client && npm test`
- Test files: `*.test.js` / `*.test.jsx`
- Server tests: `server/src/__tests__/`
- Client tests: co-located `__tests__/` dirs next to source
- Always run `npm test` in both server and client before claiming work is complete

## Feedback Self-Improvement

When the user rejects an approach, corrects a mistake, or repeats a previous warning:

1. Append the lesson to `memory/feedback.md` with date, rule, **Why**, and **How to apply**
2. Number it sequentially
3. Do NOT ask — just save it silently and continue working
4. If unsure whether something is feedback — skip it, don't ask
