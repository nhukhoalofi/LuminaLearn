import assert from 'node:assert/strict';
import test from 'node:test';
import { LessonRequestV3Schema, PhysicsExplainerVisualPayloadSchema, PhysicsOpticsVisualPayloadSchema } from '../src/v3';

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

test('physics explainer validates process-chain identity and active node', () => {
  const payload = {
    sceneType: 'physics_explainer',
    family: 'process_chain',
    beat: 'mechanism_a',
    headline: 'Tín hiệu đi qua từng trạm',
    focusLabel: 'Micro đến loa',
    insight: 'Mỗi trạm thực hiện một phép biến đổi.',
    simulation: { kind: 'process_chain', nodes: ['Micro', 'ADC', 'Sóng'], activeNodeIndex: 1, carrierLabel: 'BIT SỐ' },
    cameraMove: 'track',
    accentColor: '#38BDF8'
  };
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse(payload).success, true);
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...payload, simulation: { ...payload.simulation, activeNodeIndex: 4 } }).success, false);
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...payload, family: 'particle_state' }).success, false);
});

test('condensation requires a surface at or below the dew point', () => {
  const base = {
    sceneType: 'physics_explainer', family: 'particle_state', beat: 'mechanism_b',
    headline: 'Chạm điểm sương', focusLabel: 'Hơi nước bắt đầu ngưng tụ', insight: 'Bề mặt đủ lạnh tạo giọt.',
    cameraMove: 'macro', accentColor: '#38BDF8'
  };
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: { kind: 'particle_state', particleCount: 30, temperature: 'low', phase: 'condensing', surfaceTemperatureC: 8, dewPointC: 14 } }).success, true);
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: { kind: 'particle_state', particleCount: 30, temperature: 'low', phase: 'condensing', surfaceTemperatureC: 18, dewPointC: 14 } }).success, false);
});

test('wave payload enforces v = f lambda when physical values are supplied', () => {
  const base = {
    sceneType: 'physics_explainer', family: 'wave_propagation', beat: 'evidence',
    headline: 'Kiểm tra sóng âm', focusLabel: 'v = fλ', insight: 'Ba đại lượng phải nhất quán.',
    cameraMove: 'track', accentColor: '#38BDF8'
  };
  const simulation = { kind: 'wave', amplitude: 70, spatialFrequency: 3, propagationSpeed: 4, wavelengthLabel: 'λ = 0,5 m', relationLabel: '340 = 680 × 0,5', frequencyHz: 680, wavelengthMeters: 0.5, physicalSpeedMps: 340 };
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation }).success, true);
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: { ...simulation, physicalSpeedMps: 300 } }).success, false);
});

test('force payload validates Newton dynamics, projectile parameters and pendulum period', () => {
  const base = {
    sceneType: 'physics_explainer', family: 'force_motion', beat: 'evidence',
    headline: 'Kiểm tra động lực học', focusLabel: 'Mô hình số', insight: 'Các tham số phải nhất quán.',
    cameraMove: 'track', accentColor: '#38BDF8'
  };
  const force = { kind: 'force_motion', objectType: 'box', motionModel: 'static', formula: 'F = ma', forces: [{ label: 'F', color: '#38BDF8', angleDeg: 0, magnitude: 100 }], massKg: 2, accelerationMps2: 3, netForceN: 6 };
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: force }).success, true);
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: { ...force, netForceN: 7 } }).success, false);

  const projectile = { kind: 'force_motion', objectType: 'projectile', motionModel: 'projectile', formula: 'x(t), y(t)', forces: [{ label: 'P', color: '#FBBF24', angleDeg: 90, magnitude: 100 }], gravityMps2: 9.8, initialSpeedMps: 20, launchAngleDeg: 45 };
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: projectile }).success, true);
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: { ...projectile, gravityMps2: undefined } }).success, false);

  const period = 2 * Math.PI * Math.sqrt(1 / 9.8);
  const pendulum = { kind: 'force_motion', objectType: 'pendulum', motionModel: 'oscillatory', formula: 'T = 2π√(L/g)', forces: [{ label: 'P', color: '#FBBF24', angleDeg: 90, magnitude: 100 }], gravityMps2: 9.8, pendulumLengthM: 1, periodSeconds: period };
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: pendulum }).success, true);
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: { ...pendulum, periodSeconds: 3 } }).success, false);
});

test('energy transfer requires a conserved total', () => {
  const base = {
    sceneType: 'physics_explainer', family: 'energy_transfer', beat: 'mechanism_a',
    headline: 'Chuyển hóa cơ năng', focusLabel: 'K + U', insight: 'Tổng không đổi trong hệ lý tưởng.',
    cameraMove: 'track', accentColor: '#38BDF8'
  };
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: { kind: 'energy_transfer', kineticFraction: 0.35, potentialFraction: 0.65, totalEnergyLabel: 'E = 100%' } }).success, true);
  assert.equal(PhysicsExplainerVisualPayloadSchema.safeParse({ ...base, simulation: { kind: 'energy_transfer', kineticFraction: 0.35, potentialFraction: 0.8, totalEnergyLabel: 'E = 115%' } }).success, false);
});
