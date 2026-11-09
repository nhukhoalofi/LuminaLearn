import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ApprovedRenderArtifactV3Schema,
  EducationalLessonPlanV3Schema,
  LessonRequestV3Schema,
  type ApprovedRenderArtifactCoreV3,
  type ApprovedRenderArtifactV3,
  type DraftStatusV3Schema,
  type EducationalLessonPlanV3,
  type EducationalVisualPayload,
  type LessonRequestV3,
  type ExternalApiConsentRecordV3
} from '@luminalearn/scene-schema';
import type { z } from 'zod';
import { canonicalJsonStringify } from './draft-manager';
import { EducationalPlannerV3 } from './educational-planner-v3';
import { KnowledgeValidationServiceV3, validateLessonMathematicalIntegrityV3 } from './knowledge-validation-v3';

export type DraftStatusV3 = z.infer<typeof DraftStatusV3Schema>;

export interface LessonDraftV3 {
  draftId: string;
  ownerId: string;
  version: number;
  status: DraftStatusV3;
  request: LessonRequestV3;
  lessonPlan: EducationalLessonPlanV3;
  semanticReviewConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  approvedArtifact?: ApprovedRenderArtifactV3;
}

export interface UpdateLessonDraftV3 {
  title?: string;
  learningObjectives?: string[];
  claimStatements?: Record<string, string>;
  narrationTexts?: Record<string, string>;
  subtitleTexts?: Record<string, string>;
  visualPayloads?: Record<string, unknown>;
}

