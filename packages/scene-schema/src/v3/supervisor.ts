import { z } from 'zod';
import { SafeIdString, NoExecutableString } from '../v2/document';
import {
  EducationalLessonPlanV3Schema,
  type EducationalLessonPlanV3
} from './contracts';
import {
  EducationalDomainSchema,
  TopicCapabilityReportV3Schema,
  type EducationalDomain,
  type TopicCapabilityReportV3
} from './capability';
import {
  LessonRequestV3Schema,
  type LessonRequestV3
} from './artifact';
import { ExternalApiConsentRecordV3Schema, type ExternalApiConsentRecordV3 } from './consent';
import { EducationalVisualPayloadSchema, type EducationalVisualPayload } from './visual-dsl';

// 1. Supervisor Request Schema
export const TargetAudienceSchema = z.enum([
  'high_school',
  'undergraduate',
  'engineer',
  'general_public'
]);
export type TargetAudience = z.infer<typeof TargetAudienceSchema>;

export const SupervisorRequestV3Schema = z.object({
  requestId: SafeIdString,
  topic: z.string().min(3).max(200).pipe(NoExecutableString),
  domain: EducationalDomainSchema,
  targetAudience: TargetAudienceSchema.default('undergraduate'),
  targetDurationSeconds: z.number().int().min(20).max(90).default(40),
  generationMode: z.enum(['mock', 'live']).default('mock'),
  narrationMode: z.enum(['none', 'provided_audio', 'gemini_tts', 'google_cloud_tts']).default('none'),
  subtitlesEnabled: z.boolean().default(true),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).default(24),
  width: z.number().int().min(480).max(1920).default(720),
  height: z.number().int().min(480).max(1920).default(1280),
  ownerId: SafeIdString.default('local-single-user'),
  sourceDocumentText: z.string().max(30000).optional(),
  consentRecord: ExternalApiConsentRecordV3Schema.optional()
}).strict();
export type SupervisorRequestV3 = z.infer<typeof SupervisorRequestV3Schema>;

// 2. Agent Roles
export const AgentRoleV3Schema = z.enum([
  'curriculum_planner',
  'math_specialist',
  'ai_specialist',
  'visual_director',
  'narration_director',
  'pedagogical_reviewer',
  'supervisor'
]);
export type AgentRoleV3 = z.infer<typeof AgentRoleV3Schema>;

// 3. Agent Task Status & Provenance
export const AgentTaskStatusV3Schema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'retry_scheduled'
]);
export type AgentTaskStatusV3 = z.infer<typeof AgentTaskStatusV3Schema>;

export const AgentTaskProvenanceV3Schema = z.enum([
  'deterministic_fixture',
  'sympy_formal_engine',
  'heuristic_visual_dsl',
  'rule_based_narration',
  'ai_generated',
  'composite'
]);
export type AgentTaskProvenanceV3 = z.infer<typeof AgentTaskProvenanceV3Schema>;

// 4. Agent Task Definition
export const AgentTaskV3Schema = z.object({
  taskId: SafeIdString,
  role: AgentRoleV3Schema,
  title: z.string().min(1).max(120),
  inputReference: z.string().max(200),
  status: AgentTaskStatusV3Schema,
  dependencyIds: z.array(SafeIdString).default([]),
  attemptCount: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(2),
  result: z.record(z.unknown()).optional(),
  validationStatus: z.enum(['unvalidated', 'passed', 'failed', 'advisory_warning']).default('unvalidated'),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  provenance: AgentTaskProvenanceV3Schema.default('composite'),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  durationMs: z.number().nonnegative().optional()
}).strict();
export type AgentTaskV3 = z.infer<typeof AgentTaskV3Schema>;

// 5. Educational Chapter Plan (Curriculum Planning Agent output)
export const EducationalChapterPlanV3Schema = z.object({
  chapterIndex: z.number().int().nonnegative(),
  chapterTitle: z.string().min(1).max(100),
  targetDurationSeconds: z.number().positive(),
  pedagogicalIntent: z.string().min(1).max(300),
  keyFormulasOrConcepts: z.array(z.string().min(1).max(100)).max(8)
}).strict();
export type EducationalChapterPlanV3 = z.infer<typeof EducationalChapterPlanV3Schema>;

