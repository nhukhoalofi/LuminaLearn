import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

export const HYBRID_RENDERER_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)), '../../..'
);

export function loadRepositoryEnvironment(repositoryRoot = HYBRID_RENDERER_REPOSITORY_ROOT): {
  repositoryRoot: string;
  envPath: string;
  loaded: boolean;
} {
  const envPath = resolve(repositoryRoot, '.env');
  if (!existsSync(envPath)) return { repositoryRoot, envPath, loaded: false };
  const result = loadDotenv({ path: envPath, override: false });
  if (result.error) throw new Error('environment_load_failed: could not load repository .env', { cause: result.error });
  return { repositoryRoot, envPath, loaded: true };
}
