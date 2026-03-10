// src/contexts/CartContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface CartItem {
  id: string;
  productId: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: number;
    image?: string;
    stock: number;
    min_order: number;
    status: 'pre_order' | 'ready_stock' | 'sold_out';
    unit: string;
  };
}

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  totalItems: number;
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
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      refreshCart();
    } else {
      setItems([]);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const refreshCart = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const res = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setItems(data.formattedCartItems || []);
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
      
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menambahkan ke keranjang');
      }

      await refreshCart();
    } catch (error: any) {
      throw error;
    }
  };

  const updateQuantity = async (productId: number, quantity: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, quantity }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal update quantity');
      }

      await refreshCart();
    } catch (error: any) {
      throw error;
    }
  };

  const removeFromCart = async (productId: number) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const res = await fetch(`/api/cart/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menghapus dari keranjang');
      }

      await refreshCart();
    } catch (error: any) {
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      await fetch('/api/cart/clear', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setItems([]);
    } catch (error) {
      console.error('Clear cart error:', error);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        isLoading,
        totalItems,
        totalPrice,
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