'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, Heart, MessageSquare, Share2, Plus, X, 
  SlidersHorizontal, Check, Loader2, ChevronLeft, ChevronRight,
  MoreHorizontal, Bookmark, Send, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { CreatePostModal } from '@/components/forum/CreatePostModal';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Comment {
  id: number;
  user_name: string;
  user_avatar?: string;
  content: string;
  created_at: string;
  like_count: number;
  is_liked?: boolean;
  replies?: Comment[]; // Nested comments
}

interface PostImage {
  id?: number;
  image_url: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author_name: string;
  author_avatar?: string;
  category_name: string;
  category_slug: string;
  category_icon: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  is_pinned: boolean;
  is_liked?: boolean;
  is_saved?: boolean;
  images?: PostImage[];
}

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

const IMAGE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect fill="%23f5f9f4" width="400" height="400"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';

export default function ForumPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  // State Filters
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data State
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isLiking, setIsLiking] = useState<number | null>(null);
  
  // ✅ State for Comment Modal
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  
  // ✅ State Khusus untuk Data Komentar di Modal
  const [modalComments, setModalComments] = useState<Comment[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  
  // ✅ State for Liking Comments
  const [likingCommentId, setLikingCommentId] = useState<number | null>(null);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<number>>(new Set());

  // ✅ NEW: State untuk Toggle Balasan (Set of Comment IDs that are expanded)
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());

  
  const modalRef = useRef<HTMLDivElement>(null);

  // ============================================
  // EFFECTS & FETCHING
  // ============================================

  useEffect(() => {
    fetchForumCategories();
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [activeCategory, searchQuery]);

  // Handle Body Scroll Lock
  useEffect(() => {
    if (isFilterModalOpen || selectedPostId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isFilterModalOpen, selectedPostId]);

  const fetchForumCategories = async () => {
    try {
      const res = await fetch('/api/forum/categories'); 
      if (res.ok) {
        const data = await res.json();
        const allCat = { id: 0, name: 'Semua', slug: 'all', icon: '💬' };
        setCategories([allCat, ...(data.categories || [])]);
      }
    } catch (err) {
      setCategories([
        { id: 0, name: 'Semua', slug: 'all', icon: '💬' },
        { id: 1, name: 'Tips Bertani', slug: 'tips-bertani', icon: '🌱' },
        { id: 2, name: 'Harga Pasar', slug: 'harga-pasar', icon: '💰' },
      ]);
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
        limit: '10',
      });

      const res = await fetch(`/api/forum/posts?${params}`);
      if (res.ok) {
        const data = await res.json();
        const mappedPosts = (data.posts || []).map((p: any) => ({
          ...p,
          images: p.images || [],
          isExpanded: false,
          currentImageIndex: 0
        }));
        setPosts(mappedPosts);
      }
    } catch (error) {
      console.error('Fetch posts error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async (postId: number) => {
    setIsCommentsLoading(true);
    setCommentError(null);
    setModalComments([]);
    setExpandedReplies(new Set()); // Reset toggle state saat load baru

    try {
      const res = await fetch(`/api/forum/posts/${postId}/comments`);
      
      if (!res.ok) {
        throw new Error('Gagal memuat komentar');
      }

      const data = await res.json();
      
      if (data.success) {
        setModalComments(data.comments || []);
      } else {
        setModalComments(data || []);
      }

    } catch (err: any) {
      console.error('Fetch comments error:', err);
      setCommentError(err.message || 'Terjadi kesalahan jaringan');
    } finally {
      setIsCommentsLoading(false);
    }
  };

  // ============================================
  // ACTIONS
  // ============================================

  const handleLikePost = async (postId: number) => {
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
      console.error('Like post error:', error);
    } finally {
      setIsLiking(null);
    }
  };

  const handleLikeComment = async (commentId: number) => {
  if (!isAuthenticated) {
    alert('Silakan login untuk memberikan like');
    router.push('/login');
    return;
  }

  // Tentukan action berdasarkan state lokal saat ini
  const isCurrentlyLiked = likedCommentIds.has(commentId);
  const action = isCurrentlyLiked ? 'unlike' : 'like';

  // Optimistic UI: Update state lokal segera agar responsif
  setLikedCommentIds(prev => {
    const newSet = new Set(prev);
    if (isCurrentlyLiked) {
      newSet.delete(commentId);
    } else {
      newSet.add(commentId);
    }
    return newSet;
  });

  setLikingCommentId(commentId);

  try {
    const token = localStorage.getItem('accessToken');
    
    // Kirim action ke backend
    const res = await fetch(`/api/forum/comments/${commentId}/like`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ action }) // Kirim 'like' atau 'unlike'
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Gagal memproses like');
    }
    
    // Update count di state modalComments sesuai response server
    setModalComments(prevComments => {
      const updateLikesRecursively = (comments: Comment[]): Comment[] => {
        return comments.map(c => {
          if (c.id === commentId) {
            return { ...c, like_count: data.like_count };
          }
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: updateLikesRecursively(c.replies) };
          }
          return c;
        });
      };
      return updateLikesRecursively(prevComments);
    });

  } catch (error: any) {
    console.error('Like comment error:', error);
    
    // Rollback jika error: Kembalikan state seperti semula
    setLikedCommentIds(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyLiked) {
        newSet.add(commentId); // Kembalikan jadi liked
      } else {
        newSet.delete(commentId); // Hapus jadi unliked
      }
      return newSet;
    });
    
    alert(error.message);
  } finally {
    setLikingCommentId(null);
  }
};

  const toggleCaption = (postId: number) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, isExpanded: !p.isExpanded } : p));
  };

  const nextImage = (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();
    setPosts(posts.map(p => {
      if (p.id === postId && p.images && p.images.length > 0) {
        const nextIndex = (p.currentImageIndex + 1) % p.images.length;
        return { ...p, currentImageIndex: nextIndex };
      }
      return p;
    }));
  };

  const prevImage = (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();
    setPosts(posts.map(p => {
      if (p.id === postId && p.images && p.images.length > 0) {
        const prevIndex = (p.currentImageIndex - 1 + p.images.length) % p.images.length;
        return { ...p, currentImageIndex: prevIndex };
      }
      return p;
    }));
  };

  const openCommentModal = (postId: number) => {
    setSelectedPostId(postId);
    fetchComments(postId);
  };

  const closeCommentModal = () => {
    setSelectedPostId(null);
    setReplyingTo(null);
    setCommentInput('');
    setModalComments([]);
    setCommentError(null);
    setExpandedReplies(new Set());
  };

  const submitComment = async () => {
    if (!commentInput.trim() || !selectedPostId) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const payload: any = {
        content: commentInput,
        post_id: selectedPostId,
        ...(replyingTo && { parent_id: replyingTo.id }) 
      };

      const res = await fetch('/api/forum/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCommentInput('');
        setReplyingTo(null);
        fetchComments(selectedPostId);
      } else {
        const data = await res.json();
        alert(data.error || 'Gagal mengirim komentar');
      }
    } catch (err) {
      console.error('Submit comment error:', err);
      alert('Terjadi kesalahan jaringan');
    }
  };

  // ✅ Toggle Logic for Replies
  const toggleReplies = (commentId: number) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: id });
    } catch {
      return dateString;
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

    const renderNestedComments = (comments: Comment[], depth = 0) => {
  return comments.map((comment) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    
    // Cek apakah user sudah like komentar ini
    const isLikedByUser = likedCommentIds.has(comment.id);

    return (
      <div key={comment.id} className={`${depth > 0 ? 'mt-4' : 'mb-6 last:mb-0'}`}>
        <div className={`flex gap-3 ${depth > 0 ? 'ml-6 sm:ml-8 border-l-2 border-border pl-4' : ''}`}>
          {/* Avatar ... */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden border border-border">
             {comment.user_avatar ? (
               <img src={comment.user_avatar} alt="" className="w-full h-full object-cover" />
             ) : (
               comment.user_name.charAt(0)
             )}
          </div>
          
          <div className="flex-1">
            <div className="bg-surface p-3 rounded-2xl rounded-tl-none shadow-sm relative">
              {/* Content ... */}
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-sm text-text-primary">{comment.user_name}</span>
                <span className="text-[10px] text-text-secondary">{formatTime(comment.created_at)}</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed break-words">{comment.content}</p>
              
              <div className="flex items-center gap-4 mt-2">
                {/* ✅ TOMBOL LIKE TOGGLE */}
                <button 
                  onClick={() => handleLikeComment(comment.id)}
                  disabled={likingCommentId === comment.id}
                  className={`text-xs flex items-center gap-1 transition-all duration-200 disabled:opacity-50 ${
                    isLikedByUser 
                      ? 'text-red-500 font-medium' 
                      : 'text-text-secondary hover:text-red-500'
                  }`}
                >
                  <Heart 
                    className={`w-3 h-3 transition-all duration-200 ${
                      isLikedByUser ? 'fill-red-500 scale-110' : ''
                    }`} 
                  /> 
                  {comment.like_count}
                </button>
                
                <button 
                  onClick={() => setReplyingTo(comment)}
                  className="text-xs font-medium text-text-secondary hover:text-primary transition-colors"
                >
                  Balas
                </button>
              </div>
            </div>

            {/* Toggle Replies Button ... */}
            {hasReplies && (
              <button 
                onClick={() => toggleReplies(comment.id)}
                className="flex items-center gap-1 mt-2 ml-2 text-xs text-text-secondary hover:text-primary transition-colors"
              >
                {isExpanded ? (
                  <><ChevronUp className="w-3 h-3" /> Sembunyikan {comment.replies?.length} balasan</>
                ) : (
                  <><ChevronDown className="w-3 h-3" /> Lihat {comment.replies?.length} balasan</>
                )}
              </button>
            )}
          </div>
        </div>
        
        {hasReplies && isExpanded && (
          <div className="mt-2">
            {renderNestedComments(comment.replies!, depth + 1)}
          </div>
        )}
      </div>
    );
  });
};

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="animate-fade-in min-h-screen bg-background pb-20 sm:pb-0 relative">
      
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">AgriForum</h1>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setIsFilterModalOpen(true)} 
             className="p-2 hover:bg-surface rounded-full transition-colors text-text-secondary hover:text-primary"
           >
             <SlidersHorizontal className="w-5 h-5" />
           </button>

           {isAuthenticated && (
             <button 
               onClick={() => setShowCreateModal(true)}
               className="p-2 bg-primary text-white rounded-full hover:bg-secondary transition-all shadow-md active:scale-95"
             >
               <Plus className="w-5 h-5" />
             </button>
           )}
        </div>
      </div>

      {/* MAIN FEED */}
      <main className="max-w-500 mx-auto pt-2">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-text-secondary">Memuat diskusi...</p>
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="bg-background border-b border-border sm:border sm:rounded-xl sm:mb-6 sm:shadow-sm last:border-b-0">
              
              {/* Header Card */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full">
                    <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-surface">
                       {post.author_avatar ? (
                         <img src={post.author_avatar} alt={post.author_name} className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center text-xs font-bold bg-primary/10 text-primary">
                           {post.author_name.charAt(0)}
                         </div>
                       )}
                    </div>
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-text-primary">{post.author_name}</p>
                    <p className="text-xs text-text-secondary">{post.category_name}</p>
                  </div>
                </div>
                <button className="text-text-secondary hover:text-text-primary">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Image Slider */}
              {post.images && post.images.length > 0 ? (
                <div className="relative aspect-square w-full bg-black">
                  <img 
                    src={post.images[post.currentImageIndex]?.image_url || IMAGE_PLACEHOLDER} 
                    alt={post.title}
                    className="w-full h-full object-contain"
                  />
                  
                  {post.images.length > 1 && (
                    <>
                      <button onClick={(e) => prevImage(e, post.id)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button onClick={(e) => nextImage(e, post.id)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {post.images.map((_, idx) => (
                          <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === post.currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4 pb-2">
                   <h3 className="font-bold text-lg text-text-primary mb-1">{post.title}</h3>
                </div>
              )}

              {/* Actions & Content */}
              <div className="p-3 pb-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <button onClick={() => handleLikePost(post.id)} className={`transition-transform active:scale-90 ${post.is_liked ? 'text-red-500' : 'text-text-primary hover:text-gray-600'}`}>
                      <Heart className={`w-7 h-7 ${post.is_liked ? 'fill-current' : ''}`} />
                    </button>
                    <button onClick={() => openCommentModal(post.id)} className="text-text-primary hover:text-gray-600 transition-transform active:scale-90">
                      <MessageSquare className="w-7 h-7" />
                    </button>
                    <button className="text-text-primary hover:text-gray-600 transition-transform active:scale-90">
                      <Send className="w-7 h-7" />
                    </button>
                  </div>
                  <button className="text-text-primary hover:text-gray-600 transition-transform active:scale-90">
                    <Bookmark className="w-7 h-7" />
                  </button>
                </div>

                <p className="font-semibold text-sm text-text-primary mb-1">
                  {post.like_count.toLocaleString()} suka
                </p>

                <div className="text-sm text-text-primary">
                  <span className="font-semibold mr-2">{post.author_name}</span>
                  <span className={`${post.isExpanded ? '' : 'line-clamp-2'}`}>
                    {post.content}
                  </span>
                  {post.content.length > 100 && (
                    <button onClick={() => toggleCaption(post.id)} className="text-text-secondary ml-1 text-xs">
                      {post.isExpanded ? 'sembunyikan' : 'selengkapnya'}
                    </button>
                  )}
                </div>

                {post.comment_count > 0 && (
                  <button onClick={() => openCommentModal(post.id)} className="text-text-secondary text-sm mt-1 w-full text-left hover:text-text-primary">
                    Lihat semua {post.comment_count} komentar
                  </button>
                )}
                
                <p className="text-[10px] text-text-secondary uppercase mt-1 tracking-wide">
                  {formatTime(post.created_at)}
                </p>
              </div>
            </article>
          ))
        )}
      </main>

      {/* ============================================
          MODAL 1: CREATE POST
      ============================================ */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="relative w-full sm:max-w-200 bg-surface sm:rounded-2xl shadow-2xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-hidden animate-slide-up border border-border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-surface z-10">
              <h2 className="text-lg sm:text-xl font-bold text-text-primary">Buat Diskusi Baru</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
              <CreatePostModal onClose={() => setShowCreateModal(false)} categories={categories.filter(c => c.slug !== 'all')} onSuccess={() => { setShowCreateModal(false); fetchPosts(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          MODAL 2: KOMENTAR (WITH TOGGLE REPLIES)
      ============================================ */}
      {selectedPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={(e) => e.target === e.currentTarget && closeCommentModal()}>
          <div ref={modalRef} className="bg-background w-full max-w-500 h-[80vh] sm:h-[600px] sm:w-[500px] rounded-2xl sm:rounded-2xl flex flex-col shadow-2xl animate-scale-up border border-border overflow-hidden" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0 bg-background">
              <h3 className="font-bold text-base">Komentar</h3>
              <button onClick={closeCommentModal} className="p-2 hover:bg-surface rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>

            {/* List Komentar */}
            <div className="flex-1 overflow-y-auto p-4 bg-background scroll-smooth">
              {isCommentsLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Memuat komentar...</p>
                </div>
              ) : commentError ? (
                <div className="flex flex-col items-center justify-center h-full text-red-500 gap-2 text-center px-4">
                  <AlertCircle className="w-10 h-10" />
                  <p className="text-sm font-medium">{commentError}</p>
                  <button onClick={() => fetchComments(selectedPostId)} className="text-xs underline mt-2 text-primary">Coba Lagi</button>
                </div>
              ) : modalComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-2">
                  <MessageSquare className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Belum ada komentar. Jadilah yang pertama!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {renderNestedComments(modalComments)}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-background flex items-center gap-3 flex-shrink-0 relative z-10">
               {replyingTo && (
                 <div className="absolute bottom-full left-0 right-0 bg-surface p-2 text-xs flex justify-between items-center border-t border-border shadow-lg animate-slide-up">
                   <span className="truncate mr-2 ml-2">Membalas <strong>{replyingTo.user_name}</strong></span>
                   <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-red-100 rounded-full"><X className="w-3 h-3 text-red-500" /></button>
                 </div>
               )}
               
               <input 
                 type="text" 
                 value={commentInput}
                 onChange={(e) => setCommentInput(e.target.value)}
                 placeholder={replyingTo ? `Balas ke ${replyingTo.user_name}...` : "Tulis komentar..."}
                 className="flex-1 bg-surface border border-transparent focus:border-primary rounded-full px-4 py-2.5 text-sm focus:outline-none transition-all"
                 onKeyDown={(e) => e.key === 'Enter' && submitComment()}
               />
               <button 
                 onClick={submitComment}
                 disabled={!commentInput.trim() || isCommentsLoading}
                 className="text-primary font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed px-2"
               >
                 Kirim
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          MODAL 3: FILTER KATEGORI
      ============================================ */}
      {isFilterModalOpen && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsFilterModalOpen(false)}>
            <div className="bg-background w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up border border-border" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                  <h3 className="font-bold text-lg">Kategori Forum</h3>
                  <button onClick={() => setIsFilterModalOpen(false)} className="p-1 hover:bg-surface rounded"><X className="w-5 h-5"/></button>
               </div>
               <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                  {categories.map(c => (
                     <button key={c.slug} onClick={() => { setActiveCategory(c.slug); setIsFilterModalOpen(false); }} className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${activeCategory === c.slug ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:border-primary/50'}`}>
                        <span className="flex items-center gap-2"><span>{c.icon}</span> {c.name}</span>
                        {activeCategory === c.slug && <Check className="w-4 h-4"/>}
                     </button>
                  ))}
               </div>
            </div>
         </div>
      )}
    </div> 
  );
}