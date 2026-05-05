# Project Vigil — Project Structure

## Repository Root

```
project-vigil/
├── CLAUDE.md                    # Claude Code session guide — stack, conventions, gotchas
├── SPEC.md                      # Full product spec and phase roadmap
├── PROJECT_STRUCTURE.md         # This file
├── README.md                    # Project overview
├── package.json                 # Root workspace manifest + shared dev scripts
├── package-lock.json
├── tsconfig.base.json           # Shared TypeScript config inherited by all packages
├── vitest.workspace.ts          # Vitest workspace config — discovers all package test suites
├── .eslintrc.js                 # ESLint config (TypeScript + Prettier)
├── .prettierrc
├── .gitignore
├── .env                         # Local secrets (not committed) — see .env.example
├── .env.example                 # Template for required env vars
├── .github/
│   └── workflows/
│       └── ci.yml               # CI pipeline: lint → typecheck → test
├── scripts/
│   ├── run-bot.ts               # Entry point — wires all agents into DiscordService and connects
│   ├── seed.ts                  # Seeds 6 sample articles into dev.db for local testing
│   └── seed-outlets.ts          # Seeds the full outlet registry (16+ outlets with bias anchors)
├── services/
│   └── .gitkeep                 # Placeholder for future Lambda handlers (Phase 2c+)
├── packages/                    # npm workspaces — see below
└── data/                        # Runtime-generated, gitignored
    ├── tavily-budget.json        # Tavily monthly/daily search budget state (survives restarts)
    ├── telemetry/
    │   └── YYYY-MM-DD.jsonl     # Append-only API call log (Gemini + Tavily tokens, cost, latency)
    └── newsletters/
        ├── YYYY-MM-DDTHH-MM.html  # SES dry-run rendered newsletter
        └── YYYY-MM-DDTHH-MM.txt   # Plain-text fallback
```

---

## packages/db — Database Layer

Prisma ORM + SQLite for local dev. Swaps to Postgres for production by changing `DATABASE_URL` and provider.

```
packages/db/
├── package.json
├── tsconfig.json
├── .env                         # Prisma CLI only — file:./dev.db (relative to schema.prisma)
├── src/
│   └── index.ts                 # Exports singleton PrismaClient (globalThis pattern for hot-reload safety)
└── prisma/
    ├── schema.prisma            # Data model — Outlet + Article with self-referential corroboration FK
    ├── dev.db                   # SQLite database file (gitignored)
    └── migrations/              # Prisma migration history (auto-generated, committed)
```

### Data Models (`schema.prisma`)

**Outlet**
| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | Primary key |
| `canonicalName` | String (unique) | "Reuters", "Kansas City Star" |
| `aliases` | String | JSON-encoded `string[]` of known variant names and domains |
| `biasAnchor` | Float | -1.0–1.0, seeded from AllSides/Ad Fontes medians |
| `reliabilityBase` | Float | 0.0–1.0 baseline trust; unknown outlets provisioned at 0.5 |
| `region` | String? | Optional primary region; null = global outlet |

**Article**
| Field | Type | Notes |
|-------|------|-------|
| `id` | cuid | Primary key |
| `url` | String (unique) | Source URL |
| `hash` | String (unique) | sha256 of normalized(title + rawContent) for wire-story dedup |
| `title` | String | |
| `summary` | String | 2-3 sentence Gemini-generated factual summary |
| `rawContent` | String? | Full fetched body |
| `outletId` | FK → Outlet | |
| `biasScore` | Float | -1.0–1.0, blended: (Gemini score + outlet anchor) / 2 |
| `trustRating` | Float | 0.0–1.0, computed from reliability + bias + corroboration |
| `region` | String | "local" \| "usa" \| "geopolitical" |
| `sectorTags` | String | JSON-encoded `SectorTag[]` (SQLite has no native arrays) |
| `corroboratedById` | String? | Self-referential FK → Article.id |
| `vettingFlag` | String? | BIAS \| UNVERIFIED \| DUPLICATE \| LOW_TRUST \| UNKNOWN_OUTLET; null = auto-approved |
| `embeddingId` | String? | ChromaDB record ID (set after successful vector upsert) |
| `publishedAt` | DateTime | Estimated publish date from Gemini |
| `collectedAt` | DateTime | When the article was ingested |

