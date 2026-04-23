// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenServer } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
import { snap } from '@/lib/midtrans';

// ============================================
// GET: Ambil daftar order user
// ============================================
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No token provided', code: 'NO_TOKEN' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessTokenServer(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    const userId = decoded.sub;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let statusCondition = '';
    let queryParams: any[] = [userId];

    // Filter Status
    if (status) {
      switch (status) {
        case 'pending':
          statusCondition = 'AND o.status IN (?, ?)';
          queryParams.push('pending', 'paid');
          break;
        case 'paid':
          statusCondition = 'AND o.status = ?';
          queryParams.push('paid');
          break;
        case 'shipped':
          statusCondition = 'AND o.status = ?';
          queryParams.push('shipped');
          break;
        case 'delivered':
          statusCondition = 'AND o.status = ?';
          queryParams.push('delivered');
          break;
        case 'cancelled':
          statusCondition = 'AND o.status = ?';
          queryParams.push('cancelled');
          break;
        default:
          statusCondition = 'AND o.status != ?';
          queryParams.push('cancelled');
      }
    }

    // ✅ Query menggunakan snake_case (user_id, address_id, dll)
    const [orders] = await pool.execute(`
      SELECT 
        o.id,
        o.user_id,
        o.address_id,
        o.status,
        o.payment_status,
        o.payment_method,
        o.payment_gateway,
        o.va_number,
        o.payment_deadline,
        o.total_product_price,
        o.shipping_cost,
        o.grand_total,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE o.user_id = ? ${statusCondition}
      ORDER BY o.created_at DESC
    `, queryParams);

    const ordersArray = orders as any[];

    // ✅ Fetch details for each order
    const ordersWithDetails = await Promise.all(
      ordersArray.map(async (order) => {
        // 1. Get Order Items
        const [items] = await pool.execute(`
          SELECT 
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.price_at_order,
            oi.quantity,
            p.name as product_name,
            p.image_path as product_image,
            p.unit
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ?
        `, [order.id]);

        // 2. Get Address
        const [addressRows] = await pool.execute(`
          SELECT detail, city, district, village_code, province, zip_code, recipient_name, recipient_phone
          FROM address
          WHERE id = ?
        `, [order.address_id]);

        const address = (addressRows as any[])[0] || {};

        // 3. Get Latest Payment Info
        const [paymentRows] = await pool.execute(`
          SELECT id, method, amount, status, transaction_id, payment_type, created_at
          FROM payment
          WHERE order_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `, [order.id]);

        const payment = (paymentRows as any[])[0] || null;

        return {
          ...order,
          address: {
            detail: address.detail || '',
            city: address.city || '',
            district: address.district || '',
            villageCode: address.village_code || '', // Map ke camelCase untuk frontend jika perlu
            province: address.province || '',
            zipCode: address.zip_code || '',
            recipientName: address.recipient_name || '',
            recipientPhone: address.recipient_phone || '',
          },
          orderItems: Array.isArray(items) ? items.map((item: any) => ({
            ...item,
            price: item.price_at_order,
          })) : [],
          payment: payment,
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: ordersWithDetails,
      count: ordersWithDetails.length,
    });

  } catch (err: any) {
    return handleAPIError(err, 'GET /api/orders');
  }
}

