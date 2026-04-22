// src/components/admin/OrderStatusUpdate.tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface OrderStatusUpdateProps {
  orderId: number;
  currentStatus: string;
  onSuccess: () => void;
}

const statusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Dibayar' },
  { value: 'processing', label: 'Diproses' },
  { value: 'shipped', label: 'Dikirim' },
  { value: 'delivered', label: 'Diterima' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

export function OrderStatusUpdate({ orderId, currentStatus, onSuccess }: OrderStatusUpdateProps) {
  const [status, setStatus] = useState(currentStatus);
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          courier: status === 'shipped' ? courier : undefined,
          trackingNumber: status === 'shipped' ? trackingNumber : undefined,
          reason: status === 'cancelled' ? reason : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal update status');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-border rounded-xl">
      <h3 className="font-semibold text-text-primary">Update Status Pesanan</h3>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="input w-full"
          required
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {status === 'shipped' && (
        <>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Kurir</label>
            <input
              type="text"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="JNE, JNT, SiCepat, dll"
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">No. Resi</label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="JNE123456789"
              className="input w-full"
              required
            />
          </div>
        </>
      )}

      {status === 'cancelled' && (
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Alasan Pembatalan</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan alasan pembatalan..."
            className="input w-full"
            rows={3}
            required
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Memproses...</span>
          </>
        ) : (
          'Update Status'
        )}
      </button>
    </form>
  );
}