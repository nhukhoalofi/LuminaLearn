import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectDraftConflicts,
  type MinimalLessonDraft
} from '../src/components/conflict-utils.ts';

describe('Checkpoint B — Safe Draft Conflict Handling & Concurrency', () => {
  const baseDraft: MinimalLessonDraft = {
    version: 1,
    lessonPlan: {
      title: 'Bản chất hình học của đạo hàm',
      summary: 'Giới thiệu về tiếp tuyến và cát tuyến.',
      mathematicalClaims: [
        {
          id: 'claim_1',
          statement: 'Đạo hàm của x^2 là 2*x',
          expectedExpression: '2*x'
        }
      ]
    },
    narrationPlan: {
      segments: [
        {
          segmentId: 'seg_1',
          text: 'Chào mừng các bạn đến với bài học đạo hàm.',
          subtitleText: 'Chào mừng các bạn đến với đạo hàm.'
        }
      ]
    },
    renderConfig: {
      renderMode: 'mock',
      narrationMode: 'none',
      visualStyleId: 'clean_educational_infographic',
      subtitlesEnabled: true
    }
  };

  it('detects no conflicts when two tabs hold identical drafts', () => {
    const tabA = structuredClone(baseDraft);
    const tabB = structuredClone(baseDraft);
    const conflicts = detectDraftConflicts(tabA, tabB);
    assert.equal(conflicts.length, 0);
  });

  it('detects title and summary conflict when Tab B updates server while Tab A is editing', () => {
    // Tab B saved to server first: title changed, version bumped to 2
    const serverDraftV2: MinimalLessonDraft = {
      ...structuredClone(baseDraft),
      version: 2,
      lessonPlan: {
        ...baseDraft.lessonPlan,
        title: 'Bản chất hình học của đạo hàm — Cải biên từ Thầy Tuấn'
      }
    };

    // Tab A has local unsaved edit changing the summary
    const tabAUnsaved: MinimalLessonDraft = {
      ...structuredClone(baseDraft),
      version: 1,
      lessonPlan: {
        ...baseDraft.lessonPlan,
        summary: 'Tóm tắt mới từ Cô Lan về độ dốc tiếp tuyến.'
      }
    };

    // When Tab A attempts to save or resolve, diff must show both fields
    const conflicts = detectDraftConflicts(tabAUnsaved, serverDraftV2);
    assert.equal(conflicts.length, 2);

    const titleConflict = conflicts.find((c) => c.field === 'title');
    assert.ok(titleConflict);
    assert.equal(titleConflict.localValue, 'Bản chất hình học của đạo hàm');
    assert.equal(titleConflict.serverValue, 'Bản chất hình học của đạo hàm — Cải biên từ Thầy Tuấn');

    const summaryConflict = conflicts.find((c) => c.field === 'summary');
    assert.ok(summaryConflict);
    assert.equal(summaryConflict.localValue, 'Tóm tắt mới từ Cô Lan về độ dốc tiếp tuyến.');
    assert.equal(summaryConflict.serverValue, 'Giới thiệu về tiếp tuyến và cát tuyến.');
  });

  it('detects mathematical claim divergence to prevent silent formula overwrites', () => {
    // Tab B changed the claim on the server
    const serverDraft: MinimalLessonDraft = {
      ...structuredClone(baseDraft),
      version: 2,
      lessonPlan: {
        ...baseDraft.lessonPlan,
        mathematicalClaims: [
          {
            id: 'claim_1',
            statement: 'Đạo hàm của x^3 là 3*x^2',
            expectedExpression: '3*x^2'
          }
        ]
      }
    };

    // Tab A still has x^2
    const tabA: MinimalLessonDraft = structuredClone(baseDraft);

    const conflicts = detectDraftConflicts(tabA, serverDraft);
    const mathConflict = conflicts.find((c) => c.field === 'claim_claim_1');
    assert.ok(mathConflict);
    assert.match(mathConflict.localValue, /2\*x/);
    assert.match(mathConflict.serverValue, /3\*x\^2/);
  });

  it('detects narration segment text changes between tabs', () => {
    const serverDraft: MinimalLessonDraft = {
      ...structuredClone(baseDraft),
      version: 2,
      narrationPlan: {
        segments: [
          {
            segmentId: 'seg_1',
            text: 'Lời dẫn đã được biên tập lại chi tiết hơn.',
            subtitleText: 'Lời dẫn mới.'
          }
        ]
      }
    };

    const tabA: MinimalLessonDraft = structuredClone(baseDraft);
    const conflicts = detectDraftConflicts(tabA, serverDraft);

    const textConflict = conflicts.find((c) => c.field === 'narration_seg_1_text');
    assert.ok(textConflict);
    assert.equal(textConflict.localValue, 'Chào mừng các bạn đến với bài học đạo hàm.');
    assert.equal(textConflict.serverValue, 'Lời dẫn đã được biên tập lại chi tiết hơn.');
  });

  it('ensures rejecting local changes safely adopts authoritative server draft', () => {
    const serverDraft: MinimalLessonDraft = {
      ...structuredClone(baseDraft),
      version: 2,
      lessonPlan: {
        ...baseDraft.lessonPlan,
        title: 'Tiêu đề mới đã duyệt trên Server'
      }
    };

    const tabA: MinimalLessonDraft = structuredClone(baseDraft);
    const conflicts = detectDraftConflicts(tabA, serverDraft);
    assert.ok(conflicts.length > 0);

    // Explicit resolution: Teacher chooses to accept server draft
    const resolvedDraft = structuredClone(serverDraft);
    assert.equal(resolvedDraft.version, 2);
    assert.equal(resolvedDraft.lessonPlan.title, 'Tiêu đề mới đã duyệt trên Server');
  });
});

