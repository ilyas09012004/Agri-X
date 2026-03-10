import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

export async function POST(req: NextRequest) {
  try {
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

    const { orderId, grossAmount, paymentType } = await req.json();

    if (!orderId || !grossAmount) {
      throw new Error('Order ID and gross amount are required');
    }

    // Map payment type to Midtrans payment type
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

    // Map to Midtrans bank
    const bankMap: Record<string, string> = {
      'va_bca': 'bca',
      'va_mandiri': 'mandiri',
      'va_bri': 'bri',
      'va_bni': 'bni',
    };

    // Build Midtrans payload
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      credit_card: {
        secure: true,
      },
      enabled_payments: [midtransPaymentType],
      bank_transfer: {
        bank: bankMap[paymentType] || 'bca',
      },
      expiry: {
        start_time: new Date().toISOString(),
        unit: 'hours',
        duration: 24,
      },
    };

    // Call Midtrans Snap API
    const midtransServerKey = process.env.MIDTRANS_SERVER_KEY || '';
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
      throw new Error(`Midtrans Error: ${midtransRes.status} - ${errorText}`);
    }

    const midtransData = await midtransRes.json();

    return NextResponse.json({
      success: true,
      snapUrl: midtransData.redirect_url,
      snapToken: midtransData.token,
      orderId: orderId,
    });

  } catch (error: any) {
    console.error('Midtrans error:', error);
    return handleAPIError(error, 'POST /api/payment/midtrans');
  }
}