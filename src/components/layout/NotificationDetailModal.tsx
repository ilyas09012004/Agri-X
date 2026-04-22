// src/components/notifications/NotificationDetailModal.tsx
'use client';

import { useEffect } from 'react';
import { X, ExternalLink, Trash2, Check, Bell, MessageCircle } from 'lucide-react';
import type { Notification } from '@/app/notifications/page';

interface NotificationDetailModalProps {
  notification: Notification;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (link?: string) => void;
}

const typeColors: Record<Notification['type'], string> = {
  order: 'bg-primary/10 text-primary border-primary/20',
  payment: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  forum: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  system: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  promo: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
};

const typeIcons: Record<Notification['type'], JSX.Element> = {
  order: <Bell className="w-6 h-6" />,
  payment: <Check className="w-6 h-6" />,
  forum: <MessageCircle className="w-6 h-6" />,
  system: <Bell className="w-6 h-6" />,
  promo: <Bell className="w-6 h-6" />,
};

export function NotificationDetailModal({
  notification,
  onClose,
  onMarkAsRead,
  onDelete,
  onNavigate,
}: NotificationDetailModalProps) {
  // ✅ Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // ✅ Block body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const formatFullDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrimaryAction = () => {
    // Mark as read if unread
    if (!notification.reading) {
      onMarkAsRead(notification.id);
    }
    
    // Navigate if has link
    if (notification.link) {
      onNavigate(notification.link);
    } else {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div 
        className="
          relative w-full sm:max-w-lg 
          bg-surface rounded-t-2xl sm:rounded-2xl 
          shadow-2xl border border-border
          animate-slide-up sm:animate-scale-in
          max-h-[90vh] overflow-hidden
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${typeColors[notification.type]}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-white dark:bg-background-dark flex items-center justify-center`}>
              {typeIcons[notification.type]}
            </div>
            <div>
              <p className="text-xs text-text-secondary/70">{notification.type.toUpperCase()}</p>
              <p className="font-semibold text-text-primary line-clamp-1">{notification.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/10 rounded-lg transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Message */}
          <div>
            <p className="text-text-secondary leading-relaxed">{notification.message}</p>
          </div>

          {/* Sender Info (if forum/notification from user) */}
          {notification.senderName && (
            <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-xl">
              {notification.senderAvatar ? (
                <img
                  src={notification.senderAvatar}
                  alt={notification.senderName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {notification.senderName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-text-primary">{notification.senderName}</p>
                <p className="text-xs text-text-secondary">Pengirim</p>
              </div>
            </div>
          )}

          {/* Image (if any) */}
          {notification.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-border">
              <img
                src={notification.imageUrl}
                alt="Notification"
                className="w-full h-40 object-cover"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Timestamp */}
          <div className="text-xs text-text-secondary/70">
            Diterima: {formatFullDate(notification.createdAt)}
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              notification.reading 
                ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' 
                : 'bg-primary/10 text-primary'
            }`}>
              {notification.reading ? '✓ Sudah dibaca' : '● Belum dibaca'}
            </span>
            {notification.actionType && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface text-text-secondary border border-border">
                {notification.actionType.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-surface/95 sticky bottom-0">
          <div className="flex gap-3">
            {/* Delete Button */}
            <button
              onClick={() => {
                if (confirm('Hapus notifikasi ini?')) {
                  onDelete(notification.id);
                  onClose();
                }
              }}
              className="flex-1 py-3 px-4 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
            
            {/* Primary Action */}
            <button
              onClick={handlePrimaryAction}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                notification.link 
                  ? 'bg-primary text-white hover:bg-primary/90' 
                  : 'bg-surface text-text-primary border border-border hover:bg-primary/10'
              }`}
            >
              {notification.link ? (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Buka Link
                </>
              ) : notification.reading ? (
                'Tutup'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Tandai Dibaca
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}