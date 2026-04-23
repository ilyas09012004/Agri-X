// src/app/api/cart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

// ==================== GET: Ambil Cart Items ====================
export async function GET(req: NextRequest) {
  try {
    // 1. Auth Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;

    // 2. Query Data Cart + Product Details
    // ✅ TAMBAHKAN 'p.weight' di sini agar berat produk ikut terambil
    const [rows] = await pool.execute(
      `SELECT 
        ci.id as cart_id,
        ci.product_id,
        ci.quantity,
        p.id as product_id,
        p.name as product_name,
        p.price as product_price,
        p.image_path as product_image_path,
        p.stock as product_stock,
        p.min_order as product_min_order,
        p.status as product_status,
        p.unit as product_unit,
        p.weight as product_weight,          -- ✅ BARU: Ambil berat
        p.origin_village_code as product_origin_village_code -- ✅ PENTING: Untuk cek ongkir
       FROM cart_items ci
       INNER JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ?`,
      [userId]
    );

    // 3. Format Data agar rapi di Frontend
    const formattedItems = (rows as any[]).map((row) => ({
      id: row.cart_id,
      productId: row.product_id,
      quantity: row.quantity,
      product: {
        id: row.product_id,
        name: row.product_name,
        price: Number(row.product_price),
        image_path: row.product_image_path,
        stock: Number(row.product_stock),
        min_order: Number(row.product_min_order),
        status: row.product_status,
        unit: row.product_unit,
        weight: Number(row.product_weight) || 0, // ✅ BARU: Kirim berat ke frontend
        originVillageCode: row.product_origin_village_code, // ✅ PENTING: Kirim kode desa asal
      },
    }));

    // 4. Hitung Total di Backend (Single Source of Truth)
    const totalItems = formattedItems.length;
    
    const totalQuantity = formattedItems.reduce((sum, item) => sum + item.quantity, 0);
    
    const totalPrice = formattedItems.reduce((sum, item) => {
      return sum + (item.product.price * item.quantity);
    }, 0);

    // ✅ HITUNG TOTAL BERAT DI BACKEND
    // Berat total = Sum(berat_satuan * quantity)
    const totalWeight = formattedItems.reduce((sum, item) => {
      return sum + (item.product.weight * item.quantity);
    }, 0);

    // 5. Return JSON
    return NextResponse.json({
      success: true,
      formattedCartItems: formattedItems,
      totalItems,
      totalQuantity,
      totalPrice,
      totalWeight, // ✅ BARU: Kirim total berat ke frontend
    });

  } catch (err: any) {
    return handleAPIError(err, 'GET /api/cart');
  }
}

