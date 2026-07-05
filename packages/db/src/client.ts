import { PrismaClient } from '../generated/client/index.js';

/**
 * Prisma client singleton. A `globalThis` guard prevents connection exhaustion
 * from hot-reloading in development (Next.js) and repeated imports.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
