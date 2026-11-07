import React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-inner">
          <div className="footer-credits">
            <span>© {currentYear} LuminaLearn</span>
            <span aria-hidden="true">•</span>
            <span>AI-Powered STEM Video Platform</span>
          </div>

          <div>
            <span className="footer-tag">DevFest 2026</span>
            <span style={{ margin: '0 0.5rem' }}>|</span>
            <span>Local-first MVP</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

