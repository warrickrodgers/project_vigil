/**
 * Backfill ChromaDB embeddings for articles that were collected before ChromaDB was connected.
 * Reads all articles with embeddingId IS NULL from Supabase, generates embeddings via Gemini,
 * upserts into ChromaDB Cloud, and updates embeddingId on the article.
 *
 * Run against prod:
 *   NODE_ENV=production npx tsx scripts/backfill-embeddings.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { GeminiClient, ChromaClient, APICallTracker } from '../packages/clients/src/index.js';

const isDev = process.env['NODE_ENV'] === 'development';
const prisma = new PrismaClient({
  datasourceUrl: isDev ? process.env['DEV_DATABASE_URL'] : process.env['DATABASE_URL'],
});

async function main() {
  const tracker = new APICallTracker();
  const gemini = new GeminiClient(process.env['GEMINI_API_KEY'] ?? '', tracker);
  const chroma = new ChromaClient();

  const reachable = await chroma.isReachable();
  if (!reachable) {
    console.error('ChromaDB is not reachable. Check CHROMADB_CLOUD_API_KEY and CHROMADB_CLOUD_TENANT_ID.');
    process.exit(1);
  }

  const articles = await prisma.article.findMany({
    where: { embeddingId: null },
    include: { outlet: true },
    orderBy: { collectedAt: 'asc' },
  });

  console.log(`Found ${articles.length} articles without embeddings.\n`);

  let succeeded = 0;
  let failed = 0;

  for (const article of articles) {
    try {
      const embedding = await gemini.embed(`${article.title} ${article.summary}`);

      await chroma.upsertArticle(article.id, embedding, {
        outletId: article.outletId,
        region: article.region,
        title: article.title,
      });

      await prisma.article.update({
        where: { id: article.id },
        data: { embeddingId: article.id },
      });

      succeeded++;
      console.log(`  ✓ [${article.region.padEnd(14)}] ${article.title.slice(0, 70)}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${article.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const summary = tracker.getSummary();
  console.log(`\nDone. ${succeeded} embedded, ${failed} failed.`);
  console.log(`Gemini calls: ${summary.totalCalls}, est. cost: $${summary.estimatedCostUSD.toFixed(4)}`);

  await tracker.flush();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
