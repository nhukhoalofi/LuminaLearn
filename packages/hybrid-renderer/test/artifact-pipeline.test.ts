import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileStoryboardV2,
  RenderManifestV2Schema,
  type ApprovedRenderArtifactV2,
  type NarrationPlanV2,
  type StoryboardV2
} from '@luminalearn/scene-schema';
import {
  computeArtifactContentHash,
  computeVerificationBindingHash,
  DocumentIngestionService,
  DocumentStore,
  LessonDraftManager,
  LessonOrchestrator,
  MathVerificationService,
  verifyArtifactIntegrity
} from '@luminalearn/agent';
import { synthesizeNarrationV2, MockTtsProvider } from '../src/audio';
import { probeFinalVideo } from '../src/ffprobe';
import { runHybridPipelineV2 } from '../src/pipeline-v2';
import { createVisualQaReport } from '../src/visual-qa';

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
      mathSpec,
      sourceReferences: [],
      verificationProof: {
        status: 'verified' as const,
        verifiedAt: new Date().toISOString(),
        checkedClaimIds: ['claim_deriv'],
        verificationBindingHash: '',
        engine: 'SymPy Python Engine'
      }
    };

    hashPayload.verificationProof.verificationBindingHash = computeVerificationBindingHash({
      topicId: hashPayload.lessonPlan.topicId,
      mathSpec,
      verifiedClaims: hashPayload.verifiedClaims
    });

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
      sourceReferences: hashPayload.sourceReferences,
      renderConfig,
      mathSpec,
      verificationProof: hashPayload.verificationProof
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

  it('executes the V2.4.3 offline E2E user journey (Document -> Draft -> Invalid Edit -> SymPy Reject -> Fix -> Style/Subtitles -> Immutable Artifact -> Media/Audio QA)', async () => {
    const e2eRoot = join(root, 'e2e_journey');
    const docStore = new DocumentStore();
    const ingestion = new DocumentIngestionService({ storageDir: join(e2eRoot, 'docs') });
    const verifier = new MathVerificationService();
    const orchestrator = new LessonOrchestrator({ documentStore: docStore, verifier });
    const draftManager = new LessonDraftManager({
      artifactsDir: join(e2eRoot, 'artifacts'),
      draftsDir: join(e2eRoot, 'drafts'),
      orchestrator,
      verifier
    });

    // 1. Ingest Markdown source document
    const mdText = [
      '# Bài giảng Giải tích: Tổng Riemann và Tích phân xác định',
      'Xét hàm số f(x) = x^2 trên đoạn [0, 1].',
      'Khi chia đoạn [0, 1] thành n hình chữ nhật mỏng, giới hạn của tổng diện tích khi n tiến ra vô cực hội tụ về tích phân xác định của x^2 trên [0, 1] bằng 1/3.'
    ].join('\n\n');
    const ingested = await ingestion.ingestText(mdText, 'riemann-lesson.md');
    docStore.addChunks(ingested.chunks);

    // 2. Generate draft from source document (offline mock mode, 0 external API calls)
    const draft = await draftManager.createDraft({
      requestId: 'req_e2e_v243',
      inputMode: 'source_document',
      sourceDocumentIds: [ingested.documentId],
      topic: 'Tổng Riemann và tích phân của x^2',
      audience: 'Học sinh lớp 12',
      language: 'vi',
      targetDurationSeconds: 40,
      renderMode: 'mock',
      narrationMode: 'none',
      visualStyleId: 'clean_educational_infographic',
      subtitlesEnabled: true,
      aspectRatio: '9:16'
    }, 'teacher_demo_session');

    assert.equal(draft.status, 'draft');
    assert.equal(draft.context.mathVerification?.status, 'verified');
    assert.equal(draft.context.requestBudget?.counts.totalAllRequests, 0, 'Offline mode must make 0 external API calls');

    // 3. Teacher edits a mathematical claim to an invalid expression (1/2 instead of 1/3)
    const badClaims = structuredClone(draft.context.lessonPlan!.mathematicalClaims);
    badClaims[0].statement = 'Tích phân xác định của x^2 trên [0, 1] bằng 1/2';
    badClaims[0].expectedExpression = '1/2';
    await draftManager.updateDraft(draft.draftId, {
      mathematicalClaims: badClaims
    });

    // 4. SymPy rejects it and blocks approval
    assert.equal(draft.context.mathVerification?.status, 'failed');
    assert.equal(draft.status, 'reviewing');
    await assert.rejects(
      async () => draftManager.approveDraft(draft.draftId),
      /Cannot approve draft/
    );

    // 5. Teacher fixes the claim back to 1/3, selects math_chalkboard style and subtitlesEnabled=true
    const fixedClaims = structuredClone(draft.context.lessonPlan!.mathematicalClaims);
    fixedClaims[0].statement = 'Tích phân xác định của x^2 trên [0, 1] bằng 1/3';
    fixedClaims[0].expectedExpression = '1/3';
    await draftManager.updateDraft(draft.draftId, {
      mathematicalClaims: fixedClaims,
      visualStyleId: 'math_chalkboard',
      subtitlesEnabled: true
    });

    // 6. SymPy re-verifies
    assert.equal(draft.context.mathVerification?.status, 'verified');

    // 7 & 8. Teacher approves draft -> immutable artifact is saved to disk
    const approved = await draftManager.approveDraft(draft.draftId, 'Approved after fixing integral claim');
    assert.equal(approved.status, 'approved');
    assert.ok(approved.approvedArtifact);
    assert.equal(approved.approvedArtifact.renderConfig.visualStyleId, 'math_chalkboard');
    assert.equal(approved.approvedArtifact.renderConfig.subtitlesEnabled, true);
    assert.equal(verifyArtifactIntegrity(approved.approvedArtifact), true);

    const diskArtifact = await draftManager.loadArtifactFromDisk(approved.approvedArtifact.artifactId);
    assert.ok(diskArtifact);
    assert.equal(diskArtifact.contentHash, approved.approvedArtifact.contentHash);

    // 9. Verify real rendered MP4 & Visual/Audio QA report on outputs/job-20261107171652-3cc5c0df
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    const demoJobDir = resolve(repoRoot, 'outputs/job-20261107171652-3cc5c0df');
    const demoMp4 = resolve(demoJobDir, 'final.mp4');
    if (existsSync(demoMp4)) {
      const demoManifest = RenderManifestV2Schema.parse(
        JSON.parse(readFileSync(resolve(demoJobDir, 'video-manifest.json'), 'utf8'))
      );
      const metadata = await probeFinalVideo(demoMp4, {
        timeoutMs: 30_000,
        requireAudio: true,
        expectedFrames: demoManifest.totalFrames,
        expectedDurationSeconds: demoManifest.totalFrames / demoManifest.fps
      });
      const qaReport = await createVisualQaReport({
        videoPath: demoMp4,
        jobDirectory: demoJobDir,
        manifest: demoManifest,
        metadata,
        ttsSelected: true,
        ttsProviderId: 'mock_tts'
      });

      const presenceCheck = qaReport.checks.find((c) => c.id === 'audio_presence');
      const audibleCheck = qaReport.checks.find((c) => c.id === 'audible_speech');
      assert.equal(presenceCheck?.status, 'pass');
      assert.equal(audibleCheck?.status, 'requires_manual_review');
      assert.match(audibleCheck?.evidence ?? '', /silent_fixture/);
      assert.equal(qaReport.audioSignal?.isSilent, true);
      assert.equal(qaReport.audioSignal?.audioClassification, 'silent_fixture');
      assert.ok(existsSync(resolve(demoJobDir, 'subtitles.srt')));
    }
  });

  // Cleanup
  it('cleans up temporary test files', () => {
    rmSync(root, { recursive: true, force: true });
  });
});

