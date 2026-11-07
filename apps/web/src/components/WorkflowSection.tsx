import React from 'react';

interface Step {
  num: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

export function WorkflowSection() {
  const steps: Step[] = [
    {
      num: '01',
      title: 'Prompt',
      desc: 'Nhập chủ đề khoa học hoặc công thức toán học cần truyền tải theo phong cách trực quan.',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    },
    {
      num: '02',
      title: 'AI Storyboard',
      desc: 'Gemini Agent phân tích sư phạm và xuất Scene JSON theo cấu trúc dữ liệu được kiểm định.',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )
    },
    {
      num: '03',
      title: 'Animation',
      desc: 'Remotion engine kết hợp animation components tái hiện chuyển động đồ họa và công thức chuẩn xác.',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </svg>
      )
    },
    {
      num: '04',
      title: 'Video',
      desc: 'Xuất video hoàn chỉnh tỷ lệ 9:16 tối ưu cho Reels/Shorts kèm lời thoại tiếng Việt và phụ đề.',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      )
    }
  ];

  return (
    <section className="workflow-section" aria-labelledby="workflow-title">
      <div className="section-header">
        <div className="section-tag">End-to-End Pipeline</div>
        <h2 id="workflow-title" className="section-title">
          Quy trình tạo video từ tri thức
        </h2>
      </div>

      <div className="workflow-grid">
        {steps.map((step) => (
          <article key={step.num} className="workflow-card">
            <div className="workflow-step-num" aria-hidden="true">
              {step.num}
            </div>
            <h3 className="workflow-card-title">{step.title}</h3>
            <p className="workflow-card-desc">{step.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

