export interface Category {
  id: number;
  name: string;
  slug: string;
  description_category?: string;
  icon?: string;        // Lucide React icon name
  color?: string;       // Tailwind color class
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryInput {
  name: string;
  slug: string;
  description_category?: string;
  icon?: string;
  color?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface CategoryWithCount extends Category {
  product_count: number;
}