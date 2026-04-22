// src/app/api/payment/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { NotificationService } from '@/lib/notification.service';

// ✅ Verify Midtrans signature
function verifyMidtransSignature(payload: any): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    console.error('MIDTRANS_SERVER_KEY not configured');
    return false;
  }
  
  const signature = payload.signature_key;
  const orderId = payload.order_id;
  const statusCode = payload.status_code;
  const grossAmount = payload.gross_amount;
  
  const input = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const expectedSignature = crypto.createHash('sha512').update(input).digest('hex');
  
  return signature === expectedSignature;
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    
    // ✅ 1. Verify webhook signature (CRITICAL for security)
    if (!verifyMidtransSignature(payload)) {
      console.error('Invalid Midtrans signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { 
      order_id, 
      transaction_status, 
      transaction_time,
      gross_amount,
      payment_type,
      va_numbers,
      status_message,
      fraud_status,
    } = payload;

    // ✅ 2. Get order details
    const [orders] = await pool.execute(
      `SELECT 
        o.id, o.user_id, o.order_id, o.total_amount, o.status,
        u.name as user_name, u.email as user_email
      FROM orders o
      INNER JOIN users u ON o.user_id = u.id
      WHERE o.order_id = ? AND o.is_deleted = FALSE`,
      [order_id]
    );
    
    const order = (orders as any[])[0];
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ✅ 3. Determine payment & order status
    let paymentStatus = 'pending';
    let orderStatus = order.status;
    
    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      paymentStatus = 'success';
      orderStatus = 'paid';
    } else if (transaction_status === 'expire' || transaction_status === 'cancel') {
      paymentStatus = 'failed';
      orderStatus = 'cancelled';
    } else if (transaction_status === 'deny') {
      paymentStatus = 'failed';
    }

    // ✅ 4. Update payments table with ACTUAL payment method from Midtrans (source of truth)
    await pool.execute(
      `UPDATE payments 
       SET status = ?, 
           payment_method = ?,
           va_number = ?,
           bank_name = ?,
           transaction_id = ?,
           payment_time = ?,
           updated_at = CURRENT_TIMESTAMP(3)
       WHERE order_id = ?`,
      [
        paymentStatus,
        payment_type,
        va_numbers?.[0]?.va_number || null,
        va_numbers?.[0]?.bank || null,
        payload.transaction_id,
        transaction_time,
        order_id,
      ]
    );

    // ✅ 5. Update order status
    await pool.execute(
      `UPDATE orders 
       SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP(3)
       WHERE order_id = ?`,
      [orderStatus, paymentStatus, order_id]
    );

    // ✅ 6. Send notification based on payment status
    if (paymentStatus === 'success') {
      await NotificationService.send({
        userId: order.user_id,
        type: 'payment',
        templateCode: 'payment_success',
        variables: {
          order_id: order_id,
          amount: gross_amount,
          payment_method: payment_type,
          transaction_time: transaction_time,
          user_name: order.user_name,
        },
        actionType: 'payment_success',
        referenceId: order.id.toString(),
        customLink: `/orders/${order_id}`,
      });
    } else if (paymentStatus === 'failed') {
      await NotificationService.send({
        userId: order.user_id,
        type: 'payment',
        templateCode: 'payment_failed',
        variables: {
          order_id: order_id,
          amount: gross_amount,
          reason: status_message || 'Pembayaran ditolak',
          user_name: order.user_name,
        },
        actionType: 'payment_failed',
        referenceId: order.id.toString(),
        customLink: `/orders/${order_id}`,
      });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Payment callback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}