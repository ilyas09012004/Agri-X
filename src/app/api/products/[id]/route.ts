// src/app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { randomUUID } from 'crypto'; // Tidak digunakan di file ini kecuali untuk POST di collection route
import { handleAPIError } from '@/lib/middleware';
import { verifyAccessToken } from '@/lib/auth';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is missing', code: 'MISSING_ID' },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(productId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID format', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // ✅ FIX: Gunakan image_path bukan image
    const query = `
      SELECT 
        id, name, description, price, unit, stock, min_order, seller_id, 
        harvest_date, image_path, category, status, created_at, updated_at 
      FROM products 
      WHERE id = ? AND status != ?
    `;
    
    const [rows] = await pool.execute(query, [parseInt(productId, 10), 'deleted']);

    console.log('Query Result:', rows);
    console.log('Rows Count:', Array.isArray(rows) ? rows.length : 0);

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const product = rows[0];

    // Format response
    const formattedProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: parseFloat(product.price) || 0,
      unit: product.unit || 'kg',
      stock: product.stock || 0,
      min_order: product.min_order || 1,
      seller_id: product.seller_id,
      harvest_date: product.harvest_date,
      image_path: product.image_path,
      category: product.category,
      status: product.status,
      rating: 0, // Bisa ditambahkan nanti dari reviews
      reviews: 0,
      created_at: product.created_at,
      updated_at: product.updated_at,
    };

    console.log('Formatted Product:', formattedProduct);

    return NextResponse.json({
      success: true,
      product: formattedProduct,
    });

  } catch (error: any) {
    console.error('Error fetching product by ID:', error);
    return handleAPIError(error, 'GET /api/products/[id]');
  }
}


