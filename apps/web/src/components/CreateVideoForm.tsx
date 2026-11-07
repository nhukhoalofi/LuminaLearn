'use client';

import React, { useEffect, useRef, useState } from 'react';

type UiState = 'idle' | 'ingesting' | 'drafting' | 'reviewing' | 'submitting' | 'generating' | 'completed' | 'failed';
type InputMode = 'topic_prompt' | 'source_document';
type RenderMode = 'mock' | 'live';
type VoiceoverMode = 'none' | 'google_cloud_tts';

interface JobStatus {
  jobId: string;
  status: 'queued' | 'planning' | 'validating' | 'rendering_manim' | 'narrating' | 'synthesizing_audio' | 'rendering_remotion' | 'completed' | 'failed' | 'interrupted';
  progress: number;
  message: string;
  renderMode: RenderMode;
  error?: string;
  videoUrl?: string;
  voiceoverMode: 'none' | 'provided_audio' | 'google_cloud_tts';
  subtitlesEnabled: boolean;
  failureType?: 'ai' | 'tts' | 'validation' | 'render' | 'interrupted';
}

interface IngestedDocumentInfo {
  documentId: string;
  documentTitle: string;
  contentType: string;
  totalChunks: number;
  needsOcr: boolean;
  ocrReason?: string;
}

interface LessonDraftInfo {
  draftId: string;
  status: string;
  lessonPlan: {
    title: string;
    topicId: string;
    keyConcepts: string[];
    summary: string;
    pedagogicalSequence: Array<{
      stepNumber: number;
      pedagogicalGoal: string;
      intuitiveConcept: string;
      formalFormula?: string;
      targetDurationSeconds: number;
    }>;
    mathematicalClaims: Array<{
      id: string;
      statement: string;
      validatorKey: string;
      expectedExpression: string;
      verificationStatus: 'verified' | 'unverified' | 'failed';
    }>;
  };
  mathVerification?: {
    status: 'verified' | 'failed' | 'needs_review';
    checkedClaims: Array<{ id: string; verificationStatus: string }>;
  };
  narrationPlan?: {
    segments: Array<{
      segmentId: string;
      text: string;
      subtitleText: string;
      targetDurationSeconds: number;
    }>;
  };
}

const statusLabels: Record<JobStatus['status'], string> = {
  queued: 'Đang chờ render',
  planning: 'Gemini / Multi-Agent đang lập kế hoạch bài học',
  validating: 'SymPy đang xác minh hình thức công thức',
  rendering_manim: 'Manim đang render trực quan toán học',
  narrating: 'Đang tạo và rà soát lời dẫn toán học',
  synthesizing_audio: 'Đang tổng hợp giọng đọc và căn chỉnh âm thanh',
  rendering_remotion: 'Remotion đang tổng hợp video',
  completed: 'Video đã hoàn tất',
  failed: 'Tạo video thất bại',
  interrupted: 'Job bị gián đoạn khi server dừng'
};

