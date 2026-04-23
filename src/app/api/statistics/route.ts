import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    // 1. Get total seller (users with role 'seller' or 'farmer')
    // ⚠️ Catatan: Query asli kamu menghitung seller+buyer+admin. 
    // Jika mau cuma seller, hapus 'buyer' dan 'admin'.
    const [seller] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE role IN (?, ?, ?)',
      ['seller', 'buyer', 'admin'] 
    );

    // 2. Get total products (active)
    // Asumsi kolom status tetap 'status'
    const [products] = await pool.execute(
      'SELECT COUNT(*) as count FROM products WHERE status != ?',
      ['deleted']
    );

    // 3. Get total orders
    const [orders] = await pool.execute(
      'SELECT COUNT(*) as count FROM orders WHERE status != ?',
      ['cancelled']
    );

    // 4. Get total sold (sum of sold_count from products)
    // Asumsi kolom sold_count sudah snake_case atau tetap sama
    const [sold] = await pool.execute(
      'SELECT COALESCE(SUM(sold_count), 0) as count FROM products'
    );

    // 5. Get Total Revenue
    // ✅ PERBAIKAN: grandTotal -> grand_total
    const [revenue] = await pool.execute(
      'SELECT COALESCE(SUM(grand_total), 0) as count FROM orders WHERE status = ?',
      ['delivered']
    );

    // 6. Get active cities
    // ✅ PERBAIKAN: addressId -> address_id, a.city -> a.city (jika city sudah snake_case tetap city)
    const [cities] = await pool.execute(`
      SELECT COUNT(DISTINCT a.city) as count 
      FROM orders o
      JOIN address a ON o.address_id = a.id
      WHERE o.status != ?
    `, ['cancelled']);

    // Format response ke Frontend (Tetap pakai camelCase agar frontend tidak error)
    const statistics = {
      totalSeller: (seller as any[])[0]?.count || 0, // Ubah key jadi camelCase konsisten
      totalProducts: (products as any[])[0]?.count || 0,
      totalOrders: (orders as any[])[0]?.count || 0,
      totalSold: (sold as any[])[0]?.count || 0,
      totalRevenue: (revenue as any[])[0]?.count || 0,
      activeCities: (cities as any[])[0]?.count || 0,
    };

    return NextResponse.json({ success: true, data: statistics });

  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    return handleAPIError(error, 'GET /api/statistics');
  }
}