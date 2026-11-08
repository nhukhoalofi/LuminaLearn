import {
  type EducationalClaimV3,
  type EducationalDomain,
  type EducationalSceneV3,
  type GroundingEvidence,
  type KnowledgeValidationReportV3,
  type MathVisualizationSpecV2,
  type VerifiedClaim,
  type AlgebraIdentityVisualPayload
} from '@luminalearn/scene-schema';
import { MathVerificationService } from './math-verifier';
import { verifyAlgebraIdentityV3, verifyTransformationChainV3 } from './algebra-verifier-v3';

/**
 * CHECKPOINT B: Phân tích sự nhất quán ngữ nghĩa giữa lời văn tự do (statement)
 * và biểu thức toán học hình thức (formalExpression).
 * Bắt buộc phát hiện mâu thuẫn trực tiếp (contradiction_detected) để ngăn chặn
 * việc gán mác formally_verified cho những lời giải thích ngụy biện.
 */
export function inspectStatementSemanticConsistency(
  statement: string,
  formalExpression?: string
): {
  status: 'formal_match' | 'human_review_required' | 'contradiction_detected';
  reason?: string;
} {
  const normalizedStmt = statement.trim().toLowerCase();
  if (!formalExpression) {
    return { status: 'human_review_required', reason: 'No formal expression bound to claim' };
  }
  const cleanExpr = formalExpression.trim().replace(/\s+/g, '');

  // 1. Kiểm tra các cụm từ phủ định đối nghịch trực tiếp với thành phần công thức
  // Ví dụ: biểu thức có 2*a*b mà lời văn nói "không có số hạng 2ab", "bỏ qua 2ab", "không có 2*a*b"
  const contradictionPatterns = [
    /không\s+(?:có|chứa|xuất hiện|tồn tại)\s+(?:số hạng\s+)?([a-b0-9*^ ]+)/gi,
    /bỏ qua\s+(?:số hạng\s+)?([a-b0-9*^ ]+)/gi,
    /loại trừ\s+(?:số hạng\s+)?([a-b0-9*^ ]+)/gi,
    /triệt tiêu\s+(?:hoàn toàn\s+)?(?:số hạng\s+)?([a-b0-9*^ ]+)/gi,
    /không\s+(?:bằng|phải là)\s+([a-b0-9*^ ]+)/gi
  ];

  for (const pattern of contradictionPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalizedStmt)) !== null) {
      const term = match[1].replace(/\s+/g, '');
      const normalizedTerm = term.replace(/\*/g, '').replace(/\^/g, '');
      const normalizedFormula = cleanExpr.replace(/\*/g, '').replace(/\^/g, '');
      if (normalizedTerm.length >= 2 && normalizedFormula.includes(normalizedTerm)) {
        return {
          status: 'contradiction_detected',
          reason: `statement_contradicts_formula: Lời văn phủ định thành phần '${match[1]}' vốn có trong biểu thức '${formalExpression}'`
        };
      }
    }
  }

  // 2. Kiểm tra đẳng thức mâu thuẫn hiển nhiên trong văn bản
  // Ví dụ: statement khẳng định (a+b)^2 = a^2 + b^2 trong khi formalExpression là (a+b)^2 = a^2 + 2ab + b^2
  const equalityInStmt = statement.match(/(?:(?:^|[.;\n])\s*)([a-b0-9+\-*/^() ]+)\s*(?:==|=|bằng)\s*([a-b0-9+\-*/^() ]+)/i);
  if (equalityInStmt) {
    const leftInStmt = equalityInStmt[1].trim().replace(/\s+/g, '').replace(/\*/g, '');
    const rightInStmt = equalityInStmt[2].trim().replace(/\s+/g, '').replace(/\*/g, '');
    const [expectedLeft, expectedRight] = formalExpression.split('=').map((s) => s.trim().replace(/\s+/g, '').replace(/\*/g, ''));
    if (expectedLeft && expectedRight && leftInStmt.length > 2 && rightInStmt.length > 2) {
      if (leftInStmt === expectedLeft && rightInStmt !== expectedRight) {
        return {
          status: 'contradiction_detected',
          reason: `statement_contradicts_formula: Lời văn khẳng định '${equalityInStmt[2].trim()}' mâu thuẫn với biểu thức hình thức đã chứng minh '${expectedRight}'`
        };
      }
    }
  }

  // 3. Khớp chính thức: lời văn chứa trọn vẹn đẳng thức hoặc công thức đại số
  const statementWithoutPunctuation = statement.replace(/[.,:;!?]/g, '').trim();
  if (statementWithoutPunctuation.includes(formalExpression) ||
      statementWithoutPunctuation.replace(/\s+/g, '').includes(cleanExpr)) {
    return { status: 'formal_match' };
  }

  // 4. Mặc định cho diễn giải sư phạm tự do: Yêu cầu giáo viên rà soát ngữ nghĩa
  return {
    status: 'human_review_required',
    reason: 'Lời văn tự do cần giáo viên xác nhận ngữ nghĩa (không thể kiểm chứng hoàn toàn qua SymPy)'
  };
}

