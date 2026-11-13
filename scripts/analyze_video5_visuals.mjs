import fs from 'node:fs';

const dotenv = fs.readFileSync('.env', 'utf8');
const keyMatch = dotenv.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

// Let's pick representative frames across the video:
// e.g. frame 2, 5, 10, 15, 20, 25, 30, 35, 42, 46, 50
const selectedFrames = [2, 5, 10, 16, 20, 26, 30, 36, 42, 46, 50];

const parts = [
  {
    text: `Dưới đây là các khung hình (frames) mẫu của video gốc (Video 5).
Hãy phân tích cực kỳ chi tiết cấu trúc trực quan (visual design & layout) của từng cảnh:
1. Header / Series badge: Text, font, màu sắc, vị trí, icon gì?
2. Background: Màu nền chính, gradient hay phẳng?
3. Title / Câu hỏi mở đầu: Vị trí, màu chữ, kích thước, hiệu ứng.
4. Minh họa trực quan (Visual illustrations/diagrams) trong từng cảnh:
   - Cảnh mây trắng và giọt nước li ti tán xạ ánh sáng (Scattering / Rayleigh / Mie scattering)
   - Cảnh mây mỏng ánh sáng xuyên qua
   - Cảnh mây giông dày (Cumulonimbus / storm cloud) hàng chục km, ánh sáng phản xạ ngược lên trên, đáy mây bị che khuất tối sầm
   - Cảnh nhìn từ máy bay trên cao (trắng sáng) đối lập nhìn từ mặt đất (xám đen / bóng râm)
   - Cảnh tổng kết so sánh 2 loại mây
   - Cảnh câu hỏi tương tác / call to action (mascot / icon / text)
5. Mascot / Nhân vật hoạt hình: Có mascot robot hay nhân vật nào xuất hiện không? Vị trí, biểu cảm?
6. Bảng màu (Color palette hex codes): Màu nền, màu mây trắng, màu mây đen, màu tia sáng mặt trời vàng/trắng, màu mũi tên tán xạ, màu text nổi bật.
7. Subtitle / Phụ đề: Vị trí, phong cách, màu viền/nền.

Hãy mô tả thật chi tiết để đội ngũ lập trình viên Remotion SVG có thể code lại giống hệt 100% từng pixel và animation.`
  }
];

for (const f of selectedFrames) {
  const numStr = String(f).padStart(3, '0');
  const framePath = `outputs/video5_inspect/frames/frame_${numStr}.png`;
  if (fs.existsSync(framePath)) {
    const data = fs.readFileSync(framePath).toString('base64');
    parts.push({
      inline_data: { mime_type: 'image/png', data }
    });
  }
}

async function analyze() {
  console.log('Sending frames to Gemini for visual analysis...');
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
    console.log('\n=== PHÂN TÍCH VISUAL VIDEO 5 ===\n');
    console.log(text);
    fs.writeFileSync('outputs/video5_inspect/visual_analysis.md', text, 'utf8');
  } else {
    console.error('Error:', JSON.stringify(data));
  }
}

analyze();

