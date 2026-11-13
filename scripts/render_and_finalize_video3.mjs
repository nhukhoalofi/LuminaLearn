import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = process.cwd();
const rawVideoPath = resolve(root, 'outputs/condensation_raw.mp4');
const audioWavPath = resolve(root, 'outputs/condensation_final_audio_with_bgm.wav');
const finalMp4Path = resolve(root, 'outputs/condensation_exact_clone.mp4');
const webPublicMp4 = resolve(root, 'apps/web/public/demo/condensation-exact-clone.mp4');
const qaDir = resolve(root, 'outputs/clone3_final_qa');

mkdirSync(qaDir, { recursive: true });
mkdirSync(resolve(root, 'apps/web/public/demo'), { recursive: true });

console.log('=== Step 1: Rendering Raw Video with Remotion ===');
console.log('Composition: LuminaExactCondensationClone (1920 frames @ 30 FPS = 64.0s, 1080x1920)');

execFileSync('npx', [
  'remotion', 'render',
  'src/index.ts',
  'LuminaExactCondensationClone',
  rawVideoPath,
  '--browser-executable=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
], {
  cwd: resolve(root, 'apps/worker'),
  stdio: 'inherit',
  shell: true
});

console.log('✓ Successfully rendered raw video:', rawVideoPath);

console.log('\n=== Step 2: Muxing with DUT AI TTS Voice + YouTube Signature BGM Master Audio ===');
execFileSync('ffmpeg', [
  '-y',
  '-i', rawVideoPath,
  '-i', audioWavPath,
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',
  '-shortest',
  finalMp4Path
], { stdio: 'inherit' });

console.log('✓ Successfully created final MP4:', finalMp4Path);

execFileSync('ffmpeg', [
  '-y',
  '-i', finalMp4Path,
  '-c', 'copy',
  webPublicMp4
], { stdio: 'inherit' });

console.log('✓ Copied to web public demo:', webPublicMp4);

console.log('\n=== Step 3: Probing Final MP4 ===');
const probe = execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels',
  '-show_entries', 'format=duration,size,bit_rate',
  '-of', 'json',
  finalMp4Path
], { encoding: 'utf-8' });
console.log(probe);

console.log('\n=== Step 4: Extracting Final QA Frames ===');
const checkTimes = [
  { t: '00:00:02.000', name: '01_hook_can' },
  { t: '00:00:06.000', name: '02_misconception_can_left' },
  { t: '00:00:10.000', name: '03_sai_cross_card' },
  { t: '00:00:16.000', name: '04_invisible_vapor' },
  { t: '00:00:22.000', name: '05_droplets_condensing' },
  { t: '00:00:30.000', name: '06_capacity_30c' },
  { t: '00:00:38.000', name: '07_capacity_5c_dripping' },
  { t: '00:00:44.000', name: '08_nom_wind_wall' },
  { t: '00:00:49.000', name: '09_nom_wet_floor' },
  { t: '00:00:54.000', name: '10_nho_nhe_card' },
  { t: '00:00:59.000', name: '11_outro_question_mascot' }
];

for (const item of checkTimes) {
  const outPng = resolve(qaDir, `qa_${item.name}.png`);
  execFileSync('ffmpeg', [
    '-y',
    '-ss', item.t,
    '-i', finalMp4Path,
    '-vframes', '1',
    outPng
  ]);
  console.log(`✓ Saved frame at ${item.t} -> ${outPng}`);
}

console.log('\nAll render and QA operations completed successfully!');

