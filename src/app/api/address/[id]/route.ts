// src/app/api/address/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
import { keysToCamelCase } from '@/lib/utils'; // ✅ Import helper mapping

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// Validasi villageCode (10 digit untuk API ongkir)
function validateVillageCode(code: string): boolean {
  return /^\d{10}$/.test(code);
}

// Validasi location code (2-8 digit numeric)
function validateLocationCode(code: string): boolean {
  return /^\d{2,8}$/.test(code);
}

// ✅ PUT: Update existing address
export async function PUT(req: NextRequest, { params }: Params) {
  try {
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
    
    // ✅ Ambil ID dari URL params (Next.js 15)
    const resolvedParams = await params;
    const addressId = resolvedParams.id;
    
    if (!addressId || isNaN(Number(addressId))) {
      return NextResponse.json(
        { success: false, error: 'Invalid address ID' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // ✅ Validasi required fields (Frontend mengirim camelCase)
    const requiredFields = [
      'villageCode', 'province', 'city', 'district',
      'detail', 'zipCode', 'recipientName', 'recipientPhone'
    ];
    
    for (const field of requiredFields) {
      const value = body[field];
      if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
        return NextResponse.json(
          { success: false, error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // ✅ Validasi format
    if (!validateVillageCode(body.villageCode)) {
      return NextResponse.json(
        { success: false, error: 'Kode desa tidak valid. Harus 10 digit angka.' },
        { status: 400 }
      );
    }

    if (!validateLocationCode(body.province) || 
        !validateLocationCode(body.city) || 
        !validateLocationCode(body.district)) {
      return NextResponse.json(
        { success: false, error: 'Kode lokasi tidak valid.' },
        { status: 400 }
      );
    }

    // ✅ Verifikasi kepemilikan (Snake_case: user_id, deleted_at)
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [addressId, userId]
    );

    if ((checkRows as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Address not found or does not belong to user.' },
        { status: 404 }
      );
    }

    // ✅ Update menggunakan SNAKE_CASE
    const [result] = await pool.execute(
      `UPDATE address SET 
        village_code = ?, 
        province = ?, city = ?, district = ?, 
        detail = ?, zip_code = ?, 
        recipient_name = ?, recipient_phone = ?, 
        is_default = ?, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ?`,
      [
        body.villageCode?.trim(),
        body.province?.trim(),
        body.city?.trim(),
        body.district?.trim(),
        body.detail?.trim(),
        body.zipCode?.trim(),
        body.recipientName?.trim(),
        body.recipientPhone?.trim(),
        body.isDefault || false,
        addressId,
        userId
      ]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Address not found or could not be updated.' },
        { status: 404 }
      );
    }

    // ✅ Ambil data update & convert ke camelCase
    const [updatedRows] = await pool.execute(
      `SELECT 
        id, user_id, detail, village_code, 
        province, city, district, 
        zip_code, recipient_name, recipient_phone, 
        is_default, created_at, updated_at 
      FROM address WHERE id = ?`,
      [addressId]
    );

    const address = keysToCamelCase(updatedRows)[0];

    return NextResponse.json({
      success: true,
      address: address || null,
      message: 'Alamat berhasil diperbarui'
    });

  } catch (err: any) {
    return handleAPIError(err, 'PUT /api/address/[id]');
  }
}

// ✅ DELETE: Soft Delete Address dengan Cek Riwayat Pesanan
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
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
    
    // ✅ Ambil ID dari URL params
    const resolvedParams = await params;
    const addressId = resolvedParams.id;
    
    if (!addressId || isNaN(Number(addressId))) {
      return NextResponse.json(
        { success: false, error: 'Invalid address ID' },
        { status: 400 }
      );
    }

    // ✅ 1. Verifikasi kepemilikan & belum dihapus
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [addressId, userId]
    );

    if ((checkRows as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak ditemukan atau sudah dihapus.' },
        { status: 404 }
      );
    }

    // ✅ 2. Cek penggunaan di Orders (Snake_case: address_id)
    // Pastikan kolom foreign key di tabel orders bernama 'address_id'
    const [orderRefs] = await pool.execute(
      'SELECT id FROM orders WHERE address_id = ? LIMIT 1',
      [addressId]
    );

    if ((orderRefs as any[]).length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Alamat tidak dapat dihapus karena masih digunakan dalam riwayat pesanan.',
          code: 'ADDRESS_IN_USE'
        },
        { status: 400 }
      );
    }

    // ✅ 3. Soft Delete (Update deleted_at)
    const [result] = await pool.execute(
      'UPDATE address SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [addressId, userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Gagal menghapus alamat.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Alamat berhasil dihapus'
    });

  } catch (err: any) {
    return handleAPIError(err, 'DELETE /api/address/[id]');
  }
}