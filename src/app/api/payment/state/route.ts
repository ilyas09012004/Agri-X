// src/app/api/payment/state/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, event, ...data } = body;

    if (!orderId || !event) {
      return NextResponse.json(
        { success: false, error: 'orderId and event required' },
        { status: 400 }
      );
    }

    // ✅ Get user ID from token (optional for sendBeacon)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded) userId = decoded.sub;
    }

    // ✅ Insert or update payment state
    await pool.execute(
      `INSERT INTO payment_states (
        order_id, user_id, event_type, payment_method, 
        va_number, bank_name, transaction_id, extra_data,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        event_type = VALUES(event_type),
        payment_method = COALESCE(payment_method, VALUES(payment_method)),
        va_number = COALESCE(va_number, VALUES(va_number)),
        bank_name = COALESCE(bank_name, VALUES(bank_name)),
        transaction_id = COALESCE(transaction_id, VALUES(transaction_id)),
        extra_data = VALUES(extra_data),
        updated_at = CURRENT_TIMESTAMP(3)`,
      [
        orderId,
        userId,
        event, // 'pending', 'success', 'error', 'modal_closed'
        data.paymentType || null,
        data.vaNumber || null,
        data.bank || null,
        data.transactionId || null,
        JSON.stringify(data),
      ]
    );

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error saving payment state:', error);
    return NextResponse.json({ success: true }, { status: 200 }); // Don't fail
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId required' }, { status: 400 });
    }

    const [states] = await pool.execute(
      `SELECT * FROM payment_states 
       WHERE order_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [orderId]
    );

    const state = (states as any[])[0];
    
    return NextResponse.json({
      success: true,
      state: state ? {
        ...state,
        extra_data: state.extra_data ? JSON.parse(state.extra_data) : null,
      } : null,
    });

  } catch (error: any) {
    console.error('Error fetching payment state:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}