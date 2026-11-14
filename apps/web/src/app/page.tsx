'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { HomeView } from '@/components/HomeView';
import { CreateVideoView } from '@/components/CreateVideoView';
import { AlbumVideoView } from '@/components/AlbumVideoView';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'home' | 'create' | 'album'>('home');
  const [albumCount, setAlbumCount] = useState<number>(6);

  async function refreshAlbumCount() {
    try {
      const res = await fetch('/api/album', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.total === 'number') {
          setAlbumCount(data.total);
        }
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    refreshAlbumCount();
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#F8FAFD',
      }}
    >
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'album' || tab === 'home') refreshAlbumCount();
        }}
        albumCount={albumCount}
      />

      <main style={{ flex: 1 }}>
        <div className="container">
          {activeTab === 'home' && (
            <HomeView
              onGoToCreate={() => setActiveTab('create')}
              onGoToAlbum={() => {
                setActiveTab('album');
                refreshAlbumCount();
              }}
              albumCount={albumCount}
            />
          )}

          {activeTab === 'create' && (
            <CreateVideoView
              onVideoCreated={() => {
                refreshAlbumCount();
              }}
              onGoToAlbum={() => {
                setActiveTab('album');
                refreshAlbumCount();
              }}
            />
          )}

          {activeTab === 'album' && (
            <AlbumVideoView
              onGoToCreate={() => {
                setActiveTab('create');
              }}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
