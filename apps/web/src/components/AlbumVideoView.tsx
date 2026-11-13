'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import type { AlbumVideoItem } from '@/app/api/album/route';

interface AlbumVideoViewProps {
  onGoToCreate?: () => void;
  onSelectVideoForPresentation?: (video: AlbumVideoItem) => void;
}

export function AlbumVideoView({ onGoToCreate }: AlbumVideoViewProps) {
  const [videos, setVideos] = useState<AlbumVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [playingVideo, setPlayingVideo] = useState<AlbumVideoItem | null>(null);
  const [savedFilterOnly, setSavedFilterOnly] = useState(false);

  // Fetch real videos from /api/album
  async function loadVideos() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/album', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.videos) {
        setVideos(data.videos);
      }
    } catch (err) {
      setError('Không thể tải danh sách video từ hệ thống lưu trữ.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVideos();
  }, []);

  // Toggle save for presentation
  async function toggleSaveVideo(e: React.MouseEvent, video: AlbumVideoItem) {
    e.stopPropagation();
    const nextSaved = !video.isSaved;

    // Optimistic UI update
    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, isSaved: nextSaved } : v))
    );

    try {
      await fetch('/api/album', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, isSaved: nextSaved }),
      });
    } catch {
      // Revert if failed
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, isSaved: !nextSaved } : v))
      );
    }
  }

  // Filter videos
  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const matchesSearch =
        !searchQuery.trim() ||
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (video.description &&
          video.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        video.subject.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject =
        selectedSubject === 'all' || video.subject === selectedSubject;

      const matchesSaved = !savedFilterOnly || video.isSaved;

      return matchesSearch && matchesSubject && matchesSaved;
    });
  }, [videos, searchQuery, selectedSubject, savedFilterOnly]);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    videos.forEach((v) => {
      if (v.subject) set.add(v.subject);
    });
    return Array.from(set);
  }, [videos]);

  return (
    <section style={{ width: '100%', padding: '2rem 0 5rem' }}>
      {/* Album Header matching reference */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        {/* Left Title & Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.35)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Album video
            </h1>
            <p style={{ fontSize: '0.9rem', color: '#64748B', marginTop: '0.2rem' }}>
              Kho video bài giảng do LuminaLearn tạo ra
            </p>
          </div>
        </div>

        {/* Right Search & Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Search bar */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              style={{
                position: 'absolute',
                left: '12px',
                width: '16px',
                height: '16px',
                color: '#94A3B8',
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm video..."
              style={{
                padding: '0.55rem 1rem 0.55rem 2.25rem',
                borderRadius: '12px',
                border: '1.5px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                fontSize: '0.9rem',
                color: '#0F172A',
                outline: 'none',
                width: '220px',
                transition: 'all 0.2s ease',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Grid / List View Toggle */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Xem dạng lưới"
              style={{
                background: viewMode === 'grid' ? '#6366F1' : 'transparent',
                color: viewMode === 'grid' ? '#FFFFFF' : '#64748B',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 9px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zm-11 11h7v7H3v-7zm11 0h7v7h-7v-7z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Xem dạng danh sách"
              style={{
                background: viewMode === 'list' ? '#6366F1' : 'transparent',
                color: viewMode === 'list' ? '#FFFFFF' : '#64748B',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 9px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
              </svg>
            </button>
          </div>

          {/* Saved Presentation Filter */}
          <button
            type="button"
            onClick={() => setSavedFilterOnly(!savedFilterOnly)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.9rem',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: savedFilterOnly ? '#FEF3C7' : '#FFFFFF',
              color: savedFilterOnly ? '#B45309' : '#64748B',
              border: savedFilterOnly ? '1.5px solid #F59E0B' : '1.5px solid #E2E8F0',
              cursor: 'pointer',
            }}
          >
            <span>{savedFilterOnly ? '⭐ Đang lọc trình chiếu' : '⭐ Trình chiếu'}</span>
          </button>
        </div>
      </div>

      {/* Filter Chips by Subject */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '1.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedSubject('all')}
          style={{
            padding: '0.4rem 1rem',
            borderRadius: '9999px',
            fontSize: '0.85rem',
            fontWeight: selectedSubject === 'all' ? 700 : 500,
            backgroundColor: selectedSubject === 'all' ? '#4F46E5' : '#FFFFFF',
            color: selectedSubject === 'all' ? '#FFFFFF' : '#64748B',
            border: selectedSubject === 'all' ? '1px solid #4F46E5' : '1px solid #E2E8F0',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Tất cả ({videos.length})
        </button>
        {subjects.map((subj) => (
          <button
            key={subj}
            type="button"
            onClick={() => setSelectedSubject(subj)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '9999px',
              fontSize: '0.85rem',
              fontWeight: selectedSubject === subj ? 700 : 500,
              backgroundColor: selectedSubject === subj ? '#EEF2FF' : '#FFFFFF',
              color: selectedSubject === subj ? '#4F46E5' : '#64748B',
              border: selectedSubject === subj ? '1.5px solid #6366F1' : '1px solid #E2E8F0',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {subj} ({videos.filter((v) => v.subject === subj).length})
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 1rem',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            border: '1px solid #E2E8F0',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              width: '36px',
              height: '36px',
              border: '3px solid #E2E8F0',
              borderTopColor: '#6366F1',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ marginTop: '1rem', color: '#64748B', fontSize: '0.95rem' }}>
            Đang tải kho video thực tế từ server...
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '16px',
            color: '#B91C1C',
            textAlign: 'center',
          }}
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={loadVideos}
            style={{
              marginTop: '0.75rem',
              padding: '0.4rem 1rem',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredVideos.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            border: '1px solid #E2E8F0',
          }}
        >
          <p style={{ fontSize: '1.1rem', color: '#475569', fontWeight: 600 }}>
            Không tìm thấy video nào phù hợp với từ khóa
          </p>
          {onGoToCreate && (
            <button
              type="button"
              onClick={onGoToCreate}
              style={{
                marginTop: '1.25rem',
                padding: '0.65rem 1.5rem',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: '#FFFFFF',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
              }}
            >
              ✨ Tạo video bài giảng mới
            </button>
          )}
        </div>
      )}

      {/* Video Cards Grid Mode */}
      {!loading && !error && viewMode === 'grid' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => setPlayingVideo(video)}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                overflow: 'hidden',
                border: '1px solid #EEF2F6',
                boxShadow: '0 4px 20px -2px rgba(99, 102, 241, 0.06)',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow =
                  '0 16px 32px -8px rgba(99, 102, 241, 0.15), 0 0 0 1.5px rgba(139, 92, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow =
                  '0 4px 20px -2px rgba(99, 102, 241, 0.06)';
              }}
            >
              {/* Thumbnail Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  backgroundColor: '#0F172A',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src={video.thumbnailUrl}
                  alt={video.title}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{
                    objectFit: 'cover',
                    transition: 'transform 0.4s ease',
                  }}
                />

                {/* Subject badge top-left */}
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
                  {video.subject}
                </span>

                {/* Star / Save for presentation top-right */}
                <button
                  type="button"
                  onClick={(e) => toggleSaveVideo(e, video)}
                  title={video.isSaved ? 'Bỏ lưu trình chiếu' : 'Lưu để trình chiếu'}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: video.isSaved
                      ? '#F59E0B'
                      : 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(6px)',
                    border: 'none',
                    color: '#FFFFFF',
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '13px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {video.isSaved ? '★' : '☆'}
                </button>

                {/* Duration badge bottom-right */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.82)',
                    backdropFilter: 'blur(4px)',
                    color: '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {video.duration}
                </span>
              </div>

              {/* Card Body */}
              <div
                style={{
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#0F172A',
                      lineHeight: 1.35,
                      marginBottom: '0.4rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {video.title}
                  </h3>
                  {video.isSaved && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#B45309',
                          backgroundColor: '#FEF3C7',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        Trình chiếu
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons (Play & Download) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                    marginTop: '0.85rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #F1F5F9',
                  }}
                >
                  {/* Play Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlayingVideo(video);
                    }}
                    title="Xem trực tiếp bài giảng"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      backgroundColor: '#EEF2FF',
                      border: '1px solid #C7D2FE',
                      color: '#4F46E5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#4F46E5';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#EEF2FF';
                      e.currentTarget.style.color = '#4F46E5';
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>

                  {/* Download MP4 Button */}
                  <a
                    href={video.downloadUrl}
                    download={`${video.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')}.mp4`}
                    onClick={(e) => e.stopPropagation()}
                    title="Tải video MP4 chất lượng cao"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      backgroundColor: '#F3E8FF',
                      border: '1px solid #DDD6FE',
                      color: '#7C3AED',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#7C3AED';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#F3E8FF';
                      e.currentTarget.style.color = '#7C3AED';
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
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
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Cards List Mode */}
      {!loading && !error && viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              onClick={() => setPlayingVideo(video)}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                border: '1px solid #EEF2F6',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  '0 8px 24px rgba(99, 102, 241, 0.12)';
                e.currentTarget.style.borderColor = '#C7D2FE';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.03)';
                e.currentTarget.style.borderColor = '#EEF2F6';
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  position: 'relative',
                  width: '140px',
                  height: '80px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#0F172A',
                  flexShrink: 0,
                }}
              >
                <Image
                  src={video.thumbnailUrl}
                  alt={video.title}
                  fill
                  unoptimized
                  style={{ objectFit: 'cover' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    color: '#FFFFFF',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                  }}
                >
                  {video.duration}
                </span>
              </div>

              {/* Title & info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    marginBottom: '0.3rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#EEF2FF',
                      color: '#4F46E5',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                    }}
                  >
                    {video.subject}
                  </span>
                  {video.isSaved && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#B45309',
                        backgroundColor: '#FEF3C7',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Trình chiếu
                    </span>
                  )}
                </div>
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {video.title}
                </h3>
                {video.description && (
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: '#64748B',
                      marginTop: '0.2rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {video.description}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => toggleSaveVideo(e, video)}
                  title={video.isSaved ? 'Bỏ lưu' : 'Lưu trình chiếu'}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: video.isSaved ? '#FEF3C7' : '#F1F5F9',
                    border: 'none',
                    color: video.isSaved ? '#F59E0B' : '#94A3B8',
                    cursor: 'pointer',
                    fontSize: '15px',
                  }}
                >
                  {video.isSaved ? '★' : '☆'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlayingVideo(video);
                  }}
                  title="Xem video"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Xem</span>
                </button>
                <a
                  href={video.downloadUrl}
                  download={`${video.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')}.mp4`}
                  onClick={(e) => e.stopPropagation()}
                  title="Tải MP4"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    backgroundColor: '#F3E8FF',
                    color: '#7C3AED',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
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
                  <span>Tải MP4</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Theater Video Player Modal (Chế độ Trình chiếu bài giảng) */}
      {playingVideo && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPlayingVideo(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              maxWidth: '920px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  style={{
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                  }}
                >
                  {playingVideo.subject}
                </span>
                <h2
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: '#0F172A',
                    margin: 0,
                  }}
                >
                  {playingVideo.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPlayingVideo(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '8px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Video Player */}
            <div
              style={{
                backgroundColor: '#000000',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxHeight: '520px',
              }}
            >
              <video
                src={playingVideo.videoUrl}
                controls
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '520px',
                  outline: 'none',
                  display: 'block',
                }}
              />
            </div>

            {/* Modal Footer Controls */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#FFFFFF',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
                  Thời lượng: <strong>{playingVideo.duration}</strong>
                </p>
                {playingVideo.description && (
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: '#475569',
                      marginTop: '0.3rem',
                      maxWidth: '600px',
                    }}
                  >
                    {playingVideo.description}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={(e) => toggleSaveVideo(e, playingVideo)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.6rem 1.15rem',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    backgroundColor: playingVideo.isSaved ? '#FEF3C7' : '#F1F5F9',
                    color: playingVideo.isSaved ? '#B45309' : '#475569',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span>{playingVideo.isSaved ? '★ Đã lưu trình chiếu' : '☆ Lưu để trình chiếu'}</span>
                </button>

                <a
                  href={playingVideo.downloadUrl}
                  download={`${playingVideo.title.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')}.mp4`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.6rem 1.35rem',
                    borderRadius: '12px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    backgroundColor: '#7C3AED',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
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
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

