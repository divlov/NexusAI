/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages shipped as TS source must be transpiled by Next.
  transpilePackages: ['@nexus/shared', '@nexus/db', '@nexus/ui', '@nexus/connectors'],
  // Keep native/server-only deps out of the bundle; load them at runtime.
  serverExternalPackages: ['@prisma/client', '.prisma/client', 'bullmq', 'ioredis', '@node-rs/argon2'],
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
