import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { GeminiTtsProvider } from './gemini-tts';
import { probeAudio, probeAudioSignal } from './audio';
import { loadRepositoryEnvironment } from './environment';

loadRepositoryEnvironment();

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  if (!process.argv.includes('--live-gemini-tts')) {
    throw new Error('live_authorization_required: pass --live-gemini-tts to authorize one real Gemini TTS request');
  }
  const outputPath = resolve(option('--output') ?? `outputs/gemini-tts-smoke-${Date.now()}.mp3`);
  await mkdir(dirname(outputPath), { recursive: true });
  const provider = new GeminiTtsProvider({ maxAttempts: 1 });
  await provider.synthesize(
    'Đạo hàm của x bình phương là hai x. Tích phân của x bình phương từ không đến một bằng một phần ba.',
    outputPath
  );
  const metadata = await probeAudio(outputPath, 20);
  const signal = await probeAudioSignal(outputPath);
  const budget = provider.getBudgetSummary();
  process.stdout.write(`${JSON.stringify({
    provider: provider.id,
    model: provider.model,
    voice: provider.voice,
    durationSeconds: metadata.durationSeconds,
    codec: metadata.codec,
    sampleRate: metadata.sampleRate,
    channels: metadata.channels,
    meanVolumeDb: signal.meanVolumeDb,
    maxVolumeDb: signal.maxVolumeDb,
    signalClassification: signal.audioClassification,
    requestCount: budget.counts.geminiTts,
    manualListeningRequired: true,
    vietnameseSpeechReview: 'pending_manual_review',
    outputPath
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
