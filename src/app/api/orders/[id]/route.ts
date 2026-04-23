// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util'; // Pastikan path import benar
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{ id: string }>;
};

// Helper untuk format date ISO string atau null
const formatDate = (date: any) => {
  if (!date) return null;
  try {
    return new Date(date).toISOString();
  } catch (e) {
    return null;
  }
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    // 1. Auth & Validation
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
    const resolvedParams = await params;
    const orderId = resolvedParams.id;

    if (!orderId || isNaN(Number(orderId))) {
      return NextResponse.json({ success: false, error: 'Invalid Order ID' }, { status: 400 });
    }

    // 2. Fetch Order Data with Snake_case Columns
    const [orderRows] = await pool.execute(
      `SELECT 
        o.id,
        o.order_id,
        o.user_id,
        o.address_id,
        o.status,
        o.payment_status,
        o.payment_method,
        o.payment_gateway,
        o.payment_fee,
        o.total_product_price,
        o.shipping_cost,
        o.grand_total,
        o.courier_service,
        o.courier_code,
        o.tracking_number,
        o.created_at,
        o.updated_at,
        -- Payment Details (from payments table)
        p.va_number,
        p.bank_name,
        p.transaction_id,
        p.payment_deadline,
        p.paid_at,
        -- Address Details (from address table)
        a.detail AS address_detail,
        a.city,
        a.district,
        a.village_code,
        a.province,
        a.zip_code,
        a.recipient_name,
        a.recipient_phone
      FROM orders o
      LEFT JOIN address a ON o.address_id = a.id
      LEFT JOIN payment p ON o.id = p.order_id
      WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    );

    if ((orderRows as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = (orderRows as any)[0];

    // 3. Fetch Order Items
    const [itemsRows] = await pool.execute(
      `SELECT 
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.quantity,
        oi.price,
        oi.subtotal,
        p.name AS product_name,
        p.image_path AS product_image,
        p.unit AS product_unit
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?`,
      [orderId]
    );

    // 4. Format Response to CamelCase for Frontend
    const formattedOrder = {
      id: order.id,
      orderId: order.order_id,
      userId: order.user_id,
      addressId: order.address_id,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      paymentGateway: order.payment_gateway,
      
      // ✅ Konversi ke Number agar aman di frontend
      paymentFee: Number(order.payment_fee) || 0,
      totalProductPrice: Number(order.total_product_price) || 0,
      shippingCost: Number(order.shipping_cost) || 0,
      grandTotal: Number(order.grand_total) || 0,
      
      // Courier Info
      courierService: order.courier_service,
      courierCode: order.courier_code,
      trackingNumber: order.tracking_number,
      
      // Payment Info
      vaNumber: order.va_number,
      bankName: order.bank_name,
      transactionId: order.transaction_id,
      paymentDeadline: formatDate(order.payment_deadline),
      paidAt: formatDate(order.paid_at),
      
      // Timestamps
      createdAt: formatDate(order.created_at),
      updatedAt: formatDate(order.updated_at),
      
      // Address Object
      address: {
        detail: order.address_detail,
        city: order.city,
        district: order.district,
        villageCode: order.village_code,
        province: order.province,
        zipCode: order.zip_code,
        recipientName: order.recipient_name,
        recipientPhone: order.recipient_phone,
      },
      
      // ✅ Items Array dengan Mapping Manual & Type Conversion
      items: (itemsRows as any[]).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        quantity: Number(item.quantity),   // ✅ Penting: Convert ke Number
        price: Number(item.price),         // ✅ Penting: Harga Satuan (Number)
        subtotal: Number(item.subtotal),   // ✅ Penting: Total per Item (Number)
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
    return handleAPIError(error, 'GET /api/orders/[id]');
  }
}