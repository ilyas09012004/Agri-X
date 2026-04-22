import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Create axios instance
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor untuk menambahkan token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor untuk handle error
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
        document.cookie = 'accessToken=; Path=/; Max-Age=0;';
        document.cookie = 'refreshToken=; Path=/; Max-Age=0;';
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============================================
// API HELPER METHODS
// ============================================

// Product API helpers
export const productAPI = {
  // Get all products with optional filters
  getAll: (params?: {
    category?: string;
    search?: string;
    sort?: 'newest' | 'best_selling' | 'price_asc' | 'price_desc';
    status?: string;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return api.get<{ success: boolean; products: any[] }>(
      `/api/products${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    );
  },

  // Get best selling products
  getBestSellers: (limit: number = 4) => {
    return api.get<{ success: boolean; products: any[] }>(
      `/api/products?sort=best_selling&limit=${limit}`
    );
  },

  // Get product by ID
  getById: (id: number) => {
    return api.get<{ success: boolean; product: any }>(`/api/products/${id}`);
  },

  // Create product
  create: (data: any) => {
    return api.post<{ success: boolean; product: any }>('/api/products', data);
  },

  // Update product
  update: (id: number, data: any) => {
    return api.put<{ success: boolean; product: any }>(`/api/products/${id}`, data);
  },

  // Delete product
  delete: (id: number) => {
    return api.delete<{ success: boolean; message: string }>(`/api/products/${id}`);
  },
};

// Statistics API helpers
export const statisticsAPI = {
  // Get dashboard statistics
  getDashboard: () => {
    return api.get<{ success: boolean; data: any }>('/api/statistics');
  },
};

// Review API helpers
export const reviewAPI = {
  // Get all reviews with optional filters
  getAll: (params?: {
    productId?: number;
    rating?: number;
    isVerified?: boolean;
    limit?: number;
    page?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.productId) queryParams.append('productId', params.productId.toString());
    if (params?.rating) queryParams.append('rating', params.rating.toString());
    if (params?.isVerified !== undefined) queryParams.append('isVerified', params.isVerified.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.page) queryParams.append('page', params.page.toString());

    return api.get<{ success: boolean; reviews: any[] }>(
      `/api/reviews${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    );
  },

  // Get reviews by product ID (for testimonials)
  getByProduct: (productId: number, limit: number = 5) => {
    return api.get<{ success: boolean; reviews: any[] }>(
      `/api/reviews?productId=${productId}&limit=${limit}`
    );
  },

  // Get top rated reviews (for homepage testimonials)
  getTopRated: (limit: number = 5) => {
    return api.get<{ success: boolean; reviews: any[] }>(
      `/api/reviews?rating=5&limit=${limit}&isVerified=true`
    );
  },

  // Create review
  create: (data: { productId: number; rating: number; comment?: string; orderId?: number }) => {
    return api.post<{ success: boolean; review: any }>('/api/reviews', data);
  },
};

// Category API helpers
export const categoryAPI = {
  // Get all category
  getAll: (isActive: boolean = true) => {
    return api.get<{ success: boolean; category: any[] }>(
      `/api/category?is_active=${isActive}`
    );
  },

  // Get category by ID
  getById: (id: number) => {
    return api.get<{ success: boolean; category: any }>(`/api/category/${id}`);
  },

  // Get category by slug
  getBySlug: (slug: string) => {
    return api.get<{ success: boolean; category: any }>(`/api/category/slug/${slug}`);
  },

  // Create category
  create: (data: any) => {
    return api.post<{ success: boolean; category: any }>('/api/category', data);
  },

  // Update category
  update: (id: number, data: any) => {
    return api.put<{ success: boolean; category: any }>(`/api/category/${id}`, data);
  },

  // Delete category
  delete: (id: number) => {
    return api.delete<{ success: boolean; message: string }>(`/api/category/${id}`);
  },
};

// Cart API helpers
export const cartAPI = {
  // Get cart items
  get: () => {
    return api.get<{ success: boolean; formattedCartItems: any[] }>('/api/cart');
  },

  // Add to cart
  add: (productId: number, quantity: number) => {
    return api.post<{ success: boolean; message: string }>('/api/cart', { productId, quantity });
  },

  // Update cart item quantity
  update: (productId: number, quantity: number) => {
    return api.put<{ success: boolean; message: string }>(`/api/cart/${productId}`, { productId, quantity });
  },

  // Remove from cart
  remove: (productId: number) => {
    return api.delete<{ success: boolean; message: string }>(`/api/cart/${productId}`);
  },

  // Clear cart
  clear: () => {
    return api.delete<{ success: boolean; message: string }>('/api/cart/clear');
  },
};

// Order API helpers
export const orderAPI = {
  // Get all orders for user
  getAll: (params?: { status?: string; page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    return api.get<{ success: boolean; orders: any[] }>(
      `/api/orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`
    );
  },

  // Get order by ID
  getById: (id: string) => {
    return api.get<{ success: boolean; order: any }>(`/api/orders/${id}`);
  },

  // Create order
  create: (data: any) => {
    return api.post<{ success: boolean; orderId: string }>('/api/orders', data);
  },

  // Update order status
  updateStatus: (id: string, status: string) => {
    return api.patch<{ success: boolean; order: any }>(`/api/orders/${id}/status`, { status });
  },
};

// Location API helpers (API.CO.ID)
export const locationAPI = {
  // Get provinces
  getProvinces: () => {
    return api.get<{ success: boolean; data: any[] }>('/api/locations/provinces');
  },

  // Get regencies by province
  getRegencies: (provinceId: string) => {
    return api.get<{ success: boolean; data: any[] }>(`/api/locations/regencies/${provinceId}`);
  },

  // Get districts by regency
  getDistricts: (regencyId: string) => {
    return api.get<{ success: boolean; data: any[] }>(`/api/locations/districts/${regencyId}`);
  },

  // Get villages by district
  getVillages: (districtId: string) => {
    return api.get<{ success: boolean; data: any[] }>(`/api/locations/villages/${districtId}`);
  },
};

// Auth API helpers
export const authAPI = {
  // Login
  login: (email: string, password: string) => {
    return api.post<{ success: boolean; token: string; user: any }>('/api/auth/login', { email, password });
  },

  // Register
  register: (data: any) => {
    return api.post<{ success: boolean; token: string; user: any }>('/api/auth/register', data);
  },

  // Logout
  logout: () => {
    return api.post<{ success: boolean; message: string }>('/api/auth/logout');
  },

  // Get current user
  getMe: () => {
    return api.get<{ success: boolean; user: any }>('/api/auth/me');
  },
};

// Export default api instance
export default api;