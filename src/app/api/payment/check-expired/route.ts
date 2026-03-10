import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST() {
  try {
    // Cari order yang expired
    const [expiredOrders] = await pool.execute(
      `SELECT id FROM orders 
       WHERE paymentStatus IN ('pending', 'waiting_payment') 
       AND paymentDeadline < NOW()`
    );

    for (const order of expiredOrders as any[]) {
      // Update order status
      await pool.execute(
        `UPDATE orders SET status = 'cancelled', paymentStatus = 'expired' WHERE id = ?`,
        [order.id]
      );

      // Update payment status
      await pool.execute(
        `UPDATE payment SET status = 'expired', updatedAt = NOW() WHERE ordersId = ?`,
        [order.id]
      );

      // Kembalikan stok produk
      await pool.execute(
        `UPDATE products p
         INNER JOIN order_items oi ON p.id = oi.productId
         SET p.stock = p.stock + oi.quantity
         WHERE oi.orderId = ?`,
        [order.id]
      );

      console.log(`Order ${order.id} cancelled due to payment expiry`);
    }

    return NextResponse.json({ 
      success: true, 
      cancelledOrders: (expiredOrders as any[]).length 
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}