'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Filter, X, SlidersHorizontal, Check, Loader2 } from 'lucide-react';
import { ProductCard } from '@/components/product/ProductCard';
import { useAuth } from '@/context/AuthContext';

// ============================================
// ✅ TYPE DEFINITIONS
// ============================================

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
  category_id?: number;
  status: 'pre_order' | 'ready_stock' | 'sold_out' | 'deleted';
  rating?: number;
  reviews?: number;
  harvest_date?: string;
  created_at?: string;
  updated_at?: string;
  badge?: 'Terlaris' | 'Baru';
  sold_count?: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description_category?: string;
  icon?: string;
  color?: string;
  display_order?: number;
  is_active?: boolean;
  product_count?: number;
}

// ============================================
// ✅ ICON MAPPING
// ============================================

const categoryIconMap: Record<string, string> = {
  'Sayuran': '🥬', 'Buah-buahan': '🍎', 'Biji-bijian': '🌾', 'Umbi-umbian': '🥔',
  'Rempah-rempah': '🌿', 'Bumbu Dapur': '🧄', 'Daging & Protein': '🥩',
  'Telur & Susu': '🥚', 'Ikan & Seafood': '🐟',
};

const defaultCategories: Category[] = [
  { id: 1, name: 'Sayuran', slug: 'sayuran', icon: 'Sprout', color: 'bg-green-100' },
  { id: 2, name: 'Buah-buahan', slug: 'buah-buahan', icon: 'Apple', color: 'bg-red-100' },
  { id: 3, name: 'Biji-bijian', slug: 'biji-bijian', icon: 'Wheat', color: 'bg-yellow-100' },
  { id: 4, name: 'Umbi-umbian', slug: 'umbi-umbian', icon: 'Carrot', color: 'bg-orange-100' },
  { id: 5, name: 'Rempah-rempah', slug: 'rempah-rempah', icon: 'Flower', color: 'bg-purple-100' },
];

const sortOptions = [
  { id: 'all', label: 'Default', sort: null, order: null },
  { id: 'price_asc', label: 'Harga Terendah', sort: 'price', order: 'asc' },
  { id: 'price_desc', label: 'Harga Tertinggi', sort: 'price', order: 'desc' },
  { id: 'sold_count', label: 'Terlaris', sort: 'sold_count', order: 'desc' },
  { id: 'newest', label: 'Terbaru', sort: 'created_at', order: 'desc' },
];

// ============================================
// ✅ MAIN COMPONENT
// ============================================