/**
 * CHECKPOINT C: Kiểm định tính hợp lệ toán học của từng bước biến đổi trong phân cảnh đại số.
 */
export async function validateAlgebraSceneMath(input: {
  scene: EducationalSceneV3;
  verifiedClaims: EducationalClaimV3[];
}): Promise<{ valid: boolean; reason?: string }> {
  const { scene, verifiedClaims } = input;
  if (scene.sceneType !== 'algebra_identity') return { valid: true };
  const payload = scene.visualPayload as AlgebraIdentityVisualPayload;

  // 1. Phải liên kết với ít nhất một claim ID đã kiểm định
  if (!scene.boundClaimIds || scene.boundClaimIds.length === 0) {
    return { valid: false, reason: 'algebra_scene_unbound: Phân cảnh đại số bắt buộc phải liên kết với boundClaimIds' };
  }

  const matchingClaim = verifiedClaims.find((c) => scene.boundClaimIds.includes(c.id));
  if (!matchingClaim) {
    return { valid: false, reason: `algebra_claim_missing: Không tìm thấy claimId '${scene.boundClaimIds.join(',')}' trong danh sách mệnh đề đã kiểm định` };
  }

  // 2. Nhất quán tuyệt đối giữa claim.formalExpression và scene left/right
  const expectedRelation = `${payload.leftExpression}=${payload.rightExpression}`.replace(/\s+/g, '');
  const claimRelation = (matchingClaim.formalExpression ?? '').replace(/\s+/g, '');
  if (claimRelation !== expectedRelation) {
    return {
      valid: false,
      reason: `algebra_expression_mismatch: Phân cảnh biểu diễn '${payload.leftExpression} = ${payload.rightExpression}' không khớp với formalExpression '${matchingClaim.formalExpression}' của mệnh đề`
    };
  }

  // 3. Chứng minh mọi bước biến đổi trung gian E_0 = E_1 = ... = E_n bằng SymPy
  const steps = payload.transformationSteps.map((s) => s.expression);
  const chainResult = await verifyTransformationChainV3(steps);
  if (!chainResult.valid) {
    return {
      valid: false,
      reason: `invalid_transformation_step: ${chainResult.reason}`
    };
  }

  return { valid: true };
}

export interface KnowledgeValidationV3Options {
  mathVerifier?: MathVerificationService;
  verifySourceEvidence?: (input: {
    claim: EducationalClaimV3;
    evidence: GroundingEvidence;
  }) => boolean | Promise<boolean>;
}

export interface ValidateClaimsV3Input {
  lessonId: string;
  topicId: string;
  domain: EducationalDomain;
  claims: EducationalClaimV3[];
  sourceEvidence?: GroundingEvidence[];
  mathSpec?: MathVisualizationSpecV2;
  assumptions?: string[];
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
  private readonly verifySourceEvidence?: KnowledgeValidationV3Options['verifySourceEvidence'];

  constructor(options?: KnowledgeValidationV3Options) {
    this.mathVerifier = options?.mathVerifier ?? new MathVerificationService();
    this.verifySourceEvidence = options?.verifySourceEvidence;
  }

