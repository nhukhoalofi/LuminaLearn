import { z } from 'zod';
import { GroundingEvidenceSchema, NoExecutableString, SafeIdString } from '../v2/document';
import {
  EducationalDomainSchema,
  RendererTargetSchema,
  TopicCapabilityReportV3Schema
} from './capability';
import { EducationalVisualPayloadSchema, type EducationalVisualPayload } from './visual-dsl';

export const LESSON_SCHEMA_VERSION_V3 = 'lesson-v3' as const;
export const GenerationProvenanceV3Schema = z.enum(['deterministic_mock', 'ai_generated_live']);
export type GenerationProvenanceV3 = z.infer<typeof GenerationProvenanceV3Schema>;

export const EducationalClaimTypeSchema = z.enum([
  'formal_mathematics',
  'ai_concept',
  'algorithmic_property',
  'empirical_observation'
]);
export type EducationalClaimType = z.infer<typeof EducationalClaimTypeSchema>;

export const EducationalVerificationStatusSchema = z.enum([
  'formally_verified',
  'numerically_validated',
  'source_grounded',
  'human_review_required',
  'unverified',
  'rejected'
]);
export type EducationalVerificationStatus = z.infer<typeof EducationalVerificationStatusSchema>;

export const StatementSemanticStatusSchema = z.enum([
  'formal_match',
  'human_review_required',
  'contradiction_detected'
]);
export type StatementSemanticStatus = z.infer<typeof StatementSemanticStatusSchema>;

/**
 * Mệnh đề tri thức giáo dục V3 (EducationalClaimV3)
 * Phân biệt rành mạch giữa chứng minh hình thức toán học và khái niệm AI định tính.
 */
export const EducationalClaimV3Schema = z.object({
  id: SafeIdString,
  claimType: EducationalClaimTypeSchema,
  statement: NoExecutableString,
  formalExpression: z.string().trim().max(300).optional(),
  validatorKey: z.string().regex(/^[a-z0-9_]{3,64}$/).optional(),
  verificationStatus: EducationalVerificationStatusSchema,
  formalProofSummary: z.string().trim().max(500).optional(),
  sourceReferenceId: SafeIdString.optional(),
  humanReviewComment: z.string().trim().max(500).optional(),
  formalExpressionVerified: z.boolean().optional(),
  statementSemanticStatus: StatementSemanticStatusSchema.optional(),
  statementContradictionReason: z.string().trim().max(500).optional()
}).strict().superRefine((claim, ctx) => {
  // Quy tắc kiểm soát tính chân thực (Ground Truth Gate):
  // 1. Mệnh đề formal_mathematics nếu tuyên bố 'formally_verified' BẮT BUỘC phải có biểu thức formalExpression và tóm tắt kiểm định formalProofSummary
  if (claim.claimType === 'formal_mathematics' && claim.verificationStatus === 'formally_verified') {
    if (!claim.formalExpression) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['formalExpression'],
        message: 'Mệnh đề toán học được gắn mác formally_verified bắt buộc phải có biểu thức formalExpression'
      });
    }
    if (!claim.formalProofSummary) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['formalProofSummary'],
        message: 'Mệnh đề toán học được gắn mác formally_verified bắt buộc phải có chứng chỉ kiểm định formalProofSummary'
      });
    }
  }

  // 2. Không được gán formally_verified cho các khái niệm AI trừ phi có chứng minh toán học
  if (claim.claimType === 'ai_concept' && claim.verificationStatus === 'formally_verified') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verificationStatus'],
      message: 'Khái niệm AI định tính (ai_concept) không thể mang trạng thái formally_verified; hãy dùng source_grounded hoặc human_review_required'
    });
  }

  // 3. Nếu statement mâu thuẫn với formalExpression, cấm formally_verified
  if (claim.statementSemanticStatus === 'contradiction_detected' && claim.verificationStatus === 'formally_verified') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['verificationStatus'],
      message: 'Mệnh đề có statement mâu thuẫn với biểu thức formalExpression không thể mang trạng thái formally_verified'
    });
  }

  // 4. Nếu formal_mathematics formally_verified, formalExpressionVerified không được là false
  if (claim.claimType === 'formal_mathematics' && claim.verificationStatus === 'formally_verified' && claim.formalExpressionVerified === false) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['formalExpressionVerified'],
      message: 'Mệnh đề toán học formally_verified bắt buộc phải có biểu thức formalExpression đã được SymPy chứng minh'
    });
  }
});

export type EducationalClaimV3 = z.infer<typeof EducationalClaimV3Schema>;

export const EducationalSceneTypeSchema = z.enum([
  'concept_intro',
  'formula_derivation',
  'graph_plot',
  'neural_architecture',
  'loss_landscape',
  'attention_heatmap',
  'algebra_identity',
  'flowchart_simulation',
  'comparison_table',
  'summary'
]);
export type EducationalSceneType = z.infer<typeof EducationalSceneTypeSchema>;

/**
 * Phân cảnh sư phạm V3 (EducationalSceneV3)
 */
export const EducationalSceneV3Schema = z.object({
  sceneId: SafeIdString,
  sceneType: EducationalSceneTypeSchema,
  title: NoExecutableString,
  pedagogicalGoal: NoExecutableString,
  durationSeconds: z.number().positive().max(120),
  boundClaimIds: z.array(SafeIdString).default([]),
  rendererTarget: RendererTargetSchema,
  narration: z.object({
    vietnamese: NoExecutableString,
    subtitleVietnamese: NoExecutableString
  }).strict(),
  visualPayload: EducationalVisualPayloadSchema
}).strict().superRefine((scene, ctx) => {
  if (scene.visualPayload.sceneType !== scene.sceneType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['visualPayload', 'sceneType'],
      message: `visualPayload.sceneType (${scene.visualPayload.sceneType}) không khớp với scene.sceneType (${scene.sceneType})`
    });
  }
});

