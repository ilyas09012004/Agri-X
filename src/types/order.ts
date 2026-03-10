export interface Order {
  id: string;
  userId: string;
  addressId: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  total_product_price: number;
  shipping_cost: number;
  grand_total: number;
  payment_method: string;
  created_at: string;
  updated_at: string;
  address: {
    detail: string;
    cityId: string;
    districtId: string;
    villageCode: string;
    province: string;
    zipCode: string;
  };
  orderItems: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: number;
  productName: string;
  productImage?: string;
  price: number;
  quantity: number;
}

export interface OrderInput {
  addressId: number;
  shippingOption: number;
  paymentMethod: string;
  totalAmount: number;
}