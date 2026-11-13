import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const scenes = [
  {
    id: 'scene_1',
    startSec: 0.0,
    targetSec: 3.2,
    text: '100 hiện tượng vật lý mỗi ngày. Ngày 15:'
  },
  {
    id: 'scene_2',
    startSec: 3.2,
    targetSec: 6.8,
    text: 'Vì sao mùa hè thì nóng, còn mùa đông lại lạnh?'
  },
  {
    id: 'scene_3',
    startSec: 6.8,
    targetSec: 15.2,
    text: 'Nhiều bạn nghĩ mùa hè nóng vì Trái Đất ở gần Mặt Trời hơn. Sai! Trái Đất gần Mặt Trời nhất vào khoảng tháng 1, đúng giữa mùa đông của miền Bắc nước ta.'
  },
  {
    id: 'scene_4',
    startSec: 15.2,
    targetSec: 26.2,
    text: 'Bí mật nằm ở trục Trái Đất. Nó nghiêng khoảng 23,5 độ và luôn giữ nguyên hướng nghiêng khi quay quanh Mặt Trời. Vì thế khoảng tháng 6, Bắc Bán Cầu nghiêng về phía Mặt Trời, khoảng tháng 12 thì nghiêng ra xa.'
  },
  {
    id: 'scene_5',
    startSec: 26.2,
    targetSec: 38.0,
    text: 'Khi nghiêng về phía Mặt Trời, nắng chiếu gần như thẳng góc, tập trung trên một vùng hẹp nên rất nóng. Khi nghiêng ra xa, nắng chiếu xiên, bị trải ra trên diện tích rộng hơn, nên mỗi mét vuông nhận ít nhiệt hơn.'
  },
  {
    id: 'scene_6',
    startSec: 38.0,
    targetSec: 48.0,
    text: 'Mùa hè còn có ngày dài, đêm ngắn. Ở Hà Nội, ngày hè dài khoảng 13 tiếng rưỡi, còn ngày đông chỉ khoảng 11 tiếng, nên mùa hè mặt đất được sưởi nóng lâu hơn.'
  },
  {
    id: 'scene_7',
    startSec: 48.0,
    targetSec: 52.0,
    text: 'Nhớ nhé, trục Trái Đất nghiêng tạo ra các mùa.'
  },
  {
    id: 'scene_8',
    startSec: 52.0,
    targetSec: 60.0,
    text: 'Câu hỏi cho bạn: Khi miền Bắc nước ta đang là mùa đông, thì ở Úc là mùa gì? Comment đáp án nhé!'
  }
];

const outDir = resolve(process.cwd(), 'outputs/dutai_audio_seasons');
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
      speed: 1.05,
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
  const dur = parseFloat(info.format.duration);
  console.log(`  -> Duration: ${dur}s (${info.streams[0].codec_name}, ${info.streams[0].sample_rate}Hz)`);
  return {
    ...scene,
    filePath,
    duration: dur
  };
}

async function main() {
  console.log('=== Synthesizing DUTAI ZeroTTS (Bảo Trang) for Earth Seasons Video ===\n');
  const results = [];

  for (const scene of scenes) {
    const res = await synthesizeScene(scene);
    results.push(res);
  }

  writeFileSync(resolve(outDir, 'scenes_meta.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log('\n✓ All 8 scenes synthesized successfully!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