---

## packages/shared — Shared Types and Utilities

Pure TypeScript — no external runtime dependencies. Imported by all other packages.

```
packages/shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                 # Re-exports everything
    ├── types.ts                 # Core domain types: Region, SectorTag, VettingFlag,
    │                            #   ArticleVettingResult, RegionStatus, BIAS_ANCHORS
    ├── bias.ts                  # computeTrustRating() — outlet reliability + bias penalty
    │                            #   + single-source penalty → 0.0–1.0 trust score
    ├── bias.test.ts
    ├── outlets.ts               # resolveOutlet() — fuzzy-matches outlet names/domains
    │                            #   against the registry (alias-aware)
    ├── outlets.test.ts
    ├── hash.ts                  # computeArticleHash() — sha256 of normalized title+content
    └── hash.test.ts
```

### Key Exports

- **`Region`** — `'local' | 'usa' | 'geopolitical'`
- **`SectorTag`** — `'policy' | 'economy' | 'conflict' | 'tech' | 'health' | 'environment' | 'legal'`
- **`VettingFlag`** — `'BIAS' | 'UNVERIFIED' | 'DUPLICATE' | 'LOW_TRUST' | 'UNKNOWN_OUTLET'`
- **`ArticleVettingResult`** — output of `computeVettingResult()`: trust score, bias score, flag, auto-approve decision
- **`BIAS_ANCHORS`** — AllSides/Ad Fontes-derived bias anchors keyed by outlet canonical name
- **`computeTrustRating(biasScore, corroboratingCount, reliabilityBase)`**
- **`resolveOutlet(nameOrDomain, outlets[])`** — returns matching `OutletRecord` or null
- **`computeArticleHash(title, rawContent)`**
- **`serializeSectorTags / parseSectorTags`** — JSON round-trip for SQLite storage

---

## packages/clients — AI and Vector API Clients

All external API integrations. Accepts injected `APICallTracker` so every call is recorded.

```
packages/clients/
├── package.json                 # deps: @google/generative-ai, chromadb, zod
├── tsconfig.json
└── src/
    ├── index.ts                 # Re-exports all clients and types
    ├── gemini/
    │   ├── client.ts            # GeminiClient — complete(), completeJSON(), embed()
    │   │                        #   Model tier system (fast/capable), retry + backoff,
    │   │                        #   capable-tier fallback to gemini-2.5-flash
    │   ├── models.ts            # GEMINI_MODELS config — model IDs, pricing constants
    │   │                        #   fast: gemini-3.1-flash-lite-preview
    │   │                        #   capable: gemini-3-flash-preview
    │   │                        #   capableFallback: gemini-2.5-flash
    │   └── types.ts             # CompleteOptions, CompleteJSONOptions interfaces
    ├── chroma/
    │   └── client.ts            # ChromaClient — upsertArticle(), querySimilar(), isReachable()
    │                            #   Wraps chromadb npm client; cosine similarity space;
    │                            #   threshold: 0.85; graceful degradation on failure
    ├── tavily/
    │   ├── client.ts            # TavilyClient — search() with budget enforcement
    │   ├── budget.ts            # SearchBudget — monthly hard limit (1000), daily soft limit (33)
    │   │                        #   Persists state to data/tavily-budget.json
    │   └── types.ts             # TavilySearchResult, BudgetStatus, CanSearchResult
    └── telemetry/
        ├── logger.ts            # Structured logger (Winston-style) — info/warn/error/debug
        │                        #   Outputs JSON to stdout with ISO timestamp
        ├── tracker.ts           # APICallTracker — records every Gemini/Tavily call with
        │                        #   tokens, cost, latency; flushes to data/telemetry/YYYY-MM-DD.jsonl
        └── types.ts             # TelemetryEvent interface

    __tests__/
        ├── gemini.test.ts       # GeminiClient: retry logic, fallback, JSON parsing
        ├── budget.test.ts       # SearchBudget: daily/monthly limit enforcement, persistence
        ├── tavily.test.ts       # TavilyClient: search, budget gate, error handling
        └── tracker.test.ts      # APICallTracker: recording, flush, summary
```

