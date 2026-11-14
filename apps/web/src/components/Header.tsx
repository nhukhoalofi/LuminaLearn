'use client';

import React from 'react';
import Image from 'next/image';

interface HeaderProps {
  activeTab: 'home' | 'create' | 'album';
  onTabChange: (tab: 'home' | 'create' | 'album') => void;
  albumCount?: number;
}

export function Header({ activeTab, onTabChange, albumCount }: HeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '4.5rem',
          }}
        >
          {/* Brand Logo & Title */}
          <div
            onClick={() => onTabChange('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #E0E7FF 0%, #EDE9FE 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                overflow: 'hidden',
                border: '1.5px solid #C7D2FE',
                position: 'relative',
              }}
            >
              <Image
                src="/mascot-avatar.png"
                alt="LuminaLearn Robot Mascot"
                width={36}
                height={36}
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                LuminaLearn
              </span>
              <span
                style={{
                  fontSize: '0.78rem',
                  color: '#64748B',
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                }}
              >
                AI tạo video bài giảng
              </span>
            </div>
          </div>

          {/* Navigation Tabs (Navbar: Trang chủ | Tạo video | Album video) */}
          <nav
            aria-label="Điều hướng chính"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#F1F5F9',
              padding: '0.3rem',
              borderRadius: '9999px',
              border: '1px solid #E2E8F0',
            }}
          >
            {/* Tab: Trang chủ */}
            <button
              type="button"
              onClick={() => onTabChange('home')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.55rem 1.25rem',
                borderRadius: '9999px',
                fontSize: '0.9rem',
                fontWeight: activeTab === 'home' ? 800 : 600,
                color: activeTab === 'home' ? '#6D28D9' : '#64748B',
                backgroundColor: activeTab === 'home' ? '#FFFFFF' : 'transparent',
                border: activeTab === 'home' ? '1.5px solid #8B5CF6' : '1.5px solid transparent',
                boxShadow:
                  activeTab === 'home'
                    ? '0 4px 12px rgba(139, 92, 246, 0.15)'
                    : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>Trang chủ</span>
            </button>

            {/* Tab: Tạo video */}
            <button
              type="button"
              onClick={() => onTabChange('create')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.55rem 1.25rem',
                borderRadius: '9999px',
                fontSize: '0.9rem',
                fontWeight: activeTab === 'create' ? 800 : 600,
                color: activeTab === 'create' ? '#6D28D9' : '#64748B',
                backgroundColor: activeTab === 'create' ? '#FFFFFF' : 'transparent',
                border: activeTab === 'create' ? '1.5px solid #8B5CF6' : '1.5px solid transparent',
                boxShadow:
                  activeTab === 'create'
                    ? '0 4px 12px rgba(139, 92, 246, 0.15)'
                    : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>Tạo video</span>
            </button>

            {/* Tab: Album video */}
            <button
              type="button"
              onClick={() => onTabChange('album')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.25rem',
                borderRadius: '9999px',
                fontSize: '0.9rem',
                fontWeight: activeTab === 'album' ? 800 : 600,
                color: activeTab === 'album' ? '#6D28D9' : '#64748B',
                backgroundColor: activeTab === 'album' ? '#FFFFFF' : 'transparent',
                border: activeTab === 'album' ? '1.5px solid #8B5CF6' : '1.5px solid transparent',
                boxShadow:
                  activeTab === 'album'
                    ? '0 4px 12px rgba(139, 92, 246, 0.15)'
                    : 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>Album video</span>
              {typeof albumCount === 'number' && albumCount > 0 && (
                <span
                  style={{
                    backgroundColor: activeTab === 'album' ? '#EDE9FE' : '#E2E8F0',
                    color: activeTab === 'album' ? '#6D28D9' : '#64748B',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.5rem',
                    borderRadius: '9999px',
                    marginLeft: '0.15rem',
                  }}
                >
                  {albumCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
