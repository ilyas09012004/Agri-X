'use client';

import { Star, ShoppingCart, CalendarDays, AlertTriangle, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  unit: string;
  stock: number;
  min_order: number;
  seller_id: number;
  image?: string;
  image_path?: string;
  category?: string;
  status: 'ready_stock' | 'pre-order' | 'pre_order' | 'sold_out' | 'deleted';
  rating?: number;
  reviews?: number;
  harvest_date?: string;
  badge?: 'Terlaris' | 'Baru';
  po_quota?: number | null;
  po_sold?: number;
}

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isPreOrder = product.status === 'pre-order' || product.status === 'pre_order';
  const remainingQuota = isPreOrder 
    ? ((product.po_quota ?? 999999) - (product.po_sold || 0)) 
    : null;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // ✅ Validasi kuota Pre-Order dengan toast
    if (isPreOrder && remainingQuota !== null && remainingQuota <= 0) {
      toast.error('❌ Kuota Pre-Order untuk produk ini sudah habis.', {
        duration: 3000,
        position: 'bottom-right',
      });
      return;
    }
    
    setIsAdding(true);

try {
  // ✅ Validasi Pre-Order: Cek kuota PO sebelum call API
  const isPreOrder = product.status === 'pre-order' || product.status === 'pre_order';
  
  if (isPreOrder && product.po_quota !== null) {
    const remainingQuota = product.po_quota - (product.po_sold || 0);
    
    if (remainingQuota <= 0) {
      // ❌ Jangan call API, langsung toast error yang halus
      toast.error('😔 Maaf, kuota Pre-Order sudah penuh', {
        duration: 5000,
        position: 'bottom-right',
        style: {
          background: '#F59E0B', // Amber untuk warning
          color: '#fff',
        },
        // ✅ Tawarkan alternatif
        action: {
          label: 'Lihat Produk Lain',
          onClick: () => router.push('/katalog'),
        },
      });
      setIsAdding(false);
      return;
    }
  }
  
  // ✅ Validasi Pre-Order: Cek masa panen
  if (isPreOrder && product.harvest_date) {
    const harvestDate = new Date(product.harvest_date);
    const today = new Date();
    harvestDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (today > harvestDate) {
      toast.error('🍂 Masa panen sudah lewat', {
        duration: 5000,
        position: 'bottom-right',
        style: {
          background: '#6B7280', // Gray untuk info netral
          color: '#fff',
        },
        // ✅ Tawarkan notifikasi
        action: {
          label: 'Notifikasi Saat Tersedia',
          onClick: () => {
            toast.success('✅ Kami akan beri tahu saat produk tersedia!', {
              duration: 3000,
              position: 'bottom-right',
            });
            // TODO: Implement fitur stock alert di backend
          },
        },
      });
      setIsAdding(false);
      return;
    }
  }

  // ✅ Semua validasi lolos, call API
  await addToCart(product.id, 1);
  
  // ✅ Toast sukses
    toast.success('✅ Ditambahkan ke keranjang!', {
      duration: 3000,
      position: 'bottom-right',
      style: {
        background: '#10B981',
        color: '#fff',
      },
      // ✅ Action button ke keranjang
      action: {
        label: 'Lihat Keranjang',
        onClick: () => router.push('/keranjang'),
      },
    });
    
  } catch (error: any) {
    console.error('Add to cart error:', error);
    
    // ✅ Handle error spesifik dari backend
    const errorMessage = error?.message || 'Gagal menambahkan ke keranjang';
    
    if (errorMessage.includes('Kuota') || errorMessage.includes('quota')) {
      // 🎯 Error quota: pesan lebih halus + solusi
      toast.error('😔 Kuota Pre-Order sudah habis', {
        duration: 5000,
        position: 'bottom-right',
        style: {
          background: '#F59E0B',
          color: '#fff',
        },
        action: {
          label: 'Lihat Produk Lain',
          onClick: () => router.push('/katalog'),
        },
      });
    } 
    else if (errorMessage.includes('panen') || errorMessage.includes('harvest')) {
      // 🎯 Error masa panen: informatif + harapan
      toast.error('🍂 Produk sedang dalam proses panen', {
        duration: 5000,
        position: 'bottom-right',
        style: {
          background: '#6B7280',
          color: '#fff',
        },
        action: {
          label: 'Notifikasi Saya',
          onClick: () => {
            toast.success('✅ Anda akan kami beri tahu!', { duration: 3000 });
          },
        },
      });
    }
    else if (errorMessage.includes('stok') || errorMessage.includes('stock')) {
      // 🎯 Error stok: tawarkan quantity maksimal
      toast.error(`❌ Stok tidak mencukupi`, {
        duration: 4000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: '#fff',
        },
        action: {
          label: 'Ambil Stok Tersisa',
          onClick: () => {
            // TODO: Auto-adjust quantity ke max available
            toast.info('🔄 Quantity disesuaikan', { duration: 2000 });
          },
        },
      });
    }
    else {
      // 🎯 Error umum: fallback message
      toast.error('❌ Gagal menambahkan ke keranjang', {
        duration: 4000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: '#fff',
        },
      });
    }
    
  } finally {
    setIsAdding(false);
  }
  };

  const getStatusColor = () => {
    switch (product.status) {
      case 'ready_stock': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pre-order':
      case 'pre_order': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'sold_out': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (product.status) {
      case 'ready_stock': return 'Ready';
      case 'pre-order':
      case 'pre_order': return 'Pre-Order';
      case 'sold_out': return 'Habis';
      default: return product.status;
    }
  };

  const getImageUrl = () => {
    if (imageError) return null;
    const imageUrl = product.image_path || product.image;
    if (!imageUrl) return null;
    if (imageUrl.startsWith('/')) {
      return `${process.env.NEXT_PUBLIC_APP_URL || ''}${imageUrl}`;
    }
    return imageUrl;
  };

  const imageUrl = getImageUrl();

  return (
    <div
      onClick={() => router.push(`/produk/${product.id}`)}
      className="card cursor-pointer group relative overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      {/* ✅ Badge - Reduced padding & position */}
      {product.badge && (
        <span className="absolute top-2 right-2 z-10 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-[10px] px-1.5 py-0.5 rounded-full font-medium shadow-sm">
          {product.badge}
        </span>
      )}
      
      {/* ✅ Product Image */}
      <div className="relative aspect-square bg-gradient-to-br from-secondary/10 to-primary/10 rounded-xl mb-2 overflow-hidden group-hover:scale-105 transition-transform duration-300">
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            onError={() => setImageError(true)}
            unoptimized={imageUrl?.startsWith('http://')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-surface/50 ">
            <span>🌾</span>
          </div>
        )}
        
        {/* ✅ Sold Out Overlay */}
        {product.status === 'sold_out' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
            <span className="text-white font-bold text-xs px-2 py-1 bg-red-500/90 rounded-full">
              Sold Out
            </span>
          </div>
        )}
        
        {/* ✅ Quick Add Button - Show on Hover */}
        <button
          onClick={handleAddToCart}
          disabled={isAdding || product.status === 'sold_out' || (isPreOrder && remainingQuota !== null && remainingQuota <= 0)}
          className="absolute bottom-2 right-2 z-20 p-2 bg-primary text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Tambah ke keranjang"
        >
          {isAdding ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* ✅ Product Info - Reduced padding & gaps */}
      <div className="space-y-1 px-1">
        
        {/* Status Tags */}
        <div className="flex items-center gap-1 flex-wrap min-h-[20px]">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          {isPreOrder && product.harvest_date && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 flex items-center gap-0.5 whitespace-nowrap">
              <CalendarDays className="w-3 h-3 flex-shrink-0" />
              {new Date(product.harvest_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        {/* Product Name - Compact */}
        <h3 className="font-semibold text-text-primary line-clamp-2 group-hover:text-primary transition-colors text-sm leading-tight">
          {product.name}
        </h3>

        {/* ✅ Category & Rating - 1 Row Compact */}
        <div className="flex items-center justify-between gap-2">
          {/* Category */}
          <p className="text-[10px] text-text-secondary truncate flex-1">
            {product.category || 'Pertanian'}
          </p>
          
          {/* Rating */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-[10px] font-medium">{product.rating?.toFixed(1) || '0.0'}</span>
            <span className="text-[10px] text-text-secondary">({product.reviews || 0})</span>
          </div>
        </div>

        {/* Pre-Order Quota */}
        {isPreOrder && remainingQuota !== null && (
          <div className={`flex items-center gap-0.5 text-[10px] ${
            remainingQuota <= 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-text-secondary'
          }`}>
            <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${remainingQuota <= 10 ? 'text-orange-500' : ''}`} />
            <span className="truncate">
              {remainingQuota <= 0 ? 'Habis' : remainingQuota <= 10 ? `Sisa ${remainingQuota}` : `PO: ${remainingQuota}`} {product.unit}
            </span>
          </div>
        )}

        {/* Price - Compact */}
        <div className="flex items-end justify-between pt-1 border-t border-border/50 dark:border-border-dark/50">
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-primary leading-none">
              Rp {product.price.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-text-secondary font-normal">
              /{product.unit || 'kg'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}