import { VerifiedFormulaStepsDataV1Schema } from '@luminalearn/scene-schema';

export const sprintBFormulaFixtureV3 = VerifiedFormulaStepsDataV1Schema.parse({
  kind: 'verified_formula_steps',
  title: 'Khai triển bình phương của một tổng',
  validation: 'formally_verified',
  steps: [
    { stepId: 'identity_start', latex: '(a+b)^2', explanation: 'Viết bình phương thành tích hai nhân tử giống nhau.', highlightTerms: ['(a+b)'], claimIds: ['claim_identity_square_sum'], proofReferenceId: 'proof_identity_square_sum' },
    { stepId: 'identity_distribute', latex: '(a+b)(a+b)=a^2+ab+ba+b^2', explanation: 'Áp dụng tính phân phối cho từng hạng tử.', highlightTerms: ['ab', 'ba'], claimIds: ['claim_identity_square_sum'], proofReferenceId: 'proof_identity_square_sum' },
    { stepId: 'identity_combine', latex: 'a^2+ab+ba+b^2=a^2+2ab+b^2', explanation: 'Gộp hai hạng tử đồng dạng ab và ba.', highlightTerms: ['2ab'], claimIds: ['claim_identity_square_sum'], proofReferenceId: 'proof_identity_square_sum' }
  ]
});

