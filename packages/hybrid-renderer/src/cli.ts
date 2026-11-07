import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentStore, DocumentIngestionService } from '@luminalearn/agent';
import { runHybridPipeline } from './pipeline';
import { runHybridPipelineV2 } from './pipeline-v2';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function value(args: string[], name: string): string | undefined {
  const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined;
}

const args = process.argv.slice(2);
const mode = value(args, '--mode') ?? 'mock';
const topic = value(args, '--topic') ?? 'Đạo hàm là gì?';
const voiceover = value(args, '--voiceover') ?? 'none';
const providedAudioPath = value(args, '--provided-audio');
const subtitlesEnabled = !args.includes('--no-subtitles');
const docPath = value(args, '--document');
const isV2 = args.includes('--v2') || Boolean(docPath) || /tích phân|riemann/i.test(topic);

async function main() {
  if (isV2) {
    const docStore = new DocumentStore();
    const sourceDocumentIds: string[] = [];

    if (docPath) {
      const fullDocPath = existsSync(resolve(docPath))
        ? resolve(docPath)
        : resolve(repositoryRoot, docPath);
      const service = new DocumentIngestionService();
      const fileBuf = readFileSync(fullDocPath);
      const ingested = await service.ingestFile({
        filename: basename(fullDocPath),
        buffer: fileBuf
      });
      docStore.addChunks(ingested.chunks);
      sourceDocumentIds.push(ingested.documentId);
    }

    const result = await runHybridPipelineV2(
      {
        requestId: `cli_${Date.now()}`,
        inputMode: docPath ? 'source_document' : 'topic_prompt',
        topic,
        sourceDocumentIds,
        audience: 'Học sinh phổ thông',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: mode as 'mock' | 'live',
        narrationMode: voiceover as 'none' | 'provided_audio' | 'google_cloud_tts',
        providedAudioPath,
        aspectRatio: '9:16'
      },
      {
        documentStore: docStore,
        onStage: (stage) => { process.stderr.write(`[v2:${mode}] ${stage}\n`); }
      }
    );

    process.stdout.write(`${JSON.stringify({ status: 'completed', pipeline: 'v2', renderMode: mode, jobId: result.jobId, output: result.outputPath, metadata: result.metadata }, null, 2)}\n`);
  } else {
    const result = await runHybridPipeline(
      { topic, language: 'vi', durationSeconds: 40, renderMode: mode as 'mock' | 'live', voiceoverMode: voiceover as 'none' | 'provided_audio' | 'google_cloud_tts', providedAudioPath, subtitlesEnabled },
      {
        onStage: (stage) => { process.stderr.write(`[hybrid:${mode}] ${stage}\n`); }
      }
    );
    process.stdout.write(`${JSON.stringify({ status: 'completed', pipeline: 'v1', renderMode: mode, jobId: result.jobId, output: result.outputPath, metadata: result.metadata }, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Render failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

