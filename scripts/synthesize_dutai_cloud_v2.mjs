import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Lines without line_01_intro and without line_09_cta
const scriptLines = [
  {
    id: 'line_02_hook',
    targetStartSec: 0.6,
    text: 'Vì sao mây thường màu trắng nhưng mây giông lại xám đen?'
  },
  {
    id: 'line_03_mie',
    targetStartSec: 4.2,
    text: 'Mây là hàng tỷ giọt nước li ti. Các giọt nước tán xạ mọi màu ánh sáng như nhau, gộp lại nên mây có màu trắng.'
  },
  {
    id: 'line_04_thickness',
    targetStartSec: 10.6,
    text: 'Mây thường khá mỏng, ánh sáng dễ dàng xuyên qua. Còn mây giông dày tới cả chục ki-lô-mét, nên ánh sáng rất khó xuyên xuống tới đáy mây.'
  },
  {
    id: 'line_05_multiple_scattering',
    targetStartSec: 18.2,
    text: 'Trong đám mây dày, ánh sáng bị các giọt nước hất đi hất lại liên tục và phần lớn bị hất ngược lên trên. Chỉ rất ít ánh sáng xuống được tới đáy, nên nhìn từ dưới lên đáy mây xám đen.'
  },
  {
    id: 'line_06_airplane',
    targetStartSec: 28.2,
    text: 'Thú vị là nếu nhìn từ máy bay xuống, mây giông vẫn trắng sáng rực rỡ. Mây không hề đen, chỉ là ta đứng phía dưới trong bóng râm của chính nó.'
  },
  {
    id: 'line_07_recap',
    targetStartSec: 36.2,
    text: 'Nhớ nhé: Mây mỏng thì trắng, mây dày thì đáy xám đen.'
  },
  {
    id: 'line_08_question',
    targetStartSec: 40.0,
    text: 'Câu hỏi cho bạn: Vì sao thấy mây đen kéo đến là biết sắp mưa?'
  }
];

const cachedDir = resolve(process.cwd(), 'outputs/dutai_audio_cloud');

async function getAudioInfo(line) {
  const filePath = resolve(cachedDir, `${line.id}.wav`);
  if (!existsSync(filePath)) {
    throw new Error(`File ${filePath} does not exist`);
  }

  const probeOutput = execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    filePath
  ], { encoding: 'utf-8' });

  const probe = JSON.parse(probeOutput);
  const dur = parseFloat(probe.format.duration);
  return { ...line, filePath, duration: dur };
}

async function main() {
  console.log('=== Building Streamlined Audio (No 100 intro, No comment CTA) ===\n');
  const results = [];
  for (const line of scriptLines) {
    const res = await getAudioInfo(line);
    results.push(res);
  }

  // Pacing adjustments
  let currentSec = results[0].targetStartSec;
  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    item.startSec = Math.max(item.targetStartSec, currentSec);
    currentSec = item.startSec + item.duration + 0.35; // 350ms natural breath pause
  }

  for (const r of results) {
    console.log(`- ${r.id}: [${r.startSec.toFixed(2)}s - ${(r.startSec + r.duration).toFixed(2)}s] (dur: ${r.duration.toFixed(2)}s)`);
  }

  // Outro buffer of 2.8s after question
  const lastLine = results[results.length - 1];
  const totalVoiceDuration = 46.0; // 46.0s = exactly 1380 frames @ 30fps
  console.log(`\nMaster duration: ${totalVoiceDuration.toFixed(2)}s (1380 frames @ 30fps)`);

  writeFileSync(
    resolve('outputs/dutai_audio_cloud/lines_meta_v2.json'),
    JSON.stringify({ totalVoiceDuration, lines: results }, null, 2),
    'utf8'
  );

  // Mix voice master
  const masterVoiceWav = resolve(process.cwd(), 'outputs/cloud_voice_master_v2.wav');
  const filterInputs = results.map((r, i) => {
    const delay = Math.round(r.startSec * 1000);
    return `[${i}:a]adelay=${delay}|${delay}[a${i}]`;
  }).join(';');
  const mixInputs = results.map((_, i) => `[a${i}]`).join('');
  const complexFilter = `${filterInputs};${mixInputs}amix=inputs=${results.length}:duration=longest:dropout_transition=0:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;

  const ffmpegArgs = [];
  for (const r of results) {
    ffmpegArgs.push('-i', r.filePath);
  }
  ffmpegArgs.push(
    '-filter_complex', complexFilter,
    '-map', '[out]',
    '-t', totalVoiceDuration.toFixed(2),
    '-ar', '48000',
    '-ac', '2',
    '-y',
    masterVoiceWav
  );

  console.log(`\n[FFmpeg] Mixing ${results.length} speech segments into ${masterVoiceWav}...`);
  execFileSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });

  // Mix with BGM
  const bgmRaw = resolve(process.cwd(), 'outputs/bgm_raw.mp3');
  const finalMixedAudio = resolve(process.cwd(), 'outputs/cloud_final_audio_with_bgm.wav');

  console.log('[FFmpeg] Mixing voice with BGM (volume=0.12, fade out at end)...');
  execFileSync('ffmpeg', [
    '-y',
    '-i', masterVoiceWav,
    '-ss', '16',
    '-t', totalVoiceDuration.toFixed(2),
    '-i', bgmRaw,
    '-filter_complex',
    `[1:a]volume=0.12,afade=t=in:ss=0:d=1.0,afade=t=out:st=${(totalVoiceDuration - 2.0).toFixed(2)}:d=1.8[bgm];` +
    `[0:a]volume=1.0,apad=whole_dur=${totalVoiceDuration.toFixed(2)}[voice];` +
    '[voice][bgm]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[out]',
    '-map', '[out]',
    '-t', totalVoiceDuration.toFixed(2),
    '-ar', '48000',
    '-ac', '2',
    finalMixedAudio
  ], { stdio: 'inherit' });

  console.log('✓ Successfully created v2 final audio track:', finalMixedAudio);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
