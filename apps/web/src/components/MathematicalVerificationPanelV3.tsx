'use client';

import React from 'react';

export interface MathPanelProps {
  claims: Array<{
    id: string;
    statement: string;
    verificationStatus: string;
    claimType: string;
    formalExpression?: string;
    formalProofSummary?: string;
  }>;
  onUpdateClaim: (claimId: string, statement: string) => void;
  hasMathChanges?: boolean;
}

export function MathematicalVerificationPanelV3({
  claims,
  onUpdateClaim,
  hasMathChanges = false
}: MathPanelProps) {
  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '14px',
        background: 'rgba(15, 23, 42, 0.7)',
        borderRadius: '8px',
        border: '1px solid rgba(148, 163, 184, 0.15)'
      }}
      data-testid="v3-math-panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', color: '#F8FAFC' }}>
          📐 Tính toàn vẹn toán học & Mệnh đề giáo dục (SymPy Proof Gate)
        </h3>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
          {claims.length} mệnh đề
        </span>
      </div>

      {hasMathChanges && (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            marginBottom: '12px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '6px',
            color: '#FDE68A',
            fontSize: '12px'
          }}
        >
          <strong>⚠️ Cảnh báo vô hiệu bằng chứng (Proof Invalidation Warning):</strong>
          <span style={{ display: 'block', marginTop: '2px' }}>
            Biểu thức toán học đã được chỉnh sửa trong phân cảnh. Các chứng minh SymPy trước đó không còn hiệu lực.
            Vui lòng nhấn <strong>&ldquo;Lưu &amp; tái kiểm định&rdquo;</strong> để bộ kiểm toán hình thức SymPy xác minh lại trước khi phê duyệt!
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {claims.map((claim) => {
          const isVerified = claim.verificationStatus === 'formally_verified' || claim.verificationStatus === 'source_grounded';
          const isRejected = claim.verificationStatus === 'rejected';

          return (
            <div
              key={claim.id}
              style={{
                padding: '10px',
                borderRadius: '6px',
                background: 'rgba(30, 41, 59, 0.5)',
                border: isVerified
                  ? '1px solid rgba(74, 222, 128, 0.3)'
                  : isRejected
                  ? '1px solid rgba(248, 113, 113, 0.4)'
                  : '1px solid rgba(251, 191, 36, 0.3)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' }}>
                <strong style={{ color: '#93C5FD' }}>{claim.id}</strong>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    background: isVerified
                      ? 'rgba(74, 222, 128, 0.15)'
                      : isRejected
                      ? 'rgba(248, 113, 113, 0.15)'
                      : 'rgba(251, 191, 36, 0.15)',
                    color: isVerified ? '#4ADE80' : isRejected ? '#F87171' : '#FBBF24'
                  }}
                >
                  {claim.verificationStatus}
                </span>
              </div>

              <textarea
                className="form-textarea"
                aria-label={`Mệnh đề V3 ${claim.id}`}
                value={claim.statement}
                rows={2}
                style={{ fontSize: '12px', marginBottom: '6px' }}
                onChange={(e) => onUpdateClaim(claim.id, e.target.value)}
              />

              {claim.formalExpression && (
                <div style={{ fontSize: '11px', color: '#E2E8F0', marginTop: '4px' }}>
                  <span style={{ color: '#94A3B8' }}>Biểu thức hình thức: </span>
                  <code style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '2px 6px', borderRadius: '4px', color: '#38BDF8' }}>
                    {claim.formalExpression}
                  </code>
                </div>
              )}

              {claim.formalProofSummary && (
                <div style={{ fontSize: '11px', color: '#4ADE80', marginTop: '4px' }}>
                  ✓ {claim.formalProofSummary}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

