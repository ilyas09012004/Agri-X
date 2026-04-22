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

// ✅ FIX: Inline script untuk mencegah FOUC (Flash of Unstyled Content)
// Script ini dijalankan SEBELUM React hydrate untuk apply theme dari localStorage
const themeScript = `
  (function() {
    try {
      const theme = localStorage.getItem('agri-x-theme');
      if (theme === 'dark' || theme === 'light') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* ✅ FIX: Inline script untuk apply theme sebelum hydrate */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased min-h-screen">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          storageKey="agri-x-theme"
          // ✅ FIX: Tambahkan nonce jika menggunakan CSP (opsional)
          // nonce={process.env.NEXT_SCRIPT_NONCE}
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