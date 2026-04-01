// src/app/api/address/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

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

    // ✅ Validasi required fields (CODE format dari frontend)
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

    // ✅ Validasi villageCode (10 digit untuk API ongkir)
    if (!validateVillageCode(body.villageCode)) {
      return NextResponse.json(
        { success: false, error: 'Kode desa tidak valid. Harus 10 digit angka.' },
        { status: 400 }
      );
    }

    // ✅ Validasi location codes (2-8 digit)
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

    // ✅ Verifikasi kepemilikan alamat (pakai addressId dari URL)
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ?',
      [addressId, userId]
    );

    if ((checkRows as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Address not found or does not belong to user.' },
        { status: 404 }
      );
    }

    // ✅ Update dengan CODE format (pakai addressId dari URL)
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
        body.villageCode?.trim() ?? '',
        body.province?.trim() ?? '',
        body.city?.trim() ?? '',
        body.district?.trim() ?? '',
        body.detail?.trim() ?? '',
        body.zipCode?.trim() ?? '',
        body.recipientName?.trim() ?? '',
        body.recipientPhone?.trim() ?? '',
        body.isDefault || false,
        addressId,  // ✅ Pakai ID dari URL params
        userId
      ]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Address not found or could not be updated.' },
        { status: 404 }
      );
    }

    // ✅ Ambil data yang diupdate
    const [updatedRows] = await pool.execute(
      `SELECT 
        id, userId, detail, villageCode, 
        province, city, district, 
        zipCode, recipientName, recipientPhone, 
        isDefault, createdAt, updatedAt 
      FROM address WHERE id = ?`,
      [addressId]
    );

    return NextResponse.json({
      success: true,
      address: Array.isArray(updatedRows) && updatedRows.length > 0 ? updatedRows[0] : null,
      message: 'Alamat berhasil diperbarui'
    });

  } catch (err: any) {
    console.error('Error updating address:', err);
    return handleAPIError(err, 'PUT /api/address/[id]');
  }
}

// ✅ DELETE: Delete address
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

    // ✅ Verifikasi kepemilikan
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ?',
      [addressId, userId]
    );

    if ((checkRows as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Address not found or does not belong to user.' },
        { status: 404 }
      );
    }

    const [result] = await pool.execute(
      'DELETE FROM address WHERE id = ? AND userId = ?',
      [addressId, userId]
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Address not found or could not be deleted.' },
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