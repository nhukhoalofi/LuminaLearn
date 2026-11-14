import { defaultTemplateRegistry, type MathTemplateRegistry } from '@luminalearn/scene-schema';
import { verifyNarrationAndStoryboardMathConsistency } from './math-verifier';
import type { OrchestrationContext } from './types';

export interface QualityReviewResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class QualityReviewer {
  constructor(private readonly registry: MathTemplateRegistry = defaultTemplateRegistry) {}

  public review(context: OrchestrationContext): QualityReviewResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Kiểm định tính toán học hình thức & tính nhất quán của mệnh đề (Mathematical & Statement Consistency Gate)
    if (context.lessonPlan) {
      for (const claim of context.lessonPlan.mathematicalClaims) {
        if (claim.statementVerification === 'conflict_detected') {
          errors.push(
            `statement_expression_conflict: Mệnh đề hiển thị của '${claim.id}' mâu thuẫn với biểu thức đã kiểm định '${claim.expectedExpression}'.`
          );
        } else if (claim.statementVerification === 'prose_unverified' && !claim.humanSemanticReviewConfirmed) {
          errors.push(
            `statement_requires_semantic_review: Mệnh đề '${claim.id}' chứa diễn giải tự do chưa được giáo viên xác nhận ngữ nghĩa.`
          );
        }

        if (claim.verificationStatus === 'failed') {
          errors.push(`mathematical_verification_failed: Mệnh đề '${claim.id}' bị kiểm định thất bại bởi validator hình thức.`);
        } else if (claim.verificationStatus === 'unverified') {
          warnings.push(`claim_unverified: Mệnh đề '${claim.id}' chưa được kiểm định SymPy.`);
        }
      }
    }

    // 2. Kiểm định tính hỗ trợ của Visual Templates (Template Support Gate)
    if (context.storyboard) {
      for (const scene of context.storyboard.scenes) {
        if (!this.registry.has(scene.templateId)) {
          errors.push(`unsupported_visualization: Template '${scene.templateId}' trong scene '${scene.sceneId}' chưa được đăng ký trong Registry.`);
        } else {
          try {
            this.registry.validateParameters(scene.templateId, scene.parameters);
          } catch (err) {
            errors.push(`invalid_template_parameters: Tham số scene '${scene.sceneId}' không hợp lệ: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // 3. Kiểm định tính nhất quán của Timeline (Timeline Consistency Gate)
      const sumFrames = context.storyboard.scenes.reduce((sum, s) => sum + s.durationFrames, 0);
      if (Math.abs(sumFrames - context.storyboard.estimatedDurationFrames) > 5) {
        errors.push(`timeline_inconsistency: Tổng số frames của các scene (${sumFrames}) lệch so với estimatedDurationFrames (${context.storyboard.estimatedDurationFrames}).`);
      }
    }

    // 4. Kiểm định độ phủ và tính nhất quán toán học của lời dẫn/phụ đề (Narration Coverage & Math Consistency Gate)
    if (context.storyboard && context.narrationPlan) {
      const sceneIds = new Set(context.storyboard.scenes.map((s) => s.sceneId));
      for (const seg of context.narrationPlan.segments) {
        if (!sceneIds.has(seg.sceneId)) {
          errors.push(`narration_orphan_segment: Lời dẫn '${seg.segmentId}' tham chiếu scene '${seg.sceneId}' không tồn tại.`);
        }
      }
      for (const scene of context.storyboard.scenes) {
        const hasNarration = context.narrationPlan.segments.some((seg) => seg.sceneId === scene.sceneId);
        if (!hasNarration) {
          warnings.push(`scene_missing_narration: Scene '${scene.sceneId}' chưa có phân đoạn lời dẫn tương ứng.`);
        }
      }
    }

    if (context.lessonPlan && (context.narrationPlan || context.storyboard)) {
      const narrationMathCheck = verifyNarrationAndStoryboardMathConsistency({
        claims: context.lessonPlan.mathematicalClaims,
        narrationPlan: context.narrationPlan,
        storyboard: context.storyboard
      });
      if (!narrationMathCheck.valid) {
        errors.push(...narrationMathCheck.conflicts);
      }
    }

    // 5. Kiểm định nguồn tài liệu đối với source_document (Document Grounding Gate)
    if (context.request.inputMode === 'source_document') {
      if (!context.documentAnalysis || context.documentAnalysis.totalChunks === 0) {
        errors.push('source_evidence_missing: Chế độ source_document yêu cầu tài liệu đã qua trích xuất nhưng không có chunk nào.');
      } else if (context.lessonPlan) {
        if (context.lessonPlan.sourceEvidence.length === 0) {
          errors.push('source_evidence_missing: Kế hoạch bài học từ tài liệu không có bằng chứng trích dẫn.');
        }
        for (const ev of context.lessonPlan.sourceEvidence) {
          if (!ev.evidenceFound || ev.quoteExists === false) {
            errors.push(`source_evidence_unverified: Trích dẫn '${ev.evidenceId}' không tồn tại nguyên văn trong tài liệu.`);
          } else if (ev.supportStatus && ev.supportStatus !== 'supported') {
            errors.push(`source_claim_unsupported: Trích dẫn '${ev.evidenceId}' không đủ bằng chứng hỗ trợ mệnh đề toán học (${ev.supportStatus}).`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
