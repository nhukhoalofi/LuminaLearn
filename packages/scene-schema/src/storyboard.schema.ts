import { z } from 'zod';

export const VideoSpecSchema = z.object({
  width: z.number().int().positive('Chiều rộng video phải là số nguyên dương'),
  height: z.number().int().positive('Chiều cao video phải là số nguyên dương'),
  fps: z.number().int().min(12, 'FPS tối thiểu là 12').max(60, 'FPS tối đa là 60'),
  durationFrames: z.number().int().positive('Tổng số frames phải là số nguyên dương')
});

export const FactSchema = z.object({
  id: z.string().min(1, 'Fact ID không được để trống'),
  label: z.string().min(1, 'Nhãn Fact không được để trống'),
  group: z.string().optional(),
  success: z.number().int().nonnegative('Số thành công (success) phải là số nguyên không âm'),
  total: z.number().int().positive('Tổng số lần thử (total) phải lớn hơn 0'),
  unit: z.string().optional(),
  note: z.string().optional(),
  isHypothetical: z.boolean().optional()
}).superRefine((data, ctx) => {
  if (data.success > data.total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Số thành công (${data.success}) không thể lớn hơn tổng số (${data.total}) tại Fact '${data.id}'`,
      path: ['success']
    });
  }
});

export const QuestionRevealContentSchema = z.object({
  question: z.string().min(1, 'Câu hỏi hook không được để trống'),
  subtitle: z.string().optional(),
  hookNote: z.string().optional()
});

export const DualComparisonContentSchema = z.object({
  groupLabel: z.string().min(1, 'Nhãn nhóm không được để trống'),
  factAId: z.string().min(1, 'Fact A ID không được để trống'),
  factBId: z.string().min(1, 'Fact B ID không được để trống'),
  highlightWinner: z.enum(['A', 'B']).optional(),
  takeaway: z.string().optional()
});

export const DataMergeContentSchema = z.object({
  title: z.string().min(1, 'Tiêu đề gộp dữ liệu không được để trống'),
  factAId1: z.string().min(1, 'Fact A1 ID không được để trống'),
  factAId2: z.string().min(1, 'Fact A2 ID không được để trống'),
  factBId1: z.string().min(1, 'Fact B1 ID không được để trống'),
  factBId2: z.string().min(1, 'Fact B2 ID không được để trống'),
  paradoxNote: z.string().min(1, 'Ghi chú nghịch lý không được để trống')
});

export const ConceptSummaryContentSchema = z.object({
  principle: z.string().min(1, 'Nguyên lý kết luận không được để trống'),
  explanation: z.string().min(1, 'Giải thích nguyên lý không được để trống'),
  disclaimer: z.string().min(1, 'Ghi chú cảnh báo / dữ liệu giả định không được để trống')
});

export const QuestionRevealSceneSchema = z.object({
  id: z.string().min(1, 'Scene ID không được để trống'),
  template: z.literal('question_reveal'),
  durationFrames: z.number().int().positive('Thời lượng scene phải lớn hơn 0 frames'),
  content: QuestionRevealContentSchema
});

export const DualComparisonSceneSchema = z.object({
  id: z.string().min(1, 'Scene ID không được để trống'),
  template: z.literal('dual_comparison'),
  durationFrames: z.number().int().positive('Thời lượng scene phải lớn hơn 0 frames'),
  content: DualComparisonContentSchema
});

export const DataMergeSceneSchema = z.object({
  id: z.string().min(1, 'Scene ID không được để trống'),
  template: z.literal('data_merge'),
  durationFrames: z.number().int().positive('Thời lượng scene phải lớn hơn 0 frames'),
  content: DataMergeContentSchema
});

export const ConceptSummarySceneSchema = z.object({
  id: z.string().min(1, 'Scene ID không được để trống'),
  template: z.literal('concept_summary'),
  durationFrames: z.number().int().positive('Thời lượng scene phải lớn hơn 0 frames'),
  content: ConceptSummaryContentSchema
});

export const SceneSchema = z.discriminatedUnion('template', [
  QuestionRevealSceneSchema,
  DualComparisonSceneSchema,
  DataMergeSceneSchema,
  ConceptSummarySceneSchema
]);

export const LessonStoryboardSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'schemaVersion phải có định dạng SemVer x.y.z'),
  projectId: z.string().min(1, 'projectId không được để trống'),
  title: z.string().min(1, 'Tiêu đề bài học không được để trống'),
  video: VideoSpecSchema,
  facts: z.array(FactSchema).min(1, 'Phải có ít nhất 1 Fact dữ liệu'),
  scenes: z.array(SceneSchema).min(1, 'Phải có ít nhất 1 Scene trong storyboard')
}).superRefine((storyboard, ctx) => {
  // 1. Kiểm tra Fact IDs duy nhất
  const factIdSet = new Set<string>();
  for (let i = 0; i < storyboard.facts.length; i++) {
    const fact = storyboard.facts[i];
    if (factIdSet.has(fact.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Trùng lặp Fact ID '${fact.id}'`,
        path: ['facts', i, 'id']
      });
    }
    factIdSet.add(fact.id);
  }

  // 2. Kiểm tra Scene IDs duy nhất
  const sceneIdSet = new Set<string>();
  let totalSceneDuration = 0;

  for (let i = 0; i < storyboard.scenes.length; i++) {
    const scene = storyboard.scenes[i];
    totalSceneDuration += scene.durationFrames;

    if (sceneIdSet.has(scene.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Trùng lặp Scene ID '${scene.id}'`,
        path: ['scenes', i, 'id']
      });
    }
    sceneIdSet.add(scene.id);

    // 3. Kiểm tra tham chiếu Fact ID có tồn tại
    if (scene.template === 'dual_comparison') {
      if (!factIdSet.has(scene.content.factAId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Fact ID '${scene.content.factAId}' không tồn tại trong danh sách facts`,
          path: ['scenes', i, 'content', 'factAId']
        });
      }
      if (!factIdSet.has(scene.content.factBId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Fact ID '${scene.content.factBId}' không tồn tại trong danh sách facts`,
          path: ['scenes', i, 'content', 'factBId']
        });
      }
    } else if (scene.template === 'data_merge') {
      const factRefs = [
        { id: scene.content.factAId1, key: 'factAId1' },
        { id: scene.content.factAId2, key: 'factAId2' },
        { id: scene.content.factBId1, key: 'factBId1' },
        { id: scene.content.factBId2, key: 'factBId2' }
      ];

      for (const ref of factRefs) {
        if (!factIdSet.has(ref.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Fact ID '${ref.id}' không tồn tại trong danh sách facts`,
            path: ['scenes', i, 'content', ref.key]
          });
        }
      }
    }
  }

  // 4. Kiểm tra tổng thời lượng scenes khớp video duration
  if (totalSceneDuration !== storyboard.video.durationFrames) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Tổng thời lượng các scene (${totalSceneDuration} frames) không khớp với video.durationFrames (${storyboard.video.durationFrames} frames)`,
      path: ['video', 'durationFrames']
    });
  }
});

