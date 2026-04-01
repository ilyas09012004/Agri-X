'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Eye, AlertCircle, Loader2, Search } from 'lucide-react';
import { getCookie } from '@/lib/auth';
import { formatDate } from '@/lib/utils';

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
  comment_count: number;
}

export default function AdminModerationPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingPosts();
  }, []);

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
        alert(`Post berhasil ${action === 'approve' ? 'disetujui' : 'ditolak'}`);
        setSelectedPost(null);
        setAdminNote('');
        fetchPendingPosts();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Gagal memproses');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-screen pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Moderasi Forum</h1>
        <button
          onClick={() => router.push('/admin')}
          className="btn-outline px-4 py-2 text-sm"
        >
          ← Kembali ke Admin
        </button>
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
                <p className="text-sm text-text-secondary mb-3">
                  📷 {post.image_count} gambar terlampir
                </p>
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

      {/* Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-text-primary">Review Post</h2>
              <button
                onClick={() => {
                  setSelectedPost(null);
                  setAdminNote('');
                }}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Post Info */}
              <div className="p-4 bg-surface rounded-xl">
                <h3 className="font-bold text-text-primary mb-2">{selectedPost.title}</h3>
                <p className="text-sm text-text-secondary mb-3">
                  Oleh {selectedPost.author_name} ({selectedPost.author_email})<br/>
                  Kategori: {selectedPost.category_name} • {formatDate(selectedPost.created_at)}
                </p>
                <p className="text-text-secondary whitespace-pre-line">{selectedPost.content}</p>
              </div>

              {/* Images */}
              {selectedPost.image_count > 0 && (
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-2">Lampiran Gambar:</p>
                  <p className="text-text-secondary">📷 {selectedPost.image_count} gambar (preview tidak tersedia di modal)</p>
                </div>
              )}

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
                  className="input"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => handleAction(selectedPost.id, 'reject')}
                  disabled={actionLoading === selectedPost.id}
                  className="btn-outline flex-1 text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50"
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
    </div>
  );
}