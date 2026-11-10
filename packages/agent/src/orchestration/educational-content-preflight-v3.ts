import {
  EducationalQualityReportV1Schema,
  type EducationalLessonPlanV3,
  type EducationalQualityFindingV1,
  type EducationalQualityStatusV1,
  type PedagogicalBeatV1
} from '@luminalearn/scene-schema';

const STATUS_RANK: Record<EducationalQualityStatusV1, number> = {
  PASS: 0,
  WARNING: 1,
  NEEDS_REVIEW: 2,
  BLOCKED: 3
};
const GENERIC_FILLER = /(?:trong phần này|tiếp tục phân tích|nội dung bài giảng|hãy luyện tập để thành thạo)/iu;
const MATH_SYMBOL = /(?:\\(?:frac|int|sum|lim|partial)|[=∫ΣΔη^_])/u;

function addFinding(
  findings: EducationalQualityFindingV1[],
  status: EducationalQualityStatusV1,
  code: string,
  message: string,
  sceneId?: string,
  beatId?: string,
  remediation?: string
) {
  findings.push({
    findingId: `quality_${String(findings.length + 1).padStart(3, '0')}`,
    code,
    status,
    message,
    ...(sceneId ? { sceneId } : {}),
    ...(beatId ? { beatId } : {}),
    ...(remediation ? { remediation } : {})
  });
}

function beatsForScene(beats: PedagogicalBeatV1[] | undefined, sceneId: string) {
  return beats?.filter((beat) => beat.sceneId === sceneId) ?? [];
}

/** Deterministic content checks only; this function grants no proof or approval authority. */
export function runEducationalContentPreflightV3(plan: EducationalLessonPlanV3) {
  const findings: EducationalQualityFindingV1[] = [];
  if (!plan.storyboard) addFinding(findings, 'BLOCKED', 'storyboard_missing', 'Không có storyboard để kiểm tra nội dung giáo dục.');
  const rejectedClaims = plan.educationalClaims.filter((claim) => claim.verificationStatus === 'rejected');
  if (rejectedClaims.length > 0) {
    addFinding(findings, 'BLOCKED', 'scientific_claim_rejected', `Có ${rejectedClaims.length} mệnh đề khoa học đã bị từ chối; không được render.`);
  }

  for (const scene of plan.storyboard?.scenes ?? []) {
    const beats = beatsForScene(plan.pedagogicalBeats, scene.sceneId);
    if (scene.pedagogicalGoal.trim().length < 12) addFinding(findings, 'NEEDS_REVIEW', 'learning_objective_too_vague', 'Mục tiêu học tập của cảnh chưa đủ cụ thể.', scene.sceneId);
    if (beats.length === 0) addFinding(findings, 'NEEDS_REVIEW', 'pedagogical_beat_missing', 'Cảnh chưa có bước học tập có cấu trúc.', scene.sceneId);

    const narration = scene.narration.vietnamese.trim();
    if (narration.length < 24) addFinding(findings, 'NEEDS_REVIEW', 'narration_insufficient', 'Lời dẫn quá ngắn để giải thích mục tiêu cảnh.', scene.sceneId);
    if (GENERIC_FILLER.test(narration)) addFinding(findings, 'WARNING', 'generic_narration_filler', 'Lời dẫn có dấu hiệu chung chung, cần diễn đạt rõ WHY/HOW.', scene.sceneId);

    const meaningfulHold = beats.some((beat) => beat.timingConstraints.allowMeaningfulHold && beat.recommendedVisualActions.includes('hold_for_reading'));
    const charsPerSecond = narration.length / scene.durationSeconds;
    if (charsPerSecond < 1.2 && !meaningfulHold) {
      addFinding(findings, 'NEEDS_REVIEW', 'empty_static_duration', 'Thời lượng cảnh dài hơn đáng kể so với nội dung và chưa khai báo khoảng dừng đọc/suy ngẫm có chủ đích.', scene.sceneId);
    } else if (charsPerSecond > 22) {
      addFinding(findings, 'WARNING', 'narration_too_dense', 'Mật độ lời dẫn có thể quá cao để người học theo kịp.', scene.sceneId);
    }

    const visual = JSON.stringify(scene.visualPayload);
    if (MATH_SYMBOL.test(visual) && !/(đạo hàm|tích phân|giới hạn|bằng|gradient|xác suất|ma trận|công thức|biểu thức)/iu.test(narration)) {
      addFinding(findings, 'WARNING', 'math_symbol_not_explained', 'Cảnh có ký hiệu toán nhưng lời dẫn chưa giải thích ý nghĩa ký hiệu.', scene.sceneId);
    }
    const actions = new Set(beats.flatMap((beat) => beat.recommendedVisualActions));
    if (scene.sceneType === 'formula_derivation' && !actions.has('reveal_formula_step')) addFinding(findings, 'NEEDS_REVIEW', 'visual_action_mismatch', 'Cảnh biến đổi công thức cần hành động hé lộ từng bước.', scene.sceneId);
    if (scene.sceneType === 'loss_landscape' && !actions.has('move_parameter_marker')) addFinding(findings, 'NEEDS_REVIEW', 'visual_action_mismatch', 'Cảnh tối ưu hóa cần trực quan hóa bước cập nhật tham số.', scene.sceneId);
  }

  for (const example of plan.workedExamples ?? []) {
    if (example.steps.length < 2) addFinding(findings, 'NEEDS_REVIEW', 'worked_example_steps_missing', `Ví dụ ${example.exampleId} chưa có đủ bước trung gian.`, undefined, undefined, 'Thêm ít nhất một bước tính trung gian có kiểm định.');
    if (example.verificationStatus === 'human_review_required') addFinding(findings, 'NEEDS_REVIEW', 'worked_example_requires_review', `Ví dụ ${example.exampleId} chưa được kiểm định độc lập.`);
  }
  if ((plan.workedExamples?.length ?? 0) === 0) {
    addFinding(findings, 'NEEDS_REVIEW', 'worked_example_missing', 'Bài học chưa có ví dụ worked example dùng chung cho lời dẫn, công thức và hình ảnh.');
  }
  if (findings.length === 0) addFinding(findings, 'PASS', 'educational_preflight_passed', 'Cấu trúc nội dung giáo dục vượt qua preflight xác định.');
  const overallStatus = findings.reduce<EducationalQualityStatusV1>((current, item) => STATUS_RANK[item.status] > STATUS_RANK[current] ? item.status : current, 'PASS');
  return EducationalQualityReportV1Schema.parse({ overallStatus, findings, checkedAt: new Date(0).toISOString() });
}
