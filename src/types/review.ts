export interface Review {
  id: number;
  userId: number;
  productId: number;
  orderId?: number;
  rating: number;
  comment?: string;
  is_verified: boolean;
  user_name: string;
  user_avatar?: string;
  product_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewInput {
  productId: number;
  orderId?: number;
  rating: number;
  comment?: string;
}

export interface ReviewQueryParams {
  productId?: number;
  rating?: number;
  is_verified?: boolean;
  limit?: number;
  page?: number;
}