import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(moduleDir, '../../../..');

let cachedPythonExecutable: string | null = null;
let cachedConfiguredEnv: string | undefined = undefined;

export function clearPythonResolverCache(): void {
  cachedPythonExecutable = null;
  cachedConfiguredEnv = undefined;
}

export function probePythonExecutable(
  command: string,
  timeoutMs = 10_000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      command,
      ['-c', 'import luminalearn_math_engine; print(luminalearn_math_engine.__file__)'],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const message = `${basename(command)} execution failed: ${stderr || stdout || error.message}`;
          return reject(new Error(message, { cause: error }));
        }
        resolvePromise({ stdout, stderr });
      }
    );
  });
}

/**
 * Resolves an authoritative Python interpreter that can import luminalearn_math_engine.
 *
 * Priority:
 * 1. Explicitly configured PYTHON_EXECUTABLE (or legacy LUMINA_PYTHON_EXECUTABLE).
 *    If explicitly set, it is authoritative and fails closed immediately without fallback.
 * 2. Validated local virtualenv (services/math-engine/.venv)
 * 3. System Python candidates (python, python3, python.exe)
 *
 * Caches the successfully resolved path in memory unless bypassCache is true.
 */
export async function resolveMathEnginePython(options?: {
  timeoutMs?: number;
  bypassCache?: boolean;
}): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  // Canonical variable is PYTHON_EXECUTABLE; preserve legacy LUMINA_PYTHON_EXECUTABLE as fallback
  const configured = (process.env.PYTHON_EXECUTABLE || process.env.LUMINA_PYTHON_EXECUTABLE)?.trim();

  if (configured !== cachedConfiguredEnv) {
    cachedPythonExecutable = null;
    cachedConfiguredEnv = configured;
  }

  if (!options?.bypassCache && cachedPythonExecutable) {
    return cachedPythonExecutable;
  }

  if (configured) {
    try {
      await probePythonExecutable(configured, timeoutMs);
      if (!options?.bypassCache) {
        cachedPythonExecutable = configured;
      }
      return configured;
    } catch (error) {
      throw new Error(
        `math_engine_python_unavailable: Configured Python executable '${configured}' cannot import luminalearn_math_engine. ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const localVenv = process.platform === 'win32'
    ? resolve(repositoryRoot, 'services/math-engine/.venv/Scripts/python.exe')
    : resolve(repositoryRoot, 'services/math-engine/.venv/bin/python');

  const candidates: string[] = [];
  if (existsSync(localVenv)) {
    candidates.push(localVenv);
  }
  if (process.platform === 'win32') {
    candidates.push('python.exe', 'python');
  } else {
    candidates.push('python3', 'python');
  }
  if (!candidates.includes(localVenv)) {
    candidates.push(localVenv);
  }

  const uniqueCandidates = [...new Set(candidates)];
  const failures: string[] = [];

  for (const candidate of uniqueCandidates) {
    try {
      await probePythonExecutable(candidate, timeoutMs);
      if (!options?.bypassCache) {
        cachedPythonExecutable = candidate;
      }
      return candidate;
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(
    `math_engine_python_unavailable: No Python interpreter can import luminalearn_math_engine. ${failures.join(' | ')}`
  );
}

