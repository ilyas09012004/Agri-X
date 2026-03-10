// src/components/products.tsx
'use client'; // Jadikan Client Component agar bisa fetch

import React, { useEffect, useState } from 'react';
import { Card, Badge } from './ui'; // Sesuaikan path jika perlu
import Image from 'next/image';
import Link from 'next/link'; // Impor Link
import { Product } from '@/types'; // Pastikan tipe Product sesuai dengan API response

// Definisikan tipe untuk data produk dari API (bisa berbeda dari tipe UI)
// Sesuaikan tipe id dan seller_id menjadi number jika API mengembalikannya sebagai number
interface ApiProduct {
  id: number; // Diubah menjadi number
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  min_order: number;
  seller_id: number; // Diubah menjadi number (jika API mengirim sebagai number)
  harvest_date: string | null;
  image_path: string | null;
  category: string | null;
  status: 'active' | 'inactive' | 'sold_out' | 'deleted';
  created_at: string;
  updated_at: string;
}

// Definisikan tipe untuk data yang digunakan oleh UI (ProductCard)
// Jika Product di types.ts juga menggunakan number untuk id/seller_id, sesuaikan di sana
interface ProductCardProps {
  product: Product; // Gunakan tipe UI
}

// Fungsi untuk mengkonversi data API ke tipe UI
// Konversi id dan seller_id ke string jika UI memerlukan string
const mapApiProductToUIProduct = (apiProduct: ApiProduct): Product => {
  // Konversi number ke string jika diperlukan oleh tipe Product
  const sellerIdForDisplay = String(apiProduct.seller_id); // Konversi ke string
  const farmerName = `Petani ${sellerIdForDisplay.slice(0, 8)}`;

  return {
    // Konversi id ke string untuk UI jika tipe Product.id adalah string
    // Jika tipe Product.id adalah number, maka biarkan seperti ini: id: apiProduct.id,
    id: String(apiProduct.id), // Konversi ke string untuk digunakan di Link href
    name: apiProduct.name,
    description: apiProduct.description,
    price: apiProduct.price,
    unit: apiProduct.unit,
    stock: apiProduct.stock,
    minOrder: apiProduct.min_order,
    farmerName: farmerName, // Dari seller_id (sudah dalam bentuk string)
    harvestDate: apiProduct.harvest_date, // Bisa null
    image: apiProduct.image_path ? `${apiProduct.image_path}` : '/placeholder-image.jpg',
    category: apiProduct.category, // Bisa null
    stockStatus: apiProduct.status, // Gunakan status dari API
    createdAt: apiProduct.created_at,
    updatedAt: apiProduct.updated_at,
  };
};

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  // Tambahkan state untuk imageSrc
  const [imageSrc, setImageSrc] = useState(product.image);

  // Tentukan variant badge berdasarkan status
  const getStatusVariant = () => {
    switch (product.stockStatus) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'secondary';
      case 'sold_out':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Ambil teks badge berdasarkan status
  const getStatusText = () => {
    switch (product.stockStatus) {
      case 'active':
        return 'Ready Stok';
      case 'inactive':
        return 'Tidak Aktif';
      case 'sold_out':
        return 'Habis';
      default:
        return product.stockStatus; // Fallback
    }
  };

  return (
    // Bungkus Card dengan Link ke halaman detail produk
    // Konversi product.id ke string untuk href jika perlu
    <Link href={`/products/${String(product.id)}`} className="block">
      <Card className="w-full max-w-sm cursor-pointer hover:shadow-lg transition-shadow">
        <div className="relative h-48 w-full">
          <Image
            src={imageSrc} // Gunakan state imageSrc
            alt={product.name}
            fill
            className="object-cover"
            onError={() => {
               // Jika gambar gagal dimuat, ubah src ke placeholder
               setImageSrc('/placeholder-image.jpg');
            }}
          />
        </div>

        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
          <p className="text-sm text-gray-describe mt-1">{product.farmerName}</p>
          <div className="mt-2 flex items-center">
            <span className="text-agri-green font-semibold">Rp {product.price.toLocaleString('id-ID')}</span>
            <span className="text-gray-500 text-sm ml-1">/ {product.unit}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant={getStatusVariant()}>{getStatusText()}</Badge>
            {product.minOrder && (
              <span className="text-xs text-gray-500">Min. Order: {product.minOrder} {product.unit}</span>
            )}
            {product.harvestDate && (
              <span className="text-xs text-gray-500">Panen: {new Date(product.harvestDate).toLocaleDateString('id-ID')}</span>
            )}
          </div>
          {/* Tombol opsional dihapus seperti yang kamu komentari */}
        </div>
      </Card>
    </Link>
  );
};

interface ProductListProps {
  initialProducts?: Product[]; // Tambahkan props untuk produk awal (jika perlu SSR)
}

export const ProductList: React.FC<ProductListProps> = ({ initialProducts = [] }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(!initialProducts.length);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/products');

        if (!res.ok) {
          throw new Error(`Failed to fetch products: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Unknown error from API');
        }

        // Konversi data API ke tipe UI
        const uiProducts = data.products.map(mapApiProductToUIProduct); // Gunakan fungsi mapping
        setProducts(uiProducts);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while fetching products.');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    if (initialProducts.length === 0) {
      fetchProducts();
    }
  }, [initialProducts.length]);

  if (loading) {
    return <div>Loading products...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        // Pastikan key tetap unik. Jika product.id adalah number, ini tetap OK.
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};