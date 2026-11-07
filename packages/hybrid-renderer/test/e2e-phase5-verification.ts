import assert from 'node:assert/strict';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalJobRepository, type PersistableJob } from '../src/job-repository';
import { probeFinalVideo } from '../src/ffprobe';

const repositoryRoot = resolve(fileURLToPath(import.meta.url), '../../../../');
const PORT = 3010;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/jobs/job-20261107032458-0baf4d38`);
      if (res.status === 200) return;
    } catch {
      // not ready yet
    }
    await sleep(500);
  }
  throw new Error(`Server failed to start on ${BASE_URL} within ${timeoutMs}ms`);
}

async function main() {
  console.log('=== STARTING PHASE 5 COMPREHENSIVE E2E VERIFICATION ===\n');

  // STEP 1: Verify Job Persistence & Recovery unit
  console.log('--- TEST 1: Job Persistence & Server Restart Recovery ---');
  const jobsDir = resolve(repositoryRoot, 'outputs/.jobs');
  const repo = new LocalJobRepository<PersistableJob>(jobsDir);

  // 1a. Test interrupted recovery
  const testJobId = 'job-interrupted-test-99999999';
  const testJobFile = resolve(jobsDir, `${testJobId}.json`);
  const interruptedJob: PersistableJob = {
    jobId: testJobId,
    status: 'rendering_remotion',
    progress: 78,
    message: 'Rendering remotion in progress',
    updatedAt: new Date().toISOString()
  };
  repo.save(interruptedJob);
  console.log('  Saved active job in non-terminal state:', testJobId);

  // Load and recover
  const recoveredList = repo.loadAndRecover();
  const recovered = recoveredList.find((j) => j.jobId === testJobId);
  assert.ok(recovered, 'Recovered job must be present in loadAndRecover list');
  assert.equal(recovered.status, 'interrupted', 'Non-terminal job must be transitioned to interrupted');
  assert.equal(recovered.failureType, 'interrupted', 'failureType must be interrupted');
  assert.equal(recovered.progress, 0, 'Progress must be reset to 0');
  console.log('  [PASS] Non-terminal job correctly recovered as interrupted on reload');

  // Clean up test file
  if (existsSync(testJobFile)) rmSync(testJobFile);

  // 1b. Test completed job preservation
  const existingJob = recoveredList.find((j) => j.jobId === 'job-20261107032458-0baf4d38');
  assert.ok(existingJob, 'Existing completed job must exist');
  assert.equal(existingJob.status, 'completed', 'Completed job must remain completed');
  console.log('  [PASS] Completed job job-20261107032458-0baf4d38 preserved as completed');

  // STEP 2: Start Next.js Server on port 3010
  console.log('\n--- TEST 2: Starting Next.js Production Server on port 3010 ---');
  const nextProcess: ChildProcess = spawn(
    'pnpm',
    ['--filter', '@luminalearn/web', 'start', '--port', String(PORT)],
    {
      cwd: repositoryRoot,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  nextProcess.stdout?.on('data', (d) => process.stdout.write(`  [next.js] ${d}`));
  nextProcess.stderr?.on('data', (d) => process.stderr.write(`  [next.js-err] ${d}`));

  try {
    await waitForServer(35_000);
    console.log('  [PASS] Next.js server is up and responsive on port 3010');

    // STEP 3: Test HTTP Endpoints on existing completed job
    console.log('\n--- TEST 3: HTTP API on Completed Job job-20261107032458-0baf4d38 ---');
    
    // 3a. GET /api/jobs/:id
    const jobRes = await fetch(`${BASE_URL}/api/jobs/job-20261107032458-0baf4d38`);
    assert.equal(jobRes.status, 200, 'GET job status must return 200');
    const jobData = (await jobRes.json()) as any;
    assert.equal(jobData.jobId, 'job-20261107032458-0baf4d38');
    assert.equal(jobData.status, 'completed');
    assert.equal(jobData.progress, 100);
    assert.equal(jobData.videoUrl, '/api/jobs/job-20261107032458-0baf4d38/video');
    assert.equal(jobData.outputPath, undefined, 'Private outputPath must not be leaked');
    console.log('  [PASS] GET /api/jobs/:id returned 200 and safe metadata without private path');

    // 3b. GET /api/jobs/:id/video (Full stream)
    const videoRes = await fetch(`${BASE_URL}/api/jobs/job-20261107032458-0baf4d38/video`);
    assert.equal(videoRes.status, 200, 'GET video must return 200');
    assert.equal(videoRes.headers.get('content-type'), 'video/mp4');
    assert.equal(videoRes.headers.get('accept-ranges'), 'bytes');
    assert.ok(videoRes.headers.get('content-disposition')?.includes('inline'));
    const fullBytes = await videoRes.arrayBuffer();
    assert.equal(fullBytes.byteLength, 858155, 'Video byteLength must match file size');
    console.log(`  [PASS] GET /api/jobs/:id/video returned 200 (length: ${fullBytes.byteLength} bytes)`);

    // 3c. GET /api/jobs/:id/video with HTTP Range request
    const rangeRes = await fetch(`${BASE_URL}/api/jobs/job-20261107032458-0baf4d38/video`, {
      headers: { Range: 'bytes=0-1023' }
    });
    assert.equal(rangeRes.status, 206, 'Range request must return 206 Partial Content');
    assert.equal(rangeRes.headers.get('content-type'), 'video/mp4');
    assert.equal(rangeRes.headers.get('content-range'), 'bytes 0-1023/858155');
    const rangeBytes = await rangeRes.arrayBuffer();
    assert.equal(rangeBytes.byteLength, 1024);
    const cl = rangeRes.headers.get('content-length');
    if (cl) assert.equal(cl, '1024');
    console.log('  [PASS] HTTP Range request returned 206 Partial Content with correct Content-Range and 1024 bytes');

    // 3d. GET /api/jobs/:id/video?download=1
    const downloadRes = await fetch(`${BASE_URL}/api/jobs/job-20261107032458-0baf4d38/video?download=1`);
    assert.equal(downloadRes.status, 200);
    assert.ok(downloadRes.headers.get('content-disposition')?.includes('attachment; filename="luminalearn-derivative.mp4"'));
    console.log('  [PASS] Download parameter returned Content-Disposition: attachment');

    // 3e. Path traversal & security checks
    const traversalRes = await fetch(`${BASE_URL}/api/jobs/..%2F..%2Fetc/video`);
    assert.equal(traversalRes.status, 400, 'Invalid job ID format must return 400');
    const notFoundRes = await fetch(`${BASE_URL}/api/jobs/job-nonexistent-00000000`);
    assert.equal(notFoundRes.status, 404, 'Non-existent job must return 404');
    console.log('  [PASS] Path traversal rejected with 400 and non-existent job returned 404');

    // STEP 4: Test API Validation and Error Handling
    console.log('\n--- TEST 4: API Error Handling & Validation ---');
    // 4a. Unsupported topic rejected with 400
    const unsupportedTopicRes = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Lịch sử La Mã cổ đại', language: 'vi', durationSeconds: 40, renderMode: 'mock' })
    });
    assert.equal(unsupportedTopicRes.status, 400);
    console.log('  [PASS] Unsupported topic rejected with 400');

    // 4b. Request payload too large rejected with 413
    const largeRes = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Đạo hàm là gì? ' + 'a'.repeat(2500), language: 'vi', durationSeconds: 40, renderMode: 'mock' })
    });
    assert.equal(largeRes.status, 413);
    console.log('  [PASS] Payload >2KB rejected with 413');

    // 4c. Web upload with provided audio (deliberately forbidden via web)
    const webProvidedAudioRes = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Đạo hàm là gì?', language: 'vi', durationSeconds: 40, renderMode: 'mock', voiceoverMode: 'provided_audio', providedAudioPath: 'local.wav' })
    });
    assert.equal(webProvidedAudioRes.status, 400);
    console.log('  [PASS] provided_audio rejected on web with 400 (CLI only)');

    // 4d. Google Cloud TTS without credentials rejected with 503
    const ttsWithoutCredsRes = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Đạo hàm là gì?', language: 'vi', durationSeconds: 40, renderMode: 'mock', voiceoverMode: 'google_cloud_tts' })
    });
    assert.equal(ttsWithoutCredsRes.status, 503);
    console.log('  [PASS] google_cloud_tts without ADC credentials rejected with 503');

    // STEP 5: Create a Brand New Job and Monitor Real Execution & State Transitions
    console.log('\n--- TEST 5: Create New Job & Monitor Real Transitions to Completion ---');
    const createRes = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Đạo hàm là gì?',
        language: 'vi',
        durationSeconds: 40,
        renderMode: 'mock',
        voiceoverMode: 'none',
        subtitlesEnabled: true
      })
    });
    assert.equal(createRes.status, 202, 'POST /api/jobs must return 202 Accepted');
    const createdJob = (await createRes.json()) as any;
    assert.ok(createdJob.jobId, 'Response must have jobId');
    assert.equal(createdJob.status, 'queued');
    console.log(`  [PASS] New job submitted: ${createdJob.jobId}`);

    // Poll until completed
    const observedStates = new Set<string>(['queued']);
    const maxWaitMs = 180_000; // 3 minutes max
    const pollStart = Date.now();
    let finalJobState: any = null;

    while (Date.now() - pollStart < maxWaitMs) {
      const pollRes = await fetch(`${BASE_URL}/api/jobs/${createdJob.jobId}`);
      if (pollRes.status === 200) {
        const data = (await pollRes.json()) as any;
        observedStates.add(data.status);
        process.stdout.write(`\r  Polling: status=${data.status}, progress=${data.progress}% [${data.message}]    `);
        if (data.status === 'completed' || data.status === 'failed') {
          finalJobState = data;
          break;
        }
      }
      await sleep(2000);
    }
    console.log('');

    assert.ok(finalJobState, 'Job must reach a terminal state');
    assert.equal(finalJobState.status, 'completed', `Job must complete successfully; error was: ${finalJobState.error}`);
    console.log('  Observed states during render:', Array.from(observedStates).join(' -> '));
    assert.ok(observedStates.size >= 3, 'Must observe multiple real state transitions');

    // STEP 6: Verify newly generated video on disk & via HTTP
    console.log('\n--- TEST 6: Verify Newly Rendered Video File & Endpoints ---');
    const newJobDir = resolve(repositoryRoot, 'outputs', createdJob.jobId);
    const newMp4Path = resolve(newJobDir, 'final.mp4');
    assert.ok(existsSync(newMp4Path), 'final.mp4 must exist in job output directory');

    // Run ffprobe validation on final.mp4
    const probed = await probeFinalVideo(newMp4Path, 30_000, false);
    assert.equal(probed.codec, 'h264');
    assert.equal(probed.width, 720);
    assert.equal(probed.height, 1280);
    assert.equal(probed.fps, 24);
    assert.equal(probed.frameCount, 960);
    assert.equal(probed.pixelFormat, 'yuv420p');
    assert.ok(Math.abs(probed.durationSeconds - 40) < 0.1);
    console.log(`  [PASS] New video probed with FFprobe: 720x1280, 24 FPS, 960 frames, 40s duration, h264 yuv420p (${probed.sizeBytes} bytes)`);

    // Test preview endpoint on new job
    const newVideoRes = await fetch(`${BASE_URL}${finalJobState.videoUrl}`);
    assert.equal(newVideoRes.status, 200);
    assert.equal(newVideoRes.headers.get('content-type'), 'video/mp4');
    const newVideoBytes = await newVideoRes.arrayBuffer();
    assert.equal(newVideoBytes.byteLength, probed.sizeBytes);
    console.log(`  [PASS] GET ${finalJobState.videoUrl} returned 200 with full ${newVideoBytes.byteLength} bytes`);

    // Test range on new job
    const newRangeRes = await fetch(`${BASE_URL}${finalJobState.videoUrl}`, {
      headers: { Range: 'bytes=0-511' }
    });
    assert.equal(newRangeRes.status, 206);
    assert.equal(newRangeRes.headers.get('content-range')?.startsWith('bytes 0-511/'), true);
    const newRangeBytes = await newRangeRes.arrayBuffer();
    assert.equal(newRangeBytes.byteLength, 512);
    console.log('  [PASS] Range request on new video returned 206 (512 bytes)');

    console.log('\n=== ALL PHASE 5 E2E & PERSISTENCE TESTS PASSED PERFECTLY ===\n');
  } finally {
    console.log('Stopping Next.js server...');
    if (nextProcess.pid) {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /pid ${nextProcess.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          // ignore if process already exited
        }
      } else {
        nextProcess.kill('SIGTERM');
      }
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ E2E VERIFICATION FAILED:', err);
    process.exit(1);
  });
