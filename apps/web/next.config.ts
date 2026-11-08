import type { NextConfig } from 'next';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load monorepo root .env if running from apps/web package
const configDir = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(configDir, '../../.env');
if (existsSync(rootEnv)) {
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    // Ignore if already loaded by process
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

