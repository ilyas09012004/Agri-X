'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Clock, ArrowLeft } from 'lucide-react';

export default function PaymentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  const orderId = params.id as string;
  const statusParam = searchParams.get('status'); // 'finish', 'unfinish', 'error'

  const [uiStatus, setUiStatus] = useState<'loading' | 'success' | 'pending' | 'failed'>('loading');
  const [message, setMessage] = useState('Memeriksa status pembayaran...');

  useEffect(() => {
    if (!orderId) return;

    // Jika user kembali dari Midtrans (redirect)
    if (statusParam === 'finish') {
      checkPaymentStatus(true);
    } else if (statusParam === 'unfinish' || statusParam === 'error') {
      setUiStatus('failed');
      setMessage('Pembayaran belum selesai atau dibatalkan.');
    } else {
      // Jika akses langsung, cek status DB
      checkPaymentStatus(false);
    }
  }, [orderId, statusParam]);

  const checkPaymentStatus = async (isRedirect: boolean) => {
    try {
      setUiStatus('loading');
      
      // Ambil detail order terbaru dari API
      // Asumsi: Anda punya endpoint GET /api/orders/[id] atau ambil dari list
      // Untuk contoh ini, kita pakai endpoint general orders dan filter client-side 
      // atau idealnya buat endpoint spesifik GET /api/orders/[id]
      
      const res = await fetch(`/api/orders?status=all`); 
      const data = await res.json();
      
      if (!data.success) throw new Error('Gagal memuat data');

      // Cari order berdasarkan ID
      const order = data.orders.find((o: any) => o.id.toString() === orderId.toString());

      if (!order) {
        setUiStatus('failed');
        setMessage('Pesanan tidak ditemukan.');
        return;
      }

      // Cek Status Pembayaran dari Database
      // Status 'settlement' atau 'capture' artinya LUNAS
      if (order.payment_status === 'settlement' || order.payment_status === 'capture' || order.status === 'paid') {
        setUiStatus('success');
        setMessage('Pembayaran Berhasil! Pesanan Anda sedang diproses.');
        
        // Redirect ke halaman sukses setelah 2 detik
        setTimeout(() => {
          router.push(`/orders/${orderId}`);
        }, 2500);

      } else if (order.payment_status === 'pending') {
        setUiStatus('pending');
        setMessage('Menunggu Pembayaran. Silakan selesaikan transfer Anda.');
      } else {
        setUiStatus('failed');
        setMessage('Pembayaran Gagal atau Kadaluarsa.');
      }

    } catch (error) {
      console.error(error);
      setUiStatus('failed');
      setMessage('Terjadi kesalahan saat memeriksa status.');
    }
  };

  // Render UI Berdasarkan Status
  const renderContent = () => {
    switch (uiStatus) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-pulse">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <p className="text-lg font-medium text-text-primary">{message}</p>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-bounce-short">
            <div className="p-4 bg-green-100 rounded-full">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-600">Pembayaran Berhasil!</h2>
            <p className="text-text-secondary text-center max-w-xs">{message}</p>
            <p className="text-sm text-text-secondary">Mengalihkan ke detail pesanan...</p>
          </div>
        );

      case 'pending':
        return (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-yellow-100 rounded-full">
              <Clock className="w-16 h-16 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-yellow-600">Menunggu Pembayaran</h2>
            <p className="text-text-secondary text-center max-w-xs">{message}</p>
            <div className="mt-4 p-4 bg-surface border border-border rounded-lg w-full max-w-sm">
              <p className="text-sm text-text-secondary mb-2">Silakan cek email atau halaman Virtual Account Anda untuk instruksi pembayaran.</p>
              <button 
                onClick={() => router.push(`/orders/${orderId}`)}
                className="btn-primary w-full mt-2"
              >
                Lihat Detail Pesanan
              </button>
            </div>
          </div>
        );

      case 'failed':
        return (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-red-100 rounded-full">
              <XCircle className="w-16 h-16 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-600">Pembayaran Gagal</h2>
            <p className="text-text-secondary text-center max-w-xs">{message}</p>
            <div className="flex gap-3 mt-4">
              <button 
                onClick={() => router.push('/katalog')}
                className="btn-outline"
              >
                Kembali ke Katalog
              </button>
              <button 
                onClick={() => router.push(`/orders/${orderId}`)}
                className="btn-primary"
              >
                Cek Pesanan
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-surface p-8 rounded-2xl shadow-xl border border-border text-center relative">
        {/* Tombol Kembali Manual jika stuck */}
        <button 
          onClick={() => router.back()}
          className="absolute top-4 left-4 text-text-secondary hover:text-primary"
          title="Kembali"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {renderContent()}
      </div>
    </div>
  );
}