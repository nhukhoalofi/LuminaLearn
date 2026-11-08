import { createHash, randomUUID } from 'node:crypto';
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
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
  type VerifiedClaim,
  type VisualStyleId
} from '@luminalearn/scene-schema';
import { EducationalFilmDirector } from './educational-film-director';
import { MathVerificationService, verifyNarrationAndStoryboardMathConsistency } from './math-verifier';
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
  /** External correlation identifier. It is never used as the internal draft identity or a file name. */
  requestId: string;
  ownerId?: string;
  version: number;
  status: LessonDraftStatus;
  createdAt: string;
  updatedAt: string;
  context: OrchestrationContext;
  approvalHistory: DraftApprovalHistoryEntry[];
  approvedArtifact?: ApprovedRenderArtifactV2;
}

export class DraftVersionConflictError extends Error {
  public readonly code = 'draft_version_conflict';

  constructor(
    public readonly draftId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(`Draft '${draftId}' version conflict: expected ${expectedVersion}, current version is ${actualVersion}`);
    this.name = 'DraftVersionConflictError';
  }
}

export interface DraftMutationOptions {
  expectedVersion?: number;
}

export interface DraftApprovalOptions extends DraftMutationOptions {
  confirmSemanticReview?: boolean;
}

export interface LessonDraftUpdateInput {
  title?: string;
  summary?: string;
  learningObjectives?: string[];
  mathematicalClaims?: VerifiedClaim[];
  narrationTexts?: Record<string, { text?: string; subtitleText?: string }>;
  mathSpec?: MathVisualizationSpecV2;
  renderMode?: 'mock' | 'live';
  narrationMode?: 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts';
  visualStyleId?: VisualStyleId;
  subtitlesEnabled?: boolean;
  humanSemanticReviewConfirmed?: boolean;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const defaultArtifactsDir = resolve(packageRoot, 'outputs/.artifacts');
const defaultDraftsDir = resolve(packageRoot, 'outputs/.drafts');
const DRAFT_ID_PATTERN = /^draft_[a-zA-Z0-9_-]{8,120}$/;

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
    const claimIds = artifact.verifiedClaims.map((claim) => claim.id);
    const validatorKeys = artifact.verifiedClaims.map((claim) => claim.validatorKey);
    if (new Set(claimIds).size !== claimIds.length || new Set(validatorKeys).size !== validatorKeys.length) {
      return false;
    }
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
  private readonly draftUpdateLocks = new Map<string, Promise<void>>();
  private readonly orchestrator: LessonOrchestrator;
  private readonly verifier: MathVerificationService;
  private readonly filmDirector = new EducationalFilmDirector();
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
            !DRAFT_ID_PATTERN.test(candidate.draftId) || name !== `${candidate.draftId}.json` ||
            !Number.isInteger(candidate.version) || candidate.version < 1 || !candidate.context ||
            !Array.isArray(candidate.approvalHistory)) continue;
        candidate.requestId = candidate.requestId ?? candidate.context.request?.requestId;
        if (typeof candidate.requestId !== 'string' || candidate.requestId.length === 0) continue;
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

  private draftPath(draftId: string): string {
    if (!DRAFT_ID_PATTERN.test(draftId)) throw new Error(`invalid_draft_id: '${draftId}'`);
    return join(this.draftsDir, `${draftId}.json`);
  }

  private persistDraft(draft: LessonDraft, createOnly = false): void {
    mkdirSync(this.draftsDir, { recursive: true });
    const target = this.draftPath(draft.draftId);
    const temporary = join(this.draftsDir, `.${draft.draftId}.${randomUUID()}.tmp`);
    writeFileSync(temporary, JSON.stringify(draft, null, 2), { encoding: 'utf8', flag: 'wx' });
    try {
      if (createOnly) {
        // Cross-process create-if-absent. A hard link cannot replace an existing draft.
        linkSync(temporary, target);
        unlinkSync(temporary);
      } else {
        renameSync(temporary, target);
      }
    } catch (error) {
      try { unlinkSync(temporary); } catch { /* best-effort cleanup */ }
      throw error;
    }
  }

  private createInternalDraftId(): string {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const draftId = `draft_${randomUUID().replace(/-/g, '')}`;
      if (!this.drafts.has(draftId) && !existsSync(this.draftPath(draftId))) return draftId;
    }
    throw new Error('draft_id_generation_failed: Unable to allocate a unique internal draft identifier');
  }

  public async createDraft(rawRequest: unknown, ownerId?: string): Promise<LessonDraft> {
    const context = await this.orchestrator.orchestrate(rawRequest);
    const requestId = context.request?.requestId;
    if (!requestId) throw new Error('draft_request_id_missing: Orchestration context has no external request identifier');
    const draftId = this.createInternalDraftId();
    const now = new Date().toISOString();

    const initialStatus: LessonDraftStatus =
      context.stage === 'ready_to_render' ? 'draft' :
      context.stage === 'needs_review' ? 'reviewing' :
      context.stage === 'failed' ? 'rejected' : 'draft';

    const draft: LessonDraft = {
      draftId,
      requestId,
      ownerId,
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

    this.persistDraft(draft, true);
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
    note?: string,
    options: DraftMutationOptions = {}
  ): Promise<LessonDraft> {
    return this.withDraftMutationLock(draftId, async () => {
      const before = this.requireDraft(draftId);
      this.assertExpectedVersion(before, options.expectedVersion);
      const snapshot = structuredClone(before);
      try {
        return await this.updateDraftUnlocked(draftId, updates, note);
      } catch (error) {
        this.restoreDraftSnapshot(draftId, snapshot);
        throw error;
      }
    });
  }

  private async withDraftMutationLock<T>(draftId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.draftUpdateLocks.get(draftId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolvePromise) => { release = resolvePromise; });
    const queued = previous.then(() => current);
    this.draftUpdateLocks.set(draftId, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.draftUpdateLocks.get(draftId) === queued) this.draftUpdateLocks.delete(draftId);
    }
  }

  private requireDraft(draftId: string): LessonDraft {
    if (!DRAFT_ID_PATTERN.test(draftId)) throw new Error(`invalid_draft_id: '${draftId}'`);
    const draft = this.drafts.get(draftId);
    if (!draft) throw new Error(`Lesson draft not found: ${draftId}`);
    return draft;
  }

  private assertExpectedVersion(draft: LessonDraft, expectedVersion?: number): void {
    if (expectedVersion !== undefined && draft.version !== expectedVersion) {
      throw new DraftVersionConflictError(draft.draftId, expectedVersion, draft.version);
    }
  }

  private restoreDraftSnapshot(draftId: string, snapshot: LessonDraft): void {
    const current = this.drafts.get(draftId);
    if (current) {
      for (const key of Object.keys(current) as Array<keyof LessonDraft>) {
        delete (current as unknown as Record<string, unknown>)[key];
      }
      Object.assign(current, snapshot);
      this.drafts.set(draftId, current);
      this.persistDraft(current);
      return;
    }
    this.drafts.set(draftId, snapshot);
    this.persistDraft(snapshot);
  }

  private async updateDraftUnlocked(
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

    // Reverify the complete claim set whenever either the claims, MathSpec, or semantic confirmation changes.
    // This happens before the candidate MathSpec is accepted, so stale verification
    // can never survive a specification-only edit.
    if (updates.mathematicalClaims || updates.mathSpec || updates.humanSemanticReviewConfirmed !== undefined) {
      if (!draft.context.topicInfo || !draft.context.lessonPlan) {
        throw new Error('Cannot update mathematical content on an incomplete draft');
      }
      const rawCandidateClaims = updates.mathematicalClaims ?? draft.context.lessonPlan.mathematicalClaims;
      const candidateClaims = rawCandidateClaims.map((claim) => ({
        ...claim,
        ...(updates.humanSemanticReviewConfirmed !== undefined
          ? { humanSemanticReviewConfirmed: updates.humanSemanticReviewConfirmed }
          : {})
      }));
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
        status: verifyReport.result.status,
        checkedClaims: verifyReport.claims,
        verificationDetails: verifyReport.result.checks
      };
      draft.context.lessonPlan.mathematicalClaims = verifyReport.claims;

      draft.approvalHistory.push({
        action: 'claims_reverified',
        timestamp: now,
        note: verifyReport.allVerified
          ? 'Complete claim set reverified against the exact candidate MathSpec'
          : `Mathematical verification status: ${verifyReport.result.status}`,
        details: { allVerified: verifyReport.allVerified, status: verifyReport.result.status }
      });

      if (!verifyReport.allVerified) {
        draft.status = 'reviewing';
        draft.context.stage = verifyReport.result.status === 'needs_review' ? 'needs_review' : 'failed';
        const hasConflict = verifyReport.claims.some((c) => c.statementVerification === 'conflict_detected');
        const needsProseReview = verifyReport.claims.some(
          (c) => c.statementVerification === 'prose_unverified' && !c.humanSemanticReviewConfirmed
        );
        draft.context.error = {
          code: hasConflict
            ? 'statement_expression_conflict'
            : needsProseReview
            ? 'statement_requires_semantic_review'
            : 'math_spec_verification_failed',
          message: hasConflict
            ? 'Displayed mathematical statement conflicts with the formally verified expression'
            : needsProseReview
            ? 'Free-text mathematical statement requires explicit human semantic review confirmation'
            : 'Mathematical claims are inconsistent with the candidate MathSpec'
        };
        this.persistDraft(draft);
        return draft;
      }
      draft.context.lessonPlan.mathSpec = candidateMathSpec;
      draft.context.error = undefined;
      if (!draft.context.storyboard || !draft.context.narrationPlan || !draft.context.manifest) {
        try {
          await this.orchestrator.resumeAfterSemanticReview(draft.context, {
            onBudgetChange: (summary) => {
              draft.context.requestBudget = summary;
              draft.updatedAt = new Date().toISOString();
              this.persistDraft(draft);
            }
          });
        } catch (error) {
          draft.status = 'reviewing';
          draft.context.stage = 'failed';
          draft.context.error = {
            code: 'semantic_review_resume_failed',
            message: error instanceof Error ? error.message : String(error)
          };
          this.persistDraft(draft);
          return draft;
        }
      } else {
        draft.context.stage = 'ready_to_render';
      }
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

    // 3. Update render configuration options (renderMode, narrationMode, visualStyleId, subtitlesEnabled)
    if (updates.renderMode) {
      draft.context.request.renderMode = updates.renderMode;
    }
    if (updates.narrationMode) {
      draft.context.request.narrationMode = updates.narrationMode;
    }
    if (updates.subtitlesEnabled !== undefined) {
      draft.context.request.subtitlesEnabled = updates.subtitlesEnabled;
    }
    if (updates.visualStyleId) {
      draft.context.request.visualStyleId = updates.visualStyleId;
      if (draft.context.storyboard) {
        for (const scene of draft.context.storyboard.scenes) {
          scene.visualStyleId = updates.visualStyleId;
          scene.parameters = { ...scene.parameters, visualStyleId: updates.visualStyleId };
        }
        if (draft.context.lessonPlan && draft.context.mathVerification?.status === 'verified') {
          draft.context.teachingTreatment = this.filmDirector.createTreatment({
            lessonPlan: draft.context.lessonPlan,
            storyboard: draft.context.storyboard,
            visualStyleId: updates.visualStyleId
          });
        }
      }
    }

    // 4. Verify mathematical consistency across narration, subtitles, and storyboard
    if (draft.context.lessonPlan && (draft.context.narrationPlan || draft.context.storyboard)) {
      const narrationCheck = verifyNarrationAndStoryboardMathConsistency({
        claims: draft.context.lessonPlan.mathematicalClaims,
        narrationPlan: draft.context.narrationPlan,
        storyboard: draft.context.storyboard
      });
      if (!narrationCheck.valid) {
        draft.status = 'reviewing';
        draft.context.stage = 'failed';
        draft.context.error = {
          code: 'narration_math_conflict',
          message: narrationCheck.conflicts.join('; ')
        };
      } else if (draft.context.error?.code === 'narration_math_conflict') {
        draft.context.error = undefined;
        if (draft.context.mathVerification?.status === 'verified') {
          draft.context.stage = draft.context.manifest ? 'ready_to_render' : 'verified';
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

  public async approveDraft(
    draftId: string,
    note?: string,
    options: DraftApprovalOptions = {}
  ): Promise<LessonDraft> {
    return this.withDraftMutationLock(draftId, async () => {
      const before = this.requireDraft(draftId);
      this.assertExpectedVersion(before, options.expectedVersion);
      if (before.status === 'approved' && before.approvedArtifact) return before;
      const snapshot = structuredClone(before);
      try {
        return await this.approveDraftUnlocked(draftId, note, options);
      } catch (error) {
        this.restoreDraftSnapshot(draftId, snapshot);
        throw error;
      }
    });
  }

  /** Atomically applies render configuration and approves one exact browser-visible version. */
  public async approveDraftWithUpdates(
    draftId: string,
    updates: LessonDraftUpdateInput,
    note?: string,
    options: DraftApprovalOptions = {}
  ): Promise<LessonDraft> {
    return this.withDraftMutationLock(draftId, async () => {
      const before = this.requireDraft(draftId);
      this.assertExpectedVersion(before, options.expectedVersion);
      if (before.status === 'approved' && before.approvedArtifact) return before;
      const snapshot = structuredClone(before);
      try {
        const hasUpdates = Object.values(updates).some((value) => value !== undefined);
        if (hasUpdates) await this.updateDraftUnlocked(draftId, updates, 'Approval configuration applied atomically');
        return await this.approveDraftUnlocked(draftId, note, options);
      } catch (error) {
        this.restoreDraftSnapshot(draftId, snapshot);
        throw error;
      }
    });
  }

  private async approveDraftUnlocked(
    draftId: string,
    note?: string,
    options: DraftApprovalOptions = {}
  ): Promise<LessonDraft> {
    const draft = this.requireDraft(draftId);

    if (draft.status === 'rejected') {
      throw new Error(`Cannot approve rejected draft: ${draftId}`);
    }

    if (options?.confirmSemanticReview && draft.context.lessonPlan) {
      for (const claim of draft.context.lessonPlan.mathematicalClaims) {
        if (claim.statementVerification === 'prose_unverified') {
          claim.humanSemanticReviewConfirmed = true;
        }
      }
      const reverify = await this.verifier.verifyClaims(
        draft.context.lessonPlan.topicId,
        draft.context.lessonPlan.mathematicalClaims,
        { mathSpec: draft.context.lessonPlan.mathSpec }
      );
      draft.context.lessonPlan.mathematicalClaims = reverify.claims;
      draft.context.mathVerification = {
        status: reverify.result.status,
        checkedClaims: reverify.claims,
        verificationDetails: reverify.result.checks
      };
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

    const narrationConsistency = verifyNarrationAndStoryboardMathConsistency({
      claims: draft.context.lessonPlan.mathematicalClaims,
      narrationPlan: draft.context.narrationPlan,
      storyboard: draft.context.storyboard
    });
    if (!narrationConsistency.valid) {
      throw new Error(`Cannot approve draft: ${narrationConsistency.conflicts.join('; ')}`);
    }

    const activeVisualStyleId = draft.context.request.visualStyleId ?? 'clean_educational_infographic';
    const activeSubtitlesEnabled = draft.context.request.subtitlesEnabled ?? true;
    for (const scene of draft.context.storyboard.scenes) {
      scene.visualStyleId = activeVisualStyleId;
      scene.parameters = { ...scene.parameters, visualStyleId: activeVisualStyleId };
    }
    const authoritativeSourceReferences = draft.context.lessonPlan.sourceEvidence.map((ev) => ev.sourceReference);

    // Recompile manifest to ensure total consistency with any edited narration/title/style/subtitles
    const manifest = compileStoryboardV2(
      draft.context.storyboard,
      draft.context.narrationPlan,
      {
        jobId: `job_${draft.context.request.requestId}`,
        lessonTitle: draft.context.lessonPlan.title,
        topicId: draft.context.lessonPlan.topicId,
        fps: 24,
        aspectRatio: draft.context.request.aspectRatio,
        visualStyleId: activeVisualStyleId,
        subtitlesEnabled: activeSubtitlesEnabled,
        verifiedClaims: draft.context.lessonPlan.mathematicalClaims,
        sourceReferences: authoritativeSourceReferences
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
      visualStyleId: activeVisualStyleId,
      subtitlesEnabled: activeSubtitlesEnabled,
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

  public async rejectDraft(
    draftId: string,
    reason: string,
    options: DraftMutationOptions = {}
  ): Promise<LessonDraft> {
    return this.withDraftMutationLock(draftId, async () => {
      const draft = this.requireDraft(draftId);
      this.assertExpectedVersion(draft, options.expectedVersion);

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
    });
  }
}
