'use client';

import React, { useEffect, useRef, useState } from 'react';

type UiState = 'idle' | 'ingesting' | 'drafting' | 'saving' | 'reviewing' | 'submitting' | 'generating' | 'completed' | 'failed';
type InputMode = 'topic_prompt' | 'source_document';
type RenderMode = 'mock' | 'live';
type VoiceoverMode = 'none' | 'google_cloud_tts' | 'gemini_tts';
type VisualStyleId = 'math_chalkboard' | 'clean_educational_infographic';

interface JobStatus {
  jobId: string;
  status: 'queued' | 'planning' | 'validating' | 'rendering_manim' | 'narrating' | 'synthesizing_audio' | 'rendering_remotion' | 'completed' | 'failed' | 'interrupted';
  progress: number;
  message: string;
  renderMode: RenderMode;
  error?: string;
  videoUrl?: string;
  voiceoverMode: 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts';
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
  version: number;
  status: string;
  renderConfig?: {
    aspectRatio: '9:16' | '16:9' | '1:1';
    fps: number;
    renderMode: RenderMode;
    narrationMode: 'none' | 'provided_audio' | 'google_cloud_tts' | 'gemini_tts';
    visualStyleId: VisualStyleId;
    subtitlesEnabled: boolean;
  };
  estimatedApiBudget?: {
    livePlanningCallsMax: number;
    ttsCallsMax: number;
    externalApiRequired: boolean;
  };
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
      canonicalStatement?: string;
      validatorKey: string;
      expectedExpression: string;
      verificationStatus: 'verified' | 'unverified' | 'failed';
      statementVerification?: 'formal_match' | 'prose_unverified' | 'conflict_detected';
      humanSemanticReviewConfirmed?: boolean;
    }>;
  };
  mathVerification?: {
    status: 'verified' | 'failed' | 'needs_review';
    checkedClaims: Array<{ id: string; verificationStatus: string }>;
  };
  narrationPlan?: {
    segments: Array<{
      segmentId: string;
      sceneId: string;
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
  geminiTtsEnabled,
  googleTtsEnabled
}: {
  liveEnabled: boolean;
  geminiTtsEnabled: boolean;
  googleTtsEnabled: boolean;
}) {
  const [inputMode, setInputMode] = useState<InputMode>('topic_prompt');
  const [topic, setTopic] = useState('Đạo hàm là gì? — Từ cát tuyến đến tiếp tuyến');
  const [documentText, setDocumentText] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [ingestedDoc, setIngestedDoc] = useState<IngestedDocumentInfo | null>(null);
  const [draft, setDraft] = useState<LessonDraftInfo | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);

  const [renderMode, setRenderMode] = useState<RenderMode>('mock');
  const [voiceoverMode, setVoiceoverMode] = useState<VoiceoverMode>('none');
  const [visualStyleId, setVisualStyleId] = useState<VisualStyleId>('clean_educational_infographic');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [confirmExternalApi, setConfirmExternalApi] = useState(false);
  const [confirmSemanticReview, setConfirmSemanticReview] = useState(false);
  const [uiState, setUiState] = useState<UiState>('idle');
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const requiresExternalApi =
    renderMode === 'live' || voiceoverMode === 'gemini_tts' || voiceoverMode === 'google_cloud_tts';

  function syncControlsFromDraft(loaded: LessonDraftInfo): void {
    if (!loaded.renderConfig) return;
    setRenderMode(loaded.renderConfig.renderMode);
    if (
      loaded.renderConfig.narrationMode === 'none' ||
      loaded.renderConfig.narrationMode === 'gemini_tts' ||
      loaded.renderConfig.narrationMode === 'google_cloud_tts'
    ) {
      setVoiceoverMode(loaded.renderConfig.narrationMode);
    }
    setVisualStyleId(loaded.renderConfig.visualStyleId ?? 'clean_educational_infographic');
    setSubtitlesEnabled(loaded.renderConfig.subtitlesEnabled ?? true);
  }

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
      if (data.needsOcr) {
        setError(data.ocrReason || 'Tài liệu PDF là bản scan chưa có lớp văn bản (cần OCR).');
      }
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
    if (renderMode === 'live' && !confirmExternalApi) {
      setError('Vui lòng xác nhận sử dụng Gemini Live API trước khi tạo bản thảo ở chế độ Live.');
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
        visualStyleId,
        subtitlesEnabled,
        confirmExternalApi,
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
      syncControlsFromDraft(data);
      setDraftDirty(false);
      if (data.stage === 'needs_review') {
        setError(data.error?.message || 'Bản thảo cần giáo viên xác nhận ngữ nghĩa trước khi tiếp tục.');
      }
      setUiState('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUiState('failed');
    }
  }

  async function handleReloadDraft(): Promise<void> {
    if (!draft) return;
    setError(null);
    try {
      const response = await fetch(`/api/lessons/${draft.draftId}/draft`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Không thể tải lại bản thảo.');
      setDraft(payload);
      syncControlsFromDraft(payload);
      setDraftDirty(false);
      setUiState('reviewing');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function handleSaveDraft(): Promise<void> {
    if (!draft) return;
    setError(null);
    setUiState('saving');
    try {
      const narrationTexts = Object.fromEntries(
        (draft.narrationPlan?.segments ?? []).map((segment) => [segment.segmentId, {
          text: segment.text,
          subtitleText: segment.subtitleText
        }])
      );
      const response = await fetch(`/api/lessons/${draft.draftId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.lessonPlan.title,
          summary: draft.lessonPlan.summary,
          mathematicalClaims: draft.lessonPlan.mathematicalClaims,
          narrationTexts,
          renderMode,
          narrationMode: voiceoverMode,
          visualStyleId,
          subtitlesEnabled,
          humanSemanticReviewConfirmed: confirmSemanticReview ? true : undefined,
          note: 'User revised the lesson draft from the LuminaLearn V2.4.3 web review'
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Không thể lưu và xác minh lại bản thảo.');
      setDraft(payload);
      syncControlsFromDraft(payload);
      setDraftDirty(false);
      if (payload.mathVerification?.status === 'failed' || payload.error) {
        setError(payload.error?.message || 'Mệnh đề toán học không vượt qua kiểm định hình thức SymPy.');
      }
      setUiState('reviewing');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setUiState('failed');
    }
  }

  // Handle Draft Approval & Video Render
  async function handleApproveAndRender(): Promise<void> {
    if (!draft) return;
    if (requiresExternalApi && !confirmExternalApi) {
      setError('Vui lòng tích chọn xác nhận gọi API bên ngoài (Gemini Live / TTS) trước khi duyệt và render.');
      return;
    }

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
        body: JSON.stringify({
          note: 'Duyệt bài học từ giao diện web LuminaLearn V2.4.3',
          renderMode,
          narrationMode: voiceoverMode,
          visualStyleId,
          subtitlesEnabled,
          confirmExternalApi,
          confirmSemanticReview
        })
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

  const busy = uiState === 'submitting' || uiState === 'generating' || uiState === 'ingesting' || uiState === 'drafting' || uiState === 'saving';

  return (
    <section className="create-card" aria-labelledby="create-form-title">
      <div className="create-card-header">
        <h2 id="create-form-title" className="card-title">Tạo video Toán học V2.4.2</h2>
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
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="visual-style-select">
            Phong cách hình ảnh
          </label>
          <select
            id="visual-style-select"
            className="form-select"
            value={visualStyleId}
            disabled={busy}
            onChange={(event) => {
              setVisualStyleId(event.target.value as VisualStyleId);
              if (draft) setDraftDirty(true);
            }}
          >
            <option value="clean_educational_infographic">Đồ họa giáo dục tinh gọn</option>
            <option value="math_chalkboard">Bảng phấn toán học</option>
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
              onChange={() => {
                setRenderMode('mock');
                if (draft) setDraftDirty(true);
              }}
            />
            <span>
              <strong>Mock AI Engine (Mặc định an toàn)</strong>
              <small>Deterministic, xác minh SymPy offline — 0 cuộc gọi API ngoài</small>
            </span>
          </label>
          <label className={`mode-option ${renderMode === 'live' ? 'selected' : ''} ${!liveEnabled ? 'disabled' : ''}`}>
            <input
              type="radio"
              name="renderMode"
              checked={renderMode === 'live'}
              disabled={busy || !liveEnabled}
              onChange={() => {
                setRenderMode('live');
                if (draft) setDraftDirty(true);
              }}
            />
            <span>
              <strong>Gemini Live Multi-Agent (Opt-in)</strong>
              <small>{liveEnabled ? 'Structured Output (tối đa 4 request/job)' : 'Chưa cấu hình GEMINI_API_KEY'}</small>
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
              onChange={() => {
                setVoiceoverMode('none');
                if (draft) setDraftDirty(true);
              }}
            />
            <span>
              <strong>Không giọng đọc (Mặc định)</strong>
              <small>Video im tiếng, phụ đề đồng bộ — 0 cuộc gọi TTS</small>
            </span>
          </label>
          <label className={`mode-option ${voiceoverMode === 'gemini_tts' ? 'selected' : ''} ${!geminiTtsEnabled ? 'disabled' : ''}`}>
            <input
              type="radio"
              name="voiceoverMode"
              checked={voiceoverMode === 'gemini_tts'}
              disabled={busy || !geminiTtsEnabled}
              onChange={() => {
                setVoiceoverMode('gemini_tts');
                if (draft) setDraftDirty(true);
              }}
            />
            <span>
              <strong>Gemini TTS (Opt-in)</strong>
              <small>{geminiTtsEnabled ? 'Giọng Kore tiếng Việt (tối đa 5 request/job)' : 'Chưa cấu hình GEMINI_API_KEY'}</small>
            </span>
          </label>
          <label className={`mode-option ${voiceoverMode === 'google_cloud_tts' ? 'selected' : ''} ${!googleTtsEnabled ? 'disabled' : ''}`}>
            <input
              type="radio"
              name="voiceoverMode"
              checked={voiceoverMode === 'google_cloud_tts'}
              disabled={busy || !googleTtsEnabled}
              onChange={() => {
                setVoiceoverMode('google_cloud_tts');
                if (draft) setDraftDirty(true);
              }}
            />
            <span>
              <strong>Google Cloud TTS (Opt-in)</strong>
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
          onChange={(event) => {
            setSubtitlesEnabled(event.target.checked);
            if (draft) setDraftDirty(true);
          }}
        />
        <span>
          <strong>Burned-in subtitles</strong>
          <small>Phụ đề tiếng Việt đồng bộ từng phân đoạn cảnh; kiểm định an toàn hiển thị.</small>
        </span>
      </label>

      {requiresExternalApi ? (
        <div
          style={{
            marginTop: '12px',
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid #f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fontSize: '13px'
          }}
        >
          <strong style={{ color: '#fbbf24' }}>⚠️ Xác nhận sử dụng API ngoài & Ngân sách Quota (Free Tier Safety):</strong>
          <ul style={{ margin: '6px 0 8px 18px', color: 'var(--text-secondary)' }}>
            <li>Gemini Live Planning/Narration: <strong>{renderMode === 'live' ? 'BẬT (tối đa 4 request/job)' : 'TẮT (0 request)'}</strong></li>
            <li>Tổng hợp giọng đọc TTS: <strong>{voiceoverMode === 'gemini_tts' ? 'Gemini TTS (tối đa 5 request/job)' : voiceoverMode === 'google_cloud_tts' ? 'Google Cloud TTS' : 'TẮT'}</strong></li>
            <li>Phong cách hình ảnh: <code>{visualStyleId}</code> | Phụ đề: <strong>{subtitlesEnabled ? 'BẬT' : 'TẮT'}</strong></li>
          </ul>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={confirmExternalApi}
              disabled={busy}
              onChange={(e) => setConfirmExternalApi(e.target.checked)}
            />
            <span>Tôi xác nhận cho phép thực hiện các cuộc gọi API bên ngoài theo giới hạn ngân sách trên.</span>
          </label>
        </div>
      ) : null}

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
              Bản thảo bài học — phiên bản {draft.version}
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

          <label className="form-label" htmlFor="draft-title">Tiêu đề đã duyệt</label>
          <input
            id="draft-title"
            className="form-input"
            value={draft.lessonPlan.title}
            disabled={busy}
            onChange={(event) => {
              setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, title: event.target.value } });
              setDraftDirty(true);
            }}
          />
          <label className="form-label" htmlFor="draft-summary" style={{ marginTop: '10px' }}>Tóm tắt</label>
          <textarea
            id="draft-summary"
            className="form-textarea"
            rows={3}
            value={draft.lessonPlan.summary}
            disabled={busy}
            onChange={(event) => {
              setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, summary: event.target.value } });
              setDraftDirty(true);
            }}
          />

          <div style={{ marginBottom: '14px' }}>
            <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Mệnh đề toán học được kiểm định:</strong>
            <ul style={{ paddingLeft: '20px', marginTop: '6px', fontSize: '13px', color: 'var(--text-primary)' }}>
              {draft.lessonPlan.mathematicalClaims.map((claim, claimIndex) => (
                <li key={claim.id} style={{ marginBottom: '10px' }}>
                  <code>{claim.validatorKey}</code>
                  <input
                    className="form-input"
                    aria-label={`Mệnh đề ${claim.id}`}
                    value={claim.statement}
                    disabled={busy}
                    onChange={(event) => {
                      const mathematicalClaims = draft.lessonPlan.mathematicalClaims.map((item, index) => index === claimIndex ? { ...item, statement: event.target.value, verificationStatus: 'unverified' as const } : item);
                      setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, mathematicalClaims } });
                      setDraftDirty(true);
                    }}
                  />
                  <input
                    className="form-input"
                    aria-label={`Biểu thức ${claim.id}`}
                    value={claim.expectedExpression}
                    disabled={busy}
                    onChange={(event) => {
                      const mathematicalClaims = draft.lessonPlan.mathematicalClaims.map((item, index) => index === claimIndex ? { ...item, expectedExpression: event.target.value, verificationStatus: 'unverified' as const } : item);
                      setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, mathematicalClaims } });
                      setDraftDirty(true);
                    }}
                  />
                  <strong style={{ color: claim.verificationStatus === 'verified' ? '#4ade80' : '#f87171' }}>{claim.verificationStatus}</strong>
                  {claim.statementVerification ? (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      [{claim.statementVerification}]
                    </span>
                  ) : null}
                  {claim.canonicalStatement ? (
                    <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', marginTop: '2px' }}>
                      Canonical (SymPy): <code>{claim.canonicalStatement}</code>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {draft.lessonPlan.mathematicalClaims.some((c) => c.statementVerification === 'prose_unverified') ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', color: '#fbbf24' }}>
                <input
                  type="checkbox"
                  checked={confirmSemanticReview}
                  disabled={busy}
                  onChange={(e) => {
                    setConfirmSemanticReview(e.target.checked);
                    setDraftDirty(true);
                  }}
                />
                <span>Giáo viên xác nhận mệnh đề diễn giải tự do khớp ngữ nghĩa với biểu thức SymPy đã kiểm chứng.</span>
              </label>
            ) : null}
          </div>

          {draft.narrationPlan?.segments.length ? (
            <div style={{ marginBottom: '14px' }}>
              <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Lời dẫn và phụ đề:</strong>
              {draft.narrationPlan.segments.map((segment, segmentIndex) => (
                <div key={segment.segmentId} style={{ marginTop: '8px' }}>
                  <code>{segment.sceneId}</code>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    aria-label={`Lời dẫn ${segment.sceneId}`}
                    value={segment.text}
                    disabled={busy}
                    onChange={(event) => {
                      const segments = draft.narrationPlan!.segments.map((item, index) => index === segmentIndex ? { ...item, text: event.target.value } : item);
                      setDraft({ ...draft, narrationPlan: { ...draft.narrationPlan!, segments } });
                      setDraftDirty(true);
                    }}
                  />
                  <textarea
                    className="form-textarea"
                    rows={2}
                    aria-label={`Phụ đề ${segment.sceneId}`}
                    value={segment.subtitleText}
                    disabled={busy}
                    onChange={(event) => {
                      const segments = draft.narrationPlan!.segments.map((item, index) => index === segmentIndex ? { ...item, subtitleText: event.target.value } : item);
                      setDraft({ ...draft, narrationPlan: { ...draft.narrationPlan!, segments } });
                      setDraftDirty(true);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}

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

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn-generate"
              style={{ flex: 2 }}
              disabled={busy || !draftDirty}
              onClick={handleSaveDraft}
            >
              {uiState === 'saving' ? 'Đang lưu và xác minh lại…' : 'Lưu chỉnh sửa & chạy lại SymPy'}
            </button>
            <button
              type="button"
              className="quick-chip"
              style={{ flex: 1 }}
              disabled={busy}
              onClick={handleReloadDraft}
            >
              ↻ Khôi phục từ bản thảo đã lưu
            </button>
          </div>

          <button
            type="button"
            className="btn-generate"
            style={{ width: '100%', marginTop: '12px', backgroundColor: '#22c55e', borderColor: '#22c55e' }}
            disabled={busy || draftDirty || draft.mathVerification?.status !== 'verified'}
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
              {job.subtitlesEnabled ? (
                <a className="download-link" href={`/api/jobs/${job.jobId}/subtitles`}>
                  Tải phụ đề SRT
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
