// src/app/api/locations/regencies/[provinceId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

type Params = {
  params: Promise<{
    provinceId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    let provinceId = resolvedParams.provinceId;

    // ✅ Decode URL encoding
    provinceId = decodeURIComponent(provinceId);

    console.log('🔍 Fetching regencies for provinceId:', provinceId);

    // ✅ Validasi 1: provinceId tidak boleh kosong
    if (!provinceId || typeof provinceId !== 'string' || provinceId.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Province ID (code) is required' },
        { status: 400 }
      );
    }

    // ✅ Validasi 2: provinceId HARUS numeric code
    if (!/^\d{2,4}$/.test(provinceId)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Province ID must be a numeric code (e.g., "35"), not a name',
          received: provinceId,
          expected: '2-4 digit numeric string'
        },
        { status: 400 }
      );
    }

    // ✅ Query database
    const [rows] = await pool.execute(
      `SELECT 
        id, 
        name, 
        province_id 
      FROM regencies 
      WHERE province_id = ? 
      ORDER BY name ASC`,
      [provinceId]
    );

    console.log('✅ Query successful. Found', Array.isArray(rows) ? rows.length : 0, 'regencies');

    return NextResponse.json({
      success: true,
      data: Array.isArray(rows) ? rows : [],
      count: Array.isArray(rows) ? rows.length : 0
    });

  } catch (error: any) {
    console.error('❌ Error fetching regencies:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes('Table')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Table "regencies" not found',
          hint: 'Please check your database schema'
        },
        { status: 500 }
      );
    }
    
    if (error.message?.includes('Unknown column')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Column "province_id" not found',
          hint: 'Expected column: province_id'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch regencies',
        code: 'FETCH_REGENCIES_ERROR'
      },
      { status: 500 }
    );
  }
}