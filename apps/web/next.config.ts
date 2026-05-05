import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@vigil/db'],
  serverExternalPackages: ['@prisma/client'],
  // Next.js 15 passes legacy ESLint options (useEslintrc, extensions) incompatible
  // with ESLint v9. Linting runs separately via `npm run lint` at the repo root.
  eslint: { ignoreDuringBuilds: true },
};

export default config;
