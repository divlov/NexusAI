import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages shipped as TS source must be transpiled by Next.
  transpilePackages: ['@nexus/shared', '@nexus/db', '@nexus/ui', '@nexus/connectors'],
  // Keep native/server-only deps out of the bundle; load them at runtime.
  serverExternalPackages: ['@prisma/client', '.prisma/client', 'bullmq', 'ioredis', '@node-rs/argon2'],
  // Pin the monorepo root so file tracing reaches workspace packages outside
  // apps/web (notably @nexus/db) identically in Vercel's build and locally,
  // rather than relying on lockfile-based auto-detection.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  webpack: (config, { isServer }) => {
    // The workspace packages are TS source using explicit `.js` ESM import
    // specifiers (NodeNext style). Teach webpack to resolve `.js` → `.ts`/`.tsx`.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };

    if (isServer) {
      // @nexus/db generates its Prisma Client to a custom path outside
      // node_modules, and `transpilePackages` then bundles it into a .next
      // chunk. That rewrites the __dirname Prisma's engine lookup depends on,
      // so at runtime it searches next to the chunk and finds no
      // libquery_engine-*.so.node — the binary is still back in packages/db.
      //
      // This is Prisma's own fix for the monorepo case (referenced from the
      // "engine not found" error). It copies the engine + schema next to each
      // emitted chunk that embeds a Prisma output path, and adds those copies
      // to the .nft.json manifests so Vercel actually deploys them. Plain file
      // tracing can't do this: it can place the binary in the function, but
      // not next to the bundle, which is where Prisma looks.
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }

    return config;
  },
};

export default nextConfig;
