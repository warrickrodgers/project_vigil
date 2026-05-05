import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isDev = process.env['NODE_ENV'] === 'development';
const datasourceUrl = isDev
  ? process.env['DEV_DATABASE_URL']
  : process.env['DATABASE_URL'];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl !== undefined && { datasourceUrl }),
    log: isDev ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient } from '@prisma/client';
// Note: Prisma model types (Article, Outlet) are available after `npm run db:generate`
