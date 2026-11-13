import type { EducationalLessonPlanV3 } from '@luminalearn/scene-schema';

export type PhysicsQualitySeverity = 'blocking' | 'needs_review';

export interface PhysicsStoryboardQualityFinding {
  code: string;
  severity: PhysicsQualitySeverity;
  message: string;
  sceneIds: string[];
}

export interface PhysicsStoryboardQualityReport {
  schemaVersion: 'physics-storyboard-quality-v1';
  passed: boolean;
  score: number;
  findings: PhysicsStoryboardQualityFinding[];
  metrics: {
    sceneCount: number;
    uniqueCameraMoves: number;
    uniqueVisualStates: number;
    maximumNarrationWordsPerSecond: number;
  };
}

const wordsPerSecond = (text: string, durationSeconds: number): number => {
  const words = text.trim().split(/\s+/u).filter(Boolean).length;
  return words / Math.max(1, durationSeconds);
};

export function reviewPhysicsStoryboard(plan: EducationalLessonPlanV3): PhysicsStoryboardQualityReport {
  const scenes = plan.storyboard?.scenes ?? [];
  if (plan.domain !== 'physics') {
    return {
      schemaVersion: 'physics-storyboard-quality-v1', passed: true, score: 100, findings: [],
      metrics: { sceneCount: scenes.length, uniqueCameraMoves: 0, uniqueVisualStates: 0, maximumNarrationWordsPerSecond: 0 }
    };
  }

  const findings: PhysicsStoryboardQualityFinding[] = [];
  const add = (code: string, severity: PhysicsQualitySeverity, message: string, sceneIds: string[] = []) => findings.push({ code, severity, message, sceneIds });
  const explainerScenes = scenes.filter((scene) => scene.visualPayload.sceneType === 'physics_explainer');
  const cameraMoves = new Set(explainerScenes.map((scene) => scene.visualPayload.sceneType === 'physics_explainer' ? scene.visualPayload.cameraMove : ''));
  const visualStates = new Set(explainerScenes.map((scene) => scene.visualPayload.sceneType === 'physics_explainer' ? JSON.stringify({ family: scene.visualPayload.family, simulation: scene.visualPayload.simulation }) : scene.sceneType));
  const narrationRates = scenes.map((scene) => wordsPerSecond(scene.narration.vietnamese, scene.durationSeconds));
  const maxNarrationRate = Math.max(0, ...narrationRates);

  if (plan.capabilityReport.renderReadiness === 'render_ready' && scenes.length < 6) {
    add('physics_story_too_shallow', 'blocking', 'Một bài Vật lý render-ready cần ít nhất sáu nhịp sư phạm có chức năng khác nhau.', scenes.map((scene) => scene.sceneId));
  }
  const beats = new Set(explainerScenes.map((scene) => scene.visualPayload.sceneType === 'physics_explainer' ? scene.visualPayload.beat : ''));
  for (const beat of ['hook', 'system_model', 'mechanism_a', 'mechanism_b', 'evidence', 'takeaway']) {
    if (explainerScenes.length > 0 && !beats.has(beat as never)) add('physics_story_missing_beat', 'blocking', `Thiếu nhịp sư phạm '${beat}'.`);
  }
  if (cameraMoves.size < 3 && explainerScenes.length >= 4) {
    add('physics_camera_repetition', 'needs_review', 'Storyboard cần ít nhất ba kiểu camera để tránh cảm giác một slide lặp lại.', explainerScenes.map((scene) => scene.sceneId));
  }
  if (visualStates.size < Math.min(3, explainerScenes.length)) {
    add('physics_visual_state_repetition', 'blocking', 'Các cảnh đang lặp cùng một trạng thái trực quan; cần thay đổi dữ liệu, góc nhìn hoặc dạng mô phỏng.', explainerScenes.map((scene) => scene.sceneId));
  }
  const duplicateHeadlines = new Map<string, string[]>();
  for (const scene of scenes) {
    const headline = scene.visualPayload.sceneType === 'physics_explainer' ? scene.visualPayload.headline.trim().toLocaleLowerCase('vi') : scene.title.trim().toLocaleLowerCase('vi');
    duplicateHeadlines.set(headline, [...(duplicateHeadlines.get(headline) ?? []), scene.sceneId]);
  }
  for (const [headline, sceneIds] of duplicateHeadlines) {
    if (sceneIds.length > 1) add('physics_duplicate_headline', 'blocking', `Tiêu đề '${headline}' bị lặp.`, sceneIds);
  }
  if (maxNarrationRate > 3.5) {
    const sceneIds = scenes.filter((scene) => wordsPerSecond(scene.narration.vietnamese, scene.durationSeconds) > 3.5).map((scene) => scene.sceneId);
    add('physics_narration_too_fast', maxNarrationRate > 4.2 ? 'blocking' : 'needs_review', `Lời giảng vượt nhịp khuyến nghị 3,5 từ/giây (tối đa ${maxNarrationRate.toFixed(2)}).`, sceneIds);
  }
  const hook = explainerScenes.find((scene) => scene.visualPayload.sceneType === 'physics_explainer' && scene.visualPayload.beat === 'hook');
  if (hook && hook.durationSeconds > 8) add('physics_hook_too_slow', 'needs_review', 'Hook nên hoàn thành trong tối đa tám giây.', [hook.sceneId]);
  for (const scene of scenes) {
    const unknownClaims = scene.boundClaimIds.filter((claimId) => !plan.educationalClaims.some((claim) => claim.id === claimId));
    if (unknownClaims.length > 0) add('physics_unbound_claim', 'blocking', `Cảnh tham chiếu claim không tồn tại: ${unknownClaims.join(', ')}.`, [scene.sceneId]);
  }

  const blocking = findings.filter((finding) => finding.severity === 'blocking').length;
  const review = findings.length - blocking;
  const score = Math.max(0, 100 - blocking * 20 - review * 7);
  return {
    schemaVersion: 'physics-storyboard-quality-v1', passed: blocking === 0, score, findings,
    metrics: { sceneCount: scenes.length, uniqueCameraMoves: cameraMoves.size, uniqueVisualStates: visualStates.size, maximumNarrationWordsPerSecond: Number(maxNarrationRate.toFixed(2)) }
  };
}

export async function runBoundedPhysicsQualityLoop(options: {
  generate: () => Promise<EducationalLessonPlanV3>;
  revise?: (plan: EducationalLessonPlanV3, report: PhysicsStoryboardQualityReport, attempt: number) => Promise<EducationalLessonPlanV3>;
  maxAttempts?: number;
}): Promise<{ plan: EducationalLessonPlanV3; report: PhysicsStoryboardQualityReport; attempts: number }> {
  const maxAttempts = Math.max(1, Math.min(3, options.maxAttempts ?? 2));
  let plan = await options.generate();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const report = reviewPhysicsStoryboard(plan);
    if (report.passed) return { plan, report, attempts: attempt };
    if (!options.revise || attempt === maxAttempts) {
      const error = new Error(`physics_storyboard_quality_failed: ${report.findings.filter((finding) => finding.severity === 'blocking').map((finding) => finding.code).join(', ')}`) as Error & { report?: PhysicsStoryboardQualityReport };
      error.report = report;
      throw error;
    }
    plan = await options.revise(plan, report, attempt);
  }
  throw new Error('physics_storyboard_quality_failed: attempts_exhausted');
}
