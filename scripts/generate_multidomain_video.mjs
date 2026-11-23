#!/usr/bin/env node
/**
 * LuminaLearn - Multi-Domain Video Generation Engine
 * Smart Campus 2026 Autonomous Generation Pipeline
 *
 * Usage:
 *   node scripts/generate_multidomain_video.mjs --topic "Chung tay bảo vệ môi trường và sử dụng năng lượng bền vững"
 *   node scripts/generate_multidomain_video.mjs --topic "Hiệu ứng nhà kính và biến đổi khí hậu" --domain "physics"
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync, copyFileSync } from 'node:fs';

const args = process.argv.slice(2);
let topic = 'Chung tay bảo vệ môi trường và sử dụng năng lượng bền vững (Smart Campus 2026)';
let domain = 'physics';
let outputPath = 'outputs/smart_campus_procedural_demo.mp4';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--topic' && args[i + 1]) {
    topic = args[i + 1];
    i++;
  } else if (args[i] === '--domain' && args[i + 1]) {
    domain = args[i + 1];
    i++;
  } else if (args[i] === '--output' && args[i + 1]) {
    outputPath = args[i + 1];
    i++;
  }
}

console.log('================================================================');
console.log(' 🌿 LuminaLearn Smart Campus 2026 - Multi-Domain Video Generator');
console.log('================================================================');
console.log(`📌 Topic: ${topic}`);
console.log(`📌 Domain: ${domain}`);
console.log(`📌 Target Output: ${outputPath}`);

const isSmartCampus = /môi trường|ô nhiễm|smart campus|năng lượng|khí thải|tái chế|rác thải|pin mặt trời|điện gió|hiệu ứng nhà kính/i.test(topic);

const compositionId = isSmartCampus ? 'LuminaSmartCampusEnvironmentDemo' : 'LuminaUniversalExplainer';

console.log(`\n[Stage 1/3] Selected Composition: "${compositionId}"`);
console.log(`[Stage 2/3] Audio Engine: DUTAI ZeroTTS (Bảo Trang) + YouTube Signature BGM (bgm_raw.mp3)`);
console.log(`[Stage 3/3] Remotion Video Rendering (1280x720@30fps, 16:9)...`);

const chromePath = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const fullOutputPath = resolve(process.cwd(), outputPath);

try {
  execFileSync(
    'npx',
    [
      'remotion',
      'render',
      'src/index.ts',
      compositionId,
      fullOutputPath,
      `--browser-executable=${chromePath}`,
      '--concurrency=2',
      '--gl=angle'
    ],
    {
      cwd: resolve(process.cwd(), 'apps/worker'),
      stdio: 'inherit',
      shell: true
    }
  );

  console.log(`\n✓ Video rendered successfully to: ${fullOutputPath}`);

  // Deploy to web public demo
  const webDemoPath = resolve(process.cwd(), 'apps/web/public/demo/smart-campus-exact-clone.mp4');
  if (existsSync(fullOutputPath)) {
    copyFileSync(fullOutputPath, webDemoPath);
    console.log(`✓ Copied to Web UI Showcase: ${webDemoPath}`);
  }
} catch (err) {
  console.error('\n❌ Render failed:', err.message);
  process.exit(1);
}
