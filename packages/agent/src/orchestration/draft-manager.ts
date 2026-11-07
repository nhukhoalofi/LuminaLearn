import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApprovedRenderArtifactV2Schema,
  compileStoryboardV2,
  MathVisualizationSpecV2Schema,
  type ApprovedRenderArtifactV2,
  type LessonPlanV2,
  type LessonRequestV2,
  type MathVisualizationSpecV2,
  type NarrationPlanV2,
  type RenderManifestV2,
  type StoryboardV2,
  type VerifiedClaim
} from '@luminalearn/scene-schema';
import { MathVerificationService } from './math-verifier';
import { LessonOrchestrator } from './orchestrator';
import type { OrchestrationContext } from './types';

export type LessonDraftStatus =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'ready_to_render'
  | 'rejected';

export interface DraftApprovalHistoryEntry {
  action: 'created' | 'updated' | 'claims_reverified' | 'approved' | 'rejected' | 'approval_invalidated';
  timestamp: string;
  note?: string;
  details?: Record<string, unknown>;
}

export interface LessonDraft {
  draftId: string;
  version: number;
  status: LessonDraftStatus;
  createdAt: string;
  updatedAt: string;
  context: OrchestrationContext;
  approvalHistory: DraftApprovalHistoryEntry[];
  approvedArtifact?: ApprovedRenderArtifactV2;
}

