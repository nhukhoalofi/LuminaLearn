import 'server-only';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DocumentIngestionService,
  DocumentStore,
  LessonDraftManager,
  MathVerificationService,
  LessonOrchestrator
} from '@luminalearn/agent';
import type { LessonDraft } from '@luminalearn/agent';
import {
  createHybridJobId,
  runHybridPipelineV2,
  type JobState,
  LocalJobRepository
} from '@luminalearn/hybrid-renderer';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const documentsDir = resolve(repositoryRoot, 'outputs/.documents');

// Singletons attached to globalThis to persist across Next.js dev server reloads
const globalServices = globalThis as typeof globalThis & {
  __luminaDocStore?: DocumentStore;
  __luminaIngestionService?: DocumentIngestionService;
  __luminaDraftManager?: LessonDraftManager;
  __luminaMathVerifier?: MathVerificationService;
};

export const documentStore: DocumentStore =
  globalServices.__luminaDocStore ?? new DocumentStore();
globalServices.__luminaDocStore = documentStore;

export const ingestionService: DocumentIngestionService =
  globalServices.__luminaIngestionService ??
  new DocumentIngestionService({ storageDir: documentsDir });
globalServices.__luminaIngestionService = ingestionService;

export const mathVerifier: MathVerificationService =
  globalServices.__luminaMathVerifier ?? new MathVerificationService();
globalServices.__luminaMathVerifier = mathVerifier;

export const draftManager: LessonDraftManager =
  globalServices.__luminaDraftManager ??
  new LessonDraftManager({
    verifier: mathVerifier,
    orchestrator: new LessonOrchestrator({
      documentStore,
      verifier: mathVerifier
    })
  });
globalServices.__luminaDraftManager = draftManager;

export async function ensureDocumentsLoaded(documentIds: string[]): Promise<void> {
  for (const docId of documentIds) {
    if (/^doc_[a-zA-Z0-9_-]+$/.test(docId) && documentStore.getChunksByDocument(docId).length === 0) {
      await documentStore.loadFromDisk(documentsDir, docId);
    }
  }
}

export function toLessonDraftResponse(draft: LessonDraft) {
  return {
    draftId: draft.draftId,
    version: draft.version,
    status: draft.status,
    stage: draft.context.stage,
    error: draft.context.error,
    updatedAt: draft.updatedAt,
    lessonPlan: draft.context.lessonPlan,
    mathVerification: draft.context.mathVerification,
    narrationPlan: draft.context.narrationPlan,
    approvalHistory: draft.approvalHistory
  };
}

