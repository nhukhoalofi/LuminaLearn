import { runHybridPipeline } from './pipeline';

function value(args: string[], name: string): string | undefined {
  const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const mode = value(args, '--mode') ?? 'mock';
const topic = value(args, '--topic') ?? 'Đạo hàm là gì?';
const voiceover = value(args, '--voiceover') ?? 'none';
const providedAudioPath = value(args, '--provided-audio');
const subtitlesEnabled = !args.includes('--no-subtitles');

runHybridPipeline({ topic, language: 'vi', durationSeconds: 40, renderMode: mode as 'mock' | 'live', voiceoverMode: voiceover as 'none' | 'provided_audio' | 'google_cloud_tts', providedAudioPath, subtitlesEnabled }, {
  onStage: (stage) => { process.stderr.write(`[hybrid:${mode}] ${stage}\n`); }
}).then((result) => {
  process.stdout.write(`${JSON.stringify({ status: 'completed', renderMode: mode, jobId: result.jobId, output: result.outputPath, metadata: result.metadata }, null, 2)}\n`);
}).catch((error: unknown) => {
  process.stderr.write(`Hybrid render failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

