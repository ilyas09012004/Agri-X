import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

function formatMidtransDateTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} +0700`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
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
    const body = await req.json();
    
    // Frontend mengirim 'id' (Integer) dari response create order
    let dbOrderId = body.id; 
    
    // Fallback jika frontend masih kirim orderId string (opsional)
    if (!dbOrderId && body.orderId) {
        dbOrderId = body.orderId;
    }

    if (!dbOrderId) {
        return NextResponse.json({ success: false, error: 'Order ID is missing' }, { status: 400 });
    }

    console.log('[Midtrans] Processing payment. Ref ID:', dbOrderId, 'User:', userId);

    // 2. Ambil Data Order, User, DAN Address (untuk No HP)
    // PENTING: Pastikan nama kolom (user_id, address_id, recipient_phone) sesuai dengan DB Anda.
    
    let query = '';
    let params: any[] = [];

    // Cek apakah dbOrderId adalah angka (Primary Key INT)
    const isNumeric = /^\d+$/.test(String(dbOrderId));

    if (isNumeric) {
        // ✅ CASE 1: Cari pakai Primary Key INT (REKOMENDASI)
        query = `
            SELECT o.id, o.user_id, o.address_id, u.email, u.name, a.recipient_phone 
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN address a ON o.address_id = a.id
            WHERE o.id = ? AND o.user_id = ?
        `;
        params = [parseInt(String(dbOrderId)), userId];
    } else {
        // ✅ CASE 2: Cari pakai Custom Code (VARCHAR)
        // Asumsi kolom custom code bernama 'order_code' atau 'orderId'. Sesuaikan jika beda.
        query = `
            SELECT o.id, o.user_id, o.address_id, u.email, u.name, a.recipient_phone 
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN address a ON o.address_id = a.id
            WHERE o.order_id = ? AND o.user_id = ?
        `;
        params = [dbOrderId, userId];
    }

    const [rows]: any[] = await pool.execute(query, params);

    if (rows.length === 0) {
      console.error('[Midtrans] Order NOT FOUND. Query:', query, 'Params:', params);
      return NextResponse.json({ success: false, error: 'Order not found or access denied' }, { status: 404 });
    }

    const order = rows[0];
    const internalOrderId = order.id; 
    
    // Data Pelanggan
    const customerName = order.name || 'Customer';
    const customerEmail = order.email || 'customer@example.com';
    // ✅ Ambil No HP dari Address (recipient_phone)
    const customerPhone = order.recipient_phone || '081234567890'; 

    console.log('[Midtrans] Order Found. ID:', internalOrderId, 'Phone:', customerPhone);

    // 3. Buat Order ID Unik untuk Midtrans (Wajib Unik)
    // Format: UserID-InternalOrderID-Timestamp
    const midtransOrderId = `${userId}-${internalOrderId}-${Date.now()}`;

    // 4. Konfigurasi Pembayaran
    const { grossAmount, paymentType } = body;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Redirect URLs (Halaman Pay akan mengecek status ke DB)
    const finishUrl = `${appUrl}/orders/${internalOrderId}/pay?status=finish`;
    const unfinishUrl = `${appUrl}/orders/${internalOrderId}/pay?status=unfinish`;
    const errorUrl = `${appUrl}/orders/${internalOrderId}/pay?status=error`;

    // Mapping Payment Type Frontend -> Midtrans
    let mtPaymentType = 'bank_transfer';
    let bankName = '';
    
    if (paymentType?.includes('va_bca')) { mtPaymentType = 'bank_transfer'; bankName = 'bca'; }
    else if (paymentType?.includes('va_mandiri')) { mtPaymentType = 'bank_transfer'; bankName = 'mandiri'; }
    else if (paymentType?.includes('va_bri')) { mtPaymentType = 'bank_transfer'; bankName = 'bri'; }
    else if (paymentType?.includes('va_bni')) { mtPaymentType = 'bank_transfer'; bankName = 'bni'; }
    else if (['gopay', 'ovo', 'dana'].includes(paymentType)) { mtPaymentType = 'gopay'; }
    else if (paymentType === 'qris') { mtPaymentType = 'qris'; }

    const payload: any = {
      transaction_details: {
        transaction_id: midtransOrderId,
        gross_amount: Math.round(grossAmount),
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
        phone: customerPhone, // ✅ Menggunakan no HP dari Address
      },
      enabled_payments: [mtPaymentType],
      expiry: {
        start_time: formatMidtransDateTime(),
        unit: 'hours',
        duration: 24,
      },
      callbacks: {
        finish: finishUrl,
        unfinish: unfinishUrl,
        error: errorUrl,
      }
    };

    if (mtPaymentType === 'bank_transfer' && bankName) {
      payload.bank_transfer = { bank: bankName };
    }

    // 5. Call Midtrans API
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) throw new Error('Midtrans Server Key missing');

    const authString = Buffer.from(serverKey).toString('base64');

    const res = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Midtrans API Error:', errText);
      throw new Error(`Midtrans API Error: ${res.status}`);
    }

    const midtransData = await res.json();

    // 6. Update Database: Simpan Transaction ID Midtrans
    // Pastikan kolom 'transaction_id' dan 'payment_gateway' ada di tabel orders
    await pool.execute(
        `UPDATE orders SET transaction_id = ?, payment_gateway = ?, updated_at = NOW() WHERE id = ?`,
        [midtransOrderId, paymentType, internalOrderId]
    );

    return NextResponse.json({
      success: true,
      snapToken: midtransData.token,
      redirectUrl: midtransData.redirect_url,
      orderId: internalOrderId, // Kembalikan ID Integer
      midtransOrderId: midtransOrderId,
    });

  } catch (error: any) {
    console.error('[Midtrans] Critical Error:', error);
    return handleAPIError(error, 'POST /api/payment/midtrans');
  }
}