export class DraftVersionConflictV3Error extends Error {
  public readonly code = 'stale_draft_version';
  constructor(public readonly actualVersion: number) {
    super(`Draft version conflict; current version is ${actualVersion}`);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function computeArtifactContentHashV3(core: ApprovedRenderArtifactCoreV3): string {
  return createHash('sha256').update(canonicalJsonStringify(core), 'utf8').digest('hex');
}

export function verifyArtifactIntegrityV3(input: unknown): input is ApprovedRenderArtifactV3 {
  const parsed = ApprovedRenderArtifactV3Schema.safeParse(input);
  if (!parsed.success) return false;
  const { contentHash: _hash, ...core } = parsed.data;
  return computeArtifactContentHashV3(core) === parsed.data.contentHash;
}

export class LessonDraftManagerV3 {
  private readonly drafts = new Map<string, LessonDraftV3>();
  private readonly locks = new Map<string, Promise<void>>();

  constructor(
    private readonly options: {
      planner?: EducationalPlannerV3;
      validator?: KnowledgeValidationServiceV3;
      storageDir?: string;
    } = {}
  ) {}

  private async locked<T>(draftId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(draftId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    const chain = previous.then(() => current);
    this.locks.set(draftId, chain);
    await previous;
    try { return await action(); } finally {
      release();
      if (this.locks.get(draftId) === chain) this.locks.delete(draftId);
    }
  }

  private async persist(draft: LessonDraftV3): Promise<void> {
    if (!this.options.storageDir) return;
    await mkdir(this.options.storageDir, { recursive: true });
    const target = join(this.options.storageDir, `${draft.draftId}.json`);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${canonicalJsonStringify(draft)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
  }

  public async load(draftId: string): Promise<LessonDraftV3 | undefined> {
    const cached = this.drafts.get(draftId);
    if (cached) return clone(cached);
    if (!this.options.storageDir) return undefined;
    try {
      const parsed = JSON.parse(await readFile(join(this.options.storageDir, `${draftId}.json`), 'utf8')) as LessonDraftV3;
      EducationalLessonPlanV3Schema.parse(parsed.lessonPlan);
      LessonRequestV3Schema.parse(parsed.request);
      if (parsed.approvedArtifact && !verifyArtifactIntegrityV3(parsed.approvedArtifact)) {
        throw new Error('artifact_tampered: persisted V3 artifact failed integrity validation');
      }
      this.drafts.set(draftId, parsed);
      return clone(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  public async create(
    requestInput: unknown,
    ownerId: string,
    planner?: EducationalPlannerV3,
    options?: { consentRecord?: ExternalApiConsentRecordV3; confirmExternalApi?: boolean }
  ): Promise<LessonDraftV3> {
    const request = LessonRequestV3Schema.parse(requestInput);
    const draftId = `draft_v3_${randomUUID().replace(/-/g, '')}`;
    const selectedPlanner = planner ?? this.options.planner ?? new EducationalPlannerV3();
    const lessonPlan = await selectedPlanner.planLesson({
      lessonId: draftId,
      topic: request.topic,
      targetDurationSeconds: request.targetDurationSeconds,
      ownerId,
      consentRecord: options?.consentRecord,
      externalApiConsent: options?.confirmExternalApi === true
    });
    if (lessonPlan.domain !== request.domain) throw new Error('requested_domain_mismatch');
    if (request.generationMode === 'mock' && lessonPlan.generationProvenance !== 'deterministic_mock') {
      throw new Error('generation_provenance_mismatch');
    }
    if (request.generationMode === 'live' && lessonPlan.generationProvenance !== 'ai_generated_live') {
      throw new Error('generation_provenance_mismatch');
    }
    const now = new Date().toISOString();
    const draft: LessonDraftV3 = {
      draftId, ownerId, version: 1, status: 'needs_review', request,
      lessonPlan, semanticReviewConfirmed: false, createdAt: now, updatedAt: now
    };
    this.drafts.set(draftId, clone(draft));
    await this.persist(draft);
    return clone(draft);
  }

  public async update(draftId: string, ownerId: string, expectedVersion: number, patch: UpdateLessonDraftV3): Promise<LessonDraftV3> {
    return this.locked(draftId, async () => {
      const current = await this.load(draftId);
      if (!current) throw new Error('draft_not_found');
      if (current.ownerId !== ownerId) throw new Error('forbidden_owner_mismatch');
      if (current.version !== expectedVersion) throw new DraftVersionConflictV3Error(current.version);
      const plan = clone(current.lessonPlan);
      if (patch.title !== undefined) plan.title = patch.title;
      if (patch.learningObjectives !== undefined) plan.learningObjectives = patch.learningObjectives;
      plan.educationalClaims = plan.educationalClaims.map((claim) => patch.claimStatements?.[claim.id] === undefined ? claim : {
        ...claim, statement: patch.claimStatements[claim.id], verificationStatus: 'unverified', formalProofSummary: undefined
      });
      if (plan.storyboard) {
        plan.storyboard.scenes = plan.storyboard.scenes.map((scene) => ({
          ...scene,
          narration: {
            vietnamese: patch.narrationTexts?.[scene.sceneId] ?? scene.narration.vietnamese,
            subtitleVietnamese: patch.subtitleTexts?.[scene.sceneId] ?? scene.narration.subtitleVietnamese
          },
          visualPayload: (patch.visualPayloads?.[scene.sceneId] ?? scene.visualPayload) as EducationalVisualPayload
        }));
      }
      const integrity = await validateLessonMathematicalIntegrityV3({
        lessonPlan: plan,
        sourceEvidence: plan.sourceEvidence
      });
      if (!integrity.valid) {
        throw new Error(`mathematical_integrity_failed: ${integrity.reason}`);
      }
      plan.educationalClaims = integrity.validatedClaims;
      plan.validationReport = integrity.validationReport;
      const parsedPlan = EducationalLessonPlanV3Schema.parse(plan);
      const updated: LessonDraftV3 = {
        ...current,
        version: current.version + 1,
        status: 'needs_review',
        lessonPlan: parsedPlan,
        semanticReviewConfirmed: false,
        approvedArtifact: undefined,
        updatedAt: new Date().toISOString()
      };
      this.drafts.set(draftId, clone(updated));
      await this.persist(updated);
      return clone(updated);
    });
  }

  public async confirmSemanticReview(draftId: string, ownerId: string, expectedVersion: number): Promise<LessonDraftV3> {
    return this.locked(draftId, async () => {
      const current = await this.load(draftId);
      if (!current) throw new Error('draft_not_found');
      if (current.ownerId !== ownerId) throw new Error('forbidden_owner_mismatch');
      if (current.version !== expectedVersion) throw new DraftVersionConflictV3Error(current.version);
      if (current.lessonPlan.validationReport?.overallStatus === 'failed') throw new Error('knowledge_validation_failed');
      const integrity = await validateLessonMathematicalIntegrityV3({
        lessonPlan: current.lessonPlan,
        sourceEvidence: current.lessonPlan.sourceEvidence
      });
      if (!integrity.valid) throw new Error(`mathematical_integrity_failed: ${integrity.reason}`);
      const updated = { ...current, version: current.version + 1, status: 'ready_for_approval' as const, semanticReviewConfirmed: true, updatedAt: new Date().toISOString() };
      this.drafts.set(draftId, clone(updated));
      await this.persist(updated);
      return clone(updated);
    });
  }

  public async approve(draftId: string, ownerId: string, expectedVersion: number, note?: string): Promise<LessonDraftV3> {
    return this.locked(draftId, async () => {
      const current = await this.load(draftId);
      if (!current) throw new Error('draft_not_found');
      if (current.ownerId !== ownerId) throw new Error('forbidden_owner_mismatch');
      if (current.version !== expectedVersion) throw new DraftVersionConflictV3Error(current.version);
      if (!current.semanticReviewConfirmed || current.status !== 'ready_for_approval') throw new Error('semantic_review_required');
      if (current.lessonPlan.capabilityReport.renderReadiness !== 'render_ready') throw new Error('topic_not_render_ready');
      if (!current.lessonPlan.storyboard || !current.lessonPlan.validationReport) throw new Error('incomplete_v3_lesson');
      if (current.lessonPlan.validationReport.overallStatus === 'failed') throw new Error('knowledge_validation_failed');
      const integrity = await validateLessonMathematicalIntegrityV3({
        lessonPlan: current.lessonPlan,
        sourceEvidence: current.lessonPlan.sourceEvidence
      });
      if (!integrity.valid || integrity.validationReport.overallStatus === 'failed') {
        throw new Error(`mathematical_integrity_failed: ${integrity.reason || 'Formal verification failed'}`);
      }
      if (integrity.validatedClaims.some((claim) => claim.verificationStatus === 'rejected' || claim.verificationStatus === 'unverified')) {
        throw new Error('unresolved_claim_status');
      }
      const version = current.version + 1;
      const latestPlan: EducationalLessonPlanV3 = {
        ...clone(current.lessonPlan),
        educationalClaims: integrity.validatedClaims,
        validationReport: integrity.validationReport
      };
      const core: ApprovedRenderArtifactCoreV3 = {
        schemaVersion: 'approved-render-artifact-v3',
        artifactId: `artifact_v3_${randomUUID().replace(/-/g, '')}`,
        draftId,
        ownerId,
        approvedVersion: version,
        request: clone(current.request),
        lessonPlan: latestPlan,
        verificationReport: clone(integrity.validationReport),
        teacherApproval: { approvedBy: ownerId, approvedAt: new Date().toISOString(), note, semanticReviewConfirmed: true },
        createdAt: new Date().toISOString()
      };
      const artifact = ApprovedRenderArtifactV3Schema.parse({ ...core, contentHash: computeArtifactContentHashV3(core) });
      const updated: LessonDraftV3 = { ...current, version, status: 'approved', approvedArtifact: artifact, updatedAt: new Date().toISOString() };
      this.drafts.set(draftId, clone(updated));
      await this.persist(updated);
      return clone(updated);
    });
  }

  public async isArtifactAuthorized(artifact: ApprovedRenderArtifactV3): Promise<boolean> {
    if (!verifyArtifactIntegrityV3(artifact)) return false;
    const draft = await this.load(artifact.draftId);
    return Boolean(draft?.status === 'approved' && draft.ownerId === artifact.ownerId &&
      draft.version === artifact.approvedVersion && draft.approvedArtifact?.contentHash === artifact.contentHash);
  }
}

