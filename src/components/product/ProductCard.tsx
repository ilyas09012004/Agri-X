'use client';

import { Star, ShoppingCart, CalendarDays, AlertTriangle, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';
import Image from 'next/image';

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
    if (isPreOrder && remainingQuota !== null && remainingQuota <= 0) {
      alert('Kuota Pre-Order untuk produk ini sudah habis.');
      return;
    }
    setIsAdding(true);
    try {
      await addToCart(product.id, 1);
    } catch (error) {
      console.error('Add to cart error:', error);
      if (error instanceof Error && error.message.includes('Kuota')) {
        alert(error.message);
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
        
        {/* ✅ Quick Add Button - Compact */}
        <button
          onClick={(e) => { e.stopPropagation(); handleAddToCart(e); }}
          className="absolute bottom-2 right-2 z-20 p-1.5 bg-primary text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity duration-200 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={product.status === 'sold_out' || (isPreOrder && remainingQuota !== null && remainingQuota <= 0)}
          aria-label="Tambah ke keranjang"
        >
          <Plus className="w-4 h-4" />
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