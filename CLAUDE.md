# Project Vigil — Claude Code Session Guide

## Purpose
Project Vigil is an OSINT research agent network that collects open-source intelligence across three sectors (Local/KC metro, USA national, Geopolitical), corroborates stories across ideologically-diverse outlets using bias scoring, and dispatches a curated 6 AM newsletter. This repo is the alpha/learning build — SQLite locally, targeting AWS Lambda/EventBridge/SES in production.

## Stack
| Layer | Alpha | Production |
|-------|-------|------------|
| Runtime | Node 20 + TypeScript (strict) | Same |
| Package manager | npm workspaces | Same |
| ORM | Prisma | Same |
| Database | SQLite (`file:./dev.db`) | Postgres / RDS |
| Testing | Vitest | Same |
| LLM | — (Phase 1) | Groq / Gemini |
| Search | — (Phase 1) | Tavily |
| Vectors | — (Phase 2) | ChromaDB |
| Infra | — (Phase 1) | Lambda + EventBridge + SQS + SES |

## Monorepo Layout
```
project-vigil/
├── packages/
│   ├── db/          # Prisma client singleton + schema + migrations
│   ├── discord/     # Discord bot service — operator interface for all agents
│   └── shared/      # Region/SectorTag types, bias anchors, trust rating
├── services/        # Lambda handlers (Phase 1+)
├── scripts/
│   ├── seed.ts      # Local dev seed data
│   └── run-bot.ts   # Start Discord bot locally for testing
├── .github/workflows/ci.yml
├── tsconfig.base.json
└── CLAUDE.md        # ← you are here
```

## Common Commands
```bash
npm install               # install all workspace deps
npm run db:generate       # regenerate Prisma client after schema change
npm run db:migrate        # run migrations (creates dev.db on first run)
npm run db:seed           # insert seed articles
npm run db:studio         # open Prisma Studio at localhost:5555
npm run bot:dev           # start Discord bot locally (requires .env Discord vars)
npm run typecheck         # tsc --noEmit across all packages
npm run lint              # eslint packages/**/*.ts
npm test                  # vitest run
```

## Discord Bot (`packages/discord`)

### Channel Layout
| Channel | Purpose | Commands |
|---------|---------|----------|
| `#vigil-general` | Newsletter digest + flash alerts | `!digest`, `!flash`, `!briefing`, `!schedule` |
| `#vigil-local` | KC metro collector | `!collect`, `!scan <topic>`, `!status`, `!sources`, `!review <id>`, `!flag <id>` |
| `#vigil-usa` | USA national collector | same as local |
| `#vigil-geopolitical` | Geopolitical collector | same as local |

All commands are admin-only (`DISCORD_ADMIN_USER_ID`).

### Handler Registration Pattern
Agents register their logic into the bot at startup — the bot is just a router:
```typescript
import { DiscordService } from '@vigil/discord';
const discord = new DiscordService();
discord.registerCollectHandler(async (region) => { /* collector logic */ });
discord.registerDigestHandler(async () => { /* newsletter logic */ });
await discord.connect();
```
If a command arrives before a handler is registered, the bot replies "Agent not initialized yet."

### Approval Flow
For bias-flagged or single-source articles, call `requestApproval(request, channelId?)`. Returns a Promise that resolves when the admin clicks Approve / Reject / Re-analyze (1-hour timeout; auto-rejects on timeout).

## Key Design Decisions
- **SQLite for alpha**: no infra to stand up; swap `DATABASE_URL` + Prisma provider for Postgres in prod.
- **`sectorTags` as JSON string**: SQLite has no native array type. Use `parseSectorTags` / `serializeSectorTags` from `@vigil/shared` everywhere.
- **`hash` field**: sha256 of normalized title+body for wire-story deduplication across outlets.
- **`biasScore` range**: -1.0 (hard left) to 1.0 (hard right), anchored to AllSides/Ad Fontes medians in `BIAS_ANCHORS`. Phase 2 calibrates via embedding similarity.
- **`trustRating`**: `computeTrustRating(biasScore, corroboratingSourceCount)` — naive now, embedding-weighted in Phase 2.
- **`corroboratedById`**: self-referential FK on Article; the "primary" story links to the corroborating story.

## Phase Roadmap
| Phase | Status | Scope |
|-------|--------|-------|
| 0 — Foundation | ✓ Done | Monorepo, Prisma/SQLite, shared types, seed, CI |
| 1a — Discord Bot | ✓ Done | `packages/discord` — bot service, channel routing, embed formatters, handler registration, approval flow |
| 1b — Collectors | Pending | Lambda handlers, EventBridge schedule, Tavily/Groq fetch + summarise, SQS dead-letter |
| 2 — Intelligence | Pending | ChromaDB vector corpus, trend inference, bias calibration via anchor embeddings |
| 3 — Dispatch | Pending | SES newsletter renderer, 6 AM cron, unsubscribe flow |

## Environment Variables
Copy `.env.example` → `.env`. Only `DATABASE_URL` is required locally.

## Known Environment Gotchas

**WSL + SQLite relative paths (CANTOPEN error)**
Prisma's runtime resolves `file:./` paths differently than the Prisma CLI. In WSL, using `file:./packages/db/prisma/dev.db` in the root `.env` causes `Error code 14: Unable to open the database file` at runtime even though the file exists. Fix: the `db:seed` npm script injects an absolute path via `DATABASE_URL="file:$(pwd)/packages/db/prisma/dev.db"`. The Prisma CLI (migrate/generate) uses `packages/db/.env` with `file:./dev.db`, which it resolves relative to `prisma/schema.prisma` → `packages/db/prisma/dev.db`. Both point to the same physical file.

**Two env files on purpose**
`packages/db/.env` is for the Prisma CLI only. The root `.env` comment about DATABASE_URL is largely informational — the actual runtime value for seed is set by the npm script. Do not consolidate them.

**npm workspaces (not pnpm)**
Originally scaffolded for pnpm 9 but switched to npm workspaces mid-Phase 0 to avoid WSL installation friction. All workspace commands use `npm run ... -w packages/<name>`. No pnpm files remain.
