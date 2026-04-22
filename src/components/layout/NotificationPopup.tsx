// src/components/layout/NotificationPopup.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, X, Trash2, ExternalLink, MessageCircle, Heart } from 'lucide-react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'forum' | 'system' | 'promo';
  reading: boolean;
  senderId?: number;
  senderName?: string;
  senderAvatar?: string;
  createdAt: string;
  link?: string;
  imageUrl?: string;
  actionType?: string;
  referenceId?: string;
}

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const getNotificationIcon = (type: Notification['type'], actionType?: string) => {
  switch (type) {
    case 'order':
      return <MessageCircle className="w-5 h-5 text-primary" />;
    case 'payment':
      return <Check className="w-5 h-5 text-green-500" />;
    case 'forum':
      if (actionType === 'forum_like') return <Heart className="w-5 h-5 text-red-500" />;
      return <MessageCircle className="w-5 h-5 text-blue-500" />;
    case 'promo':
      return <Bell className="w-5 h-5 text-orange-500" />;
    default:
      return <Bell className="w-5 h-5 text-text-secondary" />;
  }
};

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'order':
      return 'bg-primary/10 border-primary/20';
    case 'payment':
      return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
    case 'forum':
      return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
    case 'promo':
      return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800';
    default:
      return 'bg-surface border-border';
  }
};

export function NotificationPopup({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onClearAll,
}: NotificationPopupProps) {
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.reading) {
      onMarkAsRead(notification.id);
    }
    
    if (notification.link) {
      router.push(notification.link);
    }
    
    onClose();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  if (!mounted || !isOpen) return null;

  const unreadCount = notifications.filter(n => !n.reading).length;

  return (
    <>
      <div className="fixed inset-0 z-40 md:hidden" onClick={onClose} />
      
      <div
        ref={popupRef}
        className={`
          absolute right-0 mt-2 w-80 sm:w-96 
          bg-surface rounded-2xl shadow-2xl border border-border
          overflow-hidden z-50
          animate-scale-in origin-top-right
          ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `}
        role="dialog"
        aria-label="Notifikasi"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-text-primary" />
            <h3 className="font-semibold text-text-primary">Notifikasi</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-primary text-white text-xs rounded-full">
                {unreadCount} baru
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors text-xs"
              >
                Baca semua
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="p-1.5 text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Tidak ada notifikasi</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`
                    p-4 cursor-pointer transition-colors
                    ${!notification.reading ? 'bg-primary/5' : 'hover:bg-surface/50'}
                    ${getNotificationColor(notification.type)}
                  `}
                  onClick={() => handleNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-background-dark flex items-center justify-center">
                      {getNotificationIcon(notification.type, notification.actionType)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-medium text-sm ${!notification.reading ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {notification.title}
                        </p>
                        {!notification.reading && (
                          <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-text-secondary/70">
                          {formatTime(notification.createdAt)}
                        </span>
                        {notification.link && (
                          <ExternalLink className="w-3 h-3 text-text-secondary/50" />
                        )}
                      </div>
                    </div>
                    
                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(notification.id);
                      }}
                      className="p-1 text-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-border bg-surface/50">
            <button
              onClick={() => router.push('/notifications')}
              className="w-full py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors font-medium"
            >
              Lihat semua notifikasi
            </button>
          </div>
        )}
      </div>
    </>
  );
}