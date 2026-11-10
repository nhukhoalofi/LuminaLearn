'use client';

import { useEffect, useState } from 'react';
import { ChapterNavigatorV3 } from './ChapterNavigatorV3';
import { TimelineViewerV3 } from './TimelineEditorV3';
import { MathematicalVerificationPanelV3 } from './MathematicalVerificationPanelV3';
import { SceneInspectorV3 } from './SceneInspectorV3';

type Claim = {
  id: string;
  statement: string;
  verificationStatus: string;
  claimType: string;
  formalExpression?: string;
  formalProofSummary?: string;
};
type Scene = {
  sceneId: string;
  title: string;
  sceneType: string;
  durationSeconds: number;
  narration: { vietnamese: string; subtitleVietnamese: string };
  visualPayload: unknown;
  visualDefinition?: any;
};
type AgentTask = { taskId: string; role: string; title: string; status: string; validationStatus: string; durationMs?: number };
type SupervisorTrace = { supervisorRunId: string; status: string; elapsedMs: number; humanReadableSummary: string; tasks: AgentTask[] };
type Chapter = { chapterId: string; chapterTitle: string; durationSeconds: number; sceneIds?: string[] };
type Draft = {
  draftId: string;
  version: number;
  status: string;
  semanticReviewConfirmed: boolean;
  approvedArtifact?: { artifactId: string; contentHash: string };
  lessonPlan: {
    title: string;
    generationProvenance: string;
    learningObjectives: string[];
    educationalClaims: Claim[];
    storyboard?: { totalDurationSeconds: number; scenes: Scene[]; chapters?: Chapter[] };
    validationReport?: { overallStatus: string; requiresHumanPedagogicalSignoff: boolean };
    capabilityReport: { renderReadiness: string; limitations: string[] };
  };
};
type Job = { jobId: string; status: string; progress: number; message: string; videoUrl?: string; error?: string };

