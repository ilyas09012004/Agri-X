import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    // Get total farmers (users with role 'seller' or 'farmer')
    const [farmers] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE role IN (?, ?)',
      ['seller', 'farmer']
    );

    // Get total products (active)
    const [products] = await pool.execute(
      'SELECT COUNT(*) as count FROM products WHERE status != ?',
      ['deleted']
    );

    // Get total orders
    const [orders] = await pool.execute(
      'SELECT COUNT(*) as count FROM orders WHERE status != ?',
      ['cancelled']
    );

    // Get total sold (sum of sold_count from products)
    const [sold] = await pool.execute(
      'SELECT COALESCE(SUM(sold_count), 0) as count FROM products'
    );

    // ✅ FIX: Gunakan nama kolom yang BENAR (camelCase)
    const [revenue] = await pool.execute(
      'SELECT COALESCE(SUM(grandTotal), 0) as count FROM orders WHERE status = ?',
      ['delivered']
    );

    // Get active cities (unique cityId from addresses in orders)
    const [cities] = await pool.execute(`
      SELECT COUNT(DISTINCT a.cityId) as count 
      FROM orders o
      JOIN address a ON o.addressId = a.id
      WHERE o.status != ?
    `, ['cancelled']);

    const statistics = {
      totalFarmers: (farmers as any[])[0]?.count || 0,
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