import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compileStoryboardV2,
  type ApprovedRenderArtifactV2,
  type NarrationPlanV2,
  type StoryboardV2
} from '@luminalearn/scene-schema';
import {
  computeArtifactContentHash,
  verifyArtifactIntegrity
} from '@luminalearn/agent';
import { synthesizeNarrationV2, MockTtsProvider } from '../src/audio';
import { runHybridPipelineV2 } from '../src/pipeline-v2';

describe('Artifact-Driven Pipeline & Timeline Alignment (Phase 0)', () => {
  const root = mkdtempSync(join(tmpdir(), 'lumina-artifact-pipeline-'));

  const storyboard: StoryboardV2 = {
    storyboardId: 'sb_test_artifact',
    lessonId: 'lesson_test_artifact',
    topicId: 'calculus.derivative.intuition',
    scenes: [
      {
        sceneId: 'scene_1_intro',
        templateId: 'function_graph',
        sceneType: 'intro',
        durationFrames: 192, // 8s
        parameters: {
          title: 'Giới thiệu',
          body: 'Mở đầu bài học',
          coefficients: [0, 0, 1],
          pointX: 1
        },
        layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
        mathematicalBinding: { boundClaimIds: [], latexFormulas: [] },
        sourceReferenceIds: []
      },
      {
        sceneId: 'scene_2_anim',
        templateId: 'secant_to_tangent',
        sceneType: 'animation',
        durationFrames: 260, // ~10.83s
        parameters: {
          title: 'Cát tuyến và tiếp tuyến',
          body: 'Mô phỏng chuyển động',
          coefficients: [0, 0, 1],
          pointX: 1,
          hStart: 2.0,
          hEnd: 0.05
        },
        layout: { aspectRatio: '9:16', safeAreaPadding: 32 },
        mathematicalBinding: { boundClaimIds: ['claim_deriv'], latexFormulas: [] },
        sourceReferenceIds: []
      }
    ],
    visualTemplateIds: ['function_graph', 'secant_to_tangent'],
    mathematicalData: {},
    narrationObjectives: ['Mở đầu', 'Mô phỏng'],
    estimatedDurationFrames: 452,
    sourceReferences: []
  };

  const narrationPlan: NarrationPlanV2 = {
    planId: 'narr_test_artifact',
    storyboardId: 'sb_test_artifact',
    language: 'vi',
    segments: [
      {
        segmentId: 'seg_1',
        sceneId: 'scene_1_intro',
        text: 'Chào các bạn, đây là phần mở đầu video.',
        subtitleText: 'Chào các bạn, đây là phần mở đầu.',
        targetDurationSeconds: 4,
        pronunciationHints: []
      },
      {
        segmentId: 'seg_2',
        sceneId: 'scene_2_anim',
        text: 'Quan sát cát tuyến dần biến đổi thành tiếp tuyến khi h tiến về không.',
        subtitleText: 'Cát tuyến biến đổi thành tiếp tuyến khi h -> 0.',
        targetDurationSeconds: 8,
        pronunciationHints: []
      }
    ],
    totalWords: 24,
    estimatedDurationSeconds: 12,
    mathematicalReview: {
      status: 'verified',
      verifiedClaimIds: ['claim_deriv']
    }
  };

  function createSampleArtifact(): ApprovedRenderArtifactV2 {
    const renderConfig = {
      aspectRatio: '9:16' as const,
      fps: 24,
      renderMode: 'mock' as const,
      narrationMode: 'none' as const
    };

    const mathSpec = {
      topicId: 'calculus.derivative.intuition',
      visualization: 'secant_to_tangent' as const,
      function: {
        type: 'polynomial' as const,
        coefficients: [0, 0, 1]
      },
      parameters: {
        pointX: 1.0,
        hStart: 2.0,
        hEnd: 0.05,
        durationSeconds: 10.83,
        fps: 24
      },
      boundClaimIds: ['claim_deriv']
    };

    const hashPayload = {
      draftId: 'draft_art_01',
      version: 1,
      lessonPlan: {
        schemaVersion: 'lesson-v2',
        lessonId: 'lesson_test_artifact',
        topicId: 'calculus.derivative.intuition',
        title: 'Bản chất hình học của đạo hàm (Artifact Test)',
        learningObjectives: ['Hiểu bản chất tiếp tuyến'],
        prerequisites: ['Đại số cơ bản'],
        keyConcepts: ['Đạo hàm', 'Tiếp tuyến'],
        mathematicalClaims: [
          {
            id: 'claim_deriv',
            statement: 'Đạo hàm của x^2 là 2x',
            validatorKey: 'polynomial_derivative',
            expectedExpression: '2*x',
            verificationStatus: 'verified' as const
          }
        ],
        sourceEvidence: [],
        pedagogicalSequence: [
          {
            stepNumber: 1,
            pedagogicalGoal: 'Giới thiệu',
            intuitiveConcept: 'Mở đầu bài học',
            targetDurationSeconds: 8
          },
          {
            stepNumber: 2,
            pedagogicalGoal: 'Mô phỏng',
            intuitiveConcept: 'Mô phỏng chuyển động',
            targetDurationSeconds: 10.83
          }
        ],
        summary: 'Tổng kết bài học đạo hàm.'
      },
      storyboard,
      narrationPlan,
      verifiedClaims: [
        {
          id: 'claim_deriv',
          statement: 'Đạo hàm của x^2 là 2x',
          validatorKey: 'polynomial_derivative',
          expectedExpression: '2*x',
          verificationStatus: 'verified' as const
        }
      ],
      renderConfig,
      mathSpec
    };

    const contentHash = computeArtifactContentHash(hashPayload);

    return {
      schemaVersion: 'artifact-v2',
      artifactId: 'art_draft_art_01_v1',
      draftId: 'draft_art_01',
      version: 1,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approverNote: 'Approved for regression test',
      contentHash,
      lessonPlan: hashPayload.lessonPlan as any,
      storyboard,
      narrationPlan,
      verifiedClaims: hashPayload.verifiedClaims,
      sourceReferences: [],
      renderConfig,
      mathSpec,
      verificationProof: {
        status: 'verified',
        verifiedAt: new Date().toISOString(),
        checkedClaimIds: ['claim_deriv'],
        engine: 'SymPy Python Engine'
      }
    };
  }

  it('rejects tampered artifact before rendering with artifact_tampered error', async () => {
    const artifact = createSampleArtifact();
    // Tamper with math claim without updating hash
    artifact.verifiedClaims[0].expectedExpression = '9999*x';

    await assert.rejects(
      async () => runHybridPipelineV2(artifact, { jobId: 'job_test_tampered' }),
      /artifact_tampered/
    );
  });

  it('adjusts scene duration when narration exceeds duration in adjust_timeline mode', async () => {
    // Scene 1 duration is 192 frames (8 seconds)
    // Provider returning 10 seconds of audio exceeds scene duration
    const longAudioProvider = new MockTtsProvider(10);
    const testSb = JSON.parse(JSON.stringify(storyboard));

    const assets = await synthesizeNarrationV2({
      provider: longAudioProvider,
      narrationPlan,
      storyboard: testSb,
      jobId: 'job_test_adjust',
      jobDirectory: join(root, 'job_adjust'),
      stagedDirectory: join(root, 'staged_adjust'),
      fps: 24,
      alignmentPolicy: 'adjust_timeline'
    });

    assert.equal(assets.length, 2);
    // Scene 1 should have been expanded from 192 to Math.ceil((10 + 0.25) * 24) = 246
    assert.ok(testSb.scenes[0].durationFrames > 192);
    // Scene 2 startFrame in audio asset should match the new startFrame of scene 2
    assert.equal(assets[1].startFrame, testSb.scenes[0].durationFrames);
  });

  it('clamps subtitle cues strictly to audio segment duration (zero spillover)', () => {
    const manifest = compileStoryboardV2(storyboard, narrationPlan, {
      jobId: 'job_test_cues',
      lessonTitle: 'Tiêu đề kiểm thử phụ đề',
      topicId: 'calculus.derivative.intuition',
      fps: 24,
      audioAssets: [
        {
          id: 'audio_seg_1',
          path: 'generated/job_test_cues/seg_1.mp3',
          durationSeconds: 3.5, // 3.5s * 24 = 84 frames (while scene is 192 frames)
          codec: 'mp3',
          startFrame: 0
        }
      ]
    });

    assert.ok(manifest.subtitleTrack);
    const cue1 = manifest.subtitleTrack?.cues.find((c) => c.id === 'cue_scene_1_intro');
    assert.ok(cue1);
    // Cue must end at audio duration (84 frames), NOT the scene end (192 frames)!
    assert.equal(cue1?.startFrame, 0);
    assert.equal(cue1?.endFrame, 84);
  });

  // Cleanup
  it('cleans up temporary test files', () => {
    rmSync(root, { recursive: true, force: true });
  });
});

