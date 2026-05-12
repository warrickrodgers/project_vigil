# Project Vigil

OSINT research agent network — collects, corroborates, and dispatches a curated intelligence newsletter across Local (KC metro), USA, and Geopolitical sectors.

**Alpha build**: Local Docker Postgres + local agents. Production target: AWS Lambda + EventBridge + SES.

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|-------------|
| Node.js | 20+ | Everything |
| npm | 10+ | Package management |
| Docker | any | Local Postgres (required) + ChromaDB (optional) |
| Python + `chromadb` | 3.9+ | ChromaDB (alternative to Docker for vector store only) |
| Discord app + bot token | — | Bot commands |
| Gemini API key | — | AI collection + aggregation |
| Tavily API key | — | Web search |

---

## Environment Setup

```bash
cp .env.example .env
```

Edit `.env`. What's required depends on which component you're running:

| Variable | Bot | Web | Lambda | Notes |
|----------|-----|-----|--------|-------|
| `DATABASE_URL` | ✓ | ✓ | ✓ | Prod Postgres URL (Prisma CLI uses `packages/db/.env` for local) |
| `DEV_DATABASE_URL` | ✓ | ✓ | — | Local Postgres: `postgresql://postgres:postgres@localhost:5432/vigil_dev` |
| `GEMINI_API_KEY` | ✓ | — | ✓ | Required for collection + aggregation |
| `TAVILY_API_KEY` | ✓ | — | ✓ | Required for web search |
| `DISCORD_TOKEN` | ✓ | — | — | Bot token from Discord Developer Portal |
| `DISCORD_ADMIN_USER_ID` | ✓ | — | — | Your Discord user ID |
| `DISCORD_GENERAL_CHANNEL_ID` | ✓ | — | — | `#vigil-general` channel ID |
| `DISCORD_LOCAL_CHANNEL_ID` | ✓ | — | — | `#vigil-local` channel ID |
| `DISCORD_USA_CHANNEL_ID` | ✓ | — | — | `#vigil-usa` channel ID |
| `DISCORD_GEO_CHANNEL_ID` | ✓ | — | — | `#vigil-geopolitical` channel ID |
| `CHROMA_URL` | opt | — | — | Default: `http://localhost:8000` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | — | ✓ | — | Clerk auth (web app) |
| `CLERK_SECRET_KEY` | — | ✓ | — | Clerk auth (web app) |

For the web app, also copy:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

---

## Install & Database

Docker is required for local Postgres (used by Prisma CLI for migrations and `db:studio`). The runtime switches to `DEV_DATABASE_URL` when `NODE_ENV=development`.

```bash
npm install
npm run db:up          # start local Postgres container (Docker required)
npm run db:migrate     # run migrations against local Postgres
npm run db:seed        # inserts example articles + outlets
npm run db:studio      # inspect data at localhost:5555 (optional)
```

To stop the database: `npm run db:down`.

---

## Running the Discord Bot

```bash
npm run bot:dev
```

The bot registers all command handlers and prints startup status to the console. On successful connection you'll see a startup message posted to `#vigil-general`.

**Bot commands by channel:**

| Channel | Commands |
|---------|----------|
| `#vigil-general` | `!digest`, `!flash`, `!briefing`, `!schedule`, `!help` |
| `#vigil-local` | `!collect`, `!scan <topic>`, `!status`, `!sources`, `!review <id>`, `!flag <id>` |
| `#vigil-usa` | same as local |
| `#vigil-geopolitical` | same as local |

All commands require the `DISCORD_ADMIN_USER_ID` account. The bot ignores messages from other users.

---

## Running the Web App

```bash
npm run web:dev
```

Opens at `http://localhost:3000`. Requires Clerk keys in `apps/web/.env.local`. Stripe keys are optional (commented out in the example).

---

## ChromaDB — Semantic Corroboration (Optional)

Without ChromaDB, collection still works but all articles are flagged `UNVERIFIED` (no cross-outlet corroboration). To enable:

**Docker (recommended):**

```bash
docker run -d -p 8000:8000 --name vigil-chroma chromadb/chroma:latest
```

**Python alternative:**

```bash
pip install chromadb
chroma run --path ./data/chroma
```

Set `CHROMA_URL=http://localhost:8000` in `.env` (this is the default). The bot logs `ChromaDB connected — semantic corroboration active` on startup when reachable.

---

## Test Suite

```bash
npm test               # run all tests (vitest)
npm run typecheck      # tsc --noEmit across all packages
npm run lint           # eslint packages/**/*.ts
```

All 189 tests should pass. Tests are co-located with their packages:

- `packages/shared/src/__tests__/` — probability engine, IC confidence tables
- `packages/agents/src/__tests__/` — collector pipeline, aggregator digest

---

## End-to-End Validation Sequence

After setup, validate the full pipeline in this order:

