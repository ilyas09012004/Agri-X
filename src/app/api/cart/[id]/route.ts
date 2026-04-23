// src/app/api/cart/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenServer } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{ id: string }>;
};

// ============================================
// PUT: Update quantity item di keranjang
// ============================================
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessTokenServer(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    if (!productId || isNaN(Number(productId))) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    const { quantity } = body;

    if (quantity === undefined || quantity === null || quantity < 1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Quantity is required and must be at least 1' 
      }, { status: 400 });
    }

    // 2. Get Cart Item & Product Details (Snake_case)
    const [cartItemRows] = await pool.execute(
      `SELECT ci.id, ci.user_id, ci.product_id, ci.quantity, 
              p.stock, p.min_order, p.status, p.weight
       FROM cart_items ci 
       INNER JOIN products p ON ci.product_id = p.id 
       WHERE ci.product_id = ? AND ci.user_id = ?`,
      [Number(productId), userId]
    );

    if ((cartItemRows as any[]).length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Item tidak ditemukan di keranjang.' 
      }, { status: 404 });
    }

    const cartItem = (cartItemRows as any[])[0];
    const productStatus = cartItem.status?.toLowerCase();

    // 3. Validation Logic
    
    // Cek jika produk sudah dihapus atau tidak aktif
    if (productStatus === 'deleted' || productStatus === 'inactive') {
      return NextResponse.json({ 
        success: false, 
        error: 'Produk ini tidak lagi tersedia.' 
      }, { status: 400 });
    }

    // Cek Min Order
    const minOrder = Number(cartItem.min_order) || 1;
    if (quantity < minOrder) {
      return NextResponse.json({ 
        success: false, 
        error: `Minimal pembelian untuk produk ini adalah ${minOrder}.` 
      }, { status: 400 });
    }

    // Cek Stock (Hanya untuk produk Ready Stock)
    // Pre-order biasanya tidak dibatasi stock fisik saat checkout
    if (productStatus === 'ready_stock') {
      const availableStock = Number(cartItem.stock) || 0;
      if (quantity > availableStock) {
        return NextResponse.json({ 
          success: false, 
          error: `Stok tidak mencukupi. Tersisa: ${availableStock}` 
        }, { status: 400 });
      }
    }

    // 4. Update Quantity (Snake_case columns)
    await pool.execute(
      `UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE product_id = ? AND user_id = ?`,
      [quantity, Number(productId), userId]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Jumlah produk berhasil diperbarui',
      data: { productId, quantity }
    });

  } catch (err: any) {
    return handleAPIError(err, 'PUT /api/cart/[id]');
  }
}

// ============================================
// DELETE: Hapus item dari keranjang
// ============================================
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessTokenServer(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    if (!productId || isNaN(Number(productId))) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    // 2. Delete Item (Snake_case columns)
    const [result] = await pool.execute(
      `DELETE FROM cart_items WHERE product_id = ? AND user_id = ?`,
      [Number(productId), userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Item tidak ditemukan di keranjang.' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Produk berhasil dihapus dari keranjang',
      data: { productId }
    });

  } catch (err: any) {
    return handleAPIError(err, 'DELETE /api/cart/[id]');
  }
}