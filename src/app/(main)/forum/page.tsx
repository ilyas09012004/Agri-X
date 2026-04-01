'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Heart, MessageSquare, Share2, Plus, X, Maximize2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { CreatePostModal } from '@/components/forum/CreatePostModal';

interface PostImage {
  id?: number;
  image_url: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author_name: string;
  author_avatar: string;
  category_name: string;
  category_slug: string;
  category_icon: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  is_pinned: boolean;
  is_liked?: boolean;
  images?: PostImage[];
}

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

const defaultCategories = [
  { name: 'Semua', slug: 'all', icon: '🌾' },
  { name: 'Tips Bertani', slug: 'tips-bertani', icon: '🌱' },
  { name: 'Harga Pasar', slug: 'harga-pasar', icon: '💰' },
  { name: 'Teknologi', slug: 'teknologi', icon: '🚜' },
  { name: 'Tanya Jawab', slug: 'tanya-jawab', icon: '❓' },
  { name: 'Pengumuman', slug: 'pengumuman', icon: '📢' },
];

// ✅ Placeholder SVG untuk gambar error
const IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%23f5f9f4" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E🖼️ Gambar tidak tersedia%3C/text%3E%3C/svg%3E';

export default function ForumPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLiking, setIsLiking] = useState<number | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchPosts();
  }, [activeCategory, searchQuery]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/forum/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || defaultCategories);
      } else {
        setCategories(defaultCategories);
      }
    } catch (error) {
      console.error('Fetch categories error:', error);
      setCategories(defaultCategories);
    }
  };

  const fetchPosts = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        category: activeCategory,
        search: searchQuery,
        sort: 'newest',
        page: '1',
        limit: '20',
      });

      const res = await fetch(`/api/forum/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Fetch posts error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (postId: number) => {
    if (!isAuthenticated) {
      alert('Silakan login untuk memberikan like');
      router.push('/login');
      return;
    }

    setIsLiking(postId);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/forum/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              like_count: data.liked ? post.like_count + 1 : post.like_count - 1,
              is_liked: data.liked,
            };
          }
          return post;
        }));
      }
    } catch (error) {
      console.error('Like error:', error);
    } finally {
      setIsLiking(null);
    }
  };

  const handleShare = async (post: Post) => {
    const shareData = {
      title: post.title,
      text: post.content.substring(0, 100) + '...',
      url: `${window.location.origin}/forum/${post.id}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('Share error:', error);
      }
    } else {
      navigator.clipboard.writeText(shareData.url);
      alert('Link disalin ke clipboard!');
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: id });
    } catch {
      return dateString;
    }
  };

  // ✅ Handle image error - ganti dengan placeholder
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = IMAGE_PLACEHOLDER;
    e.currentTarget.classList.add('opacity-50');
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-4">Forum Diskusi</h1>
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
          <input
            type="text"
            placeholder="Cari topik diskusi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((category) => (
            <button
              key={category.slug}
              onClick={() => setActiveCategory(category.slug)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${
                activeCategory === category.slug
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              <span className="mr-2">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length > 0 ? (
          posts.map((post) => (
            <div
              key={post.id}
              onClick={() => router.push(`/forum/${post.id}`)}
              className="card cursor-pointer group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                  {post.author_avatar || post.author_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-text-primary">{post.author_name}</p>
                  <p className="text-sm text-text-secondary">{formatTime(post.created_at)}</p>
                </div>
                {post.is_pinned && (
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full font-semibold">
                    📌 Dipin
                  </span>
                )}
              </div>
              
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-3">
                <span className="mr-1">{post.category_icon}</span>
                {post.category_name}
              </span>
              
              <h3 className="text-lg font-bold text-text-primary mb-2 group-hover:text-primary transition-colors">
                {post.title}
              </h3>
              
              <p className="text-text-secondary mb-3 line-clamp-2">
                {post.content}
              </p>

              {/* ✅ PREVIEW 4 GAMBAR KECIL DI CARD - GRID 2x2 */}
              {post.images && post.images.length > 0 && (
                <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-5 rounded-lg overflow-hidden bg-surface border border-border">
                    {/* Render max 4 images */}
                    {post.images.slice(0, 4).map((img, index) => (
                      <div 
                        key={index}
                        className="relative aspect-square cursor-zoom-in group"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/forum/${post.id}#images`);
                        }}
                      >
                        <img
                          src={img.image_url}
                          alt={`${post.title} - ${index + 1}`}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER;
                            (e.target as HTMLImageElement).classList.add('opacity-50');
                          }}
                        />
                        
                        {/* Overlay "+X" on last visible image if more images exist */}
                        {index === 3 && post.images.length > 4 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white font-bold text-sm">+{post.images.length - 4}</span>
                          </div>
                        )}
                        
                        {/* Hover zoom indicator */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                          <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-6 pt-4 border-t border-border">
                <button
                  onClick={(e) => { e.stopPropagation(); handleLike(post.id); }}
                  disabled={isLiking === post.id}
                  className={`flex items-center gap-2 transition-colors ${
                    post.is_liked ? 'text-red-500' : 'text-text-secondary hover:text-red-500'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${post.is_liked ? 'fill-red-500' : ''}`} />
                  <span>{post.like_count}</span>
                </button>
                <button className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
                  <MessageSquare className="w-5 h-5" />
                  <span>{post.comment_count} komentar</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleShare(post); }}
                  className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                  <span>Bagikan</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Belum Ada Diskusi</h3>
            <p className="text-text-secondary mb-4">Jadilah yang pertama memulai diskusi</p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="w-5 h-5 mr-2" />
              Buat Diskusi
            </button>
          </div>
        )}
      </div>

      {/* Create Post Button */}
      {isAuthenticated && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-40"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          categories={categories.filter(c => c.slug !== 'all')}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchPosts();
          }}
        />
      )}
    </div>
  );
}