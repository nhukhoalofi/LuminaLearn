'use client';

import React, { useEffect, useRef, useState } from 'react';

type UiState = 'idle' | 'submitting' | 'generating' | 'completed' | 'failed';
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

const statusLabels: Record<JobStatus['status'], string> = {
  queued: 'Đang chờ render', planning: 'Gemini/Mock đang lập kế hoạch bài học',
  validating: 'SymPy đang xác minh công thức', rendering_manim: 'Manim đang dựng trực quan toán học',
  narrating: 'Đang tạo và rà soát lời dẫn Toán học', synthesizing_audio: 'Đang tổng hợp và kiểm tra giọng đọc',
  rendering_remotion: 'Remotion đang tổng hợp video 40 giây', completed: 'Video đã hoàn tất', failed: 'Tạo video thất bại',
  interrupted: 'Job bị gián đoạn khi server dừng'
};

export function CreateVideoForm({ liveEnabled, googleTtsEnabled }: { liveEnabled: boolean; googleTtsEnabled: boolean }) {
  const [topic, setTopic] = useState('Đạo hàm là gì?');
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
      const current = await response.json() as JobStatus;
      setJob(current);
      if (current.status === 'completed') { setUiState('completed'); return; }
      if (current.status === 'failed' || current.status === 'interrupted') throw new Error(current.error ?? 'Pipeline render thất bại.');
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(resolve, 2000);
        signal.addEventListener('abort', () => { window.clearTimeout(timeout); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
      });
    }
    if (!signal.aborted) throw new Error('Job vượt quá thời gian theo dõi 15 phút.');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (uiState === 'submitting' || uiState === 'generating') return;
    if (!topic.trim()) { setError('Vui lòng nhập chủ đề video.'); return; }
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setError(null); setJob(null); setUiState('submitting');
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ topic: topic.trim(), language: 'vi', durationSeconds: 40, renderMode, voiceoverMode, subtitlesEnabled })
      });
      const payload = await response.json() as JobStatus & { error?: string; details?: string[] };
      if (!response.ok) throw new Error(payload.details?.join(' ') ?? payload.error ?? 'Không thể tạo job.');
      setJob(payload); setUiState('generating');
      await pollJob(payload.jobId, controller.signal);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setUiState('failed');
    }
  }

  const busy = uiState === 'submitting' || uiState === 'generating';
  return (
    <section className="create-card" aria-labelledby="create-form-title">
      <div className="create-card-header">
        <h2 id="create-form-title" className="card-title">Tạo video Toán học</h2>
        <p className="card-subtitle">Tạo bài giảng đạo hàm 40 giây bằng SymPy, Manim và Remotion.</p>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="video-topic" className="form-label">Chủ đề bài học</label>
          <textarea id="video-topic" className={`form-textarea ${error ? 'has-error' : ''}`} value={topic}
            onChange={(event) => { setTopic(event.target.value); if (error) setError(null); }} rows={3}
            maxLength={300} disabled={busy} placeholder="Đạo hàm là gì?" />
          <div className="quick-topics">
            <span className="quick-topics-label">MVP hỗ trợ:</span>
            <button type="button" className="quick-chip" disabled={busy} onClick={() => setTopic('Đạo hàm là gì? — Từ cát tuyến đến tiếp tuyến')}>Đạo hàm: cát tuyến → tiếp tuyến</button>
          </div>
        </div>
        <div className="form-grid-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="duration-select">Thời lượng</label>
            <select id="duration-select" className="form-select" value="40" disabled><option value="40">40 giây (MVP)</option></select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="language-select">Ngôn ngữ</label>
            <select id="language-select" className="form-select" value="vi" disabled><option value="vi">Tiếng Việt</option></select>
          </div>
        </div>
        <div className="form-group mode-group">
          <span className="form-label">Chế độ AI</span>
          <div className="mode-options">
            <label className={`mode-option ${renderMode === 'mock' ? 'selected' : ''}`}>
              <input type="radio" name="renderMode" checked={renderMode === 'mock'} disabled={busy} onChange={() => setRenderMode('mock')} />
              <span><strong>Mock AI Demo</strong><small>Offline, không cần API key</small></span>
            </label>
            <label className={`mode-option ${renderMode === 'live' ? 'selected' : ''} ${!liveEnabled ? 'disabled' : ''}`}>
              <input type="radio" name="renderMode" checked={renderMode === 'live'} disabled={busy || !liveEnabled} onChange={() => setRenderMode('live')} />
              <span><strong>Gemini Live</strong><small>{liveEnabled ? 'Dùng Gemini API trên server' : 'Chưa cấu hình GEMINI_API_KEY'}</small></span>
            </label>
          </div>
        </div>
        <div className="form-group mode-group">
          <span className="form-label">Giọng đọc</span>
          <div className="mode-options voiceover-options">
            <label className={`mode-option ${voiceoverMode === 'none' ? 'selected' : ''}`}>
              <input type="radio" name="voiceoverMode" checked={voiceoverMode === 'none'} disabled={busy} onChange={() => setVoiceoverMode('none')} />
              <span><strong>Không giọng đọc</strong><small>Video im tiếng, vẫn có thể bật phụ đề</small></span>
            </label>
            <label className={`mode-option ${voiceoverMode === 'google_cloud_tts' ? 'selected' : ''} ${!googleTtsEnabled ? 'disabled' : ''}`}>
              <input type="radio" name="voiceoverMode" checked={voiceoverMode === 'google_cloud_tts'} disabled={busy || !googleTtsEnabled} onChange={() => setVoiceoverMode('google_cloud_tts')} />
              <span><strong>Google Cloud TTS</strong><small>{googleTtsEnabled ? 'Giọng Việt chạy hoàn toàn trên server' : 'Chưa cấu hình Google Cloud TTS'}</small></span>
            </label>
            <label className="mode-option disabled">
              <input type="radio" name="voiceoverMode" disabled />
              <span><strong>Audio có sẵn</strong><small>Hiện hỗ trợ qua CLI tin cậy, chưa mở upload web</small></span>
            </label>
          </div>
        </div>
        <label className="subtitle-toggle">
          <input type="checkbox" checked={subtitlesEnabled} disabled={busy} onChange={(event) => setSubtitlesEnabled(event.target.checked)} />
          <span><strong>Burned-in subtitles</strong><small>Phụ đề tiếng Việt theo từng đoạn lời dẫn; không phải word-level.</small></span>
        </label>
        <button type="submit" className="btn-generate" disabled={busy}>
          {uiState === 'submitting' ? 'Đang tạo job…' : uiState === 'generating' ? 'Đang render video…' : 'Generate Video'}
        </button>
      </form>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {job ? (
        <div className={`job-panel ${uiState === 'failed' ? 'failed' : ''}`} aria-live="polite">
          <div className="demo-banner-header">
            <span className="demo-badge">{job.renderMode === 'live' ? 'Gemini Live' : 'Mock AI Demo'}</span>
            <span className="demo-message">{statusLabels[job.status] ?? job.message}</span>
          </div>
          <div className="job-meta"><span>Job ID</span><code>{job.jobId}</code></div>
          <div className="job-capabilities">
            <span>{job.voiceoverMode === 'none' ? 'Không có voiceover' : 'Có voiceover'}</span>
            <span>{job.subtitlesEnabled ? 'Có phụ đề' : 'Không phụ đề'}</span>
            {job.failureType ? <span>Lỗi: {job.failureType}</span> : null}
          </div>
          {job.status !== 'failed' ? <div className="progress-track" aria-label={`Tiến độ ${job.progress}%`}><div className="progress-fill" style={{ width: `${job.progress}%` }} /></div> : null}
          {job.status === 'completed' && job.videoUrl ? (
            <div className="video-result">
              <video controls preload="metadata" src={job.videoUrl}>Trình duyệt không hỗ trợ video MP4.</video>
              <a className="download-link" href={`${job.videoUrl}?download=1`}>Tải video MP4</a>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

