import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Observable Crypto Analytics',
  description: 'Minimal, secure crypto analytics platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
