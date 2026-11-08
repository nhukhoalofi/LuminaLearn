import type {
  DocumentChunk,
  GeminiRequestBudgetSummary,
  GroundingEvidence,
  GroundingSupportStatus,
  LessonPlanV2,
  LessonRequestV2,
  NarrationPlanV2,
  RenderManifestV2,
  StoryboardV2,
  TeachingTreatmentV2,
  VerifiedClaim
} from '@luminalearn/scene-schema';

export type OrchestrationStage =
  | 'normalized'
  | 'analyzed'
  | 'planned'
  | 'verified'
  | 'storyboarded'
  | 'narrated'
  | 'compiled'
  | 'ready_to_render'
  | 'failed'
  | 'needs_review';

export interface OrchestrationLogEntry {
  step: string;
  stage: OrchestrationStage;
  timestamp: string;
  durationMs: number;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
}

export interface TopicClassification {
  topicId: string;
  displayName: string;
  domain: 'calculus' | 'linear_algebra' | 'trigonometry' | 'statistics' | 'algebra' | 'general';
  confidence: number;
  supportedTemplates: string[];
  requiredValidators: string[];
  isSupported: boolean;
  unsupportedReason?: string;
  v3Only?: boolean;
}

export interface DocumentAnalysisResult {
  documentIds: string[];
  totalChunks: number;
  extractedConcepts: string[];
  candidateClaims: Array<{
    claimStatement: string;
    validatorKey: string;
    expectedExpression: string;
    quote: string;
    pageNumber: number;
    documentId: string;
    chunkId?: string;
    supportStatus?: GroundingSupportStatus;
  }>;
  evidence: GroundingEvidence[];
  unverifiedClaimsReason?: string;
}

export interface SourceContextBundle {
  trust: 'untrusted_document_content';
  documentIds: string[];
  excerpts: Array<{
    documentId: string;
    chunkId: string;
    pageNumber: number;
    text: string;
  }>;
  candidateClaims: DocumentAnalysisResult['candidateClaims'];
  exactMatchEvidence: GroundingEvidence[];
}

export interface ProviderCallTrace {
  purpose: 'curriculum_planning' | 'narration_planning';
  mode: 'ai_generated_live' | 'deterministic_mock';
  model: string;
  attempt?: number;
  promptTokens?: number;
  candidatesTokens?: number;
}

export interface MathVerificationReportV2 {
  status: 'verified' | 'failed' | 'needs_review';
  checkedClaims: VerifiedClaim[];
  verificationDetails: Record<string, {
    passed: boolean;
    status?: 'verified' | 'incorrect' | 'needs_review' | 'rejected';
    expected?: string;
    received?: string;
    reason?: string;
    computedExpression?: string;
    errorMessage?: string;
  }>;
}

export interface OrchestrationContext {
  request: LessonRequestV2;
  stage: OrchestrationStage;
  topicInfo?: TopicClassification;
  documentAnalysis?: DocumentAnalysisResult;
  sourceContext?: SourceContextBundle;
  providerCalls?: ProviderCallTrace[];
  requestBudget?: GeminiRequestBudgetSummary;
  lessonPlan?: LessonPlanV2;
  mathVerification?: MathVerificationReportV2;
  storyboard?: StoryboardV2;
  teachingTreatment?: TeachingTreatmentV2;
  narrationPlan?: NarrationPlanV2;
  manifest?: RenderManifestV2;
  logs: OrchestrationLogEntry[];
  retryCount: number;
  maxRetries: number;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