### 1. Baseline — confirm empty state

In `#vigil-general`:
```
!briefing
```
Expected: "OPERATIONAL BRIEFING" message showing 0 articles.

### 2. Collect — run the intel pipeline

In `#vigil-local`:
```
!collect
```
Expected: one or more article embeds posted to `#vigil-local`, each showing title, summary, bias score, trust rating, and a confidence badge (🟢 HIGH / 🟡 MODERATE / 🔴 LOW). The console logs Gemini + Tavily call counts.

To run all three sectors:
```
!collect    (in #vigil-local)
!collect    (in #vigil-usa)
!collect    (in #vigil-geopolitical)
```

### 3. Digest — generate the newsletter

In `#vigil-general`:
```
!digest
```

Expected output:
- **With articles**: newsletter embeds posted with structured assessment blocks per section:
  - `SITUATION` — one sentence, specific facts
  - `ASSESSMENT` — committed analytical judgment with ICD 203 probability language
  - `CONFIDENCE` — HIGH / MODERATE / LOW with reasoning
  - `IMPLICATIONS` — operational takeaway for a KC resident
  - `WATCH LIST` — 1–5 specific future developments to monitor
- **With no articles (or all articles > 18h old)**: NOMINAL section rendering — `▬▬▬ NO NEW DEVELOPMENTS — [SECTOR] NOMINAL ▬▬▬`

### 4. Verify NOMINAL detection

To test NOMINAL rendering without waiting 18 hours, run `!digest` before any `!collect`. All three sections should render as NOMINAL with the last-collection timestamp.

### 5. Flash alert

In `#vigil-general`:
```
!flash
```
Expected: posts articles with trust rating ≥ 0.75 as a `FLASH INTEL` message, or "No high-trust flash items" if none qualify.

### 6. Scan — targeted topic search

In `#vigil-local`:
```
!scan transit expansion
```
Expected: up to 5 articles from an advanced-depth Tavily search (7-day window) posted to the channel.

---

## Development Guide

### Workflow overview

| Change type | What to do |
|-------------|-----------|
| Web app (`apps/web/`) | Push to `main` — Vercel deploys automatically |
| Lambda / infra (`services/`, `packages/`, `infra/`) | Push to `main`, then run `cdk deploy` from `infra/` |

CI runs lint, typecheck, and all tests on every push to `main`. Check the Actions tab before deploying if you want confirmation the build is green.

---

### Deploying the Web App

Push your changes to `main`. Vercel picks up the push and deploys automatically — no manual step required.

```bash
git push origin main
```

---

### Deploying Lambda Changes (AWS CDK)

Any change to `services/`, `packages/agents/`, `packages/clients/`, `packages/shared/`, or `infra/` needs a `cdk deploy` to reach AWS.

**Prerequisites**
- AWS CLI configured (`aws configure` or `AWS_PROFILE` env var set)
- CDK bootstrapped in your account/region (one-time: `cd infra && npx cdk bootstrap`)
- Root `.env` populated with all secrets — CDK reads these at synth time and bakes them into the Lambda environment

**Deploy**

```bash
cd infra
npx cdk deploy
```

CDK will print a changeset diff and prompt for confirmation before touching any resources. Review it — only approve if the diff matches what you changed.

**Preview changes without deploying**

```bash
cd infra
npx cdk diff
```

**Force a clean synth before deploying** (if `cdk.out` looks stale)

```bash
cd infra
npx cdk synth && npx cdk deploy
```

---

### Testing Lambdas After Deploy

Find the deployed function names (CDK appends a hash to the logical ID):

```bash
aws lambda list-functions \
  --query "Functions[?starts_with(FunctionName, 'VigilStack')].FunctionName" \
  --output table
```

**Invoke the collector** (single region):

```bash
aws lambda invoke \
  --function-name VigilStack-CollectorFunction<hash> \
  --payload '{"region":"local"}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

Omit `region` to run all three sectors:

```bash
aws lambda invoke \
  --function-name VigilStack-CollectorFunction<hash> \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

**Invoke the aggregator** (generates and sends the newsletter):

```bash
aws lambda invoke \
  --function-name VigilStack-AggregatorFunction<hash> \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

---

### Troubleshooting Deploys

**`DATABASE_URL` resolved to empty string**
The Lambda environment is baked at synth time from your root `.env`. If `DATABASE_URL` is blank in `.env` when you run `cdk deploy`, the Lambda gets a blank value. Fix: populate `.env`, then redeploy.

**Verify a Lambda's current environment without redeploying:**

```bash
aws lambda get-function-configuration \
  --function-name VigilStack-CollectorFunction<hash> \
  --query "Environment.Variables"
```

---

## Architecture Notes

See [CLAUDE.md](./CLAUDE.md) for full architecture notes, phase roadmap, AI client design, and session context.
