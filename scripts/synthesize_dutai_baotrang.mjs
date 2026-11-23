#!/usr/bin/env node
/**
 * Synthesize Vietnamese natural speech using DUTAI ZeroTTS (Bảo Trang voice).
 * Usage: node scripts/synthesize_dutai_baotrang.mjs "Nội dung cần đọc" output.wav
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const text = process.argv[2] || 'Chào mừng bạn đến với LuminaLearn - Nền tảng video học liệu thông minh cho Smart Campus 2026.';
const outputPath = process.argv[3] || resolve('outputs/dutai_baotrang_sample.wav');

const endpoint = process.env.DUTAI_TTS_ENDPOINT || 'https://tts.dutai.io.vn/v1/audio/speech';
const voice = process.env.DUTAI_TTS_VOICE || 'baotrang';
const model = process.env.DUTAI_TTS_MODEL || 'zerotts';

async function main() {
  console.log(`[DUTAI TTS] Synthesizing speech...`);
  console.log(`- Voice: ${voice} (${model})`);
  console.log(`- Text: "${text}"`);
  console.log(`- Output: ${outputPath}`);

  const payload = {
    model,
    input: text.trim(),
    voice,
    response_format: 'wav',
    speed: 1.0,
    stream: false,
    normalize_text: true,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.DUTAI_TTS_API_KEY ? { Authorization: `Bearer ${process.env.DUTAI_TTS_API_KEY}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`DUTAI TTS error (${res.status} ${res.statusText}): ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);

  console.log(`✓ Audio successfully synthesized: ${outputPath} (${buffer.byteLength} bytes)`);
}

main().catch((err) => {
  console.error('TTS synthesis failed:', err.message);
  process.exit(1);
});
