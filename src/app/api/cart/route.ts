import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

// ==================== GET: Ambil Cart Items ====================
export async function GET(req: NextRequest) {
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

    // ✅ Query: Ambil field yang diperlukan (status sudah termasuk)
    const [cartItems] = await pool.execute(`
      SELECT 
        ci.id as cartId,
        ci.userId,
        ci.productId,
        ci.quantity,
        ci.createdAt,
        ci.updatedAt,
        p.name as productName,
        p.price as productPrice,
        p.image_path as productImage,
        p.stock as productStock,
        p.min_order as productMinOrder,
        p.status as productStatus,
        p.po_quota as productPoQuota,
        p.po_sold as productPoSold,
        p.harvest_date as productHarvestDate,
        p.origin_village_code as productOriginVillageCode
      FROM cartitems ci
      JOIN products p ON ci.productId = p.id
      WHERE ci.userId = ?
    `, [userId]);

    const formattedCartItems = (Array.isArray(cartItems) ? cartItems : []).map((item: any) => ({
      id: item.cartId,
      userId: item.userId,
      productId: item.productId,
      quantity: item.quantity,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      product: {
        id: item.productId,
        name: item.productName,
        price: item.productPrice,
        image: item.productImage,
        stock: item.productStock,
        min_order: item.productMinOrder,
        status: item.productStatus, // 'ready_stock' | 'pre-order' | 'sold_out' | 'deleted'
        // ✅ Field Pre-Order (hanya relevan jika status === 'pre-order')
        po_quota: item.productPoQuota,
        po_sold: item.productPoSold,
        harvest_date: item.productHarvestDate,
        // Field existing untuk kompatibilitas
        weight: item.productStock,
        originVillageCode: item.productOriginVillageCode,
      }
    }));

    const totalWeight = formattedCartItems.reduce((sum, item) => {
      const itemWeight = item.product.stock || 0;
      return sum + (itemWeight * item.quantity);
    }, 0);

    return NextResponse.json({
      success: true,
       formattedCartItems,
      totalWeight
    });

  } catch (err: any) {
    console.error('Error fetching cart:', err);
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

    // ✅ Query: Ambil status dan field Pre-Order
    const [productRows] = await pool.execute(
      `SELECT id, stock, min_order, status, po_quota, po_sold, harvest_date 
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

    // ✅ LOGIKA PRE-ORDER: Gunakan status === 'pre-order'
    if (product.status === 'pre-order') {
      const remainingQuota = (product.po_quota || 0) - (product.po_sold || 0);
      
      if (quantity > remainingQuota) {
        throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}. Silakan kurangi jumlah pesanan.`);
      }

      if (!product.harvest_date) {
        throw new Error('Tanggal panen Pre-Order belum ditetapkan oleh petani.');
      }

      // ✅ FIX: Handle harvest_date yang bisa berupa Date object atau string
      let harvestDate: Date;
      
      if (product.harvest_date instanceof Date) {
        // MySQL2 driver mengembalikan Date object untuk kolom DATE
        harvestDate = new Date(product.harvest_date);
        harvestDate.setHours(0, 0, 0, 0);
      } else if (typeof product.harvest_date === 'string') {
        // Fallback jika berupa string 'YYYY-MM-DD'
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
    // ✅ LOGIKA READY_STOCK: Validasi stok (existing logic - TIDAK DIUBAH)
    else if (product.status === 'ready_stock') {
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order}`);
      }
      if (quantity > product.stock) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }
    }
    // ✅ Status lain tidak tersedia untuk dibeli
    else {
      throw new Error('Product is currently unavailable.');
    }

    // Cek apakah produk sudah ada di keranjang
    const [existingCartRows] = await pool.execute(
      'SELECT id, quantity FROM cartitems WHERE userId = ? AND productId = ?',
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
        'UPDATE cartitems SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND productId = ?',
        [newQuantity, userId, productId]
      );
    } else {
      // Insert baru
      // ✅ Validasi ulang untuk insert
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
        'INSERT INTO cartitems (userId, productId, quantity, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
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

    // ✅ Hapus item jika quantity = 0 (existing logic)
    if (quantity === 0) {
      const [deleteResult] = await pool.execute(
        'DELETE FROM cartitems WHERE userId = ? AND productId = ?',
        [userId, productId]
      );

      if ((deleteResult as any).affectedRows === 0) {
        throw new Error('Product not found in cart for deletion');
      }

      return NextResponse.json({ success: true, message: 'Product removed from cart successfully' });
    }

    // ✅ Ambil produk dengan field Pre-Order
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

    // ✅ VALIDASI PRE-ORDER: Gunakan status === 'pre-order'
    if (product.status === 'pre-order') {
      const remainingQuota = (product.po_quota || 0) - (product.po_sold || 0);
      
      if (quantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order} for pre-order items.`);
      }
      if (quantity > remainingQuota) {
        throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}.`);
      }
      
      // ✅ FIX: Handle harvest_date yang bisa berupa Date object atau string
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
    // ✅ VALIDASI READY_STOCK (existing logic - TIDAK DIUBAH)
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

    // Update quantity
    const [result] = await pool.execute(
      'UPDATE cartitems SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND productId = ?',
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

    // Ambil item keranjang saat ini
    const [cartRows] = await pool.execute(
      'SELECT quantity FROM cartitems WHERE userId = ? AND productId = ?',
      [userId, productId]
    );

    if ((cartRows as any[]).length === 0) {
      throw new Error('Product not found in cart');
    }

    const currentQuantity = (cartRows as any[])[0].quantity;
    const newQuantity = currentQuantity + delta;

    // Jika hasilnya <= 0, hapus item (existing logic)
    if (newQuantity <= 0) {
      await pool.execute(
        'DELETE FROM cartitems WHERE userId = ? AND productId = ?',
        [userId, productId]
      );
      return NextResponse.json({ 
        success: true, 
        message: 'Product removed from cart (quantity <= 0)' 
      });
    }

    // ✅ Ambil produk dengan field Pre-Order
    const [productRows] = await pool.execute(
      `SELECT id, stock, min_order, status, po_quota, po_sold, harvest_date 
       FROM products WHERE id = ? AND status != ?`,
      [productId, 'deleted']
    );

    if ((productRows as any[]).length === 0) {
      await pool.execute(
        'DELETE FROM cartitems WHERE userId = ? AND productId = ?',
        [userId, productId]
      );
      throw new Error('Product is no longer available');
    }

    const product = (productRows as any[])[0];

    if (product.status === 'sold_out') {
      throw new Error('Product is currently sold out.');
    }

    // ✅ VALIDASI PRE-ORDER: Gunakan status === 'pre-order'
    if (product.status === 'pre-order') {
      const remainingQuota = (product.po_quota || 0) - (product.po_sold || 0);
      
      if (newQuantity < product.min_order) {
        throw new Error(`Quantity must be at least ${product.min_order} for pre-order items.`);
      }
      if (newQuantity > remainingQuota) {
        throw new Error(`Kuota Pre-Order tersisa ${remainingQuota}.`);
      }
      
      // ✅ FIX: Handle harvest_date yang bisa berupa Date object atau string
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
    // ✅ VALIDASI READY_STOCK (existing logic)
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

    // Update quantity
    await pool.execute(
      'UPDATE cartitems SET quantity = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND productId = ?',
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

    // Hapus item (existing logic - TIDAK DIUBAH)
    const [result] = await pool.execute(
      'DELETE FROM cartitems WHERE userId = ? AND productId = ?',
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