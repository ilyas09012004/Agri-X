'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bell, Check, Trash2, ExternalLink, X, Clock, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast'; // ✅ Import toast

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

// ✅ typeColors dengan fallback 'default'
const typeColors: Record<Notification['type'] | 'default', string> = {
  order: 'bg-primary/10 text-primary border-primary/20',
  payment: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
  forum: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  system: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  promo: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
  default: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

// ✅ typeIcons dengan fallback 'default'
const typeIcons: Record<Notification['type'] | 'default', JSX.Element> = {
  order: <Bell className="w-5 h-5" />,
  payment: <Check className="w-5 h-5" />,
  forum: <Bell className="w-5 h-5" />,
  system: <Bell className="w-5 h-5" />,
  promo: <Bell className="w-5 h-5" />,
  default: <Bell className="w-5 h-5" />,
};

// ✅ typeLabels untuk display
const typeLabels: Record<Notification['type'] | 'default', string> = {
  order: 'Pesanan',
  payment: 'Pembayaran',
  forum: 'Forum',
  system: 'Sistem',
  promo: 'Promo',
  default: 'Notifikasi',
};

// ============================================================================
// ✅ INLINE COMPONENT: NotificationDetailModal (dengan type safety)
// ============================================================================
function NotificationDetailModal({
  notification,
  onClose,
  onMarkAsRead,
  onDelete,
  onNavigate,
}: {
  notification: Notification | null;
  onClose: () => void;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onNavigate: (link?: string) => void;
}) {
  // ✅ Early return jika notification null
  if (!notification) return null;

  // ✅ Safe access untuk type dengan fallback
  const notificationType = notification.type || 'system';

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAction = () => {
    if (!notification.reading) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      onNavigate(notification.link);
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-surface rounded-2xl w-full max-w-200 max-h-[90vh] overflow-y-auto shadow-2xl border border-border/50 animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${typeColors[notificationType]?.split(' ')[2] || 'border-gray-200'}`}>
                {typeIcons[notificationType] || typeIcons.default}
              </div>
              <div>
                <h3 className="font-bold text-text-primary">{typeLabels[notificationType] || 'Notifikasi'}</h3>
                <p className="text-xs text-text-secondary flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(notification.createdAt)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-border rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Title & Message */}
            <div>
              <h4 className="font-semibold text-lg text-text-primary mb-2">
                {notification.title || 'Tanpa Judul'}
              </h4>
              <p className="text-text-secondary whitespace-pre-line">
                {notification.message || 'Tidak ada pesan'}
              </p>
            </div>

            {/* Image (if any) */}
            {notification.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-border">
                <img
                  src={notification.imageUrl}
                  alt="Notification"
                  className="w-full h-48 object-cover"
                  loading="lazy"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {/* Sender Info (if any) */}
            {notification.senderName && (
              <div className="flex items-center gap-3 p-3 bg-surface/50 rounded-xl">
                {notification.senderAvatar ? (
                  <img
                    src={notification.senderAvatar}
                    alt={notification.senderName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {notification.senderName}
                  </p>
                  <p className="text-xs text-text-secondary">Pengirim</p>
                </div>
              </div>
            )}

            {/* Action Button */}
            {notification.link && (
              <button
                onClick={handleAction}
                className="w-full btn-primary py-3 flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                {notification.actionType === 'order_shipped' ? 'Lacak Pesanan' :
                 notification.actionType === 'forum_reply' ? 'Lihat Balasan' :
                 notification.actionType === 'payment_success' ? 'Lihat Pesanan' :
                 'Lihat Detail'}
              </button>
            )}

            {/* Reference Info */}
            {notification.referenceId && (
              <div className="p-3 bg-surface/50 rounded-xl">
                <p className="text-xs text-text-secondary">
                  Reference ID: <span className="font-mono text-text-primary">{notification.referenceId}</span>
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-surface/95 backdrop-blur border-t border-border p-4 flex gap-2">
            {!notification.reading && (
              <button
                onClick={() => {
                  onMarkAsRead(notification.id);
                  onClose();
                  toast.success('✅ Notifikasi ditandai sebagai dibaca', {
                    duration: 2000,
                    position: 'bottom-right',
                  });
                }}
                className="flex-1 btn-outline py-3 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Tandai Dibaca
              </button>
            )}
            <button
              onClick={() => {
                onDelete(notification.id);
                onClose();
                toast.success('✅ Notifikasi dihapus', {
                  duration: 2000,
                  position: 'bottom-right',
                });
              }}
              className="flex-1 btn-outline py-3 text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Hapus
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// ✅ MAIN PAGE COMPONENT
// ============================================================================
export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'order' | 'payment' | 'forum' | 'system' | 'promo'>('all');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchNotifications();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [filter]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        limit: '50',
        ...(filter === 'unread' && { unread: 'true' }),
      });
      
      const res = await fetch(`/api/notifications?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
      toast.error('❌ Gagal memuat notifikasi', {
        duration: 4000,
        position: 'bottom-right',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    setActionLoading(`read-${id}`);
    try {
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, reading: true } : n)
      );
      
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
      toast.error('❌ Gagal menandai sebagai dibaca', {
        duration: 4000,
        position: 'bottom-right',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading('mark-all');
    try {
      setNotifications(prev => prev.map(n => ({ ...n, reading: true })));
      
      const token = localStorage.getItem('accessToken');
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      });
      
      toast.success('✅ Semua notifikasi ditandai sebagai dibaca', {
        duration: 3000,
        position: 'bottom-right',
      });
    } catch (error) {
      console.error('Mark all as read error:', error);
      toast.error('❌ Gagal menandai semua sebagai dibaca', {
        duration: 4000,
        position: 'bottom-right',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    setActionLoading(`delete-${id}`);
    try {
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      const token = localStorage.getItem('accessToken');
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      
      toast.success('✅ Notifikasi dihapus', {
        duration: 2500,
        position: 'bottom-right',
      });
    } catch (error) {
      console.error('Delete notification error:', error);
      setNotifications(prev => prev); // Revert state on error
      toast.error('❌ Gagal menghapus notifikasi', {
        duration: 4000,
        position: 'bottom-right',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearAll = async () => {
    setActionLoading('clear-all');
    try {
      setNotifications([]);
      
      const token = localStorage.getItem('accessToken');
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      });
      
      toast.success('✅ Semua notifikasi dihapus', {
        duration: 3000,
        position: 'bottom-right',
      });
    } catch (error) {
      console.error('Clear all error:', error);
      toast.error('❌ Gagal menghapus semua notifikasi', {
        duration: 4000,
        position: 'bottom-right',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // ✅ Validasi: Pastikan notification memiliki required fields
    if (!notification?.id) {
      console.error('Invalid notification:', notification);
      return;
    }
    
    // Mark as read if unread
    if (!notification.reading) {
      handleMarkAsRead(notification.id);
    }
    
    // If has link, open it
    if (notification.link) {
      window.location.href = notification.link;
    } else {
      // Otherwise, show detail modal
      setSelectedNotification(notification);
    }
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
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.reading;
    // ✅ Safe access untuk type
    return (n.type || 'system') === filter;
  });

  const unreadCount = notifications.filter(n => !n.reading).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-text-secondary">Memuat notifikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Kembali</span>
          </button>
          <h1 className="text-lg font-bold text-text-primary">Notifikasi</h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
        
        {/* Stats & Actions */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              {unreadCount} belum dibaca
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={actionLoading === 'mark-all'}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {actionLoading === 'mark-all' ? '...' : 'Baca semua'}
              </button>
            )}
          </div>
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={actionLoading === 'clear-all'}
              className="text-xs text-red-500 hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              {actionLoading === 'clear-all' ? '...' : 'Hapus semua'}
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 border-b border-border overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Semua' },
            { key: 'unread', label: 'Belum Dibaca' },
            { key: 'order', label: 'Pesanan' },
            { key: 'payment', label: 'Pembayaran' },
            { key: 'forum', label: 'Forum' },
            { key: 'promo', label: 'Promo' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="p-4 space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 mx-auto text-text-secondary/50 mb-4" />
            <p className="text-text-secondary font-medium">
              {filter === 'unread' ? 'Semua notifikasi sudah dibaca' : 'Tidak ada notifikasi'}
            </p>
            <p className="text-sm text-text-secondary/70 mt-1">
              {filter === 'unread' 
                ? 'Akan muncul ketika ada aktivitas baru' 
                : 'Notifikasi akan muncul di sini'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            // ✅ Safe access untuk type dengan fallback
            const notificationType = notification.type || 'system';
            
            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`
                  p-4 rounded-xl border cursor-pointer transition-all
                  ${!notification.reading 
                    ? 'bg-primary/5 border-primary/20 shadow-sm' 
                    : 'bg-surface border-border hover:border-primary/30'
                  }
                  ${typeColors[notificationType]}
                `}
              >
                <div className="flex gap-3">
                  {/* Icon - dengan fallback */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-white dark:bg-background-dark flex items-center justify-center border ${typeColors[notificationType]?.split(' ')[2] || 'border-gray-200'}`}>
                    {typeIcons[notificationType] || typeIcons.default}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium text-sm ${!notification.reading ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {notification.title || 'Tanpa Judul'}
                      </p>
                      {!notification.reading && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                      {notification.message || 'Tidak ada pesan'}
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
                      handleDeleteNotification(notification.id);
                    }}
                    className="p-1 text-text-secondary/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    disabled={actionLoading === `delete-${notification.id}`}
                  >
                    {actionLoading === `delete-${notification.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ✅ NOTIFICATION DETAIL MODAL - Inline component */}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onMarkAsRead={handleMarkAsRead}
          onDelete={handleDeleteNotification}
          onNavigate={(link) => {
            setSelectedNotification(null);
            if (link) window.location.href = link;
          }}
        />
      )}
    </div>
  );
}