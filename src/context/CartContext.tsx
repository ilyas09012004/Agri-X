'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// ✅ Interface Item Produk (sesuai response API)
interface Product {
  id: number;
  name: string;
  price: number;
  image_path?: string;
  stock: number;
  min_order: number;
  status: 'pre_order' | 'ready_stock' | 'sold_out' | 'inactive';
  unit: string;
}

// ✅ Interface Item Keranjang
export interface CartItem {
  id: number;          // ID dari tabel cart_items
  productId: number;   // ID Produk
  quantity: number;
  product: Product;    // Detail Produk (Nested Object)
}

// ✅ Interface Response API Cart
interface CartResponse {
  success: boolean;
  formattedCartItems: CartItem[];
  totalItems: number;      // Jumlah jenis produk
  totalQuantity: number;   // Total semua quantity
  totalPrice: number;      // Total harga final
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  totalItems: number;        
  totalQuantity: number;     
  totalPrice: number;        
  addToCart: (productId: number, quantity: number) => Promise<void>;
  updateQuantity: (productId: number, quantity: number) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State untuk menyimpan ringkasan total dari API (agar konsisten)
  const [summary, setSummary] = useState({
    totalItems: 0,
    totalQuantity: 0,
    totalPrice: 0
  });

  const { isAuthenticated } = useAuth();

  // ✅ Load cart saat user login
  useEffect(() => {
    if (isAuthenticated) {
      refreshCart();
    } else {
      setItems([]);
      setSummary({ totalItems: 0, totalQuantity: 0, totalPrice: 0 });
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const refreshCart = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setItems([]);
        return;
      }
      
      const res = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data: CartResponse = await res.json();
        
        // ✅ Gunakan data langsung dari API (sudah terformat & dihitung backend)
        setItems(data.formattedCartItems || []);
        setSummary({
          totalItems: data.totalItems || 0,
          totalQuantity: data.totalQuantity || 0,
          totalPrice: data.totalPrice || 0
        });
      } else {
        // Jika error (misal 401), kosongkan cart
        setItems([]);
      }
    } catch (error) {
      console.error('Refresh cart error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = async (productId: number, quantity: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('User not authenticated');
      
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menambahkan ke keranjang');
      }

      // ✅ Refresh cart untuk mendapatkan data terbaru & total yang akurat
      await refreshCart();
    } catch (error: any) {
      throw error; // Lempar error ke komponen pemanggil (untuk ditampilkan alert)
    }
  };

  const updateQuantity = async (productId: number, quantity: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('User not authenticated');
      
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ quantity }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal update quantity');
      }

      await refreshCart();
    } catch (error: any) {
      throw error;
    }
  };

  const removeFromCart = async (productId: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('User not authenticated');
      
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghapus dari keranjang');
      }

      await refreshCart();
    } catch (error: any) {
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      
      // Asumsi endpoint clear cart ada di /api/cart?clear=true atau method khusus
      // Jika belum ada endpoint khusus, bisa loop removeFromCart atau buat endpoint baru
      await fetch('/api/cart?clear=true', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setItems([]);
      setSummary({ totalItems: 0, totalQuantity: 0, totalPrice: 0 });
    } catch (error) {
      console.error('Clear cart error:', error);
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        totalItems: summary.totalItems,
        totalQuantity: summary.totalQuantity,
        totalPrice: summary.totalPrice,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}