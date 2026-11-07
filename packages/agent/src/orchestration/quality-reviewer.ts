import { defaultTemplateRegistry, type MathTemplateRegistry } from '@luminalearn/scene-schema';
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

    // 1. Kiểm định tính toán học hình thức (Mathematical Verification Gate)
    if (context.lessonPlan) {
      for (const claim of context.lessonPlan.mathematicalClaims) {
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

    // 4. Kiểm định độ phủ của lời dẫn (Narration Coverage Gate)
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

    // 5. Kiểm định nguồn tài liệu đối với source_document (Document Grounding Gate)
    if (context.request.inputMode === 'source_document') {
      if (!context.documentAnalysis || context.documentAnalysis.totalChunks === 0) {
        errors.push('source_evidence_missing: Chế độ source_document yêu cầu tài liệu đã qua trích xuất nhưng không có chunk nào.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

