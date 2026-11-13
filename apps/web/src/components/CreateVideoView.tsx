'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface CreateVideoViewProps {
  onVideoCreated?: () => void;
  onGoToAlbum?: () => void;
}

type SubjectType = 'physics' | 'math' | 'chemistry' | 'biology';

interface SubjectOption {
  id: SubjectType;
  label: string;
  icon: string;
  domain: 'physics' | 'mathematics';
}

const SUBJECTS: SubjectOption[] = [
  { id: 'physics', label: 'Vật lý', icon: '', domain: 'physics' },
  { id: 'math', label: 'Toán học', icon: '', domain: 'mathematics' },
  { id: 'chemistry', label: 'Hóa học', icon: '', domain: 'physics' },
  { id: 'biology', label: 'Sinh học', icon: '', domain: 'physics' },
];

const QUICK_SUGGESTIONS = [
  {
    topic: 'Vì sao sau cơn mưa xuất hiện cầu vồng?',
    subject: 'physics' as SubjectType,
    label: 'Vì sao có cầu vồng?',
  },
  {
    topic: 'Vì sao mùa hè thì nóng, còn mùa đông lại lạnh?',
    subject: 'physics' as SubjectType,
    label: 'Vì sao mùa hè nóng, mùa đông lạnh?',
  },
  {
    topic: 'Làm thế nào điện thoại thông minh kết nối cuộc gọi?',
    subject: 'physics' as SubjectType,
    label: 'Điện thoại kết nối cuộc gọi',
  },
  {
    topic: 'Vì sao ngoài lon nước lạnh xuất hiện giọt sương?',
    subject: 'physics' as SubjectType,
    label: 'Đọng sương lon nước',
  },
  {
    topic: 'Định lý Pythagoras và ứng dụng hình học trực quan',
    subject: 'math' as SubjectType,
    label: 'Định lý Pythagoras',
  },
  {
    topic: 'Chuyển động ném ngang và phân tích quỹ đạo parabol',
    subject: 'physics' as SubjectType,
    label: 'Chuyển động ném ngang',
  },
  {
    topic: 'Vì sao mây thường màu trắng nhưng mây giông lại xám đen?',
    subject: 'physics' as SubjectType,
    label: 'Vì sao mây giông đen?',
  },
  {
    topic: 'Định luật II Newton và mối quan hệ F = m·a',
    subject: 'physics' as SubjectType,
    label: 'Định luật II Newton',
  },
  {
    topic: 'Con lắc đơn và dao động điều hòa góc nhỏ',
    subject: 'physics' as SubjectType,
    label: 'Con lắc đơn',
  },
  {
    topic: 'Sự truyền sóng cơ học và mối quan hệ v = λ·f',
    subject: 'physics' as SubjectType,
    label: 'Sóng cơ học',
  },
  {
    topic: 'Định luật bảo toàn cơ năng trong trọng trường',
    subject: 'physics' as SubjectType,
    label: 'Bảo toàn cơ năng',
  },
];

type PipelineStep = 1 | 2 | 3;

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
  const [topic, setTopic] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectType>('physics');
  const [activeStep, setActiveStep] = useState<PipelineStep>(1);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [job, setJob] = useState<JobProgress | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const activeTopic = topic.trim() || 'Vì sao sau cơn mưa xuất hiện cầu vồng?';

    setBusy(true);
    setError(null);
    setStatusMessage('Hệ thống đang lập kế hoạch bài giảng và chuẩn bị nội dung khoa học...');

    const chosenSubject = SUBJECTS.find((s) => s.id === selectedSubject) || SUBJECTS[0];
    const isPhone = /điện thoại|phone|nghe gọi|viễn thông|bts/i.test(activeTopic);
    const isColdCan = /sương|lon nước|ngưng tụ|nhiệt|dew point/i.test(activeTopic);
    const chosenDuration = isPhone ? 90 : isColdCan ? 64 : 60;

    try {
      const supervisorRes = await fetch('/api/v3/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: `req_v3_${Date.now()}`,
          topic: activeTopic,
          domain: chosenSubject.domain,
          generationMode: 'mock',
          targetAudience: 'high_school',
          targetDurationSeconds: chosenDuration,
          narrationMode: 'dutai_tts',
          subtitlesEnabled: true,
          fps: 30,
          width: 1080,
          height: 1920,
          confirmExternalApi: true,
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
        title: plan?.title || activeTopic,
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
      // 1. Lưu các chỉnh sửa mới nhất nếu có
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
          expectedVersion: draft.version,
          title: draft.title,
          sceneTitles,
          narrationTexts,
        }),
      });

      let currentVer = draft.version;
      if (patchRes.ok) {
        const patchData = await patchRes.json();
        currentVer = patchData.version ?? currentVer + 1;
      }

      // 2. Giáo viên xác nhận rà soát ngữ nghĩa
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
      }

      // 3. Phê duyệt & xếp hàng xuất video
      setStatusMessage('Bắt đầu tạo video với thuyết minh giọng đọc...');
      setActiveStep(3);

      const approveRes = await fetch(`/api/v3/lessons/${draft.draftId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedVersion: approveExpectedVersion,
          note: `Phê duyệt kịch bản giáo viên: ${draft.title} (${draft.totalDurationSeconds}s · DUTAI TTS Bảo Trang)`,
          confirmExternalApi: true,
        }),
      });

      if (!approveRes.ok) {
        const errApprove = await approveRes.json().catch(() => ({}));
        throw new Error(errApprove.message || 'Lỗi khi phê duyệt và xuất video.');
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
              <label
                htmlFor="topic-input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  marginBottom: '0.75rem',
                }}
              >
                <span>Bạn muốn tạo video về chủ đề gì?</span>
              </label>

              <div style={{ position: 'relative', marginBottom: '0.65rem' }}>
                <textarea
                  id="topic-input"
                  rows={3}
                  maxLength={200}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ví dụ: Vì sao có cầu vồng?, Định lý Pythagoras, Chuyển động ném ngang, ..."
                  style={{
                    width: '100%',
                    padding: '0.9rem 1rem 1.8rem 1rem',
                    borderRadius: '16px',
                    border: '1.5px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.95rem',
                    color: '#0F172A',
                    lineHeight: 1.5,
                    resize: 'none',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#8B5CF6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E2E8F0';
                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '12px',
                    fontSize: '0.75rem',
                    color: '#94A3B8',
                  }}
                >
                  {topic.length}/200
                </span>
              </div>

              {/* Quick suggestions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  flexWrap: 'wrap',
                  marginBottom: '1.5rem',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94A3B8' }}>Gợi ý nhanh:</span>
                {QUICK_SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTopic(item.topic);
                      setSelectedSubject(item.subject);
                    }}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      padding: '0.3rem 0.75rem',
                      borderRadius: '9999px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      color: '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#EEF2FF';
                      e.currentTarget.style.borderColor = '#C7D2FE';
                      e.currentTarget.style.color = '#4F46E5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#F8FAFC';
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.color = '#475569';
                    }}
                  >
                    {item.label}
                  </button>
                ))}
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
                  {SUBJECTS.map((subj) => {
                    const isSelected = selectedSubject === subj.id;
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => setSelectedSubject(subj.id)}
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
                        <span>{subj.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={busy}
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
                  cursor: busy ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 20px -4px rgba(124, 58, 237, 0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{busy ? 'Đang tạo kịch bản...' : 'Tiếp tục'}</span>
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
