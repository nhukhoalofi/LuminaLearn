'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  getAgentStudioTopicsV3,
  type AgentStudioTeachingGoalV3,
  type AgentStudioVisualDirectionV3,
  type EducationalDomain
} from '@luminalearn/scene-schema';

interface CreateVideoViewProps {
  onVideoCreated?: () => void;
  onGoToAlbum?: () => void;
}

type PipelineStep = 1 | 2 | 3;

const AGENT_DOMAINS: Array<{ id: EducationalDomain; label: string; icon: string }> = [
  { id: 'physics', label: 'Vật lý & Smart Campus', icon: '🌿' },
  { id: 'mathematics', label: 'Toán học', icon: '∑' },
  { id: 'artificial_intelligence', label: 'Trí tuệ nhân tạo', icon: '✦' },
];

const AGENT_TOPICS = getAgentStudioTopicsV3();

interface SceneDraft {
  sceneId: string;
  title: string;
  durationSeconds: number;
  narrationText: string;
  sceneType?: string;
}

interface DraftState {
  draftId: string;
  version: number;
  title: string;
  learningObjectives: string[];
  scenes: SceneDraft[];
  totalDurationSeconds: number;
}

interface JobProgress {
  jobId: string;
  status: string;
  progress: number;
  message: string;
  videoUrl?: string;
  error?: string;
}

