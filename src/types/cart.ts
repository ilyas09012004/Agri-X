// src/types/cart.ts
export interface CartItem {
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

export interface CartContextType {
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