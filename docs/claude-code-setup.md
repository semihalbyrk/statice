# Claude Code Setup — Statice MRF

> Last updated: 2026-03-23 | 36 configuration points across global + project scope

## Component Inventory

| Category | Global | Project | Total |
|----------|--------|---------|-------|
| CLAUDE.md | 1 | 1 | 2 |
| Settings (hooks, permissions) | 1 | 1 | 2 |
| Agents (background reviewers) | — | 3 | 3 |
| Skills (utilities) | — | 7 | 7 |
| Hook scripts | 7 | — | 7 |
| Memory files | — | 5 | 5 |
| Symlinks | — | 5 | 5 |
| Plugins | 8 | — | 8 |
| MCP servers | — | 2 | 2 |
| Git hooks (.husky) | — | 1 | 1 |

---

## Session Lifecycle Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SESSION START                                                          │
│                                                                         │
│  1. init.sh          → Detect project type, show git branch/status      │
│  2. memory.sh        → Load UCES session learnings (JSON-based)         │
│  3. feedback inject  → Cat memory/feedback.md into context (10 rules)   │
│  4. CLAUDE.md load   → Global directives + project conventions          │
│  5. MEMORY.md load   → Memory index (pointers to detail files)          │
│  6. MCP connect      → context7 (docs) + postgres (DB access)          │
├─────────────────────────────────────────────────────────────────────────┤
│  USER PROMPT                                                            │
│                                                                         │
│  7. prompt-guard.sh  → Validate prompt (extensible, currently minimal)  │
├─────────────────────────────────────────────────────────────────────────┤
│  PRE-TOOL (before Edit/Write)                                           │
│                                                                         │
│  8. validate.sh      → Warn on *.env*, credentials, secrets files       │
│  9. Block .env       → Hard block on .env file edits                    │
│  10. Block lock      → Hard block on package-lock.json edits            │
├─────────────────────────────────────────────────────────────────────────┤
│  TOOL EXECUTION (Claude writes code)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  POST-TOOL (after Edit/Write)                                           │
│                                                                         │
│  11. format.sh       → Prettier auto-format + TODO/any/console.log warn │
│  12. Vite build      → If client/src edited → build check (15s timeout) │
│  13. Prisma validate → If schema.prisma edited → validate (10s timeout) │
│  14. Auto-test       → Find & run related vitest file (30s timeout)     │
├─────────────────────────────────────────────────────────────────────────┤
│  AGENT AUTO-DISPATCH (after implementation complete)                    │
│                                                                         │
│  15. code-reviewer     → controllers/services/routes/schema changes     │
│  16. test-writer       → API endpoint or React component changes        │
│  17. security-reviewer → auth/CORS/cookie/JWT/middleware changes         │
├─────────────────────────────────────────────────────────────────────────┤
│  PRE-COMMIT (before git commit)                                         │
│                                                                         │
│  18. commit-check.sh → TypeScript check + secret scan + large file warn │
├─────────────────────────────────────────────────────────────────────────┤
│  PRE-PUSH (.husky/pre-push)                                             │
│                                                                         │
│  19. Server tests    → cd server && npx vitest run                      │
│  20. Client tests    → cd client && npx vitest run                      │
│  21. Fail = block    → Push aborted if any test fails                   │
├─────────────────────────────────────────────────────────────────────────┤
│  SESSION END                                                            │
│                                                                         │
│  22. memory.sh       → Persist pending learnings to disk                │
│  23. Feedback write  → If corrections detected → append to feedback.md  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## CLAUDE.md Files

### Global (`~/.claude/CLAUDE.md`)

| Directive | Summary |
|-----------|---------|
| Plan Before Build | Enter plan mode for 3+ step tasks |
| Subagent Strategy | Offload research/exploration to subagents |
| Verification Before Done | Run tests/builds before claiming complete |
| Zero-Tolerance | No placeholders, stubs, deferred work |
| Demand Elegance | Pause and refactor hacky fixes |
| Autonomous Bug Fix | Fix without hand-holding |
| Self-Improvement Loop | Save corrections to memory |

**Restrictions**: No env edits, no `any` types, no unauthenticated routes, no force push without confirmation.

### Project (`statice/CLAUDE.md`)

| Section | Key Rules |
|---------|-----------|
| Stack | React 18, Express, PostgreSQL + Prisma, JWT |
| Conventions | `/api` prefix, thin controllers, Prisma `$transaction()`, AuditLog on every mutation |
| Design System | `@evreka-design` skill, design tokens only, no hardcoded colors |
| Agents | 3 auto-dispatch agents (code-reviewer, test-writer, security-reviewer) |
| Testing | Vitest both sides, always run before claiming done |
| Feedback | SessionStart hook injects rules; write new corrections silently |

