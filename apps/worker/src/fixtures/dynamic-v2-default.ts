import type { RenderManifestV2 } from '@luminalearn/scene-schema';

export const dynamicV2DefaultManifest: RenderManifestV2 = {
  schemaVersion: 'manifest-v2',
  manifestId: 'manifest_default_riemann',
  jobId: 'job-default-riemann-001',
  topicId: 'calculus.integral.riemann_sum',
  lessonTitle: 'Tổng Riemann và Trực giác Tích phân',
  language: 'vi',
  aspectRatio: '9:16',
  dimensions: { width: 720, height: 1280 },
  fps: 24,
  totalFrames: 960,
  timeline: [
    {
      id: 'scene_1_intro',
      sceneType: 'intro',
      templateId: 'function_graph',
      startFrame: 0,
      durationFrames: 144,
      content: {
        eyebrow: 'TRỰC GIÁC TÍCH PHÂN',
        title: 'Diện tích dưới đường cong tính như thế nào?',
        body: 'Khác với tam giác hay chữ nhật, biên cong đòi hỏi một phương pháp tư duy hoàn toàn mới.',
        formulas: []
      },
      parameters: {}
    },
    {
      id: 'scene_2_intuition',
      sceneType: 'concept',
      templateId: 'function_graph',
      startFrame: 144,
      durationFrames: 192,
      content: {
        eyebrow: 'Ý TƯỞNG CỐT LÕI',
        title: 'Xấp xỉ bằng các hình chữ nhật',
        body: 'Chia khoảng [0, 1] thành nhiều đoạn nhỏ. Diện tích mỗi cột chữ nhật là f(x) nhân với delta x.',
        formulas: ['f(x) = x²', 'Δx = 1/n', 'S_n = Σ f(x_i) Δx']
      },
      parameters: {}
    },
    {
      id: 'scene_3_clip',
      sceneType: 'animation',
      templateId: 'riemann_sum',
      startFrame: 336,
      durationFrames: 260,
      content: {
        title: 'Tăng dần số lượng hình chữ nhật',
        formulas: []
      },
      parameters: {}
    },
    {
      id: 'scene_4_math',
      sceneType: 'formula',
      templateId: 'function_graph',
      startFrame: 596,
      durationFrames: 216,
      content: {
        eyebrow: 'GIỚI HẠN VÔ CỰC',
        title: 'Từ tổng xấp xỉ đến tích phân',
        body: 'Khi n càng lớn, phần dư triệt tiêu. Giới hạn của tổng Riemann chính là giá trị tích phân.',
        formulas: ['S_n = (n-1)(2n-1) / (6n²)', 'lim_{n→∞} S_n = 1/3', '∫₀¹ x² dx = 1/3']
      },
      parameters: {}
    },
    {
      id: 'scene_5_summary',
      sceneType: 'summary',
      templateId: 'function_graph',
      startFrame: 812,
      durationFrames: 148,
      content: {
        eyebrow: 'TỔNG KẾT',
        title: 'Diện tích chính xác bằng 1/3.',
        body: 'Tích phân xác định là công cụ đo lường sự tích lũy liên tục qua tổng các đại lượng vô cùng bé.',
        formulas: []
      },
      parameters: {}
    }
  ],
  visualAssets: [],
  audioAssets: [],
  subtitleTrack: {
    trackId: 'sub_default',
    cues: [
      { id: 'cue_1', startFrame: 0, endFrame: 144, text: 'Diện tích dưới một đường cong cong được đo lường như thế nào?' },
      { id: 'cue_2', startFrame: 144, endFrame: 336, text: 'Ta có thể ước lượng diện tích bằng cách chia nó thành nhiều hình chữ nhật.' },
      { id: 'cue_3', startFrame: 336, endFrame: 596, text: 'Khi các hình chữ nhật ngày càng hẹp, tổng diện tích tiến gần đến giá trị tích phân.' },
      { id: 'cue_4', startFrame: 596, endFrame: 812, text: 'Tại vô cực, tổng Riemann bằng đúng một phần ba, khớp với tích phân của x bình phương.' },
      { id: 'cue_5', startFrame: 812, endFrame: 960, text: 'Tích phân xác định chính là giới hạn của tổng diện tích các hình chữ nhật.' }
    ]
  },
  verifiedClaims: [],
  sourceReferences: []
};
