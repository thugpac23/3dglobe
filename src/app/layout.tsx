import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Пътешественически Глобус',
  description: 'Проследявайте посетените държави от тати и ива на интерактивен 3D глобус',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
