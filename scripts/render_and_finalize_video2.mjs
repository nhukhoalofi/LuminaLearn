import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';

const root = process.cwd();
const rawVideoPath = resolve(root, 'outputs/phone_call_raw.mp4');
const audioWavPath = resolve(root, 'outputs/phone_call_final_audio_with_bgm.wav');
const finalMp4Path = resolve(root, 'outputs/phone_call_exact_clone.mp4');
const webPublicMp4 = resolve(root, 'apps/web/public/demo/phone-call-exact-clone.mp4');
const qaDir = resolve(root, 'outputs/clone2_final_qa');

mkdirSync(qaDir, { recursive: true });

console.log('=== Step 1: Rendering Raw Video with Remotion ===');
console.log('Composition: LuminaExactPhoneCallClone (2680 frames @ 30 FPS = 89.333s, 1080x1920)');

const renderResult = spawnSync('npx.cmd', [
  'remotion', 'render',
  'src/index.ts',
  'LuminaExactPhoneCallClone',
  rawVideoPath,
  '--browser-executable=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
], {
  cwd: resolve(root, 'apps/worker'),
  stdio: 'inherit',
  shell: true
});

if (renderResult.error || renderResult.status !== 0) {
  console.error('Rendering failed!', renderResult.error);
  process.exit(1);
}

console.log('✓ Successfully rendered raw video to:', rawVideoPath);

console.log('\n=== Step 2: Muxing with DUTAI TTS Voice + YouTube BGM Master Audio ===');
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

// Copy to web public demo directory for easy web preview
try {
  mkdirSync(resolve(root, 'apps/web/public/demo'), { recursive: true });
  copyFileSync(finalMp4Path, webPublicMp4);
  console.log('✓ Copied to web public demo:', webPublicMp4);
} catch (e) {
  console.warn('Could not copy to web public demo:', e.message);
}

console.log('\n=== Step 3: Probing Final MP4 ===');
const probeOutput = execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels',
  '-show_entries', 'format=duration,size,bit_rate',
  '-of', 'json',
  finalMp4Path
], { encoding: 'utf-8' });

console.log(probeOutput);

console.log('\n=== Step 4: Extracting Final QA Frames from Final MP4 ===');
const checkTimes = [
  { t: '00:00:01.667', name: '01_intro' },
  { t: '00:00:06.667', name: '02_hook' },
  { t: '00:00:13.333', name: '03_chain' },
  { t: '00:00:21.667', name: '04_micro' },
  { t: '00:00:29.333', name: '05_dsp' },
  { t: '00:00:38.333', name: '06_tx_antenna' },
  { t: '00:00:46.667', name: '07_network' },
  { t: '00:00:56.000', name: '08_rx_antenna' },
  { t: '00:00:66.000', name: '09_speaker' },
  { t: '00:00:75.000', name: '10_duplex' },
  { t: '00:00:83.333', name: '11_outro' }
];

for (const { t, name } of checkTimes) {
  const outPng = resolve(qaDir, `qa_${name}.png`);
  execFileSync('ffmpeg', [
    '-y',
    '-ss', t,
    '-i', finalMp4Path,
    '-vframes', '1',
    outPng
  ]);
  console.log(`✓ Saved frame at ${t} -> ${outPng}`);
}

console.log('\n=== All Operations Completed Successfully! ===');

