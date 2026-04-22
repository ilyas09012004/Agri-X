'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  CreditCard, 
  Building, 
  Smartphone, 
  QrCode,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

// ==========================================
// ✅ KONFIGURASI STATUS & METODE PEMBAYARAN
// ==========================================

const paymentStatusConfig: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: any;
  description: string;
}> = {
  pending: {
    label: 'Menunggu Pembayaran',
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: Clock,
    description: 'Silakan selesaikan pembayaran sebelum waktu habis',
  },
  waiting_payment: {
    label: 'Menunggu Konfirmasi',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: RefreshCw,
    description: 'Pembayaran sedang diproses oleh bank',
  },
  paid: {
    label: 'Lunas',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    icon: CheckCircle,
    description: 'Pembayaran berhasil diterima',
  },
  failed: {
    label: 'Gagal',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    icon: AlertCircle,
    description: 'Pembayaran gagal, silakan coba lagi',
  },
  expired: {
    label: 'Kedaluwarsa',
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-900/30',
    icon: Clock,
    description: 'Batas waktu pembayaran telah habis',
  },
};

const paymentMethodConfig: Record<string, {
  name: string;
  icon: any;
  instructions: string[];
  color: string;
}> = {
  va_bca: {
    name: 'BCA Virtual Account',
    icon: Building,
    color: 'text-blue-600',
    instructions: [
      'Login ke BCA Mobile/KlikBCA',
      'Pilih menu Transfer → Virtual Account',
      'Masukkan nomor Virtual Account',
      'Masukkan jumlah pembayaran',
      'Konfirmasi pembayaran',
      'Simpan bukti transfer',
    ],
  },
  va_mandiri: {
    name: 'Mandiri Virtual Account',
    icon: Building,
    color: 'text-yellow-600',
    instructions: [
      'Login ke Livin Mandiri/Mandiri Online',
      'Pilih menu Bayar → Virtual Account',
      'Masukkan nomor Virtual Account',
      'Masukkan jumlah pembayaran',
      'Konfirmasi pembayaran',
      'Simpan bukti transfer',
    ],
  },
  va_bri: {
    name: 'BRI Virtual Account',
    icon: Building,
    color: 'text-orange-600',
    instructions: [
      'Login ke BRImo/Internet Banking BRI',
      'Pilih menu Pembayaran → Virtual Account',
      'Masukkan nomor Virtual Account',
      'Masukkan jumlah pembayaran',
      'Konfirmasi pembayaran',
      'Simpan bukti transfer',
    ],
  },
  va_bni: {
    name: 'BNI Virtual Account',
    icon: Building,
    color: 'text-blue-800',
    instructions: [
      'Login ke BNI Mobile Banking',
      'Pilih menu Pembayaran → Virtual Account',
      'Masukkan nomor Virtual Account',
      'Masukkan jumlah pembayaran',
      'Konfirmasi pembayaran',
      'Simpan bukti transfer',
    ],
  },
  gopay: {
    name: 'GoPay',
    icon: Smartphone,
    color: 'text-blue-500',
    instructions: [
      'Buka aplikasi Gojek',
      'Pilih menu GoPay → Bayar',
      'Scan QR Code atau masukkan nomor',
      'Masukkan PIN GoPay',
      'Simpan bukti pembayaran',
    ],
  },
  ovo: {
    name: 'OVO',
    icon: Smartphone,
    color: 'text-purple-600',
    instructions: [
      'Buka aplikasi OVO',
      'Pilih menu Scan & Pay',
      'Scan QR Code yang ditampilkan',
      'Masukkan PIN OVO',
      'Simpan bukti pembayaran',
    ],
  },
  dana: {
    name: 'DANA',
    icon: Smartphone,
    color: 'text-blue-700',
    instructions: [
      'Buka aplikasi DANA',
      'Pilih menu Scan',
      'Scan QR Code yang ditampilkan',
      'Masukkan PIN DANA',
      'Simpan bukti pembayaran',
    ],
  },
  qris: {
    name: 'QRIS',
    icon: QrCode,
    color: 'text-red-600',
    instructions: [
      'Buka aplikasi e-wallet apapun (GoPay, OVO, DANA, ShopeePay, dll)',
      'Pilih menu Scan QR',
      'Scan QR Code yang ditampilkan',
      'Masukkan PIN e-wallet',
      'Simpan bukti pembayaran',
    ],
  },
  cod: {
    name: 'Cash on Delivery',
    icon: CreditCard,
    color: 'text-green-600',
    instructions: [
      'Pesanan akan diproses',
      'Siapkan uang tunai sesuai total',
      'Bayar saat kurir mengantarkan',
      'Terima barang dan bukti bayar',
    ],
  },
};

