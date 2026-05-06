import type { VigilDB } from './types.js';

/**
 * Wraps a Prisma client into a VigilDB-compatible interface.
 * Adds the hasRecentArticle method which Prisma doesn't have natively.
 *
 * Usage:
 *   import { makeVigilDB } from '@vigil/agents';
 *   const db = makeVigilDB(prisma);
 *   new CollectorAgent(gemini, tavily, emitter, db, chroma);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeVigilDB(prisma: any): VigilDB {
  return {
    outlet: prisma.outlet,
    article: {
      findMany: (args?: unknown) => prisma.article.findMany(args),
      findFirst: (args?: unknown) => prisma.article.findFirst(args),
      create: (args: unknown) => prisma.article.create(args),
      update: (args: unknown) => prisma.article.update(args),
      count: (args?: unknown) => prisma.article.count(args),
      hasRecentArticle: async (url: string, withinHours: number): Promise<boolean> => {
        const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
        const existing = await prisma.article.findFirst({
          where: {
            url,
            collectedAt: { gte: cutoff },
          },
          select: { id: true },
        });
        return existing !== null;
      },
    },
  };
}
