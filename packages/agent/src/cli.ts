import 'dotenv/config';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { LiveGeminiAdapter } from './adapter';
import { MockGeminiAdapter } from './mock-adapter';
import { MathLessonPlanner, VisualStoryboardDirector } from './planner';
import { resolveMathEnginePython } from './orchestration/python-resolver';

const execFileAsync = promisify(execFile);

interface CliOptions { live: boolean; render: boolean; output?: string; outputDir: string; python?: string; }

function parseArguments(args: string[]): CliOptions {
  const value = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
  return { live: args.includes('--live'), render: args.includes('--render'), output: value('--output'), outputDir: value('--output-dir') ?? 'services/math-engine/output', python: value('--python') };
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const adapter = options.live ? new LiveGeminiAdapter() : new MockGeminiAdapter();
  const result = await new MathLessonPlanner(adapter).plan({ topic: 'Đạo hàm là gì?', targetAudience: 'Học sinh lớp 11', language: 'vi', durationSeconds: 40 });
  if (result.status !== 'ready') throw new Error(`Planner stopped with status ${result.status}: ${result.reason}`);
  const scene = await new VisualStoryboardDirector(adapter).direct(result.draft);
  const payload = JSON.stringify(scene, null, 2);
  if (options.output) await writeFile(resolve(options.output), payload, 'utf8');

  if (!options.render) {
    process.stdout.write(`${payload}\n`);
    return;
  }

  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const python = options.python ?? (await resolveMathEnginePython());
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'luminalearn-scene-'));
  const scenePath = resolve(temporaryDirectory, 'scene.json');
  try {
    await writeFile(scenePath, payload, 'utf8');
    const { stdout } = await execFileAsync(python, [
      '-m', 'luminalearn_math_engine.cli', 'pipeline', scenePath,
      '--output-dir', resolve(repositoryRoot, options.outputDir), '--timeout', '300'
    ], { cwd: repositoryRoot, timeout: 330_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    process.stdout.write(stdout);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Phase 3 pipeline failed: ${message}\n`);
  process.exitCode = 1;
});

