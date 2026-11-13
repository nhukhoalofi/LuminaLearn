import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const scenes = [
  {
    id: 'scene_01_intro',
    startSec: 0.0,
    endSec: 3.8,
    text: '100 hiện tượng vật lý mỗi ngày. Ngày 21.'
  },
  {
    id: 'scene_02_hook',
    startSec: 3.8,
    endSec: 11.2,
    text: 'Bạn nói vào điện thoại, người ở cách cả nghìn cây số nghe thấy ngay. Vậy điện thoại hoạt động theo nguyên lý nào mà nghe gọi được?'
  },
  {
    id: 'scene_03_chain',
    startSec: 11.2,
    endSec: 17.5,
    text: 'Bí mật nằm ở một chuỗi biến đổi: âm thanh thành điện, điện thành sóng, rồi sóng lại thành điện và thành âm thanh. Cùng đi qua từng bước nhé.'
  },
  {
    id: 'scene_04_step1_mic',
    startSec: 17.5,
    endSec: 25.0,
    text: 'Khi bạn nói, sóng âm làm một màng rất mỏng trong micro rung lên. Màng rung làm tín hiệu điện thay đổi theo, giống hệt giọng nói của bạn.'
  },
  {
    id: 'scene_05_step2_dsp',
    startSec: 25.0,
    endSec: 35.0,
    text: 'Bộ xử lý trong điện thoại đo tín hiệu này hàng nghìn lần mỗi giây, biến nó thành dãy số 0 và 1 rồi nén lại cho gọn.'
  },
  {
    id: 'scene_06_step3_tx_ant',
    startSec: 35.0,
    endSec: 44.5,
    text: 'Dãy số được gửi vào ăng-ten, làm các electron trong đó dao động hàng tỷ lần mỗi giây và phát ra sóng điện từ. Sóng này vô hình, bay đi với tốc độ ánh sáng.'
  },
  {
    id: 'scene_07_step4_network',
    startSec: 44.5,
    endSec: 55.0,
    text: 'Sóng tới trạm phát sóng gần nhất, từ đó tín hiệu chạy qua cáp quang tới trạm ở gần người nghe, rồi trạm này lại phát sóng tới điện thoại của họ.'
  },
  {
    id: 'scene_08_step5_rx_ant',
    startSec: 55.0,
    endSec: 64.5,
    text: 'Ở máy người nghe, ăng-ten bắt được sóng. Sóng làm các electron trong ăng-ten dao động theo, tạo lại tín hiệu điện và bộ xử lý giải mã dãy số thành tín hiệu giọng nói.'
  },
  {
    id: 'scene_09_step6_speaker',
    startSec: 64.5,
    endSec: 73.5,
    text: 'Trong loa có một cuộn dây đặt cạnh nam châm. Dòng điện biến đổi chạy qua cuộn dây khiến nó bị lực từ đẩy qua kéo lại, làm màng loa rung và phát ra giọng nói của bạn.'
  },
  {
    id: 'scene_10_duplex',
    startSec: 73.5,
    endSec: 81.5,
    text: 'Mỗi chiều nói và nghe được truyền trên một kênh riêng nên hai người có thể vừa nói vừa nghe cùng lúc. Cả hành trình chỉ mất chưa tới nửa giây.'
  },
  {
    id: 'scene_11_outro',
    startSec: 81.5,
    endSec: 89.33,
    text: 'Câu hỏi cho bạn: Vì sao vào thang máy điện thoại hay bị mất sóng?'
  }
];

const outDir = resolve(process.cwd(), 'outputs/dutai_phone_audio');
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
    const errorText = await response.text();
    throw new Error(`DUTAI TTS error (${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  writeFileSync(filePath, Buffer.from(arrayBuffer));
  console.log(`✓ Saved ${filePath} (${arrayBuffer.byteLength} bytes)`);

  const probe = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath
  ], { encoding: 'utf8' }).trim();

  const durationSec = parseFloat(probe);
  console.log(`  Duration: ${durationSec}s (Target slot: ${scene.endSec - scene.startSec}s)`);
  return { ...scene, filePath, durationSec };
}

async function main() {
  console.log('=== Synthesizing Video 2 (Phone Call) Voiceover with DUTAI ZeroTTS (Bảo Trang) ===');
  const results = [];
  for (const scene of scenes) {
    try {
      const res = await synthesizeScene(scene);
      results.push(res);
    } catch (err) {
      console.error(`Failed ${scene.id}:`, err);
      process.exit(1);
    }
  }

  console.log('\n=== All 11 scenes synthesized successfully! ===');
  writeFileSync(resolve(outDir, 'scenes_meta.json'), JSON.stringify(results, null, 2), 'utf8');
}

main().catch(console.error);

