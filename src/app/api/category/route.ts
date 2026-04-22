import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

// ✅ NAMED EXPORT (bukan default export)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isActive = searchParams.get('is_active') ?? 'true';

    let query = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description_category,

        COUNT(p.id) as product_count
      FROM category c
      LEFT JOIN products p ON c.id = p.category_id AND p.status != ?
      WHERE c.is_active = ?
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `;

    const [rows] = await pool.execute(query, ['deleted', isActive === 'true' ? 1 : 0]);
    
    const categories = (rows as any[]).map(c => ({
      ...c,
      //is_active: Boolean(c.is_active),
      product_count: parseInt(c.product_count) || 0,
      created_at: c.created_at ? new Date(c.created_at).toISOString() : null,
      updated_at: c.updated_at ? new Date(c.updated_at).toISOString() : null,
    }));

    return NextResponse.json({ success: true, categories });

  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return handleAPIError(error, 'GET /api/category');
  }
}