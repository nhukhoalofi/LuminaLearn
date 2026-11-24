import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const fileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export function getStorageRoot(): string {
  // On Vercel or AWS Lambda, the app directory (/var/task) is strictly read-only.
  // Only /tmp is writable.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return resolve(tmpdir(), 'luminalearn');
  }
  return fileRoot;
}
