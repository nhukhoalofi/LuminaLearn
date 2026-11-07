import React from 'react';

export function Hero() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="hero-pill">
        <span aria-hidden="true">✨</span>
        <span>AI-Powered STEM Video Generator</span>
      </div>

      <h1 id="hero-title" className="hero-title">
        Turn Knowledge Into{' '}
        <span className="hero-title-highlight">Visual Learning</span>
      </h1>

      <p className="hero-description">
        Create engaging STEM educational videos powered by AI. Transform complex
        mathematical concepts, scientific principles, and data insights into
        high-impact motion graphics.
      </p>
    </section>
  );
}

