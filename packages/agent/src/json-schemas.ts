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

export const lessonPlanV2JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'string', enum: ['lesson-v2'] },
    lessonId: { type: 'string' },
    topicId: { type: 'string' },
    title: { type: 'string' },
    learningObjectives: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } },
    prerequisites: { type: 'array', maxItems: 6, items: { type: 'string' } },
    keyConcepts: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } },
    mathematicalClaims: {
      type: 'array',
      minItems: 1,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          statement: { type: 'string' },
          canonicalStatement: { type: 'string' },
          validatorKey: { type: 'string' },
          expectedExpression: { type: 'string' },
          verificationStatus: { type: 'string', enum: ['unverified'] }
        },
        required: ['id', 'statement', 'validatorKey', 'expectedExpression', 'verificationStatus']
      }
    },
    pedagogicalSequence: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          stepNumber: { type: 'integer', minimum: 1 },
          pedagogicalGoal: { type: 'string' },
          intuitiveConcept: { type: 'string' },
          formalFormula: { type: 'string' },
          targetDurationSeconds: { type: 'number', minimum: 1, maximum: 60 }
        },
        required: ['stepNumber', 'pedagogicalGoal', 'intuitiveConcept', 'targetDurationSeconds']
      }
    },
    summary: { type: 'string' }
  },
  required: [
    'schemaVersion',
    'lessonId',
    'topicId',
    'title',
    'learningObjectives',
    'keyConcepts',
    'mathematicalClaims',
    'pedagogicalSequence',
    'summary'
  ]
} as const;

export const narrationPlanV2JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    planId: { type: 'string' },
    storyboardId: { type: 'string' },
    language: { type: 'string', enum: ['vi', 'en'] },
    segments: {
      type: 'array',
      minItems: 1,
      maxItems: 15,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          segmentId: { type: 'string' },
          sceneId: { type: 'string' },
          text: { type: 'string' },
          subtitleText: { type: 'string' },
          targetDurationSeconds: { type: 'number', minimum: 1, maximum: 120 }
        },
        required: ['segmentId', 'sceneId', 'text', 'subtitleText', 'targetDurationSeconds']
      }
    },
    totalWords: { type: 'integer', minimum: 1 },
    estimatedDurationSeconds: { type: 'number', minimum: 1 },
    mathematicalReview: {
      type: 'object',
      additionalProperties: false,
      properties: {
        status: { type: 'string', enum: ['verified', 'unverified'] },
        verifiedClaimIds: { type: 'array', items: { type: 'string' } }
      },
      required: ['status', 'verifiedClaimIds']
    }
  },
  required: ['planId', 'storyboardId', 'language', 'segments', 'totalWords', 'estimatedDurationSeconds', 'mathematicalReview']
} as const;

