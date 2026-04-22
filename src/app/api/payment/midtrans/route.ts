import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

/**
 * Format tanggal untuk Midtrans API
 * Format: yyyy-MM-dd hh:mm:ss +0700 (WIB - Western Indonesia Time)
 */
function formatMidtransDateTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0700`;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const { orderId, grossAmount, paymentType } = await req.json();

    if (!orderId || !grossAmount) {
      throw new Error('Order ID and gross amount are required');
    }

    // Map payment type
    const paymentTypeMap: Record<string, string> = {
      'va_bca': 'bank_transfer',
      'va_mandiri': 'bank_transfer',
      'va_bri': 'bank_transfer',
      'va_bni': 'bank_transfer',
      'gopay': 'gopay',
      'ovo': 'gopay',
      'dana': 'gopay',
      'qris': 'qris',
    };

    const midtransPaymentType = paymentTypeMap[paymentType] || 'bank_transfer';

    const bankMap: Record<string, string> = {
      'va_bca': 'bca',
      'va_mandiri': 'mandiri',
      'va_bri': 'bri',
      'va_bni': 'bni',
    };

    const startTime = formatMidtransDateTime(new Date());

    const payload = {
      transaction_details: {
        order_id: `AGR-${orderId}`, // Midtrans butuh string unik
        gross_amount: grossAmount,
      },
      credit_card: { secure: true },
      enabled_payments: [midtransPaymentType],
      ...(midtransPaymentType === 'bank_transfer' && {
        bank_transfer: { bank: bankMap[paymentType] || 'bca' },
      }),
      expiry: {
        start_time: startTime,
        unit: 'hours',
        duration: 24,
      },
      customer_details: {
        first_name: 'Customer',
        email: 'customer@example.com',
        phone: '+62',
      },
    };

    const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || '';
    if (!midtransServerKey) {
      throw new Error('MIDTRANS_SERVER_KEY is not configured');
    }

    const authBuffer = Buffer.from(midtransServerKey).toString('base64');

    const midtransRes = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authorization': `Basic ${authBuffer}`,
      },
      body: JSON.stringify(payload),
    });

    if (!midtransRes.ok) {
      const errorText = await midtransRes.text();
      console.error('Midtrans API Error:', errorText);
      throw new Error(`Midtrans Error: ${midtransRes.status} - ${errorText}`);
    }

    const midtransData = await midtransRes.json();

    // ✅ FIX: Generate URL dengan fragment untuk payment method tertentu
    const baseUrl = midtransData.redirect_url;
    const fragmentMap: Record<string, string> = {
      'gopay': '#/gopay',
      'ovo': '#/ovo',
      'dana': '#/dana',
      'qris': '#/qris',
      'va_bca': '#/bank_transfer/bca',
      'va_mandiri': '#/bank_transfer/mandiri',
      'va_bri': '#/bank_transfer/bri',
      'va_bni': '#/bank_transfer/bni',
    };

    const fragment = fragmentMap[paymentType] || '';
    const paymentUrlWithFragment = fragment ? `${baseUrl}${fragment}` : baseUrl;

    // ✅ FIX: Update database dengan URL yang sudah ada fragment
    try {
      await pool.execute(
        `UPDATE orders 
         SET paymentUrl = ?, transactionId = ?, paymentGateway = ?
         WHERE id = ?`,
        [paymentUrlWithFragment, midtransData.token, paymentType, orderId]
      );
      console.log('[Midtrans] Updated paymentUrl in database:', paymentUrlWithFragment);
    } catch (dbError) {
      console.error('[Midtrans] Failed to update database:', dbError);
      // Jangan throw error, biarkan response tetap sukses
    }

    // Return response dengan semua informasi
    return NextResponse.json({
      success: true,
      snapToken: midtransData.token,
      snapUrl: baseUrl,
      paymentUrl: paymentUrlWithFragment, // ✅ URL dengan fragment
      paymentUrls: Object.entries(fragmentMap).reduce((acc, [key, frag]) => {
        acc[key] = `${baseUrl}${frag}`;
        return acc;
      }, {} as Record<string, string>),
      paymentType: paymentType,
      orderId: orderId,
    });

  } catch (error: any) {
    console.error('Midtrans error:', error);
    return handleAPIError(error, 'POST /api/payment/midtrans');
  }
}