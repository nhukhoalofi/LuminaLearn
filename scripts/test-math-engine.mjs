import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const configured = process.env.PYTHON_EXECUTABLE?.trim();
const local = process.platform === 'win32'
  ? resolve(root, 'services/math-engine/.venv/Scripts/python.exe')
  : resolve(root, 'services/math-engine/.venv/bin/python');
const candidates = configured ? [configured] : [local, process.platform === 'win32' ? 'python' : 'python3', 'python'];
let python;
for (const candidate of [...new Set(candidates)]) {
  const probe = spawnSync(candidate, ['-c', 'import luminalearn_math_engine'], { cwd: root, stdio: 'ignore', windowsHide: true });
  if (!probe.error && probe.status === 0) {
    python = candidate;
    break;
  }
}
if (!python) {
  console.error('math_engine_python_unavailable: set PYTHON_EXECUTABLE to an interpreter with luminalearn_math_engine installed');
  process.exit(1);
}
const result = spawnSync(python, ['-m', 'pytest', 'services/math-engine'], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
