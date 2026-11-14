'use client';

import React from 'react';
import Image from 'next/image';

interface HomeViewProps {
  onGoToCreate: () => void;
  onGoToAlbum: () => void;
  albumCount?: number;
}

export function HomeView({ onGoToCreate, onGoToAlbum, albumCount = 6 }: HomeViewProps) {
  return (
    <section style={{ width: '100%', padding: '2.5rem 0 5rem' }}>
      {/* ===================== HERO CARD MATCHING SCREEN (1) ===================== */}
      <div
        style={{
          position: 'relative',
          borderRadius: '32px',
          background:
            'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 45%, #FAF5FF 100%)',
          border: '1.5px solid rgba(224, 231, 255, 0.9)',
          boxShadow:
            '0 20px 45px -15px rgba(99, 102, 241, 0.12), 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          padding: '2.75rem 3rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1.1fr) minmax(240px, 1fr) minmax(280px, 1.05fr)',
          gap: '2.5rem',
          alignItems: 'center',
          minHeight: '380px',
        }}
      >
        {/* Soft background ambient glow spots */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            left: '20%',
            width: '260px',
            height: '260px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167, 139, 250, 0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-40px',
            right: '15%',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* 1. LEFT COLUMN: Hero Title & CTA */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Small pill tag */}
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.35rem 1rem',
              borderRadius: '9999px',
              backgroundColor: '#EDE9FE',
              border: '1px solid #DDD6FE',
              color: '#7C3AED',
              fontSize: '0.85rem',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.08)',
            }}
          >
            LuminaLearn
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: 'clamp(2rem, 3.2vw, 2.75rem)',
              fontWeight: 850,
              color: '#0F172A',
              lineHeight: 1.25,
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            Tạo video bài giảng <br />
            cùng AI
          </h1>

          {/* CTA Button */}
          <div style={{ paddingTop: '0.35rem' }}>
            <button
              type="button"
              onClick={onGoToCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.85rem 2.2rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 100%)',
                color: '#FFFFFF',
                fontSize: '1rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 10px 25px -4px rgba(124, 58, 237, 0.45)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 14px 28px -4px rgba(124, 58, 237, 0.55)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 10px 25px -4px rgba(124, 58, 237, 0.45)';
              }}
            >
              Thử tạo video ngay
            </button>
          </div>
        </div>

        {/* 2. CENTER COLUMN: 3D Cute Robot Mascot with glowing halo */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '280px',
          }}
        >
          {/* Glowing portal base */}
          <div
            style={{
              position: 'absolute',
              bottom: '15px',
              width: '210px',
              height: '55px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(124, 58, 237, 0.35) 0%, rgba(99, 102, 241, 0.15) 50%, transparent 80%)',
              border: '1.5px solid rgba(167, 139, 250, 0.4)',
              boxShadow: '0 0 25px rgba(124, 58, 237, 0.3)',
            }}
          />

          {/* Floating background video card illustration */}
          <div
            style={{
              position: 'absolute',
              top: '15px',
              right: '10px',
              width: '85px',
              height: '85px',
              opacity: 0.95,
              animation: 'floatSlow 4s ease-in-out infinite alternate',
            }}
          >
            <Image
              src="/form-illustration-transparent.png"
              alt="Floating Clapperboard and Books"
              width={85}
              height={85}
              style={{ objectFit: 'contain' }}
            />
          </div>

          {/* 3D Cute Mascot Robot */}
          <div
            style={{
              position: 'relative',
              width: '230px',
              height: '250px',
              filter: 'drop-shadow(0 16px 24px rgba(99, 102, 241, 0.2))',
              transition: 'transform 0.3s ease',
            }}
          >
            <Image
              src="/mascot-3d.png"
              alt="LuminaLearn AI 3D Mascot"
              fill
              sizes="(max-width: 768px) 180px, 230px"
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </div>

        {/* 3. RIGHT COLUMN: 3 Feature Highlight Cards Stacked */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            justifyContent: 'center',
          }}
        >
          {/* Feature Card 1 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1.1rem 1.6rem',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '18px',
              border: '1px solid rgba(226, 232, 240, 0.95)',
              boxShadow: '0 6px 18px -4px rgba(99, 102, 241, 0.08)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 22px -4px rgba(99, 102, 241, 0.14)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 6px 18px -4px rgba(99, 102, 241, 0.08)';
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
              Tạo nội dung tự động
            </h3>
          </div>

          {/* Feature Card 2 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1.1rem 1.6rem',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '18px',
              border: '1px solid rgba(226, 232, 240, 0.95)',
              boxShadow: '0 6px 18px -4px rgba(99, 102, 241, 0.08)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 22px -4px rgba(99, 102, 241, 0.14)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 6px 18px -4px rgba(99, 102, 241, 0.08)';
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
              Video trực quan, sinh động
            </h3>
          </div>

          {/* Feature Card 3 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1.1rem 1.6rem',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '18px',
              border: '1px solid rgba(226, 232, 240, 0.95)',
              boxShadow: '0 6px 18px -4px rgba(99, 102, 241, 0.08)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 22px -4px rgba(99, 102, 241, 0.14)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 6px 18px -4px rgba(99, 102, 241, 0.08)';
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
              Phù hợp nhiều môn học
            </h3>
          </div>
        </div>
      </div>

      {/* ===================== FEATURED VIDEO TEASER ROW ===================== */}
      <div style={{ marginTop: '3rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Kho video bài giảng tiêu biểu
            </h2>
          </div>

          <button
            type="button"
            onClick={onGoToAlbum}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.6rem 1.35rem',
              borderRadius: '9999px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #CBD5E1',
              color: '#4F46E5',
              fontSize: '0.875rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#6366F1';
              e.currentTarget.style.backgroundColor = '#EEF2FF';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.backgroundColor = '#FFFFFF';
            }}
          >
            <span>Xem toàn bộ Album ({albumCount} video)</span>
          </button>
        </div>

        {/* 4 Featured Preview Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {/* Card 1: Earth Seasons Clone */}
          <div
            onClick={onGoToAlbum}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '2px solid #F59E0B',
              boxShadow: '0 4px 18px rgba(245, 158, 11, 0.15)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(245, 158, 11, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 4px 18px rgba(245, 158, 11, 0.15)';
            }}
          >
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0F172A' }}>
              <Image
                src="/demo/thumb-seasons-frame.png"
                alt="Bốn mùa Trái Đất"
                fill
                style={{ objectFit: 'cover' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.85)',
                  backdropFilter: 'blur(6px)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                }}
              >
                Vật lý
              </span>
              <span
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                }}
              >
                ▶ 00:56
              </span>
            </div>
            <div style={{ padding: '1rem 1.15rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 850, color: '#0F172A', margin: 0, lineHeight: 1.4 }}>
                Vì sao mùa hè thì nóng, còn mùa đông lại lạnh? (Trục nghiêng 23.5°)
              </h3>
            </div>
          </div>

          {/* Card 2: Rainbow */}
          <div
            onClick={onGoToAlbum}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 18px rgba(99, 102, 241, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(99, 102, 241, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 4px 18px rgba(99, 102, 241, 0.05)';
            }}
          >
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0F172A' }}>
              <Image
                src="/demo/thumb-rainbow-frame.png"
                alt="Cầu vồng"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                unoptimized
                style={{ objectFit: 'cover' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(6px)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                }}
              >
                Vật lý
              </span>
              <span
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                }}
              >
                ▶ 00:56
              </span>
            </div>
            <div style={{ padding: '1rem 1.15rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 850, color: '#0F172A', margin: 0, lineHeight: 1.4 }}>
                Vì sao sau cơn mưa xuất hiện cầu vồng?
              </h3>
            </div>
          </div>

          {/* Card 2: Seasons */}
          <div
            onClick={onGoToAlbum}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 18px rgba(99, 102, 241, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(99, 102, 241, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 4px 18px rgba(99, 102, 241, 0.05)';
            }}
          >
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0F172A' }}>
              <Image
                src="/demo/thumb-seasons-frame.png"
                alt="Vì sao mùa hè nóng, mùa đông lạnh"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                unoptimized
                style={{ objectFit: 'cover' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(6px)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                }}
              >
                Vật lý
              </span>
              <span
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                }}
              >
                ▶ 00:56
              </span>
            </div>
            <div style={{ padding: '1rem 1.15rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 850, color: '#0F172A', margin: 0, lineHeight: 1.4 }}>
                Vì sao mùa hè thì nóng, còn mùa đông lại lạnh?
              </h3>
            </div>
          </div>

          {/* Card 3: Projectile Motion */}
          <div
            onClick={onGoToAlbum}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 18px rgba(99, 102, 241, 0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 28px -6px rgba(99, 102, 241, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 4px 18px rgba(99, 102, 241, 0.05)';
            }}
          >
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', backgroundColor: '#0F172A' }}>
              <Image
                src="/demo/thumb-projectile-motion.png"
                alt="Chuyển động ném ngang"
                fill
                style={{ objectFit: 'cover' }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(6px)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                }}
              >
                Vật lý
              </span>
              <span
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  backgroundColor: 'rgba(0,0,0,0.85)',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                }}
              >
                ▶ 01:00
              </span>
            </div>
            <div style={{ padding: '1rem 1.15rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 850, color: '#0F172A', margin: 0, lineHeight: 1.4 }}>
                Chuyển động ném ngang và phân tích quỹ đạo parabol
              </h3>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

