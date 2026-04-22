// src/app/api/address/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

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

    const [rows] = await pool.execute(
      `SELECT 
        id, userId, detail, villageCode, 
        province, city, district, 
        zipCode, recipientName, recipientPhone, 
        isDefault, createdAt, updatedAt 
      FROM address 
      WHERE userId = ? 
      ORDER BY isDefault DESC, createdAt DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      addresses: Array.isArray(rows) ? rows : []
    });

  } catch (err: any) {
    console.error('Error fetching addresses:', err);
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

    // ✅ Validasi required fields
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

    // ✅ Validasi villageCode (10 digit)
    if (!validateVillageCode(body.villageCode)) {
      return NextResponse.json(
        { success: false, error: 'Kode desa tidak valid. Harus 10 digit angka.' },
        { status: 400 }
      );
    }

    // ✅ Validasi location codes
    if (!validateLocationCode(body.province)) {
      return NextResponse.json(
        { success: false, error: 'Kode provinsi tidak valid.' },
        { status: 400 }
      );
    }
    if (!validateLocationCode(body.city)) {
      return NextResponse.json(
        { success: false, error: 'Kode kota tidak valid.' },
        { status: 400 }
      );
    }
    if (!validateLocationCode(body.district)) {
      return NextResponse.json(
        { success: false, error: 'Kode kecamatan tidak valid.' },
        { status: 400 }
      );
    }

    // ✅ FIX: 10 kolom + 2 timestamp = 12 total, 10 placeholders + 2 CURRENT_TIMESTAMP = 12 values
    const [result] = await pool.execute(
      `INSERT INTO address (
        userId, villageCode, 
        province, city, district, 
        detail, zipCode, 
        recipientName, recipientPhone, 
        isDefault, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userId,                        // 1. userId
        body.villageCode?.trim(),      // 2. villageCode
        body.province?.trim(),         // 3. province (CODE)
        body.city?.trim(),           // 4. city (CODE)
        body.district?.trim(),       // 5. district (CODE)
        body.detail?.trim(),           // 6. detail
        body.zipCode?.trim(),          // 7. zipCode
        body.recipientName?.trim(),    // 8. recipientName
        body.recipientPhone?.trim(),   // 9. recipientPhone
        body.isDefault || false        // 10. isDefault
        // createdAt & updatedAt = CURRENT_TIMESTAMP (otomatis)
      ]
    );

    const insertedId = (result as any).insertId;

    const [rows] = await pool.execute(
      `SELECT 
        id, userId, detail, villageCode, 
        province, city, district, 
        zipCode, recipientName, recipientPhone, 
        isDefault, createdAt, updatedAt 
      FROM address WHERE id = ?`,
      [insertedId]
    );

    return NextResponse.json({
      success: true,
      address: Array.isArray(rows) && rows.length > 0 ? rows[0] : null,
      message: 'Alamat berhasil ditambahkan'
    });

  } catch (err: any) {
    console.error('Error adding address:', err);
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

    // ✅ Verifikasi kepemilikan
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ?',
      [body.id, userId]
    );

    if ((checkRows as any[]).length === 0) {
      throw new Error('Address not found or does not belong to user.');
    }

    if (body.villageCode && !validateVillageCode(body.villageCode)) {
      throw new Error('Kode desa tidak valid. Harus 10 digit angka.');
    }

    // ✅ FIX: 10 kolom update + 1 timestamp + 2 WHERE = 13 total, 10 placeholders + 1 CURRENT_TIMESTAMP + 2 WHERE = 13 values
    const [result] = await pool.execute(
      `UPDATE address SET 
        villageCode = ?, 
        province = ?, city = ?, district = ?, 
        detail = ?, zipCode = ?, 
        recipientName = ?, recipientPhone = ?, 
        isDefault = ?, 
        updatedAt = CURRENT_TIMESTAMP 
      WHERE id = ? AND userId = ?`,
      [
        body.villageCode?.trim(),      // 1
        body.province?.trim(),         // 2
        body.city?.trim(),           // 3
        body.district?.trim(),       // 4
        body.detail?.trim(),           // 5
        body.zipCode?.trim(),          // 6
        body.recipientName?.trim(),    // 7
        body.recipientPhone?.trim(),   // 8
        body.isDefault || false,       // 9
        body.id,                       // 10 (WHERE id = ?)
        userId                         // 11 (WHERE userId = ?)
      ]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Address not found or could not be updated.');
    }

    const [updatedRows] = await pool.execute(
      `SELECT 
        id, userId, detail, villageCode, 
        province, city, district, 
        zipCode, recipientName, recipientPhone, 
        isDefault, createdAt, updatedAt 
      FROM address WHERE id = ?`,
      [body.id]
    );

    return NextResponse.json({
      success: true,
      address: Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null,
      message: 'Alamat berhasil diperbarui'
    });

  } catch (err: any) {
    console.error('Error updating address:', err);
    return handleAPIError(err, 'PUT /api/address');
  }
}

// ✅ DELETE: Delete address (dengan cek foreign key + soft delete)
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

    // ✅ 1. Verifikasi kepemilikan DAN cek apakah belum di-soft-delete
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ? AND deleted_at IS NULL',
      [addressId, userId]
    );

    if ((checkRows as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak ditemukan atau sudah dihapus.' },
        { status: 404 }
      );
    }

    // ✅ 2. CEK: Apakah alamat ini digunakan di tabel orders?
    const [orderRefs] = await pool.execute(
      'SELECT id FROM orders WHERE addressId = ? LIMIT 1',
      [addressId]
    );

    if ((orderRefs as any[]).length > 0) {
      // ✅ Alamat masih dipakai di order history → tidak boleh dihapus
      return NextResponse.json(
        { 
          success: false, 
          error: 'Alamat tidak dapat dihapus karena masih digunakan dalam riwayat pesanan.',
          code: 'ADDRESS_IN_USE'
        },
        { status: 400 }
      );
    }

    // ✅ 3. SOFT DELETE: Update deleted_at вместо DELETE fisik
    const [result] = await pool.execute(
      'UPDATE address SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?',
      [addressId, userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Alamat tidak dapat dihapus.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Alamat berhasil dihapus'
    });

  } catch (err: any) {
    console.error('Error deleting address:', err);
    return handleAPIError(err, 'DELETE /api/address/[id]');
  }
}