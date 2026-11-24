import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'DOPAMINE | Projects & CRM',
  description: 'Diligent Organization. Precise Actions. Mindful Intention Nurtures Excellence. Projects and CRM for purposeful work.',
  icons: { icon: '/workspace-icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="cubist">
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
