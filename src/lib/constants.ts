export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export const PRODUCT_STATUS = {
  PRE_ORDER: 'pre_order',
  READY_STOCK: 'ready_stock',
  SOLD_OUT: 'sold_out',
  DELETED: 'deleted',
} as const;

export const USER_ROLE = {
  BUYER: 'buyer',
  SELLER: 'seller',
  ADMIN: 'admin',
} as const;

export const PAYMENT_METHODS = {
  COD: 'cod',
  TRANSFER: 'transfer',
  EWALLET: 'ewallet',
} as const;

export const CATEGORIES = [
  { id: 'sayuran', name: 'Sayuran', icon: '🥬' },
  { id: 'buah', name: 'Buah-buahan', icon: '🍎' },
  { id: 'biji', name: 'Biji-bijian', icon: '🌾' },
  { id: 'umbi', name: 'Umbi-umbian', icon: '🥔' },
  { id: 'herbal', name: 'Herbal', icon: '🌿' },
];

export const SHIPPING_COURIERS = [
  { id: 'jne', name: 'JNE', logo: '📦' },
  { id: 'jnt', name: 'J&T Express', logo: '🚚' },
  { id: 'sicepat', name: 'SiCepat', logo: '📬' },
  { id: 'lion', name: 'Lion Parcel', logo: '🦁' },
];