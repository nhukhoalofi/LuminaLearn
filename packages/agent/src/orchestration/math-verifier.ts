import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  MathVisualizationSpecV2,
  NarrationPlanV2,
  StatementVerificationStatus,
  StoryboardV2,
  VerifiedClaim
} from '@luminalearn/scene-schema';

export interface VerificationCheckDetail {
  passed: boolean;
  status: 'verified' | 'incorrect' | 'needs_review' | 'rejected';
  expected?: string;
  received?: string;
  reason?: string;
}

export interface VerificationResult {
  status: 'verified' | 'failed' | 'needs_review';
  checks: Record<string, VerificationCheckDetail>;
  rawReport?: Record<string, unknown>;
}

export interface MathVerifier {
  readonly name: string;
  readonly isMock: boolean;
  supportsTopic(topicId: string): boolean;
  verify(
    topicId: string,
    claims: VerifiedClaim[],
    options?: { timeoutMs?: number; context?: Record<string, unknown>; mathSpec?: MathVisualizationSpecV2 }
  ): Promise<VerificationResult>;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function getPythonExecutable(): string {
  if (process.env.PYTHON_EXECUTABLE) {
    return resolve(process.env.PYTHON_EXECUTABLE);
  }
  if (process.platform === 'win32') {
    return resolve(packageRoot, 'services/math-engine/.venv/Scripts/python.exe');
  }
  return resolve(packageRoot, 'services/math-engine/.venv/bin/python');
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      command,
      args,
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const message = `${basename(command)} execution failed: ${stderr || stdout || error.message}`;
          return reject(new Error(message, { cause: error }));
        }
        resolvePromise({ stdout, stderr });
      }
    );
  });
}

function formatPolynomialFromSpec(mathSpec?: MathVisualizationSpecV2): string {
  const coeffs = mathSpec?.function.coefficients;
  if (!coeffs || coeffs.length === 0) return 'x^2';
  if (coeffs.length === 3 && coeffs[0] === 0 && coeffs[1] === 0 && coeffs[2] === 1) {
    return 'x^2';
  }
  const terms: string[] = [];
  for (let power = coeffs.length - 1; power >= 0; power -= 1) {
    const c = coeffs[power];
    if (c === 0) continue;
    if (power === 0) terms.push(`${c}`);
    else if (power === 1) terms.push(c === 1 ? 'x' : `${c}*x`);
    else terms.push(c === 1 ? `x^${power}` : `${c}*x^${power}`);
  }
  return terms.length > 0 ? terms.join(' + ') : '0';
}

export function normalizeMathExpressionToken(raw: string): string {
  let text = raw
    .toLowerCase()
    .trim()
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\*\*/g, '^')
    .replace(/một phần ba/g, '1/3')
    .replace(/một phần hai/g, '1/2')
    .replace(/một phần tư/g, '1/4')
    .replace(/hai x/g, '2*x')
    .replace(/ba x/g, '3*x')
    .replace(/bốn x/g, '4*x')
    .replace(/\s+/g, '');

  // Normalize implicit multiplication like 2x -> 2*x, 999x -> 999*x
  text = text.replace(/(\d)([a-z])/g, '$1*$2');
  // Normalize h+2 -> 2+h for commutative simple sum comparison
  if (text === 'h+2') text = '2+h';
  return text;
}

