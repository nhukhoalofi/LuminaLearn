import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VerifiedClaim } from '@luminalearn/scene-schema';

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
    options?: { timeoutMs?: number; context?: Record<string, unknown> }
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

/**
 * Base SymPy Verifier using the LuminaLearn Python Math Engine CLI
 */
abstract class BaseSymPyVerifier implements MathVerifier {
  public readonly isMock = false;
  abstract readonly name: string;
  abstract supportsTopic(topicId: string): boolean;
  protected abstract buildSceneJson(topicId: string, claims: VerifiedClaim[]): Record<string, unknown>;

  public async verify(
    topicId: string,
    claims: VerifiedClaim[],
    options?: { timeoutMs?: number; context?: Record<string, unknown> }
  ): Promise<VerificationResult> {
    const timeoutMs = options?.timeoutMs ?? 15_000;
    const python = getPythonExecutable();

    const tempDir = await mkdtemp(join(tmpdir(), 'lumina-verify-'));
    const scenePath = join(tempDir, 'scene.json');
    const claimsPath = join(tempDir, 'claims.json');

    try {
      const sceneData = this.buildSceneJson(topicId, claims);
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

  protected buildSceneJson(topicId: string, claims: VerifiedClaim[]): Record<string, unknown> {
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

  protected buildSceneJson(topicId: string, claims: VerifiedClaim[]): Record<string, unknown> {
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
    options?: { timeoutMs?: number }
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
    options?: { timeoutMs?: number; context?: Record<string, unknown> }
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

    // Map verification results back to claims
    const mappedClaims: VerifiedClaim[] = claims.map((claim) => {
      const check = result.checks[claim.validatorKey];
      if (!check) {
        return {
          ...claim,
          verificationStatus: 'unverified' as const
        };
      }
      if (check.passed && check.status === 'verified') {
        return {
          ...claim,
          verificationStatus: 'verified' as const
        };
      }
      return {
        ...claim,
        verificationStatus: 'failed' as const
      };
    });

    const allVerified =
      result.status === 'verified' &&
      mappedClaims.every((c) => c.verificationStatus === 'verified');

    return {
      allVerified,
      claims: mappedClaims,
      result
    };
  }
}

