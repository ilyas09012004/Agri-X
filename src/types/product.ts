export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  unit: string;
  stock: number;
  sold_count: number;
  origin_village_code?: string;
  min_order: number;
  seller_id: number;
  harvest_date?: string;
  image_path?: string;
  category_id?: number;      // ✅ Tambah ini
  category?: string;          // ✅ Keep untuk backward compatibility
  status: 'pre_order' | 'ready_stock' | 'sold_out' | 'deleted';
  rating?: number;
  reviews?: number;
  badge?: 'Terlaris' | 'Baru';
  created_at?: string;
  updated_at?: string;
}