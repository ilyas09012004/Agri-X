// src/components/forum/CreatePostModal.tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Image, X, Plus, Loader2, Upload, Search, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface CreatePostModalProps {
  onClose: () => void;
  categories: Array<{ id: number; name: string; slug: string; icon: string }>;
  onSuccess: () => void;
}

interface PostImage {
  url: string;
  alt: string;
  source: 'google' | 'unsplash' | 'pexels' | 'pixabay' | 'upload' | 'local';
  originalUrl?: string; // ✅ Link ke sumber asli (untuk Google Images)
  fileName?: string;    // ✅ Nama file untuk upload lokal
}

// ✅ Katalog gambar gratis (bisa diganti dengan API call ke Unsplash/Pexels)
const FREE_IMAGE_CATALOG = [
  {
    url: 'https://images.unsplash.com/photo-1592841200221-a6898f307baa?w=800',
    alt: 'Tanaman cabai',
    source: 'unsplash' as const,
    originalUrl: 'https://unsplash.com/photos/cabai-plant',
  },
  {
    url: 'https://images.pexels.com/photos/1579739/pexels-photo-1579739.jpeg?w=800',
    alt: 'Sawah padi',
    source: 'pexels' as const,
    originalUrl: 'https://pexels.com/photo/rice-field',
  },
  {
    url: 'https://cdn.pixabay.com/photo/2017/10/09/15/30/tomato-2833542_960_720.jpg',
    alt: 'Tomat segar',
    source: 'pixabay' as const,
    originalUrl: 'https://pixabay.com/photos/tomato',
  },
  {
    url: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800',
    alt: 'Ayam kampung',
    source: 'unsplash' as const,
    originalUrl: 'https://unsplash.com/photos/chicken',
  },
  {
    url: 'https://images.unsplash.com/photo-1533230739623-a5e2a54e8e8f?w=800',
    alt: 'Petani bekerja',
    source: 'unsplash' as const,
    originalUrl: 'https://unsplash.com/photos/farmer',
  },
  {
    url: 'https://images.pexels.com/photos/616350/pexels-photo-616350.jpeg?w=800',
    alt: 'Anak ayam',
    source: 'pexels' as const,
    originalUrl: 'https://pexels.com/photo/chick',
  },
];

