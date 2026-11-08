import { execFile } from 'node:child_process';
import { stat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LessonDraftManagerV3 } from '@luminalearn/agent';
import { runRenderPipelineV3 } from './pipeline-v3.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function exec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: 60_000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`${cmd} failed: ${stderr || stdout || err.message}`));
      resolvePromise({ stdout, stderr });
    });
  });
}

async function main() {
  console.log('=== V3 Phase 4 AI Acceptance Render: Gradient Descent ===');
  const jobId = 'v3-gradient-descent';
  const manager = new LessonDraftManagerV3();

  console.log('[1/5] Creating V3 Draft for "Gradient Descent"...');
  let draft = await manager.create({
    requestId: `req_gd_${Date.now()}`,
    topic: 'Thuật toán Gradient Descent và tối ưu hóa hàm mất mát',
    domain: 'artificial_intelligence',
    generationMode: 'mock',
    targetDurationSeconds: 35,
    narrationMode: 'none',
    subtitlesEnabled: true,
    fps: 24,
    width: 720,
    height: 1280
  }, 'teacher_ai_acceptance');

  console.log(`[2/5] Confirming semantic review for draft ${draft.draftId}...`);
  draft = await manager.confirmSemanticReview(draft.draftId, 'teacher_ai_acceptance', draft.version);

  console.log('[3/5] Approving draft to create ApprovedRenderArtifactV3...');
  draft = await manager.approve(draft.draftId, 'teacher_ai_acceptance', draft.version, 'Approved for Phase 4 AI Acceptance Render');
  const artifact = draft.approvedArtifact!;
  console.log(`   Artifact ID: ${artifact.artifactId}`);
  console.log(`   Content Hash: ${artifact.contentHash}`);
  console.log(`   Scenes: ${artifact.lessonPlan.storyboard?.scenes.length ?? 0}`);

  console.log('[4/5] Executing Remotion V3 render pipeline...');
  const { outputPath } = await runRenderPipelineV3(artifact, {
    jobId,
    authorizeArtifact: (candidate) => manager.isArtifactAuthorized(candidate),
    onStage: (stage) => console.log(`   [Remotion Stage]: ${stage}`)
  });
  console.log(`   Output MP4: ${outputPath}`);

  console.log('[5/5] Auditing output MP4 with FFprobe and FFmpeg...');
  const outputDir = dirname(outputPath);

  // Run FFprobe
  const ffprobeResult = await exec('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    outputPath
  ]);
  const probeData = JSON.parse(ffprobeResult.stdout);
  await writeFile(resolve(outputDir, 'ffprobe.json'), JSON.stringify(probeData, null, 2), 'utf8');

  // Extract video stream metadata
  const videoStream = probeData.streams?.find((s: { codec_type: string }) => s.codec_type === 'video');
  const fileStat = await stat(outputPath);

  // Extract frame 25
  const framePath = resolve(outputDir, 'frame-25.png');
  await exec('ffmpeg', [
    '-y',
    '-ss', '00:00:01.041',
    '-i', outputPath,
    '-vframes', '1',
    framePath
  ]);

  // Extract contact sheet (2x2 grid)
  const contactSheetPath = resolve(outputDir, 'contact-sheet.jpg');
  await exec('ffmpeg', [
    '-y',
    '-i', outputPath,
    '-vf', 'fps=1/5,scale=360:640,tile=2x2',
    '-frames:v', '1',
    contactSheetPath
  ]);

  const summary = {
    jobId,
    outputPath,
    fileSizeBytes: fileStat.size,
    codec: videoStream?.codec_name,
    width: videoStream?.width,
    height: videoStream?.height,
    fps: eval(videoStream?.r_frame_rate || '24/1'),
    durationSeconds: parseFloat(probeData.format?.duration || '0'),
    frameSample: framePath,
    contactSheet: contactSheetPath,
    verified: videoStream?.width === 720 && videoStream?.height === 1280 && videoStream?.codec_name === 'h264'
  };

  console.log('\n=== ACCEPTANCE RENDER SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.verified) {
    throw new Error('Acceptance criteria failed: resolution or codec mismatch');
  }
  console.log('\nSUCCESS: Gradient Descent rendered cleanly and passed all QA gates!');
}

main().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});