export function V3TeacherStudio({ liveEnabled }: { liveEnabled: boolean }) {
  const [topic, setTopic] = useState('Perceptron và nguyên lý hoạt động của mạng nơ-ron nhân tạo');
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [domain, setDomain] = useState<'mathematics' | 'artificial_intelligence'>('artificial_intelligence');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [durationPreset, setDurationPreset] = useState<'35s' | '60s' | '180s' | '300s' | '600s'>('60s');
  const [confirmExternalApi, setConfirmExternalApi] = useState(false);
  const [draft, setDraft] = useState<Draft>();
  const [trace, setTrace] = useState<SupervisorTrace>();
  const [job, setJob] = useState<Job>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedSceneId, setSelectedSceneId] = useState<string>('');
  const [hasMathChanges, setHasMathChanges] = useState<boolean>(false);
  const [currentTeacher, setCurrentTeacher] = useState<{ ownerId: string; fullName: string; username: string; email: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [myDrafts, setMyDrafts] = useState<Array<{ draftId: string; version: number; status: string; lessonPlan: { title: string } }>>([]);
  const [showMyDrafts, setShowMyDrafts] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.teacher) {
          setCurrentTeacher(data.teacher);
        }
      })
      .catch(() => undefined);
  }, []);

  async function loadMyDrafts() {
    try {
      const res = await fetch('/api/v3/lessons/draft');
      if (res.ok) {
        const data = await res.json();
        setMyDrafts(data.drafts ?? []);
        setShowMyDrafts(!showMyDrafts);
      }
    } catch { /* ignore */ }
  }

  async function loginAsTeacher(username: string, pass: string) {
    try {
      setLoginError('');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentTeacher(data.teacher);
        setLoginPassword('');
        setShowLoginModal(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setLoginError(data.message ?? 'Đăng nhập không thành công.');
      }
    } catch { setLoginError('Không thể kết nối dịch vụ đăng nhập.'); }
  }

  async function logoutTeacher() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentTeacher(null);
    setMyDrafts([]);
    setShowMyDrafts(false);
  }

  useEffect(() => {
    if (!job || ['completed', 'failed'].includes(job.status)) return;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.jobId}`, { cache: 'no-store' });
      if (response.ok) setJob(await response.json());
    }, 1500);
    return () => clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (draft?.lessonPlan.storyboard?.scenes && draft.lessonPlan.storyboard.scenes.length > 0) {
      if (!selectedSceneId || !draft.lessonPlan.storyboard.scenes.some((s) => s.sceneId === selectedSceneId)) {
        setSelectedSceneId(draft.lessonPlan.storyboard.scenes[0].sceneId);
      }
    }
  }, [draft, selectedSceneId]);

  async function jsonRequest(url: string, method: string, body: unknown) {
    const response = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message ?? data.error ?? 'request_failed'), { status: response.status, data });
    return data;
  }

  async function generate() {
    setBusy(true); setError(''); setJob(undefined); setTrace(undefined); setHasMathChanges(false);
    try {
      const targetSeconds = durationPreset === '600s' ? 600 : durationPreset === '300s' ? 300 : durationPreset === '180s' ? 180 : durationPreset === '60s' ? 60 : 35;
      const responseData = await jsonRequest('/api/v3/supervisor', 'POST', {
        requestId: `req_v3_${Date.now()}`, topic, domain, generationMode: mode,
        targetAudience: 'high_school',
        targetDurationSeconds: targetSeconds, narrationMode: 'none', subtitlesEnabled,
        fps: 24, width: 720, height: 1280, confirmExternalApi
      });
      if (responseData.trace) {
        setTrace(responseData.trace);
      }
      setDraft({
        draftId: responseData.draftId,
        version: 1,
        status: 'needs_review',
        semanticReviewConfirmed: false,
        lessonPlan: responseData.lessonPlan
      });
      if (responseData.lessonPlan.storyboard?.scenes?.[0]) {
        setSelectedSceneId(responseData.lessonPlan.storyboard.scenes[0].sceneId);
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      let msg = rawMsg;
      if (typeof rawMsg === 'string' && rawMsg.trim().startsWith('[') && rawMsg.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(rawMsg);
          if (Array.isArray(parsed)) {
            msg = parsed.map((item: { path?: unknown[]; code?: string; maximum?: number; minimum?: number; message?: string }) => {
              const field = Array.isArray(item.path) ? item.path.join('.') : 'dữ liệu';
              if (item.code === 'too_big') return `Trường '${field}' vượt quá mức tối đa ${item.maximum}`;
              if (item.code === 'too_small') return `Trường '${field}' nhỏ hơn mức tối thiểu ${item.minimum}`;
              return item.message || `Lỗi tại '${field}'`;
            }).join('; ');
          }
        } catch { /* ignore */ }
      }
      setError(`Supervisor Multi-Agent gặp sự cố: ${msg}`);
    }
    finally { setBusy(false); }
  }

  async function generateLegacyFallback() {
    setBusy(true); setError(''); setJob(undefined); setTrace(undefined); setHasMathChanges(false);
    try {
      const legacyData = await jsonRequest('/api/v3/lessons/draft', 'POST', {
        requestId: `req_v3_${Date.now()}`, topic, domain, generationMode: mode,
        targetDurationSeconds: 35, narrationMode: 'none', subtitlesEnabled,
        fps: 24, width: 720, height: 1280, confirmExternalApi
      });
      setDraft(legacyData);
      if (legacyData.lessonPlan.storyboard?.scenes?.[0]) {
        setSelectedSceneId(legacyData.lessonPlan.storyboard.scenes[0].sceneId);
      }
    } catch (legacyErr) {
      const rawMsg = legacyErr instanceof Error ? legacyErr.message : String(legacyErr);
      let msg = rawMsg;
      if (typeof rawMsg === 'string' && rawMsg.trim().startsWith('[') && rawMsg.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(rawMsg);
          if (Array.isArray(parsed)) {
            msg = parsed.map((item: { path?: unknown[]; code?: string; maximum?: number; minimum?: number; message?: string }) => {
              const field = Array.isArray(item.path) ? item.path.join('.') : 'dữ liệu';
              if (item.code === 'too_big') return `Trường '${field}' vượt quá mức tối đa ${item.maximum}`;
              return item.message || `Lỗi tại '${field}'`;
            }).join('; ');
          }
        } catch { /* ignore */ }
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function retryEnqueue() {
    if (!draft?.approvedArtifact) return;
    setBusy(true); setError('');
    try {
      const result = await jsonRequest(`/api/v3/lessons/${draft.draftId}/enqueue`, 'POST', draft.approvedArtifact);
      setJob(result.job);
    } catch (err) {
      const failure = err as Error & { status?: number };
      if (failure.status === 429) {
        const response = await fetch(`/api/v3/lessons/${draft.draftId}/draft`, { cache: 'no-store' });
        if (response.ok) setDraft(await response.json());
        setError('Bản duyệt đã được giữ an toàn nhưng hàng đợi đang đầy. Hãy thử xếp hàng lại khi có chỗ trống.');
      } else setError(failure.message);
    }
    finally { setBusy(false); }
  }

  async function resumeJob() {
    if (!job || !draft?.approvedArtifact) return;
    setBusy(true); setError('');
    try {
      const result = await jsonRequest(`/api/jobs/${job.jobId}/resume`, 'POST', {
        artifactId: draft.approvedArtifact.artifactId,
        contentHash: draft.approvedArtifact.contentHash
      });
      setJob(result.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true); setError('');
    try {
      const claimStatements = Object.fromEntries(draft.lessonPlan.educationalClaims.map((claim) => [claim.id, claim.statement]));
      const narrationTexts = Object.fromEntries((draft.lessonPlan.storyboard?.scenes ?? []).map((scene) => [scene.sceneId, scene.narration.vietnamese]));
      const subtitleTexts = Object.fromEntries((draft.lessonPlan.storyboard?.scenes ?? []).map((scene) => [scene.sceneId, scene.narration.subtitleVietnamese]));
      const sceneTitles = Object.fromEntries((draft.lessonPlan.storyboard?.scenes ?? []).map((scene) => [scene.sceneId, scene.title]));
      const visualPayloads = Object.fromEntries((draft.lessonPlan.storyboard?.scenes ?? []).map((scene) => [scene.sceneId, scene.visualPayload]));
      const visualDefinitions: Record<string, any> = {};
      for (const scene of draft.lessonPlan.storyboard?.scenes ?? []) {
        if (scene.visualDefinition) {
          // Security: strip client-claimed trusted bindings before saving
          const { trustedMathBindings, ...sanitized } = scene.visualDefinition;
          visualDefinitions[scene.sceneId] = {
            ...sanitized,
            trustedMathBindings: []
          };
        }
      }
      const updated = await jsonRequest(`/api/v3/lessons/${draft.draftId}/draft`, 'PATCH', {
        expectedVersion: draft.version, title: draft.lessonPlan.title,
        learningObjectives: draft.lessonPlan.learningObjectives, claimStatements,
        narrationTexts, subtitleTexts, sceneTitles, visualPayloads,
        visualDefinitions: Object.keys(visualDefinitions).length > 0 ? visualDefinitions : undefined
      });
      setDraft(updated);
      setHasMathChanges(false);
    } catch (err) {
      const conflict = err as Error & { status?: number };
      setError(conflict.status === 409 ? 'Bản nháp đã đổi ở tab khác. Hãy tải lại trước khi lưu.' : conflict.message);
    } finally { setBusy(false); }
  }

  async function review() {
    if (!draft) return;
    setBusy(true); setError('');
    try { setDraft(await jsonRequest(`/api/v3/lessons/${draft.draftId}/review`, 'POST', { expectedVersion: draft.version, semanticReviewConfirmed: true })); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  async function approve() {
    if (!draft) return;
    setBusy(true); setError('');
    try {
      const result = await jsonRequest(`/api/v3/lessons/${draft.draftId}/approve`, 'POST', { expectedVersion: draft.version, note: 'Teacher approved from V3 Studio' });
      setDraft(result.draft); setJob(result.job);
    } catch (err) {
      const failure = err as Error & { status?: number };
      if (failure.status === 429) {
        const response = await fetch(`/api/v3/lessons/${draft.draftId}/draft`, { cache: 'no-store' });
        if (response.ok) setDraft(await response.json());
        setError('Bản duyệt đã được giữ an toàn nhưng hàng đợi đang đầy. Hãy thử xếp hàng lại khi có chỗ trống.');
      } else setError(failure.message);
    }
    finally { setBusy(false); }
  }

  function handleUpdateScene(sceneIndex: number, updatedScene: any) {
    if (!draft?.lessonPlan.storyboard) return;
    const scenes = draft.lessonPlan.storyboard.scenes.map((s, i) => (i === sceneIndex ? updatedScene : s));
    setDraft({
      ...draft,
      lessonPlan: {
        ...draft.lessonPlan,
        storyboard: { ...draft.lessonPlan.storyboard, scenes }
      }
    });
    setHasMathChanges(true);
  }

  const activeSceneIndex = draft?.lessonPlan.storyboard?.scenes.findIndex((s) => s.sceneId === selectedSceneId) ?? 0;
  const currentScene = draft?.lessonPlan.storyboard?.scenes[activeSceneIndex >= 0 ? activeSceneIndex : 0];

  return (
    <section className="create-section" aria-labelledby="v3-studio-title" data-testid="v3-teacher-studio">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'rgba(30, 41, 59, 0.75)', border: '1px solid #334155', borderRadius: 12, marginBottom: 18 }}>
        <div>
          {currentTeacher ? (
            <div>
              <span style={{ color: '#4ADE80', fontWeight: 'bold', fontSize: 15 }}>
                👨‍🏫 {currentTeacher.fullName} ({currentTeacher.username})
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#94A3B8', fontFamily: 'monospace' }}>
                ID: {currentTeacher.ownerId}
              </span>
            </div>
          ) : (
            <span style={{ color: '#94A3B8', fontSize: 14 }}>
              🏛️ Chế độ Local Demo · Chưa đăng nhập phiên giáo viên
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {currentTeacher ? (
            <>
              <button type="button" className="quick-chip" onClick={loadMyDrafts} style={{ background: '#0369A1', color: '#FFFFFF' }}>
                📚 Bài học của tôi
              </button>
              <button type="button" className="quick-chip" style={{ borderColor: '#F87171', color: '#F87171' }} onClick={logoutTeacher}>
                Đăng xuất
              </button>
            </>
          ) : (
            <button type="button" className="quick-chip" style={{ borderColor: '#38BDF8', color: '#38BDF8' }} onClick={() => setShowLoginModal(true)}>
              🔑 Đăng nhập giáo viên
            </button>
          )}
        </div>
      </div>

      {showLoginModal && (
        <div style={{ padding: 16, background: '#1E293B', borderRadius: 12, border: '1px solid #38BDF8', marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#38BDF8' }}>Đăng nhập phiên thử nghiệm trường học (Pilot)</h4>
          <p style={{ fontSize: 13, color: '#CBD5E1', marginBottom: 12 }}>Dùng tài khoản cá nhân do quản trị viên pilot cấp. LuminaLearn không nhúng mật khẩu mẫu trong ứng dụng.</p>
          <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
            <label>Tên đăng nhập<input className="form-input" autoComplete="username" value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} /></label>
            <label>Mật khẩu<input className="form-input" type="password" autoComplete="current-password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} /></label>
            {loginError && <p role="alert" className="error-message">{loginError}</p>}
            <button type="button" className="quick-chip" style={{ background: '#0284C7', color: '#FFFFFF' }} disabled={!loginUsername || !loginPassword} onClick={() => loginAsTeacher(loginUsername, loginPassword)}>Đăng nhập</button>
            <button
              type="button"
              className="quick-chip"
              onClick={() => setShowLoginModal(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {showMyDrafts && (
        <div style={{ padding: 16, background: 'rgba(15, 23, 42, 0.9)', borderRadius: 12, border: '1px solid #475569', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0, color: '#E2E8F0' }}>Danh sách bài học của tôi ({myDrafts.length})</h4>
            <button type="button" className="quick-chip" onClick={() => setShowMyDrafts(false)}>Đóng</button>
          </div>
          {myDrafts.length === 0 ? (
            <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Chưa có bản thảo nào được lưu cho tài khoản này.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myDrafts.map((d) => (
                <div
                  key={d.draftId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#1E293B',
                    borderRadius: 8
                  }}
                >
                  <div>
                    <strong>{d.lessonPlan?.title || d.draftId}</strong>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>v{d.version} · {d.status}</div>
                  </div>
                  <button
                    type="button"
                    className="quick-chip"
                    onClick={async () => {
                      const res = await fetch(`/api/v3/lessons/${d.draftId}/draft`);
                      if (res.ok) {
                        const loaded = await res.json();
                        setDraft(loaded);
                        setShowMyDrafts(false);
                      }
                    }}
                  >
                    Mở bản thảo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 id="v3-studio-title">V3 Teacher Studio — AI & Toán học</h2>
      <p>{mode === 'mock' ? 'Mock Mode: nội dung fixture xác định, hoàn toàn offline.' : 'Live Gemini: chỉ gọi API sau xác nhận rõ ràng.'}</p>
      <label className="form-label">Lĩnh vực</label>
      <select className="form-input" value={domain} onChange={(event) => {
        const selected = event.target.value as typeof domain;
        setDomain(selected);
        setTopic(selected === 'mathematics' ? '7 hằng đẳng thức đáng nhớ' : 'Perceptron và nguyên lý hoạt động của mạng nơ-ron nhân tạo');
      }}>
        <option value="mathematics">Toán học</option>
        <option value="artificial_intelligence">Trí tuệ nhân tạo / Học máy</option>
      </select>
      <label className="form-label">Chủ đề</label>
      <textarea className="form-textarea" value={topic} onChange={(event) => setTopic(event.target.value)} />
      <div aria-label="Ví dụ chương trình học">
        {(domain === 'mathematics'
          ? [['7 hằng đẳng thức đáng nhớ', true], ['Đạo hàm của x³', true], ['Định lý Bayes', false], ['Tích phân Riemann', true], ['Đại số tuyến tính', false]]
          : [['Perceptron', true], ['Gradient Descent', true], ['Self-Attention', true], ['Neural Networks', false], ['Backpropagation', false]]
        ).map(([example, ready]) => <button type="button" className="quick-chip" key={String(example)} onClick={() => setTopic(String(example))}>{example} · {ready ? 'render-ready' : 'planning-only'}</button>)}
      </div>
      <label className="form-label">Thời lượng bài học (Duration Preset)</label>
      <select className="form-input" value={durationPreset} onChange={(event) => setDurationPreset(event.target.value as typeof durationPreset)}>
        <option value="35s">35 giây (Demo nhanh)</option>
        <option value="60s">1 phút (60s) — Khái niệm & Trực giác cốt lõi</option>
        <option value="180s">3 phút (180s) — Lý thuyết & Ví dụ trực quan</option>
        <option value="300s">5 phút (300s) — Dẫn giải chi tiết & Tránh lỗi thường gặp</option>
        <option value="600s">10 phút (600s) — Masterclass nhiều chương chuyên sâu</option>
      </select>
      <label><input type="checkbox" checked={subtitlesEnabled} onChange={(event) => setSubtitlesEnabled(event.target.checked)} /> Ghi phụ đề vào video và tạo SRT</label>
      <label className="form-label">Chế độ tạo nội dung</label>
      <select className="form-input" value={mode} onChange={(event) => setMode(event.target.value as 'mock' | 'live')}>
        <option value="mock">Mock offline (khuyến nghị demo)</option>
        <option value="live" disabled={!liveEnabled}>Gemini Live</option>
      </select>
      {mode === 'live' && <label><input type="checkbox" checked={confirmExternalApi} onChange={(event) => setConfirmExternalApi(event.target.checked)} /> Tôi cho phép gọi Gemini cho yêu cầu này.</label>}
      <button className="btn-generate" disabled={busy || (mode === 'live' && !confirmExternalApi)} onClick={generate}>Tạo bài học V3</button>
      {error && (
        <div style={{ marginTop: '8px' }}>
          <p role="alert" className="error-message">{error}</p>
          {error.includes('Supervisor Multi-Agent') && (
            <button
              type="button"
              className="quick-chip"
              style={{ marginTop: '6px', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              disabled={busy}
              onClick={generateLegacyFallback}
            >
              ⚙️ Tạo bằng bộ lập kế hoạch đơn lẻ (Legacy Fallback)
            </button>
          )}
        </div>
      )}

      {trace && (
        <div className="job-panel" style={{ borderLeft: '3px solid var(--accent-cyan, #22d3ee)', marginTop: '14px' }} data-testid="v3-supervisor-trace">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: 'var(--accent-cyan, #22d3ee)' }}>🤖 Điều phối Đa Agent (Educational Supervisor V3)</h3>
            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 211, 238, 0.2)', color: '#22d3ee' }}>
              {trace.elapsedMs}ms · {trace.tasks.length} Agent Tasks
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '6px' }}>{trace.humanReadableSummary}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px', marginTop: '10px' }}>
            {trace.tasks.map((task) => (
              <div
                key={task.taskId}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: task.status === 'completed' ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(248, 113, 113, 0.3)',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <strong style={{ color: '#93c5fd' }}>{task.role}</strong>
                  <span style={{ color: task.status === 'completed' ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                    {task.status === 'completed' ? '✓ Hoàn thành' : task.status}
                  </span>
                </div>
                <div style={{ color: '#e2e8f0', fontSize: '11px' }}>{task.title}</div>
                {task.durationMs !== undefined && (
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                    {task.durationMs}ms · {task.validationStatus}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {draft && (
        <div className="job-panel" data-testid="v3-draft">
          <p><strong>Nguồn tạo:</strong> {draft.lessonPlan.generationProvenance}</p>
          <p><strong>Trạng thái:</strong> {draft.status} · v{draft.version} · validation {draft.lessonPlan.validationReport?.overallStatus}</p>
          <input className="form-input" aria-label="Tiêu đề V3" value={draft.lessonPlan.title} onChange={(event) => setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, title: event.target.value } })} />
          <h3>Mục tiêu học tập</h3>
          {draft.lessonPlan.learningObjectives.map((objective, index) => <input key={index} className="form-input" aria-label={`Mục tiêu V3 ${index + 1}`} value={objective} onChange={(event) => {
            const objectives = draft.lessonPlan.learningObjectives.map((item, i) => i === index ? event.target.value : item);
            setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, learningObjectives: objectives } });
          }} />)}

          {/* CHECKPOINT F: SymPy Mathematical Verification Panel */}
          <MathematicalVerificationPanelV3
            claims={draft.lessonPlan.educationalClaims}
            onUpdateClaim={(claimId, statement) => {
              const claims = draft.lessonPlan.educationalClaims.map((item) =>
                item.id === claimId ? { ...item, statement } : item
              );
              setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, educationalClaims: claims } });
              setHasMathChanges(true);
            }}
            hasMathChanges={hasMathChanges}
          />

          {/* CHECKPOINT C, D, E: Advanced Storyboard Editor */}
          {draft.lessonPlan.storyboard && (
            <>
              {/* Timeline Editor */}
              <TimelineViewerV3
                scenes={draft.lessonPlan.storyboard.scenes}
                totalDurationSeconds={draft.lessonPlan.storyboard.totalDurationSeconds}
                selectedSceneId={selectedSceneId || draft.lessonPlan.storyboard.scenes[0]?.sceneId}
                onSelectScene={setSelectedSceneId}
              />

              {/* Chapter Navigator */}
              <ChapterNavigatorV3
                chapters={draft.lessonPlan.storyboard.chapters ?? []}
                scenes={draft.lessonPlan.storyboard.scenes}
                selectedSceneId={selectedSceneId || draft.lessonPlan.storyboard.scenes[0]?.sceneId}
                onSelectScene={setSelectedSceneId}
              />

              {/* Active Scene Inspector & Remotion Preview */}
              {currentScene && (
                <SceneInspectorV3
                  draftId={draft.draftId}
                  draftVersion={draft.version}
                  scene={currentScene}
                  onUpdateScene={(updated) => handleUpdateScene(activeSceneIndex >= 0 ? activeSceneIndex : 0, updated)}
                  onMathModified={() => setHasMathChanges(true)}
                  subtitlesEnabled={subtitlesEnabled}
                  isDraftDirty={hasMathChanges}
                />
              )}

              {/* Compact all-scene overview for backward compatibility */}
              <details style={{ marginTop: '12px', marginBottom: '12px' }}>
                <summary style={{ cursor: 'pointer', color: '#94A3B8', fontSize: '12px' }}>
                  Toàn bộ danh sách phân cảnh ({draft.lessonPlan.storyboard.scenes.length} cảnh)
                </summary>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {draft.lessonPlan.storyboard.scenes.map((scene, sceneIndex) => (
                    <article key={scene.sceneId} style={{ padding: '8px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '4px' }}>
                      <strong>{scene.title}</strong> — {scene.sceneType}, {scene.durationSeconds}s
                      <textarea
                        className="form-textarea"
                        aria-label={`Lời dẫn V3 ${scene.sceneId}`}
                        value={scene.narration.vietnamese}
                        rows={2}
                        onChange={(event) => {
                          const scenes = draft.lessonPlan.storyboard!.scenes.map((item, i) => i === sceneIndex ? { ...item, narration: { ...item.narration, vietnamese: event.target.value } } : item);
                          setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, storyboard: { ...draft.lessonPlan.storyboard!, scenes } } });
                          setHasMathChanges(true);
                        }}
                      />
                      <textarea
                        className="form-textarea"
                        aria-label={`Phụ đề V3 ${scene.sceneId}`}
                        value={scene.narration.subtitleVietnamese}
                        rows={2}
                        onChange={(event) => {
                          const scenes = draft.lessonPlan.storyboard!.scenes.map((item, i) => i === sceneIndex ? { ...item, narration: { ...item.narration, subtitleVietnamese: event.target.value } } : item);
                          setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, storyboard: { ...draft.lessonPlan.storyboard!, scenes } } });
                          setHasMathChanges(true);
                        }}
                      />
                      <details>
                        <summary>Cấu hình cảnh typed (JSON)</summary>
                        <textarea
                          className="form-textarea"
                          aria-label={`Visual payload V3 ${scene.sceneId}`}
                          value={JSON.stringify(scene.visualPayload, null, 2)}
                          rows={4}
                          onChange={(event) => {
                            try {
                              const payload = JSON.parse(event.target.value) as unknown;
                              const scenes = draft.lessonPlan.storyboard!.scenes.map((item, i) => i === sceneIndex ? { ...item, visualPayload: payload } : item);
                              setDraft({ ...draft, lessonPlan: { ...draft.lessonPlan, storyboard: { ...draft.lessonPlan.storyboard!, scenes } } });
                              setHasMathChanges(true);
                              setError('');
                            } catch {
                              setError('Visual payload phải là JSON hợp lệ; máy chủ sẽ kiểm tra đúng sceneType trước khi lưu.');
                            }
                          }}
                        />
                      </details>
                    </article>
                  ))}
                </div>
              </details>
            </>
          )}

          <p><strong>Render readiness:</strong> {draft.lessonPlan.capabilityReport.renderReadiness}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="quick-chip" disabled={busy || draft.status === 'approved'} onClick={save}>Lưu & tái kiểm định</button>
            <button className="quick-chip" disabled={busy || draft.status !== 'needs_review'} onClick={review}>Xác nhận rà soát ngữ nghĩa</button>
            <button className="btn-generate" disabled={busy || hasMathChanges || draft.status !== 'ready_for_approval' || draft.lessonPlan.capabilityReport.renderReadiness !== 'render_ready'} onClick={approve}>Duyệt & render MP4</button>
            <button className="quick-chip" disabled={busy || draft.status !== 'approved' || !draft.approvedArtifact} onClick={retryEnqueue}>Xếp hàng lại bản đã duyệt</button>
          </div>
        </div>
      )}

      {job && (
        <div className="job-panel" data-testid="v3-job">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong>{job.message}</strong>
            <span>{job.progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(51, 65, 85, 0.5)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ width: `${job.progress}%`, height: '100%', background: 'linear-gradient(90deg, #38BDF8, #818CF8)', transition: 'width 0.3s ease' }} />
          </div>
          {job.error && (
            <div style={{ marginBottom: '10px' }}>
              <p role="alert" className="error-message">{job.error}</p>
              {(job.status === 'failed' || job.status === 'interrupted') && draft?.approvedArtifact && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button type="button" className="quick-chip" disabled={busy} onClick={resumeJob}>
                    🔄 Tiếp tục Render (Resume từ Checkpoint)
                  </button>
                  <button type="button" className="quick-chip" disabled={busy} onClick={retryEnqueue}>
                    ⚡ Chạy lại từ đầu (Job mới)
                  </button>
                </div>
              )}
            </div>
          )}
          {job.status === 'completed' && job.videoUrl && (
            <>
              <video controls src={job.videoUrl} style={{ width: '100%', maxHeight: '480px', borderRadius: '8px', marginTop: '10px' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <a className="download-link" href={`${job.videoUrl}?download=1`}>Tải MP4 V3</a>
                <a className="download-link" href={`/api/jobs/${job.jobId}/subtitles`}>Tải phụ đề V3</a>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
