import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
import { keysToCamelCase } from '@/lib/utils'; 

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId');
    const rating = searchParams.get('rating');
    const isVerified = searchParams.get('isVerified');
    const limit = parseInt(searchParams.get('limit') || '5');
    const offset = parseInt(searchParams.get('offset') || '0'); // Tambah pagination offset

    // ✅ QUERY DB: Gunakan snake_case untuk nama kolom database
    let query = `
      SELECT 
        r.id,
        r.user_id,       
        r.product_id,    
        r.order_id,      
        r.rating,
        r.comment,
        r.is_verified,   
        r.created_at,    
        r.updated_at,    
        u.name AS user_name,
        u.avatar AS user_avatar,
        u.email AS user_email,
        p.name AS product_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id       
      LEFT JOIN products p ON r.product_id = p.id 
      WHERE 1=1
    `;
    
    const params: any[] = [];

    // Filter by Product ID
    if (productId) {
      query += ' AND r.product_id = ?'; // ✅ snake_case
      params.push(productId);
    }

    // Filter by Rating
    if (rating) {
      query += ' AND r.rating = ?';
      params.push(parseInt(rating));
    }

    // Filter by Verified Status
    if (isVerified !== null && isVerified !== undefined) {
      query += ' AND r.is_verified = ?'; // ✅ snake_case
      params.push(isVerified === 'true' ? 1 : 0);
    }

    // Default: Hanya tampilkan review terverifikasi ATAU yang punya komentar
    query += ' AND (r.is_verified = 1 OR r.comment IS NOT NULL)';
    
    // Ordering & Pagination
    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Execute Query
    const [rows] = await pool.execute(query, params);

    // ✅ CONVERT: Ubah hasil DB (snake_case) -> JSON Response (camelCase)
    const reviews = keysToCamelCase(rows);

    return NextResponse.json({ 
      success: true, 
      reviews,
      pagination: { limit, offset } // Info pagination opsional
    });

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

    const userId = 1; // Placeholder untuk testing

    const body = await req.json();
    // Frontend mengirim camelCase: { productId, orderId, rating, comment }
    const { productId, orderId, rating, comment } = body;

    if (!productId || !rating) {
      return NextResponse.json(
        { success: false, error: 'Product ID and rating are required' },
        { status: 400 }
      );
    }

    // ✅ INSERT DB: Gunakan snake_case untuk nama kolom database
    const [result] = await pool.execute(
      `INSERT INTO reviews (
        user_id,      
        product_id,  
        order_id,     
        rating,
        comment,
        is_verified,  
        created_at,   
        updated_at    
      ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId, 
        productId, 
        orderId || null, 
        rating, 
        comment || null, 
        1 // Default is_verified = 1 (atau 0 jika butuh moderasi admin)
      ]
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