// PUT: Ganti SELURUH resource
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;

    if (!/^\d+$/.test(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID format. Must be numeric.' }, { status: 400 });
    }

    const body: Omit<Product, 'id' | 'created_at' | 'updated_at'> = await req.json();

    const { name, description, price, unit, stock, min_order, seller_id, harvest_date, image_path, category, status } = body;

    if (!name || price === undefined || unit === undefined || seller_id === undefined) {
      return NextResponse.json({ success: false, error: 'Name, price, unit, and seller_id are required' }, { status: 400 });
    }

    // ✅ Ganti validasi UUID dengan validasi numerik
    if (!/^\d+$/.test(String(seller_id))) { // Konversi ke string dulu untuk test regex
      return NextResponse.json({ success: false, error: 'Invalid seller_id format. Must be numeric.' }, { status: 400 });
    }
    // ✅ Sampai sini

    const allowedStatuses: Array<'pre-order' | 'ready_stock' | 'sold_out' | 'deleted'> = ['pre-order', 'ready_stock', 'sold_out', 'deleted'];
    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` }, { status: 400 });
    }

    if (price < 0 || stock < 0 || min_order < 1) {
      return NextResponse.json({ success: false, error: 'Price, stock must be non-negative, min_order must be at least 1' }, { status: 400 });
    }

    const query = `
      UPDATE products
      SET name = ?, description = ?, price = ?, unit = ?, stock = ?, min_order = ?, seller_id = ?, harvest_date = ?, image_path = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const paramsQuery = [name, description || null, price, unit, stock, min_order, parseInt(String(seller_id), 10), harvest_date || null, image_path || null, category || null, status || 'pre-order', parseInt(productId, 10)];

    const [result] = await pool.execute(query, paramsQuery);

    if ((result as any).affectedRows === 0) {
      const checkQuery = 'SELECT id FROM products WHERE id = ?';
      const [checkRows] = await pool.execute(checkQuery, [parseInt(productId, 10)]);
      if ((checkRows as any[]).length === 0) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      } else {
        return NextResponse.json({ success: false, error: 'Product not found or could not be updated' }, { status: 404 });
      }
    }

    const updatedProduct: Product = {
      id: parseInt(productId, 10),
      name,
      description: description || null,
      price,
      unit,
      stock,
      min_order,
      seller_id: parseInt(String(seller_id), 10), // Konversi ke number
      harvest_date: harvest_date || null,
      image_path: image_path || null,
      category: category || null,
      status: status || 'pre-order',
      created_at: new Date().toISOString(), // Ambil dari DB jika ingin akurat
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, product: updatedProduct });

  } catch (error) {
    console.error('Error updating product (PUT):', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// PATCH: Update SEBAGIAN resource
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // ✅ Await params terlebih dahulu
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    if (!/^\d+$/.test(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID format. Must be numeric.' }, { status: 400 });
    }

    const body: PartialProductUpdate = await req.json();

    // ✅ Ganti validasi UUID seller_id dengan validasi numerik
    if (body.seller_id !== undefined && !/^\d+$/.test(String(body.seller_id))) {
      return NextResponse.json({ success: false, error: 'Invalid seller_id format. Must be numeric.' }, { status: 400 });
    }

    if (body.status) {
      const allowedStatuses: Array<'pre-order' | 'ready_stock' | 'sold_out' | 'deleted'> = ['pre-order', 'ready_stock', 'sold_out', 'deleted'];
      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` }, { status: 400 });
      }
    }

    if (body.price !== undefined && body.price < 0) {
      return NextResponse.json({ success: false, error: 'Price must be non-negative' }, { status: 400 });
    }
    if (body.stock !== undefined && body.stock < 0) {
      return NextResponse.json({ success: false, error: 'Stock must be non-negative' }, { status: 400 });
    }
    if (body.min_order !== undefined && body.min_order < 1) {
      return NextResponse.json({ success: false, error: 'Min order must be at least 1' }, { status: 400 });
    }

    const updateFields: string[] = [];
    const paramsQuery: any[] = [];

    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = ?`);
        if (key === 'seller_id') {
             paramsQuery.push(parseInt(String(value), 10));
        } else {
             paramsQuery.push(value);
        }
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update provided' }, { status: 400 });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    paramsQuery.push(parseInt(productId, 10));

    const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ? AND status != ?`;
    paramsQuery.push('deleted');

    const [result] = await pool.execute(query, paramsQuery);

    if ((result as any).affectedRows === 0) {
      const checkQuery = 'SELECT id FROM products WHERE id = ?';
      const [checkRows] = await pool.execute(checkQuery, [parseInt(productId, 10)]);
      if ((checkRows as any[]).length === 0) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      } else {
        return NextResponse.json({ success: false, error: 'Product not found or could not be updated' }, { status: 404 });
      }
    }

    const [updatedRows] = await pool.execute(
      'SELECT id, name, description, price, unit, stock, min_order, seller_id, harvest_date, image_path, category, status, created_at, updated_at FROM products WHERE id = ?',
      [parseInt(productId, 10)]
    );

    if ((updatedRows as any[]).length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found after update' }, { status: 500 });
    }

    const updatedProduct = (updatedRows as any[])[0];
    updatedProduct.created_at = updatedProduct.created_at ? new Date(updatedProduct.created_at).toISOString() : null;
    updatedProduct.updated_at = updatedProduct.updated_at ? new Date(updatedProduct.updated_at).toISOString() : null;
    updatedProduct.harvest_date = updatedProduct.harvest_date ? new Date(updatedProduct.harvest_date).toISOString().split('T')[0] : null;

    return NextResponse.json({ success: true, product: updatedProduct });

  } catch (error) {
    console.error('Error updating product (PATCH):', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product', details: (error as Error).message },
      { status: 500 }
    );
  }
}


// DELETE: Hapus produk (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { // Tipe params sekarang Promise
  try {
    // ✅ Await params terlebih dahulu
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    // Validasi ID produk
    if (!productId) {
      throw new Error('Product ID is missing');
    }

    if (!/^\d+$/.test(productId)) {
      throw new Error('Invalid product ID format. Must be numeric.');
    }

    const query = 'UPDATE products SET status = ? WHERE id = ?';
    const [result] = await pool.execute(query, ['deleted', parseInt(productId, 10)]);

    if ((result as any).affectedRows === 0) {
      const checkQuery = 'SELECT id FROM products WHERE id = ?';
      const [checkRows] = await pool.execute(checkQuery, [parseInt(productId, 10)]);
      if ((checkRows as any[]).length === 0) {
        throw new Error('Product not found');
      } else {
        throw new Error('Product already deleted or could not be deleted');
      }
    }

    return NextResponse.json({ success: true, message: 'Product deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting product (DELETE):', error);
    return handleAPIError(error, 'DELETE /api/products/[id]'); // ✅ Gunakan middleware
  }
}