// ============================================
// POST: Buat order baru dengan Midtrans Payment
// ============================================
export async function POST(req: NextRequest) {
  let connection;
  
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessTokenServer(token);
    
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const body = await req.json();

    // ✅ Parse body (support both camelCase & snake_case input)
    const addressId = body.addressId || body.address_id;
    const shippingCost = body.shippingCost || body.shipping_cost || 0;
    const paymentFee = body.paymentFee || body.payment_fee || 0;
    const totalAmount = body.totalAmount || body.total_amount;
    const paymentMethod = body.paymentMethod || body.payment_method || 'cod';
    const paymentGateway = body.paymentGateway || body.payment_gateway || null;
    const items = body.items || body.cartItems || body.products;

    if (!addressId) {
      throw new Error('Address ID is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Cart items are required');
    }

    // ✅ Verify Address Ownership (snake_case columns)
    const [addressCheck] = await pool.execute(
      `SELECT id FROM address WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    );

    if ((addressCheck as any[]).length === 0) {
      throw new Error('Address not found or does not belong to user');
    }

    // ✅ Start Transaction
    connection = await pool.getConnection();
    await connection.query('START TRANSACTION');

    try {
      // 1. Calculate Totals
      const totalProductPrice = items.reduce((sum: number, item: any) => {
        return sum + ((item.price || 0) * (item.quantity || 1));
      }, 0);

      const grandTotal = totalProductPrice + shippingCost + paymentFee;
      const initialPaymentStatus = 'pending';

      // 2. Insert Order (snake_case columns)
      const [orderResult] = await connection.execute(`
        INSERT INTO orders (
          user_id, 
          address_id, 
          status, 
          payment_status,
          payment_method,
          payment_gateway,
          total_product_price, 
          shipping_cost,
          payment_fee,
          grand_total, 
          payment_deadline,
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR), NOW(), NOW())
      `, [
        userId, 
        addressId, 
        'pending',
        initialPaymentStatus,
        paymentMethod,
        paymentGateway,
        totalProductPrice, 
        shippingCost,
        paymentFee,
        grandTotal
      ]);

      const orderId = (orderResult as any).insertId;

      // 3. Process Items & Reduce Stock
      for (const item of items) {
        const productId = item.productId || item.id;
        const price = item.price || 0;
        const quantity = item.quantity || 1;

        // Check Product Availability
        const [productCheck] = await connection.execute(
          `SELECT id, stock, status FROM products WHERE id = ?`,
          [productId]
        );

        const product = (productCheck as any[])[0];
        
        if (!product) {
          throw new Error(`Product ${productId} not found`);
        }

        if (product.status === 'sold_out') {
          throw new Error(`Product ${productId} is sold out`);
        }

        if (product.stock < quantity) {
          throw new Error(`Insufficient stock for product ${productId}. Available: ${product.stock}`);
        }

        // Insert Order Item (snake_case)
        await connection.execute(`
          INSERT INTO order_items (
            order_id, 
            product_id, 
            price_at_order, 
            quantity
          ) VALUES (?, ?, ?, ?)
        `, [orderId, productId, price, quantity]);

        // Update Stock
        await connection.execute(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [quantity, productId]
        );
      }

      // 4. Clear Cart (snake_case)
      await connection.execute(`DELETE FROM cart_items WHERE user_id = ?`, [userId]);

      // 5. Handle Payment (Midtrans or COD)
      let paymentUrl = null;
      let transactionId = null;
      let vaNumber = null;

      if (paymentMethod !== 'cod') {
        // Get User & Address Details for Midtrans (snake_case joins)
        const [orderDetails] = await connection.execute(
          `SELECT 
             u.name as user_name, 
             u.email as user_email,
             a.recipient_phone,
             a.detail as address_detail,
             a.city as address_city,
             a.district as address_district,
             a.village_code as address_village,
             a.province as address_province,
             a.zip_code as address_zip
           FROM orders o
           JOIN users u ON o.user_id = u.id
           JOIN address a ON o.address_id = a.id
           WHERE o.id = ?`,
          [orderId]
        );

        const orderDetailsData = (orderDetails as any[])[0];
        const midtransOrderId = `AGR-${orderId}-${Date.now()}`;

        // Helper for Midtrans Date Format
        const formatMidtransDateTime = (date: Date): string => {
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} +0700`;
        };

        // Midtrans Parameter
        const parameter = {
          transaction_details: {
            order_id: midtransOrderId,
            gross_amount: grandTotal,
          },
          customer_details: {
            first_name: orderDetailsData?.user_name || 'Customer',
            email: orderDetailsData?.user_email || '',
            phone: orderDetailsData?.recipient_phone || '',
            billing_address: {
              first_name: orderDetailsData?.user_name || 'Customer',
              address: orderDetailsData?.address_detail || '',
              city: orderDetailsData?.address_city || '',
              postal_code: orderDetailsData?.address_zip || '',
              phone: orderDetailsData?.recipient_phone || '',
              country_code: 'IDN'
            },
            shipping_address: {
              first_name: orderDetailsData?.user_name || 'Customer',
              address: orderDetailsData?.address_detail || '',
              city: orderDetailsData?.address_city || '',
              postal_code: orderDetailsData?.address_zip || '',
              phone: orderDetailsData?.recipient_phone || '',
              country_code: 'IDN'
            }
          },
          enabled_payments: [paymentGateway === 'qris' ? 'qris' : paymentGateway],
          expiry: {
            start_time: formatMidtransDateTime(new Date()),
            unit: 'hours',
            duration: 24,
          },
          custom_expiry: {
            start_time: formatMidtransDateTime(new Date()),
            unit: 'hours',
            duration: 24,
          }
        };

        // Create Midtrans Transaction
        const snapResponse = await snap.createTransaction(parameter);
        
        paymentUrl = snapResponse.redirect_url;
        transactionId = snapResponse.token;

        if (snapResponse.va_numbers && snapResponse.va_numbers.length > 0) {
          vaNumber = snapResponse.va_numbers[0].va_number;
        }

        // Update Order with Payment Info (snake_case)
        await connection.execute(
          `UPDATE orders SET order_id = ?, payment_url = ?, va_number = ? WHERE id = ?`,
          [transactionId, paymentUrl, vaNumber, orderId]
        );

        // Insert Payment Record (snake_case)
        await connection.execute(
          `INSERT INTO payment (
            order_id, 
            method, 
            amount, 
            status, 
            transaction_id,
            payment_type,
            created_at, 
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [orderId, paymentGateway, grandTotal, 'pending', transactionId, paymentGateway]
        );

      } else {
        // COD Payment Record
        await connection.execute(
          `INSERT INTO payment (
            order_id, 
            method, 
            amount, 
            status, 
            transaction_id,
            payment_type,
            created_at, 
            updated_at
          ) VALUES (?, ?, ?, ?, NULL, NULL, NOW(), NOW())`,
          [orderId, 'cod', grandTotal, 'pending']
        );
      }

      // ✅ Commit Transaction
      await connection.query('COMMIT');

      return NextResponse.json({
        success: true,
        orderId,
        transactionId,
        paymentUrl,
        vaNumber,
        message: paymentMethod === 'cod' 
          ? 'Pesanan berhasil dibuat! Silakan siapkan uang tunai saat barang diterima.' 
          : 'Pesanan berhasil dibuat! Silakan lakukan pembayaran sebelum batas waktu.',
        data: {
          orderId,
          grandTotal,
          itemCount: items.length,
          paymentMethod,
          paymentGateway,
          paymentUrl,
          vaNumber,
          paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }
      });

    } catch (error: any) {
      // ✅ Rollback on Error
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }

  } catch (err: any) {
    // Ensure rollback if connection exists but transaction wasn't committed
    if (connection) {
      try {
        await connection.query('ROLLBACK');
        connection.release();
      } catch (rollbackError) {
        // Ignore rollback error if already rolled back
      }
    }
    return handleAPIError(err, 'POST /api/orders');
  }
}