export default function KatalogPage() {
  const { isAuthenticated } = useAuth();
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSortId, setSelectedSortId] = useState('all');
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true); // ✅ Track loading kategori terpisah
  const [error, setError] = useState<string | null>(null);
  
  // Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // ✅ FIX 1: Fetch categories & products PARALLEL on mount (tidak saling tunggu)
  useEffect(() => {
    const init = async () => {
      // Fetch categories (background)
      fetchCategories();
      // Fetch products immediately (jangan tunggu categories)
      fetchProducts();
    };
    init();
  }, []);

  // ✅ FIX 2: Refetch products ONLY when filters change (bukan when categories loaded)
  useEffect(() => {
    // Hindari fetch saat pertama mount (sudah di handle useEffect pertama)
    if (products.length === 0 && !selectedCategoryId && selectedSortId === 'all') return;
    
    fetchProducts();
  }, [selectedCategoryId, selectedSortId]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsFilterModalOpen(false);
      }
    };

    if (isFilterModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isFilterModalOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFilterModalOpen(false);
    };
    if (isFilterModalOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFilterModalOpen]);

  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      setIsCategoriesLoading(true);
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/category?is_active=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setCategories(defaultCategories);
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  // Fetch products from API with filters
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams();
      
      // Category filter menggunakan category_id
      if (selectedCategoryId && selectedCategoryId > 0) {
        params.append('category_id', selectedCategoryId.toString());
      }
      
      // Sort filter
      const selectedSort = sortOptions.find(s => s.id === selectedSortId);
      if (selectedSort?.sort) {
        params.append('sort', selectedSort.sort);
        params.append('order', selectedSort.order || 'desc');
      }
      
      const res = await fetch(`/api/products?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
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

  // Client-side search filter
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isActive = product.status !== 'deleted';
    return matchesSearch && isActive;
  });

  // Get category icon emoji
  const getCategoryIcon = (category: Category): string => {
    if (category.icon && categoryIconMap[category.icon]) return categoryIconMap[category.icon];
    if (categoryIconMap[category.name]) return categoryIconMap[category.name];
    return '🌾';
  };

  // Reset all filters
  const resetFilters = () => {
    setSelectedCategoryId(null);
    setSelectedSortId('all');
    setSearchQuery('');
  };

  // Check if any filter is active
  const hasActiveFilters = selectedCategoryId !== null || selectedSortId !== 'all';

  return (
    <div className="animate-fade-in min-h-screen pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Katalog Produk</h1>
        <p className="text-text-secondary">Temukan hasil pertanian terbaik dari petani Indonesia</p>
      </div>

      {/* Search + Filter Button */}
      <div className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Cari produk pertanian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12 w-full"
          />
        </div>
        
        {/* Filter Button */}
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className={`btn-outline px-4 flex items-center gap-2 whitespace-nowrap relative ${
            hasActiveFilters ? 'border-primary text-primary' : ''
          }`}
          aria-label="Buka filter"
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span className="hidden sm:inline">Filter</span>
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full text-white text-xs flex items-center justify-center">
              ✓
            </span>
          )}
        </button>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary">Filter aktif:</span>
          {selectedCategoryId && (
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium flex items-center gap-1">
              {categories.find(c => c.id === selectedCategoryId)?.name || 'Kategori'}
              <button onClick={() => setSelectedCategoryId(null)} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedSortId !== 'all' && (
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium flex items-center gap-1">
              {sortOptions.find(s => s.id === selectedSortId)?.label}
              <button onClick={() => setSelectedSortId('all')} className="hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button onClick={resetFilters} className="text-text-secondary hover:text-primary text-sm ml-2">
            Reset Semua
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Products Grid - Compact Version */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-text-secondary text-sm">Memuat produk...</p>
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🌾</div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">Produk Tidak Ditemukan</h3>
          <p className="text-text-secondary text-sm mb-3">Coba ubah filter atau kata kunci pencarian</p>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="btn-primary text-sm py-2 px-4">
              Reset Filter
            </button>
          )}
        </div>
      )}
      {/* ✅ FILTER MODAL (Fixed Positioning) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setIsFilterModalOpen(false)} 
          />
          
          {/* ✅ FIX 2: Modal Content - Centered & Smaller on Desktop */}
          <div
            ref={modalRef}
            className="relative bg-background w-full sm:max-w-100 rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up sm:animate-fade-in shadow-2xl border border-border max-h-[90vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
              <h3 className="text-xl font-bold text-text-primary">Filter Produk</h3>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-3">
                  Kategori
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {/* All Categories */}
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                      selectedCategoryId === null
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="font-medium flex items-center gap-2">
                      <span>🌾</span> Semua Kategori
                    </span>
                    {selectedCategoryId === null && <Check className="w-5 h-5 text-primary" />}
                  </button>
                  
                  {/* Categories from DB */}
                  {isCategoriesLoading ? (
                    <div className="flex items-center justify-center py-4 text-text-secondary">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Memuat kategori...
                    </div>
                  ) : (
                    categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                          selectedCategoryId === category.id
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className="font-medium flex items-center gap-2">
                          <span>{getCategoryIcon(category)}</span>
                          {category.name}
                          {category.product_count !== undefined && (
                            <span className="text-xs bg-surface px-2 py-0.5 rounded-full text-text-secondary">
                              {category.product_count}
                            </span>
                          )}
                        </span>
                        {selectedCategoryId === category.id && <Check className="w-5 h-5 text-primary" />}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Sort Filter */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-3">
                  Urutkan Berdasarkan
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {sortOptions.map((sort) => (
                    <button
                      key={sort.id}
                      onClick={() => setSelectedSortId(sort.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                        selectedSortId === sort.id
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <span className="font-medium">{sort.label}</span>
                      {selectedSortId === sort.id && <Check className="w-5 h-5 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="w-full btn-outline py-3"
                >
                  Reset Semua Filter
                </button>
              )}
            </div>

            {/* Apply Button (Mobile Only) */}
            <button
              onClick={() => setIsFilterModalOpen(false)}
              className="w-full btn-primary mt-6 sm:hidden sticky bottom-0 bg-background pt-4 border-t border-border"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}