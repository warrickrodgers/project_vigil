# Project Vigil — Master Specification

**Version:** 2.0
**Last Updated:** April 22, 2026
**Status:** Active Development — Phase 2 (Hardening)

---

## Mission Statement

Project Vigil is a defensive OSINT (Open Source Intelligence) agent network that collects, corroborates, and curates actionable intelligence from public sources across three sectors — Local (Kansas City metro), USA National, and Geopolitical. The system produces a daily intelligence newsletter and operates through a Discord-based command interface for human-in-the-loop oversight.

**This is not a news aggregator.** It is a bias-aware intelligence pipeline that cross-references sources, flags ideological skew, and surfaces *actionable* implications — how events affect real groups, economies, and policy trajectories.

---

## North Star Vision

Vigil's end-state is a **personalized intelligence analyst** — a miniature civilian OSINT operation that doesn't just report what happened, but tells the reader what it means *for them specifically*.

### Evolution Arc

**Stage 1 — Single Researcher (NOW)**
One agent, three sectors (Local, USA, Geopolitical). Single consumer (alpha tester). Generic actionable intelligence — "here's what this means for people in your position generally." The system learns to collect, corroborate, score, and summarize reliably.

**Stage 2 — Regional Specialists**
Duplicate researcher agents specializing by world region — each with tuned source lists, cultural context in their system prompts, and domain expertise in how they interpret events. The analyst roster expands:

```
agents/
├── researcher-local/       # KC metro — city council, state legislature, regional economy
├── researcher-usa/         # Domestic policy, federal regulation, interstate effects
├── researcher-mena/        # Middle East / North Africa — energy, conflict, migration
├── researcher-pacific/     # China, Japan, Korea, ASEAN — trade, tech, military posture
├── researcher-latam/       # Latin America — commodities, governance, US relations
├── researcher-europe/      # EU policy, NATO, energy transition, digital regulation
├── researcher-africa/      # Resource extraction, China/Belt-Road, governance transitions
```

Each agent owns its sector's Discord channel, maintains its own source registry, and develops a "beat" — persistent awareness of running stories and unresolved threads in its region.

**Stage 3 — Cross-Sector Analyst**
A meta-agent that reads *across* all regional researchers' output, powered by the vector corpus. It identifies patterns that no single regional agent would catch:
- "The BRICS payment system pilot + EU digital trade tensions + Treasury yield inversion are three data points on the same trend line: dollar hegemony erosion."
- "China's Zimbabwe lithium deal + EU battery regulation + US EV tariff debate are converging on a supply chain bottleneck in Q3."

This is the "chessboard inference" layer — seeing the board, not just the pieces.

**Stage 4 — Personalized Advisor**
User context integration. The system knows:
- What industry you work in
- What your investment exposure looks like
- Where you live and what local policy affects you
- What your career trajectory depends on
- What you've flagged as personally relevant in past briefings

The interpretive summary stops being "here's what this means generally" and becomes "here's what this means for *you*." The morning newsletter for a supply chain logistics manager in Kansas reads completely differently from the one for a fintech founder in Austin — same raw intelligence, different interpretation layer.

### Source Vetting Philosophy

**Trustworthiness ≠ Agreement with Consensus.**

A naive trust model penalizes any outlet that deviates from mainstream consensus — effectively turning the system into an AP News amplifier. But some of the most valuable intelligence comes from sources that *disagree* with the mainstream before the mainstream catches up (the 2008 housing crisis coverage, early lab leak hypothesis reporting, local reporters with boots-on-the-ground context that national outlets miss).

Vigil's source vetting must avoid the **groupthink trap**: calibrating "reliable" to mean "agrees with Reuters." Instead, outlets are evaluated on multiple independent dimensions:

| Dimension | What It Measures | Example |
|-----------|-----------------|---------|
| **Factual accuracy** | Do claims check out against primary sources? | Court records, SEC filings, government data |
| **Source transparency** | Do they cite sources? Distinguish reporting from opinion? | Inline citations vs. "sources say" |
| **Correction behavior** | Do they issue corrections when wrong? | Published corrections page — strongest reliability signal |
| **Prediction track record** | When they made forward-looking claims, were they right? | The Burry/Taleb metric |
| **Independence** | Original reporting or rewording the AP wire? | Unique sourcing vs. syndicated content |
| **Conflict of interest** | Who funds them? What's their incentive structure? | Corporate ownership, ad revenue model, state funding |

An outlet can score high on factual accuracy and source transparency while disagreeing with mainstream framing — and that's *exactly* the outlet you want in an intelligence feed. That's the source that surfaces signal 6 months before consensus shifts.

**Current implementation (Phase 1-2a):** Outlets are seeded with static bias anchors from AllSides/Ad Fontes. Unknown outlets are logged and skipped. This is a pragmatic starting point but does not reflect the full vetting model above.

**Future implementation (Source Vetting Agent):** A dedicated agent that periodically audits outlets against these dimensions, detects bias drift over time, and auto-provisions unknown outlets with provisional scores calibrated from their first N articles — not from their agreement with established outlets. Unknown outlets are evaluated on: "Does this article cite primary sources? Does it distinguish factual claims from editorial interpretation?" — not "Does it agree with Reuters?"

This philosophy is foundational. Every trust model enhancement in future phases must preserve the principle that **heterodox ≠ unreliable**.

