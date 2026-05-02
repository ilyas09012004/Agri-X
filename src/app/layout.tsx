import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LocationProvider } from '@/context/LocationContext';
import { Toaster } from 'react-hot-toast';
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
        {/* ✅ Inline script untuk apply theme sebelum hydrate */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased min-h-screen bg-background text-text-primary">
        
        {/* ✅ App Providers - Wrap semua children */}
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

        {/* ✅ GLOBAL TOASTER - Config optimal untuk Agri X */}
        <Toaster 
          // 📍 Posisi: bottom-right (ergonomis untuk mobile)
          position="bottom-right"
          
          // 📦 Container style: z-index tinggi agar di atas modal
          containerStyle={{
            zIndex: 9999,
            bottom: 24,
            right: 24,
          }}
          
          // 🔄 Urutan toast: baru di atas (untuk bottom position)
          reverseOrder={false}
          
          // 📏 Jarak antar toast
          gutter={12}
          
          // ⚙️ Opsi default untuk semua toast
          toastOptions={{
            // ⏱️ Durasi default
            duration: 3000,
            
            // 🎨 Style default
            style: {
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(8px)',
            },
            
            // ✅ Success toast config
            success: {
              duration: 3000,
              iconTheme: { 
                primary: '#10B981', // green-500
                secondary: '#fff', 
              },
              style: {
                borderLeft: '4px solid #10B981',
              },
            },
            
            // ❌ Error toast config
            error: {
              duration: 5000, // Lebih lama agar user sempat baca
              iconTheme: { 
                primary: '#EF4444', // red-500
                secondary: '#fff', 
              },
              style: {
                borderLeft: '4px solid #EF4444',
              },
            },
            
            // ⏳ Loading toast config
            loading: {
              duration: Infinity, // Tidak auto-hide
              iconTheme: { 
                primary: '#3B82F6', // blue-500
                secondary: '#fff', 
              },
              style: {
                borderLeft: '4px solid #3B82F6',
              },
            },
            
            // ℹ️ Info/Warning toast config
            blank: {
              duration: 4000,
              style: {
                borderLeft: '4px solid #6B7280', // gray-500
              },
            },
          }}
        />

        {/* ✅ Global Loading Indicator (Opsional - untuk transisi halaman) */}
        {/* Uncomment jika ingin pakai: */}
        {/* <GlobalLoadingIndicator /> */}

      </body>
    </html>
  );
}