import { z } from 'zod';
import {
  EducationalDomainSchema,
  REGISTERED_TOPICS_V3,
  canonicalizeTopicId,
  type EducationalDomain,
  type TopicCapabilityReportV3
} from './capability';

export const AgentStudioTeachingGoalV3Schema = z.enum([
  'build_intuition',
  'explain_mechanism',
  'real_world_application',
  'exam_review'
]);
export type AgentStudioTeachingGoalV3 = z.infer<typeof AgentStudioTeachingGoalV3Schema>;

export const AgentStudioVisualDirectionV3Schema = z.enum([
  'cinematic_science',
  'clean_infographic',
  'mathematical_visualization'
]);
export type AgentStudioVisualDirectionV3 = z.infer<typeof AgentStudioVisualDirectionV3Schema>;

export const AgentStudioSelectionV3Schema = z.object({
  topicId: z.string().regex(/^[a-z0-9_.-]{3,80}$/),
  teachingGoal: AgentStudioTeachingGoalV3Schema.default('build_intuition'),
  visualDirection: AgentStudioVisualDirectionV3Schema.default('cinematic_science')
}).strict();
export type AgentStudioSelectionV3 = z.infer<typeof AgentStudioSelectionV3Schema>;

export interface AgentStudioTopicOptionV3 {
  topicId: string;
  domain: EducationalDomain;
  label: string;
  subCategory: string;
}

const GOAL_BRIEFS: Record<AgentStudioTeachingGoalV3, string> = {
  build_intuition: 'Xây dựng trực giác trước, sau đó mới khái quát hóa kiến thức.',
  explain_mechanism: 'Giải thích cơ chế theo chuỗi nguyên nhân và kết quả.',
  real_world_application: 'Liên hệ hiện tượng với một ứng dụng thực tế có thể kiểm chứng.',
  exam_review: 'Ôn tập trọng tâm, chỉ ra điều kiện áp dụng và lỗi sai thường gặp.'
};

const VISUAL_BRIEFS: Record<AgentStudioVisualDirectionV3, string> = {
  cinematic_science: 'Dùng nhịp kể chuyện khoa học điện ảnh và mô phỏng chuyển động liên tục.',
  clean_infographic: 'Dùng infographic giáo dục rõ ràng, ưu tiên so sánh và quan hệ nhân quả.',
  mathematical_visualization: 'Ưu tiên đồ thị, đại lượng và phép biến đổi trực quan có kiểm định.'
};

export function getAgentStudioTopicsV3(domain?: EducationalDomain): AgentStudioTopicOptionV3[] {
  return Object.values(REGISTERED_TOPICS_V3)
    .filter((topic) => topic.renderReadiness === 'render_ready')
    .filter((topic) => domain === undefined || topic.domain === domain)
    .map((topic) => ({
      topicId: topic.topicId,
      domain: topic.domain,
      label: topic.displayName,
      subCategory: topic.subCategory
    }));
}

export interface ResolvedAgentStudioSelectionV3 {
  topic: string;
  domain: EducationalDomain;
  capabilityReport: TopicCapabilityReportV3;
}

/**
 * Resolve a bounded UI selection into the trusted brief consumed by the
 * existing supervisor. User-authored prompt text never participates here.
 */
export function resolveAgentStudioSelectionV3(
  input: AgentStudioSelectionV3
): ResolvedAgentStudioSelectionV3 {
  const selection = AgentStudioSelectionV3Schema.parse(input);
  const canonicalTopicId = canonicalizeTopicId(selection.topicId);
  const capability = REGISTERED_TOPICS_V3[canonicalTopicId];

  if (!capability) {
    throw new Error(`agent_studio_topic_not_registered:${selection.topicId}`);
  }
  if (capability.renderReadiness !== 'render_ready') {
    throw new Error(`agent_studio_topic_not_render_ready:${canonicalTopicId}`);
  }

  return {
    topic: `${capability.displayName}. ${GOAL_BRIEFS[selection.teachingGoal]} ${VISUAL_BRIEFS[selection.visualDirection]}`,
    domain: EducationalDomainSchema.parse(capability.domain),
    capabilityReport: capability
  };
}
