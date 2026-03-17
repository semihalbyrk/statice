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
- All API routes prefixed with /api/v1
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
/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── orders/
│   │   │   ├── assets/
│   │   │   ├── weighing/
│   │   │   ├── sorting/
│   │   │   └── reports/
│   │   ├── store/
│   │   ├── hooks/
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
│   │   │   └── reportGenerator.js
│   │   └── utils/
│   ├── prisma/
│   │   └── schema.prisma
│   └── index.js
└── docker-compose.yml


All UI work must reference the @evreka-design skill.

Rules:
- Never hardcode color hex values — always use the CSS variables or Tailwind classes 
  generated from design-tokens.json
- Typography (font family, size scale, weight) must come from the tokens
- Spacing and border-radius values must come from the tokens
- When in doubt about any visual decision, check design-tokens.json first