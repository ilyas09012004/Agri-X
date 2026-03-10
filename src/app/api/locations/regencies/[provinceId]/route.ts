import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{
    provinceId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { provinceId } = await params;

    // ✅ Validasi provinceId harus CODE (angka), bukan NAME
    if (!provinceId || typeof provinceId !== 'string' || provinceId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Province ID (code) is required' },
        { status: 400 }
      );
    }

    // ✅ Pastikan provinceId adalah kode (numeric string)
    if (!/^\d+$/.test(provinceId)) {
      return NextResponse.json(
        { success: false, error: 'Province ID must be a numeric code (e.g., "35"), not name' },
        { status: 400 }
      );
    }

    const [rows] = await pool.execute(
      'SELECT id, name, province_id FROM regencies WHERE province_id = ? ORDER BY name ASC',
      [provinceId]
    );

    return NextResponse.json({
      success: true,
      data: Array.isArray(rows) ? rows : []
    });

  } catch (error: any) {
    console.error('Error fetching regencies:', error);
    return handleAPIError(error, 'GET /api/locations/regencies/[provinceId]');
  }
}