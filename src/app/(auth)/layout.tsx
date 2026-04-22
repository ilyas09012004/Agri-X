// src/app/layout.tsx
import Script from 'next/script';
import '@/app/globals.css';
import { ThemeProvider } from 'next-themes'; 

export const metadata = {
  title: 'Agri X - Platform Pertanian Digital',
  description: 'E-commerce pertanian untuk petani Indonesia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <Script 
          src="https://app.sandbox.midtrans.com/snap/snap.js" 
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="afterInteractive"
        />
      </head>
      <body className="antialiased min-h-screen bg-background text-text-primary">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          storageKey="agri-x-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}