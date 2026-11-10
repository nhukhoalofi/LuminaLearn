import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ApprovedRenderArtifactV3Schema,
  EducationalLessonPlanV3Schema,
  LessonRequestV3Schema,
  VisualSceneDefinitionV3Schema,
  type ApprovedRenderArtifactCoreV3,
  type ApprovedRenderArtifactV3,
  type DraftStatusV3Schema,
  type EducationalLessonPlanV3,
  type EducationalClaimV3,
  type EducationalVisualPayload,
  type LessonRequestV3,
  type ExternalApiConsentRecordV3
  ,type VisualSceneDefinitionV3
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
  claims?: EducationalClaimV3[];
  claimStatements?: Record<string, string>;
  narrationTexts?: Record<string, string>;
  subtitleTexts?: Record<string, string>;
  sceneTitles?: Record<string, string>;
  visualPayloads?: Record<string, unknown>;
  visualDefinitions?: Record<string, unknown>;
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

function normalizeBoundExpression(value: string): string {
  return value
    .replace(/\\cdot/g, '*')
    .replace(/\\times/g, '*')
    .replace(/\{([^{}]+)\}/g, '$1')
    .replace(/\s+/g, '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\*\*/g, '^')
    .replace(/(\d)\*([a-zA-Z])/g, '$1$2')
    .replace(/([a-zA-Z])\*([a-zA-Z])/g, '$1$2');
}

function issueTrustedVisualBindings(
  definition: VisualSceneDefinitionV3,
  claimsMap: Map<string, EducationalLessonPlanV3['educationalClaims'][number]>,
  approvedDraftVersion: number,
  verificationTimestamp: string
): VisualSceneDefinitionV3 {
  const isFormalProofScene = definition.sceneType === 'algebra_identity' || definition.sceneType === 'formula_derivation';
  const clientBindings = new Map(definition.mathBindings.map((binding) => [`${binding.elementId}:${binding.claimId}`, binding]));
  const trustedMathBindings = definition.elements.flatMap((element) => {
    if (element.elementType !== 'formula' && element.elementType !== 'graph') {
      return [];
    }

    const policy = (element as any).contentPolicy ?? 'formal_verified';
    if (policy !== 'formal_verified' && policy !== 'illustrative_unverified' && policy !== 'conceptual') {
      throw new Error(`unsupported_math_content_policy: ${policy}`);
    }

    // In formal proof scenes, mathematical formulas and graphs must be formally verified
    if (isFormalProofScene && (element.elementType === 'formula' || element.elementType === 'graph') && policy !== 'formal_verified') {
      throw new Error(`formal_proof_unverified_content_forbidden: Formal proof scene '${definition.sceneId}' cannot contain unverified ${element.elementType} '${element.elementId}'`);
    }

    if (policy === 'formal_verified') {
      if (!element.claimId) {
        if (isFormalProofScene) {
          throw new Error(`formal_proof_missing_claim_id: Formal proof scene '${definition.sceneId}' element '${element.elementId}' is classified formal_verified but lacks claimId`);
        }
        return [];
      }
      const claim = claimsMap.get(element.claimId);
      if (!claim) throw new Error(`visual_proof_claim_not_found: ${element.claimId}`);
      if (
        claim.claimType !== 'formal_mathematics' ||
        claim.verificationStatus !== 'formally_verified' ||
        claim.formalExpressionVerified !== true ||
        !claim.formalExpression
      ) {
        throw new Error(`visual_proof_claim_not_formally_verified: ${element.claimId}`);
      }
      const proposed = clientBindings.get(`${element.elementId}:${element.claimId}`);
      if (!proposed) throw new Error(`visual_proof_binding_missing: ${element.elementId}`);
      const verified = normalizeBoundExpression(claim.formalExpression);
      if (normalizeBoundExpression(proposed.formalExpression) !== verified) {
        throw new Error(`visual_proof_binding_expression_mismatch: ${element.elementId}`);
      }
      const renderedExpression = element.elementType === 'formula' ? element.latex : element.expression;
      if (!renderedExpression || normalizeBoundExpression(renderedExpression) !== verified) {
        throw new Error(`visual_proof_rendered_expression_mismatch: ${element.elementId}`);
      }
      return [{
        authority: 'server_sympy_v3' as const,
        claimId: claim.id,
        elementId: element.elementId,
        verifiedExpression: claim.formalExpression,
        normalizedExpressionFingerprint: createHash('sha256').update(verified, 'utf8').digest('hex'),
        verificationResult: 'formally_verified' as const,
        verificationTimestamp,
        approvedDraftVersion,
        sourceSceneId: definition.sceneId
      }];
    }

    // illustrative_unverified or conceptual
    if (element.claimId) {
      const claim = claimsMap.get(element.claimId);
      if (!claim) throw new Error(`visual_proof_claim_not_found: ${element.claimId}`);
    }
    return [];
  });
  return VisualSceneDefinitionV3Schema.parse({ ...definition, trustedMathBindings });
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

  public async saveSupervisorDraft(params: {
    ownerId: string;
    request: LessonRequestV3;
    lessonPlan: EducationalLessonPlanV3;
    draftId?: string;
  }): Promise<LessonDraftV3> {
    const { ownerId } = params;
    if (!ownerId || typeof ownerId !== 'string' || ownerId.trim().length === 0) {
      throw new Error('invalid_owner_id');
    }
    const request = LessonRequestV3Schema.parse(params.request);
    const lessonPlan = EducationalLessonPlanV3Schema.parse(params.lessonPlan);
    if (!lessonPlan.storyboard || !lessonPlan.storyboard.scenes || lessonPlan.storyboard.scenes.length === 0) {
      throw new Error('invalid_storyboard_scenes');
    }
    if (!lessonPlan.validationReport) {
      throw new Error('missing_mathematical_verification');
    }
    if (lessonPlan.domain !== request.domain) {
      throw new Error('requested_domain_mismatch');
    }
    const draftId = params.draftId ?? `draft_v3_${randomUUID().replace(/-/g, '')}`;
    return this.locked(draftId, async () => {
      const now = new Date().toISOString();
      const draft: LessonDraftV3 = {
        draftId,
        ownerId,
        version: 1,
        status: 'needs_review',
        request,
        lessonPlan,
        semanticReviewConfirmed: false,
        createdAt: now,
        updatedAt: now
      };
      this.drafts.set(draftId, clone(draft));
      await this.persist(draft);
      return clone(draft);
    });
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
      if (patch.claims !== undefined) {
        plan.educationalClaims = patch.claims.map((claim) => ({
          ...claim,
          verificationStatus: 'unverified',
          formalProofSummary: undefined
        }));
      } else {
        plan.educationalClaims = plan.educationalClaims.map((claim) => patch.claimStatements?.[claim.id] === undefined ? claim : {
          ...claim, statement: patch.claimStatements[claim.id], verificationStatus: 'unverified', formalProofSummary: undefined
        });
      }
      if (plan.storyboard) {
        plan.storyboard.scenes = plan.storyboard.scenes.map((scene) => ({
          ...scene,
          title: patch.sceneTitles?.[scene.sceneId] ?? scene.title,
          narration: {
            vietnamese: patch.narrationTexts?.[scene.sceneId] ?? scene.narration.vietnamese,
            subtitleVietnamese: patch.subtitleTexts?.[scene.sceneId] ?? scene.narration.subtitleVietnamese
          },
          visualPayload: (patch.visualPayloads?.[scene.sceneId] ?? scene.visualPayload) as EducationalVisualPayload
          ,visualDefinition: patch.visualDefinitions?.[scene.sceneId] === undefined
            ? scene.visualDefinition
            : VisualSceneDefinitionV3Schema.parse(patch.visualDefinitions[scene.sceneId])
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

      // CHECKPOINT C: Verify math bindings and scene boundClaimIds against validated claims
      const claimsMap = new Map(integrity.validatedClaims.map((c) => [c.id, c]));
      const isMathDomain = current.lessonPlan.capabilityReport.domain === 'mathematics';
      for (const scene of current.lessonPlan.storyboard.scenes) {
        for (const claimId of scene.boundClaimIds) {
          const claim = claimsMap.get(claimId);
          if (!claim) {
            throw new Error(`unresolved_claim_binding: Scene references non-existent claimId '${claimId}'`);
          }
          if (claim.verificationStatus === 'rejected' || claim.verificationStatus === 'unverified') {
            throw new Error(`unverified_claim_binding: Scene bound claim '${claimId}' has invalid status '${claim.verificationStatus}'`);
          }
          if (isMathDomain && claim.claimType === 'formal_mathematics' && claim.verificationStatus !== 'formally_verified') {
            throw new Error(`unverified_claim_binding: Scene bound claim '${claimId}' is not formally verified by SymPy`);
          }
        }
      }

      const version = current.version + 1;
      const latestPlan: EducationalLessonPlanV3 = {
        ...clone(current.lessonPlan),
        educationalClaims: integrity.validatedClaims,
        validationReport: integrity.validationReport,
        storyboard: {
          ...clone(current.lessonPlan.storyboard),
          scenes: current.lessonPlan.storyboard.scenes.map((scene) => ({
            ...clone(scene),
            visualDefinition: scene.visualDefinition
              ? issueTrustedVisualBindings(scene.visualDefinition, claimsMap, version, integrity.validationReport.validationTimestamp)
              : undefined
          }))
        }
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

  public async listForOwner(ownerId: string): Promise<LessonDraftV3[]> {
    const list: LessonDraftV3[] = [];
    if (this.options.storageDir) {
      try {
        const files = await readdir(this.options.storageDir);
        for (const file of files) {
          if (!file.endsWith('.json') || file.includes('.tmp')) continue;
          const draftId = file.replace(/\.json$/, '');
          const loaded = await this.load(draftId);
          if (loaded && loaded.ownerId === ownerId) {
            list.push(loaded);
          }
        }
      } catch { /* storage directory may not exist yet */ }
    }
    for (const cached of this.drafts.values()) {
      if (cached.ownerId === ownerId && !list.some((d) => d.draftId === cached.draftId)) {
        list.push(clone(cached));
      }
    }
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

