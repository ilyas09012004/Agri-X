'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useTheme } from 'next-themes';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { ProductCard } from '@/components/product/ProductCard';
import { 
  Leaf, ShoppingCart, TrendingUp, Users, Star, ArrowRight,
  Flame, // ✅ Icon baru untuk "Terlaris"
} from 'lucide-react';
import { productAPI, statisticsAPI, reviewAPI } from '@/lib/api';

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
  sold_count: number;
  origin_village_code?: string;
  min_order: number;
  seller_id: number;
  harvest_date?: string;
  image_path?: string;
  category?: string;
  category_id?: number;
  rating?: number;
  reviews?: number;
  status: 'ready_stock' | 'pre-order' | 'sold_out' | 'deleted';
  badge?: 'Terlaris' | 'Baru';
  created_at?: string;
  updated_at?: string;
}

interface Review {
  id: number;
  user_name: string;
  user_avatar?: string;
  rating: number;
  comment?: string;
}

interface Statistics {
  totalFarmers: number;
  totalProducts: number;
  totalOrders: number;
  totalSold: number;
  totalRevenue: number;
  activeCities: number;
}

// ============================================
// ✅ MAIN COMPONENT
// ============================================

export default function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const { totalItems } = useCart();
  
  // ✅ Gunakan useTheme untuk mendapatkan tema aktif
  const { theme, resolvedTheme } = useTheme();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      // ✅ Fetch data parallel
      const [productsRes, reviewsRes, statsRes] = await Promise.allSettled([
        fetch('/api/products?sort=sold_count&order=desc&limit=5', { headers })
          .then(res => res.json()),
        reviewAPI.getTopRated(5),
        statisticsAPI.getDashboard(),
      ]);

      // Process products
      if (productsRes.status === 'fulfilled' && productsRes.value?.success) {
        const filtered = (productsRes.value.products || []).filter((p: Product) => 
          p.status === 'ready_stock' || p.status === 'pre-order'
        );
        setProducts(filtered);
      }

      // Process reviews
      if (reviewsRes.status === 'fulfilled' && reviewsRes.value?.data?.success) {
        setReviews(reviewsRes.value.data.reviews || []);
      }

      // Process statistics
      if (statsRes.status === 'fulfilled' && statsRes.value?.data?.success) {
        setStatistics(statsRes.value.data.data || null);
      }

    } catch (err: any) {
      console.error('Error fetching homepage data:', err);
      setError(err.message || 'Gagal memuat data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(0) + 'M+';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K+';
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary dark:text-text-secondary-dark">Memuat data...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="animate-fade-in min-h-screen pb-20" data-theme={resolvedTheme}>
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-8 mb-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <h1 className="text-3xl font-bold mb-2">
              Jual Hasil Pertanian Langsung ke Pembeli
            </h1>
            <p className="text-white/90 mb-6">
              Harga kompetitif, jangkauan luas, transaksi aman
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="btn-primary bg-white text-primary hover:bg-white/90">
                <Leaf className="w-5 h-5 mr-2" />
                Mulai Jual
              </button>
              <button 
                onClick={() => window.location.href = '/katalog'}
                className="btn-outline border-white text-white hover:bg-white hover:text-primary"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Lihat Katalog
              </button>
            </div>
          </div>
        </section>

        {/* ✅ Produk Terlaris (diurutkan by sold_count) */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
              Produk Paling Laris 🔥
            </h2>
            <button 
              onClick={() => window.location.href = '/katalog?sort=sold_count&order=desc'}
              className="text-primary font-semibold text-sm flex items-center gap-1"
            >
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={{ 
                    ...product, 
                    image: product.image_path,
                    // ✅ Tambahkan badge "Terlaris" untuk produk dengan sold_count tinggi
                    badge: product.sold_count >= 50 ? 'Terlaris' : undefined,
                  }} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-surface rounded-2xl">
              <p className="text-text-secondary">Belum ada produk tersedia</p>
              <button 
                onClick={() => window.location.href = '/katalog'}
                className="btn-primary mt-4"
              >
                Jelajahi Katalog
              </button>
            </div>
          )}
        </section>

        {/* About Agri X */}
        <section className="bg-surface rounded-3xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Tentang Agri X
          </h2>
          <p className="text-text-secondary mb-6">
            Platform terpercaya untuk menjual dan membeli hasil pertanian Indonesia.
            Kami menghubungkan petani langsung dengan pembeli untuk harga yang lebih adil.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-background rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {formatNumber(statistics?.totalFarmers || 10000)}
              </div>
              <div className="text-sm text-text-secondary">Petani</div>
            </div>
            <div className="bg-background rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {formatNumber(statistics?.totalSold || 500)}
              </div>
              <div className="text-sm text-text-secondary">Ton/Bulan</div>
            </div>
            <div className="bg-background rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {formatNumber(statistics?.activeCities || 50)}
              </div>
              <div className="text-sm text-text-secondary">Kota</div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Star className="w-6 h-6 text-primary" />
            Testimoni Petani
          </h2>
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div
                  key={review.id}
                  className="flex-shrink-0 bg-surface rounded-2xl p-6 min-w-[280px] max-w-[320px]"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {review.user_avatar ? (
                      <img
                        src={review.user_avatar}
                        alt={review.user_name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                        {review.user_name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-text-primary">{review.user_name}</h4>
                      <p className="text-sm text-text-secondary">Petani Sukses</p>
                    </div>
                  </div>
                  <div className="flex gap-1 mb-3">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    ))}
                  </div>
                  <p className="text-text-secondary italic">"{review.comment}"</p>
                </div>
              ))
            ) : (
              <div className="text-center py-10 bg-surface rounded-2xl w-full">
                <p className="text-text-secondary">Belum ada testimoni</p>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-br from-primary to-secondary rounded-3xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">Siap Meningkatkan Pendapatan?</h2>
          <p className="text-white/90 mb-6">Bergabunglah dengan ribuan petani sukses</p>
          <button className="btn-primary bg-white text-primary hover:bg-white/90 text-lg px-8">
            <Users className="w-5 h-5 mr-2" />
            Gabung Sekarang
          </button>
        </section>
      </main>

      <MobileNav />
    </div>
  );
}