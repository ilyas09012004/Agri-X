// src/app/api/orders/[id]/payment-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
import { coreApi } from '@/lib/midtrans';

// ✅ Konstanta untuk Status Transaksi Midtrans (Menghilangkan Magic Strings)
const MIDTRANS_STATUS = {
  SETTLEMENT: 'settlement',
  CAPTURE: 'capture',
  PENDING: 'pending',
  EXPIRE: 'expire',
  CANCEL: 'cancel',
  DENY: 'deny',
};

// ✅ Konstanta untuk Status Order Internal
const ORDER_STATUS = {
  PAID: 'paid',
  CANCELLED: 'cancelled',
  WAITING_PAYMENT: 'waiting_payment',
  PENDING: 'pending', // Status awal order
};

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams.id;

    // 1. Verifikasi Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;

    // 2. Ambil Order dari Database (Snake_case)
    // Join dengan address untuk mendapatkan detail alamat pengiriman
    const [orderRows] = await pool.execute(
      `SELECT 
        o.id, o.user_id, o.address_id, o.order_id as external_order_id,
        o.status, o.payment_status, o.payment_method, o.payment_gateway,
        o.va_number, o.payment_deadline, o.total_product_price, 
        o.shipping_cost, o.payment_fee, o.grand_total,
        o.created_at, o.updated_at, o.paid_at,
        a.detail as address_detail, a.city, a.district, a.village_code, 
        a.province, a.zip_code, a.recipient_name, a.recipient_phone
       FROM orders o
       JOIN address a ON o.address_id = a.id
       WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    );

    if ((orderRows as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = (orderRows as any[])[0];

    // 3. Cek Status Pembayaran ke Midtrans (Jika belum lunas & bukan COD)
    if (order.payment_method !== 'cod' && 
        order.payment_status !== ORDER_STATUS.PAID && 
        order.va_number) { // Hanya cek jika ada nomor VA/Transaction ID
        
      try {
        // Gunakan va_number atau transaction_id sebagai referensi ke Midtrans
        const midtransRef = order.va_number || order.external_order_id;
        
        if (midtransRef) {
          const midtransStatus = await coreApi.transaction.status(midtransRef);
          
          let newPaymentStatus = order.payment_status;
          let newOrderStatus = order.status;
          let shouldUpdateDb = false;

          // ✅ Handle Status Sukses
          if (midtransStatus.transaction_status === MIDTRANS_STATUS.SETTLEMENT || 
              midtransStatus.transaction_status === MIDTRANS_STATUS.CAPTURE) {
            
            newPaymentStatus = ORDER_STATUS.PAID;
            newOrderStatus = ORDER_STATUS.PAID;
            shouldUpdateDb = true;

            // Update DB menjadi Paid
            await pool.execute(
              `UPDATE orders 
               SET payment_status = ?, status = ?, paid_at = NOW() 
               WHERE id = ?`,
              [ORDER_STATUS.PAID, ORDER_STATUS.PAID, orderId]
            );

            // Log sukses (Opsional: buat tabel payment_logs jika belum ada)
            // await logPaymentSuccess(orderId, midtransStatus);

          } 
          // ✅ Handle Status Expire
          else if (midtransStatus.transaction_status === MIDTRANS_STATUS.EXPIRE) {
            newPaymentStatus = MIDTRANS_STATUS.EXPIRE;
            newOrderStatus = ORDER_STATUS.CANCELLED;
            shouldUpdateDb = true;

            await pool.execute(
              `UPDATE orders 
               SET payment_status = ?, status = ? 
               WHERE id = ?`,
              [MIDTRANS_STATUS.EXPIRE, ORDER_STATUS.CANCELLED, orderId]
            );
          }
          // ✅ Handle Status Pending
          else if (midtransStatus.transaction_status === MIDTRANS_STATUS.PENDING) {
            newPaymentStatus = ORDER_STATUS.WAITING_PAYMENT;
            // Tidak perlu update DB jika masih pending, biarkan sesuai status awal
          }

          // Update objek order lokal untuk response API
          if (shouldUpdateDb || newPaymentStatus !== order.payment_status) {
             order.payment_status = newPaymentStatus;
             order.status = newOrderStatus;
          }
        }
      } catch (error) {
        console.error('Midtrans status check error:', error);
        // Lanjutkan dengan status lokal jika Midtrans error (fail-safe)
      }
    }

    // 4. Ambil Item Produk (Snake_case)
    const [itemsRows] = await pool.execute(
      `SELECT 
        oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price, oi.subtotal,
        p.name as product_name, p.image_path as product_image, p.unit as product_unit
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // 5. Format Response Data
    const formattedOrder = {
      id: order.id,
      externalOrderId: order.external_order_id,
      userId: order.user_id,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      paymentGateway: order.payment_gateway,
      vaNumber: order.va_number,
      paymentDeadline: order.payment_deadline,
      totalProductPrice: order.total_product_price,
      shippingCost: order.shipping_cost,
      paymentFee: order.payment_fee,
      grandTotal: order.grand_total,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      paidAt: order.paid_at,
      
      // Nested Address Object
      shippingAddress: {
        detail: order.address_detail,
        city: order.city,
        district: order.district,
        villageCode: order.village_code,
        province: order.province,
        zipCode: order.zip_code,
        recipientName: order.recipient_name,
        recipientPhone: order.recipient_phone,
      },

      // Nested Items Array
      items: (itemsRows as any[]).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
        productName: item.product_name,
        productImage: item.product_image,
        productUnit: item.product_unit,
      })),
    };

    return NextResponse.json({
      success: true,
      order: formattedOrder,
    });

  } catch (error: any) {
    return handleAPIError(error, 'GET /api/orders/[id]/payment-status');
  }
}