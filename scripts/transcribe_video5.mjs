import fs from 'node:fs';

const dotenv = fs.readFileSync('.env', 'utf8');
const keyMatch = dotenv.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

const audioData = fs.readFileSync('outputs/video5_inspect/audio.mp3').toString('base64');

async function transcribe(model) {
  console.log(`Transcribing with ${model}...`);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'audio/mp3', data: audioData } },
          { text: `Hãy bóc băng (transcribe) chính xác 100% từng câu chữ thuyết minh tiếng Việt trong file audio này (verbatim).
Ghi rõ timestamp giây (bắt đầu - kết thúc) và nội dung từng câu, phong cách ngắt câu tự nhiên.
Trả về định dạng JSON array:
[
  { "scene": 1, "start": 0.0, "end": 4.5, "text": "..." }
]
Chỉ trả về JSON array hợp lệ, không giải thích gì thêm.` }
        ]
      }]
    })
  });
  const data = await res.json();
  if (data.candidates && data.candidates[0]) {
    const text = data.candidates[0].content.parts[0].text;
    console.log(`\n=== KẾT QUẢ TỪ ${model} ===\n`);
    console.log(text);
    let cleanJson = text.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    else if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
    fs.writeFileSync('outputs/video5_inspect/transcript.json', cleanJson, 'utf8');
    return true;
  } else {
    console.log(`${model} error:`, data.error?.message || JSON.stringify(data));
    return false;
  }
}

async function main() {
  for (const m of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash-lite', 'gemini-3.1-pro-preview']) {
    try {
      const ok = await transcribe(m);
      if (ok) break;
    } catch (e) {
      console.log(`Error calling ${m}:`, e.message);
    }
  }
}

main();
