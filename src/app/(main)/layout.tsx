import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <MobileNav />
       </div>
  );
}