export function CreatePostModal({ onClose, categories, onSuccess }: CreatePostModalProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [images, setImages] = useState<PostImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // ✅ State untuk Google Images catalog modal
  const [showImageCatalog, setShowImageCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  
  // ✅ Ref untuk file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Redirect jika tidak login
  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  // ✅ Handle file upload dari lokal
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (images.length + files.length > 5) {
      alert('Maksimal 5 gambar per post');
      return;
    }

    Array.from(files).forEach((file) => {
      // Validasi tipe file
      if (!file.type.startsWith('image/')) {
        alert('Hanya file gambar yang diperbolehkan');
        return;
      }
      
      // Validasi ukuran (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran gambar maksimal 5MB');
        return;
      }

      // Preview dengan FileReader (untuk demo)
      // ✅ Di production, upload ke server dan dapatkan URL
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImages(prev => [...prev, {
          url: result,  // Base64 untuk preview
          alt: file.name.replace(/\.[^/.]+$/, ''),
          source: 'local',
          fileName: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ✅ Handle tambah image URL manual
  const handleAddImageUrl = () => {
    if (images.length >= 5) {
      alert('Maksimal 5 gambar per post');
      return;
    }
    setImages([...images, { url: '', alt: '', source: 'google' }]);
  };

  // ✅ Handle change image field
  const handleImageChange = (index: number, field: keyof PostImage, value: string) => {
    const newImages = [...images];
    newImages[index] = { ...newImages[index], [field]: value };
    setImages(newImages);
  };

  // ✅ Handle remove image
  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // ✅ Handle select image from catalog
  const handleSelectCatalogImage = (catalogImage: typeof FREE_IMAGE_CATALOG[0]) => {
    if (images.length >= 5) {
      alert('Maksimal 5 gambar per post');
      return;
    }
    setImages(prev => [...prev, {
      url: catalogImage.url,
      alt: catalogImage.alt,
      source: catalogImage.source,
      originalUrl: catalogImage.originalUrl, // ✅ Simpan link sumber
    }]);
    setShowImageCatalog(false);
  };

  // ✅ Filter catalog berdasarkan search
  const filteredCatalog = FREE_IMAGE_CATALOG.filter(img =>
    img.alt.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    img.source.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  // ✅ Handle submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validasi required fields
    if (!title.trim() || !content.trim() || !categoryId) {
      setError('Judul, konten, dan kategori wajib diisi');
      return;
    }

    // Validasi gambar
    const validImages = images.filter(img => img.url.trim());
    if (validImages.length > 5) {
      setError('Maksimal 5 gambar per post');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      // ✅ Prepare payload untuk API
      const payload = {
        title: title.trim(),
        content: content.trim(),
        categoryId: parseInt(categoryId),
        images: validImages.map(img => ({
          url: img.url,
          alt: img.alt,
          source: img.source,
          originalUrl: img.originalUrl, // ✅ Kirim link sumber ke backend
        })),
      };
      
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat diskusi');
      }

      onSuccess();
      
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Judul Diskusi <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Tips menanam cabai di musim hujan"
            className="input w-full text-base focus:ring-2 focus:ring-primary/20"
            required
            maxLength={255}
          />
          <p className="text-xs text-text-secondary mt-1 text-right">
            {title.length}/255
          </p>
        </div>

        {/* Category Select */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Kategori <span className="text-red-500">*</span>
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input w-full text-base focus:ring-2 focus:ring-primary/20"
            required
          >
            <option value="">Pilih Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Content Textarea */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Isi Diskusi <span className="text-red-500">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tulis pertanyaan atau pendapat Anda..."
            className="input w-full min-h-[150px] text-base resize-y focus:ring-2 focus:ring-primary/20"
            required
          />
        </div>

        {/* Images Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">
              Gambar (Opsional, Maksimal 5)
            </label>
            <div className="flex gap-2">
              {/* Button Upload File */}
              {images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              )}
              
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {/* Button Catalog */}
              {images.length < 5 && (
                <button
                  type="button"
                  onClick={() => setShowImageCatalog(true)}
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  <Search className="w-4 h-4" />
                  Katalog
                </button>
              )}
            </div>
          </div>

          {/* Image Previews & Inputs */}
          {images.map((img, index) => (
            <div key={index} className="p-4 border border-border rounded-xl space-y-3 bg-surface/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  Gambar #{index + 1}
                  {img.source === 'local' && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      Lokal
                    </span>
                  )}
                  {img.source !== 'local' && img.originalUrl && (
                    <a
                      href={img.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Sumber
                    </a>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Image Preview */}
              {img.url && (
                <div className="relative group">
                  <img 
                    src={img.url} 
                    alt={img.alt || 'Preview'}
                    className="w-full h-40 object-cover rounded-lg border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"%3E%3Crect fill="%23f5f9f4" width="400" height="300"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E🖼️ Gambar tidak tersedia%3C/text%3E%3C/svg%3E';
                      (e.target as HTMLImageElement).classList.add('opacity-50');
                    }}
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                  />
                  {/* Source Badge */}
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded-full flex items-center gap-1">
                    {img.source === 'unsplash' && '📷 Unsplash'}
                    {img.source === 'pexels' && '📷 Pexels'}
                    {img.source === 'pixabay' && '📷 Pixabay'}
                    {img.source === 'google' && '🔍 Google'}
                    {img.source === 'local' && '💾 Lokal'}
                  </div>
                </div>
              )}
              
              {/* Image URL Input (for external images) */}
              {img.source !== 'local' && (
                <input
                  type="url"
                  value={img.url}
                  onChange={(e) => handleImageChange(index, 'url', e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="input w-full text-sm"
                />
              )}
              
              {/* Alt Text Input */}
              <input
                type="text"
                value={img.alt}
                onChange={(e) => handleImageChange(index, 'alt', e.target.value)}
                placeholder="Deskripsi gambar (untuk aksesibilitas)"
                className="input w-full text-sm"
              />
              
              {/* Source Attribution (for external images) */}
              {img.source !== 'local' && img.originalUrl && (
                <p className="text-xs text-text-secondary">
                  Sumber: <a href={img.originalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{img.originalUrl}</a>
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !content.trim() || !categoryId}
            className="btn-primary w-full py-4 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memposting...</span>
              </>
            ) : (
              'Posting Diskusi'
            )}
          </button>
        </div>
      </form>

      {/* ✅ GOOGLE IMAGES CATALOG MODAL */}
      {showImageCatalog && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImageCatalog(false);
          }}
        >
          <div 
            className="relative w-full max-w-4xl bg-surface rounded-2xl shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Catalog Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">Pilih Gambar Gratis</h3>
              <button
                onClick={() => setShowImageCatalog(false)}
                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Cari gambar (cabai, padi, tomat...)"
                  className="input pl-12 w-full"
                />
              </div>
              <p className="text-xs text-text-secondary mt-2">
                💡 Gambar dari Unsplash, Pexels, Pixabay - Gratis untuk penggunaan komersial
              </p>
            </div>
            
            {/* Image Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredCatalog.map((catalogImg, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectCatalogImage(catalogImg)}
                    className="relative group aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-primary transition-all bg-surface"
                  >
                    <img
                      src={catalogImg.url}
                      alt={catalogImg.alt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-center">
                        <Check className="w-8 h-8 mx-auto mb-1" />
                        <span className="text-sm font-medium">Pilih</span>
                      </div>
                    </div>
                    {/* Source Badge */}
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded-full">
                      {catalogImg.source}
                    </div>
                  </button>
                ))}
              </div>
              
              {filteredCatalog.length === 0 && (
                <div className="text-center py-12 text-text-secondary">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Tidak ada gambar yang cocok</p>
                </div>
              )}
            </div>
            
            {/* Catalog Footer */}
            <div className="p-4 border-t border-border bg-surface/95">
              <p className="text-xs text-text-secondary text-center">
                📸 Semua gambar berlisensi gratis. Klik "Sumber" di post untuk melihat kredit fotografer.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}