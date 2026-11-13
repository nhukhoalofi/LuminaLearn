import fs from 'node:fs';

const dotenv = fs.readFileSync('.env', 'utf8');
const keyMatch = dotenv.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';

const audioData = fs.readFileSync('outputs/reference_audio.aac').toString('base64');

async function test(model) {
  console.log(`Trying ${model}...`);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'audio/aac', data: audioData } },
          { text: 'Chép lại chính xác từng câu chữ tiếng Việt mà người thuyết minh nói trong file âm thanh này (verbatim transcript). Ghi rõ timestamp giây (bắt đầu - kết thúc) và nội dung từng câu.' }
        ]
      }]
    })
  });
  const data = await res.json();
  if (data.candidates && data.candidates[0]) {
    console.log(`\n=== KẾT QUẢ TỪ ${model} ===\n`);
    console.log(data.candidates[0].content.parts[0].text);
    return true;
  } else {
    console.log(`${model} error:`, data.error?.message || JSON.stringify(data));
    return false;
  }
}

async function main() {
  for (const m of ['gemini-3.5-flash-lite', 'gemini-3.8-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash']) {
    try {
      const ok = await test(m);
      if (ok) break;
    } catch (e) {
      console.log(`Error calling ${m}:`, e.message);
    }
  }
}

main();
