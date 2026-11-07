import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { VerifiedClaim } from '@luminalearn/scene-schema';
import {
  DerivativeSymPyVerifier,
  RiemannSymPyVerifier,
  MockMathVerifier,
  MathVerificationService,
  LessonOrchestrator
} from '../src/index';

describe('Milestone 1 — Mathematical Verification Gate (P0)', () => {
  describe('DerivativeSymPyVerifier (Real SymPy)', () => {
    it('verifies correct derivative claims against SymPy', async () => {
      const verifier = new DerivativeSymPyVerifier();
      const claims: VerifiedClaim[] = [
        {
          id: 'claim_poly',
          statement: "f'(x) = 2x",
          validatorKey: 'polynomial_derivative',
          expectedExpression: '2*x',
          verificationStatus: 'unverified'
        },
        {
          id: 'claim_point',
          statement: "f'(1) = 2",
          validatorKey: 'value_at_point',
          expectedExpression: '2',
          verificationStatus: 'unverified'
        }
      ];

      const result = await verifier.verify('calculus.derivative.intuition', claims);
      assert.equal(result.status, 'verified');
      assert.equal(result.checks.polynomial_derivative?.passed, true);
      assert.equal(result.checks.value_at_point?.passed, true);
    });

    it('rejects incorrect derivative claim (e.g. f\'(x) = 3x for x^2) using SymPy', async () => {
      const verifier = new DerivativeSymPyVerifier();
      const claims: VerifiedClaim[] = [
        {
          id: 'claim_wrong_deriv',
          statement: "f'(x) = 3x",
          validatorKey: 'polynomial_derivative',
          expectedExpression: '3*x', // Incorrect! True derivative is 2*x
          verificationStatus: 'unverified'
        }
      ];

      const result = await verifier.verify('calculus.derivative.intuition', claims);
      assert.equal(result.status, 'failed');
      assert.equal(result.checks.polynomial_derivative?.passed, false);
      assert.equal(result.checks.polynomial_derivative?.status, 'incorrect');
      assert.equal(result.checks.polynomial_derivative?.expected, '2*x');
      assert.equal(result.checks.polynomial_derivative?.received, '3*x');
    });

    it('handles unsupported validator keys gracefully with needs_review', async () => {
      const verifier = new DerivativeSymPyVerifier();
      const claims: VerifiedClaim[] = [
        {
          id: 'claim_unknown',
          statement: 'Some unknown claim',
          validatorKey: 'non_existent_validator_key',
          expectedExpression: '42',
          verificationStatus: 'unverified'
        }
      ];

      const result = await verifier.verify('calculus.derivative.intuition', claims);
      assert.equal(result.status, 'needs_review');
      assert.equal(result.checks.non_existent_validator_key?.passed, false);
      assert.equal(result.checks.non_existent_validator_key?.status, 'needs_review');
    });
  });

  describe('RiemannSymPyVerifier (Real SymPy)', () => {
    it('verifies correct Riemann sum and integral claims against SymPy', async () => {
      const verifier = new RiemannSymPyVerifier();
      const claims: VerifiedClaim[] = [
        {
          id: 'claim_riemann_limit',
          statement: 'Limit of Riemann sum is 1/3',
          validatorKey: 'riemann_sum_limit',
          expectedExpression: '1/3',
          verificationStatus: 'unverified'
        },
        {
          id: 'claim_def_integral',
          statement: 'Definite integral is 1/3',
          validatorKey: 'definite_integral',
          expectedExpression: '1/3',
          verificationStatus: 'unverified'
        }
      ];

      const result = await verifier.verify('calculus.integral.riemann_sum', claims);
      assert.equal(result.status, 'verified');
      assert.equal(result.checks.riemann_sum_limit?.passed, true);
      assert.equal(result.checks.definite_integral?.passed, true);
    });

    it('rejects incorrect Riemann integral claim using SymPy', async () => {
      const verifier = new RiemannSymPyVerifier();
      const claims: VerifiedClaim[] = [
        {
          id: 'claim_wrong_integral',
          statement: 'Definite integral is 1/2',
          validatorKey: 'definite_integral',
          expectedExpression: '1/2', // Incorrect! True integral is 1/3
          verificationStatus: 'unverified'
        }
      ];

      const result = await verifier.verify('calculus.integral.riemann_sum', claims);
      assert.equal(result.status, 'failed');
      assert.equal(result.checks.definite_integral?.passed, false);
      assert.equal(result.checks.definite_integral?.status, 'incorrect');
    });
  });

  describe('MathVerificationService & Fail-Closed Gate', () => {
    it('fails closed when SymPy times out', async () => {
      const mockVerifier = new MockMathVerifier({ simulateTimeout: true });
      const service = new MathVerificationService([mockVerifier]);

      const claims: VerifiedClaim[] = [
        {
          id: 'claim_1',
          statement: 'Some math claim',
          validatorKey: 'some_key',
          expectedExpression: '2*x',
          verificationStatus: 'unverified'
        }
      ];

      // Verifier times out -> verification should fail closed
      await assert.rejects(
        () => service.verifyClaims('calculus.derivative.intuition', claims, { timeoutMs: 100 }),
        /timed out/i
      );
    });

    it('fails closed when SymPy crashes', async () => {
      const mockVerifier = new MockMathVerifier({ simulateError: true });
      const service = new MathVerificationService([mockVerifier]);

      const claims: VerifiedClaim[] = [
        {
          id: 'claim_1',
          statement: 'Some math claim',
          validatorKey: 'some_key',
          expectedExpression: '2*x',
          verificationStatus: 'unverified'
        }
      ];

      await assert.rejects(
        () => service.verifyClaims('calculus.derivative.intuition', claims),
        /crashed/i
      );
    });

    it('marks partial claims accurately and fails overall verification if any claim fails', async () => {
      const mockVerifier = new MockMathVerifier({
        claimOverrides: {
          claim_good: { passed: true, status: 'verified' },
          claim_bad: { passed: false, status: 'incorrect', reason: 'Value does not match' }
        }
      });
      const service = new MathVerificationService([mockVerifier]);

      const claims: VerifiedClaim[] = [
        {
          id: 'claim_good',
          statement: 'Correct claim',
          validatorKey: 'key_good',
          expectedExpression: '2*x',
          verificationStatus: 'unverified'
        },
        {
          id: 'claim_bad',
          statement: 'Wrong claim',
          validatorKey: 'key_bad',
          expectedExpression: '3*x',
          verificationStatus: 'unverified'
        }
      ];

      const report = await service.verifyClaims('calculus.derivative.intuition', claims);
      assert.equal(report.allVerified, false);
      assert.equal(report.claims.find((c) => c.id === 'claim_good')?.verificationStatus, 'verified');
      assert.equal(report.claims.find((c) => c.id === 'claim_bad')?.verificationStatus, 'failed');
    });

    it('halts orchestration immediately and does NOT generate storyboard or manifest when verification fails', async () => {
      const mockVerifier = new MockMathVerifier({
        claimOverrides: {
          claim_polynomial_deriv: { passed: false, status: 'incorrect', reason: 'Derivative mismatch' }
        }
      });
      const service = new MathVerificationService([mockVerifier]);
      const orchestrator = new LessonOrchestrator({ verifier: service });

      const context = await orchestrator.orchestrate({
        requestId: 'req_fail_gate_001',
        inputMode: 'topic_prompt',
        topic: 'Đạo hàm là gì?',
        audience: 'Học sinh phổ thông',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode: 'mock',
        narrationMode: 'none',
        aspectRatio: '9:16',
        sourceDocumentIds: []
      });

      assert.equal(context.stage, 'failed');
      assert.equal(context.error?.code, 'mathematical_verification_failed');
      assert.equal(context.storyboard, undefined, 'Storyboard must NOT be created when math claims fail verification');
      assert.equal(context.manifest, undefined, 'Manifest must NOT be created when math claims fail verification');
    });
  });
});

