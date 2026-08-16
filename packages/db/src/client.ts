import path from 'node:path';
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

// On Vercel, Next's `transpilePackages` bundles this module together with the
// generated client above, which rewrites its __dirname and breaks Prisma's own
// engine-binary auto-detection (see outputFileTracingIncludes in
// apps/web/next.config.mjs). Point it at the real file directly — Vercel's
// Node functions always extract to /var/task. Filename must match the
// rhel-openssl-3.0.x binaryTarget in packages/db/prisma/schema.prisma.
if (process.env.VERCEL === '1' && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
    '/var/task/packages/db/generated/client',
    'libquery_engine-rhel-openssl-3.0.x.so.node',
  );
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
