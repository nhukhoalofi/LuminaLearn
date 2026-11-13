import { EducationalSceneV3Schema } from '@luminalearn/scene-schema';

export const phoneProcessSceneV3 = EducationalSceneV3Schema.parse({
  sceneId: 'sc_phone_preview',
  sceneType: 'physics_explainer',
  title: 'Tín hiệu đi qua sáu trạm',
  pedagogicalGoal: 'Phân biệt âm thanh, dữ liệu và sóng điện từ',
  durationSeconds: 10,
  boundClaimIds: ['claim_phone_radio'],
  rendererTarget: 'remotion_infographic',
  narration: {
    vietnamese: 'Dữ liệu giọng nói được mang qua liên kết vô tuyến rồi dựng lại ở đầu nhận.',
    subtitleVietnamese: 'Dữ liệu giọng nói được mang qua liên kết vô tuyến rồi dựng lại ở đầu nhận.'
  },
  visualPayload: {
    sceneType: 'physics_explainer',
    family: 'process_chain',
    beat: 'mechanism_b',
    headline: 'Giọng nói đi đâu sau khi vào điện thoại?',
    focusLabel: 'Theo dấu tín hiệu qua sáu trạm',
    insight: 'Âm → điện → số → sóng → số → điện → âm.',
    simulation: {
      kind: 'process_chain',
      nodes: ['Micro', 'ADC', 'Sóng', 'BTS', 'DAC', 'Loa'],
      activeNodeIndex: 3,
      carrierLabel: 'DỮ LIỆU'
    },
    cameraMove: 'track',
    accentColor: '#38BDF8'
  }
});

export const condensationParticleSceneV3 = EducationalSceneV3Schema.parse({
  sceneId: 'sc_condensation_preview',
  sceneType: 'physics_explainer',
  title: 'Chạm điểm sương: bắt đầu ngưng tụ',
  pedagogicalGoal: 'Liên hệ nhiệt độ bề mặt với điều kiện ngưng tụ',
  durationSeconds: 10,
  boundClaimIds: ['claim_condensation_dewpoint'],
  rendererTarget: 'remotion_infographic',
  narration: {
    vietnamese: 'Bề mặt lạnh hơn điểm sương làm hơi nước tụ lại thành giọt.',
    subtitleVietnamese: 'Bề mặt lạnh hơn điểm sương làm hơi nước tụ lại thành giọt.'
  },
  visualPayload: {
    sceneType: 'physics_explainer',
    family: 'particle_state',
    beat: 'mechanism_b',
    headline: 'Chạm điểm sương: bắt đầu ngưng tụ',
    focusLabel: 'Bề mặt 8°C · điểm sương minh họa 14°C',
    insight: 'Bề mặt đủ lạnh làm hơi nước chuyển thành giọt.',
    simulation: {
      kind: 'particle_state',
      particleCount: 34,
      temperature: 'low',
      phase: 'condensing',
      surfaceTemperatureC: 8,
      dewPointC: 14
    },
    cameraMove: 'macro',
    accentColor: '#34D399'
  }
});

export const soundWaveSceneV3 = EducationalSceneV3Schema.parse({
  sceneId: 'sc_sound_preview', sceneType: 'physics_explainer', title: 'Kiểm tra v = fλ', pedagogicalGoal: 'Liên hệ tần số, bước sóng và vận tốc', durationSeconds: 10, boundClaimIds: ['claim_sound_relation'], rendererTarget: 'remotion_infographic',
  narration: { vietnamese: 'Sáu trăm tám mươi héc nhân không phẩy năm mét bằng ba trăm bốn mươi mét trên giây.', subtitleVietnamese: '680 Hz × 0,50 m = 340 m/s.' },
  visualPayload: { sceneType: 'physics_explainer', family: 'wave_propagation', beat: 'evidence', headline: 'Kiểm tra vận tốc truyền âm', focusLabel: '680 Hz × 0,50 m = 340 m/s', insight: 'Tần số, bước sóng và vận tốc phải nhất quán.', simulation: { kind: 'wave', amplitude: 72, spatialFrequency: 3.4, propagationSpeed: 4, wavelengthLabel: 'λ = 0,50 m', relationLabel: 'v = fλ', frequencyHz: 680, wavelengthMeters: 0.5, physicalSpeedMps: 340 }, cameraMove: 'track', accentColor: '#38BDF8' }
});

