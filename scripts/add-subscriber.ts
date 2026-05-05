/**
 * Manually onboard a subscriber.
 *
 * Usage:
 *   npx tsx scripts/add-subscriber.ts --email foo@example.com [--tier pro] [--stripe cus_xyz]
 *
 * Tiers: free | pro | regional_pro | enterprise  (default: pro)
 *
 * Against prod:
 *   NODE_ENV=production npx tsx scripts/add-subscriber.ts --email foo@example.com
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const VALID_TIERS = ['free', 'pro', 'regional_pro', 'enterprise'] as const;
type Tier = typeof VALID_TIERS[number];

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

const email = getArg('--email');
const tier = (getArg('--tier') ?? 'pro') as Tier;
const stripeCustomerId = getArg('--stripe');

if (!email) {
  console.error('Usage: npx tsx scripts/add-subscriber.ts --email <email> [--tier pro] [--stripe cus_xyz]');
  process.exit(1);
}

if (!(VALID_TIERS as readonly string[]).includes(tier)) {
  console.error(`Invalid tier "${tier}". Valid: ${VALID_TIERS.join(', ')}`);
  process.exit(1);
}

const isDev = process.env['NODE_ENV'] === 'development';
const prisma = new PrismaClient({
  datasourceUrl: isDev ? process.env['DEV_DATABASE_URL'] : process.env['DATABASE_URL'],
});

async function main() {
  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (existing) {
    if (!existing.active) {
      const updated = await prisma.subscriber.update({
        where: { email },
        data: { active: true, tier, ...(stripeCustomerId !== undefined && { stripeCustomerId }) },
      });
      console.log(`Re-activated subscriber: ${updated.email} (${updated.tier})`);
    } else {
      console.log(`Subscriber already active: ${existing.email} (${existing.tier})`);
    }
  } else {
    const created = await prisma.subscriber.create({
      data: {
        email,
        tier,
        ...(stripeCustomerId !== undefined && { stripeCustomerId }),
      },
    });
    console.log(`Created subscriber: ${created.email} (${created.tier})${stripeCustomerId ? ` · Stripe: ${stripeCustomerId}` : ''}`);
  }

  const summary = await prisma.subscriber.groupBy({
    by: ['tier'],
    where: { active: true },
    _count: { id: true },
  });
  console.log('\nActive subscribers:');
  for (const row of summary) {
    console.log(`  ${row.tier.padEnd(12)} ${row._count.id}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
