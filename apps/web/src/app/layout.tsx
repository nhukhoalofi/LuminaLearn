import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LuminaLearn — AI & Mathematics Video Studio',
  description:
    'Nền tảng tạo video giáo dục Toán học và Trí tuệ nhân tạo (AI/ML) kết hợp Gemini AI, SymPy và Remotion Motion Graphics.',
  keywords: ['Mathematics', 'AI Education', 'Machine Learning', 'Remotion', 'Gemini AI', 'LuminaLearn']
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
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

