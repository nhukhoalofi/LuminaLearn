import {
  type EducationalClaimV3,
  type EducationalDomain,
  type EducationalSceneV3,
  type EducationalLessonPlanV3,
  type GroundingEvidence,
  type KnowledgeValidationReportV3,
  type MathVisualizationSpecV2,
  type VerifiedClaim,
  type AlgebraIdentityVisualPayload,
  OptimizationTraceDataV1Schema
} from '@luminalearn/scene-schema';
import { createHash } from 'node:crypto';
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
  const boilerplatePrefixRegex = /^(?:(?:công thức|biểu thức|định lý|hằng đẳng thức|đồng nhất thức|phương trình|identity|formula)\s*[:;]?|đạo hàm (?:của )?[^:=]+ (?:là|=|bằng)|tích phân(?: xác định)? (?:của )?[^:=]+ (?:là|=|bằng)|hệ số góc[^:=]+ (?:là|=|bằng)|giới hạn (?:của )?[^:=]+ (?:là|=|bằng)|quy tắc[^:=]+ (?:là|=|bằng:?)|(?:[0-9]+\.\s*)?[^:;=,\n]{1,60}[:;])?\s*(?:\$\$?|\\\[)?\s*/i;
  const boilerplateSuffixRegex = /\s*(?:\$\$?|\\\])?\.?$/i;

  let coreStatement = trimmedStmt
    .replace(boilerplatePrefixRegex, '')
    .replace(boilerplateSuffixRegex, '')
    .trim();

  const normalizeMath = (str: string) => str.replace(/\s+/g, '').replace(/\*/g, '');

  if (normalizeMath(coreStatement) === normalizeMath(cleanExpr)) {
    return { status: 'formal_match' };
  }

  // Nếu coreStatement có dạng "... = RHS" mà vế RHS khớp với biểu thức cần chứng minh
  const eqParts = coreStatement.split(/(?:==|=|bằng|là)/);
  if (eqParts.length >= 2) {
    const lastPart = eqParts[eqParts.length - 1].trim();
    if (normalizeMath(lastPart) === normalizeMath(cleanExpr) || normalizeMath(coreStatement) === normalizeMath(cleanExpr)) {
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
export const CANONICAL_ALGEBRA_IDENTITIES: Record<string, { expectedLeft: string; expectedRight: string; labelVi: string }> = {
  square_sum: { expectedLeft: '(a+b)^2', expectedRight: 'a^2+2*a*b+b^2', labelVi: 'bình phương một tổng' },
  square_difference: { expectedLeft: '(a-b)^2', expectedRight: 'a^2-2*a*b+b^2', labelVi: 'bình phương một hiệu' },
  difference_squares: { expectedLeft: 'a^2-b^2', expectedRight: '(a-b)*(a+b)', labelVi: 'hiệu hai bình phương' },
  cube_sum_expansion: { expectedLeft: '(a+b)^3', expectedRight: 'a^3+3*a^2*b+3*a*b^2+b^3', labelVi: 'lập phương một tổng' },
  cube_difference_expansion: { expectedLeft: '(a-b)^3', expectedRight: 'a^3-3*a^2*b+3*a*b^2-b^3', labelVi: 'lập phương một hiệu' },
  sum_cubes: { expectedLeft: 'a^3+b^3', expectedRight: '(a+b)*(a^2-a*b+b^2)', labelVi: 'tổng hai lập phương' },
  difference_cubes: { expectedLeft: 'a^3-b^3', expectedRight: '(a-b)*(a^2+a*b+b^2)', labelVi: 'hiệu hai lập phương' }
};

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

  // 2. Kiểm định identityId đối chiếu với định nghĩa toán học chuẩn tắc
  const canonical = CANONICAL_ALGEBRA_IDENTITIES[payload.identityId];
  if (canonical) {
    const cleanLeft = payload.leftExpression.replace(/\s+/g, '');
    const cleanExpectedLeft = canonical.expectedLeft.replace(/\s+/g, '');
    const cleanExpectedRight = canonical.expectedRight.replace(/\s+/g, '');
    if (cleanLeft !== cleanExpectedLeft && cleanLeft !== cleanExpectedRight) {
      return {
        valid: false,
        reason: `identity_id_mismatch: Phân cảnh khai báo identityId '${payload.identityId}' nhưng vế trái là '${payload.leftExpression}' (kỳ vọng: '${canonical.expectedLeft}')`
      };
    }

    // 2b. Kiểm tra nhãn storyboard không được xung đột trực tiếp với định danh toán học
    const sceneText = `${scene.title ?? ''} ${scene.narration?.vietnamese ?? ''}`.toLowerCase();
    if (payload.identityId === 'square_difference' && (sceneText.includes('bình phương của một tổng') || sceneText.includes('bình phương một tổng'))) {
      return {
        valid: false,
        reason: `storyboard_label_mismatch: Phân cảnh khai báo identityId '${payload.identityId}' nhưng tiêu đề/lời dẫn lại ghi 'Bình phương của một tổng'`
      };
    }
    if (payload.identityId === 'square_sum' && (sceneText.includes('bình phương của một hiệu') || sceneText.includes('bình phương một hiệu'))) {
      return {
        valid: false,
        reason: `storyboard_label_mismatch: Phân cảnh khai báo identityId '${payload.identityId}' nhưng tiêu đề/lời dẫn lại ghi 'Bình phương của một hiệu'`
      };
    }
  }

  // 3. Nhất quán tuyệt đối giữa claim.formalExpression và scene left/right
  const expectedRelation = `${payload.leftExpression}=${payload.rightExpression}`.replace(/\s+/g, '');
  const claimRelation = (matchingClaim.formalExpression ?? '').replace(/\s+/g, '');
  if (claimRelation !== expectedRelation) {
    return {
      valid: false,
      reason: `algebra_expression_mismatch: Phân cảnh biểu diễn '${payload.leftExpression} = ${payload.rightExpression}' không khớp với formalExpression '${matchingClaim.formalExpression}' của mệnh đề`
    };
  }

  // 4. Chứng minh mọi bước biến đổi trung gian E_0 = E_1 = ... = E_n bằng SymPy
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
  optimizationTrace?: unknown;
}

export function validateGradientDescentClaim(
  claim: EducationalClaimV3,
  trace?: unknown
): {
  status: 'numerically_validated' | 'rejected' | 'human_review_required';
  numericalValidationSummary?: string;
  traceFingerprint?: string;
  traceCanonical?: string;
  contradictionReason?: string;
  notes?: string;
} {
  const expr = claim.formalExpression ?? '';
  const stmt = claim.statement ?? '';

  if (!expr.trim()) {
    return {
      status: 'human_review_required',
      notes: 'missing_gradient_update_expression: Numeric validation requires an explicit bounded gradient-descent update expression.'
    };
  }

  const normalizedRule = expr
    .toLowerCase()
    .replace(/η/g, 'eta')
    .replace(/\\eta/g, 'eta')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\nabla\s*l/g, 'grad_l')
    .replace(/w_\{t\+1\}/g, 'w_next')
    .replace(/w_t/g, 'w')
    .replace(/[{}\s]/g, '');

  if (normalizedRule !== 'w_next=w-eta*grad_l(w)') {
    return {
      status: /w_next=w\+eta\*grad_l\(w\)/.test(normalizedRule) ? 'rejected' : 'human_review_required',
      contradictionReason: /w_next=w\+eta\*grad_l\(w\)/.test(normalizedRule)
        ? 'gradient_ascent_contradiction: Gradient descent update must subtract the learning-rate-scaled gradient.'
        : undefined,
      notes: `unsupported_gradient_update_expression: '${expr}' does not match the bounded rule w_next = w - eta * grad_L(w).`
    };
  }

  // 1. Kiểm tra mâu thuẫn trực tiếp về chiều gradient (ascent vs descent)
  if (/\+\s*(?:eta|\\eta)\s*(?:\*|\\cdot)?\s*(?:grad|\\nabla)/i.test(expr) || /cộng\s+(?:với\s+)?(?:tốc độ học|learning rate|eta)/i.test(stmt)) {
    return {
      status: 'rejected',
      contradictionReason: 'gradient_ascent_contradiction: Gradient descent update must move in the opposite direction of the gradient (- eta * grad_L), but addition was detected.',
      notes: 'Phát hiện mâu thuẫn: công thức tăng gradient (ascent) thay vì hạ gradient (descent).'
    };
  }

  // 2. Kiểm định tính toán chuỗi tham số mất mát theo OptimizationTraceDataV1Schema
  if (!trace) {
    return {
      status: 'human_review_required',
      notes: 'missing_optimization_trace: No storyboard-derived optimization trace is bound to this claim.'
    };
  }

  const parsedTrace = OptimizationTraceDataV1Schema.safeParse(trace);
  if (!parsedTrace.success) {
    const errorMsg = parsedTrace.error.issues.map((i) => i.message).join('; ');
    return {
      status: 'rejected',
      contradictionReason: `invalid_optimization_trace: ${errorMsg}`,
      notes: `Chuỗi giá trị tham số và hàm mất mát vi phạm tính toán số học: ${errorMsg}`
    };
  }

  if (parsedTrace.data.claimId !== claim.id) {
    return {
      status: 'rejected',
      contradictionReason: `optimization_trace_claim_mismatch: Trace '${parsedTrace.data.claimId}' cannot validate claim '${claim.id}'.`,
      notes: 'The deterministic trace is bound to a different claim and cannot be reused as verification evidence.'
    };
  }

  // 3. Kiểm định nhất quán văn bản
  const semantic = inspectStatementSemanticConsistency(stmt, expr);
  if (semantic.status === 'contradiction_detected') {
    return {
      status: 'rejected',
      contradictionReason: semantic.reason,
      notes: `Statement contradiction: ${semantic.reason}`
    };
  }

  const traceCanonical = JSON.stringify(parsedTrace.data);
  return {
    status: 'numerically_validated',
    numericalValidationSummary: `Numerically validated first-order gradient descent parameter update on the bound convex quadratic trace (${parsedTrace.data.expression})`,
    traceFingerprint: createHash('sha256').update(traceCanonical, 'utf8').digest('hex'),
    traceCanonical,
    notes: `Kiểm định tính toán số học chính xác trên hàm mất mát lồi với tốc độ học eta=${parsedTrace.data.learningRate}`
  };
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
    const isGradientDescentTopic = topicId === 'ai.gradient_descent.optimization';

    const isGradientDescentClaim = (c: EducationalClaimV3) =>
      c.validatorKey === 'gradient_descent_formula' ||
      (isGradientDescentTopic && (c.validatorKey === 'gradient_descent_formula' || Boolean(c.formalExpression?.includes('grad_L') || c.formalExpression?.includes('nabla'))));

    const sympyMathClaims = formalMathClaims.filter((c) => !isGradientDescentClaim(c));

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

    if ((isDerivativeTopic || isRiemannTopic) && sympyMathClaims.length > 0 && !mathSpec) {
      for (const c of sympyMathClaims) {
        sympyResultsByClaimId.set(c.id, {
          passed: false,
          reason: 'missing_math_spec: Formal verification requires the exact requested MathSpec'
        });
      }
    } else if ((isDerivativeTopic || isRiemannTopic) && sympyMathClaims.length > 0) {
      try {
        const v2ClaimsToVerify: VerifiedClaim[] = sympyMathClaims.map((c) => {
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
        for (const c of sympyMathClaims) {
          sympyResultsByClaimId.set(c.id, { passed: false, reason: err instanceof Error ? err.message : String(err) });
        }
      }
    } else if (sympyMathClaims.length > 0 && !isAlgebraIdentityTopic) {
      try {
        const claimsToVerify: VerifiedClaim[] = sympyMathClaims.map((c) => ({
          id: c.id,
          statement: c.statement,
          validatorKey: c.validatorKey ?? c.id,
          expectedExpression: c.formalExpression ?? c.statement,
          verificationStatus: 'unverified'
        }));
        const verifyResult = await this.mathVerifier.verifyClaims(topicId, claimsToVerify, { mathSpec });
        mappedMathClaims = new Map(verifyResult.claims.map((claim) => [claim.id, claim]));
        for (const verifiedClaim of verifyResult.claims) {
          const check = verifyResult.result.checks[verifiedClaim.validatorKey];
          const isCheckVerified = check?.status === 'verified';
          const isCheckRejected = check?.status === 'incorrect' || check?.status === 'rejected';
          const passed = Boolean(check?.passed || isCheckVerified);
          sympyResultsByClaimId.set(verifiedClaim.id, {
            passed,
            reason: check?.reason ?? (isCheckRejected ? 'verification_failed' : undefined)
          });
        }
      } catch (err) {
        for (const c of sympyMathClaims) {
          sympyResultsByClaimId.set(c.id, { passed: false, reason: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    // Xử lý từng mệnh đề theo nguyên tắc toàn vẹn tri thức
    for (const claim of claims) {
      const cloned: EducationalClaimV3 = { ...claim };

      if (isGradientDescentClaim(claim)) {
        const gdResult = validateGradientDescentClaim(claim, input.optimizationTrace);
        if (gdResult.status === 'rejected') {
          cloned.verificationStatus = 'rejected';
          cloned.formalExpressionVerified = false;
          cloned.formalProofSummary = undefined;
          cloned.statementContradictionReason = gdResult.contradictionReason;
          cloned.humanReviewComment = gdResult.notes;
          claimReports.push({
            claimId: cloned.id,
            claimType: cloned.claimType,
            status: 'rejected',
            verifierNotes: cloned.humanReviewComment,
            verifierImplementation: 'OptimizationTraceDataV1Schema/DeterministicNumeric'
          });
        } else if (gdResult.status === 'numerically_validated') {
          cloned.verificationStatus = 'numerically_validated';
          cloned.formalExpressionVerified = false;
          cloned.proofRecordId = undefined;
          cloned.formalProofSummary = undefined;
          cloned.humanReviewComment = undefined;
          claimReports.push({
            claimId: cloned.id,
            claimType: cloned.claimType,
            status: 'numerically_validated',
            verifierNotes: `${gdResult.numericalValidationSummary}; trace_sha256=${gdResult.traceFingerprint}`,
            verifierImplementation: 'OptimizationTraceDataV1Schema/DeterministicNumeric',
            verificationBinding: {
              claimId: claim.id,
              exactExpression: claim.formalExpression ?? claim.statement,
              mathSpecCanonical: gdResult.traceCanonical!,
              assumptions: ['convex_quadratic_loss', 'learning_rate_in_bounds']
            }
          });
        } else {
          cloned.verificationStatus = 'human_review_required';
          cloned.formalExpressionVerified = false;
          cloned.formalProofSummary = undefined;
          cloned.humanReviewComment = gdResult.notes ?? 'Yêu cầu giáo viên rà soát tham số và tốc độ học.';
          claimReports.push({
            claimId: cloned.id,
            claimType: cloned.claimType,
            status: 'human_review_required',
            verifierNotes: cloned.humanReviewComment,
            verifierImplementation: 'OptimizationTraceDataV1Schema/DeterministicNumeric'
          });
        }
      }
      // 1. Mệnh đề TOÁN HỌC HÌNH THỨC (formal_mathematics)
      else if (claim.claimType === 'formal_mathematics') {
        const sympyCheck = sympyResultsByClaimId.get(claim.id);
        const mapped = mappedMathClaims.get(claim.id);

        const formalProven = Boolean(sympyCheck?.passed);
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
          const isCheckUnverified = sympyCheck?.reason?.includes('No formal SymPy verifier') || mapped?.verificationStatus === 'unverified' || (!sympyCheck && !mapped);
          const isCheckFailed = mapped?.verificationStatus === 'failed' || (sympyCheck && !sympyCheck.passed && !sympyCheck.reason?.includes('No formal SymPy verifier') && !sympyCheck.reason?.includes('unsupported') && !sympyCheck.reason?.includes('prose_unverified') && !sympyCheck.reason?.includes('missing_math_spec'));

          if (isCheckUnverified) {
            cloned.verificationStatus = 'human_review_required';
            cloned.formalExpressionVerified = false;
            cloned.formalProofSummary = undefined;
            cloned.humanReviewComment = 'Mệnh đề chưa có bộ kiểm định SymPy hình thức tương ứng; cần giáo viên rà soát thủ công.';
          } else if (isCheckFailed) {
            cloned.verificationStatus = 'rejected';
            cloned.formalExpressionVerified = false;
            cloned.formalProofSummary = undefined;
            cloned.humanReviewComment = `SymPy formal verification failed: ${sympyCheck?.reason ?? 'expression mismatch'}`;
          } else {
            cloned.verificationStatus = 'human_review_required';
            cloned.formalExpressionVerified = false;
            cloned.formalProofSummary = undefined;
            cloned.humanReviewComment = semantic.reason ?? 'Cần giáo viên xác nhận ngữ nghĩa.';
          }
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

  // Trích xuất optimization trace từ phân cảnh loss_landscape nếu có
  let optimizationTrace: unknown = undefined;
  if (lessonPlan.storyboard) {
    const lossScene = lessonPlan.storyboard.scenes.find((s) => s.sceneType === 'loss_landscape');
    const boundClaimId = lossScene?.boundClaimIds[0];
    if (lossScene?.visualPayload.sceneType === 'loss_landscape' && boundClaimId) {
      const p = lossScene.visualPayload;
      optimizationTrace = {
        kind: 'optimization_trace_1d',
        expression: `L(w)=${p.curvature}(w-${p.minimumPoint.w})^2+${p.minimumPoint.loss}`,
        learningRate: p.learningRate,
        points: p.steps.map((st) => ({ step: st.stepNumber, parameter: st.w, value: st.loss, gradient: st.gradient })),
        claimId: boundClaimId,
        validation: 'deterministic_numeric'
      };
    }
  }

  // 1. Kiểm định toàn bộ claims
  const validationResult = await validator.validateClaims({
    lessonId: lessonPlan.lessonId,
    topicId: lessonPlan.topicId,
    domain: lessonPlan.domain,
    claims: lessonPlan.educationalClaims,
    sourceEvidence,
    mathSpec: (lessonPlan as unknown as { mathSpec?: any }).mathSpec,
    assumptions: lessonPlan.validationReport?.claimReports.flatMap((r) => r.verificationBinding?.assumptions ?? []),
    optimizationTrace
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

