// src/app/(main)/orders/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, Copy, Clock, Truck } from 'lucide-react';
import { getCookie } from '@/lib/auth';

interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productImage?: string;
  quantity: number;
  price: number;
  subtotal: number;
  unit: string;
}

interface Order {
  id: number;
  orderId: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'success' | 'failed';
  paymentMethod?: string;
  paymentGateway?: string;
  vaNumber?: string;
  bankName?: string;
  paymentDeadline?: string;
  paidAt?: string;
  totalProductPrice: number;
  shippingCost: number;
  paymentFee: number;
  grandTotal: number;
  address: {
    detail: string;
    city: string;
    district: string;
    villageCode: string;
    province: string;
    zipCode: string;
  };
  orderItems: OrderItem[];
  createdAt: string;
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (orderId) fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const token = getCookie('accessToken');
      
      const res = await fetch(`/api/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memuat detail pesanan');
      }

      const data = await res.json();
      setOrder(data.order);
    } catch (err: any) {
      console.error('Fetch order error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Menunggu Pembayaran' },
      paid: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Sudah Dibayar' },
      shipped: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Dikirim' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Selesai' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Dibatalkan' },
    };
    return badges[status] || badges.pending;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-text-primary">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Memuat detail pesanan...</span>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-text-primary mb-2">Pesanan Tidak Ditemukan</h2>
        <p className="text-text-secondary mb-6">{error || 'ID pesanan tidak valid'}</p>
        <button onClick={() => router.push('/')} className="btn-primary">
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const statusBadge = getStatusBadge(order.status);

  return (
    <div className="min-h-screen bg-background pb-20">
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
          <h1 className="text-lg font-bold text-text-primary">Detail Pesanan</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Order ID & Status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-text-secondary">Order ID</p>
              <p className="font-mono font-bold text-text-primary">{order.orderId}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.bg} ${statusBadge.text}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            📅 {formatDate(order.createdAt)}
          </p>
        </div>

        {/* Payment Info - PENDING VA */}
        {order.paymentStatus === 'pending' && order.paymentMethod === 'bank_transfer' && (
          <div className="card border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-blue-800 dark:text-blue-200">Menunggu Pembayaran</h3>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center p-3 bg-white dark:bg-background rounded-lg">
                <span className="text-sm text-text-secondary">Bank</span>
                <span className="font-bold text-text-primary">{order.bankName?.toUpperCase()} Virtual Account</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white dark:bg-background rounded-lg">
                <span className="text-sm text-text-secondary">Nomor VA</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-text-primary">{order.vaNumber}</span>
                  <button
                    onClick={() => copyToClipboard(order.vaNumber || '')}
                    className="p-1 hover:bg-primary/10 rounded transition-colors"
                    title="Salin nomor VA"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white dark:bg-background rounded-lg">
                <span className="text-sm text-text-secondary">Batas Pembayaran</span>
                <span className="font-medium text-red-600">{formatDate(order.paymentDeadline)}</span>
              </div>
            </div>

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
              💡 <strong>Cara Bayar:</strong> Transfer ke nomor VA di atas melalui ATM, Mobile Banking, atau Internet Banking {order.bankName?.toUpperCase()}. Pembayaran akan terkonfirmasi otomatis.
            </div>
          </div>
        )}

        {/* Payment Info - SUCCESS */}
        {order.paymentStatus === 'success' && (
          <div className="card border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <h3 className="font-bold text-green-800 dark:text-green-200">Pembayaran Berhasil</h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Dibayar via {order.paymentMethod?.replace('_', ' ').toUpperCase()} • {formatDate(order.paidAt)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Address */}
        <div className="card">
          <h3 className="font-bold text-text-primary mb-3">Alamat Pengiriman</h3>
          <p className="text-text-secondary">
            {order.address.detail}, {order.address.villageCode}, {order.address.district}, {order.address.city}, {order.address.province} {order.address.zipCode}
          </p>
        </div>

        {/* Order Items */}
        <div className="card">
          <h3 className="font-bold text-text-primary mb-3">Item Pesanan</h3>
          <div className="space-y-3">
            {order.orderItems.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center overflow-hidden">
                  {item.productImage ? (
                    <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">🌾</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-text-primary text-sm">{item.productName}</p>
                  <p className="text-xs text-text-secondary">{item.quantity} {item.unit} × {formatCurrency(item.price)}</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(item.subtotal)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Price Summary */}
        <div className="card">
          <h3 className="font-bold text-text-primary mb-3">Ringkasan Pembayaran</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-text-secondary">
              <span>Total Produk</span>
              <span>{formatCurrency(order.totalProductPrice)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Ongkos Kirim</span>
              <span>{formatCurrency(order.shippingCost)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Biaya Pembayaran</span>
              <span>{formatCurrency(order.paymentFee)}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between font-bold text-lg">
                <span>Total Bayar</span>
                <span className="text-primary">{formatCurrency(order.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => router.push('/')} className="btn-outline flex-1">
            Kembali ke Beranda
          </button>
          {order.status === 'paid' && (
            <button className="btn-primary flex-1">
              <Truck className="w-4 h-4 inline mr-1" />
              Lacak Pesanan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}