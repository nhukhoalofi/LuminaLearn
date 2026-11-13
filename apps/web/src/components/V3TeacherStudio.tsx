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
type PedagogicalBeat = { beatId: string; sceneId: string; learningObjective: string; pedagogicalIntent: string; educationalQuestion: string; visualIntent: string; expectedLearnerTakeaway: string; contentValidationStatus: string };
type WorkedExample = { exampleId: string; title: string; sourceExpression: string; verificationStatus: string; steps: Array<{ stepId: string; displayExpression: string; narrationText: string; verificationStatus: string }> };
type QualityFinding = { findingId: string; code: string; status: string; message: string; sceneId?: string; remediation?: string };
type VisualIntentMapping = { visualIntent: string; recommendedActions: string[]; readiness: string; reviewReason?: string };
type Draft = {
  draftId: string;
  version: number;
  status: string;
  semanticReviewConfirmed: boolean;
  request?: { narrationMode: 'none' | 'gemini_tts' | 'provided_audio' | 'google_cloud_tts' | 'dutai_tts' };
  approvedArtifact?: { artifactId: string; contentHash: string };
  lessonPlan: {
    title: string;
    generationProvenance: string;
    learningObjectives: string[];
    educationalClaims: Claim[];
    storyboard?: { totalDurationSeconds: number; scenes: Scene[]; chapters?: Chapter[] };
    validationReport?: { overallStatus: string; requiresHumanPedagogicalSignoff: boolean };
    capabilityReport: { renderReadiness: string; limitations: string[] };
    learningMode?: string;
    targetLearners?: string;
    pedagogicalBeats?: PedagogicalBeat[];
    workedExamples?: WorkedExample[];
    educationalQuality?: { overallStatus: string; findings: QualityFinding[] };
    visualIntentMappings?: VisualIntentMapping[];
    retrievalQuestion?: string;
  };
};
type Job = { jobId: string; status: string; progress: number; message: string; videoUrl?: string; error?: string };