export type EducationalSceneV3 = z.infer<typeof EducationalSceneV3Schema>;

/**
 * Storyboard sư phạm V3 (EducationalStoryboardV3)
 */
export const EducationalStoryboardV3Schema = z.object({
  storyboardId: SafeIdString,
  lessonId: SafeIdString,
  scenes: z.array(EducationalSceneV3Schema).min(2).max(12),
  totalDurationSeconds: z.number().positive().max(600)
}).strict().superRefine((sb, ctx) => {
  const sumDuration = sb.scenes.reduce((acc, sc) => acc + sc.durationSeconds, 0);
  if (Math.abs(sumDuration - sb.totalDurationSeconds) > 1.0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['totalDurationSeconds'],
      message: `totalDurationSeconds (${sb.totalDurationSeconds}) không khớp với tổng thời lượng các cảnh (${sumDuration})`
    });
  }
});

export type EducationalStoryboardV3 = z.infer<typeof EducationalStoryboardV3Schema>;

/**
 * Báo cáo kiểm định tri thức V3 (KnowledgeValidationReportV3)
 */
export const KnowledgeValidationReportV3Schema = z.object({
  reportId: SafeIdString,
  lessonId: SafeIdString,
  domain: EducationalDomainSchema,
  overallStatus: z.enum(['verified', 'needs_review', 'failed']),
  claimReports: z.array(
    z.object({
      claimId: SafeIdString,
      claimType: EducationalClaimTypeSchema,
      status: EducationalVerificationStatusSchema,
      evidenceSource: z.string().optional(),
      verifierNotes: z.string().optional(),
      verifierImplementation: z.string().trim().min(1).max(120).optional(),
      verificationBinding: z.object({
        claimId: SafeIdString,
        exactExpression: z.string().trim().min(1).max(300),
        mathSpecCanonical: z.string().trim().min(2).max(2000),
        assumptions: z.array(z.string().trim().min(1).max(300)).max(12)
      }).strict().optional()
    }).strict()
  ),
  requiresHumanPedagogicalSignoff: z.boolean(),
  validationTimestamp: z.string()
}).strict();

export type KnowledgeValidationReportV3 = z.infer<typeof KnowledgeValidationReportV3Schema>;

/**
 * Kế hoạch bài học giáo dục V3 (EducationalLessonPlanV3)
 */
export const EducationalLessonPlanV3Schema = z.object({
  schemaVersion: z.literal(LESSON_SCHEMA_VERSION_V3),
  generationProvenance: GenerationProvenanceV3Schema,
  lessonId: SafeIdString,
  domain: EducationalDomainSchema,
  topicId: z.string().regex(/^[a-z0-9_.-]{3,80}$/),
  title: NoExecutableString,
  summary: NoExecutableString,
  learningObjectives: z.array(NoExecutableString).min(1).max(6),
  prerequisites: z.array(NoExecutableString).default([]),
  keyConcepts: z.array(NoExecutableString).min(1).max(8),
  educationalClaims: z.array(EducationalClaimV3Schema).min(1).max(12),
  capabilityReport: TopicCapabilityReportV3Schema,
  validationReport: KnowledgeValidationReportV3Schema.optional(),
  sourceEvidence: z.array(GroundingEvidenceSchema).default([]),
  storyboard: EducationalStoryboardV3Schema.optional()
}).strict().superRefine((plan, ctx) => {
  // Đảm bảo không trùng ID mệnh đề
  const seenIds = new Set<string>();
  for (let i = 0; i < plan.educationalClaims.length; i++) {
    const claim = plan.educationalClaims[i];
    if (seenIds.has(claim.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['educationalClaims', i, 'id'],
        message: `Trùng lặp mã định danh mệnh đề: ${claim.id}`
      });
    }
    seenIds.add(claim.id);
  }
  const claimIds = new Set(plan.educationalClaims.map((claim) => claim.id));
  plan.storyboard?.scenes.forEach((scene, sceneIndex) => scene.boundClaimIds.forEach((claimId, claimIndex) => {
    if (!claimIds.has(claimId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['storyboard', 'scenes', sceneIndex, 'boundClaimIds', claimIndex], message: `Scene tham chiếu claim không tồn tại: ${claimId}` });
  }));
  plan.sourceEvidence.forEach((evidence, index) => {
    if (!claimIds.has(evidence.claimId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sourceEvidence', index, 'claimId'], message: `Evidence tham chiếu claim không tồn tại: ${evidence.claimId}` });
  });
  if (plan.storyboard?.lessonId !== undefined && plan.storyboard.lessonId !== plan.lessonId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['storyboard', 'lessonId'], message: 'Storyboard lessonId không khớp lesson plan' });
  }
  if (plan.validationReport) {
    if (plan.validationReport.lessonId !== plan.lessonId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validationReport', 'lessonId'], message: 'Validation report không khớp lessonId' });
    const reportIds = plan.validationReport.claimReports.map((report) => report.claimId);
    if (new Set(reportIds).size !== reportIds.length || reportIds.length !== claimIds.size || reportIds.some((id) => !claimIds.has(id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validationReport', 'claimReports'], message: 'Validation report phải ánh xạ chính xác một lần cho mọi claim' });
    }
  }
});

export type EducationalLessonPlanV3 = z.infer<typeof EducationalLessonPlanV3Schema>;

