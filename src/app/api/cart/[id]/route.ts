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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessTokenServer(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    if (!productId || isNaN(Number(productId))) {
      throw new Error('Invalid product ID');
    }

    const { quantity } = await req.json();

    if (quantity === undefined || quantity < 1) {
      throw new Error('Quantity is required and must be at least 1');
    }

    // ✅ DEBUG: Log untuk troubleshooting
    console.log('=== UPDATE CART DEBUG ===');
    console.log('userId:', userId);
    console.log('productId:', productId);
    console.log('quantity:', quantity);

    // Ambil data item keranjang dan produk terkait
    const [cartItemRows] = await pool.execute(
      `SELECT ci.id, ci.userId, ci.productId, ci.quantity, p.stock, p.min_order, p.status 
       FROM cartitems ci 
       INNER JOIN products p ON ci.productId = p.id 
       WHERE ci.productId = ? AND ci.userId = ?`,
      [Number(productId), userId]
    );

    console.log('Cart item rows:', cartItemRows);

    if ((cartItemRows as any[]).length === 0) {
      throw new Error('Cart item not found or does not belong to user');
    }

    const cartItem = (cartItemRows as any[])[0];

    // ✅ DEBUG: Log status produk
    console.log('Product status:', cartItem.status);
    console.log('Product stock:', cartItem.stock);
    console.log('Product min_order:', cartItem.min_order);

    // ✅ FIX: Handle berbagai kemungkinan status produk
    // Status yang mungkin: 'ready_stock', 'pre_order', 'sold_out', 'active', 'inactive', 'deleted'
    const status = cartItem.status?.toLowerCase();

    if (status === 'sold_out' || status === 'deleted') {
      throw new Error('Product is currently sold out.');
    }

    // ✅ Handle 'active' sebagai 'ready_stock'
    if (status === 'active' || status === 'ready_stock') {
      if (quantity < cartItem.min_order) {
        throw new Error(`Quantity must be at least ${cartItem.min_order}`);
      }
      if (quantity > cartItem.stock) {
        throw new Error(`Insufficient stock. Available: ${cartItem.stock}`);
      }
    } 
    // ✅ Handle 'pre_order'
    else if (status === 'pre_order') {
      if (quantity < cartItem.min_order) {
        throw new Error(`Quantity must be at least ${cartItem.min_order} for pre-order items.`);
      }
    }
    // ✅ Handle 'inactive' atau status lain yang tidak dikenali
    else if (status === 'inactive') {
      throw new Error('Product is currently inactive.');
    }
    else {
      // ✅ DEFAULT: Anggap sebagai ready_stock jika status tidak dikenali
      console.warn('Unknown product status:', status, '- Treating as ready_stock');
      if (quantity < cartItem.min_order) {
        throw new Error(`Quantity must be at least ${cartItem.min_order}`);
      }
      if (quantity > cartItem.stock) {
        throw new Error(`Insufficient stock. Available: ${cartItem.stock}`);
      }
    }

    // Update quantity
    await pool.execute(
      `UPDATE cartitems SET quantity = ? WHERE productId = ? AND userId = ?`,
      [quantity, Number(productId), userId]
    );

    console.log('=== UPDATE SUCCESS ===');

    return NextResponse.json({ 
      success: true, 
      message: 'Cart item quantity updated successfully',
      data: { productId, quantity }
    });

  } catch (err: any) {
    console.error('Error updating cart item quantity (PUT):', err);
    return handleAPIError(err, 'PUT /api/cart/[id]');
  }
}

// ============================================
// DELETE: Hapus item dari keranjang
// ============================================
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessTokenServer(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const resolvedParams = await params;
    const productId = resolvedParams.id;

    if (!productId || isNaN(Number(productId))) {
      throw new Error('Invalid product ID');
    }

    // Hapus item dari tabel cartitems
    const [result] = await pool.execute(
      `DELETE FROM cartitems WHERE productId = ? AND userId = ?`,
      [Number(productId), userId]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Cart item not found or does not belong to user');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Cart item removed successfully',
      data: { productId }
    });

  } catch (err: any) {
    console.error('Error removing cart item:', err);
    return handleAPIError(err, 'DELETE /api/cart/[id]');
  }
}