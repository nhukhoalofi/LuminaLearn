import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockGeminiAdapter, MathLessonPlanner } from '@luminalearn/agent';
import { buildHybridManifest } from '../src/manifest';

describe('Hybrid timeline builder', () => {
  it('uses probed clip frames and fills exactly 960 frames without stretching', async () => {
    const plan = await new MathLessonPlanner(new MockGeminiAdapter()).plan({ topic: 'Đạo hàm', targetAudience: 'Lớp 11', language: 'vi', durationSeconds: 40 });
    assert.equal(plan.status, 'ready'); if (plan.status !== 'ready') return;
    const manifest = buildHybridManifest({ jobId: 'job-test-12345678', renderMode: 'mock', draft: plan.draft, asset: { status: 'verified', fileName: 'manim-clip.mp4', codec: 'h264', width: 720, height: 1280, fps: 24, pixelFormat: 'yuv420p', durationSeconds: 8.041341, frameCount: 193, sizeBytes: 398244, verificationReportFile: 'verification-report.json' } });
    assert.equal(manifest.timelineScenes.at(-1)!.startFrame + manifest.timelineScenes.at(-1)!.durationFrames, 960);
    const clip = manifest.timelineScenes[1];
    assert.equal(clip.durationFrames, 193);
    if (clip.template === 'math_clip') assert.equal(clip.sourceDurationFrames, 193);
  });
});

