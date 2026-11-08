import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface AlgebraIdentityVerificationV3 {
  status: 'verified' | 'incorrect';
  left: string;
  right: string;
  canonicalDifference: string;
  verifier: string;
}

function pythonExecutable(): string {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
  const configured = process.env.LUMINA_PYTHON_EXECUTABLE;
  if (configured) return configured;
  const windows = resolve(root, 'services/math-engine/.venv/Scripts/python.exe');
  return process.platform === 'win32' && existsSync(windows)
    ? windows
    : resolve(root, 'services/math-engine/.venv/bin/python');
}

export function verifyAlgebraIdentityV3(left: string, right: string): Promise<AlgebraIdentityVerificationV3> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonExecutable(), ['-m', 'luminalearn_math_engine.cli', 'verify-algebra', '-'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15_000
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`algebra_verification_failed: ${stderr.trim() || `exit ${code}`}`));
      try { resolvePromise(JSON.parse(stdout) as AlgebraIdentityVerificationV3); }
      catch (error) { reject(new Error('algebra_verification_invalid_response', { cause: error })); }
    });
    child.stdin.end(JSON.stringify({ left, right }));
  });
}

