'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Star, 
  ShoppingCart, 
  Minus, 
  Plus, 
  Share2, 
  Heart,
  CheckCircle,
  Truck,
  Shield,
  Send,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { getCookie } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { productAPI, reviewAPI } from '@/lib/api';
import { MobileNav } from '@/components/layout/MobileNav';
import toast from 'react-hot-toast';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  unit: string;
  stock: number;
  sold_count: number;
  min_order: number;
  seller_id: number;
  seller_name?: string;
  harvest_date?: string;
  image_path?: string;
  category?: string;
  category_id?: number;
  status: 'pre_order' | 'ready_stock' | 'sold_out';
  rating?: number;
  reviews?: number;
  created_at?: string;
  updated_at?: string;
}

interface Review {
  id: number;
  userId: number;
  productId: number;
  rating: number;
  comment?: string;
  is_verified: boolean;
  user_name: string;
  user_avatar?: string;
  created_at: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description');
  
  // Review state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // ============================================
  // FETCH DATA
  // ============================================

  useEffect(() => {
    if (params.id) {
      fetchProduct();
      fetchReviews();
    }
  }, [params.id]);

  const fetchProduct = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await productAPI.getById(Number(params.id));
      
      if (response.data.success) {
        setProduct(response.data.product);
      } else {
        throw new Error(response.data.error || 'Produk tidak ditemukan');
      }
    } catch (err: any) {
      console.error('Fetch product error:', err);
      setError(err.message || 'Gagal memuat data produk');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const response = await reviewAPI.getAll({ 
        productId: Number(params.id),
        limit: '10' 
      });
      
      if (response.data.success) {
        setReviews(response.data.reviews || []);
      }
    } catch (err: any) {
      console.error('Fetch reviews error:', err);
    } finally {
      setReviewsLoading(false);
    }
  };

  // ============================================
  // HANDLE FUNCTIONS
  // ============================================

 const handleAddToCart = async () => {
  if (!product) return;

  // ✅ CHECK AUTH
  const token = getCookie('accessToken');
  
  if (!token) {
    toast.error('🔐 Silakan login untuk menambahkan ke keranjang', {
      duration: 4000,
      icon: '🔐',
    });
    router.push('/login');
    return;
  }

  // ✅ VALIDASI PRE-ORDER: Cek kuota PO
  const isPreOrder = product.status === 'pre-order' || product.status === 'pre_order';
  const remainingQuota = isPreOrder 
    ? ((product.po_quota ?? 999999) - (product.po_sold || 0)) 
    : null;

  if (isPreOrder && remainingQuota !== null && remainingQuota <= 0) {
    toast.error('😔 Kuota Pre-Order sudah habis', {
      duration: 5000,
      icon: '🚫',
      // ✅ Saran alternatif
      action: {
        label: 'Lihat Produk Lain',
        onClick: () => router.push('/katalog'),
      },
    });
    setError('Maaf, kuota Pre-Order untuk produk ini sudah penuh.');
    return;
    }

    // ✅ VALIDASI PRE-ORDER: Cek masa panen
    if (isPreOrder && product.harvest_date) {
      const harvestDate = new Date(product.harvest_date);
      const today = new Date();
      // Reset time untuk perbandingan tanggal saja
      harvestDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (today > harvestDate) {
        toast.error('🍂 Masa panen sudah lewat', {
          duration: 5000,
          icon: '📅',
          // ✅ Info kapan panen berikutnya (opsional)
          action: {
            label: 'Notifikasi Saat Tersedia',
            onClick: () => {
              // TODO: Implement fitur notifikasi
              toast.success('✅ Anda akan kami beri tahu saat produk tersedia!', {
                duration: 3000,
              });
            },
          },
        });
        setError(`Masa panen produk ini (${harvestDate.toLocaleDateString('id-ID')}) sudah lewat. Produk akan segera diupdate oleh petani.`);
        return;
      }
    }

    // Validasi quantity minimal
    if (quantity < product.min_order) {
      setError(`Minimal pesanan adalah ${product.min_order} ${product.unit}`);
      toast.error(`⚠️ Minimal pesanan ${product.min_order} ${product.unit}`, {
        duration: 3000,
        icon: '📦',
      });
      return;
    }

    // Validasi stok untuk ready_stock
    if (product.status === 'ready_stock' && quantity > product.stock) {
      setError(`Stok tidak mencukupi. Tersedia ${product.stock} ${product.unit}`);
      toast.error(`❌ Stok tersisa ${product.stock} ${product.unit}`, {
        duration: 4000,
        icon: '📉',
        // ✅ Saran: kurangi quantity
        action: {
          label: `Ambil ${product.stock} ${product.unit}`,
          onClick: () => setQuantity(product.stock),
        },
      });
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      console.log('Calling addToCart...');
      await addToCart(product.id, quantity);
      console.log('addToCart success!');
      
      // ✅ Success toast dengan detail
      toast.success('✅ Ditambahkan ke keranjang!', {
        duration: 3000,
        icon: '🛒',
        action: {
          label: 'Lihat Keranjang',
          onClick: () => router.push('/keranjang'),
        },
      });
      
      setQuantity(product.min_order);
      
    } catch (err: any) {
      console.error('Add to cart error:', err);
      const errorMessage = err.message || 'Gagal menambahkan ke keranjang';
      
      setError(errorMessage);
      
      // ✅ Error toast yang lebih deskriptif
      toast.error(`❌ ${errorMessage}`, {
        duration: 4000,
        icon: '⚠️',
      });
      
      // Jika error unauthorized, redirect ke login
      if (err.message?.includes('Unauthorized') || err.message?.includes('unauthorized')) {
        toast.error('🔐 Sesi expired. Silakan login kembali.', {
          duration: 3000,
        });
        router.push('/login');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!isAuthenticated) {
      alert('Silakan login untuk memberikan ulasan');
      router.push('/login');
      return;
    }

    if (!newComment.trim()) {
      setError('Mohon isi komentar ulasan');
      return;
    }

    setIsSubmittingReview(true);
    setError(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: product?.id,
          rating: newRating,
          comment: newComment,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Ulasan berhasil dikirim!');
        setShowReviewForm(false);
        setNewRating(5);
        setNewComment('');
        fetchReviews();
      } else {
        throw new Error(data.error || 'Gagal mengirim ulasan');
      }
    } catch (err: any) {
      console.error('Submit review error:', err);
      setError(err.message || 'Gagal mengirim ulasan');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const increaseQty = () => {
    if (product && quantity < product.stock) {
      setQuantity(quantity + 1);
      setError(null);
    }
  };

  const decreaseQty = () => {
    if (quantity > (product?.min_order || 1)) {
      setQuantity(quantity - 1);
      setError(null);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: product?.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link produk berhasil disalin!');
    }
  };

  // ============================================
  // LOADING & ERROR STATE
  // ============================================

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">Memuat data produk...</p>
        </div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Produk Tidak Ditemukan</h2>
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => router.push('/katalog')}
            className="btn-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Katalog
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Kembali</span>
        </button>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-square bg-gradient-to-br from-secondary/20 to-primary/20 rounded-2xl flex items-center justify-center overflow-hidden">
              {product.image_path ? (
                <img
                  src={product.image_path}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-8xl">🌾</span>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 btn-outline flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Bagikan
              </button>
              <button className="flex-1 btn-outline flex items-center justify-center gap-2">
                <Heart className="w-5 h-5" />
                Favorit
              </button>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title & Rating */}
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {product.name}
              </h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold text-text-primary">
                    {product.rating?.toFixed(1) || '0'}
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className="text-text-secondary hover:text-primary transition-colors"
                >
                  {product.reviews || 0} ulasan
                </button>
                <span className="text-text-secondary">•</span>
                <span className="text-text-secondary">
                  {product.sold_count || 0} terjual
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="bg-surface rounded-2xl p-6">
              <div className="text-4xl font-bold text-primary mb-2">
                Rp {product.price.toLocaleString('id-ID')}
                <span className="text-lg text-text-secondary">/{product.unit}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  product.status === 'ready_stock' ? 'bg-green-100 text-green-800' :
                  product.status === 'pre_order' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {product.status === 'ready_stock' ? '✓ Ready Stock' :
                   product.status === 'pre_order' ? '⏳ Pre-Order' : '✕ Sold Out'}
                </span>
                <span className="text-text-secondary">
                  Stok: {product.stock} {product.unit}
                </span>
              </div>
            </div>

            {/* Quantity Selector */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Jumlah Pesanan
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={decreaseQty}
                  disabled={quantity <= (product.min_order || 1)}
                  className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <span className="text-2xl font-bold text-text-primary">{quantity}</span>
                  <span className="text-sm text-text-secondary block">{product.unit}</span>
                </div>
                <button
                  onClick={increaseQty}
                  disabled={product.status === 'ready_stock' && quantity >= product.stock}
                  className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-text-secondary mt-2">
                Minimal: {product.min_order} {product.unit} | 
                Maksimal: {product.stock} {product.unit}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              disabled={product.status === 'sold_out' || isAdding}
              className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAdding ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menambahkan...</span>
                </>
              ) : product.status === 'sold_out' ? (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  <span>Stok Habis</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  <span>Tambah ke Keranjang</span>
                  <span className="ml-auto font-bold">
                    Rp {(product.price * quantity).toLocaleString('id-ID')}
                  </span>
                </>
              )}
            </button>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border">
              <div className="text-center">
                <Truck className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-xs text-text-secondary">Pengiriman Cepat</p>
              </div>
              <div className="text-center">
                <CheckCircle className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-xs text-text-secondary">Kualitas Terjamin</p>
              </div>
              <div className="text-center">
                <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-xs text-text-secondary">Transaksi Aman</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs: Description & Reviews */}
        <div className="mt-12">
          <div className="flex gap-4 border-b border-border mb-6">
            <button
              onClick={() => setActiveTab('description')}
              className={`pb-4 font-semibold transition-colors ${
                activeTab === 'description'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-primary'
              }`}
            >
              Deskripsi Produk
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`pb-4 font-semibold transition-colors ${
                activeTab === 'reviews'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-primary'
              }`}
            >
              Ulasan ({reviews.length})
            </button>
          </div>

          {/* Description Tab */}
          {activeTab === 'description' && (
            <div className="space-y-6">
              <div className="bg-surface rounded-2xl p-6">
                <h3 className="text-lg font-bold text-text-primary mb-4">Deskripsi</h3>
                <p className="text-text-secondary leading-relaxed">
                  {product.description || 'Tidak ada deskripsi produk'}
                </p>
              </div>

              <div className="bg-surface rounded-2xl p-6">
                <h3 className="text-lg font-bold text-text-primary mb-4">Spesifikasi</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-text-secondary">Kategori</p>
                    <p className="font-medium text-text-primary">{product.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Satuan</p>
                    <p className="font-medium text-text-primary">{product.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Minimal Order</p>
                    <p className="font-medium text-text-primary">{product.min_order} {product.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">Tanggal Panen</p>
                    <p className="font-medium text-text-primary">
                      {product.harvest_date ? new Date(product.harvest_date).toLocaleDateString('id-ID') : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {/* Review Summary */}
              <div className="bg-surface rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-text-primary">Ulasan Pembeli</h3>
                  {isAuthenticated && (
                    <button
                      onClick={() => setShowReviewForm(!showReviewForm)}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      <Star className="w-4 h-4 mr-2 inline" />
                      Tulis Ulasan
                    </button>
                  )}
                </div>

                {/* Review Form */}
                {showReviewForm && (
                  <div className="bg-background rounded-xl p-4 mb-4 border border-border">
                    <h4 className="font-semibold text-text-primary mb-4">Beri Ulasan Produk Ini</h4>
                    
                    {/* Rating Stars */}
                    <div className="mb-4">
                      <label className="block text-sm text-text-secondary mb-2">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setNewRating(star)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-8 h-8 ${
                                star <= newRating
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Comment */}
                    <div className="mb-4">
                      <label className="block text-sm text-text-secondary mb-2">Komentar</label>
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Bagaimana kualitas produk ini?"
                        rows={4}
                        className="input w-full"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSubmitReview}
                        disabled={isSubmittingReview || !newComment.trim()}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                      >
                        {isSubmittingReview ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Mengirim...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Kirim Ulasan</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowReviewForm(false);
                          setNewRating(5);
                          setNewComment('');
                        }}
                        className="btn-outline"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Reviews List */}
                {reviewsLoading ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="bg-background rounded-xl p-4 border border-border"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          {review.user_avatar ? (
                            <img
                              src={review.user_avatar}
                              alt={review.user_name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                              {review.user_name?.charAt(0) || 'U'}
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-text-primary">{review.user_name}</p>
                                <div className="flex items-center gap-2">
                                  <div className="flex">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-4 h-4 ${
                                          i < review.rating
                                            ? 'text-yellow-500 fill-yellow-500'
                                            : 'text-gray-300'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  {review.is_verified && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      Terverifikasi
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-text-secondary">
                                {new Date(review.created_at).toLocaleDateString('id-ID', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-text-secondary text-sm leading-relaxed">
                            {review.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">💬</div>
                    <p className="text-text-secondary">Belum ada ulasan</p>
                    <p className="text-sm text-text-secondary">Jadilah yang pertama memberikan ulasan!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}