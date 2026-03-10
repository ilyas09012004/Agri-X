'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useTheme } from 'next-themes';
import {
  Leaf,
  ShoppingCart,
  Search,
  Menu,
  X,
  Bell,
  Moon,
  Sun,
  Home,
  Sprout,
  MessageCircle,
  Heart,
  User
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/katalog', label: 'Katalog', icon: Sprout },
  { href: '/forum', label: 'Forum', icon: MessageCircle },
  { href: '/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/akun', label: 'Akun', icon: User },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { totalItems } = useCart();
  const { theme, setTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      {/* ========== DESKTOP HEADER ========== */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-background-dark/5 backdrop-blur-lg border-b border-border-light dark:border-border-dark/50 hidden md:block rounded-lg">
        <div className="max-w-7xl lg:px-8 h-18">
          <div className="flex justify-between gap-x-3xl">
            {/* Logo */}
            <div
              onClick={() => router.push('/')}
              className="flex items-center gap-2 cursor-pointer flex-shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-text-primary">Agri X</span>
            </div>

            {/* Center Navigation */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-0 rounded-xl font-medium transition-all duration-300 flex items-center ${
                      isActive
                        ? 'bg-primary text-white w-20 h-20 text-center flex-col justify-center '
                        : 'text-text-secondary hover:text-white hover:bg-primary  w-20 h-20 justify-center flex-col'
                    }`}
                  >
                    <item.icon className="w-6 h-6" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Search */}
              <div className="relative">
                {searchOpen ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Cari produk..."
                      className="input w-64"
                      autoFocus
                      onBlur={() => setSearchOpen(false)}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setSearchOpen(true)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
                  >
                    <Search className="w-5 h-5 text-text-primary" />
                  </button>
                )}
              </div>

              {/* Cart */}
              <button
                onClick={() => router.push('/cart')}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
              >
                <ShoppingCart className="w-5 h-5 text-text-primary" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </button>

              {/* Theme Toggle */}
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-5 h-5 text-text-primary" />
                  ) : (
                    <Moon className="w-5 h-5 text-text-primary" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========== MOBILE HEADER ========== */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-background-dark/5 backdrop-blur-lg border-b border-border-light dark:border-border-dark md:hidden">
        {/* Top Bar */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div
              onClick={() => router.push('/')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-text-primary">Agri X</span>
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-3">
              {/* Notification */}
              <button className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors">
                <Bell className="w-5 h-5 text-text-primary" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  2
                </span>
              </button>

              {/* Cart */}
              <button
                onClick={() => router.push('/cart')}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
              >
                <ShoppingCart className="w-5 h-5 text-text-primary" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Greeting Section */}
          {isAuthenticated && user && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border-light dark:border-border-dark">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-text-secondary">Selamat Pagi,</p>
                <p className="font-semibold text-text-primary">{user.name}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ========== MOBILE BOTTOM NAVIGATION ========== */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-background-dark/80 backdrop-blur-lg border-t border-border-light dark:border-border-dark md:hidden z-50">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 flex-1 ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-primary'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>


    </>
  );
}