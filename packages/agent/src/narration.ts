import {
  NarrationScriptSchema,
  type HybridTimelineScene,
  type NarrationScript
} from '@luminalearn/scene-schema';
import { MathLessonDraftSchema, type MathLessonDraft } from './contracts';

export interface VerifiedDerivativeReport {
  status: 'verified';
  topicId: 'calculus.derivative.intuition';
  derivative: string;
  secantSlope: string;
  limitAtZero: string;
  slopeAtPoint: number;
}

function compact(expression: string): string {
  return expression.replace(/\s+/g, '').toLowerCase();
}

export function reviewNarrationMathematics(draftInput: MathLessonDraft, report: VerifiedDerivativeReport): void {
  const draft = MathLessonDraftSchema.parse(draftInput);
  if (report.status !== 'verified' || report.topicId !== draft.topicId) throw new Error('unsupported_mathematical_claim: verification report is not valid');
  const expected = new Map(draft.mathematicalClaims.map((claim) => [claim.validatorKey, compact(claim.expectedExpression)]));
  const reportValues = {
    polynomial_derivative: compact(report.derivative),
    secant_slope: compact(report.secantSlope),
    limit_at_zero: compact(report.limitAtZero),
    value_at_point: compact(String(report.slopeAtPoint))
  };
  for (const [key, value] of Object.entries(reportValues)) {
    const claimed = expected.get(key as keyof typeof reportValues);
    const equivalentSecant = key === 'secant_slope' && new Set([claimed, value]).size <= 2
      && [claimed, value].every((item) => item === 'h+2' || item === '2+h');
    if (!claimed || (claimed !== value && !equivalentSecant)) {
      throw new Error(`unsupported_mathematical_claim: ${key} does not match SymPy verification`);
    }
  }
}

function sceneDuration(scene: HybridTimelineScene): number {
  return scene.durationFrames / 24;
}

export class NarrationAgent {
  create(input: {
    draft: MathLessonDraft;
    verificationReport: VerifiedDerivativeReport;
    timelineScenes: HybridTimelineScene[];
    audience: string;
    language: 'vi';
  }): NarrationScript {
    reviewNarrationMathematics(input.draft, input.verificationReport);
    const byTemplate = new Map(input.timelineScenes.map((scene) => [scene.template, scene]));
    const definitions = [
      {
        template: 'hook', id: 'narration_hook',
        text: 'Độ nghiêng tại đúng một điểm được đo thế nào?',
        subtitleText: 'Độ nghiêng của đường cong tại một điểm\nđược đo như thế nào?',
        pronunciationHints: []
      },
      {
        template: 'math_clip', id: 'narration_geometry',
        text: 'Giữ điểm P cố định. Khi Q tiến gần P, cát tuyến dần xoay thành tiếp tuyến.',
        subtitleText: 'Khi Q tiến gần P, cát tuyến\ndần xoay thành tiếp tuyến.',
        pronunciationHints: [{ written: 'P, Q', spoken: 'pê, quy' }]
      },
      {
        template: 'equation_explanation', id: 'narration_equation',
        text: 'Với ép của x bằng x bình phương, hệ số góc cát tuyến là hai cộng hát. Khi hát tiến về không, giá trị này tiến về hai.',
        subtitleText: 'Hệ số góc cát tuyến là 2 + h.\nKhi h tiến về 0, giá trị tiến về 2.',
        pronunciationHints: [{ written: 'f(x) = x²', spoken: 'ép của x bằng x bình phương' }, { written: 'h', spoken: 'hát' }]
      },
      {
        template: 'intuition_formula', id: 'narration_formula',
        text: 'Vì thế, tại x bằng một, hệ số góc của tiếp tuyến bằng hai. Ta viết ép phẩy của một bằng hai.',
        subtitleText: 'Tại x = 1, hệ số góc tiếp tuyến bằng 2.\nTa viết f′(1) = 2.',
        pronunciationHints: [{ written: "f′(1) = 2", spoken: 'ép phẩy của một bằng hai' }]
      },
      {
        template: 'summary', id: 'narration_summary',
        text: 'Đạo hàm liên kết chuyển động trên đồ thị với tốc độ thay đổi tức thời của hàm số.',
        subtitleText: 'Đạo hàm là tốc độ thay đổi tức thời,\nvà là độ nghiêng của tiếp tuyến.',
        pronunciationHints: []
      }
    ] as const;

    const segments = definitions.map((definition) => {
      const scene = byTemplate.get(definition.template);
      if (!scene) throw new Error(`narration_scene_missing: ${definition.template}`);
      const targetDurationSeconds = Math.max(1, Number((sceneDuration(scene) - 0.35).toFixed(3)));
      const estimatedSeconds = definition.text.trim().split(/\s+/u).length / 3.1;
      if (estimatedSeconds > targetDurationSeconds) throw new Error(`narration_too_long: ${scene.id}`);
      return { id: definition.id, sceneId: scene.id, text: definition.text, subtitleText: definition.subtitleText, targetDurationSeconds, pronunciationHints: [...definition.pronunciationHints] };
    });

    return NarrationScriptSchema.parse({
      schemaVersion: 'narration-v1', topicId: input.draft.topicId, language: input.language,
      audience: input.audience, timingLevel: 'segment',
      mathematicalReview: { status: 'verified', verifiedClaimIds: input.draft.mathematicalClaims.map((claim) => claim.id) },
      segments
    });
  }
}
