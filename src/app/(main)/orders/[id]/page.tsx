'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Clock, CheckCircle, Truck, Package, XCircle, 
  CreditCard, MapPin, Phone, User, Calendar, AlertCircle 
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getCookie } from '@/lib/auth';

const statusConfig: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: any;
  description: string;
}> = {
  pending: {
    label: 'Belum Dibayar',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
    icon: Clock,
    description: 'Silakan selesaikan pembayaran',
  },
  paid: {
    label: 'Dibayar',
    color: 'text-green-600',
    bg: 'bg-green-100',
    icon: CheckCircle,
    description: 'Pembayaran berhasil diterima',
  },
  shipped: {
    label: 'Dikirim',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    icon: Truck,
    description: 'Pesanan sedang dalam pengiriman',
  },
  delivered: {
    label: 'Diterima',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    icon: Package,
    icon: CheckCircle,
    description: 'Pesanan telah diterima',
  },
  cancelled: {
    label: 'Dibatalkan',
    color: 'text-red-600',
    bg: 'bg-red-100',
    icon: XCircle,
    description: 'Pesanan telah dibatalkan',
  },
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = getCookie('accessToken');
      
      if (!token) {
        throw new Error('Silakan login terlebih dahulu');
      }

      console.log('Fetching order:', params.id);
      
      const res = await fetch(`/api/orders/${params.id}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal memuat data order');
      }

      const data = await res.json();
      console.log('Order data:', data);
      
      setOrder(data.order);
    } catch (err: any) {
      console.error('Fetch order error:', err);
      setError(err.message || 'Gagal memuat data order');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">Order Tidak Ditemukan</h2>
          <p className="text-text-secondary mb-4">{error || 'Data order tidak tersedia'}</p>
          <button onClick={() => router.push('/akun')} className="btn-primary">
            Kembali ke Laporan Pesanan
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="animate-fade-in min-h-screen pb-20">
      {/* Back Button */}
      <button
        onClick={() => router.push('/akun')}
        className="flex items-center gap-2 text-text-secondary hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Kembali</span>
      </button>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">Order #{order.id}</h1>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDate(order.createdAt)}
              </span>
            </div>
          </div>
          <div className={`${statusInfo.bg} ${statusInfo.color} px-4 py-2 rounded-full font-semibold flex items-center gap-2`}>
            <StatusIcon className="w-5 h-5" />
            {statusInfo.label}
          </div>
        </div>
        <p className="text-text-secondary text-sm">{statusInfo.description}</p>
      </div>

      {/* Payment Info (jika bukan COD) */}
      {order.paymentMethod !== 'cod' && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-bold text-text-primary">Informasi Pembayaran</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-text-secondary">Metode</span>
              <span className="text-text-primary font-medium capitalize">{order.paymentGateway || order.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Status</span>
              <span className={`${order.paymentStatus === 'paid' ? 'text-green-500' : 'text-yellow-500'} font-medium`}>
                {order.paymentStatus || 'pending'}
              </span>
            </div>
            {order.vaNumber && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Virtual Account</span>
                <span className="text-text-primary font-mono">{order.vaNumber}</span>
              </div>
            )}
            {order.paymentDeadline && (
              <div className="flex justify-between">
                <span className="text-text-secondary">Batas Bayar</span>
                <span className="text-red-500 font-medium">{formatDate(order.paymentDeadline)}</span>
              </div>
            )}
          </div>

          {/* Pay Button */}
          {order.status === 'pending' && order.paymentUrl && (
            <a
              href={`/orders/${order.id}/pay`}
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Bayar Sekarang
            </a>
          )}
        </div>
      )}

      {/* COD Info */}
      {order.paymentMethod === 'cod' && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-bold text-text-primary">Pembayaran COD</h3>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
            <p className="text-green-700">
              💵 Siapkan uang tunai sebesar <strong>{formatCurrency(order.grandTotal)}</strong> saat kurir mengantarkan pesanan.
            </p>
          </div>
        </div>
      )}

      {/* Alamat Pengiriman */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-6 h-6 text-primary" />
          <h3 className="text-lg font-bold text-text-primary">Alamat Pengiriman</h3>
        </div>
        <div className="space-y-2 text-text-secondary">
          <p>{order.address_detail}</p>
          <p>{order.villageCode}, {order.districtId}, {order.cityId}</p>
          <p>{order.province} {order.zipCode}</p>
        </div>
      </div>

      {/* Order Items */}
      <div className="card mb-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Produk</h3>
        <div className="space-y-4">
          {order.orderItems?.map((item: any) => (
            <div key={item.id} className="flex gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
              <div className="w-20 h-20 bg-surface rounded-lg flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                {item.productImage ? (
                  <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                ) : (
                  <span>🌾</span>
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-text-primary">{item.productName}</p>
                <p className="text-sm text-text-secondary">
                  {item.quantity} {item.unit || 'kg'} × {formatCurrency(item.price || item.priceAtOrder || 0)}
                </p>
                <p className="font-bold text-primary mt-1">
                  {formatCurrency((item.price || item.priceAtOrder || 0) * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ringkasan Pembayaran */}
      <div className="card mb-6">
        <h3 className="text-lg font-bold text-text-primary mb-4">Ringkasan Pembayaran</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-text-secondary">
            <span>Total Produk</span>
            <span>{formatCurrency(order.totalProductPrice || order.total_product_price || 0)}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>Ongkos Kirim</span>
            <span>{formatCurrency(order.shippingCost || order.shipping_cost || 0)}</span>
          </div>
          {order.paymentFee > 0 && (
            <div className="flex justify-between text-text-secondary">
              <span>Biaya Pembayaran</span>
              <span>{formatCurrency(order.paymentFee)}</span>
            </div>
          )}
          <div className="border-t border-border pt-3">
            <div className="flex justify-between text-lg font-bold text-text-primary">
              <span>Total Bayar</span>
              <span className="text-primary">{formatCurrency(order.grandTotal || order.grand_total || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {order.status === 'pending' && order.paymentMethod !== 'cod' && (
          <button
            onClick={() => router.push(`/orders/${order.id}/pay`)}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            Bayar Sekarang
          </button>
        )}
        {order.status === 'shipped' && (
          <button className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Truck className="w-5 h-5" />
            Lacak Pesanan
          </button>
        )}
        {order.status === 'delivered' && (
          <button className="btn-primary flex-1">
            Beri Ulasan
          </button>
        )}
      </div>
    </div>
  );
}