import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const scriptLines = [
  {
    id: 'line_01',
    startSec: 0.8,
    text: 'Vì sao sau cơn mưa lại có cầu vồng?'
  },
  {
    id: 'line_02',
    startSec: 4.2,
    text: 'Ánh sáng mặt trời trông màu trắng, nhưng thật ra là hỗn hợp của nhiều màu.'
  },
  {
    id: 'line_03',
    startSec: 8.5,
    text: 'Cho đi qua lăng kính, nó tách ra thành dải màu: đỏ, cam, vàng, lục, lam, chàm, tím.'
  },
  {
    id: 'line_04',
    startSec: 15.2,
    text: 'Mỗi giọt mưa giống như một lăng kính tí hon.'
  },
  {
    id: 'line_05',
    startSec: 17.5,
    text: 'Ánh sáng đi vào giọt nước bị khúc xạ, phản xạ ở mặt sau, rồi khúc xạ lần nữa khi đi ra.'
  },
  {
    id: 'line_06',
    startSec: 23.0,
    text: 'Mỗi màu bị lệch một góc khác nhau nên tách ra thành dải màu. Đó là hiện tượng tán sắc.'
  },
  {
    id: 'line_07',
    startSec: 28.5,
    text: 'Khi mặt trời ở sau lưng, hàng triệu giọt mưa phía trước cùng gửi ánh sáng tới mắt bạn.'
  },
  {
    id: 'line_08',
    startSec: 33.5,
    text: 'Giọt ở cao gửi tới màu đỏ, giọt thấp hơn gửi màu tím. Ghép lại ta thấy cầu vồng.'
  },
  {
    id: 'line_09',
    startSec: 38.8,
    text: 'Thật ra cầu vồng là một vòng tròn, cách bóng của chính bạn khoảng 42 độ.'
  },
  {
    id: 'line_10',
    startSec: 43.0,
    text: 'Mặt đất che mất nửa dưới nên ta chỉ thấy một vòng cung. Nhìn từ máy bay, có thể thấy cả vòng tròn.'
  },
  {
    id: 'line_11',
    startSec: 48.8,
    text: 'Nhớ nhé, ánh sáng trắng gặp giọt mưa sẽ tán sắc thành cầu vồng.',
    volume: 1.0
  },
  {
    id: 'line_12a',
    startSec: 52.8,
    text: 'Câu hỏi cho bạn: Vì sao giữa trưa gần như không bao giờ thấy cầu vồng?',
    volume: 0.85
  }
];

const outDir = resolve(process.cwd(), 'outputs/dutai_exact_lines');
mkdirSync(outDir, { recursive: true });

async function synthesizeLine(line) {
  const filePath = resolve(outDir, `${line.id}.wav`);
  console.log(`[DUTAI TTS] Synthesizing ${line.id} (${line.startSec}s): "${line.text}"...`);

  const response = await fetch('https://tts.dutai.io.vn/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'zerotts',
      input: line.text,
      voice: 'baotrang',
      response_format: 'wav',
      speed: 1.05, // Slightly brisk conversational pacing matching video
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
  console.log(`✓ ${line.id}: ${dur.toFixed(2)}s (starts at ${line.startSec}s)`);
  return { ...line, filePath, duration: dur };
}

async function main() {
  const results = [];
  for (const line of scriptLines) {
    const res = await synthesizeLine(line);
    results.push(res);
  }

  console.log('\nAll 12 lines synthesized successfully with Bảo Trang!');

  // Check timing overlaps
  for (let i = 0; i < results.length - 1; i++) {
    const cur = results[i];
    const nxt = results[i + 1];
    const curEnd = cur.startSec + cur.duration;
    if (curEnd > nxt.startSec) {
      console.warn(`[Timing notice] ${cur.id} ends at ${curEnd.toFixed(2)}s, while ${nxt.id} starts at ${nxt.startSec}s (overlap ${(curEnd - nxt.startSec).toFixed(2)}s). Adjusting next startSec...`);
      nxt.startSec = curEnd + 0.15; // 150ms natural breath pause
    }
  }

  const masterVoiceWav = resolve(process.cwd(), 'outputs/rainbow_voice_exact_baotrang.wav');
  const filterInputs = results.map((r, i) => {
    const vol = r.volume ?? 1.0;
    return `[${i}:a]volume=${vol},adelay=${Math.round(r.startSec * 1000)}|${Math.round(r.startSec * 1000)}[a${i}]`;
  }).join(';');
  const mixInputs = results.map((_, i) => `[a${i}]`).join('');
  const complexFilter = `${filterInputs};${mixInputs}amix=inputs=${results.length}:duration=longest:dropout_transition=0,volume=1.8[out]`;

  const ffmpegArgs = [];
  for (const r of results) {
    ffmpegArgs.push('-i', r.filePath);
  }
  ffmpegArgs.push(
    '-filter_complex', complexFilter,
    '-map', '[out]',
    '-t', '58.87',
    '-ar', '48000',
    '-ac', '2',
    '-y',
    masterVoiceWav
  );

  console.log(`[FFmpeg] Mixing ${results.length} speech segments into ${masterVoiceWav}...`);
  execFileSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });

  // Now mix with Background Music from YouTube (second 16 onwards)
  // BGM should be mixed softly (~ -20dB to -22dB) so voice is loud, clear, and prominent
  const bgmRaw = resolve(process.cwd(), 'outputs/bgm_raw.mp3');
  const finalMixedAudio = resolve(process.cwd(), 'outputs/rainbow_final_audio_with_bgm.wav');

  console.log('[FFmpeg] Trimming BGM from sec 16 with subtle fade-in & fade-out and mixing with voice...');
  execFileSync('ffmpeg', [
    '-y',
    '-i', masterVoiceWav,
    '-ss', '16',
    '-t', '58.87',
    '-i', bgmRaw,
    '-filter_complex',
    '[1:a]volume=0.18,afade=t=in:ss=0:d=1.5,afade=t=out:st=56.5:d=2.0[bgm];' +
    '[0:a]volume=1.0[voice];' +
    '[voice][bgm]amix=inputs=2:duration=first:dropout_transition=0[out]',
    '-map', '[out]',
    '-ar', '48000',
    '-ac', '2',
    finalMixedAudio
  ], { stdio: 'inherit' });

  console.log('✓ Final combined audio with voice + YouTube BGM:', finalMixedAudio);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

