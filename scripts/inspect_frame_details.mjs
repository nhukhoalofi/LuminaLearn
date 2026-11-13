import fs from 'node:fs';

const dotenv = fs.readFileSync('.env', 'utf8');
const keyMatch = dotenv.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

async function describeFrame(frameNum, title) {
  const numStr = String(frameNum).padStart(3, '0');
  const framePath = `outputs/video5_inspect/frames/frame_${numStr}.png`;
  if (!fs.existsSync(framePath)) return;
  const data = fs.readFileSync(framePath).toString('base64');

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'image/png', data } },
          { text: `Đây là frame ${frameNum} (${title}) của video gốc. Hãy mô tả chi tiết:
1. Tất cả các đoạn văn bản (text), font, màu sắc, vị trí (top, center, bottom), box viền.
2. Các hình vẽ SVG / đồ họa / minh họa (mây, giọt nước, tia sáng, mũi tên, thước đo, máy bay, mặt trời, mắt người, v.v.): vị trí, hình dạng, màu sắc.
3. Mascot robot hay icon có xuất hiện không?
4. Màu nền (background color).` }
        ]
      }]
    })
  });
  const json = await res.json();
  const desc = json.candidates?.[0]?.content?.parts?.[0]?.text || 'Error';
  console.log(`\n=== FRAME ${frameNum}: ${title} ===\n${desc}\n`);
  return `### Frame ${frameNum} - ${title}\n${desc}\n`;
}

async function main() {
  const targets = [
    [2, 'Intro badge & title'],
    [5, 'Hook question'],
    [10, 'Cloud scattering water droplets'],
    [17, 'Thin cloud vs thick cumulonimbus cloud'],
    [27, 'Multiple scattering inside thick cloud, light reflected upwards'],
    [36, 'Airplane view from above vs ground view below in shadow'],
    [42, 'Summary comparison: thin white vs thick dark bottom'],
    [48, 'Interactive question & call to action']
  ];

  let fullMd = '# Detailed Frame Inspection of Video 5\n\n';
  for (const [f, t] of targets) {
    const text = await describeFrame(f, t);
    fullMd += text + '\n---\n';
  }
  fs.writeFileSync('outputs/video5_inspect/frame_details.md', fullMd, 'utf8');
}

main();

