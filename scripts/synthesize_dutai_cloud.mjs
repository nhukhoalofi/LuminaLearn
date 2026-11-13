import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const scriptLines = [
  {
    id: 'line_01_intro',
    targetStartSec: 0.2,
    text: 'Một trăm hiện tượng vật lý mỗi ngày, ngày 14.'
  },
  {
    id: 'line_02_hook',
    targetStartSec: 3.3,
    text: 'Vì sao mây thường màu trắng nhưng mây giông lại xám đen?'
  },
  {
    id: 'line_03_mie',
    targetStartSec: 6.5,
    text: 'Mây là hàng tỷ giọt nước li ti. Các giọt nước tán xạ mọi màu ánh sáng như nhau, gộp lại nên mây có màu trắng.'
  },
  {
    id: 'line_04_thickness',
    targetStartSec: 13.8,
    text: 'Mây thường khá mỏng, ánh sáng dễ dàng xuyên qua. Còn mây giông dày tới cả chục ki-lô-mét, nên ánh sáng rất khó xuyên xuống tới đáy mây.'
  },
  {
    id: 'line_05_multiple_scattering',
    targetStartSec: 23.0,
    text: 'Trong đám mây dày, ánh sáng bị các giọt nước hất đi hất lại liên tục và phần lớn bị hất ngược lên trên. Chỉ rất ít ánh sáng xuống được tới đáy, nên nhìn từ dưới lên đáy mây xám đen.'
  },
  {
    id: 'line_06_airplane',
    targetStartSec: 33.5,
    text: 'Thú vị là nếu nhìn từ máy bay xuống, mây giông vẫn trắng sáng rực rỡ. Mây không hề đen, chỉ là ta đứng phía dưới trong bóng râm của chính nó.'
  },
  {
    id: 'line_07_recap',
    targetStartSec: 40.5,
    text: 'Nhớ nhé: Mây mỏng thì trắng, mây dày thì đáy xám đen.'
  },
  {
    id: 'line_08_question',
    targetStartSec: 44.2,
    text: 'Câu hỏi cho bạn: Vì sao thấy mây đen kéo đến là biết sắp mưa?'
  },
  {
    id: 'line_09_cta',
    targetStartSec: 48.8,
    text: 'Comment đáp án nhé!'
  }
];

const outDir = resolve(process.cwd(), 'outputs/dutai_audio_cloud');
mkdirSync(outDir, { recursive: true });

async function synthesizeLine(line) {
  const filePath = resolve(outDir, `${line.id}.wav`);
  if (!existsSync(filePath)) {
    console.log(`[DUTAI TTS] Synthesizing ${line.id}: "${line.text}"...`);
    const response = await fetch('https://tts.dutai.io.vn/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'zerotts',
        input: line.text,
        voice: 'baotrang',
        response_format: 'wav',
        speed: 1.05,
        stream: false,
        normalize_text: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DUTAI TTS error (${response.status}): ${errText}`);
    }

    const arrayBuf = await response.arrayBuffer();
    writeFileSync(filePath, Buffer.from(arrayBuf));
  } else {
    console.log(`[DUTAI TTS] Reusing cached ${line.id}.wav`);
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
  console.log(`✓ ${line.id}: ${dur.toFixed(2)}s`);
  return { ...line, filePath, duration: dur };
}

async function main() {
  console.log('=== Synthesizing DUTAI ZeroTTS for Video 5 (Cloud Physics) ===\n');
  const results = [];
  for (const line of scriptLines) {
    const res = await synthesizeLine(line);
    results.push(res);
  }

  // Pacing adjustments to avoid overlap and preserve natural breath pauses
  let currentSec = results[0].targetStartSec;
  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    item.startSec = Math.max(item.targetStartSec, currentSec);
    currentSec = item.startSec + item.duration + 0.30;
  }

  for (const r of results) {
    console.log(`- ${r.id}: [${r.startSec.toFixed(2)}s - ${(r.startSec + r.duration).toFixed(2)}s] (dur: ${r.duration.toFixed(2)}s)`);
  }

  // Exact 53.30s total duration matching 1599 frames @ 30fps
  const totalVoiceDuration = 53.30;
  console.log(`\nMaster duration: ${totalVoiceDuration.toFixed(2)}s (1599 frames @ 30fps)`);

  writeFileSync(
    resolve('outputs/dutai_audio_cloud/lines_meta.json'),
    JSON.stringify({ totalVoiceDuration, lines: results }, null, 2),
    'utf8'
  );

  // Mix voice master
  const masterVoiceWav = resolve(process.cwd(), 'outputs/cloud_voice_master.wav');
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

  console.log('[FFmpeg] Mixing voice with BGM (volume=0.12, fade in/out, full 53.30s)...');
  execFileSync('ffmpeg', [
    '-y',
    '-i', masterVoiceWav,
    '-ss', '16',
    '-t', totalVoiceDuration.toFixed(2),
    '-i', bgmRaw,
    '-filter_complex',
    `[1:a]volume=0.12,afade=t=in:ss=0:d=1.5,afade=t=out:st=${(totalVoiceDuration - 2.5).toFixed(2)}:d=2.0[bgm];` +
    `[0:a]volume=1.0,apad=whole_dur=${totalVoiceDuration.toFixed(2)}[voice];` +
    '[voice][bgm]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[out]',
    '-map', '[out]',
    '-t', totalVoiceDuration.toFixed(2),
    '-ar', '48000',
    '-ac', '2',
    finalMixedAudio
  ], { stdio: 'inherit' });

  console.log('✓ Successfully created final audio track:', finalMixedAudio);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

