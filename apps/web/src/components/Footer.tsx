import React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '1px solid #E2E8F0',
        backgroundColor: '#FFFFFF',
        padding: '1.75rem 0',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem',
            color: '#64748B',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: '#0F172A' }}>© {currentYear} LuminaLearn</span>
            <span>•</span>
            <span>Nền tảng AI tạo video bài giảng STEM</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Video bài giảng trực quan</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
