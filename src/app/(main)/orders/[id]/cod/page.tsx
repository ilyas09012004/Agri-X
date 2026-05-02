'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  Wallet, CheckCircle, Truck, MapPin, Calendar, 
  ArrowLeft, Phone, Copy, Check 
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function CodPaymentPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;
  
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('accessToken='))
        ?.split('=')[1];

      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      }
    } catch (err) {
      console.error('Error fetching order:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(order?.orderId || orderId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-text-secondary">Memuat detail pesanan...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-red-500 mb-4">Pesanan tidak ditemukan</p>
          <button onClick={() => router.push('/')} className="btn-primary">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => router.push('/')}
            className="p-2 hover:bg-surface rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              💰 Siapkan Uang untuk Pembayaran
            </h1>
            <p className="text-text-secondary text-sm">
              Pesanan #{order.orderId}
            </p>
          </div>
        </div>

        {/* Success Banner */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <h2 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                Pesanan Berhasil Dibuat!
              </h2>
              <p className="text-green-700 dark:text-green-300 text-sm">
                Petani kami sedang mempersiapkan pesanan Anda. 
                Siapkan uang tunai sesuai total pembayaran untuk diserahkan kepada kurir.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Amount Card */}
        <div className="bg-gradient-to-br from-primary to-secondary rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-6 h-6" />
            <span className="font-medium">Siapkan Uang Tunai</span>
          </div>
          <div className="text-4xl font-bold mb-2">
            {formatCurrency(order.grandTotal)}
          </div>
          <p className="text-white/80 text-sm">
            Bayar saat pesanan tiba di alamat Anda
          </p>
        </div>

        {/* Order Details */}
        <div className="space-y-4 mb-6">
          
          {/* Order ID */}
          <div className="bg-surface rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-text-secondary mb-1">Kode Pesanan</p>
                <p className="font-mono font-semibold text-text-primary">
                  {order.orderId}
                </p>
              </div>
              <button 
                onClick={handleCopyOrderId}
                className="p-2 hover:bg-border rounded-lg transition-colors"
                title="Salin kode pesanan"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-text-secondary" />
                )}
              </button>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-surface rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-primary" />
              <p className="font-medium text-text-primary">Alamat Pengiriman</p>
            </div>
            <p className="text-sm text-text-secondary">
              {order.address?.recipientName}<br />
              {order.address?.detail}, {order.address?.village}, {order.address?.district},<br />
              {order.address?.city}, {order.address?.province} {order.address?.zipCode}<br />
              📞 {order.address?.recipientPhone}
            </p>
          </div>

          {/* Items Summary */}
          <div className="bg-surface rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-primary" />
              <p className="font-medium text-text-primary">Ringkasan Pesanan</p>
            </div>
            <div className="space-y-2">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    {item.productName} × {item.quantity}
                  </span>
                  <span className="text-text-primary font-medium">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Ongkos Kirim</span>
                  <span className="text-text-primary">{formatCurrency(order.shippingCost)}</span>
                </div>
                <div className="flex justify-between font-semibold mt-1">
                  <span className="text-text-primary">Total</span>
                  <span className="text-primary">{formatCurrency(order.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* COD Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Instruksi Pembayaran COD
            </h3>
            <ol className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <li className="flex items-start gap-2">
                <span className="font-bold">1.</span>
                <span>Pastikan Anda memiliki uang tunai sebesar <strong>{formatCurrency(order.grandTotal)}</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">2.</span>
                <span>Tunggu kurir menghubungi Anda untuk konfirmasi pengiriman</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">3.</span>
                <span>Periksa barang yang diterima sebelum membayar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">4.</span>
                <span>Serahkan uang tunai kepada kurir dan dapatkan tanda terima</span>
              </li>
            </ol>
          </div>

          {/* Estimated Delivery */}
          {order.estimated_ship_date && (
            <div className="bg-surface rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <p className="text-sm text-text-secondary">
                  Perkiraan Pengiriman: <span className="font-medium text-text-primary">
                    {new Date(order.estimated_ship_date).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => router.push(`/orders/${orderId}`)}
            className="btn-primary flex-1 py-4"
          >
            Lihat Detail Pesanan
          </button>
          <button 
            onClick={() => router.push('/')}
            className="btn-outline flex-1 py-4"
          >
            Lanjut Belanja
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-text-secondary mb-2">
            Butuh bantuan dengan pesanan ini?
          </p>
          <a 
            href="https://wa.me/6281234567890" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
          >
            <Phone className="w-4 h-4" />
            Hubungi Customer Service
          </a>
        </div>

      </div>
    </div>
  );
}