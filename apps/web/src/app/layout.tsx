import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { themeNoFlashScript } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus — AI Operations Platform',
  description: 'Async, multi-tenant AI agent orchestration with human-in-the-loop approvals.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