export const projectileSceneV3 = EducationalSceneV3Schema.parse({
  sceneId: 'sc_projectile_preview', sceneType: 'physics_explainer', title: 'Quỹ đạo ném xiên', pedagogicalGoal: 'Tách chuyển động ngang và đứng', durationSeconds: 10, boundClaimIds: ['claim_projectile_path'], rendererTarget: 'remotion_infographic',
  narration: { vietnamese: 'Chuyển động ngang đều kết hợp với rơi tự do tạo nên quỹ đạo parabol.', subtitleVietnamese: 'Ngang đều + rơi tự do = quỹ đạo parabol.' },
  visualPayload: { sceneType: 'physics_explainer', family: 'force_motion', beat: 'evidence', headline: 'Vì sao quỹ đạo là một parabol?', focusLabel: 'v₀ = 20 m/s · θ = 45° · g = 9,8 m/s²', insight: 'Ngang đều kết hợp chuyển động đứng biến đổi đều.', simulation: { kind: 'force_motion', objectType: 'projectile', motionModel: 'projectile', formula: 'x=v₀cosθ·t; y=v₀sinθ·t−gt²/2', forces: [{ label: 'P = mg', color: '#FBBF24', angleDeg: 90, magnitude: 100 }], gravityMps2: 9.8, initialSpeedMps: 20, launchAngleDeg: 45 }, cameraMove: 'pull_out', accentColor: '#38BDF8' }
});

const pendulumPeriod = 2 * Math.PI * Math.sqrt(1 / 9.8);
export const pendulumSceneV3 = EducationalSceneV3Schema.parse({
  sceneId: 'sc_pendulum_preview', sceneType: 'physics_explainer', title: 'Chu kỳ con lắc đơn', pedagogicalGoal: 'Kiểm tra công thức góc nhỏ', durationSeconds: 10, boundClaimIds: ['claim_pendulum_period'], rendererTarget: 'remotion_infographic',
  narration: { vietnamese: 'Với dây dài một mét, chu kỳ góc nhỏ xấp xỉ hai phẩy không một giây.', subtitleVietnamese: 'L = 1 m → T ≈ 2,01 s trong mô hình góc nhỏ.' },
  visualPayload: { sceneType: 'physics_explainer', family: 'force_motion', beat: 'evidence', headline: 'Chu kỳ phụ thuộc chiều dài dây', focusLabel: 'T = 2π√(L/g) ≈ 2,01 s', insight: 'Dây càng dài, chu kỳ dao động càng lớn.', simulation: { kind: 'force_motion', objectType: 'pendulum', motionModel: 'oscillatory', formula: 'T = 2π√(L/g)', forces: [{ label: 'P = mg', color: '#FBBF24', angleDeg: 90, magnitude: 115 }, { label: 'T dây', color: '#38BDF8', angleDeg: 270, magnitude: 100 }], gravityMps2: 9.8, pendulumLengthM: 1, periodSeconds: pendulumPeriod }, cameraMove: 'track', accentColor: '#38BDF8' }
});

export const energySceneV3 = EducationalSceneV3Schema.parse({
  sceneId: 'sc_energy_preview', sceneType: 'physics_explainer', title: 'Bảo toàn cơ năng', pedagogicalGoal: 'Theo dõi chuyển hóa động năng và thế năng', durationSeconds: 10, boundClaimIds: ['claim_energy_conservation'], rendererTarget: 'remotion_infographic',
  narration: { vietnamese: 'Động năng và thế năng đổi tỉ lệ nhưng tổng cơ năng vẫn không đổi trong hệ lý tưởng.', subtitleVietnamese: 'K + U = E không đổi trong hệ lý tưởng.' },
  visualPayload: { sceneType: 'physics_explainer', family: 'energy_transfer', beat: 'takeaway', headline: 'Năng lượng chuyển dạng, không biến mất', focusLabel: 'K = 35% · U = 65%', insight: 'Bảo toàn tổng không có nghĩa từng dạng giữ nguyên.', simulation: { kind: 'energy_transfer', kineticFraction: 0.35, potentialFraction: 0.65, totalEnergyLabel: 'E = K + U = 100%' }, cameraMove: 'track', accentColor: '#FBBF24' }
});
