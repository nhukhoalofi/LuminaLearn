import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
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
const defaultDraftsDir = resolve(packageRoot, 'outputs/.drafts');

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
  sourceReferences: unknown;
  verificationProof: unknown;
}): string {
  const canonical = canonicalJsonStringify(payload);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function computeVerificationBindingHash(payload: {
  topicId: string;
  mathSpec: unknown;
  verifiedClaims: unknown;
}): string {
  return createHash('sha256')
    .update(canonicalJsonStringify(payload), 'utf8')
    .digest('hex');
}

function claimIdsMatchSpec(mathSpec: MathVisualizationSpecV2, claims: VerifiedClaim[]): boolean {
  const expected = [...new Set(claims.map((claim) => claim.id))].sort();
  const bound = [...new Set(mathSpec.boundClaimIds)].sort();
  return canonicalJsonStringify(expected) === canonicalJsonStringify(bound);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
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
      mathSpec: artifact.mathSpec,
      sourceReferences: artifact.sourceReferences,
      verificationProof: artifact.verificationProof
    });
    const bindingHash = computeVerificationBindingHash({
      topicId: artifact.lessonPlan.topicId,
      mathSpec: artifact.mathSpec,
      verifiedClaims: artifact.verifiedClaims
    });
    const claimsConsistent = canonicalJsonStringify(artifact.lessonPlan.mathematicalClaims) ===
      canonicalJsonStringify(artifact.verifiedClaims);
    const checkedClaimIds = [...artifact.verificationProof.checkedClaimIds].sort();
    const verifiedClaimIds = artifact.verifiedClaims.map((claim) => claim.id).sort();
    return expectedHash === artifact.contentHash &&
      bindingHash === artifact.verificationProof.verificationBindingHash &&
      claimsConsistent &&
      canonicalJsonStringify(checkedClaimIds) === canonicalJsonStringify(verifiedClaimIds) &&
      artifact.mathSpec.topicId === artifact.lessonPlan.topicId &&
      claimIdsMatchSpec(artifact.mathSpec, artifact.verifiedClaims);
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
  private readonly draftsDir: string;

  constructor(options: {
    orchestrator?: LessonOrchestrator;
    verifier?: MathVerificationService;
    artifactsDir?: string;
    draftsDir?: string;
  } = {}) {
    this.verifier = options.verifier ?? new MathVerificationService();
    this.orchestrator = options.orchestrator ?? new LessonOrchestrator({ verifier: this.verifier });
    this.artifactsDir = options.artifactsDir ?? defaultArtifactsDir;
    this.draftsDir = options.draftsDir ?? (options.artifactsDir ? join(options.artifactsDir, '.drafts') : defaultDraftsDir);
    this.restoreDrafts();
  }

  public getArtifactsDir(): string {
    return this.artifactsDir;
  }

  public getDraftsDir(): string {
    return this.draftsDir;
  }

  private restoreDrafts(): void {
    mkdirSync(this.draftsDir, { recursive: true });
    for (const name of readdirSync(this.draftsDir)) {
      if (!/^draft_[a-zA-Z0-9_-]+\.json$/.test(name)) continue;
      try {
        const candidate = JSON.parse(readFileSync(join(this.draftsDir, name), 'utf8')) as LessonDraft;
        if (!candidate || typeof candidate !== 'object' || typeof candidate.draftId !== 'string' ||
            !Number.isInteger(candidate.version) || candidate.version < 1 || !candidate.context ||
            !Array.isArray(candidate.approvalHistory)) continue;
        if (candidate.approvedArtifact) {
          const artifact = ApprovedRenderArtifactV2Schema.parse(candidate.approvedArtifact);
          if (!verifyArtifactIntegrity(artifact) || artifact.draftId !== candidate.draftId ||
              artifact.version !== candidate.version || candidate.status !== 'approved') continue;
          candidate.approvedArtifact = deepFreeze(artifact);
        } else if (candidate.status === 'approved') continue;
        this.drafts.set(candidate.draftId, candidate);
      } catch {
        // A corrupt record is isolated; other drafts remain available.
      }
    }
  }

  private persistDraft(draft: LessonDraft): void {
    mkdirSync(this.draftsDir, { recursive: true });
    const safeId = draft.draftId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const target = join(this.draftsDir, `${safeId}.json`);
    const temporary = join(this.draftsDir, `.${safeId}.${randomUUID()}.tmp`);
    writeFileSync(temporary, JSON.stringify(draft, null, 2), { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, target);
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
    this.persistDraft(draft);
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

  public isArtifactCurrentlyApproved(artifact: ApprovedRenderArtifactV2): boolean {
    const draft = this.drafts.get(artifact.draftId);
    return draft?.status === 'approved' &&
      draft.version === artifact.version &&
      draft.approvedArtifact?.artifactId === artifact.artifactId &&
      draft.approvedArtifact.contentHash === artifact.contentHash &&
      verifyArtifactIntegrity(artifact);
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

    // Reverify the complete claim set whenever either the claims or MathSpec changes.
    // This happens before the candidate MathSpec is accepted, so stale verification
    // can never survive a specification-only edit.
    if (updates.mathematicalClaims || updates.mathSpec) {
      if (!draft.context.topicInfo || !draft.context.lessonPlan) {
        throw new Error('Cannot update mathematical content on an incomplete draft');
      }
      const candidateClaims = updates.mathematicalClaims ?? draft.context.lessonPlan.mathematicalClaims;
      const existingMathSpec = draft.context.lessonPlan.mathSpec;
      const candidateMathSpec = updates.mathSpec ?? (existingMathSpec
        ? { ...existingMathSpec, boundClaimIds: candidateClaims.map((claim) => claim.id) }
        : undefined);
      if (!candidateMathSpec) {
        throw new Error('math_spec_missing: Mathematical updates require an explicit MathSpec');
      }
      if (candidateMathSpec.topicId !== draft.context.topicInfo.topicId) {
        throw new Error(`math_spec_topic_mismatch: expected '${draft.context.topicInfo.topicId}', got '${candidateMathSpec.topicId}'`);
      }
      if (!claimIdsMatchSpec(candidateMathSpec, candidateClaims)) {
        throw new Error('math_spec_claim_binding_mismatch: MathSpec must bind the complete mathematical claim set');
      }

      const verifyReport = await this.verifier.verifyClaims(
        draft.context.topicInfo.topicId,
        candidateClaims,
        { mathSpec: candidateMathSpec }
      );
      draft.context.mathVerification = {
        status: verifyReport.allVerified ? 'verified' : 'failed',
        checkedClaims: verifyReport.claims,
        verificationDetails: verifyReport.result.checks
      };
      draft.context.lessonPlan.mathematicalClaims = verifyReport.claims;

      draft.approvalHistory.push({
        action: 'claims_reverified',
        timestamp: now,
        note: verifyReport.allVerified
          ? 'Complete claim set reverified against the exact candidate MathSpec'
          : 'Mathematical verification FAILED against the exact candidate MathSpec',
        details: { allVerified: verifyReport.allVerified }
      });

      if (!verifyReport.allVerified) {
        draft.status = 'reviewing';
        draft.context.stage = 'failed';
        draft.context.error = {
          code: 'math_spec_verification_failed',
          message: 'Mathematical claims are inconsistent with the candidate MathSpec'
        };
        this.persistDraft(draft);
        return draft;
      }
      draft.context.lessonPlan.mathSpec = candidateMathSpec;
      draft.context.stage = draft.context.manifest ? 'ready_to_render' : 'verified';
      draft.context.error = undefined;
    }

    // 1. Update title / summary / objectives if provided
    if (draft.context.lessonPlan) {
      if (updates.title) draft.context.lessonPlan.title = updates.title;
      if (updates.summary) draft.context.lessonPlan.summary = updates.summary;
      if (updates.learningObjectives) draft.context.lessonPlan.learningObjectives = updates.learningObjectives;
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

    draft.approvalHistory.push({
      action: 'updated',
      timestamp: now,
      note: note ?? 'Draft updated with user revisions'
    });

    this.persistDraft(draft);
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

    if (mathSpec.topicId !== draft.context.lessonPlan.topicId ||
        !claimIdsMatchSpec(mathSpec, draft.context.lessonPlan.mathematicalClaims)) {
      throw new Error('Cannot approve draft: MathSpec does not match the topic and complete claim set');
    }
    const approvalVerification = await this.verifier.verifyClaims(
      draft.context.lessonPlan.topicId,
      draft.context.lessonPlan.mathematicalClaims,
      { mathSpec }
    );
    if (!approvalVerification.allVerified) {
      throw new Error('Cannot approve draft: exact MathSpec and complete claim set failed re-verification');
    }
    draft.context.lessonPlan.mathematicalClaims = approvalVerification.claims;
    draft.context.mathVerification = {
      status: 'verified',
      checkedClaims: approvalVerification.claims,
      verificationDetails: approvalVerification.result.checks
    };

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
    const verificationBindingHash = computeVerificationBindingHash({
      topicId: draft.context.lessonPlan.topicId,
      mathSpec,
      verifiedClaims: draft.context.lessonPlan.mathematicalClaims
    });
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
        verificationBindingHash,
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
      mathSpec: preArtifact.mathSpec,
      sourceReferences: preArtifact.sourceReferences,
      verificationProof: preArtifact.verificationProof
    };

    const contentHash = computeArtifactContentHash(hashPayload);
    const artifact: ApprovedRenderArtifactV2 = deepFreeze({
      ...preArtifact,
      contentHash
    });

    if (!verifyArtifactIntegrity(artifact)) {
      throw new Error('artifact_integrity_failed: Refusing to persist an inconsistent approved artifact');
    }

    // ATOMIC PERSISTENCE TO DISK
    await mkdir(this.artifactsDir, { recursive: true });
    const artifactPath = join(this.artifactsDir, `${artifactId}.json`);
    const temporaryPath = join(this.artifactsDir, `.${artifactId}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, JSON.stringify(artifact, null, 2), { encoding: 'utf8', flag: 'wx' });
      await rename(temporaryPath, artifactPath);
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }

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

    this.persistDraft(draft);
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

    this.persistDraft(draft);
    return draft;
  }
}
