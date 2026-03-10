import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const rating = searchParams.get('rating');
    const isVerified = searchParams.get('isVerified');
    const limit = searchParams.get('limit') || '5';

    // ✅ UPDATE: Tambahkan u.avatar ke SELECT
    let query = `
      SELECT 
        r.id,
        r.userId,
        r.productId,
        r.orderId,
        r.rating,
        r.comment,
        r.is_verified,
        r.created_at,
        r.updated_at,
        u.name as user_name,
        u.avatar as user_avatar,
        u.email as user_email,
        p.name as product_name
      FROM reviews r
      JOIN users u ON r.userId = u.id
      LEFT JOIN products p ON r.productId = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (productId) {
      query += ' AND r.productId = ?';
      params.push(productId);
    }

    if (rating) {
      query += ' AND r.rating = ?';
      params.push(rating);
    }

    if (isVerified !== null && isVerified !== undefined) {
      query += ' AND r.is_verified = ?';
      params.push(isVerified === 'true' ? 1 : 0);
    }

    query += ' AND (r.is_verified = 1 OR r.comment IS NOT NULL)';
    query += ' ORDER BY r.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await pool.execute(query, params);
    const reviews = (rows as any[]).map(r => ({
      ...r,
      is_verified: Boolean(r.is_verified),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      user_avatar: r.user_avatar || null,
    }));

    return NextResponse.json({ success: true, reviews });

  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return handleAPIError(error, 'GET /api/reviews');
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { productId, orderId, rating, comment } = body;

    if (!productId || !rating) {
      return NextResponse.json(
        { success: false, error: 'Product ID and rating are required' },
        { status: 400 }
      );
    }

    // Get userId from token (implement your token verification)
    const userId = 1; // Replace with actual token decoding

    const [result] = await pool.execute(
      `INSERT INTO reviews (userId, productId, orderId, rating, comment, is_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, productId, orderId || null, rating, comment || null, 1]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Review submitted successfully',
      reviewId: (result as any).insertId 
    });

  } catch (error: any) {
    console.error('Error creating review:', error);
    return handleAPIError(error, 'POST /api/reviews');
  }
}