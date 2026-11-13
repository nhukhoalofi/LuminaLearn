import fs from 'node:fs';

const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
const apiKey = match ? match[1].trim() : '';

const audioBuffer = fs.readFileSync('outputs/video2_audio.mp3');
const base64Audio = audioBuffer.toString('base64');

const models = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];

async function tryTranscribe(model) {
  console.log(`Trying ${model}...`);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: 'audio/mp3',
                data: base64Audio
              }
            },
            {
              text: 'Hãy bóc băng (transcribe) chính xác 100% từng câu chữ thuyết minh tiếng Việt trong file audio này (verbatim). Ghi rõ timestamp giây (bắt đầu - kết thúc) cho từng câu. Trả về định dạng JSON array: [{ "scene": 1, "start": 0.0, "end": 4.5, "text": "..." }]. Chỉ trả lời bằng JSON array hợp lệ.'
            }
          ]
        }
      ]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`${model} error:`, data.error?.message || JSON.stringify(data));
    return false;
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log(`=== Raw Transcription Result from ${model} ===`);
  console.log(rawText);

  let cleanJson = rawText.trim();
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
  }

  fs.writeFileSync('outputs/video2_transcript.json', cleanJson, 'utf8');
  console.log('Saved to outputs/video2_transcript.json');
  return true;
}

async function main() {
  for (const m of models) {
    const success = await tryTranscribe(m);
    if (success) return;
  }
}

main().catch(console.error);
