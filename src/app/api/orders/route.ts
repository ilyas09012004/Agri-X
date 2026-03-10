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
    
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return NextResponse.json(
        { success: false, error: 'Invalid token format', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

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

    const [orders] = await pool.execute(`
      SELECT 
        o.id,
        o.userId,
        o.addressId,
        o.status,
        o.paymentStatus,
        o.paymentMethod,
        o.paymentGateway,
        o.vaNumber,
        o.paymentDeadline,
        o.totalProductPrice,
        o.shippingCost,
        o.grandTotal,
        o.createdAt,
        o.updatedAt
      FROM orders o
      WHERE o.userId = ? ${statusCondition}
      ORDER BY o.createdAt DESC
    `, queryParams);

    const ordersArray = orders as any[];

    const ordersWithItems = await Promise.all(
      ordersArray.map(async (order) => {
        const [items] = await pool.execute(`
          SELECT 
            oi.id,
            oi.orderId,
            oi.productId,
            oi.priceAtOrder,
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

        // ✅ Ambil info payment dari tabel payment
        const [paymentRows] = await pool.execute(`
          SELECT id, method, amount, status, transaction_id, paymentType, createdAt
          FROM payment
          WHERE ordersId = ?
          ORDER BY createdAt DESC
          LIMIT 1
        `, [order.id]);

        const payment = (paymentRows as any[])[0] || null;

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
          orderItems: Array.isArray(items) ? items.map((item: any) => ({
            ...item,
            price: item.priceAtOrder,
          })) : [],
          payment: payment,
        };
      })
    );

    return NextResponse.json({
      success: true,
      orders: ordersWithItems,
      count: ordersWithItems.length,
    });

  } catch (err: any) {
    console.error('Error fetching orders:', err);
    return handleAPIError(err, 'GET /api/orders');
  }
}

// ============================================
// POST: Buat order baru dengan Midtrans Payment
// ============================================
export async function POST(req: NextRequest) {
  let connection;
  
  try {
    console.log('=== ORDER API CALLED ===');
    
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header:', authHeader ? 'EXISTS' : 'MISSING');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No auth header');
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    console.log('Token:', token ? token.substring(0, 20) + '...' : 'MISSING');
    
    const decoded = verifyAccessTokenServer(token);
    console.log('Decoded token:', decoded);
    
    if (!decoded) {
      console.log('Invalid token');
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    console.log('userId:', userId);

    const body = await req.json();
    console.log('Request body:', JSON.stringify(body, null, 2));

    // ✅ Parse body dengan flexible field names
    const addressId = body.addressId || body.address_id;
    const shippingCost = body.shippingCost || body.shipping_cost || 0;
    const paymentFee = body.paymentFee || body.payment_fee || 0;
    const totalAmount = body.totalAmount || body.total_amount;
    const paymentMethod = body.paymentMethod || body.payment_method || 'cod';
    const paymentGateway = body.paymentGateway || body.payment_gateway || null;
    const items = body.items || body.cartItems || body.products;

    console.log('Parsed data:');
    console.log('  addressId:', addressId);
    console.log('  shippingCost:', shippingCost);
    console.log('  paymentFee:', paymentFee);
    console.log('  totalAmount:', totalAmount);
    console.log('  paymentMethod:', paymentMethod);
    console.log('  paymentGateway:', paymentGateway);
    console.log('  items:', items);
    console.log('  items.length:', items?.length);

    if (!addressId) {
      console.log('Missing addressId');
      throw new Error('Address ID is required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('Missing or empty items');
      throw new Error('Cart items are required');
    }

    console.log('Checking address ownership...');
    const [addressCheck] = await pool.execute(
      `SELECT id FROM address WHERE id = ? AND userId = ?`,
      [addressId, userId]
    );

    console.log('Address check result:', addressCheck);

    if ((addressCheck as any[]).length === 0) {
      console.log('Address not found or does not belong to user');
      throw new Error('Address not found or does not belong to user');
    }

    console.log('Getting connection for transaction...');
    connection = await pool.getConnection();
    
    console.log('Starting transaction...');
    await connection.query('START TRANSACTION');

    try {
      // ✅ Hitung total dari items
      const totalProductPrice = items.reduce((sum: number, item: any) => {
        return sum + ((item.price || 0) * (item.quantity || 1));
      }, 0);

      const grandTotal = totalProductPrice + shippingCost + paymentFee;

      console.log('Calculated totals:');
      console.log('  totalProductPrice:', totalProductPrice);
      console.log('  shippingCost:', shippingCost);
      console.log('  paymentFee:', paymentFee);
      console.log('  grandTotal:', grandTotal);

      // ✅ Tentukan paymentStatus awal
      const initialPaymentStatus = paymentMethod === 'cod' ? 'pending' : 'pending';

      console.log('Inserting order...');
      const [orderResult] = await connection.execute(`
        INSERT INTO orders (
          userId, 
          addressId, 
          status, 
          paymentStatus,
          paymentMethod,
          paymentGateway,
          totalProductPrice, 
          shippingCost,
          paymentFee,
          grandTotal, 
          paymentDeadline,
          createdAt, 
          updatedAt
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
      console.log('Order created with ID:', orderId);

      // ✅ Proses items & kurangi stok
      for (const item of items) {
        const productId = item.productId || item.id;
        const price = item.price || 0;
        const quantity = item.quantity || 1;

        console.log('Processing item:', { productId, price, quantity });

        const [productCheck] = await connection.execute(
          `SELECT id, stock, status FROM products WHERE id = ?`,
          [productId]
        );

        const product = (productCheck as any[])[0];
        console.log('Product check:', product);
        
        if (!product) {
          throw new Error(`Product ${productId} not found`);
        }

        if (product.status === 'sold_out') {
          throw new Error(`Product ${productId} is sold out`);
        }

        if (product.stock < quantity) {
          throw new Error(`Insufficient stock for product ${productId}. Available: ${product.stock}`);
        }

        await connection.execute(`
          INSERT INTO order_items (
            orderId, 
            productId, 
            priceAtOrder, 
            quantity
          ) VALUES (?, ?, ?, ?)
        `, [orderId, productId, price, quantity]);

        await connection.execute(
          `UPDATE products SET stock = stock - ? WHERE id = ?`,
          [quantity, productId]
        );

        console.log('Item processed:', productId);
      }

      // ✅ Clear cart
      await connection.execute(`DELETE FROM cartitems WHERE userId = ?`, [userId]);
      console.log('Cart cleared for user:', userId);

      // ✅ Generate Payment URL via Midtrans (jika bukan COD)
      let paymentUrl = null;
      let transactionId = null;
      let vaNumber = null;

      if (paymentMethod !== 'cod') {
        console.log('Generating Midtrans payment URL...');
        
        // Ambil data user untuk Midtrans
        const [userRows] = await connection.execute(
          `SELECT name, email, phone FROM users WHERE id = ?`,
          [userId]
        );
        const userData = (userRows as any[])[0];

        // Format order_id untuk Midtrans
        const midtransOrderId = `AGR-${orderId}-${Date.now()}`;

        // Parameter untuk Midtrans Snap
        const parameter = {
          transaction_details: {
            order_id: midtransOrderId,
            gross_amount: grandTotal,
          },
          customer_details: {
            first_name: userData?.name || 'Customer',
            email: userData?.email || '',
            phone: userData?.phone || '',
          },
          enabled_payments: [paymentGateway === 'qris' ? 'qris' : paymentGateway],
          expiry: {
            start_time: new Date().toISOString(),
            unit: 'hours',
            duration: 24,
          },
        };

        console.log('Midtrans parameter:', JSON.stringify(parameter, null, 2));

        // Generate Snap Token
        const snapResponse = await snap.createTransaction(parameter);
        console.log('Midtrans response:', snapResponse);

        paymentUrl = snapResponse.redirect_url;
        transactionId = snapResponse.token;

        // Extract VA number jika bank transfer
        if (snapResponse.va_numbers && snapResponse.va_numbers.length > 0) {
          vaNumber = snapResponse.va_numbers[0].va_number;
        }

        // ✅ Update order dengan transaction ID, payment URL, dan VA number
        await connection.execute(
          `UPDATE orders SET transactionId = ?, paymentUrl = ?, vaNumber = ? WHERE id = ?`,
          [transactionId, paymentUrl, vaNumber, orderId]
        );

        // ✅ CATAT DI TABEL PAYMENT (sesuai struktur kamu)
        await connection.execute(
          `INSERT INTO payment (
            ordersId, 
            method, 
            amount, 
            status, 
            transaction_id,
            paymentType,
            createdAt, 
            updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [orderId, paymentGateway, grandTotal, 'pending', transactionId, paymentGateway]
        );

        console.log('Payment record created in payment table');
      } else {
        // ✅ Untuk COD, catat payment dengan status pending
        await connection.execute(
          `INSERT INTO payment (
            ordersId, 
            method, 
            amount, 
            status, 
            transaction_id,
            paymentType,
            createdAt, 
            updatedAt
          ) VALUES (?, ?, ?, ?, NULL, NULL, NOW(), NOW())`,
          [orderId, 'cod', grandTotal, 'pending']
        );

        console.log('COD payment record created');
      }

      await connection.query('COMMIT');
      console.log('Transaction committed');

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
      console.error('Transaction error, rolling back:', error.message);
      await connection.query('ROLLBACK');
      throw error;
    } finally {
      if (connection) {
        connection.release();
        console.log('Connection released');
      }
    }

  } catch (err: any) {
    if (connection) {
      try {
        await connection.query('ROLLBACK');
        connection.release();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error('=== ORDER API ERROR ===');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error code:', err.code);
    console.error('Error errno:', err.errno);
    console.error('=======================');
    
    return handleAPIError(err, 'POST /api/orders');
  }
}