// ==================== POST: Tambah ke Cart ====================
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { productId, quantity } = await req.json();

    if (!productId || !quantity || quantity <= 0) {
      throw new Error('Product ID and quantity are required');
    }

    // ✅ Query: Pakai snake_case & ambil weight untuk validasi jika perlu
    const [productRows] = await pool.execute(
      `SELECT id, stock, min_order, status, po_quota, po_sold, harvest_date, weight 
       FROM products WHERE id = ? AND status != ?`,
      [productId, 'deleted']
    );

    if ((productRows as any[]).length === 0) {
      throw new Error('Product not found or deleted');
    }

    const product = (productRows as any[])[0];

    // ✅ Validasi berdasarkan STATUS
    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // ✅ LOGIKA PRE-ORDER
    if (product.status === 'pre-order') {
      const remainingQuota = (product.po_quota || 0) - (product.po_sold || 0);
      
      if (quantity > remainingQuota) {
        throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}. Silakan kurangi jumlah pesanan.`);
      }

      if (!product.harvest_date) {
        throw new Error('Tanggal panen Pre-Order belum ditetapkan oleh petani.');
      }

      // Handle harvest_date validation
      let harvestDate: Date;
      if (product.harvest_date instanceof Date) {
        harvestDate = new Date(product.harvest_date);
        harvestDate.setHours(0, 0, 0, 0);
      } else if (typeof product.harvest_date === 'string') {
        const [year, month, day] = product.harvest_date.split('-').map(Number);
        harvestDate = new Date(year, (month || 1) - 1, day || 1);
      } else {
        throw new Error('Format harvest_date tidak valid');
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (harvestDate < today) {
        const dateStr = product.harvest_date instanceof Date 
          ? product.harvest_date.toISOString().split('T')[0] 
          : product.harvest_date;
        throw new Error(`Tanggal panen Pre-Order (${dateStr}) sudah lewat. Hubungi petani untuk konfirmasi.`);
      }
    }
    // ✅ LOGIKA READY_STOCK
    else if (product.status === 'ready_stock') {
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order}`);
      }
      if (quantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }
    }
    else {
      throw new Error('Product is currently unavailable.');
    }

    // Cek apakah produk sudah ada di keranjang
    const [existingCartRows] = await pool.execute(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if ((existingCartRows as any[]).length > 0) {
      // Update jumlah
      const existingQuantity = (existingCartRows as any[])[0].quantity;
      const newQuantity = existingQuantity + quantity;

      // ✅ Validasi ulang berdasarkan status
      if (product.status === 'pre-order') {
        const remainingQuota = (product.po_quota || 0) - (product.po_sold || 0);
        if (newQuantity > remainingQuota) {
          throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}. Total di keranjang melebihi kuota.`);
        }
      } else if (product.status === 'ready_stock') {
        if (newQuantity > product.stock) {
          throw new Error(`Insufficient stock for total quantity. Available: ${product.stock}`);
        }
      }

      await pool.execute(
        'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?',
        [newQuantity, userId, productId]
      );
    } else {
      // Insert baru
      if (product.status === 'pre-order') {
        const remainingQuota = (product.po_quota || 0) - (product.po_sold || 0);
        if (quantity > remainingQuota) {
          throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}.`);
        }
      } else if (product.status === 'ready_stock') {
        if (quantity > product.stock) {
          throw new Error(`Insufficient stock. Available: ${product.stock}`);
        }
      }

      await pool.execute(
        'INSERT INTO cart_items (user_id, product_id, quantity, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [userId, productId, quantity]
      );
    }

    return NextResponse.json({ success: true, message: 'Product added to cart successfully' });

  } catch (err: any) {
    console.error('Error adding to cart:', err);
    return handleAPIError(err, 'POST /api/cart');
  }
}

