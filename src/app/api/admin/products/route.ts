// src/app/api/admin/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    // ✅ Auth check - hanya admin yang bisa akses
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // ✅ Parse query params
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
    const offset = (page - 1) * limit;

    // ✅ Build query dengan search & filter
    let query = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.price,
        p.unit,
        p.stock,
        p.sold_count,
        p.origin_village_code,
        p.min_order,
        p.seller_id,
        p.harvest_date,
        p.image_path,
        p.category,
        p.status,
        p.po_quota,
        p.po_sold,
        p.category_id,
        p.created_at,
        p.updated_at,
        u.name as seller_name,
        u.email as seller_email,
        c.name as category_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN category c ON p.category_id = c.id
      WHERE p.status != 'deleted'
    `;
    
    const params: any[] = [];

    // ✅ Search filter
    if (search) {
      query += ` AND (
        p.name LIKE ? OR 
        p.description LIKE ? OR 
        p.category LIKE ? OR 
        u.name LIKE ? OR
        c.name LIKE ?
      )`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    // ✅ Status filter
    if (status && ['ready_stock', 'pre-order', 'sold_out'].includes(status)) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    // ✅ Pagination
    query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // ✅ Execute query
    const [products] = await pool.execute(query, params);

    // ✅ Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN category c ON p.category_id = c.id
      WHERE p.status != 'deleted'
    `;
    const countParams: any[] = [];
    
    if (search) {
      countQuery += ` AND (
        p.name LIKE ? OR 
        p.description LIKE ? OR 
        p.category LIKE ? OR 
        u.name LIKE ? OR
        c.name LIKE ?
      )`;
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }
    if (status && ['ready_stock', 'pre-order', 'sold_out'].includes(status)) {
      countQuery += ` AND p.status = ?`;
      countParams.push(status);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = (countResult as any)[0]?.total || 0;

    // ✅ Format response
    const formattedProducts = (Array.isArray(products) ? products : []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: parseFloat(p.price),
      unit: p.unit,
      stock: p.stock,
      sold_count: p.sold_count,
      origin_village_code: p.origin_village_code,
      min_order: p.min_order,
      seller_id: p.seller_id,
      seller_name: p.seller_name,
      seller_email: p.seller_email,
      harvest_date: p.harvest_date,
      image_path: p.image_path,
      category: p.category,
      category_name: p.category_name,
      status: p.status,
      po_quota: p.po_quota,
      po_sold: p.po_sold,
      category_id: p.category_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return NextResponse.json({
      success: true,
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1,
      },
    });

  } catch (error: any) {
    console.error('Error fetching products:', error);
    return handleAPIError(error, 'GET /api/admin/products');
  }
}