---

## Hooks

### Global Hooks (`~/.claude/settings.json`)

| Event | Hook | Action |
|-------|------|--------|
| SessionStart | `init.sh` | Project detection, git status, recent commits |
| SessionStart | `memory.sh` | Load UCES session learnings |
| Stop | `memory.sh` | Persist pending learnings |
| UserPromptSubmit | `prompt-guard.sh` | Prompt validation (extensible) |
| PreToolUse: Edit/Write | `validate.sh` | Warn on sensitive files |
| PreToolUse: Edit/Write | Block `package-lock.json` | Hard block |
| PreToolUse: `npm install` | Expo check | Suggest `npx expo install` if Expo project |
| PreToolUse: `rm -rf` | Prompt | Confirm destructive operation |
| PreToolUse: `git push --force` | Prompt | Confirm force push |
| PreToolUse: `git commit` | `commit-check.sh` | TS check, secret scan, large file warn |
| PostToolUse: Edit/Write | `format.sh` | Prettier + anti-pattern detection |
| PostToolUse: Edit/Write | Vite build | Build check on client/src edits |
| StatusLine | `statusline.sh` | Branch name, unpushed count, context % |

### Project Hooks (`statice/.claude/settings.local.json`)

| Event | Hook | Action |
|-------|------|--------|
| SessionStart | Feedback inject | Cat `feedback.md` rules into context |
| PostToolUse: Edit/Write | Prisma validate | Validate on `schema.prisma` edits |
| PostToolUse: Edit/Write | Auto-test | Run related vitest for server/client |
| PreToolUse: Edit/Write | Block `.env` | Hard block on `.env` edits |

### Git Hook (`statice/.husky/pre-push`)

Runs full server + client test suites before push. Blocks on failure. Skip: `git push --no-verify`.

---

## Agents

| Agent | Trigger | Checks |
|-------|---------|--------|
| **code-reviewer** | Server controllers, services, routes, schema changes | Thin controllers, Prisma transactions, AuditLog, auth guards, error handling, input validation |
| **test-writer** | API endpoint or React component changes | Generate Vitest + Supertest (server) or React Testing Library (client) tests |
| **security-reviewer** | Auth middleware, CORS, cookie, JWT, `server/src/middleware/` changes | JWT handling, role guards, SQL injection, XSS, CORS, sensitive data, rate limiting, cookie security |

All dispatch **automatically as background agents** — no user request needed.

---

## Skills

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `evreka-design` | UI work | Evreka360 design system (colors, typography, components, layout) |
| `prisma` | Schema/DB work | Prisma ORM patterns, error handling, performance |
| `new-module` | Backend module creation | Route → Controller → Service scaffold with AuditLog |
| `add-report` | Report type creation | PDF + XLSX generation with Statice branding |
| `dev-server` | `/dev-server` | Start client + server dev servers |
| `seed-reset` | `/seed-reset` | Reset DB + reseed (destructive, confirms first) |
| `git-pushing` | "push changes" | Smart commit + push with conventional messages |

---

## Plugins (8, user scope — all projects)

| Plugin | Components | Key Capabilities |
|--------|-----------|------------------|
| **Superpowers** | 14 skills, 1 agent, 3 cmds | Brainstorming → planning → TDD → execution → review → branch finish |
| **Frontend Design** | 1 skill | Distinctive UI design, avoids generic AI aesthetics |
| **Feature Dev** | 3 agents, 1 cmd | 7-phase guided feature development (`/feature-dev`) |
| **Code Simplifier** | 1 agent | Refine code for clarity and maintainability |
| **Claude MD Management** | 1 skill, 1 cmd | Audit/improve CLAUDE.md files, capture session learnings |
| **Claude Code Setup** | 1 skill | Analyze codebase, recommend automations |
| **Hookify** | 1 skill, 1 agent, 4 cmds | Create/manage hook rules from conversation analysis |
| **Commit Commands** | 3 cmds | `/commit`, `/commit-push-pr`, `/clean_gone` |

---

## MCP Servers

| Server | Package | Purpose |
|--------|---------|---------|
| **context7** | `@upstash/context7-mcp` | Live documentation lookup for React, Express, Prisma, Tailwind etc. |
| **postgres** | `@modelcontextprotocol/server-postgres` | Direct DB access (query, schema inspect) on `statice_mrf` |

Connection string: `postgresql://statice:statice123@localhost:5432/statice_mrf`

---

## Memory System

| File | Type | Purpose |
|------|------|---------|
| `MEMORY.md` | Index | Auto-loaded every session, pointers to detail files |
| `feedback.md` | Feedback | 10 correction rules, injected via SessionStart hook |
| `project_status.md` | Project | Which PRD modules are done vs. remaining |
| `v22_upgrade_session.md` | Project | v2.2 implementation details (2026-03-17) |
| `reference_postgresql_setup.md` | Reference | Local PG16 vs Docker conflict resolution |

