import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveMathEnginePython,
  clearPythonResolverCache,
  probePythonExecutable
} from '../src/orchestration/python-resolver';
import {
  verifyAlgebraIdentityV3,
  verifyTransformationChainV3
} from '../src/orchestration/algebra-verifier-v3';

test('STEP 1: Shared Python Interpreter Resolver & SymPy Algebra Verification (Phase 11.2)', async (t) => {
  const originalPythonExecutable = process.env.PYTHON_EXECUTABLE;
  const originalLuminaPythonExecutable = process.env.LUMINA_PYTHON_EXECUTABLE;

  t.afterEach(() => {
    // Restore environment
    if (originalPythonExecutable !== undefined) {
      process.env.PYTHON_EXECUTABLE = originalPythonExecutable;
    } else {
      delete process.env.PYTHON_EXECUTABLE;
    }
    if (originalLuminaPythonExecutable !== undefined) {
      process.env.LUMINA_PYTHON_EXECUTABLE = originalLuminaPythonExecutable;
    } else {
      delete process.env.LUMINA_PYTHON_EXECUTABLE;
    }
    clearPythonResolverCache();
  });

  await t.test('1. Resolves a valid Python interpreter that can import luminalearn_math_engine', async () => {
    clearPythonResolverCache();
    const python = await resolveMathEnginePython();
    assert.ok(python && python.length > 0, 'Must return non-empty interpreter path');

    // Probe directly to verify it imports luminalearn_math_engine
    const probeResult = await probePythonExecutable(python);
    assert.match(probeResult.stdout, /luminalearn_math_engine/);
  });

  await t.test('2. Caches resolved interpreter in memory, but bypassCache re-evaluates', async () => {
    clearPythonResolverCache();
    const first = await resolveMathEnginePython();
    const second = await resolveMathEnginePython();
    assert.strictEqual(first, second, 'Subsequent calls must return cached interpreter');

    // Clear cache and bypass
    clearPythonResolverCache();
    const bypassed = await resolveMathEnginePython({ bypassCache: true });
    assert.ok(bypassed);
  });

  await t.test('3. Respects explicit PYTHON_EXECUTABLE canonical environment variable', async () => {
    clearPythonResolverCache();
    // Resolve current valid python first
    const validPython = await resolveMathEnginePython();
    clearPythonResolverCache();

    process.env.PYTHON_EXECUTABLE = validPython;
    delete process.env.LUMINA_PYTHON_EXECUTABLE;

    const resolved = await resolveMathEnginePython({ bypassCache: true });
    assert.strictEqual(resolved, validPython);
  });

  await t.test('4. Respects legacy LUMINA_PYTHON_EXECUTABLE when PYTHON_EXECUTABLE is not set', async () => {
    clearPythonResolverCache();
    const validPython = await resolveMathEnginePython();
    clearPythonResolverCache();

    delete process.env.PYTHON_EXECUTABLE;
    process.env.LUMINA_PYTHON_EXECUTABLE = validPython;

    const resolved = await resolveMathEnginePython({ bypassCache: true });
    assert.strictEqual(resolved, validPython);
  });

  await t.test('5. Explicit invalid PYTHON_EXECUTABLE fails closed immediately without silent fallback', async () => {
    clearPythonResolverCache();
    process.env.PYTHON_EXECUTABLE = 'non_existent_python_binary_xyz_123';
    delete process.env.LUMINA_PYTHON_EXECUTABLE;

    await assert.rejects(
      async () => {
        await resolveMathEnginePython({ bypassCache: true });
      },
      (err: Error) => {
        assert.match(err.message, /math_engine_python_unavailable/);
        assert.match(err.message, /non_existent_python_binary_xyz_123/);
        return true;
      }
    );
  });

  await t.test('6. Algebra verification (verifyAlgebraIdentityV3) uses shared resolver and succeeds for valid identity', async () => {
    clearPythonResolverCache();
    const result = await verifyAlgebraIdentityV3('(a + b)^2', 'a^2 + 2*a*b + b^2');
    assert.strictEqual(result.status, 'verified');
    assert.strictEqual(result.left, '(a + b)^2');
    assert.strictEqual(result.right, 'a^2 + 2*a*b + b^2');
    assert.strictEqual(result.canonicalDifference, '0');
  });

  await t.test('7. Algebra verification rejects mathematically incorrect identities (never substitutes mock)', async () => {
    clearPythonResolverCache();
    const result = await verifyAlgebraIdentityV3('(a + b)^2', 'a^2 + b^2');
    assert.strictEqual(result.status, 'incorrect');
    assert.notStrictEqual(result.canonicalDifference, '0');
  });

  await t.test('8. Transformation-chain verification uses same interpreter and proves multi-step equivalence', async () => {
    clearPythonResolverCache();
    const chain = [
      'a^2 - b^2',
      'a^2 - a*b + a*b - b^2',
      'a*(a - b) + b*(a - b)',
      '(a + b)*(a - b)'
    ];
    const result = await verifyTransformationChainV3(chain);
    assert.strictEqual(result.valid, true);
  });

  await t.test('9. Transformation-chain verification rejects tampered step in chain', async () => {
    clearPythonResolverCache();
    const tamperedChain = [
      'a^2 - b^2',
      'a^2 + b^2', // Bogus intermediate step
      '(a + b)*(a - b)'
    ];
    const result = await verifyTransformationChainV3(tamperedChain);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.failedStepIndex, 0);
  });
});