### GeminiClient API

| Method | Tier | Description |
|--------|------|-------------|
| `complete(prompt, opts)` | fast / capable | Raw text completion with retry + backoff |
| `completeJSON<T>(prompt, opts)` | fast / capable | Structured JSON output validated against Zod schema |
| `embed(text)` | — | Returns embedding vector via `gemini-embedding-2` (768-dim equivalent) |

### ChromaClient API

| Method | Description |
|--------|-------------|
| `isReachable()` | Health check — used at startup to warn if ChromaDB is down |
| `upsertArticle(id, embedding, metadata)` | Store/update article embedding in `vigil-articles` collection |
| `querySimilar(embedding, excludeOutletId, topK?)` | Find semantically similar articles from other outlets; returns matches above 0.85 cosine similarity |

---

## packages/discord — Discord Bot Service

Operator interface. All agents communicate through this service — no agent talks to Discord directly.

```
packages/discord/
├── package.json                 # deps: discord.js, zod
├── tsconfig.json
└── src/
    ├── index.ts                 # Re-exports service, formatters, and types
    ├── service.ts               # DiscordService — singleton bot client, handler registration,
    │                            #   approval flow with 1-hour timeout, channel routing
    ├── config.ts                # Zod-validated Discord config (token, admin user ID, channel IDs)
    ├── types.ts                 # ArticleForEmbed, RegionStatus, ApprovalRequest, CommandOptions
    ├── embeds/
    │   ├── intel-card.ts        # formatIntelEmbed() — per-article Discord card with bias bar,
    │   │                        #   trust score, sector tags, vetting flag badge, actionableIntel
    │   ├── newsletter.ts        # formatNewsletterDigest() — 3-panel digest embed for #vigil-general
    │   ├── status.ts            # formatStatusEmbed() — region status card (article count, last run)
    │   ├── bias-alert.ts        # formatBiasAlert() — bias review card with approve/reject buttons
    │   └── skip-review.ts       # formatSkipReviewEmbed() — skip-review prompt for new outlets
    └── __tests__/
        ├── config.test.ts       # Config validation (missing vars, invalid values)
        ├── embeds.test.ts       # Embed formatter output (field names, colors, flag badges)
        └── service.test.ts      # Handler registration, approval flow timeout
```

### Channel Layout

| Channel | Env Var | Commands |
|---------|---------|----------|
| `#vigil-general` | `DISCORD_GENERAL_CHANNEL_ID` | `!digest`, `!flash`, `!briefing`, `!schedule`, `!help` |
| `#vigil-local` | `DISCORD_LOCAL_CHANNEL_ID` | `!collect`, `!scan <topic>`, `!status`, `!sources`, `!review <id>`, `!flag <id>` |
| `#vigil-usa` | `DISCORD_USA_CHANNEL_ID` | same |
| `#vigil-geopolitical` | `DISCORD_GEO_CHANNEL_ID` | same |

### Registered Handlers (set in `scripts/run-bot.ts`)

| Handler | Trigger | Agent method |
|---------|---------|--------------|
| `registerCollectHandler` | `!collect [--review]` | `CollectorAgent.collect()` |
| `registerScanHandler` | `!scan <topic>` | `CollectorAgent.scan()` |
| `registerStatusHandler` | `!status` | `CollectorAgent.getStatus()` |
| `registerSourcesHandler` | `!sources` | `CollectorAgent.getSources()` |
| `registerDigestHandler` | `!digest` | `AggregatorAgent.digest()` |
| `registerFlashHandler` | `!flash` | `AggregatorAgent.flash()` |
| `registerBriefingHandler` | `!briefing` | `AggregatorAgent.briefing()` |

---

## packages/agents — Intelligence Agents

Business logic. Depends on `@vigil/clients`, `@vigil/shared`, `@vigil/discord`. Injects `VigilDB` (Prisma-compatible interface) to stay testable without a live database.

