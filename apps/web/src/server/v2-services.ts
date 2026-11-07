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

