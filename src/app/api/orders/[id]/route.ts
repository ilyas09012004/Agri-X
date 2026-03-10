import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{ id: string }>;
};

// GET: Get single order by ID
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams.id;

    // Verifikasi token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;

    // Validasi orderId
    if (!orderId || isNaN(Number(orderId))) {
      throw new Error('Invalid order ID');
    }

    // Ambil order dari database (pastikan userId match untuk security)
    const [orderRows] = await pool.execute(
      `SELECT o.*, a.detail as address_detail, a.cityId, a.districtId, 
              a.villageCode, a.province, a.zipCode
       FROM orders o
       JOIN address a ON o.addressId = a.id
       WHERE o.id = ? AND o.userId = ?`,
      [orderId, userId]
    );

    if ((orderRows as any[]).length === 0) {
      throw new Error('Order not found');
    }

    const order = (orderRows as any[])[0];

    // Ambil order items
    const [itemsRows] = await pool.execute(
      `SELECT oi.*, p.name as productName, image_path as productImage, p.unit
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       WHERE oi.orderId = ?`,
      [orderId]
    );

    order.orderItems = itemsRows;

    // Format dates to ISO string
    order.createdAt = order.createdAt ? new Date(order.createdAt).toISOString() : null;
    order.updatedAt = order.updatedAt ? new Date(order.updatedAt).toISOString() : null;
    order.paymentDeadline = order.paymentDeadline ? new Date(order.paymentDeadline).toISOString() : null;
    order.paidAt = order.paidAt ? new Date(order.paidAt).toISOString() : null;

    return NextResponse.json({
      success: true,
      order,
    });

  } catch (error: any) {
    console.error('Error fetching order:', error);
    return handleAPIError(error, 'GET /api/orders/[id]');
  }
}