import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
import { coreApi } from '@/lib/midtrans';

type Params = {
  params: Promise<{ id: string }>;
};

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

    // Ambil order dari database
    const [orderRows] = await pool.execute(
      `SELECT o.*, a.detail as address_detail, a.cityId, a.districtId, a.villageCode, 
              a.province, a.zipCode
       FROM orders o
       JOIN address a ON o.addressId = a.id
       WHERE o.id = ? AND o.userId = ?`,
      [orderId, userId]
    );

    if ((orderRows as any[]).length === 0) {
      throw new Error('Order not found');
    }

    const order = (orderRows as any[])[0];

    // Check payment status dari Midtrans (jika bukan COD)
    if (order.paymentMethod !== 'cod' && order.transactionId && order.paymentStatus !== 'paid') {
      try {
        const midtransStatus = await coreApi.transaction.status(order.transactionId);
        
        let newPaymentStatus = order.paymentStatus;
        let newStatus = order.status;

        if (midtransStatus.transaction_status === 'settlement' || 
            midtransStatus.transaction_status === 'capture') {
          newPaymentStatus = 'paid';
          newStatus = 'paid';
          
          // Update database
          await pool.execute(
            `UPDATE orders SET paymentStatus = ?, status = ?, paidAt = NOW() WHERE id = ?`,
            ['paid', 'paid', orderId]
          );

          // Log payment
          await pool.execute(
            `INSERT INTO payment_logs (orderId, transactionId, paymentMethod, amount, status, response) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [orderId, order.transactionId, order.paymentGateway, order.grandTotal, 'paid', JSON.stringify(midtransStatus)]
          );

          order.paymentStatus = 'paid';
          order.status = 'paid';
        } else if (midtransStatus.transaction_status === 'expire') {
          newPaymentStatus = 'expired';
          newStatus = 'cancelled';
          
          await pool.execute(
            `UPDATE orders SET paymentStatus = ?, status = ? WHERE id = ?`,
            ['expired', 'cancelled', orderId]
          );

          order.paymentStatus = 'expired';
          order.status = 'cancelled';
        } else if (midtransStatus.transaction_status === 'pending') {
          newPaymentStatus = 'waiting_payment';
        }
      } catch (error) {
        console.error('Midtrans status check error:', error);
        // Continue with local status if Midtrans check fails
      }
    }

    // Ambil order items
    const [itemsRows] = await pool.execute(
      `SELECT oi.*, p.name as productName, p.image as productImage 
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       WHERE oi.orderId = ?`,
      [orderId]
    );

    order.orderItems = itemsRows;

    // Format dates
    order.createdAt = order.createdAt ? new Date(order.createdAt).toISOString() : null;
    order.updatedAt = order.updatedAt ? new Date(order.updatedAt).toISOString() : null;
    order.paymentDeadline = order.paymentDeadline ? new Date(order.paymentDeadline).toISOString() : null;
    order.paidAt = order.paidAt ? new Date(order.paidAt).toISOString() : null;

    return NextResponse.json({
      success: true,
      order,
    });

  } catch (error: any) {
    console.error('Error checking payment status:', error);
    return handleAPIError(error, 'GET /api/orders/[id]/payment-status');
  }
}