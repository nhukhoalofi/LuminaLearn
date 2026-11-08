import {
  type EducationalClaimV3,
  type EducationalDomain,
  type GroundingEvidence,
  type KnowledgeValidationReportV3,
  type MathVisualizationSpecV2,
  type VerifiedClaim
} from '@luminalearn/scene-schema';
import { MathVerificationService } from './math-verifier';

export interface KnowledgeValidationV3Options {
  mathVerifier?: MathVerificationService;
}

export interface ValidateClaimsV3Input {
  lessonId: string;
  topicId: string;
  domain: EducationalDomain;
  claims: EducationalClaimV3[];
  sourceEvidence?: GroundingEvidence[];
  mathSpec?: MathVisualizationSpecV2;
}

export interface ValidationV3Result {
  validatedClaims: EducationalClaimV3[];
  report: KnowledgeValidationReportV3;
}

/**
 * KnowledgeValidationServiceV3: Dịch vụ kiểm định tri thức V3 độc lập.
 * RÀNG BUỘC TOÀN VẸN TRI THỨC (KNOWLEDGE INTEGRITY):
 * 1. Tuyệt đối không gán `formally_verified` nếu không chạy qua engine kiểm định toán hình thức độc lập (SymPy).
 * 2. Tuyệt đối không tự bịa chứng minh SymPy cho Bayes, Attention, Gradient Descent hay Backpropagation.
 * 3. Tuyệt đối không gán `source_grounded` nếu không có bằng chứng trích dẫn thực sự trong sourceEvidence.
 * 4. Biến đổi biểu thức toán đã chứng minh sẽ hủy bỏ chứng chỉ kiểm định (Fail-closed).
 */
export class KnowledgeValidationServiceV3 {
  private readonly mathVerifier: MathVerificationService;

  constructor(options?: KnowledgeValidationV3Options) {
    this.mathVerifier = options?.mathVerifier ?? new MathVerificationService();
  }

