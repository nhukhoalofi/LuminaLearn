import type { HybridVideoManifest } from '@luminalearn/scene-schema';

export const hybridDefaultManifest: HybridVideoManifest = {
  schemaVersion: 'hybrid-v1',
  jobId: 'job-preview-12345678',
  topicId: 'calculus.derivative.intuition',
  lessonTitle: 'Đạo hàm là gì? — Từ cát tuyến đến tiếp tuyến',
  language: 'vi',
  renderMode: 'mock',
  videoSettings: { width: 720, height: 1280, fps: 24, durationFrames: 960 },
  verifiedMathClaims: [
    { id: 'claim_derivative', statement: 'Đạo hàm của x² là 2x.', expectedExpression: '2*x', verificationStatus: 'verified' },
    { id: 'claim_secant', statement: 'Hệ số góc cát tuyến là 2+h.', expectedExpression: '2+h', verificationStatus: 'verified' },
    { id: 'claim_limit', statement: 'Khi h tiến tới 0, hệ số góc tiến tới 2.', expectedExpression: '2', verificationStatus: 'verified' },
    { id: 'claim_value', statement: 'Đạo hàm tại x=1 bằng 2.', expectedExpression: '2', verificationStatus: 'verified' }
  ],
  mathClipAssets: [{
    id: 'asset_manim', publicPath: 'generated/job-preview-12345678/math-clip.mp4',
    durationSeconds: 8.041341, frameCount: 193, fps: 24, width: 720, height: 1280,
    codec: 'h264', pixelFormat: 'yuv420p', verificationStatus: 'verified', verificationReportFile: 'verification-report.json'
  }],
  timelineScenes: [
    { id: 'scene_hook', template: 'hook', startFrame: 0, durationFrames: 120, content: { eyebrow: 'TRỰC GIÁC GIẢI TÍCH', title: 'Đạo hàm thực sự cho chúng ta biết điều gì?', body: 'Hãy nhìn vào độ nghiêng đang thay đổi trên một đường cong.' } },
    { id: 'scene_geometry', template: 'math_clip', startFrame: 120, durationFrames: 193, assetId: 'asset_manim', sourceStartFrame: 0, sourceDurationFrames: 193, content: { title: 'Từ cát tuyến đến tiếp tuyến' } },
    { id: 'scene_math', template: 'equation_explanation', startFrame: 313, durationFrames: 263, content: { eyebrow: 'TỪ HÌNH HỌC ĐẾN ĐẠI SỐ', title: 'Hệ số góc cát tuyến', body: 'Q cách P một khoảng h. Khi Q tiến gần P, h tiến về 0 nhưng không bằng 0.', formulas: ['m(h) = [f(1+h) − f(1)] / h', 'f(x) = x²  ⇒  m(h) = 2 + h', 'h → 0  ⇒  m(h) → 2'] } },
    { id: 'scene_formula', template: 'intuition_formula', startFrame: 576, durationFrames: 216, content: { eyebrow: 'TRỰC GIÁC GẶP CÔNG THỨC', title: "f′(1) = 2", body: 'Độ nghiêng tức thời tại P chính là hệ số góc của tiếp tuyến: bằng 2.', formulas: ['f′(x) = 2x', 'f′(1) = 2'] } },
    { id: 'scene_summary', template: 'summary', startFrame: 792, durationFrames: 168, content: { eyebrow: 'KẾT LUẬN', title: 'Đạo hàm mô tả tốc độ thay đổi tức thời của hàm số.', body: 'Về hình học, đó là hệ số góc của tiếp tuyến tại điểm đang xét, khi đạo hàm tồn tại.' } }
  ],
  voiceoverMode: 'none',
  narrationAudioAssets: [],
  outputSettings: { codec: 'h264', pixelFormat: 'yuv420p', fileName: 'final.mp4' }
};

