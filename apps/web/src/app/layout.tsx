import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LuminaLearn — AI-Powered STEM Video Generator',
  description:
    'Nền tảng tạo video giáo dục STEM thông minh kết hợp Gemini AI và Remotion Motion Graphics.',
  keywords: ['STEM', 'AI Video', 'Education', 'Remotion', 'Gemini AI', 'LuminaLearn']
};

export const viewport: Viewport = {
  themeColor: '#070B14',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

