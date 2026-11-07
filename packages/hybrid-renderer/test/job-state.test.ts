import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertJobTransition } from '../src/job-state';
import { HybridRenderRequestSchema } from '../src/request';

describe('Job state transitions', () => {
  it('accepts the real render lifecycle', () => {
    const states = ['queued', 'planning', 'validating', 'rendering_manim', 'narrating', 'synthesizing_audio', 'rendering_remotion', 'completed'] as const;
    for (let index = 1; index < states.length; index += 1) assert.doesNotThrow(() => assertJobTransition(states[index - 1], states[index]));
  });
  it('allows failure from active states and rejects fake completion', () => {
    assert.doesNotThrow(() => assertJobTransition('rendering_manim', 'failed'));
    assert.throws(() => assertJobTransition('queued', 'completed'));
    assert.throws(() => assertJobTransition('completed', 'planning'));
  });
});

describe('Hybrid render request', () => {
  it('accepts only the Vietnamese 40-second derivative MVP', () => {
    assert.equal(HybridRenderRequestSchema.safeParse({ topic: 'Đạo hàm là gì?', language: 'vi', durationSeconds: 40, renderMode: 'mock' }).success, true);
    assert.equal(HybridRenderRequestSchema.safeParse({ topic: 'Định lý Pythagoras', language: 'vi', durationSeconds: 40, renderMode: 'mock' }).success, false);
    assert.equal(HybridRenderRequestSchema.safeParse({ topic: 'Đạo hàm', language: 'en', durationSeconds: 40, renderMode: 'mock' }).success, false);
    assert.equal(HybridRenderRequestSchema.safeParse({ topic: 'Đạo hàm', language: 'vi', durationSeconds: 60, renderMode: 'mock' }).success, false);
    assert.equal(HybridRenderRequestSchema.safeParse({ topic: 'Đạo hàm', language: 'vi', durationSeconds: 40, renderMode: 'pretend-live' }).success, false);
    assert.equal(HybridRenderRequestSchema.safeParse({ topic: 'Đạo hàm', language: 'vi', durationSeconds: 40, renderMode: 'mock', voiceoverMode: 'provided_audio' }).success, false);
    assert.equal(HybridRenderRequestSchema.safeParse({ topic: 'Đạo hàm', language: 'vi', durationSeconds: 40, renderMode: 'mock', voiceoverMode: 'provided_audio', providedAudioPath: 'voice.mp3' }).success, true);
  });
});

