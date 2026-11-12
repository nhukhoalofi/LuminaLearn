import type { EducationalSceneV3 } from '@luminalearn/scene-schema';

export const mathTypographySceneV3: EducationalSceneV3 = {
  sceneId: 'scene_math_typography_qa',
  sceneType: 'formula_derivation',
  title: 'Đạo hàm từ cát tuyến đến tiếp tuyến',
  pedagogicalGoal: 'Đọc đúng định nghĩa giới hạn của đạo hàm và kết quả cho hàm bình phương.',
  durationSeconds: 10,
  boundClaimIds: ['claim_derivative_qa'],
  rendererTarget: 'remotion_infographic',
  narration: {
    vietnamese: 'Đạo hàm là giới hạn của tỉ số biến thiên khi h tiến về không.',
    subtitleVietnamese: 'Giới hạn của cát tuyến tạo thành hệ số góc tiếp tuyến.'
  },
  visualPayload: {
    sceneType: 'formula_derivation',
    headline: 'Định nghĩa đạo hàm',
    formulaTex: "f'(x)=\\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}=2x",
    notes: 'Biểu thức được typeset bằng KaTeX; trạng thái kiểm định vẫn thuộc artifact.'
  }
};
