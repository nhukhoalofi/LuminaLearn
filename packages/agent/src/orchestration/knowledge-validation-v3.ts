import {
  type EducationalClaimV3,
  type EducationalDomain,
  type EducationalSceneV3,
  type EducationalLessonPlanV3,
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
  const trimmedStmt = statement.trim();
  if (!formalExpression) {
    return { status: 'human_review_required', reason: 'No formal expression bound to claim' };
  }
  const cleanExpr = formalExpression.trim().replace(/\s+/g, '');
  const normalizedStmt = trimmedStmt.toLowerCase();

  // 1. Kiểm tra các cụm từ phủ định đối nghịch trực tiếp với thành phần công thức
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

  // 2. Phát hiện mâu thuẫn số học (Numeric substitution contradiction)
  // Ví dụ: "Khi a=b=1, kết quả bằng 100" hoặc "a=1, b=1 => 100"
  const numericClaimMatch = /khi\s+a\s*=\s*b\s*=\s*([0-9.-]+)[^0-9.-]+(?:kết quả|giá trị|bằng|được)\s*[:=]?\s*([0-9.-]+)/i.exec(trimmedStmt)
    || /(?:cho|với|tại)\s+a\s*=\s*([0-9.-]+)[,\s]+b\s*=\s*([0-9.-]+)[^0-9.-]+(?:kết quả|giá trị|bằng|được)\s*[:=]?\s*([0-9.-]+)/i.exec(trimmedStmt);
  
  if (numericClaimMatch) {
    const aVal = Number(numericClaimMatch[1]);
    const bVal = numericClaimMatch.length >= 4 ? Number(numericClaimMatch[2]) : aVal;
    const claimedVal = Number(numericClaimMatch.length >= 4 ? numericClaimMatch[3] : numericClaimMatch[2]);
    
    if (Number.isFinite(aVal) && Number.isFinite(bVal) && Number.isFinite(claimedVal)) {
      if (cleanExpr.includes('(a+b)^2') && Math.pow(aVal + bVal, 2) !== claimedVal) {
        return {
          status: 'contradiction_detected',
          reason: `numeric_claim_contradiction: Thay a=${aVal}, b=${bVal} vào biểu thức cho kết quả ${Math.pow(aVal + bVal, 2)}, khác với khẳng định '${claimedVal}' trong lời văn`
        };
      }
      if (cleanExpr.includes('(a-b)^2') && Math.pow(aVal - bVal, 2) !== claimedVal) {
        return {
          status: 'contradiction_detected',
          reason: `numeric_claim_contradiction: Thay a=${aVal}, b=${bVal} vào biểu thức cho kết quả ${Math.pow(aVal - bVal, 2)}, khác với khẳng định '${claimedVal}' trong lời văn`
        };
      }
      if (cleanExpr.includes('a^2-b^2') && (Math.pow(aVal, 2) - Math.pow(bVal, 2)) !== claimedVal) {
        return {
          status: 'contradiction_detected',
          reason: `numeric_claim_contradiction: Thay a=${aVal}, b=${bVal} vào biểu thức cho kết quả ${Math.pow(aVal, 2) - Math.pow(bVal, 2)}, khác với khẳng định '${claimedVal}' trong lời văn`
        };
      }
    }
  }

  // 3. Kiểm tra đẳng thức mâu thuẫn hiển nhiên trong văn bản
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

  // 4. KIỂM ĐỊNH KHỚP HÌNH THỨC (formal_match):
  // Chỉ gán formal_match khi câu văn THỰC SỰ CHỈ NÊU BIỂU THỨC HOẶC ĐẲNG THỨC NÀY
  // (loại bỏ các tiền tố chuẩn như "Công thức: ...", "$$...$$", "Biểu thức: ...", nhãn tên hằng đẳng thức/đạo hàm/tích phân)
  // Tuyệt đối không cho phép đoạn văn dài hoặc câu chứa khẳng định phụ được mang nhãn formal_match!
  const boilerplatePrefixRegex = /^(?:(?:công thức|biểu thức|định lý|hằng đẳng thức|đồng nhất thức|phương trình|identity|formula)\s*[:;]?|đạo hàm của [^:=]+ (?:là|=)|tích phân(?: xác định)? của [^:=]+ (?:là|=)|hệ số góc[^:=]+ (?:là|=)|giới hạn của [^:=]+ (?:là|=)|quy tắc[^:=]+ (?:là|=:?)|(?:[0-9]+\.\s*)?[^:;=,\n]{1,60}[:;])?\s*(?:\$\$?|\\\[)?\s*/i;
  const boilerplateSuffixRegex = /\s*(?:\$\$?|\\\])?\.?$/i;

  let coreStatement = trimmedStmt
    .replace(boilerplatePrefixRegex, '')
    .replace(boilerplateSuffixRegex, '')
    .trim();

  const normalizeMath = (str: string) => str.replace(/\s+/g, '').replace(/\*/g, '');

  if (normalizeMath(coreStatement) === normalizeMath(cleanExpr)) {
    return { status: 'formal_match' };
  }

  // Nếu coreStatement có dạng "LHS = RHS" mà vế RHS khớp với biểu thức cần chứng minh
  const eqParts = coreStatement.split(/(?:==|=|bằng)/);
  if (eqParts.length === 2) {
    const rhs = eqParts[1].trim();
    if (normalizeMath(rhs) === normalizeMath(cleanExpr) || normalizeMath(coreStatement) === normalizeMath(cleanExpr)) {
      return { status: 'formal_match' };
    }
  }

  // 5. Nếu văn bản chứa biểu thức nhưng có thêm lời văn giải thích tự do:
  // BẮT BUỘC gán human_review_required để giáo viên xem xét ngữ nghĩa
  return {
    status: 'human_review_required',
    reason: 'Lời văn chứa giải thích hoặc mệnh đề mở rộng cần giáo viên xác nhận ngữ nghĩa (SymPy chỉ chứng minh phần đẳng thức ký hiệu)'
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

    const seenClaimIds = new Set<string>();
    for (const c of claims) {
      if (seenClaimIds.has(c.id)) {
        throw new Error(`duplicate_claim_id: Duplicate claim ID detected '${c.id}'`);
      }
      seenClaimIds.add(c.id);
    }

    // Phân loại các mệnh đề toán học cần SymPy kiểm định
    const formalMathClaims = claims.filter((c) => c.claimType === 'formal_mathematics' && c.formalExpression);

    // Xác định xem topic/validator có verifier hình thức thực tế hay không
    const isDerivativeTopic = topicId === 'calculus.derivative.intuition';
    const isRiemannTopic = topicId === 'calculus.riemann_integral.intuition' || topicId === 'calculus.integral.riemann_sum';
    const isAlgebraIdentityTopic = topicId === 'algebra.identities.seven';

    let mappedMathClaims = new Map<string, VerifiedClaim>();
    let sympyResultsByClaimId = new Map<string, { passed: boolean; reason?: string }>();

    if (isAlgebraIdentityTopic) {
      for (const claim of formalMathClaims) {
        const parts = claim.formalExpression!.split('=');
        if (parts.length !== 2) {
          sympyResultsByClaimId.set(claim.id, { passed: false, reason: 'algebra_identity_requires_exact_left_and_right' });
          mappedMathClaims.set(claim.id, { id: claim.id, statement: claim.statement, validatorKey: claim.validatorKey ?? claim.id, expectedExpression: claim.formalExpression!, verificationStatus: 'failed' });
          continue;
        }
        try {
          const result = await verifyAlgebraIdentityV3(parts[0].trim(), parts[1].trim());
          const passed = result.status === 'verified';
          sympyResultsByClaimId.set(claim.id, {
            passed,
            reason: passed ? undefined : `nonzero_difference: ${result.canonicalDifference}`
          });
          mappedMathClaims.set(claim.id, {
            id: claim.id,
            statement: claim.statement,
            validatorKey: claim.validatorKey ?? claim.id,
            expectedExpression: claim.formalExpression!,
            verificationStatus: passed ? 'verified' : 'failed'
          });
        } catch (error) {
          sympyResultsByClaimId.set(claim.id, { passed: false, reason: error instanceof Error ? error.message : String(error) });
          mappedMathClaims.set(claim.id, {
            id: claim.id,
            statement: claim.statement,
            validatorKey: claim.validatorKey ?? claim.id,
            expectedExpression: claim.formalExpression!,
            verificationStatus: 'failed'
          });
        }
      }
    }

    if ((isDerivativeTopic || isRiemannTopic) && formalMathClaims.length > 0 && !mathSpec) {
      for (const c of formalMathClaims) {
        sympyResultsByClaimId.set(c.id, {
          passed: false,
          reason: 'missing_math_spec: Formal verification requires the exact requested MathSpec'
        });
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

        for (const verifiedClaim of verifyResult.claims) {
          const check = verifyResult.result.checks[verifiedClaim.validatorKey];
          const passed = Boolean(check?.passed && verifiedClaim.verificationStatus === 'verified');
          sympyResultsByClaimId.set(verifiedClaim.id, {
            passed,
            reason: check?.reason ?? (passed ? undefined : 'verification_failed')
          });
        }
      } catch (err) {
        // Fail-closed nếu execution SymPy lỗi
        for (const c of formalMathClaims) {
          sympyResultsByClaimId.set(c.id, { passed: false, reason: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    // Xử lý từng mệnh đề theo nguyên tắc toàn vẹn tri thức
    for (const claim of claims) {
      const cloned: EducationalClaimV3 = { ...claim };

      // 1. Mệnh đề TOÁN HỌC HÌNH THỨC (formal_mathematics)
      if (claim.claimType === 'formal_mathematics') {
        const sympyCheck = sympyResultsByClaimId.get(claim.id);
        const mapped = mappedMathClaims.get(claim.id);

        const formalProven = Boolean(sympyCheck?.passed && mapped?.verificationStatus === 'verified');
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
          cloned.verificationStatus = (sympyCheck && !sympyCheck.passed) || mapped?.verificationStatus === 'failed' ? 'rejected' : 'human_review_required';
          cloned.formalExpressionVerified = false;
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

export interface ValidateLessonMathematicalIntegrityV3Input {
  lessonPlan: EducationalLessonPlanV3;
  sourceEvidence?: GroundingEvidence[];
  mathVerifier?: MathVerificationService;
}

export interface LessonMathematicalIntegrityResultV3 {
  valid: boolean;
  code?: string;
  reason?: string;
  validatedClaims: EducationalClaimV3[];
  validationReport: KnowledgeValidationReportV3;
}

/**
 * CHECKPOINT B (Phase 4.1.1): Reusable trusted validation gate.
 * Validates:
 * 1. All formal mathematical claims (SymPy proofs & statement semantic consistency)
 * 2. All algebra scene transformation steps (SymPy step-by-step chain equivalence)
 * 3. Correct claim-to-scene bindings and formal expression consistency
 * 4. Fails closed if any claim or scene violates mathematical integrity.
 */
export async function validateLessonMathematicalIntegrityV3(
  input: ValidateLessonMathematicalIntegrityV3Input
): Promise<LessonMathematicalIntegrityResultV3> {
  const { lessonPlan, sourceEvidence = [], mathVerifier } = input;
  const validator = new KnowledgeValidationServiceV3({ mathVerifier });

  // 1. Kiểm định toàn bộ claims
  const validationResult = await validator.validateClaims({
    lessonId: lessonPlan.lessonId,
    topicId: lessonPlan.topicId,
    domain: lessonPlan.domain,
    claims: lessonPlan.educationalClaims,
    sourceEvidence,
    mathSpec: (lessonPlan as unknown as { mathSpec?: any }).mathSpec,
    assumptions: lessonPlan.validationReport?.claimReports.flatMap((r) => r.verificationBinding?.assumptions ?? [])
  });

  const { validatedClaims, report } = validationResult;

  if (report.overallStatus === 'failed') {
    return {
      valid: false,
      code: 'knowledge_validation_failed',
      reason: `Knowledge validation failed: ${report.claimReports.filter((r) => r.status === 'rejected').map((r) => `${r.claimId}: ${r.verifierNotes}`).join('; ')}`,
      validatedClaims,
      validationReport: report
    };
  }

  // 2. Kiểm định toàn bộ storyboard scenes
  if (lessonPlan.storyboard) {
    const claimMap = new Map(validatedClaims.map((c) => [c.id, c]));

    for (const scene of lessonPlan.storyboard.scenes) {
      // 2a. Phân cảnh đại số: chứng minh từng bước biến đổi trung gian
      if (scene.sceneType === 'algebra_identity') {
        const algebraCheck = await validateAlgebraSceneMath({
          scene,
          verifiedClaims: validatedClaims
        });
        if (!algebraCheck.valid) {
          return {
            valid: false,
            code: 'invalid_transformation_step',
            reason: `Phân cảnh '${scene.sceneId}' vi phạm tính toàn vẹn toán học: ${algebraCheck.reason}`,
            validatedClaims,
            validationReport: {
              ...report,
              overallStatus: 'failed'
            }
          };
        }
      }

      // 2b. Kiểm tra boundClaimIds
      if (scene.boundClaimIds && scene.boundClaimIds.length > 0) {
        for (const claimId of scene.boundClaimIds) {
          const claim = claimMap.get(claimId);
          if (!claim) {
            return {
              valid: false,
              code: 'unbound_claim',
              reason: `Phân cảnh '${scene.sceneId}' liên kết với claimId '${claimId}' không tồn tại trong bài học`,
              validatedClaims,
              validationReport: { ...report, overallStatus: 'failed' }
            };
          }
          if (claim.claimType === 'formal_mathematics' && !claim.formalExpressionVerified) {
            return {
              valid: false,
              code: 'unverified_claim_binding',
              reason: `Phân cảnh '${scene.sceneId}' liên kết với mệnh đề toán học '${claimId}' chưa được chứng minh hình thức`,
              validatedClaims,
              validationReport: { ...report, overallStatus: 'failed' }
            };
          }
        }
      }
    }
  }

  return {
    valid: true,
    validatedClaims,
    validationReport: report
  };
}