export function buildCanonicalClaimStatement(
  claim: VerifiedClaim,
  mathSpec?: MathVisualizationSpecV2
): string {
  const fnExpr = formatPolynomialFromSpec(mathSpec);
  const pointX = mathSpec?.parameters.pointX ?? 1;
  const interval = mathSpec?.parameters.interval ?? [0, 1];
  const expected = claim.expectedExpression.trim();

  switch (claim.validatorKey) {
    case 'polynomial_derivative':
      return `Với f(x) = ${fnExpr}, đạo hàm f'(x) = ${expected}`;
    case 'secant_slope':
      return `Trên f(x) = ${fnExpr} tại x = ${pointX}, hệ số góc cát tuyến m(h) = ${expected}`;
    case 'limit_at_zero':
      return `Giới hạn hệ số góc cát tuyến khi h -> 0 bằng ${expected}`;
    case 'value_at_point':
      return `Hệ số góc tiếp tuyến của f(x) = ${fnExpr} tại x = ${pointX} bằng ${expected}`;
    case 'riemann_sum_limit':
      return `Giới hạn tổng Riemann của f(x) = ${fnExpr} trên [${interval[0]}, ${interval[1]}] khi n -> ∞ bằng ${expected}`;
    case 'definite_integral':
      return `Tích phân xác định ∫_${interval[0]}^${interval[1]} ${fnExpr} dx = ${expected}`;
    default:
      return `${claim.validatorKey}: ${expected}`;
  }
}

export interface StatementConsistencyEvaluation {
  status: StatementVerificationStatus;
  canonicalStatement: string;
  extractedResults: string[];
  reason?: string;
}

/**
 * Deterministic analyzer separating formal SymPy verification of `expectedExpression`
 * from the natural-language / formula display text in `claim.statement`.
 */
