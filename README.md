# Project Vigil

OSINT research agent network — collects, corroborates, and dispatches a curated intelligence newsletter across Local (KC metro), USA, and Geopolitical sectors.

**Alpha build**: SQLite + local agents. Production target: AWS Lambda + EventBridge + SES.

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:migrate     # creates dev.db
npm run db:seed        # inserts example articles
npm run db:studio      # inspect data at localhost:5555
npm test               # run test suite
```

See [CLAUDE.md](./CLAUDE.md) for full architecture notes, phase roadmap, and session context.
