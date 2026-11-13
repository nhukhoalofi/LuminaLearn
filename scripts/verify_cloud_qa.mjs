import fs from 'node:fs';

const dotenv = fs.readFileSync('.env', 'utf8');
const keyMatch = dotenv.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

const qaImages = [
  { name: 'scene1_intro.png', title: 'Cảnh 1: Giới thiệu Series 100 Hiện Tượng Vật Lý - Ngày 14' },
  { name: 'scene2_hook.png', title: 'Cảnh 2: Câu hỏi mở đầu - Mây thường trắng, mây giông xám đen' },
  { name: 'scene3_mie_scattering.png', title: 'Cảnh 3: Hàng tỷ giọt nước li ti & Tán xạ Mie đều các màu' },
  { name: 'scene4_thickness.png', title: 'Cảnh 4: So sánh độ dày - Mây mỏng vs Mây giông khổng lồ 10-15km' },
  { name: 'scene5_multiple_scattering.png', title: 'Cảnh 5: Cơ chế phản xạ nhiều lần, >90% hất ngược lên trên' },
  { name: 'scene6_airplane_view.png', title: 'Cảnh 6: Góc nhìn máy bay (trắng sáng) vs Mặt đất (bóng râm)' },
  { name: 'scene7_recap.png', title: 'Cảnh 7: Hộp ghi nhớ NHỚ NHÉ (Mây mỏng → Trắng, Mây dày → Đáy xám đen)' },
  { name: 'scene8_question_cta.png', title: 'Cảnh 8 & 9: Câu hỏi tương tác & Mascot kêu gọi comment' },
];

async function verifyAll() {
  console.log('=== BẮT ĐẦU AUDIT CHẤT LƯỢNG TỪNG FRAME VỚI GEMINI ===\n');

  const parts = [
    {
      text: `Bạn là Giám đốc Kiểm định Chất lượng Video Giáo Dục (Educational Video QA Director).
Dưới đây là 8 khung hình thực tế trích xuất từ video kết xuất hoàn chỉnh (LuminaExactCloudClone):
Hãy đánh giá chi tiết theo 4 tiêu chí cốt lõi:
1. Độ chính xác & sắc nét của từng frame (Visual Clarity & 1080x1920 layout)
2. Độ chuẩn xác về mặt vật lý & sư phạm (Pedagogical & Physics correctness: Mie scattering, optical depth, multiple scattering, shadow effect)
3. Tính hợp lý & đồng bộ của lời bình thuyết minh DUT TTS Bảo Trang
4. Safe zone, màu sắc tương phản, bố cục typography và sự xuất hiện của Mascot Robot.

Đưa ra điểm số (1-10) và kết luận kiểm định cuối cùng.`
    }
  ];

  for (const item of qaImages) {
    const path = `outputs/cloud_final_qa/${item.name}`;
    if (fs.existsSync(path)) {
      const data = fs.readFileSync(path).toString('base64');
      parts.push({
        text: `--- ${item.title} (${item.name}) ---`
      });
      parts.push({
        inline_data: { mime_type: 'image/png', data }
      });
    }
  }

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] })
  });

  const json = await res.json();
  const report = json.candidates?.[0]?.content?.parts?.[0]?.text || 'Error';
  console.log(report);
  fs.writeFileSync('outputs/cloud_final_qa/QA_AUDIT_REPORT.md', report, 'utf8');
}

verifyAll();