// ==========================================
// ✅ KOMPONEN UTAMA
// ==========================================

export default function OrderPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);
  
  // ✅ State baru untuk redirect
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const hasRedirected = useRef(false); // Prevent multiple redirects

  // Fetch order data
  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/orders/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        
        // Check if expired
        if (data.order.paymentDeadline) {
          const deadline = new Date(data.order.paymentDeadline).getTime();
          const now = Date.now();
          if (now > deadline && data.order.paymentStatus !== 'paid') {
            setIsExpired(true);
          }
        }
      } else {
        throw new Error('Order not found');
      }
    } catch (error: any) {
      console.error('Fetch order error:', error);
      alert(error.message || 'Gagal memuat data order');
      router.push('/orders');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Fungsi redirect ke Midtrans
  const redirectToMidtrans = (paymentUrl: string) => {
    if (!paymentUrl || hasRedirected.current) return;
    
    setIsRedirecting(true);
    setRedirectError(null);
    hasRedirected.current = true;
    
    // Coba redirect langsung
    try {
      // Opsional: Simpan ke session storage untuk tracking
      sessionStorage.setItem('midtrans_redirect_order', params.id as string);
      
      // Redirect ke halaman Midtrans
      window.location.href = paymentUrl;
      
      // Fallback: Jika redirect gagal, buka di new tab setelah 3 detik
      setTimeout(() => {
        if (hasRedirected.current) {
          window.open(paymentUrl, '_blank', 'noopener,noreferrer');
          setRedirectError('Redirect otomatis gagal. Halaman pembayaran dibuka di tab baru.');
          setIsRedirecting(false);
        }
      }, 3000);
    } catch (error) {
      console.error('Redirect error:', error);
      setRedirectError('Gagal membuka halaman pembayaran. Silakan klik tombol di bawah.');
      setIsRedirecting(false);
      hasRedirected.current = false;
    }
  };

  // ✅ Auto-redirect effect
  useEffect(() => {
    if (!order || isLoading || isRedirecting) return;
    
    // Hanya redirect jika:
    // 1. Status pending/belum bayar
    // 2. Ada paymentUrl dari Midtrans
    // 3. Belum pernah redirect
    // 4. Bukan COD (COD tidak perlu redirect)
    if (
      order.paymentStatus === 'pending' && 
      order.paymentUrl && 
      !hasRedirected.current &&
      order.paymentMethod !== 'cod'
    ) {
      // Beri delay 1.5 detik agar user lihat halaman dulu
      const timer = setTimeout(() => {
        redirectToMidtrans(order.paymentUrl);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [order, isLoading, isRedirecting]);

  // Check payment status
  const checkPaymentStatus = async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/orders/${params.id}/payment-status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);

        // If paid, redirect after delay
        if (data.order.paymentStatus === 'paid') {
          setTimeout(() => {
            router.push(`/orders/${params.id}?payment=success`);
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Check payment status error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Copy error:', error);
    }
  };

  // Calculate time remaining
  useEffect(() => {
    if (!order?.paymentDeadline || order.paymentStatus === 'paid') return;

    const calculateTimeRemaining = () => {
      const deadline = new Date(order.paymentDeadline).getTime();
      const now = Date.now();
      const difference = deadline - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeRemaining({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeRemaining({ hours, minutes, seconds });
    };

    calculateTimeRemaining();
    const timer = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(timer);
  }, [order?.paymentDeadline, order?.paymentStatus]);

  // Auto-check payment status every 10 seconds
  useEffect(() => {
    if (!order || order.paymentStatus === 'paid' || isExpired) return;

    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 10000);

    return () => clearInterval(interval);
  }, [order, isExpired]);

  // Initial fetch
  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  // ✅ Akses config yang sudah didefinisikan di atas
  const statusInfo = paymentStatusConfig[order.paymentStatus] || paymentStatusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const paymentMethod = paymentMethodConfig[order.paymentGateway] || paymentMethodConfig.cod;
  const PaymentIcon = paymentMethod.icon;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.push(`/orders/${params.id}`)}
          className="flex items-center gap-2 text-text-secondary hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Kembali ke Detail Order</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Pembayaran Order</h1>
          <p className="text-text-secondary">Order #{order.id}</p>
        </div>

        {/* Payment Status Card */}
        <div className={`${statusInfo.bg} rounded-2xl p-6 mb-6`}>
          <div className="flex items-center justify-center gap-3 mb-3">
            <StatusIcon className={`w-8 h-8 ${statusInfo.color}`} />
            <h2 className={`text-xl font-bold ${statusInfo.color}`}>{statusInfo.label}</h2>
          </div>
          <p className="text-center text-text-secondary">{statusInfo.description}</p>

          {order.paymentStatus === 'paid' && (
            <div className="mt-4 text-center">
              <p className="text-green-600 dark:text-green-400 font-semibold">
                ✓ Pembayaran berhasil! Mengalihkan...
              </p>
            </div>
          )}
        </div>

        {/* Redirect Loading State */}
        {isRedirecting && order.paymentStatus === 'pending' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-6 mb-6 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <h3 className="text-lg font-bold text-blue-600 mb-2">Mengalihkan ke Pembayaran...</h3>
            <p className="text-blue-700 dark:text-blue-300 text-sm">
              Jika halaman tidak terbuka otomatis, klik tombol di bawah.
            </p>
          </div>
        )}

        {/* Redirect Error */}
        {redirectError && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">{redirectError}</p>
            </div>
          </div>
        )}

        {/* Countdown Timer */}
        {order.paymentStatus === 'pending' && !isExpired && !isRedirecting && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-bold text-red-600">Batas Waktu Pembayaran</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-600 text-white rounded-xl flex items-center justify-center text-2xl font-bold">
                  {String(timeRemaining.hours).padStart(2, '0')}
                </div>
                <p className="text-xs text-red-600 mt-1">Jam</p>
              </div>
              <div className="text-3xl font-bold text-red-600">:</div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-600 text-white rounded-xl flex items-center justify-center text-2xl font-bold">
                  {String(timeRemaining.minutes).padStart(2, '0')}
                </div>
                <p className="text-xs text-red-600 mt-1">Menit</p>
              </div>
              <div className="text-3xl font-bold text-red-600">:</div>
              <div className="text-center">
                <div className="w-16 h-16 bg-red-600 text-white rounded-xl flex items-center justify-center text-2xl font-bold animate-pulse">
                  {String(timeRemaining.seconds).padStart(2, '0')}
                </div>
                <p className="text-xs text-red-600 mt-1">Detik</p>
              </div>
            </div>
            <p className="text-center text-sm text-red-600 mt-4">
              ⚠️ Order akan otomatis dibatalkan jika tidak dibayar tepat waktu
            </p>
          </div>
        )}

        {/* Expired Message */}
        {isExpired && order.paymentStatus !== 'paid' && (
          <div className="bg-gray-50 dark:bg-gray-900/20 border-2 border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-6 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-text-primary mb-2">Batas Waktu Habis</h3>
            <p className="text-text-secondary mb-4">
              Maaf, batas waktu pembayaran telah berakhir. Silakan buat order baru.
            </p>
            <button
              onClick={() => router.push('/katalog')}
              className="btn-primary"
            >
              Belanja Lagi
            </button>
          </div>
        )}

        {/* Payment Method Card */}
        {order.paymentStatus === 'pending' && !isExpired && !isRedirecting && (
          <>
            <div className="card mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center`}>
                  <PaymentIcon className={`w-6 h-6 ${paymentMethod.color}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">{paymentMethod.name}</h3>
                  <p className="text-sm text-text-secondary">Ikuti instruksi pembayaran di bawah</p>
                </div>
              </div>

              {/* VA Number */}
              {(order.paymentGateway?.includes('va') || order.vaNumber) && order.vaNumber && (
                <div className="bg-surface rounded-xl p-4 mb-4">
                  <p className="text-sm text-text-secondary mb-2">Nomor Virtual Account</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-background rounded-lg p-4 font-mono text-lg font-bold text-text-primary text-center break-all">
                      {order.vaNumber}
                    </div>
                    <button
                      onClick={() => copyToClipboard(order.vaNumber!, 'va')}
                      className="w-12 h-12 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-secondary transition-colors"
                    >
                      {copiedField === 'va' ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* QR Code */}
              {(order.paymentGateway === 'qris' || ['gopay', 'ovo', 'dana'].includes(order.paymentGateway)) && order.qrCode && (
                <div className="bg-surface rounded-xl p-4 mb-4 text-center">
                  <p className="text-sm text-text-secondary mb-4">Scan QR Code untuk membayar</p>
                  <div className="bg-white p-4 rounded-xl inline-block">
                    <img
                      src={order.qrCode}
                      alt="QR Code Pembayaran"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Payment Instructions */}
              <div className="bg-surface rounded-xl p-4">
                <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Instruksi Pembayaran
                </h4>
                <ol className="space-y-2">
                  {paymentMethod.instructions.map((step, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-text-secondary">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* ✅ Manual Pay Button (Fallback) */}
              {order.paymentUrl && (
                <button
                  onClick={() => redirectToMidtrans(order.paymentUrl)}
                  disabled={isRedirecting}
                  className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  {isRedirecting ? 'Mengalihkan...' : 'Buka Halaman Pembayaran'}
                </button>
              )}
            </div>

            {/* Order Summary */}
            <div className="card mb-6">
              <h3 className="text-lg font-bold text-text-primary mb-4">Ringkasan Pesanan</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-text-secondary">
                  <span>Total Produk</span>
                  <span>{formatCurrency(order.totalProductPrice)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Ongkos Kirim</span>
                  <span>{formatCurrency(order.shippingCost)}</span>
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
                    <span className="text-primary">{formatCurrency(order.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Check Status Button */}
            <button
              onClick={checkPaymentStatus}
              disabled={isChecking}
              className="btn-outline w-full mb-6 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${isChecking ? 'animate-spin' : ''}`} />
              {isChecking ? 'Memeriksa...' : 'Periksa Status Pembayaran'}
            </button>
          </>
        )}

        {/* COD Info */}
        {order.paymentMethod === 'cod' && (
          <div className="card mb-6">
            <h3 className="text-lg font-bold text-text-primary mb-4">Pembayaran COD</h3>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    Pembayaran saat barang diterima
                  </p>
                  <p className="text-green-700 dark:text-green-300 text-sm">
                    Siapkan uang tunai sebesar <strong>{formatCurrency(order.grandTotal)}</strong> saat kurir mengantarkan pesanan Anda.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="text-center">
          <p className="text-text-secondary mb-2">Butuh bantuan?</p>
          <a
            href="https://wa.me/6281234567890"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold"
          >
            Hubungi Customer Service
          </a>
        </div>
      </div>
    </div>
  );
}