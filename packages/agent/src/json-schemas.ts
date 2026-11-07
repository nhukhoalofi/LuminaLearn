export const mathLessonDraftJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    lessonTitle: { type: 'string' }, topicId: { type: 'string', enum: ['calculus.derivative.intuition'] },
    targetAudience: { type: 'string' }, language: { type: 'string', enum: ['vi', 'en'] },
    learningObjectives: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
    intuitiveExplanation: { type: 'string' },
    mathematicalClaims: { type: 'array', minItems: 4, maxItems: 8, items: {
      type: 'object', additionalProperties: false,
      properties: { id: { type: 'string' }, statement: { type: 'string' }, validatorKey: { type: 'string', enum: ['polynomial_derivative', 'secant_slope', 'limit_at_zero', 'value_at_point'] }, expectedExpression: { type: 'string' } },
      required: ['id', 'statement', 'validatorKey', 'expectedExpression']
    } },
    sceneOutline: { type: 'array', minItems: 3, maxItems: 8, items: {
      type: 'object', additionalProperties: false,
      properties: { id: { type: 'string' }, pedagogicalGoal: { type: 'string' }, narration: { type: 'string' }, visualization: { type: 'string', enum: ['function_graph', 'moving_point', 'secant_to_tangent', 'tangent_line', 'equation_reveal', 'concept_summary'] }, durationSeconds: { type: 'integer', minimum: 2, maximum: 30 } },
      required: ['id', 'pedagogicalGoal', 'narration', 'visualization', 'durationSeconds']
    } },
    summary: { type: 'string' }
  },
  required: ['lessonTitle', 'topicId', 'targetAudience', 'language', 'learningObjectives', 'intuitiveExplanation', 'mathematicalClaims', 'sceneOutline', 'summary']
} as const;

export const mathSceneJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', enum: ['math-v1'] }, topicId: { type: 'string', enum: ['calculus.derivative.intuition'] },
    visualization: { type: 'string', enum: ['secant_to_tangent'] },
    function: { type: 'object', additionalProperties: false, properties: { type: { type: 'string', enum: ['polynomial'] }, coefficients: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'number' } } }, required: ['type', 'coefficients'] },
    pointX: { type: 'number', minimum: -10, maximum: 10 }, hStart: { type: 'number', minimum: 0.05, maximum: 5 }, hEnd: { type: 'number', minimum: 0.001, maximum: 0.5 },
    durationSeconds: { type: 'number', minimum: 1, maximum: 15 }, fps: { type: 'integer', minimum: 12, maximum: 60 }, width: { type: 'integer', minimum: 360, maximum: 1920 }, height: { type: 'integer', minimum: 360, maximum: 1920 }
  },
  required: ['schemaVersion', 'topicId', 'visualization', 'function', 'pointX', 'hStart', 'hEnd', 'durationSeconds', 'fps', 'width', 'height']
} as const;

