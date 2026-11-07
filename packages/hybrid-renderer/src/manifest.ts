import {
  HybridVideoManifestSchema,
  type HybridVideoManifest,
  type NarrationAudioAsset,
  type NarrationScript,
  type SubtitleTrack
} from '@luminalearn/scene-schema';
import type { MathLessonDraft as AgentMathLessonDraft } from '@luminalearn/agent';
import type { VerifiedVideoMetadata } from './ffprobe';

export function buildHybridManifest(options: {
  jobId: string;
  renderMode: 'mock' | 'live';
  draft: AgentMathLessonDraft;
  asset: VerifiedVideoMetadata;
  voiceoverMode?: 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts';
  narrationScript?: NarrationScript;
  narrationAudioAssets?: NarrationAudioAsset[];
  subtitles?: SubtitleTrack;
}): HybridVideoManifest {
  const { jobId, renderMode, draft, asset } = options;
  const hookFrames = 120;
  const remainingTextFrames = 960 - hookFrames - asset.frameCount;
  if (remainingTextFrames < 360) throw new Error('Verified Manim clip leaves insufficient pedagogical timeline space');
  const equationFrames = Math.floor(remainingTextFrames * 0.41);
  const intuitionFrames = Math.floor(remainingTextFrames * 0.34);
  const summaryFrames = remainingTextFrames - equationFrames - intuitionFrames;
  const geometryStart = hookFrames;
  const equationStart = geometryStart + asset.frameCount;
  const intuitionStart = equationStart + equationFrames;
  const summaryStart = intuitionStart + intuitionFrames;

  return HybridVideoManifestSchema.parse({
    schemaVersion: 'hybrid-v1', jobId, topicId: 'calculus.derivative.intuition',
    lessonTitle: draft.lessonTitle, language: 'vi', renderMode,
    videoSettings: { width: 720, height: 1280, fps: 24, durationFrames: 960 },
    verifiedMathClaims: draft.mathematicalClaims.map((claim) => ({
      id: claim.id, statement: claim.statement, expectedExpression: claim.expectedExpression, verificationStatus: 'verified'
    })),
    mathClipAssets: [{
      id: 'asset_manim', publicPath: `generated/${jobId}/math-clip.mp4`,
      durationSeconds: asset.durationSeconds, frameCount: asset.frameCount, fps: asset.fps,
      width: asset.width, height: asset.height, codec: asset.codec, pixelFormat: asset.pixelFormat,
      verificationStatus: 'verified', verificationReportFile: asset.verificationReportFile
    }],
    timelineScenes: [
      { id: 'scene_hook', template: 'hook', startFrame: 0, durationFrames: hookFrames, content: { eyebrow: 'TRỰC GIÁC GIẢI TÍCH', title: 'Đạo hàm thực sự cho chúng ta biết điều gì?', body: 'Hãy nhìn vào độ nghiêng đang thay đổi trên một đường cong.' } },
      { id: 'scene_geometry', template: 'math_clip', startFrame: geometryStart, durationFrames: asset.frameCount, assetId: 'asset_manim', sourceStartFrame: 0, sourceDurationFrames: asset.frameCount, content: { title: 'Từ cát tuyến đến tiếp tuyến' } },
      { id: 'scene_math', template: 'equation_explanation', startFrame: equationStart, durationFrames: equationFrames, content: { eyebrow: 'TỪ HÌNH HỌC ĐẾN ĐẠI SỐ', title: 'Hệ số góc cát tuyến', body: 'Q cách P một khoảng h. Khi Q tiến gần P, h tiến về 0 nhưng không bằng 0.', formulas: ['m(h) = [f(1+h) − f(1)] / h', 'f(x) = x²  ⇒  m(h) = 2 + h', 'h → 0  ⇒  m(h) → 2'] } },
      { id: 'scene_formula', template: 'intuition_formula', startFrame: intuitionStart, durationFrames: intuitionFrames, content: { eyebrow: 'TRỰC GIÁC GẶP CÔNG THỨC', title: "f′(1) = 2", body: 'Độ nghiêng tức thời tại P chính là hệ số góc của tiếp tuyến: bằng 2.', formulas: ['f′(x) = 2x', 'f′(1) = 2'] } },
      { id: 'scene_summary', template: 'summary', startFrame: summaryStart, durationFrames: summaryFrames, content: { eyebrow: 'KẾT LUẬN', title: 'Đạo hàm mô tả tốc độ thay đổi tức thời của hàm số.', body: 'Về hình học, đó là hệ số góc của tiếp tuyến tại điểm đang xét, khi đạo hàm tồn tại.' } }
    ],
    voiceoverMode: options.voiceoverMode ?? 'none',
    narrationScript: options.narrationScript,
    narrationAudioAssets: options.narrationAudioAssets ?? [],
    subtitles: options.subtitles,
    outputSettings: { codec: 'h264', pixelFormat: 'yuv420p', fileName: 'final.mp4' }
  });
}

