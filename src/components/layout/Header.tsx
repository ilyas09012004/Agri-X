// src/components/layout/Header.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useTheme } from 'next-themes';
import {
  Leaf,
  ShoppingCart,
  Search,
  Bell,
  Moon,
  Sun,
  Home,
  Sprout,
  MessageCircle,
  User,
  X,
  Trash2
} from 'lucide-react';
import { NotificationPopup, type Notification } from './NotificationPopup';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/katalog', label: 'Katalog', icon: Sprout },
  { href: '/forum', label: 'Forum', icon: MessageCircle },
  { href: '/akun', label: 'Akun', icon: User },
];


export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { totalItems, totalPrice } = useCart();
  const { theme, setTheme } = useTheme();
  
  const [searchOpen, setSearchOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // ✅ Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [isAuthenticated]);

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    
    setNotifLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/notifications?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setNotifLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // ✅ Notification handlers
  const handleMarkAsRead = async (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, reading: true } : n)
    );
    
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id, reading: true }),
      });
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, reading: true })));
    
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
    } catch (error) {
      console.error('Delete notification error:', error);
    }
  };

  const handleClearAll = async () => {
    setNotifications([]);
    
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      });
    } catch (error) {
      console.error('Clear all error:', error);
    }
  };

  // ✅ Mobile: Redirect to /notifications page instead of showing modal
  const handleMobileNotifClick = () => {
    router.push('/notifications');
  };

  const unreadCount = notifications.filter(n => !n.reading).length;

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
                        ? 'bg-primary text-white w-20 h-20 text-center flex-col justify-center'
                        : 'text-text-secondary hover:text-white hover:bg-primary w-20 h-20 justify-center flex-col'
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
                title={`${totalItems} jenis produk • Rp ${totalPrice.toLocaleString('id-ID')}`}
              >
                <ShoppingCart className="w-5 h-5 text-text-primary" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </button>

              {/* ✅ Notification Button - Desktop (Dropdown) */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
                  aria-label="Notifikasi"
                  aria-expanded={notifOpen}
                >
                  <Bell className="w-5 h-5 text-text-primary" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* ✅ Notification Popup - Desktop Only */}
                {notifOpen && (
                  <NotificationPopup
                    isOpen={notifOpen}
                    onClose={() => setNotifOpen(false)}
                    notifications={notifications}
                    onMarkAsRead={handleMarkAsRead}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onDelete={handleDeleteNotification}
                    onClearAll={handleClearAll}
                  />
                )}
              </div>

              {/* Theme Toggle */}
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
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
              {/* ✅ Notification Button - Mobile: Redirect to /notifications */}
              <button
                onClick={handleMobileNotifClick}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
                aria-label="Lihat notifikasi"
              >
                <Bell className="w-5 h-5 text-text-primary" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
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
        </div>
      </header>
    </>
  );
}