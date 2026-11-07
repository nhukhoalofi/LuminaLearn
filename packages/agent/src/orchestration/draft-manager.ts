import {
  compileStoryboardV2,
  type LessonPlanV2,
  type LessonRequestV2,
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
  action: 'created' | 'updated' | 'claims_reverified' | 'approved' | 'rejected';
  timestamp: string;
  note?: string;
  details?: Record<string, unknown>;
}

export interface LessonDraft {
  draftId: string;
  status: LessonDraftStatus;
  createdAt: string;
  updatedAt: string;
  context: OrchestrationContext;
  approvalHistory: DraftApprovalHistoryEntry[];
}

export interface LessonDraftUpdateInput {
  title?: string;
  summary?: string;
  learningObjectives?: string[];
  mathematicalClaims?: VerifiedClaim[];
  narrationTexts?: Record<string, { text?: string; subtitleText?: string }>;
}

export class LessonDraftManager {
  private readonly drafts: Map<string, LessonDraft> = new Map();
  private readonly orchestrator: LessonOrchestrator;
  private readonly verifier: MathVerificationService;

  constructor(options: {
    orchestrator?: LessonOrchestrator;
    verifier?: MathVerificationService;
  } = {}) {
    this.verifier = options.verifier ?? new MathVerificationService();
    this.orchestrator = options.orchestrator ?? new LessonOrchestrator({ verifier: this.verifier });
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

  public async updateDraft(
    draftId: string,
    updates: LessonDraftUpdateInput,
    note?: string
  ): Promise<LessonDraft> {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Lesson draft not found: ${draftId}`);
    }

    if (draft.status === 'ready_to_render') {
      // Revert status to reviewing if modifying an already compiled draft
      draft.status = 'reviewing';
    }

    const now = new Date().toISOString();
    draft.updatedAt = now;

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

    // 3. Mathematical Claims update (FAIL-CLOSED VERIFICATION GATE)
    if (updates.mathematicalClaims) {
      if (!draft.context.topicInfo) {
        throw new Error('Cannot update mathematical claims on a draft without topicInfo');
      }

      // Re-run formal verification through SymPy / verifier
      const verifyReport = await this.verifier.verifyClaims(
        draft.context.topicInfo.topicId,
        updates.mathematicalClaims
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

    // Recompile manifest to ensure total consistency
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

    draft.approvalHistory.push({
      action: 'approved',
      timestamp: now,
      note: note ?? 'Draft approved by reviewer; manifest compiled and ready to render'
    });

    return draft;
  }

  public rejectDraft(draftId: string, reason: string): LessonDraft {
    const draft = this.drafts.get(draftId);
    if (!draft) {
      throw new Error(`Lesson draft not found: ${draftId}`);
    }

    draft.status = 'rejected';
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

