import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BIBLE GROUP',
  description: 'Bible Group 信息流素材改版工具',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