// ==================== PUT: Update Quantity (Absolute) ====================
export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { productId, quantity } = await req.json();

    if (!productId || quantity === undefined || quantity < 0) {
      throw new Error('Product ID and quantity are required');
    }

    // ✅ Hapus item jika quantity = 0
    if (quantity === 0) {
      const [deleteResult] = await pool.execute(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );

      if ((deleteResult as any).affectedRows === 0) {
        throw new Error('Product not found in cart for deletion');
      }

      return NextResponse.json({ success: true, message: 'Product removed from cart successfully' });
    }

    // ✅ Ambil produk
    const [productRows] = await pool.execute(
      `SELECT id, stock, min_order, status, po_quota, po_sold, harvest_date 
       FROM products WHERE id = ? AND status != ?`,
      [productId, 'deleted']
    );

    if ((productRows as any[]).length === 0) {
      throw new Error('Product not found or deleted');
    }

    const product = (productRows as any[])[0];

    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // ✅ VALIDASI PRE-ORDER
    if (product.status === 'pre-order') {
      const remainingQuota = (product.po_quota || 0) - (product.po_sold || 0);
      
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order} for pre-order items.`);
      }
      if (quantity > remainingQuota) {
        throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}.`);
      }
      
      if (product.harvest_date) {
        let harvestDate: Date;
        if (product.harvest_date instanceof Date) {
          harvestDate = new Date(product.harvest_date);
          harvestDate.setHours(0, 0, 0, 0);
        } else if (typeof product.harvest_date === 'string') {
          const [year, month, day] = product.harvest_date.split('-').map(Number);
          harvestDate = new Date(year, (month || 1) - 1, day || 1);
        } else {
          throw new Error('Format harvest_date tidak valid');
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (harvestDate < today) {
          const dateStr = product.harvest_date instanceof Date 
            ? product.harvest_date.toISOString().split('T')[0] 
            : product.harvest_date;
          throw new Error(`Tanggal panen Pre-Order (${dateStr}) sudah lewat.`);
        }
      }
    }
    // ✅ VALIDASI READY_STOCK
    else if (product.status === 'ready_stock') {
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order}`);
      }
      if (quantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }
    } else {
      throw new Error('Product is currently unavailable.');
    }

    // ✅ Update quantity
    const [result] = await pool.execute(
      'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?',
      [quantity, userId, productId]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Product not found in cart');
    }

    return NextResponse.json({ success: true, message: 'Cart item quantity updated successfully' });

  } catch (err: any) {
    console.error('Error updating cart item quantity:', err);
    return handleAPIError(err, 'PUT /api/cart');
  }
}

// ==================== PATCH: Update Quantity (Relative/Delta) ====================
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { productId, delta } = await req.json();

    if (!productId || delta === undefined) {
      throw new Error('Product ID and delta (change amount) are required');
    }

    if (typeof delta !== 'number' || !Number.isInteger(delta)) {
      throw new Error('Delta must be an integer (e.g., +2, -1)');
    }

    // ✅ Ambil item keranjang saat ini
    const [cartRows] = await pool.execute(
      'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if ((cartRows as any[]).length === 0) {
      throw new Error('Product not found in cart');
    }

    const currentQuantity = (cartRows as any[])[0].quantity;
    const newQuantity = currentQuantity + delta;

    // Jika hasilnya <= 0, hapus item
    if (newQuantity <= 0) {
      await pool.execute(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );
      return NextResponse.json({ 
        success: true, 
        message: 'Product removed from cart (quantity <= 0)' 
      });
    }

    // ✅ Ambil produk
    const [productRows] = await pool.execute(
      `SELECT id, stock, min_order, status, po_quota, po_sold, harvest_date 
       FROM products WHERE id = ? AND status != ?`,
      [productId, 'deleted']
    );

    if ((productRows as any[]).length === 0) {
      await pool.execute(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );
      throw new Error('Product is no longer available');
    }

    const product = (productRows as any[])[0];

    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // ✅ VALIDASI PRE-ORDER
    if (product.status === 'pre-order') {
      const remainingQuota = (product.po_quota || 0) - (product.po_sold || 0);
      
      if (newQuantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order} for pre-order items.`);
      }
      if (newQuantity > remainingQuota) {
        throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}.`);
      }
      
      if (product.harvest_date) {
        let harvestDate: Date;
        if (product.harvest_date instanceof Date) {
          harvestDate = new Date(product.harvest_date);
          harvestDate.setHours(0, 0, 0, 0);
        } else if (typeof product.harvest_date === 'string') {
          const [year, month, day] = product.harvest_date.split('-').map(Number);
          harvestDate = new Date(year, (month || 1) - 1, day || 1);
        } else {
          throw new Error('Format harvest_date tidak valid');
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (harvestDate < today) {
          const dateStr = product.harvest_date instanceof Date 
            ? product.harvest_date.toISOString().split('T')[0] 
            : product.harvest_date;
          throw new Error(`Tanggal panen Pre-Order (${dateStr}) sudah lewat.`);
        }
      }
    }
    // ✅ VALIDASI READY_STOCK
    else if (product.status === 'ready_stock') {
      if (newQuantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order}`);
      }
      if (newQuantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }
    } else {
      throw new Error('Product is currently unavailable.');
    }

    // ✅ Update quantity
    await pool.execute(
      'UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?',
      [newQuantity, userId, productId]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Cart item quantity updated successfully',
      newQuantity
    });

  } catch (err: any) {
    console.error('Error patching cart item:', err);
    return handleAPIError(err, 'PATCH /api/cart');
  }
}

// ==================== DELETE: Hapus Item dari Cart ====================
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { productId } = await req.json();

    if (!productId) {
      throw new Error('Product ID is required');
    }

    // ✅ Hapus item
    const [result] = await pool.execute(
      'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Product not found in cart');
    }

    return NextResponse.json({ success: true, message: 'Product removed from cart successfully' });

  } catch (err: any) {
    console.error('Error removing product from cart:', err);
    return handleAPIError(err, 'DELETE /api/cart');
  }
}