export function CreateVideoForm({
  liveEnabled,
  googleTtsEnabled
}: {
  liveEnabled: boolean;
  googleTtsEnabled: boolean;
}) {
  const [inputMode, setInputMode] = useState<InputMode>('topic_prompt');
  const [topic, setTopic] = useState('Đạo hàm là gì? — Từ cát tuyến đến tiếp tuyến');
  const [documentText, setDocumentText] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [ingestedDoc, setIngestedDoc] = useState<IngestedDocumentInfo | null>(null);
  const [draft, setDraft] = useState<LessonDraftInfo | null>(null);

  const [renderMode, setRenderMode] = useState<RenderMode>('mock');
  const [voiceoverMode, setVoiceoverMode] = useState<VoiceoverMode>('none');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [uiState, setUiState] = useState<UiState>('idle');
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function pollJob(jobId: string, signal: AbortSignal): Promise<void> {
    for (let attempt = 0; attempt < 450 && !signal.aborted; attempt += 1) {
      const response = await fetch(`/api/jobs/${jobId}`, { signal, cache: 'no-store' });
      if (!response.ok) throw new Error('Không thể đọc trạng thái render.');
      const current = (await response.json()) as JobStatus;
      setJob(current);
      if (current.status === 'completed') {
        setUiState('completed');
        return;
      }
      if (current.status === 'failed' || current.status === 'interrupted') {
        throw new Error(current.error ?? 'Pipeline render thất bại.');
      }
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(resolve, 2000);
        signal.addEventListener(
          'abort',
          () => {
            window.clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true }
        );
      });
    }
    if (!signal.aborted) throw new Error('Job vượt quá thời gian theo dõi 15 phút.');
  }

  // Handle document upload / ingestion
  async function handleIngestDocument(): Promise<void> {
    if (!documentFile && !documentText.trim()) {
      setError('Vui lòng chọn file tài liệu (.md, .txt, .docx, .pdf) hoặc dán nội dung văn bản');
      return;
    }

    setError(null);
    setUiState('ingesting');

    try {
      let res: Response;
      if (documentFile) {
        const formData = new FormData();
        formData.append('file', documentFile);
        res = await fetch('/api/documents', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: documentText.trim(), filename: 'tai-lieu-giai-tich.md' })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Tải tài liệu thất bại');
      }

      setIngestedDoc(data);
      setUiState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUiState('failed');
    }
  }

  // Handle Draft Generation
  async function handleCreateDraft(): Promise<void> {
    if (inputMode === 'source_document' && !ingestedDoc) {
      setError('Vui lòng tải lên và phân tích tài liệu trước khi tạo bản thảo');
      return;
    }

    setError(null);
    setUiState('drafting');

    try {
      const payload = {
        topic: topic.trim(),
        inputMode,
        sourceDocumentIds: ingestedDoc ? [ingestedDoc.documentId] : [],
        audience: 'Học sinh phổ thông',
        language: 'vi',
        targetDurationSeconds: 40,
        renderMode,
        narrationMode: voiceoverMode,
        aspectRatio: '9:16'
      };

      const res = await fetch('/api/lessons/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Tạo bản thảo bài học thất bại');
      }

      setDraft(data);
      setUiState('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUiState('failed');
    }
  }

  // Handle Draft Approval & Video Render
  async function handleApproveAndRender(): Promise<void> {
    if (!draft) return;

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    setError(null);
    setUiState('submitting');

    try {
      const res = await fetch(`/api/lessons/${draft.draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ note: 'Duyệt bài học từ giao diện web LuminaLearn V2.2' })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Duyệt bản thảo thất bại');
      }

      setJob(data.job);
      setUiState('generating');
      await pollJob(data.job.jobId, controller.signal);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setUiState('failed');
    }
  }

  // Handle direct legacy submit (skip manual draft review)
  async function handleDirectSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (uiState === 'submitting' || uiState === 'generating' || uiState === 'drafting') return;

    if (!topic.trim()) {
      setError('Vui lòng nhập chủ đề video.');
      return;
    }

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setError(null);
    setJob(null);
    setUiState('submitting');

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          topic: topic.trim(),
          language: 'vi',
          durationSeconds: 40,
          renderMode,
          voiceoverMode,
          subtitlesEnabled
        })
      });

      const payload = (await response.json()) as JobStatus & { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(payload.details?.join(' ') ?? payload.error ?? 'Không thể tạo job.');
      }

      setJob(payload);
      setUiState('generating');
      await pollJob(payload.jobId, controller.signal);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setUiState('failed');
    }
  }

  const busy = uiState === 'submitting' || uiState === 'generating' || uiState === 'ingesting' || uiState === 'drafting';

  return (
    <section className="create-card" aria-labelledby="create-form-title">
      <div className="create-card-header">
        <h2 id="create-form-title" className="card-title">Tạo video Toán học V2.2</h2>
        <p className="card-subtitle">
          Chuyển đổi chủ đề hoặc tài liệu thành bài giảng video trực quan với AI Multi-Agent, SymPy Formal Verification và Manim Animation.
        </p>
      </div>

      {/* Input Mode Selector */}
      <div className="mode-options" style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`quick-chip ${inputMode === 'topic_prompt' ? 'selected' : ''}`}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            borderColor: inputMode === 'topic_prompt' ? 'var(--accent-cyan)' : 'var(--border-subtle)',
            backgroundColor: inputMode === 'topic_prompt' ? 'rgba(34, 211, 238, 0.15)' : 'transparent'
          }}
          onClick={() => {
            setInputMode('topic_prompt');
            setDraft(null);
          }}
        >
          💡 Nhập chủ đề trực tiếp (Prompt)
        </button>
        <button
          type="button"
          className={`quick-chip ${inputMode === 'source_document' ? 'selected' : ''}`}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            borderColor: inputMode === 'source_document' ? 'var(--accent-cyan)' : 'var(--border-subtle)',
            backgroundColor: inputMode === 'source_document' ? 'rgba(34, 211, 238, 0.15)' : 'transparent'
          }}
          onClick={() => {
            setInputMode('source_document');
            setDraft(null);
          }}
        >
          📄 Tài liệu nguồn (Document-to-Video)
        </button>
      </div>

      {/* Mode A: Prompt Input */}
      {inputMode === 'topic_prompt' ? (
        <div className="form-group">
          <label htmlFor="video-topic" className="form-label">
            Chủ đề bài học
          </label>
          <textarea
            id="video-topic"
            className={`form-textarea ${error ? 'has-error' : ''}`}
            value={topic}
            onChange={(event) => {
              setTopic(event.target.value);
              if (error) setError(null);
            }}
            rows={3}
            maxLength={300}
            disabled={busy}
            placeholder="Đạo hàm là gì? hoặc Tổng Riemann và tích phân"
          />
          <div className="quick-topics">
            <span className="quick-topics-label">Gợi ý bài giảng:</span>
            <button
              type="button"
              className="quick-chip"
              disabled={busy}
              onClick={() => setTopic('Đạo hàm là gì? — Từ cát tuyến đến tiếp tuyến')}
            >
              Đạo hàm: cát tuyến → tiếp tuyến
            </button>
            <button
              type="button"
              className="quick-chip"
              disabled={busy}
              onClick={() => setTopic('Tổng Riemann và trực giác tích phân')}
            >
              Tích phân: Tổng Riemann xấp xỉ diện tích
            </button>
          </div>
        </div>
      ) : (
        /* Mode B: Document Ingestion */
        <div className="form-group" style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <label className="form-label">Tài liệu học tập nguồn (.md, .txt, .docx, .pdf)</label>
          <input
            type="file"
            accept=".md,.txt,.docx,.pdf"
            disabled={busy}
            onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
            style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}
          />

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Hoặc dán nội dung văn bản/Markdown trực tiếp:
          </p>
          <textarea
            className="form-textarea"
            rows={4}
            value={documentText}
            placeholder="Dán nội dung bài đọc, giáo trình toán hoặc tài liệu trích dẫn..."
            disabled={busy}
            onChange={(e) => setDocumentText(e.target.value)}
          />

          <div style={{ marginTop: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="quick-chip"
              style={{ backgroundColor: 'var(--accent-blue)', color: '#000', fontWeight: 700 }}
              disabled={busy || (!documentFile && !documentText.trim())}
              onClick={handleIngestDocument}
            >
              {uiState === 'ingesting' ? 'Đang trích xuất tài liệu...' : '⚡ Phân tích & Trích xuất tài liệu'}
            </button>
            {ingestedDoc && (
              <span style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>
                ✅ Đã nạp: <strong>{ingestedDoc.documentTitle}</strong> ({ingestedDoc.totalChunks} đoạn)
                {ingestedDoc.needsOcr ? ' ⚠️ Cần OCR' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Settings Row */}
      <div className="form-grid-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="duration-select">
            Thời lượng
          </label>
          <select id="duration-select" className="form-select" value="40" disabled>
            <option value="40">40 giây (MVP)</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="language-select">
            Ngôn ngữ
          </label>
          <select id="language-select" className="form-select" value="vi" disabled>
            <option value="vi">Tiếng Việt</option>
          </select>
        </div>
      </div>

      <div className="form-group mode-group">
        <span className="form-label">Chế độ AI Multi-Agent</span>
        <div className="mode-options">
          <label className={`mode-option ${renderMode === 'mock' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="renderMode"
              checked={renderMode === 'mock'}
              disabled={busy}
              onChange={() => setRenderMode('mock')}
            />
            <span>
              <strong>Mock AI Engine</strong>
              <small>Deterministic, xác minh SymPy offline</small>
            </span>
          </label>
          <label className={`mode-option ${renderMode === 'live' ? 'selected' : ''} ${!liveEnabled ? 'disabled' : ''}`}>
            <input
              type="radio"
              name="renderMode"
              checked={renderMode === 'live'}
              disabled={busy || !liveEnabled}
              onChange={() => setRenderMode('live')}
            />
            <span>
              <strong>Gemini Live Multi-Agent</strong>
              <small>{liveEnabled ? 'Structured Output via Gemini 2.5 Flash' : 'Chưa cấu hình GEMINI_API_KEY'}</small>
            </span>
          </label>
        </div>
      </div>

      <div className="form-group mode-group">
        <span className="form-label">Giọng đọc & Âm thanh</span>
        <div className="mode-options voiceover-options">
          <label className={`mode-option ${voiceoverMode === 'none' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="voiceoverMode"
              checked={voiceoverMode === 'none'}
              disabled={busy}
              onChange={() => setVoiceoverMode('none')}
            />
            <span>
              <strong>Không giọng đọc</strong>
              <small>Video im tiếng, phụ đề đồng bộ</small>
            </span>
          </label>
          <label className={`mode-option ${voiceoverMode === 'google_cloud_tts' ? 'selected' : ''} ${!googleTtsEnabled ? 'disabled' : ''}`}>
            <input
              type="radio"
              name="voiceoverMode"
              checked={voiceoverMode === 'google_cloud_tts'}
              disabled={busy || !googleTtsEnabled}
              onChange={() => setVoiceoverMode('google_cloud_tts')}
            />
            <span>
              <strong>Google Cloud TTS</strong>
              <small>{googleTtsEnabled ? 'Neural2-A Tiếng Việt tự nhiên' : 'Chưa cấu hình Google Cloud'}</small>
            </span>
          </label>
        </div>
      </div>

      <label className="subtitle-toggle">
        <input
          type="checkbox"
          checked={subtitlesEnabled}
          disabled={busy}
          onChange={(event) => setSubtitlesEnabled(event.target.checked)}
        />
        <span>
          <strong>Burned-in subtitles</strong>
          <small>Phụ đề tiếng Việt đồng bộ từng phân đoạn cảnh; kiểm định an toàn hiển thị.</small>
        </span>
      </label>

      {/* Action Buttons: Draft Review or Direct Render */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
        <button
          type="button"
          className="btn-generate"
          style={{ flex: 1, backgroundColor: 'var(--accent-violet)', borderColor: 'var(--accent-violet)' }}
          disabled={busy || (inputMode === 'source_document' && !ingestedDoc)}
          onClick={handleCreateDraft}
        >
          {uiState === 'drafting' ? 'Đang tạo bản thảo...' : '📋 Xem trước bản thảo (Draft Review)'}
        </button>

        <button
          type="button"
          className="btn-generate"
          style={{ flex: 1 }}
          disabled={busy}
          onClick={handleDirectSubmit as unknown as React.MouseEventHandler}
        >
          {uiState === 'submitting' ? 'Đang tạo job…' : uiState === 'generating' ? 'Đang render video…' : '🚀 Xuất video trực tiếp'}
        </button>
      </div>

      {error ? (
        <p className="error-message" role="alert" style={{ marginTop: '1rem' }}>
          {error}
        </p>
      ) : null}

      {/* Draft Review Card */}
      {draft && (
        <div
          style={{
            marginTop: '2rem',
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-active)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              Bản thảo bài học: {draft.lessonPlan.title}
            </h3>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: draft.mathVerification?.status === 'verified' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: draft.mathVerification?.status === 'verified' ? '#4ade80' : '#f87171'
              }}
            >
              {draft.mathVerification?.status === 'verified' ? '✓ SymPy Verified' : '✗ Verification Failed'}
            </span>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            {draft.lessonPlan.summary}
          </p>

          <div style={{ marginBottom: '14px' }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Mệnh đề toán học được kiểm định:</strong>
            <ul style={{ paddingLeft: '20px', marginTop: '6px', fontSize: '13px', color: 'var(--text-primary)' }}>
              {draft.lessonPlan.mathematicalClaims.map((claim) => (
                <li key={claim.id} style={{ marginBottom: '4px' }}>
                  <code>{claim.validatorKey}</code>: <em>{claim.statement}</em> &rarr; Biểu thức: <code>{claim.expectedExpression}</code>
                  {' '}(<strong style={{ color: claim.verificationStatus === 'verified' ? '#4ade80' : '#f87171' }}>{claim.verificationStatus}</strong>)
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Các phân đoạn sư phạm ({draft.lessonPlan.pedagogicalSequence.length} cảnh):</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '6px' }}>
              {draft.lessonPlan.pedagogicalSequence.map((step) => (
                <div key={step.stepNumber} style={{ padding: '8px 12px', backgroundColor: 'var(--bg-input)', borderRadius: '8px', fontSize: '12px' }}>
                  <strong>Cảnh {step.stepNumber}: {step.pedagogicalGoal}</strong> ({step.targetDurationSeconds}s)
                  <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{step.intuitiveConcept}</p>
                  {step.formalFormula && <code style={{ color: 'var(--accent-violet)' }}>{step.formalFormula}</code>}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn-generate"
            style={{ width: '100%', marginTop: '12px', backgroundColor: '#22c55e', borderColor: '#22c55e' }}
            disabled={busy || draft.mathVerification?.status !== 'verified'}
            onClick={handleApproveAndRender}
          >
            {draft.mathVerification?.status === 'verified'
              ? '✅ Duyệt bản thảo & Render Video Remotion'
              : '❌ Không thể duyệt: Mệnh đề toán học chưa vượt qua SymPy'}
          </button>
        </div>
      )}

      {/* Job Progress & Video Result */}
      {job ? (
        <div className={`job-panel ${uiState === 'failed' ? 'failed' : ''}`} aria-live="polite">
          <div className="demo-banner-header">
            <span className="demo-badge">{job.renderMode === 'live' ? 'Gemini Live' : 'Mock AI Engine'}</span>
            <span className="demo-message">{statusLabels[job.status] ?? job.message}</span>
          </div>
          <div className="job-meta">
            <span>Job ID</span>
            <code>{job.jobId}</code>
          </div>
          <div className="job-capabilities">
            <span>{job.voiceoverMode === 'none' ? 'Không có voiceover' : 'Có voiceover TTS'}</span>
            <span>{job.subtitlesEnabled ? 'Có phụ đề' : 'Không phụ đề'}</span>
            {job.failureType ? <span>Lỗi: {job.failureType}</span> : null}
          </div>
          {job.status !== 'failed' ? (
            <div className="progress-track" aria-label={`Tiến độ ${job.progress}%`}>
              <div className="progress-fill" style={{ width: `${job.progress}%` }} />
            </div>
          ) : null}
          {job.status === 'completed' && job.videoUrl ? (
            <div className="video-result">
              <video controls preload="metadata" src={job.videoUrl}>
                Trình duyệt không hỗ trợ video MP4.
              </video>
              <a className="download-link" href={`${job.videoUrl}?download=1`}>
                Tải video MP4
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
