# Immediate TODOs

- [ ] **Clerk — restrict to invite-only**: Clerk Dashboard → your production app → **User & Authentication → Restrictions** → enable "Allowlist" mode. Add approved emails manually. Blocks public sign-ups until pre-alpha approval comes through.

---

# Phase 2C Setup — Completed

All infrastructure setup tasks are complete. The pipeline is live.

| Task | Status | Notes |
|------|--------|-------|
| Supabase Postgres provisioned | ✅ | `DATABASE_URL` set in `.env` and Lambda env |
| Prisma migrations applied to prod | ✅ | `Outlet`, `Article`, `BudgetState` tables live |
| Prod DB seeded with outlets | ✅ | 26 outlets seeded via `NODE_ENV=production tsx scripts/seed.ts` |
| AWS CLI + credentials configured | ✅ | `vigil-deploy` IAM user, `us-east-1` |
| CDK bootstrapped | ✅ | `CDKToolkit` stack live in `us-east-1` |
| CDK stack deployed | ✅ | `VigilStack` — Lambdas, EventBridge, SQS, DLQ |
| Lambda environment variables set | ✅ | DB, Gemini, Tavily, SES keys baked in |
| Collector Lambda tested | ✅ | 8 articles collected, saved to Supabase |
| Aggregator Lambda tested | ✅ | Newsletter built, dispatched via SES |
| Recipient email verified in SES | ✅ | `wasazimbo@gmail.com` sandbox-verified |

---

## Remaining — Polish (not blockers)

| Task | Notes |
|------|-------|
| SES domain verification (`initiativevigil.com`) | Add DKIM/SPF/DMARC to Squarespace DNS — fixes spam delivery |
| SES sandbox → production access | Request at ~50 subscribers |
| S3 bucket for newsletter HTML archive | Nice-to-have — newsletters currently not persisted in Lambda |
| CloudWatch alarms | Basic error rate alarm on both Lambdas |
| CI/CD: GitHub Actions deploy pipeline | Auto-deploy on push to main |
| ChromaDB production deployment | Blocks Phase 2b semantic corroboration |

---

## Phase 3 — Web App (initiativevigil.com via Vercel)

### 1. Vercel Project Setup

- [ ] [vercel.com](https://vercel.com) → **New Project** → Import `project_vigil` from GitHub
- [ ] In project config set:
  - **Root Directory**: *(leave blank — repo root, not `apps/web`)*
  - **Build Command**: `npm run web:build`
  - **Output Directory**: `apps/web/.next`
  - **Install Command**: `npm install`

> Root must be the repo root because `apps/web` depends on `@vigil/db` via npm workspaces.
> Vercel needs to see the full workspace to resolve `packages/*` symlinks.

### 2. Vercel Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables (scope: **Production**):

```
# Clerk — production keys (pk_live_ / sk_live_)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Database — same Supabase URL as Lambda
NODE_ENV=production
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres

# Stripe (add when payment links are created)
# NEXT_PUBLIC_STRIPE_PRO_LINK=https://buy.stripe.com/...
# NEXT_PUBLIC_STRIPE_REGIONAL_PRO_LINK=https://buy.stripe.com/...
# NEXT_PUBLIC_STRIPE_ENTERPRISE_LINK=mailto:hello@initiativevigil.com
```

### 3. Domain — initiativevigil.com

**In Vercel** (Project → Settings → Domains):
- [ ] Add `initiativevigil.com` and `www.initiativevigil.com`
- [ ] Copy the DNS values Vercel generates

**In Squarespace DNS** (Domains → initiativevigil.com → DNS Settings):
- [ ] **A record**: `@` → `76.76.21.21` (Vercel's IP)
- [ ] **CNAME**: `www` → `cname.vercel-dns.com`
- [ ] Remove any conflicting A/CNAME records on `@` or `www`
- [ ] Wait 15 min–2 hrs for propagation

### 4. Clerk — Production App

In [dashboard.clerk.com](https://dashboard.clerk.com) → switch to/create **Production** instance:
- [ ] Add allowed origins: `https://initiativevigil.com`, `https://www.initiativevigil.com`
- [ ] Confirm redirect URLs: `/sign-in`, `/sign-up`, `/dashboard`
- [ ] Copy production keys (`pk_live_...` / `sk_live_...`) into Vercel env vars
- [ ] Enable social providers if desired (Google recommended)

### 5. Prod DB — Subscriber Table

Run once after first Vercel deploy (table may not exist yet in prod):

```bash
NODE_ENV=production npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
```

Then add yourself as a subscriber to test the dashboard:

```bash
NODE_ENV=production npx tsx scripts/add-subscriber.ts --email warrickrodgers@gmail.com --tier pro
```

### 6. First Deploy Smoke Test

- [ ] Push main → Vercel auto-deploys → check build logs (no errors)
- [ ] `https://initiativevigil.com` → landing page loads with glassmorphism
- [ ] `/sign-up` → create account → redirected to `/dashboard`
- [ ] Dashboard shows **Pro** tier badge and active status dot
- [ ] `/pricing` → all 4 tier cards render correctly

### 7. Clerk Billing (when ready)

Clerk has a native billing system that avoids a separate Stripe integration for subscription management.

**Steps to wire up:**

1. **Enable Billing in Clerk Dashboard** → Your app → **Billing** → enable the feature and create plans matching your tiers (Free, Pro at $4.99/mo, Regional Pro at $14.99/mo, Enterprise).

2. **Drop in `<PricingTable />`** (optional) — Clerk provides a hosted pricing table component you can render instead of the custom one:
   ```tsx
   import { PricingTable } from '@clerk/nextjs';
   <PricingTable />
   ```
   Or keep the custom card UI in `apps/web/src/app/pricing/page.tsx` and wire each CTA to Clerk's checkout URL (available from the Clerk Dashboard per plan).

3. **Gate dashboard content by plan** — use `useUser()` to read `user.publicMetadata.tier` (set by Clerk on subscription), or use `auth().protect()` with a billing check in the route handler.

4. **Handle subscription webhooks** — create `apps/web/src/app/api/webhooks/clerk/billing/route.ts` to listen for `subscription.created`, `subscription.updated`, `subscription.deleted` events and sync the subscriber's tier in the Supabase `Subscriber` table.

5. **Set env vars** — no additional keys needed; Clerk billing uses the same `CLERK_SECRET_KEY`.

> See: https://clerk.com/docs/billing/overview

### 8. Stripe Wiring (alternative — if Clerk Billing doesn't fit)

- [ ] Create Stripe products: Free, Pro ($4.99/mo), Regional Pro ($14.99/mo), Enterprise
- [ ] Generate Payment Links, add to Vercel env vars
- [ ] Build `/api/webhooks/stripe` route to handle `customer.subscription.created/deleted` and update `Subscriber` in DB