```
packages/agents/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts                         # Re-exports CollectorAgent, AggregatorAgent, types
    ├── collector/
    │   ├── pipeline.ts                  # CollectorAgent — main orchestration:
    │   │                                #   1. Load outlets for region
    │   │                                #   2. Generate Tavily search queries (Gemini fast)
    │   │                                #   3. Execute searches (dedup by URL across queries)
    │   │                                #   4. For each result: hash dedup → unified Gemini vetting
    │   │                                #      → auto-provision unknown outlet → embed + ChromaDB query
    │   │                                #      → computeVettingResult → optional review gate
    │   │                                #      → Prisma save → ChromaDB upsert → Discord embed
    │   ├── vetting.ts                   # computeVettingResult() — pure TS, no LLM:
    │   │                                #   blends bias, derives trust score, determines flag
    │   │                                #   and auto-approve decision
    │   ├── config.ts                    # REGION_CONFIGS — per-region display name, context prompt,
    │   │                                #   base topics for query generation
    │   └── types.ts                     # CollectorEmitter, CollectionOptions, CollectionResult,
    │                                    #   OutletRecord, SavedArticle, VigilDB interface
    ├── aggregator/
    │   ├── index.ts                     # AggregatorAgent — digest(), flash(), briefing()
    │   │                                #   digest(): fetch articles → corroborate → rank per region
    │   │                                #   → Gemini section summaries (with KC-specific local guidance)
    │   │                                #   → Gemini cross-sector analysis → render + dispatch
    │   ├── corroborator.ts              # detectCorroborations() — title-similarity pass across
    │   │                                #   articles from different outlets; returns corroboration pairs
    │   ├── ranker.ts                    # rankArticles() — scores by trust × recency (12h half-life)
    │   │                                #   × corroboration bonus; filters below MIN_TRUST (0.2)
    │   │                                #   computeNewsletterStats() — aggregates corroboration rate,
    │   │                                #   avg trust/bias, sector counts
    │   ├── template.ts                  # renderHtmlEmail() + renderPlainText()
    │   │                                #   Dark-themed HTML email with per-article trust breakdown
    │   │                                #   (outlet %, bias penalty, single-source penalty),
    │   │                                #   temporal context ("Published N days ago"),
    │   │                                #   analyst assessment per section, cross-sector analysis
    │   └── types.ts                     # ArticleRow, RankedArticle, DigestSection,
    │                                    #   Newsletter, NewsletterStats, AggregatorEmitter
    └── __tests__/
        ├── pipeline.test.ts             # CollectorAgent: full pipeline, dedup, corroboration,
        │                                #   ChromaDB paths, review mode, scan, status, sources
        ├── vetting.test.ts              # computeVettingResult: trust scores, flag priority,
        │                                #   auto-approve logic, bias blending, field pass-through
        ├── aggregator.test.ts           # AggregatorAgent: digest, flash, briefing, Gemini prompt
        │                                #   verification (local KC guidance, cross-sector summaries)
        ├── corroborator.test.ts         # detectCorroborations: title similarity, outlet exclusion
        ├── ranker.test.ts               # rankArticles: scoring formula, recency decay, trust filter
        └── template.test.ts             # renderHtmlEmail + renderPlainText: structure, temporal
                                         #   labels, trust breakdown, flag styling, corroboration badge
```

### Collector Pipeline (per article)

```
Tavily search results
  → hash/URL dedup (Prisma lookup)
  → callUnifiedVetting() — single Gemini fast call:
      summary, actionableIntel ("so what"), biasScore,
      sectorTags, outletName, estimatedPublishDate
  → resolveOutlet() — DB registry lookup (alias-aware)
      └─ if unknown: findOrCreateProvisionalOutlet() at reliabilityBase=0.5
                     + Discord notification to operator
  → embed(title + summary) via gemini-embedding-2
  → ChromaDB querySimilar() — cosine ≥ 0.85, excludes same outlet
      └─ if match: isCorroborated=true, corroboratedById=<matchId>
  → computeVettingResult() — flag + trust score + auto-approve
  → [--review mode] requestApproval() if flagged and not auto-approved
  → Prisma article.create()
  → ChromaDB upsertArticle() + Prisma embeddingId update
  → formatIntelEmbed() → Discord channel
```

### Vetting Flag Priority

