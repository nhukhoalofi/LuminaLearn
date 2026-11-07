import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertValidJobId, resolveInside, validateProbeOutput } from '../src/index';

const probe = {
  streams: [{ codec_type: 'video', codec_name: 'h264', width: 720, height: 1280, pix_fmt: 'yuv420p', r_frame_rate: '24/1', nb_frames: '193', nb_read_frames: '193' }],
  format: { duration: '8.041341', size: '398244' }
};

describe('Video asset verification', () => {
  it('accepts verified Manim metadata and preserves exact frame count', () => {
    const result = validateProbeOutput(probe, 'verification-report.json');
    assert.equal(result.frameCount, 193); assert.equal(result.fps, 24);
  });
  it('rejects invalid codec, resolution, FPS, and duration', () => {
    assert.throws(() => validateProbeOutput({ ...probe, streams: [{ ...probe.streams[0], codec_name: 'vp9' }] }, 'report.json'));
    assert.throws(() => validateProbeOutput({ ...probe, streams: [{ ...probe.streams[0], width: 1080 }] }, 'report.json'));
    assert.throws(() => validateProbeOutput({ ...probe, streams: [{ ...probe.streams[0], r_frame_rate: '30/1' }] }, 'report.json'));
    assert.throws(() => validateProbeOutput({ ...probe, format: { ...probe.format, duration: '0' } }, 'report.json'));
  });
  it('rejects path traversal', () => {
    assert.throws(() => resolveInside('D:/jobs/job-test-12345678', '..', 'secret.mp4'), /traversal/);
  });
  it('validates system-generated job IDs', () => {
    assert.doesNotThrow(() => assertValidJobId('job-20261107-abcdef12'));
    assert.throws(() => assertValidJobId('../job-evil'));
  });
});

