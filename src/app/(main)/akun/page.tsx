// src/app/(main)/akun/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, MapPin, MessageSquare, Star, Settings, LogOut, 
  Package, Clock, CheckCircle, Camera, Loader2, 
  Truck, CreditCard, ArrowRight, AlertCircle 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext'; // ✅ FIX: contexts (dengan 's')
import { getCookie } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';

const orderTabs = [
  { id: 'all', label: 'Semua', icon: Package },
  { id: 'pending', label: 'Belum Dibayar', icon: Clock },
  { id: 'shipped', label: 'Dikirim', icon: Truck },
  { id: 'delivered', label: 'Selesai', icon: CheckCircle },
];

const menuItems = [
  { icon: MapPin, label: 'Alamat Saya', href: '/akun/alamat' },
  { icon: MessageSquare, label: 'Forum Diskusi', href: '/forum' },
  { icon: Star, label: 'Ulasan Saya', href: '/akun/ulasan' },
  { icon: Settings, label: 'Pengaturan', href: '/akun/pengaturan' },
];

export default function AccountPage() {
  const router = useRouter();
  const { user, logout, updateUser, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [isUploading, setIsUploading] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // ✅ REDIRECT IF NOT AUTHENTICATED
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/akun');
    }
  }, [isAuthenticated, isLoading, router]);

  // Fetch orders on mount & tab change
  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [activeTab, isAuthenticated]);

  const fetchOrders = async () => {
    try {
      setIsLoadingOrders(true);
      const token = getCookie('accessToken');
      
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }
      
      const res = await fetch(`/api/orders?status=${activeTab}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      } else {
        setOrders([]);
      }
    } catch (error: any) {
      console.error('Fetch orders error:', error);
      setOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Yakin ingin logout?')) {
      await logout();
    }
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Hanya file JPG, PNG, atau WEBP yang diperbolehkan');
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Ukuran file maksimal 2MB');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const token = getCookie('accessToken');
      const res = await fetch('/api/users/upload-avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        updateUser({ avatar: data.avatar });
        alert('Foto profil berhasil diupdate!');
      } else {
        throw new Error(data.error || 'Gagal upload avatar');
      }
    } catch (error: any) {
      console.error('Upload avatar error:', error);
      alert(error.message || 'Gagal upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; bg: string; color: string }> = {
      pending: { label: 'Belum Dibayar', bg: 'bg-yellow-100', color: 'text-yellow-800' },
      paid: { label: 'Dibayar', bg: 'bg-blue-100', color: 'text-blue-800' },
      shipped: { label: 'Dikirim', bg: 'bg-indigo-100', color: 'text-indigo-800' },
      delivered: { label: 'Selesai', bg: 'bg-green-100', color: 'text-green-800' },
      cancelled: { label: 'Dibatalkan', bg: 'bg-red-100', color: 'text-red-800' },
    };
    
    const statusInfo = config[status] || { label: status, bg: 'bg-gray-100', color: 'text-gray-800' };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="animate-fade-in min-h-screen pb-20">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-8 text-white mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name || 'User'}
                className="w-20 h-20 rounded-full object-cover border-4 border-white/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-white text-primary rounded-full flex items-center justify-center cursor-pointer hover:bg-primary hover:text-white transition-colors shadow-lg">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadAvatar}
                className="hidden"
                disabled={isUploading}
              />
            </label>

            {isUploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold">{user?.name || 'User'}</h1>
            <p className="text-white/80">{user?.email || 'email@example.com'}</p>
            <p className="text-sm bg-white/20 inline-block px-3 py-1 rounded-full mt-2 capitalize">
              {user?.role || 'buyer'}
            </p>
          </div>
        </div>
      </div>

      {/* Order Tabs */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text-primary mb-4">Laporan Pesanan</h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {orderTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'bg-surface text-text-secondary hover:bg-primary/10'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Order List */}
      <div className="space-y-4 mb-8">
        {isLoadingOrders ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : orders.length > 0 ? (
          orders.map((order) => (
            <div 
              key={order.id} 
              className="card cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-border">
                <div>
                  <span className="font-semibold text-text-primary">Order #{order.id}</span>
                  <p className="text-sm text-text-secondary">{formatDate(order.createdAt)}</p>
                </div>
                {getStatusBadge(order.status)}
              </div>
              
              {/* Order Items */}
              <div className="space-y-3 mb-4">
                {order.orderItems?.slice(0, 3).map((item: any, index: number) => (
                  <div key={index} className="flex gap-4">
                    <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <span>🌾</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">{item.productName}</p>
                      <p className="text-sm text-text-secondary">
                        {item.quantity} {item.unit || 'kg'} × {formatCurrency(item.price || item.priceAtOrder || 0)}
                      </p>
                      <p className="font-bold text-primary">
                        {formatCurrency((item.price || item.priceAtOrder || 0) * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
                {order.orderItems?.length > 3 && (
                  <p className="text-sm text-text-secondary text-center">
                    +{order.orderItems.length - 3} produk lainnya
                  </p>
                )}
              </div>

              {/* Total & Actions */}
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-text-secondary">Total Pembayaran</p>
                  <p className="font-bold text-lg text-primary">
                    {formatCurrency(order.grandTotal || order.grand_total || 0)}
                  </p>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {/* ✅ PAY BUTTON - Redirect ke /orders/[id]/pay */}
                  {order.status === 'pending' && order.paymentMethod !== 'cod' && (
                    <button 
                      className="btn-primary px-4 py-2 text-sm flex items-center gap-1" 
                      onClick={() => router.push(`/orders/${order.id}/pay`)}
                    >
                      <CreditCard className="w-4 h-4" />
                      Bayar
                    </button>
                  )}
                  
                  {/* COD Info */}
                  {order.status === 'pending' && order.paymentMethod === 'cod' && (
                    <span className="text-xs text-text-secondary bg-green-100 text-green-800 px-3 py-2 rounded-full">
                      COD (Bayar di Tempat)
                    </span>
                  )}
                  
                  {/* Track Button */}
                  {order.status === 'shipped' && (
                    <button 
                      className="btn-primary px-4 py-2 text-sm flex items-center gap-1" 
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <Truck className="w-4 h-4" />
                      Lacak
                    </button>
                  )}
                  
                  {/* Review Button */}
                  {order.status === 'delivered' && (
                    <button 
                      className="btn-outline px-4 py-2 text-sm" 
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      Ulasan
                    </button>
                  )}
                  
                  {/* Detail Button (All Status) */}
                  <button 
                    className="btn-outline px-4 py-2 text-sm flex items-center gap-1" 
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    Detail
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 card">
            <Package className="w-16 h-16 mx-auto text-text-secondary mb-4" />
            <p className="text-text-secondary font-medium">
              {activeTab === 'all' 
                ? 'Belum ada pesanan' 
                : `Tidak ada pesanan ${orderTabs.find(t => t.id === activeTab)?.label?.toLowerCase()}`
              }
            </p>
            <button 
              onClick={() => router.push('/katalog')}
              className="btn-primary mt-4"
            >
              Mulai Belanja
            </button>
          </div>
        )}
      </div>

      {/* Menu */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text-primary mb-4">Menu</h2>
        <div className="card divide-y divide-border">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                onClick={() => router.push(item.href)}
                className="w-full flex items-center gap-4 p-4 hover:bg-background transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="flex-1 text-left font-medium text-text-primary">{item.label}</span>
                <span className="text-text-secondary">›</span>
              </button>
            );
          })}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 hover:bg-red-50 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="flex-1 text-left font-medium text-red-500">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}