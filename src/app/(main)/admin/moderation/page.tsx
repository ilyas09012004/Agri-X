'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Eye, AlertCircle, Loader2, Search, ExternalLink, ZoomIn, Bell, Users, Send } from 'lucide-react';
import { getCookie } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

// ============================================================================
// ✅ HELPER: Format Currency (jika belum ada di utils)
// ============================================================================
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

// ============================================================================
// ✅ INTERFACES
// ============================================================================
interface PostImage {
  id: number;
  image_url: string;
  image_alt?: string;
  image_source?: string;
  display_order: number;
  is_primary: boolean;
  created_at: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author_name: string;
  author_email: string;
  category_name: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string;
  created_at: string;
  image_count: number;
  images: PostImage[];
  comment_count: number;
  views: number;
  likes: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  unit: string;
  stock: number;
  status: string;
  image_path?: string;
}

// ============================================================================
// ✅ MAIN COMPONENT
// ============================================================================
export default function AdminModerationPage() {
  const router = useRouter();
  
  // ✅ Forum Moderation State
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // ✅ System Announcement State
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [announceForm, setAnnounceForm] = useState({
    title: '',
    message: '',
    targetAudience: 'all' as 'all' | 'active' | 'premium' | 'custom',
    link: '',
    customUserIds: '',
  });
  const [announceLoading, setAnnounceLoading] = useState(false);

  // ✅ ✅ PRODUCT SEARCH STATE (yang sebelumnya missing!)
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(false);

  // ============================================================================
  // ✅ EFFECTS
  // ============================================================================
  
  // Fetch pending posts on mount
  useEffect(() => {
    fetchPendingPosts();
  }, []);

  // ✅ Debounced product search effect
  useEffect(() => {
    if (productSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      try {
        setProductLoading(true);
        const token = getCookie('accessToken');
        const res = await fetch(`/api/admin/products?search=${encodeURIComponent(productSearch)}&limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.products || []);
        }
      } catch (error) {
        console.error('Product search error:', error);
      } finally {
        setProductLoading(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [productSearch]);

  // ✅ Reset product search when modal closes
  useEffect(() => {
    if (!showAnnounceModal) {
      setProductSearch('');
      setSearchResults([]);
      setSelectedProduct(null);
    }
  }, [showAnnounceModal]);

  // ============================================================================
  // ✅ FUNCTIONS
  // ============================================================================

  const fetchPendingPosts = async () => {
    try {
      setIsLoading(true);
      const token = getCookie('accessToken');
      
      const res = await fetch('/api/admin/moderation?status=pending', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Fetch moderation error:', error);
      toast.error('❌ Gagal memuat post yang menunggu review', {
        duration: 4000,
        position: 'bottom-right',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (postId: number, action: 'approve' | 'reject') => {
    setActionLoading(postId);
    try {
      const token = getCookie('accessToken');
      const res = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId,
          action,
          adminNote: adminNote || undefined,
        }),
      });

      if (res.ok) {
        toast.success(
          action === 'approve' 
            ? '✅ Post disetujui dan sekarang publik' 
            : '⚠️ Post ditolak dan user telah diberi tahu',
          {
            duration: 4000,
            position: 'bottom-right',
            style: {
              background: action === 'approve' ? '#10B981' : '#F59E0B',
              color: '#fff',
            },
            icon: action === 'approve' ? '✅' : '⚠️',
          }
        );
        
        setSelectedPost(null);
        setAdminNote('');
        fetchPendingPosts();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Gagal memproses');
      }
    } catch (error: any) {
      toast.error(`❌ ${error.message}`, {
        duration: 5000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: '#fff',
        },
        action: {
          label: 'Coba Lagi',
          onClick: () => handleAction(postId, action),
        },
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBroadcastAnnouncement = async () => {
    if (!announceForm.title.trim() || !announceForm.message.trim()) {
      toast.error('⚠️ Judul dan pesan wajib diisi', {
        duration: 3000,
        position: 'bottom-right',
        style: {
          background: '#F59E0B',
          color: '#fff',
        },
      });
      return;
    }

    setAnnounceLoading(true);
    try {
      const token = getCookie('accessToken');
      
      const res = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          broadcast: true,
          title: announceForm.title.trim(),
          message: announceForm.message.trim(),
          targetAudience: announceForm.targetAudience,
          customUserIds: announceForm.targetAudience === 'custom' 
            ? announceForm.customUserIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
            : undefined,
          link: announceForm.link.trim() || undefined,
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(`✅ ${data.message}`, {
          duration: 4000,
          position: 'bottom-right',
          style: {
            background: '#10B981',
            color: '#fff',
          },
          icon: '🔔',
          action: {
            label: 'Lihat Notifikasi',
            onClick: () => router.push('/admin/notifications'),
          },
        });
        
        setShowAnnounceModal(false);
        setAnnounceForm({
          title: '',
          message: '',
          targetAudience: 'all',
          link: '',
          customUserIds: '',
        });
      } else {
        throw new Error(data.error || 'Gagal mengirim pengumuman');
      }
    } catch (error: any) {
      toast.error(`❌ ${error.message}`, {
        duration: 5000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: '#fff',
        },
      });
    } finally {
      setAnnounceLoading(false);
    }
  };

  // ============================================================================
  // ✅ LOADING STATE
  // ============================================================================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  // ============================================================================
  // ✅ RENDER
  // ============================================================================
  return (
    <div className="animate-fade-in min-h-screen pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Moderasi Forum</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAnnounceModal(true)}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Bell className="w-4 h-4" />
            Kirim Pengumuman
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="btn-outline px-4 py-2 text-sm"
          >
            ← Kembali ke Admin
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card bg-yellow-50 border-yellow-200">
          <p className="text-2xl font-bold text-yellow-800">{posts.length}</p>
          <p className="text-sm text-yellow-600">Menunggu Review</p>
        </div>
        <div className="card bg-green-50 border-green-200">
          <p className="text-2xl font-bold text-green-800">0</p>
          <p className="text-sm text-green-600">Disetujui Hari Ini</p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-2xl font-bold text-red-800">0</p>
          <p className="text-sm text-red-600">Ditolak Hari Ini</p>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {posts.length > 0 ? (
          posts.map((post) => (
            <div key={post.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-text-primary">{post.title}</h3>
                  <p className="text-sm text-text-secondary">
                    Oleh {post.author_name} • {post.category_name} • {formatDate(post.created_at)}
                  </p>
                </div>
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-semibold">
                  ⏳ Pending
                </span>
              </div>
              
              <p className="text-text-secondary line-clamp-2 mb-3">{post.content}</p>
              
              {/* Images Preview */}
              {post.image_count > 0 && (
                <div className="mb-3">
                  <p className="text-sm text-text-secondary mb-2">
                    📷 {post.image_count} gambar terlampir
                  </p>
                  <div className="flex gap-2 overflow-x-auto">
                    {post.images?.slice(0, 4).map((img, index) => (
                      <div 
                        key={img.id || index}
                        className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-border cursor-pointer hover:border-primary transition-colors"
                        onClick={() => setSelectedPost(post)}
                      >
                        <img
                          src={img.image_url}
                          alt={img.image_alt || `Image ${index + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {index === 3 && post.image_count > 4 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">+{post.image_count - 4}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPost(post)}
                  className="btn-outline px-4 py-2 text-sm flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  Lihat Detail
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 card">
            <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <p className="text-text-secondary font-medium">Tidak ada post yang menunggu review</p>
            <p className="text-sm text-text-secondary mt-1">Semua post sudah diproses ✅</p>
          </div>
        )}
      </div>

      {/* ✅ DETAIL MODAL dengan Image Preview */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-300 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text-primary">Review Post</h2>
              <button
                onClick={() => {
                  setSelectedPost(null);
                  setAdminNote('');
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Post Info */}
              <div className="p-4 bg-surface rounded-xl">
                <h3 className="font-bold text-text-primary mb-2">{selectedPost.title}</h3>
                <p className="text-sm text-text-secondary mb-3">
                  Oleh <span className="font-medium">{selectedPost.author_name}</span> ({selectedPost.author_email})<br/>
                  Kategori: <span className="font-medium">{selectedPost.category_name}</span> • {formatDate(selectedPost.created_at)}
                </p>
                <p className="text-text-secondary whitespace-pre-line">{selectedPost.content}</p>
              </div>

              {/* Images Grid with Preview */}
              {selectedPost.images && selectedPost.images.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-2">
                    📷 Lampiran Gambar ({selectedPost.images.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedPost.images.map((img, index) => (
                      <div 
                        key={img.id || index}
                        className="relative group aspect-square rounded-xl overflow-hidden border-2 border-border hover:border-primary transition-colors cursor-pointer"
                        onClick={() => setSelectedImage(img.image_url)}
                      >
                        <img
                          src={img.image_url}
                          alt={img.image_alt || `Image ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          loading="lazy"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                        />
                        
                        {img.is_primary && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-primary text-white text-[10px] rounded-full font-medium">
                            Utama
                          </div>
                        )}
                        
                        {img.image_source && (
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-[10px] rounded-full">
                            {img.image_source}
                          </div>
                        )}
                        
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center pointer-events-none">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        
                        <div className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white text-xs rounded-full flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-surface rounded-xl text-center">
                  <p className="text-2xl font-bold text-text-primary">{selectedPost.views}</p>
                  <p className="text-xs text-text-secondary">Views</p>
                </div>
                <div className="p-3 bg-surface rounded-xl text-center">
                  <p className="text-2xl font-bold text-text-primary">{selectedPost.likes}</p>
                  <p className="text-xs text-text-secondary">Likes</p>
                </div>
                <div className="p-3 bg-surface rounded-xl text-center">
                  <p className="text-2xl font-bold text-text-primary">{selectedPost.comment_count}</p>
                  <p className="text-xs text-text-secondary">Komentar</p>
                </div>
              </div>

              {/* Admin Note */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Catatan untuk User (Opsional)
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Berikan alasan jika menolak, atau pesan tambahan..."
                  rows={3}
                  className="input w-full"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => handleAction(selectedPost.id, 'reject')}
                  disabled={actionLoading === selectedPost.id}
                  className="btn-outline flex-1 text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {actionLoading === selectedPost.id ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <X className="w-5 h-5" />
                      Tolak
                    </div>
                  )}
                </button>
                <button
                  onClick={() => handleAction(selectedPost.id, 'approve')}
                  disabled={actionLoading === selectedPost.id}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {actionLoading === selectedPost.id ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Check className="w-5 h-5" />
                      Setujui
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ SYSTEM ANNOUNCEMENT MODAL */}
      {showAnnounceModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAnnounceModal(false);
          }}
        >
          <div 
            className="relative w-full max-w-300 bg-surface rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-text-primary">Kirim Pengumuman</h3>
              </div>
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Judul Pengumuman <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={announceForm.title}
                  onChange={(e) => setAnnounceForm({ ...announceForm, title: e.target.value })}
                  placeholder="Contoh: Maintenance Jadwal, Promo Spesial, dll"
                  className="input w-full"
                  maxLength={255}
                />
              </div>
              
              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Pesan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={announceForm.message}
                  onChange={(e) => setAnnounceForm({ ...announceForm, message: e.target.value })}
                  placeholder="Tulis pesan pengumuman..."
                  className="input w-full min-h-[100px]"
                />
              </div>
              
              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Target Penerima
                </label>
                <select
                  value={announceForm.targetAudience}
                  onChange={(e) => setAnnounceForm({ ...announceForm, targetAudience: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="all">🌐 Semua User</option>
                  <option value="active">🟢 User Aktif (30 hari terakhir)</option>
                  <option value="premium">⭐ User Premium</option>
                  <option value="custom">👥 Custom User IDs</option>
                </select>
              </div>
              
              {/* Custom User IDs (conditional) */}
              {announceForm.targetAudience === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    User IDs (pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    value={announceForm.customUserIds}
                    onChange={(e) => setAnnounceForm({ ...announceForm, customUserIds: e.target.value })}
                    placeholder="1, 2, 3, ..."
                    className="input w-full"
                  />
                </div>
              )}
              
              {/* ✅ PRODUCT SEARCH SECTION - Ganti "Optional Link" */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  🔍 Cari Produk untuk Promo
                </label>
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Cari nama produk, kategori, atau seller..."
                    className="input w-full pl-10 pr-4"
                    maxLength={100}
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Search Results Dropdown */}
                {productSearch.trim().length >= 2 && (
                  <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded-xl bg-surface/50">
                    {productLoading ? (
                      <div className="p-4 text-center text-text-secondary text-sm">
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Mencari produk...
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {searchResults.slice(0, 5).map((product: Product) => (
                          <button
                            key={product.id}
                            onClick={() => {
                              setSelectedProduct(product);
                              setAnnounceForm(prev => ({
                                ...prev,
                                link: `/produk/${product.id}`,
                                message: `${prev.message}\n\n🎁 Cek produk: ${product.name}`
                              }));
                              setProductSearch('');
                            }}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 transition-colors text-left"
                          >
                            {/* Product Image */}
                            <div className="w-10 h-10 bg-gradient-to-br from-secondary/20 to-primary/20 rounded-lg flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                              {product.image_path ? (
                                <img
                                  src={product.image_path}
                                  alt={product.name}
                                  className="w-full h-full object-cover rounded-lg"
                                  loading="lazy"
                                />
                              ) : (
                                <span>🌾</span>
                              )}
                            </div>
                            
                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary truncate">
                                {product.name}
                              </p>
                              <p className="text-xs text-primary font-semibold">
                                {formatCurrency(product.price)} / {product.unit}
                              </p>
                            </div>
                            
                            {/* Status Badge */}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              product.status === 'ready_stock' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : product.status === 'pre-order'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {product.status === 'ready_stock' ? '✓' : 
                               product.status === 'pre-order' ? '⏳' : '✗'}
                            </span>
                          </button>
                        ))}
                        {searchResults.length > 5 && (
                          <p className="text-xs text-text-secondary text-center py-2">
                            +{searchResults.length - 5} produk lainnya...
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-text-secondary text-sm">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Tidak ada produk ditemukan</p>
                        <p className="text-xs mt-1">Coba kata kunci lain</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Selected Product Preview */}
                {selectedProduct && (
                  <div className="mt-3 p-3 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-secondary/20 to-primary/20 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                      {selectedProduct.image_path ? (
                        <img
                          src={selectedProduct.image_path}
                          alt={selectedProduct.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-xl">🌾</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {selectedProduct.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Link: <span className="font-mono text-primary">/produk/{selectedProduct.id}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedProduct(null);
                        setAnnounceForm(prev => ({
                          ...prev,
                          link: '',
                          message: prev.message.replace(/\n\n🎁 Cek produk:.*/, '')
                        }));
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus produk"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                <p className="text-xs text-text-secondary mt-2">
                  💡 Pilih produk untuk otomatis tambahkan link & pesan promo
                </p>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-surface/95 flex gap-3">
              <button
                onClick={() => setShowAnnounceModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-border hover:bg-surface transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleBroadcastAnnouncement}
                disabled={announceLoading || !announceForm.title.trim() || !announceForm.message.trim()}
                className="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {announceLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Kirim ke Semua
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ IMAGE LIGHTBOX MODAL */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <img
            src={selectedImage}
            alt="Full size preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
          
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            Klik di mana saja untuk menutup
          </p>
        </div>
      )}
    </div>
  );
}