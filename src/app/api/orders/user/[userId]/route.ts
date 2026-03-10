// src/app/api/orders/user/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenServer } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{ userId: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    const { userId } = resolvedParams;

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessTokenServer(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    // Validasi user hanya bisa akses order sendiri (kecuali admin)
    if (decoded.sub !== userId && decoded.role !== 'admin') {
      throw new Error('Forbidden');
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // Build query berdasarkan status filter
    let statusCondition = '';
    let queryParams: any[] = [userId];

    if (status) {
      switch (status) {
        case 'pending':
          statusCondition = 'AND o.status IN (?, ?)';
          queryParams.push('pending', 'paid');
          break;
        case 'shipped':
          statusCondition = 'AND o.status = ?';
          queryParams.push('shipped');
          break;
        case 'delivered':
          statusCondition = 'AND o.status = ?';
          queryParams.push('delivered');
          break;
        default:
          statusCondition = 'AND o.status != ?';
          queryParams.push('cancelled');
      }
    }

    const [orders] = await pool.execute(`
      SELECT 
        o.id,
        o.userId,
        o.addressId,
        o.status,
        o.total_product_price,
        o.shipping_cost,
        o.grand_total,
        o.payment_method,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE o.userId = ? ${statusCondition}
      ORDER BY o.created_at DESC
    `, queryParams);

    const ordersArray = orders as any[];

    const ordersWithItems = await Promise.all(
      ordersArray.map(async (order) => {
        const [items] = await pool.execute(`
          SELECT 
            oi.id,
            oi.orderId,
            oi.productId,
            oi.price,
            oi.quantity,
            p.name as productName,
            p.image_path as productImage,
            p.unit
          FROM order_items oi
          JOIN products p ON oi.productId = p.id
          WHERE oi.orderId = ?
        `, [order.id]);

        const [addressRows] = await pool.execute(`
          SELECT detail, cityId, districtId, villageCode, province, zipCode
          FROM address
          WHERE id = ?
        `, [order.addressId]);

        const address = (addressRows as any[])[0] || {};

        return {
          ...order,
          address: {
            detail: address.detail || '',
            cityId: address.cityId || '',
            districtId: address.districtId || '',
            villageCode: address.villageCode || '',
            province: address.province || '',
            zipCode: address.zipCode || '',
          },
          orderItems: Array.isArray(items) ? items : [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: ordersWithItems,
      count: ordersWithItems.length,
    });

  } catch (err: any) {
    console.error('Error fetching user orders:', err);
    return handleAPIError(err, 'GET /api/orders/user/[userId]');
  }
}