export interface LessonDraftUpdateInput {
  title?: string;
  summary?: string;
  learningObjectives?: string[];
  mathematicalClaims?: VerifiedClaim[];
  narrationTexts?: Record<string, { text?: string; subtitleText?: string }>;
  mathSpec?: MathVisualizationSpecV2;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const defaultArtifactsDir = resolve(packageRoot, 'outputs/.artifacts');

/**
 * Tuần tự hóa JSON chuẩn tắc (Canonical JSON Stringifier)
 * Sắp xếp các khóa từ điển theo thứ tự bảng chữ cái để tạo chuỗi băm xác định.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return (
    '{' +
    keys
      .map((key) => JSON.stringify(key) + ':' + canonicalJsonStringify(record[key]))
      .join(',') +
    '}'
  );
}

/**
 * Tính toán mã băm SHA-256 bảo đảm tính toàn vẹn của ApprovedRenderArtifactV2
 */
export function computeArtifactContentHash(payload: {
  draftId: string;
  version: number;
  lessonPlan: unknown;
  storyboard: unknown;
  narrationPlan: unknown;
  verifiedClaims: unknown;
  renderConfig: unknown;
  mathSpec: unknown;
}): string {
  const canonical = canonicalJsonStringify(payload);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Xác thực tính toàn vẹn của ApprovedRenderArtifactV2
 */
export function verifyArtifactIntegrity(artifact: ApprovedRenderArtifactV2): boolean {
  try {
    ApprovedRenderArtifactV2Schema.parse(artifact);
    const expectedHash = computeArtifactContentHash({
      draftId: artifact.draftId,
      version: artifact.version,
      lessonPlan: artifact.lessonPlan,
      storyboard: artifact.storyboard,
      narrationPlan: artifact.narrationPlan,
      verifiedClaims: artifact.verifiedClaims,
      renderConfig: artifact.renderConfig,
      mathSpec: artifact.mathSpec
    });
    return expectedHash === artifact.contentHash;
  } catch {
    return false;
  }
}

function buildDefaultMathSpec(
  topicId: string,
  claims: VerifiedClaim[]
): MathVisualizationSpecV2 {
  if (topicId === 'calculus.integral.riemann_sum') {
    return MathVisualizationSpecV2Schema.parse({
      topicId: 'calculus.integral.riemann_sum',
      visualization: 'riemann_sum',
      function: {
        type: 'polynomial',
        coefficients: [0, 0, 1]
      },
      parameters: {
        interval: [0, 1],
        partitions: [4, 8, 16],
        method: 'left',
        durationSeconds: 10.83,
        fps: 24
      },
      boundClaimIds: claims.map((c) => c.id)
    });
  }

  return MathVisualizationSpecV2Schema.parse({
    topicId: 'calculus.derivative.intuition',
    visualization: 'secant_to_tangent',
    function: {
      type: 'polynomial',
      coefficients: [0, 0, 1]
    },
    parameters: {
      pointX: 1.0,
      hStart: 2.0,
      hEnd: 0.05,
      durationSeconds: 10.83,
      fps: 24
    },
    boundClaimIds: claims.map((c) => c.id)
  });
}

export class LessonDraftManager {
  private readonly drafts: Map<string, LessonDraft> = new Map();
  private readonly orchestrator: LessonOrchestrator;
  private readonly verifier: MathVerificationService;
  private readonly artifactsDir: string;

  constructor(options: {
    orchestrator?: LessonOrchestrator;
    verifier?: MathVerificationService;
    artifactsDir?: string;
  } = {}) {
    this.verifier = options.verifier ?? new MathVerificationService();
    this.orchestrator = options.orchestrator ?? new LessonOrchestrator({ verifier: this.verifier });
    this.artifactsDir = options.artifactsDir ?? defaultArtifactsDir;
  }

  public getArtifactsDir(): string {
    return this.artifactsDir;
  }

  public async createDraft(rawRequest: unknown): Promise<LessonDraft> {
    const context = await this.orchestrator.orchestrate(rawRequest);
    const draftId = `draft_${context.request?.requestId ?? Date.now()}`;
    const now = new Date().toISOString();

    const initialStatus: LessonDraftStatus =
      context.stage === 'ready_to_render' ? 'draft' :
      context.stage === 'needs_review' ? 'reviewing' :
      context.stage === 'failed' ? 'rejected' : 'draft';

    const draft: LessonDraft = {
      draftId,
      version: 1,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
      context,
      approvalHistory: [
        {
          action: 'created',
          timestamp: now,
          note: `Draft created with initial orchestrator stage: ${context.stage}`
        }
      ]
    };

    this.drafts.set(draftId, draft);
    return draft;
  }

  public getDraft(draftId: string): LessonDraft | undefined {
    return this.drafts.get(draftId);
  }

  public listDrafts(): LessonDraft[] {
    return Array.from(this.drafts.values());
  }

  public getApprovedArtifact(draftId: string): ApprovedRenderArtifactV2 | undefined {
    return this.drafts.get(draftId)?.approvedArtifact;
  }

  public async loadArtifactFromDisk(artifactId: string): Promise<ApprovedRenderArtifactV2 | null> {
    try {
      const artifactPath = join(this.artifactsDir, `${artifactId}.json`);
      const raw = await readFile(artifactPath, 'utf8');
      const parsed = JSON.parse(raw) as ApprovedRenderArtifactV2;
      if (!verifyArtifactIntegrity(parsed)) {
        throw new Error(`artifact_tampered: Artifact ${artifactId} failed integrity check on load`);
      }
      return ApprovedRenderArtifactV2Schema.parse(parsed);
    } catch {
      return null;
    }
  }

  public async updateDraft(
    draftId: string,
    updates: LessonDraftUpdateInput,
    note?: string
  ): Promise<LessonDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Lesson draft not found: ${draftId}`);
    }

    const previousStatus = draft.status;
    const wasApproved = previousStatus === 'approved';

    // INCREMENT VERSION on any modification
    draft.version += 1;
    const now = new Date().toISOString();
    draft.updatedAt = now;

    // INVALIATION RULE: Any edit to an approved draft INVALIDATES approval
    if (wasApproved) {
      draft.status = 'reviewing';
      draft.approvedArtifact = undefined;
      draft.approvalHistory.push({
        action: 'approval_invalidated',
        timestamp: now,
        note: 'Bản nháp đã bị sửa đổi sau khi duyệt: vô hiệu hóa phê chuẩn trước đó, yêu cầu duyệt lại',
        details: { previousStatus }
      });
    } else if (draft.status === 'ready_to_render') {
      draft.status = 'reviewing';
    }

    // 1. Update title / summary / objectives if provided
    if (draft.context.lessonPlan) {
      if (updates.title) draft.context.lessonPlan.title = updates.title;
      if (updates.summary) draft.context.lessonPlan.summary = updates.summary;
      if (updates.learningObjectives) draft.context.lessonPlan.learningObjectives = updates.learningObjectives;
      if (updates.mathSpec) draft.context.lessonPlan.mathSpec = updates.mathSpec;
    }

    // 2. Update narration texts if provided
    if (updates.narrationTexts && draft.context.narrationPlan) {
      for (const segment of draft.context.narrationPlan.segments) {
        const custom = updates.narrationTexts[segment.segmentId] ?? updates.narrationTexts[segment.sceneId];
        if (custom) {
          if (custom.text) segment.text = custom.text;
          if (custom.subtitleText) segment.subtitleText = custom.subtitleText;
        }
      }
    }

    // 3. Mathematical Claims update (FAIL-CLOSED VERIFICATION GATE)
    if (updates.mathematicalClaims) {
      if (!draft.context.topicInfo) {
        throw new Error('Cannot update mathematical claims on a draft without topicInfo');
      }

      // Re-run formal verification through SymPy / verifier
      const verifyReport = await this.verifier.verifyClaims(
        draft.context.topicInfo.topicId,
        updates.mathematicalClaims,
        {
          mathSpec: updates.mathSpec ?? draft.context.lessonPlan?.mathSpec
        }
      );

      if (draft.context.lessonPlan) {
        draft.context.lessonPlan.mathematicalClaims = verifyReport.claims;
      }

      draft.context.mathVerification = {
        status: verifyReport.allVerified ? 'verified' : 'failed',
        checkedClaims: verifyReport.claims,
        verificationDetails: verifyReport.result.checks
      };

      if (!verifyReport.allVerified) {
        draft.status = 'reviewing';
        draft.context.stage = 'failed';
        draft.context.error = {
          code: 'claim_update_verification_failed',
          message: 'One or more updated mathematical claims failed formal SymPy verification'
        };
        draft.approvalHistory.push({
          action: 'claims_reverified',
          timestamp: now,
          note: 'Mathematical verification FAILED after user claim edits',
          details: { allVerified: false, claims: verifyReport.claims }
        });
        return draft;
      }

      draft.approvalHistory.push({
        action: 'claims_reverified',
        timestamp: now,
        note: 'All updated mathematical claims successfully reverified by formal SymPy engine',
        details: { allVerified: true }
      });
    }

    draft.approvalHistory.push({
      action: 'updated',
      timestamp: now,
      note: note ?? 'Draft updated with user revisions'
    });

    return draft;
  }

  public async approveDraft(draftId: string, note?: string): Promise<LessonDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Lesson draft not found: ${draftId}`);
    }

