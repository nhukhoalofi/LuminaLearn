export interface VideoSpec {
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
}

export interface Fact {
  id: string;
  label: string;
  group?: string;
  success: number;
  total: number;
  unit?: string;
  note?: string;
  isHypothetical?: boolean;
}

export type SceneTemplate =
  | 'question_reveal'
  | 'dual_comparison'
  | 'data_merge'
  | 'concept_summary';

export interface QuestionRevealContent {
  question: string;
  subtitle?: string;
  hookNote?: string;
}

export interface DualComparisonContent {
  groupLabel: string;
  factAId: string;
  factBId: string;
  highlightWinner?: 'A' | 'B';
  takeaway?: string;
}

export interface DataMergeContent {
  title: string;
  factAId1: string;
  factAId2: string;
  factBId1: string;
  factBId2: string;
  paradoxNote: string;
}

export interface ConceptSummaryContent {
  principle: string;
  explanation: string;
  disclaimer: string;
}

export interface QuestionRevealScene {
  id: string;
  template: 'question_reveal';
  durationFrames: number;
  content: QuestionRevealContent;
}

export interface DualComparisonScene {
  id: string;
  template: 'dual_comparison';
  durationFrames: number;
  content: DualComparisonContent;
}

export interface DataMergeScene {
  id: string;
  template: 'data_merge';
  durationFrames: number;
  content: DataMergeContent;
}

export interface ConceptSummaryScene {
  id: string;
  template: 'concept_summary';
  durationFrames: number;
  content: ConceptSummaryContent;
}

export type Scene =
  | QuestionRevealScene
  | DualComparisonScene
  | DataMergeScene
  | ConceptSummaryScene;

export interface LessonStoryboard {
  schemaVersion: string;
  projectId: string;
  title: string;
  video: VideoSpec;
  facts: Fact[];
  scenes: Scene[];
}

export interface StoryboardValidationResult {
  success: boolean;
  data?: LessonStoryboard;
  errors?: string[];
}