export function CreateVideoView({ onVideoCreated, onGoToAlbum }: CreateVideoViewProps) {
  const [selectedSubject, setSelectedSubject] = useState<EducationalDomain>('physics');
  const [selectedTopicId, setSelectedTopicId] = useState('physics.smart_campus.environment_procedural');
  const [teachingGoal, setTeachingGoal] = useState<AgentStudioTeachingGoalV3>('build_intuition');
  const [visualDirection, setVisualDirection] = useState<AgentStudioVisualDirectionV3>('cinematic_science');
  const [targetAudience, setTargetAudience] = useState<'high_school' | 'undergraduate' | 'general_public'>('high_school');
  const [targetDurationSeconds, setTargetDurationSeconds] = useState<60 | 90>(60);
  const [narrationMode, setNarrationMode] = useState<'none' | 'dutai_tts' | 'gemini_tts'>('dutai_tts');
  const [agentExecutionMode, setAgentExecutionMode] = useState<'mock' | 'gemini' | 'codex'>('mock');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [externalApiConfirmed, setExternalApiConfirmed] = useState(true);
  const [activeStep, setActiveStep] = useState<PipelineStep>(1);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [job, setJob] = useState<JobProgress | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleTopics = AGENT_TOPICS.filter((item) => item.domain === selectedSubject);
  const selectedTopicLabel = AGENT_TOPICS.find((item) => item.topicId === selectedTopicId)?.label ?? '';
  const requiresExternalApi = agentExecutionMode !== 'mock' || narrationMode !== 'none';

  // Poll job status until completion
  useEffect(() => {
    if (!job || ['completed', 'failed'].includes(job.status)) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${job.jobId}`, { cache: 'no-store' });
        if (res.ok) {
          const updated: JobProgress = await res.json();
          setJob(updated);
          if (updated.message) setStatusMessage(updated.message);

          if (updated.status === 'completed') {
            setActiveStep(3);
            setBusy(false);
            if (!updated.videoUrl && updated.jobId) {
              setJob({ ...updated, videoUrl: `/api/jobs/${updated.jobId}/video` });
            }
            if (onVideoCreated) onVideoCreated();
          } else if (updated.status === 'failed') {
            setError(updated.error || 'Quá trình xuất video gặp sự cố.');
            setBusy(false);
          }
        }
      } catch {
        // network retry
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [job, onVideoCreated]);

  // Step 1 -> Step 2: AI tạo kịch bản nội dung
  async function handleGenerateScript(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const selectedTopic = AGENT_TOPICS.find((item) => item.topicId === selectedTopicId);
    if (!selectedTopic) {
      setError('Vui lòng chọn một chủ đề đã sẵn sàng để dựng video.');
      return;
    }
    if (requiresExternalApi && !externalApiConfirmed) {
      setError('Vui lòng xác nhận sử dụng API ngoài và quota trước khi khởi chạy agent live hoặc TTS.');
      return;
    }

    setBusy(true);
    setError(null);
    setStatusMessage('Hệ thống đang lập kế hoạch bài giảng và chuẩn bị nội dung khoa học...');

    const chosenDuration = targetDurationSeconds;

    try {
      const supervisorRes = await fetch('/api/v3/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: `req_v3_${Date.now()}`,
          agentSelection: {
            topicId: selectedTopic.topicId,
            teachingGoal,
            visualDirection,
          },
          generationMode: agentExecutionMode === 'mock' ? 'mock' : 'live',
          agentProvider: agentExecutionMode === 'codex' ? 'codex' : 'gemini',
          targetAudience,
          targetDurationSeconds: chosenDuration,
          narrationMode,
          subtitlesEnabled: true,
          fps: 30,
          width: 1080,
          height: 1920,
          confirmExternalApi: requiresExternalApi && externalApiConfirmed,
        }),
      });

      if (!supervisorRes.ok) {
        const errData = await supervisorRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Không thể tạo kịch bản sư phạm.');
      }

      const planData = await supervisorRes.json();
      const plan = planData.lessonPlan;
      const rawScenes = plan?.storyboard?.scenes || [];

      const mappedScenes: SceneDraft[] = rawScenes.map((s: any, idx: number) => ({
        sceneId: s.sceneId || `sc_${idx + 1}`,
        title: s.title || `Cảnh ${idx + 1}`,
        durationSeconds: s.durationSeconds || Math.round(chosenDuration / (rawScenes.length || 1)),
        narrationText: s.narration?.vietnamese || s.narration?.subtitleVietnamese || '',
        sceneType: s.sceneType || 'concept',
      }));

      setDraft({
        draftId: planData.draftId,
        version: 1,
        title: plan?.title || selectedTopic.label,
        learningObjectives: plan?.learningObjectives || [
          'Hiểu rõ bản chất hiện tượng từ góc nhìn trực quan',
          'Khám phá cơ chế khoa học và định luật vận hành',
          'Vận dụng giải thích các hiện tượng thực tế sinh động',
        ],
        scenes: mappedScenes,
        totalDurationSeconds: plan?.storyboard?.totalDurationSeconds || chosenDuration,
      });

      // Chuyển sang Bước 2 để người dùng xem và chỉnh sửa kịch bản
      setActiveStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Update scene text locally in Step 2
  function handleSceneTitleChange(idx: number, newTitle: string) {
    if (!draft) return;
    const updatedScenes = [...draft.scenes];
    updatedScenes[idx] = { ...updatedScenes[idx], title: newTitle };
    setDraft({ ...draft, scenes: updatedScenes });
  }

  function handleSceneNarrationChange(idx: number, newText: string) {
    if (!draft) return;
    const updatedScenes = [...draft.scenes];
    updatedScenes[idx] = { ...updatedScenes[idx], narrationText: newText };
    setDraft({ ...draft, scenes: updatedScenes });
  }

  // Save edits back to draft API
  async function handleSaveDraftEdits() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setSaveSuccessNotice(false);

    try {
      const sceneTitles: Record<string, string> = {};
      const narrationTexts: Record<string, string> = {};
      for (const sc of draft.scenes) {
        sceneTitles[sc.sceneId] = sc.title;
        narrationTexts[sc.sceneId] = sc.narrationText;
      }

      const res = await fetch(`/api/v3/lessons/${draft.draftId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: draft.version,
          title: draft.title,
          sceneTitles,
          narrationTexts,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Không thể lưu bản chỉnh sửa kịch bản.');
      }

      const updated = await res.json();
      setDraft((prev) => (prev ? { ...prev, version: updated.version ?? prev.version + 1 } : null));
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Step 2 -> Step 3: Phê duyệt kịch bản & Xuất video
  async function handleApproveAndRender() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setStatusMessage('Đang lưu thay đổi kịch bản và xác nhận sư phạm...');

    try {
      // 1. Luôn đồng bộ lấy phiên bản mới nhất từ server trước khi thao tác
      const fetchDraftRes = await fetch(`/api/v3/lessons/${draft.draftId}/draft`);
      let currentVer = draft.version;
      if (fetchDraftRes.ok) {
        const latestRemoteDraft = await fetchDraftRes.json();
        if (typeof latestRemoteDraft.version === 'number') {
          currentVer = latestRemoteDraft.version;
        }
      }

      // 2. Lưu các chỉnh sửa mới nhất nếu có
      const sceneTitles: Record<string, string> = {};
      const narrationTexts: Record<string, string> = {};
      for (const sc of draft.scenes) {
        sceneTitles[sc.sceneId] = sc.title;
        narrationTexts[sc.sceneId] = sc.narrationText;
      }

      const patchRes = await fetch(`/api/v3/lessons/${draft.draftId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: currentVer,
          title: draft.title,
          sceneTitles,
          narrationTexts,
        }),
      });

      if (patchRes.ok) {
        const patchData = await patchRes.json();
        currentVer = patchData.version ?? currentVer + 1;
      } else {
        const errPatch = await patchRes.json().catch(() => ({}));
        if (errPatch.currentVersion) {
          currentVer = errPatch.currentVersion;
        } else {
          throw new Error(errPatch.message || errPatch.error || 'Lỗi khi cập nhật kịch bản.');
        }
      }

      // 3. Giáo viên xác nhận rà soát ngữ nghĩa
      setStatusMessage('Xác nhận rà soát sư phạm & ký duyệt kịch bản...');
      const reviewRes = await fetch(`/api/v3/lessons/${draft.draftId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: currentVer,
          semanticReviewConfirmed: true,
        }),
      });

      let approveExpectedVersion = currentVer + 1;
      if (reviewRes.ok) {
        const revData = await reviewRes.json();
        approveExpectedVersion = revData.version ?? approveExpectedVersion;
      } else {
        const errRev = await reviewRes.json().catch(() => ({}));
        if (errRev.currentVersion) {
          approveExpectedVersion = errRev.currentVersion;
        } else {
          throw new Error(errRev.message || errRev.error || 'Lỗi khi rà soát sư phạm.');
        }
      }

      // 4. Phê duyệt & xếp hàng xuất video
      setStatusMessage('Bắt đầu tạo video với thuyết minh giọng đọc...');
      setActiveStep(3);

      const approveRes = await fetch(`/api/v3/lessons/${draft.draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: approveExpectedVersion,
          note: `Phê duyệt kịch bản giáo viên: ${draft.title} (${draft.totalDurationSeconds}s · ${narrationMode})`,
          confirmExternalApi: narrationMode !== 'none',
        }),
      });

      if (!approveRes.ok) {
        const errApprove = await approveRes.json().catch(() => ({}));
        const detailMsg = errApprove.message || errApprove.error;
        throw new Error(detailMsg ? `Lỗi phê duyệt: ${detailMsg}` : 'Lỗi khi phê duyệt và xuất video.');
      }

      const approveData = await approveRes.json();
      if (approveData.job) {
        setJob(approveData.job);
        setStatusMessage(approveData.job.message || 'Đang kết xuất video bài giảng...');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
      setActiveStep(2);
    }
  }

  function handleReset() {
    setJob(null);
    setDraft(null);
    setActiveStep(1);
    setBusy(false);
    setError(null);
  }

  return (
    <section style={{ width: '100%', padding: '2rem 0 4rem' }}>
      {/* Centered Main Form Card with Consistent Width Across All Steps (No jumping layout) */}
      <div
        style={{
          maxWidth: '880px',
          margin: '0 auto',
          backgroundColor: '#FFFFFF',
          borderRadius: '28px',
          padding: '2.25rem 2.5rem',
          boxShadow:
            '0 20px 40px -15px rgba(99, 102, 241, 0.08), 0 0 1px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Step Progress Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1.75rem',
            }}
          >
            {/* Step 1 */}
            <div
              onClick={() => {
                if (activeStep === 2 && !busy) setActiveStep(1);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: activeStep === 2 ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 1 ? '#7C3AED' : '#E2E8F0',
                  color: activeStep >= 1 ? '#FFFFFF' : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                1
              </div>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 1 ? 700 : 500,
                  color: activeStep === 1 ? '#7C3AED' : '#475569',
                }}
              >
                Nhập chủ đề
              </span>
            </div>

            {/* Line 1 */}
            <div
              style={{
                flex: 1,
                height: '2px',
                backgroundColor: activeStep >= 2 ? '#7C3AED' : '#E2E8F0',
                margin: '0 0.6rem',
                minWidth: '24px',
              }}
            />

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 2 ? '#7C3AED' : '#E2E8F0',
                  color: activeStep >= 2 ? '#FFFFFF' : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                2
              </div>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 2 ? 700 : 500,
                  color: activeStep === 2 ? '#7C3AED' : '#64748B',
                }}
              >
                AI tạo nội dung
              </span>
            </div>

            {/* Line 2 */}
            <div
              style={{
                flex: 1,
                height: '2px',
                backgroundColor: activeStep >= 3 ? '#7C3AED' : '#E2E8F0',
                margin: '0 0.6rem',
                minWidth: '24px',
              }}
            />

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: activeStep >= 3 ? '#7C3AED' : '#E2E8F0',
                  color: activeStep >= 3 ? '#FFFFFF' : '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                3
              </div>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: activeStep === 3 ? 700 : 500,
                  color: activeStep === 3 ? '#7C3AED' : '#64748B',
                }}
              >
                Xuất video
              </span>
            </div>
          </div>

          {/* ===================== BƯỚC 1: NHẬP CHỦ ĐỀ ===================== */}
          {activeStep === 1 && (
            <form onSubmit={handleGenerateScript} style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  marginBottom: '0.75rem',
                }}
              >
                <span>Agent Studio — chọn nhiệm vụ cho đội agent</span>
              </div>

              <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
                <div
                  role="status"
                  aria-label="Chủ đề đã chọn từ capability registry"
                  style={{
                    width: '100%',
                    padding: '0.9rem 1rem 1.8rem 1rem',
                    borderRadius: '16px',
                    border: '1.5px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.95rem',
                    color: '#0F172A',
                    lineHeight: 1.5,
                    minHeight: '82px',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 750,
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {selectedTopicLabel}
                </div>
                <span
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '12px',
                    fontSize: '0.75rem',
                    color: '#94A3B8',
                  }}
                >
                  Chủ đề đã đăng ký
                </span>
              </div>

              {/* Quick suggestions - Tối giản 4-5 chủ đề, màu sắc đồng nhất nhẹ nhàng */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  flexWrap: 'wrap',
                  marginBottom: '1.25rem',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>Gợi ý chủ đề:</span>
                {visibleTopics.slice(0, 4).map((item) => {
                  const isCurSelected = item.topicId === selectedTopicId;
                  return (
                    <button
                      key={item.topicId}
                      type="button"
                      onClick={() => setSelectedTopicId(item.topicId)}
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: isCurSelected ? 700 : 500,
                        padding: '0.35rem 0.85rem',
                        borderRadius: '9999px',
                        backgroundColor: isCurSelected ? '#EEF2FF' : '#F8FAFC',
                        border: isCurSelected ? '1.5px solid #6366F1' : '1px solid #E2E8F0',
                        color: isCurSelected ? '#4F46E5' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Subject Selection */}
              <div style={{ marginBottom: '1.75rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: '#0F172A',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span>Môn học</span>
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))',
                    gap: '0.65rem',
                  }}
                >
                  {AGENT_DOMAINS.map((subj) => {
                    const isSelected = selectedSubject === subj.id;
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(subj.id);
                          const firstTopic = AGENT_TOPICS.find((item) => item.domain === subj.id);
                          if (firstTopic) setSelectedTopicId(firstTopic.topicId);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.75rem 0.5rem',
                          borderRadius: '12px',
                          border: isSelected ? '1.5px solid #8B5CF6' : '1.5px solid #E2E8F0',
                          backgroundColor: isSelected ? '#F5F3FF' : '#FFFFFF',
                          color: isSelected ? '#6D28D9' : '#475569',
                          fontWeight: isSelected ? 800 : 600,
                          fontSize: '0.925rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected
                            ? '0 2px 8px rgba(139, 92, 246, 0.15)'
                            : 'none',
                        }}
                      >
                        <span>{subj.icon} {subj.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle Cấu hình nâng cao - Ẩn mặc định để giao diện gọn gàng cho Smart Campus */}
              <div style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'none',
                    border: 'none',
                    color: '#6366F1',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '0.2rem 0',
                  }}
                >
                  <span>{showAdvancedSettings ? '▼ Thu gọn cấu hình chi tiết' : '► Mở rộng cấu hình chuyên sâu (Agent, Đối tượng, Giọng đọc)'}</span>
                </button>
              </div>

              {showAdvancedSettings && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                    gap: '0.8rem',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    borderRadius: '16px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#334155', fontWeight: 700 }}>
                    Agent lập kế hoạch
                    <select value={agentExecutionMode} onChange={(e) => setAgentExecutionMode(e.target.value as typeof agentExecutionMode)} style={{ padding: '0.65rem', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                      <option value="mock">Offline deterministic — không dùng quota</option>
                      <option value="gemini">Gemini Live Agent — dùng Gemini API</option>
                      <option value="codex">Codex Live Agent — dùng OpenAI API</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#334155', fontWeight: 700 }}>
                    Mục tiêu sư phạm
                    <select value={teachingGoal} onChange={(e) => setTeachingGoal(e.target.value as AgentStudioTeachingGoalV3)} style={{ padding: '0.65rem', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                      <option value="build_intuition">Xây dựng trực giác</option>
                      <option value="explain_mechanism">Giải thích cơ chế</option>
                      <option value="real_world_application">Liên hệ ứng dụng thực tế</option>
                      <option value="exam_review">Ôn tập và lỗi sai thường gặp</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#334155', fontWeight: 700 }}>
                    Định hướng hình ảnh
                    <select value={visualDirection} onChange={(e) => setVisualDirection(e.target.value as AgentStudioVisualDirectionV3)} style={{ padding: '0.65rem', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                      <option value="cinematic_science">Khoa học điện ảnh</option>
                      <option value="clean_infographic">Infographic giáo dục</option>
                      <option value="mathematical_visualization">Trực quan hóa toán học</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#334155', fontWeight: 700 }}>
                    Người học
                    <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value as typeof targetAudience)} style={{ padding: '0.65rem', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                      <option value="high_school">Học sinh THPT</option>
                      <option value="undergraduate">Sinh viên</option>
                      <option value="general_public">Người học phổ thông</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#334155', fontWeight: 700 }}>
                    Thời lượng
                    <select value={targetDurationSeconds} onChange={(e) => setTargetDurationSeconds(Number(e.target.value) as 60 | 90)} style={{ padding: '0.65rem', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                      <option value={60}>60 giây — demo nhanh</option>
                      <option value={90}>90 giây — giải thích sâu hơn</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '0.35rem', color: '#334155', fontWeight: 700 }}>
                    Giọng đọc
                    <select value={narrationMode} onChange={(e) => setNarrationMode(e.target.value as typeof narrationMode)} style={{ padding: '0.65rem', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                      <option value="dutai_tts">DUTAI TTS — giọng chuẩn tự nhiên</option>
                      <option value="none">Không audio — offline</option>
                      <option value="gemini_tts">Gemini TTS — dùng quota</option>
                    </select>
                  </label>
                </div>
              )}

              {requiresExternalApi && (
                <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', marginBottom: '1.25rem', color: '#92400E', fontWeight: 650 }}>
                  <input
                    type="checkbox"
                    checked={externalApiConfirmed}
                    onChange={(event) => setExternalApiConfirmed(event.target.checked)}
                  />
                  Tôi xác nhận cho phép gọi API ngoài và sử dụng quota cho cấu hình agent/TTS đã chọn.
                </label>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy || (requiresExternalApi && !externalApiConfirmed)}
                style={{
                  alignSelf: 'flex-end',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.85rem 2.2rem',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 50%, #9333EA 100%)',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  fontWeight: 800,
                  border: 'none',
                  cursor: busy || (requiresExternalApi && !externalApiConfirmed) ? 'not-allowed' : 'pointer',
                  opacity: busy || (requiresExternalApi && !externalApiConfirmed) ? 0.65 : 1,
                  boxShadow: '0 8px 20px -4px rgba(124, 58, 237, 0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{busy ? 'Đội agent đang lập kế hoạch...' : 'Khởi chạy đội Agent'}</span>
              </button>
            </form>
          )}

          {/* ===================== BƯỚC 2: AI TẠO NỘI DUNG (HIỂN THỊ KỊCH BẢN & CHO PHÉP SỬA) ===================== */}
          {activeStep === 2 && draft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {saveSuccessNotice && (
                <div
                  style={{
                    padding: '0.65rem 1rem',
                    backgroundColor: '#ECFDF5',
                    borderRadius: '12px',
                    border: '1px solid #A7F3D0',
                    color: '#059669',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                  }}
                >
                  ✓ Đã lưu thay đổi kịch bản!
                </div>
              )}

              {/* Tiêu đề bài giảng (Editable) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '0.35rem',
                  }}
                >
                  Tiêu đề bài học:
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    outline: 'none',
                    backgroundColor: '#FFFFFF',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#7C3AED')}
                  onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
                />
              </div>

              {/* Mục tiêu sư phạm */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>
                  Mục tiêu sư phạm:
                </span>
                <ul
                  style={{
                    margin: '0.4rem 0 0 1.25rem',
                    fontSize: '0.825rem',
                    color: '#64748B',
                    lineHeight: 1.5,
                  }}
                >
                  {draft.learningObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>

              {/* Danh sách từng phân cảnh (Scenes) có thể chỉnh sửa */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <label style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1E293B' }}>
                    Phân cảnh bài giảng ({draft.scenes.length} cảnh · {draft.totalDurationSeconds}s):
                  </label>
                  <span style={{ fontSize: '0.8rem', color: '#6366F1', fontWeight: 700 }}>
                    Giọng đọc: Bảo Trang
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {draft.scenes.map((scene, idx) => (
                    <div
                      key={scene.sceneId}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1.5px solid #E2E8F0',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      }}
                    >
                      {/* Tiêu đề & thời lượng cảnh */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              backgroundColor: '#EEF2FF',
                              color: '#4F46E5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={scene.title}
                            onChange={(e) => handleSceneTitleChange(idx, e.target.value)}
                            style={{
                              flex: 1,
                              border: 'none',
                              borderBottom: '1px dashed #CBD5E1',
                              padding: '2px 4px',
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              color: '#1E293B',
                              outline: 'none',
                            }}
                            placeholder={`Tên phân cảnh ${idx + 1}`}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: '#64748B',
                              backgroundColor: '#F1F5F9',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              fontWeight: 600,
                            }}
                          >
                            {scene.durationSeconds}s
                          </span>
                        </div>
                      </div>

                      {/* Lời dẫn thuyết minh có thể sửa */}
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '0.78rem',
                            color: '#64748B',
                            fontWeight: 600,
                            marginBottom: '0.25rem',
                          }}
                        >
                          Lời dẫn thuyết minh (Bạn có thể sửa lời thoại dưới đây):
                        </label>
                        <textarea
                          rows={2}
                          value={scene.narrationText}
                          onChange={(e) => handleSceneNarrationChange(idx, e.target.value)}
                          placeholder="Nhập lời thoại thuyết minh cho cảnh này..."
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '10px',
                            border: '1.5px solid #E2E8F0',
                            fontSize: '0.875rem',
                            color: '#0F172A',
                            lineHeight: 1.5,
                            outline: 'none',
                            resize: 'vertical',
                            backgroundColor: '#F8FAFC',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = '#8B5CF6')}
                          onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Bar Bước 2 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '1rem',
                  borderTop: '1px solid #E2E8F0',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveStep(1)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '12px',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  Đổi chủ đề khác
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleSaveDraftEdits}
                    style={{
                      padding: '0.65rem 1.25rem',
                      borderRadius: '12px',
                      backgroundColor: '#FFFFFF',
                      border: '1.5px solid #8B5CF6',
                      color: '#6D28D9',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Lưu chỉnh sửa
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleApproveAndRender}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.75rem 1.85rem',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 50%, #9333EA 100%)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      border: 'none',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      boxShadow: '0 8px 20px -4px rgba(124, 58, 237, 0.4)',
                    }}
                  >
                    <span>{busy ? 'Đang chuẩn bị...' : 'Phê duyệt & Xuất video'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== BƯỚC 3: XUẤT VIDEO (TIẾN TRÌNH RENDER & KẾT QUẢ) ===================== */}
          {activeStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Đang render */}
              {(!job || job.status !== 'completed') && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '2rem 1rem',
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      border: '4px solid #EDE9FE',
                      borderTopColor: '#7C3AED',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '1.25rem',
                    }}
                  />

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.4rem' }}>
                    Đang tạo video bài giảng
                  </h3>

                  <p style={{ fontSize: '0.925rem', color: '#64748B', maxWidth: '460px', marginBottom: '1.5rem' }}>
                    {statusMessage || 'Hệ thống đang xử lý hình ảnh và thuyết minh giọng đọc...'}
                  </p>

                  {job && (
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '440px',
                        backgroundColor: '#F1F5F9',
                        borderRadius: '9999px',
                        height: '10px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.max(job.progress, 15)}%`,
                          background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #A855F7)',
                          borderRadius: '9999px',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Render hoàn tất */}
              {job?.status === 'completed' && job.videoUrl && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    animation: 'fadeIn 0.3s ease-out',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      borderRadius: '14px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#065F46' }}>
                        Video bài giảng đã được tạo thành công!
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      style={{
                        fontSize: '0.8rem',
                        color: '#059669',
                        backgroundColor: 'transparent',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + Tạo bài khác
                    </button>
                  </div>

                  {/* Video Player */}
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      backgroundColor: '#000000',
                      borderRadius: '16px',
                      overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <video
                      src={job.videoUrl}
                      controls
                      autoPlay
                      playsInline
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <a
                      href={`${job.videoUrl}?download=1`}
                      download="luminalearn-educational-video.mp4"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '12px',
                        backgroundColor: '#F3E8FF',
                        color: '#7C3AED',
                        fontWeight: 700,
                        fontSize: '0.925rem',
                        textDecoration: 'none',
                        border: '1.5px solid #DDD6FE',
                        cursor: 'pointer',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Tải video MP4</span>
                    </a>

                    {onGoToAlbum && (
                      <button
                        type="button"
                        onClick={onGoToAlbum}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.75rem 1.5rem',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '0.925rem',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                        }}
                      >
                        <span>Xem trong Album video</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.85rem 1rem',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '12px',
                color: '#B91C1C',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#B91C1C',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }
