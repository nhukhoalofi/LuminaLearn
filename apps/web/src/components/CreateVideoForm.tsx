'use client';

import React, { useEffect, useRef, useState } from 'react';
import { detectDraftConflicts, type FieldConflict } from './conflict-utils';

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
  approvedArtifact?: {
    artifactId: string;
    renderConfig?: unknown;
  };
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

function vietnameseApiError(payload: unknown, fallback: string): string {
  const value = payload as { error?: string | { code?: string; message?: string }; message?: string } | undefined;
  const code = typeof value?.error === 'string' ? value.error : value?.error?.code;
  const message = value?.message ?? (typeof value?.error === 'object' ? value.error.message : undefined);
  const classification = `${code ?? ''} ${message ?? ''}`.toLowerCase();
  if (/gemini_transient_failed|service unavailable|temporarily unavailable|high demand|\b503\b|unavailable/.test(classification)) {
    return 'Gemini đang quá tải tạm thời (HTTP 503). Không có dữ liệu nào bị mất; vui lòng chờ vài giây rồi bấm tạo bản thảo lại. Nếu lỗi lặp lại, hãy chuyển sang Mock offline để tiếp tục mà không gọi API.';
  }
  if (/statement_requires_semantic_review|human semantic review|prose_unverified/.test(classification)) {
    return 'Các mệnh đề diễn giải tự do cần giáo viên xác nhận ngữ nghĩa. Vui lòng kiểm tra và tích chọn ô "Giáo viên xác nhận mệnh đề diễn giải tự do..." ở dưới danh sách mệnh đề trước khi duyệt.';
  }
  if (/sympy|math|mathematical|statement_expression|claim/.test(classification)) {
    return 'Mệnh đề toán học không vượt qua kiểm định SymPy. Hãy sửa công thức hoặc nội dung mệnh đề rồi lưu để xác minh lại.';
  }
  if (/source|ground|evidence|citation|document/.test(classification)) {
    return 'Tài liệu nguồn chưa cung cấp bằng chứng hợp lệ cho mọi mệnh đề toán học. Hãy bổ sung nguồn hoặc chỉnh lại nội dung bài học.';
  }
  if (/version_conflict/.test(classification)) {
    return 'Bản thảo đã được thay đổi ở nơi khác. Hãy tải lại phiên bản mới nhất trước khi tiếp tục.';
  }
  if (/queue_full|job_queue_full/.test(classification)) {
    return 'Bản thảo đã được duyệt thành công, nhưng hàng đợi kết xuất video hiện đang bận (tối đa 3 jobs). Bạn có thể nhấn Duyệt lại để thử lại khi hệ thống rảnh.';
  }
  if (/approved_draft_configuration_conflict/.test(classification)) {
    return 'Bản thảo này đã được duyệt trước đó với cấu hình khác. Để thay đổi cấu hình, vui lòng chỉnh sửa nội dung bản thảo để tạo phiên bản mới.';
  }
  if (/tts_model_unavailable|model.*not.*found.*tts|model is not found: models\/gemini/.test(classification)) {
    return 'Mô hình Gemini TTS chưa khả dụng trên Google AI Studio API key hiện tại (Google chưa mở model TTS công khai trên endpoint này). Khuyến nghị: Chọn "Không giọng đọc (Mặc định)" kèm "Phụ đề tiếng Việt đồng bộ" để kết xuất video ngay lập tức.';
  }
  if (/tts_quota_exceeded|tts.*quota|resource_exhausted/.test(classification)) {
    return 'Đã vượt quá hạn mức gọi Gemini TTS API. Vui lòng chọn "Không giọng đọc (Mặc định)" để tiếp tục tạo video.';
  }
  if (/tts_api_key_missing/.test(classification)) {
    return 'Chưa cấu hình GEMINI_API_KEY cho dịch vụ Gemini TTS. Vui lòng chọn "Không giọng đọc (Mặc định)" để tiếp tục.';
  }
  return message || fallback;
}

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
  const [conflictInfo, setConflictInfo] = useState<{
    serverVersion: number;
    localVersion: number;
    serverDraft: LessonDraftInfo;
    conflicts: FieldConflict[];
  } | null>(null);
  const [uiState, setUiState] = useState<UiState>('idle');
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    const draftId = window.localStorage.getItem('lumina:lastDraftId');
    if (!draftId) return;
    let active = true;
    void fetch(`/api/lessons/${encodeURIComponent(draftId)}/draft`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('saved_draft_unavailable');
        return response.json() as Promise<LessonDraftInfo>;
      })
      .then((loaded) => {
        if (!active) return;
        setDraft(loaded);
        syncControlsFromDraft(loaded);
        setDraftDirty(false);
        setUiState('reviewing');
      })
      .catch(() => window.localStorage.removeItem('lumina:lastDraftId'));
    return () => { active = false; };
  }, []);

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
        throw new Error(vietnameseApiError(data, 'Tạo bản thảo bài học thất bại'));
      }

      setDraft(data);
      window.localStorage.setItem('lumina:lastDraftId', data.draftId);
      syncControlsFromDraft(data);
      setDraftDirty(false);
      if (data.stage === 'needs_review') {
        setError(null);
      }
      setUiState('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUiState('failed');
    }
  }

  async function handleFallbackToMock(): Promise<void> {
    setRenderMode('mock');
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
        renderMode: 'mock' as const,
        narrationMode: voiceoverMode === 'gemini_tts' ? 'none' : voiceoverMode,
        visualStyleId,
        subtitlesEnabled,
        confirmExternalApi: false,
        aspectRatio: '9:16'
      };

      const res = await fetch('/api/lessons/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(vietnameseApiError(data, 'Tạo bản thảo bài học thất bại'));
      }

      setDraft(data);
      window.localStorage.setItem('lumina:lastDraftId', data.draftId);
      syncControlsFromDraft(data);
      setDraftDirty(false);
      if (data.stage === 'needs_review') {
        setError(null);
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

  function handleAcceptServerDraft(): void {
    if (!conflictInfo) return;
    setDraft(conflictInfo.serverDraft);
    syncControlsFromDraft(conflictInfo.serverDraft);
    setDraftDirty(false);
    setConflictInfo(null);
    setError(null);
  }

  async function handleForceSaveLocal(): Promise<void> {
    if (!conflictInfo || !draft) return;
    const targetVer = conflictInfo.serverVersion;
    setConflictInfo(null);
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
          expectedVersion: targetVer,
          note: `Teacher explicitly forced local edits over server version v${targetVer}`
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(vietnameseApiError(payload, 'Không thể lưu bản thảo sau khi giải quyết xung đột.'));
      }
      setDraft(payload);
      syncControlsFromDraft(payload);
      setDraftDirty(false);
      setUiState('reviewing');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setUiState('failed');
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
          expectedVersion: draft.version,
          note: 'User revised the lesson draft from the LuminaLearn V2.4.3 web review'
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409 && payload.currentVersion) {
          // Checkpoint B: Safe Concurrency Conflict Resolution
          try {
            const serverRes = await fetch(`/api/lessons/${encodeURIComponent(draft.draftId)}/draft`, { cache: 'no-store' });
            if (serverRes.ok) {
              const serverDraft = (await serverRes.json()) as LessonDraftInfo;
              const conflicts = detectDraftConflicts(draft, serverDraft);
              setConflictInfo({
                serverVersion: serverDraft.version,
                localVersion: draft.version,
                serverDraft,
                conflicts
              });
              setError(`Xung đột phiên bản: Bản thảo đã được sửa đổi ở phiên khác (v${draft.version} → v${serverDraft.version}). Vui lòng đối chiếu các trường khác biệt bên dưới trước khi quyết định.`);
              setUiState('reviewing');
              return;
            }
          } catch {
            // fallback
          }
          setError(`Xung đột phiên bản: Máy chủ hiện ở v${payload.currentVersion}. Vui lòng tải lại bản thảo.`);
          setUiState('reviewing');
          return;
        }
        throw new Error(vietnameseApiError(payload, 'Không thể lưu và xác minh lại bản thảo.'));
      }
      setDraft(payload);
      syncControlsFromDraft(payload);
      setDraftDirty(false);
      setConflictInfo(null);
      if (
        payload.mathVerification?.status === 'failed' ||
        (payload.error && payload.stage !== 'needs_review' && payload.status !== 'reviewing')
      ) {
        setError(vietnameseApiError(payload, 'Mệnh đề toán học không vượt qua kiểm định hình thức SymPy.'));
      } else {
        setError(null);
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
    if (conflictInfo) {
      setError('Vui lòng giải quyết xung đột phiên bản trước khi duyệt bản thảo.');
      return;
    }
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
          confirmSemanticReview,
          expectedVersion: draft.version
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.approved && data.currentVersion) {
          // Approval succeeded, but enqueueing failed (e.g. queue full 429)
          setDraft((prev) => prev ? {
            ...prev,
            version: data.currentVersion,
            status: 'approved',
            approvedArtifact: data.artifactId ? {
              artifactId: data.artifactId,
              renderConfig: data.renderConfig
            } as never : prev.approvedArtifact
          } : prev);
          setError(vietnameseApiError(data, 'Duyệt bản thảo thành công nhưng xếp hàng render thất bại.'));
          setUiState('reviewing');
          return;
        }
        if (res.status === 409 && data.currentVersion) {
          // Safe conflict handling on approve
          try {
            const serverRes = await fetch(`/api/lessons/${encodeURIComponent(draft.draftId)}/draft`, { cache: 'no-store' });
            if (serverRes.ok) {
              const serverDraft = (await serverRes.json()) as LessonDraftInfo;
              const conflicts = detectDraftConflicts(draft, serverDraft);
              setConflictInfo({
                serverVersion: serverDraft.version,
                localVersion: draft.version,
                serverDraft,
                conflicts
              });
              setError(`Không thể duyệt: Bản thảo đã được sửa đổi trên máy chủ lên v${serverDraft.version}. Vui lòng xem các trường xung đột bên dưới trước khi tiếp tục.`);
              setUiState('reviewing');
              return;
            }
          } catch {
            // fallback
          }
          setError(`Xung đột phiên bản khi duyệt: Bản thảo đã ở v${data.currentVersion}.`);
          setUiState('reviewing');
          return;
        }
        throw new Error(vietnameseApiError(data, 'Duyệt bản thảo thất bại'));
      }

      setConflictInfo(null);
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
            window.localStorage.removeItem('lumina:lastDraftId');
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
            window.localStorage.removeItem('lumina:lastDraftId');
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
          <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Trạng thái năng lực kết xuất:</span>
            {/cát tuyến|tiếp tuyến|đạo hàm|riemann|tích phân/i.test(topic) ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)' }}>
                🎬 Render-Ready (Remotion + Manim)
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                📋 Planning & Pedagogical Review (Phase 2 Visual Engine)
              </span>
            )}
          </div>
          <div className="quick-topics" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span className="quick-topics-label" style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>📐 Toán học (Mathematics):</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
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
                <button
                  type="button"
                  className="quick-chip"
                  disabled={busy}
                  onClick={() => setTopic('Biến đổi không gian 2D bằng ma trận đại số tuyến tính')}
                >
                  Đại số tuyến tính: Biến đổi ma trận 2D
                </button>
              </div>
            </div>
            <div>
              <span className="quick-topics-label" style={{ fontWeight: 600, color: 'var(--accent-violet)' }}>🤖 Trí tuệ nhân tạo (AI & Machine Learning):</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="quick-chip"
                  disabled={busy}
                  onClick={() => setTopic('Mô hình Perceptron và các hàm kích hoạt Sigmoid, ReLU')}
                >
                  Perceptron & Hàm kích hoạt
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  disabled={busy}
                  onClick={() => setTopic('Tối ưu hóa Gradient Descent và bề mặt hàm mất mát Loss Function')}
                >
                  Gradient Descent & Hàm mất mát
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  disabled={busy}
                  onClick={() => setTopic('Cơ chế Self-Attention và kiến trúc mạng Transformer')}
                >
                  Transformer: Cơ chế Self-Attention
                </button>
              </div>
            </div>
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
        <div style={{ marginTop: '1rem' }}>
          <p className="error-message" role="alert">
            {error}
          </p>
          {(error.includes('503') || error.includes('quá tải') || error.includes('gemini_transient_failed') || error.includes('Gemini') || error.includes('High Demand') || error.includes('thất bại')) && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '8px' }}
                disabled={busy}
                onClick={handleCreateDraft}
              >
                🔄 Thử lại
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(34, 211, 238, 0.15)',
                  color: '#22d3ee',
                  borderColor: 'rgba(34, 211, 238, 0.4)',
                  fontWeight: 600
                }}
                disabled={busy}
                onClick={handleFallbackToMock}
              >
                ⚙️ Chuyển sang Mock offline (Khuyến nghị)
              </button>
            </div>
          )}
        </div>
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
          {conflictInfo && (
            <div
              style={{
                marginBottom: '18px',
                padding: '16px',
                borderRadius: '12px',
                border: '2px solid #ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <strong style={{ color: '#f87171', fontSize: '15px' }}>
                  Xung đột phiên bản: Bản thảo đã được sửa đổi ở phiên khác (v{conflictInfo.localVersion} → v{conflictInfo.serverVersion})
                </strong>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Để tránh ghi đè âm thầm, vui lòng kiểm tra các trường khác biệt dưới đây trước khi quyết định:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {conflictInfo.conflicts.map((c) => (
                  <div
                    key={c.field}
                    style={{
                      padding: '10px',
                      backgroundColor: 'var(--bg-input)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  >
                    <strong style={{ color: 'var(--accent-cyan)' }}>{c.label}:</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                      <div style={{ padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <span style={{ color: '#fca5a5', fontWeight: 600 }}>Bản sửa chưa lưu của bạn:</span>
                        <p style={{ marginTop: '2px', wordBreak: 'break-word' }}>{c.localValue}</p>
                      </div>
                      <div style={{ padding: '6px', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                        <span style={{ color: '#86efac', fontWeight: 600 }}>Bản mới nhất trên máy chủ:</span>
                        <p style={{ marginTop: '2px', wordBreak: 'break-word' }}>{c.serverValue}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="quick-chip"
                  style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.25)', borderColor: '#3b82f6', color: '#fff', fontWeight: 700 }}
                  disabled={busy}
                  onClick={handleAcceptServerDraft}
                >
                  📥 Tải lại phiên bản máy chủ (Bỏ thay đổi hiện tại)
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  style={{ flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.25)', borderColor: '#ef4444', color: '#fff', fontWeight: 700 }}
                  disabled={busy}
                  onClick={handleForceSaveLocal}
                >
                  ⚠️ Xác nhận ghi đè bằng bản sửa của tôi
                </button>
              </div>
            </div>
          )}

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
                backgroundColor:
                  draft.mathVerification?.status === 'failed'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : draft.mathVerification?.status === 'verified'
                    ? 'rgba(34, 197, 94, 0.2)'
                    : 'rgba(245, 158, 11, 0.2)',
                color:
                  draft.mathVerification?.status === 'failed'
                    ? '#f87171'
                    : draft.mathVerification?.status === 'verified'
                    ? '#4ade80'
                    : '#fbbf24'
              }}
            >
              {draft.mathVerification?.status === 'failed'
                ? '✗ Verification Failed'
                : draft.mathVerification?.status === 'verified'
                ? '✓ SymPy Verified'
                : '⚠️ Cần giáo viên xác nhận (Needs Review)'}
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
            disabled={
              busy ||
              draftDirty ||
              Boolean(conflictInfo) ||
              !(
                draft.mathVerification?.status === 'verified' ||
                (draft.mathVerification?.status === 'needs_review' && confirmSemanticReview)
              )
            }
            onClick={handleApproveAndRender}
          >
            {draft.mathVerification?.status === 'verified'
              ? (draft.status === 'approved' ? '🚀 Kết xuất video (Bản thảo đã duyệt)' : '✅ Duyệt bản thảo & Render Video Remotion')
              : draft.mathVerification?.status === 'needs_review'
              ? (confirmSemanticReview
                  ? '✅ Duyệt bản thảo (đã xác nhận ngữ nghĩa) & Render Video Remotion'
                  : '⚠️ Cần tích ô xác nhận ngữ nghĩa mệnh đề bên dưới trước khi duyệt')
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
          {job.error ? (
            <div style={{ marginTop: '8px' }}>
              <p className="error-message" role="alert" style={{ fontSize: '13px', margin: 0 }}>
                {/tts_model_unavailable|model is not found: models\/gemini|failuretype:?\s*tts/i.test(job.error) || job.failureType === 'tts'
                  ? 'Lỗi TTS: Mô hình Gemini TTS chưa mở công khai trên Google AI Studio API key hiện tại. Vui lòng chuyển tùy chọn sang "Không giọng đọc (Mặc định)" để kết xuất video có phụ đề tiếng Việt thành công.'
                  : job.error}
              </p>
              {job.failureType === 'tts' || /tts/i.test(job.error) ? (
                <button
                  type="button"
                  style={{
                    marginTop: '10px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'rgba(34, 211, 238, 0.15)',
                    border: '1px solid var(--accent-cyan)',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setVoiceoverMode('none');
                    setError(null);
                    setJob(null);
                    setUiState('reviewing');
                  }}
                >
                  🔄 Chuyển sang "Không giọng đọc" (giữ phụ đề) để kết xuất ngay
                </button>
              ) : null}
            </div>
          ) : job.failureType === 'tts' ? (
            <div style={{ marginTop: '8px' }}>
              <p className="error-message" role="alert" style={{ fontSize: '13px', margin: 0 }}>
                Lỗi TTS: Dịch vụ Gemini TTS không khả dụng trên API key hiện tại. Vui lòng chuyển sang "Không giọng đọc (Mặc định)" để tiếp tục.
              </p>
              <button
                type="button"
                style={{
                  marginTop: '10px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(34, 211, 238, 0.15)',
                  border: '1px solid var(--accent-cyan)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setVoiceoverMode('none');
                  setError(null);
                  setJob(null);
                  setUiState('reviewing');
                }}
              >
                🔄 Chuyển sang "Không giọng đọc" (giữ phụ đề) để kết xuất ngay
              </button>
            </div>
          ) : null}
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
