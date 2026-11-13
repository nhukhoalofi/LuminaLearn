import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const scenes = [
  {
    id: 'scene_1',
    startSec: 0.0,
    endSec: 4.0,
    text: 'Vì sao sau cơn mưa lại xuất hiện cầu vồng rực rỡ trên bầu trời?'
  },
  {
    id: 'scene_2',
    startSec: 4.0,
    endSec: 8.0,
    text: 'Sau cơn mưa, trong không khí có vô số giọt nước li ti trôi lơ lửng.'
  },
  {
    id: 'scene_3',
    startSec: 8.0,
    endSec: 15.0,
    text: 'Khi ánh sáng mặt trời chiếu qua giọt nước, hiện tượng tán sắc xảy ra. Ánh sáng trắng gồm bảy sắc màu chính.'
  },
  {
    id: 'scene_4',
    startSec: 15.0,
    endSec: 29.67,
    text: 'Mỗi giọt nước như một lăng kính tí hon. Ánh sáng đi vào bị khúc xạ, phản xạ toàn phần ở mặt sau rồi khúc xạ ra ngoài.'
  },
  {
    id: 'scene_5',
    startSec: 29.67,
    endSec: 39.33,
    text: 'Góc lệch giữa tia tới và tia ló là khoảng 42 độ đối với màu đỏ, và 40 độ đối với màu tím.'
  },
  {
    id: 'scene_6',
    startSec: 39.33,
    endSec: 49.33,
    text: 'Hàng triệu giọt nước cùng phản xạ ánh sáng về mắt người quan sát dưới góc nhìn này.'
  },
  {
    id: 'scene_7',
    startSec: 49.33,
    endSec: 58.87,
    text: 'Tập hợp các tia sáng đó tạo nên hình vòng cung tuyệt đẹp trên bầu trời, đó chính là cầu vồng.'
  }
];

const outDir = resolve(process.cwd(), 'outputs/dutai_audio');
mkdirSync(outDir, { recursive: true });

async function synthesizeScene(scene) {
  const filePath = resolve(outDir, `${scene.id}.wav`);
  console.log(`[DUTAI TTS] Synthesizing ${scene.id}: "${scene.text}"...`);

  const response = await fetch('https://tts.dutai.io.vn/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'zerotts',
      input: scene.text,
      voice: 'baotrang',
      response_format: 'wav',
      speed: 1.0,
      stream: false,
      normalize_text: true
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DUTAI TTS failed (${response.status}): ${errText}`);
  }

  const arrayBuf = await response.arrayBuffer();
  writeFileSync(filePath, Buffer.from(arrayBuf));

  // ffprobe probe
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
  console.log(`✓ ${scene.id} synthesized: ${dur.toFixed(2)}s, ${probe.format.size} bytes, sample_rate=${probe.streams[0].sample_rate}`);
  return { ...scene, filePath, duration: dur };
}

async function main() {
  const results = [];
  for (const scene of scenes) {
    const res = await synthesizeScene(scene);
    results.push(res);
  }

  console.log('\nAll 7 scenes synthesized successfully with voice Bảo Trang!');

  // Combine into single 58.9s audio track with precise timeline placement
  // Using ffmpeg complex filter with adelay to position each scene at scene.startSec
  const totalDuration = 58.87;
  const masterAudioPath = resolve(process.cwd(), 'outputs/rainbow_dutai_baotrang.wav');

  const filterInputs = results.map((r, i) => `[${i}:a]adelay=${Math.round(r.startSec * 1000)}|${Math.round(r.startSec * 1000)}[a${i}]`).join(';');
  const mixInputs = results.map((_, i) => `[a${i}]`).join('');
  const complexFilter = `${filterInputs};${mixInputs}amix=inputs=${results.length}:duration=longest:dropout_transition=0,volume=1.8[out]`;

  const ffmpegArgs = [];
  for (const r of results) {
    ffmpegArgs.push('-i', r.filePath);
  }
  ffmpegArgs.push(
    '-filter_complex', complexFilter,
    '-map', '[out]',
    '-t', totalDuration.toString(),
    '-ar', '48000',
    '-ac', '2',
    '-y',
    masterAudioPath
  );

  console.log(`[FFmpeg] Mixing 7 segments into ${masterAudioPath}...`);
  execFileSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });

  const finalProbe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    masterAudioPath
  ], { encoding: 'utf-8' }));

  console.log('\n=== Master Audio Probe Result ===');
  console.log(`File: ${masterAudioPath}`);
  console.log(`Duration: ${finalProbe.format.duration}s`);
  console.log(`Sample Rate: ${finalProbe.streams[0].sample_rate} Hz`);
  console.log(`Channels: ${finalProbe.streams[0].channels}`);
  console.log(`Size: ${finalProbe.format.size} bytes`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

