import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AWS ML Platform | Documentation & Experiments',
  description:
    'A modular AWS SageMaker platform for ML pipelines, user bucketing, and experiment recommendations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