  public async validateClaims(input: ValidateClaimsV3Input): Promise<ValidationV3Result> {
    const { lessonId, topicId, domain, claims, sourceEvidence = [], mathSpec } = input;

    const validatedClaims: EducationalClaimV3[] = [];
    const claimReports: KnowledgeValidationReportV3['claimReports'] = [];

    // Phân loại các mệnh đề toán học cần SymPy kiểm định
    const formalMathClaims = claims.filter((c) => c.claimType === 'formal_mathematics' && c.formalExpression);

    // Xác định xem topic/validator có verifier hình thức thực tế hay không
    const isDerivativeTopic = topicId === 'calculus.derivative.intuition';
    const isRiemannTopic = topicId === 'calculus.riemann_integral.intuition' || topicId === 'calculus.integral.riemann_sum';

    let sympyResults: Record<string, { passed: boolean; reason?: string }> = {};

    if ((isDerivativeTopic || isRiemannTopic) && formalMathClaims.length > 0) {
      try {
        const v2ClaimsToVerify: VerifiedClaim[] = formalMathClaims.map((c) => {
          let v2Key = c.validatorKey ?? (isDerivativeTopic ? 'polynomial_derivative' : 'definite_integral');
          if (v2Key === 'riemann_integral') {
            v2Key = 'definite_integral';
          }
          return {
            id: c.id,
            statement: c.statement,
            validatorKey: v2Key,
            expectedExpression: c.formalExpression!,
            verificationStatus: 'unverified'
          };
        });

        const v2TopicId = isRiemannTopic ? 'calculus.integral.riemann_sum' : topicId;
        const verifyResult = await this.mathVerifier.verifyClaims(v2TopicId, v2ClaimsToVerify, { mathSpec });

        for (const [key, check] of Object.entries(verifyResult.result.checks)) {
          sympyResults[key] = { passed: check.passed, reason: check.reason };
          if (key === 'definite_integral') {
            sympyResults['riemann_integral'] = { passed: check.passed, reason: check.reason };
          }
        }
      } catch (err) {
        // Fail-closed nếu execution SymPy lỗi
        for (const c of formalMathClaims) {
          sympyResults[c.validatorKey ?? c.id] = { passed: false, reason: err instanceof Error ? err.message : String(err) };
        }
      }
    }

    // Xử lý từng mệnh đề theo nguyên tắc toàn vẹn tri thức
    for (const claim of claims) {
      const cloned: EducationalClaimV3 = { ...claim };

      // 1. Mệnh đề TOÁN HỌC HÌNH THỨC (formal_mathematics)
      if (claim.claimType === 'formal_mathematics') {
        const validatorKey = claim.validatorKey ?? claim.id;
        const sympyCheck = sympyResults[validatorKey];

        if (sympyCheck !== undefined) {
          if (sympyCheck.passed) {
            cloned.verificationStatus = 'formally_verified';
            cloned.formalProofSummary = `SymPy verified: ${claim.formalExpression} for topic ${topicId}`;
          } else {
            cloned.verificationStatus = 'rejected';
            cloned.formalProofSummary = undefined;
            cloned.humanReviewComment = `SymPy formal verification failed: ${sympyCheck.reason ?? 'expression mismatch'}`;
          }
        } else {
          // Các toán tử toán học chưa có formal verifier trong Phase 2 (Bayes, Gradient Descent, Attention, Matrix)
          // TUYỆT ĐỐI KHÔNG TỰ BỊA CHỨNG MINH SYMPY!
          cloned.verificationStatus = 'human_review_required';
          cloned.formalProofSummary = undefined;
          cloned.humanReviewComment = claim.humanReviewComment ?? 'Toán tử toán học chưa có engine kiểm định hình thức tự động ở Phase 2; yêu cầu giáo viên đối chiếu.';
        }

        claimReports.push({
          claimId: cloned.id,
          claimType: cloned.claimType,
          status: cloned.verificationStatus,
          verifierNotes: cloned.formalProofSummary ?? cloned.humanReviewComment
        });
      }
      // 2. Mệnh đề KHÁI NIỆM AI & THUẬT TOÁN (ai_concept, algorithmic_property, empirical_observation)
      else {
        // Kiểm tra đối chiếu tài liệu nguồn thực tế (Real Source Grounding)
        const matchingEvidence = sourceEvidence.find(
          (ev) => ev.claimId === claim.id && ev.evidenceFound === true && ev.sourceReference?.exactQuote && ev.sourceReference.exactQuote.trim().length > 0
        );

        if (matchingEvidence) {
          cloned.verificationStatus = 'source_grounded';
          cloned.sourceReferenceId = matchingEvidence.sourceReference.id;
          claimReports.push({
            claimId: cloned.id,
            claimType: cloned.claimType,
            status: 'source_grounded',
            evidenceSource: `Doc: ${matchingEvidence.sourceReference.documentId}, p.${matchingEvidence.sourceReference.pageNumber}`,
            verifierNotes: `Verified exact quote: "${matchingEvidence.sourceReference.exactQuote.slice(0, 60)}..."`
          });
        } else {
          // Không có source evidence hợp lệ -> KHÔNG ĐƯỢC PHÉP gán source_grounded!
          cloned.verificationStatus = 'human_review_required';
          cloned.sourceReferenceId = undefined;
          claimReports.push({
            claimId: cloned.id,
            claimType: cloned.claimType,
            status: 'human_review_required',
            verifierNotes: 'Chưa có tài liệu nguồn kiểm chứng hợp lệ; yêu cầu giáo viên rà soát sư phạm.'
          });
        }
      }

      validatedClaims.push(cloned);
    }

    // Đánh giá trạng thái tổng thể
    const hasRejected = validatedClaims.some((c) => c.verificationStatus === 'rejected');
    const hasNeedsReview = validatedClaims.some((c) => c.verificationStatus === 'human_review_required' || c.verificationStatus === 'unverified');

    const overallStatus = hasRejected ? 'failed' : hasNeedsReview ? 'needs_review' : 'verified';
    const requiresHumanPedagogicalSignoff = hasNeedsReview || domain === 'artificial_intelligence';

    const report: KnowledgeValidationReportV3 = {
      reportId: `val_report_${lessonId}_${Date.now()}`,
      lessonId,
      domain,
      overallStatus,
      claimReports,
      requiresHumanPedagogicalSignoff,
      validationTimestamp: new Date().toISOString()
    };

    return { validatedClaims, report };
  }
}

