// src/app/api/address/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import pool from '@/lib/db';
import { handleAPIError } from '@/lib/middleware';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const resolvedParams = await params;
    const addressId = resolvedParams.id;
    const { detail, province, cityId, districtId, villageCode, zipCode } = await req.json();

    if (!detail || !villageCode) {
      throw new Error('Detail and villageCode are required');
    }

    // Verify address belongs to user
    const [checkRows] = await pool.execute(
      'SELECT id FROM address WHERE id = ? AND userId = ?',
      [addressId, userId]
    );

    if ((checkRows as any[]).length === 0) {
      throw new Error('Address not found or does not belong to user');
    }

    await pool.execute(
      `UPDATE address SET detail = ?, province = ?, cityId = ?, districtId = ?, villageCode = ?, zipCode = ?, updatedAt = CURRENT_TIMESTAMP 
       WHERE id = ? AND userId = ?`,
      [detail, province, cityId, districtId, villageCode, zipCode, addressId, userId]
    );

    return NextResponse.json({ success: true, message: 'Address updated successfully' });

  } catch (error: any) {
    console.error('Error updating address:', error);
    return handleAPIError(error, 'PUT /api/address/[id]');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const resolvedParams = await params;
    const addressId = resolvedParams.id;

    const [result] = await pool.execute(
      'DELETE FROM address WHERE id = ? AND userId = ?',
      [addressId, userId]
    );

    if ((result as any).affectedRows === 0) {
      throw new Error('Address not found or does not belong to user');
    }

    return NextResponse.json({ success: true, message: 'Address deleted successfully' });

  } catch (error: any) {
    console.error('Error deleting address:', error);
    return handleAPIError(error, 'DELETE /api/address/[id]');
  }
}