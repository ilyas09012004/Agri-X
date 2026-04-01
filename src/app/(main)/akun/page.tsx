'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, MapPin, MessageSquare, Star, Settings, LogOut, 
  Package, Clock, CheckCircle, Camera, Loader2, 
  Truck, CreditCard, ArrowRight, AlertCircle, Pencil, Trash2,
  X, ChevronRight, Bell, Shield, Palette, HelpCircle,
  FileText, Heart, UserCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getCookie } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/utils';

// Order tabs
const orderTabs = [
  { id: 'all', label: 'Semua', icon: Package },
  { id: 'pending', label: 'Belum Dibayar', icon: Clock },
  { id: 'shipped', label: 'Dikirim', icon: Truck },
  { id: 'delivered', label: 'Selesai', icon: CheckCircle },
];

// All menu items in settings modal
const settingsItems = [
  { section: 'Akun', items: [
    { icon: UserCircle, label: 'Profil Saya', action: 'profile' },
    { icon: MapPin, label: 'Alamat Saya', action: 'address', href: '/akun/alamat' },
    { icon: Heart, label: 'Ulasan Saya', action: 'reviews', href: '/akun/ulasan' },
  ]},
  { section: 'Forum', items: [
    { icon: MessageSquare, label: 'Forum Diskusi', action: 'forum', href: '/forum' },
    { icon: FileText, label: 'Diskusi Saya', action: 'my-posts', tab: 'forum' },
  ]},
  { section: 'Pengaturan', items: [
    { icon: Bell, label: 'Notifikasi', action: 'notifications' },
    { icon: Shield, label: 'Privasi & Keamanan', action: 'privacy' },
    { icon: Palette, label: 'Tampilan', action: 'theme', isToggle: true },
    { icon: HelpCircle, label: 'Bantuan & Support', action: 'help' },
  ]},
];