// 6. Visual Direction Decision (Visual Director Agent output)
export const CameraMotionV3Schema = z.enum(['static', 'slow_pan', 'zoom_in', 'focus_pulse']);
export type CameraMotionV3 = z.infer<typeof CameraMotionV3Schema>;

export const RhythmPacingV3Schema = z.enum(['steady', 'deliberate_pause', 'dynamic_reveal']);
export type RhythmPacingV3 = z.infer<typeof RhythmPacingV3Schema>;

export const VisualDirectionDecisionV3Schema = z.object({
  sceneId: SafeIdString,
  sceneType: z.string().min(1).max(64),
  selectedComponent: z.string().min(1).max(64),
  treatmentRationale: z.string().min(1).max(300),
  cameraMotion: CameraMotionV3Schema.default('static'),
  rhythmPacing: RhythmPacingV3Schema.default('steady'),
  visualPayload: EducationalVisualPayloadSchema,
  preservesVerifiedMath: z.boolean().default(true)
}).strict();
export type VisualDirectionDecisionV3 = z.infer<typeof VisualDirectionDecisionV3Schema>;

// 7. Narration Direction Result (Narration Director Agent output)
export const NarrationDirectionResultV3Schema = z.object({
  sceneId: SafeIdString,
  narrationVietnamese: z.string().min(1).max(1000),
  subtitleVietnamese: z.string().min(1).max(300),
  estimatedSpeakingDurationSeconds: z.number().positive(),
  sceneDurationSeconds: z.number().positive(),
  fitsSceneDuration: z.boolean(),
  pronunciationHints: z.record(z.string()).optional()
}).strict();
export type NarrationDirectionResultV3 = z.infer<typeof NarrationDirectionResultV3Schema>;

// 8. Pedagogical Quality Review (Pedagogical Quality Reviewer output)
export const QualityReviewResultV3Schema = z.object({
  passed: z.boolean(),
  explanationClarityScore: z.number().min(1).max(10),
  unsupportedStatements: z.array(z.string()).default([]),
  contradictionsDetected: z.array(z.string()).default([]),
  revisionsRequested: z.array(z.string()).default([]),
  reviewNotes: z.string().max(1000)
}).strict();
export type QualityReviewResultV3 = z.infer<typeof QualityReviewResultV3Schema>;

// 9. Supervisor Execution Plan & Trace
export const SupervisorTraceStatusV3Schema = z.enum([
  'running',
  'completed_draft',
  'needs_teacher_review',
  'unsupported_topic',
  'verification_failed',
  'provider_unavailable',
  'budget_exceeded',
  'interrupted'
]);
export type SupervisorTraceStatusV3 = z.infer<typeof SupervisorTraceStatusV3Schema>;

export const SupervisorTraceV3Schema = z.object({
  supervisorRunId: SafeIdString,
  requestId: SafeIdString,
  topicId: z.string().min(1).max(100),
  domain: EducationalDomainSchema,
  tasks: z.array(AgentTaskV3Schema),
  currentTaskIndex: z.number().int().nonnegative().default(0),
  elapsedMs: z.number().nonnegative().default(0),
  retryCount: z.number().int().nonnegative().default(0),
  budgetUsage: z.object({
    geminiApiCalls: z.number().int().nonnegative().default(0),
    maxApiCalls: z.number().int().positive().default(4)
  }).strict(),
  status: SupervisorTraceStatusV3Schema,
  humanReadableSummary: z.string().max(1500)
}).strict();
export type SupervisorTraceV3 = z.infer<typeof SupervisorTraceV3Schema>;

// 10. Supervisor Final Draft
export const SupervisorFinalDraftV3Schema = z.object({
  draftId: SafeIdString,
  lessonPlan: EducationalLessonPlanV3Schema,
  capabilityReport: TopicCapabilityReportV3Schema,
  trace: SupervisorTraceV3Schema,
  teacherApprovalRequired: z.literal(true)
}).strict();
export type SupervisorFinalDraftV3 = z.infer<typeof SupervisorFinalDraftV3Schema>;
