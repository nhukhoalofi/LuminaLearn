import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MOTION_RECIPE_REGISTRY_V1,
  VISUAL_CAPABILITY_REGISTRY_V1,
  VerifiedFormulaStepsDataV1Schema
} from '@luminalearn/scene-schema';
import { parseGraphFunction } from '@luminalearn/animation';
import { gradientDescentStoryboardV3 } from './fixtures/v3/gradient-descent-v3';
import { sprintBFormulaFixtureV3 } from './fixtures/v3/sprint-b-formula-v3';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidenceDirectory = path.join(root, 'artifacts', 'quality-sprint-b');
const expectedFrames = [
  'formula-frame-36.png', 'formula-frame-144.png', 'formula-frame-220.png',
  'derivative-frame-36.png', 'derivative-frame-120.png', 'derivative-frame-220.png',
  'gradient-frame-270.png', 'gradient-frame-360.png', 'gradient-frame-620.png'
];

const pngMetadata = async (fileName: string) => {
  const filePath = path.join(evidenceDirectory, fileName);
  const bytes = await readFile(filePath);
  const details = await stat(filePath);
  if (bytes.length < 24 || bytes.subarray(1, 4).toString('ascii') !== 'PNG') throw new Error(`invalid_png:${fileName}`);
  return {
    fileName,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    byteLength: details.size,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
};

const formula = VerifiedFormulaStepsDataV1Schema.parse(sprintBFormulaFixtureV3);
const formulaChecks = formula.steps.map((step) => ({
  stepId: step.stepId,
  hasProofReference: Boolean(step.proofReferenceId),
  hasClaimBinding: step.claimIds.length > 0,
  hasDisplayExpression: step.latex.trim().length > 0
}));

const derivativeFunction = parseGraphFunction('polynomial', 'x^2');
const tangentX = 1;
const secantToX = 2.25;
const derivativeChecks = {
  point: { x: tangentX, y: derivativeFunction.evaluate(tangentX), expectedY: 1 },
  tangent: { x: tangentX, slope: derivativeFunction.derivative(tangentX), expectedSlope: 2 },
  initialSecant: {
    fromX: tangentX,
    toX: secantToX,
    slope: (derivativeFunction.evaluate(secantToX) - derivativeFunction.evaluate(tangentX)) / (secantToX - tangentX),
    bothEndpointsOnCurve: true
  }
};

const landscapeScene = gradientDescentStoryboardV3.scenes.find((scene) => scene.visualPayload.sceneType === 'loss_landscape');
if (!landscapeScene || landscapeScene.visualPayload.sceneType !== 'loss_landscape') throw new Error('gradient_fixture_missing');
const landscape = landscapeScene.visualPayload;
const gradientChecks = landscape.steps.map((step, index, steps) => {
  const expectedLoss = landscape.curvature * (step.w - landscape.minimumPoint.w) ** 2 + landscape.minimumPoint.loss;
  const expectedGradient = 2 * landscape.curvature * (step.w - landscape.minimumPoint.w);
  const next = steps[index + 1];
  return {
    stepNumber: step.stepNumber,
    lossMatchesCurve: Math.abs(step.loss - expectedLoss) < 1e-10,
    gradientMatchesDerivative: Math.abs(step.gradient - expectedGradient) < 1e-10,
    updateMatchesLearningRate: next ? Math.abs(next.w - (step.w - landscape.learningRate * step.gradient)) < 1e-10 : null
  };
});

async function main(): Promise<void> {
  const renderFrames = await Promise.all(expectedFrames.map(pngMetadata));
  const report = {
  schemaVersion: 'quality-sprint-b-evidence-v1',
  generatedAt: new Date().toISOString(),
  renderProfile: { width: 720, height: 1280, fps: 24 },
  formulaChecks,
  derivativeChecks,
  gradientChecks,
  capabilityReadiness: Object.fromEntries(Object.entries(VISUAL_CAPABILITY_REGISTRY_V1).map(([id, capability]) => [id, capability.readinessStatus])),
  motionReadiness: Object.fromEntries(Object.entries(MOTION_RECIPE_REGISTRY_V1).map(([id, recipe]) => [id, recipe.readinessStatus])),
  renderFrames,
  automatedResult: {
    pass: formulaChecks.every((check) => check.hasProofReference && check.hasClaimBinding && check.hasDisplayExpression) &&
      derivativeChecks.point.y === derivativeChecks.point.expectedY &&
      derivativeChecks.tangent.slope === derivativeChecks.tangent.expectedSlope &&
      gradientChecks.every((check) => check.lossMatchesCurve && check.gradientMatchesDerivative && check.updateMatchesLearningRate !== false) &&
      renderFrames.every((frame) => frame.width === 720 && frame.height === 1280 && frame.byteLength > 0),
    humanVisualInspectionRequired: true
  }
  };

  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(path.join(evidenceDirectory, 'scientific-validation-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ output: path.join(evidenceDirectory, 'scientific-validation-report.json'), automatedPass: report.automatedResult.pass, frames: renderFrames.length })}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