export default function AccountPage() {
  const router = useRouter();
  const { user, logout, updateUser, isAuthenticated, isLoading } = useAuth();
  
  // State untuk tabs
  const [activeTab, setActiveTab] = useState<'orders' | 'forum'>('orders');
  const [orderFilter, setOrderFilter] = useState('all');
  
  // State untuk data
  const [orders, setOrders] = useState<any[]>([]);
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // State untuk UI
  const [isUploading, setIsUploading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);
  
  // ✅ State untuk gambar di modal edit post
  const [postImages, setPostImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // ✅ State untuk dark mode
  const [darkMode, setDarkMode] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?callbackUrl=/akun');
    }
  }, [isAuthenticated, isLoading, router]);

  // Load dark mode preference
  useEffect(() => {
    const saved = localStorage.getItem('agri-x-theme');
    if (saved === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  // Fetch data on mount & tab/filter change
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [activeTab, orderFilter, isAuthenticated]);

  const fetchData = async () => {
    try {
      setIsLoadingData(true);
      const token = getCookie('accessToken');
      
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      if (activeTab === 'orders') {
        const res = await fetch(`/api/orders?status=${orderFilter}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } else {
        const res = await fetch(`/api/forum/posts?userId=${user?.id}&limit=20`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setForumPosts(data.posts || []);
        }
      }
    } catch (error: any) {
      console.error('Fetch data error:', error);
    } finally {
      setIsLoadingData(false);
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
        headers: { 'Authorization': `Bearer ${token}` },
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

  // ✅ Fungsi handle upload gambar untuk post
  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    
    try {
      const token = getCookie('accessToken');
      const uploadPromises = Array.from(files).map(async (file) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error('Format gambar tidak didukung');
        }
        
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error('Ukuran gambar maksimal 5MB');
        }

        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/api/forum/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Gagal upload');
        }

        const data = await res.json();
        return data.imageUrl;
      });

      const newImages = await Promise.all(uploadPromises);
      
      setPostImages(prev => [...prev, ...newImages]);
      
      setEditingPost(prev => prev ? {
        ...prev,
        images: [
          ...(prev.images || []),
          ...newImages.map((url: string) => ({ image_url: url }))
        ]
      } : null);
      
    } catch (error: any) {
      alert(error.message || 'Gagal upload gambar');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // ✅ Fungsi hapus gambar dari post
  const removePostImage = (index: number) => {
    setPostImages(prev => prev.filter((_, i) => i !== index));
    
    setEditingPost(prev => {
      if (!prev) return null;
      const updatedImages = (prev.images || []).filter((_: any, i: number) => i !== index);
      return { ...prev, images: updatedImages };
    });
  };

  // ✅ Reset state saat modal ditutup
  const closeEditModal = () => {
    setEditingPost(null);
    setPostImages([]);
  };

  // Forum post actions
  const handleEditPost = (post: any) => {
    setEditingPost(post);
    // Load existing images for preview
    setPostImages(post.images?.map((img: any) => img.image_url) || []);
  };

  const handleSavePost = async () => {
    if (!editingPost) return;
    
    if (!editingPost.title?.trim() || editingPost.title.length < 10) {
      alert('Judul minimal 10 karakter');
      return;
    }
    if (!editingPost.content?.trim() || editingPost.content.length < 20) {
      alert('Isi diskusi minimal 20 karakter');
      return;
    }
    if (!editingPost.category_id) {
      alert('Pilih kategori');
      return;
    }
    
    try {
      const token = getCookie('accessToken');
      const imageUrls = editingPost.images?.map((img: any) => img.image_url) || [];
      
      const res = await fetch(`/api/forum/posts/${editingPost.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editingPost.title,
          content: editingPost.content,
          categoryId: editingPost.category_id,
          images: imageUrls,
        }),
      });

      if (res.ok) {
        alert('Post berhasil diupdate!');
        closeEditModal();
        fetchData();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Gagal update post');
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm('Hapus diskusi ini?')) return;
    
    try {
      const token = getCookie('accessToken');
      const res = await fetch(`/api/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        alert('Post berhasil dihapus');
        fetchData();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Gagal hapus post');
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  // ✅ Handle settings item click
  const handleSettingsAction = (item: any) => {
    setShowSettingsModal(false);
    
    if (item.isToggle) {
      const newMode = !darkMode;
      setDarkMode(newMode);
      document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
      localStorage.setItem('agri-x-theme', newMode ? 'dark' : 'light');
    } else if (item.href) {
      router.push(item.href);
    } else if (item.tab) {
      setActiveTab('forum');
    } else {
      alert(`${item.label} - Fitur akan datang!`);
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

  // Loading state
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
        <div className="flex items-center justify-between">
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

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            title="Pengaturan"
          >
            <Settings className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'orders'
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-primary/10'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>Laporan Pesanan</span>
          </button>
          <button
            onClick={() => setActiveTab('forum')}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
              activeTab === 'forum'
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-primary/10'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span>Forum Saya</span>
          </button>
        </div>
      </div>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <>
          <div className="mb-6">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {orderTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setOrderFilter(tab.id)}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                      orderFilter === tab.id
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

          <div className="space-y-4 mb-8">
            {isLoadingData ? (
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
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-border">
                    <div>
                      <span className="font-semibold text-text-primary">Order #{order.id}</span>
                      <p className="text-sm text-text-secondary">{formatDate(order.createdAt)}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  
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

                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <div>
                      <p className="text-sm text-text-secondary">Total Pembayaran</p>
                      <p className="font-bold text-lg text-primary">
                        {formatCurrency(order.grandTotal || order.grand_total || 0)}
                      </p>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {order.status === 'pending' && order.paymentMethod !== 'cod' && (
                        <button 
                          className="btn-primary px-4 py-2 text-sm flex items-center gap-1" 
                          onClick={() => router.push(`/orders/${order.id}/pay`)}
                        >
                          <CreditCard className="w-4 h-4" />
                          Bayar
                        </button>
                      )}
                      {order.status === 'pending' && order.paymentMethod === 'cod' && (
                        <span className="text-xs text-text-secondary bg-green-100 text-green-800 px-3 py-2 rounded-full">
                          COD
                        </span>
                      )}
                      {order.status === 'shipped' && (
                        <button 
                          className="btn-primary px-4 py-2 text-sm flex items-center gap-1" 
                          onClick={() => router.push(`/orders/${order.id}`)}
                        >
                          <Truck className="w-4 h-4" />
                          Lacak
                        </button>
                      )}
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
                  {orderFilter === 'all' ? 'Belum ada pesanan' : `Tidak ada pesanan ${orderTabs.find(t => t.id === orderFilter)?.label?.toLowerCase()}`}
                </p>
                <button onClick={() => router.push('/katalog')} className="btn-primary mt-4">
                  Mulai Belanja
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* FORUM TAB */}
      {activeTab === 'forum' && (
        <div className="space-y-4 mb-8">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : forumPosts.length > 0 ? (
            forumPosts.map((post) => (
              <div key={post.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-2">
                      {post.category_icon} {post.category_name}
                    </span>
                    <h3 className="text-lg font-bold text-text-primary">{post.title}</h3>
                    <p className="text-sm text-text-secondary">{formatDate(post.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditPost(post)}
                      className="p-2 rounded-lg hover:bg-surface text-text-secondary hover:text-primary transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="p-2 rounded-lg hover:bg-surface text-text-secondary hover:text-red-500 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-text-secondary line-clamp-3 mb-3">{post.content}</p>
                <div className="flex items-center gap-4 text-sm text-text-secondary">
                  <span>👁️ {post.views} dilihat</span>
                  <span>❤️ {post.like_count} suka</span>
                  <span>💬 {post.comment_count} komentar</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 card">
              <MessageSquare className="w-16 h-16 mx-auto text-text-secondary mb-4" />
              <p className="text-text-secondary font-medium">Belum ada diskusi yang dibuat</p>
              <button 
                onClick={() => router.push('/forum')} 
                className="btn-primary mt-4"
              >
                Buat Diskusi Pertama
              </button>
            </div>
          )}
        </div>
      )}

      {/* Only Logout Button */}
      <div className="mb-8">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>

      {/* ✅ SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-background rounded-t-3xl md:rounded-3xl w-full max-w-200 p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary">Pengaturan</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {settingsItems.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3 px-1">
                    {section.section}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item, itemIndex) => (
                      <button
                        key={itemIndex}
                        onClick={() => handleSettingsAction(item)}
                        className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <span className="flex-1 text-left font-medium text-text-primary">{item.label}</span>
                        
                        {/* ✅ Toggle Switch - FIXED: use label + input, not nested button */}
                        {item.isToggle ? (
                          <label 
                            className="relative inline-flex items-center cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={darkMode}
                              onChange={(e) => {
                                const newMode = e.target.checked;
                                setDarkMode(newMode);
                                document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
                                localStorage.setItem('agri-x-theme', newMode ? 'dark' : 'light');
                              }}
                              className="sr-only peer"
                            />
                            <div className={`w-12 h-7 rounded-full peer peer-focus:ring-2 peer-focus:ring-primary/20 transition-colors ${
                              darkMode ? 'bg-primary' : 'bg-border'
                            }`}>
                              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                                darkMode ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </div>
                          </label>
                        ) : (
                          <ChevronRight className="w-5 h-5 text-text-secondary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* App Info */}
            <div className="mt-8 pt-6 border-t border-border text-center">
              <p className="text-sm text-text-secondary">Agri X v1.0.0</p>
              <p className="text-xs text-text-secondary mt-1">Platform Hasil Pertanian Indonesia</p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ EDIT POST MODAL - WITH IMAGE UPLOAD */}
      {editingPost && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-background rounded-t-3xl md:rounded-3xl w-full max-w-200 p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary">Edit Diskusi</h2>
              <button
                onClick={closeEditModal}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSavePost(); }} className="space-y-4">
              {/* Judul */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Judul *</label>
                <input
                  type="text"
                  value={editingPost.title || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                  className="input"
                  placeholder="Judul diskusi..."
                  required
                  minLength={10}
                />
                <p className="text-xs text-text-secondary mt-1">
                  {editingPost.title?.length || 0}/255 karakter (min 10)
                </p>
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Kategori *</label>
                <select
                  value={editingPost.category_id || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, category_id: parseInt(e.target.value) })}
                  className="input"
                  required
                >
                  <option value="">Pilih Kategori</option>
                  <option value="1">🌱 Tips Bertani</option>
                  <option value="2">💰 Harga Pasar</option>
                  <option value="3">🚜 Teknologi</option>
                  <option value="4">❓ Tanya Jawab</option>
                </select>
              </div>

              {/* Isi */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Isi Diskusi *</label>
                <textarea
                  value={editingPost.content || ''}
                  onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                  rows={6}
                  className="input"
                  placeholder="Tulis isi diskusi..."
                  required
                  minLength={20}
                />
                <p className="text-xs text-text-secondary mt-1">
                  {editingPost.content?.length || 0}/5000 karakter (min 20)
                </p>
              </div>

              {/* ✅ Gambar Section */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Gambar (Opsional)
                </label>
                
                {/* Preview Images */}
                {postImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {postImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-border"
                        />
                        <button
                          type="button"
                          onClick={() => removePostImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <label className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  isUploadingImage 
                    ? 'border-primary/50 bg-primary/5' 
                    : 'border-border hover:border-primary hover:bg-primary/5'
                }`}>
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      <span className="text-sm text-primary">Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-text-secondary" />
                      <span className="text-sm text-text-secondary">
                        {postImages.length >= 5 ? 'Maksimal 5 gambar' : 'Tambah Gambar (max 5MB)'}
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePostImageUpload}
                    className="hidden"
                    multiple
                    disabled={isUploadingImage || postImages.length >= 5}
                  />
                </label>
                
                <p className="text-xs text-text-secondary mt-2">
                  Format: JPG, PNG, WebP • Max 5 gambar • Max 5MB per file
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="btn-outline flex-1"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImage}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {isUploadingImage ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Menyimpan...</span>
                    </div>
                  ) : (
                    'Simpan Perubahan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}