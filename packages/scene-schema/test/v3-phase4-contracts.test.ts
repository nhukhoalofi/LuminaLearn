import assert from 'node:assert/strict';
import test from 'node:test';
import { AlgebraIdentityVisualPayloadSchema, LessonRequestV3Schema } from '../src/v3/index';

const request = {
  requestId: 'req_phase4_contract', topic: '7 hằng đẳng thức đáng nhớ', domain: 'mathematics', generationMode: 'mock',
  targetDurationSeconds: 35, narrationMode: 'none', subtitlesEnabled: true, fps: 24, width: 720, height: 1280
};

test('V3 render contract only accepts the implemented 720x1280 24fps profile', () => {
  assert.equal(LessonRequestV3Schema.parse(request).fps, 24);
  assert.equal(LessonRequestV3Schema.safeParse({ ...request, fps: 30 }).success, false);
  assert.equal(LessonRequestV3Schema.safeParse({ ...request, width: 1080 }).success, false);
  assert.equal(LessonRequestV3Schema.safeParse({ ...request, height: 1920 }).success, false);
});

test('algebra visual payload binds first and last transformation to verified expressions', () => {
  const payload = {
    sceneType: 'algebra_identity', identityId: 'square_sum', leftExpression: '(a+b)^2', rightExpression: 'a^2+2*a*b+b^2', presentation: 'expansion',
    transformationSteps: [
      { expression: '(a+b)^2', explanationVietnamese: 'Giữ nguyên vế trái.', highlightTerms: [] },
      { expression: 'a^2+2*a*b+b^2', explanationVietnamese: 'Khai triển.', highlightTerms: [] }
    ]
  };
  assert.equal(AlgebraIdentityVisualPayloadSchema.safeParse(payload).success, true);
  assert.equal(AlgebraIdentityVisualPayloadSchema.safeParse({ ...payload, transformationSteps: [{ ...payload.transformationSteps[0], expression: 'a' }, payload.transformationSteps[1]] }).success, false);
});

