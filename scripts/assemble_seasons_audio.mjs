import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Total duration target: 56.000 seconds (1680 frames @ 30 FPS)
// Clean version without "100 hiện tượng" intro, without "ngày 15/100", and without "comment đáp án"
const TOTAL_DURATION = 56.000;

const sceneTimings = [
  { id: 'scene_2', file: 'scene_2.wav', startSec: 0.20 },
  { id: 'scene_3', file: 'scene_3.wav', startSec: 3.90 },
  { id: 'scene_4', file: 'scene_4.wav', startSec: 12.90 },
  { id: 'scene_5', file: 'scene_5.wav', startSec: 25.10 },
  { id: 'scene_6', file: 'scene_6.wav', startSec: 37.10 },
  { id: 'scene_7', file: 'scene_7.wav', startSec: 46.90 },
  { id: 'scene_8', file: 'scene_8_clean.wav', startSec: 50.60 }
];

console.log('=== Assembling Clean Master Voice Track (No 100 days intro, No comment prompt) ===');

const inputs = [];
const filterParts = [];

sceneTimings.forEach((timing, index) => {
  const filePath = resolve('outputs/dutai_audio_seasons', timing.file);
  inputs.push('-i', filePath);
  const delayMs = Math.round(timing.startSec * 1000);
  filterParts.push(`[${index}:a]adelay=${delayMs}|${delayMs},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[s${index}]`);
});

const silentInput = `aevalsrc=0:d=${TOTAL_DURATION}:s=48000:c=stereo[silence]`;
const mixInputs = sceneTimings.map((_, i) => `[s${i}]`).join('') + '[silence]';
const filterComplex = `${filterParts.join(';')};${silentInput};${mixInputs}amix=inputs=${sceneTimings.length + 1}:dropout_transition=0:normalize=0[voice_out]`;

const voiceMasterPath = resolve('outputs/seasons_voice_master.wav');

execFileSync('ffmpeg', [
  '-y',
  ...inputs,
  '-filter_complex', filterComplex,
  '-map', '[voice_out]',
  '-t', String(TOTAL_DURATION),
  '-ar', '48000',
  '-ac', '2',
  voiceMasterPath
], { stdio: 'inherit' });

console.log('✓ Created clean voice master:', voiceMasterPath);

// Mix with Signature BGM
console.log('=== Mixing Clean Voice Master with Signature Background Audio ===');
const bgmPath = resolve('outputs/bgm_raw.mp3');
const finalAudioPath = resolve('outputs/seasons_final_audio_with_bgm.wav');

const mixFilter = [
  '[0:a]volume=1.0[voice]',
  `[1:a]atrim=start=0.0:end=${TOTAL_DURATION},asetpts=PTS-STARTPTS,volume=0.12,afade=t=in:ss=0:d=1.5,afade=t=out:st=${TOTAL_DURATION - 2.5}:d=2.5[bgm]`,
  '[voice][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]'
].join(';');

execFileSync('ffmpeg', [
  '-y',
  '-i', voiceMasterPath,
  '-i', bgmPath,
  '-filter_complex', mixFilter,
  '-map', '[out]',
  '-t', String(TOTAL_DURATION),
  '-ar', '48000',
  '-ac', '2',
  finalAudioPath
], { stdio: 'inherit' });

console.log('✓ Successfully created final clean mixed audio:', finalAudioPath);
