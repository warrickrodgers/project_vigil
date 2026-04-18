/**
 * Seed script — inserts outlets then representative Articles across all three regions.
 * Run via: npm run db:seed
 * DATABASE_URL is injected as an absolute path by the npm script (WSL-safe).
 */

import { PrismaClient } from '@prisma/client';
import { serializeSectorTags, computeArticleHash, computeTrustRating } from '../packages/shared/src/index.js';
import { seedOutlets } from './seed-outlets.js';

const prisma = new PrismaClient();

type ArticleSeed = {
  url: string;
  title: string;
  summary: string;
  /** Placeholder rawContent; real fetches happen in Phase 1b collectors. */
  rawContent?: string;
  /** Canonical outlet name — resolved to outletId via the seed outlet map. */
  outletCanonical: string;
  biasScore: number;
  region: string;
  sectorTags: string;
  publishedAt: Date;
};

const articles: ArticleSeed[] = [
  // --- LOCAL (Kansas City metro) ---
  {
    url: 'https://www.kansascity.com/news/local/article-kc-transit-2025',
    title: 'KC Metro approves $2.4B streetcar expansion to Overland Park',
    summary:
      'The Kansas City Area Transportation Authority voted 7-2 to extend the Main Street streetcar line south into Johnson County, with construction expected to begin in late 2026.',
    rawContent:
      'The Kansas City Area Transportation Authority (KCATA) board voted Thursday to approve the $2.4 billion expansion of the Main Street streetcar line into Johnson County.',
    outletCanonical: 'KC Star',
    biasScore: -0.15,
    region: 'local',
    sectorTags: serializeSectorTags(['policy', 'economy']),
    publishedAt: new Date('2025-11-12T14:30:00Z'),
  },
  {
    url: 'https://www.kcur.org/news/2025-11-10/kc-homicide-rate-decline',
    title: "Kansas City's homicide rate drops 18% in 2025, police chief attributes shift to community policing",
    summary:
      'KCPD reported 142 homicides through October 2025, down from 173 in the same period last year.',
    outletCanonical: 'KCUR',
    biasScore: -0.1,
    region: 'local',
    sectorTags: serializeSectorTags(['policy', 'legal']),
    publishedAt: new Date('2025-11-10T18:00:00Z'),
  },

  // --- USA (national) ---
  {
    url: 'https://apnews.com/article/fed-rate-decision-november-2025',
    title: 'Federal Reserve holds rates steady, signals two cuts in 2026',
    summary:
      'The Federal Open Market Committee voted unanimously to hold the federal funds rate at 4.75%–5.00%, while revised dot-plot projections point to 50 basis points of cuts next year.',
    rawContent:
      'WASHINGTON (AP) — The Federal Reserve on Wednesday kept its benchmark interest rate unchanged for the third consecutive meeting, while signalling it expects to cut rates twice in 2026.',
    outletCanonical: 'AP News',
    biasScore: 0.0,
    region: 'usa',
    sectorTags: serializeSectorTags(['economy', 'policy']),
    publishedAt: new Date('2025-11-06T19:00:00Z'),
  },
  {
    url: 'https://www.foxnews.com/politics/border-crossings-november-2025',
    title: 'Border crossings hit 18-month low amid new enforcement surge, DHS says',
    summary:
      'Department of Homeland Security data shows illegal crossings at the southern border fell to 98,000 in October 2025, the lowest monthly figure since May 2024.',
    outletCanonical: 'Fox News',
    biasScore: 0.55,
    region: 'usa',
    sectorTags: serializeSectorTags(['policy', 'legal']),
    publishedAt: new Date('2025-11-08T21:15:00Z'),
  },

  // --- GEOPOLITICAL ---
  {
    url: 'https://www.reuters.com/world/asia-pacific/taiwan-strait-drills-2025',
    title: "China conducts 72-hour naval exercise in Taiwan Strait, Taiwan's military on heightened alert",
    summary:
      "The PLA Navy deployed two carrier groups for drills that included live-fire exercises in the northern and southern Taiwan Strait corridors.",
    rawContent:
      'BEIJING/TAIPEI (Reuters) — China launched its largest naval exercises in the Taiwan Strait in three years on Friday, deploying two carrier strike groups.',
    outletCanonical: 'Reuters',
    biasScore: 0.0,
    region: 'geopolitical',
    sectorTags: serializeSectorTags(['conflict', 'policy']),
    publishedAt: new Date('2025-11-14T06:00:00Z'),
  },
  {
    url: 'https://www.scmp.com/news/china/diplomacy/article-taiwan-strait-drills-2025',
    title: 'PLA drills in Taiwan Strait described as routine and defensive by Beijing spokesman',
    summary:
      "China's Ministry of National Defence characterised the exercise as a planned defensive drill responding to 'provocations by external forces'.",
    outletCanonical: 'SCMP',
    biasScore: 0.1,
    region: 'geopolitical',
    sectorTags: serializeSectorTags(['conflict', 'policy']),
    publishedAt: new Date('2025-11-14T09:45:00Z'),
  },
];

async function main() {
  console.log('Seeding database...\n');

  // 1. Seed outlets first; get back a canonicalName → id map
  const outletMap = await seedOutlets(prisma);

  // 2. Seed articles
  console.log('  Seeding articles...');
  let upserted = 0;

  for (const article of articles) {
    const outletId = outletMap.get(article.outletCanonical);
    if (outletId === undefined) {
      throw new Error(
        `seed.ts: no outlet found for canonical name "${article.outletCanonical}". ` +
        `Add it to seed-outlets.ts fixtures.`,
      );
    }

    // Use rawContent for dedup hash; fall back to title only when rawContent is absent.
    const rawForHash = article.rawContent ?? '';
    const hash = computeArticleHash(article.title, rawForHash);

    // Derive outlet reliabilityBase from the outlet map for trustRating computation.
    // We fetch it from the DB to avoid duplicating the value in seed data.
    const outlet = await prisma.outlet.findUniqueOrThrow({ where: { id: outletId } });
    const trustRating = computeTrustRating(article.biasScore, 0, outlet.reliabilityBase);

    const { outletCanonical, rawContent, ...rest } = article;
    await prisma.article.upsert({
      where: { url: article.url },
      update: {},
      create: {
        ...rest,
        rawContent: rawContent ?? null,
        outletId,
        hash,
        trustRating,
      },
    });

    upserted++;
    console.log(`    [${article.region.padEnd(14)}] ${article.title.slice(0, 68)}...`);
  }

  const totalArticles = await prisma.article.count();
  const totalOutlets = await prisma.outlet.count();
  console.log(`\nDone. ${upserted} articles upserted.`);
  console.log(`DB totals: ${totalOutlets} outlets, ${totalArticles} articles.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
