'use client';

import React, { useState } from 'react';
import { visualRegistryV3 } from '@luminalearn/scene-schema';

export interface VisualPropsPanelProps {
  sceneType: string;
  visualPayload: any;
  onChange: (updatedPayload: any) => void;
  onMathModified?: () => void;
}

export function VisualPropertyPanelV3({
  sceneType,
  visualPayload,
  onChange,
  onMathModified
}: VisualPropsPanelProps) {
  const [showJsonFallback, setShowJsonFallback] = useState(false);
  const [jsonError, setJsonError] = useState('');

  // Validate payload against registry
  const validation = visualRegistryV3.validatePayload(sceneType, visualPayload);

  function handleAlgebraFieldChange(field: string, value: any) {
    const updated = { ...visualPayload, [field]: value };
    onChange(updated);
    if (field === 'leftExpression' || field === 'rightExpression' || field === 'transformationSteps' || field === 'identityId') {
      onMathModified?.();
    }
  }

  function handleStepChange(index: number, expr: string, expl: string) {
    const steps = [...(visualPayload.transformationSteps || [])];
    steps[index] = { ...steps[index], expression: expr, explanationVietnamese: expl };
    const updated = { ...visualPayload, transformationSteps: steps };
    onChange(updated);
    onMathModified?.();
  }

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.7)',
        borderRadius: '8px',
        border: '1px solid rgba(148, 163, 184, 0.2)'
      }}
      data-testid="v3-visual-property-panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <strong style={{ fontSize: '13px', color: '#38BDF8' }}>
          🎨 Thuộc tính trực quan typed: {sceneType}
        </strong>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: validation.success ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
              color: validation.success ? '#4ADE80' : '#F87171'
            }}
          >
            {validation.success ? '✓ Schema Hợp lệ' : '! Lỗi Schema'}
          </span>
          <button
            type="button"
            className="quick-chip"
            style={{ fontSize: '10px', padding: '2px 6px' }}
            onClick={() => setShowJsonFallback(!showJsonFallback)}
          >
            {showJsonFallback ? 'Đóng JSON' : 'Mở JSON'}
          </button>
        </div>
      </div>

      {!validation.success && (
        <div style={{ fontSize: '11px', color: '#F87171', marginBottom: '8px', background: 'rgba(248, 113, 113, 0.1)', padding: '6px', borderRadius: '4px' }}>
          {validation.error}
        </div>
      )}

      {/* 1. Algebra Identity Specialized Form */}
      {sceneType === 'algebra_identity' && visualPayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Vế trái (Left Expression)</label>
              <input
                className="form-input"
                value={visualPayload.leftExpression || ''}
                onChange={(e) => handleAlgebraFieldChange('leftExpression', e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Vế phải (Right Expression)</label>
              <input
                className="form-input"
                value={visualPayload.rightExpression || ''}
                onChange={(e) => handleAlgebraFieldChange('rightExpression', e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Hình thức trình bày</label>
              <select
                className="form-input"
                value={visualPayload.presentation || 'expansion'}
                onChange={(e) => handleAlgebraFieldChange('presentation', e.target.value)}
              >
                <option value="expansion">Khai triển (Expansion)</option>
                <option value="factorization">Phân tích đa thức thành nhân tử (Factorization)</option>
                <option value="comparison">So sánh đối chiếu (Comparison)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Hằng đẳng thức (Identity ID)</label>
              <select
                className="form-input"
                value={visualPayload.identityId || 'square_sum'}
                onChange={(e) => handleAlgebraFieldChange('identityId', e.target.value)}
              >
                <option value="square_sum">(a + b)² Bình phương một tổng</option>
                <option value="square_difference">(a - b)² Bình phương một hiệu</option>
                <option value="difference_squares">a² - b² Hiệu hai bình phương</option>
                <option value="cube_sum_expansion">(a + b)³ Lập phương một tổng</option>
                <option value="cube_difference_expansion">(a - b)³ Lập phương một hiệu</option>
                <option value="sum_cubes">a³ + b³ Tổng hai lập phương</option>
                <option value="difference_cubes">a³ - b³ Hiệu hai lập phương</option>
              </select>
            </div>
          </div>

          <label style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
            Các bước biến đổi trung gian ({visualPayload.transformationSteps?.length ?? 0} bước):
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {visualPayload.transformationSteps?.map((step: any, sIdx: number) => (
              <div key={sIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748B', minWidth: '16px' }}>{sIdx + 1}.</span>
                <input
                  className="form-input"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                  value={step.expression}
                  onChange={(e) => handleStepChange(sIdx, e.target.value, step.explanationVietnamese)}
                />
                <input
                  className="form-input"
                  style={{ flex: 1.5, fontSize: '11px' }}
                  value={step.explanationVietnamese}
                  onChange={(e) => handleStepChange(sIdx, step.expression, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Concept Intro Form */}
      {sceneType === 'concept_intro' && visualPayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#94A3B8' }}>Câu hỏi trọng tâm (Central Question)</label>
            <input
              className="form-input"
              value={visualPayload.centralQuestion || ''}
              onChange={(e) => onChange({ ...visualPayload, centralQuestion: e.target.value })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Khái niệm then chốt (Key Concept)</label>
              <input
                className="form-input"
                value={visualPayload.keyConcept || ''}
                onChange={(e) => onChange({ ...visualPayload, keyConcept: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Màu nhấn (Accent Color)</label>
              <input
                type="color"
                className="form-input"
                style={{ height: '36px', padding: '2px' }}
                value={visualPayload.accentColor || '#22D3EE'}
                onChange={(e) => onChange({ ...visualPayload, accentColor: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Neural Architecture Form */}
      {sceneType === 'neural_architecture' && visualPayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Loại mạng nơ-ron</label>
              <select
                className="form-input"
                value={visualPayload.networkType || 'perceptron'}
                onChange={(e) => onChange({ ...visualPayload, networkType: e.target.value })}
              >
                <option value="perceptron">Perceptron đơn lớp</option>
                <option value="feedforward">Mạng truyền thẳng Feedforward</option>
                <option value="dense">Mạng dày đặc Dense</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Chế độ tín hiệu (Signal Mode)</label>
              <select
                className="form-input"
                value={visualPayload.signalMode || 'signal_flow_illustration'}
                onChange={(e) => onChange({ ...visualPayload, signalMode: e.target.value })}
              >
                <option value="signal_flow_illustration">Minh họa luồng tín hiệu (Illustration)</option>
                <option value="computed_forward_pass">Tính toán Forward Pass chính xác</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 4. Loss Landscape Form */}
      {sceneType === 'loss_landscape' && visualPayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Hàm mất mát (Function Type)</label>
              <select
                className="form-input"
                value={visualPayload.functionType || 'convex_quadratic'}
                onChange={(e) => onChange({ ...visualPayload, functionType: e.target.value })}
              >
                <option value="convex_quadratic">Parabol lồi (Convex Quadratic)</option>
                <option value="1d_curve">Đường cong một chiều (1D Curve)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#94A3B8' }}>Tốc độ học (Learning Rate)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={visualPayload.learningRate ?? 0.1}
                onChange={(e) => onChange({ ...visualPayload, learningRate: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Summary Form */}
      {sceneType === 'summary' && visualPayload && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: '#94A3B8' }}>Tiêu đề tổng kết</label>
            <input
              className="form-input"
              value={visualPayload.title || ''}
              onChange={(e) => onChange({ ...visualPayload, title: e.target.value })}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: '#94A3B8' }}>Thông điệp kết luận (Final Callout)</label>
            <input
              className="form-input"
              value={visualPayload.finalCallout || ''}
              onChange={(e) => onChange({ ...visualPayload, finalCallout: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* JSON Editor Fallback */}
      {showJsonFallback && (
        <div style={{ marginTop: '10px' }}>
          <label style={{ fontSize: '11px', color: '#94A3B8' }}>Chỉnh sửa trực tiếp JSON:</label>
          <textarea
            className="form-textarea"
            style={{ fontFamily: 'monospace', fontSize: '11px' }}
            rows={6}
            value={JSON.stringify(visualPayload, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
                onMathModified?.();
                setJsonError('');
              } catch (err) {
                setJsonError('JSON không hợp lệ');
              }
            }}
          />
          {jsonError && <span style={{ fontSize: '11px', color: '#F87171' }}>{jsonError}</span>}
        </div>
      )}
    </div>
  );
}

