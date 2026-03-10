'use client';

import { Star, ShoppingCart } from 'lucide-react';
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
  status: 'pre_order' | 'ready_stock' | 'sold_out' | 'deleted';
  rating?: number;
  reviews?: number;
  harvest_date?: string;
  badge?: 'Terlaris' | 'Baru';
}

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAdding(true);
    try {
      await addToCart(product.id, 1);
    } catch (error) {
      console.error('Add to cart error:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const getStatusColor = () => {
    switch (product.status) {
      case 'ready_stock':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pre_order':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'sold_out':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (product.status) {
      case 'ready_stock':
        return 'Ready';
      case 'pre_order':
        return 'Pre-Order';
      case 'sold_out':
        return 'Habis';
      default:
        return product.status;
    }
  };

  // Get image URL from database
  const getImageUrl = () => {
    if (imageError) return null;
    
    // Prioritas: image_path > image > null
    const imageUrl = product.image_path || product.image;
    
    if (!imageUrl) return null;
    
    // Jika URL relatif, tambahkan base URL
    if (imageUrl.startsWith('/')) {
      return `${process.env.NEXT_PUBLIC_APP_URL || ''}${imageUrl}`;
    }
    
    // Jika URL absolut (dari database/storage)
    return imageUrl;
  };

  const imageUrl = getImageUrl();

  return (
    <div
      onClick={() => router.push(`/produk/${product.id}`)}
      className="card cursor-pointer group relative"
    >
      {product.badge && (
        <span className="absolute top-2 left-2 badge bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 z-10">
          {product.badge}
        </span>
      )}
      
      {/* Product Image */}
      <div className="relative aspect-square bg-gradient-to-br from-secondary/20 to-primary/20 rounded-xl mb-3 overflow-hidden group-hover:scale-105 transition-transform duration-300">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            onError={() => setImageError(true)}
            unoptimized={imageUrl?.startsWith('http://')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            <span>🌾</span>
          </div>
        )}
        
        {/* Status Overlay */}
        {product.status === 'sold_out' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-lg">Sold Out</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>

        <h3 className="font-semibold text-text-primary line-clamp-1 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        <p className="text-sm text-text-secondary">{product.category || 'Pertanian'}</p>

        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="text-sm font-medium">{product.rating?.toFixed(1) || '0'}</span>
          <span className="text-xs text-text-secondary">({product.reviews || 0})</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            Rp {product.price.toLocaleString('id-ID')}
            <span className="text-sm text-text-secondary">/{product.unit || 'kg'}</span>
          </span>

          <button
            onClick={handleAddToCart}
            disabled={product.status === 'sold_out' || isAdding}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
              product.status === 'sold_out'
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isAdding
                ? 'bg-primary/50 text-white'
                : 'bg-primary text-white hover:bg-secondary hover:scale-110'
            }`}
          >
            {isAdding ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ShoppingCart className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}