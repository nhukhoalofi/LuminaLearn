import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PedagogicalBeatV1Schema,
  VerifiedScientificExampleV1Schema,
  VisualIntentMappingV1Schema
} from '../src';

describe('Quality Sprint A pedagogy contracts', () => {
  const beat = {
    schemaVersion: 'pedagogical-beat-v1',
    beatId: 'beat_01',
    sceneId: 'scene_01',
    learningObjective: 'Giải thích được ý nghĩa của đạo hàm tại một điểm.',
    pedagogicalIntent: 'demonstrate',
    educationalQuestion: 'Vì sao cát tuyến tiến tới tiếp tuyến?',
    conceptOrClaimIds: ['claim_derivative'],
    workedExampleReferences: ['example_derivative'],
    approvedNarrationText: 'Khi h tiến về không, hệ số góc cát tuyến tiến tới hệ số góc tiếp tuyến.',
    visualIntent: 'graph_and_tangent',
    recommendedVisualActions: ['draw_graph', 'draw_tangent'],
    expectedLearnerTakeaway: 'Đạo hàm là hệ số góc tiếp tuyến.',
    timingConstraints: { minimumFrames: 48, preferredFrames: 120, maximumFrames: 240, allowMeaningfulHold: false },
    contentValidationStatus: 'verified'
  };

  it('accepts a versioned component-independent pedagogical beat', () => {
    const parsed = PedagogicalBeatV1Schema.parse(beat);
    assert.equal(parsed.visualIntent, 'graph_and_tangent');
    assert.equal('componentName' in parsed, false);
  });

  it('rejects invalid timing and unauthorized reading holds', () => {
    assert.equal(PedagogicalBeatV1Schema.safeParse({ ...beat, timingConstraints: { minimumFrames: 200, preferredFrames: 100, maximumFrames: 50, allowMeaningfulHold: false } }).success, false);
    assert.equal(PedagogicalBeatV1Schema.safeParse({ ...beat, recommendedVisualActions: ['hold_for_reading'] }).success, false);
  });

  it('binds graph points to real verified example steps', () => {
    const example = {
      schemaVersion: 'scientific-example-v1',
      exampleId: 'example_gradient',
      title: 'Bước cập nhật tham số',
      conceptOrClaimIds: ['claim_gradient'],
      variables: { w: 2, learningRate: 0.3 },
      sourceExpression: 'L(w)=w^2',
      steps: [{
        stepId: 'step_1', displayExpression: "L'(2)=4", narrationText: 'Gradient tại hai bằng bốn.',
        subtitleText: 'Gradient tại w=2 bằng 4.', numericValues: { w: 2, gradient: 4 },
        boundClaimIds: ['claim_gradient'], verificationStatus: 'numerically_validated'
      }],
      graphPoints: [{ x: 2, y: 4, stepId: 'step_1' }],
      narrationReferences: ['scene_1'], subtitleReferences: ['scene_1'],
      verificationStatus: 'numerically_validated',
      verificationProofBinding: { verifier: 'deterministic_numeric', exactExpression: '2*w' }
    };
    assert.equal(VerifiedScientificExampleV1Schema.safeParse(example).success, true);
    assert.equal(VerifiedScientificExampleV1Schema.safeParse({ ...example, graphPoints: [{ x: 2, y: 4, stepId: 'missing' }] }).success, false);
  });

  it('requires an explicit limitation for planning-only mappings', () => {
    const mapping = { visualIntent: 'probability_tree', recommendedActions: ['show_probability_branch'], compatibleSceneTypes: ['formula_derivation'], readiness: 'planning_only' };
    assert.equal(VisualIntentMappingV1Schema.safeParse(mapping).success, false);
    assert.equal(VisualIntentMappingV1Schema.safeParse({ ...mapping, reviewReason: 'Adapter chưa được triển khai.' }).success, true);
  });
});
