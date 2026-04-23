import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
// import { verifyAccessToken } from '@/lib/auth'; // Uncomment jika butuh proteksi admin

type Params = {
  params: Promise<{ id: string }>;
};

// Helper: Validasi ID numerik
const isValidId = (id: string) => /^\d+$/.test(id);

// Helper: Format Product Data untuk Response (Clean Data)
const formatProductResponse = (product: any) => {
  if (!product) return null;
  return {
    id: Number(product.id),
    name: product.name,
    description: product.description,
    price: Number(product.price),
    unit: product.unit || 'kg',
    stock: Number(product.stock),
    min_order: Number(product.min_order),
    seller_id: Number(product.seller_id),
    harvest_date: product.harvest_date ? new Date(product.harvest_date).toISOString().split('T')[0] : null,
    image_path: product.image_path,
    category: product.category,
    status: product.status,
    created_at: product.created_at ? new Date(product.created_at).toISOString() : null,
    updated_at: product.updated_at ? new Date(product.updated_at).toISOString() : null,
  };
};

// ============================================================================
// GET: Get Single Product by ID
// ============================================================================
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!isValidId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID format' },
        { status: 400 }
      );
    }

    const query = `
      SELECT 
        id, name, description, price, unit, stock, min_order, seller_id, 
        harvest_date, image_path, category, status, created_at, updated_at 
      FROM products 
      WHERE id = ? AND status != 'deleted'
    `;
    
    const [rows] = await pool.execute(query, [id]);

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product: formatProductResponse(rows[0]),
    });

  } catch (error: any) {
    console.error('Error fetching product:', error);
    return handleAPIError(error, 'GET /api/products/[id]');
  }
}

// ============================================================================
// PUT: Update Entire Product (Replace)
// ============================================================================
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    const { 
      name, description, price, unit, stock, min_order, 
      seller_id, harvest_date, image_path, category, status 
    } = body;

    // ✅ Validasi Wajib
    if (!name || price === undefined || unit === undefined || seller_id === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, price, unit, and seller_id are required' }, 
        { status: 400 }
      );
    }

    // ✅ Validasi Tipe Data & Logika
    const numPrice = Number(price);
    const numStock = Number(stock || 0);
    const numMinOrder = Number(min_order || 1);
    const numSellerId = Number(seller_id);

    if (isNaN(numPrice) || numPrice < 0) return NextResponse.json({ success: false, error: 'Invalid price' }, { status: 400 });
    if (isNaN(numStock) || numStock < 0) return NextResponse.json({ success: false, error: 'Invalid stock' }, { status: 400 });
    if (isNaN(numMinOrder) || numMinOrder < 1) return NextResponse.json({ success: false, error: 'Invalid min_order' }, { status: 400 });
    if (isNaN(numSellerId)) return NextResponse.json({ success: false, error: 'Invalid seller_id' }, { status: 400 });

    const allowedStatuses = ['pre-order', 'ready_stock', 'sold_out', 'deleted'];
    const finalStatus = status && allowedStatuses.includes(status) ? status : 'ready_stock';

    const query = `
      UPDATE products
      SET name = ?, description = ?, price = ?, unit = ?, stock = ?, 
          min_order = ?, seller_id = ?, harvest_date = ?, image_path = ?, 
          category = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      name,
      description || null,
      numPrice,
      unit,
      numStock,
      numMinOrder,
      numSellerId,
      harvest_date || null,
      image_path || null,
      category || null,
      finalStatus,
      id
    ];

    const [result] = await pool.execute(query, values);

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ success: false, error: 'Product not found or no changes made' }, { status: 404 });
    }

    // Fetch updated data to return fresh state
    const [updatedRows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
    
    return NextResponse.json({ 
      success: true, 
      product: formatProductResponse(updatedRows[0]) 
    });

  } catch (error: any) {
    console.error('Error updating product (PUT):', error);
    return handleAPIError(error, 'PUT /api/products/[id]');
  }
}

// ============================================================================
// PATCH: Partial Update (Update specific fields only)
// ============================================================================
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    
    // ✅ Whitelist fields yang boleh diupdate (Security!)
    // Mencegah user iseng update 'id' atau 'created_at'
    const allowedFields = [
      'name', 'description', 'price', 'unit', 'stock', 
      'min_order', 'seller_id', 'harvest_date', 'image_path', 
      'category', 'status'
    ];

    const updateFields: string[] = [];
    const values: any[] = [];

    Object.keys(body).forEach((key) => {
      if (allowedFields.includes(key) && body[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        
        // Konversi tipe data khusus
        if (key === 'price') values.push(Number(body[key]));
        else if (key === 'stock') values.push(Number(body[key]));
        else if (key === 'min_order') values.push(Number(body[key]));
        else if (key === 'seller_id') values.push(Number(body[key]));
        else values.push(body[key]);
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    // Tambah updated_at otomatis
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id); // Untuk WHERE clause

    const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ? AND status != 'deleted'`;
    
    const [result] = await pool.execute(query, values);

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ success: false, error: 'Product not found or already deleted' }, { status: 404 });
    }

    // Fetch fresh data
    const [updatedRows] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);

    return NextResponse.json({ 
      success: true, 
      product: formatProductResponse(updatedRows[0]) 
    });

  } catch (error: any) {
    console.error('Error updating product (PATCH):', error);
    return handleAPIError(error, 'PATCH /api/products/[id]');
  }
}

// ============================================================================
// DELETE: Soft Delete (Change status to 'deleted')
// ============================================================================
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    if (!isValidId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    // Soft delete: Ubah status jadi 'deleted'
    const query = 'UPDATE products SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    const [result] = await pool.execute(query, ['deleted', id]);

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    });

  } catch (error: any) {
    console.error('Error deleting product:', error);
    return handleAPIError(error, 'DELETE /api/products/[id]');
  }
}