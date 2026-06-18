import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat Widget',
  description: 'Multi-tenant embeddable AI chat widget',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