    if (draft.status === 'rejected') {
      throw new Error(`Cannot approve rejected draft: ${draftId}`);
    }

    // STRICT GATE: Verify formal mathematical validity
    if (!draft.context.mathVerification || draft.context.mathVerification.status !== 'verified') {
      throw new Error(
        `Cannot approve draft ${draftId}: Mathematical claims are not verified (status: ${draft.context.mathVerification?.status ?? 'missing'})`
      );
    }

    // Check that every claim is verified
    const unverifiedClaims = draft.context.lessonPlan?.mathematicalClaims.filter(
      (c) => c.verificationStatus !== 'verified'
    ) ?? [];

    if (unverifiedClaims.length > 0) {
      throw new Error(
        `Cannot approve draft ${draftId}: Found ${unverifiedClaims.length} unverified or failed mathematical claims`
      );
    }

    if (!draft.context.storyboard || !draft.context.narrationPlan || !draft.context.lessonPlan) {
      throw new Error(`Cannot approve draft ${draftId}: Incomplete storyboard or narration plan`);
    }

    // Determine authoritative MathVisualizationSpecV2
    const mathSpec =
      draft.context.lessonPlan.mathSpec ??
      buildDefaultMathSpec(
        draft.context.lessonPlan.topicId,
        draft.context.lessonPlan.mathematicalClaims
      );
    draft.context.lessonPlan.mathSpec = mathSpec;

