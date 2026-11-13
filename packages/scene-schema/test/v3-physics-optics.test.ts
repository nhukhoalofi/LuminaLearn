import assert from 'node:assert/strict';
import test from 'node:test';
import { LessonRequestV3Schema, PhysicsOpticsVisualPayloadSchema } from '../src/v3';

const validPayload = {
  sceneType: 'physics_optics' as const,
  stage: 'exit_angles' as const,
  headline: 'Mỗi màu rời giọt nước ở một góc khác nhau',
  focusLabel: 'Cầu vồng chính: đỏ ở ngoài, tím ở trong',
  airRefractiveIndex: 1,
  waterRefractiveIndices: { red: 1.331, violet: 1.344 },
  primaryRainbowAnglesDeg: { red: 42.37, violet: 40.51 },
  showNormals: true,
  cameraMove: 'pull_out' as const,
  accentColor: '#38BDF8'
};

test('physics optics accepts angles tied to the current refractive indices', () => {
  assert.equal(PhysicsOpticsVisualPayloadSchema.safeParse(validPayload).success, true);
});

test('physics optics rejects invented rainbow angles and reversed dispersion', () => {
  assert.equal(PhysicsOpticsVisualPayloadSchema.safeParse({
    ...validPayload,
    primaryRainbowAnglesDeg: { red: 38, violet: 44 }
  }).success, false);
  assert.equal(PhysicsOpticsVisualPayloadSchema.safeParse({
    ...validPayload,
    waterRefractiveIndices: { red: 1.345, violet: 1.334 }
  }).success, false);
});

test('lesson request only enables the cinematic profile for physics', () => {
  const base = {
    requestId: 'req_physics_rainbow',
    domain: 'physics' as const,
    topic: 'Vì sao sau cơn mưa xuất hiện cầu vồng?',
    generationMode: 'mock' as const,
    targetDurationSeconds: 60,
    narrationMode: 'none' as const,
    subtitlesEnabled: true,
    fps: 30 as const,
    width: 1080 as const,
    height: 1920 as const
  };
  assert.equal(LessonRequestV3Schema.safeParse(base).success, true);
  assert.equal(LessonRequestV3Schema.safeParse({ ...base, domain: 'mathematics' }).success, false);
});