| Priority | Flag | Condition |
|----------|------|-----------|
| 1 | `UNKNOWN_OUTLET` | Outlet not in registry |
| 2 | `LOW_TRUST` | Trust score < 0.25 |
| 3 | `BIAS` | \|biasScore\| > 0.5 |
| 4 | `UNVERIFIED` | Single-source, not corroborated |
| — | null | All checks pass → auto-approved |

### Auto-Approve Conditions (all must be true)

- `isCorroborated = true`
- `outlet` is a known registry entry
- `|biasScore| < 0.5`

---

## scripts/run-bot.ts — Bot Entry Point

Wires all packages together and starts the Discord connection.

```
Initialization order:
  1. APICallTracker + GeminiClient + SearchBudget + TavilyClient + ChromaClient
  2. ChromaDB reachability check (warn and continue if unreachable)
  3. DiscordService construction + channel ID mapping
  4. CollectorAgent(gemini, tavily, emitter, prisma, chroma)
  5. AggregatorAgent(gemini, aggregatorEmitter, prisma)
  6. Handler registration (collect, scan, status, sources, digest, flash, briefing)
  7. svc.connect() → startup notification to #vigil-general
  8. SIGINT/SIGTERM → graceful shutdown (flush telemetry, disconnect)
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google AI Studio API key |
| `TAVILY_API_KEY` | Yes | — | Tavily search API key |
| `DISCORD_TOKEN` | Yes | — | Discord bot token |
| `DISCORD_ADMIN_USER_ID` | Yes | — | User ID allowed to run bot commands |
| `DISCORD_GENERAL_CHANNEL_ID` | Yes | — | #vigil-general channel ID |
| `DISCORD_LOCAL_CHANNEL_ID` | Yes | — | #vigil-local channel ID |
| `DISCORD_USA_CHANNEL_ID` | Yes | — | #vigil-usa channel ID |
| `DISCORD_GEO_CHANNEL_ID` | Yes | — | #vigil-geopolitical channel ID |
| `DATABASE_URL` | Yes | — | `file:<absolute-path>/packages/db/prisma/dev.db` |
| `CHROMA_URL` | No | `http://localhost:8000` | ChromaDB server URL |
| `GEMINI_FAST_MODEL` | No | `gemini-3.1-flash-lite-preview` | Override fast-tier model |
| `GEMINI_CAPABLE_MODEL` | No | `gemini-3-flash-preview` | Override capable-tier model |
| `GEMINI_EMBEDDING_MODEL` | No | `gemini-embedding-2` | Override embedding model |

---

## Test Suite Summary

| Package | Test File | Tests | Coverage |
|---------|-----------|-------|----------|
| `@vigil/shared` | bias.test.ts | 6 | Trust rating formula, corroboration bonus |
| `@vigil/shared` | hash.test.ts | 8 | Hash normalization, dedup stability |
| `@vigil/shared` | outlets.test.ts | — | Alias resolution |
| `@vigil/clients` | gemini.test.ts | 7 | Retry, fallback, JSON parsing |
| `@vigil/clients` | budget.test.ts | — | Daily/monthly limits, persistence |
| `@vigil/clients` | tavily.test.ts | — | Search, budget gate |
| `@vigil/clients` | tracker.test.ts | — | Recording, flush, summary |
| `@vigil/discord` | embeds.test.ts | 12 | Embed formatters, field content |
| `@vigil/discord` | service.test.ts | 6 | Handler registration, approval flow |
| `@vigil/discord` | config.test.ts | — | Config validation |
| `@vigil/agents` | pipeline.test.ts | 17 | Full collection pipeline, ChromaDB paths |
| `@vigil/agents` | vetting.test.ts | 16 | Flag priority, trust scores, auto-approve |
| `@vigil/agents` | aggregator.test.ts | — | Digest, flash, briefing, Gemini prompts |
| `@vigil/agents` | corroborator.test.ts | — | Title similarity detection |
| `@vigil/agents` | ranker.test.ts | — | Scoring, recency decay |
| `@vigil/agents` | template.test.ts | — | HTML/plain-text rendering |
| **Total** | | **162** | |

Run all: `npm test` — Vitest workspace, no build required (tsx resolves TypeScript directly).
