import { PrismaClient } from '../generated/client/index.js';
// Narrow subpath (not the barrel): avoids pulling ioredis into every consumer
// of the DB client just to read NODE_ENV.
import { getServerEnv } from '@nexus/shared/env';

/**
 * Prisma client singleton. A `globalThis` guard prevents connection exhaustion
 * from hot-reloading in development (Next.js) and repeated imports.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const { NODE_ENV } = getServerEnv();

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