### What This Is NOT
- Not a trading signal service (though financial implications are surfaced)
- Not a political advocacy tool (bias is detected and flagged, not amplified)
- Not a replacement for professional intelligence services (it's open-source only)
- Not a social media feed (no engagement optimization, no virality bias)

The core principle is **defensive intelligence** — helping ordinary people understand how large-scale geopolitical, economic, and policy movements affect their lives, before those effects arrive.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     DISCORD BOT (long-lived process)        │
│                                                             │
│  #vigil-general    #vigil-local   #vigil-usa   #vigil-geo  │
│  ┌────────────┐    ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Newsletter │    │ !collect │  │ !collect │  │ !collect│ │
│  │ Digest     │    │ !scan    │  │ !scan    │  │ !scan   │ │
│  │ Flash Alts │    │ !status  │  │ !status  │  │ !status │ │
│  └────────────┘    └────┬─────┘  └────┬─────┘  └────┬────┘ │
│                         │             │              │      │
│                    ┌────▼─────────────▼──────────────▼────┐ │
│                    │        COLLECTOR (in-process)        │ │
│                    │   Tavily Search → Gemini Summarize   │ │
│                    │   → Bias Score → Dedup → Prisma DB   │ │
│                    └──────────────────┬───────────────────┘ │
│                                      │                      │
│                    ┌─────────────────▼───────────────────┐  │
│                    │         AGGREGATOR (in-process)      │  │
│                    │   Rank → Corroborate → Gemini Edit   │  │
│                    │   → HTML Email → SES + Discord       │  │
│                    └─────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   SHARED SERVICES                     │  │
│  │  Prisma/SQLite  │  Gemini Client  │  Tavily Client   │  │
│  │  Outlet Registry│  Budget Tracker │  Telemetry/Logs   │  │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

Phase 2c+ (Production):
  Discord bot stays local (dev/operator tooling)
  Collectors → Lambda + EventBridge (3x daily)
  Aggregator → Lambda
  SQS results queue + dead letter queue
  Supabase Postgres (replaces SQLite)
  S3 for newsletter HTML archive
  SES from initiativevigil.com
  Next.js frontend for subscribers (Phase 3)
```

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js 20, TypeScript (strict) | |
| Monorepo | npm workspaces | Switched from pnpm due to WSL friction |
| Database | Prisma ORM + Supabase Postgres | Free tier, 500MB, auto-pause after 1wk inactivity |
| AI — Fast | Gemini 3.1 Flash Lite | Collection, summarization. 500 RPD free |
| AI — Capable | Gemini 3 Flash → 2.5 Flash fallback | Editing, aggregation, newsletter |
| Search | Tavily REST API | Free tier: 1000 searches/month |
| Bot | discord.js v14 | Dev/operator tooling only — NOT deployed to AWS |
| Email | AWS SES | `initiativevigil.com`, sandbox mode for beta |
| DNS | Squarespace | DKIM/SPF/DMARC records for SES |
| Vectors | ChromaDB / Pinecone | Corroboration + trend analysis |
| Caching | Upstash Redis | Optional/learning — future phases |
| Auth | Clerk | Phase 2.5 — subscriber management |
| Payments | Stripe | Phase 2.5 — payment links, then full integration |
| Frontend | Next.js | Phase 3 — marketing + subscriber dashboard |
| CI | GitHub Actions | Lint + typecheck + test on PR |
| Deploy | AWS Lambda + EventBridge + SQS | Phase 2c, cost target $0-10/month |
| Storage | AWS S3 | Newsletter HTML archive |

---

## Monorepo Structure

```
project-vigil/
├── packages/
│   ├── db/              # Prisma schema, client, migrations
│   ├── shared/          # Types, bias utils, hash, constants
│   ├── clients/         # Gemini + Tavily wrappers, telemetry
│   ├── discord/         # Discord bot service, embeds, config
│   └── agents/          # Collector + aggregator logic
├── apps/
│   └── web/             # Next.js frontend (Phase 3)
├── services/            # Lambda handlers (Phase 2c)
├── scripts/             # Seed, bot runner, utilities
├── data/                # Local state: telemetry, budget (gitignored)
└── infra/               # CDK/SAM (Phase 2c)
```

---

## Phase Breakdown

---

### Phase 1 — Core Pipeline ✅ COMPLETE

Everything in Phase 1 has been built and tested. The full collection → summarization → bias scoring → corroboration → newsletter pipeline runs end-to-end locally.

---

#### Phase 0 — Foundation ✅ COMPLETE

**Goal:** Working monorepo with schema, migrations, and local dev loop.

| Item | Status | Notes |
|------|--------|-------|
| npm workspaces monorepo scaffold | ✅ | |
| `packages/db` — Prisma + SQLite | ✅ | |
| `Article` model + migration | ✅ | |
| `packages/shared` — types, bias utils | ✅ | |
| `computeTrustRating()` with tests | ✅ | 6 tests passing |
| Seed script (6 articles) | ✅ | |
| CI workflow (lint, typecheck, test) | ✅ | |
| CLAUDE.md | ✅ | |

**Deliverables:** `npm install` → `npm run db:migrate` → `npm run db:seed` → `npm run db:studio` all green.

---

#### Phase 1a — Outlet Model + Hash Fix ✅ COMPLETE

**Goal:** Normalize outlet data, fix dedup strategy, document environment gotchas.

| Item | Status | Notes |
|------|--------|-------|
| `Outlet` model + FK on `Article` | ✅ | |
| Seed 16+ outlets with bias anchors + aliases | ✅ | |
| `resolveOutlet()` with alias matching | ✅ | |
| `computeArticleHash()` — title+rawContent | ✅ | |
| Updated `computeTrustRating()` with outlet reliability | ✅ | |
| WSL + SQLite path docs in CLAUDE.md | ✅ | |
| Tests for outlets, hash, updated bias | ✅ | |

---

#### Phase 1a-D — Discord Bot Foundation ✅ COMPLETE

**Goal:** Operator interface shell — bot connects, routes commands, accepts handler registration.

| Item | Status | Notes |
|------|--------|-------|
| `packages/discord` workspace package | ✅ | |
| `DiscordService` singleton (DeskCurator pattern) | ✅ | |
| Zod-validated Discord config | ✅ | |
| Channel-per-region routing | ✅ | 4 channels: general + 3 sectors |
| 9 handler registration methods | ✅ | All typed, null-safe |
| Approval flow (approve/reject/edit buttons) | ✅ | For bias review |
| Embed formatters (intel, newsletter, bias, status) | ✅ | |
| `scripts/run-bot.ts` dev runner | ✅ | |
| 28 tests (config, embeds, service) | ✅ | |

---

#### Phase 1b — AI Client Wrappers ✅ COMPLETE

**Goal:** Shared Gemini + Tavily clients with telemetry, budget tracking, and cost logging.

| Item | Status | Notes |
|------|--------|-------|
| `packages/clients` workspace package | ✅ | |
| `GeminiClient` — `complete()` + `completeJSON()` | ✅ | |
| Model tier system (`fast` / `capable`) | ✅ | |
| Retry + exponential backoff (3 retries, 1s/3s/9s) | ✅ | |
| `capable` tier fallback to `gemini-2.5-flash` | ✅ | |
| `TavilyClient` — `search()` with free tier defaults | ✅ | |
| `SearchBudget` — monthly hard limit, daily soft limit | ✅ | |
| Budget persistence to `data/tavily-budget.json` | ✅ | |
| `APICallTracker` — per-call token/cost/latency logging | ✅ | |
| Telemetry flush to `data/telemetry/YYYY-MM-DD.jsonl` | ✅ | |
| Structured logger (replaces console.log) | ✅ | |
| Model pricing constants (with TODO for GA pricing) | ✅ | Preview models at $0.0 |
| Integration with `run-bot.ts` (construct, don't call) | ✅ | |
| Tests: Gemini mock, Tavily mock, budget, tracker | ✅ | 32 tests passing |

**Note:** Gemini preview model IDs (`gemini-3.1-flash-lite-preview`, `gemini-3-flash-preview`) may change on GA. Override via `GEMINI_FAST_MODEL` / `GEMINI_CAPABLE_MODEL` env vars without code changes.

---

#### Phase 1c — Collector Agent ✅ COMPLETE

**Goal:** End-to-end collection pipeline running in-process with the bot. Type `!collect` in a channel, get intel back as embeds.

| Item | Status | Notes |
|------|--------|-------|
| `packages/agents/src/collector/` module | ✅ | `pipeline.ts`, `config.ts`, `types.ts` |
| Region config — source outlets per region | ✅ | `REGION_CONFIGS` with displayName, contextPrompt, baseTopics |
| Search strategy — query generation per region/sector | ✅ | Gemini Fast generates 3 queries via `QueryGenerationSchema` |
| Gemini summarization prompt (structured JSON output) | ✅ | `ArticleSummarySchema` — summary, actionableIntel, biasScore, sectorTags, outletName, estimatedPublishDate |
| Bias scoring — compare article against outlet anchor | ✅ | Blended: `(geminiScore + outlet.biasAnchor) / 2` |
| Trust rating computation with corroboration check | ✅ | `computeTrustRating(blendedBias, 0, reliabilityBase)` — Phase 1 uses 0 corroboration |
| Dedup — hash check before insert | ✅ | Checks hash + URL; skips if either exists |
| Prisma write — article + outlet FK resolution | ✅ | Via injected `VigilDB` interface |
| Register `CollectHandler` on Discord bot | ✅ | Wired in `scripts/run-bot.ts` |
| Register `ScanHandler` (ad-hoc topic deep dive) | ✅ | Uses `advanced` search depth, 5 max results |
| Register `StatusHandler` (last run, counts, budget) | ✅ | Returns `RegionStatus` with outlet count + last collection time |
| Register `SourcesHandler` (outlet list + bias scores) | ✅ | Returns outlets sorted by name |
| Post intel embeds to originating channel | ✅ | `formatIntelEmbed` → `sendEmbed` per article |
| Error handling — partial failures don't crash run | ✅ | Per-article try/catch; pipeline continues on single failure |
| Tests: collection pipeline with mocked Gemini/Tavily | ✅ | 12 tests |

**Key Design Decisions:**
- **Dependency injection**: `CollectorAgent` accepts `VigilDB` as constructor param — avoids Vite resolution failure in tests.
- **Outlet resolution**: AI-identified name first, domain fallback second; on miss → log + skip.
- **vitest.workspace.ts** added at root so `npm test` picks up all packages' configs correctly.

**Known Issue — Needs Revisit:** `packages/discord/src/__tests__/service.test.ts` → "registers collectHandler and can receive calls" times out at 5000ms. Pre-existing, unrelated to Phase 1c. Likely a Discord.js mock not resolving a promise.

---

#### Phase 1d — Aggregator + Newsletter ✅ COMPLETE

**Goal:** Morning digest — aggregate top intel across all sectors, generate newsletter HTML, post to `#vigil-general`, send via email.

| Item | Status | Notes |
|------|--------|-------|
| `packages/agents/src/aggregator/` module | ✅ | |
| Ranking algorithm — score articles by trust × recency × priority | ✅ | |
| Corroboration pass — link articles covering same story | ✅ | |
| Section builder — top 3-4 items per sector | ✅ | |
| Gemini Capable: interpretive summary generation | ✅ | |
| Gemini Capable: cross-sector analysis + editorial pass | ✅ | |
| HTML email template (responsive, plain-text fallback) | ✅ | |
| Save rendered HTML + plain-text to `data/newsletters/` | ✅ | |
| Newsletter embed to `#vigil-general` | ✅ | |
| Register `DigestHandler` on Discord bot | ✅ | |
| Register `FlashHandler` (breaking items since last digest) | ✅ | |
| Register `BriefingHandler` (full status across all regions) | ✅ | |
| `!digest` command triggers manual newsletter build | ✅ | |
| SES integration (dry-run mode for alpha) | ✅ | |
| Tests: aggregation logic, ranking, corroboration, template | ✅ | |

---

### Phase 2 — Hardening ⬜ CURRENT

**Goal:** Transform the working prototype into a reliable, autonomous system. Consolidate AI calls, remove human-in-the-loop bottleneck, add scheduling, deploy to AWS, integrate vector DB for corroboration.

Phase 2 is subdivided into focused sub-phases that can be executed as individual Claude Code sessions.

---

#### Phase 2a — Vetting Refactor + Prompt Consolidation ✅ COMPLETE

**Goal:** Replace the multi-call collect-then-assess pipeline with a unified vetting system. Remove mandatory human approval; replace with auto-approve logic + annotation flags. Cut Gemini call count roughly in half.

##### Unified Vetting Model

The current pipeline makes separate Gemini calls for summarization and outlet assessment. Phase 2a consolidates into a single structured JSON call per article that returns everything:

```typescript
interface ArticleVettingResult {
  // From single Gemini call:
  summary: string;
  actionableIntel: string;
  biasScore: number;          // -1.0 to 1.0
  sectorTags: SectorTag[];
  outletName: string;
  estimatedPublishDate: string;

  // Computed post-call in TypeScript:
  trustScore: number;         // 0.0 - 1.0
  isCorroborated: boolean;    // vector similarity check (Phase 2b) or title match
  outletKnown: boolean;       // hits outlets table
  autoApprove: boolean;       // derived from rules below
  flag: VettingFlag | null;   // annotation, not a blocker
}

type VettingFlag = 'BIAS' | 'UNVERIFIED' | 'DUPLICATE' | 'LOW_TRUST' | 'UNKNOWN_OUTLET';
```

##### Auto-Approve Logic (pure TypeScript, no LLM)

```typescript
const autoApprove =
  result.trustScore > 0.6 &&
  Math.abs(result.biasScore) < 0.5 &&
  result.isCorroborated &&
  result.outletKnown;
```

Articles that fail auto-approve are **NOT blocked** — they still flow into the newsletter. The flag annotates them:
- Newsletter template renders flagged articles with muted styling + caveat line
- Discord embed shows flag badge (⚠️ BIAS, 🔍 UNVERIFIED, etc.)
- `!review <id>` command still available for manual override

This is more honest intelligence than silently dropping articles.

##### Human-in-the-Loop Becomes Optional

The approval flow from Phase 1a-D stays in the codebase but becomes opt-in:
- `!collect` runs fully automated by default
- `!collect --review` triggers the old approval flow for flagged articles
- `!digest --review` holds flagged articles for approval before newsletter publish
- Operator can still `!flag <id>` manually at any time

| Item | Status | GitHub Issue |
|------|--------|-------------|
| Unified `ArticleVettingResult` type in `@vigil/shared` | ⬜ | |
| Consolidated Gemini prompt — single `completeJSON()` call per article | ⬜ | |
| Auto-approve logic in `packages/agents/src/collector/vetting.ts` | ⬜ | |
| `VettingFlag` enum + flag derivation rules | ⬜ | |
| Update collector pipeline to use unified vetting | ⬜ | |
| Remove separate outlet-assessment Gemini call | ⬜ | |
| `--review` flag on `!collect` and `!digest` commands | ⬜ | |
| Newsletter template: flagged article styling (muted + caveat) | ⬜ | |
| Discord embed: flag badges on intel cards | ⬜ | |
| Update telemetry: verify ~50% reduction in Gemini calls | ⬜ | |
| Tests: auto-approve logic, flag derivation, edge cases | ⬜ | |

**Acceptance:** `!collect` runs fully automated. Articles with `|bias| > 0.5` or single-source show flag badge but still appear. Gemini calls per collection run reduced by ~50%. `!collect --review` still triggers approval flow for flagged items.

---

#### Phase 2b — Vector Corroboration + Intelligence Quality ⬜

**Goal:** Integrate vector DB for real corroboration (not just title matching). Enhance the "actionable intel" and "analyst assessment" quality in the newsletter. Move from "policy summary" to "what should the reader do."

##### Vector DB Integration

ChromaDB (local alpha) or Pinecone (prod) for article embeddings. Every article gets embedded at collection time. Corroboration becomes semantic similarity search:

```typescript
// During collection, after Gemini vetting:
const embedding = await gemini.embed(article.title + ' ' + article.summary);
const similar = await vectorDB.query(embedding, { topK: 5, minScore: 0.85 });

// If similar articles exist from different outlets → corroborated
const corroboratingArticles = similar.filter(s => s.outletId !== article.outletId);
result.isCorroborated = corroboratingArticles.length > 0;
```

This feeds directly into the auto-approve logic from Phase 2a.

##### Intelligence Quality Enhancement

The current newsletter reads like a policy summary. Phase 2b enhances the prompts to produce actionable intelligence:

**Per-article actionability:** Every article must have a "so what" — what should the reader do, watch for, or prepare for. The Gemini vetting prompt gets an enhanced `actionableIntel` field requirement:
- BAD: "The Overland Park City Council has approved the 2026 budget."
- GOOD: "OP's 2026 budget increases public safety spending 12% while cutting parks. If you're in the 435/Metcalf corridor, expect road work delays through Q3. Homeowners: reassessment uses this budget's millage rate."

**Trust score transparency:** Newsletter shows the math, not just the number:
- "KC Star scored 56%: outlet reliability 78%, bias penalty -7%, single-source penalty -20%"

**Temporal context:** If we've collected similar articles recently, note it:
- "We first reported on this 3 days ago" or "New development — not previously tracked"

**Local analysis gap:** The local section's analyst assessment was empty in the first newsletter. Local needs the *strongest* interpretation because that's where the reader can actually act.

| Item | Status | GitHub Issue |
|------|--------|-------------|
| ChromaDB integration — embed articles at collection time | ⬜ | |
| `embeddingId` field populated on Article model | ⬜ | |
| Semantic corroboration — vector similarity across outlets | ⬜ | |
| Wire corroboration into auto-approve logic | ⬜ | |
| Unknown outlet auto-provision — provisional entry after 3+ encounters | ⬜ | |
| Provisional outlet scoring — `reliability: 0.5`, calibrate from first N articles | ⬜ | |
| Discord notification on new outlet detection | ⬜ | |
| Enhanced actionableIntel prompt — "so what" requirement | ⬜ | |
| Trust score transparency in newsletter template | ⬜ | |
| Temporal context — "first reported X days ago" / "new" | ⬜ | |
| Local sector analyst assessment prompt enhancement | ⬜ | |
| Cross-sector analyst prompt — connect dots across regions | ⬜ | |
| Tests: vector corroboration, temporal context, outlet auto-provision | ⬜ | |

**Acceptance:** Articles have embeddings. Corroboration uses semantic similarity (>0.85 threshold). Newsletter actionableIntel reads as "do this" not "this happened." Trust scores show derivation. Local section has meaningful analyst assessment.

---

#### Phase 2c — AWS Deployment + SES ✅ COMPLETE (polish remaining)

**Goal:** Deploy the collection and aggregation pipeline to AWS. Discord bot remains local as dev/operator tooling only. Database already migrated to Supabase.

##### Architecture Decisions

- **Database:** Supabase Postgres (free tier, 500MB, auto-pause after 1 week inactivity). SQLite → Supabase migration already complete ✅
- **Discord bot:** Stays local — dev/operator tooling only, NOT deployed to AWS
- **Scheduling:** EventBridge rules (no node-cron)
- **Secrets:** Lambda environment variables (not Secrets Manager — stays under $10/month)
- **Email:** SES from `initiativevigil.com`, sandbox mode acceptable for beta (<200 emails/day), request production access at ~50 subscribers
- **DNS:** Squarespace DNS for DKIM/SPF/DMARC/MX records
- **Cost target:** ~$0/month at beta scale, hard ceiling $10/month

##### EventBridge Schedule

| Time (CT) | Event | Type | Sectors |
|-----------|-------|------|---------|
| 05:00 | Morning Sweep | Full collection | All 3 |
| 06:00 | Newsletter Dispatch | Aggregate + email | All 3 |
| 12:00 | Midday Flash | Breaking-only scan | All 3 |
| 18:00 | Evening Sweep | Full collection | All 3 |

##### DNS / Email Records

```
SPF:   v=spf1 include:amazonses.com ~all
DKIM:  3x CNAME records from SES console
DMARC: v=DMARC1; p=quarantine; rua=mailto:...
MX:    (if needed for bounce handling)
```

| Item | Status | Notes |
|------|--------|-------|
| SQLite → Supabase Postgres migration | ✅ | |
| Local Docker Postgres for dev (dev/prod parity) | ✅ | `npm run db:up`, `NODE_ENV` routes to correct DB |
| `BudgetState` singleton table in Prisma schema | ✅ | Migration `20260501153452_add_budget_state` |
| Migrate Tavily budget from JSON file to Supabase | ✅ | `services/lib/db-budget.ts` |
| Lambda handlers in `services/` — collector (region param) | ✅ | |
| Lambda handler — aggregator + newsletter dispatch | ✅ | |
| CDK stack: Lambda functions | ✅ | `NodejsFunction` with Prisma binary bundling |
| CDK stack: EventBridge rules (4x daily schedule) | ✅ | 05:00, 06:00, 12:00, 18:00 CT |
| CDK stack: SQS results queue + dead letter queue | ✅ | 14-day retention on DLQ |
| Lambda environment variables | ✅ | DB, Gemini, Tavily, SES keys |
| Collector Lambda live + tested | ✅ | 8 articles collected, saved to Supabase |
| Aggregator Lambda live + tested | ✅ | Newsletter built and dispatched via SES |
| `!schedule` command — show next run times | ✅ | Implemented in `scripts/run-bot.ts` |
| SES sending domain `initiativevigil.com` setup | ⬜ | Squarespace DNS: DKIM/SPF/DMARC needed — fixes spam |
| SES sandbox → production access request | ⬜ | Deferred to ~50 subscribers |
| S3 bucket for newsletter HTML archive | ⬜ | Currently writes to `/tmp` in Lambda |
| CloudWatch basic monitoring (free tier) | ⬜ | |
| CI/CD: GitHub Actions → deploy pipeline | ⬜ | |
| Tavily budget alerts (80% / 95% thresholds) | ⬜ | |
| Daily telemetry summary to `#vigil-general` | ⬜ | |

---

#### Phase 2d — Known Issues + Tech Debt ⬜

**Goal:** Clean up accumulated issues before building customer-facing features.

| Item | Status | Notes |
|------|--------|-------|
| Tavily 7-10 day freshness cutoff | ✅ | `days: 10` default in `TavilyClient.search()` |
| Email dark mode CSS fix | ✅ | `color-scheme` meta + `@media prefers-color-scheme` overrides |
| Revise newsletter font | ⬜ | Current: Georgia serif. Consider system-ui or a sharper monospace pairing |
| Fix Discord service test timeout (pre-existing) | ⬜ | |
| Audit all `// TODO` comments across codebase | ⬜ | |
| Update Gemini model IDs when GA pricing published | ⬜ | Deferred — revisit when first paid subscribers onboarded |
| Evaluate `sectorTags` junction table need | ⬜ | |
| Upstash Redis — article dedup cache, rate limit state | ⬜ | |
| Error recovery: what happens when Gemini is down for a full cycle? | ⬜ | |
| Stale article cleanup — archive articles older than 30 days | ⬜ | |

---

### Phase 2.5 — Monetization Hook

**Goal:** First 10-20 paying subscribers with near-zero dev effort. Stripe payment links + subscriber table + manual onboarding script. No custom UI, no auth system yet.

---

#### Tiers

| Tier | Price | Cadence | What You Get |
|------|-------|---------|--------------|
| Free | $0 | Weekly | Single digest, all three sectors, basic trust scores |
| Pro | $4.99/mo | Daily | Full daily brief, flash alerts, analyst assessment, corroboration indicators, bias scores |
| Regional Pro | $9.99/mo | Daily | Everything in Pro + hyper-local coverage (city council, courts, zoning) |
| Enterprise | $29.99/mo | Daily | Custom regions, custom keywords, API access, weekly chessboard trend report |

---

#### Tasks

| Item | Status |
|------|--------|
| `Subscriber` model — email, tier, stripeCustomerId, active, locale, createdAt | ⬜ |
| Stripe account + two payment links (Pro $4.99, Regional Pro $9.99) | ⬜ |
| Newsletter pipeline reads from Subscriber table | ⬜ |
| FREE tier → weekly batch Sunday 6am CT | ⬜ |
| PRO+ → daily 6am CT | ⬜ |
| `scripts/add-subscriber.ts` — manual onboarding CLI | ⬜ |
| Stripe webhook → auto-provision subscriber (when ready) | ⬜ |
| Landing page — Carrd or S3 static, email capture + payment links | ⬜ |

---

#### Acceptance
Someone clicks a Stripe link, pays $4.99, you run `add-subscriber.ts`, they receive tomorrow's 6am brief. Cancellation in Stripe → `active = false`. No custom UI required.### Phase 2.5 — Monetization Hook

**Goal:** First 10-20 paying subscribers with near-zero dev effort. Stripe payment links + subscriber table + manual onboarding script. No custom UI, no auth system yet.

---

#### Tiers

| Tier | Price | Cadence | What You Get |
|------|-------|---------|--------------|
| Free | $0 | Weekly | Single digest, all three sectors, basic trust scores |
| Pro | $4.99/mo | Daily | Full daily brief, flash alerts, analyst assessment, corroboration indicators, bias scores |
| Regional Pro | $9.99/mo | Daily | Everything in Pro + hyper-local coverage (city council, courts, zoning) |
| Enterprise | $29.99/mo | Daily | Custom regions, custom keywords, API access, weekly chessboard trend report |

---

#### Tasks

| Item | Status |
|------|--------|
| `Subscriber` model — email, tier, stripeCustomerId, active, locale, createdAt | ⬜ |
| Stripe account + two payment links (Pro $4.99, Regional Pro $9.99) | ⬜ |
| Newsletter pipeline reads from Subscriber table | ⬜ |
| FREE tier → weekly batch Sunday 6am CT | ⬜ |
| PRO+ → daily 6am CT | ⬜ |
| `scripts/add-subscriber.ts` — manual onboarding CLI | ⬜ |
| Stripe webhook → auto-provision subscriber (when ready) | ⬜ |
| Landing page — Carrd or S3 static, email capture + payment links | ⬜ |

---

#### Acceptance
Someone clicks a Stripe link, pays $4.99, you run `add-subscriber.ts`, they receive tomorrow's 6am brief. Cancellation in Stripe → `active = false`. No custom UI required.

---

### Phase 3 — Web UI ⬜

**Goal:** Next.js marketing site, pricing page, self-serve signup, subscriber dashboard. This is the "real product" face.

| Item | Status | GitHub Issue |
|------|--------|-------------|
| Next.js app in `apps/web/` | ⬜ | |
| Marketing / landing page | ⬜ | |
| Pricing page with Stripe checkout integration | ⬜ | |
| Clerk-powered signup/login flow | ⬜ | |
| Subscriber dashboard — past newsletters, preferences | ⬜ | |
| Region/sector preference configuration | ⬜ | |
| Newsletter archive viewer (read past briefs in browser) | ⬜ | |
| Account management — billing, cancel, upgrade | ⬜ | |
| Mobile-responsive design | ⬜ | |
| SEO fundamentals — meta tags, OG images, sitemap | ⬜ | |

**Acceptance:** New subscriber can discover Vigil via search, view pricing, sign up, pay, configure preferences, and receive newsletters — all self-serve. Dashboard shows past briefs.

---

# Project Vigil — Phase 3.5: Analytical Voice + Probability Engine + Bug Fixes

**Status:** ⬜ Ready for implementation
**Dependencies:** Phase 2a ✅, Phase 2b ✅, Phase 3 ✅ (website live)
**Estimated size:** L (1-3 days across 2-3 Claude Code sessions)

---

## Context

Phase 2a (vetting refactor) and Phase 2b (vector corroboration + intelligence quality) are complete. The pipeline works end-to-end. However, three problems have emerged from real-world operation:

1. **Duplicate/stale content** — Tavily returns the same or similar articles across consecutive daily runs, producing newsletters that rehash yesterday's stories.
2. **Descriptive summaries** — The vetting prompt produces summaries that describe publications ("The Kansas City Star reports on local government") rather than extracting intelligence ("Mayor Lucas allocated $200M to BRT corridor expansion, Q3 2026 groundbreak").
3. **Weak analytical voice** — Assessments hedge, moralize, and describe rather than committing to probability-weighted judgments with actionable implications.

This phase addresses all three with a unified approach: fix the data quality bugs, overhaul every prompt in the system, and introduce a structured probability engine modeled on actual Intelligence Community analytic standards.

Read `CLAUDE.md` first for full project context.

---

## Task 1 — Bug Fixes: Freshness + Dedup

### 1a. Tavily Freshness Controls

**Problem:** Tavily's `max_age_days` is not being constrained, so daily collection runs surface the same articles from 5-7 days ago repeatedly.

**Fix:**
- Set `max_age_days: 2` as default for all scheduled `!collect` runs
- Set `max_age_days: 7` for `!scan` commands (ad-hoc deep dives need wider windows)
- Inject today's date into the query generation prompt so Gemini produces date-aware queries:
  ```
  Today is ${new Date().toISOString().split('T')[0]}.
  Generate search queries that will surface NEW developments from the last 48 hours.
  Do NOT generate queries about ongoing situations unless there is a new development.
  ```

**Files to modify:**
- `packages/agents/src/collector/pipeline.ts` — pass `max_age_days` to TavilyClient
- `packages/clients/src/tavily/client.ts` — add `maxAgeDays` to search options, pass to Tavily API `days` parameter
- `packages/agents/src/collector/config.ts` — add date injection to query generation prompt

### 1b. Cross-Run URL Deduplication

**Problem:** URL-level dedup only checks the current batch. Articles collected yesterday can appear again today if Tavily returns the same URL.

**Fix:**
- Before processing each Tavily result, query the database for any article with the same URL collected in the last 48 hours
- If found, skip silently (don't even send to Gemini — save the API call)
- Log skipped URLs at debug level for telemetry

**Files to modify:**
- `packages/agents/src/collector/pipeline.ts` — add pre-processing DB check
- The `VigilDB` interface needs a method: `hasRecentArticle(url: string, withinHours: number): Promise<boolean>`

### 1c. Staleness Detection in Aggregator

**Problem:** When no new articles exist for a sector, the aggregator rehashes previous days' stories, producing repetitive sections.

**Fix:**
- In the aggregator, after filtering articles for a section, check if ALL articles in the section are older than 18 hours from newsletter generation time
- If so, render a `NOMINAL` section instead:
  ```
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  NO NEW DEVELOPMENTS — [SECTOR] NOMINAL
  Monitoring continues. Last collection: [timestamp]
  ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
  ```
- Style: muted monospace, reduced opacity, no analyst assessment for NOMINAL sections
- A professional intelligence brief treats silence as more credible than repetition
- The cross-sector analyst assessment should note which sectors are nominal and why that itself may be significant

**Files to modify:**
- `packages/agents/src/aggregator/` — section builder logic
- Newsletter HTML template — NOMINAL rendering
- Discord embed formatter — NOMINAL variant

---

## Task 2 — Analytical Voice Overhaul

The north star voice is **Andrew Bustamante** (former CIA officer, Shawn Ryan Show appearances). The analytical framework encodes five principles that must be injected into every assessment prompt across the system.

### 2a. The Five Principles

These are NOT suggestions — they are mandatory constraints injected as a system prompt block into every Gemini call that produces analyst output.

```typescript
export const ANALYST_VOICE_DIRECTIVE = `
You are a senior intelligence analyst producing a classified-style briefing.
Your analytical voice follows these five mandatory principles:

1. INCENTIVE FRAMEWORK
   Never frame geopolitical actors as good or evil, moral or immoral.
   Always analyze through incentive structures:
   - "Actor X is doing Y because it serves interests A and B"
   - "This behavior is rational given their constraints: [list constraints]"
   This makes intelligence extrapolatable — if we know the incentives,
   we can model likely behavior when those incentives shift.

2. COMMITTED ASSESSMENTS
   Never hedge with "maybe," "it seems," "could potentially," or "remains to be seen."
   Commit to a probability-weighted assessment using IC-standard language:
   - "Most likely course of action: X"
   - "Assess with HIGH confidence that Y"
   - "Watch for Z as confirmation or contradiction"
   If uncertain, quantify the uncertainty — don't hide behind vague language.

3. PATTERN OVER EVENT
   Do not simply report what happened. Analyze what pattern it is part of:
   - "This is the Nth instance of X in [timeframe] — the pattern indicates Y"
   - "This fits an established playbook: [describe playbook]"
   - "Break from pattern: this deviates from prior behavior, suggesting Z"
   Single events are noise. Patterns are intelligence.

4. ALWAYS OPERATIONAL
   Every assessment must end with something the reader can act on:
   - "Decision-makers should monitor [specific indicator]"
   - "Watch for [specific event] as confirmation or contradiction"
   - "Stakeholders in [sector] should prepare for [specific scenario]"
   If there is nothing operational, state: "No immediate action required. Continue monitoring."

5. DOT CONNECTING
   Explicitly connect across scales where relevant:
   - Local → National: "The KC transit decision matters nationally because..."
   - National → Local: "Federal rate decisions will reach KC homeowners via..."
   - Geopolitical → Domestic: "This trade shift will hit midwest manufacturing through..."
   Intelligence value comes from connections the reader cannot make alone.
`;
```

### 2b. Prohibited Phrases

Add to every Gemini prompt that produces text output (summaries, assessments, actionable intel):

```typescript
export const PROHIBITED_PHRASES = `
NEVER use any of the following phrases or patterns:
- "It is worth noting that..."
- "This article discusses..."
- "According to reports..."
- "It remains to be seen..."
- "In conclusion..."
- "This website covers..."
- "The publication reports..."
- "This is a significant development..."
- "Time will tell..."
- "Only time will tell..."
- Any passive, hedging, or descriptive language about the source rather than the intelligence
- Any moral framing of geopolitical actors (no "aggressive," "threatening," "rogue," "destabilizing")
- Any meta-commentary about the article itself rather than the events it describes

Instead:
- Extract facts, names, numbers, dates, locations
- State assessments with committed probability language
- Analyze through incentive structures, not moral frameworks
- Every sentence must contain intelligence value — cut anything that doesn't
`;
```

### 2c. Prompt Injection Points

The voice directive and prohibited phrases must be injected into these specific prompts:

| Prompt Location | File | What It Produces |
|----------------|------|-----------------|
| Article vetting/summarization | `packages/agents/src/collector/pipeline.ts` or `vetting.ts` | `summary` + `actionableIntel` fields |
| Section analyst assessment | `packages/agents/src/aggregator/` | Per-section analyst assessment block |
| Cross-sector analysis | `packages/agents/src/aggregator/` | Cross-sector synthesis at bottom of newsletter |
| `!scan` deep dive | `packages/agents/src/collector/pipeline.ts` | Ad-hoc topic analysis |

**Implementation:** Create `packages/shared/src/prompts/analyst-voice.ts` that exports `ANALYST_VOICE_DIRECTIVE` and `PROHIBITED_PHRASES` as constants. Import and prepend to every analyst-facing Gemini call's system prompt.

### 2d. Summary Prompt Fix

The current vetting prompt allows Gemini to describe publications rather than extracting intelligence. The summary field instruction must be explicit:

```
SUMMARY: Extract the specific facts, events, decisions, numbers, dates,
and named actors from this article. Never describe what the article or
publication is about. Never describe the source.

BAD: "The Kansas City Star reports on local government activities and
municipal budget decisions in the metro area."

GOOD: "Kansas City Council approved $200M BRT corridor expansion.
Groundbreak Q3 2026, service target 2028. Route: Troost Ave from
downtown to 85th St. Federal match: $120M from FTA Capital program.
Mayor Lucas cited 40% ridership increase on existing MAX line."

Every sentence must contain a specific fact. If the article contains
no extractable facts, return summary: "NO EXTRACTABLE INTELLIGENCE"
and the pipeline will skip it.
```

---

## Task 3 — Probability Engine

### 3a. ICD 203 Probability Language Table

The US Intelligence Community Directive 203 defines seven standard probability terms with numerical ranges. This is the actual IC standard, not an approximation.

Create `packages/shared/src/probability.ts`:

```typescript
/**
 * ICD 203 Analytic Standards — Probability Language
 *
 * Source: Intelligence Community Directive 203 (DNI, revised January 2015)
 * Reference: PMC6469752 (Wintle et al. 2019) Table 1 — confirmed ranges
 *
 * These terms are injected into every analyst assessment prompt to ensure
 * consistent, auditable probability language across all Vigil output.
 */

export interface ProbabilityTerm {
  primary: string;          // Primary term
  alternate: string;        // Alternate phrasing (IC-standard synonym)
  rangeMin: number;         // Lower bound (inclusive), 0-100
  rangeMax: number;         // Upper bound (inclusive), 0-100
  usage: string;            // When to use this term
}

export const IC_PROBABILITY_TABLE: ProbabilityTerm[] = [
  {
    primary: 'Almost no chance',
    alternate: 'Remote',
    rangeMin: 1,
    rangeMax: 5,
    usage: 'Event would require multiple independent failures or unprecedented reversal of established trends',
  },
  {
    primary: 'Very unlikely',
    alternate: 'Highly improbable',
    rangeMin: 5,
    rangeMax: 20,
    usage: 'Event conflicts with established patterns and most available evidence, but cannot be ruled out',
  },
  {
    primary: 'Unlikely',
    alternate: 'Improbable',
    rangeMin: 20,
    rangeMax: 45,
    usage: 'Evidence weighs against this outcome, but significant uncertainty remains',
  },
  {
    primary: 'Roughly even chance',
    alternate: 'Roughly even odds',
    rangeMin: 45,
    rangeMax: 55,
    usage: 'Available evidence does not favor either outcome; genuinely uncertain',
  },
  {
    primary: 'Likely',
    alternate: 'Probable',
    rangeMin: 55,
    rangeMax: 80,
    usage: 'Evidence and established patterns favor this outcome, though alternatives remain plausible',
  },
  {
    primary: 'Very likely',
    alternate: 'Highly probable',
    rangeMin: 80,
    rangeMax: 95,
    usage: 'Strong evidence and multiple indicators support this outcome; would require significant new information to change assessment',
  },
  {
    primary: 'Almost certainly',
    alternate: 'Nearly certain',
    rangeMin: 95,
    rangeMax: 99,
    usage: 'All available evidence and established patterns support this outcome; only a major unforeseen development would alter assessment',
  },
];

/**
 * Given a numeric probability (0-100), return the matching IC term.
 */
export function probabilityToTerm(probability: number): ProbabilityTerm {
  const clamped = Math.max(1, Math.min(99, probability));
  const match = IC_PROBABILITY_TABLE.find(
    t => clamped >= t.rangeMin && clamped <= t.rangeMax
  );
  // Should never happen with clamped input, but fallback to "roughly even chance"
  return match ?? IC_PROBABILITY_TABLE[3];
}

/**
 * Format the probability table as a string block for prompt injection.
 */
export function formatProbabilityTableForPrompt(): string {
  const header = 'USE THESE IC-STANDARD PROBABILITY TERMS (ICD 203):\n';
  const rows = IC_PROBABILITY_TABLE.map(
    t => `  "${t.primary}" (or "${t.alternate}"): ${t.rangeMin}-${t.rangeMax}% — ${t.usage}`
  ).join('\n');
  const footer = '\n\nNEVER use non-standard probability language. ' +
    'NEVER say "maybe," "perhaps," "could potentially," "might," or "remains to be seen." ' +
    'Always commit to one of the seven terms above with explicit reasoning.';
  return header + rows + footer;
}
```

### 3b. Confidence Levels

Separate from probability (likelihood of an outcome), confidence reflects the quality and quantity of evidence supporting the assessment.

Add to `packages/shared/src/probability.ts`:

```typescript
export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW';

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  reasoning: string;
}

/**
 * Derive confidence level from existing trust/corroboration data.
 * This is deterministic — no LLM needed.
 */
export function deriveConfidence(
  trustScore: number,
  isCorroborated: boolean,
  outletKnown: boolean
): ConfidenceLevel {
  if (trustScore > 0.7 && isCorroborated) return 'HIGH';
  if (trustScore < 0.4 || (!isCorroborated && !outletKnown)) return 'LOW';
  return 'MODERATE';
}

/**
 * Format confidence level with explanation for newsletter rendering.
 */
export function formatConfidenceExplanation(
  level: ConfidenceLevel,
  trustScore: number,
  isCorroborated: boolean,
  sourceCount: number
): string {
  switch (level) {
    case 'HIGH':
      return `HIGH CONFIDENCE — ${sourceCount} corroborating sources, trust score ${(trustScore * 100).toFixed(0)}%`;
    case 'MODERATE':
      return `MODERATE CONFIDENCE — ${isCorroborated ? 'corroborated' : 'single source'}, trust score ${(trustScore * 100).toFixed(0)}%`;
    case 'LOW':
      return `LOW CONFIDENCE — ${isCorroborated ? '' : 'unverified, '}trust score ${(trustScore * 100).toFixed(0)}%`;
  }
}

/**
 * Format the confidence framework as a string block for prompt injection.
 */
export function formatConfidenceFrameworkForPrompt(): string {
  return `
CONFIDENCE LEVELS (assign one to every assessment):
  HIGH — Multiple corroborating sources from reliable outlets. Trust score > 70%.
         Use when: evidence is strong and cross-verified.
  MODERATE — Single credible source, or partially corroborated. Trust 40-70%.
             Use when: evidence is plausible but not fully verified.
  LOW — Unverified, single source, or unknown outlet. Trust < 40%.
        Use when: reporting but cannot validate. Always flag what would raise confidence.

IMPORTANT: Confidence is about EVIDENCE QUALITY, not about how certain you are.
A HIGH confidence + "unlikely" assessment is valid:
"We assess with HIGH CONFIDENCE that a rate cut is UNLIKELY (20-45%) this quarter."
This means: we have strong evidence, and that evidence points to no cut.
`;
}
```

### 3c. Assessment Structure Type

Create `packages/shared/src/types/assessment.ts`:

```typescript
import { ConfidenceLevel } from '../probability';

/**
 * Structured analyst assessment following IC analytic tradecraft standards.
 * Every section assessment and cross-sector analysis must follow this structure.
 */
export interface StructuredAssessment {
  /** What happened — facts only, no editorializing. Named actors, numbers, dates. */
  situation: string;

  /** What it means — committed, probability-weighted using IC language.
   *  Must use ICD 203 terms. Must analyze through incentive framework. */
  assessment: string;

  /** Evidence quality — HIGH/MODERATE/LOW with explicit reasoning. */
  confidence: ConfidenceLevel;
  confidenceReasoning: string;

  /** What it means for the reader operationally.
   *  Must contain specific actions, indicators to watch, or preparations to make. */
  implications: string;

  /** What to monitor as confirmation or contradiction of the assessment.
   *  Specific, observable indicators — not vague "watch this space" language. */
  watchList: string[];
}

/**
 * Zod schema for validating Gemini's structured assessment output.
 * Use with completeJSON() to ensure the model returns all required fields.
 */
export const StructuredAssessmentSchema = z.object({
  situation: z.string().min(50, 'Situation must contain specific facts'),
  assessment: z.string().min(50, 'Assessment must be substantive'),
  confidence: z.enum(['HIGH', 'MODERATE', 'LOW']),
  confidenceReasoning: z.string().min(20),
  implications: z.string().min(30),
  watchList: z.array(z.string()).min(1).max(5),
});
```

### 3d. Prompt Assembly

Create `packages/shared/src/prompts/assessment-prompt.ts` that assembles the full analyst prompt from components:

```typescript
import { ANALYST_VOICE_DIRECTIVE, PROHIBITED_PHRASES } from './analyst-voice';
import { formatProbabilityTableForPrompt, formatConfidenceFrameworkForPrompt } from '../probability';

/**
 * Assemble the full analyst system prompt.
 * Injected into every Gemini call that produces analyst assessment output.
 */
export function buildAnalystSystemPrompt(): string {
  return [
    ANALYST_VOICE_DIRECTIVE,
    formatProbabilityTableForPrompt(),
    formatConfidenceFrameworkForPrompt(),
    PROHIBITED_PHRASES,
    `
OUTPUT STRUCTURE — every assessment must follow this exact structure:

SITUATION: [Facts only. Named actors, numbers, dates, locations. No editorializing.]

ASSESSMENT: [Committed, probability-weighted analysis using IC-standard terms.
Analyze through incentive frameworks. Identify patterns, not just events.
Connect across scales (local ↔ national ↔ global) where relevant.]

CONFIDENCE: [HIGH/MODERATE/LOW] — [Explicit reasoning citing source count, corroboration, outlet reliability]

IMPLICATIONS: [What should the reader do, prepare for, or watch.
Must be specific and operational. "Monitor the situation" is NOT acceptable.]

WATCH LIST:
- [Specific observable indicator #1 that would confirm or contradict this assessment]
- [Specific observable indicator #2]
- [Specific observable indicator #3]
`,
  ].join('\n\n---\n\n');
}

/**
 * Assemble the article vetting system prompt.
 * Used for the unified vetting call that produces summary + actionableIntel.
 */
export function buildVettingSystemPrompt(): string {
  return [
    `You are an intelligence analyst extracting actionable intelligence from open sources.`,
    PROHIBITED_PHRASES,
    `
SUMMARY EXTRACTION RULES:
- Extract specific facts, events, decisions, numbers, dates, and named actors
- NEVER describe what the article or publication is about
- NEVER describe the source itself
- Every sentence must contain a specific, verifiable fact
- If the article contains no extractable facts, return summary: "NO EXTRACTABLE INTELLIGENCE"

BAD: "The Kansas City Star reports on local government activities and budget decisions."
GOOD: "Kansas City Council approved $200M BRT corridor expansion. Groundbreak Q3 2026,
service target 2028. Route: Troost Ave downtown to 85th St. Federal match: $120M FTA."

ACTIONABLE INTEL RULES:
- State what the reader should DO, PREPARE FOR, or MONITOR
- Reference specific timelines, locations, dollar amounts, deadlines
- Connect to the reader's operational context (their neighborhood, their taxes, their industry)
- "This may impact the community" is NOT acceptable
`,
  ].join('\n\n');
}
```

### 3e. Deterministic Injection

The probability table, confidence framework, and voice directive are **static text blocks** injected into prompts — not dynamic LLM-generated content. This makes them:
- **Consistent** — every assessment uses the same probability language
- **Auditable** — subscribers can see exactly how assessments are calibrated
- **Cheap** — no extra API calls, just prompt context

---

## Task 4 — Template Updates

### 4a. NOMINAL Section Rendering

Add to the newsletter HTML template:

```html
<!-- NOMINAL section — no new developments -->
<tr>
  <td style="padding:24px 40px;background:#0d0d0d;border-left:3px solid #333;">
    <p style="margin:0;font-family:monospace;font-size:13px;color:#555;letter-spacing:2px;">
      ▬▬▬ NO NEW DEVELOPMENTS — [SECTOR] NOMINAL ▬▬▬
    </p>
    <p style="margin:8px 0 0;font-family:monospace;font-size:11px;color:#444;">
      Monitoring continues. Last collection: [timestamp]. Next sweep: [time].
    </p>
  </td>
</tr>
```

No analyst assessment for NOMINAL sections. The cross-sector analyst SHOULD note which sectors are nominal and whether that absence is itself significant.

### 4b. Structured Assessment Rendering

Replace the current free-text analyst assessment blocks with structured rendering:

```html
<!-- Structured Assessment -->
<div style="background:#0d0d0d;border-left:3px solid [section-color];padding:16px 20px;">
  <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:monospace;letter-spacing:2px;">SITUATION</p>
  <p style="margin:0 0 12px;font-size:13px;color:#ccc;line-height:1.6;">[situation text]</p>

  <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:monospace;letter-spacing:2px;">ASSESSMENT</p>
  <p style="margin:0 0 12px;font-size:13px;color:#e8e8e8;line-height:1.6;">[assessment text]</p>

  <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:monospace;letter-spacing:2px;">CONFIDENCE</p>
  <p style="margin:0 0 12px;font-size:13px;color:[confidence-color];line-height:1.6;font-family:monospace;">
    [HIGH/MODERATE/LOW] — [reasoning]
  </p>

  <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:monospace;letter-spacing:2px;">IMPLICATIONS</p>
  <p style="margin:0 0 12px;font-size:13px;color:#c9a227;line-height:1.6;">[implications text]</p>

  <p style="margin:0 0 4px;font-size:10px;color:#666;font-family:monospace;letter-spacing:2px;">WATCH LIST</p>
  <p style="margin:0;font-size:12px;color:#aaa;line-height:1.8;font-family:monospace;">
    ▸ [indicator 1]<br>
    ▸ [indicator 2]<br>
    ▸ [indicator 3]
  </p>
</div>
```

Confidence color: HIGH = `#22c55e`, MODERATE = `#eab308`, LOW = `#ef4444`.

### 4c. Newsletter Stats Update

Update the source reliability summary section at the bottom of the newsletter to include confidence distribution:

```
📊 SOURCE RELIABILITY SUMMARY
Articles analyzed:        22
Corroboration rate:       45%
Avg trust rating:         68%
Avg bias:                 L ────▼──── R · Center-Left

📊 CONFIDENCE DISTRIBUTION
HIGH:      5 assessments (41%)
MODERATE:  6 assessments (50%)
LOW:       1 assessment  (8%)
NOMINAL:   1 sector (Local)
```

### 4d. Discord Embed Updates

Update `packages/discord/src/embeds/intel-card.ts`:
- Add confidence level badge (GREEN/YELLOW/RED) alongside existing trust + bias indicators
- For NOMINAL sectors, send a single muted embed: "📊 [SECTOR] — NOMINAL. No new developments. Monitoring continues."

---

## File Summary

### New Files
| File | Purpose |
|------|---------|
| `packages/shared/src/probability.ts` | IC probability table, confidence levels, format helpers |
| `packages/shared/src/types/assessment.ts` | `StructuredAssessment` type + Zod schema |
| `packages/shared/src/prompts/analyst-voice.ts` | Voice directive + prohibited phrases constants |
| `packages/shared/src/prompts/assessment-prompt.ts` | Prompt assembly functions |
| `packages/shared/src/__tests__/probability.test.ts` | Probability + confidence tests |

### Modified Files
| File | Changes |
|------|---------|
| `packages/clients/src/tavily/client.ts` | Add `maxAgeDays` parameter |
| `packages/agents/src/collector/pipeline.ts` | Date injection in query prompt, 48hr URL dedup, freshness controls |
| `packages/agents/src/collector/vetting.ts` | New vetting system prompt with voice + prohibited phrases |
| `packages/agents/src/aggregator/` | Staleness detection, NOMINAL sections, structured assessment output |
| Newsletter HTML template | NOMINAL rendering, structured assessment blocks, confidence colors, updated stats |
| `packages/discord/src/embeds/intel-card.ts` | Confidence badge, NOMINAL embed variant |
| `packages/discord/src/embeds/newsletter.ts` | Confidence distribution in digest embed |
| `packages/shared/src/index.ts` | Re-export new modules |

---

## Acceptance Criteria

1. **Zero duplicate articles across consecutive runs:** Run `!collect` for the same region twice, 6+ hours apart. Zero URL overlap. Verify with DB query: `SELECT url, COUNT(*) FROM Article WHERE collectedAt > [24h ago] GROUP BY url HAVING COUNT(*) > 1` returns empty.

2. **All summaries contain specific facts:** Run a collection. Every article summary must contain at least one of: a proper noun (person/org/place), a number (dollar amount, percentage, count), or a date. No summary should contain phrases from the prohibited list. Verify by grep against PROHIBITED_PHRASES patterns.

3. **NOMINAL section renders correctly:** Delete all articles for one region, then run `!digest`. That section should render as NOMINAL with muted styling. The cross-sector assessment should note the nominal sector.

4. **Structured assessments in every section:** Each non-NOMINAL section assessment contains all five fields: SITUATION, ASSESSMENT, CONFIDENCE, IMPLICATIONS, WATCH LIST. No field is empty.

5. **IC probability language used consistently:** Every assessment uses at least one term from the ICD 203 table. No assessment contains prohibited hedging language ("maybe," "it seems," "remains to be seen," "could potentially").

6. **Confidence distribution in newsletter stats:** Bottom stats section shows HIGH/MODERATE/LOW/NOMINAL counts.

7. **Incentive-framework analysis:** At least one geopolitical assessment analyzes actor behavior through incentive structures rather than moral framing. No assessment uses "aggressive," "threatening," "rogue," or "destabilizing" to describe state actors.

---

## Out of Scope

- AWS deployment changes (Phase 2c)
- Monetization / Stripe / Clerk (Phase 2.5)
- Source Vetting Agent (Phase 4)
- Changes to the scheduling system
- Changes to the vector corroboration logic (Phase 2b is complete)
- New Discord commands (no new `!` commands in this phase)

---

## Report Back With

1. File tree diff (new + modified files)
2. `npm test` output with test count
3. Sample newsletter output showing: one NOMINAL section, one structured assessment with all five fields, confidence distribution in stats
4. Grep results showing zero prohibited phrases in a sample collection run's summaries
5. Before/after comparison: same article processed with old prompt vs. new prompt
6. Any concerns about prompt token budget — the voice directive + probability table + confidence framework adds ~800 tokens to every analyst call. Verify this stays within Gemini's context window with room for article content.

### Phase 4 — Growth ⬜

**Goal:** Scale subscriber base, expand intelligence coverage, add premium features.

| Item | Status | GitHub Issue |
|------|--------|-------------|
| SEO content strategy — blog posts about OSINT, geopolitics | ⬜ | |
| Referral program (give a month, get a month) | ⬜ | |
| Locale expansion — additional regional agents | ⬜ | |
| Regional Pro tier — pay for specific region deep-dives | ⬜ | |
| API access tier — programmatic intel for developers | ⬜ | |
| Weekly trend report (in addition to daily digest) | ⬜ | |
| **Source Vetting Agent** — multi-dimensional outlet auditing | ⬜ | |
| Outlet drift detection — flag outlets whose output deviates from anchor | ⬜ | |
| Prediction track record scoring — did the outlet's forward claims pan out? | ⬜ | |
| Independence scoring — original reporting vs. wire syndication | ⬜ | |
| Enhanced bias calibration — anchor embeddings from known ideological texts | ⬜ | |
| Chessboard inference — cross-sector pattern detection | ⬜ | |
| Predictive signals — "this pattern preceded X last time" | ⬜ | |
| Multi-language source support | ⬜ | |

**Acceptance:** Subscriber growth trajectory. Multiple regional agents operational. API tier generating revenue.

---

### Phase 5 — Scale (Milestone-Triggered) ⬜

**Trigger:** 500 paying subscribers OR $2K MRR — whichever comes first.

**Goal:** Infrastructure and organizational scaling. This phase is NOT started until the trigger is hit.

| Item | Status | GitHub Issue |
|------|--------|-------------|
| Define trigger criteria precisely | ⬜ | 500 subscribers OR $2K MRR |
| Hire first contractor (content QA or ML engineer) | ⬜ | |
| Scale infrastructure — multi-region, higher throughput | ⬜ | |
| Enterprise tier — white-label, custom regions, SLA | ⬜ | |
| Dedicated vector DB (Pinecone paid tier) | ⬜ | |
| Advanced personalization — user context profiles | ⬜ | |
| Compliance — privacy policy, terms of service, GDPR | ⬜ | |
| Financial modeling — unit economics, CAC/LTV | ⬜ | |

**Acceptance:** Sustainable business with clear unit economics. Infrastructure handles 10x current load. At least one enterprise customer.

---

## Data Model

### Article
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| url | string | Unique |
| hash | string | Unique — sha256(normalize(title+rawContent)) |
| title | string | |
| summary | string | AI-generated |
| rawContent | string? | Full fetched body, null if fetch failed |
| actionableIntel | string? | "So what" — what should the reader do (Phase 2b) |
| outletId | FK → Outlet | |
| biasScore | float | -1.0 (left) to 1.0 (right) |
| trustRating | float | 0.0-1.0, derived from outlet reliability + bias + corroboration |
| vettingFlag | string? | 'BIAS' \| 'UNVERIFIED' \| 'DUPLICATE' \| 'LOW_TRUST' \| 'UNKNOWN_OUTLET' (Phase 2a) |
| autoApproved | boolean | Default true; false if manually flagged (Phase 2a) |
| region | string | "local" \| "usa" \| "geopolitical" |
| sectorTags | string | JSON-encoded string[] |
| corroboratedById | FK → Article? | Nullable self-reference |
| embeddingId | string? | ChromaDB/Pinecone pointer (Phase 2b) |
| publishedAt | datetime | |
| collectedAt | datetime | Auto-set |

### Outlet
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| canonicalName | string | Unique — "Reuters", "KC Star" |
| aliases | string | JSON-encoded string[] of variant names |
| biasAnchor | float | -1.0 to 1.0, baseline from AllSides/Ad Fontes |
| reliabilityBase | float | 0.0-1.0, baseline trust |
| region | string? | Primary region, nullable for global outlets |
| createdAt | datetime | |
| updatedAt | datetime | |

### Subscriber (Phase 2.5)
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| email | string | Unique |
| clerkUserId | string? | Clerk user reference |
| stripeCustomerId | string? | Stripe customer reference |
| tier | string | "free" \| "pro" \| "enterprise" |
| active | boolean | Default true; false on cancel |
| preferences | string? | JSON — region preferences, sector filters |
| createdAt | datetime | |
| updatedAt | datetime | |

---

## Vetting & Trust Model

### Unified Vetting Flow (Phase 2a)

```
Article collected
  → Single Gemini completeJSON() call
    → Returns: summary, actionableIntel, biasScore, sectorTags, outletName
  → TypeScript post-processing:
    → Resolve outlet (known/unknown)
    → Compute trustScore from outlet reliability + bias + corroboration
    → Check corroboration (vector similarity in Phase 2b, title match in Phase 2a)
    → Derive autoApprove flag
    → Derive vettingFlag annotation
  → Store article with all fields
  → If autoApprove: flows to newsletter automatically
  → If flagged: flows to newsletter with annotation styling
  → If --review mode: flagged articles held for Discord approval
```

### Auto-Approve Rules
```typescript
const autoApprove =
  result.trustScore > 0.6 &&
  Math.abs(result.biasScore) < 0.5 &&
  result.isCorroborated &&
  result.outletKnown;
```

### Flag Derivation
| Flag | Condition |
|------|-----------|
| `BIAS` | `\|biasScore\| > 0.5` |
| `UNVERIFIED` | `!isCorroborated` |
| `LOW_TRUST` | `trustScore < 0.4` |
| `UNKNOWN_OUTLET` | `!outletKnown` |
| `DUPLICATE` | Hash or vector match to existing article from same outlet |

Flags annotate, they don't block. Multiple flags possible — store the highest-priority one (BIAS > LOW_TRUST > UNKNOWN_OUTLET > UNVERIFIED > DUPLICATE).

### Trust Rating Formula
```
trustRating = clamp(
  outletReliability
  - |biasScore| × 0.3
  - (corroboratingSourceCount === 0 ? 0.2 : 0),
  0, 1
)
```

### Newsletter Rendering of Flagged Articles
- Muted styling (lower opacity, subtle border change)
- Caveat line: "⚠️ Single-source report — awaiting corroboration" or "⚠️ Bias indicator: this source leans [direction] on this topic"
- Trust score shows derivation: "Trust: 56% (outlet: 78%, bias: -7%, single-source: -20%)"

---

## Tavily Budget Strategy

| Parameter | Value |
|-----------|-------|
| Monthly hard limit | 1000 searches |
| Daily soft limit | 33 searches |
| Scheduled usage | 3 sectors × 3 runs × 3 searches = 27/day |
| Ad-hoc reserve | ~6 searches/day for `!scan` commands |
| Monthly projected | ~810 scheduled + ~180 ad-hoc = ~990 |
| Alert thresholds | 80% (800), 95% (950) |

Budget persists to `data/tavily-budget.json`. Daily resets at midnight CT. Monthly resets on the 1st.

---

## Collection Schedule

| Time (CT) | Event | Type | Sectors |
|-----------|-------|------|---------|
| 05:00 | Morning Sweep | Full collection | All 3 |
| 06:00 | Newsletter Dispatch | Aggregate + email | All 3 |
| 12:00 | Midday Flash | Breaking-only scan | All 3 |
| 18:00 | Evening Sweep | Full collection | All 3 |

---

## Discord Command Reference

### Region Channels (#vigil-local, #vigil-usa, #vigil-geopolitical)
| Command | Description | Handler |
|---------|-------------|---------|
| `!collect` | Trigger immediate collection (auto-approve) | `CollectHandler(region)` |
| `!collect --review` | Collect with manual approval for flagged items | `CollectHandler(region, { review: true })` |
| `!scan <topic>` | Deep dive on a specific topic | `ScanHandler(region, topic)` |
| `!status` | Last run time, article count, next run | `StatusHandler(region)` |
| `!sources` | List outlets + bias scores for this region | `SourcesHandler(region)` |
| `!review <id>` | Pull up article for bias review | `ReviewHandler(articleId)` |
| `!flag <id>` | Manually flag article as suspect | `FlagHandler(articleId)` |

### General Channel (#vigil-general)
| Command | Description | Handler |
|---------|-------------|---------|
| `!digest` | Force-generate newsletter (auto-approve) | `DigestHandler()` |
| `!digest --review` | Generate with manual approval for flagged items | `DigestHandler({ review: true })` |
| `!flash` | Show pending flash alerts | `FlashHandler()` |
| `!briefing` | Full operational status, all regions | `BriefingHandler()` |
| `!schedule` | Show collection schedule + next runs | `StatusHandler(all)` |

---

## GitHub Project Board Structure

### Board: Project Vigil

**Columns:**
- Backlog
- Ready (spec'd, can be picked up)
- In Progress
- Review (PR open or testing)
- Done

**Labels:**
- `phase:1` through `phase:5`
- `type:infrastructure` — repo, CI, deploy, AWS
- `type:schema` — Prisma model changes
- `type:client` — AI/search client wrappers
- `type:agent` — collector/aggregator logic
- `type:discord` — bot commands, embeds
- `type:email` — newsletter, SES
- `type:web` — Next.js frontend
- `type:monetization` — Stripe, Clerk, subscriber management
- `type:observability` — telemetry, logging, monitoring
- `type:intelligence` — vector DB, corroboration, analysis quality
- `type:docs` — CLAUDE.md, README, specs
- `type:tech-debt` — cleanup, refactors, known issues
- `priority:critical` — blocks other work
- `priority:high` — important but not blocking
- `priority:normal` — standard
- `size:S` — < 2 hours
- `size:M` — 2-8 hours
- `size:L` — 1-3 days
- `size:XL` — 3+ days, consider splitting

**Milestones:**
- `M1: Core Pipeline` ✅ — Collection + newsletter end-to-end
- `M2: Autonomous Ops` — Scheduled runs, 48hr unattended, auto-approve
- `M3: First Revenue` — 10 paying subscribers via Stripe link
- `M4: Web Launch` — Self-serve signup, subscriber dashboard
- `M5: Growth Engine` — SEO, referrals, regional expansion
- `M6: Scale Trigger` — 500 subscribers or $2K MRR → next stage

---

## Development Workflow

### Claude Code Session Protocol
1. Read `CLAUDE.md` first — always
2. Each session targets ONE phase item (or sub-item)
3. Prompt includes: context, task scope, acceptance criteria, out-of-scope list
4. Session ends with: tree diff, test output, concerns for next phase
5. Update `CLAUDE.md` phase status after each session

### Branch Strategy
- `main` — stable, all tests pass
- `phase/2a-vetting` — feature branch per phase item
- PR required for merge to main (CI must pass)
- Squash merge preferred

### Testing Philosophy
- Unit tests for all shared utilities (bias, hash, outlets, budget, vetting)
- Integration tests for client wrappers (mocked external APIs)
- End-to-end tests for collection pipeline (mocked APIs, real DB)
- No tests that require real API keys or network calls
- Test budget: aim for 80%+ coverage on `packages/shared` and `packages/clients`