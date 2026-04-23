// src/app/api/address/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';
import { keysToCamelCase, keysToSnakeCase } from '@/lib/utils'; // ✅ Import helper mapping

// Validasi villageCode (10 digit untuk API ongkir)
function validateVillageCode(code: string): boolean {
  return /^\d{10}$/.test(code);
}

// Validasi location code (2-8 digit numeric)
function validateLocationCode(code: string): boolean {
  return /^\d{2,8}$/.test(code);
}

export async function GET(req: NextRequest) {
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

    // ✅ Query menggunakan SNAKE_CASE (sesuai DB)
    const [rows] = await pool.execute(
      `SELECT 
        id, user_id, detail, village_code, 
        province, city, district, 
        zip_code, recipient_name, recipient_phone, 
        is_default, created_at, updated_at 
      FROM address 
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    // ✅ Convert hasil DB (snake_case) ke Frontend (camelCase)
    const addresses = keysToCamelCase(rows);

    return NextResponse.json({
      success: true,
      addresses: Array.isArray(addresses) ? addresses : []
    });

  } catch (err: any) {
    return handleAPIError(err, 'GET /api/address');
  }
}

export async function POST(req: NextRequest) {
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

    // ✅ Insert menggunakan SNAKE_CASE
    const [result] = await pool.execute(
      `INSERT INTO address (
        user_id, village_code, 
        province, city, district, 
        detail, zip_code, 
        recipient_name, recipient_phone, 
        is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userId,
        body.villageCode?.trim(),
        body.province?.trim(),
        body.city?.trim(),
        body.district?.trim(),
        body.detail?.trim(),
        body.zipCode?.trim(),
        body.recipientName?.trim(),
        body.recipientPhone?.trim(),
        body.isDefault || false
      ]
    );

    const insertedId = (result as any).insertId;

    // ✅ Ambil data baru & convert ke camelCase
    const [rows] = await pool.execute(
      `SELECT 
        id, user_id, detail, village_code, 
        province, city, district, 
        zip_code, recipient_name, recipient_phone, 
        is_default, created_at, updated_at 
      FROM address WHERE id = ?`,
      [insertedId]
    );

    const address = keysToCamelCase(rows)[0];

    return NextResponse.json({
      success: true,
      address: address || null,
      message: 'Alamat berhasil ditambahkan'
    });

  } catch (err: any) {
    return handleAPIError(err, 'POST /api/address');
  }
}

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
    const body = await req.json();

    if (!body.id) {
      throw new Error('Address ID is required for update.');
    }

    // ✅ Verifikasi kepemilikan (Snake_case)
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [body.id, userId]
    );

    if ((checkRows as any[]).length === 0) {
      throw new Error('Address not found or does not belong to user.');
    }

    if (body.villageCode && !validateVillageCode(body.villageCode)) {
      throw new Error('Kode desa tidak valid. Harus 10 digit angka.');
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
        body.id,
        userId
      ]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Address not found or could not be updated.');
    }

    // ✅ Ambil data update & convert ke camelCase
    const [updatedRows] = await pool.execute(
      `SELECT 
        id, user_id, detail, village_code, 
        province, city, district, 
        zip_code, recipient_name, recipient_phone, 
        is_default, created_at, updated_at 
      FROM address WHERE id = ?`,
      [body.id]
    );

    const address = keysToCamelCase(updatedRows)[0];

    return NextResponse.json({
      success: true,
      address: address || null,
      message: 'Alamat berhasil diperbarui'
    });

  } catch (err: any) {
    return handleAPIError(err, 'PUT /api/address');
  }
}

// ✅ DELETE: Soft Delete Address
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    
    // ✅ Ambil ID dari params (Next.js 15 style)
    const { id: addressId } = await context.params;
    
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
    // Pastikan kolom di tabel orders bernama 'address_id'
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

    // ✅ 3. Soft Delete
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