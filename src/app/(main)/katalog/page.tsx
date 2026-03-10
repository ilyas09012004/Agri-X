'use client';

import { useState, useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';
import { useAuth } from '@/context/AuthContext';

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
  created_at?: string;
  updated_at?: string;
  badge?: 'Terlaris' | 'Baru';
}

const categories = [
  { id: 'all', name: 'Semua', icon: '🌾' },
  { id: 'sayuran', name: 'Sayuran', icon: '🥬' },
  { id: 'buah', name: 'Buah', icon: '🍎' },
  { id: 'biji', name: 'Biji-bijian', icon: '🌾' },
  { id: 'umbi', name: 'Umbi', icon: '🥔' },
  { id: 'herbal', name: 'Herbal', icon: '🌿' },
];

const filters = ['Semua', 'Harga Terendah', 'Harga Tertinggi', 'Terlaris', 'Terbaru'];

export default function KatalogPage() {
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFilter, setSelectedFilter] = useState('Semua');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedFilter]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      
      // Build query params untuk filter
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }
      if (selectedFilter === 'Harga Terendah') {
        params.append('sort', 'price_asc');
      } else if (selectedFilter === 'Harga Tertinggi') {
        params.append('sort', 'price_desc');
      } else if (selectedFilter === 'Terlaris') {
        params.append('sort', 'best_seller');
      } else if (selectedFilter === 'Terbaru') {
        params.append('sort', 'newest');
      }

      const res = await fetch(`/api/products?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal mengambil produk');
      }

      const data = await res.json();
      setProducts(data.products || []);
    } catch (error: any) {
      console.error('Fetch products error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category?.toLowerCase() === selectedCategory;
    const isActive = product.status !== 'deleted';
    return matchesSearch && matchesCategory && isActive;
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Katalog Produk</h1>
        <p className="text-text-secondary">Temukan hasil pertanian terbaik dari petani Indonesia</p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Cari produk pertanian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="mb-6">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                selectedCategory === category.id
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                selectedFilter === filter
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🌾</div>
          <h3 className="text-xl font-semibold text-text-primary mb-2">Produk Tidak Ditemukan</h3>
          <p className="text-text-secondary">Coba kata kunci atau kategori lain</p>
        </div>
      )}
    </div>
  );
}