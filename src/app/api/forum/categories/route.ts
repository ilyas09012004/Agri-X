import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    const [categories] = await pool.execute(`
      SELECT * FROM forum_categories 
      WHERE is_active = TRUE 
      ORDER BY sort_order ASC
    `);

    return NextResponse.json({
      success: true,
      categories: Array.isArray(categories) ? categories : [],
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return handleAPIError(error, 'GET /api/forum/categories');
  }
}