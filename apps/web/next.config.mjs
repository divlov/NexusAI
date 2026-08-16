import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages shipped as TS source must be transpiled by Next.
  transpilePackages: ['@nexus/shared', '@nexus/db', '@nexus/ui', '@nexus/connectors'],
  // Keep native/server-only deps out of the bundle; load them at runtime.
  serverExternalPackages: ['@prisma/client', '.prisma/client', 'bullmq', 'ioredis', '@node-rs/argon2'],
  // Pin the monorepo root explicitly so file tracing (below) resolves
  // "../../packages/db" the same way in Vercel's build as it does locally,
  // instead of relying on lockfile-based auto-detection.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // @nexus/db generates its Prisma Client to a custom (non-default) output
  // path outside node_modules/.prisma. The engine binary Prisma loads is
  // chosen dynamically at runtime based on the detected platform, so
  // @vercel/nft's static trace can't infer which one to ship — every route
  // that can touch the DB needs it force-included explicitly, or the deployed
  // function is missing libquery_engine-*.so.node.
  outputFileTracingIncludes: {
    '/**': ['../../packages/db/generated/client/**/*'],
  },
  // The workspace packages are TS source using explicit `.js` ESM import
  // specifiers (NodeNext style). Teach webpack to resolve `.js` → `.ts`/`.tsx`.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
