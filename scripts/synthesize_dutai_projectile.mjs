import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const scenes = [
  {
    id: 'scene_1',
    startSec: 0.0,
    endSec: 6.0,
    text: 'Tại sao khi ném một vật theo phương ngang, vật lại rơi theo quỹ đạo cong parabol chứ không bay thẳng?'
  },
  {
    id: 'scene_2',
    startSec: 6.0,
    endSec: 16.0,
    text: 'Bí mật của Galileo: Chuyển động ném ngang được phân tích thành hai chuyển động hoàn toàn độc lập trên hai trục Ox và Oy.'
  },
  {
    id: 'scene_3',
    startSec: 16.0,
    endSec: 28.0,
    text: 'Thí nghiệm đồng thời: Một vật ném ngang và một vật thả rơi tự do từ cùng độ cao sẽ chạm đất cùng một thời điểm.'
  },
  {
    id: 'scene_4',
    startSec: 28.0,
    endSec: 42.0,
    text: 'Từ phương trình tọa độ, ta rút ra phương trình quỹ đạo: y bằng g chia hai v không bình phương nhân x bình phương, chính là đường cong parabol.'
  },
  {
    id: 'scene_5',
    startSec: 42.0,
    endSec: 52.0,
    text: 'Tầm ném xa L bằng v không nhân căn bậc hai của hai h chia g. Muốn ném xa hơn, ta cần tăng tốc độ ban đầu hoặc nâng cao vị trí ném.'
  },
  {
    id: 'scene_6',
    startSec: 52.0,
    endSec: 60.0,
    text: 'Tóm lại: ngang thẳng đều, dọc rơi tự do, quỹ đạo parabol! Bạn hãy thử giải: Bắn đạn và thả vỏ đạn cùng lúc, cái nào chạm đất trước?'
  }
];

const outDir = resolve(process.cwd(), 'outputs/dutai_audio_projectile');
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

  const probeOutput = execFileSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    filePath
  ], { encoding: 'utf-8' });

  const info = JSON.parse(probeOutput);
  console.log(`  -> Duration: ${info.format.duration}s (${info.streams[0].codec_name}, ${info.streams[0].sample_rate}Hz)`);
  return {
    ...scene,
    filePath,
    duration: parseFloat(info.format.duration)
  };
}

async function main() {
  console.log('=== Synthesizing DUTAI ZeroTTS Audio for Projectile Motion ===\n');
  const results = [];

  for (const scene of scenes) {
    const res = await synthesizeScene(scene);
    results.push(res);
  }

  const voiceMasterPath = resolve(process.cwd(), 'outputs/projectile_voice_master.wav');
  const finalAudioWithBgm = resolve(process.cwd(), 'outputs/projectile_final_audio_with_bgm.wav');
  const bgmPath = resolve(process.cwd(), 'outputs/bgm_raw.mp3');
  const totalDuration = 60.0;

  // Build FFmpeg complex filter to delay each scene to startSec
  const filterInputs = results.map((r, i) => `[${i}:a]adelay=${Math.round(r.startSec * 1000)}|${Math.round(r.startSec * 1000)}[a${i}]`).join(';');
  const mixInputs = results.map((_, i) => `[a${i}]`).join('');
  const complexFilter = `${filterInputs};${mixInputs}amix=inputs=${results.length}:duration=longest:dropout_transition=0,volume=2.2[out]`;

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
    voiceMasterPath
  );

  console.log(`\n[FFmpeg] Mixing voice segments into ${voiceMasterPath}...`);
  execFileSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });

  console.log(`\n[FFmpeg] Mixing voice with BGM into ${finalAudioWithBgm}...`);
  execFileSync('ffmpeg', [
    '-y',
    '-i', voiceMasterPath,
    '-i', bgmPath,
    '-filter_complex', '[0:a]volume=1.0[v];[1:a]volume=0.10[bgm];[v][bgm]amix=inputs=2:duration=first:dropout_transition=2[out]',
    '-map', '[out]',
    '-t', totalDuration.toString(),
    '-ar', '48000',
    '-ac', '2',
    finalAudioWithBgm
  ], { stdio: 'inherit' });

  console.log('\n✓ Successfully produced projectile audio master!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