    // Recompile manifest to ensure total consistency with any edited narration/title
    const manifest = compileStoryboardV2(
      draft.context.storyboard,
      draft.context.narrationPlan,
      {
        jobId: `job_${draft.context.request.requestId}`,
        lessonTitle: draft.context.lessonPlan.title,
        topicId: draft.context.lessonPlan.topicId,
        fps: 24,
        aspectRatio: draft.context.request.aspectRatio,
        verifiedClaims: draft.context.lessonPlan.mathematicalClaims
      }
    );

    draft.context.manifest = manifest;
    draft.context.stage = 'ready_to_render';
    draft.status = 'approved';
    const now = new Date().toISOString();
    draft.updatedAt = now;

    const renderConfig = {
      aspectRatio: draft.context.request.aspectRatio,
      fps: 24,
      renderMode: draft.context.request.renderMode,
      narrationMode: draft.context.request.narrationMode,
      providedAudioPath: draft.context.request.providedAudioPath
    };

    const artifactId = `art_${draft.draftId.replace(/[^a-zA-Z0-9_-]/g, '_')}_v${draft.version}`;

    // Validate with zod first to populate schema defaults consistently
    const preArtifact = ApprovedRenderArtifactV2Schema.parse({
      schemaVersion: 'artifact-v2',
      artifactId,
      draftId: draft.draftId,
      version: draft.version,
      createdAt: draft.createdAt,
      approvedAt: now,
      approverNote: note,
      contentHash: '0'.repeat(64),
      lessonPlan: draft.context.lessonPlan,
      storyboard: draft.context.storyboard,
      narrationPlan: draft.context.narrationPlan,
      verifiedClaims: draft.context.lessonPlan.mathematicalClaims,
      sourceReferences: draft.context.manifest.sourceReferences,
      renderConfig,
      mathSpec,
      verificationProof: {
        status: 'verified',
        verifiedAt: now,
        checkedClaimIds: draft.context.lessonPlan.mathematicalClaims.map((c) => c.id),
        engine: 'SymPy Python Engine'
      }
    });

    const hashPayload = {
      draftId: preArtifact.draftId,
      version: preArtifact.version,
      lessonPlan: preArtifact.lessonPlan,
      storyboard: preArtifact.storyboard,
      narrationPlan: preArtifact.narrationPlan,
      verifiedClaims: preArtifact.verifiedClaims,
      renderConfig: preArtifact.renderConfig,
      mathSpec: preArtifact.mathSpec
    };

    const contentHash = computeArtifactContentHash(hashPayload);
    const artifact: ApprovedRenderArtifactV2 = {
      ...preArtifact,
      contentHash
    };

    // ATOMIC PERSISTENCE TO DISK
    await mkdir(this.artifactsDir, { recursive: true });
    const artifactPath = join(this.artifactsDir, `${artifactId}.json`);
    await writeFile(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');

    draft.approvedArtifact = artifact;

    draft.approvalHistory.push({
      action: 'approved',
      timestamp: now,
      note: note ?? 'Draft approved by reviewer; immutable render artifact generated and persisted',
      details: {
        artifactId,
        contentHash,
        version: draft.version
      }
    });

    return draft;
  }

  public rejectDraft(draftId: string, reason: string): LessonDraft {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Lesson draft not found: ${draftId}`);
    }

    draft.status = 'rejected';
    draft.approvedArtifact = undefined;
    const now = new Date().toISOString();
    draft.updatedAt = now;

    draft.approvalHistory.push({
      action: 'rejected',
      timestamp: now,
      note: reason
    });

    return draft;
  }
}
