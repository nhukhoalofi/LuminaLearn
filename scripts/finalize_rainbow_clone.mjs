import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const root = process.cwd();
const rawVideo = resolve(root, 'outputs/rainbow-clone-raw.mp4');
const audioWav = resolve(root, 'outputs/rainbow_final_audio_with_bgm.wav');
const finalMp4 = resolve(root, 'outputs/rainbow-exact-clone.mp4');
const qaFramesDir = resolve(root, 'outputs/clone_qa_frames');

mkdirSync(qaFramesDir, { recursive: true });

console.log('[Muxing] Muxing video and audio into final MP4...');
execFileSync('ffmpeg', [
  '-y',
  '-i', rawVideo,
  '-i', audioWav,
  '-c:v', 'copy',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-ar', '48000',
  finalMp4
], { stdio: 'inherit' });

console.log('✓ Successfully created:', finalMp4);

// Probe final MP4
const probeJson = execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels',
  '-show_entries', 'format=duration,size',
  '-of', 'json',
  finalMp4
], { encoding: 'utf-8' });

console.log('\n=== Final Video Probe Result ===');
console.log(probeJson);

// Run volumedetect
console.log('\n=== Audio Volume Detection ===');
try {
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-i', finalMp4,
    '-af', 'volumedetect',
    '-vn',
    '-f', 'null',
    '-'
  ], { stdio: 'inherit' });
} catch (e) {
  // volumedetect outputs to stderr which might be normal
}

// Extract QA frames
console.log('\n=== Extracting QA Frames ===');
const frames = [
  { f: 50, time: '00:00:01.667' },
  { f: 180, time: '00:00:06.000' },
  { f: 350, time: '00:00:11.667' },
  { f: 650, time: '00:00:21.667' },
  { f: 1150, time: '00:00:38.333' },
  { f: 1400, time: '00:00:46.667' },
  { f: 1480, time: '00:00:49.333' },
  { f: 1650, time: '00:00:55.000' }
];

for (const { f, time } of frames) {
  const outPng = resolve(qaFramesDir, `qa_frame_${f}.png`);
  execFileSync('ffmpeg', [
    '-y',
    '-ss', time,
    '-i', finalMp4,
    '-vframes', '1',
    outPng
  ]);
  console.log(`✓ Saved frame ${f} (${time}) -> ${outPng}`);
}

console.log('\nAll QA verification complete!');