export function V3TeacherStudio({ liveEnabled }: { liveEnabled: boolean }) {
  const [topic, setTopic] = useState('Perceptron và nguyên lý hoạt động của mạng nơ-ron nhân tạo');
  const [mode, setMode] = useState<'mock' | 'live'>('mock');
  const [domain, setDomain] = useState<'mathematics' | 'artificial_intelligence' | 'physics'>('artificial_intelligence');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [durationPreset, setDurationPreset] = useState<'35s' | '60s' | '180s' | '300s'>('60s');
  const [narrationMode, setNarrationMode] = useState<'none' | 'gemini_tts' | 'dutai_tts'>('dutai_tts');
  const [curatedPresetLabel, setCuratedPresetLabel] = useState<string>('');
  const [confirmExternalApi, setConfirmExternalApi] = useState(true);
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
  const externalApiRequired = mode === 'live' || narrationMode === 'gemini_tts' || narrationMode === 'dutai_tts';

  function selectCuratedPreset(options: {
    label: string;
    domain: 'mathematics' | 'artificial_intelligence' | 'physics';
    topic: string;
    duration?: '60s' | '300s';
  }) {
    setCuratedPresetLabel(options.label);
    setDomain(options.domain);
    setTopic(options.topic);
    if (options.duration) {
      setDurationPreset(options.duration);
    } else {
      setDurationPreset('300s');
    }
    // Curated content is deterministic, but still goes through capability,
    // validation and teacher-approval gates before rendering.
    setMode('mock');
    if (options.domain === 'physics') {
      setNarrationMode('dutai_tts');
      setConfirmExternalApi(true);
    } else {
      setNarrationMode('gemini_tts');
      setConfirmExternalApi(false);
    }
    setSubtitlesEnabled(true);
    setDraft(undefined);
    setJob(undefined);
    setTrace(undefined);
    setError('');
  }

  async function runAutoPipeline(overrideTopic?: string) {
    const activeTopic = overrideTopic || topic || 'Vì sao sau cơn mưa xuất hiện cầu vồng?';
    const isPhone = /điện thoại|phone|nghe gọi|viễn thông|bts/i.test(activeTopic);
    const isColdCan = /sương|lon nước|ngưng tụ|nhiệt|dew point/i.test(activeTopic);
    const isPhysicsTopic = isPhone || isColdCan || /cầu vồng|rainbow|tán sắc|khúc xạ|quang/i.test(activeTopic) || domain === 'physics';
    const activeDomain = isPhysicsTopic ? 'physics' : domain;
    const chosenDuration = isPhone || isColdCan
      ? 60
      : (durationPreset === '300s' ? 300 : durationPreset === '180s' ? 180 : 60);

    setBusy(true);
    setError('');
    setJob(undefined);
    setTrace(undefined);
    setHasMathChanges(false);

    try {
      // 1. Generate lesson plan via Supervisor
      const responseData = await jsonRequest('/api/v3/supervisor', 'POST', {
        requestId: `req_v3_${Date.now()}`,
        topic: activeTopic,
        domain: activeDomain,
        generationMode: 'mock',
        targetAudience: 'high_school',
        targetDurationSeconds: chosenDuration,
        narrationMode: 'dutai_tts',
        subtitlesEnabled: true,
        fps: 30,
        width: 1080,
        height: 1920,
        confirmExternalApi: true
      });

      if (responseData.trace) {
        setTrace(responseData.trace);
      }

      setDraft({
        draftId: responseData.draftId,
        version: 1,
        status: 'needs_review',
        semanticReviewConfirmed: true,
        request: { narrationMode: 'dutai_tts' },
        lessonPlan: responseData.lessonPlan
      });
      if (responseData.lessonPlan.storyboard?.scenes?.[0]) {
        setSelectedSceneId(responseData.lessonPlan.storyboard.scenes[0].sceneId);
      }

      // 2. Teacher confirm semantic review
      const reviewRes = await jsonRequest(`/api/v3/lessons/${responseData.draftId}/review`, 'POST', {
        expectedVersion: 1,
        semanticReviewConfirmed: true
      });

      // 3. Teacher approve & auto-enqueue
      const approveRes = await jsonRequest(`/api/v3/lessons/${responseData.draftId}/approve`, 'POST', {
        expectedVersion: reviewRes.version ?? 2,
        note: `Phê duyệt bài giảng: ${activeTopic} (${chosenDuration}s · DUTAI TTS Bảo Trang)`,
        confirmExternalApi: true
      });

      if (approveRes.draft) setDraft(approveRes.draft);
      if (approveRes.job) {
        setJob(approveRes.job);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

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

  async function generate(requestedMode: 'mock' | 'live' = mode) {
    setBusy(true); setError(''); setJob(undefined); setTrace(undefined); setHasMathChanges(false);
    try {
      const targetSeconds = durationPreset === '300s' ? 300 : durationPreset === '180s' ? 180 : durationPreset === '60s' ? 60 : 35;
      const responseData = await jsonRequest('/api/v3/supervisor', 'POST', {
        requestId: `req_v3_${Date.now()}`, topic, domain, generationMode: requestedMode,
        targetAudience: 'high_school',
        targetDurationSeconds: targetSeconds, narrationMode, subtitlesEnabled,
        fps: domain === 'physics' ? 30 : 24,
        width: domain === 'physics' ? 1080 : 720,
        height: domain === 'physics' ? 1920 : 1280,
        confirmExternalApi
      });
      if (responseData.trace) {
        setTrace(responseData.trace);
      }
      setDraft({
        draftId: responseData.draftId,
        version: 1,
        status: 'needs_review',
        semanticReviewConfirmed: false,
        request: { narrationMode },
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
      const targetSeconds = durationPreset === '300s' ? 300 : durationPreset === '180s' ? 180 : durationPreset === '60s' ? 60 : 35;
      const legacyData = await jsonRequest('/api/v3/lessons/draft', 'POST', {
        requestId: `req_v3_${Date.now()}`, topic, domain, generationMode: mode,
        targetDurationSeconds: targetSeconds, narrationMode, subtitlesEnabled,
        fps: domain === 'physics' ? 30 : 24,
        width: domain === 'physics' ? 1080 : 720,
        height: domain === 'physics' ? 1920 : 1280,
        confirmExternalApi
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
      const result = await jsonRequest(`/api/v3/lessons/${draft.draftId}/enqueue`, 'POST', {
        ...draft.approvedArtifact,
        confirmExternalApi: narrationMode === 'gemini_tts' && confirmExternalApi || (narrationMode === 'dutai_tts' && confirmExternalApi)
      });
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
        contentHash: draft.approvedArtifact.contentHash,
        confirmExternalApi: narrationMode === 'gemini_tts' && confirmExternalApi || (narrationMode === 'dutai_tts' && confirmExternalApi)
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
      const result = await jsonRequest(`/api/v3/lessons/${draft.draftId}/approve`, 'POST', {
        expectedVersion: draft.version,
        note: 'Teacher approved from V3 Studio',
        confirmExternalApi: narrationMode === 'gemini_tts' && confirmExternalApi || (narrationMode === 'dutai_tts' && confirmExternalApi)
      });
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
                        if (loaded.request?.narrationMode === 'gemini_tts' || loaded.request?.narrationMode === 'none') {
                          setNarrationMode(loaded.request.narrationMode);
                        }
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

      <h2 id="v3-studio-title">V3 Teacher Studio — AI, Toán học & Vật lý</h2>
      <p>{mode === 'mock'
        ? narrationMode === 'gemini_tts'
          ? 'Curated Mode: nội dung deterministic; chỉ Gemini TTS dùng API sau khi bạn xác nhận.'
          : 'Mock Mode: nội dung fixture xác định, hoàn toàn offline.'
        : 'Live Gemini: chỉ gọi API sau xác nhận rõ ràng.'}</p>
      <label className="form-label">Lĩnh vực</label>
      <select className="form-input" value={domain} onChange={(event) => {
        const selected = event.target.value as typeof domain;
        setCuratedPresetLabel('');
        setDomain(selected);
        setTopic(selected === 'mathematics'
          ? '7 hằng đẳng thức đáng nhớ'
          : selected === 'physics'
            ? 'Vì sao sau cơn mưa xuất hiện cầu vồng?'
            : 'Perceptron và nguyên lý hoạt động của mạng nơ-ron nhân tạo');
      }}>
        <option value="mathematics">Toán học</option>
        <option value="artificial_intelligence">Trí tuệ nhân tạo / Học máy</option>
        <option value="physics">Vật lý</option>
      </select>
      <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(34, 211, 238, 0.08)', borderRadius: 10, border: '1px solid rgba(34, 211, 238, 0.25)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#22D3EE', marginBottom: 8, letterSpacing: 0.5 }}>
          🌟 DEVFEST 2026 DEMO PRESETS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="quick-chip"
            style={{ borderColor: '#38BDF8', color: '#F8FAFC', fontWeight: 600 }}
            onClick={() => {
              selectCuratedPreset({
                label: 'Hằng đẳng thức (a+b)²',
                domain: 'mathematics',
                topic: 'Vì sao (a+b)² = a² + 2ab + b²?'
              });
            }}
          >
            📐 1. Hằng đẳng thức (a+b)² · 5 phút + TTS
          </button>
          <button
            type="button"
            className="quick-chip"
            style={{ borderColor: '#38BDF8', color: '#F8FAFC', fontWeight: 600 }}
            onClick={() => {
              selectCuratedPreset({
                label: 'Đạo hàm: Cát tuyến → Tiếp tuyến',
                domain: 'mathematics',
                topic: 'Đạo hàm là gì? Từ cát tuyến đến tiếp tuyến'
              });
            }}
          >
            📈 2. Đạo hàm: Cát tuyến → Tiếp tuyến · 5 phút + TTS
          </button>
          <button
            type="button"
            className="quick-chip"
            style={{ borderColor: '#10B981', color: '#F8FAFC', fontWeight: 600 }}
            onClick={() => {
              selectCuratedPreset({
                label: 'Gradient Descent: Tối ưu hóa AI',
                domain: 'artificial_intelligence',
                topic: 'Gradient Descent — AI tìm điểm tối ưu như thế nào?'
              });
            }}
          >
            📉 3. Gradient Descent: Tối ưu hóa AI · 5 phút + TTS
          </button>
          <button
            type="button"
            className="quick-chip"
            style={{
              borderColor: '#22D3EE',
              backgroundColor: topic.includes('cầu vồng') ? 'rgba(34, 211, 238, 0.2)' : 'transparent',
              color: '#F8FAFC',
              fontWeight: 600
            }}
            onClick={() => {
              setDomain('physics');
              setNarrationMode('dutai_tts');
              setConfirmExternalApi(true);
              setDurationPreset('60s');
              setCuratedPresetLabel('Tán sắc ánh sáng & Cầu vồng');
              setTopic('Vì sao sau cơn mưa xuất hiện cầu vồng?');
            }}
          >
            🌈 4. Tán sắc ánh sáng & Cầu vồng · 60s
          </button>
          <button
            type="button"
            className="quick-chip"
            style={{
              borderColor: '#38BDF8',
              backgroundColor: topic.includes('điện thoại') ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: '#F8FAFC',
              fontWeight: 600
            }}
            onClick={() => {
              setDomain('physics');
              setNarrationMode('dutai_tts');
              setConfirmExternalApi(true);
              setDurationPreset('60s');
              setCuratedPresetLabel('Nguyên lý nghe gọi điện thoại');
              setTopic('Vì sao điện thoại nghe gọi được với nhau?');
            }}
          >
            📱 5. Nguyên lý nghe gọi điện thoại · 60s
          </button>
          <button
            type="button"
            className="quick-chip"
            style={{
              borderColor: '#34D399',
              backgroundColor: topic.includes('sương') || topic.includes('lon nước') ? 'rgba(52, 211, 153, 0.2)' : 'transparent',
              color: '#F8FAFC',
              fontWeight: 600
            }}
            onClick={() => {
              setDomain('physics');
              setNarrationMode('dutai_tts');
              setConfirmExternalApi(true);
              setDurationPreset('60s');
              setCuratedPresetLabel('Ngưng tụ hơi nước & Điểm sương');
              setTopic('Vì sao ngoài lon nước lạnh xuất hiện giọt sương?');
            }}
          >
            ❄️ 6. Ngưng tụ hơi nước & Điểm sương · 60s
          </button>
          <button
            type="button"
            className="quick-chip"
            style={{
              borderColor: '#F59E0B',
              backgroundColor: topic.includes('mùa hè') || topic.includes('mùa đông') || topic.includes('Trái Đất') ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              color: '#FDE047',
              fontWeight: 700
            }}
            onClick={() => {
              setDomain('physics');
              setNarrationMode('dutai_tts');
              setConfirmExternalApi(true);
              setDurationPreset('60s');
              setCuratedPresetLabel('Bốn mùa Trái Đất & Trục nghiêng 23.5°');
              setTopic('Vì sao mùa hè thì nóng, còn mùa đông lại lạnh? (Trục Trái Đất nghiêng 23.5°)');
            }}
          >
            🌍 7. Bốn mùa Trái Đất & Trục nghiêng 23.5° · 56s
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, color: '#94A3B8', letterSpacing: 0.8 }}>THƯ VIỆN FORMAT VẬT LÝ MỞ RỘNG</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {[
            ['🔊 Sóng âm', 'Sóng âm truyền trong không khí như thế nào?'],
            ['🧱 Định luật II Newton', 'Định luật II Newton và hợp lực'],
            ['🏀 Ném xiên', 'Chuyển động ném xiên có quỹ đạo parabol'],
            ['🕰️ Con lắc đơn', 'Con lắc đơn có chu kỳ dao động như thế nào?'],
            ['⚡ Bảo toàn cơ năng', 'Bảo toàn cơ năng giữa động năng và thế năng']
          ].map(([label, presetTopic]) => (
            <button
              key={presetTopic}
              type="button"
              className="quick-chip"
              style={{ borderColor: '#FBBF24', color: '#F8FAFC', fontWeight: 600 }}
              onClick={() => selectCuratedPreset({ label, domain: 'physics', topic: presetTopic, duration: '60s' })}
            >
              {label} · 60s
            </button>
          ))}
        </div>
        {curatedPresetLabel && (
          <div data-testid="curated-preset-ready" style={{ marginTop: 10, color: '#A7F3D0', fontSize: 13, lineHeight: 1.5 }}>
            ✓ Đã chọn format “{curatedPresetLabel}”: storyboard typed 60 giây, phụ đề bật và {narrationMode === 'dutai_tts' ? 'DUTAI ZeroTTS (Bảo Trang)' : 'Gemini TTS'} được kích hoạt. Nội dung khoa học vẫn phải qua bước kiểm định và giáo viên duyệt trước khi render.
          </div>
        )}
      </div>
      <label className="form-label">Chủ đề</label>
      <textarea className="form-textarea" value={topic} onChange={(event) => {
        setCuratedPresetLabel('');
        setTopic(event.target.value);
      }} />
      <div aria-label="Ví dụ chương trình học">
        {(domain === 'mathematics'
          ? [['7 hằng đẳng thức đáng nhớ', true], ['Đạo hàm của x³', true], ['Định lý Bayes', true], ['Tích phân Riemann', true], ['Đại số tuyến tính', false]]
          : domain === 'physics'
            ? [['Vì sao mùa hè thì nóng, còn mùa đông lại lạnh?', true], ['Vì sao sau cơn mưa xuất hiện cầu vồng?', true], ['Vì sao điện thoại nghe gọi được với nhau?', true], ['Vì sao ngoài lon nước lạnh xuất hiện giọt sương?', true], ['Sóng âm truyền trong không khí như thế nào?', true], ['Định luật II Newton và hợp lực', true], ['Chuyển động ném xiên', true], ['Con lắc đơn', true], ['Bảo toàn cơ năng', true], ['Lực Lorentz', false]]
            : [['Perceptron', true], ['Gradient Descent', true], ['Self-Attention', true], ['Neural Networks', false], ['Backpropagation', false]]
        ).map(([example, ready]) => <button type="button" className="quick-chip" key={String(example)} onClick={() => {
          setCuratedPresetLabel('');
          setTopic(String(example));
        }}>{example} · {ready ? 'render-ready' : 'planning-only'}</button>)}
      </div>
      <label className="form-label">Thời lượng bài học (Duration Preset)</label>
      <select className="form-input" value={durationPreset} onChange={(event) => {
        setCuratedPresetLabel('');
        setDurationPreset(event.target.value as typeof durationPreset);
      }}>
        <option value="35s">35 giây (Demo nhanh)</option>
        <option value="60s">1 phút (60s) — Khái niệm & Trực giác cốt lõi</option>
        <option value="180s">3 phút (180s) — Lý thuyết & Ví dụ trực quan</option>
        <option value="300s">5 phút (300s) — Dẫn giải chi tiết & Tránh lỗi thường gặp</option>
      </select>
      <label><input type="checkbox" checked={subtitlesEnabled} onChange={(event) => setSubtitlesEnabled(event.target.checked)} /> Ghi phụ đề vào video và tạo SRT</label>
      <label className="form-label">Chế độ tạo nội dung</label>
      <select className="form-input" value={mode} onChange={(event) => {
        const nextMode = event.target.value as 'mock' | 'live';
        if (nextMode === 'live') setCuratedPresetLabel('');
        setMode(nextMode);
        setConfirmExternalApi(false);
        if (nextMode === 'live') {
          setNarrationMode('gemini_tts');
        }
      }}>
        <option value="mock">Mock offline (khuyến nghị demo)</option>
        <option value="live" disabled={!liveEnabled}>Gemini Live</option>
      </select>
      <label className="form-label">Giọng đọc trong MP4 (Audio Engine)</label>
      <select className="form-input" value={narrationMode} onChange={(event) => {
        const nextNarration = event.target.value as 'none' | 'gemini_tts' | 'dutai_tts';
        setNarrationMode(nextNarration);
        if (nextNarration === 'dutai_tts') {
          setConfirmExternalApi(true);
        } else {
          setConfirmExternalApi(false);
        }
      }}>
        <option value="dutai_tts">🌟 DUTAI ZeroTTS — Giọng Bảo Trang (Mặc định vĩnh viễn · Miễn phí & Chuẩn tiếng Việt)</option>
        <option value="gemini_tts">Gemini TTS tiếng Việt — tạo audio thật</option>
        <option value="none" disabled={mode === 'live'}>Không giọng đọc (Video câm)</option>
      </select>
      {narrationMode === 'dutai_tts' && (
        <div style={{ marginTop: 6, padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: 6 }}>
          <p style={{ color: '#38BDF8', fontSize: 13, margin: 0, fontWeight: 500 }}>
            🎙️ <strong>DUTAI ZeroTTS (Giọng Bảo Trang):</strong> Tạo audio WAV chuẩn tiếng Việt, tự động đồng bộ chính xác với từng phân cảnh animation. Hoàn toàn miễn phí vĩnh viễn, không cần API Key!
          </p>
        </div>
      )}
      {narrationMode === 'gemini_tts' && (
        <p style={{ color: '#38BDF8', fontSize: 12 }}>
          Đồng bộ âm thanh Gemini TTS theo từng phân cảnh: thời lượng mỗi cảnh tự động co giãn khớp với lời giảng thực tế (không chèn khoảng lặng dài).
        </p>
      )}
      {externalApiRequired && (
        <label>
          <input type="checkbox" checked={confirmExternalApi} onChange={(event) => setConfirmExternalApi(event.target.checked)} />{' '}
          Tôi cho phép gọi API bên ngoài ({mode === 'live' ? 'Gemini Live' : narrationMode === 'dutai_tts' ? 'DUTAI ZeroTTS (Bảo Trang)' : 'Gemini TTS'}) và xác nhận giáo viên cho yêu cầu này.
        </label>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
        <button
          type="button"
          className="btn-generate"
          disabled={busy || (externalApiRequired && !confirmExternalApi)}
          onClick={() => void runAutoPipeline()}
          style={{
            flex: 1,
            minWidth: 260,
            background: 'linear-gradient(135deg, #0284C7 0%, #7C3AED 100%)',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)',
            fontWeight: 800,
            fontSize: 15,
            padding: '12px 24px',
            cursor: busy ? 'not-allowed' : 'pointer'
          }}
        >
          {busy ? '⏳ AI đang xử lý & kết xuất...' : '✨ Tạo & Render Bài Giảng AI (Tự động)'}
        </button>
        <button
          type="button"
          className="quick-chip"
          disabled={busy || (externalApiRequired && !confirmExternalApi)}
          onClick={() => void generate()}
          style={{ padding: '10px 16px', fontWeight: 600, borderColor: '#64748B' }}
        >
          📋 Lập kế hoạch & Duyệt thủ công
        </button>
      </div>
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
          {(error.includes('503') || error.includes('quá tải') || error.includes('Gemini') || error.includes('gemini_transient_failed')) && (
            <button
              type="button"
              className="quick-chip"
              style={{ marginTop: '6px', background: 'rgba(34, 211, 238, 0.15)', borderColor: 'rgba(34, 211, 238, 0.4)', color: '#22d3ee' }}
              disabled={busy}
              onClick={() => {
                setMode('mock');
                setError('');
                void generate('mock');
              }}
            >
              ⚙️ Chuyển sang Mock offline (Khuyến nghị để không bị gián đoạn)
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

          <section aria-label="Cấu trúc sư phạm V3" style={{ margin: '16px 0', padding: 14, border: '1px solid #334155', borderRadius: 10, background: 'rgba(15, 23, 42, 0.55)' }}>
            <h3 style={{ marginTop: 0 }}>Đề cương sư phạm & chất lượng</h3>
            <p><strong>Chế độ học:</strong> {draft.lessonPlan.learningMode ?? 'chưa phân loại'}{draft.lessonPlan.targetLearners ? ` · ${draft.lessonPlan.targetLearners}` : ''}</p>
            <details open>
              <summary style={{ cursor: 'pointer', color: '#7DD3FC' }}>Pedagogical beats ({draft.lessonPlan.pedagogicalBeats?.length ?? 0})</summary>
              <ol style={{ paddingLeft: 22 }}>
                {(draft.lessonPlan.pedagogicalBeats ?? []).map((beat) => (
                  <li key={beat.beatId} style={{ margin: '8px 0' }}>
                    <strong>{beat.learningObjective}</strong>
                    <div style={{ color: '#CBD5E1', fontSize: 13 }}>{beat.educationalQuestion}</div>
                    <small>{beat.pedagogicalIntent} · {beat.visualIntent} · {beat.contentValidationStatus}</small>
                  </li>
                ))}
              </ol>
            </details>
            <details>
              <summary style={{ cursor: 'pointer', color: '#7DD3FC' }}>Worked examples ({draft.lessonPlan.workedExamples?.length ?? 0})</summary>
              {(draft.lessonPlan.workedExamples ?? []).map((example) => (
                <article key={example.exampleId} style={{ marginTop: 8, padding: 10, borderLeft: '3px solid #38BDF8' }}>
                  <strong>{example.title}</strong> · {example.verificationStatus}
                  <code style={{ display: 'block', margin: '6px 0', overflowWrap: 'anywhere' }}>{example.sourceExpression}</code>
                  <ol>{example.steps.map((step) => <li key={step.stepId}><code>{step.displayExpression}</code> — {step.narrationText} ({step.verificationStatus})</li>)}</ol>
                </article>
              ))}
            </details>
            <details open={draft.lessonPlan.educationalQuality?.overallStatus === 'BLOCKED' || draft.lessonPlan.educationalQuality?.overallStatus === 'NEEDS_REVIEW'}>
              <summary style={{ cursor: 'pointer', color: '#7DD3FC' }}>Educational quality: {draft.lessonPlan.educationalQuality?.overallStatus ?? 'chưa kiểm tra'}</summary>
              <ul>
                {(draft.lessonPlan.educationalQuality?.findings ?? []).map((finding) => (
                  <li key={finding.findingId} style={{ color: finding.status === 'BLOCKED' ? '#F87171' : finding.status === 'NEEDS_REVIEW' ? '#FBBF24' : '#CBD5E1' }}>
                    <strong>{finding.status}</strong> · {finding.message}{finding.remediation ? ` — ${finding.remediation}` : ''}
                  </li>
                ))}
              </ul>
            </details>
            <details>
              <summary style={{ cursor: 'pointer', color: '#7DD3FC' }}>Visual explanation intents</summary>
              <ul>{(draft.lessonPlan.visualIntentMappings ?? []).map((mapping) => <li key={mapping.visualIntent}><strong>{mapping.visualIntent}</strong>: {mapping.recommendedActions.join(', ')} · {mapping.readiness}{mapping.reviewReason ? ` — ${mapping.reviewReason}` : ''}</li>)}</ul>
            </details>
            {draft.lessonPlan.retrievalQuestion && <p><strong>Câu hỏi truy hồi:</strong> {draft.lessonPlan.retrievalQuestion}</p>}
          </section>

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
            <button className="btn-generate" disabled={busy || hasMathChanges || draft.status !== 'ready_for_approval' || draft.lessonPlan.capabilityReport.renderReadiness !== 'render_ready' || (narrationMode === 'gemini_tts' && !confirmExternalApi)} onClick={approve}>Duyệt & render MP4</button>
            <button className="quick-chip" disabled={busy || draft.status !== 'approved' || !draft.approvedArtifact || (narrationMode === 'gemini_tts' && !confirmExternalApi)} onClick={retryEnqueue}>Xếp hàng lại bản đã duyệt</button>
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
                  <button type="button" className="quick-chip" disabled={busy || (narrationMode === 'gemini_tts' && !confirmExternalApi)} onClick={resumeJob}>
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
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '100%',
                maxWidth: '380px',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#030712',
                border: '2px solid rgba(56, 189, 248, 0.4)',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.2)'
              }}>
                <div style={{
                  padding: '8px 14px',
                  background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid rgba(56, 189, 248, 0.2)'
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#38BDF8' }}>
                    📱 Lumina Video Player (9:16 HD)
                  </span>
                  <span style={{ fontSize: 11, background: '#10B981', color: '#000', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                    1080×1920 @ 30 FPS
                  </span>
                </div>
                <video
                  controls
                  playsInline
                  src={job.videoUrl}
                  style={{ width: '100%', display: 'block', maxHeight: '580px', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <a className="download-link" href={`${job.videoUrl}?download=1`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 700 }}>
                  ⬇️ Tải Video MP4 V3 (Bảo Trang TTS + BGM)
                </a>
                <a className="download-link" href={`/api/jobs/${job.jobId}/subtitles`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontWeight: 700 }}>
                  📝 Tải Phụ Đề (.SRT)
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
