// src/app/api/orders/user/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessTokenServer } from '@/lib/auth';
import { handleAPIError } from '@/lib/middleware';
import { keysToCamelCase } from '@/lib/utils';

type Params = {
  params: Promise<{ userId: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    const { userId } = resolvedParams;

    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessTokenServer(token);
    if (!decoded || decoded.sub !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // 2. Get Filter Status
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'all';

    // 3. Build Query for Orders
    let statusCondition = '';
    let queryParams: any[] = [userId];

    if (statusFilter !== 'all') {
      statusCondition = 'AND o.status = ?';
      queryParams.push(statusFilter);
    }

    const [orders] = await pool.execute(
      `SELECT 
        o.id, o.user_id, o.address_id, o.status, o.payment_status,
        o.payment_method, o.total_product_price, o.shipping_cost, 
        o.grand_total, o.created_at, o.updated_at
      FROM orders o
      WHERE o.user_id = ? ${statusCondition}
      ORDER BY o.created_at DESC`,
      queryParams
    );

    // 4. Fetch Items & Products for Each Order
    const ordersWithItems = await Promise.all(
      (orders as any[]).map(async (order) => {
        // ✅ Query JOIN untuk ambil data produk terkait
        const [items] = await pool.execute(
          `SELECT 
            oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price, oi.subtotal,
            p.name AS product_name,
            p.image_path AS product_image,
            p.unit AS product_unit
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?`,
          [order.id]
        );

        // Get Address (Optional, jika ingin ditampilkan di list)
        const [addr] = await pool.execute(
          `SELECT recipient_name, detail, city FROM address WHERE id = ?`,
          [order.address_id]
        );

        return {
          ...order,
          address_preview: (addr as any[])[0] || {},
          items: items // ✅ Array produk terkait masuk sini
        };
      })
    );

    // 5. Convert to CamelCase & Response
    return NextResponse.json({
      success: true,
      orders: keysToCamelCase(ordersWithItems)
    });

  } catch (err: any) {
    return handleAPIError(err, 'GET /api/orders/user/[userId]');
  }
}