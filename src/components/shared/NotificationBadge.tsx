'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getCookie } from '@/lib/auth';

export function NotificationBadge({ onClick }: { onClick?: () => void }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUnreadCount();
    // Polling every 30 seconds for real-time feel
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const token = getCookie('accessToken');
      if (!token) return;

      const res = await fetch('/api/forum/notifications', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || unreadCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-background transition-colors"
    >
      <Bell className="w-5 h-5 text-text-primary" />
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    </button>
  );
}