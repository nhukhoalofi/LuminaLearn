import fs from 'node:fs';

const dotenv = fs.readFileSync('.env', 'utf8');
const keyMatch = dotenv.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

// Select representative frames: 1s, 4s, 8s, 12s, 18s, 24s, 29s, 35s, 42s, 49s, 54s
const frameIndices = [1, 4, 8, 12, 18, 24, 29, 35, 42, 49, 54];

const parts = [
  {
    text: `Dưới đây là 11 ảnh khung hình (frames) mẫu của video 4 gốc.
Nội dung video: "Ngày 15: Vì sao mùa hè thì nóng, còn mùa đông lại lạnh? (Trục Trái Đất nghiêng 23.5°)"
Hãy phân tích CỰC KỲ CHI TIẾT từng cảnh (Scene 1 đến Scene 8/9):
1. Timestamp chính xác của từng cảnh (giây bắt đầu - kết thúc)
2. Header & Badge: Tiêu đề chuỗi, số ngày, icon
3. Background: Màu nền, mã màu hex, gradient hay phẳng?
4. Nội dung text chữ trên màn hình (từng dòng chữ, màu chữ, chữ nào màu vàng highlight, kích thước, căn lề)
5. Các hình vẽ minh họa trực quan & animation:
   - Trái Đất: hình dáng, màu sắc, trục quay màu gì, góc nghiêng bao nhiêu độ, các đường kinh tuyến vĩ tuyến, xích đạo
   - Mặt Trời: hình cầu màu gì, tia sáng mặt trời vẽ như thế nào (màu sắc, mũi tên, độ dày, chùm tia)
   - Hình minh họa góc chiếu thẳng (vuông góc) vs góc chiếu xiên (chiếu lên mặt phẳng nằm ngang, diện tích nhận sáng hẹp vs rộng)
   - Hình minh họa Hà Nội ngày dài đêm ngắn: biểu đồ hay hình vẽ mặt trời mọc/lặn hay thanh thời gian (13.5h vs 11h)?
   - Mascot robot: Vị trí, hình dáng, cử chỉ, biểu cảm ở các cảnh
6. Bảng màu (Color palette hex codes):
   - Nền (background)
   - Màu chữ chính (text)
   - Màu highlight (vàng/cam)
   - Màu Trái Đất (đại dương, lục địa)
   - Màu Mặt Trời (vàng, tia nắng)
   - Màu các đường nét, mũi tên, chú thích
7. Lời thoại thuyết minh (voiceover script) chính xác từng từ tiếng Việt của từng cảnh để dùng cho DUTAI TTS.

Hãy xuất ra bản phân tích chi tiết để có thể code Remotion và tổng hợp TTS chuẩn xác 100%.`
  }
];

for (const idx of frameIndices) {
  const p = `outputs/video4_inspect/frames/frame_${String(idx).padStart(3, '0')}.png`;
  if (fs.existsSync(p)) {
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: fs.readFileSync(p).toString('base64')
      }
    });
  }
}

async function run() {
  console.log('Sending frames to Gemini for comprehensive scene-by-scene analysis...');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }]
    })
  });
  const data = await res.json();
  if (data.candidates && data.candidates[0]) {
    const text = data.candidates[0].content.parts[0].text;
    console.log(text);
    fs.writeFileSync('outputs/video4_inspect/detailed_analysis.md', text, 'utf8');
  } else {
    console.error('Error:', JSON.stringify(data));
  }
}

run();

