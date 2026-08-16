import fs from 'node:fs';
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

/**
 * Vercel-only: pin the Prisma query engine binary explicitly.
 *
 * Next's `transpilePackages` bundles the generated client that this module
 * re-exports into a .next chunk, which rewrites the `__dirname` Prisma's own
 * engine lookup relies on. It then searches paths relative to the chunk and
 * never finds libquery_engine-*.so.node (see outputFileTracingIncludes in
 * apps/web/next.config.mjs, which is what actually ships the binary).
 *
 * The location differs between phases — the build runs from /vercel/path0
 * while deployed functions extract to /var/task — so probe rather than assume.
 * Hardcoding /var/task previously broke the build itself. If nothing matches
 * we leave Prisma's own resolution alone rather than forcing a bad path.
 */
if (process.env.VERCEL && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  // Must match the non-native entry in schema.prisma's binaryTargets.
  const ENGINE_FILE = 'libquery_engine-rhel-openssl-3.0.x.so.node';
  const candidateDirs = [
    // Deployed function: tracing mirrors the monorepo layout under /var/task.
    '/var/task/packages/db/generated/client',
    // Build phase (cwd is apps/web), and any layout keeping that relationship.
    path.resolve(process.cwd(), '../../packages/db/generated/client'),
  ];

  const engine = candidateDirs
    .map((dir) => path.join(dir, ENGINE_FILE))
    .find((candidate) => fs.existsSync(candidate));

  if (engine) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = engine;
  } else {
    console.warn(
      `[@nexus/db] No query engine found in ${candidateDirs.join(' or ')}; ` +
        "falling back to Prisma's built-in resolution.",
    );
  }
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
