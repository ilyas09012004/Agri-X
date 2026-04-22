// src/components/admin/BroadcastForm.tsx
'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';

interface BroadcastFormProps {
  onSuccess: () => void;
}

const templateOptions = [
  { value: 'system_announcement', label: 'Pengumuman Umum' },
  { value: 'system_maintenance', label: 'Jadwal Maintenance' },
  { value: 'promo_new', label: 'Promo Baru' },
  { value: 'system_update', label: 'Update Fitur' },
];

const audienceOptions = [
  { value: 'all', label: 'Semua User' },
  { value: 'active', label: 'User Aktif (30 hari)' },
  { value: 'premium', label: 'User Premium' },
];

export function BroadcastForm({ onSuccess }: BroadcastFormProps) {
  const [templateCode, setTemplateCode] = useState('system_announcement');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

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

      alert(`Pengumuman terkirim ke ${data.sentCount} user!`);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-border rounded-xl">
      <h3 className="font-semibold text-text-primary">Kirim Pengumuman</h3>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Template</label>
        <select
          value={templateCode}
          onChange={(e) => setTemplateCode(e.target.value)}
          className="input w-full"
        >
          {templateOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Judul</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Contoh: Promo Spesial Hari Kemerdekaan"
          className="input w-full"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Pesan</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Isi pengumuman..."
          className="input w-full min-h-[100px]"
          rows={4}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Link (Opsional)</label>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="/promo/merdeka"
          className="input w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Target Audience</label>
        <select
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          className="input w-full"
        >
          {audienceOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Mengirim...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>Kirim Pengumuman</span>
          </>
        )}
      </button>
    </form>
  );
}