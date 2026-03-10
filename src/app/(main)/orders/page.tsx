'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  Truck, 
  AlertCircle,
  Search,
  Filter,
  CreditCard
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

const statusConfig: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: any;
}> = {
  pending: {
    label: 'Belum Bayar',
    color: 'text-yellow-600',
    bg: 'bg-yellow-100',
    icon: Clock,
  },
  paid: {
    label: 'Dibayar',
    color: 'text-green-600',
    bg: 'bg-green-100',
    icon: CheckCircle,
  },
  shipped: {
    label: 'Dikirim',
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    icon: Truck,
  },
  delivered: {
    label: 'Diterima',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    icon: Package,
  },
  cancelled: {
    label: 'Dibatalkan',
    color: 'text-red-600',
    bg: 'bg-red-100',
    icon: AlertCircle,
  },
};

const orderTabs = [
  { id: 'all', label: 'Semua' },
  { id: 'pending', label: 'Belum Bayar' },
  { id: 'paid', label: 'Dibayar' },
  { id: 'shipped', label: 'Dikirim' },
  { id: 'delivered', label: 'Diterima' },
  { id: 'cancelled', label: 'Dibatalkan' },
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [activeTab]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const res = await fetch(`/api/orders?status=${activeTab}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Fetch orders error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.id.toString().includes(query) ||
      order.address_detail?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Pesanan Saya</h1>
        <p className="text-text-secondary">Kelola dan lacak pesanan Anda</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Cari ID order atau alamat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {orderTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusInfo = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={order.id}
                className="card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-text-primary mb-1">
                      Order #{order.id}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className={`${statusInfo.bg} ${statusInfo.color} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusInfo.label}
                  </div>
                </div>

                {/* Order Items Preview */}
                <div className="flex gap-3 mb-4">
                  {order.orderItems?.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center text-2xl">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        '🌾'
                      )}
                    </div>
                  ))}
                  {order.orderItems?.length > 3 && (
                    <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center text-sm font-bold text-text-secondary">
                      +{order.orderItems.length - 3}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-text-secondary mb-1">Total Pembayaran</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(order.grandTotal)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'pending' && order.paymentMethod !== 'cod' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/orders/${order.id}/pay`);
                        }}
                        className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        Bayar
                      </button>
                    )}
                    <button className="btn-outline px-4 py-2 text-sm">
                      Detail
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <Package className="w-24 h-24 mx-auto text-text-secondary mb-4" />
          <h3 className="text-xl font-semibold text-text-primary mb-2">
            {activeTab === 'all' ? 'Belum Ada Pesanan' : `Tidak Ada Pesanan ${orderTabs.find(t => t.id === activeTab)?.label}`}
          </h3>
          <p className="text-text-secondary mb-6">
            {activeTab === 'all' ? 'Mulai belanja produk pertanian terbaik' : 'Pesanan dengan status ini tidak ditemukan'}
          </p>
          {activeTab === 'all' && (
            <button
              onClick={() => router.push('/katalog')}
              className="btn-primary"
            >
              Belanja Sekarang
            </button>
          )}
        </div>
      )}
    </div>
  );
}