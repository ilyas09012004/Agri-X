// src/app/layout.tsx
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LocationProvider } from '@/context/LocationContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agri X - Platform Hasil Pertanian Indonesia',
  description: 'Jual dan beli hasil pertanian langsung dari petani',
  keywords: ['pertanian', 'petani', 'hasil bumi', 'e-commerce', 'indonesia'],
  authors: [{ name: 'Agri X Team' }],
  openGraph: {
    title: 'Agri X - Platform Hasil Pertanian Indonesia',
    description: 'Jual dan beli hasil pertanian langsung dari petani',
    type: 'website',
    locale: 'id_ID',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          storageKey="agri-x-theme"
        >
          <AuthProvider>
            <CartProvider>
              <LocationProvider>
                {children}
              </LocationProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}