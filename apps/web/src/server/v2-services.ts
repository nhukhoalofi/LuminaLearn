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
import { assertOwnerMatch } from './security';
import { DocumentOwnershipRepository } from './document-ownership';

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

export const documentOwnershipRepository = new DocumentOwnershipRepository(documentsDir);

export async function registerDocumentOwner(documentId: string, ownerId: string): Promise<void> {
  await documentOwnershipRepository.persist(documentId, ownerId);
}

export async function assertDocumentsOwnedBy(documentIds: string[], callerOwnerId: string): Promise<void> {
  for (const docId of documentIds) {
    const record = await documentOwnershipRepository.load(docId).catch(() => undefined);
    assertOwnerMatch(record?.ownerId, callerOwnerId, `document '${docId}'`);
  }
}

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

export async function ensureDocumentsLoaded(documentIds: string[], callerOwnerId: string): Promise<void> {
  for (const docId of documentIds) {
    if (!/^doc_[a-zA-Z0-9_-]+$/.test(docId)) throw new Error(`invalid_document_id: '${docId}'`);
    const record = await documentOwnershipRepository.load(docId).catch(() => undefined);
    assertOwnerMatch(record?.ownerId, callerOwnerId, `document '${docId}'`);
    if (documentStore.getChunksByDocument(docId).length === 0) await documentStore.loadFromDisk(documentsDir, docId);
  }
}

export function toLessonDraftResponse(draft: LessonDraft) {
  const renderConfig = draft.approvedArtifact?.renderConfig ?? {
    aspectRatio: draft.context.request.aspectRatio ?? '9:16',
    fps: 24,
    renderMode: draft.context.request.renderMode ?? 'mock',
    narrationMode: draft.context.request.narrationMode ?? 'none',
    visualStyleId: draft.context.request.visualStyleId ?? 'clean_educational_infographic',
    subtitlesEnabled: draft.context.request.subtitlesEnabled ?? true
  };
  return {
    draftId: draft.draftId,
    version: draft.version,
    status: draft.status,
    stage: draft.context.stage,
    error: draft.context.error,
    updatedAt: draft.updatedAt,
    renderConfig,
    requestBudget: draft.context.requestBudget,
    estimatedApiBudget: {
      livePlanningCallsMax: renderConfig.renderMode === 'live' ? 4 : 0,
      ttsCallsMax: renderConfig.narrationMode === 'gemini_tts' ? 5 : 0,
      externalApiRequired:
        renderConfig.renderMode === 'live' ||
        renderConfig.narrationMode === 'gemini_tts' ||
        renderConfig.narrationMode === 'google_cloud_tts'
    },
    lessonPlan: draft.context.lessonPlan,
    mathVerification: draft.context.mathVerification,
    narrationPlan: draft.context.narrationPlan,
    approvalHistory: draft.approvalHistory
  };
}

