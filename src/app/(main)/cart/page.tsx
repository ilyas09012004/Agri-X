// src/app/(main)/cart/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Minus, Plus, ShoppingCart, Loader2 } from 'lucide-react';
import { getCookie } from '@/lib/auth';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';


export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { totalItems } = useCart();
  const { totalPrice } = useCart();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // ✅ AMBIL TOKEN DARI COOKIE DAN LOCALSTORAGE
      const token = getCookie('accessToken') || localStorage.getItem('accessToken');
      
      console.log('=== FETCH CART DEBUG ===');
      console.log('Token from cookie:', getCookie('accessToken') ? 'EXISTS' : 'MISSING');
      console.log('Token from localStorage:', localStorage.getItem('accessToken') ? 'EXISTS' : 'MISSING');
      console.log('Token length:', token?.length);
      console.log('=========================');
      
      if (!token) {
        setError('Silakan login terlebih dahulu');
        router.push('/login?callbackUrl=/cart');
        return;
      }

      const res = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`, // ✅ KIRIM TOKEN DI HEADER
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json();
        
        if (res.status === 401) {
          setError('Sesi expired. Silakan login kembali.');
          router.push('/login?callbackUrl=/cart');
          return;
        }
        
        throw new Error(errorData.error || 'Gagal mengambil data keranjang');
      }

      const data = await res.json();
      console.log('Cart data:', data);
      setItems(data.formattedCartItems || []);
    } catch (err: any) {
      console.error('Fetch cart error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  // ✅ Dalam handleUpdateQuantity, gunakan productId untuk endpoint
  const handleUpdateQuantity = async (productId: number, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setIsUpdating(productId);
    setError(null);
    
    try {
      const token = getCookie('accessToken') || localStorage.getItem('accessToken');
      
      console.log('=== UPDATE QUANTITY DEBUG ===');
      console.log('productId:', productId);
      console.log('newQuantity:', newQuantity);
      console.log('token:', token ? 'EXISTS' : 'MISSING');
      console.log('==============================');
      
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId,
          quantity: newQuantity,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal update quantity');
      }

      // Update local state
      setItems(prevItems =>
        prevItems.map(item =>
          item.productId === productId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
      
      // ✅ Toast sukses update quantity (opsional, untuk feedback)
      toast.success('✅ Quantity diperbarui', {
        duration: 2000,
        position: 'bottom-right',
        style: {
          background: '#10B981',
          color: '#fff',
        },
      });
      
    } catch (err: any) {
      console.error('Update quantity error:', err);
      setError(err.message);
      
      // ❌ alert(err.message);
      // ✅ Ganti dengan toast.error yang user-friendly
      const errorMessage = err.message || 'Gagal memperbarui quantity';
      
      if (errorMessage.includes('Kuota') || errorMessage.includes('quota')) {
        toast.error('😔 Kuota Pre-Order sudah habis', {
          duration: 4000,
          position: 'bottom-right',
          style: {
            background: '#F59E0B',
            color: '#fff',
          },
          action: {
            label: 'Kurangi Quantity',
            onClick: () => {
              // Auto-adjust ke quantity maksimal yang tersedia
              setItems(prev => prev.map(item => 
                item.productId === productId 
                  ? { ...item, quantity: Math.max(item.product.min_order, item.product.stock) }
                  : item
              ));
            },
          },
        });
      } 
      else if (errorMessage.includes('stok') || errorMessage.includes('stock')) {
        toast.error('❌ Stok tidak mencukupi', {
          duration: 4000,
          position: 'bottom-right',
          style: {
            background: '#EF4444',
            color: '#fff',
          },
          action: {
            label: 'Ambil Stok Tersisa',
            onClick: () => {
              // TODO: Auto-adjust quantity
            },
          },
        });
      }
      else {
        toast.error(`❌ ${errorMessage}`, {
          duration: 4000,
          position: 'bottom-right',
          style: {
            background: '#EF4444',
            color: '#fff',
          },
        });
      }
      
    } finally {
      setIsUpdating(null);
    }
  };
  // ✅ Dalam handleRemove, gunakan productId untuk endpoint
  const handleRemove = async (productId: number) => {
    try {
      const token = getCookie('accessToken') || localStorage.getItem('accessToken');
      
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Gagal menghapus produk');
      }

      // ✅ Update local state
      setItems(prevItems => prevItems.filter(item => item.productId !== productId));
      
      // ✅ Toast sukses (tanpa Undo)
      toast.success('✅ Produk dihapus dari keranjang', {
        duration: 2500, // Lebih singkat karena tidak ada action
        position: 'bottom-right',
        style: {
          background: '#10B981',
          color: '#fff',
        },
      });
      
    } catch (err: any) {
      console.error('Remove item error:', err);
      setError(err.message);
      
      toast.error(`❌ ${err.message}`, {
        duration: 4000,
        position: 'bottom-right',
        style: {
          background: '#EF4444',
          color: '#fff',
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingCart className="w-24 h-24 mx-auto text-text-secondary mb-4" />
        <h2 className="text-2xl font-bold text-text-primary mb-2">Error</h2>
        <p className="text-text-secondary mb-6">{error}</p>
        <button onClick={() => router.push('/login')} className="btn-primary">
          Login
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingCart className="w-24 h-24 mx-auto text-text-secondary mb-4" />
        <h2 className="text-2xl font-bold text-text-primary mb-2">Keranjang Kosong</h2>
        <p className="text-text-secondary mb-6">Mulai belanja produk pertanian terbaik</p>
        <button onClick={() => router.push('/katalog')} className="btn-primary">
          Belanja Sekarang
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-screen pb-20">
      <h1 className="text-3xl font-bold text-text-primary mb-6">Keranjang Belanja</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-6">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="card flex gap-4">
              <div className="w-24 h-24 bg-gradient-to-br from-secondary/20 to-primary/20 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                {item.product.image_path ? (
                  <img src={item.product.image_path} alt={item.product.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span>🌾</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary mb-1">{item.product.name}</h3>
                <p className="text-primary font-bold mb-2">
                  {formatCurrency(item.product.price)} / {item.product.unit}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                      disabled={isUpdating === item.productId || item.quantity <= item.product.min_order}
                      className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                    >
                      {isUpdating === item.productId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Minus className="w-4 h-4" />
                      )}
                    </button>
                    <span className="w-12 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                      disabled={isUpdating === item.productId || item.quantity >= item.product.stock}
                      className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                    >
                      {isUpdating === item.productId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <button
                    onClick={() => handleRemove(item.productId)}
                    className="text-red-500 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">
                  {formatCurrency(item.product.price * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="card sticky top-20">
            <h2 className="text-xl font-bold text-text-primary mb-4">Ringkasan Pesanan</h2>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-text-secondary">
                <span>Total Item</span>
                <span>{totalItems} produk</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Ongkos Kirim</span>
                <button onClick={() => router.push('/checkout')} className="text-primary hover:underline">
                  Hitung di Checkout
                </button>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-lg font-bold text-text-primary">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(totalPrice)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push('/checkout')}
              className="btn-primary w-full"
            >
              Lanjut ke Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}