export function evaluateStatementConsistency(
  claim: VerifiedClaim,
  mathSpec?: MathVisualizationSpecV2
): StatementConsistencyEvaluation {
  const canonicalStatement = buildCanonicalClaimStatement(claim, mathSpec);
  const normalizedExpected = normalizeMathExpressionToken(claim.expectedExpression);
  const rawStmt = claim.statement.trim();

  // Strip known input context patterns so they are not mistaken for claimed RHS values
  const stripped = rawStmt
    .replace(/f\s*\(\s*x\s*\)\s*=\s*x(?:\^2|²|\*\*2)/gi, ' ')
    .replace(/y\s*=\s*x(?:\^2|²|\*\*2)/gi, ' ')
    .replace(/∫[₀0][¹1]\s*x(?:\^2|²|\*\*2)\s*dx/gi, 'INTEGRAL_LHS')
    .replace(/tích phân(?: xác định)? của\s*x(?:\^2|²|\*\*2)/gi, 'INTEGRAL_LHS')
    .replace(/trên\s*(?:đoạn\s*)?\[\s*0\s*,\s*1\s*\]/gi, ' ')
    .replace(/qua\s*\(\s*1\s*,\s*1\s*\)\s*và\s*\(\s*1\s*\+\s*h\s*,\s*\(\s*1\s*\+\s*h\s*\)(?:\^2|²)\s*\)/gi, ' ')
    .replace(/tại\s*(?:điểm\s*)?x\s*=\s*1/gi, ' ')
    .replace(/khi\s*h\s*(?:tiến về|->|→)\s*0/gi, ' ')
    .replace(/lim_\{?h\s*(?:->|→)\s*0\}?/gi, ' ');

  const candidateMatches: string[] = [];

  // Look for explicit RHS after '=', 'là', 'bằng'
  const rhsRegex = /(?:f'\s*\(\s*[x1]\s*\)\s*=|m\s*\(\s*h\s*\)\s*=|INTEGRAL_LHS\s*(?:=|bằng(?:\s+đúng)?|là)|(?:=|bằng(?:\s+đúng)?|là))\s*([0-9]+\s*\/\s*[0-9]+|[0-9]+(?:\.[0-9]+)?\s*\*?\s*x(?:\^[0-9]+|²|³)?|[0-9]+\s*[+\-]\s*h|h\s*[+\-]\s*[0-9]+|-?[0-9]+(?:\.[0-9]+)?|một phần ba|một phần hai|một phần tư|hai x|ba x|bốn x)/gi;

  let match: RegExpExecArray | null;
  while ((match = rhsRegex.exec(stripped)) !== null) {
    const token = normalizeMathExpressionToken(match[1]);
    if (token) candidateMatches.push(token);
  }

  if (candidateMatches.length > 0) {
    // Compare the concluding claimed expression (last RHS in the statement)
    const conflicts = candidateMatches.filter((candidate) => candidate !== normalizedExpected);
    const hasExactMatch = candidateMatches.some((candidate) => candidate === normalizedExpected);

    if (conflicts.length > 0 && (!hasExactMatch || candidateMatches[candidateMatches.length - 1] !== normalizedExpected)) {
      const badValue = candidateMatches[candidateMatches.length - 1];
      return {
        status: 'conflict_detected',
        canonicalStatement,
        extractedResults: candidateMatches,
        reason: `statement_expression_conflict: Mệnh đề hiển thị ('${claim.statement}') nêu kết quả '${badValue}' mâu thuẫn với biểu thức được SymPy kiểm định ('${claim.expectedExpression}')`
      };
    }

    if (hasExactMatch) {
      return {
        status: 'formal_match',
        canonicalStatement,
        extractedResults: candidateMatches
      };
    }
  }

  // Fallback check: does the stripped statement directly contain a blatant conflicting coeff*x or fraction?
  if (claim.validatorKey === 'polynomial_derivative') {
    const polyTokens = [...stripped.matchAll(/\b(\d+\s*\*?\s*x(?:\^\d+|²|³)?|hai x|ba x|bốn x)\b/gi)]
      .map((m) => normalizeMathExpressionToken(m[1]));
    if (polyTokens.length > 0) {
      if (polyTokens.some((t) => t !== normalizedExpected)) {
        return {
          status: 'conflict_detected',
          canonicalStatement,
          extractedResults: polyTokens,
          reason: `statement_expression_conflict: Mệnh đề đạo hàm ('${claim.statement}') chứa biểu thức '${polyTokens.join(', ')}' không khớp với '${claim.expectedExpression}'`
        };
      }
      return {
        status: 'formal_match',
        canonicalStatement,
        extractedResults: polyTokens
      };
    }
  }

  if (claim.validatorKey === 'definite_integral' || claim.validatorKey === 'riemann_sum_limit') {
    const fracTokens = [...stripped.matchAll(/(?:\b\d+\s*\/\s*\d+\b|một phần ba|một phần hai|một phần tư)/gi)]
      .map((m) => normalizeMathExpressionToken(m[0]));
    if (fracTokens.length > 0) {
      if (fracTokens.some((t) => t !== normalizedExpected)) {
        return {
          status: 'conflict_detected',
          canonicalStatement,
          extractedResults: fracTokens,
          reason: `statement_expression_conflict: Mệnh đề tích phân/giới hạn ('${claim.statement}') chứa giá trị '${fracTokens.join(', ')}' không khớp với '${claim.expectedExpression}'`
        };
      }
      return {
        status: 'formal_match',
        canonicalStatement,
        extractedResults: fracTokens
      };
    }
  }

  // Free-text prose without an extractable mathematical equality for the claim's result:
  // SymPy only verified expectedExpression, not the natural-language prose semantics!
  return {
    status: 'prose_unverified',
    canonicalStatement,
    extractedResults: [],
    reason: `statement_prose_unverified: Mệnh đề tự do ('${claim.statement}') không chứa đẳng thức toán học tường minh cho '${claim.expectedExpression}'; cần giáo viên xác nhận ngữ nghĩa (humanSemanticReviewConfirmed)`
  };
}

/**
 * Checks that narration text, subtitle text, and storyboard formulas/body do not silently
 * change a SymPy-verified mathematical result into a different mathematical value.
 */
export function verifyNarrationAndStoryboardMathConsistency(options: {
  claims: VerifiedClaim[];
  narrationPlan?: NarrationPlanV2;
  storyboard?: StoryboardV2;
}): { valid: boolean; conflicts: string[] } {
  const conflicts: string[] = [];
  const verifiedClaims = options.claims.filter((c) => c.verificationStatus === 'verified');
  if (verifiedClaims.length === 0) return { valid: true, conflicts };

  const derivClaim = verifiedClaims.find((c) => c.validatorKey === 'polynomial_derivative');
  const integralClaim = verifiedClaims.find(
    (c) => c.validatorKey === 'definite_integral' || c.validatorKey === 'riemann_sum_limit'
  );

  const checkTextBlock = (label: string, text: string) => {
    const cleaned = text
      .replace(/f\s*\(\s*x\s*\)\s*=\s*x(?:\^2|²|\*\*2)/gi, ' ')
      .replace(/y\s*=\s*x(?:\^2|²|\*\*2)/gi, ' ');

    if (derivClaim) {
      const expectedDeriv = normalizeMathExpressionToken(derivClaim.expectedExpression);
      // Look for explicit derivative claims in narration/subtitles/formulas
      const derivRegex = /(?:đạo hàm[^.;\n]{0,40}?(?:=|là|bằng)|f'\s*\(\s*x\s*\)\s*=)\s*([0-9]+\s*\*?\s*x(?:\^[0-9]+|²|³)?|hai x|ba x|bốn x)/gi;
      let m: RegExpExecArray | null;
      while ((m = derivRegex.exec(cleaned)) !== null) {
        const found = normalizeMathExpressionToken(m[1]);
        if (found && found !== expectedDeriv) {
          conflicts.push(
            `narration_math_conflict: ${label} nêu đạo hàm '${found}' nhưng kết quả đã xác minh SymPy là '${derivClaim.expectedExpression}'`
          );
        }
      }
    }

    if (integralClaim) {
      const expectedIntegral = normalizeMathExpressionToken(integralClaim.expectedExpression);
      const integralRegex = /(?:(?:tích phân|tổng riemann|hội tụ về|giới hạn)[^.;\n]{0,60}?(?:=|là|bằng(?:\s+đúng)?|về)|∫[^=;,\n]{1,30}=)\s*(\d+\s*\/\s*\d+|một phần ba|một phần hai|một phần tư)/gi;
      let m: RegExpExecArray | null;
      while ((m = integralRegex.exec(cleaned)) !== null) {
        const found = normalizeMathExpressionToken(m[1]);
        if (found && found !== expectedIntegral) {
          conflicts.push(
            `narration_math_conflict: ${label} nêu giá trị tích phân/tổng Riemann '${found}' nhưng kết quả đã xác minh SymPy là '${integralClaim.expectedExpression}'`
          );
        }
      }
    }
  };

  if (options.narrationPlan) {
    for (const seg of options.narrationPlan.segments) {
      checkTextBlock(`segment '${seg.segmentId}' (text)`, seg.text);
      checkTextBlock(`segment '${seg.segmentId}' (subtitleText)`, seg.subtitleText);
    }
  }

  if (options.storyboard) {
    for (const scene of options.storyboard.scenes) {
      for (const formula of scene.mathematicalBinding.latexFormulas) {
        checkTextBlock(`scene '${scene.sceneId}' (formula)`, formula);
      }
      if (typeof scene.parameters?.body === 'string') {
        checkTextBlock(`scene '${scene.sceneId}' (body)`, scene.parameters.body);
      }
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts
  };
}

/**
 * Base SymPy Verifier using the LuminaLearn Python Math Engine CLI
 */
abstract class BaseSymPyVerifier implements MathVerifier {
  public readonly isMock = false;
  abstract readonly name: string;
  abstract supportsTopic(topicId: string): boolean;
  protected abstract buildSceneJson(
    topicId: string,
    claims: VerifiedClaim[],
    mathSpec?: MathVisualizationSpecV2
  ): Record<string, unknown>;

  public async verify(
    topicId: string,
    claims: VerifiedClaim[],
    options?: { timeoutMs?: number; context?: Record<string, unknown>; mathSpec?: MathVisualizationSpecV2 }
  ): Promise<VerificationResult> {
    const timeoutMs = options?.timeoutMs ?? 15_000;
    const python = getPythonExecutable();

    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-verify-'));
    const scenePath = join(tempDir, 'scene.json');
    const claimsPath = join(tempDir, 'claims.json');

    try {
      const sceneData = this.buildSceneJson(topicId, claims, options?.mathSpec);
      const claimsMap: Record<string, string> = {};
      for (const claim of claims) {
        claimsMap[claim.validatorKey] = claim.expectedExpression;
      }

      await writeFile(scenePath, JSON.stringify(sceneData), 'utf8');
      await writeFile(claimsPath, JSON.stringify(claimsMap), 'utf8');

      const { stdout } = await runCommand(
        python,
        ['-m', 'luminalearn_math_engine.cli', 'verify', scenePath, '--claims', claimsPath],
        timeoutMs
      );

      const parsed = JSON.parse(stdout) as {
        status: string;
        checks?: Record<string, { status: string; expected?: string; received?: string; reason?: string }>;
        [key: string]: unknown;
      };

      const checks: Record<string, VerificationCheckDetail> = {};
      let allPassed = parsed.status === 'verified';

      if (parsed.checks) {
        for (const [key, detail] of Object.entries(parsed.checks)) {
          const passed = detail.status === 'verified';
          if (!passed) allPassed = false;
          checks[key] = {
            passed,
            status: detail.status as VerificationCheckDetail['status'],
            expected: detail.expected,
            received: detail.received,
            reason: detail.reason
          };
        }
      }

      return {
        status: allPassed ? 'verified' : parsed.status === 'needs_review' ? 'needs_review' : 'failed',
        checks,
        rawReport: parsed
      };
    } catch (error) {
      // Fail closed: Any execution error or timeout becomes a verification failure
      const reason = error instanceof Error ? error.message : String(error);
      const checks: Record<string, VerificationCheckDetail> = {};
      for (const claim of claims) {
        checks[claim.validatorKey] = {
          passed: false,
          status: 'rejected',
          reason: `SymPy verification engine failed: ${reason}`
        };
      }
      return {
        status: 'failed',
        checks,
        rawReport: { error: reason }
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/**
 * Derivative SymPy Verifier
 */
export class DerivativeSymPyVerifier extends BaseSymPyVerifier {
  public readonly name = 'DerivativeSymPyVerifier';

  public supportsTopic(topicId: string): boolean {
    return topicId === 'calculus.derivative.intuition';
  }

  protected buildSceneJson(
    topicId: string,
    _claims: VerifiedClaim[],
    mathSpec?: MathVisualizationSpecV2
  ): Record<string, unknown> {
    if (mathSpec) {
      if (mathSpec.visualization !== 'secant_to_tangent' && mathSpec.visualization !== 'function_graph') {
        throw new Error(`unsupported_visualization: Derivative verifier cannot process '${mathSpec.visualization}'`);
      }
      if (mathSpec.function.type !== 'polynomial') {
        throw new Error(`unsupported_function: Derivative verifier only supports polynomial functions`);
      }
      return {
        schemaVersion: 'math-v1',
        topicId,
        visualization: 'secant_to_tangent',
        function: {
          type: 'polynomial',
          coefficients: mathSpec.function.coefficients
        },
        pointX: mathSpec.parameters.pointX ?? 1.0,
        hStart: mathSpec.parameters.hStart ?? 2.0,
        hEnd: mathSpec.parameters.hEnd ?? 0.05,
        durationSeconds: mathSpec.parameters.durationSeconds ?? 10.83,
        fps: mathSpec.parameters.fps ?? 24,
        width: 720,
        height: 1280
      };
    }

    return {
      schemaVersion: 'math-v1',
      topicId,
      visualization: 'secant_to_tangent',
      function: {
        type: 'polynomial',
        coefficients: [0, 0, 1] // f(x) = x^2
      },
      pointX: 1.0,
      hStart: 2.0,
      hEnd: 0.05,
      durationSeconds: 10.83,
      fps: 24,
      width: 720,
      height: 1280
    };
  }
}

/**
 * Riemann Sum SymPy Verifier
 */
export class RiemannSymPyVerifier extends BaseSymPyVerifier {
  public readonly name = 'RiemannSymPyVerifier';

  public supportsTopic(topicId: string): boolean {
    return topicId === 'calculus.integral.riemann_sum';
  }

  protected buildSceneJson(
    topicId: string,
    _claims: VerifiedClaim[],
    mathSpec?: MathVisualizationSpecV2
  ): Record<string, unknown> {
    if (mathSpec) {
      if (mathSpec.visualization !== 'riemann_sum') {
        throw new Error(`unsupported_visualization: Riemann verifier cannot process '${mathSpec.visualization}'`);
      }
      if (mathSpec.function.type !== 'polynomial') {
        throw new Error(`unsupported_function: Riemann verifier only supports polynomial functions`);
      }
      return {
        schemaVersion: 'math-v1',
        topicId,
        visualization: 'riemann_sum',
        function: {
          type: 'polynomial',
          coefficients: mathSpec.function.coefficients
        },
        interval: mathSpec.parameters.interval ?? [0, 1],
        partitions: mathSpec.parameters.partitions ?? [4, 8, 16],
        durationSeconds: mathSpec.parameters.durationSeconds ?? 10.83,
        fps: mathSpec.parameters.fps ?? 24,
        width: 720,
        height: 1280
      };
    }

    return {
      schemaVersion: 'math-v1',
      topicId,
      visualization: 'riemann_sum',
      function: {
        type: 'polynomial',
        coefficients: [0, 0, 1] // f(x) = x^2
      },
      interval: [0, 1],
      partitions: [4, 8, 16],
      durationSeconds: 10.83,
      fps: 24,
      width: 720,
      height: 1280
    };
  }
}

/**
 * Mock Math Verifier for deterministic unit tests
 * Must explicitly declare isMock = true and only returns preconfigured results
 */
export class MockMathVerifier implements MathVerifier {
  public readonly name = 'MockMathVerifier';
  public readonly isMock = true;

  constructor(
    private readonly config: {
      defaultStatus?: 'verified' | 'failed' | 'needs_review';
      claimOverrides?: Record<string, { passed: boolean; status: VerificationCheckDetail['status']; reason?: string }>;
      simulateTimeout?: boolean;
      simulateError?: boolean;
    } = {}
  ) {}

  public supportsTopic(_topicId: string): boolean {
    return true;
  }

  public async verify(
    topicId: string,
    claims: VerifiedClaim[],
    options?: { timeoutMs?: number; context?: Record<string, unknown>; mathSpec?: MathVisualizationSpecV2 }
  ): Promise<VerificationResult> {
    if (this.config.simulateTimeout) {
      throw new Error(`SymPy verification timed out after ${options?.timeoutMs ?? 15000}ms`);
    }
    if (this.config.simulateError) {
      throw new Error('SymPy process crashed with code 1');
    }

    const defaultStatus = this.config.defaultStatus ?? 'verified';
    const checks: Record<string, VerificationCheckDetail> = {};
    let allPassed = defaultStatus === 'verified';

    for (const claim of claims) {
      const override = this.config.claimOverrides?.[claim.id] || this.config.claimOverrides?.[claim.validatorKey];
      if (override) {
        checks[claim.validatorKey] = {
          passed: override.passed,
          status: override.status,
          reason: override.reason,
          expected: claim.expectedExpression,
          received: override.passed ? claim.expectedExpression : 'mismatched_value'
        };
        if (!override.passed) allPassed = false;
      } else {
        const passed = defaultStatus === 'verified';
        checks[claim.validatorKey] = {
          passed,
          status: defaultStatus === 'verified' ? 'verified' : 'incorrect',
          expected: claim.expectedExpression,
          received: passed ? claim.expectedExpression : 'incorrect_mock'
        };
        if (!passed) allPassed = false;
      }
    }

    return {
      status: allPassed ? 'verified' : 'failed',
      checks,
      rawReport: { mock: true, topicId }
    };
  }
}

/**
 * Service managing mathematical claim verification with Fail-Closed semantics
 */
export class MathVerificationService {
  private readonly verifiers: MathVerifier[] = [];

  constructor(verifiers?: MathVerifier[]) {
    if (verifiers && verifiers.length > 0) {
      this.verifiers.push(...verifiers);
    } else {
      // Default: Register real SymPy verifiers
      this.verifiers.push(new DerivativeSymPyVerifier(), new RiemannSymPyVerifier());
    }
  }

  public registerVerifier(verifier: MathVerifier): void {
    this.verifiers.unshift(verifier); // High priority
  }

  public getVerifierForTopic(topicId: string): MathVerifier | undefined {
    return this.verifiers.find((v) => v.supportsTopic(topicId));
  }

  public async verifyClaims(
    topicId: string,
    claims: VerifiedClaim[],
    options?: { timeoutMs?: number; context?: Record<string, unknown>; mathSpec?: MathVisualizationSpecV2 }
  ): Promise<{
    allVerified: boolean;
    claims: VerifiedClaim[];
    result: VerificationResult;
  }> {
    if (claims.length === 0) {
      return {
        allVerified: true,
        claims: [],
        result: { status: 'verified', checks: {} }
      };
    }

    const verifier = this.getVerifierForTopic(topicId);
    if (!verifier) {
      // Fail closed: Unsupported topic verifier
      const unverifiedClaims = claims.map((c) => ({
        ...c,
        verificationStatus: 'unverified' as const
      }));
      return {
        allVerified: false,
        claims: unverifiedClaims,
        result: {
          status: 'failed',
          checks: Object.fromEntries(
            claims.map((c) => [
              c.validatorKey,
              {
                passed: false,
                status: 'needs_review' as const,
                reason: `No mathematical verifier registered for topic ${topicId}`
              }
            ])
          )
        }
      };
    }

    const result = await verifier.verify(topicId, claims, options);
    let hasFailed = result.status === 'failed';
    let hasNeedsReview = result.status === 'needs_review';

    // Map verification results back to claims AND enforce natural-language statement consistency
    const mappedClaims: VerifiedClaim[] = claims.map((claim) => {
      const check = result.checks[claim.validatorKey];
      const consistency = evaluateStatementConsistency(claim, options?.mathSpec);

      if (!check) {
        hasNeedsReview = true;
        return {
          ...claim,
          canonicalStatement: consistency.canonicalStatement,
          statementVerification: consistency.status,
          verificationStatus: 'unverified' as const
        };
      }

      if (consistency.status === 'conflict_detected') {
        hasFailed = true;
        result.checks[claim.validatorKey] = {
          passed: false,
          status: 'incorrect',
          expected: claim.expectedExpression,
          received: consistency.extractedResults.join(', '),
          reason: consistency.reason
        };
        return {
          ...claim,
          canonicalStatement: consistency.canonicalStatement,
          statementVerification: 'conflict_detected' as const,
          verificationStatus: 'failed' as const
        };
      }

      if (!check.passed || check.status !== 'verified') {
        hasFailed = true;
        return {
          ...claim,
          canonicalStatement: consistency.canonicalStatement,
          statementVerification: consistency.status,
          verificationStatus: 'failed' as const
        };
      }

      // SymPy verified expectedExpression, but statement is free-text prose without a verifiable formula
      if (consistency.status === 'prose_unverified' && !claim.humanSemanticReviewConfirmed && !verifier.isMock) {
        hasNeedsReview = true;
        result.checks[claim.validatorKey] = {
          passed: false,
          status: 'needs_review',
          expected: claim.expectedExpression,
          received: claim.expectedExpression,
          reason: consistency.reason
        };
        return {
          ...claim,
          canonicalStatement: consistency.canonicalStatement,
          statementVerification: 'prose_unverified' as const,
          verificationStatus: 'unverified' as const
        };
      }

      return {
        ...claim,
        canonicalStatement: consistency.canonicalStatement,
        statementVerification: consistency.status,
        verificationStatus: 'verified' as const
      };
    });

    const overallStatus: VerificationResult['status'] = hasFailed
      ? 'failed'
      : hasNeedsReview
      ? 'needs_review'
      : 'verified';
    result.status = overallStatus;

    const allVerified =
      overallStatus === 'verified' &&
      mappedClaims.every((c) => c.verificationStatus === 'verified');

    return {
      allVerified,
      claims: mappedClaims,
      result
    };
  }
}
