'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Heart, MessageSquare, Share2, Send, 
  X, ChevronLeft, ChevronRight, Maximize2, Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

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
  category_icon: string;
  like_count: number;
  comment_count: number;
  views: number;
  created_at: string;
  is_pinned: boolean;
  is_liked?: boolean;
  images?: PostImage[];
  comments: Array<{
    id: number;
    content: string;
    author_name: string;
    author_avatar: string;
    like_count: number;
    created_at: string;
  }>;
}

// ✅ Placeholder untuk gambar error
const IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect fill="%23f5f9f4" width="800" height="600"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="16" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E🖼️ Gambar tidak tersedia%3C/text%3E%3C/svg%3E';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comment, setComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  
  // ✅ Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxLoading, setLightboxLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [params.id]);

  const fetchPost = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/forum/posts/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data.post);
      }
    } catch (error) {
      console.error('Fetch post error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      alert('Silakan login untuk memberikan like');
      router.push('/login');
      return;
    }

    setIsLiking(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/forum/posts/${params.id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setPost(post ? {
          ...post,
          like_count: data.liked ? post.like_count + 1 : post.like_count - 1,
          is_liked: data.liked,
        } : null);
      }
    } catch (error) {
      console.error('Like error:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Silakan login untuk berkomentar');
      router.push('/login');
      return;
    }
    if (!comment.trim()) {
      alert('Komentar tidak boleh kosong');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/forum/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          postId: parseInt(params.id as string),
          content: comment,
        }),
      });

      if (res.ok) {
        setComment('');
        fetchPost();
      }
    } catch (error) {
      console.error('Comment error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: post?.title || 'Diskusi Agri X',
      text: post?.content?.substring(0, 100) + '...',
      url: window.location.href,
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

  // ✅ Handle image error di detail view
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = IMAGE_PLACEHOLDER;
    e.currentTarget.classList.add('opacity-50');
  }, []);

  // ✅ Lightbox functions
  const openLightbox = useCallback((index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
    setLightboxLoading(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxLoading(true);
    document.body.style.overflow = '';
  }, []);

  const nextImage = useCallback(() => {
    if (post?.images) {
      setLightboxLoading(true);
      setCurrentImageIndex((prev) => (prev + 1) % post.images.length);
    }
  }, [post?.images]);

  const prevImage = useCallback(() => {
    if (post?.images) {
      setLightboxLoading(true);
      setCurrentImageIndex((prev) => (prev - 1 + post.images.length) % post.images.length);
    }
  }, [post?.images]);

  // Keyboard navigation untuk lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevImage();
      if (e.key === 'ArrowRight') nextImage();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, prevImage, nextImage]);

  // Cleanup body overflow saat unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not found state
  if (!post) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">😔</div>
        <h3 className="text-xl font-semibold text-text-primary mb-2">Diskusi Tidak Ditemukan</h3>
        <button onClick={() => router.push('/forum')} className="btn-primary">
          Kembali ke Forum
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-text-secondary hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Kembali</span>
      </button>

      {/* Post Content */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
            {post.author_avatar || post.author_name?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="font-semibold text-text-primary">{post.author_name}</p>
            <p className="text-sm text-text-secondary">{formatTime(post.created_at)}</p>
          </div>
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-3">
          <span className="mr-1">{post.category_icon}</span>
          {post.category_name}
        </span>

        <h1 className="text-2xl font-bold text-text-primary mb-4">{post.title}</h1>
        <p className="text-text-secondary mb-4 whitespace-pre-line">{post.content}</p>

        {/* ✅ IMAGE GALLERY - RESPONSIVE GRID */}
        {post.images && post.images.length > 0 && (
          <div className="mb-6" id="images">
            {/* Single image - full width with zoom effect */}
            {post.images.length === 1 ? (
              <div 
                className="relative aspect-video rounded-xl overflow-hidden bg-surface cursor-zoom-in group"
                onClick={() => openLightbox(0)}
              >
                <img
                  src={post.images[0].image_url}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="eager"
                  onError={handleImageError}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                  <Maximize2 className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </div>
            ) : (
              /* Multiple images - masonry-style grid */
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {post.images.slice(0, 6).map((img, index) => (
                  <div
                    key={index}
                    className={`relative rounded-lg overflow-hidden bg-surface cursor-zoom-in group ${
                      // First image gets larger span if more than 4 images
                      index === 0 && post.images.length > 4 
                        ? 'md:col-span-2 md:row-span-2 aspect-square md:aspect-auto' 
                        : 'aspect-square'
                    }`}
                    onClick={() => openLightbox(index)}
                  >
                    <img
                      src={img.image_url}
                      alt={`${post.title} - ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading={index === 0 ? 'eager' : 'lazy'}
                      onError={handleImageError}
                    />
                    
                    {/* "+X more" overlay for hidden images */}
                    {index === 5 && post.images.length > 6 && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">+{post.images.length - 6}</span>
                      </div>
                    )}
                    
                    {/* Zoom icon on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                      <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-6 pt-4 border-t border-border">
          <button
            onClick={handleLike}
            disabled={isLiking}
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
            onClick={handleShare}
            className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span>Bagikan</span>
          </button>
          <span className="text-text-secondary text-sm ml-auto">
            👁️ {post.views} kali dilihat
          </span>
        </div>
      </div>

      {/* Comments Section */}
      <div className="card">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          💬 {post.comment_count} Komentar
        </h2>

        <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
          {post.comments.length > 0 ? (
            post.comments.map((commentItem) => (
              <div key={commentItem.id} className="flex gap-3 pb-4 border-b border-border last:border-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/50 to-secondary/50 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {commentItem.author_avatar || commentItem.author_name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-text-primary">{commentItem.author_name}</span>
                    <span className="text-xs text-text-secondary">{formatTime(commentItem.created_at)}</span>
                  </div>
                  <p className="text-text-secondary">{commentItem.content}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-text-secondary">
              Belum ada komentar. Jadilah yang pertama!
            </div>
          )}
        </div>

        <form onSubmit={handleComment} className="flex gap-3">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tulis komentar..."
            className="input flex-1"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !comment.trim()}
            className="btn-primary px-6 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>

      {/* ✅ LIGHTBOX MODAL - IMPROVED */}
      {lightboxOpen && post?.images && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 animate-fade-in"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation Buttons (only if multiple images) */}
          {post.images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-4 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-4 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Loading indicator */}
          {lightboxLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
          )}

          {/* Image */}
          <img
            src={post.images[currentImageIndex].image_url}
            alt={`${post.title} - ${currentImageIndex + 1}`}
            className={`max-w-[95vw] max-h-[85vh] object-contain rounded-lg transition-opacity duration-200 ${
              lightboxLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setLightboxLoading(false)}
            onError={(e) => {
              (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER;
              setLightboxLoading(false);
            }}
          />

          {/* Image Counter & Title */}
          {post.images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 text-white text-sm rounded-full flex items-center gap-2">
              <span>{currentImageIndex + 1} / {post.images.length}</span>
              {post.images.length > 1 && (
                <span className="text-white/60">•</span>
              )}
              <span className="text-white/80 line-clamp-1 max-w-[200px]">{post.title}</span>
            </div>
          )}

          {/* Hint text */}
          <div className="absolute bottom-4 right-4 text-white/50 text-xs hidden md:block">
            ← → untuk navigasi • Esc untuk tutup
          </div>
        </div>
      )}
    </div>
  );
}