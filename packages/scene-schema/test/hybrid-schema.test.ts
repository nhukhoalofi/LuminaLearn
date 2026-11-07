import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateHybridVideoManifest } from '../src/index';

const manifest = {
  schemaVersion: 'hybrid-v1', jobId: 'job-test-12345678', topicId: 'calculus.derivative.intuition',
  lessonTitle: 'Đạo hàm là gì? — Từ cát tuyến đến tiếp tuyến', language: 'vi', renderMode: 'mock',
  videoSettings: { width: 720, height: 1280, fps: 24, durationFrames: 960 },
  verifiedMathClaims: [
    { id: 'claim_derivative', statement: 'Đạo hàm của x² là 2x.', expectedExpression: '2*x', verificationStatus: 'verified' },
    { id: 'claim_secant', statement: 'Hệ số góc cát tuyến là 2+h.', expectedExpression: '2+h', verificationStatus: 'verified' },
    { id: 'claim_limit', statement: 'Giới hạn bằng 2.', expectedExpression: '2', verificationStatus: 'verified' },
    { id: 'claim_value', statement: 'Đạo hàm tại 1 bằng 2.', expectedExpression: '2', verificationStatus: 'verified' }
  ],
  mathClipAssets: [{ id: 'asset_manim', publicPath: 'generated/job-test-12345678/math-clip.mp4', durationSeconds: 8.041341, frameCount: 193, fps: 24, width: 720, height: 1280, codec: 'h264', pixelFormat: 'yuv420p', verificationStatus: 'verified', verificationReportFile: 'verification-report.json' }],
  timelineScenes: [
    { id: 'scene_hook', template: 'hook', startFrame: 0, durationFrames: 120, content: { title: 'Đạo hàm thực sự cho chúng ta biết điều gì?' } },
    { id: 'scene_geometry', template: 'math_clip', startFrame: 120, durationFrames: 193, assetId: 'asset_manim', sourceStartFrame: 0, sourceDurationFrames: 193, content: { title: 'Từ cát tuyến đến tiếp tuyến' } },
    { id: 'scene_math', template: 'equation_explanation', startFrame: 313, durationFrames: 263, content: { title: 'Hệ số góc cát tuyến', formulas: ['m(h) = [f(1+h)-f(1)]/h', 'm(h) = 2+h', 'h → 0 ⇒ m(h) → 2'] } },
    { id: 'scene_formula', template: 'intuition_formula', startFrame: 576, durationFrames: 216, content: { title: "f'(1) = 2", body: 'Độ nghiêng tức thời chính là hệ số góc tiếp tuyến.' } },
    { id: 'scene_summary', template: 'summary', startFrame: 792, durationFrames: 168, content: { title: 'Đạo hàm mô tả tốc độ thay đổi tức thời.', body: 'Khi đạo hàm tồn tại.' } }
  ],
  outputSettings: { codec: 'h264', pixelFormat: 'yuv420p', fileName: 'final.mp4' }
};

describe('HybridVideoManifest', () => {
  it('accepts a contiguous 960-frame manifest', () => assert.equal(validateHybridVideoManifest(manifest).success, true));
  it('rejects a missing asset', () => assert.equal(validateHybridVideoManifest({ ...manifest, mathClipAssets: [] }).success, false));
  it('rejects an invalid total duration', () => {
    const scenes = structuredClone(manifest.timelineScenes); scenes[4].durationFrames = 160;
    assert.equal(validateHybridVideoManifest({ ...manifest, timelineScenes: scenes }).success, false);
  });
  it('rejects unsupported topic and render mode', () => {
    assert.equal(validateHybridVideoManifest({ ...manifest, topicId: 'geometry.circle' }).success, false);
    assert.equal(validateHybridVideoManifest({ ...manifest, renderMode: 'pretend-live' }).success, false);
  });
  it('checks ordering and frame offsets', () => {
    const scenes = structuredClone(manifest.timelineScenes); scenes[2].startFrame = 314;
    assert.equal(validateHybridVideoManifest({ ...manifest, timelineScenes: scenes }).success, false);
  });
  it('rejects path traversal and cross-job assets', () => {
    const badPath = structuredClone(manifest.mathClipAssets); badPath[0].publicPath = 'generated/job-test-12345678/../secret.mp4';
    assert.equal(validateHybridVideoManifest({ ...manifest, mathClipAssets: badPath }).success, false);
    const otherJob = structuredClone(manifest.mathClipAssets); otherJob[0].publicPath = 'generated/job-other-12345678/math-clip.mp4';
    assert.equal(validateHybridVideoManifest({ ...manifest, mathClipAssets: otherJob }).success, false);
  });
  it('does not allow stretching the math clip', () => {
    const scenes = structuredClone(manifest.timelineScenes); scenes[1].durationFrames = 194; scenes[2].startFrame = 314;
    assert.equal(validateHybridVideoManifest({ ...manifest, timelineScenes: scenes }).success, false);
  });
});
