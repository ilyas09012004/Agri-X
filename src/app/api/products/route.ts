import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware'; // Import middleware
import { verifyAccessToken } from '@/utils/jwt.util';

// ✅ Update tipe Product: id dan seller_id menjadi number
interface Product {
  id: number; // Diubah dari string ke number
  name: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  min_order: number;
  seller_id: number; // Diubah dari string ke number
  user_name: string;
  harvest_date: string | null;
  image_path: string | null;
  category: string | null;
  status: 'pre-order' | 'ready_stock' | 'sold_out' | 'deleted';
  created_at: string;
  updated_at: string;
}

// ✅ Update tipe untuk input (untuk POST): seller_id menjadi number
interface ProductInput {
  name: string;
  description?: string;
  price: number;
  unit: string;
  stock: number;
  min_order: number;
  seller_id: number; // Diubah dari string ke number
  harvest_date?: string;
  image_path?: string;
  category?: string;
  status?: 'pre-order' | 'ready_stock' | 'sold_out';
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const categoryId = searchParams.get('category_id'); // ✅ Baru: support filter by category_id
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    
    // ✅ Tambah: Parse sort & order params
    const sort = searchParams.get('sort') || 'sold_count'; // Default: urutkan by paling laris
    const order = searchParams.get('order') || 'desc'; // Default: descending

    // ✅ Whitelist field yang boleh di-sort (anti SQL injection)
    const validSortFields = ['created_at', 'price', 'sold_count', 'rating', 'name', 'stock'];
    const sortBy = validSortFields.includes(sort) ? sort : 'sold_count';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let query = `
      SELECT 
        p.id, 
        p.name, 
        p.description, 
        p.price, 
        p.unit, 
        p.stock,
        p.sold_count,
        p.category_id,  -- ✅ Tambah field category_id
        p.min_order, 
        p.seller_id,
        u.name as user_name,
        p.harvest_date, 
        p.image_path, 
        p.category, 
        p.status, 
        p.created_at, 
        p.updated_at 
      FROM products p
      INNER JOIN users u ON p.seller_id = u.id
      WHERE p.status != ?
    `;
    const params: any[] = ['deleted'];

    // ✅ Filter by category_id (prioritas) atau category string (backward compatibility)
    if (categoryId && !isNaN(parseInt(categoryId))) {
      query += ' AND p.category_id = ?';
      params.push(parseInt(categoryId));
    } else if (category) {
      query += ' AND p.category = ?';
      params.push(category);
    }

    // ✅ Tambah ORDER BY dengan nilai yang sudah divalidasi (aman dari SQL injection)
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    if (limit) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1) {
        throw new Error('Invalid limit parameter');
      }
      query += ' LIMIT ?';
      params.push(limitNum);
      if (offset) {
        const offsetNum = parseInt(offset);
        if (isNaN(offsetNum) || offsetNum < 0) {
          throw new Error('Invalid offset parameter');
        }
        query += ' OFFSET ?';
        params.push(offsetNum);
      }
    }

    const [rows] = await pool.execute(query, params);
    const products = rows as any[];

    const formattedProducts = products.map(p => ({
      id: typeof p.id === 'number' ? p.id : parseInt(p.id, 10),
      name: p.name,
      description: p.description,
      price: p.price,
      unit: p.unit,
      stock: p.stock,
      sold_count: p.sold_count,
      category_id: typeof p.category_id === 'number' ? p.category_id : (p.category_id ? parseInt(p.category_id, 10) : null), // ✅ Include category_id in response
      min_order: p.min_order,
      seller_id: typeof p.seller_id === 'number' ? p.seller_id : parseInt(p.seller_id, 10),
      user_name: p.user_name,
      harvest_date: p.harvest_date ? new Date(p.harvest_date).toISOString().split('T')[0] : null,
      image_path: p.image_path,
      category: p.category,
      status: p.status,
      created_at: p.created_at ? new Date(p.created_at).toISOString() : null,
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : null,
    }));

    return NextResponse.json({ success: true, products: formattedProducts });

  } catch (error: any) {
    console.error('Error fetching products:', error);
    return handleAPIError(error, 'GET /api/products');
  }
}


export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const userRole = decoded.role;

    if (userRole === 'buyer') {
      return NextResponse.json({ success: false, error: 'Buyers cannot create products' }, { status: 403 });
    }

    if (userRole === 'seller' && userId) {
      const bodyTemp = await req.json();
      const bodySellerId = typeof bodyTemp.seller_id === 'number' ? bodyTemp.seller_id : parseInt(bodyTemp.seller_id, 10);
      if (bodySellerId !== parseInt(userId, 10)) {
        return NextResponse.json({ success: false, error: 'You can only create products for yourself' }, { status: 403 });
      }
    }

    const body: Omit<ProductInput, 'id' | 'created_at' | 'updated_at'> = await req.json();

    const { name, description, price, unit, stock, min_order, seller_id, harvest_date, image_path, category, status } = body;

    // ✅ Validasi price: pastikan bukan undefined dan adalah angka
    if (!name || price === undefined || price === null || typeof price !== 'number' || unit === undefined || seller_id === undefined) {
      throw new Error('Name, price, unit, and seller_id are required');
    }

    const sellerIdNum = typeof seller_id === 'number' ? seller_id : parseInt(seller_id, 10);
    if (isNaN(sellerIdNum) || sellerIdNum <= 0) {
      throw new Error('Invalid seller_id format. Must be a positive integer.');
    }

    const allowedStatuses: Array<'pre-order' | 'ready_stock' | 'sold_out'> = ['pre-order', 'ready_stock', 'sold_out'];
    if (status && !allowedStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`);
    }

    // ✅ Validasi price, stock, min_order: pastikan bukan NaN
    if (isNaN(price) || price < 0 || isNaN(stock) || stock < 0 || isNaN(min_order) || min_order < 1) {
      throw new Error('Price, stock must be non-negative, min_order must be at least 1');
    }

    const query = `
      INSERT INTO products (name, description, price, unit, stock, min_order, seller_id, harvest_date, image_path, category, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    // ✅ Pastikan semua nilai dalam params adalah primitif atau null
    const params = [
      name,
      description ?? null, // Gunakan nullish coalescing operator
      price, // Sudah divalidasi, pasti number
      unit,
      stock ?? 0, // Default ke 0 jika undefined
      min_order, // Sudah divalidasi, pasti number
      sellerIdNum, // Sudah divalidasi, pasti number
      harvest_date ? new Date(harvest_date).toISOString().split('T')[0] : null, // Format date atau null
      image_path ?? null, // Gunakan nullish coalescing operator
      category ?? null, // Gunakan nullish coalescing operator
      status ?? 'pre-order' // Gunakan nullish coalescing operator
    ];

    const [result] = await pool.execute(query, params);
    const insertedId = (result as any).insertId;

    const newProduct: Product = {
      id: insertedId,
      name,
      description: description ?? null,
      price,
      unit,
      stock: stock ?? 0,
      min_order,
      seller_id: sellerIdNum,
      user_name: '',
      harvest_date: harvest_date ? new Date(harvest_date).toISOString().split('T')[0] : null,
      image_path: image_path ?? null,
      category: category ?? null,
      status: status ?? 'pre-order',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, product: newProduct }, { status: 200 });

  } catch (error: any) {
    console.error('Error creating product:', error);
    return handleAPIError(error, 'POST /api/products');
  }
}
