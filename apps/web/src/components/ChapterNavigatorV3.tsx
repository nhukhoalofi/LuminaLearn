'use client';

import React from 'react';

export interface ChapterNavProps {
  chapters: Array<{
    chapterId: string;
    chapterTitle: string;
    durationSeconds: number;
    sceneIds?: string[];
  }>;
  scenes: Array<{
    sceneId: string;
    title: string;
    sceneType: string;
    durationSeconds: number;
  }>;
  selectedSceneId: string;
  onSelectScene: (sceneId: string) => void;
}

export function ChapterNavigatorV3({
  chapters,
  scenes,
  selectedSceneId,
  onSelectScene
}: ChapterNavProps) {
  if (!chapters || chapters.length === 0) {
    return (
      <div style={{ marginBottom: '16px' }} data-testid="v3-chapter-navigator">
        <h4 style={{ margin: '0 0 8px 0', color: '#38BDF8', fontSize: '14px' }}>
          📑 Danh sách phân cảnh ({scenes.length} cảnh)
        </h4>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {scenes.map((sc, idx) => {
            const isSelected = sc.sceneId === selectedSceneId;
            return (
              <button
                type="button"
                key={sc.sceneId}
                onClick={() => onSelectScene(sc.sceneId)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: isSelected ? '1px solid #38BDF8' : '1px solid rgba(148, 163, 184, 0.2)',
                  background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                  color: isSelected ? '#38BDF8' : '#CBD5E1',
                  cursor: 'pointer',
                  fontSize: '12px',
                  textAlign: 'left'
                }}
              >
                <strong>{idx + 1}. {sc.title}</strong>
                <span style={{ display: 'block', fontSize: '10px', color: '#94A3B8' }}>
                  {sc.sceneType} · {sc.durationSeconds}s
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '8px',
        border: '1px solid rgba(56, 189, 248, 0.2)'
      }}
      data-testid="v3-chapter-navigator"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ margin: 0, color: '#38BDF8', fontSize: '14px' }}>
          📑 Cấu trúc chương & phân cảnh ({chapters.length} chương · {scenes.length} cảnh)
        </h4>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {chapters.map((chap, chapIdx) => {
          const chapScenes = scenes.filter((s) => chap.sceneIds?.includes(s.sceneId));
          return (
            <div
              key={chap.chapterId || chapIdx}
              style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.15)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: '#F8FAFC', fontWeight: 600 }}>
                  Chương {chapIdx + 1}: {chap.chapterTitle}
                </span>
                <span style={{ color: '#94A3B8', fontSize: '11px' }}>
                  {chap.durationSeconds}s · {chapScenes.length} cảnh
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {chapScenes.map((sc) => {
                  const isSelected = sc.sceneId === selectedSceneId;
                  return (
                    <button
                      type="button"
                      key={sc.sceneId}
                      onClick={() => onSelectScene(sc.sceneId)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: isSelected ? '1px solid #38BDF8' : '1px solid rgba(148, 163, 184, 0.2)',
                        background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.4)',
                        color: isSelected ? '#38BDF8' : '#CBD5E1',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      {sc.title} ({sc.durationSeconds}s)
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

