'use client';

import { useState } from 'react';
import { Search, Heart, MessageSquare, Share2, Plus } from 'lucide-react';

const categories = ['Semua', 'Tips Bertani', 'Harga Pasar', 'Teknologi', 'Tanya Jawab'];

const samplePosts = [
  {
    id: 1,
    author: 'Budi Santoso',
    avatar: 'BS',
    time: '2 jam yang lalu',
    category: 'Tips Bertani',
    title: 'Tips Meningkatkan Hasil Panen Jagung',
    content: 'Saya ingin berbagi pengalaman tentang cara meningkatkan hasil panen jagung...',
    likes: 45,
    comments: 23,
    liked: false,
  },
  {
    id: 2,
    author: 'Siti Wahyuni',
    avatar: 'SW',
    time: '5 jam yang lalu',
    category: 'Harga Pasar',
    title: 'Update Harga Tomat di Pasar Malang',
    content: 'Harga tomat merah saat ini di pasar Malang sekitar Rp 12.000 - Rp 15.000 per kg...',
    likes: 89,
    comments: 56,
    liked: false,
  },
  {
    id: 3,
    author: 'Ahmad Rizki',
    avatar: 'AR',
    time: '1 hari yang lalu',
    category: 'Teknologi',
    title: 'Rekomendasi Alat Penyiram Otomatis',
    content: 'Ada yang punya pengalaman pakai sistem irigasi otomatis untuk lahan pertanian?...',
    likes: 34,
    comments: 18,
    liked: false,
  },
];

export default function ForumPage() {
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [posts, setPosts] = useState(samplePosts);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleLike = (postId: number) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.liked ? post.likes - 1 : post.likes + 1,
          liked: !post.liked,
        };
      }
      return post;
    }));
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
            className="input pl-12"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${
                activeCategory === category
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-primary/10'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                {post.avatar}
              </div>
              <div>
                <p className="font-semibold text-text-primary">{post.author}</p>
                <p className="text-sm text-text-secondary">{post.time}</p>
              </div>
            </div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-3">
              {post.category}
            </span>
            <h3 className="text-lg font-bold text-text-primary mb-2">{post.title}</h3>
            <p className="text-text-secondary mb-4">{post.content}</p>
            <div className="flex items-center gap-6 pt-4 border-t border-border">
              <button
                onClick={() => handleLike(post.id)}
                className={`flex items-center gap-2 transition-colors ${
                  post.liked ? 'text-red-500' : 'text-text-secondary hover:text-red-500'
                }`}
              >
                <Heart className={`w-5 h-5 ${post.liked ? 'fill-red-500' : ''}`} />
                <span>{post.likes}</span>
              </button>
              <button className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
                <MessageSquare className="w-5 h-5" />
                <span>{post.comments} komentar</span>
              </button>
              <button className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors">
                <Share2 className="w-5 h-5" />
                <span>Bagikan</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Post Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-40"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-background rounded-t-3xl md:rounded-3xl w-full max-w-lg p-6 animate-slide-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-text-primary">Buat Diskusi Baru</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Judul Topik</label>
                <input type="text" placeholder="Masukkan judul diskusi..." className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Kategori</label>
                <select className="input">
                  {categories.filter(c => c !== 'Semua').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Isi Diskusi</label>
                <textarea rows={5} placeholder="Tuliskan isi diskusi Anda..." className="input" />
              </div>
              <button className="btn-primary w-full">
                <Plus className="w-5 h-5 mr-2" />
                Posting Diskusi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}