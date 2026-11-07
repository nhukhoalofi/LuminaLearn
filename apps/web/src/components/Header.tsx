import React from 'react';

export function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <div className="header-inner">
          <a href="/" className="brand-link" aria-label="LuminaLearn Home">
            <div className="brand-logo-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="#070B14"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 17L12 22L22 17"
                  stroke="#070B14"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="#070B14"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="brand-title">LuminaLearn</span>
          </a>

          <div className="header-status-badge">
            <span className="status-dot" aria-hidden="true" />
            <span>DevFest 2026 • Phase 1</span>
          </div>
        </div>
      </div>
    </header>
  );
}