  public async validateClaims(input: ValidateClaimsV3Input): Promise<ValidationV3Result> {
    const { lessonId, topicId, domain, claims, sourceEvidence = [], mathSpec, assumptions = [] } = input;

    const validatedClaims: EducationalClaimV3[] = [];
    const claimReports: KnowledgeValidationReportV3['claimReports'] = [];

    // Phân loại các mệnh đề toán học cần SymPy kiểm định
    const formalMathClaims = claims.filter((c) => c.claimType === 'formal_mathematics' && c.formalExpression);

    // Xác định xem topic/validator có verifier hình thức thực tế hay không
    const isDerivativeTopic = topicId === 'calculus.derivative.intuition';
    const isRiemannTopic = topicId === 'calculus.riemann_integral.intuition' || topicId === 'calculus.integral.riemann_sum';
    const isAlgebraIdentityTopic = topicId === 'algebra.identities.seven';

    let mappedMathClaims = new Map<string, VerifiedClaim>();
    let sympyResults: Record<string, { passed: boolean; reason?: string }> = {};

    if (isAlgebraIdentityTopic) {
      for (const claim of formalMathClaims) {
        const key = claim.validatorKey ?? claim.id;
        const parts = claim.formalExpression!.split('=');
        if (parts.length !== 2) {
          sympyResults[key] = { passed: false, reason: 'algebra_identity_requires_exact_left_and_right' };
          continue;
        }
        try {
          const result = await verifyAlgebraIdentityV3(parts[0].trim(), parts[1].trim());
          sympyResults[key] = { passed: result.status === 'verified', reason: result.status === 'verified' ? undefined : `nonzero_difference: ${result.canonicalDifference}` };
          mappedMathClaims.set(claim.id, { id: claim.id, statement: claim.statement, validatorKey: key, expectedExpression: claim.formalExpression!, verificationStatus: result.status === 'verified' ? 'verified' : 'failed' });
        } catch (error) {
          sympyResults[key] = { passed: false, reason: error instanceof Error ? error.message : String(error) };
        }
      }
    }

    if ((isDerivativeTopic || isRiemannTopic) && formalMathClaims.length > 0 && !mathSpec) {
      for (const c of formalMathClaims) {
        sympyResults[c.validatorKey ?? c.id] = {
          passed: false,
          reason: 'missing_math_spec: Formal verification requires the exact requested MathSpec'
        };
      }
    } else if ((isDerivativeTopic || isRiemannTopic) && formalMathClaims.length > 0) {
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
        mappedMathClaims = new Map(verifyResult.claims.map((claim) => [claim.id, claim]));

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
        const mapped = mappedMathClaims.get(claim.id);

        const formalProven = Boolean(sympyCheck?.passed && (mapped?.verificationStatus === 'verified' || isAlgebraIdentityTopic));
        cloned.formalExpressionVerified = formalProven;

        const semantic = inspectStatementSemanticConsistency(claim.statement, claim.formalExpression);
        cloned.statementSemanticStatus = semantic.status;

        if (semantic.status === 'contradiction_detected') {
          cloned.verificationStatus = 'rejected';
          cloned.formalExpressionVerified = false;
          cloned.formalProofSummary = undefined;
          cloned.statementContradictionReason = semantic.reason;
          cloned.humanReviewComment = `Contradiction detected: ${semantic.reason}`;
        } else if (formalProven) {
          const proofSummary = isAlgebraIdentityTopic
            ? `SymPy verified exact bounded identity ${claim.formalExpression} over symbols a,b`
            : `SymPy verified exact expression ${claim.formalExpression} against the approved MathSpec`;
          cloned.formalProofSummary = proofSummary;

          if (semantic.status === 'formal_match') {
            cloned.verificationStatus = 'formally_verified';
            cloned.humanReviewComment = undefined;
          } else {
            // semantic.status === 'human_review_required'
            cloned.verificationStatus = 'human_review_required';
            cloned.humanReviewComment = semantic.reason ?? 'Biểu thức đã được SymPy chứng minh, diễn giải văn xuôi cần giáo viên xác nhận ngữ nghĩa.';
          }
        } else {
          cloned.verificationStatus = !mapped || mapped.verificationStatus === 'unverified' ? 'human_review_required' : 'rejected';
          cloned.formalProofSummary = undefined;
          cloned.humanReviewComment = `SymPy formal verification failed: ${sympyCheck?.reason ?? 'expression mismatch'}`;
        }

        claimReports.push({
          claimId: cloned.id,
          claimType: cloned.claimType,
          status: cloned.verificationStatus,
          verifierNotes: cloned.formalProofSummary ?? cloned.humanReviewComment,
          verifierImplementation: sympyCheck ? (isAlgebraIdentityTopic ? 'SymPy bounded algebra identity verifier' : 'MathVerificationService/SymPy') : 'unsupported',
          verificationBinding: cloned.verificationStatus === 'formally_verified' && claim.formalExpression && (mathSpec || isAlgebraIdentityTopic) ? {
            claimId: claim.id,
            exactExpression: claim.formalExpression,
            mathSpecCanonical: isAlgebraIdentityTopic ? JSON.stringify({ symbols: ['a', 'b'], relation: claim.formalExpression }) : JSON.stringify(mathSpec),
            assumptions
          } : undefined
        });
      }
      // 2. Mệnh đề KHÁI NIỆM AI & THUẬT TOÁN (ai_concept, algorithmic_property, empirical_observation)
      else {
        // Kiểm tra đối chiếu tài liệu nguồn thực tế (Real Source Grounding)
        const candidateEvidence = sourceEvidence.filter((ev) => ev.claimId === claim.id);
        let matchingEvidence: GroundingEvidence | undefined;
        if (this.verifySourceEvidence) {
          for (const evidence of candidateEvidence) {
            if (await this.verifySourceEvidence({ claim, evidence })) {
              matchingEvidence = evidence;
              break;
            }
          }
        }

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
      reportId: `val_${lessonId.slice(0, 40)}_${Date.now()}`,
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

