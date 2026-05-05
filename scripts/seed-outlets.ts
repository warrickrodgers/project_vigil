/**
 * Outlet seed fixtures — migrated from BIAS_ANCHORS constant in Phase 1a.
 * Values sourced from AllSides Media Bias Chart + Ad Fontes Media Bias Chart.
 * TODO: calibrate biasAnchor against anchor embeddings in Phase 2.
 */

import { PrismaClient } from '@prisma/client';

type OutletFixture = {
  canonicalName: string;
  aliases: string[]; // will be JSON.stringify'd
  biasAnchor: number; // -1.0 (hard left) to 1.0 (hard right)
  reliabilityBase: number; // 0.0–1.0 baseline trust
  region?: string; // "local" | "usa" | "geopolitical" | null = global
};

const OUTLET_FIXTURES: OutletFixture[] = [
  // --- Wire services (global, centrist) ---
  {
    canonicalName: 'Reuters',
    aliases: ['reuters.com', 'Thomson Reuters'],
    biasAnchor: 0.0,
    reliabilityBase: 0.97,
  },
  {
    canonicalName: 'AP News',
    aliases: ['AP', 'Associated Press', 'The Associated Press'],
    biasAnchor: 0.0,
    reliabilityBase: 0.96,
  },

  // --- US national broadcast / public media ---
  {
    canonicalName: 'NPR',
    aliases: ['National Public Radio', 'NPR News'],
    biasAnchor: -0.15,
    reliabilityBase: 0.9,
    region: 'usa',
  },
  {
    canonicalName: 'PBS NewsHour',
    aliases: ['PBS News', 'PBS Newshour'],
    biasAnchor: -0.1,
    reliabilityBase: 0.88,
    region: 'usa',
  },

  // --- US cable / digital ---
  {
    canonicalName: 'CNN',
    aliases: ['CNN.com', 'Cable News Network'],
    biasAnchor: -0.35,
    reliabilityBase: 0.72,
    region: 'usa',
  },
  {
    canonicalName: 'MSNBC',
    aliases: ['msnbc.com', 'MS-NBC'],
    biasAnchor: -0.6,
    reliabilityBase: 0.65,
    region: 'usa',
  },
  {
    canonicalName: 'Fox News',
    aliases: ['FoxNews.com', 'Fox News Channel', 'FNC'],
    biasAnchor: 0.55,
    reliabilityBase: 0.62,
    region: 'usa',
  },

  // --- US print / digital ---
  {
    canonicalName: 'The Guardian',
    aliases: ['Guardian', 'theguardian.com', 'The Guardian US'],
    biasAnchor: -0.45,
    reliabilityBase: 0.8,
  },
  {
    canonicalName: 'Wall Street Journal',
    aliases: ['WSJ', 'The Wall Street Journal', 'wsj.com'],
    biasAnchor: 0.25,
    reliabilityBase: 0.85,
    region: 'usa',
  },
  {
    canonicalName: 'Axios',
    aliases: ['axios.com'],
    biasAnchor: 0.0,
    reliabilityBase: 0.84,
    region: 'usa',
  },

  // --- International / geopolitical ---
  {
    canonicalName: 'BBC',
    aliases: ['BBC News', 'BBC World', 'bbc.com', 'bbc.co.uk'],
    biasAnchor: -0.05,
    reliabilityBase: 0.92,
  },
  {
    canonicalName: 'The Economist',
    aliases: ['Economist', 'economist.com'],
    biasAnchor: 0.1,
    reliabilityBase: 0.91,
  },
  {
    canonicalName: 'Foreign Affairs',
    aliases: ['foreignaffairs.com', 'Foreign Affairs Magazine'],
    biasAnchor: -0.05,
    reliabilityBase: 0.93,
    region: 'geopolitical',
  },
  {
    canonicalName: 'SCMP',
    aliases: ['South China Morning Post', 'scmp.com'],
    biasAnchor: 0.1,
    reliabilityBase: 0.75,
    region: 'geopolitical',
  },
  {
    canonicalName: 'Nikkei Asia',
    aliases: ['Nikkei', 'asia.nikkei.com', 'Nikkei Asian Review'],
    biasAnchor: 0.05,
    reliabilityBase: 0.86,
    region: 'geopolitical',
  },
  {
    canonicalName: 'Al Jazeera',
    aliases: ['aljazeera.com', 'Al Jazeera English', 'AJE'],
    biasAnchor: -0.1,
    reliabilityBase: 0.74,
    region: 'geopolitical',
  },

  // --- Local KC metro ---
  {
    canonicalName: 'KC Star',
    aliases: ['The KC Star', 'Kansas City Star', 'kansascity.com'],
    biasAnchor: -0.15,
    reliabilityBase: 0.78,
    region: 'local',
  },
  {
    canonicalName: 'KCUR',
    aliases: ['kcur.org', 'KCUR 89.3', 'Kansas City Public Radio'],
    biasAnchor: -0.1,
    reliabilityBase: 0.82,
    region: 'local',
  },
  {
    canonicalName: 'Fox4KC',
    aliases: ['FOX4', 'fox4kc.com', 'WDAF-TV', 'Fox 4 Kansas City'],
    biasAnchor: 0.3,
    reliabilityBase: 0.68,
    region: 'local',
  },
  {
    canonicalName: 'KSHB',
    aliases: ['41 Action News', 'kshb.com', 'KSHB-TV', 'Action News'],
    biasAnchor: 0.0,
    reliabilityBase: 0.72,
    region: 'local',
  },
  {
    canonicalName: 'KC Business Journal',
    aliases: ['Kansas City Business Journal', 'bizjournals.com/kansascity'],
    biasAnchor: 0.1,
    reliabilityBase: 0.76,
    region: 'local',
  },

  // --- Geopolitical additions ---
  {
    canonicalName: 'Foreign Policy',
    aliases: ['foreignpolicy.com', 'FP', 'Foreign Policy Magazine'],
    biasAnchor: -0.1,
    reliabilityBase: 0.88,
    region: 'geopolitical',
  },
  {
    canonicalName: 'Defense One',
    aliases: ['defenseone.com', 'Defense One Magazine'],
    biasAnchor: 0.05,
    reliabilityBase: 0.84,
    region: 'geopolitical',
  },
  {
    canonicalName: 'War on the Rocks',
    aliases: ['warontherocks.com'],
    biasAnchor: 0.0,
    reliabilityBase: 0.85,
    region: 'geopolitical',
  },
  {
    canonicalName: 'Politico',
    aliases: ['politico.com', 'Politico.eu'],
    biasAnchor: -0.1,
    reliabilityBase: 0.8,
  },
  {
    canonicalName: 'The Hill',
    aliases: ['thehill.com', 'The Hill DC'],
    biasAnchor: 0.0,
    reliabilityBase: 0.76,
    region: 'usa',
  },
];

export async function seedOutlets(
  prisma: PrismaClient,
): Promise<Map<string, string>> {
  console.log('  Seeding outlets...');

  const idMap = new Map<string, string>();

  for (const fixture of OUTLET_FIXTURES) {
    const { aliases, ...rest } = fixture;
    const outlet = await prisma.outlet.upsert({
      where: { canonicalName: fixture.canonicalName },
      update: {},
      create: {
        ...rest,
        aliases: JSON.stringify(aliases),
      },
    });
    idMap.set(outlet.canonicalName, outlet.id);
    console.log(`    [outlet] ${outlet.canonicalName}`);
  }

  console.log(`  Done. ${idMap.size} outlets seeded.\n`);
  return idMap;
}
