import React from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { CreateVideoForm } from '@/components/CreateVideoForm';
import { WorkflowSection } from '@/components/WorkflowSection';
import { Footer } from '@/components/Footer';
import { V3TeacherStudio } from '@/components/V3TeacherStudio';

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="main-content">
        <div className="container">
          <Hero />
          <V3TeacherStudio liveEnabled={Boolean(process.env.GEMINI_API_KEY)} />
          <CreateVideoForm
            liveEnabled={Boolean(process.env.GEMINI_API_KEY)}
            geminiTtsEnabled={Boolean(process.env.GEMINI_API_KEY)}
            googleTtsEnabled={Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_TTS_ENABLED === 'true')}
          />
          <WorkflowSection />
        </div>
      </main>
      <Footer />
    </>
  );
}

