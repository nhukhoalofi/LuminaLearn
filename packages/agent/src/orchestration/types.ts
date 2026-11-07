import type {
  LessonPlanV2,
  LessonRequestV2,
  NarrationPlanV2,
  RenderManifestV2,
  StoryboardV2,
  VerifiedClaim
} from '@luminalearn/scene-schema';
import type { DocumentChunk, GroundingEvidence } from '@luminalearn/scene-schema';

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
  domain: 'calculus' | 'linear_algebra' | 'trigonometry' | 'statistics' | 'general';
  confidence: number;
  supportedTemplates: string[];
  requiredValidators: string[];
  isSupported: boolean;
  unsupportedReason?: string;
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
  }>;
  evidence: GroundingEvidence[];
}

export interface MathVerificationReportV2 {
  status: 'verified' | 'failed' | 'needs_review';
  checkedClaims: VerifiedClaim[];
  verificationDetails: Record<string, {
    passed: boolean;
    computedExpression?: string;
    errorMessage?: string;
  }>;
}

export interface OrchestrationContext {
  request: LessonRequestV2;
  stage: OrchestrationStage;
  topicInfo?: TopicClassification;
  documentAnalysis?: DocumentAnalysisResult;
  lessonPlan?: LessonPlanV2;
  mathVerification?: MathVerificationReportV2;
  storyboard?: StoryboardV2;
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

