import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const scriptLines = [
  {
    id: 'line_01_hook',
    targetStartSec: 0.8,
    text: 'Vì sao lon nước lạnh lại đổ mồ hôi?'
  },
  {
    id: 'line_02_misconception',
    targetStartSec: 4.8,
    text: 'Nhiều bạn nghĩ nước thấm từ trong lon ra?'
  },
  {
    id: 'line_03_refutation',
    targetStartSec: 8.5,
    text: 'Sai! Lon vẫn kín, và nước trên thành lon cũng chẳng hề có vị ngọt.'
  },
  {
    id: 'line_04_vapor',
    targetStartSec: 13.8,
    text: 'Thật ra, không khí quanh ta luôn chứa hơi nước, chỉ là mắt ta không nhìn thấy.'
  },
  {
    id: 'line_05_mechanism',
    targetStartSec: 19.5,
    text: 'Khi lớp không khí sát thành lon bị làm lạnh, hơi nước trong đó ngưng tụ lại, bám lên thành lon thành những giọt nước li ti.'
  },
  {
    id: 'line_06_capacity_30c',
    targetStartSec: 28.0,
    text: 'Vì không khí càng lạnh càng chứa được ít hơi nước. Ở 30 độ C, một mét khối không khí chứa được khoảng 30 gam hơi nước.'
  },
  {
    id: 'line_07_capacity_5c',
    targetStartSec: 36.0,
    text: 'Ở 5 độ C chỉ còn khoảng 7 gam, phần dư ra sẽ ngưng tụ thành nước.'
  },
  {
    id: 'line_08_nom_wind',
    targetStartSec: 41.5,
    text: 'Trời nồm ở miền Bắc cũng vậy, gió ẩm ấm thổi vào nhà, gặp tường và sàn còn lạnh.'
  },
  {
    id: 'line_09_nom_wet',
    targetStartSec: 48.0,
    text: 'Hơi nước ngưng tụ khiến sàn nhà ướt nhẹp như đổ mồ hôi.'
  },
  {
    id: 'line_10_recap',
    targetStartSec: 53.0,
    text: 'Nhớ nhé, hơi nước gặp lạnh sẽ ngưng tụ thành nước.'
  },
  {
    id: 'line_11_question',
    targetStartSec: 57.2,
    text: 'Câu hỏi cho bạn: Vì sao từ phòng điều hòa bước ra ngoài trời nóng, kính cận lại bị mờ?'
  }
];

const outDir = resolve(process.cwd(), 'outputs/dutai_condensation_lines');
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
    console.log(`[DUTAI TTS] Reusing existing ${line.id}.wav`);
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
  const results = [];
  for (const line of scriptLines) {
    const res = await synthesizeLine(line);
    results.push(res);
  }

  console.log('\nAll 11 lines verified with Bảo Trang!');

  // Adjust timings dynamically with natural pacing and no overlap
  let currentSec = results[0].targetStartSec;
  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    item.startSec = Math.max(item.targetStartSec, currentSec);
    currentSec = item.startSec + item.duration + 0.35; // 350ms natural pause
  }

  for (const r of results) {
    console.log(`- ${r.id}: starts at ${r.startSec.toFixed(2)}s, dur ${r.duration.toFixed(2)}s, ends at ${(r.startSec + r.duration).toFixed(2)}s`);
  }

  // Exact 64.0s total duration to match 1920 frames @ 30fps
  const totalVoiceDuration = 64.0;
  console.log(`Master duration: ${totalVoiceDuration.toFixed(2)}s`);

  // Save metadata
  writeFileSync(
    resolve('outputs/dutai_condensation_lines/lines_meta.json'),
    JSON.stringify({ totalVoiceDuration, lines: results }, null, 2),
    'utf8'
  );

  // Mix voice master:
  // CRITICAL FIX: normalize=0 prevents amix from dynamically boosting later lines when earlier inputs finish!
  // Then loudnorm provides uniform, standard broadcast loudness (-16 LUFS) across the entire video.
  const masterVoiceWav = resolve(process.cwd(), 'outputs/condensation_voice_master.wav');
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

  console.log(`\n[FFmpeg] Mixing ${results.length} speech segments into ${masterVoiceWav} (with normalize=0 + loudnorm)...`);
  execFileSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });

  // Mix with YouTube signature BGM (starts from second 16)
  const bgmRaw = resolve(process.cwd(), 'outputs/bgm_raw.mp3');
  const finalMixedAudio = resolve(process.cwd(), 'outputs/condensation_final_audio_with_bgm.wav');

  console.log('[FFmpeg] Mixing voice with BGM (from sec 16, volume=0.12, normalize=0)...');
  execFileSync('ffmpeg', [
    '-y',
    '-i', masterVoiceWav,
    '-ss', '16',
    '-t', totalVoiceDuration.toFixed(2),
    '-i', bgmRaw,
    '-filter_complex',
    `[1:a]volume=0.12,afade=t=in:ss=0:d=1.5,afade=t=out:st=${(totalVoiceDuration - 2.5).toFixed(2)}:d=2.0[bgm];` +
    '[0:a]volume=1.0[voice];' +
    '[voice][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]',
    '-map', '[out]',
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
