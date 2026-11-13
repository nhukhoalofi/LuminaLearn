import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = process.cwd();
const outDir = resolve(root, 'outputs/clone2_qa_frames');
mkdirSync(outDir, { recursive: true });

const frames = [
  { f: 50, name: 'scene_01_intro' },
  { f: 200, name: 'scene_02_hook' },
  { f: 400, name: 'scene_03_chain' },
  { f: 650, name: 'scene_04_micro' },
  { f: 880, name: 'scene_05_dsp' },
  { f: 1150, name: 'scene_06_tx_antenna' },
  { f: 1400, name: 'scene_07_network' },
  { f: 1680, name: 'scene_08_rx_antenna' },
  { f: 1980, name: 'scene_09_speaker' },
  { f: 2250, name: 'scene_10_duplex' },
  { f: 2500, name: 'scene_11_outro' },
];

console.log('Rendering QA frames for Video 2...');

for (const { f, name } of frames) {
  const outPath = resolve(outDir, `frame_${f}_${name}.png`);
  console.log(`Rendering frame ${f} (${name})...`);
  execFileSync('pnpm.cmd', [
    '--filter', '@luminalearn/worker',
    'exec', 'remotion', 'still',
    'src/index.ts',
    'LuminaExactPhoneCallClone',
    outPath,
    `--frame=${f}`,
    '--browser-executable', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  ], { stdio: 'inherit' });
}

console.log('\nAll QA frames rendered successfully!');
