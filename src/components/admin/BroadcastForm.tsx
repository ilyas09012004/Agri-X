'use client';

import { useState } from 'react';
import { Loader2, Send, Bell, Users, Link as LinkIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast'; // ✅ Import toast

interface BroadcastFormProps {
  onSuccess: () => void;
}

const templateOptions = [
  { value: 'system_announcement', label: '📢 Pengumuman Umum' },
  { value: 'system_maintenance', label: '🔧 Jadwal Maintenance' },
  { value: 'promo_new', label: '🎉 Promo Baru' },
  { value: 'system_update', label: '✨ Update Fitur' },
];

const audienceOptions = [
  { value: 'all', label: '🌐 Semua User' },
  { value: 'active', label: '🟢 User Aktif (30 hari)' },
  { value: 'premium', label: '⭐ User Premium' },
];

export function BroadcastForm({ onSuccess }: BroadcastFormProps) {
  const [templateCode, setTemplateCode] = useState('system_announcement');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  // ✅ Validasi form
  const validateForm = () => {
    if (!title.trim()) {
      toast.error('⚠️ Judul pengumuman wajib diisi', {
        duration: 3000,
        position: 'bottom-right',
      });
      return false;
    }
    if (!message.trim()) {
      toast.error('⚠️ Pesan pengumuman wajib diisi', {
        duration: 3000,
        position: 'bottom-right',
      });
      return false;
    }
    if (link && !/^https?:\/\//.test(link)) {
      toast.error('⚠️ Format link tidak valid. Gunakan http:// atau https://', {
        duration: 4000,
        position: 'bottom-right',
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ Validasi sebelum submit
    if (!validateForm()) return;
    
    setError('');
    setIsLoading(true);

    // ✅ Loading toast
    const toastId = toast.loading('🔄 Mengirim pengumuman...', {
      position: 'bottom-right',
    });

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          templateCode,
          variables: { title, message, link },
          targetAudience,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pengumuman');
      }

      // ✅ Success toast dengan detail
      toast.success(`✅ Pengumuman terkirim ke ${data.sentCount || '?'} user!`, {
        id: toastId,
        duration: 4000,
        position: 'bottom-right',
        icon: '🔔',
        // ✅ Action button untuk lihat notifikasi
        action: {
          label: 'Lihat Logs',
          onClick: () => {
            // TODO: Navigate ke halaman logs
            console.log('View broadcast logs');
          },
        },
      });

      // ✅ Reset form & callback
      setTitle('');
      setMessage('');
      setLink('');
      setPreviewMode(false);
      onSuccess();

    } catch (err: any) {
      console.error('Broadcast error:', err);
      
      // ✅ Error toast dengan retry option
      toast.error(`❌ ${err.message}`, {
        id: toastId,
        duration: 5000,
        position: 'bottom-right',
        icon: '⚠️',
        action: {
          label: 'Coba Lagi',
          onClick: () => handleSubmit(e),
        },
      });
      
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Preview notification style
  const PreviewNotification = () => (
    <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-text-primary truncate">
            {title || 'Judul pengumuman akan muncul di sini'}
          </p>
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">
            {message || 'Isi pesan pengumuman akan muncul di sini...'}
          </p>
          {link && (
            <div className="flex items-center gap-1 mt-2 text-primary text-xs">
              <LinkIcon className="w-3 h-3" />
              <span className="truncate">{link}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary/10">
        <Users className="w-3 h-3 text-text-secondary" />
        <span className="text-xs text-text-secondary">
          Target: {audienceOptions.find(o => o.value === targetAudience)?.label}
        </span>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-border rounded-xl bg-surface/50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Kirim Pengumuman
        </h3>
        <button
          type="button"
          onClick={() => setPreviewMode(!previewMode)}
          className="text-xs text-primary hover:underline"
        >
          {previewMode ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview Mode */}
      {previewMode ? (
        <PreviewNotification />
      ) : (
        <>
          {/* Template */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Template <span className="text-red-500">*</span>
            </label>
            <select
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              className="input w-full"
              disabled={isLoading}
            >
              {templateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Judul <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Promo Spesial Hari Kemerdekaan"
              className="input w-full"
              maxLength={255}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-text-secondary mt-1">
              {title.length}/255 karakter
            </p>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Pesan <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Isi pengumuman..."
              className="input w-full min-h-[100px]"
              rows={4}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-text-secondary mt-1">
              {message.length} karakter
            </p>
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Link Tujuan <span className="text-text-secondary">(Opsional)</span>
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://agri-x.com/promo/merdeka"
              className="input w-full"
              disabled={isLoading}
            />
            <p className="text-xs text-text-secondary mt-1">
              User akan diarahkan ke link ini saat klik notifikasi
            </p>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Target Penerima
            </label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="input w-full"
              disabled={isLoading}
            >
              {audienceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !title.trim() || !message.trim()}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Mengirim...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>Kirim ke {audienceOptions.find(o => o.value === targetAudience)?.label.split(' ')[0]}</span>
          </>
        )}
      </button>
    </form>
  );
}