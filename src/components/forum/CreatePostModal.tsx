'use client';

import { useState } from 'react';
import { X, Plus, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';

interface CreatePostModalProps {
  onClose: () => void;
  onSuccess: () => void;
  categories: Array<{ id: number; name: string; slug: string }>;
}

// ✅ Placeholder untuk preview error
const PREVIEW_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"%3E%3Crect fill="%23f5f9f4" width="200" height="200"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="12" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EGambar error%3C/text%3E%3C/svg%3E';

export function CreatePostModal({ onClose, onSuccess, categories }: CreatePostModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [images, setImages] = useState<Array<{ url: string; file: File }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      alert(`Maksimal ${5} gambar. ${files.length - remainingSlots} gambar tidak akan diupload.`);
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const token = localStorage.getItem('accessToken');
      
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        
        // Validate file
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Format ${file.name} tidak didukung`);
        }
        
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          throw new Error(`${file.name} melebihi 5MB`);
        }

        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        
        // Add to state immediately for preview
        setImages(prev => [...prev, { url: previewUrl, file }]);
        
        // Upload to server (optional - can upload on submit instead)
        // For now, we'll upload on submit to reduce API calls
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      }
      
    } catch (err: any) {
      setError(err.message || 'Gagal upload gambar');
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const image = images[index];
    // Revoke object URL to prevent memory leak
    if (image.url.startsWith('blob:')) {
      URL.revokeObjectURL(image.url);
    }
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validasi
    if (title.length < 10) {
      setError('Judul minimal 10 karakter');
      return;
    }
    if (content.length < 20) {
      setError('Isi diskusi minimal 20 karakter');
      return;
    }
    if (!categoryId) {
      setError('Pilih kategori');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      
      // Upload images first if any
      let imageUrls: string[] = [];
      
      if (images.length > 0) {
        const uploadPromises = images.map(async ({ file }) => {
          const formData = new FormData();
          formData.append('image', file);

          const res = await fetch('/api/forum/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Gagal upload gambar');
          }

          const data = await res.json();
          return data.imageUrl;
        });

        imageUrls = await Promise.all(uploadPromises);
      }

      // Create post
      const res = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content,
          categoryId: parseInt(categoryId),
          images: imageUrls,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal membuat diskusi');
      }

      // Cleanup object URLs
      images.forEach(({ url }) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });

      onSuccess();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cleanup on unmount
  const handleClose = () => {
    images.forEach(({ url }) => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
      <div className="bg-background rounded-t-3xl md:rounded-3xl w-full max-w-lg p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-text-primary">Buat Diskusi Baru</h2>
          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </div>
          )}

          {/* Judul */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Judul Topik *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masukkan judul diskusi..."
              className="input"
              maxLength={255}
              required
            />
            <p className="text-xs text-text-secondary mt-1">
              {title.length}/255 karakter (min 10)
            </p>
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Kategori *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input"
              required
            >
              <option value="">Pilih Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Isi */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Isi Diskusi *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tuliskan isi diskusi Anda..."
              rows={5}
              className="input"
              maxLength={5000}
              required
            />
            <p className="text-xs text-text-secondary mt-1">
              {content.length}/5000 karakter (min 20)
            </p>
          </div>

          {/* ✅ Upload Gambar */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Upload Gambar (Opsional)
            </label>
            
            {/* Preview Grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img.url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PREVIEW_PLACEHOLDER;
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-lg hover:bg-red-600 transition-colors"
                      aria-label="Hapus gambar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    {/* Loading overlay */}
                    {isUploading && index === images.length - 1 && (
                      <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <label className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              isUploading 
                ? 'border-primary/50 bg-primary/5' 
                : 'border-border hover:border-primary hover:bg-primary/5'
            } ${images.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-sm text-primary">Mengupload... {uploadProgress}%</span>
                </>
              ) : images.length >= 5 ? (
                <span className="text-sm text-text-secondary">Maksimal 5 gambar tercapai</span>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5 text-text-secondary" />
                  <span className="text-sm text-text-secondary">Tambah Gambar (max 5MB)</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                multiple
                disabled={isUploading || images.length >= 5}
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
              onClick={handleClose}
              className="btn-outline flex-1"
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memposting...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span>Posting Diskusi</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}