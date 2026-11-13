import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = process.cwd();
const qaDir = resolve(root, 'outputs/cloud_qa_frames');
mkdirSync(qaDir, { recursive: true });

const frames = [
  { f: 50, name: 'frame_001_intro.png' },
  { f: 150, name: 'frame_002_hook_question.png' },
  { f: 300, name: 'frame_003_mie_scattering.png' },
  { f: 550, name: 'frame_004_thickness.png' },
  { f: 850, name: 'frame_005_multiple_scattering.png' },
  { f: 1150, name: 'frame_006_airplane_view.png' },
  { f: 1280, name: 'frame_007_recap.png' },
  { f: 1480, name: 'frame_008_interactive_question.png' },
];

console.log('=== Rendering Cloud QA Frames ===');

for (const { f, name } of frames) {
  const outPath = resolve(qaDir, name);
  console.log(`Rendering frame ${f} -> ${name}...`);
  execFileSync('npx', [
    'remotion', 'still',
    'src/index.ts',
    'LuminaExactCloudClone',
    outPath,
    `--frame=${f}`,
    '--browser-executable=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ], {
    cwd: resolve(root, 'apps/worker'),
    stdio: 'inherit',
    shell: true
  });
}

console.log('✓ All Cloud QA Frames Rendered Successfully in', qaDir);

