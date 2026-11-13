import fs from 'node:fs';

const dotenv = fs.readFileSync('.env', 'utf8');
const keyMatch = dotenv.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = keyMatch ? keyMatch[1].trim() : '';
const audioData = fs.readFileSync('outputs/temp_inspect_v4/audio.wav').toString('base64');

async function main() {
  for (const m of ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash']) {
    console.log('Trying model:', m);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'audio/wav', data: audioData } },
              { text: 'Hãy cho biết nội dung chính của video này là gì, bóc băng chính xác 100% tiếng Việt từng câu kèm timestamp (start, end) và nội dung chữ hiển thị nếu có. Trả về định dạng JSON hoặc text rõ ràng.' }
            ]
          }]
        })
      });
      const data = await res.json();
      if (data.candidates && data.candidates[0]) {
        console.log('=== KẾT QUẢ TỪ ' + m + ' ===');
        console.log(data.candidates[0].content.parts[0].text);
        fs.writeFileSync('outputs/temp_inspect_v4/transcript.txt', data.candidates[0].content.parts[0].text, 'utf8');
        return;
      } else {
        console.log('Error with', m, data.error?.message || JSON.stringify(data));
      }
    } catch (e) {
      console.log('Exception with', m, e.message);
    }
  }
}

main();
