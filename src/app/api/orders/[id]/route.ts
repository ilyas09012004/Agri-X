  // src/app/api/orders/[id]/route.ts
  import { NextRequest, NextResponse } from 'next/server';
  import pool from '@/lib/db';
  import { verifyAccessToken } from '@/utils/jwt.util';
  import { handleAPIError } from '@/lib/middleware';

  type Params = {
    params: Promise<{ id: string }>;
  };

  // GET: Get single order by ID with payment details
  export async function GET(req: NextRequest, { params }: Params) {
    try {
      const resolvedParams = await params;
      const orderId = resolvedParams.id;

      // Verify token
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

      // Validate orderId
      if (!orderId || isNaN(Number(orderId))) {
        throw new Error('Invalid order ID');
      }

      // ✅ Fetch order with payment details (JOIN with payments table)
      const [orderRows] = await pool.execute(
        `SELECT 
          o.*, 
          a.detail as address_detail, a.city, a.district, a.villageCode, a.province, a.zipCode,
          p.payment_method, p.va_number, p.bank_name, p.transaction_id, 
          p.payment_time, p.payment_deadline, p.status as payment_status
        FROM orders o
        JOIN address a ON o.addressId = a.id
        LEFT JOIN payments p ON o.id = p.order_id
        WHERE o.id = ? AND o.userId = ?`,
        [orderId, userId]
      );

      if ((orderRows as any[]).length === 0) {
        throw new Error('Order not found');
      }

      const order = (orderRows as any[])[0];

      // Fetch order items
      const [itemsRows] = await pool.execute(
        `SELECT oi.*, p.name as productName, p.image_path as productImage, p.unit
        FROM order_items oi
        JOIN products p ON oi.productId = p.id
        WHERE oi.orderId = ?`,
        [orderId]
      );

      // Format dates to ISO string
      const formatIsoDate = (date: any) => date ? new Date(date).toISOString() : null;

      // ✅ Format response with payment details
      const formattedOrder = {
        id: order.id,
        orderId: order.order_id,
        userId: order.userId,
        addressId: order.addressId,
        status: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        paymentGateway: order.payment_gateway,
        paymentFee: order.payment_fee,
        totalProductPrice: order.total_product_price,
        shippingCost: order.shipping_cost,
        grandTotal: order.grand_total,
        vaNumber: order.va_number,
        bankName: order.bank_name,
        transactionId: order.transaction_id,
        paymentDeadline: formatIsoDate(order.payment_deadline),
        paidAt: formatIsoDate(order.payment_time),
        createdAt: formatIsoDate(order.created_at),
        updatedAt: formatIsoDate(order.updated_at),
        address: {
          detail: order.address_detail,
          city: order.city,
          district: order.district,
          villageCode: order.villageCode,
          province: order.province,
          zipCode: order.zipCode,
        },
        orderItems: itemsRows,
      };

      return NextResponse.json({
        success: true,
        order: formattedOrder,
      });

    } catch (error: any) {
      console.error('Error fetching order:', error);
      return handleAPIError(error, 'GET /api/orders/[id]');
    }
  }