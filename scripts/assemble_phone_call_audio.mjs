import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const scenesMeta = JSON.parse(readFileSync('outputs/dutai_phone_audio/scenes_meta.json', 'utf8'));

// Total duration target: 86.000 seconds (2580 frames @ 30 FPS)
const TOTAL_DURATION = 86.000;

// Compute scene start times
// 10 scenes (scene_01_intro removed)
const sceneTimings = [
  { id: 'scene_02_hook', startSec: 0.2 },
  { id: 'scene_03_chain', startSec: 6.8 },
  { id: 'scene_04_step1_mic', startSec: 14.8 },
  { id: 'scene_05_step2_dsp', startSec: 22.3 },
  { id: 'scene_06_step3_tx_ant', startSec: 30.0 },
  { id: 'scene_07_step4_network', startSec: 39.8 },
  { id: 'scene_08_step5_rx_ant', startSec: 47.8 },
  { id: 'scene_09_step6_speaker', startSec: 57.8 },
  { id: 'scene_10_duplex', startSec: 67.3 },
  { id: 'scene_11_outro', startSec: 75.3 }
];

console.log('=== Assembling Master Voice Track for Video 2 ===');

// Build FFmpeg complex filter to place each speech file at its exact timestamp
const inputs = [];
const filterParts = [];

sceneTimings.forEach((timing, index) => {
  const filePath = resolve('outputs/dutai_phone_audio', `${timing.id}.wav`);
  inputs.push('-i', filePath);
  const delayMs = Math.round(timing.startSec * 1000);
  // Soften outro comment slightly
  const volFilter = timing.id === 'scene_11_outro' ? ',volume=0.88' : '';
  filterParts.push(`[${index}:a]adelay=${delayMs}|${delayMs}${volFilter},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[s${index}]`);
});

// Mix inputs and add a silent generator to ensure exact duration 89.333s
const silentInput = `aevalsrc=0:d=${TOTAL_DURATION}:s=48000:c=stereo[silence]`;
const mixInputs = sceneTimings.map((_, i) => `[s${i}]`).join('') + '[silence]';
const filterComplex = `${filterParts.join(';')};${silentInput};${mixInputs}amix=inputs=${sceneTimings.length + 1}:dropout_transition=0:normalize=0[voice_out]`;

const voiceMasterPath = resolve('outputs/phone_call_voice_master.wav');

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

console.log('✓ Created voice master:', voiceMasterPath);

// Now mix with YouTube BGM (from second 16)
console.log('=== Mixing Voice Master with YouTube BGM (starts at second 16) ===');
const bgmPath = resolve('outputs/bgm_raw.mp3');
const finalAudioPath = resolve('outputs/phone_call_final_audio_with_bgm.wav');

const mixFilter = [
  '[0:a]volume=1.0[voice]',
  `[1:a]atrim=start=16.0:end=${16.0 + TOTAL_DURATION},asetpts=PTS-STARTPTS,volume=0.10,afade=t=in:ss=0:d=1.5,afade=t=out:st=${TOTAL_DURATION - 3.0}:d=3.0[bgm]`,
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

console.log('✓ Successfully created final mixed audio:', finalAudioPath);

// Probe final audio
const probeResult = execFileSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'format=duration,size',
  '-of', 'json',
  finalAudioPath
], { encoding: 'utf8' });

console.log('Final Audio Probe:');
console.log(probeResult);