**Location**: `~/.claude/projects/-Users-semihalbayrak-statice/memory/`
**IDE access**: `statice/.claude-memory/` symlink (gitignored)

### Feedback Rules (auto-injected)

| # | Rule | Summary |
|---|------|---------|
| 1 | Cross-tab UI consistency | Align related tabs when updating one |
| 2 | Ready-to-go setups | Deliver complete, no scaffolding |
| 3 | Test data hygiene | Clean up artifacts, use realistic names |
| 4 | PRD terminoloji | Use PRD terms exactly in code |
| 5 | No veri tekrarı | Don't require same data twice in forms |
| 6 | Currency dropdown | Never free-text, always dropdown + icon |
| 7 | StatusBadge standard | Same component everywhere, status = 2nd column |
| 8 | Kebab aksiyon menü | 3-dot MoreVertical, never inline icons |
| 9 | Liste tutarlılığı | py-3, font-medium text-green-700, em-dash for empty |
| 10 | Tam sayfa for complex | >6 fields → dedicated page, not modal |

---

## File Map

```
~/.claude/
├── CLAUDE.md                    ← Global directives (all projects)
├── settings.json                ← Global hooks + plugins
├── MY_PLUGINS.md                ← Plugin reference doc
├── hooks/
│   ├── init.sh                  ← Session init (project detect, git status)
│   ├── memory.sh                ← UCES session memory (load/persist)
│   ├── validate.sh              ← Warn on sensitive file edits
│   ├── format.sh                ← Prettier + anti-pattern detect
│   ├── prompt-guard.sh          ← Prompt validation
│   ├── commit-check.sh          ← Pre-commit (TS, secrets, large files)
│   └── statusline.sh            ← CLI status bar
├── plugins/
│   ├── installed_plugins.json   ← 8 plugins registered
│   └── cache/                   ← Plugin source files
└── projects/-Users-semihalbayrak-statice/
    └── memory/
        ├── MEMORY.md             ← Index (auto-loaded)
        ├── feedback.md           ← 10 correction rules
        ├── project_status.md     ← PRD module tracker
        ├── v22_upgrade_session.md ← v2.2 session notes
        └── reference_postgresql_setup.md ← PG setup

statice/
├── CLAUDE.md                    ← Project conventions
├── .claude/
│   ├── settings.local.json      ← Project hooks + permissions
│   ├── agents/
│   │   ├── code-reviewer.md     ← Auto: server code changes
│   │   ├── test-writer.md       ← Auto: endpoint/component changes
│   │   └── security-reviewer.md ← Auto: auth/security changes
│   ├── skills/
│   │   ├── evreka-design/       ← Design system (628 lines)
│   │   ├── prisma/              ← Prisma ORM patterns
│   │   ├── new-module/          ← Backend module scaffold
│   │   ├── add-report/          ← Report type creation
│   │   ├── dev-server/          ← Start dev servers
│   │   ├── seed-reset/          ← DB reset + reseed
│   │   └── git-pushing/         ← Smart commit + push
│   ├── CLAUDE.global.md         → symlink → ~/.claude/CLAUDE.md
│   ├── MY_PLUGINS.md            → symlink → ~/.claude/MY_PLUGINS.md
│   └── settings.global.json     → symlink → ~/.claude/settings.json
├── .claude-memory/              → symlink → memory directory
├── .claude.json                 ← MCP server config (context7 + postgres)
├── .husky/pre-push              ← Test gate before push
└── .gitignore                   ← .claude/ + .claude-memory excluded
```

---

## Settings Hierarchy

```
Global settings.json          ← Applies to ALL projects
  └── Project settings.local.json  ← Extends/overrides for Statice only

Global CLAUDE.md              ← Universal directives
  └── Project CLAUDE.md       ← Statice-specific rules (takes precedence)
```

**Merge behavior**: Project hooks ADD to global hooks (don't replace). Project permissions are a whitelist. CLAUDE.md rules are additive — project can be more specific but can't contradict global.

**Test Scriptleri ve Code Reviewer agentının temel farkı**:
Test scriptleri (npm test) = otomatik çalışan kod. Her push'ta, her edit'te mekanik olarak çalışır. "Bu fonksiyon 200 dönüyor mu, 401 dönüyor
mu" gibi binary sonuç verir. Pass/fail.

Code reviewer agent = bir LLM'in kodu okuması. "Bu controller çok kalın mı, AuditLog eksik mi, error handling doğru mu" gibi yargı gerektiren
kontroller yapar. Pass/fail değil, CRITICAL/WARNING/INFO severity'leriyle rapor üretir.

