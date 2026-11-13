import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, copyFileSync } from 'node:fs';

const root = process.cwd();
const rawVideoPath = resolve(root, 'outputs/seasons_raw.mp4');
const audioWavPath = resolve(root, 'outputs/seasons_final_audio_with_bgm.wav');
const finalMp4Path = resolve(root, 'outputs/seasons_exact_clone.mp4');
const webPublicMp4 = resolve(root, 'apps/web/public/demo/seasons-exact-clone.mp4');
const thumbPath = resolve(root, 'apps/web/public/demo/thumb-seasons-frame.png');
const qaDir = resolve(root, 'outputs/seasons_final_qa');

mkdirSync(qaDir, { recursive: true });
mkdirSync(resolve(root, 'apps/web/public/demo'), { recursive: true });

console.log('=== Step 1: Rendering Clean Raw Video with Remotion ===');
console.log('Composition: LuminaExactEarthSeasonsClone (1680 frames @ 30 FPS = 56.0s, 1080x1920)');

execFileSync('npx', [
  'remotion', 'render',
  'src/index.ts',
  'LuminaExactEarthSeasonsClone',
  rawVideoPath,
  '--concurrency=2',
  '--browser-executable="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'
], {
  cwd: resolve(root, 'apps/worker'),
  stdio: 'inherit',
  shell: true
});

console.log('✓ Successfully rendered raw video:', rawVideoPath);

console.log('\n=== Step 2: Muxing with Clean DUTAI TTS Voice + Signature Background Audio ===');
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

copyFileSync(finalMp4Path, webPublicMp4);
console.log('✓ Copied to web public demo:', webPublicMp4);

console.log('\n=== Step 3: Extracting QA Keyframe Images & Thumbnail ===');
const qaFrames = [
  { name: 'scene1_question_reveal.png', ss: '00:00:02.000' },
  { name: 'scene2_misconception_debunk.png', ss: '00:00:08.000' },
  { name: 'scene3_axial_tilt_orbit.png', ss: '00:00:18.000' },
  { name: 'scene4_angle_flux_concentrated.png', ss: '00:00:30.000' },
  { name: 'scene5_hanoi_day_night.png', ss: '00:00:42.000' },
  { name: 'scene6_summary_recap.png', ss: '00:00:48.500' },
  { name: 'scene7_challenge_quiz.png', ss: '00:00:53.000' }
];

for (const q of qaFrames) {
  const dest = resolve(qaDir, q.name);
  execFileSync('ffmpeg', [
    '-y',
    '-ss', q.ss,
    '-i', finalMp4Path,
    '-vframes', '1',
    dest
  ], { stdio: 'inherit' });
  console.log(`  -> QA frame extracted: ${q.name}`);
}

// Generate Album Thumbnail (from 2.0s question card)
execFileSync('ffmpeg', [
  '-y',
  '-ss', '00:00:02.000',
  '-i', finalMp4Path,
  '-vframes', '1',
  thumbPath
], { stdio: 'inherit' });
console.log('✓ Album thumbnail extracted:', thumbPath);

console.log('\n=== Step 4: Probing Final MP4 Metadata ===');
const probe = execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels',
  '-show_entries', 'format=duration,size,bit_rate',
  '-of', 'json',
  finalMp4Path
], { encoding: 'utf-8' });

console.log(probe);
console.log('\n⭐ Clean Earth Seasons Master Video Successfully Rendered & Verified! ⭐');
