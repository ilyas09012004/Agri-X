// src/app/layout.tsx
import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter, Poppins } from 'next/font/google';
import '@/app/globals.css';
import { ThemeProvider } from 'next-themes'; 

// ✅ Import Font dari Google Fonts (Optimized by Next.js)
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const poppins = Poppins({ 
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Agri X - Platform Pertanian Digital',
  description: 'E-commerce pertanian terpercaya untuk petani Indonesia. Jual beli hasil panen langsung, aman, dan transparan.',
  keywords: ['pertanian', 'petani', 'e-commerce', 'hasil tani', 'indonesia'],
  authors: [{ name: 'Agri X Team' }],
  openGraph: {
    title: 'Agri X - Platform Pertanian Digital',
    description: 'Hubungkan petani dengan pembeli secara langsung.',
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
      <head>
        {/* ✅ Midtrans Snap.js - Load after interactive to prevent blocking */}
        <Script 
          src="https://app.sandbox.midtrans.com/snap/snap.js" 
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="afterInteractive"
        />
      </head>
      
      {/* ✅ Terapkan variable font ke body */}
      <body className={`${inter.variable} ${poppins.variable} font-body antialiased min-h-screen bg-background text-text-primary transition-colors duration-300`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={true} // ✅ Ubah ke true agar bisa detect system preference
          storageKey="agri-x-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}