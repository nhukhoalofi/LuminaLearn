import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadRepositoryEnvironment } from './environment';
import { isSupportedGeminiTtsModel } from './gemini-tts';

const execFileAsync = promisify(execFile);

async function executableAvailable(executable: string): Promise<boolean> {
  try {
    await execFileAsync(executable, ['-version'], { windowsHide: true, timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function positiveInteger(value: string | undefined, fallback: number): number | undefined {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function runGeminiTtsPreflight() {
  loadRepositoryEnvironment();
  const model = process.env.GEMINI_TTS_MODEL ?? 'gemini-3.8-flash-lite-tts';
  const voice = process.env.GEMINI_TTS_VOICE ?? 'Kore';
  const language = process.env.GEMINI_TTS_LANGUAGE ?? 'vi';
  const provider = process.env.TTS_PROVIDER ?? 'gemini';
  const ffmpegExecutable = process.env.FFMPEG_EXECUTABLE ?? 'ffmpeg';
  const ffprobeExecutable = process.env.FFPROBE_EXECUTABLE ?? 'ffprobe';
  const ttsBudget = positiveInteger(process.env.GEMINI_TTS_MAX_REQUESTS_PER_JOB, 5);
  const [ffmpegAvailable, ffprobeAvailable] = await Promise.all([
    executableAvailable(ffmpegExecutable),
    executableAvailable(ffprobeExecutable)
  ]);

  const blockers: string[] = [];
  if (!process.env.GEMINI_API_KEY?.trim()) blockers.push('GEMINI_API_KEY is not configured');
  if (!isSupportedGeminiTtsModel(model)) blockers.push(`Unsupported GEMINI_TTS_MODEL: ${model}`);
  if (!voice.trim()) blockers.push('GEMINI_TTS_VOICE is empty');
  if (language !== 'vi' && language !== 'vi-VN') blockers.push(`Unsupported Vietnamese language setting: ${language}`);
  if (provider !== 'gemini') blockers.push(`TTS_PROVIDER must be 'gemini' for this pre-flight (received '${provider}')`);
  if (!ttsBudget) blockers.push('GEMINI_TTS_MAX_REQUESTS_PER_JOB must be a positive integer');
  if (!ffmpegAvailable) blockers.push(`FFmpeg is unavailable: ${ffmpegExecutable}`);
  if (!ffprobeAvailable) blockers.push(`FFprobe is unavailable: ${ffprobeExecutable}`);

  return {
    readyOffline: blockers.length === 0,
    externalRequestsMade: 0,
    apiKeyConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    model,
    modelIdentifierSupportedLocally: isSupportedGeminiTtsModel(model),
    voice,
    language,
    provider,
    normalizedOutput: { container: 'mp3', codec: 'libmp3lame', sampleRate: 24_000, channels: 1 },
    ttsBudgetPerJob: ttsBudget ?? null,
    ffmpegAvailable,
    ffprobeAvailable,
    blockers,
    caveat: 'Free Tier quota and model access cannot be confirmed offline. Run the explicit live smoke command only with user authorization.'
  };
}

runGeminiTtsPreflight()
  .then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.readyOffline) process.exitCode = 1;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
